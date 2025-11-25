# Análisis Completo de Flujos de Información y Eventos en la Simulación

## Resumen Ejecutivo

Este documento analiza todos los flujos de información y eventos en el sistema de simulación, identificando:
- Conexiones entre sistemas
- Eventos que nunca se escuchan (potencial código muerto)
- Eventos emitidos pero sin suscriptores
- Dependencias críticas y posibles puntos de falla

---

## 1. Arquitectura General del Sistema de Eventos

```
┌─────────────────────────────────────────────────────────────────┐
│                    SimulationRunner                              │
│  - Orquesta todos los sistemas                                   │
│  - Ejecuta ciclo de tick (~200ms)                               │
│  - Captura eventos para enviar al frontend                       │
└─────────────────────────┬────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              BatchedEventEmitter (simulationEvents)              │
│  - Acumula eventos durante el tick                              │
│  - Flush al final de cada tick                                   │
│  - Permite a sistemas comunicarse sin acoplamiento directo      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Mapa Completo de Eventos

### 2.1 Eventos de Ciclo de Vida de Agentes

```
EMISORES                          EVENTO                      SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────
LifeCycleSystem.spawnAgent()  →  AGENT_BIRTH           →  SimulationRunner (genealogy + appearance)
NeedsSystem.handleEntityDeath()→ AGENT_DEATH           →  SimulationRunner (genealogy + entityIndex)
                                                           ProductionSystem (handleAgentDeath)
LifeCycleSystem.update()      →  AGENT_AGED            →  ❌ SIN SUSCRIPTORES
NeedsSystem.respawnEntity()   →  AGENT_RESPAWNED       →  SimulationRunner (reactivate AI)
```

### 2.2 Eventos de Movimiento

```
EMISORES                          EVENTO                           SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────────
MovementSystem.completeMovement() → MOVEMENT_ARRIVED_AT_ZONE     → ✅ SimulationRunner → AISystem.notifyEntityArrived()
                                                                    (CORREGIDO: antes no tenía suscriptor)
MovementSystem.completeMovement() → AGENT_ACTION_COMPLETE        → AISystem.handleActionComplete()
                                                                    LivingLegendsSystem.recordDeed()
                                                                    SimulationRunner (genealogy)
MovementSystem.completeActivity() → MOVEMENT_ACTIVITY_COMPLETED  → TrailSystem.reinforceRecentTrails()
MovementSystem.moveToZone()      → MOVEMENT_ACTIVITY_STARTED    → TrailSystem.recordMovement()
MovementSystem.moveToPoint()     → MOVEMENT_ACTIVITY_STARTED    → TrailSystem.recordMovement()
MovementSystem.moveToZone()      → PATHFINDING_FAILED           → SimulationRunner (failCurrentGoal)
```

### 2.3 Eventos de Necesidades

```
EMISORES                          EVENTO                      SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────
NeedsSystem.emitNeedEvents()  →  NEED_CRITICAL          →  SimulationRunner (force AI reeval)
                                                            CardDialogueSystem (addRecentEvent)
NeedsSystem.emitNeedEvents()  →  NEED_SATISFIED         →  ❌ SIN SUSCRIPTORES
```

### 2.4 Eventos de Recursos del Mundo

```
EMISORES                          EVENTO                      SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────
WorldResourceSystem.update()     → RESOURCE_STATE_CHANGE    → ❌ SIN SUSCRIPTORES
WorldResourceSystem.spawnResource()→ RESOURCE_SPAWNED       → ❌ SIN SUSCRIPTORES
WorldResourceSystem.harvestResource()→ RESOURCE_GATHERED    → SimulationRunner (questSystem)
                                                              WorldResourceSystem (handleResourceGathered)
SimulationRunner.processCommands()→ RESOURCE_GATHERED       → (mismo que arriba)
```

### 2.5 Eventos de Construcción

```
EMISORES                          EVENTO                           SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────────
BuildingSystem.tryScheduleConstruction()→ BUILDING_CONSTRUCTION_STARTED → ❌ SIN SUSCRIPTORES
BuildingSystem.finalizeConstruction()   → BUILDING_CONSTRUCTED         → SimulationRunner (questSystem)
                                                                          BuildingMaintenanceSystem (addBuildingEntry)
