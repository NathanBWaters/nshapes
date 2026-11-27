import React from 'react';
import {
  cancelAnimation,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  CreatureJointPivots,
  CreatureMassClass,
  DEFAULT_CREATURE_PIVOTS,
  ReactionChannels,
} from '@/components/creatures/types';
import type { ReactionContext } from '@/components/creatures/useCreatureMotion';
import {
  CHEER,
  CREATURE_ACTING,
  CREATURE_FX,
  EASE,
  HIT,
  MS,
  OVERLAP,
  SMEAR,
  SPRING,
  SQUASH_TIER,
  THROW,
} from '@/utils/motion';
import {
  FighterPersonalityProfile,
  fallbackFighterPersonality,
} from '@/utils/fighterAnimations';
import type { FighterOverlayReactionType } from './FighterEffectsOverlay';
import { BadgerRig } from './creatures/BadgerRig';
import { CorgiRig } from './creatures/CorgiRig';
import { EmperorPenguinRig } from './creatures/EmperorPenguinRig';
import { OrangeTabbyRig } from './creatures/OrangeTabbyRig';
import { PelicanRig } from './creatures/PelicanRig';
import { SlyFoxRig } from './creatures/SlyFoxRig';
import { CreatureRigProps } from './creatures/types';

export type FighterSpeciesChoreography = (
  type: FighterOverlayReactionType,
  channels: ReactionChannels,
  size: number,
  context: ReactionContext
) => boolean | void;

export type FighterSpeciesFidget = (
  roll: number,
  channels: ReactionChannels,
  size: number
) => boolean | void;

/** Everything that makes one fighter look and move the way it does. */
interface FighterCreature {
  Rig: React.FC<CreatureRigProps>;
  /** Anatomical joint pivots (0..100 SVG space) the part rotations are anchored to */
  pivots: CreatureJointPivots;
  /** Physical inertia & timing weight class (`MASS_CLASS` key) */
  massClass: CreatureMassClass;
  personality: FighterPersonalityProfile;
  /** Species-specific reaction choreography (`throw`, `joy`, `ecstatic`) */
  speciesChoreography: FighterSpeciesChoreography;
  /** Species-specific idle micro-fidgets paired with natural blinks */
  speciesFidget: FighterSpeciesFidget;
}

/** Plays a crisp 1–2f directional velocity shear smear (`SMEAR.durationMs`) and snaps cleanly back to 0. */
function pulseStrikeSmear(
  ch: ReactionChannels,
  delayMs: number,
  skewDeg: number = -SMEAR.strikeSkewDeg
) {
  if (!ch.bodySkewX) return;
  ch.bodySkewX.value = withDelay(
    delayMs,
    withSequence(
      withTiming(skewDeg, { duration: HIT.snapMs, easing: EASE.enter }),
      withTiming(skewDeg * 0.45, { duration: HIT.snapMs, easing: EASE.ui }),
      withSpring(0, SPRING.snappy)
    )
  );
}

/** Shared cheer release timing helper honoring dynamic Set flight time (`[FX-23]`). */
function resolveCheerTiming(type: 'joy' | 'ecstatic', context: ReactionContext) {
  const now = type === 'ecstatic';
  const i = now ? 1 : context.intensity;
  const releaseMs = Math.max(CHEER.windMs, context.cheerReleaseMs ?? CHEER.releaseMs);
  const windMs = now ? CHEER.ecstaticWindMs : CHEER.windMs;
  const hold = now ? 0 : Math.max(0, releaseMs - CHEER.windMs);
  const followDelay = (now ? CHEER.ecstaticWindMs : releaseMs) + OVERLAP.primaryMs;
  return { now, i, releaseMs, windMs, hold, followDelay };
}

/** Light 2f launch recoil on Set-start cheers (`[FX-02]`). */
function playLaunchKickback(ch: ReactionChannels, recoilPx: number, now: boolean) {
  if (now) return;
  ch.bodyTx.value = withSequence(
    withTiming(-recoilPx * HIT.attackerRecoilRatio, { duration: HIT.snapMs, easing: EASE.enter }),
    withTiming(recoilPx * THROW.recoilReboundRatio, { duration: HIT.snapMs, easing: EASE.ui }),
    withSpring(0, SPRING.settle)
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Orange Tabby — Springy Agile Alley-Pouncer (`standard`)                 */
/* -------------------------------------------------------------------------- */

const tabbyFidget: FighterSpeciesFidget = (roll, ch, size) => {
  if (roll < 0.36) {
    // Alternating L -> R feline ear flicks (64ms overlap, zero twinning) + inquisitive head tilt
    ch.leftEarExtra.value = withSequence(
      withTiming(-15, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.enter }),
      withSpring(0, SPRING.loose)
    );
    ch.rightEarExtra.value = withDelay(
      OVERLAP.secondaryMs,
      withSequence(
        withTiming(14, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.enter }),
        withSpring(0, SPRING.loose)
      )
    );
    ch.headRotate.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(5.5, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
        withSpring(0, SPRING.settle)
      )
    );
    return true;
  }
  if (roll < 0.68) {
    // Arched cat-stretch sigh: deep front dip -> tall arched back stretch -> languid S-tail curl
    ch.reactionScaleY.value = withSequence(
      withTiming(0.92, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.drift }),
      withTiming(1.07, { duration: CREATURE_FX.fidgetBreathMs, easing: EASE.drift }),
      withSpring(1, SPRING.settle)
    );
    ch.bodyRotate.value = withSequence(
      withTiming(-4.5, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.drift }),
      withTiming(3.5, { duration: CREATURE_FX.fidgetBreathMs, easing: EASE.drift }),
      withSpring(0, SPRING.settle)
    );
    ch.tailExtra.value = withDelay(
      OVERLAP.tertiaryMs,
      withSequence(
        withTiming(18, { duration: CREATURE_FX.fidgetBreathMs, easing: EASE.drift }),
        withTiming(-10, { duration: MS.quick, easing: EASE.ui }),
        withSpring(0, SPRING.loose)
      )
    );
    if (ch.pawTx) {
      ch.pawTx.value = withSequence(
        withTiming(size * 0.05, { duration: CREATURE_FX.fidgetBreathMs, easing: EASE.drift }),
        withSpring(0, SPRING.settle)
      );
    }
    return true;
  }
  return false;
};

