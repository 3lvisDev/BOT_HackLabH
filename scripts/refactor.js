const fs = require('fs');

let content = fs.readFileSync('panel.js', 'utf8');

// 1. Reemplazar la firma de la función principal y definir BOT_API
content = content.replace(
  /function startDashboard\(discordClient, setupCommunityLogic, applySmartRoles, musicManager\) \{/g,
  `const BOT_API = process.env.BOT_API_URL || 'http://localhost:9667';\n`
);

// 2. Eliminar el export y cerrar la llave principal
content = content.replace(/module\.exports = \{ startDashboard \};\s*/g, '');
content = content.replace(/}\s*$/g, '');

// 3. Modificar getActiveGuild
content = content.replace(
  /const getActiveGuild = \(req\) => \{[\s\S]*?return discordClient\.guilds\.cache\.get\(selectedGuildId\) \|\| null;\s*\};/g,
  `const getActiveGuildId = (req) => {
    const selectedGuildId = resolveSelectedGuildId({
      requestedGuildId: req.query.guildId || req.body?.guildId,
      sessionGuildId: req.session?.user?.guildId,
      accessibleGuilds: getSessionGuilds(req)
    });
    if (!selectedGuildId) return null;
    req.session.user.guildId = selectedGuildId;
    return selectedGuildId;
  };`
);

// 4. Update references to getActiveGuild
content = content.replace(/const guild = getActiveGuild\(req\);/g, 'const guildId = getActiveGuildId(req);');
content = content.replace(/const g = getActiveGuild\(req\);/g, 'const guildId = getActiveGuildId(req);');
content = content.replace(/guild\.id/g, 'guildId');
content = content.replace(/g\.id/g, 'guildId');

// 5. Update /api/auth/callback oauth guild building
content = content.replace(
  /const accessibleGuilds = buildAccessibleGuilds\(\s*Array\.from\(discordClient\.guilds\.cache\.values\(\)\),\s*guildsResponse\.data\s*\);/g,
  `const { data: botGuilds } = await axios.get(\`\${BOT_API}/internal/guilds\`).catch(() => ({ data: [] }));
      const accessibleGuilds = buildAccessibleGuilds(botGuilds, guildsResponse.data);`
);

// 6. Update /api/status
content = content.replace(
  /app\.get\('\/api\/status',\s*authMiddleware,\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?res\.json\(\{\s*online:\s*true,\s*botTag:.*?\n\s*\}\);\s*\}\);/g,
  `app.get('/api/status', authMiddleware, async (req, res) => {
    try {
        const guildId = getActiveGuildId(req);
        const { data: statusData } = await axios.get(\`\${BOT_API}/internal/status\`);
        let activeGuildName = null;
        if (guildId) {
            const { data: guildData } = await axios.get(\`\${BOT_API}/internal/guilds/\${guildId}\`).catch(()=>({data:{}}));
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
  });`
);

// 7. Update /api/roles
content = content.replace(
  /app\.get\('\/api\/roles',\s*authMiddleware,\s*guildManagerMiddleware,\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?res\.json\(roles\);\s*\}\);/g,
  `app.get('/api/roles', authMiddleware, guildManagerMiddleware, async (req, res) => {
    try {
        const guildId = getActiveGuildId(req);
        if (!guildId) return res.json([]);
        const { data: roles } = await axios.get(\`\${BOT_API}/internal/guilds/\${guildId}/roles\`);
        res.json(roles);
    } catch (err) { res.status(500).json({ error: 'Error' }); }
  });`
);

// 8. Update /api/users
content = content.replace(
  /app\.get\('\/api\/users',\s*authMiddleware,\s*guildManagerMiddleware,\s*async\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?res\.json\(membersData\);\s*\} catch \(err\) \{[\s\S]*?\}\s*\}\);/g,
  `app.get('/api/users', authMiddleware, guildManagerMiddleware, async (req, res) => {
    try {
      const guildId = getActiveGuildId(req);
      if (!guildId) return res.json([]);
      const { data: members } = await axios.get(\`\${BOT_API}/internal/guilds/\${guildId}/members\`);
      res.json(members);
    } catch (err) { res.status(500).json({ error: 'Error' }); }
  });`
);

// 9. Update /api/guild/channels
content = content.replace(
  /app\.get\('\/api\/guild\/channels',\s*authMiddleware,\s*guildManagerMiddleware,\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?res\.json\(channels\);\s*\}\);/g,
  `app.get('/api/guild/channels', authMiddleware, guildManagerMiddleware, async (req, res) => {
    try {
        const guildId = getActiveGuildId(req);
        if (!guildId) return res.json([]);
        const { data: channels } = await axios.get(\`\${BOT_API}/internal/guilds/\${guildId}/channels\`);
        res.json(channels);
    } catch (err) { res.status(500).json({ error: 'Error' }); }
  });`
);

// 10. Update POST /api/users/:userId/roles
content = content.replace(
  /app\.post\('\/api\/users\/:userId\/roles',\s*authMiddleware,\s*guildManagerMiddleware,\s*async\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?res\.json\(\{ success:\s*true \}\);\s*\} catch \(err\) \{ res\.status\(500\)\.json\(\{ error:\s*err\.message \}\);\s*\}\s*\}\);/g,
  `app.post('/api/users/:userId/roles', authMiddleware, guildManagerMiddleware, async (req, res) => {
      const { userId } = req.params;
      const { roleId, action } = req.body;
      try {
          const guildId = getActiveGuildId(req);
          await axios.post(\`\${BOT_API}/internal/guilds/\${guildId}/members/\${userId}/roles\`, { roleId, action });
          res.json({ success: true });
      } catch (err) { res.status(500).json({ error: err.message }); }
  });`
);

