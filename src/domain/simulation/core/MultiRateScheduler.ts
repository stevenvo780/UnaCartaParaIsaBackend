import { performance } from "node:perf_hooks";
import { logger } from "../../../infrastructure/utils/logger";
import { updateFrameTime } from "../../../shared/FrameTime";
import { performanceMonitor } from "./PerformanceMonitor";
import type { TickRate, SchedulerStatsSnapshot } from "./SchedulerTypes";

// Re-export types for backwards compatibility
export type { TickRate, SchedulerStatsSnapshot } from "./SchedulerTypes";

/**
 * Tick rate configuration for multi-rate scheduling.
 * Defines update frequencies for different system categories.
 */
export interface TickRates {
  /** Fast rate in milliseconds (50ms = 20 Hz for smooth movement) */
  FAST: number;
  /** Medium rate in milliseconds (250ms = 4 Hz) */
  MEDIUM: number;
  /** Slow rate in milliseconds (1000ms = 1 Hz) */
  SLOW: number;
}

export const DEFAULT_TICK_RATES: TickRates = {
  FAST: 50,
  MEDIUM: 250,
  SLOW: 1000,
};

/**
 * Configuration for a system registered in the multi-rate scheduler.
 */
export interface ScheduledSystem {
  /** System identifier name */
  name: string;
  /** Update rate category */
  rate: TickRate;
  /** Update function called with delta time in milliseconds */
  update: (deltaMs: number) => void | Promise<void>;
  /** Whether the system is currently enabled */
  enabled: boolean;
  /** Minimum entity count required to execute this system (for optimization) */
  minEntities?: number;
}

/**
 * Global hooks for synchronization before/after each tick.
 * Used to maintain indices and flush events across all rate categories.
 */
export interface SchedulerHooks {
  /** Executes before each tick (any rate) to synchronize indices */
  preTick?: () => void;
  /** Executes after each tick to flush events */
  postTick?: () => void;
  /** Returns current entity count for optimization decisions */
  getEntityCount?: () => number;
}

/**
 * Multi-rate scheduler for optimizing simulation performance.
 *
 * Divides systems into three update frequencies:
 * - FAST (50ms): Critical systems requiring high responsiveness (movement, combat)
 * - MEDIUM (250ms): Important systems less sensitive to timing (AI, needs, social)
 * - SLOW (1000ms): Systems that can run at low frequency (economy, research, etc.)
 *
 * Benefits: Reduces CPU load by ~50% without affecting gameplay.
 *
 * @see SimulationRunner for system registration
 */
export class MultiRateScheduler {
  private fastHandle?: NodeJS.Timeout;
  private mediumHandle?: NodeJS.Timeout;
  private slowHandle?: NodeJS.Timeout;

  private fastSystems: ScheduledSystem[] = [];
  private mediumSystems: ScheduledSystem[] = [];
  private slowSystems: ScheduledSystem[] = [];

  private lastFastTick = Date.now();
  private lastMediumTick = Date.now();
  private lastSlowTick = Date.now();

  private isRunning = false;
  private tickRates: TickRates;

  private hooks: SchedulerHooks = {};

  private cachedEntityCount = 0;
  private lastEntityCountUpdate = 0;
  private readonly ENTITY_COUNT_CACHE_MS = 500;

  private readonly MAX_SYSTEM_TIME_MS = 10;
  private readonly MAX_TICK_TIME_MS = 40;

  private stats = {
    fast: { count: 0, totalMs: 0, avgMs: 0, skipped: 0 },
    medium: { count: 0, totalMs: 0, avgMs: 0, skipped: 0 },
    slow: { count: 0, totalMs: 0, avgMs: 0, skipped: 0 },
  };

  /**
   * Creates a new multi-rate scheduler.
   *
   * @param tickRates - Custom tick rates (defaults to DEFAULT_TICK_RATES)
   */
  constructor(tickRates: TickRates = DEFAULT_TICK_RATES) {
    this.tickRates = tickRates;
  }

  /**
   * Configures global hooks for synchronization.
   *
   * @param hooks - Hook functions for pre-tick, post-tick, and entity counting
   */
  public setHooks(hooks: SchedulerHooks): void {
    this.hooks = hooks;
    logger.info("🔗 Scheduler hooks configured");
  }

  /**
   * Registers a system to be updated at the specified rate.
   *
   * @param system - System configuration with update function and rate
   */
  public registerSystem(system: ScheduledSystem): void {
    switch (system.rate) {
      case "FAST":
        this.fastSystems.push(system);
        break;
      case "MEDIUM":
        this.mediumSystems.push(system);
        break;
      case "SLOW":
        this.slowSystems.push(system);
        break;
    }

    logger.debug(
      `📋 Registered system "${system.name}" at ${system.rate} rate${system.minEntities ? ` (min: ${system.minEntities} entities)` : ""}`,
    );
  }