const tabbyChoreography: FighterSpeciesChoreography = (type, ch, size, context) => {
  const jumpPx = Math.max(6, size * 0.22);
  const recoilPx = Math.max(4, size * 0.14);
  const rotBoost = (context.compact ?? size <= CREATURE_ACTING.compactSizePx)
    ? CREATURE_ACTING.compactRotateBoost
    : 1;

  if (type === 'throw') {
    // Deep pounce-crouch coil -> high-paw diagonal swipe (`pawTx`/`pawRotate`) + 1-2f strike smear
    const wind = { duration: THROW.windMs, easing: EASE.enter };
    const lunge = { duration: THROW.lungeMs, easing: EASE.enter };
    const kick = { duration: HIT.snapMs, easing: EASE.enter };
    const rebound = { duration: HIT.snapMs, easing: EASE.ui };
    const lungeTx = size * 0.17;
    const kickOffset = recoilPx * HIT.attackerRecoilRatio;
    const lingerAfterRecoilMs = Math.max(0, THROW.holdMs - HIT.snapMs * 2);

    ch.bodyTx.value = withSequence(
      withTiming(-size * 0.09, wind),
      withTiming(lungeTx, lunge),
      withTiming(lungeTx - kickOffset, kick),
      withTiming(lungeTx + recoilPx * THROW.recoilReboundRatio, rebound),
      withDelay(lingerAfterRecoilMs, withSpring(0, SPRING.settle))
    );
    // Deep hunter crouch into springy pounce lift
    ch.bodyTy.value = withSequence(
      withTiming(size * 0.045, wind),
      withTiming(-size * 0.065, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.lively))
    );
    ch.reactionScaleY.value = withSequence(
      withTiming(0.84, wind),
      withTiming(1.18, lunge),
      withDelay(THROW.holdMs, withSpring(1, SPRING.lively))
    );
    ch.bodyRotate.value = withSequence(
      withTiming(-11 * rotBoost, wind),
      withTiming(13 * rotBoost, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.lively))
    );
    pulseStrikeSmear(ch, THROW.windMs, -SMEAR.strikeSkewDeg);

    // High-paw diagonal swipe matching `fighters-acting-sheet.png` (attached forearm range!)
    ch.pawBounce.value = withSequence(
      withTiming(size * 0.035, wind),
      withTiming(-size * 0.14, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.playful))
    );
    if (ch.pawTx) {
      ch.pawTx.value = withSequence(
        withTiming(-size * 0.06, wind),
        withTiming(size * 0.12, lunge),
        withDelay(THROW.holdMs, withSpring(0, SPRING.lively))
      );
    }
    if (ch.pawRotate) {
      ch.pawRotate.value = withSequence(
        withTiming(18, wind),
        withTiming(-34, lunge),
        withDelay(THROW.holdMs, withSpring(0, SPRING.playful))
      );
    }
    ch.headRotate.value = withDelay(
      THROW.windMs,
      withSequence(
        withTiming(9 * rotBoost, lunge),
        withDelay(THROW.holdMs, withSpring(0, SPRING.lively))
      )
    );
    if (ch.headTx) {
      ch.headTx.value = withDelay(
        THROW.windMs,
        withSequence(
          withTiming(size * 0.04, lunge),
          withDelay(THROW.holdMs, withSpring(0, SPRING.lively))
        )
      );
    }
    // High S-tail whips back as counterbalance
    ch.tailExtra.value = withSequence(
      withTiming(24, wind),
      withTiming(-24, lunge),
      withDelay(THROW.holdMs + OVERLAP.primaryMs, withSpring(0, SPRING.loose))
    );
    ch.leftEarExtra.value = withSequence(
      withTiming(14, wind),
      withTiming(-15, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.loose))
    );
    ch.rightEarExtra.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(-10, lunge),
        withDelay(THROW.holdMs, withSpring(0, SPRING.loose))
      )
    );
    return true;
  }

  if (type === 'joy' || type === 'ecstatic') {
    // Springy vertical cat-hop cheer with batting swipe paw & arched tail swirl
    const { now, i, windMs, hold, followDelay } = resolveCheerTiming(type, context);
    const wind = { duration: windMs, easing: EASE.enter };
    const rise = { duration: CHEER.riseMs, easing: EASE.enter };
    const lift = jumpPx * 0.6 * (CHEER.liftMin + (CHEER.liftMax - CHEER.liftMin) * i);
    const stretchMs = CHEER.stretchMs;
    const apexMs = CHEER.riseMs - stretchMs + CHEER.apexExtraMs;
    const toLanding = Math.max(0, CHEER.riseMs + CHEER.fallMs - stretchMs - apexMs);

    playLaunchKickback(ch, recoilPx, now);

    ch.reactionScaleY.value = withSequence(
      withTiming(0.84, wind),
      withDelay(hold, withTiming(1.13 + 0.03 * i, { duration: stretchMs, easing: EASE.enter })),
      withTiming(1, { duration: apexMs, easing: EASE.drift }),
      withDelay(toLanding, withTiming(0.86, { duration: CHEER.landHoldMs, easing: EASE.enter })),
      withDelay(CHEER.landHoldMs, withSpring(1, SPRING.playful))
    );
    ch.bodyTy.value = withSequence(
      withTiming(size * 0.05, wind),
      withDelay(hold, withTiming(-lift, rise)),
      withTiming(0, { duration: CHEER.fallMs, easing: EASE.impact })
    );
    ch.bodyRotate.value = withSequence(
      withTiming(3, wind),
      withDelay(hold, withTiming(-(6 + 4 * i), rise)),
      withSpring(0, SPRING.playful)
    );
    ch.pawBounce.value = withSequence(
      withTiming(size * 0.03, wind),
      withDelay(hold, withTiming(-size * 0.16, rise)),
      withSpring(0, SPRING.playful)
    );
    if (ch.pawTx) {
      ch.pawTx.value = withDelay(
        windMs + hold,
        withSequence(withTiming(size * 0.08, rise), withSpring(0, SPRING.lively))
      );
    }
    if (ch.pawRotate) {
      ch.pawRotate.value = withDelay(
        windMs + hold,
        withSequence(withTiming(-24, rise), withSpring(0, SPRING.playful))
      );
    }
    ch.headTy.value = withDelay(
      followDelay,
      withSequence(
        withTiming(-size * 0.035, { duration: CHEER.followMs, easing: EASE.enter }),
        withSpring(0, SPRING.lively)
      )
    );
    // Asymmetric feline ear perk (R lags L by 32ms)
    ch.leftEarExtra.value = withSequence(
      withTiming(8, wind),
      withDelay(hold, withTiming(-(16 + 6 * i), rise)),
      withSpring(0, SPRING.loose)
    );
    ch.rightEarExtra.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(-8, wind),
        withDelay(hold, withTiming(15 + 5 * i, rise)),
        withSpring(0, SPRING.loose)
      )
    );
    ch.tailExtra.value = withDelay(
      followDelay,
      withSequence(
        withTiming(26, { duration: CHEER.followMs, easing: EASE.enter }),
        withTiming(-12, { duration: MS.feedback, easing: EASE.ui }),
        withSpring(0, SPRING.loose)
      )
    );
    return true;
  }

  return false;
};

/* -------------------------------------------------------------------------- */
/* 2. Sly Fox — Low Rogue Dasher (`nimble`)                                   */
/* -------------------------------------------------------------------------- */

const foxFidget: FighterSpeciesFidget = (roll, ch, size) => {
  if (roll < 0.36) {
    // Low sly head-dip + rapid side-eye smirk + asymmetric ear tilt
    ch.headTy.value = withSequence(
      withTiming(size * 0.032, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
      withSpring(0, SPRING.snappy)
    );
    ch.headRotate.value = withSequence(
      withTiming(8.5, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.enter }),
      withDelay(CREATURE_FX.fidgetStepMs, withSpring(0, SPRING.snappy))
    );
    if (ch.headTx) {
      ch.headTx.value = withSequence(
        withTiming(size * 0.045, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.enter }),
        withDelay(CREATURE_FX.fidgetStepMs, withSpring(0, SPRING.snappy))
      );
    }
    ch.rightEarExtra.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(15, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.enter }),
        withSpring(0, SPRING.loose)
      )
    );
    return true;
  }
  if (roll < 0.7) {
    // Snappy brush flame-tail flick + low rogue shoulder lean
    ch.tailExtra.value = withSequence(
      withTiming(-24, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.enter }),
      withTiming(20, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.ui }),
      withSpring(0, SPRING.loose)
    );
    ch.bodyRotate.value = withSequence(
      withTiming(-4, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.ui }),
      withSpring(0, SPRING.snappy)
    );
    return true;
  }
  return false;
};

