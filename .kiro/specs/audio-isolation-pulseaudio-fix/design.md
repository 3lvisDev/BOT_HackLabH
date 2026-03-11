# Audio Isolation PulseAudio Fix - Bugfix Design

## Overview

El bot de música de Discord con YouTube Premium no reproduce audio cuando se ejecuta el comando `!play`. El bot se conecta al canal de voz pero queda "dormido" sin emitir sonido. La causa raíz es que el navegador Chromium no está redirigiendo su audio al sink virtual de PulseAudio a pesar de configurar la variable de entorno `PULSE_SINK`. Esto impide que FFmpeg capture el stream de audio desde el monitor del sink virtual.

La estrategia de fix consiste en forzar explícitamente la redirección del audio del navegador al sink virtual usando comandos de PulseAudio (`pactl move-sink-input`) después de que el navegador inicie, en lugar de depender únicamente de la variable de entorno `PULSE_SINK` que no está siendo respetada por Chromium.

## Glossary

- **Bug_Condition (C)**: La condición que activa el bug - cuando el navegador Chromium se lanza con `PULSE_SINK` pero no redirige su audio al sink virtual
- **Property (P)**: El comportamiento deseado - el audio del navegador debe fluir al sink virtual y ser capturado por FFmpeg para enviarse a Discord
- **Preservation**: El comportamiento existente de creación de sink virtual, navegación a YouTube, y limpieza de recursos que debe permanecer sin cambios
- **_launchBrowser**: La función en `music/MusicManager.js` que lanza el navegador Chromium y configura el sink virtual de PulseAudio
- **_startAudioBridge**: La función en `music/MusicManager.js` que inicia FFmpeg para capturar audio desde el monitor del sink virtual
- **virtualSinkName**: El nombre del sink virtual de PulseAudio con formato `discord_music_${guildId}`
- **sink-input**: En PulseAudio, representa un stream de audio de una aplicación conectada a un sink

## Bug Details

### Bug Condition

El bug se manifiesta cuando el navegador Chromium se lanza con la variable de entorno `PULSE_SINK` configurada, pero el navegador ignora esta configuración y envía su audio al sink por defecto del sistema en lugar del sink virtual aislado. Esto causa que FFmpeg no reciba ningún stream de audio al intentar capturar desde el monitor del sink virtual.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { command: string, browserLaunched: boolean, audioPlaying: boolean }
  OUTPUT: boolean
  
  RETURN input.command == '!play'
         AND input.browserLaunched == true
         AND input.audioPlaying == true
         AND NOT audioStreamInVirtualSink(input.guildId)
         AND NOT ffmpegReceivingAudio()
END FUNCTION
```

### Examples

- Usuario ejecuta `!play despacito` → Bot se conecta al canal de voz → Navegador carga el video → Video se reproduce en el navegador → FFmpeg no recibe audio → Discord no emite sonido → Bot queda "dormido"
- Usuario ejecuta `!play https://youtube.com/watch?v=xyz` → Bot se conecta → Video carga correctamente → Título se muestra en logs → FFmpeg stderr no muestra errores pero stdout no emite datos → Discord silencio total
- Usuario ejecuta `!play música relajante` → Sink virtual se crea exitosamente → Navegador se lanza con PULSE_SINK configurado → Video se reproduce → `pactl list sink-inputs` muestra que Chromium está conectado al sink por defecto, NO al sink virtual → FFmpeg captura silencio
- Usuario ejecuta `!play` en servidor con ID 123456 → Sink `discord_music_123456` se crea → Navegador ignora PULSE_SINK → Audio va al sink por defecto → Usuario escucha el audio en sus audífonos (comportamiento no deseado) → Discord no recibe audio

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- La creación del sink virtual de PulseAudio con nombre `discord_music_${guildId}` debe continuar funcionando exactamente igual
- La navegación del navegador a YouTube y la carga del video deben permanecer sin cambios
- La limpieza de recursos al ejecutar `!stop` debe continuar funcionando correctamente
- La aplicación de cookies de YouTube Premium debe permanecer sin cambios
- El audio NO debe reproducirse en los audífonos/parlantes del usuario (debe permanecer aislado)
- El sistema NO debe capturar el micrófono del usuario (solo el audio del navegador)

**Scope:**
Todas las operaciones que NO involucran la redirección del audio del navegador al sink virtual deben permanecer completamente sin afectar. Esto incluye:
- Conexión al canal de voz de Discord
- Creación y destrucción del sink virtual
- Navegación y búsqueda en YouTube
- Aplicación de cookies de sesión
- Manejo de eventos del reproductor de Discord
- Limpieza de recursos y desconexión

