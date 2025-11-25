import type { Animal } from "../../../types/simulation/animals";
import { getAnimalConfig } from "../../../../infrastructure/services/world/config/AnimalConfigs";

export class AnimalNeeds {
  public static updateNeeds(animal: Animal, deltaMinutes: number): void {
    const config = getAnimalConfig(animal.type);
    if (!config) return;

    // Faster decay so animals seek food/water more actively (was 0.7x, now 1.5x)
    animal.needs.hunger = Math.max(
      0,
      animal.needs.hunger - config.hungerDecayRate * deltaMinutes * 1.5,
    );

    animal.needs.thirst = Math.max(
      0,
      animal.needs.thirst - config.thirstDecayRate * deltaMinutes * 1.5,
    );

    if (Date.now() - animal.lastReproduction > config.reproductionCooldown) {
      animal.needs.reproductiveUrge = Math.min(
        100,
        animal.needs.reproductiveUrge + 0.5 * deltaMinutes,
      );
    }

    if (animal.state !== "fleeing") {
      animal.needs.fear = Math.max(0, animal.needs.fear - 10 * deltaMinutes);
    }
  }

  public static isStarving(animal: Animal): boolean {
    return animal.needs.hunger < 10;
  }

  public static isDehydrated(animal: Animal): boolean {
    return animal.needs.thirst < 10;
  }

  public static isCritical(animal: Animal): boolean {
    return this.isStarving(animal) || this.isDehydrated(animal);
  }

  public static feed(animal: Animal, amount: number): void {
    animal.needs.hunger = Math.min(100, animal.needs.hunger + amount);
  }

  public static hydrate(animal: Animal, amount: number): void {
    animal.needs.thirst = Math.min(100, animal.needs.thirst + amount);
  }

  public static satisfyReproductiveUrge(animal: Animal): void {
    animal.needs.reproductiveUrge = 0;
    animal.lastReproduction = Date.now();
  }
}
