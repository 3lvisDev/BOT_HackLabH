document.addEventListener('DOMContentLoaded', () => {
    // --- State & Constants ---
    let allUsers = [];
    let allRoles = [];
    let selectedAdmins = [];
    let selectedMods = [];
    let currentFilter = 'all';
    let currentUser = null;
    let availableGuilds = [];
    let currentGuildId = null;

    // --- DOM Elements ---
    const loginView = document.getElementById('login-view');
    const dashView = document.getElementById('dashboard-view');
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.getElementById('menu-toggle');
    const logoutBtn = document.getElementById('logout-btn');
    const setupBtn = document.getElementById('setup-btn');
    const restartBtn = document.getElementById('restart-btn');
    const reconnectOverlay = document.getElementById('reconnect-overlay');
    const logContent = document.getElementById('log-content');
    const userTableBody = document.getElementById('user-table-body');
    const botTableBody = document.getElementById('bot-table-body');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const navItems = document.querySelectorAll('.nav-item');
    const screens = document.querySelectorAll('.screen-view');
    const guildSwitcher = document.getElementById('guild-switcher');
    const guildSelector = document.getElementById('guild-selector');

    // --- Theme Management ---
    function setTheme(themeId) {
        // Apply theme attribute to document (on html element)
        if (themeId === 'dark') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', themeId);
        }

        // Save to localStorage
        localStorage.setItem('hacklab-theme', themeId);

        // Update UI Cards in Settings if they exist
        const themeCards = document.querySelectorAll('.theme-card');
        themeCards.forEach(card => {
            if (card.dataset.themeId === themeId) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

        console.log(`[Theme] Switched to: ${themeId}`);
    }

    // Load persisted theme or default to dark
    const savedTheme = localStorage.getItem('hacklab-theme') || 'dark';
    setTheme(savedTheme);

    // --- URL State Management ---
    function syncStateWithURL() {
        const hash = window.location.hash.substring(1);
        if (hash) {
            const item = document.querySelector(`.nav-item[data-screen="${hash}"]`);
            if (item) item.click();
        }
    }

    // --- Initialization ---
    checkSession();

    // Screen Switching Logic
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const screenId = item.getAttribute('data-screen');
            
            // UI Toggle Nav
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // Switch Screen
            screens.forEach(s => {
                s.classList.remove('active');
                if (s.id === screenId) s.classList.add('active');
            });

            // Auto-close sidebar on mobile after navigation
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }

            // Special Refresh Logics
            if (screenId === 'users-screen' || screenId === 'bots-screen') {
                refreshData();
            }
            if (screenId === 'welcome-screen') {
                refreshWelcomeSettings();
            }
            if (screenId === 'achievements-screen') {
                refreshAchievements();
            }
            if (screenId === 'music-screen') {
                refreshMusicStatus();
                loadPlaylists();
            }
            if (screenId === 'tickets-screen') {
                loadTickets();
            }
            if (screenId === 'env-screen') {
                refreshEnvSettings();
            }

            if (screenId === 'logs-screen') {
                loadSystemLogs();
            }

            // Sync hash with current screen
            window.location.hash = screenId;
        });
    });

    // Expose globally for onclick handlers in HTML
    window.switchScreen = (screenId) => {
        const item = document.querySelector(`.nav-item[data-screen="${screenId}"]`);
        if (item) item.click();
    };

    // --- Filters ---
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            renderUserTable();
        });
    });

    guildSelector?.addEventListener('change', async (event) => {
        await selectGuild(event.target.value);
    });

    // --- Core Functions ---
    async function checkSession() {
        try {
            const resMe = await fetch('/api/auth/me');
            if (resMe.ok) {
                const dataMe = await resMe.json();
                if (dataMe.authenticated) {
                    showDashboard(dataMe.user);
                }
            }
        } catch (err) { console.error('Error validating session', err); }
    }

    async function showDashboard(user) {
        currentUser = user;
        document.getElementById('sidebar-bot-avatar').src = user.avatar;
        
        // Use the CSS state class for a smooth transition
        document.body.classList.add('is-authenticated');
        
        // Pre-revealing clean up
        loginView.classList.add('hidden');
        dashView.classList.remove('hidden');
        
        updateStats();
        await loadInitialData();
        
        // Finalize initialization by syncing URL
        syncStateWithURL();
    }

    async function loadGuilds() {
        try {
            const res = await fetch('/api/guilds');
            if (!res.ok) return;

            const data = await res.json();
            availableGuilds = data.guilds || [];
            currentGuildId = data.activeGuildId || availableGuilds[0]?.id || null;
            renderGuildSelector();
        } catch (err) {
            console.error('Error loading guilds', err);
        }
    }

    function renderGuildSelector() {
        if (!guildSelector || !guildSwitcher) return;

        guildSelector.innerHTML = availableGuilds
            .map(guild => `<option value="${guild.id}">${guild.name}</option>`)
            .join('');

        if (currentGuildId) {
            guildSelector.value = currentGuildId;
        }

        guildSwitcher.classList.toggle('hidden', availableGuilds.length <= 1);
    }

    async function selectGuild(guildId) {
        if (!guildId || guildId === currentGuildId) return;

        try {
            const res = await fetch('/api/guilds/select', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guildId })
            });

            if (!res.ok) {
                throw new Error('No se pudo cambiar de servidor');
            }

            currentGuildId = guildId;
            await loadGuilds();
            await updateStats();
            await refreshData();
            await refreshWelcomeSettings();

            const logsScreen = document.getElementById('logs-screen');
            const achievementsScreen = document.getElementById('achievements-screen');
            const musicScreen = document.getElementById('music-screen');
            const ticketsScreen = document.getElementById('tickets-screen');

            if (logsScreen?.classList.contains('active')) {
                await loadSystemLogs();
            }
            if (achievementsScreen?.classList.contains('active')) {
                await refreshAchievements();
            }
            if (musicScreen?.classList.contains('active')) {
                await refreshMusicStatus();
                await loadMusicLogs();
                await loadPlaylists();
            }
            if (ticketsScreen?.classList.contains('active')) {
                await loadTickets();
            }
        } catch (err) {
            console.error('Error switching guild', err);
            await loadGuilds();
        }
    }

    async function loadInitialData() {
        try {
            await loadGuilds();
            const [usersRes, rolesRes] = await Promise.all([
                fetch('/api/users'),
                fetch('/api/roles')
            ]);
            
            if (usersRes.ok) allUsers = await usersRes.json();
            if (rolesRes.ok) allRoles = await rolesRes.json();
            
            renderUserTable();
            renderBotTable();
            setupSearchInputs();
        } catch (err) { console.error("Error fetching data", err); }
    }

    async function refreshData() {
        const usersRes = await fetch('/api/users');
        if (usersRes.ok) {
            allUsers = await usersRes.json();
            renderUserTable();
            renderBotTable();
        }
    }

    async function updateStats() {
        try {
            const res = await fetch('/api/status');
            const resMusic = await fetch('/api/music/status');
            
            if (res.ok) {
                const data = await res.json();
                document.getElementById('stat-guilds').textContent = data.guildCount;
                document.getElementById('stat-users').textContent = data.userCount;
                
                const indicator = document.getElementById('bot-live-indicator');
                if (indicator) {
                    indicator.textContent = 'Online';
                    indicator.className = 'status-pill online';
                }
                const tagDisplay = document.getElementById('bot-tag-display');
                if (tagDisplay) tagDisplay.textContent = data.botTag || '---';
                const guildDisplay = document.getElementById('active-guild-display');
                if (guildDisplay) guildDisplay.textContent = data.activeGuildName || '---';
            }

            if (resMusic.ok) {
                const dataMusic = await resMusic.json();
                const musicDisplay = document.getElementById('bot-music-display');
                if (musicDisplay) {
                    musicDisplay.textContent = dataMusic.active ? (dataMusic.currentTrack || 'Música') : 'Nada';
                    musicDisplay.className = dataMusic.active ? 'is-playing' : '';
                }
            }
        } catch (err) {
            const indicator = document.getElementById('bot-live-indicator');
            if (indicator) {
                indicator.textContent = 'Offline';
                indicator.className = 'status-pill offline';
            }
            const guildDisplay = document.getElementById('active-guild-display');
            if (guildDisplay) guildDisplay.textContent = '---';
        }
    }

    // --- Rendering Logic ---
    function renderUserTable() {
        if (!userTableBody) return;
        userTableBody.innerHTML = '';
        
        // Filter out bots and applied category filter
        const filtered = allUsers.filter(u => {
            if (u.isBot) return false;
            if (currentFilter === 'all') return true;
            if (currentFilter === 'admins') return u.isAdmin;
            if (currentFilter === 'mods') return u.roles.some(r => r.name.toLowerCase().includes('mod'));
            if (currentFilter === 'normal') return !u.isAdmin && !u.roles.some(r => r.name.toLowerCase().includes('mod'));
            return true;
        });

        filtered.forEach(u => appendUserRow(userTableBody, u));
    }

    function renderBotTable() {
        if (!botTableBody) return;
        botTableBody.innerHTML = '';
        const bots = allUsers.filter(u => u.isBot);
        bots.forEach(b => appendUserRow(botTableBody, b));
    }

    function appendUserRow(table, u) {
        const tr = document.createElement('tr');
        
        // Celda de usuario (avatar + info)
        const userCell = document.createElement('td');
        userCell.className = 'user-cell';
        
        const avatar = document.createElement('img');
        avatar.src = sanitizeUrl(u.avatarUrl);
        avatar.className = 'user-avatar';
        avatar.alt = 'Avatar';
        
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        
        const displayName = document.createElement('span');
        displayName.className = 'display-name';
        displayName.textContent = u.displayName; // Seguro: usa textContent
        
        const userTag = document.createElement('span');
        userTag.className = 'user-tag';
        userTag.textContent = `@${u.username}`; // Seguro: usa textContent
        
        userInfo.appendChild(displayName);
        userInfo.appendChild(userTag);
        userCell.appendChild(avatar);
        userCell.appendChild(userInfo);
        
        // Celda de roles
        const rolesCell = document.createElement('td');
        const roleTags = document.createElement('div');
        roleTags.className = 'role-tags';
        
        u.roles.forEach(r => {
            const roleBadge = document.createElement('span');
            roleBadge.className = 'role-badge';
            roleBadge.style.borderColor = `${r.color}44`;
            roleBadge.style.color = r.color;
            roleBadge.textContent = r.name; // Seguro: usa textContent
            
            const removeBtn = document.createElement('span');
            removeBtn.className = 'btn-remove-role';
            removeBtn.textContent = '×';
            removeBtn.onclick = () => manageRole(u.id, r.id, 'remove');
            
            roleBadge.appendChild(removeBtn);
            roleTags.appendChild(roleBadge);
        });
        
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-add-role';
        addBtn.textContent = '+ Añadir';
        addBtn.onclick = (event) => showRoleAdd(event, u.id);
        
        roleTags.appendChild(addBtn);
        rolesCell.appendChild(roleTags);
        
        // Celda de acciones
        const actionsCell = document.createElement('td');
        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-action-small';
        copyBtn.textContent = 'Copiar ID';
        copyBtn.onclick = () => copyId(u.id);
        
        actionsCell.appendChild(copyBtn);
        
        // Ensamblar fila
        tr.appendChild(userCell);
        tr.appendChild(rolesCell);
        tr.appendChild(actionsCell);
        table.appendChild(tr);
    }

    window.manageRole = async (userId, roleId, action) => {
        try {
            const res = await fetch(`/api/users/${userId}/roles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roleId, action })
            });
            if (res.ok) refreshData();
        } catch (err) { console.error("Error managing role", err); }
    };

    window.showRoleAdd = (event, userId) => {
        const user = allUsers.find(u => u.id === userId);
        const existingRolesIds = user.roles.map(r => r.id);
        const available = allRoles.filter(r => !existingRolesIds.includes(r.id));
        
        const dropdown = document.createElement('div');
        dropdown.className = 'role-add-dropdown';
        
        // Calculate position (avoid overflow)
        const top = event.pageY + 10;
        const left = Math.min(event.pageX - 100, window.innerWidth - 220);
        
        dropdown.style.top = top + 'px';
        dropdown.style.left = left + 'px';

        available.forEach(r => {
            const opt = document.createElement('div');
            opt.className = 'role-option';
            // Use role color as a left border indicator for better visibility
            opt.style.borderLeft = `4px solid ${r.color || 'var(--text-muted)'}`;
            opt.textContent = r.name;
            opt.onclick = () => {
                manageRole(userId, r.id, 'add');
                dropdown.remove();
            };
            dropdown.appendChild(opt);
        });

        if (available.length === 0) {
            const opt = document.createElement('div');
            opt.className = 'role-option';
            opt.textContent = "Sin roles extra";
            dropdown.appendChild(opt);
        }

        document.body.appendChild(dropdown);
        const close = () => { dropdown.remove(); document.removeEventListener('click', close); };
        setTimeout(() => document.addEventListener('click', close), 10);
    };

    window.copyId = (id) => {
        navigator.clipboard.writeText(id).then(() => {
            const btn = event.target;
            const originalText = btn.textContent;
            btn.textContent = 'Copiado!';
            btn.style.borderColor = '#10b981';
            setTimeout(() => { btn.textContent = originalText; btn.style.borderColor = ''; }, 2000);
        });
    };

    // --- Search & Setup Logic ---
    function setupSearchInputs() {
        setupUserSearch(document.getElementById('user-search-admin'), document.getElementById('user-dropdown-admin'), (u) => {
            if (selectedAdmins.length < 3 && !selectedAdmins.find(x => x.id === u.id)) {
                selectedAdmins.push(u);
                renderChips('selected-admins', selectedAdmins, (id) => {
                    selectedAdmins = selectedAdmins.filter(x => x.id !== id);
                });
            }
        });
        setupUserSearch(document.getElementById('user-search-mod'), document.getElementById('user-dropdown-mod'), (u) => {
            if (selectedMods.length < 3 && !selectedMods.find(x => x.id === u.id)) {
                selectedMods.push(u);
                renderChips('selected-mods', selectedMods, (id) => {
                    selectedMods = selectedMods.filter(x => x.id !== id);
                });
            }
        });
    }

    function setupUserSearch(input, dropdown, onSelect) {
        if (!input) return;
        input.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            dropdown.innerHTML = ''; // Limpiar dropdown
            if (!val) return dropdown.classList.add('hidden');

            const filtered = allUsers.filter(u => !u.isBot && (u.username.toLowerCase().includes(val) || u.displayName.toLowerCase().includes(val))).slice(0, 5);
            filtered.forEach(u => {
                const d = document.createElement('div');
                d.className = 'user-dropdown-item';
                
                // Crear elementos de forma segura
                const img = document.createElement('img');
                img.src = sanitizeUrl(u.avatarUrl);
                img.alt = 'Avatar';
                
                const span = document.createElement('span');
                span.textContent = u.displayName; // Seguro: usa textContent
                
                d.appendChild(img);
                d.appendChild(span);
                d.onclick = () => { onSelect(u); input.value = ''; dropdown.classList.add('hidden'); };
                dropdown.appendChild(d);
            });
            dropdown.classList.remove('hidden');
        });
    }

    function renderChips(containerId, list, onRemove) {
        const container = document.getElementById(containerId);
        container.innerHTML = ''; // Limpiar contenedor
        list.forEach(u => {
            const chip = document.createElement('div');
            chip.className = 'user-chip';
            
            // Crear elementos de forma segura
            const img = document.createElement('img');
            img.src = sanitizeUrl(u.avatarUrl);
            img.alt = 'Avatar';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = u.displayName; // Seguro: usa textContent
            
            const removeSpan = document.createElement('span');
            removeSpan.style.cursor = 'pointer';
            removeSpan.textContent = '×';
            removeSpan.onclick = () => {
                chip.remove();
                window.triggerRemove(containerId, u.id);
            };
            
            chip.appendChild(img);
            chip.appendChild(nameSpan);
            chip.appendChild(removeSpan);
            container.appendChild(chip);
        });
    }

    window.triggerRemove = (cid, uid) => {
        if (cid === 'selected-admins') selectedAdmins = selectedAdmins.filter(u => u.id !== uid);
        else selectedMods = selectedMods.filter(u => u.id !== uid);
    };

    setupBtn.addEventListener('click', async () => {
        if (!confirm('¿Ejecutar configuración avanzada?')) return;
        setupBtn.disabled = true;
        logContent.innerHTML = '⚙️ Iniciando migración...\n';
        try {
            const response = await fetch('/api/setup', {
                method: 'POST',
                headers: { 'x-admins': selectedAdmins.map(u => u.id).join(','), 'x-mods': selectedMods.map(u => u.id).join(',') }
            });
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                decoder.decode(value).split('\n').forEach(line => {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.substring(6));
                        if (data.message) {
                            logContent.innerHTML += `${data.message}\n`;
                            logContent.scrollTop = logContent.scrollHeight;
                        }
                    }
                });
            }
        } catch (err) { logContent.innerHTML += `❌ Error: ${err.message}\n`; }
        setupBtn.disabled = false;
    });

    restartBtn.addEventListener('click', async () => {
        if (confirm('¿Reiniciar bot?')) {
            fetch('/api/restart', { method: 'POST' });
            reconnectOverlay.classList.remove('hidden');
            setInterval(async () => {
                try { if ((await fetch('/api/status')).ok) window.location.reload(); } catch (e) {}
            }, 3000);
        }
    });

    logoutBtn.addEventListener('click', () => {
        logoutBtn.disabled = true;
        logoutBtn.textContent = 'Cerrando sesión…';
        fetch('/api/logout', { method: 'POST' }).then(() => window.location.reload());
    });

    // --- Mobile Sidebar Toggle ---
    if (menuToggle) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('open');
        });
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menuToggle) {
            sidebar.classList.remove('open');
        }
    });

    // Theme Card Event Listeners
    document.querySelectorAll('.theme-card').forEach(card => {
        card.addEventListener('click', () => {
            const themeId = card.dataset.themeId;
            setTheme(themeId);
        });
    });

    // Mobile Navigation (Close on click)
    if (window.innerWidth < 768) {
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                sidebar.classList.remove('active');
            });
        });
    }

    // --- Welcome & Goodbye Logic ---
    async function refreshWelcomeSettings() {
        try {
            // 1. Cargar canales para los selects
            const resChannels = await fetch('/api/guild/channels');
            if (resChannels.ok) {
                const channels = await resChannels.json();
                const welcomeSelect = document.getElementById('welcome-channel');
                const goodbyeSelect = document.getElementById('goodbye-channel');
                
                // Los canales ya vienen filtrados por tipo 0 desde el backend
                const options = channels.map(c => `<option value="${c.id}"># ${c.name}</option>`).join('');
                welcomeSelect.innerHTML = `<option value="">Selecciona un canal...</option>` + options;
                goodbyeSelect.innerHTML = `<option value="">Selecciona un canal...</option>` + options;
            }

            // 2. Cargar configuración actual (con timeout para asegurar que el DOM cargó los options)
            setTimeout(async () => {
                const resSettings = await fetch('/api/settings/welcome');
                if (resSettings.ok) {
                    const data = await resSettings.json();
                    document.getElementById('welcome-toggle').checked = data.welcome_enabled;
                    document.getElementById('welcome-channel').value = data.welcome_channel || '';
                    document.getElementById('welcome-msg').value = data.welcome_message;
                    
                    document.getElementById('goodbye-toggle').checked = data.goodbye_enabled;
                    document.getElementById('goodbye-channel').value = data.goodbye_channel || '';
                    document.getElementById('goodbye-msg').value = data.goodbye_message;
                }
            }, 100);
        } catch (err) { console.error("Error al cargar configuración", err); }
    }

    // --- Achievements Logic ---
    async function refreshAchievements() {
        if (!currentUser) {
            console.warn("[Achievements] currentUser no definido aún, reintentando...");
            setTimeout(refreshAchievements, 500);
            return;
        }
        const grid = document.getElementById('achievements-grid');
        grid.innerHTML = '<p>Cargando logros...</p>';

        try {
            const [allRes, userRes] = await Promise.all([
                fetch('/api/achievements'),
                fetch(`/api/users/${currentUser.id}/achievements`)
            ]);

            if (allRes.ok && userRes.ok) {
                const all = await allRes.json();
                const earned = await userRes.json();
                const earnedIds = new Set(earned.map(a => a.id));

                grid.innerHTML = all.map(a => `
                    <div class="achievement-badge ${earnedIds.has(a.id) ? 'unlocked' : 'locked'}">
                        <div class="badge-icon-wrapper">
                            ${a.icon || '🏆'}
                        </div>
                        <span class="badge-name">${a.name}</span>
                        <span class="badge-desc">${a.description}</span>
                    </div>
                `).join('') || '<p>No hay logros configurados aún.</p>';
            }
        } catch (err) { 
            grid.innerHTML = '<p>Error cargando logros.</p>';
            console.error(err); 
        }
    }

    document.getElementById('save-welcome-btn')?.addEventListener('click', async () => {
        const payload = {
            welcome_enabled: document.getElementById('welcome-toggle').checked,
            welcome_channel: document.getElementById('welcome-channel').value,
            welcome_message: document.getElementById('welcome-msg').value,
            goodbye_enabled: document.getElementById('goodbye-toggle').checked,
            goodbye_channel: document.getElementById('goodbye-channel').value,
            goodbye_message: document.getElementById('goodbye-msg').value,
        };

        try {
            const res = await fetch('/api/settings/welcome', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                alert('¡Configuración guardada!');
            }
        } catch (err) { alert('Error al guardar'); }
    });



    // --- Env Variables Logic ---
    async function refreshEnvSettings() {
        try {
            const res = await fetch('/api/system/env');
            if (res.ok) {
                const data = await res.json();
                Object.keys(data).forEach(key => {
                    const input = document.getElementById(`env-${key}`);
                    if (input) {
                        input.value = data[key];
                    }
                });
            }
        } catch (err) { console.error("Error loading env", err); }
    }

    window.toggleSecret = (id) => {
        const input = document.getElementById(id);
        if (input.type === 'password') input.type = 'text';
        else input.type = 'password';
    };

    document.getElementById('save-env-btn')?.addEventListener('click', async () => {
        const payload = {};
        const inputs = document.querySelectorAll('[id^="env-"]');
        inputs.forEach(input => {
            const key = input.id.replace('env-', '');
            payload[key] = input.value;
        });

        try {
            const res = await fetch('/api/system/env', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const data = await res.json();
                alert(data.message || 'Configuración guardada');
                refreshEnvSettings();
            }
        } catch (err) { alert('Error al guardar variables'); }
    });

    document.getElementById('sync-github-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('sync-github-btn');
        const syncLog = document.getElementById('github-sync-log');
        btn.disabled = true;
        syncLog.classList.remove('hidden');
        syncLog.innerHTML = '<div class="log-entry system">🔄 Iniciando conexión con la API de GitHub...</div>';
        
        try {
            const res = await fetch('/api/system/github/sync', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                syncLog.innerHTML += `<div class="log-entry success">✅ ${data.message}</div>`;
                alert(data.message);
            } else {
                syncLog.innerHTML += `<div class="log-entry error">❌ Error: ${data.error}</div>`;
                alert(data.error);
            }
        } catch (err) { 
            syncLog.innerHTML += `<div class="log-entry error">❌ Error de conexión</div>`;
            alert('Error en la sincronización'); 
        }
        
        btn.disabled = false;
    });

    // --- Music System Logic ---
    // --- Music System Logic (Console & Monitoring) ---
    const musicConsole = document.getElementById('music-console-log');

    function addLogEntry(data) {
        if (!logContent && !musicConsole) return;
        
        const entry = document.createElement('div');
        entry.className = `log-entry ${data.level || 'info'}`;
        const time = new Date(data.timestamp || Date.now()).toLocaleTimeString();
        entry.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-msg">${data.message}</span>`;
        
        // Add to Music Console if it's a music log or we are in music screen
        if (data.type === 'music:log' && musicConsole) {
            musicConsole.appendChild(entry.cloneNode(true));
            musicConsole.scrollTop = musicConsole.scrollHeight;
            if (musicConsole.childNodes.length > 50) musicConsole.removeChild(musicConsole.firstChild);
        }

        // Add to System Log if it's a system log or we are in logs screen
        if (logContent) {
            logContent.appendChild(entry);
            logContent.scrollTop = logContent.scrollHeight;
            if (logContent.childNodes.length > 100) logContent.removeChild(logContent.firstChild);
        }
    }

    let musicWS = null;
    function connectMusicWS() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/music/logs`;
        musicWS = new WebSocket(wsUrl);

        musicWS.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'music:log' || data.type === 'system:log') {
                addLogEntry(data);
            } else if (data.type === 'status') {
                addLogEntry({ level: 'system', message: data.message });
            }
        };

        musicWS.onclose = () => {
            console.log('[MusicWS] Closed. Reconnecting in 5s...');
            setTimeout(connectMusicWS, 5000);
        };
    }

    // Cargar logs históricos al entrar
    async function loadMusicLogs() {
        try {
            const res = await fetch('/api/music/logs');
            if (res.ok) {
                const logs = await res.json();
                if (musicConsole) musicConsole.innerHTML = '';
                logs.reverse().forEach(log => {
                    log.type = 'music:log';
                    addLogEntry(log);
                });
            }
        } catch (err) { console.error('Error loading music logs:', err); }
    }

    async function loadSystemLogs() {
        try {
            const res = await fetch('/api/logs/system');
            if (res.ok) {
                const logs = await res.json();
                if (logContent) logContent.innerHTML = '';
                logs.reverse().forEach(log => {
                    log.type = 'system:log';
                    addLogEntry(log);
                });
            }
        } catch (err) { console.error('Error loading system logs:', err); }
    }

    if (musicConsole) {
        connectMusicWS();
        loadMusicLogs();
    }

    async function refreshMusicStatus() {
        try {
            const res = await fetch('/api/music/status');
            if (!res.ok) return;
            const data = await res.json();
            const statusText = document.getElementById('player-status-text');
            const trackTitle = document.getElementById('current-track-title');
            const trackAuthor = document.getElementById('current-track-author');

            if (data.active) {
                if (statusText) statusText.innerText = 'Transmitiendo en vivo';
                if (trackTitle) trackTitle.innerText = data.currentTrack || 'Reproduciendo...';
                if (trackAuthor) trackAuthor.innerText = data.channelId || data.channel || 'Canal de voz activo';
            } else {
                if (statusText) statusText.innerText = 'Sin reproduccion';
                if (trackTitle) trackTitle.innerText = 'Nada sonando';
                if (trackAuthor) trackAuthor.innerText = 'Usa Play o Queue para comenzar';
            }
        } catch (err) { console.error('Error refreshing music status:', err); }
    }

    async function musicControl(action, query = '') {
        const res = await fetch('/api/music/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, query })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error en control de musica');
        await refreshMusicStatus();
        return data;
    }

    async function loadPlaylists() {
        const output = document.getElementById('playlist-console');
        if (!output) return;
        const res = await fetch('/api/playlists');
        const data = await res.json();
        if (!res.ok) {
            output.textContent = `Error: ${data.error || 'No se pudo cargar playlists'}`;
            return;
        }
        output.textContent = data.length
            ? data.map((p) => `- ${p.name} (${p.item_count} tracks)`).join('\n')
            : 'Sin playlists cargadas.';
    }

    async function loadTickets() {
        const output = document.getElementById('tickets-console');
        if (!output) return;
        const res = await fetch('/api/tickets?status=open');
        const data = await res.json();
        if (!res.ok) {
            output.textContent = `Error: ${data.error || 'No se pudo cargar tickets'}`;
            return;
        }
        output.textContent = data.length
            ? data.map((t) => `#${t.id} [${t.status}] ${t.title}`).join('\n')
            : 'Sin tickets.';
    }

    setInterval(() => {
        const musicScreen = document.getElementById('music-screen');
        if (musicScreen && musicScreen.classList.contains('active')) {
            refreshMusicStatus();
        }
    }, 5000);

    document.getElementById('music-play-btn')?.addEventListener('click', async () => {
        try {
            const query = document.getElementById('web-music-query')?.value?.trim();
            if (!query) return alert('Escribe una busqueda o URL.');
            await musicControl('play', query);
        } catch (err) { alert(err.message); }
    });
    document.getElementById('music-queue-btn')?.addEventListener('click', async () => {
        try {
            const query = document.getElementById('web-music-query')?.value?.trim();
            if (!query) return alert('Escribe una busqueda o URL.');
            await musicControl('queue', query);
        } catch (err) { alert(err.message); }
    });
    document.getElementById('music-pause-btn')?.addEventListener('click', async () => { try { await musicControl('pause'); } catch (err) { alert(err.message); } });
    document.getElementById('music-resume-btn')?.addEventListener('click', async () => { try { await musicControl('resume'); } catch (err) { alert(err.message); } });
    document.getElementById('music-skip-btn')?.addEventListener('click', async () => { try { await musicControl('skip'); } catch (err) { alert(err.message); } });
    document.getElementById('music-prev-btn')?.addEventListener('click', async () => { try { await musicControl('previous'); } catch (err) { alert(err.message); } });
    document.getElementById('music-stop-btn')?.addEventListener('click', async () => { try { await musicControl('stop'); } catch (err) { alert(err.message); } });

    document.getElementById('playlist-refresh-btn')?.addEventListener('click', loadPlaylists);
    document.getElementById('playlist-create-btn')?.addEventListener('click', async () => {
        const name = document.getElementById('playlist-name-input')?.value?.trim();
        if (!name) return alert('Nombre requerido');
        const res = await fetch('/api/playlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'No se pudo crear playlist');
        await loadPlaylists();
    });
    document.getElementById('playlist-add-btn')?.addEventListener('click', async () => {
        const name = document.getElementById('playlist-name-input')?.value?.trim();
        const query = document.getElementById('playlist-query-input')?.value?.trim();
        if (!name || !query) return alert('Nombre y track son requeridos');
        const res = await fetch(`/api/playlists/${encodeURIComponent(name)}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'No se pudo agregar track');
        await loadPlaylists();
    });
    document.getElementById('playlist-import-spotify-btn')?.addEventListener('click', async () => {
        const name = document.getElementById('playlist-name-input')?.value?.trim();
        const spotifyUrl = document.getElementById('playlist-query-input')?.value?.trim();
        if (!name || !spotifyUrl) return alert('Nombre de playlist y URL de Spotify requeridos');
        const res = await fetch(`/api/playlists/${encodeURIComponent(name)}/import-spotify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spotifyUrl })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'No se pudo importar desde Spotify');
        alert(`Importados ${data.imported} tracks a ${name}`);
        await loadPlaylists();
    });
    document.getElementById('playlist-play-btn')?.addEventListener('click', async () => {
        const name = document.getElementById('playlist-name-input')?.value?.trim();
        if (!name) return alert('Nombre requerido');
        const res = await fetch(`/api/playlists/${encodeURIComponent(name)}/play`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'No se pudo reproducir playlist');
        await refreshMusicStatus();
        await loadPlaylists();
    });

    document.getElementById('ticket-refresh-btn')?.addEventListener('click', loadTickets);
    document.getElementById('ticket-create-btn')?.addEventListener('click', async () => {
        const title = document.getElementById('ticket-title-input')?.value?.trim();
        if (!title) return alert('Titulo requerido');
        const res = await fetch('/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'No se pudo crear ticket');
        await loadTickets();
    });

    console.log('Dashboard initialized successfully');
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('open');
        }
    });
});
