/**
 * Log level enumerations for the simulation system.
 *
 * Defines all log levels used in the logging system.
 *
 * @module shared/constants/LogEnums
 */

/**
 * Enumeration of log levels.
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

/**
 * Type representing all possible log level values.
 */
export type LogLevelValue = `${LogLevel}`;

/**
 * Array of all log levels for iteration.
 */
export const ALL_LOG_LEVELS: readonly LogLevel[] = Object.values(
  LogLevel,
) as LogLevel[];

/**
 * Type guard to check if a string is a valid LogLevel.
 */
export function isLogLevel(value: string): value is LogLevel {
  return Object.values(LogLevel).includes(value as LogLevel);
}
