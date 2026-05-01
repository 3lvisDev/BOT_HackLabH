const { Connectors } = require('shoukaku');
const { Kazagumo } = require('kazagumo');
const { logMusicEvent } = require('./logger');
const { applyBotPresence } = require('../utils/botProfile');
const db = require('../db');
const axios = require('axios');
const { isSpotifyLink, resolveSpotifyQueries } = require('./spotify');

class MusicManager {
    constructor(client) {
        this.client = client;
        this.hasLavalinkConfig = Boolean(process.env.LAVALINK_URL && process.env.LAVALINK_PASSWORD);
        this.radioState = new Map();
        this.liveStreamState = new Map();
        this.djAutoState = new Map();
        this.djAutoInterval = null;
        this.playbackSnapshotInterval = null;
        this.restoreInProgress = new Set();
        this.idleTimeouts = new Map();
        this.pendingRadioPrefetch = new Map();
        this.nodeReady = false;

        if (!this.hasLavalinkConfig) {
            this.kazagumo = null;
            return;
        }

        if (!this.isDiscordClientReady(client)) {
            this.kazagumo = this.createTestKazagumoStub();
            return;
        }

        const nodes = [
            {
                name: 'Local-Pi',
                url: process.env.LAVALINK_URL,
                auth: process.env.LAVALINK_PASSWORD,
                secure: process.env.LAVALINK_SECURE === 'true'
            }
        ];

        this.kazagumo = new Kazagumo({
            defaultSearchEngine: 'youtube',
            send: (guildId, payload) => {
                const guild = this.client.guilds.cache.get(guildId);
                if (guild) guild.shard.send(payload);
            }
        }, new Connectors.DiscordJS(client), nodes, {
            moveOnDisconnect: true,
            resume: true,
            reconnectTries: 10,
            reconnectInterval: 5000
        });

        this.kazagumo.shoukaku.on('ready', (name) => {
            this.nodeReady = true;
            console.log(`[Lavalink] Nodo ${name} conectado correctamente.`);
        });
        this.kazagumo.shoukaku.on('error', (name, error) => console.error(`[Lavalink] Error en nodo ${name}:`, error));

        this.kazagumo.on('playerStart', (player, track) => {
            if (typeof player.setLoop === 'function' && player.loop !== 'none') {
                player.setLoop('none');
            }
            logMusicEvent(player.guildId, 'info', `Reproduciendo: ${track.title}`);
            this.rememberTrackForRadio(player.guildId, track);
            this.persistCurrentPlayback(player.guildId, player, track).catch((error) => {
                console.error('[MusicManager] No se pudo guardar snapshot de reproduccion:', error.message);
            });
            applyBotPresence(this.client, {
                active: true,
                currentTrack: track.title,
                channelId: player.voiceId,
                guildId: player.guildId
            });
            this.maybePrefetchRadioTrack(player).catch((error) => {
                console.error('[MusicManager] Error en prefetch de radio:', error.message);
            });
        });

        this.kazagumo.on('playerError', (player, error) => {
            console.error('[MusicManager] Error en el reproductor:', error);
            logMusicEvent(player.guildId, 'error', `Error en reproduccion: ${error.message}`);
            applyBotPresence(this.client, this.getStatus(player.guildId));
        });

        this.kazagumo.on('playerStuck', (player, track) => {
            console.warn('[MusicManager] Reproductor atascado:', track.title);
            logMusicEvent(player.guildId, 'warn', `Reproduccion atascada: ${track.title}`);
        });

        this.kazagumo.on('playerEmpty', (player) => {
            this.handlePlayerEmpty(player).catch((error) => {
                console.error('[MusicManager] Error activando modo radio:', error);
                logMusicEvent(player.guildId, 'error', `Error en modo radio: ${error.message}`);
                player.destroy();
                applyBotPresence(this.client, { active: false, guildId: player.guildId });
            });
        });

        this.startDjAutoWatcher();
        this.startPlaybackSnapshotWatcher();
    }

