const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const axios = require('axios');
const crypto = require('crypto');

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
      secure: false, // In production with HTTPS, change to true
      maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
  }));

  // Servir archivos estáticos del frontend
  app.use(express.static(path.join(__dirname, 'public')));

  // Middleware para verificar la sesión
  const authMiddleware = (req, res, next) => {
    // Para endpoints SSE aseguramos que reconozca la cookie
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
      // 1. Intercambiar código por token
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

      // 2. Obtener identidad del usuario
      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      const discordUser = userResponse.data;
      const targetGuild = discordClient.guilds.cache.first();

      if (!targetGuild) {
        return res.send("El bot no está en ningún servidor aún. Invítalo primero.");
      }

      // 3. Verificar si es administrador en el servidor
      try {
        const member = await targetGuild.members.fetch(discordUser.id);
        const isAdmin = member.permissions.has('Administrator');
        
        // El dueño del servidor siempre es admin
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
            res.send("<h1>Acceso Denegado</h1><p>No tienes el rol de Administrador en el servidor.</p><a href='/'>Volver al inicio</a>");
        }
      } catch (err) {
         console.error("Error buscando miembro en guild:", err);
         res.send("<h1>Acceso Denegado</h1><p>No parece que seas miembro del servidor donde está el bot.</p><a href='/'>Volver al inicio</a>");
      }

    } catch (error) {
      console.error("Error en OAuth2:", error.response ? error.response.data : error.message);
      res.status(500).send("Error de autenticación con Discord.");
    }
  });

  app.get('/api/auth/me', (req, res) => {
      if (req.session && req.session.user) {
          res.json({ authenticated: true, user: req.session.user });
      } else {
          res.status(401).json({ authenticated: false });
      }
  });

  app.post('/api/logout', (req, res) => {
      req.session.destroy();
      res.json({ success: true });
  });

  app.post('/api/restart', authMiddleware, (req, res) => {
      res.json({ success: true, message: 'Reiniciando el bot. Por favor, espera...' });
      
      console.log('🤖 Reinicio solicitado desde el panel web. Saliendo...');
      
      // Damos un pequeño respiro para que la request de red termine antes de matar el proceso
      setTimeout(() => {
          process.exit(0);
      }, 1000);
  });

  // Endpoint de Estado del Bot
  app.get('/api/status', authMiddleware, (req, res) => {
    const guildCount = discordClient.guilds.cache.size;
    const userCount = discordClient.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

    res.json({
      online: true,
      botTag: discordClient.user.tag,
      botAvatar: discordClient.user.displayAvatarURL(),
      guildCount,
      userCount
    });
  });

  // Endpoint para obtener todos los ROLES del servidor (ignorando @everyone y roles de bots)
  app.get('/api/roles', authMiddleware, async (req, res) => {
    try {
        const targetGuild = discordClient.guilds.cache.first();
        if (!targetGuild) return res.json([]);

        const roles = targetGuild.roles.cache
            .filter(r => {
                const isSeparator = r.name.includes("━━") || r.name.includes("══") || r.name.includes("---");
                return r.name !== '@everyone' && !r.managed && !isSeparator;
            })
            .sort((a, b) => b.position - a.position)
            .map(r => ({
                id: r.id,
                name: r.name,
                color: r.hexColor,
                position: r.position
            }));
        
        res.json(roles);
    } catch (err) {
        res.status(500).json({ error: 'Error obteniendo roles' });
    }
  });

  // Endpoint para obtener usuarios DETALLADOS (incluyendo sus roles)
  app.get('/api/users', authMiddleware, async (req, res) => {
    try {
      const targetGuild = discordClient.guilds.cache.first();
      if (!targetGuild) return res.json([]);

      const members = await targetGuild.members.fetch();
      
      const usersList = members.map(m => ({
        id: m.user.id,
        username: m.user.username,
        displayName: m.displayName,
        avatarUrl: m.user.displayAvatarURL({ size: 64 }),
        roles: m.roles.cache
            .filter(r => {
                const isSeparator = r.name.includes("━━") || r.name.includes("══") || r.name.includes("---");
                return r.name !== '@everyone' && !isSeparator;
            })
            .map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
        joinedAt: m.joinedAt,
        isAdmin: m.permissions.has('Administrator'),
        isBot: m.user.bot
      }));

      res.json(usersList);
    } catch (err) {
      console.error("Error obteniendo usuarios:", err);
      res.status(500).json({ error: 'Error interno obteniendo usuarios' });
    }
  });

  // Endpoint para GESTIONAR ROLES de un usuario específico
  app.post('/api/users/:userId/roles', authMiddleware, async (req, res) => {
      const { userId } = req.params;
      const { roleId, action } = req.body; // action: 'add' o 'remove'
      
      try {
          const targetGuild = discordClient.guilds.cache.first();
          const member = await targetGuild.members.fetch(userId);
          const role = targetGuild.roles.cache.get(roleId);

          if (!member || !role) return res.status(404).json({ error: 'Miembro o Rol no encontrado' });

          if (action === 'add') {
              await member.roles.add(role);
          } else {
              await member.roles.remove(role);
          }

          // Trigger automated separator update
          setTimeout(() => applySmartRoles(member), 500);

          res.json({ success: true });
      } catch (err) {
          console.error("Error gestionando rol:", err);
          res.status(500).json({ error: err.message });
      }
  });

  // Endpoint para ejecutar el Setup de la Comunidad
  app.post('/api/setup', authMiddleware, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Obtener admins y mods del cuerpo de la petición mediante headers customizados
    const adminsParam = req.headers['x-admins'] || "";
    const customAdmins = adminsParam.split(',').filter(Boolean);
    
    const modsParam = req.headers['x-mods'] || "";
    const customMods = modsParam.split(',').filter(Boolean);
    
    const sendLog = (msg) => {
      res.write(`data: ${JSON.stringify({ message: msg })}\n\n`);
    };

    try {
      // El servidor primero en el que está el bot.
      let targetGuild = discordClient.guilds.cache.first();

      if (!targetGuild) {
         sendLog("❌ Error: El bot no está en ningún servidor. Por favor invítalo primero.");
         return res.write('event: done\ndata: {}\n\n');
      }

      sendLog(`Detectado servidor objetivo: ${targetGuild.name}`);
      
      // Asegurar que el dueño del servidor siempre sea admin
      if (!customAdmins.includes(targetGuild.ownerId)) {
          customAdmins.push(targetGuild.ownerId);
      }

      await setupCommunityLogic(targetGuild, sendLog, customAdmins, customMods);
      
      sendLog("✅ Proceso completado exitosamente.");
    } catch (err) {
      sendLog(`❌ Error crítico: ${err.message}`);
    }

    res.write('event: done\ndata: {}\n\n');
    res.end();
  });

  app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🌐 PANEL WEB DISPONIBLE: http://localhost:${PORT}`);
    console.log(`=========================================`);
  });
}

module.exports = { startDashboard };
