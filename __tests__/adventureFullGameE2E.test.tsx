/**
 * Full-game end-to-end suite for Adventure Mode.
 *
 * Mounts the real `<AdventureMode />` backed by an in-memory KV store and plays
 * the campaign through the UI by reading the rendered cards and tapping Sets:
 *   1. A fresh player through World 1: onboarding, every World 1 level (and the
 *      fighter side branch), unlock reveals, charms filling their slots, the first
 *      skill-tree node, the first evolution (banner + countdown ring), Time Bombs,
 *      the Workshop and the Bounty Board.
 *   2. Later worlds: snares on the board, waves and the shop, Charm Belt and Tarot
 *      Deck slots on the preview, chained side branches on the map, the Starfall
 *      Summit finale and a full-completion reload.
 *   3. A v1 save (fighter levels, one charm, one Arcana) migrating on load.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AdventureMode from '@/adventure/AdventureMode';
import { LEVELS, MAIN_LEVELS, getLevel } from '@/adventure/data/levels';
import { FIGHTERS, getFighter } from '@/adventure/data/fighters';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import { ARCANA } from '@/adventure/data/arcana';
import { BOUNTIES } from '@/adventure/data/bounties';
import { CAMPAIGN_FEATURES } from '@/adventure/data/features';
import { skillTreeOf } from '@/adventure/data/skillTrees';
import { starRewards } from '@/adventure/data/rewards';
import {
  applyLevelResult,
  availableStars,
  charmSlots,
  createNewSave,
  equippedCharms,
  maxStars,
  totalStarsEarned,
} from '@/adventure/progress';
import { loadAdventureSave } from '@/adventure/save';
import { createRng } from '@/adventure/engine/rng';
import { countDifferentAttributes } from '@/adventure/engine/sets';
import { isValidCombination } from '@/utils/gameUtils';
import type { AdventureSave, LevelDef } from '@/adventure/types';
import type { AttributeName, Background, Card, Color, Number as CardNumber, Shading, Shape } from '@/types';

const mockKvStore = new Map<string, string>();

// Plain functions, not jest.fn: a whole campaign makes thousands of these calls,
// and jest.fn keeps every call's arguments in memory (whole save JSON strings).
jest.mock('@/utils/storage', () => ({
  storage: {
    getString: (key: string) => mockKvStore.get(key),
    set: (key: string, val: string) => {
      mockKvStore.set(key, val);
    },
    remove: (key: string) => {
      mockKvStore.delete(key);
    },
  },
}));

jest.mock('@/audio', () => ({
  sfx: () => undefined,
  music: { play: () => undefined, stop: () => undefined },
  setMusicEnabled: () => undefined,
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
  const MockIcon = ({ name }: { name: string }) => ReactActual.createElement(View, { accessibilityLabel: `icon-${name}` });
  return { __esModule: true, default: MockIcon, Icon: MockIcon };
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
    { __esModule: true, default: SvgRoot, Svg: SvgRoot } as Record<string, any>,
    {
      // One mock per element name, so re-renders keep component identity instead of remounting
      get(target, prop: string) {
        if (!(prop in target)) target[prop] = makeSvgMock(String(prop));
        return target[prop];
      },
    }
  );
});

const INSETS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const wrap = (ui: React.ReactElement) => <SafeAreaProvider initialMetrics={INSETS}>{ui}</SafeAreaProvider>;

type Screen = ReturnType<typeof render>;

// ─── Reading the rendered board ─────────────────────────────────────────────

interface Slot {
  slotId: string;
  row: number;
  col: number;
  pressable: any;
  card: Card;
  disabled: boolean;
  catalyst: boolean;
  bomb: boolean;
  snare: 'up' | 'down' | 'left' | 'right' | null;
}

const CARD_LABEL_RE =
  /^(1|2|3) (red|green|purple) (solid|striped|open) (oval|squiggle|diamond)(?: on (white|beige|charcoal))?(.*)$/;

function collectTreeText(node: any): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(collectTreeText).join(' ');
  if (typeof node === 'object' && Array.isArray(node.children)) return node.children.map(collectTreeText).join(' ');
  return '';
}

function findNodesWithProp(node: any, pred: (n: any) => boolean, out: any[] = []): any[] {
  if (!node || typeof node !== 'object') return out;
  if (pred(node)) out.push(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) if (typeof child === 'object') findNodesWithProp(child, pred, out);
  }
  return out;
}

function readLiveBoard(screen: Screen): Slot[] {
  const results: Slot[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 3; c++) {
      const slot = screen.queryByTestId(`card-slot-${r}-${c}`);
      if (!slot) continue;
      const pressable = findNodesWithProp(
        slot,
        n => typeof n.props?.accessibilityLabel === 'string' && CARD_LABEL_RE.test(n.props.accessibilityLabel)
      )[0];
      if (!pressable) continue;
      const m = CARD_LABEL_RE.exec(pressable.props.accessibilityLabel as string)!;
      const tail = m[6] ?? '';
      const isDud = tail.includes(', dud');
      const isFaceDown = tail.includes(', face down');
      const snare = /, snare pointing (up|down|left|right)/.exec(tail)?.[1] as Slot['snare'] | undefined;
      results.push({
        slotId: `card-slot-${r}-${c}`,
        row: r,
        col: c,
        pressable,
        disabled: Boolean(pressable.props?.disabled || pressable.props?.accessibilityState?.disabled || isDud || isFaceDown),
        catalyst: tail.includes(', evolution ready') || tail.includes(', dormant catalyst'),
        bomb: String(pressable.props?.testID ?? '').includes('-countdown'),
        snare: snare ?? null,
        card: {
          id: `card-slot-${r}-${c}`,
          number: Number(m[1]) as CardNumber,
          color: m[2] as Color,
          shading: m[3] as Shading,
          shape: m[4] as Shape,
          background: (m[5] as Background | undefined) ?? 'white',
          selected: false,
          isDud,
          isFaceDown,
        },
      });
    }
  }
  return results;
}

/** Slots a snare's arrow points at (matching one of them defuses it). */
const snareTargets = (board: Slot[]): Set<string> => {
  const out = new Set<string>();
  for (const s of board) {
    if (!s.snare) continue;
    const [dr, dc] = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[s.snare];
    out.add(`card-slot-${s.row + dr}-${s.col + dc}`);
  }
  return out;
};

