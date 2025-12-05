# 🧠 Sistema de Necesidades — v4

## 📊 Arquitectura del Sistema de Necesidades

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NEEDS SYSTEM STACK                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        NeedsSystem (Orchestrator)                        ││
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐ ││
│  │  │ entityNeeds    │  │ config         │  │ respawnQueue               │ ││
│  │  │ Map<id,Needs>  │  │ NeedsConfig    │  │ Map<id,respawnTime>        │ ││
│  │  └────────────────┘  └────────────────┘  └────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                     │                                        │
│         ┌───────────────────────────┼───────────────────────────────────┐   │
│         ▼                           ▼                           ▼           │
│  ┌────────────────┐     ┌────────────────┐         ┌────────────────────┐   │
│  │InventorySystem│     │  SocialSystem  │         │ LifeCyclePort      │   │
│  │ getAgentInv   │     │ getAffinity    │         │ getAgent           │   │
│  │ removeFromAgt │     │ morale boost   │         │ age multipliers    │   │
│  └────────────────┘     └────────────────┘         └────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         7 Need Types                                     ││
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐ ┌───┐ ┌────────┐ ││
│  │  │HUNGER  │ │THIRST  │ │ENERGY  │ │HYGIENE │ │SOCIAL│ │FUN│ │MENTAL  │ ││
│  │  │decay:  │ │decay:  │ │decay:  │ │decay:  │ │decay:│ │dec│ │HEALTH  │ ││
│  │  │0.2/s   │ │0.3/s   │ │0.15/s  │ │0.1/s   │ │0.15/s│ │0.15│ │0.08/s  │ ││
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └──────┘ └───┘ └────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                      NeedsBatchProcessor (GPU/CPU)                       ││
│  │  ┌────────────────────────┐  ┌────────────────────────────────────────┐ ││
│  │  │ needsBuffer            │  │ NEED_COUNT = 7                         │ ││
│  │  │ Float32Array           │  │ rebuildBuffers(), applyDecayBatch()    │ ││
│  │  │ (7 needs × entities)   │  │ applyCrossEffectsBatch(), syncToMap()  │ ││
│  │  └────────────────────────┘  └────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         Zone Bonus System                                ││
│  │  ┌────────────────────┐  ┌────────────────────────────────────────────┐ ││
│  │  │ zoneCache          │  │ Zone Types → Need Bonuses                  │ ││
│  │  │ Map<pos,zones>     │  │ HYGIENE: +2 hygiene                        │ ││
│  │  │ TTL: 15 seconds    │  │ SOCIAL/MARKET: +1.5 social, +1.0 fun       │ ││
│  │  └────────────────────┘  │ ENTERTAINMENT: +2.5 fun, +1.0 mental       │ ││
│  │                          │ TEMPLE: +2.0 mental, +0.5 social           │ ││
│  │                          └────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Actualización

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NeedsSystem.update(deltaTimeMs)                           │
│                                                                              │
│  1. RESPAWN QUEUE PROCESSING                                                │
│     └── processRespawnQueue(now) - Respawn entidades muertas               │
│                                                                              │
│  2. SYNC NEEDS WITH AGENTS                                                  │
│     └── syncNeedsWithAgents() - Auto-initialize missing needs              │
│           ├── Initialize if !existingNeeds                                  │
│           └── Re-initialize if corrupted (hunger/thirst/energy <= 0)       │
│                                                                              │
│  3. ZONE CACHE CLEANUP (cada 100 ticks)                                     │
│     └── cleanZoneCache(now)                                                 │
│                                                                              │
│  4. INTERVAL CHECK (updateIntervalMs = 1000)                                │
│     └── Skip if too soon                                                    │
│                                                                              │
│  5. BATCH vs TRADITIONAL PROCESSING                                         │
│     ├── IF entityNeeds.size >= BATCH_THRESHOLD (5)                          │
│     │      └── updateBatch(dtSeconds, now)                                  │
│     └── ELSE                                                                │
│            └── updateTraditional(dtSeconds, now)                            │
│                                                                              │
│  TRADITIONAL UPDATE (per entity):                                           │
│  ──────────────────────────────────────────────────────────────────────────│
│  ├── applyNeedDecay(needs, dtSeconds, entityId, action)                     │
│  ├── consumeResourcesForNeeds(entityId, needs)                              │
│  ├── applySocialMoraleBoost(entityId, needs)                                │
│  ├── applyCrossEffects(needs) if enabled                                    │
│  ├── checkForDeath(entityId, needs)                                         │
│  ├── checkEmergencyNeeds(entityId, needs)                                   │
│  └── emitNeedEvents(entityId, needs)                                        │
│                                                                              │
│  BATCH UPDATE:                                                              │
│  ──────────────────────────────────────────────────────────────────────────│
│  ├── batchProcessor.rebuildBuffers(entityNeeds)                             │
│  ├── Build ageMultipliers, divineModifiers arrays                          │
│  ├── batchProcessor.applyDecayBatch(...)                                    │
│  ├── batchProcessor.applyCrossEffectsBatch() if enabled                     │
│  ├── batchProcessor.syncToMap(entityNeeds)                                  │
│  ├── applySocialMoraleBoostBatch(entityIds)                                 │
│  └── Per-entity: consumeResources, checkDeath, emitEvents                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📡 Sistema de Eventos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EVENTOS DE NECESIDADES                              │
│                                                                              │
│  EMISIÓN:                                                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  NeedsSystem.consumeResourcesForNeeds()                                     │
│    └── RESOURCE_CONSUMED { agentId, resourceType, amount, needType, newVal }│
│                                                                              │
│  NeedsSystem.handleEntityDeath()                                            │
│    └── AGENT_DEATH { agentId, cause, needs, timestamp }                     │
│          cause: "starvation" | "dehydration" | "exhaustion"                 │
│                                                                              │
│  NeedsSystem.respawnEntity()                                                │
│    └── AGENT_RESPAWNED { agentId, timestamp }                               │
│                                                                              │
│  NeedsSystem.emitNeedEvents()                                               │
│    ├── NEED_CRITICAL { agentId, need, value } (si < criticalThreshold)      │
│    └── NEED_SATISFIED { agentId, need, value } (si hunger > 90)             │
│                                                                              │
│  INTEGRACIONES EXTERNAS:                                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  LifeCycleSystem                                                             │
│    ← AGENT_DEATH → Procesa muerte del agente                                │
│                                                                              │
│  ResourceReservationSystem                                                   │
│    ← NEED_SATISFIED → Libera reservaciones de recursos                      │
│                                                                              │
│  EventRegistry                                                               │
│    ← NEED_CRITICAL → Coordinación cross-system                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Componentes del Sistema

