function sanitizeEmojiName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

async function fetchApplicationEmojis(client) {
  if (!client?.application?.emojis?.fetch) {
    return [];
  }
  const collection = await client.application.emojis.fetch();
  return Array.from(collection.values());
}

async function getApplicationEmojiMap(client) {
  const emojis = await fetchApplicationEmojis(client);
  const map = new Map();
  for (const emoji of emojis) {
    const key = sanitizeEmojiName(emoji.name);
    if (!key) continue;
    map.set(key, emoji);
  }
  return map;
}

function formatEmoji(emoji) {
  if (!emoji) return '';
  return `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
}

async function emojiOrFallback(client, name, fallback = '✨') {
  const map = await getApplicationEmojiMap(client);
  const key = sanitizeEmojiName(name);
  const emoji = map.get(key);
  return emoji ? formatEmoji(emoji) : fallback;
}

async function renderTextWithAppEmojis(client, text, fallback = '') {
  const map = await getApplicationEmojiMap(client);
  return String(text || '').replace(/:([a-zA-Z0-9_]{2,32}):/g, (_, rawName) => {
    const emoji = map.get(sanitizeEmojiName(rawName));
    return emoji ? formatEmoji(emoji) : fallback || `:${rawName}:`;
  });
}

module.exports = {
  sanitizeEmojiName,
  fetchApplicationEmojis,
  getApplicationEmojiMap,
  formatEmoji,
  emojiOrFallback,
  renderTextWithAppEmojis
};

