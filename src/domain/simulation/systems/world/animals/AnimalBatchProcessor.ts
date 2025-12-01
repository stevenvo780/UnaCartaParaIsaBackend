import type { Animal } from "../../../../types/simulation/animals";
import { logger } from "../../../../../infrastructure/utils/logger";
import { getAnimalConfig } from "../config/AnimalConfigs";
import type { GPUComputeService } from "../../../core/GPUComputeService";
import { injectable } from "inversify";
import { performance } from "node:perf_hooks";
import { performanceMonitor } from "../../../core/PerformanceMonitor";

/**
 * Procesador batch optimizado para animales
 * Usa GPU cuando está disponible, fallback a CPU
 */
@injectable()
export class AnimalBatchProcessor {
  private positionBuffer: Float32Array | null = null;
  private needsBuffer: Float32Array | null = null;
  private ageBuffer: Float32Array | null = null;
  private healthBuffer: Float32Array | null = null;
  private maxHealthBuffer: Float32Array | null = null;
  private animalIdArray: string[] = [];
  private bufferDirty = true;

  private readonly NEED_COUNT = 4;
  // @ts-expect-error - Reserved for future GPU acceleration
  private _gpuService?: GPUComputeService;

  constructor(_gpuService?: GPUComputeService) {
    this._gpuService = _gpuService;
    if (_gpuService?.isGPUAvailable()) {
      logger.info(
        "🐾 AnimalBatchProcessor: GPU service connected and available",
      );
    } else {
      logger.info(
        "🐾 AnimalBatchProcessor: Using CPU fallback (no GPU service)",
      );
    }
  }

  /**
   * Threshold for buffer reallocation (20% size change).
   * Avoids recreating buffers every frame when animal count fluctuates slightly.
   */
  private readonly REALLOC_THRESHOLD = 0.2;
  private lastBufferSize = 0;

  public rebuildBuffers(animals: Map<string, Animal>): void {
    const animalCount = animals.size;
    if (animalCount === 0) {
      this.positionBuffer = null;
      this.needsBuffer = null;
      this.ageBuffer = null;
      this.healthBuffer = null;
      this.maxHealthBuffer = null;
      this.animalIdArray = [];
      this.lastBufferSize = 0;
      this.bufferDirty = false;
      return;
    }

    const sizeDiff = Math.abs(animalCount - this.lastBufferSize);
    const needsRealloc =
      !this.positionBuffer ||
      !this.needsBuffer ||
      !this.ageBuffer ||
      !this.healthBuffer ||
      !this.maxHealthBuffer ||
      sizeDiff > this.lastBufferSize * this.REALLOC_THRESHOLD;

    if (needsRealloc) {
      const capacity = Math.ceil(animalCount * 1.1);
      this.positionBuffer = new Float32Array(capacity * 2);
      this.needsBuffer = new Float32Array(capacity * this.NEED_COUNT);
      this.ageBuffer = new Float32Array(capacity);
      this.healthBuffer = new Float32Array(capacity);
      this.maxHealthBuffer = new Float32Array(capacity);
      this.animalIdArray = new Array<string>(capacity);
      this.lastBufferSize = animalCount;
    }

    if (this.animalIdArray.length < animalCount) {
      this.animalIdArray = new Array<string>(Math.ceil(animalCount * 1.1));
    }

    const positionBuffer = this.positionBuffer!;
    const needsBuffer = this.needsBuffer!;
    const ageBuffer = this.ageBuffer!;
    const healthBuffer = this.healthBuffer!;
    const maxHealthBuffer = this.maxHealthBuffer!;

    let index = 0;
    for (const [animalId, animal] of animals.entries()) {
      const posOffset = index * 2;
      const needsOffset = index * this.NEED_COUNT;

      positionBuffer[posOffset] = animal.position.x;
      positionBuffer[posOffset + 1] = animal.position.y;

      needsBuffer[needsOffset + 0] = animal.needs.hunger;
      needsBuffer[needsOffset + 1] = animal.needs.thirst;
      needsBuffer[needsOffset + 2] = animal.needs.fear;
      needsBuffer[needsOffset + 3] = animal.needs.reproductiveUrge;

      ageBuffer[index] = animal.age;
      healthBuffer[index] = animal.health;

      const config = getAnimalConfig(animal.type);
      maxHealthBuffer[index] = config
        ? config.maxHealth * animal.genes.health
        : animal.health;

      this.animalIdArray[index] = animalId;
      index++;
    }

    this.bufferDirty = false;
  }

  private workBuffer: Float32Array | null = null;

