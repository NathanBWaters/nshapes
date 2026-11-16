/**
 * Interactive in-game coaching & progressive UI disclosure helpers.
 *
 * Replaces walls of pre-fight modal text with:
 *  1. Live card highlighting on 1-1 ("show, don't tell" — tap the 3 glowing cards!)
 *  2. Plain-English explanations of WHY 3 glowing cards match or WHY 3 wrong cards missed
 *  3. Step-by-step HUD progressive disclosure so beginners only see UI elements
 *     once the campaign has actually introduced them.
 */
import type { AttributeName, Card } from '@/types';
import { isValidCombination } from '@/utils/gameUtils';
import type { AdventureSave, LevelDef, RunState } from './types';
import { allSets, countDifferentAttributes, isSelectable } from './engine/sets';
import { mainIndexOf, getLevel } from './data/levels';
import { MECHANICS } from './data/mechanics';

export interface GuidedBoardHint {
  glowIds: string[];
  dimIds: string[];
  dimOpacity: number;
  message: string;
  mood: 'joy' | 'anticipation' | 'encourage';
}

const SHAPE_PLURAL: Record<Card['shape'], string> = {
  diamond: 'diamonds',
  oval: 'ovals',
  squiggle: 'squiggles',
};

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

/** Short, kid-and-grandma-friendly reason why these 3 valid cards form a match. */
export const describeValidSetWhy = (cards: readonly Card[], attributes: readonly AttributeName[]): string => {
  if (cards.length < 3) return 'All traits match or differ!';
  const sameColor = cards.every(c => c.color === cards[0].color);
  const sameShape = cards.every(c => c.shape === cards[0].shape);

  if (attributes.length <= 2) {
    if (sameColor && sameShape) return `All 3 are ${cards[0].color} ${SHAPE_PLURAL[cards[0].shape]}!`;
    if (sameColor) return `All 3 are ${cards[0].color}, with 3 different shapes!`;
    if (sameShape) return `All 3 are ${SHAPE_PLURAL[cards[0].shape]}, in 3 different colors!`;
    return '3 different shapes and 3 different colors!';
  }

  const diff = countDifferentAttributes([...cards], [...attributes]);
  if (diff === attributes.length) return 'Every trait is different — Rainbow Strike!';
  const sameParts: string[] = [];
  if (sameColor) sameParts.push(`all ${cards[0].color}`);
  if (sameShape) sameParts.push(`all ${SHAPE_PLURAL[cards[0].shape]}`);
  if (attributes.includes('number') && cards.every(c => c.number === cards[0].number)) {
    sameParts.push(`all ${cards[0].number}s`);
  }
  return sameParts.length > 0
    ? `${sameParts[0][0].toUpperCase()}${sameParts[0].slice(1)}, and the other traits differ!`
    : 'Each trait is all same or all different!';
};

/** Plain-English 1-liner explaining the exact trait that broke an invalid 3-card pick. */
export const explainInvalidPick = (cards: readonly Card[], attributes: readonly AttributeName[]): string => {
  if (cards.length !== 3) return 'Pick 3 cards where each trait is all the same or all different.';
  const check = isValidCombination([...cards], [...attributes]);
  const bad = check.invalidAttributes[0] as AttributeName | undefined;
  if (!bad) return 'Each trait must be all the same or all different.';

  const counts = new Map<string | number, number>();
  for (const c of cards) {
    const val = bad === 'background' ? (c.background ?? 'white') : c[bad];
    counts.set(val, (counts.get(val) ?? 0) + 1);
  }
  let pairVal: string | number = '';
  let oddVal: string | number = '';
  for (const [val, cnt] of counts.entries()) {
    if (cnt === 2) pairVal = val;
    else if (cnt === 1) oddVal = val;
  }

  switch (bad) {
    case 'color':
      return `Almost! 2 ${pairVal} + 1 ${oddVal} — colors must be ALL SAME or ALL DIFFERENT.`;
    case 'shape':
      return `Almost! 2 ${SHAPE_PLURAL[pairVal as Card['shape']] ?? `${pairVal}s`} + 1 ${oddVal} — shapes must be ALL SAME or ALL DIFFERENT.`;
    case 'number':
      return `Almost! Two ${pairVal}s and a ${oddVal} — numbers must be ALL SAME or ALL DIFFERENT.`;
    case 'shading':
      return `Almost! 2 ${pairVal} + 1 ${oddVal} — shading must be ALL SAME or ALL DIFFERENT.`;
    default:
      return 'Almost! Every trait must be ALL SAME or ALL DIFFERENT.';
  }
};

