# 🏗️ Sistema de Construcción — v4

## 📊 Arquitectura del Sistema de Construcción

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BUILDING SYSTEM ARCHITECTURE                          │
│                                                                              │
│  ┌────────────────────┐     ┌─────────────────────┐                         │
│  │   BuildingSystem   │────►│  ResourceReservation │                         │
│  │                    │     │      System         │                         │
│  └─────────┬──────────┘     └─────────────────────┘                         │
│            │                                                                 │
│            │ setDependencies()                                              │
│            ▼                                                                 │
│  ┌────────────────────┐     ┌─────────────────────┐                         │
│  │    TaskSystem      │────►│  WorldResourceSystem │                         │
│  │  (tareas de obra)  │     │  (elimina recursos) │                         │
│  └────────────────────┘     └─────────────────────┘                         │
│            │                         │                                       │
│            ▼                         ▼                                       │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │                    TerrainSystem                                │         │
│  │          (modifica tiles a dirt para construcción)             │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │     Maintenance Loop (dentro de BuildingSystem)                 │         │
│  │  - Deterioro, abandono, reparaciones                           │         │
│  │  - Uso de InventorySystem para reparaciones                    │         │
│  └────────────────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Construcción

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONSTRUCTION FLOW                                     │
│                                                                              │
│  1. pickNextConstruction()                                                  │
│     ├── Evalúa límites: houses < 8, mines < 4, workbenches < 3, farms < 4  │
│     └── Verifica si ya hay trabajo activo para ese tipo                     │
│                                                                              │
│  2. tryScheduleConstruction(label, now, position?)                          │
│     ├── BUILDING_COSTS[label] → obtiene wood, stone, time                   │
│     ├── reservationSystem.reserve() → reserva materiales                    │
│     ├── validateAndAdjustPosition() → evita colisiones/agua                 │
│     ├── createConstructionZone() → crea zona con metadata                   │
│     ├── worldResourceSystem.removeResourcesInArea() → limpia área           │
│     ├── terrainSystem.modifyTile() → convierte tiles a DIRT                 │
│     ├── taskSystem.createTask() → crea tarea para trabajadores              │
│     └── emit BUILDING_CONSTRUCTION_STARTED                                   │
│                                                                              │
│  3. completeFinishedJobs(now)                                               │
│     └── Para cada job donde now >= completesAt:                             │
│         └── finalizeConstruction(job)                                        │
│                                                                              │
│  4. finalizeConstruction(job)                                               │
│     ├── reservationSystem.consume() → consume materiales reservados         │
│     ├── Actualiza zona: underConstruction=false, type según label           │
│     ├── Si FARM → spawnFarmCrops() via worldResourceSystem                  │
│     ├── durability=100, maxDurability=100                                   │
│     └── emit BUILDING_CONSTRUCTED                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏠 Tipos de Edificios

| Tipo | Límite | Costo Wood | Costo Stone | Tiempo | ZoneType |
|------|--------|------------|-------------|--------|----------|
| HOUSE | 8 | variable | variable | variable | REST |
| MINE | 4 | variable | variable | variable | WORK |
| WORKBENCH | 3 | variable | variable | variable | WORK (craftingStation) |
| FARM | 4 | variable | variable | variable | FOOD |

---

## 🔧 Sistema de Mantenimiento (BuildingMaintenanceSystem)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     MAINTENANCE STATE MACHINE                                │
│                                                                              │
│  CONDITION THRESHOLDS:                                                      │
│  ├── durability > 70  → GOOD                                                │
│  ├── durability > 30  → WORN (criticalDurabilityThreshold)                  │
│  ├── durability > 10  → CRITICAL (ruinedDurabilityThreshold)                │
│  └── durability <= 0  → DESTROYED (destructionThreshold)                    │
│                                                                              │
│  DETERIORATION RATES:                                                       │
│  ├── Normal: 0.8/hora                                                       │
│  ├── Abandoned (>5min sin uso): 1.6/hora (2x)                               │
│  └── Usage: 0.4 cada 10 usos                                                │
│                                                                              │
│  REPAIR:                                                                    │
│  ├── Normal: +35 durability, -1 maxDurability                               │
│  └── Perfect: restaura a maxDurability (3x costo)                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📡 Sistema de Eventos

