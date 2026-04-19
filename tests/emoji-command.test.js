const assert = require('assert');
const { handleEmojiCommand, isLikelyEmojiAssetUrl, EMOJI_NAME_REGEX } = require('../commands/emoji');

function createBaseMessage(content, { canManage = true, guildOverrides = {} } = {}) {
  const replies = [];
  const created = [];
  const deleted = [];

  const existingEmoji = {
    id: 'emoji-1',
    name: 'old_emoji',
    animated: false,
    delete: async () => {
      deleted.push('old_emoji');
    }
  };

  const guild = {
    emojis: {
      cache: {
        values: () => [existingEmoji],
        find: (predicate) => (predicate(existingEmoji) ? existingEmoji : undefined)
      },
      create: async ({ attachment, name }) => {
        created.push({ attachment, name });
        return { id: 'emoji-new', name };
      }
    },
    ...guildOverrides
  };

  return {
    content,
    guild,
    member: {
      permissions: { has: () => canManage }
    },
    author: { id: 'author-1' },
    reply: async (text) => {
      replies.push(text);
      return {};
    },
    _replies: replies,
    _created: created,
    _deleted: deleted
  };
}

async function run() {
  assert.strictEqual(EMOJI_NAME_REGEX.test('ok_name'), true);
  assert.strictEqual(EMOJI_NAME_REGEX.test('x'), false);
  assert.strictEqual(isLikelyEmojiAssetUrl('https://x.com/a.png'), true);
  assert.strictEqual(isLikelyEmojiAssetUrl('https://x.com/a.txt'), false);

  const noPerm = createBaseMessage('!emoji list', { canManage: false });
  assert.strictEqual(await handleEmojiCommand(noPerm), true);
  assert.ok(noPerm._replies[0].includes('Necesitas permiso'));

  const addMsg = createBaseMessage('!emoji add think https://cdn.example.com/think.png');
  assert.strictEqual(await handleEmojiCommand(addMsg), true);
  assert.strictEqual(addMsg._created.length, 1);
  assert.strictEqual(addMsg._created[0].name, 'think');
  assert.ok(addMsg._replies[0].includes('Emoji agregado'));

  const deleteMsg = createBaseMessage('!emoji delete old_emoji');
  assert.strictEqual(await handleEmojiCommand(deleteMsg), true);
  assert.strictEqual(deleteMsg._deleted.length, 1);
  assert.ok(deleteMsg._replies[0].includes('Emoji eliminado'));

  const listMsg = createBaseMessage('!emoji list');
  assert.strictEqual(await handleEmojiCommand(listMsg), true);
  assert.ok(listMsg._replies[0].includes('Emojis del servidor'));

  console.log('emoji command tests ok');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