BuildingMaintenanceSystem.update()      → BUILDING_DAMAGED            → ❌ SIN SUSCRIPTORES
BuildingMaintenanceSystem.repairBuilding()→ BUILDING_REPAIRED         → ❌ SIN SUSCRIPTORES
```

### 2.6 Eventos de Combate

```
EMISORES                          EVENTO                      SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────
CombatSystem.startCombat()     →  COMBAT_ENGAGED         →  CardDialogueSystem (addRecentEvent)
CombatSystem.update()          →  COMBAT_HIT             →  ❌ SIN SUSCRIPTORES
CombatSystem.update()          →  COMBAT_KILL            →  SimulationRunner (genealogy.recordDeath)
CombatSystem.equipWeapon()     →  COMBAT_WEAPON_EQUIPPED →  ❌ SIN SUSCRIPTORES
CombatSystem.craftWeapon()     →  COMBAT_WEAPON_CRAFTED  →  ❌ SIN SUSCRIPTORES
CombatSystem.update()          →  ANIMAL_HUNTED          →  SimulationRunner (add food to inventory)
                                                            AnimalSystem (removeAnimal)
```

### 2.7 Eventos Sociales

```
EMISORES                          EVENTO                      SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────
SocialSystem.imposeTruce()     →  SOCIAL_TRUCE_IMPOSED   →  ❌ SIN SUSCRIPTORES
SocialSystem.updateTruces()    →  SOCIAL_TRUCE_EXPIRED   →  ❌ SIN SUSCRIPTORES
SocialSystem.recomputeGroups() →  SOCIAL_GROUPS_UPDATE   →  ❌ SIN SUSCRIPTORES
(NINGUNO EMITE)                →  SOCIAL_RALLY           →  CardDialogueSystem (addRecentEvent)
                                                            ⚠️ NUNCA SE EMITE
