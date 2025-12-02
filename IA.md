# 🧠 IA de Agentes — v4 (ECS + Tareas Unificadas)

Este documento describe la IA actual basada en tareas unificadas, `SystemRegistry` y `EventBus`. Sustituye el modelo legacy de “goals/actions” y `processAgent()`.

Para diagrama detallado ver: `UnaCartaParaIsaBackend/diagrams/AI_FLOWS.md`.

---

## Panorama

- Emisión de tareas por otros sistemas vía `EventBus("ai:task_emit")`.
- `AISystem.update()` cada ~100ms (configurable) procesa detectores, cola y handlers.
- `TaskQueue` gestiona prioridad, expiración y desduplicación por agente.
- `SystemRegistry` provee acceso tipado a subsistemas (needs, movement, worldQuery, combat, crafting, building, inventory, economy, social, etc.).

---

## Flujo de una tarea

1) Sistema externo emite evento:

```
eventBus.emit("ai:task_emit", { agentId, type, priority, target?, params?, source? })
```

2) `AISystem.emitTask()` encola o sube la prioridad (boost acumulativo) si ya existe.

3) En `AISystem.update()`:
- Ejecuta detectores (hambre/sed/energía/peligro/rol/tiempo)
- Limpia expiradas del `TaskQueue`
- Activa `activeTask` si no hay una en curso (dequeue por mayor prioridad)
- Llama al handler correspondiente

---

## Handlers por tipo de tarea

```
SATISFY_NEED  → handleConsume    → needs, inventory, worldQuery
REST          → handleRest       → needs, movement
GATHER        → handleGather     → movement, worldQuery, inventory, worldResources
ATTACK/HUNT   → handleAttack     → combat, movement, animals
FLEE          → handleFlee       → movement
SOCIALIZE     → handleSocialize  → social
EXPLORE       → handleExplore    → movement, worldQuery
CRAFT         → handleCraft      → crafting, inventory
BUILD         → handleBuild      → building, reservation, worldResources, terrain, task
DEPOSIT       → handleDeposit    → inventory
TRADE         → handleTrade      → economy, inventory, social
IDLE          → (implícito)      → no-op
```

---

## Consultas espaciales y batch/GPU

- `WorldQueryService` centraliza recursos, animales, agentes, tiles y zonas.
- `SharedSpatialIndex` (reconstruido por tick) optimiza queries (O(log n + k)).
- Batch vectorizado con `Float32Array` para movimiento/necesidades/social.
- GPU opcional vía `GPUComputeService` con lazy-load de TensorFlow.js.
  - Para operaciones de TF, se usa CPU para N < 1000 y GPU a partir de ≥ 1000 entidades.
  - `GPUBatchQueryService` accumula queries y decide CPU/GPU según volumen (entidades ≥ 100, queries ≥ 50).

---

## Scheduling y memoria del agente

- `updateInterval`: 100ms por defecto (control por agente con `lastUpdate`).
- `activeTask[agentId]`: a lo sumo una tarea activa por agente.
- Reglas básicas: si `isDead` u `offDuty` → no se activan tareas.
- Memoria ligera por agente: recursos conocidos, zonas visitadas, última exploración.

---

## Eventos relevantes

- Emisión: `AGENT_ACTION_COMPLETE`, `RESOURCE_CONSUMED`, `NEED_CRITICAL`, `NEED_SATISFIED`, `COMBAT_HIT`, `COMBAT_KILL`, `ANIMAL_HUNTED`, `BUILDING_CONSTRUCTION_STARTED`, `BUILDING_CONSTRUCTED`.
- Recepción (IA): `ai:task_emit` (nuevas tareas desde otros sistemas).

---

## Referencias cruzadas

- Movimiento: `diagrams/MOVEMENT_FLOWS.md` (cola de pathfinding, batch, fatiga)
- Necesidades: `diagrams/NEEDS_FLOWS.md` (decay/cross-effects, batch)
- Combate: `diagrams/COMBAT_FLOWS.md` (detección espacial, logging)
- Economía: `diagrams/ECONOMY_FLOWS.md` (producción, salarios)
- Construcción: `diagrams/BUILDING_FLOWS.md` (reservas, mantenimiento)
- Recursos del mundo: `diagrams/WORLDRESOURCE_FLOWS.md` (spawn por chunks, grid)
- Animales: `diagrams/ANIMAL_FLOWS.md` (spawning, necesidades, batch)

---

