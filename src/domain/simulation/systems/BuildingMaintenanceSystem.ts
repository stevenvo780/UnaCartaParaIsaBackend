import type { GameState, Zone } from "../../types/game-types";
import type { Inventory } from "../../types/simulation/economy";
import type { InventorySystem } from "./InventorySystem";
import { simulationEvents, GameEventNames } from "../core/events";
import {
  BuildingMaintenanceConfig,
  BuildingState,
  calculateRepairCost,
  getBuildingCondition,
} from "../../types/simulation/buildings";

const DEFAULT_CONFIG: BuildingMaintenanceConfig = {
  usageDegradationRate: 0.4,
  usageDegradationInterval: 10,
  abandonmentThreshold: 5 * 60 * 1000,
  normalDeteriorationRate: 0.8,
  abandonedDeteriorationRate: 1.6,
  repairEfficiency: 35,
  maxDurabilityDecay: 1,
  perfectRepairCostMultiplier: 3,
  criticalDurabilityThreshold: 30,
  ruinedDurabilityThreshold: 10,
  destructionThreshold: 0,
};

type MutableZone = Zone & {
  metadata?: Record<string, unknown> & {
    building?: string;
  };
  durability?: number;
  maxDurability?: number;
};

type AgentInventory = Inventory;

export class BuildingMaintenanceSystem {
  private readonly config: BuildingMaintenanceConfig;
  private readonly now: () => number;
  private readonly buildingStates = new Map<string, BuildingState>();
  private lastUpdate = 0;
  private readonly updateIntervalMs = 5_000;

  constructor(
    private readonly state: GameState,
    private readonly inventorySystem: InventorySystem,
    config?: Partial<BuildingMaintenanceConfig>,
    nowProvider: () => number = () => Date.now(),
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.now = nowProvider;

    this.bootstrapExistingZones();
    simulationEvents.on(
      GameEventNames.BUILDING_CONSTRUCTED,
      (payload: { zoneId: string }) => this.initializeBuildingState(payload.zoneId),
    );
  }

  public update(_deltaMs: number): void {
    const now = this.now();
    if (now - this.lastUpdate < this.updateIntervalMs) {
      return;
    }
    this.lastUpdate = now;

    for (const state of Array.from(this.buildingStates.values())) {
      this.applyTimeDeterioration(state, now);
    }
  }

  public recordUsage(zoneId: string): void {
    const state = this.buildingStates.get(zoneId);
    if (!state) return;

    state.lastUsageTime = this.now();
    state.usageCount += 1;
    state.isAbandoned = false;
    state.deteriorationRate = this.config.normalDeteriorationRate;

    if (state.usageCount % this.config.usageDegradationInterval === 0) {
      this.reduceDurability(state, this.config.usageDegradationRate, "usage");
    }
  }

  public repairBuilding(
    zoneId: string,
    agentId: string,
    perfectRepair = false,
  ): boolean {
    const state = this.buildingStates.get(zoneId);
    if (!state) return false;

    const zone = this.findZone(zoneId);
    if (!zone) return false;

    const inventory = this.inventorySystem.getAgentInventory(agentId) as AgentInventory | undefined;
    if (!inventory) return false;

    const cost = calculateRepairCost(state.durability, perfectRepair);
    if (!this.hasResources(inventory, cost)) {
      return false;
    }

    this.consumeResources(agentId, cost);

    const previousDurability = state.durability;
    if (perfectRepair) {
      state.durability = state.maxDurability;
    } else {
      state.durability = Math.min(
        state.maxDurability,
        state.durability + this.config.repairEfficiency,
      );
      state.maxDurability = Math.max(
        50,
        state.maxDurability - this.config.maxDurabilityDecay,
      );
    }

    state.condition = getBuildingCondition(state.durability);
    state.lastMaintenanceTime = this.now();

    simulationEvents.emit(GameEventNames.BUILDING_REPAIRED, {
      zoneId,
      agentId,
      previousDurability,
      newDurability: state.durability,
      perfectRepair,
    });

    this.syncZone(zoneId, state);
    return true;
  }

