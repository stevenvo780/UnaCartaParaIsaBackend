/**
 * Animal type enumerations for the simulation system.
 *
 * Defines all animal types and states used in the simulation.
 *
 * @module shared/constants/AnimalEnums
 */

/**
 * Enumeration of animal types.
 */
export enum AnimalType {
  RABBIT = "rabbit",
  DEER = "deer",
  BOAR = "boar",
  BIRD = "bird",
  FISH = "fish",
  WOLF = "wolf",
}

/**
 * Enumeration of animal states.
 */
export enum AnimalState {
  IDLE = "idle",
  WANDERING = "wandering",
  SEEKING_FOOD = "seeking_food",
  SEEKING_WATER = "seeking_water",
  EATING = "eating",
  DRINKING = "drinking",
  FLEEING = "fleeing",
  HUNTING = "hunting",
  MATING = "mating",
  DEAD = "dead",
}

/**
 * Enumeration of animal target types.
 * Defines what animals can target when seeking resources or mates.
 */
export enum AnimalTargetType {
  FOOD = "food",
  WATER = "water",
  MATE = "mate",
}