## 🎯 Flujo de Planificación de Objetivos (AgentGoalPlanner)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                        planGoals(deps, aiState, now)                       │
│                                                                            │
│  EVALUADORES (ejecutados en secuencia):                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. BiologicalDriveEvaluator    → SATISFY_HUNGER/THIRST/ENERGY          │ │
│  │    ├── IF priority > 0.9 → RETURN [criticalGoal] (corte temprano)      │ │
│  │    └── Threshold: < 40 = urgente                                       │ │
│  │                                                                        │ │
│  │ 2. ReproductionEvaluator       → REPRODUCE                             │ │
│  │                                                                        │ │
│  │ 3. SocialDriveEvaluator        → SATISFY_SOCIAL/FUN                    │ │
│  │                                                                        │ │
│  │ 4. CognitiveDriveEvaluator     → WORK, EXPLORE                         │ │
│  │                                                                        │ │
│  │ 5. CollectiveNeedsEvaluator    → Necesidades de la comunidad           │ │
│  │                                                                        │ │
│  │ 6. CombatEvaluator             → ATTACK, FLEE, COMBAT                  │ │
│  │    ├── IF combat priority > 0.7 → RETURN [combatGoal] (corte temprano) │ │
│  │    └── Evalúa estrategia: peaceful/tit_for_tat/bully                   │ │
│  │                                                                        │ │
│  │ 7. AssistEvaluator             → ASSIST (ayudar otros agentes)         │ │
│  │                                                                        │ │
│  │ 8. ConstructionEvaluator       → CONSTRUCTION                          │ │
│  │                                                                        │ │
│  │ 9. DepositEvaluator            → DEPOSIT (depositar recursos)          │ │
│  │                                                                        │ │
│  │ 10. CraftingEvaluator          → CRAFT                                 │ │
│  │                                                                        │ │
│  │ 11. QuestEvaluator             → QUEST                                 │ │
│  │                                                                        │ │
│  │ 12. TradeEvaluator             → TRADE                                 │ │
│  │                                                                        │ │
│  │ 13. BuildingContributionEval   → BUILD (contribuir a edificios)        │ │
│  │                                                                        │ │
│  │ 14. AttentionEvaluator         → EXPLORE (atención/exploración)        │ │
│  │                                                                        │ │
│  │ 15. OpportunitiesEvaluator     → WORK, EXPLORE (oportunidades)         │ │
│  │     (Solo si criticalCount == 0)                                       │ │
│  │                                                                        │ │
│  │ 16. ExpansionEvaluator         → EXPAND (expansión territorio)         │ │
│  │                                                                        │ │
│  │ 17. DefaultExploration         → EXPLORE (fallback si goals vacío)     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  FINAL: prioritizeGoals() → ordenar por prioridad → retornar top 5        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Flujo de Acciones (AIActionPlanner)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                     planAction(agentId, goal) → AgentAction                │
│                                                                            │
│  GOAL TYPE                    →  ACTION TYPE                               │
│  ─────────────────────────────────────────────────────────────────────────  │
│  SATISFY_NEED                 →  HARVEST / MOVE / IDLE                     │
│  SATISFY_HUNGER               →  HARVEST / MOVE / IDLE                     │
│  SATISFY_THIRST               →  HARVEST / MOVE / IDLE                     │
│  SATISFY_ENERGY               →  SLEEP / MOVE / IDLE                       │
│  SATISFY_SOCIAL               →  SOCIALIZE / MOVE                          │
│  SATISFY_FUN                  →  SOCIALIZE / MOVE                          │
│  GATHER                       →  HARVEST / MOVE                            │
│  WORK                         →  WORK / MOVE / HARVEST                     │
│  CRAFT                        →  CRAFT / MOVE                              │
│  DEPOSIT                      →  DEPOSIT / MOVE                            │
│  FLEE                         →  MOVE (posición calculada para escapar)    │
│  ATTACK / COMBAT              →  ATTACK / MOVE                             │
│  ASSIST                       →  MOVE → SOCIALIZE                          │
│  SOCIAL                       →  SOCIALIZE / MOVE                          │
│  EXPLORE                      →  MOVE                                      │
│  CONSTRUCTION                 →  BUILD / WORK / MOVE                       │
│  IDLE                         →  IDLE                                      │
│  REST                         →  SLEEP / MOVE / IDLE                       │
│  INSPECT                      →  MOVE                                      │
│  HUNT                         →  ATTACK / MOVE                             │
│                                                                            │
│  LÓGICA DE DISTANCIA:                                                     │
│  ├── HARVEST_RANGE = 80     → si dist < 80 ejecutar HARVEST               │
│  ├── ATTACK_RANGE = 50      → si dist < 50 ejecutar ATTACK                │
│  └── EXPLORE_RANGE = 200    → rango de exploración                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Ejecución (AIActionExecutor)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                     executeAction(action) → void                           │
│                                                                            │
│  ACTION TYPE      →  SISTEMA INVOLUCRADO    →  EVENTO EMITIDO             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  MOVE             →  MovementSystem          →  AGENT_ACTION_COMPLETE      │
│  WORK             →  TaskSystem              →  AGENT_ACTION_COMPLETE      │
│  HARVEST          →  WorldResourceSystem     →  AGENT_ACTION_COMPLETE      │
│                   →  NeedsSystem             →  (satisface necesidad)      │
│                   →  InventorySystem         →  (añade recursos)           │
│  IDLE             →  NeedsSystem             →  AGENT_ACTION_COMPLETE      │
│  ATTACK           →  AnimalRegistry          →  AGENT_ACTION_COMPLETE      │
│                   →  CombatSystem            →  COMBAT_HIT/KILL            │
│  SOCIALIZE        →  SocialSystem            →  AGENT_ACTION_COMPLETE      │
│  EAT              →  NeedsSystem             →  AGENT_ACTION_COMPLETE      │
│  DRINK            →  NeedsSystem             →  AGENT_ACTION_COMPLETE      │
│  SLEEP            →  NeedsSystem             →  AGENT_ACTION_COMPLETE      │
│  CRAFT            →  CraftingSystem          →  AGENT_ACTION_COMPLETE      │
│  DEPOSIT          →  InventorySystem         →  AGENT_ACTION_COMPLETE      │
│  BUILD            →  BuildingSystem          →  AGENT_ACTION_COMPLETE      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📡 Sistema de Eventos (Event Flow)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EVENTOS CLAVE DE IA                               │
│                                                                            │
│  EMISIÓN:                                                                 │
│  ─────────────────────────────────────────────────────────────────────────  │
│  AISystem.processAgent()                                                   │
│    └── AGENT_GOAL_CHANGED         (nuevo objetivo asignado)                │
│                                                                            │
│  AISystem.processAgent()                                                   │
│    └── AGENT_ACTION_COMMANDED     (acción iniciada)                        │
│                                                                            │
│  MovementSystem.updateEntityMovement()                                     │
│    └── MOVEMENT_ARRIVED_AT_ZONE   (llegó a zona)                          │
│    └── AGENT_ACTION_COMPLETE      (movimiento completado)                  │
│                                                                            │
│  AIActionExecutor.executeHarvest()                                         │
│    └── AGENT_ACTION_COMPLETE      (cosecha completada)                     │
│                                                                            │
│  RECEPCIÓN:                                                               │
│  ─────────────────────────────────────────────────────────────────────────  │
│  AISystem.handleActionComplete()                                           │
│    ← AGENT_ACTION_COMPLETE                                                 │
│    → Limpia currentAction                                                  │
│    → Evalúa si completar/fallar objetivo                                   │
│                                                                            │
│  AISystem.notifyEntityArrived()                                            │
│    ← (llamado por otros sistemas cuando agente llega)                      │
│    → Delega a AIZoneHandler                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧬 Diagrama de Estado del Agente

