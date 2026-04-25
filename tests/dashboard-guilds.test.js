const assert = require('assert');
const { buildAccessibleGuilds, resolveSelectedGuildId } = require('../dashboard-guilds');

function run() {
  const botGuilds = [
    { id: '1', name: 'Guild One', icon: null, memberCount: 10 },
    { id: '2', name: 'Guild Two', icon: null, memberCount: 20 }
  ];

  const oauthGuilds = [
    { id: '1', permissions: String(0x8) },
    { id: '2', permissions: '0' },
    { id: '3', permissions: String(0x20) }
  ];

  const accessible = buildAccessibleGuilds(botGuilds, oauthGuilds);
  assert.strictEqual(accessible.length, 2, 'Debe incluir todos los servidores compartidos con bot');
  const g1 = accessible.find((g) => g.id === '1');
  const g2 = accessible.find((g) => g.id === '2');
  assert.strictEqual(g1.userCanManage, true, 'Admin debe tener userCanManage=true');
  assert.strictEqual(g2.userCanManage, false, 'Usuario normal debe tener userCanManage=false');

  assert.strictEqual(resolveSelectedGuildId({ requestedGuildId: '2', sessionGuildId: '1', accessibleGuilds: accessible }), '2');
  assert.strictEqual(resolveSelectedGuildId({ requestedGuildId: 'x', sessionGuildId: '1', accessibleGuilds: accessible }), '1');

  console.log('dashboard guilds tests ok');
}

run();
