const express = require('express');
const { buildGuildChannels } = require('./dashboard-guilds');
const { runAction } = require('./commands/automod');
const { resolveGuildLocale } = require('./utils/i18n');

/**
 * Inicia la API interna del Bot.
 * Esta API SOLO debe estar expuesta localmente (localhost o red de docker interna)
 * y es consumida por el Panel Web Service.
 */
function startInternalApi(client, setupCommunityLogic, applySmartRoles, musicManager) {
  const app = express();
  const PORT = process.env.INTERNAL_API_PORT || 9667;

  app.use(express.json());

  // Middleware de seguridad básico: solo permitir peticiones locales
  // En Docker, el panel enviará la petición desde la red interna
  app.use((req, res, next) => {
      // Opcional: Podrías añadir un token estático en las cabeceras para más seguridad
      next();
  });

  // 1. Estado General
  app.get('/internal/status', (req, res) => {
    res.json({
        online: true,
        botTag: client.user.tag,
        botAvatar: client.user.displayAvatarURL(),
        guildCount: client.guilds.cache.size,
        totalMemberCount: client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
    });
  });

  // 2. Información de Servidores (Guilds)
  app.get('/internal/guilds', (req, res) => {
      // Devuelve la lista de guilds en las que está el bot
      const guilds = Array.from(client.guilds.cache.values()).map(g => ({
          id: g.id,
          name: g.name,
          icon: g.icon,
          memberCount: g.memberCount,
          ownerId: g.ownerId
      }));
      res.json(guilds);
  });

  app.get('/internal/guilds/:guildId', async (req, res) => {
      const guild = client.guilds.cache.get(req.params.guildId);
      if (!guild) return res.status(404).json({ error: 'Guild no encontrada' });
      
      res.json({
          id: guild.id,
          name: guild.name,
          memberCount: guild.memberCount,
          ownerId: guild.ownerId
      });
  });

  // 3. Canales, Roles y Usuarios
  app.get('/internal/guilds/:guildId/channels', (req, res) => {
      const guild = client.guilds.cache.get(req.params.guildId);
      if (!guild) return res.status(404).json({ error: 'Guild no encontrada' });
      
      const channels = buildGuildChannels(guild);
      res.json(channels);
  });

  app.get('/internal/guilds/:guildId/roles', (req, res) => {
      const guild = client.guilds.cache.get(req.params.guildId);
      if (!guild) return res.status(404).json({ error: 'Guild no encontrada' });

      const roles = guild.roles.cache
            .filter(r => r.name !== '@everyone' && !r.managed && !(r.name.includes("━━") || r.name.includes("══") || r.name.includes("---")))
            .sort((a, b) => b.position - a.position)
            .map(r => ({ id: r.id, name: r.name, color: r.hexColor }));
      res.json(roles);
  });

  app.get('/internal/guilds/:guildId/members', async (req, res) => {
      const guild = client.guilds.cache.get(req.params.guildId);
      if (!guild) return res.status(404).json({ error: 'Guild no encontrada' });

      try {
          const members = await guild.members.fetch();
          const membersData = members.map(m => ({
            id: m.user.id,
            username: m.user.username,
            displayName: m.displayName,
            avatarUrl: m.user.displayAvatarURL({ size: 64 }),
            roles: m.roles.cache.filter(r => r.name !== '@everyone').map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
            isAdmin: m.permissions.has('Administrator'),
            isBot: m.user.bot
          }));
          res.json(membersData);
      } catch (err) {
          res.status(500).json({ error: err.message });
      }
  });

  app.post('/internal/guilds/:guildId/members/:userId/roles', async (req, res) => {
      const { guildId, userId } = req.params;
      const { roleId, action } = req.body;
      
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild no encontrada' });

      try {
          const member = await guild.members.fetch(userId);
          const role = guild.roles.cache.get(roleId);
          if (action === 'add') await member.roles.add(role);
          else await member.roles.remove(role);
          setTimeout(() => applySmartRoles(member), 500);
          res.json({ success: true });
      } catch (err) {
          res.status(500).json({ error: err.message });
      }
  });

  // 4. Música
  app.get('/internal/music/:guildId/status', (req, res) => {
      const status = musicManager.getStatus(req.params.guildId);
      res.json(status);
  });

  app.post('/internal/music/:guildId/resolve', async (req, res) => {
      try {
          const { query } = req.body;
          if (typeof musicManager.resolvePlayableQueries !== 'function') {
              return res.status(500).json({ error: 'resolvePlayableQueries no disponible' });
          }
          const queries = await musicManager.resolvePlayableQueries(query);
          res.json({ queries });
      } catch(err) {
          res.status(500).json({ error: err.message });
      }
  });

  app.post('/internal/music/:guildId/control', async (req, res) => {
      const { action, query, channelId, queries } = req.body;
      const guildId = req.params.guildId;

      try {
          if (action === 'play') {
              const result = await musicManager.play(guildId, channelId, query);
              return res.json({ success: true, result });
          }
          if (action === 'queue') {
              const result = await musicManager.enqueue(guildId, channelId, query);
              return res.json({ success: true, result });
          }
          if (action === 'enqueueMany') {
              const result = await musicManager.enqueueMany(guildId, channelId, queries);
              return res.json({ success: true, result });
          }
          if (action === 'pause') {
              const result = await musicManager.pause(guildId);
              return res.json({ success: true, result });
          }
          if (action === 'resume') {
              const result = await musicManager.resume(guildId);
              return res.json({ success: true, result });
          }
          if (action === 'skip') {
              const result = await musicManager.skip(guildId);
              return res.json({ success: true, result });
          }
          if (action === 'previous') {
              const result = await musicManager.previous(guildId);
              return res.json({ success: true, result });
          }
          if (action === 'stop') {
              await musicManager.stop(guildId);
              return res.json({ success: true });
          }
          res.status(400).json({ error: 'Acción inválida' });
      } catch (err) {
          res.status(400).json({ error: err.message });
      }
  });

  // 5. AutoMod
  app.post('/internal/automod/:guildId', async (req, res) => {
      const guildId = req.params.guildId;
      const { action, word, preset } = req.body;
      
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild no encontrada' });
      
      try {
          const locale = resolveGuildLocale(guild);
          const message = await runAction(guild, locale, { type: action, word, preset });
          res.json({ message });
      } catch(err) {
          res.status(400).json({ error: err.message });
      }
  });

  // 6. Setup Community
  app.post('/internal/setup/:guildId', async (req, res) => {
      const guildId = req.params.guildId;
      const { admins, mods } = req.body;
      
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild no encontrada' });
      
      try {
          // Dummy logger function for HTTP response
          const logger = (msg) => console.log(`[Setup] ${msg}`);
          await setupCommunityLogic(guild, logger, admins, mods);
          res.json({ success: true, message: 'Setup completado' });
      } catch(err) {
          res.status(500).json({ error: err.message });
      }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Internal API] Servidor interno corriendo en el puerto ${PORT}`);
  });
}

module.exports = { startInternalApi };
