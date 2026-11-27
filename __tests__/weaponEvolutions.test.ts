/**
 * Comprehensive verification & deterministic runtime simulation for Per-Weapon
 * Timed Evolutions (64 Armory weapons × 3 = 192 evolutions, all 26 EvolutionCondition
 * kinds, +18 ignition burst, +8 / +0.20× additive chassis, Encore Mask, 3s cooldown,
 * re-triggering with zero global cap, and 2-trait dormancy).
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Card, Color, Shape } from '@/types';
import { ALL_ARMORY_WEAPON_IDS } from '@/adventure/data/armory';
import {
  EVOLUTION_COUNT,
  EVOLUTION_WEAPON_COUNT,
  WEAPON_EVOLUTIONS,
  WEAPON_EVOLUTION_MAP,
  evolutionConditionShort,
  evolutionConditionText,
  evolutionsForWeapon,
  getWeaponEvolution,
} from '@/adventure/data/evolutions';
import { SYNERGY_ATTR_IDS } from '@/adventure/data/synergy';
import { EVOLUTION_CHASSIS } from '@/adventure/engine/sources';
import { conditionTarget } from '@/adventure/engine/evolutions';
import { baseCardReward, runReducer } from '@/adventure/engine/run';
import { createMaxedSave } from '@/adventure/progress';
import type { EvolutionCondition, FeatureFlag, FoeDef, LevelRules, RunState, SynergyAttrId, WeaponEvolutionDef } from '@/adventure/types';
import { findSet, miss, plainRewards, playSet, relic, startFight, testLevel, tick, withWeapons } from './testUtils/adventureFight';

const ICON_SRC = fs.readFileSync(path.resolve(__dirname, '../src/components/Icon.tsx'), 'utf8');
const VALID_ICONS = new Set([...ICON_SRC.slice(ICON_SRC.indexOf('const ICON_REGISTRY')).matchAll(/^\s*'([^']+)':/gm)].map(m => m[1]));

const ALL_26_CONDITION_KINDS: readonly EvolutionCondition['kind'][] = [
  'color_set',
  'shape_set',
  'number_set',
  'exact_diff_traits',
  'rainbow_set',
  'purity_step',
  'board_geometry',
  'trait_cycle',
  'base_damage_hit',
  'total_damage_hit',
  'multiplied_hit',
  'cards_destroyed_single_set',
  'quick_sets',
  'sets_in_window',
  'clean_streak',
  'patient_sets',
  'combo_reach',
  'special_cards_matched',
  'trick_payout',
  'weapon_proc',
  'synergy_delta',
  'board_state',
  'parry_feat',
  'hazard_feat',
  'resource_action',
  'understudy_mirror',
];

const mkCard = (
  id: string,
  shape: Shape,
  color: Color,
  number: 1 | 2 | 3,
  extra: Partial<Card> = {}
): Card => ({
  id,
  shape,
  color,
  number,
  shading: 'solid',
  background: 'white',
  selected: false,
  ...extra,
});

/** Place a known 3-card Set at `slots` on the current board (default [0, 1, 2]) and match + replace it. */
const playForcedSet = (
  s: RunState,
  cards: [Card, Card, Card],
  opts?: {
    slots?: [number, number, number];
    hinted?: boolean;
    resolveWeapons?: boolean;
    graceUsed?: boolean;
    useBaseRewards?: boolean;
  }
): RunState => {
  const slots = opts?.slots ?? [0, 1, 2];
  const board = [...s.board];
  for (let i = 0; i < 3; i++) {
    board[slots[i]] = cards[i];
  }
  const primed: RunState = { ...s, board };
  const rewards = opts?.useBaseRewards ? cards.map(baseCardReward) : plainRewards(cards);
  let next = runReducer(primed, {
    type: 'MATCH',
    cards,
    rewards,
    hinted: opts?.hinted,
    resolveWeapons: opts?.resolveWeapons,
    graceUsed: opts?.graceUsed,
  });
  next = runReducer(next, { type: 'REPLACE', ids: cards.map(c => c.id) });
  return next;
};

/** Start a clean fight equipped with the specified weapon(s) and their chosen evolution(s). */
const startEvoFight = (
  charms: string[],
  equippedEvolutions: Record<string, string>,
  opts?: {
    rules?: Partial<LevelRules>;
    features?: FeatureFlag[];
    foeParry?: FoeDef[];
    upgrades?: Record<string, number>;
    seed?: number;
    fighter?: RunState['fighter'];
  }
): RunState => {
  const unlocked = Object.values(equippedEvolutions);
  return startFight({
    seed: opts?.seed ?? 11,
    save: {
      selectedFighter: opts?.fighter ?? 'Pelican',
      armory: charms,
      charms,
      stars: { '1-10': 3, '2-10': 3 },
      upgrades: { charm_belt: 1, ...(opts?.upgrades ?? {}) },
      unlockedWeaponEvolutions: unlocked,
      equippedEvolutions,
    },
    level: testLevel({
      foes: opts?.foeParry ?? [{ name: 'Evo Dummy', hp: 5000 }],
      rules: { timer: 300, boardSize: 12, hearts: 5, startingHints: 4, startingGraces: 3, ...opts?.rules },
    }),
    features: opts?.features ?? ['hearts', 'gear', 'rainbow', 'purity', 'coins', 'hints', 'graces', 'xp', 'evolutions'],
  });
};

const trackerOf = (s: RunState, weaponId: string) =>
  s.weaponEvolutions.find(t => t.weaponId === weaponId)!;

