import type { Animal } from '../../types/animals.js';
import { getAnimalConfig } from '../../config/AnimalConfigs.js';

/**
 * Animal Needs Module
 * Manages hunger, thirst, fear, and reproductive urge
 */

export class AnimalNeeds {
  /**
   * Update animal needs based on time passed
   */
  public static updateNeeds(animal: Animal, deltaMinutes: number): void {
    const config = getAnimalConfig(animal.type);
    if (!config) return;

    // Decay hunger - animals get hungry over time
    animal.needs.hunger = Math.max(
      0,
      animal.needs.hunger - config.hungerDecayRate * deltaMinutes * 0.7
    );

    // Decay thirst - animals get thirsty over time
    animal.needs.thirst = Math.max(
      0,
      animal.needs.thirst - config.thirstDecayRate * deltaMinutes * 0.7
    );

    // Increase reproductive urge if cooldown passed
    if (Date.now() - animal.lastReproduction > config.reproductionCooldown) {
      animal.needs.reproductiveUrge = Math.min(
        100,
        animal.needs.reproductiveUrge + 0.5 * deltaMinutes
      );
    }

    // Decrease fear when not fleeing
    if (animal.state !== 'fleeing') {
      animal.needs.fear = Math.max(0, animal.needs.fear - 10 * deltaMinutes);
    }
  }

  /**
   * Check if animal is starving (critical hunger)
   */
  public static isStarving(animal: Animal): boolean {
    return animal.needs.hunger < 10;
  }

  /**
   * Check if animal is dehydrated (critical thirst)
   */
  public static isDehydrated(animal: Animal): boolean {
    return animal.needs.thirst < 10;
  }

  /**
   * Check if animal is in critical condition
   */
  public static isCritical(animal: Animal): boolean {
    return this.isStarving(animal) || this.isDehydrated(animal);
  }

  /**
   * Feed animal
   */
  public static feed(animal: Animal, amount: number): void {
    animal.needs.hunger = Math.min(100, animal.needs.hunger + amount);
  }

  /**
   * Give water to animal
   */
  public static hydrate(animal: Animal, amount: number): void {
    animal.needs.thirst = Math.min(100, animal.needs.thirst + amount);
  }

  /**
   * Satisfy reproductive urge
   */
  public static satisfyReproductiveUrge(animal: Animal): void {
    animal.needs.reproductiveUrge = 0;
    animal.lastReproduction = Date.now();
  }
}
