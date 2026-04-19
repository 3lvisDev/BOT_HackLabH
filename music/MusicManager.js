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

        this.kazagumo.shoukaku.on('ready', (name) => console.log(`[Lavalink] Nodo ${name} conectado correctamente.`));
        this.kazagumo.shoukaku.on('error', (name, error) => console.error(`[Lavalink] Error en nodo ${name}:`, error));

        this.kazagumo.on('playerStart', (player, track) => {
            logMusicEvent(player.guildId, 'info', `Reproduciendo: ${track.title}`);
            this.rememberTrackForRadio(player.guildId, track);
            applyBotPresence(this.client, {
                active: true,
                currentTrack: track.title,
                channelId: player.voiceId,
                guildId: player.guildId
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
    }

    getRadioState(guildId) {
        if (!this.radioState.has(guildId)) {
            this.radioState.set(guildId, {
                enabled: true,
                genreSeed: null,
                recentIdentifiers: [],
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
        state.lastTrack = {
            identifier: track.identifier,
            title: track.title,
            author: track.author
        };

        if (track.identifier) {
            state.recentIdentifiers = [track.identifier, ...state.recentIdentifiers.filter((id) => id !== track.identifier)].slice(0, 12);
        }
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

        if (!lastTrack?.title) return null;

        return `${lastTrack.author || ''} ${lastTrack.title}`.trim();
    }

    async findRelatedTrack(guildId) {
        const query = this.buildRadioQuery(guildId);
        if (!query) return null;

        const result = await this.kazagumo.search(query);
        const state = this.getRadioState(guildId);
        return result.tracks.find((track) => !state.recentIdentifiers.includes(track.identifier)) || null;
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

    async play(guildId, voiceChannelId, query) {
        if (!this.hasLavalinkConfig) {
            throw new Error('Falta configurar LAVALINK_URL y LAVALINK_PASSWORD en el archivo .env');
        }

        let player = this.kazagumo.players.get(guildId);

        if (!player) {
            const nodesArr = Array.from(this.kazagumo.shoukaku.nodes.values());
            const connectedNodes = nodesArr.filter((node) => node.state === 1);

            console.log(`[MusicManager] Debug Nodos: Total=${nodesArr.length}`);
            nodesArr.forEach((node) => console.log(` - Nodo: ${node.name} | Estado: ${node.state} (1=Conectado)`));

            if (connectedNodes.length === 0) {
                console.error('[MusicManager] No hay nodos Lavalink conectados en este momento.');
                throw new Error('No hay nodos Lavalink conectados. Revisa que tu servidor Lavalink este encendido.');
            }

            player = await this.kazagumo.createPlayer({
                guildId,
                voiceId: voiceChannelId,
                textId: null,
                deaf: true
            });
        }

        const resolvedQueries = await this.resolvePlayableQueries(query);
        let firstTrackTitle = null;

        for (const playableQuery of resolvedQueries) {
            const result = await this.kazagumo.search(playableQuery);
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
        this.setRadioMode(guildId, false);
        this.setLiveStream(guildId, streamUrl);
        return {
            ...result,
            isLiveStream: true
        };
    }

    async enqueue(guildId, voiceChannelId, query) {
        if (!this.hasLavalinkConfig) {
            throw new Error('Falta configurar LAVALINK_URL y LAVALINK_PASSWORD en el archivo .env');
        }

        let player = this.kazagumo.players.get(guildId);
        if (!player) {
            return this.play(guildId, voiceChannelId, query);
        }

        const resolvedQueries = await this.resolvePlayableQueries(query);
        const addedTitles = [];

        for (const playableQuery of resolvedQueries) {
            const result = await this.kazagumo.search(playableQuery);
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