| Componente | Estado | Notas |
|------------|--------|-------|
| NeedsSystem → GameState | ✅ Conectado | @inject(TYPES.GameState) |
| NeedsSystem → EntityIndex | ✅ Conectado | @inject @optional |
| NeedsSystem → SharedSpatialIndex | ✅ Conectado | @inject @optional |
| NeedsSystem → GPUComputeService | ✅ Conectado | @inject @optional |
| NeedsSystem → AgentRegistry | ✅ Conectado | @inject @optional |
| NeedsSystem → StateDirtyTracker | ✅ Conectado | @inject @optional |
| NeedsSystem → InventorySystem | ✅ Conectado | Via setDependencies() |
| NeedsSystem → SocialSystem | ✅ Conectado | Via setDependencies() |
| NeedsSystem → LifeCyclePort | ✅ Conectado | Via setDependencies() |

### Tipos de Necesidades

| Necesidad | Decay Rate | Threshold Crítico | Threshold Muerte | Estado |
|-----------|------------|-------------------|------------------|--------|
| HUNGER | 0.2/s | 20 | 0 | ✅ |
| THIRST | 0.3/s | 20 | 0 | ✅ |
| ENERGY | 0.15/s | 20 | 0 | ✅ |
| HYGIENE | 0.1/s | 20 | - | ✅ |
| SOCIAL | 0.15/s | 20 | - | ✅ |
| FUN | 0.15/s | 20 | - | ✅ |
| MENTAL_HEALTH | 0.08/s | 20 | - | ✅ |

### Multiplicadores por Edad

