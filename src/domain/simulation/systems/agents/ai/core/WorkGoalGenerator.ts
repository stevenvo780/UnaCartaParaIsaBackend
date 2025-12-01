/**
 * @fileoverview Work Goal Generation Helpers
 *
 * Centralizes the logic for generating work goals based on agent roles.
 * Reduces repetitive code in AISystem.ts by ~200 lines.
 */

import type { AIGoal } from "../../../../../types/simulation/ai";
import { GoalType } from "../../../../../../shared/constants/AIEnums";
import { ResourceType } from "../../../../../../shared/constants/ResourceEnums";
import { TaskType } from "../../../../../../shared/constants/TaskEnums";
import { RoleType } from "../../../../../../shared/constants/RoleEnums";
import { logger } from "../../../../../../infrastructure/utils/logger";

/**
 * Resource finding function signature.
 */
export type FindResourceFn = (
  agentId: string,
  resourceType: string,
) => { id: string; x: number; y: number } | null;

/**
 * Configuration for a resource-gathering task.
 */
interface GatherConfig {
  /** Resource types to search for (in order of preference) */
  resourceTypes: string[];
  /** Task type to assign */
  taskType: TaskType;
  /** Output resource type */
  outputResource: ResourceType;
  /** Base priority (0-1) */
  priority: number;
  /** Emoji for logging */
  emoji: string;
}

/**
 * Role-specific gathering configurations.
 */
const ROLE_GATHER_CONFIGS: Partial<Record<RoleType, GatherConfig[]>> = {
  [RoleType.HUNTER]: [
    {
      resourceTypes: ["berry_bush", "mushroom_patch", "wheat_crop"],
      taskType: TaskType.GATHER_FOOD,
      outputResource: ResourceType.FOOD,
      priority: 0.5,
      emoji: "🍖",
    },
  ],
  [RoleType.LOGGER]: [
    {
      resourceTypes: ["tree"],
      taskType: TaskType.GATHER_WOOD,
      outputResource: ResourceType.WOOD,
      priority: 0.6,
      emoji: "🪵",
    },
  ],
  [RoleType.QUARRYMAN]: [
    {
      resourceTypes: ["rock"],
      taskType: TaskType.GATHER_STONE,
      outputResource: ResourceType.STONE,
      priority: 0.6,
      emoji: "🪨",
    },
  ],
  [RoleType.MINER]: [
    {
      resourceTypes: ["rock"],
      taskType: TaskType.GATHER_METAL,
      outputResource: ResourceType.METAL,
      priority: 0.65,
      emoji: "⛏️",
    },
  ],
  [RoleType.CRAFTSMAN]: [
    {
      resourceTypes: ["rock"],
      taskType: TaskType.GATHER_METAL,
      outputResource: ResourceType.METAL,
      priority: 0.5,
      emoji: "🔧",
    },
  ],
  [RoleType.GATHERER]: [
    {
      resourceTypes: ["berry_bush", "mushroom_patch", "wheat_crop"],
      taskType: TaskType.GATHER_FOOD,
      outputResource: ResourceType.FOOD,
      priority: 0.5,
      emoji: "🧺",
    },
  ],
  [RoleType.BUILDER]: [
    {
      resourceTypes: ["tree"],
      taskType: TaskType.GATHER_WOOD,
      outputResource: ResourceType.WOOD,
      priority: 0.5,
      emoji: "🏗️",
    },
    {
      resourceTypes: ["rock"],
      taskType: TaskType.GATHER_STONE,
      outputResource: ResourceType.STONE,
      priority: 0.5,
      emoji: "🏗️",
    },
  ],
  [RoleType.FARMER]: [
    {
      resourceTypes: ["berry_bush", "mushroom_patch", "wheat_crop"],
      taskType: TaskType.GATHER_FOOD,
      outputResource: ResourceType.FOOD,
      priority: 0.55,
      emoji: "🌾",
    },
  ],
};

/**
 * Default gathering configs for agents without a specific role.
 */
const DEFAULT_GATHER_CONFIGS: GatherConfig[] = [
  {
    resourceTypes: ["berry_bush", "mushroom_patch", "wheat_crop"],
    taskType: TaskType.GATHER_FOOD,
    outputResource: ResourceType.FOOD,
    priority: 0.4,
    emoji: "🔍",
  },
  {
    resourceTypes: ["tree"],
    taskType: TaskType.GATHER_WOOD,
    outputResource: ResourceType.WOOD,
    priority: 0.35,
    emoji: "🔍",
  },
  {
    resourceTypes: ["rock"],
    taskType: TaskType.GATHER_STONE,
    outputResource: ResourceType.STONE,
    priority: 0.3,
    emoji: "🔍",
  },
];

/**
 * Generates a unique goal ID.
 */
function generateGoalId(prefix: string, agentId: string, now: number): string {
  return `${prefix}_${agentId}_${now}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Creates a work goal for resource gathering.
 */
function createGatherGoal(
  agentId: string,
  now: number,
  resource: { id: string; x: number; y: number },
  config: GatherConfig,
): AIGoal {
  return {
    id: generateGoalId("work", agentId, now),
    type: GoalType.WORK,
    priority: config.priority,
    targetId: resource.id,
    targetPosition: { x: resource.x, y: resource.y },
    data: {
      taskType: config.taskType,
      resourceType: config.outputResource,
    },
    createdAt: now,
  };
}

/**
 * Tries to find a resource matching any of the given types.
 */
function findFirstResource(
  agentId: string,
  resourceTypes: string[],
  excludedIds: Set<string>,
  findResource: FindResourceFn,
): { id: string; x: number; y: number } | null {
  for (const resourceType of resourceTypes) {
    const resource = findResource(agentId, resourceType);
    if (resource && !excludedIds.has(resource.id)) {
      return resource;
    }
  }
  return null;
}

/**
 * Generates a work goal for an agent based on their role.
 *
 * @param agentId - Agent identifier
 * @param role - Agent's current role (or undefined/IDLE)
 * @param now - Current timestamp
 * @param excludedIds - Resource IDs to exclude (already targeted)
 * @param findResource - Function to find nearest resource
 * @returns A work goal or null if no suitable resource found
 */
export function generateRoleBasedWorkGoal(
  agentId: string,
  role: RoleType | undefined,
  now: number,
  excludedIds: Set<string>,
  findResource: FindResourceFn,
): AIGoal | null {
  const configs =
    role && ROLE_GATHER_CONFIGS[role]
      ? ROLE_GATHER_CONFIGS[role]
      : DEFAULT_GATHER_CONFIGS;

  if (!configs) return null;

  for (const config of configs) {
    const resource = findFirstResource(
      agentId,
      config.resourceTypes,
      excludedIds,
      findResource,
    );

    if (resource) {
      logger.debug(
        `${config.emoji} [AI] ${agentId}: Found ${config.outputResource} at (${resource.x}, ${resource.y})`,
      );
      return createGatherGoal(agentId, now, resource, config);
    }
  }

  return null;
}