const foxChoreography: FighterSpeciesChoreography = (type, ch, size, context) => {
  const jumpPx = Math.max(6, size * 0.22);
  const recoilPx = Math.max(4, size * 0.14);
  const rotBoost = (context.compact ?? size <= CREATURE_ACTING.compactSizePx)
    ? CREATURE_ACTING.compactRotateBoost
    : 1;

  if (type === 'throw') {
    // Tight low horizontal rogue dart (`lungeTx x 1.25`, `bodyRotate +18°`, razor-low lift, flame-tail whip)
    const wind = { duration: THROW.windMs, easing: EASE.enter };
    const lunge = { duration: THROW.lungeMs, easing: EASE.enter };
    const kick = { duration: HIT.snapMs, easing: EASE.enter };
    const rebound = { duration: HIT.snapMs, easing: EASE.ui };
    const lungeTx = size * THROW.lungeTxRatio * 1.25;
    const kickOffset = recoilPx * HIT.attackerRecoilRatio * 0.9;
    const lingerAfterRecoilMs = Math.max(0, THROW.holdMs - HIT.snapMs * 2);

    cancelAnimation(ch.bodyTy);
    ch.bodyTy.value = withSequence(
      withTiming(size * 0.025, wind),
      withTiming(size * 0.01, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.snappy))
    );
    ch.bodyTx.value = withSequence(
      withTiming(-size * 0.1, wind),
      withTiming(lungeTx, lunge),
      withTiming(lungeTx - kickOffset, kick),
      withTiming(lungeTx + recoilPx * THROW.recoilReboundRatio, rebound),
      withDelay(lingerAfterRecoilMs, withSpring(0, SPRING.snappy))
    );
    // Razor-low streamlined crouch + horizontal velocity stretch (keeps volume solid)
    ch.reactionScaleY.value = withSequence(
      withTiming(0.88, wind),
      withTiming(0.94, lunge),
      withDelay(THROW.holdMs, withSpring(1, SPRING.snappy))
    );
    if (ch.scaleX) {
      ch.scaleX.value = withSequence(
        withTiming(0.96, wind),
        withTiming(1.11, lunge),
        withDelay(THROW.holdMs, withSpring(1, SPRING.snappy))
      );
    }
    ch.bodyRotate.value = withSequence(
      withTiming(-9 * rotBoost, wind),
      withTiming(18 * rotBoost, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.snappy))
    );
    pulseStrikeSmear(ch, THROW.windMs, -SMEAR.strikeSkewDeg * 1.05);

    ch.headRotate.value = withDelay(
      THROW.windMs,
      withSequence(
        withTiming(10 * rotBoost, lunge),
        withDelay(THROW.holdMs, withSpring(0, SPRING.snappy))
      )
    );
    if (ch.headTx) {
      ch.headTx.value = withDelay(
        THROW.windMs,
        withSequence(
          withTiming(size * 0.045, lunge),
          withDelay(THROW.holdMs, withSpring(0, SPRING.snappy))
        )
      );
    }
    // Keep stealth paws tightly tucked & anatomically anchored under the darting chest!
    ch.pawBounce.value = withDelay(
      THROW.windMs,
      withSequence(
        withTiming(-size * 0.04, lunge),
        withDelay(THROW.holdMs, withSpring(0, SPRING.snappy))
      )
    );
    if (ch.pawTx) {
      ch.pawTx.value = withDelay(
        THROW.windMs,
        withSequence(
          withTiming(size * 0.055, lunge),
          withDelay(THROW.holdMs, withSpring(0, SPRING.snappy))
        )
      );
    }
    if (ch.pawRotate) {
      ch.pawRotate.value = withDelay(
        THROW.windMs,
        withSequence(
          withTiming(-8, lunge),
          withDelay(THROW.holdMs, withSpring(0, SPRING.snappy))
        )
      );
    }
    // Sweeping oversized flame-tail whips dramatically behind!
    ch.tailExtra.value = withSequence(
      withTiming(22, wind),
      withTiming(-34, lunge),
      withDelay(THROW.holdMs + OVERLAP.primaryMs, withSpring(0, SPRING.loose))
    );
    // Ears pin sleekly back in aero dash
    ch.leftEarExtra.value = withSequence(
      withTiming(18, wind),
      withTiming(-20, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.loose))
    );
    ch.rightEarExtra.value = withSequence(
      withTiming(-14, wind),
      withTiming(-18, lunge),
      withDelay(THROW.holdMs + OVERLAP.primaryMs, withSpring(0, SPRING.loose))
    );
    return true;
  }

  if (type === 'joy' || type === 'ecstatic') {
    // Cocky tilt-wink rogue hop: crisp nimble dip -> rakish tilt + flame-tail flourish
    const { now, i, windMs, hold, followDelay } = resolveCheerTiming(type, context);
    const wind = { duration: windMs, easing: EASE.enter };
    const riseMs = Math.round(CHEER.riseMs * 0.86);
    const fallMs = Math.round(CHEER.fallMs * 0.86);
    const rise = { duration: riseMs, easing: EASE.enter };
    const lift = jumpPx * 0.68 * (CHEER.liftMin + (CHEER.liftMax - CHEER.liftMin) * i);

    playLaunchKickback(ch, recoilPx, now);

    ch.reactionScaleY.value = withSequence(
      withTiming(0.86, wind),
      withDelay(hold, withTiming(1.16, { duration: CHEER.stretchMs, easing: EASE.enter })),
      withTiming(0.9, { duration: fallMs, easing: EASE.impact }),
      withDelay(CHEER.landHoldMs, withSpring(1, SPRING.snappy))
    );
    ch.bodyTy.value = withSequence(
      withTiming(size * 0.035, wind),
      withDelay(hold, withTiming(-lift, rise)),
      withTiming(0, { duration: fallMs, easing: EASE.impact })
    );
    ch.bodyRotate.value = withSequence(
      withTiming(4, wind),
      withDelay(hold, withTiming(-(10 + 3 * i), rise)),
      withSpring(0, SPRING.lively)
    );
    ch.headRotate.value = withDelay(
      followDelay,
      withSequence(
        withTiming(13, { duration: CHEER.followMs, easing: EASE.popSoft }),
        withSpring(0, SPRING.lively)
      )
    );
    ch.pawBounce.value = withSequence(
      withTiming(size * 0.015, wind),
      withDelay(hold, withTiming(-size * 0.12, rise)),
      withSpring(0, SPRING.snappy)
    );
    if (ch.pawTx) {
      ch.pawTx.value = withDelay(
        windMs + hold,
        withSequence(withTiming(size * 0.09, rise), withSpring(0, SPRING.snappy))
      );
    }
    // Asymmetric sly ear flick (left perks wide, right cocks cheeky)
    ch.leftEarExtra.value = withSequence(
      withTiming(10, wind),
      withDelay(hold, withTiming(-19, rise)),
      withSpring(0, SPRING.loose)
    );
    ch.rightEarExtra.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(-5, wind),
        withDelay(hold, withTiming(9, rise)),
        withSpring(0, SPRING.loose)
      )
    );
    ch.tailExtra.value = withDelay(
      followDelay,
      withSequence(
        withTiming(28, { duration: MS.feedback, easing: EASE.enter }),
        withTiming(-18, { duration: MS.feedback, easing: EASE.ui }),
        withSpring(0, SPRING.loose)
      )
    );
    return true;
  }

  return false;
};

/* -------------------------------------------------------------------------- */
/* 3. Badger — Grounded Heavy Boxing Brawler (`heavy`)                        */
/* -------------------------------------------------------------------------- */

const badgerFidget: FighterSpeciesFidget = (roll, ch, size) => {
  if (roll < 0.44) {
    // Rhythmic boxer shoulder-weave guard bob (L -> R -> settle)
    const step = { duration: CREATURE_FX.fidgetStepMs, easing: EASE.drift };
    ch.bodyRotate.value = withSequence(
      withTiming(-4.5, step),
      withTiming(4.5, step),
      withSpring(0, SPRING.settle)
    );
    ch.bodyTx.value = withSequence(
      withTiming(-size * 0.028, step),
      withTiming(size * 0.028, step),
      withSpring(0, SPRING.settle)
    );
    ch.pawBounce.value = withSequence(
      withTiming(-size * 0.055, step),
      withTiming(size * 0.02, step),
      withTiming(-size * 0.05, step),
      withSpring(0, SPRING.settle)
    );
    if (ch.pawTx) {
      ch.pawTx.value = withSequence(
        withTiming(-size * 0.04, step),
        withTiming(size * 0.06, step),
        withSpring(0, SPRING.settle)
      );
    }
    if (ch.pawRotate) {
      ch.pawRotate.value = withSequence(
        withTiming(-10, step),
        withTiming(12, step),
        withSpring(0, SPRING.settle)
      );
    }
    return true;
  }
  if (roll < 0.7) {
    // Heavy knuckle-guard tighten
    ch.reactionScaleY.value = withSequence(
      withTiming(0.93, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
      withSpring(1, SPRING.heavy)
    );
    ch.pawBounce.value = withSequence(
      withTiming(-size * 0.07, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.enter }),
      withSpring(0, SPRING.settle)
    );
    return true;
  }
  return false;
};

