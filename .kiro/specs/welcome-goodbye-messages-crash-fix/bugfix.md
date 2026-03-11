# Especificación de Bugfix: Mensajes de Bienvenida y Despedida

## Introducción

El bot de Discord crashea cuando un usuario se une o sale del servidor debido a que los eventos `guildMemberAdd` y `guildMemberRemove` intentan usar una variable `sqliteDb` que nunca fue definida. Esto impide que los mensajes de bienvenida y despedida configurados en el panel web se envíen correctamente.

El código actual usa callbacks con una variable inexistente (`sqliteDb`), mientras que el módulo `db.js` exporta correctamente la variable `db` y proporciona funciones async/await como `getSettings()`. Existe una inconsistencia arquitectónica donde estos eventos usan callbacks mientras el resto del código usa async/await.

## Análisis del Bug

### Comportamiento Actual (Defecto)

1.1 CUANDO un usuario se une al servidor ENTONCES el evento `guildMemberAdd` intenta ejecutar `sqliteDb.get()` pero `sqliteDb` es undefined, causando el error "Cannot read property 'get' of undefined"

1.2 CUANDO un usuario sale del servidor ENTONCES el evento `guildMemberRemove` intenta ejecutar `sqliteDb.get()` pero `sqliteDb` es undefined, causando el error "Cannot read property 'get' of undefined"

1.3 CUANDO ocurre el error de variable undefined ENTONCES el mensaje de bienvenida nunca se envía al canal configurado

1.4 CUANDO ocurre el error de variable undefined ENTONCES el mensaje de despedida nunca se envía al canal configurado

1.5 CUANDO los eventos usan callbacks `sqliteDb.get(query, params, (err, row) => {})` ENTONCES existe inconsistencia arquitectónica con el resto del código que usa async/await

### Comportamiento Esperado (Correcto)

2.1 CUANDO un usuario se une al servidor ENTONCES el sistema DEBERÁ consultar la base de datos usando `await db.getSettings(guild.id)` con async/await

2.2 CUANDO un usuario sale del servidor ENTONCES el sistema DEBERÁ consultar la base de datos usando `await db.getSettings(guild.id)` con async/await

2.3 CUANDO los mensajes de bienvenida están habilitados en la configuración ENTONCES el sistema DEBERÁ enviar el mensaje personalizado al canal configurado sin errores

2.4 CUANDO los mensajes de despedida están habilitados en la configuración ENTONCES el sistema DEBERÁ enviar el mensaje personalizado al canal configurado sin errores

2.5 CUANDO se consulta la configuración de welcome_settings ENTONCES el sistema DEBERÁ usar la función `db.getSettings()` que ya existe en el módulo db.js

2.6 CUANDO se procesan los eventos de miembros ENTONCES el sistema DEBERÁ usar async/await de forma consistente con el resto del código

### Comportamiento Sin Cambios (Prevención de Regresión)

3.1 CUANDO un usuario bot se une o sale del servidor ENTONCES el sistema DEBERÁ CONTINUAR ignorando el evento (return early si `member.user.bot`)

3.2 CUANDO se asigna el rol base a un nuevo miembro ENTONCES el sistema DEBERÁ CONTINUAR ejecutando `applySmartRoles(member)` después de 3 segundos

3.3 CUANDO se reemplazan variables en los mensajes con `replaceVars()` ENTONCES el sistema DEBERÁ CONTINUAR sustituyendo `{user}`, `{server}` y `{count}` correctamente

3.4 CUANDO no existe configuración de welcome_settings para el servidor ENTONCES el sistema DEBERÁ CONTINUAR sin enviar mensajes (comportamiento silencioso)

3.5 CUANDO el canal configurado no existe o no es accesible ENTONCES el sistema DEBERÁ CONTINUAR sin crashear y registrar el error en consola

3.6 CUANDO ocurre un error en el evento `guildMemberAdd` ENTONCES el sistema DEBERÁ CONTINUAR capturándolo en el bloque try-catch y registrándolo como "[Event:Add] Error crítico"

3.7 CUANDO ocurre un error en el evento `guildMemberRemove` ENTONCES el sistema DEBERÁ CONTINUAR capturándolo en el bloque try-catch y registrándolo como "[Event:Remove] Error"

## Condición del Bug (Bug Condition)

### Función de Condición del Bug

```pascal
FUNCTION isBugCondition(event)
  INPUT: event of type GuildMemberEvent
  OUTPUT: boolean
  
  // El bug ocurre cuando se dispara cualquier evento de miembro
  // (join o leave) y el código intenta usar sqliteDb
  RETURN (event.type = "guildMemberAdd" OR event.type = "guildMemberRemove")
         AND codeUses("sqliteDb")
         AND NOT isDefined("sqliteDb")
END FUNCTION
```

### Propiedad: Fix Checking

```pascal
// Propiedad: Los eventos de miembros deben funcionar sin errores
FOR ALL event WHERE isBugCondition(event) DO
  result ← handleMemberEvent'(event)
  ASSERT no_crash(result) 
    AND database_queried_correctly(result)
    AND uses_async_await(result)
    AND message_sent_if_enabled(result)
END FOR
```

**Definiciones:**
- **F**: Código original que usa `sqliteDb.get()` con callbacks
- **F'**: Código corregido que usa `await db.getSettings()` con async/await
- **no_crash(result)**: No se produce el error "Cannot read property 'get' of undefined"
- **database_queried_correctly(result)**: Se usa `db.getSettings()` en lugar de `sqliteDb.get()`
- **uses_async_await(result)**: Se usa async/await en lugar de callbacks
- **message_sent_if_enabled(result)**: Si la configuración está habilitada, el mensaje se envía

### Propiedad: Preservation Checking

```pascal
// Propiedad: El comportamiento existente debe preservarse
FOR ALL event WHERE NOT isBugCondition(event) DO
  ASSERT F(event) = F'(event)
END FOR
```

Esto asegura que:
- Los bots siguen siendo ignorados
- `applySmartRoles()` sigue ejecutándose después de asignar el rol base
- `replaceVars()` sigue funcionando igual
- Los errores siguen siendo capturados y registrados
- El comportamiento silencioso cuando no hay configuración se mantiene

## Contraejemplo Concreto

```javascript
// Entrada que demuestra el bug:
const event = {
  type: "guildMemberAdd",
  member: {
    user: { bot: false, tag: "TestUser#1234" },
    guild: { id: "123456789" }
  }
};

// Comportamiento actual (F):
sqliteDb.get(`SELECT * FROM welcome_settings WHERE guild_id = ?`, [member.guild.id], async (err, welcome) => {
  // ❌ Error: Cannot read property 'get' of undefined
  // El mensaje nunca se envía
});

// Comportamiento esperado (F'):
const welcome = await db.getSettings(member.guild.id);
if (welcome && welcome.welcome_enabled && welcome.welcome_channel) {
  const channel = member.guild.channels.cache.get(welcome.welcome_channel);
  if (channel) {
    await channel.send(replaceVars(welcome.welcome_message, member));
    // ✅ Mensaje enviado correctamente sin errores
  }
}
```
