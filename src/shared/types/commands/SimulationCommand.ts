import type {
  GameResources,
  GameState,
} from "../../../domain/types/game-types";
import type { AgentTraits } from "../simulation/agents";

export type ResourcesState = NonNullable<GameState["resources"]>;

export interface SimulationEvent {
  type: string;
  payload?: unknown;
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

export type SimulationCommand =
  | { type: "SET_TIME_SCALE"; multiplier: number }
  | {
      type: "APPLY_RESOURCE_DELTA";
      delta: Partial<GameResources["materials"]>;
    }
  | { type: "GATHER_RESOURCE"; resourceId: string; amount: number }
  | { type: "SPAWN_AGENT"; payload?: SpawnAgentCommandPayload }
  | { type: "KILL_AGENT"; agentId: string }
  | { type: "PING"; payload?: Record<string, unknown> }
  | {
      type: "NEEDS_COMMAND";
      command: "SATISFY_NEED" | "MODIFY_NEED" | "UPDATE_CONFIG";
      payload?: Record<string, unknown>;
    }
  | {
      type: "RECIPE_COMMAND";
      command: "TEACH_RECIPE" | "SHARE_RECIPE";
      payload?: Record<string, unknown>;
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
      payload?: Record<string, unknown>;
    }
  | {
      type: "RESEARCH_COMMAND";
      command: "INITIALIZE_LINEAGE" | "RECIPE_DISCOVERED";
      payload?: Record<string, unknown>;
    }
  | {
      type: "WORLD_RESOURCE_COMMAND";
      command: "SPAWN_RESOURCE" | "HARVEST_RESOURCE";
      payload?: Record<string, unknown>;
    }
  | {
      type: "DIALOGUE_COMMAND";
      command: "RESPOND_TO_CARD";
      payload?: Record<string, unknown>;
    }
  | {
      type: "BUILDING_COMMAND";
      command: "START_UPGRADE" | "CANCEL_UPGRADE";
      payload?: Record<string, unknown>;
    }
  | {
      type: "REPUTATION_COMMAND";
      command: "UPDATE_TRUST";
      payload?: Record<string, unknown>;
    }
  | {
      type: "TASK_COMMAND";
      command: "CREATE_TASK" | "CONTRIBUTE_TO_TASK" | "REMOVE_TASK";
      payload?: Record<string, unknown>;
    };

export interface SimulationConfig {
  tickIntervalMs: number;
  maxCommandQueue: number;
}