| Evento | Emisor | Consumidor | Payload |
|--------|--------|------------|---------|
| BUILDING_CONSTRUCTION_STARTED | BuildingSystem | UI, Client | jobId, zoneId, label, completesAt |
| BUILDING_CONSTRUCTED | BuildingSystem | MaintenanceSystem, UI | jobId, zoneId, label, completedAt |
| BUILDING_DAMAGED | MaintenanceSystem | UI | zoneId, damage, newDurability, cause |
| BUILDING_REPAIRED | MaintenanceSystem | UI | zoneId, agentId, previousDurability, newDurability |

---

### Dependencias Inyectadas (InversifyJS)

| Sistema | Tipo | Estado | Notas |
|---------|------|--------|-------|
| GameState | @inject | ✅ | Acceso a zones, worldSize, terrainTiles |
| ResourceReservationSystem | @inject | ✅ | Reservar/consumir materiales |
| TaskSystem | @inject @optional | ✅ | Crear tareas de construcción |
| WorldResourceSystem | @inject @optional | ✅ | Eliminar recursos en área, spawn crops |
| TerrainSystem | @inject @optional | ✅ | Modificar tiles a DIRT |
| InventorySystem | @inject | ✅ | (MaintenanceSystem) Para reparaciones |

### Flujo de Eventos

| Componente | Evento Emitido | Handler | Estado |
|------------|----------------|---------|--------|
| BuildingSystem | BUILDING_CONSTRUCTION_STARTED | UI/Client | ✅ |
| BuildingSystem | BUILDING_CONSTRUCTED | initializeBuildingState() | ✅ |
| BuildingSystem | BUILDING_DAMAGED | UI/Client | ✅ |
| BuildingSystem | BUILDING_REPAIRED | UI/Client | ✅ |

---

### Fortalezas del Sistema

- ✅ **Arquitectura modular**: BuildingSystem concentra construcción y mantenimiento (loop interno)
- ✅ **Resource Reservation Pattern**: Evita construir sin materiales
- ✅ **Position Validation**: 100 intentos con rechazo por bounds/collision/water
- ✅ **Task Integration**: Trabajadores asignados automáticamente
- ✅ **Terrain Modification**: Tiles convertidos a DIRT bajo edificios
- ✅ **Farm Automation**: Crops spawneados automáticamente al completar granja
- ✅ **Realistic Maintenance**: Deterioro por tiempo, uso y abandono
- ✅ **Event-Driven**: MaintenanceSystem escucha BUILDING_CONSTRUCTED

### Conectividad General
**Estado: 100% Conectado Correctamente**

```
BuildingSystem
    ├── @inject GameState ✅
    ├── @inject ResourceReservationSystem ✅
    ├── @inject @optional TaskSystem ✅
    ├── @inject @optional WorldResourceSystem ✅
    ├── @inject @optional TerrainSystem ✅
    ├── @inject @optional InventorySystem ✅ (reparaciones y stock para mantenimiento)
    └── emit → BUILDING_CONSTRUCTION_STARTED, BUILDING_CONSTRUCTED, BUILDING_DAMAGED, BUILDING_REPAIRED ✅
```

---

## 📌 Validación

- `src/domain/simulation/systems/structures/BuildingSystem.ts`: concentra construcción y mantenimiento. Las secciones `tryScheduleConstruction`, `createConstructionZone`, `updateMaintenance()` y `repairBuilding()` implementan cada paso descrito.
- `ResourceReservationSystem`, `TaskSystem`, `WorldResourceSystem`, `TerrainSystem` e `InventorySystem` se inyectan exactamente como se muestra en el diagrama, validando los flujos de reserva, limpieza de área y reparaciones.
- Eventos `BUILDING_CONSTRUCTION_STARTED`, `BUILDING_CONSTRUCTED`, `BUILDING_DAMAGED` y `BUILDING_REPAIRED` son emitidos desde este archivo y consumidos por UI/telemetría.
