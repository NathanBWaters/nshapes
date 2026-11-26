import React, { memo, useEffect, useMemo } from 'react';
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { IconName } from '@/components/Icon';
import { CreatureDamageOverlay } from '@/components/creatures/CreatureDamageOverlay';
import { CreatureStage } from '@/components/creatures/CreatureStage';
import {
  CreatureMotionConfig,
  useCreatureMotion,
} from '@/components/creatures/useCreatureMotion';
import type { EnemyInstance } from '@/types/enemy';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import {
  BLINK,
  CREATURE_ACTING,
  CREATURE_FX,
  EASE,
  ENEMY_ATTACK,
  ENEMY_REGEN,
  HIT,
  HitKind,
  HitTier,
  MS,
  SPRING,
  SpringSpec,
  geometricShakeKeyframes,
  hitstopHoldMs,
} from '@/utils/motion';
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

export interface EnemyAvatarReactionEvent extends EnemyReactionEvent {
  /** Optional damage tier (`0..3`) scaling hitstop & recoil (`[FX-06]`) */
  tier?: HitTier;
  hitTier?: HitTier;
  /** Optional damage-pose variant (`[FX-12]`) */
  hitKind?: HitKind;
  hitStyle?: HitKind;
  /** Optional move kind for per-move hitstop multiplier (`[FX-06]`) */
  moveKind?: string;
}

export interface EnemyAvatarProps {
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
  /** Discrete one-shot reaction event ({ type, id, tier?, hitKind?, moveKind? }) */
  reaction?: EnemyAvatarReactionEvent | null;
  /** Optional damage tier (`0..3`) scaling hitstop duration & impact depth (`[FX-06]`) */
  hitTier?: HitTier;
  /** Optional damage-pose silhouette variant (`'throw' | 'blast' | 'zap'`, `[FX-12]`) */
  hitKind?: HitKind;
  /** Suppress built-in pain/crit impact stars when FxStage renders edge sparks (`[FX-15]`) */
  hideImpactStars?: boolean;
  /**
   * Lightweight mode for dense lists/maps (e.g. 37+ nodes on AdventureMap):
   * renders the custom illustrated rig + gentle GPU-only breath while skipping
   * UI-thread frame loops, JS blink/saccade timers, and overlay layers (`[FX-13]`).
   */
  lightweight?: boolean;
  /** Whether continuous idle/mood animation should run (default true) */
  animate?: boolean;
  /**
   * Reactions change the face and show their marks, but the body does not move
   * (the in-game Effects switch is off). Idle life still runs.
   */
  quiet?: boolean;
  /** Whether tapping the enemy pokes/provokes it (5x rapid pokes = rage_spin!) */
  interactive?: boolean;
  /** Optional callback when poked */
  onPoke?: (reactionType: 'poke' | 'rage_spin') => void;
  /** Render inside a tactile NShapes portrait frame badge */
  framed?: boolean;
  /** Optional testID */
  testID?: string;
}

/**
 * Builds a 1-frame snap to `center`, decaying 1-frame micro-vibration across `holdMs`
 * (`[FX-02]`/`[FX-05]` monotonic `×0.7`), and recovery to `rest` on `spring`.
 */
function buildHitstopVibration(
  center: number,
  amp: number,
  holdMs: number,
  rest: number,
  spring: SpringSpec,
  sign: 1 | -1 = 1
) {
  const snap = { duration: HIT.snapMs, easing: EASE.enter };
  const steps = Math.max(2, Math.floor(holdMs / HIT.vibStepMs));
  const offsets = geometricShakeKeyframes(amp, steps, HIT.vibDecay, sign);
  const vibSteps = [];
  let usedMs = 0;
  for (let i = 0; i < steps; i++) {
    const duration =
      i === steps - 1 ? Math.max(HIT.vibStepMs, holdMs - usedMs) : HIT.vibStepMs;
    usedMs += duration;
    vibSteps.push(
      withTiming(center + offsets[i], {
        duration,
        easing: i === 0 ? EASE.enter : EASE.linear,
      })
    );
  }
  return withSequence(withTiming(center, snap), ...vibSteps, withSpring(rest, spring));
}

