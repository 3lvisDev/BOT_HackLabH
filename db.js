const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

let dbPromise;

async function ensureColumn(db, table, column, typeAndDefault) {
    try {
        await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeAndDefault}`);
    } catch (err) {
        if (!String(err.message || '').toLowerCase().includes('duplicate column name')) {
            throw err;
        }
    }
}

async function ensureMusicSettingsSchema(db) {
    await ensureColumn(db, 'music_settings', 'radio_enabled', 'INTEGER DEFAULT 1');
    await ensureColumn(db, 'music_settings', 'radio_genre', 'TEXT');
    await ensureColumn(db, 'music_settings', 'dj_auto_enabled', 'INTEGER DEFAULT 0');
    await ensureColumn(db, 'music_settings', 'dj_fallback', 'TEXT DEFAULT \'radio\'');
    await ensureColumn(db, 'music_settings', 'stream_url', 'TEXT');
    await ensureColumn(db, 'music_settings', 'last_query', 'TEXT');
    await ensureColumn(db, 'music_settings', 'last_track_title', 'TEXT');
    await ensureColumn(db, 'music_settings', 'last_position_ms', 'INTEGER DEFAULT 0');
    await ensureColumn(db, 'music_settings', 'last_paused', 'INTEGER DEFAULT 0');
    await ensureColumn(db, 'music_settings', 'last_was_playing', 'INTEGER DEFAULT 0');
    await ensureColumn(db, 'music_settings', 'last_is_live_stream', 'INTEGER DEFAULT 0');
}

async function initDB() {
    if (!dbPromise) {
        dbPromise = open({
            filename: path.join(__dirname, 'bot_data.sqlite'),
            driver: sqlite3.Database
        }).then(async (db) => {
            try {
                await db.exec(`
                CREATE TABLE IF NOT EXISTS guild_configs (
                    guild_id TEXT PRIMARY KEY,
                    base_role_id TEXT,
                    is_configured BOOLEAN DEFAULT 0,
                    preferred_language TEXT DEFAULT 'es'
                );
                CREATE TABLE IF NOT EXISTS welcome_settings (
                    guild_id TEXT PRIMARY KEY,
                    welcome_enabled INTEGER DEFAULT 0,
                    welcome_channel TEXT,
                    welcome_message TEXT DEFAULT '¡Bienvenido {user} a {server}!',
                    goodbye_enabled INTEGER DEFAULT 0,
                    goodbye_channel TEXT,
                    goodbye_message TEXT DEFAULT '{user} ha abandonado el servidor.'
                );
                CREATE TABLE IF NOT EXISTS user_stats (
                    user_id TEXT PRIMARY KEY,
                    message_count INTEGER DEFAULT 0,
                    last_message_at DATETIME
                );
                CREATE TABLE IF NOT EXISTS achievements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    icon TEXT,
                    milestone_type TEXT, -- 'messages', 'days'
                    milestone_value INTEGER
                );
                CREATE TABLE IF NOT EXISTS user_achievements (
                    user_id TEXT,
                    achievement_id INTEGER,
                    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, achievement_id)
                );
                CREATE TABLE IF NOT EXISTS music_settings (
                    guild_id TEXT PRIMARY KEY,
                    yt_cookies TEXT,
                    volume INTEGER DEFAULT 100,
                    last_channel_id TEXT
                );
                CREATE TABLE IF NOT EXISTS music_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    guild_id TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    level TEXT,
                    message TEXT,
                    metadata TEXT
                );
                CREATE TABLE IF NOT EXISTS tickets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    guild_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    channel_id TEXT,
                    status TEXT DEFAULT 'open',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    closed_at DATETIME
                );
                CREATE TABLE IF NOT EXISTS user_playlists (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, name)
                );
                CREATE TABLE IF NOT EXISTS user_playlist_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    playlist_id INTEGER NOT NULL,
                    query TEXT NOT NULL,
                    position INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(playlist_id) REFERENCES user_playlists(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS user_music_preferences (
                    guild_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    seed TEXT NOT NULL,
                    play_count INTEGER DEFAULT 1,
                    last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (guild_id, user_id, seed)
                );
            `);
                await ensureColumn(db, 'guild_configs', 'preferred_language', 'TEXT DEFAULT \'es\'');
                await ensureMusicSettingsSchema(db);
                return db;
            } catch (err) {
                console.error(`\n❌ Error en inicialización de BD: ${err.message}`);
                console.error(`Verifica que la ruta de la BD sea accesible.\n`);
                process.exit(1);
            }
        }).catch(err => {
            console.error(`\n❌ Error al abrir BD: ${err.message}`);
            console.error(`Verifica que SQLite esté instalado y la ruta sea válida.\n`);
            process.exit(1);
        });
    }
    return dbPromise;
}

async function getGuildConfig(guildId) {
    const db = await initDB();
    return db.get('SELECT * FROM guild_configs WHERE guild_id = ?', [guildId]);
}

async function setGuildConfig(guildId, baseRoleId) {
    const db = await initDB();
    await db.run(
        `INSERT INTO guild_configs (guild_id, base_role_id, is_configured) 
         VALUES (?, ?, 1)
         ON CONFLICT(guild_id) DO UPDATE SET 
         base_role_id=excluded.base_role_id,
         is_configured=1`,
        [guildId, baseRoleId]
    );
}

async function setGuildLanguage(guildId, language) {
    const db = await initDB();
    const preferredLanguage = String(language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es';
    await db.run(
        `INSERT INTO guild_configs (guild_id, preferred_language, is_configured)
         VALUES (?, ?, 1)
         ON CONFLICT(guild_id) DO UPDATE SET
         preferred_language=excluded.preferred_language`,
        [guildId, preferredLanguage]
    );
    return preferredLanguage;
}

async function getSettings(guildId) {
    const db = await initDB();
    return db.get(`SELECT * FROM welcome_settings WHERE guild_id = ?`, [guildId]);
}

async function updateSettings(guildId, settings) {
    const db = await initDB();
    const { welcome_enabled, welcome_channel, welcome_message, goodbye_enabled, goodbye_channel, goodbye_message } = settings;
    await db.run(`INSERT INTO welcome_settings (guild_id, welcome_enabled, welcome_channel, welcome_message, goodbye_enabled, goodbye_channel, goodbye_message)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
            welcome_enabled = excluded.welcome_enabled,
            welcome_channel = excluded.welcome_channel,
            welcome_message = excluded.welcome_message,
            goodbye_enabled = excluded.goodbye_enabled,
            goodbye_channel = excluded.goodbye_channel,
            goodbye_message = excluded.goodbye_message`,
    [guildId, welcome_enabled ? 1 : 0, welcome_channel, welcome_message, goodbye_enabled ? 1 : 0, goodbye_channel, goodbye_message]);
}

// --- Achievements Helpers ---
async function updateUserStats(userId) {
    const db = await initDB();
    await db.run(`INSERT INTO user_stats (user_id, message_count, last_message_at) 
                  VALUES (?, 1, CURRENT_TIMESTAMP)
                  ON CONFLICT(user_id) DO UPDATE SET 
                  message_count = message_count + 1,
                  last_message_at = CURRENT_TIMESTAMP`, [userId]);
    return db.get(`SELECT message_count FROM user_stats WHERE user_id = ?`, [userId]);
}

async function getAllAchievements() {
    const db = await initDB();
    return db.all(`SELECT * FROM achievements`);
}

async function createAchievement({ name, description, icon, milestone_type, milestone_value }) {
    const db = await initDB();
    return db.run(`INSERT INTO achievements (name, description, icon, milestone_type, milestone_value) VALUES (?, ?, ?, ?, ?)`,
        [name, description, icon, milestone_type, milestone_value]);
}

async function getUserAchievements(userId) {
    const db = await initDB();
    return db.all(`SELECT a.*, ua.earned_at FROM achievements a 
                   JOIN user_achievements ua ON a.id = ua.achievement_id 
                   WHERE ua.user_id = ?`, [userId]);
}

async function earnAchievement(userId, achievementId) {
    const db = await initDB();
    return db.run(`INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)`, [userId, achievementId]);
}

const crypto = require('crypto');
const algorithm = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') : crypto.randomBytes(32);
const IV_LENGTH = 16;

function encrypt(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(algorithm, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    if (!text) return null;
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(algorithm, ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        console.error("[DB] Decryption error:", e.message);
        return null;
    }
}

async function getMusicSettings(guildId) {
    const db = await initDB();
    const row = await db.get(`SELECT * FROM music_settings WHERE guild_id = ?`, [guildId]);
    if (row && row.yt_cookies) {
        row.yt_cookies = decrypt(row.yt_cookies);
    }
    return row;
}

async function updateMusicSettings(guildId, settings) {
    const db = await initDB();
    const current = await db.get(`SELECT * FROM music_settings WHERE guild_id = ?`, [guildId]) || {};
    const next = { ...current, ...settings, guild_id: guildId };

    if (Object.prototype.hasOwnProperty.call(settings, 'yt_cookies')) {
        next.yt_cookies = encrypt(settings.yt_cookies);
    }

    await db.run(
        `INSERT INTO music_settings (
            guild_id, yt_cookies, volume, last_channel_id, radio_enabled, radio_genre,
            dj_auto_enabled, dj_fallback, stream_url, last_query, last_track_title,
            last_position_ms, last_paused, last_was_playing, last_is_live_stream
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET
            yt_cookies = excluded.yt_cookies,
            volume = excluded.volume,
            last_channel_id = excluded.last_channel_id,
            radio_enabled = excluded.radio_enabled,
            radio_genre = excluded.radio_genre,
            dj_auto_enabled = excluded.dj_auto_enabled,
            dj_fallback = excluded.dj_fallback,
            stream_url = excluded.stream_url,
            last_query = excluded.last_query,
            last_track_title = excluded.last_track_title,
            last_position_ms = excluded.last_position_ms,
            last_paused = excluded.last_paused,
            last_was_playing = excluded.last_was_playing,
            last_is_live_stream = excluded.last_is_live_stream`,
        [
            guildId,
            next.yt_cookies || null,
            next.volume ?? 100,
            next.last_channel_id || null,
            next.radio_enabled ?? 1,
            next.radio_genre || null,
            next.dj_auto_enabled ?? 0,
            next.dj_fallback || 'radio',
            next.stream_url || null,
            next.last_query || null,
            next.last_track_title || null,
            Number.isFinite(next.last_position_ms) ? Math.max(0, Math.floor(next.last_position_ms)) : 0,
            next.last_paused ? 1 : 0,
            next.last_was_playing ? 1 : 0,
            next.last_is_live_stream ? 1 : 0
        ]
    );
}

async function logMusicEvent(guildId, level, message, metadata) {
    const db = await initDB();
    await db.run(
        `INSERT INTO music_logs (guild_id, level, message, metadata) VALUES (?, ?, ?, ?)`,
        [guildId, level, message, JSON.stringify(metadata)]
    );
}

async function getMusicLogs(guildId, limit = 50) {
    const db = await initDB();
    return db.all(
        `SELECT * FROM music_logs WHERE guild_id = ? ORDER BY timestamp DESC LIMIT ?`,
        [guildId, limit]
    );
}

async function createTicket(guildId, userId, title, channelId = null) {
    const db = await initDB();
    const result = await db.run(
        `INSERT INTO tickets (guild_id, user_id, title, channel_id, status) VALUES (?, ?, ?, ?, 'open')`,
        [guildId, userId, title, channelId]
    );
    return db.get(`SELECT * FROM tickets WHERE id = ?`, [result.lastID]);
}

async function getTickets(guildId, status = null) {
    const db = await initDB();
    if (!status) {
        return db.all(
            `SELECT * FROM tickets WHERE guild_id = ? ORDER BY id DESC`,
            [guildId]
        );
    }
    return db.all(
        `SELECT * FROM tickets WHERE guild_id = ? AND status = ? ORDER BY id DESC`,
        [guildId, status]
    );
}

async function closeTicket(guildId, ticketId) {
    const db = await initDB();
    await db.run(
        `UPDATE tickets SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE guild_id = ? AND id = ?`,
        [guildId, ticketId]
    );
    return db.get(`SELECT * FROM tickets WHERE guild_id = ? AND id = ?`, [guildId, ticketId]);
}

// --- User Playlists Helpers ---
async function createUserPlaylist(userId, name) {
    const db = await initDB();
    return db.run(`INSERT INTO user_playlists (user_id, name) VALUES (?, ?)`, [userId, name]);
}

async function getUserPlaylists(userId) {
    const db = await initDB();
    return db.all(`
        SELECT p.*, (SELECT COUNT(*) FROM user_playlist_items WHERE playlist_id = p.id) as item_count 
        FROM user_playlists p WHERE user_id = ?`, [userId]);
}

async function getUserPlaylistByName(userId, name) {
    const db = await initDB();
    return db.get(`SELECT * FROM user_playlists WHERE user_id = ? AND name = ?`, [userId, name]);
}

async function deleteUserPlaylist(userId, name) {
    const db = await initDB();
    const playlist = await getUserPlaylistByName(userId, name);
    if (!playlist) return false;
    await db.run(`DELETE FROM user_playlists WHERE id = ?`, [playlist.id]);
    return true;
}

async function addUserPlaylistItem(playlistId, query) {
    const db = await initDB();
    const row = await db.get(`SELECT MAX(position) as lastPos FROM user_playlist_items WHERE playlist_id = ?`, [playlistId]);
    const nextPos = (row?.lastPos || 0) + 1;
    await db.run(`INSERT INTO user_playlist_items (playlist_id, query, position) VALUES (?, ?, ?)`, [playlistId, query, nextPos]);
    return { position: nextPos };
}

async function getUserPlaylistItems(playlistId) {
    const db = await initDB();
    return db.all(`SELECT * FROM user_playlist_items WHERE playlist_id = ? ORDER BY position ASC`, [playlistId]);
}

async function removeUserPlaylistItem(playlistId, position) {
    const db = await initDB();
    const result = await db.run(`DELETE FROM user_playlist_items WHERE playlist_id = ? AND position = ?`, [playlistId, position]);
    if (result.changes > 0) {
        // Re-order remaining items
        await db.run(`
            UPDATE user_playlist_items 
            SET position = (SELECT COUNT(*) FROM user_playlist_items i2 WHERE i2.playlist_id = ? AND i2.position <= user_playlist_items.position)
            WHERE playlist_id = ?`, [playlistId, playlistId]);
        return true;
    }
    return false;
}

async function recordUserMusicPreference(guildId, userId, seed) {
    const db = await initDB();
    const normalizedSeed = String(seed || '').trim();
    if (!guildId || !userId || !normalizedSeed) return;
    await db.run(
        `INSERT INTO user_music_preferences (guild_id, user_id, seed, play_count, last_used_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(guild_id, user_id, seed) DO UPDATE SET
         play_count = user_music_preferences.play_count + 1,
         last_used_at = CURRENT_TIMESTAMP`,
        [guildId, userId, normalizedSeed]
    );
}

async function getUserTopMusicPreference(guildId, userId) {
    const db = await initDB();
    if (!guildId || !userId) return null;
    return db.get(
        `SELECT seed, play_count, last_used_at
         FROM user_music_preferences
         WHERE guild_id = ? AND user_id = ?
         ORDER BY play_count DESC, last_used_at DESC
         LIMIT 1`,
        [guildId, userId]
    );
}

module.exports = { 
    initDB, getGuildConfig, setGuildConfig, getSettings, updateSettings, 
    setGuildLanguage,
    updateUserStats, getAllAchievements, createAchievement, getUserAchievements, earnAchievement,
    getMusicSettings, updateMusicSettings, logMusicEvent, getMusicLogs,
    createTicket, getTickets, closeTicket,
    createUserPlaylist, getUserPlaylists, getUserPlaylistByName, deleteUserPlaylist, addUserPlaylistItem, getUserPlaylistItems, removeUserPlaylistItem,
    recordUserMusicPreference, getUserTopMusicPreference,
    encrypt, decrypt
};
