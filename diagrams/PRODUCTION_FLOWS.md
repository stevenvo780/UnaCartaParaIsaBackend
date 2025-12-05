# 🏭 Sistema de Producción — v4

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PRODUCTION SYSTEM                                   │
│                                                                              │
│  Zones (FOOD/WATER/WORK) → ensureAssignments() → processProduction()         │
│                                                                              │
│  deps: LifeCycleSystem (workers), InventorySystem (stockpiles),               │
│        WorldResourceSystem (obstáculos), TerrainSystem (dirt visual)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo principal

1) `update()` (cada `updateIntervalMs`):
- Filtra zonas productivas → `ensureAssignments()` para cubrir vacantes
- `processProduction()` si pasó `productionIntervalMs`

2) `ensureAssignments(zone)`:
- Busca agentes vivos e inactivos (LifeCycleSystem)
- Asigna hasta `maxWorkersPerZone`

3) `processProduction(zone, now)`:
- Calcula `amount = workers * baseYieldPerWorker`
- Deposita en stockpile de la zona (`depositToZoneStockpile`)
- Emite `PRODUCTION_OUTPUT_GENERATED`
- Visual (FOOD): convierte GRASS→DIRT si no hay obstáculos (WorldResourceSystem)

## 📡 Eventos

- Emite: `PRODUCTION_OUTPUT_GENERATED`, `PRODUCTION_WORKER_REMOVED`
- Escucha: `AGENT_DEATH` → limpia asignaciones

## 🤝 Integración

- `InventorySystem`: stockpiles por zona y transferencias
- `LifeCycleSystem`: disponibilidad de trabajadores
- `WorldResourceSystem`: detección de obstáculos (evita modificar tile si hay recursos encima)
- `TerrainSystem`: feedback visual de agricultura (GRASS→DIRT)

## ⚙️ Rendimiento

- Logging periódico (10s) para monitoreo
- Métricas de duración por operación (`PerformanceMonitor`)

---

## 📌 Validación

- `src/domain/simulation/systems/world/ProductionSystem.ts`: contiene `update`, `ensureAssignments`, `processProduction`, `depositToZoneStockpile` y la lógica de modificación de terreno/obstáculos tal como se explica.
- Los eventos `PRODUCTION_OUTPUT_GENERATED` y `PRODUCTION_WORKER_REMOVED` se emiten desde este archivo, confirmando la sección de eventos.
