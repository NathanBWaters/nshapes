/**
 * Full-Game End-to-End (E2E) UI & Progression Integration Suite for Adventure Mode.
 *
 * Mounts the real `<AdventureMode />` component tree backed by persistent KV storage
 * and drives complete user journeys across the campaign (`1-1` through `4-5` + Elites),
 * verifying that every progression, combat, and UI subsystem unlocks and operates
 * at the exact stage it is supposed to:
 *   1. Pre-`1-1` fresh save onboarding (Story → Lessons → Quizzes → Fight Tips, locked docks)
 *   2. `1-1` triple unlock (`Coin Drops` ★ + `Blast Powder` ★★ + `Sly Fox` ★★★) & silhouette-to-reveal chain
 *   3. `1-2` Hearts, `1-3` 3rd trait + `Flint Spark` 2nd weapon unlock
 *   4. `1-4` Power Cards + Unlockable Workshop (`★`), unlocked-only filtering, `+tier` upgrades & 100% Free Refunds
 *   5. `1-5` Rainbow Strike → `1-5E` Elite branch, order-aware Combo Discovery tutorial, `Arcana` (`★`) & `Solar Cataclysm` (`★★`)
 *   6. `1-6` Escalating Purity + Adaptive Weapon Combos tutorial + live Catalyst forging (`EVO READY` → `FORGED COMBO` in Recipe Guide)
 *   7. Premature Catalyst shatter (`Catalyst Lost`) & strict `<= 1` Catalyst-on-screen invariant
 *   8. `1-7` Timer + `Hourglass` Workshop unlock + 2nd combo (`Immortal Aegis`) without duplicate discovery tutorial
 *   9. `1-8` Boss + Cross-Run Bounty Board unlock, category filters, auto-cashout & reward unlocks
 *  10. Worlds 2–4 landmarks (`2-1` Hints + `Sharp Eyes`, `2-2` Duds, `2-3` Face-Down, `2-4` Graces + `Second Wind`,
 *      `2-5` XP `WeaponPick` with `+tier`, `3-2` Waves, `3-3` Wave `SHOP`, `4-1` 5th trait, `4-5` Final Boss `The Hydra`)
 *      and 100% campaign completion (`111/111 ★`, all 6 Fighters, 8 Evolutions, 8 Arcana, 6 Mechanic Upgrades, 16 Bounties).
 */
import React from 'react';
import { render, fireEvent, act, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AdventureMode from '@/adventure/AdventureMode';
import { LEVELS, MAIN_LEVELS, getLevel } from '@/adventure/data/levels';
import { FIGHTERS } from '@/adventure/data/fighters';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import { ARCANA } from '@/adventure/data/arcana';
import { UPGRADES } from '@/adventure/data/upgrades';
import { BOUNTIES } from '@/adventure/data/bounties';
import { applyLevelResult, createNewSave, isLevelUnlocked, maxStars, totalStars } from '@/adventure/progress';
import { loadAdventureSave } from '@/adventure/save';
import { createRng } from '@/adventure/engine/rng';
import { countDifferentAttributes } from '@/adventure/engine/sets';
import { isValidCombination } from '@/utils/gameUtils';
import type { AttributeName, Background, Card, Color, Number as CardNumber, Shading, Shape } from '@/types';

const mockKvStore = new Map<string, string>();

jest.mock('@/utils/storage', () => ({
  storage: {
    getString: jest.fn((key: string) => mockKvStore.get(key)),
    set: jest.fn((key: string, val: string) => {
      mockKvStore.set(key, val);
    }),
    remove: jest.fn((key: string) => {
      mockKvStore.delete(key);
    }),
  },
  kvGet: jest.fn((key: string) => mockKvStore.get(key) ?? null),
  kvSet: jest.fn((key: string, val: string) => {
    mockKvStore.set(key, val);
  }),
  kvRemove: jest.fn((key: string) => {
    mockKvStore.delete(key);
  }),
}));

jest.mock('@/audio', () => ({
  sfx: jest.fn(),
  music: { play: jest.fn(), stop: jest.fn() },
  setMusicEnabled: jest.fn(),
}));

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
    EnemyAvatar: ({ testID, enemy }: { testID?: string; enemy?: { name?: string } }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `enemy-avatar-${enemy?.name ?? 'foe'}` }),
  };
});

jest.mock('@/components/weapons', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    WeaponAvatar: ({ testID, weapon }: { testID?: string; weapon?: { name?: string } }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `weapon-avatar-${weapon?.name ?? 'weapon'}` }),
  };
});

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const MockIcon = ({ name }: { name: string }) =>
    ReactActual.createElement(View, { accessibilityLabel: `icon-${name}` });
  return {
    __esModule: true,
    default: MockIcon,
    Icon: MockIcon,
  };
});

jest.mock('react-native-svg', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const makeSvgMock = (name: string) => {
    const Comp = (props: any) => ReactActual.createElement(View, props, props?.children);
    Comp.displayName = name;
    return Comp;
  };
  const SvgRoot = makeSvgMock('Svg');
  return new Proxy(
    { __esModule: true, default: SvgRoot, Svg: SvgRoot },
    {
      get(target, prop: string) {
        if (prop in target) return (target as any)[prop];
        return makeSvgMock(String(prop));
      },
    }
  );
});

const INSETS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const wrap = (ui: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={INSETS}>{ui}</SafeAreaProvider>
);

// ─── Rendered Board Inspection & Live Play Helpers ──────────────────────────

interface RenderedSlotCard {
  slotId: string;
  pressable: any;
  card: Card;
  disabled: boolean;
  hasCatalyst: boolean;
  catalystReady: boolean;
}

const CARD_LABEL_RE =
  /^(1|2|3) (red|green|purple) (solid|striped|open) (oval|squiggle|diamond)(?: on (white|beige|charcoal))?(.*)$/;

function collectTreeText(node: any): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(collectTreeText).join(' ');
  if (typeof node === 'object' && Array.isArray(node.children)) {
    return node.children.map(collectTreeText).join(' ');
  }
  return '';
}

