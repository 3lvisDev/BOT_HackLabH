const assert = require('assert');
const { detectLocale, resolveGuildLocale, resolveInteractionLocale, t } = require('../utils/i18n');

function run() {
  assert.strictEqual(detectLocale('es-ES'), 'es');
  assert.strictEqual(detectLocale('en-US'), 'en');
  assert.strictEqual(detectLocale('pt-BR'), 'es');
  assert.strictEqual(resolveGuildLocale({ preferredLocale: 'en-GB' }), 'en');
  assert.strictEqual(resolveInteractionLocale({ guildLocale: 'es-419' }), 'es');

  assert.strictEqual(t('en', 'automod_enabled_ok'), 'AutoMod enabled.');
  assert.strictEqual(t('es', 'automod_enabled_ok'), 'AutoMod activado.');
  assert.strictEqual(t('unknown', 'slash_unknown'), 'Comando no reconocido.');
  assert.strictEqual(
    t('en', 'automod_status', { enabled: 'enabled', count: 2 }),
    'AutoMod: **enabled** • Keywords: **2**'
  );

  console.log('i18n tests ok');
}

run();
