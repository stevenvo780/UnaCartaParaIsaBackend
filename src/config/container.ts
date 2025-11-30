import "reflect-metadata";
import { Container } from "inversify";
import { TYPES } from "./Types";

/**
 * Dependency injection container configuration.
 *
 * Sets up Inversify container with all simulation systems, services, and core components.
 * All systems are registered as singletons to maintain state consistency.
 *
 * Systems registered:
 * - Core: SimulationRunner, EntityIndex, SharedSpatialIndex, GPUComputeService
 * - Simulation: 30+ systems (AI, Needs, Movement, Economy, etc.)
 * - Infrastructure: WorldGenerationService, VoronoiGenerator
 *
 * @module config
 */
import { VoronoiGenerator } from "../domain/world/generation/VoronoiGenerator";
import { WorldGenerationService } from "../domain/world/worldGenerationService";
import { SimulationRunner } from "../domain/simulation/core/SimulationRunner";
import { GameState } from "../domain/types/game-types";
import { createInitialGameState } from "../domain/simulation/core/defaultState";

import { WorldResourceSystem } from "../domain/simulation/systems/WorldResourceSystem";
// LivingLegendsSystem eliminated - decorative only
import { LifeCycleSystem } from "../domain/simulation/systems/LifeCycleSystem";
import { NeedsSystem } from "../domain/simulation/systems/needs/NeedsSystem";
import { GenealogySystem } from "../domain/simulation/systems/GenealogySystem";
import { SocialSystem } from "../domain/simulation/systems/SocialSystem";
import { InventorySystem } from "../domain/simulation/systems/InventorySystem";
import { EconomySystem } from "../domain/simulation/systems/EconomySystem";
import { RoleSystem } from "../domain/simulation/systems/RoleSystem";
import { AISystem } from "../domain/simulation/systems/AISystem";
import { ResourceReservationSystem } from "../domain/simulation/systems/ResourceReservationSystem";
import { GovernanceSystem } from "../domain/simulation/systems/GovernanceSystem";

import { HouseholdSystem } from "../domain/simulation/systems/HouseholdSystem";
import { BuildingSystem } from "../domain/simulation/systems/BuildingSystem";
// BuildingMaintenanceSystem merged into BuildingSystem
import { ProductionSystem } from "../domain/simulation/systems/ProductionSystem";
import { EnhancedCraftingSystem } from "../domain/simulation/systems/EnhancedCraftingSystem";
import { AnimalSystem } from "../domain/simulation/systems/animals/AnimalSystem";
import { ItemGenerationSystem } from "../domain/simulation/systems/ItemGenerationSystem";
import { CombatSystem } from "../domain/simulation/systems/CombatSystem";
import { ReputationSystem } from "../domain/simulation/systems/ReputationSystem";

import { RecipeDiscoverySystem } from "../domain/simulation/systems/RecipeDiscoverySystem";
import { QuestSystem } from "../domain/simulation/systems/QuestSystem";
import { TaskSystem } from "../domain/simulation/systems/TaskSystem";
// TradeSystem merged into EconomySystem
import { MarriageSystem } from "../domain/simulation/systems/MarriageSystem";
import { ConflictResolutionSystem } from "../domain/simulation/systems/ConflictResolutionSystem";
// TradeSystem merged into EconomySystem
// NormsSystem merged into ConflictResolutionSystem
// ResourceAttractionSystem merged into AmbientAwarenessSystem

import { AmbientAwarenessSystem } from "../domain/simulation/systems/AmbientAwarenessSystem";

import { TimeSystem } from "../domain/simulation/systems/TimeSystem";
// InteractionGameSystem eliminated - minimal functionality
// KnowledgeNetworkSystem eliminated - not used externally
import { MovementSystem } from "../domain/simulation/systems/movement/MovementSystem";

import { EntityIndex } from "../domain/simulation/core/EntityIndex";
import { SharedSpatialIndex } from "../domain/simulation/core/SharedSpatialIndex";
import { TerrainSystem } from "../domain/simulation/systems/TerrainSystem";
import { GPUComputeService } from "../domain/simulation/core/GPUComputeService";
import { GPUBatchQueryService } from "../domain/simulation/core/GPUBatchQueryService";
import { ChunkLoadingSystem } from "../domain/simulation/systems/ChunkLoadingSystem";
import { SharedKnowledgeSystem } from "../domain/simulation/systems/SharedKnowledgeSystem";
import { AgentRegistry } from "../domain/simulation/core/AgentRegistry";
import { AnimalRegistry } from "../domain/simulation/core/AnimalRegistry";
import { StateDirtyTracker } from "../domain/simulation/core/StateDirtyTracker";

export const container = new Container();

const initialState = createInitialGameState();
container.bind<GameState>(TYPES.GameState).toConstantValue(initialState);
container.bind(TYPES.SimulationConfig).toConstantValue({});

container
  .bind<StateDirtyTracker>(TYPES.StateDirtyTracker)
  .to(StateDirtyTracker)
  .inSingletonScope();

container
  .bind<SimulationRunner>(TYPES.SimulationRunner)
  .to(SimulationRunner)
  .inSingletonScope();

container
  .bind<WorldResourceSystem>(TYPES.WorldResourceSystem)
  .to(WorldResourceSystem)
  .inSingletonScope();
// LivingLegendsSystem binding removed - decorative only
container
  .bind<LifeCycleSystem>(TYPES.LifeCycleSystem)
  .to(LifeCycleSystem)
  .inSingletonScope();
container
  .bind<NeedsSystem>(TYPES.NeedsSystem)
  .to(NeedsSystem)
  .inSingletonScope();
