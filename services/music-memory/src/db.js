const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

let dbPromise;

async function getDb() {
  if (!dbPromise) {
    dbPromise = open({
      filename: process.env.MUSIC_MEMORY_DB_PATH || path.join(__dirname, '..', 'data', 'music-memory.sqlite'),
      driver: sqlite3.Database
    }).then(async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS play_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          query TEXT,
          track_title TEXT,
          artist TEXT,
          seed TEXT,
          source TEXT,
          played_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_play_events_guild_time ON play_events(guild_id, played_at DESC);
        CREATE INDEX IF NOT EXISTS idx_play_events_user_time ON play_events(user_id, played_at DESC);
      `);
      return db;
    });
  }
  return dbPromise;
}

module.exports = { getDb };
