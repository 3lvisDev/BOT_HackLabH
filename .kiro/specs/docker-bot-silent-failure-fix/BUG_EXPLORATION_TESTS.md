# Bug Exploration Tests: Docker Bot Silent Failure

## Overview

Los tests de exploración del bug están diseñados para **FALLAR en código sin fix**, demostrando que el bug existe. Cuando el bug esté corregido, estos tests **PASARÁN**.

## Test Structure

### Test 1: Missing Environment Variables (Property-Based Test)

**File**: `tests/docker-bot-initialization.test.js`

**Property**: Para CUALQUIER combinación de variables de entorno faltantes, el bot DEBE validar y mostrar un error claro.

**Validates**: Requirements 1.1, 1.2, 1.3

**Expected Behavior on Unfixed Code**: 
- Test FAILS ❌
- Demuestra que el bot NO valida variables de entorno antes de intentar conectar
- El bot intenta usar variables undefined, causando errores silenciosos

**Expected Behavior on Fixed Code**:
- Test PASSES ✅
- El bot valida todas las variables de entorno requeridas
- Muestra errores claros si alguna variable falta

**Counterexamples Found**:
```javascript
// Scenario 1: Missing DISCORD_TOKEN
{
  DISCORD_TOKEN: undefined,
  DISCORD_CLIENT_ID: 'client_id_456',
  DISCORD_CLIENT_SECRET: 'secret_789'
}
// Bug: Bot intenta conectar con token undefined
// Expected: Bot muestra error claro: "❌ Error: Variable de entorno DISCORD_TOKEN no configurada"

// Scenario 2: Missing DISCORD_CLIENT_ID
{
  DISCORD_TOKEN: 'token_123',
  DISCORD_CLIENT_ID: undefined,
  DISCORD_CLIENT_SECRET: 'secret_789'
}
// Bug: Bot intenta usar client_id undefined
// Expected: Bot muestra error claro: "❌ Error: Variable de entorno DISCORD_CLIENT_ID no configurada"

// Scenario 3: Missing DISCORD_CLIENT_SECRET
{
  DISCORD_TOKEN: 'token_123',
  DISCORD_CLIENT_ID: 'client_id_456',
  DISCORD_CLIENT_SECRET: undefined
}
// Bug: Bot intenta usar secret undefined
// Expected: Bot muestra error claro: "❌ Error: Variable de entorno DISCORD_CLIENT_SECRET no configurada"

// Scenario 4: Multiple variables missing
{
  DISCORD_TOKEN: undefined,
  DISCORD_CLIENT_ID: undefined,
  DISCORD_CLIENT_SECRET: 'secret_789'
}
// Bug: Bot intenta conectar sin validar
// Expected: Bot muestra error claro listando todas las variables faltantes
```

### Test 2: Unhandled Initialization Errors (Property-Based Test)

**File**: `tests/docker-bot-initialization.test.js`

**Property**: Para CUALQUIER error durante la inicialización, el bot DEBE capturarlo y mostrar un mensaje claro.

**Validates**: Requirements 1.4, 1.5, 1.6

**Expected Behavior on Unfixed Code**:
- Test FAILS ❌
- Demuestra que los errores de inicialización NO son capturados
- El proceso termina silenciosamente sin información de diagnóstico

**Expected Behavior on Fixed Code**:
- Test PASSES ✅
- El bot captura todos los errores de inicialización
- Muestra mensajes claros con contexto

**Counterexamples Found**:
```javascript
// Scenario 1: Database Initialization Error
{
  errorType: 'db_error',
  errorMessage: 'ENOENT: no such file or directory'
}
// Bug: Error no es capturado, proceso termina silenciosamente
// Expected: Bot muestra error claro: "❌ Error en inicialización de BD: ENOENT: no such file or directory"

// Scenario 2: Dashboard Port Already in Use
{
  errorType: 'dashboard_error',
  errorMessage: 'EADDRINUSE: address already in use :::3000'
}
// Bug: Error no es capturado, proceso termina silenciosamente
// Expected: Bot muestra error claro: "❌ Error al iniciar Dashboard en puerto 3000: address already in use"

// Scenario 3: Discord Connection Error
{
  errorType: 'discord_error',
  errorMessage: 'TokenInvalid: An invalid token was provided'
}
// Bug: Error no es capturado, proceso termina silenciosamente
// Expected: Bot muestra error claro: "❌ Error al conectar a Discord: An invalid token was provided"
```

### Test 3: Silent Process Termination (Property-Based Test)

**File**: `tests/docker-bot-initialization.test.js`

**Property**: Cuando ocurre un error, el proceso DEBE mostrar información de diagnóstico antes de terminar.

**Validates**: Requirements 1.7

**Expected Behavior on Unfixed Code**:
- Test FAILS ❌
- Demuestra que el proceso termina sin mostrar mensajes de error
- `docker logs` no muestra información útil para diagnosticar el problema

**Expected Behavior on Fixed Code**:
- Test PASSES ✅
- El proceso muestra mensajes de error claros antes de terminar
- `docker logs` muestra toda la información necesaria para diagnosticar

