import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Character } from '@/types';
import { COLORS } from '@/utils/colors';
import { useReducedMotion } from '@/utils/animation';
import {
  FIGHTER_REACTION_HOLD_MS,
  FighterAmbientMood,
  FighterReactionEvent,
  FighterReactionType,
  getFighterHealthState,
  getFighterPersonality,
  resolveFighterExpression,
} from '@/utils/fighterAnimations';
import {
  MoodLoopRates,
  MoodPoseTargets,
  SecondOrderState,
  advancePhase,
  computeMoodLoopRates,
  computeMoodPoseTargets,
  computeVolumePreservedScale,
  createSecondOrderState,
  expApproach,
  sampleOrganicBreath,
  sampleOverlappingWave,
  stepSecondOrder,
} from '@/utils/proceduralMotion';
import {
  BadgerRig,
  CREATURE_PIVOTS,
  CorgiRig,
  DEFAULT_CREATURE_PIVOTS,
  EmperorPenguinRig,
  FallbackFighterRig,
  GazeOffset,
  OrangeTabbyRig,
  PelicanRig,
  SlyFoxRig,
} from './creatures';
import { FighterDamageOverlay } from './FighterDamageOverlay';
import { FighterEffectsOverlay } from './FighterEffectsOverlay';

interface FighterAvatarProps {
  /** Character object or character name (defaults to 'Orange Tabby') */
  character?: Character | string | null;
  /** Pixel width & height of the avatar (default 56) */
  size?: number;
  /** Current fighter HP (defaults to maxHealth = pristine) */
  health?: number;
  /** Max fighter HP (defaults to 3) */
  maxHealth?: number;
  /** Continuous ambient mood */
  mood?: FighterAmbientMood;
  /** Discrete one-shot reaction event ({ type, id }) */
  reaction?: FighterReactionEvent | null;
  /** Current consecutive match streak (shows subtle badge/glow when >= 3 and framed) */
  streak?: number;
  /** Whether continuous idle/reaction animations run (default true) */
  animate?: boolean;
  /** Whether tapping the fighter pets them (blush + heart, 5x = zoomie spin!) */
  interactive?: boolean;
  /** Optional callback when the player pets the fighter */
  onPet?: (reactionType: 'pet' | 'dizzy_joy') => void;
  /** Render inside a tactile NShapes portrait frame badge (ideal for HUD & headers) */
  framed?: boolean;
  /** Optional testID */
  testID?: string;
}

interface ProceduralSimState {
  // Continuous unbounded-feel phase accumulators (0..2π) — never hard-reset on mood changes
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
  victoryBounceBlend: number;
  urgentTremorBlend: number;

  // Second-order (f, z, r) spring-damper channels for inertial state transitions
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
  isVictory: number;
  isUrgentOrCritical: number;
}

const PET_STREAK_WINDOW_MS = 2400;
const PET_ZOOMIE_THRESHOLD = 5;

const IDLE_GAZE_CANDIDATES: GazeOffset[] = [
  { x: 0, y: 0 },
  { x: -0.55, y: -0.12 },
  { x: 0.58, y: -0.12 },
  { x: 0, y: 0 },
  { x: -0.35, y: 0.18 },
  { x: 0.42, y: -0.28 },
  { x: 0, y: 0 },
];

