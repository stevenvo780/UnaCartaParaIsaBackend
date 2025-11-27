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
import { WorldGenerationService } from "../infrastructure/services/world/worldGenerationService";
import { SimulationRunner } from "../domain/simulation/core/SimulationRunner";
import { GameState } from "../domain/types/game-types";
import { createInitialGameState } from "../domain/simulation/core/defaultState";

import { WorldResourceSystem } from "../domain/simulation/systems/WorldResourceSystem";
import { LivingLegendsSystem } from "../domain/simulation/systems/LivingLegendsSystem";
import { LifeCycleSystem } from "../domain/simulation/systems/LifeCycleSystem";
import { NeedsSystem } from "../domain/simulation/systems/NeedsSystem";
import { GenealogySystem } from "../domain/simulation/systems/GenealogySystem";
import { SocialSystem } from "../domain/simulation/systems/SocialSystem";
import { InventorySystem } from "../domain/simulation/systems/InventorySystem";
import { EconomySystem } from "../domain/simulation/systems/EconomySystem";
import { MarketSystem } from "../domain/simulation/systems/MarketSystem";
import { RoleSystem } from "../domain/simulation/systems/RoleSystem";
import { AISystem } from "../domain/simulation/systems/AISystem";
import { ResourceReservationSystem } from "../domain/simulation/systems/ResourceReservationSystem";
import { GovernanceSystem } from "../domain/simulation/systems/GovernanceSystem";
import { DivineFavorSystem } from "../domain/simulation/systems/DivineFavorSystem";
import { HouseholdSystem } from "../domain/simulation/systems/HouseholdSystem";
import { BuildingSystem } from "../domain/simulation/systems/BuildingSystem";
import { BuildingMaintenanceSystem } from "../domain/simulation/systems/BuildingMaintenanceSystem";
import { ProductionSystem } from "../domain/simulation/systems/ProductionSystem";
import { EnhancedCraftingSystem } from "../domain/simulation/systems/EnhancedCraftingSystem";
import { AnimalSystem } from "../domain/simulation/systems/AnimalSystem";
import { ItemGenerationSystem } from "../domain/simulation/systems/ItemGenerationSystem";
import { CombatSystem } from "../domain/simulation/systems/CombatSystem";
import { ReputationSystem } from "../domain/simulation/systems/ReputationSystem";
import { ResearchSystem } from "../domain/simulation/systems/ResearchSystem";
import { RecipeDiscoverySystem } from "../domain/simulation/systems/RecipeDiscoverySystem";
import { QuestSystem } from "../domain/simulation/systems/QuestSystem";
import { TaskSystem } from "../domain/simulation/systems/TaskSystem";
import { TradeSystem } from "../domain/simulation/systems/TradeSystem";
import { MarriageSystem } from "../domain/simulation/systems/MarriageSystem";
import { ConflictResolutionSystem } from "../domain/simulation/systems/ConflictResolutionSystem";
import { NormsSystem } from "../domain/simulation/systems/NormsSystem";
import { ResourceAttractionSystem } from "../domain/simulation/systems/ResourceAttractionSystem";
import { CrisisPredictorSystem } from "../domain/simulation/systems/CrisisPredictorSystem";
import { AmbientAwarenessSystem } from "../domain/simulation/systems/AmbientAwarenessSystem";
import { CardDialogueSystem } from "../domain/simulation/systems/CardDialogueSystem";
import { EmergenceSystem } from "../domain/simulation/systems/EmergenceSystem";
import { TimeSystem } from "../domain/simulation/systems/TimeSystem";
import { InteractionGameSystem } from "../domain/simulation/systems/InteractionGameSystem";
import { KnowledgeNetworkSystem } from "../domain/simulation/systems/KnowledgeNetworkSystem";
import { MovementSystem } from "../domain/simulation/systems/MovementSystem";
import { AppearanceGenerationSystem } from "../domain/simulation/systems/AppearanceGenerationSystem";
import { EntityIndex } from "../domain/simulation/core/EntityIndex";
import { SharedSpatialIndex } from "../domain/simulation/core/SharedSpatialIndex";
import { TerrainSystem } from "../domain/simulation/systems/TerrainSystem";
import { GPUComputeService } from "../domain/simulation/core/GPUComputeService";
import { GPUBatchQueryService } from "../domain/simulation/core/GPUBatchQueryService";
import { ChunkLoadingSystem } from "../domain/simulation/systems/ChunkLoadingSystem";
import { SharedKnowledgeSystem } from "../domain/simulation/systems/SharedKnowledgeSystem";
import { AgentRegistry } from "../domain/simulation/core/AgentRegistry";
import { AnimalRegistry } from "../domain/simulation/core/AnimalRegistry";

