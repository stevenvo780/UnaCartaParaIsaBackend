import { EventEmitter } from "node:events";
import type { GameState } from "../../types/game-types";
import type { ILifeCyclePort } from "../ports";
import { cloneGameState } from "./defaultState";
import { EntityIndex } from "./EntityIndex";
import { SharedSpatialIndex } from "./SharedSpatialIndex";
import { AgentRegistry } from "./AgentRegistry";
import { WorldGenerationService } from "../../../infrastructure/services/world/worldGenerationService";
import { logger } from "../../../infrastructure/utils/logger";
import { WorldResourceSystem } from "../systems/WorldResourceSystem";
import { LivingLegendsSystem } from "../systems/LivingLegendsSystem";
import { LifeCycleSystem } from "../systems/LifeCycleSystem";
import { NeedsSystem } from "../systems/NeedsSystem";
import { GenealogySystem } from "../systems/GenealogySystem";
import { SocialSystem } from "../systems/SocialSystem";
import { InventorySystem } from "../systems/InventorySystem";
import { EconomySystem } from "../systems/EconomySystem";
import { MarketSystem } from "../systems/MarketSystem";
import { RoleSystem } from "../systems/RoleSystem";
import { AISystem } from "../systems/AISystem";
import { ResourceReservationSystem } from "../systems/ResourceReservationSystem";
import { GovernanceSystem } from "../systems/GovernanceSystem";

import { HouseholdSystem } from "../systems/HouseholdSystem";
import { BuildingSystem } from "../systems/BuildingSystem";
import { BuildingMaintenanceSystem } from "../systems/BuildingMaintenanceSystem";
import { ProductionSystem } from "../systems/ProductionSystem";
import { EnhancedCraftingSystem } from "../systems/EnhancedCraftingSystem";
import { AnimalSystem } from "../systems/AnimalSystem";
import { ItemGenerationSystem } from "../systems/ItemGenerationSystem";
import { ReputationSystem } from "../systems/ReputationSystem";

import { RecipeDiscoverySystem } from "../systems/RecipeDiscoverySystem";
import { QuestSystem } from "../systems/QuestSystem";
import { TaskSystem } from "../systems/TaskSystem";
import { TradeSystem } from "../systems/TradeSystem";
import { MarriageSystem } from "../systems/MarriageSystem";
import { ConflictResolutionSystem } from "../systems/ConflictResolutionSystem";
import { NormsSystem } from "../systems/NormsSystem";
import { simulationEvents } from "./events";
import { BatchedEventEmitter } from "./BatchedEventEmitter";
import { CombatSystem } from "../systems/CombatSystem";
import { ResourceAttractionSystem } from "../systems/ResourceAttractionSystem";

import { AmbientAwarenessSystem } from "../systems/AmbientAwarenessSystem";

import { TimeSystem } from "../systems/TimeSystem";
import { InteractionGameSystem } from "../systems/InteractionGameSystem";
import { KnowledgeNetworkSystem } from "../systems/KnowledgeNetworkSystem";
import { EntityType } from "../../../shared/constants/EntityEnums";
import { MovementSystem } from "../systems/MovementSystem";

import { ChunkLoadingSystem } from "../systems/ChunkLoadingSystem";
import { SharedKnowledgeSystem } from "../systems/SharedKnowledgeSystem";
import { GPUComputeService } from "./GPUComputeService";
import { StateDirtyTracker } from "./StateDirtyTracker";
import { MultiRateScheduler } from "./MultiRateScheduler";
import { TickRate } from "../../../shared/constants/SchedulerEnums";
import { performanceMonitor } from "./PerformanceMonitor";
import { MetricsCollector } from "./MetricsCollector";
import { storageService } from "../../../infrastructure/services/storage/storageService";
import type {
  SimulationCommand,
  SimulationConfig,
  SimulationSnapshot,
  SimulationEvent,
} from "../../../shared/types/commands/SimulationCommand";

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

import { CommandProcessor } from "./runner/CommandProcessor";
import { SnapshotManager } from "./runner/SnapshotManager";
import { EventRegistry } from "./runner/EventRegistry";
import { WorldLoader } from "./runner/WorldLoader";

