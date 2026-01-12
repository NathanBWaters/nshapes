/**
 * Tier 1 Enemies
 *
 * Single effect, counters at 10-20% reduction, mild animal icons.
 * Used in rounds 1-5.
 */

// Import to trigger registration with factory
import './junkRat';
import './stalkingWolf';
import './burrowingMole';
import './maskedBandit';

// Re-export factory functions for direct access
export { createJunkRat } from './junkRat';
export { createStalkingWolf } from './stalkingWolf';
export { createBurrowingMole } from './burrowingMole';
export { createMaskedBandit } from './maskedBandit';
