/**
 * Motion tokens: the one place NShapes decides how things move.
 *
 * Every number an animation leaves undecided gets filled by a default, and
 * defaults are what make motion look generic. So durations, curves, springs
 * and staggers are decided here, once, and used by name. New and reworked
 * animations take their numbers from this file; a literal `duration: 300` or
 * `Easing.out(Easing.quad)` at a call site is a decision nobody made.
 *
 * What each token is for, and the tables they come from, are in
 * `.agents/skills/motion-loop/references/numbers.md`.
 */
import { Easing, ReduceMotion } from 'react-native-reanimated';

/**
 * For the animations that must still play when the device asks for less
 * motion: the fade or the hold that carries the meaning. Reanimated otherwise
 * jumps every timing, spring, delay and sequence straight to its end, so a
 * number that fades in, holds and fades out is never shown at all.
 * Spread it into a timing's config and pass `STAYS.reduceMotion` as the last
 * argument of `withDelay` / `withSequence`. Leave travel and springs unmarked.
 */
export const STAYS = { reduceMotion: ReduceMotion.Never } as const;

/** How long things take, by what they are (ms). A phone screen is small: these are the short end of the usual ranges. */
export const MS = {
  /** The answer to a touch: a press, a pick, a toggle. Must start within 100 ms of the tap. */
  feedback: 120,
  /** A small part changing state: a chip, an icon, a badge */
  quick: 180,
  /** A card, a row, a part of a panel arriving or moving */
  move: 280,
  /** A sheet, a modal */
  panel: 360,
  /**
   * One screen giving way to another (map → fight, map → Camp…): seen hundreds of
   * times, so shorter than a sheet. The old screen leaves in exitMs(screen).
   */
  screen: 220,
  /** The moment the player came for: a star, a reward, a knockout */
  hero: 700,
} as const;

/** An exit takes about two thirds of its entrance: leaving is not the news. */
export const exitMs = (enterMs: number): number => Math.round(enterMs * 0.66);

/** A longer trip takes longer, but not in proportion: 100 px is the base, 400 px takes 1.6× as long. */
export const travelMs = (baseMs: number, distancePx: number): number => {
  const d = Math.max(0, distancePx);
  // 50 px ×0.8 · 100 px ×1 · 200 px ×1.3 · 400 px ×1.6 · a full screen ×2 at most
  const factor = d <= 50 ? 0.8 : d <= 100 ? 0.8 + (0.2 * (d - 50)) / 50 : Math.min(2, 1 + 0.3 * Math.log2(d / 100));
  return Math.round(baseMs * factor);
};

/** The curves as numbers (cubic-bezier), for the places that cannot take a Reanimated easing (RN `Animated`, CSS). */
export const CURVE = {
  enter: [0.16, 1, 0.3, 1],
  enterSoft: [0.22, 1, 0.36, 1],
  ui: [0.33, 1, 0.68, 1],
  /** Bidirectional in-place UI state swaps (toggles, tabs, chips) */
  state: [0.4, 0, 0.2, 1],
  move: [0.76, 0, 0.24, 1],
  exit: [0.7, 0, 0.84, 0],
  exitSoft: [0.32, 0, 0.67, 0],
  pop: [0.34, 1.56, 0.64, 1],
  /** Gentle ~7% friendly overshoot pop (badges, companion bubbles, tooltips) */
  popSoft: [0.175, 0.885, 0.32, 1.275],
  /** Pure pullback anticipation dip before launch or dismissal */
  anticipate: [0.36, 0, 0.66, -0.56],
  /** Built-in pullback anticipation + playful overshoot (rewards, easter eggs) */
  snapBack: [0.68, -0.55, 0.265, 1.55],
  drift: [0.37, 0, 0.63, 1],
  impact: [0.3, 0, 0.75, 0.3],
} as const;

const bezier = (c: readonly [number, number, number, number]) => Easing.bezier(c[0], c[1], c[2], c[3]);

/**
 * Curves by purpose. Enter with ease-out, leave with ease-in, cross the
 * screen with ease-in-out. Linear is for rotation, progress bars and the
 * phase of a loop, never for a move.
 */