const badgerChoreography: FighterSpeciesChoreography = (type, ch, size, context) => {
  const jumpPx = Math.max(6, size * 0.22);
  const recoilPx = Math.max(4, size * 0.14);
  const rotBoost = (context.compact ?? size <= CREATURE_ACTING.compactSizePx)
    ? CREATURE_ACTING.compactRotateBoost
    : 1;

  if (type === 'throw') {
    // Heavy rear uppercut cock-back -> thunderous haymaker cross jab (anatomically attached forearm range + higher recoil)
    const windMs = HIT.snapMs * 3; // Weighty 3f cock-back within 33% startup cap
    const wind = { duration: windMs, easing: EASE.enter };
    const lunge = { duration: THROW.lungeMs, easing: EASE.enter };
    const kick = { duration: HIT.snapMs, easing: EASE.enter };
    const rebound = { duration: HIT.snapMs * 2, easing: EASE.ui };
    const lungeTx = size * 0.17;
    const heavyKickOffset = recoilPx * HIT.attackerRecoilRatio * 1.5;
    const holdMs = THROW.holdMs + HIT.snapMs;
    const lingerAfterRecoilMs = Math.max(0, holdMs - HIT.snapMs * 3);

    // Feet stay PLANTED like a heavyweight brawler (slight stomp gather on wind-up)
    ch.bodyTy.value = withSequence(
      withTiming(size * 0.035, wind),
      withTiming(0, lunge),
      withSpring(0, SPRING.heavy)
    );
    ch.bodyTx.value = withSequence(
      withTiming(-size * 0.1, wind),
      withTiming(lungeTx, lunge),
      withTiming(lungeTx - heavyKickOffset, kick),
      withTiming(lungeTx + recoilPx * 0.06, rebound),
      withDelay(lingerAfterRecoilMs, withSpring(0, SPRING.heavy))
    );
    // Heavy compression (0.80), modest dense stretch (1.09 per SQUASH_TIER.heavy)
    ch.reactionScaleY.value = withSequence(
      withTiming(0.8, wind),
      withTiming(SQUASH_TIER.heavy.stretchY, lunge),
      withDelay(holdMs, withSpring(1, SPRING.heavy))
    );
    ch.bodyRotate.value = withSequence(
      withTiming(-12 * rotBoost, wind),
      withTiming(17 * rotBoost, lunge),
      withDelay(holdMs, withSpring(0, SPRING.settle))
    );
    pulseStrikeSmear(ch, windMs, -SMEAR.strikeSkewDeg);

    // Rear uppercut cock-back -> heavy haymaker cross jab on `paws` (grounded attached range!)
    ch.pawBounce.value = withSequence(
      withTiming(size * 0.04, wind),
      withTiming(-size * 0.09, lunge),
      withDelay(holdMs, withSpring(0, SPRING.settle))
    );
    if (ch.pawTx) {
      ch.pawTx.value = withSequence(
        withTiming(-size * 0.08, wind),
        withTiming(size * 0.13, lunge),
        withTiming(size * 0.1, kick),
        withDelay(holdMs, withSpring(0, SPRING.heavy))
      );
    }
    if (ch.pawRotate) {
      ch.pawRotate.value = withSequence(
        withTiming(18, wind),
        withTiming(-20, lunge),
        withDelay(holdMs, withSpring(0, SPRING.settle))
      );
    }
    ch.headRotate.value = withSequence(
      withTiming(-6 * rotBoost, wind),
      withTiming(9 * rotBoost, lunge),
      withDelay(holdMs, withSpring(0, SPRING.settle))
    );
    if (ch.headTx) {
      ch.headTx.value = withSequence(
        withTiming(-size * 0.03, wind),
        withTiming(size * 0.045, lunge),
        withDelay(holdMs, withSpring(0, SPRING.settle))
      );
    }
    ch.leftEarExtra.value = withSequence(
      withTiming(10, wind),
      withTiming(-12, lunge),
      withDelay(holdMs, withSpring(0, SPRING.settle))
    );
    ch.rightEarExtra.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(10, lunge),
        withDelay(holdMs, withSpring(0, SPRING.settle))
      )
    );
    return true;
  }

  if (type === 'joy' || type === 'ecstatic') {
    // Low grounded fist-pump stomp (NEVER an airy leap!)
    const { now, i, windMs, hold, followDelay } = resolveCheerTiming(type, context);
    const wind = { duration: windMs, easing: EASE.enter };
    const riseMs = Math.round(CHEER.riseMs * 0.8);
    const fallMs = Math.round(CHEER.fallMs * 0.78);
    const rise = { duration: riseMs, easing: EASE.enter };
    // Heavy grounded stomp: <45% of standard hop height!
    const lowStompLift = jumpPx * 0.44 * (CHEER.liftMin + (CHEER.liftMax - CHEER.liftMin) * i);

    playLaunchKickback(ch, recoilPx * 1.15, now);

    ch.reactionScaleY.value = withSequence(
      withTiming(SQUASH_TIER.heavy.squashY, wind),
      withDelay(hold, withTiming(SQUASH_TIER.heavy.stretchY, { duration: riseMs, easing: EASE.enter })),
      withTiming(0.8, { duration: fallMs, easing: EASE.impact }),
      withDelay(SQUASH_TIER.heavy.holdMs, withSpring(1, SPRING.heavy))
    );
    // Low hop -> THUDDING stomp push into ground shadow (+0.045*size) -> settle
    ch.bodyTy.value = withSequence(
      withTiming(size * 0.035, wind),
      withDelay(hold, withTiming(-lowStompLift, rise)),
      withTiming(size * 0.045, { duration: fallMs, easing: EASE.impact }),
      withDelay(SQUASH_TIER.heavy.holdMs, withSpring(0, SPRING.heavy))
    );
    ch.bodyRotate.value = withSequence(
      withTiming(-5, wind),
      withDelay(hold, withTiming(5 + 2 * i, rise)),
      withSpring(0, SPRING.settle)
    );
    // Both boxing fists pump high into victory uppercut!
    ch.pawBounce.value = withSequence(
      withTiming(size * 0.05, wind),
      withDelay(hold, withTiming(-size * 0.24, rise)),
      withDelay(SQUASH_TIER.heavy.holdMs, withSpring(0, SPRING.settle))
    );
    if (ch.pawTx) {
      ch.pawTx.value = withDelay(
        windMs + hold,
        withSequence(withTiming(size * 0.09, rise), withSpring(0, SPRING.settle))
      );
    }
    if (ch.pawRotate) {
      ch.pawRotate.value = withDelay(
        windMs + hold,
        withSequence(withTiming(-22, rise), withSpring(0, SPRING.settle))
      );
    }
    ch.headRotate.value = withDelay(
      followDelay,
      withSequence(
        withTiming(-7, { duration: CHEER.followMs, easing: EASE.enter }),
        withSpring(0, SPRING.settle)
      )
    );
    ch.tailExtra.value = withDelay(
      followDelay,
      withSequence(withTiming(14, { duration: MS.feedback, easing: EASE.ui }), withSpring(0, SPRING.settle))
    );
    return true;
  }

  return false;
};

/* -------------------------------------------------------------------------- */
/* 4. Corgi — Hyper-Peppy Bouncy Loaf Gremlin (`nimble`)                      */
/* -------------------------------------------------------------------------- */