(NINGUNO EMITE)                →  SOCIAL_RELATION_CHANGED→  ⚠️ NUNCA SE EMITE
```

### 2.8 Eventos de Matrimonio

```
EMISORES                          EVENTO                      SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────
MarriageSystem.proposeMarriage()    → MARRIAGE_PROPOSED      → ❌ SIN SUSCRIPTORES
MarriageSystem.acceptProposal()     → MARRIAGE_ACCEPTED      → ❌ SIN SUSCRIPTORES
MarriageSystem.acceptProposal()     → MARRIAGE_GROUP_FORMED  → ❌ SIN SUSCRIPTORES
MarriageSystem.acceptProposal()     → MARRIAGE_MEMBER_JOINED → ❌ SIN SUSCRIPTORES
MarriageSystem.rejectProposal()     → MARRIAGE_REJECTED      → ❌ SIN SUSCRIPTORES
MarriageSystem.processDivorce()     → DIVORCE_COMPLETED      → ❌ SIN SUSCRIPTORES
MarriageSystem.handleSpouseDeath()  → WIDOWHOOD_REGISTERED   → ❌ SIN SUSCRIPTORES
(NINGUNO EMITE)                     → DIVORCE_INITIATED      → ⚠️ NUNCA SE EMITE
(NINGUNO EMITE)                     → MARRIAGE_MEMBER_LEFT   → ⚠️ NUNCA SE EMITE
```

### 2.9 Eventos de Tareas

```
EMISORES                          EVENTO                      SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────
TaskSystem.createTask()         →  TASK_CREATED           →  ❌ SIN SUSCRIPTORES
TaskSystem.contributeToTask()   →  TASK_PROGRESS          →  ❌ SIN SUSCRIPTORES
TaskSystem.contributeToTask()   →  TASK_COMPLETED         →  ❌ SIN SUSCRIPTORES
TaskSystem.update()             →  TASK_STALLED           →  SimulationRunner (failCurrentGoal)
```

### 2.10 Eventos de Quests

```
EMISORES                          EVENTO                      SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────
QuestSystem.startQuest()        →  QUEST_STARTED          →  ❌ SIN SUSCRIPTORES
QuestSystem.completeQuest()     →  QUEST_COMPLETED        →  ❌ SIN SUSCRIPTORES
QuestSystem.failQuest()         →  QUEST_FAILED           →  ❌ SIN SUSCRIPTORES
```

### 2.11 Eventos de Comercio

```
EMISORES                          EVENTO                      SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────
TradeSystem.createOffer()       →  TRADE_OFFER_CREATED    →  ❌ SIN SUSCRIPTORES
TradeSystem.acceptOffer()       →  TRADE_COMPLETED        →  ❌ SIN SUSCRIPTORES
TradeSystem.rejectOffer()       →  TRADE_REJECTED         →  ❌ SIN SUSCRIPTORES
```

### 2.12 Eventos de Household (Vivienda)

```
EMISORES                          EVENTO                           SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────────
HouseholdSystem.update()        →  HOUSEHOLD_HIGH_OCCUPANCY     → GovernanceSystem.handleHighOccupancy()
HouseholdSystem.update()        →  HOUSEHOLD_AGENTS_HOMELESS    → GovernanceSystem.handleHomeless()
HouseholdSystem.assignToHouse() →  HOUSEHOLD_NO_FREE_HOUSES     → GovernanceSystem.handleNoHouses()
HouseholdSystem.assignToHouse() →  HOUSEHOLD_AGENT_ASSIGNED     → ❌ SIN SUSCRIPTORES
HouseholdSystem.depositResources()→ HOUSEHOLD_RESOURCE_DEPOSITED→ ❌ SIN SUSCRIPTORES
HouseholdSystem.withdrawResources()→HOUSEHOLD_RESOURCE_WITHDRAWN→ ❌ SIN SUSCRIPTORES
```

### 2.13 Eventos de Tiempo

```
EMISORES                          EVENTO                      SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────
TimeSystem.update()             →  TIME_CHANGED            →  ❌ SIN SUSCRIPTORES
TimeSystem.updateWeather()      →  TIME_WEATHER_CHANGED    →  ❌ SIN SUSCRIPTORES
```

### 2.14 Eventos de Economía/Producción

```
EMISORES                          EVENTO                           SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────────
EconomySystem.update()              → ECONOMY_RESERVATIONS_UPDATE → ❌ SIN SUSCRIPTORES
ResourceReservationSystem.update()  → ECONOMY_RESERVATIONS_UPDATE → ❌ SIN SUSCRIPTORES
EconomySystem.paySalaries()         → SALARY_PAID                 → ❌ SIN SUSCRIPTORES
ProductionSystem.generateOutput()   → PRODUCTION_OUTPUT_GENERATED → ❌ SIN SUSCRIPTORES
ProductionSystem.handleAgentDeath() → PRODUCTION_WORKER_REMOVED   → ❌ SIN SUSCRIPTORES
```

### 2.15 Eventos de Conocimiento

```
EMISORES                          EVENTO                      SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────
KnowledgeNetworkSystem.addKnowledge()   → KNOWLEDGE_ADDED    → ❌ SIN SUSCRIPTORES
KnowledgeNetworkSystem.learnKnowledge() → KNOWLEDGE_LEARNED  → ❌ SIN SUSCRIPTORES
KnowledgeNetworkSystem.shareKnowledge() → KNOWLEDGE_SHARED   → ❌ SIN SUSCRIPTORES
```

### 2.16 Eventos de Roles

```
EMISORES                          EVENTO                      SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────
RoleSystem.update()             →  ROLE_SHIFT_CHANGED      →  ❌ SIN SUSCRIPTORES
RoleSystem.assignRole()         →  ROLE_ASSIGNED           →  ❌ SIN SUSCRIPTORES
RoleSystem.update()             →  ROLE_REASSIGNED         →  ❌ SIN SUSCRIPTORES
```

### 2.17 Eventos de Emergencia y Patrones

```
EMISORES                          EVENTO                      SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────
EmergenceSystem.update()           → EMERGENCE_PATTERN_DETECTED → ❌ SIN SUSCRIPTORES
EmergenceSystem.update()           → EMERGENCE_METRICS_UPDATED  → ❌ SIN SUSCRIPTORES
(NINGUNO EMITE)                    → EMERGENCE_PATTERN_ACTIVE   → ⚠️ NUNCA SE EMITE
CrisisPredictorSystem.update()     → CRISIS_PREDICTION          → ❌ SIN SUSCRIPTORES
CrisisPredictorSystem.update()     → CRISIS_IMMEDIATE_WARNING   → ❌ SIN SUSCRIPTORES
```

### 2.18 Eventos de Diálogo

```
EMISORES                          EVENTO                      SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────
CardDialogueSystem.flushQueue()      → DIALOGUE_SHOW_CARD       → ❌ SIN SUSCRIPTORES
CardDialogueSystem.cleanupExpired()  → DIALOGUE_CARD_EXPIRED    → ❌ SIN SUSCRIPTORES
CardDialogueSystem.respondToCard()   → DIALOGUE_CARD_RESPONDED  → SimulationRunner (questSystem)
```

### 2.19 Eventos de Animales

```
EMISORES                          EVENTO                       SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────
AnimalSystem.removeAnimal()      →  ANIMAL_DIED              → ❌ SIN SUSCRIPTORES
AnimalSpawning.spawnAnimal()     →  ANIMAL_SPAWNED           → ❌ SIN SUSCRIPTORES
AnimalBehavior (consumeResource) →  ANIMAL_CONSUMED_RESOURCE → ❌ SIN SUSCRIPTORES
AnimalBehavior (reproduce)       →  ANIMAL_REPRODUCED        → ❌ SIN SUSCRIPTORES
CombatSystem.update()            →  ANIMAL_HUNTED            → SimulationRunner (inventory)
                                                                AnimalSystem (removeAnimal)
