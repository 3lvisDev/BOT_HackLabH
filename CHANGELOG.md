# Changelog

All notable changes to this project are documented in this file.

Format inspired by Keep a Changelog.

---

## [2.0.0] - 2026-04-19

## 🚀 Headline
**Major product expansion release** focused on music intelligence, playlist automation, emoji tooling, and hardened admin security.

## Added
- Spotify integration layer (track/playlist/album URL parsing + metadata resolver).
- Spotify-to-YouTube/YT Music playable query pipeline.
- Playlist import from Spotify via:
  - Prefix command flow
  - Slash command flow
  - Dashboard API endpoint
- New emoji management module:
  - `emoji add`, `emoji addfile`, `emoji delete`, `emoji list`
  - `emoji app_list`, `emoji use` helpers
- Application emoji utility library:
  - fetch app emojis
  - render with fallback
  - token-to-emoji replacement helpers
- New slash command surface:
  - `emoji_add`, `emoji_delete`, `emoji_list`
  - `emoji_app_list`, `emoji_use`
  - `playlist_import`
- Emoji pack automation script:
  - GitHub pack download
  - name normalization for Discord
  - optional resize
  - fun-profile filter without flag-heavy output

## Improved
- README rewritten with full product marketing positioning.
- Docs added for emoji pack workflows and upload flow.
- Help command content expanded for emoji and modern playlist usage.
- Web/dashboard flow aligned with new music and playlist capabilities.

## Security
- Secrets/GitHub env panel hardened:
  - owner-only enforcement at backend middleware level
  - non-owner users blocked with explicit 403
  - UI visibility adjusted by permission state
- Added owner ID policy support through environment configuration.

## Tests
- Added and validated:
  - Spotify resolver tests
  - Playlist Spotify import command tests
  - App emoji utility tests
  - Emoji command behavior tests
  - Web permissions/owner checks tests

---

## Release Assets / Messaging

**Marketing Summary:**  
HackLabH Bot now delivers a complete Discord operations stack: Music Engine, Web Player, Spotify Imports, Custom Playlists, Tickets, Leveling, and secure owner-first administration.

**Primary CTA:**  
[Invite HackLabH Bot](https://panel.hacklabh.xyz/invite)