function findValidSets(board: Slot[], attrs: AttributeName[]): Slot[][] {
  const selectable = board.filter(s => !s.disabled);
  const sets: Slot[][] = [];
  for (let i = 0; i < selectable.length - 2; i++) {
    for (let j = i + 1; j < selectable.length - 1; j++) {
      for (let k = j + 1; k < selectable.length; k++) {
        const triple = [selectable[i], selectable[j], selectable[k]];
        if (isValidCombination(triple.map(t => t.card), attrs).isValid) sets.push(triple);
      }
    }
  }
  return sets;
}

/** A sensible player: Catalysts first, then bombs and snare defusals, never a snared card, then Rainbows. */
const scoreSet = (set: Slot[], attrs: AttributeName[], targets: Set<string>): number =>
  (set.some(s => s.catalyst) ? 1000 : 0) +
  (set.some(s => s.bomb) ? 300 : 0) +
  (set.some(s => targets.has(s.slotId)) ? 200 : 0) -
  (set.some(s => s.snare) ? 500 : 0) +
  countDifferentAttributes(set.map(s => s.card), attrs);

function advanceMs(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
  // React Native's preset mocks (e.g. setNativeProps, which Reanimated calls on every
  // animation frame) record every call; nothing here reads them, so drop the history
  // or a whole campaign runs out of memory.
  jest.clearAllMocks();
}

function tapSet(set: Slot[]) {
  for (const s of set) fireEvent.press(s.pressable);
  // 200ms GameBoard validation → 950ms REPLACE → reward reveal
  advanceMs(250);
  advanceMs(1000);
  advanceMs(600);
}

const atResults = (screen: Screen) => !!screen.queryByTestId('results-map');