const findEvoByKind = <K extends EvolutionCondition['kind']>(
  kind: K,
  pred: (e: WeaponEvolutionDef & { condition: Extract<EvolutionCondition, { kind: K }> }) => boolean = () => true
): WeaponEvolutionDef & { condition: Extract<EvolutionCondition, { kind: K }> } => {
  const found = WEAPON_EVOLUTIONS.find(
    (e): e is WeaponEvolutionDef & { condition: Extract<EvolutionCondition, { kind: K }> } =>
      e.condition.kind === kind && pred(e as WeaponEvolutionDef & { condition: Extract<EvolutionCondition, { kind: K }> })
  );
  if (!found) throw new Error(`No evolution found for condition kind "${kind}"`);
  return found;
};

describe('Per-Weapon Timed Evolutions — Catalog Integrity (64 × 3 = 192)', () => {
  it('defines exactly 192 unique evolutions (3 per each of the 64 Armory weapons) with valid icons, durations & copy', () => {
    expect(ALL_ARMORY_WEAPON_IDS).toHaveLength(64);
    expect(EVOLUTION_WEAPON_COUNT).toBe(64);
    expect(EVOLUTION_COUNT).toBe(192);
    expect(WEAPON_EVOLUTIONS).toHaveLength(192);
    expect(WEAPON_EVOLUTION_MAP.size).toBe(192);

    const ids = new Set<string>();
    const names = new Set<string>();
    const coveredSynergies = new Set<SynergyAttrId>();
    const coveredKinds = new Set<EvolutionCondition['kind']>();

    for (const weaponId of ALL_ARMORY_WEAPON_IDS) {
      const evos = evolutionsForWeapon(weaponId);
      expect(evos).toHaveLength(3);
      expect(evos.map(e => e.slotIndex)).toEqual([0, 1, 2]);
      for (const evo of evos) {
        expect(evo.weaponId).toBe(weaponId);
        expect(evo.id.startsWith(`${weaponId}:`)).toBe(true);
        expect(ids.has(evo.id)).toBe(false);
        ids.add(evo.id);
        expect(names.has(evo.name)).toBe(false);
        names.add(evo.name);

        // Verified ICON_REGISTRY icon
        expect(VALID_ICONS.has(evo.icon)).toBe(true);

        // Duration guardrail [12000, 28000] ms
        expect(evo.durationMs).toBeGreaterThanOrEqual(12000);
        expect(evo.durationMs).toBeLessThanOrEqual(28000);

        // Concise HUD / card strings (including colorblind-safe CVD formatting)
        const shortVerb = evo.shortVerb ?? '';
        expect(shortVerb.length).toBeGreaterThan(0);
        expect(shortVerb.length).toBeLessThanOrEqual(64);
        expect(evolutionConditionShort(evo, false).length).toBeGreaterThan(0);
        expect(evolutionConditionShort(evo, true).length).toBeGreaterThan(0);
        expect(evolutionConditionText(evo, false).length).toBeGreaterThan(0);
        expect(evolutionConditionText(evo, true).length).toBeGreaterThan(0);
        expect(evo.tagline.length).toBeGreaterThan(0);

        // Zero Catalyst or global Power references in new per-weapon evolutions
        expect(evo.tagline).not.toMatch(/\bcatalyst card\b|\bPOWER ×/i);
        expect(shortVerb).not.toMatch(/\bcatalyst card\b|\bPOWER ×/i);

        expect(evo.synergyTags.length).toBeGreaterThanOrEqual(1);
        for (const attr of evo.synergyTags) coveredSynergies.add(attr);
        coveredKinds.add(evo.condition.kind);
      }
    }

    // All 15 Synergy Graph nodes and all 26 EvolutionCondition kinds are covered
    for (const attr of SYNERGY_ATTR_IDS) {
      expect(coveredSynergies.has(attr)).toBe(true);
    }
    for (const kind of ALL_26_CONDITION_KINDS) {
      expect(coveredKinds.has(kind)).toBe(true);
    }
  });
});

