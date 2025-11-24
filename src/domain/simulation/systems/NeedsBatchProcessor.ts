import type { EntityNeedsData } from "../../types/simulation/needs";

/**
 * Procesador batch optimizado para necesidades de entidades
 * Usa TypedArrays para procesamiento eficiente, preparado para migración a GPU
 */
export class NeedsBatchProcessor {
  private needsBuffer: Float32Array | null = null;
  private entityIdArray: string[] = [];
  private readonly NEED_COUNT = 7; // hunger, thirst, energy, hygiene, social, fun, mentalHealth
  private bufferDirty = true;

  /**
   * Reconstruye los buffers desde un Map de necesidades
   */
  public rebuildBuffers(entityNeeds: Map<string, EntityNeedsData>): void {
    const entityCount = entityNeeds.size;
    if (entityCount === 0) {
      this.needsBuffer = null;
      this.entityIdArray = [];
      this.bufferDirty = false;
      return;
    }

    this.needsBuffer = new Float32Array(entityCount * this.NEED_COUNT);
    this.entityIdArray = new Array(entityCount);

    let index = 0;
    for (const [entityId, needs] of entityNeeds.entries()) {
      const offset = index * this.NEED_COUNT;
      this.needsBuffer[offset + 0] = needs.hunger;
      this.needsBuffer[offset + 1] = needs.thirst;
      this.needsBuffer[offset + 2] = needs.energy;
      this.needsBuffer[offset + 3] = needs.hygiene;
      this.needsBuffer[offset + 4] = needs.social;
      this.needsBuffer[offset + 5] = needs.fun;
      this.needsBuffer[offset + 6] = needs.mentalHealth;

      this.entityIdArray[index] = entityId;
      index++;
    }

    this.bufferDirty = false;
  }

  /**
   * Aplica decaimiento a todas las necesidades en batch
   */
  public applyDecayBatch(
    decayRates: Float32Array, // Array de 7 elementos con las tasas de decaimiento
    ageMultipliers: Float32Array, // Multiplicador por edad para cada entidad
    divineModifiers: Float32Array, // Modificador divino para cada entidad
    deltaSeconds: number,
  ): void {
    if (!this.needsBuffer || this.entityIdArray.length === 0) return;

    const entityCount = this.entityIdArray.length;

    for (let i = 0; i < entityCount; i++) {
      const offset = i * this.NEED_COUNT;
      const ageMult = ageMultipliers[i] || 1.0;
      const divineMult = divineModifiers[i] || 1.0;
      const finalMultiplier = ageMult * divineMult;

      for (let needIdx = 0; needIdx < this.NEED_COUNT; needIdx++) {
        const rate = decayRates[needIdx] * finalMultiplier;
        const currentValue = this.needsBuffer[offset + needIdx];
        this.needsBuffer[offset + needIdx] = Math.max(
          0,
          currentValue - rate * deltaSeconds,
        );
      }
    }

    this.bufferDirty = true;
  }

  /**
   * Aplica cross-effects en batch
   */
  public applyCrossEffectsBatch(): void {
    if (!this.needsBuffer || this.entityIdArray.length === 0) return;

    const entityCount = this.entityIdArray.length;

    for (let i = 0; i < entityCount; i++) {
      const offset = i * this.NEED_COUNT;

      const energy = this.needsBuffer[offset + 2];
      if (energy < 30) {
        const penalty = (30 - energy) * 0.02;
        this.needsBuffer[offset + 4] = Math.max(
          0,
          this.needsBuffer[offset + 4] - penalty,
        );
        this.needsBuffer[offset + 5] = Math.max(
          0,
          this.needsBuffer[offset + 5] - penalty,
        );
        this.needsBuffer[offset + 6] = Math.max(
          0,
          this.needsBuffer[offset + 6] - penalty * 1.5,
        );
      }

      const hunger = this.needsBuffer[offset + 0];
      if (hunger < 40) {
        const hungerPenalty = (40 - hunger) * 0.03;
        this.needsBuffer[offset + 2] = Math.max(
          0,
          this.needsBuffer[offset + 2] - hungerPenalty,
        );
        this.needsBuffer[offset + 6] = Math.max(
          0,
          this.needsBuffer[offset + 6] - hungerPenalty * 0.5,
        );
      }

      const thirst = this.needsBuffer[offset + 1];
      if (thirst < 30) {
        const thirstPenalty = (30 - thirst) * 0.05;
        this.needsBuffer[offset + 2] = Math.max(
          0,
          this.needsBuffer[offset + 2] - thirstPenalty * 2,
        );
        this.needsBuffer[offset + 6] = Math.max(
          0,
          this.needsBuffer[offset + 6] - thirstPenalty,
        );
      }
    }

    this.bufferDirty = true;
  }

  /**
   * Sincroniza los buffers de vuelta al Map de necesidades
   */
  public syncToMap(entityNeeds: Map<string, EntityNeedsData>): void {
    if (!this.needsBuffer || this.entityIdArray.length === 0) return;

    const entityCount = this.entityIdArray.length;

    for (let i = 0; i < entityCount; i++) {
      const entityId = this.entityIdArray[i];
      const needs = entityNeeds.get(entityId);
      if (!needs) continue;

      const offset = i * this.NEED_COUNT;
      needs.hunger = this.needsBuffer[offset + 0];
      needs.thirst = this.needsBuffer[offset + 1];
      needs.energy = this.needsBuffer[offset + 2];
      needs.hygiene = this.needsBuffer[offset + 3];
      needs.social = this.needsBuffer[offset + 4];
      needs.fun = this.needsBuffer[offset + 5];
      needs.mentalHealth = this.needsBuffer[offset + 6];
    }
  }

  /**
   * Obtiene el buffer de necesidades (útil para migración a GPU)
   */
  public getNeedsBuffer(): Float32Array | null {
    return this.needsBuffer;
  }

  /**
   * Obtiene el array de IDs de entidades
   */
  public getEntityIdArray(): string[] {
    return this.entityIdArray;
  }

  /**
   * Obtiene el valor de una necesidad específica para una entidad
   */
  public getNeedValue(entityIndex: number, needIndex: number): number {
    if (
      !this.needsBuffer ||
      entityIndex < 0 ||
      entityIndex >= this.entityIdArray.length
    ) {
      return 0;
    }
    const offset = entityIndex * this.NEED_COUNT;
    return this.needsBuffer[offset + needIndex];
  }

  /**
   * Establece el valor de una necesidad específica para una entidad
   */
  public setNeedValue(
    entityIndex: number,
    needIndex: number,
    value: number,
  ): void {
    if (
      !this.needsBuffer ||
      entityIndex < 0 ||
      entityIndex >= this.entityIdArray.length
    ) {
      return;
    }
    const offset = entityIndex * this.NEED_COUNT;
    this.needsBuffer[offset + needIndex] = Math.max(0, Math.min(100, value));
    this.bufferDirty = true;
  }

  /**
   * Marca los buffers como dirty
   */
  public markDirty(): void {
    this.bufferDirty = true;
  }

  /**
   * Verifica si los buffers están dirty
   */
  public isDirty(): boolean {
    return this.bufferDirty;
  }
}
