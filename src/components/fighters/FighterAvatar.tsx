import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CreatureDamageOverlay } from '@/components/creatures/CreatureDamageOverlay';
import { CreatureStage } from '@/components/creatures/CreatureStage';
import { RigVisualProvider } from '@/components/creatures/RigLayers';
import type { BlinkStage } from '@/components/creatures/types';
import {
  CreatureMotionConfig,
  useCreatureMotion,
} from '@/components/creatures/useCreatureMotion';
import { Character } from '@/types';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import {
  ACCESSIBLE,
  BLINK,
  CHEER,
  CREATURE_ACTING,
  CREATURE_FX,
  EASE,
  HIT,
  HitTier,
  MODAL_MOTION,
  MS,
  OVERLAP,
  SCALE,
  SPRING,
  STAYS,
  SpringSpec,
  THROW,
  cheerIntensity,
  geometricShakeKeyframes,
  hitstopHoldMs,
} from '@/utils/motion';
import {
  FIGHTER_MOOD_MOTION,
  FIGHTER_REACTION_HOLD_MS,
  FighterAmbientMood,
  FighterExpression,
  FighterReactionEvent,
  getFighterHealthState,
  resolveFighterExpression,
} from '@/utils/fighterAnimations';
import { FallbackFighterRig } from './creatures/FallbackFighterRig';
import { FighterEffectsOverlay, FighterOverlayReactionType } from './FighterEffectsOverlay';
import {
  getFighterCreature,
  getFighterMassClass,
  getFighterPersonality,
  getFighterPivots,
  getFighterSpeciesChoreography,
  getFighterSpeciesFidget,
} from './fighterRegistry';

export type FighterAvatarReactionType = FighterOverlayReactionType;

export interface FighterAvatarReactionEvent extends Omit<FighterReactionEvent, 'type'> {
  type: FighterAvatarReactionType;
  /** Optional damage tier (`0..3`) for heavier `pain` hitstop (`[FX-07]`) */
  tier?: HitTier;
  hitTier?: HitTier;
  /** Optional dynamic cheer release delay (ms) synced to Set flight time (`[FX-23]`) */
  releaseMs?: number;
}

export interface FighterAvatarProps {
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
  /** Discrete one-shot reaction event ({ type, id, releaseMs? }) */
  reaction?: FighterAvatarReactionEvent | null;
  /** Current consecutive match streak (shows subtle badge/glow when >= 3 and framed) */
  streak?: number;
  /** Optional dynamic release delay (ms) syncing `'joy'`/`'ecstatic'` celebration hops (`[FX-23]`) */
  cheerReleaseMs?: number;
  /** Whether continuous idle/reaction animations run (default true) */
  animate?: boolean;
  /**
   * Battery-safe lightweight portrait mode (menus, pickers, story endings, bubbles):
   * runs GPU-only `withRepeat` breathing with ZERO `useGuardedFrameCallback` loops,
   * gated strictly on `useAppActive()` & `!useReducedMotion()` & `cancelAnimation` cleanup.
   */
  lightweight?: boolean;
  /**
   * Reactions change the face and show their marks, but the body does not move
   * (the in-game Effects switch is off). Idle life still runs.
   */
  quiet?: boolean;
  /** Whether tapping the fighter pets them (blush + heart, 5x = zoomie spin!) */
  interactive?: boolean;
  /** Optional callback when the player pets the fighter */
  onPet?: (reactionType: 'pet' | 'dizzy_joy') => void;
  /** Render inside a tactile NShapes portrait frame badge (ideal for HUD & headers) */
  framed?: boolean;
  /** [UI-07] Render the rig in solid-black `#121212` Silhouette Audit mode */
  silhouette?: boolean;
  /** Optional testID */
  testID?: string;
}

const BLINKABLE_EXPRESSIONS: ReadonlySet<FighterExpression> = new Set([
  'normal',
  'determined',
  'eager',
  'aha',
  'bruised_grit',
  'blink',
]);

/**
 * Builds a 1-frame snap to `center`, decaying 1-frame micro-vibration across `holdMs`
 * (`[FX-02]`/`[FX-05]`/`[FX-07]`), and clean critically-damped recovery to `rest`.
 */
