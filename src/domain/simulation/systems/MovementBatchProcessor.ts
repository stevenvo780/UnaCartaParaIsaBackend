import type { EntityMovementState } from "./MovementSystem";

/**
 * Procesador batch optimizado para movimiento de entidades
 * Usa TypedArrays para procesamiento eficiente, preparado para migración a GPU
 */
export class MovementBatchProcessor {
  private positionBuffer: Float32Array | null = null; // [x0, y0, x1, y1, ...]
  private targetBuffer: Float32Array | null = null; // [targetX0, targetY0, ...]
  private velocityBuffer: Float32Array | null = null; // [vx0, vy0, ...]
  private fatigueBuffer: Float32Array | null = null; // [fatigue0, fatigue1, ...]
  private entityIdArray: string[] = [];
  private bufferDirty = true;

  private readonly BASE_MOVEMENT_SPEED = 60;
  private readonly FATIGUE_PENALTY_MULTIPLIER = 0.5;

  /**
   * Reconstruye los buffers desde un Map de estados de movimiento
   */
  public rebuildBuffers(
    movementStates: Map<string, EntityMovementState>,
  ): void {
    const entityCount = movementStates.size;
    if (entityCount === 0) {
      this.positionBuffer = null;
      this.targetBuffer = null;
      this.velocityBuffer = null;
      this.fatigueBuffer = null;
      this.entityIdArray = [];
      this.bufferDirty = false;
      return;
    }

    this.positionBuffer = new Float32Array(entityCount * 2);
    this.targetBuffer = new Float32Array(entityCount * 2);
    this.velocityBuffer = new Float32Array(entityCount * 2);
    this.fatigueBuffer = new Float32Array(entityCount);
    this.entityIdArray = new Array(entityCount);

    let index = 0;
    for (const [entityId, state] of movementStates.entries()) {
      const posOffset = index * 2;
      const velOffset = index * 2;

      this.positionBuffer[posOffset] = state.currentPosition.x;
      this.positionBuffer[posOffset + 1] = state.currentPosition.y;

      if (state.targetPosition) {
        this.targetBuffer[posOffset] = state.targetPosition.x;
        this.targetBuffer[posOffset + 1] = state.targetPosition.y;
      } else {
        this.targetBuffer[posOffset] = state.currentPosition.x;
        this.targetBuffer[posOffset + 1] = state.currentPosition.y;
      }

      this.velocityBuffer[velOffset] = 0;
      this.velocityBuffer[velOffset + 1] = 0;

      this.fatigueBuffer[index] = state.fatigue;

      this.entityIdArray[index] = entityId;
      index++;
    }

    this.bufferDirty = false;
  }

  /**
   * Actualiza todas las posiciones en batch
   */
  public updatePositionsBatch(deltaMs: number): {
    updated: boolean[];
    arrived: boolean[];
  } {
    if (
      !this.positionBuffer ||
      !this.targetBuffer ||
      !this.fatigueBuffer ||
      this.entityIdArray.length === 0
    ) {
      return { updated: [], arrived: [] };
    }

    const entityCount = this.entityIdArray.length;
    const updated = new Array<boolean>(entityCount).fill(false);
    const arrived = new Array<boolean>(entityCount).fill(false);

    for (let i = 0; i < entityCount; i++) {
      const posOffset = i * 2;
      const velOffset = i * 2;

      const currentX = this.positionBuffer[posOffset];
      const currentY = this.positionBuffer[posOffset + 1];
      const targetX = this.targetBuffer[posOffset];
      const targetY = this.targetBuffer[posOffset + 1];

      const dx = targetX - currentX;
      const dy = targetY - currentY;
      const distanceRemaining = Math.sqrt(dx * dx + dy * dy);

      if (distanceRemaining < 2) {
        this.positionBuffer[posOffset] = targetX;
        this.positionBuffer[posOffset + 1] = targetY;
        arrived[i] = true;
        updated[i] = true;
        continue;
      }

      const fatigue = this.fatigueBuffer[i];
      const fatigueMultiplier =
        1 / (1 + (fatigue / 100) * this.FATIGUE_PENALTY_MULTIPLIER);
      const effectiveSpeed = this.BASE_MOVEMENT_SPEED * fatigueMultiplier;
      const moveDistance = (effectiveSpeed * deltaMs) / 1000;

      if (moveDistance >= distanceRemaining) {
        this.positionBuffer[posOffset] = targetX;
        this.positionBuffer[posOffset + 1] = targetY;
        arrived[i] = true;
      } else {
        const ratio = moveDistance / distanceRemaining;
        this.positionBuffer[posOffset] += dx * ratio;
        this.positionBuffer[posOffset + 1] += dy * ratio;
      }

      const deltaX = this.positionBuffer[posOffset] - currentX;
      const deltaY = this.positionBuffer[posOffset + 1] - currentY;
      if (this.velocityBuffer) {
        this.velocityBuffer[velOffset] = (deltaX / deltaMs) * 1000;
        this.velocityBuffer[velOffset + 1] = (deltaY / deltaMs) * 1000;
      }

      updated[i] = true;
    }

    this.bufferDirty = true;
    return { updated, arrived };
  }

  /**
   * Actualiza fatiga en batch
   */
  public updateFatigueBatch(
    isMoving: boolean[],
    isResting: boolean[],
    deltaMs: number,
  ): void {
    if (!this.fatigueBuffer || this.entityIdArray.length === 0) return;

    const entityCount = this.entityIdArray.length;
    const fatigueDecayRate = 0.1 * (deltaMs / 1000);
    const fatigueRestRate = 0.5 * (deltaMs / 1000);

    for (let i = 0; i < entityCount; i++) {
      if (isMoving[i]) {
        this.fatigueBuffer[i] = Math.min(100, this.fatigueBuffer[i] + 0.1);
      } else if (isResting[i]) {
        this.fatigueBuffer[i] = Math.max(
          0,
          this.fatigueBuffer[i] - fatigueRestRate,
        );
      } else {
        this.fatigueBuffer[i] = Math.max(
          0,
          this.fatigueBuffer[i] - fatigueDecayRate,
        );
      }
    }

    this.bufferDirty = true;
  }

  /**
   * Sincroniza los buffers de vuelta a los estados de movimiento
   */
  public syncToStates(movementStates: Map<string, EntityMovementState>): void {
    if (
      !this.positionBuffer ||
      !this.fatigueBuffer ||
      this.entityIdArray.length === 0
    ) {
      return;
    }

    const entityCount = this.entityIdArray.length;

    for (let i = 0; i < entityCount; i++) {
      const entityId = this.entityIdArray[i];
      const state = movementStates.get(entityId);
      if (!state) continue;

      const posOffset = i * 2;

      state.currentPosition.x = this.positionBuffer[posOffset];
      state.currentPosition.y = this.positionBuffer[posOffset + 1];

      state.fatigue = this.fatigueBuffer[i];
    }
  }

  /**
   * Obtiene el buffer de posiciones
   */
  public getPositionBuffer(): Float32Array | null {
    return this.positionBuffer;
  }

  /**
   * Obtiene el buffer de targets
   */
  public getTargetBuffer(): Float32Array | null {
    return this.targetBuffer;
  }

  /**
   * Obtiene el buffer de fatiga
   */
  public getFatigueBuffer(): Float32Array | null {
    return this.fatigueBuffer;
  }

  /**
   * Obtiene el array de IDs de entidades
   */
  public getEntityIdArray(): string[] {
    return this.entityIdArray;
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
