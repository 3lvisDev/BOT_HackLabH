/**
 * Comando de ayuda para listar las funciones disponibles del bot.
 */
module.exports = {
    handleHelpCommand: async (message) => {
        if (!message.content.startsWith('.help') && !message.content.startsWith('!help')) return false;

        const embed = {
            color: 0x6366f1,
            title: '🛠️ HackLab Bot - Menú de Ayuda',
            description: 'Prefijos disponibles: `!` y `.`. También tienes slash commands `/`.',
            fields: [
                {
                    name: '🎵 Música',
                    value: '`!play <canción/link>` o `.play <canción/link>`\n`!stop` / `!skip` / `!next` / `!previous` / `!pause` / `!resume` / `!queue`\n`!playlist create|add|import|show|play|list|delete`\nSoporta enlaces de Spotify (track/playlist/album) para resolver a YouTube/YT Music.',
                },
                {
                    name: '🎫 Tickets',
                    value: '`!ticket open <título>`\n`!ticket list [open|closed|all]`\n`!ticket close <id>`',
                },
                {
                    name: '😀 Emojis',
                    value: '`!emoji add <nombre> <url>`\n`!emoji addfile <nombre>` (con adjunto)\n`!emoji delete <nombre>`\n`!emoji list` / `!emoji app_list` / `!emoji use <nombre> [fallback]`',
                },
                {
                    name: '⚙️ Configuración',
                    value: '`.setup_community` - Inicia la configuración automática del servidor (Solo Owner).',
                },
                {
                    name: '🌐 Dashboard',
                    value: 'Panel web con Web Music Player, playlists, tickets, logs y ajustes del servidor.',
                }
            ],
            footer: {
                text: 'HackLab Hispano • Prefijos ! y .',
            },
            timestamp: new Date().toISOString(),
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
