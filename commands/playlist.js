const db = require('../db');

function matches(content, names) {
    const value = String(content || '').trim();
    return names.some((name) => {
        const regex = new RegExp(`^([!.])${name}\\b`, 'i');
        return regex.test(value);
    });
}

function arg(content, command) {
    return content.slice(command.length + 1).trim();
}

async function handlePlaylistCommand(message, musicManager) {
    const isPersonal = matches(message.content, ['myplaylist', 'mypl']);
    const isGuild = matches(message.content, ['playlist', 'pl']);
    
    if (!isPersonal && !isGuild) return false;

    const usesFullCommand = message.content.startsWith('!playlist') || message.content.startsWith('.playlist') || message.content.startsWith('!myplaylist') || message.content.startsWith('.myplaylist');
    
    let commandName = 'pl';
    if (message.content.includes('playlist')) commandName = 'playlist';
    if (isPersonal) commandName = 'my' + commandName;

    const raw = arg(message.content, commandName);
    const [actionRaw, ...rest] = raw.split(' ');
    const action = (actionRaw || 'list').toLowerCase();
    const guildId = message.guild.id;
    const userId = message.author.id;

    if (action === 'list') {
        const playlists = isPersonal ? await db.getUserPlaylists(userId) : await db.getPlaylists(guildId);
        if (!playlists.length) {
            await message.reply(isPersonal ? 'No tienes playlists personales. Crea una con `.mypl create <nombre>`' : 'No hay playlists en el servidor.');
            return true;
        }
        const lines = playlists.map((p) => `• **${p.name}** (${p.item_count} tracks)`);
        await message.reply(isPersonal ? `Tus playlists personales:\n${lines.join('\n')}` : `Playlists del servidor:\n${lines.join('\n')}`);
        return true;
    }

    if (action === 'create') {
        const name = rest.join(' ').trim();
        if (!name) {
            await message.reply(`Uso: \`.${commandName} create <nombre>\``);
            return true;
        }
        try {
            if (isPersonal) {
                await db.createUserPlaylist(userId, name);
            } else {
                await db.createPlaylist(guildId, name, userId);
            }
            await message.reply(`Playlist creada: **${name}**`);
        } catch (err) {
            await message.reply(`No se pudo crear: ${err.message}`);
        }
        return true;
    }

    if (action === 'delete') {
        const name = rest.join(' ').trim();
        if (!name) {
            await message.reply(`Uso: \`.${commandName} delete <nombre>\``);
            return true;
        }
        const ok = isPersonal ? await db.deleteUserPlaylist(userId, name) : await db.deletePlaylist(guildId, name);
        await message.reply(ok ? `Playlist eliminada: **${name}**` : 'Playlist no encontrada.');
        return true;
    }

    if (action === 'add') {
        const remaining = rest.join(' ').trim();
        const sep = remaining.indexOf('|');
        if (sep === -1) {
            await message.reply(`Uso: \`.${commandName} add <playlist> | <query>\``);
            return true;
        }
        const name = remaining.slice(0, sep).trim();
        const query = remaining.slice(sep + 1).trim();
        
        try {
            const playlist = isPersonal ? await db.getUserPlaylistByName(userId, name) : await db.getPlaylistByName(guildId, name);
            if (!playlist) throw new Error('Playlist no encontrada.');
            
            const { position } = isPersonal ? await db.addUserPlaylistItem(playlist.id, query) : await db.addPlaylistItem(guildId, name, query, userId);
            await message.reply(`Agregado a **${name}** (#${position}): ${query}`);
        } catch (err) {
            await message.reply(`No se pudo agregar: ${err.message}`);
        }
        return true;
    }

    if (action === 'play') {
        const name = rest.join(' ').trim();
        if (!name) {
            await message.reply(`Uso: \`.${commandName} play <nombre>\``);
            return true;
        }
        const voiceChannel = message.member?.voice.channel;
        if (!voiceChannel) {
            await message.reply('Debes estar en un canal de voz.');
            return true;
        }
        
        const playlist = isPersonal ? await db.getUserPlaylistByName(userId, name) : await db.getPlaylistByName(guildId, name);
        if (!playlist) {
            await message.reply('Playlist no encontrada.');
            return true;
        }
        const items = isPersonal ? await db.getUserPlaylistItems(playlist.id) : await db.getPlaylistItems(playlist.id);
        if (!items.length) {
            await message.reply('Playlist vacía.');
            return true;
        }

        try {
            const added = await musicManager.enqueueMany(guildId, voiceChannel.id, items.map((i) => i.query));
            await message.reply(`Playlist **${name}** ${isPersonal ? 'personal ' : ''}encolada (${added.length} tracks).`);
        } catch (err) {
            await message.reply(`No se pudo reproducir: ${err.message}`);
        }
        return true;
    }

    // Fallback help
    const prefix = isPersonal ? '.mypl' : '.pl';
    await message.reply(
        `Comandos ${isPersonal ? 'personales' : 'del servidor'}:\n` +
        `\`${prefix} list\`\n\`${prefix} create <nombre>\`\n\`${prefix} add <playlist> | <query>\`\n` +
        `\`${prefix} play <playlist>\`\n\`${prefix} delete <playlist>\``
    );
    return true;
}

module.exports = { handlePlaylistCommand };
