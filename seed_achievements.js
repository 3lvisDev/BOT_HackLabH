const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'bot_data.sqlite'));

db.serialize(() => {
    // Crear tabla si no existe (por seguridad)
    db.run(`CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        milestone_type TEXT,
        milestone_value INTEGER
    )`);

    const defaultAchievements = [
        { name: 'Primer Paso', description: 'Envía tu primer mensaje en el servidor.', icon: '👶', milestone_type: 'messages', milestone_value: 1 },
        { name: 'Charlatán', description: 'Has enviado 100 mensajes. ¡No paras!', icon: '💬', milestone_type: 'messages', milestone_value: 100 },
        { name: 'Leyenda', description: '¡1000 mensajes alcanzados! Eres una leyenda.', icon: '👑', milestone_type: 'messages', milestone_value: 1000 }
    ];

    defaultAchievements.forEach(a => {
        db.get('SELECT id FROM achievements WHERE name = ?', [a.name], (err, row) => {
            if (!row) {
                db.run('INSERT INTO achievements (name, description, icon, milestone_type, milestone_value) VALUES (?, ?, ?, ?, ?)',
                    [a.name, a.description, a.icon, a.milestone_type, a.milestone_value]);
                console.log(`✅ Logro creado: ${a.name}`);
            }
        });
    });
});

setTimeout(() => db.close(), 2000);
