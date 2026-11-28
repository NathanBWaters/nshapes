import React, { memo, useEffect, useRef } from 'react';
import { Image, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SILHOUETTE_INK } from '@/components/illustration/primitives';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  type EnemyAmbientMood,
  type EnemyHealthState,
  type EnemyReactionType,
  getEnemyAttackTimings,
} from '@/utils/enemyAnimations';
import {
  ACCESSIBLE,
  EASE,
  HIT,
  type MassClass,
  SPRING,
  SPRITE_TX,
  STAYS,
  seedFromKey,
} from '@/utils/motion';
import { getEnemySpriteAtlasSpec } from './enemySpriteRegistry';

export const ENEMY_ATLAS_COLS = 8;
export const ENEMY_ATLAS_ROWS = 8;
export const ENEMY_IDLE_FRAME_COUNT = 32;
export const ENEMY_ATLAS_MAX_INDEX = 63;

/**
 * Locked 8×8 (64-slot) Option B storybook enemy sprite atlas contract
 * (cell-size agnostic: `1280×1280` 160px Boss sheets & `1024×1024` 128px Meadow sheets;
 * all 64 slots share one Pose0-aligned crop window facing 3/4 LEFT):
 * - `idle`:   `0..31` (32f @ 16fps, 2000ms seamless cycle, canonical `Pose0` at `0`)
 * - `windup`: `32..35` (4f @ 16fps: `32` bridge -> `33` menacing coil -> `34..35` tense 2f living moving-hold)
 * - `attack`: `36..43` (8f @ 20fps: `36` 1f strike smear leftward -> `37..38` apex -> `39..40` follow-through -> `41..43` 3f recovery to `Pose0`)
 * - `taunt`:  `44..51` (8f @ 16fps: `44` crouch/smirk -> `45` gloating rise -> `46..47` cackling/boasting apex moving-hold -> `48` settle -> `49..51` 3f recovery to `Pose0`)
 * - `hurt`:   `52..57` (6f @ 16fps: `52` 1f impact stagger right held through hitstop -> `53` recoil peak -> `54..57` 4f recovery to `Pose0`)
 * - `sleepy`: `58..63` (6f @ 8fps: `58` drowsy droop bridge entering & waking -> `59..62` 4f living snooze loop -> `63` slumped KO/defeat)
 */
export const ENEMY_CLIPS = {
  idle: { start: 0, count: 32, fps: 16 },
  windup: { start: 32, count: 4, fps: 16 },
  attack: { start: 36, count: 8, fps: 20 },
  taunt: { start: 44, count: 8, fps: 16 },
  hurt: { start: 52, count: 6, fps: 16 },
  sleepy: { start: 58, count: 6, fps: 8 },
} as const;

/** Exact clip completion durations (ms) used for 1:1 reaction hold alignment. */
export const ENEMY_CLIP_DURATION_MS = {
  idleCycle: (ENEMY_CLIPS.idle.count / ENEMY_CLIPS.idle.fps) * 1000, // 2000ms
  windup: (ENEMY_CLIPS.windup.count / ENEMY_CLIPS.windup.fps) * 1000, // 250ms
  attack: (ENEMY_CLIPS.attack.count / ENEMY_CLIPS.attack.fps) * 1000, // 400ms
  taunt: (ENEMY_CLIPS.taunt.count / ENEMY_CLIPS.taunt.fps) * 1000, // 500ms
  hurtRecovery: Math.round(((ENEMY_CLIPS.hurt.count - 1) / ENEMY_CLIPS.hurt.fps) * 1000), // 313ms (53..57)
  sleepyBridge: Math.round(1000 / ENEMY_CLIPS.sleepy.fps), // 125ms
} as const;

export const ENEMY_FRAME = {
  idle0: 0,
  windup: 32,
  windupCoil: 33,
  windupHold0: 34,
  windupHold1: 35,
  attack: 36,
  attackApex: 37,
  attackEnd: 43,
  taunt: 44,
  tauntRise: 45,
  tauntApex0: 46,
  tauntApex1: 47,
  tauntSettle: 48,
  tauntEnd: 51,
  hurt: 52,
  hurtRecoil: 53,
  hurtEnd: 57,
  sleepyBridge: 58,
  sleepy: 59,
  knockedOut: 63,
} as const;

export type EnemyFrameIndex = (typeof ENEMY_FRAME)[keyof typeof ENEMY_FRAME];

/**
 * Smooth target idle playback speed multiplier for `useCreatureMotion`'s UI-thread
 * monotonic idle clock (`expApproach` smooths transitions so mood changes NEVER pop!).
 */
export function getEnemySpriteMoodTempo(mood: EnemyAmbientMood): number {
  switch (mood) {
    case 'enraged':
      return 1.32;
    case 'cornered':
      return 1.24;
    case 'victory':
      return 1.16;
    case 'menacing':
      return 1.1;
    case 'sleepy':
    case 'defeat':
      return 0.78;
    default:
      return 1;
  }
}

// Integer UI-thread state machine modes (zero string allocations inside worklets)
const MODE_IDLE = 0;
const MODE_WINDUP = 1;
const MODE_ATTACK = 2;
const MODE_TAUNT = 3;
const MODE_HURT = 4;
const MODE_VICTORY = 5;
const MODE_SLEEPY = 6;
const MODE_KO = 7;
const MODE_WAKE = 8;
const MODE_STATIC = 9;

