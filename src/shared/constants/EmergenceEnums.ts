/**
 * Emergence type enumerations for the simulation system.
 *
 * Defines all emergence-related types including feedback loop IDs
 * used in the emergence system.
 *
 * @module shared/constants/EmergenceEnums
 */

/**
 * Enumeration of feedback loop IDs used in the emergence system.
 * These represent different feedback loops that can emerge in the simulation.
 */
export enum FeedbackLoopId {
  RESOURCE_PRODUCTION_LOOP = "resource_production_loop",
  POPULATION_RESOURCE_LOOP = "population_resource_loop",
}

/**
 * Type representing all possible feedback loop ID values.
 */
export type FeedbackLoopIdValue = `${FeedbackLoopId}`;

/**
 * Array of all feedback loop IDs for iteration.
 */
export const ALL_FEEDBACK_LOOP_IDS: readonly FeedbackLoopId[] = Object.values(
  FeedbackLoopId,
) as FeedbackLoopId[];

/**
 * Type guard to check if a string is a valid FeedbackLoopId.
 */
export function isFeedbackLoopId(value: string): value is FeedbackLoopId {
  return Object.values(FeedbackLoopId).includes(value as FeedbackLoopId);
}
