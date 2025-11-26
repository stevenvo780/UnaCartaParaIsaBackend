import type {
  GameResources,
  GameState,
} from "../../../domain/types/game-types";
import type { AgentTraits } from "../simulation/agents";

export type ResourcesState = NonNullable<GameState["resources"]>;

export type SimulationEventPayload =
  | { type: string; [key: string]: string | number | boolean | undefined }
  | {
      type: string;
      agentId: string;
      [key: string]: string | number | boolean | undefined;
    }
  | {
      type: string;
      zoneId: string;
      [key: string]: string | number | boolean | undefined;
    }
  | {
      type: string;
      resourceId: string;
      [key: string]: string | number | boolean | undefined;
    }
  | Record<string, string | number | boolean | undefined>;

export interface SimulationEvent {
  type: string;
  payload?: SimulationEventPayload;
  timestamp?: number;
}

export interface SimulationSnapshot {
  state: GameState;
  tick: number;
  updatedAt: number;
  events?: SimulationEvent[];
}

export interface SpawnAgentCommandPayload {
  requestId?: string;
  name?: string;
  sex?: "male" | "female" | "unknown";
  generation?: number;
  immortal?: boolean;
  parents?: {
    father?: string;
    mother?: string;
  };
  traits?: Partial<AgentTraits>;
}

export interface NeedsCommandPayload {
  entityId?: string;
  agentId?: string;
  needType?: string;
  amount?: number;
  delta?: number;
  [key: string]: string | number | undefined;
}

export interface RecipeCommandPayload {
  agentId?: string;
  teacherId?: string;
  studentId?: string;
  recipeId?: string;
  [key: string]: string | undefined;
}

export interface SocialCommandPayload {
  aId?: string;
  bId?: string;
  agentId?: string;
  agentA?: string;
  agentB?: string;
  value?: number;
  delta?: number;
  durationMs?: number;
  magnitude?: number;
  [key: string]: string | number | undefined;
}

export interface ResearchCommandPayload {
  lineageId?: string;
  recipeId?: string;
  discoveredBy?: string;
  [key: string]: string | undefined;
}

export interface WorldResourceCommandPayload {
  type?: string;
  resourceId?: string;
  agentId?: string;
  position?: { x: number; y: number };
  biome?: string;
  [key: string]: string | { x: number; y: number } | undefined;
}

export interface DialogueCommandPayload {
  cardId?: string;
  choiceId?: string;
  [key: string]: string | undefined;
}

export interface BuildingCommandPayload {
  zoneId?: string;
  agentId?: string;
  buildingType?: string;
  position?: { x: number; y: number };
  [key: string]: string | { x: number; y: number } | number | undefined;
}

export interface ReputationCommandPayload {
  agentA?: string;
  agentB?: string;
  trust?: number;
  delta?: number;
  [key: string]: string | number | undefined;
}

export interface TaskCommandPayload {
  taskId?: string;
  agentId?: string;
  zoneId?: string;
  type?: string;
  requiredWork?: number;
  bounds?: { x: number; y: number; width: number; height: number };
  [key: string]:
    | string
    | number
    | { x: number; y: number; width: number; height: number }
    | undefined;
}

export interface PingPayload {
  message?: string;
  timestamp?: number;
  [key: string]: string | number | undefined;
}

export interface AgentCommandPayload {
  x?: number;
  y?: number;
  speed?: number;
  activity?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface AnimalCommandPayload {
  type?: string;
  position?: { x: number; y: number };
  biome?: string;
  [key: string]: string | number | { x: number; y: number } | undefined;
}

export interface GiveResourceCommandPayload {
  agentId: string;
  resource: "wood" | "stone" | "food" | "water";
  amount: number;
  targetType?: "agent";
}

export type SimulationCommand =
  | { type: "SET_TIME_SCALE"; multiplier: number }
  | {
      type: "APPLY_RESOURCE_DELTA";
      delta: Partial<GameResources["materials"]>;
    }
  | { type: "GATHER_RESOURCE"; resourceId: string; amount: number }
  | { type: "GIVE_RESOURCE"; payload: GiveResourceCommandPayload }
  | { type: "SPAWN_AGENT"; payload?: SpawnAgentCommandPayload }
  | { type: "KILL_AGENT"; agentId: string }
  | { type: "PING"; payload?: PingPayload }
  | {
      type: "AGENT_COMMAND";
      agentId: string;
      command: string;
      payload?: AgentCommandPayload;
    }
  | {
      type: "ANIMAL_COMMAND";
      command: string;
      payload?: AnimalCommandPayload;
    }
  | {
      type: "NEEDS_COMMAND";
      command: "SATISFY_NEED" | "MODIFY_NEED" | "UPDATE_CONFIG";
      payload?: NeedsCommandPayload;
    }
  | {
      type: "RECIPE_COMMAND";
      command: "TEACH_RECIPE" | "SHARE_RECIPE";
      payload?: RecipeCommandPayload;
    }
  | {
      type: "SOCIAL_COMMAND";
      command:
        | "IMPOSE_TRUCE"
        | "SET_AFFINITY"
        | "MODIFY_AFFINITY"
        | "FRIENDLY_INTERACTION"
        | "HOSTILE_ENCOUNTER"
        | "REMOVE_RELATIONSHIPS";
      payload?: SocialCommandPayload;
    }
  | {
      type: "RESEARCH_COMMAND";
      command: "INITIALIZE_LINEAGE" | "RECIPE_DISCOVERED";
      payload?: ResearchCommandPayload;
    }
  | {
      type: "WORLD_RESOURCE_COMMAND";
      command: "SPAWN_RESOURCE" | "HARVEST_RESOURCE";
      payload?: WorldResourceCommandPayload;
    }
  | {
      type: "DIALOGUE_COMMAND";
      command: "RESPOND_TO_CARD";
      payload?: DialogueCommandPayload;
    }
  | {
      type: "BUILDING_COMMAND";
      command:
        | "START_UPGRADE"
        | "CANCEL_UPGRADE"
        | "ENQUEUE_CONSTRUCTION"
        | "CONSTRUCT_BUILDING";
      payload?: BuildingCommandPayload;
    }
  | {
      type: "REPUTATION_COMMAND";
      command: "UPDATE_TRUST";
      payload?: ReputationCommandPayload;
    }
  | {
      type: "TASK_COMMAND";
      command: "CREATE_TASK" | "CONTRIBUTE_TO_TASK" | "REMOVE_TASK";
      payload?: TaskCommandPayload;
    }
  | {
      type: "TIME_COMMAND";
      command: "SET_WEATHER";
      payload?: { weatherType: string };
    }
  | {
      type: "TIME_COMMAND";
      command: "SET_WEATHER";
      payload?: { weatherType: string };
    }
  | { type: "FORCE_EMERGENCE_EVALUATION"; timestamp?: number }
  | { type: "SAVE_GAME"; timestamp?: number };

export interface SimulationConfig {
  tickIntervalMs: number;
  maxCommandQueue: number;
}

export type SimulationRequest =
  | { type: "REQUEST_FULL_STATE"; requestId: string }
  | { type: "REQUEST_ENTITY_DETAILS"; requestId: string; entityId: string }
  | { type: "REQUEST_PLAYER_ID"; requestId: string };