export const EASE = {
  /** Arriving: fast off the mark, soft landing (ease-out-expo) */
  enter: bezier(CURVE.enter),
  /** A hero arriving: the same, a little gentler (ease-out-quint) */
  enterSoft: bezier(CURVE.enterSoft),
  /** Small interface parts (ease-out-cubic) */
  ui: bezier(CURVE.ui),
  /** Bidirectional in-place UI state swaps (toggles, tabs) */
  state: bezier(CURVE.state),
  /** From one place on screen to another (ease-in-out-quart) */
  move: bezier(CURVE.move),
  /** Leaving: slow start, gone fast (ease-in-expo) */
  exit: bezier(CURVE.exit),
  /**
   * Leaving, but seen to go at once (ease-in-cubic): for exits the player
   * asked for with a tap (a sheet put away, a screen left) and for any exit
   * under about 250 ms, where ease-in-expo would sit still for the first four
   * frames and read as a late answer.
   */
  exitSoft: bezier(CURVE.exitSoft),
  /** A pop that visibly overshoots (ease-out-back). Position and scale only, never opacity. */
  pop: bezier(CURVE.pop),
  /** Friendly gentle ~7% overshoot pop (badges, companion bubbles). Position and scale only. */
  popSoft: bezier(CURVE.popSoft),
  /** Pullback anticipation wind-up before launch or exit. Position and scale only. */
  anticipate: bezier(CURVE.anticipate),
  /** Pullback anticipation + playful overshoot snap in one timing. Position and scale only. */
  snapBack: bezier(CURVE.snapBack),
  /** Ambient drift, breathing (ease-in-out-sine) */
  drift: bezier(CURVE.drift),
  /** Falling or thrown INTO a hit: gathers speed and lands at full speed (the hit is the stop). Never an entrance that just arrives. */
  impact: bezier(CURVE.impact),
  /** Rotation, progress bars, loop phase. Never a move. */
  linear: Easing.linear,
} as const;

export interface SpringSpec {
  stiffness: number;
  damping: number;
  mass: number;
}

/**
 * Springs by what is moving. Read them by damping ratio (see `dampingRatio`):
 * 1.0 never bounces, 0.7–0.85 is crisp, 0.4–0.6 is playful, under 0.3 is a
 * cartoon. Position and scale may bounce. Opacity and colour never do.
 */
export const SPRING = {
  /** Buttons, chips, toggles: ratio 0.84, no visible overshoot, settled in about 0.23 s */
  snappy: { stiffness: 320, damping: 30, mass: 1 },
  /** Cards and panels coming to rest: ratio 1.0, no overshoot, about 0.45 s */
  settle: { stiffness: 170, damping: 26, mass: 1 },
  /** Big things (a banner, a sheet, a boss): ratio 1.05, about 0.68 s */
  heavy: { stiffness: 90, damping: 20, mass: 1 },
  /** Massive Tier-4 bosses & heavy stone slams: ratio 0.93, weighty inertia, ~0.82 s */
  boss: { stiffness: 110, damping: 23, mass: 1.4 },
  /** A little life (a dealt card, a counted coin): ratio 0.6, about 10% overshoot */
  lively: { stiffness: 260, damping: 19.5, mass: 1 },
  /** Rewards, mascots, stars: ratio 0.47, about 19% overshoot, about 0.56 s */
  playful: { stiffness: 220, damping: 14, mass: 1 },
  /** Loose parts that keep going after the body stops (ears, tails, tags): ratio 0.3 */
  loose: { stiffness: 190, damping: 8.3, mass: 1 },
} as const satisfies Record<string, SpringSpec>;

/** One number for how much a spring bounces, whatever the library calls its knobs. */
export const dampingRatio = (s: SpringSpec): number => s.damping / (2 * Math.sqrt(s.stiffness * s.mass));

/** Gaps between things that move one after another (ms) */
export const STAGGER = {
  /** Cards dealt onto the board */
  card: 40,
  /** Rows, chips, list items */
  item: 60,
  /** Words of a line */
  word: 90,
  /** The whole run of a stagger never takes longer than this, however many items */
  cap: 500,
} as const;

/**
 * When item `index` of `count` starts. Equal gaps, squeezed so the last item
 * still starts within `STAGGER.cap`: a long list must not take a second to arrive.
 */
export const staggerDelay = (index: number, count: number, gap: number = STAGGER.item): number => {
  const span = Math.max(0, count - 1) * gap;
  const scale = span > STAGGER.cap ? STAGGER.cap / span : 1;
  return Math.round(index * gap * scale);
};

/**
 * A cascade that gathers pace: each gap is 0.84 of the one before, so the
 * run speeds up into its last item. Reads as one gesture, where equal gaps
 * read as a list.
 */
export const cascadeDelay = (index: number, firstGap: number = STAGGER.item, shrink = 0.84): number => {
  let t = 0;
  let gap = firstGap;
  for (let i = 0; i < index; i++) {
    t += gap;
    gap *= shrink;
  }
  return Math.round(Math.min(t, STAGGER.cap));
};

/** Sizes of the standard gestures */
export const SCALE = {
  /** Pressed down */
  press: 0.96,
  /** "Make it pop": up to this and back in about 100 ms */
  pop: 1.08,
  /** A reward landing */
  reward: 1.18,
  /** How big a slammed reward (a results star) starts before it falls into its slot */
  slam: 1.5,
  /** Anticipation before a hero turns or launches: it gathers itself to this, then goes */
  windup: 0.9,
} as const;

