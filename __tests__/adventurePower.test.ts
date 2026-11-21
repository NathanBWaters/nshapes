/**
 * Power (data/weaponPower.ts): the fight-wide multiplier that weapon Scaling
 * feeds, and its targets on a 3-minute endgame fight (vs no gear):
 * one weapon ≈ ×10, a recipe pair ≈ ×50, a full build ≈ ×300.
 */
import type { Card, CharacterName } from '@/types';
import {
  NO_POWER, PER, POWER_KNEE, damageMultiplier, formatPower, powerMultiplier, powerShare, powerText, powerWatches, setPowerEnabled,
} from '@/adventure/data/weaponPower';
import { WEAPON_GROWTH, growthKey } from '@/adventure/data/weaponGrowth';
import { createMaxedSave } from '@/adventure/progress';
import { runReducer } from '@/adventure/engine/run';
import { EVOLUTION_RULES } from '@/adventure/engine/sources';
import { armableRecipes, buyTree, solidCharms } from '@/adventure/engine/botBuilds';
import { TREE_BUDGET } from '@/adventure/data/skillTrees';
import { createRng } from '@/adventure/engine/rng';
import { normalizeRecipePair, pace, scaleBench } from '@/adventure/balance/lab';
import { BALANCE_TARGETS, PARTNER_WEAPONS } from '@/adventure/balance/targets';
import type { AdventureSave, ArcanaId, RunState } from '@/adventure/types';
import { plainRewards, startFight } from './testUtils/adventureFight';

