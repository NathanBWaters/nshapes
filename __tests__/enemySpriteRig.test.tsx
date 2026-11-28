import React from 'react';
import { Platform } from 'react-native';
import { act, render, renderHook } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useCreatureMotion } from '@/components/creatures/useCreatureMotion';
import { ENEMY_MOTION, EnemyAvatar } from '@/components/enemies/EnemyAvatar';
import {
  ENEMY_ATLAS_COLS,
  ENEMY_ATLAS_MAX_INDEX,
  ENEMY_ATLAS_ROWS,
  ENEMY_CLIPS,
  ENEMY_CLIP_DURATION_MS,
  ENEMY_IDLE_FRAME_COUNT,
  EnemySpriteRig,
  getEnemySpriteMoodTempo,
} from '@/components/enemies/EnemySpriteRig';
import {
  ENEMY_SPRITE_ATLAS_SPECS,
  WAVE1_ENEMY_SPRITE_NAMES,
  WAVE1_ENEMY_SPRITE_SLUGS,
  getEnemySpriteAtlasSpec,
  hasEnemySpriteAtlas,
} from '@/components/enemies/enemySpriteRegistry';
import {
  getEnemyMassClass,
  getEnemyPersonality,
  getEnemyRigPivots,
} from '@/components/enemies/enemyRegistry';
import { SILHOUETTE_INK } from '@/components/illustration/primitives';
import { type EnemyAmbientMood, getEnemyAttackTimings } from '@/utils/enemyAnimations';
import { ACCESSIBLE, HIT, SPRITE_TX } from '@/utils/motion';

const mockWithTiming = jest.fn();
const mockWithDelay = jest.fn();
const mockWithRepeat = jest.fn();
const mockCancelAnimation = jest.fn();
let mockAppActive = true;
let mockReducedMotion = false;
let mockFrameCallbackCalls: boolean[] = [];
let mockCapturedFrameCallbacks: {
  cb: (info: { timeSincePreviousFrame: number | null }) => void;
  active: boolean;
}[] = [];
let mockCapturedAnimatedStyleFns: (() => Record<string, unknown>)[] = [];

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: { name: string }) =>
      ReactActual.createElement(View, { accessibilityLabel: `icon-${props.name}` }),
  };
});

jest.mock('@/hooks/useAppActive', () => ({
  useAppActive: () => mockAppActive,
}));

jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));

jest.mock('@/hooks/useGuardedFrameCallback', () => ({
  useGuardedFrameCallback: (
    cb: (info: { timeSincePreviousFrame: number | null }) => void,
    autostart = true
  ) => {
    const active = Boolean(autostart) && mockAppActive;
    mockFrameCallbackCalls.push(active);
    mockCapturedFrameCallbacks.push({ cb, active });
    return { setActive: jest.fn(), callbackId: 0, isActive: active };
  },
}));

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
    withDelay: (...args: unknown[]) => {
      mockWithDelay(...args);
      return actual.withDelay(...args);
    },
    withRepeat: (...args: unknown[]) => {
      mockWithRepeat(...args);
      return actual.withRepeat(...args);
    },
    cancelAnimation: (...args: unknown[]) => {
      mockCancelAnimation(...args);
      return actual.cancelAnimation(...args);
    },
    useAnimatedStyle: (fn: () => Record<string, unknown>, ...rest: unknown[]) => {
      mockCapturedAnimatedStyleFns.push(fn);
      return actual.useAnimatedStyle(fn, ...rest);
    },
  };
});