const ATTACK_STEP_MS = 1000 / ENEMY_CLIPS.attack.fps; // 50ms
const TAUNT_STEP_MS = 1000 / ENEMY_CLIPS.taunt.fps; // 62.5ms
const HURT_STEP_MS = 1000 / ENEMY_CLIPS.hurt.fps; // 62.5ms
const SLEEPY_STEP_MS = 1000 / ENEMY_CLIPS.sleepy.fps; // 125ms
/** 2-frame living moving-hold cadence (8fps = 125ms/frame) for windup[34..35] & victory[46..47] */
const MOVING_HOLD_STEP_MS = 125;
/** Soft 2-frame entry blend into taunt[44] crouch/smirk */
const TAUNT_ENTRY_BLEND_MS = HIT.snapMs * 2;

function isPose0RecoveringMode(mode: number): boolean {
  return mode === MODE_ATTACK || mode === MODE_TAUNT || mode === MODE_HURT;
}

function isSleepyFamilyMode(mode: number): boolean {
  return mode === MODE_SLEEPY || mode === MODE_KO;
}

function isLoopingLightweightMode(mode: number): boolean {
  return mode === MODE_IDLE || mode === MODE_VICTORY || mode === MODE_SLEEPY || mode === MODE_WINDUP;
}

function isFiniteClipMode(mode: number): boolean {
  return mode === MODE_ATTACK || mode === MODE_TAUNT || mode === MODE_HURT || mode === MODE_WAKE;
}

/**
 * Pure worklet evaluating the exact atlas slot index (`0..63`) from UI-thread shared state.
 * Shared identically between JS transition latching and 60–120Hz `useAnimatedStyle` worklets.
 */
function evaluateEnemySpriteFrame(
  mode: number,
  clockMs: number,
  modeStartMs: number,
  idleSec: number,
  idleEpochSec: number,
  idleBaseFrame: number,
  lightweightStep: number,
  useLightweight: number,
  idleFps: number,
  windupStepMs: number,
  strikeStartMs: number,
  hitstopMs: number,
  staticFrame: number
): number {
  'worklet';
  const rawElapsed = clockMs - modeStartMs;
  const elapsedMs = rawElapsed > 0 ? rawElapsed : 0;

  if (mode === MODE_STATIC) {
    return staticFrame;
  }

  if (mode === MODE_IDLE) {
    if (useLightweight === 1) {
      const s =
        ((Math.floor(lightweightStep) % ENEMY_IDLE_FRAME_COUNT) + ENEMY_IDLE_FRAME_COUNT) %
        ENEMY_IDLE_FRAME_COUNT;
      return (s + idleBaseFrame) % ENEMY_IDLE_FRAME_COUNT;
    }
    const deltaSec = idleSec - idleEpochSec;
    const rawStep = Math.floor((deltaSec > 0 ? deltaSec : 0) * idleFps);
    const step =
      ((rawStep % ENEMY_IDLE_FRAME_COUNT) + ENEMY_IDLE_FRAME_COUNT) % ENEMY_IDLE_FRAME_COUNT;
    return (idleBaseFrame + step) % ENEMY_IDLE_FRAME_COUNT;
  }

  if (mode === MODE_WINDUP) {
    if (useLightweight === 1) {
      const s = Math.floor(lightweightStep * 0.5);
      return 34 + (((s % 2) + 2) % 2);
    }
    if (elapsedMs < windupStepMs) return 32;
    if (elapsedMs < windupStepMs * 2) return 33;
    const holdStep = Math.floor((elapsedMs - windupStepMs * 2) / MOVING_HOLD_STEP_MS);
    return 34 + (holdStep % 2);
  }

  if (mode === MODE_ATTACK) {
    if (elapsedMs < strikeStartMs) {
      const step = windupStepMs < strikeStartMs * 0.5 ? windupStepMs : strikeStartMs * 0.5;
      if (elapsedMs < step) return 32;
      if (strikeStartMs <= windupStepMs * 2 || elapsedMs < step * 2) return 33;
      const holdStep = Math.floor((elapsedMs - step * 2) / MOVING_HOLD_STEP_MS);
      return 34 + (holdStep % 2);
    }
    const atkStep = Math.floor((elapsedMs - strikeStartMs) / ATTACK_STEP_MS);
    return 36 + (atkStep > 7 ? 7 : atkStep);
  }

  if (mode === MODE_TAUNT) {
    const tauntStep = Math.floor(elapsedMs / TAUNT_STEP_MS);
    return 44 + (tauntStep > 7 ? 7 : tauntStep);
  }

  if (mode === MODE_HURT) {
    if (elapsedMs < hitstopMs) return 52;
    const recStep = Math.floor((elapsedMs - hitstopMs) / HURT_STEP_MS);
    return 53 + (recStep > 4 ? 4 : recStep);
  }

  if (mode === MODE_VICTORY) {
    if (useLightweight === 1) {
      const s = Math.floor(lightweightStep * 0.5);
      return 46 + (((s % 2) + 2) % 2);
    }
    if (elapsedMs < TAUNT_STEP_MS) return 44;
    if (elapsedMs < TAUNT_STEP_MS * 2) return 45;
    const apexStep = Math.floor((elapsedMs - TAUNT_STEP_MS * 2) / MOVING_HOLD_STEP_MS);
    return 46 + (apexStep % 2);
  }

  if (mode === MODE_SLEEPY) {
    if (useLightweight === 1) {
      const s = Math.floor(lightweightStep * 0.5);
      return 59 + (((s % 4) + 4) % 4);
    }
    if (elapsedMs < SLEEPY_STEP_MS) return 58;
    const snoozeStep = Math.floor((elapsedMs - SLEEPY_STEP_MS) / SLEEPY_STEP_MS);
    return 59 + (snoozeStep % 4);
  }

  if (mode === MODE_KO) {
    if (useLightweight === 1) return 63;
    return elapsedMs < SLEEPY_STEP_MS ? 58 : 63;
  }

  if (mode === MODE_WAKE) {
    if (elapsedMs < SLEEPY_STEP_MS) return 58;
    if (useLightweight === 1) {
      const s =
        ((Math.floor(lightweightStep) % ENEMY_IDLE_FRAME_COUNT) + ENEMY_IDLE_FRAME_COUNT) %
        ENEMY_IDLE_FRAME_COUNT;
      return s;
    }
    const deltaSec = idleSec - idleEpochSec;
    const rawStep = Math.floor((deltaSec > 0 ? deltaSec : 0) * idleFps);
    return ((rawStep % ENEMY_IDLE_FRAME_COUNT) + ENEMY_IDLE_FRAME_COUNT) % ENEMY_IDLE_FRAME_COUNT;
  }

  return 0;
}

