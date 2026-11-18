/**
 * The companion: what your fighter says and points at while you play.
 *
 * How it teaches (the order matters):
 *  1. Show, then say. The board lights up the cards; the words are one short
 *     line. A new player reads the board, not paragraphs.
 *  2. One idea at a time. The first level walks through "all the same colour",
 *     "all the same shape", "nothing in common", and only then hands over.
 *  3. Never leave a player stuck. When the board has been quiet for a while the
 *     companion points a Set out, one card at a time (data/rules.ts ASSIST_RULES).
 *  4. A mistake is explained with the cards that were picked ("2 red + 1 green"),
 *     never scolded.
 *
 * Every line here is short on purpose: it has to fit a speech bubble next to
 * the fighter on a small phone (about 60 characters).
 */
import type { AttributeName, Background, Card, CharacterName, Color, Number as CardNumber, Shading, Shape } from '@/types';
import { isValidCombination } from '@/utils/gameUtils';
import type { AdventureSave, LevelDef, RunState } from './types';
import { allSets, countDifferentAttributes, isSelectable } from './engine/sets';
import { mainIndexOf, getLevel, MAIN_LEVELS } from './data/levels';
import { levelFoe } from './data/foes';
import { MECHANICS } from './data/mechanics';
import { ASSIST_RULES } from './data/rules';

export interface TraitCheckPill {
  attr: AttributeName;
  label: string;
  /** `pass` = the trait is all the same or all different ✓, `fail` = two alike and one odd ✗, `hint` = what the third card needs → */
  status: 'pass' | 'fail' | 'hint';
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
  },
  'Sly Fox': {
    hello: 'Yip-yip!',
    cheer: 'Sharp paws!',
    petName: 'partner',
    win3: 'Clean sweep, partner. Every shard.',
    win2: 'Slick knockout! One shard still hiding.',
    win1: 'We slipped through. Next time we finish the job.',
    loss: 'Sneaky board. We will get them next run.',
  },
  'Emperor Penguin': {
    hello: 'Waddle on!',
    cheer: 'Brr-illiant!',
    petName: 'friend',
    win3: 'Brr-illiant! Cool, steady, every shard.',
    win2: 'A cool knockout, friend. One shard to go.',
    win1: 'Steady flippers. We are through.',
    loss: 'Deep breath, friend. No rush next time.',
  },
  Badger: {
    hello: 'Huff-hah!',
    cheer: 'Solid hit!',
    petName: 'champ',
    win3: 'Boom! Every shard, champ.',
    win2: 'Tough knockout! One shard left to dig out.',
    win1: 'We muscled through. Next time they go down.',
    loss: 'No sweat, champ. Thick hides, remember?',
  },
  Corgi: {
    hello: 'Woof!',
    cheer: 'Tail-wagging good!',
    petName: 'bestie',
    win3: 'WOOF! Every shard fetched!',
    win2: 'Big knockout! One more shard to fetch.',
    win1: 'Good fetch, bestie! Onward.',
    loss: 'Aww, ruff bounce. Again?',
  },
  Pelican: {
    hello: 'Ahoy!',
    cheer: 'Eagle-eyed!',
    petName: 'matey',
    win3: 'Ahoy! Every shard, smooth sailing.',
    win2: 'Smooth knockout, matey. One shard adrift.',
    win1: 'Clear skies ahead. We are through.',
    loss: 'Breezy does it, matey. The next wind is ours.',
  },
};

export const companionVoice = (fighter?: CharacterName): CompanionVoice =>
  (fighter && COMPANION_VOICES[fighter]) || COMPANION_VOICES['Orange Tabby'];

const SHAPE_PLURAL: Record<Shape, string> = {
  diamond: 'diamonds',
  oval: 'ovals',
  squiggle: 'squiggles',
};

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

/** Colour and shape first: they are what the eye sees first. */
const inReadingOrder = (attributes: readonly AttributeName[]): AttributeName[] => [
  ...(attributes.includes('color') ? (['color'] as const) : []),
  ...(attributes.includes('shape') ? (['shape'] as const) : []),
  ...attributes.filter(a => a !== 'color' && a !== 'shape'),
];

/** "2 red" / "2 ovals" / "two 2s" and "1 green" / "1 diamond" / "one 3" for a trait that is two alike and one odd. */
const twoAndOne = (cards: readonly Card[], attr: AttributeName): { pair: string; odd: string } => {
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
  if (attr === 'shape') return { pair: `2 ${SHAPE_PLURAL[pairVal as Shape] ?? `${pairVal}s`}`, odd: `1 ${oddVal}` };
  if (attr === 'number') return { pair: `two ${pairVal}s`, odd: `one ${oddVal}` };
  return { pair: `2 ${pairVal}`, odd: `1 ${oddVal}` };
};

