# Configuración de Bot de Discord para Comunidad de Programación

Este proyecto contiene un bot desarrollado en Node.js que configura un servidor de Discord para una comunidad de programación con un solo comando.

## Características

- Revoca automáticamente los permisos de administrador del rol `@everyone` y ajusta permisos básicos.
- Crea el rol `Admin` y asigna este rol **únicamente** a los 3 usuarios que especifiques en las variables de entorno, otorgándoles permiso total.
- Crea el rol `Desarrollador` para miembros generales.
- Al unirse un nuevo miembro al servidor, se le asigna el rol de `Desarrollador` automáticamente.
- Crea una jerarquía de canales enfocada a desarrolladores (`#general`, `#ayuda-codigo`, `#proyectos-showcase` y una sala de voz).

## Requisitos Previos

Antes de ejecutar el bot, necesitas:
1. Tener [Node.js](https://nodejs.org/) instalado en tu sistema.
2. Contar con el Token de tu bot de Discord (genéralo en el [Portal de Desarrolladores de Discord](https://discord.com/developers/applications)).
3. Asegurarte de que el bot tenga el **Permiso de Administrador** (`Administrator`) al ser invitado al servidor para que pueda gestionar los roles y canales.
4. Habilitar los "Privileged Gateway Intents" (`Server Members Intent` y `Message Content Intent`) en la página del bot en el portal de desarrolladores.

## Instalación y Configuración

1. Abre esta carpeta en tu terminal.
2. Renombra el archivo `.env.example` a `.env` (si aún no lo has hecho) y completa la información fundamental:
   ```
   DISCORD_TOKEN=tu_token_aqui
   PORT=3000
   WEB_ADMIN_PASSWORD=hacklab_secreto
   ```
   *Nota: ¡Ya no necesitas buscar IDs interminables de antemano! El bot buscará automáticamente el servidor.*
3. Instala las dependencias necesarias:
   ```bash
   npm install
   ```
4. Inicia el bot con:
   ```bash
   npm start
   ```

## Ejecución con Docker (Recomendado)

Si prefieres no instalar Node.js en tu máquina, ¡puedes usar Docker! 🐋

1. Asegúrate de tener **Docker** y **Docker Desktop** instalados.
2. Abre la terminal en esta carpeta (`C:\BOT_HackLabH`).
3. Construye la imagen del bot:
   ```bash
   docker build -t discord-bot-hacklab .
   ```
4. Ejecuta el contenedor (asegúrate de que el archivo `.env` esté listo con tu token):
   ```bash
   docker run -d -p 3000:3000 --env-file .env --name mi-bot hacklab discord-bot-hacklab
   ```
   *(Esto iniciará el bot en segundo plano y conectará el panel web al puerto 3000 de tu PC).*

## Uso del Panel Web

¡El bot ahora incluye un moderno Panel de Administración Web!

1. Invita el bot a tu servidor asegurándote de darle el permiso de Administrador.
2. Tu terminal te mostrará un enlace (ej. `http://localhost:3000`). Bre en tu navegador.
3. Inicia sesión con la contraseña que pusiste en `WEB_ADMIN_PASSWORD` (por defecto `hacklab_secreto`).
4. Desde el hermoso dashboard con diseño "Glassmorphism" podrás ver las estadísticas en vivo de tu bot.
5. Haz clic en **"Iniciar Configuración Automática"** y verás en tiempo real en la terminal web cómo se crean los roles de Administrador, Desarrollador, y todos los canales del servidor de forma instantánea.

*(Si prefieres no usar la web, aún puedes escribir `!setup_community` dentro de cualquier canal del servidor)*.
