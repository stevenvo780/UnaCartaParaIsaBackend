import type { Animal } from "../../../types/simulation/animals";
import { getAnimalConfig } from "../../../../infrastructure/services/world/config/AnimalConfigs";
import { AnimalState } from "../../../../shared/constants/AnimalEnums";

export class AnimalNeeds {
  public static updateNeeds(animal: Animal, deltaMinutes: number): void {
    const config = getAnimalConfig(animal.type);
    if (!config) return;

    animal.needs.hunger = Math.max(
      0,
      animal.needs.hunger - config.hungerDecayRate * deltaMinutes,
    );

    animal.needs.thirst = Math.max(
      0,
      animal.needs.thirst - config.thirstDecayRate * deltaMinutes,
    );

    if (Date.now() - animal.lastReproduction > config.reproductionCooldown) {
      animal.needs.reproductiveUrge = Math.min(
        100,
        animal.needs.reproductiveUrge + 5.0 * deltaMinutes,
      );
    }

    if (animal.state !== AnimalState.FLEEING) {
      animal.needs.fear = Math.max(0, animal.needs.fear - 10 * deltaMinutes);
    }

    const maxHealth = config.maxHealth * animal.genes.health;
    if (animal.health < maxHealth) {
      if (animal.needs.hunger > 50 && animal.needs.thirst > 50) {
        const recoveryRate = maxHealth * 0.15;
        animal.health = Math.min(
          maxHealth,
          animal.health + recoveryRate * deltaMinutes,
        );
      } else if (animal.needs.hunger > 20 && animal.needs.thirst > 20) {
        const recoveryRate = maxHealth * 0.05;
        animal.health = Math.min(
          maxHealth,
          animal.health + recoveryRate * deltaMinutes,
        );
      }
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
