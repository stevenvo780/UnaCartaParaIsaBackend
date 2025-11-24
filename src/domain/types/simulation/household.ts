// Household System Types

export interface HouseholdMember {
  agentId: string;
  role: "head" | "spouse" | "child" | "other";
  joinedDate: number;
}

export interface Household {
  zoneId: string;
  members: HouseholdMember[];
  capacity: number;
  sharedInventory: {
    wood: number;
    stone: number;
    food: number;
    water: number;
    capacity: number;
  };
  marriageGroupId?: string;
}

export interface HouseholdSystemConfig {
  updateIntervalMs: number;
  highOccupancyThreshold: number;
  defaultInventoryCapacity: number;
}
