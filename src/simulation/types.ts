import type { GameResources, GameState } from "../types/game-types.js";

export type ResourcesState = NonNullable<GameState["resources"]>;

export interface SimulationSnapshot {
  state: GameState;
  tick: number;
  updatedAt: number;
}

export type SimulationCommand =
  | { type: "SET_TIME_SCALE"; multiplier: number }
  | {
      type: "APPLY_RESOURCE_DELTA";
      delta: Partial<GameResources["materials"]>;
    }
  | { type: "GATHER_RESOURCE"; resourceId: string; amount: number }
  | { type: "PING"; payload?: Record<string, unknown> };

export interface SimulationConfig {
  tickIntervalMs: number;
  maxCommandQueue: number;
}
