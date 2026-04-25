const db = require('../db');

function parse(messageContent) {
  const raw = String(messageContent || '').trim();
  if (!raw.match(/^(!|\.)ticket\b/i)) return null;

  const rest = raw.replace(/^(!|\.)ticket\s*/i, '').trim();
  const [subRaw, ...args] = rest.split(/\s+/);
  const sub = (subRaw || '').toLowerCase();

  return { sub, args, rest };
}

async function handleTicketCommand(message) {
  const parsed = parse(message.content);
  if (!parsed) return false;

  const guildId = message.guild?.id;
  if (!guildId) {
    await message.reply('Este comando solo funciona en servidores.');
    return true;
  }

  if (parsed.sub === 'open') {
    const title = parsed.args.join(' ').trim() || `Ticket de ${message.author.username}`;
    const ticket = await db.createTicket(guildId, message.author.id, title, null);
    await message.reply(`Ticket creado: #${ticket.id} - ${ticket.title}`);
    return true;
  }

  if (parsed.sub === 'list') {
    const status = (parsed.args[0] || 'open').toLowerCase();
    const filter = ['open', 'closed', 'all'].includes(status) ? status : 'open';
    const tickets = await db.getTickets(guildId, filter === 'all' ? null : filter);
    if (!tickets.length) {
      await message.reply('No hay tickets para ese filtro.');
      return true;
    }
    const lines = tickets.slice(0, 20).map((t) => `#${t.id} [${t.status}] ${t.title}`);
    await message.reply(lines.join('\n'));
    return true;
  }

  if (parsed.sub === 'close') {
    const id = Number(parsed.args[0]);
    if (!Number.isInteger(id) || id <= 0) {
      await message.reply('Uso: `!ticket close <id>`');
      return true;
    }
    const ticket = await db.closeTicket(guildId, id);
    if (!ticket) {
      await message.reply('Ticket no encontrado.');
      return true;
    }
    await message.reply(`Ticket #${id} cerrado.`);
    return true;
  }

  await message.reply('Uso: `!ticket open <título>` | `!ticket list [open|closed|all]` | `!ticket close <id>`');
  return true;
}

module.exports = {
  handleTicketCommand
};
