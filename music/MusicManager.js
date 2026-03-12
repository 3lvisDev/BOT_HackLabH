const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType, NoSubscriberBehavior } = require('@discordjs/voice');
const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');
const path = require('path');
const db = require('../db');
const { logMusicEvent } = require('./logger');

class MusicManager {
    constructor(client) {
        this.client = client;
        this.connection = null;
        this.player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play
            }
        });
        
        // Browser & Session State
        this.browser = null;
        this.context = null;
        this.page = null;
        this.ffmpegProcess = null;
        
        this.currentTrack = null;
        this.channelName = null;
        this.channelId = null;
        this.isActive = false;
        this.guildId = null;

        // Player Event Listeners
        this.player.on(AudioPlayerStatus.Idle, () => {
            logMusicEvent(this.guildId, 'info', 'Reproducción finalizada o detenida.');
            // En el sistema basado en navegador, el idle puede significar que el video terminó
            // pero mantenemos la sesión abierta hasta que el usuario diga !stop o el navegador se cierre
        });
        
        this.player.on('error', error => {
            logMusicEvent(this.guildId, 'error', `Error en el reproductor de voz: ${error.message}`);
            this.stop();
        });
    }

    /**
     * Inicia una sesión de música usando el navegador virtual
     */
    async play(guildId, voiceChannelId, query) {
        // Redundantes checks de seguridad solicitados en Auditoría 2
        if (this.isActive) {
            throw new Error(`Ya hay una reproducción activa en el canal: ${this.channelName}`);
        }

        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) throw new Error("Servidor no encontrado.");

        const voiceChannel = guild.channels.cache.get(voiceChannelId);
        if (!voiceChannel) throw new Error("Canal de voz no encontrado.");

        try {
            this.isActive = true;
            this.guildId = guildId;
            this.channelId = voiceChannelId;
            this.channelName = voiceChannel.name;

            // 1. Conectar a Voz
            this.connection = joinVoiceChannel({
                channelId: voiceChannelId,
                guildId: guildId,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: true,
                selfMute: false,
            });
            this.connection.subscribe(this.player);
            logMusicEvent(guildId, 'info', `Conectado al canal: ${this.channelName}`);

            // 2. Iniciar Pipeline Modular
            await this._launchBrowser(guildId);
            await this._navigateToYouTube(query);
            this._startAudioBridge();

            return {
                title: this.currentTrack,
                channel: this.channelName
            };

        } catch (err) {
            logMusicEvent(guildId, 'error', `Fallo en el pipeline de música: ${err.message}`);
            await this.stop();
            throw err;
        }
    }

    /**
     * Lanza la instancia de Playwright con cookies de YouTube Premium si existen
     */
    async _launchBrowser(guildId) {
        logMusicEvent(guildId, 'debug', 'Lanzando navegador virtual (Chromium)...');
        
        this.browser = await chromium.launch({
            headless: true, // Requerido por el spec
            args: [
                '--autoplay-policy=no-user-gesture-required',
                '--disable-extensions',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

        const settings = await db.getMusicSettings(guildId);
        this.context = await this.browser.newContext({
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        });

        if (settings && settings.yt_cookies) {
            try {
                const cookies = JSON.parse(settings.yt_cookies);
                await this.context.addCookies(cookies);
                logMusicEvent(guildId, 'info', 'Cookies de YouTube Premium cargadas con éxito.');
            } catch (e) {
                logMusicEvent(guildId, 'warning', 'Error al cargar cookies de YouTube Premium. Continuando sin login.');
            }
        }

        this.page = await this.context.newPage();
    }

    /**
     * Maneja la navegación y búsqueda en YouTube
     */
    async _navigateToYouTube(query) {
        const isUrl = query.startsWith('http');
        const targetUrl = isUrl ? query : `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        
        logMusicEvent(this.guildId, 'debug', `Navegando a: ${targetUrl}`);
        await this.page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });

        if (!isUrl) {
            // Click en el primer resultado de búsqueda
            logMusicEvent(this.guildId, 'debug', 'Seleccionando primer resultado de búsqueda...');
            await this.page.click('#contents ytd-video-renderer a#video-title');
            await this.page.waitForSelector('video', { timeout: 15000 });
        }

        // Extraer título
        this.currentTrack = await this.page.title();
        // Limpiar " - YouTube" del título
        this.currentTrack = this.currentTrack.replace(' - YouTube', '');
        
        logMusicEvent(this.guildId, 'info', `Reproduciendo: ${this.currentTrack}`);
    }

    /**
     * Captura el audio del sistema (PulseAudio) y lo envía a Discord
     */
    _startAudioBridge() {
        logMusicEvent(this.guildId, 'debug', 'Iniciando Audio Bridge (ffmpeg + PulseAudio)...');

        // Verificación de PulseAudio (Observación Menor 1 de Auditoría 2)
        try {
            if (process.platform !== 'win32') {
                execSync('pactl info', { stdio: 'ignore' });
            }
        } catch (e) {
            logMusicEvent(this.guildId, 'warning', 'PulseAudio no detectado. Es posible que no se capture audio.');
        }

        // Argumentos de FFmpeg para capturar de PulseAudio (sink monitor)
        // En Linux usualmente es 'pulse' o el nombre del monitor
        const ffmpegArgs = process.platform === 'win32' 
            ? ['-f', 'dshow', '-i', 'audio=CualquierDispositivoDeCaptura', '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1']
            : ['-f', 'pulse', '-i', 'default', '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1'];

        this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

        // Manejo de errores FFmpeg
        this.ffmpegProcess.on('error', (err) => {
            logMusicEvent(this.guildId, 'error', `Error en proceso FFmpeg: ${err.message}`);
        });

        // Timeout de seguridad (Observación Menor 2 de Auditoría 2)
        const timeout = setTimeout(() => {
            if (this.ffmpegProcess && this.isActive) {
                logMusicEvent(this.guildId, 'warning', 'Sesión prolongada (timeout de seguridad), deteniendo...');
                this.stop();
            }
        }, 4 * 60 * 60 * 1000); // 4 horas máximo por sesión

        this.ffmpegProcess.on('close', () => clearTimeout(timeout));

        const resource = createAudioResource(this.ffmpegProcess.stdout, {
            inputType: StreamType.Raw,
            inlineVolume: true
        });

        resource.volume.setVolume(1.0);
        this.player.play(resource);
    }

    async stop() {
        logMusicEvent(this.guildId, 'info', 'Cerrando sesión de música y liberando recursos.');
        
        try {
            if (this.ffmpegProcess) {
                this.ffmpegProcess.kill('SIGINT');
                this.ffmpegProcess = null;
            }

            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }

            if (this.connection) {
                this.connection.destroy();
                this.connection = null;
            }

            this.player.stop();
            
            this.isActive = false;
            this.currentTrack = null;
            this.channelName = null;
            this.channelId = null;
            this.guildId = null;
            this.context = null;
            this.page = null;
        } catch (e) {
            logMusicEvent(this.guildId, 'error', `Error durante limpieza: ${e.message}`);
            // Forzar reseteo de estado
            this.isActive = false;
        }
    }

    getStatus() {
        return {
            active: this.isActive,
            currentTrack: this.currentTrack,
            channel: this.channelName,
            channelId: this.channelId,
            guildId: this.guildId,
            isPlaying: this.player.state.status !== AudioPlayerStatus.Idle,
            browserStatus: this.browser ? 'Activo' : 'Inactivo'
        };
    }
}

module.exports = MusicManager;
