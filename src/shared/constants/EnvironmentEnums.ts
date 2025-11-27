/**
 * Enumeration of execution environments.
 */
export enum Environment {
  PRODUCTION = "production",
  DEVELOPMENT = "development",
  TEST = "test",
}

/**
 * Type representing all possible environment values.
 */
export type EnvironmentValue = `${Environment}`;
