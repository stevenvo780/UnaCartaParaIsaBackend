/**
 * Systems Index
 * ==============
 *
 * Central re-export for all simulation systems.
 * Systems are logically grouped by domain for easy discovery.
 *
 * TOTAL SYSTEMS: 27 main systems organized in 8 logical domains
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ DOMAIN           │ SYSTEMS                                             │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ AGENTS (5)       │ AI, Needs, Movement, Role, Equipment                │
 * │ WORLD (7)        │ WorldResource, ItemGeneration, Production, Animal,  │
 * │                  │ AmbientAwareness, Terrain, ChunkLoading             │
 * │ SOCIAL (5)       │ Social, Marriage, Household, Reputation, Genealogy  │
 * │ ECONOMY (5)      │ Economy, Inventory, EnhancedCrafting,               │
 * │                  │ RecipeDiscovery, ResourceReservation                │
 * │ CONFLICT (2)     │ Combat, ConflictResolution                          │
 * │ STRUCTURES (2)   │ Building, Governance                                │
 * │ LIFECYCLE (1)    │ LifeCycle                                           │
 * │ OBJECTIVES (1)   │ Task                                                │
 * │ CORE (1)         │ Time                                                │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * SUBDIRECTORIES (existing):
 * - ai/        → AI subsystems (planners, validators, evaluators, SharedKnowledge)
 * - animals/   → AnimalSystem + helpers (behavior, genetics, needs, spawning)
 * - movement/  → MovementSystem + batch processor + helpers
 * - needs/     → NeedsSystem + batch processor
 *
 * MERGED/ELIMINATED:
 * - InteractionGameSystem → eliminated (minimal functionality)
 * - LivingLegendsSystem → eliminated (decorative only)
 * - BuildingMaintenanceSystem → merged into BuildingSystem
 * - SharedKnowledgeSystem → moved to ai/ (internal infrastructure)
 * - QuestSystem → eliminated (narrative quests not needed for simulation)
 * - TradeSystem → merged into EconomySystem
 * - MarketSystem → merged into EconomySystem
 * - NormsSystem → merged into ConflictResolutionSystem
 * - ResourceAttractionSystem → merged into AmbientAwarenessSystem
 * - ToolStorageSystem → merged into EquipmentSystem
 * - KnowledgeNetworkSystem → eliminated (unused)
 */

export { NeedsSystem } from "./agents/needs/NeedsSystem";
export { NeedsBatchProcessor } from "./agents/needs/NeedsBatchProcessor";
export { MovementSystem } from "./agents/movement/MovementSystem";
export { MovementBatchProcessor } from "./agents/movement/MovementBatchProcessor";
export { RoleSystem } from "./agents/RoleSystem";
export {
  EquipmentSystem,
  equipmentSystem,
  toolStorage,
  TOOL_CATEGORIES,
  ROLE_TOOL_NEEDS,
} from "./agents/EquipmentSystem";
export { AmbientAwarenessSystem } from "./agents/AmbientAwarenessSystem";
export { SystemRegistry } from "./agents/SystemRegistry";
export type {
  HandlerResult,
  ISystem,
  IMovementSystem,
  ICombatSystem,
  INeedsSystem,
  IInventorySystem,
  ISocialSystem,
  ICraftingSystem,
  IBuildingSystem,
  ITradeSystem,
} from "./agents/SystemRegistry";

export { AgentRegistry } from "./agents/AgentRegistry";
export type { MovementState } from "./agents/AgentRegistry";

export * from "./agents/ai";

export { WorldResourceSystem } from "./world/WorldResourceSystem";
export { ItemGenerationSystem } from "./world/ItemGenerationSystem";
export { ProductionSystem } from "./world/ProductionSystem";
export { AnimalSystem } from "./world/animals/AnimalSystem";
export { AnimalBatchProcessor } from "./world/animals/AnimalBatchProcessor";
export { AnimalRegistry } from "./world/animals/AnimalRegistry";
export * from "./world/animals/AnimalBehavior";
export { TerrainSystem } from "./world/TerrainSystem";
export { ChunkLoadingSystem } from "./world/ChunkLoadingSystem";
export { WorldQueryService } from "./world/WorldQueryService";
export type {
  QueryResult,
  ResourceQueryResult,
  AnimalQueryResult,
  AgentQueryResult,
  TileQueryResult,
  ZoneQueryResult,
  WorldEntityResult,
  QueryOptions,
  ResourceQueryOptions,
  AnimalQueryOptions,
  TileQueryOptions,
} from "./world/WorldQueryService";

export { SocialSystem } from "./social/SocialSystem";
export { MarriageSystem } from "./social/MarriageSystem";
export { HouseholdSystem } from "./social/HouseholdSystem";

export { GenealogySystem } from "./social/GenealogySystem";

export { EconomySystem } from "./economy/EconomySystem";
export { InventorySystem } from "./economy/InventorySystem";
export { EnhancedCraftingSystem } from "./economy/EnhancedCraftingSystem";
export { RecipeDiscoverySystem } from "./economy/RecipeDiscoverySystem";
export { ResourceReservationSystem } from "./economy/ResourceReservationSystem";

export { CombatSystem } from "./conflict/CombatSystem";
export { ConflictResolutionSystem } from "./conflict/ConflictResolutionSystem";

export { BuildingSystem } from "./structures/BuildingSystem";
export { GovernanceSystem } from "./structures/GovernanceSystem";

export { LifeCycleSystem } from "./lifecycle/LifeCycleSystem";

export { TaskSystem } from "./objectives/TaskSystem";

export { TimeSystem } from "./core/TimeSystem";
