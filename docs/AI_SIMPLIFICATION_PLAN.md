# Plan de Simplificación del Sistema de IA

## Resumen Ejecutivo

El sistema de IA actual tiene **~6,500+ líneas** distribuidas en **20+ archivos** con múltiples redundancias conceptuales. Este documento propone una arquitectura simplificada de **~2,000 líneas** en **8 archivos** que unifica Goals y Tasks en un solo concepto.

---

## 1. Problemas Actuales

### 1.1 Redundancia de Sistemas de Tareas

Existen **dos sistemas paralelos** que hacen esencialmente lo mismo:

| Sistema | Archivo | Propósito |
|---------|---------|-----------|
| Goals | `GoalRules.ts` (771 líneas) + `SimplifiedGoalPlanner.ts` | Tareas individuales del agente |
| Tasks | `TaskSystem.ts` (590 líneas) | Tareas colaborativas (construcción) |

**Problema:** Un "Goal" de tipo `WORK` y una "Task" de tipo `construction` son conceptualmente lo mismo: una tarea que el agente debe realizar.

### 1.2 Interfaces *Deps Duplicadas

Hay **10+ interfaces de dependencias** que hacen lo mismo:

```typescript
// Cada una requiere ~20-50 líneas de definición + wiring
AIActionExecutorDeps
AIGoalValidatorDeps  
AIZoneHandlerDeps + 6 ports (AIZoneInventoryPort, AIZoneCraftingPort, etc.)
SimpleActionPlannerDeps
SimplifiedGoalPlannerDeps
AIUrgentGoalsDeps
AIContextSystems
AIContextCallbacks
```

### 1.3 AIContext vs AgentRegistry

| Componente | Líneas | Propósito |
|------------|--------|-----------|
| `IAIContext` + `AIContextAdapter` | 662 | Acceso unificado a datos del agente |
| `AgentRegistry` | 339 | Acceso unificado a datos del agente |

**Problema:** Hacen exactamente lo mismo. `AIContext` se creó para "unificar" las múltiples interfaces `*Deps` pero terminó duplicando `AgentRegistry`.

### 1.4 Complejidad de GoalTypes

```typescript
// 22 tipos de Goal - cada uno con lógica dispersa en múltiples archivos
enum GoalType {
  SATISFY_NEED, SATISFY_HUNGER, SATISFY_THIRST, SATISFY_ENERGY, 
  SATISFY_SOCIAL, SATISFY_FUN, WORK, EXPLORE, SOCIAL, COMBAT, 
  CRAFT, DEPOSIT, ASSIST, CONSTRUCTION, GATHER, IDLE, REST, 
  INSPECT, FLEE, ATTACK, HUNT
}
```

Para cada GoalType existe:
- Una regla en `GoalRules.ts`
- Un handler en `SimpleActionPlanner.ts`
- Un ejecutor en `AIActionExecutor.ts`
- Un validador en `AIGoalValidator.ts`

### 1.5 Estructura Actual (Caos)

```
src/domain/simulation/systems/agents/
├── AISystem.ts                           # 2,415 líneas 😱
├── AgentRegistry.ts                      # 339 líneas
├── RoleSystem.ts                         # 824 líneas
├── EquipmentSystem.ts                    # 458 líneas
├── AmbientAwarenessSystem.ts             # 448 líneas
├── ai/
│   ├── AIContext.ts                      # 220 líneas (redundante)
│   ├── AIContextAdapter.ts               # 442 líneas (redundante)
│   ├── SharedKnowledgeSystem.ts          # 342 líneas
│   ├── index.ts                          # 129 líneas
│   ├── core/
│   │   ├── GoalRules.ts                  # 771 líneas
│   │   ├── GoalRule.ts                   # 213 líneas
│   │   ├── SimpleActionPlanner.ts        # 472 líneas
│   │   ├── AIActionExecutor.ts           # 518 líneas
│   │   ├── AIGoalValidator.ts            # 510 líneas
│   │   ├── AIStateManager.ts             # 383 líneas
│   │   ├── AIZoneHandler.ts              # 546 líneas
│   │   ├── AIUrgentGoals.ts              # 198 líneas
│   │   ├── PriorityManager.ts            # 134 líneas
│   │   ├── SimplifiedGoalPlanner.ts      # 160 líneas
│   │   ├── WorkGoalGenerator.ts          # 240 líneas
│   │   ├── ActionPlanRules.ts            # 200 líneas
│   │   ├── ActivityMapper.ts             # 64 líneas
│   │   └── utils.ts                      # 272 líneas
│   └── evaluators/
│       ├── NeedsEvaluator.ts             # 415 líneas
│       └── CollectiveNeedsEvaluator.ts   # 764 líneas
├── movement/
│   ├── MovementSystem.ts                 # 1,064 líneas
│   ├── MovementBatchProcessor.ts         # 369 líneas
│   └── helpers.ts                        # 117 líneas
└── needs/
    ├── NeedsSystem.ts                    # 1,297 líneas
    └── NeedsBatchProcessor.ts            # 286 líneas

TOTAL: ~12,000+ líneas en 25+ archivos
```

