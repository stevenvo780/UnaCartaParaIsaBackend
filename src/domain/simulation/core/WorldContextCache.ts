import { injectable, inject } from "inversify";
import type { GameState, Zone } from "@/shared/types/game-types";
import { ZoneType } from "@/shared/constants/ZoneEnums";
import { TYPES } from "@/config/Types";
import { InventorySystem } from "../../systems/economy/InventorySystem";

type InventoryTotals = {
  wood: number;
  stone: number;
  food: number;
  water: number;
  rare_materials: number;
  metal: number;
  iron_ore: number;
  copper_ore: number;
};

export interface InventoryTotalsSnapshot {
  totalStockpiles: number;
  totalAgentInventories: number;
  stockpiled: InventoryTotals;
  inAgents: InventoryTotals;
}

export interface CachedZoneInfo {
  id: string;
  type: ZoneType | string;
  center: { x: number; y: number };
  metadata?: Record<string, unknown>;
}

export interface CachedBuildInfo {
  id: string;
  zoneId: string;
  progress: number;
  center: { x: number; y: number };
}

export interface ZonesMetadata {
  storageZones: CachedZoneInfo[];
  craftZones: CachedZoneInfo[];
  workZones: CachedZoneInfo[];
  pendingBuilds: CachedBuildInfo[];
}

/**
 * Lightweight cache for frequently requested global simulation data.
 *
 * Recomputing global aggregates (inventory totals, zone centers) for every
 * agent tick is extremely expensive at high agent counts. This cache keeps
 * short-lived snapshots that are refreshed lazily, dramatically reducing the
 * amount of repeated work per agent update.
 */
@injectable()
export class WorldContextCache {
  private readonly INVENTORY_TTL = 250; // ms
  private readonly ZONE_TTL = 1000; // ms

  private inventoryCache?: {
    data: InventoryTotalsSnapshot;
    timestamp: number;
  };

  private zonesCache?: { data: ZonesMetadata; timestamp: number };

  constructor(
    @inject(TYPES.GameState) private readonly gameState: GameState,
    @inject(TYPES.InventorySystem)
    private readonly inventorySystem: InventorySystem,
  ) {}

  public getInventoryStats(): InventoryTotalsSnapshot {
    const now = Date.now();
    if (
      !this.inventoryCache ||
      now - this.inventoryCache.timestamp > this.INVENTORY_TTL
    ) {
      this.inventoryCache = {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        data: this.inventorySystem.getSystemStats(),
        timestamp: now,
      };
    }

    return this.inventoryCache.data;
  }

  public invalidateInventory(): void {
    this.inventoryCache = undefined;
  }

  public getZonesMetadata(): ZonesMetadata {
    const now = Date.now();
    if (!this.zonesCache || now - this.zonesCache.timestamp > this.ZONE_TTL) {
      this.zonesCache = {
        data: this.computeZonesMetadata(),
        timestamp: now,
      };
    }

    return this.zonesCache.data;
  }

  public invalidateZones(): void {
    this.zonesCache = undefined;
  }

  private computeZonesMetadata(): ZonesMetadata {
    const storageZones: CachedZoneInfo[] = [];
    const craftZones: CachedZoneInfo[] = [];
    const workZones: CachedZoneInfo[] = [];
    const pendingBuilds: CachedBuildInfo[] = [];

    const zones = this.gameState.zones ?? [];

    for (const zone of zones) {
      const center = this.getZoneCenter(zone);
      const info: CachedZoneInfo = {
        id: zone.id,
        type: zone.type,
        center,
        metadata: zone.metadata,
      };

      if (
        zone.type === ZoneType.STORAGE ||
        zone.id.toLowerCase().includes(ZoneType.STORAGE.toLowerCase())
      ) {
        storageZones.push(info);
      }

      if (this.isCraftZone(zone)) {
        craftZones.push(info);
      }

      if (this.isWorkZoneCandidate(zone)) {
        workZones.push(info);
      }

      const buildProgress = this.getBuildProgress(zone);
      if (buildProgress !== undefined && buildProgress < 1) {
        pendingBuilds.push({
          id: zone.id,
          zoneId: zone.id,
          progress: buildProgress,
          center,
        });
      }
    }

    return { storageZones, craftZones, workZones, pendingBuilds };
  }

  private getBuildProgress(zone: Zone): number | undefined {
    const metadata = zone.metadata ?? {};
    const progress = metadata.buildProgress;
    return typeof progress === "number" ? progress : undefined;
  }

  private getZoneCenter(zone: Zone): { x: number; y: number } {
    return {
      x: zone.bounds.x + zone.bounds.width / 2,
      y: zone.bounds.y + zone.bounds.height / 2,
    };
  }

  private isCraftZone(zone: Zone): boolean {
    if (zone.type === ZoneType.WORK) return true;
    const id = zone.id.toLowerCase();
    const metadata = zone.metadata ?? {};
    return (
      id.includes("craft") ||
      metadata.craftingStation === true ||
      metadata.workshop === true
    );
  }

  private isWorkZoneCandidate(zone: Zone): boolean {
    if (
      zone.type === ZoneType.WORK ||
      zone.type === ZoneType.GATHERING ||
      zone.type === ZoneType.WILD
    ) {
      return true;
    }

    const id = zone.id.toLowerCase();
    return (
      id.includes("workbench") ||
      id.includes("mine") ||
      id.includes("forest") ||
      id.includes("logging") ||
      id.includes("quarry")
    );
  }
}
