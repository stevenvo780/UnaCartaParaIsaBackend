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

// Alias/listas/guard eliminados para mantener el archivo enfocado sólo en los enums.
