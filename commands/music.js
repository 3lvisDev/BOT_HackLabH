const { validateMusicQuery } = require('../music/validation');

module.exports = {
    handleMusicCommand: async (message, musicManager) => {
        if (!message.content.startsWith('!play') && !message.content.startsWith('!stop')) {
            // Comandos como !skip o !queue no están disponibles en la versión de sesión única
            if (['!skip', '!queue', '!pause', '!resume'].some(cmd => message.content.startsWith(cmd))) {
                await message.reply("⚠️ Esta versión del sistema de música (YouTube Premium) funciona con sesiones únicas. Solo se permite un canal a la vez y sin cola de reproducción.");
                return true;
            }
            return false;
        }

        if (message.content.startsWith('!play')) {
            const queryRaw = message.content.slice(6).trim();
            if (!queryRaw) {
                await message.reply("Uso: `!play <nombre de canción o link>`");
                return true;
            }

            try {
                const query = validateMusicQuery(queryRaw);
                const voiceChannel = message.member?.voice.channel;
                
                if (!voiceChannel) {
                    await message.reply("❌ ¡Debes estar en un canal de voz!");
                    return true;
                }
                
                // Informar que estamos iniciando el navegador (tarda unos segundos)
                const processingMsg = await message.reply("🌐 Iniciando navegador virtual y preparando audio premium... (esto puede tardar unos segundos)");
                
                const result = await musicManager.play(message.guild.id, voiceChannel.id, query);
                
                await processingMsg.edit(`🎵 Reproduciendo ahora: **${result.title}** en el canal **${result.channel}**`);
                
            } catch (err) {
                // Si el error es por sesión activa, dar un mensaje amigable
                if (err.message.includes('Ya hay una reproducción activa')) {
                    await message.reply(`🚫 **Sistema Ocupado**: ${err.message}`);
                } else {
                    await message.reply(`❌ Error: ${err.message}`);
                }
            }
            return true;
        }

        if (message.content.startsWith('!stop')) {
            const status = musicManager.getStatus();
            
            if (!status.active) {
                await message.reply("❌ No hay ninguna reproducción activa.");
                return true;
            }

            const voiceChannel = message.member?.voice.channel;
            
            if (!voiceChannel || voiceChannel.id !== status.channelId) {
                await message.reply(`❌ Debes estar en el canal de voz **${status.channel}** para detener la música.`);
                return true;
            }

            try {
                await musicManager.stop();
                await message.reply("🛑 Sesión finalizada y recursos liberados.");
            } catch (err) {
                await message.reply(`❌ Error al detener: ${err.message}`);
            }
            return true;
        }
        
        return false;
    }
};
