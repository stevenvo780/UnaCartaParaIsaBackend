# Systems Architecture

## Overview

The simulation is driven by **41 specialized systems**, each responsible for a specific domain of game logic. Systems are designed to be:

- **Modular**: Each system handles one concern
- **Composable**: Systems can depend on each other via dependency injection
- **Testable**: Systems are injectable and mockable

## System Organization

Systems are logically grouped by domain. Import from the central index:

```typescript
import { AISystem, NeedsSystem, WorldResourceSystem } from "../systems";
```

### 🤖 Agent Systems
Control agent behavior, decision-making, and physical needs.

| System | Description |
|--------|-------------|
| `AISystem` | Main AI orchestrator - goal planning and action execution |
| `NeedsSystem` | Tracks hunger, thirst, energy, happiness, social needs |
| `MovementSystem` | Pathfinding and movement execution |
| `RoleSystem` | Occupation assignment and role-based behavior |
| `NeedsBatchProcessor` | Batch processing for needs calculations |
| `MovementBatchProcessor` | Batch processing for movement calculations |

**AI Subsystems** (in `ai/core/`):
- `SimplifiedGoalPlanner` - Declarative goal planning with GoalRules
- `SimpleActionPlanner` - Action planning using ActionPlanRules
- `AIActionExecutor` - Executes planned actions
- `PriorityManager` - Manages goal priorities
- `WorkGoalGenerator` - Generates work-related goals

### 🌍 World Systems
Manage the game world, resources, and time.

| System | Description |
|--------|-------------|
| `WorldResourceSystem` | Resource spawning, depletion, regeneration |
| `TerrainSystem` | Terrain generation and queries |
| `ChunkLoadingSystem` | Dynamic chunk loading/unloading |
| `TimeSystem` | Day/night cycle, seasons |
| `ResourceAttractionSystem` | Resource attraction zones |

### 👥 Social Systems
Handle relationships, families, and social dynamics.

| System | Description |
|--------|-------------|
| `SocialSystem` | Friendships, relationships, social interactions |
| `MarriageSystem` | Marriage proposals, ceremonies, divorce |
| `HouseholdSystem` | Family units, shared resources |
| `ReputationSystem` | Individual and faction reputation |
| `GenealogySystem` | Family trees, inheritance |
| `SharedKnowledgeSystem` | Knowledge sharing between agents |

### 💰 Economy Systems
Control trade, crafting, and economic activities.

| System | Description |
|--------|-------------|
| `TradeSystem` | Agent-to-agent trading |
| `MarketSystem` | Market prices, supply/demand |
| `EconomySystem` | Global economic state |
| `InventorySystem` | Agent inventories, item management |
| `EnhancedCraftingSystem` | Recipe crafting with skills |
| `ProductionSystem` | Building-based production |
| `ResourceReservationSystem` | Resource claiming and reservations |
| `RecipeDiscoverySystem` | Learning new recipes |

### ⚔️ Combat Systems
Handle fighting and conflict resolution.

| System | Description |
|--------|-------------|
| `CombatSystem` | Combat mechanics, damage calculation |
| `ConflictResolutionSystem` | Non-violent conflict resolution |

### 🦌 Life Systems
Manage lifecycle and animals.

| System | Description |
|--------|-------------|
| `LifeCycleSystem` | Birth, aging, death |
| `AnimalSystem` | Animal AI and behavior |
| `AnimalBatchProcessor` | Batch processing for animals |

### 🏠 Building Systems
Control construction and maintenance.

| System | Description |
|--------|-------------|
| `BuildingSystem` | Construction, blueprints |
| `BuildingMaintenanceSystem` | Repair, decay |

### 📜 Governance Systems
Manage quests, tasks, and social norms.

| System | Description |
|--------|-------------|
| `GovernanceSystem` | Laws, policies |
| `NormsSystem` | Social norms, expectations |
| `QuestSystem` | Quest creation and tracking |
| `TaskSystem` | Task assignment and completion |

### 🎭 Miscellaneous Systems
Other specialized systems.

| System | Description |
|--------|-------------|
| `AmbientAwarenessSystem` | Environmental awareness |
| `InteractionGameSystem` | Mini-games during interactions |
| `ItemGenerationSystem` | Procedural item generation |
| `KnowledgeNetworkSystem` | Knowledge graph |
| `LivingLegendsSystem` | Legendary agents and stories |

## Architecture Decisions

### Declarative AI (GoalRules)
The AI system uses declarative rules instead of imperative code:

```typescript
// Old: 15 evaluator classes (~3000 lines)
// New: Declarative rules (~800 lines)

const survivalRules: GoalRule[] = [
  {
    name: "critical-hunger",
    priority: AgentPriority.SURVIVAL,
    condition: ctx => ctx.needs.hunger < 20,
    createGoal: ctx => createEatGoal(ctx),
  },
  // ...
];
```

### Batch Processing
CPU-intensive operations use batch processors:

- `NeedsBatchProcessor` - Updates needs in batches
- `MovementBatchProcessor` - Calculates paths in batches
- `AnimalBatchProcessor` - Processes animal AI in batches

### Dependency Injection
All systems use Inversify for DI:

```typescript
@injectable()
export class AISystem {
  constructor(
    @inject(TYPES.NeedsSystem) private needsSystem: NeedsSystem,
    @inject(TYPES.MovementSystem) private movementSystem: MovementSystem,
  ) {}
}
```

## File Structure

```
src/domain/simulation/systems/
├── index.ts                    # Central exports (grouped by domain)
├── AISystem.ts                 # Main AI system
├── ai/                         # AI subsystems
│   ├── core/                   # Core AI components
│   │   ├── SimplifiedGoalPlanner.ts
│   │   ├── GoalRules.ts        # Declarative goal rules
│   │   ├── ActionPlanRules.ts  # Declarative action rules
│   │   ├── SimpleActionPlanner.ts
│   │   └── ...
│   └── evaluators/             # Context evaluators
├── animals/                    # Animal subsystems
├── movement/                   # Movement subsystems
└── [41 system files]           # Domain systems
```

## Testing

Each system has corresponding tests in `tests/`:

```bash
# Run all system tests
npm test -- --grep "System"

# Run specific system tests
npm test -- --grep "AISystem"
```

## Performance

Systems are designed for performance:

- **Batch processing** for CPU-intensive operations
- **Spatial indexing** via SharedSpatialIndex
- **GPU acceleration** via GPUComputeService (optional)
- **Multi-rate scheduling** via MultiRateScheduler
