# Plan de Refactorización: ECS + Separación de Dominios

> **Fecha:** 30 de noviembre de 2025  
> **Estado:** 🔄 EN PROGRESO  
> **Objetivo:** Arquitectura ECS limpia con separación de responsabilidades

---

## Resumen Ejecutivo

### Problema Actual
- Lógica de negocio acoplada en AISystem y handlers
- Sistemas que leen/escriben estados de otros sistemas directamente
- Dificultad para añadir nuevos comportamientos
- Capa de compatibilidad legacy añade complejidad

### Solución Propuesta
Arquitectura ECS (Entity-Component-System) con flujo unidireccional:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│   Sistema   │────▶│   Detector   │────▶│   Handler   │────▶│   Sistema   │
│  (emite)    │     │  (resuelve)  │     │ (comunica)  │     │ (procesa)   │
└─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
       │                                                            │
       │                    ┌─────────────────┐                     │
       └───────────────────▶│  AgentRegistry  │◀────────────────────┘
                            │   (ECS Store)   │
                            │  lee/escribe    │
                            └─────────────────┘
```

---

## Principios de Diseño

### 1. **Single Responsibility**
- **Detectores:** Solo determinan QUÉ hacer y CON QUÉ (target primitivo)
- **Handlers:** Solo COMUNICAN la intención al sistema apropiado
- **Sistemas:** Solo PROCESAN cambios de estado en su dominio

### 2. **ECS Pattern**
- **Entity:** AgentId (string)
- **Components:** Estados por dominio (NeedsState, CombatState, MovementState, etc.)
- **Systems:** Procesan sus propios componentes

### 3. **Event-Driven**
- Sistemas emiten eventos/tasks
- Handlers escuchan y despachan
- Ningún sistema modifica estado de otro directamente

---

## Fase 1: Definir Componentes ECS

### 1.1 Estructura de AgentComponents

```typescript
// src/domain/simulation/ecs/AgentComponents.ts

export interface AgentComponents {
  // Identificación
  id: string;
  profile: AgentProfile;
  
  // Estado vital
  health: HealthComponent;
  needs: NeedsComponent;
  
  // Posición y movimiento
  transform: TransformComponent;
  movement: MovementComponent;
  
  // Inventario y economía
  inventory: InventoryComponent;
  economy: EconomyComponent;
  
  // Social
  social: SocialComponent;
  relationships: RelationshipsComponent;
  
  // Combate
  combat: CombatComponent;
  
  // Trabajo y roles
  role: RoleComponent;
  tasks: TasksComponent;
  
  // IA
  ai: AIComponent;
}

// Componentes individuales
export interface HealthComponent {
  current: number;
  max: number;
  regeneration: number;
  lastDamageTime: number;
  lastDamageSource?: string;
}

export interface NeedsComponent {
  hunger: number;      // 0-100
  thirst: number;      // 0-100
  energy: number;      // 0-100
  social: number;      // 0-100
  fun: number;         // 0-100
  hygiene: number;     // 0-100
  mentalHealth: number; // 0-100
}

export interface TransformComponent {
  x: number;
  y: number;
  rotation: number;
  zoneId?: string;
}

export interface MovementComponent {
  isMoving: boolean;
  targetPosition?: { x: number; y: number };
  targetZoneId?: string;
  path: Array<{ x: number; y: number }>;
  speed: number;
  fatigue: number;
}

export interface CombatComponent {
  isInCombat: boolean;
  currentTarget?: string;
  lastAttackTime: number;
  attackCooldown: number;
  damage: number;
  defense: number;
  threatList: Map<string, number>; // entityId -> threat level
}

export interface AIComponent {
  currentTask?: AgentTask;
  pendingTasks: AgentTask[];
  lastDecisionTime: number;
  personality: PersonalityTraits;
}
```

### 1.2 AgentRegistry como ECS Store

Refactorizar `AgentRegistry` para ser el almacén central de componentes:

```typescript
// src/domain/simulation/ecs/AgentStore.ts

