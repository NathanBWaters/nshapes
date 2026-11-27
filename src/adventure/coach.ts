/**
 * The companion: what your fighter says and points at while you play.
 *
 * How it teaches (the order matters):
 *  1. Show, then say. The board lights up the cards; the words are one short
 *     line. A new player reads the board, not paragraphs.
 *  2. The rule is checked one trait at a time, every time. A Set is three cards
 *     where EACH trait is all the same or all different, so nothing here ever
 *     says "three red cards are a Set": a Set that is lit, made or missed is
 *     shown with a check per trait ("Color: all red ✓  Shape: all different ✓").
 *     Three of one color is only a Set because the shapes pass too, and a player
 *     who learns the shortcut is lost the moment a third trait arrives.
 *  3. One idea at a time. The first level shows the three ways two traits can
 *     pass (same color, same shape, nothing alike), then hands over with the
 *     rule. The level that adds a trait shows one Set checked on all three.
 *  4. Never leave a player stuck. When the board has been quiet for a while the
 *     companion points a Set out, one card at a time (data/rules.ts ASSIST_RULES).
 *  5. A mistake is explained with the cards that were picked ("2 red + 1 green"),
 *     never scolded.
 *
 * Every line here is short on purpose: it has to fit a speech bubble next to
 * the fighter on a small phone (about 60 characters).
 */
import type { AttributeName, Background, Card, CharacterName, Color, Number as CardNumber, Shading, Shape } from '@/types';
import { cardBgPatternMeta, cardColorLabel } from '@/utils/cardColors';
import { formatParryCounterMeta, formatShapeName } from '@/utils/cardVisuals';
import { isValidCombination } from '@/utils/gameUtils';
import type { AdventureSave, FeatureFlag, LevelDef, ParryState, RunState } from './types';
import { allSets, countDifferentAttributes, isSelectable } from './engine/sets';
import { mainIndexOf, getLevel, MAIN_LEVELS } from './data/levels';
import { worldNumber } from './data/biomes';
import { readyMapKeys } from './data/mapKeys';
import { levelFoe } from './data/foes';
import { MECHANICS } from './data/mechanics';
import { ASSIST_RULES, SURGE_RULES } from './data/rules';
import { LOSS_STREAK_ASSIST_STEPS, STUCK_NUDGE_LOSS_THRESHOLD } from './data/relief';
import { getArmoryWeapon } from './data/armory';
import { evolutionConditionShort, getWeaponEvolution } from './data/evolutions';
import { availableStars, COACH_KEYS, hasUnspentStars } from './progress';

/** One trait's check across the cards in question (the fight shows them in a strip above the board: TraitChecks.tsx). */
export interface TraitCheckPill {
  attr: AttributeName;
  /** The whole check in words: "Color: all red" */
  label: string;
  /** The same for a cell that already shows the trait's name: "all red", "2 red + 1 green", "red (same)" */
  detail: string;
  /** As short as it gets, for a narrow cell: "all red", "2 + 1", "red" */
  brief: string;
  /** `pass` = all same/different ✓, `fail` = two alike + one odd ✗, `hint` = 3rd card needs →, `info` = 1 card selected • */
  status: 'pass' | 'fail' | 'hint' | 'info';
}

/** What the companion is doing right now (the HUD tints the bubble by it) */
export type GuidanceKind = 'lesson' | 'opening' | 'pair' | 'rescue' | 'mistake' | 'cheer';

export interface GuidedBoardHint {
  glowIds: string[];
  dimIds: string[];
  dimOpacity: number;
  message: string;
  mood: 'curious' | 'victory' | 'anticipation' | 'streak';
  kind: GuidanceKind;
  /** The trait checks of the cards this is about (shown in the strip above the board while the rule is new) */
  pills?: TraitCheckPill[];
}

export interface CompanionVoice {
  hello: string;
  cheer: string;
  petName: string;
  win3: string;
  win2: string;
  win1: string;
  loss: string;
  /** Mid-fight character-voiced combat quips ([OB-15]) */
  halfway: string;
  wobble: string;
  streak: string;
  lowHeart: string;
}

export const COMPANION_VOICES: Record<CharacterName, CompanionVoice> = {
  'Orange Tabby': {
    hello: 'Meow!',
    cheer: 'Purr-fect!',
    petName: 'pal',
    win3: 'Purr-fect! Every shard is ours.',
    win2: 'Knocked out cold! One shard left in there.',
    win1: 'We made it through! That one is still standing, though.',
    loss: 'Shake it off, pal. We go again.',
    halfway: 'Halfway there — claws out!',
    wobble: '{foe} is wobbling — pounce!',
    streak: 'Purr-fect rhythm — keep rolling!',
    lowHeart: 'One heart left — stay sharp, pal!',
  },
  'Sly Fox': {
    hello: 'Yip-yip!',
    cheer: 'Sharp paws!',
    petName: 'partner',
    win3: 'Clean sweep, partner. Every shard.',
    win2: 'Slick knockout! One shard still hiding.',
    win1: 'We slipped through. Next time we finish the job.',
    loss: 'Sneaky board. We will get them next run.',
    halfway: 'Halfway down — keep the heat on!',
    wobble: '{foe} is cornered — finish it!',
    streak: 'Slick streak, partner!',
    lowHeart: 'Down to one heart — pick clean!',
  },
  'Emperor Penguin': {
    hello: 'Waddle on!',
    cheer: 'Brr-illiant!',
    petName: 'friend',
    win3: 'Brr-illiant! Cool, steady, every shard.',
    win2: 'A cool knockout, friend. One shard to go.',
    win1: 'Steady flippers. We are through.',
    loss: 'Deep breath, friend. No rush next time.',
    halfway: 'Halfway — cool and steady!',
    wobble: '{foe} is slipping — stay crisp!',
    streak: 'Brr-illiant flow, friend!',
    lowHeart: 'One heart left — breathe steady!',
  },
  Badger: {
    hello: 'Huff-hah!',
    cheer: 'Solid hit!',
    petName: 'champ',
    win3: 'Boom! Every shard, champ.',
    win2: 'Tough knockout! One shard left to dig out.',
    win1: 'We muscled through. Next time they go down.',
    loss: 'No sweat, champ. Thick hides, remember?',
    halfway: 'Halfway chewed through — dig in!',
    wobble: '{foe} is buckling — smash it!',
    streak: 'Unstoppable momentum, champ!',
    lowHeart: 'Thick hide holds — one heart left!',
  },
  Corgi: {
    hello: 'Woof!',
    cheer: 'Tail-wagging good!',
    petName: 'bestie',
    win3: 'WOOF! Every shard fetched!',
    win2: 'Big knockout! One more shard to fetch.',
    win1: 'Good fetch, bestie! Onward.',
    loss: 'Aww, ruff bounce. Again?',
    halfway: 'Tail wagging — halfway there!',
    wobble: '{foe} is wobbling — fetch the KO!',
    streak: 'Zoomies mode — on a roll!',
    lowHeart: 'One heart left — eyes sharp, bestie!',
  },
  Pelican: {
    hello: 'Ahoy!',
    cheer: 'Eagle-eyed!',
    petName: 'matey',
    win3: 'Ahoy! Every shard, smooth sailing.',
    win2: 'Smooth knockout, matey. One shard adrift.',
    win1: 'Clear skies ahead. We are through.',
    loss: 'Breezy does it, matey. The next wind is ours.',
    halfway: 'Halfway across — wind at our backs!',
    wobble: '{foe} is listing — swoop in!',
    streak: 'Smooth sailing — on a roll!',
    lowHeart: 'One heart left — steady helm, matey!',
  },
};

