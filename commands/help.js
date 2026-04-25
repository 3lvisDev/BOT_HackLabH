/**
 * Comando de ayuda para listar las funciones disponibles del bot.
 */
const { resolveGuildLocale, t } = require('../utils/i18n');

module.exports = {
  handleHelpCommand: async (message) => {
    if (!message.content.startsWith('.help') && !message.content.startsWith('!help')) return false;

    const locale = resolveGuildLocale(message.guild);
    const embed = {
      color: 0x6366f1,
      title: t(locale, 'help_title'),
      description: t(locale, 'help_description'),
      fields: [
        {
          name: t(locale, 'help_music_title'),
          value: t(locale, 'help_music_value')
        },
        {
          name: t(locale, 'help_tickets_title'),
          value: t(locale, 'help_tickets_value')
        },
        {
          name: t(locale, 'help_emoji_title'),
          value: t(locale, 'help_emoji_value')
        },
        {
          name: t(locale, 'help_config_title'),
          value: t(locale, 'help_config_value')
        },
        {
          name: t(locale, 'help_dashboard_title'),
          value: t(locale, 'help_dashboard_value')
        }
      ],
      footer: {
        text: t(locale, 'help_footer')
      },
      timestamp: new Date().toISOString()
    };

    try {
      await message.reply({ embeds: [embed] });
    } catch (err) {
      console.error('[Help] Error sending message:', err);
      await message.reply('❌ Error al mostrar el menú de ayuda.');
    }

    return true;
  }
};
