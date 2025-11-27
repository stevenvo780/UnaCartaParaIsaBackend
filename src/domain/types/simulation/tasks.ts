export type TaskType =
  | "build_house"
  | "gather_wood"
  | "gather_stone"
  | "gather_food"
  | "gather_water"
  | "deposit_resources"
  | "hunt_animal"
  | "craft_item"
  | "repair_building"
  | "farm"
  | "fish"
  | "trade"
  | "research"
  | "custom";

export interface TaskMetadata {
  priority?: number;
  assignedAgentId?: string;
  buildingType?: string;
  itemType?: string;
  resourceType?: string;
  quality?: number;
  // Community task coordination fields
  communityTask?: boolean;
  urgency?: number;
  claimCount?: number;
  maxClaims?: number;
  claimedBy?: string[];
  [key: string]: string | number | boolean | string[] | undefined;
}

export interface Task {
  id: string;
  type: TaskType;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  zoneId?: string;
  createdAt: number;
  progress: number;
  requiredWork: number;
  requirements?: {
    resources?: {
      wood?: number;
      stone?: number;
      food?: number;
      water?: number;
    };
    minWorkers?: number;
  };
  metadata?: TaskMetadata;
  completed: boolean;
  cancelled?: boolean;
  cancellationReason?: string;
  contributors?: Map<string, number>;
  lastContribution?: number;
  targetAnimalId?: string;
}

export interface TaskCreationParams {
  type: TaskType;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  zoneId?: string;
  requiredWork: number;
  requirements?: {
    resources?: {
      wood?: number;
      stone?: number;
      food?: number;
      water?: number;
    };
    minWorkers?: number;
  };
  metadata?: TaskMetadata;
  targetAnimalId?: string;
}