@injectable()
export class AgentStore {
  private components = new Map<string, AgentComponents>();
  
  // Acceso rápido por componente
  private healthIndex = new Map<string, HealthComponent>();
  private needsIndex = new Map<string, NeedsComponent>();
  private transformIndex = new Map<string, TransformComponent>();
  private combatIndex = new Map<string, CombatComponent>();
  // ... otros índices
  
  // Métodos de acceso O(1)
  getComponent<K extends keyof AgentComponents>(
    agentId: string, 
    component: K
  ): AgentComponents[K] | undefined;
  
  setComponent<K extends keyof AgentComponents>(
    agentId: string, 
    component: K, 
    value: AgentComponents[K]
  ): void;
  
  // Queries eficientes
  getAgentsWithComponent<K extends keyof AgentComponents>(
    component: K
  ): string[];
  
  getAgentsInCombat(): string[];
  getAgentsWithLowNeeds(threshold: number): string[];
}
```

---

## Fase 2: Refactorizar Detectores

Los detectores se simplifican para solo:
1. Leer estado desde AgentStore
2. Determinar la acción primitiva
3. Retornar Task con target resuelto

### 2.1 Ejemplo: CombatDetector

```typescript
// ANTES (actual)
export function detectCombat(ctx: DetectorContext): Task[] {
  const tasks: Task[] = [];
  if (ctx.attackerId) {
    tasks.push(createTask({
      agentId: ctx.agentId,
      type: TaskType.ATTACK,
      priority: TASK_PRIORITIES.URGENT,
      target: { entityId: ctx.attackerId },
      source: "combat_detector"
    }));
  }
  return tasks;
}

// DESPUÉS (refactorizado)
export function detectCombat(
  store: AgentStore, 
  agentId: string
): DetectorResult | null {
  const combat = store.getComponent(agentId, 'combat');
  const transform = store.getComponent(agentId, 'transform');
  
  if (!combat?.isInCombat) return null;
  
  // Determinar acción primitiva
  const health = store.getComponent(agentId, 'health');
  const shouldFlee = health && health.current < health.max * 0.2;
  
  if (shouldFlee) {
    // Calcular posición de huida
    const fleeTarget = calculateFleePosition(transform, combat.currentTarget);
    return {
      action: 'flee',
      target: { position: fleeTarget },
      priority: TASK_PRIORITIES.CRITICAL
    };
  }
  
  // Atacar
  return {
    action: 'attack',
    target: { entityId: combat.currentTarget },
    priority: TASK_PRIORITIES.URGENT
  };
}

interface DetectorResult {
  action: string;
  target: TaskTarget;
  priority: number;
  params?: Record<string, unknown>;
}
```

### 2.2 Ejemplo: NeedsDetector

```typescript
export function detectNeeds(
  store: AgentStore, 
  agentId: string
): DetectorResult | null {
  const needs = store.getComponent(agentId, 'needs');
  if (!needs) return null;
  
  // Encontrar necesidad más urgente
  const urgent = findMostUrgentNeed(needs);
  if (!urgent) return null;
  
  // Resolver target según necesidad
  switch (urgent.type) {
    case 'hunger':
      return resolveHungerTarget(store, agentId);
    case 'thirst':
      return resolveThirstTarget(store, agentId);
    case 'energy':
      return { action: 'rest', target: {}, priority: urgent.priority };
    // ... otros
  }
}

