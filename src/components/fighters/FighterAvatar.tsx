import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Easing, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { CreatureDamageOverlay } from '@/components/creatures/CreatureDamageOverlay';
import { CreatureStage } from '@/components/creatures/CreatureStage';
import {
  CreatureMotionConfig,
  useCreatureMotion,
} from '@/components/creatures/useCreatureMotion';
import { Character } from '@/types';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import {
  FIGHTER_MOOD_MOTION,
  FIGHTER_REACTION_HOLD_MS,
  FighterAmbientMood,
  FighterReactionEvent,
  FighterReactionType,
  getFighterHealthState,
  resolveFighterExpression,
} from '@/utils/fighterAnimations';
import { FallbackFighterRig } from './creatures/FallbackFighterRig';
import { FighterEffectsOverlay } from './FighterEffectsOverlay';
import { getFighterCreature, getFighterPersonality, getFighterPivots } from './fighterRegistry';

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

/** How fighters move: bouncy, affectionate, Disney-style anticipation and follow-through. */
const FIGHTER_MOTION: CreatureMotionConfig<FighterAmbientMood, FighterReactionType> = {
  moodMotion: FIGHTER_MOOD_MOTION,
  reactionHoldMs: FIGHTER_REACTION_HOLD_MS,
  tapReaction: 'pet',
  tapStreakReaction: 'dizzy_joy',

  // "Eyes lead, head follows" via the posture springs
  resolveGaze: ({ mood, healthState, idleGaze }) => {
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
  },
  mountPoseFollowsGaze: true,

  initialPhases: (name) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) % 628;
    }
    const seed = hash / 100;
    return {
      breath: seed,
      wag: (seed * 1.7) % (Math.PI * 2),
      sway: (seed * 0.9) % (Math.PI * 2),
      drift: seed * 0.5,
    };
  },

  mountBlends: (mood, healthState) => ({
    bounce: mood === 'victory' ? 1 : 0,
    tremor: mood === 'urgent' ? 1 : healthState === 'critical' ? 0.55 : 0,
  }),
  targetBlends: (mood, healthState) => ({
    bounce: mood === 'victory' && healthState !== 'knocked_out' ? 1 : 0,
    tremor:
      healthState === 'knocked_out'
        ? 0
        : mood === 'urgent'
          ? 1
          : healthState === 'critical'
            ? 0.55
            : 0,
  }),

  blink: { minGapMs: 2400, gapJitterMs: 2800, holdMs: 130, doubleChance: 0.22, doubleGapMs: 95, doubleHoldMs: 115 },
  gaze: {
    minGapMs: 1900,
    gapJitterMs: 2600,
    candidates: [
      { x: 0, y: 0 },
      { x: -0.55, y: -0.12 },
      { x: 0.58, y: -0.12 },
      { x: 0, y: 0 },
      { x: -0.35, y: 0.18 },
      { x: 0.42, y: -0.28 },
      { x: 0, y: 0 },
    ],
  },

  idleFidget: (roll, ch) => {
  if (roll < 0.32) {
    // Asymmetric left-then-right radar ear perk (overlapping action!)
    ch.leftEarExtra.value = withSequence(
      withTiming(-11, { duration: 85 }),
      withSpring(0, { damping: 7, stiffness: 190 })
    );
    ch.rightEarExtra.value = withDelay(
      65,
      withSequence(
        withTiming(9, { duration: 85 }),
        withSpring(0, { damping: 7, stiffness: 190 })
      )
    );
  } else if (roll < 0.52) {
    // Playful 2-beat tail/wing/halo flick
    ch.tailExtra.value = withSequence(
      withTiming(11, { duration: 95 }),
      withTiming(-9, { duration: 105 }),
      withSpring(0, { damping: 8, stiffness: 180 })
    );
  } else if (roll < 0.66) {
    ch.reactionScaleY.value = withSequence(
      withTiming(1.035, { duration: 220, easing: Easing.out(Easing.sin) }),
      withSpring(1, { damping: 11, stiffness: 160 })
    );
  }
  },

  easing: { breathHz: 7.5, wagHz: 9.0, swayHz: 7.0, breathAmp: 6.5, wagAmp: 7.5, swayAmp: 6.5, bounce: 8.0, tremor: 8.0 },
  drift: { base: 0.19, perBreathHz: 0 },
  // Body leads, head follows ~80ms behind, ears/wings trail with a playful underdamped bounce
  poseSprings: {
    leanX: [3.2, 0.78, 0.25],
    leanY: [3.4, 0.74, 0.3],
    bodyTilt: [3.0, 0.72, 0.2],
    headTilt: [2.65, 0.65, 0.15],
    headY: [3.0, 0.7, 0.2],
    leftEar: [2.35, 0.54, 0.12],
    rightEar: [2.35, 0.54, 0.12],
    postureStretchY: [3.5, 0.75, 0.3],
  },

  look: {
    hop: 0.1,
    danceTiltDeg: 5.2,
    tremorFreq: 2,
    tremorAmpPx: 1.35,
    shadowOpacity: 0.19,
    shadowLiftShrinkX: 0.42,
    shadowLiftShrinkY: 0.35,
    pawTap: 0.036,
    pawTapThreshold: 1.15,
    pawTapGain: 2.5,
  },

  // Disney Anticipation -> Arc -> Follow-Through -> Settle choreography
  playReaction: (type, ch, size) => {
  const jumpPx = Math.max(6, size * 0.22);
  const recoilPx = Math.max(4, size * 0.14);

  switch (type) {
    case 'joy': {
      // 1. Anticipation crouch (ears tuck) -> 2. Curved arc leap (stretch + flare) -> 3. Cushioned land -> 4. Spring settle
      ch.reactionScaleY.value = withSequence(
        withTiming(0.83, { duration: 75, easing: Easing.out(Easing.quad) }),
        withTiming(1.17, { duration: 155, easing: Easing.out(Easing.cubic) }),
        withTiming(0.92, { duration: 115, easing: Easing.in(Easing.quad) }),
        withSpring(1, { damping: 9, stiffness: 220 })
      );
      ch.bodyTy.value = withSequence(
        withTiming(size * 0.04, { duration: 75, easing: Easing.out(Easing.quad) }),
        withTiming(-jumpPx, { duration: 175, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 8, stiffness: 195 })
      );
      ch.bodyTx.value = withSequence(
        withTiming(size * 0.022, { duration: 160, easing: Easing.inOut(Easing.sin) }),
        withTiming(-size * 0.015, { duration: 140, easing: Easing.inOut(Easing.sin) }),
        withSpring(0, { damping: 10, stiffness: 200 })
      );
      ch.bodyRotate.value = withSequence(
        withTiming(3.5, { duration: 70 }),
        withTiming(-9.5, { duration: 135 }),
        withTiming(8.5, { duration: 150 }),
        withSpring(0, { damping: 9, stiffness: 200 })
      );
      ch.headTy.value = withDelay(
        40,
        withSequence(
          withTiming(-size * 0.035, { duration: 150 }),
          withSpring(0, { damping: 8, stiffness: 190 })
        )
      );
      ch.leftEarExtra.value = withSequence(
        withTiming(7, { duration: 65 }),
        withTiming(-20, { duration: 150 }),
        withSpring(0, { damping: 7, stiffness: 175 })
      );
      ch.rightEarExtra.value = withSequence(
        withTiming(-7, { duration: 65 }),
        withTiming(20, { duration: 150 }),
        withSpring(0, { damping: 7, stiffness: 175 })
      );
      ch.pawBounce.value = withSequence(
        withTiming(size * 0.02, { duration: 70 }),
        withTiming(-size * 0.09, { duration: 170 }),
        withSpring(0, { damping: 8, stiffness: 185 })
      );
      ch.tailExtra.value = withSequence(
        withTiming(18, { duration: 120 }),
        withTiming(-16, { duration: 130 }),
        withSpring(0, { damping: 7, stiffness: 180 })
      );
      break;
    }

    case 'ecstatic':
    case 'dizzy_joy': {
      // Deep coil with counter-rotation wind-up (-15deg) -> soaring 360 spin -> cushioned landing bounce!
      ch.reactionScaleY.value = withSequence(
        withTiming(0.79, { duration: 85, easing: Easing.out(Easing.quad) }),
        withTiming(1.21, { duration: 170, easing: Easing.out(Easing.cubic) }),
        withTiming(0.9, { duration: 150, easing: Easing.in(Easing.quad) }),
        withSpring(1, { damping: 8, stiffness: 205 })
      );
      ch.bodyTy.value = withSequence(
        withTiming(size * 0.055, { duration: 85, easing: Easing.out(Easing.quad) }),
        withTiming(-jumpPx * 1.32, { duration: 235, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 7.5, stiffness: 185 })
      );
      ch.bodyRotate.value = withSequence(
        withTiming(-15, { duration: 85, easing: Easing.inOut(Easing.quad) }),
        withTiming(368, { duration: 540, easing: Easing.out(Easing.cubic) }),
        withTiming(8, { duration: 1 }),
        withSpring(0, { damping: 9, stiffness: 200 })
      );
      ch.leftEarExtra.value = withSequence(
        withTiming(-22, { duration: 180 }),
        withSpring(0, { damping: 7, stiffness: 170 })
      );
      ch.rightEarExtra.value = withSequence(
        withTiming(22, { duration: 180 }),
        withSpring(0, { damping: 7, stiffness: 170 })
      );
      break;
    }

    case 'pain': {
      // Sharp impact squash + decaying harmonic horizontal recoil + lagged head whiplash + pinned ears!
      ch.bodyTx.value = withSequence(
        withTiming(-recoilPx, { duration: 50, easing: Easing.out(Easing.quad) }),
        withTiming(recoilPx * 0.92, { duration: 60, easing: Easing.inOut(Easing.sin) }),
        withTiming(-recoilPx * 0.68, { duration: 60, easing: Easing.inOut(Easing.sin) }),
        withTiming(recoilPx * 0.45, { duration: 60, easing: Easing.inOut(Easing.sin) }),
        withSpring(0, { damping: 10, stiffness: 240 })
      );
      ch.reactionScaleY.value = withSequence(
        withTiming(0.8, { duration: 65, easing: Easing.out(Easing.quad) }),
        withTiming(1.06, { duration: 110 }),
        withSpring(1, { damping: 9, stiffness: 220 })
      );
      ch.bodyRotate.value = withSequence(
        withTiming(-12, { duration: 70 }),
        withTiming(8.5, { duration: 95 }),
        withSpring(0, { damping: 10, stiffness: 200 })
      );
      ch.headRotate.value = withDelay(
        30,
        withSequence(
          withTiming(-9, { duration: 80 }),
          withTiming(6, { duration: 95 }),
          withSpring(0, { damping: 9, stiffness: 190 })
        )
      );
      ch.leftEarExtra.value = withSequence(
        withTiming(18, { duration: 80 }),
        withSpring(0, { damping: 9, stiffness: 165 })
      );
      ch.rightEarExtra.value = withSequence(
        withTiming(-18, { duration: 80 }),
        withSpring(0, { damping: 9, stiffness: 165 })
      );
      break;
    }

    case 'relief': {
      // Startled flinch -> deep chest-expanding inhale -> melting 'Phew!' exhale settle
      ch.reactionScaleY.value = withSequence(
        withTiming(0.87, { duration: 80, easing: Easing.out(Easing.quad) }),
        withTiming(1.09, { duration: 230, easing: Easing.out(Easing.sin) }),
        withTiming(0.96, { duration: 240, easing: Easing.inOut(Easing.sin) }),
        withSpring(1, { damping: 10, stiffness: 170 })
      );
      ch.bodyTy.value = withSequence(
        withTiming(size * 0.025, { duration: 80 }),
        withTiming(-size * 0.04, { duration: 220, easing: Easing.out(Easing.sin) }),
        withSpring(0, { damping: 10, stiffness: 160 })
      );
      ch.headRotate.value = withSequence(
        withTiming(-4, { duration: 75 }),
        withTiming(11.5, { duration: 230, easing: Easing.out(Easing.quad) }),
        withTiming(11.5, { duration: 280 }),
        withSpring(0, { damping: 10, stiffness: 170 })
      );
      break;
    }

    case 'heal': {
      // Gentle anticipation dip -> warm buoyant levitation -> feather-soft settle
      ch.bodyTy.value = withSequence(
        withTiming(size * 0.02, { duration: 80 }),
        withTiming(-jumpPx * 0.78, { duration: 320, easing: Easing.out(Easing.sin) }),
        withSpring(0, { damping: 11, stiffness: 150 })
      );
      ch.reactionScaleY.value = withSequence(
        withTiming(0.95, { duration: 80 }),
        withTiming(1.09, { duration: 300, easing: Easing.out(Easing.sin) }),
        withSpring(1, { damping: 10, stiffness: 170 })
      );
      ch.tailExtra.value = withSequence(
        withTiming(14, { duration: 180 }),
        withTiming(-14, { duration: 200 }),
        withSpring(0, { damping: 8, stiffness: 160 })
      );
      break;
    }

    case 'powerup': {
      // Grounded power-gather crouch -> heroic upward surge -> crisp landing!
      ch.reactionScaleY.value = withSequence(
        withTiming(0.84, { duration: 105, easing: Easing.inOut(Easing.quad) }),
        withTiming(1.2, { duration: 195, easing: Easing.out(Easing.cubic) }),
        withTiming(0.94, { duration: 120 }),
        withSpring(1, { damping: 8.5, stiffness: 210 })
      );
      ch.bodyTy.value = withSequence(
        withTiming(size * 0.04, { duration: 105 }),
        withTiming(-jumpPx * 0.92, { duration: 205, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 9, stiffness: 195 })
      );
      ch.leftEarExtra.value = withSequence(
        withTiming(8, { duration: 100 }),
        withTiming(-16, { duration: 180 }),
        withSpring(0, { damping: 8, stiffness: 185 })
      );
      ch.rightEarExtra.value = withSequence(
        withTiming(-8, { duration: 100 }),
        withTiming(16, { duration: 180 }),
        withSpring(0, { damping: 8, stiffness: 185 })
      );
      break;
    }

    case 'hint': {
      // Slight double-take dip -> expressive 'Aha!' head-cock & asymmetric radar-ear perk!
      ch.reactionScaleY.value = withSequence(
        withTiming(0.95, { duration: 70 }),
        withTiming(1.06, { duration: 140 }),
        withSpring(1, { damping: 10, stiffness: 190 })
      );
      ch.headRotate.value = withSequence(
        withTiming(-4, { duration: 65 }),
        withTiming(14.5, { duration: 155, easing: Easing.out(Easing.back(1.5)) }),
        withTiming(14.5, { duration: 340 }),
        withSpring(0, { damping: 10, stiffness: 180 })
      );
      ch.leftEarExtra.value = withSequence(
        withTiming(-20, { duration: 145, easing: Easing.out(Easing.back(1.4)) }),
        withTiming(-20, { duration: 340 }),
        withSpring(0, { damping: 8, stiffness: 180 })
      );
      break;
    }

    case 'pet': {
      // Cozy squish under the player's finger -> happy rebound + affectionate nuzzle!
      ch.reactionScaleY.value = withSequence(
        withTiming(0.84, { duration: 95, easing: Easing.out(Easing.quad) }),
        withTiming(1.09, { duration: 145, easing: Easing.out(Easing.cubic) }),
        withSpring(1, { damping: 8, stiffness: 200 })
      );
      ch.headRotate.value = withSequence(
        withTiming(-9.5, { duration: 120, easing: Easing.inOut(Easing.sin) }),
        withTiming(9.5, { duration: 145, easing: Easing.inOut(Easing.sin) }),
        withSpring(0, { damping: 9, stiffness: 180 })
      );
      ch.tailExtra.value = withSequence(
        withTiming(18, { duration: 110 }),
        withTiming(-18, { duration: 120 }),
        withSpring(0, { damping: 7, stiffness: 190 })
      );
      break;
    }

    case 'entrance': {
      // Crisp anticipation dip -> peppy battle-ready hop -> alert ear perk!
      ch.reactionScaleY.value = withSequence(
        withTiming(0.89, { duration: 65 }),
        withTiming(1.13, { duration: 125, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 8.5, stiffness: 220 })
      );
      ch.bodyTy.value = withSequence(
        withTiming(size * 0.025, { duration: 65 }),
        withTiming(-jumpPx * 0.68, { duration: 145, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 8.5, stiffness: 205 })
      );
      ch.leftEarExtra.value = withSequence(
        withTiming(-15, { duration: 140 }),
        withSpring(0, { damping: 8, stiffness: 190 })
      );
      ch.rightEarExtra.value = withSequence(
        withTiming(15, { duration: 140 }),
        withSpring(0, { damping: 8, stiffness: 190 })
      );
      break;
    }
  }
  },
};

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
  const pivots = getFighterPivots(characterName);
  const healthState = useMemo(
    () => getFighterHealthState(health, maxHealth),
    [health, maxHealth]
  );

  const motion = useCreatureMotion(FIGHTER_MOTION, {
    name: characterName,
    size,
    mood,
    healthState,
    personality,
    pivots,
    reaction,
    animate: shouldAnimate,
    lively: true,
    interactive,
    onTap: onPet as ((reaction: FighterReactionType) => void) | undefined,
  });

  const expression = useMemo(
    () =>
      resolveFighterExpression({
        healthState,
        mood,
        activeReaction: motion.activeReaction,
        isBlinking: motion.isBlinking,
      }),
    [healthState, mood, motion.activeReaction, motion.isBlinking]
  );

  const rigProps = {
    size,
    expression,
    healthState,
    gazeOffset: motion.gaze,
    headStyle: motion.headStyle,
    leftEarStyle: motion.leftEarStyle,
    rightEarStyle: motion.rightEarStyle,
    tailStyle: motion.tailStyle,
    pawStyle: motion.pawStyle,
  };
  const Rig = getFighterCreature(characterName)?.Rig;

  const isCriticalFrame = healthState === 'critical' || healthState === 'knocked_out';
  const isStreakFrame = streak >= 3 || mood === 'streak' || mood === 'victory';

  return (
    <CreatureStage
      size={size}
      frame={
        framed
          ? {
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
          : undefined
      }
      testID={testID ?? 'fighter-avatar'}
      accessibilityLabel={`${characterName} fighter (${healthState})`}
      interactive={interactive}
      onPress={motion.handlePress}
      shadow={{
        testID: 'fighter-ground-shadow',
        minWidth: 14,
        minHeight: 4,
        style: motion.groundShadowStyle,
      }}
      rigRootStyle={motion.rigRootStyle}
      rig={
        <>
          {Rig ? <Rig {...rigProps} /> : <FallbackFighterRig {...rigProps} icon={characterIcon} />}
          <CreatureDamageOverlay
            healthState={healthState}
            headStyle={motion.headStyle}
            animate={shouldAnimate}
          />
        </>
      }
    >
      <FighterEffectsOverlay
        activeReaction={motion.activeReaction}
        reactionId={motion.reactionKey}
        mood={mood}
        personality={personality}
        animate={shouldAnimate}
      />

      {/* Streak mini-pill when framed in HUD and on a 3+ match streak */}
      {framed && streak >= 3 && (
        <View style={styles.streakBadge} pointerEvents="none" testID="fighter-streak-badge">
          <Text style={styles.streakBadgeText}>{streak}x</Text>
        </View>
      )}
    </CreatureStage>
  );
};

const styles = StyleSheet.create({
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
