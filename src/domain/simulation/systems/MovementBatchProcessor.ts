import type { EntityMovementState } from "./MovementSystem";
import { logger } from "../../../infrastructure/utils/logger";
import type { GPUComputeService } from "../core/GPUComputeService";
import { injectable } from "inversify";

/**
 * Batch processor for entity movement calculations.
 * Uses GPU when available, falls back to CPU for compatibility.
 *
 * Processes position updates, velocity calculations, and fatigue in vectorized batches
 * for improved performance with large entity counts.
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

  constructor(gpuService?: GPUComputeService) {
    this.gpuService = gpuService;
    if (gpuService?.isGPUAvailable()) {
      logger.info(
        "🚶 MovementBatchProcessor: GPU service connected and available",
      );
    } else {
      logger.info(
        "🚶 MovementBatchProcessor: Using CPU fallback (no GPU service)",
      );
    }
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

    const workPositions = new Float32Array(this.positionBuffer);
    const workVelocities = this.velocityBuffer
      ? new Float32Array(this.velocityBuffer)
      : new Float32Array(entityCount * 2);

    if (this.gpuService?.isGPUAvailable()) {
      try {
        const speeds = new Float32Array(entityCount).fill(
          this.BASE_MOVEMENT_SPEED,
        );
        const result = this.gpuService.updatePositionsBatch(
          workPositions,
          this.targetBuffer,
          speeds,
          this.fatigueBuffer,
          deltaMs,
        );

        this.positionBuffer = result.newPositions;

        for (let i = 0; i < entityCount; i++) {
          const posOffset = i * 2;
          const velOffset = i * 2;
          const currentX = this.positionBuffer[posOffset];
          const currentY = this.positionBuffer[posOffset + 1];

          const targetX = this.targetBuffer[posOffset];
          const targetY = this.targetBuffer[posOffset + 1];
          const dx = targetX - currentX;
          const dy = targetY - currentY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 0.001) {
            const speed = this.BASE_MOVEMENT_SPEED;
            workVelocities[velOffset] = (dx / distance) * speed;
            workVelocities[velOffset + 1] = (dy / distance) * speed;
          } else {
            workVelocities[velOffset] = 0;
            workVelocities[velOffset + 1] = 0;
          }
        }

        this.velocityBuffer = workVelocities;
        this.bufferDirty = true;

        return { updated, arrived: result.arrived };
      } catch (error) {
        logger.warn(
          `⚠️ Error in GPU updatePositionsBatch, using CPU fallback: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const arrived = new Array<boolean>(entityCount).fill(false);

    for (let i = 0; i < entityCount; i++) {
      const posOffset = i * 2;
      const velOffset = i * 2;

      const currentX = workPositions[posOffset];
      const currentY = workPositions[posOffset + 1];
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
        workPositions[posOffset] = targetX;
        workPositions[posOffset + 1] = targetY;
        arrived[i] = true;
      } else {
        const ratio = moveDistance / distanceRemaining;
        workPositions[posOffset] += dx * ratio;
        workPositions[posOffset + 1] += dy * ratio;
      }

      const deltaX = workPositions[posOffset] - currentX;
      const deltaY = workPositions[posOffset + 1] - currentY;
      workVelocities[velOffset] = (deltaX / deltaMs) * 1000;
      workVelocities[velOffset + 1] = (deltaY / deltaMs) * 1000;
    }

    this.positionBuffer = workPositions;
    this.velocityBuffer = workVelocities;
    this.bufferDirty = true;
    return { updated, arrived };
  }

  public updateFatigueBatch(
    isMoving: boolean[],
    isResting: boolean[],
    deltaMs: number,
  ): void {
    if (!this.fatigueBuffer || this.entityIdArray.length === 0) return;

    const workFatigue = new Float32Array(this.fatigueBuffer);

    if (this.gpuService?.isGPUAvailable()) {
      try {
        const result = this.gpuService.updateFatigueBatch(
          workFatigue,
          isMoving,
          isResting,
          deltaMs,
        );
        this.fatigueBuffer = result;
        this.bufferDirty = true;
        return;
      } catch (error) {
        logger.warn(
          `⚠️ Error in GPU updateFatigueBatch, using CPU fallback: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const entityCount = this.entityIdArray.length;
    const fatigueDecayRate = 0.1 * (deltaMs / 1000);
    const fatigueRestRate = 0.5 * (deltaMs / 1000);

    for (let i = 0; i < entityCount; i++) {
      if (isMoving[i]) {
        workFatigue[i] = Math.min(100, workFatigue[i] + 0.1);
      } else if (isResting[i]) {
        workFatigue[i] = Math.max(0, workFatigue[i] - fatigueRestRate);
      } else {
        workFatigue[i] = Math.max(0, workFatigue[i] - fatigueDecayRate);
      }
    }

    this.fatigueBuffer = workFatigue;
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