```

### 2.20 Eventos de Items y Crafting

```
EMISORES                          EVENTO                      SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────
ItemGenerationSystem.generateItem() → ITEM_GENERATED         → ❌ SIN SUSCRIPTORES
ItemGenerationSystem.collectItem()  → ITEM_COLLECTED         → ❌ SIN SUSCRIPTORES
AISystem.notifyEntityArrived()      → ITEM_CRAFTED           → ❌ SIN SUSCRIPTORES
EnhancedCraftingSystem.startJob()   → CRAFTING_JOB_STARTED   → ❌ SIN SUSCRIPTORES
EnhancedCraftingSystem.completeJob()→ CRAFTING_JOB_COMPLETED → ❌ SIN SUSCRIPTORES
```

### 2.21 Otros Eventos

```
EMISORES                          EVENTO                      SUSCRIPTORES
─────────────────────────────────────────────────────────────────────────────
AISystem.processAgent()          →  AGENT_GOAL_CHANGED       →  ❌ SIN SUSCRIPTORES
AISystem.processAgent()          →  AGENT_ACTION_COMMANDED   →  ❌ SIN SUSCRIPTORES
(NINGUNO EMITE)                  →  AGENT_ACTIVITY_STARTED   →  ⚠️ DEFINIDO PERO NO IMPLEMENTADO
                                                                (AISystem emite pero internamente)