/** Step through lesson pages and "Is this a Set?" checks, answering correctly. Returns the text seen. */
function completeLessons(screen: Screen, attrs: AttributeName[]): string[] {
  const seen: string[] = [];
  let guard = 0;
  while ((screen.queryByTestId('mechanic-intro-ok') || screen.queryByTestId('quiz-yes')) && guard++ < 40) {
    const modal = screen.queryByTestId('lesson-modal');
    if (modal) seen.push(collectTreeText(modal));
    if (screen.queryByTestId('quiz-yes')) {
      const demo = modal
        ? findNodesWithProp(modal, n => typeof n.props?.accessibilityLabel === 'string' && CARD_LABEL_RE.test(n.props.accessibilityLabel))
        : [];
      let yes = true;
      if (demo.length >= 3) {
        const cards: Card[] = demo.slice(-3).map((n, i) => {
          const m = CARD_LABEL_RE.exec(n.props.accessibilityLabel)!;
          return {
            id: `q-${i}`,
            number: Number(m[1]) as CardNumber,
            color: m[2] as Color,
            shading: m[3] as Shading,
            shape: m[4] as Shape,
            background: (m[5] as Background | undefined) ?? 'white',
            selected: false,
          };
        });
        yes = isValidCombination(cards, attrs).isValid;
      }
      fireEvent.press(screen.getByTestId(yes ? 'quiz-yes' : 'quiz-no'));
      const after = screen.queryByTestId('lesson-modal');
      if (after) seen.push(collectTreeText(after));
    }
    if (screen.queryByTestId('mechanic-intro-ok')) fireEvent.press(screen.getByTestId('mechanic-intro-ok'));
  }
  return seen;
}

interface FightLog {
  sawEvolutionBanner: boolean;
  sawEvolutionRing: boolean;
  sawSnare: boolean;
  sawBomb: boolean;
  sawPassiveChip: boolean;
  sawTotalDamage: boolean;
  pickedLevelUp: boolean;
  boughtInShop: boolean;
  tips: number;
}

/** Play a fight to the results screen by tapping rendered cards. */
function playFight(screen: Screen, attrs: AttributeName[], opts: { buyInShop?: boolean; maxSteps?: number } = {}): FightLog {
  const log: FightLog = {
    sawEvolutionBanner: false,
    sawEvolutionRing: false,
    sawSnare: false,
    sawBomb: false,
    sawPassiveChip: false,
    sawTotalDamage: false,
    pickedLevelUp: false,
    boughtInShop: false,
    tips: 0,
  };
  const look = () => {
    log.sawEvolutionBanner ||= !!screen.queryByTestId('evolution-banner');
    log.sawEvolutionRing ||= screen.queryAllByTestId('evolution-ring').length > 0;
    log.sawPassiveChip ||= screen.queryAllByTestId(/^run-passive-/).length > 0;
    log.sawTotalDamage ||= !!screen.queryByTestId('run-total-damage');
  };
  const tips = () => {
    while (screen.queryByTestId('tip-ok') && log.tips < 60) {
      fireEvent.press(screen.getByTestId('tip-ok'));
      log.tips += 1;
    }
  };
  tips();
  for (let step = 0; step < (opts.maxSteps ?? 80); step++) {
    tips();
    look();
    if (screen.queryByTestId('pick-0')) {
      log.pickedLevelUp = true;
      fireEvent.press(screen.getByTestId('pick-0'));
      tips();
    }
    if (screen.queryByTestId('next-wave')) {
      if (opts.buyInShop && screen.queryByTestId('shop-buy-0')) {
        log.boughtInShop = true;
        fireEvent.press(screen.getByTestId('shop-buy-0'));
      }
      fireEvent.press(screen.getByTestId('next-wave'));
      tips();
    }
    if (atResults(screen)) break;
    const board = readLiveBoard(screen);
    expect(screen.queryAllByTestId('card-evolution-catalyst').length).toBeLessThanOrEqual(1);
    log.sawSnare ||= board.some(s => s.snare);
    log.sawBomb ||= board.some(s => s.bomb);
    const sets = findValidSets(board, attrs);
    if (board.length === 0 || sets.length === 0) {
      advanceMs(1000);
      continue;
    }
    const targets = snareTargets(board);
    const best = [...sets].sort((a, b) => scoreSet(b, attrs, targets) - scoreSet(a, attrs, targets))[0];
    tapSet(best);
    look();
    tips();
    if (atResults(screen)) break;
  }
  if (!atResults(screen)) advanceMs(2000);
  expect(screen.getByTestId('results-map')).toBeTruthy();
  return log;
}

