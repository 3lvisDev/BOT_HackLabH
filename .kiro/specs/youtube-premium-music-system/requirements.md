# Requirements Document

## Introduction

Este documento define los requerimientos para un sistema de música mejorado en el bot de Discord HackLab. El sistema permitirá a cualquier usuario reproducir música de YouTube Premium mediante comandos de Discord (sin restricciones de permisos), utilizando un navegador virtual (Playwright) con control exclusivo de sesión única y validación estricta de contenido musical. El objetivo es proporcionar una experiencia de audio de alta calidad sin anuncios para la comunidad de programación. El dashboard web se utiliza exclusivamente para que administradores configuren credenciales de YouTube Premium y monitoreen el comportamiento del sistema mediante logs en tiempo real y detección de errores.

## Glossary

- **Music_System**: El sistema completo de reproducción de música que incluye el navegador virtual, el reproductor de audio y la gestión de sesiones
- **Virtual_Browser**: Instancia de navegador Chromium controlada por Playwright para acceder a YouTube
- **Audio_Bridge**: Componente que captura el audio del navegador virtual usando ffmpeg y PulseAudio para transmitirlo a Discord
- **Music_Session**: Estado activo de reproducción que incluye el canal de voz ocupado, el navegador virtual y la conexión de audio
- **Dashboard**: Panel web administrativo del bot donde se configuran credenciales de YouTube Premium y se monitorea el estado del sistema
- **System_Logs**: Registro de eventos, errores y comportamiento del Music_System en tiempo real
- **Premium_Cookies**: Cookies de sesión de YouTube Premium del usuario para autenticación sin anuncios
- **Music_Query**: Búsqueda o URL proporcionada por cualquier usuario mediante comandos de Discord para reproducir música
- **Discord_Command**: Comando del bot de Discord usado para controlar la reproducción (ejemplo: !play)
- **Voice_Channel**: Canal de voz de Discord donde se reproduce el audio
- **Channel_Lock**: Mecanismo que previene llamadas simultáneas desde diferentes canales de voz

## Requirements

### Requirement 1: Single Instance Music Playback

**User Story:** Como administrador del servidor, quiero que solo exista una sesión de música activa a la vez, para evitar conflictos de recursos y garantizar estabilidad del sistema.

#### Acceptance Criteria

1. THE Music_System SHALL allow only one active Music_Session at any given time
2. WHEN a Music_Session is active, THE Music_System SHALL reject new playback requests with an error message indicating the system is busy
3. WHEN a Music_Session ends, THE Music_System SHALL release all resources and allow new playback requests
4. THE Music_System SHALL maintain a boolean state flag indicating whether a session is active
5. WHEN the Virtual_Browser crashes or disconnects, THE Music_System SHALL automatically mark the session as inactive and clean up resources

### Requirement 2: Exclusive Voice Channel Lock

**User Story:** Como usuario del bot, quiero que la música solo pueda ser controlada desde el canal de voz donde se inició, para evitar interferencias de otros canales.

#### Acceptance Criteria

1. WHEN a Music_Session starts in a Voice_Channel, THE Music_System SHALL store the channel identifier as the locked channel
2. WHILE a Music_Session is active, THE Music_System SHALL reject playback commands from any Voice_Channel different from the locked channel
3. WHEN any user attempts to play music from a different Voice_Channel, THE Music_System SHALL return an error message indicating which channel currently has control
4. WHEN a Music_Session ends, THE Music_System SHALL clear the Channel_Lock
5. THE Music_System SHALL persist the last used Voice_Channel identifier in the database for reconnection purposes

### Requirement 3: YouTube Premium Integration

**User Story:** Como administrador, quiero asociar mi cuenta de YouTube Premium al bot, para reproducir música sin anuncios y con mejor calidad de audio.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a secure text area for administrators to input Premium_Cookies in JSON format
2. WHEN Premium_Cookies are submitted, THE Music_System SHALL validate the JSON format before storing
3. IF Premium_Cookies are invalid JSON, THEN THE Music_System SHALL return a descriptive error message
4. THE Music_System SHALL store Premium_Cookies encrypted in the database associated with the guild identifier
5. WHEN the Virtual_Browser launches, THE Music_System SHALL load the stored Premium_Cookies into the browser context
6. WHERE Premium_Cookies are configured, THE Virtual_Browser SHALL authenticate with YouTube Premium automatically

### Requirement 4: Virtual Browser Audio Streaming

**User Story:** Como usuario, quiero que el bot reproduzca audio de YouTube usando un navegador virtual, para acceder a contenido que requiere interacción de navegador.

