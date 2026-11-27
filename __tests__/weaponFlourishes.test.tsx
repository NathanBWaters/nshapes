import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import StageBackdrop, { BIOME_BACKDROP_ASSETS } from '@/adventure/components/StageBackdrop';
import { EvolutionRing } from '@/adventure/components/RunFx';
import PowerMeter from '@/adventure/components/PowerMeter';
import StageBubble from '@/adventure/components/StageBubble';
import TraitChecks from '@/adventure/components/TraitChecks';
import { CARD_MOTION } from '@/components/CardMotion';
import { WeaponAvatar, WEAPON_FLOURISH_CATEGORIES } from '@/components/weapons/WeaponAvatar';
import { getWeaponTapStyle } from '@/components/weapons/WeaponArtwork';
import type { BiomeId } from '@/adventure/types';
import { ALL_ARMORY_WEAPON_IDS, armoryBaseWeapon } from '@/adventure/data/armory';
import { SHAKE, geometricShakeKeyframes } from '@/utils/motion';

jest.mock('@/components/Icon', () => {
  const { Text: RNText } = require('react-native');
  return function MockIcon({ name }: { name: string }) {
    return <RNText>{name}</RNText>;
  };
});

describe('Lane 3: Bespoke 8-Category Weapon Flourishes, Diorama Backdrops & HUD Motion', () => {
  const SAMPLE_BY_STYLE: Record<(typeof WEAPON_FLOURISH_CATEGORIES)[number], string> = {
    explosive: 'blast-powder',
    chrono: 'chrono-shard',
    vitality: 'mending-charm',
    laser: 'prismatic-ray',
    tome: 'scholars-tome',
    coin: 'fortunes-favor',
    connector: 'connector',
    arcane: 'rainbow-charm',
  };

  it('maps every Armory weapon into one of the 8 bespoke flourish archetypes and renders distinct burst motifs', () => {
    expect(WEAPON_FLOURISH_CATEGORIES).toHaveLength(8);
    const seenStyles = new Set<string>();
    for (const id of ALL_ARMORY_WEAPON_IDS) {
      const w = armoryBaseWeapon(id)!;
      const style = getWeaponTapStyle(w.name);
      expect(WEAPON_FLOURISH_CATEGORIES).toContain(style);
      seenStyles.add(style);
    }
    expect(seenStyles.size).toBe(8);

    for (const style of WEAPON_FLOURISH_CATEGORIES) {
      const weapon = armoryBaseWeapon(SAMPLE_BY_STYLE[style]);
      expect(weapon).toBeDefined();
      expect(getWeaponTapStyle(weapon!.name)).toBe(style);

      const view = render(<WeaponAvatar weapon={weapon!} size={64} interactive />);
      expect(view.getByTestId('weapon-tap-burst')).toBeTruthy();
      expect(view.getByTestId(`weapon-burst-${style}`)).toBeTruthy();
      expect(view.getByTestId(`weapon-burst-secondary-${style}`)).toBeTruthy();

      fireEvent.press(view.getByTestId('weapon-avatar-pressable'));
      view.rerender(<WeaponAvatar weapon={weapon!} size={64} interactive triggerKey={2} />);
      expect(view.getByTestId(`weapon-burst-${style}`)).toBeTruthy();
      view.unmount();
    }
  });

  it('renders painted paper-cut StageBackdrop for all 5 biomes with canonical run-stage-backdrop testID', () => {
    const biomes: BiomeId[] = ['meadow', 'woods', 'canyon', 'peaks', 'summit'];
    expect(Object.keys(BIOME_BACKDROP_ASSETS).sort()).toEqual([...biomes].sort());

    for (const biomeId of biomes) {
      const view = render(
        <StageBackdrop
          biomeId={biomeId}
          skyColor="#EEF7E8"
          groundColor="#B9D9A3"
          compact={biomeId === 'summit'}
        />
      );
      expect(view.getByTestId('run-stage-backdrop')).toBeTruthy();
      expect(view.getByTestId(`stage-backdrop-image-${biomeId}`)).toBeTruthy();
      view.unmount();
    }
  });

  it('renders EvolutionRing 60fps GPU dial in both compact and full modes with tabular-nums', () => {
    const compact = render(
      <EvolutionRing
        icon="lorc/crystal-shine"
        name="Inferno Prism"
        remainingMs={12000}
        durationMs={20000}
        active
        effects
        compact
      />
    );
    expect(compact.getByTestId('evolution-ring')).toBeTruthy();
    expect(compact.getByTestId('evolution-ring-dial')).toBeTruthy();
    expect(compact.getByText('12s')).toBeTruthy();
    const compactSecsStyle = StyleSheet.flatten(compact.getByText('12s').props.style);
    expect(compactSecsStyle.fontVariant).toContain('tabular-nums');

    // Low-time urgency <= 5s
    compact.rerender(
      <EvolutionRing
        icon="lorc/crystal-shine"
        name="Inferno Prism"
        remainingMs={4200}
        durationMs={20000}
        active
        effects
        compact
      />
    );
    expect(compact.getByText('5s')).toBeTruthy();
    compact.unmount();

    const full = render(
      <EvolutionRing
        icon="lorc/crystal-shine"
        name="Inferno Prism"
        remainingMs={8000}
        durationMs={20000}
        active
        effects
      />
    );
    expect(full.getByTestId('evolution-ring-dial')).toBeTruthy();
    expect(full.getByText('8')).toBeTruthy();
    full.unmount();
  });

  it('renders staggered TraitChecks cells, StageBubble, and PowerMeter cleanly', () => {
    const traitView = render(
      <TraitChecks
        attributes={['color', 'shape', 'number']}
        checks={[
          { attr: 'color', label: 'Color', status: 'pass', brief: 'All diff', detail: 'All different' },
          { attr: 'shape', label: 'Shape', status: 'pass', brief: 'All same', detail: 'All same' },
          { attr: 'number', label: 'Number', status: 'fail', brief: '2 vs 1', detail: '2 same, 1 diff' },
        ]}
      />
    );
    expect(traitView.getByTestId('run-trait-checks')).toBeTruthy();
    expect(traitView.getByTestId('coach-trait-color')).toBeTruthy();
    expect(traitView.getByTestId('coach-trait-shape')).toBeTruthy();
    expect(traitView.getByTestId('coach-trait-number')).toBeTruthy();
    traitView.unmount();

    const bubble = render(
      <StageBubble text="Ready to rumble!" kind="foe" tail="down-right" enterDelayMs={180} testID="test-bubble" />
    );
    expect(bubble.getByTestId('test-bubble')).toBeTruthy();
    bubble.rerender(<StageBubble text="Pick 3 matching cards." kind="lesson" tail="down" testID="test-bubble" />);
    expect(bubble.getByText('Pick 3 matching cards.')).toBeTruthy();
    bubble.unmount();

    const power = render(<PowerMeter points={1.5} />);
    expect(power.getByTestId('run-power')).toBeTruthy();
    act(() => {
      power.rerender(<PowerMeter points={3.0} />);
    });
    expect(power.getByTestId('run-power')).toBeTruthy();
    power.unmount();
  });

  it('derives CardMotion wrong-pick shake deterministically from geometricShakeKeyframes', () => {
    expect(CARD_MOTION.missShakePx).toEqual(geometricShakeKeyframes(12, 3, SHAKE.decay, -1));
    expect(CARD_MOTION.hopCrouchMs).toBe(32);
  });
});
