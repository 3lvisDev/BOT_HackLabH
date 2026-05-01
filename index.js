const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });
const timestamp = () => new Date().toISOString();
console.log(`[${timestamp()}] [System] ConfiguraciÃ³n cargada. Puerto Dashboard: ${process.env.PORT || 3000}`);
console.log(`[${timestamp()}] [System] Token presente: ${process.env.DISCORD_TOKEN ? 'SÃ' : 'NO'}`);

// Polyfill for Node 18 environments required by @distube/ytdl-core/undici
const { Blob, File } = require('buffer');
if (!globalThis.Blob) globalThis.Blob = Blob;
if (!globalThis.File) {
    globalThis.File = File || class File extends globalThis.Blob {
        constructor(bits, name, options = {}) {
            super(bits, options);
            this.name = name;
            this.lastModified = options.lastModified || Date.now();
        }
    };
}

const { Client, GatewayIntentBits, Partials, ActivityType, PermissionsBitField, ChannelType } = require('discord.js');
const db = require('./db');
const { getGuildConfig, setGuildConfig } = db;
const { validateEnvironmentVariables } = require('./env-validator');
const { logSystemEvent } = require('./music/logger');
const { startInternalApi } = require('./internal-api');
const { applyBotPresence } = require('./utils/botProfile');
const { resolveInteractionLocale, t } = require('./utils/i18n');

// Validar variables de entorno al inicio
validateEnvironmentVariables();