#### Acceptance Criteria

1. WHEN a playback request is received, THE Music_System SHALL launch a headless Chromium instance using Playwright
2. THE Virtual_Browser SHALL be configured with autoplay policies disabled and audio capture enabled
3. WHEN navigating to YouTube, THE Virtual_Browser SHALL wait for the video element to load before attempting audio capture
4. THE Audio_Bridge SHALL use ffmpeg to capture audio from PulseAudio default sink
5. THE Audio_Bridge SHALL convert captured audio to 48kHz stereo PCM format for Discord compatibility
6. THE Music_System SHALL stream the converted audio to the Voice_Channel using Discord.js voice connection
7. WHEN playback stops, THE Music_System SHALL terminate the ffmpeg process and close the Virtual_Browser

### Requirement 5: Music Content Validation

**User Story:** Como usuario, quiero que el bot valide y procese mis solicitudes de música, para reproducir contenido de YouTube de forma segura.

#### Acceptance Criteria

1. WHEN a Music_Query is received via Discord_Command, THE Music_System SHALL validate that it is either a YouTube URL or a text search query
2. THE Music_System SHALL reject queries containing "javascript:" or "data:" protocols
3. THE Music_System SHALL limit Music_Query length to 500 characters maximum
4. IF a Music_Query is not a YouTube URL, THEN THE Music_System SHALL construct a YouTube search URL with the query
5. WHEN searching YouTube, THE Virtual_Browser SHALL wait for search results and automatically click the first video result
6. THE Music_System SHALL extract and store the video title as the current track name
7. IF no valid music content is found, THEN THE Music_System SHALL return an error and terminate the session

### Requirement 5.1: Discord Command Interface

**User Story:** Como usuario del servidor, quiero usar comandos de Discord para reproducir música, para controlar la reproducción directamente desde el chat sin necesidad de permisos especiales.

#### Acceptance Criteria

1. THE Music_System SHALL provide a Discord_Command "!play" that accepts a Music_Query as parameter
2. WHEN any user executes "!play <Music_Query>", THE Music_System SHALL validate the user is in a Voice_Channel
3. IF the user is not in a Voice_Channel, THEN THE Music_System SHALL respond with an error message
4. THE Music_System SHALL accept both search terms and direct YouTube URLs as Music_Query (example: "!play Lofi Girl" or "!play https://youtube.com/watch?v=...")
5. THE Music_System SHALL provide a Discord_Command "!stop" that terminates the current Music_Session
6. WHEN any user executes "!stop", THE Music_System SHALL verify the user is in the same Voice_Channel as the active session
7. IF the user is in a different Voice_Channel, THEN THE Music_System SHALL reject the command with an error message
8. THE Music_System SHALL respond to commands with confirmation messages or error descriptions in the Discord channel

### Requirement 6: Dashboard Configuration and Monitoring

**User Story:** Como administrador, quiero configurar las credenciales de YouTube Premium y monitorear el comportamiento del sistema en tiempo real desde el dashboard web, para gestionar la autenticación y detectar problemas mediante una consola integrada sin necesidad de acceder al servidor.

#### Acceptance Criteria

1. THE Dashboard SHALL display the current Music_Session status including active state, current track, and locked Voice_Channel for monitoring purposes only
2. THE Dashboard SHALL provide a secure configuration section for administrators to input and update Premium_Cookies in JSON format
3. THE Dashboard SHALL display an integrated console/terminal showing System_Logs in real-time with automatic scrolling
4. THE Dashboard SHALL provide filtering options for System_Logs by severity level (info, warning, error, debug)
5. THE Dashboard SHALL display error detection panel highlighting critical failures with timestamps and stack traces
6. THE Dashboard SHALL provide search functionality within System_Logs to find specific events or error patterns
7. WHEN the Music_Session status changes, THE Dashboard SHALL update the display in real-time using WebSocket connections
8. THE Dashboard SHALL display visual indicators for Virtual_Browser status (active, inactive, error) and health metrics
9. THE Dashboard SHALL display system health indicators including memory usage, active connections, and uptime
10. THE Dashboard SHALL NOT provide play or stop controls (all playback control is exclusively via Discord_Command from voice channels)

### Requirement 7: Audio Bridge Configuration

**User Story:** Como desarrollador del sistema, quiero configurar el puente de audio entre el navegador virtual y Discord, para garantizar transmisión de audio estable y de calidad.

#### Acceptance Criteria

