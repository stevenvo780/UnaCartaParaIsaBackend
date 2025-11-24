import { EventEmitter } from "node:events";
import type { GameResources, GameState } from "../../types/game-types";
import { cloneGameState, createInitialGameState } from "./defaultState";
import { worldGenerationService } from "../../../infrastructure/services/world/worldGenerationService";
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
import { CombatSystem } from "../systems/CombatSystem";
import { ResourceAttractionSystem } from "../systems/ResourceAttractionSystem";
import { CrisisPredictorSystem } from "../systems/CrisisPredictorSystem";
import { AmbientAwarenessSystem } from "../systems/AmbientAwarenessSystem";
import { CardDialogueSystem } from "../systems/CardDialogueSystem";
import { EmergenceSystem } from "../systems/EmergenceSystem";
import { TimeSystem } from "../systems/TimeSystem";
import { InteractionGameSystem } from "../systems/InteractionGameSystem";
import { KnowledgeNetworkSystem } from "../systems/KnowledgeNetworkSystem";
import type {
  SimulationCommand,
  SimulationConfig,
  SimulationSnapshot,
  SimulationEvent,
} from "../../../shared/types/commands/SimulationCommand";
import type { NeedsConfig } from "../../types/simulation/needs";
import type { TaskType } from "../../types/simulation/tasks";

interface SimulationEventMap {
  tick: SimulationSnapshot;
  commandRejected: SimulationCommand;
}

export class SimulationRunner {
  private state: GameState;
  private readonly emitter = new EventEmitter();
  private readonly commands: SimulationCommand[] = [];
  private readonly tickIntervalMs: number;
  private readonly maxCommandQueue: number;
  private tickHandle?: NodeJS.Timeout;
  private tickCounter = 0;
  private lastUpdate = Date.now();
  private timeScale = 1;
  private worldResourceSystem: WorldResourceSystem;
  private livingLegendsSystem: LivingLegendsSystem;
  private lifeCycleSystem: LifeCycleSystem;
  private needsSystem: NeedsSystem;
  // GenealogySystem is event-driven and initialized for event handling
  private readonly _genealogySystem: GenealogySystem;
  private socialSystem: SocialSystem;
  private inventorySystem: InventorySystem;
  private economySystem: EconomySystem;
  private marketSystem: MarketSystem;
  private roleSystem: RoleSystem;
  private aiSystem: AISystem;
  private resourceReservationSystem: ResourceReservationSystem;
  private governanceSystem: GovernanceSystem;
  private divineFavorSystem: DivineFavorSystem;
  private householdSystem: HouseholdSystem;
  private buildingSystem: BuildingSystem;
  private buildingMaintenanceSystem: BuildingMaintenanceSystem;
  private productionSystem: ProductionSystem;
  private enhancedCraftingSystem: EnhancedCraftingSystem;
  private animalSystem: AnimalSystem;
  private itemGenerationSystem: ItemGenerationSystem;
  private combatSystem: CombatSystem;
  private reputationSystem: ReputationSystem;
  private _researchSystem: ResearchSystem;
  private _recipeDiscoverySystem: RecipeDiscoverySystem;
  private questSystem: QuestSystem;
  private taskSystem: TaskSystem;
  private tradeSystem: TradeSystem;
  private marriageSystem: MarriageSystem;
  private conflictResolutionSystem: ConflictResolutionSystem;
  private _normsSystem: NormsSystem;
  private resourceAttractionSystem: ResourceAttractionSystem;
  private crisisPredictorSystem: CrisisPredictorSystem;
  private ambientAwarenessSystem: AmbientAwarenessSystem;
  private cardDialogueSystem: CardDialogueSystem;
  private emergenceSystem: EmergenceSystem;
  private timeSystem: TimeSystem;
  private interactionGameSystem: InteractionGameSystem;
  private knowledgeNetworkSystem: KnowledgeNetworkSystem;
  private capturedEvents: SimulationEvent[] = [];
  private eventCaptureListener?: (eventName: string, payload: unknown) => void;

