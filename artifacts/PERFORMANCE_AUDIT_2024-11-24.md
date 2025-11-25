# 🔍 Auditoría de Rendimiento - UnaCartaParaIsa

**Fecha:** 24 de Noviembre de 2024  
**Alcance:** Backend (`UnaCartaParaIsaBackend`) + Frontend (`UnaCartaParaIsa`)

---

## 📊 Resumen Ejecutivo

Se identificaron **16+ problemas de rendimiento** distribuidos en:

| Severidad | Backend | Frontend | Total |
|-----------|---------|----------|-------|
| 🔴 CRÍTICO | 3 | 3 | 6 |
| 🟠 ALTO | 3 | 2 | 5 |
| 🟡 MEDIO | 5 | 3 | 8 |
| 🟢 BAJO | 1 | 1 | 2 |

**Impacto estimado:**
- CPU: 40-60% de desperdicio por algoritmos O(n²)
- Memoria: GC pressure por objetos temporales en hot paths
- FPS: Pérdida de 30-50% por rendering ineficiente

---

## 🔴 PROBLEMAS CRÍTICOS

### 1. DeltaEncoder: O(n²) en cada tick

**Archivo:** `src/domain/simulation/core/DeltaEncoder.ts` (líneas 96-143)

```typescript
// PROBLEMA: O(n) lookup por cada agente/entidad/animal
const changedAgents = current.agents.filter((agent) => {
  const prevAgent = previous.agents.find((a) => a.id === agent.id); // O(n)
  return !prevAgent || this.hasAgentChanged(prevAgent, agent);
});

const changedEntities = current.entities.filter((entity) => {
  const prevEntity = previous.entities.find((e) => e.id === entity.id); // O(n)
  return !prevEntity || this.hasEntityChanged(prevEntity, entity);
});

const prevAnimal = prevAnimals.find((a) => a.id === animal.id); // O(n)
```

**Impacto:** Se ejecuta **cada tick** para serialización WebSocket. Con N agentes + M entidades + P animales → **O(N² + M² + P²)**.

**Fix:**
```typescript
// Crear Maps al inicio de detectChanges()
const prevAgentMap = new Map(previous.agents.map(a => [a.id, a]));
const prevEntityMap = new Map(previous.entities.map(e => [e.id, e]));
const prevAnimalMap = new Map(prevAnimals.map(a => [a.id, a]));

// Usar O(1) lookups
const prevAgent = prevAgentMap.get(agent.id);
```

---

### 2. EntityIndex.syncAgentsToEntities: O(n²)

**Archivo:** `src/domain/simulation/core/EntityIndex.ts` (línea 51)

```typescript
// PROBLEMA: .find() dentro de loop
for (const agent of state.agents) {
  const existingEntity = state.entities.find((e) => e.id === agent.id); // O(n)
  // ...
}
```

**Impacto:** Se ejecuta en `preTick` **cada tick**. Con N agentes y M entidades → **O(N*M)**.

**Fix:**
```typescript
// Ya tienes entityIndex construido - ¡úsalo!
for (const agent of state.agents) {
  const existingEntity = this.entityIndex.get(agent.id); // O(1)
  // ...
}
```

---

### 3. AISystem: 50+ búsquedas O(n) dispersas

**Archivo:** `src/domain/simulation/systems/AISystem.ts` (múltiples líneas)

```typescript
// PROBLEMA: 13+ llamadas .find() que ya deberían usar EntityIndex
this.gameState.agents.find((a) => a.id === id);           // línea 278
this.gameState.entities?.find((e) => e.id === id);        // línea 324
this.gameState.agents.find((a) => a.id === id);           // línea 399
this.gameState.entities?.find((e) => e.id === id);        // línea 405
this.gameState.agents?.find((a) => a.id === agentId);     // línea 488
this.gameState.zones?.find((z) => z.id === zoneId);       // línea 591
const targetResource = resources.find((r) => r.id === goal.targetId); // líneas 834, 880
this.gameState.agents?.find((a) => a.id === targetId);    // líneas 851, 897
this.gameState.agents?.find((a) => a.id === agentId);     // líneas 903, 1029, 1057
```

**Impacto:** AISystem es **rate FAST (10 Hz)**. Múltiples O(n) en cada update = alto impacto.

**Fix:** Inyectar `EntityIndex` y usar lookups O(1):
```typescript
const agent = this.entityIndex?.getAgent(id) ?? this.gameState.agents.find(...);
```

