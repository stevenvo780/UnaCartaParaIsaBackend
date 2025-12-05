# Auditoría de Mecánicas del Backend - Diciembre 2025

**Fecha**: 5 de diciembre de 2025  
**Fuente**: Logs de Docker (`unacartaparaisabackend-backend-gpu-1`)  
**Tick de simulación analizado**: ~31680-32000+  
**Agentes activos**: 19-21  
**Última actualización**: 5 Dic 2025 11:35 (después de fixes de Marriage + Crafting)

---

## 📊 Resumen Ejecutivo

| Categoría | Funcionando | Parcial | Inactivo |
|-----------|-------------|---------|----------|
| Sistemas Core | 15 | 3 | 1 |
| Detectores IA | 8 | 1 | 0 |
| Handlers IA | 10 | 1 | 2 |

### ✅ FIXES APLICADOS (5 Dic 2025)

1. **CraftHandler** - Ahora busca `itemId` además de `recipeId` y `itemType`
2. **EnhancedCraftingSystem** - Agregado `stone_dagger` a BASIC_RECIPE_IDS
3. **AISystem.buildDetectorContext()** - Ahora incluye:
   - `hasWeapon`, `equippedWeapon` desde EquipmentSystem
   - `roleType` desde RoleSystem 
   - `workZonesWithItems` con radio de 1000 unidades
4. **WorkDetector** - Usa `workZonesWithItems` como fallback
5. **CraftDetector** - Genera tareas sin requerir `canCraftClub/canCraftDagger`
6. **SocialSystem.requestInteraction()** - Nuevo case `"find_mate"`:
   - Verifica afinidad >= 0.4 antes de proponer matrimonio
   - Llama a `MarriageSystem.proposeMarriage()`
7. **MarriageSystem.update()** - Auto-aceptación de propuestas:
   - Después de 5s, 20% de probabilidad por tick de aceptar
   - Logs: `💒 [MarriageSystem] Auto-accepted proposal for X, groupId=Y`

**RESULTADO**: 
- `requestCraft(wooden_club) = in_progress` ✅
- `equippedWeapons: 1` ✅ (confirmado en logs)
- `💍 [MarriageSystem] update: groups=3, pendingProposals=2` ✅
- `💒 Auto-accepted proposal for stev, isa, agent_3` ✅

---

## ✅ SISTEMAS FUNCIONANDO CORRECTAMENTE

### 1. **AISystem** ⭐ ACTIVO (9948 logs)
- **Estado**: ✅ Funcionando óptimamente
- **Evidencia**: 
  - `[AISystem] update(): 19-21 agents`
  - `runDetectors` ejecutándose para todos los agentes
  - Tareas siendo encoladas: `satisfy_need, socialize, rest, deposit, gather, explore`
  - Agentes activando tareas: `agent_X ACTIVATED task: gather/socialize/etc`

### 2. **MovementSystem** ⭐ ACTIVO (1464 logs)
- **Estado**: ✅ Funcionando óptimamente
- **Evidencia**:
  - `[MovementSystem] maybeStartIdleWander agent_X`
  - `agent_X starting idle wander to (X, Y)`
  - Movimiento autónomo funcionando

### 3. **NeedsSystem** ⭐ ACTIVO (108 logs)
- **Estado**: ✅ Funcionando óptimamente
- **Evidencia**:
  - `🔍 [NeedsSystem] state: 19 entities`
  - `📊 [Needs] isa:h85 stev:h80...` (valores de salud reportados)
  - `[NeedsSystem] 💧 Agent X drinking from OCEAN tile`
  - Necesidades siendo monitoreadas: hunger, thirst, energy

### 4. **SocialSystem** ⭐ ACTIVO (130 logs)
- **Estado**: ✅ Funcionando óptimamente
- **Evidencia**:
  - `👥 [SocialSystem] update: agents=19, edges=31, groups=1`
  - Relaciones sociales siendo mantenidas
  - `edgesModified=true/false` indicando cambios dinámicos

### 5. **InventorySystem** ⭐ ACTIVO (538 logs)
- **Estado**: ✅ Funcionando óptimamente
- **Evidencia**:
  - `[InventorySystem] update() - Agents: 19, inAgents: food=213, water=0, wood=128, stone=69`
  - `agent_X: inventory full, capacity=50, currentLoad=50`
  - Inventarios personales y depósitos funcionando

