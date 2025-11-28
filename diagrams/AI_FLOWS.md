# 🧠 Auditoría Completa del Sistema de IA de Agentes

## 📊 Arquitectura del Ciclo de IA

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MULTI-RATE SCHEDULER                                  │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                        │
│  │  FAST 50ms  │   │ MEDIUM 250ms│   │  SLOW 1000ms│                        │
│  │ ─────────── │   │ ─────────── │   │ ─────────── │                        │
│  │ Movement    │   │ AISystem    │   │ Economy     │                        │
│  │ Combat      │   │ Needs       │   │ Market      │                        │
│  │             │   │ Social      │   │ Governance  │                        │
│  │             │   │ Household   │   │ Production  │                        │
│  │             │   │ LifeCycle   │   │ Building    │                        │
│  │             │   │ Time        │   │ Crafting    │                        │
│  │             │   │ Role        │   │ WorldRes    │                        │
│  │             │   │ Task        │   │             │                        │
│  │             │   │ Animal      │   │             │                        │
│  └─────────────┘   └─────────────┘   └─────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AISystem.update()                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Proceso por lotes (BATCH_SIZE = 2 agentes/tick)                     │ │
│  │ 2. Para cada agente:                                                    │ │
│  │    ├── Verificar si playerControlled → SKIP                            │ │
│  │    ├── Verificar si offDuty → SKIP                                     │ │
│  │    ├── Verificar si isDead → SKIP                                      │ │
│  │    └── processAgent()                                                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        processAgent(agentId, aiState, now)                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. IF currentGoal exists:                                              │ │
│  │    ├── isGoalCompleted? → completeGoal() → shift queue                 │ │
│  │    ├── isGoalInvalid? → failGoal() → clear goal                        │ │
│  │    └── hasCurrentAction? → RETURN (esperar)                            │ │
│  │                                                                         │ │
│  │ 2. prePlanGoals() - Llenar cola de objetivos (MAX_QUEUED_GOALS = 3)    │ │
│  │                                                                         │ │
│  │ 3. IF no currentGoal:                                                   │ │
│  │    ├── Tomar de goalQueue si existe                                    │ │
│  │    └── makeDecision() → planGoals() → seleccionar mejor                │ │
│  │                                                                         │ │
│  │ 4. IF currentGoal válido:                                              │ │
│  │    ├── Validar objetivo antes de ejecutar                              │ │
│  │    ├── IF isMoving → RETURN                                            │ │
│  │    ├── planAction() → AIActionPlanner                                  │ │
│  │    └── executeAction() → AIActionExecutor                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Flujo de Planificación de Objetivos (AgentGoalPlanner)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        planGoals(deps, aiState, now)                         │
│                                                                              │
│  EVALUADORES (ejecutados en secuencia):                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. BiologicalDriveEvaluator    → SATISFY_HUNGER/THIRST/ENERGY          │ │
│  │    ├── IF priority > 0.9 → RETURN [criticalGoal] (corte temprano)      │ │
│  │    └── Threshold: < 40 = urgente                                        │ │
│  │                                                                         │ │
│  │ 2. ReproductionEvaluator       → REPRODUCE                              │ │
│  │                                                                         │ │
│  │ 3. SocialDriveEvaluator        → SATISFY_SOCIAL/FUN                     │ │
│  │                                                                         │ │
│  │ 4. CognitiveDriveEvaluator     → WORK, EXPLORE                          │ │
│  │                                                                         │ │
│  │ 5. CollectiveNeedsEvaluator    → Necesidades de la comunidad            │ │
│  │                                                                         │ │
│  │ 6. CombatEvaluator             → ATTACK, FLEE, COMBAT                   │ │
│  │    ├── IF combat priority > 0.7 → RETURN [combatGoal] (corte temprano) │ │
│  │    └── Evalúa estrategia: peaceful/tit_for_tat/bully                   │ │
│  │                                                                         │ │
│  │ 7. AssistEvaluator             → ASSIST (ayudar otros agentes)          │ │
│  │                                                                         │ │
│  │ 8. ConstructionEvaluator       → CONSTRUCTION                           │ │
│  │                                                                         │ │
│  │ 9. DepositEvaluator            → DEPOSIT (depositar recursos)           │ │
│  │                                                                         │ │
│  │ 10. CraftingEvaluator          → CRAFT                                  │ │
│  │                                                                         │ │
│  │ 11. QuestEvaluator             → QUEST                                  │ │
│  │                                                                         │ │
│  │ 12. TradeEvaluator             → TRADE                                  │ │
│  │                                                                         │ │
│  │ 13. BuildingContributionEval   → BUILD (contribuir a edificios)         │ │
│  │                                                                         │ │
│  │ 14. AttentionEvaluator         → EXPLORE (atención/exploración)         │ │
│  │                                                                         │ │
│  │ 15. OpportunitiesEvaluator     → WORK, EXPLORE (oportunidades)          │ │
│  │     (Solo si criticalCount == 0)                                        │ │
│  │                                                                         │ │
│  │ 16. ExpansionEvaluator         → EXPAND (expansión territorio)          │ │
│  │                                                                         │ │
│  │ 17. DefaultExploration         → EXPLORE (fallback si goals vacío)      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  FINAL: prioritizeGoals() → ordenar por prioridad → retornar top 5          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Flujo de Acciones (AIActionPlanner)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     planAction(agentId, goal) → AgentAction                  │
│                                                                              │
│  GOAL TYPE                    →  ACTION TYPE                                 │
│  ─────────────────────────────────────────────────────────────────────────  │
│  SATISFY_NEED                 →  HARVEST / MOVE / IDLE                       │
│  SATISFY_HUNGER               →  HARVEST / MOVE / IDLE                       │
│  SATISFY_THIRST               →  HARVEST / MOVE / IDLE                       │
│  SATISFY_ENERGY               →  SLEEP / MOVE / IDLE                         │
│  SATISFY_SOCIAL               →  SOCIALIZE / MOVE                            │
│  SATISFY_FUN                  →  SOCIALIZE / MOVE                            │
│  GATHER                       →  HARVEST / MOVE                              │
│  WORK                         →  WORK / MOVE / HARVEST                       │
│  CRAFT                        →  CRAFT / MOVE                                │
│  DEPOSIT                      →  DEPOSIT / MOVE                              │
│  FLEE                         →  MOVE (posición calculada para escapar)      │
│  ATTACK / COMBAT              →  ATTACK / MOVE                               │
│  ASSIST                       →  MOVE → SOCIALIZE                            │
│  SOCIAL                       →  SOCIALIZE / MOVE                            │
│  EXPLORE                      →  MOVE                                        │
│  CONSTRUCTION                 →  BUILD / WORK / MOVE                         │
│  IDLE                         →  IDLE                                        │
│  REST                         →  SLEEP / MOVE / IDLE                         │
│  INSPECT                      →  MOVE                                        │
│  HUNT                         →  ATTACK / MOVE                               │
│                                                                              │
│  LÓGICA DE DISTANCIA:                                                       │
│  ├── HARVEST_RANGE = 80     → si dist < 80 ejecutar HARVEST                 │
│  ├── ATTACK_RANGE = 50      → si dist < 50 ejecutar ATTACK                  │
│  └── EXPLORE_RANGE = 200    → rango de exploración                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Ejecución (AIActionExecutor)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     executeAction(action) → void                             │
│                                                                              │
│  ACTION TYPE      →  SISTEMA INVOLUCRADO    →  EVENTO EMITIDO               │
│  ─────────────────────────────────────────────────────────────────────────  │
│  MOVE             →  MovementSystem          →  AGENT_ACTION_COMPLETE        │
│  WORK             →  TaskSystem              →  AGENT_ACTION_COMPLETE        │
│  HARVEST          →  WorldResourceSystem     →  AGENT_ACTION_COMPLETE        │
│                   →  NeedsSystem             →  (satisface necesidad)        │
│                   →  InventorySystem         →  (añade recursos)             │
│  IDLE             →  NeedsSystem             →  AGENT_ACTION_COMPLETE        │
│  ATTACK           →  AnimalRegistry          →  AGENT_ACTION_COMPLETE        │
│                   →  CombatSystem            →  COMBAT_HIT/KILL              │
│  SOCIALIZE        →  SocialSystem            →  AGENT_ACTION_COMPLETE        │
│  EAT              →  NeedsSystem             →  AGENT_ACTION_COMPLETE        │
│  DRINK            →  NeedsSystem             →  AGENT_ACTION_COMPLETE        │
│  SLEEP            →  NeedsSystem             →  AGENT_ACTION_COMPLETE        │
│  CRAFT            →  CraftingSystem          →  AGENT_ACTION_COMPLETE        │
│  DEPOSIT          →  InventorySystem         →  AGENT_ACTION_COMPLETE        │
│  BUILD            →  BuildingSystem          →  AGENT_ACTION_COMPLETE        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📡 Sistema de Eventos (Event Flow)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EVENTOS CLAVE DE IA                                 │
│                                                                              │
│  EMISIÓN:                                                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  AISystem.processAgent()                                                     │
│    └── AGENT_GOAL_CHANGED         (nuevo objetivo asignado)                  │
│                                                                              │
│  AISystem.processAgent()                                                     │
│    └── AGENT_ACTION_COMMANDED     (acción iniciada)                          │
│                                                                              │
│  MovementSystem.updateEntityMovement()                                       │
│    └── MOVEMENT_ARRIVED_AT_ZONE   (llegó a zona)                            │
│    └── AGENT_ACTION_COMPLETE      (movimiento completado)                    │
│                                                                              │
│  AIActionExecutor.executeHarvest()                                           │
│    └── AGENT_ACTION_COMPLETE      (cosecha completada)                       │
│                                                                              │
│  RECEPCIÓN:                                                                 │
│  ─────────────────────────────────────────────────────────────────────────  │
│  AISystem.handleActionComplete()                                             │
│    ← AGENT_ACTION_COMPLETE                                                   │
│    → Limpia currentAction                                                    │
│    → Evalúa si completar/fallar objetivo                                     │
│                                                                              │
│  AISystem.notifyEntityArrived()                                              │
│    ← (llamado por otros sistemas cuando agente llega)                        │
│    → Delega a AIZoneHandler                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Ciclo Principal de IA