export const companionVoice = (fighter?: CharacterName): CompanionVoice =>
  (fighter && COMPANION_VOICES[fighter]) || COMPANION_VOICES['Orange Tabby'];

const shapeWord = (s: Shape, plural = false): string => formatShapeName(s, plural).toLowerCase();

const ALL_SHAPES: readonly Shape[] = ['diamond', 'oval', 'squiggle'];
const ALL_COLORS: readonly Color[] = ['red', 'green', 'purple'];
const ALL_NUMBERS: readonly CardNumber[] = [1, 2, 3];
const ALL_SHADINGS: readonly Shading[] = ['solid', 'striped', 'open'];
const ALL_BACKGROUNDS: readonly Background[] = ['white', 'beige', 'charcoal'];

const ATTR_TITLE: Record<AttributeName, string> = {
  color: 'Color',
  shape: 'Shape',
  number: 'Number',
  shading: 'Shading',
  background: 'Back',
};

const attrValueOf = (card: Card, attr: AttributeName): string | number =>
  attr === 'background' ? (card.background ?? 'white') : card[attr];

const traitWord = (attr: AttributeName, value: string | number, colorblind: boolean, plural = false): string => {
  if (attr === 'shape') return shapeWord(value as Shape, plural);
  if (attr === 'color') return cardColorLabel(String(value), colorblind);
  if (attr === 'background') return cardBgPatternMeta(String(value), colorblind).word;
  return String(value);
};

/** Colour and shape first: they are what the eye sees first. */
const inReadingOrder = (attributes: readonly AttributeName[]): AttributeName[] => [
  ...(attributes.includes('color') ? (['color'] as const) : []),
  ...(attributes.includes('shape') ? (['shape'] as const) : []),
  ...attributes.filter(a => a !== 'color' && a !== 'shape'),
];

