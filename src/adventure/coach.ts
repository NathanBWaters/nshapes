/**
 * Interactive Set-rule coaching, cute character voices & progressive UI disclosure.
 *
 * Built around the official SET card game pedagogy (Marsha Jean Falco):
 *  1. The Every-Trait Rule: Check EACH trait one by one — every single trait
 *     must be ALL THE SAME or ALL DIFFERENT across the 3 cards.
 *  2. The "Magic Rule" of SET: "If 2 are alike and 1 is odd, it is NOT a Set!"
 *  3. "Find the Missing 3rd Card": Any 2 cards lock in the exact 3rd card needed
 *     for every trait — shown live with visual TraitCheckPills as you tap!
 *  4. Warm, cute, encouraging animal companions sharing every tip in first-person.
 */
import type { AttributeName, Background, Card, CharacterName, Color, Number as CardNumber, Shading, Shape } from '@/types';
import { isValidCombination } from '@/utils/gameUtils';
import type { AdventureSave, LevelDef, RunState } from './types';
import { allSets, countDifferentAttributes, isSelectable } from './engine/sets';
import { mainIndexOf, getLevel } from './data/levels';
import { levelFoe } from './data/foes';
import { MECHANICS } from './data/mechanics';

export interface TraitCheckPill {
  attr: AttributeName;
  label: string;
  /** `true` = trait passes ✓, `false` = 2+1 Magic Rule broken ✗, `'hint'` = 2-card helper → */
  status: 'pass' | 'fail' | 'hint';
}