function buildHitstopVibration(
  center: number,
  amp: number,
  holdMs: number,
  rest: number,
  spring: SpringSpec,
  sign: 1 | -1 = -1
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

/** How fighters move: bouncy, affectionate, Disney-style anticipation and Sakurai-crisp combat acting. */
export const FIGHTER_MOTION: CreatureMotionConfig<FighterAmbientMood, FighterAvatarReactionType> = {
  moodMotion: FIGHTER_MOOD_MOTION,
  reactionHoldMs: {
    ...FIGHTER_REACTION_HOLD_MS,
    throw: THROW.expressionHoldMs,
  },
  tapReaction: 'pet',
  tapStreakReaction: 'dizzy_joy',

  // "Eyes lead, head follows" via the posture springs, with subtle combat gaze bias facing right (`[FX-09]`)
  resolveGaze: ({ mood, healthState, activeReaction, idleGaze }) => {
    if (healthState === 'knocked_out' || mood === 'sleepy') {
      return { x: 0, y: 0 };
    }
    if (activeReaction === 'throw') {
      return { x: 0.65, y: -0.14 };
    }
    if (mood === 'curious') {
      return { x: 0.65, y: -0.32 };
    }
    if (mood === 'anticipation') {
      return { x: CREATURE_ACTING.fighterCombatGazeX, y: -0.22 };
    }
    if (mood === 'defeat') {
      return { x: -0.25, y: 0.35 };
    }
    return {
      x: Math.max(-1, Math.min(1, idleGaze.x * 0.6 + CREATURE_ACTING.fighterCombatGazeX)),
      y: idleGaze.y,
    };
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

  blink: {
    minGapMs: 2400,
    gapJitterMs: 2800,
    holdMs: BLINK.holdMs,
    doubleChance: 0.22,
    doubleGapMs: BLINK.doubleGapMs,
    doubleHoldMs: BLINK.holdMs,
  },
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
        withTiming(-11, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.ui }),
        withSpring(0, SPRING.loose)
      );
      ch.rightEarExtra.value = withDelay(
        CREATURE_FX.fidgetDelayMs,
        withSequence(
          withTiming(9, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.ui }),
          withSpring(0, SPRING.loose)
        )
      );
    } else if (roll < 0.52) {
      // Playful 2-beat tail/wing/halo flick
      ch.tailExtra.value = withSequence(
        withTiming(11, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
        withTiming(-9, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
        withSpring(0, SPRING.loose)
      );
    } else if (roll < 0.66) {
      ch.reactionScaleY.value = withSequence(
        withTiming(1.035, { duration: CREATURE_FX.fidgetBreathMs, easing: EASE.drift }),
        withSpring(1, SPRING.settle)
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

  // Disney Anticipation -> Arc -> Follow-Through -> Settle + Sakurai HIT & THROW choreography
  playReaction: (type, ch, size, context) => {
    const jumpPx = Math.max(6, size * 0.22);
    const recoilPx = Math.max(4, size * 0.14);
    const isCompact = context.compact ?? size <= CREATURE_ACTING.compactSizePx;
    const rotBoost = isCompact ? CREATURE_ACTING.compactRotateBoost : 1;

    switch (type) {
      case 'throw': {
        // [FX-09] & [FX-02]: Dedicated asymmetric Set-launch lunge with light launch recoil:
        // 1) 2f snap coil back (0-32ms) -> 2) 2f centerline-crossing lunge (32-64ms)
        // -> 3) 2f light launch recoil inside 96ms lingering follow-through -> 4) smooth spring recovery.
        const wind = { duration: THROW.windMs, easing: EASE.enter };
        const lunge = { duration: THROW.lungeMs, easing: EASE.enter };
        const kick = { duration: HIT.snapMs, easing: EASE.enter };
        const rebound = { duration: HIT.snapMs, easing: EASE.ui };
        const lungeTx = size * THROW.lungeTxRatio;
        const kickOffset = recoilPx * HIT.attackerRecoilRatio;
        const lingerAfterRecoilMs = Math.max(0, THROW.holdMs - HIT.snapMs * 2);

        cancelAnimation(ch.bodyTy);
        ch.bodyTy.value = 0;

        ch.bodyTx.value = withSequence(
          withTiming(size * THROW.windTxRatio, wind),
          withTiming(lungeTx, lunge),
          withTiming(lungeTx - kickOffset, kick),
          withTiming(lungeTx + recoilPx * THROW.recoilReboundRatio, rebound),
          withDelay(lingerAfterRecoilMs, withSpring(0, SPRING.settle))
        );
        ch.bodyRotate.value = withSequence(
          withTiming(THROW.windRotateDeg * rotBoost, wind),
          withTiming(THROW.lungeRotateDeg * rotBoost, lunge),
          withDelay(THROW.holdMs, withSpring(0, SPRING.lively))
        );
        ch.reactionScaleY.value = withSequence(
          withTiming(THROW.windScaleY, wind),
          withTiming(THROW.lungeScaleY, lunge),
          withDelay(THROW.holdMs, withSpring(1, SPRING.lively))
        );
        ch.headRotate.value = withDelay(
          THROW.windMs,
          withSequence(
            withTiming(THROW.lungeHeadRotateDeg * rotBoost, lunge),
            withDelay(THROW.holdMs, withSpring(0, SPRING.lively))
          )
        );
        ch.pawBounce.value = withDelay(
          THROW.windMs,
          withSequence(
            withTiming(size * THROW.lungePawRatio, lunge),
            withDelay(THROW.holdMs, withSpring(0, SPRING.lively))
          )
        );
        ch.leftEarExtra.value = withSequence(
          withTiming(THROW.windLeftEarDeg, wind),
          withTiming(-THROW.windLeftEarDeg, lunge),
          withDelay(THROW.holdMs, withSpring(0, SPRING.loose))
        );
        ch.rightEarExtra.value = withSequence(
          withTiming(THROW.windRightEarDeg, wind),
          withTiming(-THROW.windRightEarDeg, lunge),
          withDelay(THROW.holdMs, withSpring(0, SPRING.loose))
        );
        break;
      }

      case 'joy':
      case 'ecstatic': {
        // A Set: crouch at once (the answer to the tap), hold the crouch while the cards fly,
        // and hop on the frame they land (`cheerReleaseMs ?? CHEER.releaseMs`).
        // 'ecstatic' (already landed / hero moment) releases at once.
        const now = type === 'ecstatic';
        const i = now ? 1 : context.intensity;
        const releaseMs = Math.max(CHEER.windMs, context.cheerReleaseMs ?? CHEER.releaseMs);
        const wind = { duration: now ? CHEER.ecstaticWindMs : CHEER.windMs, easing: EASE.enter };
        const hold = now ? 0 : Math.max(0, releaseMs - CHEER.windMs);
        const rise = { duration: CHEER.riseMs, easing: EASE.enter };
        const lift = jumpPx * (CHEER.liftMin + (CHEER.liftMax - CHEER.liftMin) * i);
        // The body is in the air for riseMs + fallMs; the landing squash is timed to touch-down
        const stretchMs = CHEER.stretchMs;
        const apexMs = CHEER.riseMs - stretchMs + CHEER.apexExtraMs;
        const toLanding = Math.max(0, CHEER.riseMs + CHEER.fallMs - stretchMs - apexMs);
        const followDelay = (now ? CHEER.ecstaticWindMs : releaseMs) + CHEER.followLagMs;

        // [FX-02] Crisp 2-frame light attacker kickback synced to Set launch
        if (!now) {
          ch.bodyTx.value = withSequence(
            withTiming(-recoilPx * HIT.attackerRecoilRatio, { duration: HIT.snapMs, easing: EASE.enter }),
            withTiming(recoilPx * THROW.recoilReboundRatio, { duration: HIT.snapMs, easing: EASE.ui }),
            withSpring(0, SPRING.settle)
          );
        }

        ch.reactionScaleY.value = withSequence(
          withTiming(0.88, wind),
          withDelay(hold, withTiming(1.1 + 0.05 * i, { duration: stretchMs, easing: EASE.enter })),
          withTiming(1, { duration: apexMs, easing: EASE.drift }),
          withDelay(toLanding, withTiming(0.9, { duration: CHEER.landHoldMs, easing: EASE.enter })),
          withDelay(CHEER.landHoldMs, withSpring(1, SPRING.lively))
        );
        ch.bodyTy.value = withSequence(
          withTiming(size * 0.045, wind),
          withDelay(hold, withTiming(-lift, rise)),
          // Falls on EASE.impact: accelerates into the landing
          withTiming(0, { duration: CHEER.fallMs, easing: EASE.impact })
        );
        ch.bodyRotate.value = withSequence(
          withTiming(2, wind),
          withDelay(hold, withTiming(-(4 + 4 * i), rise)),
          withSpring(0, SPRING.lively)
        );
        // The head, ears and tail follow the body a frame or two late
        ch.headTy.value = withDelay(
          followDelay,
          withSequence(
            withTiming(-size * 0.03, { duration: CHEER.followMs, easing: EASE.enter }),
            withSpring(0, SPRING.lively)
          )
        );
        ch.leftEarExtra.value = withSequence(
          withTiming(6, wind),
          withDelay(hold, withTiming(-(14 + 6 * i), rise)),
          withSpring(0, SPRING.playful)
        );
        ch.rightEarExtra.value = withSequence(
          withTiming(-6, wind),
          withDelay(hold, withTiming(14 + 6 * i, rise)),
          withSpring(0, SPRING.playful)
        );
        ch.pawBounce.value = withSequence(
          withTiming(size * 0.02, wind),
          withDelay(hold, withTiming(-size * 0.07, rise)),
          withSpring(0, SPRING.lively)
        );
        ch.tailExtra.value = withDelay(
          followDelay,
          withSequence(
            withTiming(16, { duration: CHEER.followMs, easing: EASE.enter }),
            withSpring(0, SPRING.playful)
          )
        );
        break;
      }

      case 'dizzy_joy': {
        // The 5-pets easter egg (rare and asked for): deep coil, counter-wind, a full spin, land
        ch.reactionScaleY.value = withSequence(
          withTiming(0.79, { duration: CREATURE_FX.pokeStepMs, easing: EASE.enter }),
          withTiming(1.21, { duration: MS.quick, easing: EASE.enter }),
          withTiming(0.9, { duration: CHEER.riseMs, easing: EASE.impact }),
          withSpring(1, SPRING.playful)
        );
        ch.bodyTy.value = withSequence(
          withTiming(size * 0.055, { duration: CREATURE_FX.pokeStepMs, easing: EASE.enter }),
          withTiming(-jumpPx * 1.32, { duration: CREATURE_FX.reliefInhaleMs, easing: EASE.enter }),
          withSpring(0, SPRING.playful)
        );
        ch.bodyRotate.value = withSequence(
          withTiming(-15, { duration: CREATURE_FX.pokeStepMs, easing: EASE.ui }),
          withTiming(368, { duration: CREATURE_FX.spinMs, easing: EASE.enter }),
          withTiming(8, { duration: 1 }),
          withSpring(0, SPRING.lively)
        );
        ch.leftEarExtra.value = withSequence(
          withTiming(-22, { duration: MS.quick, easing: EASE.ui }),
          withSpring(0, SPRING.loose)
        );
        ch.rightEarExtra.value = withSequence(
          withTiming(22, { duration: MS.quick, easing: EASE.ui }),
          withSpring(0, SPRING.loose)
        );
        break;
      }

      case 'pain': {
        // [FX-07] Sakurai HIT grammar mirrored left (away from right-hand foe):
        // 1-frame snap into clear damage pose + hitstop hold with decaying micro-vibration
        // + grounded feet (`bodyTy = 0`) + 1f lagged head whiplash + single directional recovery!
        const tier: HitTier = context.hitTier ?? 0;
        const hold = hitstopHoldMs(tier, context.moveKind, context.chain);
        const snap = { duration: HIT.snapMs, easing: EASE.enter };
        const strike = (to: number, rest: number, spring: SpringSpec) =>
          withSequence(withTiming(to, snap), withDelay(hold, withSpring(rest, spring)));

        const peakTx = -recoilPx * HIT.fighterPainRecoilMult;
        const vibAmp = recoilPx * HIT.defenderVibRatio * HIT.defenderVibTierScale[tier];

        cancelAnimation(ch.bodyTy);
        ch.bodyTy.value = 0;
        ch.bodyTx.value = buildHitstopVibration(peakTx, vibAmp, hold, 0, SPRING.settle, -1);
        ch.reactionScaleY.value = strike(HIT.fighterPainSquash, 1, SPRING.lively);
        ch.bodyRotate.value = strike(HIT.fighterPainRotateDeg * rotBoost, 0, SPRING.lively);
        ch.headRotate.value = withDelay(
          HIT.snapMs,
          strike(HIT.fighterPainHeadRotateDeg * rotBoost, 0, SPRING.lively)
        );
        ch.leftEarExtra.value = strike(HIT.fighterPainEarDeg, 0, SPRING.loose);
        ch.rightEarExtra.value = strike(-HIT.fighterPainEarDeg, 0, SPRING.loose);
        break;
      }

      case 'relief': {
        // Startled flinch -> deep chest-expanding inhale -> melting 'Phew!' exhale settle
        ch.reactionScaleY.value = withSequence(
          withTiming(0.87, { duration: CREATURE_FX.reliefDipMs, easing: EASE.enter }),
          withTiming(1.09, { duration: CREATURE_FX.reliefInhaleMs, easing: EASE.drift }),
          withTiming(0.96, { duration: CREATURE_FX.reliefInhaleMs, easing: EASE.drift }),
          withSpring(1, SPRING.settle)
        );
        ch.bodyTy.value = withSequence(
          withTiming(size * 0.025, { duration: CREATURE_FX.reliefDipMs, easing: EASE.enter }),
          withTiming(-size * 0.04, { duration: CREATURE_FX.fidgetBreathMs, easing: EASE.drift }),
          withSpring(0, SPRING.settle)
        );
        ch.headRotate.value = withSequence(
          withTiming(-4, { duration: CREATURE_FX.reliefDipMs, easing: EASE.ui }),
          withTiming(11.5, { duration: CREATURE_FX.reliefInhaleMs, easing: EASE.ui }),
          withDelay(CREATURE_FX.reliefHoldMs, withSpring(0, SPRING.settle))
        );
        break;
      }

      case 'heal': {
        // Gentle anticipation dip -> warm buoyant levitation -> feather-soft settle
        ch.bodyTy.value = withSequence(
          withTiming(size * 0.02, { duration: CREATURE_FX.reliefDipMs, easing: EASE.enter }),
          withTiming(-jumpPx * 0.78, { duration: CREATURE_FX.healRiseMs, easing: EASE.enterSoft }),
          withSpring(0, SPRING.settle)
        );
        ch.reactionScaleY.value = withSequence(
          withTiming(0.95, { duration: CREATURE_FX.reliefDipMs, easing: EASE.enter }),
          withTiming(1.09, { duration: CREATURE_FX.healRiseMs, easing: EASE.enterSoft }),
          withSpring(1, SPRING.settle)
        );
        ch.tailExtra.value = withSequence(
          withTiming(14, { duration: MS.quick, easing: EASE.ui }),
          withTiming(-14, { duration: CREATURE_FX.powerupRiseMs, easing: EASE.ui }),
          withSpring(0, SPRING.loose)
        );
        break;
      }

      case 'powerup': {
        // Grounded power-gather crouch -> heroic upward surge -> crisp landing!
        ch.reactionScaleY.value = withSequence(
          withTiming(0.84, { duration: CREATURE_FX.powerupWindMs, easing: EASE.ui }),
          withTiming(1.2, { duration: CREATURE_FX.powerupRiseMs, easing: EASE.enter }),
          withTiming(0.94, { duration: MS.feedback, easing: EASE.ui }),
          withSpring(1, SPRING.lively)
        );
        ch.bodyTy.value = withSequence(
          withTiming(size * 0.04, { duration: CREATURE_FX.powerupWindMs, easing: EASE.ui }),
          withTiming(-jumpPx * 0.92, { duration: CREATURE_FX.powerupRiseMs, easing: EASE.enter }),
          withSpring(0, SPRING.lively)
        );
        ch.leftEarExtra.value = withSequence(
          withTiming(8, { duration: CREATURE_FX.powerupWindMs, easing: EASE.ui }),
          withTiming(-16, { duration: MS.quick, easing: EASE.enter }),
          withSpring(0, SPRING.loose)
        );
        ch.rightEarExtra.value = withSequence(
          withTiming(-8, { duration: CREATURE_FX.powerupWindMs, easing: EASE.ui }),
          withTiming(16, { duration: MS.quick, easing: EASE.enter }),
          withSpring(0, SPRING.loose)
        );
        break;
      }

      case 'hint': {
        // Slight double-take dip -> expressive 'Aha!' head-cock & asymmetric radar-ear perk!
        ch.reactionScaleY.value = withSequence(
          withTiming(0.95, { duration: CREATURE_FX.tauntDipMs, easing: EASE.ui }),
          withTiming(1.06, { duration: CREATURE_FX.tauntRiseMs, easing: EASE.ui }),
          withSpring(1, SPRING.lively)
        );
        ch.headRotate.value = withSequence(
          withTiming(-4, { duration: CREATURE_FX.tauntDipMs, easing: EASE.ui }),
          withTiming(14.5, { duration: CHEER.riseMs, easing: EASE.pop }),
          withDelay(CREATURE_FX.hintHoldMs, withSpring(0, SPRING.settle))
        );
        ch.leftEarExtra.value = withSequence(
          withTiming(-20, { duration: CREATURE_FX.tauntRiseMs, easing: EASE.pop }),
          withDelay(CREATURE_FX.hintHoldMs, withSpring(0, SPRING.loose))
        );
        break;
      }

      case 'pet': {
        // Cozy squish under the player's finger -> happy rebound + affectionate nuzzle!
        ch.reactionScaleY.value = withSequence(
          withTiming(0.84, { duration: CREATURE_FX.tauntStepMs, easing: EASE.enter }),
          withTiming(1.09, { duration: CREATURE_FX.tauntRiseMs, easing: EASE.enter }),
          withSpring(1, SPRING.playful)
        );
        ch.headRotate.value = withSequence(
          withTiming(-9.5, { duration: CREATURE_FX.petRollMs, easing: EASE.drift }),
          withTiming(9.5, { duration: CREATURE_FX.tauntRiseMs, easing: EASE.drift }),
          withSpring(0, SPRING.lively)
        );
        ch.tailExtra.value = withSequence(
          withTiming(18, { duration: CREATURE_FX.petRollMs, easing: EASE.ui }),
          withTiming(-18, { duration: CREATURE_FX.petRollMs, easing: EASE.ui }),
          withSpring(0, SPRING.loose)
        );
        break;
      }

      case 'entrance': {
        // Crisp anticipation dip -> peppy battle-ready hop -> alert ear perk!
        ch.reactionScaleY.value = withSequence(
          withTiming(0.89, { duration: CREATURE_FX.tauntDipMs, easing: EASE.enter }),
          withTiming(1.13, { duration: MS.feedback, easing: EASE.enter }),
          withSpring(1, SPRING.lively)
        );
        ch.bodyTy.value = withSequence(
          withTiming(size * 0.025, { duration: CREATURE_FX.tauntDipMs, easing: EASE.enter }),
          withTiming(-jumpPx * 0.68, { duration: CREATURE_FX.tauntRiseMs, easing: EASE.enter }),
          withSpring(0, SPRING.lively)
        );
        ch.leftEarExtra.value = withSequence(
          withTiming(-15, { duration: CREATURE_FX.tauntRiseMs, easing: EASE.ui }),
          withSpring(0, SPRING.loose)
        );
        ch.rightEarExtra.value = withSequence(
          withTiming(15, { duration: CREATURE_FX.tauntRiseMs, easing: EASE.ui }),
          withSpring(0, SPRING.loose)
        );
        break;
      }
    }
  },
};

export const FighterAvatar: React.FC<FighterAvatarProps> = memo(function FighterAvatar({
  character,
  size = 56,
  health,
  maxHealth = 3,
  mood = 'idle',
  reaction = null,
  streak = 0,
  cheerReleaseMs,
  animate = true,
  lightweight = false,
  quiet = false,
  interactive = false,
  onPet,
  framed = false,
  silhouette = false,
  testID,
}) {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const shouldAnimate = animate && !lightweight && !reducedMotion && appActive;
  const shouldLightweightBreathe = animate && lightweight && !reducedMotion && appActive && !quiet;

  const characterName =
    typeof character === 'string'
      ? character
      : character?.name ?? 'Orange Tabby';
  const characterIcon = typeof character === 'object' && character ? character.icon : undefined;

  const personality = useMemo(() => getFighterPersonality(characterName), [characterName]);
  const pivots = getFighterPivots(characterName);
  const massClass = getFighterMassClass(characterName);
  const speciesChoreography = getFighterSpeciesChoreography(characterName);
  const speciesFidget = getFighterSpeciesFidget(characterName);
  const healthState = useMemo(
    () => getFighterHealthState(health, maxHealth),
    [health, maxHealth]
  );

  const effectiveCheerReleaseMs = reaction?.releaseMs ?? cheerReleaseMs;

  const motion = useCreatureMotion(FIGHTER_MOTION, {
    name: characterName,
    size,
    mood,
    healthState,
    personality,
    pivots,
    massClass,
    speciesChoreography,
    speciesFidget,
    reaction,
    cheerReleaseMs: effectiveCheerReleaseMs,
    animate: shouldAnimate,
    stillReactions: quiet,
    // A streak makes the cheer for a Set bigger (the same hop, higher)
    reactionIntensity: cheerIntensity(streak),
    lively: !lightweight,
    interactive,
    onTap: onPet as ((reaction: FighterAvatarReactionType) => void) | undefined,
  });

  // Battery-safe GPU-only breathing for lightweight portraits (0 frame loops, gated on useAppActive + !reducedMotion)
  const lightweightBreath = useSharedValue(0);
  useEffect(() => {
    if (!shouldLightweightBreathe) {
      cancelAnimation(lightweightBreath);
      lightweightBreath.value = 0;
      return;
    }
    const phaseShare = FIGHTER_MOTION.initialPhases(characterName).breath / (Math.PI * 2);
    const halfCycleMs = Math.max(320, Math.round(personality.breathCycleMs / 2));
    const staggerMs = Math.round(phaseShare * personality.breathCycleMs);
    lightweightBreath.value = 0;
    lightweightBreath.value = withDelay(
      staggerMs,
      withRepeat(withTiming(1, { duration: halfCycleMs, easing: EASE.drift }), -1, true)
    );
    return () => {
      cancelAnimation(lightweightBreath);
    };
  }, [shouldLightweightBreathe, characterName, personality.breathCycleMs, lightweightBreath]);

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

  const expression = useMemo(() => {
    if (motion.activeReaction === 'throw' && healthState !== 'knocked_out') {
      return 'eager';
    }
    return resolveFighterExpression({
      healthState,
      mood,
      activeReaction: motion.activeReaction === 'throw' ? null : motion.activeReaction,
      isBlinking: motion.blinkStage === 2,
    });
  }, [healthState, mood, motion.activeReaction, motion.blinkStage]);

  // Preserve full 3-step organic upper-eyelid sweep (`0` open -> `1` half-lid -> `2` full shut)
  // while NEVER letting idle blinks make a fighter look drowsy mid-throw or mid-combat reaction!
  const effectiveBlinkStage: BlinkStage =
    expression === 'blink'
      ? 2
      : !motion.activeReaction && BLINKABLE_EXPRESSIONS.has(expression)
        ? motion.blinkStage
        : 0;

  const rigProps = {
    size,
    expression,
    healthState,
    blinkStage: effectiveBlinkStage,
    lidClose: motion.lidClose,
    gazeOffset: motion.gaze,
    headStyle: motion.headStyle,
    leftEarStyle: motion.leftEarStyle,
    rightEarStyle: motion.rightEarStyle,
    tailStyle: motion.tailStyle,
    pawStyle: motion.pawStyle,
    silhouette,
  };
  const Rig = getFighterCreature(characterName)?.Rig;

  const isCriticalFrame = healthState === 'critical' || healthState === 'knocked_out';
  const isStreakFrame = streak >= 3 || mood === 'streak' || mood === 'victory';
  const hasFrameHighlight = framed && (isCriticalFrame || isStreakFrame);
  const [highlightKind, setHighlightKind] = useState<'critical' | 'streak' | null>(() =>
    isCriticalFrame ? 'critical' : isStreakFrame ? 'streak' : null
  );

  // Smooth GPU-only frame state accent transition (replaces abrupt 1-frame color snap)
  const frameAccentOpacity = useSharedValue(hasFrameHighlight ? 1 : 0);
  const frameAccentScale = useSharedValue(1);
  const frameExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (frameExitTimerRef.current) {
      clearTimeout(frameExitTimerRef.current);
      frameExitTimerRef.current = null;
    }
    if (hasFrameHighlight) {
      setHighlightKind(isCriticalFrame ? 'critical' : 'streak');
      if (reducedMotion || quiet) {
        frameAccentOpacity.value = withTiming(1, {
          duration: ACCESSIBLE.fadeMs,
          easing: EASE.ui,
          ...STAYS,
        });
        frameAccentScale.value = 1;
      } else {
        frameAccentOpacity.value = withTiming(1, {
          duration: MS.quick,
          easing: EASE.state,
          ...STAYS,
        });
        frameAccentScale.value = withSequence(
          withTiming(1.03, { duration: MS.feedback, easing: EASE.popSoft }),
          withSpring(1, SPRING.snappy)
        );
      }
    } else {
      const exitDur = reducedMotion || quiet ? ACCESSIBLE.fadeMs : MODAL_MOTION.exitMs;
      // Disney #5 Exit Inversion: streak badge starts exiting first; frame border trails by 2f (32ms)
      const frameExitDelay = reducedMotion || quiet ? 0 : OVERLAP.primaryMs;
      const fadeOut = withTiming(0, {
        duration: exitDur,
        easing: EASE.exitSoft,
        ...STAYS,
      });
      frameAccentOpacity.value =
        frameExitDelay > 0 ? withDelay(frameExitDelay, fadeOut) : fadeOut;
      frameAccentScale.value = 1;
      frameExitTimerRef.current = setTimeout(() => {
        frameExitTimerRef.current = null;
        setHighlightKind(null);
      }, frameExitDelay + exitDur + 16);
    }
    return () => {
      if (frameExitTimerRef.current) {
        clearTimeout(frameExitTimerRef.current);
        frameExitTimerRef.current = null;
      }
    };
  }, [hasFrameHighlight, isCriticalFrame, reducedMotion, quiet, frameAccentOpacity, frameAccentScale]);

  const frameHighlightStyle = useAnimatedStyle(() => ({
    opacity: frameAccentOpacity.value,
    transform: [{ scale: frameAccentScale.value }],
  }));

  // Mount-until-exited animated `3x` streak pill (`MODAL_MOTION` / `EASE.popSoft` enter, `EASE.exitSoft` exit)
  const showStreakBadge = framed && streak >= 3;
  const [streakBadgeMounted, setStreakBadgeMounted] = useState(showStreakBadge);
  const [displayedStreak, setDisplayedStreak] = useState(streak);
  const prevStreakShownRef = useRef(showStreakBadge);
  const prevStreakValRef = useRef(streak);
  const badgeExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const badgeOpacity = useSharedValue(showStreakBadge ? 1 : 0);
  const badgeScale = useSharedValue(showStreakBadge ? 1 : 0.65);
  const badgeTy = useSharedValue(showStreakBadge ? 0 : 4);

  if (showStreakBadge && !streakBadgeMounted) {
    setStreakBadgeMounted(true);
  }
  if (showStreakBadge && displayedStreak !== streak) {
    setDisplayedStreak(streak);
  }

  useEffect(() => {
    if (badgeExitTimerRef.current) {
      clearTimeout(badgeExitTimerRef.current);
      badgeExitTimerRef.current = null;
    }
    const wasShown = prevStreakShownRef.current;
    const prevVal = prevStreakValRef.current;
    prevStreakShownRef.current = showStreakBadge;
    prevStreakValRef.current = streak;

    if (showStreakBadge) {
      if (!wasShown) {
        if (reducedMotion || quiet) {
          badgeScale.value = 1;
          badgeTy.value = 0;
          badgeOpacity.value = 0;
          badgeOpacity.value = withTiming(1, {
            duration: ACCESSIBLE.fadeMs,
            easing: EASE.ui,
            ...STAYS,
          });
        } else {
          // Disney #5 Overlapping Action: frame border illuminates at f0; 3x badge pops in 2f (32ms) later!
          badgeOpacity.value = 0;
          badgeScale.value = 0.62;
          badgeTy.value = 5;
          badgeOpacity.value = withDelay(
            OVERLAP.primaryMs,
            withTiming(1, {
              duration: MS.feedback,
              easing: EASE.ui,
              ...STAYS,
            })
          );
          badgeScale.value = withDelay(
            OVERLAP.primaryMs,
            withTiming(1, {
              duration: MODAL_MOTION.enterMs,
              easing: EASE.popSoft,
            })
          );
          badgeTy.value = withDelay(
            OVERLAP.primaryMs,
            withTiming(0, {
              duration: MODAL_MOTION.enterMs,
              easing: EASE.enter,
            })
          );
        }
      } else if (streak > prevVal && !reducedMotion && !quiet) {
        // Crisp micro-bump when extending an active streak (3x -> 4x -> 5x)
        badgeScale.value = withSequence(
          withTiming(SCALE.pop, { duration: MS.feedback, easing: EASE.popSoft }),
          withSpring(1, SPRING.snappy)
        );
      }
    } else if (wasShown) {
      const exitDur = reducedMotion || quiet ? ACCESSIBLE.fadeMs : MODAL_MOTION.exitMs;
      badgeOpacity.value = withTiming(0, {
        duration: exitDur,
        easing: EASE.exitSoft,
        ...STAYS,
      });
      if (!reducedMotion && !quiet) {
        badgeScale.value = withTiming(0.72, { duration: exitDur, easing: EASE.exitSoft });
        badgeTy.value = withTiming(3, { duration: exitDur, easing: EASE.exitSoft });
      }
      badgeExitTimerRef.current = setTimeout(() => {
        badgeExitTimerRef.current = null;
        setStreakBadgeMounted(false);
      }, exitDur + 16);
    }

    return () => {
      if (badgeExitTimerRef.current) {
        clearTimeout(badgeExitTimerRef.current);
        badgeExitTimerRef.current = null;
      }
    };
  }, [showStreakBadge, streak, reducedMotion, quiet, badgeOpacity, badgeScale, badgeTy]);

  useEffect(() => {
    return () => {
      cancelAnimation(frameAccentOpacity);
      cancelAnimation(frameAccentScale);
      cancelAnimation(badgeOpacity);
      cancelAnimation(badgeScale);
      cancelAnimation(badgeTy);
    };
  }, [frameAccentOpacity, frameAccentScale, badgeOpacity, badgeScale, badgeTy]);

  const streakBadgeAnimStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ translateY: badgeTy.value }, { scale: badgeScale.value }],
  }));

  const frameRadius = Math.max(10, Math.round(size * 0.24));

  return (
    <CreatureStage
      size={size}
      frame={
        framed
          ? {
              borderColor: COLORS.slateCharcoal,
              backgroundColor: COLORS.paperBeige,
            }
          : undefined
      }
      testID={testID ?? 'fighter-avatar'}
      accessibilityLabel={`${characterName} fighter (${healthState})`}
      interactive={interactive}
      onPress={motion.handlePress}
      shadow={
        lightweight || silhouette
          ? undefined
          : {
              testID: 'fighter-ground-shadow',
              minWidth: 14,
              minHeight: 4,
              style: motion.groundShadowStyle,
              penumbraStyle: motion.groundPenumbraStyle,
            }
      }
      rigRootStyle={lightweight ? lightweightRigStyle : motion.rigRootStyle}
      rig={
        <RigVisualProvider silhouette={silhouette} facing="right">
          {Rig ? <Rig {...rigProps} /> : <FallbackFighterRig {...rigProps} icon={characterIcon} />}
          {!silhouette && (
            <CreatureDamageOverlay
              healthState={healthState}
              headStyle={motion.headStyle}
              animate={shouldAnimate}
            />
          )}
        </RigVisualProvider>
      }
    >
      {/* Smooth GPU-only animated frame border accent (keeps fighter colors 100% pure & un-tinted!) */}
      {framed && highlightKind && (
        <Animated.View
          pointerEvents="none"
          testID="fighter-frame-highlight"
          style={[
            styles.frameHighlight,
            {
              borderRadius: frameRadius,
              borderColor: highlightKind === 'critical' ? COLORS.impactRed : COLORS.actionYellow,
              backgroundColor: 'transparent',
            },
            frameHighlightStyle,
          ]}
        />
      )}

      {!silhouette && !lightweight && (
        <FighterEffectsOverlay
          activeReaction={motion.activeReaction}
          reactionId={motion.reactionKey}
          mood={mood}
          personality={personality}
          size={size}
          animate={shouldAnimate}
          stillBurst={quiet}
          intensity={cheerIntensity(streak)}
          cheerReleaseMs={effectiveCheerReleaseMs}
        />
      )}

      {/* Animated streak mini-pill when framed in HUD and on a 3+ match streak */}
      {streakBadgeMounted && (
        <Animated.View
          style={[styles.streakBadge, streakBadgeAnimStyle]}
          pointerEvents="none"
          testID="fighter-streak-badge"
        >
          <Text style={styles.streakBadgeText}>{displayedStreak}x</Text>
        </Animated.View>
      )}
    </CreatureStage>
  );
});

const styles = StyleSheet.create({
  frameHighlight: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderWidth: 2.5,
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
