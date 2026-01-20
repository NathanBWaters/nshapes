/**
 * Seeded Random Number Generator for Deterministic Tests
 *
 * Uses Mulberry32 PRNG for reproducible random sequences.
 * Useful for tests that need deterministic behavior from Math.random().
 */

/**
 * Mulberry32 PRNG - fast, simple, and produces good quality random numbers.
 * @param seed - Initial seed value
 * @returns Function that returns next random number in [0, 1)
 */
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seeded random number generator class.
 */
export class SeededRandom {
  private generator: () => number;
  private originalRandom: typeof Math.random | null = null;

  /**
   * Create a seeded random generator.
   * @param seed - Seed value (default: 12345)
   */
  constructor(seed: number = 12345) {
    this.generator = mulberry32(seed);
  }

  /**
   * Get the next random number in [0, 1).
   */
  next(): number {
    return this.generator();
  }

  /**
   * Get a random integer in [min, max] (inclusive).
   * @param min - Minimum value
   * @param max - Maximum value
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Get a random boolean with given probability of true.
   * @param probability - Probability of true (0-1)
   */
  nextBool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Pick a random element from an array.
   * @param array - Array to pick from
   */
  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return array[this.nextInt(0, array.length - 1)];
  }

  /**
   * Shuffle an array in place using Fisher-Yates algorithm.
   * @param array - Array to shuffle
   * @returns The same array, shuffled
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Install this generator as Math.random for testing.
   * Call uninstall() when done to restore original Math.random.
   */
  install(): void {
    if (this.originalRandom !== null) {
      throw new Error('SeededRandom is already installed');
    }
    this.originalRandom = Math.random;
    Math.random = () => this.next();
  }

  /**
   * Restore the original Math.random.
   */
  uninstall(): void {
    if (this.originalRandom === null) {
      throw new Error('SeededRandom is not installed');
    }
    Math.random = this.originalRandom;
    this.originalRandom = null;
  }

  /**
   * Run a function with this seeded random installed.
   * Automatically restores Math.random after the function completes.
   * @param fn - Function to run
   */
  withRandom<T>(fn: () => T): T {
    this.install();
    try {
      return fn();
    } finally {
      this.uninstall();
    }
  }
}

/**
 * Create and install a seeded random generator for a test.
 * Returns a cleanup function to call in afterEach.
 *
 * Usage:
 * ```
 * let cleanup: () => void;
 *
 * beforeEach(() => {
 *   cleanup = installSeededRandom(12345);
 * });
 *
 * afterEach(() => {
 *   cleanup();
 * });
 * ```
 */
export function installSeededRandom(seed: number = 12345): () => void {
  const rng = new SeededRandom(seed);
  rng.install();
  return () => rng.uninstall();
}