/**
 * Every active trait across three cards: which pass (all the same or all
 * different) and which are two alike and one odd.
 */
export const evaluateTripleTraits = (
  cards: readonly Card[],
  attributes: readonly AttributeName[]
): TraitCheckPill[] => {
  if (cards.length !== 3) return [];
  return inReadingOrder(attributes).map(attr => {
    const vals = cards.map(c => attrValueOf(c, attr));
    const unique = new Set(vals);
    const title = ATTR_TITLE[attr];

    if (unique.size === 1) {
      const v = vals[0];
      const desc = attr === 'shape' ? `all ${SHAPE_PLURAL[v as Shape]}` : attr === 'number' ? `all ${v}s` : `all ${v}`;
      return { attr, status: 'pass', label: `${title}: ${desc}` };
    }
    if (unique.size === 3) {
      return { attr, status: 'pass', label: `${title}: ${attr === 'number' ? '1 · 2 · 3' : 'all different'}` };
    }
    const { pair, odd } = twoAndOne(cards, attr);
    return { attr, status: 'fail', label: `${title}: ${pair} + ${odd}` };
  });
};

const thirdValue = <T extends string | number>(a: T, b: T, domain: readonly T[]): T =>
  a === b ? a : (domain.find(x => x !== a && x !== b) ?? a);

/**
 * Any two cards decide the third: for each trait, the same value if the two
 * agree, the missing value if they differ.
 */
export const predictThirdCard = (
  pair: readonly Card[],
  attributes: readonly AttributeName[],
  boardCards?: readonly Card[]
): { pills: TraitCheckPill[]; neededSummary: string; existsOnBoard: boolean; cardId: string | null } | null => {
  if (pair.length !== 2) return null;
  const [a, b] = pair;
  const needed: Partial<Record<AttributeName, string | number>> = {};
  const pills: TraitCheckPill[] = [];
  const ordered = inReadingOrder(attributes);

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
    pills.push({ attr, status: 'hint', label: `${ATTR_TITLE[attr]}: ${va === vb ? 'same' : 'different'} → ${target}` });
  }

  // "a red squiggle", "2 green ovals"
  const num = needed.number as CardNumber | undefined;
  const shade = needed.shading as Shading | undefined;
  const col = needed.color as Color | undefined;
  const shp = needed.shape as Shape | undefined;
  const words: string[] = [];
  if (shade) words.push(shade);
  if (col) words.push(col);
  if (shp) words.push(num && num > 1 ? SHAPE_PLURAL[shp] : shp);
  const core = words.join(' ') || 'matching card';
  const neededSummary = num ? `${num} ${core}` : /^[aeiou]/i.test(core) ? `an ${core}` : `a ${core}`;

  const others = (boardCards ?? []).filter(c => c.id !== a.id && c.id !== b.id);
  const found = others.find(c => ordered.every(attr => attrValueOf(c, attr) === needed[attr]));
  return { pills, neededSummary, existsOnBoard: boardCards === undefined ? true : !!found, cardId: found?.id ?? null };
};

/** One short line on why three cards are a Set: "All red.", "All ovals.", "Nothing in common!" */
export const describeValidSetWhy = (cards: readonly Card[], attributes: readonly AttributeName[]): string => {
  if (cards.length < 3) return 'Each trait is all the same or all different.';
  const diff = countDifferentAttributes([...cards], [...attributes]);
  if (diff === attributes.length) return 'Nothing in common!';
  const same: string[] = [];
  if (attributes.includes('color') && cards.every(c => c.color === cards[0].color)) same.push(cards[0].color);
  if (attributes.includes('shape') && cards.every(c => c.shape === cards[0].shape)) same.push(SHAPE_PLURAL[cards[0].shape]);
  if (attributes.includes('number') && cards.every(c => c.number === cards[0].number)) same.push(`${cards[0].number}s`);
  if (attributes.includes('shading') && cards.every(c => c.shading === cards[0].shading)) same.push(cards[0].shading);
  return same.length > 0 ? `All ${same.join(', all ')}.` : 'Each trait is all the same or all different.';
};

/**
 * Why three cards were not a Set, in the cards' own words: "Almost! Color was
 * 2 red + 1 green." Never a scolding. (The trait checks under it show which
 * traits passed.)
 */
export const explainInvalidPick = (
  cards: readonly Card[],
  attributes: readonly AttributeName[],
  _fighter?: CharacterName
): string => {
  const rule = 'Each trait: all the same or all different.';
  if (cards.length !== 3) return rule;
  const bad = (isValidCombination([...cards], [...attributes]).invalidAttributes as AttributeName[]) ?? [];
  if (bad.length === 0) return rule;
  if (bad.length >= 2) {
    const names = inReadingOrder(bad).map(a => ATTR_TITLE[a]).join(' and ');
    return `Not a Set: ${names} were 2 alike + 1 odd.`;
  }
  const { pair, odd } = twoAndOne(cards, bad[0]);
  return `Almost! ${ATTR_TITLE[bad[0]]} was ${pair} + ${odd}.`;
};

