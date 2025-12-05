/**
 * Response status enumerations for API responses.
 *
 * Defines all response status values used in HTTP responses to ensure
 * consistency and type safety across the application.
 *
 * @module shared/constants/ResponseEnums
 */

/**
 * Enumeration of response status values for API responses.
 */
export enum ResponseStatus {
  OK = "ok",
  ERROR = "error",
  SUCCESS = "success",
  QUEUED = "queued",
  PENDING = "pending",
}

/**
 * Type representing all possible response status values.
 */
// Alias/lista/guard eliminados para mantener sólo el enum usado por los controladores.