```text
                    ┌──────────────────────────────────────────────┐
                    │                                              │
                    ▼                                              │
              ┌──────────┐                                         │
              │  IDLE    │◄────────────────────────────────────────┤
              └────┬─────┘                                         │
                   │ makeDecision()                                │
                   ▼                                              │
         ┌─────────────────┐                                       │
         │ PLANNING GOALS  │                                       │
         │ (17 evaluadores)│                                       │
         └────────┬────────┘                                       │
                  │ goals.length > 0                               │
                  ▼                                               │
         ┌─────────────────┐                                       │
         │  GOAL ASSIGNED  │                                       │
         │ currentGoal set │                                       │
         └────────┬────────┘                                       │
                  │ planAction()                                   │
                  ▼                                              │
         ┌─────────────────┐                                       │
         │ ACTION PLANNED  │                                       │
         │ currentAction   │                                       │
         └────────┬────────┘                                       │
                  │ executeAction()                                │
                  ▼                                              │
         ┌─────────────────┐                                       │
         │   EXECUTING     │                                       │
         │ (MOVE/HARVEST/  │                                       │
         │  ATTACK/etc)    │                                       │
         └────────┬────────┘                                       │
                  │ AGENT_ACTION_COMPLETE                          │
                  ▼                                              │
    ┌─────────────────────────────┐                                │
    │   handleActionComplete()    │                                │
    │                             │                                │
    │  success? ──► completeGoal()├────────────────────────────────┘
    │     │                       │
    │     └► fail? ► failGoal() ──┤
    │                             │
    │  MOVE complete? ► planNext ─┤
    └─────────────────────────────┘
```
