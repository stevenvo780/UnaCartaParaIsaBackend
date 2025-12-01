import { ResourceType } from "../../../shared/constants/ResourceEnums";
import { TaskType } from "../../../domain/simulation/systems/agents/ai/types";

export { TaskType };

export interface TaskMetadata {
  priority?: number;
  assignedAgentId?: string;
  buildingType?: string;
  itemType?: string;
  resourceType?: ResourceType;
  quality?: number;

  communityTask?: boolean;
  urgency?: number;
  claimCount?: number;
  maxClaims?: number;
  claimedBy?: string[];
  [key: string]:
    | string
    | number
    | boolean
    | string[]
    | ResourceType
    | undefined;
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