function resolveHungerTarget(
  store: AgentStore, 
  agentId: string
): DetectorResult {
  const inventory = store.getComponent(agentId, 'inventory');
  const transform = store.getComponent(agentId, 'transform');
  
  // Si tiene comida en inventario → consumir
  if (inventory?.hasFood()) {
    return {
      action: 'consume',
      target: { itemId: inventory.getBestFood() },
      priority: TASK_PRIORITIES.HIGH
    };
  }
  
  // Si no → buscar comida cercana
  const nearestFood = findNearestFood(store, transform);
  if (nearestFood) {
    return {
      action: 'gather',
      target: { entityId: nearestFood.id, position: nearestFood.position },
      priority: TASK_PRIORITIES.HIGH
    };
  }
  
  // Fallback → explorar
  return {
    action: 'explore',
    target: {},
    priority: TASK_PRIORITIES.NORMAL
  };
}
```

---

## Fase 3: Refactorizar Handlers

Los handlers se simplifican para solo:
1. Recibir la intención del detector
2. Comunicar al sistema apropiado
3. No ejecutar lógica de negocio

### 3.1 Ejemplo: AttackHandler

```typescript
// ANTES (actual)
export function handleAttack(
  ctx: HandlerContext, 
  deps: AttackHandlerDeps
): ActionResult {
  // Lógica de movimiento, daño, etc. mezclada
  if (!isAtTarget(ctx.position, target)) {
    return moveToPosition(ctx, target);
  }
  deps.dealDamage?.(ctx.agentId, targetId, damage);
  return { success: true, completed: true };
}

// DESPUÉS (refactorizado)
export function handleAttack(
  store: AgentStore,
  systems: SystemRegistry,
  agentId: string,
  target: TaskTarget
): HandlerResult {
  const transform = store.getComponent(agentId, 'transform');
  const targetPos = resolveTargetPosition(store, target);
  
  // Si no está en rango → delegar a MovementSystem
  if (!isInRange(transform, targetPos, ATTACK_RANGE)) {
    return systems.movement.requestMove(agentId, targetPos);
  }
  
  // En rango → delegar a CombatSystem
  return systems.combat.requestAttack(agentId, target.entityId!);
}

interface HandlerResult {
  status: 'delegated' | 'completed' | 'failed';
  system: string;
  message?: string;
}
```

### 3.2 Ejemplo: ConsumeHandler

```typescript
export function handleConsume(
  store: AgentStore,
  systems: SystemRegistry,
  agentId: string,
  target: TaskTarget
): HandlerResult {
  const inventory = store.getComponent(agentId, 'inventory');
  
  if (!target.itemId || !inventory?.hasItem(target.itemId)) {
    return { status: 'failed', system: 'inventory', message: 'No item' };
  }
  
  // Delegar a NeedsSystem para consumo
  return systems.needs.requestConsume(agentId, target.itemId);
}
```

---

## Fase 4: Refactorizar Sistemas

Los sistemas se convierten en procesadores de su dominio:
1. Exponen métodos `request*()` para recibir intenciones
2. Modifican solo sus propios componentes
3. Emiten eventos para notificar cambios

### 4.1 Ejemplo: CombatSystem

```typescript
@injectable()
export class CombatSystem extends EventEmitter {
  constructor(
    private store: AgentStore,
    private eventBus: EventBus
  ) {}
  
  /**
   * Handler solicita un ataque
   */
  public requestAttack(attackerId: string, targetId: string): HandlerResult {
    const attackerCombat = this.store.getComponent(attackerId, 'combat');
    const targetHealth = this.store.getComponent(targetId, 'health');
    
    if (!attackerCombat || !targetHealth) {
      return { status: 'failed', system: 'combat', message: 'Invalid entities' };
    }
    
    // Verificar cooldown
    const now = Date.now();
    if (now - attackerCombat.lastAttackTime < attackerCombat.attackCooldown) {
      return { status: 'delegated', system: 'combat', message: 'On cooldown' };
    }
    
    // Calcular daño
    const damage = this.calculateDamage(attackerCombat, targetHealth);
    
    // Aplicar daño al componente de salud del target
    this.applyDamage(targetId, damage, attackerId);
    
    // Actualizar estado de combate del atacante
    this.store.setComponent(attackerId, 'combat', {
      ...attackerCombat,
      lastAttackTime: now,
      isInCombat: true,
      currentTarget: targetId
    });
    
    // Emitir evento para que otros sistemas reaccionen
    this.eventBus.emit('combat:damage_dealt', {
      attackerId,
      targetId,
      damage,
      timestamp: now
    });
    
    return { status: 'completed', system: 'combat' };
  }
  
