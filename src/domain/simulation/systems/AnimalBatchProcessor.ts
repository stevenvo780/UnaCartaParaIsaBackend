import type { Animal } from "../../types/simulation/animals";
import { logger } from "../../../infrastructure/utils/logger";
import type { GPUComputeService } from "../core/GPUComputeService";
import { inject, injectable, optional } from "inversify";
import { TYPES } from "../../../config/Types";

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
  private animalIdArray: string[] = [];
  private bufferDirty = true;

  private readonly NEED_COUNT = 4;
  private gpuService?: GPUComputeService;

  constructor(
    @inject(TYPES.GPUComputeService) @optional() gpuService?: GPUComputeService,
  ) {
    this.gpuService = gpuService;
  }

  public rebuildBuffers(animals: Map<string, Animal>): void {
    const animalCount = animals.size;
    if (animalCount === 0) {
      this.positionBuffer = null;
      this.needsBuffer = null;
      this.ageBuffer = null;
      this.healthBuffer = null;
      this.animalIdArray = [];
      this.bufferDirty = false;
      return;
    }

    this.positionBuffer = new Float32Array(animalCount * 2);
    this.needsBuffer = new Float32Array(animalCount * this.NEED_COUNT);
    this.ageBuffer = new Float32Array(animalCount);
    this.healthBuffer = new Float32Array(animalCount);
    this.animalIdArray = new Array<string>(animalCount);

    let index = 0;
    for (const [animalId, animal] of animals.entries()) {
      const posOffset = index * 2;
      const needsOffset = index * this.NEED_COUNT;

      this.positionBuffer[posOffset] = animal.position.x;
      this.positionBuffer[posOffset + 1] = animal.position.y;

      this.needsBuffer[needsOffset + 0] = animal.needs.hunger;
      this.needsBuffer[needsOffset + 1] = animal.needs.thirst;
      this.needsBuffer[needsOffset + 2] = animal.needs.fear;
      this.needsBuffer[needsOffset + 3] = animal.needs.reproductiveUrge;

      this.ageBuffer[index] = animal.age;
      this.healthBuffer[index] = animal.health;

      this.animalIdArray[index] = animalId;
      index++;
    }

    this.bufferDirty = false;
  }

  public updateNeedsBatch(
    hungerDecayRates: Float32Array,
    thirstDecayRates: Float32Array,
    deltaMinutes: number,
  ): void {
    if (!this.needsBuffer || this.animalIdArray.length === 0) return;

    // Intentar usar GPU si está disponible
    if (this.gpuService?.isGPUAvailable()) {
      try {
        // Convertir deltaMinutes a deltaSeconds para GPUComputeService
        const deltaSeconds = deltaMinutes * 60;

        // Crear decayRates array para GPUComputeService (necesita un array por necesidad)
        // Para animales: [hungerDecay, thirstDecay, fearDecay, reproductiveUrgeDecay]
        const animalCount = this.animalIdArray.length;
        const decayRates = new Float32Array(this.NEED_COUNT);
        decayRates[0] = hungerDecayRates[0] || 0; // Usar primer valor como tasa base
        decayRates[1] = thirstDecayRates[0] || 0;
        decayRates[2] = 0.5 / 60; // Fear decay rate (0.5 por minuto = 0.5/60 por segundo)
        decayRates[3] = 0;

        const ageMultipliers = new Float32Array(animalCount).fill(1.0);
        const divineModifiers = new Float32Array(animalCount).fill(1.0);

        // Aplicar decay usando GPU
        const newNeeds = this.gpuService.applyNeedsDecayBatch(
          this.needsBuffer,
          decayRates,
          ageMultipliers,
          divineModifiers,
          this.NEED_COUNT,
          deltaSeconds,
        );

        // Aplicar decay específico por animal para hunger y thirst
        // (ya que tienen tasas individuales)
        for (let i = 0; i < animalCount; i++) {
          const needsOffset = i * this.NEED_COUNT;
          const hungerDecay = hungerDecayRates[i] * deltaMinutes;
          newNeeds[needsOffset + 0] = Math.max(
            0,
            newNeeds[needsOffset + 0] - hungerDecay,
          );

          const thirstDecay = thirstDecayRates[i] * deltaMinutes;
          newNeeds[needsOffset + 1] = Math.max(
            0,
            newNeeds[needsOffset + 1] - thirstDecay,
          );
        }

        this.needsBuffer = newNeeds;
        this.bufferDirty = true;
        return;
      } catch (error) {
        logger.warn(
          `⚠️ Error en GPU updateNeedsBatch, usando CPU fallback: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Continuar con CPU fallback
      }
    }

    // Fallback a CPU
    const animalCount = this.animalIdArray.length;

    for (let i = 0; i < animalCount; i++) {
      const needsOffset = i * this.NEED_COUNT;

      const hungerDecay = hungerDecayRates[i] * deltaMinutes;
      this.needsBuffer[needsOffset + 0] = Math.max(
        0,
        this.needsBuffer[needsOffset + 0] - hungerDecay,
      );

      const thirstDecay = thirstDecayRates[i] * deltaMinutes;
      this.needsBuffer[needsOffset + 1] = Math.max(
        0,
        this.needsBuffer[needsOffset + 1] - thirstDecay,
      );

      this.needsBuffer[needsOffset + 2] = Math.max(
        0,
        this.needsBuffer[needsOffset + 2] - 0.5 * deltaMinutes,
      );
    }

    this.bufferDirty = true;
  }

  public updateAgesBatch(ageIncrement: number): void {
    if (!this.ageBuffer || this.animalIdArray.length === 0) return;

    const animalCount = this.animalIdArray.length;

    for (let i = 0; i < animalCount; i++) {
      this.ageBuffer[i] += ageIncrement;
    }

    this.bufferDirty = true;
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
      const animal = animals.get(animalId);
      if (!animal) continue;

      const posOffset = i * 2;
      const needsOffset = i * this.NEED_COUNT;

      animal.position.x = this.positionBuffer[posOffset];
      animal.position.y = this.positionBuffer[posOffset + 1];

      animal.needs.hunger = this.needsBuffer[needsOffset + 0];
      animal.needs.thirst = this.needsBuffer[needsOffset + 1];
      animal.needs.fear = this.needsBuffer[needsOffset + 2];
      animal.needs.reproductiveUrge = this.needsBuffer[needsOffset + 3];

      animal.age = this.ageBuffer[i];
      animal.health = this.healthBuffer[i];
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
