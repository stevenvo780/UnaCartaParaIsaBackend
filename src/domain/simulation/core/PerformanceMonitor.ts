import { performance } from "node:perf_hooks";
import type { TickRate, SchedulerStatsSnapshot } from "./SchedulerTypes";

interface SimpleStats {
  count: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
  minMs?: number;
}

interface OperationStats {
  count: number;
  skipped: number;
  entitiesProcessed: number;
  totalMs: number;
  maxMs: number;
  minMs: number;
  lastMs: number;
}

interface BatchProcessingStats {
  batchCount: number;
  totalEntities: number;
  gpuExecutions: number;
  cpuFallbacks: number;
  avgBatchSize: number;
  totalMs: number;
  avgMs: number;
}

interface SpatialIndexStats {
  queryCount: number;
  totalQueryMs: number;
  avgQueryMs: number;
  maxQueryMs: number;
  rebuildCount: number;
  totalRebuildMs: number;
  avgResultsPerQuery: number;
}

interface SystemStats extends SimpleStats {
  name: string;
  rate: TickRate;
}

interface TickStats extends SimpleStats {
  rate: TickRate;
}

type SystemKey = `${TickRate}:${string}`;

/**
 * Central registry that aggregates runtime metrics without introducing I/O.
 *
 * The monitor keeps only rolling aggregates (avg, max, count) so memory usage
 * remains constant regardless of entity count.
 */
class PerformanceMonitor {
  private tickStats: Record<TickRate, TickStats> = {
    FAST: this.createTickStats("FAST"),
    MEDIUM: this.createTickStats("MEDIUM"),
    SLOW: this.createTickStats("SLOW"),
  };

  private systemStats = new Map<SystemKey, SystemStats>();
  private schedulerStats: SchedulerStatsSnapshot | null = null;

  private createTickStats(rate: TickRate): TickStats {
    return {
      rate,
      count: 0,
      totalMs: 0,
      maxMs: 0,
      lastMs: 0,
    };
  }

  public recordTick(rate: TickRate, durationMs: number): void {
    const stats = this.tickStats[rate];
    stats.count += 1;
    stats.totalMs += durationMs;
    stats.lastMs = durationMs;
    if (durationMs > stats.maxMs) {
      stats.maxMs = durationMs;
    }
  }

  public recordSystemExecution(
    rate: TickRate,
    name: string,
    durationMs: number,
  ): void {
    const key: SystemKey = `${rate}:${name}`;
    let stats = this.systemStats.get(key);
    if (!stats) {
      stats = {
        name,
        rate,
        count: 0,
        totalMs: 0,
        maxMs: 0,
        lastMs: 0,
      };
      this.systemStats.set(key, stats);
    }

    stats.count += 1;
    stats.totalMs += durationMs;
    stats.lastMs = durationMs;
    if (durationMs > stats.maxMs) {
      stats.maxMs = durationMs;
    }
  }

  private subsystemStats = new Map<string, SimpleStats>();

  // ==================== MÉTRICAS AVANZADAS DE RENDIMIENTO ====================
  private operationStats = new Map<string, OperationStats>();
  private batchProcessingStats = new Map<string, BatchProcessingStats>();
  private spatialIndexStats = new Map<string, SpatialIndexStats>();

  private throughputWindow = new Map<
    string,
    { timestamp: number; count: number }[]
  >();
  private readonly THROUGHPUT_WINDOW_MS = 10000;

  public recordSubsystemExecution(
    systemName: string,
    subOperation: string,
    durationMs: number,
    entityId?: string,
  ): void {
    const key = entityId
      ? `${systemName}:${subOperation}:${entityId}`
      : `${systemName}:${subOperation}`;
    let stats = this.subsystemStats.get(key);
    if (!stats) {
      stats = {
        count: 0,
        totalMs: 0,
        maxMs: 0,
        lastMs: 0,
      };
      this.subsystemStats.set(key, stats);
    }

    stats.count += 1;
    stats.totalMs += durationMs;
    stats.lastMs = durationMs;
    if (durationMs > stats.maxMs) {
      stats.maxMs = durationMs;
    }
  }

  public setSchedulerStats(stats: SchedulerStatsSnapshot): void {
    this.schedulerStats = stats;
  }

