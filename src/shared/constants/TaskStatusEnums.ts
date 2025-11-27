/**
 * Task status enumerations for the simulation system.
 *
 * Defines all task status values used in TaskSystem and related components.
 *
 * @module shared/constants/TaskStatusEnums
 */

/**
 * Enumeration of task status values.
 */
export enum TaskStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  STALLED = "stalled",
  BLOCKED = "blocked",
  CANCELLED = "cancelled",
}

/**
 * Type representing all possible task status values.
 */
export type TaskStatusValue = `${TaskStatus}`;

/**
 * Array of all task statuses for iteration.
 */
export const ALL_TASK_STATUSES: readonly TaskStatus[] = Object.values(
  TaskStatus,
) as TaskStatus[];

/**
 * Type guard to check if a string is a valid TaskStatus.
 */
export function isTaskStatus(value: string): value is TaskStatus {
  return Object.values(TaskStatus).includes(value as TaskStatus);
}
