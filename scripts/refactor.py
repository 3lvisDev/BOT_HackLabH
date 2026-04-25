import re
import sys

with open('panel.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the function wrapper
content = re.sub(r'function startDashboard\(discordClient, setupCommunityLogic, applySmartRoles, musicManager\) \{', 
                 r'''const BOT_API = process.env.BOT_API_URL || 'http://localhost:9667';\n''', content)
content = re.sub(r'module\.exports = \{ startDashboard \};\s*', '', content)
# Remove the closing brace of startDashboard
content = re.sub(r'\}\s*$', '', content)

# getActiveGuild -> getActiveGuildId
content = re.sub(r'const getActiveGuild = \(req\) => \{.*?(const selectedGuildId = resolveSelectedGuildId.*?);\s*if \(!selectedGuildId\) \{\s*return null;\s*\}\s*req\.session\.user\.guildId = selectedGuildId;\s*return discordClient\.guilds\.cache\.get\(selectedGuildId\) \|\| null;\s*\};',
                 r'const getActiveGuildId = (req) => {\n    \1;\n    if (!selectedGuildId) return null;\n    req.session.user.guildId = selectedGuildId;\n    return selectedGuildId;\n  };', content, flags=re.DOTALL)

# Replace getActiveGuild(req) with getActiveGuildId(req)
content = re.sub(r'const guild = getActiveGuild\(req\);', r'const guildId = getActiveGuildId(req);', content)
content = re.sub(r'const g = getActiveGuild\(req\);', r'const guildId = getActiveGuildId(req);', content)
# Fix guild.id -> guildId
content = re.sub(r'guild\.id', r'guildId', content)
content = re.sub(r'g\.id', r'guildId', content)
# Fix guild.name to be aware it doesn't exist directly
# Wait, /api/status uses guild?.name. Let's fix /api/status manually
status_code = '''
  app.get('/api/status', authMiddleware, async (req, res) => {
    try {
        const guildId = getActiveGuildId(req);
        const { data: statusData } = await axios.get(`${BOT_API}/internal/status`);
        let activeGuildName = null;
        if (guildId) {
            const { data: guildData } = await axios.get(`${BOT_API}/internal/guilds/${guildId}`).catch(()=>({data:{}}));
            activeGuildName = guildData.name || null;
        }

        res.json({
          online: statusData.online,
          botTag: statusData.botTag,
          botAvatar: statusData.botAvatar,
          guildCount: statusData.guildCount,
          userCount: statusData.totalMemberCount,
          activeGuildId: guildId || null,
          activeGuildName: activeGuildName
        });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
  });
'''
content = re.sub(r'app\.get\(\'/api/status\', authMiddleware, \(req, res\) => \{.*?\}\);', status_code, content, flags=re.DOTALL)

# /api/roles
roles_code = '''
  app.get('/api/roles', authMiddleware, guildManagerMiddleware, async (req, res) => {
    try {
        const guildId = getActiveGuildId(req);
        if (!guildId) return res.json([]);
        const { data: roles } = await axios.get(`${BOT_API}/internal/guilds/${guildId}/roles`);
        res.json(roles);
    } catch (err) { 
        console.error("❌ [Dashboard] Error en /api/roles:", err.message);
        res.status(500).json({ error: 'Error' }); 
    }
  });
'''
content = re.sub(r'app\.get\(\'/api/roles\'.*?\}\);', roles_code, content, flags=re.DOTALL)

# /api/users
users_code = '''
  app.get('/api/users', authMiddleware, guildManagerMiddleware, async (req, res) => {
    try {
      const guildId = getActiveGuildId(req);
      if (!guildId) return res.json([]);
      const { data: members } = await axios.get(`${BOT_API}/internal/guilds/${guildId}/members`);
      res.json(members);
    } catch (err) { 
      console.error("❌ [Dashboard] Error en /api/users:", err.message);
      res.status(500).json({ error: 'Error' }); 
    }
  });
'''
content = re.sub(r'app\.get\(\'/api/users\'.*?\}\);', users_code, content, flags=re.DOTALL)

# /api/guild/channels
channels_code = '''
  app.get('/api/guild/channels', authMiddleware, guildManagerMiddleware, async (req, res) => {
    try {
        const guildId = getActiveGuildId(req);
        if (!guildId) return res.json([]);
        const { data: channels } = await axios.get(`${BOT_API}/internal/guilds/${guildId}/channels`);
        res.json(channels);
    } catch (err) { 
        console.error("❌ [Dashboard] Error en /api/guild/channels:", err.message);
        res.status(500).json({ error: 'Error' }); 
    }
  });
'''
content = re.sub(r'app\.get\(\'/api/guild/channels\'.*?\}\);', channels_code, content, flags=re.DOTALL)

# /api/users/:userId/roles
roles_post_code = '''
  app.post('/api/users/:userId/roles', authMiddleware, guildManagerMiddleware, async (req, res) => {
      const { userId } = req.params;
      const { roleId, action } = req.body;
      try {
          const guildId = getActiveGuildId(req);
          await axios.post(`${BOT_API}/internal/guilds/${guildId}/members/${userId}/roles`, { roleId, action });
          res.json({ success: true });
      } catch (err) { res.status(500).json({ error: err.message }); }
  });
'''
content = re.sub(r'app\.post\(\'/api/users/:userId/roles\'.*?\}\);', roles_post_code, content, flags=re.DOTALL)

# music status
music_status = '''
  app.get('/api/music/status', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          if(!guildId) return res.json({ active: false });
          const { data } = await axios.get(`${BOT_API}/internal/music/${guildId}/status`);
          res.json(data);
      } catch(err) { res.status(500).json({ error: err.message }); }
  });
'''
content = re.sub(r'app\.get\(\'/api/music/status\'.*?\}\);', music_status, content, flags=re.DOTALL)

# /api/music/control
music_control = '''
  app.post('/api/music/control', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const { action, query } = req.body || {};
          const { data: status } = await axios.get(`${BOT_API}/internal/music/${guildId}/status`).catch(()=>({data:{}}));
          const settings = await db.getMusicSettings(guildId);
          const channelId = status.channelId || settings?.last_channel_id;

          const { data } = await axios.post(`${BOT_API}/internal/music/${guildId}/control`, { action, query, channelId });
          res.json(data);
      } catch (err) {
          res.status(400).json({ error: err.response?.data?.error || err.message });
      }
  });
'''
content = re.sub(r'app\.post\(\'/api/music/control\'.*?\}\);', music_control, content, flags=re.DOTALL)

# import spotify resolving
music_resolve = r'''
          const { data } = await axios.post(`${BOT_API}/internal/music/${guildId}/resolve`, { query: spotifyUrl });
          const queries = data.queries || [];
'''
content = re.sub(r'const queries = await musicManager\.resolvePlayableQueries\(spotifyUrl\);', music_resolve, content)

# playlists play
playlist_play = '''
  app.post('/api/playlists/:name/play', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const playlist = await db.getPlaylistByName(guildId, req.params.name);
          if (!playlist) return res.status(404).json({ error: 'Playlist no encontrada' });
          const items = await db.getPlaylistItems(playlist.id);
          if (!items.length) return res.status(400).json({ error: 'Playlist vacía' });
          
          const { data: status } = await axios.get(`${BOT_API}/internal/music/${guildId}/status`).catch(()=>({data:{}}));
          const settings = await db.getMusicSettings(guildId);
          const channelId = status.channelId || settings?.last_channel_id;
          if (!channelId) return res.status(400).json({ error: 'No hay canal de voz disponible.' });
          
          const { data } = await axios.post(`${BOT_API}/internal/music/${guildId}/control`, {
              action: 'enqueueMany',
              queries: items.map(i => i.query),
              channelId
          });
          res.json(data);
      } catch (err) { res.status(400).json({ error: err.response?.data?.error || err.message }); }
  });
'''
content = re.sub(r'app\.post\(\'/api/playlists/:name/play\'.*?\}\);', playlist_play, content, flags=re.DOTALL)

# automod
automod = '''
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
'''
content = re.sub(r'app\.get\(\'/api/automod/status\'.*?\}\);', automod, content, flags=re.DOTALL)
content = re.sub(r'app\.post\(\'/api/automod/action\'.*?\}\);', '', content, flags=re.DOTALL)

# oauth guilds fetching - replace accessibleGuilds logic
oauth_logic = '''
      const { data: botGuilds } = await axios.get(`${BOT_API}/internal/guilds`).catch(() => ({ data: [] }));
      const accessibleGuilds = buildAccessibleGuilds(botGuilds, guildsResponse.data);
'''
content = re.sub(r'const accessibleGuilds = buildAccessibleGuilds\(\s*Array\.from\(discordClient\.guilds\.cache\.values\(\)\),\s*guildsResponse\.data\s*\);', oauth_logic, content)

# setup
setup = '''
  app.post('/api/setup', authMiddleware, guildManagerMiddleware, strictLimiter, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    const admins = (req.headers['x-admins'] || "").split(',').filter(Boolean);
    const mods = (req.headers['x-mods'] || "").split(',').filter(Boolean);
    const sendLog = (msg) => res.write(`data: ${JSON.stringify({ message: msg })}\\n\\n`);
    try {
      const guildId = getActiveGuildId(req);
      const { data: guildData } = await axios.get(`${BOT_API}/internal/guilds/${guildId}`);
      if (!admins.includes(guildData.ownerId)) admins.push(guildData.ownerId);
      
      sendLog("⏳ Enviando petición al bot...");
      await axios.post(`${BOT_API}/internal/setup/${guildId}`, { admins, mods });
      sendLog("✅ Proceso completado.");
    } catch (err) { sendLog(`❌ Error: ${err.response?.data?.error || err.message}`); }
    res.write('event: done\\ndata: {}\\n\\n');
    res.end();
  });
'''
content = re.sub(r'app\.post\(\'/api/setup\'.*?\}\);', setup, content, flags=re.DOTALL)

with open('panel.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
