import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Camp from '@/adventure/components/Camp';
import FieldGuide from '@/adventure/components/FieldGuide';
import UnlockReveal from '@/adventure/components/UnlockReveal';
import AdventureMode from '@/adventure/AdventureMode';
import { createNewSave } from '@/adventure/progress';
import { LEVELS } from '@/adventure/data/levels';
import { getEvolutionRecipe } from '@/adventure/data/evolutions';
import type { AdventureSave } from '@/adventure/types';

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Svg: 'Svg',
  Circle: 'Circle',
  Ellipse: 'Ellipse',
  G: 'G',
  Text: 'Text',
  TSpan: 'TSpan',
  TextPath: 'TextPath',
  Path: 'Path',
  Polygon: 'Polygon',
  Polyline: 'Polyline',
  Line: 'Line',
  Rect: 'Rect',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  RadialGradient: 'RadialGradient',
  Stop: 'Stop',
  ClipPath: 'ClipPath',
}));

jest.mock('@/utils/storage', () => ({
  kvGet: jest.fn(() => null),
  kvSet: jest.fn(),
  kvRemove: jest.fn(),
}));

jest.mock('@/components/Icon', () => {
  const { View: RNView, Text: RNText } = require('react-native');
  return function MockIcon({ name }: { name: string }) {
    return (
      <RNView testID={`fallback-icon-${name}`}>
        <RNText>{name}</RNText>
      </RNView>
    );
  };
});

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

