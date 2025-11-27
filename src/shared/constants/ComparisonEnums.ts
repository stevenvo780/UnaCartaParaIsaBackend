/**
 * Comparison operator enumerations for the simulation system.
 *
 * Defines comparison operators used in triggers, conditions, and evaluations.
 *
 * @module shared/constants/ComparisonEnums
 */

/**
 * Enumeration of comparison operators.
 */
export enum ComparisonOperator {
  BELOW = "below",
  ABOVE = "above",
  EQUAL = "equal",
  NOT_EQUAL = "not_equal",
  LESS_THAN = "less_than",
  GREATER_THAN = "greater_than",
  LESS_THAN_OR_EQUAL = "less_than_or_equal",
  GREATER_THAN_OR_EQUAL = "greater_than_or_equal",
}

/**
 * Type representing all possible comparison operator values.
 */
export type ComparisonOperatorValue = `${ComparisonOperator}`;

/**
 * Array of all comparison operators for iteration.
 */
export const ALL_COMPARISON_OPERATORS: readonly ComparisonOperator[] =
  Object.values(ComparisonOperator) as ComparisonOperator[];

/**
 * Type guard to check if a string is a valid ComparisonOperator.
 */
export function isComparisonOperator(
  value: string,
): value is ComparisonOperator {
  return Object.values(ComparisonOperator).includes(
    value as ComparisonOperator,
  );
}