  constructor(config?: Partial<SimulationConfig>, initialState?: GameState) {
    this.state = initialState ?? createInitialGameState();
    this.tickIntervalMs = config?.tickIntervalMs ?? 200;
    this.maxCommandQueue = config?.maxCommandQueue ?? 200;
    this.worldResourceSystem = new WorldResourceSystem(this.state);
    this.livingLegendsSystem = new LivingLegendsSystem(this.state);
    this.lifeCycleSystem = new LifeCycleSystem(this.state);
    this.needsSystem = new NeedsSystem(this.state, this.lifeCycleSystem);
    this._genealogySystem = new GenealogySystem(this.state);

    // Connect genealogy system to lifecycle events
    simulationEvents.on(
      GameEventNames.AGENT_ACTION_COMPLETE,
      (data: { agentId: string; action: string }) => {
        if (data.action === "birth") {
          const agent = this.state.agents.find((a) => a.id === data.agentId);
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
      GameEventNames.COMBAT_KILL,
      (data: { targetId: string }) => {
        this._genealogySystem.recordDeath(data.targetId);
      },
    );
    this.socialSystem = new SocialSystem(this.state);
    this.inventorySystem = new InventorySystem(this.state);
    this.resourceReservationSystem = new ResourceReservationSystem(
      this.state,
      this.inventorySystem,
    );
    this.divineFavorSystem = new DivineFavorSystem();
    this.governanceSystem = new GovernanceSystem(
      this.state,
      this.inventorySystem,
      this.lifeCycleSystem,
      this.divineFavorSystem,
      this.resourceReservationSystem,
    );
    this.economySystem = new EconomySystem(
      this.state,
      this.inventorySystem,
      this.socialSystem,
      this.lifeCycleSystem,
    );
    this.marketSystem = new MarketSystem(
      this.state,
      this.inventorySystem,
      this.lifeCycleSystem,
    );
    this.roleSystem = new RoleSystem(this.state);
    this.aiSystem = new AISystem(this.state, undefined, {
      needsSystem: this.needsSystem,
      roleSystem: this.roleSystem,
      worldResourceSystem: this.worldResourceSystem,
    });

    this.householdSystem = new HouseholdSystem(this.state);
    this.buildingMaintenanceSystem = new BuildingMaintenanceSystem(
      this.state,
      this.inventorySystem,
    );
    this.buildingSystem = new BuildingSystem(
      this.state,
      this.resourceReservationSystem,
    );
    this.productionSystem = new ProductionSystem(
      this.state,
      this.inventorySystem,
      this.lifeCycleSystem,
    );
    this.enhancedCraftingSystem = new EnhancedCraftingSystem(
      this.state,
      this.inventorySystem,
    );
    this.animalSystem = new AnimalSystem(this.state, this.worldResourceSystem);
    this.itemGenerationSystem = new ItemGenerationSystem(this.state);
    this.combatSystem = new CombatSystem(
      this.state,
      this.inventorySystem,
      this.lifeCycleSystem,
      this.socialSystem,
    );
    this.reputationSystem = new ReputationSystem(this.state);
    this._researchSystem = new ResearchSystem(this.state);
    this._recipeDiscoverySystem = new RecipeDiscoverySystem(this.state);
    this.questSystem = new QuestSystem(this.state);
    this.taskSystem = new TaskSystem(this.state);
    this.tradeSystem = new TradeSystem(this.state);
    this.marriageSystem = new MarriageSystem(this.state);
    this.conflictResolutionSystem = new ConflictResolutionSystem(this.state);
    this._normsSystem = new NormsSystem(this.state);
    this.resourceAttractionSystem = new ResourceAttractionSystem(
      this.state,
      this.needsSystem,
    );
    this.crisisPredictorSystem = new CrisisPredictorSystem(
      this.state,
      this.needsSystem,
    );
    this.ambientAwarenessSystem = new AmbientAwarenessSystem(
      this.state,
      this.needsSystem,
    );
    this.cardDialogueSystem = new CardDialogueSystem(
      this.state,
      this.needsSystem,
      this.socialSystem,
      this.questSystem,
    );
    this.timeSystem = new TimeSystem(this.state);
    this.emergenceSystem = new EmergenceSystem(this.state, undefined, {
      needsSystem: this.needsSystem,
      socialSystem: this.socialSystem,
      lifeCycleSystem: this.lifeCycleSystem,
      economySystem: this.economySystem,
    });
    this.interactionGameSystem = new InteractionGameSystem(this.state);
    this.knowledgeNetworkSystem = new KnowledgeNetworkSystem(this.state);

    // Setup event capture for snapshot - add listeners for all known events
    const eventCaptureListener = (
      eventName: string,
      payload: unknown,
    ): void => {
      this.capturedEvents.push({
        type: eventName,
        payload,
        timestamp: Date.now(),
      });
    };
    this.eventCaptureListener = eventCaptureListener;

    // Add listeners for all game events to capture them
    Object.values(GameEventNames).forEach((eventName) => {
      simulationEvents.on(eventName, (payload: unknown) => {
        if (this.eventCaptureListener) {
          this.eventCaptureListener(eventName, payload);
        }
      });
    });

    // Spawn initial agents if none exist
    if (this.state.agents.length === 0) {
      this.lifeCycleSystem.spawnAgent({
        requestId: "isa",
        name: "Isa",
        sex: "female",
        traits: {
          cooperation: 0.8,
          aggression: 0.2,
          diligence: 0.7,
          curiosity: 0.9,
        },
      });

      this.lifeCycleSystem.spawnAgent({
        requestId: "stev",
        name: "Stev",
        sex: "male",
        traits: {
          cooperation: 0.7,
          aggression: 0.3,
          diligence: 0.8,
          curiosity: 0.8,
        },
      });
    }
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

    // Initialize biome map structure
    const biomeMap: string[][] = Array(worldConfig.height)
      .fill(null)
      .map((): string[] => {
        return Array(worldConfig.width).fill("") as string[];
      });

    for (let cy = 0; cy < chunksY; cy++) {
      for (let cx = 0; cx < chunksX; cx++) {
        const chunkTiles = await worldGenerationService.generateChunk(cx, cy, {
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

        // Process chunk tiles
        for (const row of chunkTiles) {
          for (const tile of row) {
            // Ensure we don't go out of bounds if world size isn't a multiple of chunk size
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
              biomeMap[tile.y][tile.x] = tile.biome;
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

    // Spawn resources using the generated biome map
    this.worldResourceSystem.spawnResourcesInWorld({
      ...worldConfig,
      biomeMap,
    });
  }

  start(): void {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => this.step(), this.tickIntervalMs);
  }

  stop(): void {
    if (!this.tickHandle) return;
    clearInterval(this.tickHandle);
    this.tickHandle = undefined;
  }

  on<K extends keyof SimulationEventMap>(
    event: K,
    listener: (payload: SimulationEventMap[K]) => void,
  ): void {
    this.emitter.on(event, listener as (payload: unknown) => void);
  }

  off<K extends keyof SimulationEventMap>(
    event: K,
    listener: (payload: SimulationEventMap[K]) => void,
  ): void {
    this.emitter.off(event, listener as (payload: unknown) => void);
  }

  enqueueCommand(command: SimulationCommand): boolean {
    if (this.commands.length >= this.maxCommandQueue) {
      this.emitter.emit("commandRejected", command);
      return false;
    }
    this.commands.push(command);
    return true;
  }

  getSnapshot(): SimulationSnapshot {
    const events =
      this.capturedEvents.length > 0 ? [...this.capturedEvents] : undefined;
    const snapshotState = cloneGameState(this.state);
    snapshotState.genealogy = this._genealogySystem.getSerializedFamilyTree();

    // Include legends data in snapshot
    const allLegends = this.livingLegendsSystem.getAllLegends();
    const activeLegends = this.livingLegendsSystem.getActiveLegends();
    snapshotState.legends = {
      records: allLegends,
      activeLegends,
    };

    return {
      state: snapshotState,
      tick: this.tickCounter,
      updatedAt: this.lastUpdate,
      events,
    };
  }

  private step(): void {
    const now = Date.now();
    const delta = now - this.lastUpdate;
    this.lastUpdate = now;

    this.processCommands();
    const scaledDelta = delta * this.timeScale;

    this.advanceSimulation(scaledDelta);
    this.worldResourceSystem.update(scaledDelta);
    this.livingLegendsSystem.update(scaledDelta);
    this.lifeCycleSystem.update(scaledDelta);
    this.needsSystem.update(scaledDelta);
    this.socialSystem.update(scaledDelta);
    this.inventorySystem.update();
    this.resourceReservationSystem.update();
    this.economySystem.update(scaledDelta);
    this.marketSystem.update(scaledDelta);
    this.roleSystem.update(scaledDelta);
    this.aiSystem.update(scaledDelta);
    this.divineFavorSystem.update(scaledDelta);
    this.governanceSystem.update(scaledDelta);
    this.householdSystem.update(scaledDelta);
    this.buildingSystem.update(scaledDelta);
    this.buildingMaintenanceSystem.update(scaledDelta);
    this.productionSystem.update(scaledDelta);
    this.enhancedCraftingSystem.update();
    this.animalSystem.update(scaledDelta);
    this.itemGenerationSystem.update(scaledDelta);
    this.combatSystem.update(scaledDelta);
    this.reputationSystem.update();
    this.questSystem.update();
    this.taskSystem.update();
    this.tradeSystem.update();
    this.marriageSystem.update();
    this.conflictResolutionSystem.update();
    this.resourceAttractionSystem.update(scaledDelta);
    this.crisisPredictorSystem.update(scaledDelta);
    this.ambientAwarenessSystem.update(scaledDelta);
    this.cardDialogueSystem.update(scaledDelta);
    this.timeSystem.update(scaledDelta);
    this.emergenceSystem.update(scaledDelta);
    this.interactionGameSystem.update(scaledDelta);
    this.knowledgeNetworkSystem.update(scaledDelta);
    this._researchSystem.update();
    this._recipeDiscoverySystem.update();
    this._normsSystem.update();

    this.tickCounter += 1;
    const snapshot = this.getSnapshot();
    this.emitter.emit("tick", snapshot);

    // Clear captured events after snapshot
    this.capturedEvents = [];
  }

  private processCommands(): void {
    while (this.commands.length > 0) {
      const command = this.commands.shift();
      if (!command) break;
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
        case "SPAWN_AGENT":
          this.lifeCycleSystem.spawnAgent(command.payload);
          break;
        case "KILL_AGENT":
          this.lifeCycleSystem.killAgent(command.agentId);
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
        case "PING":
        default:
          break;
      }
    }
  }

  private handleNeedsCommand(
    command: Extract<SimulationCommand, { type: "NEEDS_COMMAND" }>,
  ): void {
    const payload = command.payload as Record<string, unknown>;
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
    const payload = command.payload as Record<string, unknown>;
    switch (command.command) {
      case "TEACH_RECIPE":
        if (payload.agentId && payload.recipeId) {
          this._recipeDiscoverySystem.teachRecipe(
            payload.agentId as string,
            payload.recipeId as string,
          );
        }
        break;
      case "SHARE_RECIPE":
        if (payload.teacherId && payload.studentId && payload.recipeId) {
          this._recipeDiscoverySystem.shareRecipe(
            payload.teacherId as string,
            payload.studentId as string,
            payload.recipeId as string,
          );
        }
        break;
    }
  }

  private handleSocialCommand(
    command: Extract<SimulationCommand, { type: "SOCIAL_COMMAND" }>,
  ): void {
    const payload = command.payload as Record<string, unknown>;
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
          // Mejorar afinidad entre agentes
          this.socialSystem.modifyAffinity(
            payload.agentA as string,
            payload.agentB as string,
            (payload.magnitude as number) || 0.1,
          );
          // También puede iniciar una interacción de juego
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
          // Empeorar afinidad entre agentes
          this.socialSystem.modifyAffinity(
            payload.agentA as string,
            payload.agentB as string,
            -(payload.magnitude as number) || -0.1,
          );
          // También puede iniciar una interacción de juego hostil
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
    const payload = command.payload as Record<string, unknown>;
    switch (command.command) {
      case "INITIALIZE_LINEAGE":
        if (payload.lineageId) {
          this._researchSystem.initializeLineage(payload.lineageId as string);
        }
        break;
      case "RECIPE_DISCOVERED":
        if (payload.lineageId && payload.recipeId && payload.discoveredBy) {
          this._researchSystem.onRecipeDiscovered(
            payload.lineageId as string,
            payload.recipeId as string,
            payload.discoveredBy as string,
          );
        }
        break;
    }
  }

  private handleWorldResourceCommand(
    command: Extract<SimulationCommand, { type: "WORLD_RESOURCE_COMMAND" }>,
  ): void {
    const payload = command.payload as Record<string, unknown>;
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
    const payload = command.payload as Record<string, unknown>;
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
    const payload = command.payload as Record<string, unknown>;
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
    }
  }

  private handleReputationCommand(
    command: Extract<SimulationCommand, { type: "REPUTATION_COMMAND" }>,
  ): void {
    const payload = command.payload as Record<string, unknown>;
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
    const payload = command.payload as Record<string, unknown>;
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
            metadata: payload.metadata as Record<string, unknown> | undefined,
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

    // Simple cycle counter until real systems hook in
    this.state.cycles += 1;

    // Decay / regen stub for resources
    if (this.state.resources) {
      const regenRate = deltaMs / 1000;
      this.state.resources.energy = Math.min(
        100,
        this.state.resources.energy + regenRate * 0.1,
      );
    }
  }
}
