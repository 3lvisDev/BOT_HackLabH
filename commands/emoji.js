const { PermissionsBitField } = require('discord.js');

const EMOJI_NAME_REGEX = /^[a-zA-Z0-9_]{2,32}$/;
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif'];

function hasEmojiManagePermission(member) {
  if (!member?.permissions?.has) return false;
  return member.permissions.has(
    PermissionsBitField.Flags.ManageGuildExpressions ||
    PermissionsBitField.Flags.ManageEmojisAndStickers
  );
}

function isLikelyEmojiAssetUrl(input) {
  try {
    const url = new URL(String(input || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const path = url.pathname.toLowerCase();
    return ALLOWED_EXTENSIONS.some((ext) => path.endsWith(ext));
  } catch {
    return false;
  }
}

async function createEmojiFromUrl(guild, name, assetUrl, authorId) {
  if (!EMOJI_NAME_REGEX.test(name)) {
    throw new Error('Nombre inválido. Usa 2-32 caracteres alfanuméricos o guion bajo.');
  }
  if (!isLikelyEmojiAssetUrl(assetUrl)) {
    throw new Error('URL inválida. Debe ser HTTP(S) y terminar en PNG/JPG/GIF/WEBP/AVIF.');
  }
  return guild.emojis.create({
    attachment: assetUrl,
    name,
    reason: `Emoji subido por ${authorId || 'usuario'}`
  });
}

function parseContentArg(content, command) {
  return content.slice(command.length + 1).trim();
}

function matches(content, names) {
  return names.some((name) => content.startsWith(`!${name}`) || content.startsWith(`.${name}`));
}

async function handleEmojiCommand(message) {
  if (!matches(message.content, ['emoji'])) return false;

  if (!hasEmojiManagePermission(message.member)) {
    await message.reply('Necesitas permiso **Gestionar emojis y stickers** para usar este comando.');
    return true;
  }

  const raw = parseContentArg(message.content, 'emoji');
  const [actionRaw, ...rest] = raw.split(' ');
  const action = (actionRaw || 'help').toLowerCase();

  if (action === 'add') {
    const name = (rest[0] || '').trim();
    const assetUrl = rest.slice(1).join(' ').trim();
    if (!name || !assetUrl) {
      await message.reply('Uso: `!emoji add <nombre> <url-imagen>`');
      return true;
    }
    try {
      const emoji = await createEmojiFromUrl(message.guild, name, assetUrl, message.author.id);
      await message.reply(`Emoji agregado: <:${emoji.name}:${emoji.id}>`);
    } catch (err) {
      await message.reply(`No se pudo agregar emoji: ${err.message}`);
    }
    return true;
  }

  if (action === 'delete' || action === 'remove') {
    const name = (rest[0] || '').trim();
    if (!name) {
      await message.reply('Uso: `!emoji delete <nombre>`');
      return true;
    }
    const emoji = message.guild.emojis.cache.find((item) => item.name === name);
    if (!emoji) {
      await message.reply('Emoji no encontrado en este servidor.');
      return true;
    }
    try {
      await emoji.delete(`Eliminado por ${message.author.id}`);
      await message.reply(`Emoji eliminado: **${name}**`);
    } catch (err) {
      await message.reply(`No se pudo eliminar emoji: ${err.message}`);
    }
    return true;
  }

  if (action === 'list') {
    const emojis = Array.from(message.guild.emojis.cache.values());
    if (!emojis.length) {
      await message.reply('Este servidor no tiene emojis personalizados.');
      return true;
    }
    const lines = emojis.slice(0, 50).map((emoji) => `${emoji.animated ? 'a' : 's'} • :${emoji.name}: • \`${emoji.id}\``);
    await message.reply(`Emojis del servidor (${emojis.length}):\n${lines.join('\n')}`);
    return true;
  }

  await message.reply(
    'Comandos emoji:\n' +
    '`!emoji add <nombre> <url-imagen>`\n' +
    '`!emoji delete <nombre>`\n' +
    '`!emoji list`'
  );
  return true;
}

module.exports = {
  handleEmojiCommand,
  hasEmojiManagePermission,
  isLikelyEmojiAssetUrl,
  createEmojiFromUrl,
  EMOJI_NAME_REGEX
};

