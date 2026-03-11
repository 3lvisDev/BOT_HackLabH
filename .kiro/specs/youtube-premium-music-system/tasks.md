# Plan de Implementación: Sistema de Música con YouTube Premium

## ⚠️ ESTADO ACTUAL: REVISIÓN COMPLETADA - REQUIERE CORRECCIONES

**Última Revisión:** 2026-03-11  
**Resultado:** IMPLEMENTACIÓN INCOMPLETA con ERRORES CRÍTICOS  
**Ver:** `REVIEW_REPORT.md` para detalles completos

## Descripción General

Este plan implementa un sistema de música para el bot de Discord HackLab que permite reproducir audio de YouTube Premium mediante un navegador virtual (Playwright + Chromium), captura de audio con ffmpeg/PulseAudio, y transmisión a canales de voz de Discord. La implementación sigue un enfoque incremental con checkpoints para pruebas iterativas.

## 🔴 CORRECCIONES CRÍTICAS REQUERIDAS (Hacer PRIMERO)

- [ ] **CORRECCIÓN 1:** Eliminar endpoints `/api/music/play` y `/api/music/stop` del dashboard
  - **Archivo:** `dashboard.js` líneas 288-313
  - **Razón:** Viola Requirement 6.10 - Dashboard NO debe tener controles de reproducción
  - **Cómo:** Comentar o eliminar esos endpoints completamente

- [ ] **CORRECCIÓN 2:** Eliminar botones Play/Stop del dashboard HTML
  - **Archivo:** `public/index.html` líneas 385-391, `public/script.js`
  - **Razón:** Dashboard es solo para monitoreo, no control
  - **Cómo:** Eliminar botones y sus event listeners

- [ ] **CORRECCIÓN 3:** Corregir lógica de sesión única en `play()`
  - **Archivo:** `music/MusicManager.js` línea 27
  - **Razón:** Debe rechazar con error, no detener sesión activa
  - **Cómo:** Cambiar `await this.stop()` por `throw new Error(\`Ya hay una reproducción activa en el canal: ${this.channelName}\`)`

- [ ] **CORRECCIÓN 4:** Implementar encriptación de cookies
  - **Archivo:** `db.js`
  - **Razón:** Requirement 3.4 - Cookies deben estar encriptadas
  - **Cómo:** Usar crypto de Node.js para encriptar antes de guardar

- [ ] **CORRECCIÓN 5:** Agregar validación de cookies
  - **Archivo:** `music/validation.js` y `dashboard.js`
  - **Razón:** Requirement 3.2 - Validar formato JSON antes de guardar
  - **Cómo:** Crear `validateYouTubeCookies()` y usarla en endpoint

## Tareas

### Fase 1: Funcionalidad Básica del Comando !play

- [x] 1. Configurar estructura base del sistema de música ✅ COMPLETADO
  - Crear archivo `commands/music.js` para comandos de Discord
  - Crear archivo `music/MusicManager.js` con clase base y propiedades iniciales
  - Definir estructura de estado de sesión (isActive, channelId, channelName, currentTrack, guildId)
  - _Requerimientos: 1.4, 2.1_

- [ ] 2. Implementar validación de inputs y comandos básicos
  - [x] 2.1 Crear función `validateMusicQuery()` en `music/validation.js` ✅ COMPLETADO
    - Validar longitud máxima de 500 caracteres
    - Rechazar protocolos maliciosos (javascript:, data:)
    - Sanitizar y retornar query limpia
    - _Requerimientos: 5.2, 5.3, 9.8_
  
  - [ ]* 2.2 Escribir property test para validación de queries
    - **Property 7: Query Length Validation**
    - **Property 15: Input Sanitization**
    - **Valida: Requerimientos 5.3, 5.2**
  
  - [x] 2.3 Implementar comando !play en `commands/music.js` ✅ COMPLETADO
    - Verificar que usuario esté en canal de voz
    - Validar query usando `validateMusicQuery()`
    - Llamar a `MusicManager.play()` con parámetros validados
    - Enviar mensajes de confirmación o error al canal de Discord
    - _Requerimientos: 5.1.1, 5.1.2, 5.1.3, 5.1.4, 5.1.8_
  
  - [x] 2.4 Implementar comando !stop en `commands/music.js` ✅ COMPLETADO
    - Verificar que usuario esté en el mismo canal de voz que la sesión activa
    - Llamar a `MusicManager.stop()`
    - Enviar mensaje de confirmación
    - _Requerimientos: 5.1.5, 5.1.6, 5.1.7_

