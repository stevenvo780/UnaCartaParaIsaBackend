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
  // Use squared distance comparison to avoid sqrt for performance
  return dx * dx + dy * dy <= threshold * threshold;
}

/**
 * Clamps a value between min and max bounds.
 *
 * @param value - The value to clamp
 * @param min - Minimum bound
 * @param max - Maximum bound
 * @returns The clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between two values.
 *
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated value
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Calculates squared distance (faster than distance when comparison is needed).
 *
 * @param a - First point with x,y coordinates
 * @param b - Second point with x,y coordinates
 * @returns The squared distance between the two points
 */
export function distanceSquared(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

/**
 * Normalizes a 2D vector.
 *
 * @param x - X component
 * @param y - Y component
 * @returns Normalized vector {x, y} or {0, 0} if input is zero vector
 */
export function normalize(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}
