import React from 'react';
import fs from 'fs';
import path from 'path';
import { render } from '@testing-library/react-native';
import { Svg } from 'react-native-svg';
import type { SharedValue } from 'react-native-reanimated';
import {
  EnemyAvatar,
  ENEMY_MOTION,
  playEnemySpeciesReaction,
  playEnemySpeciesFidget,
} from '@/components/enemies/EnemyAvatar';
import { EnemyEyes, EnemyBlinkProvider } from '@/components/enemies/EnemyEyes';
import {
  getEnemyDefaultTier,
  getEnemyMassClass,
  getEnemySpeciesClass,
  isBossEnemy,
} from '@/components/enemies/enemyRegistry';
import {
  buildEnemyPersonality,
  getEnemyAttackTimings,
  resolveEnemyExpression,
} from '@/utils/enemyAnimations';
import {
  MASS_CLASS,
  OVERLAP,
  PHASE,
  SPRING,
} from '@/utils/motion';
import {
  DefeatProgress,
  EnemyPortrait,
  InactivityBar,
  ScoreDecayIndicator,
  TimerSpeedBadge,
  WeaponCounterBadge,
} from '@/components/enemy-ui';
import type { ReactionChannels } from '@/components/creatures/types';
import type { EnemyInstance, RoundStats } from '@/types/enemy';

const mockWithTiming = jest.fn();
const mockWithSpring = jest.fn();
const mockWithDelay = jest.fn();

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    default: actual.default ?? actual,
    withTiming: (...args: unknown[]) => {
      mockWithTiming(...args);
      return actual.withTiming(...args);
    },
    withSpring: (...args: unknown[]) => {
      mockWithSpring(...args);
      return actual.withSpring(...args);
    },
    withDelay: (...args: unknown[]) => {
      mockWithDelay(...args);
      return actual.withDelay(...args);
    },
  };
});

jest.mock('@/components/Icon', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactLib.createElement(View, { testID: `mock-icon-${String(props.name ?? 'icon')}` }),
  };
});

const sv = (initial: number) => ({ value: initial }) as unknown as SharedValue<number>;

const makeChannels = (): ReactionChannels => ({
  bodyTx: sv(0),
  bodyTy: sv(0),
  bodyRotate: sv(0),
  bodySkewX: sv(0),
  scaleX: sv(1),
  reactionScaleY: sv(1),
  headRotate: sv(0),
  headTx: sv(0),
  headTy: sv(0),
  leftEarExtra: sv(0),
  rightEarExtra: sv(0),
  tailExtra: sv(0),
  pawBounce: sv(0),
  pawTx: sv(0),
  pawRotate: sv(0),
});

const UPGRADED_BOSSES = [
  'Ancient Dragon',
  'The Hydra',
  "Kraken's Grasp",
  'The Reaper',
  'World Eater',
  'Iron Shell',
  'Hyena Boss',
  'Dusty Mammoth',
  'Stone Sentinel',
] as const;

const createMockEnemy = (name: string, tier: 1 | 2 | 3 | 4 = 1): EnemyInstance => ({
  name,
  icon: 'lorc/dragon-head',
  tier,
  description: 'Test enemy',
  defeatConditionText: 'Complete 4 matches',
  onRoundStart: jest.fn(() => ({ cardModifications: [], events: [] })),
  onTick: jest.fn(() => ({ scoreDelta: 0, healthDelta: 0, timeDelta: 0, cardsToRemove: [], cardModifications: [], cardsToFlip: [], events: [], instantDeath: false })),
  onValidMatch: jest.fn(() => ({ timeDelta: 0, pointsMultiplier: 1, cardsToRemove: [], cardsToFlip: [], events: [] })),
  onInvalidMatch: jest.fn(() => ({ timeDelta: 0, pointsMultiplier: 1, cardsToRemove: [], cardsToFlip: [], events: [] })),
  onCardDraw: jest.fn(card => card),
  checkDefeatCondition: jest.fn((stats: RoundStats) => stats.totalMatches >= 4),
  onRoundEnd: jest.fn(),
  getUIModifiers: jest.fn(() => ({})),
  getStatModifiers: jest.fn(() => ({})),
});