- [ ] 3. Implementar lógica de sesión única y bloqueo de canal
  - [x] 3.1 Implementar método `play()` en MusicManager ⚠️ CON ERRORES - Ver CORRECCIÓN 3
    - Validar que no haya sesión activa (single instance)
    - Establecer bloqueo de canal (channelId, channelName)
    - Marcar sesión como activa (isActive = true)
    - Conectar a canal de voz usando Discord.js
    - _Requerimientos: 1.1, 1.2, 2.1, 2.2_
  
  - [ ]* 3.2 Escribir property tests para sesión única
    - **Property 1: Single Instance Invariant**
    - **Property 3: Channel Lock Persistence**
    - **Property 4: Channel Lock Enforcement**
    - **Valida: Requerimientos 1.1, 1.2, 2.1, 2.2**
  
  - [ ] 3.3 Implementar método `stop()` en MusicManager
    - Destruir conexión de voz de Discord
    - Resetear todas las propiedades de estado a null
    - Marcar sesión como inactiva (isActive = false)
    - _Requerimientos: 1.3, 8.4, 8.5, 8.6_
  
  - [ ] 3.4 Implementar método `getStatus()` en MusicManager
    - Retornar objeto con estado actual (active, currentTrack, channel, channelId)
    - _Requerimientos: 9.1_

- [ ]* 4. Escribir unit tests para comandos y sesión básica
  - Testear rechazo de !play cuando usuario no está en canal de voz
  - Testear rechazo de segunda sesión cuando ya hay una activa
  - Testear rechazo de !stop desde canal diferente
  - Testear limpieza de estado después de stop()
  - _Requerimientos: 5.1.2, 1.2, 5.1.6, 1.3_

- [ ] 5. Checkpoint - Probar comandos básicos sin audio
  - Verificar que !play rechace correctamente sesiones duplicadas
  - Verificar que bloqueo de canal funcione correctamente
  - Verificar que !stop limpie el estado
  - Asegurarse de que todos los tests pasen
  - Preguntar al usuario si hay dudas o ajustes necesarios

### Fase 2: Integración de Navegador Virtual y Audio Bridge

- [ ] 6. Implementar lanzamiento de navegador virtual con Playwright
  - [ ] 6.1 Instalar dependencias (playwright, @discordjs/voice, ffmpeg-static)
    - Ejecutar `npm install playwright @discordjs/voice ffmpeg-static`
    - Ejecutar `npx playwright install chromium`
    - _Requerimientos: 4.1_
  
  - [ ] 6.2 Implementar método `_launchBrowser()` en MusicManager
    - Configurar opciones de Chromium (headless, autoplay-policy)
    - Lanzar navegador con Playwright
    - Crear contexto de navegador
    - Crear nueva página
    - Almacenar instancias en propiedades de clase (browser, page)
    - _Requerimientos: 4.1, 4.2_
  
  - [ ] 6.3 Agregar manejo de errores para lanzamiento de navegador
    - Capturar errores de chromium.launch()
    - Llamar a stop() para limpieza parcial
    - Lanzar error descriptivo
    - _Requerimientos: 8.1_

- [ ] 7. Implementar navegación a YouTube y búsqueda
  - [ ] 7.1 Implementar método `_navigateToYouTube()` en MusicManager
    - Detectar si query es URL de YouTube o texto de búsqueda
    - Si es URL: navegar directamente
    - Si es texto: construir URL de búsqueda de YouTube
    - Esperar a que cargue el selector de resultados
    - Si es búsqueda: hacer click en primer resultado
    - Esperar elemento `<video>` en la página
    - Extraer título del video desde el DOM
    - Almacenar título en currentTrack
    - _Requerimientos: 5.1, 5.4, 5.5, 5.6, 4.3_
  
  - [ ]* 7.2 Escribir property tests para navegación
    - **Property 8: YouTube URL Construction**
    - **Property 9: Track Title Extraction**
    - **Valida: Requerimientos 5.4, 5.6**
  
  - [ ] 7.3 Agregar timeout y manejo de errores para navegación
    - Configurar timeout de 30 segundos para navegación
    - Manejar caso de video no encontrado
    - Manejar errores de red
    - _Requerimientos: 5.7_

