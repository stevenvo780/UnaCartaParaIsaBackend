import { logger } from "@/infrastructure/utils/logger";
import type { Animal } from "../../../types/simulation/animals";
import { getAnimalConfig } from "../../../../infrastructure/services/world/config/AnimalConfigs";
import { AnimalNeeds } from "./AnimalNeeds";
import { AnimalGenetics } from "./AnimalGenetics";
import { simulationEvents, GameEventNames } from "../../core/events";
import { AnimalState } from "../../../../shared/constants/AnimalEnums";

const BASE_ANIMAL_SPEED = 60; // Slightly increased from 50

export class AnimalBehavior {
  private static wanderAngles = new Map<string, number>();

  public static moveAwayFrom(
    animal: Animal,
    threatPosition: { x: number; y: number },
    speedMultiplier: number,
    deltaSeconds: number,
  ): void {
    const dx = animal.position.x - threatPosition.x;
    const dy = animal.position.y - threatPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0 && distance < 300) {
      const normalizedX = dx / distance;
      const normalizedY = dy / distance;

      const effectiveSpeed =
        BASE_ANIMAL_SPEED * animal.genes.speed * speedMultiplier;
      const moveDistance = effectiveSpeed * deltaSeconds;

      animal.position.x += normalizedX * moveDistance;
      animal.position.y += normalizedY * moveDistance;
    }
  }

  public static moveToward(
    animal: Animal,
    targetPosition: { x: number; y: number },
    speedMultiplier: number,
    deltaSeconds: number,
  ): void {
    const dx = targetPosition.x - animal.position.x;
    const dy = targetPosition.y - animal.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 5) {
      const normalizedX = dx / distance;
      const normalizedY = dy / distance;

      let effectiveSpeed =
        BASE_ANIMAL_SPEED * animal.genes.speed * speedMultiplier;

      const slowingRadius = 120;
      if (distance < slowingRadius) {
        effectiveSpeed *= distance / slowingRadius;
      }

      const moveDistance = effectiveSpeed * deltaSeconds;
      const step = Math.min(distance, moveDistance);
      animal.position.x += normalizedX * step;
      animal.position.y += normalizedY * step;
    }
  }

  public static wander(
    animal: Animal,
    speedMultiplier: number,
    deltaSeconds: number,
  ): void {
    let wanderAngle = this.wanderAngles.get(animal.id);
    if (wanderAngle === undefined) {
      wanderAngle = Math.random() * Math.PI * 2;
      this.wanderAngles.set(animal.id, wanderAngle);
    }

    if (Math.random() < 0.02) {
      animal.state = AnimalState.IDLE;
      return;
    }

    const wanderStrength = 0.1;
    wanderAngle += (Math.random() - 0.5) * wanderStrength;
    this.wanderAngles.set(animal.id, wanderAngle);

    const effectiveSpeed =
      BASE_ANIMAL_SPEED * animal.genes.speed * speedMultiplier;
    const moveDistance = effectiveSpeed * deltaSeconds;

    const dx = Math.cos(wanderAngle);
    const dy = Math.sin(wanderAngle);

    animal.position.x += dx * moveDistance;
    animal.position.y += dy * moveDistance;
  }

  public static seekFood(
    animal: Animal,
    availableResources: Array<{
      id: string;
      position: { x: number; y: number };
      type: string;
    }>,
    deltaSeconds: number,
    onConsume: (resourceId: string) => void,
  ): void {
    const config = getAnimalConfig(animal.type);
    if (!config || !config.consumesVegetation) return;

    if (!animal.currentTarget || animal.currentTarget.type !== "food") {
      if (availableResources.length > 0) {
        const target = availableResources[0];
        animal.currentTarget = { type: "food", id: target.id };
        animal.targetPosition = { x: target.position.x, y: target.position.y };
      } else {
        this.wander(animal, 0.5, deltaSeconds);
        return;
      }
    }

    if (animal.targetPosition) {
      const dx = animal.targetPosition.x - animal.position.x;
      const dy = animal.targetPosition.y - animal.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 30) {
        animal.state = AnimalState.EATING;
        const consumed = config.vegetationConsumptionRate;
        AnimalNeeds.feed(animal, consumed * 15);

        if (animal.currentTarget?.id) {
          onConsume(animal.currentTarget.id);
        }

        simulationEvents.emit(GameEventNames.ANIMAL_CONSUMED_RESOURCE, {
          animalId: animal.id,
          resourceType: "vegetation",
          amount: consumed,
          position: animal.position,
          biome: animal.biome,
        });

        animal.currentTarget = null;
        animal.targetPosition = null;
        animal.stateEndTime = Date.now() + 3000;
      } else {
        this.moveToward(
          animal,
          animal.targetPosition,
          config.speed * animal.genes.speed * 0.6,
          deltaSeconds,
        );
      }
    }
  }

  /**
   * Hunt prey (for predators)
   */
  public static huntPrey(
    animal: Animal,
    availablePrey: Animal[],
    deltaSeconds: number,
    onKill: (preyId: string) => void,
  ): void {
    const config = getAnimalConfig(animal.type);
    if (!config?.isPredator || !config.preyTypes) return;

    if (!animal.currentTarget || animal.currentTarget.type !== "food") {
      const prey = availablePrey.find((p) =>
        config.preyTypes!.includes(p.type),
      );

      if (prey) {
        animal.currentTarget = { type: "food", id: prey.id };
        animal.targetPosition = { ...prey.position };
        prey.isBeingHunted = true;
      } else {
        this.wander(animal, 0.7, deltaSeconds);
        return;
      }
    }

    if (animal.currentTarget && animal.targetPosition) {
      const prey = availablePrey.find((p) => p.id === animal.currentTarget!.id);
      if (!prey || prey.isDead) {
        animal.currentTarget = null;
        animal.targetPosition = null;
        return;
      }

      animal.targetPosition = { ...prey.position };

      const dx = prey.position.x - animal.position.x;
      const dy = prey.position.y - animal.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 25) {
        animal.state = AnimalState.EATING;
        const consumed = config.foodValue || 50;
        AnimalNeeds.feed(animal, consumed);

        onKill(prey.id);

        simulationEvents.emit(GameEventNames.ANIMAL_CONSUMED_RESOURCE, {
          animalId: animal.id,
          resourceType: "meat",
          amount: consumed,
          position: animal.position,
          biome: animal.biome,
        });

        animal.currentTarget = null;
        animal.targetPosition = null;
        animal.stateEndTime = Date.now() + 5000;
      } else {
        this.moveToward(
          animal,
          prey.position,
          config.speed * animal.genes.speed * 1.2,
          deltaSeconds,
        );
      }
    }
  }

  /**
   * Seek and consume water
   */
  public static seekWater(
    animal: Animal,
    availableWaterResources: Array<{
      id: string;
      position: { x: number; y: number };
    }>,
    deltaSeconds: number,
    onConsume: (resourceId: string) => void,
  ): void {
    const config = getAnimalConfig(animal.type);
    if (!config?.consumesWater) return;

    if (!animal.currentTarget || animal.currentTarget.type !== "water") {
      if (availableWaterResources.length > 0) {
        const target = availableWaterResources[0];
        animal.currentTarget = { type: "water", id: target.id };
        animal.targetPosition = { ...target.position };
      } else {
        this.wander(animal, 0.5, deltaSeconds);
        return;
      }
    }

    if (animal.targetPosition) {
      const dx = animal.targetPosition.x - animal.position.x;
      const dy = animal.targetPosition.y - animal.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 30) {
        animal.state = AnimalState.DRINKING;
        const consumed = config.waterConsumptionRate;
        AnimalNeeds.hydrate(animal, consumed * 20);

        if (animal.currentTarget?.id) {
          onConsume(animal.currentTarget.id);
        }

        simulationEvents.emit(GameEventNames.ANIMAL_CONSUMED_RESOURCE, {
          animalId: animal.id,
          resourceType: "water",
          amount: consumed,
          position: animal.position,
          biome: animal.biome,
        });

        animal.currentTarget = null;
        animal.targetPosition = null;
        animal.stateEndTime = Date.now() + 3000;
      } else {
        this.moveToward(
          animal,
          animal.targetPosition,
          config.speed * animal.genes.speed * 0.6,
          deltaSeconds,
        );
      }
    }
  }

  /**
   * Attempt to find mate and reproduce
   */
  public static attemptReproduction(
    animal: Animal,
    nearbyMates: Animal[],
    deltaSeconds: number,
    onOffspringCreated: (offspring: Animal) => void,
  ): void {
    const config = getAnimalConfig(animal.type);
    if (!config) return;

    const nearbyMate = nearbyMates.find(
      (other) =>
        other.type === animal.type &&
        other.id !== animal.id &&
        other.needs.reproductiveUrge > 70 &&
        // Ensure both animals are healthy enough to reproduce
        animal.needs.hunger > 50 &&
        animal.needs.thirst > 50 &&
        other.needs.hunger > 50 &&
        other.needs.thirst > 50,
    );

    if (nearbyMate) {
      const dx = nearbyMate.position.x - animal.position.x;
      const dy = nearbyMate.position.y - animal.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 30) {
        if (Math.random() < 0.2) {
          const offspringPosition = {
            x:
              (animal.position.x + nearbyMate.position.x) / 2 +
              (Math.random() - 0.5) * 20,
            y:
              (animal.position.y + nearbyMate.position.y) / 2 +
              (Math.random() - 0.5) * 20,
          };

          const offspringGenes = AnimalGenetics.breedGenes(
            animal.genes,
            nearbyMate.genes,
          );
          const generation =
            Math.max(animal.generation, nearbyMate.generation) + 1;

          const offspring: Animal = {
            id: `animal_${animal.type}_${Date.now()}_${Math.random()}`,
            type: animal.type,
            position: offspringPosition,
            state: AnimalState.IDLE,
            needs: {
              hunger: 100,
              thirst: 100,
              fear: 0,
              reproductiveUrge: 30,
            },
            genes: offspringGenes,
            generation,
            parentIds: [animal.id, nearbyMate.id],
            health: config.maxHealth * offspringGenes.health,
            age: 0,
            lastReproduction: Date.now() - 60000,
            spawnedAt: Date.now(),
            targetPosition: null,
            currentTarget: null,
            fleeTarget: null,
            biome: animal.biome,
            isDead: false,
          };

          AnimalNeeds.satisfyReproductiveUrge(animal);
          AnimalNeeds.satisfyReproductiveUrge(nearbyMate);

          simulationEvents.emit(GameEventNames.ANIMAL_REPRODUCED, {
            parentId: animal.id,
            partnerId: nearbyMate.id,
            offspringId: offspring.id,
            type: animal.type,
            position: offspringPosition,
            offspringGenes,
            generation,
          });

          onOffspringCreated(offspring);

          logger.info(
            `👶 Animal ${animal.type} reproduced: ${offspring.id} (gen ${generation})`,
          );
          animal.state = AnimalState.IDLE;
        }
      } else {
        this.moveToward(
          animal,
          nearbyMate.position,
          config.speed * animal.genes.speed * 0.6,
          deltaSeconds,
        );
      }
    } else {
      this.wander(animal, 0.4, deltaSeconds);
    }
  }
}
