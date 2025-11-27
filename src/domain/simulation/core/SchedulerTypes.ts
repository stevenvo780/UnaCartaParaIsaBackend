/**
 * Shared types for scheduler components.
 * This file exists to break circular dependencies between MultiRateScheduler and PerformanceMonitor.
 */

import { TickRate } from "../../../shared/constants/SchedulerEnums";

// Re-export TickRate enum for backward compatibility
export { TickRate };

interface RateStats {
  count: number;
  totalMs: number;
  avgMs: number;
  skipped: number;
  systems: number;
  enabled: number;
}

export interface SchedulerStatsSnapshot {
  fast: RateStats;
  medium: RateStats;
  slow: RateStats;
  isRunning: boolean;
  entityCount: number;
}