GovernanceSystem.pushSnapshot()  →  GOVERNANCE_UPDATE        →  ❌ SIN SUSCRIPTORES
(NINGUNO EMITE)                  →  GOVERNANCE_ACTION        →  ⚠️ NUNCA SE EMITE
DivineFavorSystem.grantBlessing()→  DIVINE_BLESSING_GRANTED  →  ❌ SIN SUSCRIPTORES
NormsSystem.recordViolation()    →  NORM_VIOLATED            →  ❌ SIN SUSCRIPTORES
NormsSystem.applySanction()      →  NORM_SANCTION_APPLIED    →  ❌ SIN SUSCRIPTORES
ConflictResolutionSystem         →  CONFLICT_TRUCE_PROPOSED  →  ❌ SIN SUSCRIPTORES
ConflictResolutionSystem         →  CONFLICT_TRUCE_ACCEPTED  →  ❌ SIN SUSCRIPTORES
ConflictResolutionSystem         →  CONFLICT_TRUCE_REJECTED  →  ❌ SIN SUSCRIPTORES
ReputationSystem.update()        →  REPUTATION_UPDATED       →  LivingLegendsSystem.handleReputationChange()
InteractionGameSystem.update()   →  INTERACTION_GAME_PLAYED  →  ❌ SIN SUSCRIPTORES
ReputationSystem.recordInteraction()→INTERACTION_GAME_PLAYED →  ❌ SIN SUSCRIPTORES
LivingLegendsSystem              →  LEGEND_UPDATE            →  ❌ SIN SUSCRIPTORES
LifeCycleSystem.tryCouple()      →  REPRODUCTION_SUCCESS     →  CardDialogueSystem (addRecentEvent)
(NINGUNO EMITE)                  →  REPRODUCTION_ATTEMPT     →  ⚠️ NUNCA SE EMITE
(NINGUNO EMITE)                  →  INHERITANCE_RECEIVED     →  ⚠️ NUNCA SE EMITE
(NINGUNO EMITE)                  →  INVENTORY_DROPPED        →  ⚠️ NUNCA SE EMITE
AppearanceGenerationSystem       →  APPEARANCE_GENERATED     →  ❌ SIN SUSCRIPTORES
AppearanceGenerationSystem       →  APPEARANCE_UPDATED       →  ❌ SIN SUSCRIPTORES
AISystem.tryDepositResources()   →  RESOURCES_DEPOSITED      →  ❌ SIN SUSCRIPTORES
(NINGUNO EMITE)                  →  CHUNK_RENDERED           →  ⚠️ NUNCA SE EMITE (frontend)
```

---

## 3. Diagrama de Flujo Principal del Sistema

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CICLO DE TICK                                   │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. SimulationRunner.step()                                                 │
│     - Reconstruir índices (EntityIndex, SharedSpatialIndex)                │
│     - Procesar comandos del cliente                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. PRIMERA FASE: Sistemas Base (Paralelo)                                  │
│     ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐            │
│     │WorldResource    │ │AnimalSystem     │ │TimeSystem       │            │
│     │System.update()  │ │.update()        │ │.update()        │            │
│     └────────┬────────┘ └────────┬────────┘ └────────┬────────┘            │
│              │                   │                   │                      │
│     ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐            │
│     │TrailSystem      │ │ItemGeneration   │ │ReputationSystem │            │
│     │.update()        │ │System.update()  │ │.update()        │            │
│     └────────┬────────┘ └────────┬────────┘ └────────┬────────┘            │
│              │                   │                   │                      │
│     ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐            │
│     │ResearchSystem   │ │EmergenceSystem  │ │ProductionSystem │            │
│     │.update()        │ │.update()        │ │.update()        │            │
│     └─────────────────┘ └─────────────────┘ └─────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. SEGUNDA FASE: Ciclo de Vida y Recursos                                  │
│     ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐            │
│     │LivingLegends    │ │LifeCycleSystem  │ │InventorySystem  │            │
│     │System.update()  │ │.update()        │ │.update()        │            │
│     └────────┬────────┘ └────────┬────────┘ └────────┬────────┘            │
│              │                   │                   │                      │
│     Escucha:              Emite:             Gestiona:                     │
│     REPUTATION_UPDATED    AGENT_BIRTH        Inventarios de agentes        │
│     AGENT_ACTION_COMPLETE AGENT_DEATH                                      │
│                           AGENT_AGED                                       │
│                           REPRODUCTION_SUCCESS                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. TERCERA FASE: Necesidades y Social                                      │
│     ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐            │
│     │NeedsSystem      │ │SocialSystem     │ │EconomySystem    │            │
│     │.update()        │ │.update()        │ │.update()        │            │
│     └────────┬────────┘ └────────┬────────┘ └────────┬────────┘            │
│              │                   │                   │                      │
│     Emite:              Emite:              Emite:                         │
│     AGENT_DEATH         SOCIAL_TRUCE_*      SALARY_PAID                    │
│     AGENT_RESPAWNED     SOCIAL_GROUPS_*     ECONOMY_RESERVATIONS_*         │
│     NEED_CRITICAL                                                          │
│     NEED_SATISFIED                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. CUARTA FASE: AI y Roles                                                 │
│     ┌─────────────────┐ ┌─────────────────┐                                │
│     │RoleSystem       │ │AISystem         │                                │
│     │.update()        │ │.update()        │                                │
│     └────────┬────────┘ └────────┬────────┘                                │
│              │                   │                                          │
│     Emite:              Emite:                                             │
│     ROLE_ASSIGNED       AGENT_GOAL_CHANGED                                 │
│     ROLE_REASSIGNED     AGENT_ACTION_COMMANDED                             │
│     ROLE_SHIFT_CHANGED  ITEM_CRAFTED                                       │
│                         RESOURCES_DEPOSITED                                │
│                         AGENT_ACTIVITY_STARTED                             │
│                                                                             │
│     Escucha:            Escucha:                                           │
│     (ninguno)           AGENT_ACTION_COMPLETE                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  6. QUINTA FASE: Infraestructura                                            │
│     ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐            │
│     │GovernanceSystem │ │BuildingSystem   │ │HouseholdSystem  │            │
│     │.update()        │ │.update()        │ │.update()        │            │
│     └────────┬────────┘ └────────┬────────┘ └────────┬────────┘            │
│              │                   │                   │                      │
│     Escucha:            Emite:              Emite:                         │
│     HOUSEHOLD_*         BUILDING_*          HOUSEHOLD_*                    │
│                                                                             │
│     Emite:                                                                  │
│     GOVERNANCE_UPDATE                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  7. SEXTA FASE: Combate y Tareas                                            │
│     ┌─────────────────┐ ┌─────────────────┐                                │
│     │CombatSystem     │ │TaskSystem       │                                │
│     │.update()        │ │.update()        │                                │
│     └────────┬────────┘ └────────┬────────┘                                │
│              │                   │                                          │
│     Emite:              Emite:                                             │
│     COMBAT_*            TASK_*                                             │
│     ANIMAL_HUNTED       TASK_STALLED                                       │
│     COMBAT_KILL                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  8. SÉPTIMA FASE: Sistemas Secundarios                                      │
│     ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐            │
│     │QuestSystem      │ │TradeSystem      │ │MarriageSystem   │            │
│     │.update()        │ │.update()        │ │.update()        │            │
│     └─────────────────┘ └─────────────────┘ └─────────────────┘            │
│                                                                             │
│     ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐            │
│     │ConflictRes.     │ │CardDialogue     │ │InteractionGame  │            │
│     │System.update()  │ │System.update()  │ │System.update()  │            │
│     └─────────────────┘ └─────────────────┘ └─────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  9. ÚLTIMA FASE: Movimiento                                                 │
│     ┌─────────────────┐                                                    │
│     │MovementSystem   │                                                    │
│     │.update()        │                                                    │
│     └────────┬────────┘                                                    │
│              │                                                              │
│     Emite:                                                                  │
│     MOVEMENT_ARRIVED_AT_ZONE                                               │
│     MOVEMENT_ACTIVITY_COMPLETED                                            │
│     MOVEMENT_ACTIVITY_STARTED                                              │
│     AGENT_ACTION_COMPLETE                                                  │
│     PATHFINDING_FAILED                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  10. FIN DE TICK                                                            │
│      - simulationEvents.flushEvents()                                       │
│      - Emitir snapshot al frontend                                          │
│      - Limpiar capturedEvents                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Problemas Identificados

### 4.1 ⚠️ Eventos que NUNCA se Emiten (Definidos pero sin emisor)

| Evento | Observación |
|--------|-------------|
| `SOCIAL_RALLY` | CardDialogueSystem lo escucha pero nadie lo emite |
| `SOCIAL_RELATION_CHANGED` | Definido pero nunca emitido |
| `DIVORCE_INITIATED` | Definido pero MarriageSystem no lo usa |
| `MARRIAGE_MEMBER_LEFT` | Definido pero MarriageSystem no lo usa |
| `EMERGENCE_PATTERN_ACTIVE` | Definido, EmergenceSystem usa PATTERN_DETECTED |
| `REPRODUCTION_ATTEMPT` | Solo existe REPRODUCTION_SUCCESS |
| `INHERITANCE_RECEIVED` | Nunca implementado |
| `INVENTORY_DROPPED` | Nunca implementado |
| `GOVERNANCE_ACTION` | Definido pero GovernanceSystem no lo usa |
| `CHUNK_RENDERED` | Probablemente para frontend, no backend |

### 4.2 ⚠️ Eventos sin Suscriptores (Se emiten pero nadie escucha)

**Críticos (potencial funcionalidad perdida):**
- `AGENT_AGED` - No hay reacciones a cuando un agente envejece
- `NEED_SATISFIED` - Oportunidad perdida para optimizaciones
- `BUILDING_CONSTRUCTION_STARTED` - No hay tracking del inicio
- `TASK_CREATED`, `TASK_PROGRESS`, `TASK_COMPLETED` - Solo TASK_STALLED tiene listener

**Informativos (probablemente para el frontend):**
- `TIME_CHANGED`, `TIME_WEATHER_CHANGED`
- `KNOWLEDGE_*` eventos
- `ROLE_*` eventos
- `QUEST_*` eventos
- `TRADE_*` eventos
- `DIALOGUE_SHOW_CARD`, `DIALOGUE_CARD_EXPIRED`

### 4.3 ⚠️ Conexiones Rotas o Inconsistentes

1. **✅ CORREGIDO: AISystem → MovementSystem conectado:**
   ```
   Antes: AISystem.notifyEntityArrived() no se llamaba automáticamente
   Ahora: SimulationRunner escucha MOVEMENT_ARRIVED_AT_ZONE y llama a
         AISystem.notifyEntityArrived(entityId, zoneId)
   ```
   **Estado:** Corregido en esta revisión.

2. **QuestSystem no escucha eventos directamente:**
   ```
   QuestSystem.handleEvent() debe ser llamado manualmente
   SimulationRunner lo hace para algunos eventos, pero no todos
   ```
   **Impacto:** Quests podrían no progresar con todas las acciones.

3. **ANIMAL_HUNTED doble emisión:**
   ```
   CombatSystem emite ANIMAL_HUNTED
   AnimalSystem también escucha pero no para eliminar, sino
   para registrar la caza.
   ```

### 4.4 ⚠️ Dependencias Circulares Potenciales

```
AISystem
    ↓ (usa)
