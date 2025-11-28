/**
 * Task type enumerations for the simulation system.
 *
 * Defines all task types used in TaskSystem and related components.
 *
 * @module shared/constants/TaskEnums
 */

/**
 * Enumeration of task types available in the simulation.
 */
export enum TaskType {
  BUILD_HOUSE = "build_house",
  GATHER_WOOD = "gather_wood",
  GATHER_STONE = "gather_stone",
  GATHER_FOOD = "gather_food",
  GATHER_WATER = "gather_water",
  GATHER_METAL = "gather_metal",
  DEPOSIT_RESOURCES = "deposit_resources",
  HUNT_ANIMAL = "hunt_animal",
  CRAFT_ITEM = "craft_item",
  REPAIR_BUILDING = "repair_building",
  FARM = "farm",
  FISH = "fish",
  TRADE = "trade",
  RESEARCH = "research",
  CUSTOM = "custom",
}

/**
 * Type representing all possible task type values.
 */
export type TaskTypeValue = `${TaskType}`;

/**
 * Array of all task types for iteration.
 */
export const ALL_TASK_TYPES: readonly TaskType[] = Object.values(
  TaskType,
) as TaskType[];

/**
 * Type guard to check if a string is a valid TaskType.
 */
export function isTaskType(value: string): value is TaskType {
  return Object.values(TaskType).includes(value as TaskType);
}
