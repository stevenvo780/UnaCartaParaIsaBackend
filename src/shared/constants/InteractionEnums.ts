/**
 * Interaction type enumerations for the simulation system.
 *
 * Defines all interaction types used between entities in the simulation.
 *
 * @module shared/constants/InteractionEnums
 */

/**
 * Enumeration of interaction types between entities.
 * Represents different ways entities can interact with each other.
 */
export enum InteractionType {
  NOURISH = "NOURISH",
  FEED = "FEED",
  PLAY = "PLAY",
  COMFORT = "COMFORT",
  DISTURB = "DISTURB",
  WAKE_UP = "WAKE_UP",
  LET_SLEEP = "LET_SLEEP",
}

/**
 * Type representing all possible interaction type values.
 */
