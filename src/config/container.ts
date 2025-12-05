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
import { VoronoiGenerator } from "../domain/simulation/systems/world/generation/VoronoiGenerator";
import { WorldGenerationService } from "../domain/simulation/systems/world/generation/worldGenerationService";
import { SimulationRunner } from "../domain/simulation/core/SimulationRunner";
import { GameState } from "../shared/types/game-types";
import { createInitialGameState } from "../domain/simulation/core/defaultState";

import {
  WorldResourceSystem,
  LifeCycleSystem,
  NeedsSystem,
  GenealogySystem,
  SocialSystem,
  InventorySystem,
  EconomySystem,
  RoleSystem,
  AISystem,
  ResourceReservationSystem,
  GovernanceSystem,
  HouseholdSystem,
  BuildingSystem,
  ProductionSystem,
  EnhancedCraftingSystem,
  AnimalSystem,
  ItemGenerationSystem,
  CombatSystem,
  RecipeDiscoverySystem,
  TaskSystem,
  MarriageSystem,
  ConflictResolutionSystem,
  AmbientAwarenessSystem,
  TimeSystem,
  MovementSystem,
  TerrainSystem,
  ChunkLoadingSystem,
  WorldQueryService,
} from "../domain/simulation/systems";
import { SharedKnowledgeSystem } from "../domain/simulation/systems/agents/ai/SharedKnowledgeSystem";

import { EntityIndex } from "../domain/simulation/core/EntityIndex";
import { SharedSpatialIndex } from "../domain/simulation/core/SharedSpatialIndex";
import { GPUComputeService } from "../domain/simulation/core/GPUComputeService";
import { GPUBatchQueryService } from "../domain/simulation/core/GPUBatchQueryService";
import { AgentRegistry } from "../domain/simulation/systems/agents/AgentRegistry";
import { AnimalRegistry } from "../domain/simulation/systems/world/animals/AnimalRegistry";
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
  .bind<RecipeDiscoverySystem>(TYPES.RecipeDiscoverySystem)
  .to(RecipeDiscoverySystem)
  .inSingletonScope();

container.bind<TaskSystem>(TYPES.TaskSystem).to(TaskSystem).inSingletonScope();

container
  .bind<MarriageSystem>(TYPES.MarriageSystem)
  .to(MarriageSystem)
  .inSingletonScope();
container
  .bind<ConflictResolutionSystem>(TYPES.ConflictResolutionSystem)
  .to(ConflictResolutionSystem)
  .inSingletonScope();

container
  .bind<AmbientAwarenessSystem>(TYPES.AmbientAwarenessSystem)
  .to(AmbientAwarenessSystem)
  .inSingletonScope();

container.bind<TimeSystem>(TYPES.TimeSystem).to(TimeSystem).inSingletonScope();

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
    return new SharedSpatialIndex(0, 0, 70);
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

container
  .bind<WorldQueryService>(TYPES.WorldQueryService)
  .to(WorldQueryService)
  .inSingletonScope();