/** Squash and stretch keep the volume: scaleX × scaleY stays near 1. */
export const SQUASH = {
  /** Landing, being hit: wider and shorter */
  squash: { x: 1.2, y: 0.8 },
  /** Taking off, flying: thinner and taller */
  stretch: { x: 0.85, y: 1.15 },
} as const;

/** Damage intensity tier (`0`: plain Set, `1`: big/crit, `2`: huge/blast, `3`: MEGA/Perfect Parry). */
export type HitTier = 0 | 1 | 2 | 3;

/** Damage-pose silhouette variant (`[FX-12]`): grounded knockback, airborne blast pop, or electric shock buzz. */
export type HitKind = 'throw' | 'blast' | 'zap';

/**
 * A creature taking a hit: the impact pose is there on the next frame, held
 * for tier-scaled hit-stop frames (3f / 4f / 6f / 8–9f) with decaying micro-vibration,
 * then recovered on a spring. A hit that lands while the last one is still being
 * felt is a CHAIN: it goes deeper from wherever the body is, holds 2f (`32ms`),
 * and never restarts from rest.
 */
export const HIT = {
  /** From rest to the impact pose: one frame */
  snapMs: 16,
  /** Tier-0 hit-stop: the impact pose held still (3 frames) */
  holdMs: 48,
  /** Tier-1 / critical hit holds a frame longer (4 frames) */
  critHoldMs: 64,
  /** Tier-scaled hit-stop durations (ms): 3f / 4f / 6f / 8.5f (`[FX-06]`) */
  tierHoldMs: [48, 64, 96, 136] as const,
  /** Per-move hitstop multipliers (`[FX-06]`, Sakurai Ep. #047 Spec #6) */
  moveMult: {
    hit: 1.0,
    rainbow: 1.15,
    surge_hit: 1.2,
    blast: 1.25,
    pinata_break: 1.25,
    laser: 0.9,
    ricochet: 0.85,
    link_burst: 0.85,
    parry: 1.15,
    perfect_parry: 1.35,
  } as const,
  /** Hard ceiling (~9 frames) so big cascades never stall */
  maxHoldMs: 145,
  /** A chained hit holds less, so a fast chain does not stall (2 frames) */
  chainHoldMs: 32,
  /** A hit this soon after the last one is part of the same chain */
  chainWindowMs: 420,
  /** How much deeper each step of a chain goes, and how many steps count */
  chainGain: 0.15,
  chainMax: 2,
  /** Impact stars: on at full size on the impact frame, drift up, gone in about 20 frames */
  starsMs: 320,
  /** Hitstop defender micro-vibration cadence: 1 frame per half-cycle (`[FX-02]`) */
  vibStepMs: 16,
  /** Monotonic geometric amplitude decay per micro-vibration step (`×0.7`) */
  vibDecay: 0.7,
  /** Defender micro-vibration share of `recoilPx`, scaled across tiers `0..3` */
  defenderVibRatio: 0.22,
  defenderVibTierScale: [0.85, 1.0, 1.2, 1.45] as const,
  /** Light attacker kickback share of `recoilPx` on Set launch (`1–2` frames, `[FX-02]`) */
  attackerRecoilRatio: 0.28,
  /** Smooth tier-scaled impact pose depths (`[FX-06]`) */
  tierSquash: [0.84, 0.8, 0.75, 0.7] as const,
  tierRecoilMult: [1.0, 1.18, 1.36, 1.55] as const,
  tierRotateDeg: [12, 16, 20, 24] as const,
  tierHeadRotateDeg: [13, 17, 21, 25] as const,
  tierEarSplayDeg: [18, 22, 26, 28] as const,
  /** Airborne `'blast'` damage-pose variant (`[FX-04]`, `[FX-12]`) */
  blastLiftMult: 0.45,
  blastVibYRatio: 0.16,
  blastRotateMinDeg: 24,
  blastRotateMaxDeg: 28,
  blastEarSplayDeg: 28,
  /** Electric `'zap'` damage-pose variant (`[FX-12]`) */
  zapStretchY: 1.12,
  zapBuzzRatio: 0.5,
  zapTiltDeg: 4,
  zapEarSpikeDeg: 24,
  /** Fighter taking damage: crisp left-directed impact pose (`[FX-07]`) */
  fighterPainSquash: 0.78,
  fighterPainRecoilMult: 1.15,
  fighterPainRotateDeg: -15,
  fighterPainHeadRotateDeg: -17,
  fighterPainEarDeg: 20,
  /** Tightened enemy `pain` expression hold so wince releases right as recoil settles (`[FX-12]`) */
  painHoldMs: 540,
} as const;

export type HitMoveKind = keyof typeof HIT.moveMult;

/**
 * Hitstop hold duration (ms) scaled by damage tier (`0..3`) and per-move multiplier.
 * Rapid chained hits (`chain > 0`) cap to `HIT.chainHoldMs` (`32 ms` / 2 frames).
 */