- [ ] 8. Implementar Audio Bridge con ffmpeg y PulseAudio
  - [ ] 8.1 Implementar método `_startAudioBridge()` en MusicManager
    - Configurar argumentos de ffmpeg (pulse input, 48kHz, stereo, s16le)
    - Spawn proceso ffmpeg con child_process
    - Almacenar proceso en ffmpegProcess
    - Suprimir stderr de ffmpeg
    - _Requerimientos: 4.4, 4.5, 7.1, 7.2, 7.3, 7.7_
  
  - [ ] 8.2 Crear recurso de audio de Discord desde stream de ffmpeg
    - Usar createAudioResource() con stdout de ffmpeg
    - Configurar inputType como StreamType.Raw
    - Habilitar inlineVolume
    - _Requerimientos: 7.4, 7.5_
  
  - [ ] 8.3 Conectar audio player a conexión de voz
    - Suscribir conexión al player
    - Reproducir recurso de audio en el player
    - _Requerimientos: 4.6_
  
  - [ ] 8.4 Agregar manejo de errores para ffmpeg
    - Capturar evento 'error' del proceso ffmpeg
    - Loggear error
    - Llamar a stop() para limpieza
    - _Requerimientos: 7.6_

- [ ] 9. Integrar navegador y audio en método play()
  - [ ] 9.1 Actualizar método `play()` para incluir pipeline completo
    - Después de conectar a voz: llamar a _launchBrowser()
    - Llamar a _navigateToYouTube() con query
    - Llamar a _startAudioBridge()
    - Enviar mensaje de confirmación con título del track
    - _Requerimientos: 4.1, 4.3, 4.4, 4.6_
  
  - [ ] 9.2 Actualizar método `stop()` para incluir limpieza completa
    - Terminar proceso ffmpeg si existe (kill)
    - Cerrar navegador si existe (browser.close())
    - Destruir conexión de voz
    - Resetear todas las propiedades (browser, page, ffmpegProcess, connection)
    - _Requerimientos: 4.7, 8.2, 8.3, 8.4_
  
  - [ ]* 9.3 Escribir property test para limpieza completa
    - **Property 2: Session Cleanup Completeness**
    - **Property 16: Error Cleanup Guarantee**
    - **Valida: Requerimientos 1.3, 8.2, 8.3, 8.4, 8.5, 8.6, 8.1**

- [ ]* 10. Escribir unit tests para audio pipeline
  - Testear lanzamiento de navegador con configuración correcta
  - Testear spawn de ffmpeg con parámetros correctos
  - Testear limpieza de recursos en stop()
  - Testear manejo de errores de navegador y ffmpeg
  - _Requerimientos: 4.1, 4.2, 7.1, 7.6_

- [ ] 11. Checkpoint - Probar reproducción de audio end-to-end
  - Probar !play con búsqueda de texto (ejemplo: "lofi girl")
  - Probar !play con URL directa de YouTube
  - Verificar que audio se reproduzca en canal de voz
  - Verificar que !stop termine correctamente y limpie recursos
  - Asegurarse de que todos los tests pasen
  - Preguntar al usuario si hay dudas o ajustes necesarios

### Fase 3: Dashboard y Configuración de Cookies Premium

- [ ] 12. Crear esquema de base de datos para configuración de música
  - [ ] 12.1 Agregar tabla `music_settings` en `db.js`
    - Campos: guild_id (PK), yt_cookies (TEXT), volume (INTEGER DEFAULT 100), last_channel_id (TEXT)
    - _Requerimientos: 10.1, 10.2, 10.3_
  
  - [ ] 12.2 Agregar tabla `music_logs` en `db.js`
    - Campos: id (PK AUTOINCREMENT), guild_id, timestamp, level, message, stack_trace, metadata
    - _Requerimientos: 6.3_
  
  - [ ] 12.3 Implementar funciones de base de datos
    - `getMusicSettings(guildId)`: obtener configuración
    - `updateMusicSettings(guildId, settings)`: actualizar configuración
    - `logMusicEvent(guildId, level, message, stackTrace, metadata)`: guardar log
    - `getMusicLogs(guildId, filters)`: obtener logs con filtros
    - _Requerimientos: 10.5, 6.3_
  
  - [ ]* 12.4 Escribir property test para persistencia de base de datos
    - **Property 5: Database Persistence Round-Trip**
    - **Valida: Requerimientos 2.5, 3.4, 10.1, 10.2, 10.3**

