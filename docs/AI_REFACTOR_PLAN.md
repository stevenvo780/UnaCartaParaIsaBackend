# Refactor del Sistema de AI: De 18 Evaluadores a Sistema de Reglas

## Estado Actual del Problema

El sistema de AI tiene **~10,000 líneas** distribuidas en:
- `AISystem.ts`: 2,527 líneas (God Class)
- `ai/core/`: ~4,444 líneas (8 archivos)
- `ai/evaluators/`: ~3,062 líneas (17 evaluadores)

### El Anti-Patrón Identificado

`AgentGoalPlanner.ts` construye **18 objetos `*Deps` diferentes** para llamar **18 evaluadores**, cada uno con su propia interfaz:

```typescript
// ANTES: 18 interfaces diferentes
interface BiologicalDriveDeps { getEntityNeeds, findNearestResource, ... }
interface SocialDriveDeps { getEntityNeeds, findNearbyAgent, ... }
interface CognitiveDriveDeps { getAgentRole, getAgentInventory, ... }
// ... x18
```

Y `AISystem.getDeps()` construye un objeto de **~100 líneas** con **30+ campos**.

---

## Solución Implementada: Sistema de Reglas Declarativo

### Nuevos Archivos Creados

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `GoalRule.ts` | ~170 | Motor de evaluación de reglas |
| `GoalRules.ts` | ~250 | 9 reglas core declarativas |
| `SimplifiedGoalPlanner.ts` | ~55 | Integración unificada |
| **Total** | **~475** | Reemplaza ~4,000 líneas de evaluadores |

### Arquitectura Nueva

```typescript
// UNA sola interfaz de contexto
interface GoalContext {
  entityId: string;
  aiState: AIState;
  now: number;
  needs?: EntityNeedsData;
  inventory?: Inventory;
  position?: { x: number; y: number };
  roleType?: string;
  gameState?: GameState;
}

// UNA regla declarativa (en lugar de una función de ~200 líneas)
const hungerRule: GoalRule = {
  id: "bio_hunger",
  goalType: GoalType.SATISFY_HUNGER,
  category: "biological",
  condition: (ctx) => needUtility(ctx.needs?.hunger) > 0,
  priority: (ctx) => {
    if ((ctx.needs?.hunger ?? 100) < 15) return 0.95; // Crítico
    return needUtility(ctx.needs?.hunger) * 0.85;
  },
  isCritical: true,
};
```

### Beneficios

1. **Legibilidad**: Una regla es ~20 líneas vs ~200 líneas de un evaluador
2. **Testabilidad**: Cada regla es una función pura fácil de testear
3. **Extensibilidad**: Agregar nueva regla = 1 objeto, no 1 archivo nuevo
4. **Depuración**: Puedes ver qué reglas se activaron con un simple log
5. **Configurabilidad**: Las reglas pueden cargarse de JSON/YAML en el futuro

---

## Plan de Migración (Gradual)

### Fase 1: Core Goals ✅ COMPLETADA
- [x] `GoalRule.ts` - Motor de evaluación
- [x] `GoalRules.ts` - Reglas biológicas, sociales, cognitivas
- [x] `SimplifiedGoalPlanner.ts` - Integración
- [x] Tests: 15 pasando

### Fase 2: Integración en AISystem ✅ COMPLETADA
- [x] `getSimplifiedDeps()` - 5 campos vs 30+ de `getDeps()`
- [x] `processGoals()` - Usa SimplifiedGoalPlanner primero para goals urgentes
- [x] Cache de deps simplificado con limpieza automática
- [x] Fallback a sistema legacy para goals complejos
- [x] 977 tests pasando sin regresiones

**Flujo actual en `processGoals()`:**
```typescript
// 1. Evaluar reglas simplificadas (biological, social, cognitive)
const coreGoals = planGoalsSimplified(simpleDeps, aiState, now);
if (coreGoals[0]?.priority > 0.7) return coreGoals[0]; // Goal urgente

// 2. Fallback a legacy urgent goals (con targeting de recursos)
if (needs.hunger <= 25) return createUrgentFoodGoal();
// ...

// 3. Full goal planner para goals complejos
const goals = await planGoals(deps, aiState, now);
if (goals.length > 0) return goals[0];

// 4. Core goals como fallback final
return coreGoals[0];
```

### Fase 3: Migrar Evaluadores Restantes
Convertir cada evaluador a regla(s):

| Evaluador | → Regla(s) | Complejidad |
|-----------|-----------|-------------|
| BiologicalDriveEvaluator | hungerRule, thirstRule, energyRule | ✅ Done |
| SocialDriveEvaluator | socialRule, funRule, mentalHealthRule | ✅ Done |
| CognitiveDriveEvaluator | workDriveRule, exploreDriveRule | ✅ Done |
| CombatEvaluator | combatRule, fleeRule | Media |
| ConstructionEvaluator | constructionRule | Media |
| CollectiveNeedsEvaluator | gatherFoodRule, gatherWoodRule, etc | Alta |
| ... | ... | ... |

### Fase 4: Eliminar Código Obsoleto
Una vez migrados todos los evaluadores:
1. Eliminar los 17 archivos en `ai/evaluators/`
2. Eliminar `AgentGoalPlanner.ts`
3. Simplificar `AISystem.getDeps()` a ~20 líneas

---

## Comparación de Complejidad

| Métrica | Antes | Después (Fase 4) | Reducción |
|---------|-------|------------------|-----------|
| Archivos evaluadores | 17 | 1 (GoalRules.ts) | -94% |
| Líneas evaluadores | ~3,062 | ~500 | -84% |
| Interfaces *Deps | 18 | 1 (GoalContext) | -94% |
| AISystem.getDeps() | ~100 líneas | ~20 líneas | -80% |

---

## Cómo Depurar el Nuevo Sistema

```typescript
// Activar logs de reglas
const goals = evaluateRules(coreRules, ctx, 5);
console.log(`Reglas activadas para ${ctx.entityId}:`);
goals.forEach(g => console.log(`  - ${g.id}: priority=${g.priority.toFixed(2)}`));
```

---

## Tests Disponibles

```bash
# Ejecutar tests del sistema de reglas
npx vitest run tests/SimplifiedGoalPlanner.test.ts
```

Cobertura:
- `needUtility()` - 3 tests
- `socialNeedUtility()` - 2 tests
- `hungerRule` - 2 tests
- `thirstRule` - 1 test
- `workDriveRule` - 2 tests
- `evaluateRules()` - 3 tests
- `planGoalsSimplified()` - 2 tests
