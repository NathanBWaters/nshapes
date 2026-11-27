import React, { memo, useEffect, useRef } from 'react';
import { Image, Platform, StyleSheet, View, type ImageSourcePropType, type ViewStyle } from 'react-native';
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
import type { BlinkStage } from '@/components/creatures/types';
import { SILHOUETTE_INK } from '@/components/illustration/primitives';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { CreatureHealthState } from '@/utils/creatureAnimations';
import type { FighterAmbientMood } from '@/utils/fighterAnimations';
import {
  ACCESSIBLE,
  CHEER,
  EASE,
  HIT,
  SPRING,
  SPRITE_TX,
  STAYS,
  THROW,
  seedFromKey,
} from '@/utils/motion';
import type { FighterOverlayReactionType } from './FighterEffectsOverlay';

export const FIGHTER_ATLAS_COLS = 8;
export const FIGHTER_ATLAS_ROWS = 8;
export const FIGHTER_IDLE_FRAME_COUNT = 32;
export const FIGHTER_ATLAS_MAX_INDEX = 63;

/**
 * Locked 8×8 (64-slot) Option B storybook sprite atlas contract (`1280×1280`, `160×160` cells),
 * identical slot indices across all 6 heroes (all clips share one Pose0-aligned crop window):
 * - `idle`:   `0..31` (32f @ 16fps, 2000ms seamless cycle, canonical `Pose0` at `0`)
 * - `windup`: `32..35` (4f @ 16fps: `32` bridge -> `33` full coil -> `34..35` 2f living moving-hold loop)
 * - `attack`: `36..43` (8f @ 20fps: `36` 1f strike smear -> `37..38` apex -> `39..40` follow-through -> `41..43` 3f recovery to `Pose0`)
 * - `cheer`:  `44..51` (8f @ 16fps: `44` grounded crouch -> `45` takeoff -> `46..47` apex moving hold -> `48` land squash -> `49..51` 3f settle to `Pose0`)
 * - `hurt`:   `52..57` (6f @ 16fps: `52` 1f impact wince held through hitstop -> `53` recoil peak -> `54..57` 4f recovery to `Pose0`)
 * - `sleepy`: `58..63` (6f @ 8fps: `58` drowsy bridge entering & waking -> `59..62` 4f living snooze loop -> `63` slumped KO/defeat)
 */
export const FIGHTER_CLIPS = {
  idle: { start: 0, count: 32, fps: 16 },
  windup: { start: 32, count: 4, fps: 16 },
  attack: { start: 36, count: 8, fps: 20 },
  cheer: { start: 44, count: 8, fps: 16 },
  hurt: { start: 52, count: 6, fps: 16 },
  sleepy: { start: 58, count: 6, fps: 8 },
} as const;

/** Exact clip completion durations (ms) used for 1:1 reaction hold alignment. */
export const FIGHTER_CLIP_DURATION_MS = {
  idleCycle: (FIGHTER_CLIPS.idle.count / FIGHTER_CLIPS.idle.fps) * 1000, // 2000ms
  attack: (FIGHTER_CLIPS.attack.count / FIGHTER_CLIPS.attack.fps) * 1000, // 400ms
  cheer: (FIGHTER_CLIPS.cheer.count / FIGHTER_CLIPS.cheer.fps) * 1000, // 500ms
  hurtRecovery: Math.round(((FIGHTER_CLIPS.hurt.count - 1) / FIGHTER_CLIPS.hurt.fps) * 1000), // 313ms (53..57)
  sleepyBridge: Math.round(1000 / FIGHTER_CLIPS.sleepy.fps), // 125ms
} as const;

export const FIGHTER_FRAME = {
  idle0: 0,
  windup: 32,
  windupCoil: 33,
  windupHold0: 34,
  windupHold1: 35,
  attack: 36,
  attackApex: 37,
  attackEnd: 43,
  cheer: 44,
  cheerTakeoff: 45,
  cheerApex0: 46,
  cheerApex1: 47,
  cheerLand: 48,
  cheerEnd: 51,
  hurt: 52,
  hurtRecoil: 53,
  hurtEnd: 57,
  sleepyBridge: 58,
  sleepy: 59,
  knockedOut: 63,
} as const;