const WAVE1_BOSSES = [
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

const WAVE1_MEADOW = [
  'Dozy Bunny',
  'Prickle',
  'Clover Frog',
  'Sunny Gecko',
  'Nutkin',
  'Prism Moth',
  'Old Quillback',
  'Golden Mole',
  'Bumble Bomber',
  'Stalking Wolf',
] as const;

function slotTransform(slot: number, cellSize: number) {
  const col = slot % ENEMY_ATLAS_COLS;
  const row = Math.floor(slot / ENEMY_ATLAS_COLS);
  return [{ translateX: -col * cellSize }, { translateY: -row * cellSize }];
}

describe('Option B 8x8 Enemy Sprite Atlas Runtime (`enemySpriteRegistry`, `EnemySpriteRig`, `EnemyAvatar`)', () => {
  beforeEach(() => {
    mockAppActive = true;
    mockReducedMotion = false;
    mockFrameCallbackCalls = [];
    mockCapturedFrameCallbacks = [];
    mockCapturedAnimatedStyleFns = [];
    mockWithTiming.mockClear();
    mockWithDelay.mockClear();
    mockWithRepeat.mockClear();
    mockCancelAnimation.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('registers all 19 Wave 1 enemy atlases + 2 exact visual aliases with species metadata and leaves World 2-5 SVG enemies untouched', () => {
    expect(ENEMY_ATLAS_COLS).toBe(8);
    expect(ENEMY_ATLAS_ROWS).toBe(8);
    expect(ENEMY_IDLE_FRAME_COUNT).toBe(32);
    expect(ENEMY_ATLAS_MAX_INDEX).toBe(63);
    expect(ENEMY_CLIPS.idle).toEqual({ start: 0, count: 32, fps: 16 });
    expect(ENEMY_CLIPS.windup).toEqual({ start: 32, count: 4, fps: 16 });
    expect(ENEMY_CLIPS.attack).toEqual({ start: 36, count: 8, fps: 20 });
    expect(ENEMY_CLIPS.taunt).toEqual({ start: 44, count: 8, fps: 16 });
    expect(ENEMY_CLIPS.hurt).toEqual({ start: 52, count: 6, fps: 16 });
    expect(ENEMY_CLIPS.sleepy).toEqual({ start: 58, count: 6, fps: 8 });

    expect(WAVE1_ENEMY_SPRITE_SLUGS).toHaveLength(19);
    expect(WAVE1_ENEMY_SPRITE_NAMES).toHaveLength(21);

    for (const boss of WAVE1_BOSSES) {
      expect(hasEnemySpriteAtlas(boss)).toBe(true);
      const spec = getEnemySpriteAtlasSpec(boss);
      expect(spec?.isBoss).toBe(true);
      expect(spec?.idleFps).toBe(16);
      expect(spec?.windupStepMs).toBeGreaterThan(0);
      expect(spec?.source).toBeDefined();
    }

    for (const meadow of WAVE1_MEADOW) {
      expect(hasEnemySpriteAtlas(meadow)).toBe(true);
      const spec = getEnemySpriteAtlasSpec(meadow);
      expect(spec?.isBoss).toBe(false);
      expect(spec?.idleFps).toBe(16);
      expect(spec?.source).toBeDefined();
    }

    // Exact hover species flags
    expect(getEnemySpriteAtlasSpec('The Reaper')?.hover).toBe(true);
    expect(getEnemySpriteAtlasSpec('Prism Moth')?.hover).toBe(true);
    expect(getEnemySpriteAtlasSpec('Bumble Bomber')?.hover).toBe(true);
    expect(getEnemySpriteAtlasSpec('Ancient Dragon')?.hover).toBe(false);
    expect(getEnemySpriteAtlasSpec('Dozy Bunny')?.hover).toBe(false);

    // Exact visual aliases share the exact same preloaded texture reference (0 extra VRAM) & display alignment
    expect(hasEnemySpriteAtlas('Mammoth')).toBe(true);
    expect(getEnemySpriteAtlasSpec('Mammoth')?.slug).toBe('dusty-mammoth');
    expect(getEnemySpriteAtlasSpec('Mammoth')?.source).toBe(
      getEnemySpriteAtlasSpec('Dusty Mammoth')?.source
    );
    expect(getEnemySpriteAtlasSpec('Mammoth')?.isBoss).toBe(true);
    expect(getEnemySpriteAtlasSpec('Mammoth')?.displayOffsetX).toBe(-0.086);
    expect(getEnemySpriteAtlasSpec('Mammoth')?.displayScale).toBe(1.18);

    expect(hasEnemySpriteAtlas('Bramble Frog')).toBe(true);
    expect(getEnemySpriteAtlasSpec('Bramble Frog')?.slug).toBe('clover-frog');
    expect(getEnemySpriteAtlasSpec('Bramble Frog')?.source).toBe(
      getEnemySpriteAtlasSpec('Clover Frog')?.source
    );
    expect(getEnemySpriteAtlasSpec('Bramble Frog')?.displayOffsetX).toBe(-0.063);
    expect(getEnemySpriteAtlasSpec('Bramble Frog')?.displayScale).toBe(1.22);

    // Every Wave 1 spec carries calibrated displayOffsetX and displayScale values
    for (const name of WAVE1_ENEMY_SPRITE_NAMES) {
      const s = getEnemySpriteAtlasSpec(name);
      expect(typeof s?.displayOffsetX).toBe('number');
      expect(typeof s?.displayScale).toBe('number');
      expect(s?.displayScale ?? 0).toBeGreaterThanOrEqual(1);
    }

    // World 2-5 enemies and unknown/null inputs stay cleanly on SVG EnemyCreatureRig
    for (const svgEnemy of ['Junk Rat', 'Charging Boar', 'Shadow Bat', 'Wet Crab', 'Goblin Saboteur', 'toString']) {
      expect(hasEnemySpriteAtlas(svgEnemy)).toBe(false);
      expect(getEnemySpriteAtlasSpec(svgEnemy)).toBeUndefined();
    }
    expect(hasEnemySpriteAtlas(null)).toBe(false);
    expect(hasEnemySpriteAtlas(undefined)).toBe(false);

    // Verify World 2-5 enemy renders SVG rig with zero sprite viewport
    const svgView = render(<EnemyAvatar enemy="Junk Rat" size={72} mood="menacing" animate={false} />);
    expect(svgView.getByTestId('enemy-avatar')).toBeTruthy();
    expect(svgView.getByTestId('enemy-ground-shadow')).toBeTruthy();
    expect(svgView.queryByTestId('enemy-sprite-viewport')).toBeNull();
    svgView.unmount();

    // Verify all 21 Wave 1 names map to exactly 19 distinct atlas sources
    const uniqueSources = new Set(WAVE1_ENEMY_SPRITE_NAMES.map((n) => ENEMY_SPRITE_ATLAS_SPECS[n].source));
    expect(uniqueSources.size).toBe(19);
  });

  it('advances monotonic idle clock smoothly across idle -> menacing -> enraged -> cornered with ZERO phase resets or extra frame loops', () => {
    const hook = renderHook(
      ({ mood }: { mood: EnemyAmbientMood }) =>
        useCreatureMotion(ENEMY_MOTION, {
          name: 'Hyena Boss',
          size: 84,
          mood,
          healthState: 'pristine',
          personality: getEnemyPersonality('Hyena Boss', 3),
          pivots: getEnemyRigPivots('Hyena Boss'),
          massClass: getEnemyMassClass('Hyena Boss'),
          atlasBakedIdle: true,
          spriteTempo: getEnemySpriteMoodTempo(mood),
          reaction: null,
          animate: true,
          lively: true,
          interactive: false,
        }),
      { initialProps: { mood: 'idle' as EnemyAmbientMood } }
    );

    const stepFrames = (count: number, dtMs = 16) => {
      const latest = mockCapturedFrameCallbacks[mockCapturedFrameCallbacks.length - 1];
      expect(latest?.active).toBe(true);
      for (let i = 0; i < count; i++) {
        latest.cb({ timeSincePreviousFrame: dtMs });
      }
    };

    stepFrames(10, 16);
    expect(hook.result.current.spriteClockMs.value).toBe(160);
    const idleSecAfterIdle = hook.result.current.spriteIdleSec.value;
    expect(idleSecAfterIdle).toBeCloseTo(0.16, 3);

    hook.rerender({ mood: 'menacing' });
    stepFrames(10, 16);
    expect(hook.result.current.spriteClockMs.value).toBe(320);
    expect(hook.result.current.spriteIdleSec.value).toBeGreaterThan(idleSecAfterIdle + 0.16);

    const idleSecAfterMenacing = hook.result.current.spriteIdleSec.value;
    hook.rerender({ mood: 'enraged' });
    stepFrames(10, 16);
    expect(hook.result.current.spriteClockMs.value).toBe(480);
    expect(hook.result.current.spriteIdleSec.value).toBeGreaterThan(idleSecAfterMenacing + 0.18);

    const idleSecAfterEnraged = hook.result.current.spriteIdleSec.value;
    hook.rerender({ mood: 'cornered' });
    stepFrames(10, 16);
    expect(hook.result.current.spriteClockMs.value).toBe(640);
    expect(hook.result.current.spriteIdleSec.value).toBeGreaterThan(idleSecAfterEnraged + 0.18);
    hook.unmount();

    // Live EnemyAvatar uses strictly 1 guarded frame callback (from useCreatureMotion) and 0 sprite resets across moods
    mockWithTiming.mockClear();
    mockWithRepeat.mockClear();
    mockFrameCallbackCalls = [];
    const view = render(<EnemyAvatar enemy="Hyena Boss" size={84} mood="idle" animate={true} />);
    expect(view.getByTestId('enemy-sprite-viewport')).toBeTruthy();
    expect(mockFrameCallbackCalls.filter(Boolean)).toHaveLength(1);
    expect(mockWithRepeat).not.toHaveBeenCalled();

    mockWithTiming.mockClear();
    mockCancelAnimation.mockClear();
    view.rerender(<EnemyAvatar enemy="Hyena Boss" size={84} mood="menacing" animate={true} />);
    view.rerender(<EnemyAvatar enemy="Hyena Boss" size={84} mood="enraged" animate={true} />);
    view.rerender(<EnemyAvatar enemy="Hyena Boss" size={84} mood="cornered" animate={true} />);
    expect(
      mockWithTiming.mock.calls.some(
        ([, cfg]) => (cfg as { duration?: number } | undefined)?.duration === SPRITE_TX.moodBlendMs
      )
    ).toBe(false);
    view.unmount();
  });

  it('syncs boss attack windup (32..35) to attackStrikeStartMs, snaps 0ms into attack (36..43) @ 20fps, latches once per reactionKey, and crossfades back to Pose0 idle', () => {
    const clockMs = { value: 1000 } as unknown as SharedValue<number>;
    const idleSec = { value: 1.0 } as unknown as SharedValue<number>;
    const painHitstop = { value: HIT.holdMs } as unknown as SharedValue<number>;
    const bossTimings = getEnemyAttackTimings('boss'); // strikeStartMs = 192ms

    mockCapturedAnimatedStyleFns = [];
    const view = render(
      <EnemySpriteRig
        enemyName="Ancient Dragon"
        size={96}
        mood="menacing"
        healthState="pristine"
        activeReaction={null}
        reactionKey={0}
        attackStrikeStartMs={bossTimings.strikeStartMs}
        massClass="boss"
        painHitstopMs={painHitstop}
        spriteClockMs={clockMs}
        spriteIdleSec={idleSec}
        animate={true}
      />
    );
    const [, evalCurr, evalPrev] = mockCapturedAnimatedStyleFns.slice(-3);

    // Trigger boss attack at t = 1000ms
    view.rerender(
      <EnemySpriteRig
        enemyName="Ancient Dragon"
        size={96}
        mood="menacing"
        healthState="pristine"
        activeReaction="attack"
        reactionKey={1}
        attackStrikeStartMs={bossTimings.strikeStartMs}
        massClass="boss"
        painHitstopMs={painHitstop}
        spriteClockMs={clockMs}
        spriteIdleSec={idleSec}
        animate={true}
      />
    );

    // Windup phase: 0..48ms -> 32, 48..96ms -> 33, 96..192ms -> 34..35 moving hold!
    clockMs.value = 1016;
    expect(evalCurr().transform).toEqual(slotTransform(32, 96));

    clockMs.value = 1064;
    expect(evalCurr().transform).toEqual(slotTransform(33, 96));

    clockMs.value = 1120;
    expect(evalCurr().transform).toEqual(slotTransform(34, 96));

    // Prop update mid-attack with same reactionKey must be a strict no-op (never restart windup!)
    mockWithTiming.mockClear();
    mockCancelAnimation.mockClear();
    view.rerender(
      <EnemySpriteRig
        enemyName="Ancient Dragon"
        size={96}
        mood="menacing"
        healthState="pristine"
        activeReaction="attack"
        reactionKey={1}
        attackStrikeStartMs={240}
        massClass="boss"
        painHitstopMs={painHitstop}
        spriteClockMs={clockMs}
        spriteIdleSec={idleSec}
        animate={true}
      />
    );
    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(mockCancelAnimation).not.toHaveBeenCalled();

    // At exact boss strikeStartMs (1000 + 192 = 1192ms): guaranteed 0ms Sakurai strike snap into slot 36!
    clockMs.value = 1000 + bossTimings.strikeStartMs;
    expect(evalCurr().transform).toEqual(slotTransform(36, 96));
    expect(evalCurr().opacity).toBe(1);
    expect(evalPrev().opacity).toBe(0);

    // 20fps (50ms/frame) progression through 36..43
    clockMs.value = 1000 + bossTimings.strikeStartMs + 50;
    expect(evalCurr().transform).toEqual(slotTransform(37, 96));

    clockMs.value = 1000 + bossTimings.strikeStartMs + 360;
    expect(evalCurr().transform).toEqual(slotTransform(43, 96));

    // Recover back to idle: 64ms SPRITE_TX.recoverBlendMs crossfade + anchored at Pose0 (0)
    mockWithTiming.mockClear();
    clockMs.value = 1000 + bossTimings.strikeStartMs + ENEMY_CLIP_DURATION_MS.attack;
    idleSec.value = 1.6;
    view.rerender(
      <EnemySpriteRig
        enemyName="Ancient Dragon"
        size={96}
        mood="menacing"
        healthState="pristine"
        activeReaction={null}
        reactionKey={1}
        attackStrikeStartMs={bossTimings.strikeStartMs}
        massClass="boss"
        painHitstopMs={painHitstop}
        spriteClockMs={clockMs}
        spriteIdleSec={idleSec}
        animate={true}
      />
    );
    expect(
      mockWithTiming.mock.calls.some(
        ([to, cfg]) =>
          to === 1 && (cfg as { duration?: number } | undefined)?.duration === SPRITE_TX.recoverBlendMs
      )
    ).toBe(true);
    expect(evalCurr().transform).toEqual(slotTransform(0, 96));
    view.unmount();
  });

  it('plays taunt (44..51) on taunt/regen/poke/rage_spin, loops victory apex (46..47), and plays windup (32..35) on entrance', () => {
    const clockMs = { value: 0 } as unknown as SharedValue<number>;
    const idleSec = { value: 0 } as unknown as SharedValue<number>;
    const painHitstop = { value: HIT.holdMs } as unknown as SharedValue<number>;

    mockCapturedAnimatedStyleFns = [];
    const view = render(
      <EnemySpriteRig
        enemyName="Clover Frog"
        size={80}
        mood="idle"
        healthState="pristine"
        activeReaction="taunt"
        reactionKey={1}
        painHitstopMs={painHitstop}
        spriteClockMs={clockMs}
        spriteIdleSec={idleSec}
        animate={true}
      />
    );
    const [, evalCurr] = mockCapturedAnimatedStyleFns.slice(-3);

    // taunt @ 16fps (62.5ms/frame): 44..51
    clockMs.value = 0;
    expect(evalCurr().transform).toEqual(slotTransform(44, 80));
    clockMs.value = 130;
    expect(evalCurr().transform).toEqual(slotTransform(46, 80));
    clockMs.value = 450;
    expect(evalCurr().transform).toEqual(slotTransform(51, 80));

    // regen, poke, rage_spin all route through taunt 44..51
    for (const [idx, reaction] of (['regen', 'poke', 'rage_spin'] as const).entries()) {
      clockMs.value = 1000 + idx * 500;
      view.rerender(
        <EnemySpriteRig
          enemyName="Clover Frog"
          size={80}
          mood="idle"
          healthState="pristine"
          activeReaction={reaction}
          reactionKey={2 + idx}
          painHitstopMs={painHitstop}
          spriteClockMs={clockMs}
          spriteIdleSec={idleSec}
          animate={true}
        />
      );
      expect(evalCurr().transform).toEqual(slotTransform(44, 80));
    }

    // entrance routes through windup 32 -> 33 -> 34..35
    clockMs.value = 3000;
    view.rerender(
      <EnemySpriteRig
        enemyName="Clover Frog"
        size={80}
        mood="menacing"
        healthState="pristine"
        activeReaction="entrance"
        reactionKey={6}
        painHitstopMs={painHitstop}
        spriteClockMs={clockMs}
        spriteIdleSec={idleSec}
        animate={true}
      />
    );
    expect(evalCurr().transform).toEqual(slotTransform(32, 80));
    clockMs.value = 3070;
    expect(evalCurr().transform).toEqual(slotTransform(33, 80));
    clockMs.value = 3140;
    expect(evalCurr().transform).toEqual(slotTransform(34, 80));
    clockMs.value = 3270;
    expect(evalCurr().transform).toEqual(slotTransform(35, 80));

    // mood === 'victory' plays 44 -> 45 -> loops 46..47 apex moving-hold
    clockMs.value = 4000;
    view.rerender(
      <EnemySpriteRig
        enemyName="Clover Frog"
        size={80}
        mood="victory"
        healthState="pristine"
        activeReaction={null}
        reactionKey={6}
        painHitstopMs={painHitstop}
        spriteClockMs={clockMs}
        spriteIdleSec={idleSec}
        animate={true}
      />
    );
    expect(evalCurr().transform).toEqual(slotTransform(44, 80));
    clockMs.value = 4070;
    expect(evalCurr().transform).toEqual(slotTransform(45, 80));
    clockMs.value = 4140;
    expect(evalCurr().transform).toEqual(slotTransform(46, 80));
    clockMs.value = 4270;
    expect(evalCurr().transform).toEqual(slotTransform(47, 80));
    clockMs.value = 4395;
    expect(evalCurr().transform).toEqual(slotTransform(46, 80));
    view.unmount();
  });

  it('snaps 0ms into hurt[52] on pain/crit_pain, holds through reactionHitstopMs, plays 53..57 recovery, and blends back to Pose0 idle', () => {
    const clockMs = { value: 500 } as unknown as SharedValue<number>;
    const idleSec = { value: 0.5 } as unknown as SharedValue<number>;
    const painHitstop = { value: 80 } as unknown as SharedValue<number>;

    mockCapturedAnimatedStyleFns = [];
    const view = render(
      <EnemySpriteRig
        enemyName="Dozy Bunny"
        size={64}
        mood="menacing"
        healthState="scuffed"
        activeReaction={null}
        reactionKey={0}
        painHitstopMs={painHitstop}
        spriteClockMs={clockMs}
        spriteIdleSec={idleSec}
        animate={true}
      />
    );
    const [, evalCurr, evalPrev] = mockCapturedAnimatedStyleFns.slice(-3);

    // 0ms Sakurai impact snap on pain (no 64ms/96ms blur)
    mockWithTiming.mockClear();
    view.rerender(
      <EnemySpriteRig
        enemyName="Dozy Bunny"
        size={64}
        mood="menacing"
        healthState="scuffed"
        activeReaction="pain"
        reactionKey={1}
        painHitstopMs={painHitstop}
        spriteClockMs={clockMs}
        spriteIdleSec={idleSec}
        animate={true}
      />
    );
    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(evalCurr().transform).toEqual(slotTransform(52, 64));
    expect(evalCurr().opacity).toBe(1);
    expect(evalPrev().opacity).toBe(0);

    // Holds 52 throughout 80ms hitstop
    clockMs.value = 570;
    expect(evalCurr().transform).toEqual(slotTransform(52, 64));

    // Advances into 53..57 recovery @ 16fps (62.5ms/frame) right after hitstop
    clockMs.value = 582;
    expect(evalCurr().transform).toEqual(slotTransform(53, 64));
    clockMs.value = 580 + 260;
    expect(evalCurr().transform).toEqual(slotTransform(57, 64));
    view.unmount();
  });

  it('runs Phase A AND Phase B 96ms smoothstep crossfades for sleepy (58->59), KO (58->63), and wake (59->58->idle)', () => {
    const clockMs = { value: 0 } as unknown as SharedValue<number>;
    const idleSec = { value: 0 } as unknown as SharedValue<number>;
    const painHitstop = { value: HIT.holdMs } as unknown as SharedValue<number>;

    // 1) idle -> sleepy: Phase A (96ms into 58) + Phase B (96ms smoothstep 58 -> 59)
    mockCapturedAnimatedStyleFns = [];
    const view = render(
      <EnemySpriteRig
        enemyName="Dozy Bunny"
        size={80}
        mood="menacing"
        healthState="pristine"
        activeReaction={null}
        reactionKey={0}
        painHitstopMs={painHitstop}
        spriteClockMs={clockMs}
        spriteIdleSec={idleSec}
        animate={true}
      />
    );
    const [, evalCurr, evalPrev] = mockCapturedAnimatedStyleFns.slice(-3);

    mockWithTiming.mockClear();
    clockMs.value = 100;
    idleSec.value = 0.1;
    view.rerender(
      <EnemySpriteRig
        enemyName="Dozy Bunny"
        size={80}
        mood="sleepy"
        healthState="pristine"
        activeReaction={null}
        reactionKey={0}
        painHitstopMs={painHitstop}
        spriteClockMs={clockMs}
        spriteIdleSec={idleSec}
        animate={true}
      />
    );
    // Phase A crossfade triggered over SPRITE_TX.sleepBlendMs (96ms)
    expect(
      mockWithTiming.mock.calls.some(
        ([to, cfg]) =>
          to === 1 && (cfg as { duration?: number } | undefined)?.duration === SPRITE_TX.sleepBlendMs
      )
    ).toBe(true);

    // Before Phase B (112ms < 125ms): pure drowsy bridge 58
    clockMs.value = 212;
    expect(evalCurr().transform).toEqual(slotTransform(58, 80));

    // Midpoint of Phase B (125 + 48 = 173ms elapsed -> clockMs = 273): smoothstep 58 -> 59
    clockMs.value = 273;
    const midCurr = evalCurr();
    const midPrev = evalPrev();
    expect(midCurr.opacity).toBeCloseTo(0.5, 2);
    expect(midPrev.opacity as number).toBeGreaterThan(0.5);
    expect(midPrev.opacity as number).toBeLessThan(0.8);
    expect(midPrev.transform).toEqual(slotTransform(58, 80));
    expect(midCurr.transform).toEqual(slotTransform(59, 80));

    // After Phase B completes (224ms elapsed -> clockMs = 324): pure snooze 59, prev opacity 0
    clockMs.value = 324;
    expect(evalCurr().opacity).toBe(1);
    expect(evalPrev().opacity).toBe(0);

    // 2) Wake from sleepy (59 -> 58 -> Pose0 idle) with Phase A + Phase B 96ms smoothstep
    mockWithTiming.mockClear();
    clockMs.value = 400;
    idleSec.value = 0.4;
    view.rerender(
      <EnemySpriteRig
        enemyName="Dozy Bunny"
        size={80}
        mood="menacing"
        healthState="pristine"
        activeReaction={null}
        reactionKey={0}
        painHitstopMs={painHitstop}
        spriteClockMs={clockMs}
        spriteIdleSec={idleSec}
        animate={true}
      />
    );
    expect(
      mockWithTiming.mock.calls.some(
        ([to, cfg]) =>
          to === 1 && (cfg as { duration?: number } | undefined)?.duration === SPRITE_TX.sleepBlendMs
      )
    ).toBe(true);

    // Phase A holds bridge 58 (elapsed = 80ms)
    clockMs.value = 480;
    expect(evalCurr().transform).toEqual(slotTransform(58, 80));

    // Phase B midpoint (elapsed = 125 + 48 = 173ms -> clockMs = 573): smoothstep 58 -> Pose0 (0)
    clockMs.value = 573;
    idleSec.value = 0.525;
    const wakeMidCurr = evalCurr();
    const wakeMidPrev = evalPrev();
    expect(wakeMidCurr.opacity).toBeCloseTo(0.5, 2);
    expect(wakeMidPrev.opacity as number).toBeGreaterThan(0.5);
    expect(wakeMidPrev.transform).toEqual(slotTransform(58, 80));
    expect(wakeMidCurr.transform).toEqual(slotTransform(0, 80));

    // After Phase B completes: pure idle with prev opacity 0
    clockMs.value = 640;
    idleSec.value = 0.6;
    expect(evalCurr().opacity).toBe(1);
    expect(evalPrev().opacity).toBe(0);
    view.unmount();

    // 3) knocked_out / defeat: Phase B smoothstep 58 -> 63
    clockMs.value = 0;
    idleSec.value = 0;
    mockCapturedAnimatedStyleFns = [];
    const koView = render(
      <EnemySpriteRig
        enemyName="Iron Shell"
        size={80}
        mood="defeat"
        healthState="knocked_out"
        activeReaction={null}
        reactionKey={0}
        painHitstopMs={painHitstop}
        spriteClockMs={clockMs}
        spriteIdleSec={idleSec}
        animate={true}
      />
    );
    const [, evalKoCurr, evalKoPrev] = mockCapturedAnimatedStyleFns.slice(-3);
    clockMs.value = 173;
    const koCurr = evalKoCurr();
    const koPrev = evalKoPrev();
    expect(koCurr.opacity).toBeCloseTo(0.5, 2);
    expect(koPrev.opacity as number).toBeGreaterThan(0.5);
    expect(koPrev.transform).toEqual(slotTransform(58, 80));
    expect(koCurr.transform).toEqual(slotTransform(63, 80));
    koView.unmount();
  });

  it('supports single-texture dual-layer crossfade, Silhouette Audit (#121212), cell-size agnostic scaling, lightweight 0-loop mode, reduced motion, and atlasBakedIdle', () => {
    jest.useFakeTimers();

    // 1) Dual-layer single-texture & cell-size agnostic sizing (44px, 80px, 128px)
    for (const sz of [44, 80, 128]) {
      const v = render(<EnemyAvatar enemy="Ancient Dragon" size={sz} mood="menacing" animate={false} />);
      expect(v.getByTestId('enemy-sprite-viewport')).toBeTruthy();
      expect(v.getAllByTestId('enemy-sprite-atlas')).toHaveLength(1);
      const primary = v.getByTestId('enemy-sprite-atlas');
      const prev = v.getByTestId('enemy-sprite-atlas-prev');
      expect(prev.props.source).toBe(primary.props.source);
      const flat = Array.isArray(primary.props.style)
        ? Object.assign({}, ...primary.props.style.filter(Boolean))
        : primary.props.style;
      expect(flat.width).toBe(sz * 8);
      expect(flat.height).toBe(sz * 8);
      v.unmount();
    }

    // 2) Preserves enemy-avatar, enemy-ground-shadow, enemy-damage-overlay, boss-atmospheric-halo
    const bossCombat = render(
      <EnemyAvatar
        enemy={{ name: 'The Hydra', tier: 4 }}
        hp={4}
        maxHp={10}
        size={88}
        mood="enraged"
        animate={true}
      />
    );
    expect(bossCombat.getByTestId('enemy-avatar')).toBeTruthy();
    expect(bossCombat.getByTestId('enemy-ground-shadow')).toBeTruthy();
    expect(bossCombat.getByTestId('enemy-damage-overlay')).toBeTruthy();
    expect(bossCombat.getByTestId('boss-atmospheric-halo')).toBeTruthy();
    bossCombat.unmount();

    // 3) Silhouette Audit mode (native tintColor OR web filter: brightness(0), no -prev layer)
    //    AND static displayOffsetX / displayScale alignment matches live viewport 1:1!
    const flattenStyle = (style: unknown): Record<string, unknown> =>
      Array.isArray(style)
        ? Object.assign({}, ...style.filter(Boolean))
        : ((style ?? {}) as Record<string, unknown>);

    const groundedLive = render(
      <EnemyAvatar enemy="Stone Sentinel" size={100} mood="menacing" animate={false} />
    );
    const groundedSil = render(
      <EnemyAvatar enemy="Stone Sentinel" size={100} silhouette animate={false} />
    );
    const expectedGroundedTransform = [
      { translateX: -0.131 * 100 * 1.24 },
      { translateY: -(1.24 - 1) * 100 * 0.44 },
      { scale: 1.24 },
    ];
    expect(flattenStyle(groundedLive.getByTestId('enemy-sprite-viewport').props.style).transform).toEqual(
      expectedGroundedTransform
    );
    expect(
      flattenStyle(groundedSil.getByTestId('enemy-sprite-silhouette').props.style).transform
    ).toEqual(expectedGroundedTransform);
    groundedLive.unmount();
    groundedSil.unmount();

    const hoverLive = render(
      <EnemyAvatar enemy="The Reaper" size={64} mood="menacing" animate={false} />
    );
    const sil = render(<EnemyAvatar enemy="The Reaper" size={64} silhouette animate={false} />);
    const expectedHoverTransform = [
      { translateX: -0.158 * 64 * 1.16 },
      { translateY: 0 },
      { scale: 1.16 },
    ];
    expect(flattenStyle(hoverLive.getByTestId('enemy-sprite-viewport').props.style).transform).toEqual(
      expectedHoverTransform
    );
    expect(flattenStyle(sil.getByTestId('enemy-sprite-silhouette').props.style).transform).toEqual(
      expectedHoverTransform
    );
    hoverLive.unmount();

    expect(sil.getByTestId('enemy-sprite-silhouette')).toBeTruthy();
    expect(sil.queryByTestId('enemy-sprite-atlas-prev')).toBeNull();
    const silImg = sil.getByTestId('enemy-sprite-atlas');
    const silStyle = flattenStyle(silImg.props.style);
    if (Platform.OS === 'web') {
      expect(silStyle.filter).toBe('brightness(0)');
    } else {
      expect(silImg.props.tintColor).toBe(SILHOUETTE_INK);
    }
    sil.unmount();

    // 4) Lightweight 0-loop GPU withRepeat mode + background/reduced-motion gating + unmount cleanup
    mockFrameCallbackCalls = [];
    mockWithRepeat.mockClear();
    const lw = render(<EnemyAvatar enemy="Dozy Bunny" size={56} mood="idle" lightweight animate={true} />);
    expect(lw.getByTestId('enemy-sprite-viewport')).toBeTruthy();
    expect(mockFrameCallbackCalls.every((active) => active === false)).toBe(true);
    expect(mockWithRepeat).toHaveBeenCalledTimes(1);

    mockCancelAnimation.mockClear();
    lw.unmount();
    expect(mockCancelAnimation).toHaveBeenCalled();

    // Backgrounding halts lightweight withRepeat loop cleanly
    mockWithRepeat.mockClear();
    mockFrameCallbackCalls = [];
    mockAppActive = false;
    const bg = render(<EnemyAvatar enemy="Prism Moth" size={56} mood="idle" lightweight animate={true} />);
    expect(mockFrameCallbackCalls.every((active) => active === false)).toBe(true);
    expect(mockWithRepeat).not.toHaveBeenCalled();
    bg.unmount();

    // Reduced motion uses ACCESSIBLE.fadeMs crossfades with 0 infinite loops and 0 active frame callbacks
    mockAppActive = true;
    mockReducedMotion = true;
    mockWithRepeat.mockClear();
    mockFrameCallbackCalls = [];
    const rm = render(<EnemyAvatar enemy="Stalking Wolf" size={72} mood="idle" animate={true} />);
    expect(mockFrameCallbackCalls.every((active) => active === false)).toBe(true);
    expect(mockWithRepeat).not.toHaveBeenCalled();

    mockWithTiming.mockClear();
    rm.rerender(<EnemyAvatar enemy="Stalking Wolf" size={72} mood="sleepy" animate={true} />);
    expect(
      mockWithTiming.mock.calls.some(
        ([to, cfg]) =>
          to === 1 && (cfg as { duration?: number } | undefined)?.duration === ACCESSIBLE.fadeMs
      )
    ).toBe(true);
    rm.unmount();

    // 5) atlasBakedIdle disables redundant procedural blinks/fidgets while preserving aligned combat clip holds
    mockReducedMotion = false;
    const speciesFidget = jest.fn(() => true);
    const speciesChoreography = jest.fn(() => true);
    const hook = renderHook(
      ({ reaction }: { reaction: { type: 'attack' | 'taunt' | 'pain'; id: number } | null }) =>
        useCreatureMotion(ENEMY_MOTION, {
          name: 'Stone Sentinel',
          size: 84,
          mood: 'menacing',
          healthState: 'pristine',
          personality: getEnemyPersonality('Stone Sentinel', 3),
          pivots: getEnemyRigPivots('Stone Sentinel'),
          massClass: 'boss',
          atlasBakedIdle: true,
          speciesChoreography,
          speciesFidget,
          reaction,
          animate: true,
          lively: true,
          interactive: false,
        }),
      { initialProps: { reaction: null as { type: 'attack' | 'taunt' | 'pain'; id: number } | null } }
    );

    act(() => {
      jest.advanceTimersByTime(12_000);
    });
    expect(speciesFidget).not.toHaveBeenCalled();
    expect(hook.result.current.blinkStage).toBe(0);
    expect(hook.result.current.isBlinking).toBe(false);

    // Boss attack holds exact clip completion: strikeStartMs (192ms) + 400ms = 592ms
    act(() => {
      hook.rerender({ reaction: { type: 'attack', id: 1 } });
    });
    expect(speciesChoreography).toHaveBeenCalledTimes(1);
    expect(hook.result.current.activeReaction).toBe('attack');

    const expectedAttackHoldMs = getEnemyAttackTimings('boss').strikeStartMs + ENEMY_CLIP_DURATION_MS.attack;
    act(() => {
      jest.advanceTimersByTime(expectedAttackHoldMs - 20);
    });
    expect(hook.result.current.activeReaction).toBe('attack');

    act(() => {
      jest.advanceTimersByTime(30);
    });
    expect(hook.result.current.activeReaction).toBeNull();
    hook.unmount();
  });
});
