# ⚔️ Sistema de Combate — v4

## 📊 Arquitectura del Sistema de Combate

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMBAT SYSTEM STACK                                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        CombatSystem (Orchestrator)                       ││
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐ ││
│  │  │ equippedWeapons│  │ lastAttackAt   │  │ combatLog                  │ ││
│  │  │ Map<id,WeaponId│  │ Map<id,time>   │  │ CombatLogEntry[]           │ ││
│  │  └────────────────┘  └────────────────┘  └────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                     │                                        │
│         ┌───────────────────────────┼───────────────────────────┐           │
│         ▼                           ▼                           ▼           │
│  ┌────────────────┐     ┌────────────────┐         ┌────────────────────┐   │
│  │SharedSpatialIdx│     │  SocialSystem  │         │  LifeCycleSystem   │   │
│  │ queryRadius    │     │ getAffinity    │         │  removeAgent       │   │
│  │ enemy detection│     │ hostility check│         │  getAgent          │   │
│  └────────────────┘     └────────────────┘         └────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         GPU Batch Processing                             ││
│  │  ┌────────────────────────┐  ┌────────────────────────────────────────┐ ││
│  │  │ attackerPositionsBuffer│  │ targetPositionsBuffer                  │ ││
│  │  │ Float32Array           │  │ Float32Array                           │ ││
│  │  └────────────────────────┘  └────────────────────────────────────────┘ ││
│  │  ┌────────────────────────────────────────────────────────────────────┐ ││
│  │  │ GPUComputeService.computeDistancesBatch()                          │ ││
│  │  │ - Pairwise distance calculations                                   │ ││
│  │  │ - GPU activado si hay ≥ 30 atacantes simultáneos (sino CPU)        │ ││
│  │  └────────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         Weapon System                                    ││
│  │  ┌────────────────────┐  ┌────────────────────────────────────────────┐ ││
│  │  │ WeaponCatalog      │  │ Weapon Stats                               │ ││
│  │  │ getWeapon(id)      │  │ baseDamage, range, attackSpeed             │ ││
│  │  └────────────────────┘  │ critChance, critMultiplier                 │ ││
│  │                          └────────────────────────────────────────────┘ ││
│  │  ┌────────────────────────────────────────────────────────────────────┐ ││
│  │  │ Weapon Costs                                                       │ ││
│  │  │ UNARMED: {} | WOODEN_CLUB: {wood: 10} | STONE_DAGGER: {stone: 8}   │ ││
│  │  └────────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Flujo de Combate

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMBAT FLOW                                          │
│                                                                              │
│                    ┌──────────────────┐                                      │
│                    │ CombatSystem     │                                      │
│                    │ .update()        │                                      │
│                    └────────┬─────────┘                                      │
│                             │                                                │
│           ┌─────────────────┼─────────────────┐                             │
│           │ decision interval check (750ms)    │                             │
│           └─────────────────┬─────────────────┘                             │
│                             │                                                │
│           ┌─────────────────▼─────────────────┐                             │
│           │      BATCH_THRESHOLD = 10?        │                             │
│           └─────────┬───────────────┬─────────┘                             │
│                     │               │                                        │
│              YES    │               │  NO                                    │
│           ┌─────────▼─────────┐  ┌──▼──────────────────┐                    │
│           │ updateBatch()     │  │ Individual process  │                    │
│           │ - GPU if >= 30    │  │ for each attacker   │                    │
│           │ - CPU otherwise   │  └─────────────────────┘                    │
│           └─────────┬─────────┘                                             │
│                     │                                                        │
│           ┌─────────▼─────────┐                                             │
│           │ For each attacker │                                             │
│           │ + nearby targets  │                                             │
│           └─────────┬─────────┘                                             │
│                     │                                                        │
│  ┌──────────────────┼──────────────────┐                                    │
│  │                  ▼                  │                                    │
│  │  ┌────────────────────────────┐     │                                    │
│  │  │ shouldAttack(attacker,tgt)?│     │                                    │
│  │  │ - Not same entity          │     │                                    │
│  │  │ - Target not dead/immortal │     │                                    │
│  │  │ - Target is animal? → YES  │     │                                    │
│  │  │ - Affinity <= -0.4? → YES  │     │                                    │
│  │  │ - Aggression >= 0.6? check │     │                                    │
│  │  └────────────┬───────────────┘     │                                    │
│  │               │ YES                 │                                    │
│  │  ┌────────────▼───────────────┐     │                                    │
│  │  │ isOffCooldown(attacker)?   │     │                                    │
│  │  │ weapon.attackSpeed * 1000  │     │                                    │
│  │  └────────────┬───────────────┘     │                                    │
│  │               │ YES                 │                                    │
│  │  ┌────────────▼───────────────┐     │                                    │
│  │  │ resolveAttack()            │     │                                    │
│  │  │ - Check norms violation    │     │                                    │
│  │  │ - Calculate damage         │     │                                    │
│  │  │ - Apply crit modifier      │     │                                    │
│  │  │ - Update target stats      │     │                                    │
│  │  │ - Emit COMBAT_ENGAGED      │     │                                    │
│  │  │ - Emit COMBAT_HIT          │     │                                    │
│  │  │ - If kill → handleKill()   │     │                                    │
│  │  └────────────────────────────┘     │                                    │
│  └─────────────────────────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📡 Sistema de Eventos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EVENTOS DE COMBATE                                  │
│                                                                              │
│  EMISIÓN:                                                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  CombatSystem.equip()                                                       │
│    └── COMBAT_WEAPON_EQUIPPED { agentId, weapon }                           │
│                                                                              │
│  CombatSystem.craftWeapon()                                                 │
│    └── COMBAT_WEAPON_CRAFTED { agentId, weapon }                            │
│                                                                              │
│  CombatSystem.resolveAttack()                                               │
│    ├── COMBAT_ENGAGED { attackerId, targetId, weapon, positions, health }   │
│    └── COMBAT_HIT { attackerId, targetId, damage, crit, weapon, remaining } │
│                                                                              │
│  CombatSystem.handleKill()                                                  │
│    ├── COMBAT_KILL { attackerId, targetId, weapon }                         │
│    └── ANIMAL_HUNTED { animalId, hunterId } (si target es animal)           │
│                                                                              │
│  RECEPCIÓN:                                                                 │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  CombatSystem.handleAgentBirth()                                            │
│    ← AGENT_BIRTH → Equipa WOODEN_CLUB si socialStatus === "warrior"         │
│                                                                              │
│  INTEGRACIONES EXTERNAS:                                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  ConflictResolutionSystem                                                    │
│    ← COMBAT_HIT → Resuelve conflictos post-combate                          │
│                                                                              │
│  EventRegistry                                                               │
│    ← COMBAT_KILL → Registro para estadísticas                               │
│    ← COMBAT_HIT → Coordinación cross-system                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Componentes del Sistema

