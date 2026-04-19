# Bugfix Requirements Document: Docker Bot Silent Failure

## Introduction

El bot de Discord no levanta correctamente cuando se ejecuta en Docker con `docker run` o `docker-compose up`. El proceso falla silenciosamente sin mostrar errores claros, lo que hace imposible diagnosticar el problema. El contenedor se inicia pero el bot nunca se conecta a Discord ni inicia el dashboard web.

**Causa Raíz Probable:** El bot carece de manejo de errores global suficiente. Cuando ocurren errores durante la inicialización (variables de entorno faltantes que se pasan desde tu PC al contenedor, fallos de conexión a Discord, errores en la base de datos, fallos en la inicialización del dashboard), estos errores no se capturan ni se registran adecuadamente, causando que el proceso se cierre silenciosamente sin información de diagnóstico.

**Contexto de Docker:** Las variables de entorno se pasan desde tu PC al contenedor usando:
- `docker run -e DISCORD_TOKEN=tu_token ...` (línea de comandos)
- `docker-compose.yml` con sección `environment:` (archivo de configuración)
- Archivo `.env` que docker-compose lee automáticamente

El bot debe validar que estas variables estén presentes cuando inicia dentro del contenedor y mostrar errores claros si faltan.

**Impacto:** El bot es completamente inoperable en Docker, impidiendo el despliegue en producción o en entornos containerizados.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN se ejecuta `docker run` o `docker-compose up` THEN el contenedor inicia pero el bot nunca se conecta a Discord y muestra un error de discord.js poco amigable sin contexto claro

1.2 WHEN se ejecuta `docker logs` después de que el bot falla THEN se muestra un error de discord.js "TokenInvalid" pero sin indicar claramente que la variable DISCORD_TOKEN no está configurada o es inválida

1.3 WHEN faltan variables de entorno requeridas (DISCORD_TOKEN, DISCORD_CLIENT_ID, etc.) THEN el bot no valida estas variables al iniciar y muestra un error genérico de discord.js

1.4 WHEN ocurre un error durante la inicialización de la base de datos THEN el error no se captura ni se registra, causando que el proceso termine sin información

1.5 WHEN ocurre un error durante la inicialización del dashboard Express THEN el error no se propaga correctamente y el bot se cierra sin mostrar el motivo

1.6 WHEN ocurre un error no capturado en un event listener de Discord THEN el error no se registra y el bot puede quedar en estado inconsistente

1.7 WHEN el bot intenta conectarse a Discord pero falla THEN no hay reintentos automáticos ni mensajes de error claros que indiquen qué variable de entorno está mal configurada

### Expected Behavior (Correct)

2.1 WHEN se ejecuta `docker run` o `docker-compose up` THEN el bot DEBERÁ validar todas las variables de entorno requeridas al iniciar y mostrar un error claro si alguna falta

2.2 WHEN faltan variables de entorno THEN el bot DEBERÁ mostrar un mensaje de error específico indicando cuál variable falta y terminar con código de error

2.3 WHEN ocurre un error durante la inicialización de la base de datos THEN el bot DEBERÁ capturar el error, registrarlo en consola con contexto claro, y terminar con código de error

2.4 WHEN ocurre un error durante la inicialización del dashboard THEN el bot DEBERÁ capturar el error, registrarlo en consola, y terminar con código de error

2.5 WHEN el bot se conecta exitosamente a Discord THEN DEBERÁ mostrar un mensaje claro en consola indicando "Bot iniciado como [tag]" y "Esperando comando: !setup_community"

2.6 WHEN ocurre un error no capturado en un event listener THEN el bot DEBERÁ capturarlo con un manejador global de errores y registrarlo sin terminar el proceso

2.7 WHEN el bot intenta conectarse a Discord pero falla THEN DEBERÁ mostrar un mensaje de error claro indicando el motivo del fallo

2.8 WHEN se ejecuta `docker logs` THEN DEBERÁ mostrar todos los mensajes de inicialización, errores, y estado del bot para facilitar el diagnóstico

### Unchanged Behavior (Regression Prevention)

