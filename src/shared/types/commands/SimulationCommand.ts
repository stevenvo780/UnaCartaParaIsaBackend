import type {
  GameResources,
  GameState,
} from "../../../shared/types/game-types";
import type { AgentTraits } from "../../../shared/types/simulation/agents";
import { GameEventType } from "../../constants/EventEnums";
import { ResourceType, WorldResourceType } from "../../constants/ResourceEnums";
import { BiomeType } from "../../constants/BiomeEnums";
import { NeedType } from "../../constants/AIEnums";
import { Sex } from "../../constants/AgentEnums";
import { WeatherType } from "../../constants/AmbientEnums";
import { ActivityType } from "../../constants/MovementEnums";
import { AnimalType } from "../../constants/AnimalEnums";
import { BuildingType } from "../../constants/BuildingEnums";
import { SystemProperty } from "../../constants/SystemEnums";

export type ResourcesState = NonNullable<GameState[SystemProperty.RESOURCES]>;

/**
 * Base interface for all event payloads.
 * Note: Specific event payloads should extend this with their own properties
 * rather than using the index signature.
 */
export interface BaseEventPayload {
  type: GameEventType;
}

/**
 * Event payload with agent ID.
 */
export interface AgentEventPayload extends BaseEventPayload {
  agentId: string;
}

/**
 * Event payload with zone ID.
 */
export interface ZoneEventPayload extends BaseEventPayload {
  zoneId: string;
}

/**
 * Event payload with resource ID.
 */
export interface ResourceEventPayload extends BaseEventPayload {
  resourceId: string;
}

/**
 * Union type for all possible event payloads.
 */
export type SimulationEventPayload =
  | BaseEventPayload
  | AgentEventPayload
  | ZoneEventPayload
  | ResourceEventPayload;

/**
 * Simulation event interface with typed event type.
 */
export interface SimulationEvent {
  type: GameEventType;
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
  sex?: Sex;
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
  needType?: NeedType;
  amount?: number;
  delta?: number;
}

export interface RecipeCommandPayload {
  agentId?: string;
  teacherId?: string;
  studentId?: string;
  recipeId?: string;
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
}

export interface ResearchCommandPayload {
  lineageId?: string;
  recipeId?: string;
  discoveredBy?: string;
}

export interface WorldResourceCommandPayload {
  type?: WorldResourceType;
  resourceId?: string;
  agentId?: string;
  position?: { x: number; y: number };
  biome?: BiomeType;
}

export interface DialogueCommandPayload {
  cardId?: string;
  choiceId?: string;
}

export interface BuildingCommandPayload {
  zoneId?: string;
  agentId?: string;
  buildingType?: BuildingType;
  position?: { x: number; y: number };
}

export interface ReputationCommandPayload {
  agentA?: string;
  agentB?: string;
  trust?: number;
  delta?: number;
}

