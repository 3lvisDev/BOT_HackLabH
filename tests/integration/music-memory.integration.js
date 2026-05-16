#!/usr/bin/env node
const { spawn } = require('child_process');
const http = require('http');

function request(method, url, data) {
  return new Promise((resolve, reject) => {
    const payload = data ? Buffer.from(JSON.stringify(data)) : null;
    const req = http.request(url, {
      method,
      headers: payload ? { 'content-type': 'application/json', 'content-length': payload.length } : {}
    }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitHealth(base, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await request('GET', `${base}/health`);
      if (res.status === 200) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

(async () => {
  const nodeMajor = Number(process.versions.node.split('.')[0] || '0');
  if (nodeMajor > 22) {
    console.log(`integration skipped: Node ${process.versions.node} is outside supported range (<=22)`);
    return;
  }

  const port = 19777;
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['services/music-memory/src/server.js'], {
    env: { ...process.env, PORT: String(port), MUSIC_MEMORY_DB_PATH: ':memory:' },
    stdio: 'ignore'
  });

  try {
    const healthy = await waitHealth(base);
    if (!healthy) throw new Error('music-memory did not become healthy');

    const post = await request('POST', `${base}/v1/events/play`, {
      guild_id: 'g-test', user_id: 'u-test', seed: 'rock', track_title: 'x', artist: 'y'
    });
    if (post.status !== 202) throw new Error(`expected 202 from POST /v1/events/play, got ${post.status}`);

    const stats = await request('GET', `${base}/v1/stats/top?scope=guild&type=seed&guild_id=g-test&limit=1`);
    if (stats.status !== 200) throw new Error(`expected 200 from stats, got ${stats.status}`);
    if (!stats.body.includes('rock')) throw new Error('expected stats response to include seed rock');

    console.log('integration ok: music-memory health, ingest and stats');
  } finally {
    child.kill('SIGTERM');
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
