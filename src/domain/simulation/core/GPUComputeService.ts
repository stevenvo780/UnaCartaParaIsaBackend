/* eslint-disable no-console */
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

    console.log("🔍 [GPUComputeService] Starting GPU detection...");
    console.log(`🔍 [GPUComputeService] Environment vars:`);
    console.log(`   CUDA_VISIBLE_DEVICES: ${process.env.CUDA_VISIBLE_DEVICES}`);
    console.log(
      `   NVIDIA_VISIBLE_DEVICES: ${process.env.NVIDIA_VISIBLE_DEVICES}`,
    );
    console.log(
      `   TF_FORCE_GPU_ALLOW_GROWTH: ${process.env.TF_FORCE_GPU_ALLOW_GROWTH}`,
    );
    console.log(`   LD_LIBRARY_PATH: ${process.env.LD_LIBRARY_PATH}`);

    try {
      console.log("🔍 [GPUComputeService] Calling tf.ready()...");
      await tf.ready();

      const backend = tf.getBackend();
      console.log(`🔍 [GPUComputeService] TensorFlow backend: ${backend}`);

      try {
        const memInfo = tf.memory();
        console.log(
          `🔍 [GPUComputeService] TF Memory info:`,
          JSON.stringify(memInfo),
        );
      } catch (memErr) {
        console.log(
          `🔍 [GPUComputeService] Could not get memory info: ${memErr}`,
        );
      }

      try {
        console.log(
          "🔍 [GPUComputeService] Testing GPU with simple tensor operation...",
        );
        const testStart = performance.now();
        const testTensor = tf.randomNormal([1000, 1000]);
        const result = testTensor.matMul(testTensor.transpose());
        await result.data(); // Forzar ejecución
        const testTime = performance.now() - testStart;
        testTensor.dispose();
        result.dispose();
        console.log(
          `✅ [GPUComputeService] GPU test matmul (1000x1000) completed in ${testTime.toFixed(2)}ms`,
        );
      } catch (testErr) {
        console.warn(`⚠️ [GPUComputeService] GPU test failed: ${testErr}`);
      }

      console.log(
        `🔍 [GPUComputeService] Registered backends:`,
        tf.engine().registryFactory,
      );

      const gpuBackends = ["tensorflow", "cuda", "webgl", "webgpu"];
      this.gpuAvailable = gpuBackends.includes(backend?.toLowerCase() ?? "");

      const status = this.gpuAvailable
        ? "✅ GPU AVAILABLE"
        : "❌ GPU NOT AVAILABLE (CPU fallback)";
      console.log(`🚀 [GPUComputeService] ${status} - Backend: ${backend}`);

      logger.info(
        `🚀 GPUComputeService initialized - Backend: ${backend} (GPU: ${this.gpuAvailable ? "available" : "unavailable, using CPU"})`,
      );

      this.initialized = true;
    } catch (error) {
      console.error(
        `❌ [GPUComputeService] Error initializing TensorFlow:`,
        error,
      );
      logger.warn(
        `⚠️ Error initializing TensorFlow, using CPU fallback: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.gpuAvailable = false;
      this.initialized = true;
    }
  }

  /**
   * Checks if GPU is available for computation.
   * Returns false if service hasn't been initialized yet.
   *
   * @returns True if GPU backend is available and initialized
   */
  isGPUAvailable(): boolean {
    if (!this.initialized) {
      return false;
    }
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

    if (!this.gpuAvailable || entityCount < 50) {
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

    if (!this.gpuAvailable || entityCount < 50) {
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

        let ageMultArray = ageMultipliers;
        let divineMultArray = divineModifiers;

        if (ageMultipliers.length !== entityCount) {
          ageMultArray = new Float32Array(entityCount).fill(1.0);
        }
        if (divineModifiers.length !== entityCount) {
          divineMultArray = new Float32Array(entityCount).fill(1.0);
        }

        const ageMultT = tf.tensor1d(ageMultArray).expandDims(1);
        const divineMultT = tf.tensor1d(divineMultArray).expandDims(1);

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

    if (!this.gpuAvailable || entityCount < 50) {
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

    if (!this.gpuAvailable || entityCount < 50) {
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
   * Logs current performance statistics. Call periodically for monitoring.
   */
  logPerformanceStats(): void {
    const stats = this.getPerformanceStats();
    const memInfo = tf.memory();
    const totalOps = stats.gpuOperations + stats.cpuFallbacks;
    const gpuRatio = totalOps > 0 ? (stats.gpuOperations / totalOps) * 100 : 0;

    console.log(`📊 [GPUComputeService] Performance Stats:`);
    console.log(`   GPU Available: ${stats.gpuAvailable}`);
    console.log(
      `   GPU Operations: ${stats.gpuOperations} (avg ${stats.avgGpuTime.toFixed(2)}ms)`,
    );
    console.log(
      `   CPU Fallbacks: ${stats.cpuFallbacks} (avg ${stats.avgCpuTime.toFixed(2)}ms)`,
    );
    console.log(`   GPU Usage Ratio: ${gpuRatio.toFixed(1)}%`);
    console.log(`   TF Memory: ${JSON.stringify(memInfo)}`);
  }

  /**
   * Resets performance statistics.
   */
  resetStats(): void {
    this.performanceStats = {
      gpuOperations: 0,
      cpuFallbacks: 0,
      totalGpuTime: 0,
      totalCpuTime: 0,
    };
  }

  /**
   * Computes squared distances from a center point to all entity positions in batch.
   * Much faster than individual distance calculations for large entity counts.
   *
   * @param centerX - Center X coordinate
   * @param centerY - Center Y coordinate
   * @param positions - Flat array [x1, y1, x2, y2, ...] of entity positions
   * @returns Array of squared distances for each entity
   */
  computeDistancesBatch(
    centerX: number,
    centerY: number,
    positions: Float32Array,
  ): Float32Array {
    const startTime = performance.now();
    const entityCount = positions.length / 2;

    if (!this.gpuAvailable || entityCount < 100) {
      return this.computeDistancesBatchCPU(centerX, centerY, positions);
    }

    try {
      return tf.tidy(() => {
        const posT = tf.tensor2d(positions, [entityCount, 2]);
        const centerT = tf.tensor1d([centerX, centerY]);

        const diff = posT.sub(centerT);
        const diffSq = diff.square();
        const distSq = diffSq.sum(1);

        const result = distSq.dataSync() as Float32Array;

        const elapsed = performance.now() - startTime;
        this.performanceStats.gpuOperations++;
        this.performanceStats.totalGpuTime += elapsed;

        return result;
      });
    } catch (error) {
      logger.warn(
        `⚠️ Error in GPU computeDistancesBatch: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.performanceStats.cpuFallbacks++;
      return this.computeDistancesBatchCPU(centerX, centerY, positions);
    }
  }

  private computeDistancesBatchCPU(
    centerX: number,
    centerY: number,
    positions: Float32Array,
  ): Float32Array {
    const startTime = performance.now();
    const entityCount = positions.length / 2;
    const distances = new Float32Array(entityCount);

    for (let i = 0; i < entityCount; i++) {
      const dx = positions[i * 2] - centerX;
      const dy = positions[i * 2 + 1] - centerY;
      distances[i] = dx * dx + dy * dy;
    }

    const elapsed = performance.now() - startTime;
    this.performanceStats.totalCpuTime += elapsed;
    return distances;
  }

  /**
   * Filters entities within a radius using GPU-computed distances.
   * Returns indices of entities within radiusSq.
   *
   * @param distancesSq - Squared distances array from computeDistancesBatch
   * @param radiusSq - Squared radius threshold
   * @returns Indices of entities within radius
   */
  filterByRadius(distancesSq: Float32Array, radiusSq: number): number[] {
    const indices: number[] = [];
    for (let i = 0; i < distancesSq.length; i++) {
      if (distancesSq[i] <= radiusSq) {
        indices.push(i);
      }
    }
    return indices;
  }

  /**
   * Applies decay to social affinity edges in batch.
   * Positive values decay towards 0, negative values also decay towards 0.
   *
   * @param affinities - Array of affinity values
   * @param decayRate - Decay rate per second
   * @param deltaSeconds - Elapsed time
   * @param minAffinity - Minimum threshold (below this becomes 0)
   * @returns Updated affinity values
   */
  decayAffinitiesBatch(
    affinities: Float32Array,
    decayRate: number,
    deltaSeconds: number,
    minAffinity: number = 0.001,
  ): Float32Array {
    const startTime = performance.now();
    const count = affinities.length;

    if (!this.gpuAvailable || count < 100) {
      return this.decayAffinitiesBatchCPU(
        affinities,
        decayRate,
        deltaSeconds,
        minAffinity,
      );
    }

    try {
      return tf.tidy(() => {
        const affT = tf.tensor1d(affinities);
        const decayAmount = decayRate * deltaSeconds;

        const sign = affT.sign();
        const absAff = affT.abs();
        const decayed = absAff.sub(decayAmount).maximum(0);
        const result = decayed.mul(sign);

        const thresholdMask = result.abs().greater(minAffinity);
        const finalResult = result.mul(thresholdMask.cast("float32"));

        const output = finalResult.dataSync() as Float32Array;

        const elapsed = performance.now() - startTime;
        this.performanceStats.gpuOperations++;
        this.performanceStats.totalGpuTime += elapsed;

        return output;
      });
    } catch (error) {
      logger.warn(
        `⚠️ Error in GPU decayAffinitiesBatch: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.performanceStats.cpuFallbacks++;
      return this.decayAffinitiesBatchCPU(
        affinities,
        decayRate,
        deltaSeconds,
        minAffinity,
      );
    }
  }

  private decayAffinitiesBatchCPU(
    affinities: Float32Array,
    decayRate: number,
    deltaSeconds: number,
    minAffinity: number,
  ): Float32Array {
    const startTime = performance.now();
    const result = new Float32Array(affinities.length);
    const decayAmount = decayRate * deltaSeconds;

    for (let i = 0; i < affinities.length; i++) {
      const val = affinities[i];
      if (Math.abs(val) < minAffinity) {
        result[i] = 0;
      } else if (val > 0) {
        result[i] = Math.max(0, val - decayAmount);
      } else {
        result[i] = Math.min(0, val + decayAmount);
      }
    }

    const elapsed = performance.now() - startTime;
    this.performanceStats.totalCpuTime += elapsed;
    return result;
  }

  /**
   * Computes pairwise distances for proximity reinforcement.
   * Returns a matrix of squared distances between all pairs.
   *
   * @param positions - Flat array [x1, y1, x2, y2, ...] of positions
   * @param maxEntities - Limit computation to first N entities (performance)
   * @returns Flat array of pairwise squared distances (upper triangle)
   */
  computePairwiseDistances(
    positions: Float32Array,
    maxEntities: number = 100,
  ): { distances: Float32Array; pairCount: number } {
    const startTime = performance.now();
    const entityCount = Math.min(positions.length / 2, maxEntities);
    const pairCount = (entityCount * (entityCount - 1)) / 2;

    if (!this.gpuAvailable || entityCount < 50) {
      return this.computePairwiseDistancesCPU(positions, maxEntities);
    }

    try {
      return tf.tidy(() => {
        const posT = tf.tensor2d(positions.slice(0, entityCount * 2), [
          entityCount,
          2,
        ]);

        const pos1 = posT.expandDims(1);
        const pos2 = posT.expandDims(0);
        const diff = pos1.sub(pos2);
        const distSq = diff.square().sum(2);

        const distMatrix = distSq.arraySync() as number[][];
        const distances = new Float32Array(pairCount);
        let idx = 0;
        for (let i = 0; i < entityCount; i++) {
          for (let j = i + 1; j < entityCount; j++) {
            distances[idx++] = distMatrix[i][j];
          }
        }

        const elapsed = performance.now() - startTime;
        this.performanceStats.gpuOperations++;
        this.performanceStats.totalGpuTime += elapsed;

        return { distances, pairCount };
      });
    } catch (error) {
      logger.warn(
        `⚠️ Error in GPU computePairwiseDistances: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.performanceStats.cpuFallbacks++;
      return this.computePairwiseDistancesCPU(positions, maxEntities);
    }
  }

  private computePairwiseDistancesCPU(
    positions: Float32Array,
    maxEntities: number,
  ): { distances: Float32Array; pairCount: number } {
    const startTime = performance.now();
    const entityCount = Math.min(positions.length / 2, maxEntities);
    const pairCount = (entityCount * (entityCount - 1)) / 2;
    const distances = new Float32Array(pairCount);

    let idx = 0;
    for (let i = 0; i < entityCount; i++) {
      const x1 = positions[i * 2];
      const y1 = positions[i * 2 + 1];
      for (let j = i + 1; j < entityCount; j++) {
        const dx = positions[j * 2] - x1;
        const dy = positions[j * 2 + 1] - y1;
        distances[idx++] = dx * dx + dy * dy;
      }
    }

    const elapsed = performance.now() - startTime;
    this.performanceStats.totalCpuTime += elapsed;
    return { distances, pairCount };
  }

  /**
   * Computes flee vectors for multiple animals in batch.
   * Each animal flees away from the nearest threat.
   *
   * @param animalPositions - Flat array [x1, y1, x2, y2, ...] of animal positions
   * @param threatPositions - Flat array of threat positions (predators/humans)
   * @param fleeSpeed - Base flee speed multiplier
   * @param deltaSeconds - Elapsed time
   * @returns New positions after fleeing
   */
  computeFleeVectorsBatch(
    animalPositions: Float32Array,
    threatPositions: Float32Array,
    fleeSpeed: number,
    deltaSeconds: number,
  ): Float32Array {
    const startTime = performance.now();
    const animalCount = animalPositions.length / 2;
    const threatCount = threatPositions.length / 2;

    if (!this.gpuAvailable || animalCount < 50 || threatCount === 0) {
      return this.computeFleeVectorsBatchCPU(
        animalPositions,
        threatPositions,
        fleeSpeed,
        deltaSeconds,
      );
    }

    try {
      return tf.tidy(() => {
        const animalsT = tf.tensor2d(animalPositions, [animalCount, 2]);
        const threatsT = tf.tensor2d(threatPositions, [threatCount, 2]);

        const animalExp = animalsT.expandDims(1);
        const threatExp = threatsT.expandDims(0);
        const diff = animalExp.sub(threatExp);
        const distSq = diff.square().sum(2);

        const nearestIdx = distSq.argMin(1);
        const nearestIdxArray = nearestIdx.arraySync() as number[];

        const newPositions = new Float32Array(animalPositions);
        const moveAmount = fleeSpeed * deltaSeconds;

        for (let i = 0; i < animalCount; i++) {
          const threatIdx = nearestIdxArray[i];
          const dx = animalPositions[i * 2] - threatPositions[threatIdx * 2];
          const dy =
            animalPositions[i * 2 + 1] - threatPositions[threatIdx * 2 + 1];
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 0.001) {
            newPositions[i * 2] += (dx / dist) * moveAmount;
            newPositions[i * 2 + 1] += (dy / dist) * moveAmount;
          }
        }

        const elapsed = performance.now() - startTime;
        this.performanceStats.gpuOperations++;
        this.performanceStats.totalGpuTime += elapsed;

        return newPositions;
      });
    } catch (error) {
      logger.warn(
        `⚠️ Error in GPU computeFleeVectorsBatch: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.performanceStats.cpuFallbacks++;
      return this.computeFleeVectorsBatchCPU(
        animalPositions,
        threatPositions,
        fleeSpeed,
        deltaSeconds,
      );
    }
  }

  private computeFleeVectorsBatchCPU(
    animalPositions: Float32Array,
    threatPositions: Float32Array,
    fleeSpeed: number,
    deltaSeconds: number,
  ): Float32Array {
    const startTime = performance.now();
    const animalCount = animalPositions.length / 2;
    const threatCount = threatPositions.length / 2;
    const newPositions = new Float32Array(animalPositions);
    const moveAmount = fleeSpeed * deltaSeconds;

    for (let i = 0; i < animalCount; i++) {
      const ax = animalPositions[i * 2];
      const ay = animalPositions[i * 2 + 1];

      let nearestDistSq = Infinity;
      let nearestThreatIdx = 0;

      for (let j = 0; j < threatCount; j++) {
        const dx = ax - threatPositions[j * 2];
        const dy = ay - threatPositions[j * 2 + 1];
        const distSq = dx * dx + dy * dy;
        if (distSq < nearestDistSq) {
          nearestDistSq = distSq;
          nearestThreatIdx = j;
          }
        }

      const dx = ax - threatPositions[nearestThreatIdx * 2];
      const dy = ay - threatPositions[nearestThreatIdx * 2 + 1];
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0.001) {
        newPositions[i * 2] += (dx / dist) * moveAmount;
        newPositions[i * 2 + 1] += (dy / dist) * moveAmount;
      }
    }

    const elapsed = performance.now() - startTime;
    this.performanceStats.totalCpuTime += elapsed;
    return newPositions;
  }

  /**
   * Cleans up TensorFlow memory. Should be called periodically.
   */
  dispose(): void {
    tf.disposeVariables();
    logger.debug("🧹 GPUComputeService: TensorFlow memory cleaned");
  }
}
