import * as tf from "@tensorflow/tfjs-node-gpu";
import { logger } from "../../../infrastructure/utils/logger";
import { injectable } from "inversify";

/**
 * GPU computation service abstraction using TensorFlow.js.
 *
 * Provides optimized batch operations for entity processing.
 * Automatically falls back to CPU if GPU is unavailable or for small batches.
 * Tracks performance statistics for monitoring.
 *
 * @see NeedsSystem for needs decay batch processing
 * @see MovementSystem for position update batch processing
 */
@injectable()
export class GPUComputeService {
  private gpuAvailable = false;
  private initialized = false;
  private performanceStats = {
    gpuOperations: 0,
    cpuFallbacks: 0,
    totalGpuTime: 0,
    totalCpuTime: 0,
  };

  /**
   * Initializes TensorFlow.js and detects GPU availability.
   * Must be called before using any GPU operations.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await tf.ready();
      const backend = tf.getBackend();

      const gpuBackends = ["tensorflow", "cuda", "webgl", "webgpu"];
      this.gpuAvailable = gpuBackends.includes(backend?.toLowerCase() ?? "");

      logger.info(
        `🚀 GPUComputeService initialized - Backend: ${backend} (GPU: ${this.gpuAvailable ? "available" : "unavailable, using CPU"})`,
      );

      this.initialized = true;
    } catch (error) {
      logger.warn(
        `⚠️ Error initializing TensorFlow, using CPU fallback: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.gpuAvailable = false;
      this.initialized = true;
    }
  }

  /**
   * Checks if GPU is available for computation.
   *
   * @returns True if GPU backend is available
   */
  isGPUAvailable(): boolean {
    return this.gpuAvailable;
  }

