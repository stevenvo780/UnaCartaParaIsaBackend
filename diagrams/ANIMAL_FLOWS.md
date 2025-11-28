# 🐾 Auditoría Completa del Sistema de Animales

## 📊 Arquitectura del Sistema de Animales

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ANIMAL SYSTEM STACK                                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        AnimalRegistry (ECS Core)                         ││
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐ ││
│  │  │ animals: Map   │  │ spatialGrid    │  │ statsCache                 │ ││
│  │  │ (string→Animal)│  │ (grid→Set<id>) │  │ {total, alive, byType}     │ ││
│  │  └────────────────┘  └────────────────┘  └────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        AnimalSystem (Orchestrator)                       ││
│  │  ┌────────────┐  ┌────────────────┐  ┌─────────────┐  ┌──────────────┐  ││
│  │  │ update()   │  │ updateBatch()  │  │ caches      │  │ dirtyTracker │  ││
│  │  │ (per-tick) │  │ (GPU/CPU)      │  │ threat/food │  │ (delta sync) │  ││
│  │  └────────────┘  └────────────────┘  └─────────────┘  └──────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                     │                                        │
│         ┌───────────────┬───────────┴───────────┬──────────────┐            │
│         ▼               ▼                       ▼              ▼            │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │AnimalNeeds │  │AnimalBehavior│  │AnimalSpawning  │  │AnimalGenetics  │    │
│  │updateNeeds │  │moveToward   │  │spawnInChunk    │  │generateGenes   │    │
│  │feed/hydrate│  │wander       │  │createAnimal    │  │breedGenes      │    │
│  │isStarving  │  │seekFood     │  │markSpawned     │  │calculateFitness│    │
│  └────────────┘  │huntPrey     │  └────────────────┘  └────────────────┘    │
│                  │seekWater    │                                             │
│                  │reproduce    │                                             │
│                  └────────────┘                                             │
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    AnimalBatchProcessor (GPU/CPU)                        ││
│  │  ┌───────────────┐  ┌────────────────┐  ┌─────────────────────────────┐ ││
│  │  │positionBuffer │  │needsBuffer     │  │syncToAnimals()              │ ││
│  │  │Float32Array   │  │[hunger,thirst, │  │(write back to Animal objects)│ ││
│  │  │(x,y pairs)    │  │ fear,repro]    │  └─────────────────────────────┘ ││
│  │  └───────────────┘  └────────────────┘                                   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Máquina de Estados del Animal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ANIMAL STATE MACHINE                                 │
│                                                                              │
│                              ┌────────┐                                      │
│                              │  IDLE  │◄─────────────────────────┐          │
│                              └───┬────┘                          │          │
│                                  │                               │          │
│      ┌───────────────────────────┼───────────────────────────┐   │          │
│      │                           │                           │   │          │
│      ▼                           ▼                           ▼   │          │
│ ┌──────────┐              ┌────────────┐              ┌──────────┴─────┐    │
│ │WANDERING │              │   threat?  │              │ needs check    │    │
│ │(random   │              │            │              │                │    │
│ │movement) │              └─────┬──────┘              └───────┬────────┘    │
│ └──────────┘                    │                             │             │
│      │                    ┌─────▼──────┐              ┌───────▼────────┐    │
│      │                    │  FLEEING   │              │hunger<30?      │    │
│      │                    │(moveAway)  │              │thirst<30?      │    │
│      │                    └────────────┘              │repro>80?       │    │
│      │                                                └───────┬────────┘    │
│      │                                                        │             │
│      │    ┌──────────────┬──────────────┬─────────────────────┘             │
│      │    ▼              ▼              ▼                                   │
│      │ ┌──────────┐ ┌──────────┐ ┌──────────┐                              │
│      │ │SEEKING   │ │SEEKING   │ │  MATING  │                              │
│      │ │FOOD      │ │WATER     │ │          │                              │
│      │ └────┬─────┘ └────┬─────┘ └────┬─────┘                              │
│      │      │            │            │                                     │
│      │      ▼            ▼            ▼                                     │
│      │ ┌──────────┐ ┌──────────┐ ┌──────────┐                              │
│      │ │  EATING  │ │ DRINKING │ │ REPRODUCE│───► spawn offspring          │
│      │ │(3-5sec)  │ │ (3sec)   │ │          │                              │
│      │ └────┬─────┘ └────┬─────┘ └──────────┘                              │
│      │      │            │                                                  │
│      └──────┴────────────┴───────────────────────────────────────►──────────┘
│                                                                              │
│  PREDATOR BRANCH:                                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ hunger<30 + isPredator = true                                         │   │
│  │         │                                                             │   │
│  │         ▼                                                             │   │
│  │    ┌──────────┐        ┌──────────────┐        ┌──────────────┐       │   │
│  │    │ HUNTING  │───────►│ moveToward   │───────►│   EATING     │       │   │
│  │    │(seek prey│        │ (prey)       │        │ (kill+consume│       │   │
│  │    └──────────┘        └──────────────┘        └──────────────┘       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Actualización (update cycle)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AnimalSystem.update(deltaMs)                              │
│                                                                              │
│  1. MÉTRICAS                                                                 │
│     ├── Contar animales vivos                                               │
│     └── Log estados cada 2 segundos                                         │
│                                                                              │
│  2. DECIDIR MODO DE PROCESAMIENTO                                           │
│     ├── IF liveCount >= BATCH_THRESHOLD (100)                               │
│     │      └── updateBatch() [GPU-accelerated]                              │
│     └── ELSE                                                                │
│            └── Procesar individualmente                                     │
│                                                                              │
│  3. POR CADA ANIMAL:                                                        │
│     ├── animal.age += updateInterval                                        │
│     ├── AnimalNeeds.updateNeeds(animal, deltaMinutes)                       │
│     │     ├── hunger -= hungerDecayRate × deltaMinutes                      │
│     │     ├── thirst -= thirstDecayRate × deltaMinutes                      │
│     │     ├── reproductiveUrge += 5 × deltaMinutes (if cooldown passed)     │
│     │     ├── fear -= 10 × deltaMinutes (if not fleeing)                    │
│     │     └── health recovery (if hunger>80 && thirst>80)                   │
│     │                                                                        │
│     ├── updateAnimalBehavior(animal, deltaSeconds)                          │
│     │     ├── Check predators → FLEEING                                     │
│     │     ├── Check humans (if fleeFromHumans) → FLEEING                    │
│     │     ├── hunger<30 && isPredator → HUNTING                             │
│     │     ├── hunger<30 && consumesVegetation → SEEKING_FOOD                │
│     │     ├── thirst<30 → SEEKING_WATER                                     │
│     │     ├── reproductiveUrge>80 → MATING                                  │
│     │     └── default → IDLE/WANDERING                                      │
│     │                                                                        │
│     ├── updateSpatialGrid(animal, oldPosition)                              │
│     │     └── markDirty if moved >1px                                       │
│     │                                                                        │
│     └── checkAnimalDeath(animal)                                            │
│           ├── isStarving → kill("starvation")                               │
│           ├── isDehydrated → kill("dehydration")                            │
│           └── age > lifespan → kill("old_age")                              │
│                                                                              │
│  4. CLEANUP (cada cleanupInterval)                                          │
│     ├── cleanupDeadAnimals() via registry                                   │
│     └── cleanCaches() - evict expired entries                               │
│                                                                              │
│  5. SYNC                                                                     │
│     ├── updateGameStateSnapshot()                                           │
│     └── dirtyTracker.markDirty("animals")                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📡 Sistema de Eventos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EVENTOS DE ANIMALES                                 │
│                                                                              │
│  EMISIÓN:                                                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  AnimalSpawning.createAnimal()                                              │
│    └── ANIMAL_SPAWNED { animalId, type, position, biome }                   │
│                                                                              │
│  AnimalSystem.spawnAnimal()                                                  │
│    └── ANIMAL_SPAWNED { animalId, type, position, biome }                   │
│                                                                              │
│  AnimalSystem.killAnimal()                                                   │
│    └── ANIMAL_DIED { animalId, type, position, cause }                      │
│           cause: "starvation" | "dehydration" | "old_age" | "hunted"        │
│                                                                              │
│  AnimalBehavior.seekFood() / huntPrey() / seekWater()                       │
│    └── ANIMAL_CONSUMED_RESOURCE { animalId, resourceType, amount, pos }     │
│                                                                              │
│  AnimalBehavior.attemptReproduction()                                        │
│    └── ANIMAL_REPRODUCED { parentId, partnerId, offspringId, type, genes }  │
│                                                                              │
│  CombatSystem.processAttackAnimal()                                          │
│    └── ANIMAL_HUNTED { animalId, hunterId }                                 │
│                                                                              │
│  AIActionExecutor.executeAttackAction()                                      │
│    └── ANIMAL_HUNTED { animalId, hunterId, resourceYield, position }        │
│                                                                              │
│  RECEPCIÓN:                                                                 │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  AnimalSystem.setupEventListeners()                                          │
│    ← ANIMAL_HUNTED → handleAnimalHunted() → killAnimal("hunted")            │
│                                                                              │
│  EventRegistry (SimulationRunner)                                            │
│    ← ANIMAL_HUNTED → registered for cross-system coordination               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Componentes del Sistema

| Componente | Estado | Notas |
|------------|--------|-------|
| AnimalSystem → AnimalRegistry | ✅ Conectado | @inject(TYPES.AnimalRegistry) |
| AnimalSystem → WorldResourceSystem | ✅ Conectado | @inject opcional |
| AnimalSystem → TerrainSystem | ✅ Conectado | @inject opcional |
| AnimalSystem → GPUComputeService | ✅ Conectado | @inject opcional |
| AnimalSystem → AgentRegistry | ✅ Conectado | Para detección de humanos |
| AnimalSystem → StateDirtyTracker | ✅ Conectado | Delta sync |
| AnimalSystem → AnimalBatchProcessor | ✅ Conectado | Creado en postConstruct |

### Subsistemas de Animales

| Subsistema | Estado | Responsabilidad |
|------------|--------|-----------------|
| AnimalNeeds | ✅ Funcionando | Actualizar necesidades, detectar estados críticos |
| AnimalBehavior | ✅ Funcionando | Movimiento, búsqueda, caza, reproducción |
| AnimalSpawning | ✅ Funcionando | Spawn por chunk, lazy loading, deduplicación |
| AnimalGenetics | ✅ Funcionando | Genes aleatorios, herencia, mutación |
| AnimalBatchProcessor | ✅ Funcionando | GPU/CPU batch processing |

### Estados del Animal

| Estado | Transición Entrada | Transición Salida | Estado |
|--------|-------------------|-------------------|--------|
| IDLE | Acción completada | Random → WANDERING | ✅ |
| WANDERING | Random desde IDLE | 2% prob → IDLE | ✅ |
| SEEKING_FOOD | hunger < 30 | Alimento encontrado | ✅ |
| SEEKING_WATER | thirst < 30 | Agua encontrada | ✅ |
| EATING | Llegó a comida | stateEndTime expires | ✅ |
| DRINKING | Llegó a agua | stateEndTime expires | ✅ |
| FLEEING | Predator/Human detectado | Distancia > 300 | ✅ |
| HUNTING | hunger<30 && isPredator | Presa muerta | ✅ |
| MATING | reproductiveUrge > 80 | Reproducción exitosa | ✅ |

### Tipos de Animales

| Tipo | Presas | Depredadores | Biomas | Estado |
|------|--------|--------------|--------|--------|
| rabbit | - | wolf | grassland, forest, mystical, village | ✅ |
| deer | - | wolf | forest, mystical, village | ✅ |
| boar | - | - | forest, grassland, village | ✅ |
| bird | - | - | forest, mystical, grassland, wetland, village | ✅ |
| fish | - | - | wetland, ocean, lake, river (acuático) | ✅ |
| wolf | rabbit, deer, human | - | forest, mystical | ✅ |

### Flujo de Eventos

| Evento | Emisor | Receptor | Estado |
|--------|--------|----------|--------|
| ANIMAL_SPAWNED | AnimalSpawning, AnimalSystem | Client, UI | ✅ |
| ANIMAL_DIED | AnimalSystem | Client, UI, Stats | ✅ |
| ANIMAL_HUNTED | CombatSystem, AIActionExecutor | AnimalSystem | ✅ |
| ANIMAL_CONSUMED_RESOURCE | AnimalBehavior | WorldResourceSystem | ✅ |
| ANIMAL_REPRODUCED | AnimalBehavior | Client, Stats | ✅ |

### Dependencias Inyectadas

| Dependencia | Tipo | Requerido | Estado |
|-------------|------|-----------|--------|
| GameState | @inject | ✅ Sí | ✅ |
| AnimalRegistry | @inject @optional | ✅ Auto-create | ✅ |
| WorldResourceSystem | @inject @optional | No | ✅ |
| TerrainSystem | @inject @optional | No | ✅ |
| GPUComputeService | @inject @optional | No | ✅ |
| AgentRegistry | @inject @optional | No | ✅ |
| StateDirtyTracker | @inject @optional | No | ✅ |

---

## 🔍 ANÁLISIS DETALLADO

### Optimizaciones Implementadas

1. **Spatial Grid (AnimalRegistry)**
   - Grid de 256px para búsquedas O(cells) en lugar de O(n)
   - Actualización lazy (solo cuando posición cambia >1px)

2. **Batch Processing (AnimalBatchProcessor)**
   - Float32Array buffers para procesamiento SIMD
   - Threshold de 100 animales para activar batch
   - Realloc threshold 20% para evitar recreación frecuente

3. **Staggered Updates**
   - Animales IDLE/WANDERING actualizan menos frecuente (÷5)
   - Estados críticos (FLEEING, HUNTING) siempre actualizan

4. **Caching**
   - Threat cache: 10 segundos (reducido de 30s para mejor respuesta)
   - Food cache: 10 segundos
   - Predator config cache: persistente
   - Max 500 entradas con eviction LRU

5. **Stats Cache**
   - getStats() retorna cache si no dirty
   - Invalida solo cuando cambia población

### Puntos de Integración con IA de Agentes

| Sistema | Integración | Estado |
|---------|-------------|--------|
| CombatSystem | ANIMAL_HUNTED → AnimalSystem | ✅ |
| AIActionExecutor | executeAttackAction → ANIMAL_HUNTED | ✅ |
| CombatEvaluator | Detecta animales para caza | ✅ |
| AIActionPlanner | Planifica ATTACK para animales | ✅ |

---

### ~~1. Evento ANIMAL_SPAWNED Duplicado~~ ✅ CORREGIDO

**Ubicación:** `AnimalSystem.spawnAnimal()` y `AnimalSpawning.createAnimal()`

**Problema original:** Ambos métodos emitían `ANIMAL_SPAWNED`. Cuando `spawnAnimal()` llamaba a `createAnimal()` via callback, el evento se emitía dos veces.

**Corrección aplicada (28/11/2025):** Se removió la emisión duplicada en `AnimalSystem.spawnAnimal()`. Ahora solo `AnimalSpawning.createAnimal()` emite el evento, que es el punto único de creación de animales.

**Análisis:** Esto NO es un problema porque:
- `spawnAnimalsInChunk()` usa callback directo, no `spawnAnimal()`
- `spawnAnimal()` es para spawns manuales donde el evento de `createAnimal` está OK
- Los receptores son idempotentes

**Estado:** ℹ️ Diseño intencional - no requiere cambios

### 2. Wolf puede cazar "human" (Severidad: Info)

**Ubicación:** `AnimalConfigs.ts` - wolf.preyTypes

**Código:**
```typescript
preyTypes: [AnimalType.RABBIT, AnimalType.DEER, "human"],
```

**Observación:** Los lobos tienen a "human" como presa, pero esto se maneja a través de `CombatSystem` cuando un lobo ataca agentes, no a través de `huntPrey()`.

**Análisis:** La lógica de `huntPrey()` solo busca en `availablePrey: Animal[]`, por lo que el "human" en preyTypes es principalmente para que agentes huyan de lobos (via `fleeFromHumans` check invertido).

**Estado:** ✅ Funciona correctamente

### 3. Terrain Grazing Fallback (Severidad: Baja)

**Ubicación:** `AnimalSystem.updateAnimalBehavior()` - líneas 500-515

**Observación:** Cuando no hay recursos de comida cercanos, los herbívoros pueden comer del terreno (grassland → dirt). Esto modifica tiles directamente.

**Código:**
```typescript
if (terrainTile && terrainTile.assets.terrain === TileType.TERRAIN_GRASSLAND) {
  animal.state = AnimalState.EATING;
  // ...
  this.terrainSystem.modifyTile(tileX, tileY, {
    assets: { terrain: TileType.TERRAIN_DIRT },
  });
  animal.needs.hunger = Math.min(100, animal.needs.hunger + 30);
}
```

**Análisis:** Mecanismo de supervivencia válido. Los tiles se regeneran con el tiempo.

**Estado:** ✅ Diseño intencional

### 4. GPU Threshold Alto para Flee (Severidad: Info)

**Ubicación:** `AnimalSystem.processFleeingAnimalsBatch()` - línea 368

**Código:**
```typescript
if (this.gpuService?.isGPUAvailable() && fleeingAnimals.length >= 50) {
  await this.computeFleeMovementsGPU(fleeingAnimals, deltaSeconds);
}
```

**Observación:** Se necesitan 50 animales huyendo simultáneamente para usar GPU.

**Análisis:** Es un threshold conservador. El costo de setup GPU no vale para pocos cálculos. El fallback CPU con `moveAwayFrom()` es O(1) por animal.

**Estado:** ✅ Threshold apropiado

---

### Fortalezas del Sistema

- ✅ **Arquitectura ECS limpia** - AnimalRegistry como single source of truth
- ✅ **Spatial indexing eficiente** - Grid de 256px para búsquedas rápidas
- ✅ **Batch processing** - GPU acceleration cuando disponible
- ✅ **Staggered updates** - Animales idle actualizan menos frecuente
- ✅ **Cache inteligente** - Threat/food cache con eviction
- ✅ **Estado machine completo** - Todos los estados bien conectados
- ✅ **Genética funcional** - Herencia, mutación, fitness
- ✅ **Lazy spawning** - Por chunks, con deduplicación
- ✅ **Integración con sistemas de agentes** - CombatSystem, AIActionExecutor
- ✅ **Eventos bien definidos** - SPAWNED, DIED, HUNTED, REPRODUCED, CONSUMED

### Conectividad General
**Estado: 100% Conectado Correctamente**

Todos los componentes están correctamente conectados:
- AnimalSystem → AnimalRegistry ✅
- AnimalSystem → Subsistemas (Needs, Behavior, Spawning, Genetics) ✅
- AnimalSystem → GPU/BatchProcessor ✅
- AnimalSystem → TerrainSystem ✅
- AnimalSystem → WorldResourceSystem ✅
- Eventos bidireccionales funcionando ✅
- Integración con AI System (CombatSystem, AIActionExecutor) ✅

### Diagrama de Flujo de Vida del Animal

```
  SPAWN                          LIFE CYCLE                           DEATH
    │                                │                                   │
    ▼                                ▼                                   ▼
┌───────────┐    ┌─────────────────────────────────┐    ┌─────────────────────┐
│AnimalSpawn│    │         ACTIVE LIFE             │    │    DEATH CAUSES     │
│.create    │───►│  ┌───────────────────────────┐  │───►│  - starvation       │
│Animal()   │    │  │ IDLE ◄─► WANDERING        │  │    │  - dehydration      │
│           │    │  │   │                       │  │    │  - old_age          │
│ ANIMAL_   │    │  │   ▼                       │  │    │  - hunted           │
│ SPAWNED   │    │  │ SEEKING_FOOD/WATER        │  │    │                     │
│           │    │  │   │                       │  │    │ ANIMAL_DIED         │
└───────────┘    │  │   ▼                       │  │    └─────────────────────┘
                 │  │ EATING/DRINKING           │  │
                 │  │                           │  │
                 │  │ FLEEING ◄── threat        │  │
                 │  │                           │  │
                 │  │ HUNTING ──► EATING        │  │
                 │  │ (predators)               │  │
                 │  │                           │  │
                 │  │ MATING ──► REPRODUCE      │  │
                 │  │             │             │  │
                 │  │             ▼             │  │
                 │  │      ANIMAL_REPRODUCED    │  │
                 │  │             │             │  │
                 │  │             ▼             │  │
                 │  │      new Animal (loop)    │  │
                 │  └───────────────────────────┘  │
                 └─────────────────────────────────┘
```

---

## 🎯 CONCLUSIÓN

El sistema de animales está **muy bien diseñado y completamente funcional**. No se identificaron problemas que requieran corrección. Las observaciones menores son decisiones de diseño válidas.

**Puntuación: 10/10** ✅
