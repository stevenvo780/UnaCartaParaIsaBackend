# 🎮 Backend de Simulación y Guardado — Una Carta Para Isa

Servidor de simulación en tiempo real con WebSockets, almacenamiento de partidas (GCS o local), monitoreo Prometheus/Grafana y aceleración opcional por GPU (TensorFlow.js). Puertos por defecto: HTTP 8080, WS 8080.

## 🚀 Inicio rápido

- Desarrollo (hot-reload): `npm ci && npm run dev`
- Build y ejecución: `npm run build && npm start`
- Docker (CPU): ver `docker-compose.yml` en la raíz del repo
- Docker (GPU): `docker compose -f docker-compose.gpu.yml up` (requiere runtime NVIDIA)

Servidor en `http://localhost:8080`. WebSockets en `ws://localhost:8080/ws/sim` y `ws://localhost:8080/ws/chunks`.

## 🔧 Variables de entorno

Mínimas recomendadas en `.env`:

```env
# Puerto HTTP (por defecto 8080)
PORT=8080

# Almacenamiento de partidas (selección automática si no hay credenciales GCP)
USE_LOCAL_STORAGE=true
LOCAL_SAVES_PATH=./saves

# Google Cloud Storage (si se usa nube)
BUCKET_NAME=una-carta-para-isa-saves
GCP_PROJECT_ID=emergent-enterprises
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# CORS (permitir orígenes)
ALLOWED_ORIGINS=http://localhost:3000

# NAS opcional (SFTP) para backups
NAS_ENABLED=false
NAS_HOST=
NAS_USER=
NAS_PASSWORD=
NAS_PATH=
```

GPU opcional (cuando se usa TensorFlow.js y backend GPU):

```env
TF_FORCE_GPU_ALLOW_GROWTH=true
TF_CPP_MIN_LOG_LEVEL=2
CUDA_VISIBLE_DEVICES=0
```

## 📡 API HTTP

- Health: `GET /health`
- Guardados: `GET /api/saves`, `GET /api/saves/:id`, `POST /api/saves`, `DELETE /api/saves/:id`
- Simulación: `GET /api/sim/health`, `GET /api/sim/state`, `POST /api/sim/command`
- Mundo: `POST /api/world/chunk`
- Métricas: `GET /metrics` (Prometheus 0.0.4), `GET /metrics/runtime` (JSON)

## 🔌 WebSockets

- `ws://host:8080/ws/sim` — streaming de snapshots de simulación a ~50 Hz (MessagePack). Envía también respuestas a peticiones como `REQUEST_FULL_STATE`, `REQUEST_ENTITY_DETAILS`, `REQUEST_PLAYER_ID`.
- `ws://host:8080/ws/chunks` — streaming de chunks de terreno asíncronos.

Tipos de mensajes (alto nivel):
- `TICK` con `payload` snapshot incremental
- `SNAPSHOT` inicial
- `RESPONSE` a requests puntuales
- `ERROR` en formato `{ type: "ERROR", message }`

## 🧠 Arquitectura (resumen)

- Core en TypeScript con DI (Inversify) y scheduler multi-rate (FAST/MEDIUM/SLOW)
- `SimulationRunner` como estado autoritativo + cola de comandos
- Sistemas por dominio (IA, Movimiento, Necesidades, Economía, Construcción, etc.)
- Batch computing opcional con `GPUComputeService` y `GPUBatchQueryService` (lazy-load de TF)
- Almacenamiento: GCS o filesystem local; NAS SFTP opcional para backups
- Monitoreo: `PerformanceMonitor` expone métricas de tick, sistemas, subsistemas y memoria

## 🐳 Docker

CPU (imagen ligera): `UnaCartaParaIsaBackend/Dockerfile` — usado por `docker-compose.yml` en la raíz para levantar backend, frontend y monitoreo.

GPU: `UnaCartaParaIsaBackend/Dockerfile.gpu` + `docker-compose.gpu.yml` (requiere drivers NVIDIA y runtime). Expone además el inspector `9229`.

## 📈 Monitoreo

- Prometheus: scrapea `GET /metrics` cada 5s (ver `monitoring/prometheus.yml`)
- Grafana: dashboards aprovisionados automáticamente (ver `monitoring/grafana/`)
- Stack listo en la raíz con `docker compose up` (servicios `prometheus` y `grafana`)

Accesos:
- Backend: `http://localhost:8080`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001` (admin/admin)

## 📁 Estructura relevante

```
src/
  application/
    app.ts            # Express + rutas (saves, world, sim, metrics)
    server.ts         # Entrypoint HTTP + WS (/ws/sim, /ws/chunks)
  config/             # CONFIG, container DI, tipos
  domain/simulation/  # Core de simulación y sistemas
  infrastructure/     # Servicios (storage, chunk streaming, utils)
  shared/             # Tipos, constantes, MessagePack
```

## 🧪 Scripts

- `npm run dev` — desarrollo con hot-reload
- `npm run build && npm start` — build y ejecución (dist)
- `npm run test` — tests con Vitest
- `npm run lint[:check|:fix]` — linting
- `npm run docs` — documentación TypeDoc

## 📚 Documentación (TypeDoc)

Genera documentación navegable a partir de JSDoc/TS:

```bash
npm run docs
```

La salida se genera según `typedoc.json`. Abre `docs/index.html` para explorar sistemas, tipos y flujos.
