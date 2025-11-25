# Análisis y Optimización de CPU en la Simulación

## Resumen del Problema

La simulación consumía CPU excesiva (como si moviera miles de entidades) para solo 7 entidades. 

## Problemas Fundamentales Identificados

### 1. 🚨 MultiRateScheduler NO sincronizaba índices globales

El scheduler ejecutaba los sistemas individualmente, pero **no hacía la sincronización previa** de índices que cada sistema necesitaba:

```typescript
// Antes: Cada sistema intentaba sincronizar por su cuenta
// Esto causaba múltiples reconstrucciones del mismo índice
```

**Solución implementada:**
- Agregados hooks `preTick` y `postTick` al scheduler
- `preTick`: Sincroniza `EntityIndex`, `SharedSpatialIndex` una sola vez antes de todos los sistemas
- `postTick`: Hace flush de eventos acumulados en `BatchedEventEmitter`

### 2. 🚨 40 sistemas ejecutándose para 7 entidades

| Rate | Sistemas | Frecuencia | Ejecuciones/segundo |
|------|----------|------------|---------------------|
| FAST | 3 | 10 Hz | 30 |
| MEDIUM | 8 | 2 Hz | 16 |
| SLOW | 29 | 1 Hz | 29 |
| **Total** | **40** | - | **~75** |

Muchos sistemas (EmergenceSystem, KnowledgeNetworkSystem, CrisisPredictorSystem, etc.) **no tienen sentido ejecutar con pocas entidades**.

**Solución implementada:**
- Agregado `minEntities` opcional a `ScheduledSystem`
- Sistemas pesados configurados con umbrales mínimos:
  - `EmergenceSystem`: minEntities=15
  - `KnowledgeNetworkSystem`: minEntities=10
  - `CrisisPredictorSystem`: minEntities=20
  - `MarketSystem`: minEntities=10
  - `TradeSystem`: minEntities=10
  - `ConflictResolutionSystem`: minEntities=10
  - `NormsSystem`: minEntities=15
  - `GovernanceSystem`: minEntities=15

### 3. ✅ Búsquedas O(n) repetidas → Complejidad O(n²) [CORREGIDO]

**Problema original:** 18+ lugares usaban búsquedas O(n) dentro de loops:
```typescript
// MAL - O(n) cada llamada dentro de un loop
this.gameState.agents.find((a) => a.id === id);
this.gameState.entities.find((e) => e.id === id);
```

**Solución implementada:** Inyectar `EntityIndex` en sistemas y usar lookups O(1):
```typescript
// BIEN - O(1)
this.entityIndex?.getAgent(id) ?? this.gameState.agents.find(...)
this.entityIndex?.getEntity(id) ?? this.gameState.entities.find(...)
```

**Sistemas migrados:**
| Sistema | Llamadas optimizadas | Impacto |
|---------|---------------------|---------|
| `AISystem.ts` | 2 (getCurrentZone, getEntityPosition) | FAST rate, alto impacto |
| `MovementSystem.ts` | 4 (updateBatch, updateEntityMovement, completeMovement, initializeEntityMovement) | FAST rate, alto impacto |
| `NeedsSystem.ts` | 3 (handleEntityDeath, respawnEntity, applySocialMoraleBoost) | MEDIUM rate |
| `LifeCycleSystem.ts` | 7 (processHousingAssignments, tryReproduction, spawnAgent, getAgent, cleanupAgentState) | MEDIUM rate |
| `EconomySystem.ts` | 1 (handleWorkAction) | SLOW_UPDATE rate |
| `TrailSystem.ts` | 1 (recordMovement) | Event-driven |

**Sistemas NO migrados (por diseño):**
- `TradeSystem.ts`: Usa `filter()` con predicados complejos (inventario, lifeStage) - no optimizable con EntityIndex por ID. Es SLOW_UPDATE así que es aceptable.

## Cambios Realizados

### MultiRateScheduler.ts

```typescript
// Nuevos tipos
export interface ScheduledSystem {
  // ...existing...
  minEntities?: number; // Umbral mínimo de entidades
}

export interface SchedulerHooks {
  preTick?: () => void;    // Sincronización de índices
  postTick?: () => void;   // Flush de eventos
  getEntityCount?: () => number; // Count de entidades
}

// Nuevo método
public setHooks(hooks: SchedulerHooks): void

// Modificación en executeSystems()
if (system.minEntities && entityCount < system.minEntities) {
  continue; // Skip sistema
}
```

### SimulationRunner.ts

```typescript
// Nuevo método
private configureSchedulerHooks(): void {
  this.scheduler.setHooks({
    preTick: () => {
      this.entityIndex.rebuild(this.state);
      this.entityIndex.syncAgentsToEntities(this.state);
      this.sharedSpatialIndex.rebuildIfNeeded(...);
    },
    postTick: () => {
      simulationEvents.flushEvents();
    },
    getEntityCount: () => {
      return this.state.agents.length + this.animalSystem.getAnimals().size;
    },
  });
}

// Sistemas con minEntities
this.scheduler.registerSystem({
  name: "EmergenceSystem",
  minEntities: 15,
  // ...
});
```

## Impacto Esperado

Con 7 entidades:
- **Antes:** ~75 ejecuciones de sistemas/segundo, cada uno reconstruyendo índices
- **Después:** ~67 ejecuciones/segundo (8 sistemas saltados), índices sincronizados 1 vez por tick

Con 100+ entidades:
- Todos los sistemas se ejecutan
- Índices sincronizados 1 vez en lugar de N veces

## Trabajo Futuro Recomendado

1. **Migrar sistemas a usar EntityIndex**
   - Reemplazar `gameState.agents.find()` por `entityIndex.getAgent()`
   - Impacto: Reducir O(n²) a O(n)

2. **Lazy SpatialIndex para pocas entidades**
   - Con <20 entidades, usar búsqueda lineal en lugar de grid espacial
   - El overhead del grid no se justifica con pocas entidades

3. **Throttling dinámico de frecuencias**
   - Reducir frecuencias de FAST/MEDIUM/SLOW cuando hay pocas entidades
   - Ejemplo: FAST de 10Hz a 5Hz con <20 entidades

4. **Profiling con métricas reales**
   - Agregar métricas de tiempo por sistema
   - Identificar los sistemas más costosos en runtime real