---

## 2. Arquitectura Propuesta

### 2.1 Principios de Diseño

1. **Un solo concepto de Tarea** - Goals y Tasks se unifican en `AgentTask`
2. **Acciones Primitivas** - Solo 5 acciones básicas que sirven para todo
3. **Cola de Tareas** - Cada agente tiene una cola de tareas priorizadas
4. **TaskScripts** - Scripts modulares que generan secuencias de tareas
5. **AgentRegistry como única fuente de verdad** - Eliminar AIContext

### 2.2 Estructura Propuesta

```
src/domain/simulation/systems/agents/
├── AISystem.ts                           # ~500 líneas (orquestador)
├── AgentRegistry.ts                      # ~400 líneas (extendido)
├── ai/
│   ├── TaskQueue.ts                      # ~150 líneas (cola de tareas)
│   ├── TaskResolver.ts                   # ~400 líneas (resuelve tarea → acción)
│   ├── ActionExecutor.ts                 # ~300 líneas (ejecuta acciones primitivas)
│   ├── NeedsEvaluator.ts                 # ~200 líneas (genera tareas de necesidades)
│   └── scripts/                          # ~50-80 líneas cada uno
│       ├── WorkScript.ts
│       ├── CombatScript.ts
│       ├── SocialScript.ts
│       └── ExploreScript.ts
├── movement/                             # Sin cambios
└── needs/                                # Sin cambios

TOTAL: ~2,000 líneas en 10-12 archivos
```

### 2.3 Tipos Unificados

```typescript
// === TaskType: 12 tipos en lugar de 22 GoalTypes ===
enum TaskType {
  // Necesidades (agrupa SATISFY_*)
  SATISFY_NEED = "satisfy_need",
  
  // Trabajo (agrupa WORK, GATHER, CRAFT, BUILD, DEPOSIT)
  GATHER = "gather",
  CRAFT = "craft",
  BUILD = "build",
  DEPOSIT = "deposit",
  
  // Social (agrupa SOCIAL, SATISFY_SOCIAL, SATISFY_FUN)
  SOCIALIZE = "socialize",
  
  // Combate (agrupa COMBAT, ATTACK, HUNT)
  ATTACK = "attack",
  FLEE = "flee",
  
  // Otros
  EXPLORE = "explore",
  REST = "rest",
  IDLE = "idle",
}

// === AgentTask: Estructura unificada ===
interface AgentTask {
  id: string;
  type: TaskType;
  priority: number;
  
  // Target flexible
  target?: {
    entityId?: string;      // Para attack, socialize, gather
    position?: Position;     // Para move, explore
    zoneId?: string;        // Para deposit, rest
  };
  
  // Parámetros específicos del tipo
  params?: {
    needType?: NeedType;     // Para satisfy_need
    resourceType?: string;   // Para gather, deposit
    itemId?: string;         // Para craft
    buildingId?: string;     // Para build
  };
  
  status: 'pending' | 'active' | 'completed' | 'failed';
  createdAt: number;
  expiresAt?: number;
}

// === ActionType: Solo 5 acciones primitivas ===
enum ActionType {
  MOVE = "move",           // Moverse a posición/zona/entidad
  USE = "use",             // Usar recurso/item/zona (eat, drink, craft, rest)
  ATTACK = "attack",       // Atacar entidad
  INTERACT = "interact",   // Interactuar (socialize, trade)
  WAIT = "wait",           // Esperar (idle)
}

interface AgentAction {
  type: ActionType;
  target?: { entityId?: string; position?: Position; zoneId?: string };
  params?: Record<string, unknown>;
  duration?: number;
}
```

### 2.4 Flujo Simplificado