const corgiFidget: FighterSpeciesFidget = (roll, ch, size) => {
  if (roll < 0.42) {
    // Independent asymmetric radar-ear swivels (±18°) + curious head tilt
    ch.leftEarExtra.value = withSequence(
      withTiming(-18, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.popSoft }),
      withTiming(9, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
      withSpring(0, SPRING.loose)
    );
    ch.rightEarExtra.value = withDelay(
      OVERLAP.secondaryMs,
      withSequence(
        withTiming(18, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.popSoft }),
        withTiming(-10, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
        withSpring(0, SPRING.loose)
      )
    );
    ch.headRotate.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(7.5, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
        withSpring(0, SPRING.playful)
      )
    );
    return true;
  }
  if (roll < 0.74) {
    // Excited double paw-patter (tippy-taps!) + hyper nub-tail blur
    const tap = { duration: CREATURE_FX.fidgetFastMs, easing: EASE.enter };
    ch.pawBounce.value = withSequence(
      withTiming(-size * 0.08, tap),
      withTiming(0, tap),
      withTiming(-size * 0.09, tap),
      withSpring(0, SPRING.playful)
    );
    if (ch.pawRotate) {
      ch.pawRotate.value = withSequence(
        withTiming(-12, tap),
        withTiming(12, tap),
        withTiming(-10, tap),
        withSpring(0, SPRING.playful)
      );
    }
    ch.tailExtra.value = withSequence(
      withTiming(28, { duration: OVERLAP.uiContentMs, easing: EASE.ui }),
      withTiming(-28, { duration: OVERLAP.uiContentMs, easing: EASE.ui }),
      withTiming(24, { duration: OVERLAP.uiContentMs, easing: EASE.ui }),
      withSpring(0, SPRING.loose)
    );
    return true;
  }
  return false;
};

const corgiChoreography: FighterSpeciesChoreography = (type, ch, size, context) => {
  const jumpPx = Math.max(6, size * 0.22);
  const recoilPx = Math.max(4, size * 0.14);
  const rotBoost = (context.compact ?? size <= CREATURE_ACTING.compactSizePx)
    ? CREATURE_ACTING.compactRotateBoost
    : 1;

  if (type === 'throw') {
    // Peppy wiggly loaf crouch -> exuberant bounding sprint launch + splayed radar ears
    const wind = { duration: THROW.windMs, easing: EASE.enter };
    const lunge = { duration: THROW.lungeMs, easing: EASE.enter };
    const kick = { duration: HIT.snapMs, easing: EASE.enter };
    const rebound = { duration: HIT.snapMs, easing: EASE.ui };
    const lungeTx = size * 0.18;
    const kickOffset = recoilPx * HIT.attackerRecoilRatio;
    const lingerAfterRecoilMs = Math.max(0, THROW.holdMs - HIT.snapMs * 2);

    ch.bodyTx.value = withSequence(
      withTiming(-size * 0.09, wind),
      withTiming(lungeTx, lunge),
      withTiming(lungeTx - kickOffset, kick),
      withTiming(lungeTx + recoilPx * THROW.recoilReboundRatio, rebound),
      withDelay(lingerAfterRecoilMs, withSpring(0, SPRING.playful))
    );
    ch.bodyTy.value = withSequence(
      withTiming(size * 0.04, wind),
      withTiming(-size * 0.08, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.playful))
    );
    ch.reactionScaleY.value = withSequence(
      withTiming(0.81, wind),
      withTiming(1.2, lunge),
      withDelay(THROW.holdMs, withSpring(1, SPRING.playful))
    );
    ch.bodyRotate.value = withSequence(
      withTiming(-10 * rotBoost, wind),
      withTiming(14 * rotBoost, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.playful))
    );
    pulseStrikeSmear(ch, THROW.windMs, -SMEAR.strikeSkewDeg * 0.9);

    ch.pawBounce.value = withSequence(
      withTiming(size * 0.03, wind),
      withTiming(-size * 0.12, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.playful))
    );
    if (ch.pawTx) {
      ch.pawTx.value = withDelay(
        THROW.windMs,
        withSequence(withTiming(size * 0.15, lunge), withDelay(THROW.holdMs, withSpring(0, SPRING.playful)))
      );
    }
    if (ch.pawRotate) {
      ch.pawRotate.value = withDelay(
        THROW.windMs,
        withSequence(withTiming(-20, lunge), withDelay(THROW.holdMs, withSpring(0, SPRING.playful)))
      );
    }
    // Giant radar ears splay asymmetrically + frantic nub wag
    ch.leftEarExtra.value = withSequence(
      withTiming(16, wind),
      withTiming(-22, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.loose))
    );
    ch.rightEarExtra.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(withTiming(22, lunge), withDelay(THROW.holdMs, withSpring(0, SPRING.loose)))
    );
    ch.tailExtra.value = withSequence(
      withTiming(32, { duration: OVERLAP.uiContentMs, easing: EASE.ui }),
      withTiming(-32, { duration: OVERLAP.uiContentMs, easing: EASE.ui }),
      withTiming(26, { duration: OVERLAP.uiContentMs, easing: EASE.ui }),
      withSpring(0, SPRING.loose)
    );
    return true;
  }

  if (type === 'joy' || type === 'ecstatic') {
    // Butt-wiggle anticipation crouch -> exuberant zoomie sploot bounce + frantic nub-tail blur!
    const { now, i, windMs, hold, followDelay } = resolveCheerTiming(type, context);
    const wiggleStepMs = OVERLAP.primaryMs;
    const wiggleCount = now ? 2 : Math.max(2, Math.min(4, Math.floor((windMs + hold) / wiggleStepMs)));
    const wiggleTotalMs = now ? wiggleStepMs * 2 : windMs + hold;
    const crouchLaunchDelay = Math.max(0, wiggleTotalMs - wiggleStepMs);
    const rise = { duration: CHEER.riseMs, easing: EASE.enter };
    const lift = jumpPx * 0.54 * (CHEER.liftMin + (CHEER.liftMax - CHEER.liftMin) * i);
    const stretchMs = CHEER.stretchMs;
    const apexMs = CHEER.riseMs - stretchMs + CHEER.apexExtraMs;
    const toLanding = Math.max(0, CHEER.riseMs + CHEER.fallMs - stretchMs - apexMs);

    playLaunchKickback(ch, recoilPx, now);

    // Plush deep crouch (0.78 per SQUASH_TIER.playful) -> crisp frame-safe zoomie stretch (1.14) -> plush landing
    ch.reactionScaleY.value = withSequence(
      withTiming(SQUASH_TIER.playful.squashY, { duration: wiggleStepMs, easing: EASE.enter }),
      withDelay(
        crouchLaunchDelay,
        withTiming(1.14, { duration: stretchMs, easing: EASE.enter })
      ),
      withTiming(1, { duration: apexMs, easing: EASE.drift }),
      withDelay(toLanding, withTiming(0.8, { duration: CHEER.landHoldMs, easing: EASE.enter })),
      withDelay(SQUASH_TIER.playful.holdMs, withSpring(1, SPRING.playful))
    );
    ch.bodyTy.value = withSequence(
      withTiming(size * 0.055, { duration: wiggleStepMs, easing: EASE.enter }),
      withDelay(crouchLaunchDelay, withTiming(-lift, rise)),
      withTiming(0, { duration: CHEER.fallMs, easing: EASE.impact })
    );
    // Playful butt-wiggle during anticipation crouch -> joyful zoomie tilt in midair!
    const wiggleSteps = [];
    for (let w = 0; w < wiggleCount; w++) {
      wiggleSteps.push(
        withTiming(w % 2 === 0 ? -7 : 7, { duration: wiggleStepMs, easing: EASE.ui })
      );
    }
    ch.bodyRotate.value = withSequence(
      ...wiggleSteps,
      withTiming(-(9 + 4 * i), rise),
      withSpring(0, SPRING.playful)
    );
    // Midair zoomie sploot paws!
    ch.pawBounce.value = withSequence(
      withTiming(size * 0.03, { duration: wiggleStepMs, easing: EASE.enter }),
      withDelay(crouchLaunchDelay, withTiming(-size * 0.14, rise)),
      withSpring(0, SPRING.playful)
    );
    if (ch.pawTx) {
      ch.pawTx.value = withDelay(
        wiggleTotalMs,
        withSequence(withTiming(size * 0.12, rise), withSpring(0, SPRING.playful))
      );
    }
    if (ch.pawRotate) {
      ch.pawRotate.value = withDelay(
        wiggleTotalMs,
        withSequence(withTiming(-18, rise), withSpring(0, SPRING.playful))
      );
    }
    // Giant asymmetric radar-ear flop!
    ch.leftEarExtra.value = withSequence(
      withTiming(12, { duration: wiggleStepMs, easing: EASE.ui }),
      withDelay(crouchLaunchDelay, withTiming(-(22 + 5 * i), rise)),
      withSpring(0, SPRING.loose)
    );
    ch.rightEarExtra.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(-12, { duration: wiggleStepMs, easing: EASE.ui }),
        withDelay(crouchLaunchDelay, withTiming(24 + 5 * i, rise)),
        withSpring(0, SPRING.loose)
      )
    );
    ch.headRotate.value = withDelay(
      followDelay,
      withSequence(
        withTiming(-10, { duration: CHEER.followMs, easing: EASE.popSoft }),
        withSpring(0, SPRING.playful)
      )
    );
    // Frantic Corgi nub-tail blur!
    ch.tailExtra.value = withSequence(
      withTiming(36, { duration: OVERLAP.uiContentMs, easing: EASE.ui }),
      withTiming(-36, { duration: OVERLAP.uiContentMs, easing: EASE.ui }),
      withTiming(34, { duration: OVERLAP.uiContentMs, easing: EASE.ui }),
      withTiming(-32, { duration: OVERLAP.uiContentMs, easing: EASE.ui }),
      withTiming(26, { duration: OVERLAP.uiContentMs, easing: EASE.ui }),
      withSpring(0, SPRING.loose)
    );
    return true;
  }

  return false;
};

