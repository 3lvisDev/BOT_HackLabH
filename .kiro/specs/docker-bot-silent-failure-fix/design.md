# Docker Bot Silent Failure Bugfix Design

## Overview

El bot de Discord falla silenciosamente en Docker porque no valida las variables de entorno requeridas ni captura los errores de inicialización. La solución implementa validación de variables de entorno al inicio, manejo de errores global, y mensajes claros para facilitar el diagnóstico.

El enfoque es:
1. Validar variables de entorno ANTES de intentar conectar a Discord
2. Capturar errores de inicialización (BD, Dashboard, Discord)
3. Mostrar mensajes claros y amigables con instrucciones
4. Agregar manejo de errores global para eventos no capturados

## Glossary

- **Bug_Condition (C)**: El bot intenta iniciar sin validar variables de entorno o sin capturar errores de inicialización
- **Property (P)**: El bot debe validar variables de entorno y mostrar errores claros si algo falla
- **Preservation**: El comportamiento existente del bot (procesamiento de comandos, event listeners, etc.) debe permanecer igual
- **DISCORD_TOKEN**: Token de autenticación del bot de Discord (requerido)
- **DISCORD_CLIENT_ID**: ID de la aplicación Discord OAuth2 (requerido)
- **DISCORD_CLIENT_SECRET**: Secret de la aplicación Discord OAuth2 (requerido)
- **initDB()**: Función que inicializa la base de datos SQLite
- **startDashboard()**: Función que inicia el servidor Express del dashboard
- **client.login()**: Método de discord.js que conecta el bot a Discord

## Bug Details

### Bug Condition

El bug ocurre cuando el bot intenta iniciar pero:
1. Faltan variables de entorno requeridas (DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET)
2. Ocurre un error durante la inicialización de la BD que no es capturado
3. Ocurre un error durante la inicialización del Dashboard que no es capturado
4. Ocurre un error al conectarse a Discord que no es capturado
5. Ocurren errores no capturados en event listeners

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type BotInitializationEvent
  OUTPUT: boolean
  
  RETURN (missingEnvironmentVariables(input) 
          OR uncaughtDatabaseError(input)
          OR uncaughtDashboardError(input)
          OR uncaughtDiscordConnectionError(input)
          OR uncaughtEventListenerError(input))
         AND NOT errorMessageDisplayed(input)
END FUNCTION
```

### Examples

**Example 1: Missing DISCORD_TOKEN**
```
Input: docker run -e DISCORD_CLIENT_ID=123 -e DISCORD_CLIENT_SECRET=secret my-bot:latest
Current: Error [TokenInvalid]: An invalid token was provided.
Expected: ❌ Error: Variable de entorno DISCORD_TOKEN no configurada
          Instrucciones sobre cómo pasar la variable
```

**Example 2: Database Initialization Error**
```
Input: Bot inicia pero la ruta de BD es inválida
Current: Falla silenciosamente sin mostrar error
Expected: ❌ Error en inicialización de BD: [error específico]
          Termina con código de error 1
```

**Example 3: Dashboard Port Already in Use**
```
Input: Puerto 3000 ya está en uso
Current: Falla silenciosamente sin mostrar error
Expected: ❌ Error al iniciar Dashboard: Puerto 3000 ya está en uso
          Termina con código de error 1
```

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- El procesamiento de comandos debe funcionar igual
- Los event listeners deben funcionar igual
- La lógica de inicialización del dashboard debe funcionar igual
- El registro de logs debe funcionar igual
- La asignación de roles debe funcionar igual

**Scope:**
Todos los inputs que NO involucren errores de inicialización deben ser completamente inalterados por este fix. Esto incluye:
- Comandos normales del bot
- Eventos de miembros (join/leave)
- Eventos de mensajes
- Eventos de cambios de roles
- Solicitudes al dashboard

## Hypothesized Root Cause

Basado en el análisis del código, los problemas más probables son:

1. **Falta de Validación de Variables de Entorno**: El código no valida que DISCORD_TOKEN, DISCORD_CLIENT_ID, y DISCORD_CLIENT_SECRET existan antes de intentar usarlos

2. **Falta de Manejo de Errores en client.login()**: El método `client.login()` retorna una Promise que puede rechazarse, pero no hay `.catch()` para capturar el rechazo

3. **Falta de Manejo de Errores en initDB()**: La función `initDB()` puede fallar pero el error no es capturado

4. **Falta de Manejo de Errores en startDashboard()**: La función `startDashboard()` puede fallar pero el error no es capturado

5. **Falta de Manejador Global de Errores**: No hay manejador para `process.on('unhandledRejection')` o `process.on('uncaughtException')`

6. **Falta de Manejador de Errores en Event Listeners**: Los event listeners no tienen try-catch para capturar errores inesperados

## Correctness Properties

Property 1: Environment Validation - Variables de Entorno Requeridas

_For any_ bot initialization where required environment variables are missing (DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET), the fixed bot SHALL validate these variables before attempting to connect and SHALL display a clear error message indicating which variables are missing and how to provide them.

**Validates: Requirements 2.1, 2.2**

Property 2: Error Handling - Errores de Inicialización Capturados

_For any_ bot initialization where an error occurs during database initialization, dashboard initialization, or Discord connection, the fixed bot SHALL capture the error, display a clear error message with context, and terminate with a non-zero exit code.

**Validates: Requirements 2.3, 2.4, 2.5, 2.7**

Property 3: Preservation - Comportamiento Existente Preservado

_For any_ input that does NOT involve initialization errors (normal commands, events, dashboard requests), the fixed bot SHALL produce exactly the same behavior as the original bot, preserving all existing functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

**File**: `index.js`

**Function**: Top-level initialization (antes de `client.once('ready')`)

**Specific Changes**:

1. **Validación de Variables de Entorno**:
   - Crear función `validateEnvironmentVariables()` que verifica DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET
   - Llamar esta función al inicio del archivo, antes de crear el cliente
   - Si faltan variables, mostrar error claro con instrucciones y terminar con `process.exit(1)`

2. **Manejo de Errores en client.login()**:
   - Agregar `.catch()` a `client.login()` para capturar errores de conexión
   - Mostrar mensaje de error claro indicando el motivo
   - Terminar con `process.exit(1)`

3. **Manejo de Errores en initDB()**:
   - Agregar `.catch()` a la inicialización de la BD
   - Mostrar mensaje de error claro
   - Terminar con `process.exit(1)`

4. **Manejo de Errores en startDashboard()**:
   - Agregar `.catch()` a `startDashboard()`
   - Mostrar mensaje de error claro
   - Terminar con `process.exit(1)`

5. **Manejador Global de Errores**:
   - Agregar `process.on('unhandledRejection')` para capturar promesas rechazadas no capturadas
   - Agregar `process.on('uncaughtException')` para capturar excepciones no capturadas
   - Registrar el error y terminar con `process.exit(1)`

6. **Manejador de Errores en Event Listeners**:
   - Agregar try-catch en todos los event listeners principales
   - Registrar errores sin terminar el proceso

### Implementation Details

```javascript
// 1. Validación de Variables de Entorno
function validateEnvironmentVariables() {
  const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'];
  const missing = required.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error(`❌ Error: Variables de entorno faltantes: ${missing.join(', ')}`);
    console.error(`\nAsegúrate de pasar estas variables al contenedor:`);
    console.error(`  docker run -e DISCORD_TOKEN=tu_token -e DISCORD_CLIENT_ID=tu_id -e DISCORD_CLIENT_SECRET=tu_secret ...`);
    console.error(`\nO configúralas en docker-compose.yml:`);
    console.error(`  environment:`);
    console.error(`    DISCORD_TOKEN: tu_token`);
    console.error(`    DISCORD_CLIENT_ID: tu_id`);
    console.error(`    DISCORD_CLIENT_SECRET: tu_secret`);
    process.exit(1);
  }
}

