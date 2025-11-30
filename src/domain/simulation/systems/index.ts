/**
 * Systems Index
 * ==============
 * 
 * Central re-export for all simulation systems.
 * Systems are logically grouped by domain for easy discovery.
 * 
 * DOMAIN ORGANIZATION:
 * - Agent: AI decision-making, needs, movement, roles
 * - World: Resources, terrain, chunks, time, weather
 * - Social: Relationships, families, reputation, knowledge sharing
 * - Economy: Trade, market, inventory, crafting, production
 * - Combat: Fighting, conflict resolution
 * - Life: Lifecycle, animals, genetics
 * - Building: Construction, maintenance
 * - Governance: Quests, tasks, norms, governance
 * - Misc: Ambient awareness, interaction games, legends
 */

// ============================================================================
// AGENT SYSTEMS - AI, decision-making, needs, movement
// ============================================================================
export { AISystem } from "./AISystem";
export { NeedsSystem } from "./NeedsSystem";
export { NeedsBatchProcessor } from "./NeedsBatchProcessor";
export { MovementSystem } from "./MovementSystem";
export { MovementBatchProcessor } from "./MovementBatchProcessor";
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
export { SharedKnowledgeSystem } from "./SharedKnowledgeSystem";

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
export { AnimalSystem } from "./AnimalSystem";
export { AnimalBatchProcessor } from "./AnimalBatchProcessor";
export * from "./animals/AnimalBehavior";

// ============================================================================
// BUILDING SYSTEMS - Construction, maintenance
// ============================================================================
export { BuildingSystem } from "./BuildingSystem";
export { BuildingMaintenanceSystem } from "./BuildingMaintenanceSystem";

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
export { InteractionGameSystem } from "./InteractionGameSystem";
export { ItemGenerationSystem } from "./ItemGenerationSystem";
// KnowledgeNetworkSystem eliminated - not used externally
export { LivingLegendsSystem } from "./LivingLegendsSystem";
