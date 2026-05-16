# GitHub Secrets (Recomendado)

Nunca subas secretos al repositorio.

## 1) Variables locales

- Copia `.env.example` a `.env`
- Completa valores reales solo en tu máquina
- `.env` y `.env.*` están ignorados por git

## 2) GitHub Actions Secrets

En GitHub:

`Settings` → `Secrets and variables` → `Actions` → `New repository secret`

Secretos sugeridos:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_SECRET`
- `SPOTIFY_CLIENT_SECRET`
- `WEB_ADMIN_PASSWORD`
- `PI_PASSWORD`
- `ENCRYPTION_KEY`

Variables (no sensibles) pueden ir en:

`Settings` → `Secrets and variables` → `Actions` → `Variables`

Ejemplos:

- `DISCORD_CLIENT_ID`
- `GUILD_ID`
- `PI_HOST`
- `PI_USER`
- `LAVALINK_URL`

## 3) Regla de oro

- Si un secreto se filtró por chat/commit/log, **rotarlo inmediatamente**.

