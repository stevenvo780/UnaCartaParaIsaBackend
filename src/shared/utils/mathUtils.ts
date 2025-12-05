/**
 * Shared math utilities for consistent calculations across the codebase.
 *
 * @module shared/utils/mathUtils
 */

/**
 * Calculates the Euclidean distance between two 2D points.
 *
 * @param a - First point with x,y coordinates
 * @param b - Second point with x,y coordinates
 * @returns The distance between the two points
 */
export function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Checks if two points are within a threshold distance.
 *
 * @param a - First point with x,y coordinates
 * @param b - Second point with x,y coordinates
 * @param threshold - Maximum distance to be considered "close"
 * @returns True if the points are within threshold distance
 */
export function isWithinDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
  threshold: number,
): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return dx * dx + dy * dy <= threshold * threshold;
}
