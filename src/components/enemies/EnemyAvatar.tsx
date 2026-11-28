import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
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
import { IconName } from '@/components/Icon';
import { CreatureDamageOverlay } from '@/components/creatures/CreatureDamageOverlay';
import { CreatureStage } from '@/components/creatures/CreatureStage';
import { CreatureScaleTier, RigVisualProvider } from '@/components/creatures/RigLayers';
import {
  CreatureMotionConfig,
  ReactionChannels,
  ReactionContext,
  useCreatureMotion,
} from '@/components/creatures/useCreatureMotion';
import type { EnemyInstance } from '@/types/enemy';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import {
  ACCESSIBLE,
  BLINK,
  CREATURE_ACTING,
  CREATURE_FX,
  EASE,
  ENEMY_ATTACK,
  ENEMY_REGEN,
  HIT,
  HitKind,
  HitTier,
  MASS_CLASS,
  MS,
  MassClass,
  OVERLAP,
  PHASE,
  SMEAR,
  SPRING,
  SQUASH_TIER,
  STAYS,
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
  EnemySpeciesClass,
  EnemyTier,
  TIER_AURA_COLORS,
  getEnemyAttackTimings,
  getEnemyHealthState,
  resolveEnemyExpression,
} from '@/utils/enemyAnimations';
import { EnemyEffectsOverlay } from './EnemyEffectsOverlay';
import { EnemyBlinkProvider } from './EnemyEyes';
import {
  ENEMY_CLIP_DURATION_MS,
  EnemySpriteRig,
  getEnemySpriteMoodTempo,
} from './EnemySpriteRig';
import { hasEnemySpriteAtlas } from './enemySpriteRegistry';
import {
  EnemyCreatureRig,
  getEnemyDefaultTier,
  getEnemyMassClass,
  getEnemyPersonality,
  getEnemyRigPivots,
  getEnemySpeciesClass,
  isBossEnemy,
} from './enemyRegistry';

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
  /** [UI-06] Scale mass tier (`'boss'` scales grounding shadow & atmospheric rim halo) */
  scaleTier?: CreatureScaleTier;
  /** [UI-07] Combat facing posture (`'left'` on battle stage, `'front'` for centered portraits) */
  facing?: 'front' | 'left';
  /** [UI-07] Render the rig in solid-black `#121212` Silhouette Audit mode */
  silhouette?: boolean;
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

/**
 * Builds a 3-step dread-tremor moving hold during a boss's extended telegraph coil
 * so massive bosses visibly quiver with pent-up energy instead of freezing dead.
 */
function buildBossCoilMovingHold(
  coilTx: number,
  coilHoldMs: number,
  strikeTx: number,
  strikeCfg: { duration: number; easing: typeof EASE.enter },
  apexHoldMs: number,
  settleSpring: SpringSpec
) {
  const stepMs = Math.max(OVERLAP.primaryMs, Math.round(coilHoldMs / 3));
  const lastStepMs = Math.max(OVERLAP.primaryMs, coilHoldMs - stepMs * 2);
  const tremor = PHASE.movingHoldTremorPx;
  return withSequence(
    withTiming(coilTx + tremor, { duration: stepMs, easing: EASE.drift }),
    withTiming(coilTx - tremor, { duration: stepMs, easing: EASE.drift }),
    withTiming(coilTx + tremor * 0.7, { duration: lastStepMs, easing: EASE.drift }),
    withTiming(strikeTx, strikeCfg),
    withDelay(apexHoldMs, withSpring(0, settleSpring))
  );
}

/** Normalizes any full-turn residual (`-360°` after `rage_spin`) to `0°` cleanly with zero visual jump. */
function normalizeResidualRotation(ch: ReactionChannels) {
  if (Math.abs(ch.bodyRotate.value) >= 180) {
    ch.bodyRotate.value = ch.bodyRotate.value % 360;
  }
}

/**
 * Species-specific reaction choreography layering `pawTx`, `pawRotate`, `headTx`, `bodySkewX`,
 * asymmetric wingbeats, Hydra out-of-phase multi-head snaps, pincer scissors, and boss slams
 * on top of `MASS_CLASS` weight kinematics.
 */
