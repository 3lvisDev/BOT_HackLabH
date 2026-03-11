# 🤖 Bot de Discord HackLab - Comunidad de Programación

Bot completo desarrollado en Node.js para gestionar servidores de Discord enfocados en comunidades de programación, con sistema de música, logros, dashboard web premium y más.

## ✨ Características Principales

### 🎵 Sistema de Música con YouTube Premium
- Reproduce audio de YouTube en canales de voz usando navegador virtual (Playwright + Chromium)
- Soporte para YouTube Premium (sin anuncios)
- Comandos: `!play <búsqueda o URL>` y `!stop`
- Dashboard web para configurar cookies de YouTube Premium
- Logs en tiempo real con WebSocket
- Encriptación AES-256-CBC para cookies
- Validación de inputs y sanitización contra XSS

### 🏆 Sistema de Logros
- Logros automáticos por actividad en el servidor
- Persistencia en base de datos SQLite
- Visualización en dashboard web

### 🎨 Dashboard Web Premium
- Diseño moderno con glassmorphism
- Temas premium: Obsidian, Crystal, Midnight
- Monitoreo en tiempo real del bot
- Configuración de música y cookies YT Premium
- Consola de logs en vivo
- Autenticación segura con sesiones

### 🔐 Gestión de Servidor
- Configuración automática de roles (`Admin`, `Desarrollador`)
- Asignación automática de roles a nuevos miembros
- Creación de canales enfocados a desarrolladores
- Mensajes de bienvenida y despedida personalizables
- Permisos granulares y seguros

### 🛡️ Seguridad
- Rate limiting en endpoints críticos
- Sanitización de inputs contra XSS
- Cookies de sesión seguras (httpOnly, secure, sameSite)
- CORS configurado correctamente
- Encriptación de datos sensibles
- Property-based testing para validación de invariantes

## 📋 Requisitos Previos

