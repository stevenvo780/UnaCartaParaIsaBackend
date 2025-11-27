/**
 * Movement type enumerations for the simulation system.
 *
 * Defines all movement-related types including difficulty levels.
 *
 * @module shared/constants/MovementEnums
 */

import { WeatherType } from "./AmbientEnums";

/**
 * Enumeration of movement difficulty levels.
 */
export enum Difficulty {
  EASY = "easy",
  MEDIUM = "medium",
  HARD = "hard",
}

/**
 * Type representing all possible difficulty values.
 */
export type DifficultyValue = `${Difficulty}`;

/**
 * Array of all difficulty levels for iteration.
 */
export const ALL_DIFFICULTIES: readonly Difficulty[] = Object.values(
  Difficulty,
) as Difficulty[];

/**
 * Type guard to check if a string is a valid Difficulty.
 */
export function isDifficulty(value: string): value is Difficulty {
  return Object.values(Difficulty).includes(value as Difficulty);
}

/**
 * Enumeration of entity activity types.
 * Defines all possible activities that entities can perform during movement.
 */
export enum ActivityType {
  IDLE = "idle",
  MOVING = "moving",
  EATING = "eating",
  DRINKING = "drinking",
  CLEANING = "cleaning",
  PLAYING = "playing",
  MEDITATING = "meditating",
  WORKING = "working",
  RESTING = "resting",
  SOCIALIZING = "socializing",
  INSPECTING = "inspecting",
  FLEEING = "fleeing",
  ATTACKING = "attacking",
}

/**
 * Type representing all possible activity type values.
 */
export type ActivityTypeValue = `${ActivityType}`;

/**
 * Array of all activity types for iteration.
 */
export const ALL_ACTIVITY_TYPES: readonly ActivityType[] = Object.values(
  ActivityType,
) as ActivityType[];

/**
 * Type guard to check if a string is a valid ActivityType.
 */
export function isActivityType(value: string): value is ActivityType {
  return Object.values(ActivityType).includes(value as ActivityType);
}

/**
 * Re-export WeatherType from AmbientEnums for convenience.
 */
export { WeatherType };