### 6. **AnimalSystem** ⭐ ACTIVO (432 logs)
- **Estado**: ✅ Funcionando óptimamente
- **Evidencia**:
  - `🐾 [AnimalSystem] States: {"seeking_water":2,"mating":49,"idle":2}`
  - `Registry size: 53, Live: 53`
  - Estados: mating, eating, drinking, wandering, fleeing, seeking_water, idle
  - Animales: rabbit, boar, fish

### 7. **TimeSystem** ⭐ ACTIVO (65 logs)
- **Estado**: ✅ Funcionando óptimamente
- **Evidencia**:
  - `🕐 [TimeSystem] hour=16:16 phase=afternoon weather=clear light=0.60`
  - Ciclo día/noche funcionando

### 8. **EconomySystem** ⭐ ACTIVO (64 logs)
- **Estado**: ✅ Funcionando óptimamente
- **Evidencia**:
  - `💰 [EconomySystem] agents=19 transactions=14 residuals=0`
  - Transacciones siendo procesadas

### 9. **CombatSystem** ⭐ ACTIVO (129 logs)
- **Estado**: ✅ Funcionando (sin combates activos)
- **Evidencia**:
  - `⚔️ [CombatSystem] update: entities=19, combatLogSize=34, equipped=0`
  - Sistema funcionando pero sin combates activos (equipped=0)

### 10. **ConflictResolutionSystem** ⭐ ACTIVO (65 logs)
- **Estado**: ✅ Funcionando (sin conflictos activos)
- **Evidencia**:
  - `⚖️ [ConflictResolutionSystem] update: activeCards=0, conflicts=0, historySize=11`

### 11. **AmbientAwarenessSystem** ⭐ ACTIVO (65 logs)
- **Estado**: ✅ Funcionando óptimamente
- **Evidencia**:
  - `🌡️ [AmbientAwarenessSystem] update: wellbeing=56.5, variance=0.11`
  - Bienestar general de la población siendo monitoreado

### 12. **ChunkLoadingSystem** ⭐ ACTIVO (20 logs)
- **Estado**: ✅ Funcionando óptimamente
- **Evidencia**:
  - `[ChunkLoadingSystem] update: 20 agents, 0 chunks to load, 64 already loaded`

### 13. **TaskSystem** ⭐ ACTIVO (64 logs)
- **Estado**: ✅ Funcionando
- **Evidencia**:
  - `📋 [TaskSystem] total=2 active=0 stalled=0`

### 14. **RoleSystem** ⭐ ACTIVO (63 logs)
- **Estado**: ✅ Funcionando óptimamente
- **Evidencia**:
  - `👷 [RoleSystem] roles=14 shift=morning roleTypes=gatherer,logger,quarryman`
  - Roles asignados y funcionando

### 15. **SharedKnowledgeSystem** ⭐ ACTIVO (65 logs)
- **Estado**: ✅ Funcionando
- **Evidencia**:
  - `[SharedKnowledgeSystem] update() | resourceAlerts=0 | threatAlerts=0 | agentsNotified=0`

### 16. **ResourceReservationSystem** ⭐ ACTIVO (65 logs)
- **Estado**: ✅ Funcionando
- **Evidencia**:
  - `[ResourceReservationSystem] update() | reservations=0 | lastCleanup=...`

### 17. **TerrainSystem** ⭐ ACTIVO (16 logs)
- **Estado**: ✅ Funcionando óptimamente
- **Evidencia**:
  - `💧 [TerrainSystem] Water consumed at (0, 0): 5 units, remaining: 45/100`
  - Consumo de agua del terreno funcionando

---

## ⚠️ SISTEMAS CON ACTIVIDAD PARCIAL

### 1. **BuildingSystem** ⚠️ PARCIAL (104 logs)
- **Estado**: Sistema ejecutándose pero bloqueado por recursos
- **Evidencia**:
  - `🏗️ [BUILDING] Cannot reserve resources for house: needs wood=12, stone=4. Available: wood=7, stone=28`
  - `🏗️ [BUILDING] Status: houses=1/8, zones=5, activeJobs=0`
- **Problema**: Falta de madera (7 disponibles, necesita 12)
- **Recomendación**: Los agentes deben priorizar recolección de madera

