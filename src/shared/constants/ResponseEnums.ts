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
export type ResponseStatusValue = `${ResponseStatus}`;

/**
 * Array of all response statuses for iteration.
 */
export const ALL_RESPONSE_STATUSES: readonly ResponseStatus[] = Object.values(
  ResponseStatus,
) as ResponseStatus[];

/**
 * Type guard to check if a string is a valid ResponseStatus.
 */
export function isResponseStatus(value: string): value is ResponseStatus {
  return Object.values(ResponseStatus).includes(value as ResponseStatus);
}

