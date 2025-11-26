import { EventEmitter } from "node:events";
import { Worker } from "node:worker_threads";
import type { GameResources, GameState } from "../../types/game-types";
import { cloneGameState } from "./defaultState";
import { StateCache } from "./StateCache";
import { EntityIndex } from "./EntityIndex";
import { SharedSpatialIndex } from "./SharedSpatialIndex";
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
import { DivineFavorSystem } from "../systems/DivineFavorSystem";
import { HouseholdSystem } from "../systems/HouseholdSystem";
import { BuildingSystem } from "../systems/BuildingSystem";
import { BuildingMaintenanceSystem } from "../systems/BuildingMaintenanceSystem";
import { ProductionSystem } from "../systems/ProductionSystem";
import { EnhancedCraftingSystem } from "../systems/EnhancedCraftingSystem";
import { AnimalSystem } from "../systems/AnimalSystem";
import { ItemGenerationSystem } from "../systems/ItemGenerationSystem";
import { ReputationSystem } from "../systems/ReputationSystem";
import { ResearchSystem } from "../systems/ResearchSystem";
import { RecipeDiscoverySystem } from "../systems/RecipeDiscoverySystem";
import { QuestSystem } from "../systems/QuestSystem";
import { TaskSystem } from "../systems/TaskSystem";
import { TradeSystem } from "../systems/TradeSystem";
import { MarriageSystem } from "../systems/MarriageSystem";
import { ConflictResolutionSystem } from "../systems/ConflictResolutionSystem";
import { NormsSystem } from "../systems/NormsSystem";
import { simulationEvents, GameEventNames } from "./events";
import { BatchedEventEmitter } from "./BatchedEventEmitter";
import { CombatSystem } from "../systems/CombatSystem";
import { ResourceAttractionSystem } from "../systems/ResourceAttractionSystem";
import { CrisisPredictorSystem } from "../systems/CrisisPredictorSystem";
import { AmbientAwarenessSystem } from "../systems/AmbientAwarenessSystem";
import { CardDialogueSystem } from "../systems/CardDialogueSystem";
import { EmergenceSystem } from "../systems/EmergenceSystem";
import { TimeSystem } from "../systems/TimeSystem";
import { InteractionGameSystem } from "../systems/InteractionGameSystem";
import { KnowledgeNetworkSystem } from "../systems/KnowledgeNetworkSystem";
import { MovementSystem } from "../systems/MovementSystem";
import type { BuildingLabel } from "../../types/simulation/buildings";
import { AppearanceGenerationSystem } from "../systems/AppearanceGenerationSystem";
import { GPUComputeService } from "./GPUComputeService";
import { MultiRateScheduler } from "./MultiRateScheduler";
import { performanceMonitor } from "./PerformanceMonitor";
import { DeltaEncoder, type DeltaSnapshot } from "./DeltaEncoder";
import { MetricsCollector } from "./MetricsCollector";
import { storageService } from "../../../infrastructure/services/storage/storageService";
import type {
  SimulationCommand,
  SimulationConfig,
  SimulationSnapshot,
  SimulationEvent,
  NeedsCommandPayload,
  RecipeCommandPayload,
  SocialCommandPayload,
  ResearchCommandPayload,
  WorldResourceCommandPayload,
  DialogueCommandPayload,
  BuildingCommandPayload,
  ReputationCommandPayload,
  TaskCommandPayload,
  SpawnAgentCommandPayload,
} from "../../../shared/types/commands/SimulationCommand";
import type { NeedsConfig } from "../../types/simulation/needs";
import type { TaskType, TaskMetadata } from "../../types/simulation/tasks";

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public on(event: string, listener: (...args: any[]) => void): void {
    this.emitter.on(event, listener);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public off(event: string, listener: (...args: any[]) => void): void {
    this.emitter.off(event, listener);
  }

  private lastUpdate = Date.now();
  private timeScale = 1;

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
  @inject(TYPES.DivineFavorSystem)
  public readonly divineFavorSystem!: DivineFavorSystem;
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
  @inject(TYPES.ResearchSystem)
  public readonly _researchSystem!: ResearchSystem;
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
  @inject(TYPES.CrisisPredictorSystem)
  public readonly crisisPredictorSystem!: CrisisPredictorSystem;
  @inject(TYPES.WorldGenerationService)
  public readonly worldGenerationService!: WorldGenerationService;
  @inject(TYPES.AmbientAwarenessSystem)
  public readonly ambientAwarenessSystem!: AmbientAwarenessSystem;
  @inject(TYPES.CardDialogueSystem)
  public readonly cardDialogueSystem!: CardDialogueSystem;
  @inject(TYPES.EmergenceSystem)
  public readonly emergenceSystem!: EmergenceSystem;
  @inject(TYPES.TimeSystem) public readonly timeSystem!: TimeSystem;
  @inject(TYPES.InteractionGameSystem)
  public readonly interactionGameSystem!: InteractionGameSystem;
  @inject(TYPES.KnowledgeNetworkSystem)
  public readonly knowledgeNetworkSystem!: KnowledgeNetworkSystem;
  @inject(TYPES.MovementSystem) public readonly movementSystem!: MovementSystem;
  @inject(TYPES.AppearanceGenerationSystem)
  public readonly appearanceGenerationSystem!: AppearanceGenerationSystem;
  @inject(TYPES.GPUComputeService)
  public readonly gpuComputeService!: GPUComputeService;

  public capturedEvents: SimulationEvent[] = [];
  private stateCache: StateCache;
  private deltaEncoder: DeltaEncoder;
  @inject(TYPES.EntityIndex) public readonly entityIndex!: EntityIndex;
  @inject(TYPES.SharedSpatialIndex)
  public readonly sharedSpatialIndex!: SharedSpatialIndex;

  private lastSnapshotTime = 0;
  private readonly SNAPSHOT_INTERVAL_MS = 250;

  private snapshotWorker?: Worker;
  private snapshotWorkerReady = false;

  private readonly INDEX_REBUILD_INTERVAL_FAST = 5;
  private readonly AUTO_SAVE_INTERVAL_MS = 60000;
  private autoSaveInterval?: NodeJS.Timeout;

  constructor(
    @inject(TYPES.GameState) state: GameState,
    @inject(TYPES.SimulationConfig) _config?: SimulationConfig,
  ) {
    this.state = state;
    this.maxCommandQueue = _config?.maxCommandQueue ?? 200;
    this.stateCache = new StateCache();
    this.deltaEncoder = new DeltaEncoder();

    this.scheduler = new MultiRateScheduler({
      FAST: 50,
      MEDIUM: 250,
      SLOW: 1000,
    });

    this.metricsCollector = new MetricsCollector();
    this.eventRegistry = new EventRegistry(this);
    this.worldLoader = new WorldLoader(this);

    this.initializeSnapshotWorker();

    this.scheduleAutoSaves();
  }

  /**
   * Initializes a worker thread for off-main-thread snapshot serialization.
   * Reduces event loop blocking when generating snapshots for WebSocket clients.
   *
   * The worker handles JSON serialization of snapshot data, allowing the main
   * thread to continue processing simulation ticks without interruption.
   */
  private initializeSnapshotWorker(): void {
    try {
      const workerCode = `
        const { parentPort } = require('worker_threads');
        if (!parentPort) throw new Error('SnapshotWorker inline requires parentPort');
        parentPort.postMessage({ type: 'ready' });
        parentPort.on('message', (msg) => {
          try {
            if (msg && msg.type === 'snapshot' && msg.data) {
              const serialized = JSON.stringify(msg.data);
              parentPort.postMessage({ type: 'snapshot-ready', data: serialized, size: serialized.length });
            } else if (msg && msg.type === 'shutdown') {
              process.exit(0);
            }
          } catch (err) {
            parentPort.postMessage({ type: 'error', error: (err && err.message) || String(err) });
          }
        });
      `;

      this.snapshotWorker = new Worker(workerCode, { eval: true });

      this.snapshotWorker.on("message", (rawMessage: unknown) => {
        const message = rawMessage as {
          type: string;
          data?: string;
          error?: string;
        };
        if (message.type === "ready") {
          this.snapshotWorkerReady = true;
          logger.info("🧵 Snapshot worker thread ready");
        } else if (message.type === "snapshot-ready" && message.data) {
          try {
            const parsed: unknown = JSON.parse(message.data as string);
            this.emitter.emit("tick", parsed);
          } catch (err) {
            logger.error("Failed to parse snapshot from worker:", err);
          }
        } else if (message.type === "error") {
          logger.error("Snapshot worker error:", message.error);
        }
      });

      this.snapshotWorker.on("error", (error) => {
        logger.error("Snapshot worker thread error:", error);
        this.snapshotWorkerReady = false;
      });

      this.snapshotWorker.on("exit", (code) => {
        if (code !== 0) {
          logger.warn(`Snapshot worker stopped with exit code ${code}`);
        }
        this.snapshotWorkerReady = false;
      });
    } catch (error) {
      logger.error("Failed to initialize snapshot worker:", error);
      this.snapshotWorkerReady = false;
    }
  }

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
      divineFavorSystem: this.divineFavorSystem,
      aiSystem: this.aiSystem,
      roleSystem: this.roleSystem,
      taskSystem: this.taskSystem,
    });

    this.needsSystem.setDependencies({
      lifeCyclePort: this.lifeCycleSystem,
      divineFavorSystem: this.divineFavorSystem,
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
      divineFavorSystem: this.divineFavorSystem,
      genealogySystem: this._genealogySystem,
    });

    logger.info("🔗 SimulationRunner: System dependencies configured");

    this.eventRegistry.setupEventListeners();

    await this.ensureInitialFamily();

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
        this.processCommands();

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

        this.syncAnimalsToState();
        this.syncGenealogyToState();

        const baseDirtySections = [
          "agents",
          "entities",
          "animals",
          "inventory",
          "zones",
          "worldResources",
          "socialGraph",
          "market",
          "trade",
          "marriage",
          "quests",
          "conflicts",
          "research",
          "recipes",
          "reputation",
          "norms",
          "knowledgeGraph",
        ] as const;

        const tasksChanged = this.taskSystem.syncTasksState();
        if (tasksChanged) {
          this.stateCache.markDirty("tasks");
        }

        this.stateCache.markDirtyMultiple([...baseDirtySections]);

        this.tickCounter += 1;

        this.generateSnapshotThrottled();

        performanceMonitor.setSchedulerStats(this.scheduler.getStats());

        performanceMonitor.setGameLogicStats({
          activeAgents: this.state.agents.length,
          totalResources: this.state.worldResources
            ? Object.keys(this.state.worldResources).length
            : 0,
          totalBuildings: this.state.zones ? this.state.zones.length : 0,
        });

        // Recopilar métricas de rendimiento (muy ligero, cada 5 seg)
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
      rate: "FAST",
      update: (delta: number) => this.movementSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "CombatSystem",
      rate: "FAST",
      update: (delta: number) => this.combatSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "AISystem",
      rate: "MEDIUM",
      update: (delta: number) => this.aiSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "NeedsSystem",
      rate: "MEDIUM",
      update: (delta: number) => this.needsSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "SocialSystem",
      rate: "MEDIUM",
      update: (delta: number) => this.socialSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "HouseholdSystem",
      rate: "MEDIUM",
      update: (delta: number) => this.householdSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "LifeCycleSystem",
      rate: "MEDIUM",
      update: (delta: number) => this.lifeCycleSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "TimeSystem",
      rate: "MEDIUM",
      update: (delta: number) => this.timeSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "RoleSystem",
      rate: "MEDIUM",
      update: (delta: number) => this.roleSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "TaskSystem",
      rate: "MEDIUM",
      update: () => this.taskSystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "EconomySystem",
      rate: "SLOW",
      update: (delta: number) => this.economySystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "MarketSystem",
      rate: "SLOW",
      update: (delta: number) => this.marketSystem.update(delta),
      enabled: true,
      minEntities: 10,
    });

    this.scheduler.registerSystem({
      name: "ResearchSystem",
      rate: "SLOW",
      update: () => this._researchSystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "ReputationSystem",
      rate: "SLOW",
      update: () => this.reputationSystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "GovernanceSystem",
      rate: "SLOW",
      update: (delta: number) => this.governanceSystem.update(delta),
      enabled: true,
      minEntities: 15,
    });

    this.scheduler.registerSystem({
      name: "WorldResourceSystem",
      rate: "SLOW",
      update: (delta: number) => this.worldResourceSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "AnimalSystem",
      rate: "MEDIUM",
      update: (delta: number) => this.animalSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "ProductionSystem",
      rate: "SLOW",
      update: (delta: number) => this.productionSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "BuildingSystem",
      rate: "SLOW",
      update: (delta: number) => this.buildingSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "BuildingMaintenanceSystem",
      rate: "SLOW",
      update: (delta: number) => this.buildingMaintenanceSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "EnhancedCraftingSystem",
      rate: "SLOW",
      update: () => this.enhancedCraftingSystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "InventorySystem",
      rate: "SLOW",
      update: () => this.inventorySystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "ResourceReservationSystem",
      rate: "SLOW",
      update: () => this.resourceReservationSystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "DivineFavorSystem",
      rate: "SLOW",
      update: (delta: number) => this.divineFavorSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "QuestSystem",
      rate: "SLOW",
      update: () => this.questSystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "TradeSystem",
      rate: "SLOW",
      update: () => this.tradeSystem.update(),
      enabled: true,
      minEntities: 10,
    });

    this.scheduler.registerSystem({
      name: "MarriageSystem",
      rate: "SLOW",
      update: () => this.marriageSystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "ConflictResolutionSystem",
      rate: "SLOW",
      update: () => this.conflictResolutionSystem.update(),
      enabled: true,
      minEntities: 10,
    });

    this.scheduler.registerSystem({
      name: "ResourceAttractionSystem",
      rate: "SLOW",
      update: (delta: number) => this.resourceAttractionSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "CrisisPredictorSystem",
      rate: "SLOW",
      update: (delta: number) => this.crisisPredictorSystem.update(delta),
      enabled: true,
      minEntities: 20,
    });

    this.scheduler.registerSystem({
      name: "AmbientAwarenessSystem",
      rate: "SLOW",
      update: (delta: number) => this.ambientAwarenessSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "CardDialogueSystem",
      rate: "SLOW",
      update: (delta: number) => this.cardDialogueSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "InteractionGameSystem",
      rate: "SLOW",
      update: (delta: number) => this.interactionGameSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "LivingLegendsSystem",
      rate: "SLOW",
      update: (delta: number) => this.livingLegendsSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "ItemGenerationSystem",
      rate: "SLOW",
      update: (delta: number) => this.itemGenerationSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "RecipeDiscoverySystem",
      rate: "SLOW",
      update: () => this._recipeDiscoverySystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "NormsSystem",
      rate: "SLOW",
      update: () => this._normsSystem.update(),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "EmergenceSystem",
      rate: "SLOW",
      update: (delta: number) => this.emergenceSystem.update(delta),
      enabled: true,
    });

    this.scheduler.registerSystem({
      name: "KnowledgeNetworkSystem",
      rate: "SLOW",
      update: (delta: number) => this.knowledgeNetworkSystem.update(delta),
      enabled: true,
    });

    logger.info("📋 All systems registered in multi-rate scheduler", {
      fast: 3,
      medium: 8,
      slow: 29,
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

    if (this.snapshotWorker) {
      this.snapshotWorker.postMessage({ type: "shutdown" });
      this.snapshotWorker.terminate();
      this.snapshotWorker = undefined;
      this.snapshotWorkerReady = false;
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
  getInitialSnapshot(): SimulationSnapshot {
    const events =
      this.capturedEvents.length > 0 ? [...this.capturedEvents] : undefined;
    const snapshotState = cloneGameState(this.state);
    snapshotState.genealogy =
      this._genealogySystem?.getSerializedFamilyTree() ?? {};

    const allLegends = this.livingLegendsSystem.getAllLegends();
    const activeLegends = this.livingLegendsSystem.getActiveLegends();
    snapshotState.legends = {
      records: allLegends,
      activeLegends,
    };

    if (snapshotState.agents) {
      snapshotState.agents = snapshotState.agents.map((agent) => {
        const aiState = this.aiSystem.getAIState(agent.id);
        if (aiState) {
          return {
            ...agent,
            currentGoal: aiState.currentGoal,
            goalQueue: aiState.goalQueue,
            currentAction: aiState.currentAction,
            offDuty: aiState.offDuty,
            lastDecisionTime: aiState.lastDecisionTime,
            ai: {
              currentGoal: aiState.currentGoal,
              goalQueue: aiState.goalQueue,
              currentAction: aiState.currentAction,
              offDuty: aiState.offDuty,
              lastDecisionTime: aiState.lastDecisionTime,
            },
          };
        }
        return agent;
      });
    }

    return {
      state: snapshotState,
      tick: this.tickCounter,
      updatedAt: this.lastUpdate,
      events,
    };
  }

  /**
   * Generates a snapshot with throttling and optional worker thread processing.
   *
   * Snapshot generation is conditional:
   * 1. Only if there are listeners (clients connected via WebSocket)
   * 2. Only if enough time has elapsed since last snapshot (SNAPSHOT_INTERVAL_MS = 250ms)
   * 3. Uses worker thread if available, otherwise falls back to main thread
   *
   * This throttling prevents excessive snapshot generation when no clients are connected
   * and reduces event loop blocking by offloading serialization to a worker thread.
   */
  private generateSnapshotThrottled(): void {
    if (this.emitter.listenerCount("tick") === 0) {
      return;
    }

    if (!this.snapshotWorkerReady || !this.snapshotWorker) {
      try {
        const snapshot = this.getTickSnapshot();
        this.emitter.emit("tick", snapshot);
      } catch (error) {
        logger.error("Error generating snapshot (fallback):", error);
      }
      return;
    }

    const now = Date.now();
    const elapsed = now - this.lastSnapshotTime;

    if (elapsed < this.SNAPSHOT_INTERVAL_MS) {
      return;
    }

    this.lastSnapshotTime = now;

    try {
      const snapshot = this.getTickSnapshot();
      this.snapshotWorker.postMessage({
        type: "snapshot",
        data: snapshot,
      });
    } catch (error) {
      logger.error("Error sending snapshot to worker:", error);
    }
  }

  /**
   * Generates an optimized snapshot for regular ticks (excludes static terrain data).
   *
   * Uses StateCache to minimize cloning overhead by only copying state sections
   * that have been marked as dirty since the last snapshot. Static data like
   * terrain tiles, roads, and object layers are excluded to reduce payload size.
   *
   * Includes dynamic state: agents, entities, zones, resources, social graph,
   * market, quests, research, etc. Also includes AI state (goals, actions) and
   * genealogy/legends data.
   *
   * @returns Optimized simulation snapshot with only changed state sections
   */
  getTickSnapshot(): SimulationSnapshot {
    const events =
      this.capturedEvents.length > 0 ? [...this.capturedEvents] : undefined;

    const snapshotState = this.stateCache.getSnapshot(
      this.state,
      this.tickCounter,
    );

    snapshotState.genealogy =
      this._genealogySystem?.getSerializedFamilyTree() ?? {};

    const allLegends = this.livingLegendsSystem.getAllLegends();
    const activeLegends = this.livingLegendsSystem.getActiveLegends();
    snapshotState.legends = {
      records: allLegends,
      activeLegends,
    };

    if (snapshotState.agents) {
      snapshotState.agents = snapshotState.agents.map((agent) => {
        const aiState = this.aiSystem.getAIState(agent.id);
        if (aiState) {
          return {
            ...agent,
            currentGoal: aiState.currentGoal,
            goalQueue: aiState.goalQueue,
            currentAction: aiState.currentAction,
            offDuty: aiState.offDuty,
            lastDecisionTime: aiState.lastDecisionTime,
            ai: {
              currentGoal: aiState.currentGoal,
              goalQueue: aiState.goalQueue,
              currentAction: aiState.currentAction,
              offDuty: aiState.offDuty,
              lastDecisionTime: aiState.lastDecisionTime,
            },
          };
        }
        return agent;
      });
    }

    const tickState = { ...snapshotState };
    delete tickState.terrainTiles;
    delete tickState.roads;
    delete tickState.objectLayers;

    return {
      state: tickState,
      tick: this.tickCounter,
      updatedAt: this.lastUpdate,
      events,
    };
  }

  /**
   * Gets a snapshot (delegates to getTickSnapshot).
   *
   * @deprecated Use getInitialSnapshot() or getTickSnapshot() instead
   * @returns Simulation snapshot
   */
  getSnapshot(): SimulationSnapshot {
    return this.getTickSnapshot();
  }

  /**
   * Generates a delta snapshot containing only changes since the last snapshot.
   *
   * Uses DeltaEncoder to compute differences between current and previous state,
   * significantly reducing payload size for WebSocket transmission. This is more
   * efficient than full snapshots when state changes are incremental.
   *
   * @param forceFull - If true, generates a full snapshot regardless of delta interval
   * @returns Delta snapshot with only changed state sections
   */
  getDeltaSnapshot(forceFull = false): DeltaSnapshot {
    const tickSnapshot = this.getTickSnapshot();
    return this.deltaEncoder.encodeDelta(tickSnapshot, forceFull);
  }

  private isStepping = false;

  /**
   * @deprecated Use MultiRateScheduler instead. This method is kept for compatibility only.
   * @internal
   */
  // @ts-expect-error - Deprecated method kept for compatibility
  private async step(): Promise<void> {
    if (this.isStepping) {
      logger.warn("Simulation step skipped: previous step still running");
      return;
    }
    this.isStepping = true;

    try {
      const now = Date.now();
      const delta = now - this.lastUpdate;
      this.lastUpdate = now;

      this.processCommands();
      const scaledDelta = delta * this.timeScale;

      this.entityIndex.rebuild(this.state);
      this.entityIndex.syncAgentsToEntities(this.state);
      this.sharedSpatialIndex.rebuildIfNeeded(
        this.state.entities || [],
        this.animalSystem.getAnimals(),
      );

      const dirtySections: string[] = [];

      this.advanceSimulation(scaledDelta);

      await Promise.all([
        Promise.resolve(this.worldResourceSystem.update(scaledDelta)),
        Promise.resolve(this.animalSystem.update(scaledDelta)),
        Promise.resolve(this.timeSystem.update(scaledDelta)),
        Promise.resolve(this.itemGenerationSystem.update(scaledDelta)),
        Promise.resolve(this.reputationSystem.update()),
        Promise.resolve(this._researchSystem.update()),
        Promise.resolve(this.emergenceSystem.update(scaledDelta)),
        Promise.resolve(this.knowledgeNetworkSystem.update(scaledDelta)),
        Promise.resolve(this.productionSystem.update(scaledDelta)),
        Promise.resolve(this._recipeDiscoverySystem.update()),
        Promise.resolve(this._normsSystem.update()),
      ]);
      dirtySections.push(
        "worldResources",
        "animals",
        "research",
        "recipes",
        "norms",
      );

      await Promise.all([
        Promise.resolve(this.livingLegendsSystem.update(scaledDelta)),
        Promise.resolve(this.lifeCycleSystem.update(scaledDelta)),
        Promise.resolve(this.inventorySystem.update()),
        Promise.resolve(this.resourceReservationSystem.update()),
      ]);
      dirtySections.push("agents", "entities", "inventory");

      await Promise.all([
        Promise.resolve(this.needsSystem.update(scaledDelta)),
        Promise.resolve(this.socialSystem.update(scaledDelta)),
        Promise.resolve(this.economySystem.update(scaledDelta)),
        Promise.resolve(this.marketSystem.update(scaledDelta)),
      ]);
      dirtySections.push("socialGraph", "market");

      this.roleSystem.update(scaledDelta);
      this.aiSystem.update(scaledDelta);
      dirtySections.push("agents");

      await Promise.all([
        Promise.resolve(this.divineFavorSystem.update(scaledDelta)),
        Promise.resolve(this.governanceSystem.update(scaledDelta)),
        Promise.resolve(this.householdSystem.update(scaledDelta)),
        Promise.resolve(this.buildingSystem.update(scaledDelta)),
        Promise.resolve(this.buildingMaintenanceSystem.update(scaledDelta)),
        Promise.resolve(this.enhancedCraftingSystem.update()),
      ]);
      dirtySections.push("zones");

      this.combatSystem.update(scaledDelta);
      this.taskSystem.update();
      dirtySections.push("entities", "tasks");

      await Promise.all([
        Promise.resolve(this.questSystem.update()),
        Promise.resolve(this.tradeSystem.update()),
        Promise.resolve(this.marriageSystem.update()),
        Promise.resolve(this.conflictResolutionSystem.update()),
        Promise.resolve(this.resourceAttractionSystem.update(scaledDelta)),
        Promise.resolve(this.crisisPredictorSystem.update(scaledDelta)),
        Promise.resolve(this.ambientAwarenessSystem.update(scaledDelta)),
        Promise.resolve(this.cardDialogueSystem.update(scaledDelta)),
        Promise.resolve(this.interactionGameSystem.update(scaledDelta)),
      ]);
      dirtySections.push(
        "reputation",
        "quests",
        "trade",
        "marriage",
        "conflicts",
        "knowledgeGraph",
      );

      this.movementSystem.update(scaledDelta);
      dirtySections.push("entities");

      this.syncAnimalsToState();

      this.stateCache.markDirtyMultiple(dirtySections);

      this.tickCounter += 1;

      if (simulationEvents instanceof BatchedEventEmitter) {
        simulationEvents.flushEvents();
      }

      const snapshot = this.getTickSnapshot();
      this.emitter.emit("tick", snapshot);

      this.capturedEvents = [];
    } finally {
      this.isStepping = false;
    }
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

  private processCommands(): void {
    if (this.commands.length > 0) {
      logger.info(`🎯 Processing ${this.commands.length} command(s)`);
    }
    while (this.commands.length > 0) {
      const command = this.commands.shift();
      if (!command) break;
      logger.info(`📝 Processing command: ${command.type}`, command);
      switch (command.type) {
        case "SET_TIME_SCALE":
          this.timeScale = Math.max(0.1, Math.min(10, command.multiplier));
          break;
        case "APPLY_RESOURCE_DELTA":
          this.applyResourceDelta(command.delta);
          break;
        case "GATHER_RESOURCE":
          simulationEvents.emit(GameEventNames.RESOURCE_GATHERED, {
            resourceId: command.resourceId,
            amount: command.amount,
          });
          break;
        case "GIVE_RESOURCE":
          if (
            command.payload.agentId &&
            command.payload.resource &&
            command.payload.amount
          ) {
            this.inventorySystem.addResource(
              command.payload.agentId,
              command.payload.resource,
              command.payload.amount,
            );
          }
          break;
        case "SPAWN_AGENT": {
          logger.info("🔵 SPAWN_AGENT command received", command.payload);
          const spawnPayload = (command.payload ??
            {}) as SpawnAgentCommandPayload;

          const agentPayload: Partial<
            import("../../types/simulation/agents").AgentProfile
          > = {
            ...(spawnPayload as Partial<
              import("../../types/simulation/agents").AgentProfile
            >),
          };

          if (!agentPayload.id && spawnPayload.requestId) {
            agentPayload.id = spawnPayload.requestId;
          }

          logger.info("🟢 Spawning agent with payload:", agentPayload);
          const newAgent = this.lifeCycleSystem.spawnAgent(agentPayload);
          logger.info(`✅ Agent spawned successfully: ${newAgent.id}`, {
            totalAgents: this.state.agents.length,
          });
          break;
        }
        case "KILL_AGENT":
          this.lifeCycleSystem.removeAgent(command.agentId);
          break;
        case "AGENT_COMMAND":
          this.handleAgentCommand(command);
          break;
        case "ANIMAL_COMMAND":
          this.handleAnimalCommand(command);
          break;
        case "NEEDS_COMMAND":
          this.handleNeedsCommand(command);
          break;
        case "RECIPE_COMMAND":
          this.handleRecipeCommand(command);
          break;
        case "SOCIAL_COMMAND":
          this.handleSocialCommand(command);
          break;
        case "RESEARCH_COMMAND":
          this.handleResearchCommand(command);
          break;
        case "WORLD_RESOURCE_COMMAND":
          this.handleWorldResourceCommand(command);
          break;
        case "DIALOGUE_COMMAND":
          this.handleDialogueCommand(command);
          break;
        case "BUILDING_COMMAND":
          this.handleBuildingCommand(command);
          break;
        case "REPUTATION_COMMAND":
          this.handleReputationCommand(command);
          break;
        case "TASK_COMMAND":
          this.handleTaskCommand(command);
          break;
        case "TIME_COMMAND":
          this.handleTimeCommand(command);
          break;
        case "FORCE_EMERGENCE_EVALUATION":
          this.emergenceSystem.forcePatternEvaluation();
          break;
        case "SAVE_GAME":
          this.saveSimulation().catch((err) => {
            logger.error("Manual save failed:", err);
          });
          break;
        case "PING":
        default:
          break;
      }
    }
  }

  private handleAgentCommand(
    command: Extract<SimulationCommand, { type: "AGENT_COMMAND" }>,
  ): void {
    if (!command.agentId) return;
    if (!this.ensureMovementState(command.agentId)) return;

    const payload = command.payload;

    switch (command.command) {
      case "MOVE_TO":
        if (
          payload &&
          typeof payload.x === "number" &&
          typeof payload.y === "number"
        ) {
          this.movementSystem.moveToPoint(
            command.agentId,
            payload.x,
            payload.y,
          );
          simulationEvents.emit(GameEventNames.AGENT_ACTION_COMMANDED, {
            agentId: command.agentId,
            action: "move",
            payload,
          });
        }
        break;
      case "STOP_MOVEMENT":
        this.movementSystem.stopMovement(command.agentId);
        break;
      default:
        break;
    }
  }

  private handleAnimalCommand(
    command: Extract<SimulationCommand, { type: "ANIMAL_COMMAND" }>,
  ): void {
    if (command.command !== "SPAWN_ANIMAL") return;
    const payload = command.payload;
    if (
      !payload ||
      typeof payload.type !== "string" ||
      !payload.position ||
      typeof payload.position.x !== "number" ||
      typeof payload.position.y !== "number"
    ) {
      return;
    }

    this.animalSystem.spawnAnimal(
      payload.type,
      payload.position,
      payload.biome as string | undefined,
    );
  }

  private handleNeedsCommand(
    command: Extract<SimulationCommand, { type: "NEEDS_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as NeedsCommandPayload);
    switch (command.command) {
      case "SATISFY_NEED":
        if (
          payload.entityId &&
          payload.needType &&
          typeof payload.amount === "number"
        ) {
          this.needsSystem.satisfyNeed(
            payload.entityId as string,
            payload.needType as string,
            payload.amount,
          );
        }
        break;
      case "MODIFY_NEED":
        if (
          payload.entityId &&
          payload.needType &&
          typeof payload.delta === "number"
        ) {
          this.needsSystem.modifyNeed(
            payload.entityId as string,
            payload.needType as string,
            payload.delta,
          );
        }
        break;
      case "UPDATE_CONFIG":
        this.needsSystem.updateConfig(payload as Partial<NeedsConfig>);
        break;
    }
  }

  private handleRecipeCommand(
    command: Extract<SimulationCommand, { type: "RECIPE_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as RecipeCommandPayload);
    switch (command.command) {
      case "TEACH_RECIPE":
        if ((payload.agentId || payload.teacherId) && payload.recipeId) {
          this._recipeDiscoverySystem.teachRecipe(
            (payload.agentId as string) ?? (payload.teacherId as string) ?? "",
            payload.recipeId as string,
          );
        }
        break;
      case "SHARE_RECIPE":
        {
          const teacherId =
            (payload.teacherId as string | undefined) ??
            ((payload as Record<string, unknown>).fromAgentId as
              | string
              | undefined);
          const studentId =
            (payload.studentId as string | undefined) ??
            ((payload as Record<string, unknown>).toAgentId as
              | string
              | undefined);

          if (teacherId && studentId && payload.recipeId) {
            this._recipeDiscoverySystem.shareRecipe(
              teacherId,
              studentId,
              payload.recipeId as string,
            );
          }
        }
        break;
    }
  }

  private handleSocialCommand(
    command: Extract<SimulationCommand, { type: "SOCIAL_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as SocialCommandPayload);
    switch (command.command) {
      case "IMPOSE_TRUCE":
        if (
          payload.aId &&
          payload.bId &&
          typeof payload.durationMs === "number"
        ) {
          this.socialSystem.imposeTruce(
            payload.aId as string,
            payload.bId as string,
            payload.durationMs,
          );
        }
        break;
      case "SET_AFFINITY":
        if (payload.aId && payload.bId && typeof payload.value === "number") {
          this.socialSystem.setAffinity(
            payload.aId as string,
            payload.bId as string,
            payload.value,
          );
        }
        break;
      case "MODIFY_AFFINITY":
        if (payload.aId && payload.bId && typeof payload.delta === "number") {
          this.socialSystem.modifyAffinity(
            payload.aId as string,
            payload.bId as string,
            payload.delta,
          );
        }
        break;
      case "REMOVE_RELATIONSHIPS":
        if (payload.agentId) {
          this.socialSystem.removeRelationships(payload.agentId as string);
        }
        break;
      case "FRIENDLY_INTERACTION":
        if (
          payload.agentA &&
          payload.agentB &&
          typeof payload.magnitude === "number"
        ) {
          this.socialSystem.modifyAffinity(
            payload.agentA as string,
            payload.agentB as string,
            (payload.magnitude as number) || 0.1,
          );
          this.interactionGameSystem.startInteraction(
            payload.agentA as string,
            payload.agentB as string,
            "friendly",
          );
        }
        break;
      case "HOSTILE_ENCOUNTER":
        if (
          payload.agentA &&
          payload.agentB &&
          typeof payload.magnitude === "number"
        ) {
          this.socialSystem.modifyAffinity(
            payload.agentA as string,
            payload.agentB as string,
            -(payload.magnitude as number) || -0.1,
          );
          this.interactionGameSystem.startInteraction(
            payload.agentA as string,
            payload.agentB as string,
            "hostile",
          );
        }
        break;
    }
  }

  private handleResearchCommand(
    command: Extract<SimulationCommand, { type: "RESEARCH_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as ResearchCommandPayload);
    switch (command.command) {
      case "INITIALIZE_LINEAGE":
        if (payload.lineageId) {
          this._researchSystem.initializeLineage(payload.lineageId as string);
        }
        break;
      case "RECIPE_DISCOVERED":
        if (payload.recipeId) {
          const lineageId = this.resolveLineageId(
            payload.lineageId as string | undefined,
          );
          const discoveredBy =
            (payload.discoveredBy as string | undefined) || "unknown";

          this._researchSystem.onRecipeDiscovered(
            lineageId,
            payload.recipeId as string,
            discoveredBy,
          );
        }
        break;
    }
  }

  private handleWorldResourceCommand(
    command: Extract<SimulationCommand, { type: "WORLD_RESOURCE_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as WorldResourceCommandPayload);
    switch (command.command) {
      case "SPAWN_RESOURCE":
        if (payload.type && payload.position) {
          this.worldResourceSystem.spawnResource(
            payload.type as string,
            payload.position as { x: number; y: number },
            (payload.biome as string) || "grass",
          );
        }
        break;
      case "HARVEST_RESOURCE":
        if (payload.resourceId && payload.agentId) {
          this.worldResourceSystem.harvestResource(
            payload.resourceId as string,
            payload.agentId as string,
          );
        }
        break;
    }
  }

  private handleDialogueCommand(
    command: Extract<SimulationCommand, { type: "DIALOGUE_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as DialogueCommandPayload);
    switch (command.command) {
      case "RESPOND_TO_CARD":
        if (payload.cardId && payload.choiceId) {
          this.cardDialogueSystem.respondToCard(
            payload.cardId as string,
            payload.choiceId as string,
          );
        }
        break;
    }
  }

  private handleBuildingCommand(
    command: Extract<SimulationCommand, { type: "BUILDING_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as BuildingCommandPayload);
    switch (command.command) {
      case "START_UPGRADE":
        if (payload.zoneId && payload.agentId) {
          this.buildingMaintenanceSystem.startUpgrade(
            payload.zoneId as string,
            payload.agentId as string,
          );
        }
        break;
      case "CANCEL_UPGRADE":
        if (payload.zoneId) {
          this.buildingMaintenanceSystem.cancelUpgrade(
            payload.zoneId as string,
          );
        }
        break;
      case "ENQUEUE_CONSTRUCTION":
        if (payload.buildingType) {
          this.buildingSystem.enqueueConstruction(
            payload.buildingType as BuildingLabel,
          );
        }
        break;
      case "CONSTRUCT_BUILDING":
        if (payload.buildingType) {
          this.buildingSystem.constructBuilding(
            payload.buildingType as BuildingLabel,
            payload.position as { x: number; y: number } | undefined,
          );
        }
        break;
    }
  }

  private handleReputationCommand(
    command: Extract<SimulationCommand, { type: "REPUTATION_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as ReputationCommandPayload);
    switch (command.command) {
      case "UPDATE_TRUST":
        if (
          payload.agentA &&
          payload.agentB &&
          typeof payload.delta === "number"
        ) {
          this.reputationSystem.updateTrust(
            payload.agentA as string,
            payload.agentB as string,
            payload.delta,
          );
        }
        break;
    }
  }

  private handleTaskCommand(
    command: Extract<SimulationCommand, { type: "TASK_COMMAND" }>,
  ): void {
    const payload = command.payload ?? ({} as TaskCommandPayload);
    switch (command.command) {
      case "CREATE_TASK":
        if (payload.type && typeof payload.requiredWork === "number") {
          this.taskSystem.createTask({
            type: payload.type as TaskType,
            requiredWork: payload.requiredWork,
            bounds: payload.bounds as
              | { x: number; y: number; width: number; height: number }
              | undefined,
            zoneId: payload.zoneId as string | undefined,
            requirements: payload.requirements as
              | {
                  resources?: {
                    wood?: number;
                    stone?: number;
                    food?: number;
                    water?: number;
                  };
                  minWorkers?: number;
                }
              | undefined,
            metadata: payload.metadata as TaskMetadata | undefined,
            targetAnimalId: payload.targetAnimalId as string | undefined,
          });
        }
        break;
      case "CONTRIBUTE_TO_TASK":
        if (
          payload.taskId &&
          payload.agentId &&
          typeof payload.contribution === "number"
        ) {
          this.taskSystem.contributeToTask(
            payload.taskId as string,
            payload.agentId as string,
            payload.contribution,
            (payload.socialSynergyMultiplier as number) || 1.0,
          );
        }
        break;
      case "REMOVE_TASK":
        if (payload.taskId) {
          this.taskSystem.removeTask(payload.taskId as string);
        }
        break;
    }
  }

  private handleTimeCommand(
    command: Extract<SimulationCommand, { type: "TIME_COMMAND" }>,
  ): void {
    if (command.command === "SET_WEATHER" && command.payload?.weatherType) {
      const weatherType = command.payload.weatherType as string;
      if (
        this.timeSystem &&
        typeof this.timeSystem === "object" &&
        "setWeather" in this.timeSystem &&
        typeof this.timeSystem.setWeather === "function"
      ) {
        this.timeSystem.setWeather(
          weatherType as
            | "clear"
            | "cloudy"
            | "rainy"
            | "stormy"
            | "foggy"
            | "snowy",
        );
        logger.info(`Weather set to ${weatherType} via TIME_COMMAND`);
      } else {
        logger.warn("TimeSystem.setWeather not available");
      }
    }
  }

  private applyResourceDelta(delta: Partial<GameResources["materials"]>): void {
    if (!this.state.resources) {
      return;
    }
    const materials = this.state.resources.materials;
    for (const [key, value] of Object.entries(delta)) {
      const materialKey = key as keyof GameResources["materials"];
      const current = materials[materialKey] ?? 0;
      materials[materialKey] = current + (value ?? 0);
    }
  }

  private advanceSimulation(deltaMs: number): void {
    this.state.togetherTime += deltaMs;
    this.state.dayTime = ((this.state.dayTime ?? 0) + deltaMs) % 86400000;

    this.state.cycles += 1;

    if (this.state.resources) {
      const regenRate = deltaMs / 1000;
      this.state.resources.energy = Math.min(
        100,
        this.state.resources.energy + regenRate * 0.1,
      );
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
  private ensureMovementState(agentId: string): boolean {
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
        x: (this.state.worldSize?.width ?? 128) * 16,
        y: (this.state.worldSize?.height ?? 128) * 16,
      };
      logger.warn(
        `ensureMovementState: Agent ${agentId} had no position, assigned default`,
      );
    }

    this.movementSystem.initializeEntityMovement(agentId, agent.position);
    return true;
  }

  private resolveLineageId(requested?: string): string {
    if (requested) {
      return requested;
    }

    const existing =
      this.state.research?.lineages && this.state.research.lineages.length > 0
        ? this.state.research.lineages[0].lineageId
        : undefined;

    const lineageId = existing ?? "lineage_default";
    if (!existing) {
      this._researchSystem.initializeLineage(lineageId);
    }
    return lineageId;
  }

  public getEntityDetails(entityId: string): Record<string, unknown> | null {
    const entity = this.state.entities.find((e) => e.id === entityId);
    if (!entity) return null;

    const needs = this.needsSystem.getEntityNeeds(entityId);
    const role = this.roleSystem.getAgentRole(entityId);
    const inventory = this.inventorySystem.getAgentInventory(entityId);
    const social = this.socialSystem.getSocialConnections(entityId);
    const aiState = this.aiSystem.getAIState(entityId);

    return {
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