describe('Per-Weapon Timed Evolutions — Lifecycle, Chassis, Cooldown & Encore Mask', () => {
  it('deals +18 ignition burst, adds +8 flat & +0.20× ADDITIVE mult per active evo, respects 3s cooldown & re-triggers with no cap', () => {
    const evoA = getWeaponEvolution('blast-powder:cluster-charge')!;
    const evoB = getWeaponEvolution('flint-spark:cinder-trail')!;
    let s = startEvoFight(
      ['blast-powder', 'flint-spark'],
      { 'blast-powder': evoA.id, 'flint-spark': evoB.id }
    );
    s = { ...s, blankEvolutionRules: true };

    // Ignition burst (+18) when evoA triggers
    const hp0 = s.foeHp;
    s = runReducer(s, { type: 'DEV_TRIGGER_EVO', weaponId: 'blast-powder' });
    expect(trackerOf(s, 'blast-powder').phase).toBe('active');
    expect(hp0 - s.foeHp).toBe(EVOLUTION_CHASSIS.ignitionBurstDamage);
    expect(s.evolutionsTriggered).toBe(1);
    expect(s.forgedEvolutions).toContain(evoA.id);

    // 1 active evo chassis (with blankEvolutionRules): (6 base + 8 flat) × 1.20 = 16.8 → 17
    const hp1 = s.foeHp;
    const set1 = findSet(s)!;
    s = runReducer(s, { type: 'MATCH', cards: set1, rewards: plainRewards(set1) });
    s = runReducer(s, { type: 'REPLACE', ids: set1.map(c => c.id) });
    expect(hp1 - s.foeHp).toBe(Math.round((6 + EVOLUTION_CHASSIS.setFlatDamage) * (1 + EVOLUTION_CHASSIS.setAdditiveMult)));

    // Ignite 2nd evo simultaneously -> ADDITIVE ×1.40 (NOT multiplicative ×2.25!)
    s = runReducer(s, { type: 'DEV_TRIGGER_EVO', weaponId: 'flint-spark' });
    expect(s.fightMetrics.maxSimultaneousEvos).toBe(2);
    expect(s.fightMetrics.distinctWeaponsEvolved).toBe(2);
    const hp2 = s.foeHp;
    const set2 = findSet(s)!;
    s = runReducer(s, { type: 'MATCH', cards: set2, rewards: plainRewards(set2) });
    s = runReducer(s, { type: 'REPLACE', ids: set2.map(c => c.id) });
    expect(hp2 - s.foeHp).toBe(
      Math.round((6 + EVOLUTION_CHASSIS.setFlatDamage * 2) * (1 + EVOLUTION_CHASSIS.setAdditiveMult * 2))
    );

    // Expire evoA -> enters 3s cooldown (cannot be re-advanced while on cooldown)
    const remA = trackerOf(s, 'blast-powder').activeRemainingMs;
    s = tick(s, remA + 250, 250);
    expect(trackerOf(s, 'blast-powder').phase).toBe('cooldown');
    expect(trackerOf(s, 'blast-powder').cooldownRemainingMs).toBeGreaterThan(0);
    expect(trackerOf(s, 'blast-powder').cooldownRemainingMs).toBeLessThanOrEqual(EVOLUTION_CHASSIS.defaultCooldownMs);

    // Finish 3s cooldown -> returns to 'charging', can re-trigger unlimited times (no global cap!)
    s = tick(s, EVOLUTION_CHASSIS.defaultCooldownMs + 250, 250);
    expect(trackerOf(s, 'blast-powder').phase).toBe('charging');
    s = runReducer(s, { type: 'DEV_TRIGGER_EVO', weaponId: 'blast-powder' });
    expect(trackerOf(s, 'blast-powder').phase).toBe('active');
    expect(trackerOf(s, 'blast-powder').triggersCount).toBe(2);
  });

  it('runs openingEffects on ignition, finaleEffects on expiry, Evolution Lab +2s/tier, and Encore Mask replay + head-start tick', () => {
    // Find an evolution that has both openingEffects and finaleEffects
    const evo = WEAPON_EVOLUTIONS.find(e => (e.openingEffects?.length ?? 0) > 0 && (e.finaleEffects?.length ?? 0) > 0)!;
    expect(evo).toBeDefined();

    // Evolution Lab tier 2 adds +4000ms; Encore Mask Lv 1 adds +4000ms + 24 blast + ×1.3 Curtain Call + 1 head-start tick
    let s = startEvoFight(
      [evo.weaponId, 'encore-mask'],
      { [evo.weaponId]: evo.id, 'encore-mask': 'encore-mask:standing-ovation' },
      { upgrades: { evolution_lab: 2 } }
    );
    s = runReducer(s, { type: 'DEV_TRIGGER_EVO', weaponId: evo.weaponId });
    const tActive = trackerOf(s, evo.weaponId);
    expect(tActive.phase).toBe('active');
    expect(tActive.durationMs).toBe(evo.durationMs + 4000 + 4000);

    // Expire the evolution -> Encore blast + Curtain Call (×1.3) + pending head-start tick!
    const hpBeforeEnd = s.foeHp;
    s = tick(s, tActive.activeRemainingMs + 250, 250);
    expect(trackerOf(s, evo.weaponId).phase).toBe('cooldown');
    expect(hpBeforeEnd - s.foeHp).toBeGreaterThanOrEqual(24);
    expect(s.nextSetMultiplier).toBeGreaterThanOrEqual(1.3);

    // After 3s cooldown finishes, Encore head-start tick pre-fills progress (when target > 1)
    s = tick(s, EVOLUTION_CHASSIS.defaultCooldownMs + 250, 250);
    const tRecharged = trackerOf(s, evo.weaponId);
    expect(tRecharged.phase).toBe('charging');
    if (tRecharged.target > 1) {
      expect(tRecharged.progress).toBeGreaterThanOrEqual(1);
    }
  });

  it('stays completely dormant when the evolutions feature is off (2-trait tutorial boards)', () => {
    const s = startEvoFight(
      ['blast-powder'],
      { 'blast-powder': 'blast-powder:cluster-charge' },
      { rules: { attributes: ['shape', 'color'], boardSize: 9 }, features: ['hearts', 'gear'] }
    );
    expect(s.weaponEvolutions).toEqual([]);
  });
});