export type FighterFrameIndex = (typeof FIGHTER_FRAME)[keyof typeof FIGHTER_FRAME];

export const FIGHTER_SPRITE_ATLASES: Readonly<Record<string, ImageSourcePropType>> = {
  'Orange Tabby': require('../../../assets/fighters/orange-tabby.webp'),
  'Sly Fox': require('../../../assets/fighters/sly-fox.webp'),
  Badger: require('../../../assets/fighters/badger.webp'),
  Corgi: require('../../../assets/fighters/corgi.webp'),
  'Emperor Penguin': require('../../../assets/fighters/emperor-penguin.webp'),
  Pelican: require('../../../assets/fighters/pelican.webp'),
};

export function hasFighterSpriteAtlas(characterName: string): boolean {
  return Object.prototype.hasOwnProperty.call(FIGHTER_SPRITE_ATLASES, characterName);
}

export function getFighterSpriteAtlas(characterName: string): ImageSourcePropType | undefined {
  return FIGHTER_SPRITE_ATLASES[characterName];
}

/**
 * Smooth target idle playback speed multiplier for `useCreatureMotion`'s UI-thread
 * monotonic idle clock (`expApproach` smooths transitions so mood changes NEVER pop!).
 */
export function getSpriteMoodTempo(mood: FighterAmbientMood): number {
  switch (mood) {
    case 'urgent':
      return 1.28;
    case 'streak':
    case 'anticipation':
    case 'victory':
      return 1.16;
    case 'curious':
      return 1.06;
    default:
      return 1;
  }
}

// Integer UI-thread state machine modes (zero string allocations inside worklets)
const MODE_IDLE = 0;
const MODE_WINDUP = 1;
const MODE_THROW = 2;
const MODE_JOY = 3;
const MODE_CHEER = 4;
const MODE_PAIN = 5;
const MODE_VICTORY = 6;
const MODE_SLEEPY = 7;
const MODE_KO = 8;
const MODE_WAKE = 9;
const MODE_RELIEF = 10;
const MODE_STATIC = 11;

const IDLE_FPS = FIGHTER_CLIPS.idle.fps; // 16
const WINDUP_STEP_MS = 1000 / FIGHTER_CLIPS.windup.fps; // 62.5ms
const ATTACK_STEP_MS = 1000 / FIGHTER_CLIPS.attack.fps; // 50ms
const CHEER_STEP_MS = 1000 / FIGHTER_CLIPS.cheer.fps; // 62.5ms
const HURT_STEP_MS = 1000 / FIGHTER_CLIPS.hurt.fps; // 62.5ms
const SLEEPY_STEP_MS = 1000 / FIGHTER_CLIPS.sleepy.fps; // 125ms
/** 2-frame living moving-hold cadence (8fps = 125ms/frame) for windup[34..35] & victory[46..47] */
const MOVING_HOLD_STEP_MS = 125;
/** Crisp 2-frame micro-blend from joy windup coil into grounded cheer[44] crouch */
const JOY_HANDOFF_BLEND_MS = HIT.snapMs * 2;
/** Soft 2-frame entry blend into grounded cheer[44] crouch on celebratory reactions */
const CHEER_ENTRY_BLEND_MS = HIT.snapMs * 2;

function isPose0RecoveringMode(mode: number): boolean {
  return mode === MODE_THROW || mode === MODE_JOY || mode === MODE_CHEER || mode === MODE_PAIN;
}

function isSleepyFamilyMode(mode: number): boolean {
  return mode === MODE_SLEEPY || mode === MODE_KO || mode === MODE_RELIEF;
}

function isLoopingLightweightMode(mode: number): boolean {
  return mode === MODE_IDLE || mode === MODE_VICTORY || mode === MODE_SLEEPY || mode === MODE_WINDUP;
}

function isFiniteClipMode(mode: number): boolean {
  return (
    mode === MODE_THROW ||
    mode === MODE_JOY ||
    mode === MODE_CHEER ||
    mode === MODE_PAIN ||
    mode === MODE_WAKE
  );
}

/**
 * Pure worklet evaluating the exact atlas slot index (`0..63`) from UI-thread shared state.
 * Shared identically between JS transition latching and 60–120Hz `useAnimatedStyle` worklets.
 */
