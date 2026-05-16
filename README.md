# HackLabH Bot - Discord Automation Suite

> Music + Smart Radio + Playlists + Tickets + Moderation + Web Dashboard

[![Panel](https://img.shields.io/badge/Panel-panel.hacklabh.xyz-111827?logo=vercel&logoColor=white)](https://panel.hacklabh.xyz)
[![Website](https://img.shields.io/badge/Web-www.hacklabh.xyz-0B1220?logo=googlechrome&logoColor=white)](https://www.hacklabh.xyz)

HackLabH Bot helps communities run music, support, moderation, and engagement from Discord + Web.

---

## What is new in this release

- Smarter radio that learns from what users play
- Automatic style switching (if users move from rock to romantic, radio follows)
- New `!musicstats` command with top trends per server:
  - most used seeds
  - most played artists
  - most played tracks
- Better continuity and reduced repetition in radio flow
- Improved help experience with branded animated bot visual

---

## Core modules

### Music & Smart Radio
- `!play` with query or URL
- `!radio on|off|status|reset [genre/artist]`
- queue controls: skip, next, previous, pause, resume, stop
- adaptive radio memory by user behavior

### Playlists
- create, add, import, list, show, play, delete
- Spotify playlist and album import

### Tickets
- open, list, close support tickets

### Emoji tools
- add, delete, list, app emoji helpers

### Dashboard
- Web panel for control, status, and operations

---

## Commands (quick)

### Music
- Prefix: `!play`, `!radio`, `!stop`, `!skip`, `!next`, `!previous`, `!pause`, `!resume`, `!queue`, `!musicstats`
- Slash: `/play`, `/radio`, `/stop`, `/skip`, `/next`, `/previous`, `/pause`, `/resume`, `/queue`

### Playlist
- Prefix: `!playlist create|list|show|add|import|play|remove|delete`

### Tickets
- Prefix: `!ticket open|list|close`

### Emojis
- Prefix: `!emoji add|addfile|delete|list|app_list|use`

---

## Links

- Website: https://www.hacklabh.xyz
- Dashboard: https://panel.hacklabh.xyz
- Invite: https://panel.hacklabh.xyz/invite
- Support: https://discord.gg/BX9mTRekGx

---

## Quick setup

```bash
npm install
cp .env.example .env
npm run deploy:commands
npm start
```

---

## License & usage

This repository is source-available for transparency.

- See `LICENSE`
- See `NOTICE.md`

Self-hosting, resale, clone deployment, and commercial usage are not allowed without explicit written permission from HackLabH.
