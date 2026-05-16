const { PermissionsBitField } = require('discord.js');
const { fetchApplicationEmojis, emojiOrFallback } = require('../utils/appEmojis');

const EMOJI_NAME_REGEX = /^[a-zA-Z0-9_]{2,32}$/;
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif'];
const MAX_EMOJI_SIZE_BYTES = 256 * 1024;

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

function isValidAttachmentForEmoji(attachment) {
  if (!attachment) return false;
  const contentType = String(attachment.contentType || '').toLowerCase();
  const url = String(attachment.url || '');
  const hasImageType = contentType.startsWith('image/');
  const hasValidExt = isLikelyEmojiAssetUrl(url);
  const size = Number(attachment.size || 0);
  const hasValidSize = size > 0 ? size <= MAX_EMOJI_SIZE_BYTES : true;
  return (hasImageType || hasValidExt) && hasValidSize;
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

async function createEmojiFromAttachment(guild, name, attachment, authorId) {
  if (!EMOJI_NAME_REGEX.test(name)) {
    throw new Error('Nombre inválido. Usa 2-32 caracteres alfanuméricos o guion bajo.');
  }
  if (!isValidAttachmentForEmoji(attachment)) {
    throw new Error('Adjunto inválido. Debe ser imagen permitida y de máximo 256KB.');
  }
  return guild.emojis.create({
    attachment: attachment.url,
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

  if (action === 'addfile') {
    const name = (rest[0] || '').trim();
    const attachment = message.attachments?.first ? message.attachments.first() : null;
    if (!name || !attachment) {
      await message.reply('Uso: `!emoji addfile <nombre>` adjuntando una imagen.');
      return true;
    }
    try {
      const emoji = await createEmojiFromAttachment(message.guild, name, attachment, message.author.id);
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

  if (action === 'app_list') {
    try {
      const appEmojis = await fetchApplicationEmojis(message.client);
      if (!appEmojis.length) {
        await message.reply('Tu aplicación no tiene emojis subidos todavía.');
        return true;
      }
      const lines = appEmojis.slice(0, 80).map((emoji) => `${emoji.animated ? 'a' : 's'} • :${emoji.name}: • \`${emoji.id}\``);
      await message.reply(`Emojis de la aplicación (${appEmojis.length}):\n${lines.join('\n')}`);
    } catch (err) {
      await message.reply(`No se pudo listar emojis de la app: ${err.message}`);
    }
    return true;
  }

  if (action === 'use') {
    const name = (rest[0] || '').trim();
    const fallback = (rest[1] || '✨').trim();
    if (!name) {
      await message.reply('Uso: `!emoji use <nombre> [fallback]`');
      return true;
    }
    try {
      const value = await emojiOrFallback(message.client, name, fallback);
      await message.reply(`Resultado: ${value}`);
    } catch (err) {
      await message.reply(`No se pudo resolver emoji: ${err.message}`);
    }
    return true;
  }

  if (action === 'uploadpack') {
    const profile = (rest[0] || '').trim();
    if (!profile) {
      await message.reply('Uso: `!emoji uploadpack <perfil>` (ej: `!emoji uploadpack fun`)');
      return true;
    }

    const fs = require('fs');
    const path = require('path');
    const packDir = path.join(__dirname, '..', 'assets', 'emojis', `${profile}_pack`);
    
    if (!fs.existsSync(packDir)) {
      await message.reply(`La carpeta del pack no existe: \`${profile}_pack\`\nAsegúrate de descargarla primero.`);
      return true;
    }

    const files = fs.readdirSync(packDir).filter(f => ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif'].some(ext => f.toLowerCase().endsWith(ext)));
    if (files.length === 0) {
      await message.reply('No se encontraron imágenes en el pack.');
      return true;
    }

    const statusMsg = await message.reply(`Encontrados **${files.length}** emojis en el pack '${profile}'.\nComenzando subida global a la Aplicación (App Emojis)...`);
    
    let success = 0;
    let failed = 0;

    for (const file of files) {
      try {
        const filePath = path.join(packDir, file);
        const name = file.replace(/\.[^/.]+$/, "");
        
        await message.client.application.emojis.create({
          attachment: filePath,
          name: name
        });
        success++;
        // Retraso para evitar rate limits fuertes de Discord
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (success % 10 === 0) {
          await statusMsg.edit(`Subiendo pack '${profile}'... Progreso: ${success}/${files.length}`);
        }
      } catch (err) {
        failed++;
        console.error(`Failed to upload ${file}:`, err);
      }
    }

    await statusMsg.edit(`✅ Subida de pack '${profile}' completada.\nÉxito: **${success}** | Fallidos: **${failed}**`);
    return true;
  }

  await message.reply(
    'Comandos emoji:\n' +
    '`!emoji add <nombre> <url-imagen>`\n' +
    '`!emoji addfile <nombre>` (adjunta imagen)\n' +
    '`!emoji delete <nombre>`\n' +
    '`!emoji list` / `!emoji app_list`\n' +
    '`!emoji use <nombre> [fallback]`\n' +
    '`!emoji uploadpack <perfil>` (Batch upload)'
  );
  return true;
}

module.exports = {
  handleEmojiCommand,
  hasEmojiManagePermission,
  isLikelyEmojiAssetUrl,
  createEmojiFromUrl,
  createEmojiFromAttachment,
  EMOJI_NAME_REGEX,
  isValidAttachmentForEmoji,
  MAX_EMOJI_SIZE_BYTES
};