3.1 WHEN el bot se conecta exitosamente a Discord THEN el sistema DEBERÁ CONTINUAR iniciando el dashboard en el puerto configurado

3.2 WHEN el bot recibe un comando válido THEN el sistema DEBERÁ CONTINUAR procesándolo sin cambios en la lógica

3.3 WHEN ocurre un error en un event listener THEN el sistema DEBERÁ CONTINUAR procesando otros eventos sin interrupciones

3.4 WHEN el usuario ejecuta `!setup_community` THEN el sistema DEBERÁ CONTINUAR ejecutando la lógica de configuración sin cambios

3.5 WHEN el bot está en funcionamiento THEN el sistema DEBERÁ CONTINUAR registrando logs en consola como lo hace actualmente

3.6 WHEN el dashboard recibe una solicitud THEN el sistema DEBERÁ CONTINUAR procesándola sin cambios en la lógica

## Bug Condition

### Function: isBugCondition

```pascal
FUNCTION isBugCondition(event)
  INPUT: event of type BotInitializationEvent
  OUTPUT: boolean
  
  // El bug ocurre cuando el bot intenta iniciar pero:
  // 1. Faltan variables de entorno requeridas, O
  // 2. Ocurre un error durante la inicialización que no es capturado, O
  // 3. El proceso termina sin mostrar información de diagnóstico
  
  RETURN (missingEnvironmentVariables(event) 
          OR uncaughtInitializationError(event)
          OR silentProcessTermination(event))
         AND NOT errorMessageDisplayed(event)
END FUNCTION
```

### Property: Fix Checking

```pascal
// Propiedad: El bot debe iniciar correctamente o fallar con errores claros
FOR ALL event WHERE isBugCondition(event) DO
  result ← botInitialization'(event)
  ASSERT (successful_initialization(result) 
          OR clear_error_message(result))
    AND NOT silent_failure(result)
    AND docker_logs_show_diagnostics(result)
END FOR
```

**Definiciones:**
- **F**: Código original sin manejo de errores global
- **F'**: Código corregido con validación de variables de entorno y manejo de errores global
- **successful_initialization(result)**: El bot se conecta a Discord y muestra "Bot iniciado como [tag]"
- **clear_error_message(result)**: Se muestra un mensaje de error específico indicando qué salió mal
- **silent_failure(result)**: El proceso termina sin mostrar información de diagnóstico
- **docker_logs_show_diagnostics(result)**: `docker logs` muestra información útil para diagnosticar el problema

### Property: Preservation Checking

```pascal
// Propiedad: El comportamiento existente debe preservarse
FOR ALL event WHERE NOT isBugCondition(event) DO
  ASSERT F(event) = F'(event)
END FOR
```

Esto asegura que:
- El procesamiento de comandos sigue siendo igual
- Los event listeners siguen funcionando igual
- La lógica de inicialización del dashboard sigue siendo igual
- El registro de logs sigue siendo igual

## Concrete Examples

### Example 1: Missing DISCORD_TOKEN (Passed from Host to Container)

```javascript
// Cómo se ejecuta en tu PC:
// docker run -e DISCORD_CLIENT_ID=123456789 -e DISCORD_CLIENT_SECRET=secret -e PORT=3000 my-bot:latest
// (Nota: DISCORD_TOKEN NO se pasó)

// Dentro del contenedor, el bot recibe:
const event = {
  type: "botInitialization",
  environment: {
    // DISCORD_TOKEN está faltando (no se pasó desde tu PC)
    DISCORD_CLIENT_ID: "123456789",
    DISCORD_CLIENT_SECRET: "secret",
    PORT: "3000"
  }
};

// Comportamiento actual (F):
// El bot intenta hacer client.login(undefined)
// Falla silenciosamente sin mostrar error
// docker logs no muestra nada útil
// ❌ Proceso termina sin información

// Comportamiento esperado (F'):
// El bot valida que DISCORD_TOKEN existe
// Muestra: "❌ Error: Variable de entorno DISCORD_TOKEN no configurada"
// Termina con código de error 1
// ✅ docker logs muestra el error claro
```