/* -------------------------------------------------------------------------- */
/* 5. Emperor Penguin — Regal Mystic Spellcaster (`standard` regal)           */
/* -------------------------------------------------------------------------- */

const penguinFidget: FighterSpeciesFidget = (roll, ch, size) => {
  if (roll < 0.4) {
    // Noble chin-lift + crisp regal flipper fold
    ch.headRotate.value = withSequence(
      withTiming(-7.5, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.drift }),
      withDelay(CREATURE_FX.fidgetStepMs, withSpring(0, SPRING.settle))
    );
    ch.headTy.value = withSequence(
      withTiming(-size * 0.028, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.drift }),
      withDelay(CREATURE_FX.fidgetStepMs, withSpring(0, SPRING.settle))
    );
    ch.reactionScaleY.value = withSequence(
      withTiming(1.045, { duration: CREATURE_FX.fidgetBreathMs, easing: EASE.drift }),
      withSpring(1, SPRING.settle)
    );
    // Crisp staggered flipper fold (L trailing, R casting)
    ch.leftEarExtra.value = withSequence(
      withTiming(14, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
      withSpring(0, SPRING.settle)
    );
    ch.rightEarExtra.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(-16, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
        withSpring(0, SPRING.settle)
      )
    );
    return true;
  }
  if (roll < 0.72) {
    // Slow mystic halo orbital bob + dignified royal waddle
    ch.tailExtra.value = withSequence(
      withTiming(18, { duration: CREATURE_FX.fidgetBreathMs, easing: EASE.drift }),
      withTiming(-16, { duration: CREATURE_FX.fidgetBreathMs, easing: EASE.drift }),
      withSpring(0, SPRING.settle)
    );
    ch.bodyRotate.value = withSequence(
      withTiming(-3.2, { duration: CREATURE_FX.fidgetBreathMs, easing: EASE.drift }),
      withTiming(3.2, { duration: CREATURE_FX.fidgetBreathMs, easing: EASE.drift }),
      withSpring(0, SPRING.settle)
    );
    return true;
  }
  return false;
};

const penguinChoreography: FighterSpeciesChoreography = (type, ch, size, context) => {
  const jumpPx = Math.max(6, size * 0.22);
  const recoilPx = Math.max(4, size * 0.14);
  const rotBoost = (context.compact ?? size <= CREATURE_ACTING.compactSizePx)
    ? CREATURE_ACTING.compactRotateBoost
    : 1;

  if (type === 'throw') {
    // Tall upright wand/flipper sweep (`scaleY: 1.06`, NO hunch!) -> sweeping casting arc & halo flare
    const wind = { duration: THROW.windMs, easing: EASE.enter };
    const lunge = { duration: THROW.lungeMs, easing: EASE.enter };
    const kick = { duration: HIT.snapMs, easing: EASE.enter };
    const rebound = { duration: HIT.snapMs, easing: EASE.ui };
    const lungeTx = size * 0.1; // Dignified poised advance (distinct from Fox's dart!)
    const kickOffset = recoilPx * HIT.attackerRecoilRatio * 0.7;
    const lingerAfterRecoilMs = Math.max(0, THROW.holdMs - HIT.snapMs * 2);

    ch.bodyTx.value = withSequence(
      withTiming(-size * 0.045, wind),
      withTiming(lungeTx, lunge),
      withTiming(lungeTx - kickOffset, kick),
      withTiming(lungeTx + recoilPx * 0.04, rebound),
      withDelay(lingerAfterRecoilMs, withSpring(0, SPRING.settle))
    );
    ch.bodyTy.value = withSequence(
      withTiming(-size * 0.02, wind),
      withTiming(-size * 0.045, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.settle))
    );
    // Draws up TALL and regal (`scaleY: 1.06` -> `1.12`) instead of hunching down!
    ch.reactionScaleY.value = withSequence(
      withTiming(1.06, wind),
      withTiming(1.12, lunge),
      withDelay(THROW.holdMs, withSpring(1, SPRING.settle))
    );
    ch.bodyRotate.value = withSequence(
      withTiming(-4 * rotBoost, wind),
      withTiming(6 * rotBoost, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.settle))
    );
    ch.headRotate.value = withSequence(
      withTiming(-7 * rotBoost, wind),
      withTiming(4 * rotBoost, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.settle))
    );
    // Lead casting flipper (rightEarStyle) lifts high (`-34°` CCW = UP), then sweeps gracefully down-forward (`+24°`)!
    ch.rightEarExtra.value = withSequence(
      withTiming(-34, wind),
      withTiming(24, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.settle))
    );
    // Trailing left flipper (leftEarStyle) balances back (`-12°`) then sweeps up (`+22°` CW = UP)
    ch.leftEarExtra.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(22, lunge),
        withDelay(THROW.holdMs, withSpring(0, SPRING.settle))
      )
    );
    // Mystic oracle halo (tailStyle) charges back then flares in a sweeping orbital arc!
    ch.tailExtra.value = withSequence(
      withTiming(-24, wind),
      withTiming(42, lunge),
      withDelay(THROW.holdMs + OVERLAP.primaryMs, withSpring(0, SPRING.settle))
    );
    ch.pawBounce.value = withDelay(
      THROW.windMs,
      withSequence(
        withTiming(-size * 0.04, lunge),
        withDelay(THROW.holdMs, withSpring(0, SPRING.settle))
      )
    );
    return true;
  }

  if (type === 'joy' || type === 'ecstatic') {
    // Dignified regal bow-bob cheer with sweeping flippers & mystic halo flare (`SPRING.settle`)
    const { now, i, windMs, hold, followDelay } = resolveCheerTiming(type, context);
    const wind = { duration: windMs, easing: EASE.enter };
    const rise = { duration: CHEER.riseMs, easing: EASE.enterSoft };
    const lift = jumpPx * 0.72 * (CHEER.liftMin + (CHEER.liftMax - CHEER.liftMin) * i);

    playLaunchKickback(ch, recoilPx * 0.7, now);

    // Courtly bow (`scaleY 0.90`, forward bow `+9°`) -> dignified tall lift (`scaleY 1.12`) -> poised settle
    ch.reactionScaleY.value = withSequence(
      withTiming(0.9, wind),
      withDelay(hold, withTiming(1.12, { duration: CHEER.stretchMs, easing: EASE.enterSoft })),
      withTiming(0.94, { duration: CHEER.fallMs, easing: EASE.impact }),
      withDelay(CHEER.landHoldMs, withSpring(1, SPRING.settle))
    );
    ch.bodyTy.value = withSequence(
      withTiming(size * 0.02, wind),
      withDelay(hold, withTiming(-lift, rise)),
      withTiming(0, { duration: CHEER.fallMs, easing: EASE.impact })
    );
    ch.bodyRotate.value = withSequence(
      withTiming(8.5, wind),
      withDelay(hold, withTiming(-4, rise)),
      withSpring(0, SPRING.settle)
    );
    ch.headRotate.value = withSequence(
      withTiming(9, wind),
      withDelay(hold, withTiming(-6, rise)),
      withSpring(0, SPRING.settle)
    );
    // Both flippers sweep UP symmetrically-staggered (left CW `+46°`, right CCW `-34°`) — zero JSX teleport!
    ch.leftEarExtra.value = withSequence(
      withTiming(-8, wind),
      withDelay(hold, withTiming(46, rise)),
      withSpring(0, SPRING.settle)
    );
    ch.rightEarExtra.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(10, wind),
        withDelay(hold, withTiming(-36, rise)),
        withSpring(0, SPRING.settle)
      )
    );
    // Mystic oracle halo flares regally!
    ch.tailExtra.value = withDelay(
      followDelay,
      withSequence(
        withTiming(46, { duration: MS.quick, easing: EASE.enterSoft }),
        withSpring(0, SPRING.settle)
      )
    );
    return true;
  }

  return false;
};

