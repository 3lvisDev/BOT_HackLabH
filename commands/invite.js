const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'invite',
    description: 'Obtén el enlace de invitación del bot',
    async execute(input) {
        const isInteraction = input.isChatInputCommand?.() || false;
        const client = isInteraction ? input.client : input.client;
        const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
        
        const embed = new EmbedBuilder()
            .setTitle('🚀 ¡Invítame a tu servidor!')
            .setColor('#6366f1')
            .setDescription(`Haz clic en el botón de abajo para añadirme a cualquier servidor donde tengas permisos.\n\n**Permisos incluidos:**\n- Administrador\n- Slash Commands (Comandos de barra)`)
            .setThumbnail(client.user.displayAvatarURL())
            .addFields({ name: 'Enlace Directo', value: `[Haz clic aquí](${inviteUrl})` })
            .setFooter({ text: 'Gracias por usar HackLab Bot' })
            .setTimestamp();

        if (isInteraction) {
            return await input.reply({ embeds: [embed] });
        } else {
            return await input.reply({ embeds: [embed] });
        }
    },
};
