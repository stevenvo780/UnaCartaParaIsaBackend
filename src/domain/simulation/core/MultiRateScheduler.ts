import { logger } from "../../../infrastructure/utils/logger";

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
  FAST: number;    // 100ms = 10 Hz
  MEDIUM: number;  // 500ms = 2 Hz
  SLOW: number;    // 1000ms = 1 Hz
}

export const DEFAULT_TICK_RATES: TickRates = {
  FAST: 100,
  MEDIUM: 500,
  SLOW: 1000,
};

export type TickRate = 'FAST' | 'MEDIUM' | 'SLOW';

export interface ScheduledSystem {
  name: string;
  rate: TickRate;
  update: (deltaMs: number) => void | Promise<void>;
  enabled: boolean;
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

  // Estadísticas de performance
  private stats = {
    fast: { count: 0, totalMs: 0, avgMs: 0 },
    medium: { count: 0, totalMs: 0, avgMs: 0 },
    slow: { count: 0, totalMs: 0, avgMs: 0 },
  };

  constructor(tickRates: TickRates = DEFAULT_TICK_RATES) {
    this.tickRates = tickRates;
  }

  /**
   * Registra un sistema para ser ejecutado a una frecuencia específica
   */
  public registerSystem(system: ScheduledSystem): void {
    switch (system.rate) {
      case 'FAST':
        this.fastSystems.push(system);
        break;
      case 'MEDIUM':
        this.mediumSystems.push(system);
        break;
      case 'SLOW':
        this.slowSystems.push(system);
        break;
    }

    logger.debug(`📋 Registered system "${system.name}" at ${system.rate} rate`);
  }

  /**
   * Inicia todos los loops de tick
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn('⚠️ MultiRateScheduler already running');
      return;
    }

    this.isRunning = true;
    this.lastFastTick = Date.now();
    this.lastMediumTick = Date.now();
    this.lastSlowTick = Date.now();

    // FAST loop: Movimiento, combate, trail (10 Hz)
    this.fastHandle = setInterval(() => {
      this.tickFast().catch(err => {
        logger.error('Error in FAST tick:', err);
      });
    }, this.tickRates.FAST);

    // MEDIUM loop: IA, necesidades, social (2 Hz)
    this.mediumHandle = setInterval(() => {
      this.tickMedium().catch(err => {
        logger.error('Error in MEDIUM tick:', err);
      });
    }, this.tickRates.MEDIUM);

    // SLOW loop: Economía, investigación, otros (1 Hz)
    this.slowHandle = setInterval(() => {
      this.tickSlow().catch(err => {
        logger.error('Error in SLOW tick:', err);
      });
    }, this.tickRates.SLOW);

    logger.info('🚀 MultiRateScheduler started', {
      fast: `${this.fastSystems.length} systems @ ${this.tickRates.FAST}ms`,
      medium: `${this.mediumSystems.length} systems @ ${this.tickRates.MEDIUM}ms`,
      slow: `${this.slowSystems.length} systems @ ${this.tickRates.SLOW}ms`,
    });
  }

  /**
   * Detiene todos los loops
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

    logger.info('🛑 MultiRateScheduler stopped');
  }

  /**
   * Tick para sistemas FAST (10 Hz)
   */
  private async tickFast(): Promise<void> {
    const now = Date.now();
    const delta = now - this.lastFastTick;
    this.lastFastTick = now;

    const startTime = performance.now();

    await this.executeSystems(this.fastSystems, delta);

    const elapsed = performance.now() - startTime;
    this.stats.fast.count++;
    this.stats.fast.totalMs += elapsed;
    this.stats.fast.avgMs = this.stats.fast.totalMs / this.stats.fast.count;

    if (elapsed > 80) {
      logger.warn(`⚠️ FAST tick took ${elapsed.toFixed(2)}ms (>80ms threshold)`);
    }
  }

  /**
   * Tick para sistemas MEDIUM (2 Hz)
   */
  private async tickMedium(): Promise<void> {
    const now = Date.now();
    const delta = now - this.lastMediumTick;
    this.lastMediumTick = now;

    const startTime = performance.now();

    await this.executeSystems(this.mediumSystems, delta);

    const elapsed = performance.now() - startTime;
    this.stats.medium.count++;
    this.stats.medium.totalMs += elapsed;
    this.stats.medium.avgMs = this.stats.medium.totalMs / this.stats.medium.count;

    if (elapsed > 400) {
      logger.warn(`⚠️ MEDIUM tick took ${elapsed.toFixed(2)}ms (>400ms threshold)`);
    }
  }

  /**
   * Tick para sistemas SLOW (1 Hz)
   */
  private async tickSlow(): Promise<void> {
    const now = Date.now();
    const delta = now - this.lastSlowTick;
    this.lastSlowTick = now;

    const startTime = performance.now();

    await this.executeSystems(this.slowSystems, delta);

    const elapsed = performance.now() - startTime;
    this.stats.slow.count++;
    this.stats.slow.totalMs += elapsed;
    this.stats.slow.avgMs = this.stats.slow.totalMs / this.stats.slow.count;

    if (elapsed > 800) {
      logger.warn(`⚠️ SLOW tick took ${elapsed.toFixed(2)}ms (>800ms threshold)`);
    }
  }

  /**
   * Ejecuta lista de sistemas
   */
  private async executeSystems(
    systems: ScheduledSystem[],
    deltaMs: number
  ): Promise<void> {
    for (const system of systems) {
      if (!system.enabled) continue;

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

  /**
   * Obtiene estadísticas de performance
   */
  public getStats() {
    return {
      fast: {
        ...this.stats.fast,
        systems: this.fastSystems.length,
        enabled: this.fastSystems.filter(s => s.enabled).length,
      },
      medium: {
        ...this.stats.medium,
        systems: this.mediumSystems.length,
        enabled: this.mediumSystems.filter(s => s.enabled).length,
      },
      slow: {
        ...this.stats.slow,
        systems: this.slowSystems.length,
        enabled: this.slowSystems.filter(s => s.enabled).length,
      },
      isRunning: this.isRunning,
    };
  }

  /**
   * Habilita/deshabilita un sistema por nombre
   */
  public setSystemEnabled(name: string, enabled: boolean): boolean {
    const allSystems = [
      ...this.fastSystems,
      ...this.mediumSystems,
      ...this.slowSystems,
    ];

    const system = allSystems.find(s => s.name === name);
    if (system) {
      system.enabled = enabled;
      logger.info(`${enabled ? '✅' : '❌'} System "${name}" ${enabled ? 'enabled' : 'disabled'}`);
      return true;
    }

    return false;
  }

  /**
   * Obtiene lista de todos los sistemas registrados
   */
  public getSystemsList(): Array<{ name: string; rate: TickRate; enabled: boolean }> {
    const allSystems = [
      ...this.fastSystems,
      ...this.mediumSystems,
      ...this.slowSystems,
    ];

    return allSystems.map(s => ({
      name: s.name,
      rate: s.rate,
      enabled: s.enabled,
    }));
  }
}