function findNodesWithProp(node: any, pred: (n: any) => boolean, out: any[] = []): any[] {
  if (!node || typeof node !== 'object') return out;
  if (pred(node)) out.push(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (typeof child === 'object') findNodesWithProp(child, pred, out);
    }
  }
  return out;
}

function readLiveBoard(screen: ReturnType<typeof render>): RenderedSlotCard[] {
  const results: RenderedSlotCard[] = [];
  for (let r = 0; r < 8; r++) {
    const firstSlot = screen.queryByTestId(`card-slot-${r}-0`);
    if (!firstSlot && r >= 3) break;
    for (let c = 0; c < 3; c++) {
      const slotId = `card-slot-${r}-${c}`;
      const slot = c === 0 ? firstSlot : screen.queryByTestId(slotId);
      if (!slot) continue;
      const pressables = findNodesWithProp(
        slot,
        n => typeof n.props?.accessibilityLabel === 'string' && CARD_LABEL_RE.test(n.props.accessibilityLabel)
      );
      const pressable = pressables[0];
      if (!pressable) continue;
      const m = CARD_LABEL_RE.exec(pressable.props.accessibilityLabel as string);
      if (!m) continue;
      const tail = m[6] ?? '';
      const isDud = tail.includes(', dud');
      const isFaceDown = tail.includes(', face down');
      const catalystReady = tail.includes(', evolution ready');
      const hasCatalyst = catalystReady || tail.includes(', dormant catalyst');
      const disabled = Boolean(
        pressable.props?.disabled || pressable.props?.accessibilityState?.disabled || isDud || isFaceDown
      );
      results.push({
        slotId,
        pressable,
        disabled,
        hasCatalyst,
        catalystReady,
        card: {
          id: slotId,
          number: Number(m[1]) as CardNumber,
          color: m[2] as Color,
          shading: m[3] as Shading,
          shape: m[4] as Shape,
          background: (m[5] as Background | undefined) ?? 'white',
          selected: false,
          isDud,
          isFaceDown,
          hasEvolutionItem: hasCatalyst,
          evolutionReady: catalystReady,
        },
      });
    }
  }
  return results;
}

function findValidSetsOnBoard(
  slots: RenderedSlotCard[],
  attrs: AttributeName[]
): RenderedSlotCard[][] {
  const selectable = slots.filter(s => !s.disabled && !s.card.isDud && !s.card.isFaceDown);
  const sets: RenderedSlotCard[][] = [];
  for (let i = 0; i < selectable.length - 2; i++) {
    for (let j = i + 1; j < selectable.length - 1; j++) {
      for (let k = j + 1; k < selectable.length; k++) {
        const triple = [selectable[i], selectable[j], selectable[k]];
        if (
          isValidCombination(
            triple.map(t => t.card),
            attrs
          ).isValid
        ) {
          sets.push(triple);
        }
      }
    }
  }
  return sets;
}

