/**
 * HTTP status code enumerations for API responses.
 *
 * Defines all HTTP status codes used in controllers to ensure type safety
 * and prevent magic numbers in response handling.
 *
 * @module shared/constants/HttpStatusCodes
 */

/**
 * Enumeration of common HTTP status codes used in the application.
 */
export enum HttpStatusCode {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,

  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  TOO_MANY_REQUESTS = 429,

  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
}

/**
 * Type representing all possible HTTP status code values.
 */
export type HttpStatusCodeValue = HttpStatusCode;

/**
 * Array of all HTTP status codes for iteration.
 */
export const ALL_HTTP_STATUS_CODES: readonly HttpStatusCode[] = Object.values(
  HttpStatusCode,
).filter((v): v is HttpStatusCode => typeof v === "number") as HttpStatusCode[];

/**
 * Type guard to check if a number is a valid HttpStatusCode.
 */
export function isHttpStatusCode(value: number): value is HttpStatusCode {
  return Object.values(HttpStatusCode).includes(value as HttpStatusCode);
}
