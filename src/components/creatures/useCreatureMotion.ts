import type { StyleProp, ViewStyle } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SharedValue,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useGuardedFrameCallback } from '@/hooks/useGuardedFrameCallback';
import {
  CreatureHealthState,
  MoodMotionTable,
  computeMoodLoopRates,
  computeMoodPoseTargets,
} from '@/utils/creatureAnimations';
import {
  MoodLoopRates,
  MoodPoseTargets,
  SecondOrderState,
  advancePhase,
  computeVolumePreservedScale,
  createSecondOrderState,
  expApproach,
  sampleOrganicBreath,
  sampleOverlappingWave,
  stepSecondOrderInPlace,
} from '@/utils/proceduralMotion';
import {
  BLINK,
  CREATURE_ACTING,
  EASE,
  HIT,
  HitKind,
  HitTier,
  MASS_CLASS,
  MS,
  OVERLAP,
  nextDeterministicUnit,
  seedFromKey,
} from '@/utils/motion';
import {
  BlinkStage,
  CreatureJointPivots,
  CreatureMassClass,
  GazeOffset,
  ReactionChannels,
} from './types';

export type { BlinkStage, CreatureMassClass, ReactionChannels };

/**
 * Reanimated types animated styles as text-capable styles, but these only carry
 * view transforms and opacity, which is what the rigs and stage accept.
 */
export type PartStyle = StyleProp<ViewStyle>;
const asPart = (style: ReturnType<typeof useAnimatedStyle>): PartStyle => style as PartStyle;

/** What a reaction knows about what came just before it and how strongly it landed */
export interface ReactionContext {
  /** Same reactions in a row before this one, each within `HIT.chainWindowMs` of the last (capped at `HIT.chainMax`) */
  chain: number;
  /** 0..1: how big the moment is (a fighter's streak); 0 when the creature has no say */
  intensity: number;
  /** Damage tier (`0..3`) scaling hitstop duration and recoil depth (`[FX-06]`) */
  hitTier?: HitTier;
  /** Damage-pose variant: grounded `'throw'`, airborne `'blast'`, or electric `'zap'` (`[FX-12]`) */
  hitKind?: HitKind;
  /** Optional move identifier (e.g. `'blast'`, `'perfect_parry'`) for per-move hitstop multiplier (`[FX-06]`) */
  moveKind?: string;
  /** Dynamic cheer release delay (ms) synced to Set flight time (`[FX-23]`) */
  cheerReleaseMs?: number;
  /** Small-screen acting boost when avatar `size <= CREATURE_ACTING.compactSizePx` (`[FX-12]`) */
  compact?: boolean;
  /** Physical inertia class (`nimble` | `standard` | `heavy` | `boss`) */
  massClass?: CreatureMassClass;
}

/** (frequency, damping, response) of one second-order posture channel. */
type Spring = readonly [f: number, z: number, r: number];

/** Celebration bounce and nervous tremor strength, each 0..1. */
interface MotionBlends {
  bounce: number;
  tremor: number;
}

/**
 * Everything that makes one family of creatures (fighters, enemies) move differently
 * from another. The machine itself — integrator, blink/gaze scheduler, tap streaks,
 * pivot maths and part styles — is shared.
 */
export interface CreatureMotionConfig<Mood extends string, Reaction extends string> {
  moodMotion: MoodMotionTable<Mood>;
  /** Optional default mass class scaling posture inertia and timings (`standard` when omitted) */
  massClass?: CreatureMassClass;
  /** How long each one-shot reaction holds its expression */
  reactionHoldMs: Record<Reaction, number>;
  /**
   * Optional dynamic reaction expression hold resolver (e.g. aligning enemy `pain`
   * expression release to tier-scaled hitstop + recoil settle, `[FX-12]`).
   */
  resolveReactionHoldMs?: (type: Reaction, context: ReactionContext) => number;
  /**
   * Starts the choreography of a one-shot reaction on the impulse channels.
   * `context.chain` counts how many of the same reaction landed just before this one
   * (within `HIT.chainWindowMs`): 0 for a fresh reaction, 1+ while a chain is running.
   */
  playReaction: (type: Reaction, channels: ReactionChannels, size: number, context: ReactionContext) => void;
  /** Reaction played by a single tap, and by a rapid streak of taps */
  tapReaction: Reaction;
  tapStreakReaction: Reaction;
  /** Where the eyes look given the current state and the wandering idle gaze */
  resolveGaze: (state: {
    mood: Mood;
    healthState: CreatureHealthState;
    activeReaction: Reaction | null;
    idleGaze: GazeOffset;
  }) => GazeOffset;
  /** Whether the pose a creature mounts in already leans toward its resolved gaze */
  mountPoseFollowsGaze: boolean;
  /** Per-name starting phases so creatures side by side never move in unison */
  initialPhases: (name: string) => { breath: number; wag: number; sway: number; drift: number };
  /** Bounce/tremor a creature mounts with, and the levels it then eases toward */
  mountBlends: (mood: Mood, healthState: CreatureHealthState) => MotionBlends;
  targetBlends: (mood: Mood, healthState: CreatureHealthState) => MotionBlends;
  blink: {
    minGapMs: number;
    gapJitterMs: number;
    holdMs: number;
    doubleChance: number;
    doubleGapMs: number;
    doubleHoldMs: number;
  };
  /** Occasional micro-fidget played with a blink; `roll` is uniform in [0, 1) */
  idleFidget: (roll: number, channels: ReactionChannels) => void;
  gaze: { minGapMs: number; gapJitterMs: number; candidates: readonly GazeOffset[] };
  /** Easing rates (1/s) toward the mood's loop rates, amplitudes and blends */
  easing: {
    breathHz: number;
    wagHz: number;
    swayHz: number;
    breathAmp: number;
    wagAmp: number;
    swayAmp: number;
    bounce: number;
    tremor: number;
  };
  /** Slow drift oscillator frequency: `base + perBreathHz * breathHz` */
  drift: { base: number; perBreathHz: number };
  /**
   * Posture springs that carry the pose toward each new mood/gaze target.
   */
  poseSprings: {
    leanX: Spring;
    leanY: Spring;
    bodyTilt: Spring;
    headTilt: Spring;
    headY: Spring;
    leftEar: Spring;
    rightEar: Spring;
    postureStretchY: Spring;
  };
  look: {
    /** Celebration hop height as a fraction of size */
    hop: number;
    /** Extra body rock (deg) while celebrating */
    danceTiltDeg: number;
    tremorFreq: number;
    tremorAmpPx: number;
    shadowOpacity: number;
    shadowLiftShrinkX: number;
    shadowLiftShrinkY: number;
    /** Excited foot tap: height (fraction of size), wag amplitude where it starts, and gain */
    pawTap: number;
    pawTapThreshold: number;
    pawTapGain: number;
  };
}

