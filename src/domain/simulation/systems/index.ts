/**
 * Systems Index
 * ==============
 * 
 * Central re-export for all simulation systems.
 * Systems are logically grouped by domain for easy discovery.
 * 
 * TOTAL SYSTEMS: 28 main systems organized in 8 domains
 * 
 * DOMAIN ORGANIZATION:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ AGENT (4)        │ AI, Needs, Movement, Role                           │
 * │ WORLD (4)        │ WorldResource, Terrain, ChunkLoading, Time          │
 * │ SOCIAL (5)       │ Social, Marriage, Household, Reputation, Genealogy  │
 * │ ECONOMY (7)      │ Economy, Inventory, EnhancedCrafting, Production,   │
 * │                  │ ResourceReservation, RecipeDiscovery, Equipment     │
 * │ COMBAT (2)       │ Combat, ConflictResolution                          │
 * │ LIFE (2)         │ LifeCycle, Animal                                   │
 * │ BUILDING (1)     │ Building (+ maintenance)                            │
 * │ GOVERNANCE (3)   │ Governance, Quest, Task                             │
 * │ MISC (2)         │ AmbientAwareness, ItemGeneration                    │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * MERGED/ELIMINATED:
 * - InteractionGameSystem → eliminated (minimal functionality)
 * - LivingLegendsSystem → eliminated (decorative only)
 * - BuildingMaintenanceSystem → merged into BuildingSystem
 * - SharedKnowledgeSystem → moved to ai/ (internal infrastructure)
 * 
 * SUBDIRECTORIES:
 * - ai/        → AI subsystems (planners, validators, evaluators, SharedKnowledge)
 * - animals/   → AnimalSystem + helpers (behavior, genetics, needs, spawning)
 * - movement/  → MovementSystem + batch processor + helpers
 * - needs/     → NeedsSystem + batch processor
 * 
 * MERGED/ELIMINATED SYSTEMS:
 * - TradeSystem → EconomySystem
 * - MarketSystem → EconomySystem
 * - NormsSystem → ConflictResolutionSystem
 * - ResourceAttractionSystem → AmbientAwarenessSystem
 * - ToolStorageSystem → EquipmentSystem
 * - KnowledgeNetworkSystem → eliminated (unused)
 */

// ============================================================================
// AGENT SYSTEMS - AI, decision-making, needs, movement
// ============================================================================
export { AISystem } from "./AISystem";
export { NeedsSystem } from "./needs/NeedsSystem";
export { NeedsBatchProcessor } from "./needs/NeedsBatchProcessor";
export { MovementSystem } from "./movement/MovementSystem";
export { MovementBatchProcessor } from "./movement/MovementBatchProcessor";
export { RoleSystem } from "./RoleSystem";

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

// ============================================================================
// WORLD SYSTEMS - Resources, terrain, environment
// ============================================================================
export { WorldResourceSystem } from "./WorldResourceSystem";
export { TerrainSystem } from "./TerrainSystem";
export { ChunkLoadingSystem } from "./ChunkLoadingSystem";
export { TimeSystem } from "./TimeSystem";
// ResourceAttractionSystem merged into AmbientAwarenessSystem

// ============================================================================
// SOCIAL SYSTEMS - Relationships, families, knowledge
// ============================================================================
export { SocialSystem } from "./SocialSystem";
export { MarriageSystem } from "./MarriageSystem";
export { HouseholdSystem } from "./HouseholdSystem";
export { ReputationSystem } from "./ReputationSystem";
export { GenealogySystem } from "./GenealogySystem";
// SharedKnowledgeSystem moved to ai/ as internal infrastructure

// ============================================================================
// ECONOMY SYSTEMS - Trade, market, crafting
// ============================================================================
// TradeSystem merged into EconomySystem
// MarketSystem merged into EconomySystem
export { EconomySystem } from "./EconomySystem";
export { InventorySystem } from "./InventorySystem";
export { EnhancedCraftingSystem } from "./EnhancedCraftingSystem";
export { ProductionSystem } from "./ProductionSystem";
export { ResourceReservationSystem } from "./ResourceReservationSystem";
export { RecipeDiscoverySystem } from "./RecipeDiscoverySystem";
export { EquipmentSystem, equipmentSystem, toolStorage, TOOL_CATEGORIES, ROLE_TOOL_NEEDS } from "./EquipmentSystem";
// ToolStorageSystem merged into EquipmentSystem

// ============================================================================
// COMBAT SYSTEMS - Fighting, conflict
// ============================================================================
export { CombatSystem } from "./CombatSystem";
export { ConflictResolutionSystem } from "./ConflictResolutionSystem";

// ============================================================================
// LIFE SYSTEMS - Lifecycle, animals
// ============================================================================
export { LifeCycleSystem } from "./LifeCycleSystem";
export { AnimalSystem } from "./animals/AnimalSystem";
export { AnimalBatchProcessor } from "./animals/AnimalBatchProcessor";
export * from "./animals/AnimalBehavior";

// ============================================================================
// BUILDING SYSTEMS - Construction, maintenance
// ============================================================================
export { BuildingSystem } from "./BuildingSystem";
// BuildingMaintenanceSystem merged into BuildingSystem

// ============================================================================
// GOVERNANCE SYSTEMS - Quests, tasks, norms
// ============================================================================
export { GovernanceSystem } from "./GovernanceSystem";
// NormsSystem merged into ConflictResolutionSystem
export { QuestSystem } from "./QuestSystem";
export { TaskSystem } from "./TaskSystem";

// ============================================================================
// MISCELLANEOUS SYSTEMS
// ============================================================================
export { AmbientAwarenessSystem } from "./AmbientAwarenessSystem";
// InteractionGameSystem eliminated - minimal functionality
export { ItemGenerationSystem } from "./ItemGenerationSystem";
// KnowledgeNetworkSystem eliminated - not used externally
// LivingLegendsSystem eliminated - decorative only
