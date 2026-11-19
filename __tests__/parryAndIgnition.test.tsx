/**
 * Comprehensive verification for Pillar 1 (Set-Parrying: default timing + specific
 * counters + Perfect Parry Stagger + Pre-Battle UI) and Pillar 2 (Live Multiplier
 * Ignition math & heat tiers + Lethal Kill-Cam snapshot).
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import type { Card } from '@/types';
import { getLevel } from '@/adventure/data/levels';
import { PARRY_RULES, parryCounterMeta, resolveParrySpec } from '@/adventure/data/parry';
import { boardHasCounterSet, setMatchesCounter } from '@/adventure/engine/parry';
import { createRun, runReducer } from '@/adventure/engine/run';
import { createMaxedSave } from '@/adventure/progress';
import { buildIgnitionPlan, heatTierFor } from '@/adventure/fx/MultiplierIgnition';
import ParryPreviewCard from '@/adventure/components/ParryPreviewCard';
import LevelPreview from '@/adventure/components/LevelPreview';
import type { LevelDef, ParryRequirement, ParrySpec } from '@/adventure/types';
import { eventsOf, findSet, plainRewards, tick } from './testUtils/adventureFight';

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
    let s = createRun(level, baseSave(), {
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
    const bossLevel = getLevel('1-10'); // Iron Shell → Counter: 2 TRAITS SAME
    const spec = resolveParrySpec(bossLevel, bossLevel.foes[0]);
    expect(spec?.counter).toEqual({ kind: 'exact_same', count: 2 });

    const { getByTestId, getByText } = render(
      <LevelPreview
        level={bossLevel}
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
    expect(getByText(/COUNTER: ANY SET/)).toBeTruthy();
  });
});
