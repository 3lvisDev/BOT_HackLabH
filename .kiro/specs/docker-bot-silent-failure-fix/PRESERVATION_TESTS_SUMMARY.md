# Preservation Tests Summary

## Objetivo

Escribir tests de preservación que verifiquen que el comportamiento normal del bot no cambia después del fix para el bug de "Docker Bot Silent Failure".

## Requisitos Validados

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

Estos tests verifican que el comportamiento existente se mantiene igual:
- 3.1: El bot continúa iniciando el dashboard en el puerto configurado
- 3.2: El procesamiento de comandos funciona igual
- 3.3: Los event listeners funcionan igual
- 3.4: La lógica de configuración funciona igual
- 3.5: El registro de logs funciona igual
- 3.6: La asignación de roles funciona igual

## Enfoque: Property-Based Testing

Los tests usan **fast-check** para generar muchos casos de prueba automáticamente y verificar que las propiedades se mantienen en todos los casos.

### Ventajas del Enfoque

1. **Cobertura Exhaustiva**: Genera 50-100 casos de prueba por propiedad
2. **Detección de Edge Cases**: Encuentra casos límite automáticamente
3. **Reproducibilidad**: Cada fallo incluye el caso que lo causó
4. **Mantenibilidad**: Las propiedades son más claras que casos específicos

## Propiedades Implementadas

### Property 1: Bot users are always ignored (Requisito 3.1)

**Descripción**: Para CUALQUIER miembro que sea un bot, el código DEBE retornar temprano sin procesar el evento.

**Generadores**:
- `isBot`: Siempre `true` para bots
- `userId`: ID de usuario aleatorio (10-20 caracteres hex)
- `tag`: Tag de usuario aleatorio (5-20 caracteres)

**Casos de Prueba**: 100 ejecuciones

**Validación**:
- Los bots siempre retornan temprano
- Los usuarios no-bot siempre se procesan

---

### Property 2: replaceVars substitution works correctly (Requisito 3.3)

**Descripción**: Para CUALQUIER mensaje con variables y miembro, replaceVars DEBE reemplazar {user}, {server}, y {count} correctamente.

**Sub-propiedades**:

#### 2a: {user} replacement
- Genera: prefijo, sufijo, userId
- Verifica: {user} se reemplaza con `<@userId>`

#### 2b: {server} replacement
- Genera: prefijo, sufijo, nombre de servidor
- Verifica: {server} se reemplaza con el nombre del servidor

#### 2c: {count} replacement
- Genera: prefijo, sufijo, cantidad de miembros
- Verifica: {count} se reemplaza con el número de miembros

#### 2d: All variables replacement
- Genera: userId, nombre de servidor, cantidad de miembros
- Verifica: Todas las variables se reemplazan correctamente

#### 2e: Empty/null messages
- Genera: null, undefined, string vacío
- Verifica: Retorna string vacío

**Casos de Prueba**: 50 ejecuciones por sub-propiedad

---

### Property 3: Silent behavior without configuration (Requisito 3.4)

**Descripción**: Para CUALQUIER configuración incompleta, el bot DEBE silenciosamente no enviar mensajes.

**Sub-propiedades**:

#### 3a: No message when disabled
- Genera: welcome_enabled=0, welcome_channel, welcome_message
- Verifica: No se envía mensaje

#### 3b: No message when channel is null
- Genera: welcome_enabled=1, welcome_channel=null, welcome_message
- Verifica: No se envía mensaje

#### 3c: No crash with null settings
- Genera: settings=null
- Verifica: No hay crash, no se envía mensaje

**Casos de Prueba**: 50 ejecuciones por sub-propiedad

---

### Property 4: Error handling preserves bot operation (Requisitos 3.5, 3.6)

**Descripción**: Para CUALQUIER error durante el procesamiento, el bot DEBE capturarlo y registrarlo sin terminar el proceso.

**Sub-propiedades**:

#### 4a: Errors caught and logged
- Genera: mensaje de error aleatorio
- Verifica: Error capturado, registrado, proceso continúa

#### 4b: No crash when channel missing
- Genera: channelId, messageText
- Verifica: No hay crash cuando el canal no existe

**Casos de Prueba**: 50 ejecuciones por sub-propiedad

---

### Property 5: Base role assignment works correctly (Requisito 3.2)

**Descripción**: Para CUALQUIER miembro con configuración válida, el rol base DEBE ser asignado correctamente.

**Sub-propiedades**:

#### 5a: Assign base role when config exists
- Genera: baseRoleId, isConfigured=1
- Verifica: Intenta asignar el rol si existe

#### 5b: No crash with null config
- Genera: config=null
- Verifica: No hay crash

**Casos de Prueba**: 50 ejecuciones por sub-propiedad

---

### Property 6: Command processing works correctly (Requisito 3.1)

**Descripción**: Para CUALQUIER comando válido del dueño del servidor, el comando DEBE ser reconocido y procesado.

**Sub-propiedades**:

