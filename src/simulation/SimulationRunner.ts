import { EventEmitter } from "node:events";
import type { GameResources, GameState } from "../types/game-types.js";
import { cloneGameState, createInitialGameState } from "./defaultState.js";
import { worldGenerationService } from "../services/worldGenerationService.js";
import { BiomeType } from "../generation/types.js";
import { WorldResourceSystem } from "./systems/WorldResourceSystem.js";
import { LivingLegendsSystem } from "./systems/LivingLegendsSystem.js";
import { LifeCycleSystem } from "./systems/LifeCycleSystem.js";
import { NeedsSystem } from "./systems/NeedsSystem.js";
import { GenealogySystem } from "./systems/GenealogySystem.js";
import { SocialSystem } from "./systems/SocialSystem.js";
import { InventorySystem } from "./systems/InventorySystem.js";
import { EconomySystem } from "./systems/EconomySystem.js";
import { MarketSystem } from "./systems/MarketSystem.js";
import { RoleSystem } from "./systems/RoleSystem.js";
import { AISystem } from "./systems/AISystem.js";
import { ResourceReservationSystem } from "./systems/ResourceReservationSystem.js";
import { GovernanceSystem } from "./systems/GovernanceSystem.js";
import { DivineFavorSystem } from "./systems/DivineFavorSystem.js";
import { HouseholdSystem } from './systems/HouseholdSystem.js';
import { BuildingSystem } from "./systems/BuildingSystem.js";
import { BuildingMaintenanceSystem } from "./systems/BuildingMaintenanceSystem.js";
import { ProductionSystem } from "./systems/ProductionSystem.js";
import { EnhancedCraftingSystem } from "./systems/EnhancedCraftingSystem.js";
import { CraftingSystem } from "./systems/CraftingSystem.js";
import { AnimalSystem } from "./systems/AnimalSystem.js";
import { ItemGenerationSystem } from "./systems/ItemGenerationSystem.js";
import { ReputationSystem } from "./systems/ReputationSystem.js";
import { ResearchSystem } from "./systems/ResearchSystem.js";
import { RecipeDiscoverySystem } from "./systems/RecipeDiscoverySystem.js";
import { QuestSystem } from "./systems/QuestSystem.js";
import { TaskSystem } from "./systems/TaskSystem.js";
import { TradeSystem } from "./systems/TradeSystem.js";
import { MarriageSystem } from "./systems/MarriageSystem.js";
import { ConflictResolutionSystem } from "./systems/ConflictResolutionSystem.js";
import { NormsSystem } from "./systems/NormsSystem.js";
import { simulationEvents, GameEventNames } from "./events.js";
import { CombatSystem } from "./systems/CombatSystem.js";
import { ResourceAttractionSystem } from "./systems/ResourceAttractionSystem.js";
import { CrisisPredictorSystem } from "./systems/CrisisPredictorSystem.js";
import { AmbientAwarenessSystem } from "./systems/AmbientAwarenessSystem.js";
import { CardDialogueSystem } from "./systems/CardDialogueSystem.js";
import { EmergenceSystem } from "./systems/EmergenceSystem.js";
import { TimeSystem } from "./systems/TimeSystem.js";
import { InteractionGameSystem } from "./systems/InteractionGameSystem.js";
import { KnowledgeNetworkSystem } from "./systems/KnowledgeNetworkSystem.js";
import type {
  SimulationCommand,
  SimulationConfig,
  SimulationSnapshot,
  SimulationEvent,
} from "./types.js";

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
  // @ts-expect-error - System is event-driven, not used in tick loop
  private _genealogySystem: GenealogySystem;
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
  // @ts-expect-error - System is event-driven, not used in tick loop
  private _craftingSystem: CraftingSystem;
  private animalSystem: AnimalSystem;
  private itemGenerationSystem: ItemGenerationSystem;
  private combatSystem: CombatSystem;
  private reputationSystem: ReputationSystem;
  // @ts-expect-error - System is event-driven, not used in tick loop
  private _researchSystem: ResearchSystem;
  // @ts-expect-error - System is event-driven, not used in tick loop
  private _recipeDiscoverySystem: RecipeDiscoverySystem;
  private questSystem: QuestSystem;
  private taskSystem: TaskSystem;
  private tradeSystem: TradeSystem;
  private marriageSystem: MarriageSystem;
  private conflictResolutionSystem: ConflictResolutionSystem;
  // @ts-expect-error - System is event-driven, not used in tick loop
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
    this.socialSystem = new SocialSystem(this.state);
    this.inventorySystem = new InventorySystem();
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
      this.lifeCycleSystem
    );
    this.marketSystem = new MarketSystem(
      this.state,
      this.inventorySystem,
      this.lifeCycleSystem
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
    this._craftingSystem = new CraftingSystem(
      this.state,
      this.enhancedCraftingSystem,
    );
    this.animalSystem = new AnimalSystem(
      this.state,
      this.worldResourceSystem,
    );
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
    );
    this.timeSystem = new TimeSystem(this.state);
    this.emergenceSystem = new EmergenceSystem(
      this.state,
      undefined,
      {
        needsSystem: this.needsSystem,
        socialSystem: this.socialSystem,
        lifeCycleSystem: this.lifeCycleSystem,
        economySystem: this.economySystem,
      }
    );
    this.interactionGameSystem = new InteractionGameSystem(this.state);
    this.knowledgeNetworkSystem = new KnowledgeNetworkSystem(this.state);

    // Setup event capture for snapshot - add listeners for all known events
    const eventCaptureListener = (eventName: string, payload: unknown) => {
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

  public async initializeWorldResources(worldConfig: { width: number; height: number; tileSize: number; biomeMap: string[][] }): Promise<void> {
    console.log(`Generating initial world ${worldConfig.width}x${worldConfig.height}...`);

    const CHUNK_SIZE = 16;
    const chunksX = Math.ceil(worldConfig.width / CHUNK_SIZE);
    const chunksY = Math.ceil(worldConfig.height / CHUNK_SIZE);
    const allTiles = [];

    // Initialize biome map structure
    const biomeMap: string[][] = Array(worldConfig.height).fill(null).map(() => Array(worldConfig.width).fill(""));

    for (let cy = 0; cy < chunksY; cy++) {
      for (let cx = 0; cx < chunksX; cx++) {
        const chunkTiles = await worldGenerationService.generateChunk(cx, cy, {
          width: worldConfig.width,
          height: worldConfig.height,
          tileSize: worldConfig.tileSize,
          seed: 12345,
          noise: {
            temperature: { scale: 0.0005, octaves: 4, persistence: 0.5, lacunarity: 2.0 },
            moisture: { scale: 0.0005, octaves: 3, persistence: 0.6, lacunarity: 2.0 },
            elevation: { scale: 0.0005, octaves: 5, persistence: 0.4, lacunarity: 2.0 }
          }
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
                isWalkable: tile.isWalkable ?? true
              });
              biomeMap[tile.y][tile.x] = tile.biome;
            }
          }
        }
      }
    }

    this.state.terrainTiles = allTiles;
    console.log(`Generated ${allTiles.length} terrain tiles.`);

    // Spawn resources using the generated biome map
    this.worldResourceSystem.spawnResourcesInWorld({
      ...worldConfig,
      biomeMap
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
    const events = this.capturedEvents.length > 0 ? [...this.capturedEvents] : undefined;
    return {
      state: cloneGameState(this.state),
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
    // NormsSystem is event-driven, no tick needed
    // Genealogy usually updates on events, but if it has a tick:
    // this.genealogySystem.update(scaledDelta);
    // ResearchSystem and RecipeDiscoverySystem are event-driven, no tick needed

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
        case "PING":
        default:
          break;
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