export function playEnemySpeciesReaction(
  enemyName: string,
  speciesClass: EnemySpeciesClass,
  type: EnemyReactionType,
  ch: ReactionChannels,
  size: number,
  context: ReactionContext
): boolean {
  const massClass: MassClass = context.massClass ?? 'standard';
  const mass = MASS_CLASS[massClass];
  const isBoss = massClass === 'boss';
  const isCompact = context.compact ?? size <= CREATURE_ACTING.compactSizePx;
  const rotBoost = isCompact ? CREATURE_ACTING.compactRotateBoost : 1;
  const jumpPx = Math.max(6, size * 0.16);
  const recoilPx = Math.max(5, size * 0.14);
  const recoverSpring: SpringSpec = SPRING[mass.spring];

  normalizeResidualRotation(ch);

  if (type === 'attack') {
    const { windMs, coilHoldMs, strikeMs, apexHoldMs, strikeStartMs } = getEnemyAttackTimings(massClass);
    const wind = { duration: windMs, easing: EASE.enter };
    const lunge = { duration: strikeMs, easing: EASE.enter };

    // 1. THE HYDRA — Out-of-phase sequential 3-head serpentine snap cascade!
    if (speciesClass === 'hydra') {
      const coilTx = recoilPx * ENEMY_ATTACK.windTxMult * 0.9;
      const strikeTx = recoilPx * ENEMY_ATTACK.strikeTxMult * 0.92;
      ch.bodyTx.value = withSequence(
        withTiming(coilTx, wind),
        buildBossCoilMovingHold(coilTx, coilHoldMs, strikeTx, lunge, apexHoldMs, SPRING.boss)
      );
      ch.reactionScaleY.value = withSequence(
        withTiming(SQUASH_TIER.heavy.squashY, wind),
        withTiming(SQUASH_TIER.heavy.squashY - PHASE.movingHoldScaleDelta, {
          duration: coilHoldMs,
          easing: EASE.drift,
        }),
        withTiming(1.16, lunge),
        withDelay(apexHoldMs, withSpring(1, SPRING.boss))
      );
      ch.bodyRotate.value = withSequence(
        withTiming(10 * rotBoost, wind),
        withDelay(coilHoldMs, withTiming(-14 * rotBoost, lunge)),
        withDelay(apexHoldMs, withSpring(0, SPRING.boss))
      );
      if (ch.bodySkewX) {
        ch.bodySkewX.value = withDelay(
          strikeStartMs,
          withSequence(
            withTiming(-SMEAR.strikeSkewDeg, { duration: SMEAR.durationMs, easing: EASE.enter }),
            withSpring(0, SPRING.snappy)
          )
        );
      }
      // Head 1 (front-left striker) snaps FIRST at strikeStartMs
      ch.leftEarExtra.value = withSequence(
        withTiming(20, wind),
        withDelay(coilHoldMs, withTiming(-34, lunge)),
        withDelay(apexHoldMs, withSpring(0, SPRING.loose))
      );
      // Head 2 (tall central alpha head) snaps SECOND (+OVERLAP.primaryMs = +32ms)
      ch.headRotate.value = withSequence(
        withTiming(12 * rotBoost, wind),
        withDelay(coilHoldMs + OVERLAP.primaryMs, withTiming(-24 * rotBoost, lunge)),
        withDelay(apexHoldMs, withSpring(0, SPRING.boss))
      );
      if (ch.headTx) {
        ch.headTx.value = withDelay(
          strikeStartMs + OVERLAP.primaryMs,
          withSequence(
            withTiming(-size * 0.1, lunge),
            withDelay(apexHoldMs, withSpring(0, SPRING.boss))
          )
        );
      }
      // Head 3 (upper-right coiled head) whips THIRD (+OVERLAP.secondaryMs = +64ms)
      ch.rightEarExtra.value = withSequence(
        withTiming(16, wind),
        withDelay(coilHoldMs + OVERLAP.secondaryMs, withTiming(-32, lunge)),
        withDelay(apexHoldMs, withSpring(0, SPRING.loose))
      );
      ch.tailExtra.value = withDelay(
        strikeStartMs,
        withSequence(
          withTiming(22, { duration: MS.feedback, easing: EASE.ui }),
          withSpring(0, SPRING.loose)
        )
      );
      return true;
    }

    // 2. WINGED — Aerial wing-lift gather → high-velocity diving swoop + wing downstroke!
    if (speciesClass === 'winged') {
      const coilTx = recoilPx * ENEMY_ATTACK.windTxMult;
      const strikeTx = recoilPx * ENEMY_ATTACK.strikeTxMult * (isBoss ? 0.8 : 1.05);
      ch.bodyTx.value = isBoss
        ? withSequence(
            withTiming(coilTx, wind),
            buildBossCoilMovingHold(coilTx, coilHoldMs, strikeTx, lunge, apexHoldMs, SPRING.boss)
          )
        : withSequence(
            withTiming(coilTx, wind),
            withDelay(coilHoldMs, withTiming(strikeTx, lunge)),
            withDelay(apexHoldMs, withSpring(0, recoverSpring))
          );
      ch.bodyTy.value = withSequence(
        withTiming(-jumpPx * (isBoss ? 0.55 : 0.78), wind),
        withDelay(coilHoldMs, withTiming(size * 0.04, lunge)),
        withDelay(apexHoldMs, withSpring(0, recoverSpring))
      );
      ch.reactionScaleY.value = withSequence(
        withTiming(isBoss ? SQUASH_TIER.heavy.squashY : 0.84, wind),
        withDelay(coilHoldMs, withTiming(isBoss ? 1.15 : 1.18, lunge)),
        withDelay(apexHoldMs, withSpring(1, recoverSpring))
      );
      ch.bodyRotate.value = withSequence(
        withTiming(13 * rotBoost, wind),
        withDelay(coilHoldMs, withTiming(-19 * rotBoost, lunge)),
        withDelay(apexHoldMs, withSpring(0, recoverSpring))
      );
      if (ch.bodySkewX) {
        ch.bodySkewX.value = withDelay(
          strikeStartMs,
          withSequence(
            withTiming(-SMEAR.strikeSkewDeg, { duration: SMEAR.durationMs, easing: EASE.enter }),
            withSpring(0, SPRING.snappy)
          )
        );
      }
      // Asymmetric sweeping wing upstroke on gather → powerful downstroke on dive!
      ch.leftEarExtra.value = withSequence(
        withTiming(-30, wind),
        withDelay(coilHoldMs, withTiming(34, lunge)),
        withDelay(apexHoldMs, withSpring(0, SPRING.loose))
      );
      ch.rightEarExtra.value = withSequence(
        withTiming(26, wind),
        withDelay(coilHoldMs + HIT.snapMs, withTiming(-32, lunge)),
        withDelay(apexHoldMs, withSpring(0, SPRING.loose))
      );
      ch.headRotate.value = withDelay(
        strikeStartMs,
        withSequence(
          withTiming(-14 * rotBoost, lunge),
          withDelay(apexHoldMs, withSpring(0, recoverSpring))
        )
      );
      if (ch.pawTx) {
        ch.pawTx.value = withSequence(
          withTiming(size * (isBoss ? 0.025 : 0.04), wind),
          withDelay(coilHoldMs, withTiming(-size * (isBoss ? 0.055 : 0.12), lunge)),
          withDelay(apexHoldMs, withSpring(0, recoverSpring))
        );
      }
      if (ch.pawRotate) {
        ch.pawRotate.value = withSequence(
          withTiming(isBoss ? 10 : 16, wind),
          withDelay(coilHoldMs, withTiming(isBoss ? -14 : -26, lunge)),
          withDelay(apexHoldMs, withSpring(0, recoverSpring))
        );
      }
      ch.pawBounce.value = withSequence(
        withTiming(-size * 0.05, wind),
        withDelay(coilHoldMs, withTiming(-size * 0.14, lunge)),
        withDelay(apexHoldMs, withSpring(0, recoverSpring))
      );
      return true;
    }

    // 3. PINCER — Wide claw splay → asynchronous scissor pincer clamp + scorpion stinger whip!
    if (speciesClass === 'pincer') {
      ch.bodyTx.value = withSequence(
        withTiming(recoilPx * 0.62, wind),
        withDelay(coilHoldMs, withTiming(recoilPx * -1.45, lunge)),
        withDelay(apexHoldMs, withSpring(0, SPRING.settle))
      );
      ch.reactionScaleY.value = withSequence(
        withTiming(0.84, wind),
        withDelay(coilHoldMs, withTiming(1.16, lunge)),
        withDelay(apexHoldMs, withSpring(1, SPRING.lively))
      );
      ch.bodyRotate.value = withSequence(
        withTiming(9 * rotBoost, wind),
        withDelay(coilHoldMs, withTiming(-14 * rotBoost, lunge)),
        withDelay(apexHoldMs, withSpring(0, SPRING.lively))
      );
      // Wide claw splay on gather, then left snaps shut at t0 and right snaps +32ms later (scissor snap!)
      ch.leftEarExtra.value = withSequence(
        withTiming(-28, wind),
        withDelay(coilHoldMs, withTiming(34, lunge)),
        withDelay(apexHoldMs, withSpring(0, SPRING.loose))
      );
      ch.rightEarExtra.value = withSequence(
        withTiming(28, wind),
        withDelay(coilHoldMs + OVERLAP.primaryMs, withTiming(-32, lunge)),
        withDelay(apexHoldMs, withSpring(0, SPRING.loose))
      );
      ch.tailExtra.value = withSequence(
        withTiming(18, wind),
        withDelay(coilHoldMs, withTiming(-36, lunge)),
        withDelay(apexHoldMs, withSpring(0, SPRING.loose))
      );
      if (ch.pawTx) {
        ch.pawTx.value = withDelay(
          strikeStartMs,
          withSequence(withTiming(-size * 0.12, lunge), withDelay(apexHoldMs, withSpring(0, SPRING.lively)))
        );
      }
      if (ch.pawRotate) {
        ch.pawRotate.value = withDelay(
          strikeStartMs,
          withSequence(withTiming(-22, lunge), withDelay(apexHoldMs, withSpring(0, SPRING.lively)))
        );
      }
      if (ch.bodySkewX) {
        ch.bodySkewX.value = withDelay(
          strikeStartMs,
          withSequence(
            withTiming(-SMEAR.strikeSkewDeg * 0.85, { duration: SMEAR.durationMs, easing: EASE.enter }),
            withSpring(0, SPRING.snappy)
          )
        );
      }
      return true;
    }

    // 4. BOSS TIER — Heavy anticipation lift + dread shiver + seismic stomp / scythe reap / claw slam!
    if (isBoss) {
      const isReaper = enemyName === 'The Reaper';
      const isHyenaBoss = enemyName === 'Hyena Boss';
      const coilTx = recoilPx * ENEMY_ATTACK.windTxMult * 0.9;
      // 3/4 LEFT boss silhouettes already lean left in SVG space; keep peak strike cleanly inside card border
      const strikeTx = recoilPx * ENEMY_ATTACK.strikeTxMult * (isHyenaBoss ? 0.84 : 0.78);

      ch.bodyTx.value = withSequence(
        withTiming(coilTx, wind),
        buildBossCoilMovingHold(coilTx, coilHoldMs, strikeTx, lunge, apexHoldMs, SPRING.boss)
      );
      // Heavy stomp anticipation lift → seismic downward slam (Reaper glides cleanly overhead!)
      ch.bodyTy.value = isReaper
        ? withSequence(
            withTiming(-jumpPx * 0.5, wind),
            withDelay(coilHoldMs, withTiming(-jumpPx * 0.12, lunge)),
            withDelay(apexHoldMs, withSpring(0, SPRING.boss))
          )
        : withSequence(
            withTiming(-jumpPx * 0.36, wind),
            withDelay(coilHoldMs, withTiming(size * 0.05, { duration: strikeMs, easing: EASE.impact })),
            withDelay(apexHoldMs, withSpring(0, SPRING.boss))
          );
      ch.reactionScaleY.value = withSequence(
        withTiming(SQUASH_TIER.heavy.squashY, wind),
        withTiming(SQUASH_TIER.heavy.squashY - PHASE.movingHoldScaleDelta, {
          duration: coilHoldMs,
          easing: EASE.drift,
        }),
        withTiming(isReaper ? 1.14 : 0.8, lunge),
        withDelay(apexHoldMs, withSpring(1, SPRING.boss))
      );
      ch.bodyRotate.value = withSequence(
        withTiming(11 * rotBoost, wind),
        withDelay(coilHoldMs, withTiming(-14 * rotBoost, lunge)),
        withDelay(apexHoldMs, withSpring(0, SPRING.boss))
      );
      ch.headRotate.value = withDelay(
        strikeStartMs + HIT.snapMs,
        withSequence(
          withTiming(-12 * rotBoost, lunge),
          withDelay(apexHoldMs, withSpring(0, SPRING.boss))
        )
      );
      if (ch.headTx) {
        ch.headTx.value = withDelay(
          strikeStartMs,
          withSequence(withTiming(-size * 0.028, lunge), withDelay(apexHoldMs, withSpring(0, SPRING.boss)))
        );
      }
      if (ch.bodySkewX) {
        ch.bodySkewX.value = withDelay(
          strikeStartMs,
          withSequence(
            withTiming(-SMEAR.strikeSkewDeg, { duration: SMEAR.durationMs, easing: EASE.enter }),
            withSpring(0, SPRING.snappy)
          )
        );
      }
      // Signature weapon/limb sweep via pawTx & pawRotate (calibrated to stay anchored & inside framed cards)
      if (ch.pawTx) {
        ch.pawTx.value = withSequence(
          withTiming(size * (isReaper ? 0.08 : 0.04), wind),
          withDelay(coilHoldMs, withTiming(-size * (isReaper ? 0.12 : 0.075), lunge)),
          withDelay(apexHoldMs, withSpring(0, SPRING.boss))
        );
      }
      if (ch.pawRotate) {
        ch.pawRotate.value = withSequence(
          withTiming(isReaper ? 28 : 14, wind),
          withDelay(coilHoldMs, withTiming(isReaper ? -36 : -20, lunge)),
          withDelay(apexHoldMs, withSpring(0, SPRING.boss))
        );
      }
      ch.pawBounce.value = withSequence(
        withTiming(-size * (isReaper ? 0.09 : 0.06), wind),
        withDelay(coilHoldMs, withTiming(isReaper ? size * 0.04 : -size * 0.12, lunge)),
        withDelay(apexHoldMs, withSpring(0, SPRING.boss))
      );
      ch.leftEarExtra.value = withSequence(
        withTiming(-18, wind),
        withDelay(coilHoldMs, withTiming(22, lunge)),
        withDelay(apexHoldMs, withSpring(0, SPRING.loose))
      );
      ch.rightEarExtra.value = withSequence(
        withTiming(16, wind),
        withDelay(coilHoldMs + OVERLAP.primaryMs, withTiming(-20, lunge)),
        withDelay(apexHoldMs, withSpring(0, SPRING.loose))
      );
      return true;
    }
  }

  return false;
}

