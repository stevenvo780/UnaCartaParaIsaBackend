import { logger } from "@/infrastructure/utils/logger";
import type { GameState, Zone } from "../../types/game-types";
import type {
  Household,
  HouseholdMember,
  HouseholdSystemConfig,
} from "../../types/simulation/household";
import type { ResourceType } from "../../types/simulation/economy";
import { simulationEvents, GameEventNames } from "../core/events";
import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

const DEFAULT_CONFIG: HouseholdSystemConfig = {
  updateIntervalMs: 5000,
  highOccupancyThreshold: 0.8,
  defaultInventoryCapacity: 100,
};

/**
 * System for managing household assignments and shared inventories.
 *
 * Tracks agent-to-household assignments, manages shared resource storage,
 * and monitors occupancy levels. Households are created from "rest" type zones.
 *
 * Features:
 * - Automatic household creation from rest zones
 * - Shared inventory management (wood, stone, food, water)
 * - Occupancy tracking and high-occupancy warnings
 * - Homeless agent detection
 *
 * @module domain/simulation/systems
 */
@injectable()
export class HouseholdSystem {
  private gameState: GameState;
  private config: HouseholdSystemConfig;
  private households = new Map<string, Household>();
  private lastUpdate = Date.now();

  constructor(@inject(TYPES.GameState) gameState: GameState) {
    this.gameState = gameState;
    this.config = DEFAULT_CONFIG;
    this.rebuildFromZones();
    logger.info("🏠 HouseholdSystem (Backend) initialized");
  }

  public update(_deltaMs: number): void {
    const now = Date.now();
    if (now - this.lastUpdate < this.config.updateIntervalMs) return;
    this.lastUpdate = now;

    const stats = this.getSystemStats();

    if (stats.occupancy > this.config.highOccupancyThreshold) {
      simulationEvents.emit(GameEventNames.HOUSEHOLD_HIGH_OCCUPANCY, {
        occupancy: stats.occupancy,
        free: stats.free,
        totalCapacity: stats.capacity,
      });
    }

    const homeless = this.checkAgentsWithoutHome();
    if (homeless.length > 0) {
      simulationEvents.emit(GameEventNames.HOUSEHOLD_AGENTS_HOMELESS, {
        count: homeless.length,
        agents: homeless,
      });
    }
  }

  private checkAgentsWithoutHome(): string[] {
    const allAgents = this.gameState.agents || [];
    const homeless: string[] = [];

    for (const agent of allAgents) {
      if (agent.isDead) continue; // Skip dead agents

      let hasHome = false;
      for (const h of this.households.values()) {
        if (h.members.some((m) => m.agentId === agent.id)) {
          hasHome = true;
          break;
        }
      }
      if (!hasHome) {
        homeless.push(agent.id);
      }
    }

    return homeless;
  }

  public rebuildFromZones(): void {
    const zones = this.gameState.zones || [];

    const previousMembers = new Map<string, HouseholdMember[]>();
    const previousInventories = new Map<string, Household["sharedInventory"]>();

    for (const [zoneId, hh] of this.households) {
      if (hh.members.length > 0) {
        previousMembers.set(zoneId, [...hh.members]);
      }
      if (hh.sharedInventory) {
        previousInventories.set(zoneId, { ...hh.sharedInventory });
      }
    }

    this.households.clear();
    const houses = zones.filter((z: Zone) => z.type === "rest");

    for (const z of houses) {
      const capacity = Math.max(
        2,
        Math.floor((z.bounds.width * z.bounds.height) / 2000),
      );

      const existingMembers = previousMembers.get(z.id) || [];
      const existingInventory = previousInventories.get(z.id) || {
        wood: 0,
        stone: 0,
        food: 0,
        water: 0,
        capacity: this.config.defaultInventoryCapacity,
      };

      this.households.set(z.id, {
        zoneId: z.id,
        members: existingMembers,
        capacity,
        sharedInventory: existingInventory,
      });
    }
  }

  public findFreeHouse(): Household | null {
    for (const hh of this.households.values()) {
      if (hh.members.length < hh.capacity) return hh;
    }
    return null;
  }

  public assignToHouse(
    agentId: string,
    role: "head" | "spouse" | "child" | "other" = "other",
  ): string | null {
    for (const hh of this.households.values()) {
      if (hh.members.some((m) => m.agentId === agentId)) {
        return hh.zoneId;
      }
    }

    const free = this.findFreeHouse();
    if (!free) {
      simulationEvents.emit(GameEventNames.HOUSEHOLD_NO_FREE_HOUSES, {
        agentId,
      });
      return null;
    }

    free.members.push({
      agentId,
      role,
      joinedDate: Date.now(),
    });

    simulationEvents.emit(GameEventNames.HOUSEHOLD_AGENT_ASSIGNED, {
      agentId,
      zoneId: free.zoneId,
      occupancy: free.members.length / free.capacity,
    });

    logger.info(`🏠 Agent ${agentId} assigned to house ${free.zoneId}`);
    return free.zoneId;
  }

