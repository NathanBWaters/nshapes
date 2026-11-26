/**
 * Unit & UI integration tests for:
 *  - [GP-24] Free Play Daily 3-Min Score Attack & Zen Endless personal-best persistence
 *  - [TP-19] Deterministic daily seeds, Daily Starfall Summit mutators, GSP-style
 *            percentile framing, spoiler-free Share Cards, and standardized URL routing
 */
import React from 'react';
import { act, fireEvent, render, cleanup } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TutorialProvider } from '@/context/TutorialContext';
import { KeywordProvider } from '@/context/KeywordContext';
import Game from '@/components/Game';
import FreePlayMode, { dealDeterministicFreePlayBoard, formatSprintTime } from '@/components/FreePlayMode';
import {
  buildAdventureShareUrl,
  buildFreePlayShareUrl,
  buildSummitShareUrl,
  computeSummitRating,
  dailySeedFor,
  diffUtcDays,
  evaluateFreePlayDaily,
  formatAdventureShareCard,
  formatFreePlayDailyShareCard,
  getDailySummitConfig,
  isValidDateKey,
  parseNumericSeed,
  parseShareUrlParams,
  SUMMIT_DAILY_MUTATORS,
} from '@/adventure/dailySeed';
import { createNewSave } from '@/adventure/progress';
import { writeAdventureSave } from '@/adventure/save';
import { createDailySpireRun, createSpireRun } from '@/spire/engine/runState';
import { computeSpireRating, formatSpireShareCard } from '@/spire/engine/share';
import { loadSpireMeta, recordSpireRunEnd, resetSpireStorage } from '@/spire/save';
import { FreePlayDifficultyStorage, FreePlayRecordsStorage, LabsStorage } from '@/utils/freePlayStorage';
import { findAllCombinations } from '@/utils/gameUtils';
import { getPerfSnapshot } from '@/utils/perfWatchdog';
import { storage } from '@/utils/storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

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
      get(target, prop: string) {
        if (!(prop in target)) target[prop] = makeSvgMock(String(prop));
        return target[prop];
      },
    }
  );
});

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const MockIcon = ({ name }: { name: string }) =>
    ReactActual.createElement(View, { accessibilityLabel: `icon-${name}` });
  return { __esModule: true, default: MockIcon, Icon: MockIcon };
});