export const hitstopHoldMs = (
  tier: HitTier = 0,
  moveKind?: string,
  chain = 0
): number => {
  if (chain > 0) return HIT.chainHoldMs;
  const clampedTier = Math.max(0, Math.min(3, Math.round(tier))) as HitTier;
  const base = HIT.tierHoldMs[clampedTier];
  const mult =
    moveKind && Object.prototype.hasOwnProperty.call(HIT.moveMult, moveKind)
      ? HIT.moveMult[moveKind as HitMoveKind]
      : 1;
  return Math.min(HIT.maxHoldMs, Math.round(base * mult));
};

/** Shared monotonic geometric-decay shake tokens (`[FX-05]`, Sakurai Ep. #047 Spec #5 & #103). */
export const SHAKE = {
  /** Per-leg geometric amplitude decay ratio (`×0.7`) */
  decay: 0.7,
  /** Sharp leg-0 impact punch (ms) */
  firstLegMs: 24,
  /** Interior alternating oscillation leg duration (ms) */
  legMs: 36,
  /** Final settle leg back to rest (ms) */
  settleMs: 48,
} as const;

/**
 * Pure, deterministic monotonic geometric-decay (`×0.7`) shake keyframes ending at `0`.
 * Example: `geometricShakeKeyframes(10, 5, 0.7, -1)` → `[-10, 7, -4.9, 3.43, -2.401, 0]`.
 * Strictly alternating signs, strictly shrinking magnitudes, zero `Math.random()` so
 * frame captures repeat identically.
 */
export const geometricShakeKeyframes = (
  amp: number,
  legs: number,
  decay: number = SHAKE.decay,
  sign: 1 | -1 = 1
): number[] => {
  const safeAmp = Math.abs(amp);
  const safeLegs = Math.max(0, Math.floor(legs));
  if (safeAmp === 0 || safeLegs === 0) return [0];
  const safeDecay = Math.max(0.05, Math.min(0.99, decay));
  const keyframes: number[] = [];
  for (let i = 0; i < safeLegs; i++) {
    const dir = i % 2 === 0 ? sign : -sign;
    const magnitude = Math.round(safeAmp * Math.pow(safeDecay, i) * 1000) / 1000;
    keyframes.push(dir * magnitude);
  }
  keyframes.push(0);
  return keyframes;
};

/** Alias matching the `[FX-05]` plan helper name. */
export const geometricShake = geometricShakeKeyframes;

/**
 * Viewport-scaled shake amplitude multiplier (`[FX-08]`, Sakurai Ep. #047 Spec #8):
 * clamps cleanly between `0.75×` (compact phones) and `1.5×` (wide desktop stages).
 */
export const viewportShakeScale = (stageW: number): number =>
  Math.max(0.75, Math.min(1.5, stageW / 375));

/**
 * The fighter cheering a Set it made: a small crouch answers the tap at once,
 * holds while the cards fly (the throw is the hero), and the hop is released on
 * the frame the Set lands. A streak makes the same hop higher, never a different
 * move. Used on every Set: small and short, smaller than the throw.
 */
export const CHEER = {
  /** Into the crouch: the answer to the tap */
  windMs: 60,
  /** Ecstatic cheer (already landed / hero moment) winds up in 2 frames */
  ecstaticWindMs: 32,
  /**
   * When the hop is released, from the Set: the time a thrown Set takes to reach the foe.
   * Keep it equal to the fight's flight time (`FX_TIMING.flightMs`, src/adventure/fx/script.ts).
   */
  releaseMs: 240,
  /** Up to the top of the hop (ease-out), and back down (ease-in, into the landing) */
  riseMs: 150,
  fallMs: 130,
  /** Stretch phase at takeoff, apex soften extra time, and follow-through lag/duration */
  stretchMs: 90,
  apexExtraMs: 60,
  followLagMs: 32,
  followMs: 120,
  /** The landing squash is held this long before it springs back (2 frames) */
  landHoldMs: 32,
  /** Hop height as a share of the creature's jump: a single Set, and a long streak */
  liftMin: 0.75,
  liftMax: 1.1,
  /** Streak at which the cheer is at its biggest (it grows from the 2nd Set) */
  streakFull: 5,
} as const;

/**
 * Dedicated asymmetric fighter Set-launch throw pose (`[FX-09]` & `[FX-02]`):
 * 2f coil wind-up → 2f centerline-crossing lunge → 2f light launch recoil inside
 * a 96 ms lingering follow-through → smooth spring recovery (startup 64 ms / ~420 ms ≈ 15%).
 */