interface CreatureReactionSignal<Reaction extends string> {
  type: Reaction;
  id: number;
  tier?: HitTier;
  hitTier?: HitTier;
  hitKind?: HitKind;
  hitStyle?: HitKind;
  moveKind?: string;
  releaseMs?: number;
}

interface CreatureMotionInput<Mood extends string, Reaction extends string> {
  name: string;
  size: number;
  mood: Mood;
  healthState: CreatureHealthState;
  /** Idle rhythm of this individual creature */
  personality: {
    breathCycleMs: number;
    breathIntensity: number;
    earSwayDeg: number;
    tailCycleMs: number;
    tailWagDeg: number;
    idleTiltDeg: number;
  };
  pivots: CreatureJointPivots;
  /** Externally triggered one-shot reaction */
  reaction: CreatureReactionSignal<Reaction> | null;
  /** Run continuous motion (false = settle straight into the resting pose) */
  animate: boolean;
  /**
   * Reactions change the face but do not move the body (the in-game Effects switch is off).
   * Idle life still runs when `animate` is on.
   */
  stillReactions?: boolean;
  /** 0..1 handed to reactions as `context.intensity` (e.g. a fighter's streak) */
  reactionIntensity?: number;
  /** Optional damage tier (`0..3`) forwarded to reactions when not set on `reaction` */
  hitTier?: HitTier;
  /** Optional damage-pose variant forwarded to reactions when not set on `reaction` */
  hitKind?: HitKind;
  /** Optional dynamic cheer release delay (ms) forwarded to `'joy'`/`'ecstatic'` hops */
  cheerReleaseMs?: number;
  /** Blink, glance around and fidget while idle */
  lively: boolean;
  interactive: boolean;
  onTap?: (reaction: Reaction) => void;
  /** Optional creature mass class override (`nimble` | `standard` | `heavy` | `boss`) */
  massClass?: CreatureMassClass;
  /**
   * Optional species-specific choreography override. Return `true` to indicate the
   * reaction was fully choreographed (skipping `config.playReaction`), or `false`/`void`
   * to fall back to `config.playReaction`.
   */
  speciesChoreography?: (
    type: Reaction,
    channels: ReactionChannels,
    size: number,
    context: ReactionContext
  ) => boolean | void;
  /** Optional species-specific idle fidget override; return `true` to skip `config.idleFidget`. */
  speciesFidget?: (roll: number, channels: ReactionChannels, size: number) => boolean | void;
}

interface CreatureMotion<Reaction extends string> {
  activeReaction: Reaction | null;
  /** Changes every time a reaction plays, so effects can replay identical reactions */
  reactionKey: number;
  isBlinking: boolean;
  /** 3-step blink lid travel (`0` open, `1` closing/opening, `2` closed) */
  blinkStage: BlinkStage;
  /** Smooth 0..1 UI-thread eyelid closure shared value (`[FX-12]`) */
  lidClose: SharedValue<number>;
  gaze: GazeOffset;
  handlePress: () => void;
  rigRootStyle: PartStyle;
  groundShadowStyle: PartStyle;
  /** Soft outer penumbra grounding shadow style (coupled to lift, squash, and upper-left key light) */
  groundPenumbraStyle: PartStyle;
  headStyle: PartStyle;
  leftEarStyle: PartStyle;
  rightEarStyle: PartStyle;
  tailStyle: PartStyle;
  pawStyle: PartStyle;
  /** Live vertical impulse offset (`<0` lift, `>0` stomp) for stage/shadow coupling */
  bodyTy: SharedValue<number>;
  /** Live reaction vertical squash/stretch multiplier for stage/shadow coupling */
  reactionScaleY: SharedValue<number>;
}

interface SimState {
  // Continuous phase accumulators (0..2π) — never hard-reset on mood changes
  breathPhase: number;
  wagPhase: number;
  swayPhase: number;
  driftPhase: number;

  // Smoothly interpolated oscillator rates & amplitudes
  breathHz: number;
  wagHz: number;
  swayHz: number;
  breathAmpScale: number;
  wagAmpScale: number;
  swayAmpScale: number;
  bounceBlend: number;
  tremorBlend: number;

  // Second-order spring-damper channels for inertial posture transitions
  leanX: SecondOrderState;
  leanY: SecondOrderState;
  bodyTilt: SecondOrderState;
  headTilt: SecondOrderState;
  headY: SecondOrderState;
  leftEar: SecondOrderState;
  rightEar: SecondOrderState;
  postureStretchY: SecondOrderState;
}