```
┌─────────────────────────────────────────────────────────────────┐
│                         AISystem.update()                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. NeedsEvaluator: Genera tareas basadas en necesidades        │
│     - Si hunger < 30 → TaskType.SATISFY_NEED (needType: HUNGER) │
│     - Si energy < 20 → TaskType.REST                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. TaskScripts: Generan tareas adicionales                     │
│     - WorkScript: Genera GATHER/CRAFT/BUILD según rol           │
│     - CombatScript: Genera ATTACK/FLEE según amenazas           │
│     - SocialScript: Genera SOCIALIZE si social need bajo        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. TaskQueue: Prioriza y selecciona siguiente tarea            │
│     - Ordena por prioridad                                      │
│     - Filtra expiradas/inválidas                                │
│     - Retorna tarea de mayor prioridad                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. TaskResolver: Convierte tarea en acción                     │
│     SATISFY_NEED(hunger) →                                      │
│       - Si tiene comida → USE(food)                             │
│       - Si no → MOVE(foodSource)                                │
│     GATHER(wood) →                                              │
│       - Si cerca de árbol → USE(tree)                           │
│       - Si no → MOVE(nearestTree)                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. ActionExecutor: Ejecuta la acción                           │
│     MOVE → MovementSystem.moveToPoint()                         │
│     USE → NeedsSystem.satisfy() / WorldResourceSystem.harvest() │
│     ATTACK → CombatSystem.attack()                              │
│     INTERACT → SocialSystem.interact()                          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.5 Comportamiento Colectivo Simplificado

En lugar del complejo `CollectiveNeedsEvaluator.ts` (764 líneas), el comportamiento colectivo se logra con:

```typescript
// CollectiveTaskGenerator.ts (~100 líneas)
class CollectiveTaskGenerator {
  generateTasks(colonyState: ColonyState): AgentTask[] {
    const tasks: AgentTask[] = [];
    
    // Si la colonia necesita madera
    if (colonyState.woodPerCapita < 10) {
      tasks.push({
        type: TaskType.GATHER,
        priority: 0.7,
        params: { resourceType: 'wood' },
        // Se asigna al agente más cercano con rol adecuado
      });
    }
    
    // Si hay construcción pendiente
    if (colonyState.pendingBuildings.length > 0) {
      tasks.push({
        type: TaskType.BUILD,
        priority: 0.6,
        target: { zoneId: colonyState.pendingBuildings[0].zoneId },
      });
    }
    
    return tasks;
  }
}
```

Los agentes simplemente reciben estas tareas en su cola y las ejecutan según prioridad.

---

## 3. Plan de Migración

### Fase 1: Preparación (1-2 días)
1. Crear nuevos tipos en `shared/types/simulation/tasks.ts`
2. Crear `TaskQueue.ts` básico
3. Crear `TaskResolver.ts` básico
4. Crear `ActionExecutor.ts` simplificado

### Fase 2: Migración Core (2-3 días)
1. Migrar `AISystem.ts` para usar nueva arquitectura
2. Mantener compatibilidad con tipos antiguos (adaptador)
3. Tests de regresión

### Fase 3: Eliminación de Redundancias (1-2 días)
1. Eliminar `AIContext.ts` y `AIContextAdapter.ts`
2. Eliminar archivos redundantes en `ai/core/`
3. Consolidar `GoalRules.ts` → `NeedsEvaluator.ts`

### Fase 4: Optimización (1 día)
1. Limpiar exports en `ai/index.ts`
2. Actualizar imports en todo el codebase
3. Documentación final

---

## 4. Archivos a Eliminar

```
❌ ai/AIContext.ts                    (220 líneas) - Redundante con AgentRegistry
❌ ai/AIContextAdapter.ts             (442 líneas) - Redundante con AgentRegistry
❌ ai/core/GoalRule.ts                (213 líneas) - Reemplazado por TaskType
❌ ai/core/GoalRules.ts               (771 líneas) - Reemplazado por NeedsEvaluator + Scripts
❌ ai/core/SimpleActionPlanner.ts     (472 líneas) - Reemplazado por TaskResolver
❌ ai/core/AIActionExecutor.ts        (518 líneas) - Reemplazado por ActionExecutor
❌ ai/core/AIGoalValidator.ts         (510 líneas) - Integrado en TaskQueue
❌ ai/core/AIStateManager.ts          (383 líneas) - Integrado en AgentRegistry
❌ ai/core/AIZoneHandler.ts           (546 líneas) - Integrado en ActionExecutor
❌ ai/core/AIUrgentGoals.ts           (198 líneas) - Integrado en NeedsEvaluator
❌ ai/core/SimplifiedGoalPlanner.ts   (160 líneas) - Eliminado
❌ ai/core/WorkGoalGenerator.ts       (240 líneas) - Reemplazado por WorkScript
❌ ai/core/ActionPlanRules.ts         (200 líneas) - Eliminado
❌ ai/evaluators/NeedsEvaluator.ts    (415 líneas) - Consolidado
❌ ai/evaluators/CollectiveNeedsEvaluator.ts (764 líneas) - Simplificado

