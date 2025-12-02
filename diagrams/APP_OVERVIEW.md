# 🧭 Visión General del Backend — v4

## 🏗️ Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            APPLICATION LAYERS                                  │
│                                                                              │
│  Routes (HTTP)        WebSocket Streams     Monitoring/Health                │
│   /api/saves          /ws/sim (snapshots)   /metrics (Prometheus)            │
│   /api/world/chunk    /ws/chunks (terrain)  /metrics/runtime (JSON)          │
│   /api/sim/*                                                                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         SimulationRunner + Scheduler                     │ │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐                      │ │
│  │  │  FAST (50ms)│ │MEDIUM (250ms)│ │ SLOW (1000ms)│                      │ │
│  │  │ movement    │ │ ai, needs    │ │ economy, ... │                      │ │
│  │  └─────────────┘ └──────────────┘ └──────────────┘                      │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Core Services: DI Container, PerformanceMonitor, SharedSpatialIndex,        │
│                GPUComputeService (lazy TFJS), GPUBatchQueryService           │
│                                                                              │
│  Storage: local FS / GCS (saves), NAS opcional                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🌐 Arranque y Procesos

1) `server.ts`:
- `container.get(SimulationRunner)` → `initialize()`
- Carga save más reciente si existe; si no, `initializeFreshWorld()`
- `detectGPUAvailability()` (no carga TFJS)
- Levanta HTTP y registra upgrades WS (`/ws/sim`, `/ws/chunks`)

2) `SimulationRunner`:
- Prepara `SharedSpatialIndex` por tick
- Scheduler multi-rate: registra sistemas por frecuencia
- Emite snapshot `TICK` (MessagePack) para `/ws/sim`

3) Streams:
- `/ws/sim`: `SNAPSHOT` inicial + `TICK` (~50Hz) cacheado por número de tick
- `/ws/chunks`: `ChunkStreamServer` genera chunks asíncronos

4) Rutas HTTP:
- `/api/sim/*` (estado, comandos, save), `/api/world/chunk`, `/api/saves*`
- `/metrics`, `/metrics/runtime`

## 🔌 Integraciones clave

- `WorldQueryService`: fachada unificada para queries espaciales
- `GPUComputeService`: vectorización y GPU opcional (lazy-load TFJS)
- `GPUBatchQueryService`: lotes de distancias (queries masivas)
- `StorageService`: guardado/carga de partidas (GCS/FS)

## 📈 Observabilidad

- Prometheus: `backend_*` métricas por tick/sistema/subsistema/memoria
- Grafana: dashboards aprovisionados

