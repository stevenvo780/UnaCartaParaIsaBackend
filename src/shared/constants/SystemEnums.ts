/**
 * System status enumerations for the simulation system.
 *
 * Defines all system status values used to track the state of systems,
 * components, and services throughout the application.
 *
 * @module shared/constants/SystemEnums
 */

/**
 * Enumeration of system status values.
 */
export enum SystemStatus {
  READY = "ready",
  INITIALIZING = "initializing",
  RUNNING = "running",
  STOPPED = "stopped",
  ERROR = "error",
  DISABLED = "disabled",
}

/**
 * Type representing all possible system status values.
 */
export type SystemStatusValue = `${SystemStatus}`;

/**
 * Array of all system statuses for iteration.
 */
export const ALL_SYSTEM_STATUSES: readonly SystemStatus[] = Object.values(
  SystemStatus,
) as SystemStatus[];

/**
 * Type guard to check if a string is a valid SystemStatus.
 */
export function isSystemStatus(value: string): value is SystemStatus {
  return Object.values(SystemStatus).includes(value as SystemStatus);
}