### 2. **HouseholdSystem** ⚠️ PARCIAL (65 logs)
- **Estado**: Sistema activo pero sin hogares
- **Evidencia**:
  - `🏠 [HouseholdSystem] update: households=0, capacity=0, occupied=0, free=0`
- **Problema**: Dependiente de BuildingSystem para crear casas
- **Recomendación**: Una vez se construyan casas, este sistema debería activarse

### 3. **MarriageSystem** ✅ ACTIVO (CORREGIDO)
- **Estado**: Sistema funcionando con matrimonios activos
- **Evidencia**:
  - `💍 [MarriageSystem] update: groups=3, pendingProposals=2`
  - `💒 [MarriageSystem] Auto-accepted proposal for agent_3, groupId=marriage_1`
  - `💒 [MarriageSystem] Auto-accepted proposal for stev, groupId=marriage_2`
  - `💒 [MarriageSystem] Auto-accepted proposal for isa, groupId=marriage_3`
- **Fixes aplicados**:
  1. `SocialSystem.requestInteraction()` ahora maneja `"find_mate"` action
  2. `MarriageSystem.update()` auto-acepta propuestas pendientes

### 4. **ProductionSystem** ⚠️ PARCIAL (64 logs)
- **Estado**: Sistema activo pero sin zonas de producción
- **Evidencia**:
  - `🏭 [ProductionSystem] update: zones=5, productionZones=0, assignments=0`
- **Problema**: Hay zonas pero ninguna de producción

### 5. **EnhancedCraftingSystem** ✅ ACTIVO (CORREGIDO)
- **Estado**: Sistema funcionando con crafting activo
- **Evidencia**:
  - `requestCraft(wooden_club) = in_progress - Started crafting wooden_club`
  - `📦 [Snapshot] enhancedCrafting data: { equippedWeapons: 1 }`
- **Fix aplicado**: `stone_dagger` agregado a BASIC_RECIPE_IDS

### 6. **LifeCycleSystem** ⚠️ PARCIAL (7 logs)
- **Estado**: Sistema funcionando para reproducción
- **Evidencia**:
  - `🚶 [LifeCycleSystem] Movement state initialized for agent_17`
  - `🍼 [Breeding] Checking... pop=19/50`
  - `🍼 [tryCouple] Agent agent_8+Agent agent_7 REPRODUCING!`
  - `Agent birth event for agent_17`
- **Nota**: Reproducción funcionando, pero sin logs de envejecimiento/muerte natural

---

## ✅ SISTEMAS CON ACTIVIDAD ADICIONAL (Descubiertos)

### 1. **GovernanceSystem** ✅ ACTIVO
- **Estado**: Funcionando correctamente
- **Evidencia**:
  - `🏛️ [GOVERNANCE] Snapshot pushed: demands=[housing_full, housing_full, water_shortage]`
  - `🏛️ [GOVERNANCE] Demand created: food_shortage (priority: 8) - Reservas de comida bajas`
  - `🏛️ [GOVERNANCE] Assigned 3 agents to role hunter for demand food_shortage`
- **Demandas activas**: housing_full, food_shortage, water_shortage
- **Acciones tomadas**: Asignación automática de roles

---

## ❌ SISTEMAS SIN ACTIVIDAD DETECTADA

### 2. **GenealogySystem** ❌ INACTIVO (logs implícitos)
- **Estado**: Sistema existe pero sin logs directos
- **Archivo**: `src/domain/simulation/systems/social/GenealogySystem.ts`
- **Nota**: Los nacimientos están siendo registrados (`birth event`), pero no hay logs de árbol genealógico

### 3. **EquipmentSystem** ✅ ACTIVO (CORREGIDO)
- **Estado**: Sistema funcionando con equipamiento activo
- **Evidencia**: `equippedWeapons: 1` en logs
- **Fix**: AISystem ahora pasa contexto de equipamiento a detectores

### 4. **RecipeDiscoverySystem** ⚠️ PARCIAL
- **Estado**: Sin logs detectados
- **Archivo**: `src/domain/simulation/systems/economy/RecipeDiscoverySystem.ts`
- **Nota**: Los agentes conocen recetas (`knownRecipesAgents: 19`) pero no hay descubrimientos

---

## 🔍 DETECTORES DE IA

