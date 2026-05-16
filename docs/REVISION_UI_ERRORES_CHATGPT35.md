# Revisi?n del proyecto y gu?a para ChatGPT 3.5 Coding

Fecha: 2026-05-01  
Proyecto: `C:\Proyecto Discord\BOT_HackLabH_Release`

## Hallazgos corregidos

1. **`npm test` no ejecutaba tests Mocha-style**
   - Problema: `tests/run-tests.js` corr?a archivos con `node` directo, pero los tests usan `describe`/`it`.
   - Correcci?n: runner liviano sin dependencias que define `describe`, `it`, `test.skip`, `beforeEach` y `expect` m?nimo.

2. **Tests de preservaci?n no deterministas**
   - Problema: `createMockMember()` generaba IDs aleatorios, pero algunos asserts esperaban `user123`.
   - Correcci?n: ID por defecto estable `user123` y propiedad de roles ajustada para no exigir rol base a perfiles admin/mod/owner.

3. **Resolver de Spotify no coincid?a con contrato de tests**
   - Problema: `parseSpotifyUrl()` expon?a `raw` y `resolveSpotifyQueries()` ignoraba cliente mock.
   - Correcci?n: `parseSpotifyUrl()` retorna solo `{ type, id }`; `resolveSpotifyQueries(input, client)` acepta cliente inyectado para tests y mantiene fallback real.

4. **Dashboard con handlers inline y riesgo XSS en playlists personales**
   - Problema: `onclick="..."` en HTML generado y valores de playlists/tracks sin escape.
   - Correcci?n: reemplazado por botones con `data-*`, listeners con `addEventListener` y escape v?a `safeHtml()`.

5. **Accesibilidad/UI guidelines**
   - Agregado `aria-hidden`/`focusable=false` a SVG decorativos.
   - Agregado `aria-live` a estados async.
   - Agregado `type="button"` a botones no-submit.
   - Agregados labels `sr-only`, `name`, `autocomplete`, `spellcheck=false` y placeholder con `?` al input de track.
   - Agregado `rel="noopener noreferrer"` en links `target="_blank"`.
   - Agregadas dimensiones al avatar para reducir CLS.
   - Agregados estilos `sr-only`, focus visible, `scroll-margin-top`, `text-wrap: balance`, `tabular-nums`, `overscroll-behavior` y safe-area.

## Validaci?n ejecutada

```powershell
node --check public/script.js
node --check music/spotify.js
node --check tests/run-tests.js
node tests/spotify-resolver.test.js
npm test
```

Resultado: `npm test` pasa con **40 passed, 0 failed**.

## Pendientes / mejoras recomendadas

1. **Usar Node 20 LTS para validaci?n real de runtime**
   - En esta m?quina se detect? `node v25.8.0`.
   - El proyecto tiene dependencias nativas (`sqlite3`, `@discordjs/opus`) que hist?ricamente fallan fuera de Node 20 LTS.

2. **Ampliar `npm test`**
   - Hoy valida el set legacy welcome/goodbye.
   - Siguiente paso: migrar progresivamente todos los `tests/*.test.js` al runner o a `node:test` est?ndar.

3. **Eliminar HTML generado con `innerHTML` donde sea posible**
   - Aunque se escaparon zonas cr?ticas, lo ideal es construir nodos con `document.createElement()` en playlists, achievements y selects.

4. **Prueba visual/manual de dashboard**
   - Validar login, navegaci?n por hash, playlist personal, selector de guild, foco con teclado, responsive mobile y reduced motion.

5. **Revisi?n de cambios grandes existentes**
   - El repo ya ten?a muchos archivos modificados antes de esta revisi?n. Antes de release, revisar diffs de `commands/playlist.js`, `panel.js`, `index.js`, `db.js` y `public/index.html` contra funcionalidad esperada.

## Prompt recomendado para ChatGPT 3.5 Coding

```text
Act?a como agente de coding conservador en el repo C:\Proyecto Discord\BOT_HackLabH_Release.

Objetivo: continuar hardening del dashboard y tests sin romper flujo existente del bot Discord.

Reglas:
1. No reescribas archivos completos si puedes hacer patches peque?os.
2. Preserva cambios existentes del usuario; revisa `git status` y `git diff` antes de editar.
3. Usa Node 20 LTS para instalaci?n/runtime si hay dependencias nativas (`sqlite3`, `@discordjs/opus`).
4. Para UI, cumple estas reglas: sin `onclick` inline, sin `<div>` clickeable, SVG decorativos con `aria-hidden`, inputs con label/name/autocomplete, botones con `type`, links externos con `rel="noopener noreferrer"`, foco visible, `prefers-reduced-motion`, no `transition: all`, no `outline: none` sin reemplazo.
5. Toda data de API que vaya a HTML debe escaparse o renderizarse con `textContent`.
6. Evita `innerHTML` para contenido din?mico nuevo; usa `document.createElement()`.
7. Despu?s de cada cambio ejecuta: `node --check <archivo>`, `node tests/spotify-resolver.test.js`, `npm test`.
8. Documenta hallazgos y comandos ejecutados en `docs/`.

Tareas sugeridas:
- Migrar todos los tests `tests/*.test.js` a `node:test` o ampliar el runner liviano para soportarlos.
- Reemplazar los `innerHTML` restantes del dashboard por construcci?n segura de DOM.
- Ejecutar una prueba manual del dashboard: login, navegaci?n, guild selector, playlists personales, teclado/focus y mobile.
- Revisar compatibilidad real con Node 20 LTS y reconstruir `node_modules` si los bindings nativos fallan.
```