// 11. Update /api/music/status
content = content.replace(
  /app\.get\('\/api\/music\/status',\s*authMiddleware,\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?res\.json\(status\);\s*\}\);/g,
  `app.get('/api/music/status', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          if(!guildId) return res.json({ active: false });
          const { data } = await axios.get(\`\${BOT_API}/internal/music/\${guildId}/status\`);
          res.json(data);
      } catch(err) { res.status(500).json({ error: err.message }); }
  });`
);

// 12. Update /api/music/control
content = content.replace(
  /app\.post\('\/api\/music\/control',\s*authMiddleware,\s*async\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?res\.status\(400\)\.json\(\{ error:\s*err\.message \}\);\s*\}\s*\}\);/g,
  `app.post('/api/music/control', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const { action, query, channelId } = req.body || {};
          const { data } = await axios.post(\`\${BOT_API}/internal/music/\${guildId}/control\`, { action, query, channelId });
          res.json(data);
      } catch (err) {
          res.status(400).json({ error: err.response?.data?.error || err.message });
      }
  });`
);

// 13. Update resolvePlayableQueries
content = content.replace(
  /const queries = await musicManager\.resolvePlayableQueries\(spotifyUrl\);/g,
  `const { data } = await axios.post(\`\${BOT_API}/internal/music/\${guildId}/resolve\`, { query: spotifyUrl });
          const queries = data.queries || [];`
);

// 14. Update POST /api/playlists/:name/play
content = content.replace(
  /app\.post\('\/api\/playlists\/:name\/play',\s*authMiddleware,\s*async\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?res\.json\(\{ success: true, added: added\.length \}\);\s*\} catch \(err\) \{ res\.status\(400\)\.json\(\{ error: err\.message \}\);\s*\}\s*\}\);/g,
  `app.post('/api/playlists/:name/play', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const playlist = await db.getPlaylistByName(guildId, req.params.name);
          if (!playlist) return res.status(404).json({ error: 'Playlist no encontrada' });
          const items = await db.getPlaylistItems(playlist.id);
          if (!items.length) return res.status(400).json({ error: 'Playlist vacía' });
          
          const { data } = await axios.post(\`\${BOT_API}/internal/music/\${guildId}/control\`, {
              action: 'enqueueMany',
              queries: items.map(i => i.query)
          });
          res.json(data);
      } catch (err) { res.status(400).json({ error: err.response?.data?.error || err.message }); }
  });`
);

// 15. Update /api/automod/status
content = content.replace(
  /app\.get\('\/api\/automod\/status',\s*authMiddleware,\s*async\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?res\.status\(400\)\.json\(\{ error:\s*err\.message \}\);\s*\}\s*\}\);/g,
  `app.get('/api/automod/status', authMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const { data } = await axios.post(\`\${BOT_API}/internal/automod/\${guildId}\`, { action: 'status' });
          res.json({ success: true, message: data.message });
      } catch (err) { res.status(400).json({ error: err.response?.data?.error || err.message }); }
  });`
);

// 16. Update /api/automod/action
content = content.replace(
  /app\.post\('\/api\/automod\/action',\s*authMiddleware,\s*guildManagerMiddleware,\s*async\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?res\.status\(400\)\.json\(\{ error:\s*err\.message \}\);\s*\}\s*\}\);/g,
  `app.post('/api/automod/action', authMiddleware, guildManagerMiddleware, async (req, res) => {
      try {
          const guildId = getActiveGuildId(req);
          const action = String(req.body?.action || '').trim().toLowerCase();
          const word = String(req.body?.word || '').trim();
          const { data } = await axios.post(\`\${BOT_API}/internal/automod/\${guildId}\`, { action, word });
          res.json({ success: true, message: data.message });
      } catch (err) { res.status(400).json({ error: err.response?.data?.error || err.message }); }
  });`
);

// 17. Update /api/setup
content = content.replace(
  /app\.post\('\/api\/setup',\s*authMiddleware,\s*guildManagerMiddleware,\s*strictLimiter,\s*async\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?res\.end\(\);\s*\}\);/g,
  `app.post('/api/setup', authMiddleware, guildManagerMiddleware, strictLimiter, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    const admins = (req.headers['x-admins'] || "").split(',').filter(Boolean);
    const mods = (req.headers['x-mods'] || "").split(',').filter(Boolean);
    const sendLog = (msg) => res.write(\`data: \${JSON.stringify({ message: msg })}\\n\\n\`);
    try {
      const guildId = getActiveGuildId(req);
      const { data: guildData } = await axios.get(\`\${BOT_API}/internal/guilds/\${guildId}\`);
      if (!admins.includes(guildData.ownerId)) admins.push(guildData.ownerId);
      
      sendLog("⏳ Enviando petición al bot...");
      await axios.post(\`\${BOT_API}/internal/setup/\${guildId}\`, { admins, mods });
      sendLog("✅ Proceso completado.");
    } catch (err) { sendLog(\`❌ Error: \${err.response?.data?.error || err.message}\`); }
    res.write('event: done\\ndata: {}\\n\\n');
    res.end();
  });`
);


// Eliminar condicional de musicManager en spotify
content = content.replace(/if \(!musicManager \|\| typeof musicManager\.resolvePlayableQueries !== 'function'\) \{[\s\S]*?\}/g, '');

fs.writeFileSync('panel.js', content, 'utf8');
console.log("Refactoring completado!");