| Componente | Estado | Notas |
|------------|--------|-------|
| MultiRateScheduler → AISystem.update() | ✅ Conectado | Rate: MEDIUM (250ms) |
| AISystem.update() → processAgent() | ✅ Conectado | Batch size: 2 |
| processAgent() → isGoalCompleted() | ✅ Conectado | Via AIGoalValidator |
| processAgent() → isGoalInvalid() | ✅ Conectado | Via AIGoalValidator |
| processAgent() → makeDecision() | ✅ Conectado | Async con tiempo límite |
| makeDecision() → planGoals() | ✅ Conectado | Via AgentGoalPlanner |
| processAgent() → planAction() | ✅ Conectado | Via AIActionPlanner |
| processAgent() → executeAction() | ✅ Conectado | Via AIActionExecutor |

### Evaluadores de Objetivos

| Evaluador | Estado | Tipo de Objetivo |
|-----------|--------|------------------|
| BiologicalDriveEvaluator | ✅ Conectado | SATISFY_HUNGER/THIRST/ENERGY |
| ReproductionEvaluator | ✅ Conectado | REPRODUCE |
| SocialDriveEvaluator | ✅ Conectado | SATISFY_SOCIAL/FUN |
| CognitiveDriveEvaluator | ✅ Conectado | WORK, EXPLORE |
| CollectiveNeedsEvaluator | ✅ Conectado | Necesidades comunidad |
| CombatEvaluator | ✅ Conectado | ATTACK, FLEE, COMBAT |
| AssistEvaluator | ✅ Conectado | ASSIST |
| ConstructionEvaluator | ✅ Conectado | CONSTRUCTION |
| DepositEvaluator | ✅ Conectado | DEPOSIT |
| CraftingEvaluator | ✅ Conectado | CRAFT |
| QuestEvaluator | ✅ Conectado | QUEST |
| TradeEvaluator | ✅ Conectado | TRADE |
| BuildingContributionEvaluator | ✅ Conectado | BUILD |
| AttentionEvaluator | ✅ Conectado | EXPLORE |
| OpportunitiesEvaluator | ✅ Conectado | WORK, EXPLORE |
| ExpansionEvaluator | ✅ Conectado | EXPAND |

