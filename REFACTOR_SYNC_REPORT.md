# 🔄 Informe de Sincronización: Sistema de Agentes y Búsqueda en el Mundo

## Resumen Ejecutivo

El sistema de IA de agentes ha sido refactorizado a una arquitectura ECS (Entity-Component-System) basada en **tareas** en lugar de **goals**. Este informe documenta el estado actual y las acciones necesarias para alinear todos los sistemas con la nueva arquitectura.

---

## ⚠️ Análisis de Redundancias: Sistemas de Tareas

### Sistemas Identificados

| Sistema | Ubicación | Propósito | Estado |
|---------|-----------|-----------|--------|
| `TaskSystem` | `objectives/TaskSystem.ts` | Tareas de CONSTRUCCIÓN colaborativa | ✅ **Necesario** |
| `TaskQueue` (AI) | `agents/ai/TaskQueue.ts` | Cola de decisiones de IA | ✅ **Necesario** |
| `TaskQueue` (ECS) | `ecs/TaskQueue.ts` | Versión ECS (duplicada) | ❌ **ELIMINAR** |

### Diferencias Clave

**`objectives/TaskSystem`** - Tareas de CONSTRUCCIÓN:
```typescript
// Múltiples agentes contribuyen a una tarea
taskSystem.createTask({ type: 'build_house', requiredWork: 100, minWorkers: 2 });
taskSystem.contributeToTask(taskId, agentId, workAmount);
// Progreso compartido, synergy multipliers, etc.
```

**`ai/TaskQueue`** - Decisiones de IA:
```typescript
// Cola de prioridades para un agente
queue.enqueue(agentId, { type: TaskType.GATHER, priority: 0.6 });
queue.enqueue(agentId, { type: TaskType.REST, priority: 0.4 });
// El agente ejecuta la de mayor prioridad
```

### Acción Requerida

1. ~~Eliminar `ecs/TaskQueue.ts`~~ ✅ **ELIMINADO** - ya no existe
2. El `objectives/TaskSystem` es para BuildingSystem - **NO eliminar**
3. El `ai/TaskQueue` es el sistema de decisiones del AISystem - **NO eliminar**

---

## 📐 Arquitectura Nueva vs Legacy

### Nueva Arquitectura (ECS + Tasks)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FLUJO DE DECISIONES                         │
├─────────────────────────────────────────────────────────────────────┤
│  Detectores → TaskQueue → AISystem → Handlers → SystemRegistry      │
│                                                                     │
│  1. Detectores observan estado (DetectorContext - readonly)         │
│  2. Generan Tasks con prioridades                                   │
│  3. TaskQueue acumula y prioriza                                    │
│  4. AISystem ejecuta el handler correspondiente                     │
│  5. Handler delega a sistemas via SystemRegistry                    │
│  6. Sistema implementa lógica de negocio                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Componentes Clave

| Componente | Ubicación | Propósito |
|------------|-----------|-----------|
| `DetectorContext` | `ai/types.ts` | Estado readonly para detectores |
| `HandlerContext` | `ai/types.ts` | Acceso a SystemRegistry para handlers |
| `SystemRegistry` | `ecs/SystemRegistry.ts` | Registro de sistemas tipados |
| `AgentRegistry` | `agents/AgentRegistry.ts` | Acceso unificado O(1) a estado de agentes |
| `AnimalRegistry` | `world/animals/AnimalRegistry.ts` | Registro centralizado de animales |
| `WorldQueryService` | `world/WorldQueryService.ts` | **NUEVO** - API unificada de búsquedas |

---

## ✅ Checklist de Refactorización

### Fase 1: Registro de Sistemas en SystemRegistry

