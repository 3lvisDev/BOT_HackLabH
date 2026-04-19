# Migración recomendada: `main` público (marketing) + código privado

Objetivo:
- `main` = vitrina pública (marketing, auditorías, changelog, invitación, soporte, legal).
- repo privado = código real del bot (backend, dashboard, deploy, comandos, tests internos).

---

## Resultado final esperado

### Repositorio público (este repo)
- README comercial y técnico de confianza
- CHANGELOG y release notes
- docs de auditoría (caja negra/blanca/gris)
- SECURITY / PRIVACY / TERMS / INSTALL
- Sin código sensible de operación

### Repositorio privado (nuevo)
- Código del bot
- Pipelines de despliegue
- Integraciones internas
- Entorno de producción (secrets + environments)

---

## Fase A — Acciones que haces tú (GitHub UI)

1. Crear repo privado nuevo (ejemplo):
   - `BOT_HackLabH-core-private`
2. En ese repo privado:
   - Settings → Security → habilitar Dependabot (opcional recomendado)
   - Settings → Branches → proteger `main`
3. En este repo público:
   - Settings → Branches → proteger `main` (PR obligatorio)
   - Settings → General → Features → Releases habilitado
4. En Discord Developer Portal:
   - Bot → Public Bot: ON (si quieres que cualquiera lo invite)
   - OAuth2 Redirect URI correcta para panel
5. En GitHub Environments del repo privado:
   - crear `production`
   - required reviewers (tu usuario)
   - secrets del bot (token, lavalink, spotify, etc.)

---

## Fase B — Acciones de git (te guío yo)

> Ejecutar desde una copia local limpia.

### 1) Subir código completo al repo privado
```powershell
git remote add private https://github.com/<tu_user>/BOT_HackLabH-core-private.git
git push private feature/music-phase-1:main
```

### 2) Dejar este repo público en modo marketing
Crear rama de trabajo:
```powershell
git checkout -b marketing-main-prep
```

Mantener solo:
- `README.md`
- `CHANGELOG.md`
- `docs/` (auditorías, releases, guías públicas)
- `.github/release.yml`
- políticas (`SECURITY.md`, `LICENSE`, etc.)

Luego abrir PR de `marketing-main-prep` hacia `main`.

---

## Fase C — Publicación de release

1. Merge PR a `main` (repo público)
2. Releases → Draft a new release
3. Tag: `v2.0.0`
4. Título: `HackLabH Bot v2.0.0 — Spotify, Emojis & Pro Ops`
5. Descripción: usar `docs/releases/v2.0.0.md`
6. Publish release

---

## Checklist de seguridad (obligatorio)

- [ ] Ningún token real en repo público
- [ ] `Public Bot` configurado según estrategia
- [ ] Secrets solo en repo privado/environments
- [ ] `WEB_OWNER_DISCORD_IDS` configurado en producción
- [ ] Auditoría final (negra/blanca/gris) antes de release mayor

---

## Nota importante

Si publicas código ejecutable en público, no existe forma técnica de impedir clonación total.
La protección real se logra con:
- separación público/privado,
- componentes críticos en backend privado,
- licencia de uso restrictiva,
- y control operativo (infra + secrets).