### Example 2: Database Initialization Error (Inside Container)

```javascript
// Dentro del contenedor, durante la inicialización:
const event = {
  type: "botInitialization",
  environment: {
    DISCORD_TOKEN: "token",
    DISCORD_CLIENT_ID: "123456789",
    DISCORD_CLIENT_SECRET: "secret",
    PORT: "3000"
  },
  databasePath: "/usr/src/app/bot_data.sqlite" // Ruta dentro del contenedor
};

// Comportamiento actual (F):
// initDB() falla pero el error no es capturado
// El bot intenta continuar sin base de datos
// Falla silenciosamente cuando intenta usar la DB
// ❌ Proceso termina sin información

// Comportamiento esperado (F'):
// initDB() captura el error
// Muestra: "❌ Error en inicialización de BD: [error específico]"
// Termina con código de error 1
// ✅ docker logs muestra el error claro
```

### Example 3: Uncaught Promise Rejection (Inside Container)

```javascript
// Dentro del contenedor, cuando intenta conectarse a Discord:
const event = {
  type: "botInitialization",
  environment: {
    DISCORD_TOKEN: "token",
    DISCORD_CLIENT_ID: "123456789",
    DISCORD_CLIENT_SECRET: "secret",
    PORT: "3000"
  }
};

// Comportamiento actual (F):
// client.login() retorna una Promise que rechaza
// No hay .catch() para capturar el rechazo
// Unhandled Promise Rejection causa que el proceso termine
// ❌ Proceso termina sin información clara

// Comportamiento esperado (F'):
// client.login() tiene .catch() que captura errores
// Muestra: "❌ Error al conectar a Discord: [error específico]"
// Termina con código de error 1
// ✅ docker logs muestra el error claro
```

## Contraejemplo Concreto

```javascript
// Cómo se ejecuta en tu PC (sin pasar DISCORD_TOKEN o con token inválido):
// docker run -e DISCORD_CLIENT_ID=123456789 -e DISCORD_CLIENT_SECRET=secret -e PORT=3000 my-bot:latest
// (Nota: DISCORD_TOKEN NO se pasó o es inválido)

// Dentro del contenedor, el bot recibe:
const dockerEnvironment = {
  DISCORD_TOKEN: undefined, // Falta o es inválido
  DISCORD_CLIENT_ID: "123456789",
  DISCORD_CLIENT_SECRET: "secret",
  PORT: "3000"
};

// Comportamiento actual (F):
require('dotenv').config();
const client = new Client({ intents: [...] });
client.login(process.env.DISCORD_TOKEN); // undefined o inválido

// Error que se muestra:
// Error [TokenInvalid]: An invalid token was provided.
//     at Client.login (/usr/src/app/node_modules/discord.js/src/client/Client.js:217:52)
//     at Object.<anonymous> (/usr/src/app/index.js:636:8)
//
// ❌ El error es poco amigable y no indica claramente que DISCORD_TOKEN no está configurado

// Comportamiento esperado (F'):
require('dotenv').config();

// Validar variables de entorno ANTES de intentar conectar
const requiredEnvVars = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`❌ Error: Variables de entorno faltantes: ${missingVars.join(', ')}`);
  console.error(`\nAsegúrate de pasar estas variables al contenedor:`);
  console.error(`  docker run -e DISCORD_TOKEN=tu_token -e DISCORD_CLIENT_ID=tu_id -e DISCORD_CLIENT_SECRET=tu_secret ...`);
  console.error(`\nO configúralas en docker-compose.yml:`);
  console.error(`  environment:`);
  console.error(`    DISCORD_TOKEN: tu_token`);
  console.error(`    DISCORD_CLIENT_ID: tu_id`);
  console.error(`    DISCORD_CLIENT_SECRET: tu_secret`);
  process.exit(1);
}

const client = new Client({ intents: [...] });
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error(`❌ Error al conectar a Discord: ${err.message}`);
  console.error(`Verifica que tu DISCORD_TOKEN sea válido.`);
  process.exit(1);
});

// ✅ docker logs muestra un error claro y amigable
```