/**
 * Main simulation orchestrator and coordinator.
 *
 * Manages the game state, coordinates all simulation systems, handles commands,
 * and provides snapshots for client synchronization. Uses MultiRateScheduler
 * for optimized system updates at different frequencies.
 *
 * @see MultiRateScheduler for update rate management
 * @see StateCache for snapshot optimization
 * @see DeltaEncoder for delta snapshot generation
 */
@injectable()
export class SimulationRunner {
  public readonly state: GameState;
  private readonly emitter = new EventEmitter();
  private readonly commands: SimulationCommand[] = [];
  private readonly maxCommandQueue: number;
  /** @deprecated Use scheduler instead */
  private tickHandle?: NodeJS.Timeout;
  private tickCounter = 0;
  private scheduler: MultiRateScheduler;
  private metricsCollector: MetricsCollector;
  private indexRebuildInProgress = false;

  private eventRegistry: EventRegistry;
  private worldLoader: WorldLoader;
  private commandProcessor: CommandProcessor;
  private snapshotManager: SnapshotManager;

  private lastStateSync = 0;

  /**
   * Synchronizes system states to the main GameState.
   * Throttled to run periodically (e.g. 250ms) to save CPU.
   */
  private syncState(): void {
    this.syncAnimalsToState();
    this.syncGenealogyToState();

    const tasksChanged = this.taskSystem.syncTasksState();
    if (tasksChanged) {
      this.stateDirtyTracker.markDirty("tasks");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public on(event: string, listener: (...args: any[]) => void): void {
    this.emitter.on(event, listener);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public off(event: string, listener: (...args: any[]) => void): void {
    this.emitter.off(event, listener);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public emit(event: string, ...args: any[]): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this.emitter.emit(event, ...args);
  }

  private timeScale = 1;

  public get TimeScale(): number {
    return this.timeScale;
  }

  public setTimeScale(scale: number): void {
    this.timeScale = scale;
  }

  public getTickCounter(): number {
    return this.tickCounter;
  }

  @inject(TYPES.WorldResourceSystem)
  public readonly worldResourceSystem!: WorldResourceSystem;

  @inject(TYPES.LivingLegendsSystem)
  public readonly livingLegendsSystem!: LivingLegendsSystem;

  @inject(TYPES.LifeCycleSystem)
  public readonly lifeCycleSystem!: LifeCycleSystem;

  @inject(TYPES.NeedsSystem) public readonly needsSystem!: NeedsSystem;

  @inject(TYPES.GenealogySystem)
  public readonly _genealogySystem!: GenealogySystem;

  @inject(TYPES.SocialSystem) public readonly socialSystem!: SocialSystem;

  @inject(TYPES.InventorySystem)
  public readonly inventorySystem!: InventorySystem;

  @inject(TYPES.EconomySystem) public readonly economySystem!: EconomySystem;

  @inject(TYPES.MarketSystem) public readonly marketSystem!: MarketSystem;

  @inject(TYPES.RoleSystem) public readonly roleSystem!: RoleSystem;

  @inject(TYPES.AISystem) public readonly aiSystem!: AISystem;

  @inject(TYPES.ResourceReservationSystem)
  public readonly resourceReservationSystem!: ResourceReservationSystem;

  @inject(TYPES.GovernanceSystem)
  public readonly governanceSystem!: GovernanceSystem;

  @inject(TYPES.HouseholdSystem)
  public readonly householdSystem!: HouseholdSystem;

  @inject(TYPES.BuildingSystem) public readonly buildingSystem!: BuildingSystem;

  @inject(TYPES.BuildingMaintenanceSystem)
  public readonly buildingMaintenanceSystem!: BuildingMaintenanceSystem;

  @inject(TYPES.ProductionSystem)
  public readonly productionSystem!: ProductionSystem;

  @inject(TYPES.EnhancedCraftingSystem)
  public readonly enhancedCraftingSystem!: EnhancedCraftingSystem;

  @inject(TYPES.AnimalSystem) public readonly animalSystem!: AnimalSystem;

  @inject(TYPES.ItemGenerationSystem)
  public readonly itemGenerationSystem!: ItemGenerationSystem;

  @inject(TYPES.CombatSystem) public readonly combatSystem!: CombatSystem;

  @inject(TYPES.ReputationSystem)
  public readonly reputationSystem!: ReputationSystem;

  @inject(TYPES.RecipeDiscoverySystem)
  public readonly _recipeDiscoverySystem!: RecipeDiscoverySystem;

  @inject(TYPES.QuestSystem) public readonly questSystem!: QuestSystem;

  @inject(TYPES.TaskSystem) public readonly taskSystem!: TaskSystem;

  @inject(TYPES.TradeSystem) public readonly tradeSystem!: TradeSystem;

  @inject(TYPES.MarriageSystem) public readonly marriageSystem!: MarriageSystem;

  @inject(TYPES.ConflictResolutionSystem)
  public readonly conflictResolutionSystem!: ConflictResolutionSystem;

  @inject(TYPES.NormsSystem) public readonly _normsSystem!: NormsSystem;

  @inject(TYPES.ResourceAttractionSystem)
  public readonly resourceAttractionSystem!: ResourceAttractionSystem;

  @inject(TYPES.WorldGenerationService)
  public readonly worldGenerationService!: WorldGenerationService;

  @inject(TYPES.AmbientAwarenessSystem)
  public readonly ambientAwarenessSystem!: AmbientAwarenessSystem;

  @inject(TYPES.TimeSystem) public readonly timeSystem!: TimeSystem;

  @inject(TYPES.InteractionGameSystem)
  public readonly interactionGameSystem!: InteractionGameSystem;

  @inject(TYPES.KnowledgeNetworkSystem)
  public readonly knowledgeNetworkSystem!: KnowledgeNetworkSystem;

  @inject(TYPES.MovementSystem) public readonly movementSystem!: MovementSystem;

  @inject(TYPES.GPUComputeService)
  public readonly gpuComputeService!: GPUComputeService;

  public capturedEvents: SimulationEvent[] = [];

  @inject(TYPES.EntityIndex) public readonly entityIndex!: EntityIndex;

  @inject(TYPES.AgentRegistry)
  public readonly agentRegistry!: AgentRegistry;

  @inject(TYPES.SharedSpatialIndex)
  public readonly sharedSpatialIndex!: SharedSpatialIndex;

  @inject(TYPES.ChunkLoadingSystem)
  public readonly chunkLoadingSystem!: ChunkLoadingSystem;

  @inject(TYPES.SharedKnowledgeSystem)
  public readonly sharedKnowledgeSystem!: SharedKnowledgeSystem;

  @inject(TYPES.StateDirtyTracker)
  public readonly stateDirtyTracker!: StateDirtyTracker;

  private readonly INDEX_REBUILD_INTERVAL_FAST = 5;

  private readonly AUTO_SAVE_INTERVAL_MS = 60000;

  private autoSaveInterval?: NodeJS.Timeout;

  constructor(
    @inject(TYPES.GameState) state: GameState,

    @inject(TYPES.SimulationConfig) _config?: SimulationConfig,
  ) {
    this.state = state;

    this.maxCommandQueue = _config?.maxCommandQueue ?? 200;

    this.scheduler = new MultiRateScheduler({
      FAST: 50,

      MEDIUM: 250,

      SLOW: 1000,
    });

    this.metricsCollector = new MetricsCollector();

    this.eventRegistry = new EventRegistry(this);

    this.worldLoader = new WorldLoader(this);

    this.commandProcessor = new CommandProcessor(this);

    this.commandProcessor = new CommandProcessor(this);

    this.snapshotManager = new SnapshotManager(this);

    this.scheduleAutoSaves();

    this.scheduleAutoSaves();
  }

  /**
   * Initializes a worker thread for off-main-thread snapshot serialization.
   * Reduces event loop blocking when generating snapshots for WebSocket clients.
   *
   * The worker handles JSON serialization of snapshot data, allowing the main
   * thread to continue processing simulation ticks without interruption.
   */
  /**
   * Configures the recurring auto-save interval used during long sessions.
   * Saves are dispatched asynchronously so the tick loop never blocks.
   */
  private scheduleAutoSaves(): void {
    this.autoSaveInterval = setInterval(() => {
      this.saveSimulation().catch((err) => {
        logger.error("Auto-save failed:", err);
      });
    }, this.AUTO_SAVE_INTERVAL_MS);
  }

  /**
   * Saves the current simulation state to storage.
   *
   * @remarks
   * Clones the authoritative state before persisting it asynchronously via the
   * storage service. Callers may await the returned promise for logging
   * purposes, but the simulation loop can safely fire-and-forget without race
   * conditions because mutation occurs on the cloned snapshot.
   *
   * @returns {Promise<void>}
   */
  public async saveSimulation(): Promise<void> {
    const startTime = performance.now();
    try {
      const stateClone = cloneGameState(this.state);

      const saveData = {
        timestamp: Date.now(),
        gameTime: this.timeSystem.getCurrentTime().timestamp,
        stats: {
          population: this.state.agents.length,
          resourceCount: this.state.worldResources
            ? Object.keys(this.state.worldResources).length
            : 0,
          cycles: this.tickCounter,
        },
        state: stateClone,
      };

      const { saveId, size } = await storageService.saveGame(saveData);

      const duration = performance.now() - startTime;
      logger.info(
        `💾 Game saved: ${saveId} (${(size / 1024).toFixed(2)} KB) in ${duration.toFixed(2)}ms`,
      );
    } catch (error) {
      logger.error("Failed to save simulation:", error);
    }
  }

  /**
   * Initializes the simulation runner and all dependent systems.
   *
   * Performs the following setup operations:
   * - Initializes GPU compute service (with CPU fallback)
   * - Rebuilds entity and spatial indices
   * - Configures inter-system dependencies (lifecycle, needs, AI, economy, etc.)
   * - Sets up event listeners for cross-system communication
   * - Creates initial family (Isa, Stev, and 4 children) if no agents exist
   * - Creates initial infrastructure (house, workbench, storage, rest, kitchen)
   * - Initializes movement states for all agents
   * - Registers all systems in the multi-rate scheduler
   *
   * @throws {Error} If GPU initialization fails (falls back to CPU)
   */
  public async initialize(): Promise<void> {
    await this.gpuComputeService.initialize();
    const gpuStats = this.gpuComputeService.getPerformanceStats();
    logger.info(
      `🚀 GPU Compute Service: ${gpuStats.gpuAvailable ? "GPU active" : "CPU fallback"}`,
    );

    this.entityIndex.rebuild(this.state);

    if (this.buildingSystem) {
      this.buildingSystem.setTaskSystem(this.taskSystem);
    }

    this.lifeCycleSystem.setDependencies({
      needsSystem: this.needsSystem,
      inventorySystem: this.inventorySystem,
      householdSystem: this.householdSystem,
      movementSystem: this.movementSystem,
      genealogySystem: this._genealogySystem,
      socialSystem: this.socialSystem,
      marriageSystem: this.marriageSystem,

      aiSystem: this.aiSystem,
      roleSystem: this.roleSystem,
      taskSystem: this.taskSystem,
    });

    this.needsSystem.setDependencies({
      lifeCyclePort: this.lifeCycleSystem as ILifeCyclePort,

      inventorySystem: this.inventorySystem,
      socialSystem: this.socialSystem,
    });

    this.aiSystem.setDependencies({
      needsSystem: this.needsSystem,
      roleSystem: this.roleSystem,
      worldResourceSystem: this.worldResourceSystem,
      inventorySystem: this.inventorySystem,
      socialSystem: this.socialSystem,
      craftingSystem: this.enhancedCraftingSystem,
      movementSystem: this.movementSystem,
      householdSystem: this.householdSystem,
      taskSystem: this.taskSystem,
      combatSystem: this.combatSystem,
      animalSystem: this.animalSystem,
      questSystem: this.questSystem,
      timeSystem: this.timeSystem,
    });

    this.economySystem.setDependencies({
      roleSystem: this.roleSystem,
    });

    logger.info("🔗 SimulationRunner: System dependencies configured");

    this.eventRegistry.setupEventListeners();

    await this.ensureInitialFamily();

    this.syncAllAgentSystems();

    logger.info("📅 SimulationRunner: Registering systems in scheduler...");
    this.registerSystemsInScheduler();
    this.configureSchedulerHooks();

    logger.info("✅ SimulationRunner: Initialization completed successfully", {
      agentsCount: this.state.agents.length,
      zonesCount: this.state.zones?.length ?? 0,
      entitiesCount: this.state.entities?.length ?? 0,
      tickCounter: this.tickCounter,
    });
  }

  /**
   * Configures global synchronization hooks for the multi-rate scheduler.
   *
   * These hooks execute before and after each tick to maintain system consistency:
   * - Pre-tick: Processes commands, conditionally rebuilds indices (every N ticks or when dirty)
   * - Post-tick: Flushes batched events, marks state cache dirty, generates throttled snapshots,
   *   and updates performance metrics
   *
   * Index rebuilding is expensive, so it's done periodically (every 5 FAST ticks) or when
   * indices report themselves as dirty. This balances performance with data consistency.
   */
  private configureSchedulerHooks(): void {
    this.scheduler.setHooks({
      preTick: () => {
        this.commandProcessor.process(this.commands);

        const shouldRebuildIndices =
          this.tickCounter % this.INDEX_REBUILD_INTERVAL_FAST === 0 ||
          this.entityIndex.isDirty() ||
          this.sharedSpatialIndex.isDirty();

        if (shouldRebuildIndices && !this.indexRebuildInProgress) {
          this.indexRebuildInProgress = true;
          try {
            this.entityIndex.rebuild(this.state);
            this.entityIndex.syncAgentsToEntities(this.state);
            this.sharedSpatialIndex.rebuildIfNeeded(
              this.state.entities || [],
              this.animalSystem.getAnimals(),
            );
          } finally {
            this.indexRebuildInProgress = false;
          }
        }
      },
      postTick: () => {
        if (simulationEvents instanceof BatchedEventEmitter) {
          simulationEvents.flushEvents();
        }

        // Throttle state synchronization to match snapshot rate (approx 250ms)
        // This significantly reduces postTick duration by avoiding expensive array allocations every 50ms
        const now = Date.now();
        if (now - this.lastStateSync >= 250) {
          this.syncState();
          this.lastStateSync = now;
        }

        this.tickCounter += 1;

        this.snapshotManager.generateSnapshotThrottled();

        performanceMonitor.setSchedulerStats(this.scheduler.getStats());

        performanceMonitor.setGameLogicStats({
          activeAgents: this.state.agents.length,
          totalResources: this.state.worldResources
            ? Object.keys(this.state.worldResources).length
            : 0,
          totalBuildings: this.state.zones ? this.state.zones.length : 0,
        });

        this.metricsCollector.tryCollect(
          this.scheduler,
          this.gpuComputeService,
          this.state.agents.length,
        );
      },
      getEntityCount: () => {
        return (
          (this.state.agents?.length ?? 0) +
          (this.animalSystem?.getAnimals().size ?? 0)
        );
      },
    });
  }

  /**
   * Registers all simulation systems in the multi-rate scheduler.
   *
   * Systems are distributed across three update rates:
   * - FAST (50ms): Movement, combat, animals - requires high-frequency updates
   * - MEDIUM (250ms): AI, needs, social, household, lifecycle - moderate update frequency
   * - SLOW (1000ms): Economy, research, market, governance - infrequent updates sufficient
   *
   * Some systems specify `minEntities` to skip execution when entity count is too low,
   * reducing unnecessary computation in early game stages.
   */
  private registerSystemsInScheduler(): void {
    this.scheduler.registerSystem({
      name: "MovementSystem",
      rate: TickRate.FAST,
      update: (delta: number) => this.movementSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "CombatSystem",
      rate: TickRate.FAST,
      update: (delta: number) => this.combatSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "AISystem",
      rate: TickRate.MEDIUM,
      update: (delta: number) => this.aiSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "NeedsSystem",
      rate: TickRate.MEDIUM,
      update: (delta: number) => this.needsSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "SocialSystem",
      rate: TickRate.MEDIUM,
      update: (delta: number) => this.socialSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "HouseholdSystem",
      rate: TickRate.MEDIUM,
      update: (delta: number) => this.householdSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "LifeCycleSystem",
      rate: TickRate.MEDIUM,
      update: (delta: number) => this.lifeCycleSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "TimeSystem",
      rate: TickRate.MEDIUM,
      update: (delta: number) => this.timeSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "RoleSystem",
      rate: TickRate.MEDIUM,
      update: (delta: number) => this.roleSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "TaskSystem",
      rate: TickRate.MEDIUM,
      update: () => this.taskSystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "EconomySystem",
      rate: TickRate.SLOW,
      update: (delta: number) => this.economySystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "MarketSystem",
      rate: TickRate.SLOW,
      update: (delta: number) => this.marketSystem.update(delta),
      enabled: true,
      minEntities: 10,
    });

    this.scheduler.registerSystem({
      name: "ReputationSystem",
      rate: TickRate.SLOW,
      update: () => this.reputationSystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "GovernanceSystem",
      rate: TickRate.SLOW,
      update: (delta: number) => this.governanceSystem.update(delta),
      enabled: true,
      minEntities: 15,
    });

    this.scheduler.registerSystem({
      name: "WorldResourceSystem",
      rate: TickRate.SLOW,
      update: (delta: number) => this.worldResourceSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "AnimalSystem",
      rate: TickRate.MEDIUM,
      update: (delta: number) => this.animalSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "ProductionSystem",
      rate: TickRate.SLOW,
      update: (delta: number) => this.productionSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "BuildingSystem",
      rate: TickRate.SLOW,
      update: (delta: number) => this.buildingSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "BuildingMaintenanceSystem",
      rate: TickRate.SLOW,
      update: (delta: number) => this.buildingMaintenanceSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "EnhancedCraftingSystem",
      rate: TickRate.SLOW,
      update: () => this.enhancedCraftingSystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "InventorySystem",
      rate: TickRate.SLOW,
      update: () => this.inventorySystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "ResourceReservationSystem",
      rate: TickRate.SLOW,
      update: () => this.resourceReservationSystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "QuestSystem",
      rate: TickRate.SLOW,
      update: () => this.questSystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "TradeSystem",
      rate: TickRate.SLOW,
      update: () => this.tradeSystem.update(),
      enabled: true,
      minEntities: 10,
    });

    this.scheduler.registerSystem({
      name: "MarriageSystem",
      rate: TickRate.SLOW,
      update: () => this.marriageSystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "ConflictResolutionSystem",
      rate: TickRate.SLOW,
      update: () => this.conflictResolutionSystem.update(),
      enabled: true,
      minEntities: 10,
    });

    this.scheduler.registerSystem({
      name: "ResourceAttractionSystem",
      rate: TickRate.SLOW,
      update: (delta: number) => this.resourceAttractionSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "AmbientAwarenessSystem",
      rate: TickRate.SLOW,
      update: (delta: number) => this.ambientAwarenessSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "InteractionGameSystem",
      rate: TickRate.SLOW,
      update: (delta: number) => this.interactionGameSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "LivingLegendsSystem",
      rate: TickRate.SLOW,
      update: (delta: number) => this.livingLegendsSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "ItemGenerationSystem",
      rate: TickRate.SLOW,
      update: (delta: number) => this.itemGenerationSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "RecipeDiscoverySystem",
      rate: TickRate.SLOW,
      update: () => this._recipeDiscoverySystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "NormsSystem",
      rate: TickRate.SLOW,
      update: () => this._normsSystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "SharedKnowledgeSystem",
      rate: TickRate.SLOW,
      update: () => this.sharedKnowledgeSystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "KnowledgeNetworkSystem",
      rate: TickRate.SLOW,
      update: (delta: number) => this.knowledgeNetworkSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "ChunkLoadingSystem",
      rate: TickRate.SLOW,
      update: (delta: number) => this.chunkLoadingSystem.update(delta),
      enabled: true,
    });

    logger.info("📋 All systems registered in multi-rate scheduler", {
      fast: 3,
      medium: 8,
      slow: 30,
    });
  }

  /**
   * Creates initial basic infrastructure for the family to begin.
   * Includes family house, workbench, storage zone, rest zone, and kitchen.
   */
  /**
   * Ensures that the initial family (Isa, Stev, and children) exists in the simulation.
   * This method is idempotent: it checks for the existence of each agent before spawning.
   */
  public async ensureInitialFamily(): Promise<void> {
    await this.worldLoader.ensureInitialFamily();
  }

  /**
   * Synchronizes all agent-related systems with the current gameState agents.
   * Call this after loading a saved state to ensure all agents have their
   * needs, inventories, and AI states properly initialized.
   */
  public syncAllAgentSystems(): void {
    const agents = this.state.agents || [];
    let initialized = 0;

    // Clear spawned chunks tracking to allow resource regeneration in visited areas
    // This is critical after loading a save since:
    // 1. Resources may have been depleted before saving
    // 2. spawnedChunks/loadedChunks Sets are not persisted
    // 3. We need to regenerate resources for the world to function
    this.worldResourceSystem.clearSpawnedChunks();
    this.chunkLoadingSystem.clearLoadedChunks();
    this.animalSystem.clearSpawnedChunks();
    logger.info(
      `🔄 SimulationRunner: Cleared chunk tracking for fresh resource spawning`,
    );

    // Rebuild agent registry index to include all loaded agents
    this.agentRegistry.rebuildProfileIndex();
    const registeredCount = this.agentRegistry.getAgentCount();
    logger.info(
      `🔄 SimulationRunner: AgentRegistry rebuilt with ${registeredCount} agents`,
    );

    for (const agent of agents) {
      if (agent.isDead) continue;

      if (!this.needsSystem.getNeeds(agent.id)) {
        this.needsSystem.initializeEntityNeeds(agent.id);
        initialized++;
      }

      if (!this.inventorySystem.getAgentInventory(agent.id)) {
        this.inventorySystem.initializeAgentInventory(agent.id);
      }
    }

    if (initialized > 0) {
      logger.info(
        `🔄 SimulationRunner: Synced ${initialized} agents with NeedsSystem`,
      );
    }
  }

  /**
   * Generates the initial world terrain, seeds resource nodes, spawns animals,
   * and constructs functional zones that downstream systems rely on.
   *
   * @param worldConfig - World dimensions, tile size, and optional biome map.
   * @returns Promise that resolves after world assets are generated.
   */
  public async initializeWorldResources(worldConfig: {
    width: number;
    height: number;
    tileSize: number;
    biomeMap: string[][];
  }): Promise<void> {
    await this.worldLoader.initializeWorldResources(worldConfig);

    this.chunkLoadingSystem.initialize({
      width: worldConfig.width,
      height: worldConfig.height,
      tileSize: worldConfig.tileSize,
      seed: 12345,
      noise: {
        temperature: {
          scale: 0.0005,
          octaves: 4,
          persistence: 0.5,
          lacunarity: 2.0,
        },
        moisture: {
          scale: 0.0005,
          octaves: 3,
          persistence: 0.6,
          lacunarity: 2.0,
        },
        elevation: {
          scale: 0.0005,
          octaves: 5,
          persistence: 0.4,
          lacunarity: 2.0,
        },
      },
    });
  }

  private gpuStatsInterval?: NodeJS.Timeout;

  /**
   * Starts the simulation using the multi-rate scheduler.
   */
  start(): void {
    if (!this.scheduler) {
      logger.error("⚠️ Scheduler not initialized, cannot start simulation");
      return;
    }

    logger.info("🔄 SimulationRunner: Starting simulation scheduler...");
    this.aiSystem.initialize();
    this.scheduler.start();
    logger.info("🚀 Multi-rate simulation started", {
      rates: { FAST: "50ms", MEDIUM: "250ms", SLOW: "1000ms" },
      agentsCount: this.state.agents.length,
    });

    this.startGpuStatsLogging();
  }

  /**
   * Stops the simulation and clears all intervals.
   */
  stop(): void {
    if (this.scheduler) {
      this.scheduler.stop();
    }

    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = undefined;
    }

    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = undefined;
    }

    if (this.gpuStatsInterval) {
      clearInterval(this.gpuStatsInterval);
      this.gpuStatsInterval = undefined;
    }

    this.eventRegistry.cleanup();
  }

  /**
   * Enqueues a command for processing in the next tick.
   *
   * @param command - Simulation command to enqueue
   * @returns True if command was enqueued, false if queue is full
   */
  enqueueCommand(command: SimulationCommand): boolean {
    if (this.commands.length >= this.maxCommandQueue) {
      const dropped = this.commands.shift();
      logger.warn(
        `Command queue full (${this.maxCommandQueue}), dropping oldest command: ${dropped?.type}`,
      );
      this.emitter.emit("commandDropped", dropped);
    }
    this.commands.push(command);
    return true;
  }

  /**
   * Gets a complete snapshot including static data.
   * Use only when connecting a new client.
   *
   * @returns Full simulation snapshot with all state data
   */
  public getInitialSnapshot(): SimulationSnapshot {
    return this.snapshotManager.getInitialSnapshot();
  }

  /**
   * Synchronizes animals from AnimalSystem to GameState.
   * This ensures the state sent to clients includes updated animal positions.
   */
  private syncAnimalsToState(): void {
    if (this.animalSystem) {
      const animals = Array.from(this.animalSystem.getAnimals().values());
      const stats = this.animalSystem.getStats();

      this.state.animals = {
        animals,
        stats: {
          total: stats.totalAnimals,
          byType: stats.byType,
        },
      };
    }
  }

  private syncGenealogyToState(): void {
    if (this._genealogySystem) {
      this.state.genealogy = this._genealogySystem.getSnapshot();
    }
  }

  /**
   * Ensures an agent has a movement state initialized in the MovementSystem.
   *
   * If the agent doesn't have a movement state, attempts to initialize it from
   * the agent's current position. If the agent has no position, assigns a default
   * position based on world size before initializing movement.
   *
   * @param agentId - The agent ID to check and initialize
   * @returns True if movement state exists or was successfully created, false otherwise
   */
  public ensureMovementState(agentId: string): boolean {
    if (this.movementSystem.hasMovementState(agentId)) {
      return true;
    }

    const agent = this.entityIndex.getAgent(agentId);
    if (!agent) {
      logger.warn(`ensureMovementState: Agent ${agentId} not found`);
      return false;
    }

    if (!agent.position) {
      agent.position = {
        x: (this.state.worldSize?.width ?? 2048) / 2,
        y: (this.state.worldSize?.height ?? 2048) / 2,
      };
      logger.warn(
        `ensureMovementState: Agent ${agentId} had no position, assigned default`,
      );
    }

    this.movementSystem.initializeEntityMovement(agentId, agent.position);
    return true;
  }

  public resolveLineageId(requested?: string): string {
    if (requested) {
      return requested;
    }

    const existing =
      this.state.research?.lineages && this.state.research.lineages.length > 0
        ? this.state.research.lineages[0].lineageId
        : undefined;

    const lineageId = existing ?? "lineage_default";

    return lineageId;
  }

  /**
   * Retrieves detailed information about an entity by ID.
   *
   * Searches across multiple entity types: agents, animals, zones (buildings),
   * and world resources. Returns comprehensive data including needs, inventory,
   * social connections, and AI state for agents.
   *
   * @param entityId - ID of the entity to retrieve
   * @returns Entity details object or null if not found
   */
  public getEntityDetails(entityId: string): Record<string, unknown> | null {
    const entity = this.state.entities.find((e) => e.id === entityId);
    if (entity) {
      const needs = this.needsSystem.getEntityNeeds(entityId);
      const role = this.roleSystem.getAgentRole(entityId);
      const inventory = this.inventorySystem.getAgentInventory(entityId);
      const social = this.socialSystem.getSocialConnections(entityId);
      const aiState = this.aiSystem.getAIState(entityId);

      return {
        type: EntityType.AGENT,
        entity,
        needs,
        role,
        inventory,
        social,
        ai: aiState
          ? {
            currentGoal: aiState.currentGoal,
            goalQueue: aiState.goalQueue,
            currentAction: aiState.currentAction,
            offDuty: aiState.offDuty,
            lastDecisionTime: aiState.lastDecisionTime,
          }
          : null,
      };
    }

    const animal = this.animalSystem?.getAnimal(entityId);
    if (animal) {
      return {
        type: EntityType.ANIMAL,
        entity: animal,
      };
    }

    if (this.state.zones) {
      const zone = this.state.zones.find((z) => z.id === entityId);
      if (zone) {
        return {
          type: EntityType.ZONE,
          entity: zone,
        };
      }
    }

    if (this.state.worldResources) {
      const resource = this.state.worldResources[entityId];
      if (resource) {
        return {
          type: EntityType.RESOURCE,
          entity: resource,
        };
      }
    }

    return null;
  }

  /**
   * Gets the player's agent ID (first agent in the state).
   *
   * @returns Player agent ID or empty string if no agents exist
   */
  public getPlayerId(): string {
    return this.state.agents[0]?.id || "";
  }

  private startGpuStatsLogging(): void {
    setInterval(() => {
      const stats = this.gpuComputeService.getPerformanceStats();
      if (stats.gpuAvailable) {
        logger.debug("GPU Compute Stats:", stats);
      }
    }, 60000);
  }
}
