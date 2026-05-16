const express = require('express');
const { getDb } = require('./db');

const app = express();
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'music-memory' });
});

app.post('/v1/events/play', async (req, res) => {
  const { guild_id, user_id, query, track_title, artist, seed, source } = req.body || {};
  if (!guild_id || !user_id) {
    return res.status(400).json({ error: 'guild_id and user_id are required' });
  }

  const db = await getDb();
  await db.run(
    `INSERT INTO play_events (guild_id, user_id, query, track_title, artist, seed, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [guild_id, user_id, query || null, track_title || null, artist || null, seed || null, source || 'bot']
  );

  res.status(202).json({ accepted: true });
});

app.get('/v1/stats/top', async (req, res) => {
  const scope = String(req.query.scope || 'global');
  const type = String(req.query.type || 'seed');
  const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 50);
  const allowedTypes = new Set(['seed', 'artist', 'track']);
  if (!allowedTypes.has(type)) return res.status(400).json({ error: 'invalid type' });

  const column = type === 'track' ? 'track_title' : type;
  const db = await getDb();

  let where = `${column} IS NOT NULL AND TRIM(${column}) <> ''`;
  const params = [];

  if (scope === 'guild') {
    if (!req.query.guild_id) return res.status(400).json({ error: 'guild_id is required for guild scope' });
    where += ' AND guild_id = ?';
    params.push(String(req.query.guild_id));
  } else if (scope === 'user') {
    if (!req.query.user_id) return res.status(400).json({ error: 'user_id is required for user scope' });
    where += ' AND user_id = ?';
    params.push(String(req.query.user_id));
    if (req.query.guild_id) {
      where += ' AND guild_id = ?';
      params.push(String(req.query.guild_id));
    }
  }

  const rows = await db.all(
    `SELECT ${column} as label, COUNT(*) as plays, MAX(played_at) as last_played_at
     FROM play_events
     WHERE ${where}
     GROUP BY ${column}
     ORDER BY plays DESC, last_played_at DESC, label ASC
     LIMIT ?`,
    [...params, limit]
  );

  res.status(200).json({ scope, type, items: rows });
});

const port = Number(process.env.PORT || 9777);
app.listen(port, () => {
  console.log(`[music-memory] listening on ${port}`);
});