  private bootstrapExistingZones(): void {
    for (const zone of (this.state.zones || []) as MutableZone[]) {
      if (zone.type === "rest" || zone.metadata?.building) {
        this.initializeBuildingState(zone.id);
      }
    }
  }

  private initializeBuildingState(zoneId: string): void {
    const zone = this.findZone(zoneId);
    if (!zone) return;

    const now = this.now();
    const state: BuildingState = {
      zoneId,
      durability: zone.durability ?? 100,
      maxDurability: zone.maxDurability ?? 100,
      condition: getBuildingCondition(zone.durability ?? 100),
      lastMaintenanceTime: now,
      lastUsageTime: now,
      usageCount: 0,
      isAbandoned: false,
      timeSinceLastUse: 0,
      deteriorationRate: this.config.normalDeteriorationRate,
    };

    this.buildingStates.set(zoneId, state);
    this.syncZone(zoneId, state);
  }

  private applyTimeDeterioration(state: BuildingState, now: number): void {
    const elapsed = now - state.lastUsageTime;
    state.timeSinceLastUse = elapsed;

    const wasAbandoned = state.isAbandoned;
    state.isAbandoned = elapsed > this.config.abandonmentThreshold;

    if (state.isAbandoned && !wasAbandoned) {
      state.deteriorationRate = this.config.abandonedDeteriorationRate;
    } else if (!state.isAbandoned && wasAbandoned) {
      state.deteriorationRate = this.config.normalDeteriorationRate;
    }

    const damage = (state.deteriorationRate / 3600_000) * this.updateIntervalMs;
    this.reduceDurability(state, damage, state.isAbandoned ? "abandonment" : "time");
  }

  private reduceDurability(
    state: BuildingState,
    amount: number,
    cause: "usage" | "abandonment" | "time",
  ): void {
    const previous = state.durability;
    state.durability = Math.max(0, state.durability - amount);
    state.condition = getBuildingCondition(state.durability);

    if (state.durability !== previous) {
      simulationEvents.emit(GameEventNames.BUILDING_DAMAGED, {
        zoneId: state.zoneId,
        previousDurability: previous,
        newDurability: state.durability,
        cause,
      });
      this.syncZone(state.zoneId, state);
    }
  }

  public startUpgrade(zoneId: string, agentId: string): boolean {
    const state = this.buildingStates.get(zoneId);
    if (!state) return false;

    // Iniciar proceso de mejora (simplificado)
    state.isUpgrading = true;
    state.upgradeStartTime = this.now();
    return true;
  }

  public cancelUpgrade(zoneId: string): boolean {
    const state = this.buildingStates.get(zoneId);
    if (!state || !state.isUpgrading) return false;

    state.isUpgrading = false;
    state.upgradeStartTime = undefined;
    return true;
  }

  private findZone(zoneId: string): MutableZone | undefined {
    return ((this.state.zones || []) as MutableZone[]).find((z) => z.id === zoneId);
  }

  private syncZone(zoneId: string, state: BuildingState): void {
    const zone = this.findZone(zoneId);
    if (!zone) return;
    zone.durability = state.durability;
    zone.maxDurability = state.maxDurability;
  }

  private hasResources(
    inventory: AgentInventory,
    cost: Partial<Record<"wood" | "stone", number>>,
  ): boolean {
    for (const [resource, amount] of Object.entries(cost)) {
      if (!amount) continue;
      const key = resource as "wood" | "stone";
      if ((inventory[key] ?? 0) < amount) {
        return false;
      }
    }
    return true;
  }

  private consumeResources(
    agentId: string,
    cost: Partial<Record<"wood" | "stone", number>>,
  ): void {
    for (const [resource, amount] of Object.entries(cost)) {
      if (!amount) continue;
      const key = resource as "wood" | "stone";
      this.inventorySystem.removeFromAgent(agentId, key, amount);
    }
  }
}