| Life Stage | Multiplicador | Descripción |
|------------|---------------|-------------|
| CHILD | 0.7 | Decay más lento |
| ADULT | 1.0 | Decay normal |
| ELDER | 1.4 | Decay más rápido |

### Bonuses de Zona

| Zona | Bonus | Necesidades Afectadas |
|------|-------|----------------------|
| HYGIENE/BATH/WELL | +2.0 | hygiene |
| SOCIAL/MARKET/GATHERING/TAVERN | +1.5/+1.0 | social, fun |
| ENTERTAINMENT/FESTIVAL | +2.5/+1.0 | fun, mentalHealth |
| TEMPLE/SANCTUARY | +2.0/+0.5 | mentalHealth, social |
| SHELTER/REST | 3x multiplier | energy recovery |

### Flujo de Eventos

| Evento | Emisor | Receptor | Estado |
|--------|--------|----------|--------|
| RESOURCE_CONSUMED | NeedsSystem | Client, Stats | ✅ |
| AGENT_DEATH | NeedsSystem | LifeCycleSystem | ✅ |
| AGENT_RESPAWNED | NeedsSystem | Client, AI | ✅ |
| NEED_CRITICAL | NeedsSystem | EventRegistry | ✅ |
| NEED_SATISFIED | NeedsSystem | ResourceReservation | ✅ |

---

## 🔍 ANÁLISIS DETALLADO

### Optimizaciones Implementadas

1. **Batch + GPU (opcional)**
   - NeedsBatchProcessor opera sobre `Float32Array` (7 necesidades × N)
   - Intento de uso de GPUComputeService cuando está disponible; fallback a CPU si no hay aceleración o falla la llamada
   - applyDecayBatch() y applyCrossEffectsBatch() vectorizados

2. **Social Morale GPU Acceleration**
   - Pairwise distance computation para >= 20 entidades
   - SharedSpatialIndex para entidades < 20
   - Affinity lookup batched

3. **Zone Caching**
   - zoneCache con TTL de 15 segundos
   - Cache key basado en posición / 100
   - Cleanup automático cada 100 ticks

4. **Auto-sync with Agents**
   - syncNeedsWithAgents() auto-inicializa missing
   - Detecta y corrige necesidades corruptas (<=0)
   - Log de debugging para troubleshooting

### Sistema de Consumo de Recursos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RESOURCE CONSUMPTION                                      │
│                                                                              │
│  consumeResourcesForNeeds(entityId, needs)                                  │
│                                                                              │
│  HUNGER:                                                                    │
│    IF hunger < 70 && inv.food > 0:                                          │
│      urgency = hunger < 30 ? 2 : 1                                          │
│      toConsume = min(urgency, inv.food)                                     │
│      hungerRestore = removed * 15                                           │
│      → Emit RESOURCE_CONSUMED                                               │
│                                                                              │
│  THIRST:                                                                    │
│    IF thirst < 70 && inv.water > 0:                                         │
│      urgency = thirst < 30 ? 2 : 1                                          │
│      toConsume = min(urgency, inv.water)                                    │
│      thirstRestore = removed * 20                                           │
│      → Emit RESOURCE_CONSUMED                                               │
│                                                                              │
│  ENERGY (zone-based):                                                       │
│    IF action === SLEEP: baseRecovery = 3                                    │
│    IF action === IDLE: baseRecovery = 1                                     │
│    IF in SHELTER/REST zone: multiplier = 3x                                 │
│    energyRecovery = baseRecovery * multiplier                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cross-Effects System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CROSS-EFFECTS                                             │
│                                                                              │
│  applyCrossEffects(needs)                                                   │
│                                                                              │
│  LOW ENERGY (< 30):                                                         │
│    penalty = (30 - energy) * 0.02                                           │
│    social -= penalty                                                        │
│    fun -= penalty                                                           │
│    mentalHealth -= penalty * 1.5                                            │
│                                                                              │
│  LOW HUNGER (< 40):                                                         │
│    hungerPenalty = (40 - hunger) * 0.03                                     │
│    energy -= hungerPenalty                                                  │
│    mentalHealth -= hungerPenalty * 0.5                                      │
│                                                                              │
│  LOW THIRST (< 30):                                                         │
│    thirstPenalty = (30 - thirst) * 0.05                                     │
│    energy -= thirstPenalty * 2                                              │
│    mentalHealth -= thirstPenalty                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Social Morale Boost

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SOCIAL MORALE BOOST                                       │
│                                                                              │
│  applySocialMoraleBoost(entityId, needs)                                    │
│                                                                              │
│  1. Find nearby entities (radius = 100)                                     │
│  2. Calculate average affinity with nearby entities                         │
│  3. Apply boosts based on affinity:                                         │
│                                                                              │
│  IF avgAffinity > 0.5:                                                      │
│    boost = min(0.5, avgAffinity * 0.3)                                      │
│    social += boost                                                          │
│    fun += boost * 0.8                                                       │
│                                                                              │
│  ELIF avgAffinity > 0.2:                                                    │
│    boost = avgAffinity * 0.15                                               │
│    social += boost                                                          │
│    fun += boost * 0.6                                                       │
│                                                                              │
│  IF affinityCount >= 3 && avgAffinity > 0.3:                               │
│    social += 2 (group bonus)                                                │
│    fun += 1                                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### FoodCatalog Integration