  private gameLogicStats: {
    activeAgents: number;
    totalResources: number;
    totalBuildings: number;
  } = {
    activeAgents: 0,
    totalResources: 0,
    totalBuildings: 0,
  };

  public setGameLogicStats(stats: {
    activeAgents: number;
    totalResources: number;
    totalBuildings: number;
  }): void {
    this.gameLogicStats = stats;
  }

  // ==================== MÉTRICAS DE BATCH PROCESSING ====================
  // Solo para auditoría de rendimiento de GPU

  private batchStats: {
    animalBatchSize: number;
    movementBatchSize: number;
    needsBatchSize: number;
    gpuUtilization: number; // 0-1
  } = {
    animalBatchSize: 0,
    movementBatchSize: 0,
    needsBatchSize: 0,
    gpuUtilization: 0,
  };

  public setBatchStats(stats: {
    animalBatchSize: number;
    movementBatchSize: number;
    needsBatchSize: number;
    gpuUtilization: number;
  }): void {
    this.batchStats = stats;
  }

  // ==================== MÉTODOS PARA MÉTRICAS AVANZADAS ====================

  /**
   * Records an operation execution with detailed stats
   */
  public recordOperation(
    name: string,
    durationMs: number,
    entitiesProcessed: number,
    skipped = 0,
  ): void {
    let stats = this.operationStats.get(name);
    if (!stats) {
      stats = {
        count: 0,
        skipped: 0,
        entitiesProcessed: 0,
        totalMs: 0,
        maxMs: 0,
        minMs: Infinity,
        lastMs: 0,
      };
      this.operationStats.set(name, stats);
    }

    stats.count += 1;
    stats.skipped += skipped;
    stats.entitiesProcessed += entitiesProcessed;
    stats.totalMs += durationMs;
    stats.lastMs = durationMs;
    if (durationMs > stats.maxMs) stats.maxMs = durationMs;
    if (durationMs < stats.minMs) stats.minMs = durationMs;

    // Record throughput
    this.recordThroughput(name, entitiesProcessed);
  }

  /**
   * Records batch processing execution
   */
  public recordBatchProcessing(
    processor: string,
    batchSize: number,
    durationMs: number,
    usedGPU: boolean,
  ): void {
    let stats = this.batchProcessingStats.get(processor);
    if (!stats) {
      stats = {
        batchCount: 0,
        totalEntities: 0,
        gpuExecutions: 0,
        cpuFallbacks: 0,
        avgBatchSize: 0,
        totalMs: 0,
        avgMs: 0,
      };
      this.batchProcessingStats.set(processor, stats);
    }

    stats.batchCount += 1;
    stats.totalEntities += batchSize;
    stats.totalMs += durationMs;
    if (usedGPU) {
      stats.gpuExecutions += 1;
    } else {
      stats.cpuFallbacks += 1;
    }
    stats.avgBatchSize = stats.totalEntities / stats.batchCount;
    stats.avgMs = stats.totalMs / stats.batchCount;
  }

  /**
   * Records spatial index query
   */
  public recordSpatialQuery(
    indexName: string,
    durationMs: number,
    resultCount: number,
  ): void {
    let stats = this.spatialIndexStats.get(indexName);
    if (!stats) {
      stats = {
        queryCount: 0,
        totalQueryMs: 0,
        avgQueryMs: 0,
        maxQueryMs: 0,
        rebuildCount: 0,
        totalRebuildMs: 0,
        avgResultsPerQuery: 0,
      };
      this.spatialIndexStats.set(indexName, stats);
    }

    stats.queryCount += 1;
    stats.totalQueryMs += durationMs;
    stats.avgQueryMs = stats.totalQueryMs / stats.queryCount;
    if (durationMs > stats.maxQueryMs) stats.maxQueryMs = durationMs;
    stats.avgResultsPerQuery =
      (stats.avgResultsPerQuery * (stats.queryCount - 1) + resultCount) /
      stats.queryCount;
  }

  /**
   * Records spatial index rebuild
   */
  public recordSpatialRebuild(indexName: string, durationMs: number): void {
    let stats = this.spatialIndexStats.get(indexName);
    if (!stats) {
      stats = {
        queryCount: 0,
        totalQueryMs: 0,
        avgQueryMs: 0,
        maxQueryMs: 0,
        rebuildCount: 0,
        totalRebuildMs: 0,
        avgResultsPerQuery: 0,
      };
      this.spatialIndexStats.set(indexName, stats);
    }

    stats.rebuildCount += 1;
    stats.totalRebuildMs += durationMs;
  }

