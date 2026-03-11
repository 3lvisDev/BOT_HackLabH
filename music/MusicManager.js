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
        this.browser = await chromium.launch({ 
            headless: true,
            args: ['--nogpu', '--no-sandbox', '--disable-setuid-sandbox']
        });
        const context = await this.browser.newContext();
        
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

        await this.page.waitForSelector('video', { timeout: 15000 });
        this.currentTrack = await this.page.title();
    }

    /**
     * @private
     * Inicia el puente de audio usando ffmpeg y el recurso de Discord.
     */
    _startAudioBridge() {
        if (this.ffmpegProcess) this.ffmpegProcess.kill();
        
        logMusicEvent(this.guildId, 'debug', 'Iniciando puente de audio FFmpeg (PulseAudio)...');

        // 1. Validar entorno PulseAudio (Observación Auditoría)
        try {
            execSync('pactl info', { stdio: 'ignore' });
        } catch (e) {
            logMusicEvent(this.guildId, 'warning', 'PulseAudio no detectado. Reintentando con configuración alternativa...');
        }
        
        const args = [
            '-f', 'pulse',
            '-i', 'default',
            '-ac', '2',
            '-ar', '48000',
            '-f', 's16le',
            'pipe:1'
        ];

        this.ffmpegProcess = spawn(ffmpeg, args);

        // 2. Timeout de seguridad para el proceso (Observación Auditoría)
        const timeout = setTimeout(() => {
            if (this.ffmpegProcess) {
                logMusicEvent(this.guildId, 'warning', 'FFmpeg timeout de inactividad (5 min), deteniendo...');
                this.stop();
            }
        }, 5 * 60 * 1000); // 5 minutes

        this.ffmpegProcess.on('error', (err) => {
            logMusicEvent(this.guildId, 'error', `Error en FFmpeg: ${err.message}`);
            clearTimeout(timeout);
        });

        this.ffmpegProcess.on('close', (code) => {
            logMusicEvent(this.guildId, 'info', `FFmpeg cerrado con código: ${code}`);
            clearTimeout(timeout);
        });

        const resource = createAudioResource(this.ffmpegProcess.stdout, {
            inputType: StreamType.Raw,
            inlineVolume: true
        });
        
        this.player.play(resource);
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
