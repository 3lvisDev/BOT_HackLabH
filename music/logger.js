const db = require('../db');

let socketServer = null;

function setSocketServer(wss) {
    socketServer = wss;
}

async function logMusicEvent(guildId, level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    
    // Console output for debugging
    const color = level === 'error' ? '\x1b[31m' : level === 'warning' ? '\x1b[33m' : '\x1b[32m';
    console.log(`${color}[Music][${level.toUpperCase()}] ${message}\x1b[0m`);

    try {
        // Persist to DB
        await db.logMusicEvent(guildId, level, message, metadata);
        
        // Broadcast to WebSocket
        if (socketServer) {
            const payload = JSON.stringify({
                type: 'music:log',
                timestamp,
                level,
                message,
                metadata
            });
            socketServer.clients.forEach(client => {
                if (client.readyState === 1) { // OPEN
                    client.send(payload);
                }
            });
        }
    } catch (err) {
        console.error('[Logger] Error saving music log:', err.message);
    }
}

module.exports = { logMusicEvent, setSocketServer };