// ─── Stuck help ─────────────────────────────────────────────────────────────

/** Seconds without a Set before the companion lights 1, 2, then 3 cards of one; null where it stays out of it. */
export const assistStepsFor = (level: LevelDef): readonly number[] | null => {
  if (level.rules.sandbox) return null;
  if (level.id === MAIN_LEVELS[0].id) return ASSIST_RULES.firstLevel;
  if (level.biome === 'meadow') return level.rules.attributes.length <= 2 ? ASSIST_RULES.twoTraits : ASSIST_RULES.threeTraits;
  if (level.biome === 'woods') return ASSIST_RULES.secondWorld;
  return null;
};

/** How many cards of a Set the companion is pointing out right now (0 = none yet). */
export const assistCardsFor = (level: LevelDef, quietMs: number): number => {
  const steps = assistStepsFor(level);
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

const RESCUE_LINES = ['Stuck? Start with this one.', 'These two go together…', 'Here is one. Tap all three!'];

/** What the companion says as each of the first level's Sets lands */
const FIRST_LEVEL_PRAISE = ['That is a Set!', 'Same shape works too!', 'All different works too!', 'You found one yourself!', 'Yes!'];

// ─── Live guidance ──────────────────────────────────────────────────────────

/**
 * What the companion says and lights up right now, or null when there is
 * nothing to add. Pure: it reads the fight and what the player is holding.
 *
 * The first level is a walk-through. After it: an opening line, an
 * explanation after a mistake, "find: a red oval" while two cards are held
 * (early levels), and stuck help when the board has been quiet too long.
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
  } = {}
): GuidedBoardHint | null => {
  if (run.status !== 'playing' || run.level.rules.sandbox) return null;
  const { selectedCount = 0, selectedCards = [], mistakeNote = null, mistakeCards = null, seenIntro = false, noAssist = false } = opts;
  const voice = companionVoice(run.fighter);
  const available = run.board.filter(c => isSelectable(c) && !run.replacing.includes(c.id));
  const sets = allSets(available, run.attributes);
  const first = run.level.id === MAIN_LEVELS[0].id;
  const idx = mainIndexOf(run.level);
  const quietMs = run.elapsedMs - run.lastMatchAtMs;
  const assist = noAssist ? 0 : assistCardsFor(run.level, quietMs);
  const mistakePills = mistakeCards && mistakeCards.length === 3 ? evaluateTripleTraits(mistakeCards, run.attributes) : undefined;
  const others = (glow: string[]) => run.board.filter(c => !glow.includes(c.id)).map(c => c.id);

  /** Light the first `n` cards of a Set (the ones already held count as lit) */
  const rescue = (n: number): GuidedBoardHint | null => {
    const target = helpfulSet(run, sets, selectedCards);
    if (!target) return null;
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
      pills: whole ? evaluateTripleTraits(target, run.attributes) : undefined,
    };
  };

  // ── 1-1: the walk-through ────────────────────────────────────────────────
  if (first) {
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

    // The Set just made is still leaving the board: praise it, and point at nothing until the next cards are dealt
    if (run.replacing.length > 0 && run.matches > 0) {
      return { glowIds: [], dimIds: [], dimOpacity: 1, message: FIRST_LEVEL_PRAISE[Math.min(run.matches, FIRST_LEVEL_PRAISE.length) - 1], mood: 'victory', kind: 'cheer' };
    }

    // The words name what the three cards share; the board shows the rest
    const guided = (target: Card[], message: string, dimOpacity: number, mood: GuidedBoardHint['mood']): GuidedBoardHint => {
      const glowIds = target.map(c => c.id);
      return { glowIds, dimIds: others(glowIds), dimOpacity, message, mood, kind: 'lesson' };
    };

    // Step 1: three cards of one colour
    if (run.matches === 0) {
      const target = sets.find(s => s.every(c => c.color === s[0].color)) ?? sets[0];
      const sameColor = target.every(c => c.color === target[0].color);
      const ask = sameColor ? `Tap the 3 ${target[0].color} cards!` : 'Tap the 3 glowing cards!';
      return guided(target, selectedCount === 0 ? `${voice.hello} ${ask}` : selectedCount === 1 ? 'Two more!' : 'One more!', 0.38, 'victory');
    }

    // Step 2: three cards of one shape
    if (run.matches === 1) {
      const target = sets.find(s => s.every(c => c.shape === s[0].shape) && !s.every(c => c.color === s[0].color)) ?? sets[0];
      const sameShape = target.every(c => c.shape === target[0].shape);
      const ask = sameShape ? `Now the 3 ${SHAPE_PLURAL[target[0].shape]}.` : 'Now these three.';
      return guided(target, selectedCount === 0 ? ask : selectedCount === 1 ? 'Two more!' : 'One more!', 0.45, 'streak');
    }

    // Step 3: three cards with nothing in common
    if (run.matches === 2) {
      const target = sets.find(s => countDifferentAttributes(s, run.attributes) === run.attributes.length) ?? sets[0];
      return guided(target, selectedCount === 0 ? 'Now 3 with nothing in common!' : selectedCount === 1 ? 'Two more!' : 'One more!', 0.52, 'streak');
    }

    // Steps 4 and 5: their turn, with a net under them
    if (selectedCards.length === 2) {
      const pred = predictThirdCard(selectedCards, run.attributes, available);
      if (pred && !pred.existsOnBoard) {
        return { glowIds: [], dimIds: [], dimOpacity: 1, message: `No ${pred.neededSummary.replace(/^an? /, '')} out there. Swap one!`, mood: 'curious', kind: 'pair' };
      }
      if (pred) {
        // A pair that works: after a moment, the card that finishes it lights up
        const lit = assist > 0 && pred.cardId ? [pred.cardId] : [];
        return { glowIds: lit, dimIds: [], dimOpacity: 1, message: `Find ${pred.neededSummary}!`, mood: 'curious', kind: 'pair' };
      }
    }
    if (assist > 0) return rescue(assist);
    const left = Math.max(1, Math.ceil(run.foeHp / 3));
    return {
      glowIds: [],
      dimIds: [],
      dimOpacity: 1,
      message: run.matches === 3 ? 'Your turn! All the same, or all different.' : left === 1 ? `${voice.cheer} One more Set wins it!` : `${voice.cheer} ${left} more to go!`,
      mood: run.matches === 3 ? 'curious' : 'victory',
      kind: run.matches === 3 ? 'lesson' : 'cheer',
    };
  }

  // ── After a mistake (World 1): what went wrong, with the picked cards ────
  if (mistakeNote && selectedCount === 0 && idx > 0 && idx <= 9) {
    return { glowIds: [], dimIds: [], dimOpacity: 1, message: mistakeNote, mood: 'anticipation', kind: 'mistake', pills: mistakePills };
  }

  // ── Stuck help: the board has been quiet too long ────────────────────────
  if (assist > 0) {
    const help = rescue(assist);
    if (help) return help;
  }

  // ── Two cards held (while the rule is still new): name the third ─────────
  if (selectedCards.length === 2 && run.level.biome === 'meadow' && idx <= 5) {
    const pred = predictThirdCard(selectedCards, run.attributes, available);
    if (pred) {
      return {
        glowIds: [],
        dimIds: [],
        dimOpacity: 1,
        message: pred.existsOnBoard ? `Find ${pred.neededSummary}!` : `No ${pred.neededSummary.replace(/^an? /, '')} out there. Swap one!`,
        mood: 'curious',
        kind: 'pair',
      };
    }
  }

  // ── The opening line of a level that teaches something ───────────────────
  if (run.matches === 0 && !seenIntro) {
    const mech = MECHANICS[run.level.introduces];
    if (mech) {
      const target = helpfulSet(run, sets, []);
      // Where the level's ★★★ asks for a kind of Set, the first card of one is lit as a head start
      const wantsKind = ['colorSets', 'sameColorSets', 'allDiffSets', 'rainbows'].includes(run.level.challenge.kind);
      return {
        glowIds: wantsKind && target && run.level.biome === 'meadow' ? [target[0].id] : [],
        dimIds: [],
        dimOpacity: 1,
        message: mech.coach ?? `${mech.title}: ${mech.tagline}`,
        mood: 'curious',
        kind: 'opening',
      };
    }
  }

  return null;
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
  if (stars === 0) return `${voice.hello} ${foe.name} found a star shard. Let’s win it back!`;
  if (showSkillNudge) return `${voice.hello} We have shards to spend. Camp is open!`;
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

/** Damage totals (`⚔ total`, `best`, damage per minute) appear once 1-7 asks for a big hit, or in practice. */
export const shouldShowDamageNumbers = (level: LevelDef, save: AdventureSave): boolean =>
  !!level.rules.sandbox ||
  indexAtLeast(level, '1-7') ||
  save.seenMechanics.includes('skill_tree') ||
  Object.keys(save.skillNodes).length > 0;

/** Fighter passives appear once the player reaches 1-5 (a second fighter), owns two fighters, or has bought a skill node. */
export const shouldShowPassiveHud = (level: LevelDef, save: AdventureSave): boolean =>
  !level.rules.noGear &&
  (!!level.rules.sandbox || indexAtLeast(level, '1-5') || save.unlockedFighters.length > 1 || Object.keys(save.skillNodes).length > 0);