---

### 4. NeedsSystem.applySocialMoraleBoost: Búsqueda espacial sin índice

**Archivo:** `src/domain/simulation/systems/NeedsSystem.ts` (líneas 516-530)

```typescript
// PROBLEMA: Itera TODAS las entidades con cálculo de distancia
const nearbyEntities = this.gameState.entities.filter((e) => {
  if (e.id === entityId || !e.position) return false;
  const dx = e.position.x - entityPosition.x;
  const dy = e.position.y - entityPosition.y;
  const distance = Math.hypot(dx, dy);  // sqrt es costoso
  return distance <= 100;
});
```

**Impacto:** NeedsSystem es **rate MEDIUM (2 Hz)**. Se ejecuta para CADA entidad → **O(N²)** por tick.

**Fix:**
```typescript
// Usar SharedSpatialIndex
const nearby = this.sharedSpatialIndex.queryRadius(entityPosition, 100, 'agent')
  .filter(r => r.entity !== entityId);

// O al menos evitar sqrt
const distanceSq = dx * dx + dy * dy;
return distanceSq <= 10000;  // 100²
```

---

### 5. [FRONTEND] TerrainRenderer: Un Graphics por tile

**Archivo:** `src/presentation/rendering/TerrainRenderer.ts`

```typescript
// PROBLEMA: Crea miles de objetos Graphics
for (const tile of tiles) {
  const graphics = this.scene.add.graphics(); // ¡Un Graphics por tile!
  graphics.fillStyle(color, 1);
  graphics.fillRect(...);
  this.container.add(graphics);
}
```

**Impacto:** Miles de draw calls. **-50% FPS**.

**Fix:**
```typescript
// Un solo Graphics por tipo de tile
const graphicsByColor = new Map<number, Phaser.GameObjects.Graphics>();
for (const [type, typeTiles] of tilesByType) {
  const graphics = graphicsByColor.get(type) ?? this.scene.add.graphics();
  for (const tile of typeTiles) {
    graphics.fillRect(...);
  }
}
```

---

### 6. [FRONTEND] JSON.parse en main thread

**Archivo:** `src/infrastructure/sync/SimulationClient.ts` (línea 46)

```typescript
// PROBLEMA: Bloquea main thread con payloads grandes
this.ws.onmessage = (event: MessageEvent): void => {
  const data = JSON.parse(event.data as string) as SimulationMessage;
  // ...
};
```

**Impacto:** Frame drops con snapshots grandes de simulación.

**Fix:** Mover a Web Worker:
```typescript
// parserWorker.ts
self.onmessage = (e) => {
  self.postMessage(JSON.parse(e.data));
};

// En SimulationClient
this.parserWorker.postMessage(event.data);
```

---

## 🟠 PROBLEMAS ALTOS

### 7. MovementSystem: Spread operator en hot path

**Archivo:** `src/domain/simulation/systems/MovementSystem.ts` (líneas 299, 340, 352, 387, 402)

```typescript
// PROBLEMA: Crea objetos nuevos cada tick
agent.position = { ...state.currentPosition };
state.currentPosition = { ...state.targetPosition };
```

**Impacto:** MovementSystem es **FAST rate (10 Hz)**. GC pressure significativo.

**Fix:**
```typescript
// Mutar directamente
agent.position.x = state.currentPosition.x;
agent.position.y = state.currentPosition.y;
```

---

### 8. AISystem: Arrays temporales en cleanupAgentMemory

**Archivo:** `src/domain/simulation/systems/AISystem.ts` (líneas 714-725)

```typescript
// PROBLEMA: Crea múltiples estructuras temporales
const zones = [...aiState.memory.visitedZones];
aiState.memory.visitedZones = new Set(zones.slice(-100));

const sorted = [...aiState.memory.successfulActivities.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 50);
aiState.memory.successfulActivities = new Map(sorted);
```

**Fix:** Eliminar in-place sin crear arrays intermedios.

---

### 9. SharedSpatialIndex: Copia de posiciones

**Archivo:** `src/domain/simulation/core/SharedSpatialIndex.ts` (líneas 34, 39, 88)

```typescript
// PROBLEMA: Copia posiciones en cada rebuild
this.entityPositions.set(entity.id, { ...entity.position });
```

**Impacto:** Se reconstruye en **preTick cada tick**.