  public updateNeedsBatch(
    hungerDecayRates: Float32Array,
    thirstDecayRates: Float32Array,
    deltaMinutes: number,
  ): void {
    const startTime = performance.now();
    if (
      !this.needsBuffer ||
      !this.healthBuffer ||
      !this.maxHealthBuffer ||
      this.animalIdArray.length === 0
    )
      return;

    const requiredSize = this.needsBuffer.length;
    if (!this.workBuffer || this.workBuffer.length !== requiredSize) {
      this.workBuffer = new Float32Array(requiredSize);
    }

    this.workBuffer.set(this.needsBuffer);
    const workBuffer = this.workBuffer;

    const fearDecayRate = 0.5 / 60;

    const animalCount = this.animalIdArray.length;

    for (let i = 0; i < animalCount; i++) {
      const offset = i * this.NEED_COUNT;

      const hungerRate = hungerDecayRates[i];
      const thirstRate = thirstDecayRates[i];

      workBuffer[offset + 0] = Math.max(
        0,
        workBuffer[offset + 0] - hungerRate * deltaMinutes,
      );
      workBuffer[offset + 1] = Math.max(
        0,
        workBuffer[offset + 1] - thirstRate * deltaMinutes,
      );
      workBuffer[offset + 2] = Math.max(
        0,
        workBuffer[offset + 2] - fearDecayRate * deltaMinutes,
      );

      const currentHunger = workBuffer[offset + 0];
      const currentThirst = workBuffer[offset + 1];

      if (currentHunger > 80 && currentThirst > 80) {
        const maxHealth = this.maxHealthBuffer![i];
        const currentHealth = this.healthBuffer![i];

        if (currentHealth < maxHealth) {
          const recoveryRate = maxHealth * 0.05;
          this.healthBuffer![i] = Math.min(
            maxHealth,
            currentHealth + recoveryRate * deltaMinutes,
          );
        }
      }
    }

    this.needsBuffer = workBuffer;
    this.bufferDirty = true;

    const duration = performance.now() - startTime;
    performanceMonitor.recordBatchProcessing(
      "animal",
      animalCount,
      duration,
      false,
    );
  }

  public updateAgesBatch(ageIncrement: number): void {
    const startTime = performance.now();
    if (!this.ageBuffer || this.animalIdArray.length === 0) return;

    const animalCount = this.animalIdArray.length;

    for (let i = 0; i < animalCount; i++) {
      this.ageBuffer[i] += ageIncrement;
    }

    this.bufferDirty = true;

    const duration = performance.now() - startTime;
    performanceMonitor.recordBatchProcessing(
      "animal",
      animalCount,
      duration,
      false,
    );
  }

  public syncToAnimals(animals: Map<string, Animal>): void {
    if (
      !this.positionBuffer ||
      !this.needsBuffer ||
      !this.ageBuffer ||
      !this.healthBuffer ||
      this.animalIdArray.length === 0
    ) {
      return;
    }

    const animalCount = this.animalIdArray.length;

    for (let i = 0; i < animalCount; i++) {
      const animalId = this.animalIdArray[i];

      if (!animalId) continue;

      const animal = animals.get(animalId);
      if (!animal) continue;

      const posOffset = i * 2;
      const needsOffset = i * this.NEED_COUNT;

      const posX = this.positionBuffer[posOffset];
      const posY = this.positionBuffer[posOffset + 1];
      const hunger = this.needsBuffer[needsOffset + 0];
      const thirst = this.needsBuffer[needsOffset + 1];
      const fear = this.needsBuffer[needsOffset + 2];
      const reproUrge = this.needsBuffer[needsOffset + 3];
      const age = this.ageBuffer[i];
      const health = this.healthBuffer[i];

      if (Number.isFinite(posX)) animal.position.x = posX;
      if (Number.isFinite(posY)) animal.position.y = posY;
      if (Number.isFinite(hunger)) animal.needs.hunger = hunger;
      if (Number.isFinite(thirst)) animal.needs.thirst = thirst;
      if (Number.isFinite(fear)) animal.needs.fear = fear;
      if (Number.isFinite(reproUrge)) animal.needs.reproductiveUrge = reproUrge;
      if (Number.isFinite(age)) animal.age = age;
      if (Number.isFinite(health)) animal.health = health;
    }
  }

  public getPositionBuffer(): Float32Array | null {
    return this.positionBuffer;
  }

  public getNeedsBuffer(): Float32Array | null {
    return this.needsBuffer;
  }

  public getAnimalIdArray(): string[] {
    return this.animalIdArray;
  }

  public markDirty(): void {
    this.bufferDirty = true;
  }

  public isDirty(): boolean {
    return this.bufferDirty;
  }
}