function evaluateSpriteFrame(
  mode: number,
  clockMs: number,
  modeStartMs: number,
  idleSec: number,
  idleEpochSec: number,
  idleBaseFrame: number,
  lightweightStep: number,
  useLightweight: number,
  windMs: number,
  releaseMs: number,
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
        ((Math.floor(lightweightStep) % FIGHTER_IDLE_FRAME_COUNT) + FIGHTER_IDLE_FRAME_COUNT) %
        FIGHTER_IDLE_FRAME_COUNT;
      return (s + idleBaseFrame) % FIGHTER_IDLE_FRAME_COUNT;
    }
    const deltaSec = idleSec - idleEpochSec;
    const rawStep = Math.floor((deltaSec > 0 ? deltaSec : 0) * IDLE_FPS);
    const step =
      ((rawStep % FIGHTER_IDLE_FRAME_COUNT) + FIGHTER_IDLE_FRAME_COUNT) % FIGHTER_IDLE_FRAME_COUNT;
    return (idleBaseFrame + step) % FIGHTER_IDLE_FRAME_COUNT;
  }

  if (mode === MODE_WINDUP) {
    if (useLightweight === 1) {
      const s = Math.floor(lightweightStep * 0.5);
      return 34 + (((s % 2) + 2) % 2);
    }
    if (elapsedMs < WINDUP_STEP_MS) return 32;
    if (elapsedMs < WINDUP_STEP_MS * 2) return 33;
    const holdStep = Math.floor((elapsedMs - WINDUP_STEP_MS * 2) / MOVING_HOLD_STEP_MS);
    return 34 + (holdStep % 2);
  }

  if (mode === MODE_THROW) {
    if (elapsedMs < windMs) {
      return elapsedMs < windMs * 0.5 ? 32 : 33;
    }
    const atkStep = Math.floor((elapsedMs - windMs) / ATTACK_STEP_MS);
    return 36 + (atkStep > 7 ? 7 : atkStep);
  }

  if (mode === MODE_JOY) {
    if (elapsedMs < releaseMs) {
      if (elapsedMs < WINDUP_STEP_MS) return 32;
      if (elapsedMs < WINDUP_STEP_MS * 2) return 33;
      const holdStep = Math.floor((elapsedMs - WINDUP_STEP_MS * 2) / MOVING_HOLD_STEP_MS);
      return 34 + (holdStep % 2);
    }
    const cheerStep = Math.floor((elapsedMs - releaseMs) / CHEER_STEP_MS);
    return 44 + (cheerStep > 7 ? 7 : cheerStep);
  }

  if (mode === MODE_CHEER) {
    const cheerStep = Math.floor(elapsedMs / CHEER_STEP_MS);
    return 44 + (cheerStep > 7 ? 7 : cheerStep);
  }

  if (mode === MODE_PAIN) {
    if (elapsedMs < hitstopMs) return 52;
    const recStep = Math.floor((elapsedMs - hitstopMs) / HURT_STEP_MS);
    return 53 + (recStep > 4 ? 4 : recStep);
  }

  if (mode === MODE_VICTORY) {
    if (useLightweight === 1) {
      const s = Math.floor(lightweightStep * 0.5);
      return 46 + (((s % 2) + 2) % 2);
    }
    if (elapsedMs < CHEER_STEP_MS) return 44;
    if (elapsedMs < CHEER_STEP_MS * 2) return 45;
    const apexStep = Math.floor((elapsedMs - CHEER_STEP_MS * 2) / MOVING_HOLD_STEP_MS);
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
        ((Math.floor(lightweightStep) % FIGHTER_IDLE_FRAME_COUNT) + FIGHTER_IDLE_FRAME_COUNT) %
        FIGHTER_IDLE_FRAME_COUNT;
      return s;
    }
    const deltaSec = idleSec - idleEpochSec;
    const rawStep = Math.floor((deltaSec > 0 ? deltaSec : 0) * IDLE_FPS);
    return ((rawStep % FIGHTER_IDLE_FRAME_COUNT) + FIGHTER_IDLE_FRAME_COUNT) % FIGHTER_IDLE_FRAME_COUNT;
  }

  if (mode === MODE_RELIEF) {
    return 58;
  }

  return 0;
}

