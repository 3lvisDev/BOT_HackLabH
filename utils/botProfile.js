const { ActivityType } = require('discord.js');

function formatGuildCount(count = 0) {
  const safe = Number.isFinite(count) ? count : 0;
  return safe.toLocaleString('en-US');
}

function applyBotPresence(client, status = {}) {
  if (!client?.user) return;

  const guildCount = client.guilds?.cache?.size || 0;
  const active = Boolean(status.active);
  const track = status.currentTrack ? String(status.currentTrack).slice(0, 96) : null;

  const activity = active && track
    ? { type: ActivityType.Listening, name: track }
    : { type: ActivityType.Playing, name: `On ${formatGuildCount(guildCount)} Guilds` };

  try {
    client.user.setPresence({
      status: active ? 'online' : 'idle',
      activities: [activity]
    });
  } catch (_) {}
}

module.exports = { applyBotPresence };
