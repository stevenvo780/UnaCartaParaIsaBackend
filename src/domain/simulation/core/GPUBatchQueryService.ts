import { logger } from "../../../infrastructure/utils/logger";
import { injectable, inject, optional } from "inversify";
import { TYPES } from "../../../config/Types";
import type { GPUComputeService } from "./GPUComputeService";

/**
 * Result of a batched spatial query.
 */
export interface BatchQueryResult {
  queryId: string;
  entityIndices: number[];
  distances: Float32Array;
}

/**
 * Pending query to be processed in batch.
 */
interface PendingQuery {
  queryId: string;
  centerX: number;
  centerY: number;
  radiusSq: number;
  resolve: (result: BatchQueryResult) => void;
}

/**
 * GPU-accelerated batch query service for spatial queries.
 *
 * Instead of processing 5000+ individual queryRadius calls per frame,
 * this service accumulates queries and processes them in batches on GPU.
 *
 * Strategy:
 * 1. Systems call queueQuery() instead of direct queryRadius
 * 2. Queries accumulate in a buffer
 * 3. Every flushInterval ms OR when buffer is full, process all queries on GPU
 * 4. Results are returned via Promises
 *
 * This approach minimizes CPU↔GPU transfer overhead by:
 * - Sending entity positions to GPU once per flush
 * - Processing all queries in parallel on GPU
 * - Returning all results in a single transfer
 *
 * @see SharedSpatialIndex for the traditional CPU-based spatial queries
 * @see GPUComputeService for low-level GPU operations
 */
@injectable()
export class GPUBatchQueryService {
  @inject(TYPES.GPUComputeService)
  @optional()
  private gpuService?: GPUComputeService;
  private pendingQueries: PendingQuery[] = [];
  private entityPositions: Float32Array = new Float32Array(0);
  private entityIds: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  /** Flush queries every N ms (0 = immediate) */
  private readonly FLUSH_INTERVAL_MS = 0;
  /** Max queries before forcing a flush */
  private readonly MAX_PENDING_QUERIES = 500;
  /** Min entities to use GPU (below this, CPU is faster) */
  private readonly GPU_ENTITY_THRESHOLD = 100;
  /** Min queries to use GPU batch (below this, individual queries are fine) */
  private readonly GPU_QUERY_THRESHOLD = 50;

  private stats = {
    totalQueries: 0,
    gpuBatches: 0,
    cpuFallbacks: 0,
    avgBatchSize: 0,
    totalGpuTime: 0,
    totalCpuTime: 0,
  };

  constructor() {}

  /**
   * Updates the entity positions buffer. Call this once per frame.
   * @param positions - Flat array [x1, y1, x2, y2, ...] of all entity positions
   * @param entityIds - Array of entity IDs corresponding to positions
   */
  updateEntityPositions(positions: Float32Array, entityIds: string[]): void {
    this.entityPositions = positions;
    this.entityIds = entityIds;
  }

  /**
   * Queues a spatial query for batch processing.
   * Returns a Promise that resolves when the batch is processed.
   *
   * For immediate results (synchronous), use querySyncImmediate() instead.
   *
   * @param queryId - Unique identifier for this query
   * @param centerX - Center X coordinate
   * @param centerY - Center Y coordinate
   * @param radius - Query radius
   * @returns Promise resolving to query results
   */
  async queueQuery(
    queryId: string,
    centerX: number,
    centerY: number,
    radius: number,
  ): Promise<BatchQueryResult> {
    return new Promise((resolve) => {
      this.pendingQueries.push({
        queryId,
        centerX,
        centerY,
        radiusSq: radius * radius,
        resolve,
      });

      this.stats.totalQueries++;

      if (this.pendingQueries.length >= this.MAX_PENDING_QUERIES) {
        this.flush();
      } else if (this.FLUSH_INTERVAL_MS > 0 && !this.flushTimer) {
        this.flushTimer = setTimeout(
          () => this.flush(),
          this.FLUSH_INTERVAL_MS,
        );
      } else if (this.FLUSH_INTERVAL_MS === 0) {
        setImmediate(() => this.flush());
      }
    });
  }

  /**
   * Synchronous query for cases where async isn't practical.
   * Uses CPU for small entity counts, GPU for large counts.
   *
   * @param centerX - Center X coordinate
   * @param centerY - Center Y coordinate
   * @param radius - Query radius
   * @returns Array of {entityIndex, distance} for entities within radius
   */
  querySyncImmediate(
    centerX: number,
    centerY: number,
    radius: number,
  ): Array<{ entityIndex: number; distance: number }> {
    const entityCount = this.entityPositions.length / 2;
    if (entityCount === 0) return [];

    const radiusSq = radius * radius;
    const results: Array<{ entityIndex: number; distance: number }> = [];

    for (let i = 0; i < entityCount; i++) {
      const dx = this.entityPositions[i * 2] - centerX;
      const dy = this.entityPositions[i * 2 + 1] - centerY;
      const distSq = dx * dx + dy * dy;
      if (distSq <= radiusSq) {
        results.push({ entityIndex: i, distance: Math.hypot(dx, dy) });
      }
    }

    return results;
  }