interface ResolvedTargetState {
  mode: number;
  staticFrame: number;
}

function resolveStaticPoseFrame(params: {
  silhouette: boolean;
  healthState: EnemyHealthState;
  activeReaction: EnemyReactionType | null;
  mood: EnemyAmbientMood;
  lightweight: boolean;
}): number {
  const { silhouette, healthState, activeReaction, mood, lightweight } = params;
  if (silhouette) return ENEMY_FRAME.idle0;
  if (healthState === 'knocked_out' && activeReaction !== 'regen') {
    return ENEMY_FRAME.knockedOut;
  }
  if (activeReaction) {
    switch (activeReaction) {
      case 'attack':
        return ENEMY_FRAME.attackApex;
      case 'taunt':
      case 'regen':
      case 'poke':
      case 'rage_spin':
        return ENEMY_FRAME.tauntApex0;
      case 'pain':
      case 'crit_pain':
        return ENEMY_FRAME.hurt;
      case 'entrance':
        return ENEMY_FRAME.windupCoil;
      default:
        return ENEMY_FRAME.idle0;
    }
  }
  if (mood === 'defeat') return ENEMY_FRAME.knockedOut;
  if (mood === 'sleepy') return ENEMY_FRAME.sleepy;
  if (mood === 'victory') return ENEMY_FRAME.tauntApex0;
  if (mood === 'enraged' && !lightweight) return ENEMY_FRAME.windupCoil;
  return ENEMY_FRAME.idle0;
}

function resolveTargetState(params: {
  silhouette: boolean;
  healthState: EnemyHealthState;
  activeReaction: EnemyReactionType | null;
  mood: EnemyAmbientMood;
  animate: boolean;
  reducedMotion: boolean;
  quiet: boolean;
  lightweight: boolean;
}): ResolvedTargetState {
  const staticFrame = resolveStaticPoseFrame(params);
  if (params.silhouette || !params.animate || params.reducedMotion || params.quiet) {
    return { mode: MODE_STATIC, staticFrame };
  }
  if (params.healthState === 'knocked_out' && params.activeReaction !== 'regen') {
    return { mode: MODE_KO, staticFrame };
  }
  if (params.activeReaction) {
    switch (params.activeReaction) {
      case 'attack':
        return { mode: MODE_ATTACK, staticFrame };
      case 'taunt':
      case 'regen':
      case 'poke':
      case 'rage_spin':
        return { mode: MODE_TAUNT, staticFrame };
      case 'pain':
      case 'crit_pain':
        return { mode: MODE_HURT, staticFrame };
      case 'entrance':
        return { mode: MODE_WINDUP, staticFrame };
      default:
        return { mode: MODE_IDLE, staticFrame };
    }
  }
  if (params.mood === 'defeat') {
    return { mode: MODE_KO, staticFrame };
  }
  if (params.mood === 'sleepy') {
    return { mode: MODE_SLEEPY, staticFrame };
  }
  if (params.mood === 'victory') {
    return { mode: MODE_VICTORY, staticFrame };
  }
  return { mode: MODE_IDLE, staticFrame };
}

function computeClipFallbackDurationMs(
  mode: number,
  strikeStartMs: number,
  hitstopMs: number
): number {
  switch (mode) {
    case MODE_ATTACK:
      return strikeStartMs + ENEMY_CLIP_DURATION_MS.attack;
    case MODE_TAUNT:
      return ENEMY_CLIP_DURATION_MS.taunt;
    case MODE_HURT:
      return hitstopMs + ENEMY_CLIP_DURATION_MS.hurtRecovery;
    case MODE_WAKE:
      return ENEMY_CLIP_DURATION_MS.sleepyBridge + SPRITE_TX.sleepBlendMs;
    default:
      return ENEMY_CLIP_DURATION_MS.taunt;
  }
}

