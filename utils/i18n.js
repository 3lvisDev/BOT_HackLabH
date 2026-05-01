const SUPPORTED = ['es', 'en'];

const MESSAGES = {
  es: {
    automod_no_permission: 'Necesitas permiso **Gestionar servidor** para usar AutoMod.',
    automod_bot_no_permission: 'No tengo permiso **Gestionar servidor** para administrar AutoMod.',
    automod_status_none: 'AutoMod no está configurado todavía. Agrega una palabra primero.',
    automod_status: 'AutoMod: **{enabled}** • Palabras: **{count}**',
    automod_enabled: 'activado',
    automod_disabled: 'desactivado',
    automod_rule_created: 'AutoMod creado y activado con la palabra: **{word}**',
    automod_word_added: 'Palabra agregada a AutoMod: **{word}**',
    automod_word_exists: 'Esa palabra ya existe en la regla AutoMod.',
    automod_word_removed: 'Palabra eliminada: **{word}**',
    automod_word_missing: 'Esa palabra no existe en AutoMod.',
    automod_words_empty: 'No hay palabras configuradas en AutoMod.',
    automod_words_list: 'Palabras AutoMod ({count}):\n{words}',
    automod_enabled_ok: 'AutoMod activado.',
    automod_disabled_ok: 'AutoMod desactivado.',
    automod_need_rule: 'No existe regla AutoMod todavía. Usa agregar palabra primero.',
    automod_usage: 'Uso: `!automod status|on|off|words list|words add <palabra>|words remove <palabra>`',
    help_music: 'Comandos: `/play`, `/stop`, `/skip`, `/next`, `/previous`, `/pause`, `/resume`, `/queue`.\nPlaylists Globales: `/playlist_create`, `/playlist_add`.\nPlaylists Privadas: `/myplaylist list`, `/myplaylist play`.',
    help_title: '🛠️ HackLab Bot - Menú de Ayuda',
    help_description: 'Prefijos disponibles: `!` y `.`. También tienes slash commands `/`. ¡Haz clic en el perfil del bot para ver sus comandos de barra!',
    help_music_title: '🎵 Música',
    help_music_value: '`!play <canción/link>` o `.play <canción/link>`\n`!stop` / `!skip` / `!next` / `!previous` / `!pause` / `!resume` / `!queue`\n`!playlist create|add|import|show|play|list|delete` (Servidor)',
    help_personal_title: '📂 Mis Playlists (Privadas)',
    help_personal_value: '`.mypl list` - Ver tus listas\n`.mypl create <nombre>` - Crear lista propia\n`.mypl add <nombre> <canción>` - Añadir a tu lista\n`.mypl play <nombre>` - Reproduce tu lista privada',
    help_tickets_title: '🎫 Tickets',
    help_tickets_value: '`!ticket open <título>`\n`!ticket list` / `!ticket close <id>`',
    help_emoji_title: '😀 Emojis',
    help_emoji_value: '`!emoji add <nombre> <url>`\n`!emoji delete <nombre>`\n`!emoji list`',
    help_config_title: '⚙️ Configuración',
    help_config_value: '`.setup_community` - Solo Owner.',
    help_dashboard_title: '🌐 Dashboard',
    help_dashboard_value: 'Panel web con Web Player, playlists personales y ajustes.',
    help_footer: 'HackLab Hispano • Prefijos ! y .',
    slash_guild_only: 'Este comando solo funciona en servidores.',
    slash_unknown: 'Comando no reconocido.',
    slash_error: 'Ocurrió un error procesando el comando.'
  },
  en: {
    automod_no_permission: 'You need **Manage Server** permission to use AutoMod.',
    automod_bot_no_permission: 'I need **Manage Server** permission to manage AutoMod.',
    automod_status_none: 'AutoMod is not configured yet. Add a keyword first.',
    automod_status: 'AutoMod: **{enabled}** • Keywords: **{count}**',
    automod_enabled: 'enabled',
    automod_disabled: 'disabled',
    automod_rule_created: 'AutoMod created and enabled with keyword: **{word}**',
    automod_word_added: 'Keyword added to AutoMod: **{word}**',
    automod_word_exists: 'That keyword already exists in AutoMod.',
    automod_word_removed: 'Keyword removed: **{word}**',
    automod_word_missing: 'That keyword does not exist in AutoMod.',
    automod_words_empty: 'No keywords configured in AutoMod.',
    automod_words_list: 'AutoMod keywords ({count}):\n{words}',
    automod_enabled_ok: 'AutoMod enabled.',
    automod_disabled_ok: 'AutoMod disabled.',
    automod_need_rule: 'AutoMod rule does not exist yet. Add a keyword first.',
    automod_usage: 'Usage: `!automod status|on|off|words list|words add <word>|words remove <word>`',
    help_music: 'Commands: `/play`, `/stop`, `/skip`, `/next`, `/previous`, `/pause`, `/resume`, `/queue`.\nGlobal Playlists: `/playlist_create`, `/playlist_add`.\nPrivate Playlists: `/myplaylist list`, `/myplaylist play`.',
    help_title: '🛠️ HackLab Bot - Help Menu',
    help_description: 'Available prefixes: `!` and `.`. You also have slash commands `/`. Click the bot profile to see app commands!',
    help_music_title: '🎵 Music',
    help_music_value: '`!play <song/link>` or `.play <song/link>`\n`!stop` / `!skip` / `!next` / `!previous` / `!pause` / `!resume` / `!queue`\n`!playlist create|add|import|show|play|list|delete` (Server)',
    help_personal_title: '📂 My Playlists (Private)',
    help_personal_value: '`.mypl list` - See your lists\n`.mypl create <name>` - Create your own list\n`.mypl add <name> <song>` - Add to your list\n`.mypl play <name>` - Play your private list',
    help_tickets_title: '🎫 Tickets',
    help_tickets_value: '`!ticket open <title>`\n`!ticket list` / `!ticket close <id>`',
    help_emoji_title: '😀 Emojis',
    help_emoji_value: '`!emoji add <name> <url>`\n`!emoji delete <name>`\n`!emoji list`',
    help_config_title: '⚙️ Configuration',
    help_config_value: '`.setup_community` - Owner only.',
    help_dashboard_title: '🌐 Dashboard',
    help_dashboard_value: 'Web panel with Web Player, personal playlists and settings.',
    help_footer: 'HackLab Hispano • Prefixes ! and .',
    slash_guild_only: 'This command only works in servers.',
    slash_unknown: 'Unknown command.',
    slash_error: 'An error occurred while processing the command.'
  }
};

function detectLocale(input) {
  const raw = String(input || '').toLowerCase();
  if (!raw) return 'es';
  if (raw.startsWith('en')) return 'en';
  if (raw.startsWith('es')) return 'es';
  return 'es';
}

function resolveGuildLocale(guild) {
  return detectLocale(guild?.preferredLocale || guild?.preferred_language || 'es');
}

function resolveInteractionLocale(interaction) {
  return detectLocale(
    interaction?.guildLocale
      || interaction?.locale
      || interaction?.guild?.preferredLocale
      || 'es'
  );
}

function template(message, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    message
  );
}

function t(locale, key, vars = {}) {
  const lang = SUPPORTED.includes(locale) ? locale : 'es';
  const fromLang = MESSAGES[lang] || {};
  const fromFallback = MESSAGES.es || {};
  const value = fromLang[key] || fromFallback[key] || key;
  return template(value, vars);
}

module.exports = {
  detectLocale,
  resolveGuildLocale,
  resolveInteractionLocale,
  t
};
