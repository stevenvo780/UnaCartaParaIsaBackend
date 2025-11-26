import type { AnimalConfig } from "../../../../domain/types/simulation/animals";

export const ANIMAL_CONFIGS: Record<string, AnimalConfig> = {
  rabbit: {
    type: "rabbit",
    displayName: "Conejo",

    spriteKey: "rabbit",
    scale: 0.8,
    tint: 0xccaa88,

    maxHealth: 30,
    speed: 80,
    fleeSpeed: 150,
    detectionRange: 200,

    hungerDecayRate: 0.4,
    thirstDecayRate: 0.6,
    reproductionCooldown: 60000,
    lifespan: 300000,

    foodValue: 15,
    canBeHunted: true,
    fleeFromHumans: true,
    fleeDistance: 150,

    consumesVegetation: true,
    consumesWater: true,
    vegetationConsumptionRate: 2,
    waterConsumptionRate: 3,

    spawnProbability: 0.25,
    suitableBiomes: ["grassland", "forest", "mystical", "village"],
    groupSize: { min: 3, max: 7 },
    minDistanceBetweenGroups: 200,
  },

  deer: {
    type: "deer",
    displayName: "Ciervo",

    spriteKey: "deer",
    scale: 1.2,
    tint: 0xaa8866,

    maxHealth: 50,
    speed: 100,
    fleeSpeed: 180,
    detectionRange: 250,

    hungerDecayRate: 0.3,
    thirstDecayRate: 0.5,
    reproductionCooldown: 120000,
    lifespan: 600000,

    foodValue: 30,
    canBeHunted: true,
    fleeFromHumans: true,
    fleeDistance: 200,

    consumesVegetation: true,
    consumesWater: true,
    vegetationConsumptionRate: 3,
    waterConsumptionRate: 4,

    spawnProbability: 0.15,
    suitableBiomes: ["forest", "mystical", "village"],
    groupSize: { min: 2, max: 4 },
    minDistanceBetweenGroups: 300,
  },

  boar: {
    type: "boar",
    displayName: "Jabalí",

    spriteKey: "boar",
    scale: 1.0,
    tint: 0x665544,

    maxHealth: 70,
    speed: 70,
    fleeSpeed: 120,
    detectionRange: 180,

    hungerDecayRate: 0.5,
    thirstDecayRate: 0.4,
    reproductionCooldown: 150000,
    lifespan: 480000,

    foodValue: 25,
    canBeHunted: true,
    fleeFromHumans: false,
    fleeDistance: 100,

    consumesVegetation: true,
    consumesWater: true,
    vegetationConsumptionRate: 4,
    waterConsumptionRate: 3,

    spawnProbability: 0.1,
    suitableBiomes: ["forest", "grassland", "village"],
    groupSize: { min: 1, max: 2 },
    minDistanceBetweenGroups: 350,
  },

  bird: {
    type: "bird",
    displayName: "Pájaro",

    spriteKey: "bird",
    scale: 0.6,
    tint: 0x8899aa,

    maxHealth: 15,
    speed: 120,
    fleeSpeed: 200,
    detectionRange: 300,

    hungerDecayRate: 0.6,
    thirstDecayRate: 0.7,
    reproductionCooldown: 90000,
    lifespan: 240000,

    foodValue: 8,
    canBeHunted: true,
    fleeFromHumans: true,
    fleeDistance: 250,

    consumesVegetation: true,
    consumesWater: true,
    vegetationConsumptionRate: 1,
    waterConsumptionRate: 2,

    spawnProbability: 0.25,
    suitableBiomes: ["forest", "mystical", "grassland", "wetland", "village"],
    groupSize: { min: 3, max: 8 },
    minDistanceBetweenGroups: 200,
  },

  fish: {
    type: "fish",
    displayName: "Pez",

    spriteKey: "fish",
    scale: 0.7,
    tint: 0x6688aa,

    maxHealth: 20,
    speed: 60,
    fleeSpeed: 100,
    detectionRange: 150,

    hungerDecayRate: 0.3,
    thirstDecayRate: 0,
    reproductionCooldown: 100000,
    lifespan: 360000,

    foodValue: 12,
    canBeHunted: true,
    fleeFromHumans: true,
    fleeDistance: 120,

    consumesVegetation: true,
    consumesWater: false,
    vegetationConsumptionRate: 1.5,
    waterConsumptionRate: 0,

    isAquatic: true,

    spawnProbability: 0.3,
    suitableBiomes: ["wetland", "ocean", "lake", "river"],
    groupSize: { min: 4, max: 10 },
    minDistanceBetweenGroups: 300,
  },

  wolf: {
    type: "wolf",
    displayName: "Lobo",

    spriteKey: "wolf",
    scale: 1.1,
    tint: 0x666666,

    maxHealth: 80,
    speed: 110,
    fleeSpeed: 140,
    detectionRange: 300,

    hungerDecayRate: 0.5,
    thirstDecayRate: 0.4,
    reproductionCooldown: 180000,
    lifespan: 720000,

    foodValue: 35,
    canBeHunted: true,
    fleeFromHumans: false,
    fleeDistance: 180,

    consumesVegetation: false,
    consumesWater: true,
    vegetationConsumptionRate: 0,
    waterConsumptionRate: 3,

    isPredator: true,
    preyTypes: ["rabbit", "deer", "human"],
    huntingRange: 250,
    attackDamage: 20,

    spawnProbability: 0.05,
    suitableBiomes: ["forest", "mystical"],
    groupSize: { min: 1, max: 3 },
    minDistanceBetweenGroups: 500,
  },
};

export function getAnimalConfig(type: string): AnimalConfig | undefined {
  return ANIMAL_CONFIGS[type];
}

export function getAllAnimalTypes(): string[] {
  return Object.keys(ANIMAL_CONFIGS);
}

export function getAnimalsForBiome(biome: string): AnimalConfig[] {
  return Object.values(ANIMAL_CONFIGS).filter((config) =>
    config.suitableBiomes.includes(biome),
  );
}