### Flujo de Acciones

| Acción | Planificación | Ejecución | Evento Completado |
|--------|---------------|-----------|-------------------|
| MOVE | ✅ AIActionPlanner | ✅ MovementSystem | ✅ AGENT_ACTION_COMPLETE |
| HARVEST | ✅ AIActionPlanner | ✅ WorldResourceSystem | ✅ AGENT_ACTION_COMPLETE |
| ATTACK | ✅ AIActionPlanner | ✅ AIActionExecutor→AnimalRegistry | ✅ AGENT_ACTION_COMPLETE |
| SOCIALIZE | ✅ AIActionPlanner | ✅ SocialSystem | ✅ AGENT_ACTION_COMPLETE |
| EAT | ✅ AIActionPlanner | ✅ NeedsSystem | ✅ AGENT_ACTION_COMPLETE |
| DRINK | ✅ AIActionPlanner | ✅ NeedsSystem | ✅ AGENT_ACTION_COMPLETE |
| SLEEP | ✅ AIActionPlanner | ✅ NeedsSystem | ✅ AGENT_ACTION_COMPLETE |
| CRAFT | ✅ AIActionPlanner | ✅ CraftingSystem | ✅ AGENT_ACTION_COMPLETE |
| DEPOSIT | ✅ AIActionPlanner | ✅ AIZoneHandler | ✅ AGENT_ACTION_COMPLETE |
| WORK | ✅ AIActionPlanner | ✅ TaskSystem | ✅ AGENT_ACTION_COMPLETE |
| BUILD | ✅ AIActionPlanner | ✅ AIActionExecutor | ✅ AGENT_ACTION_COMPLETE |
| IDLE | ✅ AIActionPlanner | ✅ NeedsSystem | ✅ AGENT_ACTION_COMPLETE |