### Software Necesario:
- [Node.js](https://nodejs.org/) v16+ (o Docker como alternativa)
- [FFmpeg](https://ffmpeg.org/) (para sistema de música)
- PulseAudio (para captura de audio en Linux/Docker)

### Configuración de Discord:
1. Token del bot desde el [Portal de Desarrolladores de Discord](https://discord.com/developers/applications)
2. Permisos requeridos al invitar el bot:
   - `Administrator` (para gestión completa)
   - `Connect` y `Speak` (para canales de voz)
3. Privileged Gateway Intents habilitados:
   - `Server Members Intent`
   - `Message Content Intent`
   - `Presence Intent`

## ⚙️ Instalación y Configuración

### 1. Clonar y Configurar

```bash
git clone <repository-url>
cd BOT_HackLabH
```

### 2. Configurar Variables de Entorno

Renombra `.env.example` a `.env` y completa:

```env
# Discord Bot
DISCORD_TOKEN=tu_token_aqui

# Web Dashboard
PORT=3000
WEB_ADMIN_PASSWORD=tu_password_seguro
SESSION_SECRET=genera_un_secret_aleatorio

# Seguridad (Música)
ENCRYPTION_KEY=genera_32_bytes_hex
# Generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Instalar Dependencias

```bash
npm install
npx playwright install chromium
```

### 4. Iniciar el Bot

```bash
npm start
```

## 🐋 Ejecución con Docker (Recomendado)

### Construcción de la Imagen

```bash
docker build -t discord-bot-hacklab .
```

### Ejecutar el Contenedor

```bash
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name mi-hacklab-bot \
  discord-bot-hacklab
```

### Comandos Útiles

```bash
# Ver logs en tiempo real
docker logs -f mi-hacklab-bot

# Reiniciar el bot
docker restart mi-hacklab-bot

# Detener el bot
docker stop mi-hacklab-bot

# Eliminar el contenedor
docker rm mi-hacklab-bot
```

## 🎮 Uso del Bot

### Comandos de Discord

#### Sistema de Música
```
!play <búsqueda o URL>  - Reproduce música de YouTube
!stop                   - Detiene la reproducción actual
```

#### Gestión de Servidor
```
!setup_community  - Configura automáticamente el servidor
```

### Panel Web de Administración

1. Accede a `http://localhost:3000` (o tu dominio configurado)
2. Inicia sesión con `WEB_ADMIN_PASSWORD`
3. Funcionalidades disponibles:
   - 📊 Dashboard con estadísticas en tiempo real
   - 🎵 Configuración de cookies YouTube Premium
   - 📝 Consola de logs en vivo con WebSocket
   - 🏆 Visualización de logros del servidor
   - 🎨 Selector de temas premium (Obsidian, Crystal, Midnight)
   - ⚙️ Configuración de mensajes de bienvenida/despedida

### Configurar YouTube Premium (Opcional)

Para reproducir música sin anuncios:

1. Accede al dashboard web
2. Ve a la sección "Música"
3. Exporta las cookies de tu cuenta YouTube Premium usando una extensión como [EditThisCookie](https://chrome.google.com/webstore/detail/editthiscookie/)
4. Pega el JSON de cookies en el formulario
5. Las cookies se encriptarán automáticamente con AES-256-CBC


## 🧪 Testing

### Ejecutar Tests

```bash
# Todos los tests
node tests/run-tests.js

# Tests específicos
node tests/bugfix-welcome-goodbye.test.js
node tests/music_properties.test.js
node tests/preservation.test.js
```

### Property-Based Testing

El proyecto incluye tests basados en propiedades usando `fast-check` para validar invariantes del sistema:

- Validación de queries de música
- Encriptación/desencriptación de cookies
- Estructura de cookies de YouTube
- Sanitización de inputs
- Invariantes de sesión única

## 📁 Estructura del Proyecto

```
BOT_HackLabH/
├── commands/           # Comandos de Discord
│   └── music.js       # Comandos de música
├── music/             # Sistema de música
│   ├── MusicManager.js    # Gestor principal
│   ├── validation.js      # Validación de inputs
│   └── logger.js          # Sistema de logging
├── public/            # Frontend del dashboard
│   ├── index.html     # Dashboard principal
│   ├── script.js      # Lógica del cliente
│   ├── sanitize.js    # Sanitización XSS
│   └── style.css      # Estilos premium
├── tests/             # Suite de tests
│   ├── music_properties.test.js
│   ├── bugfix-welcome-goodbye.test.js
│   └── preservation.test.js
├── .kiro/specs/       # Especificaciones técnicas
│   ├── youtube-premium-music-system/
│   ├── xss-dashboard-sanitization/
│   └── welcome-goodbye-messages-crash-fix/
├── index.js           # Bot principal de Discord
├── dashboard.js       # Servidor web Express
├── db.js              # Gestión de base de datos SQLite
├── SECURITY.md        # Documentación de seguridad
└── README.md          # Este archivo
```

## 🔒 Seguridad

Este proyecto implementa múltiples capas de seguridad:

- ✅ Encriptación AES-256-CBC para datos sensibles
- ✅ Sanitización de inputs contra XSS
- ✅ Rate limiting en endpoints críticos
- ✅ Cookies de sesión seguras (httpOnly, secure, sameSite)
- ✅ CORS configurado correctamente
- ✅ Validación de inputs con property-based testing
- ✅ Manejo seguro de errores sin exponer información sensible

Ver [SECURITY.md](SECURITY.md) para más detalles.

## 📊 Auditorías y Revisiones

El proyecto ha pasado por múltiples auditorías de código y seguridad:

- **Primera Auditoría:** Identificó 5 errores críticos (ver `.kiro/specs/youtube-premium-music-system/REVIEW_REPORT.md`)
- **Segunda Auditoría:** ✅ APROBADO - Todos los errores corregidos (ver `.kiro/specs/youtube-premium-music-system/AUDIT_2_REPORT.md`)
- **Progreso:** 25% → 75% (+50%)
- **Vulnerabilidades resueltas:** CWE-312, CWE-20

## 🛠️ Tecnologías Utilizadas

- **Backend:** Node.js, Discord.js, Express
- **Base de Datos:** SQLite3
- **Música:** Playwright, Chromium, FFmpeg, PulseAudio, @discordjs/voice
- **Frontend:** HTML5, CSS3 (Glassmorphism), JavaScript (Vanilla)
- **Seguridad:** crypto (Node.js), express-rate-limit, helmet
- **Testing:** fast-check (property-based testing)
- **Containerización:** Docker

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la licencia MIT. Ver archivo `LICENSE` para más detalles.

## 👥 Autores

- **HackLab Community** - Desarrollo y mantenimiento

## 🙏 Agradecimientos

- Comunidad de Discord.js
- Playwright Team
- fast-check para property-based testing
- Todos los contribuidores del proyecto

---

**Nota:** Este bot está en desarrollo activo. Algunas características pueden estar en fase beta. Reporta cualquier bug en la sección de Issues.