## Hypothesized Root Cause

Basado en la descripción del bug y el análisis del código, las causas más probables son:

1. **Variable de Entorno PULSE_SINK Ignorada**: Chromium puede estar ignorando la variable de entorno `PULSE_SINK` cuando se lanza con Playwright. Esto es común porque:
   - Playwright puede no pasar correctamente las variables de entorno al proceso del navegador
   - Chromium puede tener su propia lógica de selección de sink que sobrescribe la variable de entorno
   - El sandbox de Chromium puede estar bloqueando el acceso a la configuración de PulseAudio

2. **Timing de Inicialización**: El sink virtual se crea correctamente, pero cuando el navegador inicia, puede conectarse al sink por defecto antes de que la variable de entorno tenga efecto

3. **Falta de Verificación**: El código actual no verifica que el navegador realmente esté enviando audio al sink virtual correcto. Asume que `PULSE_SINK` funciona sin validación

4. **Necesidad de Redirección Explícita**: PulseAudio requiere que los sink-inputs se muevan explícitamente usando `pactl move-sink-input` después de que la aplicación inicie, en lugar de depender solo de variables de entorno

## Correctness Properties

Property 1: Bug Condition - Audio Stream Redirection to Virtual Sink

_For any_ comando `!play` donde el navegador Chromium se lanza y reproduce un video de YouTube, el sistema fijo SHALL identificar el sink-input del navegador en PulseAudio y moverlo explícitamente al sink virtual aislado usando `pactl move-sink-input`, de modo que FFmpeg pueda capturar el audio desde el monitor del sink virtual y enviarlo a Discord.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Non-Audio-Routing Behavior

_For any_ operación que NO involucre la redirección del audio del navegador al sink virtual (creación de sink, navegación a YouTube, limpieza de recursos, aplicación de cookies), el código fijo SHALL producir exactamente el mismo comportamiento que el código original, preservando toda la funcionalidad existente de gestión de recursos y navegación.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Asumiendo que nuestro análisis de causa raíz es correcto:

**File**: `music/MusicManager.js`

**Function**: `_launchBrowser`

**Specific Changes**:
1. **Agregar Verificación y Redirección de Sink-Input**: Después de lanzar el navegador y antes de que `_navigateToYouTube` complete, agregar lógica para:
   - Esperar a que el navegador Chromium cree su sink-input en PulseAudio
   - Identificar el sink-input del proceso Chromium usando `pactl list sink-inputs`
   - Mover explícitamente ese sink-input al sink virtual usando `pactl move-sink-input <id> <virtualSinkName>`
   - Verificar que la redirección fue exitosa

2. **Agregar Polling de Sink-Input**: Implementar un mecanismo de polling con timeout para detectar cuando el navegador crea su sink-input:
   - Ejecutar `pactl list sink-inputs` en un loop con intervalos de 500ms
   - Buscar el sink-input que corresponde al proceso Chromium (por nombre de aplicación o PID)
   - Timeout de 10 segundos si no se detecta el sink-input

3. **Agregar Logging de Diagnóstico**: Agregar logs detallados para debugging:
   - Log cuando se detecta el sink-input del navegador
   - Log del ID del sink-input y el sink al que está conectado inicialmente
   - Log de la operación de movimiento del sink-input
   - Log de verificación de que el sink-input está ahora en el sink virtual correcto

4. **Mantener Variable PULSE_SINK**: Aunque no funciona de forma confiable, mantener la configuración de `PULSE_SINK` como fallback por si en algunos sistemas sí funciona

5. **Agregar Manejo de Errores**: Si no se puede detectar o mover el sink-input después del timeout, lanzar un error descriptivo que explique el problema

**Function**: `_navigateToYouTube`

**Specific Changes**:
1. **Agregar Delay Adicional**: Después de iniciar la reproducción del video, agregar un delay adicional de 1-2 segundos para asegurar que el audio comience a fluir antes de que `_startAudioBridge` intente capturarlo

**Function**: `_startAudioBridge`

**Specific Changes**:
1. **Agregar Verificación de Audio en Monitor**: Antes de iniciar FFmpeg, verificar que el monitor del sink virtual está recibiendo audio usando `pactl list sinks` y verificando el campo `State` del sink virtual

## Testing Strategy

### Validation Approach

La estrategia de testing sigue un enfoque de dos fases: primero, demostrar el bug en el código sin fix ejecutando tests exploratorios que fallarán, luego verificar que el fix funciona correctamente y preserva el comportamiento existente.