  public getHousehold(zoneId: string): Household | undefined {
    return this.households.get(zoneId);
  }

  public getHouseFor(agentId: string): Zone | null {
    let hhEntry: Household | undefined;
    for (const h of this.households.values()) {
      if (h.members.some((m) => m.agentId === agentId)) {
        hhEntry = h;
        break;
      }
    }
    if (!hhEntry) return null;

    const zones = this.gameState.zones || [];
    return (zones.find((z: Zone) => z.id === hhEntry!.zoneId) as Zone) || null;
  }

  public getSystemStats(): {
    totalHouseholds: number;
    capacity: number;
    occupied: number;
    free: number;
    occupancy: number;
    households: Array<{
      zoneId: string;
      members: Array<{ agentId: string; role: string }>;
      capacity: number;
      sharedInventory: {
        wood: number;
        stone: number;
        food: number;
        water: number;
        capacity: number;
      };
      marriageGroupId: string | null;
    }>;
  } {
    const households = Array.from(this.households.values());
    const totalHouseholds = households.length;
    const capacity = households.reduce((sum, h) => sum + h.capacity, 0);
    const occupied = households.reduce((sum, h) => sum + h.members.length, 0);
    const free = capacity - occupied;
    const occupancy = capacity > 0 ? occupied / capacity : 0;

    return {
      totalHouseholds,
      capacity,
      occupied,
      free,
      occupancy,
      households: households.map((h) => ({
        zoneId: h.zoneId,
        members: h.members.map((m) => ({
          agentId: m.agentId,
          role: m.role,
        })),
        capacity: h.capacity,
        sharedInventory: { ...h.sharedInventory },
        marriageGroupId: h.marriageGroupId ?? null,
      })),
    };
  }

  /**
   * Deposits resources into a household's shared inventory.
   * Only processes basic resources (wood, stone, food, water) that the household can store.
   *
   * @param householdId - Household identifier
   * @param resources - Resources to deposit
   * @returns True if all resources were successfully deposited
   */
  public depositToHousehold(
    householdId: string,
    resources: Partial<Record<ResourceType, number>>,
  ): boolean {
    const household = this.households.get(householdId);
    if (!household) return false;

    let success = true;
    for (const [res, amount] of Object.entries(resources)) {
      const resource = res as ResourceType;
      if (
        resource !== "wood" &&
        resource !== "stone" &&
        resource !== "food" &&
        resource !== "water"
      ) {
        continue;
      }

      if (amount === undefined) continue;

      const currentLoad =
        household.sharedInventory.wood +
        household.sharedInventory.stone +
        household.sharedInventory.food +
        household.sharedInventory.water;

      const available = household.sharedInventory.capacity - currentLoad;
      if (available < amount) {
        success = false;
        continue;
      }

      household.sharedInventory[resource] += amount;

      simulationEvents.emit(GameEventNames.HOUSEHOLD_RESOURCE_DEPOSITED, {
        householdId,
        resource,
        amount,
      });
    }

    return success;
  }

  /**
   * Withdraws resources from a household's shared inventory.
   * Only processes basic resources (wood, stone, food, water) that the household stores.
   * Simplified implementation for port compatibility - does not check agent permissions.
   *
   * @param householdId - Household identifier
   * @param resources - Resources to withdraw
   * @returns True if withdrawal was successful
   */
  public withdrawFromHousehold(
    householdId: string,
    resources: Partial<Record<ResourceType, number>>,
  ): boolean {
    const household = this.households.get(householdId);
    if (!household) return false;

    for (const [res, amount] of Object.entries(resources)) {
      const resource = res as ResourceType;
      if (
        resource !== "wood" &&
        resource !== "stone" &&
        resource !== "food" &&
        resource !== "water"
      ) {
        continue;
      }

      if (amount === undefined) continue;

      if (household.sharedInventory[resource] >= amount) {
        household.sharedInventory[resource] -= amount;
        simulationEvents.emit(GameEventNames.HOUSEHOLD_RESOURCE_WITHDRAWN, {
          agentId: "system",
          householdId,
          resource,
          amount,
        });
      }
    }
    return true;
  }

  public getHouseholdInventory(householdId: string): {
    wood: number;
    stone: number;
    food: number;
    water: number;
    capacity: number;
  } | null {
    const household = this.households.get(householdId);
    return household ? household.sharedInventory : null;
  }

  public findHouseholdForAgent(agentId: string): Household | null {
    for (const h of this.households.values()) {
      if (h.members.some((m) => m.agentId === agentId)) {
        return h;
      }
    }
    return null;
  }
}