// Manejadores globales de errores
process.on('unhandledRejection', (reason, promise) => {
  console.error('âŒ Unhandled Promise Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('âŒ Uncaught Exception:', error);
  process.exit(1);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const MusicManager = require('./music/MusicManager');
const musicManager = new MusicManager(client);

function formatQueueStatus(queue) {
    const lines = [];
    lines.push(`En reproducciÃ³n: **${queue.nowPlaying || 'Nada'}**`);

    if (queue.upcoming.length) {
        lines.push('Siguientes:');
        queue.upcoming.forEach((track, index) => {
            lines.push(`${index + 1}. ${track}`);
        });
    } else {
        lines.push('Cola vacÃ­a.');
    }

    lines.push(`Estado: **${queue.paused ? 'pausado' : 'reproduciendo'}**`);
    lines.push(`Total en cola: **${queue.total}**`);
    return lines.join('\n');
}

async function handleMusicSlashCommand(interaction) {
    const guildId = interaction.guildId;
    const command = interaction.commandName;
    const locale = resolveInteractionLocale(interaction);
    const voiceChannel = interaction.member?.voice?.channel;
    const status = musicManager.getStatus(guildId);

    const requireVoiceInSameChannel = async (actionText) => {
        if (!status.active) {
            await interaction.reply({ content: 'No hay ninguna reproducciÃ³n activa.', ephemeral: true });
            return false;
        }

        if (!voiceChannel || voiceChannel.id !== status.channelId) {
            await interaction.reply({
                content: `Debes estar en el canal de voz **${status.channelId}** para ${actionText}.`,
                ephemeral: true
            });
            return false;
        }
        return true;
    };

    if (command === 'play') {
        const queryRaw = interaction.options.getString('query', true);
        if (!voiceChannel) {
            await interaction.reply({ content: 'Debes estar en un canal de voz.', ephemeral: true });
            return;
        }

        let processingText = 'Buscando mÃºsicaâ€¦';
        if (queryRaw.includes('spotify.com/playlist') || queryRaw.includes('spotify.com/album')) {
            processingText = '🔍 Procesando Playlist de Spotify... Esto puede tardar varios segundos.';
        }
        await interaction.reply(processingText);
        try {
            const result = await musicManager.play(guildId, voiceChannel.id, queryRaw);
            await interaction.editReply(`Reproduciendo ahora: **${result.title}** en el canal **${result.channel}** â€¢ Radio ${result.radioEnabled ? 'activado' : 'desactivado'}`);
        } catch (err) {
            await interaction.editReply(`Error: ${err.message}`);
        }
        return;
    }

    if (command === 'stop') {
        if (!await requireVoiceInSameChannel('detener la mÃºsica')) return;
        try {
            await musicManager.stop(guildId);
            await interaction.reply('ReproducciÃ³n detenida y recursos liberados.');
        } catch (err) {
            await interaction.reply({ content: `Error al detener: ${err.message}`, ephemeral: true });
        }
        return;
    }

    if (command === 'skip' || command === 'next') {
        if (!await requireVoiceInSameChannel('saltar la mÃºsica')) return;
        try {
            const result = await musicManager.skip(guildId);
            if (result.hadQueue) {
                await interaction.reply(`Saltando canciÃ³nâ€¦ Siguiente: **${result.nextTrack || 'Cargandoâ€¦'}**`);
            } else {
                await interaction.reply('CanciÃ³n saltada. No hay mÃ¡s canciones en cola.');
            }
        } catch (err) {
            await interaction.reply({ content: `Error al saltar: ${err.message}`, ephemeral: true });
        }
        return;
    }

    if (command === 'previous') {
        if (!await requireVoiceInSameChannel('volver a la anterior')) return;
        try {
            const result = await musicManager.previous(guildId);
            await interaction.reply(`Volviendo a la anterior: **${result.track}**`);
        } catch (err) {
            await interaction.reply({ content: `Error al volver: ${err.message}`, ephemeral: true });
        }
        return;
    }

    if (command === 'pause') {
        if (!await requireVoiceInSameChannel('pausar')) return;
        try {
            const result = await musicManager.pause(guildId);
            await interaction.reply(`Pausado: **${result.currentTrack}**`);
        } catch (err) {
            await interaction.reply({ content: `Error al pausar: ${err.message}`, ephemeral: true });
        }
        return;
    }

    if (command === 'resume') {
        if (!await requireVoiceInSameChannel('reanudar')) return;
        try {
            const result = await musicManager.resume(guildId);
            await interaction.reply(`Reanudado: **${result.currentTrack}**`);
        } catch (err) {
            await interaction.reply({ content: `Error al reanudar: ${err.message}`, ephemeral: true });
        }
        return;
    }

    if (command === 'queue') {
        try {
            const queue = musicManager.getQueue(guildId, 10);
            await interaction.reply(formatQueueStatus(queue));
        } catch (err) {
            await interaction.reply({ content: `Error al leer cola: ${err.message}`, ephemeral: true });
        }
        return;
    }

    if (command === 'help') {
        await interaction.reply({
            ephemeral: true,
            content: t(locale, 'help_music')
        });
    }
}

async function handlePlaylistSlashCommand(interaction) {
    const db = require('./db');
    const guildId = interaction.guildId;
    const voiceChannel = interaction.member?.voice?.channel;
    const name = interaction.options.getString('name');

    if (interaction.commandName === 'playlist_create') {
        if (!name) {
            await interaction.reply({ content: 'Debes indicar nombre.', ephemeral: true });
            return true;
        }
        await db.createPlaylist(guildId, name, interaction.user.id);
        await interaction.reply(`Playlist creada: **${name}**`);
        return true;
    }

    if (interaction.commandName === 'playlist_list') {
        const playlists = await db.getPlaylists(guildId);
        if (!playlists.length) {
            await interaction.reply('No hay playlists aÃºn.');
            return true;
        }
        await interaction.reply(playlists.map((p) => `â€¢ **${p.name}** (${p.item_count} tracks)`).join('\n'));
        return true;
    }

    if (interaction.commandName === 'playlist_add') {
        if (!name) {
            await interaction.reply({ content: 'Debes indicar nombre.', ephemeral: true });
            return true;
        }
        const query = interaction.options.getString('query', true);
        const { position } = await db.addPlaylistItem(guildId, name, query, interaction.user.id);
        await interaction.reply(`Agregado a **${name}** (#${position})`);
        return true;
    }

    if (interaction.commandName === 'playlist_play') {
        if (!name) {
            await interaction.reply({ content: 'Debes indicar nombre.', ephemeral: true });
            return true;
        }
        if (!voiceChannel) {
            await interaction.reply({ content: 'Debes estar en un canal de voz.', ephemeral: true });
            return true;
        }
        const playlist = await db.getPlaylistByName(guildId, name);
        if (!playlist) {
            await interaction.reply({ content: 'Playlist no encontrada.', ephemeral: true });
            return true;
        }
        const items = await db.getPlaylistItems(playlist.id);
        if (!items.length) {
            await interaction.reply({ content: 'Playlist vacÃ­a.', ephemeral: true });
            return true;
        }
        await musicManager.enqueueMany(guildId, voiceChannel.id, items.map((i) => i.query));
        await interaction.reply(`Playlist **${name}** encolada (${items.length} tracks).`);
        return true;
    }

    if (interaction.commandName === 'playlist_import') {
        if (!name) {
            await interaction.reply({ content: 'Debes indicar nombre.', ephemeral: true });
            return true;
        }
        const spotifyUrl = interaction.options.getString('spotify_url', true);
        const playlist = await db.getPlaylistByName(guildId, name);
        if (!playlist) {
            await interaction.reply({ content: 'Playlist no encontrada.', ephemeral: true });
            return true;
        }
        if (!musicManager || typeof musicManager.resolvePlayableQueries !== 'function') {
            await interaction.reply({ content: 'Sistema de importaciÃ³n no disponible.', ephemeral: true });
            return true;
        }

        const queries = await musicManager.resolvePlayableQueries(spotifyUrl);
        if (!queries.length) {
            await interaction.reply({ content: 'No se encontraron tracks para importar.', ephemeral: true });
            return true;
        }

        for (const query of queries) {
            await db.addPlaylistItem(guildId, name, query, interaction.user.id);
        }

        await interaction.reply(`Importados ${queries.length} tracks en **${name}**.`);
        return true;
    }

    return false;
}

async function handleTicketSlashCommand(interaction) {
    const db = require('./db');
    const { ChannelType, PermissionsBitField } = require('discord.js');
    const guild = interaction.guild;

    if (interaction.commandName === 'ticket_open') {
        const title = interaction.options.getString('title', true);
        const channelName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90);
        const channel = await guild.channels.create({
            name: channelName || `ticket-${Date.now()}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                { id: guild.members.me.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }
            ]
        });
        const ticket = await db.createTicket(guild.id, interaction.user.id, title, channel.id);
        await interaction.reply(`Ticket creado: <#${channel.id}> (ID #${ticket.id})`);
        return true;
    }

    if (interaction.commandName === 'ticket_list') {
        const status = interaction.options.getString('status') || 'open';
        const tickets = await db.getTickets(guild.id, status === 'all' ? null : status);
        if (!tickets.length) {
            await interaction.reply('No hay tickets para ese filtro.');
            return true;
        }
        await interaction.reply(tickets.slice(0, 20).map((t) => `#${t.id} [${t.status}] ${t.title}`).join('\n'));
        return true;
    }

    if (interaction.commandName === 'ticket_close') {
        const id = interaction.options.getInteger('id', true);
        const ticket = await db.closeTicket(guild.id, id);
        if (!ticket) {
            await interaction.reply({ content: 'Ticket no encontrado.', ephemeral: true });
            return true;
        }
        await interaction.reply(`Ticket #${id} cerrado.`);
        return true;
    }

    return false;
}

async function handleEmojiSlashCommand(interaction) {
    const { createEmojiFromUrl, EMOJI_NAME_REGEX } = require('./commands/emoji');
    const { fetchApplicationEmojis, emojiOrFallback } = require('./utils/appEmojis');
    const guild = interaction.guild;

    const hasPermission = interaction.memberPermissions?.has(
        PermissionsBitField.Flags.ManageGuildExpressions || PermissionsBitField.Flags.ManageEmojisAndStickers
    );
    if (!hasPermission) {
        await interaction.reply({ content: 'Necesitas permiso **Gestionar emojis y stickers**.', ephemeral: true });
        return true;
    }

    if (interaction.commandName === 'emoji_add') {
        const name = interaction.options.getString('name', true).trim();
        const url = interaction.options.getString('url', true).trim();

        if (!EMOJI_NAME_REGEX.test(name)) {
            await interaction.reply({ content: 'Nombre invÃ¡lido. Usa 2-32 caracteres alfanumÃ©ricos o guion bajo.', ephemeral: true });
            return true;
        }

        try {
            const emoji = await createEmojiFromUrl(guild, name, url, interaction.user.id);
            await interaction.reply(`Emoji agregado: <:${emoji.name}:${emoji.id}>`);
        } catch (err) {
            await interaction.reply({ content: `No se pudo agregar emoji: ${err.message}`, ephemeral: true });
        }
        return true;
    }

    if (interaction.commandName === 'emoji_delete') {
        const name = interaction.options.getString('name', true).trim();
        const emoji = guild.emojis.cache.find((item) => item.name === name);
        if (!emoji) {
            await interaction.reply({ content: 'Emoji no encontrado en este servidor.', ephemeral: true });
            return true;
        }
        try {
            await emoji.delete(`Eliminado por ${interaction.user.id}`);
            await interaction.reply(`Emoji eliminado: **${name}**`);
        } catch (err) {
            await interaction.reply({ content: `No se pudo eliminar emoji: ${err.message}`, ephemeral: true });
        }
        return true;
    }

    if (interaction.commandName === 'emoji_list') {
        const emojis = Array.from(guild.emojis.cache.values());
        if (!emojis.length) {
            await interaction.reply('Este servidor no tiene emojis personalizados.');
            return true;
        }
        const lines = emojis.slice(0, 50).map((emoji) => `${emoji.animated ? 'a' : 's'} â€¢ :${emoji.name}: â€¢ \`${emoji.id}\``);
        await interaction.reply(`Emojis del servidor (${emojis.length}):\n${lines.join('\n')}`);
        return true;
    }

    if (interaction.commandName === 'emoji_app_list') {
        const appEmojis = await fetchApplicationEmojis(interaction.client);
        if (!appEmojis.length) {
            await interaction.reply('Tu aplicaciÃ³n no tiene emojis subidos todavÃ­a.');
            return true;
        }
        const lines = appEmojis.slice(0, 80).map((emoji) => `${emoji.animated ? 'a' : 's'} â€¢ :${emoji.name}: â€¢ \`${emoji.id}\``);
        await interaction.reply(`Emojis de la aplicaciÃ³n (${appEmojis.length}):\n${lines.join('\n')}`);
        return true;
    }

    if (interaction.commandName === 'emoji_use') {
        const name = interaction.options.getString('name', true).trim();
        const fallback = interaction.options.getString('fallback')?.trim() || 'âœ¨';
        const value = await emojiOrFallback(interaction.client, name, fallback);
        await interaction.reply(`Resultado: ${value}`);
        return true;
    }

    return false;
}

/**
 * FunciÃ³n auxiliar para reemplazar variables en los mensajes
 */
function replaceVars(msg, member) {
    if (!msg) return '';
    return msg
        .replace(/{user}/g, `<@${member.id}>`)
        .replace(/{server}/g, member.guild.name)
        .replace(/{count}/g, member.guild.memberCount);
}

/**
 * FunciÃ³n auxiliar para aplicar separadores de forma inteligente a un miembro.
 * Detecta roles decorativos (separadores) y los aÃ±ade/quita segÃºn los sub-roles del miembro.
 */
async function applySmartRoles(member) {
    if (member.user.bot) return;
    
    try {
        const guild = member.guild;
        // Obtenemos los roles ordenados
        const allRoles = guild.roles.cache.sort((a, b) => b.position - a.position);
        
        const separatorMap = new Map();
        const activeSeparators = new Set();
        let currentSeparatorId = null;

        // 1. Mapear la estructura actual del servidor
        for (const [roleId, role] of allRoles) {
            if (role.name === '@everyone' || role.managed) continue;

            if (role.name.includes("â”â”") || role.name.includes("â•â•") || role.name.includes("---")) {
                currentSeparatorId = role.id;
                activeSeparators.add(role.id);
            } else if (currentSeparatorId) {
                separatorMap.set(role.id, currentSeparatorId);
            }
        }

        // 2. Calcular quÃ© separadores NECESITA el miembro ahora mismo
        const currentRoleIds = Array.from(member.roles.cache.keys());
        const desiredSeparators = new Set();
        
        for (const roleId of currentRoleIds) {
            if (separatorMap.has(roleId)) {
                desiredSeparators.add(separatorMap.get(roleId));
            }
        }

        // 3. Filtrar de la lista actual todos los separadores que YA NO necesita
        // y asegurar que incluya los que SÃ necesita
        let finalRoleIds = currentRoleIds.filter(id => !activeSeparators.has(id));
        
        // ASEGURAR RANGO USUARIO si estÃ¡ en la DB
        const config = await getGuildConfig(guild.id);
        if (config && config.base_role_id && !finalRoleIds.includes(config.base_role_id)) {
            finalRoleIds.push(config.base_role_id);
        }

        for (const sepId of desiredSeparators) {
            finalRoleIds.push(sepId);
        }

        // 4. Comparar y aplicar cambios solo si es necesario
        const sortedCurrent = [...currentRoleIds].filter(id => id !== guild.id).sort().join(',');
        const sortedFinal = [...finalRoleIds].filter(id => id !== guild.id).sort().join(',');

        if (sortedCurrent !== sortedFinal) {
            console.log(`[SmartRoles] Actualizando separadores para ${member.user.tag}`);
            await member.roles.set(finalRoleIds);
        }
    } catch (err) {
        console.error(`Error en applySmartRoles para ${member.user.tag}:`, err.message);
    }
}

// FunciÃ³n centralizada para configurar la comunidad
async function setupCommunity(guild, logger = console.log, adminUserIds = [], modUserIds = []) {
  try {
    const botMember = await guild.members.fetch(client.user.id);
    
    if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
        throw new Error("El bot no tiene permisos de Administrador en este servidor.");
    }

    logger("âš™ï¸ Iniciando configuraciÃ³n de la comunidad de programaciÃ³n...");

    const botHighestRole = botMember.roles.highest;
    logger(`âš™ï¸ Mi rol mÃ¡s alto es: '${botHighestRole.name}' (PosiciÃ³n: ${botHighestRole.position})`);

    logger("âš™ï¸ Evaluando estructura actual de roles...");
    
    // Traer todos los roles ordenados por posiciÃ³n
    const allRoles = guild.roles.cache.sort((a, b) => b.position - a.position);
    
    // Encontrar roles con permisos de Administrador
    const adminRoles = allRoles.filter(role => role.permissions.has(PermissionsBitField.Flags.Administrator));
    
    // Buscar un rol base: 
    // 1. Intentar por nombres comunes primero (bÃºsqueda mÃ¡s estricta para evitar separadores)
    const commonBaseNames = ['usuario', 'miembro', 'member', 'programador', 'dev', 'verificado'];
    const candidates = allRoles.filter(role => {
        if (role.name === '@everyone' || role.managed) return false;
        // Evitar roles que parezcan separadores
        if (role.name.includes("â”â”") || role.name.includes("â•â•") || role.name.includes("---")) return false;
        
        const nameMatch = commonBaseNames.some(n => role.name.toLowerCase().includes(n));
        return nameMatch && !role.permissions.has(PermissionsBitField.Flags.Administrator);
    });

    // Tomamos el candidato con el ID mÃ¡s bajo (suele ser el mÃ¡s antiguo/base) o el primero si no hay criterio
    let baseRole = candidates.at(-1); 

    if (baseRole) {
        logger(`âš™ï¸ Rol base identificado por nombre: '${baseRole.name}'`);
    }

    // 2. Si no hay por nombre, buscar el que tenga permisos bÃ¡sicos de ver/hablar
    if (!baseRole) {
        baseRole = allRoles.find(role => {
            if (role.name === '@everyone' || role.managed) return false;
            if (role.permissions.has(PermissionsBitField.Flags.Administrator)) return false;
            
            const hasBasicPerms = role.permissions.has([
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages
            ]);
            return hasBasicPerms;
        });
    }

    if (!baseRole) {
        logger("âš™ï¸ No se detectÃ³ un rol base lÃ³gico. Creando rol 'Usuario BÃ¡sico'...");
        baseRole = await guild.roles.create({
            name: 'Usuario BÃ¡sico',
            color: '#a8b2c1',
            permissions: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak
            ],
            reason: 'Rol base creado por setup inteligente',
        });
    } else {
        logger(`âš™ï¸ Rol base detectado: '${baseRole.name}' (ID: ${baseRole.id})`);
    }

    // Buscar o usar un rol de Admin que ya exista
    let explicitAdminRole = allRoles.find(role => 
        role.name.toLowerCase().includes('admin') && 
        role.permissions.has(PermissionsBitField.Flags.Administrator)
    );

    if (!explicitAdminRole) {
      logger("âš™ï¸ No se encontrÃ³ un rol con nombre 'Admin'. Creando uno oficial...");
      explicitAdminRole = await guild.roles.create({
        name: 'Admin',
        color: '#E74C3C',
        permissions: [PermissionsBitField.Flags.Administrator],
        reason: 'Rol de administrador creado por setup automÃ¡tico',
      });
    } else {
        logger(`âš™ï¸ Rol Administrativo detectado y usado: '${explicitAdminRole.name}'`);
    }

    // Buscar o usar un rol de Moderador que ya exista
    let explicitModRole = allRoles.find(role => 
        role.name.toLowerCase().includes('mod') && 
        !role.permissions.has(PermissionsBitField.Flags.Administrator)
    );

    if (!explicitModRole) {
      logger("âš™ï¸ No se encontrÃ³ un rol de 'Moderador'. Creando uno...");
      explicitModRole = await guild.roles.create({
        name: 'Moderador',
        color: '#F1C40F',
        permissions: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageMessages,
            PermissionsBitField.Flags.KickMembers,
            PermissionsBitField.Flags.BanMembers,
            PermissionsBitField.Flags.ModerateMembers,
            PermissionsBitField.Flags.ManageNicknames
        ],
        reason: 'Rol de moderador creado por setup automÃ¡tico',
      });
    } else {
        logger(`âš™ï¸ Rol de ModeraciÃ³n detectado y usado: '${explicitModRole.name}'`);
    }

    if (botHighestRole.position <= baseRole.position) {
        logger(`âš ï¸ Â¡ALERTA! Mi rol '${botHighestRole.name}' estÃ¡ igual o por debajo del rol base '${baseRole.name}'. NO podrÃ© asignar roles a los usuarios hasta que subas mi rol en los Ajustes del Servidor.`);
    }

    // Guardar en la base de datos la configuraciÃ³n
    await setGuildConfig(guild.id, baseRole.id);

    // 1.5 LÃ³gica de Roles Separadores (CategorÃ­as Visuales)
    logger("âš™ï¸ Mapeando roles separadores (Ej. 'â”â” ðŸš» GÃ©neros â”â”')...");
    const separatorMap = new Map(); // Mapa de: subRoleId => separatorRoleId
    const activeSeparators = new Set(); // Conjunto de todos los IDs de roles separadores detectados
    
    let currentSeparatorId = null;
    
    // allRoles ya estÃ¡ ordenado por posiciÃ³n de mayor a menor (top to bottom)
    for (const [roleId, role] of allRoles) {
        // Detectar si es un separador heurÃ­sticamente (contiene â”â” o --- etc)
        // Ignoramos el everyone y los roles gestionados (bots)
        if (role.name === '@everyone' || role.managed) continue;

        if (role.name.includes("â”â”") || role.name.includes("â•â•") || role.name.includes("---")) {
            currentSeparatorId = role.id;
            activeSeparators.add(role.id);
            // console.log(`Separador detectado: ${role.name}`);
        } else if (currentSeparatorId) {
            // Este es un rol normal que estÃ¡ por debajo del Ãºltimo separador encontrado
            // Lo asociamos a ese separador
            separatorMap.set(role.id, currentSeparatorId);
        }
    }

    // 2. Asignar Roles de Admin explÃ­citos
    logger("âš™ï¸ Aplicando permisos de administrador y moderador...");
    // Convert array of string to actual Set for fast lookup
    const designatedAdminIds = new Set(adminUserIds);
    const designatedModIds = new Set(modUserIds);
    
    for (const userId of designatedAdminIds) {
      try {
        const member = await guild.members.fetch(userId);
        if (member) {
          await member.roles.add(explicitAdminRole);
        }
      } catch (err) {}
    }

    for (const userId of designatedModIds) {
      try {
        // Un Moderador no puede ser tambiÃ©n Admin para evitar conflictos lÃ³gicos visuales.
        if (designatedAdminIds.has(userId)) continue;
        const member = await guild.members.fetch(userId);
        if (member) {
          await member.roles.add(explicitModRole);
        }
      } catch (err) {}
    }

    // PequeÃ±o delay helper
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // 3. Evaluar y migrar a todos los miembros
    logger("âš™ï¸ Preparando la lista de miembros... (esto puede tardar en servidores grandes)");
    
    let allMembers;
    try {
        // Forzamos un fetch completo de miembros para asegurar que el cache no estÃ© vacÃ­o
        allMembers = await guild.members.fetch({ force: true });
        logger(`âš™ï¸ Â¡Ã‰xito! Se han obtenido ${allMembers.size} miembros.`);
    } catch(err) {
        logger(`âš ï¸ Error al obtener miembros con fetch: ${err.message}. Usando cachÃ© local...`);
        allMembers = guild.members.cache;
    }

    if (allMembers.size === 0) {
        logger("âŒ Error crÃ­tico: No se encontrÃ³ ningÃºn miembro para procesar.");
        throw new Error("No se pudo obtener la lista de miembros del servidor.");
    }

    logger(`âš™ï¸ Analizando y migrando a cada usuario...`);
    let processedCount = 0;
    let upToDateCount = 0;
    
    for (const [memberId, member] of allMembers) {
        if (member.user.bot) continue;
        processedCount++;

        const isDesignatedAdmin = designatedAdminIds.has(memberId);
        const isDesignatedMod = designatedModIds.has(memberId);
        const isServerOwner = memberId === guild.ownerId;
        const hasAdminRole = member.roles.cache.some(r => r.permissions.has(PermissionsBitField.Flags.Administrator));
        
        let rolesChanged = false;
        let originalRoleIds = Array.from(member.roles.cache.keys());

        // Array para calcular los roles finales
        // Empezamos con los roles que el usuario YA TIENE y filtramos los que no debe tener
        let targetRolesList = [];

        if (!isDesignatedAdmin && !isServerOwner && !hasAdminRole && !isDesignatedMod) {
            // USUARIO NORMAL: Aislamiento al rol base
            targetRolesList = originalRoleIds.filter(roleId => {
                const role = guild.roles.cache.get(roleId);
                if (!role) return false;
                if (roleId === guild.id) return false; // Ignorar everyone para el array final
                if (role.managed) return true; // Mantener roles de integraciÃ³n/bots
                if (roleId === baseRole.id) return true; // Mantener rol base obvio

                // Permitir mantener sub-roles "normales" que pertenecen a categorÃ­as
                // para que no pierdan la edad, ping, plataforma, etc.
                if (separatorMap.has(roleId)) return true;

                // Cualquier otro rol suelto que no es un sub-rol ni separador, lo quitamos por seguridad
                return false; 
            });
        } else {
           // ADMINS/MODS/OWNER: No les quitamos sus roles actuales pero les LIMPIAMOS el everyone si esta presente
           targetRolesList = originalRoleIds.filter(r => r !== guild.id);
        }

        // ASEGURAR RANGO USUARIO (Base Role) para TODOS (incluyendo Admins)
        if (!targetRolesList.includes(baseRole.id)) {
            targetRolesList.push(baseRole.id);
        }

        // ====== APLICAR LÃ“GICA DE SEPARADORES ======
        // 1. Limpiar todos los separadores que tiene actualmente de la lista objetivo
        targetRolesList = targetRolesList.filter(roleId => !activeSeparators.has(roleId));
        
        // 2. Por cada rol vÃ¡lido que le quedÃ³ al usuario, verificamos si pertenece a un separador.
        // Si es asÃ­, aÃ±adimos el separador a la lista (usando Set para no duplicar)
        const separatorsToAdd = new Set();
        for (const roleId of targetRolesList) {
            if (separatorMap.has(roleId)) {
                separatorsToAdd.add(separatorMap.get(roleId));
            }
        }

        // Agregar los separadores calculados a la lista final
        for (const sepId of separatorsToAdd) {
             targetRolesList.push(sepId);
        }

        // ====== ACTUALIZAR EN DISCORD SI HAY CAMBIOS ======
        // Obtenemos IDs limpios (sin @everyone) para comparar
        const currentClean = originalRoleIds.filter(id => id !== guild.id).sort();
        const targetClean = [...targetRolesList].sort();

        // LOG DE DEPURACIÃ“N PROFUNDO
        if (processedCount <= 10 || currentClean.join(',') !== targetClean.join(',')) {
            console.log(`[DEBUG] Member: ${member.user.tag} | Current: [${currentClean.join(',')}] | Target: [${targetClean.join(',')}]`);
        }

        // Si la lista de roles "limpios" es diferente, o si el usuario no tiene roles y deberÃ­a tener el base
        if (currentClean.join(',') !== targetClean.join(',')) {
            try {
                // Discord ignora @everyone en .set(), asÃ­ que pasamos solo el targetClean
                await member.roles.set(targetClean);
                rolesChanged = true;
                console.log(`[Setup] Confirmed Update for ${member.user.tag}`);
            } catch(err) {
                console.log(`[ERROR] No se pudo actualizar roles de ${member.user.tag}: ${err.message}`);
                logger(`   âŒ Error en ${member.user.tag}: ${err.message}`);
            }
        }

        if (rolesChanged) {
            logger(`   âœ… Usuario actualizado: ${member.user.tag}`);
            await delay(1200); // 1.2 segundos por usuario migrado
        } else {
            upToDateCount++;
        }
    }
    
    logger(`âš™ï¸ Resumen: ${processedCount} procesados, ${upToDateCount} ya estaban al dÃ­a.`);

    // 4. Crear Canales BÃ¡sicos de la Comunidad con Permisos Estrictos
    logger("âš™ï¸ Configurando reglas de permisos globales (jerarquÃ­a de rangos)...");
    
    // Configurar permisos base (jerarquÃ­a estricta)
    const strictOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.UseVAD,
          PermissionsBitField.Flags.RequestToSpeak,
          PermissionsBitField.Flags.Stream,
          PermissionsBitField.Flags.CreatePublicThreads,
          PermissionsBitField.Flags.CreatePrivateThreads,
          PermissionsBitField.Flags.SendMessagesInThreads
        ], // BLOQUEO TOTAL para los que no tienen rol
      },
      {
        id: baseRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.UseVAD,
          PermissionsBitField.Flags.UseEmbeddedActivities
        ],
      },
      {
        id: explicitModRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.MuteMembers,
          PermissionsBitField.Flags.DeafenMembers,
          PermissionsBitField.Flags.MoveMembers,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.UseVAD,
          PermissionsBitField.Flags.Stream
        ],
      },
      {
        id: explicitAdminRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.UseVAD,
          PermissionsBitField.Flags.Stream
        ],
      },
      {
        id: guild.members.me?.roles.highest.id || client.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ManageRoles,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.UseVAD,
          PermissionsBitField.Flags.Stream
        ]
      },
      {
        // El creador original siempre tiene max power, aunque Discord ya lo hace por defecto
        id: guild.ownerId,
        allow: [
            PermissionsBitField.Flags.Administrator,
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ManageChannels
        ]
      }
    ];

    logger("âš™ï¸ Aplicando permisos estrictos a TODOS los canales existentes...");
    for (const [channelId, channel] of guild.channels.cache) {
        try {
            // Solo modificamos canales de texto, voz, y categorÃ­as normales
            const isText = channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement;
            const isVoice = channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice;
            const isCategory = channel.type === ChannelType.GuildCategory;

            if (isText || isVoice || isCategory) {
               logger(`   - Procesando canal: ${channel.name} (${channel.type === ChannelType.GuildVoice ? 'Voz' : 'Texto/Cat'})`);
               await channel.permissionOverwrites.set(strictOverwrites);
               await delay(200); // Bajamos un poco el delay pero seguimos siendo cautos
            }
        } catch (err) {
            console.log(`No se pudo actualizar canal ${channel.name}: ${err.message}`);
        }
    }

    logger("âš™ï¸ Creando categorÃ­a y canales nuevos base si no existen...");
    let category = guild.channels.cache.find(c => c.name === 'Comunidad ProgramaciÃ³n' && c.type === ChannelType.GuildCategory);
    if (!category) {
      category = await guild.channels.create({
        name: 'Comunidad ProgramaciÃ³n',
        type: ChannelType.GuildCategory,
        permissionOverwrites: strictOverwrites
      });
    }

    const channelNames = [
      { name: 'general', type: ChannelType.GuildText },
      { name: 'ayuda-codigo', type: ChannelType.GuildText },
      { name: 'proyectos-showcase', type: ChannelType.GuildText },
      { name: 'Sala de Voz 1', type: ChannelType.GuildVoice },
    ];

    for (const ch of channelNames) {
      const exists = guild.channels.cache.find(c => c.name === ch.name && c.parentId === category.id);
      if (!exists) {
        await guild.channels.create({
          name: ch.name,
          type: ch.type,
          parent: category.id
          // Al estar dentro de la categorÃ­a, heredarÃ¡n los permisos categoryOverwrites automÃ¡ticamente
        });
      }
    }

    logger("âœ… Â¡ConfiguraciÃ³n completada con Ã©xito!");
    return true;

  } catch (error) {
    logger(`âŒ OcurriÃ³ un error: ${error.message}`);
    throw error;
  }
}

