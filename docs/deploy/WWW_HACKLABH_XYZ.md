# Deploy de Web Oficial (www.hacklabh.xyz)

Esta web es **separada del panel** (`panel.hacklabh.xyz`).

## Estructura
- `website/index.html`
- `website/style.css`
- `website/script.js`
- `website/vercel.json`

## Vercel (recomendado)
1. Crear proyecto nuevo en Vercel conectado a `3lvisDev/BOT_HackLabH`.
2. En **Root Directory** seleccionar `website`.
3. Framework preset: `Other`.
4. Build command: vacío.
5. Output directory: vacío (estático root).
6. Agregar dominio: `www.hacklabh.xyz`.
7. Verificar DNS CNAME de `www` apuntando al target de Vercel.

## Importante
- No mezclar esta web con rutas del panel.
- `panel.hacklabh.xyz` sigue en su despliegue actual.