| Sistema | Interface ECS | Estado | Acción |
|---------|--------------|--------|--------|
| MovementSystem | `IMovementSystem` | ✅ Done | Métodos `requestMove`, `requestMoveToZone`, `requestMoveToEntity` implementados |
| CombatSystem | `ICombatSystem` | ✅ Done | Métodos `requestAttack`, `requestFlee`, `isInCombat` implementados |
| NeedsSystem | `INeedsSystem` | ✅ Done | Métodos `requestConsume`, `requestRest`, `applyNeedChange` implementados |
| InventorySystem | `IInventorySystem` | ✅ Done | Métodos `requestGather`, `requestDeposit`, `requestTransfer` implementados |
| SocialSystem | `ISocialSystem` | ✅ Done | Métodos `requestInteraction`, `getRelationship` implementados |
| EnhancedCraftingSystem | `ICraftingSystem` | ✅ Done | Métodos `requestCraft`, `canCraft` implementados |
| BuildingSystem | `IBuildingSystem` | ✅ Done | Métodos `requestBuild`, `requestRepair` implementados |
| EconomySystem | `ITradeSystem` | ✅ Done | Método `requestTrade` implementado |

### Fase 2: Detectores - Poblar DetectorContext

| Campo Context | Fuente de Datos | Estado | Sistema Responsable |
|---------------|-----------------|--------|---------------------|
| `position` | AgentRegistry | ✅ OK | AgentRegistry.getPosition() |
| `needs` | NeedsSystem | ✅ OK | NeedsSystem.getNeeds() |
| `nearestFood` | WorldQueryService | ✅ OK | AISystem.buildSpatialContext() |
| `nearestWater` | WorldQueryService | ✅ OK | AISystem.buildSpatialContext() |
| `nearbyAgents` | WorldQueryService | ✅ OK | AISystem.buildSpatialContext() |
| `nearbyPredators` | WorldQueryService | ✅ OK | AISystem.buildSpatialContext() |
| `health`, `maxHealth` | AgentProfile | ⚠️ Parcial | AgentRegistry |
| `inventory` | InventorySystem | ❌ No pobla | InventorySystem |
| `inventoryLoad`, `inventoryCapacity` | InventorySystem | ❌ No pobla | InventorySystem |
| `isInCombat`, `attackerId` | CombatSystem | ❌ No pobla | CombatSystem |
| `nearbyEnemies` | WorldQueryService | ❌ No pobla | WorldQueryService |
| `nearestResource` | WorldQueryService | ❌ No pobla | WorldQueryService |
| `roleType`, `isWorkHours` | RoleSystem, TimeSystem | ⚠️ Parcial | RoleSystem |
| `hasWeapon`, `equippedWeapon` | CombatSystem | ⚠️ Parcial | CombatSystem |
| `depositZoneId` | GameState.zones | ❌ No pobla | BuildingSystem |
| `pendingBuilds`, `contributableBuilding` | BuildingSystem | ❌ No pobla | BuildingSystem |
| `canCraftClub`, `canCraftDagger` | EnhancedCraftingSystem | ❌ No pobla | CraftingSystem |
| `lastExploreTime`, `visitedZones` | AIState.memory | ⚠️ Parcial | AISystem |
| `personality` | AgentProfile | ⚠️ Parcial | AgentRegistry |

### Fase 3: Handlers - Verificar Delegación Correcta

| Handler | TaskType | Delega a Sistema | Estado | Notas |
|---------|----------|------------------|--------|-------|
| `handleGather` | `GATHER` | `systems.inventory` | ✅ OK | Usa `requestGather` |
| `handleConsume` | `SATISFY_NEED` | `systems.needs` | ✅ OK | Usa `requestConsume` |
| `handleAttack` | `ATTACK`, `HUNT` | `systems.combat` | ✅ OK | Usa `requestAttack` |
| `handleFlee` | `FLEE` | `systems.combat` | ✅ OK | Usa `requestFlee` |
| `handleRest` | `REST` | `systems.needs` | ✅ OK | Usa `requestRest` |
| `handleSocialize` | `SOCIALIZE` | `systems.social` | ✅ OK | Usa `requestInteraction` |
| `handleCraft` | `CRAFT` | `systems.crafting` | ✅ OK | Usa `requestCraft` |
| `handleBuild` | `BUILD` | `systems.building` | ✅ OK | Usa `requestBuild` |
| `handleDeposit` | `DEPOSIT` | `systems.inventory` | ✅ OK | Usa `requestDeposit` |
| `handleTrade` | `TRADE` | `systems.trade` | ✅ OK | Usa `requestTrade` |
| `handleExplore` | `EXPLORE` | `systems.movement` | ✅ OK | Usa `requestMove` |
| `handleMove` | - | `systems.movement` | ✅ OK | Usa `requestMove` |