NeedsSystem
    ↓ (en respawn, necesita)
AISystem (para reactivar)
```

**Solución actual:** SimulationRunner maneja el ciclo a través de eventos.

### 4.5 ⚠️ Sistemas sin Integración Completa

| Sistema | Problema |
|---------|----------|
| `KnowledgeNetworkSystem` | Emite eventos pero nadie los usa |
| `NormsSystem` | `NORM_VIOLATED` y `NORM_SANCTION_APPLIED` sin listeners |
| `ConflictResolutionSystem` | Todos los eventos de tregua sin listeners |
| `CrisisPredictorSystem` | Predice crisis pero nadie reacciona |
| `EmergenceSystem` | Detecta patrones pero nadie actúa |

---

## 5. Diagrama de Dependencias entre Sistemas

```
                    ┌───────────────────┐
                    │  SimulationRunner │
                    │   (Orquestador)   │
                    └─────────┬─────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
    ▼                         ▼                         ▼
┌─────────┐           ┌─────────────┐           ┌─────────────┐
│LifeCycle│◄─────────►│  NeedsSystem │◄─────────►│  AISystem   │
│ System  │           │              │           │             │
└────┬────┘           └──────┬───────┘           └──────┬──────┘
     │                       │                          │
     │                       │                          │
     ▼                       ▼                          ▼