function advanceMs(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

function tapTripleOnBoard(triple: RenderedSlotCard[]) {
  expect(triple).toHaveLength(3);
  fireEvent.press(triple[0].pressable);
  fireEvent.press(triple[1].pressable);
  fireEvent.press(triple[2].pressable);
  // 200ms GameBoard validation -> 950ms AdventureRun REPLACE -> 1500ms reward reveal clear
  advanceMs(250);
  advanceMs(1000);
  advanceMs(600);
}

/**
 * Step cleanly through any active MechanicIntro modal (lessons + interactive quizzes),
 * returning all visible text encountered along the way for assertions.
 */
function completeLessonModal(
  screen: ReturnType<typeof render>,
  quizAttrs: AttributeName[] = ['shape', 'color', 'number']
): string[] {
  const snapshots: string[] = [];
  let guard = 0;
  while (
    (screen.queryByTestId('mechanic-intro-ok') || screen.queryByTestId('quiz-yes')) &&
    guard < 30
  ) {
    guard += 1;
    const modal = screen.queryByTestId('lesson-modal');
    if (modal) snapshots.push(collectTreeText(modal));
    const yesBtn = screen.queryByTestId('quiz-yes');
    if (yesBtn) {
      // Read the 3 demo cards inside the quiz stage and answer accurately!
      const demoNodes = modal
        ? findNodesWithProp(
            modal,
            n => typeof n.props?.accessibilityLabel === 'string' && CARD_LABEL_RE.test(n.props.accessibilityLabel)
          )
        : [];
      let chooseYes = true;
      if (demoNodes.length >= 3) {
        const cards: Card[] = demoNodes.slice(-3).map((n, idx) => {
          const m = CARD_LABEL_RE.exec(n.props.accessibilityLabel)!;
          return {
            id: `q-${idx}`,
            number: Number(m[1]) as CardNumber,
            color: m[2] as Color,
            shading: m[3] as Shading,
            shape: m[4] as Shape,
            background: (m[5] as Background | undefined) ?? 'white',
            selected: false,
          };
        });
        chooseYes = isValidCombination(cards, quizAttrs).isValid;
      }
      fireEvent.press(screen.getByTestId(chooseYes ? 'quiz-yes' : 'quiz-no'));
      const afterModal = screen.queryByTestId('lesson-modal');
      if (afterModal) snapshots.push(collectTreeText(afterModal));
    }
    const okBtn = screen.queryByTestId('mechanic-intro-ok');
    if (okBtn) {
      fireEvent.press(okBtn);
    }
  }
  return snapshots;
}

function dismissAllFightTips(screen: ReturnType<typeof render>): number {
  let count = 0;
  while (screen.queryByTestId('tip-ok') && count < 15) {
    fireEvent.press(screen.getByTestId('tip-ok'));
    count += 1;
  }
  return count;
}

/**
 * Play a live AdventureRun to completion by tapping actual rendered `<Card />` nodes,
 * handling coach marks, XP level-up picks, and wave intermissions/shops along the way.
 */
function playLiveFightToCompletion(
  screen: ReturnType<typeof render>,
  attrs: AttributeName[],
  opts: {
    preferRainbow?: boolean;
    avoidCatalystUntilReady?: boolean;
    useHintOnce?: boolean;
    buyInShop?: boolean;
    onStep?: (info: { step: number; board: RenderedSlotCard[] }) => void;
  } = {}
): {
  tipsDismissed: number;
  maxCatalystsSeenAtOnce: number;
  pickedLevelUp: boolean;
  visitedShop: boolean;
  usedHint: boolean;
} {
  let tipsDismissed = dismissAllFightTips(screen);
  let maxCatalystsSeenAtOnce = 0;
  let pickedLevelUp = false;
  let visitedShop = false;
  let usedHint = false;

  for (let step = 0; step < 60; step++) {
    tipsDismissed += dismissAllFightTips(screen);

    // Handle mid-fight XP level-up modal
    if (screen.queryByTestId('pick-0')) {
      pickedLevelUp = true;
      fireEvent.press(screen.getByTestId('pick-0'));
      tipsDismissed += dismissAllFightTips(screen);
    }

    // Handle multi-wave intermission / shop modal
    if (screen.queryByTestId('next-wave')) {
      if (opts.buyInShop && screen.queryByTestId('shop-buy-0')) {
        visitedShop = true;
        fireEvent.press(screen.getByTestId('shop-buy-0'));
      }
      fireEvent.press(screen.getByTestId('next-wave'));
      tipsDismissed += dismissAllFightTips(screen);
    }

    // Check if LevelResults has mounted
    if (screen.queryByTestId('results-retry') || screen.queryByTestId('results-map')) {
      break;
    }

    if (opts.useHintOnce && !usedHint && screen.queryByTestId('run-hint')) {
      fireEvent.press(screen.getByTestId('run-hint'));
      usedHint = true;
    }

    // Fire active ability if charged & ready (e.g. Sly Fox / Pelican / Penguin)
    const abilityBtn = screen.queryByTestId('run-ability');
    if (
      abilityBtn &&
      typeof abilityBtn.props?.accessibilityLabel === 'string' &&
      abilityBtn.props.accessibilityLabel.includes('ready')
    ) {
      fireEvent.press(abilityBtn);
      advanceMs(1000);
      tipsDismissed += dismissAllFightTips(screen);
    }

    const board = readLiveBoard(screen);
    const catalystBadges = screen.queryAllByTestId('card-evolution-catalyst');
    maxCatalystsSeenAtOnce = Math.max(maxCatalystsSeenAtOnce, catalystBadges.length);
    expect(catalystBadges.length).toBeLessThanOrEqual(1);

    opts.onStep?.({ step, board });

    if (board.length === 0) {
      advanceMs(1500);
      if (screen.queryByTestId('results-retry') || screen.queryByTestId('results-map')) break;
      continue;
    }

    const validSets = findValidSetsOnBoard(board, attrs);
    if (validSets.length === 0) {
      advanceMs(1000);
      continue;
    }

    // Score candidate Sets according to strategy
    const chosen = [...validSets].sort((a, b) => {
      const aHasReadyCat = a.some(s => s.hasCatalyst && s.catalystReady) ? 1 : 0;
      const bHasReadyCat = b.some(s => s.hasCatalyst && s.catalystReady) ? 1 : 0;
      if (aHasReadyCat !== bHasReadyCat) return bHasReadyCat - aHasReadyCat;

      if (opts.avoidCatalystUntilReady) {
        const aDormantCat = a.some(s => s.hasCatalyst && !s.catalystReady) ? 1 : 0;
        const bDormantCat = b.some(s => s.hasCatalyst && !s.catalystReady) ? 1 : 0;
        if (aDormantCat !== bDormantCat) return aDormantCat - bDormantCat;
      }

      const aDiff = countDifferentAttributes(
        a.map(s => s.card),
        attrs
      );
      const bDiff = countDifferentAttributes(
        b.map(s => s.card),
        attrs
      );
      if (aDiff !== bDiff) {
        return opts.preferRainbow === false ? aDiff - bDiff : bDiff - aDiff;
      }
      return 0;
    })[0];

    tapTripleOnBoard(chosen);
    tipsDismissed += dismissAllFightTips(screen);

    if (screen.queryByTestId('results-retry') || screen.queryByTestId('results-map')) {
      break;
    }
  }

  // Ensure finishing timer lands on LevelResults
  if (!screen.queryByTestId('results-retry') && !screen.queryByTestId('results-map')) {
    advanceMs(2000);
  }
  expect(screen.getByTestId('results-map')).toBeTruthy();

  return { tipsDismissed, maxCatalystsSeenAtOnce, pickedLevelUp, visitedShop, usedHint };
}

/**
 * Step through all queued `<UnlockReveal />` screens and collect the revealed item names.
 */
function stepThroughUnlockReveals(
  screen: ReturnType<typeof render>,
  opts: { preferSecondaryOnLast?: boolean } = {}
): string[] {
  advanceMs(2600);
  const revealedTexts: string[] = [];
  let guard = 0;
  while (screen.queryByTestId('unlock-reveal') && guard < 15) {
    guard += 1;
    fireEvent.press(screen.getByTestId('unlock-reveal'));
    const modal = screen.queryByTestId('unlock-modal');
    revealedTexts.push(modal ? collectTreeText(modal) : '');
    if (opts.preferSecondaryOnLast && screen.queryByText('Stay on results')) {
      fireEvent.press(screen.getByText('Stay on results'));
    } else {
      fireEvent.press(screen.getByTestId('unlock-primary'));
    }
  }
  return revealedTexts;
}

jest.setTimeout(120_000);

describe('Adventure Mode Full-Game E2E Integration & Unlock Journey', () => {
  let randomSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    mockKvStore.clear();
    const prng = createRng(20261111);
    randomSpy = jest.spyOn(Math, 'random').mockImplementation(() => prng.next());
  });

  afterEach(() => {
    randomSpy.mockRestore();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('drives a fresh player from 1-1 through World 1 (1-8 + 1-5E), verifying every unlock, tutorial, UI gate, refund, combo forge, and bounty board', () => {
    const screen = render(wrap(<AdventureMode onExit={() => {}} />));

    // ═════════════════════════════════════════════════════════════════════════
    // 1. FRESH LAUNCH → 1-1 ONBOARDING → FIGHT → TRIPLE UNLOCK REVEAL
    // ═════════════════════════════════════════════════════════════════════════
    const intro11 = completeLessonModal(screen, ['shape', 'color']);
    expect(intro11.some(s => s.includes('The meadow needs you'))).toBe(true);
    expect(intro11.some(s => s.includes('The Set'))).toBe(true);
    expect(intro11.some(s => s.includes('Is this a Set?'))).toBe(true);

    // Pre-unlock HUD check inside 1-1: no hint button, no purity/evo/arcana chips
    expect(screen.queryByTestId('run-hint')).toBeNull();
    expect(screen.queryByTestId('run-purity-chip')).toBeNull();
    expect(screen.queryByTestId('run-evo-chip')).toBeNull();

    const run11 = playLiveFightToCompletion(screen, ['shape', 'color']);
    expect(run11.tipsDismissed).toBeGreaterThanOrEqual(3); // 3 fightTips in 1-1!
    expect(screen.getByText('PERFECT!')).toBeTruthy();

    // Before UnlockReveal plays, LevelResults hides all 3 rewards behind silhouettes!
    expect(screen.getByText('New ability')).toBeTruthy();
    expect(screen.getByText('A new weapon')).toBeTruthy();
    expect(screen.getByText('A new fighter')).toBeTruthy();
    expect(screen.queryByText('Sly Fox')).toBeNull();

    // Advance timer to pop UnlockReveal (1/3 Coin Drops, 2/3 Blast Powder, 3/3 Sly Fox)
    const reveals11 = stepThroughUnlockReveals(screen);
    expect(reveals11).toHaveLength(3);
    expect(reveals11[0]).toContain('Coin Drops');
    expect(reveals11[1]).toContain('Blast Powder');
    expect(reveals11[1]).toContain('Your first charm');
    expect(reveals11[1]).toContain('Equipped ✓  Continue');
    expect(reveals11[2]).toContain('Sly Fox');

    // After UnlockReveal finishes, LevelResults reveals all 3 unlocked names!
    expect(screen.getByText('Coin Drops')).toBeTruthy();
    expect(screen.getByText('Blast Powder')).toBeTruthy();
    expect(screen.getByText('Sly Fox')).toBeTruthy();

    // Check persisted save state after 1-1
    let persisted = loadAdventureSave();
    expect(persisted.coinsUnlocked).toBe(true);
    expect(persisted.armory).toEqual(['blast-powder-common']);
    expect(persisted.charm).toBe('blast-powder-common');
    expect(persisted.selectedFighter).toBe('Sly Fox');
    expect(persisted.workshopUnlocked).toBe(false);
    expect(persisted.bountiesUnlocked).toBe(false);

    // Go to Map: Camp dock is now unlocked, Bounties dock is still locked!
    fireEvent.press(screen.getByTestId('results-map'));
    expect(screen.getByTestId('map-dock-camp').props.accessibilityState?.disabled).toBe(false);
    expect(screen.getByTestId('map-dock-bounties').props.accessibilityState?.disabled).toBe(true);

    // Open Camp before 1-4: Workshop tab shows 🔒 WORKSHOP and locked notice
    fireEvent.press(screen.getByTestId('map-dock-camp'));
    expect(screen.getByText('🔒 WORKSHOP')).toBeTruthy();
    fireEvent.press(screen.getByTestId('camp-tab-workshop'));
    expect(screen.getByTestId('camp-workshop-locked')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Back to map'));

    // ═════════════════════════════════════════════════════════════════════════
    // 2. 1-2 (HEARTS) & 1-3 (3RD TRAIT: NUMBER + 2ND WEAPON UNLOCK)
    // ═════════════════════════════════════════════════════════════════════════
    fireEvent.press(screen.getByTestId('map-node-1-2'));
    fireEvent.press(screen.getByTestId('preview-play'));
    const intro12 = completeLessonModal(screen, ['shape', 'color']);
    expect(intro12.some(s => s.includes('Hearts'))).toBe(true);
    playLiveFightToCompletion(screen, ['shape', 'color']);
    stepThroughUnlockReveals(screen);

    // Advance directly from LevelResults -> Next: 1-3
    fireEvent.press(screen.getByTestId('results-next'));
    fireEvent.press(screen.getByTestId('preview-play'));
    const intro13 = completeLessonModal(screen, ['shape', 'color', 'number']);
    expect(intro13.some(s => s.includes('New Trait: Number'))).toBe(true);
    playLiveFightToCompletion(screen, ['shape', 'color', 'number']);
    const reveals13 = stepThroughUnlockReveals(screen);
    expect(reveals13.some(r => r.includes('Flint Spark'))).toBe(true);
    expect(loadAdventureSave().armory).toContain('flint-spark-common');

    // ═════════════════════════════════════════════════════════════════════════
    // 3. 1-4 (POWER CARDS + WORKSHOP UNLOCK + FILTERED UPGRADES + 100% REFUNDS)
    // ═════════════════════════════════════════════════════════════════════════
    fireEvent.press(screen.getByTestId('results-next'));
    fireEvent.press(screen.getByTestId('preview-play'));
    const intro14 = completeLessonModal(screen, ['shape', 'color', 'number']);
    expect(intro14.some(s => s.includes('Power Cards'))).toBe(true);
    playLiveFightToCompletion(screen, ['shape', 'color', 'number']);
    const reveals14 = stepThroughUnlockReveals(screen, { preferSecondaryOnLast: true });
    expect(reveals14.some(r => r.includes('The Workshop'))).toBe(true);
    expect(loadAdventureSave().workshopUnlocked).toBe(true);

    // Tapping Camp on 1-4 LevelResults opens Camp directly on the newly unlocked Workshop tab!
    fireEvent.press(screen.getByTestId('results-camp'));
    expect(screen.queryByTestId('camp-workshop-locked')).toBeNull();

    // Only unlocked mechanics appear; future mechanics (Hourglass 1-7, Sharp Eyes 2-1, Second Wind 2-4) stay hidden!
    expect(screen.getByTestId('camp-upgrade-heavy_hitter')).toBeTruthy();
    expect(screen.getByTestId('camp-upgrade-tough_hide')).toBeTruthy();
    expect(screen.getByTestId('camp-upgrade-lucky_purse')).toBeTruthy();
    expect(screen.queryByTestId('camp-upgrade-hourglass')).toBeNull();
    expect(screen.queryByTestId('camp-upgrade-sharp_eyes')).toBeNull();
    expect(screen.queryByTestId('camp-upgrade-second_wind')).toBeNull();

    // Only unlocked Armory weapons appear in Weapon Upgrades
    expect(screen.getByTestId('camp-weapon-upgrade-blast-powder-common')).toBeTruthy();
    expect(screen.getByTestId('camp-weapon-upgrade-flint-spark-common')).toBeTruthy();
    expect(screen.queryByTestId('camp-weapon-upgrade-chrono-shard-common')).toBeNull();

    // Upgrade Blast Powder (+1 for 80¢) + level Sly Fox, then verify 100% Free Money Refund!
    const coinsBeforeSpend = loadAdventureSave().coins;
    expect(coinsBeforeSpend).toBeGreaterThanOrEqual(140);
    fireEvent.press(screen.getByTestId('camp-buy-weapon-blast-powder-common'));
    expect(screen.getByText('Blast Powder +1')).toBeTruthy();
    expect(loadAdventureSave().coins).toBe(coinsBeforeSpend - 80);

    // Per-weapon refund returns 100% of coins
    fireEvent.press(screen.getByTestId('camp-refund-weapon-blast-powder-common'));
    expect(loadAdventureSave().coins).toBe(coinsBeforeSpend);

    // Buy weapon upgrade + fighter level, then Refund All returns 100% of coins across tabs!
    fireEvent.press(screen.getByTestId('camp-buy-weapon-blast-powder-common'));
    fireEvent.press(screen.getByTestId('camp-tab-fighters'));
    fireEvent.press(screen.getAllByText('60¢')[0]); // Level 1 -> 2 costs 60¢
    expect(loadAdventureSave().coins).toBe(coinsBeforeSpend - 140);
    fireEvent.press(screen.getByTestId('camp-refund-all'));
    expect(loadAdventureSave().coins).toBe(coinsBeforeSpend);

    // Re-apply Blast Powder +1 & equip Blast Powder as Charm for Sly Fox's Solar Cataclysm combo!
    fireEvent.press(screen.getByTestId('camp-tab-workshop'));
    fireEvent.press(screen.getByTestId('camp-buy-weapon-blast-powder-common'));
    fireEvent.press(screen.getByTestId('camp-tab-armory'));
    fireEvent.press(screen.getByText('Blast Powder +1'));
    expect(loadAdventureSave().charm).toBe('blast-powder-common');
    fireEvent.press(screen.getByLabelText('Back to map'));

    // ═════════════════════════════════════════════════════════════════════════
    // 4. 1-5 (RAINBOW) → 1-5E ELITE (ORDER-AWARE COMBO DISCOVERY + ARCANA + COMBO)
    // ═════════════════════════════════════════════════════════════════════════
    // Before 1-5 ★★, 1-5E Elite is locked on LevelPreview
    fireEvent.press(screen.getByTestId('map-node-1-5E'));
    expect(collectTreeText(screen.toJSON())).toContain('Elite path. Earn ★★ on 1-5');
    fireEvent.press(screen.getByText('✕'));

    fireEvent.press(screen.getByTestId('map-node-1-5'));
    fireEvent.press(screen.getByTestId('preview-play'));
    const intro15 = completeLessonModal(screen, ['shape', 'color', 'number']);
    expect(intro15.some(s => s.includes('Rainbow Strike'))).toBe(true);
    playLiveFightToCompletion(screen, ['shape', 'color', 'number'], { preferRainbow: true });
    stepThroughUnlockReveals(screen);
    fireEvent.press(screen.getByTestId('results-map'));

    // 1-5E Elite is now unlocked! Verify order-aware Combo Discovery prelude (zero clock spoilers)
    expect(isLevelUnlocked(loadAdventureSave(), getLevel('1-5E'))).toBe(true);
    fireEvent.press(screen.getByTestId('map-node-1-5E'));
    fireEvent.press(screen.getByTestId('preview-play'));
    const intro15E = completeLessonModal(screen, ['shape', 'color', 'number']);
    expect(intro15E.some(s => s.includes('Combo Vault: First Weapon Combo'))).toBe(true);
    expect(intro15E.every(s => !s.includes('countdown clock'))).toBe(true);

    playLiveFightToCompletion(screen, ['shape', 'color', 'number'], { preferRainbow: true });
    const reveals15E = stepThroughUnlockReveals(screen);
    expect(reveals15E.some(r => r.includes('Overkill Harvest'))).toBe(true);
    expect(reveals15E.some(r => r.includes('Solar Cataclysm'))).toBe(true);
    expect(reveals15E.some(r => r.includes('How Hidden Catalysts Work'))).toBe(true);

    // Overkill Harvest Arcana was equipped from UnlockReveal -> verify Map Arcana badge!
    fireEvent.press(screen.getByTestId('results-map'));
    expect(loadAdventureSave().activeArcana).toBe('overkill_harvest');
    expect(screen.getByText('V')).toBeTruthy();

    // ═════════════════════════════════════════════════════════════════════════
    // 5. 1-6 (ESCALATING PURITY + ADAPTIVE COMBO INTRO + LIVE CATALYST FORGE!)
    // ═════════════════════════════════════════════════════════════════════════
    fireEvent.press(screen.getByTestId('map-node-1-6'));
    // LevelPreview displays upgraded Charm ("Blast Powder +1"), Combo Synergy hint, and Arcana toggle!
    expect(screen.getByText('Blast Powder +1')).toBeTruthy();
    expect(screen.getByText('Combo Ready to Prime: Solar Cataclysm')).toBeTruthy();
    // Toggle to Standard rules and back to Overkill Harvest via LevelPreview Arcana picker
    fireEvent.press(screen.getByTestId('preview-arcana-none'));
    expect(loadAdventureSave().activeArcana).toBeNull();
    fireEvent.press(screen.getByTestId('preview-arcana-overkill_harvest'));
    expect(loadAdventureSave().activeArcana).toBe('overkill_harvest');

    fireEvent.press(screen.getByTestId('preview-play'));
    // Chains Escalating Purity intro -> Adaptive Weapon Combos tutorial!
    const intro16 = completeLessonModal(screen, ['shape', 'color', 'number']);
    expect(intro16.some(s => s.includes('Escalating Purity'))).toBe(true);
    expect(intro16.some(s => s.includes('Weapon Combos'))).toBe(true);

    // Custom live step inside 1-6: verify active Arcana chip, trigger Escalating Purity, AND forge Solar Cataclysm!
    dismissAllFightTips(screen);
    expect(screen.getByTestId('run-arcana-chip')).toBeTruthy();
    let sawPurityChip = false;
    let forgedSolarCataclysm = false;

    // Suppress random Blast Powder / Flint Spark collateral rolls until Solar Cataclysm is forged
    // so an early collateral explosion never accidentally destroys the dormant Catalyst card!
    const forgePrng = createRng(777);
    randomSpy.mockImplementation(() => (forgedSolarCataclysm ? forgePrng.next() : 0.99));

    for (let move = 0; move < 9; move++) {
      dismissAllFightTips(screen);
      if (screen.queryByTestId('results-map')) break;
      const board = readLiveBoard(screen);
      expect(screen.queryAllByTestId('card-evolution-catalyst').length).toBeLessThanOrEqual(1);
      const validSets = findValidSetsOnBoard(board, ['shape', 'color', 'number']);
      expect(validSets.length).toBeGreaterThan(0);

      // Moves 0->1 escalate Purity (1-diff -> 2/3-diff); Move 2 uses low damage so 3 Sets prime Solar Cataclysm
      // with plenty of foe HP left; Move 3+ prioritizes the gold EVO Catalyst Set to forge Solar Cataclysm!
      const sorted = [...validSets].sort((a, b) => {
        const aReadyCat = a.some(s => s.hasCatalyst && s.catalystReady) ? 1 : 0;
        const bReadyCat = b.some(s => s.hasCatalyst && s.catalystReady) ? 1 : 0;
        if (aReadyCat !== bReadyCat) return bReadyCat - aReadyCat;

        const aDormantCat = a.some(s => s.hasCatalyst && !s.catalystReady) ? 1 : 0;
        const bDormantCat = b.some(s => s.hasCatalyst && !s.catalystReady) ? 1 : 0;
        if (aDormantCat !== bDormantCat) return aDormantCat - bDormantCat;

        const aDiff = countDifferentAttributes(a.map(s => s.card), ['shape', 'color', 'number']);
        const bDiff = countDifferentAttributes(b.map(s => s.card), ['shape', 'color', 'number']);
        if (move === 1 || forgedSolarCataclysm) return bDiff - aDiff;
        return aDiff - bDiff;
      });

      tapTripleOnBoard(sorted[0]);
      dismissAllFightTips(screen);

      if (screen.queryByTestId('run-purity-chip')) {
        sawPurityChip = true;
      }
      const evoChip = screen.queryByTestId('run-evo-chip');
      if (evoChip && within(evoChip).queryByText('Evolved ✓')) {
        forgedSolarCataclysm = true;
      }
    }

    // Restore deterministic PRNG for subsequent levels
    const post16Prng = createRng(20261112);
    randomSpy.mockImplementation(() => post16Prng.next());

    if (!screen.queryByTestId('results-map')) {
      playLiveFightToCompletion(screen, ['shape', 'color', 'number'], { avoidCatalystUntilReady: true });
    }
    // Reset Arcana to Standard for 1-7 & 1-8
    stepThroughUnlockReveals(screen);

    expect(sawPurityChip).toBe(true);
    expect(forgedSolarCataclysm).toBe(true);
    expect(loadAdventureSave().discoveredEvolutions).toContain('solar-cataclysm');

    // Open Field Guide -> Recipe Guide: verify Solar Cataclysm is now FORGED COMBO!
    fireEvent.press(screen.getByTestId('results-map'));
    fireEvent.press(screen.getByTestId('map-dock-guide'));
    fireEvent.press(screen.getByTestId('guide-tab-recipes'));
    expect(screen.getByText('FORGED COMBO')).toBeTruthy();
    expect(screen.getByText(/Deals 6 damage and ignites 2 cards/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Back to map'));

    // ═════════════════════════════════════════════════════════════════════════
    // 6. 1-7 (TIMER + HOURGLASS WORKSHOP + 2ND COMBO) & 1-8 (BOUNTY BOARD!)
    // ═════════════════════════════════════════════════════════════════════════
    fireEvent.press(screen.getByTestId('map-node-1-7'));
    fireEvent.press(screen.getByTestId('preview-arcana-none'));
    fireEvent.press(screen.getByTestId('preview-play'));
    const intro17 = completeLessonModal(screen, ['shape', 'color', 'number']);
    // Does NOT repeat combo discovery prelude because 1-5E already showed it!
    expect(intro17.every(s => !s.includes('First Weapon Combo'))).toBe(true);
    expect(intro17.some(s => s.includes('The Clock'))).toBe(true);

    playLiveFightToCompletion(screen, ['shape', 'color', 'number']);
    const reveals17 = stepThroughUnlockReveals(screen);
    expect(reveals17.some(r => r.includes('Immortal Aegis'))).toBe(true);
    // Second combo unlock does NOT repeat firstEvolution callout
    expect(reveals17.every(r => !r.includes('How Hidden Catalysts Work'))).toBe(true);

    // Check Camp Workshop: Hourglass IS now unlocked, Sharp Eyes & Second Wind still hidden!
    fireEvent.press(screen.getByTestId('results-camp'));
    fireEvent.press(screen.getByTestId('camp-tab-workshop'));
    expect(screen.getByTestId('camp-upgrade-hourglass')).toBeTruthy();
    expect(screen.queryByTestId('camp-upgrade-sharp_eyes')).toBeNull();
    expect(screen.queryByTestId('camp-upgrade-second_wind')).toBeNull();
    fireEvent.press(screen.getByLabelText('Back to map'));

    // Fight 1-8 Boss (Shell Shock) -> Unlocks Cross-Run Bounty Board!
    fireEvent.press(screen.getByTestId('map-node-1-8'));
    fireEvent.press(screen.getByTestId('preview-play'));
    completeLessonModal(screen, ['shape', 'color', 'number']);
    playLiveFightToCompletion(screen, ['shape', 'color', 'number']);

    const reveals18 = stepThroughUnlockReveals(screen, { preferSecondaryOnLast: true });
    expect(reveals18.some(r => r.includes('Bounty Board unlocked!'))).toBe(true);
    persisted = loadAdventureSave();
    expect(persisted.bountiesUnlocked).toBe(true);
    // Cumulative stats from 1-1..1-8 already cashed out cross-run bounties!
    expect(persisted.completedBounties.length).toBeGreaterThanOrEqual(2);
    expect(persisted.completedBounties).toContain('bounty_evolve_1');

    // Open Bounty Board directly from LevelResults -> test filters & claimed rows!
    fireEvent.press(screen.getByTestId('results-bounties'));
    expect(screen.getByText('BOUNTIES')).toBeTruthy();
    expect(screen.getAllByText('CLAIMED ✓').length).toBeGreaterThanOrEqual(2);
    fireEvent.press(screen.getByTestId('bounty-filter-chaos'));
    expect(screen.getByText('First Transmutation')).toBeTruthy();
    fireEvent.press(screen.getByTestId('bounty-filter-mastery'));
    expect(screen.getByText('Pattern Apprentice')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Back to map'));

    // Map Bounty dock is now enabled!
    expect(screen.getByTestId('map-dock-bounties').props.accessibilityState?.disabled).toBe(false);
  });

  it('shatters and loses the Catalyst for the rest of the fight if matched prematurely before priming', () => {
    let save = createNewSave();
    save = {
      ...save,
      coinsUnlocked: true,
      workshopUnlocked: true,
      selectedFighter: 'Orange Tabby',
      armory: ['life-vessel-rare'],
      charm: 'life-vessel-rare',
      unlockedEvolutions: ['immortal-aegis'],
      seenMechanics: ['set_rule', 'hearts', 'attr_number', 'power_cards', 'rainbow', 'purity_chain', 'weapon_evolutions'],
      seenCoachMarks: ['start_purity_chain'],
      stars: { '1-1': 3, '1-2': 3, '1-3': 3, '1-4': 3, '1-5': 3 },
    };

    const screen = render(wrap(<AdventureMode initialSave={save} onExit={() => {}} />));
    fireEvent.press(screen.getByTestId('map-node-1-6'));
    fireEvent.press(screen.getByTestId('preview-play'));
    dismissAllFightTips(screen);

    // Match 1 or 2 Sets until a dormant Catalyst card is part of a valid Set (before 3-Set streak primes Immortal Aegis)
    let matchedDormantCatalyst = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      dismissAllFightTips(screen);
      const board = readLiveBoard(screen);
      const validSets = findValidSetsOnBoard(board, ['shape', 'color', 'number']);
      const setWithDormant = validSets.find(s => s.some(c => c.hasCatalyst && !c.catalystReady));
      if (setWithDormant) {
        tapTripleOnBoard(setWithDormant);
        dismissAllFightTips(screen);
        matchedDormantCatalyst = true;
        break;
      }
      tapTripleOnBoard(validSets[0]);
      dismissAllFightTips(screen);
    }

    expect(matchedDormantCatalyst).toBe(true);
    // HUD chip immediately reports Catalyst Lost and zero Catalyst badges remain on the board!
    const evoChip = screen.getByTestId('run-evo-chip');
    expect(within(evoChip).getByText('Catalyst Lost')).toBeTruthy();
    expect(screen.queryAllByTestId('card-evolution-catalyst')).toHaveLength(0);
  });

  it('verifies Worlds 2, 3, and 4 live UI mechanics (Hints, Duds, Graces, XP Pick +tier, Waves, Shop, 5-Trait Final Boss) and 100% campaign completion (111/111 ★)', () => {
    // Seed a save that has completed World 1 and test World 2–4 milestone stages live in UI
    let base = createNewSave();
    for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '1-5E', '1-6', '1-7', '1-8', '1-8E']) {
      base = applyLevelResult(base, getLevel(id), 3, 25).save;
    }
    base = {
      ...base,
      coins: 1500,
      lifetimeCoins: 2000,
      weaponUpgrades: { 'blast-powder-common': 2 },
      charm: 'blast-powder-common',
    };

    const screen = render(wrap(<AdventureMode initialSave={base} onExit={() => {}} />));

    // ── 2-1 (Hints + Sharp Eyes Workshop unlock) ─────────────────────────────
    fireEvent.press(screen.getByTestId('map-node-2-1'));
    fireEvent.press(screen.getByTestId('preview-play'));
    completeLessonModal(screen, ['shape', 'color', 'number']);
    const run21 = playLiveFightToCompletion(screen, ['shape', 'color', 'number'], { useHintOnce: true });
    expect(run21.usedHint).toBe(true);
    stepThroughUnlockReveals(screen);
    fireEvent.press(screen.getByTestId('results-camp'));
    fireEvent.press(screen.getByTestId('camp-tab-workshop'));
    expect(screen.getByTestId('camp-upgrade-sharp_eyes')).toBeTruthy();
    expect(screen.queryByTestId('camp-upgrade-second_wind')).toBeNull();
    fireEvent.press(screen.getByLabelText('Back to map'));

    // Unmount and verify 2-4 (Graces -> Second Wind Workshop), 2-5 (XP Pick with +tier), 3-3 (Wave Shop), and 4-5 (Final Boss)!
    screen.unmount();

    let midSave = loadAdventureSave();
    for (const id of ['2-1', '2-2', '2-3']) {
      midSave = applyLevelResult(midSave, getLevel(id), 3, 30).save;
    }

    const screen2 = render(wrap(<AdventureMode initialSave={midSave} onExit={() => {}} />));

    // ── 2-4 (Graces -> unlocks 6th & final Mechanic Upgrade `Second Wind` + Badger + Vengeance Dynamo) ──
    fireEvent.press(screen2.getByTestId('map-node-2-4'));
    fireEvent.press(screen2.getByTestId('preview-play'));
    completeLessonModal(screen2, ['shape', 'color', 'number']);
    playLiveFightToCompletion(screen2, ['shape', 'color', 'number']);
    stepThroughUnlockReveals(screen2);
    fireEvent.press(screen2.getByTestId('results-camp'));
    fireEvent.press(screen2.getByTestId('camp-tab-workshop'));
    // All 6 mechanic upgrades are now unlocked in the Workshop!
    for (const u of UPGRADES) {
      expect(screen2.getByTestId(`camp-upgrade-${u.id}`)).toBeTruthy();
    }
    fireEvent.press(screen2.getByLabelText('Back to map'));

    // ── 2-5 (XP Level-Up `WeaponPick` modal showing upgraded Armory weapons!) ──
    fireEvent.press(screen2.getByTestId('map-node-2-5'));
    fireEvent.press(screen2.getByTestId('preview-play'));
    completeLessonModal(screen2, ['shape', 'color', 'number']);
    const run25 = playLiveFightToCompletion(screen2, ['shape', 'color', 'number']);
    expect(run25.pickedLevelUp).toBe(true);
    stepThroughUnlockReveals(screen2);
    screen2.unmount();

    // ── 3-3 (Multi-Wave + Between-Wave SHOP purchase!) ───────────────────────
    let canyonSave = loadAdventureSave();
    for (const id of ['2-6', '2-7', '2-8', '3-1', '3-2']) {
      canyonSave = applyLevelResult(canyonSave, getLevel(id), 3, 40).save;
    }
    const screen3 = render(wrap(<AdventureMode initialSave={canyonSave} onExit={() => {}} />));
    fireEvent.press(screen3.getByTestId('map-node-3-3'));
    fireEvent.press(screen3.getByTestId('preview-play'));
    completeLessonModal(screen3, ['shape', 'color', 'number', 'shading']);
    const run33 = playLiveFightToCompletion(screen3, ['shape', 'color', 'number', 'shading'], { buyInShop: true });
    expect(run33.visitedShop).toBe(true);
    stepThroughUnlockReveals(screen3);
    screen3.unmount();

    // ── 4-5 FINAL BOSS (`The Hydra` on 5-Trait 18-Card Board) + 100% 37-Stage Completion ──
    let fullSave = loadAdventureSave();
    for (const level of LEVELS) {
      if (level.id === '4-5') continue;
      fullSave = applyLevelResult(fullSave, level, 3, 50).save;
    }
    // Populate cross-run bounty stats from full campaign feats so all 16 bounties complete cleanly
    fullSave = {
      ...fullSave,
      selectedFighter: 'Orange Tabby',
      charm: null,
      activeArcana: 'overkill_harvest',
      discoveredEvolutions: EVOLUTION_RECIPES.map(r => r.id),
      bountyStats: {
        totalSets: 260,
        rainbowSets: 30,
        purityChains: 20,
        threeStepPurities: 5,
        flawlessTimedWins: 8,
        evolutionsForged: 8,
        maxOverkill: 14,
        destructiveFights: 12,
        fighterWins: {
          'Orange Tabby': 5,
          'Sly Fox': 6,
          Corgi: 5,
          Badger: 5,
          'Emperor Penguin': 5,
          Pelican: 5,
        },
      },
    };

    const screenFinal = render(wrap(<AdventureMode initialSave={fullSave} onExit={() => {}} />));
    fireEvent.press(screenFinal.getByTestId('map-node-4-5'));
    fireEvent.press(screenFinal.getByTestId('preview-play'));
    completeLessonModal(screenFinal, ['shape', 'color', 'number', 'shading', 'background']);
    // The Hydra's ★★★ stretch condition requires >= 10 flawless Sets before 44 HP hits 0
    playLiveFightToCompletion(screenFinal, ['shape', 'color', 'number', 'shading', 'background'], {
      preferRainbow: false,
    });
    stepThroughUnlockReveals(screenFinal);
    fireEvent.press(screenFinal.getByTestId('results-map'));

    // Reload from persistent KV storage in a brand-new <AdventureMode /> mount to prove 100% persistence!
    screenFinal.unmount();
    const completedSave = loadAdventureSave();

    expect(MAIN_LEVELS).toHaveLength(29);
    expect(LEVELS).toHaveLength(37);
    expect(totalStars(completedSave)).toBe(maxStars()); // 111 / 111 ★
    expect(completedSave.unlockedFighters).toHaveLength(FIGHTERS.length); // All 6 Fighters
    expect(completedSave.unlockedEvolutions).toHaveLength(EVOLUTION_RECIPES.length); // All 8 Evolutions
    expect(completedSave.unlockedArcana).toHaveLength(ARCANA.length); // All 8 Arcana
    expect(completedSave.completedBounties).toHaveLength(BOUNTIES.length); // All 16 Bounties

    const reloaded = render(wrap(<AdventureMode onExit={() => {}} />));
    expect(reloaded.getByText(`${maxStars()}/${maxStars()}`)).toBeTruthy();

    // Verify Camp Arcana tab has all 8 Arcana unlocked & toggleable
    fireEvent.press(reloaded.getByTestId('map-dock-camp'));
    fireEvent.press(reloaded.getByTestId('camp-tab-arcana'));
    for (const a of ARCANA) {
      expect(reloaded.getByText(a.name)).toBeTruthy();
    }
    fireEvent.press(reloaded.getByLabelText('Back to map'));

    // Verify Bounty Board shows 16/16 completed
    fireEvent.press(reloaded.getByTestId('map-dock-bounties'));
    expect(reloaded.getByText(`${BOUNTIES.length}/${BOUNTIES.length}`)).toBeTruthy();
    fireEvent.press(reloaded.getByLabelText('Back to map'));

    // Verify Field Guide -> Recipe Guide shows all 8/8 recipes forged
    fireEvent.press(reloaded.getByTestId('map-dock-guide'));
    fireEvent.press(reloaded.getByTestId('guide-tab-recipes'));
    expect(reloaded.getByText(`RECIPE GUIDE (${EVOLUTION_RECIPES.length}/${EVOLUTION_RECIPES.length})`)).toBeTruthy();
  });
});