export const THROW = {
  /** Frame-1 snap coil back away from foe (2 frames) */
  windMs: 32,
  /** Snap forward lunge crossing centerline toward foe (2 frames) */
  lungeMs: 32,
  /** Follow-through linger holding throw silhouette while cards soar (6 frames) */
  holdMs: 96,
  /** Expression hold duration for `'throw'` reaction */
  expressionHoldMs: 520,
  /** Coil-back displacement and pose */
  windTxRatio: -0.08,
  windRotateDeg: -10,
  windScaleY: 0.86,
  windLeftEarDeg: 12,
  windRightEarDeg: -8,
  /** Forward lunge displacement and pose */
  lungeTxRatio: 0.16,
  lungeRotateDeg: 15,
  lungeScaleY: 1.15,
  lungePawRatio: -0.11,
  lungeHeadRotateDeg: 8,
  /** Light forward rebound after launch kickback (share of `recoilPx`) */
  recoilReboundRatio: 0.08,
} as const;

/**
 * Enemy ability attack choreography (`[FX-10]`, Sakurai Ep. #036/#049/#077/#148):
 * 2f snap coil wind-up → 4f coiled telegraph → 2f strike snap → 3f apex impact hold
 * → slow spring follow-through (startup 128 ms / ~456 ms = 28% ≤ 1/3).
 */
export const ENEMY_ATTACK = {
  windMs: 32,
  coilHoldMs: 64,
  strikeMs: 32,
  apexHoldMs: 48,
  windTxMult: 0.72,
  windScaleY: 0.8,
  windRotateDeg: 11,
  windPawRatio: 0.04,
  strikeTxMult: -1.65,
  strikeScaleY: 1.2,
  strikeRotateDeg: -17,
  strikePawRatio: -0.16,
  strikeHeadRotateDeg: -12,
} as const;

/** Alias matching the `[FX-10]` plan token name. */
export const FOE_ATTACK = ENEMY_ATTACK;

/**
 * Enemy regeneration choreography (`[FX-10]`): crisp anticipation dip → hold →
 * buoyant swell → apex hold → gentle settle.
 */
export const ENEMY_REGEN = {
  dipMs: 48,
  dipHoldMs: 32,
  swellMs: 220,
  apexHoldMs: 140,
  dipScaleY: 0.87,
  dipTyRatio: 0.035,
  swellLiftMult: -0.82,
  swellScaleY: 1.13,
} as const;

/** Alias matching the `[FX-10]` plan token name. */
export const FOE_REGEN = ENEMY_REGEN;

/** Smooth 3-step eyelid blink travel (`[FX-12]`): close 2f → hold 3f → open 3f. */
export const BLINK = {
  closeMs: 32,
  holdMs: 48,
  openMs: 48,
  doubleGapMs: 90,
} as const;

/** Creature combat posture & small-screen facial acting tokens (`[FX-09]`, `[FX-12]`). */
export const CREATURE_ACTING = {
  /** Compact avatar size threshold (px) triggering small-screen exaggeration (`[FX-12]`) */
  compactSizePx: 52,
  /** +25% body/head rotation amplification on compact stages (`size <= 52`) */
  compactRotateBoost: 1.25,
  /** Eye/feature acting boost factor on compact stages */
  compactFeatureScale: 1.24,
  /** Subtle GPU head scale boost during active reactions on compact stages (`size <= 52`) */
  compactHeadBoostScale: 1.12,
  /** Soft head vertical compression during eyelid blink travel */
  blinkHeadSquash: 0.045,
  /** Subtle 3/4 combat gaze bias keeping both eyes open to camera (`[FX-09]`) */
  fighterCombatGazeX: 0.25,
  enemyCombatGazeX: -0.25,
  /** Asymmetric 3/4 resting stance offsets (`[FX-09]`) */
  fighterCombatLeanX: 0.025,
  fighterCombatTiltDeg: 4.5,
  enemyCombatLeanX: -0.025,
  enemyCombatTiltDeg: -4.5,
} as const;

/** Tokenized secondary creature fidget, reaction, and overlay timings (zero magic call-site numbers). */
export const CREATURE_FX = {
  fidgetFastMs: 80,
  fidgetStepMs: 96,
  fidgetBreathMs: 220,
  fidgetDelayMs: 64,
  ambientFadeMs: 220,
  fighterAmbientFadeMs: 240,
  enemyBurstMs: 680,
  spinMs: 540,
  tauntDipMs: 64,
  tauntStepMs: 96,
  tauntRiseMs: 140,
  pokeStepMs: 80,
  pokeFollowMs: 120,
  entranceDropMs: 112,
  entranceHoldMs: 144,
  reliefDipMs: 80,
  reliefInhaleMs: 230,
  reliefHoldMs: 280,
  healRiseMs: 320,
  powerupWindMs: 104,
  powerupRiseMs: 200,
  hintHoldMs: 340,
  petRollMs: 120,
} as const;