| Componente | Estado | Notas |
|------------|--------|-------|
| CombatSystem → GameState | ✅ Conectado | @inject(TYPES.GameState) |
| CombatSystem → InventorySystem | ✅ Conectado | @inject para crafting |
| CombatSystem → LifeCycleSystem | ✅ Conectado | @inject para kills |
| CombatSystem → SocialSystem | ✅ Conectado | @inject para affinity |
| CombatSystem → AnimalSystem | ✅ Conectado | @inject @optional |
| CombatSystem → NormsSystem | ✅ Conectado | @inject @optional |
| CombatSystem → SharedSpatialIndex | ✅ Conectado | @inject @optional |
| CombatSystem → GPUComputeService | ✅ Conectado | @inject @optional |
| CombatSystem → EntityIndex | ✅ Conectado | @inject @optional |

### Armas Disponibles

| Arma | Costo | Daño Base | Estado |
|------|-------|-----------|--------|
| UNARMED | - | Bajo | ✅ |
| WOODEN_CLUB | 10 wood | Medio | ✅ |
| STONE_DAGGER | 8 stone | Medio | ✅ |

### Condiciones de Ataque

| Condición | Verificación | Estado |
|-----------|--------------|--------|
| Target es animal | Siempre ataca | ✅ |
| Affinity <= -0.4 | Hostilidad detectada | ✅ |
| Aggression >= 0.6 | 25% probabilidad | ✅ |
| Target no muerto | Validación básica | ✅ |
| Target no immortal | Entidades especiales | ✅ |
| Cooldown completado | weapon.attackSpeed | ✅ |

### Flujo de Eventos

| Evento | Emisor | Receptor | Estado |
|--------|--------|----------|--------|
| COMBAT_WEAPON_EQUIPPED | CombatSystem | Client, UI | ✅ |
| COMBAT_WEAPON_CRAFTED | CombatSystem | Client, Stats | ✅ |
| COMBAT_ENGAGED | CombatSystem | Client, UI | ✅ |
| COMBAT_HIT | CombatSystem | Client, ConflictResolution | ✅ |
| COMBAT_KILL | CombatSystem | Client, EventRegistry | ✅ |
| ANIMAL_HUNTED | CombatSystem | AnimalSystem | ✅ |