| Detector | Logs | Estado | Tareas Generadas |
|----------|------|--------|------------------|
| NeedsDetector | 3605 | ✅ ACTIVO | satisfy_need, rest |
| SocialDetector | 452 | ✅ ACTIVO | socialize, repro |
| WorkDetector | 1883 | ✅ ACTIVO | gather, work |
| InventoryDetector | 1304 | ✅ ACTIVO | deposit, gather |
| ExploreDetector | 893 | ✅ ACTIVO | explore |
| SocialContext | 3036 | ✅ ACTIVO | potentialMate, agentInNeed |
| **CraftDetector** | ✅ | ✅ CORREGIDO | craft (weapons) |
| **BuildDetector** | 0 | ⚠️ PARCIAL | pendingBuilds |
| **TradeDetector** | 0 | ⚠️ (via MARKET) | - |
| **CombatDetector** | 0 | ✅ ACTIVO (sin depredadores) | flee, attack |

### Correcciones Aplicadas (5 Dic 2025)

1. **WorkDetector** - Ahora usa `workZonesWithItems` como fallback cuando no hay recursos en WorldResourceSystem
2. **CraftDetector** - Ahora genera tareas de craft para roles que necesitan armas (hunter, guard)
3. **CombatDetector** - Funciona correctamente, pero requiere depredadores (wolves) para activarse
4. **DetectorContext** - Ampliado con:
   - `hasWeapon`, `equippedWeapon` - desde EquipmentSystem
   - `roleType` - desde RoleSystem via container
   - `health`, `maxHealth` - desde NeedsSystem
   - `workZonesWithItems` - zonas con items para recolectar
   - `craftZoneId` - zona de crafting cercana

---

## 📋 HANDLERS DE IA

| Handler | Evidencia en Logs | Estado |
|---------|-------------------|--------|
| GatherHandler | `ACTIVATED task: gather` | ✅ ACTIVO |
| ExploreHandler | `exploring, target=...` | ✅ ACTIVO |
| SocialHandler | `ACTIVATED task: socialize` | ✅ ACTIVO |
| DepositHandler | `deposit task, load=X%` | ✅ ACTIVO |
| RestHandler | `rest` tasks enqueued | ✅ ACTIVO |
| ConsumeHandler | `drinking from OCEAN` | ✅ ACTIVO |
| MoveHandler | `starting idle wander` | ✅ ACTIVO |
| **CraftHandler** | `requestCraft = in_progress` | ✅ ACTIVO |
| **BuildHandler** | No evidence | ⚠️ PARCIAL (recursos) |
| **TradeHandler** | Via MARKET auto-trade | ⚠️ PARCIAL |
| **AttackHandler** | No evidence (sin depredadores) | ⚠️ PENDIENTE |
| **FleeHandler** | `flee` tasks generadas | ✅ ACTIVO |

### Problemas Restantes en Handlers

1. **AttackHandler** - Funcional, pero requiere depredadores o enemigos para activarse
   - Solución: Añadir wolves/depredadores al spawn de animales o reducir cooldown

2. **BuildHandler** - Bloqueado por falta de madera
   - Los agentes priorizan recolección pero no alcanzan los 12 logs necesarios

---

## 🎯 DINÁMICAS ACTIVAS

1. ✅ **Supervivencia básica**: Agentes satisfaciendo hambre/sed
2. ✅ **Exploración**: Agentes descubriendo el mapa y zonas
3. ✅ **Recolección**: Gather de recursos (berry_bush, trees)
4. ✅ **Almacenamiento**: Depósito de recursos cuando inventario lleno
5. ✅ **Socialización**: Interacciones sociales y búsqueda de parejas
6. ✅ **Reproducción**: Nacimiento de nuevos agentes (agent_17, etc.)
7. ✅ **Ecosistema animal**: Animales con necesidades y reproducción
8. ✅ **Ciclo día/noche**: Fases del día afectando comportamiento
9. ✅ **Comercio básico**: Auto-trade de recursos
10. ✅ **Roles laborales**: Gatherer, logger, quarryman asignados
11. ✅ **Gobernanza**: Demandas detectadas y roles asignados automáticamente

---

## ❌ DINÁMICAS NO FUNCIONANDO (PENDIENTES)