1. THE Audio_Bridge SHALL use ffmpeg with PulseAudio input source
2. THE Audio_Bridge SHALL configure audio capture with 2 channels (stereo) at 48000 Hz sample rate
3. THE Audio_Bridge SHALL output raw PCM audio stream in signed 16-bit little-endian format
4. THE Music_System SHALL create a Discord audio resource from the ffmpeg stdout stream
5. THE Music_System SHALL enable inline volume control for the audio resource
6. WHEN ffmpeg encounters an error, THE Music_System SHALL log the error and attempt graceful shutdown
7. THE Music_System SHALL suppress ffmpeg stderr output to prevent console log saturation

### Requirement 8: Session Cleanup and Error Handling

**User Story:** Como administrador, quiero que el sistema limpie recursos automáticamente cuando ocurren errores, para evitar fugas de memoria y procesos huérfanos.

#### Acceptance Criteria

1. WHEN any error occurs during playback, THE Music_System SHALL execute a complete cleanup routine
2. THE Music_System SHALL terminate the ffmpeg process if it exists
3. THE Music_System SHALL close the Virtual_Browser and all associated pages
4. THE Music_System SHALL destroy the Discord voice connection
5. THE Music_System SHALL reset all session state variables to their initial values
6. THE Music_System SHALL mark the Music_Session as inactive
7. WHEN cleanup completes, THE Music_System SHALL log the cleanup status
8. IF cleanup fails, THEN THE Music_System SHALL log the error but continue attempting to release remaining resources

### Requirement 9: API Endpoints for Configuration and Monitoring

**User Story:** Como desarrollador del dashboard, quiero endpoints API REST para gestionar configuraciones de credenciales y obtener información de monitoreo del sistema, para integrar la consola de logs y detección de errores en la interfaz web.

#### Acceptance Criteria

1. THE Music_System SHALL provide a GET endpoint "/api/music/status" that returns current session status including active state, track name, locked channel, and system health metrics
2. THE Music_System SHALL provide a POST endpoint "/api/music/session" that accepts and stores Premium_Cookies with validation
3. THE Music_System SHALL provide a GET endpoint "/api/music/logs" that returns recent System_Logs with optional filtering by severity, timestamp, and search query
4. THE Music_System SHALL provide a WebSocket endpoint "/ws/music/logs" for real-time log streaming to the Dashboard console
5. THE Music_System SHALL provide a GET endpoint "/api/music/errors" that returns detected errors and failures with stack traces
6. THE Music_System SHALL require authentication middleware for all music API endpoints
7. WHEN an API request fails, THE Music_System SHALL return appropriate HTTP status codes and error messages in JSON format
8. THE Music_System SHALL validate all input parameters and sanitize them to prevent injection attacks
9. THE Music_System SHALL NOT provide endpoints for play or stop operations (playback control is exclusively via Discord_Command)

### Requirement 10: Database Persistence for Music Settings

**User Story:** Como administrador, quiero que mis configuraciones de música se guarden en la base de datos, para no tener que reconfigurar cada vez que el bot se reinicia.

#### Acceptance Criteria

1. THE Music_System SHALL store Premium_Cookies in the music_settings table associated with guild_id
2. THE Music_System SHALL store the last used Voice_Channel identifier in the music_settings table
3. THE Music_System SHALL store volume preference (default 100) in the music_settings table
4. WHEN the bot restarts, THE Music_System SHALL load stored settings from the database
5. THE Music_System SHALL provide database functions getMusicSettings and updateMusicSettings
6. THE Music_System SHALL handle database errors gracefully and log them without crashing

### Requirement 11: Security Review and Vulnerability Assessment

**User Story:** Como administrador del sistema, quiero que se realice una revisión de seguridad completa después de la integración, para identificar y mitigar vulnerabilidades potenciales antes del despliegue en producción.

#### Acceptance Criteria

1. WHEN the Music_System integration is complete and functional, THE development team SHALL conduct a security review
2. THE security review SHALL assess Premium_Cookies storage encryption and access controls
3. THE security review SHALL validate input sanitization for Music_Query and API endpoints
4. THE security review SHALL verify authentication and authorization mechanisms for Dashboard access
5. THE security review SHALL test for command injection vulnerabilities in ffmpeg and Virtual_Browser interactions
6. THE security review SHALL assess WebSocket security for real-time log streaming
7. THE security review SHALL verify that System_Logs do not expose sensitive information such as Premium_Cookies or user tokens
8. THE security review SHALL document all identified vulnerabilities with severity ratings and remediation recommendations
9. IF critical vulnerabilities are found, THEN THE Music_System SHALL not be deployed until they are resolved

