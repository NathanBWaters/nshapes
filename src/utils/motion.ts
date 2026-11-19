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
import { Easing } from 'react-native-reanimated';

/** How long things take, by what they are (ms). A phone screen is small: these are the short end of the usual ranges. */
export const MS = {
  /** The answer to a touch: a press, a pick, a toggle. Must start within 100 ms of the tap. */
  feedback: 120,
  /** A small part changing state: a chip, an icon, a badge */
  quick: 180,
  /** A card, a row, a part of a panel arriving or moving */
  move: 280,
  /** A sheet, a modal, a whole screen */
  panel: 360,
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
  move: [0.76, 0, 0.24, 1],
  exit: [0.7, 0, 0.84, 0],
  pop: [0.34, 1.56, 0.64, 1],
  drift: [0.37, 0, 0.63, 1],
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
  /** From one place on screen to another (ease-in-out-quart) */
  move: bezier(CURVE.move),
  /** Leaving: slow start, gone fast (ease-in-expo) */
  exit: bezier(CURVE.exit),
  /** A pop that visibly overshoots (ease-out-back). Position and scale only, never opacity. */
  pop: bezier(CURVE.pop),
  /** Ambient drift, breathing (ease-in-out-sine) */
  drift: bezier(CURVE.drift),
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
} as const;

/** Squash and stretch keep the volume: scaleX × scaleY stays near 1. */
export const SQUASH = {
  /** Landing, being hit: wider and shorter */
  squash: { x: 1.2, y: 0.8 },
  /** Taking off, flying: thinner and taller */
  stretch: { x: 0.85, y: 1.15 },
} as const;

/** How long a line of text must stay still to be read: half a second to find it, 0.3 s a word. */
export const textHoldMs = (words: number): number => 500 + 300 * Math.max(1, words);