const createMockStats = (overrides: Partial<RoundStats> = {}): RoundStats => ({
  totalMatches: 2,
  currentStreak: 2,
  maxStreak: 2,
  invalidMatches: 0,
  matchTimes: [1500, 1400],
  timeRemaining: 30,
  cardsRemaining: 12,
  tripleCardsCleared: 0,
  faceDownCardsMatched: 0,
  bombsDefused: 0,
  countdownCardsMatched: 0,
  shapesMatched: new Set(['oval']),
  colorsMatched: new Set(['red']),
  colorMatchCounts: new Map([['red', 2]]),
  allDifferentMatches: 0,
  allSameColorMatches: 0,
  squiggleMatches: 0,
  gracesUsed: 0,
  hintsUsed: 0,
  hintsRemaining: 2,
  gracesRemaining: 1,
  damageReceived: 0,
  weaponEffectsTriggered: new Set<string>(),
  currentScore: 100,
  targetScore: 300,
  timeGainTriggersThisRound: 0,
  timeGainTriggerCapBonus: 0,
  consecutiveInvalidMatches: 0,
  ...overrides,
} as RoundStats);

describe('Lane 2: Loop seams, 3-step blinks, mass-scaled boss kinematics, species acting & 3/4 boss craft', () => {
  beforeEach(() => {
    mockWithTiming.mockClear();
    mockWithSpring.mockClear();
    mockWithDelay.mockClear();
  });

  describe('1. Integer loop harmonics & smooth rage_spin settle', () => {
    it('uses exact integer harmonic tremorFreq=2 in ENEMY_MOTION.look (zero wrap seam)', () => {
      expect(ENEMY_MOTION.look?.tremorFreq).toBe(2);
      expect(Number.isInteger(ENEMY_MOTION.look?.tremorFreq)).toBe(true);
    });

    it('uses exact integer harmonic sin(ambientPhase * 2) in EnemyEffectsOverlay (no 2.2 seam)', () => {
      const overlaySrc = fs.readFileSync(
        path.resolve(__dirname, '../src/components/enemies/EnemyEffectsOverlay.tsx'),
        'utf8'
      );
      expect(overlaySrc).not.toContain('ambientPhase.value * 2.2');
      expect(overlaySrc).toContain('ambientPhase.value * 2');
    });

    it('replaces rage_spin 0ms snap with smooth spring settle to -360deg', () => {
      const ch = makeChannels();
      ENEMY_MOTION.playReaction('rage_spin', ch, 64, { chain: 0, intensity: 0, compact: false });

      // Zero 0ms snaps anywhere in rage_spin
      const zeroMsCalls = mockWithTiming.mock.calls.filter(
        ([, cfg]) => (cfg as { duration?: number } | undefined)?.duration === 0
      );
      expect(zeroMsCalls.length).toBe(0);

      // Smooth spring settle back to -360deg (equivalent to 0deg mod 360)
      const springTargets = mockWithSpring.mock.calls.map(([target]) => target);
      expect(springTargets).toContain(-360);
    });
  });

  describe('2. 3-step eyelid blinks (0 -> 1 half-lid -> 2 shut)', () => {
    it('renders distinct open, half-lid droop, and shut blink states via EnemyBlinkProvider', () => {
      const renderStage = (stage: 0 | 1 | 2) =>
        render(
          <EnemyBlinkProvider blinkStage={stage}>
            <Svg viewBox="0 0 100 100">
              <EnemyEyes expression="menacing" />
            </Svg>
          </EnemyBlinkProvider>
        );

      const openTree = JSON.stringify(renderStage(0).toJSON());
      const halfTree = JSON.stringify(renderStage(1).toJSON());
      const shutTree = JSON.stringify(renderStage(2).toJSON());

      expect(openTree).not.toEqual(halfTree);
      expect(halfTree).not.toEqual(shutTree);
      expect(openTree).not.toEqual(shutTree);
    });

    it('resolves blinkStage=2 to blink expression while keeping stage=1 expressive for HalfBlinkLidEye', () => {
      expect(
        resolveEnemyExpression({
          healthState: 'pristine',
          mood: 'menacing',
          activeReaction: null,
          isBlinking: false,
          blinkStage: 0,
        })
      ).toBe('menacing');
      expect(
        resolveEnemyExpression({
          healthState: 'pristine',
          mood: 'menacing',
          activeReaction: null,
          isBlinking: false,
          blinkStage: 1,
        })
      ).toBe('menacing');
      expect(
        resolveEnemyExpression({
          healthState: 'pristine',
          mood: 'menacing',
          activeReaction: null,
          isBlinking: false,
          blinkStage: 2,
        })
      ).toBe('blink');
      // KO and sleepy override blink
      expect(
        resolveEnemyExpression({
          healthState: 'knocked_out',
          mood: 'defeat',
          activeReaction: null,
          isBlinking: false,
          blinkStage: 2,
        })
      ).toBe('ko');
      expect(
        resolveEnemyExpression({
          healthState: 'pristine',
          mood: 'sleepy',
          activeReaction: null,
          isBlinking: false,
          blinkStage: 2,
        })
      ).toBe('sleepy');
    });
  });

  describe('3. Mass-scaled boss kinematics & species-class acting', () => {
    it('classifies all 9 iconic bosses as boss tier/massClass and nimble/winged/pincer species accurately', () => {
      for (const bossName of UPGRADED_BOSSES) {
        expect(isBossEnemy(bossName)).toBe(true);
        expect(getEnemyMassClass(bossName)).toBe('boss');
      }
      expect(getEnemyDefaultTier('Ancient Dragon')).toBe(4);
      expect(getEnemyDefaultTier('Iron Shell')).toBe(3);

      expect(getEnemySpeciesClass('The Hydra')).toBe('hydra');
      expect(getEnemySpeciesClass('Swift Bee')).toBe('winged');
      expect(getEnemySpeciesClass('Wet Crab')).toBe('pincer');
      expect(getEnemyMassClass('Swift Bee')).toBe('nimble');
      expect(getEnemyMassClass('Charging Boar')).toBe('heavy');
    });

    it('scales boss attack timing with PHASE.bossWindMs / bossCoilHoldMs and reduces boss knockback recoil', () => {
      const bossTimings = getEnemyAttackTimings('boss');
      const stdTimings = getEnemyAttackTimings('standard');
      expect(bossTimings.windMs).toBe(PHASE.bossWindMs);
      expect(bossTimings.coilHoldMs).toBe(PHASE.bossCoilHoldMs);
      expect(bossTimings.apexHoldMs).toBe(PHASE.bossApexHoldMs);
      expect(bossTimings.windMs).toBeGreaterThan(stdTimings.windMs);

      // Compare boss vs standard recoil magnitude on identical tier-1 throw hit
      // (calls[0] is reactionScaleY squash; calls[1] is horizontal bodyTx knockback)
      const chStd = makeChannels();
      ENEMY_MOTION.playReaction('pain', chStd, 64, {
        chain: 0,
        intensity: 0,
        hitTier: 1,
        hitKind: 'throw',
        compact: false,
        massClass: 'standard',
      });
      const stdBodyTx = mockWithTiming.mock.calls[1]?.[0] as number;

      mockWithTiming.mockClear();
      mockWithSpring.mockClear();
      const chBoss = makeChannels();
      ENEMY_MOTION.playReaction('pain', chBoss, 64, {
        chain: 0,
        intensity: 0,
        hitTier: 1,
        hitKind: 'throw',
        compact: false,
        massClass: 'boss',
      });
      const bossBodyTx = mockWithTiming.mock.calls[1]?.[0] as number;

      expect(stdBodyTx).toBeGreaterThan(10);
      expect(bossBodyTx).toBeGreaterThan(5);
      // Boss base recoil is 0.65x standard (+ 0.85x hitstop micro-vibration)
      expect(bossBodyTx).toBeLessThan(stdBodyTx * (MASS_CLASS.boss.recoilMult + 0.06));
      expect(mockWithSpring.mock.calls.some(([, cfg]) => cfg === SPRING.boss)).toBe(true);
    });

    it('drives distinct species-class acting for Hydra 3-head cascade, Winged dive-flap, Pincer snap & Reaper scythe', () => {
      // 1. Hydra out-of-phase 3-head strike cascade (+OVERLAP.primaryMs / +OVERLAP.secondaryMs)
      const chHydra = makeChannels();
      const hydraHandled = playEnemySpeciesReaction('The Hydra', 'hydra', 'attack', chHydra, 64, {
        chain: 0,
        intensity: 0,
        massClass: 'boss',
      });
      expect(hydraHandled).toBe(true);
      const hydraDelays = mockWithDelay.mock.calls.map(([ms]) => ms);
      expect(hydraDelays).toContain(PHASE.bossCoilHoldMs + OVERLAP.primaryMs);
      expect(hydraDelays).toContain(PHASE.bossCoilHoldMs + OVERLAP.secondaryMs);

      // 2. Winged dive-swoop (-30deg gather upstroke -> +34deg power downstroke)
      mockWithTiming.mockClear();
      const chWinged = makeChannels();
      const wingedHandled = playEnemySpeciesReaction('Swift Bee', 'winged', 'attack', chWinged, 64, {
        chain: 0,
        intensity: 0,
        massClass: 'nimble',
      });
      expect(wingedHandled).toBe(true);
      expect(mockWithTiming.mock.calls.some(([v]) => v === -30)).toBe(true);
      expect(mockWithTiming.mock.calls.some(([v]) => v === 34)).toBe(true);

      // 3. Pincer scissor snap
      mockWithDelay.mockClear();
      const chPincer = makeChannels();
      const pincerHandled = playEnemySpeciesReaction('Wet Crab', 'pincer', 'attack', chPincer, 64, {
        chain: 0,
        intensity: 0,
        massClass: 'standard',
      });
      expect(pincerHandled).toBe(true);
      expect(mockWithDelay.mock.calls.some(([ms]) => ms >= OVERLAP.primaryMs)).toBe(true);

      // 4. Reaper scythe sweep via pawRotate & pawTx
      mockWithTiming.mockClear();
      const chReaper = makeChannels();
      const reaperHandled = playEnemySpeciesReaction('The Reaper', 'boss', 'attack', chReaper, 64, {
        chain: 0,
        intensity: 0,
        massClass: 'boss',
      });
      expect(reaperHandled).toBe(true);
      expect(mockWithTiming.mock.calls.some(([v]) => v === -36)).toBe(true);

      // 5. Species fidgets return true for winged, hydra, pincer, boss
      expect(playEnemySpeciesFidget('winged', 0.2, makeChannels(), 64)).toBe(true);
      expect(playEnemySpeciesFidget('hydra', 0.2, makeChannels(), 64)).toBe(true);
      expect(playEnemySpeciesFidget('pincer', 0.2, makeChannels(), 64)).toBe(true);
      expect(playEnemySpeciesFidget('boss', 0.2, makeChannels(), 64)).toBe(true);
    });

    it('tunes enemy personality tempos by species (brisk winged flaps, weighty boss breaths)', () => {
      const bee = buildEnemyPersonality({
        name: 'Swift Bee',
        tier: 1,
        motionClass: 'fast',
        speciesClass: 'winged',
      });
      const dragon = buildEnemyPersonality({
        name: 'Ancient Dragon',
        tier: 4,
        motionClass: 'heavy',
        speciesClass: 'winged',
        isBoss: true,
      });
      expect(bee.breathCycleMs).toBeLessThan(dragon.breathCycleMs);
      expect(bee.earSwayDeg).toBeGreaterThanOrEqual(11);
      expect(dragon.breathIntensity).toBeGreaterThanOrEqual(0.04);
    });
  });

  describe('4. All 9 upgraded 3/4 LEFT storybook bosses render with gradients & clean #121212 silhouettes', () => {
    const collectNodes = (node: any, out: any[] = []): any[] => {
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) {
        node.forEach(c => collectNodes(c, out));
        return out;
      }
      out.push(node);
      if (node.children) node.children.forEach((c: any) => collectNodes(c, out));
      return out;
    };

    it.each(UPGRADED_BOSSES)('%s renders with storybook gradients, 3/4 left lean, and solid #121212 silhouette', bossName => {
      const tier = getEnemyDefaultTier(bossName);
      const normal = render(
        <EnemyAvatar
          enemy={{ name: bossName, tier }}
          size={84}
          mood="menacing"
          facing="left"
          animate={false}
        />
      );
      const normalNodes = collectNodes(normal.toJSON());
      const gradients = normalNodes.filter(n => n.type === 'LinearGradient');
      const leftTranslates = normalNodes.filter(
        n => typeof n.props?.transform === 'string' && n.props.transform.includes('translate(-')
      );
      expect(gradients.length).toBeGreaterThanOrEqual(1);
      expect(leftTranslates.length).toBeGreaterThanOrEqual(1);

      const sil = render(
        <EnemyAvatar
          enemy={{ name: bossName, tier }}
          size={84}
          mood="idle"
          facing="left"
          animate={false}
          silhouette
        />
      );
      const silNodes = collectNodes(sil.toJSON());
      const silGradients = silNodes.filter(n => n.type === 'LinearGradient');
      expect(silGradients.length).toBe(0);

      const nonBlackFills = silNodes.filter(n => {
        const fill = n.props?.fill;
        if (typeof fill !== 'string') return false;
        const f = fill.toLowerCase();
        return f !== 'none' && f !== '#121212' && f !== 'transparent';
      });
      expect(nonBlackFills).toEqual([]);
    });
  });

  describe('5. Enemy UI micro-feedback badges & GPU-only progress bars', () => {
    it('renders all enemy-ui components cleanly with tabular-nums and GPU-only bar fills', () => {
      const enemy = createMockEnemy('Ancient Dragon', 4);
      const stats = createMockStats({ totalMatches: 2 });

      const wc = render(<WeaponCounterBadge type="fire" reduction={20} />);
      expect(wc.getByText('-20%')).toBeTruthy();

      const ts = render(<TimerSpeedBadge multiplier={1.4} />);
      expect(ts.getByText('1.4x')).toBeTruthy();
      const tsIdle = render(<TimerSpeedBadge multiplier={1.0} />);
      expect(tsIdle.toJSON()).toBeNull();

      const dp = render(<DefeatProgress enemy={enemy} stats={stats} />);
      expect(dp.getByText('Matches: 2/4')).toBeTruthy();
      // Confirm no layout percentage width like "50%" on progress bar fill
      expect(JSON.stringify(dp.toJSON())).not.toContain('"width":"50%"');

      const dpDone = render(<DefeatProgress enemy={enemy} stats={createMockStats({ totalMatches: 4 })} />);
      expect(dpDone.getByText('Defeated!')).toBeTruthy();

      const ib = render(<InactivityBar current={9500} max={10000} penalty="death" />);
      expect(ib.getByText('1s')).toBeTruthy();
      expect(JSON.stringify(ib.toJSON())).not.toContain('"width":"95%"');

      const sd = render(<ScoreDecayIndicator rate={5} />);
      expect(sd.getByText('-5/s')).toBeTruthy();

      const portrait = render(<EnemyPortrait enemy={enemy} hp={75} maxHp={100} />);
      expect(portrait.toJSON()).toBeTruthy();
    });
  });
});