export interface EnemySpriteRigProps {
  enemyName: string;
  size: number;
  mood: EnemyAmbientMood;
  healthState: EnemyHealthState;
  activeReaction: EnemyReactionType | null;
  reactionKey: number;
  /** Pre-strike windup duration (ms) from `getEnemyAttackTimings(massClass).strikeStartMs` */
  attackStrikeStartMs?: number;
  /** Physical inertia mass class (`nimble` | `standard` | `heavy` | `boss`) */
  massClass?: MassClass;
  /** Live UI-thread hitstop duration (ms) for active `pain` / `crit_pain` reaction */
  painHitstopMs?: SharedValue<number>;
  /** Monotonic UI-thread elapsed clock (ms) driven by `useCreatureMotion`'s single frame loop */
  spriteClockMs?: SharedValue<number>;
  /** Monotonic UI-thread tempo-integrated idle clock (seconds) driven by `useCreatureMotion`'s single frame loop */
  spriteIdleSec?: SharedValue<number>;
  /** Whether sprite animation should run */
  animate: boolean;
  /** Lightweight hub/map chrome mode (0 frame loops, pure GPU `withRepeat`) */
  lightweight?: boolean;
  /** Keep sprite pose static when in-game Effects switch is off */
  quiet?: boolean;
  /** Solid `#121212` silhouette audit mode (`[UI-07]`) */
  silhouette?: boolean;
}

/**
 * Option B Unified UI-Thread Hybrid Enemy Sprite State Machine (`8×8` / 64-slot WebP atlas).
 *
 * - Cell-size agnostic (`1280×1280` 160px Boss sheets & `1024×1024` 128px Meadow sheets).
 * - Piggybacks on `useCreatureMotion`'s single `useGuardedFrameCallback` clock in live combat/studio
 *   mode (`0` extra frame loops!), and uses GPU-only `withRepeat` (`0` frame loops, gated on
 *   `useAppActive()` + `!reducedMotion` + `cancelAnimation`) in `lightweight` mode.
 * - Monotonic idle clock NEVER resets across `idle`, `menacing`, `enraged`, and `cornered`.
 * - Single-texture dual-layer crossfade (`0` extra VRAM): `0ms` Sakurai snaps on `attack` strike &
 *   `pain`/`crit_pain` hit impacts, `64ms` `recoverBlendMs` back to `Pose0` idle, and `96ms`
 *   `sleepBlendMs` Phase A AND Phase B smoothstep bridges for `sleepy`, `defeat`/`knocked_out`, and wake.
 */
