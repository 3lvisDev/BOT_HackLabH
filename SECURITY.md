# Seguridad del Bot de Discord HackLab

Este documento describe las medidas de seguridad implementadas en el bot y las mejores prácticas para su despliegue.

## 🔒 Medidas de Seguridad Implementadas

### 1. Protección contra XSS (Cross-Site Scripting)

**Ubicación:** `public/sanitize.js`, `public/script.js`

**Protecciones:**
- ✅ Sanitización de HTML en todos los inputs de usuario
- ✅ Uso de `textContent` en lugar de `innerHTML`
- ✅ Validación y sanitización de URLs
- ✅ Bloqueo de protocolos peligrosos (`javascript:`, `data:`, `vbscript:`)
- ✅ Event handlers seguros (funciones en lugar de strings)

**Ejemplo:**
```javascript
// ❌ INSEGURO
element.innerHTML = `<span>${userName}</span>`;

// ✅ SEGURO
const span = document.createElement('span');
span.textContent = userName;
element.appendChild(span);
```

---

### 2. Configuración Segura de Cookies de Sesión

**Ubicación:** `dashboard.js`

**Protecciones:**
- ✅ `httpOnly: true` - Previene acceso desde JavaScript
- ✅ `sameSite: 'strict'` - Previene ataques CSRF
- ✅ `secure: true` en producción - Solo HTTPS
- ✅ Tiempo de expiración de 24 horas

**Configuración:**
```javascript
cookie: { 
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'strict',
  maxAge: 1000 * 60 * 60 * 24
}
```

---

### 3. CORS (Cross-Origin Resource Sharing) Configurado

**Ubicación:** `dashboard.js`

**Protecciones:**
- ✅ Origen específico configurado
- ✅ Credenciales habilitadas solo para origen permitido
- ✅ Variable de entorno `CORS_ORIGIN`

**Configuración:**
```javascript
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
```

---

### 4. Rate Limiting (Límite de Peticiones)

**Ubicación:** `dashboard.js`

**Protecciones:**
- ✅ Límite general: 100 peticiones / 15 minutos
- ✅ Límite de autenticación: 5 intentos / 15 minutos
- ✅ Límite estricto: 10 peticiones / minuto (operaciones sensibles)

**Configuración:**
```javascript
// General API
windowMs: 15 * 60 * 1000, max: 100

// Autenticación
windowMs: 15 * 60 * 1000, max: 5

// Operaciones sensibles (restart, setup)
windowMs: 60 * 1000, max: 10
```

---

### 5. Validación de Entrada en Comandos de Música

**Ubicación:** `index.js` - `MusicManager.play()`

**Protecciones:**
- ✅ Validación de tipo de dato
- ✅ Límite de longitud (500 caracteres)
- ✅ Bloqueo de URIs peligrosos
- ✅ Sanitización de query antes de usar con Playwright

**Validaciones:**
```javascript
if (!query || typeof query !== 'string') {
  throw new Error("Query inválida");
}

if (query.length > 500) {
  throw new Error("Query demasiado larga");
}

if (trimmedQuery.includes('javascript:') || trimmedQuery.includes('data:')) {
  throw new Error("Query contiene contenido no permitido");
}
```

---

### 6. Uso Seguro de Base de Datos

**Ubicación:** `db.js`

**Protecciones:**
- ✅ Consultas parametrizadas (previene SQL injection)
- ✅ Uso de placeholders `?` en todas las queries
- ✅ Validación de tipos en funciones

**Ejemplo:**
```javascript
// ✅ SEGURO - Consulta parametrizada
db.get('SELECT * FROM users WHERE id = ?', [userId]);

// ❌ INSEGURO - Concatenación de strings
db.get(`SELECT * FROM users WHERE id = ${userId}`);
```

---

## 🔐 Variables de Entorno Requeridas

### Producción

```env
# Bot de Discord
DISCORD_TOKEN=tu_token_real

# OAuth2
DISCORD_CLIENT_ID=tu_client_id
DISCORD_CLIENT_SECRET=tu_client_secret
DISCORD_REDIRECT_URI=https://tu-dominio.com/api/auth/callback

# Seguridad
NODE_ENV=production
WEB_ADMIN_PASSWORD=contraseña_fuerte_aleatoria
CORS_ORIGIN=https://tu-dominio.com

# Puerto
PORT=3000
```

### Desarrollo

```env
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

---

## 🚨 Mejores Prácticas de Despliegue

### 1. HTTPS Obligatorio en Producción

```nginx
# Nginx - Redirigir HTTP a HTTPS
server {
    listen 80;
    server_name tu-dominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name tu-dominio.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 2. Firewall y Restricción de Puertos

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Bloquear acceso directo al puerto 3000
sudo ufw deny 3000/tcp
```

### 3. Actualizar Dependencias Regularmente

```bash
# Verificar vulnerabilidades
npm audit

# Actualizar dependencias
npm update

# Actualizar dependencias con vulnerabilidades
npm audit fix
```

### 4. Logs y Monitoreo

```javascript
// Agregar logging de seguridad
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});
```

### 5. Backup de Base de Datos

```bash
# Backup automático diario
0 2 * * * cp /path/to/bot_data.sqlite /path/to/backups/bot_data_$(date +\%Y\%m\%d).sqlite
```

---

## 🛡️ Checklist de Seguridad

Antes de desplegar en producción, verifica:

- [ ] `NODE_ENV=production` configurado
- [ ] `WEB_ADMIN_PASSWORD` es una contraseña fuerte
- [ ] `CORS_ORIGIN` apunta a tu dominio real
- [ ] HTTPS configurado y funcionando
- [ ] Certificado SSL válido
- [ ] Firewall configurado
- [ ] Puerto 3000 no expuesto públicamente
- [ ] Backups automáticos configurados
- [ ] Logs de seguridad habilitados
- [ ] `npm audit` sin vulnerabilidades críticas
- [ ] Permisos de archivos correctos (no 777)
- [ ] Bot con permisos mínimos necesarios en Discord

---

## 📞 Reporte de Vulnerabilidades

Si encuentras una vulnerabilidad de seguridad, por favor:

1. **NO** la publiques públicamente
2. Contacta al administrador del proyecto
3. Proporciona detalles técnicos y pasos para reproducir
4. Espera confirmación antes de divulgar

---

## 📚 Referencias

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Discord.js Security](https://discordjs.guide/popular-topics/common-questions.html#how-do-i-make-my-bot-secure)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)

---

**Última actualización:** 2026-03-10
**Versión del documento:** 1.0.0
