/**
 * Legend type enumerations for the simulation system.
 *
 * Defines all legend-related types including reputation trends used in living legends system.
 *
 * @module shared/constants/LegendEnums
 */

/**
 * Enumeration of reputation trend directions.
 * Defines how an agent's reputation is changing over time.
 */
export enum LegendTrend {
  RISING = "rising",
  FALLING = "falling",
  STABLE = "stable",
}

/**
 * Type representing all possible legend trend values.
 */
export type LegendTrendValue = `${LegendTrend}`;

/**
 * Array of all legend trends for iteration.
 */
export const ALL_LEGEND_TRENDS: readonly LegendTrend[] = Object.values(
  LegendTrend,
) as LegendTrend[];

/**
 * Type guard to check if a string is a valid LegendTrend.
 */
export function isLegendTrend(value: string): value is LegendTrend {
  return Object.values(LegendTrend).includes(value as LegendTrend);
}

