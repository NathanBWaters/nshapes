import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
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
import { IconName } from '@/components/Icon';
import { FighterDamageOverlay } from '@/components/fighters/FighterDamageOverlay';
import { GazeOffset } from '@/components/fighters/creatures/types';
import type { EnemyInstance } from '@/types/enemy';
import { useReducedMotion } from '@/utils/animation';
import { COLORS } from '@/utils/colors';
import {
  EnemyAmbientMood,
  EnemyReactionEvent,
  EnemyReactionType,
  TIER_AURA_COLORS,
  computeEnemyMoodLoopRates,
  computeEnemyMoodPoseTargets,
  getEnemyHealthState,
  getEnemyPersonality,
  resolveEnemyExpression,
} from '@/utils/enemyAnimations';
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
import { EnemyEffectsOverlay } from './EnemyEffectsOverlay';
import { EnemyCreatureRig, getEnemyRigPivots } from './rigs';

export interface EnemyAvatarProps {
  /** EnemyInstance, FoeDisplay-like object, or enemy name string */
  enemy?: EnemyInstance | { name: string; icon?: IconName; tier?: number } | string | null;
  /** Optional fallback icon name */
  icon?: IconName;
  /** Optional tier override (1..4) */
  tier?: number;
  /** Pixel width & height (default 56) */
  size?: number;
  /** Current enemy HP (defaults to maxHp = pristine) */
  hp?: number;
  /** Max enemy HP (defaults to 3) */
  maxHp?: number;
  /** Continuous ambient mood */
  mood?: EnemyAmbientMood;
  /** Discrete one-shot reaction event ({ type, id }) */
  reaction?: EnemyReactionEvent | null;
  /** Whether continuous idle/reaction animations run (default true) */
  animate?: boolean;
  /**
   * Lightweight mode for dense lists/maps (e.g. 37 nodes on AdventureMap):
   * renders the custom illustrated rig + gentle UI-thread breath while skipping
   * JS blink/saccade timers and overlay layers.
   */
  lightweight?: boolean;
  /** Whether tapping the enemy pokes/provokes it (5x rapid pokes = rage_spin!) */
  interactive?: boolean;
  /** Optional callback when poked */
  onPoke?: (reactionType: 'poke' | 'rage_spin') => void;
  /** Render inside a tactile NShapes portrait frame badge */
  framed?: boolean;
  /** Optional container style */
  style?: StyleProp<ViewStyle>;
  /** Optional testID */
  testID?: string;
}

interface EnemySimState {
  breathPhase: number;
  wagPhase: number;
  swayPhase: number;
  driftPhase: number;
  breathHz: number;
  wagHz: number;
  swayHz: number;
  breathAmpScale: number;
  wagAmpScale: number;
  swayAmpScale: number;
  gloatBounceBlend: number;
  corneredTremorBlend: number;
  leanX: SecondOrderState;
  leanY: SecondOrderState;
  bodyTilt: SecondOrderState;
  headTilt: SecondOrderState;
  headY: SecondOrderState;
  leftEar: SecondOrderState;
  rightEar: SecondOrderState;
  postureStretchY: SecondOrderState;
}

interface EnemySimTargets {
  rates: MoodLoopRates;
  pose: MoodPoseTargets;
  isVictory: number;
  isCorneredOrEnraged: number;
}

const POKE_STREAK_WINDOW_MS = 2400;
const POKE_RAGE_THRESHOLD = 5;

const ENEMY_GAZE_CANDIDATES: GazeOffset[] = [
  { x: 0, y: 0 },
  { x: -0.62, y: 0.08 },
  { x: 0.58, y: 0.08 },
  { x: -0.35, y: -0.18 },
  { x: 0.44, y: -0.15 },
  { x: 0, y: 0 },
];

