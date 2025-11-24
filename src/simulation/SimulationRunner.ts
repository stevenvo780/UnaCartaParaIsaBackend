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
import { simulationEvents, GameEventNames } from "./events.js";
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
    this.economySystem.update(scaledDelta);
    this.marketSystem.update(scaledDelta);
    this.roleSystem.update(scaledDelta);
    this.aiSystem.update(scaledDelta);
    // Genealogy usually updates on events, but if it has a tick:
    // this.genealogySystem.update(scaledDelta);

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
