import type { GameState, Zone } from "../../types/game-types.js";
import type { ResourceType } from "../types/economy.js";
import { InventorySystem } from "./InventorySystem.js";
import { LifeCycleSystem } from "./LifeCycleSystem.js";
import { simulationEvents, GameEventNames } from "../events.js";

interface ProductionConfig {
  updateIntervalMs: number;
  productionIntervalMs: number;
  maxWorkersPerZone: number;
  baseYieldPerWorker: number;
}

const DEFAULT_CONFIG: ProductionConfig = {
  updateIntervalMs: 5_000,
  productionIntervalMs: 12_000,
  maxWorkersPerZone: 2,
  baseYieldPerWorker: 4,
};

type MutableZone = Zone & {
  metadata?: Record<string, unknown> & {
    productionResource?: ResourceType;
  };
};

export class ProductionSystem {
  private readonly config: ProductionConfig;
  private readonly lastProduction = new Map<string, number>();
  private readonly assignments = new Map<string, Set<string>>();
  private lastUpdate = 0;

  constructor(
    private readonly state: GameState,
    private readonly inventorySystem: InventorySystem,
    private readonly lifeCycleSystem: LifeCycleSystem,
    config?: Partial<ProductionConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public update(_deltaMs: number): void {
    const now = Date.now();
    if (now - this.lastUpdate < this.config.updateIntervalMs) {
      return;
    }
    this.lastUpdate = now;

    for (const zone of (this.state.zones || []) as MutableZone[]) {
      if (!this.isProductionZone(zone)) continue;
      this.ensureAssignments(zone);
      this.processProduction(zone, now);
    }
  }

  private isProductionZone(zone: MutableZone): boolean {
    if (zone.type === "food" || zone.type === "water") return true;
    const resource = this.getProductionResource(zone);
    return Boolean(resource);
  }

  private getProductionResource(zone: MutableZone): ResourceType | null {
    if (zone.type === "food" || zone.metadata?.productionResource === "food") {
      return "food";
    }
    if (zone.type === "water" || zone.metadata?.productionResource === "water") {
      return "water";
    }
    return (zone.metadata?.productionResource as ResourceType) || null;
  }

  private ensureAssignments(zone: MutableZone): void {
    const assigned = this.assignments.get(zone.id) ?? new Set<string>();
    if (!this.assignments.has(zone.id)) {
      this.assignments.set(zone.id, assigned);
    }

    const required = this.config.maxWorkersPerZone;
    if (assigned.size >= required) {
      return;
    }

    const agents = this.lifeCycleSystem.getAgents();
    for (const agent of agents) {
      if (assigned.size >= required) break;
      if (this.isAgentBusy(agent.id)) continue;
      assigned.add(agent.id);
    }
  }

  private isAgentBusy(agentId: string): boolean {
    for (const workers of this.assignments.values()) {
      if (workers.has(agentId)) return true;
    }
    return false;
  }

  private processProduction(zone: MutableZone, now: number): void {
    const last = this.lastProduction.get(zone.id) ?? 0;
    if (now - last < this.config.productionIntervalMs) {
      return;
    }

    const workers = this.assignments.get(zone.id);
    if (!workers || workers.size === 0) {
      return;
    }

    const resource = this.getProductionResource(zone);
    if (!resource) return;

    const amount = workers.size * this.config.baseYieldPerWorker;
    this.depositToZoneStockpile(zone.id, resource, amount);
    this.lastProduction.set(zone.id, now);

    simulationEvents.emit(GameEventNames.PRODUCTION_OUTPUT_GENERATED, {
      zoneId: zone.id,
      resource,
      amount,
      workers: Array.from(workers),
    });
  }

  private depositToZoneStockpile(
    zoneId: string,
    resource: ResourceType,
    amount: number,
  ): void {
    let stockpile = this.inventorySystem.getStockpilesInZone(zoneId)[0];
    if (!stockpile) {
      stockpile = this.inventorySystem.createStockpile(zoneId, "general", 150);
    }
    this.inventorySystem.addToStockpile(stockpile.id, resource, amount);
  }
}
