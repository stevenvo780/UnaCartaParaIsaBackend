import { EventEmitter } from "node:events";
import { Worker } from "node:worker_threads";
import type { GameResources, GameState, Zone } from "../../types/game-types";
import { cloneGameState } from "./defaultState";
import { StateCache } from "./StateCache";
import { EntityIndex } from "./EntityIndex";
import { SharedSpatialIndex } from "./SharedSpatialIndex";
import { WorldGenerationService } from "../../../infrastructure/services/world/worldGenerationService";
import { BiomeType } from "../../world/generation/types";
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
import { mapEventName } from "./eventNameMapper";
import { MultiRateScheduler } from "./MultiRateScheduler";
import { performanceMonitor } from "./PerformanceMonitor";
import { DeltaEncoder, type DeltaSnapshot } from "./DeltaEncoder";
import type {
  SimulationCommand,
  SimulationConfig,
  SimulationSnapshot,
  SimulationEvent,
  SimulationEventPayload,
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
  private state: GameState;
  private readonly emitter = new EventEmitter();
  private readonly commands: SimulationCommand[] = [];
  private readonly maxCommandQueue: number;
  /** @deprecated Use scheduler instead */
  private tickHandle?: NodeJS.Timeout;
  private tickCounter = 0;
  private scheduler: MultiRateScheduler;
  private indexRebuildInProgress = false;

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
  private worldResourceSystem!: WorldResourceSystem;
  @inject(TYPES.LivingLegendsSystem)
  private livingLegendsSystem!: LivingLegendsSystem;
  @inject(TYPES.LifeCycleSystem) private lifeCycleSystem!: LifeCycleSystem;
  @inject(TYPES.NeedsSystem) private needsSystem!: NeedsSystem;
  @inject(TYPES.GenealogySystem) private _genealogySystem!: GenealogySystem;
  @inject(TYPES.SocialSystem) private socialSystem!: SocialSystem;
  @inject(TYPES.InventorySystem) private inventorySystem!: InventorySystem;
  @inject(TYPES.EconomySystem) private economySystem!: EconomySystem;
  @inject(TYPES.MarketSystem) private marketSystem!: MarketSystem;
  @inject(TYPES.RoleSystem) private roleSystem!: RoleSystem;
  @inject(TYPES.AISystem) private aiSystem!: AISystem;
  @inject(TYPES.ResourceReservationSystem)
  private resourceReservationSystem!: ResourceReservationSystem;
  @inject(TYPES.GovernanceSystem) private governanceSystem!: GovernanceSystem;
  @inject(TYPES.DivineFavorSystem)
  private divineFavorSystem!: DivineFavorSystem;
  @inject(TYPES.HouseholdSystem) private householdSystem!: HouseholdSystem;
  @inject(TYPES.BuildingSystem) private buildingSystem!: BuildingSystem;
  @inject(TYPES.BuildingMaintenanceSystem)
  private buildingMaintenanceSystem!: BuildingMaintenanceSystem;
  @inject(TYPES.ProductionSystem) private productionSystem!: ProductionSystem;
  @inject(TYPES.EnhancedCraftingSystem)
  private enhancedCraftingSystem!: EnhancedCraftingSystem;
  @inject(TYPES.AnimalSystem) private animalSystem!: AnimalSystem;
  @inject(TYPES.ItemGenerationSystem)
  private itemGenerationSystem!: ItemGenerationSystem;
  @inject(TYPES.CombatSystem) private combatSystem!: CombatSystem;
  @inject(TYPES.ReputationSystem) private reputationSystem!: ReputationSystem;
  @inject(TYPES.ResearchSystem) private _researchSystem!: ResearchSystem;
  @inject(TYPES.RecipeDiscoverySystem)
  private _recipeDiscoverySystem!: RecipeDiscoverySystem;
  @inject(TYPES.QuestSystem) private questSystem!: QuestSystem;
  @inject(TYPES.TaskSystem) private taskSystem!: TaskSystem;
  @inject(TYPES.TradeSystem) private tradeSystem!: TradeSystem;
  @inject(TYPES.MarriageSystem) private marriageSystem!: MarriageSystem;
  @inject(TYPES.ConflictResolutionSystem)
  private conflictResolutionSystem!: ConflictResolutionSystem;
  @inject(TYPES.NormsSystem) private _normsSystem!: NormsSystem;
  @inject(TYPES.ResourceAttractionSystem)
  private resourceAttractionSystem!: ResourceAttractionSystem;
  @inject(TYPES.CrisisPredictorSystem)
  private crisisPredictorSystem!: CrisisPredictorSystem;
  @inject(TYPES.WorldGenerationService)
  private worldGenerationService!: WorldGenerationService;
  @inject(TYPES.AmbientAwarenessSystem)
  private ambientAwarenessSystem!: AmbientAwarenessSystem;
  @inject(TYPES.CardDialogueSystem)
  private cardDialogueSystem!: CardDialogueSystem;
  @inject(TYPES.EmergenceSystem) private emergenceSystem!: EmergenceSystem;
  @inject(TYPES.TimeSystem) private timeSystem!: TimeSystem;
  @inject(TYPES.InteractionGameSystem)
  private interactionGameSystem!: InteractionGameSystem;
  @inject(TYPES.KnowledgeNetworkSystem)
  private knowledgeNetworkSystem!: KnowledgeNetworkSystem;
  @inject(TYPES.MovementSystem) private movementSystem!: MovementSystem;
  @inject(TYPES.AppearanceGenerationSystem)
  private appearanceGenerationSystem!: AppearanceGenerationSystem;
  @inject(TYPES.GPUComputeService)
  private gpuComputeService!: GPUComputeService;

  private capturedEvents: SimulationEvent[] = [];
  private eventCaptureListener?: (eventName: string, payload: unknown) => void;
  private stateCache: StateCache;
  private deltaEncoder: DeltaEncoder;
  @inject(TYPES.EntityIndex) private entityIndex!: EntityIndex;
  @inject(TYPES.SharedSpatialIndex)
  private sharedSpatialIndex!: SharedSpatialIndex;

  private lastSnapshotTime = 0;
  private readonly SNAPSHOT_INTERVAL_MS = 250;

  private snapshotWorker?: Worker;
  private snapshotWorkerReady = false;

  private readonly INDEX_REBUILD_INTERVAL_FAST = 5;

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

    this.initializeSnapshotWorker();
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

    this.setupEventListeners();

    if (this.state.agents.length === 0) {
      const isa = this.lifeCycleSystem.spawnAgent({
        id: "isa",
        name: "Isa",
        sex: "female",
        ageYears: 25,
        lifeStage: "adult",
        generation: 0,
        immortal: true,
        traits: {
          cooperation: 0.8,
          aggression: 0.2,
          diligence: 0.7,
          curiosity: 0.9,
        },
      });

      const stev = this.lifeCycleSystem.spawnAgent({
        id: "stev",
        name: "Stev",
        sex: "male",
        ageYears: 27,
        lifeStage: "adult",
        generation: 0,
        immortal: true,
        traits: {
          cooperation: 0.7,
          aggression: 0.3,
          diligence: 0.8,
          curiosity: 0.8,
        },
      });

      this._genealogySystem.registerBirth(isa, undefined, undefined);
      this._genealogySystem.registerBirth(stev, undefined, undefined);

      const childNames = [
        { name: "Luna", sex: "female" as const },
        { name: "Sol", sex: "male" as const },
        { name: "Estrella", sex: "female" as const },
        { name: "Cielo", sex: "male" as const },
      ];

      for (const childData of childNames) {
        const child = this.lifeCycleSystem.spawnAgent({
          name: childData.name,
          sex: childData.sex,
          ageYears: 5,
          lifeStage: "child",
          generation: 1,
          parents: {
            father: stev.id,
            mother: isa.id,
          },
        });

        this._genealogySystem.registerBirth(child, stev.id, isa.id);
      }

      logger.info(`👨‍👩‍👧‍👦 Family initialized: Isa & Stev with 4 children`);

      this.createInitialInfrastructure();

      for (const agent of this.state.agents) {
        try {
          if (!agent.position) {
            agent.position = {
              x: (this.state.worldSize?.width ?? 128) * 16,
              y: (this.state.worldSize?.height ?? 128) * 16,
            };
          }
          if (!this.movementSystem.hasMovementState(agent.id)) {
            this.movementSystem.initializeEntityMovement(
              agent.id,
              agent.position,
            );
          }
        } catch (err) {
          logger.warn(
            `Failed to initialize movement state for agent ${agent.id}: ${err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }

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

        this.stateCache.markDirtyMultiple([
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
          "tasks",
        ]);

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
      minEntities: 15,
    });

    this.scheduler.registerSystem({
      name: "EmergenceSystem",
      rate: "SLOW",
      update: (delta: number) => this.emergenceSystem.update(delta),
      enabled: true,
      minEntities: 15,
    });

    this.scheduler.registerSystem({
      name: "KnowledgeNetworkSystem",
      rate: "SLOW",
      update: (delta: number) => this.knowledgeNetworkSystem.update(delta),
      enabled: true,
      minEntities: 10,
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
  private createInitialInfrastructure(): void {
    const baseX = 100;
    const baseY = 100;

    const houseZone: Zone = {
      id: `zone_house_initial_${Date.now()}`,
      type: "shelter",
      bounds: {
        x: baseX,
        y: baseY,
        width: 80,
        height: 60,
      },
      props: {
        capacity: 8,
        comfort: 0.7,
      },
      metadata: {
        building: "house" as BuildingLabel,
        underConstruction: false,
        buildingId: `building_house_initial_${Date.now()}`,
        builtAt: Date.now(),
      },
    };

    const workbenchZone: Zone = {
      id: `zone_workbench_initial_${Date.now()}`,
      type: "work",
      bounds: {
        x: baseX + 100,
        y: baseY,
        width: 40,
        height: 40,
      },
      props: {
        craftingSpeed: 1.2,
        toolQuality: 0.8,
      },
      metadata: {
        building: "workbench" as BuildingLabel,
        underConstruction: false,
        craftingStation: true,
        buildingId: `building_workbench_initial_${Date.now()}`,
        builtAt: Date.now(),
      },
    };

    const storageZone: Zone = {
      id: `zone_storage_initial_${Date.now()}`,
      type: "storage",
      bounds: {
        x: baseX + 100,
        y: baseY + 50,
        width: 40,
        height: 30,
      },
      props: {
        capacity: 200,
      },
      metadata: {
        buildingId: `building_storage_initial_${Date.now()}`,
        builtAt: Date.now(),
      },
    };

    const restZone: Zone = {
      id: `zone_rest_initial_${Date.now()}`,
      type: "rest",
      bounds: {
        x: baseX + 10,
        y: baseY + 10,
        width: 30,
        height: 40,
      },
      props: {
        restQuality: 0.8,
        beds: 6,
      },
      metadata: {
        parentZoneId: houseZone.id,
      },
    };

    const kitchenZone: Zone = {
      id: `zone_kitchen_initial_${Date.now()}`,
      type: "kitchen",
      bounds: {
        x: baseX + 45,
        y: baseY + 10,
        width: 25,
        height: 25,
      },
      props: {
        cookingSpeed: 1.0,
        foodCapacity: 50,
      },
      metadata: {
        parentZoneId: houseZone.id,
      },
    };

    this.state.zones.push(
      houseZone,
      workbenchZone,
      storageZone,
      restZone,
      kitchenZone,
    );

    logger.info(`🏠 Initial infrastructure created:`);
    logger.info(`   - Family house (shelter) at (${baseX}, ${baseY})`);
    logger.info(`   - Workbench at (${baseX + 100}, ${baseY})`);
    logger.info(`   - Storage zone`);
    logger.info(`   - Rest zone (inside house)`);
    logger.info(`   - Kitchen zone (inside house)`);
    logger.info(`📦 Starting resources: wood=50, stone=30, food=40, water=40`);
  }

  private setupEventListeners(): void {
    simulationEvents.on(
      GameEventNames.AGENT_ACTION_COMPLETE,
      (data: { agentId: string; action: string }) => {
        if (data.action === "birth") {
          const agent = this.entityIndex.getAgent(data.agentId);
          if (agent) {
            this._genealogySystem.registerBirth(
              agent,
              agent.parents?.father,
              agent.parents?.mother,
            );
          }
        }
      },
    );

    simulationEvents.on(
      GameEventNames.AGENT_BIRTH,
      (data: { entityId: string; parentIds: [string, string] | null }) => {
        const agent = this.entityIndex.getAgent(data.entityId);
        if (agent) {
          const fatherId = data.parentIds ? data.parentIds[0] : undefined;
          const motherId = data.parentIds ? data.parentIds[1] : undefined;
          this.appearanceGenerationSystem.generateAppearance(
            agent.id,
            agent,
            fatherId,
            motherId,
          );
        }
      },
    );

    simulationEvents.on(
      GameEventNames.COMBAT_KILL,
      (data: { targetId: string }) => {
        this._genealogySystem.recordDeath(data.targetId);
      },
    );

    simulationEvents.on(
      GameEventNames.AGENT_DEATH,
      (data: { entityId: string; reason?: string }) => {
        this.entityIndex.markEntityDead(data.entityId);
        this._genealogySystem.recordDeath(data.entityId);
        this.entityIndex.removeEntity(data.entityId);
      },
    );

    simulationEvents.on(
      GameEventNames.AGENT_RESPAWNED,
      (data: { agentId: string; timestamp: number }) => {
        this.aiSystem.setAgentOffDuty(data.agentId, false);

        const agent = this.entityIndex.getAgent(data.agentId);
        if (
          agent?.position &&
          !this.movementSystem.hasMovementState(data.agentId)
        ) {
          this.movementSystem.initializeEntityMovement(
            data.agentId,
            agent.position,
          );
        }
      },
    );

    simulationEvents.on(
      GameEventNames.ANIMAL_HUNTED,
      (data: { animalId: string; hunterId: string; foodValue?: number }) => {
        if (data.hunterId && data.foodValue) {
          const inventory = this.inventorySystem.getAgentInventory(
            data.hunterId,
          );
          if (inventory) {
            const foodToAdd = Math.floor(data.foodValue || 5);
            this.inventorySystem.addResource(data.hunterId, "food", foodToAdd);
          }
        }
      },
    );

    simulationEvents.on(
      GameEventNames.RESOURCE_GATHERED,
      (data: {
        resourceId: string;
        resourceType: string;
        harvesterId?: string;
        position?: { x: number; y: number };
      }) => {
        if (data.harvesterId) {
          this.questSystem.handleEvent({
            type: "resource_collected",
            entityId: data.harvesterId,
            timestamp: Date.now(),
            data: {
              resourceType: data.resourceType,
              amount: 1,
            },
          });
        }
      },
    );

    simulationEvents.on(
      GameEventNames.BUILDING_CONSTRUCTED,
      (data: {
        jobId: string;
        zoneId: string;
        label: string;
        completedAt: number;
      }) => {
        const job = this.buildingSystem.getConstructionJob(data.jobId);
        if (job?.taskId) {
          const task = this.taskSystem.getTask(job.taskId);
          if (task && task.contributors) {
            task.contributors.forEach((_contribution, agentId) => {
              this.questSystem.handleEvent({
                type: "structure_built",
                entityId: agentId,
                timestamp: Date.now(),
                data: {
                  structureType: data.label,
                },
              });
            });
          }
        }
      },
    );

    simulationEvents.on(
      GameEventNames.DIALOGUE_CARD_RESPONDED,
      (data: { cardId: string; choiceId: string }) => {
        const dialogueState = this.state.dialogueState;
        if (dialogueState?.active) {
          const card = dialogueState.active.find((c) => c.id === data.cardId);
          if (card && card.participants && card.participants.length > 0) {
            this.questSystem.handleEvent({
              type: "dialogue_completed",
              entityId: card.participants[0],
              timestamp: Date.now(),
              data: {
                cardId: data.cardId,
              },
            });
          }
        }
      },
    );

    simulationEvents.on(
      GameEventNames.NEED_CRITICAL,
      (data: { agentId: string; need: string; value: number }) => {
        const aiState = this.aiSystem.getAIState(data.agentId);
        if (aiState && !aiState.currentGoal) {
          this.aiSystem.forceGoalReevaluation(data.agentId);
        }
      },
    );

    simulationEvents.on(
      GameEventNames.PATHFINDING_FAILED,
      (data: {
        entityId: string;
        targetZoneId: string;
        reason: string;
        timestamp: number;
      }) => {
        const aiState = this.aiSystem.getAIState(data.entityId);
        if (aiState?.currentGoal?.targetZoneId === data.targetZoneId) {
          this.aiSystem.failCurrentGoal(data.entityId);
        }
      },
    );

    simulationEvents.on(
      GameEventNames.TASK_STALLED,
      (data: {
        taskId: string;
        taskType: string;
        zoneId?: string;
        stalledDuration: number;
        timestamp: number;
      }) => {
        const task = this.taskSystem.getTask(data.taskId);
        if (task?.contributors) {
          for (const agentId of task.contributors.keys()) {
            const aiState = this.aiSystem.getAIState(agentId);
            if (aiState?.currentGoal?.data?.taskId === data.taskId) {
              this.aiSystem.failCurrentGoal(agentId);
            }
          }
        }
      },
    );

    simulationEvents.on(
      GameEventNames.MOVEMENT_ARRIVED_AT_ZONE,
      (data: { entityId: string; zoneId: string }) => {
        this.aiSystem.notifyEntityArrived(data.entityId, data.zoneId);
      },
    );

    simulationEvents.on(
      GameEventNames.CRISIS_IMMEDIATE_WARNING,
      (_data: {
        prediction: {
          type: string;
          probability: number;
          severity: number;
          recommendedActions: string[];
        };
        timestamp: number;
      }) => {
        for (const agent of this.state.agents) {
          this.aiSystem.forceGoalReevaluation(agent.id);
        }
      },
    );

    simulationEvents.on(
      GameEventNames.CRISIS_PREDICTION,
      (data: {
        prediction: {
          type: string;
          probability: number;
          severity: number;
          recommendedActions: string[];
        };
        timestamp: number;
      }) => {
        if (data.prediction.probability >= 0.6) {
          const relevantAgents = this.state.agents.filter((agent) => {
            const role = this.roleSystem.getAgentRole(agent.id);
            if (!role) return false;
            return ["guard", "builder", "farmer", "gatherer"].includes(
              role.roleType,
            );
          });

          for (const agent of relevantAgents.slice(0, 3)) {
            this.aiSystem.forceGoalReevaluation(agent.id);
          }
        }
      },
    );

    simulationEvents.on(
      GameEventNames.BUILDING_CONSTRUCTION_STARTED,
      (data: {
        jobId: string;
        zoneId: string;
        label: string;
        completesAt: number;
      }) => {
        const job = this.buildingSystem.getConstructionJob(data.jobId);
        if (job?.taskId) {
          const task = this.taskSystem.getTask(job.taskId);
          if (task && task.contributors) {
            task.contributors.forEach((_contribution, agentId) => {
              this.questSystem.handleEvent({
                type: "structure_construction_started",
                entityId: agentId,
                timestamp: Date.now(),
                data: {
                  structureType: data.label,
                  jobId: data.jobId,
                },
              });
            });
          }
        }
      },
    );

    simulationEvents.on(
      GameEventNames.AGENT_AGED,
      (data: {
        entityId: string;
        newAge: number;
        previousStage: string;
        currentStage: string;
      }) => {
        const agent = this.entityIndex.getAgent(data.entityId);
        if (!agent) return;

        if (data.currentStage === "adult" && data.previousStage === "child") {
          const role = this.roleSystem.getAgentRole(data.entityId);
          if (!role) {
            this.roleSystem.assignBestRole(agent);
          }
          const house = this.householdSystem.getHouseFor(data.entityId);
          if (!house) {
            this.householdSystem.assignToHouse(data.entityId, "other");
          }
        }
        if (data.currentStage === "elder") {
          const role = this.roleSystem.getAgentRole(data.entityId);
          if (role) {
            const physicalRoles = ["logger", "quarryman", "builder", "guard"];
            if (physicalRoles.includes(role.roleType)) {
              const agent = this.entityIndex.getAgent(data.entityId);
              if (agent) {
                this.roleSystem.reassignRole(data.entityId, "gatherer");
              }
            }
          }
        }
      },
    );

    simulationEvents.on(
      GameEventNames.TIME_CHANGED,
      (data: {
        time: {
          phase: string;
          hour: number;
          temperature: number;
        };
        timestamp: number;
      }) => {
        const period = data.time?.phase || "";
        if (period === "night" || period === "deep_night") {
          for (const agent of this.state.agents) {
            const aiState = this.aiSystem.getAIState(agent.id);
            if (aiState && !aiState.currentGoal && !aiState.offDuty) {
              const needs = this.needsSystem.getNeeds(agent.id);
              if (needs && needs.energy < 70) {
                this.aiSystem.forceGoalReevaluation(agent.id);
              }
            }
          }
        }
      },
    );

    simulationEvents.on(
      GameEventNames.TASK_COMPLETED,
      (data: {
        taskId: string;
        completedBy: string[];
        completedAt: number;
        timestamp: number;
        cancelled?: boolean;
        reason?: string;
      }) => {
        if (data.cancelled) return;

        for (const agentId of data.completedBy) {
          this.reputationSystem.updateReputation(
            agentId,
            0.05,
            "task_completed",
          );
        }

        for (const agentId of data.completedBy) {
          this.questSystem.handleEvent({
            type: "task_completed",
            entityId: agentId,
            timestamp: data.timestamp,
            data: { taskId: data.taskId },
          });
        }
      },
    );

    simulationEvents.on(
      GameEventNames.KNOWLEDGE_LEARNED,
      (data: {
        agentId: string;
        knowledgeId: string;
        knowledgeType: string;
        timestamp: number;
      }) => {
        const aiState = this.aiSystem.getAIState(data.agentId);
        if (aiState) {
          if (!aiState.memory.knownResourceLocations) {
            aiState.memory.knownResourceLocations = new Map();
          }
          aiState.memory.lastMemoryCleanup = Date.now();
        }
        this.aiSystem.forceGoalReevaluation(data.agentId);
      },
    );

    simulationEvents.on(
      GameEventNames.ROLE_ASSIGNED,
      (data: {
        agentId: string;
        roleType: string;
        roleId?: string;
        timestamp: number;
      }) => {
        if (data.roleType === "leader" || data.roleType === "guard") {
          this.reputationSystem.updateReputation(
            data.agentId,
            0.1,
            `role_assigned_${data.roleType}`,
          );
        }
      },
    );

    simulationEvents.on(
      GameEventNames.NORM_SANCTION_APPLIED,
      (data: {
        agentId: string;
        violationType: string;
        reputationPenalty: number;
        trustPenalty?: number;
        truceDuration?: number;
        timestamp: number;
      }) => {
        this.reputationSystem.updateReputation(
          data.agentId,
          data.reputationPenalty,
          `norm_violation_${data.violationType}`,
        );
      },
    );

    simulationEvents.on(
      GameEventNames.CONFLICT_TRUCE_ACCEPTED,
      (data: {
        cardId: string;
        attackerId: string;
        targetId: string;
        truceBonus?: number;
        timestamp: number;
      }) => {
        this.socialSystem.modifyAffinity(
          data.attackerId,
          data.targetId,
          data.truceBonus || 0.1,
        );
        this.reputationSystem.updateReputation(
          data.targetId,
          0.02,
          "truce_accepted",
        );
      },
    );

    simulationEvents.on(
      GameEventNames.CONFLICT_TRUCE_REJECTED,
      (data: {
        cardId: string;
        attackerId: string;
        targetId: string;
        timestamp: number;
      }) => {
        this.socialSystem.modifyAffinity(data.attackerId, data.targetId, -0.15);
      },
    );

    simulationEvents.on(
      GameEventNames.COMBAT_HIT,
      (data: {
        attackerId: string;
        targetId: string;
        damage: number;
        weaponId?: string;
        timestamp: number;
      }) => {
        this.needsSystem.modifyNeed(data.targetId, "energy", -5);
        this.socialSystem.modifyAffinity(data.attackerId, data.targetId, -0.2);
      },
    );

    simulationEvents.on(
      GameEventNames.TASK_CREATED,
      (data: {
        taskId: string;
        taskType: string;
        zoneId?: string;
        createdBy?: string;
        timestamp: number;
      }) => {
        if (data.taskType === "build" || data.taskType === "repair") {
          this.questSystem.handleEvent({
            type: "task_created",
            entityId: data.createdBy || "system",
            timestamp: data.timestamp,
            data: { taskId: data.taskId, taskType: data.taskType },
          });
        }
      },
    );

    simulationEvents.on(
      GameEventNames.TASK_PROGRESS,
      (data: {
        taskId: string;
        agentId: string;
        contribution: number;
        progress: number;
        timestamp: number;
      }) => {
        const task = this.taskSystem.getTask(data.taskId);
        if (task && task.contributors) {
          const contributorCount = task.contributors.size;
          if (contributorCount > 1 && data.contribution > 10) {
            this.reputationSystem.updateReputation(
              data.agentId,
              0.01,
              "collaborative_work",
            );
          }
        }
      },
    );

    simulationEvents.on(
      GameEventNames.BUILDING_REPAIRED,
      (data: {
        zoneId: string;
        buildingType: string;
        repairedBy: string;
        health: number;
        maxHealth: number;
        timestamp: number;
      }) => {
        this.reputationSystem.updateReputation(
          data.repairedBy,
          0.03,
          "building_repaired",
        );
      },
    );

    const eventCaptureListener = (
      eventName: string,
      payload: unknown,
    ): void => {
      const mappedEventName = mapEventName(eventName);
      this.capturedEvents.push({
        type: mappedEventName,
        payload: payload as SimulationEventPayload | undefined,
        timestamp: Date.now(),
      });
    };
    this.eventCaptureListener = eventCaptureListener;

    Object.values(GameEventNames).forEach((eventName) => {
      simulationEvents.on(eventName, (payload: unknown) => {
        if (this.eventCaptureListener) {
          this.eventCaptureListener(eventName, payload);
        }
      });
    });
  }

  public async initializeWorldResources(worldConfig: {
    width: number;
    height: number;
    tileSize: number;
    biomeMap: string[][];
  }): Promise<void> {
    logger.info(
      `Generating initial world ${worldConfig.width}x${worldConfig.height}...`,
    );

    const CHUNK_SIZE = 16;
    const chunksX = Math.ceil(worldConfig.width / CHUNK_SIZE);
    const chunksY = Math.ceil(worldConfig.height / CHUNK_SIZE);
    const allTiles: Array<{
      x: number;
      y: number;
      assetId: string;
      type: "grass" | "stone" | "water" | "path";
      biome: string;
      isWalkable: boolean;
    }> = [];

    const biomeMap: string[][] = Array(worldConfig.height)
      .fill(null)
      .map((): string[] => {
        return Array(worldConfig.width).fill("") as string[];
      });

    for (let cy = 0; cy < chunksY; cy++) {
      for (let cx = 0; cx < chunksX; cx++) {
        const chunkTiles = await this.worldGenerationService.generateChunk(
          cx,
          cy,
          {
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
          },
        );

        for (const row of chunkTiles) {
          for (const tile of row) {
            if (tile.x < worldConfig.width && tile.y < worldConfig.height) {
              const tileType: "grass" | "stone" | "water" | "path" =
                tile.biome === BiomeType.OCEAN ? "water" : "grass";
              allTiles.push({
                x: tile.x,
                y: tile.y,
                assetId: tile.assets.terrain,
                type: tileType,
                biome: String(tile.biome),
                isWalkable: tile.isWalkable ?? true,
              });
              biomeMap[tile.y][tile.x] = String(tile.biome);
            }
          }
        }
      }
    }

    this.state.terrainTiles = allTiles;
    this.state.worldSize = {
      width: worldConfig.width,
      height: worldConfig.height,
    };
    logger.info(`Generated ${allTiles.length} terrain tiles.`);

    this.worldResourceSystem.spawnResourcesInWorld({
      ...worldConfig,
      biomeMap,
    });

    this.animalSystem.spawnAnimalsInWorld(
      worldConfig.width,
      worldConfig.height,
      worldConfig.tileSize,
      biomeMap,
    );

    this.generateFunctionalZones(worldConfig, biomeMap);
  }

  private generateFunctionalZones(
    worldConfig: {
      width: number;
      height: number;
      tileSize: number;
    },
    biomeMap: string[][],
  ): void {
    if (!this.state.zones) {
      this.state.zones = [];
    }

    const ZONE_SPACING = 300;
    const ZONE_SIZE = 120;
    const zones: Zone[] = [];

    for (let x = ZONE_SPACING; x < worldConfig.width; x += ZONE_SPACING) {
      for (let y = ZONE_SPACING; y < worldConfig.height; y += ZONE_SPACING) {
        const tileX = Math.floor(x / worldConfig.tileSize);
        const tileY = Math.floor(y / worldConfig.tileSize);

        if (
          tileY >= 0 &&
          tileY < biomeMap.length &&
          tileX >= 0 &&
          tileX < biomeMap[0].length
        ) {
          const biome = biomeMap[tileY][tileX];

          if (biome === "ocean" || biome === "lake") continue;

          const zoneType = this.determineZoneType(biome, x, y, worldConfig);
          if (!zoneType) continue;

          const zoneId = `zone_${zoneType}_${x}_${y}`;
          const zone: Zone = {
            id: zoneId,
            type: zoneType,
            bounds: {
              x: Math.max(0, x - ZONE_SIZE / 2),
              y: Math.max(0, y - ZONE_SIZE / 2),
              width: ZONE_SIZE,
              height: ZONE_SIZE,
            },
            props: {
              color: this.getZoneColor(zoneType),
              status: "ready",
            },
          };

          zones.push(zone);
        }
      }
    }

    this.state.zones.push(...zones);
    logger.info(`Generated ${zones.length} functional zones`);
  }

  private determineZoneType(
    biome: string,
    x: number,
    y: number,
    worldConfig: { width: number; height: number },
  ): string | null {
    const seed = x * 1000 + y;
    const rng = (): number => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    const centerX = worldConfig.width / 2;
    const centerY = worldConfig.height / 2;
    const distFromCenter = Math.hypot(x - centerX, y - centerY);
    const isNearCenter = distFromCenter < worldConfig.width * 0.3;

    if (isNearCenter && rng() < 0.3) {
      return "social";
    }

    if (biome === "forest" && rng() < 0.4) {
      return "rest";
    }

    if (biome === "grassland" && rng() < 0.3) {
      return "work";
    }

    const rand = rng();
    if (rand < 0.25) return "rest";
    if (rand < 0.5) return "work";
    if (rand < 0.7) return "food";
    if (rand < 0.85) return "water";
    return "social";
  }

  private getZoneColor(zoneType: string): string {
    const colors: Record<string, string> = {
      rest: "#8B7355",
      work: "#6B8E23",
      food: "#FF6347",
      water: "#4682B4",
      social: "#9370DB",
      crafting: "#CD853F",
    };
    return colors[zoneType] || "#C4B998";
  }

  /**
   * Starts the simulation using the multi-rate scheduler.
   */
  start(): void {
    if (!this.scheduler) {
      logger.error("⚠️ Scheduler not initialized, cannot start simulation");
      return;
    }

    logger.info("🔄 SimulationRunner: Starting simulation scheduler...");
    this.scheduler.start();
    logger.info("🚀 Multi-rate simulation started", {
      rates: { FAST: "50ms", MEDIUM: "250ms", SLOW: "1000ms" },
      agentsCount: this.state.agents.length,
    });
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

    if (this.snapshotWorker) {
      this.snapshotWorker.postMessage({ type: "shutdown" });
      this.snapshotWorker.terminate();
      this.snapshotWorker = undefined;
      this.snapshotWorkerReady = false;
    }
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
}
