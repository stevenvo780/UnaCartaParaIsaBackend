/**
 * Governance type enumerations for the simulation system.
 *
 * Defines all governance-related types including demand types used in governance system.
 *
 * @module shared/constants/GovernanceEnums
 */

/**
 * Enumeration of settlement demand types.
 * Defines all possible types of demands that can be detected by the governance system.
 */
export enum DemandType {
  FOOD_SHORTAGE = "food_shortage",
  WATER_SHORTAGE = "water_shortage",
  HOUSING_FULL = "housing_full",
  DEFENSE_NEEDED = "defense_needed",
  STORAGE_NEEDED = "storage_needed",
  INFRASTRUCTURE = "infrastructure",
}

/**
 * Type representing all possible demand type values.
 */
export type DemandTypeValue = `${DemandType}`;

/**
 * Array of all demand types for iteration.
 */
export const ALL_DEMAND_TYPES: readonly DemandType[] = Object.values(
  DemandType,
) as DemandType[];

/**
 * Type guard to check if a string is a valid DemandType.
 */
export function isDemandType(value: string): value is DemandType {
  return Object.values(DemandType).includes(value as DemandType);
}

/**
 * Enumeration of governance event types.
 */
export enum GovernanceEventType {
  DEMAND_CREATED = "demand_created",
  DEMAND_RESOLVED = "demand_resolved",
  POLICY_CHANGED = "policy_changed",
  PROJECT_STARTED = "project_started",
  PROJECT_FAILED = "project_failed",
  PRODUCTION_GENERATED = "production_generated",
  PRODUCTION_WORKER_LOST = "production_worker_lost",
  ROLE_REASSIGNED = "role_reassigned",
}

/**
 * Type representing all possible governance event type values.
 */
export type GovernanceEventTypeValue = `${GovernanceEventType}`;

/**
 * Array of all governance event types for iteration.
 */
export const ALL_GOVERNANCE_EVENT_TYPES: readonly GovernanceEventType[] =
  Object.values(GovernanceEventType) as GovernanceEventType[];

/**
 * Type guard to check if a string is a valid GovernanceEventType.
 */
export function isGovernanceEventType(
  value: string,
): value is GovernanceEventType {
  return Object.values(GovernanceEventType).includes(
    value as GovernanceEventType,
  );
}
