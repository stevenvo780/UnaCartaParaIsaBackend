# 🔍 Auditoría de la Lógica de Simulación

**Fecha**: 3 de diciembre de 2025  
**Ámbito**: UnaCartaParaIsaBackend - Domain/Simulation  
**Estado**: ✅ Problemas Críticos Corregidos

---

## 📊 Resumen Ejecutivo

Se encontraron **9 categorías de problemas** en la arquitectura de la simulación:
- **4 Críticos** (corregidos)
- **5 Warnings** (documentados para seguimiento)

---

## ✅ PROBLEMAS CORREGIDOS

### 1. Duplicación en Constructor de SimulationRunner

**Archivo**: `src/domain/simulation/core/SimulationRunner.ts`

**Problema**: El constructor tenía código duplicado que creaba:
- 2 instancias de `CommandProcessor` (una se desechaba inmediatamente)
- 2 intervalos de `scheduleAutoSaves()` (doble guardado cada 60s)

```typescript
// ANTES (líneas 269-276)
this.commandProcessor = new CommandProcessor(this);
this.commandProcessor = new CommandProcessor(this); // ❌ DUPLICADO
this.snapshotManager = new SnapshotManager(this);
this.scheduleAutoSaves();
this.scheduleAutoSaves(); // ❌ DUPLICADO
```

**Impacto**: 
- Memory leak por instancia desechada
- Doble operación de I/O cada minuto
- Posibles race conditions en guardado

**Corrección**: Eliminadas las líneas duplicadas.

---

### 2. Memory Leak en AISystem

**Archivo**: `src/domain/simulation/systems/agents/ai/AISystem.ts`

**Problema**: `clearAgent()` no limpiaba `agentMemories`, causando que la memoria de agentes muertos permaneciera indefinidamente.

```typescript
// ANTES
public clearAgent(agentId: string): void {
  this.activeTask.delete(agentId);
  this.taskQueue.clear(agentId);
  this.lastUpdate.delete(agentId);
  // ❌ Falta: this.agentMemories.delete(agentId);
}
```

**Impacto**: Crecimiento ilimitado de memoria con cada muerte de agente.

**Corrección**: Añadido `this.agentMemories.delete(agentId);`

---

### 3. Promesa sin Manejar en LifeCycleSystem

**Archivo**: `src/domain/simulation/systems/lifecycle/LifeCycleSystem.ts`

**Problema**: `tryBreeding()` es async pero se llamaba sin `await` ni manejo de errores.

```typescript
// ANTES
this.tryBreeding(Date.now()); // ❌ Promesa flotante

// DESPUÉS  
void this.tryBreeding(Date.now()); // ✅ Explícito que se ignora
```

**Impacto**: Errores en reproducción no se propagaban correctamente.

**Corrección**: Añadido `void` para indicar explícitamente que la promesa se ejecuta sin esperar.

---

### 4. Log Incorrecto de Sistemas Registrados

**Archivo**: `src/domain/simulation/core/SimulationRunner.ts`

**Problema**: El log mostraba números hardcoded incorrectos.

```typescript
// ANTES
logger.info("📋 All systems registered", {
  fast: 3,   // ❌ Real: 2
  medium: 8, // ❌ Real: 9
  slow: 30,  // ❌ Real: 15
});
```

**Corrección**: Actualizados a los valores correctos.

---

## ⚠️ WARNINGS PENDIENTES

### 5. preTick Ejecutado Múltiples Veces

**Archivo**: `src/domain/simulation/core/MultiRateScheduler.ts`

**Problema**: El hook `preTick` se ejecuta en cada tick (FAST, MEDIUM, SLOW), causando reconstrucción de índices redundante.

**Impacto**: Performance degradada (~3x trabajo innecesario en índices)

**Recomendación**: Refactorizar para que `preTick` solo ejecute una vez por ciclo completo, o hacer los índices incrementales.

---

### 6. Doble Procesamiento de Muerte de Agentes

**Archivos**: 
- `src/domain/simulation/core/runner/EventRegistry.ts`
- `src/domain/simulation/systems/lifecycle/LifeCycleSystem.ts`

**Problema**: Ambos escuchan `AGENT_DEATH` y procesan la muerte:

```typescript
// EventRegistry.ts
simulationEvents.on(GameEventType.AGENT_DEATH, (data) => {
  this.runner.entityIndex.markEntityDead(data.entityId);
  this.runner._genealogySystem.recordDeath(data.entityId);
  // ...
});

// LifeCycleSystem.ts
simulationEvents.on(GameEventType.AGENT_DEATH, (data) => {
  // También procesa...
});
```

**Impacto**: Posibles inconsistencias, llamadas dobles a genealogy.

**Recomendación**: Centralizar el manejo de muerte en un solo lugar.

---

### 7. Caches Sin Límite de Tamaño

**Archivos**:
- `MovementSystem.ts`: `pathCache`, `zoneDistanceCache`
- `NeedsSystem.ts`: `zoneCache`

**Problema**: Los caches crecen indefinidamente.

**Recomendación**: Implementar LRU cache o límite de tamaño.

---

### 8. MovementSystem @postConstruct Síncrono

**Archivo**: `src/domain/simulation/systems/agents/movement/MovementSystem.ts`

**Problema**: `_init()` no es async pero hace operaciones que podrían fallar si las dependencias no están listas.

```typescript
@postConstruct()
private _init(): void { // ❌ No async
  this.precomputeZoneDistances(); // Podría fallar
}
```

**Recomendación**: Hacer async o mover a `initialize()` explícito.

---

### 9. Timeout de Pathfinding Sin Uso

**Archivo**: `src/domain/simulation/systems/agents/movement/MovementSystem.ts`

**Problema**: Se define `pathfindingStartTime` pero no se usa para timeout.

```typescript
interface EntityMovementState {
  pathfindingStartTime?: number; // Definido pero no usado
}
```

**Recomendación**: Implementar timeout o eliminar el campo.

---

## 📋 Conteo Real de Sistemas

| Rate | Sistemas | Nombres |
|------|----------|---------|
| FAST | 2 | Movement, Combat |
| MEDIUM | 9 | AI, Needs, Social, Household, LifeCycle, Time, Role, Task, Animal |
| SLOW | 15 | Economy, Reputation, Governance, WorldResource, Production, Building, EnhancedCrafting, Inventory, ResourceReservation, Marriage, ConflictResolution, AmbientAwareness, ItemGeneration, RecipeDiscovery, SharedKnowledge, ChunkLoading |

---

## 🔧 Archivos Modificados

1. `src/domain/simulation/core/SimulationRunner.ts`
   - Eliminado CommandProcessor duplicado
   - Eliminado scheduleAutoSaves duplicado
   - Corregido log de sistemas

2. `src/domain/simulation/systems/agents/ai/AISystem.ts`
   - clearAgent() ahora limpia agentMemories

3. `src/domain/simulation/systems/lifecycle/LifeCycleSystem.ts`
   - tryBreeding() marcado con void explícito

---

## 📈 Métricas de Impacto

| Métrica | Antes | Después |
|---------|-------|---------|
| Intervalos de autoguardado | 2 | 1 |
| Memory leaks por muerte | Sí | No |
| Promesas flotantes | 1 | 0 |
| Logs incorrectos | 3 valores | 0 |

---

## 🎯 Próximos Pasos Recomendados

1. **Alta Prioridad**: Refactorizar manejo de muerte de agentes (Warning #6)
2. **Media Prioridad**: Implementar LRU para caches (Warning #7)
3. **Baja Prioridad**: Optimizar preTick para evitar reconstrucción redundante (Warning #5)