  private applyDamage(targetId: string, damage: number, sourceId: string): void {
    const health = this.store.getComponent(targetId, 'health');
    if (!health) return;
    
    const newHealth = Math.max(0, health.current - damage);
    
    this.store.setComponent(targetId, 'health', {
      ...health,
      current: newHealth,
      lastDamageTime: Date.now(),
      lastDamageSource: sourceId
    });
    
    // Si murió, emitir evento
    if (newHealth <= 0) {
      this.eventBus.emit('combat:entity_died', { entityId: targetId, killerId: sourceId });
    }
  }
}
```

### 4.2 Ejemplo: NeedsSystem (Refactorizado)

```typescript
@injectable()
export class NeedsSystem extends EventEmitter {
  constructor(
    private store: AgentStore,
    private eventBus: EventBus
  ) {}
  
  /**
   * Handler solicita consumir un item
   */
  public requestConsume(agentId: string, itemId: string): HandlerResult {
    const inventory = this.store.getComponent(agentId, 'inventory');
    const needs = this.store.getComponent(agentId, 'needs');
    
    if (!inventory || !needs) {
      return { status: 'failed', system: 'needs', message: 'Missing components' };
    }
    
    const item = inventory.getItem(itemId);
    if (!item) {
      return { status: 'failed', system: 'needs', message: 'Item not found' };
    }
    
    // Calcular satisfacción de necesidades
    const satisfaction = this.calculateSatisfaction(item);
    
    // Actualizar necesidades
    const newNeeds = { ...needs };
    if (satisfaction.hunger) newNeeds.hunger = Math.min(100, needs.hunger + satisfaction.hunger);
    if (satisfaction.thirst) newNeeds.thirst = Math.min(100, needs.thirst + satisfaction.thirst);
    if (satisfaction.energy) newNeeds.energy = Math.min(100, needs.energy + satisfaction.energy);
    
    this.store.setComponent(agentId, 'needs', newNeeds);
    
    // Notificar a InventorySystem para remover item
    this.eventBus.emit('needs:item_consumed', { agentId, itemId });
    
    return { status: 'completed', system: 'needs' };
  }
  
  /**
   * Update loop - decae necesidades
   */
  public update(deltaTime: number): void {
    const agents = this.store.getAgentsWithComponent('needs');
    
    for (const agentId of agents) {
      const needs = this.store.getComponent(agentId, 'needs')!;
      
      // Aplicar decay
      const newNeeds = this.applyDecay(needs, deltaTime);
      this.store.setComponent(agentId, 'needs', newNeeds);
      
      // Emitir eventos si necesidades críticas
      this.checkCriticalNeeds(agentId, newNeeds);
    }
  }
  
  private checkCriticalNeeds(agentId: string, needs: NeedsComponent): void {
    if (needs.hunger < 20) {
      this.eventBus.emit('needs:critical', { agentId, need: 'hunger', value: needs.hunger });
    }
    if (needs.thirst < 20) {
      this.eventBus.emit('needs:critical', { agentId, need: 'thirst', value: needs.thirst });
    }
    // ... otros
  }
}
```

---

## Fase 5: EventBus Central

### 5.1 Implementación

```typescript
// src/domain/simulation/ecs/EventBus.ts

type EventHandler = (data: unknown) => void;

@injectable()
export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  
  public on(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    
    // Retorna función para unsubscribe
    return () => this.handlers.get(event)?.delete(handler);
  }
  
  public emit(event: string, data: unknown): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          logger.error(`EventBus: Error in handler for ${event}`, error);
        }
      }
    }
  }
  
  public once(event: string, handler: EventHandler): void {
    const wrapper = (data: unknown) => {
      this.handlers.get(event)?.delete(wrapper);
      handler(data);
    };
    this.on(event, wrapper);
  }
}
```

### 5.2 Eventos Estándar

```typescript
// src/domain/simulation/ecs/events.ts

