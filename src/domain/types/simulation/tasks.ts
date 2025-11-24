export type TaskType =
  | "build_house"
  | "gather_wood"
  | "gather_stone"
  | "gather_food"
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
  [key: string]: string | number | undefined;
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