interface SimTargets {
  rates: MoodLoopRates;
  pose: MoodPoseTargets;
  bounce: number;
  tremor: number;
}

const TAP_STREAK_WINDOW_MS = 2400;
const TAP_STREAK_THRESHOLD = 5;
const CENTRE_GAZE: GazeOffset = { x: 0, y: 0 };

/**
 * The living-creature machine shared by fighters and enemies: a UI-thread phase
 * integrator for breath/wag/sway, inertial posture, one-shot reaction playback,
 * blink & gaze scheduling, tap streaks, and the animated style of every rig part.
 */
export function useCreatureMotion<Mood extends string, Reaction extends string>(
  config: CreatureMotionConfig<Mood, Reaction>,
  input: CreatureMotionInput<Mood, Reaction>
): CreatureMotion<Reaction> {
  const {
    name,
    size,
    mood,
    healthState,
    personality,
    pivots,
    reaction,
    animate,
    lively,
    interactive,
    onTap,
    hitTier,
    hitKind,
    cheerReleaseMs,
    massClass,
    speciesChoreography,
    speciesFidget,
  } = input;
  const stillReactions = input.stillReactions ?? false;
  const reactionIntensity = input.reactionIntensity ?? 0;
  const isCompact = size <= CREATURE_ACTING.compactSizePx;
  const resolvedMassClass: CreatureMassClass = massClass ?? config.massClass ?? 'standard';
  const massTimeMult = MASS_CLASS[resolvedMassClass].timeMult;
  const springFreqScale = massTimeMult === 1 ? 1 : 1 / Math.sqrt(massTimeMult);

  const [activeReaction, setActiveReaction] = useState<Reaction | null>(reaction?.type ?? null);
  const [reactionKey, setReactionKey] = useState<number>(reaction ? 1 : 0);
  const [blinkStage, setBlinkStage] = useState<BlinkStage>(0);
  const [idleGaze, setIdleGaze] = useState<GazeOffset>(CENTRE_GAZE);
  const isBlinking = blinkStage === 2;

  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionLeadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionFinishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimestampsRef = useRef<number[]>([]);
  const playCountRef = useRef(0);
  const lastPlayRef = useRef<{ type: Reaction | null; at: number; chain: number }>({ type: null, at: 0, chain: 0 });

  const gaze = useMemo<GazeOffset>(
    () => config.resolveGaze({ mood, healthState, activeReaction, idleGaze }),
    [config, mood, healthState, activeReaction, idleGaze]
  );

  // Seeds for the shared values below; later renders never read them again.
  const mount = useMemo(() => {
    const mountGaze = config.mountPoseFollowsGaze ? gaze : CENTRE_GAZE;
    return {
      rates: computeMoodLoopRates(
        config.moodMotion,
        mood,
        healthState,
        personality.breathCycleMs,
        personality.tailCycleMs
      ),
      pose: computeMoodPoseTargets(config.moodMotion, mood, healthState, size, mountGaze.x, mountGaze.y),
      blends: config.mountBlends(mood, healthState),
      phases: config.initialPhases(name),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const targets = useSharedValue<SimTargets>({
    rates: mount.rates,
    pose: mount.pose,
    bounce: mount.blends.bounce,
    tremor: mount.blends.tremor,
  });

  const sim = useSharedValue<SimState>({
    breathPhase: mount.phases.breath,
    wagPhase: mount.phases.wag,
    swayPhase: mount.phases.sway,
    driftPhase: mount.phases.drift,
    breathHz: mount.rates.breathHz,
    wagHz: mount.rates.wagHz,
    swayHz: mount.rates.swayHz,
    breathAmpScale: mount.rates.breathAmpScale,
    wagAmpScale: mount.rates.wagAmpScale,
    swayAmpScale: mount.rates.swayAmpScale,
    bounceBlend: mount.blends.bounce,
    tremorBlend: mount.blends.tremor,
    leanX: createSecondOrderState(mount.pose.leanX),
    leanY: createSecondOrderState(mount.pose.leanY),
    bodyTilt: createSecondOrderState(mount.pose.bodyTiltDeg),
    headTilt: createSecondOrderState(mount.pose.headTiltDeg),
    headY: createSecondOrderState(mount.pose.headY),
    leftEar: createSecondOrderState(mount.pose.leftEarDeg),
    rightEar: createSecondOrderState(mount.pose.rightEarDeg),
    postureStretchY: createSecondOrderState(mount.pose.postureStretchY),
  });

  const bodyTx = useSharedValue(0);
  const bodyTy = useSharedValue(0);
  const reactionScaleY = useSharedValue(1);
  const bodyRotate = useSharedValue(0);
  const headRotate = useSharedValue(0);
  const headTy = useSharedValue(0);
  const leftEarExtra = useSharedValue(0);
  const rightEarExtra = useSharedValue(0);
  const tailExtra = useSharedValue(0);
  const pawBounce = useSharedValue(0);
  const pawTx = useSharedValue(0);
  const pawRotate = useSharedValue(0);
  const headTx = useSharedValue(0);
  const scaleX = useSharedValue(1);
  const bodySkewX = useSharedValue(0);
  const lidClose = useSharedValue(0);
  const compactHeadScale = useSharedValue(1);

  const channels = useMemo<ReactionChannels>(
    () => ({
      bodyTx,
      bodyTy,
      reactionScaleY,
      bodyRotate,
      headRotate,
      headTy,
      leftEarExtra,
      rightEarExtra,
      tailExtra,
      pawBounce,
      pawTx,
      pawRotate,
      headTx,
      scaleX,
      bodySkewX,
    }),
    [
      bodyTx,
      bodyTy,
      reactionScaleY,
      bodyRotate,
      headRotate,
      headTy,
      leftEarExtra,
      rightEarExtra,
      tailExtra,
      pawBounce,
      pawTx,
      pawRotate,
      headTx,
      scaleX,
      bodySkewX,
    ]
  );

  // Retarget loop rates & posture whenever state changes (phases are never reset)
  useEffect(() => {
    const rates = computeMoodLoopRates(
      config.moodMotion,
      mood,
      healthState,
      personality.breathCycleMs,
      personality.tailCycleMs
    );
    const pose = computeMoodPoseTargets(config.moodMotion, mood, healthState, size, gaze.x, gaze.y);
    const blends = config.targetBlends(mood, healthState);

    targets.value = { rates, pose, bounce: blends.bounce, tremor: blends.tremor };

    if (!animate) {
      // Reduced-motion / static mode: settle directly into the resting pose and cancel impulse channels
      cancelAnimation(bodyTx);
      cancelAnimation(bodyTy);
      cancelAnimation(reactionScaleY);
      cancelAnimation(bodyRotate);
      cancelAnimation(headRotate);
      cancelAnimation(headTy);
      cancelAnimation(leftEarExtra);
      cancelAnimation(rightEarExtra);
      cancelAnimation(tailExtra);
      cancelAnimation(pawBounce);
      cancelAnimation(pawTx);
      cancelAnimation(pawRotate);
      cancelAnimation(headTx);
      cancelAnimation(scaleX);
      cancelAnimation(bodySkewX);
      cancelAnimation(lidClose);
      cancelAnimation(compactHeadScale);
      bodyTx.value = 0;
      bodyTy.value = 0;
      reactionScaleY.value = 1;
      bodyRotate.value = 0;
      headRotate.value = 0;
      headTy.value = 0;
      leftEarExtra.value = 0;
      rightEarExtra.value = 0;
      tailExtra.value = 0;
      pawBounce.value = 0;
      pawTx.value = 0;
      pawRotate.value = 0;
      headTx.value = 0;
      scaleX.value = 1;
      bodySkewX.value = 0;
      lidClose.value = 0;
      compactHeadScale.value = 1;

      sim.value = {
        ...sim.value,
        breathHz: rates.breathHz,
        wagHz: rates.wagHz,
        swayHz: rates.swayHz,
        breathAmpScale: 0,
        wagAmpScale: 0,
        swayAmpScale: 0,
        bounceBlend: 0,
        tremorBlend: 0,
        leanX: createSecondOrderState(pose.leanX),
        leanY: createSecondOrderState(pose.leanY),
        bodyTilt: createSecondOrderState(pose.bodyTiltDeg),
        headTilt: createSecondOrderState(pose.headTiltDeg),
        headY: createSecondOrderState(pose.headY),
        leftEar: createSecondOrderState(pose.leftEarDeg),
        rightEar: createSecondOrderState(pose.rightEarDeg),
        postureStretchY: createSecondOrderState(pose.postureStretchY),
      };
    }
  }, [
    config,
    mood,
    healthState,
    size,
    personality.breathCycleMs,
    personality.tailCycleMs,
    gaze.x,
    gaze.y,
    animate,
    targets,
    sim,
    bodyTx,
    bodyTy,
    reactionScaleY,
    bodyRotate,
    headRotate,
    headTy,
    leftEarExtra,
    rightEarExtra,
    tailExtra,
    pawBounce,
    pawTx,
    pawRotate,
    headTx,
    scaleX,
    bodySkewX,
    lidClose,
    compactHeadScale,
  ]);

  const { easing, drift, poseSprings } = config;

  // UI-thread continuous phase integrator + second-order posture solver.
  // Mutate the simulation state in place via `sim.modify` so each frame allocates zero objects.
  useGuardedFrameCallback((frameInfo) => {
    'worklet';
    const dtMs = frameInfo.timeSincePreviousFrame;
    if (dtMs === null || dtMs <= 0) return;
    const dt = Math.min(dtMs / 1000, 0.05);

    const stepSim = <T extends SimState>(cur: T): T => {
      'worklet';
      const tgt = targets.value;
      const breathHz = expApproach(cur.breathHz, tgt.rates.breathHz, easing.breathHz, dt);
      const wagHz = expApproach(cur.wagHz, tgt.rates.wagHz, easing.wagHz, dt);
      const swayHz = expApproach(cur.swayHz, tgt.rates.swayHz, easing.swayHz, dt);

      cur.breathHz = breathHz;
      cur.wagHz = wagHz;
      cur.swayHz = swayHz;
      cur.breathAmpScale = expApproach(cur.breathAmpScale, tgt.rates.breathAmpScale, easing.breathAmp, dt);
      cur.wagAmpScale = expApproach(cur.wagAmpScale, tgt.rates.wagAmpScale, easing.wagAmp, dt);
      cur.swayAmpScale = expApproach(cur.swayAmpScale, tgt.rates.swayAmpScale, easing.swayAmp, dt);
      cur.bounceBlend = expApproach(cur.bounceBlend, tgt.bounce, easing.bounce, dt);
      cur.tremorBlend = expApproach(cur.tremorBlend, tgt.tremor, easing.tremor, dt);
      cur.breathPhase = advancePhase(cur.breathPhase, breathHz, dt);
      cur.wagPhase = advancePhase(cur.wagPhase, wagHz, dt);
      cur.swayPhase = advancePhase(cur.swayPhase, swayHz, dt);
      cur.driftPhase = advancePhase(cur.driftPhase, drift.base + drift.perBreathHz * breathHz, dt);

      const p = tgt.pose;
      const k = poseSprings;
      stepSecondOrderInPlace(cur.leanX, p.leanX, dt, k.leanX[0] * springFreqScale, k.leanX[1], k.leanX[2]);
      stepSecondOrderInPlace(cur.leanY, p.leanY, dt, k.leanY[0] * springFreqScale, k.leanY[1], k.leanY[2]);
      stepSecondOrderInPlace(cur.bodyTilt, p.bodyTiltDeg, dt, k.bodyTilt[0] * springFreqScale, k.bodyTilt[1], k.bodyTilt[2]);
      stepSecondOrderInPlace(cur.headTilt, p.headTiltDeg, dt, k.headTilt[0] * springFreqScale, k.headTilt[1], k.headTilt[2]);
      stepSecondOrderInPlace(cur.headY, p.headY, dt, k.headY[0] * springFreqScale, k.headY[1], k.headY[2]);
      stepSecondOrderInPlace(cur.leftEar, p.leftEarDeg, dt, k.leftEar[0] * springFreqScale, k.leftEar[1], k.leftEar[2]);
      stepSecondOrderInPlace(cur.rightEar, p.rightEarDeg, dt, k.rightEar[0] * springFreqScale, k.rightEar[1], k.rightEar[2]);
      stepSecondOrderInPlace(
        cur.postureStretchY,
        p.postureStretchY,
        dt,
        k.postureStretchY[0] * springFreqScale,
        k.postureStretchY[1],
        k.postureStretchY[2]
      );
      return cur;
    };

    if (typeof sim.modify === 'function') {
      sim.modify(stepSim);
    } else if (sim.value) {
      stepSim(sim.value);
    }
  }, animate, 'useCreatureMotion');

  const playReaction = useCallback(
    (
      type: Reaction,
      meta?: {
        hitTier?: HitTier;
        hitKind?: HitKind;
        moveKind?: string;
        cheerReleaseMs?: number;
      }
    ) => {
      if (reactionTimerRef.current) {
        clearTimeout(reactionTimerRef.current);
        reactionTimerRef.current = null;
      }
      if (reactionLeadTimerRef.current) {
        clearTimeout(reactionLeadTimerRef.current);
        reactionLeadTimerRef.current = null;
      }
      if (reactionFinishTimerRef.current) {
        clearTimeout(reactionFinishTimerRef.current);
        reactionFinishTimerRef.current = null;
      }
      playCountRef.current += 1;
      setActiveReaction(type);
      setReactionKey(playCountRef.current);

      // A chain: the same reaction again while the last one is still being felt
      const now = Date.now();
      const last = lastPlayRef.current;
      const chain = last.type === type && now - last.at < HIT.chainWindowMs ? Math.min(HIT.chainMax, last.chain + 1) : 0;
      lastPlayRef.current = { type, at: now, chain };

      const context: ReactionContext = {
        chain,
        intensity: reactionIntensity,
        hitTier: meta?.hitTier ?? hitTier,
        hitKind: meta?.hitKind ?? hitKind,
        moveKind: meta?.moveKind,
        cheerReleaseMs: meta?.cheerReleaseMs ?? cheerReleaseMs,
        compact: isCompact,
        massClass: resolvedMassClass,
      };

      const rawHoldMs = config.resolveReactionHoldMs?.(type, context) ?? config.reactionHoldMs[type] ?? 850;
      const holdMs =
        config.resolveReactionHoldMs || massTimeMult === 1
          ? rawHoldMs
          : Math.round(rawHoldMs * massTimeMult);

      // Soft blink-through release avoids jarring 1-frame snap-cuts when returning to idle expression
      const canSoftBlinkRelease =
        animate && !stillReactions && lively && healthState !== 'knocked_out' && holdMs > BLINK.closeMs * 3;
      if (canSoftBlinkRelease) {
        reactionLeadTimerRef.current = setTimeout(() => {
          reactionLeadTimerRef.current = null;
          setBlinkStage(1);
          lidClose.value = withTiming(0.75, { duration: BLINK.closeMs, easing: EASE.enter });
        }, holdMs - BLINK.closeMs);
      }

      reactionTimerRef.current = setTimeout(() => {
        reactionTimerRef.current = null;
        setActiveReaction(null);
        // Spring-aligned expression settle: relax compact head acting boost & lift release lid smoothly
        if (animate && !stillReactions) {
          compactHeadScale.value = withTiming(1, { duration: MS.quick, easing: EASE.ui });
          if (canSoftBlinkRelease) {
            lidClose.value = withTiming(0, { duration: BLINK.openMs, easing: EASE.ui });
            reactionFinishTimerRef.current = setTimeout(() => {
              reactionFinishTimerRef.current = null;
              setBlinkStage(0);
            }, BLINK.openMs);
          }
        } else {
          compactHeadScale.value = 1;
        }
      }, holdMs);

      if (animate && !stillReactions) {
        if (isCompact) {
          compactHeadScale.value = withTiming(CREATURE_ACTING.compactHeadBoostScale, {
            duration: HIT.snapMs,
            easing: EASE.enter,
          });
        }
        const handled = speciesChoreography?.(type, channels, size, context) === true;
        if (!handled) {
          config.playReaction(type, channels, size, context);
        }
      }
    },
    [
      config,
      animate,
      stillReactions,
      lively,
      healthState,
      reactionIntensity,
      size,
      channels,
      hitTier,
      hitKind,
      cheerReleaseMs,
      isCompact,
      resolvedMassClass,
      massTimeMult,
      speciesChoreography,
      compactHeadScale,
      lidClose,
    ]
  );

  const lastExternalIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (reaction && reaction.id !== lastExternalIdRef.current) {
      lastExternalIdRef.current = reaction.id;
      playReaction(reaction.type, {
        hitTier: reaction.tier ?? reaction.hitTier,
        hitKind: reaction.hitKind ?? reaction.hitStyle,
        moveKind: reaction.moveKind,
        cheerReleaseMs: reaction.releaseMs,
      });
    }
  }, [reaction, playReaction]);

  useEffect(() => {
    return () => {
      if (reactionTimerRef.current) {
        clearTimeout(reactionTimerRef.current);
      }
      if (reactionLeadTimerRef.current) {
        clearTimeout(reactionLeadTimerRef.current);
      }
      if (reactionFinishTimerRef.current) {
        clearTimeout(reactionFinishTimerRef.current);
      }
      cancelAnimation(bodyTx);
      cancelAnimation(bodyTy);
      cancelAnimation(reactionScaleY);
      cancelAnimation(bodyRotate);
      cancelAnimation(headRotate);
      cancelAnimation(headTy);
      cancelAnimation(leftEarExtra);
      cancelAnimation(rightEarExtra);
      cancelAnimation(tailExtra);
      cancelAnimation(pawBounce);
      cancelAnimation(pawTx);
      cancelAnimation(pawRotate);
      cancelAnimation(headTx);
      cancelAnimation(scaleX);
      cancelAnimation(bodySkewX);
      cancelAnimation(lidClose);
      cancelAnimation(compactHeadScale);
    };
  }, [
    bodyTx,
    bodyTy,
    reactionScaleY,
    bodyRotate,
    headRotate,
    headTy,
    leftEarExtra,
    rightEarExtra,
    tailExtra,
    pawBounce,
    pawTx,
    pawRotate,
    headTx,
    scaleX,
    bodySkewX,
    lidClose,
    compactHeadScale,
  ]);

  // Deterministic 3-step single & double blinks (`0 -> 1 -> 2 -> 1 -> 0`), eye saccades, and idle micro-fidgets
  useEffect(() => {
    if (!animate || !lively || healthState === 'knocked_out') {
      cancelAnimation(lidClose);
      lidClose.value = 0;
      setBlinkStage(0);
      setIdleGaze(CENTRE_GAZE);
      return;
    }

    const timers = new Set<ReturnType<typeof setTimeout>>();
    let cancelled = false;
    let blinkSeed = seedFromKey(`${name}:blink:${Math.round(size)}:${personality.breathCycleMs}`);
    let gazeSeed = seedFromKey(`${name}:gaze:${Math.round(size)}:${personality.tailCycleMs}`);

    const nextBlinkUnit = () => {
      const step = nextDeterministicUnit(blinkSeed);
      blinkSeed = step.nextSeed;
      return step.value;
    };
    const nextGazeUnit = () => {
      const step = nextDeterministicUnit(gazeSeed);
      gazeSeed = step.nextSeed;
      return step.value;
    };

    const trackTimeout = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        timers.delete(id);
        if (!cancelled) fn();
      }, ms);
      timers.add(id);
    };

    const { blink, gaze: gazeCfg } = config;

    const runSingleBlink = (onDone: () => void) => {
      setBlinkStage(1);
      lidClose.value = withSequence(
        withTiming(1, { duration: BLINK.closeMs, easing: EASE.enter }),
        withDelay(BLINK.holdMs, withTiming(0, { duration: BLINK.openMs, easing: EASE.ui }))
      );
      trackTimeout(() => {
        setBlinkStage(2);
        trackTimeout(() => {
          setBlinkStage(1);
          trackTimeout(() => {
            setBlinkStage(0);
            onDone();
          }, BLINK.openMs);
        }, BLINK.holdMs);
      }, BLINK.closeMs);
    };

    let isFirstBlink = true;
    const scheduleNextBlink = () => {
      // Anchor the initial blink near the natural midpoint with a small deterministic
      // phase offset (0..24 ms) so creatures never blink abruptly on mount, then use the
      // full deterministic jitter range for every subsequent blink.
      const nextMs = isFirstBlink
        ? blink.minGapMs + Math.floor(blink.gapJitterMs * 0.5) - Math.floor(nextBlinkUnit() * 24)
        : blink.minGapMs + Math.floor(nextBlinkUnit() * blink.gapJitterMs);
      isFirstBlink = false;
      trackTimeout(() => {
        const fidgetRoll = nextBlinkUnit();
        const handledFidget = speciesFidget?.(fidgetRoll, channels, size) === true;
        if (!handledFidget) {
          config.idleFidget(fidgetRoll, channels);
        }

        const isDoubleBlink = nextBlinkUnit() < blink.doubleChance;
        runSingleBlink(() => {
          if (isDoubleBlink) {
            trackTimeout(() => {
              runSingleBlink(scheduleNextBlink);
            }, BLINK.doubleGapMs);
          } else {
            scheduleNextBlink();
          }
        });
      }, nextMs);
    };

    // Eyes dart first; the head follows through the posture springs
    const scheduleNextGaze = () => {
      const nextGazeMs = gazeCfg.minGapMs + Math.floor(nextGazeUnit() * gazeCfg.gapJitterMs);
      trackTimeout(() => {
        setIdleGaze(gazeCfg.candidates[Math.floor(nextGazeUnit() * gazeCfg.candidates.length)]);
        scheduleNextGaze();
      }, nextGazeMs);
    };

    scheduleNextBlink();
    scheduleNextGaze();

    return () => {
      cancelled = true;
      cancelAnimation(lidClose);
      lidClose.value = 0;
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [
    config,
    name,
    size,
    personality.breathCycleMs,
    personality.tailCycleMs,
    animate,
    lively,
    healthState,
    channels,
    speciesFidget,
    lidClose,
  ]);

  // One tap plays the tap reaction; a rapid streak of taps plays the easter egg
  const handlePress = useCallback(() => {
    if (!interactive) return;
    const now = Date.now();
    const recent = tapTimestampsRef.current.filter((t) => now - t < TAP_STREAK_WINDOW_MS);
    recent.push(now);
    tapTimestampsRef.current = recent;

    let type = config.tapReaction;
    if (recent.length >= TAP_STREAK_THRESHOLD) {
      tapTimestampsRef.current = [];
      type = config.tapStreakReaction;
    }
    playReaction(type);
    onTap?.(type);
  }, [config, interactive, playReaction, onTap]);

  // Pixel offsets from centre (50, 50) for each anatomical joint
  const headDx = ((pivots.head.x - 50) / 100) * size;
  const headDy = ((pivots.head.y - 50) / 100) * size;
  const leftDx = ((pivots.leftEar.x - 50) / 100) * size;
  const leftDy = ((pivots.leftEar.y - 50) / 100) * size;
  const rightDx = ((pivots.rightEar.x - 50) / 100) * size;
  const rightDy = ((pivots.rightEar.y - 50) / 100) * size;
  const tailDx = ((pivots.tail.x - 50) / 100) * size;
  const tailDy = ((pivots.tail.y - 50) / 100) * size;
  const pawDx = ((pivots.paws.x - 50) / 100) * size;
  const pawDy = ((pivots.paws.y - 50) / 100) * size;
  // Ground contact line at the bottom of the feet (~y=85 in 0..100 SVG space)
  const footAnchorY = size * 0.35;

  const baseBreathAmp = personality.breathIntensity;
  const idleTiltAmp = personality.idleTiltDeg;
  const earAmp = personality.earSwayDeg;
  const tailAmp = personality.tailWagDeg;

  const {
    hop,
    danceTiltDeg,
    tremorFreq,
    tremorAmpPx,
    shadowOpacity,
    shadowLiftShrinkX,
    shadowLiftShrinkY,
    pawTap,
    pawTapThreshold,
    pawTapGain,
  } = config.look;

  // Core contact shadow: widens & deepens on squash/stomp, shrinks & fades crisply on lift
  const groundShadowStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const breathWave = sampleOrganicBreath(s.breathPhase, s.driftPhase) * s.breathAmpScale;
    const celebrationHop = -Math.abs(Math.sin(s.breathPhase)) * size * hop * s.bounceBlend;
    const totalTy = bodyTy.value + s.leanY.y + celebrationHop;
    const liftPx = Math.max(0, -totalTy);
    const stompPx = Math.max(0, totalTy);
    const liftNorm = Math.min(1, liftPx / Math.max(8, size * 0.28));
    const stompNorm = Math.min(1, stompPx / Math.max(6, size * 0.14));

    const combinedScaleY =
      reactionScaleY.value *
      s.postureStretchY.y *
      (1 + breathWave * baseBreathAmp);
    const { scaleX: volScaleX } = computeVolumePreservedScale(combinedScaleY);
    const finalScaleX = Math.max(0.68, Math.min(1.45, volScaleX * scaleX.value));
    const squashBoost = Math.max(0, 1 - combinedScaleY);

    return {
      opacity: Math.min(
        1,
        Math.max(0.06, shadowOpacity * (1 + squashBoost * 0.25 + stompNorm * 0.18) * (1 - liftNorm * 0.65))
      ),
      transform: [
        { translateX: (bodyTx.value + s.leanX.y) * 0.55 },
        { scaleX: finalScaleX * (1 + squashBoost * 0.22 + stompNorm * 0.12) * (1 - liftNorm * shadowLiftShrinkX) },
        { scaleY: Math.max(0.55, (1 + squashBoost * 0.1 + stompNorm * 0.08) * (1 - liftNorm * shadowLiftShrinkY)) },
      ],
    };
  });

  // Outer soft penumbra shadow: shifts gently away from upper-left key light and diffuses softly on lift
  const groundPenumbraStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const breathWave = sampleOrganicBreath(s.breathPhase, s.driftPhase) * s.breathAmpScale;
    const celebrationHop = -Math.abs(Math.sin(s.breathPhase)) * size * hop * s.bounceBlend;
    const totalTy = bodyTy.value + s.leanY.y + celebrationHop;
    const liftPx = Math.max(0, -totalTy);
    const stompPx = Math.max(0, totalTy);
    const liftNorm = Math.min(1, liftPx / Math.max(8, size * 0.28));
    const stompNorm = Math.min(1, stompPx / Math.max(6, size * 0.14));

    const combinedScaleY =
      reactionScaleY.value *
      s.postureStretchY.y *
      (1 + breathWave * baseBreathAmp);
    const { scaleX: volScaleX } = computeVolumePreservedScale(combinedScaleY);
    const finalScaleX = Math.max(0.68, Math.min(1.45, volScaleX * scaleX.value));
    const squashBoost = Math.max(0, 1 - combinedScaleY);

    return {
      opacity: Math.min(
        1,
        Math.max(0.04, shadowOpacity * (1 + squashBoost * 0.2 + stompNorm * 0.14) * (1 - liftNorm * 0.45))
      ),
      transform: [
        { translateX: (bodyTx.value + s.leanX.y) * 0.55 + liftNorm * size * 0.045 },
        { scaleX: finalScaleX * (1 + squashBoost * 0.28 + stompNorm * 0.16 + liftNorm * 0.06) },
        { scaleY: Math.max(0.65, (1 + squashBoost * 0.12 + stompNorm * 0.08) * (1 - liftNorm * shadowLiftShrinkY * 0.55)) },
      ],
    };
  });

  // Whole rig: breathing, inertial posture, volume-preserving squash/stretch, and 1-2f strike smear
  const rigRootStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const breathWave = sampleOrganicBreath(s.breathPhase, s.driftPhase) * s.breathAmpScale;
    const swayWave = Math.sin(s.swayPhase) * s.swayAmpScale;

    const celebrationHop = -Math.abs(Math.sin(s.breathPhase)) * size * hop * s.bounceBlend;
    const tremorX = Math.sin(s.wagPhase * tremorFreq) * tremorAmpPx * s.tremorBlend;

    const danceTilt = swayWave * danceTiltDeg * s.bounceBlend;
    const ambientTilt = swayWave * idleTiltAmp;

    const rawScaleY =
      reactionScaleY.value *
      s.postureStretchY.y *
      (1 + breathWave * baseBreathAmp);
    const { scaleX: volScaleX, scaleY } = computeVolumePreservedScale(rawScaleY);
    const finalScaleX = Math.max(0.65, Math.min(1.48, volScaleX * scaleX.value));

    return {
      transform: [
        { translateX: bodyTx.value + s.leanX.y + tremorX },
        { translateY: bodyTy.value + s.leanY.y + celebrationHop },
        { rotate: `${bodyRotate.value + s.bodyTilt.y + ambientTilt + danceTilt}deg` },
        // Anchor squash, stretch & directional velocity smear at ground contact line so feet stay planted
        { translateY: footAnchorY },
        { skewX: `${bodySkewX.value}deg` },
        { scaleX: finalScaleX },
        { scaleY },
        { translateY: -footAnchorY },
      ],
    };
  });

  // Head lags `OVERLAP.headRad` (0.68 rad) behind chest breathing for a natural spine wave,
  // with dual-axis 2.5D orbital parallax (`headTx`), smooth blink compression, and compact acting boost
  const headStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const laggedBreath = sampleOverlappingWave(s.breathPhase, OVERLAP.headRad, 0.14) * s.breathAmpScale;
    const laggedSway = sampleOverlappingWave(s.swayPhase, OVERLAP.swayRad, 0.1) * s.swayAmpScale;

    const rot = headRotate.value + s.headTilt.y + laggedSway * 1.9;
    // Sakurai Ep. #249 dual-axis turn illusion: subtle orbital X shift paired with Z rotation
    const orbitalTx = (rot / 14) * size * 0.018;
    const xOffset = headTx.value + orbitalTx;
    const yOffset = headTy.value + s.headY.y - laggedBreath * size * 0.014;
    const headScale = compactHeadScale.value;
    const blinkSquashY = 1 - lidClose.value * CREATURE_ACTING.blinkHeadSquash;

    return {
      transform: [
        { translateX: headDx + xOffset },
        { translateY: headDy + yOffset },
        { rotate: `${rot}deg` },
        { scaleX: headScale },
        { scaleY: headScale * blinkSquashY },
        { translateX: -headDx },
        { translateY: -headDy },
      ],
    };
  });

  // Left appendage lags `OVERLAP.leftAppendageRad` (1.28 rad) behind the chest for soft tip follow-through
  const leftEarStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const laggedEarWave = sampleOverlappingWave(s.breathPhase, OVERLAP.leftAppendageRad, 0.22) * s.breathAmpScale;
    const rot = laggedEarWave * earAmp + s.leftEar.y + leftEarExtra.value;

    return {
      transform: [
        { translateX: leftDx },
        { translateY: leftDy },
        { rotate: `${rot}deg` },
        { translateX: -leftDx },
        { translateY: -leftDy },
      ],
    };
  });

  // Right appendage uses `OVERLAP.rightAppendageRad` (1.44 rad) to prevent mirrored "twinning"
  const rightEarStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const laggedEarWave = sampleOverlappingWave(s.breathPhase, OVERLAP.rightAppendageRad, 0.22) * s.breathAmpScale;
    const rot = -laggedEarWave * earAmp + s.rightEar.y + rightEarExtra.value;

    return {
      transform: [
        { translateX: rightDx },
        { translateY: rightDy },
        { rotate: `${rot}deg` },
        { translateX: -rightDx },
        { translateY: -rightDy },
      ],
    };
  });

  const tailStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const whipWave = sampleOverlappingWave(s.wagPhase, OVERLAP.tailWhipRad, 0.26) * s.wagAmpScale;
    const rot = whipWave * tailAmp + tailExtra.value;

    return {
      transform: [
        { translateX: tailDx },
        { translateY: tailDy },
        { rotate: `${rot}deg` },
        { translateX: -tailDx },
        { translateY: -tailDy },
      ],
    };
  });

  // Paws/limbs support vertical tap/bounce, horizontal jab/swipe (`pawTx`), and pivot rotation (`pawRotate`)
  const pawStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const excitement = Math.max(
      s.bounceBlend,
      Math.min(1, Math.max(0, (s.wagAmpScale - pawTapThreshold) * pawTapGain))
    );
    const tap = -Math.abs(Math.sin(s.wagPhase)) * size * pawTap * excitement;
    return {
      transform: [
        { translateX: pawDx + pawTx.value },
        { translateY: pawDy + pawBounce.value + tap },
        { rotate: `${pawRotate.value}deg` },
        { translateX: -pawDx },
        { translateY: -pawDy },
      ],
    };
  });

  return {
    activeReaction,
    reactionKey,
    isBlinking,
    blinkStage,
    lidClose,
    gaze,
    handlePress,
    rigRootStyle: asPart(rigRootStyle),
    groundShadowStyle: asPart(groundShadowStyle),
    groundPenumbraStyle: asPart(groundPenumbraStyle),
    headStyle: asPart(headStyle),
    leftEarStyle: asPart(leftEarStyle),
    rightEarStyle: asPart(rightEarStyle),
    tailStyle: asPart(tailStyle),
    pawStyle: asPart(pawStyle),
    bodyTy,
    reactionScaleY,
  };
}
