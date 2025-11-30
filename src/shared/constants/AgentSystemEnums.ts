/**
 * Agent System Enums - Consolidated enums for the agent/behavior system.
 *
 * This file consolidates the most frequently used enums for the agent system
 * to reduce import complexity and provide a single source of truth.
 *
 * Migration strategy:
 * 1. New code should import from this file
 * 2. Existing code can continue using individual enum files
 * 3. Gradually update imports to point here
 *
 * @module shared/constants/AgentSystemEnums
 */


export {
  GoalType,
  ActionType,
  NeedType,
  type GoalTypeValue,
  type ActionTypeValue,
  type NeedTypeValue,
  ALL_GOAL_TYPES,
  ALL_ACTION_TYPES,
  ALL_NEED_TYPES,
  isGoalType,
  isActionType,
  isNeedType,
} from "./AIEnums";

export {
  Sex,
  LifeStage,
  SocialStatus,
  ExplorationType,
  SocialPreference,
  WorkEthic,
} from "./AgentEnums";

export {
  ResourceType,
  type ResourceTypeValue,
  ALL_RESOURCE_TYPES,
  isResourceType,
} from "./ResourceEnums";

export { RoleType, ALL_ROLE_TYPES, isRoleType } from "./RoleEnums";

export {
  TaskType,
  type TaskTypeValue,
  ALL_TASK_TYPES,
  isTaskType,
} from "./TaskEnums";

export { CombatEventType } from "./CombatEnums";

export { AnimalState, AnimalType, AnimalTargetType } from "./AnimalEnums";
