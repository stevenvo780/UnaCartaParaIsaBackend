/**
 * Type utility functions and helper types.
 *
 * Provides common type utilities for working with enums, discriminated unions,
 * and other advanced TypeScript patterns.
 *
 * @module shared/types/utils
 */

/**
 * Extracts the value type from an enum or object type.
 */
export type ValueOf<T> = T[keyof T];

/**
 * Extracts keys from a type that have a specific value type.
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Makes all properties of T optional recursively.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Makes all properties of T required recursively.
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

/**
 * Creates a type that represents all possible values of an enum.
 */
export type EnumValues<T> = T[keyof T];

/**
 * Creates a type that represents all possible keys of an enum.
 */
export type EnumKeys<T> = keyof T;

/**
 * Type guard helper for checking if a value is in an enum.
 */
export function isEnumValue<T extends Record<string, string | number>>(
  enumObject: T,
  value: unknown,
): value is T[keyof T] {
  return Object.values(enumObject).includes(value as T[keyof T]);
}

/**
 * Type guard helper for checking if a value is a key of an enum.
 */
export function isEnumKey<T extends Record<string, string | number>>(
  enumObject: T,
  value: unknown,
): value is keyof T {
  return typeof value === "string" && value in enumObject;
}

/**
 * Gets all values from an enum as an array.
 */
export function getEnumValues<T extends Record<string, string | number>>(
  enumObject: T,
): T[keyof T][] {
  return Object.values(enumObject) as T[keyof T][];
}

/**
 * Gets all keys from an enum as an array.
 */
export function getEnumKeys<T extends Record<string, string | number>>(
  enumObject: T,
): (keyof T)[] {
  return Object.keys(enumObject) as (keyof T)[];
}

/**
 * Creates a type that represents a discriminated union based on a type field.
 */
export type DiscriminatedUnion<
  T extends { type: string },
  K extends T["type"],
> = Extract<T, { type: K }>;

/**
 * Helper type to extract the payload type from a discriminated union command.
 */
export type ExtractPayload<
  T extends { type: string; payload?: unknown },
  K extends T["type"],
> = Extract<T, { type: K }>["payload"];