┌─────────┐           ┌─────────────┐           ┌─────────────┐
│Genealogy│           │Inventory    │           │ Movement    │
│ System  │           │System       │           │ System      │
└─────────┘           └──────┬──────┘           └──────┬──────┘
                             │                         │
                             ▼                         │
                      ┌─────────────┐                  │
                      │ Household   │◄─────────────────┘
                      │ System      │
                      └──────┬──────┘
                             │
                             ▼
                      ┌─────────────┐
                      │ Governance  │
                      │ System      │
                      └─────────────┘


┌─────────────────────────────────────────────────────────────────┐
│  FLUJO DE AGENTES Y NECESIDADES                                 │
│                                                                  │
│  LifeCycleSystem.spawnAgent()                                   │
│         │                                                        │
│         ├──► NeedsSystem.initializeEntityNeeds()                │
│         ├──► InventorySystem.initializeAgentInventory()         │
│         ├──► MovementSystem.initializeEntityMovement()          │
│         └──► EMIT: AGENT_BIRTH                                  │
│                    │                                             │
│                    ▼                                             │
│         SimulationRunner.setupEventListeners()                  │
│                    │                                             │
│                    ├──► GenealogySystem.registerBirth()         │
│                    └──► AppearanceGenerationSystem.generate()   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│  FLUJO DE MUERTE                                                │
│                                                                  │
│  NeedsSystem detecta necesidad crítica (hunger=0)               │
│         │                                                        │
│         └──► handleEntityDeath()                                │
│                    │                                             │
│                    └──► EMIT: AGENT_DEATH                       │
│                              │                                   │
│                              ▼                                   │
│         SimulationRunner.setupEventListeners()                  │
│                    │                                             │
│                    ├──► EntityIndex.markEntityDead()            │
│                    ├──► GenealogySystem.recordDeath()           │
│                    └──► EntityIndex.removeEntity()              │
│                                                                  │
│         Si allowRespawn=true:                                   │
│         NeedsSystem.scheduleRespawn()                           │
│                    │                                             │
│                    └──► (30s después) respawnEntity()           │
│                              │                                   │
│                              └──► EMIT: AGENT_RESPAWNED         │
│                                         │                        │
│                                         ▼                        │
│                    SimulationRunner.setupEventListeners()       │
│                              │                                   │
│                              ├──► AISystem.setAgentOffDuty(false)│
│                              └──► MovementSystem.initialize...  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Recomendaciones

### 6.1 Alta Prioridad

1. **✅ IMPLEMENTADO: Conectar `MOVEMENT_ARRIVED_AT_ZONE` con `AISystem.notifyEntityArrived()`**
   ```typescript
   // En SimulationRunner.setupEventListeners() - YA IMPLEMENTADO
   simulationEvents.on(GameEventNames.MOVEMENT_ARRIVED_AT_ZONE, (data) => {
     this.aiSystem.notifyEntityArrived(data.entityId, data.zoneId);
   });
   ```