```typescript
// NeedsSystem integra con FoodCatalog para efectos de comida
public applyFoodEffects(entityId: string, foodId: string): {
  hunger: number;
  happiness: number;
  energy: number;
  health: number;
} | null

public getRecommendedFoodForEntity(entityId: string, availableMoney: number): FoodItem[]
public getFoodsByCategory(category: FoodCategory): FoodItem[]
```

---

### Sistemas de Protección

- **Recuperación de emergencia.** `checkEmergencyNeeds()` intenta consumir inventario (`tryEmergencyFood/Water`). Si no hay recursos, aplica un `+0.5` pasivo a hambre y sed para dar tiempo a los planificadores. ENERGY recibe un descanso emergente.
- **Entidades inmortales.** En `checkForDeath()` se garantiza que hunger/thirst/energy no bajen de 20 para perfiles con `immortal = true`, manteniendo vivos a NPCs narrativos mientras siguen participando en la simulación.
- **Reactivación tras respawn.** `respawnEntity()` reestablece estadísticos y marca `agent.isDead = false` en `gameState.agents`. Aunque LifeCycleSystem es quien maneja las muertes (via `AGENT_DEATH`), NeedsSystem es el módulo que programa y ejecuta la reaparición.

---

### Fortalezas del Sistema

- ✅ **7 necesidades completas** - hunger, thirst, energy, hygiene, social, fun, mentalHealth
- ✅ **GPU batch processing** - NeedsBatchProcessor para eficiencia
- ✅ **Cross-effects** - Necesidades se afectan entre sí
- ✅ **Social morale boost** - Boost por estar cerca de amigos
- ✅ **Zone bonuses** - Zonas específicas mejoran necesidades
- ✅ **Age multipliers** - CHILD/ADULT/ELDER con decay diferente
- ✅ **Auto-sync** - Inicializa y corrige necesidades automáticamente
- ✅ **Emergency system** - Recuperación pasiva en emergencias
- ✅ **Respawn system** - Permite respawn después de muerte
- ✅ **FoodCatalog integration** - Efectos específicos por comida
- ✅ **Eventos bien definidos** - CRITICAL, SATISFIED, DEATH, RESPAWNED

### Conectividad General
**Estado: 100% Conectado Correctamente**

Todos los componentes están correctamente conectados:
- NeedsSystem → InventorySystem ✅
- NeedsSystem → SocialSystem ✅
- NeedsSystem → LifeCyclePort ✅
- NeedsSystem → GPUComputeService ✅
- NeedsSystem → SharedSpatialIndex ✅
- NeedsSystem → AgentRegistry ✅
- Eventos bidireccionales funcionando ✅
- Sincronización con GameState.agents ✅

---

## 📌 Resumen Operativo

NeedsSystem garantiza decadencias consistentes, integra boosts sociales/zona y aplica salvaguardas (emergencias, inmortalidad, respawn) para que la simulación no se estanque. Esta documentación refleja el comportamiento válido en `NeedsSystem`, `NeedsBatchProcessor` y servicios asociados.
