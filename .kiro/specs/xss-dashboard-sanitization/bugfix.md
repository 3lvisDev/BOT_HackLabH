# Especificación de Bugfix: Vulnerabilidad XSS en Dashboard

## Introducción

El dashboard web del bot de Discord contiene múltiples vulnerabilidades de Cross-Site Scripting (XSS) que permiten la ejecución de código JavaScript arbitrario en el navegador de los administradores. Estas vulnerabilidades se originan por el uso de `innerHTML` sin sanitización para insertar datos de usuarios controlados por atacantes (nombres de usuario, nombres de canales, descripciones de logros) directamente en el DOM.

Un atacante puede explotar estas vulnerabilidades cambiando su nombre de Discord a código JavaScript malicioso (ej: `<img src=x onerror="alert('XSS')">`), lo que resulta en la ejecución automática del código cuando un administrador visualiza el dashboard. Esto permite robo de sesiones, ejecución de acciones administrativas no autorizadas, y redirección a sitios maliciosos.

**Severidad:** CRÍTICA - Compromete la seguridad de cuentas administrativas y la integridad del sistema.

**Archivos Afectados:**
- `public/script.js` (líneas 203, 316, 330, 424, 466)
- `dashboard.js` (para implementar CSP headers)

## Análisis del Bug

### 1. Comportamiento Actual (Defecto)

1.1 CUANDO un usuario tiene un `displayName` que contiene código HTML/JavaScript malicioso (ej: `<img src=x onerror="alert('XSS')">`) ENTONCES el sistema ejecuta el código JavaScript en el navegador del administrador al renderizar la tabla de usuarios (línea 203)

1.2 CUANDO un usuario tiene un `username` que contiene código HTML/JavaScript malicioso ENTONCES el sistema ejecuta el código JavaScript en el navegador del administrador al renderizar la tabla de usuarios (línea 203)

1.3 CUANDO un usuario tiene un `avatarUrl` que contiene una URL maliciosa con protocolo `javascript:` ENTONCES el sistema permite la ejecución de código al cargar la imagen en la tabla de usuarios (línea 203)

1.4 CUANDO un usuario con `displayName` malicioso aparece en el dropdown de búsqueda ENTONCES el sistema ejecuta el código JavaScript al renderizar el dropdown (línea 316)

1.5 CUANDO un usuario con `displayName` o `avatarUrl` maliciosos es seleccionado como admin/mod ENTONCES el sistema ejecuta el código JavaScript al renderizar los chips de selección (línea 330)

1.6 CUANDO un canal tiene un `name` que contiene código HTML/JavaScript malicioso ENTONCES el sistema ejecuta el código JavaScript al renderizar el selector de canales de bienvenida (línea 424)

1.7 CUANDO un logro tiene un `name`, `description` o `icon` que contiene código HTML/JavaScript malicioso ENTONCES el sistema ejecuta el código JavaScript al renderizar la cuadrícula de logros (línea 466)

1.8 CUANDO cualquiera de los datos mencionados contiene caracteres HTML especiales (`<`, `>`, `&`, `"`, `'`) ENTONCES el sistema los interpreta como código HTML en lugar de texto plano

### 2. Comportamiento Esperado (Correcto)

2.1 CUANDO un usuario tiene un `displayName` que contiene código HTML/JavaScript malicioso ENTONCES el sistema DEBERÁ escapar los caracteres especiales y mostrar el contenido como texto plano sin ejecutar código

2.2 CUANDO un usuario tiene un `username` que contiene código HTML/JavaScript malicioso ENTONCES el sistema DEBERÁ escapar los caracteres especiales y mostrar el contenido como texto plano sin ejecutar código

2.3 CUANDO un usuario tiene un `avatarUrl` que contiene una URL maliciosa con protocolo `javascript:` o cualquier protocolo no-HTTP ENTONCES el sistema DEBERÁ rechazar la URL y mostrar un avatar por defecto

2.4 CUANDO un usuario con `displayName` malicioso aparece en el dropdown de búsqueda ENTONCES el sistema DEBERÁ sanitizar el contenido y mostrarlo como texto plano sin ejecutar código

2.5 CUANDO un usuario con `displayName` o `avatarUrl` maliciosos es seleccionado como admin/mod ENTONCES el sistema DEBERÁ sanitizar el contenido y mostrarlo como texto plano sin ejecutar código

2.6 CUANDO un canal tiene un `name` que contiene código HTML/JavaScript malicioso ENTONCES el sistema DEBERÁ escapar los caracteres especiales y mostrar el contenido como texto plano sin ejecutar código

2.7 CUANDO un logro tiene un `name`, `description` o `icon` que contiene código HTML/JavaScript malicioso ENTONCES el sistema DEBERÁ escapar los caracteres especiales y mostrar el contenido como texto plano sin ejecutar código

2.8 CUANDO se construyen elementos del DOM con datos de usuario ENTONCES el sistema DEBERÁ utilizar métodos seguros como `textContent`, `createElement()` y `setAttribute()` en lugar de `innerHTML`

2.9 CUANDO se sirve el dashboard ENTONCES el servidor DEBERÁ incluir headers de Content Security Policy (CSP) que restrinjan la ejecución de scripts inline y fuentes no autorizadas

### 3. Comportamiento Sin Cambios (Prevención de Regresiones)

3.1 CUANDO un usuario tiene un `displayName` o `username` que contiene caracteres Unicode válidos sin código malicioso ENTONCES el sistema DEBERÁ CONTINUAR mostrando correctamente estos caracteres (emojis, caracteres especiales de idiomas, etc.)

3.2 CUANDO un usuario tiene un `avatarUrl` válido con protocolo HTTPS ENTONCES el sistema DEBERÁ CONTINUAR mostrando la imagen del avatar correctamente

3.3 CUANDO se renderizan roles de usuario con colores personalizados ENTONCES el sistema DEBERÁ CONTINUAR aplicando los estilos de color correctamente

3.4 CUANDO se hace clic en el botón "Copiar ID" ENTONCES el sistema DEBERÁ CONTINUAR copiando el ID al portapapeles y mostrando el feedback visual

3.5 CUANDO se agregan o remueven roles de usuarios ENTONCES el sistema DEBERÁ CONTINUAR ejecutando las acciones correctamente y actualizando la UI

3.6 CUANDO se filtran usuarios por categoría (admins, mods, normal) ENTONCES el sistema DEBERÁ CONTINUAR aplicando los filtros correctamente

3.7 CUANDO se buscan usuarios en los campos de búsqueda ENTONCES el sistema DEBERÁ CONTINUAR mostrando resultados relevantes basados en username y displayName

3.8 CUANDO se seleccionan usuarios como admins o mods ENTONCES el sistema DEBERÁ CONTINUAR agregándolos a las listas correspondientes con límite de 3 usuarios

3.9 CUANDO se guardan configuraciones de mensajes de bienvenida/despedida ENTONCES el sistema DEBERÁ CONTINUAR guardando y cargando la configuración correctamente

3.10 CUANDO se visualizan logros desbloqueados vs bloqueados ENTONCES el sistema DEBERÁ CONTINUAR aplicando los estilos visuales diferenciados correctamente

3.11 CUANDO se cambia entre diferentes pantallas del dashboard ENTONCES el sistema DEBERÁ CONTINUAR navegando correctamente y cargando los datos correspondientes

3.12 CUANDO se usa el dashboard en dispositivos móviles ENTONCES el sistema DEBERÁ CONTINUAR funcionando con el sidebar responsive y los controles táctiles
