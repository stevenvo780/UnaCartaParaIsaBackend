import { logger } from "@/infrastructure/utils/logger";
import type { Animal } from "@/shared/types/simulation/animals";
import { getAnimalConfig } from "../config/AnimalConfigs";
import { AnimalNeeds } from "./AnimalNeeds";
import { AnimalGenetics } from "./AnimalGenetics";
import { simulationEvents, GameEventType } from "../../../core/events";
import {
  AnimalState,
  AnimalTargetType,
} from "../../../../../shared/constants/AnimalEnums";
import { MapElementType } from "../../../../../shared/constants/MapElementEnums";

const BASE_ANIMAL_SPEED = 60;

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

    if (
      !animal.currentTarget ||
      animal.currentTarget.type !== AnimalTargetType.FOOD
    ) {
      if (availableResources.length > 0) {
        const target = availableResources[0];
        animal.currentTarget = { type: AnimalTargetType.FOOD, id: target.id };
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

        simulationEvents.emit(GameEventType.ANIMAL_CONSUMED_RESOURCE, {
          animalId: animal.id,
          resourceType: MapElementType.VEGETATION,
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
   * Now deals damage instead of instant kill - prey must be worn down
   * @param onDamage callback receives (preyId, damageAmount)
   */
  public static huntPrey(
    animal: Animal,
    availablePrey: Animal[],
    deltaSeconds: number,
    onDamage: (preyId: string, damage: number) => void,
  ): void {
    const config = getAnimalConfig(animal.type);
    if (!config?.isPredator || !config.preyTypes) return;

    if (
      !animal.currentTarget ||
      animal.currentTarget.type !== AnimalTargetType.FOOD
    ) {
      const prey = availablePrey
        .filter((p) => config.preyTypes!.includes(p.type) && !p.isDead)
        .sort((a, b) => {
          const aConfig = getAnimalConfig(a.type);
          const bConfig = getAnimalConfig(b.type);
          const aMaxHealth = (aConfig?.maxHealth || 100) * a.genes.health;
          const bMaxHealth = (bConfig?.maxHealth || 100) * b.genes.health;
          const aHealthPct = a.health / aMaxHealth;
          const bHealthPct = b.health / bMaxHealth;
          return aHealthPct - bHealthPct;
        })[0];

      if (prey) {
        animal.currentTarget = { type: AnimalTargetType.FOOD, id: prey.id };
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
        const attackDamage = (config.attackDamage || 15) * animal.genes.size;
        onDamage(prey.id, attackDamage);

        animal.stateEndTime = Date.now() + 1500;

        prey.state = AnimalState.FLEEING;
        prey.fleeTarget = animal.id;
        prey.needs.fear = 100;
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

    if (
      !animal.currentTarget ||
      animal.currentTarget.type !== AnimalTargetType.WATER
    ) {
      if (availableWaterResources.length > 0) {
        const target = availableWaterResources[0];
        animal.currentTarget = { type: AnimalTargetType.WATER, id: target.id };
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

        simulationEvents.emit(GameEventType.ANIMAL_CONSUMED_RESOURCE, {
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
        other.needs.reproductiveUrge > 60 &&
        animal.needs.hunger > 40 &&
        animal.needs.thirst > 40 &&
        other.needs.hunger > 40 &&
        other.needs.thirst > 40,
    );

    if (nearbyMate) {
      const dx = nearbyMate.position.x - animal.position.x;
      const dy = nearbyMate.position.y - animal.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 50) {
        if (Math.random() < 0.35) {
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

          simulationEvents.emit(GameEventType.ANIMAL_REPRODUCED, {
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
