/**
 * Verification suite for the redesigned in-fight Per-Weapon Evolution HUD:
 * - All 5 `GearBelt` evolution states (`idle`, `progressing` pips & scaleX bar,
 *   `almostReady` opacity-only anticipation, `active` golden frame + countdown
 *   + `<= 5s` urgent state, `cooldown` 3s drain)
 * - Responsive 3–6 slot sizing on `375px` mobile portrait + >=44px touch targets
 * - Single-weapon `EvolutionCutIn` (WeaponAvatar slam, 56px Medallion, trigger
 *   & active chips, 220ms tap guard, multi-awakening queue)
 * - Multi-entry `EvolutionBanner` coalescing (`<Evo 1> + <Evo 2> ACTIVE!`,
 *   `N EVOLUTIONS ACTIVE!`, `pointerEvents="none"`)
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { evolutionConditionShort, evolutionsForWeapon } from '@/adventure/data/evolutions';
import { AnchorsProvider, useAnchors } from '@/adventure/fx/anchors';
import { EVOLUTION_CUTIN_GUARD_MS, EvolutionCutIn } from '@/adventure/fx/EvolutionCutIn';
import { GearBelt, type EvolutionLiveStateVM } from '@/adventure/fx/GearBelt';
import { EvolutionBanner, EVOLUTION_BANNER_TIMING } from '@/adventure/components/RunFx';
import type { Weapon } from '@/types';
import { COLORS } from '@/utils/colors';

jest.mock('@/audio', () => {
  const playCutInEvolve = jest.fn();
  const band = new Proxy(
    { inFight: false, playCutInEvolve },
    {
      get(target, key) {
        if (key in target) return (target as Record<string | symbol, unknown>)[key];
        return () => undefined;
      },
    }
  );
  return { sfx: () => undefined, music: band, band, setMusicEnabled: () => undefined, setSfxOverride: () => undefined };
});

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { Text: RNText } = require('react-native');
  return function MockIcon({ name }: { name: string }) {
    return ReactActual.createElement(RNText, { testID: `icon-${name}` }, name);
  };
});

jest.mock('@/components/weapons', () => {
  const ReactActual = require('react');
  const { Text: RNText } = require('react-native');
  return {
    WeaponAvatar: ({ weapon, size }: { weapon: { name: string }; size?: number }) =>
      ReactActual.createElement(RNText, { testID: `weapon-avatar-${weapon.name}`, avatarSize: size }, weapon.name),
  };
});

const SIX_WEAPON_IDS = [
  'blast-powder',
  'flint-spark',
  'mending-charm',
  'rainbow-charm',
  'rally-horn',
  'magnet',
] as const;

const getWeapon = (id: string): Weapon => {
  const w = getArmoryWeapon(id);
  if (!w) throw new Error(`Missing weapon ${id}`);
  return w;
};

const mkEvoVM = (weaponId: string, overrides: Partial<EvolutionLiveStateVM> = {}): EvolutionLiveStateVM => {
  const def = evolutionsForWeapon(weaponId)[0];
  if (!def) throw new Error(`Missing evolutions for ${weaponId}`);
  return {
    weaponId,
    evolutionId: def.id,
    evolutionName: def.name,
    icon: def.icon,
    accent: def.accent,
    phase: 'charging',
    conditionShort: evolutionConditionShort(def, false),
    conditionFull: evolutionConditionShort(def, false),
    effectText: def.tagline,
    progress: 0,
    target: 3,
    almostReady: false,
    activeRemainingMs: 0,
    activeDurationMs: def.durationMs,
    cooldownRemainingMs: 0,
    triggersThisFight: 0,
    ...overrides,
  };
};

const BeltHarness: React.FC<React.ComponentProps<typeof GearBelt>> = props => {
  const anchors = useAnchors();
  return (
    <AnchorsProvider value={anchors}>
      <GearBelt {...props} />
    </AnchorsProvider>
  );
};

describe('GearBelt 5-state per-weapon Evolution HUD', () => {
  it('renders all 5 evolution states cleanly across equipped belt slots', () => {
    const weapons = SIX_WEAPON_IDS.slice(0, 5).map(getWeapon);
    const evolutions: EvolutionLiveStateVM[] = [
      // State 1: Idle (charging, 0 progress, not almostReady)
      mkEvoVM('blast-powder', { phase: 'charging', progress: 0, target: 3, almostReady: false }),
      // State 2: Progressing (segmented pips target <= 5)
      mkEvoVM('flint-spark', { phase: 'charging', progress: 2, target: 4, almostReady: false }),
      // State 3: Almost-Ready anticipation (warm amber + opacity-only rim + 1! pill)
      mkEvoVM('mending-charm', { phase: 'charging', progress: 2, target: 3, almostReady: true }),
      // State 4: Evolved Active (> 5s normal gold frame + medallion + tabular-nums timer)
      mkEvoVM('rainbow-charm', {
        phase: 'active',
        progress: 3,
        target: 3,
        almostReady: false,
        activeRemainingMs: 14_200,
        activeDurationMs: 18_000,
      }),
      // State 5: Post-Expiry Cooldown (3s silver drain + hourglass pill)
      mkEvoVM('rally-horn', {
        phase: 'cooldown',
        progress: 0,
        target: 3,
        almostReady: false,
        cooldownRemainingMs: 2_400,
      }),
    ];

    const view = render(
      <BeltHarness
        weapons={weapons}
        evolutions={evolutions}
        active
        effects
        width={375}
        onInspect={jest.fn()}
      />
    );

    // State 1: Idle
    expect(view.getByTestId('belt-evo-idle-blast-powder')).toBeTruthy();
    expect(view.getByTestId('belt-evo-rail-blast-powder')).toBeTruthy();
    expect(view.queryByTestId('belt-evo-progress-blast-powder')).toBeNull();
    expect(view.queryByTestId('belt-evo-almost-blast-powder')).toBeNull();
    expect(view.queryByTestId('belt-evo-timer-blast-powder')).toBeNull();

    // State 2: Progressing (2/4)
    expect(view.getByTestId('belt-evo-progress-flint-spark')).toHaveTextContent('2/4');
    expect(view.queryByTestId('belt-evo-idle-flint-spark')).toBeNull();

    // State 3: Almost-Ready anticipation
    const almostSlotStyle = StyleSheet.flatten(view.getByTestId('belt-mending-charm').props.style);
    expect(almostSlotStyle.backgroundColor).toBe('#FEF3C7');
    expect(view.getByTestId('belt-evo-anticipation-mending-charm')).toBeTruthy();
    expect(view.getByTestId('belt-evo-almost-mending-charm')).toHaveTextContent('1!');

    // State 4: Evolved Active (15s)
    const activeSlotStyle = StyleSheet.flatten(view.getByTestId('belt-rainbow-charm').props.style);
    expect(activeSlotStyle.backgroundColor).toBe(COLORS.actionYellow);
    expect(view.getByTestId('belt-evo-active-rainbow-charm')).toBeTruthy();
    expect(view.getByTestId('belt-evo-timer-rainbow-charm')).toHaveTextContent('15s');
    expect(view.queryByTestId('belt-evo-urgent-rainbow-charm')).toBeNull();

    // State 5: Post-Expiry Cooldown (3s)
    const cdSlotStyle = StyleSheet.flatten(view.getByTestId('belt-rally-horn').props.style);
    expect(cdSlotStyle.backgroundColor).toBe('#E5E7EB');
    expect(view.getByTestId('belt-evo-cooldown-rally-horn')).toHaveTextContent(/3s/);
  });

  it('renders continuous scaleX progress bar for target > 5 and urgent red pulse when active <= 5s', () => {
    const w1 = getWeapon('blast-powder');
    const w2 = getWeapon('flint-spark');
    const view = render(
      <BeltHarness
        weapons={[w1, w2]}
        evolutions={[
          mkEvoVM('blast-powder', { phase: 'charging', progress: 4, target: 8, almostReady: false }),
          mkEvoVM('flint-spark', {
            phase: 'active',
            activeRemainingMs: 3_600,
            activeDurationMs: 18_000,
          }),
        ]}
        active
        effects
        width={375}
        onInspect={jest.fn()}
      />
    );

    // target > 5 uses smooth scaleX bar & shows 4/8 pill
    expect(view.getByTestId('belt-evo-progress-blast-powder')).toHaveTextContent('4/8');
    expect(view.getByTestId('belt-evo-rail-blast-powder')).toBeTruthy();

    // active <= 5s switches pill to impactRed + mounts opacity-only urgent rim
    const urgentPill = view.getByTestId('belt-evo-timer-flint-spark');
    expect(urgentPill).toHaveTextContent('4s');
    expect(StyleSheet.flatten(urgentPill.props.style).backgroundColor).toBe(COLORS.impactRed);
    expect(view.getByTestId('belt-evo-urgent-flint-spark')).toBeTruthy();
  });

  it('scales 3–6 belt slots responsively on 375px portrait (46/42/38/34px) while keeping >=44px touch targets and 0 bottom bleed', () => {
    const expectedBoxes: Record<number, number> = { 3: 46, 4: 42, 5: 38, 6: 34 };
    for (const count of [3, 4, 5, 6] as const) {
      const weapons = SIX_WEAPON_IDS.slice(0, count).map(getWeapon);
      const view = render(
        <BeltHarness
          weapons={weapons}
          evolutions={weapons.map(w => mkEvoVM(w.id))}
          width={375}
          noBottomBleed
          onInspect={jest.fn()}
        />
      );
      const slot = view.getByTestId(`belt-${weapons[0].id}`);
      const flat = StyleSheet.flatten(slot.props.style);
      expect(flat.width).toBe(expectedBoxes[count]);
      expect(flat.height).toBe(expectedBoxes[count]);
      const slop = slot.props.hitSlop;
      expect(flat.width + slop.left + slop.right).toBeGreaterThanOrEqual(44);
      expect(flat.height + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
      expect(slop.bottom).toBe(0);
      view.unmount();
    }
  });
});

describe('Single-Weapon EvolutionCutIn & Multi-Entry EvolutionBanner', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renders single-weapon awakening with WeaponAvatar, 56px Medallion, chassis chips, 220ms guard, and 2-evo queue', () => {
    const w1 = getWeapon('blast-powder');
    const w2 = getWeapon('flint-spark');
    const evo1 = evolutionsForWeapon(w1.id)[0];
    const evo2 = evolutionsForWeapon(w2.id)[0];
    const onDone = jest.fn();

    const view = render(
      <EvolutionCutIn
        evolutions={[
          { evolution: evo1, weapon: w1, durationSec: 18 },
          { evolution: evo2, weapon: w2, durationSec: 20 },
        ]}
        weapons={[w1, w2]}
        size={{ w: 375, h: 700 }}
        onDone={onDone}
      />
    );

    // Beat 1 & 2 content for first awakening
    expect(view.getByText('EVOLUTION AWAKENED!')).toBeTruthy();
    expect(view.getByText(evo1.name)).toBeTruthy();
    expect(view.getByText(evo1.tagline)).toBeTruthy();
    expect(view.getByText('18s ACTIVE')).toBeTruthy();
    expect(view.getByText('+8 BASE')).toBeTruthy();
    expect(view.getByText('+0.2× MULT')).toBeTruthy();
    expect(view.getByTestId('evolution-cutin-weapon')).toBeTruthy();
    expect(view.getByTestId('evolution-cutin-medallion')).toBeTruthy();
    expect(view.getByTestId('evolution-cutin-queue')).toHaveTextContent('1/2');

    // Immediate tap inside 220ms guard is ignored
    fireEvent.press(view.getByTestId('evolution-cutin'));
    expect(onDone).not.toHaveBeenCalled();
    expect(view.getByTestId('evolution-cutin-queue')).toHaveTextContent('1/2');

    // Tap after 220ms guard advances queue from 1/2 -> 2/2 (does not close yet)
    act(() => {
      jest.advanceTimersByTime(EVOLUTION_CUTIN_GUARD_MS + 30);
    });
    fireEvent.press(view.getByTestId('evolution-cutin'));
    expect(onDone).not.toHaveBeenCalled();
    expect(view.getByTestId('evolution-cutin-queue')).toHaveTextContent('2/2');
    expect(view.getByText(evo2.name)).toBeTruthy();
    expect(view.getByText('20s ACTIVE')).toBeTruthy();

    // Second tap after guard closes cleanly
    act(() => {
      jest.advanceTimersByTime(EVOLUTION_CUTIN_GUARD_MS + 30);
    });
    fireEvent.press(view.getByTestId('evolution-cutin'));
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('coalesces simultaneous triggers in non-blocking EvolutionBanner (`<Evo 1> + <Evo 2> ACTIVE!` and `3 EVOLUTIONS ACTIVE!`)', () => {
    expect(EVOLUTION_BANNER_TIMING.exitMs).toBeLessThan(EVOLUTION_BANNER_TIMING.enterMs);
    const w1 = getWeapon('blast-powder');
    const evo1 = evolutionsForWeapon('blast-powder')[0];
    const evo2 = evolutionsForWeapon('flint-spark')[0];
    const evo3 = evolutionsForWeapon('mending-charm')[0];

    // Single awakening shows weapon avatar & evolution name
    const single = render(
      <EvolutionBanner
        entries={[{ id: evo1.id, name: evo1.name, icon: evo1.icon, text: evo1.tagline, seconds: 18, weapon: w1 }]}
        seq={1}
      />
    );
    expect(single.getByTestId('evolution-banner').props.pointerEvents).toBe('none');
    expect(single.getByText(`${evo1.name}!`)).toBeTruthy();
    single.unmount();

    // 2 simultaneous awakenings coalesce into `<Evo 1> + <Evo 2> ACTIVE!`
    const pair = render(
      <EvolutionBanner
        entries={[
          { id: evo1.id, name: evo1.name, icon: evo1.icon, text: evo1.tagline, seconds: 18 },
          { id: evo2.id, name: evo2.name, icon: evo2.icon, text: evo2.tagline, seconds: 20 },
        ]}
        seq={2}
      />
    );
    expect(pair.getByText(`${evo1.name} + ${evo2.name} ACTIVE!`)).toBeTruthy();
    pair.unmount();

    // 3+ simultaneous awakenings coalesce into `3 EVOLUTIONS ACTIVE!`
    const trio = render(
      <EvolutionBanner
        entries={[
          { id: evo1.id, name: evo1.name, icon: evo1.icon, text: evo1.tagline, seconds: 18 },
          { id: evo2.id, name: evo2.name, icon: evo2.icon, text: evo2.tagline, seconds: 20 },
          { id: evo3.id, name: evo3.name, icon: evo3.icon, text: evo3.tagline, seconds: 16 },
        ]}
        seq={3}
      />
    );
    expect(trio.getByText('3 EVOLUTIONS ACTIVE!')).toBeTruthy();
    trio.unmount();
  });
});
