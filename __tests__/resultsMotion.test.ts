/**
 * The results payout's timeline (src/adventure/components/ResultsMotion.tsx,
 * review: docs/motion/reviews/results-payout.md): the stars land one after
 * another and overlap, each ✓ follows its star, the coins wait for a breath
 * after the last star, and the unlock reveal never covers a star still moving.
 */
import { coinRollAmount, coinRollTicks, coinStartMs, COIN_TICK_MS, FIGHTER_CHEER_LAG_MS, missesShownMs, TICK_LAG_MS } from '@/adventure/components/ResultsMotion';
import { STAR_FALL_MS, starLandMs, starPopDelayMs, starsLandedMs } from '@/adventure/components/ui';
import { SCALE } from '@/utils/motion';

describe('results payout timeline', () => {
  it('each star falls, lands, and the next one starts before the last has settled', () => {
    for (let i = 0; i < 3; i++) {
      expect(starLandMs(i)).toBe(starPopDelayMs(i) + STAR_FALL_MS);
      if (i > 0) {
        const gap = starPopDelayMs(i) - starPopDelayMs(i - 1);
        // Overlapping chain, not a list: the next star starts while the last one is still settling
        expect(gap).toBeGreaterThanOrEqual(STAR_FALL_MS);
        expect(gap).toBeLessThan(STAR_FALL_MS + 300);
      }
    }
    // The first star does not keep the player waiting
    expect(starLandMs(0)).toBeLessThanOrEqual(400);
  });

  it('a goal is ticked just behind its star, and the misses and caption after the last star', () => {
    expect(TICK_LAG_MS).toBeGreaterThan(0);
    expect(TICK_LAG_MS).toBeLessThanOrEqual(100);
    for (let stars = 1; stars <= 3; stars++) expect(missesShownMs(stars)).toBeGreaterThan(starLandMs(stars - 1));
  });

  it('the coins count after a breath, and the reveal waits for the last star', () => {
    for (let stars = 1; stars <= 3; stars++) {
      expect(coinStartMs(stars) - starLandMs(stars - 1)).toBeGreaterThanOrEqual(300);
      expect(starsLandedMs(stars)).toBeGreaterThan(starLandMs(stars - 1) + FIGHTER_CHEER_LAG_MS);
    }
    // The whole payout of a perfect result is over in about two seconds
    expect(coinStartMs(3) + coinRollTicks(coinRollAmount(100000)) * COIN_TICK_MS).toBeLessThanOrEqual(2100);
  });

  it('a bigger payout rolls longer, within the cue\'s range', () => {
    expect(coinRollTicks(coinRollAmount(10))).toBeLessThan(coinRollTicks(coinRollAmount(400)));
    expect(coinRollTicks(coinRollAmount(100000))).toBeLessThanOrEqual(16);
    expect(coinRollTicks(coinRollAmount(0))).toBeGreaterThanOrEqual(3);
  });

  it('a slammed star starts big but not so big it reads as broken', () => {
    expect(SCALE.slam).toBeGreaterThan(1.2);
    expect(SCALE.slam).toBeLessThanOrEqual(1.6);
  });
});
