const assert = require('assert');
const { parseOwnerIds, getConfiguredOwnerIds, canManageSecrets } = require('../utils/webPermissions');

function run() {
  assert.deepStrictEqual(parseOwnerIds(' 1,2 , 3 '), ['1', '2', '3']);
  assert.deepStrictEqual(parseOwnerIds(''), []);

  const env = {
    WEB_OWNER_DISCORD_IDS: '10,20',
    DISCORD_OWNER_ID: '30'
  };
  const owners = getConfiguredOwnerIds(env);
  assert.ok(owners.includes('10'));
  assert.ok(owners.includes('20'));
  assert.ok(owners.includes('30'));

  assert.strictEqual(canManageSecrets('10', env), true);
  assert.strictEqual(canManageSecrets('999', env), false);
  assert.strictEqual(canManageSecrets(null, env), false);
  assert.strictEqual(canManageSecrets('999', {}, { isGuildOwner: true }), true);
  assert.strictEqual(canManageSecrets('999', {}, { isGuildOwner: false }), false);

  console.log('web permissions tests ok');
}

run();