/* -------------------------------------------------------------------------- */
/* 6. Pelican — Quirky Coastal Swooper (`standard` loose)                     */
/* -------------------------------------------------------------------------- */

const pelicanFidget: FighterSpeciesFidget = (roll, ch) => {
  if (roll < 0.44) {
    // Heavy gular pouch gulp & pendular jiggle (`SPRING.loose`)
    ch.headRotate.value = withSequence(
      withTiming(-8, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
      withTiming(6, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.enter }),
      withSpring(0, SPRING.lively)
    );
    ch.tailExtra.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(18, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.enter }),
        withTiming(-15, { duration: CREATURE_FX.fidgetStepMs, easing: EASE.ui }),
        withSpring(0, SPRING.loose)
      )
    );
    return true;
  }
  if (roll < 0.74) {
    // Coastal 3-feather crest ruffle + staggered wing shrug (CW `+deg` lifts swept-back wings!)
    ch.headRotate.value = withSequence(
      withTiming(-6, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.ui }),
      withTiming(6, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.ui }),
      withSpring(0, SPRING.lively)
    );
    ch.leftEarExtra.value = withSequence(
      withTiming(22, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.enter }),
      withSpring(0, SPRING.loose)
    );
    ch.rightEarExtra.value = withDelay(
      OVERLAP.secondaryMs,
      withSequence(
        withTiming(18, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.enter }),
        withSpring(0, SPRING.loose)
      )
    );
    return true;
  }
  return false;
};

const pelicanChoreography: FighterSpeciesChoreography = (type, ch, size, context) => {
  const jumpPx = Math.max(6, size * 0.22);
  const recoilPx = Math.max(4, size * 0.14);
  const rotBoost = (context.compact ?? size <= CREATURE_ACTING.compactSizePx)
    ? CREATURE_ACTING.compactRotateBoost
    : 1;

  if (type === 'throw') {
    // Bill-scoop pullback -> forward pouch-heave sling (`headRotate +14°`, lagging SPRING.loose pouch!)
    const wind = { duration: THROW.windMs, easing: EASE.enter };
    const lunge = { duration: THROW.lungeMs, easing: EASE.enter };
    const kick = { duration: HIT.snapMs, easing: EASE.enter };
    const rebound = { duration: HIT.snapMs, easing: EASE.ui };
    const lungeTx = size * 0.16;
    const kickOffset = recoilPx * HIT.attackerRecoilRatio;
    const lingerAfterRecoilMs = Math.max(0, THROW.holdMs - HIT.snapMs * 2);

    ch.bodyTx.value = withSequence(
      withTiming(-size * 0.09, wind),
      withTiming(lungeTx, lunge),
      withTiming(lungeTx - kickOffset, kick),
      withTiming(lungeTx + recoilPx * THROW.recoilReboundRatio, rebound),
      withDelay(lingerAfterRecoilMs, withSpring(0, SPRING.settle))
    );
    ch.bodyTy.value = withSequence(
      withTiming(size * 0.03, wind),
      withTiming(-size * 0.04, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.lively))
    );
    ch.reactionScaleY.value = withSequence(
      withTiming(0.85, wind),
      withTiming(1.15, lunge),
      withDelay(THROW.holdMs, withSpring(1, SPRING.lively))
    );
    ch.bodyRotate.value = withSequence(
      withTiming(-11 * rotBoost, wind),
      withTiming(12 * rotBoost, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.lively))
    );
    pulseStrikeSmear(ch, THROW.windMs, -SMEAR.strikeSkewDeg * 0.85);

    // Massive golden hooked bill scoops back (`-15°`) then slings forward (`+14°`!)
    ch.headRotate.value = withSequence(
      withTiming(-15 * rotBoost, wind),
      withTiming(14 * rotBoost, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.lively))
    );
    if (ch.headTx) {
      ch.headTx.value = withSequence(
        withTiming(-size * 0.03, wind),
        withTiming(size * 0.06, lunge),
        withDelay(THROW.holdMs, withSpring(0, SPRING.lively))
      );
    }
    // Coastal wings flare UP on scoop (CW `+34°`) then snap forward-down (`-14°`)!
    ch.leftEarExtra.value = withSequence(
      withTiming(34, wind),
      withTiming(-16, lunge),
      withDelay(THROW.holdMs, withSpring(0, SPRING.loose))
    );
    ch.rightEarExtra.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(-14, lunge),
        withDelay(THROW.holdMs, withSpring(0, SPRING.loose))
      )
    );
    // Heavy gular pouch trails `OVERLAP.primaryMs` then heaves & jiggles on `SPRING.loose`!
    ch.tailExtra.value = withSequence(
      withTiming(-18, wind),
      withDelay(
        OVERLAP.primaryMs,
        withSequence(
          withTiming(26, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.enter }),
          withTiming(-14, { duration: CREATURE_FX.fidgetFastMs, easing: EASE.ui }),
          withSpring(0, SPRING.loose)
        )
      )
    );
    return true;
  }

  if (type === 'joy' || type === 'ecstatic') {
    // Coastal wing-flap cheer + proud bill lift + pendular SPRING.loose gular pouch heave!
    const { now, i, windMs, hold, followDelay } = resolveCheerTiming(type, context);
    const wind = { duration: windMs, easing: EASE.enter };
    const rise = { duration: CHEER.riseMs, easing: EASE.enter };
    const lift = jumpPx * 0.52 * (CHEER.liftMin + (CHEER.liftMax - CHEER.liftMin) * i);
    const stretchMs = CHEER.stretchMs;
    const apexMs = CHEER.riseMs - stretchMs + CHEER.apexExtraMs;
    const toLanding = Math.max(0, CHEER.riseMs + CHEER.fallMs - stretchMs - apexMs);

    playLaunchKickback(ch, recoilPx, now);

    ch.reactionScaleY.value = withSequence(
      withTiming(0.85, wind),
      withDelay(hold, withTiming(1.1, { duration: stretchMs, easing: EASE.enter })),
      withTiming(1, { duration: apexMs, easing: EASE.drift }),
      withDelay(toLanding, withTiming(0.88, { duration: CHEER.landHoldMs, easing: EASE.enter })),
      withDelay(CHEER.landHoldMs, withSpring(1, SPRING.lively))
    );
    ch.bodyTy.value = withSequence(
      withTiming(size * 0.04, wind),
      withDelay(hold, withTiming(-lift, rise)),
      withTiming(0, { duration: CHEER.fallMs, easing: EASE.impact })
    );
    ch.bodyRotate.value = withSequence(
      withTiming(4, wind),
      withDelay(hold, withTiming(-(4 + 2.5 * i), rise)),
      withSpring(0, SPRING.lively)
    );
    // Proud coastal bill tilt upward (`-8°` keeps bill & 3-feather crest cleanly inside framed portrait!)
    ch.headRotate.value = withSequence(
      withTiming(5, wind),
      withDelay(hold, withTiming(-8, rise)),
      withSpring(0, SPRING.lively)
    );
    ch.headTy.value = withDelay(
      followDelay,
      withSequence(
        withTiming(-size * 0.02, { duration: CHEER.followMs, easing: EASE.enter }),
        withSpring(0, SPRING.lively)
      )
    );
    // Rhythmic 2-beat coastal wing flaps (CW `+52°` lifts swept-back wings skyward!) — zero JSX teleport!
    const flapUp = { duration: OVERLAP.tertiaryMs, easing: EASE.enter };
    const flapDown = { duration: CREATURE_FX.fidgetFastMs, easing: EASE.ui };
    ch.leftEarExtra.value = withSequence(
      withTiming(-8, wind),
      withDelay(hold, withTiming(52, flapUp)),
      withTiming(12, flapDown),
      withTiming(42, flapUp),
      withSpring(0, SPRING.loose)
    );
    ch.rightEarExtra.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(-6, wind),
        withDelay(hold, withTiming(46, flapUp)),
        withTiming(10, flapDown),
        withTiming(36, flapUp),
        withSpring(0, SPRING.loose)
      )
    );
    // Loose pendular gular pouch heave & jiggle (`SPRING.loose`, lagging behind takeoff!)
    ch.tailExtra.value = withDelay(
      followDelay,
      withSequence(
        withTiming(-18, { duration: OVERLAP.tertiaryMs, easing: EASE.enter }),
        withTiming(22, { duration: CREATURE_FX.entranceDropMs, easing: EASE.ui }),
        withSpring(0, SPRING.loose)
      )
    );
    ch.pawBounce.value = withSequence(
      withTiming(size * 0.02, wind),
      withDelay(hold, withTiming(-size * 0.06, rise)),
      withSpring(0, SPRING.lively)
    );
    return true;
  }

  return false;
};

