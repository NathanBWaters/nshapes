/**
 * 200-Bounty Progression Web UI (`BountyBoard.tsx`) & Per-Weapon Evolution /
 * Boss Belt-Slot Reveal (`UnlockReveal.tsx`) comprehensive test suite.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BountyBoard from '@/adventure/components/BountyBoard';
import UnlockReveal from '@/adventure/components/UnlockReveal';
import { BOUNTIES, getWeaponBounties, isBountyWeaponOwned } from '@/adventure/data/bounties';
import { evolutionsForWeapon } from '@/adventure/data/evolutions';
import { createNewSave } from '@/adventure/progress';
import type { AdventureSave } from '@/adventure/types';
import { band } from '@/audio';

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
  Pattern: 'Pattern',
}));

jest.mock('@/utils/storage', () => ({
  storage: { getString: jest.fn(() => undefined), set: jest.fn() },
  ColorblindStorage: { get: () => false, set: jest.fn(), subscribe: () => () => {} },
}));

jest.mock('@/audio', () => {
  const b = {
    inFight: false,
    gridMs: 62.5,
    audition: jest.fn(),
    auditionEvolution: jest.fn(),
    cue: jest.fn(),
    play: jest.fn(),
    playScreenMusic: jest.fn(),
  };
  return { band: b, music: b, sfx: jest.fn(), sound: { play: jest.fn() } };
});

jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('@/hooks/useAppActive', () => ({ useAppActive: () => true }));
jest.mock('@/hooks/useKeyboardNav', () => ({
  KEY_PRIORITY: { OVERLAY: 100 },
  useKeyboardNav: () => undefined,
}));

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View: RNView, Text: RNText } = require('react-native');
  return function MockIcon({ name }: { name: string }) {
    return ReactActual.createElement(
      RNView,
      { testID: `icon-${name}` },
      ReactActual.createElement(RNText, null, name)
    );
  };
});

jest.mock('@/components/fighters', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    FighterAvatar: ({ testID, character }: { testID?: string; character: string }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `fighter-avatar-${character}` }),
  };
});

jest.mock('@/components/enemies', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    EnemyAvatar: ({ testID, enemy }: { testID?: string; enemy: { name: string } }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `enemy-avatar-${enemy.name}` }),
  };
});

jest.mock('@/components/weapons', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    WeaponAvatar: ({ testID, weapon }: { testID?: string; weapon: { id: string } }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `weapon-avatar-${weapon.id}` }),
  };
});

const wrap = (node: React.ReactElement) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    }}
  >
    {node}
  </SafeAreaProvider>
);

const noop = () => {};

const BLAST_B1 = getWeaponBounties('blast-powder')[0];
const BLAST_B2 = getWeaponBounties('blast-powder')[1];
const TIME_B1 = getWeaponBounties('time-drop')[0];

const makeRichSave = (over: Partial<AdventureSave> = {}): AdventureSave => {
  const base = createNewSave();
  return {
    ...base,
    bountiesUnlocked: true,
    armory: ['blast-powder', 'flint-spark', 'mending-charm', 'time-drop'],
    charms: ['blast-powder', 'flint-spark'],
    completedBounties: [BLAST_B1.id],
    bountyProgress: {
      [BLAST_B2.id]: Math.max(1, Math.floor(BLAST_B2.target * 0.7)),
      ...base.bountyProgress,
    },
    ...over,
  };
};

describe('BountyBoard (200 Weapon-Linked Progression Web UI)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all 6 filter tabs with exact counts, total progress out of 200, and pinned Hero Rail on Open', () => {
    expect(BOUNTIES).toHaveLength(200);
    const save = makeRichSave();
    const openCount = BOUNTIES.filter(
      b => !save.completedBounties.includes(b.id) && isBountyWeaponOwned(save, b)
    ).length;
    const equippedCount = BOUNTIES.filter(
      b =>
        !save.completedBounties.includes(b.id) &&
        isBountyWeaponOwned(save, b) &&
        Boolean(b.requiresWeapon && save.charms.includes(b.requiresWeapon))
    ).length;

    const view = render(wrap(<BountyBoard save={save} onClose={noop} />));

    expect(view.getByTestId('bounty-total-count')).toHaveTextContent(`1/${BOUNTIES.length}`);
    expect(view.getByTestId('bounty-search')).toBeTruthy();
    expect(view.getByTestId('bounty-filter-open')).toHaveTextContent(`OPEN (${openCount})`);
    expect(view.getByTestId('bounty-filter-equipped')).toHaveTextContent(`EQUIPPED (${equippedCount})`);
    expect(view.getByTestId('bounty-filter-weapons')).toBeTruthy();
    expect(view.getByTestId('bounty-filter-evos')).toBeTruthy();
    expect(view.getByTestId('bounty-filter-by_weapon')).toHaveTextContent(`BY WEAPON (${save.armory.length})`);
    expect(view.getByTestId('bounty-filter-done')).toHaveTextContent('DONE (1)');

    // Pinned "Try Next & Almost Done" Hero Rail mounts on Open when search is empty
    expect(view.getByTestId('bounty-hero-rail')).toBeTruthy();
    expect(view.getByText('TRY NEXT & ALMOST DONE')).toBeTruthy();

    view.unmount();
  });

  it('filters across search queries and switches cleanly across all 6 tabs (incl. By Weapon accordion & Done)', () => {
    const save = makeRichSave();
    const flintBounties = getWeaponBounties('flint-spark');
    const doneBounty = BLAST_B1;
    const weaponRewardBounty = BOUNTIES.find(
      b => isBountyWeaponOwned(save, b) && !save.completedBounties.includes(b.id) && Boolean(b.rewardWeaponId)
    );
    const evoRewardBounty = BOUNTIES.find(
      b => isBountyWeaponOwned(save, b) && !save.completedBounties.includes(b.id) && Boolean(b.rewardEvolutionId)
    )!;

    const view = render(wrap(<BountyBoard save={save} onClose={noop} />));

    // Search filters by bounty / weapon name and hides hero rail while searching
    fireEvent.changeText(view.getByTestId('bounty-search'), flintBounties[0].name);
    expect(view.queryByTestId('bounty-hero-rail')).toBeNull();
    expect(view.getByTestId(`bounty-card-${flintBounties[0].id}`)).toBeTruthy();
    fireEvent.press(view.getByTestId('bounty-search-clear'));
    expect(view.getByTestId('bounty-hero-rail')).toBeTruthy();

    // Equipped tab: only shows equipped-weapon bounties (e.g. flint-spark ON BELT, not unequipped time-drop)
    fireEvent.press(view.getByTestId('bounty-filter-equipped'));
    expect(view.getByTestId(`bounty-card-${flintBounties[0].id}`)).toBeTruthy();
    expect(view.queryByTestId(`bounty-card-${TIME_B1.id}`)).toBeNull();

    // Weapons tab: shows weapon-unlocking bounties
    fireEvent.press(view.getByTestId('bounty-filter-weapons'));
    if (weaponRewardBounty) {
      expect(view.getByTestId(`bounty-card-${weaponRewardBounty.id}`)).toBeTruthy();
    }

    // Evos tab: shows evolution-unlocking bounties
    fireEvent.press(view.getByTestId('bounty-filter-evos'));
    expect(view.getByTestId(`bounty-card-${evoRewardBounty.id}`)).toBeTruthy();

    // By Weapon tab: renders weapon groups and expands to show that weapon's 3 bounties
    fireEvent.press(view.getByTestId('bounty-filter-by_weapon'));
    expect(view.getByTestId('bounty-by-weapon-list')).toBeTruthy();
    expect(view.getByTestId('bounty-weapon-group-flint-spark')).toBeTruthy();
    expect(view.queryByTestId(`bounty-card-${flintBounties[0].id}`)).toBeNull();
    fireEvent.press(view.getByTestId('bounty-weapon-group-flint-spark'));
    expect(view.getByTestId(`bounty-card-${flintBounties[0].id}`)).toBeTruthy();

    // Done tab: shows claimed bounty with CLAIMED ✓
    fireEvent.press(view.getByTestId('bounty-filter-done'));
    expect(view.getByTestId(`bounty-card-${doneBounty.id}`)).toBeTruthy();
    expect(view.getByText('CLAIMED ✓')).toBeTruthy();

    view.unmount();
  });

  it('supports 1-tap EQUIP when belt has space and opens inline full-belt swap bar when belt is full', () => {
    // 1. Open belt slot (2/3 equipped): tapping EQUIP calls onEquipWeapon immediately
    const onEquip = jest.fn();
    const onSwap = jest.fn();
    const openBeltSave = makeRichSave({
      armory: ['blast-powder', 'flint-spark', 'time-drop'],
      charms: ['blast-powder', 'flint-spark'],
    });
    const viewOpen = render(
      wrap(
        <BountyBoard
          save={openBeltSave}
          onClose={noop}
          onEquipWeapon={onEquip}
          onSwapWeapon={onSwap}
        />
      )
    );
    const equipBtns = viewOpen.getAllByTestId(`bounty-equip-${TIME_B1.id}`);
    fireEvent.press(equipBtns[0]);
    expect(onEquip).toHaveBeenCalledWith('time-drop');
    expect(onSwap).not.toHaveBeenCalled();
    viewOpen.unmount();

    // 2. Full belt (3/3 equipped): tapping EQUIP opens inline swap bar & tapping an equipped weapon calls onSwapWeapon
    const fullBeltSave = makeRichSave({
      armory: ['blast-powder', 'flint-spark', 'mending-charm', 'time-drop'],
      charms: ['blast-powder', 'flint-spark', 'mending-charm'],
    });
    const viewFull = render(
      wrap(
        <BountyBoard
          save={fullBeltSave}
          onClose={noop}
          onEquipWeapon={onEquip}
          onSwapWeapon={onSwap}
        />
      )
    );
    fireEvent.changeText(viewFull.getByTestId('bounty-search'), TIME_B1.name);
    fireEvent.press(viewFull.getByTestId(`bounty-equip-${TIME_B1.id}`));
    expect(viewFull.getByTestId(`bounty-swap-${TIME_B1.id}`)).toBeTruthy();
    expect(viewFull.getByText('Belt full — swap out:')).toBeTruthy();
    fireEvent.press(viewFull.getByText('Blast Powder'));
    expect(onSwap).toHaveBeenCalledWith('blast-powder', 'time-drop');
    viewFull.unmount();
  });

  it('renders collapsed undiscovered teaser drawer and expands it on tap or locked highlightBountyId deep-link', () => {
    const save = makeRichSave();
    const lockedBounty = BOUNTIES.find(b => b.requiresWeapon && !save.armory.includes(b.requiresWeapon))!;
    const hiddenTotal = BOUNTIES.filter(
      b => !save.completedBounties.includes(b.id) && !isBountyWeaponOwned(save, b) && Boolean(b.requiresWeapon)
    ).length;

    // Default collapsed state
    const view = render(wrap(<BountyBoard save={save} onClose={noop} />));
    expect(view.getByTestId('bounty-hidden-footer')).toBeTruthy();
    expect(view.getByText(`+${hiddenTotal} More Bounties Hidden`)).toBeTruthy();
    expect(view.getByTestId('bounty-hidden-toggle').props.accessibilityState.expanded).toBe(false);

    // Tap to expand undiscovered weapon chains
    fireEvent.press(view.getByTestId('bounty-hidden-toggle'));
    expect(view.getByTestId('bounty-hidden-toggle').props.accessibilityState.expanded).toBe(true);
    view.unmount();

    // Deep-link highlightBountyId for a locked weapon bounty auto-expands the teaser drawer
    const lockedLinkView = render(
      wrap(<BountyBoard save={save} onClose={noop} highlightBountyId={lockedBounty.id} />)
    );
    expect(lockedLinkView.getByTestId('bounty-hidden-toggle').props.accessibilityState.expanded).toBe(true);
    lockedLinkView.unmount();

    // Deep-link highlightBountyId for a completed bounty auto-switches to the Done tab
    const doneLinkView = render(
      wrap(<BountyBoard save={save} onClose={noop} highlightBountyId={BLAST_B1.id} />)
    );
    expect(doneLinkView.getByTestId('bounty-filter-done').props.accessibilityState.selected).toBe(true);
    expect(doneLinkView.getByTestId(`bounty-card-${BLAST_B1.id}`)).toBeTruthy();
    doneLinkView.unmount();
  });
});

describe('UnlockReveal (Per-Weapon Evolutions, Boss Weapon Slots 4 & 5, and Weapon Bounty Pill)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('reveals a per-weapon evolution with condition/duration pills, plays auditionEvolution, and 1-tap equips it', () => {
    const [evoA, evoB] = evolutionsForWeapon('blast-powder');
    const save = makeRichSave({
      armory: ['blast-powder'],
      charms: ['blast-powder'],
      unlockedWeaponEvolutions: [evoA.id, evoB.id],
      equippedEvolutions: { 'blast-powder': evoA.id },
    });
    const onEquipEvolution = jest.fn();
    const onDone = jest.fn();

    const view = render(
      wrap(
        <UnlockReveal
          unlocks={[{ kind: 'evolution', id: evoB.id, weaponId: 'blast-powder', star: 0, firstEvolution: true }]}
          save={save}
          onUseFighter={noop}
          onEquipCharm={noop}
          onEquipEvolution={onEquipEvolution}
          onDone={onDone}
        />
      )
    );

    fireEvent.press(view.getByTestId('unlock-reveal'));
    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(view.getByTestId('unlock-revealed-evolution')).toBeTruthy();
    expect(view.getByText(evoB.name)).toBeTruthy();
    expect(view.getByText(`${Math.round(evoB.durationMs / 1000)}s active`)).toBeTruthy();
    expect(band.auditionEvolution).toHaveBeenCalledWith(evoB.id);

    // 1-tap Equip CTA wires straight into onEquipEvolution(weaponId, evoId)
    expect(view.getByText(`Equip ${evoB.name} on Blast Powder`)).toBeTruthy();
    fireEvent.press(view.getByTestId('unlock-primary'));
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(onEquipEvolution).toHaveBeenCalledWith('blast-powder', evoB.id);
    expect(onDone).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  it('reveals 4th and 5th boss weapon slot expansions with animated SlotExpansionStrip and Armory CTA', () => {
    const save = makeRichSave();

    for (const slotNumber of [4, 5] as const) {
      const onOpenArmory = jest.fn();
      const onDone = jest.fn();
      const view = render(
        wrap(
          <UnlockReveal
            unlocks={[{ kind: 'weapon_slot', slotNumber, levelId: slotNumber === 4 ? '1-10' : '2-10', star: 1 }]}
            save={save}
            onUseFighter={noop}
            onEquipCharm={noop}
            onOpenArmory={onOpenArmory}
            onDone={onDone}
          />
        )
      );

      fireEvent.press(view.getByTestId('unlock-reveal'));
      act(() => {
        jest.advanceTimersByTime(600);
      });

      expect(view.getByTestId(`unlock-slot-strip-${slotNumber}`)).toBeTruthy();
      const ordinal = slotNumber === 4 ? '4th' : '5th';
      expect(view.getByText(`Equip a ${ordinal} Weapon`)).toBeTruthy();
      fireEvent.press(view.getByTestId('unlock-primary'));
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onOpenArmory).toHaveBeenCalledTimes(1);

      view.unmount();
    }
  });

  it('shows the "Opens 3 new Bounties at Camp!" pill when revealing a newly unlocked Armory weapon', () => {
    const save = makeRichSave({ armory: ['blast-powder'], charms: ['blast-powder'] });
    const view = render(
      wrap(
        <UnlockReveal
          unlocks={[{ kind: 'weapon', id: 'flint-spark', star: 0, firstWeapon: false }]}
          save={save}
          onUseFighter={noop}
          onEquipCharm={noop}
          onDone={noop}
        />
      )
    );

    fireEvent.press(view.getByTestId('unlock-reveal'));
    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(view.getByTestId('unlock-revealed-weapon')).toBeTruthy();
    expect(view.getByTestId('unlock-opens-bounties')).toHaveTextContent('Opens 3 new Bounties at Camp!', { exact: false });
    view.unmount();
  });
});
