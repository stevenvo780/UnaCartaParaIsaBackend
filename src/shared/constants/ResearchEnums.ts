/**
 * Research type enumerations for the simulation system.
 *
 * Defines all research-related types including research category IDs
 * used in the research system.
 *
 * @module shared/constants/ResearchEnums
 */

/**
 * Enumeration of research category IDs available in the simulation.
 * These IDs correspond to research categories in the ResearchSystem.
 */
export enum ResearchId {
  BASIC_SURVIVAL = "basic_survival",
  WOODWORKING = "woodworking",
  STONECRAFT = "stonecraft",
  AGRICULTURE = "agriculture",
  METALLURGY = "metallurgy",
}

/**
 * Type representing all possible research ID values.
 */
export type ResearchIdValue = `${ResearchId}`;

/**
 * Array of all research IDs for iteration.
 */
export const ALL_RESEARCH_IDS: readonly ResearchId[] = Object.values(
  ResearchId,
) as ResearchId[];

/**
 * Type guard to check if a string is a valid ResearchId.
 */
export function isResearchId(value: string): value is ResearchId {
  return Object.values(ResearchId).includes(value as ResearchId);
}