client.on('voiceStateUpdate', (oldState, newState) => {
    // 1. Manejo de Inactividad (Auto-Leave)
    musicManager.handleVoiceStateUpdate(oldState, newState).catch((err) => {
        console.error('[MusicManager] Error en handleVoiceStateUpdate:', err.message);
    });

    // 2. Manejo de Presencia
    if (newState.id === client.user.id) {
        console.log(`[System] VoiceStateUpdate para el bot: Canal ${newState.channelId}`);
        if (!newState.channelId) {
            applyBotPresence(client, { active: false });
        }
    }
});

client.once('ready', () => {
  console.log(`Bot iniciado como ${client.user.tag}`);
  logSystemEvent(null, 'info', `Bot online como ${client.user.tag}`);
  console.log('Esperando comando: .setup_community en canales o mediante el Dashboard Web.');
  applyBotPresence(client, { active: false });
  musicManager.recoverSessionsAfterRestart().catch((error) => {
    console.error('[MusicRecovery] Error restaurando sesiones tras reinicio:', error.message);
  });
  
  // Iniciar la API interna del Bot en lugar del Dashboard
  startInternalApi(client, setupCommunity, applySmartRoles, musicManager);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const normalizedContent = String(message.content || '').trim().toLowerCase();
  const isPrefixedCommand = normalizedContent.startsWith('.') || normalizedContent.startsWith('!');
  
  if (isPrefixedCommand) {
      console.log(`[${timestamp()}] [Message] Recibido: "${message.content}" de ${message.author.tag}`);
  }

  // Evitar errores por comandos en DM para módulos que requieren servidor.
  if (!message.guild && isPrefixedCommand) {
    const dmAllowed = /^([.!])(help|invite)\b/.test(normalizedContent);
    if (!dmAllowed) {
      await message.reply('Este comando solo funciona dentro de un servidor.');
      return;
    }
  }

  // --- Tracking de Logros ---
  try {
      const stats = await db.updateUserStats(message.author.id);
      const allAchievements = await db.getAllAchievements();
      const userEarned = await db.getUserAchievements(message.author.id);
      const earnedIds = new Set(userEarned.map(a => a.id));

      for (const achievement of allAchievements) {
          if (!earnedIds.has(achievement.id)) {
              if (achievement.milestone_type === 'messages' && stats.message_count >= achievement.milestone_value) {
                  await db.earnAchievement(message.author.id, achievement.id);
                  const embed = {
                      color: 0xffd700,
                      title: `${achievement.icon || 'ðŸ†'} Â¡Logro Desbloqueado!`,
                      description: `<@${message.author.id}> ha ganado el logro: **${achievement.name}**\n*${achievement.description}*`
                  };
                  message.channel.send({ embeds: [embed] });
              }
          }
      }
  } catch (err) { console.error("[Achievements] Error:", err); }

  if (message.content.startsWith('.setup_community')) {
    // Solo el creador del servidor original puede ejecutarlo por comando de texto
    if (!message.guild) {
      return message.reply('Este comando solo funciona dentro de un servidor.');
    }
    if (message.guild.ownerId !== message.author.id) {
      return message.reply("Solo el creador del servidor puede ejecutar este comando manualmente.");
    }

        const statusMessage = await message.reply("Iniciando...");

        // FunciÃ³n logger que edita el mensaje en Discord
        const discordLogger = async (msg) => {
          try {
            await statusMessage.edit(msg);
          } catch (e) {
            console.log(msg);
          }
        };

        try {
          // Pasamos al creador como el Ãºnico administrador por defecto si usa el comando
          await setupCommunity(message.guild, discordLogger, [message.author.id], []);
    } catch (err) {
      // El error ya fue logueado
    }
  }

  // --- Comandos de Ayuda ---
  const { handleHelpCommand } = require('./commands/help');
  try {
    if (await handleHelpCommand(message)) return;
  } catch (err) {
    console.error('[MessageCommands] Error en help:', err.message);
  }

  // --- Comandos de MÃºsica ---
  const { handleMusicCommand } = require('./commands/music');
  try {
    if (await handleMusicCommand(message, musicManager)) return;
  } catch (err) {
    console.error('[MessageCommands] Error en music:', err.message);
    if (isPrefixedCommand) await message.reply('Error ejecutando comando de música.');
    return;
  }

  // --- Comandos de Playlist ---
  const { handlePlaylistCommand } = require('./commands/playlist');
  try {
    if (await handlePlaylistCommand(message, musicManager)) return;
  } catch (err) {
    console.error('[MessageCommands] Error en playlist:', err.message);
    if (isPrefixedCommand) await message.reply('Error ejecutando comando de playlist.');
    return;
  }

  // --- Comandos de Tickets ---
  const { handleTicketCommand } = require('./commands/tickets');
  try {
    if (await handleTicketCommand(message)) return;
  } catch (err) {
    console.error('[MessageCommands] Error en tickets:', err.message);
    if (isPrefixedCommand) await message.reply('Error ejecutando comando de tickets.');
    return;
  }

  // --- Comandos de AutoMod ---
  const { handleAutomodCommand } = require('./commands/automod');
  try {
    if (await handleAutomodCommand(message)) return;
  } catch (err) {
    console.error('[MessageCommands] Error en automod:', err.message);
    if (isPrefixedCommand) await message.reply('Error ejecutando comando de automod.');
    return;
  }

  // --- Comandos de Emojis ---
  const { handleEmojiCommand } = require('./commands/emoji');
  try {
    if (await handleEmojiCommand(message)) return;
  } catch (err) {
    console.error('[MessageCommands] Error en emoji:', err.message);
    if (isPrefixedCommand) await message.reply('Error ejecutando comando de emoji.');
    return;
  }

  // --- Comando de InvitaciÃ³n ---
  if (/^([.!])invite\b/i.test(message.content)) {
      const { execute } = require('./commands/invite');
      try {
        return await execute(message);
      } catch (err) {
        console.error('[MessageCommands] Error en invite:', err.message);
        return await message.reply('Error ejecutando comando de invitación.');
      }
  }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const locale = resolveInteractionLocale(interaction);
    if (!interaction.inGuild()) {
        await interaction.reply({ content: t(locale, 'slash_guild_only'), ephemeral: true });
        return;
    }

    try {
        const command = interaction.commandName;
        if (['play', 'stop', 'skip', 'next', 'previous', 'pause', 'resume', 'queue', 'help', 'invite'].includes(command)) {
            if (command === 'invite') {
                const { execute } = require('./commands/invite');
                await execute(interaction);
                return;
            }
            await handleMusicSlashCommand(interaction);
            return;
        }
        if (command === 'myplaylist') {
            await handlePlaylistSlashCommand(interaction);
            return;
        }
        if (command.startsWith('playlist_')) {
            await handlePlaylistSlashCommand(interaction);
            return;
        }
        if (command.startsWith('ticket_')) {
            await handleTicketSlashCommand(interaction);
            return;
        }
        if (command.startsWith('emoji_')) {
            await handleEmojiSlashCommand(interaction);
            return;
        }
        if (command.startsWith('automod_')) {
            const { handleAutomodSlashCommand } = require('./commands/automod');
            await handleAutomodSlashCommand(interaction);
            return;
        }
        await interaction.reply({ content: t(locale, 'slash_unknown'), ephemeral: true });
    } catch (error) {
        console.error('[Slash] Error:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: t(locale, 'slash_error'), ephemeral: true });
        } else {
            await interaction.reply({ content: t(locale, 'slash_error'), ephemeral: true });
        }
    }
});

