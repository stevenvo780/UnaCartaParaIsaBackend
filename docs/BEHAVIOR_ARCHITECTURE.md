# Behavior-Driven Agent Architecture (BDAA)

## Overview

This document describes the new agent behavior system that replaces the legacy Goals+Tasks+Actions pattern. The BDAA simplifies agent decision-making and reduces code complexity from ~2,700 lines to a modular, maintainable architecture.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BehaviorBridge                           │
│  (Integrates new system with legacy AI, enables gradual migration)│
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AgentBrain (FSM)                         │
│  - Manages current behavior state                               │
│  - Handles behavior transitions                                 │
│  - Tracks behavior history                                      │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BehaviorSelector                           │
│  - Evaluates all registered behaviors                           │
│  - Selects highest priority behavior                            │
│  - Supports multiple selection strategies                       │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BehaviorRegistry                           │
│  - Stores all behavior implementations                          │
│  - Organizes by domain (survival, work, social, combat)         │
│  - Provides lookup and statistics                               │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Behaviors                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Survival │ │   Work   │ │  Social  │ │  Combat  │           │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤           │
│  │ SeekFood │ │ Harvest  │ │Socialize │ │   Flee   │           │
│  │SeekWater │ │ Deposit  │ │          │ │  Attack  │           │
│  │   Rest   │ │  Craft   │ │          │ │          │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Behavior Interface

Every behavior implements the `Behavior` interface:

```typescript
interface Behavior {
  type: BehaviorType;        // Unique identifier
  domain: BehaviorDomain;    // Category (survival, work, etc.)
  
  evaluate(ctx: BehaviorContext): BehaviorEvaluation;  // Can we run? What priority?
  run(ctx: BehaviorContext): Promise<BehaviorResult>;  // Execute the behavior
  interrupt?(ctx: BehaviorContext): void;              // Handle interruption
}
```

### 2. BehaviorContext

Provides all data a behavior needs:

```typescript
interface BehaviorContext {
  agent: AgentProfile;      // Agent state, needs, traits
  tick: number;             // Current simulation tick
  deltaTime: number;        // Time since last tick
  world: BehaviorWorldContext;  // Nearby resources, threats, agents
}
```

### 3. Feature Flags

Gradual migration via feature flags in `src/config/features.ts`:

- `USE_NEW_AGENT_SYSTEM` - Master switch
- `USE_NEW_SURVIVAL` - Enables SeekFood, SeekWater, Rest
- `USE_NEW_WORK` - Enables Harvest, Deposit, Craft
- `USE_NEW_SOCIAL` - Enables Socialize
- `USE_NEW_COMBAT` - Enables Flee, Attack

## Directory Structure

```
src/simulation/modules/agents/
├── behaviors/
│   ├── Behavior.ts           # Core interfaces & types
│   ├── index.ts              # Central exports
│   ├── survival/
│   │   ├── SeekFood.ts
│   │   ├── SeekWater.ts
│   │   ├── Rest.ts
│   │   └── index.ts
│   ├── work/
│   │   ├── Harvest.ts
│   │   ├── Deposit.ts
│   │   ├── Craft.ts
│   │   └── index.ts
│   ├── social/
│   │   ├── Socialize.ts
│   │   └── index.ts
│   └── combat/
│       ├── Flee.ts
│       ├── Attack.ts
│       └── index.ts
└── systems/
    ├── AgentContext.ts       # Unified data facade
    ├── AgentBrain.ts         # Lightweight FSM
    ├── BehaviorRegistry.ts   # Central registry
    ├── BehaviorSelector.ts   # Selection logic
    └── BehaviorBridge.ts     # Legacy integration
```

## Migration Guide

### Enabling the New System

Set environment variables:

```bash
USE_NEW_AGENT_SYSTEM=true
USE_NEW_SURVIVAL=true
USE_NEW_WORK=true
USE_NEW_SOCIAL=true
USE_NEW_COMBAT=true
```

### Creating a New Behavior

1. Create behavior class implementing `Behavior`:

```typescript
export class MyBehavior implements Behavior {
  readonly type = BehaviorType.MY_BEHAVIOR;
  readonly domain = "work" as const;

  evaluate(ctx: BehaviorContext): BehaviorEvaluation {
    // Return canRun: true/false and priority
  }

  async run(ctx: BehaviorContext): Promise<BehaviorResult> {
    // Execute behavior logic
  }
}
```

2. Register in `BehaviorBridge.initialize()`:

```typescript
this.registry.register(new MyBehavior());
```

3. Add type to `BehaviorType` enum if needed.

### Removing Legacy Evaluators

Once a domain is fully migrated:

1. Remove the corresponding evaluator from `AISystem`
2. Update imports
3. Run tests to verify

## Performance Considerations

- Behaviors are evaluated every tick, keep `evaluate()` fast
- Use the `BehaviorContext.world` cache, avoid redundant lookups
- State is stored per-agent in behavior class, not globally

## Testing

```typescript
// Create test context
const ctx = createTestContext({
  agentOverrides: { needs: { hunger: 20 } },
  worldOverrides: { nearbyFood: [{ id: 'food1', position: {x:0, y:0}, amount: 10 }] }
});

// Test behavior evaluation
const behavior = new SeekFoodBehavior();
const evaluation = behavior.evaluate(ctx);
expect(evaluation.canRun).toBe(true);
```

## Comparison: Old vs New

| Aspect | Old (Goals+Tasks+Actions) | New (BDAA) |
|--------|---------------------------|------------|
| Lines of code | ~2,700 (AISystem.ts) | ~300 per behavior |
| Decision flow | Goal → Task → Action chain | Single behavior handles all |
| Dependencies | 50+ imports | Minimal, self-contained |
| Testing | Complex mocking | Simple context mocking |
| Debug | Multi-file trace | Single behavior trace |
| Extensibility | Modify evaluator classes | Add new behavior class |