// 2. Manejo de Errores Global
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// 3. Llamar validación al inicio
validateEnvironmentVariables();

// 4. Manejo de errores en client.login()
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error(`❌ Error al conectar a Discord: ${err.message}`);
  process.exit(1);
});
```

## Testing Strategy

### Validation Approach

La estrategia de testing sigue un enfoque de dos fases: primero, escribir tests que demuestren el bug en código sin fix, luego verificar que el fix funciona correctamente y preserva el comportamiento existente.

### Exploratory Bug Condition Checking

**Goal**: Demostrar que el bug existe en código sin fix. Confirmar o refutar el análisis de causa raíz.

**Test Plan**: Escribir tests que simulen:
1. Falta de DISCORD_TOKEN
2. DISCORD_TOKEN inválido
3. Error en inicialización de BD
4. Error en inicialización de Dashboard
5. Error al conectarse a Discord

Ejecutar estos tests en código sin fix para observar fallos y entender la causa raíz.

**Test Cases**:
1. **Missing DISCORD_TOKEN Test**: Simular que DISCORD_TOKEN no está configurado (fallará en código sin fix)
2. **Invalid DISCORD_TOKEN Test**: Simular que DISCORD_TOKEN es inválido (fallará en código sin fix)
3. **Database Error Test**: Simular error en inicialización de BD (fallará en código sin fix)
4. **Dashboard Error Test**: Simular error en inicialización de Dashboard (fallará en código sin fix)
5. **Discord Connection Error Test**: Simular error al conectarse a Discord (fallará en código sin fix)

**Expected Counterexamples**:
- Bot intenta conectar sin validar variables de entorno
- Errores no son capturados ni mostrados
- Proceso termina sin información de diagnóstico

### Fix Checking

**Goal**: Verificar que para todos los inputs donde el bug condition se cumple, el bot corregido produce el comportamiento esperado.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := botInitialization_fixed(input)
  ASSERT clear_error_message(result)
    AND process_exits_with_error_code(result)
    AND docker_logs_show_diagnostics(result)
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todos los inputs donde el bug condition NO se cumple, el bot corregido produce el mismo resultado que el original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT botInitialization_original(input) = botInitialization_fixed(input)
END FOR
```

**Test Plan**: Escribir tests que verifiquen que el comportamiento normal del bot no cambia:
1. Procesamiento de comandos funciona igual
2. Event listeners funcionan igual
3. Dashboard funciona igual
4. Asignación de roles funciona igual

**Test Cases**:
1. **Command Processing Preservation**: Verificar que comandos se procesan igual
2. **Event Listener Preservation**: Verificar que eventos se procesan igual
3. **Dashboard Preservation**: Verificar que dashboard funciona igual
4. **Role Assignment Preservation**: Verificar que asignación de roles funciona igual

### Unit Tests

- Test de validación de variables de entorno
- Test de manejo de errores en client.login()
- Test de manejo de errores en initDB()
- Test de manejo de errores en startDashboard()
- Test de manejador global de errores

### Property-Based Tests

- Generar diferentes combinaciones de variables de entorno faltantes y verificar que se muestren errores claros
- Generar diferentes tipos de errores de inicialización y verificar que se capturen correctamente
- Verificar que el comportamiento normal del bot no cambia

### Integration Tests

- Test de inicialización completa del bot con variables de entorno válidas
- Test de inicialización completa del bot con variables de entorno faltantes
- Test de inicialización completa del bot con errores de BD
- Test de inicialización completa del bot con errores de Dashboard
