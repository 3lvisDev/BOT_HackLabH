# HackLabH Bot — Discord Automation Suite

> **Music + Web Player + Spotify Import + Playlists + Tickets + Leveling + Pro Dashboard**

[![Discord](https://img.shields.io/badge/Support-Discord-5865F2?logo=discord&logoColor=white)](https://discord.gg/BX9mTRekGx)
[![Panel](https://img.shields.io/badge/Panel-panel.hacklabh.xyz-111827?logo=vercel&logoColor=white)](https://panel.hacklabh.xyz)
[![Website](https://img.shields.io/badge/Web-www.hacklabh.xyz-0B1220?logo=googlechrome&logoColor=white)](https://www.hacklabh.xyz)

HackLabH Bot is a production-ready Discord bot focused on community growth, music experience, moderation workflows, and premium dashboard control.

---

## 🚀 Core Value

- **One bot, all essentials** for active communities
- **Modern UX** for users and staff (Discord + Web Dashboard)
- **Fast operations** with clear commands and reliable behavior
- **Built to scale** with Lavalink, structured logs, and modular architecture

---

## ✨ Product Modules

## 🎵 Music Engine
- Play/search by query or URL
- Queue management, pause/resume, skip/next, previous/back
- Radio continuity mode when queue ends
- Live stream + DJ auto fallback mode

## 🌐 Web Music Player
- Browser control from dashboard
- Real-time status + logs + queue flow
- Server-aware controls (guild context)

## 🎧 Spotify Integration
- Spotify **track / playlist / album** URL support
- Smart resolver to playable YouTube/YT Music queries
- Import Spotify content directly into custom playlists

## 📚 Custom Playlists
- Create/list/show/delete playlists per guild
- Add/remove tracks manually
- Import from Spotify in bulk
- Play complete playlists in one action

## 🎫 Tickets System
- Open/list/close support tickets
- Slash + prefix operations
- Web API integration for panel workflows

## 🏆 Leveling & Achievements
- Message activity tracking
- Milestone achievements with unlock announcements
- Extensible achievement model in database

## 😀 Emoji Suite
- Add emoji from URL
- Add emoji from attachment (`addfile`)
- Delete/list guild emojis
- List and resolve **application emojis** with fallback

## 🔐 Secure Admin Panel
- OAuth login (Discord)
- Guild-scoped admin operations
- Secrets panel restricted to authorized owner IDs
- Rate limiting and sensitive endpoint controls

---

## 🧩 Commands Overview

### Music
- Prefix: `!play`, `!stop`, `!skip`, `!next`, `!previous`, `!pause`, `!resume`, `!queue`
- Slash: `/play`, `/stop`, `/skip`, `/next`, `/previous`, `/pause`, `/resume`, `/queue`

### Playlist
- Prefix: `!playlist create|list|show|add|import|play|remove|delete`
- Slash: `playlist_create`, `playlist_list`, `playlist_add`, `playlist_import`, `playlist_play`

### Tickets
- Prefix: `!ticket open|list|close`
- Slash: `ticket_open`, `ticket_list`, `ticket_close`

### Emojis
- Prefix: `!emoji add|addfile|delete|list|app_list|use`
- Slash: `emoji_add`, `emoji_delete`, `emoji_list`, `emoji_app_list`, `emoji_use`

---

## 🌍 Official Links

- Website: [www.hacklabh.xyz](https://www.hacklabh.xyz)
- Dashboard: [panel.hacklabh.xyz](https://panel.hacklabh.xyz)
- Invite: [panel.hacklabh.xyz/invite](https://panel.hacklabh.xyz/invite)
- Install: [panel.hacklabh.xyz/install](https://panel.hacklabh.xyz/install)
- Terms: [panel.hacklabh.xyz/terms](https://panel.hacklabh.xyz/terms)
- Privacy: [panel.hacklabh.xyz/privacy](https://panel.hacklabh.xyz/privacy)
- Support: [discord.gg/BX9mTRekGx](https://discord.gg/BX9mTRekGx)

---

## ⚙️ Quick Setup

```bash
npm install
cp .env.example .env
npm run deploy:commands
npm start
```

Required environment highlights:
- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `LAVALINK_URL` / `LAVALINK_PASSWORD`
- `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` (for Spotify features)

---

## 🛡️ Security Highlights

- Authenticated API routes
- Owner-restricted secrets management
- Session hardening + rate limiting
- Input validation paths for music, dashboard, and emoji operations

---

## 📦 Releases

See [CHANGELOG.md](./CHANGELOG.md) for full release history and marketing-ready notes.

Latest release package includes:
- Spotify resolver flow
- Playlist Spotify import
- Emoji management suite
- Application emoji fallback helpers
- Dashboard owner-only secrets hardening

---

## 🧠 Brand Positioning

HackLabH Bot is designed as a **community operating system for Discord**:
**engagement, entertainment, support, and control** in one unified experience.

