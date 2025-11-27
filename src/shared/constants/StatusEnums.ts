/**
 * Status and state enumerations for the simulation system.
 *
 * Defines all status and state types used across different services
 * and systems in the backend.
 *
 * @module shared/constants/StatusEnums
 */

/**
 * Enumeration of storage service status values.
 */
export enum StorageStatus {
  OK = "ok",
  ERROR = "error",
  GENERATING = "generating",
}

/**
 * Type representing all possible storage status values.
 */
export type StorageStatusValue = `${StorageStatus}`;

/**
 * Enumeration of storage backend types.
 */
export enum StorageType {
  GCS = "gcs",
  LOCAL = "local",
}

/**
 * Type representing all possible storage type values.
 */
export type StorageTypeValue = `${StorageType}`;

/**
 * Enumeration of interaction game status values.
 */
export enum InteractionStatus {
  EXPIRED = "expired",
  COMPLETED = "completed",
}

/**
 * Type representing all possible interaction status values.
 */
export type InteractionStatusValue = `${InteractionStatus}`;

/**
 * Enumeration of world generation status values.
 */
export enum WorldGenerationStatus {
  READY = "ready",
  GENERATING = "generating",
}

/**
 * Type representing all possible world generation status values.
 */
export type WorldGenerationStatusValue = `${WorldGenerationStatus}`;

/**
 * Enumeration of snapshot worker status values.
 */
export enum SnapshotWorkerStatus {
  READY = "ready",
  ERROR = "error",
}

/**
 * Type representing all possible snapshot worker status values.
 */
export type SnapshotWorkerStatusValue = `${SnapshotWorkerStatus}`;

/**
 * Array of all storage status values for iteration.
 */
export const ALL_STORAGE_STATUSES: readonly StorageStatus[] = Object.values(
  StorageStatus,
) as StorageStatus[];

/**
 * Array of all storage types for iteration.
 */
export const ALL_STORAGE_TYPES: readonly StorageType[] = Object.values(
  StorageType,
) as StorageType[];

/**
 * Array of all interaction statuses for iteration.
 */
export const ALL_INTERACTION_STATUSES: readonly InteractionStatus[] =
  Object.values(InteractionStatus) as InteractionStatus[];

/**
 * Array of all world generation statuses for iteration.
 */
export const ALL_WORLD_GENERATION_STATUSES: readonly WorldGenerationStatus[] =
  Object.values(WorldGenerationStatus) as WorldGenerationStatus[];

/**
 * Array of all snapshot worker statuses for iteration.
 */
export const ALL_SNAPSHOT_WORKER_STATUSES: readonly SnapshotWorkerStatus[] =
  Object.values(SnapshotWorkerStatus) as SnapshotWorkerStatus[];

/**
 * Type guard to check if a string is a valid StorageStatus.
 */
export function isStorageStatus(value: string): value is StorageStatus {
  return Object.values(StorageStatus).includes(value as StorageStatus);
}

/**
 * Type guard to check if a string is a valid StorageType.
 */
export function isStorageType(value: string): value is StorageType {
  return Object.values(StorageType).includes(value as StorageType);
}

/**
 * Type guard to check if a string is a valid InteractionStatus.
 */
export function isInteractionStatus(value: string): value is InteractionStatus {
  return Object.values(InteractionStatus).includes(value as InteractionStatus);
}

/**
 * Type guard to check if a string is a valid WorldGenerationStatus.
 */
export function isWorldGenerationStatus(
  value: string,
): value is WorldGenerationStatus {
  return Object.values(WorldGenerationStatus).includes(
    value as WorldGenerationStatus,
  );
}

/**
 * Type guard to check if a string is a valid SnapshotWorkerStatus.
 */
export function isSnapshotWorkerStatus(
  value: string,
): value is SnapshotWorkerStatus {
  return Object.values(SnapshotWorkerStatus).includes(
    value as SnapshotWorkerStatus,
  );
}
