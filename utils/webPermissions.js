function parseOwnerIds(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getConfiguredOwnerIds(env = process.env) {
  const candidates = [
    env.WEB_OWNER_DISCORD_IDS,
    env.WEB_OWNER_DISCORD_ID,
    env.DISCORD_OWNER_ID,
    env.BOT_OWNER_ID
  ];

  const ids = new Set();
  for (const candidate of candidates) {
    for (const id of parseOwnerIds(candidate)) {
      ids.add(id);
    }
  }
  return [...ids];
}

function canManageSecrets(userId, env = process.env, options = {}) {
  if (!userId) return false;
  const owners = getConfiguredOwnerIds(env);
  if (!owners.length) {
    return Boolean(options.isGuildOwner);
  }
  return owners.includes(String(userId));
}

module.exports = {
  parseOwnerIds,
  getConfiguredOwnerIds,
  canManageSecrets
};
