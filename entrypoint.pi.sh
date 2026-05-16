#!/bin/bash
set -e

echo "[Entrypoint-Pi] Iniciando servidor PulseAudio en modo headless..."

# Limpiar archivos temporales de sesiones anteriores
rm -rf /tmp/pulse-*

# Arrancar PulseAudio como daemon de usuario
pulseaudio \
    --start \
    --exit-idle-time=-1 \
    --daemonize=true \
    --log-target=stderr \
    --disallow-exit \
    --disallow-module-loading=false \
    -D

# Esperar hasta que PulseAudio acepte conexiones (máx. 10 seg)
echo "[Entrypoint-Pi] Esperando que PulseAudio esté listo..."
for i in $(seq 1 20); do
    if pactl info &>/dev/null 2>&1; then
        echo "[Entrypoint-Pi] ✅ PulseAudio listo."
        break
    fi
    sleep 0.5
done

# Verificar que PulseAudio arrancó
if ! pactl info &>/dev/null 2>&1; then
    echo "[Entrypoint-Pi] ⚠️ PulseAudio no arrancó, continuando sin él..."
fi

echo "[Entrypoint-Pi] Iniciando bot de Discord..."
exec npm start
