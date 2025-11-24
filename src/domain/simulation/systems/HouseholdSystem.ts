import type { GameState, Zone } from "../../types/game-types";
import type {
  Household,
  HouseholdMember,
  HouseholdSystemConfig,
} from "../../types/simulation/household";
import { simulationEvents, GameEventNames } from "../core/events";

const DEFAULT_CONFIG: HouseholdSystemConfig = {
  updateIntervalMs: 5000,
  highOccupancyThreshold: 0.8,
  defaultInventoryCapacity: 100,
};

export class HouseholdSystem {
  private gameState: GameState;
  private config: HouseholdSystemConfig;
  private households = new Map<string, Household>();
  private lastUpdate = 0;

  constructor(gameState: GameState, config?: Partial<HouseholdSystemConfig>) {
    this.gameState = gameState;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rebuildFromZones();
    console.log("🏠 HouseholdSystem (Backend) initialized");
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
      const hasHome = Array.from(this.households.values()).some((h) =>
        h.members.some((m) => m.agentId === agent.id),
      );
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

    this.households.forEach((hh, zoneId) => {
      if (hh.members.length > 0) {
        previousMembers.set(zoneId, [...hh.members]);
      }
      if (hh.sharedInventory) {
        previousInventories.set(zoneId, { ...hh.sharedInventory });
      }
    });

    this.households.clear();
    const houses = zones.filter((z: Zone) => z.type === "rest");

    houses.forEach((z: Zone) => {
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
    });
  }

  public findFreeHouse(): Household | null {
    for (const hh of Array.from(this.households.values())) {
      if (hh.members.length < hh.capacity) return hh;
    }
    return null;
  }

  public assignToHouse(
    agentId: string,
    role: "head" | "spouse" | "child" | "other" = "other",
  ): string | null {
    // Check if already assigned
    for (const hh of Array.from(this.households.values())) {
      if (hh.members.some((m) => m.agentId === agentId)) {
        return hh.zoneId;
      }
    }

    // Find free house
    const free = this.findFreeHouse();
    if (!free) {
      simulationEvents.emit(GameEventNames.HOUSEHOLD_NO_FREE_HOUSES, {
        agentId,
      });
      return null;
    }

    // Assign agent
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

    console.log(`🏠 Agent ${agentId} assigned to house ${free.zoneId}`);
    return free.zoneId;
  }

  public getHousehold(zoneId: string): Household | undefined {
    return this.households.get(zoneId);
  }

  public getHouseFor(agentId: string): Zone | null {
    const hhEntry = Array.from(this.households.values()).find((h) =>
      h.members.some((m) => m.agentId === agentId),
    );
    if (!hhEntry) return null;

    const zones = this.gameState.zones || [];
    return (zones.find((z: Zone) => z.id === hhEntry.zoneId) as Zone) || null;
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

  public depositToHousehold(
    householdId: string,
    resource: "wood" | "stone" | "food" | "water",
    amount: number,
  ): boolean {
    const household = this.households.get(householdId);
    if (!household) return false;

    const currentLoad =
      household.sharedInventory.wood +
      household.sharedInventory.stone +
      household.sharedInventory.food +
      household.sharedInventory.water;

    const available = household.sharedInventory.capacity - currentLoad;
    if (available < amount) return false;

    household.sharedInventory[resource] += amount;

    simulationEvents.emit(GameEventNames.HOUSEHOLD_RESOURCE_DEPOSITED, {
      householdId,
      resource,
      amount,
    });

    return true;
  }

  public withdrawFromHousehold(
    agentId: string,
    householdId: string,
    resource: "wood" | "stone" | "food" | "water",
    amount: number,
  ): number {
    const household = this.households.get(householdId);
    if (!household) return 0;

    // Check membership
    if (!household.members.some((m) => m.agentId === agentId)) {
      return 0;
    }

    const available = household.sharedInventory[resource];
    const withdrawn = Math.min(amount, available);

    if (withdrawn > 0) {
      household.sharedInventory[resource] -= withdrawn;

      simulationEvents.emit(GameEventNames.HOUSEHOLD_RESOURCE_WITHDRAWN, {
        agentId,
        householdId,
        resource,
        amount: withdrawn,
      });
    }

    return withdrawn;
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

  public getAgentHousehold(agentId: string): Household | null {
    const household = Array.from(this.households.values()).find((h) =>
      h.members.some((m) => m.agentId === agentId),
    );
    return household || null;
  }
}