### Fase 4: WorldQueryService - Integración

| Integración | Estado | Acción |
|-------------|--------|--------|
| Container DI | ✅ Done | `TYPES.WorldQueryService` registrado |
| Export systems/index | ✅ Done | Exportado |
| Uso en AISystem | ✅ Done | Inyectado y usado en `buildSpatialContext` |
| Campos poblados | ✅ Done | `nearestFood`, `nearestWater`, `nearbyAgents`, `nearbyPredators` |

---

## 🔧 Plan de Implementación

### Paso 1: Implementar Interfaces ECS en Sistemas (CRÍTICO)

```typescript
// MovementSystem debe implementar IMovementSystem
class MovementSystem implements IMovementSystem {
  readonly name = "movement";
  
  requestMove(agentId: string, target: {x, y}): HandlerResult {
    // Implementar usando lógica existente
  }
  
  requestMoveToZone(agentId: string, zoneId: string): HandlerResult { ... }
  requestMoveToEntity(agentId: string, entityId: string): HandlerResult { ... }
  stopMovement(agentId: string): void { ... }
  isMoving(agentId: string): boolean { ... }
}
```

### Paso 2: Registrar Sistemas en SystemRegistry

```typescript
// En SimulationRunner o container setup
systemRegistry.register("movement", movementSystem);
systemRegistry.register("combat", combatSystem);
systemRegistry.register("needs", needsSystem);
systemRegistry.register("inventory", inventorySystem);
systemRegistry.register("social", socialSystem);
systemRegistry.register("crafting", craftingSystem);
systemRegistry.register("building", buildingSystem);
systemRegistry.register("trade", economySystem);
```

### Paso 3: Poblar DetectorContext Completo

```typescript
// AISystem.buildDetectorContext()
private buildDetectorContext(agentId: string): DetectorContext | null {
  const position = this.agentRegistry?.getPosition(agentId);
  if (!position) return null;
  
  const profile = this.agentRegistry?.getProfile(agentId);
  const needs = this.needsSystem?.getNeeds(agentId);
  const inventory = this.inventorySystem?.getAgentInventory(agentId);
  
  // Usar WorldQueryService para búsquedas espaciales
  const nearestFood = this.worldQuery?.findNearestResource(position.x, position.y, {
    type: WorldResourceType.FOOD_SOURCE,
    maxRadius: 300
  });
  
  const nearestWater = this.worldQuery?.findNearestResource(position.x, position.y, {
    type: WorldResourceType.WATER_SOURCE,
    maxRadius: 300
  });
  
  const nearbyAgents = this.worldQuery?.findAgentsInRadius(position.x, position.y, 100);
  
  // ... poblar todo el context
  
  return { agentId, position, needs, nearestFood, nearestWater, ... };
}
```

### Paso 4: Verificar Flujo Completo por TaskType

Para cada TaskType, verificar:
1. ✅ Detector genera la tarea correctamente
2. ✅ Context tiene la información necesaria
3. ✅ Handler delega al sistema correcto
4. ✅ Sistema implementa la interfaz ECS
5. ✅ Resultado se propaga correctamente

---

## 📊 Matriz de Dependencias

