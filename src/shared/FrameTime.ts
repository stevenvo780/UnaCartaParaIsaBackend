/**
 * Shared frame timestamp service.
 *
 * Avoids multiple Date.now() calls during the same tick.
 * The scheduler updates this value once at the start of each tick,
 * and all systems query this value instead of calling Date.now().
 *
 * Benefit: Reduces ~100+ Date.now() calls per tick to just 1.
 */

let _frameTimestamp = 0;

/**
 * Gets the current frame timestamp.
 * Use this instead of Date.now() within systems.
 *
 * If _frameTimestamp is too outdated (>100ms),
 * it is automatically updated. This allows systems to work
 * correctly in tests with fake timers and during development.
 *
 * @returns Current frame timestamp
 */
export function getFrameTime(): number {
  const realNow = Date.now();
  if (realNow - _frameTimestamp > 100) {
    _frameTimestamp = realNow;
  }
  return _frameTimestamp;
}

/**
 * Updates the frame timestamp.
 * Should only be called by the scheduler at the start of each tick.
 *
 * @returns Updated timestamp
 */
export function updateFrameTime(): number {
  _frameTimestamp = Date.now();
  return _frameTimestamp;
}

/**
 * Alias for compatibility - returns the current frame timestamp.
 */
export const now = getFrameTime;
