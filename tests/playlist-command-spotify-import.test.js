const assert = require('assert');
const db = require('../db');
const { handlePlaylistCommand } = require('../commands/playlist');

async function run() {
  const originalGetPlaylistByName = db.getPlaylistByName;
  const originalAddPlaylistItem = db.addPlaylistItem;

  const calls = [];

  db.getPlaylistByName = async () => ({ id: 1, name: 'mix' });
  db.addPlaylistItem = async (guildId, playlistName, query) => {
    calls.push({ guildId, playlistName, query });
    return { playlistId: 1, position: calls.length };
  };

  const replies = [];
  const message = {
    content: '!playlist import mix | https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    guild: { id: 'guild-42' },
    author: { id: 'user-99' },
    reply: async (text) => {
      replies.push(text);
      return {};
    }
  };

  const musicManager = {
    resolvePlayableQueries: async () => [
      'Daft Punk One More Time',
      'Daft Punk Harder Better Faster Stronger'
    ]
  };

  const handled = await handlePlaylistCommand(message, musicManager);
  assert.strictEqual(handled, true, 'command should be handled');
  assert.strictEqual(calls.length, 2, 'should add all imported tracks');
  assert.strictEqual(calls[0].query, 'Daft Punk One More Time');
  assert.ok(replies[0].includes('Importados 2 tracks'), 'should confirm imported tracks');

  db.getPlaylistByName = originalGetPlaylistByName;
  db.addPlaylistItem = originalAddPlaylistItem;

  console.log('playlist spotify import command ok');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
