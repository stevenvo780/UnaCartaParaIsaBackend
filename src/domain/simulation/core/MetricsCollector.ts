import { performanceMonitor } from "./PerformanceMonitor";
import type { MultiRateScheduler } from "./MultiRateScheduler";
import type { GPUComputeService } from "./GPUComputeService";

/**
 * MetricsCollector - Collects performance metrics without impacting simulation.
 *
 * Collects performance metrics only, not gameplay metrics.
 * - System execution time
 * - Memory usage
 * - GPU utilization
 * - Event loop metrics
 *
 * Runs at very low frequency (every 5 seconds) to minimize impact.
 */
export class MetricsCollector {
  private lastCollectionTime = 0;
  private readonly COLLECTION_INTERVAL_MS = 5000;

  /**
   * Attempts to collect metrics if enough time has passed.
   * Returns immediately if it's not time to collect.
   */
  public tryCollect(
    scheduler: MultiRateScheduler,
    gpuService: GPUComputeService,
    entityCount: number,
  ): void {
    const now = Date.now();
    if (now - this.lastCollectionTime < this.COLLECTION_INTERVAL_MS) {
      return;
    }

    this.lastCollectionTime = now;

    try {
      performanceMonitor.setSchedulerStats(scheduler.getStats());

      performanceMonitor.setGameLogicStats({
        activeAgents: entityCount,
        totalResources: 0,
        totalBuildings: 0,
      });

      const gpuStats = gpuService.getPerformanceStats();
      performanceMonitor.setBatchStats({
        animalBatchSize: 0,
        movementBatchSize: 0,
        needsBatchSize: 0,
        gpuUtilization: gpuStats.gpuAvailable ? (gpuStats.gpuOperations / Math.max(1, gpuStats.gpuOperations + gpuStats.cpuFallbacks)) : 0,
      });
    } catch (error) {
      /* ignore */
    }
  }
}
