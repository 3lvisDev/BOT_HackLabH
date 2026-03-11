const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

let dbPromise;

async function initDB() {
    if (!dbPromise) {
        dbPromise = open({
            filename: path.join(__dirname, 'bot_data.sqlite'),
            driver: sqlite3.Database
        }).then(async (db) => {
            await db.exec(`
                CREATE TABLE IF NOT EXISTS guild_configs (
                    guild_id TEXT PRIMARY KEY,
                    base_role_id TEXT,
                    is_configured BOOLEAN DEFAULT 0
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
            `);
            return db;
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

async function getMusicSettings(guildId) {
    const db = await initDB();
    return db.get(`SELECT * FROM music_settings WHERE guild_id = ?`, [guildId]);
}

async function updateMusicSettings(guildId, settings) {
    const db = await initDB();
    const { yt_cookies, volume, last_channel_id } = settings;
    await db.run(`INSERT INTO music_settings (guild_id, yt_cookies, volume, last_channel_id)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
            yt_cookies = excluded.yt_cookies,
            volume = excluded.volume,
            last_channel_id = excluded.last_channel_id`,
    [guildId, yt_cookies, volume, last_channel_id]);
}

module.exports = { 
    initDB, getGuildConfig, setGuildConfig, getSettings, updateSettings, 
    updateUserStats, getAllAchievements, createAchievement, getUserAchievements, earnAchievement,
    getMusicSettings, updateMusicSettings
};
