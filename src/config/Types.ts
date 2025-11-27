/**
 * Dependency injection type symbols.
 *
 * Used by Inversify container to identify and resolve dependencies.
 * Each symbol represents a unique service or system type.
 *
 * @module config
 */
export const TYPES = {
  SimulationRunner: Symbol.for("SimulationRunner"),
  GameState: Symbol.for("GameState"),
  Logger: Symbol.for("Logger"),

  WorldResourceSystem: Symbol.for("WorldResourceSystem"),
  LivingLegendsSystem: Symbol.for("LivingLegendsSystem"),
  LifeCycleSystem: Symbol.for("LifeCycleSystem"),
  NeedsSystem: Symbol.for("NeedsSystem"),
  GenealogySystem: Symbol.for("GenealogySystem"),
  SocialSystem: Symbol.for("SocialSystem"),
  InventorySystem: Symbol.for("InventorySystem"),
  EconomySystem: Symbol.for("EconomySystem"),
  MarketSystem: Symbol.for("MarketSystem"),
  RoleSystem: Symbol.for("RoleSystem"),
  AISystem: Symbol.for("AISystem"),
  ResourceReservationSystem: Symbol.for("ResourceReservationSystem"),
  GovernanceSystem: Symbol.for("GovernanceSystem"),

  HouseholdSystem: Symbol.for("HouseholdSystem"),
  BuildingSystem: Symbol.for("BuildingSystem"),
  BuildingMaintenanceSystem: Symbol.for("BuildingMaintenanceSystem"),
  ProductionSystem: Symbol.for("ProductionSystem"),
  EnhancedCraftingSystem: Symbol.for("EnhancedCraftingSystem"),
  AnimalSystem: Symbol.for("AnimalSystem"),
  ItemGenerationSystem: Symbol.for("ItemGenerationSystem"),
  CombatSystem: Symbol.for("CombatSystem"),
  ReputationSystem: Symbol.for("ReputationSystem"),

  RecipeDiscoverySystem: Symbol.for("RecipeDiscoverySystem"),
  QuestSystem: Symbol.for("QuestSystem"),
  TaskSystem: Symbol.for("TaskSystem"),
  TradeSystem: Symbol.for("TradeSystem"),
  MarriageSystem: Symbol.for("MarriageSystem"),
  ConflictResolutionSystem: Symbol.for("ConflictResolutionSystem"),
  NormsSystem: Symbol.for("NormsSystem"),
  ResourceAttractionSystem: Symbol.for("ResourceAttractionSystem"),

  AmbientAwarenessSystem: Symbol.for("AmbientAwarenessSystem"),

  TimeSystem: Symbol.for("TimeSystem"),
  InteractionGameSystem: Symbol.for("InteractionGameSystem"),
  KnowledgeNetworkSystem: Symbol.for("KnowledgeNetworkSystem"),
  MovementSystem: Symbol.for("MovementSystem"),

  SimulationConfig: Symbol.for("SimulationConfig"),
  VoronoiGenerator: Symbol.for("VoronoiGenerator"),
  WorldGenerationService: Symbol.for("WorldGenerationService"),
  EntityIndex: Symbol.for("EntityIndex"),
  SharedSpatialIndex: Symbol.for("SharedSpatialIndex"),
  GPUComputeService: Symbol.for("GPUComputeService"),
  GPUBatchQueryService: Symbol.for("GPUBatchQueryService"),
  TerrainSystem: Symbol.for("TerrainSystem"),
  ChunkLoadingSystem: Symbol.for("ChunkLoadingSystem"),
  SharedKnowledgeSystem: Symbol.for("SharedKnowledgeSystem"),

  AgentRegistry: Symbol.for("AgentRegistry"),
  AnimalRegistry: Symbol.for("AnimalRegistry"),
};
