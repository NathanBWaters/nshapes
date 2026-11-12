import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SharedValue,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
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
  stepSecondOrder,
} from '@/utils/proceduralMotion';
import { CreatureJointPivots, GazeOffset } from './types';

/**
 * Additive impulse channels that one-shot reactions and idle fidgets animate.
 * They layer on top of the continuous simulation without resetting it.
 */
export interface ReactionChannels {
  bodyTx: SharedValue<number>;
  bodyTy: SharedValue<number>;
  reactionScaleY: SharedValue<number>;
  bodyRotate: SharedValue<number>;
  headRotate: SharedValue<number>;
  headTy: SharedValue<number>;
  leftEarExtra: SharedValue<number>;
  rightEarExtra: SharedValue<number>;
  tailExtra: SharedValue<number>;
  pawBounce: SharedValue<number>;
}

type PartStyle = ReturnType<typeof useAnimatedStyle>;

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
  /** How long each one-shot reaction holds its expression */
  reactionHoldMs: Record<Reaction, number>;
  /** Starts the choreography of a one-shot reaction on the impulse channels */
  playReaction: (type: Reaction, channels: ReactionChannels, size: number) => void;
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
  reaction: { type: Reaction; id: number } | null;
  /** Run continuous motion (false = settle straight into the resting pose) */
  animate: boolean;
  /** Blink, glance around and fidget while idle */
  lively: boolean;
  interactive: boolean;
  onTap?: (reaction: Reaction) => void;
}

interface CreatureMotion<Reaction extends string> {
  activeReaction: Reaction | null;
  /** Changes every time a reaction plays, so effects can replay identical reactions */
  reactionKey: number;
  isBlinking: boolean;
  gaze: GazeOffset;
  handlePress: () => void;
  rigRootStyle: PartStyle;
  groundShadowStyle: PartStyle;
  headStyle: PartStyle;
  leftEarStyle: PartStyle;
  rightEarStyle: PartStyle;
  tailStyle: PartStyle;
  pawStyle: PartStyle;
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
  const { name, size, mood, healthState, personality, pivots, reaction, animate, lively, interactive, onTap } =
    input;

