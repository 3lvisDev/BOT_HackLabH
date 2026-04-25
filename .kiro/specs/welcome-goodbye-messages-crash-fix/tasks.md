# Plan de Implementación

- [x] 1. Escribir test de exploración de la condición del bug
  - **Property 1: Bug Condition** - Variable sqliteDb no definida causa crashes
  - **CRÍTICO**: Este test DEBE FALLAR en el código sin corregir - el fallo confirma que el bug existe
  - **NO intentar corregir el test o el código cuando falle**
  - **NOTA**: Este test codifica el comportamiento esperado - validará el fix cuando pase después de la implementación
  - **OBJETIVO**: Demostrar con contraejemplos que el bug existe
  - **Enfoque PBT Acotado**: Para este bug determinista, acotar la propiedad a los casos concretos que fallan
  - Crear test que simule evento `guildMemberAdd` con usuario no-bot
  - Verificar que el código actual intenta usar `sqliteDb.get()` y falla con "Cannot read property 'get' of undefined"
  - Crear test que simule evento `guildMemberRemove` con usuario no-bot
  - Verificar que el código actual intenta usar `sqliteDb.get()` y falla con "Cannot read property 'get' of undefined"
  - Ejecutar test en código SIN CORREGIR
  - **RESULTADO ESPERADO**: Test FALLA (esto es correcto - prueba que el bug existe)
  - Documentar contraejemplos encontrados para entender la causa raíz
  - Marcar tarea completa cuando el test esté escrito, ejecutado, y el fallo documentado
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Escribir tests de preservación de propiedades (ANTES de implementar el fix)
  - **Property 2: Preservation** - Comportamiento existente debe mantenerse
  - **IMPORTANTE**: Seguir metodología de observación primero
  - Observar comportamiento en código SIN CORREGIR para entradas no-buggy
  - Escribir tests basados en propiedades que capturen los patrones de comportamiento observados de los Requisitos de Preservación
  - Testing basado en propiedades genera muchos casos de prueba para garantías más fuertes
  - Test 1: Verificar que usuarios bot son ignorados (return early si `member.user.bot`)
  - Test 2: Verificar que `applySmartRoles(member)` se ejecuta después de 3 segundos tras asignar rol base
  - Test 3: Verificar que `replaceVars()` sustituye correctamente `{user}`, `{server}`, `{count}`
  - Test 4: Verificar comportamiento silencioso cuando no existe configuración de welcome_settings
  - Test 5: Verificar que errores son capturados en try-catch y registrados en consola
  - Ejecutar tests en código SIN CORREGIR
  - **RESULTADO ESPERADO**: Tests PASAN (esto confirma el comportamiento base a preservar)
  - Marcar tarea completa cuando tests estén escritos, ejecutados, y pasando en código sin corregir
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix para variable sqliteDb no definida en eventos de miembros

  - [x] 3.1 Implementar el fix en evento guildMemberAdd (línea 759)
    - Reemplazar `sqliteDb.get()` con callback por `await db.getSettings(member.guild.id)`
    - Eliminar el callback `(err, welcome) => {}` y usar async/await directamente
    - Mantener la lógica existente de verificación de `welcome_enabled` y `welcome_channel`
    - Mantener el envío de mensaje con `replaceVars(welcome.welcome_message, member)`
    - Mantener el bloque try-catch existente para captura de errores
    - _Bug_Condition: isBugCondition(event) donde event.type = "guildMemberAdd" AND codeUses("sqliteDb") AND NOT isDefined("sqliteDb")_
    - _Expected_Behavior: no_crash(result) AND database_queried_correctly(result) AND uses_async_await(result) AND message_sent_if_enabled(result)_
    - _Preservation: Requisitos de Preservación 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
    - _Requirements: 1.1, 1.3, 2.1, 2.3, 2.5, 2.6_

  - [x] 3.2 Implementar el fix en evento guildMemberRemove (línea 776)
    - Reemplazar `sqliteDb.get()` con callback por `await db.getSettings(member.guild.id)`
    - Eliminar el callback `(err, settings) => {}` y usar async/await directamente
    - Mantener la lógica existente de verificación de `goodbye_enabled` y `goodbye_channel`
    - Mantener el envío de mensaje con `replaceVars(settings.goodbye_message, member)`
    - Mantener el bloque try-catch existente para captura de errores
    - _Bug_Condition: isBugCondition(event) donde event.type = "guildMemberRemove" AND codeUses("sqliteDb") AND NOT isDefined("sqliteDb")_
    - _Expected_Behavior: no_crash(result) AND database_queried_correctly(result) AND uses_async_await(result) AND message_sent_if_enabled(result)_
    - _Preservation: Requisitos de Preservación 3.1, 3.3, 3.4, 3.5, 3.7_
    - _Requirements: 1.2, 1.4, 2.2, 2.4, 2.5, 2.6_

  - [x] 3.3 Verificar que el test de exploración del bug ahora pasa
    - **Property 1: Expected Behavior** - Variable sqliteDb no definida causa crashes
    - **IMPORTANTE**: Re-ejecutar el MISMO test de la tarea 1 - NO escribir un test nuevo
    - El test de la tarea 1 codifica el comportamiento esperado
    - Cuando este test pase, confirma que el comportamiento esperado está satisfecho
    - Ejecutar test de exploración de la condición del bug del paso 1
    - **RESULTADO ESPERADO**: Test PASA (confirma que el bug está corregido)
    - _Requirements: Propiedades de Comportamiento Esperado del diseño_

  - [x] 3.4 Verificar que los tests de preservación aún pasan
    - **Property 2: Preservation** - Comportamiento existente debe mantenerse
    - **IMPORTANTE**: Re-ejecutar los MISMOS tests de la tarea 2 - NO escribir tests nuevos
    - Ejecutar tests de preservación de propiedades del paso 2
    - **RESULTADO ESPERADO**: Tests PASAN (confirma que no hay regresiones)
    - Confirmar que todos los tests aún pasan después del fix (sin regresiones)

- [x] 4. Checkpoint - Asegurar que todos los tests pasan
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 5. (OPCIONAL) Limpiar module.exports duplicado en dashboard.js
  - Revisar si existe duplicación de `module.exports` en dashboard.js
  - Si existe, consolidar en una sola declaración
  - Verificar que no se rompa la funcionalidad del dashboard