/** How enemies move: menacing stances, tier-scaled hitstop recoils, snap lunges, and taunts. */
export const ENEMY_MOTION: CreatureMotionConfig<EnemyAmbientMood, EnemyReactionType> = {
  moodMotion: ENEMY_MOOD_MOTION,
  reactionHoldMs: {
    ...ENEMY_REACTION_HOLD_MS,
    pain: HIT.painHoldMs,
  },
  resolveReactionHoldMs: (type, context) => {
    if (type === 'pain') {
      const tier: HitTier = context.hitTier ?? 0;
      const hold = hitstopHoldMs(tier, context.moveKind, context.chain);
      // Release expression cleanly right as tier-scaled hitstop + spring recoil settle (`[FX-12]`)
      return HIT.painHoldMs + Math.max(0, hold - HIT.holdMs);
    }
    return ENEMY_REACTION_HOLD_MS[type] ?? 850;
  },
  tapReaction: 'poke',
  tapStreakReaction: 'rage_spin',

  resolveGaze: ({ mood, healthState, activeReaction, idleGaze }) => {
    if (healthState === 'knocked_out' || mood === 'sleepy') return { x: 0, y: 0 };
    if (activeReaction === 'attack' || mood === 'menacing' || mood === 'enraged') {
      // Subtle 3/4 combat gaze bias facing left toward the fighter (`[FX-09]`)
      return {
        x: Math.max(-1, Math.min(1, idleGaze.x * 0.45 + CREATURE_ACTING.enemyCombatGazeX)),
        y: 0.08,
      };
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

  blink: {
    minGapMs: 2600,
    gapJitterMs: 3000,
    holdMs: BLINK.holdMs,
    doubleChance: 0.2,
    doubleGapMs: BLINK.doubleGapMs,
    doubleHoldMs: BLINK.holdMs,
  },
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
        withTiming(-12, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.ui }),
        withSpring(0, SPRING.loose)
      );
      ch.rightEarExtra.value = withDelay(
        CREATURE_FX.fidgetDelayMs,
        withSequence(
          withTiming(10, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.ui }),
          withSpring(0, SPRING.loose)
        )
      );
    } else if (roll < 0.56) {
      ch.tailExtra.value = withSequence(
        withTiming(-13, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
        withTiming(11, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
        withSpring(0, SPRING.loose)
      );
    }
  },

  easing: { breathHz: 7.5, wagHz: 8.5, swayHz: 6.5, breathAmp: 6.5, wagAmp: 7.0, swayAmp: 6.0, bounce: 5.5, tremor: 7.0 },
  drift: { base: 0, perBreathHz: 0.236 },
  // Heavier than fighters: slower, snappier anticipation, ears/horns overshoot more
  poseSprings: {
    leanX: [2.7, 0.72, 0.6],
    leanY: [2.5, 0.68, 0.75],
    bodyTilt: [2.4, 0.66, 0.7],
    headTilt: [3.0, 0.6, 0.85],
    headY: [2.8, 0.66, 0.75],
    leftEar: [3.7, 0.5, 1.1],
    rightEar: [3.5, 0.5, 1.1],
    postureStretchY: [2.8, 0.68, 0.7],
  },

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

  playReaction: (type, ch, size, context) => {
    const jumpPx = Math.max(6, size * 0.16);
    const recoilPx = Math.max(5, size * 0.14);
    const isCompact = context.compact ?? size <= CREATURE_ACTING.compactSizePx;
    const rotBoost = isCompact ? CREATURE_ACTING.compactRotateBoost : 1;

    switch (type) {
      case 'pain':
      case 'crit_pain': {
        // [FX-02][FX-04][FX-06][FX-12]: 1-frame snap into variant damage pose (`throw` / `blast` / `zap`),
        // tier-scaled hitstop hold (3f/4f/6f/8.5f, chains 2f) with decaying micro-vibration, then spring recovery.
        const tier: HitTier = context.hitTier ?? (type === 'crit_pain' ? 1 : 0);
        const hitKind: HitKind = context.hitKind ?? 'throw';
        const chainGain = 1 + HIT.chainGain * context.chain;
        const hold = hitstopHoldMs(tier, context.moveKind, context.chain);
        const snap = { duration: HIT.snapMs, easing: EASE.enter };
        const strike = (to: number, rest: number, spring: SpringSpec) =>
          withSequence(withTiming(to, snap), withDelay(hold, withSpring(rest, spring)));

        const baseRecoil = recoilPx * Math.min(1.85, HIT.tierRecoilMult[tier] * chainGain);
        const vibAmp = recoilPx * HIT.defenderVibRatio * HIT.defenderVibTierScale[tier];
        const recoverSpring = tier >= 2 || type === 'crit_pain' ? SPRING.playful : SPRING.lively;

        if (hitKind === 'blast') {
          // Airborne blast pop: vertical launch + X/Y hitstop micro-vibration + wide back-tumble
          const blastLift = -jumpPx * HIT.blastLiftMult * (1 + tier * 0.1);
          const vibAmpY = jumpPx * HIT.blastVibYRatio * HIT.defenderVibTierScale[tier];
          const blastRot = Math.min(
            34,
            (HIT.blastRotateMinDeg + (HIT.blastRotateMaxDeg - HIT.blastRotateMinDeg) * (tier / 3)) *
              rotBoost
          );
          ch.bodyTx.value = buildHitstopVibration(baseRecoil * 1.15, vibAmp * 1.2, hold, 0, SPRING.settle, 1);
          ch.bodyTy.value = buildHitstopVibration(blastLift, vibAmpY, hold, 0, SPRING.playful, -1);
          ch.reactionScaleY.value = withSequence(
            withTiming(Math.max(0.7, HIT.tierSquash[tier] - 0.04), snap),
            withDelay(
              hold,
              withSequence(
                withTiming(1.08, { duration: MS.feedback, easing: EASE.enter }),
                withSpring(1, SPRING.playful)
              )
            )
          );
          ch.bodyRotate.value = strike(blastRot, 0, SPRING.playful);
          ch.headRotate.value = withDelay(HIT.snapMs, strike(Math.min(36, blastRot * 1.08), 0, SPRING.playful));
          ch.leftEarExtra.value = strike(HIT.blastEarSplayDeg, 0, SPRING.loose);
          ch.rightEarExtra.value = strike(-HIT.blastEarSplayDeg, 0, SPRING.loose);
          ch.pawBounce.value = strike(-size * 0.1, 0, SPRING.playful);
        } else if (hitKind === 'zap') {
          // Electric zap: grounded (`bodyTy = 0`), upright shock-stretch + tight high-frequency buzz
          cancelAnimation(ch.bodyTy);
          ch.bodyTy.value = 0;
          const zapHold = Math.max(hold, HIT.holdMs);
          const zapBuzz = recoilPx * HIT.zapBuzzRatio * HIT.defenderVibTierScale[tier];
          ch.bodyTx.value = buildHitstopVibration(recoilPx * 0.28, zapBuzz, zapHold, 0, SPRING.snappy, 1);
          ch.reactionScaleY.value = strike(HIT.zapStretchY + tier * 0.02, 1, SPRING.snappy);
          ch.bodyRotate.value = strike(HIT.zapTiltDeg * rotBoost, 0, SPRING.snappy);
          ch.headRotate.value = buildHitstopVibration(
            0,
            HIT.zapTiltDeg * 1.4 * rotBoost,
            zapHold,
            0,
            SPRING.snappy,
            -1
          );
          ch.leftEarExtra.value = strike(-HIT.zapEarSpikeDeg, 0, SPRING.loose);
          ch.rightEarExtra.value = strike(HIT.zapEarSpikeDeg, 0, SPRING.loose);
        } else {
          // Grounded `'throw'` hit: horizontal-only recoil (`bodyTy = 0`), feet stay flush on ground shadow (`[FX-04]`)
          cancelAnimation(ch.bodyTy);
          ch.bodyTy.value = 0;
          const squashTarget = Math.max(0.68, HIT.tierSquash[tier] - (chainGain - 1) * 0.14);
          const bodyRot = Math.min(28, HIT.tierRotateDeg[tier] * chainGain * rotBoost);
          const headRot = Math.min(30, HIT.tierHeadRotateDeg[tier] * chainGain * rotBoost);
          const earDeg = HIT.tierEarSplayDeg[tier];

          ch.reactionScaleY.value = strike(squashTarget, 1, recoverSpring);
          ch.bodyTx.value = buildHitstopVibration(baseRecoil, vibAmp, hold, 0, SPRING.settle, 1);
          ch.bodyRotate.value = strike(bodyRot, 0, recoverSpring);
          // Head and ears are thrown 1 frame later and recover loose (follow-through)
          ch.headRotate.value = withDelay(HIT.snapMs, strike(headRot, 0, recoverSpring));
          ch.leftEarExtra.value = strike(earDeg, 0, SPRING.loose);
          ch.rightEarExtra.value = strike(-earDeg, 0, SPRING.loose);
        }
        break;
      }

      case 'taunt': {
        // Player made a mistake! Wicked cackle bounce + smug head rock!
        ch.reactionScaleY.value = withSequence(
          withTiming(0.86, { duration: CREATURE_FX.tauntDipMs, easing: EASE.enter }),
          withTiming(1.16, { duration: CREATURE_FX.pokeFollowMs, easing: EASE.enter }),
          withTiming(0.94, { duration: CREATURE_FX.tauntStepMs, easing: EASE.ui }),
          withTiming(1.09, { duration: CREATURE_FX.pokeFollowMs, easing: EASE.ui }),
          withSpring(1, SPRING.playful)
        );
        ch.bodyTy.value = withSequence(
          withTiming(size * 0.03, { duration: CREATURE_FX.tauntDipMs, easing: EASE.enter }),
          withTiming(-jumpPx * 0.9, { duration: CREATURE_FX.tauntRiseMs, easing: EASE.enter }),
          withTiming(0, { duration: CREATURE_FX.tauntStepMs, easing: EASE.impact }),
          withTiming(-jumpPx * 0.55, { duration: CREATURE_FX.pokeFollowMs, easing: EASE.enter }),
          withSpring(0, SPRING.playful)
        );
        ch.headRotate.value = withSequence(
          withTiming(-11 * rotBoost, { duration: CREATURE_FX.tauntStepMs, easing: EASE.ui }),
          withTiming(11 * rotBoost, { duration: CREATURE_FX.pokeFollowMs, easing: EASE.ui }),
          withTiming(-8 * rotBoost, { duration: CREATURE_FX.tauntStepMs, easing: EASE.ui }),
          withSpring(0, SPRING.lively)
        );
        ch.pawBounce.value = withSequence(
          withTiming(-size * 0.1, { duration: CREATURE_FX.pokeFollowMs, easing: EASE.enter }),
          withTiming(0, { duration: CREATURE_FX.tauntStepMs, easing: EASE.ui }),
          withTiming(-size * 0.08, { duration: CREATURE_FX.pokeFollowMs, easing: EASE.enter }),
          withSpring(0, SPRING.playful)
        );
        break;
      }

      case 'attack': {
        // [FX-10] Frame-1 snap anticipation -> 4f coiled hold -> 2f strike lunge -> 3f apex hold -> slow follow-through!
        const wind = { duration: ENEMY_ATTACK.windMs, easing: EASE.enter };
        const lunge = { duration: ENEMY_ATTACK.strikeMs, easing: EASE.enter };

        ch.bodyTx.value = withSequence(
          withTiming(recoilPx * ENEMY_ATTACK.windTxMult, wind),
          withDelay(ENEMY_ATTACK.coilHoldMs, withTiming(recoilPx * ENEMY_ATTACK.strikeTxMult, lunge)),
          withDelay(ENEMY_ATTACK.apexHoldMs, withSpring(0, SPRING.settle))
        );
        ch.reactionScaleY.value = withSequence(
          withTiming(ENEMY_ATTACK.windScaleY, wind),
          withDelay(ENEMY_ATTACK.coilHoldMs, withTiming(ENEMY_ATTACK.strikeScaleY, lunge)),
          withDelay(ENEMY_ATTACK.apexHoldMs, withSpring(1, SPRING.lively))
        );
        ch.bodyRotate.value = withSequence(
          withTiming(ENEMY_ATTACK.windRotateDeg * rotBoost, wind),
          withDelay(ENEMY_ATTACK.coilHoldMs, withTiming(ENEMY_ATTACK.strikeRotateDeg * rotBoost, lunge)),
          withDelay(ENEMY_ATTACK.apexHoldMs, withSpring(0, SPRING.lively))
        );
        ch.headRotate.value = withDelay(
          ENEMY_ATTACK.windMs + ENEMY_ATTACK.coilHoldMs,
          withSequence(
            withTiming(ENEMY_ATTACK.strikeHeadRotateDeg * rotBoost, lunge),
            withDelay(ENEMY_ATTACK.apexHoldMs, withSpring(0, SPRING.lively))
          )
        );
        ch.pawBounce.value = withSequence(
          withTiming(size * ENEMY_ATTACK.windPawRatio, wind),
          withDelay(ENEMY_ATTACK.coilHoldMs, withTiming(size * ENEMY_ATTACK.strikePawRatio, lunge)),
          withDelay(ENEMY_ATTACK.apexHoldMs, withSpring(0, SPRING.lively))
        );
        break;
      }

      case 'regen': {
        // [FX-10] Crisp anticipation dip -> 2f hold -> buoyant swell -> apex hold -> gentle settle!
        const dip = { duration: ENEMY_REGEN.dipMs, easing: EASE.enter };
        const swell = { duration: ENEMY_REGEN.swellMs, easing: EASE.enterSoft };

        ch.bodyTy.value = withSequence(
          withTiming(size * ENEMY_REGEN.dipTyRatio, dip),
          withDelay(ENEMY_REGEN.dipHoldMs, withTiming(jumpPx * ENEMY_REGEN.swellLiftMult, swell)),
          withDelay(ENEMY_REGEN.apexHoldMs, withSpring(0, SPRING.settle))
        );
        ch.reactionScaleY.value = withSequence(
          withTiming(ENEMY_REGEN.dipScaleY, dip),
          withDelay(ENEMY_REGEN.dipHoldMs, withTiming(ENEMY_REGEN.swellScaleY, swell)),
          withDelay(ENEMY_REGEN.apexHoldMs, withSpring(1, SPRING.settle))
        );
        break;
      }

      case 'poke': {
        // Player poked the enemy: startled squish -> snappy annoyed growl shake!
        ch.reactionScaleY.value = withSequence(
          withTiming(0.83, { duration: CREATURE_FX.pokeStepMs, easing: EASE.enter }),
          withTiming(1.11, { duration: CREATURE_FX.pokeFollowMs, easing: EASE.enter }),
          withSpring(1, SPRING.playful)
        );
        ch.headRotate.value = withSequence(
          withTiming(10 * rotBoost, { duration: CREATURE_FX.pokeStepMs, easing: EASE.ui }),
          withTiming(-10 * rotBoost, { duration: CREATURE_FX.tauntStepMs, easing: EASE.ui }),
          withSpring(0, SPRING.lively)
        );
        ch.tailExtra.value = withSequence(
          withTiming(-20, { duration: CREATURE_FX.tauntStepMs, easing: EASE.ui }),
          withTiming(20, { duration: CREATURE_FX.tauntStepMs, easing: EASE.ui }),
          withSpring(0, SPRING.loose)
        );
        break;
      }

      case 'rage_spin': {
        // 5x poke easter egg: furious 360° berserker tornado spin!
        ch.bodyRotate.value = 0;
        ch.bodyRotate.value = withSequence(
          withTiming(16, { duration: CREATURE_FX.pokeStepMs, easing: EASE.ui }),
          withTiming(-360, { duration: CREATURE_FX.spinMs, easing: EASE.enter }),
          withTiming(0, { duration: 0 })
        );
        ch.bodyTy.value = withSequence(
          withTiming(size * 0.04, { duration: CREATURE_FX.pokeStepMs, easing: EASE.ui }),
          withTiming(-jumpPx * 1.15, { duration: MS.move, easing: EASE.enter }),
          withSpring(0, SPRING.playful)
        );
        break;
      }

      case 'entrance': {
        // Heavy boss/foe drop-in crouch -> menacing rise & roar!
        ch.bodyTy.value = withSequence(
          withTiming(-jumpPx * 0.85, { duration: 0 }),
          withTiming(size * 0.04, { duration: CREATURE_FX.entranceDropMs, easing: EASE.impact }),
          withSpring(0, SPRING.lively)
        );
        ch.reactionScaleY.value = withSequence(
          withTiming(1.12, { duration: CREATURE_FX.tauntStepMs, easing: EASE.ui }),
          withTiming(0.84, { duration: CREATURE_FX.pokeStepMs, easing: EASE.enter }),
          withTiming(1.08, { duration: CREATURE_FX.pokeFollowMs, easing: EASE.ui }),
          withSpring(1, SPRING.lively)
        );
        ch.leftEarExtra.value = withSequence(
          withTiming(-16, { duration: CREATURE_FX.entranceHoldMs, easing: EASE.ui }),
          withSpring(0, SPRING.loose)
        );
        ch.rightEarExtra.value = withSequence(
          withTiming(16, { duration: CREATURE_FX.entranceHoldMs, easing: EASE.ui }),
          withSpring(0, SPRING.loose)
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

export const EnemyAvatar: React.FC<EnemyAvatarProps> = memo(function EnemyAvatar({
  enemy,
  size = 56,
  hp,
  maxHp = 3,
  mood = 'idle',
  reaction = null,
  hitTier,
  hitKind,
  hideImpactStars = false,
  lightweight = false,
  animate = true,
  quiet = false,
  interactive = false,
  onPoke,
  framed = false,
  testID,
}) {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const shouldAnimate = animate && !lightweight && !reducedMotion && appActive;
  const shouldLightweightBreathe = animate && lightweight && !reducedMotion && appActive;

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

  const resolvedHitKind: HitKind = reaction?.hitKind ?? reaction?.hitStyle ?? hitKind ?? 'throw';

  const motion = useCreatureMotion(ENEMY_MOTION, {
    name: enemyName,
    size,
    mood: effectiveMood,
    healthState,
    personality,
    pivots,
    reaction,
    hitTier,
    hitKind: resolvedHitKind,
    animate: shouldAnimate,
    stillReactions: quiet,
    lively: !lightweight,
    interactive,
    onTap: onPoke as ((reaction: EnemyReactionType) => void) | undefined,
  });

  // [FX-13] Restore gentle GPU-only breathing on lightweight rigs without spawning frame loops or JS timers
  const lightweightBreath = useSharedValue(0);
  useEffect(() => {
    if (!shouldLightweightBreathe) {
      cancelAnimation(lightweightBreath);
      lightweightBreath.value = 0;
      return;
    }
    const phaseShare = ENEMY_MOTION.initialPhases(enemyName).breath / (Math.PI * 2);
    const halfCycleMs = Math.max(300, Math.round(personality.breathCycleMs / 2));
    const staggerMs = Math.round(phaseShare * personality.breathCycleMs);
    lightweightBreath.value = 0;
    lightweightBreath.value = withDelay(
      staggerMs,
      withRepeat(withTiming(1, { duration: halfCycleMs, easing: EASE.drift }), -1, true)
    );
    return () => {
      cancelAnimation(lightweightBreath);
    };
  }, [shouldLightweightBreathe, enemyName, personality.breathCycleMs, lightweightBreath]);

  const footAnchorY = size * 0.35;
  const lightweightBreathAmp = personality.breathIntensity;
  const lightweightRigStyle = useAnimatedStyle(() => {
    const scaleY = 1 + lightweightBreath.value * lightweightBreathAmp;
    const scaleX = 1 / scaleY;
    return {
      transform: [
        { translateY: footAnchorY },
        { scaleX },
        { scaleY },
        { translateY: -footAnchorY },
      ],
    };
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
      rigRootStyle={lightweight ? lightweightRigStyle : motion.rigRootStyle}
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
          stillBurst={quiet}
          hideImpactStars={hideImpactStars}
          hitKind={resolvedHitKind}
        />
      )}
    </CreatureStage>
  );
});