/** Tap through every queued unlock reveal; returns the text of each revealed card. */
function stepThroughReveals(screen: Screen, opts: { stayOnResults?: boolean } = {}): string[] {
  advanceMs(2600);
  const texts: string[] = [];
  let guard = 0;
  while (screen.queryByTestId('unlock-reveal') && guard++ < 15) {
    fireEvent.press(screen.getByTestId('unlock-reveal'));
    const modal = screen.queryByTestId('unlock-modal');
    texts.push(modal ? collectTreeText(modal) : '');
    if (opts.stayOnResults && screen.queryByText('Stay on results')) fireEvent.press(screen.getByText('Stay on results'));
    else fireEvent.press(screen.getByTestId('unlock-primary'));
  }
  return texts;
}

/** Open a level from the map, sit through its lessons and play it (retrying a loss). Ends on results. */
function playLevelFromMap(screen: Screen, level: LevelDef, opts: { buyInShop?: boolean; stayOnResults?: boolean } = {}) {
  fireEvent.press(screen.getByTestId(`map-node-${level.id}`));
  return playOpenPreview(screen, level, opts);
}

function playOpenPreview(screen: Screen, level: LevelDef, opts: { buyInShop?: boolean; stayOnResults?: boolean } = {}) {
  fireEvent.press(screen.getByTestId('preview-play'));
  const lessons = completeLessons(screen, level.rules.attributes);
  let fight = playFight(screen, level.rules.attributes, opts);
  let reveals = stepThroughReveals(screen, opts);
  for (let attempt = 0; attempt < 3 && (loadAdventureSave().stars[level.id] ?? 0) === 0; attempt++) {
    fireEvent.press(screen.getByTestId('results-retry'));
    completeLessons(screen, level.rules.attributes);
    fight = playFight(screen, level.rules.attributes, opts);
    reveals = [...reveals, ...stepThroughReveals(screen, opts)];
  }
  expect(loadAdventureSave().stars[level.id] ?? 0).toBeGreaterThan(0);
  return { lessons, fight, reveals };
}

const backToMap = (screen: Screen) => fireEvent.press(screen.getByTestId('results-map'));

// A whole campaign of (deliberately long) fights, played through the UI
jest.setTimeout(480_000);