export const EnemySpriteRig: React.FC<EnemySpriteRigProps> = memo(function EnemySpriteRig({
  enemyName,
  size,
  mood,
  healthState,
  activeReaction,
  reactionKey,
  attackStrikeStartMs,
  massClass,
  painHitstopMs,
  spriteClockMs,
  spriteIdleSec,
  animate,
  lightweight = false,
  quiet = false,
  silhouette = false,
}) {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const spec = getEnemySpriteAtlasSpec(enemyName);
  const atlasSource = spec?.source;
  const idleFps = spec?.idleFps ?? ENEMY_CLIPS.idle.fps;
  const windupStepMs = spec?.windupStepMs ?? 1000 / ENEMY_CLIPS.windup.fps;
  const isHover = spec?.hover ?? false;
  const displayOffsetX = spec?.displayOffsetX ?? 0;
  const displayScale = spec?.displayScale ?? 1;
  const isBoss = massClass === 'boss' || spec?.isBoss === true;
  const resolvedStrikeStartMs =
    attackStrikeStartMs ?? getEnemyAttackTimings(massClass ?? (isBoss ? 'boss' : 'standard')).strikeStartMs;

  const initialPhaseOffset = (seedFromKey(enemyName) * 7) % ENEMY_IDLE_FRAME_COUNT;
  const target = resolveTargetState({
    silhouette,
    healthState,
    activeReaction,
    mood,
    animate,
    reducedMotion,
    quiet,
    lightweight,
  });

  // Fallback local shared values when mounted standalone or in `lightweight` mode (0 frame loops)
  const fallbackClockMs = useSharedValue(0);
  const fallbackIdleSec = useSharedValue(0);
  const fallbackHitstopMs = useSharedValue<number>(HIT.holdMs);

  const useLightweightClock = lightweight || !spriteClockMs || !spriteIdleSec;
  const clockMsSV = useLightweightClock ? fallbackClockMs : spriteClockMs;
  const idleSecSV = useLightweightClock ? fallbackIdleSec : spriteIdleSec;
  const hitstopSourceSV = painHitstopMs ?? fallbackHitstopMs;

  const lightweightLoopSV = useSharedValue(0);
  const modeSV = useSharedValue<number>(target.mode);
  const modeStartMsSV = useSharedValue<number>(0);
  const idleEpochSecSV = useSharedValue<number>(0);
  const idleBaseFrameSV = useSharedValue<number>(initialPhaseOffset);
  const staticFrameSV = useSharedValue<number>(target.staticFrame);
  const idleFpsSV = useSharedValue<number>(idleFps);
  const windupStepMsSV = useSharedValue<number>(windupStepMs);
  const strikeStartMsSV = useSharedValue<number>(resolvedStrikeStartMs);
  const hitstopMsSV = useSharedValue<number>(HIT.holdMs);
  const prevFrameSV = useSharedValue<number>(target.staticFrame);
  const blendProgressSV = useSharedValue<number>(1);
  const settleScaleYSV = useSharedValue<number>(1);

  // Latch timing hints in a ref BEFORE the transition effect so async prop updates mid-clip
  // NEVER restart or snap an active reaction!
  const timingHintsRef = useRef({
    strikeStartMs: resolvedStrikeStartMs,
    windupStepMs,
    idleFps,
    isBoss,
    isHover,
  });
  useEffect(() => {
    timingHintsRef.current = {
      strikeStartMs: resolvedStrikeStartMs,
      windupStepMs,
      idleFps,
      isBoss,
      isHover,
    };
  }, [resolvedStrikeStartMs, windupStepMs, idleFps, isBoss, isHover]);

  const isFirstEffectRef = useRef(true);
  const prevStateRef = useRef({
    enemyName,
    mode: target.mode,
    staticFrame: target.staticFrame,
    reactionKey,
    activeReaction,
  });

  // Unified deterministic UI-thread state-machine transition effect (zero JS setTimeout / useState races)
  useEffect(() => {
    if (isFirstEffectRef.current) {
      isFirstEffectRef.current = false;
      const nowMs = clockMsSV.value;
      const nowIdleSec = idleSecSV.value;
      const hints = timingHintsRef.current;
      idleEpochSecSV.value = nowIdleSec;
      modeStartMsSV.value = useLightweightClock ? 0 : nowMs;
      if (target.mode === MODE_HURT) {
        const rawHitstop = hitstopSourceSV.value > 0 ? hitstopSourceSV.value : HIT.holdMs;
        const baseHitstop =
          activeReaction === 'crit_pain' ? Math.max(rawHitstop, HIT.tierHoldMs[1]) : rawHitstop;
        hitstopMsSV.value = hints.isBoss
          ? Math.min(HIT.maxHoldMs, Math.round(baseHitstop * 1.15))
          : baseHitstop;
      }
      if (useLightweightClock && isFiniteClipMode(target.mode)) {
        const durMs = computeClipFallbackDurationMs(
          target.mode,
          hints.strikeStartMs,
          hitstopMsSV.value
        );
        fallbackClockMs.value = 0;
        fallbackClockMs.value = withTiming(durMs, { duration: durMs, easing: Easing.linear });
      }
      return;
    }

    const prev = prevStateRef.current;
    const enemyChanged = prev.enemyName !== enemyName;
    const isNewReaction = activeReaction !== null && reactionKey !== prev.reactionKey;
    const staticPoseChanged =
      target.mode === MODE_STATIC &&
      prev.mode === MODE_STATIC &&
      target.staticFrame !== prev.staticFrame;

    // Preserve monotonic idle clock across mood/tempo changes (`idle -> menacing -> enraged -> cornered`)
    // AND across already-completed `MODE_WAKE -> MODE_IDLE` transitions!
    const staysInIdleFamily =
      !enemyChanged &&
      !isNewReaction &&
      target.mode === MODE_IDLE &&
      (prev.mode === MODE_IDLE || prev.mode === MODE_WAKE);

    const isNoOp =
      !enemyChanged &&
      !isNewReaction &&
      !staticPoseChanged &&
      (staysInIdleFamily || target.mode === prev.mode);

    if (isNoOp) {
      prevStateRef.current = {
        enemyName,
        mode: prev.mode,
        staticFrame: target.staticFrame,
        reactionKey,
        activeReaction,
      };
      return;
    }

    const nowMs = clockMsSV.value;
    const nowIdleSec = idleSecSV.value;
    const currentRenderedFrame = evaluateEnemySpriteFrame(
      modeSV.value,
      nowMs,
      modeStartMsSV.value,
      nowIdleSec,
      idleEpochSecSV.value,
      idleBaseFrameSV.value,
      lightweightLoopSV.value,
      useLightweightClock ? 1 : 0,
      idleFpsSV.value,
      windupStepMsSV.value,
      strikeStartMsSV.value,
      hitstopMsSV.value,
      staticFrameSV.value
    );

    // Waking from sleepy/defeat/KO routes through drowsy bridge `58` (125ms) -> Pose0 idle
    const nextMode =
      !enemyChanged && target.mode === MODE_IDLE && isSleepyFamilyMode(prev.mode)
        ? MODE_WAKE
        : target.mode;

    // Capture species & reaction timing parameters ONCE per trigger
    const hints = timingHintsRef.current;
    const capturedStrikeStartMs = hints.strikeStartMs;
    const rawHitstop = hitstopSourceSV.value > 0 ? hitstopSourceSV.value : HIT.holdMs;
    const baseHitstop =
      nextMode === MODE_HURT && activeReaction === 'crit_pain'
        ? Math.max(rawHitstop, HIT.tierHoldMs[1])
        : rawHitstop;
    const capturedHitstopMs = hints.isBoss
      ? Math.min(HIT.maxHoldMs, Math.round(baseHitstop * 1.15))
      : baseHitstop;

    idleFpsSV.value = hints.idleFps;
    windupStepMsSV.value = hints.windupStepMs;

    if (nextMode === MODE_ATTACK) {
      strikeStartMsSV.value = capturedStrikeStartMs;
    } else if (nextMode === MODE_HURT) {
      hitstopMsSV.value = capturedHitstopMs;
    }

    staticFrameSV.value = target.staticFrame;

    if (enemyChanged) {
      idleBaseFrameSV.value = initialPhaseOffset;
      idleEpochSecSV.value = nowIdleSec;
    } else if (nextMode === MODE_IDLE && isPose0RecoveringMode(prev.mode)) {
      // Recovery tail (`43` / `51` / `57`) aligns to `Pose0` (`0`), so anchor idle cleanly at `0`
      idleEpochSecSV.value = nowIdleSec;
      idleBaseFrameSV.value = 0;
    } else if (nextMode === MODE_WAKE) {
      // Bridge `58` holds for 125ms, then idle starts at `Pose0` (`0`)
      idleEpochSecSV.value = nowIdleSec + ENEMY_CLIP_DURATION_MS.sleepyBridge / 1000;
      idleBaseFrameSV.value = 0;
    }

    // In lightweight/standalone mode without external frame clock, drive finite one-shot clips
    // cleanly via a finite `withTiming` (0 frame loops, 0 infinite repeats)
    if (useLightweightClock) {
      cancelAnimation(fallbackClockMs);
      if (isFiniteClipMode(nextMode)) {
        const durMs = computeClipFallbackDurationMs(
          nextMode,
          capturedStrikeStartMs,
          capturedHitstopMs
        );
        fallbackClockMs.value = 0;
        modeStartMsSV.value = 0;
        fallbackClockMs.value = withTiming(durMs, { duration: durMs, easing: Easing.linear });
      } else {
        fallbackClockMs.value = 0;
        modeStartMsSV.value = 0;
      }
    } else {
      modeStartMsSV.value = nowMs;
    }

    modeSV.value = nextMode;

    // Resolve dual-layer crossfade duration from `SPRITE_TX` blend matrix
    let blendMs: number = SPRITE_TX.snapMs;
    let shouldCushionSettle = false;

    if (enemyChanged || silhouette) {
      blendMs = SPRITE_TX.snapMs;
    } else if (reducedMotion) {
      blendMs = ACCESSIBLE.fadeMs;
    } else if (quiet || !animate) {
      blendMs = SPRITE_TX.snapMs;
    } else if (nextMode === MODE_HURT) {
      // Instant 0ms Sakurai impact snap for pain, crit_pain, and rapid hit-chains!
      blendMs = SPRITE_TX.snapMs;
    } else if (nextMode === MODE_ATTACK) {
      // Smooth pre-strike windup entry (finishes strictly before `strikeStartMs`, where strike snaps in 0ms!)
      blendMs =
        prev.mode === MODE_WINDUP
          ? SPRITE_TX.snapMs
          : Math.min(SPRITE_TX.moodBlendMs, Math.max(HIT.snapMs * 2, Math.floor(capturedStrikeStartMs * 0.5)));
    } else if (nextMode === MODE_SLEEPY || nextMode === MODE_KO || nextMode === MODE_WAKE) {
      blendMs = SPRITE_TX.sleepBlendMs;
    } else if (nextMode === MODE_VICTORY) {
      blendMs = SPRITE_TX.sleepBlendMs;
    } else if (nextMode === MODE_IDLE && isPose0RecoveringMode(prev.mode)) {
      blendMs = SPRITE_TX.recoverBlendMs;
      shouldCushionSettle = true;
    } else if (nextMode === MODE_IDLE && prev.mode === MODE_VICTORY) {
      blendMs = SPRITE_TX.recoverBlendMs;
    } else if (nextMode === MODE_WINDUP || (nextMode === MODE_IDLE && prev.mode === MODE_WINDUP)) {
      blendMs = SPRITE_TX.moodBlendMs;
    } else if (nextMode === MODE_TAUNT) {
      blendMs = TAUNT_ENTRY_BLEND_MS;
    } else if (nextMode === MODE_STATIC) {
      blendMs = SPRITE_TX.recoverBlendMs;
    }

    const nextInitialFrame = evaluateEnemySpriteFrame(
      nextMode,
      useLightweightClock ? 0 : nowMs,
      modeStartMsSV.value,
      nowIdleSec,
      idleEpochSecSV.value,
      idleBaseFrameSV.value,
      lightweightLoopSV.value,
      useLightweightClock ? 1 : 0,
      idleFpsSV.value,
      windupStepMsSV.value,
      strikeStartMsSV.value,
      hitstopMsSV.value,
      target.staticFrame
    );

    cancelAnimation(blendProgressSV);
    if (blendMs > 0 && currentRenderedFrame !== nextInitialFrame) {
      prevFrameSV.value = currentRenderedFrame;
      blendProgressSV.value = 0;
      blendProgressSV.value = withTiming(1, {
        duration: blendMs,
        easing: reducedMotion ? EASE.ui : EASE.state,
        ...STAYS,
      });
    } else {
      prevFrameSV.value = nextInitialFrame;
      blendProgressSV.value = 1;
    }

    if (shouldCushionSettle && !reducedMotion && !quiet) {
      cancelAnimation(settleScaleYSV);
      settleScaleYSV.value = withSequence(
        withTiming(SPRITE_TX.settleSquashY, {
          duration: SPRITE_TX.recoverBlendMs,
          easing: EASE.ui,
        }),
        withSpring(1, SPRING.snappy)
      );
    } else if (enemyChanged || reducedMotion || quiet) {
      cancelAnimation(settleScaleYSV);
      settleScaleYSV.value = 1;
    }

    prevStateRef.current = {
      enemyName,
      mode: nextMode,
      staticFrame: target.staticFrame,
      reactionKey,
      activeReaction,
    };
  }, [
    enemyName,
    target.mode,
    target.staticFrame,
    activeReaction,
    reactionKey,
    animate,
    quiet,
    reducedMotion,
    silhouette,
    useLightweightClock,
    initialPhaseOffset,
    clockMsSV,
    idleSecSV,
    hitstopSourceSV,
    fallbackClockMs,
    lightweightLoopSV,
    modeSV,
    modeStartMsSV,
    idleEpochSecSV,
    idleBaseFrameSV,
    staticFrameSV,
    idleFpsSV,
    windupStepMsSV,
    strikeStartMsSV,
    hitstopMsSV,
    prevFrameSV,
    blendProgressSV,
    settleScaleYSV,
  ]);

  // Battery-safe GPU-only `withRepeat` loop strictly for `lightweight` / standalone mode (0 frame loops!)
  // NOTE: Intentionally omits `mood` from dependencies so mood changes NEVER reset loop phase!
  const shouldRunLightweightLoop =
    Boolean(atlasSource) &&
    useLightweightClock &&
    animate &&
    appActive &&
    !reducedMotion &&
    !quiet &&
    !silhouette &&
    isLoopingLightweightMode(target.mode);

  const idleCycleDurationMs = Math.round((ENEMY_IDLE_FRAME_COUNT / idleFps) * 1000);

  useEffect(() => {
    if (!shouldRunLightweightLoop) {
      cancelAnimation(lightweightLoopSV);
      return;
    }
    lightweightLoopSV.value = 0;
    lightweightLoopSV.value = withRepeat(
      withTiming(ENEMY_IDLE_FRAME_COUNT, {
        duration: idleCycleDurationMs,
        easing: Easing.linear,
      }),
      -1,
      false
    );
    return () => {
      cancelAnimation(lightweightLoopSV);
    };
  }, [shouldRunLightweightLoop, idleCycleDurationMs, lightweightLoopSV]);

  // Ensure every Reanimated driver cancels cleanly on unmount
  useEffect(() => {
    return () => {
      cancelAnimation(lightweightLoopSV);
      cancelAnimation(fallbackClockMs);
      cancelAnimation(blendProgressSV);
      cancelAnimation(settleScaleYSV);
    };
  }, [lightweightLoopSV, fallbackClockMs, blendProgressSV, settleScaleYSV]);

  // Integer cell pixel size prevents 0.5px subpixel bleed between neighboring atlas cells on Web
  const cellSize = Math.max(16, Math.round(size));
  const atlasWidth = cellSize * ENEMY_ATLAS_COLS;
  const atlasHeight = cellSize * ENEMY_ATLAS_ROWS;
  // Grounded foes anchor settle squash at feet; floating/hovering foes cushion around center
  const settleAnchorY = isHover ? 0 : cellSize * 0.35;
  const lightweightFlag = useLightweightClock ? 1 : 0;

  const settleWrapStyle = useAnimatedStyle(() => {
    'worklet';
    const sy = settleScaleYSV.value;
    const sx = sy === 1 ? 1 : 1 / sy;
    if (settleAnchorY === 0) {
      return {
        transform: [{ scaleX: sx }, { scaleY: sy }],
      };
    }
    return {
      transform: [
        { translateY: settleAnchorY },
        { scaleX: sx },
        { scaleY: sy },
        { translateY: -settleAnchorY },
      ],
    };
  });

  // Primary live-pose layer (GPU-composited transform + opacity only)
  const currAtlasStyle = useAnimatedStyle(() => {
    'worklet';
    const mode = modeSV.value;
    const nowMs = clockMsSV.value;
    const startMs = modeStartMsSV.value;
    const elapsedMs = nowMs > startMs ? nowMs - startMs : 0;
    const idx = evaluateEnemySpriteFrame(
      mode,
      nowMs,
      startMs,
      idleSecSV.value,
      idleEpochSecSV.value,
      idleBaseFrameSV.value,
      lightweightLoopSV.value,
      lightweightFlag,
      idleFpsSV.value,
      windupStepMsSV.value,
      strikeStartMsSV.value,
      hitstopMsSV.value,
      staticFrameSV.value
    );
    const clampedIdx = idx < 0 ? 0 : idx > ENEMY_ATLAS_MAX_INDEX ? ENEMY_ATLAS_MAX_INDEX : idx;
    const col = clampedIdx % ENEMY_ATLAS_COLS;
    const row = Math.floor(clampedIdx / ENEMY_ATLAS_COLS);

    let currOpacity = blendProgressSV.value;

    // Guaranteed 0ms Sakurai strike snap at `strikeStartMs` (never blur strike frame `36` with windup!)
    if (mode === MODE_ATTACK && elapsedMs >= strikeStartMsSV.value) {
      currOpacity = 1;
    } else if (mode === MODE_WAKE && elapsedMs >= SLEEPY_STEP_MS) {
      // Phase B of `MODE_WAKE`: smooth 96ms UI-thread blend from drowsy bridge `58` -> Pose0 idle
      if (elapsedMs < SLEEPY_STEP_MS + SPRITE_TX.sleepBlendMs) {
        const t = (elapsedMs - SLEEPY_STEP_MS) / SPRITE_TX.sleepBlendMs;
        currOpacity = t * t * (3 - 2 * t);
      } else {
        currOpacity = 1;
      }
    } else if (
      lightweightFlag === 0 &&
      (mode === MODE_SLEEPY || mode === MODE_KO) &&
      elapsedMs >= SLEEPY_STEP_MS
    ) {
      // Phase B of `MODE_SLEEPY` / `MODE_KO`: smooth 96ms UI-thread blend from drowsy bridge `58` -> snooze `59` / KO `63`
      if (elapsedMs < SLEEPY_STEP_MS + SPRITE_TX.sleepBlendMs) {
        const t = (elapsedMs - SLEEPY_STEP_MS) / SPRITE_TX.sleepBlendMs;
        currOpacity = t * t * (3 - 2 * t);
      } else {
        currOpacity = 1;
      }
    }

    return {
      opacity: currOpacity,
      transform: [
        { translateX: -col * cellSize },
        { translateY: -row * cellSize },
      ],
    };
  });

  // Secondary previous-pose layer sharing the exact same atlas texture (`0` extra VRAM; `opacity: 0` at rest)
  const prevAtlasStyle = useAnimatedStyle(() => {
    'worklet';
    const mode = modeSV.value;
    const nowMs = clockMsSV.value;
    const startMs = modeStartMsSV.value;
    const elapsedMs = nowMs > startMs ? nowMs - startMs : 0;

    let prevIdx = prevFrameSV.value;
    let p = blendProgressSV.value;

    if (mode === MODE_ATTACK && elapsedMs >= strikeStartMsSV.value) {
      p = 1;
    } else if (mode === MODE_WAKE && elapsedMs >= SLEEPY_STEP_MS) {
      if (elapsedMs < SLEEPY_STEP_MS + SPRITE_TX.sleepBlendMs) {
        prevIdx = ENEMY_FRAME.sleepyBridge;
        const t = (elapsedMs - SLEEPY_STEP_MS) / SPRITE_TX.sleepBlendMs;
        p = t * t * (3 - 2 * t);
      } else {
        p = 1;
      }
    } else if (
      lightweightFlag === 0 &&
      (mode === MODE_SLEEPY || mode === MODE_KO) &&
      elapsedMs >= SLEEPY_STEP_MS
    ) {
      if (elapsedMs < SLEEPY_STEP_MS + SPRITE_TX.sleepBlendMs) {
        prevIdx = ENEMY_FRAME.sleepyBridge;
        const t = (elapsedMs - SLEEPY_STEP_MS) / SPRITE_TX.sleepBlendMs;
        p = t * t * (3 - 2 * t);
      } else {
        p = 1;
      }
    }

    // Lifted-floor crossfade preserves solid core opacity mid-blend and reaches 0 smoothly with zero pop
    const prevOpacity = p >= 0.999 ? 0 : (1 - p) * (1 + 0.55 * p);
    const clampedIdx =
      prevIdx < 0 ? 0 : prevIdx > ENEMY_ATLAS_MAX_INDEX ? ENEMY_ATLAS_MAX_INDEX : prevIdx;
    const col = clampedIdx % ENEMY_ATLAS_COLS;
    const row = Math.floor(clampedIdx / ENEMY_ATLAS_COLS);

    return {
      opacity: prevOpacity,
      transform: [
        { translateX: -col * cellSize },
        { translateY: -row * cellSize },
      ],
    };
  });

  if (!atlasSource) return null;

  const webViewportStyle =
    Platform.OS === 'web'
      ? ({ contain: 'layout style paint' } as ViewStyle)
      : undefined;
  const webLayerStyle =
    Platform.OS === 'web'
      ? ({ willChange: 'transform' } as ViewStyle)
      : undefined;
  const webSilhouetteImgStyle =
    silhouette && Platform.OS === 'web'
      ? ({ filter: 'brightness(0)' } as any)
      : undefined;
  const displayTransformStyle: ViewStyle | undefined =
    displayOffsetX !== 0 || displayScale !== 1
      ? {
          transform: [
            { translateX: displayOffsetX * cellSize * displayScale },
            { translateY: isHover ? 0 : -(displayScale - 1) * cellSize * 0.44 },
            { scale: displayScale },
          ],
        }
      : undefined;

  return (
    <View
      testID={silhouette ? 'enemy-sprite-silhouette' : 'enemy-sprite-viewport'}
      pointerEvents="none"
      style={[
        styles.viewport,
        webViewportStyle,
        { width: cellSize, height: cellSize },
        displayTransformStyle,
      ]}
    >
      <Animated.View
        style={[
          styles.settleWrap,
          webLayerStyle,
          { width: cellSize, height: cellSize },
          settleWrapStyle,
        ]}
      >
        {!silhouette && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.layerAbsolute,
              { width: atlasWidth, height: atlasHeight },
              webLayerStyle,
              prevAtlasStyle,
            ]}
          >
            <Image
              testID="enemy-sprite-atlas-prev"
              source={atlasSource}
              resizeMode="stretch"
              accessibilityIgnoresInvertColors
              style={{ width: atlasWidth, height: atlasHeight }}
            />
          </Animated.View>
        )}
        <Animated.View
          style={[
            styles.layerAbsolute,
            { width: atlasWidth, height: atlasHeight },
            webLayerStyle,
            currAtlasStyle,
          ]}
        >
          <Image
            testID="enemy-sprite-atlas"
            source={atlasSource}
            resizeMode="stretch"
            accessibilityIgnoresInvertColors
            tintColor={silhouette && Platform.OS !== 'web' ? SILHOUETTE_INK : undefined}
            style={[
              { width: atlasWidth, height: atlasHeight },
              webSilhouetteImgStyle,
            ]}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
    position: 'relative',
  },
  settleWrap: {
    position: 'relative',
  },
  layerAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
