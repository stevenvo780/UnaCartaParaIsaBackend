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
 * Re-export WeatherType from AmbientEnums for convenience.
 */
export { WeatherType };