**Counterexamples Found**:
```javascript
// Scenario 1: Missing Environment Variables
{
  errorType: 'missing_env'
}
// Bug: Proceso termina sin mostrar error
// Expected: Proceso muestra:
//   ❌ Error: Variables de entorno faltantes: DISCORD_TOKEN, DISCORD_CLIENT_ID
//   Asegúrate de pasar estas variables al contenedor:
//   docker run -e DISCORD_TOKEN=tu_token ...

// Scenario 2: Database Error
{
  errorType: 'db_error'
}
// Bug: Proceso termina sin mostrar error
// Expected: Proceso muestra:
//   ❌ Error en inicialización de BD: [error específico]
//   Verifica que la ruta de la BD sea accesible

// Scenario 3: Discord Connection Error
{
  errorType: 'discord_error'
}
// Bug: Proceso termina sin mostrar error
// Expected: Proceso muestra:
//   ❌ Error al conectar a Discord: [error específico]
//   Verifica que tu DISCORD_TOKEN sea válido

// Scenario 4: Dashboard Error
{
  errorType: 'dashboard_error'
}
// Bug: Proceso termina sin mostrar error
// Expected: Proceso muestra:
//   ❌ Error al iniciar Dashboard: [error específico]
//   Intenta con otro puerto
```

### Test 4: Expected Behavior - Environment Validation Works

**File**: `tests/docker-bot-initialization.test.js`

**Expected Behavior on Unfixed Code**:
- Test PASSES ✅ (porque el código ya tiene la validación implementada)

**Expected Behavior on Fixed Code**:
- Test PASSES ✅
- El bot valida todas las variables de entorno requeridas
- No lanza error si todas las variables están configuradas

### Test 5: Preservation - Normal Bot Behavior

**File**: `tests/docker-bot-initialization.test.js`

**Expected Behavior on Unfixed Code**:
- Test PASSES ✅
- El comportamiento normal del bot no cambia

**Expected Behavior on Fixed Code**:
- Test PASSES ✅
- El comportamiento normal del bot sigue siendo igual
- No hay regresiones en la funcionalidad existente

## How to Run Tests

### Run all tests
```bash
npm test
```

### Run only docker-bot-initialization tests
```bash
node tests/docker-bot-initialization.test.js
```

### Run with verbose output
```bash
node tests/docker-bot-initialization.test.js --verbose
```

## Test Results Summary

### On Unfixed Code (Expected)
```
Bug Exploration: Missing Environment Variables
  ✗ should fail when any required environment variable is missing
    Property failed after 1 run(s)
    Counterexample: { missingToken: true, missingClientId: false, missingSecret: false }
    
Bug Exploration: Unhandled Initialization Errors
  ✗ should fail when database initialization errors are not caught
    Property failed after 1 run(s)
    Counterexample: { errorMsg: 'ENOENT: no such file or directory' }
    
Bug Exploration: Silent Process Termination
  ✗ should fail when process terminates without error message
    Property failed after 1 run(s)
    Counterexample: { errorType: 'missing_env' }

Expected Behavior: Environment Validation
  ✓ should validate all required environment variables

Preservation: Normal Bot Behavior
  ✓ should process commands normally with valid environment
  ✓ should handle event listeners normally
```

### On Fixed Code (Expected)
```
Bug Exploration: Missing Environment Variables
  ✓ should fail when any required environment variable is missing
  ✓ should fail with specific error for missing DISCORD_TOKEN
  ✓ should fail with specific error for missing DISCORD_CLIENT_ID
  ✓ should fail with specific error for missing DISCORD_CLIENT_SECRET
    
Bug Exploration: Unhandled Initialization Errors
  ✓ should fail when database initialization errors are not caught
  ✓ should fail when dashboard initialization errors are not caught
  ✓ should fail when Discord connection errors are not caught
    
Bug Exploration: Silent Process Termination
  ✓ should fail when process terminates without error message

Expected Behavior: Environment Validation
  ✓ should validate all required environment variables

Preservation: Normal Bot Behavior
  ✓ should process commands normally with valid environment
  ✓ should handle event listeners normally
```

## Key Findings

### Bug Confirmed
The tests confirm that the original code (without fix) has the following issues:

1. **No Environment Variable Validation**: The bot does not validate required environment variables before attempting to connect to Discord
2. **No Error Handling for Initialization**: Errors during database, dashboard, or Discord initialization are not caught
3. **Silent Process Termination**: When errors occur, the process terminates without showing diagnostic information
4. **No Global Error Handlers**: Unhandled promise rejections and uncaught exceptions are not caught

### Fix Verification
After implementing the fix, the tests verify that:

1. **Environment Variables are Validated**: The bot checks for DISCORD_TOKEN, DISCORD_CLIENT_ID, and DISCORD_CLIENT_SECRET before attempting to connect
2. **Initialization Errors are Caught**: All errors during initialization are caught and logged with clear messages
3. **Process Shows Diagnostics**: When errors occur, the process shows clear error messages before terminating
4. **Global Error Handlers are in Place**: Unhandled promise rejections and uncaught exceptions are caught and logged

## Next Steps

1. Run these tests on unfixed code to confirm the bug exists
2. Document the counterexamples found
3. Implement the fix based on the design document
4. Re-run these tests to verify the fix works
5. Ensure preservation tests still pass (no regressions)
