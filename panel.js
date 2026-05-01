const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const crypto = require('crypto');
const db = require('./db');
const fs = require('fs');
const sodium = require('libsodium-wrappers');
const { buildAccessibleGuilds, resolveSelectedGuildId, buildGuildChannels } = require('./dashboard-guilds');
const { canManageSecrets } = require('./utils/webPermissions');
const { runAction } = require('./commands/automod');
const { resolveGuildLocale } = require('./utils/i18n');

const BOT_API = process.env.BOT_API_URL || 'http://localhost:9667';

  const app = express();
  app.set('trust proxy', 1); // Confiar en el proxy (Nginx/Cloudflare) para cookies seguras
  const PORT = process.env.PORT || 3000;
  
  const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `http://localhost:${PORT}/api/auth/callback`;
  const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
  const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
  const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || `http://localhost:${PORT}/api/spotify/callback`;

  // Configurar CORS dinámico para permitir la IP local de la Raspberry Pi
  const corsOptions = {
    origin: function (origin, callback) {
      // Permitir todo transitoriamente en configuración de red local sin SSL
      callback(null, true);
    },
    credentials: true,
    optionsSuccessStatus: 200
  };
  app.use(cors(corsOptions));
  app.use(express.json());
  
  // Rate limiting general para todas las rutas API
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Límite de 100 peticiones por ventana
    message: 'Demasiadas peticiones desde esta IP, por favor intenta de nuevo más tarde.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  // Rate limiting estricto para autenticación
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 50, // Aumentado de 5 a 50 para pruebas
    message: 'Demasiados intentos de inicio de sesión, por favor intenta de nuevo más tarde.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  // Rate limiting para operaciones sensibles
  const strictLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 10, // 10 peticiones por minuto
    message: 'Demasiadas peticiones, por favor espera un momento.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  // Aplicar rate limiting general a todas las rutas API
  app.use('/api/', apiLimiter);
  
  app.use(session({
    secret: process.env.WEB_ADMIN_PASSWORD || 'hacklab-secret-fallback-12345',
    resave: true,
    saveUninitialized: true,
    cookie: { 
      secure: false, 
      httpOnly: false, // Permitimos acceso desde JS para debug
      sameSite: 'lax', 
      maxAge: 1000 * 60 * 60 * 24 
    }
  }));

  // Middleware de Debug para ver si la sesiÃ³n viaja
  app.use((req, res, next) => {
      console.log(`[Debug] ${req.method} ${req.url} - SID: ${req.sessionID} - Authed: ${!!req.session.user}`);
      next();
  });

  app.use(express.static(path.join(__dirname, 'public')));

  app.get(['/terms', '/legal/terms'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'terms.html'));
  });

  app.get(['/privacy', '/legal/privacy'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
  });

  app.get('/install', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'install.html'));
  });

  app.get('/install/discord', (req, res) => {
    const clientId = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID || '1194412207144980531';
    
    const installUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;
    res.redirect(installUrl);
  });

  app.get('/invite', (req, res) => {
    res.redirect('/install/discord');
  });

  const authMiddleware = (req, res, next) => {
    if (req.session && req.session.user) {
      next();
    } else {
      res.status(401).json({ error: 'No autorizado. Inicia sesión con Discord.' });
    }
  };

  const secretsOwnerMiddleware = (req, res, next) => {
    if (req.session?.user && typeof req.session.user.canManageSecrets === 'undefined') {
      req.session.user.canManageSecrets = canManageSecrets(req.session.user.id);
    }
    if (req.session?.user?.canManageSecrets) {
      return next();
    }
    return res.status(403).json({ error: 'Acceso denegado. Solo el propietario autorizado puede gestionar secretos.' });
  };

  const getSessionGuilds = (req) => req.session?.user?.guilds || [];

  const getActiveGuildAccess = (req) => {
    const guilds = getSessionGuilds(req);
    const selectedGuildId = resolveSelectedGuildId({
      requestedGuildId: req.query.guildId || req.body?.guildId,
      sessionGuildId: req.session?.user?.guildId,
      accessibleGuilds: guilds
    });
    if (!selectedGuildId) return null;
    return guilds.find((guild) => guild.id === selectedGuildId) || null;
  };

  const getActiveGuildId = (req) => {
    const selectedGuildId = resolveSelectedGuildId({
      requestedGuildId: req.query.guildId || req.body?.guildId,
      sessionGuildId: req.session?.user?.guildId,
      accessibleGuilds: getSessionGuilds(req)
    });
    if (!selectedGuildId) return null;
    req.session.user.guildId = selectedGuildId;
    return selectedGuildId;
  };

  const guildManagerMiddleware = (req, res, next) => {
    const activeGuild = getActiveGuildAccess(req);
    if (!activeGuild) {
      return res.status(400).json({ error: 'No se encontro un servidor activo para la sesion.' });
    }
    if (!activeGuild.userCanManage) {
      return res.status(403).json({ error: 'Necesitas permisos de Administrador o Gestionar servidor para esta accion.' });
    }
    return next();
  };

  app.get('/api/auth/discord', authLimiter, (req, res) => {
    if (!DISCORD_CLIENT_ID) {
        return res.status(500).send("La variable DISCORD_CLIENT_ID no está configurada en .env");
    }
    // Priorizamos la IP/Host desde donde el usuario entra para evitar problemas de localhost vs IP
    const host = req.get('host');
    const redirectUri = `http://${host}/api/auth/callback`;
    
    console.log(`[Auth] Iniciando login. Redirect detectado: ${redirectUri}`);
    
    const url = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify%20guilds`;
    res.redirect(url);
  });

  app.get('/api/auth/callback', authLimiter, async (req, res) => {
    const code = req.query.code;
    console.log(`[Auth] Recibido callback con código: ${code ? 'SÍ' : 'NO'}`);
    if (!code) return res.send("No se proporcionó un código OAuth.");

    try {
      const redirectUri = process.env.DISCORD_REDIRECT_URI || `http://${req.get('host')}/api/auth/callback`;
      console.log(`[Auth] Usando Redirect URI: ${redirectUri}`);
      
      const params = new URLSearchParams();
      params.append('client_id', DISCORD_CLIENT_ID);
      params.append('client_secret', DISCORD_CLIENT_SECRET);
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      params.append('redirect_uri', redirectUri);

      console.log(`[Auth] Solicitando token a Discord...`);
      const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      });

      const accessToken = tokenResponse.data.access_token;
      console.log(`[Auth] Token obtenido. Obteniendo datos del usuario...`);
      
      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      const discordUser = userResponse.data;
      const { data: botGuilds } = await axios.get(`${BOT_API}/internal/guilds`).catch(() => ({ data: [] }));
      const accessibleGuilds = buildAccessibleGuilds(botGuilds, guildsResponse.data);
      const accessibleGuildIds = new Set(accessibleGuilds.map((guild) => guild.id));
      const isGuildOwner = (guildsResponse.data || []).some((guild) => guild?.owner && accessibleGuildIds.has(guild.id));

      if (accessibleGuilds.length === 0) {
        return res.send("Acceso denegado. Necesitas compartir un servidor con el bot.");
      }

      req.session.user = {
        id: discordUser.id,
        username: discordUser.username,
        avatar: discordUser.avatar 
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          : 'https://cdn.discordapp.com/embed/avatars/0.png',
        guildId: accessibleGuilds[0].id,
        guilds: accessibleGuilds,
        canManageSecrets: canManageSecrets(discordUser.id, process.env, { isGuildOwner })
      };

      console.log(`[Auth] SesiÃ³n creada para el usuario: ${discordUser.username} (${discordUser.id})`);
      
      // Forzar guardado de sesiÃ³n antes de redirigir
      req.session.save((err) => {
          if (err) {
              console.error('[Auth] Error al guardar sesiÃ³n:', err);
              return res.status(500).send("Error interno al guardar la sesiÃ³n.");
          }
          res.redirect('/');
      });
    } catch (error) {
      const redirectUri = process.env.DISCORD_REDIRECT_URI || `http://${req.get('host')}/api/auth/callback`;
      const discordMessage = error.response?.data?.error_description || error.response?.data?.error || error.message;

      console.error('[Dashboard Auth] Error en callback OAuth:', {
        redirectUri,
        message: discordMessage
      });

      if (discordMessage && String(discordMessage).toLowerCase().includes('redirect')) {
        return res.status(500).send(`Error de autenticaciÃ³n OAuth. Revisa DISCORD_REDIRECT_URI y registrala igual en Discord Portal: ${redirectUri}`);
      }

      res.status(500).send(`Error autenticaciÃ³n: ${discordMessage}`);
    }
  });

  app.get('/api/auth/me', (req, res) => {
      if (req.session && req.session.user) res.json({ authenticated: true, user: req.session.user });
      else res.status(401).json({ authenticated: false });
  });

  app.get('/api/guilds', authMiddleware, (req, res) => {
      const guilds = getSessionGuilds(req);
      const activeGuildId = resolveSelectedGuildId({
        requestedGuildId: req.query.guildId,
        sessionGuildId: req.session.user.guildId,
        accessibleGuilds: guilds
      });

      if (activeGuildId) {
        req.session.user.guildId = activeGuildId;
      }

      res.json({ guilds, activeGuildId: activeGuildId || null });
  });

  app.post('/api/guilds/select', authMiddleware, (req, res) => {
      const selectedGuildId = resolveSelectedGuildId({
        requestedGuildId: req.body?.guildId,
        sessionGuildId: req.session.user.guildId,
        accessibleGuilds: getSessionGuilds(req)
      });

      if (!selectedGuildId || selectedGuildId !== req.body?.guildId) {
        return res.status(400).json({ error: 'Servidor no disponible para esta sesiÃ³n.' });
      }

      req.session.user.guildId = selectedGuildId;
      res.json({ success: true, guildId: selectedGuildId });
  });

  app.post('/api/logout', (req, res) => {
      req.session.destroy();
      res.json({ success: true });
  });

  app.post('/api/restart', authMiddleware, guildManagerMiddleware, strictLimiter, (req, res) => {
      res.json({ success: true });
      setTimeout(() => process.exit(0), 1000);
  });

  app.get('/api/status', authMiddleware, (req, res) => {
    const guildId = getActiveGuildId(req);

    res.json({
      online: true,
      botTag: discordClient.user.tag,
      botAvatar: discordClient.user.displayAvatarURL(),
      guildCount: discordClient.guilds.cache.size,
      userCount: guild ? guild.memberCount : discordClient.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
      activeGuildId: guild?.id || null,
      activeGuildName: guild?.name || null
    });
  });

  app.get('/api/roles', authMiddleware, guildManagerMiddleware, async (req, res) => {
    try {
        const guildId = getActiveGuildId(req);
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

  app.get('/api/users', authMiddleware, guildManagerMiddleware, async (req, res) => {
    try {
      const guildId = getActiveGuildId(req);
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

  app.get('/api/guild/channels', authMiddleware, guildManagerMiddleware, async (req, res) => {
    try {
        const guildId = getActiveGuildId(req);
        if (!guild) {
            console.log("⚠️ [Dashboard] No se encontró ninguna guild en la cache.");
            return res.json([]);
        }

        console.log(`🔍 [Dashboard] Buscando canales para la guild: ${guild.name} (${guildId})`);
        const channels = buildGuildChannels(guild);
        
        console.log(`✅ [Dashboard] Encontrados ${channels.length} canales de texto.`);
        res.json(channels);
    } catch (err) { 
        console.error("❌ [Dashboard] Error en /api/guild/channels:", err);
        res.status(500).json({ error: 'Error' }); 
    }
  });

  app.post('/api/users/:userId/roles', authMiddleware, guildManagerMiddleware, async (req, res) => {
      const { userId } = req.params;
      const { roleId, action } = req.body;
      try {
          const guildId = getActiveGuildId(req);
          await axios.post(`${BOT_API}/internal/guilds/${guildId}/members/${userId}/roles`, { roleId, action });
          res.json({ success: true });
      } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/settings/welcome', authMiddleware, guildManagerMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const row = await db.getSettings(guildId);
          res.json(row || {
              welcome_enabled: 0, welcome_channel: null, welcome_message: '¡Bienvenido {user} a {server}!',
              goodbye_enabled: 0, goodbye_channel: null, goodbye_message: '{user} ha abandonado el servidor.'
          });
      } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/settings/welcome', authMiddleware, guildManagerMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          await db.updateSettings(guildId, req.body);
          res.json({ success: true });
      } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // --- Sistema de Logros (Achievements) ---
  app.get('/api/achievements', authMiddleware, guildManagerMiddleware, async (req, res) => {
      try {
          const achievements = await db.getAllAchievements();
          res.json(achievements);
      } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/achievements', authMiddleware, guildManagerMiddleware, async (req, res) => {
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

  // Dashboard is read-only for music status
  app.get('/api/music/status', authMiddleware, (req, res) => {
      res.json(musicManager.getStatus());
  });

  app.get('/api/music/logs', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const logs = await db.getMusicLogs(guildId);
          res.json(logs);
      } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/logs/system', authMiddleware, async (req, res) => {
    try {
        const guildId = getActiveGuildId(req);
        const logs = await db.getSystemLogs(guild ? guildId : null);
        res.json(logs);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

  const { validateYouTubeCookies } = require('./music/validation');
  app.post('/api/music/session', authMiddleware, guildManagerMiddleware, async (req, res) => {
      try {
          const cookies = validateYouTubeCookies(req.body.cookies);
          const guildId = getActiveGuildId(req);
          await db.updateMusicSettings(guildId, { yt_cookies: JSON.stringify(cookies) });
          res.json({ success: true });
      } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.post('/api/music/control', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const { action, query, channelId } = req.body || {};
          const { data } = await axios.post(`${BOT_API}/internal/music/${guildId}/control`, { action, query, channelId });
          res.json(data);
      } catch (err) {
          res.status(400).json({ error: err.response?.data?.error || err.message });
      }
  });

  app.get('/api/playlists', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const playlists = await db.getPlaylists(guildId);
          res.json(playlists);
      } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/playlists/:name', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const playlist = await db.getPlaylistByName(guildId, req.params.name);
          if (!playlist) return res.status(404).json({ error: 'Playlist no encontrada' });
          const items = await db.getPlaylistItems(playlist.id);
          res.json({ playlist, items });
      } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/playlists', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const created = await db.createPlaylist(guildId, req.body.name, req.session?.user?.id);
          res.json(created);
      } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.post('/api/playlists/:name/items', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const result = await db.addPlaylistItem(guildId, req.params.name, req.body.query, req.session?.user?.id);
          res.json(result);
      } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.post('/api/playlists/:name/import-spotify', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const spotifyUrl = String(req.body?.spotifyUrl || '').trim();
          if (!spotifyUrl) return res.status(400).json({ error: 'Falta spotifyUrl' });


          const { data } = await axios.post(`${BOT_API}/internal/music/${guildId}/resolve`, { query: spotifyUrl });
          const queries = data.queries || [];
          if (!queries.length) return res.status(400).json({ error: 'No se encontraron tracks para importar.' });

          for (const query of queries) {
              await db.addPlaylistItem(guildId, req.params.name, query, req.session?.user?.id);
          }

          res.json({ success: true, imported: queries.length });
      } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.delete('/api/playlists/:name/items/:position', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const ok = await db.removePlaylistItem(guildId, req.params.name, Number(req.params.position));
          res.json({ success: ok });
      } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.delete('/api/playlists/:name', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const ok = await db.deletePlaylist(guildId, req.params.name);
          res.json({ success: ok });
      } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.post('/api/playlists/:name/play', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const playlist = await db.getPlaylistByName(guildId, req.params.name);
          if (!playlist) return res.status(404).json({ error: 'Playlist no encontrada' });
          const items = await db.getPlaylistItems(playlist.id);
          if (!items.length) return res.status(400).json({ error: 'Playlist vacía' });
          
          const { data } = await axios.post(`${BOT_API}/internal/music/${guildId}/control`, {
              action: 'enqueueMany',
              queries: items.map(i => i.query)
          });
          res.json(data);
      } catch (err) { res.status(400).json({ error: err.response?.data?.error || err.message }); }
  });

  // --- RUTAS DE USUARIO PERSONAL (Para todos) ---
  app.get('/api/my/playlists', authMiddleware, async (req, res) => {
      try {
          const userId = req.session.user.id;
          const playlists = await db.getUserPlaylists(userId);
          res.json(playlists);
      } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/my/playlists', authMiddleware, async (req, res) => {
      try {
          const userId = req.session.user.id;
          const { name } = req.body;
          if (!name) return res.status(400).json({ error: 'Nombre requerido' });
          await db.createUserPlaylist(userId, name);
          res.json({ success: true });
      } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.get('/api/my/playlists/:name', authMiddleware, async (req, res) => {
      try {
          const userId = req.session.user.id;
          const playlist = await db.getUserPlaylistByName(userId, req.params.name);
          if (!playlist) return res.status(404).json({ error: 'No encontrada' });
          const items = await db.getUserPlaylistItems(playlist.id);
          res.json({ playlist, items });
      } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/my/playlists/:name/items', authMiddleware, async (req, res) => {
      try {
          const userId = req.session.user.id;
          const { query } = req.body;
          const playlist = await db.getUserPlaylistByName(userId, req.params.name);
          if (!playlist) return res.status(404).json({ error: 'No encontrada' });
          const result = await db.addUserPlaylistItem(playlist.id, query);
          res.json(result);
      } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.delete('/api/my/playlists/:name', authMiddleware, async (req, res) => {
      try {
          const userId = req.session.user.id;
          const ok = await db.deleteUserPlaylist(userId, req.params.name);
          res.json({ success: ok });
      } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.delete('/api/my/playlists/:name/items/:position', authMiddleware, async (req, res) => {
      try {
          const userId = req.session.user.id;
          const playlist = await db.getUserPlaylistByName(userId, req.params.name);
          if (!playlist) return res.status(404).json({ error: 'No encontrada' });
          const ok = await db.removeUserPlaylistItem(playlist.id, Number(req.params.position));
          res.json({ success: ok });
      } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.get('/api/automod/status', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const { data } = await axios.post(`${BOT_API}/internal/automod/${guildId}`, { action: 'status' });
          res.json({ success: true, message: data.message });
      } catch (err) { res.status(400).json({ error: err.response?.data?.error || err.message }); }
  });

  app.post('/api/automod/action', authMiddleware, guildManagerMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const action = String(req.body?.action || '').trim().toLowerCase();
          const word = String(req.body?.word || '').trim();
          const { data } = await axios.post(`${BOT_API}/internal/automod/${guildId}`, { action, word });
          res.json({ success: true, message: data.message });
      } catch (err) { res.status(400).json({ error: err.response?.data?.error || err.message }); }
  });

  app.get('/api/spotify/auth', authMiddleware, (req, res) => {
      if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
          return res.status(400).json({ error: 'Configura SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET en .env' });
      }
      const state = crypto.randomBytes(16).toString('hex');
      req.session.spotifyOAuthState = state;
      const scope = encodeURIComponent('playlist-read-private playlist-read-collaborative');
      const url = `https://accounts.spotify.com/authorize?response_type=code&client_id=${encodeURIComponent(SPOTIFY_CLIENT_ID)}&scope=${scope}&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&state=${state}`;
      res.redirect(url);
  });

  app.get('/api/spotify/callback', authMiddleware, async (req, res) => {
      try {
          if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
              return res.status(400).send('Spotify no esta configurado en el servidor.');
          }

          const code = String(req.query?.code || '');
          const state = String(req.query?.state || '');
          if (!code || !state || state !== req.session.spotifyOAuthState) {
              return res.status(400).send('Spotify OAuth invalido o expirado.');
          }

          const params = new URLSearchParams();
          params.append('grant_type', 'authorization_code');
          params.append('code', code);
          params.append('redirect_uri', SPOTIFY_REDIRECT_URI);

          const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
          const tokenRes = await axios.post('https://accounts.spotify.com/api/token', params, {
              headers: {
                  Authorization: `Basic ${basic}`,
                  'Content-Type': 'application/x-www-form-urlencoded'
              }
          });

          req.session.spotify = {
              access_token: tokenRes.data.access_token,
              refresh_token: tokenRes.data.refresh_token,
              expires_at: Date.now() + (Number(tokenRes.data.expires_in || 3600) * 1000)
          };
          req.session.spotifyOAuthState = null;
          res.redirect('/#music-screen');
      } catch (err) {
          res.status(400).send(`Error conectando Spotify: ${err.response?.data?.error_description || err.message}`);
      }
  });

  async function getSpotifyAccessToken(req) {
      const spotify = req.session?.spotify;
      if (!spotify?.access_token) return null;
      if (spotify.expires_at && Date.now() < spotify.expires_at - 30_000) return spotify.access_token;

      if (!spotify.refresh_token) return null;
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', spotify.refresh_token);
      const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
      const tokenRes = await axios.post('https://accounts.spotify.com/api/token', params, {
          headers: {
              Authorization: `Basic ${basic}`,
              'Content-Type': 'application/x-www-form-urlencoded'
          }
      });

      req.session.spotify = {
          ...spotify,
          access_token: tokenRes.data.access_token,
          refresh_token: tokenRes.data.refresh_token || spotify.refresh_token,
          expires_at: Date.now() + (Number(tokenRes.data.expires_in || 3600) * 1000)
      };
      return req.session.spotify.access_token;
  }

  app.get('/api/spotify/status', authMiddleware, async (req, res) => {
      const token = await getSpotifyAccessToken(req).catch(() => null);
      res.json({ connected: Boolean(token) });
  });

  app.get('/api/spotify/playlists', authMiddleware, async (req, res) => {
      try {
          const token = await getSpotifyAccessToken(req);
          if (!token) return res.status(401).json({ error: 'Conecta tu cuenta de Spotify desde el panel.' });

          const response = await axios.get('https://api.spotify.com/v1/me/playlists?limit=50', {
              headers: { Authorization: `Bearer ${token}` }
          });

          const playlists = (response.data?.items || []).map((item) => ({
              id: item.id,
              name: item.name,
              tracks: item.tracks?.total || 0,
              owner: item.owner?.display_name || item.owner?.id || 'unknown',
              external_url: item.external_urls?.spotify || null
          }));
          res.json({ playlists });
      } catch (err) {
          res.status(400).json({ error: err.response?.data?.error?.message || err.message });
      }
  });

  app.post('/api/playlists/:name/import-spotify-account', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const playlistId = String(req.body?.spotifyPlaylistId || '').trim();
          if (!playlistId) return res.status(400).json({ error: 'Falta spotifyPlaylistId' });

          const token = await getSpotifyAccessToken(req);
          if (!token) return res.status(401).json({ error: 'Conecta tu cuenta de Spotify desde el panel.' });

          const trackQueries = [];
          let nextUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100`;
          while (nextUrl && trackQueries.length < 500) {
              const page = await axios.get(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
              for (const item of page.data?.items || []) {
                  const track = item?.track;
                  if (!track?.name) continue;
                  const artists = (track.artists || []).map((a) => a.name).filter(Boolean).join(' ');
                  trackQueries.push(`${artists} ${track.name}`.trim());
              }
              nextUrl = page.data?.next || null;
          }

          if (!trackQueries.length) return res.status(400).json({ error: 'No se encontraron tracks en esa playlist.' });
          for (const query of trackQueries) {
              await db.addPlaylistItem(guildId, req.params.name, query, req.session?.user?.id);
          }
          res.json({ success: true, imported: trackQueries.length });
      } catch (err) {
          res.status(400).json({ error: err.response?.data?.error?.message || err.message });
      }
  });

  app.get('/api/tickets', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const status = req.query.status ? String(req.query.status) : null;
          const rows = await db.getTickets(guildId, status && status !== 'all' ? status : null);
          res.json(rows);
      } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/tickets', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const title = req.body?.title || 'Nuevo ticket';
          const created = await db.createTicket(guildId, req.session?.user?.id || 'web-user', title, null);
          res.json(created);
      } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.post('/api/tickets/:id/close', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const ticket = await db.closeTicket(guildId, Number(req.params.id));
          if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
          res.json(ticket);
      } catch (err) { res.status(400).json({ error: err.message }); }
  });



  // --- Sistema de Variables de Entorno (.env) ---
  const envKeys = [
    'DISCORD_TOKEN', 'PORT', 'WEB_ADMIN_PASSWORD', 'DISCORD_CLIENT_ID', 
    'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI', 'NODE_ENV', 
    'ENCRYPTION_KEY', 'PI_HOST', 'PI_USER', 'PI_PASSWORD',
    'LAVALINK_URL', 'LAVALINK_PASSWORD', 'LAVALINK_SECURE', 'GITHUB_TOKEN',
    'SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_MARKET',
    'WEB_OWNER_DISCORD_IDS'
  ];

  app.get('/api/system/env', authMiddleware, secretsOwnerMiddleware, (req, res) => {
      const data = {};
      envKeys.forEach(key => {
          const val = process.env[key] || "";
          // Mask sensitive values
          if (key.includes('TOKEN') || key.includes('SECRET') || key.includes('PASSWORD') || key.includes('KEY')) {
              data[key] = val ? "••••••••••••••••" : "";
          } else {
              data[key] = val;
          }
      });
      res.json(data);
  });

  app.post('/api/system/env', authMiddleware, secretsOwnerMiddleware, strictLimiter, async (req, res) => {
      try {
          const newEnv = req.body;
          const envPath = path.join(__dirname, '.env');
          let content = "";
          
          // Leer actual .env para no perder comentarios si quisiéramos (opcional complejo)
          // Pero por simplicidad de un Senior Dev, generamos uno limpio y ordenado
          envKeys.forEach(key => {
              const val = newEnv[key];
              // Si el valor es el de máscara (••••), no actualizamos esa variable o usamos la actual
              let finalVal = val;
              if (val === "••••••••••••••••") {
                  finalVal = process.env[key];
              }
              if (finalVal !== undefined) {
                  content += `${key}=${finalVal}\n`;
                  process.env[key] = finalVal; // Actualizar en tiempo real el proceso actual
              }
          });

          fs.writeFileSync(envPath, content);
          res.json({ success: true, message: 'Archivo .env actualizado y variables cargadas en memoria.' });
      } catch (err) {
          res.status(500).json({ error: err.message });
      }
  });

  // Real GitHub Secrets Sync using API
  app.post('/api/system/github/sync', authMiddleware, secretsOwnerMiddleware, strictLimiter, async (req, res) => {
      const githubToken = process.env.GITHUB_TOKEN;
      const repoPath = "3lvisDev/BOT_HackLabH"; // Podríamos hacerlo dinámico después

      if (!githubToken) {
          return res.status(400).json({ error: 'Configura GITHUB_TOKEN en las variables antes de sincronizar.' });
      }

      try {
          // 1. Obtener la clave pública del repo
          const { data: publicKey } = await axios.get(`https://api.github.com/repos/${repoPath}/actions/secrets/public-key`, {
              headers: { Authorization: `token ${githubToken}` }
          });

          await sodium.ready;
          const binKey = sodium.from_base64(publicKey.key, sodium.base64_variants.ORIGINAL);

          // 2. Sincronizar cada variable como un Secret
          const secretsToSync = envKeys.filter(k => k !== 'GITHUB_TOKEN'); // No auto-sync el token por ahora
          const results = [];

          for (const key of secretsToSync) {
              const value = process.env[key];
              if (!value) continue;

              // Encriptar el valor usando libsodium
              const binValue = sodium.from_string(value);
              const encValue = sodium.crypto_box_seal(binValue, binKey);
              const b64Value = sodium.to_base64(encValue, sodium.base64_variants.ORIGINAL);

              // Subir a GitHub
              await axios.put(`https://api.github.com/repos/${repoPath}/actions/secrets/${key}`, 
                  {
                      encrypted_value: b64Value,
                      key_id: publicKey.key_id
                  },
                  { headers: { Authorization: `token ${githubToken}` } }
              );
              results.push(key);
          }

          res.json({ success: true, message: `Se han sincronizado ${results.length} secretos con GitHub exitosamente.` });
      } catch (err) {
          console.error('[GitHubSync] Error:', err.response?.data || err.message);
          res.status(500).json({ error: `GitHub API error: ${err.response?.data?.message || err.message}` });
      }
  });

  app.post('/api/setup', authMiddleware, guildManagerMiddleware, strictLimiter, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    const admins = (req.headers['x-admins'] || "").split(',').filter(Boolean);
    const mods = (req.headers['x-mods'] || "").split(',').filter(Boolean);
    const sendLog = (msg) => res.write(`data: ${JSON.stringify({ message: msg })}\n\n`);
    try {
      const guildId = getActiveGuildId(req);
      const { data: guildData } = await axios.get(`${BOT_API}/internal/guilds/${guildId}`);
      if (!admins.includes(guildData.ownerId)) admins.push(guildData.ownerId);
      
      sendLog("⏳ Enviando petición al bot...");
      await axios.post(`${BOT_API}/internal/setup/${guildId}`, { admins, mods });
      sendLog("✅ Proceso completado.");
    } catch (err) { sendLog(`❌ Error: ${err.response?.data?.error || err.message}`); }
    res.write('event: done\ndata: {}\n\n');
    res.end();
  });

  const server = app.listen(PORT, '0.0.0.0', () => console.log(`🌐 Dashboard en puerto ${PORT}`)).on('error', (err) => {
    console.error(`\n❌ Error al iniciar Dashboard en puerto ${PORT}: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
      console.error(`El puerto ${PORT} ya está en uso. Intenta con otro puerto:`);
      console.error(`  docker run -e PORT=3001 ...\n`);
    }
    process.exit(1);
  });

  // WebSocket for Real-time Music Logs
  const { WebSocketServer } = require('ws');
  const wss = new WebSocketServer({ server, path: '/ws/music/logs' });
  const { setSocketServer } = require('./music/logger');
  setSocketServer(wss);

  wss.on('connection', (ws) => {
      console.log('[WS] Nueva conexión para logs de música.');
      ws.send(JSON.stringify({ type: 'status', message: 'Conectado a la consola de música' }));
  });