2. **Agregar listener para `AGENT_AGED`**
   ```typescript
   // Permitir que otros sistemas reaccionen a cambios de etapa de vida
   simulationEvents.on(GameEventNames.AGENT_AGED, (data) => {
     if (data.currentStage === 'adult' && data.previousStage === 'child') {
       // Trigger housing assignment, role eligibility, etc.
     }
   });
   ```

3. **Implementar o eliminar eventos muertos**
   - `SOCIAL_RALLY` - O implementar emisión o quitar listener
   - `DIVORCE_INITIATED` - Implementar en MarriageSystem si se necesita

### 6.2 Media Prioridad

4. **Conectar `CrisisPredictorSystem` con `AISystem`**
   - Los agentes deberían reaccionar a crisis predichas

5. **Conectar `EmergenceSystem` con `GovernanceSystem`**
   - Patrones emergentes deberían influir en políticas

6. **Agregar listeners para eventos de Tareas**
   - `TASK_COMPLETED` podría otorgar experiencia, reputación, etc.

### 6.3 Baja Prioridad (Limpieza)

7. **Eliminar eventos nunca emitidos del `GameEventNames`**
   - `CHUNK_RENDERED` (si es solo frontend)
   - `INHERITANCE_RECEIVED`
   - `INVENTORY_DROPPED`
   - `REPRODUCTION_ATTEMPT`

8. **Documentar eventos intencionalmente "informativos"**
   - Marcar claramente cuáles son solo para el frontend

---

## 7. Estadísticas de Eventos

| Categoría | Cantidad | Porcentaje |
|-----------|----------|------------|
| Total de eventos definidos | 114 | 100% |
| Eventos con suscriptores | ~25 | ~22% |
| Eventos solo para frontend | ~45 | ~40% |
| Eventos sin uso aparente | ~35 | ~30% |
| Eventos nunca emitidos | ~10 | ~8% |

### Eventos por Sistema (emisión)

| Sistema | Eventos Emitidos |
|---------|-----------------|
| MovementSystem | 5 |
| NeedsSystem | 4 |
| CombatSystem | 6 |
| SocialSystem | 4 |
| BuildingSystem | 2 |
| TaskSystem | 4 |
| LifeCycleSystem | 5 |
| AISystem | 5 |
| MarriageSystem | 9 |
| AnimalSystem/Behavior | 6 |

---

## 8. Correcciones Realizadas en Esta Revisión

### 8.1 ✅ Conexión MOVEMENT_ARRIVED_AT_ZONE → AISystem

**Archivo:** `src/domain/simulation/core/SimulationRunner.ts`

**Problema:** El evento `MOVEMENT_ARRIVED_AT_ZONE` se emitía pero nadie lo escuchaba, 
causando que `AISystem.notifyEntityArrived()` nunca se llamara.

**Solución:** Agregado listener en `setupEventListeners()`:
```typescript
simulationEvents.on(
  GameEventNames.MOVEMENT_ARRIVED_AT_ZONE,
  (data: { entityId: string; zoneId: string }) => {
    this.aiSystem.notifyEntityArrived(data.entityId, data.zoneId);
  },
);
```

**Impacto:** Los agentes ahora correctamente:
- Completan actividades cuando llegan a una zona
- Depositan recursos cuando corresponde
- Ejecutan acciones de crafteo
- Reciben bonificaciones sociales por rol (ej: guardias imponen treguas)

---

## 9. Conclusión

El sistema tiene una arquitectura de eventos bien diseñada pero con varias desconexiones:

- **~40%** de los eventos definidos no tienen suscriptores internos (la mayoría son para frontend)
- **~8%** de los eventos nunca se emiten (código muerto)
- **✅ Conexión crítica corregida:** `MOVEMENT_ARRIVED_AT_ZONE` → `AISystem`

La mayoría de los eventos "sin suscriptor" probablemente están diseñados para el frontend, pero algunos representan funcionalidad incompleta que debería ser conectada para que la simulación funcione correctamente.

### Próximos Pasos Sugeridos

1. Eliminar eventos que nunca se emiten (SOCIAL_RALLY, DIVORCE_INITIATED, etc.)
2. Conectar CrisisPredictorSystem con respuestas del AISystem
3. Agregar listeners para TASK_COMPLETED para otorgar recompensas
4. Revisar si AGENT_AGED debería tener efectos en otros sistemas