#### 6a: Commands recognized
- Genera: nombre de comando aleatorio
- Verifica: Comando que comienza con `!` se reconoce

#### 6b: Owner verification
- Genera: authorId, ownerId
- Verifica: Verificación de permisos funciona correctamente

**Casos de Prueba**: 50-100 ejecuciones por sub-propiedad

---

### Property 7: Event listener processing works correctly (Requisito 3.1)

**Descripción**: Para CUALQUIER evento de miembro, el bot DEBE poder acceder a las propiedades del miembro sin errores.

**Generadores**:
- `userId`: ID de usuario aleatorio
- `guildId`: ID de servidor aleatorio
- `tag`: Tag de usuario aleatorio

**Validación**:
- Se accede a propiedades sin errores
- Los valores son correctos

**Casos de Prueba**: 100 ejecuciones

---

### Property 8: Dashboard functionality preserved (Requisito 3.6)

**Descripción**: Para CUALQUIER solicitud al dashboard, el bot DEBE poder procesar la solicitud sin cambios en la lógica.

**Generadores**:
- `guildId`: ID de servidor aleatorio
- `userId`: ID de usuario aleatorio
- `action`: Una de: get_config, set_config, get_roles, get_members

**Validación**:
- Solicitud se procesa sin errores
- No hay crashes

**Casos de Prueba**: 50 ejecuciones

---

### Property 9: Logging functionality preserved (Requisito 3.5)

**Descripción**: Para CUALQUIER evento, el bot DEBE poder registrar información en consola sin errores.

**Generadores**:
- `eventType`: Una de: guildMemberAdd, guildMemberRemove, messageCreate, guildMemberUpdate
- `message`: Mensaje aleatorio (0-500 caracteres)

**Validación**:
- Log se crea sin errores
- No hay crashes

**Casos de Prueba**: 50 ejecuciones

---

### Property 10: Role assignment logic preserved (Requisito 3.2)

**Descripción**: Para CUALQUIER miembro, el bot DEBE poder calcular los roles correctamente sin cambios en la lógica.

**Generadores**:
- `isAdmin`: Booleano aleatorio
- `isMod`: Booleano aleatorio
- `isOwner`: Booleano aleatorio
- `currentRoleCount`: Cantidad de roles (0-10)

**Validación**:
- Lógica de asignación de roles se aplica correctamente
- Usuarios normales obtienen rol base
- Admins/Mods/Owners mantienen sus roles

**Casos de Prueba**: 100 ejecuciones

---

## Resumen de Cobertura

| Propiedad | Requisitos | Casos de Prueba | Estado |
|-----------|-----------|-----------------|--------|
| 1. Bot users ignored | 3.1 | 100 | ✓ Implementado |
| 2. replaceVars | 3.3 | 250 | ✓ Implementado |
| 3. Silent behavior | 3.4 | 150 | ✓ Implementado |
| 4. Error handling | 3.5, 3.6 | 100 | ✓ Implementado |
| 5. Base role assignment | 3.2 | 100 | ✓ Implementado |
| 6. Command processing | 3.1 | 150 | ✓ Implementado |
| 7. Event listener processing | 3.1 | 100 | ✓ Implementado |
| 8. Dashboard functionality | 3.6 | 50 | ✓ Implementado |
| 9. Logging functionality | 3.5 | 50 | ✓ Implementado |
| 10. Role assignment logic | 3.2 | 100 | ✓ Implementado |
| **TOTAL** | **3.1-3.6** | **1050** | **✓ Completo** |

---

## Cómo Ejecutar los Tests

### Ejecutar todos los tests de preservación:
```bash
npm run test:preservation
```

### Ejecutar con Mocha (si está configurado):
```bash
npx mocha tests/preservation.test.js
```

### Ejecutar directamente con Node:
```bash
node tests/preservation.test.js
```

---

## Comportamiento Esperado

### En Código Sin Fix (Actual)

Los tests DEBEN PASAR porque:
- El comportamiento normal del bot no ha cambiado
- Solo se agregará validación de variables de entorno y manejo de errores
- La lógica existente permanece igual

### En Código Con Fix (Después)

Los tests DEBEN PASAR porque:
- El fix solo agrega validación y manejo de errores
- No cambia la lógica existente
- El comportamiento normal se preserva

---

## Notas Importantes

1. **Property-Based Testing**: Estos tests generan automáticamente muchos casos de prueba, lo que proporciona mayor confianza en la preservación del comportamiento.

2. **Reproducibilidad**: Si un test falla, fast-check proporciona el caso exacto que causó el fallo, facilitando la depuración.

3. **Mantenibilidad**: Las propiedades son más claras y mantenibles que casos específicos, ya que describen el comportamiento esperado en términos generales.

4. **Cobertura**: Con 1050 casos de prueba generados automáticamente, se cubre una amplia gama de escenarios.

---

## Archivo

- **Ubicación**: `tests/preservation.test.js`
- **Líneas**: ~800+
- **Dependencias**: `assert`, `fast-check`
- **Requisitos Validados**: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
