const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const db = require('../db');

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
            console.log('[Music] Player idle. Cleaning up...');
            this.stop();
        });
        this.player.on('error', error => console.error('[Music] Player Error:', error.message));
    }

    async play(guildId, voiceChannelId, query) {
        if (this.isActive) {
            await this.stop(); // Preemptive stop if active to restart cleanly
        }

        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) throw new Error("Servidor no encontrado.");

        const voiceChannel = guild.channels.cache.get(voiceChannelId);
        if (!voiceChannel) throw new Error("Canal de voz no encontrado.");

        this.isActive = true;
        this.guildId = guildId;
        this.channelId = voiceChannelId;
        this.channelName = voiceChannel.name;
        
        try {
            // 1. Join voice channel
            this.connection = joinVoiceChannel({
                channelId: voiceChannelId,
                guildId: guildId,
                adapterCreator: guild.voiceAdapterCreator,
            });
            this.connection.subscribe(this.player);

            // 2. Launch Browser
            this.browser = await chromium.launch({ 
                headless: true,
                args: ['--nogpu', '--no-sandbox', '--disable-setuid-sandbox']
            });
            const context = await this.browser.newContext();
            
            // 3. Apply Cookies if available
            const settings = await db.getMusicSettings(guildId);
            if (settings && settings.yt_cookies) {
                try {
                    const cookies = JSON.parse(settings.yt_cookies);
                    await context.addCookies(cookies);
                    console.log("[Music] Cookies de sesión aplicadas.");
                } catch (e) {
                    console.error("[Music] Error parsing cookies:", e.message);
                }
            }

            this.page = await context.newPage();
            
            // 4. Navigate to YouTube
            let url = query;
            if (!query.startsWith('http')) {
                url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            }
            
            await this.page.goto(url);
            
            // Si es búsqueda, click en el primer video
            if (url.includes('search_query')) {
                await this.page.waitForSelector('ytd-video-renderer #video-title');
                await this.page.click('ytd-video-renderer #video-title');
            }

            await this.page.waitForSelector('video');
            this.currentTrack = await this.page.title();
            
            // 5. Start Audio Capture (PulseAudio bridge)
            // En Docker/Debian usamos PulseAudio
            this.ffmpegProcess = spawn(ffmpeg, [
                '-f', 'pulse',
                '-i', 'default',
                '-ac', '2',
                '-ar', '48000',
                '-f', 's16le',
                'pipe:1'
            ]);

            const resource = createAudioResource(this.ffmpegProcess.stdout, {
                inputType: StreamType.Raw,
                inlineVolume: true
            });
            
            this.player.play(resource);
            console.log(`[Music] Reproduciendo: ${this.currentTrack}`);

            return {
                title: this.currentTrack,
                channel: this.channelName
            };

        } catch (err) {
            console.error('[Music] Error fatal:', err);
            await this.stop();
            throw err;
        }
    }

    async stop() {
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
