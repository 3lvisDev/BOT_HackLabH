const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });

const commands = [
    // --- Música ---
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('Reproduce una canción desde YouTube o Spotify')
        .addStringOption(opt => opt.setName('query').setDescription('URL o nombre de la canción').setRequired(true)),
    new SlashCommandBuilder().setName('stop').setDescription('Detiene la música y saca al bot del canal'),
    new SlashCommandBuilder().setName('skip').setDescription('Salta a la siguiente canción'),
    new SlashCommandBuilder().setName('next').setDescription('Salta a la siguiente canción (alias de skip)'),
    new SlashCommandBuilder().setName('previous').setDescription('Vuelve a la canción anterior'),
    new SlashCommandBuilder().setName('pause').setDescription('Pausa la reproducción actual'),
    new SlashCommandBuilder().setName('resume').setDescription('Reanuda la música pausada'),
    new SlashCommandBuilder().setName('queue').setDescription('Muestra la lista de canciones en espera'),
    new SlashCommandBuilder().setName('radio').setDescription('Activa/Desactiva el modo radio basado en un género'),

    // --- Playlists Personales ---
    new SlashCommandBuilder()
        .setName('myplaylist')
        .setDescription('Gestiona tus playlists privadas')
        .addSubcommand(sub => sub.setName('list').setDescription('Lista tus playlists'))
        .addSubcommand(sub => sub.setName('play').setDescription('Reproduce una de tus playlists')
            .addStringOption(opt => opt.setName('name').setDescription('Nombre de la playlist').setRequired(true))),

    // --- Otros ---
    new SlashCommandBuilder().setName('help').setDescription('Muestra la lista de comandos disponibles'),
    new SlashCommandBuilder().setName('invite').setDescription('Obtén el enlace para invitar al bot a tu servidor'),
    new SlashCommandBuilder().setName('stats').setDescription('Muestra estadísticas del bot'),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('--- Iniciando registro de Slash Commands ---');
        
        // Registrar globalmente (puede tardar hasta 1h en propagarse en todos los servidores, 
        // pero es lo que queremos para una "App" profesional)
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('✅ ¡Slash Commands registrados exitosamente!');
    } catch (error) {
        console.error('❌ Error al registrar comandos:', error);
    }
})();
