FROM node:18-slim

# Crear el directorio de la aplicación
WORKDIR /usr/src/app

# Instalar dependencias de sistema para Playwright, audio y PulseAudio
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    make \
    g++ \
    libasound2 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    alsa-utils \
    pulseaudio \
    pulseaudio-utils \
    dbus \
    xvfb \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copiar los archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Instalar los navegadores de Playwright
RUN npx playwright install chromium

# Copiar el resto del código
COPY . .

# Copiar y dar permisos de ejecución al script de inicio
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Exponer el puerto
EXPOSE 3000

# Usar el entrypoint para arrancar PulseAudio antes del bot
ENTRYPOINT ["/entrypoint.sh"]
