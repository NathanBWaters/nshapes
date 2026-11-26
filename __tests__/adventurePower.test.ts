/**
 * Power (data/weaponPower.ts, [GP-01]):
 *  - Clean C¹ square-root curve (`P <= 3 ? 1 + P : 2 + 2 * Math.sqrt(P - 2)`)
 *  - 4 authored weapon tiers (`frequent` 0.10, `tactical` 0.25, `feat` 0.60, `amplifier` 0.25)
 *    covering all 64 Armory weapons (including `wild-card` and `understudy`)
 *  - Level 1–5 scaling (1.00× / 1.25× / 1.50× / 1.75× / 2.00×)
 *  - Zero hidden `powerShare` belt dilution
 *  - Skill-feat Power gains (Perfect Parry +0.30, Counter Parry +0.15, 3-step Purity +0.25,
 *    Clutch Bomb <5s +0.25, Evolution +1.50)
 */
import type { Card } from '@/types';
import {
  NO_POWER,
  PER,
  POWER_KNEE,
  POWER_TIER_BASE,
  POWER_YIELD,
  SKILL_FEAT_POWER,
  damageMultiplier,
  formatPower,
  powerGainAtLevel,
  powerLevelFactor,
  powerMultiplier,
  powerShare,
  powerText,
  powerWatches,
  setPowerEnabled,
} from '@/adventure/data/weaponPower';
import { WEAPON_GROWTH, growthKey } from '@/adventure/data/weaponGrowth';
import { createMaxedSave } from '@/adventure/progress';
import { runReducer } from '@/adventure/engine/run';
import { EVOLUTION_RULES } from '@/adventure/engine/sources';
import { countDifferentAttributes } from '@/adventure/engine/sets';
import type { LevelDef, RunState } from '@/adventure/types';
import { findSet, plainRewards, playSet, startFight, testLevel, tick } from './testUtils/adventureFight';

const ARMORY = createMaxedSave().armory;
const held = (ids: string[], legacyWeaponTiers?: Record<string, number>) =>
  startFight({
    save: {
      armory: ids,
      charms: ids,
      ...(legacyWeaponTiers ? { legacyWeaponTiers } : {}),
    },
  });