export const SystemEvents = {
  // Combat
  'combat:damage_dealt': true,
  'combat:entity_died': true,
  'combat:combat_started': true,
  'combat:combat_ended': true,
  
  // Needs
  'needs:critical': true,
  'needs:satisfied': true,
  'needs:item_consumed': true,
  
  // Movement
  'movement:arrived': true,
  'movement:path_blocked': true,
  'movement:started': true,
  
  // Inventory
  'inventory:item_added': true,
  'inventory:item_removed': true,
  'inventory:full': true,
  
  // Social
  'social:interaction': true,
  'social:relationship_changed': true,
  
  // Economy
  'economy:transaction': true,
  'economy:resource_gathered': true,
} as const;

export type SystemEvent = keyof typeof SystemEvents;
```

---

## Fase 6: Eliminar Capa de Compatibilidad

### 6.1 Métodos a Eliminar de AISystem

```typescript
// ELIMINAR estos métodos @deprecated:
- syncToGameState()
- setGoal()
- clearGoals()
- getCurrentGoal()
- removeAgentState()
- restoreAIState()
- getAIState() // reemplazar por getActiveTask() + store.getComponent()
- setAgentOffDuty()
- forceGoalReevaluation()
- failCurrentGoal()
- notifyEntityArrived()
```

### 6.2 Tipos Legacy a Eliminar

```typescript
// ELIMINAR de AISystem.ts:
- LegacyAIState
- LegacyMemory
```

### 6.3 Archivos a Refactorizar

| Archivo | Cambios |
|---------|---------|
| `SimulationRunner.ts` | Usar nueva API, registrar sistemas en EventBus |
| `EventRegistry.ts` | Migrar a EventBus central |
| `SnapshotManager.ts` | Serializar componentes desde AgentStore |

---

## Fase 7: Flujo Completo Ejemplo

### Agente con Hambre

```
1. NeedsSystem.update()
   └─▶ Detecta hunger < 30
   └─▶ Emite 'needs:critical' { agentId, need: 'hunger' }

2. AISystem escucha 'needs:critical'
   └─▶ Crea Task { type: SATISFY_NEED, params: { need: 'hunger' } }
   └─▶ Encola en TaskQueue

3. AISystem.update() procesa Task
   └─▶ Llama NeedsDetector(store, agentId)
   └─▶ Detector resuelve: tiene comida en inventario
   └─▶ Retorna { action: 'consume', target: { itemId: 'food_1' } }

4. AISystem despacha a ConsumeHandler
   └─▶ Handler llama systems.needs.requestConsume(agentId, 'food_1')

5. NeedsSystem.requestConsume()
   └─▶ Actualiza needs component
   └─▶ Emite 'needs:item_consumed' { agentId, itemId }

6. InventorySystem escucha 'needs:item_consumed'
   └─▶ Remueve item del inventario
   └─▶ Actualiza inventory component
```

### Agente Recibe Daño

```
1. CombatSystem.requestAttack() [de otro agente]
   └─▶ Aplica daño a health component
   └─▶ Emite 'combat:damage_dealt' { attackerId, targetId, damage }

2. AISystem del target escucha 'combat:damage_dealt'
   └─▶ Crea Task { type: ATTACK/FLEE, target: { entityId: attackerId } }

3. AISystem.update() procesa Task
   └─▶ Llama CombatDetector(store, agentId)
   └─▶ Detector evalúa health: si < 20% → flee, sino → attack
   └─▶ Retorna { action: 'attack', target: { entityId, position } }

4. AISystem despacha a AttackHandler
   └─▶ Verifica rango
   └─▶ Si no en rango → systems.movement.requestMove()
   └─▶ Si en rango → systems.combat.requestAttack()
