# Roadmap de Fases - Music Memory Service (Engram-like)

## Fase 1 - Aprendizaje local (completada)
- Seed por usuario/servidor en DB local del bot
- Actualizacion automatica desde !play
- Pruebas unitarias de heuristicas

## Fase 2 - Servicio aislado en Docker (completada)
- Servicio `music-memory` independiente
- API:
  - `POST /v1/events/play`
  - `GET /v1/stats/top`
  - `GET /health`
- Persistencia propia SQLite en volumen Docker
- Integracion bot -> servicio por `MUSIC_MEMORY_URL`

## Fase 3 - SQA y pruebas (completada)
- Script test integrado en `npm test`
- Cobertura minima para:
  - heuristicas de seed
  - cliente de memoria remoto
- Evidencia de ejecucion en contenedor release

## Script de pruebas
1. `docker compose -f docker-compose.release.yml up -d --build`
2. `docker compose -f docker-compose.release.yml exec -T bot npm test`
3. Health check servicio:
   `curl http://localhost:9777/health`
4. Smoke API top:
   `curl "http://localhost:9777/v1/stats/top?scope=global&type=seed&limit=5"`

## Criterios de aceptacion por fase
- F1: seed cambia y persiste por usuario/guild
- F2: eventos llegan al servicio y quedan almacenados
- F3: tests pasan sin fallos y contenedores healthy
