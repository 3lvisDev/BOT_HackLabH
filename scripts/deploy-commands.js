require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token) {
  throw new Error('Falta DISCORD_TOKEN en .env');
}

if (!clientId) {
  throw new Error('Falta CLIENT_ID o DISCORD_CLIENT_ID en .env');
}

const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Reproduce música por búsqueda o URL')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('Nombre de canción o URL')
        .setRequired(true)
    ),
  new SlashCommandBuilder().setName('stop').setDescription('Detiene la reproducción actual'),
  new SlashCommandBuilder().setName('skip').setDescription('Salta la canción actual'),
  new SlashCommandBuilder().setName('next').setDescription('Alias de skip'),
  new SlashCommandBuilder().setName('previous').setDescription('Vuelve a la canción anterior'),
  new SlashCommandBuilder().setName('pause').setDescription('Pausa la reproducción'),
  new SlashCommandBuilder().setName('resume').setDescription('Reanuda la reproducción'),
  new SlashCommandBuilder().setName('queue').setDescription('Muestra la cola de reproducción'),
  new SlashCommandBuilder().setName('help').setDescription('Muestra ayuda de comandos'),
  new SlashCommandBuilder()
    .setName('playlist_create')
    .setDescription('Crea una playlist')
    .addStringOption((option) => option.setName('name').setDescription('Nombre').setRequired(true)),
  new SlashCommandBuilder()
    .setName('playlist_list')
    .setDescription('Lista playlists'),
  new SlashCommandBuilder()
    .setName('playlist_add')
    .setDescription('Agrega track a playlist')
    .addStringOption((option) => option.setName('name').setDescription('Nombre playlist').setRequired(true))
    .addStringOption((option) => option.setName('query').setDescription('Búsqueda o URL').setRequired(true)),
  new SlashCommandBuilder()
    .setName('playlist_play')
    .setDescription('Reproduce una playlist')
    .addStringOption((option) => option.setName('name').setDescription('Nombre playlist').setRequired(true)),
  new SlashCommandBuilder()
    .setName('playlist_import')
    .setDescription('Importa tracks desde Spotify a una playlist')
    .addStringOption((option) => option.setName('name').setDescription('Nombre playlist').setRequired(true))
    .addStringOption((option) => option.setName('spotify_url').setDescription('URL o URI de Spotify').setRequired(true)),
  new SlashCommandBuilder()
    .setName('ticket_open')
    .setDescription('Abre un ticket')
    .addStringOption((option) => option.setName('title').setDescription('Título').setRequired(true)),
  new SlashCommandBuilder()
    .setName('ticket_list')
    .setDescription('Lista tickets')
    .addStringOption((option) =>
      option
        .setName('status')
        .setDescription('Filtro')
        .setRequired(false)
        .addChoices(
          { name: 'open', value: 'open' },
          { name: 'closed', value: 'closed' },
          { name: 'all', value: 'all' }
        )
    ),
  new SlashCommandBuilder()
    .setName('ticket_close')
    .setDescription('Cierra ticket por ID')
    .addIntegerOption((option) => option.setName('id').setDescription('ID ticket').setRequired(true)),
  new SlashCommandBuilder()
    .setName('emoji_add')
    .setDescription('Sube un emoji al servidor desde una URL')
    .addStringOption((option) => option.setName('name').setDescription('Nombre del emoji').setRequired(true))
    .addStringOption((option) => option.setName('url').setDescription('URL de imagen (png/jpg/gif/webp/avif)').setRequired(true)),
  new SlashCommandBuilder()
    .setName('emoji_delete')
    .setDescription('Elimina un emoji por nombre')
    .addStringOption((option) => option.setName('name').setDescription('Nombre del emoji').setRequired(true)),
  new SlashCommandBuilder()
    .setName('emoji_list')
    .setDescription('Lista los emojis personalizados del servidor'),
  new SlashCommandBuilder()
    .setName('emoji_app_list')
    .setDescription('Lista los emojis subidos en la aplicación'),
  new SlashCommandBuilder()
    .setName('emoji_use')
    .setDescription('Devuelve emoji de aplicación por nombre o fallback')
    .addStringOption((option) => option.setName('name').setDescription('Nombre del emoji app').setRequired(true))
    .addStringOption((option) => option.setName('fallback').setDescription('Texto/emote fallback').setRequired(false)),
].map((command) => command.toJSON());

async function main() {
  const rest = new REST({ version: '10' }).setToken(token);

  if (guildId) {
    console.log(`Registrando ${commands.length} comandos en guild ${guildId}...`);
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log('✅ Comandos slash de servidor registrados correctamente.');
    return;
  }

  console.log(`Registrando ${commands.length} comandos globales (puede tardar en aparecer)...`);
  await rest.put(
    Routes.applicationCommands(clientId),
    { body: commands }
  );
  console.log('✅ Comandos slash globales registrados correctamente.');
}

main().catch((error) => {
  console.error('❌ Error registrando comandos slash:', error);
  process.exit(1);
});
