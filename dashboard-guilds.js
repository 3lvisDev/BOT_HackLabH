const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

function canManageGuild(permissions) {
  try {
    const bits = BigInt(String(permissions || '0'));
    return (bits & MANAGE_GUILD) === MANAGE_GUILD || (bits & ADMINISTRATOR) === ADMINISTRATOR;
  } catch {
    return false;
  }
}

function buildAccessibleGuilds(botGuilds = [], oauthGuilds = []) {
  const oauthById = new Map((oauthGuilds || []).map((g) => [g.id, g]));

  return (botGuilds || [])
    .map((guild) => {
      const oauthGuild = oauthById.get(guild.id);
      if (!oauthGuild) return null;
      const userCanManage = canManageGuild(oauthGuild.permissions);

      return {
        id: guild.id,
        name: guild.name,
        icon: guild.icon || null,
        memberCount: guild.memberCount || 0,
        userCanManage
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function resolveSelectedGuildId({ requestedGuildId, sessionGuildId, accessibleGuilds = [] }) {
  const ids = new Set((accessibleGuilds || []).map((g) => g.id));
  if (requestedGuildId && ids.has(requestedGuildId)) return requestedGuildId;
  if (sessionGuildId && ids.has(sessionGuildId)) return sessionGuildId;
  return accessibleGuilds[0]?.id || null;
}

function buildGuildChannels(guild) {
  if (!guild?.channels?.cache) return [];

  return Array.from(guild.channels.cache.values())
    .filter((channel) => channel?.isTextBased?.() && !channel.isThread?.())
    .map((channel) => ({ id: channel.id, name: channel.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  buildAccessibleGuilds,
  resolveSelectedGuildId,
  buildGuildChannels
};
