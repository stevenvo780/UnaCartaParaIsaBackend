import { EventEmitter } from "node:events";
import type { GameResources, GameState } from "../types/game-types.js";
import { cloneGameState, createInitialGameState } from "./defaultState.js";
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
import type {
  SimulationCommand,
  SimulationConfig,
  SimulationSnapshot,
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
  private genealogySystem: GenealogySystem;
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
  private craftingSystem: CraftingSystem;
  private animalSystem: AnimalSystem;
  private itemGenerationSystem: ItemGenerationSystem;
  private combatSystem: CombatSystem;
  private reputationSystem: ReputationSystem;
  private researchSystem: ResearchSystem;
  private recipeDiscoverySystem: RecipeDiscoverySystem;
  private questSystem: QuestSystem;
  private taskSystem: TaskSystem;
  private tradeSystem: TradeSystem;
  private marriageSystem: MarriageSystem;
  private conflictResolutionSystem: ConflictResolutionSystem;
  private normsSystem: NormsSystem;
  private resourceAttractionSystem: ResourceAttractionSystem;
  private crisisPredictorSystem: CrisisPredictorSystem;
  private ambientAwarenessSystem: AmbientAwarenessSystem;
  private cardDialogueSystem: CardDialogueSystem;
  private emergenceSystem: EmergenceSystem;
  private timeSystem: TimeSystem;

  constructor(config?: Partial<SimulationConfig>, initialState?: GameState) {
    this.state = initialState ?? createInitialGameState();
    this.tickIntervalMs = config?.tickIntervalMs ?? 200;
    this.maxCommandQueue = config?.maxCommandQueue ?? 200;
    this.worldResourceSystem = new WorldResourceSystem(this.state);
    this.livingLegendsSystem = new LivingLegendsSystem(this.state);
    this.lifeCycleSystem = new LifeCycleSystem(this.state);
    this.needsSystem = new NeedsSystem(this.state, this.lifeCycleSystem);
    this.genealogySystem = new GenealogySystem(this.state);
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
    this.craftingSystem = new CraftingSystem(
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
    this.researchSystem = new ResearchSystem(this.state);
    this.recipeDiscoverySystem = new RecipeDiscoverySystem(this.state);
    this.questSystem = new QuestSystem(this.state);
    this.taskSystem = new TaskSystem(this.state);
    this.tradeSystem = new TradeSystem(this.state);
    this.marriageSystem = new MarriageSystem(this.state);
    this.conflictResolutionSystem = new ConflictResolutionSystem(this.state);
    this.normsSystem = new NormsSystem(this.state);
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
  }

  public initializeWorldResources(worldConfig: { width: number; height: number; tileSize: number; biomeMap: string[][] }): void {
    this.worldResourceSystem.spawnResourcesInWorld(worldConfig);
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
    return {
      state: cloneGameState(this.state),
      tick: this.tickCounter,
      updatedAt: this.lastUpdate,
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
    // NormsSystem is event-driven, no tick needed
    // Genealogy usually updates on events, but if it has a tick:
    // this.genealogySystem.update(scaledDelta);
    // ResearchSystem and RecipeDiscoverySystem are event-driven, no tick needed

    this.tickCounter += 1;
    const snapshot = this.getSnapshot();
    this.emitter.emit("tick", snapshot);
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