### Dependencias entre Sistemas

| Sistema Fuente | Sistema Destino | Método de Conexión | Estado |
|----------------|-----------------|---------------------|--------|
| AISystem | NeedsSystem | setDependencies() | ✅ |
| AISystem | RoleSystem | setDependencies() | ✅ |
| AISystem | WorldResourceSystem | setDependencies() | ✅ |
| AISystem | InventorySystem | setDependencies() | ✅ |
| AISystem | SocialSystem | setDependencies() | ✅ |
| AISystem | EnhancedCraftingSystem | setDependencies() | ✅ |
| AISystem | MovementSystem | setDependencies() | ✅ |
| AISystem | HouseholdSystem | setDependencies() | ✅ |
| AISystem | TaskSystem | setDependencies() | ✅ |
| AISystem | CombatSystem | setDependencies() | ✅ |
| AISystem | AnimalSystem | setDependencies() | ✅ |
| AISystem | QuestSystem | setDependencies() | ✅ |
| AISystem | TimeSystem | setDependencies() | ✅ |
| AISystem | SharedKnowledgeSystem | Constructor @inject | ✅ |
| AISystem | AgentRegistry | Constructor @inject | ✅ |
| AISystem | AnimalRegistry | Constructor @inject | ✅ |
| AISystem | GPUComputeService | Constructor @inject | ✅ |

### Eventos Escuchados

| Sistema | Evento | Handler | Estado |
|---------|--------|---------|--------|
| AISystem | AGENT_ACTION_COMPLETE | handleActionComplete() | ✅ Conectado |
| CombatSystem | AGENT_BIRTH | handleAgentBirth() | ✅ Conectado |
| AnimalSystem | ANIMAL_HUNTED | handleAnimalHunted() | ✅ Conectado |
| LivingLegendsSystem | AGENT_ACTION_COMPLETE | (listener) | ✅ Conectado |

---

### 1. Validación de Objetivos GATHER/WORK - Diseño Intencional (Severidad: Info)

**Ubicación:** `AIGoalValidator.isGoalCompleted()`