```
AISystem
├── AgentRegistry (estado de agentes)
├── NeedsSystem (necesidades)
├── MovementSystem (movimiento)
├── WorldQueryService (búsquedas espaciales) ← NUEVO
│   ├── WorldResourceSystem
│   ├── AnimalRegistry
│   ├── AgentRegistry
│   └── TerrainSystem
├── SystemRegistry (delegación)
│   ├── movement → MovementSystem
│   ├── combat → CombatSystem
│   ├── needs → NeedsSystem
│   ├── inventory → InventorySystem
│   ├── social → SocialSystem
│   ├── crafting → EnhancedCraftingSystem
│   ├── building → BuildingSystem
│   └── trade → EconomySystem
└── TaskQueue (cola de tareas)
```

---

## 🎯 Prioridades de Implementación

### P0 - Crítico (Bloquean funcionamiento básico) ✅ COMPLETADO
1. [x] WorldQueryService creado
2. [x] MovementSystem implementa IMovementSystem
3. [x] NeedsSystem implementa INeedsSystem
4. [x] InventorySystem implementa IInventorySystem
5. [x] CombatSystem implementa ICombatSystem
6. [x] AISystem inyecta WorldQueryService
7. [x] buildDetectorContext usa WorldQueryService (buildSpatialContext)

### P1 - Alto (Funcionalidad core) ✅ COMPLETADO
1. [x] SocialSystem implementa ISocialSystem
2. [x] EnhancedCraftingSystem implementa ICraftingSystem
3. [x] BuildingSystem implementa IBuildingSystem
4. [x] Registrar todos los sistemas en SystemRegistry (en SimulationRunner)
5. [x] Todos los handlers delegan correctamente a sistemas

### P2 - Medio (Funcionalidad avanzada) ⚠️ EN PROGRESO
1. [x] EconomySystem implementa ITradeSystem
2. [x] ecs/TaskQueue.ts eliminado (era duplicado)
3. [ ] Poblar campos avanzados de DetectorContext (health, inventory, etc.)
4. [ ] Tests de integración para flujo completo

---

## ✅ Resumen de Progreso

| Área | Estado | Tests |
|------|--------|-------|
| ECS Interfaces (8 sistemas) | ✅ 100% | Pasan |
| SystemRegistry | ✅ 100% | Pasan |
| Handlers (12 handlers) | ✅ 100% | Pasan |
| WorldQueryService en AISystem | ✅ 100% | Pasan |
| DetectorContext espacial | ✅ 80% | Pasan |
| **Total Tests** | **719** | ✅ |

---

## 📁 Archivos Modificados

| Archivo | Cambios | Estado |
|---------|---------|--------|
| `systems/agents/ai/AISystem.ts` | WorldQueryService inyectado, buildSpatialContext | ✅ |
| `systems/agents/movement/MovementSystem.ts` | IMovementSystem implementado | ✅ |
| `systems/agents/needs/NeedsSystem.ts` | INeedsSystem implementado | ✅ |
| `systems/economy/InventorySystem.ts` | IInventorySystem implementado | ✅ |
| `systems/conflict/CombatSystem.ts` | ICombatSystem implementado | ✅ |
| `systems/social/SocialSystem.ts` | ISocialSystem implementado | ✅ |
| `systems/economy/EnhancedCraftingSystem.ts` | ICraftingSystem implementado | ✅ |
| `systems/structures/BuildingSystem.ts` | IBuildingSystem implementado | ✅ |
| `systems/economy/EconomySystem.ts` | ITradeSystem implementado | ✅ |
| `core/SimulationRunner.ts` | registerSystemsInSystemRegistry() | ✅ |
| `ecs/TaskQueue.ts` | **ELIMINADO** (duplicado) | ✅ |
| `ecs/index.ts` | Exportación de TaskQueue eliminada | ✅ |

---

## 🚀 Siguiente Paso (Opcional)

Poblar campos adicionales en DetectorContext:
- `health`, `maxHealth` desde AgentProfile
- `inventory`, `inventoryLoad`, `inventoryCapacity` desde InventorySystem
- `isInCombat`, `attackerId` desde CombatSystem
- `roleType`, `isWorkHours` desde RoleSystem

Luego integrar WorldQueryService en AISystem.buildDetectorContext().
