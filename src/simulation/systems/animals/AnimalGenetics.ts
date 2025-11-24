import type { AnimalGenes } from '../../types/animals.js';

const MUTATION_RATE = 0.1;

export class AnimalGenetics {
  public static generateRandomGenes(seed?: number): AnimalGenes {
    const random = seed !== undefined ? () => Math.random() : Math.random;

    return {
      color: Math.floor(random() * 0xffffff),
      size: 0.7 + random() * 0.6,
      speed: 0.8 + random() * 0.4,
      health: 0.8 + random() * 0.4,
      fertility: 0.8 + random() * 0.4,
    };
  }

  public static breedGenes(
    parent1: AnimalGenes,
    parent2: AnimalGenes
  ): AnimalGenes {
    return {
      color: this.inheritColor(parent1.color, parent2.color),
      size: this.inheritTrait(parent1.size, parent2.size, 0.6, 1.4),
      speed: this.inheritTrait(parent1.speed, parent2.speed, 0.7, 1.3),
      health: this.inheritTrait(parent1.health, parent2.health, 0.7, 1.3),
      fertility: this.inheritTrait(parent1.fertility, parent2.fertility, 0.7, 1.3),
    };
  }

  private static inheritColor(color1: number, color2: number): number {
    if (Math.random() < MUTATION_RATE) {
      return Math.floor(Math.random() * 0xffffff);
    }
    return Math.random() < 0.5 ? color1 : color2;
  }

  private static inheritTrait(
    trait1: number,
    trait2: number,
    min: number,
    max: number
  ): number {
    const average = (trait1 + trait2) / 2;
    const mutation =
      Math.random() < MUTATION_RATE
        ? (Math.random() - 0.5) * 0.2
        : 0;

    return Math.max(min, Math.min(max, average + mutation));
  }

  public static calculateFitness(genes: AnimalGenes): number {
    return (
      genes.size * 0.2 +
      genes.speed * 0.3 +
      genes.health * 0.3 +
      genes.fertility * 0.2
    ) / 1.4;
  }
}