export interface GuidedBoardHint {
  glowIds: string[];
  dimIds: string[];
  dimOpacity: number;
  message: string;
  mood: 'curious' | 'victory' | 'anticipation' | 'streak';
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
    win3: 'Purr-fect ★★★!! Every single star is ours — you’re a natural!',
    win2: 'Pawsome knockout!! Peek at my star notes below if you want ★★★ too!',
    win1: 'Yay, stage cleared! Next foe is open — check my notes below for ★★!',
    loss: 'Shake it off, pal! Remember our Magic Rule: never 2 twins + 1 oddball!',
  },
  'Sly Fox': {
    hello: 'Yip-yip!',
    cheer: 'Sharp paws!',
    petName: 'partner',
    win3: 'Yip!! Clean ★★★ sweep — quick eyes and zero mercy!',
    win2: 'Slick knockout, partner! One quick peek below shows how to snag ★★★!',
    win1: 'Nice hustle! We’re through — check my checklist below to get the KO!',
    loss: 'Ooh, sneaky board! Check each trait one by one — we’ll get ’em next run!',
  },
  'Emperor Penguin': {
    hello: 'Waddle on!',
    cheer: 'Brr-illiant!',
    petName: 'friend',
    win3: 'Brr-illiant ★★★!! Cool, steady, and totally unstoppable!',
    win2: 'Cool knockout, friend! Peek below to see how we can ice that 3rd ★!',
    win1: 'Steady flippers! Stage cleared — check my notes below whenever you want ★★!',
    loss: 'Deep breath, friend! Check Shape, Color, and Number one by one — no rush!',
  },
  Badger: {
    hello: 'Huff-hah!',
    cheer: 'Solid hit!',
    petName: 'champ',
    win3: 'Boom — all ★★★, champ!! Nothing stands in our way!',
    win2: 'Tough knockout!! Check my notes below and let’s smash ★★★ too!',
    win1: 'We muscled through! Next stage is open — peek below to claim ★★!',
    loss: 'No sweat, champ! Dust off and check my star notes below — we’ve got thick hides!',
  },
  Corgi: {
    hello: 'Woof!',
    cheer: 'Tail-wagging good!',
    petName: 'bestie',
    win3: 'WOOF!! All ★★★ fetched!! My tail is wagging at maximum speed!',
    win2: 'Yay, big knockout!! Peek below so we can fetch that shiny 3rd ★!',
    win1: 'Good fetch, bestie! Onward we go — check my star notes below for ★★!',
    loss: 'Aww, ruff bounce! Shake it off — check each trait one at a time, we got this!',
  },
  Pelican: {
    hello: 'Ahoy!',
    cheer: 'Eagle-eyed!',
    petName: 'matey',
    win3: 'Ahoy, ★★★!! Smooth sailing and eagle eyes all the way!',
    win2: 'Smooth knockout, matey! Glance below to spot our route to ★★★!',
    win1: 'Clear skies ahead! Stage cleared — my notes below show how to scoop ★★!',
    loss: 'Breezy does it, matey! Scan one trait at a time — the next breeze is ours!',
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

/**
 * Evaluates EVERY active attribute across 3 cards so the player visually sees
 * why all traits pass ✓ — or which exact trait broke the Magic Rule (2 + 1) ✗.
 */
export const evaluateTripleTraits = (
  cards: readonly Card[],
  attributes: readonly AttributeName[]
): TraitCheckPill[] => {
  if (cards.length !== 3) return [];
  // Put color & shape in intuitive visual order first
  const ordered: AttributeName[] = [
    ...(attributes.includes('color') ? (['color'] as const) : []),
    ...(attributes.includes('shape') ? (['shape'] as const) : []),
    ...attributes.filter(a => a !== 'color' && a !== 'shape'),
  ];

  return ordered.map(attr => {
    const vals = cards.map(c => attrValueOf(c, attr));
    const unique = new Set(vals);
    const title = ATTR_TITLE[attr];

    if (unique.size === 1) {
      const v = vals[0];
      const desc =
        attr === 'shape'
          ? `all ${SHAPE_PLURAL[v as Shape]}`
          : attr === 'number'
            ? `all ${v}s`
            : `all ${v}`;
      return { attr, status: 'pass', label: `${title}: ${desc}` };
    }

    if (unique.size === 3) {
      const desc = attr === 'number' ? '1 · 2 · 3' : 'all 3 diff';
      return { attr, status: 'pass', label: `${title}: ${desc}` };
    }

    // unique.size === 2 → Marsha Falco's "Magic Rule": 2 twins + 1 oddball!
    const counts = new Map<string | number, number>();
    for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
    let pairVal: string | number = '';
    let oddVal: string | number = '';
    for (const [v, cnt] of counts.entries()) {
      if (cnt === 2) pairVal = v;
      else oddVal = v;
    }
    const pairText =
      attr === 'shape'
        ? `2 ${SHAPE_PLURAL[pairVal as Shape]}`
        : attr === 'number'
          ? `two ${pairVal}s`
          : `2 ${pairVal}`;
    const oddText = attr === 'number' ? `one ${oddVal}` : `1 ${oddVal}`;
    return { attr, status: 'fail', label: `${title}: ${pairText} + ${oddText}` };
  });
};

const thirdValue = <T extends string | number>(a: T, b: T, domain: readonly T[]): T =>
  a === b ? a : (domain.find(x => x !== a && x !== b) ?? a);

/**
 * Set Enterprises' "Find the Missing 3rd Card" helper:
 * Any 2 cards uniquely determine every trait of the 3rd card!
 */
export const predictThirdCard = (
  pair: readonly Card[],
  attributes: readonly AttributeName[],
  boardCards?: readonly Card[]
): { pills: TraitCheckPill[]; neededSummary: string; existsOnBoard: boolean } | null => {
  if (pair.length !== 2) return null;
  const [a, b] = pair;
  const needed: Partial<Record<AttributeName, string | number>> = {};
  const pills: TraitCheckPill[] = [];

  const ordered: AttributeName[] = [
    ...(attributes.includes('color') ? (['color'] as const) : []),
    ...(attributes.includes('shape') ? (['shape'] as const) : []),
    ...attributes.filter(x => x !== 'color' && x !== 'shape'),
  ];

  for (const attr of ordered) {
    const va = attrValueOf(a, attr);
    const vb = attrValueOf(b, attr);
    const same = va === vb;
    let target: string | number = va;
    if (attr === 'color') target = thirdValue(va as Color, vb as Color, ALL_COLORS);
    else if (attr === 'shape') target = thirdValue(va as Shape, vb as Shape, ALL_SHAPES);
    else if (attr === 'number') target = thirdValue(va as CardNumber, vb as CardNumber, ALL_NUMBERS);
    else if (attr === 'shading') target = thirdValue(va as Shading, vb as Shading, ALL_SHADINGS);
    else if (attr === 'background') target = thirdValue(va as Background, vb as Background, ALL_BACKGROUNDS);

    needed[attr] = target;
    const why = same ? 'both match' : '2 diff';
    const targetText =
      attr === 'number' ? `${target}` : String(target);
    pills.push({
      attr,
      status: 'hint',
      label: `${ATTR_TITLE[attr]} (${why}) → ${targetText}`,
    });
  }

  // Build natural kid-friendly summary of the needed 3rd card (e.g. "a red squiggle" or "2 green ovals")
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

  const unselectedBoard = (boardCards ?? []).filter(c => c.id !== a.id && c.id !== b.id);
  const existsOnBoard =
    boardCards === undefined
      ? true
      : unselectedBoard.some(c => ordered.every(attr => attrValueOf(c, attr) === needed[attr]));

  return { pills, neededSummary, existsOnBoard };
};

/** Short, kid-and-grandma-friendly reason why EVERY trait passes on these 3 valid cards. */
export const describeValidSetWhy = (cards: readonly Card[], attributes: readonly AttributeName[]): string => {
  if (cards.length < 3) return 'Every trait is all the same or all different!';
  const sameColor = cards.every(c => c.color === cards[0].color);
  const sameShape = cards.every(c => c.shape === cards[0].shape);

  if (attributes.length <= 2) {
    if (sameColor && sameShape) return `Every trait matches: all 3 are ${cards[0].color} ${SHAPE_PLURAL[cards[0].shape]}!`;
    if (sameColor) return `Every trait passes: all 3 are ${cards[0].color}, AND all 3 shapes differ!`;
    if (sameShape) return `Every trait passes: all 3 are ${SHAPE_PLURAL[cards[0].shape]}, AND all 3 colors differ!`;
    return 'Every trait is ALL DIFFERENT — 3 colors AND 3 shapes!';
  }

  const diff = countDifferentAttributes([...cards], [...attributes]);
  if (diff === attributes.length) return 'Every single trait is different — Rainbow Strike!';
  const sameParts: string[] = [];
  if (sameColor) sameParts.push(`all ${cards[0].color}`);
  if (sameShape) sameParts.push(`all ${SHAPE_PLURAL[cards[0].shape]}`);
  if (attributes.includes('number') && cards.every(c => c.number === cards[0].number)) {
    sameParts.push(`all ${cards[0].number}s`);
  }
  return sameParts.length > 0
    ? `Every trait passes: ${sameParts.join(' & ')}, and the rest are all different!`
    : 'Every single trait is all same or all different!';
};

/**
 * Warm, encouraging Magic-Rule explanation naming the exact trait(s) that had
 * "2 twins + 1 oddball" so the player never feels scolded and learns fast.
 */
export const explainInvalidPick = (
  cards: readonly Card[],
  attributes: readonly AttributeName[],
  fighter?: CharacterName
): string => {
  const voice = companionVoice(fighter);
  if (cards.length !== 3) {
    return `Check EVERY trait, ${voice.petName} — each one must be all the same or all different!`;
  }
  const check = isValidCombination([...cards], [...attributes]);
  const badList = check.invalidAttributes as AttributeName[];
  const bad = badList[0];
  if (!bad) return 'Every trait must be ALL SAME or ALL DIFFERENT!';

  if (badList.length >= 2) {
    const names = badList.map(a => ATTR_TITLE[a]).join(' & ');
    return `Ooh, close! Magic Rule: ${names} had 2 twins + 1 oddball — EVERY trait must be all same or all different!`;
  }

  const counts = new Map<string | number, number>();
  for (const c of cards) {
    const val = attrValueOf(c, bad);
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
      return `Ooh, super close! Magic Rule: 2 ${pairVal} + 1 ${oddVal} breaks Color — EVERY trait must be all same or all different!`;
    case 'shape':
      return `Almost, ${voice.petName}! Magic Rule: 2 ${SHAPE_PLURAL[pairVal as Shape] ?? `${pairVal}s`} + 1 ${oddVal} breaks Shape — EVERY trait must be all same or all different!`;
    case 'number':
      return `So close! Magic Rule: two ${pairVal}s + a ${oddVal} breaks Number — EVERY trait must be all same or all different!`;
    case 'shading':
      return `Nearly had it! Magic Rule: 2 ${pairVal} + 1 ${oddVal} breaks Shading — EVERY trait must be all same or all different!`;
    default:
      return 'Almost! Every single trait must be ALL SAME or ALL DIFFERENT!';
  }
};

/**
 * Computes live, non-blocking character guidance + visual TraitCheckPills:
 * - On 1-1:
 *   • Match 1: glows 3 same-trait cards, dims other 6, shows ✓ Color & ✓ Shape pills
 *   • Match 2: glows 3 all-different cards, dims other 6, shows ✓ Color & ✓ Shape pills
 *   • Match 3: teaches the Magic Rule ("never 2 + 1!") + live 2-card "Find the 3rd Card" helper!
 *   • Matches 4–5: cute cheering + live 2-card helper + idle rescue net
 * - On 1-2..1-10: mistake rescue with ✓/✗ trait pills + live 2-card helper on 1-2, 1-3, and 1-6 (when Number joins!)
 */
export const computeLiveGuidance = (
  run: RunState,
  opts: {
    selectedCount?: number;
    selectedCards?: readonly Card[];
    mistakeNote?: string | null;
    mistakeCards?: readonly Card[] | null;
    idleNudge?: boolean;
    seenIntro?: boolean;
  } = {}
): GuidedBoardHint | null => {
  if (run.status !== 'playing' || run.level.rules.sandbox) return null;
  const {
    selectedCount = 0,
    selectedCards = [],
    mistakeNote = null,
    mistakeCards = null,
    idleNudge = false,
    seenIntro = false,
  } = opts;
  const voice = companionVoice(run.fighter);
  const available = run.board.filter(c => isSelectable(c) && !run.replacing.includes(c.id));
  const sets = allSets(available, run.attributes);
  const mistakePills =
    mistakeCards && mistakeCards.length === 3 ? evaluateTripleTraits(mistakeCards, run.attributes) : undefined;

  // ── Level 1-1: Full interactive learn-by-doing flow with Orange Tabby ──
  if (run.level.id === '1-1') {
    if (sets.length === 0) return null;

    if (mistakeNote && selectedCount === 0) {
      const rescue = sets[0];
      return {
        glowIds: rescue.map(c => c.id),
        dimIds: [],
        dimOpacity: 1,
        message: `${mistakeNote} Try the 3 glowing cards!`,
        mood: 'anticipation',
        pills: mistakePills ?? evaluateTripleTraits(rescue, run.attributes),
      };
    }

    if (run.matches === 0) {
      const sameTrait =
        sets.find(s => s.every(c => c.color === s[0].color)) ??
        sets.find(s => s.every(c => c.shape === s[0].shape)) ??
        sets[0];
      const glowIds = sameTrait.map(c => c.id);
      const dimIds = run.board.filter(c => !glowIds.includes(c.id)).map(c => c.id);
      const pills = evaluateTripleTraits(sameTrait, run.attributes);
      const progressText =
        selectedCount === 1
          ? `${voice.hello} Nice start! Tap the other 2 glowing cards!`
          : selectedCount === 2
            ? 'Ooh, 1 more glowing card! See how EVERY trait passes below!'
            : `${voice.hello} Tap the 3 glowing cards! ${describeValidSetWhy(sameTrait, run.attributes)}`;
      return { glowIds, dimIds, dimOpacity: 0.38, message: progressText, mood: 'victory', pills };
    }

    if (run.matches === 1) {
      const allDiff = sets.find(s => countDifferentAttributes(s, run.attributes) === run.attributes.length) ?? sets[0];
      const glowIds = allDiff.map(c => c.id);
      const dimIds = run.board.filter(c => !glowIds.includes(c.id)).map(c => c.id);
      const pills = evaluateTripleTraits(allDiff, run.attributes);
      const progressText =
        selectedCount > 0
          ? `Yay! ${3 - selectedCount} more glowing card${3 - selectedCount === 1 ? '' : 's'} to bonk Dozy Bunny!`
          : `${voice.cheer} Now tap these 3! ${describeValidSetWhy(allDiff, run.attributes)}`;
      return { glowIds, dimIds, dimOpacity: 0.48, message: progressText, mood: 'streak', pills };
    }

    // Live "Find the Missing 3rd Card" helper whenever 2 cards are selected on Match 3–5!
    if (selectedCards.length === 2) {
      const pred = predictThirdCard(selectedCards, run.attributes, available);
      if (pred) {
        return {
          glowIds: [],
          dimIds: [],
          dimOpacity: 1,
          message: pred.existsOnBoard
            ? `Ooh, fun pair! Check EVERY trait below — can you spot ${pred.neededSummary}?`
            : `Heads up, ${voice.petName}! Those 2 would need ${pred.neededSummary} (not out right now) — tap one to swap!`,
          mood: 'curious',
          pills: pred.pills,
        };
      }
    }

    if (run.matches === 2) {
      const target = sets[0];
      const glowIds = idleNudge ? target.map(c => c.id) : [target[0].id];
      return {
        glowIds,
        dimIds: [],
        dimOpacity: 1,
        message: idleNudge
          ? `Psst — try these 3! ${describeValidSetWhy(target, run.attributes)}`
          : 'Your turn! Magic Rule: EVERY trait all same or all different (never 2 twins + 1 oddball!). Start with the glowing card!',
        mood: 'curious',
        pills: idleNudge ? evaluateTripleTraits(target, run.attributes) : undefined,
      };
    }

    // Matches 4 & 5: cute cheering + idle rescue net
    const matchesLeft = Math.max(1, Math.ceil(run.foeHp / 3));
    if (idleNudge) {
      const target = sets[0];
      return {
        glowIds: target.map(c => c.id),
        dimIds: [],
        dimOpacity: 1,
        message: `Need a paw? Try these 3! ${describeValidSetWhy(target, run.attributes)}`,
        mood: 'curious',
        pills: evaluateTripleTraits(target, run.attributes),
      };
    }
    return {
      glowIds: [],
      dimIds: [],
      dimOpacity: 1,
      message:
        matchesLeft === 1
          ? `${voice.cheer} Just 1 more Set to beat Dozy Bunny — you’ve got this!`
          : `Woohoo, you’re a natural! ${matchesLeft} more matches to beat Dozy Bunny!`,
      mood: 'victory',
    };
  }

  // ── World 1 Mistake Rescue (shows exact ✓ passed vs ✗ 2+1 broken traits!) ──
  const idx = mainIndexOf(run.level);
  if (mistakeNote && selectedCount === 0 && idx > 0 && idx <= 9) {
    return {
      glowIds: [],
      dimIds: [],
      dimOpacity: 1,
      message: mistakeNote,
      mood: 'anticipation',
      pills: mistakePills,
    };
  }

  // ── Live 2-Card Trait Helper on early levels & when Number joins (1-2, 1-3, 1-6) ──
  if (
    selectedCards.length === 2 &&
    (run.level.id === '1-2' || run.level.id === '1-3' || run.level.id === '1-6')
  ) {
    const pred = predictThirdCard(selectedCards, run.attributes, available);
    if (pred) {
      return {
        glowIds: [],
        dimIds: [],
        dimOpacity: 1,
        message: pred.existsOnBoard
          ? `${voice.hello} Check all ${run.attributes.length} traits — spot ${pred.neededSummary}!`
          : `Hmm! Those 2 need ${pred.neededSummary} (not on the board) — tap a card to swap!`,
        mood: 'curious',
        pills: pred.pills,
      };
    }
  }

  // ── Opening-move cute companion line on 1-2+ ───────────────────────────
  if (run.matches === 0 && !seenIntro) {
    if (run.level.id === '1-2') {
      const redSet = sets.find(s => s.every(c => c.color === 'red'));
      return {
        glowIds: redSet ? [redSet[0].id] : [],
        dimIds: [],
        dimOpacity: 1,
        message: `${voice.hello} Careful — wrong picks cost a ♥ now! Spot 2 all-red Sets for ★★★!`,
        mood: 'curious',
      };
    }
    if (run.level.id === '1-3') {
      const diffSet = sets.find(s => countDifferentAttributes(s, run.attributes) === run.attributes.length);
      return {
        glowIds: diffSet ? [diffSet[0].id] : [],
        dimIds: [],
        dimOpacity: 1,
        message: `${voice.hello} Let’s mix EVERY trait — 3 shapes + 3 colors! Make 2 all-different Sets for ★★★!`,
        mood: 'curious',
      };
    }
    if (run.level.id === '1-6') {
      return {
        glowIds: [],
        dimIds: [],
        dimOpacity: 1,
        message: `${voice.hello} Now check ALL 3 traits (Shape, Color & Number: 1-2-3 or all same)!`,
        mood: 'curious',
      };
    }
    const mech = MECHANICS[run.level.introduces];
    if (mech) {
      return {
        glowIds: [],
        dimIds: [],
        dimOpacity: 1,
        message: `${voice.hello} ${mech.title} — ${mech.tagline}`,
        mood: 'curious',
      };
    }
  }

  return null;
};

// ─── Cute Map, Preview & Results Companion Lines ────────────────────────────

export const companionMapGreeting = (
  save: AdventureSave,
  frontier: LevelDef,
  stars: number,
  showSkillNudge: boolean
): string => {
  const voice = companionVoice(save.selectedFighter);
  if (stars === 0) {
    return `${voice.hello} Tap Dozy Bunny (1-1) to begin! I’ll teach you the Magic Rule of Set right on the board!`;
  }
  if ((save.stars['1-2'] ?? 0) === 0) {
    return `${voice.cheer} I clipped on your new Blast Powder — tap Prickle (1-2) and watch it go boom!`;
  }
  if (showSkillNudge) {
    return `${voice.hello} We earned shiny ★! Tap Camp below so we can power up my Skill Tree!`;
  }
  const foe = levelFoe(frontier);
  if (frontier.id === '1-3') {
    return `${voice.hello} Next up: ${foe.name} (1-3)! Let’s mix 3 different shapes AND 3 different colors!`;
  }
  if (frontier.id === '1-6') {
    return `${voice.hello} ${foe.name} (1-6) brings 1, 2 & 3 symbols — remember: EVERY trait all same or all different!`;
  }
  return `${voice.hello} Ready for ${foe.name} (${frontier.id})? Tap to chase up to ★★★!`;
};

export const companionResultsLine = (
  level: LevelDef,
  run: RunState,
  stars: number,
  coinsUnlocked: boolean
): string => {
  const voice = companionVoice(run.fighter);
  if (level.rules.sandbox) {
    return `${voice.cheer} Great warmup, ${voice.petName}! The dummy’s always here whenever we want to test new builds!`;
  }
  if (stars >= 3) return voice.win3;
  if (stars === 2) return voice.win2;
  if (stars === 1) return voice.win1;
  if (run.coins > 0 && coinsUnlocked) {
    return `${voice.loss} (Good news: we still keep the coins we scooped up!)`;
  }
  return voice.loss;
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