const SAME_NUMBER: Pick<Card, 'shape' | 'color' | 'number'>[] = [
  { shape: 'oval', color: 'red', number: 2 },
  { shape: 'diamond', color: 'red', number: 2 },
  { shape: 'squiggle', color: 'red', number: 2 },
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

describe('the C¹ Power curve & 4-tier weaponPower catalog ([GP-01])', () => {
  it('matches exact C¹ square-root landmarks and smooth slope = 1 across the knee P = 3', () => {
    expect(POWER_KNEE).toBe(3);
    expect(powerMultiplier(0)).toBe(1);
    expect(powerMultiplier(1)).toBe(2);
    expect(powerMultiplier(3)).toBe(4);
    expect(powerMultiplier(6)).toBeCloseTo(6, 6);
    expect(powerMultiplier(11)).toBeCloseTo(8, 6);
    expect(powerMultiplier(18)).toBeCloseTo(10, 6);

    // C¹ continuity: right-hand derivative at P = 3 equals left-hand slope = 1.0
    const eps = 1e-6;
    const rightSlope = (powerMultiplier(3 + eps) - powerMultiplier(3)) / eps;
    expect(rightSlope).toBeCloseTo(1, 4);

    // Strictly monotonic everywhere
    let prev = 1;
    for (let p = 1; p <= 200; p += 1) {
      expect(powerMultiplier(p)).toBeGreaterThan(prev);
      prev = powerMultiplier(p);
    }

    expect(formatPower(0)).toBe('×1.0');
    expect(formatPower(3)).toBe('×4.0');
    expect(formatPower(18)).toBe('×10');
  });

  it('has zero hidden belt dilution (powerShare === 1 for any belt size)', () => {
    for (const n of [1, 2, 3, 4, 6, 8]) {
      expect(powerShare(n)).toBe(1);
    }
  });

  it('scales weapon Power yield cleanly from 1.00× (Lv1) to 2.00× (Lv5)', () => {
    expect([1, 2, 3, 4, 5].map(powerLevelFactor)).toEqual([1, 1.25, 1.5, 1.75, 2]);
    expect(powerGainAtLevel('blast-powder', 1)).toBe(0.1);
    expect(powerGainAtLevel('blast-powder', 5)).toBe(0.2);
    expect(powerGainAtLevel('rally-horn', 1)).toBe(0.25);
    expect(powerGainAtLevel('rally-horn', 5)).toBe(0.5);
    expect(powerGainAtLevel('glass-sword', 1)).toBe(0.6);
    expect(powerGainAtLevel('glass-sword', 5)).toBe(1.2);
  });

  it('authors an explicit mechanic-specific powerYield for ALL 64 Armory weapons with zero generic { on: set } overrides', () => {
    expect(ARMORY).toHaveLength(64);
    expect(NO_POWER.size).toBe(0);
    for (const id of ARMORY) {
      const def = POWER_YIELD[id];
      expect({ id, defined: Boolean(def) }).toEqual({ id, defined: true });
      expect({ id, watches: powerWatches(id).length > 0 }).toEqual({ id, watches: true });
      for (const w of def.watches) {
        // Never allow a lazy generic plain `{ on: 'set' }` trigger without a mechanic test
        if (w.on === 'set') {
          expect({ id, hasTest: Boolean(w.test) }).toEqual({ id, hasTest: true });
        }
      }
      if (id !== 'understudy') {
        expect({ id, tierBase: PER[id] }).toEqual({ id, tierBase: POWER_TIER_BASE[def.tier] });
      }
      const text = powerText(id, 1);
      expect(text).toMatch(/raises your Power/);
      if (id !== 'understudy') {
        expect(text).toMatch(/\+\d+\.\d{2} Power/);
      }
    }
    // Explicitly verify wild-card and understudy are included
    expect(POWER_YIELD['wild-card']?.tier).toBe('tactical');
    expect(POWER_YIELD['understudy']?.tier).toBe('amplifier');
  });
});

describe('Power in combat ([GP-01])', () => {
  it('grows from weapon triggers at Lv1..Lv5 rates and multiplies hits cleanly', () => {
    let s1 = held(['rally-horn']);
    // legacyWeaponTiers: 4 lifts weaponLevel to Lv5 (1 + 4 = 5 -> 2.00× Power yield)
    let s5 = held(['rally-horn'], { 'rally-horn': 4 });
    expect(s1.power).toBe(0);
    s1 = matchAt(s1);
    s5 = matchAt(s5);
    expect(s1.power).toBeCloseTo(0.25, 4);
    expect(s5.power).toBeCloseTo(0.5, 4);

    // Same Set deals more with Power on than off
    const withPower = matchAt(s5).totalDamage - s5.totalDamage;
    setPowerEnabled(false);
    try {
      expect(matchAt(s5).totalDamage - s5.totalDamage).toBeLessThan(withPower);
    } finally {
      setPowerEnabled(true);
    }
    expect(damageMultiplier(s5.power)).toBe(powerMultiplier(s5.power));
  });

  it('Understudy copies its left neighbor Power trigger at the higher level with zero belt dilution', () => {
    let solo = held(['rally-horn']);
    solo = matchAt(solo);
    let pair = held(['rally-horn', 'understudy']);
    pair = matchAt(pair);
    // Rally Horn (+0.25) + Understudy copying Rally Horn (+0.25) = +0.50 on Wave 1 Set #1!
    expect(solo.power).toBeCloseTo(0.25, 4);
    expect(pair.power).toBeCloseTo(0.5, 4);
  });

  it('keeps climbing past a weapon max growth stacks (Glass Sword every 5 unbroken Sets)', () => {
    let s = held(['glass-sword']);
    const max = WEAPON_GROWTH['glass-sword'][0].max!;
    for (let i = 0; i < 15; i++) s = matchAt(s);
    expect(s.growth[growthKey('glass-sword', 0)]?.stacks).toBe(max);
    const atLimit = s.power;
    expect(atLimit).toBeCloseTo(3 * 0.6, 4);
    for (let i = 0; i < 5; i++) s = matchAt(s);
    expect(s.growth[growthKey('glass-sword', 0)]?.stacks).toBe(max);
    expect(s.power).toBeCloseTo(atLimit + 0.6, 4);
  });

  it('awards skill-feat Power even with zero charms (Parry, Purity 3-step, Clutch Bomb <5s, Evolution +1.50)', () => {
    // Plain fight with zero charms and no skill feats stays at 0 Power
    let plain = held([]);
    for (let i = 0; i < 3; i++) plain = matchAt(plain);
    expect(plain.power).toBe(0);

    // Evolution surge is +1.50
    expect(EVOLUTION_RULES.power).toBe(1.5);

    // Perfect Parry (+0.30) & Counter Parry (+0.15) with zero charms
    const parryLevel: LevelDef = testLevel({
      rules: { attributes: ['shape', 'color', 'number'], boardSize: 12, timer: 90, hearts: 5 },
      foes: [
        {
          name: 'Sparring Bot',
          icon: 'lorc/sword-clash',
          hp: 500,
          parry: {
            attackName: 'Slash',
            icon: 'lorc/sword-clash',
            counter: { kind: 'any' },
            cooldownMs: 8000,
            windupMs: 12000,
            perfectWindowMs: 3500,
            penalty: 'heart',
          },
        },
      ],
    });
    let counterRun = startFight({ level: parryLevel, save: { charms: [], armory: [] } });
    counterRun = tick(counterRun, 6000, 500); // enter windup (>3.5s left -> Counter Parry)
    expect(counterRun.parry?.phase).toBe('windup');
    counterRun = playSet(counterRun);
    expect(counterRun.power).toBeCloseTo(SKILL_FEAT_POWER.counterParry, 4);

    let perfectRun = startFight({ level: parryLevel, save: { charms: [], armory: [] } });
    perfectRun = tick(perfectRun, 15000, 500); // enter golden window (<=3.5s left -> Perfect Parry)
    expect(perfectRun.parry?.phase).toBe('windup');
    expect(perfectRun.parry!.msLeft).toBeLessThanOrEqual(3500);
    perfectRun = playSet(perfectRun);
    expect(perfectRun.power).toBeCloseTo(SKILL_FEAT_POWER.perfectParry, 4);

    // 3-step Purity chain (+0.25) with zero charms
    let purityRun = startFight({
      save: { selectedFighter: 'Pelican', charms: [], armory: [] },
      level: testLevel({ rules: { attributes: ['shape', 'color', 'number'], boardSize: 12 }, foes: [{ name: 'Dummy', hp: 500 }] }),
      features: ['hearts', 'gear', 'purity'],
    });
    const set = findSet(purityRun, cards => countDifferentAttributes(cards, purityRun.attributes) >= 2)!;
    const diff = countDifferentAttributes(set, purityRun.attributes);
    purityRun = { ...purityRun, purityChain: 2, lastDiffCount: diff - 1 };
    purityRun = playSet(purityRun, set);
    expect(purityRun.power).toBeCloseTo(SKILL_FEAT_POWER.purityChain3, 4);
  });
});
