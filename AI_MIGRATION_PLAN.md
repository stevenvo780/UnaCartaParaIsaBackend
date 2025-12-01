# Plan de Migración del Sistema de IA

> **Última actualización:** 30 de noviembre de 2025  
> **Estado:** ✅ FASE 6 COMPLETADA - Simplificación del Sistema de IA

## Resumen Ejecutivo

El sistema de IA ha sido **simplificado drásticamente**:
- **Antes:** ~15,000+ líneas de código legacy con Goals, Planners, Scripts, etc.
- **Después:** ~2,500 líneas en arquitectura basada en TaskQueue + Handlers

### Principio Central
```
Sistemas externos → emitTask() → TaskQueue → AISystem.update() → Handler
```

Los sistemas (NeedsSystem, CombatSystem, etc.) emiten tareas cuando detectan condiciones.
**Las tareas duplicadas ACUMULAN prioridad**, garantizando que eventos urgentes se atiendan primero.

---

## Estado de Fases

| Fase | Estado | Descripción |
|------|--------|-------------|
| 1 | ✅ COMPLETADO | TaskQueue con acumulación de prioridad |
| 2 | ✅ COMPLETADO | 9 Detectores (backup, observan estado → generan tareas) |
| 3 | ✅ COMPLETADO | 12 Handlers (ejecutan acciones específicas) |
| 4 | ✅ COMPLETADO | Nuevo AISystem simplificado (~720 líneas) |
| 5 | ✅ COMPLETADO | Eliminación código legacy (~12,500 líneas) |
| 6 | ✅ COMPLETADO | Capa de compatibilidad para consumidores legacy |
| 7 | 🔲 PENDIENTE | Refactorizar consumidores para nueva API |
| 8 | 🔲 PENDIENTE | Eliminar capa de compatibilidad |
| 9 | 🔲 PENDIENTE | Tests completos |

---

## Estructura Actual

```
ai/
├── AISystem.ts              # 720 líneas - Orquestador principal
├── TaskQueue.ts             # 350 líneas - Cola con prioridad acumulativa
├── SharedKnowledgeSystem.ts # 343 líneas - Conocimiento compartido
├── types.ts                 # 322 líneas - Tipos locales
├── index.ts                 # 92 líneas - Exports
│
├── detectors/               # 9 detectores (~1,200 líneas total)
│   ├── NeedsDetector.ts     # Hambre, sed, energía, social, fun
│   ├── CombatDetector.ts    # Ataques, amenazas, huida
│   ├── WorkDetector.ts      # Trabajo por rol
│   ├── InventoryDetector.ts # Inventario lleno
│   ├── CraftDetector.ts     # Crafteo de armas
│   ├── BuildDetector.ts     # Construcciones
│   ├── SocialDetector.ts    # Social, reproducción
│   ├── ExploreDetector.ts   # Exploración
│   └── TradeDetector.ts     # Comercio
│
└── handlers/                # 12 handlers (~1,100 líneas total)
    ├── MoveHandler.ts       # Movimiento
    ├── GatherHandler.ts     # Recolectar
    ├── ConsumeHandler.ts    # Comer/beber
    ├── RestHandler.ts       # Descansar
    ├── CraftHandler.ts      # Craftear
    ├── BuildHandler.ts      # Construir
    ├── DepositHandler.ts    # Depositar
    ├── AttackHandler.ts     # Atacar
    ├── FleeHandler.ts       # Huir
    ├── SocialHandler.ts     # Socializar
    ├── ExploreHandler.ts    # Explorar
    └── TradeHandler.ts      # Comerciar
```

**Total:** ~4,100 líneas (vs ~15,000+ anteriores) = **~73% reducción**

---

## Código Eliminado

### Carpetas Completas (✅ ELIMINADAS)
- `ai/core/` - ~5,500 líneas (AIStateManager, GoalRules, Planners, etc.)
- `ai/evaluators/` - ~1,200 líneas
- `ai/scripts/` - ~1,000 líneas

### Archivos Individuales (✅ ELIMINADOS)
- `AIContext.ts`
- `AIContextAdapter.ts`
- `AICore.ts`
- `SimpleNeedsEvaluator.ts`
- `TaskDetectors.ts`
- `UnifiedAIAdapter.ts`
- `TaskResolver.ts`
- `ActionExecutor.ts`
- `AIOrchestrator.ts`
- `agents/AISystem.ts` (el de 2,486 líneas - reemplazado por `ai/AISystem.ts`)

---

## Arquitectura v3

