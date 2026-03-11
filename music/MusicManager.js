const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process'); // Added execSync
const ffmpeg = require('ffmpeg-static');
const db = require('../db');
const { logMusicEvent } = require('./logger');

class MusicManager {
    constructor(client) {
        this.client = client;
        this.browser = null;
        this.page = null;
        this.connection = null;
        this.player = createAudioPlayer();
        this.currentTrack = null;
        this.channelName = null;
        this.channelId = null;
        this.isActive = false;
        this.ffmpegProcess = null;
        this.guildId = null;

        // Player Event Listeners
        this.player.on(AudioPlayerStatus.Idle, () => {
            logMusicEvent(this.guildId, 'info', 'Reproducción finalizada (Idle).');
            this.stop();
        });
        this.player.on('error', error => {
            logMusicEvent(this.guildId, 'error', `Error en el reproductor: ${error.message}`);
        });
    }

    async play(guildId, voiceChannelId, query) {
        if (this.isActive) {
            throw new Error(`Ya hay una reproducción activa en el canal: ${this.channelName}`);
        }

        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) throw new Error("Servidor no encontrado.");

        const voiceChannel = guild.channels.cache.get(voiceChannelId);
        if (!voiceChannel) throw new Error("Canal de voz no encontrado.");

        this.isActive = true;
        this.guildId = guildId;
        this.channelId = voiceChannelId;
        this.channelName = voiceChannel.name;
        
        logMusicEvent(guildId, 'info', `Iniciando sesión en canal: ${this.channelName}`, { query });