---

## 🔍 ANÁLISIS DETALLADO

### Optimizaciones Implementadas

1. **Spatial Index Integration**
   - SharedSpatialIndex para O(log n) queries
   - queryRadius() para detección de enemigos cercanos
   - releaseResults() para pool de resultados

2. **GPU Batch Processing**
   - Activado con >= 30 atacantes
   - computeDistancesBatch() para cálculo vectorizado
   - Fallback a CPU si GPU no disponible

3. **Buffer Reuse**
   - attackerPositionsBuffer y targetPositionsBuffer
   - Realloc solo cuando tamaño excede 1.5x
   - Float32Array para eficiencia de memoria

4. **Combat Log Management**
   - Máximo 200 entradas
   - Auto-cleanup cuando excede límite
   - UUID para cada entrada

### Cálculo de Daño

```typescript
const base = weapon.baseDamage * (0.8 + Math.random() * 0.4);  // ±20% variance
const scale = 0.5 + aggression * 0.7;                          // 0.5 - 1.2 scale
const crit = Math.random() < weapon.critChance;
const damage = Math.max(1, Math.round(base * scale * (crit ? weapon.critMultiplier : 1)));
```

### Efectos Secundarios del Combate

| Stat | Cambio | Descripción |
|------|--------|-------------|
| morale | -damage * 0.6 | Reduce moral |
| stress | +damage * 0.4 | Aumenta estrés |
| wounds | +damage * 0.5 | Acumula heridas |
| stamina | -damage * 0.3 | Reduce stamina |

### Integración con NormsSystem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NORMS VIOLATION CHECK                                     │
│                                                                              │
│  resolveAttack()                                                            │
│    └── if (normsSystem && attacker.position)                                │
│          └── findZoneAtPosition(attacker.position)                          │
│                └── normsSystem.handleCombatInZone(...)                      │
│                      ├── violation.violated? → Apply sanction               │
│                      └── violation.sanction.truceDuration?                  │
│                            └── socialSystem.imposeTruce(...)                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Reglas y Políticas

- **Animales como objetivos válidos.** `shouldAttack()` devuelve `true` cuando el target tiene `EntityType.ANIMAL`. Esto permite que los agentes realicen caza sin depender de afinidad social. Los animales carecen de reputación con humanos, así que la decisión se mantiene independiente del `SocialSystem`.
- **Chequeo de agresión aleatorio.** Tras descartar enemigos declarados, la probabilidad de atacar depende del rasgo `aggression`: si es ≥ 0.6, se evalúa `RandomUtils.chance(aggression * 0.25)`. Esto introduce imprevisibilidad controlada en encuentros neutrales.
- **Umbral de GPU en lotes.** `updateBatch()` activa `updateBatchGPU()` solo cuando hay al menos 30 atacantes y el servicio de GPU está disponible. En escenarios menores la versión CPU evita el overhead de transferencia de buffers.

---

### Fortalezas del Sistema

- ✅ **Spatial indexing eficiente** - SharedSpatialIndex para queries O(log n)
- ✅ **GPU batch processing** - Aceleración para combates masivos
- ✅ **Sistema de armas completo** - Crafting, equipamiento, stats
- ✅ **Combat log** - Historial con auto-cleanup
- ✅ **Cooldown system** - Previene spam de ataques
- ✅ **Damage variance** - ±20% + critical hits
- ✅ **Secondary effects** - morale, stress, wounds, stamina
- ✅ **Norms integration** - Violaciones y sanciones
- ✅ **Animal hunting** - ANIMAL_HUNTED event
- ✅ **Eventos bien definidos** - ENGAGED, HIT, KILL, CRAFTED, EQUIPPED

### Conectividad General
**Estado: 100% Conectado Correctamente**

Todos los componentes están correctamente conectados:
- CombatSystem → SharedSpatialIndex ✅
- CombatSystem → GPUComputeService ✅
- CombatSystem → SocialSystem ✅
- CombatSystem → LifeCycleSystem ✅
- CombatSystem → AnimalSystem ✅
- CombatSystem → NormsSystem ✅
- Eventos bidireccionales funcionando ✅
- Combat log sincronizado con GameState ✅

---

## 📌 Resumen Operativo

CombatSystem gestiona detección espacial, cooldowns y registros de combate con soporte para GPU cuando se presentan escaramuzas masivas. Las reglas documentadas describen exactamente cómo se seleccionan objetivos y cuándo se activa el procesamiento masivo.