- [ ] 13. Implementar validación y carga de cookies de YouTube Premium
  - [ ] 13.1 Crear función `validateYouTubeCookies()` en `music/validation.js`
    - Parsear JSON de cookies
    - Validar que sea array
    - Validar estructura de cada cookie (name, value, domain)
    - _Requerimientos: 3.2, 3.3_
  
  - [ ]* 13.2 Escribir property test para validación de cookies
    - **Property 6: JSON Cookie Validation**
    - **Valida: Requerimientos 3.2**
  
  - [ ] 13.3 Actualizar método `_launchBrowser()` para cargar cookies
    - Obtener cookies desde base de datos usando getMusicSettings()
    - Si existen cookies: parsear JSON y agregar al contexto del navegador
    - _Requerimientos: 3.5, 3.6, 10.4_

- [ ] 14. Crear endpoints API REST para configuración y monitoreo
  - [ ] 14.1 Crear archivo `routes/musicApi.js` con endpoints
    - GET `/api/music/status`: retornar estado actual de sesión
    - POST `/api/music/session`: recibir y guardar cookies de YouTube Premium
    - GET `/api/music/logs`: retornar logs con filtros opcionales
    - GET `/api/music/errors`: retornar errores recientes
    - _Requerimientos: 9.1, 9.2, 9.3, 9.5_
  
  - [ ] 14.2 Agregar middleware de autenticación a endpoints
    - Verificar sesión de usuario autenticado
    - Retornar 401 si no está autenticado
    - _Requerimientos: 9.6_
  
  - [ ] 14.3 Implementar validación de inputs en endpoints
    - Validar formato JSON de cookies en POST /api/music/session
    - Sanitizar parámetros de query en GET /api/music/logs
    - Retornar errores descriptivos en formato JSON
    - _Requerimientos: 9.7, 9.8_
  
  - [ ]* 14.4 Escribir property tests para API endpoints
    - **Property 12: API Status Response Structure**
    - **Property 13: API Authentication Enforcement**
    - **Property 14: API Error Response Format**
    - **Valida: Requerimientos 9.1, 9.6, 9.7**

- [ ] 15. Implementar sistema de logging centralizado
  - [ ] 15.1 Crear función `logMusicEvent()` en `music/logger.js`
    - Recibir parámetros: level, message, metadata
    - Loggear a consola con formato estructurado
    - Guardar en base de datos usando db.logMusicEvent()
    - Emitir evento a WebSocket para dashboard en tiempo real
    - _Requerimientos: 6.3, 6.4_
  
  - [ ] 15.2 Integrar logging en MusicManager
    - Loggear eventos importantes (sesión iniciada, track reproduciendo, errores)
    - Usar niveles apropiados (info, warning, error, debug)
    - Incluir metadata relevante (guildId, channelId, track)
    - _Requerimientos: 6.3_
  
  - [ ] 15.3 Implementar filtrado de información sensible en logs
    - NO loggear cookies completas
    - NO loggear tokens de usuario
    - Sanitizar stack traces para remover paths absolutos
    - _Requerimientos: 11.7_

- [ ] 16. Crear interfaz de dashboard web para configuración
  - [ ] 16.1 Crear página HTML `public/music-dashboard.html`
    - Sección de estado de sesión (solo lectura)
    - Formulario para configurar cookies de YouTube Premium
    - Consola integrada para logs en tiempo real
    - Panel de errores con timestamps y stack traces
    - _Requerimientos: 6.1, 6.2, 6.3, 6.5, 6.10_
  
  - [ ] 16.2 Crear script JavaScript `public/music-dashboard.js`
    - Conectar a WebSocket para logs en tiempo real
    - Implementar auto-scroll en consola de logs
    - Implementar filtros por nivel de severidad
    - Implementar búsqueda en logs
    - Actualizar estado de sesión en tiempo real
    - _Requerimientos: 6.3, 6.4, 6.6, 6.7_
  
  - [ ] 16.3 Agregar indicadores visuales de estado del sistema
    - Estado de navegador virtual (activo, inactivo, error)
    - Métricas de salud (memoria, uptime, conexiones)
    - Indicadores de errores críticos
    - _Requerimientos: 6.8, 6.9_

- [ ] 17. Implementar WebSocket para streaming de logs en tiempo real
  - [ ] 17.1 Configurar servidor WebSocket en `server.js`
    - Crear endpoint `/ws/music/logs`
    - Agregar autenticación a conexión WebSocket
    - _Requerimientos: 9.4_
  
  - [ ] 17.2 Integrar emisión de eventos desde logger
    - Emitir evento 'music:log' para cada log
    - Emitir evento 'music:error' para errores críticos
    - Emitir evento 'music:status' cuando cambie estado de sesión
    - _Requerimientos: 6.7_

