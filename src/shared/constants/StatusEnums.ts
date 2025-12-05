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

/**
 * Enumeration of storage file prefixes.
 */
export enum StorageFilePrefix {
  SAVE = "save_",
}

/**
 * Type representing all possible storage file prefix values.
 */

/**
 * Enumeration of handler result status values for ECS handler compatibility.
 * Used across all systems that return handler results.
 */
export enum HandlerResultStatus {
  DELEGATED = "delegated",
  COMPLETED = "completed",
  FAILED = "failed",
  IN_PROGRESS = "in_progress",
}

/**
 * Type representing all possible handler result status values.
 */

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

/**
 * Enumeration of zone construction status values.
 */
export enum ZoneConstructionStatus {
  READY = "ready",
  CONSTRUCTION = "construction",
}

/**
 * Type representing all possible zone construction status values.
 */

/**
 * Array of all storage status values for iteration.
 */

/**
 * Array of all storage types for iteration.
 */

/**
 * Array of all world generation statuses for iteration.
 */

/**
 * Array of all handler result statuses for iteration.
 */

/**
 * Array of all zone construction statuses for iteration.
 */

/**
 * Type guard to check if a string is a valid StorageStatus.
 */
// Alias/listas/guards eliminados; únicamente se conservan los enums reales.