/** How strongly to cheer a streak of `streak` Sets: 0 for one Set, 1 from `CHEER.streakFull` on. */
export const cheerIntensity = (streak: number): number =>
  Math.max(0, Math.min(1, (streak - 1) / (CHEER.streakFull - 1)));

/** How long a line of text must stay still to be read: half a second to find it, 0.3 s a word. */
export const textHoldMs = (words: number): number => 500 + 300 * Math.max(1, words);

/* -------------------------------------------------------------------------- */
/* Disney-12 × Sakurai Phase 0 Tokens & Pure Worklets                         */
/* -------------------------------------------------------------------------- */

/** Curved motion path ratios (Disney #7 Arcs + Sakurai Ep. #037 fast-fall gravity). */
export const ARC = {
  /** Subtle organic UI bow as a share of travel distance (10–20%) */
  subtleRatio: 0.14,
  /** Sweeping hero/projectile arc as a share of travel distance (30–40%) */
  dramaticRatio: 0.34,
  /** Standard UI tooltip/card/modal subtle perpendicular bow (px) */
  uiBowPx: 12,
  /** Asymmetric jump apex position along normalized time (0.46 = faster fall than rise) */
  jumpApexT: 0.46,
  /** Descent duration share vs ascent for punchy landings (Sakurai Ep. #037) */
  fallToRiseRatio: 0.85,
} as const;

/**
 * Pure worklet: evaluates a curved 2D point from `from` to `to` at `t ∈ [0, 1]`
 * bowing perpendicular to the chord by `bowPx` (`skew ∈ [-0.4, 0.4]` shifts apex
 * earlier for ease-out arcs or later for ease-in arcs).
 */
export const sampleArcPoint = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  t: number,
  bowPx: number,
  skew = 0
): { x: number; y: number } => {
  'worklet';
  const ct = Math.max(0, Math.min(1, t));
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const warped = ct + skew * ct * (1 - ct);
  const bow = Math.sin(Math.PI * Math.max(0, Math.min(1, warped))) * bowPx;
  return { x: fromX + dx * ct + nx * bow, y: fromY + dy * ct + ny * bow };
};

/**
 * Pure worklet: asymmetric gravity parabola (`0` at `t=0` and `t=1`, `-liftPx` at apex).
 * `apexT < 0.5` makes descent sharper and heavier than ascent.
 */
export const sampleJumpArcY = (t: number, liftPx: number, apexT: number = ARC.jumpApexT): number => {
  'worklet';
  const ct = Math.max(0, Math.min(1, t));
  if (ct <= apexT) {
    const u = 1 - ct / Math.max(0.05, apexT);
    return -liftPx * (1 - u * u);
  }
  const u = (ct - apexT) / Math.max(0.05, 1 - apexT);
  return -liftPx * (1 - u * u);
};

/**
 * Volume-preserving squash & stretch tiers (`scaleX = (1 / scaleY)^conserve`).
 * Matches Disney elasticity spectrum from rigid cardstock UI to cartoon celebrations.
 */
export const SQUASH_TIER = {
  /** Tactile cardstock / buttons / panels: 2–4% deformation prevents dead mechanical feel */
  ui: { squashY: 0.96, stretchY: 1.03, conserve: 0.75, holdMs: 32 },
  /** Heavy / Boss / Badger mass: deep compression on impact, minimal upward stretch */
  heavy: { squashY: 0.82, stretchY: 1.09, conserve: 1.0, holdMs: 48 },
  /** Standard creature hops, throws, medium landings */
  lively: { squashY: 0.85, stretchY: 1.15, conserve: 1.0, holdMs: 32 },
  /** Hero rewards, Corgi/Tabby leaps, Friend Rescues */
  playful: { squashY: 0.78, stretchY: 1.22, conserve: 1.0, holdMs: 48 },
  /** Max cartoon exaggeration (clamped safely to preserve 3px ink outlines) */
  cartoon: { squashY: 0.7, stretchY: 1.32, conserve: 1.0, holdMs: 64 },
} as const;

/** Exact constant-area (or damped UI) volume-preserving scale pair. */
export const volumeScale = (
  scaleY: number,
  conserve = 1.0,
  minY = 0.68,
  maxY = 1.35
): { scaleX: number; scaleY: number } => {
  'worklet';
  const y = Math.max(minY, Math.min(maxY, scaleY));
  const x = conserve === 1 ? 1 / y : Math.pow(1 / y, conserve);
  return { scaleX: x, scaleY: y };
};

/**
 * Anticipation & Follow-Through phase contracts (Disney #2/#5 + Sakurai Ep. #036/#049/#077).
 * Player combat actions snap on frame 1; enemy/boss telegraphs hold longer for parry readability.
 */