/* -------------------------------------------------------------------------- */
/* Master Fighter Registry                                                    */
/* -------------------------------------------------------------------------- */

const FIGHTER_CREATURES: Record<string, FighterCreature> = {
  'Orange Tabby': {
    Rig: OrangeTabbyRig,
    massClass: 'standard',
    pivots: {
      head: { x: 56, y: 45 },
      leftEar: { x: 42, y: 28 },
      rightEar: { x: 69, y: 29 },
      tail: { x: 26, y: 74 },
      paws: { x: 58, y: 76 },
    },
    personality: {
      name: 'Orange Tabby',
      auraColor: '#FF9538',
      breathCycleMs: 2600,
      breathIntensity: 0.032,
      earSwayDeg: 7,
      tailCycleMs: 1800,
      tailWagDeg: 14,
      idleTiltDeg: 1.5,
      signatureMotif: 'hearts',
    },
    speciesChoreography: tabbyChoreography,
    speciesFidget: tabbyFidget,
  },
  'Sly Fox': {
    Rig: SlyFoxRig,
    massClass: 'nimble',
    pivots: {
      head: { x: 58, y: 46 },
      leftEar: { x: 43, y: 29 },
      rightEar: { x: 70, y: 29 },
      tail: { x: 32, y: 74 },
      paws: { x: 58, y: 80 },
    },
    personality: {
      name: 'Sly Fox',
      auraColor: '#FF6B00',
      breathCycleMs: 2300,
      breathIntensity: 0.028,
      earSwayDeg: 9,
      tailCycleMs: 1500,
      tailWagDeg: 16,
      idleTiltDeg: 2.2,
      signatureMotif: 'embers',
    },
    speciesChoreography: foxChoreography,
    speciesFidget: foxFidget,
  },
  'Emperor Penguin': {
    Rig: EmperorPenguinRig,
    massClass: 'standard',
    pivots: {
      head: { x: 52, y: 36 },
      leftEar: { x: 30, y: 54 }, // Trailing left flipper shoulder
      rightEar: { x: 65, y: 52 }, // Casting right flipper shoulder
      tail: { x: 38, y: 36 }, // Offset mystic oracle halo center
      paws: { x: 50, y: 88 },
    },
    personality: {
      name: 'Emperor Penguin',
      auraColor: '#16AA98',
      breathCycleMs: 3000,
      breathIntensity: 0.026,
      earSwayDeg: 10, // Flippers!
      tailCycleMs: 2200,
      tailWagDeg: 8,
      idleTiltDeg: 3.2, // Regal waddle sway!
      signatureMotif: 'frost',
    },
    speciesChoreography: penguinChoreography,
    speciesFidget: penguinFidget,
  },
  'Corgi': {
    Rig: CorgiRig,
    massClass: 'nimble',
    pivots: {
      head: { x: 58, y: 44 },
      leftEar: { x: 40, y: 29 },
      rightEar: { x: 72, y: 29 },
      tail: { x: 18, y: 66 }, // Corgi nub-tail rump on far left
      paws: { x: 50, y: 82 },
    },
    personality: {
      name: 'Corgi',
      auraColor: '#FFDE00',
      breathCycleMs: 1650, // Peppy happy pant!
      breathIntensity: 0.04,
      earSwayDeg: 11, // Big radar ears!
      tailCycleMs: 520, // Hyper-speed corgi nub wag!
      tailWagDeg: 22,
      idleTiltDeg: 2.5,
      signatureMotif: 'stars',
    },
    speciesChoreography: corgiChoreography,
    speciesFidget: corgiFidget,
  },
  'Pelican': {
    Rig: PelicanRig,
    massClass: 'standard',
    pivots: {
      head: { x: 42, y: 34 },
      leftEar: { x: 24, y: 54 }, // Far coastal wing shoulder
      rightEar: { x: 33, y: 56 }, // Near coastal wing shoulder
      tail: { x: 54, y: 50 }, // Oversized gular throat pouch hinge
      paws: { x: 42, y: 88 },
    },
    personality: {
      name: 'Pelican',
      auraColor: '#16AA98',
      breathCycleMs: 2800,
      breathIntensity: 0.03,
      earSwayDeg: 9, // Wings!
      tailCycleMs: 2000, // Gular throat pouch bob!
      tailWagDeg: 10,
      idleTiltDeg: 1.8,
      signatureMotif: 'splash',
    },
    speciesChoreography: pelicanChoreography,
    speciesFidget: pelicanFidget,
  },
  'Badger': {
    Rig: BadgerRig,
    massClass: 'heavy',
    pivots: {
      head: { x: 55, y: 44 },
      leftEar: { x: 34, y: 26 },
      rightEar: { x: 75, y: 26 },
      tail: { x: 20, y: 74 },
      paws: { x: 54, y: 68 },
    },
    personality: {
      name: 'Badger',
      auraColor: '#16AA98',
      breathCycleMs: 2100, // Grounded boxer bob!
      breathIntensity: 0.036,
      earSwayDeg: 5,
      tailCycleMs: 1700,
      tailWagDeg: 8,
      idleTiltDeg: 2.0,
      signatureMotif: 'shockwave',
    },
    speciesChoreography: badgerChoreography,
    speciesFidget: badgerFidget,
  },
};

/** Registry entry for a fighter with a bespoke rig, or undefined for any other character. */
export function getFighterCreature(characterName?: string | null): FighterCreature | undefined {
  if (!characterName) return undefined;
  return Object.prototype.hasOwnProperty.call(FIGHTER_CREATURES, characterName)
    ? FIGHTER_CREATURES[characterName]
    : undefined;
}

export function getFighterPersonality(characterName?: string | null): FighterPersonalityProfile {
  return getFighterCreature(characterName)?.personality ?? fallbackFighterPersonality(characterName);
}

export function getFighterPivots(characterName?: string | null): CreatureJointPivots {
  return getFighterCreature(characterName)?.pivots ?? DEFAULT_CREATURE_PIVOTS;
}

export function getFighterMassClass(characterName?: string | null): CreatureMassClass {
  return getFighterCreature(characterName)?.massClass ?? 'standard';
}

export function getFighterSpeciesChoreography(
  characterName?: string | null
): FighterSpeciesChoreography | undefined {
  return getFighterCreature(characterName)?.speciesChoreography;
}

export function getFighterSpeciesFidget(
  characterName?: string | null
): FighterSpeciesFidget | undefined {
  return getFighterCreature(characterName)?.speciesFidget;
}