/** Species-specific idle micro-fidgets paired with blinks (winged double-flutter, Hydra wave, pincer click). */
export function playEnemySpeciesFidget(
  speciesClass: EnemySpeciesClass,
  roll: number,
  ch: ReactionChannels,
  size: number
): boolean {
  if (speciesClass === 'winged' && roll < 0.58) {
    ch.leftEarExtra.value = withSequence(
      withTiming(-22, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.ui }),
      withTiming(16, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.ui }),
      withSpring(0, SPRING.loose)
    );
    ch.rightEarExtra.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(20, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.ui }),
        withTiming(-14, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.ui }),
        withSpring(0, SPRING.loose)
      )
    );
    return true;
  }

  if (speciesClass === 'hydra' && roll < 0.62) {
    ch.leftEarExtra.value = withSequence(
      withTiming(-16, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
      withSpring(0, SPRING.loose)
    );
    ch.headRotate.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(-10, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
        withSpring(0, SPRING.boss)
      )
    );
    ch.rightEarExtra.value = withDelay(
      OVERLAP.secondaryMs,
      withSequence(
        withTiming(16, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
        withSpring(0, SPRING.loose)
      )
    );
    return true;
  }

  if (speciesClass === 'pincer' && roll < 0.58) {
    ch.leftEarExtra.value = withSequence(
      withTiming(18, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.enter }),
      withSpring(0, SPRING.loose)
    );
    ch.rightEarExtra.value = withDelay(
      CREATURE_FX.fidgetDelayMs,
      withSequence(
        withTiming(-18, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.enter }),
        withSpring(0, SPRING.loose)
      )
    );
    return true;
  }

  if (speciesClass === 'boss' && roll < 0.45) {
    if (ch.pawTx) {
      ch.pawTx.value = withSequence(
        withTiming(-size * 0.04, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
        withSpring(0, SPRING.boss)
      );
    }
    ch.tailExtra.value = withSequence(
      withTiming(-14, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
      withSpring(0, SPRING.loose)
    );
    return true;
  }

  return false;
}

/** How enemies move: menacing stances, mass-scaled hitstop recoils, snap lunges, and smooth taunts. */
export const ENEMY_MOTION: CreatureMotionConfig<EnemyAmbientMood, EnemyReactionType> = {
  moodMotion: ENEMY_MOOD_MOTION,
  reactionHoldMs: {
    ...ENEMY_REACTION_HOLD_MS,
    pain: HIT.painHoldMs,
  },
  resolveReactionHoldMs: (type, context) => {
    const massClass: MassClass = context.massClass ?? 'standard';
    if (!context.atlasBakedIdle) {
      if (type === 'pain') {
        const tier: HitTier = context.hitTier ?? 0;
        const baseHold = hitstopHoldMs(tier, context.moveKind, context.chain);
        const hold =
          massClass === 'boss'
            ? Math.min(HIT.maxHoldMs, Math.round(baseHold * 1.15))
            : baseHold;
        // Release expression cleanly right as tier-scaled hitstop + spring recoil settle (`[FX-12]`)
        return HIT.painHoldMs + Math.max(0, hold - HIT.holdMs);
      }
      const base = ENEMY_REACTION_HOLD_MS[type] ?? 850;
      if (massClass === 'standard') return base;
      return Math.round(base * (massClass === 'boss' ? 1.15 : MASS_CLASS[massClass].timeMult));
    }

    // Option B 8×8 sprite-atlas enemies: align reaction holds 1:1 with clip completion
    switch (type) {
      case 'attack':
        return getEnemyAttackTimings(massClass).strikeStartMs + ENEMY_CLIP_DURATION_MS.attack;
      case 'pain':
      case 'crit_pain': {
        const tier: HitTier = context.hitTier ?? (type === 'crit_pain' ? 1 : 0);
        const baseHold = hitstopHoldMs(tier, context.moveKind, context.chain);
        const hold =
          massClass === 'boss'
            ? Math.min(HIT.maxHoldMs, Math.round(baseHold * 1.15))
            : baseHold;
        return hold + ENEMY_CLIP_DURATION_MS.hurtRecovery;
      }
      case 'taunt':
      case 'regen':
      case 'poke':
        return ENEMY_CLIP_DURATION_MS.taunt;
      case 'rage_spin':
        return CREATURE_FX.pokeStepMs + CREATURE_FX.spinMs;
      case 'entrance':
        return (
          Math.round(CREATURE_FX.entranceDropMs * MASS_CLASS[massClass].timeMult) +
          (massClass === 'boss' ? PHASE.bossApexHoldMs : CREATURE_FX.pokeStepMs) +
          ENEMY_CLIP_DURATION_MS.windup
        );
      default:
        return ENEMY_CLIP_DURATION_MS.taunt;
    }
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
    // Exact integer harmonic `2` prevents the 2π wagPhase wrap seam tick previously caused by `2.2`
    tremorFreq: 2,
    tremorAmpPx: 1.4,
    shadowOpacity: 0.2,
    shadowLiftShrinkX: 0.4,
    shadowLiftShrinkY: 0.34,
    pawTap: 0.032,
    pawTapThreshold: 1.2,
    pawTapGain: 2,
  },

  playReaction: (type, ch, size, context) => {
    const massClass: MassClass = context.massClass ?? 'standard';
    const mass = MASS_CLASS[massClass];
    const isBoss = massClass === 'boss';
    const jumpPx = Math.max(6, size * 0.16);
    const recoilPx = Math.max(5, size * 0.14);
    const isCompact = context.compact ?? size <= CREATURE_ACTING.compactSizePx;
    const rotBoost = isCompact ? CREATURE_ACTING.compactRotateBoost : 1;

    normalizeResidualRotation(ch);

    switch (type) {
      case 'pain':
      case 'crit_pain': {
        // [FX-02][FX-04][FX-06][FX-12]: 1-frame snap into variant damage pose (`throw` / `blast` / `zap`),
        // tier & mass-scaled hitstop hold with decaying micro-vibration, then mass-appropriate spring recovery.
        const tier: HitTier = context.hitTier ?? (type === 'crit_pain' ? 1 : 0);
        const hitKind: HitKind = context.hitKind ?? 'throw';
        const chainGain = 1 + HIT.chainGain * context.chain;
        const rawHold = hitstopHoldMs(tier, context.moveKind, context.chain);
        const hold = isBoss ? Math.min(HIT.maxHoldMs, Math.round(rawHold * 1.15)) : rawHold;
        const snap = { duration: HIT.snapMs, easing: EASE.enter };
        const strike = (to: number, rest: number, spring: SpringSpec) =>
          withSequence(withTiming(to, snap), withDelay(hold, withSpring(rest, spring)));

        // Heavy/boss foes resist horizontal knockback (`MASS_CLASS.boss.recoilMult = 0.65`)
        const baseRecoil =
          recoilPx * Math.min(1.85, HIT.tierRecoilMult[tier] * chainGain) * mass.recoilMult;
        const vibAmp =
          recoilPx *
          HIT.defenderVibRatio *
          HIT.defenderVibTierScale[tier] *
          (isBoss ? 0.85 : 1);
        const recoverSpring: SpringSpec = isBoss
          ? SPRING.boss
          : tier >= 2 || type === 'crit_pain'
            ? SPRING.playful
            : SPRING[mass.spring];
        const settleSpring: SpringSpec = isBoss ? SPRING.boss : SPRING.settle;

        if (hitKind === 'blast') {
          const blastLift =
            -jumpPx * HIT.blastLiftMult * (1 + tier * 0.1) * (isBoss ? 0.62 : 1);
          const vibAmpY = jumpPx * HIT.blastVibYRatio * HIT.defenderVibTierScale[tier];
          const blastRot = Math.min(
            34,
            (HIT.blastRotateMinDeg + (HIT.blastRotateMaxDeg - HIT.blastRotateMinDeg) * (tier / 3)) *
              rotBoost *
              (isBoss ? 0.72 : 1)
          );
          ch.bodyTx.value = buildHitstopVibration(baseRecoil * 1.15, vibAmp * 1.2, hold, 0, settleSpring, 1);
          ch.bodyTy.value = buildHitstopVibration(blastLift, vibAmpY, hold, 0, recoverSpring, -1);
          ch.reactionScaleY.value = withSequence(
            withTiming(Math.max(0.7, HIT.tierSquash[tier] - 0.04), snap),
            withDelay(
              hold,
              withSequence(
                withTiming(isBoss ? 1.05 : 1.08, { duration: MS.feedback, easing: EASE.enter }),
                withSpring(1, recoverSpring)
              )
            )
          );
          ch.bodyRotate.value = strike(blastRot, 0, recoverSpring);
          ch.headRotate.value = withDelay(HIT.snapMs, strike(Math.min(36, blastRot * 1.08), 0, recoverSpring));
          ch.leftEarExtra.value = strike(HIT.blastEarSplayDeg, 0, SPRING.loose);
          ch.rightEarExtra.value = strike(-HIT.blastEarSplayDeg, 0, SPRING.loose);
          ch.pawBounce.value = strike(-size * 0.1, 0, recoverSpring);
        } else if (hitKind === 'zap') {
          cancelAnimation(ch.bodyTy);
          ch.bodyTy.value = 0;
          const zapHold = Math.max(hold, HIT.holdMs);
          const zapBuzz = recoilPx * HIT.zapBuzzRatio * HIT.defenderVibTierScale[tier] * mass.recoilMult;
          ch.bodyTx.value = buildHitstopVibration(recoilPx * 0.28 * mass.recoilMult, zapBuzz, zapHold, 0, SPRING.snappy, 1);
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
          const squashTarget = Math.max(
            0.68,
            HIT.tierSquash[tier] - (chainGain - 1) * 0.14 - (isBoss ? 0.02 : 0)
          );
          const rotScale = isBoss ? 0.72 : 1;
          const bodyRot = Math.min(28, HIT.tierRotateDeg[tier] * chainGain * rotBoost * rotScale);
          const headRot = Math.min(30, HIT.tierHeadRotateDeg[tier] * chainGain * rotBoost * rotScale);
          const earDeg = HIT.tierEarSplayDeg[tier];

          ch.reactionScaleY.value = strike(squashTarget, 1, recoverSpring);
          ch.bodyTx.value = buildHitstopVibration(baseRecoil, vibAmp, hold, 0, settleSpring, 1);
          ch.bodyRotate.value = strike(bodyRot, 0, recoverSpring);
          // Head and ears trail behind torso impact (Disney #5 Follow-Through)
          ch.headRotate.value = withDelay(HIT.snapMs, strike(headRot, 0, recoverSpring));
          if (ch.headTx) {
            ch.headTx.value = withDelay(HIT.snapMs, strike(baseRecoil * 0.25, 0, recoverSpring));
          }
          if (ch.bodySkewX) {
            ch.bodySkewX.value = withSequence(
              withTiming(SMEAR.strikeSkewDeg * 0.55 * rotScale, snap),
              withDelay(Math.min(hold, SMEAR.durationMs), withSpring(0, SPRING.snappy))
            );
          }
          ch.leftEarExtra.value = withDelay(HIT.snapMs, strike(earDeg, 0, SPRING.loose));
          ch.rightEarExtra.value = withDelay(OVERLAP.primaryMs, strike(-earDeg, 0, SPRING.loose));
        }
        break;
      }

      case 'taunt': {
        const tm = mass.timeMult;
        const settle: SpringSpec = isBoss ? SPRING.boss : SPRING.playful;
        ch.reactionScaleY.value = withSequence(
          withTiming(0.86, { duration: Math.round(CREATURE_FX.tauntDipMs * tm), easing: EASE.enter }),
          withTiming(1.15, { duration: Math.round(CREATURE_FX.pokeFollowMs * tm), easing: EASE.enter }),
          withTiming(0.94, { duration: Math.round(CREATURE_FX.tauntStepMs * tm), easing: EASE.ui }),
          withTiming(1.08, { duration: Math.round(CREATURE_FX.pokeFollowMs * tm), easing: EASE.ui }),
          withSpring(1, settle)
        );
        ch.bodyTy.value = withSequence(
          withTiming(size * 0.03, { duration: Math.round(CREATURE_FX.tauntDipMs * tm), easing: EASE.enter }),
          withTiming(-jumpPx * (isBoss ? 0.58 : 0.9), { duration: Math.round(CREATURE_FX.tauntRiseMs * tm), easing: EASE.enter }),
          withTiming(0, { duration: Math.round(CREATURE_FX.tauntStepMs * tm), easing: EASE.impact }),
          withTiming(-jumpPx * (isBoss ? 0.35 : 0.55), { duration: Math.round(CREATURE_FX.pokeFollowMs * tm), easing: EASE.enter }),
          withSpring(0, settle)
        );
        ch.headRotate.value = withDelay(
          OVERLAP.primaryMs,
          withSequence(
            withTiming(-11 * rotBoost, { duration: CREATURE_FX.tauntStepMs, easing: EASE.ui }),
            withTiming(11 * rotBoost, { duration: CREATURE_FX.pokeFollowMs, easing: EASE.ui }),
            withTiming(-8 * rotBoost, { duration: CREATURE_FX.tauntStepMs, easing: EASE.ui }),
            withSpring(0, SPRING.lively)
          )
        );
        ch.pawBounce.value = withSequence(
          withTiming(-size * 0.1, { duration: CREATURE_FX.pokeFollowMs, easing: EASE.enter }),
          withTiming(0, { duration: CREATURE_FX.tauntStepMs, easing: EASE.ui }),
          withTiming(-size * 0.08, { duration: CREATURE_FX.pokeFollowMs, easing: EASE.enter }),
          withSpring(0, settle)
        );
        break;
      }

      case 'attack': {
        // [FX-10] Mass-scaled anticipation -> coiled telegraph (moving-hold dread shiver for bosses!) ->
        // 2f strike snap with velocity smear & paw jab -> apex hold -> spring follow-through!
        const { windMs, coilHoldMs, strikeMs, apexHoldMs, strikeStartMs } = getEnemyAttackTimings(massClass);
        const wind = { duration: windMs, easing: EASE.enter };
        const lunge = { duration: strikeMs, easing: EASE.enter };
        const settleSpring: SpringSpec = isBoss ? SPRING.boss : SPRING.settle;
        const bodySpring: SpringSpec = isBoss ? SPRING.boss : SPRING[mass.spring];

        const coilTx = recoilPx * ENEMY_ATTACK.windTxMult;
        const strikeTx = recoilPx * ENEMY_ATTACK.strikeTxMult;

        ch.bodyTx.value = isBoss
          ? withSequence(
              withTiming(coilTx, wind),
              buildBossCoilMovingHold(coilTx, coilHoldMs, strikeTx, lunge, apexHoldMs, SPRING.boss)
            )
          : withSequence(
              withTiming(coilTx, wind),
              withDelay(coilHoldMs, withTiming(strikeTx, lunge)),
              withDelay(apexHoldMs, withSpring(0, settleSpring))
            );
        ch.reactionScaleY.value = withSequence(
          withTiming(ENEMY_ATTACK.windScaleY, wind),
          withDelay(coilHoldMs, withTiming(ENEMY_ATTACK.strikeScaleY, lunge)),
          withDelay(apexHoldMs, withSpring(1, bodySpring))
        );
        ch.bodyRotate.value = withSequence(
          withTiming(ENEMY_ATTACK.windRotateDeg * rotBoost, wind),
          withDelay(coilHoldMs, withTiming(ENEMY_ATTACK.strikeRotateDeg * rotBoost, lunge)),
          withDelay(apexHoldMs, withSpring(0, bodySpring))
        );
        ch.headRotate.value = withDelay(
          strikeStartMs,
          withSequence(
            withTiming(ENEMY_ATTACK.strikeHeadRotateDeg * rotBoost, lunge),
            withDelay(apexHoldMs, withSpring(0, bodySpring))
          )
        );
        if (ch.bodySkewX) {
          ch.bodySkewX.value = withDelay(
            strikeStartMs,
            withSequence(
              withTiming(-SMEAR.strikeSkewDeg * 0.75, { duration: SMEAR.durationMs, easing: EASE.enter }),
              withSpring(0, SPRING.snappy)
            )
          );
        }
        ch.pawBounce.value = withSequence(
          withTiming(size * ENEMY_ATTACK.windPawRatio, wind),
          withDelay(coilHoldMs, withTiming(size * ENEMY_ATTACK.strikePawRatio, lunge)),
          withDelay(apexHoldMs, withSpring(0, bodySpring))
        );
        if (ch.pawTx) {
          ch.pawTx.value = withSequence(
            withTiming(size * 0.04, wind),
            withDelay(coilHoldMs, withTiming(-size * 0.12, lunge)),
            withDelay(apexHoldMs, withSpring(0, bodySpring))
          );
        }
        if (ch.pawRotate) {
          ch.pawRotate.value = withSequence(
            withTiming(14, wind),
            withDelay(coilHoldMs, withTiming(-24, lunge)),
            withDelay(apexHoldMs, withSpring(0, bodySpring))
          );
        }
        break;
      }

      case 'regen': {
        // [FX-10] Mass-scaled anticipation dip -> hold -> buoyant swell -> apex hold -> gentle settle!
        const tm = mass.timeMult;
        const dip = { duration: Math.round(ENEMY_REGEN.dipMs * tm), easing: EASE.enter };
        const dipHold = Math.round(ENEMY_REGEN.dipHoldMs * tm);
        const swell = { duration: Math.round(ENEMY_REGEN.swellMs * tm), easing: EASE.enterSoft };
        const apexHold = Math.round(ENEMY_REGEN.apexHoldMs * tm);
        const settle: SpringSpec = isBoss ? SPRING.boss : SPRING.settle;

        ch.bodyTy.value = withSequence(
          withTiming(size * ENEMY_REGEN.dipTyRatio, dip),
          withDelay(dipHold, withTiming(jumpPx * ENEMY_REGEN.swellLiftMult, swell)),
          withDelay(apexHold, withSpring(0, settle))
        );
        ch.reactionScaleY.value = withSequence(
          withTiming(ENEMY_REGEN.dipScaleY, dip),
          withDelay(dipHold, withTiming(ENEMY_REGEN.swellScaleY, swell)),
          withDelay(apexHold, withSpring(1, settle))
        );
        break;
      }

      case 'poke': {
        const settle: SpringSpec = isBoss ? SPRING.boss : SPRING.playful;
        ch.reactionScaleY.value = withSequence(
          withTiming(0.83, { duration: CREATURE_FX.pokeStepMs, easing: EASE.enter }),
          withTiming(1.11, { duration: CREATURE_FX.pokeFollowMs, easing: EASE.enter }),
          withSpring(1, settle)
        );
        ch.headRotate.value = withDelay(
          OVERLAP.primaryMs,
          withSequence(
            withTiming(10 * rotBoost, { duration: CREATURE_FX.pokeStepMs, easing: EASE.ui }),
            withTiming(-10 * rotBoost, { duration: CREATURE_FX.tauntStepMs, easing: EASE.ui }),
            withSpring(0, SPRING.lively)
          )
        );
        ch.tailExtra.value = withDelay(
          OVERLAP.secondaryMs,
          withSequence(
            withTiming(-20, { duration: CREATURE_FX.tauntStepMs, easing: EASE.ui }),
            withTiming(20, { duration: CREATURE_FX.tauntStepMs, easing: EASE.ui }),
            withSpring(0, SPRING.loose)
          )
        );
        break;
      }

      case 'rage_spin': {
        // 5x poke easter egg: crisp anticipation pullback -> furious 360° spin overshoot ->
        // smooth spring settle at -360° (0° mod 360°) with zero 0ms snap-pop!
        const spinSpring: SpringSpec = isBoss ? SPRING.boss : SPRING.playful;
        ch.bodyRotate.value = 0;
        ch.bodyRotate.value = withSequence(
          withTiming(18, { duration: CREATURE_FX.pokeStepMs, easing: EASE.anticipate }),
          withTiming(-376, { duration: CREATURE_FX.spinMs, easing: EASE.enter }),
          withSpring(-360, spinSpring)
        );
        ch.bodyTy.value = withSequence(
          withTiming(size * 0.045, { duration: CREATURE_FX.pokeStepMs, easing: EASE.enter }),
          withTiming(-jumpPx * (isBoss ? 0.78 : 1.15), { duration: MS.move, easing: EASE.enter }),
          withTiming(size * 0.035, { duration: MS.quick, easing: EASE.impact }),
          withSpring(0, spinSpring)
        );
        ch.reactionScaleY.value = withSequence(
          withTiming(0.84, { duration: CREATURE_FX.pokeStepMs, easing: EASE.enter }),
          withTiming(1.14, { duration: MS.move, easing: EASE.enter }),
          withTiming(0.82, { duration: MS.quick, easing: EASE.impact }),
          withSpring(1, spinSpring)
        );
        ch.headRotate.value = withDelay(
          OVERLAP.primaryMs,
          withSequence(
            withTiming(-14 * rotBoost, { duration: MS.move, easing: EASE.ui }),
            withSpring(0, SPRING.loose)
          )
        );
        ch.leftEarExtra.value = withDelay(
          OVERLAP.primaryMs,
          withSequence(
            withTiming(-24, { duration: MS.move, easing: EASE.ui }),
            withSpring(0, SPRING.loose)
          )
        );
        ch.rightEarExtra.value = withDelay(
          OVERLAP.secondaryMs,
          withSequence(
            withTiming(24, { duration: MS.move, easing: EASE.ui }),
            withSpring(0, SPRING.loose)
          )
        );
        break;
      }

      case 'entrance': {
        // Heavy mass-scaled drop-in stomp -> deep landing squash -> monumental spring rise!
        const tm = mass.timeMult;
        const dropMs = Math.round(CREATURE_FX.entranceDropMs * tm);
        const holdMs = isBoss ? PHASE.bossApexHoldMs : CREATURE_FX.pokeStepMs;
        const settleSpring: SpringSpec = isBoss ? SPRING.boss : SPRING.lively;

        ch.bodyTy.value = withSequence(
          withTiming(-jumpPx * (isBoss ? 1.05 : 0.85), { duration: 0 }),
          withTiming(size * (isBoss ? 0.065 : 0.04), { duration: dropMs, easing: EASE.impact }),
          withDelay(holdMs, withSpring(0, settleSpring))
        );
        ch.reactionScaleY.value = withSequence(
          withTiming(1.12, { duration: Math.round(dropMs * 0.7), easing: EASE.ui }),
          withTiming(isBoss ? SQUASH_TIER.heavy.squashY - 0.04 : 0.84, {
            duration: Math.max(32, Math.round(dropMs * 0.3)),
            easing: EASE.impact,
          }),
          withDelay(
            holdMs,
            withSequence(
              withTiming(isBoss ? 1.07 : 1.09, { duration: CREATURE_FX.pokeFollowMs, easing: EASE.enter }),
              withSpring(1, settleSpring)
            )
          )
        );
        ch.leftEarExtra.value = withDelay(
          dropMs,
          withSequence(
            withTiming(-20, { duration: CREATURE_FX.entranceHoldMs, easing: EASE.ui }),
            withSpring(0, SPRING.loose)
          )
        );
        ch.rightEarExtra.value = withDelay(
          dropMs + OVERLAP.primaryMs,
          withSequence(
            withTiming(20, { duration: CREATURE_FX.entranceHoldMs, easing: EASE.ui }),
            withSpring(0, SPRING.loose)
          )
        );
        if (ch.pawBounce) {
          ch.pawBounce.value = withDelay(
            dropMs,
            withSequence(
              withTiming(size * 0.04, { duration: HIT.snapMs * 2, easing: EASE.impact }),
              withSpring(0, settleSpring)
            )
          );
        }
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
  scaleTier,
  facing,
  silhouette = false,
  testID,
}) {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();

  const enemyName =
    typeof enemy === 'string'
      ? enemy
      : enemy?.name ?? 'Sparring Foe';
  const usesSpriteAtlas = hasEnemySpriteAtlas(enemyName);
  const shouldAnimate = animate && !lightweight && !reducedMotion && appActive;
  const shouldLightweightBreathe =
    animate && lightweight && !reducedMotion && appActive && !quiet && !usesSpriteAtlas;
  const explicitTier = typeof enemy === 'object' && enemy && enemy.tier ? enemy.tier : undefined;
  const rawTier = explicitTier ?? getEnemyDefaultTier(enemyName);
  const resolvedTier = Math.max(1, Math.min(4, rawTier)) as EnemyTier;

  const resolvedScaleTier: CreatureScaleTier =
    scaleTier ??
    (resolvedTier >= 4 || isBossEnemy(enemyName)
      ? 'boss'
      : resolvedTier >= 2
        ? 'elite'
        : 'standard');

  const massClass = useMemo(
    () => getEnemyMassClass(enemyName, resolvedScaleTier),
    [enemyName, resolvedScaleTier]
  );
  const speciesClass = useMemo(() => getEnemySpeciesClass(enemyName), [enemyName]);
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
  const spriteTempo = getEnemySpriteMoodTempo(effectiveMood);

  const resolvedHitKind: HitKind = reaction?.hitKind ?? reaction?.hitStyle ?? hitKind ?? 'throw';

  const speciesChoreography = useCallback(
    (
      type: EnemyReactionType,
      ch: ReactionChannels,
      s: number,
      ctx: ReactionContext
    ) => playEnemySpeciesReaction(enemyName, speciesClass, type, ch, s, ctx),
    [enemyName, speciesClass]
  );

  const speciesFidget = useCallback(
    (roll: number, ch: ReactionChannels, s: number) =>
      playEnemySpeciesFidget(speciesClass, roll, ch, s),
    [speciesClass]
  );

  const motion = useCreatureMotion(ENEMY_MOTION, {
    name: enemyName,
    size,
    mood: effectiveMood,
    healthState,
    personality,
    pivots,
    atlasBakedIdle: usesSpriteAtlas,
    spriteTempo,
    reaction,
    hitTier,
    hitKind: resolvedHitKind,
    animate: shouldAnimate,
    stillReactions: quiet,
    lively: !lightweight,
    interactive,
    onTap: onPoke as ((reaction: EnemyReactionType) => void) | undefined,
    massClass,
    speciesChoreography,
    speciesFidget,
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

  // Staggered boss KO collapse: 6f freeze -> heavy torso drop & tilt on SPRING.boss
  const bossKoDrop = useSharedValue(0);
  const prevHealthStateRef = useRef(healthState);
  useEffect(() => {
    const prev = prevHealthStateRef.current;
    prevHealthStateRef.current = healthState;
    if (massClass !== 'boss' || lightweight) {
      cancelAnimation(bossKoDrop);
      bossKoDrop.value = 0;
      return;
    }
    if (healthState === 'knocked_out' && prev !== 'knocked_out') {
      if (!shouldAnimate) {
        bossKoDrop.value = 1;
        return;
      }
      bossKoDrop.value = 0;
      bossKoDrop.value = withDelay(
        HIT.tierHoldMs[2], // 6f dramatic impact freeze (96ms) before boss collapses
        withSpring(1, SPRING.boss)
      );
    } else if (healthState !== 'knocked_out') {
      cancelAnimation(bossKoDrop);
      bossKoDrop.value = withTiming(0, { duration: MS.quick, easing: EASE.ui });
    }
  }, [healthState, massClass, lightweight, shouldAnimate, bossKoDrop]);

  useEffect(() => {
    return () => {
      cancelAnimation(bossKoDrop);
    };
  }, [bossKoDrop]);

  const bossKoStyle = useAnimatedStyle(() => {
    const k = bossKoDrop.value;
    if (k <= 0.001) return {};
    return {
      transform: [
        { translateY: k * size * 0.075 },
        { rotate: `${k * 6.5}deg` },
        { scaleY: 1 - k * 0.09 },
        { scaleX: 1 + k * 0.06 },
      ],
    };
  });

  // Smooth framed cornered-danger transition (GPU-only opacity highlight, reduced-motion safe!)
  const isCorneredFrame = healthState === 'critical' || healthState === 'knocked_out';
  const corneredFrameOpacity = useSharedValue(isCorneredFrame ? 1 : 0);
  useEffect(() => {
    if (!framed || lightweight || silhouette) {
      cancelAnimation(corneredFrameOpacity);
      corneredFrameOpacity.value = 0;
      return;
    }
    corneredFrameOpacity.value = withTiming(isCorneredFrame ? 1 : 0, {
      duration: reducedMotion ? ACCESSIBLE.fadeMs : MS.quick,
      easing: EASE.state,
      ...STAYS,
    });
    return () => {
      cancelAnimation(corneredFrameOpacity);
    };
  }, [framed, lightweight, silhouette, isCorneredFrame, reducedMotion, corneredFrameOpacity]);

  const corneredFrameStyle = useAnimatedStyle(() => ({
    opacity: corneredFrameOpacity.value * 0.22,
  }));

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
        blinkStage: motion.blinkStage,
      }),
    [healthState, effectiveMood, motion.activeReaction, motion.isBlinking, motion.blinkStage]
  );

  const resolvedFacing: 'front' | 'left' =
    facing ??
    (effectiveMood === 'menacing' || effectiveMood === 'enraged' || effectiveMood === 'cornered'
      ? 'left'
      : 'front');

  const attackTimings = useMemo(() => getEnemyAttackTimings(massClass), [massClass]);
  const entranceDropMs = Math.round(CREATURE_FX.entranceDropMs * MASS_CLASS[massClass].timeMult);

  return (
    <CreatureStage
      size={size}
      scaleTier={resolvedScaleTier}
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
        lightweight || silhouette
          ? undefined
          : {
              testID: 'enemy-ground-shadow',
              minWidth: 12,
              minHeight: 3,
              style: motion.groundShadowStyle,
              penumbraStyle: motion.groundPenumbraStyle,
            }
      }
      rigRootStyle={lightweight ? lightweightRigStyle : motion.rigRootStyle}
      rig={
        <Animated.View style={[StyleSheet.absoluteFill, massClass === 'boss' ? bossKoStyle : undefined]}>
          <RigVisualProvider
            silhouette={silhouette}
            facing={resolvedFacing}
            overheadLighting={!lightweight}
            scaleTier={resolvedScaleTier}
          >
            {usesSpriteAtlas ? (
              <EnemySpriteRig
                enemyName={enemyName}
                size={size}
                mood={effectiveMood}
                healthState={healthState}
                activeReaction={motion.activeReaction}
                reactionKey={motion.reactionKey}
                attackStrikeStartMs={attackTimings.strikeStartMs}
                massClass={massClass}
                painHitstopMs={motion.reactionHitstopMs}
                spriteClockMs={motion.spriteClockMs}
                spriteIdleSec={motion.spriteIdleSec}
                animate={animate}
                lightweight={lightweight}
                quiet={quiet}
                silhouette={silhouette}
              />
            ) : (
              <EnemyBlinkProvider blinkStage={motion.blinkStage}>
                <EnemyCreatureRig
                  enemyName={enemyName}
                  expression={expression}
                  blinkStage={motion.blinkStage}
                  healthState={healthState}
                  gazeOffset={motion.gaze}
                  facing={resolvedFacing}
                  scaleTier={resolvedScaleTier}
                  silhouette={silhouette}
                  headStyle={motion.headStyle}
                  leftEarStyle={motion.leftEarStyle}
                  rightEarStyle={motion.rightEarStyle}
                  tailStyle={motion.tailStyle}
                  pawStyle={motion.pawStyle}
                />
              </EnemyBlinkProvider>
            )}
            {!lightweight && !silhouette && (
              <CreatureDamageOverlay
                healthState={healthState}
                headStyle={usesSpriteAtlas ? undefined : motion.headStyle}
                animate={shouldAnimate}
                testID="enemy-damage-overlay"
              />
            )}
          </RigVisualProvider>
        </Animated.View>
      }
    >
      {framed && !lightweight && !silhouette && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: COLORS.impactRed,
              borderRadius: Math.max(8, Math.round(size * 0.2)),
            },
            corneredFrameStyle,
          ]}
        />
      )}
      {!lightweight && !silhouette && (
        <EnemyEffectsOverlay
          activeReaction={motion.activeReaction}
          reactionId={motion.reactionKey}
          mood={effectiveMood}
          personality={personality}
          animate={shouldAnimate}
          stillBurst={quiet}
          hideImpactStars={hideImpactStars}
          hitKind={resolvedHitKind}
          attackStrikeDelayMs={attackTimings.strikeStartMs}
          entranceLandingDelayMs={entranceDropMs}
        />
      )}
    </CreatureStage>
  );
});