export const PHASE = {
  /** Skip anticipation below this total duration (ms) so micro-taps stay instant */
  skipAnticipationUnderMs: 150,
  /** Standard anticipation share of total move (never exceed 0.33 for combat attacks) */
  anticipationMaxShare: 0.33,
  /** Minimum follow-through + recovery share so aftermath defines the move's impression */
  followThroughMinShare: 0.58,
  /** Subtle UI card/button pre-expansion gather */
  uiGatherMs: 48,
  uiGatherScale: 0.97,
  /** Boss extended telegraph wind-up & dread hold (ms) */
  bossWindMs: 48,
  bossCoilHoldMs: 144,
  bossApexHoldMs: 80,
  /** Expressive "moving hold" micro-drift (1.5% scale or ±1.5px tremor) so non-hitstop holds never look dead */
  movingHoldScaleDelta: 0.015,
  movingHoldTremorPx: 1.5,
} as const;

/** 4-tier overlapping-action drag delays (ms at 60fps) & asymmetric phase lags (rad, anti-twinning). */
export const OVERLAP = {
  /** Discrete reaction / UI choreography lag offsets (ms) */
  rootMs: 0,
  primaryMs: 32, // Head / limbs / primary icon behind torso or card (2f)
  secondaryMs: 64, // Ears / paws / modal body behind container (4f)
  tertiaryMs: 96, // Tail tip / cloak / badge / reward label (6f)
  uiContentMs: 48, // Card/modal interior trailing its frame (3f)
  exitContentLeadMs: 48, // Content starts exiting 3f BEFORE its container collapses
  /** Continuous spine/appendage wave phase lags (radians) — L !== R bans twinning */
  headRad: 0.68,
  swayRad: 0.52,
  leftAppendageRad: 1.28,
  rightAppendageRad: 1.44,
  tailWhipRad: 0.35,
  cloakTipRad: 1.72,
} as const;

/** Mass-class timing & inertia multipliers across nimble critters, fighters, bruisers, and bosses. */
export const MASS_CLASS = {
  nimble: { timeMult: 0.82, recoilMult: 1.12, squashTier: 'playful' as const, spring: 'lively' as const },
  standard: { timeMult: 1.0, recoilMult: 1.0, squashTier: 'lively' as const, spring: 'lively' as const },
  heavy: { timeMult: 1.25, recoilMult: 0.8, squashTier: 'heavy' as const, spring: 'settle' as const },
  boss: { timeMult: 1.45, recoilMult: 0.65, squashTier: 'heavy' as const, spring: 'boss' as const },
} as const;

export type MassClass = keyof typeof MASS_CLASS;

/** Seam-free continuous loop guardrails (Disney #4/#9/#12 + battery/fatigue safety). */
export const IDLE_LOOP = {
  /** Max vertical scale delta for creature breathing (±4%) */
  creatureBreathMax: 0.04,
  /** Max scale delta for subtle UI ambient pulse (±2%) */
  uiAmbientScaleMax: 0.02,
  /** Max ambient travel as a share of hero travel (<5%) */
  maxAmbientTravelRatio: 0.05,
  /** Golden-ratio frequency offset preventing sway from locking to breath */
  goldenSwayRatio: 0.618,
  /** Incommensurate prime-ish periods (ms) so ambient siblings never sync up */
  primePeriodsMs: [2900, 3700, 5300, 7100, 11300] as const,
  /** 120° phase spread (rad) for 3-element orbital/dot loops */
  triadPhaseRad: (Math.PI * 2) / 3,
} as const;

/**
 * Pure deterministic PRNG step (LCG) for repeatable blink, gaze & fidget schedules
 * so creatures stay organic while `npm run motion:capture -- --twice` matches frame-for-frame.
 */
export const nextDeterministicUnit = (seed: number): { value: number; nextSeed: number } => {
  'worklet';
  const nextSeed = (Math.imul(seed | 0, 1664525) + 1013904223) >>> 0;
  return { value: nextSeed / 4294967296, nextSeed };
};

/** Deterministic FNV-1a 32-bit string hash for seeding repeatable ambient schedules. */
export const seedFromKey = (key: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
};

/** 1–2 frame directional velocity smears for crisp 2D snap on fast strikes & flights (Sakurai Ep. #148/#177/#190). */
export const SMEAR = {
  /** Smear lives 1–2 frames only — longer reads as muddy blur */
  durationMs: 32,
  /** Stretch along velocity axis, inverse squash perpendicular */
  strikeScaleX: 1.24,
  strikeScaleY: 0.81,
  /** Forward shear leaning into swing direction (deg) */
  strikeSkewDeg: 11,
  /** Flying card/projectile peak velocity stretch */
  flightScaleX: 1.16,
  flightScaleY: 0.86,
} as const;