    async handleVoiceStateUpdate(oldState, newState) {
        const guildId = newState.guild.id;
        const player = this.kazagumo?.players.get(guildId);
        
        if (!player) return;

        const botVoiceChannelId = player.voiceId;
        if (!botVoiceChannelId) return;

        const voiceChannel = newState.guild.channels.cache.get(botVoiceChannelId);
        if (!voiceChannel) return;

        // Count non-bot members in the channel
        const nonBotMembers = voiceChannel.members.filter(m => !m.user.bot).size;

        if (nonBotMembers === 0) {
            // Bot is alone, start timeout if not already started
            if (!this.idleTimeouts.has(guildId)) {
                console.log(`[MusicManager] Bot solo en ${guildId}. Iniciando cuenta regresiva de 30s.`);
                const timeout = setTimeout(async () => {
                    console.log(`[MusicManager] Canal vacio en ${guildId}. Desconectando por inactividad.`);
                    logMusicEvent(guildId, 'info', 'Desconectado automáticamente: El canal de voz está vacío.');
                    await this.stop(guildId);
                    this.idleTimeouts.delete(guildId);
                }, 30000); // 30 seconds
                this.idleTimeouts.set(guildId, timeout);
            }
        } else {
            // Someone is in the channel, clear timeout if exists
            if (this.idleTimeouts.has(guildId)) {
                console.log(`[MusicManager] Usuario detectado en ${guildId}. Cancelando auto-desconexión.`);
                clearTimeout(this.idleTimeouts.get(guildId));
                this.idleTimeouts.delete(guildId);
            }
        }
    }

    getRadioState(guildId) {
        if (!this.radioState.has(guildId)) {
            this.radioState.set(guildId, {
                enabled: true,
                genreSeed: null,
                recentIdentifiers: [],
                recentFingerprints: [],
                recentArtists: [],
                lastTrack: null
            });
        }

        return this.radioState.get(guildId);
    }

    getRadioMode(guildId) {
        const state = this.getRadioState(guildId);
        return { enabled: state.enabled, genre: state.genreSeed };
    }

    async setRadioMode(guildId, enabled) {
        const state = this.getRadioState(guildId);
        state.enabled = Boolean(enabled);
        await db.updateMusicSettings(guildId, { radio_enabled: state.enabled ? 1 : 0 });
        return { enabled: state.enabled, genre: state.genreSeed };
    }

    async setRadioGenre(guildId, genre) {
        const state = this.getRadioState(guildId);
        state.genreSeed = genre ? String(genre).trim() : null;
        await db.updateMusicSettings(guildId, { radio_genre: state.genreSeed });
        return { enabled: state.enabled, genre: state.genreSeed };
    }

    rememberTrackForRadio(guildId, track) {
        if (!guildId || !track) return;

        const state = this.getRadioState(guildId);
        const fingerprint = this.buildTrackFingerprint(track);
        state.lastTrack = {
            identifier: track.identifier,
            title: track.title,
            author: track.author,
            fingerprint
        };

        if (track.identifier) {
            state.recentIdentifiers = [track.identifier, ...state.recentIdentifiers.filter((id) => id !== track.identifier)].slice(0, 12);
        }
        if (fingerprint) {
            state.recentFingerprints = [fingerprint, ...state.recentFingerprints.filter((fp) => fp !== fingerprint)].slice(0, 20);
        }
        const artist = this.normalizeText(track.author);
        if (artist) {
            state.recentArtists = [artist, ...state.recentArtists.filter((name) => name !== artist)].slice(0, 25);
        }
    }