describe('Per-Weapon Timed Evolutions — Deterministic Simulation of ALL 26 EvolutionCondition Kinds', () => {
  it('1. color_set (consecutive): 3 Red/Orange matches in a row (blast-powder:napalm-payload)', () => {
    const evo = getWeaponEvolution('blast-powder:napalm-payload')!;
    expect(evo.condition).toEqual({ kind: 'color_set', color: 'red', target: 3, consecutive: true });
    let s = startEvoFight(['blast-powder'], { 'blast-powder': evo.id });

    // 1st Red Set -> progress 1/3
    s = playForcedSet(s, [
      mkCard('r1', 'oval', 'red', 1),
      mkCard('r2', 'diamond', 'red', 2),
      mkCard('r3', 'squiggle', 'red', 3),
    ]);
    expect(trackerOf(s, 'blast-powder').progress).toBe(1);

    // Non-red Set resets consecutive streak back to 0!
    s = playForcedSet(s, [
      mkCard('g1', 'oval', 'green', 1),
      mkCard('g2', 'diamond', 'green', 2),
      mkCard('g3', 'squiggle', 'green', 3),
    ]);
    expect(trackerOf(s, 'blast-powder').progress).toBe(0);

    // 3 consecutive Red Sets -> ignites!
    for (let k = 0; k < 3; k++) {
      s = playForcedSet(s, [
        mkCard(`rr${k}a`, 'oval', 'red', 1),
        mkCard(`rr${k}b`, 'diamond', 'red', 2),
        mkCard(`rr${k}c`, 'squiggle', 'red', 3),
      ]);
    }
    expect(trackerOf(s, 'blast-powder').phase).toBe('active');
  });

  it('2. shape_set: triggers on matching same-shape Sets', () => {
    const evo = findEvoByKind('shape_set');
    const shape: Shape = evo.condition.shape === 'any_same' ? 'oval' : evo.condition.shape;
    let s = startEvoFight([evo.weaponId], { [evo.weaponId]: evo.id });
    for (let k = 0; k < evo.condition.target; k++) {
      s = playForcedSet(s, [
        mkCard(`sh${k}a`, shape, 'red', 1),
        mkCard(`sh${k}b`, shape, 'green', 2),
        mkCard(`sh${k}c`, shape, 'purple', 3),
      ]);
    }
    expect(trackerOf(s, evo.weaponId).phase).toBe('active');
  });

  it('3. number_set: triggers on same-number or 1-2-3 number triad Sets', () => {
    const evo = findEvoByKind('number_set');
    let s = startEvoFight([evo.weaponId], { [evo.weaponId]: evo.id });
    for (let k = 0; k < evo.condition.target; k++) {
      const nums: [1 | 2 | 3, 1 | 2 | 3, 1 | 2 | 3] =
        evo.condition.mode === 'diff'
          ? [1, 2, 3]
          : [evo.condition.value ?? 1, evo.condition.value ?? 1, evo.condition.value ?? 1];
      s = playForcedSet(s, [
        mkCard(`n${k}a`, 'oval', 'red', nums[0]),
        mkCard(`n${k}b`, 'diamond', 'green', nums[1]),
        mkCard(`n${k}c`, 'squiggle', 'purple', nums[2]),
      ]);
    }
    expect(trackerOf(s, evo.weaponId).phase).toBe('active');
  });

  it('4. exact_diff_traits: 3 matches where ONLY the number differs (rally-horn:brass-apocalypse)', () => {
    const evo = getWeaponEvolution('rally-horn:brass-apocalypse')!;
    expect(evo.condition).toEqual({ kind: 'exact_diff_traits', diffCount: 1, onlyDiffAttr: 'number', target: 3 });
    let s = startEvoFight(['rally-horn'], { 'rally-horn': evo.id });

    // A color-only-diff Set must NOT advance `onlyDiffAttr: 'number'`
    s = playForcedSet(s, [
      mkCard('co1', 'oval', 'red', 1),
      mkCard('co2', 'oval', 'green', 1),
      mkCard('co3', 'oval', 'purple', 1),
    ]);
    expect(trackerOf(s, 'rally-horn').progress).toBe(0);

    // 3 Sets where ONLY number differs -> ignites!
    for (let k = 0; k < 3; k++) {
      s = playForcedSet(s, [
        mkCard(`no${k}a`, 'oval', 'red', 1),
        mkCard(`no${k}b`, 'oval', 'red', 2),
        mkCard(`no${k}c`, 'oval', 'red', 3),
      ]);
    }
    expect(trackerOf(s, 'rally-horn').phase).toBe('active');
  });

  it('5. rainbow_set (consecutive): 5 back-to-back all-different matches (rainbow-charm:prismatic-apotheosis)', () => {
    const evo = getWeaponEvolution('rainbow-charm:prismatic-apotheosis')!;
    expect(evo.condition).toEqual({ kind: 'rainbow_set', target: 5, consecutive: true });
    let s = startEvoFight(['rainbow-charm'], { 'rainbow-charm': evo.id });

    // 2 Rainbows -> 2/5, then non-Rainbow resets to 0!
    for (let k = 0; k < 2; k++) {
      s = playForcedSet(s, [
        mkCard(`rb0_${k}a`, 'oval', 'red', 1),
        mkCard(`rb0_${k}b`, 'diamond', 'green', 2),
        mkCard(`rb0_${k}c`, 'squiggle', 'purple', 3),
      ]);
    }
    expect(trackerOf(s, 'rainbow-charm').progress).toBe(2);

    s = playForcedSet(s, [
      mkCard('nr1', 'oval', 'red', 1),
      mkCard('nr2', 'oval', 'red', 2),
      mkCard('nr3', 'oval', 'red', 3),
    ]);
    expect(trackerOf(s, 'rainbow-charm').progress).toBe(0);

    // 5 consecutive Rainbows -> ignites!
    for (let k = 0; k < 5; k++) {
      s = playForcedSet(s, [
        mkCard(`rb${k}a`, 'oval', 'red', 1),
        mkCard(`rb${k}b`, 'diamond', 'green', 2),
        mkCard(`rb${k}c`, 'squiggle', 'purple', 3),
      ]);
    }
    expect(trackerOf(s, 'rainbow-charm').phase).toBe('active');
  });

  it('6. purity_step: ascending diff-count Purity chains advance and ignite', () => {
    const evo = findEvoByKind('purity_step');
    const minChain = evo.condition.minChain ?? 2;
    let s = startEvoFight([evo.weaponId], { [evo.weaponId]: evo.id });

    for (let k = 0; k < evo.condition.target; k++) {
      // Break prior chain with 3-diff or start at 1-diff -> 2-diff (-> 3-diff if minChain >= 3)
      s = playForcedSet(s, [
        mkCard(`p1_${k}a`, 'oval', 'red', 1),
        mkCard(`p1_${k}b`, 'oval', 'red', 2),
        mkCard(`p1_${k}c`, 'oval', 'red', 3),
      ]);
      s = playForcedSet(s, [
        mkCard(`p2_${k}a`, 'oval', 'red', 1),
        mkCard(`p2_${k}b`, 'diamond', 'red', 2),
        mkCard(`p2_${k}c`, 'squiggle', 'red', 3),
      ]);
      if (minChain >= 3) {
        s = playForcedSet(s, [
          mkCard(`p3_${k}a`, 'oval', 'red', 1),
          mkCard(`p3_${k}b`, 'diamond', 'green', 2),
          mkCard(`p3_${k}c`, 'squiggle', 'purple', 3),
        ]);
      }
    }
    expect(trackerOf(s, evo.weaponId).phase).toBe('active');
  });

  it('7. board_geometry: same_row, same_col, corners, adjacent_cluster, reuse_last_slot, touch_last_set all work', () => {
    const geometries: [
      Extract<EvolutionCondition, { kind: 'board_geometry' }>['geometry'],
      [number, number, number],
      [number, number, number]?
    ][] = [
      ['same_row', [0, 1, 2]],
      ['same_col', [0, 3, 6]],
      ['corners', [0, 2, 9]],
      ['adjacent_cluster', [0, 1, 3]],
      ['reuse_last_slot', [0, 1, 2], [2, 4, 5]],
      ['touch_last_set', [0, 1, 2], [3, 4, 5]],
    ];

    for (const [geometry, firstSlots, followSlots] of geometries) {
      const evo = WEAPON_EVOLUTIONS.find(
        (e): e is WeaponEvolutionDef & { condition: Extract<EvolutionCondition, { kind: 'board_geometry' }> } =>
          e.condition.kind === 'board_geometry' && e.condition.geometry === geometry
      );
      if (!evo) continue;
      let s = startEvoFight([evo.weaponId], { [evo.weaponId]: evo.id });
      const needed = evo.condition.target + (followSlots ? 1 : 0);
      for (let k = 0; k < needed; k++) {
        const slots = followSlots ? (k % 2 === 0 ? firstSlots : followSlots) : firstSlots;
        s = playForcedSet(
          s,
          [
            mkCard(`geo_${geometry}_${k}a`, 'oval', 'red', 1),
            mkCard(`geo_${geometry}_${k}b`, 'diamond', 'green', 2),
            mkCard(`geo_${geometry}_${k}c`, 'squiggle', 'purple', 3),
          ],
          { slots }
        );
      }
      expect({ geometry, phase: trackerOf(s, evo.weaponId).phase }).toEqual({ geometry, phase: 'active' });
    }
  });

  it('8. trait_cycle: matching all 3 unique values of a trait ignores duplicates and ignites on the 3rd', () => {
    const evo = findEvoByKind('trait_cycle');
    let s = startEvoFight([evo.weaponId], { [evo.weaponId]: evo.id });
    const makeValSet = (idx: number, tag: string): [Card, Card, Card] => {
      if (evo.condition.attr === 'color') {
        const c = (['red', 'green', 'purple'] as const)[idx];
        return [mkCard(`${tag}a`, 'oval', c, 1), mkCard(`${tag}b`, 'diamond', c, 2), mkCard(`${tag}c`, 'squiggle', c, 3)];
      }
      if (evo.condition.attr === 'shape') {
        const sh = (['oval', 'diamond', 'squiggle'] as const)[idx];
        return [mkCard(`${tag}a`, sh, 'red', 1), mkCard(`${tag}b`, sh, 'green', 2), mkCard(`${tag}c`, sh, 'purple', 3)];
      }
      const n = ([1, 2, 3] as const)[idx];
      return [mkCard(`${tag}a`, 'oval', 'red', n), mkCard(`${tag}b`, 'diamond', 'green', n), mkCard(`${tag}c`, 'squiggle', 'purple', n)];
    };

    s = playForcedSet(s, makeValSet(0, 'tc0'));
    expect(trackerOf(s, evo.weaponId).progress).toBe(1);
    // Repeat value 0 -> stays at 1!
    s = playForcedSet(s, makeValSet(0, 'tc0dup'));
    expect(trackerOf(s, evo.weaponId).progress).toBe(1);
    s = playForcedSet(s, makeValSet(1, 'tc1'));
    expect(trackerOf(s, evo.weaponId).progress).toBe(2);
    s = playForcedSet(s, makeValSet(2, 'tc2'));
    expect(trackerOf(s, evo.weaponId).phase).toBe('active');
  });

  it('9. base_damage_hit: hitting a base damage threshold (e.g. 15+) ignores plain 6-dmg Sets and ignites on boosted Sets', () => {
    const evo = findEvoByKind('base_damage_hit');
    let s = startEvoFight([evo.weaponId], { [evo.weaponId]: evo.id });

    // Plain 6-dmg Set does not meet base_damage_hit threshold (≥ 14+)
    s = playForcedSet(s, [
      mkCard('bd_low1', 'oval', 'red', 1),
      mkCard('bd_low2', 'diamond', 'green', 2),
      mkCard('bd_low3', 'squiggle', 'purple', 3),
    ]);
    expect(trackerOf(s, evo.weaponId).progress).toBe(0);

    // Boosted cards pushing base damage comfortably above threshold -> ignites!
    const target = conditionTarget(evo.condition);
    for (let k = 0; k < target; k++) {
      s = playForcedSet(
        s,
        [
          mkCard(`bd_hi${k}a`, 'oval', 'red', 1, { bonusPoints: evo.condition.threshold }),
          mkCard(`bd_hi${k}b`, 'diamond', 'green', 2, { bonusPoints: 10 }),
          mkCard(`bd_hi${k}c`, 'squiggle', 'purple', 3),
        ],
        { useBaseRewards: true }
      );
    }
    expect(trackerOf(s, evo.weaponId).phase).toBe('active');
  });

  it('10. total_damage_hit: ignites when a Set hit reaches the total damage threshold', () => {
    const evo = findEvoByKind('total_damage_hit');
    let s = startEvoFight([evo.weaponId], { [evo.weaponId]: evo.id });
    const target = conditionTarget(evo.condition);
    for (let k = 0; k < target; k++) {
      s = playForcedSet(
        s,
        [
          mkCard(`td${k}a`, 'oval', 'red', 1, { bonusPoints: evo.condition.threshold + 10 }),
          mkCard(`td${k}b`, 'diamond', 'green', 2),
          mkCard(`td${k}c`, 'squiggle', 'purple', 3),
        ],
        { useBaseRewards: true }
      );
    }
    expect(trackerOf(s, evo.weaponId).phase).toBe('active');
  });

  it('11. multiplied_hit: ignites when a Set combined multiplier reaches threshold', () => {
    const evo = findEvoByKind('multiplied_hit');
    let s = startEvoFight([evo.weaponId], { [evo.weaponId]: evo.id });
    const target = conditionTarget(evo.condition);
    for (let k = 0; k < target; k++) {
      // Prime nextSetMultiplier + 3 Holo cards so combined multiplier exceeds any threshold
      s = { ...s, nextSetMultiplier: 2.0 };
      s = playForcedSet(
        s,
        [
          mkCard(`mh${k}a`, 'oval', 'red', 1, { holo: true }),
          mkCard(`mh${k}b`, 'diamond', 'green', 2, { holo: true }),
          mkCard(`mh${k}c`, 'squiggle', 'purple', 3, { holo: true }),
        ],
        { useBaseRewards: true }
      );
    }
    expect(trackerOf(s, evo.weaponId).phase).toBe('active');
  });

  it('12. cards_destroyed_single_set: ignites when 1 Set + collateral blasts destroy >= threshold cards', () => {
    const evo = findEvoByKind('cards_destroyed_single_set');
    let s = startEvoFight([evo.weaponId], { [evo.weaponId]: evo.id });
    // Attach a relic that fires a big 3×3 explosion on every Set so >= 6 cards are destroyed in one turn
    s = withWeapons(s, relic([{ trigger: { on: 'set' }, effects: [{ do: 'explode', area: { shape: 'block', cols: 3, rows: 3 } }] }], undefined, 'test-nuke'));
    const target = conditionTarget(evo.condition);
    for (let k = 0; k < target; k++) {
      s = playSet(s);
    }
    expect(trackerOf(s, evo.weaponId).phase).toBe('active');
  });

  it('13. quick_sets: ignites on fast Sets within withinMs', () => {
    const evo = findEvoByKind('quick_sets');
    let s = startEvoFight([evo.weaponId], { [evo.weaponId]: evo.id });
    for (let k = 0; k < evo.condition.target; k++) {
      s = tick(s, 500, 500);
      s = playSet(s);
    }
    expect(trackerOf(s, evo.weaponId).phase).toBe('active');
  });

  it('14. sets_in_window: prunes expired timestamps and ignites when N Sets land inside windowMs', () => {
    const evo = findEvoByKind('sets_in_window');
    let s = startEvoFight([evo.weaponId], { [evo.weaponId]: evo.id });

    // Score 1 Set, then wait longer than windowMs so it falls out of the window
    s = playSet(s);
    expect(trackerOf(s, evo.weaponId).progress).toBe(1);
    s = tick(s, evo.condition.windowMs + 2000, 1000);

    // Now score target Sets rapidly inside windowMs -> ignites!
    for (let k = 0; k < evo.condition.target; k++) {
      s = tick(s, 500, 500);
      s = playSet(s);
    }
    expect(trackerOf(s, evo.weaponId).phase).toBe('active');
  });

  it('15. clean_streak: resets on mistake and ignites after N clean Sets', () => {
    const evo = findEvoByKind('clean_streak');
    let s = startEvoFight([evo.weaponId], { [evo.weaponId]: evo.id });
    s = playSet(s);
    expect(trackerOf(s, evo.weaponId).progress).toBeGreaterThanOrEqual(1);
    s = miss(s);
    expect(trackerOf(s, evo.weaponId).progress).toBe(0);
    for (let k = 0; k < evo.condition.target; k++) {
      s = playSet(s);
    }
    expect(trackerOf(s, evo.weaponId).phase).toBe('active');
  });

  it('16. patient_sets: ignores quick Sets and ignites after waiting >= minGapMs per Set', () => {
    const evo = findEvoByKind('patient_sets');
    let s = startEvoFight([evo.weaponId], { [evo.weaponId]: evo.id });
    s = tick(s, 500, 500);
    s = playSet(s);
    expect(trackerOf(s, evo.weaponId).progress).toBe(0);

    for (let k = 0; k < evo.condition.target; k++) {
      s = tick(s, evo.condition.minGapMs + 500, 1000);
      s = playSet(s);
    }
    expect(trackerOf(s, evo.weaponId).phase).toBe('active');
  });

  it('17. combo_reach: ignites upon reaching minCombo via rapid Sets', () => {
    const evo = findEvoByKind('combo_reach');
    let s = startEvoFight([evo.weaponId], { [evo.weaponId]: evo.id }, { fighter: 'Sly Fox' });
    const setsNeeded = evo.condition.minCombo + (evo.condition.setsRequired ?? 1) + 2;
    for (let k = 0; k < setsNeeded && trackerOf(s, evo.weaponId).phase !== 'active'; k++) {
      s = tick(s, 500, 500);
      s = playSet(s);
    }
    expect(trackerOf(s, evo.weaponId).phase).toBe('active');
  });

  it('18. special_cards_matched: matches tagged special cards (holo, power, gold, burning, marked, wild, linked, armored)', () => {
    const evo = findEvoByKind('special_cards_matched');
    let s = startEvoFight([evo.weaponId], { [evo.weaponId]: evo.id });
    const tag = evo.condition.cardTag;
    const tagExtra: Partial<Card> =
      tag === 'power'
        ? { bonusPoints: 5 }
        : tag === 'gold'
          ? { bonusMoney: 3 }
          : tag === 'holo'
            ? { holo: true }
            : tag === 'burning'
              ? { onFire: true }
              : tag === 'wild'
                ? { isWild: true }
                : tag === 'armored'
                  ? { health: 2, bounty: 10 }
                  : { marked: true, bonusPoints: 5, holo: true };

    for (let k = 0; k < evo.condition.target && trackerOf(s, evo.weaponId).phase !== 'active'; k++) {
      if (tag === 'linked') {
        s = { ...s, connections: [{ id: `lk-${k}`, positionA: 0, positionB: 1, createdAt: 0 }] };
      }
      s = playForcedSet(
        s,
        [
          mkCard(`sp${k}a`, 'oval', 'red', 1, tagExtra),
          mkCard(`sp${k}b`, 'diamond', 'green', 2, tagExtra),
          mkCard(`sp${k}c`, 'squiggle', 'purple', 3, tagExtra),
        ],
        { useBaseRewards: true }
      );
    }
    expect(trackerOf(s, evo.weaponId).phase).toBe('active');
  });

  it('19. trick_payout: Magnet trick payouts advance and ignite Magnet evolution', () => {
    const evo = findEvoByKind('trick_payout', e => e.condition.trick === 'magnet');
    let s = startEvoFight(['magnet'], { magnet: evo.id });
    for (let k = 0; k < evo.condition.target && trackerOf(s, 'magnet').phase !== 'active'; k++) {
      s = playForcedSet(s, [
        mkCard(`mg${k}a`, 'oval', 'red', 1, { magnet: true }),
        mkCard(`mg${k}b`, 'diamond', 'green', 2),
        mkCard(`mg${k}c`, 'squiggle', 'purple', 3),
      ]);
    }
    expect(trackerOf(s, 'magnet').phase).toBe('active');
  });

  it('20. weapon_proc: fires both WeaponTriggerKind procs AND "own" weapon rule triggers', () => {
    // 20a: WeaponTriggerKind (e.g. explosion / fire / laser / ricochet / echo)
    const evoKind = findEvoByKind('weapon_proc', e => e.condition.procKind === 'explosion');
    let s1 = startEvoFight([evoKind.weaponId], { [evoKind.weaponId]: evoKind.id });
    s1 = withWeapons(s1, relic([{ trigger: { on: 'set' }, effects: [{ do: 'explode', area: { shape: 'random', count: 1 } }] }], undefined, 'test-boom'));
    for (let k = 0; k < evoKind.condition.target && trackerOf(s1, evoKind.weaponId).phase !== 'active'; k++) {
      s1 = playSet(s1);
    }
    expect(trackerOf(s1, evoKind.weaponId).phase).toBe('active');

    // 20b: procKind: 'own' (e.g. Rally Horn firing its own Rally rule on wave opener & every Nth Set)
    const evoOwn = findEvoByKind('weapon_proc', e => e.condition.procKind === 'own' && e.weaponId === 'rally-horn');
    let s2 = startEvoFight(['rally-horn'], { 'rally-horn': evoOwn.id });
    for (let k = 0; k < evoOwn.condition.target * 5 && trackerOf(s2, 'rally-horn').phase !== 'active'; k++) {
      s2 = playSet(s2);
    }
    expect(trackerOf(s2, 'rally-horn').phase).toBe('active');
  });

  it('21. synergy_delta: tracks Synergy attribute gains relative to fight/re-charge baseline', () => {
    const evo = findEvoByKind('synergy_delta', e => e.condition.attr === 'coins');
    let s = startEvoFight([evo.weaponId], { [evo.weaponId]: evo.id });
    s = withWeapons(
      s,
      relic([{ trigger: { on: 'set' }, effects: [{ do: 'coins', amount: evo.condition.target }] }], undefined, 'coin-tap')
    );
    s = playSet(s);
    expect(trackerOf(s, evo.weaponId).phase).toBe('active');
  });

  it('22. board_state: advances when board/resource condition holds during Sets', () => {
    const evo = findEvoByKind('board_state', e => e.condition.check === 'board_at_least');
    let s = startEvoFight(
      [evo.weaponId],
      { [evo.weaponId]: evo.id },
      { rules: { boardSize: Math.max(12, evo.condition.threshold) } }
    );
    const needed = conditionTarget(evo.condition);
    for (let k = 0; k < needed; k++) {
      s = playSet(s);
    }
    expect(trackerOf(s, evo.weaponId).phase).toBe('active');
  });

  it('23. parry_feat: advances and ignites on Parry / Perfect Parry against a parrying foe', () => {
    const evo = findEvoByKind('parry_feat');
    let s = startEvoFight(
      [evo.weaponId],
      { [evo.weaponId]: evo.id },
      {
        foeParry: [
          {
            name: 'Parry Dummy',
            hp: 5000,
            parry: {
              attackName: 'Slash',
              icon: 'lorc/sword-clash',
              counter: { kind: 'any' },
              cooldownMs: 2000,
              windupMs: 6000,
              perfectWindowMs: 3000,
              penalty: 'heart',
            },
          },
        ],
      }
    );
    for (let k = 0; k < evo.condition.target && trackerOf(s, evo.weaponId).phase !== 'active'; k++) {
      // Tick into the golden perfect window (works for 'any', 'perfect', and puts foe in 'staggered')
      s = tick(s, 6000, 500);
      while (s.parry && s.parry.phase !== 'windup') s = tick(s, 500, 500);
      if (s.parry && evo.condition.mode === 'perfect' && s.parry.msLeft > s.parry.spec.perfectWindowMs) {
        s = tick(s, s.parry.msLeft - s.parry.spec.perfectWindowMs + 250, 250);
      }
      s = playSet(s);
      if (evo.condition.mode === 'staggered_set' && s.parry?.phase === 'staggered') {
        s = playSet(s);
      }
    }
    expect(trackerOf(s, evo.weaponId).phase).toBe('active');
  });

  it('24. hazard_feat: defusing Time Bombs / Snares advances and ignites hazard_feat evolutions', () => {
    const evo = findEvoByKind('hazard_feat', e => e.condition.hazardKind === 'any' || e.condition.hazardKind === 'bomb');
    let s = startEvoFight(
      [evo.weaponId],
      { [evo.weaponId]: evo.id },
      { rules: { hazards: { timeBombs: { every: 99, seconds: 20 } } } }
    );
    for (let k = 0; k < evo.condition.target && trackerOf(s, evo.weaponId).phase !== 'active'; k++) {
      const bombCard = mkCard(`hb${k}a`, 'oval', 'red', 1, { hasCountdown: true, countdownTimer: 10 });
      s = { ...s, timeBombIds: [bombCard.id] };
      s = playForcedSet(s, [
        bombCard,
        mkCard(`hb${k}b`, 'diamond', 'green', 2),
        mkCard(`hb${k}c`, 'squiggle', 'purple', 3),
      ]);
    }
    expect(trackerOf(s, evo.weaponId).phase).toBe('active');
  });

  it('25. resource_action: hinted_set, surge_set (incl. non-Surge Rainbow fallback), and ally_evolution_started all work', () => {
    // 25a: hinted_set
    const evoHint = findEvoByKind('resource_action', e => e.condition.action === 'hinted_set');
    let sH = startEvoFight([evoHint.weaponId], { [evoHint.weaponId]: evoHint.id });
    for (let k = 0; k < evoHint.condition.target; k++) {
      const set = findSet(sH)!;
      sH = playForcedSet(sH, [set[0], set[1], set[2]], { hinted: true });
    }
    expect(trackerOf(sH, evoHint.weaponId).phase).toBe('active');

    // 25b: surge_set Rainbow fallback on a non-Surge level (never soft-locks!)
    const evoSurge = findEvoByKind('resource_action', e => e.condition.action === 'surge_set');
    let sS = startEvoFight([evoSurge.weaponId], { [evoSurge.weaponId]: evoSurge.id });
    expect(sS.surge).toBeNull();
    for (let k = 0; k < evoSurge.condition.target; k++) {
      sS = playForcedSet(sS, [
        mkCard(`sf${k}a`, 'oval', 'red', 1),
        mkCard(`sf${k}b`, 'diamond', 'green', 2),
        mkCard(`sf${k}c`, 'squiggle', 'purple', 3),
      ]);
    }
    expect(trackerOf(sS, evoSurge.weaponId).phase).toBe('active');

    // 25c: ally_evolution_started
    const evoAlly = findEvoByKind('resource_action', e => e.condition.action === 'ally_evolution_started');
    const allyWeapon = evoAlly.weaponId === 'blast-powder' ? 'flint-spark' : 'blast-powder';
    const allyEvo = evolutionsForWeapon(allyWeapon)[0].id;
    let sA = startEvoFight(
      [allyWeapon, evoAlly.weaponId],
      { [allyWeapon]: allyEvo, [evoAlly.weaponId]: evoAlly.id }
    );
    for (let k = 0; k < evoAlly.condition.target && trackerOf(sA, evoAlly.weaponId).phase !== 'active'; k++) {
      sA = runReducer(sA, { type: 'DEV_TRIGGER_EVO', weaponId: allyWeapon });
      // Expire + cool down ally so it can trigger again if target > 1
      if (trackerOf(sA, evoAlly.weaponId).phase !== 'active') {
        sA = tick(sA, trackerOf(sA, allyWeapon).activeRemainingMs + EVOLUTION_CHASSIS.defaultCooldownMs + 500, 500);
      }
    }
    expect(trackerOf(sA, evoAlly.weaponId).phase).toBe('active');
  });

  it('26. understudy_mirror: supports BOTH ignite_with_left AND copy_condition seamlessly', () => {
    const mirrorIgnite = findEvoByKind('understudy_mirror', e => e.condition.mode === 'ignite_with_left');
    const mirrorCopy = findEvoByKind('understudy_mirror', e => e.condition.mode === 'copy_condition');

    // 26a: ignite_with_left -> Understudy auto-ignites the instant left neighbor (Flint Spark) ignites
    let s1 = startEvoFight(
      ['flint-spark', 'understudy'],
      { 'flint-spark': 'flint-spark:cinder-trail', understudy: mirrorIgnite.id }
    );
    expect(trackerOf(s1, 'understudy').phase).toBe('charging');
    s1 = runReducer(s1, { type: 'DEV_TRIGGER_EVO', weaponId: 'flint-spark' });
    expect(trackerOf(s1, 'flint-spark').phase).toBe('active');
    expect(trackerOf(s1, 'understudy').phase).toBe('active');

    // 26b: copy_condition -> Understudy copies Blast Powder's 3-Red-in-a-row condition and tracks independently
    let s2 = startEvoFight(
      ['blast-powder', 'understudy'],
      { 'blast-powder': 'blast-powder:napalm-payload', understudy: mirrorCopy.id }
    );
    expect(trackerOf(s2, 'understudy').target).toBe(3);
    for (let k = 0; k < 3; k++) {
      s2 = playForcedSet(s2, [
        mkCard(`uc${k}a`, 'oval', 'red', 1),
        mkCard(`uc${k}b`, 'diamond', 'red', 2),
        mkCard(`uc${k}c`, 'squiggle', 'red', 3),
      ]);
    }
    expect(trackerOf(s2, 'blast-powder').phase).toBe('active');
    expect(trackerOf(s2, 'understudy').phase).toBe('active');
  });

  it('createMaxedSave equips a valid Slot-0 evolution for every one of the 64 Armory weapons', () => {
    const maxed = createMaxedSave();
    expect(maxed.unlockedWeaponEvolutions).toHaveLength(192);
    for (const wId of ALL_ARMORY_WEAPON_IDS) {
      const equipped = maxed.equippedEvolutions[wId];
      expect(equipped).toBeDefined();
      expect(getWeaponEvolution(equipped)?.weaponId).toBe(wId);
    }
  });
});