export const FighterAvatar: React.FC<FighterAvatarProps> = ({
  character,
  size = 56,
  health,
  maxHealth = 3,
  mood = 'idle',
  reaction = null,
  streak = 0,
  animate = true,
  interactive = false,
  onPet,
  framed = false,
  testID,
}) => {
  const reducedMotion = useReducedMotion();
  const shouldAnimate = animate && !reducedMotion;

  const characterName =
    typeof character === 'string'
      ? character
      : character?.name ?? 'Orange Tabby';
  const characterIcon = typeof character === 'object' && character ? character.icon : undefined;

  const personality = useMemo(() => getFighterPersonality(characterName), [characterName]);
  const pivots = CREATURE_PIVOTS[characterName] ?? DEFAULT_CREATURE_PIVOTS;
  const healthState = useMemo(
    () => getFighterHealthState(health, maxHealth),
    [health, maxHealth]
  );

  // Active reaction state (combines external `reaction` prop + local tap-to-pet reactions)
  const [activeReaction, setActiveReaction] = useState<FighterReactionType | null>(
    reaction?.type ?? null
  );
  const [activeReactionKey, setActiveReactionKey] = useState<number>(reaction?.id ?? 0);
  const [isBlinking, setIsBlinking] = useState(false);
  const [idleGaze, setIdleGaze] = useState<GazeOffset>({ x: 0, y: 0 });

  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const petTimestampsRef = useRef<number[]>([]);
  const localIdCounterRef = useRef<number>(100000);

  // Resolve effective eye gaze ("eyes lead, head follows" via second-order pose targets)
  const effectiveGaze: GazeOffset = useMemo(() => {
    if (healthState === 'knocked_out' || mood === 'sleepy') {
      return { x: 0, y: 0 };
    }
    if (mood === 'curious') {
      return { x: 0.65, y: -0.32 };
    }
    if (mood === 'anticipation') {
      return { x: 0, y: -0.22 };
    }
    if (mood === 'defeat') {
      return { x: -0.25, y: 0.35 };
    }
    return idleGaze;
  }, [healthState, mood, idleGaze]);

  const initialRates = useMemo(
    () =>
      computeMoodLoopRates(
        mood,
        healthState,
        personality.breathCycleMs,
        personality.tailCycleMs
      ),
    // Only used to seed initial shared values cleanly on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const initialPose = useMemo(
    () => computeMoodPoseTargets(mood, healthState, size, effectiveGaze.x, effectiveGaze.y),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Seed slight deterministic phase offset from character name so side-by-side fighters don't breathe in robotic unison!
  const phaseSeed = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < characterName.length; i++) {
      hash = (hash * 31 + characterName.charCodeAt(i)) % 628;
    }
    return hash / 100;
  }, [characterName]);

  const targetsSV = useSharedValue<SimTargets>({
    rates: initialRates,
    pose: initialPose,
    isVictory: mood === 'victory' ? 1 : 0,
    isUrgentOrCritical:
      mood === 'urgent' ? 1 : healthState === 'critical' ? 0.55 : 0,
  });

  const sim = useSharedValue<ProceduralSimState>({
    breathPhase: phaseSeed,
    wagPhase: (phaseSeed * 1.7) % (Math.PI * 2),
    swayPhase: (phaseSeed * 0.9) % (Math.PI * 2),
    driftPhase: phaseSeed * 0.5,
    breathHz: initialRates.breathHz,
    wagHz: initialRates.wagHz,
    swayHz: initialRates.swayHz,
    breathAmpScale: initialRates.breathAmpScale,
    wagAmpScale: initialRates.wagAmpScale,
    swayAmpScale: initialRates.swayAmpScale,
    victoryBounceBlend: mood === 'victory' ? 1 : 0,
    urgentTremorBlend: mood === 'urgent' ? 1 : healthState === 'critical' ? 0.55 : 0,
    leanX: createSecondOrderState(initialPose.leanX),
    leanY: createSecondOrderState(initialPose.leanY),
    bodyTilt: createSecondOrderState(initialPose.bodyTiltDeg),
    headTilt: createSecondOrderState(initialPose.headTiltDeg),
    headY: createSecondOrderState(initialPose.headY),
    leftEar: createSecondOrderState(initialPose.leftEarDeg),
    rightEar: createSecondOrderState(initialPose.rightEarDeg),
    postureStretchY: createSecondOrderState(initialPose.postureStretchY),
  });

  // Additive impulse channels for discrete reactions & micro-fidgets
  // (layered cleanly on top of `sim` without ever cancelling or resetting continuous loops!)
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

  // Sync continuous loop rates & inertial pose targets whenever state changes (zero loop resets!)
  useEffect(() => {
    const nextRates = computeMoodLoopRates(
      mood,
      healthState,
      personality.breathCycleMs,
      personality.tailCycleMs
    );
    const nextPose = computeMoodPoseTargets(
      mood,
      healthState,
      size,
      effectiveGaze.x,
      effectiveGaze.y
    );
    const nextVictory = mood === 'victory' && healthState !== 'knocked_out' ? 1 : 0;
    const nextUrgent =
      healthState === 'knocked_out'
        ? 0
        : mood === 'urgent'
          ? 1
          : healthState === 'critical'
            ? 0.55
            : 0;

    targetsSV.value = {
      rates: nextRates,
      pose: nextPose,
      isVictory: nextVictory,
      isUrgentOrCritical: nextUrgent,
    };

    if (!shouldAnimate) {
      // Reduced-motion / static mode: settle directly to resting target pose
      sim.value = {
        ...sim.value,
        breathHz: nextRates.breathHz,
        wagHz: nextRates.wagHz,
        swayHz: nextRates.swayHz,
        breathAmpScale: 0,
        wagAmpScale: 0,
        swayAmpScale: 0,
        victoryBounceBlend: 0,
        urgentTremorBlend: 0,
        leanX: createSecondOrderState(nextPose.leanX),
        leanY: createSecondOrderState(nextPose.leanY),
        bodyTilt: createSecondOrderState(nextPose.bodyTiltDeg),
        headTilt: createSecondOrderState(nextPose.headTiltDeg),
        headY: createSecondOrderState(nextPose.headY),
        leftEar: createSecondOrderState(nextPose.leftEarDeg),
        rightEar: createSecondOrderState(nextPose.rightEarDeg),
        postureStretchY: createSecondOrderState(nextPose.postureStretchY),
      };
    }
  }, [
    mood,
    healthState,
    size,
    personality.breathCycleMs,
    personality.tailCycleMs,
    effectiveGaze.x,
    effectiveGaze.y,
    shouldAnimate,
    targetsSV,
    sim,
  ]);

  // UI-thread 60-120fps continuous phase integrator + second-order spring-damper solver
  useFrameCallback((frameInfo) => {
    const dtMs = frameInfo.timeSincePreviousFrame;
    if (dtMs === null || dtMs <= 0) return;
    const dt = Math.min(dtMs / 1000, 0.05);

    const cur = sim.value;
    const tgt = targetsSV.value;

    // 1. Smoothly blend oscillator frequencies & amplitudes (preserves C1 phase continuity!)
    const breathHz = expApproach(cur.breathHz, tgt.rates.breathHz, 7.5, dt);
    const wagHz = expApproach(cur.wagHz, tgt.rates.wagHz, 9.0, dt);
    const swayHz = expApproach(cur.swayHz, tgt.rates.swayHz, 7.0, dt);

    const breathAmpScale = expApproach(cur.breathAmpScale, tgt.rates.breathAmpScale, 6.5, dt);
    const wagAmpScale = expApproach(cur.wagAmpScale, tgt.rates.wagAmpScale, 7.5, dt);
    const swayAmpScale = expApproach(cur.swayAmpScale, tgt.rates.swayAmpScale, 6.5, dt);
    const victoryBounceBlend = expApproach(cur.victoryBounceBlend, tgt.isVictory, 8.0, dt);
    const urgentTremorBlend = expApproach(
      cur.urgentTremorBlend,
      tgt.isUrgentOrCritical,
      8.0,
      dt
    );

    // 2. Integrate continuous phases forward in time
    const breathPhase = advancePhase(cur.breathPhase, breathHz, dt);
    const wagPhase = advancePhase(cur.wagPhase, wagHz, dt);
    const swayPhase = advancePhase(cur.swayPhase, swayHz, dt);
    const driftPhase = advancePhase(cur.driftPhase, 0.19, dt);

    // 3. Integrate inertial posture channels via (f, z, r) second-order dynamics:
    //    Body leads (f ~ 3.2, z ~ 0.76), Head follows ~80ms behind (f ~ 2.7, z ~ 0.66),
    //    Ears/wings follow with playful underdamped bounce (f ~ 2.4, z ~ 0.54)!
    const leanX = stepSecondOrder(cur.leanX, tgt.pose.leanX, dt, 3.2, 0.78, 0.25);
    const leanY = stepSecondOrder(cur.leanY, tgt.pose.leanY, dt, 3.4, 0.74, 0.3);
    const bodyTilt = stepSecondOrder(cur.bodyTilt, tgt.pose.bodyTiltDeg, dt, 3.0, 0.72, 0.2);
    const headTilt = stepSecondOrder(cur.headTilt, tgt.pose.headTiltDeg, dt, 2.65, 0.65, 0.15);
    const headY = stepSecondOrder(cur.headY, tgt.pose.headY, dt, 3.0, 0.7, 0.2);
    const leftEar = stepSecondOrder(cur.leftEar, tgt.pose.leftEarDeg, dt, 2.35, 0.54, 0.12);
    const rightEar = stepSecondOrder(cur.rightEar, tgt.pose.rightEarDeg, dt, 2.35, 0.54, 0.12);
    const postureStretchY = stepSecondOrder(
      cur.postureStretchY,
      tgt.pose.postureStretchY,
      dt,
      3.5,
      0.75,
      0.3
    );

    sim.value = {
      breathPhase,
      wagPhase,
      swayPhase,
      driftPhase,
      breathHz,
      wagHz,
      swayHz,
      breathAmpScale,
      wagAmpScale,
      swayAmpScale,
      victoryBounceBlend,
      urgentTremorBlend,
      leanX,
      leanY,
      bodyTilt,
      headTilt,
      headY,
      leftEar,
      rightEar,
      postureStretchY,
    };
  }, shouldAnimate);

  // Trigger Disney Anticipation -> Arc -> Follow-Through -> Settle choreography for discrete reactions
  const playReactionChoreography = useCallback(
    (type: FighterReactionType, id: number) => {
      if (reactionTimerRef.current) {
        clearTimeout(reactionTimerRef.current);
      }
      setActiveReaction(type);
      setActiveReactionKey(id);

      const holdMs = FIGHTER_REACTION_HOLD_MS[type] ?? 850;
      reactionTimerRef.current = setTimeout(() => {
        setActiveReaction(null);
      }, holdMs);

      if (!shouldAnimate) {
        return;
      }

      const jumpPx = Math.max(6, size * 0.22);
      const recoilPx = Math.max(4, size * 0.14);

      switch (type) {
        case 'joy': {
          // 1. Anticipation crouch (ears tuck) -> 2. Curved arc leap (stretch + flare) -> 3. Cushioned land -> 4. Spring settle
          reactionScaleY.value = withSequence(
            withTiming(0.83, { duration: 75, easing: Easing.out(Easing.quad) }),
            withTiming(1.17, { duration: 155, easing: Easing.out(Easing.cubic) }),
            withTiming(0.92, { duration: 115, easing: Easing.in(Easing.quad) }),
            withSpring(1, { damping: 9, stiffness: 220 })
          );
          bodyTy.value = withSequence(
            withTiming(size * 0.04, { duration: 75, easing: Easing.out(Easing.quad) }),
            withTiming(-jumpPx, { duration: 175, easing: Easing.out(Easing.cubic) }),
            withSpring(0, { damping: 8, stiffness: 195 })
          );
          bodyTx.value = withSequence(
            withTiming(size * 0.022, { duration: 160, easing: Easing.inOut(Easing.sin) }),
            withTiming(-size * 0.015, { duration: 140, easing: Easing.inOut(Easing.sin) }),
            withSpring(0, { damping: 10, stiffness: 200 })
          );
          bodyRotate.value = withSequence(
            withTiming(3.5, { duration: 70 }),
            withTiming(-9.5, { duration: 135 }),
            withTiming(8.5, { duration: 150 }),
            withSpring(0, { damping: 9, stiffness: 200 })
          );
          headTy.value = withDelay(
            40,
            withSequence(
              withTiming(-size * 0.035, { duration: 150 }),
              withSpring(0, { damping: 8, stiffness: 190 })
            )
          );
          leftEarExtra.value = withSequence(
            withTiming(7, { duration: 65 }),
            withTiming(-20, { duration: 150 }),
            withSpring(0, { damping: 7, stiffness: 175 })
          );
          rightEarExtra.value = withSequence(
            withTiming(-7, { duration: 65 }),
            withTiming(20, { duration: 150 }),
            withSpring(0, { damping: 7, stiffness: 175 })
          );
          pawBounce.value = withSequence(
            withTiming(size * 0.02, { duration: 70 }),
            withTiming(-size * 0.09, { duration: 170 }),
            withSpring(0, { damping: 8, stiffness: 185 })
          );
          tailExtra.value = withSequence(
            withTiming(18, { duration: 120 }),
            withTiming(-16, { duration: 130 }),
            withSpring(0, { damping: 7, stiffness: 180 })
          );
          break;
        }

        case 'ecstatic':
        case 'dizzy_joy': {
          // Deep coil with counter-rotation wind-up (-15deg) -> soaring 360 spin -> cushioned landing bounce!
          reactionScaleY.value = withSequence(
            withTiming(0.79, { duration: 85, easing: Easing.out(Easing.quad) }),
            withTiming(1.21, { duration: 170, easing: Easing.out(Easing.cubic) }),
            withTiming(0.9, { duration: 150, easing: Easing.in(Easing.quad) }),
            withSpring(1, { damping: 8, stiffness: 205 })
          );
          bodyTy.value = withSequence(
            withTiming(size * 0.055, { duration: 85, easing: Easing.out(Easing.quad) }),
            withTiming(-jumpPx * 1.32, { duration: 235, easing: Easing.out(Easing.cubic) }),
            withSpring(0, { damping: 7.5, stiffness: 185 })
          );
          bodyRotate.value = withSequence(
            withTiming(-15, { duration: 85, easing: Easing.inOut(Easing.quad) }),
            withTiming(368, { duration: 540, easing: Easing.out(Easing.cubic) }),
            withTiming(8, { duration: 1 }),
            withSpring(0, { damping: 9, stiffness: 200 })
          );
          leftEarExtra.value = withSequence(
            withTiming(-22, { duration: 180 }),
            withSpring(0, { damping: 7, stiffness: 170 })
          );
          rightEarExtra.value = withSequence(
            withTiming(22, { duration: 180 }),
            withSpring(0, { damping: 7, stiffness: 170 })
          );
          break;
        }

        case 'pain': {
          // Sharp impact squash + decaying harmonic horizontal recoil + lagged head whiplash + pinned ears!
          bodyTx.value = withSequence(
            withTiming(-recoilPx, { duration: 50, easing: Easing.out(Easing.quad) }),
            withTiming(recoilPx * 0.92, { duration: 60, easing: Easing.inOut(Easing.sin) }),
            withTiming(-recoilPx * 0.68, { duration: 60, easing: Easing.inOut(Easing.sin) }),
            withTiming(recoilPx * 0.45, { duration: 60, easing: Easing.inOut(Easing.sin) }),
            withSpring(0, { damping: 10, stiffness: 240 })
          );
          reactionScaleY.value = withSequence(
            withTiming(0.8, { duration: 65, easing: Easing.out(Easing.quad) }),
            withTiming(1.06, { duration: 110 }),
            withSpring(1, { damping: 9, stiffness: 220 })
          );
          bodyRotate.value = withSequence(
            withTiming(-12, { duration: 70 }),
            withTiming(8.5, { duration: 95 }),
            withSpring(0, { damping: 10, stiffness: 200 })
          );
          headRotate.value = withDelay(
            30,
            withSequence(
              withTiming(-9, { duration: 80 }),
              withTiming(6, { duration: 95 }),
              withSpring(0, { damping: 9, stiffness: 190 })
            )
          );
          leftEarExtra.value = withSequence(
            withTiming(18, { duration: 80 }),
            withSpring(0, { damping: 9, stiffness: 165 })
          );
          rightEarExtra.value = withSequence(
            withTiming(-18, { duration: 80 }),
            withSpring(0, { damping: 9, stiffness: 165 })
          );
          break;
        }

        case 'relief': {
          // Startled flinch -> deep chest-expanding inhale -> melting 'Phew!' exhale settle
          reactionScaleY.value = withSequence(
            withTiming(0.87, { duration: 80, easing: Easing.out(Easing.quad) }),
            withTiming(1.09, { duration: 230, easing: Easing.out(Easing.sin) }),
            withTiming(0.96, { duration: 240, easing: Easing.inOut(Easing.sin) }),
            withSpring(1, { damping: 10, stiffness: 170 })
          );
          bodyTy.value = withSequence(
            withTiming(size * 0.025, { duration: 80 }),
            withTiming(-size * 0.04, { duration: 220, easing: Easing.out(Easing.sin) }),
            withSpring(0, { damping: 10, stiffness: 160 })
          );
          headRotate.value = withSequence(
            withTiming(-4, { duration: 75 }),
            withTiming(11.5, { duration: 230, easing: Easing.out(Easing.quad) }),
            withTiming(11.5, { duration: 280 }),
            withSpring(0, { damping: 10, stiffness: 170 })
          );
          break;
        }

        case 'heal': {
          // Gentle anticipation dip -> warm buoyant levitation -> feather-soft settle
          bodyTy.value = withSequence(
            withTiming(size * 0.02, { duration: 80 }),
            withTiming(-jumpPx * 0.78, { duration: 320, easing: Easing.out(Easing.sin) }),
            withSpring(0, { damping: 11, stiffness: 150 })
          );
          reactionScaleY.value = withSequence(
            withTiming(0.95, { duration: 80 }),
            withTiming(1.09, { duration: 300, easing: Easing.out(Easing.sin) }),
            withSpring(1, { damping: 10, stiffness: 170 })
          );
          tailExtra.value = withSequence(
            withTiming(14, { duration: 180 }),
            withTiming(-14, { duration: 200 }),
            withSpring(0, { damping: 8, stiffness: 160 })
          );
          break;
        }

        case 'powerup': {
          // Grounded power-gather crouch -> heroic upward surge -> crisp landing!
          reactionScaleY.value = withSequence(
            withTiming(0.84, { duration: 105, easing: Easing.inOut(Easing.quad) }),
            withTiming(1.2, { duration: 195, easing: Easing.out(Easing.cubic) }),
            withTiming(0.94, { duration: 120 }),
            withSpring(1, { damping: 8.5, stiffness: 210 })
          );
          bodyTy.value = withSequence(
            withTiming(size * 0.04, { duration: 105 }),
            withTiming(-jumpPx * 0.92, { duration: 205, easing: Easing.out(Easing.cubic) }),
            withSpring(0, { damping: 9, stiffness: 195 })
          );
          leftEarExtra.value = withSequence(
            withTiming(8, { duration: 100 }),
            withTiming(-16, { duration: 180 }),
            withSpring(0, { damping: 8, stiffness: 185 })
          );
          rightEarExtra.value = withSequence(
            withTiming(-8, { duration: 100 }),
            withTiming(16, { duration: 180 }),
            withSpring(0, { damping: 8, stiffness: 185 })
          );
          break;
        }

        case 'hint': {
          // Slight double-take dip -> expressive 'Aha!' head-cock & asymmetric radar-ear perk!
          reactionScaleY.value = withSequence(
            withTiming(0.95, { duration: 70 }),
            withTiming(1.06, { duration: 140 }),
            withSpring(1, { damping: 10, stiffness: 190 })
          );
          headRotate.value = withSequence(
            withTiming(-4, { duration: 65 }),
            withTiming(14.5, { duration: 155, easing: Easing.out(Easing.back(1.5)) }),
            withTiming(14.5, { duration: 340 }),
            withSpring(0, { damping: 10, stiffness: 180 })
          );
          leftEarExtra.value = withSequence(
            withTiming(-20, { duration: 145, easing: Easing.out(Easing.back(1.4)) }),
            withTiming(-20, { duration: 340 }),
            withSpring(0, { damping: 8, stiffness: 180 })
          );
          break;
        }

        case 'pet': {
          // Cozy squish under the player's finger -> happy rebound + affectionate nuzzle!
          reactionScaleY.value = withSequence(
            withTiming(0.84, { duration: 95, easing: Easing.out(Easing.quad) }),
            withTiming(1.09, { duration: 145, easing: Easing.out(Easing.cubic) }),
            withSpring(1, { damping: 8, stiffness: 200 })
          );
          headRotate.value = withSequence(
            withTiming(-9.5, { duration: 120, easing: Easing.inOut(Easing.sin) }),
            withTiming(9.5, { duration: 145, easing: Easing.inOut(Easing.sin) }),
            withSpring(0, { damping: 9, stiffness: 180 })
          );
          tailExtra.value = withSequence(
            withTiming(18, { duration: 110 }),
            withTiming(-18, { duration: 120 }),
            withSpring(0, { damping: 7, stiffness: 190 })
          );
          break;
        }

        case 'entrance': {
          // Crisp anticipation dip -> peppy battle-ready hop -> alert ear perk!
          reactionScaleY.value = withSequence(
            withTiming(0.89, { duration: 65 }),
            withTiming(1.13, { duration: 125, easing: Easing.out(Easing.quad) }),
            withSpring(1, { damping: 8.5, stiffness: 220 })
          );
          bodyTy.value = withSequence(
            withTiming(size * 0.025, { duration: 65 }),
            withTiming(-jumpPx * 0.68, { duration: 145, easing: Easing.out(Easing.quad) }),
            withSpring(0, { damping: 8.5, stiffness: 205 })
          );
          leftEarExtra.value = withSequence(
            withTiming(-15, { duration: 140 }),
            withSpring(0, { damping: 8, stiffness: 190 })
          );
          rightEarExtra.value = withSequence(
            withTiming(15, { duration: 140 }),
            withSpring(0, { damping: 8, stiffness: 190 })
          );
          break;
        }
      }
    },
    [
      shouldAnimate,
      size,
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

  // Watch external `reaction` prop
  const lastExternalIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (reaction && reaction.id !== lastExternalIdRef.current) {
      lastExternalIdRef.current = reaction.id;
      playReactionChoreography(reaction.type, reaction.id);
    }
  }, [reaction, playReactionChoreography]);

  // Clean up reaction timer on unmount
  useEffect(() => {
    return () => {
      if (reactionTimerRef.current) {
        clearTimeout(reactionTimerRef.current);
      }
    };
  }, []);

  // Living blinks (including occasional double-blinks!), Pixar eye saccades, and subtle idle micro-fidgets
  useEffect(() => {
    if (!shouldAnimate || healthState === 'knocked_out') {
      setIsBlinking(false);
      setIdleGaze({ x: 0, y: 0 });
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

    // 1. Natural single & double-blink loop + spontaneous micro-fidgets
    const scheduleNextBlink = () => {
      const nextMs = 2400 + Math.floor(Math.random() * 2800);
      trackTimeout(() => {
        setIsBlinking(true);

        // Spontaneous non-repeating micro-fidgets layered additively on idle!
        const roll = Math.random();
        if (roll < 0.32) {
          // Asymmetric left-then-right radar ear perk (overlapping action!)
          leftEarExtra.value = withSequence(
            withTiming(-11, { duration: 85 }),
            withSpring(0, { damping: 7, stiffness: 190 })
          );
          rightEarExtra.value = withDelay(
            65,
            withSequence(
              withTiming(9, { duration: 85 }),
              withSpring(0, { damping: 7, stiffness: 190 })
            )
          );
        } else if (roll < 0.52) {
          // Playful 2-beat tail/wing/halo flick
          tailExtra.value = withSequence(
            withTiming(11, { duration: 95 }),
            withTiming(-9, { duration: 105 }),
            withSpring(0, { damping: 8, stiffness: 180 })
          );
        } else if (roll < 0.66) {
          // Cozy mini-sigh puff
          reactionScaleY.value = withSequence(
            withTiming(1.035, { duration: 220, easing: Easing.out(Easing.sin) }),
            withSpring(1, { damping: 11, stiffness: 160 })
          );
        }

        const isDoubleBlink = Math.random() < 0.22;
        trackTimeout(() => {
          setIsBlinking(false);
          if (isDoubleBlink) {
            trackTimeout(() => {
              setIsBlinking(true);
              trackTimeout(() => {
                setIsBlinking(false);
                scheduleNextBlink();
              }, 115);
            }, 95);
          } else {
            scheduleNextBlink();
          }
        }, 130);
      }, nextMs);
    };

    // 2. Crisp Pixar eye micro-saccades (eyes dart first; head follows smoothly via `sim.headTilt`!)
    const scheduleNextGaze = () => {
      const nextGazeMs = 1900 + Math.floor(Math.random() * 2600);
      trackTimeout(() => {
        const pick =
          IDLE_GAZE_CANDIDATES[Math.floor(Math.random() * IDLE_GAZE_CANDIDATES.length)];
        setIdleGaze(pick);
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
  }, [shouldAnimate, healthState, leftEarExtra, rightEarExtra, tailExtra, reactionScaleY]);

  // Tap-to-pet handler (5 rapid pets = zoomie spin easter egg!)
  const handlePress = useCallback(() => {
    if (!interactive) return;
    const now = Date.now();
    const recent = petTimestampsRef.current.filter((t) => now - t < PET_STREAK_WINDOW_MS);
    recent.push(now);
    petTimestampsRef.current = recent;

    localIdCounterRef.current += 1;
    if (recent.length >= PET_ZOOMIE_THRESHOLD) {
      petTimestampsRef.current = [];
      playReactionChoreography('dizzy_joy', localIdCounterRef.current);
      onPet?.('dizzy_joy');
    } else {
      playReactionChoreography('pet', localIdCounterRef.current);
      onPet?.('pet');
    }
  }, [interactive, playReactionChoreography, onPet]);

  const expression = useMemo(
    () =>
      resolveFighterExpression({
        healthState,
        mood,
        activeReaction,
        isBlinking,
      }),
    [healthState, mood, activeReaction, isBlinking]
  );

  // Precompute pixel offsets from center (50, 50) for each anatomical joint
  const headDx = ((pivots.head.x - 50) / 100) * size;
  const headDy = ((pivots.head.y - 50) / 100) * size;
  const leftDx = ((pivots.leftEar.x - 50) / 100) * size;
  const leftDy = ((pivots.leftEar.y - 50) / 100) * size;
  const rightDx = ((pivots.rightEar.x - 50) / 100) * size;
  const rightDy = ((pivots.rightEar.y - 50) / 100) * size;
  const tailDx = ((pivots.tail.x - 50) / 100) * size;
  const tailDy = ((pivots.tail.y - 50) / 100) * size;
  // Ground contact anchor at bottom of paws/feet (~y=85 in 0..100 SVG space)
  const footAnchorY = size * 0.35;

  const baseBreathAmp = personality.breathIntensity;
  const idleTiltAmp = personality.idleTiltDeg;
  const earAmp = personality.earSwayDeg;
  const tailAmp = personality.tailWagDeg;

  // Grounded dynamic contact shadow — widens on squash/crouch, shrinks & softens on upward leaps!
  const groundShadowStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const breathWave = sampleOrganicBreath(s.breathPhase, s.driftPhase) * s.breathAmpScale;
    const victoryHop = -Math.abs(Math.sin(s.breathPhase)) * size * 0.1 * s.victoryBounceBlend;
    const totalTy = bodyTy.value + s.leanY.y + victoryHop;
    const liftPx = Math.max(0, -totalTy);
    const liftNorm = Math.min(1, liftPx / Math.max(8, size * 0.28));

    const combinedScaleY =
      reactionScaleY.value *
      s.postureStretchY.y *
      (1 + breathWave * baseBreathAmp);
    const { scaleX: volScaleX } = computeVolumePreservedScale(combinedScaleY);

    const shadowScaleX = volScaleX * (1 - liftNorm * 0.42);
    const shadowScaleY = Math.max(0.55, 1 - liftNorm * 0.35);
    const shadowOpacity = Math.max(0.06, 0.19 * (1 - liftNorm * 0.62));

    return {
      opacity: shadowOpacity,
      transform: [
        { translateX: (bodyTx.value + s.leanX.y) * 0.55 },
        { scaleX: shadowScaleX },
        { scaleY: shadowScaleY },
      ],
    };
  });

  // Whole-rig animated style:
  // - Continuous organic breathing + non-repeating harmonic drift
  // - Inertial second-order posture transitions (`s.leanX`, `s.leanY`, `s.bodyTilt`, `s.postureStretchY`)
  // - Foot-grounded volume-preserving squash & stretch (`scaleX * scaleY === 1` anchored at feet!)
  const rigRootStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const breathWave = sampleOrganicBreath(s.breathPhase, s.driftPhase) * s.breathAmpScale;
    const swayWave = Math.sin(s.swayPhase) * s.swayAmpScale;

    const victoryHop = -Math.abs(Math.sin(s.breathPhase)) * size * 0.1 * s.victoryBounceBlend;
    const tremorX = Math.sin(s.wagPhase * 2) * 1.35 * s.urgentTremorBlend;

    const victoryDanceTilt = swayWave * 5.2 * s.victoryBounceBlend;
    const ambientTilt = swayWave * idleTiltAmp;

    const rawScaleY =
      reactionScaleY.value *
      s.postureStretchY.y *
      (1 + breathWave * baseBreathAmp);
    const { scaleX, scaleY } = computeVolumePreservedScale(rawScaleY);

    return {
      transform: [
        { translateX: bodyTx.value + s.leanX.y + tremorX },
        { translateY: bodyTy.value + s.leanY.y + victoryHop },
        { rotate: `${bodyRotate.value + s.bodyTilt.y + ambientTilt + victoryDanceTilt}deg` },
        // Anchor squash & stretch at the ground contact line so feet stay planted!
        { translateY: footAnchorY },
        { scaleX },
        { scaleY },
        { translateY: -footAnchorY },
      ],
    };
  });

  // Head pivot animated style — lags ~0.68 rad behind chest breathing for natural spine wave!
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

  // Left ear / flipper / wing pivot — lags ~1.28 rad behind chest for soft tip follow-through!
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

  // Right ear / flipper / wing pivot — slight asymmetric lag (1.42 rad) avoids robotic symmetry ("twinning")!
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

  // Tail / oracle halo / throat pouch pivot — multi-harmonic figure-8 whip wave!
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

  // Front paws / feet animated style — smooth blended tippy-taps in anticipation & victory!
  const pawStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const excitement = Math.max(
      s.victoryBounceBlend,
      Math.min(1, Math.max(0, (s.wagAmpScale - 1.15) * 2.5))
    );
    const tippyTap = -Math.abs(Math.sin(s.wagPhase)) * size * 0.036 * excitement;
    return {
      transform: [{ translateY: pawBounce.value + tippyTap }],
    };
  });

  const renderCreatureRig = () => {
    const rigProps = {
      size,
      expression,
      healthState,
      gazeOffset: effectiveGaze,
      headStyle,
      leftEarStyle,
      rightEarStyle,
      tailStyle,
      pawStyle,
    };

    switch (characterName) {
      case 'Orange Tabby':
        return <OrangeTabbyRig {...rigProps} />;
      case 'Sly Fox':
        return <SlyFoxRig {...rigProps} />;
      case 'Emperor Penguin':
        return <EmperorPenguinRig {...rigProps} />;
      case 'Corgi':
        return <CorgiRig {...rigProps} />;
      case 'Pelican':
        return <PelicanRig {...rigProps} />;
      case 'Badger':
        return <BadgerRig {...rigProps} />;
      default:
        return (
          <FallbackFighterRig
            {...rigProps}
            characterName={characterName}
            iconOverride={characterIcon}
          />
        );
    }
  };

  const isCriticalFrame = healthState === 'critical' || healthState === 'knocked_out';
  const isStreakFrame = streak >= 3 || mood === 'streak' || mood === 'victory';

  const frameDynamicStyle: ViewStyle | undefined = framed
    ? {
        width: size,
        height: size,
        borderRadius: Math.max(10, Math.round(size * 0.24)),
        borderWidth: 2,
        borderColor: isCriticalFrame
          ? COLORS.impactRed
          : isStreakFrame
            ? COLORS.actionYellow
            : COLORS.slateCharcoal,
        backgroundColor: isCriticalFrame
          ? '#FFF1F2'
          : isStreakFrame
            ? '#FFFBEB'
            : COLORS.paperBeige,
      }
    : {
        width: size,
        height: size,
      };

  const shadowWidth = Math.max(14, Math.round(size * 0.54));
  const shadowHeight = Math.max(4, Math.round(size * 0.11));

  const stageContent = (
    <View
      style={[styles.stageBase, frameDynamicStyle]}
      testID={testID ?? 'fighter-avatar'}
      accessibilityRole={interactive ? 'button' : 'image'}
      accessibilityLabel={`${characterName} fighter (${healthState})`}
    >
      {/* Grounded contact shadow: stays pinned to ground plane while reacting to height & squash! */}
      <Animated.View
        pointerEvents="none"
        testID="fighter-ground-shadow"
        style={[
          styles.groundShadow,
          {
            width: shadowWidth,
            height: shadowHeight,
            borderRadius: shadowHeight,
            bottom: Math.max(2, Math.round(size * 0.065)),
          },
          groundShadowStyle,
        ]}
      />

      <Animated.View style={[StyleSheet.absoluteFill, rigRootStyle]}>
        {renderCreatureRig()}
        <FighterDamageOverlay
          healthState={healthState}
          headStyle={headStyle}
          animate={shouldAnimate}
        />
      </Animated.View>

      <FighterEffectsOverlay
        activeReaction={activeReaction}
        reactionId={activeReactionKey}
        mood={mood}
        personality={personality}
        animate={shouldAnimate}
      />

      {/* Streak mini-pill when framed in HUD and on a 3+ match streak! */}
      {framed && streak >= 3 && (
        <View style={styles.streakBadge} pointerEvents="none" testID="fighter-streak-badge">
          <Text style={styles.streakBadgeText}>{streak}x</Text>
        </View>
      )}
    </View>
  );

  if (interactive) {
    return (
      <Pressable
        onPress={handlePress}
        hitSlop={4}
        testID={testID ? `${testID}-pressable` : 'fighter-avatar-pressable'}
      >
        {stageContent}
      </Pressable>
    );
  }

  return stageContent;
};

const styles = StyleSheet.create({
  stageBase: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  groundShadow: {
    position: 'absolute',
    backgroundColor: COLORS.slateCharcoal,
  },
  streakBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: COLORS.actionYellow,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    paddingHorizontal: 4,
    paddingVertical: 0.5,
  },
  streakBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.slateCharcoal,
  },
});