/** "2 red" / "2 ovals" / "two 2s" and "1 green" / "1 diamond" / "one 3" for a trait that is two alike and one odd. */
const twoAndOne = (cards: readonly Card[], attr: AttributeName, colorblind = false): { pair: string; odd: string } => {
  const counts = new Map<string | number, number>();
  for (const c of cards) {
    const v = attrValueOf(c, attr);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let pairVal: string | number = '';
  let oddVal: string | number = '';
  for (const [v, n] of counts.entries()) {
    if (n === 2) pairVal = v;
    else oddVal = v;
  }
  if (attr === 'shape') return { pair: `2 ${shapeWord(pairVal as Shape, true)}`, odd: `1 ${shapeWord(oddVal as Shape)}` };
  if (attr === 'number') return { pair: `two ${pairVal}s`, odd: `one ${oddVal}` };
  return { pair: `2 ${traitWord(attr, pairVal, colorblind)}`, odd: `1 ${traitWord(attr, oddVal, colorblind)}` };
};

/**
 * Every active trait across three cards: which pass (all the same or all
 * different) and which are two alike and one odd.
 */
export const evaluateTripleTraits = (
  cards: readonly Card[],
  attributes: readonly AttributeName[],
  colorblind = false
): TraitCheckPill[] => {
  if (cards.length !== 3) return [];
  return inReadingOrder(attributes).map(attr => {
    const vals = cards.map(c => attrValueOf(c, attr));
    const unique = new Set(vals);
    const title = ATTR_TITLE[attr];

    if (unique.size === 1) {
      const v = vals[0];
      const desc = attr === 'shape' ? `all ${shapeWord(v as Shape, true)}` : attr === 'number' ? `all ${v}s` : `all ${traitWord(attr, v, colorblind)}`;
      return { attr, status: 'pass', label: `${title}: ${desc}`, detail: desc, brief: desc };
    }
    if (unique.size === 3) {
      const desc = attr === 'number' ? '1 · 2 · 3' : 'all different';
      return { attr, status: 'pass', label: `${title}: ${desc}`, detail: desc, brief: desc };
    }
    const { pair, odd } = twoAndOne(cards, attr, colorblind);
    return { attr, status: 'fail', label: `${title}: ${pair} + ${odd}`, detail: `${pair} + ${odd}`, brief: '2 + 1' };
  });
};

/** One card held: its active traits in reading order so the player learns what to scan. */
export const describeSingleCardTraits = (
  card: Card,
  attributes: readonly AttributeName[],
  colorblind = false
): TraitCheckPill[] =>
  inReadingOrder(attributes).map(attr => {
    const val = traitWord(attr, attrValueOf(card, attr), colorblind);
    return {
      attr,
      status: 'info',
      label: `${ATTR_TITLE[attr]}: ${val}`,
      detail: val,
      brief: val,
    };
  });

const thirdValue = <T extends string | number>(a: T, b: T, domain: readonly T[]): T =>
  a === b ? a : (domain.find(x => x !== a && x !== b) ?? a);

/**
 * Any two cards decide the third: for each trait, the same value if the two
 * agree, the missing value if they differ.
 */
export const predictThirdCard = (
  pair: readonly Card[],
  attributes: readonly AttributeName[],
  boardCards?: readonly Card[],
  colorblind = false
): { pills: TraitCheckPill[]; neededSummary: string; existsOnBoard: boolean; cardId: string | null; identicalPair: boolean } | null => {
  if (pair.length !== 2) return null;
  const [a, b] = pair;
  const needed: Partial<Record<AttributeName, string | number>> = {};
  const pills: TraitCheckPill[] = [];
  const ordered = inReadingOrder(attributes);
  const identicalPair = ordered.every(attr => attrValueOf(a, attr) === attrValueOf(b, attr));

  for (const attr of ordered) {
    const va = attrValueOf(a, attr);
    const vb = attrValueOf(b, attr);
    let target: string | number = va;
    if (attr === 'color') target = thirdValue(va as Color, vb as Color, ALL_COLORS);
    else if (attr === 'shape') target = thirdValue(va as Shape, vb as Shape, ALL_SHAPES);
    else if (attr === 'number') target = thirdValue(va as CardNumber, vb as CardNumber, ALL_NUMBERS);
    else if (attr === 'shading') target = thirdValue(va as Shading, vb as Shading, ALL_SHADINGS);
    else if (attr === 'background') target = thirdValue(va as Background, vb as Background, ALL_BACKGROUNDS);

    needed[attr] = target;
    const how = va === vb ? 'same' : 'different';
    const shownTarget = traitWord(attr, target, colorblind);
    pills.push({ attr, status: 'hint', label: `${ATTR_TITLE[attr]}: ${how} → ${shownTarget}`, detail: `${shownTarget} (${how})`, brief: `${shownTarget}` });
  }

  // "an orange bolt", "2 blue circles"
  const num = needed.number as CardNumber | undefined;
  const shade = needed.shading as Shading | undefined;
  const col = needed.color as Color | undefined;
  const shp = needed.shape as Shape | undefined;
  const words: string[] = [];
  if (shade) words.push(shade);
  if (col) words.push(cardColorLabel(col, colorblind));
  if (shp) words.push(shapeWord(shp, Boolean(num && num > 1)));
  const core = words.join(' ') || 'matching card';
  const neededSummary = num ? `${num} ${core}` : /^[aeiou]/i.test(core) ? `an ${core}` : `a ${core}`;

  const others = (boardCards ?? []).filter(c => c.id !== a.id && c.id !== b.id);
  const found = others.find(c => ordered.every(attr => attrValueOf(c, attr) === needed[attr]));
  return { pills, neededSummary, existsOnBoard: boardCards === undefined ? true : !!found, cardId: found?.id ?? null, identicalPair };
};

/** The rule, as the companion says it when there are no cards to show it with */
const RULE_LINE = 'Each trait: all the same or all different.';

/**
 * Why three cards are a Set, in the rule's own two phrases and with every
 * trait accounted for: "All red, all different shapes." / "All different
 * colors and shapes, 1-2-3." (Naming only what the cards share, "All red.",
 * teaches a shortcut that stops working at three traits.)
 */
export const describeValidSetWhy = (cards: readonly Card[], attributes: readonly AttributeName[], colorblind = false): string => {
  if (cards.length !== 3) return RULE_LINE;
  const same: string[] = [];
  const different: string[] = [];
  let counted = '';
  for (const attr of inReadingOrder(attributes)) {
    const vals = cards.map(c => attrValueOf(c, attr));
    const distinct = new Set(vals).size;
    if (distinct === 2) return RULE_LINE;
    if (distinct === 3) {
      if (attr === 'number') counted = '1-2-3';
      else different.push(attr === 'color' ? 'colors' : attr === 'shape' ? 'shapes' : attr === 'shading' ? 'shadings' : 'backgrounds');
    } else if (attr === 'shape') same.push(`all ${shapeWord(vals[0] as Shape, true)}`);
    else if (attr === 'number') same.push(`all ${vals[0]}s`);
    else if (attr === 'background') same.push('one background');
    else same.push(`all ${traitWord(attr, vals[0], colorblind)}`);
  }
  const parts = [...same, ...(different.length > 0 ? [`all different ${different.join(' and ')}`] : []), ...(counted ? [counted] : [])];
  // (what the cards share comes first, unless nothing is shared)
  const line = parts.join(', ');
  return line ? `${line[0].toUpperCase()}${line.slice(1)}.` : RULE_LINE;
};

/**
 * Why three cards were not a Set, in the cards' own words: "Almost! Color was
 * 2 red + 1 green." (or "2 orange + 1 blue." in Colorblind Mode). Never a scolding.
 */
export const explainInvalidPick = (
  cards: readonly Card[],
  attributes: readonly AttributeName[],
  _fighter?: CharacterName,
  colorblind = false
): string => {
  const rule = RULE_LINE;
  if (cards.length !== 3) return rule;
  const bad = (isValidCombination([...cards], [...attributes]).invalidAttributes as AttributeName[]) ?? [];
  if (bad.length === 0) return rule;
  if (bad.length >= 2) {
    const names = inReadingOrder(bad).map(a => ATTR_TITLE[a]).join(' and ');
    return `Not a Set: ${names} were 2 alike + 1 odd.`;
  }
  const { pair, odd } = twoAndOne(cards, bad[0], colorblind);
  return `Almost! ${ATTR_TITLE[bad[0]]} was ${pair} + ${odd}.`;
};

// ─── Stuck help ─────────────────────────────────────────────────────────────

/** [OB-11] Single-card 28s safety net for 3-1 (Fourth Dimension) Shading Surge onboarding. */
export const THIRD_WORLD_INTRO_ASSIST_STEPS: readonly number[] = [28];

/** Seconds without a Set before the companion lights 1, 2, then 3 cards of one; null where it stays out of it. */
export const assistStepsFor = (level: LevelDef, consecutiveLosses = 0): readonly number[] | null => {
  if (level.rules.sandbox) return null;
  if (level.id === MAIN_LEVELS[0].id) return ASSIST_RULES.firstLevel;
  if (level.biome === 'meadow') return level.rules.attributes.length <= 2 ? ASSIST_RULES.twoTraits : ASSIST_RULES.threeTraits;
  if (level.biome === 'woods') return ASSIST_RULES.secondWorld;
  // [GP-18] World 3–5 3-loss stuck nudge: softly light 1 card after 25s quiet without spoiling the Set
  if (consecutiveLosses >= STUCK_NUDGE_LOSS_THRESHOLD) return LOSS_STREAK_ASSIST_STEPS;
  // [OB-11] 3-1 Shading Surge onboarding safety net so 4-trait introduction never leaves players cold
  if (level.id === '3-1' || level.introduces === 'shading_surge') return THIRD_WORLD_INTRO_ASSIST_STEPS;
  return null;
};

/** How many cards of a Set the companion is pointing out right now (0 = none yet). */
export const assistCardsFor = (level: LevelDef, quietMs: number, consecutiveLosses = 0): number => {
  const steps = assistStepsFor(level, consecutiveLosses);
  if (!steps) return 0;
  return steps.filter(s => quietMs >= s * 1000).length;
};

/**
 * The Set worth pointing out: one that moves the level's ★★★ challenge when
 * the board has one (an all-red Set on the all-red level), else one that uses
 * the cards the player is already holding, else the first.
 */
const helpfulSet = (run: RunState, sets: Card[][], held: readonly Card[]): Card[] | null => {
  if (sets.length === 0) return null;
  const withHeld = held.length > 0 ? sets.filter(s => held.every(h => s.some(c => c.id === h.id))) : [];
  const pool = withHeld.length > 0 ? withHeld : sets;
  const c = run.level.challenge;
  const wanted = (s: Card[]): boolean => {
    switch (c.kind) {
      case 'colorSets': return s.every(x => x.color === c.color);
      case 'sameColorSets': return s.every(x => x.color === s[0].color);
      case 'allDiffSets':
      case 'rainbows': return countDifferentAttributes(s, run.attributes) === run.attributes.length;
      default: return false;
    }
  };
  return (run.challengeMet ? undefined : pool.find(wanted)) ?? pool[0];
};

/** What a plain Set deals: three cards, 2 base damage each */
const BASE_SET_DAMAGE = 6;

const RESCUE_LINES = ['Stuck? Start with this one.', 'These two go together…', 'Here is one. Tap all three!'];

/** The rule, handed over once the first level has shown it three ways (the strip above the board names the traits) */
const YOUR_TURN_LINE = 'Your turn! Each trait: all same, or all different.';

/**
 * The ways two traits can pass, in the order the first level shows them: one
 * color (three shapes), one shape (three colors), nothing alike.
 */
type SetLook = 'color' | 'shape' | 'different' | 'other';
const WALK_THROUGH: readonly SetLook[] = ['color', 'shape', 'different'];

const lookOf = (set: readonly Card[], attributes: readonly AttributeName[]): SetLook => {
  if (set.length !== 3) return 'other';
  if (countDifferentAttributes([...set], [...attributes]) === attributes.length) return 'different';
  const oneColor = set.every(c => c.color === set[0].color);
  const oneShape = set.every(c => c.shape === set[0].shape);
  return oneColor && !oneShape ? 'color' : oneShape && !oneColor ? 'shape' : 'other';
};

/** What the companion says as each of the first level's Sets lands: the first is a Set, the next two are other ways to make one. */
const firstLevelPraise = (matches: number, look: SetLook): string => {
  if (matches <= 1) return 'That is a Set!';
  if (matches <= 3) {
    return look === 'shape' ? 'Same shape works too!' : look === 'different' ? 'Nothing alike works too!' : look === 'color' ? 'Same color works too!' : 'A Set again!';
  }
  return matches === 4 ? 'You found one yourself!' : 'Yes!';
};

/** Compact 2-trait summary for the 1-1 walk-through speech bubble (<= 60 chars). */
const shortWhy = (cards: readonly Card[], attributes: readonly AttributeName[], colorblind = false): string => {
  const look = lookOf(cards, attributes);
  if (look === 'color') return `all ${cardColorLabel(cards[0].color, colorblind)}, 3 shapes`;
  if (look === 'shape') return `all ${shapeWord(cards[0].shape, true)}, 3 colors`;
  if (look === 'different') return '3 colors & 3 shapes';
  const why = describeValidSetWhy(cards, attributes, colorblind).replace(/\.$/, '');
  return `${why[0].toLowerCase()}${why.slice(1)}`;
};

/**
 * The trait checks of the Set just made, when every one passes (a near miss
 * that a grace saved is not shown as a Set); otherwise nothing to show.
 */
export const checksOfSet = (
  cards: readonly Card[] | null | undefined,
  attributes: readonly AttributeName[],
  colorblind = false
): TraitCheckPill[] | undefined => {
  if (!cards || cards.length !== 3) return undefined;
  const pills = evaluateTripleTraits(cards, attributes, colorblind);
  return pills.length > 0 && pills.every(p => p.status === 'pass') ? pills : undefined;
};

/**
 * While the rule is still new (the first level through the one after Number
 * arrives), the fight keeps it in sight: a strip above the board with a cell
 * per trait, which checks every Set that is lit, made or missed.
 */
export const showsTraitChecks = (level: LevelDef): boolean =>
  !level.rules.sandbox && level.biome === 'meadow' && mainIndexOf(level) >= 0 && mainIndexOf(level) <= 5;

/** The trait a main level plays on that the level before it did not (Number at 1-5), if any. */
export const traitAddedBy = (level: LevelDef): AttributeName | null => {
  const idx = MAIN_LEVELS.findIndex(l => l.id === level.id);
  if (idx <= 0) return null;
  const before = MAIN_LEVELS[idx - 1].rules.attributes;
  return level.rules.attributes.find(a => !before.includes(a)) ?? null;
};

/**
 * The Set that shows a new trait best: one where the new trait is all
 * different (1-2-3) and as little else changes as the board allows.
 */
const exampleOfTrait = (sets: Card[][], trait: AttributeName, attributes: readonly AttributeName[]): Card[] => {
  const cost = (s: Card[]) => (new Set(s.map(c => attrValueOf(c, trait))).size === 3 ? 0 : 10) + countDifferentAttributes(s, [...attributes]);
  return sets.reduce((best, s) => (cost(s) < cost(best) ? s : best), sets[0]);
};

// ─── Live guidance ──────────────────────────────────────────────────────────

/**
 * What the companion says and lights up right now, or null when there is
 * nothing to add. Pure: it reads the fight and what the player is holding.
 *
 * The first level is a walk-through. After it: an opening line (a whole Set,
 * lit, on the level that adds a trait), an explanation after a mistake,
 * "find: a red oval" while two cards are held (early levels), and stuck help
 * when the board has been quiet too long. Whatever three cards it is about,
 * `pills` checks them one trait at a time.
 */
export const computeLiveGuidance = (
  run: RunState,
  opts: {
    selectedCount?: number;
    selectedCards?: readonly Card[];
    mistakeNote?: string | null;
    mistakeCards?: readonly Card[] | null;
    /** The opening line was read (tapped away) */
    seenIntro?: boolean;
    /** The foe has switched auto-hints off (Masked Bandit): no stuck help either */
    noAssist?: boolean;
    /** Colorblind Mode active: emit Orange / Blue / Pink & Mist / Dark color words */
    colorblind?: boolean;
    /** Consecutive losses on this level (enables 25s 1-card stuck nudge on World 3–5 at >= 3 losses) */
    consecutiveLosses?: number;
    /** Number of Shading Surges already guided (0 or 1 enables 5s 1-card Surge nudge per [OB-11]) */
    surgeGuidedCount?: number;
  } = {}
): GuidedBoardHint | null => {
  if (run.status !== 'playing' || run.level.rules.sandbox) return null;
  const {
    selectedCount = 0,
    selectedCards = [],
    mistakeNote = null,
    mistakeCards = null,
    seenIntro = false,
    noAssist = false,
    colorblind = false,
    consecutiveLosses = 0,
    surgeGuidedCount = 2,
  } = opts;
  const voice = companionVoice(run.fighter);
  const available = run.board.filter(c => isSelectable(c) && !run.replacing.includes(c.id));
  const sets = allSets(available, run.attributes);
  const first = run.level.id === MAIN_LEVELS[0].id;
  const idx = mainIndexOf(run.level);
  const quietMs = run.elapsedMs - run.lastMatchAtMs;
  const assist = noAssist ? 0 : assistCardsFor(run.level, quietMs, consecutiveLosses);
  const mistakePills = mistakeCards && mistakeCards.length === 3 ? evaluateTripleTraits(mistakeCards, run.attributes, colorblind) : undefined;
  const others = (glow: string[]) => run.board.filter(c => !glow.includes(c.id)).map(c => c.id);
  /** While the rule is still new, two held cards are answered with the card that finishes them */
  const ruleIsNew = showsTraitChecks(run.level);

  /** Light the first `n` cards of a Set (the ones already held count as lit) */
  const rescue = (n: number): GuidedBoardHint | null => {
    const target = helpfulSet(run, sets, selectedCards);
    if (!target) return null;
    if (selectedCards.length > 0 && !sets.some(s => selectedCards.every(h => s.some(c => c.id === h.id)))) {
      return {
        glowIds: [target[0].id],
        dimIds: [],
        dimOpacity: 1,
        message: 'No Set with that card. Swap to this!',
        mood: 'curious',
        kind: 'rescue',
      };
    }
    const held = new Set(selectedCards.map(c => c.id));
    const ordered = [...target.filter(c => held.has(c.id)), ...target.filter(c => !held.has(c.id))];
    const lit = ordered.slice(0, Math.max(n, Math.min(3, held.size + 1)));
    const whole = lit.length >= 3;
    return {
      glowIds: lit.map(c => c.id),
      dimIds: [],
      dimOpacity: 1,
      message: RESCUE_LINES[Math.min(RESCUE_LINES.length, lit.length) - 1],
      mood: 'curious',
      kind: 'rescue',
      pills: whole ? evaluateTripleTraits(target, run.attributes, colorblind) : undefined,
    };
  };

  /** Two cards held: the card that finishes the Set, worked out one trait at a time */
  const pairHelp = (lightAfterAWhile: boolean): GuidedBoardHint | null => {
    const pred = selectedCards.length === 2 ? predictThirdCard(selectedCards, run.attributes, available, colorblind) : null;
    if (!pred) return null;
    const missing = !pred.existsOnBoard;
    let message: string;
    if (missing) {
      message = pred.identicalPair
        ? 'Identical pair! Swap one card.'
        : `No ${pred.neededSummary.replace(/^an? /, '')} out there. Swap one!`;
    } else if (run.level.introduces === 'rainbow' && pred.pills.every(p => p.label.includes('different'))) {
      const rainbowMsg = `Rainbow! Find ${pred.neededSummary}!`;
      message = rainbowMsg.length <= 60 ? rainbowMsg : `Find ${pred.neededSummary}!`;
    } else {
      message = `Find ${pred.neededSummary}!`;
    }
    return {
      // A pair that works: after a moment, the card that finishes it lights up
      glowIds: !missing && lightAfterAWhile && assist > 0 && pred.cardId ? [pred.cardId] : [],
      dimIds: [],
      dimOpacity: 1,
      message,
      mood: 'curious',
      kind: 'pair',
      pills: pred.pills,
    };
  };

  // ── 1-1: the walk-through ────────────────────────────────────────────────
  if (first) {
    // The Set just made is still leaving the board: praise it with its checks, and point at nothing until the next cards are dealt
    if (run.replacing.length > 0 && run.matches > 0) {
      const leaving = run.board.filter(c => run.replacing.includes(c.id));
      return {
        glowIds: [],
        dimIds: [],
        dimOpacity: 1,
        message: firstLevelPraise(run.matches, lookOf(leaving, run.attributes)),
        mood: 'victory',
        kind: 'cheer',
        pills: checksOfSet(leaving, run.attributes, colorblind),
      };
    }

    if (sets.length === 0) return null;

    // A wrong pick: say why with the cards they picked, and light a Set to try
    if (mistakeNote && selectedCount === 0) {
      const target = helpfulSet(run, sets, []) ?? sets[0];
      return {
        glowIds: target.map(c => c.id),
        dimIds: [],
        dimOpacity: 1,
        message: `${mistakeNote} Try these!`,
        mood: 'anticipation',
        kind: 'mistake',
        pills: mistakePills,
      };
    }

    // Three Sets are shown, one way of passing at a time. The words name BOTH traits, and the strip above the
    // board says the same thing trait by trait: three red cards are a Set because the shapes pass too.
    if (run.matches < WALK_THROUGH.length) {
      const step = run.matches;
      // (the dealer keeps every kind of Set on the board; if this one is missing all the same, the next kind is shown)
      const wanted = [WALK_THROUGH[step], ...WALK_THROUGH].find(look => sets.some(s => lookOf(s, run.attributes) === look));
      const target = sets.find(s => lookOf(s, run.attributes) === wanted) ?? sets[0];
      const why = shortWhy(target, run.attributes, colorblind);
      const ask = step === 0 ? `${voice.hello} Tap these 3: ${why}!` : step === 1 ? `Now these 3: ${why}!` : `And these 3: ${why}!`;
      const glowIds = target.map(c => c.id);
      return {
        glowIds,
        dimIds: others(glowIds),
        dimOpacity: [0.38, 0.45, 0.52][step],
        message: selectedCount === 0 ? ask : selectedCount === 1 ? 'Two more!' : 'One more!',
        mood: step === 0 ? 'victory' : 'streak',
        kind: 'lesson',
        pills: evaluateTripleTraits(target, run.attributes, colorblind),
      };
    }

    // Their turn, with a net under them
    const pair = pairHelp(true);
    if (pair) return pair;
    if (assist > 0) return rescue(assist);
    const left = Math.max(1, Math.ceil(run.foeHp / BASE_SET_DAMAGE));
    const handover = run.matches === WALK_THROUGH.length;
    return {
      glowIds: [],
      dimIds: [],
      dimOpacity: 1,
      message: handover ? YOUR_TURN_LINE : left === 1 ? `${voice.cheer} One more Set wins it!` : `${voice.cheer} ${left} more to go!`,
      mood: handover ? 'curious' : 'victory',
      kind: handover ? 'lesson' : 'cheer',
    };
  }

  // ── After a mistake (World 1): what went wrong, with the picked cards ────
  if (mistakeNote && selectedCount === 0 && idx > 0 && idx <= 9) {
    return { glowIds: [], dimIds: [], dimOpacity: 1, message: mistakeNote, mood: 'anticipation', kind: 'mistake', pills: mistakePills };
  }

  // ── Two cards held: name the third (and light it if assist > 0); beats rescue so we never steer into a miss ──
  if (selectedCards.length === 2 && (ruleIsNew || assist > 0)) {
    const pair = pairHelp(assist > 0);
    if (pair) return pair;
  }

  // ── [OB-11] First 2 Shading Surges ever: glow 1 card of a 4-trait Set after 5s of Surge silence ──
  if (run.surge?.active && !noAssist && surgeGuidedCount < 2 && sets.length > 0) {
    const surgeElapsedMs = SURGE_RULES.surgeMs - run.surge.msLeft;
    if (surgeElapsedMs >= 5000 && quietMs >= 5000) {
      const target = helpfulSet(run, sets, selectedCards) ?? sets[0];
      const held = new Set(selectedCards.map(c => c.id));
      const pick = target.find(c => !held.has(c.id)) ?? target[0];
      return {
        glowIds: [pick.id],
        dimIds: [],
        dimOpacity: 1,
        message: 'Shading Surge +12 & ×1.8! Start with this card!',
        mood: 'curious',
        kind: 'rescue',
      };
    }
  }

  // ── Stuck help: the board has been quiet too long ────────────────────────
  if (assist > 0) {
    const help = rescue(assist);
    if (help) return help;
  }

  // ── The end is in sight: say so (it is the moment to choose a Set with care) ──
  if (run.level.biome === 'meadow' && run.foeHp > 0 && run.matches > 0 && selectedCount === 0) {
    if (run.foeHp <= BASE_SET_DAMAGE) {
      return { glowIds: [], dimIds: [], dimOpacity: 1, message: `${voice.cheer} One more Set does it!`, mood: 'victory', kind: 'cheer' };
    }
    if (run.movesLeft === 1) {
      return { glowIds: [], dimIds: [], dimOpacity: 1, message: 'Last move. Make it count!', mood: 'anticipation', kind: 'cheer' };
    }
  }

  // ── The opening of a level that teaches something ────────────────────────
  if (run.matches === 0) {
    const mech = MECHANICS[run.level.introduces];
    const line = mech ? mech.coach ?? `${mech.title}: ${mech.tagline}` : null;
    // A new trait: one Set is lit whole and checked on every trait, so the rule is seen to carry over to it
    const added = traitAddedBy(run.level);
    if (line && added && sets.length > 0 && !noAssist) {
      const target = exampleOfTrait(sets, added, run.attributes);
      return { glowIds: target.map(c => c.id), dimIds: [], dimOpacity: 1, message: line, mood: 'curious', kind: 'lesson', pills: evaluateTripleTraits(target, run.attributes, colorblind) };
    }
    if (line && !seenIntro) {
      const target = helpfulSet(run, sets, []);
      // Where the level's ★★★ asks for a kind of Set, the first card of one is lit as a head start
      const wantsKind = ['colorSets', 'sameColorSets', 'allDiffSets', 'rainbows'].includes(run.level.challenge.kind);
      return {
        glowIds: wantsKind && target && run.level.biome === 'meadow' ? [target[0].id] : [],
        dimIds: [],
        dimOpacity: 1,
        message: line,
        mood: 'curious',
        kind: 'opening',
      };
    }
  }

  return null;
};

// ─── Passing remarks ────────────────────────────────────────────────────────

/**
 * Things your fighter remarks on as a fight goes by: the foe at half health,
 * the foe wobbling, the ★★★ goal done, a run of quick Sets, the last heart.
 * Each is said once per fight (per wave for the foe's health), only when
 * nothing more useful is being said, and is gone in a moment. They keep the
 * stage alive and tell the player how the fight is going without a number.
 *
 * Returns every remark that is true right now, most important first; the
 * fight screen says the first one it has not said yet.
 */
export const fightRemarks = (run: RunState, challengeMet: boolean): { key: string; text: string }[] => {
  if (run.status !== 'playing' || run.level.rules.sandbox || run.level.id === MAIN_LEVELS[0].id) return [];
  const voice = companionVoice(run.fighter);
  const out: { key: string; text: string }[] = [];
  if (run.hearts === 1 && (run.maxHearts ?? 0) > 1) out.push({ key: 'last-heart', text: voice.lowHeart });
  if (challengeMet && run.level.challenge.kind !== 'enemy') out.push({ key: 'goal', text: `${voice.cheer} Three-star goal: done!` });
  const share = run.foeMaxHp > 0 ? run.foeHp / run.foeMaxHp : 1;
  if (run.foeHp > BASE_SET_DAMAGE && share <= 0.25) {
    const wobbleText = voice.wobble.replace('{foe}', run.foeName);
    out.push({ key: `wobble-${run.wave}`, text: wobbleText.length <= 64 ? wobbleText : `${run.foeName} is wobbling!` });
  } else if (run.foeHp > 0 && share <= 0.5) {
    out.push({ key: `half-${run.wave}`, text: voice.halfway });
  }
  if (run.combo >= 3) out.push({ key: 'roll', text: voice.streak });
  return out;
};

/** [OB-15] Short mid-fight foe bark on Bosses & Tier 3+ Elites at 50% HP or Staggered. */
export const foeMidFightBark = (run: RunState): { key: string; text: string } | null => {
  if (run.status !== 'playing' || run.level.rules.sandbox) return null;
  if (!run.level.isBoss && run.foe.tier < 3) return null;
  if (run.parry?.phase === 'staggered') {
    return { key: `foe-stagger-${run.wave}`, text: 'Gah! My guard shattered!' };
  }
  const share = run.foeMaxHp > 0 ? run.foeHp / run.foeMaxHp : 1;
  if (run.foeHp > 0 && share <= 0.5) {
    return {
      key: `foe-half-${run.wave}`,
      text: run.level.isBoss ? 'Not bad… now feel my full power!' : 'Hold still, pesky critter!',
    };
  }
  return null;
};

/**
 * [OB-10] First-ever live Set-Parry & Counter-Parry StageBubble callout.
 * Fires in both Adventure Mode and Starfall Summit on a player's first wind-up,
 * first golden Perfect window, and first specific Counter-Parry (colorblind-aware).
 */
export const parryOnboardingCallout = (
  parry: ParryState | null,
  opts: {
    colorblind?: boolean;
    seenWindup: boolean;
    seenPerfect: boolean;
    seenCounter: boolean;
  }
): { key: string; text: string } | null => {
  if (!parry || parry.phase !== 'windup') return null;
  const isSpecific = parry.spec.counter.kind !== 'any';
  if (isSpecific) {
    if (opts.seenCounter) return null;
    const meta = formatParryCounterMeta(parry.spec.counter, opts.colorblind);
    const full = `${parry.spec.attackName}! Match ${meta.shortLabel} to Counter & Stagger!`;
    const short = `${parry.spec.attackName}! Match ${meta.shortLabel} to Counter!`;
    return {
      key: COACH_KEYS.counterParryFirst,
      text: full.length <= 64 ? full : short,
    };
  }
  if (parry.msLeft <= parry.spec.perfectWindowMs && !opts.seenPerfect) {
    return {
      key: COACH_KEYS.parryFirstPerfect,
      text: 'Gold glow! Match now for PERFECT PARRY (+16 & ×1.35)!',
    };
  }
  if (!opts.seenWindup) {
    return {
      key: COACH_KEYS.parryFirstWindup,
      text: `${parry.spec.attackName} coming! Match ANY Set to Parry!`,
    };
  }
  return null;
};

/** One-shot coach keys for per-weapon evolution anticipation and boss weapon-slot unlocks. */
export const EVO_ALMOST_COACH_KEY = 'evo_almost_first';
export const WEAPON_SLOT_UNLOCK_COACH_KEY = 'weapon_slot_unlock_first';

/**
 * First-time live callout when any equipped weapon hits "Almost Ready" on its
 * micro-objective evolution tracker (progress === target - 1 or >= 75%).
 */
export const evoAlmostOnboardingCallout = (
  run: RunState,
  opts: { seenEvoAlmost: boolean; colorblind?: boolean }
): { key: string; text: string } | null => {
  if (opts.seenEvoAlmost || run.status !== 'playing' || run.level.rules.sandbox) return null;
  const ready = run.weaponEvolutions.find(t => t.phase === 'charging' && t.almostReady);
  if (!ready) return null;
  const weapon = run.weapons.find(w => w.id === ready.weaponId) ?? getArmoryWeapon(ready.weaponId);
  const evoDef = getWeaponEvolution(ready.evoId);
  const weaponName = weapon?.name ?? ready.weaponId;
  const condShort = evoDef ? evolutionConditionShort(evoDef, opts.colorblind) : '';
  const withCond = condShort ? `1 step to evolve ${weaponName}! (${condShort})` : '';
  const text = withCond && withCond.length <= 64 ? withCond : `1 more step to evolve ${weaponName}!`;
  return { key: EVO_ALMOST_COACH_KEY, text };
};

/**
 * Celebratory companion line when clearing World 1 Boss (4th slot) or World 2 Boss (5th slot).
 */
export const weaponSlotUnlockCoachLine = (
  slotNumber: 4 | 5,
  fighter?: CharacterName
): { key: string; text: string } => {
  const voice = companionVoice(fighter);
  const text =
    slotNumber === 4
      ? `${voice.cheer} 4th weapon slot unlocked — add a new Synergy partner!`
      : `${voice.cheer} 5th weapon slot unlocked — unleash a full-belt engine!`;
  return { key: `${WEAPON_SLOT_UNLOCK_COACH_KEY}_${slotNumber}`, text };
};

// ─── Context-aware defeat & 1★ build diagnostics ([OB-17]) ──────────────────

export interface ResultTipAction {
  label: string;
  kind: 'open_armory' | 'open_tree' | 'open_workshop';
  payload?: string;
}

export interface ResultDiagnostic {
  text: string;
  quickAction?: ResultTipAction;
}

/**
 * Pure post-fight diagnostic replacing stale hard-coded tips in LevelResults & DefeatOverlay.
 * Never recommends traits, weapons, or systems the player has not unlocked yet.
 */
export const diagnoseResultTip = (
  level: LevelDef,
  run: RunState,
  stars: number,
  save: AdventureSave,
  colorblind = false
): ResultDiagnostic | null => {
  if (level.rules.sandbox) return null;
  const won = stars > 0;
  const accuracy = level.starRule?.kind === 'accuracy';

  if (!won) {
    // Priority 1: Too many mistakes — list ONLY active traits of this level!
    if (run.mistakes > 3) {
      const activeNames = inReadingOrder(level.rules.attributes).map(a => ATTR_TITLE[a]);
      const joined =
        activeNames.length <= 1
          ? (activeNames[0] ?? 'Shape')
          : `${activeNames.slice(0, -1).join(', ')}, then ${activeNames[activeNames.length - 1]}`;
      const surgeNote = level.rules.shadingSurge ? ' (plus Shading during Surge)' : '';
      return {
        text: `Check one trait at a time: ${joined}${surgeNote} — all the same or all different!`,
      };
    }

    // Priority 2: Unused or un-triggered Weapon Evolution on World 2–5 defeat -> "Tune Evolutions" Camp Armory CTA
    const unlockedEvos = save.unlockedWeaponEvolutions ?? [];
    if (worldNumber(level.biome) >= 2 && unlockedEvos.length > 0) {
      if (run.weaponEvolutions.length === 0) {
        const evoDef = unlockedEvos.map(getWeaponEvolution).find(Boolean);
        const wName = evoDef ? (getArmoryWeapon(evoDef.weaponId)?.name ?? evoDef.weaponId) : 'a weapon';
        return {
          text: `No Evolution equipped on your belt! Slot ${wName} in Camp to chase its timed Evolution.`,
          quickAction: {
            label: 'Tune Evolutions',
            kind: 'open_armory',
            payload: evoDef?.weaponId,
          },
        };
      }
      if (run.evolutionsTriggered === 0) {
        const firstTracker = run.weaponEvolutions[0];
        const evoDef = getWeaponEvolution(firstTracker.evoId);
        const wName = getArmoryWeapon(firstTracker.weaponId)?.name ?? firstTracker.weaponId;
        if (evoDef) {
          const cond = evolutionConditionShort(evoDef, colorblind);
          return {
            text: `Chase ${wName}’s goal (${cond}) to ignite ${evoDef.name}, or swap Evolutions at Camp!`,
            quickAction: {
              label: 'Tune Evolutions',
              kind: 'open_armory',
              payload: firstTracker.weaponId,
            },
          };
        }
      }
    }

    // Priority 3: Unspent Skill Tree Stars (ONLY once Skill Trees are unlocked AND stars are spendable!)
    const treeUnlocked =
      save.seenMechanics.includes('skill_tree') ||
      (save.stars['1-7'] ?? 0) >= 1 ||
      Object.keys(save.skillNodes).length > 0;
    if (treeUnlocked && hasUnspentStars(save)) {
      const selAvail = availableStars(save, save.selectedFighter);
      const targetFighter =
        selAvail > 0
          ? save.selectedFighter
          : (save.unlockedFighters.find(f => availableStars(save, f) > 0) ?? save.selectedFighter);
      const avail = availableStars(save, targetFighter);
      if (avail > 0) {
        return {
          text: `You have ${avail}★ ready for ${targetFighter}’s Skill Tree at Camp!`,
          quickAction: {
            label: `Open ${targetFighter}’s Tree`,
            kind: 'open_tree',
            payload: targetFighter,
          },
        };
      }
    }

    // Priority 4: Unspent Workshop Coins (100% free refund)
    if (save.workshopUnlocked && save.coins >= 60) {
      return {
        text: `You have ${save.coins.toLocaleString()}¢ ready for Workshop tuning & Evolution Lab upgrades (100% free refund anytime).`,
        quickAction: {
          label: 'Open Workshop',
          kind: 'open_workshop',
        },
      };
    }

    // Priority 5: Unparried Strikes — tailored counter tip (colorblind-aware)
    if (run.parry && run.parry.parries === 0) {
      const meta = formatParryCounterMeta(run.parry.spec.counter, colorblind);
      return {
        text:
          run.parry.spec.counter.kind === 'any'
            ? `Match any Trio during ${run.parry.spec.attackName} to Parry & open a ×1.35 Stagger (+8 base)!`
            : `Counter ${run.parry.spec.attackName} with ${meta.shortLabel} to shatter the strike & Stagger!`,
      };
    }

    return {
      text: 'Take a breath and scan one color or shape first — clean Sets build momentum fast!',
    };
  }

  // 1★ survival tip: NEVER recommend Rainbow Charm before the player actually owns it!
  if (stars === 1 && !accuracy) {
    if (save.armory.includes('rainbow-charm')) {
      if (run.weapons.some(w => w.id === 'rainbow-charm')) {
        return { text: 'Hunt all-different Trios so Rainbow Charm supercharges your hits!' };
      }
      return { text: 'Equip Rainbow Charm on your Weapon Belt so all-different Trios hit much harder!' };
    }
    if (save.armory.length > 0) {
      return { text: 'Equip synergistic weapons from your Armory so every Trio hits harder!' };
    }
    return null;
  }

  return null;
};

// ─── Dynamic 1-4D Back Field practice rules ([OB-11]) ───────────────────────

/**
 * Resolve `1-4D` (The Back Field) so it only exposes traits and features the
 * player has actually unlocked in `save` (A2 + 9 cards until `1-5` / `attr_number`,
 * Hints/Graces/Evolutions only once unlocked).
 */
export const resolvePracticeLevel = (level: LevelDef, save: AdventureSave): LevelDef => {
  if (!level.rules.sandbox || level.id !== '1-4D') return level;
  const hasNumber = (save.stars['1-5'] ?? 0) >= 1 || save.seenMechanics.includes('attr_number');
  const hasHints = (save.stars['2-4'] ?? 0) >= 1 || save.seenMechanics.includes('hints');
  const hasGraces = (save.stars['2-8'] ?? 0) >= 1 || save.seenMechanics.includes('graces');
  return {
    ...level,
    rules: {
      ...level.rules,
      attributes: hasNumber ? ['shape', 'color', 'number'] : ['shape', 'color'],
      boardSize: hasNumber ? 12 : 9,
      startingHints: hasHints ? (level.rules.startingHints ?? 3) : 0,
      startingGraces: hasGraces ? (level.rules.startingGraces ?? 2) : 0,
    },
  };
};

/** Matching feature flags for `1-4D` so locked HUD buttons (Hints/Graces/Evolutions) never leak prematurely. */
export const resolvePracticeFeatures = (level: LevelDef, save: AdventureSave): Set<FeatureFlag> | undefined => {
  if (!level.rules.sandbox || level.id !== '1-4D') return undefined;
  const flags = new Set<FeatureFlag>(['hearts', 'gear']);
  if ((save.stars['1-6'] ?? 0) >= 1 || save.seenMechanics.includes('rainbow')) flags.add('rainbow');
  if (save.coinsUnlocked) flags.add('coins');
  if ((save.stars['2-4'] ?? 0) >= 1 || save.seenMechanics.includes('hints')) flags.add('hints');
  if ((save.stars['2-8'] ?? 0) >= 1 || save.seenMechanics.includes('graces')) flags.add('graces');
  if ((save.unlockedWeaponEvolutions?.length ?? 0) > 0 || save.seenMechanics.includes('evolutions')) flags.add('evolutions');
  if ((save.stars['2-5'] ?? 0) >= 1 || save.seenMechanics.includes('power_cards')) flags.add('power');
  return flags;
};

// ─── Map, preview & results lines ───────────────────────────────────────────

export const companionMapGreeting = (
  save: AdventureSave,
  frontier: LevelDef,
  stars: number,
  showSkillNudge: boolean
): string => {
  const voice = companionVoice(save.selectedFighter);
  const foe = levelFoe(frontier);
  const readyKeys = readyMapKeys(save);
  if (readyKeys.length > 0) {
    return `${voice.hello} A Golden Key is waiting on the road! Tap it to free a friend!`;
  }
  if (stars === 0) return `${voice.hello} ${foe.name} is blocking the road. Let’s go save our friends!`;
  if (showSkillNudge) return `${voice.hello} We have Star Shards to spend. Camp is open!`;
  if (frontier.isBoss) return `${foe.name} is next. The big one. Ready, ${voice.petName}?`;
  if (!save.seenMechanics.includes(frontier.introduces)) {
    return `${foe.name} is next, with something new: ${MECHANICS[frontier.introduces]?.title ?? 'a surprise'}.`;
  }
  return `${foe.name} is next. Ready when you are, ${voice.petName}!`;
};

export const companionResultsLine = (
  level: LevelDef,
  run: RunState,
  stars: number,
  coinsUnlocked: boolean
): string => {
  const voice = companionVoice(run.fighter);
  if (level.rules.sandbox) return `${voice.cheer} The dummy is always here when we want to try a build.`;
  if (stars >= 3) return voice.win3;
  if (stars === 2) return voice.win2;
  // The foe is still standing: if it was close, say how close (a near miss is the best reason to try again)
  const hpLeft = Math.max(1, Math.ceil(run.foeHp));
  const close = run.foeHp > 0 && run.foeMaxHp > 0 && run.foeHp / run.foeMaxHp <= 0.25;
  if (close) return `So close! ${run.foeName} had just ${hpLeft} HP left.`;
  if (stars === 1) return voice.win1;
  if (run.coins > 0 && coinsUnlocked) return `${voice.loss} (We keep the coins we scooped up.)`;
  return voice.loss;
};

// ─── What the HUD shows, and when ───────────────────────────────────────────

const indexAtLeast = (level: LevelDef, targetId: string): boolean => {
  try {
    return mainIndexOf(level) >= mainIndexOf(getLevel(targetId));
  } catch {
    return true;
  }
};

/** [OB-11] Damage totals (`⚔ total`, `best`) appear from 1-4 (Boom Practice) so 1-7 focuses cleanly on Skill Trees. */
export const shouldShowDamageNumbers = (level: LevelDef, save: AdventureSave): boolean =>
  !!level.rules.sandbox ||
  indexAtLeast(level, '1-4') ||
  save.seenMechanics.includes('charm') ||
  save.seenMechanics.includes('skill_tree') ||
  Object.keys(save.skillNodes).length > 0;

/** Fighter passives appear once the player reaches 1-5 (a second fighter), owns two fighters, or has bought a skill node. */
export const shouldShowPassiveHud = (level: LevelDef, save: AdventureSave): boolean =>
  !level.rules.noGear &&
  (!!level.rules.sandbox || indexAtLeast(level, '1-5') || save.unlockedFighters.length > 1 || Object.keys(save.skillNodes).length > 0);
