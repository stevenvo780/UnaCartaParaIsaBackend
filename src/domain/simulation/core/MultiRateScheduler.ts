import { logger } from "../../../infrastructure/utils/logger";
import { updateFrameTime } from "../../../shared/FrameTime";

/**
 * Multi-Rate Scheduler para optimizar rendimiento de simulación
 *
 * Divide sistemas en 3 frecuencias:
 * - FAST (100ms): Sistemas críticos que requieren alta responsividad
 * - MEDIUM (500ms): Sistemas importantes pero menos sensibles al tiempo
 * - SLOW (1000ms): Sistemas que pueden ejecutarse con baja frecuencia
 *
 * Beneficio: Reduce carga CPU de ~50% sin afectar jugabilidad
 */

export interface TickRates {
  FAST: number; // 50ms = 20 Hz for smooth movement
  MEDIUM: number; // 250ms = 4 Hz
  SLOW: number; // 1000ms = 1 Hz
}

export const DEFAULT_TICK_RATES: TickRates = {
  FAST: 50, // Reduced from 100ms for smoother movement
  MEDIUM: 250, // Reduced from 500ms
  SLOW: 1000,
};

export type TickRate = "FAST" | "MEDIUM" | "SLOW";

export interface ScheduledSystem {
  name: string;
  rate: TickRate;
  update: (deltaMs: number) => void | Promise<void>;
  enabled: boolean;
  /** Umbral mínimo de entidades para ejecutar este sistema */
  minEntities?: number;
}

/**
 * Hooks para sincronización global antes/después de cada tick
 */
export interface SchedulerHooks {
  /** Se ejecuta antes de cada tick (cualquier rate) para sincronizar índices */
  preTick?: () => void;
  /** Se ejecuta después de cada tick para flush de eventos */
  postTick?: () => void;
  /** Retorna el número actual de entidades para optimización */
  getEntityCount?: () => number;
}

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

  private stats = {
    fast: { count: 0, totalMs: 0, avgMs: 0, skipped: 0 },
    medium: { count: 0, totalMs: 0, avgMs: 0, skipped: 0 },
    slow: { count: 0, totalMs: 0, avgMs: 0, skipped: 0 },
  };

  constructor(tickRates: TickRates = DEFAULT_TICK_RATES) {
    this.tickRates = tickRates;
  }

  public setHooks(hooks: SchedulerHooks): void {
    this.hooks = hooks;
    logger.info("🔗 Scheduler hooks configured");
  }

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

  private getEntityCount(): number {
    const now = Date.now();
    if (now - this.lastEntityCountUpdate > this.ENTITY_COUNT_CACHE_MS) {
      this.cachedEntityCount = this.hooks.getEntityCount?.() ?? 0;
      this.lastEntityCountUpdate = now;
    }
    return this.cachedEntityCount;
  }

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

  private async tickFast(): Promise<void> {
    const now = updateFrameTime(); // Actualiza timestamp compartido
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

    if (elapsed > 80) {
      logger.warn(
        `⚠️ FAST tick took ${elapsed.toFixed(2)}ms (>80ms threshold)`,
      );
    }
  }

  private async tickMedium(): Promise<void> {
    const now = updateFrameTime(); // Actualiza timestamp compartido
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

    if (elapsed > 400) {
      logger.warn(
        `⚠️ MEDIUM tick took ${elapsed.toFixed(2)}ms (>400ms threshold)`,
      );
    }
  }

  private async tickSlow(): Promise<void> {
    const now = updateFrameTime(); // Actualiza timestamp compartido
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

    if (elapsed > 800) {
      logger.warn(
        `⚠️ SLOW tick took ${elapsed.toFixed(2)}ms (>800ms threshold)`,
      );
    }
  }

  private async executeSystems(
    systems: ScheduledSystem[],
    deltaMs: number,
    entityCount: number,
  ): Promise<void> {
    for (const system of systems) {
      if (!system.enabled) continue;

      if (system.minEntities && entityCount < system.minEntities) {
        continue;
      }

      try {
        const result = system.update(deltaMs);
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        logger.error(`Error updating system "${system.name}":`, error);
      }
    }
  }

  public getStats(): {
    fast: {
      count: number;
      totalMs: number;
      avgMs: number;
      skipped: number;
      systems: number;
      enabled: number;
    };
    medium: {
      count: number;
      totalMs: number;
      avgMs: number;
      skipped: number;
      systems: number;
      enabled: number;
    };
    slow: {
      count: number;
      totalMs: number;
      avgMs: number;
      skipped: number;
      systems: number;
      enabled: number;
    };
    isRunning: boolean;
    entityCount: number;
  } {
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