  /**
   * Gets cached entity count, updating if cache expired.
   *
   * @returns Current entity count
   */
  private getEntityCount(): number {
    const now = Date.now();
    if (now - this.lastEntityCountUpdate > this.ENTITY_COUNT_CACHE_MS) {
      this.cachedEntityCount = this.hooks.getEntityCount?.() ?? 0;
      this.lastEntityCountUpdate = now;
    }
    return this.cachedEntityCount;
  }

  /**
   * Starts the scheduler, beginning periodic updates for all registered systems.
   * Sets up separate intervals for FAST, MEDIUM, and SLOW rates.
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn("⚠️ MultiRateScheduler already running");
      return;
    }

    this.isRunning = true;
    this.lastFastTick = Date.now();
    this.lastMediumTick = Date.now();
    this.lastSlowTick = Date.now();

    this.fastHandle = setInterval(() => {
      this.tickFast().catch((err) => {
        logger.error("Error in FAST tick:", err);
      });
    }, this.tickRates.FAST);

    this.mediumHandle = setInterval(() => {
      this.tickMedium().catch((err) => {
        logger.error("Error in MEDIUM tick:", err);
      });
    }, this.tickRates.MEDIUM);

    this.slowHandle = setInterval(() => {
      this.tickSlow().catch((err) => {
        logger.error("Error in SLOW tick:", err);
      });
    }, this.tickRates.SLOW);

    logger.info("🚀 MultiRateScheduler started", {
      fast: `${this.fastSystems.length} systems @ ${this.tickRates.FAST}ms`,
      medium: `${this.mediumSystems.length} systems @ ${this.tickRates.MEDIUM}ms`,
      slow: `${this.slowSystems.length} systems @ ${this.tickRates.SLOW}ms`,
    });
  }

  /**
   * Stops the scheduler and clears all intervals.
   */
  public stop(): void {
    if (!this.isRunning) return;

    if (this.fastHandle) clearInterval(this.fastHandle);
    if (this.mediumHandle) clearInterval(this.mediumHandle);
    if (this.slowHandle) clearInterval(this.slowHandle);

    this.fastHandle = undefined;
    this.mediumHandle = undefined;
    this.slowHandle = undefined;
    this.isRunning = false;

    logger.info("🛑 MultiRateScheduler stopped");
  }

  /**
   * Executes FAST rate tick (50ms interval).
   * Updates shared frame time and runs all FAST systems.
   */
  private async tickFast(): Promise<void> {
    const now = updateFrameTime();
    const delta = now - this.lastFastTick;
    this.lastFastTick = now;

    const startTime = performance.now();

    this.hooks.preTick?.();

    const entityCount = this.getEntityCount();
    await this.executeSystems(this.fastSystems, delta, entityCount);

    this.hooks.postTick?.();

    const elapsed = performance.now() - startTime;
    this.stats.fast.count++;
    this.stats.fast.totalMs += elapsed;
    this.stats.fast.avgMs = this.stats.fast.totalMs / this.stats.fast.count;

    /**
     * Performance threshold: warn only for ticks >120ms.
     * Lower thresholds (e.g., 80ms) are too aggressive with 1000+ entities.
     */
    performanceMonitor.recordTick("FAST", elapsed);
    if (elapsed > 120) {
      logger.warn(
        `⚠️ FAST tick took ${elapsed.toFixed(2)}ms (>120ms threshold)`,
      );
    }
  }

  /**
   * Executes MEDIUM rate tick (250ms interval).
   * Updates shared frame time and runs all MEDIUM systems.
   */
  private async tickMedium(): Promise<void> {
    const now = updateFrameTime();
    const delta = now - this.lastMediumTick;
    this.lastMediumTick = now;

    const startTime = performance.now();

    this.hooks.preTick?.();

    const entityCount = this.getEntityCount();
    await this.executeSystems(this.mediumSystems, delta, entityCount);

    this.hooks.postTick?.();

    const elapsed = performance.now() - startTime;
    this.stats.medium.count++;
    this.stats.medium.totalMs += elapsed;
    this.stats.medium.avgMs =
      this.stats.medium.totalMs / this.stats.medium.count;

    performanceMonitor.recordTick("MEDIUM", elapsed);
    if (elapsed > 400) {
      logger.warn(
        `⚠️ MEDIUM tick took ${elapsed.toFixed(2)}ms (>400ms threshold)`,
      );
    }
  }

