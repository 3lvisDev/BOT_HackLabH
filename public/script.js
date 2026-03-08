document.addEventListener('DOMContentLoaded', () => {
    // --- State & Constants ---
    let allUsers = [];
    let allRoles = [];
    let selectedAdmins = [];
    let selectedMods = [];
    let currentFilter = 'all';

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

    // --- Theme Management ---
    function setTheme(themeName) {
        localStorage.setItem('hacklab_theme', themeName);
        document.body.setAttribute('data-theme', themeName);
        console.log(`[Theme] Switched to ${themeName}`);
    }

    // Load persisted theme or default to dark
    const savedTheme = localStorage.getItem('hacklab_theme') || 'dark';
    setTheme(savedTheme);

    // --- Initialization ---
    checkSession();

    // --- Navigation & Tab Switching ---
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
        });
    });

    // --- Filters ---
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            renderUserTable();
        });
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
        document.getElementById('sidebar-bot-avatar').src = user.avatar;
        
        // Use the CSS state class for a smooth transition
        document.body.classList.add('is-authenticated');
        
        // Pre-revealing clean up
        loginView.classList.add('hidden');
        dashView.classList.remove('hidden');
        
        updateStats();
        await loadInitialData();
    }

    async function loadInitialData() {
        try {
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
            if (res.ok) {
                const data = await res.json();
                document.getElementById('stat-guilds').textContent = data.guildCount;
                document.getElementById('stat-users').textContent = data.userCount;
            }
        } catch (err) {}
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
        
        const rolesHtml = u.roles.map(r => `
            <span class="role-badge" style="border-color: ${r.color}44; color: ${r.color}">
                ${r.name}
                <span class="btn-remove-role" onclick="manageRole('${u.id}', '${r.id}', 'remove')">&times;</span>
            </span>
        `).join('');

        tr.innerHTML = `
            <td class="user-cell">
                <img src="${u.avatarUrl}" class="user-avatar">
                <div class="user-info">
                    <span class="display-name">${u.displayName}</span>
                    <span class="user-tag">@${u.username}</span>
                </div>
            </td>
            <td>
                <div class="role-tags">
                    ${rolesHtml}
                    <button class="btn-add-role" onclick="showRoleAdd(event, '${u.id}')">+ Añadir</button>
                </div>
            </td>
            <td>
                <button class="btn-action-small" onclick="copyId('${u.id}')">Copiar ID</button>
            </td>
        `;
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
            dropdown.innerHTML = '';
            if (!val) return dropdown.classList.add('hidden');

            const filtered = allUsers.filter(u => !u.isBot && (u.username.toLowerCase().includes(val) || u.displayName.toLowerCase().includes(val))).slice(0, 5);
            filtered.forEach(u => {
                const d = document.createElement('div');
                d.className = 'user-dropdown-item';
                d.innerHTML = `<img src="${u.avatarUrl}"><span>${u.displayName}</span>`;
                d.onclick = () => { onSelect(u); input.value = ''; dropdown.classList.add('hidden'); };
                dropdown.appendChild(d);
            });
            dropdown.classList.remove('hidden');
        });
    }

    function renderChips(containerId, list, onRemove) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        list.forEach(u => {
            const chip = document.createElement('div');
            chip.className = 'user-chip';
            chip.innerHTML = `<img src="${u.avatarUrl}"><span>${u.displayName}</span><span style="cursor:pointer" onclick="this.parentElement.remove(); window.triggerRemove('${containerId}', '${u.id}')">&times;</span>`;
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

    logoutBtn.addEventListener('click', () => fetch('/api/logout', { method: 'POST' }).then(() => window.location.reload()));

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

    // Reset sidebar state on window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('open');
        }
    });
});