/**
 * Computes live, non-blocking board guidance for the current run state:
 * - On 1-1: walks the player through Match 1 (3 glowing cards, same-trait),
 *   Match 2 (3 glowing cards, all-different), Match 3 (1 glowing starter card),
 *   and Matches 4-5 (independent play with an idle safety net).
 * - On 1-2 & 1-3: highlights 1 starter card on the opening move toward the ★★★ goal.
 * - On later levels introducing a new mechanic: shows a 1-line summary on Match 1 only.
 */
export const computeLiveGuidance = (
  run: RunState,
  opts: { selectedCount?: number; mistakeNote?: string | null; idleNudge?: boolean; seenIntro?: boolean } = {}
): GuidedBoardHint | null => {
  if (run.status !== 'playing' || run.level.rules.sandbox) return null;
  const { selectedCount = 0, mistakeNote = null, idleNudge = false, seenIntro = false } = opts;
  const available = run.board.filter(c => isSelectable(c) && !run.replacing.includes(c.id));
  const sets = allSets(available, run.attributes);

  // ── Level 1-1: Full interactive learn-by-doing flow ────────────────────
  if (run.level.id === '1-1') {
    if (sets.length === 0) return null;

    if (mistakeNote) {
      const rescue = sets[0];
      const glowIds = rescue.map(c => c.id);
      return {
        glowIds,
        dimIds: [],
        dimOpacity: 1,
        message: `${mistakeNote} Try the 3 glowing cards!`,
        mood: 'encourage',
      };
    }

    if (run.matches === 0) {
      // Match 1: pick a same-color or same-shape Set first (easiest visual pattern)
      const sameTrait =
        sets.find(s => s.every(c => c.color === s[0].color)) ??
        sets.find(s => s.every(c => c.shape === s[0].shape)) ??
        sets[0];
      const glowIds = sameTrait.map(c => c.id);
      const dimIds = run.board.filter(c => !glowIds.includes(c.id)).map(c => c.id);
      const progressText =
        selectedCount === 1
          ? 'Nice! Tap the other 2 glowing cards.'
          : selectedCount === 2
            ? '1 more glowing card to make a match!'
            : `Tap the 3 glowing cards! ${describeValidSetWhy(sameTrait, run.attributes)}`;
      return { glowIds, dimIds, dimOpacity: 0.38, message: progressText, mood: 'joy' };
    }

    if (run.matches === 1) {
      // Match 2: prefer an all-different Set so they immediately feel the other half of the rule
      const allDiff = sets.find(s => countDifferentAttributes(s, run.attributes) === run.attributes.length) ?? sets[0];
      const glowIds = allDiff.map(c => c.id);
      const dimIds = run.board.filter(c => !glowIds.includes(c.id)).map(c => c.id);
      const progressText =
        selectedCount > 0
          ? `${3 - selectedCount} more glowing card${3 - selectedCount === 1 ? '' : 's'}!`
          : `Great hit! Now tap these 3 — ${lowerFirst(describeValidSetWhy(allDiff, run.attributes))}`;
      return { glowIds, dimIds, dimOpacity: 0.48, message: progressText, mood: 'joy' };
    }

    if (run.matches === 2) {
      // Match 3: training wheels half-off — light 1 starter card (or all 3 if they pause)
      const target = sets[0];
      const glowIds = idleNudge ? target.map(c => c.id) : [target[0].id];
      return {
        glowIds,
        dimIds: [],
        dimOpacity: 1,
        message: idleNudge
          ? `Here's one! ${describeValidSetWhy(target, run.attributes)}`
          : 'Your turn! Start with the glowing card and pick 2 more that match.',
        mood: 'anticipation',
      };
    }

    // Matches 4 & 5: solo confidence (with gentle idle rescue if stuck)
    const matchesLeft = Math.max(1, Math.ceil(run.foeHp / 3));
    if (idleNudge) {
      const target = sets[0];
      return {
        glowIds: target.map(c => c.id),
        dimIds: [],
        dimOpacity: 1,
        message: `Try these 3! ${describeValidSetWhy(target, run.attributes)}`,
        mood: 'encourage',
      };
    }
    return {
      glowIds: [],
      dimIds: [],
      dimOpacity: 1,
      message: matchesLeft === 1 ? '1 more match to beat Dozy Bunny!' : `${matchesLeft} more matches to beat Dozy Bunny!`,
      mood: 'joy',
    };
  }

  // ── Early World 1 mistake coaching (1-2 .. 1-5) ────────────────────────
  const idx = mainIndexOf(run.level);
  if (mistakeNote && idx > 0 && idx <= 4) {
    return {
      glowIds: [],
      dimIds: [],
      dimOpacity: 1,
      message: mistakeNote,
      mood: 'encourage',
    };
  }

  // ── Opening-move non-blocking coach line on 1-2+ ───────────────────────
  if (run.matches === 0 && !seenIntro) {
    if (run.level.id === '1-2') {
      const redSet = sets.find(s => s.every(c => c.color === 'red'));
      return {
        glowIds: redSet ? [redSet[0].id] : [],
        dimIds: [],
        dimOpacity: 1,
        message: 'Wrong picks cost a ♥! Spot 2 all-red matches for ★★★.',
        mood: 'anticipation',
      };
    }
    if (run.level.id === '1-3') {
      const diffSet = sets.find(s => countDifferentAttributes(s, run.attributes) === run.attributes.length);
      return {
        glowIds: diffSet ? [diffSet[0].id] : [],
        dimIds: [],
        dimOpacity: 1,
        message: 'Mix 3 shapes + 3 colors! Make 2 all-different matches for ★★★.',
        mood: 'anticipation',
      };
    }
    const mech = MECHANICS[run.level.introduces];
    if (mech) {
      return {
        glowIds: [],
        dimIds: [],
        dimOpacity: 1,
        message: `${mech.title}: ${mech.tagline}`,
        mood: 'anticipation',
      };
    }
  }

  return null;
};

// ─── Progressive UI Disclosure Gates ────────────────────────────────────────

const indexAtLeast = (level: LevelDef, targetId: string): boolean => {
  try {
    return mainIndexOf(level) >= mainIndexOf(getLevel(targetId));
  } catch {
    return true;
  }
};

/** Show per-hit damage numbers (`⚔ total`, `best`, `DPM`) once 1-7 (`skill_tree` / `bigHit`) arrives or in practice. */
export const shouldShowDamageNumbers = (level: LevelDef, save: AdventureSave): boolean =>
  !!level.rules.sandbox ||
  indexAtLeast(level, '1-7') ||
  save.seenMechanics.includes('skill_tree') ||
  Object.keys(save.skillNodes).length > 0;

/** Show fighter passive HUD chips once the player reaches 1-5 (2nd fighter), owns >1 fighter, or bought a skill node. */
export const shouldShowPassiveHud = (level: LevelDef, save: AdventureSave): boolean =>
  !level.rules.noGear &&
  (!!level.rules.sandbox || indexAtLeast(level, '1-5') || save.unlockedFighters.length > 1 || Object.keys(save.skillNodes).length > 0);
