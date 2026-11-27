/**
 * Comprehensive UI tests for `WeaponExplainer.tsx` — the SOLE weapon description
 * card across NShapes (Camp Armory, LevelPreview, In-Fight Inspect, FightReplay,
 * BattleHistory, BattleDamageStory, and Starfall Summit).
 *
 * Covers:
 * - 1-of-3 Per-Weapon Timed Evolution radio selection (`evolutionMode="select"`)
 * - 1-tap `onSelectEvolution` + audio motif audition (`band.auditionEvolution`)
 * - Locked evolution Bounty deep-link (`onJumpToBounty`)
 * - 1–3 Synergy Graph tag chips + teal belt-match glow (`beltSynergyIds`)
 * - Workshop Evolution Lab `+2s/tier` duration reflection
 * - Read-only in-fight live tracker (`evolutionMode="live"` across charging / almost / active / cooldown)
 * - Zero legacy Power / Catalyst / pair-recipe strings across all modes
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { bountyForEvolution } from '@/adventure/data/bounties';
import { evolutionsForWeapon } from '@/adventure/data/evolutions';
import { weaponSynergyAttrs } from '@/adventure/data/synergy';
import { buildEvolutionLiveState } from '@/adventure/ui/evolutionViewModel';
import type { WeaponEvolutionRuntime } from '@/adventure/types';
import { COLORS } from '@/utils/colors';

const mockSfx = jest.fn();
const mockAudition = jest.fn();
const mockAuditionEvolution = jest.fn();

jest.mock('@/audio', () => ({
  sfx: (...args: unknown[]) => mockSfx(...args),
  band: {
    inFight: false,
    audition: (...args: unknown[]) => mockAudition(...args),
    auditionEvolution: (...args: unknown[]) => mockAuditionEvolution(...args),
  },
  music: { play: jest.fn(), stop: jest.fn() },
  setMusicEnabled: jest.fn(),
  setSfxOverride: jest.fn(),
}));

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return function MockIcon({ name }: { name: string }) {
    return ReactActual.createElement(View, { accessibilityLabel: `icon-${name}` });
  };
});

jest.mock('@/components/weapons', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    WeaponAvatar: ({ weapon }: { weapon: { id: string; name: string } }) =>
      ReactActual.createElement(View, { testID: `weapon-avatar-${weapon.id}`, accessibilityLabel: weapon.name }),
  };
});

jest.mock('@/adventure/components/WeaponDemoClip', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return function MockWeaponDemoClip({ weaponId }: { weaponId: string }) {
    return ReactActual.createElement(View, { testID: `mock-demo-${weaponId}` });
  };
});

function collectAllText(node: unknown, out: string[] = []): string[] {
  if (node == null) return out;
  if (typeof node === 'string' || typeof node === 'number') {
    const s = String(node).trim();
    if (s) out.push(s);
    return out;
  }
  if (Array.isArray(node)) {
    for (const c of node) collectAllText(c, out);
    return out;
  }
  if (typeof node === 'object') {
    const obj = node as { children?: unknown[] };
    if (obj.children) collectAllText(obj.children, out);
  }
  return out;
}

describe('WeaponExplainer — 1-of-3 Evolutions, Synergy Tags & Live Tracker', () => {
  beforeEach(() => {
    mockSfx.mockClear();
    mockAudition.mockClear();
    mockAuditionEvolution.mockClear();
  });

  it('renders 1-of-3 radio selection, equips unlocked evos in 1 tap with motif audition, and deep-links locked evos to their Bounty', () => {
    const weapon = getArmoryWeapon('flint-spark')!;
    const [evoA, evoB, evoC] = evolutionsForWeapon('flint-spark');
    expect(evoA).toBeDefined();
    expect(evoB).toBeDefined();
    expect(evoC).toBeDefined();

    const bountyForC = bountyForEvolution(evoC.id);
    expect(bountyForC).toBeDefined();

    const onSelectEvolution = jest.fn();
    const onJumpToBounty = jest.fn();

    const view = render(
      <WeaponExplainer
        weapon={weapon}
        evolutionMode="select"
        showEvolutionsWhenClosed
        equippedEvolutionId={evoA.id}
        unlockedEvolutionIds={[evoA.id, evoB.id]}
        onSelectEvolution={onSelectEvolution}
        onJumpToBounty={onJumpToBounty}
      />
    );

    expect(view.getByTestId('weapon-explainer-evo-selector-flint-spark')).toBeTruthy();
    expect(view.getByText('EVOLUTION (1 OF 3)')).toBeTruthy();
    expect(view.getByText('2/3')).toBeTruthy();

    // Evo A is equipped (ACTIVE badge + checked radio state), Evo B is unlocked (EQUIP), Evo C is locked
    expect(view.getByTestId(`evo-active-${evoA.id}`)).toBeTruthy();
    expect(view.getByTestId(`evo-option-${evoA.id}`).props.accessibilityState?.checked).toBe(true);
    expect(view.getByTestId(`evo-option-${evoB.id}`).props.accessibilityState?.checked).toBe(false);
    expect(view.queryByTestId(`evo-active-${evoB.id}`)).toBeNull();
    expect(view.getByText('LOCKED')).toBeTruthy();

    // 1-tap equip on Evo B triggers callback + motif audition
    fireEvent.press(view.getByTestId(`evo-option-${evoB.id}`));
    expect(onSelectEvolution).toHaveBeenCalledTimes(1);
    expect(onSelectEvolution).toHaveBeenCalledWith('flint-spark', evoB.id);
    expect(mockAuditionEvolution).toHaveBeenCalledWith(evoB.id);

    // Locked Evo C shows Bounty deep-link pill and invokes onJumpToBounty with its exact bounty ID
    const jumpPill = view.getByTestId(`evo-bounty-jump-${evoC.id}`);
    expect(jumpPill).toBeTruthy();
    fireEvent.press(jumpPill);
    expect(onJumpToBounty).toHaveBeenCalledTimes(1);
    expect(onJumpToBounty).toHaveBeenCalledWith(bountyForC!.id);

    // Zero legacy Power / Catalyst copy anywhere
    const copy = collectAllText(view.toJSON()).join(' ');
    expect(copy).not.toMatch(/\bCatalyst\b/i);
    expect(copy).not.toMatch(/Power scaling|Weapon Power/i);
  });

  it('highlights matching Synergy Graph chips in teal when linked to belt and reflects Evolution Lab +2s/tier', () => {
    const weapon = getArmoryWeapon('flint-spark')!;
    const attrs = weaponSynergyAttrs('flint-spark');
    expect(attrs.length).toBeGreaterThanOrEqual(1);
    const matchedAttr = attrs[0];
    const [evoA] = evolutionsForWeapon('flint-spark');

    const view = render(
      <WeaponExplainer
        weapon={weapon}
        defaultOpen
        evolutionMode="select"
        allEvolutionsUnlocked
        equippedEvolutionId={evoA.id}
        beltSynergyIds={new Set([matchedAttr])}
        evolutionLabTier={2}
        onSelectEvolution={() => {}}
      />
    );

    const matchedChip = view.getByTestId(`weapon-synergy-chip-flint-spark-${matchedAttr}`);
    expect(StyleSheet.flatten(matchedChip.props.style).borderColor).toBe(COLORS.logicTeal);
    expect(matchedChip.props.accessibilityLabel).toMatch(/matches your belt/);

    for (const otherAttr of attrs.slice(1)) {
      const otherChip = view.getByTestId(`weapon-synergy-chip-flint-spark-${otherAttr}`);
      expect(otherChip.props.accessibilityLabel).not.toMatch(/matches your belt/);
    }

    // Expanded Synergy Scaling section renders hooks
    expect(view.getByTestId('weapon-explainer-scaling-flint-spark')).toBeTruthy();
    expect(view.getByText('SYNERGY SCALING')).toBeTruthy();

    // Evolution Lab tier 2 adds +4s to duration display
    const expectedSec = Math.round((evoA.durationMs + 4000) / 1000);
    expect(view.getAllByText(`${expectedSec}s`).length).toBeGreaterThanOrEqual(1);
  });

  it('renders read-only live evolution progress, almost-ready, active countdown, and cooldown states in evolutionMode="live"', () => {
    const weapon = getArmoryWeapon('flint-spark')!;
    const [evoA] = evolutionsForWeapon('flint-spark');
    const makeEvoState = (overrides: Partial<WeaponEvolutionRuntime>): WeaponEvolutionRuntime => ({
      weaponId: 'flint-spark',
      evoId: evoA.id,
      phase: 'charging',
      progress: 1,
      target: 3,
      almostReady: false,
      activeRemainingMs: 0,
      durationMs: evoA.durationMs,
      cooldownRemainingMs: 0,
      triggersCount: 0,
      ...overrides,
    });

    // 1. Charging (1/3)
    const chargingVM = buildEvolutionLiveState(makeEvoState({ phase: 'charging', progress: 1, target: 3, almostReady: false }))!;
    const view = render(
      <WeaponExplainer weapon={weapon} evolutionMode="live" liveEvolution={chargingVM} />
    );
    expect(view.getByTestId('weapon-explainer-live-evo-flint-spark')).toBeTruthy();
    expect(view.queryByTestId('weapon-explainer-evo-selector-flint-spark')).toBeNull();
    expect(view.getByText('1/3')).toBeTruthy();

    // 2. Almost ready (2/3)
    const almostVM = buildEvolutionLiveState(makeEvoState({ phase: 'charging', progress: 2, target: 3, almostReady: true }))!;
    view.rerender(<WeaponExplainer weapon={weapon} evolutionMode="live" liveEvolution={almostVM} />);
    expect(view.getByText('ALMOST! 2/3')).toBeTruthy();

    // 3. Active countdown (14s left, 1st trigger)
    const activeVM = buildEvolutionLiveState(
      makeEvoState({ phase: 'active', progress: 3, target: 3, activeRemainingMs: 13_400, triggersCount: 1 })
    )!;
    view.rerender(<WeaponExplainer weapon={weapon} evolutionMode="live" liveEvolution={activeVM} />);
    expect(view.getByText('ACTIVE · 14s')).toBeTruthy();

    // 4. Cooldown (3s)
    const coolingVM = buildEvolutionLiveState(
      makeEvoState({ phase: 'cooldown', progress: 0, target: 3, cooldownRemainingMs: 2_600, triggersCount: 1 })
    )!;
    view.rerender(<WeaponExplainer weapon={weapon} evolutionMode="live" liveEvolution={coolingVM} />);
    expect(view.getByText('COOLING · 3s')).toBeTruthy();

    const copy = collectAllText(view.toJSON()).join(' ');
    expect(copy).not.toMatch(/\bCatalyst\b/i);
    expect(copy).not.toMatch(/Power scaling|Weapon Power/i);
  });

  it('hides the evolution section completely when evolutionMode="none"', () => {
    const weapon = getArmoryWeapon('blast-powder')!;
    const view = render(<WeaponExplainer weapon={weapon} evolutionMode="none" defaultOpen />);
    expect(view.queryByTestId('weapon-explainer-evo-summary-blast-powder')).toBeNull();
    expect(view.queryByTestId('weapon-explainer-evo-selector-blast-powder')).toBeNull();
    expect(view.queryByTestId('weapon-explainer-evo-preview-blast-powder')).toBeNull();
    expect(view.queryByTestId('weapon-explainer-live-evo-blast-powder')).toBeNull();
  });
});