        try {
            // 1. Join voice channel
            this.connection = joinVoiceChannel({
                channelId: voiceChannelId,
                guildId: guildId,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false,
            });
            this.connection.subscribe(this.player);

            // 2. Process Pipeline
            await this._launchBrowser(guildId);
            await this._navigateToYouTube(query);
            this._startAudioBridge();

            logMusicEvent(guildId, 'info', `Reproduciendo ahora: ${this.currentTrack}`);

            return {
                title: this.currentTrack,
                channel: this.channelName
            };

        } catch (err) {
            logMusicEvent(guildId, 'error', `Error fatal en play(): ${err.message}`);
            await this.stop();
            throw err;
        }
    }

    async _launchBrowser(guildId) {
        logMusicEvent(guildId, 'debug', 'Lanzando navegador Chromium...');
        
        // Crear sink virtual de PulseAudio para audio aislado
        const virtualSinkName = `discord_music_${guildId}`;
        try {
            // Eliminar sink anterior si existe
            try {
                execSync(`pactl unload-module module-null-sink sink_name=${virtualSinkName}`, { stdio: 'ignore' });
            } catch (e) {
                // Ignorar si no existe
            }
            
            // Crear nuevo sink virtual
            execSync(`pactl load-module module-null-sink sink_name=${virtualSinkName} sink_properties=device.description="Discord_Music_Bot"`, { stdio: 'pipe' });
            logMusicEvent(guildId, 'info', `Sink virtual creado: ${virtualSinkName}`);
            this.virtualSinkName = virtualSinkName;
        } catch (e) {
            logMusicEvent(guildId, 'error', `Error creando sink virtual: ${e.message}`);
            throw new Error('No se pudo crear sink virtual de PulseAudio');
        }
        
        // Configurar variable de entorno para que Chromium use el sink virtual
        const env = {
            ...process.env,
            PULSE_SINK: virtualSinkName
        };
        
        this.browser = await chromium.launch({ 
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--autoplay-policy=no-user-gesture-required',
                '--disable-blink-features=AutomationControlled'
            ],
            env: env
        });
        
        const context = await this.browser.newContext({
            permissions: ['audio-capture', 'video-capture']
        });
        
        const settings = await db.getMusicSettings(guildId);
        if (settings && settings.yt_cookies) {
            try {
                const cookies = JSON.parse(settings.yt_cookies);
                await context.addCookies(cookies);
                logMusicEvent(guildId, 'info', 'Sesión de YouTube Premium aplicada desde cookies.');
            } catch (e) {
                logMusicEvent(guildId, 'warning', `Error al aplicar cookies: ${e.message}`);
            }
        }
        this.page = await context.newPage();

        // 3. Detectar y mover el sink-input (Bugfix Aislamiento) - Await para asegurar redirección
        await this._redirectAudioStream();
    }

    /**
     * @private
     * Busca el stream de audio de Chromium y lo mueve al sink virtual.
     */
    async _redirectAudioStream() {
        const guildId = this.guildId;
        const virtualSinkName = this.virtualSinkName;
        
        logMusicEvent(guildId, 'debug', 'Iniciando polling para detectar stream de Chromium...');

        let detectedSinkInput = null;
        const maxAttempts = 20; // 10 segundos total (500ms * 20)
        
        for (let i = 0; i < maxAttempts; i++) {
            try {
                // Listar todos los sink-inputs y buscar el que pertenece a Chromium/Playwright
                const output = execSync('pactl list short sink-inputs').toString();
                const lines = output.split('\n');
                
                for (const line of lines) {
                    if (!line.trim()) continue;
                    
                    // Formato corto: "ID SINK SAMPLE_SPEC ..."
                    const parts = line.split('\t');
                    const id = parts[0];
                    
                    // Obtener detalles del sink-input para verificar si es el correcto
                    const details = execSync(`pactl list sink-inputs`).toString();
                    // Buscamos el bloque que contiene este ID y "chromium" o "playwright"
                    if (details.includes(`Sink Input #${id}`) && 
                       (details.toLowerCase().includes('chromium') || details.toLowerCase().includes('playwright'))) {
                        detectedSinkInput = id;
                        break;
                    }
                }

                if (detectedSinkInput) {
                    logMusicEvent(guildId, 'info', `Stream detectado (ID: ${detectedSinkInput}). Moviendo a ${virtualSinkName}...`);
                    execSync(`pactl move-sink-input ${detectedSinkInput} ${virtualSinkName}`);
                    logMusicEvent(guildId, 'info', 'Redirección de audio exitosa.');
                    return;
                }
            } catch (e) {
                logMusicEvent(guildId, 'debug', `Intento ${i+1} de detección fallido: ${e.message}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        logMusicEvent(guildId, 'warning', 'No se pudo detectar el stream de audio de Chromium para redirección forzada.');
    }

    async _navigateToYouTube(query) {
        if (!this.page) throw new Error("Navegador no inicializado.");
        
        let url = query;
        if (!query.startsWith('http')) {
            url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            logMusicEvent(this.guildId, 'debug', `Buscando en YouTube: ${query}`);
        } else {
            logMusicEvent(this.guildId, 'debug', `Navegando a URL directa: ${query}`);
        }
        
        await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        if (url.includes('search_query')) {
            await this.page.waitForSelector('ytd-video-renderer #video-title', { timeout: 10000 });
            await this.page.click('ytd-video-renderer #video-title');
        }

        // Esperar a que el video esté listo
        await this.page.waitForSelector('video', { timeout: 15000 });
        
        // Obtener título
        this.currentTrack = await this.page.title();
        
        // Forzar reproducción del video
        await this.page.evaluate(() => {
            const video = document.querySelector('video');
            if (video) {
                video.muted = false;
                video.volume = 1.0;
                video.play().catch(e => console.error('Error al reproducir:', e));
            }
        });
        
        // RE-EJECUTAR Redirección si es necesario (a veces Chromium crea un nuevo stream al empezar el video)
        await this._redirectAudioStream();
        
        // Esperar un momento para que el audio comience
        await this.page.waitForTimeout(2000);
        
        logMusicEvent(this.guildId, 'debug', `Video cargado y reproducción iniciada: ${this.currentTrack}`);
    }

    /**
     * @private
     * Inicia el puente de audio usando ffmpeg y el recurso de Discord.
     */
    _startAudioBridge() {
        if (this.ffmpegProcess) this.ffmpegProcess.kill();
        
        logMusicEvent(this.guildId, 'debug', 'Iniciando puente de audio FFmpeg (PulseAudio)...');

        // Validar entorno PulseAudio
        try {
            execSync('pactl info', { stdio: 'ignore' });
        } catch (e) {
            throw new Error('PulseAudio no está disponible en el sistema');
        }
        
        // Usar el monitor del sink virtual que creamos
        const audioSource = `${this.virtualSinkName}.monitor`;
        
        // Verificar si el sink virtual está recibiendo audio (State: RUNNING)
        try {
            const sinkInfo = execSync(`pactl list sinks`).toString();
            if (!sinkInfo.includes(this.virtualSinkName)) {
                throw new Error('Sink virtual no encontrado en pactl');
            }
        } catch (e) {
            logMusicEvent(this.guildId, 'warning', `No se pudo verificar el estado del sink: ${e.message}`);
        }

        logMusicEvent(this.guildId, 'info', `Capturando audio desde: ${audioSource}`);
        
        const args = [
            '-f', 'pulse',
            '-i', audioSource,
            '-ac', '2',
            '-ar', '48000',
            '-f', 's16le',
            '-loglevel', 'error',
            'pipe:1'
        ];

        logMusicEvent(this.guildId, 'debug', `FFmpeg args: ${args.join(' ')}`);
        this.ffmpegProcess = spawn(ffmpeg, args);

        // Timeout de seguridad
        const timeout = setTimeout(() => {
            if (this.ffmpegProcess) {
                logMusicEvent(this.guildId, 'warning', 'FFmpeg timeout de inactividad (5 min), deteniendo...');
                this.stop();
            }
        }, 5 * 60 * 1000);

        this.ffmpegProcess.on('error', (err) => {
            logMusicEvent(this.guildId, 'error', `Error en FFmpeg: ${err.message}`);
            clearTimeout(timeout);
            this.stop();
        });

        this.ffmpegProcess.on('close', (code) => {
            logMusicEvent(this.guildId, 'info', `FFmpeg cerrado con código: ${code}`);
            clearTimeout(timeout);
        });

        // Log stderr para debugging
        this.ffmpegProcess.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) {
                logMusicEvent(this.guildId, 'debug', `FFmpeg stderr: ${msg}`);
            }
        });

        const resource = createAudioResource(this.ffmpegProcess.stdout, {
            inputType: StreamType.Raw,
            inlineVolume: true
        });
        
        resource.volume.setVolume(1.0);
        this.player.play(resource);
        
        logMusicEvent(this.guildId, 'info', 'Audio bridge iniciado y reproductor conectado');
    }

    async stop() {
        logMusicEvent(this.guildId, 'info', 'Deteniendo sesión y limpiando recursos.');
        if (this.ffmpegProcess) this.ffmpegProcess.kill();
        if (this.browser) await this.browser.close();
        if (this.connection) this.connection.destroy();
        
        this.ffmpegProcess = null;
        this.browser = null;
        this.page = null;
        this.connection = null;
        this.isActive = false;
        this.currentTrack = null;
        this.channelName = null;
        this.channelId = null;
        this.guildId = null;
        this.player.stop();
    }

    getStatus() {
        return {
            active: this.isActive,
            currentTrack: this.currentTrack,
            channel: this.channelName,
            channelId: this.channelId,
            guildId: this.guildId
        };
    }
}

module.exports = MusicManager;
