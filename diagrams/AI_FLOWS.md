# 🧠 IA de Agentes — Arquitectura v4 (ECS + Tareas Unificadas)

Actualizado para la arquitectura actual del backend (v4): tareas unificadas, SystemRegistry, EventBus y consultas espaciales mediante WorldQueryService. El AISystem opera con intervalo configurable y delega toda la lógica a handlers tipados por dominio.

---

## 📊 Panorama General

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CICLO DE IA (v4)                                   │
│                                                                              │
│  Sistemas externos → EventBus("ai:task_emit") → AISystem.emitTask()          │
│                                                                              │
│  AISystem.update() cada ~100ms (configurable)                                 │
│    ├─ runDetectors(agentId)               # hambre/sed/peligro/rol/tiempo     │
│    ├─ TaskQueue.cleanExpired(agentId)     # vencimiento y desduplicación      │
│    ├─ if no activeTask: dequeue()         # activa la tarea de mayor prioridad│
│    └─ executeTask(handler)                # delega al dominio vía registry     │
│                                                                              │
│  SystemRegistry (fachada ECS)                                                  │
│    ├─ needs, movement, worldQuery, combat, crafting, building, inventory, …  │
│    └─ Acceso tipado + composición clara de responsabilidades                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

Notas:
- `updateInterval` por defecto: 100ms. El scheduler global sigue multi‑rate, pero la lógica de IA se desacopla mediante este intervalo.
- Prioridad de tareas con “boost” acumulativo si se emiten repetidas.
- Tareas y handlers son deterministas y side‑effect free salvo por llamadas a sistemas.

---

## 🔌 Emisión de Tareas (EventBus)

```
Sistema X → eventBus.emit("ai:task_emit", {
  agentId, type, priority, target?, params?, source?
})
        │
        ▼
AISystem.emitTask() → TaskQueue.enqueueOrBoost()
```

Fuentes típicas:
- NeedsSystem: SATISFY_NEED, REST
- RoleSystem/EconomySystem: GATHER, CRAFT, DEPOSIT, TRADE
- CombatSystem: ATTACK/FLEE
- World/Exploración: EXPLORE, HUNT

---

## 🧭 Handlers y Dependencias (vía SystemRegistry)

```
TaskType             → Handler           → Sistemas implicados
──────────────────────────────────────────────────────────────────────────────
SATISFY_NEED         → handleConsume     → needs, inventory, worldQuery
REST                 → handleRest        → needs, movement
GATHER               → handleGather      → movement, worldQuery, inventory, worldResources
ATTACK / HUNT        → handleAttack      → combat, movement, animals (si aplica)
FLEE                 → handleFlee        → movement
SOCIALIZE            → handleSocialize   → social
EXPLORE              → handleExplore     → movement, worldQuery
CRAFT                → handleCraft       → crafting, inventory
BUILD                → handleBuild       → building, reservation, worldResources, terrain, task
DEPOSIT              → handleDeposit     → inventory
TRADE                → handleTrade       → economy, inventory, social
IDLE                 → (implícito)       → no‑op
```

Puntos clave:
- Consultas espaciales centralizadas en `WorldQueryService` (recursos/animales/agentes/tiles/zonas).
- El movimiento usa `MovementSystem` + `MovementBatchProcessor` (GPUComputeService si aplica).
- Distancias/queries masivas se benefician indirectamente de `SharedSpatialIndex` y servicios GPU.

---

## 🌐 Consultas Espaciales

```
WorldQueryService
  ├─ findNearestResource / findResourcesInRadius
  ├─ findNearestAnimal / findAnimalsInRadius
  ├─ findNearestAgent  / findAgentsInRadius
  ├─ getTileAt / findTilesInArea
  └─ findZonesInRadius

SharedSpatialIndex (reconstruido por tick)  → O(log n + k)
GPU (opcional, lazy‑load TFJS)              → batch distances según umbral
```

---

## 🔄 Estados y Scheduling

```
AISystem
  ├─ updateInterval: 100ms (config)
  ├─ TaskQueue: prioridad + expiración
  ├─ activeTask[agentId]: 0..1
  └─ lastUpdate[agentId]: control de ritmo por agente
```

Reglas básicas por agente:
- Si `isDead` u `offDuty` → no se activan tareas
- Si hay `activeTask`, el handler decide si “completed” o “failed” y libera/rota
- Memoria ligera por agente: recursos conocidos, zonas visitadas, últimas exploraciones

---

## 📡 Flujo de Eventos Relevantes

Emisión desde handlers/sistemas (ejemplos):
- `AGENT_ACTION_COMPLETE`, `AGENT_GOAL_CHANGED` (compatibilidad)
- `RESOURCE_CONSUMED`, `NEED_CRITICAL`, `NEED_SATISFIED`
- `COMBAT_HIT`, `COMBAT_KILL`, `ANIMAL_HUNTED`
- `BUILDING_CONSTRUCTION_STARTED`, `BUILDING_CONSTRUCTED`

Recepción en IA (tareas nuevas): `ai:task_emit` (EventBus interno)

---

## ⚙️ Rendimiento

- Batch: movimiento/necesidades/social usan buffers `Float32Array` y, si corresponde, GPU (lazy‑load TFJS)
- Spatial: `SharedSpatialIndex` reduce O(n)→O(log n + k)
- Evita recalcular: caches (zonas, rutas, proximidad social) con TTL/invalidación

---

## ✅ Resumen de Cambios vs. versión anterior

- Se reemplaza el modelo “goals/actions” y `processAgent()` por Tareas Unificadas + Handlers tipados
- Se introduce `SystemRegistry` como punto único de integración ECS
- Se centralizan consultas espaciales en `WorldQueryService`
- Se mantiene compatibilidad de eventos legacy para UI/telemetría