// Auto-rol al unirse usando DB y Mensaje de Bienvenida
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return;
    try {
        const config = await getGuildConfig(member.guild.id);
        
        // 1. AsignaciÃ³n de Rol Base
        let baseRole;
        if (config && config.base_role_id) {
            baseRole = member.guild.roles.cache.get(config.base_role_id);
        }

        if (baseRole) {
            await member.roles.add(baseRole);
            logSystemEvent(member.guild.id, 'info', `Auto-rol asignado a ${member.user.tag}`);
            console.log(`[AutoRole] Asignado '${baseRole.name}' a ${member.user.tag}`);
            setTimeout(() => applySmartRoles(member), 3000);
        }

        // 2. Mensaje de Bienvenida (MEE6 style)
        const welcome = await db.getSettings(member.guild.id);
        if (welcome && welcome.welcome_enabled && welcome.welcome_channel) {
            const channel = member.guild.channels.cache.get(welcome.welcome_channel);
            if (channel) {
                await channel.send(replaceVars(welcome.welcome_message, member));
            }
        }
    } catch(err) {
        console.error("[Event:Add] Error crÃ­tico:", err.message);
    }
});

// Mensaje de Despedida
client.on('guildMemberRemove', async (member) => {
    if (member.user.bot) return;
    try {
        const settings = await db.getSettings(member.guild.id);
        if (settings && settings.goodbye_enabled && settings.goodbye_channel) {
            const channel = member.guild.channels.cache.get(settings.goodbye_channel);
            if (channel) {
                await channel.send(replaceVars(settings.goodbye_message, member));
            }
        }
    } catch (err) {
        console.error("[Event:Remove] Error:", err.message);
    }
});

// Listener para cambios de roles manuales o por otros bots
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    // Si la lista de roles ha cambiado, recalculamos separadores
    if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
        // Log para ver cambios en consola del panel
        console.log(`[Update] Cambio de roles detectado en ${newMember.user.tag}. Recalculando separadores...`);
        // PequeÃ±o debounce/espera para dejar que terminen otros procesos
        setTimeout(() => applySmartRoles(newMember), 4000);
    }
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error(`\nâŒ Error al conectar a Discord: ${err.message}`);
  console.error(`\nVerifica que tu DISCORD_TOKEN sea vÃ¡lido.`);
  console.error(`Si estÃ¡s usando Docker, asegÃºrate de pasar la variable:`);
  console.error(`  docker run -e DISCORD_TOKEN=tu_token ...\n`);
  process.exit(1);
});

module.exports = { client, setupCommunity, applySmartRoles };