  /**
   * Updates entity positions in batch using GPU acceleration.
   * Falls back to CPU if GPU unavailable or entity count < 10.
   *
   * @param positions - Flat array [x1, y1, x2, y2, ...] of current positions
   * @param targets - Flat array [x1, y1, x2, y2, ...] of target positions
   * @param speeds - Array of speeds per entity
   * @param fatigue - Array of fatigue values per entity (0-100)
   * @param deltaMs - Elapsed time in milliseconds
   * @returns New positions and boolean array indicating arrival at destination
   */
  updatePositionsBatch(
    positions: Float32Array,
    targets: Float32Array,
    speeds: Float32Array,
    fatigue: Float32Array,
    deltaMs: number,
  ): { newPositions: Float32Array; arrived: boolean[] } {
    const startTime = performance.now();
    const entityCount = positions.length / 2;

    if (!this.gpuAvailable || entityCount < 10) {
      return this.updatePositionsBatchCPU(
        positions,
        targets,
        speeds,
        fatigue,
        deltaMs,
      );
    }

    try {
      return tf.tidy(() => {
        const posT = tf.tensor2d(positions, [entityCount, 2]);
        const tarT = tf.tensor2d(targets, [entityCount, 2]);
        const spdT = tf.tensor1d(speeds);
        const fatT = tf.tensor1d(fatigue);

        const direction = tarT.sub(posT);
        const distance = direction.norm("euclidean", 1, true);

        const fatigueMultiplier = tf
          .onesLike(fatT)
          .div(tf.onesLike(fatT).add(fatT.div(100).mul(0.5)));
        const effectiveSpeed = spdT.mul(fatigueMultiplier);

        const moveDistance = effectiveSpeed.expandDims(1).mul(deltaMs / 1000);
        const normalized = direction.div(distance.add(0.001));
        const movement = normalized.mul(moveDistance);

        const arrivedMask = distance.less(2);
        const arrivedArray = Array.from(arrivedMask.dataSync()).map(
          (v) => v !== 0,
        );

        const shouldMove = distance.greaterEqual(2);
        const moveAmount = movement.mul(shouldMove.expandDims(1));
        const targetPos = tarT.mul(arrivedMask.expandDims(1));
        const currentPos = posT.mul(shouldMove.expandDims(1));

        const newPos = currentPos.add(moveAmount).add(targetPos);

        const newPositions = newPos.dataSync() as Float32Array;

        const elapsed = performance.now() - startTime;
        this.performanceStats.gpuOperations++;
        this.performanceStats.totalGpuTime += elapsed;

        return { newPositions, arrived: arrivedArray };
      });
    } catch (error) {
      logger.warn(
        `⚠️ Error in GPU updatePositionsBatch, using CPU fallback: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.performanceStats.cpuFallbacks++;
      return this.updatePositionsBatchCPU(
        positions,
        targets,
        speeds,
        fatigue,
        deltaMs,
      );
    }
  }

  /**
   * CPU fallback for position updates.
   *
   * @internal
   */
  private updatePositionsBatchCPU(
    positions: Float32Array,
    targets: Float32Array,
    speeds: Float32Array,
    fatigue: Float32Array,
    deltaMs: number,
  ): { newPositions: Float32Array; arrived: boolean[] } {
    const startTime = performance.now();
    const entityCount = positions.length / 2;
    const newPositions = new Float32Array(positions.length);
    const arrived = new Array<boolean>(entityCount).fill(false);

    const FATIGUE_PENALTY_MULTIPLIER = 0.5;

    for (let i = 0; i < entityCount; i++) {
      const posOffset = i * 2;
      const currentX = positions[posOffset];
      const currentY = positions[posOffset + 1];
      const targetX = targets[posOffset];
      const targetY = targets[posOffset + 1];

      const dx = targetX - currentX;
      const dy = targetY - currentY;
      const distanceRemaining = Math.sqrt(dx * dx + dy * dy);

      if (distanceRemaining < 2) {
        newPositions[posOffset] = targetX;
        newPositions[posOffset + 1] = targetY;
        arrived[i] = true;
        continue;
      }

      const fatigueMult =
        1 / (1 + (fatigue[i] / 100) * FATIGUE_PENALTY_MULTIPLIER);
      const effectiveSpeed = speeds[i] * fatigueMult;
      const moveDistance = (effectiveSpeed * deltaMs) / 1000;

      if (moveDistance >= distanceRemaining) {
        newPositions[posOffset] = targetX;
        newPositions[posOffset + 1] = targetY;
        arrived[i] = true;
      } else {
        const ratio = moveDistance / distanceRemaining;
        newPositions[posOffset] = currentX + dx * ratio;
        newPositions[posOffset + 1] = currentY + dy * ratio;
      }
    }

    const elapsed = performance.now() - startTime;
    this.performanceStats.totalCpuTime += elapsed;

    return { newPositions, arrived };
  }

  /**
   * Applies decay to entity needs in batch using GPU acceleration.
   * Falls back to CPU if GPU unavailable or entity count < 10.
   *
   * @param needs - Flat array [h1, t1, e1, ...] where each entity has needCount values
   * @param decayRates - Array of decay rates per need [rate0, rate1, ...]
   * @param ageMultipliers - Age multipliers [mult0, mult1, ...]
   * @param divineModifiers - Divine favor modifiers [mod0, mod1, ...]
   * @param needCount - Number of needs per entity
   * @param deltaSeconds - Elapsed time in seconds
   * @returns Updated needs array
   */
  applyNeedsDecayBatch(
    needs: Float32Array,
    decayRates: Float32Array,
    ageMultipliers: Float32Array,
    divineModifiers: Float32Array,
    needCount: number,
    deltaSeconds: number,
  ): Float32Array {
    const startTime = performance.now();
    const entityCount = needs.length / needCount;

    if (!this.gpuAvailable || entityCount < 10) {
      return this.applyNeedsDecayBatchCPU(
        needs,
        decayRates,
        ageMultipliers,
        divineModifiers,
        needCount,
        deltaSeconds,
      );
    }

    try {
      return tf.tidy(() => {
        const needsT = tf.tensor2d(needs, [entityCount, needCount]);
        const decayRatesT = tf.tensor1d(decayRates);
        const ageMultT = tf.tensor1d(ageMultipliers).expandDims(1);
        const divineMultT = tf.tensor1d(divineModifiers).expandDims(1);

        const finalMultiplier = ageMultT.mul(divineMultT);

        const decayAmount = decayRatesT
          .expandDims(0)
          .mul(finalMultiplier)
          .mul(deltaSeconds);
        const newNeeds = needsT.sub(decayAmount).maximum(0);

        const result = newNeeds.dataSync() as Float32Array;

        const elapsed = performance.now() - startTime;
        this.performanceStats.gpuOperations++;
        this.performanceStats.totalGpuTime += elapsed;

        return result;
      });
    } catch (error) {
      logger.warn(
        `⚠️ Error in GPU applyNeedsDecayBatch, using CPU fallback: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.performanceStats.cpuFallbacks++;
      return this.applyNeedsDecayBatchCPU(
        needs,
        decayRates,
        ageMultipliers,
        divineModifiers,
        needCount,
        deltaSeconds,
      );
    }
  }

  /**
   * CPU fallback for needs decay.
   *
   * @internal
   */
  private applyNeedsDecayBatchCPU(
    needs: Float32Array,
    decayRates: Float32Array,
    ageMultipliers: Float32Array,
    divineModifiers: Float32Array,
    needCount: number,
    deltaSeconds: number,
  ): Float32Array {
    const startTime = performance.now();
    const entityCount = needs.length / needCount;
    const newNeeds = new Float32Array(needs.length);

    for (let i = 0; i < entityCount; i++) {
      const offset = i * needCount;
      const ageMult = ageMultipliers[i] || 1.0;
      const divineMult = divineModifiers[i] || 1.0;
      const finalMultiplier = ageMult * divineMult;

      for (let needIdx = 0; needIdx < needCount; needIdx++) {
        const rate = decayRates[needIdx] * finalMultiplier;
        const currentValue = needs[offset + needIdx];
        newNeeds[offset + needIdx] = Math.max(
          0,
          currentValue - rate * deltaSeconds,
        );
      }
    }

    const elapsed = performance.now() - startTime;
    this.performanceStats.totalCpuTime += elapsed;

    return newNeeds;
  }

  /**
   * Applies cross-effects between needs (e.g., low hunger affects energy).
   * Falls back to CPU if GPU unavailable or entity count < 10.
   *
   * @param needs - Flat array of needs [h1, t1, e1, ...]
   * @param needCount - Number of needs per entity
   * @returns Updated needs array with cross-effects applied
   */
  applyNeedsCrossEffectsBatch(
    needs: Float32Array,
    needCount: number,
  ): Float32Array {
    const startTime = performance.now();
    const entityCount = needs.length / needCount;

    if (!this.gpuAvailable || entityCount < 10) {
      return this.applyNeedsCrossEffectsBatchCPU(needs, needCount);
    }

    try {
      return tf.tidy(() => {
        const needsT = tf.tensor2d(needs, [entityCount, needCount]);

        const energy = needsT.slice([0, 2], [entityCount, 1]);
        const hunger = needsT.slice([0, 0], [entityCount, 1]);
        const thirst = needsT.slice([0, 1], [entityCount, 1]);

        const energyPenalty = tf.scalar(30).sub(energy).maximum(0).mul(0.02);
        const hungerPenalty = tf.scalar(40).sub(hunger).maximum(0).mul(0.03);
        const thirstPenalty = tf.scalar(30).sub(thirst).maximum(0).mul(0.05);

        const hungerCol = needsT.slice([0, 0], [entityCount, 1]);
        const thirstCol = needsT.slice([0, 1], [entityCount, 1]);
        const energyCol = needsT
          .slice([0, 2], [entityCount, 1])
          .sub(hungerPenalty)
          .sub(thirstPenalty.mul(2));
        const hygieneCol = needsT.slice([0, 3], [entityCount, 1]);
        const socialCol = needsT
          .slice([0, 4], [entityCount, 1])
          .sub(energyPenalty);
        const funCol = needsT
          .slice([0, 5], [entityCount, 1])
          .sub(energyPenalty);
        const mentalHealthCol = needsT
          .slice([0, 6], [entityCount, 1])
          .sub(energyPenalty.mul(1.5))
          .sub(hungerPenalty.mul(0.5))
          .sub(thirstPenalty);

        const newNeeds = tf
          .concat(
            [
              hungerCol,
              thirstCol,
              energyCol,
              hygieneCol,
              socialCol,
              funCol,
              mentalHealthCol,
            ],
            1,
          )
          .as2D(entityCount, needCount)
          .maximum(0)
          .minimum(100);

        const result = newNeeds.dataSync() as Float32Array;

        const elapsed = performance.now() - startTime;
        this.performanceStats.gpuOperations++;
        this.performanceStats.totalGpuTime += elapsed;

        return result;
      });
    } catch (error) {
      logger.warn(
        `⚠️ Error in GPU applyNeedsCrossEffectsBatch, using CPU fallback: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.performanceStats.cpuFallbacks++;
      return this.applyNeedsCrossEffectsBatchCPU(needs, needCount);
    }
  }

  /**
   * CPU fallback for cross-effects.
   *
   * @internal
   */
  private applyNeedsCrossEffectsBatchCPU(
    needs: Float32Array,
    needCount: number,
  ): Float32Array {
    const startTime = performance.now();
    const entityCount = needs.length / needCount;
    const newNeeds = new Float32Array(needs);

    for (let i = 0; i < entityCount; i++) {
      const offset = i * needCount;

      const energy = newNeeds[offset + 2];
      if (energy < 30) {
        const penalty = (30 - energy) * 0.02;
        newNeeds[offset + 4] = Math.max(0, newNeeds[offset + 4] - penalty); // social
        newNeeds[offset + 5] = Math.max(0, newNeeds[offset + 5] - penalty); // fun
        newNeeds[offset + 6] = Math.max(
          0,
          newNeeds[offset + 6] - penalty * 1.5,
        ); // mentalHealth
      }

      const hunger = newNeeds[offset + 0];
      if (hunger < 40) {
        const hungerPenalty = (40 - hunger) * 0.03;
        newNeeds[offset + 2] = Math.max(
          0,
          newNeeds[offset + 2] - hungerPenalty,
        ); // energy
        newNeeds[offset + 6] = Math.max(
          0,
          newNeeds[offset + 6] - hungerPenalty * 0.5,
        ); // mentalHealth
      }

      const thirst = newNeeds[offset + 1];
      if (thirst < 30) {
        const thirstPenalty = (30 - thirst) * 0.05;
        newNeeds[offset + 2] = Math.max(
          0,
          newNeeds[offset + 2] - thirstPenalty * 2,
        ); // energy
        newNeeds[offset + 6] = Math.max(
          0,
          newNeeds[offset + 6] - thirstPenalty,
        ); // mentalHealth
      }
    }

    const elapsed = performance.now() - startTime;
    this.performanceStats.totalCpuTime += elapsed;

    return newNeeds;
  }

  /**
   * Updates entity fatigue in batch using GPU acceleration.
   * Falls back to CPU if GPU unavailable or entity count < 10.
   *
   * @param fatigue - Array of fatigue values
   * @param isMoving - Array of booleans indicating if entities are moving
   * @param isResting - Array of booleans indicating if entities are resting
   * @param deltaMs - Elapsed time in milliseconds
   * @returns Updated fatigue array
   */
  updateFatigueBatch(
    fatigue: Float32Array,
    isMoving: boolean[],
    isResting: boolean[],
    deltaMs: number,
  ): Float32Array {
    const startTime = performance.now();
    const entityCount = fatigue.length;

    if (!this.gpuAvailable || entityCount < 10) {
      return this.updateFatigueBatchCPU(fatigue, isMoving, isResting, deltaMs);
    }

    try {
      return tf.tidy(() => {
        const fatigueT = tf.tensor1d(fatigue);
        const isMovingT = tf
          .tensor1d(isMoving.map((v) => (v ? 1 : 0)))
          .cast("float32");
        const isRestingT = tf
          .tensor1d(isResting.map((v) => (v ? 1 : 0)))
          .cast("float32");

        const fatigueDecayRate = 0.1 * (deltaMs / 1000);
        const fatigueRestRate = 0.5 * (deltaMs / 1000);

        const movingChange = isMovingT.mul(0.1);
        const restingChange = isRestingT.mul(-fatigueRestRate);
        const idleChange = tf
          .onesLike(isMovingT)
          .sub(isMovingT)
          .sub(isRestingT)
          .mul(-fatigueDecayRate);

        const totalChange = movingChange.add(restingChange).add(idleChange);
        const newFatigue = fatigueT.add(totalChange).maximum(0).minimum(100);

        const result = newFatigue.dataSync() as Float32Array;

        const elapsed = performance.now() - startTime;
        this.performanceStats.gpuOperations++;
        this.performanceStats.totalGpuTime += elapsed;

        return result;
      });
    } catch (error) {
      logger.warn(
        `⚠️ Error in GPU updateFatigueBatch, using CPU fallback: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.performanceStats.cpuFallbacks++;
      return this.updateFatigueBatchCPU(fatigue, isMoving, isResting, deltaMs);
    }
  }

  /**
   * CPU fallback for fatigue updates.
   *
   * @internal
   */
  private updateFatigueBatchCPU(
    fatigue: Float32Array,
    isMoving: boolean[],
    isResting: boolean[],
    deltaMs: number,
  ): Float32Array {
    const startTime = performance.now();
    const entityCount = fatigue.length;
    const newFatigue = new Float32Array(fatigue);

    const fatigueDecayRate = 0.1 * (deltaMs / 1000);
    const fatigueRestRate = 0.5 * (deltaMs / 1000);

    for (let i = 0; i < entityCount; i++) {
      if (isMoving[i]) {
        newFatigue[i] = Math.min(100, newFatigue[i] + 0.1);
      } else if (isResting[i]) {
        newFatigue[i] = Math.max(0, newFatigue[i] - fatigueRestRate);
      } else {
        newFatigue[i] = Math.max(0, newFatigue[i] - fatigueDecayRate);
      }
    }

    const elapsed = performance.now() - startTime;
    this.performanceStats.totalCpuTime += elapsed;

    return newFatigue;
  }

  /**
   * Gets performance statistics for GPU and CPU operations.
   *
   * @returns Performance stats including operation counts and average times
   */
  getPerformanceStats(): {
    gpuAvailable: boolean;
    gpuOperations: number;
    cpuFallbacks: number;
    avgGpuTime: number;
    avgCpuTime: number;
  } {
    return {
      gpuAvailable: this.gpuAvailable,
      gpuOperations: this.performanceStats.gpuOperations,
      cpuFallbacks: this.performanceStats.cpuFallbacks,
      avgGpuTime:
        this.performanceStats.gpuOperations > 0
          ? this.performanceStats.totalGpuTime /
            this.performanceStats.gpuOperations
          : 0,
      avgCpuTime:
        this.performanceStats.cpuFallbacks > 0
          ? this.performanceStats.totalCpuTime /
            this.performanceStats.cpuFallbacks
          : 0,
    };
  }

  /**
   * Applies linear decay to an array of values in batch.
   * Falls back to CPU if GPU unavailable or count < 100.
   *
   * @param values - Array of values to decay
   * @param decayRate - Decay rate per second
   * @param deltaSeconds - Elapsed time in seconds
   * @param threshold - Minimum threshold (values below become 0)
   * @returns Decayed values array
   */
  computeGeneralDecay(
    values: Float32Array,
    decayRate: number,
    deltaSeconds: number,
    threshold: number = 0.001,
  ): Float32Array {
    const startTime = performance.now();
    const count = values.length;

    if (!this.gpuAvailable || count < 100) {
      return this.computeGeneralDecayCPU(
        values,
        decayRate,
        deltaSeconds,
        threshold,
      );
    }

    try {
      return tf.tidy(() => {
        const valuesT = tf.tensor1d(values);
        const decayAmount = tf.scalar(decayRate * deltaSeconds);
        const decayed = valuesT.sub(decayAmount);
        const resultT = decayed.maximum(0);
        const finalT = tf.where(resultT.less(threshold), tf.scalar(0), resultT);

        const result = finalT.dataSync() as Float32Array;

        const elapsed = performance.now() - startTime;
        this.performanceStats.gpuOperations++;
        this.performanceStats.totalGpuTime += elapsed;

        return result;
      });
    } catch (error) {
      logger.warn(
        `⚠️ Error in GPU computeGeneralDecay, using CPU fallback: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.performanceStats.cpuFallbacks++;
      return this.computeGeneralDecayCPU(
        values,
        decayRate,
        deltaSeconds,
        threshold,
      );
    }
  }

  private computeGeneralDecayCPU(
    values: Float32Array,
    decayRate: number,
    deltaSeconds: number,
    threshold: number,
  ): Float32Array {
    const startTime = performance.now();
    const count = values.length;
    const newValues = new Float32Array(values);
    const decayAmount = decayRate * deltaSeconds;

    for (let i = 0; i < count; i++) {
      let val = newValues[i] - decayAmount;
      if (val < threshold) val = 0;
      newValues[i] = val;
    }

    const elapsed = performance.now() - startTime;
    this.performanceStats.totalCpuTime += elapsed;

    return newValues;
  }

  /**
   * Cleans up TensorFlow memory. Should be called periodically.
   */
  dispose(): void {
    tf.disposeVariables();
    logger.debug("🧹 GPUComputeService: TensorFlow memory cleaned");
  }
}
