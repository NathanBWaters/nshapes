/**
 * Comprehensive verification for Pillar 1 (Set-Parrying: default timing + specific
 * counters + Perfect Parry Stagger + Pre-Battle UI) and Pillar 2 (Live Multiplier
 * Ignition math & heat tiers + Lethal Kill-Cam snapshot).
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import type { Card } from '@/types';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { getLevel } from '@/adventure/data/levels';
import { PARRY_RULES, parryCounterMeta, resolveParrySpec } from '@/adventure/data/parry';
import { SURGE_RULES } from '@/adventure/data/rules';
import { setPowerEnabled } from '@/adventure/data/weaponPower';
import { buildDamageStory } from '@/adventure/engine/damageStory';
import { boardHasCounterSet, setMatchesCounter } from '@/adventure/engine/parry';
import { activeEnemyCounters, createRun, runReducer } from '@/adventure/engine/run';
import { isRainbow } from '@/adventure/engine/sets';
import { createMaxedSave, createNewSave } from '@/adventure/progress';
import { AnchorsProvider, useAnchors } from '@/adventure/fx/anchors';
import { counterForWeapon, GearBelt } from '@/adventure/fx/GearBelt';
import { buildBalatroBreakdown, buildIgnitionPlan, computePrimedEquation, heatTierFor } from '@/adventure/fx/MultiplierIgnition';
import ParryPreviewCard from '@/adventure/components/ParryPreviewCard';
import LevelPreview from '@/adventure/components/LevelPreview';
import type { LevelDef, ParryRequirement, ParrySpec } from '@/adventure/types';
import { eventsOf, findSet, plainRewards, playSet, relic, startFight, testLevel, tick, withWeapons } from './testUtils/adventureFight';

jest.mock('@/components/Icon', () => {
  const { Text: RNText } = require('react-native');
  return function MockIcon({ name }: { name: string }) {
    return <RNText>{name}</RNText>;
  };
});

jest.mock('@/components/enemies', () => {
  const { Text: RNText } = require('react-native');
  return { EnemyAvatar: ({ enemy }: { enemy: { name: string } }) => <RNText>{enemy.name}</RNText> };
});

jest.mock('@/components/fighters', () => {
  const { Text: RNText } = require('react-native');
  return { FighterAvatar: ({ character }: { character: string }) => <RNText>{character}</RNText> };
});

jest.mock('@/components/weapons', () => {
  const { Text: RNText } = require('react-native');
  return { WeaponAvatar: ({ weapon }: { weapon: { name: string } }) => <RNText>{weapon.name}</RNText> };
});

const mkCard = (
  id: string,
  shape: Card['shape'],
  color: Card['color'],
  number: Card['number'],
  extra: Partial<Card> = {}
): Card => ({
  id,
  shape,
  color,
  number,
  shading: 'solid',
  selected: false,
  ...extra,
});

const A3: LevelDef['rules']['attributes'] = ['shape', 'color', 'number'];

describe('Set-Parry counter matching', () => {
  const allRed: Card[] = [
    mkCard('a', 'oval', 'red', 1),
    mkCard('b', 'diamond', 'red', 2),
    mkCard('c', 'squiggle', 'red', 3),
  ];
  const allOvals: Card[] = [
    mkCard('a', 'oval', 'red', 1),
    mkCard('b', 'oval', 'green', 1),
    mkCard('c', 'oval', 'purple', 1),
  ];
  const rainbow: Card[] = [
    mkCard('a', 'oval', 'red', 1),
    mkCard('b', 'diamond', 'green', 2),
    mkCard('c', 'squiggle', 'purple', 3),
  ];
  const twoSame: Card[] = [
    mkCard('a', 'oval', 'red', 1),
    mkCard('b', 'oval', 'red', 2),
    mkCard('c', 'oval', 'red', 3),
  ];
  const twoDiff: Card[] = [
    mkCard('a', 'oval', 'red', 1),
    mkCard('b', 'diamond', 'green', 1),
    mkCard('c', 'squiggle', 'purple', 1),
  ];

  it('validates every counter requirement accurately', () => {
    expect(setMatchesCounter(allRed, A3, { kind: 'any' })).toBe(true);
    expect(setMatchesCounter(allRed, A3, { kind: 'color', color: 'red' })).toBe(true);
    expect(setMatchesCounter(allRed, A3, { kind: 'color', color: 'green' })).toBe(false);
    expect(setMatchesCounter(allOvals, A3, { kind: 'shape', shape: 'oval' })).toBe(true);
    expect(setMatchesCounter(allOvals, A3, { kind: 'shape', shape: 'diamond' })).toBe(false);
    expect(setMatchesCounter(rainbow, A3, { kind: 'all_different' })).toBe(true);
    expect(setMatchesCounter(allRed, A3, { kind: 'all_different' })).toBe(false);
    expect(setMatchesCounter(twoSame, A3, { kind: 'exact_same', count: 2 })).toBe(true);
    expect(setMatchesCounter(twoDiff, A3, { kind: 'exact_same', count: 2 })).toBe(false);
    expect(setMatchesCounter(twoDiff, A3, { kind: 'exact_diff', count: 2 })).toBe(true);
    expect(setMatchesCounter(twoSame, A3, { kind: 'exact_diff', count: 2 })).toBe(false);
    expect(setMatchesCounter(allOvals, A3, { kind: 'same_number' })).toBe(true);
    expect(setMatchesCounter(allRed, A3, { kind: 'diff_number' })).toBe(true);
  });

  it('respects Wild cards for color, shape, and number counters', () => {
    const withWild = [
      mkCard('a', 'oval', 'red', 2),
      mkCard('b', 'oval', 'red', 2),
      mkCard('c', 'diamond', 'green', 1, { isWild: true }),
    ];
    expect(setMatchesCounter(withWild, A3, { kind: 'color', color: 'red' })).toBe(true);
    expect(setMatchesCounter(withWild, A3, { kind: 'shape', shape: 'oval' })).toBe(true);
    expect(setMatchesCounter(withWild, A3, { kind: 'same_number' })).toBe(true);
  });

  it('every counter kind has crisp UI metadata without empty strings', () => {
    const reqs: ParryRequirement[] = [
      { kind: 'any' },
      { kind: 'color', color: 'red' },
      { kind: 'color', color: 'green' },
      { kind: 'color', color: 'purple' },
      { kind: 'shape', shape: 'oval' },
      { kind: 'shape', shape: 'diamond' },
      { kind: 'shape', shape: 'squiggle' },
      { kind: 'all_different' },
      { kind: 'exact_same', count: 2 },
      { kind: 'exact_diff', count: 2 },
      { kind: 'same_number' },
      { kind: 'diff_number' },
    ];
    for (const r of reqs) {
      const m = parryCounterMeta(r);
      expect(m.shortLabel.length).toBeGreaterThan(2);
      expect(m.label.length).toBeGreaterThan(4);
      expect(m.explain.length).toBeGreaterThan(10);
    }
  });
});

describe('Set-Parry live combat loop (Timing, Perfect Parry, Stagger ×2, Unparried Strike)', () => {
  const makeParryLevel = (parry: ParrySpec, hp = 200): LevelDef => ({
    id: 'parry-test',
    biome: 'woods',
    name: 'Parry Dojo',
    introduces: 'timer',
    rules: { attributes: A3, boardSize: 12, timer: 90, hearts: 5 },
    foes: [{ name: 'Dojo Knight', icon: 'lorc/sword-clash', hp, parry }],
    challenge: { kind: 'noMistakes' },
    coinMultiplier: 1,
    difficulty: 2,
    rewards: { star1: { coins: 10 }, star2: { coins: 20 }, star3: { coins: 30 } },
  });

  const baseSave = () => ({ ...createMaxedSave(), charms: [], equippedArcana: [], skillNodes: {}, upgrades: {} });

  it('default timing parry counters during wind-up, and Perfect Parry in the final golden window triggers Stagger ×2', () => {
    const level = makeParryLevel({
      attackName: 'Test Slash',
      icon: 'lorc/sword-clash',
      counter: { kind: 'any' },
      cooldownMs: 10000,
      windupMs: 12000,
      perfectWindowMs: 3500,
      penalty: 'heart',
    });
    let s = createRun(level, baseSave(), { seed: 77 });
    expect(s.parry?.phase).toBe('calm');

    // Advance into windup, then down into the golden Perfect Parry window (<= 3500ms)
    s = tick(s, 7500, 500);
    expect(s.parry?.phase).toBe('windup');
    s = tick(s, 9000, 500);
    expect(s.parry?.phase).toBe('windup');
    expect(s.parry!.msLeft).toBeLessThanOrEqual(3500);
    expect(eventsOf(s, 'parry_warn').length).toBe(1);

    // Match any valid Set → PERFECT PARRY + Stagger ×2!
    const set = findSet(s)!;
    expect(set).toBeDefined();
    const coinsBefore = s.coins;
    s = runReducer(s, { type: 'MATCH', cards: set, rewards: plainRewards(set) });
    expect(s.parriesLanded).toBe(1);
    expect(s.perfectParriesLanded).toBe(1);
    expect(s.parry?.phase).toBe('staggered');
    expect(s.parry?.msLeft).toBe(PARRY_RULES.perfectStaggerMs);
    expect(s.coins).toBeGreaterThanOrEqual(coinsBefore + PARRY_RULES.perfectParryCoins);
    expect(eventsOf(s, 'perfect_parry').length).toBe(1);
    expect(s.lastSetIgnition?.parryKind).toBe('perfect');

    // Next Set during Stagger deals ×2 Stagger multiplier!
    s = runReducer(s, { type: 'REPLACE', ids: set.map(c => c.id) });
    const nextSet = findSet(s)!;
    expect(nextSet).toBeDefined();
    s = runReducer(s, { type: 'MATCH', cards: nextSet, rewards: plainRewards(nextSet) });
    expect(s.lastSetIgnition?.staggered).toBe(true);
    expect(s.lastSetIgnition?.math.multItems?.some(m => m.label === 'Staggered!' && m.amount === 2)).toBe(true);
  });

  it('unparried telegraphed strike hits for 1 heart and resets to calm', () => {
    const level = makeParryLevel({
      attackName: 'Heavy Slam',
      icon: 'lorc/sword-clash',
      counter: { kind: 'any' },
      cooldownMs: 8000,
      windupMs: 10000,
      perfectWindowMs: 3500,
      penalty: 'heart',
    });
    let s = createRun(level, { ...baseSave(), selectedFighter: 'Corgi' }, {
      seed: 88,
      features: new Set(['hearts', 'gear', 'coins', 'hints', 'graces']),
    });
    const heartsBefore = s.hearts!;
    expect(heartsBefore).toBeGreaterThan(0);
    // Tick through initial calm (5600ms) + full 10000ms windup
    s = tick(s, 16500, 500);
    expect(s.hearts).toBe(heartsBefore - 1);
    expect(s.parry?.phase).toBe('calm');
    expect(eventsOf(s, 'foe_strike').length).toBe(1);
  });

  it('fairness stall buys +3s when a specific counter is not currently on the board', () => {
    const level = makeParryLevel({
      attackName: 'Crimson Cleave',
      icon: 'lorc/sword-clash',
      counter: { kind: 'color', color: 'red' },
      cooldownMs: 8000,
      windupMs: 12000,
      perfectWindowMs: 3500,
      penalty: 'heart',
    });
    let s = createRun(level, baseSave(), { seed: 99 });
    // Enter wind-up and advance partway
    s = tick(s, 10000, 500);
    expect(s.parry?.phase).toBe('windup');
    // Force a board with zero red cards (all green Set) so no all-red counter exists
    const greenBoard = s.board.map((c, idx) =>
      idx < 3
        ? mkCard(c.id, (['oval', 'diamond', 'squiggle'] as const)[idx], 'green', 1)
        : { ...c, color: 'green' as const }
    );
    s = { ...s, board: greenBoard };
    expect(boardHasCounterSet(s.board, s.attributes, { kind: 'color', color: 'red' })).toBe(false);

    const beforeLeft = s.parry!.msLeft;
    const set = s.board.slice(0, 3);
    s = runReducer(s, { type: 'MATCH', cards: set, rewards: plainRewards(set) });
    expect(s.parry!.msLeft).toBeGreaterThan(beforeLeft);
    expect(s.parry!.stallsUsed).toBe(1);
  });
});

describe('Live Multiplier Ignition & Pre-Battle Parry UI', () => {
  it('buildIgnitionPlan builds exact sequential steps and heat tiers', () => {
    const plan = buildIgnitionPlan({
      id: 42,
      math: {
        cards: 5,
        baseCards: 3,
        cardBonus: 2,
        surgeMultiplier: 5,
        collateral: {},
        flatBonus: 8,
        multiplier: 7,
        multItems: [
          { label: 'Rainbow Strike', amount: 2 },
          { label: 'Perfect Parry', amount: 1.75 },
          { label: 'Staggered!', amount: 2 },
        ],
        rainbow: true,
        extra: 4,
        powerMultiplier: 6,
        hit: 1410,
        diffTraits: 3,
        graceUsed: false,
        sinceLastMs: 2500,
        combo: 3,
      },
      parryKind: 'perfect',
      staggered: true,
      lethal: true,
      isBossOrElite: true,
      foeName: 'Ancient Dragon',
    });

    expect(plan.show).toBe(true);
    expect(plan.heatTier).toBe(3);
    expect(plan.total).toBe(1410);
    expect(plan.steps.some(st => st.label === 'SURGE')).toBe(true);
    expect(plan.steps.some(st => st.label === 'RAINBOW')).toBe(true);
    expect(plan.steps.some(st => st.label === 'PERFECT PARRY')).toBe(true);
    expect(heatTierFor(12)).toBe(0);
    expect(heatTierFor(35)).toBe(1);
    expect(heatTierFor(120)).toBe(2);
    expect(heatTierFor(250)).toBe(3);
  });

  it('shows the enemy Counter requirement UP FRONT in Adventure LevelPreview', () => {
    // [OB-10] 1-10 Iron Shell uses clean Timing Parry (ANY TRIO); 2-4 Masked Bandit debuts specific Counter-Parry (ALL ORANGE); 2-6 uses 2 TRAITS SAME.
    const bossLevel = getLevel('1-10');
    expect(resolveParrySpec(bossLevel, bossLevel.foes[0])?.counter).toEqual({ kind: 'any' });

    const counterLevel = getLevel('2-6'); // Junk Rat → Counter: 2 TRAITS SAME
    const spec = resolveParrySpec(counterLevel, counterLevel.foes[0]);
    expect(spec?.counter).toEqual({ kind: 'exact_same', count: 2 });

    const { getByTestId, getByText } = render(
      <LevelPreview
        level={counterLevel}
        save={createMaxedSave()}
        onClose={() => {}}
        onPlay={() => {}}
        onSelectFighter={() => {}}
        onSelectCharm={() => {}}
        onShowMechanic={() => {}}
      />
    );
    expect(getByTestId('preview-parry')).toBeTruthy();
    expect(getByText(/COUNTER: 2 TRAITS SAME/)).toBeTruthy();
  });

  it('ParryPreviewCard renders cleanly for default timing parry', () => {
    const { getByText } = render(
      <ParryPreviewCard
        spec={{
          attackName: 'Acorn Toss',
          icon: 'lorc/sword-clash',
          counter: { kind: 'any' },
          cooldownMs: 13000,
          windupMs: 16000,
          perfectWindowMs: 3500,
          penalty: 'glancing',
        }}
      />
    );
    expect(getByText(/COUNTER: ANY TRIO/)).toBeTruthy();
  });

  it('buildBalatroBreakdown itemizes Cards, flat bonuses, multipliers, Power, and follow-ups with exact running math', () => {
    const bd = buildBalatroBreakdown({
      id: 7,
      math: {
        cards: 9,
        baseCards: 3,
        cardBonus: 6,
        cardBonusNote: '3 Power cards (+6)',
        collateral: { explosion: 3 },
        flatBonus: 5,
        flatItems: [
          { label: 'Heavy Hitter', amount: 3, note: 'Workshop upgrade' },
          { label: 'Scrappy', amount: 2, note: '2 missing hearts' },
        ],
        multiplier: 2,
        multItems: [{ label: 'Rainbow Strike', amount: 2, note: 'every trait was different' }],
        rainbow: true,
        extra: 0,
        powerMultiplier: 1.5,
        powerPoints: 5,
        hit: 51,
        diffTraits: 3,
        graceUsed: false,
        sinceLastMs: 1200,
        combo: 2,
      },
      followUps: [{ label: 'Rally Horn', amount: 11, sourceRef: 'weapon:rally-horn' }],
      turnDamage: 62,
      lethal: false,
      isBossOrElite: false,
      foeName: 'Masked Bandit',
    });

    expect(bd.finalBase).toBe(17); // 9 cards + 3 blast + 3 Heavy Hitter + 2 Scrappy
    expect(bd.finalMult).toBe(3); // 2 Rainbow × 1.5 Power
    expect(bd.finalBonus).toBe(11); // +11 Rally Horn
    expect(bd.finalTotal).toBe(62);
    expect(bd.heatTier).toBe(2);
    expect(bd.receiptLine).toContain('Cards 3 (+6)');
    expect(bd.receiptLine).toContain('+3 Heavy Hitter');
    expect(bd.receiptLine).toContain('×2 Rainbow');
    expect(bd.receiptLine).toContain('+11 Rally Horn');
  });

  it('computePrimedEquation and finalizeTurnIgnition expose live primed math, follow-ups, and GearBelt badges', () => {
    const save = createMaxedSave();
    const run = createRun(getLevel('2-4'), save, { seed: 42 });
    const primed = computePrimedEquation(run);
    expect(primed.base).toBeGreaterThanOrEqual(6); // 3 base cards + 3 Heavy Hitter
    expect(primed.mult).toBeGreaterThanOrEqual(1);
    expect(primed.summaryLine).toContain('Heavy Hitter');

    const set = findSet(run)!;
    expect(set).toBeDefined();
    const after = runReducer(run, { type: 'MATCH', cards: set, rewards: plainRewards(set) });
    expect(after.lastSetIgnition?.turnDamage).toBe(after.totalDamage);
    expect(after.lastSetIgnition?.beltBadges).toBeDefined();
  });

  it('never duplicates Shading Surge ×5 in unified Wave 1 add-then-multiply math (plan, breakdown, and primed equation)', () => {
    const unifiedIgnition = {
      id: 99,
      math: {
        cards: 3,
        cardCount: 3,
        baseCards: 3,
        surgeMultiplier: 5,
        collateral: {},
        flatBonus: 13,
        flatItems: [
          { label: 'Piñata', amount: 6, note: 'piñata broken in this Set', sourceRef: 'weapon:pinata' },
          { label: 'Purity chain', amount: 3, note: '3-Set Purity streak' },
          { label: 'Traps cleared', amount: 4, note: 'cleared hazard cards in this Set' },
        ],
        multiplier: 10,
        multItems: [
          { label: 'Shading Surge', amount: 5, note: '4-trait Shading Surge multiplier' },
          { label: 'Rainbow Strike', amount: 2, note: 'all traits different' },
        ],
        rainbow: true,
        extra: 0,
        hit: 160,
        diffTraits: 4,
        graceUsed: false,
        sinceLastMs: 1800,
        combo: 2,
      },
      turnDamage: 160,
      lethal: false,
      isBossOrElite: false,
      foeName: 'Shadow Beast',
    };

    const plan = buildIgnitionPlan(unifiedIgnition);
    const surgeSteps = plan.steps.filter(st => st.label === 'SURGE' || st.value === '×5');
    expect(surgeSteps).toHaveLength(1);
    expect(plan.steps[0].value).toBe('16'); // 3 cards + 6 Piñata + 3 Purity + 4 Traps added FIRST
    expect(plan.total).toBe(160);

    const bd = buildBalatroBreakdown(unifiedIgnition);
    expect(bd.finalBase).toBe(16); // SUM(all additions incl. Piñata, Purity, Traps) — NOT pre-multiplied by 5!
    expect(bd.finalMult).toBe(10); // 5 Surge × 2 Rainbow — NEVER ×25!
    expect(bd.finalTotal).toBe(160);
    expect(bd.receiptLine.match(/×5/g)).toHaveLength(1);
    expect(bd.receiptLine).toContain('+6 Piñata');
    expect(bd.receiptLine).toContain('+3 Purity');
    expect(bd.receiptLine).toContain('+4 Traps');
    expect(bd.receiptLine).toContain('×5 Surge');
    expect(bd.receiptLine).toContain('×2 Rainbow');

    // Primed equation during active Shading Surge also puts Surge ×5 in mult AFTER additions
    const surgeLevel: LevelDef = {
      id: 'surge-primed-test',
      biome: 'canyon',
      name: 'Surge Test',
      introduces: 'shading_surge',
      rules: { attributes: ['shape', 'color', 'number'], boardSize: 12, timer: 120, hearts: 5, shadingSurge: true },
      foes: [{ name: 'Dummy', icon: 'lorc/uncertainty', hp: 500 }],
      challenge: { kind: 'noMistakes' },
      coinMultiplier: 1,
      difficulty: 3,
      rewards: { star1: { coins: 10 }, star2: { coins: 20 }, star3: { coins: 30 } },
    };
    const save = { ...createNewSave(), selectedFighter: 'Corgi' as const, charms: [], upgrades: { heavy_hitter: 2 } };
    let run = createRun(surgeLevel, save, { seed: 12, features: new Set(['hearts', 'gear']) });
    run = tick(run, SURGE_RULES.calmMs, 500);
    expect(run.surge?.active).toBe(true);
    const primed = computePrimedEquation(run);
    expect(primed.base).toBe(5); // 3 cards + 2 Heavy Hitter
    expect(primed.mult).toBe(SURGE_RULES.multiplier); // ×5 Surge
    expect(primed.total).toBe(25);
    expect(primed.items.filter(it => it.label === 'Shading Surge')).toHaveLength(1);
  });

  it('surfaces active enemy weapon counters cleanly on affected GearBelt charms only', () => {
    const flint = getArmoryWeapon('flint-spark')!;
    const blast = getArmoryWeapon('blast-powder')!;
    const ray = getArmoryWeapon('prismatic-ray')!;
    const magnet = getArmoryWeapon('magnet')!;

    // Wet Crab counters fire (-15%)
    const crabLevel: LevelDef = {
      id: 'crab-test',
      biome: 'canyon',
      name: 'Wet Crab Test',
      introduces: 'timer',
      rules: { attributes: A3, boardSize: 12, timer: 90, hearts: 5 },
      foes: [{ enemy: 'Wet Crab', hp: 200 }],
      challenge: { kind: 'noMistakes' },
      coinMultiplier: 1,
      difficulty: 2,
      rewards: { star1: { coins: 10 }, star2: { coins: 20 }, star3: { coins: 30 } },
    };
    const save = { ...createNewSave(), armory: [flint.id, blast.id, ray.id, magnet.id], charms: [flint.id, blast.id, magnet.id] };
    const run = createRun(crabLevel, save, { seed: 5, features: new Set(['hearts', 'gear']) });
    const counters = activeEnemyCounters(run);
    expect(counters.some(c => c.type === 'fire')).toBe(true);
    expect(counterForWeapon(flint, counters)?.type).toBe('fire');
    expect(counterForWeapon(blast, counters)).toBeUndefined();
    expect(counterForWeapon(magnet, counters)).toBeUndefined();

    const BeltHarness: React.FC = () => {
      const anchors = useAnchors();
      return (
        <AnchorsProvider value={anchors}>
          <GearBelt weapons={[flint, blast, magnet]} counters={counters} width={360} onInspect={() => {}} />
        </AnchorsProvider>
      );
    };
    const view = render(<BeltHarness />);
    expect(view.getByTestId('belt-counter-flint-spark')).toBeTruthy();
    expect(view.getByText(`−${counters.find(c => c.type === 'fire')!.reduction}%`)).toBeTruthy();
    expect(view.queryByTestId('belt-counter-blast-powder')).toBeNull();
    expect(view.queryByTestId('belt-counter-magnet')).toBeNull();

    // Polar Guardian counters laser (-40%)
    const polarLevel: LevelDef = { ...crabLevel, id: 'polar-test', foes: [{ enemy: 'Polar Guardian', hp: 200 }] };
    const polarRun = createRun(polarLevel, { ...save, charms: [ray.id, magnet.id] }, { seed: 6, features: new Set(['hearts', 'gear']) });
    const polarCounters = activeEnemyCounters(polarRun);
    expect(counterForWeapon(ray, polarCounters)?.type).toBe('laser');
    expect(counterForWeapon(ray, polarCounters)?.reduction).toBe(40);
    expect(counterForWeapon(magnet, polarCounters)).toBeUndefined();
  });

  it('folds Rally Horn, Catalyst Prism, Clarity Lens, and War Drum directly into BASE before multipliers and previews primed Rally Horn in NEXT', () => {
    setPowerEnabled(false);
    try {
      const dummyLevel = testLevel({ foes: [{ name: 'Dummy', hp: 500 }], rules: { timer: 120, boardSize: 12 } });
      let run = startFight({
        level: dummyLevel,
        save: {
          selectedFighter: 'Pelican',
          armory: ['rally-horn', 'rainbow-charm', 'catalyst-prism'],
          charms: ['rally-horn', 'rainbow-charm', 'catalyst-prism'],
        },
        features: ['hearts', 'gear'],
      });

      // Wave opener: NEXT primed preview includes Rally Horn (+5) right in BASE
      const primedOpen = computePrimedEquation(run);
      expect(primedOpen.base).toBe(8); // 3 cards + 5 Rally Horn
      expect(primedOpen.items).toContainEqual(
        expect.objectContaining({ label: 'Rally Horn', value: '+5', kind: 'base' })
      );

      // Force a Rainbow Set on Set #1 so BOTH Rally Horn (+5) and Catalyst Prism (+5) fold into BASE before Rainbow ×2!
      const rainbowSet = findSet(run, cards => isRainbow(cards, run.attributes));
      expect(rainbowSet).toBeDefined();
      run = playSet(run, rainbowSet!);
      const bd1 = buildBalatroBreakdown(run.lastSetIgnition!);
      expect(bd1.finalBase).toBe(13); // 3 cards + 5 Rally Horn + 5 Catalyst Prism
      expect(bd1.finalMult).toBe(2); // ×2 Rainbow Charm
      expect(bd1.finalBonus).toBe(0); // ZERO post-multiplier bonus pill!
      expect(bd1.finalTotal).toBe(26); // (3 + 5 + 5) × 2
      expect(run.totalDamage).toBe(26);
      expect(run.lastSetIgnition?.followUps).toBeUndefined();
      expect(run.lastSetIgnition?.beltBadges?.['rally-horn']).toEqual({ text: '+5', kind: 'flat' });
      expect(run.lastSetIgnition?.beltBadges?.['catalyst-prism']).toEqual({ text: '+5', kind: 'flat' });
      expect(bd1.receiptLine).toContain('+5 Rally Horn');
      expect(bd1.receiptLine).toContain('+5 Catalyst Prism');
      expect(bd1.receiptLine).toContain('×2 Rainbow');

      // DamageStory credits Rally Horn & Catalyst Prism cleanly with exact total sum
      const story = buildDamageStory(run);
      expect(story.totalDamage).toBe(26);
      expect(story.sources.some(s => s.weaponId === 'rally-horn' && s.totalDamage > 0)).toBe(true);
      expect(story.sources.some(s => s.weaponId === 'catalyst-prism' && s.totalDamage > 0)).toBe(true);

      // Set #2 & #3: Rally Horn is NOT primed in NEXT
      expect(computePrimedEquation(run).items.some(i => i.label === 'Rally Horn')).toBe(false);
      run = playSet(run);
      run = playSet(run);

      // Set #4: Rally Horn (grown from +5 to +6 after Set #1!) IS primed again in NEXT
      const primed4 = computePrimedEquation(run);
      expect(primed4.base).toBe(9); // 3 cards + 6 grown Rally Horn
      expect(primed4.items).toContainEqual(
        expect.objectContaining({ label: 'Rally Horn', value: '+6', kind: 'base' })
      );

      // War Drum (3 fast Sets) on Set #3 and Clarity Lens (every 5th Set) on Set #5 both preview & fold cleanly into BASE
      let rhythmRun = startFight({
        level: dummyLevel,
        save: {
          selectedFighter: 'Pelican',
          armory: ['clarity-lens', 'war-drum'],
          charms: ['clarity-lens', 'war-drum'],
        },
        features: ['hearts', 'gear'],
      });
      rhythmRun = playSet(rhythmRun);
      rhythmRun = playSet(rhythmRun);
      // Before Set #3 (within window), War Drum (3 fast Sets) is primed in NEXT
      const primed3 = computePrimedEquation(rhythmRun);
      expect(primed3.items.some(i => i.label === 'War Drum')).toBe(true);
      rhythmRun = playSet(rhythmRun);
      const bd3 = buildBalatroBreakdown(rhythmRun.lastSetIgnition!);
      expect(bd3.finalBonus).toBe(0);
      expect(bd3.receiptLine).toContain('War Drum');
      expect(bd3.finalTotal).toBe(Math.round(bd3.finalBase * bd3.finalMult));

      // Advance to Set #5: Clarity Lens is pure utility ([GP-11], zero raw damage rider) — it simplifies without adding BASE dmg
      rhythmRun = playSet(rhythmRun);
      const primed5 = computePrimedEquation(rhythmRun);
      expect(primed5.items.some(i => i.label === 'Clarity Lens')).toBe(false);
      rhythmRun = playSet(rhythmRun);
      const bd5 = buildBalatroBreakdown(rhythmRun.lastSetIgnition!);
      expect(bd5.finalBonus).toBe(0);
      expect(bd5.finalTotal).toBe(Math.round(bd5.finalBase * bd5.finalMult));
      expect(rhythmRun.simplified).not.toBeNull();
    } finally {
      setPowerEnabled(true);
    }
  });

  it('keeps nested autoSet (Free Set) separate from primary BASE and never double-counts Hot Streak or Grudge in followUps', () => {
    setPowerEnabled(false);
    try {
      // Nested autoSet triggered on Set #1 must stay in followUps, NOT leak into primary BASE
      const dummyLevel = testLevel({ foes: [{ name: 'Dummy', hp: 500 }], rules: { timer: 120, boardSize: 12 } });
      let s = withWeapons(
        startFight({ level: dummyLevel, save: { selectedFighter: 'Pelican' }, features: ['hearts', 'gear'] }),
        relic([
          { trigger: { on: 'firstSetOfWave' }, effects: [{ do: 'autoSet' }, { do: 'damage', amount: 5 }], callout: 'Rally!' },
          { trigger: { on: 'everyNthSet', n: 2 }, effects: [{ do: 'damage', amount: 7 }], callout: 'Second!' },
        ])
      );
      s = playSet(s);
      const bd = buildBalatroBreakdown(s.lastSetIgnition!);
      // Primary Set #1 gets 3 cards + 5 Rally! = 8 BASE; the Free Set (match #2: 3 cards + 7 Second!) stays in followUps!
      expect(bd.finalBase).toBe(8);
      expect(bd.finalBonus).toBe(10); // 3 Free Set + 7 Second!
      expect(bd.finalTotal).toBe(18);
      expect(s.totalDamage).toBe(18);

      // Sly Fox Hot Streak ×2 must NEVER create a bogus "+2" orange bonus pill
      let fox = startFight({
        level: dummyLevel,
        save: { selectedFighter: 'Sly Fox' },
        features: ['hearts', 'gear'],
      });
      fox = { ...fox, passive: { ...fox.passive, hotStreak: true } };
      fox = playSet(fox);
      const foxBd = buildBalatroBreakdown(fox.lastSetIgnition!);
      expect(foxBd.finalBonus).toBe(0);
      expect(fox.lastSetIgnition?.followUps).toBeUndefined();
      expect(foxBd.finalTotal).toBe(Math.round(foxBd.finalBase * foxBd.finalMult));
    } finally {
      setPowerEnabled(true);
    }
  });
});