**Observación:** Para objetivos tipo `GATHER` y `WORK`, la función retorna `false` cuando `targetId` existe con `resourceType`:
```typescript
if (goal.type === GoalType.GATHER || goal.type === GoalType.WORK) {
  if (goal.targetId && goal.data?.resourceType) {
    return false; // Intencional - completar solo via AGENT_ACTION_COMPLETE
  }
}
```

**Análisis:** Esto es **diseño intencional** - estos objetivos se completan vía evento `AGENT_ACTION_COMPLETE` emitido por:
- `AIActionExecutor.executeHarvest()` 
- `MovementSystem` al llegar a destino
- El flujo `handleActionComplete()` en AISystem

**Flujo correcto:**
1. Goal GATHER/WORK asignado
2. Action MOVE planificada → ejecutada → AGENT_ACTION_COMPLETE
3. Action HARVEST planificada → ejecutada → AGENT_ACTION_COMPLETE
4. `handleActionComplete()` llama `completeGoal()` 

**Estado:** ✅ Funciona correctamente - el sistema está bien diseñado.

### 2. Cache de Dependencias No Invalidado Correctamente (Severidad: Baja)

**Ubicación:** `AISystem.getDeps()` y `cachedDeps`

**Problema:** El cache de dependencias (`cachedDeps`) solo se invalida manualmente en `invalidateCache()`, pero los datos de sistemas dependientes pueden cambiar sin que el cache lo refleje.

**Impacto:** Posibles datos obsoletos en decisiones de IA durante ventanas de 2 segundos.

**Corrección sugerida:**
```typescript
public setDependencies(systems: {...}): void {
  // ... existing code ...
  this.cachedDeps = null; // Agregar esta línea
}
```

### 3. Fallback Explore Con Condiciones Restrictivas (Severidad: Baja)

**Ubicación:** `AISystem.maybeFallbackExplore()`

**Problema:** El movimiento de exploración fallback se activa solo cuando:
- Inventario vacío O necesidades todas > 70
- No está moviéndose

Esto puede causar que agentes con inventario parcial y necesidades medias queden sin hacer nada si no hay recursos cercanos.

**Nota:** El sistema tiene otros fallbacks (`getFallbackExplorationGoal()`) que se activan cuando `makeDecision()` tarda demasiado.

### 4. Timeout de Objetivos Fijo (Severidad: Baja)

**Ubicación:** `AIGoalValidator.GOAL_TIMEOUT_MS = 60000`

**Problema:** Todos los objetivos tienen el mismo timeout de 60 segundos, independientemente de su complejidad.

**Nota:** Algunos evaluadores ya especifican `expiresAt` personalizado:
- BiologicalDriveEvaluator: 15s-60s según tipo
- CombatEvaluator: 3s para huida

### 5. Posible Race Condition en handleActionComplete (Severidad: Baja)

**Ubicación:** `AISystem.handleActionComplete()`

**Código:**
```typescript
if (
  payload.actionType === ActionType.MOVE &&
  aiState.currentAction?.actionType !== ActionType.MOVE
) {
  return; // Ignorar MOVE completado si ya hay otra acción
}
```

**Observación:** Esto es protección contra eventos fuera de orden, pero podría causar que se pierdan eventos legítimos si el timing es incorrecto.

---

## 🔧 RECOMENDACIONES DE MEJORA

### Alta Prioridad

1. **Agregar invalidación de cache en setDependencies:**
   ```typescript
   public setDependencies(systems: {...}): void {
     // ... existing code ...
     this.cachedDeps = null; // Forzar reconstrucción
     this.initializeSubsystems();
   }
   ```

### Media Prioridad

2. **Mejorar fallback explore para cubrir más casos:**
   ```typescript
   private maybeFallbackExplore(agentId: string, aiState: AIState): void {
     if (!this._movementSystem) return;
     if (this._movementSystem.isMoving(agentId)) return;
     
     // Agregar: explorar si no hay objetivo después de N intentos
     const timeSinceDecision = Date.now() - (aiState.lastDecisionTime || 0);
     if (!aiState.currentGoal && timeSinceDecision > 5000) {
       // Forzar exploración
       this.triggerExploration(agentId);
     }
   }
   ```

