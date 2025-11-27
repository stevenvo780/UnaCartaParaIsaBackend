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
 * Type representing all possible animal type values.
 */
export type AnimalTypeValue = `${AnimalType}`;

/**
 * Type representing all possible animal state values.
 */
export type AnimalStateValue = `${AnimalState}`;

/**
 * Array of all animal types for iteration.
 */
export const ALL_ANIMAL_TYPES: readonly AnimalType[] = Object.values(
  AnimalType,
) as AnimalType[];

/**
 * Array of all animal states for iteration.
 */
export const ALL_ANIMAL_STATES: readonly AnimalState[] = Object.values(
  AnimalState,
) as AnimalState[];

/**
 * Type guard to check if a string is a valid AnimalType.
 */
export function isAnimalType(value: string): value is AnimalType {
  return Object.values(AnimalType).includes(value as AnimalType);
}

/**
 * Type guard to check if a string is a valid AnimalState.
 */
export function isAnimalState(value: string): value is AnimalState {
  return Object.values(AnimalState).includes(value as AnimalState);
}
