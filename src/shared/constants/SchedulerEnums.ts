/**
 * Scheduler type enumerations for the simulation system.
 *
 * Defines all tick rate types used in the scheduler.
 *
 * @module shared/constants/SchedulerEnums
 */

/**
 * Enumeration of tick rate types.
 */
export enum TickRate {
  FAST = "FAST",
  MEDIUM = "MEDIUM",
  SLOW = "SLOW",
}

/**
 * Type representing all possible tick rate values.
 */
export type TickRateValue = `${TickRate}`;

/**
 * Array of all tick rates for iteration.
 */
export const ALL_TICK_RATES: readonly TickRate[] = Object.values(
  TickRate,
) as TickRate[];

/**
 * Type guard to check if a string is a valid TickRate.
 */
export function isTickRate(value: string): value is TickRate {
  return Object.values(TickRate).includes(value as TickRate);
}
