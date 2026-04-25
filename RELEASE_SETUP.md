# Release Local — HackLabH Release (Docker)

## Objetivo
Entorno de desarrollo totalmente separado de producción, dockerizado en el notebook local.

## Arquitectura Docker

```
┌─────────────────────────────────────────────────┐
│            Docker Network: release-net          │
│                                                 │
│  ┌─────────────────────┐  ┌──────────────────┐  │
│  │ hacklabh-release-bot │  │hacklabh-release- │  │
│  │                     │  │    lavalink       │  │
│  │  Node 20 + Bot      │──│  Lavalink 4      │  │
│  │  Dashboard :9666    │  │  Audio :2333      │  │
│  │  PulseAudio + Xvfb  │  │  youtube-plugin   │  │
│  └─────────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────┘
         ↓ :9666                   ↓ :2444
     localhost:9666           localhost:2444
```

## Puertos
- Panel/API: `localhost:9666`
- Lavalink: `localhost:2444` (interno: 2333)

## Arranque Rápido

### 1. Configurar variables de entorno
```powershell
# Si no tienes .env, copia el ejemplo:
Copy-Item .env.release.example .env
# Edita .env y completa: DISCORD_TOKEN, DISCORD_CLIENT_SECRET
```

### 2. Levantar el stack completo
```powershell
docker compose -f docker-compose.release.yml up -d --build
```

### 3. Verificar que todo arrancó
```powershell
docker compose -f docker-compose.release.yml ps
docker compose -f docker-compose.release.yml logs -f
```

### 4. Abrir el panel
Navega a: **http://localhost:9666**

## Comandos Útiles

```powershell
# Detener todo
docker compose -f docker-compose.release.yml down

# Rebuild solo el bot (sin tocar Lavalink)
docker compose -f docker-compose.release.yml up -d --build bot

# Ver logs en tiempo real
docker compose -f docker-compose.release.yml logs -f bot
docker compose -f docker-compose.release.yml logs -f lavalink

# Entrar al container del bot
docker exec -it hacklabh-release-bot bash

# Resetear datos (borrar volumen SQLite)
docker compose -f docker-compose.release.yml down -v
```

## Notas Importantes
- **NO** usa el bot de producción — tiene su propio token/client.
- **NO** tocar `c:\Proyecto Discord\BOT_HackLabH` para pruebas.
- Node 20 LTS obligatorio (`Dockerfile.release` usa `node:20-slim`).
- Los datos SQLite se persisten en un volumen Docker (`bot-data`).
- Lavalink usa el plugin `youtube-source` (built-in YouTube deshabilitado).