  /**
   * Executes SLOW rate tick (1000ms interval).
   * Updates shared frame time and runs all SLOW systems.
   */
  private async tickSlow(): Promise<void> {
    const now = updateFrameTime();
    const delta = now - this.lastSlowTick;
    this.lastSlowTick = now;

    const startTime = performance.now();

    this.hooks.preTick?.();

    const entityCount = this.getEntityCount();
    await this.executeSystems(this.slowSystems, delta, entityCount);

    this.hooks.postTick?.();

    const elapsed = performance.now() - startTime;
    this.stats.slow.count++;
    this.stats.slow.totalMs += elapsed;
    this.stats.slow.avgMs = this.stats.slow.totalMs / this.stats.slow.count;

    performanceMonitor.recordTick("SLOW", elapsed);
    if (elapsed > 800) {
      logger.warn(
        `⚠️ SLOW tick took ${elapsed.toFixed(2)}ms (>800ms threshold)`,
      );
    }
  }

  /**
   * Executes all systems in the given list with the provided delta time.
   * Skips disabled systems and systems that don't meet minimum entity requirements.
   * Uses time budgeting to avoid blocking the event loop for too long.
   *
   * @param systems - List of systems to execute
   * @param deltaMs - Time delta in milliseconds
   * @param entityCount - Current entity count for minEntities checks
   */
  private async executeSystems(
    systems: ScheduledSystem[],
    deltaMs: number,
    entityCount: number,
  ): Promise<void> {
    const tickStartTime = performance.now();

    for (let i = 0; i < systems.length; i++) {
      const system = systems[i];
      if (!system.enabled) continue;

      if (system.minEntities && entityCount < system.minEntities) {
        continue;
      }

      const elapsedInTick = performance.now() - tickStartTime;
      if (elapsedInTick > this.MAX_TICK_TIME_MS) {
        await new Promise<void>((resolve) => setImmediate(resolve));
      }

      try {
        const start = performance.now();
        const result = system.update(deltaMs);
        if (result instanceof Promise) {
          const systemStartTime = performance.now();
          await result;
          const systemDuration = performance.now() - systemStartTime;

          if (systemDuration > this.MAX_SYSTEM_TIME_MS) {
            logger.debug(
              `System "${system.name}" took ${systemDuration.toFixed(2)}ms (>${this.MAX_SYSTEM_TIME_MS}ms threshold)`,
            );
          }
        }
        const duration = performance.now() - start;
        performanceMonitor.recordSystemExecution(
          system.rate,
          system.name,
          duration,
        );
      } catch (error) {
        logger.error(`Error updating system "${system.name}":`, error);
      }
    }
  }

  /**
   * Gets performance statistics for all rate categories.
   *
   * @returns Statistics including tick counts, average times, and system counts
   */
  public getStats(): SchedulerStatsSnapshot {
    return {
      fast: {
        ...this.stats.fast,
        systems: this.fastSystems.length,
        enabled: this.fastSystems.filter((s) => s.enabled).length,
      },
      medium: {
        ...this.stats.medium,
        systems: this.mediumSystems.length,
        enabled: this.mediumSystems.filter((s) => s.enabled).length,
      },
      slow: {
        ...this.stats.slow,
        systems: this.slowSystems.length,
        enabled: this.slowSystems.filter((s) => s.enabled).length,
      },
      isRunning: this.isRunning,
      entityCount: this.cachedEntityCount,
    };
  }

  /**
   * Enables or disables a system by name.
   *
   * @param name - System name to modify
   * @param enabled - Whether to enable or disable the system
   * @returns True if system was found and updated, false otherwise
   */
  public setSystemEnabled(name: string, enabled: boolean): boolean {
    const allSystems = [
      ...this.fastSystems,
      ...this.mediumSystems,
      ...this.slowSystems,
    ];

    const system = allSystems.find((s) => s.name === name);
    if (system) {
      system.enabled = enabled;
      logger.info(
        `${enabled ? "✅" : "❌"} System "${name}" ${enabled ? "enabled" : "disabled"}`,
      );
      return true;
    }

    return false;
  }

  /**
   * Gets a list of all registered systems with their rate and enabled status.
   *
   * @returns Array of system information
   */
  public getSystemsList(): Array<{
    name: string;
    rate: TickRate;
    enabled: boolean;
  }> {
    const allSystems = [
      ...this.fastSystems,
      ...this.mediumSystems,
      ...this.slowSystems,
    ];

    return allSystems.map((s) => ({
      name: s.name,
      rate: s.rate,
      enabled: s.enabled,
    }));
  }
}