TOTAL A ELIMINAR: ~5,852 líneas
```

---

## 5. Beneficios Esperados

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Líneas de código | ~12,000 | ~4,000 | -67% |
| Archivos | 25+ | 12 | -52% |
| Interfaces *Deps | 10+ | 1 | -90% |
| Tipos de Goal/Task | 22 | 12 | -45% |
| Tiempo de onboarding | Alto | Bajo | Significativo |

---

## 6. Progreso de Implementación

### ✅ Completado

#### Paso 1: Tipos unificados
- [x] `src/shared/types/simulation/unifiedTasks.ts` - TaskType, AgentTask, PrimitiveAction, helpers

#### Paso 2: TaskQueue
- [x] `src/domain/simulation/systems/agents/ai/TaskQueue.ts` - Cola de tareas priorizada por agente

#### Paso 3: TaskResolver
- [x] `src/domain/simulation/systems/agents/ai/TaskResolver.ts` - Convierte Task → PrimitiveAction

#### Paso 4: ActionExecutor
- [x] `src/domain/simulation/systems/agents/ai/ActionExecutor.ts` - Ejecuta acciones vía sistemas

#### Paso 5: SimpleNeedsEvaluator
- [x] `src/domain/simulation/systems/agents/ai/SimpleNeedsEvaluator.ts` - Genera tareas desde necesidades

#### Paso 6: Task Scripts
- [x] `src/domain/simulation/systems/agents/ai/scripts/WorkScript.ts` - Tareas de trabajo por rol
- [x] `src/domain/simulation/systems/agents/ai/scripts/CombatScript.ts` - Tareas de combate/huida
- [x] `src/domain/simulation/systems/agents/ai/scripts/SocialScript.ts` - Tareas de socialización

#### Paso 7: Adaptador de migración gradual
- [x] `src/domain/simulation/systems/agents/ai/UnifiedAIAdapter.ts` - Convierte Goal ↔ Task

#### Paso 8: Exports actualizados
- [x] `src/domain/simulation/systems/agents/ai/index.ts` - Nuevos y legacy exports

### 🔄 Pendiente

#### Paso 9: Integrar en AISystem
- [x] Modificar `AISystem.ts` para usar `UnifiedAIAdapter` opcionalmente
- [x] Añadir flag de feature toggle (`useUnifiedTasks`) para activar nueva arquitectura
- [x] Añadir método `setUseUnifiedTasks(enabled)` para control en runtime
- [x] Añadir limpieza de adapter en `removeAgentState()`

#### Paso 10: Migración de comportamientos
- [x] SimpleNeedsEvaluator ya soporta evaluación de necesidades (individual y colectiva)
- [x] Scripts de tareas creados (WorkScript, CombatScript, SocialScript)
- [ ] Migrar uso gradual en AISystem cuando `useUnifiedTasks` esté activo

#### Paso 11: Eliminar código legacy
- [ ] Eliminar `AIContext.ts` y `AIContextAdapter.ts`
- [ ] Eliminar archivos redundantes en `ai/core/`

#### Paso 12: Testing
- [x] Tests unitarios para TaskQueue (20 tests)
- [x] Tests unitarios para SimpleNeedsEvaluator (16 tests)
- [x] Tests unitarios para UnifiedAIAdapter (14 tests)
- [x] Tests de regresión pasando (847 tests total)

---

## 7. Conclusión

La arquitectura actual del sistema de IA es resultado de múltiples iteraciones y refactors parciales que han dejado capas de abstracción redundantes. La propuesta simplifica radicalmente el sistema manteniendo la misma funcionalidad, usando:

1. **Un concepto unificado** de tarea (`AgentTask`)
2. **Acciones primitivas** reutilizables
3. **Scripts modulares** para comportamientos complejos
4. **AgentRegistry** como única fuente de verdad

Esto reduce la complejidad cognitiva, facilita el mantenimiento y mejora la performance al eliminar indirecciones innecesarias.