export const EnemyAvatar: React.FC<EnemyAvatarProps> = ({
  enemy,
  icon: iconOverride,
  tier: tierOverride,
  size = 56,
  hp,
  maxHp = 3,
  mood = 'idle',
  reaction = null,
  animate = true,
  lightweight = false,
  interactive = false,
  onPoke,
  framed = false,
  style,
  testID,
}) => {
  const reducedMotion = useReducedMotion();
  const shouldAnimate = animate && !reducedMotion;

  const enemyName =
    typeof enemy === 'string'
      ? enemy
      : enemy?.name ?? 'Sparring Foe';
  const resolvedIcon: IconName | undefined =
    iconOverride ?? (typeof enemy === 'object' && enemy ? enemy.icon : undefined);
  const rawTier =
    tierOverride ?? (typeof enemy === 'object' && enemy && enemy.tier ? enemy.tier : 1);
  const resolvedTier = Math.max(1, Math.min(4, rawTier)) as 1 | 2 | 3 | 4;

  const personality = useMemo(
    () => getEnemyPersonality(enemyName, resolvedTier),
    [enemyName, resolvedTier]
  );
  const pivots = useMemo(() => getEnemyRigPivots(enemyName), [enemyName]);
  const healthState = useMemo(() => getEnemyHealthState(hp, maxHp), [hp, maxHp]);

  const effectiveMood: EnemyAmbientMood =
    mood === 'idle' && personality.naturallySleepy && healthState === 'pristine'
      ? 'sleepy'
      : mood;

  const [isBlinking, setIsBlinking] = useState(false);
  const [idleGaze, setIdleGaze] = useState<GazeOffset>({ x: 0, y: 0 });
  const [activeReaction, setActiveReaction] = useState<EnemyReactionType | null>(
    reaction?.type ?? null
  );
  const [activeReactionKey, setActiveReactionKey] = useState<number>(reaction?.id ?? 0);

  const pokeTimestampsRef = useRef<number[]>([]);
  const localIdCounterRef = useRef(20000);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveGaze = useMemo<GazeOffset>(() => {
    if (healthState === 'knocked_out' || effectiveMood === 'sleepy') return { x: 0, y: 0 };
    if (activeReaction === 'attack' || effectiveMood === 'menacing') {
      return { x: idleGaze.x * 0.5 - 0.18, y: 0.08 };
    }
    if (activeReaction === 'taunt') return { x: 0.25, y: -0.15 };
    return idleGaze;
  }, [healthState, effectiveMood, activeReaction, idleGaze]);

  const initialRates = useMemo(
    () =>
      computeEnemyMoodLoopRates(
        personality.breathCycleMs,
        personality.tailCycleMs,
        effectiveMood,
        healthState
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [personality.name]
  );

  const initialPose = useMemo(
    () => computeEnemyMoodPoseTargets(effectiveMood, healthState, size, 0, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [personality.name]
  );

  const phaseSeed = useMemo(() => {
    let acc = 17;
    for (let i = 0; i < enemyName.length; i++) {
      acc = (acc * 37 + enemyName.charCodeAt(i)) % 628;
    }
    return acc / 100;
  }, [enemyName]);

  const sim = useSharedValue<EnemySimState>({
    breathPhase: phaseSeed,
    wagPhase: (phaseSeed * 1.73) % (Math.PI * 2),
    swayPhase: (phaseSeed * 0.67) % (Math.PI * 2),
    driftPhase: (phaseSeed * 2.39) % (Math.PI * 2),
    breathHz: initialRates.breathHz,
    wagHz: initialRates.wagHz,
    swayHz: initialRates.swayHz,
    breathAmpScale: initialRates.breathAmpScale,
    wagAmpScale: initialRates.wagAmpScale,
    swayAmpScale: initialRates.swayAmpScale,
    gloatBounceBlend: effectiveMood === 'victory' ? 1 : 0,
    corneredTremorBlend:
      effectiveMood === 'cornered' || healthState === 'critical' ? 1 : 0,
    leanX: createSecondOrderState(initialPose.leanX),
    leanY: createSecondOrderState(initialPose.leanY),
    bodyTilt: createSecondOrderState(initialPose.bodyTiltDeg),
    headTilt: createSecondOrderState(initialPose.headTiltDeg),
    headY: createSecondOrderState(initialPose.headY),
    leftEar: createSecondOrderState(initialPose.leftEarDeg),
    rightEar: createSecondOrderState(initialPose.rightEarDeg),
    postureStretchY: createSecondOrderState(initialPose.postureStretchY),
  });

  const simTargets = useSharedValue<EnemySimTargets>({
    rates: initialRates,
    pose: initialPose,
    isVictory: effectiveMood === 'victory' ? 1 : 0,
    isCorneredOrEnraged:
      effectiveMood === 'cornered' || healthState === 'critical' ? 1 : 0,
  });

  useEffect(() => {
    const rates = computeEnemyMoodLoopRates(
      personality.breathCycleMs,
      personality.tailCycleMs,
      effectiveMood,
      healthState
    );
    const pose = computeEnemyMoodPoseTargets(
      effectiveMood,
      healthState,
      size,
      effectiveGaze.x,
      effectiveGaze.y
    );

    if (!shouldAnimate) {
      sim.modify((s) => {
        'worklet';
        s.leanX.y = pose.leanX;
        s.leanX.yd = 0;
        s.leanY.y = pose.leanY;
        s.leanY.yd = 0;
        s.bodyTilt.y = pose.bodyTiltDeg;
        s.bodyTilt.yd = 0;
        s.headTilt.y = pose.headTiltDeg;
        s.headTilt.yd = 0;
        s.headY.y = pose.headY;
        s.headY.yd = 0;
        s.leftEar.y = pose.leftEarDeg;
        s.leftEar.yd = 0;
        s.rightEar.y = pose.rightEarDeg;
        s.rightEar.yd = 0;
        s.postureStretchY.y = pose.postureStretchY;
        s.postureStretchY.yd = 0;
        s.breathAmpScale = 0;
        s.wagAmpScale = 0;
        s.swayAmpScale = 0;
        s.gloatBounceBlend = 0;
        s.corneredTremorBlend = 0;
        return s;
      });
    }

    simTargets.value = {
      rates,
      pose,
      isVictory: effectiveMood === 'victory' ? 1 : 0,
      isCorneredOrEnraged:
        effectiveMood === 'cornered' || healthState === 'critical' ? 1 : 0,
    };
  }, [
    personality.breathCycleMs,
    personality.tailCycleMs,
    effectiveMood,
    healthState,
    size,
    effectiveGaze.x,
    effectiveGaze.y,
    shouldAnimate,
    sim,
    simTargets,
  ]);

  useFrameCallback((frameInfo) => {
    const dtMs = frameInfo.timeSincePreviousFrame;
    if (dtMs === null || dtMs <= 0) return;
    const dt = Math.min(dtMs / 1000, 0.05);
    const tgt = simTargets.value;

    sim.modify((s) => {
      'worklet';
      s.breathHz = expApproach(s.breathHz, tgt.rates.breathHz, 7.5, dt);
      s.wagHz = expApproach(s.wagHz, tgt.rates.wagHz, 8.5, dt);
      s.swayHz = expApproach(s.swayHz, tgt.rates.swayHz, 6.5, dt);

      s.breathAmpScale = expApproach(s.breathAmpScale, tgt.rates.breathAmpScale, 6.5, dt);
      s.wagAmpScale = expApproach(s.wagAmpScale, tgt.rates.wagAmpScale, 7.0, dt);
      s.swayAmpScale = expApproach(s.swayAmpScale, tgt.rates.swayAmpScale, 6.0, dt);

      s.gloatBounceBlend = expApproach(s.gloatBounceBlend, tgt.isVictory, 5.5, dt);
      s.corneredTremorBlend = expApproach(s.corneredTremorBlend, tgt.isCorneredOrEnraged, 7.0, dt);

      s.breathPhase = advancePhase(s.breathPhase, s.breathHz, dt);
      s.wagPhase = advancePhase(s.wagPhase, s.wagHz, dt);
      s.swayPhase = advancePhase(s.swayPhase, s.swayHz, dt);
      s.driftPhase = advancePhase(s.driftPhase, s.breathHz * 0.236, dt);

      if (!lightweight) {
        stepSecondOrder(s.leanX, tgt.pose.leanX, dt, 2.7, 0.72, 0.6);
        stepSecondOrder(s.leanY, tgt.pose.leanY, dt, 2.5, 0.68, 0.75);
        stepSecondOrder(s.bodyTilt, tgt.pose.bodyTiltDeg, dt, 2.4, 0.66, 0.7);
        stepSecondOrder(s.headTilt, tgt.pose.headTiltDeg, dt, 3.0, 0.6, 0.85);
        stepSecondOrder(s.headY, tgt.pose.headY, dt, 2.8, 0.66, 0.75);
        stepSecondOrder(s.leftEar, tgt.pose.leftEarDeg, dt, 3.7, 0.5, 1.1);
        stepSecondOrder(s.rightEar, tgt.pose.rightEarDeg, dt, 3.5, 0.5, 1.1);
        stepSecondOrder(s.postureStretchY, tgt.pose.postureStretchY, dt, 2.8, 0.68, 0.7);
      }

      return s;
    });
  }, shouldAnimate);

  // Additive discrete reaction impulses
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

  const playReactionChoreography = useCallback(
    (type: EnemyReactionType, keyId: number) => {
      setActiveReaction(type);
      setActiveReactionKey(keyId);

      if (reactionTimerRef.current) {
        clearTimeout(reactionTimerRef.current);
      }
      const holdMs = personality.reactionHoldMs[type] ?? 850;
      reactionTimerRef.current = setTimeout(() => {
        setActiveReaction(null);
      }, holdMs);

      if (!shouldAnimate) return;

      const jumpPx = Math.max(6, size * 0.16);
      const recoilPx = Math.max(5, size * 0.14);

      switch (type) {
        case 'pain': {
          // Player matched a Set! Enemy takes impact: horizontal knockback + squash + head snap!
          bodyTx.value = withSequence(
            withTiming(recoilPx, { duration: 48, easing: Easing.out(Easing.quad) }),
            withTiming(-recoilPx * 0.82, { duration: 60 }),
            withTiming(recoilPx * 0.55, { duration: 58 }),
            withTiming(-recoilPx * 0.28, { duration: 52 }),
            withSpring(0, { damping: 10, stiffness: 240 })
          );
          reactionScaleY.value = withSequence(
            withTiming(0.81, { duration: 65, easing: Easing.out(Easing.quad) }),
            withTiming(1.09, { duration: 110 }),
            withSpring(1, { damping: 9, stiffness: 210 })
          );
          bodyTy.value = withSequence(
            withTiming(size * 0.045, { duration: 65 }),
            withSpring(0, { damping: 10, stiffness: 200 })
          );
          bodyRotate.value = withSequence(
            withTiming(11, { duration: 65 }),
            withTiming(-6, { duration: 85 }),
            withSpring(0, { damping: 10, stiffness: 195 })
          );
          headRotate.value = withDelay(
            25,
            withSequence(
              withTiming(14, { duration: 75 }),
              withTiming(-8, { duration: 85 }),
              withSpring(0, { damping: 9, stiffness: 190 })
            )
          );
          leftEarExtra.value = withSequence(
            withTiming(18, { duration: 85 }),
            withSpring(0, { damping: 8, stiffness: 175 })
          );
          rightEarExtra.value = withSequence(
            withTiming(-18, { duration: 85 }),
            withSpring(0, { damping: 8, stiffness: 175 })
          );
          break;
        }

        case 'crit_pain': {
          // Rainbow / Mega-match! Heavy stagger spin + dramatic compression & rebound!
          bodyTx.value = withSequence(
            withTiming(recoilPx * 1.35, { duration: 55 }),
            withTiming(-recoilPx * 1.1, { duration: 68 }),
            withTiming(recoilPx * 0.75, { duration: 62 }),
            withSpring(0, { damping: 9, stiffness: 220 })
          );
          reactionScaleY.value = withSequence(
            withTiming(0.74, { duration: 70, easing: Easing.out(Easing.quad) }),
            withTiming(1.18, { duration: 125, easing: Easing.out(Easing.cubic) }),
            withTiming(0.92, { duration: 90 }),
            withSpring(1, { damping: 8, stiffness: 210 })
          );
          bodyRotate.value = withSequence(
            withTiming(22, { duration: 90, easing: Easing.out(Easing.quad) }),
            withTiming(-16, { duration: 105 }),
            withTiming(9, { duration: 85 }),
            withSpring(0, { damping: 9, stiffness: 190 })
          );
          bodyTy.value = withSequence(
            withTiming(-jumpPx * 0.55, { duration: 110, easing: Easing.out(Easing.quad) }),
            withTiming(size * 0.05, { duration: 95 }),
            withSpring(0, { damping: 9, stiffness: 200 })
          );
          break;
        }

        case 'taunt': {
          // Player made a mistake! Wicked cackle bounce + smug head rock!
          reactionScaleY.value = withSequence(
            withTiming(0.86, { duration: 65 }),
            withTiming(1.16, { duration: 125, easing: Easing.out(Easing.cubic) }),
            withTiming(0.94, { duration: 95 }),
            withTiming(1.09, { duration: 110 }),
            withSpring(1, { damping: 8, stiffness: 205 })
          );
          bodyTy.value = withSequence(
            withTiming(size * 0.03, { duration: 65 }),
            withTiming(-jumpPx * 0.9, { duration: 140, easing: Easing.out(Easing.cubic) }),
            withTiming(0, { duration: 95 }),
            withTiming(-jumpPx * 0.55, { duration: 115, easing: Easing.out(Easing.quad) }),
            withSpring(0, { damping: 8.5, stiffness: 210 })
          );
          headRotate.value = withSequence(
            withTiming(-11, { duration: 105 }),
            withTiming(11, { duration: 115 }),
            withTiming(-8, { duration: 105 }),
            withSpring(0, { damping: 9, stiffness: 185 })
          );
          pawBounce.value = withSequence(
            withTiming(-size * 0.1, { duration: 120 }),
            withTiming(0, { duration: 95 }),
            withTiming(-size * 0.08, { duration: 110 }),
            withSpring(0, { damping: 8, stiffness: 195 })
          );
          break;
        }

        case 'attack': {
          // Enemy ability fires! Coiled wind-up back -> aggressive forward lunge + claw strike!
          bodyTx.value = withSequence(
            withTiming(recoilPx * 0.55, { duration: 85, easing: Easing.inOut(Easing.quad) }),
            withTiming(-recoilPx * 1.45, { duration: 105, easing: Easing.out(Easing.cubic) }),
            withSpring(0, { damping: 8.5, stiffness: 210 })
          );
          reactionScaleY.value = withSequence(
            withTiming(0.84, { duration: 85 }),
            withTiming(1.17, { duration: 105, easing: Easing.out(Easing.cubic) }),
            withSpring(1, { damping: 8.5, stiffness: 215 })
          );
          bodyRotate.value = withSequence(
            withTiming(8, { duration: 85 }),
            withTiming(-14, { duration: 105, easing: Easing.out(Easing.cubic) }),
            withSpring(0, { damping: 9, stiffness: 200 })
          );
          pawBounce.value = withSequence(
            withTiming(size * 0.03, { duration: 80 }),
            withTiming(-size * 0.13, { duration: 105, easing: Easing.out(Easing.cubic) }),
            withSpring(0, { damping: 8, stiffness: 200 })
          );
          break;
        }

        case 'regen': {
          // Enemy regenerates HP: eerie float + swell!
          bodyTy.value = withSequence(
            withTiming(-jumpPx * 0.78, { duration: 280, easing: Easing.out(Easing.sin) }),
            withTiming(-jumpPx * 0.78, { duration: 160 }),
            withSpring(0, { damping: 11, stiffness: 150 })
          );
          reactionScaleY.value = withSequence(
            withTiming(1.1, { duration: 240, easing: Easing.out(Easing.sin) }),
            withSpring(1, { damping: 10, stiffness: 165 })
          );
          break;
        }

        case 'poke': {
          // Player poked the enemy: startled squish -> snappy annoyed growl shake!
          reactionScaleY.value = withSequence(
            withTiming(0.83, { duration: 80, easing: Easing.out(Easing.quad) }),
            withTiming(1.11, { duration: 120, easing: Easing.out(Easing.cubic) }),
            withSpring(1, { damping: 8, stiffness: 210 })
          );
          headRotate.value = withSequence(
            withTiming(10, { duration: 85 }),
            withTiming(-10, { duration: 95 }),
            withSpring(0, { damping: 8.5, stiffness: 195 })
          );
          tailExtra.value = withSequence(
            withTiming(-20, { duration: 95 }),
            withTiming(20, { duration: 105 }),
            withSpring(0, { damping: 7.5, stiffness: 195 })
          );
          break;
        }

        case 'rage_spin': {
          // 5x poke easter egg: furious 360° berserker tornado spin!
          bodyRotate.value = 0;
          bodyRotate.value = withSequence(
            withTiming(16, { duration: 75, easing: Easing.inOut(Easing.quad) }),
            withTiming(-360, { duration: 540, easing: Easing.out(Easing.cubic) }),
            withTiming(0, { duration: 0 })
          );
          bodyTy.value = withSequence(
            withTiming(size * 0.04, { duration: 75 }),
            withTiming(-jumpPx * 1.15, { duration: 250, easing: Easing.out(Easing.cubic) }),
            withSpring(0, { damping: 8, stiffness: 210 })
          );
          break;
        }

        case 'entrance': {
          // Heavy boss/foe drop-in crouch -> menacing rise & roar!
          bodyTy.value = withSequence(
            withTiming(-jumpPx * 0.85, { duration: 0 }),
            withTiming(size * 0.04, { duration: 115, easing: Easing.in(Easing.quad) }),
            withSpring(0, { damping: 8.5, stiffness: 220 })
          );
          reactionScaleY.value = withSequence(
            withTiming(1.12, { duration: 95 }),
            withTiming(0.84, { duration: 80, easing: Easing.out(Easing.quad) }),
            withTiming(1.08, { duration: 120 }),
            withSpring(1, { damping: 8.5, stiffness: 215 })
          );
          leftEarExtra.value = withSequence(
            withTiming(-16, { duration: 150 }),
            withSpring(0, { damping: 8, stiffness: 190 })
          );
          rightEarExtra.value = withSequence(
            withTiming(16, { duration: 150 }),
            withSpring(0, { damping: 8, stiffness: 190 })
          );
          break;
        }
      }
    },
    [
      personality,
      shouldAnimate,
      size,
      bodyTx,
      bodyTy,
      reactionScaleY,
      bodyRotate,
      headRotate,
      leftEarExtra,
      rightEarExtra,
      tailExtra,
      pawBounce,
    ]
  );

  const lastExternalIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (reaction && reaction.id !== lastExternalIdRef.current) {
      lastExternalIdRef.current = reaction.id;
      playReactionChoreography(reaction.type, reaction.id);
    }
  }, [reaction, playReactionChoreography]);

  useEffect(() => {
    return () => {
      if (reactionTimerRef.current) {
        clearTimeout(reactionTimerRef.current);
      }
    };
  }, []);

  // Natural single/double blinks, predator micro-saccades, and menacing idle fidgets (skipped in lightweight mode)
  useEffect(() => {
    if (!shouldAnimate || lightweight || healthState === 'knocked_out') {
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

    const scheduleNextBlink = () => {
      const nextMs = 2600 + Math.floor(Math.random() * 3000);
      trackTimeout(() => {
        setIsBlinking(true);

        const roll = Math.random();
        if (roll < 0.34) {
          leftEarExtra.value = withSequence(
            withTiming(-12, { duration: 80 }),
            withSpring(0, { damping: 7.5, stiffness: 195 })
          );
          rightEarExtra.value = withDelay(
            60,
            withSequence(
              withTiming(10, { duration: 80 }),
              withSpring(0, { damping: 7.5, stiffness: 195 })
            )
          );
        } else if (roll < 0.56) {
          tailExtra.value = withSequence(
            withTiming(-13, { duration: 90 }),
            withTiming(11, { duration: 95 }),
            withSpring(0, { damping: 8, stiffness: 185 })
          );
        }

        const isDouble = Math.random() < 0.2;
        trackTimeout(() => {
          setIsBlinking(false);
          if (isDouble) {
            trackTimeout(() => {
              setIsBlinking(true);
              trackTimeout(() => {
                setIsBlinking(false);
                scheduleNextBlink();
              }, 110);
            }, 90);
          } else {
            scheduleNextBlink();
          }
        }, 125);
      }, nextMs);
    };

    const scheduleNextGaze = () => {
      const nextGazeMs = 1800 + Math.floor(Math.random() * 2500);
      trackTimeout(() => {
        const pick =
          ENEMY_GAZE_CANDIDATES[Math.floor(Math.random() * ENEMY_GAZE_CANDIDATES.length)];
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
  }, [shouldAnimate, lightweight, healthState, leftEarExtra, rightEarExtra, tailExtra]);

  const handlePress = useCallback(() => {
    if (!interactive) return;
    const now = Date.now();
    const recent = pokeTimestampsRef.current.filter((t) => now - t < POKE_STREAK_WINDOW_MS);
    recent.push(now);
    pokeTimestampsRef.current = recent;

    localIdCounterRef.current += 1;
    if (recent.length >= POKE_RAGE_THRESHOLD) {
      pokeTimestampsRef.current = [];
      playReactionChoreography('rage_spin', localIdCounterRef.current);
      onPoke?.('rage_spin');
    } else {
      playReactionChoreography('poke', localIdCounterRef.current);
      onPoke?.('poke');
    }
  }, [interactive, playReactionChoreography, onPoke]);

  const expression = useMemo(
    () =>
      resolveEnemyExpression({
        healthState,
        mood: effectiveMood,
        activeReaction,
        isBlinking,
      }),
    [healthState, effectiveMood, activeReaction, isBlinking]
  );

  const headDx = ((pivots.head.x - 50) / 100) * size;
  const headDy = ((pivots.head.y - 50) / 100) * size;
  const leftDx = ((pivots.leftEar.x - 50) / 100) * size;
  const leftDy = ((pivots.leftEar.y - 50) / 100) * size;
  const rightDx = ((pivots.rightEar.x - 50) / 100) * size;
  const rightDy = ((pivots.rightEar.y - 50) / 100) * size;
  const tailDx = ((pivots.tail.x - 50) / 100) * size;
  const tailDy = ((pivots.tail.y - 50) / 100) * size;
  const footAnchorY = size * 0.35;

  const baseBreathAmp = personality.breathIntensity;
  const idleTiltAmp = personality.idleTiltDeg;
  const earAmp = personality.earSwayDeg;
  const tailAmp = personality.tailWagDeg;

  const groundShadowStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const breathWave = sampleOrganicBreath(s.breathPhase, s.driftPhase) * s.breathAmpScale;
    const gloatHop = -Math.abs(Math.sin(s.breathPhase)) * size * 0.09 * s.gloatBounceBlend;
    const totalTy = bodyTy.value + s.leanY.y + gloatHop;
    const liftPx = Math.max(0, -totalTy);
    const liftNorm = Math.min(1, liftPx / Math.max(8, size * 0.28));

    const combinedScaleY =
      reactionScaleY.value *
      s.postureStretchY.y *
      (1 + breathWave * baseBreathAmp);
    const { scaleX: volScaleX } = computeVolumePreservedScale(combinedScaleY);

    return {
      opacity: Math.max(0.06, 0.2 * (1 - liftNorm * 0.62)),
      transform: [
        { translateX: (bodyTx.value + s.leanX.y) * 0.55 },
        { scaleX: volScaleX * (1 - liftNorm * 0.4) },
        { scaleY: Math.max(0.55, 1 - liftNorm * 0.34) },
      ],
    };
  });

  const rigRootStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const breathWave = sampleOrganicBreath(s.breathPhase, s.driftPhase) * s.breathAmpScale;
    const swayWave = Math.sin(s.swayPhase) * s.swayAmpScale;

    const gloatHop = -Math.abs(Math.sin(s.breathPhase)) * size * 0.09 * s.gloatBounceBlend;
    const tremorX = Math.sin(s.wagPhase * 2.2) * 1.4 * s.corneredTremorBlend;
    const ambientTilt = swayWave * idleTiltAmp;

    const rawScaleY =
      reactionScaleY.value *
      s.postureStretchY.y *
      (1 + breathWave * baseBreathAmp);
    const { scaleX, scaleY } = computeVolumePreservedScale(rawScaleY);

    return {
      transform: [
        { translateX: bodyTx.value + s.leanX.y + tremorX },
        { translateY: bodyTy.value + s.leanY.y + gloatHop },
        { rotate: `${bodyRotate.value + s.bodyTilt.y + ambientTilt}deg` },
        { translateY: footAnchorY },
        { scaleX },
        { scaleY },
        { translateY: -footAnchorY },
      ],
    };
  });

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

  const pawStyle = useAnimatedStyle(() => {
    const s = sim.value;
    const menaceTap =
      -Math.abs(Math.sin(s.wagPhase)) *
      size *
      0.032 *
      Math.max(s.gloatBounceBlend, Math.min(1, Math.max(0, (s.wagAmpScale - 1.2) * 2)));
    return {
      transform: [{ translateY: pawBounce.value + menaceTap }],
    };
  });

  const tierBorderColor = TIER_AURA_COLORS[resolvedTier];
  const isCorneredFrame = healthState === 'critical' || healthState === 'knocked_out';

  const frameDynamicStyle: ViewStyle = framed
    ? {
        width: size,
        height: size,
        borderRadius: Math.max(10, Math.round(size * 0.24)),
        borderWidth: 2,
        borderColor: isCorneredFrame ? COLORS.impactRed : tierBorderColor,
        backgroundColor: isCorneredFrame ? '#FFF1F2' : COLORS.paperBeige,
      }
    : {
        width: size,
        height: size,
      };

  const shadowWidth = Math.max(12, Math.round(size * 0.54));
  const shadowHeight = Math.max(3, Math.round(size * 0.11));

  const stageContent = (
    <View
      style={[styles.stageBase, frameDynamicStyle, style]}
      testID={testID ?? 'enemy-avatar'}
      accessibilityRole={interactive ? 'button' : 'image'}
      accessibilityLabel={`${enemyName} enemy (${healthState})`}
    >
      {!lightweight && (
        <Animated.View
          pointerEvents="none"
          testID="enemy-ground-shadow"
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
      )}

      <Animated.View style={[StyleSheet.absoluteFill, rigRootStyle]}>
        <EnemyCreatureRig
          enemyName={enemyName}
          icon={resolvedIcon}
          tier={resolvedTier}
          size={size}
          expression={expression}
          healthState={healthState}
          gazeOffset={effectiveGaze}
          headStyle={headStyle}
          leftEarStyle={leftEarStyle}
          rightEarStyle={rightEarStyle}
          tailStyle={tailStyle}
          pawStyle={pawStyle}
        />
        {!lightweight && (
          <FighterDamageOverlay
            healthState={healthState}
            headStyle={headStyle}
            animate={shouldAnimate}
            testID="enemy-damage-overlay"
          />
        )}
      </Animated.View>

      {!lightweight && (
        <EnemyEffectsOverlay
          activeReaction={activeReaction}
          reactionId={activeReactionKey}
          mood={effectiveMood}
          personality={personality}
          animate={shouldAnimate}
        />
      )}
    </View>
  );

  if (interactive) {
    return (
      <Pressable
        onPress={handlePress}
        hitSlop={4}
        testID={testID ? `${testID}-pressable` : 'enemy-avatar-pressable'}
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
});

export default EnemyAvatar;