- [ ]* 18. Escribir unit tests para dashboard y API
  - Testear GET /api/music/status retorna estructura correcta
  - Testear POST /api/music/session requiere autenticación
  - Testear validación de cookies en POST /api/music/session
  - Testear filtrado de logs en GET /api/music/logs
  - _Requerimientos: 9.1, 9.6, 3.2, 6.4_

- [ ] 19. Checkpoint - Probar dashboard y configuración de cookies
  - Acceder al dashboard y verificar que muestre estado correctamente
  - Configurar cookies de YouTube Premium desde el dashboard
  - Verificar que cookies se guarden en base de datos
  - Probar !play y verificar que use cookies (sin anuncios)
  - Verificar que logs aparezcan en tiempo real en la consola del dashboard
  - Asegurarse de que todos los tests pasen
  - Preguntar al usuario si hay dudas o ajustes necesarios

### Fase 4: Testing Comprehensivo y Revisión de Seguridad

- [ ]* 20. Completar suite de property-based tests
  - Ejecutar todos los property tests con mínimo 100 iteraciones
  - Verificar que todas las propiedades de correctness pasen
  - Documentar cualquier edge case descubierto
  - _Requerimientos: Todas las propiedades 1-16_

- [ ]* 21. Completar suite de unit tests
  - Alcanzar mínimo 80% de cobertura de código
  - Testear todos los casos edge identificados
  - Testear manejo de errores en todos los componentes
  - _Requerimientos: Todos los requerimientos_

- [ ]* 22. Ejecutar tests de integración end-to-end
  - Testear flujo completo: !play → navegación → audio → !stop
  - Testear múltiples intentos de play simultáneos (rechazo)
  - Testear recuperación después de errores
  - Testear persistencia de configuración después de reinicio
  - _Requerimientos: 1.1, 1.2, 8.1, 10.4_

- [ ] 23. Realizar revisión de seguridad completa
  - [ ] 23.1 Revisar almacenamiento de cookies de YouTube Premium
    - Verificar que cookies se almacenen de forma segura
    - Considerar encriptación adicional si es necesario
    - _Requerimientos: 11.2_
  
  - [ ] 23.2 Revisar sanitización de inputs
    - Auditar validateMusicQuery() para injection attacks
    - Auditar validación de cookies
    - Auditar sanitización de parámetros de API
    - _Requerimientos: 11.3, 11.6_
  
  - [ ] 23.3 Revisar autenticación y autorización
    - Verificar que todos los endpoints API requieran autenticación
    - Verificar que WebSocket requiera autenticación
    - Verificar que solo administradores puedan configurar cookies
    - _Requerimientos: 11.4_
  
  - [ ] 23.4 Revisar seguridad de interacciones con procesos externos
    - Auditar spawn de ffmpeg para command injection
    - Auditar lanzamiento de Playwright para vulnerabilidades
    - _Requerimientos: 11.5_
  
  - [ ] 23.5 Revisar seguridad de logs
    - Verificar que logs no expongan cookies
    - Verificar que logs no expongan tokens de usuario
    - Verificar que stack traces no expongan paths sensibles
    - _Requerimientos: 11.7_
  
  - [ ] 23.6 Documentar vulnerabilidades encontradas
    - Crear documento con severidad y recomendaciones
    - Priorizar remediación de vulnerabilidades críticas
    - _Requerimientos: 11.8, 11.9_

- [ ] 24. Checkpoint final - Validación completa del sistema
  - Ejecutar todos los tests (unit, property, integration)
  - Verificar que cobertura de tests sea >= 80%
  - Revisar documento de vulnerabilidades de seguridad
  - Resolver cualquier vulnerabilidad crítica identificada
  - Probar sistema completo en ambiente de staging
  - Asegurarse de que todos los tests pasen
  - Preguntar al usuario si está listo para despliegue o si requiere ajustes adicionales

## Notas Importantes

- Las tareas marcadas con `*` son opcionales (principalmente tests) y pueden omitirse para un MVP más rápido
- Cada checkpoint es un punto de pausa para pruebas iterativas y feedback del usuario
- Todas las tareas de implementación referencian los requerimientos específicos que satisfacen
- Los property tests validan propiedades universales de correctness del diseño
- Los unit tests validan ejemplos específicos y casos edge
- La implementación es incremental: cada fase construye sobre la anterior
- Se recomienda NO omitir los checkpoints para detectar problemas temprano
- La revisión de seguridad (Fase 4) es crítica antes de despliegue en producción
