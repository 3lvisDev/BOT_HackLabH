const axios = require('axios');

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

async function postWithRetryTimed(url, payload, tries = 3) {
  let lastErr = null;
  for (let i = 0; i < tries; i++) {
    const t0 = Date.now();
    try {
      await axios.post(url, payload, { timeout: 20000 });
      return { ok: true, ms: Date.now() - t0 };
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await new Promise(r => setTimeout(r, 120));
    }
  }
  return { ok: false, ms: 0, err: String(lastErr?.message || 'unknown') };
}

async function main() {
  const base = 'http://localhost:9777';
  const guilds = 300;
  const usersPerGuild = 10;
  const eventsPerUser = 5;
  const seeds = ['regueton', 'romantica', 'rock', 'salsa', 'pop'];

  const payloads = [];
  for (let g = 1; g <= guilds; g++) {
    for (let u = 1; u <= usersPerGuild; u++) {
      for (let e = 0; e < eventsPerUser; e++) {
        const seed = seeds[(g + u + e) % seeds.length];
        payloads.push({ guild_id: `guild-${g}`, user_id: `user-${u}`, query: `${seed} mix`, track_title: `Track ${seed} ${e}`, artist: `Artist ${seed}`, seed, source: 'load-test-heavy' });
      }
    }
  }

  const latencies = [];
  let ok = 0, fail = 0;
  const errors = {};
  const start = Date.now();
  const chunk = 120;

  for (let i = 0; i < payloads.length; i += chunk) {
    const slice = payloads.slice(i, i + chunk);
    const results = await Promise.all(slice.map(p => postWithRetryTimed(`${base}/v1/events/play`, p)));
    for (const r of results) {
      if (r.ok) { ok++; latencies.push(r.ms); }
      else { fail++; errors[r.err] = (errors[r.err] || 0) + 1; }
    }
  }

  const totalMs = Date.now() - start;
  const eps = ok / (totalMs / 1000);

  const summary = {
    totalEvents: payloads.length,
    ok,
    fail,
    durationMs: totalMs,
    eps: Number(eps.toFixed(2)),
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      max: latencies.length ? Math.max(...latencies) : 0
    },
    errorBuckets: errors
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