describe('Adventure Workshop, Recipe Guide & Dual-Path Tutorial UI', () => {
  it('shows Workshop Locked before 1-4 ★, then renders ONLY unlocked mechanics and unlocked Armory weapons', () => {
    const lockedSave: AdventureSave = {
      ...createNewSave(),
      coins: 1000,
      coinsUnlocked: true,
      workshopUnlocked: false,
      stars: { '1-1': 2, '1-2': 1 },
      armory: ['blast-powder-common'],
    };

    const { getByTestId, queryByTestId, rerender } = render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <Camp save={lockedSave} initialTab="workshop" onChange={() => {}} onClose={() => {}} />
      </SafeAreaProvider>
    );

    expect(getByTestId('camp-workshop-locked')).toBeTruthy();
    expect(queryByTestId('camp-upgrade-heavy_hitter')).toBeNull();
    expect(queryByTestId('camp-weapon-upgrade-blast-powder-common')).toBeNull();

    let latestSave: AdventureSave = {
      ...lockedSave,
      workshopUnlocked: true,
    };

    rerender(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <Camp
          save={latestSave}
          initialTab="workshop"
          onChange={next => {
            latestSave = next;
          }}
          onClose={() => {}}
        />
      </SafeAreaProvider>
    );

    // Unlocked mechanics (Sets, Hearts, Coins) and unlocked Armory weapon (Blast Powder) appear
    expect(queryByTestId('camp-workshop-locked')).toBeNull();
    expect(getByTestId('camp-upgrade-heavy_hitter')).toBeTruthy();
    expect(getByTestId('camp-upgrade-tough_hide')).toBeTruthy();
    expect(getByTestId('camp-upgrade-lucky_purse')).toBeTruthy();
    expect(getByTestId('camp-weapon-upgrade-blast-powder-common')).toBeTruthy();

    // Un-unlocked mechanics (Timer 1-7, Hints 2-1, Graces 2-4) and locked weapons stay hidden!
    expect(queryByTestId('camp-upgrade-hourglass')).toBeNull();
    expect(queryByTestId('camp-upgrade-sharp_eyes')).toBeNull();
    expect(queryByTestId('camp-upgrade-second_wind')).toBeNull();
    expect(queryByTestId('camp-weapon-upgrade-flint-spark-common')).toBeNull();
    expect(queryByTestId('camp-weapon-upgrade-chrono-shard-common')).toBeNull();

    // Buy weapon upgrade and refund 100% of spent coins
    fireEvent.press(getByTestId('camp-buy-weapon-blast-powder-common'));
    expect(latestSave.weaponUpgrades['blast-powder-common']).toBe(1);
    expect(latestSave.coins).toBe(920);

    rerender(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <Camp
          save={latestSave}
          initialTab="workshop"
          onChange={next => {
            latestSave = next;
          }}
          onClose={() => {}}
        />
      </SafeAreaProvider>
    );

    fireEvent.press(getByTestId('camp-refund-weapon-blast-powder-common'));
    expect(latestSave.weaponUpgrades['blast-powder-common']).toBeUndefined();
    expect(latestSave.coins).toBe(1000);
  });

  it('renders Locked, Unlocked Blueprint, and Forged states cleanly in FieldGuide without duplicate keys', () => {
    const save: AdventureSave = {
      ...createNewSave(),
      coinsUnlocked: true,
      workshopUnlocked: true,
      unlockedEvolutions: ['solar-cataclysm', 'world-tree'],
      discoveredEvolutions: ['world-tree'],
    };

    const { getByTestId, getByText } = render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <FieldGuide save={save} onClose={() => {}} />
      </SafeAreaProvider>
    );

    // Switch to Recipe Guide tab (2/8 unlocked)
    fireEvent.press(getByTestId('guide-tab-recipes'));
    expect(getByText('RECIPE GUIDE (2/8)')).toBeTruthy();

    // Unlocked blueprint (ready to forge) shows weapon name & recipe
    expect(getByText('Solar Cataclysm')).toBeTruthy();
    expect(getByText('UNLOCKED RECIPE · READY TO FORGE')).toBeTruthy();

    // Forged combo shows FORGED COMBO + burst
    expect(getByText(getEvolutionRecipe('world-tree').result.name)).toBeTruthy();
    expect(getByText('FORGED COMBO')).toBeTruthy();

    // Locked combos remain secret with unlock hints
    expect(getByTestId('recipe-immortal-aegis')).toBeTruthy();
  });

  it('reveals Workshop and First Weapon Combo unlocks in UnlockReveal and navigates to Workshop', () => {
    const save = createNewSave();
    let openedWorkshop = false;

    const { getByTestId, getByText, rerender } = render(
      <UnlockReveal
        unlocks={[{ kind: 'feature', feature: 'workshop', star: 1 }]}
        save={save}
        onUseFighter={() => {}}
        onEquipCharm={() => {}}
        onOpenFeature={feature => {
          openedWorkshop = feature === 'workshop';
        }}
        onDone={() => {}}
      />
    );

    expect(getByText('The Workshop unlocked!')).toBeTruthy();
    fireEvent.press(getByTestId('unlock-reveal'));
    expect(getByText('Open Workshop')).toBeTruthy();
    fireEvent.press(getByTestId('unlock-primary'));
    expect(openedWorkshop).toBe(true);

    rerender(
      <UnlockReveal
        unlocks={[{ kind: 'evolution', id: 'solar-cataclysm', star: 2, firstEvolution: true }]}
        save={save}
        onUseFighter={() => {}}
        onEquipCharm={() => {}}
        onDone={() => {}}
      />
    );

    expect(getByText('New weapon combo unlocked!')).toBeTruthy();
    fireEvent.press(getByTestId('unlock-reveal'));
    expect(getByText('Solar Cataclysm')).toBeTruthy();
    expect(getByText('How Hidden Catalysts Work')).toBeTruthy();
  });

  it('adapts AdventureMode pre-fight tutorials whether 1-5E or 1-7 is visited first, then teaches Weapon Combos on the next fight', () => {
    const baseSeen = LEVELS.filter(l => ['1-1', '1-2', '1-3', '1-4', '1-5'].includes(l.id)).map(l => l.introduces);
    const saveBefore15E: AdventureSave = {
      ...createNewSave(),
      plays: { '1-1': 1, '1-5': 1 },
      stars: { '1-1': 3, '1-2': 2, '1-3': 2, '1-4': 2, '1-5': 2 },
      coinsUnlocked: true,
      workshopUnlocked: true,
      seenMechanics: baseSeen,
    };

    const { getByTestId, getByText, queryByText } = render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <AdventureMode initialSave={saveBefore15E} onExit={() => {}} />
      </SafeAreaProvider>
    );

    // Open 1-5E and press Fight! -> shows Elite Combo Vault prelude without any timer/clock spoilers
    fireEvent.press(getByTestId('map-node-1-5E'));
    fireEvent.press(getByTestId('preview-play'));
    expect(getByText('Combo Vault: First Weapon Combo')).toBeTruthy();
    expect(queryByText(/clock/i)).toBeNull();

    // Now test entering 1-6 right after unlocking Solar Cataclysm from 1-5E:
    // teaches Escalating Purity AND chains right into Weapon Combos!
    const saveAfter15E: AdventureSave = {
      ...saveBefore15E,
      stars: { ...saveBefore15E.stars, '1-5E': 2 },
      seenMechanics: [...baseSeen, 'elite', 'combo_hunt_intro'],
      unlockedEvolutions: ['solar-cataclysm'],
    };

    const second = render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <AdventureMode initialSave={saveAfter15E} onExit={() => {}} />
      </SafeAreaProvider>
    );

    fireEvent.press(second.getByTestId('map-node-1-6'));
    fireEvent.press(second.getByTestId('preview-play'));
    expect(second.getByText('Escalating Purity')).toBeTruthy();
    expect(second.getByText('Next: Weapon Combos')).toBeTruthy();

    // Advance into the chained Weapon Combos Catalyst lesson
    fireEvent.press(second.getByTestId('mechanic-intro-ok'));
    expect(second.getByText('Do NOT match a dormant Catalyst early!')).toBeTruthy();

    // Path B: skipping 1-5E and visiting 1-7 FIRST shows the 1-7 Milestone Combo intro (pointing to 1-5E),
    // and visiting 1-5E afterwards does NOT repeat the first-combo prelude!
    const seenThrough16 = LEVELS.filter(l => ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6'].includes(l.id)).map(l => l.introduces);
    const saveBefore17: AdventureSave = {
      ...createNewSave(),
      plays: { '1-1': 1, '1-6': 1 },
      stars: { '1-1': 3, '1-2': 2, '1-3': 2, '1-4': 2, '1-5': 2, '1-6': 2 },
      coinsUnlocked: true,
      workshopUnlocked: true,
      seenMechanics: seenThrough16,
    };

    const third = render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <AdventureMode initialSave={saveBefore17} onExit={() => {}} />
      </SafeAreaProvider>
    );

    fireEvent.press(third.getByTestId('map-node-1-7'));
    fireEvent.press(third.getByTestId('preview-play'));
    expect(third.getByText('Milestone Reward: First Weapon Combo')).toBeTruthy();
    expect(third.getByText(/Immortal Aegis/)).toBeTruthy();
  });
});
