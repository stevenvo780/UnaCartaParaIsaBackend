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
 * Re-export WeatherType from AmbientEnums for convenience.
 */
export { WeatherType };
