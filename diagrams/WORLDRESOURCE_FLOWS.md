# 🌲 Sistema de Recursos del Mundo — v4

## 📊 Arquitectura del Sistema de Recursos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WORLD RESOURCE SYSTEM ARCHITECTURE                        │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     WorldResourceSystem                                 │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │ │
│  │  │  SpatialGrid    │  │  resources Map  │  │ regeneration    │         │ │
│  │  │  (100px cells)  │  │ (id → instance) │  │    Timers       │         │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  SPAWNING METHODS:                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. spawnResourcesInWorld()     │ World generation inicial               │ │
│  │ 2. spawnResourcesForChunk()    │ Lazy-loading por chunks (deduplicado) │ │
│  │ 3. spawnResource()             │ Spawn individual (usado por ambos)    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  QUERY METHODS:                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ • getResourcesInRadius(x, y, radius)  → Búsqueda espacial O(log n)     │ │
│  │ • getNearestResource(x, y, type?)     → Progresivo 200→500→1000→2000   │ │
│  │ • getResourcesByType(type)            → Filtrado por tipo              │ │
│  │ • getResourcesNear(position, radius)  → Sin índice espacial            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🌳 Tipos de Recursos

| Tipo | DisplayName | Interacción | Duración | Regenera | Biomas |
|------|-------------|-------------|----------|----------|--------|
| TREE | Árbol | CHOP | 3000ms | ✅ 5min | forest, mystical, grassland, village |
| ROCK | Roca | MINE | 4000ms | ✅ | mountain, desert, wasteland |
| BERRY_BUSH | Arbusto de bayas | GATHER | 2000ms | ✅ | forest, grassland |
| WATER_SOURCE | Fuente de agua | DRINK | 1000ms | ✅ | ocean, wetland |
| MUSHROOM_PATCH | Hongos | GATHER | 1500ms | ✅ | forest, mystical, wetland |
| WHEAT_CROP | Trigo | HARVEST | 2000ms | ✅ | grassland (farms) |
| TRASH_PILE | Basura | SCAVENGE | 2500ms | ❌ | wasteland, village |

---

## 🔄 Ciclo de Estados del Recurso

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RESOURCE STATE MACHINE                                │
│                                                                              │
│                    ┌──────────────┐                                         │
│                    │   PRISTINE   │  (100% yields)                          │
│                    └──────┬───────┘                                         │
│                           │ harvest (harvestCount < 70% max)                │
│                           ▼                                                  │
│                    ┌──────────────────────┐                                 │
│                    │  HARVESTED_PARTIAL   │  (50% yields)                   │
│                    └──────────┬───────────┘                                 │
│                               │ harvest (harvestCount >= max)               │
│                               ▼                                              │
│                    ┌──────────────┐                                         │
│                    │   DEPLETED   │  (0 yields)                             │
│                    └──────┬───────┘                                         │
│                           │                                                  │
│           ┌───────────────┴───────────────┐                                 │
│           │                               │                                  │
│           ▼                               ▼                                  │
│  ┌─────────────────┐           ┌─────────────────┐                          │
│  │ canRegenerate=  │           │ canRegenerate=  │                          │
│  │     true        │           │     false       │                          │
│  │ ─────────────── │           │ ─────────────── │                          │
│  │ Wait 60s        │           │ REMOVE resource │                          │
│  │ → PRISTINE      │           │ emit DEPLETED   │                          │
│  └─────────────────┘           └─────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗺️ Sistema de Chunks (Lazy Loading)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CHUNK-BASED SPAWNING                                  │
│                                                                              │
│  spawnResourcesForChunk(chunkCoords, chunkBounds, tiles)                    │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. chunkKey = `${x},${y}`                                              │ │
│  │ 2. IF spawnedChunks.has(chunkKey) → RETURN 0 (deduplicación)          │ │
│  │ 3. spawnedChunks.add(chunkKey)                                         │ │
│  │ 4. FOR each tile in tiles:                                             │ │
│  │    ├── IF water tile → spawn WATER_SOURCE                              │ │
│  │    ├── IF vegetation assets → mapAssetToResource() → spawn             │ │
│  │    └── IF decals → mapDecalToResource() → spawn (con probabilidad)     │ │
│  │ 5. RETURN spawnedCount                                                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ASSET MAPPING:                                                             │
│  ├── tree_* → TREE                                                          │
│  ├── plant_* → BERRY_BUSH                                                   │
│  ├── prop_rock* → ROCK                                                      │
│  └── decal_rock_* → ROCK (15% chance for bonus resources)                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📡 Sistema de Eventos

