/**
 * Systems Index
 * ==============
 *
 * Central re-export for all simulation systems.
 * Systems are logically grouped by domain for easy discovery.
 *
 * TOTAL SYSTEMS: 27 main systems organized in 9 logical domains
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ DOMAIN           │ SYSTEMS                                             │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ AGENTS (5)       │ AI, Needs, Movement, Role, Equipment                │
 * │ WORLD (5)        │ WorldResource, ItemGeneration, Production,          │
 * │                  │ AmbientAwareness, Animal                            │
 * │ SOCIAL (5)       │ Social, Marriage, Household, Reputation, Genealogy  │
 * │ ECONOMY (5)      │ Economy, Inventory, EnhancedCrafting,               │
 * │                  │ RecipeDiscovery, ResourceReservation                │
 * │ CONFLICT (2)     │ Combat, ConflictResolution                          │
 * │ STRUCTURES (2)   │ Building, Governance                                │
 * │ LIFECYCLE (1)    │ LifeCycle                                           │
 * │ OBJECTIVES (1)   │ Task                                                │
 * │ CORE (3)         │ Time, ChunkLoading, Terrain (infrastructure)        │
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

// =============================================================================
// AGENTS - Agent behavior, AI, needs, movement, roles
// =============================================================================
export { AISystem } from "./AISystem";
export { NeedsSystem } from "./needs/NeedsSystem";
export { NeedsBatchProcessor } from "./needs/NeedsBatchProcessor";
export { MovementSystem } from "./movement/MovementSystem";
export { MovementBatchProcessor } from "./movement/MovementBatchProcessor";
export { RoleSystem } from "./RoleSystem";
export {
  EquipmentSystem,
  equipmentSystem,
  toolStorage,
  TOOL_CATEGORIES,
  ROLE_TOOL_NEEDS,
} from "./EquipmentSystem";

// AI subsystems
export * from "./ai/core/SimplifiedGoalPlanner";
export * from "./ai/core/GoalRules";
export * from "./ai/core/ActionPlanRules";
export * from "./ai/core/SimpleActionPlanner";
export * from "./ai/core/AIActionExecutor";
export * from "./ai/core/AIGoalValidator";
export * from "./ai/core/AIStateManager";
export * from "./ai/core/AIUrgentGoals";
export * from "./ai/core/AIZoneHandler";
export * from "./ai/core/PriorityManager";
export * from "./ai/core/WorkGoalGenerator";
export * from "./ai/evaluators/NeedsEvaluator";
export * from "./ai/evaluators/CollectiveNeedsEvaluator";

// =============================================================================
// WORLD - World resources, generation, animals
// =============================================================================
export { WorldResourceSystem } from "./WorldResourceSystem";
export { ItemGenerationSystem } from "./ItemGenerationSystem";
export { ProductionSystem } from "./ProductionSystem";
export { AmbientAwarenessSystem } from "./AmbientAwarenessSystem";
export { AnimalSystem } from "./animals/AnimalSystem";
export { AnimalBatchProcessor } from "./animals/AnimalBatchProcessor";
export * from "./animals/AnimalBehavior";

// =============================================================================
// SOCIAL - Social interactions, family, reputation
// =============================================================================
export { SocialSystem } from "./SocialSystem";
export { MarriageSystem } from "./MarriageSystem";
export { HouseholdSystem } from "./HouseholdSystem";
export { ReputationSystem } from "./ReputationSystem";
export { GenealogySystem } from "./GenealogySystem";

// =============================================================================
// ECONOMY - Economy, inventory, crafting
// =============================================================================
export { EconomySystem } from "./EconomySystem";
export { InventorySystem } from "./InventorySystem";
export { EnhancedCraftingSystem } from "./EnhancedCraftingSystem";
export { RecipeDiscoverySystem } from "./RecipeDiscoverySystem";
export { ResourceReservationSystem } from "./ResourceReservationSystem";

// =============================================================================
// CONFLICT - Combat and conflict resolution
// =============================================================================
export { CombatSystem } from "./CombatSystem";
export { ConflictResolutionSystem } from "./ConflictResolutionSystem";

// =============================================================================
// STRUCTURES - Buildings and governance
// =============================================================================
export { BuildingSystem } from "./BuildingSystem";
export { GovernanceSystem } from "./GovernanceSystem";

// =============================================================================
// LIFECYCLE - Entity lifecycle management
// =============================================================================
export { LifeCycleSystem } from "./LifeCycleSystem";

// =============================================================================
// OBJECTIVES - Tasks and objectives
// =============================================================================
export { TaskSystem } from "./TaskSystem";

// =============================================================================
// CORE - Infrastructure systems (time, chunks, terrain)
// =============================================================================
export { TimeSystem } from "./TimeSystem";
export { ChunkLoadingSystem } from "./ChunkLoadingSystem";
export { TerrainSystem } from "./TerrainSystem";