/** Sakurai Ep. #056 4-stage explosion & Ep. #130 hit-spark timing tokens (ms). */
export const IMPACT_FX = {
  /** Stage 1: high-contrast dark+bright flash (2 frames, never full-screen white) */
  flashMs: 32,
  /** Stage 2: forceful outward fireball / spark burst (animates DURING hitstop!) */
  fireballMs: 144,
  /** Stage 3: dark-outlined storybook smoke hand-off */
  smokeMs: 260,
  /** Stage 4: ember afterglow & clean dissipation */
  dissipateMs: 180,
  /** Max simultaneous active particles per beat (battery + readability cap) */
  maxParticlesPerBeat: 12,
} as const;

/** Secondary action subordination bounds (Disney #3 Staging & #8 Secondary Action). */
export const SECONDARY = {
  /** Support starts this long after hero beat (ms) */
  startAfterMinMs: 96,
  startAfterMaxMs: 192,
  /** Support travel capped at 50–70% of hero travel */
  travelRatio: 0.6,
  /** Amplitude ceiling by context (ratio of primary) */
  uiAmpMax: 0.25,
  cardAmpMax: 0.4,
  combatAmpMax: 0.6,
  heroAmpMax: 0.7,
  /** One-Third Rule: max fraction of on-screen siblings moving at once */
  maxSimultaneousShare: 1 / 3,
} as const;

/** Vestibular & WCAG 2.1 safety constants (2.2.2, 2.3.1, 2.3.3). */
export const ACCESSIBLE = {
  /** Reduced-motion replacement cross-fade duration (ms, always paired with STAYS) */
  fadeMs: 120,
  /** Max allowed subtle scale change under gentle reduced-motion fallback */
  maxSafeScaleDelta: 0.05,
  /** WCAG 2.3.1 hard ceiling: never flash more than 3 times per second */
  maxFlashesPerSec: 3,
} as const;

/** Halves duration for reduced-motion meaning-preserving fades (clamped to crisp floor). */
export const reducedMs = (ms: number): number =>
  Math.max(64, Math.min(ACCESSIBLE.fadeMs, Math.round(ms * 0.5)));

/** Tactile 3D storybook button push-down tokens (`ui.tsx` `Btn` & tabletop CTAs). */
export const BTN_PRESS = {
  /** Press-in compression duration (ms, instant tactile answer <100ms) */
  pressInMs: 60,
  /** Pressed scale (matches `SCALE.press`) */
  scale: SCALE.press,
  /** Vertical push-down mimicking bottom-ledge compression (px) */
  translateY: 2,
  /** Compact/small button push-down (px) */
  smallTranslateY: 1.5,
  /** Reduced-motion fallback pressed opacity delta */
  reducedOpacity: 0.86,
} as const;

/** Shared modal & `PopIn` enter/exit choreography tokens (content lags enter, leads exit). */
export const MODAL_MOTION = {
  backdropEnterMs: MS.feedback,
  backdropExitMs: exitMs(MS.feedback),
  enterMs: MS.quick,
  exitMs: exitMs(MS.quick),
  sheetEnterMs: MS.panel,
  sheetExitMs: exitMs(MS.panel),
  popInFromScale: 0.94,
  popOutToScale: 0.96,
  contentLagMs: OVERLAP.uiContentMs,
  exitContentLeadMs: OVERLAP.exitContentLeadMs,
} as const;

/** Tokenized weapon tap flourish & burst overlay timings (`WeaponAvatar.tsx`, Lane 3). */
export const WEAPON_FX = {
  windMs: 64,
  strikeMs: 120,
  holdMs: 80,
  settleMs: 260,
  burstMs: 440,
  particleStaggerMs: 48,
  idleGlintScale: 1.02,
  flourishScale: 1.14,
  recoilDeg: 14,
} as const;

/**
 * Hybrid sprite-atlas transition blend & tempo-smoothing tokens (Option B state machine).
 * Combat strikes and hit impacts snap in 0 ms (Sakurai 1-frame responsiveness), while
 * animated recoveries, mood transitions, sleepy bridges, and mascot swaps crossfade cleanly.
 */
export const SPRITE_TX = {
  /** Instant 1-frame Sakurai snap for strikes, impacts, and rapid hit-chains */
  snapMs: 0,
  /** Smooth dual-layer recovery crossfade from animated clip tail back to Pose0 idle (4 frames) */
  recoverBlendMs: 64,
  /** Smooth dual-layer crossfade for ambient mood transitions (e.g. idle ↔ anticipation windup) */
  moodBlendMs: 64,
  /** Drowsy bridge crossfade entering and waking from sleepy/defeat/KO loops (6 frames) */
  sleepBlendMs: 96,
  /** Subtle opacity/scale entrance on Main Menu mascot swap (7 frames) */
  swapBlendMs: 112,
  /** Subtle volume-preserved settle squash cushioning action recoveries into momentum */
  settleSquashY: 0.965,
  /** Exponential smoothing rate (1/s) for monotonic idle tempo changes (`expApproach`) */
  tempoApproachRate: 8,
} as const;