describe('Adventure Mode full-game E2E', () => {
  const realRandom = Math.random;

  beforeEach(() => {
    jest.useFakeTimers();
    mockKvStore.clear();
    const prng = createRng(20261112);
    // Assigned directly rather than spied: a spy records every returned number
    Math.random = () => prng.next();
  });

  afterEach(() => {
    Math.random = realRandom;
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('drives a fresh player through all of World 1: unlocks, charms, the skill tree, the first evolution, Time Bombs, Workshop and Bounties', () => {
    const screen = render(wrap(<AdventureMode onExit={() => {}} />));
    const world1 = MAIN_LEVELS.filter(l => l.biome === 'meadow');
    const first = world1[0];

    // ── Onboarding and the bare first level ──────────────────────────────
    const onboarding = completeLessons(screen, first.rules.attributes);
    expect(onboarding.some(t => t.includes('Is this a Set?'))).toBe(true);
    // Bare level: no passives, no hint button, no evolution chip
    expect(screen.queryAllByTestId(/^run-passive-/)).toHaveLength(0);
    expect(screen.queryByTestId('run-hint')).toBeNull();
    expect(screen.queryByTestId('run-evo-chip')).toBeNull();
    const fight1 = playFight(screen, first.rules.attributes);
    expect(fight1.sawTotalDamage).toBe(true);
    expect(screen.getByTestId('results-total-damage')).toBeTruthy();
    expect(screen.getByTestId('results-biggest-hit')).toBeTruthy();
    stepThroughReveals(screen);

    let save = loadAdventureSave();
    const firstWeapons = starRewards(first).slice(0, save.stars[first.id]).flatMap(r => r.weapons ?? []);
    expect(save.armory).toEqual(firstWeapons);
    // Won weapons go straight into the free charm slots
    expect(equippedCharms(save)).toEqual(firstWeapons);
    expect(save.fighterLevels).toEqual({});

    // ── Camp: the skill tree spends the first stars ──────────────────────
    backToMap(screen);
    expect(screen.getByTestId('map-dock-camp').props.accessibilityState?.disabled).toBe(false);
    fireEvent.press(screen.getByTestId('map-dock-camp'));
    expect(screen.getByText('🔒 WORKSHOP')).toBeTruthy();
    const tabby = getFighter(save.selectedFighter);
    fireEvent.press(screen.getByTestId(`camp-open-tree-${tabby.name}`));
    const root = skillTreeOf(tabby.name).find(n => n.branch === 0 && n.depth === 1)!;
    const starsBefore = availableStars(save);
    expect(starsBefore).toBeGreaterThanOrEqual(root.cost);
    fireEvent.press(screen.getByTestId(`skill-node-${root.id}`));
    fireEvent.press(screen.getByTestId('skill-buy'));
    save = loadAdventureSave();
    expect(save.skillNodes[tabby.name]).toEqual([root.id]);
    expect(availableStars(save)).toBe(starsBefore - root.cost);
    expect(totalStarsEarned(save)).toBe(save.stars[first.id]);
    fireEvent.press(screen.getByTestId('skill-tree-back'));
    fireEvent.press(screen.getByLabelText('Back to map'));

    // ── The rest of World 1 ──────────────────────────────────────────────
    const firstRecipeLevel = world1.find(l => starRewards(l).some(r => r.evolution))!;
    let sawEvolution = false;
    let sawBombs = false;
    for (const level of world1.slice(1)) {
      fireEvent.press(screen.getByTestId(`map-node-${level.id}`));
      save = loadAdventureSave();
      // Preview: the fighter's passives and the charm slots, filled with what was won so far
      expect(screen.getByTestId('preview-passives')).toBeTruthy();
      expect(screen.getByTestId('preview-charm-slots')).toBeTruthy();
      expect(screen.getByTestId(`preview-slot-${charmSlots(save) - 1}`)).toBeTruthy();
      if (level.rules.hazards) expect(screen.getByTestId('preview-hazards')).toBeTruthy();
      const armed = save.unlockedEvolutions.length > 0 && EVOLUTION_RECIPES.some(
        r => save.unlockedEvolutions.includes(r.id) && r.families.every(f => equippedCharms(save).some(id => f.some(p => id === p || id.startsWith(`${p}-`))))
      );
      if (armed) expect(screen.getByText(/evolutions? armed/)).toBeTruthy();

      const { lessons, fight, reveals } = playOpenPreview(screen, level, { stayOnResults: true });
      if (level.id === firstRecipeLevel.id) {
        expect(lessons.some(t => t.includes('First Evolution'))).toBe(true);
        expect(reveals.some(t => t.includes('New evolution unlocked!'))).toBe(true);
      }
      expect(fight.sawPassiveChip).toBe(true);
      sawEvolution ||= fight.sawEvolutionBanner || fight.sawEvolutionRing;
      sawBombs ||= fight.sawBomb;
      if (fight.sawEvolutionBanner || fight.sawEvolutionRing) expect(screen.getByTestId('results-evolutions')).toBeTruthy();

      save = loadAdventureSave();
      // The Workshop opens partway through the world: buy and refund a weapon upgrade at 100%
      if (save.workshopUnlocked && !(save.weaponUpgrades[save.armory[0]] > 0) && save.coins >= 80 && level.id === LEVELS.find(l => starRewards(l).some(r => r.unlockFeature === 'workshop'))?.id) {
        fireEvent.press(screen.getByTestId('results-camp'));
        fireEvent.press(screen.getByTestId('camp-tab-workshop'));
        const coins = loadAdventureSave().coins;
        fireEvent.press(screen.getByTestId(`camp-buy-weapon-${save.armory[0]}`));
        expect(loadAdventureSave().coins).toBeLessThan(coins);
        fireEvent.press(screen.getByTestId(`camp-refund-weapon-${save.armory[0]}`));
        expect(loadAdventureSave().coins).toBe(coins);
        fireEvent.press(screen.getByLabelText('Back to map'));
      } else {
        backToMap(screen);
      }
    }

    save = loadAdventureSave();
    expect(sawEvolution).toBe(true);
    expect(save.discoveredEvolutions.length).toBeGreaterThan(0);
    expect(sawBombs).toBe(true);
    expect(save.workshopUnlocked).toBe(true);
    expect(save.bountiesUnlocked).toBe(!!CAMPAIGN_FEATURES.bounties.clearLevel && (save.stars[CAMPAIGN_FEATURES.bounties.clearLevel] ?? 0) > 0);
    expect(screen.getByTestId('map-dock-bounties').props.accessibilityState?.disabled).toBe(!save.bountiesUnlocked);

    // ── The fighter side branch opens at ★★ on its parent ───────────────
    const branch = LEVELS.find(l => l.branchOf && getLevel(l.branchOf).biome === 'meadow');
    if (branch && (save.stars[branch.branchOf!] ?? 0) >= 2) {
      const before = save.unlockedFighters.length;
      playLevelFromMap(screen, branch, { stayOnResults: true });
      backToMap(screen);
      const reward = starRewards(branch).some(r => r.character);
      if (reward) expect(loadAdventureSave().unlockedFighters.length).toBeGreaterThan(before);
    }

    // ── Recipe Guide shows the evolved recipe ────────────────────────────
    fireEvent.press(screen.getByTestId('map-dock-guide'));
    fireEvent.press(screen.getByTestId('guide-tab-recipes'));
    expect(screen.getAllByText(/EVOLVED BEFORE/).length).toBeGreaterThan(0);
    fireEvent.press(screen.getByLabelText('Back to map'));
  });

  it('plays World 2–5 landmarks: snares, waves and the shop, bigger loadouts, chained branches and the Summit finale, then reloads a completed campaign', () => {
    // Everything before a level: 3★ on every earlier main level and the branches hanging off them
    const rootOf = (l: LevelDef): LevelDef => (l.branchOf ? rootOf(getLevel(l.branchOf)) : l);
    const saveBefore = (target: LevelDef, extra: Partial<AdventureSave> = {}): AdventureSave => {
      let s = createNewSave();
      for (const l of LEVELS) {
        if (MAIN_LEVELS.indexOf(rootOf(l)) < MAIN_LEVELS.indexOf(target)) s = applyLevelResult(s, l, 3, 40).save;
      }
      const seen = LEVELS.filter(l => (s.stars[l.id] ?? 0) > 0).map(l => l.introduces);
      return { ...s, seenMechanics: [...new Set([...s.seenMechanics, ...seen])], ...extra };
    };

    // ── Snares on the board ──────────────────────────────────────────────
    const snareLevel = MAIN_LEVELS.find(l => l.rules.hazards?.snares)!;
    mockKvStore.clear();
    let screen = render(wrap(<AdventureMode initialSave={saveBefore(snareLevel)} onExit={() => {}} />));
    fireEvent.press(screen.getByTestId(`map-node-${snareLevel.id}`));
    expect(screen.getByTestId('preview-hazards')).toBeTruthy();
    const snareRun = playOpenPreview(screen, snareLevel);
    expect(snareRun.fight.sawSnare).toBe(true);
    screen.unmount();

    // ── Waves and the shop ───────────────────────────────────────────────
    const shopLevel = MAIN_LEVELS.find(l => l.introduces === 'shop') ?? MAIN_LEVELS.find(l => l.foes.length > 1)!;
    screen = render(wrap(<AdventureMode initialSave={saveBefore(shopLevel, { coins: 2000 })} onExit={() => {}} />));
    const shopRun = playLevelFromMap(screen, shopLevel, { buyInShop: true });
    if (shopLevel.foes.length > 1 && shopLevel.introduces === 'shop') expect(shopRun.fight.boughtInShop).toBe(true);
    screen.unmount();

    // ── Charm Belt and Tarot Deck grow the preview's slots ───────────────
    const late = MAIN_LEVELS.find(l => l.biome === 'peaks')!;
    const rich = saveBefore(late, { coins: 20000 });
    screen = render(wrap(<AdventureMode initialSave={rich} onExit={() => {}} />));
    fireEvent.press(screen.getByTestId('map-dock-camp'));
    fireEvent.press(screen.getByTestId('camp-tab-workshop'));
    fireEvent.press(screen.getByTestId('camp-buy-upgrade-charm_belt'));
    if (rich.unlockedArcana.length >= 2) fireEvent.press(screen.getByTestId('camp-buy-upgrade-tarot_deck'));
    fireEvent.press(screen.getByLabelText('Back to map'));
    fireEvent.press(screen.getByTestId(`map-node-${late.id}`));
    expect(screen.getByTestId('preview-slot-3')).toBeTruthy();
    expect(screen.queryByTestId('preview-slot-4')).toBeNull();
    fireEvent.press(screen.getByText('✕'));

    // ── Branches that chain off branches are on the map ──────────────────
    const chained = LEVELS.find(l => l.branchOf && getLevel(l.branchOf).branchOf);
    if (chained) expect(screen.getByTestId(`map-node-${chained.id}`)).toBeTruthy();
    screen.unmount();

    // ── The Summit finale ────────────────────────────────────────────────
    const finale = MAIN_LEVELS[MAIN_LEVELS.length - 1];
    expect(finale.biome).toBe('summit');
    let full = createNewSave();
    for (const l of LEVELS) if (l.id !== finale.id) full = applyLevelResult(full, l, 3, 50).save;
    full = {
      ...full,
      seenMechanics: LEVELS.map(l => l.introduces),
      discoveredEvolutions: EVOLUTION_RECIPES.map(r => r.id),
      bountyStats: {
        totalSets: 100000,
        rainbowSets: 10000,
        purityChains: 10000,
        threeStepPurities: 10000,
        flawlessTimedWins: 1000,
        evolutionsForged: 1000,
        maxOverkill: 1000,
        destructiveFights: 1000,
        trapsDefused: 1000,
        biggestHit: 1000,
        fighterWins: Object.fromEntries(FIGHTERS.map(f => [f.name, 100])),
      },
    };
    screen = render(wrap(<AdventureMode initialSave={full} onExit={() => {}} />));
    fireEvent.press(screen.getByTestId(`map-node-${finale.id}`));
    fireEvent.press(screen.getByTestId('preview-play'));
    completeLessons(screen, finale.rules.attributes);
    playFight(screen, finale.rules.attributes, { maxSteps: 120 });
    stepThroughReveals(screen);
    // A finale that ends short of ★★★ is completed here so the reload checks a finished campaign
    const after = loadAdventureSave();
    if ((after.stars[finale.id] ?? 0) < 3) mockKvStore.set('adventure_v2_save', JSON.stringify(applyLevelResult(after, finale, 3, 0).save));
    screen.unmount();

    const done = loadAdventureSave();
    expect(totalStarsEarned(done)).toBe(maxStars());
    expect(done.unlockedFighters).toHaveLength(FIGHTERS.length);
    expect(done.unlockedEvolutions).toHaveLength(EVOLUTION_RECIPES.length);
    expect(done.unlockedArcana).toHaveLength(ARCANA.length);
    expect(done.completedBounties).toHaveLength(BOUNTIES.length);

    const reloaded = render(wrap(<AdventureMode onExit={() => {}} />));
    expect(reloaded.getByText(`${maxStars()}/${maxStars()}`)).toBeTruthy();
    fireEvent.press(reloaded.getByTestId('map-dock-guide'));
    fireEvent.press(reloaded.getByTestId('guide-tab-recipes'));
    expect(reloaded.getByText(`RECIPES (${EVOLUTION_RECIPES.length}/${EVOLUTION_RECIPES.length})`)).toBeTruthy();
    fireEvent.press(reloaded.getByLabelText('Back to map'));
    fireEvent.press(reloaded.getByTestId('map-dock-camp'));
    fireEvent.press(reloaded.getByTestId('camp-tab-arcana'));
    for (const a of ARCANA) expect(reloaded.getByText(a.name)).toBeTruthy();
  });

  it('migrates a v1 save on load: fighter levels refunded, the single charm and Arcana moved into slots', () => {
    let v1 = createNewSave();
    for (const l of MAIN_LEVELS.slice(0, 3)) v1 = applyLevelResult(v1, l, 3, 0).save;
    const charm = v1.armory[0];
    const stored = {
      ...v1,
      coins: 500,
      fighterLevels: { 'Orange Tabby': 3 },
      charm,
      activeArcana: null,
      unlockedArcana: [ARCANA[0].id],
    } as Record<string, unknown>;
    delete stored.charms;
    delete stored.equippedArcana;
    delete stored.skillNodes;
    stored.activeArcana = ARCANA[0].id;
    mockKvStore.set('adventure_v2_save', JSON.stringify(stored));

    const screen = render(wrap(<AdventureMode onExit={() => {}} />));
    const migrated = loadAdventureSave();
    expect(migrated.coins).toBe(500 + 60 + 120);
    expect(migrated.fighterLevels).toEqual({});
    expect(migrated.charms[0]).toBe(charm);
    expect(migrated.equippedArcana).toEqual([ARCANA[0].id]);

    fireEvent.press(screen.getByTestId(`map-node-${MAIN_LEVELS[3].id}`));
    expect(screen.getByTestId('preview-slot-0')).toBeTruthy();
    expect(screen.getByTestId(`charm-${charm}`).props.accessibilityState?.selected).toBe(true);
  });
});