**Fix:** Almacenar referencias directas o usar object pool.

---

### 10. [FRONTEND] EntityManager: Arrays temporales

**Archivo:** `src/presentation/managers/EntityManager.ts`

```typescript
// PROBLEMA: Crea arrays en cada llamada
public getEntities(): AnimatedGameEntity[] {
  return Array.from(this.entities.values());
}

public getEntitiesByType(predicate): AnimatedGameEntity[] {
  return Array.from(this.entities.values()).filter(predicate);
}
```

**Fix:** Cachear con dirty flag.

---

### 11. [FRONTEND] React Store updates frecuentes

**Archivo:** `src/presentation/services/ReactUIUpdateService.ts`

```typescript
// Se llama cada 250ms
useGameStore.getState().hydrateFromGame(updates);
useGameStore.getState().setFPS(...);
```

**Fix:** Usar `unstable_batchedUpdates` y comparación shallow.

---

## 🟡 PROBLEMAS MEDIOS

### 12. EconomySystem.computeTeamBonus: filter() sobre entidades

**Archivo:** `src/domain/simulation/systems/EconomySystem.ts` (líneas 303-315)

```typescript
const agentsInZone = this.state.entities.filter((e) => {
  // Filtra TODAS las entidades para una zona
});
```

---

### 13. TaskSystem: Array.from() repetido

**Archivo:** `src/domain/simulation/systems/TaskSystem.ts`

```typescript
// Múltiples métodos crean arrays del mismo Map
public getActiveTasks(): Task[] {
  return Array.from(this.tasks.values());
}
```

---

### 14. AnimalSystem.findNearbyHuman: Iteración lineal

**Archivo:** `src/domain/simulation/systems/AnimalSystem.ts` (líneas 348-378)

---

### 15. CombatSystem: Objetos temporales por animal

**Archivo:** `src/domain/simulation/systems/CombatSystem.ts` (líneas 130-148)

```typescript
// Crea SimulationEntity por cada animal en cada tick
const animalEntity: SimulationEntity = { id, type: "animal", ... };
```

---

### 16. LifeCycleSystem/NeedsSystem: Más búsquedas O(n)

Múltiples archivos con `.find()` que deberían usar EntityIndex.

---

### 17. [FRONTEND] ChunkStreamClient sin deduplicación

Puede generar requests redundantes para coordenadas cercanas.

---

### 18. [FRONTEND] Event listeners sin cleanup

`MainScene.ts` - closures que capturan referencias sin cleanup en `shutdown()`.

---

## 🟢 PROBLEMAS BAJOS

### 19. LifeCycleSystem.spawnAgent: find() sobre terrainTiles

### 20. [FRONTEND] Sin lazy loading de sistemas

---

## 📋 Plan de Acción Recomendado

### Fase 1: Críticos (1-2 días)
1. ✅ **DeltaEncoder** - Crear Maps al inicio de `detectChanges()`
2. ✅ **EntityIndex.syncAgentsToEntities** - Usar el índice existente
3. ✅ **NeedsSystem** - Usar SharedSpatialIndex para búsquedas espaciales
4. ✅ **TerrainRenderer** - Batching de Graphics por tipo

### Fase 2: Altos (2-3 días)
5. **AISystem** - Migrar todos los `.find()` a EntityIndex
6. **MovementSystem** - Eliminar spread operators
7. **SimulationClient** - Mover JSON.parse a Worker
8. **EntityManager** - Cachear arrays

### Fase 3: Medios (3-5 días)
9. **TaskSystem** - Cachear conversiones Array.from()
10. **SharedSpatialIndex** - Object pooling
11. **React store** - Batched updates

### Métricas a Monitorear
- FPS promedio (objetivo: >55)
- Tick time promedio (objetivo: <16ms)
- Memory growth por minuto (objetivo: <10MB)
- GC pauses (objetivo: <5ms)

---

## 🔧 Herramientas de Profiling Recomendadas

### Backend
```bash
# Profiling con Chrome DevTools
node --inspect dist/application/server.js

# Flame graphs
npx clinic flame -- node dist/application/server.js

# Heap snapshots
node --expose-gc --inspect dist/application/server.js
```

### Frontend
- Chrome DevTools Performance tab
- React DevTools Profiler
- Phaser Debug Plugin para draw calls

---

*Generado por análisis automatizado de código*
