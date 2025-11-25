/**
 * Shared utility for random number generation.
 * Centralizes RNG to allow for easier seeding and testing in the future.
 */
export class RandomUtils {
  /**
   * Returns a random floating-point number between 0 (inclusive) and 1 (exclusive).
   */
  public static float(): number {
    return Math.random();
  }

  /**
   * Returns a random floating-point number between min (inclusive) and max (exclusive).
   */
  public static floatRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  /**
   * Returns a random integer between min (inclusive) and max (inclusive).
   */
  public static intRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Returns true with the specified probability (0-1).
   */
  public static chance(probability: number): boolean {
    return Math.random() < probability;
  }

  /**
   * Returns a random element from an array.
   */
  public static element<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Returns a random element from an array, throwing if empty.
   */
  public static elementOrThrow<T>(array: T[]): T {
    if (array.length === 0) throw new Error("Array is empty");
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Shuffles an array in place.
   */
  public static shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