const ARMORY = createMaxedSave().armory;
const held = (ids: string[]) => startFight({ save: { armory: ids, charms: ids } });
const SAME_NUMBER: Pick<Card, 'shape' | 'color' | 'number'>[] = [
  { shape: 'oval', color: 'red', number: 2 }, { shape: 'diamond', color: 'red', number: 2 }, { shape: 'squiggle', color: 'red', number: 2 },
];
const matchAt = (s: RunState, slots = [0, 1, 2]): RunState => {
  const board = s.board.map((c, i) => {
    const k = slots.indexOf(i);
    return k < 0 ? c : { ...c, ...SAME_NUMBER[k], shading: 'solid' as const };
  });
  const cards = slots.map(i => board[i]);
  const next = runReducer({ ...s, board }, { type: 'MATCH', cards, rewards: plainRewards(cards), hinted: false });
  return runReducer(next, { type: 'REPLACE', ids: cards.map(c => c.id) });
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

describe('the Power meter', () => {
  it('starts at ×1, climbs one-for-one to the knee, then bends', () => {
    expect(powerMultiplier(0)).toBe(1);
    expect(powerMultiplier(POWER_KNEE)).toBe(1 + POWER_KNEE);
    let prev = 1;
    for (let p = 1; p <= 200; p += 1) {
      expect(powerMultiplier(p)).toBeGreaterThan(prev);
      prev = powerMultiplier(p);
    }
    // Past the knee, the next POWER_KNEE points add far less than the first POWER_KNEE
    expect(powerMultiplier(2 * POWER_KNEE) - powerMultiplier(POWER_KNEE)).toBeLessThan(POWER_KNEE / 2);
    expect(formatPower(0)).toBe('×1.0');
    expect(formatPower(POWER_KNEE)).toBe(1 + POWER_KNEE >= 10 ? `×${1 + POWER_KNEE}` : `×${(1 + POWER_KNEE).toFixed(1)}`);
  });

  it('a pair feeds it in full, a bigger belt shares it', () => {
    expect(powerShare(1)).toBe(1);
    expect(powerShare(2)).toBe(1);
    expect(powerShare(6)).toBeLessThan(0.6);
    // Still: six weapons together feed faster than any one alone
    expect(6 * powerShare(6)).toBeGreaterThan(2);
  });

  it('every Armory weapon feeds it (except the Understudy), with a tuned rate, and says so in its Scaling line', () => {
    for (const id of ARMORY) {
      if (NO_POWER.has(id)) {
        expect(powerWatches(id)).toEqual([]);
        expect(powerText(id)).toBeNull();
        continue;
      }
      expect({ id, watches: powerWatches(id).length > 0 }).toEqual({ id, watches: true });
      expect({ id, tuned: PER[id] > 0 }).toEqual({ id, tuned: true });
      expect(powerText(id)).toMatch(/raises your Power/);
    }
  });
});

describe('Power in a fight', () => {
  it('grows from what the weapon watches and multiplies every hit', () => {
    let s = held(['rally-horn']);
    expect(s.power).toBe(0);
    for (let i = 0; i < 4; i++) s = matchAt(s);
    expect(s.power).toBeGreaterThan(0);
    // The same Set dealt with Power off hits for less
    const withPower = matchAt(s).totalDamage - s.totalDamage;
    setPowerEnabled(false);
    try {
      expect(matchAt(s).totalDamage - s.totalDamage).toBeLessThan(withPower);
    } finally {
      setPowerEnabled(true);
    }
    expect(damageMultiplier(s.power)).toBe(powerMultiplier(s.power));
  });

  it('keeps climbing after the weapon\'s own Scaling has hit its limit', () => {
    let s = held(['glass-sword']);
    const max = WEAPON_GROWTH['glass-sword'][0].max!;
    for (let i = 0; i < 14; i++) s = matchAt(s);
    expect(s.growth[growthKey('glass-sword', 0)]?.stacks).toBe(max);
    const atLimit = s.power;
    for (let i = 0; i < 6; i++) s = matchAt(s);
    expect(s.growth[growthKey('glass-sword', 0)]?.stacks).toBe(max);
    expect(s.power).toBeGreaterThan(atLimit);
  });

  it('a fight with no weapons has no Power', () => {
    let s = held([]);
    for (let i = 0; i < 5; i++) s = matchAt(s);
    expect(s.power).toBe(0);
  });

  it('an evolution starting surges it', () => {
    expect(EVOLUTION_RULES.power).toBeGreaterThan(0);
  });
});

describe('Power targets on a 3-minute endgame fight (vs no gear)', () => {
  const T = BALANCE_TARGETS.power;
  const RUNS = 6;
  const { save } = scaleBench();
  let none = 0;
  beforeAll(() => {
    none = pace(save, RUNS).end;
  });
  const ratio = (s: AdventureSave) => pace(s, RUNS).end / Math.max(1, none);
  const inBand = (x: number, band: readonly [number, number]) => x >= band[0] && x <= band[1];

  it('one weapon reaches about ×10, and none is far off', () => {
    const singles = ARMORY.filter(id => !NO_POWER.has(id) && !PARTNER_WEAPONS.includes(id)).map(id => ({ id, x: ratio({ ...save, charms: [id] }) }));
    const mid = median(singles.map(s => s.x));
    expect({ mid, ok: inBand(mid, T.singleBand) }).toEqual({ mid, ok: true });
    for (const s of singles) expect({ ...s, ok: s.x >= T.singleBand[0] * 0.75 && s.x <= T.singleBand[1] * 1.25 }).toEqual({ ...s, ok: true });
  });

  it('a recipe pair reaches about ×50, and the best is not runaway', () => {
    const pairs = armableRecipes(save).map(r => ratio({ ...save, charms: normalizeRecipePair(r.options[0][0], r.options[1][0]) }));
    const mid = median(pairs);
    expect({ mid, ok: inBand(mid, T.pairBand) }).toEqual({ mid, ok: true });
    expect(Math.max(...pairs)).toBeLessThanOrEqual(T.pair * 4);
  });

  it('a full build (six charms with Role Set Bonuses, full tree, Workshop, coherent Arcana) reaches about ×300', () => {
    const maxed = createMaxedSave();
    // Coherent, non-contradictory 3-Arcana loadout (never pairs monochrome_pact + prismatic_fever)
    const coherentArcana: ArcanaId[] = ['prismatic_fever', 'catalyst_resonance', 'tempo_surge'];
    const fulls = (save.unlockedFighters as CharacterName[]).map(fighter => {
      const rng = createRng(7 + fighter.length);
      const s: AdventureSave = {
        ...save,
        upgrades: maxed.upgrades,
        selectedFighter: fighter,
        skillNodes: { [fighter]: buyTree(fighter, TREE_BUDGET, 'spread', rng) },
        equippedArcana: coherentArcana,
      };
      return ratio({ ...s, charms: solidCharms(s, rng) });
    });
    const mid = median(fulls);
    expect({ mid, ok: inBand(mid, T.fullBand) }).toEqual({ mid, ok: true });
  });
});
