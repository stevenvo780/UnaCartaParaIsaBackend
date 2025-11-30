# 🔬 Análisis Profundo y Propuesta de Refactorización

## Índice
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Diagnóstico: Estado Actual](#diagnóstico-estado-actual)
3. [Problemas Críticos Identificados](#problemas-críticos-identificados)
4. [Propuesta de Arquitectura](#propuesta-de-arquitectura)
5. [Nueva Estructura de Archivos](#nueva-estructura-de-archivos)
6. [Patrones de Diseño Recomendados](#patrones-de-diseño-recomendados)
7. [Plan de Migración](#plan-de-migración)
8. [Beneficios Esperados](#beneficios-esperados)

---

## Resumen Ejecutivo

| Métrica | Actual | Objetivo |
|---------|--------|----------|
| Total archivos `.ts` | 228 | ~180 |
| Total líneas de código | 56,150 | ~45,000 |
| Archivo más grande | 2,715 líneas (AISystem) | < 500 líneas |
| Dependencias en AISystem | 50+ imports | < 10 imports |
| Tiempo debug típico | 1-2 horas | 10-20 min |
| Interfaces `*Deps` | 8+ diferentes | 1 unificada |

### Problema Principal
El sistema de agentes/AI alcanzó una **complejidad exponencial** donde:
- Añadir un comportamiento nuevo requiere modificar **17+ archivos**
- Debuggear un goal requiere rastrear **5+ capas de abstracción**
- El `AISystem.ts` tiene **2,715 líneas** con dependencias circulares resueltas con `@optional()`

---

## Diagnóstico: Estado Actual

### 📊 Análisis Cuantitativo

```
Top 10 Archivos Más Grandes (God Classes):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AISystem.ts                    │ 2,715 líneas │ ⚠️ CRÍTICO
GPUComputeService.ts           │ 1,302 líneas │ ⚠️ Alto
NeedsSystem.ts                 │ 1,297 líneas │ ⚠️ Alto  
AnimalSystem.ts                │ 1,260 líneas │ ⚠️ Alto
SimulationRunner.ts            │ 1,153 líneas │ ⚠️ Alto
AIActionPlanner.ts             │ 1,138 líneas │ ⚠️ Alto
MovementSystem.ts              │ 1,054 líneas │ ⚠️ Alto
PerformanceMonitor.ts          │   989 líneas │ Moderado
LifeCycleSystem.ts             │   954 líneas │ Moderado
RoleSystem.ts                  │   823 líneas │ Moderado
```

### 🕸️ Grafo de Dependencias (AISystem)

```
AISystem.ts imports:
├── 📦 50+ módulos directos
├── 🔄 Dependencias circulares con:
│   ├── NeedsSystem
│   ├── InventorySystem  
│   ├── SocialSystem
│   ├── CraftingSystem
│   ├── WorldResourceSystem
│   ├── HouseholdSystem
│   ├── TaskSystem
│   ├── CombatSystem
│   ├── AnimalSystem
│   ├── MovementSystem
│   ├── QuestSystem
│   └── TimeSystem
└── 🧩 Subsistemas internos:
    ├── AIStateManager
    ├── AIGoalValidator
    ├── AIActionPlanner
    ├── AIActionExecutor
    ├── AIUrgentGoals
    ├── AIZoneHandler
    └── PriorityManager
```

### 📁 Estructura Actual (Problemática)

```
src/
├── application/           # Express app - OK ✓
├── config/               # DI Container - 281 líneas de bindings manuales
├── domain/
│   ├── simulation/
│   │   ├── core/         # 15 archivos mezclados (runner, indices, GPU, metrics...)
│   │   ├── systems/      # 40+ sistemas planos sin jerarquía
│   │   │   └── ai/       # Subdirectorio único - ¿por qué solo AI?
│   │   └── ports/        # Solo 1 archivo
│   ├── types/
│   │   ├── game-types.ts # 530 líneas - MONOLITO de tipos
│   │   └── simulation/   # 31 archivos de tipos dispersos
│   └── world/            # Generación de mundo
├── infrastructure/        # OK - servicios externos
├── shared/
│   ├── constants/        # 51 archivos de enums (!!)
│   └── types/            # Tipos compartidos
├── simulation/           # ⚠️ DUPLICADO con domain/simulation
│   └── data/             # Catálogos - debería estar en domain
└── utils/                # Solo 1 archivo
```

---

## Problemas Críticos Identificados

### 1. 🎭 **God Class Pattern** - `AISystem.ts`

```typescript
// ACTUAL: AISystem.ts - 2,715 líneas
export class AISystem extends EventEmitter {
  // 20+ sistemas inyectados
  private needsSystem?: NeedsSystem;
  private roleSystem?: RoleSystem;
  private worldResourceSystem?: WorldResourceSystem;
  private inventorySystem?: InventorySystem;
  private socialSystem?: SocialSystem;
  private craftingSystem?: EnhancedCraftingSystem;
  private householdSystem?: HouseholdSystem;
  private taskSystem?: TaskSystem;
  private combatSystem?: CombatSystem;
  private animalSystem?: AnimalSystem;
  private _movementSystem?: MovementSystem;
  private questSystem?: QuestSystem;
  private timeSystem?: TimeSystem;
  private sharedKnowledgeSystem?: SharedKnowledgeSystem;
  private equipmentSystem: EquipmentSystem;
  private _entityIndex?: EntityIndex;
  private gpuService?: GPUComputeService;
  private agentRegistry?: AgentRegistry;
  private animalRegistry?: AnimalRegistry;
  // ... y más
}
```

**Impacto**: Cualquier cambio en el comportamiento de agentes requiere modificar este monstruo.

### 2. 🎪 **Interface Explosion** - 8+ interfaces `*Deps`

```typescript
// Cada subsistema de AI tiene su propia interface de dependencias
export interface AgentGoalPlannerDeps { /* 40+ funciones opcionales */ }
export interface AIGoalValidatorDeps { /* 15+ funciones */ }
export interface AIActionPlannerDeps { /* 20+ funciones */ }
export interface AIActionExecutorDeps { /* 12+ funciones */ }
export interface AIUrgentGoalsDeps { /* 8+ funciones */ }
export interface AIZoneHandlerDeps { /* 10+ funciones */ }
export interface BiologicalDriveDeps { /* 6+ funciones */ }
export interface SocialDriveDeps { /* 4+ funciones */ }
```

**Impacto**: Pasar datos entre capas requiere construir objetos gigantes.

### 3. 🎯 **Evaluator Sprawl** - 17 evaluadores dispersos

```
evaluators/
├── AssistEvaluator.ts           │  145 líneas
├── AttentionEvaluator.ts        │   79 líneas  
├── BiologicalDriveEvaluator.ts  │  211 líneas
├── BuildingContributionEvaluator│   82 líneas
├── CognitiveDriveEvaluator.ts   │   64 líneas
├── CollectiveNeedsEvaluator.ts  │  793 líneas │ ⚠️ Demasiado grande
├── CombatEvaluator.ts           │  206 líneas
├── ConstructionEvaluator.ts     │   77 líneas
├── CraftingEvaluator.ts         │   98 líneas
├── DepositEvaluator.ts          │  110 líneas
├── ExpansionEvaluator.ts        │   70 líneas
├── NeedsEvaluator.ts            │  316 líneas
├── OpportunitiesEvaluator.ts    │  118 líneas
├── QuestEvaluator.ts            │   63 líneas
├── ReproductionEvaluator.ts     │   70 líneas
├── SocialDriveEvaluator.ts      │   51 líneas
└── TradeEvaluator.ts            │   54 líneas
                                  ━━━━━━━━━━━━━━
                          Total: 3,062 líneas de lógica dispersa
```

**Impacto**: Añadir un nuevo tipo de goal requiere:
1. Crear evaluador
2. Modificar `AgentGoalPlanner.ts`
3. Modificar `AIActionPlanner.ts`
4. Modificar `AIActionExecutor.ts`
5. Actualizar `AgentGoalPlannerDeps`
6. Actualizar tests (si existen)

### 4. 📦 **Monolithic GameState** - 530 líneas de tipos

```typescript
// game-types.ts contiene TODO mezclado
export interface GameState {
  agents: AgentProfile[];
  entities: SimulationEntity[];
  zones: Zone[];
  resources: GameResources;
  time: number;
  dayTime: number;
  // ... 50+ campos más
  enhancedCrafting?: EnhancedCraftingState;
  worldResources?: Record<string, WorldResourceInstance>;
  socialGraph?: SocialGraphState;
  market?: MarketState;
  inventory?: InventoryState;
  economy?: EconomyState;
  roles?: RolesState;
  // ... y sigue
}
```

**Impacto**: Cambiar cualquier sistema requiere tocar `game-types.ts`.

### 5. 🎭 **Duplicación de Carpetas**

```
src/simulation/           # ← Catálogos de datos
src/domain/simulation/    # ← Lógica de simulación
```

**Impacto**: Confusión sobre dónde poner nuevo código.

### 6. 📚 **51 Archivos de Enums/Constants**

```
shared/constants/
├── AIEnums.ts
├── ActivityEnums.ts
├── AgentEnums.ts
├── AmbientEnums.ts
├── AnimalEnums.ts
├── AppearanceEnums.ts
├── BiomeEnums.ts
├── BuildingEnums.ts
├── CombatEnums.ts
├── CommandEnums.ts
├── CommonConstants.ts
├── ComparisonEnums.ts
├── ConfigConstants.ts
├── ConflictEnums.ts
├── CraftingEnums.ts
├── DivineEnums.ts
├── EconomyEnums.ts
├── EmergenceEnums.ts
├── EntityEnums.ts
├── EntityStatusEnums.ts
├── EnvironmentEnums.ts
├── EquipmentEnums.ts
├── EventEnums.ts
├── FoodEnums.ts
├── GovernanceEnums.ts
├── HttpStatusCodes.ts
├── InteractionEnums.ts
├── ItemEnums.ts
├── KnowledgeEnums.ts
├── LegendEnums.ts
├── LogEnums.ts
├── MovementEnums.ts
├── QuestEnums.ts
├── RecipeEnums.ts
├── ResearchEnums.ts
├── ResourceEnums.ts
├── ResourceVariantEnums.ts
├── ResponseEnums.ts
├── RoleEnums.ts
├── SchedulerEnums.ts
├── SimulationConstants.ts
├── SpriteEnums.ts
├── StatusEnums.ts
├── SystemEnums.ts
├── TaskEnums.ts
├── TaskStatusEnums.ts
├── TileTypeEnums.ts
├── TimeEnums.ts
├── WebSocketEnums.ts
├── WorldConfig.ts
└── ZoneEnums.ts
```

**Impacto**: Encontrar un enum específico es tedioso.

---

## Propuesta de Arquitectura

### Principio Guía: **"Behavior-Driven Agent Architecture" (BDAA)**

> Cada comportamiento de agente es una unidad **autocontenida** que sabe:
> 1. **Cuándo** puede ejecutarse
> 2. **Qué** necesita para ejecutarse
> 3. **Cómo** ejecutarse

### Diagrama de Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CAPA DE APLICACIÓN                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Routes    │  │ Controllers │  │  WebSocket  │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CAPA DE SIMULACIÓN                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    SimulationRunner                           │  │
│  │  (Orquestador ligero: solo tick y coordinación)              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│         ┌────────────────────┼────────────────────┐                │
│         ▼                    ▼                    ▼                │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐           │
│  │   World    │      │   Agents   │      │  Economy   │           │
│  │  Systems   │      │   Module   │      │   Module   │           │
│  └────────────┘      └────────────┘      └────────────┘           │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      AGENT MODULE                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │  │
│  │  │ AgentBrain  │  │ AgentContext│  │  Behaviors  │           │  │
│  │  │ (FSM/BT)    │  │  (Facade)   │  │  (Plugins)  │           │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘           │  │
│  │         │                │                │                   │  │
│  │         └────────────────┼────────────────┘                   │  │
│  │                          ▼                                    │  │
│  │  ┌───────────────────────────────────────────────────────┐   │  │
│  │  │              BehaviorRegistry                          │   │  │
│  │  │  survival/  │  social/  │  work/  │  combat/          │   │  │
│  │  └───────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        CAPA DE DOMINIO                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Entities  │  │    Types    │  │   Events    │                 │
│  │  (Models)   │  │  (Schemas)  │  │   (Bus)     │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     CAPA DE INFRAESTRUCTURA                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Storage   │  │    GPU      │  │   Logging   │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Nueva Estructura de Archivos

```
src/
├── app/                              # Capa de Aplicación (antes: application/)
│   ├── server.ts
│   ├── routes/
│   └── controllers/
│
├── simulation/                       # Capa de Simulación (NUEVA)
│   ├── runner/
│   │   ├── SimulationRunner.ts       # ~300 líneas (reducido de 1,153)
│   │   ├── Scheduler.ts
│   │   └── Synchronizer.ts
│   │
│   ├── modules/                      # Módulos por dominio
│   │   ├── agents/                   # ★ MÓDULO DE AGENTES REFACTORIZADO
│   │   │   ├── AgentModule.ts        # Fachada del módulo
│   │   │   ├── AgentContext.ts       # Contexto unificado (~200 líneas)
│   │   │   ├── AgentBrain.ts         # FSM/BT ligero (~150 líneas)
│   │   │   ├── AgentRegistry.ts      # (existente, mejorado)
│   │   │   ├── behaviors/            # Comportamientos autocontenidos
│   │   │   │   ├── Behavior.ts       # Interface base
│   │   │   │   ├── BehaviorSelector.ts
│   │   │   │   ├── survival/
│   │   │   │   │   ├── SeekFood.ts
│   │   │   │   │   ├── SeekWater.ts
│   │   │   │   │   └── Rest.ts
│   │   │   │   ├── social/
│   │   │   │   │   ├── Socialize.ts
│   │   │   │   │   └── Reproduce.ts
│   │   │   │   ├── work/
│   │   │   │   │   ├── Harvest.ts
│   │   │   │   │   ├── Build.ts
│   │   │   │   │   └── Craft.ts
│   │   │   │   └── combat/
│   │   │   │       ├── Attack.ts
│   │   │   │       └── Flee.ts
│   │   │   └── systems/              # Sistemas específicos de agentes
│   │   │       ├── NeedsSystem.ts    # Reducido (~500 líneas)
│   │   │       └── MovementSystem.ts # Reducido (~400 líneas)
│   │   │
│   │   ├── world/                    # Módulo de Mundo
│   │   │   ├── WorldModule.ts
│   │   │   ├── zones/
│   │   │   │   ├── ZoneSystem.ts
│   │   │   │   └── ZoneTypes.ts
│   │   │   ├── terrain/
│   │   │   │   ├── TerrainSystem.ts
│   │   │   │   └── TerrainLoader.ts
│   │   │   ├── resources/
│   │   │   │   ├── WorldResourceSystem.ts
│   │   │   │   └── ResourceSpawner.ts
│   │   │   └── buildings/
│   │   │       ├── BuildingSystem.ts
│   │   │       └── BuildingTypes.ts
│   │   │
│   │   ├── economy/                  # Módulo de Economía
│   │   │   ├── EconomyModule.ts
│   │   │   ├── InventorySystem.ts
│   │   │   ├── TradeSystem.ts
│   │   │   ├── MarketSystem.ts
│   │   │   └── ProductionSystem.ts
│   │   │
│   │   ├── social/                   # Módulo Social
│   │   │   ├── SocialModule.ts
│   │   │   ├── SocialSystem.ts
│   │   │   ├── MarriageSystem.ts
│   │   │   ├── ReputationSystem.ts
│   │   │   └── GovernanceSystem.ts
│   │   │
│   │   ├── combat/                   # Módulo de Combate
│   │   │   ├── CombatModule.ts
│   │   │   ├── CombatSystem.ts
│   │   │   └── ConflictSystem.ts
│   │   │
│   │   ├── life/                     # Módulo de Ciclo de Vida
│   │   │   ├── LifeModule.ts
│   │   │   ├── LifeCycleSystem.ts
│   │   │   ├── GenealogySystem.ts
│   │   │   └── AnimalSystem.ts
│   │   │
│   │   └── time/                     # Módulo de Tiempo
│   │       ├── TimeModule.ts
│   │       ├── TimeSystem.ts
│   │       └── WeatherSystem.ts
│   │
│   ├── core/                         # Servicios Core
│   │   ├── events/
│   │   │   ├── EventBus.ts
│   │   │   ├── EventSchemas.ts
│   │   │   └── EventTypes.ts
│   │   ├── indices/
│   │   │   ├── EntityIndex.ts
│   │   │   └── SpatialIndex.ts
│   │   ├── gpu/
│   │   │   ├── GPUService.ts
│   │   │   └── GPUBatch.ts
│   │   └── metrics/
│   │       ├── PerformanceMonitor.ts
│   │       └── MetricsCollector.ts
│   │
│   └── data/                         # Datos estáticos (antes: simulation/data/)
│       ├── catalogs/
│       │   ├── RecipesCatalog.ts
│       │   ├── FoodCatalog.ts
│       │   └── MaterialsCatalog.ts
│       └── configs/
│           ├── AnimalConfigs.ts
│           └── BuildingConfigs.ts
│
├── domain/                           # Capa de Dominio (simplificada)
│   ├── entities/                     # Modelos de entidades
│   │   ├── Agent.ts
│   │   ├── Animal.ts
│   │   ├── Building.ts
│   │   └── Resource.ts
│   │
│   ├── types/                        # Tipos divididos por módulo
│   │   ├── core.types.ts             # Tipos básicos (Position, Size, etc.)
│   │   ├── agent.types.ts
│   │   ├── world.types.ts
│   │   ├── economy.types.ts
│   │   ├── social.types.ts
│   │   ├── combat.types.ts
│   │   └── state.types.ts            # GameState reducido
│   │
│   └── events/                       # Eventos de dominio
│       └── DomainEvents.ts
│
├── infrastructure/                   # Sin cambios mayores
│   ├── controllers/
│   ├── services/
│   │   ├── storage/
│   │   ├── chunk/
│   │   └── world/
│   └── utils/
│       └── logger.ts
│
├── shared/                           # Compartido (simplificado)
│   ├── constants/                    # Consolidado de 51 → ~15 archivos
│   │   ├── agent.constants.ts        # AIEnums + AgentEnums + RoleEnums
│   │   ├── world.constants.ts        # BiomeEnums + ZoneEnums + TileEnums
│   │   ├── economy.constants.ts      # ResourceEnums + CraftingEnums + ItemEnums
│   │   ├── social.constants.ts       # InteractionEnums + GovernanceEnums
│   │   ├── combat.constants.ts       # CombatEnums + ConflictEnums
│   │   ├── system.constants.ts       # EventEnums + SchedulerEnums
│   │   └── config.constants.ts       # ConfigConstants + WorldConfig
│   │
│   ├── types/                        # Tipos compartidos
│   │   └── commands.ts
│   │
│   └── utils/                        # Utilidades compartidas
│       ├── math.ts
│       └── validation.ts
│
└── config/                           # Configuración (simplificado)
    ├── container.ts                  # Modularizado con auto-binding
    ├── Types.ts                      # Reducido con namespaces
    └── config.ts
```

---

## Patrones de Diseño Recomendados

### 1. **Behavior Pattern** (Reemplaza Goals + Tasks + Actions)

```typescript
// src/simulation/modules/agents/behaviors/Behavior.ts

export interface Behavior<TContext = AgentContext> {
  readonly id: string;
  readonly type: BehaviorType;
  
  /**
   * Calcula la prioridad dinámicamente basándose en el contexto.
   * La prioridad determina qué comportamiento se ejecuta.
   */
  getPriority(ctx: TContext): number;
  
  /**
   * Evalúa si el comportamiento puede ejecutarse en el estado actual.
   */
  canExecute(ctx: TContext): boolean;
  
  /**
   * Ejecuta el comportamiento y retorna su resultado.
   */
  execute(ctx: TContext): BehaviorResult;
  
  /**
   * Limpieza opcional cuando el comportamiento se interrumpe.
   */
  onInterrupt?(ctx: TContext): void;
}

export type BehaviorResult = 
  | { status: 'running'; progress: number; message?: string }
  | { status: 'success'; data?: unknown }
  | { status: 'failed'; reason: string; retryable: boolean };

// Ejemplo de implementación
// src/simulation/modules/agents/behaviors/survival/SeekFood.ts

export class SeekFoodBehavior implements Behavior {
  readonly id = 'seek-food';
  readonly type = BehaviorType.SURVIVAL;
  
  getPriority(ctx: AgentContext): number {
    const hunger = ctx.needs.hunger;
    if (hunger < 20) return 0.95;  // Crítico
    if (hunger < 40) return 0.7;   // Urgente
    if (hunger < 60) return 0.4;   // Normal
    return 0;                       // No necesario
  }
  
  canExecute(ctx: AgentContext): boolean {
    // Puede ejecutarse si tiene hambre y hay comida disponible
    return ctx.needs.hunger < 70 && 
           (ctx.inventory.hasFood() || ctx.world.hasNearbyFood(ctx.position));
  }
  
  execute(ctx: AgentContext): BehaviorResult {
    // Primero, consumir del inventario si hay
    if (ctx.inventory.hasFood()) {
      const consumed = ctx.consumeFood();
      if (consumed) {
        return { status: 'success', data: { consumed } };
      }
    }
    
    // Si no, buscar comida cercana
    const food = ctx.world.findNearestFood(ctx.position);
    if (!food) {
      return { status: 'failed', reason: 'no_food_found', retryable: true };
    }
    
    // Si está lejos, moverse hacia la comida
    if (ctx.distanceTo(food.position) > 1) {
      ctx.moveTo(food.position);
      return { status: 'running', progress: 0.5, message: 'moving_to_food' };
    }
    
    // Recoger la comida
    ctx.harvestResource(food.id);
    return { status: 'running', progress: 0.8, message: 'harvesting' };
  }
}
```

### 2. **Context Pattern** (Facade Unificada)

```typescript
// src/simulation/modules/agents/AgentContext.ts

/**
 * Contexto unificado que provee acceso a todos los datos y acciones
 * que un comportamiento puede necesitar.
 * 
 * BENEFICIO: Reemplaza las 8+ interfaces *Deps con una sola.
 */
export class AgentContext {
  constructor(
    private readonly agentId: string,
    private readonly registry: AgentRegistry,
    private readonly worldModule: WorldModule,
    private readonly eventBus: EventBus,
  ) {}
  
  // ═══════════════════════════════════════════
  // LECTURA DE ESTADO (Queries)
  // ═══════════════════════════════════════════
  
  get id(): string { return this.agentId; }
  
  get position(): Position {
    return this.registry.getPosition(this.agentId);
  }
  
  get needs(): Readonly<EntityNeedsData> {
    return this.registry.getNeeds(this.agentId);
  }
  
  get inventory(): Readonly<Inventory> {
    return this.registry.getInventory(this.agentId);
  }
  
  get profile(): Readonly<AgentProfile> {
    return this.registry.getProfile(this.agentId)!;
  }
  
  get aiState(): Readonly<AIState> {
    return this.registry.getAIState(this.agentId)!;
  }
  
  // ═══════════════════════════════════════════
  // QUERIES DEL MUNDO
  // ═══════════════════════════════════════════
  
  get world(): WorldQueries {
    return {
      hasNearbyFood: (pos) => this.worldModule.hasNearbyResource(pos, 'food'),
      findNearestFood: (pos) => this.worldModule.findNearest(pos, 'food'),
      findNearestWater: (pos) => this.worldModule.findNearest(pos, 'water'),
      getCurrentZone: () => this.worldModule.getZoneAt(this.position),
      // ... más queries
    };
  }
  
  // ═══════════════════════════════════════════
  // COMANDOS (Mutations)
  // ═══════════════════════════════════════════
  
  moveTo(target: Position): void {
    this.eventBus.emit('AGENT_MOVE_REQUESTED', {
      agentId: this.agentId,
      target,
    });
  }
  
  consumeFood(amount: number = 1): boolean {
    return this.registry.consumeFromInventory(this.agentId, 'food', amount);
  }
  
  harvestResource(resourceId: string): void {
    this.eventBus.emit('HARVEST_REQUESTED', {
      agentId: this.agentId,
      resourceId,
    });
  }
  
  emitAction(action: ActionType, data?: Record<string, unknown>): void {
    this.eventBus.emit('AGENT_ACTION_COMPLETE', {
      agentId: this.agentId,
      action,
      data,
      timestamp: Date.now(),
    });
  }
  
  // ═══════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════
  
  distanceTo(target: Position): number {
    const pos = this.position;
    return Math.hypot(target.x - pos.x, target.y - pos.y);
  }
}
```

### 3. **Module Pattern** (Encapsulamiento)

```typescript
// src/simulation/modules/agents/AgentModule.ts

/**
 * Módulo de Agentes - Encapsula toda la lógica de agentes.
 * 
 * BENEFICIO: SimulationRunner solo conoce AgentModule,
 * no los 20+ sistemas internos.
 */
@injectable()
export class AgentModule {
  private contexts = new Map<string, AgentContext>();
  private brains = new Map<string, AgentBrain>();
  
  constructor(
    @inject(TYPES.AgentRegistry) private registry: AgentRegistry,
    @inject(TYPES.WorldModule) private worldModule: WorldModule,
    @inject(TYPES.EventBus) private eventBus: EventBus,
    @inject(TYPES.BehaviorRegistry) private behaviors: BehaviorRegistry,
  ) {}
  
  /**
   * Inicializa el módulo con los agentes existentes.
   */
  initialize(agentIds: string[]): void {
    for (const id of agentIds) {
      this.registerAgent(id);
    }
  }
  
  /**
   * Registra un nuevo agente en el módulo.
   */
  registerAgent(agentId: string): void {
    const ctx = new AgentContext(
      agentId,
      this.registry,
      this.worldModule,
      this.eventBus,
    );
    const brain = new AgentBrain(ctx, this.behaviors);
    
    this.contexts.set(agentId, ctx);
    this.brains.set(agentId, brain);
  }
  
  /**
   * Tick del módulo - procesa todos los agentes.
   */
  update(deltaMs: number): void {
    for (const [agentId, brain] of this.brains) {
      const ctx = this.contexts.get(agentId)!;
      brain.tick(ctx, deltaMs);
    }
  }
  
  /**
   * Obtiene el contexto de un agente específico.
   */
  getContext(agentId: string): AgentContext | undefined {
    return this.contexts.get(agentId);
  }
}
```

### 4. **Registry Auto-Binding** (Simplifica DI)

```typescript
// src/config/container.ts

import { Container } from 'inversify';
import { TYPES } from './Types';

// Auto-discovery de módulos
const modules = [
  AgentModule,
  WorldModule,
  EconomyModule,
  SocialModule,
  CombatModule,
  LifeModule,
  TimeModule,
];

// Auto-discovery de behaviors
const behaviors = [
  SeekFoodBehavior,
  SeekWaterBehavior,
  RestBehavior,
  SocializeBehavior,
  // ... todos los behaviors
];

export function configureContainer(): Container {
  const container = new Container();
  
  // Registrar módulos automáticamente
  for (const Module of modules) {
    container.bind(Module).toSelf().inSingletonScope();
  }
  
  // Registrar behaviors automáticamente
  const behaviorRegistry = new BehaviorRegistry();
  for (const Behavior of behaviors) {
    behaviorRegistry.register(new Behavior());
  }
  container.bind(TYPES.BehaviorRegistry).toConstantValue(behaviorRegistry);
  
  // Core services
  container.bind(TYPES.EventBus).to(EventBus).inSingletonScope();
  container.bind(TYPES.GameState).toConstantValue(createInitialState());
  
  return container;
}
```

---

## Plan de Migración

### Fase 1: Fundamentos (3-5 días)
**Sin romper nada existente**

1. [ ] Crear `AgentContext` como wrapper de `AgentRegistry`
2. [ ] Crear interface `Behavior` y `BehaviorSelector`
3. [ ] Crear `AgentBrain` básico
4. [ ] Crear `BehaviorRegistry`
5. [ ] Feature flag: `USE_NEW_AGENT_SYSTEM=false`

### Fase 2: Migrar Survival Behaviors (3-4 días)
**Testing en paralelo con sistema actual**

1. [ ] Migrar `BiologicalDriveEvaluator` → `SeekFood`, `SeekWater`, `Rest`
2. [ ] Integrar con `AgentBrain`
3. [ ] Tests de comparación con sistema actual
4. [ ] Feature flag: `USE_NEW_SURVIVAL=true` para testing

### Fase 3: Migrar Work/Social Behaviors (4-5 días)

1. [ ] Migrar `CognitiveDriveEvaluator` → `Harvest`, `Build`, `Craft`
2. [ ] Migrar `SocialDriveEvaluator` → `Socialize`, `Reproduce`
3. [ ] Migrar `CollectiveNeedsEvaluator` (el más grande)

### Fase 4: Migrar Combat/Quest (3-4 días)

1. [ ] Migrar `CombatEvaluator` → `Attack`, `Flee`
2. [ ] Migrar `QuestEvaluator` → `QuestBehavior`

### Fase 5: Reorganización de Archivos (2-3 días)

1. [ ] Mover archivos a nueva estructura
2. [ ] Actualizar imports
3. [ ] Consolidar enums (51 → ~15 archivos)
4. [ ] Dividir `game-types.ts` por módulo

### Fase 6: Limpieza (2-3 días)

1. [ ] Eliminar código muerto
2. [ ] Eliminar feature flags
3. [ ] Actualizar documentación
4. [ ] Actualizar tests

**Total estimado: 3-4 semanas**

---

## Beneficios Esperados

### Cuantitativos

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Líneas AISystem | 2,715 | ~200 | **92%** ↓ |
| Interfaces *Deps | 8 | 1 | **87%** ↓ |
| Archivos para nuevo behavior | 17 | 1 | **94%** ↓ |
| Tiempo debug | 1-2h | 10-20min | **80%** ↓ |
| Archivos de enums | 51 | ~15 | **70%** ↓ |
| Líneas game-types | 530 | ~100 | **81%** ↓ |

### Cualitativos

1. **Testabilidad**: Cada behavior es una unidad testeable en aislamiento
2. **Extensibilidad**: Añadir comportamiento = 1 archivo nuevo
3. **Legibilidad**: `canExecute` + `execute` explícitos en lugar de 5 capas
4. **Mantenibilidad**: Cambio en hunger no afecta combat
5. **Onboarding**: Nuevos desarrolladores entienden la arquitectura en horas, no días
6. **Performance**: Sin 40+ llamadas a funciones por agente/tick

---

## Siguiente Paso Recomendado

Comenzar con **Fase 1** creando los archivos base:

1. `src/simulation/modules/agents/AgentContext.ts`
2. `src/simulation/modules/agents/behaviors/Behavior.ts`
3. `src/simulation/modules/agents/behaviors/BehaviorSelector.ts`
4. `src/simulation/modules/agents/AgentBrain.ts`

¿Procedemos con la implementación?
