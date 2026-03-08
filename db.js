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
                )
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

module.exports = { initDB, getGuildConfig, setGuildConfig };
