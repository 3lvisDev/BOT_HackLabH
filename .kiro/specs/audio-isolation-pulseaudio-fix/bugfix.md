# Bugfix Requirements Document

## Introduction

El bot de música de Discord con YouTube Premium se conecta correctamente al canal de voz y ejecuta el comando `!play`, pero no se escucha ningún audio. El bot queda "dormido" en el canal sin reproducir nada.

**Causa Raíz:** El código actual intenta capturar audio usando `default.monitor` de PulseAudio, lo que captura TODO el audio del sistema (incluyendo micrófono y audífonos del usuario). Esto tiene dos problemas críticos:
1. El audio del navegador Chromium no está siendo capturado correctamente desde el sink por defecto
2. Si funcionara, capturaría también el audio de los audífonos del usuario, creando un loop de retroalimentación

**Solución Requerida:** El audio del navegador Chromium debe ir DIRECTAMENTE a Discord sin pasar por los audífonos del usuario, funcionando de forma aislada en segundo plano sin afectar el audio de la PC original. Esto requiere crear un sink virtual exclusivo, redirigir el navegador a ese sink usando PULSE_SINK, y capturar desde el monitor de ese sink específico.

Este bug afecta la funcionalidad principal del bot de música, impidiendo completamente la reproducción de contenido de YouTube Premium.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN el usuario ejecuta `!play <canción>` THEN el bot se conecta al canal de voz pero no reproduce audio y queda "dormido" en el canal

1.2 WHEN el sistema intenta iniciar el puente de audio FFmpeg THEN el proceso se detiene sin completar la inicialización y no se muestra el mensaje "Audio bridge iniciado y reproductor conectado"

1.3 WHEN el navegador Chromium se lanza con la variable de entorno PULSE_SINK THEN el navegador no redirige su audio al sink virtual de PulseAudio especificado

1.4 WHEN FFmpeg intenta capturar desde el monitor del sink virtual THEN no recibe stream de audio porque el navegador no está enviando audio a ese sink

### Expected Behavior (Correct)

2.1 WHEN el usuario ejecuta `!play <canción>` THEN el bot SHALL conectarse al canal de voz y reproducir el audio de YouTube correctamente

2.2 WHEN el sistema inicia el puente de audio FFmpeg THEN el proceso SHALL completarse exitosamente mostrando "Audio bridge iniciado y reproductor conectado" y el audio SHALL fluir a Discord

2.3 WHEN el navegador Chromium se lanza THEN el navegador SHALL redirigir todo su audio al sink virtual de PulseAudio aislado sin reproducirlo en los dispositivos de audio del usuario

2.4 WHEN FFmpeg captura desde el monitor del sink virtual THEN SHALL recibir el stream de audio del navegador y enviarlo correctamente al reproductor de Discord

### Unchanged Behavior (Regression Prevention)

3.1 WHEN el bot se conecta al canal de voz THEN el sistema SHALL CONTINUE TO crear el sink virtual de PulseAudio con el nombre `discord_music_${guildId}`

3.2 WHEN el navegador Chromium navega a YouTube THEN el sistema SHALL CONTINUE TO cargar el video correctamente y mostrar el título en los logs

3.3 WHEN el usuario ejecuta `!stop` THEN el sistema SHALL CONTINUE TO detener la reproducción y limpiar los recursos correctamente

3.4 WHEN existen cookies de YouTube Premium configuradas THEN el sistema SHALL CONTINUE TO aplicarlas al contexto del navegador

3.5 WHEN el bot reproduce música THEN el audio NO SHALL reproducirse en los audífonos/parlantes del usuario (debe permanecer aislado)

3.6 WHEN el bot captura audio THEN NO SHALL capturar el micrófono del usuario (solo el audio del navegador)
