import { performance } from "node:perf_hooks";
import type { TickRate, SchedulerStatsSnapshot } from "./MultiRateScheduler";

interface SimpleStats {
  count: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
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

  public setSchedulerStats(stats: SchedulerStatsSnapshot): void {
    this.schedulerStats = stats;
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
      memory: process.memoryUsage(),
      eventLoopLagMs:
        performance.eventLoopUtilization?.()?.utilization ?? 0,
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
      "# HELP backend_event_loop_utilization Proportion of time event loop was busy",
    );
    lines.push("# TYPE backend_event_loop_utilization gauge");
    lines.push(
      `backend_event_loop_utilization ${snapshot.eventLoopLagMs.toFixed(6)}`,
    );

    return `${lines.join("\n")}\n`;
  }
}

export const performanceMonitor = new PerformanceMonitor();