  /**
   * Records throughput in a rolling window
   */
  private recordThroughput(operation: string, count: number): void {
    const now = Date.now();
    let window = this.throughputWindow.get(operation);
    if (!window) {
      window = [];
      this.throughputWindow.set(operation, window);
    }

    window.push({ timestamp: now, count });

    // Clean old entries
    const cutoff = now - this.THROUGHPUT_WINDOW_MS;
    while (window.length > 0 && window[0].timestamp < cutoff) {
      window.shift();
    }
  }

  /**
   * Gets current throughput (operations per second)
   */
  public getThroughput(operation: string): number {
    const window = this.throughputWindow.get(operation);
    if (!window || window.length === 0) return 0;

    const totalCount = window.reduce((sum, entry) => sum + entry.count, 0);
    const windowDuration = (Date.now() - window[0].timestamp) / 1000;
    return windowDuration > 0 ? totalCount / windowDuration : 0;
  }

  /**
   * Generates a JSON-friendly snapshot for dashboards or REST responses.
   */
  public getSnapshot(): {
    timestamp: number;
    tickRates: Record<
      TickRate,
      { lastMs: number; maxMs: number; avgMs: number }
    >;
    systems: Array<SystemStats & { avgMs: number }>;
    scheduler?: SchedulerStatsSnapshot | null;
    gameLogic: {
      activeAgents: number;
      totalResources: number;
      totalBuildings: number;
    };
    memory: NodeJS.MemoryUsage;
    eventLoopLagMs: number;
  } {
    const tickRates = Object.fromEntries(
      (Object.keys(this.tickStats) as TickRate[]).map((rate) => {
        const stats = this.tickStats[rate];
        const avgMs = stats.count > 0 ? stats.totalMs / stats.count : 0;
        return [
          rate,
          {
            lastMs: Number(stats.lastMs.toFixed(4)),
            maxMs: Number(stats.maxMs.toFixed(4)),
            avgMs: Number(avgMs.toFixed(4)),
          },
        ];
      }),
    ) as Record<TickRate, { lastMs: number; maxMs: number; avgMs: number }>;

    const systems = Array.from(this.systemStats.values())
      .map((system) => ({
        ...system,
        avgMs: system.count > 0 ? system.totalMs / system.count : 0,
      }))
      .sort((a, b) => b.avgMs - a.avgMs);

    return {
      timestamp: Date.now(),
      tickRates,
      systems,
      scheduler: this.schedulerStats,
      gameLogic: this.gameLogicStats,
      memory: process.memoryUsage(),
      eventLoopLagMs: performance.eventLoopUtilization?.()?.utilization ?? 0,
    };
  }

