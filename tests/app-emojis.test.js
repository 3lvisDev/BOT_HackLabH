const assert = require('assert');
const {
  sanitizeEmojiName,
  formatEmoji,
  emojiOrFallback,
  renderTextWithAppEmojis
} = require('../utils/appEmojis');

function createClientWithAppEmojis(emojis = []) {
  return {
    application: {
      emojis: {
        fetch: async () => new Map(emojis.map((emoji) => [emoji.id, emoji]))
      }
    }
  };
}

async function run() {
  assert.strictEqual(sanitizeEmojiName('  Party_Parrot  '), 'party_parrot');
  assert.strictEqual(sanitizeEmojiName('Rage-Comíc'), 'ragecomc');
  assert.strictEqual(formatEmoji({ id: '1', name: 'ok', animated: false }), '<:ok:1>');
  assert.strictEqual(formatEmoji({ id: '2', name: 'dance', animated: true }), '<a:dance:2>');

  const client = createClientWithAppEmojis([
    { id: '10', name: 'party', animated: false },
    { id: '11', name: 'dance', animated: true }
  ]);

  const resolved = await emojiOrFallback(client, 'party', '❓');
  assert.strictEqual(resolved, '<:party:10>');

  const missing = await emojiOrFallback(client, 'missing', '❓');
  assert.strictEqual(missing, '❓');

  const rendered = await renderTextWithAppEmojis(client, 'Hola :party: :missing:', '✨');
  assert.strictEqual(rendered, 'Hola <:party:10> ✨');

  console.log('app emojis utils tests ok');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