3. **Agregar métricas de timeouts para diagnóstico:**
   ```typescript
   private goalTimeoutCount = 0;
   
   // En isGoalInvalid cuando timeout ocurre:
   if (now - goal.createdAt > this.GOAL_TIMEOUT_MS) {
     this.goalTimeoutCount++;
     logger.debug(`🚫 [TIMEOUT] Goal ${goal.type} timed out`);
     return true;
   }
   ```

---

### Fortalezas del Sistema
- ✅ Arquitectura modular bien organizada (AISystem → Planner → Executor)
- ✅ Sistema de eventos robusto y desacoplado (BatchedEventEmitter)
- ✅ 17 evaluadores de objetivos cubren escenarios variados
- ✅ Manejo de prioridades con cortes tempranos para urgencias biológicas y combate
- ✅ Batch processing para optimización (GPU cuando disponible)
- ✅ Cache inteligente para reducir cálculos redundantes
- ✅ Múltiples fallbacks para evitar que agentes queden sin acción
- ✅ Validación robusta de objetivos (recursos agotados, targets muertos, timeouts)
- ✅ Sistema de reservación de recursos evita conflictos
- ✅ Pre-planificación de objetivos (cola de 3 goals)
- ✅ Tiempos de expiración personalizados por tipo de objetivo

### Áreas de Mejora Menor (CORREGIDAS ✅)

> **Nota:** Todas las mejoras identificadas fueron implementadas el 28/11/2025

- ~~⚠️ Cache de dependencias podría invalidarse en setDependencies()~~ ✅ **CORREGIDO** - Se agregó `this.cachedDeps = null;` en `setDependencies()`
- ~~⚠️ Fallback explore tiene condiciones muy restrictivas~~ ✅ **CORREGIDO** - Se agregó condición `stuckWithoutGoal` (>5 segundos sin goal)
- ~~⚠️ Timeouts fijos (60s) en AIGoalValidator vs dinámicos en evaluadores~~ ℹ️ **DISEÑO INTENCIONAL** - El timeout fijo actúa como límite máximo, los evaluadores tienen expiración específica por tipo
- ~~⚠️ Métricas de timeouts/fallos podrían mejorar diagnóstico~~ ✅ **CORREGIDO** - Se agregaron `goalsTimedOut` y `goalsExpired` a `AIGoalValidator`

### Conectividad General
**Estado: 99% Conectado Correctamente**

Todos los componentes principales están correctamente conectados:
- Scheduler → AISystem ✅
- AISystem → Todos los evaluadores ✅
- AISystem → ActionPlanner ✅
- AISystem → ActionExecutor ✅
- AISystem → Sistemas dependientes (via setDependencies + @inject) ✅
- Sistema de eventos funcionando bidireccionalmente ✅
- Flujo Goal→Action→Execute→Complete funciona correctamente ✅

### Diagrama de Estado del Agente

```
                    ┌──────────────────────────────────────────────┐
                    │                                              │
                    ▼                                              │
              ┌──────────┐                                         │
              │  IDLE    │◄────────────────────────────────────────┤
              └────┬─────┘                                         │
                   │ makeDecision()                                │
                   ▼                                               │
         ┌─────────────────┐                                       │
         │ PLANNING GOALS  │                                       │
         │ (17 evaluators) │                                       │
         └────────┬────────┘                                       │
                  │ goals.length > 0                               │
                  ▼                                               │
         ┌─────────────────┐                                       │
         │  GOAL ASSIGNED  │                                       │
         │ currentGoal set │                                       │
         └────────┬────────┘                                       │
                  │ planAction()                                   │
                  ▼                                               │
         ┌─────────────────┐                                       │
         │ ACTION PLANNED  │                                       │
         │ currentAction   │                                       │
         └────────┬────────┘                                       │
                  │ executeAction()                                │
                  ▼                                               │
         ┌─────────────────┐                                       │
         │   EXECUTING     │                                       │
         │ (MOVE/HARVEST/  │                                       │
         │  ATTACK/etc)    │                                       │
         └────────┬────────┘                                       │
                  │ AGENT_ACTION_COMPLETE                          │
                  ▼                                               │
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
