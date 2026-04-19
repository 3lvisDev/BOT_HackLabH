#!/bin/bash
set -e

echo "[Entrypoint] Iniciando servidor PulseAudio en modo headless..."

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
echo "[Entrypoint] Esperando que PulseAudio esté listo..."
for i in $(seq 1 20); do
    if pactl info &>/dev/null 2>&1; then
        echo "[Entrypoint] ✅ PulseAudio listo."
        break
    fi
    sleep 0.5
done

# Verificar que PulseAudio arrancó
if ! pactl info &>/dev/null 2>&1; then
    echo "[Entrypoint] ❌ ERROR: PulseAudio no pudo arrancar. Abortando."
    exit 1
fi

# Arrancar display virtual Xvfb (necesario para Chromium con audio real)
echo "[Entrypoint] Iniciando display virtual Xvfb en :99..."
Xvfb :99 -screen 0 1280x720x24 -ac &
export DISPLAY=:99

# Esperar a que Xvfb esté listo
sleep 1
echo "[Entrypoint] ✅ Xvfb listo en DISPLAY=:99."

echo "[Entrypoint] Iniciando bot de Discord..."
exec npm start