### Exploratory Bug Condition Checking

**Goal**: Demostrar el bug ANTES de implementar el fix. Confirmar o refutar el análisis de causa raíz. Si refutamos, necesitaremos re-hipotetizar.

**Test Plan**: Escribir tests que simulen el comando `!play`, lancen el navegador, y verifiquen que el sink-input del navegador está en el sink virtual correcto. Ejecutar estos tests en el código SIN FIX para observar fallos y entender la causa raíz.

**Test Cases**:
1. **Sink-Input Detection Test**: Simular `!play` y verificar que se puede detectar el sink-input de Chromium en PulseAudio (fallará en código sin fix si el navegador no crea sink-input o se crea con delay)
2. **Sink-Input Location Test**: Verificar que el sink-input de Chromium está conectado al sink virtual `discord_music_${guildId}` (fallará en código sin fix - estará en sink por defecto)
3. **FFmpeg Audio Reception Test**: Verificar que FFmpeg stdout emite datos de audio después de iniciar el puente (fallará en código sin fix - stdout estará vacío)
4. **Audio Isolation Test**: Verificar que el audio NO se reproduce en el sink por defecto del sistema (fallará en código sin fix - audio se escuchará en audífonos del usuario)

**Expected Counterexamples**:
- El sink-input de Chromium se conecta al sink por defecto en lugar del sink virtual
- Posibles causas: variable PULSE_SINK ignorada, timing de inicialización, falta de redirección explícita

### Fix Checking

**Goal**: Verificar que para todas las ejecuciones del comando `!play` donde el navegador se lanza y reproduce audio, el sistema fijo redirige correctamente el audio al sink virtual y FFmpeg lo captura.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := play_fixed(input.guildId, input.voiceChannelId, input.query)
  ASSERT chromiumSinkInputInVirtualSink(input.guildId)
  ASSERT ffmpegReceivingAudioData()
  ASSERT discordPlayingAudio()
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todas las operaciones que NO involucran la redirección de audio del navegador, el código fijo produce el mismo resultado que el código original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT play_original(input) = play_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing es recomendado para preservation checking porque:
- Genera muchos casos de prueba automáticamente a través del dominio de entrada
- Detecta casos edge que los tests unitarios manuales podrían perder
- Proporciona garantías fuertes de que el comportamiento permanece sin cambios para todas las operaciones no relacionadas con el bug

**Test Plan**: Observar el comportamiento en el código SIN FIX primero para operaciones de creación de sink, navegación, y limpieza, luego escribir property-based tests que capturen ese comportamiento.

**Test Cases**:
1. **Virtual Sink Creation Preservation**: Observar que `pactl load-module module-null-sink` se ejecuta correctamente en código sin fix, luego verificar que continúa funcionando igual después del fix
2. **YouTube Navigation Preservation**: Observar que la navegación a YouTube y carga de video funciona en código sin fix, luego verificar que continúa igual después del fix
3. **Resource Cleanup Preservation**: Observar que `!stop` limpia recursos correctamente en código sin fix, luego verificar que continúa igual después del fix
4. **Cookie Application Preservation**: Observar que las cookies de YouTube Premium se aplican correctamente en código sin fix, luego verificar que continúa igual después del fix

### Unit Tests

- Test de detección de sink-input de Chromium en PulseAudio
- Test de movimiento de sink-input al sink virtual usando `pactl move-sink-input`
- Test de verificación de que el sink-input está en el sink correcto después del movimiento
- Test de manejo de timeout si el sink-input no se detecta en 10 segundos
- Test de que FFmpeg recibe datos de audio desde el monitor del sink virtual

### Property-Based Tests

- Generar múltiples comandos `!play` con diferentes queries y verificar que el audio siempre se redirige correctamente
- Generar diferentes configuraciones de PulseAudio (múltiples sinks) y verificar que el sistema siempre identifica y mueve el sink-input correcto
- Generar escenarios de múltiples servidores (diferentes guildIds) y verificar que cada uno tiene su sink virtual aislado correctamente

### Integration Tests

- Test de flujo completo: `!play` → conexión a voz → lanzamiento de navegador → redirección de audio → captura con FFmpeg → reproducción en Discord
- Test de aislamiento de audio: verificar que el audio NO se reproduce en los dispositivos del usuario mientras se reproduce en Discord
- Test de limpieza: verificar que después de `!stop` el sink virtual se elimina y no quedan procesos huérfanos
