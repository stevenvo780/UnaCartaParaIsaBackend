import * as tf from "@tensorflow/tfjs-node-gpu";
import { logger } from "../../../infrastructure/utils/logger";
import { injectable } from "inversify";

/**
 * Servicio de abstracción para computación GPU usando TensorFlow.js
 * Proporciona métodos optimizados para operaciones batch en entidades
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
   * Inicializa TensorFlow.js y detecta disponibilidad de GPU
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await tf.ready();
      const backend = tf.getBackend();
      
      // Detectar backends que usan GPU (CUDA en Node.js, WebGL en browser)
      const gpuBackends = ["tensorflow", "cuda", "webgl", "webgpu"];
      this.gpuAvailable = gpuBackends.includes(backend?.toLowerCase() ?? "");

      logger.info(
        `🚀 GPUComputeService inicializado - Backend: ${backend} (GPU: ${this.gpuAvailable ? "disponible" : "no disponible, usando CPU"})`,
      );

      this.initialized = true;
    } catch (error) {
      logger.warn(
        `⚠️ Error inicializando TensorFlow, usando CPU fallback: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.gpuAvailable = false;
      this.initialized = true;
    }
  }

  /**
   * Verifica si GPU está disponible
   */
  isGPUAvailable(): boolean {
    return this.gpuAvailable;
  }

  /**
   * Actualiza posiciones de entidades en batch usando GPU
   * @param positions Array plano [x1, y1, x2, y2, ...] de posiciones actuales
   * @param targets Array plano [x1, y1, x2, y2, ...] de posiciones objetivo
   * @param speeds Array de velocidades por entidad
   * @param fatigue Array de fatiga por entidad (0-100)
   * @param deltaMs Tiempo transcurrido en milisegundos
   * @returns Nuevas posiciones y array de booleanos indicando si llegaron al destino
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
      // Fallback a CPU para pocas entidades o sin GPU
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
        // Convertir a tensores
        const posT = tf.tensor2d(positions, [entityCount, 2]);
        const tarT = tf.tensor2d(targets, [entityCount, 2]);
        const spdT = tf.tensor1d(speeds);
        const fatT = tf.tensor1d(fatigue);

        // Calcular dirección y distancia
        const direction = tarT.sub(posT);
        const distance = direction.norm("euclidean", 1, true);

        // Aplicar multiplicador de fatiga (1 / (1 + fatigue/100 * 0.5))
        const fatigueMultiplier = tf.onesLike(fatT).div(
          tf.onesLike(fatT).add(fatT.div(100).mul(0.5)),
        );
        const effectiveSpeed = spdT.mul(fatigueMultiplier);

        // Calcular movimiento
        const moveDistance = effectiveSpeed
          .expandDims(1)
          .mul(deltaMs / 1000);
        const normalized = direction.div(distance.add(0.001));
        const movement = normalized.mul(moveDistance);

        // Determinar si llegaron al destino (distancia < 2)
        const arrivedMask = distance.less(2);
        const arrivedArray = Array.from(arrivedMask.dataSync()).map(
          (v) => v !== 0,
        );

        // Aplicar movimiento o establecer posición objetivo
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
        `⚠️ Error en GPU updatePositionsBatch, usando CPU fallback: ${error instanceof Error ? error.message : String(error)}`,
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
   * Fallback CPU para actualización de posiciones
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
   * Aplica decay a necesidades de entidades en batch
   * @param needs Array plano [h1, t1, e1, ...] donde cada entidad tiene NEED_COUNT valores
   * @param decayRates Array de tasas de decay por necesidad [rate0, rate1, ...]
   * @param ageMultipliers Multiplicadores por edad [mult0, mult1, ...]
   * @param divineModifiers Multiplicadores divinos [mod0, mod1, ...]
   * @param needCount Número de necesidades por entidad
   * @param deltaSeconds Tiempo transcurrido en segundos
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
        // Reshape needs a [entityCount, needCount]
        const needsT = tf.tensor2d(needs, [entityCount, needCount]);
        const decayRatesT = tf.tensor1d(decayRates);
        const ageMultT = tf.tensor1d(ageMultipliers).expandDims(1);
        const divineMultT = tf.tensor1d(divineModifiers).expandDims(1);

        // Calcular multiplicador final
        const finalMultiplier = ageMultT.mul(divineMultT);

        // Aplicar decay: needs = max(0, needs - decayRates * multiplier * deltaSeconds)
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
        `⚠️ Error en GPU applyNeedsDecayBatch, usando CPU fallback: ${error instanceof Error ? error.message : String(error)}`,
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
   * Fallback CPU para decay de necesidades
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
        newNeeds[offset + needIdx] = Math.max(0, currentValue - rate * deltaSeconds);
      }
    }

    const elapsed = performance.now() - startTime;
    this.performanceStats.totalCpuTime += elapsed;

    return newNeeds;
  }

  /**
   * Aplica efectos cruzados entre necesidades (ej: hambre baja afecta energía)
   * @param needs Array plano de necesidades [h1, t1, e1, ...]
   * @param needCount Número de necesidades por entidad
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

        // Efectos cruzados (fórmulas idénticas a la versión CPU):
        // - Energía baja (<30): penalty = (30 - energy) * 0.02
        // - Hambre baja (<40): penalty = (40 - hunger) * 0.03
        // - Sed baja (<30): penalty = (30 - thirst) * 0.05

        const energy = needsT.slice([0, 2], [entityCount, 1]);
        const hunger = needsT.slice([0, 0], [entityCount, 1]);
        const thirst = needsT.slice([0, 1], [entityCount, 1]);

        // Penalizaciones: max(0, threshold - value) * rate
        const energyPenalty = tf.scalar(30).sub(energy).maximum(0).mul(0.02);
        const hungerPenalty = tf.scalar(40).sub(hunger).maximum(0).mul(0.03);
        const thirstPenalty = tf.scalar(30).sub(thirst).maximum(0).mul(0.05);

        // Aplicar penalizaciones
        const hungerCol = needsT.slice([0, 0], [entityCount, 1]);
        const thirstCol = needsT.slice([0, 1], [entityCount, 1]);
        const energyCol = needsT
          .slice([0, 2], [entityCount, 1])
          .sub(hungerPenalty)
          .sub(thirstPenalty.mul(2));
        const hygieneCol = needsT.slice([0, 3], [entityCount, 1]);
        const socialCol = needsT.slice([0, 4], [entityCount, 1]).sub(energyPenalty);
        const funCol = needsT.slice([0, 5], [entityCount, 1]).sub(energyPenalty);
        const mentalHealthCol = needsT
          .slice([0, 6], [entityCount, 1])
          .sub(energyPenalty.mul(1.5))
          .sub(hungerPenalty.mul(0.5))
          .sub(thirstPenalty);

        const newNeeds = tf
          .concat([hungerCol, thirstCol, energyCol, hygieneCol, socialCol, funCol, mentalHealthCol], 1)
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
        `⚠️ Error en GPU applyNeedsCrossEffectsBatch, usando CPU fallback: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.performanceStats.cpuFallbacks++;
      return this.applyNeedsCrossEffectsBatchCPU(needs, needCount);
    }
  }

  /**
   * Fallback CPU para efectos cruzados
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
        newNeeds[offset + 2] = Math.max(0, newNeeds[offset + 2] - hungerPenalty); // energy
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
   * Actualiza fatiga de entidades en batch
   * @param fatigue Array de valores de fatiga
   * @param isMoving Array de booleanos indicando si se están moviendo
   * @param isResting Array de booleanos indicando si están descansando
   * @param deltaMs Tiempo transcurrido en milisegundos
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
        const isMovingT = tf.tensor1d(
          isMoving.map((v) => (v ? 1 : 0)),
        ).cast("float32");
        const isRestingT = tf.tensor1d(
          isResting.map((v) => (v ? 1 : 0)),
        ).cast("float32");

        const fatigueDecayRate = 0.1 * (deltaMs / 1000);
        const fatigueRestRate = 0.5 * (deltaMs / 1000);

        // Si se mueve: +0.1, si descansa: -0.5, sino: -0.1
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
        `⚠️ Error en GPU updateFatigueBatch, usando CPU fallback: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.performanceStats.cpuFallbacks++;
      return this.updateFatigueBatchCPU(fatigue, isMoving, isResting, deltaMs);
    }
  }

  /**
   * Fallback CPU para actualización de fatiga
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
   * Obtiene estadísticas de rendimiento
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
          ? this.performanceStats.totalCpuTime / this.performanceStats.cpuFallbacks
          : 0,
    };
  }

  /**
   * Limpia memoria de TensorFlow (llamar periódicamente)
   */
  dispose(): void {
    tf.disposeVariables();
    logger.debug("🧹 GPUComputeService: Memoria TensorFlow limpiada");
  }
}