container
  .bind<GenealogySystem>(TYPES.GenealogySystem)
  .to(GenealogySystem)
  .inSingletonScope();
container
  .bind<SocialSystem>(TYPES.SocialSystem)
  .to(SocialSystem)
  .inSingletonScope();
container
  .bind<InventorySystem>(TYPES.InventorySystem)
  .to(InventorySystem)
  .inSingletonScope();
container
  .bind<EconomySystem>(TYPES.EconomySystem)
  .to(EconomySystem)
  .inSingletonScope();
// MarketSystem merged into EconomySystem
container
  .bind<VoronoiGenerator>(TYPES.VoronoiGenerator)
  .to(VoronoiGenerator)
  .inSingletonScope();
container
  .bind<WorldGenerationService>(TYPES.WorldGenerationService)
  .to(WorldGenerationService)
  .inSingletonScope();
container.bind<RoleSystem>(TYPES.RoleSystem).to(RoleSystem).inSingletonScope();
container.bind<AISystem>(TYPES.AISystem).to(AISystem).inSingletonScope();
container
  .bind<ResourceReservationSystem>(TYPES.ResourceReservationSystem)
  .to(ResourceReservationSystem)
  .inSingletonScope();
container
  .bind<GovernanceSystem>(TYPES.GovernanceSystem)
  .to(GovernanceSystem)
  .inSingletonScope();

container
  .bind<HouseholdSystem>(TYPES.HouseholdSystem)
  .to(HouseholdSystem)
  .inSingletonScope();
container
  .bind<BuildingSystem>(TYPES.BuildingSystem)
  .to(BuildingSystem)
  .inSingletonScope();
// BuildingMaintenanceSystem binding removed - merged into BuildingSystem
container
  .bind<ProductionSystem>(TYPES.ProductionSystem)
  .to(ProductionSystem)
  .inSingletonScope();
container
  .bind<EnhancedCraftingSystem>(TYPES.EnhancedCraftingSystem)
  .to(EnhancedCraftingSystem)
  .inSingletonScope();
container
  .bind<AnimalSystem>(TYPES.AnimalSystem)
  .to(AnimalSystem)
  .inSingletonScope();
container
  .bind<ItemGenerationSystem>(TYPES.ItemGenerationSystem)
  .to(ItemGenerationSystem)
  .inSingletonScope();
container
  .bind<CombatSystem>(TYPES.CombatSystem)
  .to(CombatSystem)
  .inSingletonScope();
container
  .bind<ReputationSystem>(TYPES.ReputationSystem)
  .to(ReputationSystem)
  .inSingletonScope();

container
  .bind<RecipeDiscoverySystem>(TYPES.RecipeDiscoverySystem)
  .to(RecipeDiscoverySystem)
  .inSingletonScope();
container
  .bind<QuestSystem>(TYPES.QuestSystem)
  .to(QuestSystem)
  .inSingletonScope();
container.bind<TaskSystem>(TYPES.TaskSystem).to(TaskSystem).inSingletonScope();
// TradeSystem merged into EconomySystem
container
  .bind<MarriageSystem>(TYPES.MarriageSystem)
  .to(MarriageSystem)
  .inSingletonScope();
container
  .bind<ConflictResolutionSystem>(TYPES.ConflictResolutionSystem)
  .to(ConflictResolutionSystem)
  .inSingletonScope();
// NormsSystem merged into ConflictResolutionSystem
// ResourceAttractionSystem merged into AmbientAwarenessSystem

container
  .bind<AmbientAwarenessSystem>(TYPES.AmbientAwarenessSystem)
  .to(AmbientAwarenessSystem)
  .inSingletonScope();

container.bind<TimeSystem>(TYPES.TimeSystem).to(TimeSystem).inSingletonScope();
// InteractionGameSystem binding removed - minimal functionality
// KnowledgeNetworkSystem binding removed - not used externally
container
  .bind<MovementSystem>(TYPES.MovementSystem)
  .to(MovementSystem)
  .inSingletonScope();

container
  .bind<GPUComputeService>(TYPES.GPUComputeService)
  .to(GPUComputeService)
  .inSingletonScope();

container
  .bind<GPUBatchQueryService>(TYPES.GPUBatchQueryService)
  .to(GPUBatchQueryService)
  .inSingletonScope();

container
  .bind<TerrainSystem>(TYPES.TerrainSystem)
  .to(TerrainSystem)
  .inSingletonScope();

container
  .bind<ChunkLoadingSystem>(TYPES.ChunkLoadingSystem)
  .to(ChunkLoadingSystem)
  .inSingletonScope();

container
  .bind<SharedKnowledgeSystem>(TYPES.SharedKnowledgeSystem)
  .to(SharedKnowledgeSystem)
  .inSingletonScope();

container
  .bind<EntityIndex>(TYPES.EntityIndex)
  .to(EntityIndex)
  .inSingletonScope();

container
  .bind<SharedSpatialIndex>(TYPES.SharedSpatialIndex)
  .toDynamicValue(() => {
    const gameState = container.get<GameState>(TYPES.GameState);
    const worldWidth = gameState.worldSize?.width ?? 2000;
    const worldHeight = gameState.worldSize?.height ?? 2000;
    return new SharedSpatialIndex(worldWidth, worldHeight, 70);
  })
  .inSingletonScope();

container
  .bind<AgentRegistry>(TYPES.AgentRegistry)
  .to(AgentRegistry)
  .inSingletonScope();

container
  .bind<AnimalRegistry>(TYPES.AnimalRegistry)
  .to(AnimalRegistry)
  .inSingletonScope();