| Evento | Emisor | Trigger | Payload |
|--------|--------|---------|---------|
| RESOURCE_SPAWNED | spawnResource() | Nuevo recurso creado | { resource } |
| RESOURCE_STATE_CHANGE | harvestResource(), checkRegeneration() | Estado cambia | { resourceId, newState, harvesterId? } |
| RESOURCE_GATHERED | harvestResource() | Recolección exitosa | { resourceId, resourceType, harvesterId, position } |
| RESOURCE_DEPLETED | harvestResource(), removeResourcesInArea() | Recurso agotado | { resourceId, resourceType, position } |

---

## 🎯 Yields por Estado

### TREE (Árbol)
| Estado | Recurso | Min | Max | Secondary |
|--------|---------|-----|-----|-----------|
| PRISTINE | WOOD | 8 | 15 | - |
| HARVESTED_PARTIAL | WOOD | 3 | 7 | - |
| DEPLETED | WOOD | 0 | 0 | - |

### ROCK (Roca)
| Estado | Recurso | Min | Max | Secondary |
|--------|---------|-----|-----|-----------|
| PRISTINE | STONE | 10 | 20 | IRON_ORE (15%), COPPER_ORE (15%) |
| HARVESTED_PARTIAL | STONE | 4 | 10 | IRON_ORE (15%) |
| DEPLETED | STONE | 0 | 0 | - |

---

### Dependencias Inyectadas (InversifyJS)

| Sistema | Tipo | Estado | Notas |
|---------|------|--------|-------|
| GameState | @inject | ✅ | worldResources storage |
| StateDirtyTracker | @inject @optional | ✅ | Marca cambios para sync |

### Integración con Otros Sistemas

| Sistema | Método de Integración | Uso | Estado |
|---------|----------------------|-----|--------|
| BuildingSystem | Inyección directa | removeResourcesInArea(), spawnResource() | ✅ |
| AIActionExecutor | Via AISystem deps | harvestResource() | ✅ |
| NeedsSystem | Búsqueda de recursos | getNearestResource(), getResourcesInRadius() | ✅ |
| AnimalSystem | Búsqueda de comida | getResourcesInRadius() | ✅ |
| ChunkLoadingSystem | Spawn por chunks | spawnResourcesForChunk() | ✅ |

### SpatialGrid Operations

| Operación | Método | Complejidad | Estado |
|-----------|--------|-------------|--------|
| Insert | addResource() | O(1) | ✅ |
| Remove | removeResource() | O(1) | ✅ |
| Query Radius | getResourcesInRadius() | O(log n + k) | ✅ |
| Query Nearest | getNearestResource() | O(log n) progresivo | ✅ |

---

### Fortalezas del Sistema

- ✅ **Chunk-based spawning**: Lazy loading con deduplicación
- ✅ **SpatialGrid indexing**: Queries O(log n) en lugar de O(n)
- ✅ **Progressive search**: Evita buscar en todo el mapa
- ✅ **Asset-to-resource mapping**: Visuales son interactivos
- ✅ **State machine robusto**: PRISTINE → PARTIAL → DEPLETED → REGENERATE
- ✅ **Secondary yields**: Rocas dan piedra + chance de minerales
- ✅ **Event-driven**: Todos los cambios emiten eventos
- ✅ **Integration with building**: Limpia área, spawn crops

### Conectividad General
**Estado: 100% Conectado Correctamente**

```
WorldResourceSystem
    ├── @inject GameState ✅
    ├── @inject @optional StateDirtyTracker ✅
    ├── SpatialGrid (100px cells) ✅
    ├── resources Map<id, instance> ✅
    ├── spawnedChunks Set (deduplication) ✅
    ├── regenerationTimers Map ✅
    └── emit → RESOURCE_SPAWNED, RESOURCE_GATHERED, RESOURCE_DEPLETED, RESOURCE_STATE_CHANGE ✅

External Integration:
    ├── BuildingSystem → removeResourcesInArea(), spawnResource() ✅
    ├── AIActionExecutor → harvestResource() ✅
    ├── NeedsSystem → getNearestResource() ✅
    ├── AnimalSystem → getResourcesInRadius() ✅
    └── ChunkLoadingSystem → spawnResourcesForChunk() ✅
```

---

## 🗄️ Estructura de WorldResourceInstance

```typescript
interface WorldResourceInstance {
  id: string;                    // "resource_tree_1732801234567_a3b2c"
  type: WorldResourceType;       // TREE, ROCK, WATER_SOURCE, etc.
  position: { x: number; y: number };
  state: ResourceState;          // PRISTINE, HARVESTED_PARTIAL, DEPLETED
  harvestCount: number;          // Veces cosechado
  lastHarvestTime: number;       // Timestamp última cosecha
  biome: BiomeType;              // Bioma donde spawneó
  spawnedAt: number;             // Timestamp de creación
  regenerationStartTime?: number; // Cuando empezó regeneración
}
```
