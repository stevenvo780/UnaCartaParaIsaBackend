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
// AISystem ahora viene de ./agents/ai (arquitectura v3)
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

// Agent registry (ECS pattern for unified agent state access)
export { AgentRegistry } from "./agents/AgentRegistry";
export type { MovementState } from "./agents/AgentRegistry";

// AI subsystems - Nueva arquitectura v3 (incluye AISystem)
export * from "./agents/ai";

// =============================================================================
// WORLD - World resources, generation, animals
// =============================================================================
export { WorldResourceSystem } from "./world/WorldResourceSystem";
export { ItemGenerationSystem } from "./world/ItemGenerationSystem";
export { ProductionSystem } from "./world/ProductionSystem";
export { AnimalSystem } from "./world/animals/AnimalSystem";
export { AnimalBatchProcessor } from "./world/animals/AnimalBatchProcessor";
export { AnimalRegistry } from "./world/animals/AnimalRegistry";
export * from "./world/animals/AnimalBehavior";

// =============================================================================
// SOCIAL - Social interactions, family, reputation
// =============================================================================
export { SocialSystem } from "./social/SocialSystem";
export { MarriageSystem } from "./social/MarriageSystem";
export { HouseholdSystem } from "./social/HouseholdSystem";
export { ReputationSystem } from "./social/ReputationSystem";
export { GenealogySystem } from "./social/GenealogySystem";

// =============================================================================
// ECONOMY - Economy, inventory, crafting
// =============================================================================
export { EconomySystem } from "./economy/EconomySystem";
export { InventorySystem } from "./economy/InventorySystem";
export { EnhancedCraftingSystem } from "./economy/EnhancedCraftingSystem";
export { RecipeDiscoverySystem } from "./economy/RecipeDiscoverySystem";
export { ResourceReservationSystem } from "./economy/ResourceReservationSystem";

// =============================================================================
// CONFLICT - Combat and conflict resolution
// =============================================================================
export { CombatSystem } from "./conflict/CombatSystem";
export { ConflictResolutionSystem } from "./conflict/ConflictResolutionSystem";

// =============================================================================
// STRUCTURES - Buildings and governance
// =============================================================================
export { BuildingSystem } from "./structures/BuildingSystem";
export { GovernanceSystem } from "./structures/GovernanceSystem";

// =============================================================================
// LIFECYCLE - Entity lifecycle management
// =============================================================================
export { LifeCycleSystem } from "./lifecycle/LifeCycleSystem";

// =============================================================================
// OBJECTIVES - Tasks and objectives
// =============================================================================
export { TaskSystem } from "./objectives/TaskSystem";

// =============================================================================
// CORE - Infrastructure systems (time, chunks, terrain)
// =============================================================================
export { TimeSystem } from "./core/TimeSystem";
export { ChunkLoadingSystem } from "./core/ChunkLoadingSystem";
export { TerrainSystem } from "./core/TerrainSystem";
