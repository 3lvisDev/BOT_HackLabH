const path = require('path');
const { AttachmentBuilder } = require('discord.js');
const { resolveGuildLocale, t } = require('../utils/i18n');

module.exports = {
  handleHelpCommand: async (message) => {
    if (!message.content.startsWith('.help') && !message.content.startsWith('!help')) return false;

    const locale = resolveGuildLocale(message.guild);
    const isEs = locale === 'es';
    const heroGifName = 'hacklab_music_bot_animado.gif';
    const heroGifPath = path.join(__dirname, '..', 'assets', 'branding', heroGifName);
    const heroGifFile = new AttachmentBuilder(heroGifPath, { name: heroGifName });
    const thumbnail = message.client.user?.displayAvatarURL?.({ size: 256 }) || undefined;

    const embed = {
      color: 0x8b5cf6,
      title: t(locale, 'help_title'),
      description: `${t(locale, 'help_description')}\n\n${isEs ? 'Usa la radio inteligente con semilla para descubrir musica sin cortar el ambiente.' : 'Use smart seeded radio to discover music without breaking the vibe.'}`,
      image: { url: `attachment://${heroGifName}` },
      fields: [
        { name: t(locale, 'help_music_title'), value: t(locale, 'help_music_value') },
        { name: t(locale, 'help_personal_title'), value: t(locale, 'help_personal_value') },
        { name: t(locale, 'help_tickets_title'), value: t(locale, 'help_tickets_value') },
        { name: t(locale, 'help_emoji_title'), value: t(locale, 'help_emoji_value') },
        { name: t(locale, 'help_config_title'), value: t(locale, 'help_config_value') },
        { name: t(locale, 'help_invite_title'), value: t(locale, 'help_invite_value') },
        { name: t(locale, 'help_dashboard_title'), value: t(locale, 'help_dashboard_value') }
      ],
      footer: { text: t(locale, 'help_footer') },
      timestamp: new Date().toISOString()
    };

    if (thumbnail) embed.thumbnail = { url: thumbnail };

    try {
      await message.reply({ embeds: [embed], files: [heroGifFile] });
    } catch (err) {
      console.error('[Help] Error sending message:', err);
      await message.reply('Error al mostrar el menu de ayuda.');
    }

    return true;
  }
};
