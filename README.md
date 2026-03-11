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

**Tests implementados (8/16):**
1. ✅ Property 7: Query Length Validation
2. ✅ Property 15: Input Sanitization (protocol rejection)
3. ✅ Property 5: Encryption/Decryption roundtrip
4. ✅ Property 6: Cookie validation (array invariant)
5. ✅ Property 6: Cookie structure validation
6. ✅ MusicManager status structure
7. ✅ Logger metadata resilience
8. ✅ Encryption output format

**Cobertura actual:** 50% (8 de 16 propiedades)

### Testing Manual en Discord

Para probar el sistema de música en Discord:

1. **Test básico de reproducción:**
   ```
   !play lofi girl
   ```
   Esperado: Bot se une al canal de voz y reproduce audio

2. **Test de sesión única:**
   ```
   !play otra canción
   ```
   Esperado: Error indicando que ya hay una sesión activa

3. **Test de detención:**
   ```
   !stop
   ```
   Esperado: Bot detiene reproducción y limpia recursos

4. **Test con URL directa:**
   ```
   !play https://www.youtube.com/watch?v=jfKfPfyJRdk
   ```
   Esperado: Reproduce el video específico

5. **Test de dashboard:**
   - Acceder al dashboard web
   - Verificar que NO haya botones Play/Stop
   - Verificar consola de logs en tiempo real
   - Verificar estado de sesión

## 📁 Estructura del Proyecto

```
BOT_HackLabH/
├── commands/           # Comandos de Discord
│   └── music.js       # Comandos de música (!play, !stop)
├── music/             # Sistema de música
│   ├── MusicManager.js    # Gestor principal con pipeline modular
│   ├── validation.js      # Validación de inputs y cookies
│   └── logger.js          # Sistema de logging con WebSocket
├── public/            # Frontend del dashboard
│   ├── index.html     # Dashboard principal con glassmorphism
│   ├── script.js      # Lógica del cliente + WebSocket
│   ├── sanitize.js    # Sanitización XSS
│   └── style.css      # Estilos premium (Obsidian, Crystal, Midnight)
├── tests/             # Suite de tests
│   ├── music_properties.test.js      # Property-based tests (8 tests)
│   ├── bugfix-welcome-goodbye.test.js # Tests de bugfix
│   ├── preservation.test.js          # Tests de preservación
│   └── run-tests.js                  # Runner de tests
├── .kiro/specs/       # Especificaciones técnicas y auditorías
│   ├── youtube-premium-music-system/
│   │   ├── requirements.md           # 11 requerimientos
│   │   ├── design.md                 # Diseño con 16 propiedades
│   │   ├── tasks.md                  # Plan de implementación
│   │   ├── REVIEW_REPORT.md          # Primera auditoría
│   │   ├── RESUMEN_REVISION.md       # Resumen primera auditoría
│   │   ├── AUDIT_2_REPORT.md         # Segunda auditoría (APROBADO)
│   │   └── AUDIT_2_SUMMARY.md        # Resumen segunda auditoría
│   ├── xss-dashboard-sanitization/
│   └── welcome-goodbye-messages-crash-fix/
├── index.js           # Bot principal de Discord
├── dashboard.js       # Servidor web Express + WebSocket
├── db.js              # Gestión de base de datos SQLite + encriptación
├── SECURITY.md        # Documentación de seguridad completa
├── Dockerfile         # Configuración Docker con PulseAudio
├── .env.example       # Template de variables de entorno
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

### Primera Auditoría (2026-03-11)
- **Resultado:** 5 errores críticos identificados
- **Progreso inicial:** 25%
- **Documentación:** `.kiro/specs/youtube-premium-music-system/REVIEW_REPORT.md`

**Errores encontrados:**
1. Dashboard con controles prohibidos (Play/Stop)
2. Lógica de sesión única incorrecta
3. Cookies sin encriptación (CWE-312)
4. Falta validación de cookies (CWE-20)
5. Diseño no modular

### Segunda Auditoría (2026-03-11)
- **Resultado:** ✅ APROBADO - Todos los errores críticos corregidos
- **Progreso final:** 75% (+50%)
- **Documentación:** `.kiro/specs/youtube-premium-music-system/AUDIT_2_REPORT.md`

**Correcciones implementadas:**
1. ✅ Eliminados endpoints y botones prohibidos del dashboard
2. ✅ Sesión única rechaza con error en lugar de detener
3. ✅ Encriptación AES-256-CBC implementada
4. ✅ Función `validateYouTubeCookies()` agregada
5. ✅ Refactorizado en métodos modulares (`_launchBrowser`, `_navigateToYouTube`, `_startAudioBridge`)

**Mejoras adicionales:**
- Sistema de logging completo con niveles (info, warning, error, debug)
- WebSocket para logs en tiempo real
- Dashboard de monitoreo mejorado
- 8 Property-based tests implementados
- Tabla `music_logs` en base de datos

**Vulnerabilidades resueltas:**
- ✅ CWE-312: Cleartext Storage of Sensitive Information
- ✅ CWE-20: Improper Input Validation

**Observaciones menores (no bloqueantes):**
- Falta validación de entorno PulseAudio (severidad BAJA)
- Falta timeout en proceso ffmpeg (severidad BAJA)
- Variable `ENCRYPTION_KEY` no documentada en `.env.example` (severidad BAJA)

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

**Nota:** Este bot está en desarrollo activo. El sistema de música está en fase de testing (75% completo). Reporta cualquier bug en la sección de Issues.

**Estado actual del proyecto:**
- ✅ Sistema de música: 75% (Fases 1-3 completadas, Fase 4 en progreso)
- ✅ Dashboard web: 100%
- ✅ Sistema de logros: 100%
- ✅ Seguridad: 2 vulnerabilidades críticas resueltas
- ⏳ Testing: 50% de property tests implementados