interface ResolvedTargetState {
  mode: number;
  staticFrame: number;
}

function resolveStaticPoseFrame(params: {
  silhouette: boolean;
  healthState: CreatureHealthState;
  activeReaction: FighterOverlayReactionType | null;
  mood: FighterAmbientMood;
  lightweight: boolean;
}): number {
  const { silhouette, healthState, activeReaction, mood, lightweight } = params;
  if (silhouette) return FIGHTER_FRAME.idle0;
  if (healthState === 'knocked_out') return FIGHTER_FRAME.knockedOut;
  if (activeReaction) {
    switch (activeReaction) {
      case 'throw':
        return FIGHTER_FRAME.attackApex;
      case 'joy':
      case 'ecstatic':
      case 'pet':
      case 'dizzy_joy':
      case 'powerup':
      case 'heal':
      case 'entrance':
        return FIGHTER_FRAME.cheerApex0;
      case 'pain':
        return FIGHTER_FRAME.hurt;
      case 'relief':
        return FIGHTER_FRAME.sleepyBridge;
      case 'hint':
        return FIGHTER_FRAME.windupCoil;
      default:
        return FIGHTER_FRAME.idle0;
    }
  }
  if (mood === 'sleepy' || mood === 'defeat') return FIGHTER_FRAME.sleepy;
  if (mood === 'victory') return FIGHTER_FRAME.cheerApex0;
  if (mood === 'anticipation' && !lightweight) return FIGHTER_FRAME.windupCoil;
  return FIGHTER_FRAME.idle0;
}

function resolveTargetState(params: {
  silhouette: boolean;
  healthState: CreatureHealthState;
  activeReaction: FighterOverlayReactionType | null;
  mood: FighterAmbientMood;
  animate: boolean;
  reducedMotion: boolean;
  quiet: boolean;
  lightweight: boolean;
}): ResolvedTargetState {
  const staticFrame = resolveStaticPoseFrame(params);
  if (params.silhouette || !params.animate || params.reducedMotion || params.quiet) {
    return { mode: MODE_STATIC, staticFrame };
  }
  if (params.healthState === 'knocked_out') {
    return { mode: MODE_KO, staticFrame };
  }
  if (params.activeReaction) {
    switch (params.activeReaction) {
      case 'throw':
        return { mode: MODE_THROW, staticFrame };
      case 'joy':
        return { mode: MODE_JOY, staticFrame };
      case 'ecstatic':
      case 'pet':
      case 'dizzy_joy':
      case 'powerup':
      case 'heal':
      case 'entrance':
        return { mode: MODE_CHEER, staticFrame };
      case 'pain':
        return { mode: MODE_PAIN, staticFrame };
      case 'relief':
        return { mode: MODE_RELIEF, staticFrame };
      case 'hint':
        return { mode: MODE_WINDUP, staticFrame };
      default:
        return { mode: MODE_IDLE, staticFrame };
    }
  }
  if (params.mood === 'sleepy' || params.mood === 'defeat') {
    return { mode: MODE_SLEEPY, staticFrame };
  }
  if (params.mood === 'victory') {
    return { mode: MODE_VICTORY, staticFrame };
  }
  if (params.mood === 'anticipation' && !params.lightweight) {
    return { mode: MODE_WINDUP, staticFrame };
  }
  return { mode: MODE_IDLE, staticFrame };
}

function computeClipFallbackDurationMs(
  mode: number,
  windMs: number,
  releaseMs: number,
  hitstopMs: number
): number {
  switch (mode) {
    case MODE_THROW:
      return windMs + FIGHTER_CLIP_DURATION_MS.attack;
    case MODE_JOY:
      return releaseMs + FIGHTER_CLIP_DURATION_MS.cheer;
    case MODE_CHEER:
      return FIGHTER_CLIP_DURATION_MS.cheer;
    case MODE_PAIN:
      return hitstopMs + FIGHTER_CLIP_DURATION_MS.hurtRecovery;
    case MODE_WAKE:
      return FIGHTER_CLIP_DURATION_MS.sleepyBridge + SPRITE_TX.recoverBlendMs;
    default:
      return FIGHTER_CLIP_DURATION_MS.cheer;
  }
}