jest.mock('@/audio', () => {
  const band = new Proxy({}, { get: (_t, key) => (key === 'inFight' ? false : () => undefined) });
  return {
    sfx: () => undefined,
    music: band,
    band,
    setMusicEnabled: () => undefined,
    setSfxOverride: () => undefined,
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

const SAFE_METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const renderWrapped = async (ui: React.ReactElement) => {
  const screen = render(
    <SafeAreaProvider initialMetrics={SAFE_METRICS}>
      <KeywordProvider>
        <TutorialProvider>{ui}</TutorialProvider>
      </KeywordProvider>
    </SafeAreaProvider>
  );
  await act(async () => {
    await Promise.resolve();
  });
  return screen;
};

describe('[GP-24] & [TP-19] Daily Seeds, Free Play Score Attack, Share Cards & URL Routing', () => {
  beforeEach(() => {
    storage.clearAll();
    resetSpireStorage();
    FreePlayDifficultyStorage.clear();
    FreePlayRecordsStorage.clear();
    LabsStorage.clear();
    writeAdventureSave(createNewSave());
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  describe('Deterministic Daily Seeds & Standardized Shareable URLs', () => {
    it('validates real UTC calendar dates and produces identical positive seeds per scope/date', () => {
      expect(isValidDateKey('2026-11-26')).toBe(true);
      expect(isValidDateKey('2024-02-29')).toBe(true);
      expect(isValidDateKey('2026-02-29')).toBe(false);
      expect(isValidDateKey('2026-13-01')).toBe(false);
      expect(isValidDateKey('not-a-date')).toBe(false);
      expect(diffUtcDays('2026-11-25', '2026-11-26')).toBe(1);
      expect(diffUtcDays('2026-11-26', '2026-11-28')).toBe(2);

      const fp1 = dailySeedFor('freeplay', '2026-11-26');
      const fp2 = dailySeedFor('freeplay', '2026-11-26');
      const summit = dailySeedFor('summit', '2026-11-26');
      const nextDay = dailySeedFor('freeplay', '2026-11-27');

      expect(fp1).toBe(fp2);
      expect(fp1).toBeGreaterThan(0);
      expect(summit).not.toBe(fp1);
      expect(nextDay).not.toBe(fp1);
      expect(parseNumericSeed('4242')).toBe(4242);
      expect(parseNumericSeed('STAR77')).toBe(parseNumericSeed('star77'));
    });

    it('builds and parses standardized ?mode=summit, ?mode=adventure, and ?mode=freeplay seed URLs', () => {
      const summitDailyUrl = buildSummitShareUrl({ seed: 98765, dailyDate: '2026-11-26' });
      expect(summitDailyUrl).toContain('?mode=summit&seed=98765&daily=2026-11-26');
      expect(parseShareUrlParams(summitDailyUrl)).toEqual({
        mode: 'summit',
        seedRaw: '98765',
        seedNumeric: 98765,
        daily: true,
        dailyDate: '2026-11-26',
      });

      const summitCustomUrl = buildSummitShareUrl({
        seed: 4242,
        fighter: 'Badger',
        ascension: 7,
      });
      expect(summitCustomUrl).toContain('?mode=summit&seed=4242&fighter=Badger&asc=7');
      expect(parseShareUrlParams(summitCustomUrl)).toEqual({
        mode: 'summit',
        seedRaw: '4242',
        seedNumeric: 4242,
        fighter: 'Badger',
        ascension: 7,
      });

      const advUrl = buildAdventureShareUrl({ levelId: '2-4', seed: 1337 });
      expect(advUrl).toContain('?mode=adventure&level=2-4&seed=1337');
      expect(parseShareUrlParams(advUrl)).toEqual({
        mode: 'adventure',
        levelId: '2-4',
        seedRaw: '1337',
        seedNumeric: 1337,
      });

      const fpUrl = buildFreePlayShareUrl({ dailyDate: '2026-11-26' });
      expect(fpUrl).toContain('?mode=freeplay&daily=2026-11-26');
      expect(parseShareUrlParams(fpUrl)).toEqual({
        mode: 'freeplay',
        daily: true,
        dailyDate: '2026-11-26',
      });
    });

    it('deals bit-identical deterministic Free Play Daily decks for the same UTC date with ≥1 valid Set', () => {
      const seed = dailySeedFor('freeplay', '2026-11-26');
      const attrs = ['shape', 'color', 'number'] as const;
      const a = dealDeterministicFreePlayBoard([...attrs], 12, seed);
      const b = dealDeterministicFreePlayBoard([...attrs], 12, seed);

      expect(a.board).toHaveLength(12);
      expect(findAllCombinations(a.board, [...attrs]).length).toBeGreaterThanOrEqual(1);
      // Exact same card attributes in exact same order on board and draw deck
      expect(a.board.map(c => `${c.shape}|${c.color}|${c.number}`)).toEqual(
        b.board.map(c => `${c.shape}|${c.color}|${c.number}`)
      );
      expect(a.deck.map(c => `${c.shape}|${c.color}|${c.number}`)).toEqual(
        b.deck.map(c => `${c.shape}|${c.color}|${c.number}`)
      );
    });
  });

  describe('[GP-24] Free Play Medals, Pattern Power Percentile, Persistence & UI', () => {
    it('awards Bronze / Silver / Gold / Starfall medals and positive GSP-style Pattern Power framing', () => {
      const none = evaluateFreePlayDaily({ sets: 5, mistakes: 2, elapsedSec: 180, bestStreak: 3 });
      const bronze = evaluateFreePlayDaily({ sets: 10, mistakes: 1, elapsedSec: 180, bestStreak: 5 });
      const silver = evaluateFreePlayDaily({ sets: 18, mistakes: 0, elapsedSec: 180, bestStreak: 18 });
      const gold = evaluateFreePlayDaily({ sets: 28, mistakes: 0, elapsedSec: 180, bestStreak: 28 });
      const starfall = evaluateFreePlayDaily({ sets: 38, mistakes: 0, elapsedSec: 180, bestStreak: 38 });

      expect(none.medal).toBe('none');
      expect(bronze.medal).toBe('bronze');
      expect(silver.medal).toBe('silver');
      expect(gold.medal).toBe('gold');
      expect(starfall.medal).toBe('starfall');
      expect(gold.setsPerMin).toBeCloseTo(9.3, 1);
      expect(starfall.percentile).toBeGreaterThan(gold.percentile);
      expect(gold.percentile).toBeGreaterThan(bronze.percentile);
      expect(none.percentile).toBeGreaterThanOrEqual(5);
      expect(starfall.percentile).toBeLessThanOrEqual(99);
      expect(gold.framingLine).toContain('Pattern Power:');
      expect(gold.framingLine).toContain('Sharper than');
      expect(gold.framingLine).not.toMatch(/Rank #/i);

      const card = formatFreePlayDailyShareCard({ dateKey: '2026-11-26', evaluation: gold });
      expect(card).toContain('Daily Meadow · 2026-11-26 · 28 Sets · 9.3/min · 0 Mistakes');
      expect(card).toContain('Gold');
      expect(card).toContain('?mode=freeplay&daily=2026-11-26');
    });

    it('persists Zen Endless personal bests and Daily consecutive streaks across reloads', () => {
      expect(formatSprintTime(null)).toBe('—');
      expect(formatSprintTime(24500)).toBe('24.5s');

      const z1 = FreePlayRecordsStorage.recordZenSet({ streak: 1 });
      expect(z1.newBestStreak).toBe(true);
      expect(z1.records.zen.totalSets).toBe(1);
      expect(z1.records.zen.bestStreak).toBe(1);

      const z10 = FreePlayRecordsStorage.recordZenSet({ streak: 10, tenSetElapsedMs: 31200 });
      expect(z10.newBestStreak).toBe(true);
      expect(z10.newFastestTen).toBe(true);
      expect(z10.records.zen.fastestTenSetMs).toBe(31200);

      // Slower 10-set sprint does not overwrite fastest record
      const z20 = FreePlayRecordsStorage.recordZenSet({ streak: 4, tenSetElapsedMs: 42000 });
      expect(z20.newFastestTen).toBe(false);
      expect(z20.records.zen.fastestTenSetMs).toBe(31200);
      expect(z20.records.zen.bestStreak).toBe(10);

      // Daily streaks increment across consecutive UTC dates and keep best medal/score
      const d1 = FreePlayRecordsStorage.recordDailyRun({
        dateKey: '2026-11-25',
        sets: 18,
        setsPerMin: 6.0,
        mistakes: 1,
        patternPower: 1120,
        medal: 'silver',
      });
      expect(d1.isNewBest).toBe(true);
      expect(d1.records.dailyStreak).toBe(1);

      const d2 = FreePlayRecordsStorage.recordDailyRun({
        dateKey: '2026-11-26',
        sets: 28,
        setsPerMin: 9.3,
        mistakes: 0,
        patternPower: 1700,
        medal: 'gold',
      });
      expect(d2.records.dailyStreak).toBe(2);
      expect(d2.records.bestDailyStreak).toBe(2);
      expect(FreePlayRecordsStorage.load().dailyHistory['2026-11-26'].bestMedal).toBe('gold');
    });

    it('renders FreePlayMode hub, launches Daily 3-Min Score Attack, finishes into Results & cleans up timer', async () => {
      jest.useFakeTimers();
      const onExit = jest.fn();
      const view = await renderWrapped(<FreePlayMode onExit={onExit} initialDailyDate="2026-11-26" />);

      // 1-tap Zen DifficultySelection + Daily 3-Min Score Attack dock both present
      expect(view.getByTestId('difficulty-selection')).toBeTruthy();
      expect(view.getByTestId('freeplay-daily-launch')).toBeTruthy();

      // Launch Daily 3-Min Score Attack
      fireEvent.press(view.getByTestId('freeplay-daily-launch'));
      expect(view.getByTestId('free-play-screen')).toBeTruthy();
      expect(view.getByTestId('freeplay-daily-hud')).toBeTruthy();
      expect(view.getByTestId('freeplay-daily-timer')).toHaveTextContent('3:00');
      expect(getPerfSnapshot().intervalsByLabel['freeplay-daily-clock']).toBe(1);

      // Tick 3 seconds forward cleanly
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(view.getByTestId('freeplay-daily-timer')).toHaveTextContent('2:57');

      // Finish early into Daily Results screen (timer unregistered!)
      fireEvent.press(view.getByTestId('freeplay-daily-finish-now'));
      expect(view.getByTestId('freeplay-daily-results')).toBeTruthy();
      expect(view.getByTestId('freeplay-daily-power')).toBeTruthy();
      expect(view.getByTestId('freeplay-daily-share-card')).toBeTruthy();
      expect(getPerfSnapshot().intervalsByLabel['freeplay-daily-clock']).toBeUndefined();

      // Copy share card button works cleanly
      fireEvent.press(view.getByTestId('freeplay-daily-copy-share'));
      expect(view.getByTestId('freeplay-daily-copy-share')).toBeTruthy();

      // Switch back to hub and verify Zen Endless mode renders Zen progress strip
      fireEvent.press(view.getByTestId('freeplay-daily-to-zen'));
      expect(view.getByTestId('difficulty-selection')).toBeTruthy();
      fireEvent.press(view.getByTestId('freeplay-difficulty-easy'));
      expect(view.getByTestId('freeplay-zen-strip')).toBeTruthy();
    });
  });

  describe('[TP-19] Daily Starfall Summit, Summit Rating, Share Cards & Game URL Deep-Links', () => {
    it('deterministically rolls Daily Summit configs, applies all 6 Daily Mutators, and tracks Daily streaks', () => {
      const cfg1 = getDailySummitConfig('2026-11-26');
      const cfg2 = getDailySummitConfig('2026-11-26');
      expect(cfg1).toEqual(cfg2);
      expect(SUMMIT_DAILY_MUTATORS).toHaveLength(6);

      // Every single mutator creates a valid, distinct modified climb
      for (const mut of SUMMIT_DAILY_MUTATORS) {
        const run = createSpireRun('Orange Tabby', 0, 7777, {
          daily: { dateKey: '2026-11-26', mutatorId: mut.id },
        });
        expect(run.isDaily).toBe(true);
        expect(run.dailyDate).toBe('2026-11-26');
        expect(run.dailyMutatorId).toBe(mut.id);
        if (mut.id === 'catalyst_surge') {
          expect(run.extraEvolutionCap).toBe(1);
          expect(run.extraEvolutionLikelihood).toBe(18);
        }
        if (mut.id === 'gamble_mastery') {
          expect(run.themePacks).toContain('board_gambles');
          expect(run.startingGraces).toBe(2);
        }
        if (mut.id === 'glass_sprint') {
          expect(run.upgrades.heavy_hitter).toBe(2);
          expect(run.maxHearts).toBe(5);
        }
        if (mut.id === 'double_elites') {
          const elites = run.map.nodes.filter(n => n.kind === 'elite');
          expect(elites.length).toBeGreaterThanOrEqual(3);
        }
      }

      // Daily victory streak & best rating persistence
      const d1 = {
        ...createDailySpireRun('2026-11-25'),
        act: 3,
        floor: 21,
        stats: {
          ...createDailySpireRun('2026-11-25').stats,
          floorsCleared: 21,
          peakDpm: 1600,
          biggestHit: 420,
          parries: 6,
          perfectParries: 2,
          evolutionsForged: 4,
        },
      };
      const meta1 = recordSpireRunEnd(d1, true);
      expect(meta1.dailyStreak).toBe(1);
      expect(meta1.completedDailyDates).toContain('2026-11-25');
      expect(meta1.bestSummitRating).toBeGreaterThan(1500);

      const d2 = { ...createDailySpireRun('2026-11-26'), act: 3, floor: 21, stats: d1.stats };
      const meta2 = recordSpireRunEnd(d2, true);
      expect(meta2.dailyStreak).toBe(2);
      expect(meta2.bestDailyStreak).toBe(2);
      expect(loadSpireMeta().completedDailyDates).toEqual(['2026-11-25', '2026-11-26']);
    });

    it('computes Summit Rating with GSP-style percentile framing and spoiler-free Share Cards (zero "Spire" text)', () => {
      const earlyLoss = computeSummitRating({
        floorsCleared: 3,
        victory: false,
        peakDpm: 250,
        parries: 1,
        perfectParries: 0,
        evolutionsForged: 0,
        ascension: 0,
        act: 1,
      });
      const winA0 = computeSummitRating({
        floorsCleared: 21,
        victory: true,
        peakDpm: 2100,
        parries: 9,
        perfectParries: 3,
        evolutionsForged: 5,
        ascension: 0,
        act: 3,
      });
      const winA10 = computeSummitRating({
        floorsCleared: 21,
        victory: true,
        peakDpm: 2100,
        parries: 9,
        perfectParries: 3,
        evolutionsForged: 5,
        ascension: 10,
        act: 3,
      });

      expect(winA10.rating).toBeGreaterThan(winA0.rating);
      expect(winA0.rating).toBeGreaterThan(earlyLoss.rating);
      expect(winA0.percentile).toBeGreaterThan(earlyLoss.percentile);
      expect(winA0.framingLine).toContain('Summit Rating:');
      expect(winA0.framingLine).toContain('outscored ~');
      expect(winA0.framingLine).not.toMatch(/Rank #/i);

      const run = {
        ...createDailySpireRun('2026-11-26'),
        act: 3,
        floor: 21,
        stats: {
          ...createDailySpireRun('2026-11-26').stats,
          floorsCleared: 21,
          peakDpm: 1900,
          biggestHit: 640,
          parries: 8,
          perfectParries: 3,
          evolutionsForged: 4,
        },
      };
      const share = formatSpireShareCard(run, true);
      expect(share).toContain('Starfall Summit ✦ Daily 2026-11-26');
      expect(share).toContain('Summit Conquered 👑');
      expect(share).toContain('?mode=summit&seed=');
      expect(share).toContain('&daily=2026-11-26');
      expect(share).not.toMatch(/spire/i);
      expect(computeSpireRating(run, true).rating).toBeGreaterThan(2000);

      const advShare = formatAdventureShareCard({
        levelId: '2-4',
        levelName: 'A Little Help',
        stars: 3,
        biggestHit: 185,
        dpm: 540,
        seed: 4242,
      });
      expect(advShare).toContain('★★★');
      expect(advShare).toContain('?mode=adventure&level=2-4&seed=4242');
    });

    it('routes <Game /> deep-links directly into Summit Daily, Summit Seed, Adventure Level+Seed, and Free Play Daily', async () => {
      jest.useFakeTimers();

      // 1. ?mode=summit&daily=2026-11-26 → opens SpireSetup directly on Daily Climb tab
      const summitDaily = await renderWrapped(
        <Game initialMode="summit" initialDaily initialDailyDate="2026-11-26" />
      );
      expect(summitDaily.getByTestId('spire-setup')).toBeTruthy();
      expect(summitDaily.getByTestId('spire-daily-panel')).toBeTruthy();
      expect(summitDaily.getByTestId('spire-daily-mutator')).toBeTruthy();
      expect(summitDaily.getByTestId('spire-start-daily')).toBeTruthy();
      summitDaily.unmount();

      // 2. ?mode=summit&seed=4242&fighter=Badger&asc=3 → pre-fills Standard Climb with shared banner
      const summitSeed = await renderWrapped(
        <Game
          initialMode="summit"
          initialNumericSeed={4242}
          initialFighter="Badger"
          initialAscension={3}
        />
      );
      expect(summitSeed.getByTestId('spire-shared-banner')).toHaveTextContent(
        'Shared Seed #4242 · Badger · A3'
      );
      expect(summitSeed.getByTestId('spire-asc-value')).toHaveTextContent('ASCENSION 3');
      summitSeed.unmount();

      // 3. ?mode=adventure&level=1-5&seed=4242 → jumps directly into live seeded Adventure fight
      const advSeed = await renderWrapped(
        <Game initialMode="adventure" initialLevelId="1-5" initialNumericSeed={4242} />
      );
      expect(advSeed.getByTestId('run-stage')).toBeTruthy();
      advSeed.unmount();

      // 4. ?mode=freeplay&daily=2026-11-26 → launches directly into Daily 3-Min Score Attack
      const fpDaily = await renderWrapped(
        <Game initialMode="freeplay" initialDaily initialDailyDate="2026-11-26" />
      );
      expect(fpDaily.getByTestId('free-play-screen')).toBeTruthy();
      expect(fpDaily.getByTestId('freeplay-daily-hud')).toBeTruthy();
      fpDaily.unmount();
    });
  });
});