```

---

## Tareas de Implementación

### Fase 1: ECS Base
- [ ] Crear `src/domain/simulation/ecs/` folder
- [ ] Implementar `AgentComponents.ts` con todos los tipos
- [ ] Implementar `AgentStore.ts` (refactorizar AgentRegistry)
- [ ] Implementar `EventBus.ts`
- [ ] Implementar `SystemRegistry.ts`

### Fase 2: Refactorizar Detectores
- [ ] Refactorizar `NeedsDetector.ts`
- [ ] Refactorizar `CombatDetector.ts`
- [ ] Refactorizar `WorkDetector.ts`
- [ ] Refactorizar `InventoryDetector.ts`
- [ ] Refactorizar `CraftDetector.ts`
- [ ] Refactorizar `BuildDetector.ts`
- [ ] Refactorizar `SocialDetector.ts`
- [ ] Refactorizar `ExploreDetector.ts`
- [ ] Refactorizar `TradeDetector.ts`

### Fase 3: Refactorizar Handlers
- [ ] Refactorizar `ConsumeHandler.ts`
- [ ] Refactorizar `AttackHandler.ts`
- [ ] Refactorizar `FleeHandler.ts`
- [ ] Refactorizar `GatherHandler.ts`
- [ ] Refactorizar `RestHandler.ts`
- [ ] Refactorizar `CraftHandler.ts`
- [ ] Refactorizar `BuildHandler.ts`
- [ ] Refactorizar `DepositHandler.ts`
- [ ] Refactorizar `SocialHandler.ts`
- [ ] Refactorizar `ExploreHandler.ts`
- [ ] Refactorizar `TradeHandler.ts`
- [ ] Refactorizar `MoveHandler.ts`

### Fase 4: Refactorizar Sistemas
- [ ] Refactorizar `NeedsSystem.ts` para usar AgentStore
- [ ] Refactorizar `CombatSystem.ts` para usar AgentStore
- [ ] Refactorizar `MovementSystem.ts` para usar AgentStore
- [ ] Refactorizar `InventorySystem.ts` para usar AgentStore
- [ ] Refactorizar `SocialSystem.ts` para usar AgentStore
- [ ] Crear `HealthSystem.ts` (si no existe)

### Fase 5: Limpiar Legacy
- [ ] Eliminar métodos @deprecated de AISystem
- [ ] Eliminar tipos Legacy
- [ ] Actualizar SimulationRunner
- [ ] Actualizar EventRegistry → usar EventBus
- [ ] Actualizar SnapshotManager

### Fase 6: Tests
- [ ] Tests para AgentStore
- [ ] Tests para EventBus
- [ ] Tests para cada Detector refactorizado
- [ ] Tests para cada Handler refactorizado
- [ ] Tests de integración

---

## Métricas de Éxito

| Métrica | Antes | Objetivo |
|---------|-------|----------|
| Acoplamiento entre sistemas | Alto | Bajo (via eventos) |
| Líneas por handler | ~100 | ~30 |
| Líneas por detector | ~150 | ~50 |
| Facilidad de añadir comportamiento | Difícil | Fácil |
| Testabilidad | Baja | Alta |

---

## Notas Técnicas

### Performance

El `AgentStore` usa índices separados por componente para acceso O(1):

```typescript
// En lugar de buscar en array:
const agent = gameState.agents.find(a => a.id === id); // O(n)

// Acceso directo por índice:
const needs = store.getComponent(id, 'needs'); // O(1)
```

### Memory

Los componentes son objetos planos (no clases) para mejor serialización y menor overhead:

```typescript
// Bueno: objeto plano
interface NeedsComponent { hunger: number; thirst: number; }

// Evitar: clase con métodos
class NeedsComponent { getHunger() { return this.hunger; } }
```

### Immutability

Los sistemas siempre crean nuevos objetos al actualizar:

```typescript
// Bueno: crear nuevo objeto
this.store.setComponent(id, 'needs', { ...needs, hunger: newValue });

// Evitar: mutar directamente
needs.hunger = newValue; // NO
```