export interface FighterSpriteRigProps {
  characterName: string;
  size: number;
  mood: FighterAmbientMood;
  healthState: CreatureHealthState;
  activeReaction: FighterOverlayReactionType | null;
  reactionKey: number;
  cheerReleaseMs?: number;
  /** Species throw wind-up duration (ms): Badger = HIT.snapMs * 3 (48ms), others = THROW.windMs (32ms) */
  throwWindMs?: number;
  /** Live UI-thread hitstop duration (ms) for active `pain` reaction */
  painHitstopMs?: SharedValue<number>;
  /** Monotonic UI-thread elapsed clock (ms) driven by `useCreatureMotion`'s single frame loop */
  spriteClockMs?: SharedValue<number>;
  /** Monotonic UI-thread tempo-integrated idle clock (seconds) driven by `useCreatureMotion`'s single frame loop */
  spriteIdleSec?: SharedValue<number>;
  blinkStage?: BlinkStage;
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
 * Option B Unified UI-Thread Hybrid Sprite State Machine (`8×8` / 64-slot WebP atlas).
 *
 * - Runs on `useCreatureMotion`'s single `useGuardedFrameCallback` clock in combat/menu/dev
 *   mode (`0` extra frame loops!), and on GPU-only `withRepeat` (`0` frame loops, strictly
 *   gated on `useAppActive()` + `!reducedMotion` + `cancelAnimation`) in `lightweight` mode.
 * - Monotonic idle clock NEVER resets on mood/tempo changes (`idle -> curious -> streak -> urgent`).
 * - Zero JS `setTimeout` / `useState` reaction races: captures `cheerReleaseMs` / `throwWindMs`
 *   ONCE per `reactionKey` so async `leadImpactMs` updates never snap `joy` back to `windup`.
 * - Dual-layer single-texture crossfade (`0` extra VRAM): instant `0ms` Sakurai snaps on
 *   strikes/impacts, smooth `64–96ms` crossfades + subtle `0.965` settle cushion on recoveries,
 *   mood shifts, and sleepy/wake bridges, and calm `ACCESSIBLE.fadeMs` (`STAYS`) under reduced motion.
 */
export const FighterSpriteRig: React.FC<FighterSpriteRigProps> = memo(function FighterSpriteRig({
  characterName,
  size,
  mood,
  healthState,
  activeReaction,
  reactionKey,
  cheerReleaseMs,
  throwWindMs = THROW.windMs,
  painHitstopMs,
  spriteClockMs,
  spriteIdleSec,
  blinkStage,
  animate,
  lightweight = false,
  quiet = false,
  silhouette = false,
}) {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const atlasSource = FIGHTER_SPRITE_ATLASES[characterName];

  // Keep `blinkStage` referenced cleanly in props contract for compatibility with FighterAvatar
  void blinkStage;

  const initialPhaseOffset = (seedFromKey(characterName) * 7) % FIGHTER_IDLE_FRAME_COUNT;
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
  const windMsSV = useSharedValue<number>(throwWindMs);
  const releaseMsSV = useSharedValue<number>(
    Math.max(CHEER.windMs, cheerReleaseMs ?? CHEER.releaseMs)
  );
  const hitstopMsSV = useSharedValue<number>(HIT.holdMs);
  const prevFrameSV = useSharedValue<number>(target.staticFrame);
  const blendProgressSV = useSharedValue<number>(1);
  const settleScaleYSV = useSharedValue<number>(1);

  // Sync latest timing hints in a ref BEFORE the transition effect so async prop changes
  // (like `leadImpactMs` updating mid-`joy`) NEVER re-trigger or reset an active clip!
  const timingHintsRef = useRef({ cheerReleaseMs, throwWindMs });
  useEffect(() => {
    timingHintsRef.current = { cheerReleaseMs, throwWindMs };
  }, [cheerReleaseMs, throwWindMs]);

  const prevStateRef = useRef({
    characterName,
    mode: target.mode,
    staticFrame: target.staticFrame,
    reactionKey,
    activeReaction,
  });

  // Unified deterministic state-machine transition effect (zero JS setTimeout / useState races)
  useEffect(() => {
    const prev = prevStateRef.current;
    const charChanged = prev.characterName !== characterName;
    const isNewReaction = activeReaction !== null && reactionKey !== prev.reactionKey;
    const staticPoseChanged =
      target.mode === MODE_STATIC &&
      prev.mode === MODE_STATIC &&
      target.staticFrame !== prev.staticFrame;

    // Preserve monotonic idle clock across mood/tempo changes (`idle -> curious -> streak -> urgent`)
    // AND across already-completed `MODE_WAKE -> MODE_IDLE` transitions!
    const staysInIdleFamily =
      !charChanged &&
      !isNewReaction &&
      target.mode === MODE_IDLE &&
      (prev.mode === MODE_IDLE || prev.mode === MODE_WAKE);

    const isNoOp =
      !charChanged &&
      !isNewReaction &&
      !staticPoseChanged &&
      (staysInIdleFamily || target.mode === prev.mode);

    if (isNoOp) {
      prevStateRef.current = {
        characterName,
        mode: prev.mode,
        staticFrame: target.staticFrame,
        reactionKey,
        activeReaction,
      };
      return;
    }

    const nowMs = clockMsSV.value;
    const nowIdleSec = idleSecSV.value;
    const currentRenderedFrame = evaluateSpriteFrame(
      modeSV.value,
      nowMs,
      modeStartMsSV.value,
      nowIdleSec,
      idleEpochSecSV.value,
      idleBaseFrameSV.value,
      lightweightLoopSV.value,
      useLightweightClock ? 1 : 0,
      windMsSV.value,
      releaseMsSV.value,
      hitstopMsSV.value,
      staticFrameSV.value
    );

    // Waking from sleepy/defeat/KO routes through drowsy bridge `58` (125ms) -> Pose0 idle
    const nextMode =
      !charChanged && target.mode === MODE_IDLE && isSleepyFamilyMode(prev.mode)
        ? MODE_WAKE
        : target.mode;

    // Capture reaction timing parameters ONCE per `reactionKey`
    const capturedWindMs = timingHintsRef.current.throwWindMs;
    const capturedReleaseMs = Math.max(
      CHEER.windMs,
      timingHintsRef.current.cheerReleaseMs ?? CHEER.releaseMs
    );
    const capturedHitstopMs = hitstopSourceSV.value > 0 ? hitstopSourceSV.value : HIT.holdMs;

    if (nextMode === MODE_THROW) {
      windMsSV.value = capturedWindMs;
    } else if (nextMode === MODE_JOY) {
      releaseMsSV.value = capturedReleaseMs;
    } else if (nextMode === MODE_PAIN) {
      hitstopMsSV.value = capturedHitstopMs;
    }

    staticFrameSV.value = target.staticFrame;

    if (charChanged) {
      idleBaseFrameSV.value = initialPhaseOffset;
      idleEpochSecSV.value = nowIdleSec;
    } else if (nextMode === MODE_IDLE && isPose0RecoveringMode(prev.mode)) {
      // Recovery tail (`43` / `51` / `57`) aligns to `Pose0` (`0`), so anchor idle cleanly at `0`
      idleEpochSecSV.value = nowIdleSec;
      idleBaseFrameSV.value = 0;
    } else if (nextMode === MODE_WAKE) {
      // Bridge `58` holds for 125ms, then idle starts at `Pose0` (`0`)
      idleEpochSecSV.value = nowIdleSec + FIGHTER_CLIP_DURATION_MS.sleepyBridge / 1000;
      idleBaseFrameSV.value = 0;
    }

    // In lightweight/standalone mode without external frame clock, drive finite one-shot clips
    // cleanly via a finite `withTiming` (0 frame loops, 0 infinite repeats)
    if (useLightweightClock) {
      cancelAnimation(fallbackClockMs);
      if (isFiniteClipMode(nextMode)) {
        const durMs = computeClipFallbackDurationMs(
          nextMode,
          capturedWindMs,
          capturedReleaseMs,
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

    if (charChanged || silhouette) {
      blendMs = SPRITE_TX.snapMs;
    } else if (reducedMotion) {
      blendMs = ACCESSIBLE.fadeMs;
    } else if (quiet || !animate) {
      blendMs = SPRITE_TX.snapMs;
    } else if (nextMode === MODE_THROW || nextMode === MODE_PAIN) {
      // Instant 0ms Sakurai impact snap for strikes, hits, and rapid hit-chains!
      blendMs = SPRITE_TX.snapMs;
    } else if (nextMode === MODE_SLEEPY || nextMode === MODE_KO || nextMode === MODE_WAKE || nextMode === MODE_RELIEF) {
      blendMs = SPRITE_TX.sleepBlendMs;
    } else if (nextMode === MODE_VICTORY) {
      blendMs = SPRITE_TX.sleepBlendMs;
    } else if (nextMode === MODE_IDLE && isPose0RecoveringMode(prev.mode)) {
      blendMs = SPRITE_TX.recoverBlendMs;
      shouldCushionSettle = true;
    } else if (nextMode === MODE_WINDUP || (nextMode === MODE_IDLE && prev.mode === MODE_WINDUP)) {
      blendMs = SPRITE_TX.moodBlendMs;
    } else if (nextMode === MODE_JOY) {
      blendMs = prev.mode === MODE_WINDUP ? SPRITE_TX.snapMs : SPRITE_TX.moodBlendMs;
    } else if (nextMode === MODE_CHEER) {
      blendMs = CHEER_ENTRY_BLEND_MS;
    } else if (nextMode === MODE_STATIC) {
      blendMs = SPRITE_TX.recoverBlendMs;
    }

    const nextInitialFrame = evaluateSpriteFrame(
      nextMode,
      useLightweightClock ? 0 : nowMs,
      modeStartMsSV.value,
      nowIdleSec,
      idleEpochSecSV.value,
      idleBaseFrameSV.value,
      lightweightLoopSV.value,
      useLightweightClock ? 1 : 0,
      windMsSV.value,
      releaseMsSV.value,
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
    } else if (charChanged || reducedMotion || quiet) {
      cancelAnimation(settleScaleYSV);
      settleScaleYSV.value = 1;
    }

    prevStateRef.current = {
      characterName,
      mode: nextMode,
      staticFrame: target.staticFrame,
      reactionKey,
      activeReaction,
    };
  }, [
    characterName,
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
    windMsSV,
    releaseMsSV,
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

  useEffect(() => {
    if (!shouldRunLightweightLoop) {
      cancelAnimation(lightweightLoopSV);
      return;
    }
    lightweightLoopSV.value = 0;
    lightweightLoopSV.value = withRepeat(
      withTiming(FIGHTER_IDLE_FRAME_COUNT, {
        duration: FIGHTER_CLIP_DURATION_MS.idleCycle,
        easing: Easing.linear,
      }),
      -1,
      false
    );
    return () => {
      cancelAnimation(lightweightLoopSV);
    };
  }, [shouldRunLightweightLoop, lightweightLoopSV]);

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
  const atlasWidth = cellSize * FIGHTER_ATLAS_COLS;
  const atlasHeight = cellSize * FIGHTER_ATLAS_ROWS;
  const footAnchorY = cellSize * 0.35;
  const lightweightFlag = useLightweightClock ? 1 : 0;

  const settleWrapStyle = useAnimatedStyle(() => {
    'worklet';
    const sy = settleScaleYSV.value;
    const sx = sy === 1 ? 1 : 1 / sy;
    return {
      transform: [
        { translateY: footAnchorY },
        { scaleX: sx },
        { scaleY: sy },
        { translateY: -footAnchorY },
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
    const idx = evaluateSpriteFrame(
      mode,
      nowMs,
      startMs,
      idleSecSV.value,
      idleEpochSecSV.value,
      idleBaseFrameSV.value,
      lightweightLoopSV.value,
      lightweightFlag,
      windMsSV.value,
      releaseMsSV.value,
      hitstopMsSV.value,
      staticFrameSV.value
    );
    const clampedIdx = idx < 0 ? 0 : idx > FIGHTER_ATLAS_MAX_INDEX ? FIGHTER_ATLAS_MAX_INDEX : idx;
    const col = clampedIdx % FIGHTER_ATLAS_COLS;
    const row = Math.floor(clampedIdx / FIGHTER_ATLAS_COLS);

    let currOpacity = blendProgressSV.value;

    // Phase B of `MODE_WAKE`: smooth 64ms UI-thread blend from drowsy bridge `58` -> Pose0 idle
    if (
      mode === MODE_WAKE &&
      elapsedMs >= SLEEPY_STEP_MS &&
      elapsedMs < SLEEPY_STEP_MS + SPRITE_TX.recoverBlendMs
    ) {
      const t = (elapsedMs - SLEEPY_STEP_MS) / SPRITE_TX.recoverBlendMs;
      currOpacity = t * t * (3 - 2 * t);
    } else if (
      lightweightFlag === 0 &&
      (mode === MODE_SLEEPY || mode === MODE_KO) &&
      elapsedMs >= SLEEPY_STEP_MS &&
      elapsedMs < SLEEPY_STEP_MS + SPRITE_TX.sleepBlendMs
    ) {
      // Phase B of `MODE_SLEEPY` / `MODE_KO`: smooth 96ms UI-thread blend from drowsy bridge `58` -> curled `59` / KO `63`
      const t = (elapsedMs - SLEEPY_STEP_MS) / SPRITE_TX.sleepBlendMs;
      currOpacity = t * t * (3 - 2 * t);
    } else if (
      mode === MODE_JOY &&
      elapsedMs >= releaseMsSV.value &&
      elapsedMs < releaseMsSV.value + JOY_HANDOFF_BLEND_MS
    ) {
      // Smooth 2-frame coil -> grounded crouch handoff inside `joy`
      currOpacity = (elapsedMs - releaseMsSV.value) / JOY_HANDOFF_BLEND_MS;
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

    if (
      mode === MODE_WAKE &&
      elapsedMs >= SLEEPY_STEP_MS &&
      elapsedMs < SLEEPY_STEP_MS + SPRITE_TX.recoverBlendMs
    ) {
      prevIdx = FIGHTER_FRAME.sleepyBridge;
      const t = (elapsedMs - SLEEPY_STEP_MS) / SPRITE_TX.recoverBlendMs;
      p = t * t * (3 - 2 * t);
    } else if (
      lightweightFlag === 0 &&
      (mode === MODE_SLEEPY || mode === MODE_KO) &&
      elapsedMs >= SLEEPY_STEP_MS &&
      elapsedMs < SLEEPY_STEP_MS + SPRITE_TX.sleepBlendMs
    ) {
      prevIdx = FIGHTER_FRAME.sleepyBridge;
      const t = (elapsedMs - SLEEPY_STEP_MS) / SPRITE_TX.sleepBlendMs;
      p = t * t * (3 - 2 * t);
    } else if (
      mode === MODE_JOY &&
      elapsedMs >= releaseMsSV.value &&
      elapsedMs < releaseMsSV.value + JOY_HANDOFF_BLEND_MS
    ) {
      const rel = releaseMsSV.value;
      prevIdx =
        rel < WINDUP_STEP_MS
          ? 32
          : rel < WINDUP_STEP_MS * 2
            ? 33
            : 34 + (Math.floor((rel - WINDUP_STEP_MS * 2) / MOVING_HOLD_STEP_MS) % 2);
      p = (elapsedMs - rel) / JOY_HANDOFF_BLEND_MS;
    }

    // Lifted-floor crossfade preserves solid core opacity mid-blend and reaches 0 smoothly with zero pop
    const prevOpacity = p >= 0.999 ? 0 : (1 - p) * (1 + 0.55 * p);
    const clampedIdx =
      prevIdx < 0 ? 0 : prevIdx > FIGHTER_ATLAS_MAX_INDEX ? FIGHTER_ATLAS_MAX_INDEX : prevIdx;
    const col = clampedIdx % FIGHTER_ATLAS_COLS;
    const row = Math.floor(clampedIdx / FIGHTER_ATLAS_COLS);

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

  return (
    <View
      testID={silhouette ? 'fighter-sprite-silhouette' : 'fighter-sprite-viewport'}
      pointerEvents="none"
      style={[
        styles.viewport,
        webViewportStyle,
        { width: cellSize, height: cellSize },
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
              testID="fighter-sprite-atlas-prev"
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
            testID="fighter-sprite-atlas"
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
