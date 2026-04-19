const db = require('../db');

function matches(content, names) {
    return names.some((name) => content.startsWith(`!${name}`) || content.startsWith(`.${name}`));
}

function arg(content, command) {
    return content.slice(command.length + 1).trim();
}

async function handlePlaylistCommand(message, musicManager) {
    if (!matches(message.content, ['playlist', 'pl'])) return false;

    const usesFullCommand = message.content.startsWith('!playlist') || message.content.startsWith('.playlist');
    const raw = arg(message.content, usesFullCommand ? 'playlist' : 'pl');
    const [actionRaw, ...rest] = raw.split(' ');
    const action = (actionRaw || 'list').toLowerCase();
    const guildId = message.guild.id;

    if (action === 'list') {
        const playlists = await db.getPlaylists(guildId);
        if (!playlists.length) {
            await message.reply('No hay playlists aún. Crea una con `!playlist create <nombre>`');
            return true;
        }
        const lines = playlists.map((p) => `• **${p.name}** (${p.item_count} tracks)`);
        await message.reply(`Playlists del servidor:\n${lines.join('\n')}`);
        return true;
    }

    if (action === 'create') {
        const name = rest.join(' ').trim();
        if (!name) {
            await message.reply('Uso: `!playlist create <nombre>`');
            return true;
        }
        try {
            await db.createPlaylist(guildId, name, message.author.id);
            await message.reply(`Playlist creada: **${name}**`);
        } catch (err) {
            await message.reply(`No se pudo crear playlist: ${err.message}`);
        }
        return true;
    }

    if (action === 'delete') {
        const name = rest.join(' ').trim();
        if (!name) {
            await message.reply('Uso: `!playlist delete <nombre>`');
            return true;
        }
        const ok = await db.deletePlaylist(guildId, name);
        await message.reply(ok ? `Playlist eliminada: **${name}**` : 'Playlist no encontrada.');
        return true;
    }

    if (action === 'add') {
        const remaining = rest.join(' ').trim();
        const sep = remaining.indexOf('|');
        if (sep === -1) {
            await message.reply('Uso: `!playlist add <playlist> | <query/url>`');
            return true;
        }
        const name = remaining.slice(0, sep).trim();
        const query = remaining.slice(sep + 1).trim();
        if (!name || !query) {
            await message.reply('Uso: `!playlist add <playlist> | <query/url>`');
            return true;
        }
        try {
            const { position } = await db.addPlaylistItem(guildId, name, query, message.author.id);
            await message.reply(`Agregado a **${name}** (#${position}): ${query}`);
        } catch (err) {
            await message.reply(`No se pudo agregar track: ${err.message}`);
        }
        return true;
    }

    if (action === 'import') {
        const remaining = rest.join(' ').trim();
        const sep = remaining.indexOf('|');
        if (sep === -1) {
            await message.reply('Uso: `!playlist import <playlist> | <url-spotify>`');
            return true;
        }
        const name = remaining.slice(0, sep).trim();
        const spotifyUrl = remaining.slice(sep + 1).trim();
        if (!name || !spotifyUrl) {
            await message.reply('Uso: `!playlist import <playlist> | <url-spotify>`');
            return true;
        }

        const playlist = await db.getPlaylistByName(guildId, name);
        if (!playlist) {
            await message.reply('Playlist no encontrada. Crea una primero con `!playlist create <nombre>`');
            return true;
        }

        if (!musicManager || typeof musicManager.resolvePlayableQueries !== 'function') {
            await message.reply('El sistema de música no soporta importación en este entorno.');
            return true;
        }

        try {
            const queries = await musicManager.resolvePlayableQueries(spotifyUrl);
            if (!queries.length) {
                await message.reply('No se encontraron tracks para importar desde Spotify.');
                return true;
            }

            for (const query of queries) {
                await db.addPlaylistItem(guildId, name, query, message.author.id);
            }

            await message.reply(`Importados ${queries.length} tracks a **${name}**.`);
        } catch (err) {
            await message.reply(`No se pudo importar desde Spotify: ${err.message}`);
        }
        return true;
    }

    if (action === 'remove') {
        const name = rest[0];
        const index = Number(rest[1]);
        if (!name || !Number.isInteger(index) || index < 1) {
            await message.reply('Uso: `!playlist remove <playlist> <posición>`');
            return true;
        }
        try {
            const ok = await db.removePlaylistItem(guildId, name, index);
            await message.reply(ok ? `Track #${index} removido de **${name}**.` : 'No existe esa posición.');
        } catch (err) {
            await message.reply(`No se pudo remover: ${err.message}`);
        }
        return true;
    }

    if (action === 'show') {
        const name = rest.join(' ').trim();
        if (!name) {
            await message.reply('Uso: `!playlist show <nombre>`');
            return true;
        }
        const playlist = await db.getPlaylistByName(guildId, name);
        if (!playlist) {
            await message.reply('Playlist no encontrada.');
            return true;
        }
        const items = await db.getPlaylistItems(playlist.id);
        if (!items.length) {
            await message.reply(`**${name}** está vacía.`);
            return true;
        }
        await message.reply(`**${name}**\n${items.map((i) => `${i.position}. ${i.query}`).slice(0, 20).join('\n')}`);
        return true;
    }

    if (action === 'play') {
        const name = rest.join(' ').trim();
        if (!name) {
            await message.reply('Uso: `!playlist play <nombre>`');
            return true;
        }
        const voiceChannel = message.member?.voice.channel;
        if (!voiceChannel) {
            await message.reply('Debes estar en un canal de voz.');
            return true;
        }
        const playlist = await db.getPlaylistByName(guildId, name);
        if (!playlist) {
            await message.reply('Playlist no encontrada.');
            return true;
        }
        const items = await db.getPlaylistItems(playlist.id);
        if (!items.length) {
            await message.reply('Playlist vacía.');
            return true;
        }

        try {
            const added = await musicManager.enqueueMany(guildId, voiceChannel.id, items.map((i) => i.query));
            await message.reply(`Playlist **${name}** encolada (${added.length} tracks).`);
        } catch (err) {
            await message.reply(`No se pudo reproducir playlist: ${err.message}`);
        }
        return true;
    }

    await message.reply(
        'Comandos playlist:\n' +
        '`!playlist list`\n`!playlist create <nombre>`\n`!playlist add <playlist> | <query>`\n' +
        '`!playlist import <playlist> | <url-spotify>`\n' +
        '`!playlist remove <playlist> <posición>`\n`!playlist show <playlist>`\n`!playlist play <playlist>`\n`!playlist delete <playlist>`'
    );
    return true;
}

module.exports = { handlePlaylistCommand };
