import React, { useMemo } from 'react';
import { Easing, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { IconName } from '@/components/Icon';
import { CreatureDamageOverlay } from '@/components/creatures/CreatureDamageOverlay';
import { CreatureStage } from '@/components/creatures/CreatureStage';
import {
  CreatureMotionConfig,
  useCreatureMotion,
} from '@/components/creatures/useCreatureMotion';
import type { EnemyInstance } from '@/types/enemy';
import { useReducedMotion } from '@/utils/animation';
import { COLORS } from '@/utils/colors';
import {
  ENEMY_MOOD_MOTION,
  ENEMY_REACTION_HOLD_MS,
  EnemyAmbientMood,
  EnemyReactionEvent,
  EnemyReactionType,
  EnemyTier,
  TIER_AURA_COLORS,
  getEnemyHealthState,
  resolveEnemyExpression,
} from '@/utils/enemyAnimations';
import { EnemyEffectsOverlay } from './EnemyEffectsOverlay';
import { EnemyCreatureRig, getEnemyPersonality, getEnemyRigPivots } from './enemyRegistry';

interface EnemyAvatarProps {
  /** EnemyInstance, FoeDisplay-like object, or enemy name string */
  enemy?: EnemyInstance | { name: string; icon?: IconName; tier?: number } | string | null;
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
  /** Optional testID */
  testID?: string;
}

/** How enemies move: menacing stances, heavy recoils, taunts and lunges. */
const ENEMY_MOTION: CreatureMotionConfig<EnemyAmbientMood, EnemyReactionType> = {
  moodMotion: ENEMY_MOOD_MOTION,
  reactionHoldMs: ENEMY_REACTION_HOLD_MS,
  tapReaction: 'poke',
  tapStreakReaction: 'rage_spin',

  resolveGaze: ({ mood, healthState, activeReaction, idleGaze }) => {
    if (healthState === 'knocked_out' || mood === 'sleepy') return { x: 0, y: 0 };
    if (activeReaction === 'attack' || mood === 'menacing') {
      return { x: idleGaze.x * 0.5 - 0.18, y: 0.08 };
    }
    if (activeReaction === 'taunt') return { x: 0.25, y: -0.15 };
    return idleGaze;
  },
  mountPoseFollowsGaze: false,

  initialPhases: (name) => {
    let acc = 17;
    for (let i = 0; i < name.length; i++) {
      acc = (acc * 37 + name.charCodeAt(i)) % 628;
    }
    const seed = acc / 100;
    return {
      breath: seed,
      wag: (seed * 1.73) % (Math.PI * 2),
      sway: (seed * 0.67) % (Math.PI * 2),
      drift: (seed * 2.39) % (Math.PI * 2),
    };
  },

  mountBlends: enemyBlends,
  targetBlends: enemyBlends,

  blink: { minGapMs: 2600, gapJitterMs: 3000, holdMs: 125, doubleChance: 0.2, doubleGapMs: 90, doubleHoldMs: 110 },
  gaze: {
    minGapMs: 1800,
    gapJitterMs: 2500,
    candidates: [
      { x: 0, y: 0 },
      { x: -0.62, y: 0.08 },
      { x: 0.58, y: 0.08 },
      { x: -0.35, y: -0.18 },
      { x: 0.44, y: -0.15 },
      { x: 0, y: 0 },
    ],
  },

  idleFidget: (roll, ch) => {
  if (roll < 0.34) {
    ch.leftEarExtra.value = withSequence(
      withTiming(-12, { duration: 80 }),
      withSpring(0, { damping: 7.5, stiffness: 195 })
    );
    ch.rightEarExtra.value = withDelay(
      60,
      withSequence(
        withTiming(10, { duration: 80 }),
        withSpring(0, { damping: 7.5, stiffness: 195 })
      )
    );
  } else if (roll < 0.56) {
    ch.tailExtra.value = withSequence(
      withTiming(-13, { duration: 90 }),
      withTiming(11, { duration: 95 }),
      withSpring(0, { damping: 8, stiffness: 185 })
    );
  }
  },

  easing: { breathHz: 7.5, wagHz: 8.5, swayHz: 6.5, breathAmp: 6.5, wagAmp: 7.0, swayAmp: 6.0, bounce: 5.5, tremor: 7.0 },
  drift: { base: 0, perBreathHz: 0.236 },
  // No poseSprings: enemies hold the posture they mounted in while animating.

  look: {
    hop: 0.09,
    danceTiltDeg: 0,
    tremorFreq: 2.2,
    tremorAmpPx: 1.4,
    shadowOpacity: 0.2,
    shadowLiftShrinkX: 0.4,
    shadowLiftShrinkY: 0.34,
    pawTap: 0.032,
    pawTapThreshold: 1.2,
    pawTapGain: 2,
  },

  playReaction: (type, ch, size) => {
  const jumpPx = Math.max(6, size * 0.16);
  const recoilPx = Math.max(5, size * 0.14);

  switch (type) {
    case 'pain': {
      // Player matched a Set! Enemy takes impact: horizontal knockback + squash + head snap!
      ch.bodyTx.value = withSequence(
        withTiming(recoilPx, { duration: 48, easing: Easing.out(Easing.quad) }),
        withTiming(-recoilPx * 0.82, { duration: 60 }),
        withTiming(recoilPx * 0.55, { duration: 58 }),
        withTiming(-recoilPx * 0.28, { duration: 52 }),
        withSpring(0, { damping: 10, stiffness: 240 })
      );
      ch.reactionScaleY.value = withSequence(
        withTiming(0.81, { duration: 65, easing: Easing.out(Easing.quad) }),
        withTiming(1.09, { duration: 110 }),
        withSpring(1, { damping: 9, stiffness: 210 })
      );
      ch.bodyTy.value = withSequence(
        withTiming(size * 0.045, { duration: 65 }),
        withSpring(0, { damping: 10, stiffness: 200 })
      );
      ch.bodyRotate.value = withSequence(
        withTiming(11, { duration: 65 }),
        withTiming(-6, { duration: 85 }),
        withSpring(0, { damping: 10, stiffness: 195 })
      );
      ch.headRotate.value = withDelay(
        25,
        withSequence(
          withTiming(14, { duration: 75 }),
          withTiming(-8, { duration: 85 }),
          withSpring(0, { damping: 9, stiffness: 190 })
        )
      );
      ch.leftEarExtra.value = withSequence(
        withTiming(18, { duration: 85 }),
        withSpring(0, { damping: 8, stiffness: 175 })
      );
      ch.rightEarExtra.value = withSequence(
        withTiming(-18, { duration: 85 }),
        withSpring(0, { damping: 8, stiffness: 175 })
      );
      break;
    }

    case 'crit_pain': {
      // Rainbow / Mega-match! Heavy stagger spin + dramatic compression & rebound!
      ch.bodyTx.value = withSequence(
        withTiming(recoilPx * 1.35, { duration: 55 }),
        withTiming(-recoilPx * 1.1, { duration: 68 }),
        withTiming(recoilPx * 0.75, { duration: 62 }),
        withSpring(0, { damping: 9, stiffness: 220 })
      );
      ch.reactionScaleY.value = withSequence(
        withTiming(0.74, { duration: 70, easing: Easing.out(Easing.quad) }),
        withTiming(1.18, { duration: 125, easing: Easing.out(Easing.cubic) }),
        withTiming(0.92, { duration: 90 }),
        withSpring(1, { damping: 8, stiffness: 210 })
      );
      ch.bodyRotate.value = withSequence(
        withTiming(22, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(-16, { duration: 105 }),
        withTiming(9, { duration: 85 }),
        withSpring(0, { damping: 9, stiffness: 190 })
      );
      ch.bodyTy.value = withSequence(
        withTiming(-jumpPx * 0.55, { duration: 110, easing: Easing.out(Easing.quad) }),
        withTiming(size * 0.05, { duration: 95 }),
        withSpring(0, { damping: 9, stiffness: 200 })
      );
      break;
    }

    case 'taunt': {
      // Player made a mistake! Wicked cackle bounce + smug head rock!
      ch.reactionScaleY.value = withSequence(
        withTiming(0.86, { duration: 65 }),
        withTiming(1.16, { duration: 125, easing: Easing.out(Easing.cubic) }),
        withTiming(0.94, { duration: 95 }),
        withTiming(1.09, { duration: 110 }),
        withSpring(1, { damping: 8, stiffness: 205 })
      );
      ch.bodyTy.value = withSequence(
        withTiming(size * 0.03, { duration: 65 }),
        withTiming(-jumpPx * 0.9, { duration: 140, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 95 }),
        withTiming(-jumpPx * 0.55, { duration: 115, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 8.5, stiffness: 210 })
      );
      ch.headRotate.value = withSequence(
        withTiming(-11, { duration: 105 }),
        withTiming(11, { duration: 115 }),
        withTiming(-8, { duration: 105 }),
        withSpring(0, { damping: 9, stiffness: 185 })
      );
      ch.pawBounce.value = withSequence(
        withTiming(-size * 0.1, { duration: 120 }),
        withTiming(0, { duration: 95 }),
        withTiming(-size * 0.08, { duration: 110 }),
        withSpring(0, { damping: 8, stiffness: 195 })
      );
      break;
    }

    case 'attack': {
      // Enemy ability fires! Coiled wind-up back -> aggressive forward lunge + claw strike!
      ch.bodyTx.value = withSequence(
        withTiming(recoilPx * 0.55, { duration: 85, easing: Easing.inOut(Easing.quad) }),
        withTiming(-recoilPx * 1.45, { duration: 105, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 8.5, stiffness: 210 })
      );
      ch.reactionScaleY.value = withSequence(
        withTiming(0.84, { duration: 85 }),
        withTiming(1.17, { duration: 105, easing: Easing.out(Easing.cubic) }),
        withSpring(1, { damping: 8.5, stiffness: 215 })
      );
      ch.bodyRotate.value = withSequence(
        withTiming(8, { duration: 85 }),
        withTiming(-14, { duration: 105, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 9, stiffness: 200 })
      );
      ch.pawBounce.value = withSequence(
        withTiming(size * 0.03, { duration: 80 }),
        withTiming(-size * 0.13, { duration: 105, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 8, stiffness: 200 })
      );
      break;
    }

    case 'regen': {
      // Enemy regenerates HP: eerie float + swell!
      ch.bodyTy.value = withSequence(
        withTiming(-jumpPx * 0.78, { duration: 280, easing: Easing.out(Easing.sin) }),
        withTiming(-jumpPx * 0.78, { duration: 160 }),
        withSpring(0, { damping: 11, stiffness: 150 })
      );
      ch.reactionScaleY.value = withSequence(
        withTiming(1.1, { duration: 240, easing: Easing.out(Easing.sin) }),
        withSpring(1, { damping: 10, stiffness: 165 })
      );
      break;
    }

    case 'poke': {
      // Player poked the enemy: startled squish -> snappy annoyed growl shake!
      ch.reactionScaleY.value = withSequence(
        withTiming(0.83, { duration: 80, easing: Easing.out(Easing.quad) }),
        withTiming(1.11, { duration: 120, easing: Easing.out(Easing.cubic) }),
        withSpring(1, { damping: 8, stiffness: 210 })
      );
      ch.headRotate.value = withSequence(
        withTiming(10, { duration: 85 }),
        withTiming(-10, { duration: 95 }),
        withSpring(0, { damping: 8.5, stiffness: 195 })
      );
      ch.tailExtra.value = withSequence(
        withTiming(-20, { duration: 95 }),
        withTiming(20, { duration: 105 }),
        withSpring(0, { damping: 7.5, stiffness: 195 })
      );
      break;
    }

    case 'rage_spin': {
      // 5x poke easter egg: furious 360° berserker tornado spin!
      ch.bodyRotate.value = 0;
      ch.bodyRotate.value = withSequence(
        withTiming(16, { duration: 75, easing: Easing.inOut(Easing.quad) }),
        withTiming(-360, { duration: 540, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 0 })
      );
      ch.bodyTy.value = withSequence(
        withTiming(size * 0.04, { duration: 75 }),
        withTiming(-jumpPx * 1.15, { duration: 250, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 8, stiffness: 210 })
      );
      break;
    }

    case 'entrance': {
      // Heavy boss/foe drop-in crouch -> menacing rise & roar!
      ch.bodyTy.value = withSequence(
        withTiming(-jumpPx * 0.85, { duration: 0 }),
        withTiming(size * 0.04, { duration: 115, easing: Easing.in(Easing.quad) }),
        withSpring(0, { damping: 8.5, stiffness: 220 })
      );
      ch.reactionScaleY.value = withSequence(
        withTiming(1.12, { duration: 95 }),
        withTiming(0.84, { duration: 80, easing: Easing.out(Easing.quad) }),
        withTiming(1.08, { duration: 120 }),
        withSpring(1, { damping: 8.5, stiffness: 215 })
      );
      ch.leftEarExtra.value = withSequence(
        withTiming(-16, { duration: 150 }),
        withSpring(0, { damping: 8, stiffness: 190 })
      );
      ch.rightEarExtra.value = withSequence(
        withTiming(16, { duration: 150 }),
        withSpring(0, { damping: 8, stiffness: 190 })
      );
      break;
    }
  }
  },
};

function enemyBlends(mood: EnemyAmbientMood, healthState: string) {
  return {
    bounce: mood === 'victory' ? 1 : 0,
    tremor: mood === 'cornered' || healthState === 'critical' ? 1 : 0,
  };
}

export const EnemyAvatar: React.FC<EnemyAvatarProps> = ({
  enemy,
  size = 56,
  hp,
  maxHp = 3,
  mood = 'idle',
  reaction = null,
  lightweight = false,
  interactive = false,
  onPoke,
  framed = false,
  testID,
}) => {
  const reducedMotion = useReducedMotion();
  const shouldAnimate = !reducedMotion;

  const enemyName =
    typeof enemy === 'string'
      ? enemy
      : enemy?.name ?? 'Sparring Foe';
  const rawTier = typeof enemy === 'object' && enemy && enemy.tier ? enemy.tier : 1;
  const resolvedTier = Math.max(1, Math.min(4, rawTier)) as EnemyTier;

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

  const motion = useCreatureMotion(ENEMY_MOTION, {
    name: enemyName,
    size,
    mood: effectiveMood,
    healthState,
    personality,
    pivots,
    reaction,
    animate: shouldAnimate,
    lively: !lightweight,
    interactive,
    onTap: onPoke as ((reaction: EnemyReactionType) => void) | undefined,
  });

  const expression = useMemo(
    () =>
      resolveEnemyExpression({
        healthState,
        mood: effectiveMood,
        activeReaction: motion.activeReaction,
        isBlinking: motion.isBlinking,
      }),
    [healthState, effectiveMood, motion.activeReaction, motion.isBlinking]
  );

  const isCorneredFrame = healthState === 'critical' || healthState === 'knocked_out';

  return (
    <CreatureStage
      size={size}
      frame={
        framed
          ? {
              borderColor: isCorneredFrame ? COLORS.impactRed : TIER_AURA_COLORS[resolvedTier],
              backgroundColor: isCorneredFrame ? '#FFF1F2' : COLORS.paperBeige,
            }
          : undefined
      }
      testID={testID ?? 'enemy-avatar'}
      accessibilityLabel={`${enemyName} enemy (${healthState})`}
      interactive={interactive}
      onPress={motion.handlePress}
      shadow={
        lightweight
          ? undefined
          : { testID: 'enemy-ground-shadow', minWidth: 12, minHeight: 3, style: motion.groundShadowStyle }
      }
      rigRootStyle={motion.rigRootStyle}
      rig={
        <>
          <EnemyCreatureRig
            enemyName={enemyName}
            expression={expression}
            healthState={healthState}
            gazeOffset={motion.gaze}
            headStyle={motion.headStyle}
            leftEarStyle={motion.leftEarStyle}
            rightEarStyle={motion.rightEarStyle}
            tailStyle={motion.tailStyle}
            pawStyle={motion.pawStyle}
          />
          {!lightweight && (
            <CreatureDamageOverlay
              healthState={healthState}
              headStyle={motion.headStyle}
              animate={shouldAnimate}
              testID="enemy-damage-overlay"
            />
          )}
        </>
      }
    >
      {!lightweight && (
        <EnemyEffectsOverlay
          activeReaction={motion.activeReaction}
          reactionId={motion.reactionKey}
          mood={effectiveMood}
          personality={personality}
          animate={shouldAnimate}
        />
      )}
    </CreatureStage>
  );
};