export const container = new Container();

const initialState = createInitialGameState();
container.bind<GameState>(TYPES.GameState).toConstantValue(initialState);
container.bind(TYPES.SimulationConfig).toConstantValue({});

container
  .bind<SimulationRunner>(TYPES.SimulationRunner)
  .to(SimulationRunner)
  .inSingletonScope();

container
  .bind<WorldResourceSystem>(TYPES.WorldResourceSystem)
  .to(WorldResourceSystem)
  .inSingletonScope();
container
  .bind<LivingLegendsSystem>(TYPES.LivingLegendsSystem)
  .to(LivingLegendsSystem)
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
  .bind<MarketSystem>(TYPES.MarketSystem)
  .to(MarketSystem)
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
  .bind<DivineFavorSystem>(TYPES.DivineFavorSystem)
  .to(DivineFavorSystem)
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
  .bind<BuildingMaintenanceSystem>(TYPES.BuildingMaintenanceSystem)
  .to(BuildingMaintenanceSystem)
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
  .bind<ReputationSystem>(TYPES.ReputationSystem)
  .to(ReputationSystem)
  .inSingletonScope();
container
  .bind<ResearchSystem>(TYPES.ResearchSystem)
  .to(ResearchSystem)
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
container
  .bind<TradeSystem>(TYPES.TradeSystem)
  .to(TradeSystem)
  .inSingletonScope();
container
  .bind<MarriageSystem>(TYPES.MarriageSystem)
  .to(MarriageSystem)
  .inSingletonScope();
container
  .bind<ConflictResolutionSystem>(TYPES.ConflictResolutionSystem)
  .to(ConflictResolutionSystem)
  .inSingletonScope();
container
  .bind<NormsSystem>(TYPES.NormsSystem)
  .to(NormsSystem)
  .inSingletonScope();
container
  .bind<ResourceAttractionSystem>(TYPES.ResourceAttractionSystem)
  .to(ResourceAttractionSystem)
  .inSingletonScope();
container
  .bind<CrisisPredictorSystem>(TYPES.CrisisPredictorSystem)
  .to(CrisisPredictorSystem)
  .inSingletonScope();
container
  .bind<AmbientAwarenessSystem>(TYPES.AmbientAwarenessSystem)
  .to(AmbientAwarenessSystem)
  .inSingletonScope();
container
  .bind<CardDialogueSystem>(TYPES.CardDialogueSystem)
  .to(CardDialogueSystem)
  .inSingletonScope();
container
  .bind<EmergenceSystem>(TYPES.EmergenceSystem)
  .to(EmergenceSystem)
  .inSingletonScope();
container.bind<TimeSystem>(TYPES.TimeSystem).to(TimeSystem).inSingletonScope();
container
  .bind<InteractionGameSystem>(TYPES.InteractionGameSystem)
  .to(InteractionGameSystem)
  .inSingletonScope();
container
  .bind<KnowledgeNetworkSystem>(TYPES.KnowledgeNetworkSystem)
  .to(KnowledgeNetworkSystem)
  .inSingletonScope();
container
  .bind<MovementSystem>(TYPES.MovementSystem)
  .to(MovementSystem)
  .inSingletonScope();
container
  .bind<AppearanceGenerationSystem>(TYPES.AppearanceGenerationSystem)
  .to(AppearanceGenerationSystem)
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

// ECS Registries - Single Source of Truth
container
  .bind<AgentRegistry>(TYPES.AgentRegistry)
  .to(AgentRegistry)
  .inSingletonScope();

container
  .bind<AnimalRegistry>(TYPES.AnimalRegistry)
  .to(AnimalRegistry)
  .inSingletonScope();