export interface TaskCommandPayload {
  taskId?: string;
  agentId?: string;
  zoneId?: string;
  type?: TaskType;
  requiredWork?: number;
  bounds?: { x: number; y: number; width: number; height: number };
  contribution?: number;
  socialSynergyMultiplier?: number;
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

export interface ConflictCommandPayload {
  cardId?: string;
  choice?: ConflictResolutionChoice;
}

export interface PingPayload {
  message?: string;
  timestamp?: number;
}

export interface AgentCommandPayload {
  x?: number;
  y?: number;
  speed?: number;
  activity?: ActivityType;
}

export interface AnimalCommandPayload {
  type?: AnimalType;
  position?: { x: number; y: number };
  biome?: BiomeType;
}

import { TargetType } from "../../constants/EntityEnums";

export interface GiveResourceCommandPayload {
  agentId: string;
  resource: ResourceType;
  amount: number;
  targetType?: TargetType;
}

import {
  SimulationCommandType,
  NeedsCommandType,
  RecipeCommandType,
  SocialCommandType,
  ResearchCommandType,
  WorldResourceCommandType,
  DialogueCommandType,
  BuildingCommandType,
  ReputationCommandType,
  TaskCommandType,
  TimeCommandType,
  AgentCommandType,
  AnimalCommandType,
  ConflictCommandType,
} from "../../constants/CommandEnums";
import { ConflictResolutionChoice } from "../../constants/ConflictEnums";
import type { TaskType } from "../../../shared/types/simulation/tasks";
import type { TaskMetadata } from "../../../shared/types/simulation/tasks";

export type SimulationCommand =
  | { type: SimulationCommandType.SET_TIME_SCALE; multiplier: number }
  | {
      type: SimulationCommandType.APPLY_RESOURCE_DELTA;
      delta: Partial<GameResources[SystemProperty.MATERIALS]>;
    }
  | {
      type: SimulationCommandType.GATHER_RESOURCE;
      resourceId: string;
      amount: number;
    }
  | {
      type: SimulationCommandType.GIVE_RESOURCE;
      payload: GiveResourceCommandPayload;
    }
  | {
      type: SimulationCommandType.SPAWN_AGENT;
      payload?: SpawnAgentCommandPayload;
    }
  | { type: SimulationCommandType.KILL_AGENT; agentId: string }
  | { type: SimulationCommandType.PING; payload?: PingPayload }
  | {
      type: SimulationCommandType.AGENT_COMMAND;
      agentId: string;
      command: AgentCommandType;
      payload?: AgentCommandPayload;
    }
  | {
      type: SimulationCommandType.ANIMAL_COMMAND;
      command: AnimalCommandType;
      payload?: AnimalCommandPayload;
    }
  | {
      type: SimulationCommandType.NEEDS_COMMAND;
      command: NeedsCommandType;
      payload?: NeedsCommandPayload;
    }
  | {
      type: SimulationCommandType.RECIPE_COMMAND;
      command: RecipeCommandType;
      payload?: RecipeCommandPayload;
    }
  | {
      type: SimulationCommandType.SOCIAL_COMMAND;
      command: SocialCommandType;
      payload?: SocialCommandPayload;
    }
  | {
      type: SimulationCommandType.RESEARCH_COMMAND;
      command: ResearchCommandType;
      payload?: ResearchCommandPayload;
    }
  | {
      type: SimulationCommandType.WORLD_RESOURCE_COMMAND;
      command: WorldResourceCommandType;
      payload?: WorldResourceCommandPayload;
    }
  | {
      type: SimulationCommandType.DIALOGUE_COMMAND;
      command: DialogueCommandType;
      payload?: DialogueCommandPayload;
    }
  | {
      type: SimulationCommandType.BUILDING_COMMAND;
      command: BuildingCommandType;
      payload?: BuildingCommandPayload;
    }
  | {
      type: SimulationCommandType.REPUTATION_COMMAND;
      command: ReputationCommandType;
      payload?: ReputationCommandPayload;
    }
  | {
      type: SimulationCommandType.TASK_COMMAND;
      command: TaskCommandType;
      payload?: TaskCommandPayload;
    }
  | {
      type: SimulationCommandType.CONFLICT_COMMAND;
      command: ConflictCommandType;
      payload?: ConflictCommandPayload;
    }
  | {
      type: SimulationCommandType.TIME_COMMAND;
      command: TimeCommandType;
      payload?: { weatherType: WeatherType };
    }
  | {
      type: SimulationCommandType.FORCE_EMERGENCE_EVALUATION;
      timestamp?: number;
    }
  | { type: SimulationCommandType.SAVE_GAME; timestamp?: number };

export interface SimulationConfig {
  tickIntervalMs: number;
  maxCommandQueue: number;
}

import { SimulationRequestType } from "../../constants/CommandEnums";

export type SimulationRequest =
  | {
      type: SimulationRequestType.REQUEST_FULL_STATE;
      requestId: string;
    }
  | {
      type: SimulationRequestType.REQUEST_ENTITY_DETAILS;
      requestId: string;
      entityId: string;
    }
  | {
      type: SimulationRequestType.REQUEST_PLAYER_ID;
      requestId: string;
    };
