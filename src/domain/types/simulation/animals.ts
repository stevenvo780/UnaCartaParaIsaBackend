import type { Position } from "../../types/game-types.js";

export type AnimalType = "rabbit" | "deer" | "boar" | "bird" | "fish" | "wolf";

export type AnimalState =
  | "idle"
  | "wandering"
  | "seeking_food"
  | "seeking_water"
  | "eating"
  | "drinking"
  | "fleeing"
  | "hunting"
  | "mating"
  | "dead";

export interface AnimalGenes {
  color: number;
  size: number;
  speed: number;
  health: number;
  fertility: number;
}

export interface AnimalNeeds {
  hunger: number;
  thirst: number;
  fear: number;
  reproductiveUrge: number;
}

export interface AnimalConfig {
  type: AnimalType;
  displayName: string;

  spriteKey: string;
  scale: number;
  tint?: number;

  maxHealth: number;
  speed: number;
  fleeSpeed: number;
  detectionRange: number;

  hungerDecayRate: number;
  thirstDecayRate: number;
  reproductionCooldown: number;
  lifespan: number;

  foodValue: number;
  canBeHunted: boolean;
  fleeFromHumans: boolean;
  fleeDistance: number;

  consumesVegetation: boolean;
  consumesWater: boolean;
  vegetationConsumptionRate: number;
  waterConsumptionRate: number;

  isPredator?: boolean;
  preyTypes?: (AnimalType | "human")[];
  huntingRange?: number;
  attackDamage?: number;

  isAquatic?: boolean;

  spawnProbability: number;
  suitableBiomes: string[];
  groupSize: { min: number; max: number };
  minDistanceBetweenGroups: number;
}

export interface Animal {
  id: string;
  type: AnimalType;
  position: Position;
  state: AnimalState;
  needs: AnimalNeeds;
  genes: AnimalGenes;

  health: number;
  age: number;
  lastReproduction: number;
  spawnedAt: number;
  generation: number;

  parentIds: [string | null, string | null];

  targetPosition: Position | null;
  currentTarget: { type: "food" | "water" | "mate"; id: string } | null;
  fleeTarget: string | null;

  biome: string;
  isDead: boolean;
  isBeingHunted?: boolean;
  stateEndTime?: number;
}

export interface AnimalSystemConfig {
  maxAnimals: number;
  spawnRadius: number;
  updateInterval: number;
  cleanupInterval: number;
}
