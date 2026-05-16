function parseCommand(content) {
  const text = String(content || '').trim();
  const match = text.match(/^([!.])(play|radio|stop|skip|next|previous|pause|resume|queue|musicstats)\b\s*(.*)$/i);
  if (!match) return null;
  return {
    prefix: match[1],
    command: match[2].toLowerCase(),
    args: (match[3] || '').trim()
  };
}

function formatQueueStatus(queue) {
  const lines = [];
  lines.push(`En reproducción: **${queue.nowPlaying || 'Nada'}**`);
  if (queue.upcoming.length) {
    lines.push('Siguientes:');
    queue.upcoming.forEach((track, index) => lines.push(`${index + 1}. ${track}`));
  } else {
    lines.push('Cola vacía.');
  }
  lines.push(`Estado: **${queue.paused ? 'pausado' : 'reproduciendo'}**`);
  lines.push(`Total en cola: **${queue.total}**`);
  return lines.join('\n');
}

module.exports = {
  handleMusicCommand: async (message, musicManager) => {
    const parsed = parseCommand(message.content);
    if (!parsed) return false;

    const guildId = message.guild?.id;
    if (!guildId) {
      await message.reply('Este comando solo funciona en servidores.');
      return true;
    }

    const voiceChannel = message.member?.voice?.channel;
    const status = musicManager.getStatus(guildId);

    const requireVoiceInSameChannel = async (actionText) => {
      if (!status.active) {
        await message.reply('No hay ninguna reproducción activa.');
        return false;
      }
      if (!voiceChannel || voiceChannel.id !== status.channelId) {
        await message.reply(`Debes estar en el canal de voz **${status.channelId}** para ${actionText}.`);
        return false;
      }
      return true;
    };

    try {
      if (parsed.command === 'play') {
        if (!parsed.args) {
          await message.reply('Uso: `!play <nombre de canción o link>`');
          return true;
        }
        if (!voiceChannel) {
          await message.reply('Debes estar en un canal de voz.');
          return true;
        }

        let processingText = 'Buscando musica...';
        if (parsed.args.includes('spotify.com/playlist') || parsed.args.includes('spotify.com/album')) {
          processingText = '🔍 Procesando Playlist de Spotify... Esto puede tardar varios segundos.';
        }
        const processingMsg = await message.reply(processingText);
        const result = await musicManager.play(guildId, voiceChannel.id, parsed.args, { requesterId: message.author?.id });
        await processingMsg.edit(`Reproduciendo ahora: **${result.title}** en el canal **${result.channel}** • Radio ${result.radioEnabled ? 'activado' : 'desactivado'}`);
        return true;
      }

      if (parsed.command === 'radio') {
        const raw = (parsed.args || '').trim();
        const mode = musicManager.getRadioMode(guildId);
        const lowerRaw = raw.toLowerCase();

        if (!raw || lowerRaw === 'status') {
          await message.reply(`📻 Radio ${mode.enabled ? 'activada' : 'desactivada'}${mode.genre ? ` • Semilla: **${mode.genre}**` : ''}`);
          return true;
        }

        if (lowerRaw === 'off') {
          await musicManager.setRadioMode(guildId, false);
          await message.reply('🛑 Radio desactivada.');
          return true;
        }

        if (!voiceChannel) {
          await message.reply('Debes estar en un canal de voz.');
          return true;
        }

        const genre = lowerRaw === 'on' ? mode.genre : raw;
        if (genre) {
          await musicManager.setRadioGenre(guildId, genre);
        }
        const nextMode = await musicManager.setRadioMode(guildId, true);
        const seed = nextMode.genre || genre || 'mix variado';
        await message.reply(`✅ Radio activada con semilla **${seed}**.`);
        return true;
      }

      if (parsed.command === 'stop') {
        if (!await requireVoiceInSameChannel('detener la música')) return true;
        await musicManager.stop(guildId);
        await message.reply('Reproducción detenida y recursos liberados.');
        return true;
      }

      if (parsed.command === 'skip' || parsed.command === 'next') {
        if (!await requireVoiceInSameChannel('saltar la música')) return true;
        const result = await musicManager.skip(guildId);
        await message.reply(result.hadQueue
          ? `Saltando canción… Siguiente: **${result.nextTrack || 'Cargando…'}**`
          : 'Canción saltada. No hay más canciones en cola.');
        return true;
      }

      if (parsed.command === 'previous') {
        if (!await requireVoiceInSameChannel('volver a la anterior')) return true;
        const result = await musicManager.previous(guildId);
        await message.reply(`Volviendo a la anterior: **${result.track}**`);
        return true;
      }

      if (parsed.command === 'pause') {
        if (!await requireVoiceInSameChannel('pausar')) return true;
        const result = await musicManager.pause(guildId);
        await message.reply(`Pausado: **${result.currentTrack}**`);
        return true;
      }

      if (parsed.command === 'resume') {
        if (!await requireVoiceInSameChannel('reanudar')) return true;
        const result = await musicManager.resume(guildId);
        await message.reply(`Reanudado: **${result.currentTrack}**`);
        return true;
      }

      if (parsed.command === 'queue') {
        const queue = musicManager.getQueue(guildId, 10);
        await message.reply(formatQueueStatus(queue));
        return true;
      }

      if (parsed.command === 'musicstats') {
        const axios = require('axios');
        const baseUrl = String(process.env.MUSIC_MEMORY_URL || '').trim();
        if (!baseUrl) {
          await message.reply('Music Memory no esta configurado.');
          return true;
        }

        const [seed, artist, track] = await Promise.all([
          axios.get(`${baseUrl}/v1/stats/top`, { params: { scope: 'guild', type: 'seed', guild_id: guildId, limit: 3 }, timeout: 1500 }),
          axios.get(`${baseUrl}/v1/stats/top`, { params: { scope: 'guild', type: 'artist', guild_id: guildId, limit: 3 }, timeout: 1500 }),
          axios.get(`${baseUrl}/v1/stats/top`, { params: { scope: 'guild', type: 'track', guild_id: guildId, limit: 3 }, timeout: 1500 })
        ]);

        const fmt = (arr) => (arr?.length ? arr.map((x, i) => `${i + 1}. ${x.label} (${x.plays})`).join('\n') : 'Sin datos');
        await message.reply(
          `📊 Top musical del servidor\n\n` +
          `🎯 Seeds:\n${fmt(seed.data.items)}\n\n` +
          `🎤 Artistas:\n${fmt(artist.data.items)}\n\n` +
          `🎵 Canciones:\n${fmt(track.data.items)}`
        );
        return true;
      }
    } catch (err) {
      await message.reply(`Error: ${err.message}`);
      return true;
    }

    return false;
  }
};
