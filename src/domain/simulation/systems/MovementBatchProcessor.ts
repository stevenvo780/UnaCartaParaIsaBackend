import type { EntityMovementState } from "./MovementSystem";
import { logger } from "../../../infrastructure/utils/logger";
import type { GPUComputeService } from "../core/GPUComputeService";
import { inject, injectable, optional } from "inversify";
import { TYPES } from "../../../config/Types";

/**
 * Procesador batch optimizado para movimiento de entidades
 * Usa GPU cuando está disponible, fallback a CPU
 */
@injectable()
export class MovementBatchProcessor {
  private positionBuffer: Float32Array | null = null;
  private targetBuffer: Float32Array | null = null;
  private velocityBuffer: Float32Array | null = null;
  private fatigueBuffer: Float32Array | null = null;
  private entityIdArray: string[] = [];
  private bufferDirty = true;

  private readonly BASE_MOVEMENT_SPEED = 60;
  private readonly FATIGUE_PENALTY_MULTIPLIER = 0.5;
  private gpuService?: GPUComputeService;

  constructor(
    @inject(TYPES.GPUComputeService) @optional() gpuService?: GPUComputeService,
  ) {
    this.gpuService = gpuService;
  }

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
    this.entityIdArray = new Array<string>(entityCount);

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
    const updated = new Array<boolean>(entityCount).fill(true);

    // Intentar usar GPU si está disponible
    if (this.gpuService?.isGPUAvailable()) {
      try {
        const speeds = new Float32Array(entityCount).fill(
          this.BASE_MOVEMENT_SPEED,
        );
        const result = this.gpuService.updatePositionsBatch(
          this.positionBuffer,
          this.targetBuffer,
          speeds,
          this.fatigueBuffer,
          deltaMs,
        );

        // Actualizar buffers con resultados de GPU
        this.positionBuffer = result.newPositions;
        this.bufferDirty = true;

        // Calcular velocidades
        if (this.velocityBuffer) {
          for (let i = 0; i < entityCount; i++) {
            const posOffset = i * 2;
            const velOffset = i * 2;
            const currentX = this.positionBuffer[posOffset];
            const currentY = this.positionBuffer[posOffset + 1];

            // Necesitamos las posiciones anteriores para calcular velocidad
            // Por ahora, calculamos basado en el movimiento
            const targetX = this.targetBuffer[posOffset];
            const targetY = this.targetBuffer[posOffset + 1];
            const dx = targetX - currentX;
            const dy = targetY - currentY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0.001) {
              const speed = this.BASE_MOVEMENT_SPEED;
              this.velocityBuffer[velOffset] = (dx / distance) * speed;
              this.velocityBuffer[velOffset + 1] = (dy / distance) * speed;
            } else {
              this.velocityBuffer[velOffset] = 0;
              this.velocityBuffer[velOffset + 1] = 0;
            }
          }
        }

        return { updated, arrived: result.arrived };
      } catch (error) {
        logger.warn(
          `⚠️ Error en GPU updatePositionsBatch, usando CPU fallback: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Continuar con CPU fallback
      }
    }

    // Fallback a CPU
    const arrived = new Array<boolean>(entityCount).fill(false);

    for (let i = 0; i < entityCount; i++) {
      const posOffset = i * 2;
      const velOffset = i * 2;

      const currentX = this.positionBuffer![posOffset];
      const currentY = this.positionBuffer![posOffset + 1];
      const targetX = this.targetBuffer![posOffset];
      const targetY = this.targetBuffer![posOffset + 1];

      const dx = targetX - currentX;
      const dy = targetY - currentY;
      const distanceRemaining = Math.sqrt(dx * dx + dy * dy);

      if (distanceRemaining < 2) {
        this.positionBuffer![posOffset] = targetX;
        this.positionBuffer![posOffset + 1] = targetY;
        arrived[i] = true;
        continue;
      }

      const fatigue = this.fatigueBuffer![i];
      const fatigueMultiplier =
        1 / (1 + (fatigue / 100) * this.FATIGUE_PENALTY_MULTIPLIER);
      const effectiveSpeed = this.BASE_MOVEMENT_SPEED * fatigueMultiplier;
      const moveDistance = (effectiveSpeed * deltaMs) / 1000;

      if (moveDistance >= distanceRemaining) {
        this.positionBuffer![posOffset] = targetX;
        this.positionBuffer![posOffset + 1] = targetY;
        arrived[i] = true;
      } else {
        const ratio = moveDistance / distanceRemaining;
        this.positionBuffer![posOffset] += dx * ratio;
        this.positionBuffer![posOffset + 1] += dy * ratio;
      }

      const deltaX = this.positionBuffer![posOffset] - currentX;
      const deltaY = this.positionBuffer![posOffset + 1] - currentY;
      if (this.velocityBuffer) {
        this.velocityBuffer[velOffset] = (deltaX / deltaMs) * 1000;
        this.velocityBuffer[velOffset + 1] = (deltaY / deltaMs) * 1000;
      }
    }

    this.bufferDirty = true;
    return { updated, arrived };
  }

  public updateFatigueBatch(
    isMoving: boolean[],
    isResting: boolean[],
    deltaMs: number,
  ): void {
    if (!this.fatigueBuffer || this.entityIdArray.length === 0) return;

    // Intentar usar GPU si está disponible
    if (this.gpuService?.isGPUAvailable()) {
      try {
        const newFatigue = this.gpuService.updateFatigueBatch(
          this.fatigueBuffer,
          isMoving,
          isResting,
          deltaMs,
        );
        this.fatigueBuffer = newFatigue;
        this.bufferDirty = true;
        return;
      } catch (error) {
        logger.warn(
          `⚠️ Error en GPU updateFatigueBatch, usando CPU fallback: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Continuar con CPU fallback
      }
    }

    // Fallback a CPU
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

  public getPositionBuffer(): Float32Array | null {
    return this.positionBuffer;
  }

  public getTargetBuffer(): Float32Array | null {
    return this.targetBuffer;
  }

  public getFatigueBuffer(): Float32Array | null {
    return this.fatigueBuffer;
  }

  public getEntityIdArray(): string[] {
    return this.entityIdArray;
  }

  public markDirty(): void {
    this.bufferDirty = true;
  }

  public isDirty(): boolean {
    return this.bufferDirty;
  }
}
