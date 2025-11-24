import type { GameResources, GameState } from "../types/game-types.js";
import type { AgentTraits } from "./types/agents.js";

export type ResourcesState = NonNullable<GameState["resources"]>;

export interface SimulationSnapshot {
  state: GameState;
  tick: number;
  updatedAt: number;
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
  | { type: "PING"; payload?: Record<string, unknown> };

export interface SimulationConfig {
  tickIntervalMs: number;
  maxCommandQueue: number;
}
