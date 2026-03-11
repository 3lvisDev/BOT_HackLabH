const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const axios = require('axios');
const crypto = require('crypto');
const db = require('./db');

function startDashboard(discordClient, setupCommunityLogic, applySmartRoles) {
  const app = express();
  const PORT = process.env.PORT || 3000;
  
  const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `http://localhost:${PORT}/api/auth/callback`;

  app.use(cors());
  app.use(express.json());
  
  app.use(session({
    secret: process.env.WEB_ADMIN_PASSWORD || crypto.randomBytes(20).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false,
      maxAge: 1000 * 60 * 60 * 24
    }
  }));

  app.use(express.static(path.join(__dirname, 'public')));

  const authMiddleware = (req, res, next) => {
    if (req.session && req.session.user) {
      next();
    } else {
      res.status(401).json({ error: 'No autorizado. Inicia sesión con Discord.' });
    }
  };

  // --- OAUTH2 DISCORD ROUTES ---
  app.get('/api/auth/discord', (req, res) => {
    if (!DISCORD_CLIENT_ID || !DISCORD_REDIRECT_URI) {
        return res.status(500).send("Las variables DISCORD_CLIENT_ID o DISCORD_REDIRECT_URI no están configuradas en .env");
    }
    const url = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(url);
  });

  app.get('/api/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send("No se proporcionó un código OAuth.");

    try {
      const params = new URLSearchParams();
      params.append('client_id', DISCORD_CLIENT_ID);
      params.append('client_secret', DISCORD_CLIENT_SECRET);
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      params.append('redirect_uri', DISCORD_REDIRECT_URI);

      const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      });

      const accessToken = tokenResponse.data.access_token;
      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      const discordUser = userResponse.data;
      const targetGuild = discordClient.guilds.cache.first();

      if (!targetGuild) return res.send("El bot no está en ningún servidor aún.");

      try {
        const member = await targetGuild.members.fetch(discordUser.id);
        const isAdmin = member.permissions.has('Administrator');
        const isOwner = targetGuild.ownerId === discordUser.id;

        if (isAdmin || isOwner) {
            req.session.user = {
                id: discordUser.id,
                username: discordUser.username,
                avatar: discordUser.avatar 
                  ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
                  : 'https://cdn.discordapp.com/embed/avatars/0.png'
            };
            res.redirect('/');
        } else {
            res.send("Acceso Denegado. No eres Admin.");
        }
      } catch (err) {
         res.send("No eres miembro del servidor.");
      }
    } catch (error) { res.status(500).send("Error autenticación."); }
  });

  app.get('/api/auth/me', (req, res) => {
      if (req.session && req.session.user) res.json({ authenticated: true, user: req.session.user });
      else res.status(401).json({ authenticated: false });
  });

  app.post('/api/logout', (req, res) => {
      req.session.destroy();
      res.json({ success: true });
  });

  app.post('/api/restart', authMiddleware, (req, res) => {
      res.json({ success: true });
      setTimeout(() => process.exit(0), 1000);
  });

  app.get('/api/status', authMiddleware, (req, res) => {
    res.json({
      online: true,
      botTag: discordClient.user.tag,
      botAvatar: discordClient.user.displayAvatarURL(),
      guildCount: discordClient.guilds.cache.size,
      userCount: discordClient.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0)
    });
  });

  app.get('/api/roles', authMiddleware, async (req, res) => {
    try {
        const guild = discordClient.guilds.cache.first();
        if (!guild) return res.json([]);
        const roles = guild.roles.cache
            .filter(r => r.name !== '@everyone' && !r.managed && !(r.name.includes("━━") || r.name.includes("══") || r.name.includes("---")))
            .sort((a, b) => b.position - a.position)
            .map(r => ({ id: r.id, name: r.name, color: r.hexColor }));
        res.json(roles);
    } catch (err) { 
        console.error("❌ [Dashboard] Error en /api/roles:", err);
        res.status(500).json({ error: 'Error' }); 
    }
  });

  app.get('/api/users', authMiddleware, async (req, res) => {
    try {
      const guild = discordClient.guilds.cache.first();
      if (!guild) {
        console.warn("⚠️ [Dashboard] No se encontró ninguna guild en la cache para /api/users.");
        return res.json([]);
      }
      
      console.log(`🔍 [Dashboard] Fetching members for: ${guild.name}`);
      const members = await guild.members.fetch();
      res.json(members.map(m => ({
        id: m.user.id,
        username: m.user.username,
        displayName: m.displayName,
        avatarUrl: m.user.displayAvatarURL({ size: 64 }),
        roles: m.roles.cache.filter(r => r.name !== '@everyone').map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
        isAdmin: m.permissions.has('Administrator'),
        isBot: m.user.bot
      })));
    } catch (err) { 
      console.error("❌ [Dashboard] Error en /api/users:", err);
      res.status(500).json({ error: 'Error' }); 
    }
  });

  app.get('/api/guild/channels', authMiddleware, async (req, res) => {
    try {
        const guild = discordClient.guilds.cache.first();
        if (!guild) {
            console.log("⚠️ [Dashboard] No se encontró ninguna guild en la cache.");
            return res.json([]);
        }

        console.log(`🔍 [Dashboard] Buscando canales para la guild: ${guild.name} (${guild.id})`);
        const channels = guild.channels.cache
            .filter(c => c.type === 0) // GuildText
            .map(c => ({ id: c.id, name: c.name }));
        
        console.log(`✅ [Dashboard] Encontrados ${channels.length} canales de texto.`);
        res.json(channels);
    } catch (err) { 
        console.error("❌ [Dashboard] Error en /api/guild/channels:", err);
        res.status(500).json({ error: 'Error' }); 
    }
  });

  app.post('/api/users/:userId/roles', authMiddleware, async (req, res) => {
      const { userId } = req.params;
      const { roleId, action } = req.body;
      try {
          const guild = discordClient.guilds.cache.first();
          const member = await guild.members.fetch(userId);
          const role = guild.roles.cache.get(roleId);
          if (action === 'add') await member.roles.add(role);
          else await member.roles.remove(role);
          setTimeout(() => applySmartRoles(member), 500);
          res.json({ success: true });
      } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/settings/welcome', authMiddleware, async (req, res) => {
      try {
          const guild = discordClient.guilds.cache.first();
          db.getSettings(guild.id, (err, row) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json(row || {
                  welcome_enabled: 0, welcome_channel: null, welcome_message: '¡Bienvenido {user} a {server}!',
                  goodbye_enabled: 0, goodbye_channel: null, goodbye_message: '{user} ha abandonado el servidor.'
              });
          });
      } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/settings/welcome', authMiddleware, async (req, res) => {
      const g = discordClient.guilds.cache.first();
      db.updateSettings(g.id, req.body, (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true });
      });
  });

  // --- Sistema de Logros (Achievements) ---
  app.get('/api/achievements', authMiddleware, async (req, res) => {
      try {
          const achievements = await db.getAllAchievements();
          res.json(achievements);
      } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/achievements', authMiddleware, async (req, res) => {
      try {
          await db.createAchievement(req.body);
          res.json({ success: true });
      } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/users/:userId/achievements', authMiddleware, async (req, res) => {
      try {
          const achievements = await db.getUserAchievements(req.params.userId);
          res.json(achievements);
      } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/setup', authMiddleware, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    const admins = (req.headers['x-admins'] || "").split(',').filter(Boolean);
    const mods = (req.headers['x-mods'] || "").split(',').filter(Boolean);
    const sendLog = (msg) => res.write(`data: ${JSON.stringify({ message: msg })}\n\n`);
    try {
      const guild = discordClient.guilds.cache.first();
      if (!admins.includes(guild.ownerId)) admins.push(guild.ownerId);
      await setupCommunityLogic(guild, sendLog, admins, mods);
      sendLog("✅ Proceso completado.");
    } catch (err) { sendLog(`❌ Error: ${err.message}`); }
    res.write('event: done\ndata: {}\n\n');
    res.end();
  });

  app.listen(PORT, () => console.log(`🌐 Dashboard en puerto ${PORT}`));
}

module.exports = { startDashboard };
