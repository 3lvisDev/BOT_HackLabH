#!/usr/bin/env node
const { readFileSync } = require('fs');
const { join } = require('path');

const content = readFileSync(join(process.cwd(), 'utils', 'i18n.js'), 'utf8');

const requiredKeys = [
  'help_title', 'help_description', 'help_music_title', 'help_music_value',
  'help_personal_title', 'help_personal_value', 'help_tickets_title', 'help_tickets_value',
  'help_emoji_title', 'help_emoji_value', 'help_config_title', 'help_config_value',
  'help_invite_title', 'help_invite_value', 'help_dashboard_title', 'help_dashboard_value',
  'help_footer'
];

function checkLocale(localeName) {
  const marker = `${localeName}: {`;
  const start = content.indexOf(marker);
  if (start < 0) throw new Error(`Locale block not found: ${localeName}`);
  const next = content.indexOf('\n  },', start + marker.length);
  const block = content.slice(start, next > -1 ? next : undefined);
  const missing = requiredKeys.filter((k) => !new RegExp(`${k}:`).test(block));
  return missing;
}

const esMissing = checkLocale('es');
const enMissing = checkLocale('en');

if (esMissing.length || enMissing.length) {
  console.error('typecheck-i18n failed');
  if (esMissing.length) console.error('Missing in es:', esMissing.join(', '));
  if (enMissing.length) console.error('Missing in en:', enMissing.join(', '));
  process.exit(1);
}

console.log('typecheck ok: i18n critical keys present in es/en');
