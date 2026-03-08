document.addEventListener('DOMContentLoaded', () => {
    const loginView = document.getElementById('login-view');
    const dashView = document.getElementById('dashboard-view');
    const logoutBtn = document.getElementById('logout-btn');
    const setupBtn = document.getElementById('setup-btn');
    const restartBtn = document.getElementById('restart-btn');
    const reconnectOverlay = document.getElementById('reconnect-overlay');
    const logContent = document.getElementById('log-content');
    const userSearchAdmin = document.getElementById('user-search-admin');
    const userDropdownAdmin = document.getElementById('user-dropdown-admin');
    const selectedAdminsGrid = document.getElementById('selected-admins');

    const userSearchMod = document.getElementById('user-search-mod');
    const userDropdownMod = document.getElementById('user-dropdown-mod');
    const selectedModsGrid = document.getElementById('selected-mods');

    let allUsers = [];
    let selectedAdmins = [];
    let selectedMods = [];

    // Validar sesión al cargar
    checkSession();

    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
        } catch (e) {}

        dashView.classList.remove('active');
        dashView.classList.add('hidden');
        setTimeout(() => {
            loginView.classList.remove('hidden');
            loginView.classList.add('active');
        }, 500);
    });

    setupBtn.addEventListener('click', async () => {
        if (!confirm('¿Estás seguro de que quieres ejecutar el Setup Automático? Esto ajustará roles y canales en el servidor.')) return;
        
        setupBtn.disabled = true;
        setupBtn.innerHTML = '<span>Ejecutando...</span>';
        logContent.innerHTML = 'Iniciando conexión con el servidor...\n';

        try {
            const extraAdmins = selectedAdmins.map(u => u.id).join(',');
            const extraMods = selectedMods.map(u => u.id).join(',');

            const response = await fetch('/api/setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admins': extraAdmins,
                    'x-mods': extraMods
                }
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                lines.forEach(line => {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            if (data.message) {
                                let color = "#10b981"; // green default
                                if (data.message.includes("❌")) color = "#ef4444";
                                else if (data.message.includes("⚙️")) color = "#3b82f6";
                                
                                logContent.innerHTML += `<span style="color:${color}">${data.message}</span>\n`;
                                logContent.scrollTop = logContent.scrollHeight;
                            }
                        } catch (e) {}
                    }
                });
            }
        } catch (error) {
            logContent.innerHTML += `\n<span style="color:#ef4444">Error de conexión: ${error.message}</span>\n`;
        }

        setupBtn.disabled = false;
        setupBtn.innerHTML = '<span>Re-ejecutar Configuración Automática</span>';
    });

    restartBtn.addEventListener('click', async () => {
        if (!confirm('Reinicio del bot: El panel se desconectará temporalmente. ¿Continuar?')) return;
        
        try {
            await fetch('/api/restart', { method: 'POST' });
        } catch (e) {}
        
        reconnectOverlay.classList.remove('hidden');
        pollForReconnection();
    });

    async function pollForReconnection() {
        // Hacemos polling cada 3 segundos hasta que el backend reviva
        setInterval(async () => {
            try {
                const res = await fetch('/api/status', {
                   headers: { 'Cache-Control': 'no-cache' } 
                });
                if (res.ok) {
                    window.location.reload(); // Recargar página entera al reconectar
                }
            } catch (err) {
                // Sigue intentando si falla la conexión (normal durante reinicio)
            }
        }, 3000);
    }

    async function checkSession() {
        try {
            const resMe = await fetch('/api/auth/me');
            
            if (resMe.ok) {
                const dataMe = await resMe.json();
                
                if (dataMe.authenticated) {
                    // Update UI User
                    document.getElementById('bot-name').textContent = dataMe.user.username;
                    document.getElementById('bot-avatar').src = dataMe.user.avatar;
                    
                    // Call Status to get stats
                    const resStatus = await fetch('/api/status');
                    if (resStatus.ok) {
                        const statusData = await resStatus.json();
                        document.getElementById('stat-guilds').textContent = statusData.guildCount;
                        document.getElementById('stat-users').textContent = statusData.userCount;
                    }

                    // Transitions
                    loginView.classList.remove('active');
                    loginView.classList.add('hidden');
                    setTimeout(async () => {
                        loginView.style.display = 'none';
                        dashView.classList.remove('hidden');
                        dashView.style.display = 'block';
                        dashView.classList.add('active');
                        await loadUsers();
                    }, 500);
                }
            } else {
                // Si viene rebotado de Discord Login y no es admin
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('error')) {
                    const errDiv = document.getElementById('login-error');
                    if(errDiv) errDiv.textContent = 'Acceso Denegado: No tienes rol de administrador.';
                }
            }
        } catch (err) {
            console.error('Bot offline o error de red: ', err);
        }
    }

    async function loadUsers() {
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                allUsers = await res.json();
            }
        } catch (err) {
            console.error("Error loading users", err);
        }
    }

    // --- Buscador Genérico ---
    function setupUserSearch(searchInput, dropdownEl, onSelect) {
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            dropdownEl.innerHTML = '';
            if (!val) {
                dropdownEl.classList.add('hidden');
                return;
            }

            const filtered = allUsers.filter(u => 
                u.username.toLowerCase().includes(val) || 
                (u.displayName && u.displayName.toLowerCase().includes(val))
            ).slice(0, 10);

            if (filtered.length === 0) {
                dropdownEl.classList.add('hidden');
                return;
            }

            filtered.forEach(u => {
                const div = document.createElement('div');
                div.className = 'user-dropdown-item';
                div.innerHTML = `
                    <img src="${u.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="avatar">
                    <div class="user-names">
                        <span class="display-name">${u.displayName || u.username}</span>
                        <span class="username">@${u.username}</span>
                    </div>
                `;
                div.addEventListener('click', () => {
                    onSelect(u);
                    searchInput.value = '';
                    dropdownEl.classList.add('hidden');
                });
                dropdownEl.appendChild(div);
            });

            dropdownEl.classList.remove('hidden');
        });
    }

    setupUserSearch(userSearchAdmin, userDropdownAdmin, addUserAdmin);
    setupUserSearch(userSearchMod, userDropdownMod, addUserMod);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-input-wrapper')) {
            userDropdownAdmin.classList.add('hidden');
            userDropdownMod.classList.add('hidden');
        }
    });

    // --- Lógica Administradores ---
    function addUserAdmin(user) {
        if (selectedAdmins.length >= 3) {
            alert('Solo puedes seleccionar hasta 3 administradores.');
            return;
        }
        if (selectedAdmins.find(u => u.id === user.id)) return;
        selectedAdmins.push(user);
        renderSelectedAdmins();
    }

    function removeUserAdmin(userId) {
        selectedAdmins = selectedAdmins.filter(u => u.id !== userId);
        renderSelectedAdmins();
    }
    window.removeAdminChip = removeUserAdmin;

    function renderSelectedAdmins() {
        selectedAdminsGrid.innerHTML = '';
        selectedAdmins.forEach(u => {
            const chip = document.createElement('div');
            chip.className = 'user-chip';
            chip.innerHTML = `
                <img src="${u.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="avatar">
                <span>${u.displayName || u.username}</span>
                <span class="remove-btn" onclick="removeAdminChip('${u.id}')">&times;</span>
            `;
            selectedAdminsGrid.appendChild(chip);
        });
        
        if (selectedAdmins.length >= 3) {
            userSearchAdmin.placeholder = "Límite alcanzado";
            userSearchAdmin.disabled = true;
        } else {
            userSearchAdmin.placeholder = "🔍 Buscar administrador...";
            userSearchAdmin.disabled = false;
        }
    }

    // --- Lógica Moderadores ---
    function addUserMod(user) {
        if (selectedMods.length >= 3) {
            alert('Solo puedes seleccionar hasta 3 moderadores.');
            return;
        }
        if (selectedMods.find(u => u.id === user.id)) return;
        selectedMods.push(user);
        renderSelectedMods();
    }

    function removeUserMod(userId) {
        selectedMods = selectedMods.filter(u => u.id !== userId);
        renderSelectedMods();
    }
    window.removeModChip = removeUserMod;

    function renderSelectedMods() {
        selectedModsGrid.innerHTML = '';
        selectedMods.forEach(u => {
            const chip = document.createElement('div');
            chip.className = 'user-chip';
            chip.innerHTML = `
                <img src="${u.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="avatar">
                <span>${u.displayName || u.username}</span>
                <span class="remove-btn" onclick="removeModChip('${u.id}')">&times;</span>
            `;
            selectedModsGrid.appendChild(chip);
        });
        
        if (selectedMods.length >= 3) {
            userSearchMod.placeholder = "Límite alcanzado";
            userSearchMod.disabled = true;
        } else {
            userSearchMod.placeholder = "🔍 Buscar moderador...";
            userSearchMod.disabled = false;
        }
    }
});