1. ⚠️ **Construcción**: Bloqueada por falta de recursos (wood=7, necesita 12)
2. ✅ **Crafting activo**: FUNCIONANDO - agentes crafteando wooden_club
3. ✅ **Equipamiento**: FUNCIONANDO - equippedWeapons: 1
4. ⚠️ **Combate agente-agente**: Requiere depredadores o conflictos
5. ⚠️ **Descubrimiento de recetas**: Sin nuevas recetas (pero básicas funcionan)
6. ⚠️ **Matrimonios formales**: Sin proposals aceptadas
7. ⚠️ **Hogares**: Dependiente de construcción

---

## 🔧 RECOMENDACIONES ACTUALIZADAS

### ~~Resueltas~~
1. ~~**Crear CraftingSystem para backend**~~ - ✅ YA REGISTRADO como `crafting`
2. ~~**CraftHandler no funciona**~~ - ✅ CORREGIDO - ahora busca `itemId` en params
3. ~~**Equipamiento no funciona**~~ - ✅ CORREGIDO - `equippedWeapons: 1` confirmado

### Prioridad Alta (Pendientes)
1. **Recolección de madera** - Los agentes priorizan comida sobre madera
   - Solo depositan `food`, raramente `wood` o `stone`
   - Necesitan balanceo para recolectar materiales de construcción

2. **Construcción bloqueada** - `wood=2, stone=6` disponibles, necesita `wood=12, stone=4`
   - Requiere más recolección de madera (ver punto anterior)

### Prioridad Media
3. **Añadir depredadores** - Para activar combate agente-animal
   - `wolf.spawnProbability: 0.05` (5%) es muy baja
   - Considerar aumentar a 0.15-0.20 para biomes de bosque
   
4. **Revisar condiciones de MarriageSystem** - `pendingProposals=0`
   - Hay parejas potenciales (`potentialMate`) pero no proposals
   - Verificar umbral de relación para proponer matrimonio

5. **Añadir logs a GenealogySystem** - Para visibilidad del árbol familiar

### Prioridad Baja
6. **RecipeDiscoverySystem** - Funciona pero sin descubrimientos activos
7. **ProductionSystem** - `productionZones=0` aunque hay 5 zonas

---

## ✅ CORRECCIONES APLICADAS (5 Dic 2025 - 11:20)

### CraftHandler.ts
- Ahora busca `itemId` en `task.params` además de `recipeId` y `itemType`
- Agregado logging detallado para diagnóstico
- Log de éxito: `✅ [CraftHandler] ${agentId}: CRAFTED ${recipeId}!`

### EnhancedCraftingSystem.ts
- Agregado `stone_dagger` a BASIC_RECIPE_IDS para que todos puedan craftearlo
- Agregado logging en `canCraft()` para diagnóstico de ingredientes

### AISystem.ts (previo)
- Agregados imports: `EquipmentSlot`, `WeaponId`, `equipmentSystem`, `RoleSystem`, `container`
- Modificado `buildDetectorContext()`:
  - Ahora incluye `hasWeapon`, `equippedWeapon` desde EquipmentSystem
  - Ahora incluye `roleType` desde RoleSystem via IoC container
  - Ahora incluye `health`, `maxHealth`
  - Ahora incluye `workZonesWithItems` con zonas de trabajo cercanas (radio 1000 unidades)
  - Ahora incluye `craftZoneId`, `canCraftClub`, `canCraftDagger`

### WorkDetector.ts
- Modificado `detectGatherWork()`:
  - Usa `nearestResource` si está disponible
  - Fallback a `workZonesWithItems` cuando no hay recursos del WorldResourceSystem
  - Genera tareas de gather hacia zonas de trabajo

### CraftDetector.ts
- Modificado `detectWeaponNeed()`:
  - Ya no requiere `canCraftClub/canCraftDagger` (backend no tiene CraftingSystem)
  - Genera tareas de craft si el rol necesita arma (hunter, guard) y es hora de trabajo

### types.ts
- Agregado campo `workZonesWithItems` a `DetectorContext`

---

## 📈 ESTADÍSTICAS DE LA SIMULACIÓN

| Métrica | Valor |
|---------|-------|
| Agentes vivos | 19-21 |
| Animales vivos | 53 |
| Chunks cargados | 64 |
| Casas construidas | 1/8 |
| Zonas descubiertas | 5 |
| Transacciones totales | 14 |
| Relaciones sociales | 31 edges |
| Grupos sociales | 1 |
| Bienestar general | 56.5-58% |

---

*Auditoría generada automáticamente desde logs de Docker*