### Flujo Principal
```
┌─────────────────┐
│  NeedsSystem    │──┐
│  CombatSystem   │  │  emitTask()
│  RoleSystem     │──┼─────────────┐
│  TimeSystem     │  │             │
│  ...otros       │──┘             ▼
└─────────────────┘         ┌─────────────┐
                            │  TaskQueue  │
                            │             │
                            │ • Prioridad │
                            │ • Duplicados│
                            │   SUMAN     │
                            └──────┬──────┘
                                   │ dequeue()
                                   ▼
                            ┌─────────────┐
                            │  AISystem   │
                            │  .update()  │
                            └──────┬──────┘
                                   │
                                   ▼
                            ┌─────────────┐
                            │  Handler    │
                            │ (12 tipos)  │
                            └──────┬──────┘
                                   │
                                   ▼
                              [Acción]
```

### Acumulación de Prioridad

El concepto clave: cuando una tarea duplicada se emite, su prioridad **SE SUMA**:

```typescript
// Ejemplo: Agente atacado múltiples veces
combatSystem.on('agentDamaged', (agentId, attackerId) => {
  aiSystem.emitTask(agentId, {
    type: TaskType.ATTACK,
    priority: 0.6,
    target: { entityId: attackerId }
  });
});

// Si se llama 5 veces:
// Prioridad final = 0.6 + 5 * 0.1 = 1.1 (máxima prioridad)
```

Esto garantiza que eventos urgentes/repetidos se atiendan primero.

---

## Uso de la Nueva API

### Emitir Tareas desde Sistemas

```typescript
// En NeedsSystem
if (hunger < 30) {
  aiSystem.emitTask(agentId, {
    type: TaskType.SATISFY_NEED,
    priority: TASK_PRIORITIES.HIGH,
    params: { needType: 'hunger' },
    source: 'needs_system'
  });
}

// En CombatSystem
if (agentAttacked) {
  aiSystem.emitTask(agentId, {
    type: TaskType.ATTACK,
    priority: TASK_PRIORITIES.URGENT,
    target: { entityId: attackerId },
    source: 'combat_system'
  });
}
```

### Métodos Principales

```typescript
// Emitir tarea
aiSystem.emitTask(agentId, task)

// Eventos rápidos (atajo)
aiSystem.reportEvent(agentId, 'attacked', { attackerId })
aiSystem.reportEvent(agentId, 'hungry')

// Consultar estado
aiSystem.getActiveTask(agentId)
aiSystem.getPendingTasks(agentId)
aiSystem.getStats()

// Control
aiSystem.cancelTask(agentId)
aiSystem.clearAgent(agentId)
```

---

## Capa de Compatibilidad Legacy

El AISystem incluye métodos **@deprecated** para compatibilidad con código existente:

```typescript
// Estos métodos se mantendrán hasta refactorizar consumidores
aiSystem.getAIState(agentId)       // → use getActiveTask() + getPendingTasks()
aiSystem.setGoal(agentId, goal)    // → use emitTask()
aiSystem.clearGoals(agentId)       // → use clearAgent()
aiSystem.failCurrentGoal(agentId)  // → use cancelTask()
aiSystem.forceGoalReevaluation()   // → automático por detectores
aiSystem.restoreAIState()          // → no-op
aiSystem.syncToGameState()         // → no-op
```

---

## Próximos Pasos

### Fase 7: Refactorizar Consumidores
- [ ] `SimulationRunner.ts` - Usar nueva API
- [ ] `EventRegistry.ts` - Emitir tareas en eventos
- [ ] `SnapshotManager.ts` - Simplificar serialización de estado
- [ ] Tests legacy que usan métodos deprecated

### Fase 8: Eliminar Compatibilidad
- [ ] Remover métodos @deprecated de AISystem
- [ ] Remover tipo `LegacyAIState`
- [ ] Limpiar imports no usados

### Fase 9: Tests
- [ ] Tests unitarios para TaskQueue
- [ ] Tests unitarios para cada Handler
- [ ] Tests de integración AISystem
- [ ] Tests E2E de comportamiento de agentes

---

## Métricas de Éxito

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Líneas de código | ~15,000 | ~4,100 | -73% |
| Archivos | 40+ | 25 | -37% |
| Complejidad ciclomática | Alta | Baja | ✓ |
| Facilidad de debug | Difícil | Simple | ✓ |
| Facilidad de agregar comportamientos | Difícil | Fácil | ✓ |

---

## Notas de Implementación

### Por qué Handlers en lugar de Planners

Los Planners (SimplifiedGoalPlanner, SimpleActionPlanner) convertían objetivos en planes multi-paso.
Esto añadía complejidad innecesaria:

1. Goal → Plan → Actions → Execute
2. Replanificación si algo fallaba
3. Estado intermedio a mantener

Con Handlers:
1. Task → Handler → Acción inmediata
2. Si falla, la tarea vuelve a la cola
3. Sin estado intermedio

### Por qué Detectores como Backup

Los detectores (`runAllDetectors`) son un **fallback** si los sistemas no emiten tareas.
El flujo ideal es:

```
Sistema → detecta condición → emite tarea directamente
```

Los detectores existen para:
1. Migración gradual
2. Condiciones que ningún sistema maneja
3. Debug/testing
