/**
 * Verifies the 4-tier weapon-authored `POWER_YIELD` catalog in `data/weaponPower.ts` ([GP-01]):
 * replaces the old bot-fitted `PER` fudge table with transparent tier yields across all 64
 * Armory weapons and clean Lv 1–5 scaling (1.00× → 2.00×).
 */
import {
  PER,
  POWER_TIER_BASE,
  POWER_YIELD,
  powerGainAtLevel,
  powerPer,
  type PowerTier,
} from '@/adventure/data/weaponPower';
import { createMaxedSave } from '@/adventure/progress';

describe('4-tier weapon-authored Power catalog ([GP-01])', () => {
  const armory = createMaxedSave().armory;

  it('covers every single Armory weapon with one of the 4 clean tiers and zero arbitrary fudge numbers', () => {
    const validBases = new Set(Object.values(POWER_TIER_BASE));
    const counts: Record<PowerTier, number> = { frequent: 0, tactical: 0, feat: 0, amplifier: 0 };

    expect(Object.keys(POWER_YIELD).sort()).toEqual([...armory].sort());

    for (const id of armory) {
      const def = POWER_YIELD[id];
      expect(def).toBeDefined();
      counts[def.tier] += 1;
      if (id === 'understudy') {
        expect(powerPer(id)).toBe(0);
      } else {
        expect(validBases.has(PER[id])).toBe(true);
        expect(powerPer(id)).toBe(POWER_TIER_BASE[def.tier]);
        expect(powerGainAtLevel(id, 5)).toBeCloseTo(powerGainAtLevel(id, 1) * 2, 5);
      }
    }

    expect(counts.frequent).toBe(19);
    expect(counts.tactical).toBe(33);
    expect(counts.feat).toBe(10);
    expect(counts.amplifier).toBe(2);
    expect(counts.frequent + counts.tactical + counts.feat + counts.amplifier).toBe(64);
  });
});