  /**
   * Serializes metrics using Prometheus exposition format (0.0.4).
   */
  public toPrometheus(): string {
    const snapshot = this.getSnapshot();
    const lines: string[] = [];

    lines.push(
      "# HELP backend_tick_duration_ms Average tick duration per scheduler rate",
    );
    lines.push("# TYPE backend_tick_duration_ms gauge");
    for (const [rate, stats] of Object.entries(snapshot.tickRates)) {
      lines.push(
        `backend_tick_duration_ms{rate="${rate}"} ${stats.avgMs.toFixed(6)}`,
      );
    }

    lines.push(
      "# HELP backend_tick_duration_max_ms Max tick duration per rate",
    );
    lines.push("# TYPE backend_tick_duration_max_ms gauge");
    for (const [rate, stats] of Object.entries(snapshot.tickRates)) {
      lines.push(
        `backend_tick_duration_max_ms{rate="${rate}"} ${stats.maxMs.toFixed(6)}`,
      );
    }

    lines.push(
      "# HELP backend_system_execution_ms Average execution time per system",
    );
    lines.push("# TYPE backend_system_execution_ms gauge");
    for (const system of snapshot.systems) {
      lines.push(
        `backend_system_execution_ms{rate="${system.rate}",system="${system.name}"} ${system.avgMs.toFixed(6)}`,
      );
    }

    const memory = snapshot.memory;
    lines.push("# HELP backend_memory_bytes Node.js process memory usage");
    lines.push("# TYPE backend_memory_bytes gauge");
    for (const [key, value] of Object.entries(memory)) {
      lines.push(`backend_memory_bytes{type="${key}"} ${value}`);
    }

    if (snapshot.scheduler) {
      lines.push(
        "# HELP backend_scheduler_enabled_systems Number of enabled systems per rate",
      );
      lines.push("# TYPE backend_scheduler_enabled_systems gauge");
      lines.push(
        `backend_scheduler_enabled_systems{rate="FAST"} ${snapshot.scheduler.fast.enabled}`,
      );
      lines.push(
        `backend_scheduler_enabled_systems{rate="MEDIUM"} ${snapshot.scheduler.medium.enabled}`,
      );
      lines.push(
        `backend_scheduler_enabled_systems{rate="SLOW"} ${snapshot.scheduler.slow.enabled}`,
      );

      lines.push(
        "# HELP backend_scheduler_tick_avg_ms Average observed tick duration reported by scheduler",
      );
      lines.push("# TYPE backend_scheduler_tick_avg_ms gauge");
      lines.push(
        `backend_scheduler_tick_avg_ms{rate="FAST"} ${snapshot.scheduler.fast.avgMs.toFixed(6)}`,
      );
      lines.push(
        `backend_scheduler_tick_avg_ms{rate="MEDIUM"} ${snapshot.scheduler.medium.avgMs.toFixed(6)}`,
      );
      lines.push(
        `backend_scheduler_tick_avg_ms{rate="SLOW"} ${snapshot.scheduler.slow.avgMs.toFixed(6)}`,
      );

      lines.push(
        "# HELP backend_scheduler_entity_count Number of entities seen in last scheduler run",
      );
      lines.push("# TYPE backend_scheduler_entity_count gauge");
      lines.push(
        `backend_scheduler_entity_count ${snapshot.scheduler.entityCount}`,
      );
    }

    lines.push(
      "# HELP backend_active_agents_total Total number of active agents",
    );
    lines.push("# TYPE backend_active_agents_total gauge");
    lines.push(
      `backend_active_agents_total ${snapshot.gameLogic.activeAgents}`,
    );

    lines.push(
      "# HELP backend_total_resources Total number of world resources",
    );
    lines.push("# TYPE backend_total_resources gauge");
    lines.push(`backend_total_resources ${snapshot.gameLogic.totalResources}`);

    lines.push(
      "# HELP backend_total_buildings Total number of buildings/zones",
    );
    lines.push("# TYPE backend_total_buildings gauge");
    lines.push(`backend_total_buildings ${snapshot.gameLogic.totalBuildings}`);

    lines.push(
      "# HELP backend_event_loop_utilization Proportion of time event loop was busy",
    );
    lines.push("# TYPE backend_event_loop_utilization gauge");
    lines.push(
      `backend_event_loop_utilization ${snapshot.eventLoopLagMs.toFixed(6)}`,
    );

    lines.push(
      "# HELP backend_subsystem_duration_ms Average execution time per subsystem operation",
    );
    lines.push("# TYPE backend_subsystem_duration_ms gauge");
    for (const [key, stats] of this.subsystemStats.entries()) {
      const parts = key.split(":");
      const system = parts[0];
      const operation = parts[1];
      const entityId = parts[2];
      const avgMs = stats.count > 0 ? stats.totalMs / stats.count : 0;

      const labels = entityId
        ? `system="${system}",operation="${operation}",entity_id="${entityId}"`
        : `system="${system}",operation="${operation}"`;

      lines.push(
        `backend_subsystem_duration_ms{${labels}} ${avgMs.toFixed(6)}`,
      );
    }

    lines.push(
      "# HELP backend_subsystem_calls_total Total calls to subsystem operation",
    );
    lines.push("# TYPE backend_subsystem_calls_total counter");
    for (const [key, stats] of this.subsystemStats.entries()) {
      const parts = key.split(":");
      const system = parts[0];
      const operation = parts[1];
      const entityId = parts[2];

      const labels = entityId
        ? `system="${system}",operation="${operation}",entity_id="${entityId}"`
        : `system="${system}",operation="${operation}"`;

      lines.push(`backend_subsystem_calls_total{${labels}} ${stats.count}`);
    }

    lines.push(
      "# HELP backend_subsystem_total_duration_ms Total execution time per subsystem operation",
    );
    lines.push("# TYPE backend_subsystem_total_duration_ms counter");
    for (const [key, stats] of this.subsystemStats.entries()) {
      const parts = key.split(":");
      const system = parts[0];
      const operation = parts[1];
      const entityId = parts[2];

      const labels = entityId
        ? `system="${system}",operation="${operation}",entity_id="${entityId}"`
        : `system="${system}",operation="${operation}"`;

      lines.push(
        `backend_subsystem_total_duration_ms{${labels}} ${stats.totalMs.toFixed(6)}`,
      );
    }

    // ==================== MÉTRICAS DE RENDIMIENTO DE GPU ====================

    lines.push("# HELP backend_batch_size Batch size for GPU processing");
    lines.push("# TYPE backend_batch_size gauge");
    lines.push(
      `backend_batch_size{processor="animal"} ${this.batchStats.animalBatchSize}`,
    );
    lines.push(
      `backend_batch_size{processor="movement"} ${this.batchStats.movementBatchSize}`,
    );
    lines.push(
      `backend_batch_size{processor="needs"} ${this.batchStats.needsBatchSize}`,
    );

    lines.push("# HELP backend_gpu_utilization GPU utilization ratio (0-1)");
    lines.push("# TYPE backend_gpu_utilization gauge");
    lines.push(
      `backend_gpu_utilization ${this.batchStats.gpuUtilization.toFixed(4)}`,
    );

    // ==================== MÉTRICAS AVANZADAS DE OPERACIONES ====================
    lines.push(
      "# HELP backend_operation_executions_total Total executions per operation",
    );
    lines.push("# TYPE backend_operation_executions_total counter");
    for (const [name, stats] of this.operationStats.entries()) {
      lines.push(
        `backend_operation_executions_total{operation="${name}"} ${stats.count}`,
      );
    }

    lines.push(
      "# HELP backend_operation_skipped_total Skipped operations due to optimizations",
    );
    lines.push("# TYPE backend_operation_skipped_total counter");
    for (const [name, stats] of this.operationStats.entries()) {
      lines.push(
        `backend_operation_skipped_total{operation="${name}"} ${stats.skipped}`,
      );
    }

    lines.push(
      "# HELP backend_operation_entities_processed_total Total entities processed",
    );
    lines.push("# TYPE backend_operation_entities_processed_total counter");
    for (const [name, stats] of this.operationStats.entries()) {
      lines.push(
        `backend_operation_entities_processed_total{operation="${name}"} ${stats.entitiesProcessed}`,
      );
    }

    lines.push(
      "# HELP backend_operation_duration_ms Operation execution time statistics",
    );
    lines.push("# TYPE backend_operation_duration_ms gauge");
    for (const [name, stats] of this.operationStats.entries()) {
      const avgMs = stats.count > 0 ? stats.totalMs / stats.count : 0;
      lines.push(
        `backend_operation_duration_ms{operation="${name}",stat="avg"} ${avgMs.toFixed(6)}`,
      );
      lines.push(
        `backend_operation_duration_ms{operation="${name}",stat="max"} ${stats.maxMs.toFixed(6)}`,
      );
      lines.push(
        `backend_operation_duration_ms{operation="${name}",stat="min"} ${stats.minMs === Infinity ? 0 : stats.minMs.toFixed(6)}`,
      );
      lines.push(
        `backend_operation_duration_ms{operation="${name}",stat="last"} ${stats.lastMs.toFixed(6)}`,
      );
    }

    lines.push(
      "# HELP backend_operation_throughput_per_sec Entities processed per second",
    );
    lines.push("# TYPE backend_operation_throughput_per_sec gauge");
    for (const operation of this.operationStats.keys()) {
      const throughput = this.getThroughput(operation);
      lines.push(
        `backend_operation_throughput_per_sec{operation="${operation}"} ${throughput.toFixed(2)}`,
      );
    }

    // ==================== MÉTRICAS DE BATCH PROCESSING ====================
    lines.push(
      "# HELP backend_batch_executions_total Total batch executions by type",
    );
    lines.push("# TYPE backend_batch_executions_total counter");
    for (const [processor, stats] of this.batchProcessingStats.entries()) {
      lines.push(
        `backend_batch_executions_total{processor="${processor}",type="gpu"} ${stats.gpuExecutions}`,
      );
      lines.push(
        `backend_batch_executions_total{processor="${processor}",type="cpu"} ${stats.cpuFallbacks}`,
      );
    }

    lines.push(
      "# HELP backend_batch_avg_size Average batch size per processor",
    );
    lines.push("# TYPE backend_batch_avg_size gauge");
    for (const [processor, stats] of this.batchProcessingStats.entries()) {
      lines.push(
        `backend_batch_avg_size{processor="${processor}"} ${stats.avgBatchSize.toFixed(2)}`,
      );
    }

    lines.push(
      "# HELP backend_batch_avg_duration_ms Average batch processing time",
    );
    lines.push("# TYPE backend_batch_avg_duration_ms gauge");
    for (const [processor, stats] of this.batchProcessingStats.entries()) {
      lines.push(
        `backend_batch_avg_duration_ms{processor="${processor}"} ${stats.avgMs.toFixed(6)}`,
      );
    }

    lines.push(
      "# HELP backend_batch_entities_total Total entities processed in batches",
    );
    lines.push("# TYPE backend_batch_entities_total counter");
    for (const [processor, stats] of this.batchProcessingStats.entries()) {
      lines.push(
        `backend_batch_entities_total{processor="${processor}"} ${stats.totalEntities}`,
      );
    }

    lines.push(
      "# HELP backend_batch_gpu_utilization_ratio GPU vs CPU execution ratio",
    );
    lines.push("# TYPE backend_batch_gpu_utilization_ratio gauge");
    for (const [processor, stats] of this.batchProcessingStats.entries()) {
      const total = stats.gpuExecutions + stats.cpuFallbacks;
      const ratio = total > 0 ? stats.gpuExecutions / total : 0;
      lines.push(
        `backend_batch_gpu_utilization_ratio{processor="${processor}"} ${ratio.toFixed(4)}`,
      );
    }

    // ==================== MÉTRICAS DE ÍNDICES ESPACIALES ====================
    lines.push(
      "# HELP backend_spatial_query_count_total Total spatial index queries",
    );
    lines.push("# TYPE backend_spatial_query_count_total counter");
    for (const [index, stats] of this.spatialIndexStats.entries()) {
      lines.push(
        `backend_spatial_query_count_total{index="${index}"} ${stats.queryCount}`,
      );
    }

    lines.push(
      "# HELP backend_spatial_query_duration_ms Spatial query execution time",
    );
    lines.push("# TYPE backend_spatial_query_duration_ms gauge");
    for (const [index, stats] of this.spatialIndexStats.entries()) {
      lines.push(
        `backend_spatial_query_duration_ms{index="${index}",stat="avg"} ${stats.avgQueryMs.toFixed(6)}`,
      );
      lines.push(
        `backend_spatial_query_duration_ms{index="${index}",stat="max"} ${stats.maxQueryMs.toFixed(6)}`,
      );
    }

    lines.push(
      "# HELP backend_spatial_avg_results_per_query Average results per spatial query",
    );
    lines.push("# TYPE backend_spatial_avg_results_per_query gauge");
    for (const [index, stats] of this.spatialIndexStats.entries()) {
      lines.push(
        `backend_spatial_avg_results_per_query{index="${index}"} ${stats.avgResultsPerQuery.toFixed(2)}`,
      );
    }

    lines.push(
      "# HELP backend_spatial_rebuild_count_total Spatial index rebuilds",
    );
    lines.push("# TYPE backend_spatial_rebuild_count_total counter");
    for (const [index, stats] of this.spatialIndexStats.entries()) {
      lines.push(
        `backend_spatial_rebuild_count_total{index="${index}"} ${stats.rebuildCount}`,
      );
    }

    lines.push(
      "# HELP backend_spatial_rebuild_duration_ms Total time spent rebuilding spatial indexes",
    );
    lines.push("# TYPE backend_spatial_rebuild_duration_ms counter");
    for (const [index, stats] of this.spatialIndexStats.entries()) {
      lines.push(
        `backend_spatial_rebuild_duration_ms{index="${index}"} ${stats.totalRebuildMs.toFixed(6)}`,
      );
    }

    return `${lines.join("\n")}\n`;
  }
}

export const performanceMonitor = new PerformanceMonitor();