    normalizeText(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    buildTrackFingerprint(track) {
        const rawTitle = this.normalizeText(track?.title)
            .replace(/\b(official|video|lyric|lyrics|audio|visualizer|mv|hd|4k|remaster|version en vivo|live)\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const title = rawTitle;
        const author = this.normalizeText(track?.author);
        const base = `${author}|${title}`.trim();
        return base || null;
    }

    scoreRadioCandidate(guildId, track) {
        const state = this.getRadioState(guildId);
        const fingerprint = this.buildTrackFingerprint(track);
        const artist = this.normalizeText(track?.author);
        const sameId = Boolean(track.identifier) && state.recentIdentifiers.includes(track.identifier);
        const sameFingerprint = Boolean(fingerprint) && state.recentFingerprints.includes(fingerprint);
        const repeatedArtist = Boolean(artist) && state.recentArtists.slice(0, 5).includes(artist);
        const normalizedTitle = this.normalizeText(track?.title);
        const lowQualityHint = /(live|karaoke|8d|nightcore|slowed|reverb)/.test(normalizedTitle);

        if (sameId || sameFingerprint) {
            return Number.NEGATIVE_INFINITY;
        }

        let score = 100;
        if (repeatedArtist) score -= 25;
        if (lowQualityHint) score -= 8;
        if (track?.isStream) score -= 10;
        if (track?.length && track.length > 0 && track.length < 90_000) score -= 6;
        return score;
    }

    setLiveStream(guildId, streamUrl) {
        this.liveStreamState.set(guildId, streamUrl);
    }

    clearLiveStream(guildId) {
        this.liveStreamState.delete(guildId);
    }

    getLiveStream(guildId) {
        return this.liveStreamState.get(guildId) || null;
    }

    getDjAutoState(guildId) {
        if (!this.djAutoState.has(guildId)) {
            this.djAutoState.set(guildId, {
                enabled: false,
                liveActive: false,
                fallback: 'radio'
            });
        }

        return this.djAutoState.get(guildId);
    }

    async setDjAutoMode(guildId, enabled) {
        const state = this.getDjAutoState(guildId);
        state.enabled = Boolean(enabled);
        await db.updateMusicSettings(guildId, { dj_auto_enabled: state.enabled ? 1 : 0 });
        return { enabled: state.enabled, liveActive: state.liveActive, fallback: state.fallback };
    }

    markDjLiveState(guildId, liveActive) {
        const state = this.getDjAutoState(guildId);
        state.liveActive = Boolean(liveActive);
        return state;
    }

    async isStreamLive(streamUrl) {
        try {
            const statusUrl = streamUrl.replace(/\/[^/]+$/, '/status-json.xsl');
            const response = await axios.get(statusUrl, { timeout: 5000 });
            const source = response.data?.icestats?.source;

            if (Array.isArray(source)) {
                return source.some((entry) => entry.listenurl === streamUrl || streamUrl.endsWith(entry.server_name || ''));
            }

            return Boolean(source);
        } catch (error) {
            return false;
        }
    }

    startDjAutoWatcher() {
        if (this.djAutoInterval) return;

        this.djAutoInterval = setInterval(() => {
            this.checkDjAutoStreams().catch((error) => {
                console.error('[MusicManager] Error en DJ auto watcher:', error);
            });
        }, 15000);
    }

    startPlaybackSnapshotWatcher() {
        if (this.playbackSnapshotInterval || !this.kazagumo) return;

        this.playbackSnapshotInterval = setInterval(() => {
            this.snapshotActivePlayers().catch((error) => {
                console.error('[MusicManager] Error guardando snapshot de reproduccion:', error);
            });
        }, 10000);
    }

    async snapshotActivePlayers() {
        if (!this.kazagumo?.players) return;
        for (const player of this.kazagumo.players.values()) {
            if (!player?.guildId) continue;
            if (!player.playing && !player.paused) continue;
            await this.persistCurrentPlayback(player.guildId, player, player.queue?.current, {
                last_paused: player.paused ? 1 : 0,
                last_was_playing: 1
            });
        }
    }

    async checkDjAutoStreams() {
        for (const [guildId, state] of this.djAutoState.entries()) {
            if (!state.enabled) continue;

            const streamUrl = this.getLiveStream(guildId) || await this.getSavedLiveStreamUrl(guildId);
            if (!streamUrl) continue;

            const isLive = await this.isStreamLive(streamUrl);

            if (isLive && !state.liveActive) {
                await this.activateDjLive(guildId, streamUrl);
                continue;
            }

            if (!isLive && state.liveActive) {
                await this.deactivateDjLive(guildId);
            }
        }
    }

    async activateDjLive(guildId, streamUrl) {
        const player = this.kazagumo?.players.get(guildId);
        if (!player?.voiceId) return;

        this.markDjLiveState(guildId, true);
        const voiceId = player.voiceId;
        await this.stop(guildId, { preserveLiveStream: true, preservePresence: true });
        await this.playLiveStream(guildId, voiceId, streamUrl);
        logMusicEvent(guildId, 'info', 'DJ radio en vivo detectada. Tomando prioridad sobre la musica automatica.');
    }

    async deactivateDjLive(guildId) {
        const previousPlayer = this.kazagumo?.players.get(guildId);
        const voiceId = previousPlayer?.voiceId || null;
        this.markDjLiveState(guildId, false);
        await this.stop(guildId, { preservePresence: true });

        const fallback = this.getDjAutoState(guildId).fallback;
        if (fallback === 'radio' && voiceId) {
            const nextTrack = await this.findRelatedTrack(guildId);
            if (nextTrack) {
                const query = `${nextTrack.author || ''} ${nextTrack.title}`.trim();
                await this.play(guildId, voiceId, query);
                return;
            }
        }

        applyBotPresence(this.client, { active: false, guildId });

        logMusicEvent(guildId, 'info', 'DJ radio fuera del aire. Fallback aplicado.');
    }

    buildRadioQuery(guildId) {
        const state = this.getRadioState(guildId);
        if (state.genreSeed) {
            return `${state.genreSeed} mix`;
        }

        const lastTrack = state.lastTrack;
        if (lastTrack?.author) {
            return `${lastTrack.author} mix`;
        }
        if (lastTrack?.title) {
            return `${lastTrack.title} mix`;
        }
        return 'top global hits mix';
    }

    async findRelatedTrack(guildId) {
        const query = this.buildRadioQuery(guildId);
        if (!query) return null;
        const state = this.getRadioState(guildId);

        const result = await this.kazagumo.search(query);
        const pickBest = (tracks = []) => {
            const ranked = tracks
                .map((track) => ({ track, score: this.scoreRadioCandidate(guildId, track) }))
                .filter((item) => Number.isFinite(item.score))
                .sort((a, b) => b.score - a.score);
            return ranked[0]?.track || null;
        };
        let candidate = pickBest(result.tracks);

        if (!candidate && state.genreSeed) {
            const fallback = await this.kazagumo.search(`${state.genreSeed} radio mix`);
            candidate = pickBest(fallback.tracks);
        }

        return candidate;
    }

    async maybePrefetchRadioTrack(player) {
        if (!player?.guildId || !player?.queue) return;
        const guildId = player.guildId;
        const state = this.getRadioState(guildId);
        if (!state.enabled) return;
        if (this.getLiveStream(guildId)) return;
        if (this.pendingRadioPrefetch.has(guildId)) return;
        if (player.queue.size > 1) return;

        const prefetchPromise = (async () => {
            const nextTrack = await this.findRelatedTrack(guildId);
            if (!nextTrack) return;
            player.queue.add(nextTrack);
            logMusicEvent(guildId, 'info', `Modo radio: prefetch ${nextTrack.title}`);
        })().finally(() => {
            this.pendingRadioPrefetch.delete(guildId);
        });

        this.pendingRadioPrefetch.set(guildId, prefetchPromise);
        await prefetchPromise;
    }

    async handlePlayerEmpty(player) {
        const guildId = player.guildId;
        const state = this.getRadioState(guildId);

        if (state.enabled) {
            const nextTrack = await this.findRelatedTrack(guildId);
            if (nextTrack) {
                player.queue.add(nextTrack);
                logMusicEvent(guildId, 'info', `Modo radio: agregada ${nextTrack.title}`);
                await player.play();
                return;
            }
        }

        logMusicEvent(guildId, 'info', 'La cola de reproduccion se ha vaciado.');
        player.destroy();
        await this.clearPlaybackSnapshot(guildId);
        applyBotPresence(this.client, { active: false, guildId });
    }

    isDiscordClientReady(client) {
        return Boolean(
            client &&
            typeof client.once === 'function' &&
            client.guilds &&
            client.guilds.cache &&
            typeof client.guilds.cache.get === 'function'
        );
    }

    createTestKazagumoStub() {
        return {
            players: new Map(),
            shoukaku: {
                nodes: new Map(),
                on: () => {}
            },
            on: () => {},
            search: async () => ({ tracks: [], type: 'SEARCH' }),
            createPlayer: async () => {
                throw new Error('Kazagumo no esta disponible en este entorno de prueba');
            }
        };
    }

    isNoNodeError(error) {
        const message = String(error?.message || '').toLowerCase();
        return message.includes('no nodes are online') || message.includes('no node');
    }

    hasConnectedNodes() {
        if (!this.kazagumo?.shoukaku?.nodes) return false;
        const nodes = Array.from(this.kazagumo.shoukaku.nodes.values());
        return nodes.some((node) => node.state === 1 || String(node.state).toLowerCase() === 'connected');
    }

    async waitForNodeConnection(timeoutMs = 7000) {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
            if (this.hasConnectedNodes()) return true;
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
        return this.hasConnectedNodes();
    }

    getTrackQuery(track) {
        if (!track) return null;
        return track.uri || track.identifier || track.title || null;
    }

    async persistCurrentPlayback(guildId, player, track = null, overrides = {}) {
        if (!guildId || !player) return;
        if (this.restoreInProgress.has(guildId)) return;

        const currentTrack = track || player.queue?.current || null;
        const query = this.getTrackQuery(currentTrack);
        const trackTitle = currentTrack?.title || null;
        const position = Number.isFinite(player.position) ? Math.max(0, Math.floor(player.position)) : 0;

        await db.updateMusicSettings(guildId, {
            last_channel_id: player.voiceId || null,
            last_query: query,
            last_track_title: trackTitle,
            last_position_ms: overrides.last_position_ms ?? position,
            last_paused: overrides.last_paused ?? (player.paused ? 1 : 0),
            last_was_playing: overrides.last_was_playing ?? ((player.playing || player.paused) ? 1 : 0),
            last_is_live_stream: overrides.last_is_live_stream ?? (this.getLiveStream(guildId) ? 1 : 0),
            stream_url: overrides.stream_url ?? this.getLiveStream(guildId)
        });
    }

    async clearPlaybackSnapshot(guildId) {
        await db.updateMusicSettings(guildId, {
            last_query: null,
            last_track_title: null,
            last_position_ms: 0,
            last_paused: 0,
            last_was_playing: 0,
            last_is_live_stream: 0,
            last_channel_id: null
        });
    }

    async recoverSessionsAfterRestart() {
        if (!this.hasLavalinkConfig || !this.kazagumo) return;

        for (const guild of this.client.guilds.cache.values()) {
            try {
                const settings = await db.getMusicSettings(guild.id);
                if (!settings) continue;

                const radioState = this.getRadioState(guild.id);
                radioState.enabled = settings.radio_enabled !== 0;
                radioState.genreSeed = settings.radio_genre || null;

                const djState = this.getDjAutoState(guild.id);
                djState.enabled = settings.dj_auto_enabled === 1;
                djState.fallback = settings.dj_fallback || 'radio';

                if (settings.stream_url) {
                    this.setLiveStream(guild.id, settings.stream_url);
                }

                if (!settings.last_was_playing || !settings.last_channel_id || !settings.last_query) {
                    continue;
                }

                const channel = guild.channels.cache.get(settings.last_channel_id);
                if (!channel || !channel.isVoiceBased?.()) {
                    continue;
                }

                this.restoreInProgress.add(guild.id);
                const result = await this.play(guild.id, settings.last_channel_id, settings.last_query);
                const player = this.kazagumo.players.get(guild.id);
                if (player) {
                    if (settings.last_is_live_stream && settings.stream_url) {
                        this.setLiveStream(guild.id, settings.stream_url);
                    }
                    const seekPosition = Number(settings.last_position_ms || 0);
                    if (seekPosition > 0 && typeof player.seek === 'function') {
                        await player.seek(seekPosition);
                    }

                    if (settings.last_paused) {
                        player.pause(true);
                    }

                    await this.persistCurrentPlayback(guild.id, player, player.queue?.current, {
                        last_position_ms: seekPosition,
                        last_paused: settings.last_paused ? 1 : 0,
                        last_was_playing: 1,
                        last_is_live_stream: settings.last_is_live_stream ? 1 : 0,
                        stream_url: settings.stream_url || null
                    });
                }

                logMusicEvent(guild.id, 'info', `Sesion restaurada tras reinicio: ${result.title}`);
            } catch (error) {
                console.error(`[MusicManager] No se pudo restaurar sesion en guild ${guild.id}:`, error.message);
            } finally {
                this.restoreInProgress.delete(guild.id);
            }
        }
    }

    async play(guildId, voiceChannelId, query) {
        return this.playInternal(guildId, voiceChannelId, query, true);
    }

    async playInternal(guildId, voiceChannelId, query, allowRetry) {
        if (!this.hasLavalinkConfig) {
            throw new Error('Falta configurar LAVALINK_URL y LAVALINK_PASSWORD en el archivo .env');
        }

        let player = this.kazagumo.players.get(guildId);
        try {
            if (!player) {
                const nodesArr = Array.from(this.kazagumo.shoukaku.nodes.values());
                console.log(`[MusicManager] Debug Nodos: Total=${nodesArr.length}`);
                nodesArr.forEach((node) => console.log(` - Nodo: ${node.name} | Estado: ${node.state} (1=Conectado)`));

                if (!this.hasConnectedNodes()) {
                    const becameReady = await this.waitForNodeConnection();
                    if (!becameReady) {
                        throw new Error('No nodes are online');
                    }
                }

                player = await this.kazagumo.createPlayer({
                    guildId,
                    voiceId: voiceChannelId,
                    textId: null,
                    deaf: true
                });
                if (typeof player.setLoop === 'function') {
                    player.setLoop('none');
                }
            }
        } catch (error) {
            if (allowRetry && this.isNoNodeError(error)) {
                await this.waitForNodeConnection(8000);
                return this.playInternal(guildId, voiceChannelId, query, false);
            }
            throw error;
        }

        let resolvedQueries;
        try {
            resolvedQueries = await this.resolvePlayableQueries(query);
        } catch (error) {
            if (allowRetry && this.isNoNodeError(error)) {
                await this.waitForNodeConnection(8000);
                return this.playInternal(guildId, voiceChannelId, query, false);
            }
            throw error;
        }
        let firstTrackTitle = null;

        for (const playableQuery of resolvedQueries) {
            let result;
            try {
                result = await this.kazagumo.search(playableQuery);
            } catch (error) {
                if (allowRetry && this.isNoNodeError(error)) {
                    await this.waitForNodeConnection(8000);
                    return this.playInternal(guildId, voiceChannelId, query, false);
                }
                throw error;
            }
            if (!result.tracks.length) continue;

            if (!firstTrackTitle) {
                firstTrackTitle = result.tracks[0].title;
            }

            if (result.type === 'PLAYLIST') {
                for (const track of result.tracks) {
                    player.queue.add(track);
                }
            } else {
                player.queue.add(result.tracks[0]);
            }
        }

        if (!firstTrackTitle) {
            throw new Error('No se encontraron resultados para tu busqueda.');
        }

        this.clearLiveStream(guildId);
        await db.updateMusicSettings(guildId, { last_channel_id: voiceChannelId });

        if (!player.playing && !player.paused) {
            if (typeof player.setLoop === 'function') {
                player.setLoop('none');
            }
            await player.play();
        }

        return {
            title: firstTrackTitle,
            channel: player.voiceId,
            radioEnabled: this.getRadioMode(guildId).enabled
        };
    }

    async playLiveStream(guildId, voiceChannelId, streamUrl) {
        const result = await this.play(guildId, voiceChannelId, streamUrl);
        await this.setRadioMode(guildId, false);
        this.setLiveStream(guildId, streamUrl);
        await db.updateMusicSettings(guildId, { last_is_live_stream: 1, stream_url: streamUrl });
        return {
            ...result,
            isLiveStream: true
        };
    }

    async enqueue(guildId, voiceChannelId, query) {
        return this.enqueueInternal(guildId, voiceChannelId, query, true);
    }

    async enqueueInternal(guildId, voiceChannelId, query, allowRetry) {
        if (!this.hasLavalinkConfig) {
            throw new Error('Falta configurar LAVALINK_URL y LAVALINK_PASSWORD en el archivo .env');
        }

        let player = this.kazagumo.players.get(guildId);
        if (!player) {
            return this.play(guildId, voiceChannelId, query);
        }

        let resolvedQueries;
        try {
            resolvedQueries = await this.resolvePlayableQueries(query);
        } catch (error) {
            if (allowRetry && this.isNoNodeError(error)) {
                await this.waitForNodeConnection(8000);
                return this.enqueueInternal(guildId, voiceChannelId, query, false);
            }
            throw error;
        }
        const addedTitles = [];

        for (const playableQuery of resolvedQueries) {
            let result;
            try {
                result = await this.kazagumo.search(playableQuery);
            } catch (error) {
                if (allowRetry && this.isNoNodeError(error)) {
                    await this.waitForNodeConnection(8000);
                    return this.enqueueInternal(guildId, voiceChannelId, query, false);
                }
                throw error;
            }
            if (!result.tracks.length) continue;
            const selected = result.tracks[0];
            player.queue.add(selected);
            addedTitles.push(selected.title);
        }

        if (!addedTitles.length) {
            throw new Error('No se encontraron resultados para tu busqueda.');
        }
        await db.updateMusicSettings(guildId, { last_channel_id: player.voiceId || voiceChannelId });

        if (!player.playing && !player.paused) {
            await player.play();
        }

        return {
            title: addedTitles[0],
            channel: player.voiceId,
            radioEnabled: this.getRadioMode(guildId).enabled,
            queued: true,
            addedCount: addedTitles.length
        };
    }

    async enqueueMany(guildId, voiceChannelId, queries = []) {
        const added = [];
        for (const query of queries) {
            const result = await this.enqueue(guildId, voiceChannelId, query);
            added.push(result.title);
        }
        return added;
    }

    async saveLiveStreamUrl(guildId, streamUrl) {
        await db.updateMusicSettings(guildId, { stream_url: streamUrl });
        this.setLiveStream(guildId, streamUrl);
    }

    async getSavedLiveStreamUrl(guildId) {
        const settings = await db.getMusicSettings(guildId);
        const url = settings?.stream_url || null;
        if (url) this.setLiveStream(guildId, url);
        const radioState = this.getRadioState(guildId);
        radioState.enabled = settings?.radio_enabled !== 0;
        radioState.genreSeed = settings?.radio_genre || null;

        const djState = this.getDjAutoState(guildId);
        djState.enabled = settings?.dj_auto_enabled === 1;
        djState.fallback = settings?.dj_fallback || 'radio';
        return url;
    }

    async stop(guildId, options = {}) {
        const { preserveLiveStream = false, preservePresence = false } = options;
        if (!this.kazagumo) {
            return;
        }

        const player = this.kazagumo.players.get(guildId);
        if (player) {
            player.destroy();
            logMusicEvent(guildId, 'info', 'Reproduccion detenida y recursos liberados.');
        }
        if (!preserveLiveStream) {
            this.clearLiveStream(guildId);
        }
        if (!preservePresence) {
            await this.clearPlaybackSnapshot(guildId);
        } else {
            await db.updateMusicSettings(guildId, { last_was_playing: 0, last_paused: 0, last_position_ms: 0 });
        }
        if (!preservePresence) {
            applyBotPresence(this.client, { active: false, guildId });
        }
    }

    getPlayerOrThrow(guildId) {
        if (!this.hasLavalinkConfig || !this.kazagumo) {
            throw new Error('Sistema de musica no disponible en este entorno.');
        }

        const player = this.kazagumo.players.get(guildId);
        if (!player) {
            throw new Error('No hay ninguna reproduccion activa.');
        }

        return player;
    }

    async skip(guildId) {
        const player = this.getPlayerOrThrow(guildId);
        const hadQueue = !player.queue.isEmpty;
        const nextCandidate = hadQueue ? player.queue[0] : null;

        player.skip();
        this.persistCurrentPlayback(guildId, player).catch(() => {});

        return {
            hadQueue,
            nextTrack: nextCandidate ? nextCandidate.title : null
        };
    }

    async previous(guildId) {
        const player = this.getPlayerOrThrow(guildId);
        const previousTrack = player.getPrevious(true);

        if (!previousTrack) {
            throw new Error('No hay una cancion anterior disponible.');
        }

        await player.play(previousTrack, { replaceCurrent: true });
        this.persistCurrentPlayback(guildId, player, previousTrack).catch(() => {});

        return {
            track: previousTrack.title
        };
    }

    async pause(guildId) {
        const player = this.getPlayerOrThrow(guildId);

        if (player.paused) {
            throw new Error('La reproduccion ya esta en pausa.');
        }

        player.pause(true);
        await this.persistCurrentPlayback(guildId, player, player.queue.current, { last_paused: 1 });
        return {
            currentTrack: player.queue.current ? player.queue.current.title : 'Nada'
        };
    }

    async resume(guildId) {
        const player = this.getPlayerOrThrow(guildId);

        if (!player.paused) {
            throw new Error('La reproduccion no esta en pausa.');
        }

        player.pause(false);
        await this.persistCurrentPlayback(guildId, player, player.queue.current, { last_paused: 0 });
        return {
            currentTrack: player.queue.current ? player.queue.current.title : 'Nada'
        };
    }

    getQueue(guildId, limit = 10) {
        const player = this.getPlayerOrThrow(guildId);
        const nowPlaying = player.queue.current ? player.queue.current.title : null;
        const upcoming = player.queue.slice(0, Math.max(1, limit)).map((track) => track.title);

        return {
            nowPlaying,
            upcoming,
            total: player.queue.totalSize,
            paused: player.paused
        };
    }

    getStatus(guildId) {
        if (!this.kazagumo) {
            return {
                active: false,
                currentTrack: 'Nada',
                isPlaying: false,
                isPaused: false,
                channelId: null,
                guildId: guildId || null,
                isLiveStream: false,
                streamUrl: this.getLiveStream(guildId)
            };
        }

        const player = this.kazagumo.players.get(guildId);
        if (!player) {
            return {
                active: false,
                currentTrack: 'Nada',
                isPlaying: false,
                isPaused: false,
                channelId: null,
                guildId: guildId || null,
                isLiveStream: false,
                streamUrl: this.getLiveStream(guildId)
            };
        }

        return {
            active: true,
            currentTrack: player.queue.current ? player.queue.current.title : 'Nada',
            isPlaying: player.playing,
            isPaused: player.paused,
            channelId: player.voiceId,
            guildId: player.guildId,
            radioEnabled: this.getRadioMode(guildId).enabled,
            isLiveStream: Boolean(this.getLiveStream(guildId)),
            streamUrl: this.getLiveStream(guildId)
        };
    }

    async resolvePlayableQueries(query) {
        const raw = String(query || '').trim();
        if (!raw) return [];

        if (!isSpotifyLink(raw)) {
            return [raw];
        }

        const spotifyQueries = await resolveSpotifyQueries(raw);
        if (!spotifyQueries.length) {
            throw new Error('No se pudieron resolver pistas de Spotify.');
        }
        return spotifyQueries;
    }
}

module.exports = MusicManager;
