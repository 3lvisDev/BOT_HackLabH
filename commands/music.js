const { validateMusicQuery } = require('../music/validation');

module.exports = {
    handleMusicCommand: async (message, musicManager) => {
        if (!message.content.startsWith('!play') && !message.content.startsWith('!stop')) {
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
                
                const result = await musicManager.play(message.guild.id, voiceChannel.id, query);
                await message.reply(`🎵 Reproduciendo: **${result.title}** en ${result.channel} (Modo: Pruebas Básicas)`);
                
            } catch (err) {
                await message.reply(`❌ Error: ${err.message}`);
            }
            return true;
        }

        if (message.content.startsWith('!stop')) {
            const status = musicManager.getStatus();
            
            // Verificar si hay sesión activa
            if (!status.active) {
                await message.reply("❌ No hay ninguna reproducción activa.");
                return true;
            }

            const voiceChannel = message.member?.voice.channel;
            
            // Verificar si está en el MISMO canal de voz
            if (!voiceChannel || voiceChannel.id !== status.channelId) {
                await message.reply(`❌ Debes estar en el canal **${status.channel}** para controlar la música.`);
                return true;
            }

            try {
                await musicManager.stop();
                await message.reply("🛑 Reproducción detenida y recursos liberados.");
            } catch (err) {
                await message.reply(`❌ Error al detener: ${err.message}`);
            }
            return true;
        }
        
        return false;
    }
};