  /**
   * Processes all pending queries in batch.
   * Uses GPU if enough queries and entities, otherwise CPU.
   */
  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.pendingQueries.length === 0) return;

    const queries = this.pendingQueries;
    this.pendingQueries = [];

    const entityCount = this.entityPositions.length / 2;
    const queryCount = queries.length;

    const useGpu =
      this.gpuService?.isGPUAvailable() &&
      entityCount >= this.GPU_ENTITY_THRESHOLD &&
      queryCount >= this.GPU_QUERY_THRESHOLD;

    if (useGpu) {
      this.processGPUAsync(queries, entityCount);
    } else {
      this.processCPU(queries, entityCount);
    }

    this.stats.avgBatchSize =
      (this.stats.avgBatchSize *
        (this.stats.gpuBatches + this.stats.cpuFallbacks - 1) +
        queryCount) /
      (this.stats.gpuBatches + this.stats.cpuFallbacks);
  }

  /**
   * GPU batch processing - compute all distances, then filter per query.
   * Uses GPUComputeService for centralized TensorFlow loading.
   */
  private async processGPUAsync(
    queries: PendingQuery[],
    entityCount: number,
  ): Promise<void> {
    const startTime = performance.now();

    try {
      if (!this.gpuService) {
        logger.warn("⚠️ GPUComputeService not available, falling back to CPU");
        this.processCPU(queries, entityCount);
        return;
      }

      const tfModule = await this.gpuService.getTensorFlowModule();
      if (!tfModule) {
        logger.warn("⚠️ TensorFlow not available, falling back to CPU");
        this.processCPU(queries, entityCount);
        return;
      }

      const queryCenters = new Float32Array(queries.length * 2);
      for (let i = 0; i < queries.length; i++) {
        queryCenters[i * 2] = queries[i].centerX;
        queryCenters[i * 2 + 1] = queries[i].centerY;
      }

      const distancesSq = tfModule.tidy(() => {
        const entities = tfModule.tensor2d(this.entityPositions, [
          entityCount,
          2,
        ]);
        const centers = tfModule.tensor2d(queryCenters, [queries.length, 2]);

        const centersExp = centers.expandDims(1);
        const entitiesExp = entities.expandDims(0);
        const diff = centersExp.sub(entitiesExp);
        const distSq = diff.square().sum(2);

        return distSq.arraySync() as number[][];
      });

      for (let q = 0; q < queries.length; q++) {
        const query = queries[q];
        const indices: number[] = [];
        const distances = new Float32Array(entityCount);
        let count = 0;

        for (let e = 0; e < entityCount; e++) {
          const distSq = distancesSq[q][e];
          if (distSq <= query.radiusSq) {
            indices.push(e);
            distances[count++] = Math.sqrt(distSq); // Keep sqrt for pre-computed squared distances
          }
        }

        query.resolve({
          queryId: query.queryId,
          entityIndices: indices,
          distances: distances.slice(0, count),
        });
      }

      this.stats.gpuBatches++;
      this.stats.totalGpuTime += performance.now() - startTime;
    } catch (error) {
      logger.warn(`⚠️ GPU batch query failed, falling back to CPU: ${error}`);
      this.processCPU(queries, entityCount);
    }
  }

  /**
   * CPU batch processing - sequential but still batched.
   */
  private processCPU(queries: PendingQuery[], entityCount: number): void {
    const startTime = performance.now();

    for (const query of queries) {
      const indices: number[] = [];
      const distances: number[] = [];

      for (let i = 0; i < entityCount; i++) {
        const dx = this.entityPositions[i * 2] - query.centerX;
        const dy = this.entityPositions[i * 2 + 1] - query.centerY;
        const distSq = dx * dx + dy * dy;

        if (distSq <= query.radiusSq) {
          indices.push(i);
          distances.push(Math.hypot(dx, dy));
        }
      }

      query.resolve({
        queryId: query.queryId,
        entityIndices: indices,
        distances: new Float32Array(distances),
      });
    }

    this.stats.cpuFallbacks++;
    this.stats.totalCpuTime += performance.now() - startTime;
  }

  /**
   * Gets entity ID by index.
   */
  getEntityId(index: number): string | undefined {
    return this.entityIds[index];
  }

  /**
   * Returns performance statistics.
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Resets statistics.
   */
  resetStats(): void {
    this.stats = {
      totalQueries: 0,
      gpuBatches: 0,
      cpuFallbacks: 0,
      avgBatchSize: 0,
      totalGpuTime: 0,
      totalCpuTime: 0,
    };
  }
}