  const [activeReaction, setActiveReaction] = useState<Reaction | null>(reaction?.type ?? null);
  const [reactionKey, setReactionKey] = useState<number>(reaction ? 1 : 0);
  const [isBlinking, setIsBlinking] = useState(false);
  const [idleGaze, setIdleGaze] = useState<GazeOffset>(CENTRE_GAZE);

  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimestampsRef = useRef<number[]>([]);
  const playCountRef = useRef(0);

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
      // Reduced-motion / static mode: settle directly into the resting pose
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
  ]);

  const { easing, drift, poseSprings } = config;

  // UI-thread continuous phase integrator + second-order posture solver
  useFrameCallback((frameInfo) => {
    const dtMs = frameInfo.timeSincePreviousFrame;
    if (dtMs === null || dtMs <= 0) return;
    const dt = Math.min(dtMs / 1000, 0.05);

    const cur = sim.value;
    const tgt = targets.value;

    const breathHz = expApproach(cur.breathHz, tgt.rates.breathHz, easing.breathHz, dt);
    const wagHz = expApproach(cur.wagHz, tgt.rates.wagHz, easing.wagHz, dt);
    const swayHz = expApproach(cur.swayHz, tgt.rates.swayHz, easing.swayHz, dt);

    const next: SimState = {
      ...cur,
      breathHz,
      wagHz,
      swayHz,
      breathAmpScale: expApproach(cur.breathAmpScale, tgt.rates.breathAmpScale, easing.breathAmp, dt),
      wagAmpScale: expApproach(cur.wagAmpScale, tgt.rates.wagAmpScale, easing.wagAmp, dt),
      swayAmpScale: expApproach(cur.swayAmpScale, tgt.rates.swayAmpScale, easing.swayAmp, dt),
      bounceBlend: expApproach(cur.bounceBlend, tgt.bounce, easing.bounce, dt),
      tremorBlend: expApproach(cur.tremorBlend, tgt.tremor, easing.tremor, dt),
      breathPhase: advancePhase(cur.breathPhase, breathHz, dt),
      wagPhase: advancePhase(cur.wagPhase, wagHz, dt),
      swayPhase: advancePhase(cur.swayPhase, swayHz, dt),
      driftPhase: advancePhase(cur.driftPhase, drift.base + drift.perBreathHz * breathHz, dt),
    };

    const p = tgt.pose;
    const k = poseSprings;
    next.leanX = stepSecondOrder(cur.leanX, p.leanX, dt, k.leanX[0], k.leanX[1], k.leanX[2]);
    next.leanY = stepSecondOrder(cur.leanY, p.leanY, dt, k.leanY[0], k.leanY[1], k.leanY[2]);
    next.bodyTilt = stepSecondOrder(cur.bodyTilt, p.bodyTiltDeg, dt, k.bodyTilt[0], k.bodyTilt[1], k.bodyTilt[2]);
    next.headTilt = stepSecondOrder(cur.headTilt, p.headTiltDeg, dt, k.headTilt[0], k.headTilt[1], k.headTilt[2]);
    next.headY = stepSecondOrder(cur.headY, p.headY, dt, k.headY[0], k.headY[1], k.headY[2]);
    next.leftEar = stepSecondOrder(cur.leftEar, p.leftEarDeg, dt, k.leftEar[0], k.leftEar[1], k.leftEar[2]);
    next.rightEar = stepSecondOrder(cur.rightEar, p.rightEarDeg, dt, k.rightEar[0], k.rightEar[1], k.rightEar[2]);
    next.postureStretchY = stepSecondOrder(
      cur.postureStretchY,
      p.postureStretchY,
      dt,
      k.postureStretchY[0],
      k.postureStretchY[1],
      k.postureStretchY[2]
    );

    sim.value = next;
  }, animate);

  const playReaction = useCallback(
    (type: Reaction) => {
      if (reactionTimerRef.current) {
        clearTimeout(reactionTimerRef.current);
      }
      playCountRef.current += 1;
      setActiveReaction(type);
      setReactionKey(playCountRef.current);

      reactionTimerRef.current = setTimeout(() => {
        setActiveReaction(null);
      }, config.reactionHoldMs[type] ?? 850);

      if (animate) {
        config.playReaction(type, channels, size);
      }
    },
    [config, animate, size, channels]
  );

  const lastExternalIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (reaction && reaction.id !== lastExternalIdRef.current) {
      lastExternalIdRef.current = reaction.id;
      playReaction(reaction.type);
    }
  }, [reaction, playReaction]);

  useEffect(() => {
    return () => {
      if (reactionTimerRef.current) {
        clearTimeout(reactionTimerRef.current);
      }
    };
  }, []);

  // Single & double blinks, eye saccades, and idle micro-fidgets
  useEffect(() => {
    if (!animate || !lively || healthState === 'knocked_out') {
      setIsBlinking(false);
      setIdleGaze(CENTRE_GAZE);
      return;
    }

    const timers = new Set<ReturnType<typeof setTimeout>>();
    let cancelled = false;

    const trackTimeout = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        timers.delete(id);
        if (!cancelled) fn();
      }, ms);
      timers.add(id);
    };

    const { blink, gaze: gazeCfg } = config;

    const scheduleNextBlink = () => {
      const nextMs = blink.minGapMs + Math.floor(Math.random() * blink.gapJitterMs);
      trackTimeout(() => {
        setIsBlinking(true);
        config.idleFidget(Math.random(), channels);

        const isDoubleBlink = Math.random() < blink.doubleChance;
        trackTimeout(() => {
          setIsBlinking(false);
          if (isDoubleBlink) {
            trackTimeout(() => {
              setIsBlinking(true);
              trackTimeout(() => {
                setIsBlinking(false);
                scheduleNextBlink();
              }, blink.doubleHoldMs);
            }, blink.doubleGapMs);
          } else {
            scheduleNextBlink();
          }
        }, blink.holdMs);
      }, nextMs);
    };

    // Eyes dart first; the head follows through the posture springs
    const scheduleNextGaze = () => {
      const nextGazeMs = gazeCfg.minGapMs + Math.floor(Math.random() * gazeCfg.gapJitterMs);
      trackTimeout(() => {
        setIdleGaze(gazeCfg.candidates[Math.floor(Math.random() * gazeCfg.candidates.length)]);
        scheduleNextGaze();
      }, nextGazeMs);
    };

    scheduleNextBlink();
    scheduleNextGaze();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [config, animate, lively, healthState, channels]);

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

  // Contact shadow: widens on squash, shrinks & fades as the body leaves the ground
  const groundShadowStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const breathWave = sampleOrganicBreath(s.breathPhase, s.driftPhase) * s.breathAmpScale;
    const celebrationHop = -Math.abs(Math.sin(s.breathPhase)) * size * hop * s.bounceBlend;
    const totalTy = bodyTy.value + s.leanY.y + celebrationHop;
    const liftPx = Math.max(0, -totalTy);
    const liftNorm = Math.min(1, liftPx / Math.max(8, size * 0.28));

    const combinedScaleY =
      reactionScaleY.value *
      s.postureStretchY.y *
      (1 + breathWave * baseBreathAmp);
    const { scaleX: volScaleX } = computeVolumePreservedScale(combinedScaleY);

    return {
      opacity: Math.max(0.06, shadowOpacity * (1 - liftNorm * 0.62)),
      transform: [
        { translateX: (bodyTx.value + s.leanX.y) * 0.55 },
        { scaleX: volScaleX * (1 - liftNorm * shadowLiftShrinkX) },
        { scaleY: Math.max(0.55, 1 - liftNorm * shadowLiftShrinkY) },
      ],
    };
  });

  // Whole rig: breathing, inertial posture, and volume-preserving squash & stretch
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
    const { scaleX, scaleY } = computeVolumePreservedScale(rawScaleY);

    return {
      transform: [
        { translateX: bodyTx.value + s.leanX.y + tremorX },
        { translateY: bodyTy.value + s.leanY.y + celebrationHop },
        { rotate: `${bodyRotate.value + s.bodyTilt.y + ambientTilt + danceTilt}deg` },
        // Anchor squash & stretch at the ground contact line so feet stay planted
        { translateY: footAnchorY },
        { scaleX },
        { scaleY },
        { translateY: -footAnchorY },
      ],
    };
  });

  // Head lags ~0.68 rad behind chest breathing for a natural spine wave
  const headStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const laggedBreath = sampleOverlappingWave(s.breathPhase, 0.68, 0.14) * s.breathAmpScale;
    const laggedSway = sampleOverlappingWave(s.swayPhase, 0.52, 0.1) * s.swayAmpScale;

    const yOffset = headTy.value + s.headY.y - laggedBreath * size * 0.014;
    const rot = headRotate.value + s.headTilt.y + laggedSway * 1.9;

    return {
      transform: [
        { translateX: headDx },
        { translateY: headDy + yOffset },
        { rotate: `${rot}deg` },
        { translateX: -headDx },
        { translateY: -headDy },
      ],
    };
  });

  // Left appendage lags ~1.28 rad behind the chest for soft tip follow-through
  const leftEarStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const laggedEarWave = sampleOverlappingWave(s.breathPhase, 1.28, 0.22) * s.breathAmpScale;
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

  // Right appendage uses a slightly different lag (1.42 rad) to avoid mirrored "twinning"
  const rightEarStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const laggedEarWave = sampleOverlappingWave(s.breathPhase, 1.42, 0.22) * s.breathAmpScale;
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
    const whipWave = sampleOverlappingWave(s.wagPhase, 0.35, 0.26) * s.wagAmpScale;
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

  // Feet tap when celebrating or when the tail is wagging hard
  const pawStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const excitement = Math.max(
      s.bounceBlend,
      Math.min(1, Math.max(0, (s.wagAmpScale - pawTapThreshold) * pawTapGain))
    );
    const tap = -Math.abs(Math.sin(s.wagPhase)) * size * pawTap * excitement;
    return {
      transform: [{ translateY: pawBounce.value + tap }],
    };
  });

  return {
    activeReaction,
    reactionKey,
    isBlinking,
    gaze,
    handlePress,
    rigRootStyle,
    groundShadowStyle,
    headStyle,
    leftEarStyle,
    rightEarStyle,
    tailStyle,
    pawStyle,
  };
}
