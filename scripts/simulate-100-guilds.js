const axios = require('axios');

async function postWithRetry(url, payload, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      await axios.post(url, payload, { timeout: 15000 });
      return true;
    } catch (e) {
      if (i === tries - 1) return false;
      await new Promise(r => setTimeout(r, 150));
    }
  }
  return false;
}

async function main() {
  const base = 'http://localhost:9777';
  const guilds = 100;
  const usersPerGuild = 10;
  const eventsPerUser = 5;
  const seeds = ['regueton', 'romantica', 'rock', 'salsa', 'pop'];

  const payloads = [];
  for (let g = 1; g <= guilds; g++) {
    for (let u = 1; u <= usersPerGuild; u++) {
      for (let e = 0; e < eventsPerUser; e++) {
        const seed = seeds[(g + u + e) % seeds.length];
        payloads.push({
          guild_id: `guild-${g}`,
          user_id: `user-${u}`,
          query: `${seed} mix`,
          track_title: `Track ${seed} ${e}`,
          artist: `Artist ${seed}`,
          seed,
          source: 'load-test'
        });
      }
    }
  }

  const start = Date.now();
  let ok = 0;
  let fail = 0;
  const chunk = 100;
  for (let i = 0; i < payloads.length; i += chunk) {
    const slice = payloads.slice(i, i + chunk);
    const results = await Promise.all(slice.map(p => postWithRetry(`${base}/v1/events/play`, p)));
    for (const r of results) r ? ok++ : fail++;
  }
  const ms = Date.now() - start;

  const globalTop = await axios.get(`${base}/v1/stats/top`, { params: { scope: 'global', type: 'seed', limit: 5 } });
  const guildTop = await axios.get(`${base}/v1/stats/top`, { params: { scope: 'guild', guild_id: 'guild-42', type: 'seed', limit: 3 } });

  console.log(JSON.stringify({
    totalEvents: payloads.length,
    ok,
    fail,
    durationMs: ms,
    eps: Number((ok / (ms / 1000)).toFixed(2)),
    globalTop: globalTop.data.items,
    guild42Top: guildTop.data.items
  }, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
