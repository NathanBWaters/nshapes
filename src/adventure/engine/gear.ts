/**
 * Trick weapons: weapons with something to hunt for or keep up, and a little
 * state of their own (data/adventureWeapons.ts, "Trick weapons").
 *
 * Their numbers arrive as modifiers (rules/types.ts `Modifiers`), so a trick
 * is "on" while its number is above zero, whoever brings it (the weapon, an
 * Understudy copying it, one day an evolution). Their state is `RunState.gear`
 * plus a few card flags (`magnet`, `twinOf`, `isWild`, `fogFlipAt`).
 *
 *   Magnet            one marked card; a Set that includes it hits harder
 *   Bounty Poster     a wanted trait value; every wanted card matched hits harder
 *   Mirror Shard      a Set that reuses a slot of your last Set hits harder
 *   Odd One Out       Sets with exactly one trait different (or one the same)
 *   Devil's Bargain   one heart fewer, damage for every missing heart
 *   Snowball          clean Sets stack damage for the wave; a mistake halves it
 *   Collector's Album one "all the same but X" Set per trait, then a big hit
 *   Glass Sword       big damage until a mistake or a slow Set shatters it
 *   Twin Seed         matching a card destroys its twin for damage
 *   Fog Lantern       face-down cards that flip up stronger (dealt in fight.ts)
 *   Wild Card         a card that completes any Set (dealt in fight.ts)
 *   Cursed Idol       cursed cards can't be matched; then ×2, or the curse moves on
 *   Chain Gang        two chained cards pay when matched together
 *   Thorn Bush        thorn cards pay if matched before they bite
 *   Rust              cards lose damage as they sit, then turn golden
 *   Tar Pit           a sticky row: two matches per card, and every match pays
 *   Decoy             an unmarked near-copy pays when matched with its original
 *   Long Fuse         fused cards pay in their last seconds and burn out as duds
 *   Ice Block         one frozen card thaws after 7 Sets into a big hit
 *   Greedy Chest      a chest that grows every Set you leave it; a mistake drops it back to its floor (what a new chest holds)
 *   Tightrope         Sets that touch your last Set pay; others deal half
 *   Hot Potato        a hot card that jumps around; mistakes cost extra while it is out
 *
 * Whatever a trick does to the board, `syncGear` keeps a Set on it (ensureSet).
 */
import type { AttributeName, Card } from '@/types';
import { ATTRIBUTE_VALUES } from '@/utils/gameUtils';
import type { FightLogMathItem, GearState } from '../types';
import type { TrickKind } from '../rules/types';
import { TRICK_RULES } from '../data/rules';
import { getAdjacentIndices } from '@/utils/weaponEffects';
import { dealDamage, emit, enqueue, foeMultiplier, GRID_COLS, hurt, mods, recycle, signalGrowth, touchable, updateCards, type Draft } from './fight';
import { allSets, differingAttributes, hasAnySet, isSelectable } from './sets';

/** Traits the Collector's Album has a page for (background is a board dressing, not a page) */
const ALBUM_TRAITS: readonly AttributeName[] = ['shape', 'color', 'number', 'shading'];
export const albumTraits = (attributes: readonly AttributeName[]): AttributeName[] => attributes.filter(a => ALBUM_TRAITS.includes(a));
/** Mini-stamp bonus damage for each intermediate Collector's Album page filled */
export const ALBUM_PAGE_BONUS = 3;

const albumPagesFor = (d: Draft): AttributeName[] =>
  d.gear.albumPages ?? albumTraits(d.surge ? d.level.rules.attributes : d.attributes);

export const BOUNTY_CARDS = TRICK_RULES.bountyCards;

export const initGear = (): GearState => ({
  bounty: null,
  lastSetSlots: [],
  snowball: 0,
  album: [],
  albumPages: undefined,
  glassBroken: false,
  glassSinceMs: 0,
  glassReforgeStreak: 0,
  tarRow: null,
  potatoAtMs: 0,
  mirrorMemory: [],
  glassSparesUsed: 0,
  rustGoldStamped: {},
  pendingChestBonus: 0,
});

const on = (n: number | undefined): n is number => (n ?? 0) > 0;
const valueOf = (c: Card, a: AttributeName) => (a === 'background' ? c.background ?? 'white' : c[a]);
const scaleGamble = (d: Draft, n: number): number => {
  const pct = mods(d).gambleBonusPct ?? 0;
  return pct > 0 ? Math.round(n * (1 + pct / 100) * 10) / 10 : n;
};
const freshThornAt = (d: Draft): number =>
  d.elapsedMs + TRICK_RULES.thornMs + TRICK_RULES.thornMsPerExtraTrait * Math.max(0, d.attributes.length - 3);

const rollBounty = (d: Draft) => {
  const prev = d.gear.bounty;
  // Never roll 'shading' on Shading Surge levels so Bounty Poster can't soft-lock when Surge ends
  const attrs = d.surge ? d.level.rules.attributes.filter(a => a !== 'shading') : d.attributes;
  const pool = attrs.length > 0 ? attrs : d.attributes;
  const options = pool.flatMap(attribute =>
    (ATTRIBUTE_VALUES[attribute] as readonly (string | number)[]).map(value => ({ attribute, value }))
  ).filter(o => !prev || o.attribute !== prev.attribute || o.value !== prev.value);
  d.gear.bounty = { ...d._rng.pick(options), left: BOUNTY_CARDS + Math.round(mods(d).bountyCards ?? 0) };
};

/** How many cards the Magnet marks (its growth adds marks). */
const magnetMarks = (d: Draft) => 1 + Math.round(mods(d).magnetMarks ?? 0);

/** Move the Magnet's marks to random cards that aren't on their way out. */
const placeMagnet = (d: Draft) => {
  const candidates = d.board.map((c, i) => (touchable(d, i) && isSelectable(c) ? i : -1)).filter(i => i >= 0);
  const marked = d.board.map((c, i) => (c.magnet ? i : -1)).filter(i => i >= 0);
  updateCards(d, marked, c => ({ ...c, magnet: false }));
  if (candidates.length) updateCards(d, d._rng.shuffle(candidates).slice(0, magnetMarks(d)), c => ({ ...c, magnet: true }));
};


/** Greedy Chest's floor: what a new chest holds, and what a mistake drops it back to (its growth raises it). */
const chestFloor = (d: Draft) => Math.round(mods(d).chestStart ?? 0);
const feat = (d: Draft, name: string) => signalGrowth(d, { on: 'feat', name });

/** How long the Hot Potato sits before it jumps (its growth makes it jumpier). */
const potatoMs = (d: Draft) => Math.max(TRICK_RULES.potatoMinMs, TRICK_RULES.potatoMs - (mods(d).potatoFasterMs ?? 0));
/** Sets a card sits through before it turns golden (Rust's growth shortens it). */
const rustSets = (d: Draft) => Math.max(3, TRICK_RULES.rustSets - Math.round(mods(d).rustSetsLess ?? 0));
/** The sticky rows: the wave's row and, once the Tar Pit has grown, the rows after it. */
const tarRows = (d: Draft): number[] => {
  if (d.gear.tarRow === null) return [];
  const rows = Math.max(1, Math.ceil(d.board.length / GRID_COLS));
  const count = Math.min(rows, 1 + Math.round(mods(d).tarRows ?? 0));
  return Array.from({ length: count }, (_, k) => (d.gear.tarRow! + k) % rows);
};

/** Glass Sword window scales +1.5s per active trait beyond 3 so 4- and 5-trait boards stay fair. */
export const glassWindowMsFor = (d: Draft): number => {
  const base = mods(d).glassWindowMs ?? 0;
  if (base <= 0) return 0;
  return base + 1500 * Math.max(0, d.attributes.length - 3);
};

/** Repair a shattered Glass Sword (or refresh its timer if intact). */
export const repairGlass = (d: Draft, callout = 'Glass Sword reforged!') => {
  const wasBroken = d.gear.glassBroken;
  d.gear.glassBroken = false;
  d.gear.glassSinceMs = d.elapsedMs;
  d.gear.glassReforgeStreak = 0;
  if (wasBroken) emit(d, 'rule', undefined, callout);
};

const shatterGlass = (d: Draft, why: string) => {
  // A reforged sword (its growth) takes the blow once and starts its clock again
  if (Math.round(mods(d).glassSpares ?? 0) > d.gear.glassSparesUsed) {
    d.gear.glassSparesUsed += 1;
    d.gear.glassSinceMs = d.elapsedMs;
    emit(d, 'rule', undefined, 'Glass Sword held!');
    return;
  }
  d.gear.glassBroken = true;
  d.gear.glassReforgeStreak = 0;
  emit(d, 'rule', undefined, `Glass Sword shattered (${why})`);
};

/**
 * The Collector's Album page a Set fills, if any: everything the same but one
 * trait. With 4 traits up to 2 may differ; with 5 traits up to 3 may differ
 * (the Set fills the first of its frozen wave pages that is still empty).
 */
export const albumPageOf = (
  matched: Card[],
  attributes: AttributeName[],
  filled: readonly AttributeName[] = [],
  pages: readonly AttributeName[] = albumTraits(attributes)
): AttributeName | null => {
  const differing = differingAttributes(matched, attributes);
  const maxDiff = attributes.length >= 5 ? 3 : attributes.length >= 4 ? 2 : 1;
  if (differing.length < 1 || differing.length > maxDiff) return null;
  return differing.find(a => pages.includes(a) && !filled.includes(a)) ?? null;
};

export interface GearSet {
  matched: Card[];
  /** Board slots of the matched cards */
  slots: number[];
  diffCount: number;
  graceUsed: boolean;
  /** Scored for the player (echo, Big Scoop): tricks that ask for skill don't count it */
  auto: boolean;
}

/** Slots next to (or the same as) any of `slots`. */
const touching = (d: Draft, slots: number[]): Set<number> =>
  new Set(slots.flatMap(i => [i, ...getAdjacentIndices(i, d.board.length)]));

/** A trick paid out: rules can react to it (`{ on: 'trick', kind }`). */
const paid = (d: Draft, kind: TrickKind) => enqueue(d, 'trick', undefined, kind);

/**
 * What the trick weapons do to this Set's own hit: flat damage, and a
 * multiplier (a ×2 card, stepping off the Tightrope). Call before the Set
 * changes any state.
 */
export const gearSetBonus = (
  d: Draft,
  set: GearSet
): { flat: number; multiplier: number; flatItems: FightLogMathItem[]; multItems: FightLogMathItem[] } => {
  const m = mods(d);
  const g = d.gear;
  let bonus = 0;
  let multiplier = 1;
  const flatItems: FightLogMathItem[] = [];
  const multItems: FightLogMathItem[] = [];
  const add = (amount: number, text: string, kind?: TrickKind, note?: string, sourceRef?: string) => {
    if (amount === 0) return;
    bonus += amount;
    emit(d, 'rule', amount, text);
    if (kind && amount > 0) paid(d, kind);
    flatItems.push({
      label: text.replace(/!$/, ''),
      amount,
      ...(note ? { note } : {}),
      ...(sourceRef ? { sourceRef } : {}),
    });
  };
  const ids = new Set(set.matched.map(c => c.id));

  if (set.matched.some(c => c.doubler)) {
    const times = TRICK_RULES.curseMultiplier + (m.curseMultiplierBonus ?? 0);
    multiplier *= times;
    emit(d, 'rule', times, `Curse broken ×${times}`);
    paid(d, 'curse');
    multItems.push({
      label: 'Cursed Idol',
      amount: times,
      note: 'broke a cursed card in this Set',
      sourceRef: 'weapon:cursed-idol',
    });
  }
  if (set.matched.some(c => c.isWild)) paid(d, 'wild');
  if (on(m.chainDamage) && set.matched.some(c => c.shackle && ids.has(c.shackle))) {
    add(scaleGamble(d, m.chainDamage), 'Chain Gang!', 'chain', 'matched linked chain cards', 'weapon:chain-gang');
  }
  if (on(m.thornDamage)) {
    const hits = set.matched.filter(c => c.thornAt !== undefined).length;
    add(scaleGamble(d, hits * m.thornDamage), 'Thorns', 'thorn', hits === 1 ? 'cleared a thorned card' : `cleared ${hits} thorned cards`, 'weapon:thorn-bush');
  }
  if (on(m.rustGold)) {
    // A rusty card can lose what it is worth, never more
    const lost = set.matched.reduce((sum, c) => sum + Math.min(c.rust ?? 0, 1 + (c.bonusPoints ?? 0) + (c.charge ?? 0)), 0);
    add(-lost, 'Rust', undefined, 'rusty cards lost damage', 'weapon:rust');
    const gilded = set.matched.filter(c => c.rusted);
    if (gilded.length > 0) {
      // Honor current rustGold (including active evolutions like Ancient Relic / Old Powder and growth) on ALREADY-gilded cards
      const targetGold = Math.round(scaleGamble(d, m.rustGold));
      const extraGold = gilded.reduce((sum, c) => {
        const stamped = d.gear.rustGoldStamped?.[c.id];
        const baseline = stamped !== undefined ? stamped : (c.bonusPoints ?? 0);
        return sum + Math.max(0, targetGold - baseline);
      }, 0);
      if (extraGold > 0) {
        add(extraGold, 'Golden Rust!', undefined, 'bonus golden rust value', 'weapon:rust');
      }
      paid(d, 'rust');
    }
  }
  if (on(m.tarDamage) && set.slots.some(i => tarRows(d).includes(Math.floor(i / GRID_COLS)))) {
    add(scaleGamble(d, m.tarDamage), 'Tar Pit', 'tar', 'matched in the sticky tar row', 'weapon:tar-pit');
  }
  if (on(m.decoyDamage) && set.matched.some(c => c.decoyOf && ids.has(c.decoyOf))) {
    add(scaleGamble(d, m.decoyDamage), 'Decoy found!', 'decoy', 'matched a decoy with its pair', 'weapon:decoy');
  }
  if (on(m.fuseDamage)) {
    const hits = set.matched.filter(c => c.fuseHot).length;
    add(scaleGamble(d, hits * m.fuseDamage), 'Short fuse', 'fuse', hits === 1 ? 'beat a hot fuse' : `beat ${hits} hot fuses`, 'weapon:long-fuse');
  }
  if (set.matched.some(c => c.thawed)) paid(d, 'ice');
  const chest = set.matched.find(c => c.chest !== undefined);
  if (chest) {
    const pts = scaleGamble(d, chest.chest ?? 0);
    add(pts, 'Greedy Chest!', 'chest', `chest saved +${pts} bonus damage`, 'weapon:greedy-chest');
  }
  if (on(m.potatoDamage) && set.matched.some(c => c.hot)) {
    add(scaleGamble(d, m.potatoDamage), 'Hot Potato!', 'potato', 'matched the hot potato card', 'weapon:hot-potato');
  }

  if (on(m.magnetDamage) && set.matched.some(c => c.magnet)) {
    add(m.magnetDamage, 'Magnet!', 'magnet', 'matched the magnetized card', 'weapon:magnet');
  }
  if (on(m.bountyDamage) && g.bounty) {
    const wanted = set.matched.filter(c => !c.isWild && valueOf(c, g.bounty!.attribute) === g.bounty!.value).length;
    add(wanted * m.bountyDamage, 'Bounty!', 'bounty', `${wanted} wanted card${wanted === 1 ? '' : 's'}`, 'weapon:bounty-poster');
  }
  if (on(m.missingHeartDamage)) {
    // The heart the bargain took counts as missing
    const missing = d.hearts !== null && d.maxHearts !== null ? d.maxHearts - d.hearts : 0;
    add((missing + 1) * m.missingHeartDamage, "Devil's Bargain", undefined, `${missing + 1} missing heart${missing + 1 === 1 ? '' : 's'}`, 'weapon:devils-bargain');
  }
  if (on(m.snowballStep) && g.snowball > 0) {
    add(g.snowball * m.snowballStep, 'Snowball', undefined, `${g.snowball}-Set clean streak`, 'weapon:snowball');
  }
  if (set.auto) return { flat: bonus, multiplier, flatItems, multItems };

  if (on(m.mirrorDamage)) {
    // The mirror remembers your last Set, and further back once it has grown
    const remembered = [g.lastSetSlots, ...g.mirrorMemory.slice(0, Math.round(m.mirrorDepth ?? 0))].flat();
    if (set.slots.some(i => remembered.includes(i))) {
      add(m.mirrorDamage, 'Mirror!', 'mirror', 'reused a slot from a recent Set', 'weapon:mirror-shard');
    }
    if (set.slots.filter(i => g.lastSetSlots.includes(i)).length >= 2) feat(d, 'doubleMirror');
  }
  if (on(m.oddOneOutDamage) && !set.graceUsed) {
    const n = d.attributes.length;
    if (set.diffCount === 1 || (n >= 4 && set.diffCount === n - 1)) {
      add(m.oddOneOutDamage, 'Odd one out!', 'odd', set.diffCount === 1 ? 'only 1 trait differed' : 'only 1 trait matched', 'weapon:odd-one-out');
    }
  }
  if (on(m.glassDamage) && !g.glassBroken) {
    add(m.glassDamage, 'Glass Sword', undefined, 'unbroken blade bonus', 'weapon:glass-sword');
  }
  if (on(m.albumDamage)) {
    const pages = albumPagesFor(d);
    const page = set.graceUsed ? null : albumPageOf(set.matched, d.attributes, g.album, pages);
    if (page) {
      g.album = [...g.album, page];
      if (pages.every(a => g.album.includes(a))) {
        g.album = [];
        add(m.albumDamage, 'Album complete!', 'album', 'completed all trait pages', 'weapon:collectors-album');
        feat(d, 'albumDone');
      } else {
        add(ALBUM_PAGE_BONUS, `Album: ${page}`, 'album', `stamped ${page} page`, 'weapon:collectors-album');
      }
    }
  }
  if (on(m.tightropeDamage)) {
    // The first Set of a wave starts the rope; after that, stay next to your last Set
    if (g.lastSetSlots.length === 0 || set.slots.some(i => touching(d, g.lastSetSlots).has(i))) {
      add(m.tightropeDamage, 'Tightrope', 'tightrope', 'stayed on the rope', 'weapon:tightrope');
    } else {
      const off = Math.min(1, TRICK_RULES.offRopeMultiplier + (m.offRopeBonus ?? 0));
      multiplier *= off;
      if (off < 1) {
        emit(d, 'rule', off, 'Off the rope');
        multItems.push({ label: 'Off the rope', amount: off, note: 'missed Tightrope adjacency', sourceRef: 'weapon:tightrope' });
      }
    }
  }
  return { flat: bonus, multiplier, flatItems, multItems };
};

/**
 * Cards that stay after this Set: a chained card matched without its partner,
 * and a Tar Pit card on its first match. Marks them `stay` (run.ts replaceCards)
 * and refreshes any `thornAt` timer so staying cards never bite silently.
 */
export const holdCards = (d: Draft, matched: Card[]) => {
  const ids = new Set(matched.map(c => c.id));
  const held = d.board
    .map((c, i) => (ids.has(c.id) && ((c.shackle && !ids.has(c.shackle)) || c.tar === 1) ? i : -1))
    .filter(i => i >= 0);
  const resetThorn = freshThornAt(d);
  updateCards(d, held, c => ({
    ...c,
    stay: true,
    ...(c.tar === 1 ? { tar: 2 as const } : {}),
    ...(c.thornAt !== undefined ? { thornAt: resetThorn } : {}),
  }));
};

/** Twin Seed: a matched card takes its twin with it. Returns nothing; damage is dealt here. */
export const resolveTwins = (d: Draft, matched: Card[]) => {
  const ids = new Set(matched.map(c => c.id));
  const twins = [...new Set(matched.map(c => c.twinOf).filter((id): id is string => !!id && !ids.has(id)))];
  for (const id of twins) {
    const idx = d.board.findIndex(c => c.id === id);
    if (idx < 0 || !touchable(d, idx)) continue;
    const rawTwin = scaleGamble(d, mods(d).twinDamage ?? 0);
    emit(d, 'hit', dealDamage(d, rawTwin * d._setMultiplier * foeMultiplier(d)), 'Twin', { slots: [idx], cards: [d.board[idx]] });
    paid(d, 'twin');
    recycle(d, [idx]);
  }
};

/** After a Set is scored: move the mark, count the bounty, grow the snowball. */
export const afterSetGear = (d: Draft, set: GearSet) => {
  const m = mods(d);
  const g = d.gear;
  if (on(m.bountyDamage) && g.bounty) {
    const wanted = set.matched.filter(c => !c.isWild && valueOf(c, g.bounty!.attribute) === g.bounty!.value).length;
    g.bounty = { ...g.bounty, left: g.bounty.left - wanted };
    if (g.bounty.left <= 0) {
      // Told first, so the next poster is already the bigger one
      feat(d, 'posterDone');
      rollBounty(d);
    }
  }
  if (on(m.magnetDamage)) placeMagnet(d);
  const ids = new Set(set.matched.map(c => c.id));
  if (g.rustGoldStamped && Object.keys(g.rustGoldStamped).length > 0) {
    const nextStamped: Record<string, number> = {};
    for (const [k, v] of Object.entries(g.rustGoldStamped)) {
      if (!ids.has(k)) nextStamped[k] = v;
    }
    g.rustGoldStamped = nextStamped;
  }
  const sitting = d.board.map((c, i) => (!ids.has(c.id) && !d.replacing.includes(c.id) ? i : -1)).filter(i => i >= 0);
  if (on(m.rustGold)) {
    // Every card that sat through this Set rusts; at the limit it turns golden instead
    const rusting = sitting.filter(i => !d.board[i].rusted && isSelectable(d.board[i]));
    updateCards(d, rusting, c => ({ ...c, rust: Math.min(rustSets(d), (c.rust ?? 0) + 1) }));
    // One card a Set turns golden: the first that has sat long enough
    const ripe = rusting.find(i => (d.board[i].rust ?? 0) >= rustSets(d));
    if (ripe !== undefined) {
      const gold = Math.round(scaleGamble(d, m.rustGold ?? 0));
      const ripeId = d.board[ripe].id;
      g.rustGoldStamped = { ...(g.rustGoldStamped ?? {}), [ripeId]: gold };
      updateCards(d, [ripe], c => {
        const { rust: _r, ...rest } = c;
        return { ...rest, rusted: true, bonusPoints: (c.bonusPoints ?? 0) + gold, bonusMoney: (c.bonusMoney ?? 0) + TRICK_RULES.rustCoins };
      });
    }
  }
  if (on(m.chestGrowth)) updateCards(d, sitting.filter(i => d.board[i].chest !== undefined), c => ({ ...c, chest: (c.chest ?? 0) + m.chestGrowth! }));
  if (set.auto) return;
  // Ice Block: every Set of yours chips at it
  updateCards(d, d.board.map((c, i) => ((c.frozen ?? 0) > 0 ? i : -1)).filter(i => i >= 0), c => {
    const frozen = (c.frozen ?? 0) - 1;
    if (frozen > 0) return { ...c, frozen };
    const { frozen: _f, locked: _l, ...rest } = c;
    return { ...rest, thawed: true, bonusPoints: (c.bonusPoints ?? 0) + Math.round(scaleGamble(d, m.frozenDamage ?? 0)) };
  });
  g.mirrorMemory = [g.lastSetSlots, ...g.mirrorMemory].filter(slots => slots.length > 0).slice(0, 3);
  g.lastSetSlots = set.slots;
  // Glass Sword: if shattered, landing a Rainbow Set or 3 consecutive clean Sets reforges it!
  if (on(m.glassDamage) && g.glassBroken) {
    if (d._setCtx?.rainbow) {
      repairGlass(d);
    } else if (!set.graceUsed) {
      g.glassReforgeStreak = (g.glassReforgeStreak ?? 0) + 1;
      if (g.glassReforgeStreak >= 3) repairGlass(d);
    }
  } else {
    g.glassSinceMs = d.elapsedMs;
  }
  if (on(m.snowballStep)) {
    const cap = Math.max(1, Math.round(m.snowballMax ?? 0));
    const before = g.snowball;
    g.snowball = Math.min(cap, g.snowball + 1);
    // Rolled all the way up: an avalanche (its growth raises the cap)
    if (g.snowball >= cap && before < cap) feat(d, 'fullSnowball');
  }
};

export const onMistakeGear = (d: Draft) => {
  const m = mods(d);
  d.gear.snowball = Math.floor(d.gear.snowball / 2);
  d.gear.glassReforgeStreak = 0;
  // Greedy Chest: a mistake loses what the chest grew, never its floor. Hot Potato: a mistake costs more while it is out.
  const floor = chestFloor(d);
  updateCards(d, d.board.map((c, i) => ((c.chest ?? 0) > floor ? i : -1)).filter(i => i >= 0), c => ({ ...c, chest: floor }));
  if (on(m.potatoDamage) && d.board.some(c => c.hot)) hurt(d, TRICK_RULES.potatoHearts);
  if (on(m.glassDamage) && !d.gear.glassBroken) shatterGlass(d, 'mistake');
};

export const onWaveStartGear = (d: Draft) => {
  d.gear = {
    ...d.gear,
    snowball: 0,
    albumPages: albumTraits(d.surge ? d.level.rules.attributes : d.attributes),
    glassBroken: false,
    glassSinceMs: d.elapsedMs,
    glassReforgeStreak: 0,
    lastSetSlots: [],
    mirrorMemory: [],
    tarRow: null,
    rustGoldStamped: {},
    pendingChestBonus: 0,
  };
};

/** On the fight clock: the Glass Sword's deadline and the Fog Lantern's flips. */
export const tickGear = (d: Draft) => {
  const m = mods(d);
  if (on(m.glassDamage) && !d.gear.glassBroken && d.elapsedMs - d.gear.glassSinceMs > glassWindowMsFor(d)) shatterGlass(d, 'too slow');
  const due = d.board.map((c, i) => (c.fogFlipAt !== undefined && d.elapsedMs >= c.fogFlipAt ? i : -1)).filter(i => i >= 0);
  if (due.length) {
    updateCards(d, due, c => {
      const { fogFlipAt: _at, fogBonus, ...rest } = c;
      return rest.isFaceDown ? { ...rest, isFaceDown: false, bonusPoints: (rest.bonusPoints ?? 0) + Math.round(scaleGamble(d, fogBonus ?? 0)) } : rest;
    });
    emit(d, 'rule', due.length, 'The fog lifts', { slots: due });
    paid(d, 'fog');
  }

  // Cursed Idol: a curse that runs out leaves a ×2 card, or moves to a neighbour
  for (const id of d.board.filter(c => c.cursedUntil !== undefined && d.elapsedMs >= c.cursedUntil).map(c => c.id)) {
    const i = d.board.findIndex(c => c.id === id);
    const next = getAdjacentIndices(i, d.board.length).filter(j => touchable(d, j) && isSelectable(d.board[j]) && !d.board[j].doubler);
    const spreads = next.length > 0 && d._rng.next() < 0.5;
    updateCards(d, [i], c => {
      const { cursedUntil: _u, locked: _l, ...rest } = c;
      return spreads ? rest : { ...rest, doubler: true };
    });
    if (spreads) updateCards(d, [d._rng.pick(next)], c => ({ ...c, locked: true, cursedUntil: d.elapsedMs + TRICK_RULES.curseMs }));
    emit(d, 'rule', undefined, spreads ? 'The curse spreads' : 'Curse lifted: ×2 card', { slots: [i] });
  }

  // Thorn Bush: thorns left too long bite
  const thorns = d.board.map((c, i) => (c.thornAt !== undefined && d.elapsedMs >= c.thornAt ? i : -1)).filter(i => i >= 0);
  if (thorns.length) {
    updateCards(d, thorns, c => {
      const { thornAt: _t, ...rest } = c;
      return rest;
    });
    emit(d, 'rule', thorns.length, 'Thorns bite', { slots: thorns });
    hurt(d, thorns.length);
  }

  // Long Fuse: hot in the last seconds, then a dud
  const fused = d.board.map((c, i) => (c.fuseAt !== undefined ? i : -1)).filter(i => i >= 0);
  const burnt = fused.filter(i => d.elapsedMs >= d.board[i].fuseAt! && touchable(d, i));
  const hot = fused.filter(i => !burnt.includes(i) && !d.board[i].fuseHot && d.board[i].fuseAt! - d.elapsedMs <= TRICK_RULES.fuseHotMs + (m.fuseHotMs ?? 0));
  updateCards(d, hot, c => ({ ...c, fuseHot: true }));
  if (burnt.length) {
    updateCards(d, burnt, c => {
      const { fuseAt: _a, fuseHot: _h, ...rest } = c;
      return { ...rest, isDud: true, fuseDud: true };
    });
    emit(d, 'rule', burnt.length, 'Fuse burnt out', { slots: burnt });
  }

  // Hot Potato: jumps to a neighbour
  if (on(m.potatoDamage) && d.elapsedMs >= d.gear.potatoAtMs) {
    const i = d.board.findIndex(c => c.hot);
    const next = i < 0 ? [] : getAdjacentIndices(i, d.board.length).filter(j => touchable(d, j) && isSelectable(d.board[j]));
    if (next.length) {
      updateCards(d, [i], c => ({ ...c, hot: false }));
      updateCards(d, [d._rng.pick(next)], c => ({ ...c, hot: true }));
    }
    d.gear.potatoAtMs = d.elapsedMs + potatoMs(d);
  }
};

/** A random card a trick can sit on: matchable, not on its way out, not already carrying a trick's marker. */
const freeSlots = (d: Draft): number[] =>
  d.board
    .map((c, i) => (touchable(d, i) && isSelectable(c) && !c.isWild && !c.shackle && !c.hot && c.chest === undefined && !c.thawed && !c.doubler && !c.magnet ? i : -1))
    .filter(i => i >= 0);

/** One marker of a kind on the board while its trick is on, none while it is off. */
const keepOne = (d: Draft, active: boolean, has: (c: Card) => boolean, place: (c: Card) => Card, clear: (c: Card) => Card) => {
  const marked = d.board.map((c, i) => (has(c) ? i : -1)).filter(i => i >= 0);
  if (!active) return updateCards(d, marked, clear);
  if (marked.length === 0) {
    const free = freeSlots(d);
    if (free.length) updateCards(d, [d._rng.pick(free)], place);
  }
};

/**
 * The board always holds a Set. Tricks can take cards out of play (curses,
 * ice, burnt fuses), so when none is left: clear burnt fuses, then lift
 * curses, then re-deal a few plain cards.
 */
const ensureSet = (d: Draft) => {
  const none = () => !hasAnySet(d.board, d.attributes);
  const duds = d.board.map((c, i) => (c.fuseDud && touchable(d, i) ? i : -1)).filter(i => i >= 0);
  if (duds.length > TRICK_RULES.fuseDuds) recycle(d, duds.slice(0, duds.length - TRICK_RULES.fuseDuds), { quiet: true });
  if (!none()) return;
  const left = d.board.map((c, i) => (c.fuseDud && touchable(d, i) ? i : -1)).filter(i => i >= 0);
  if (left.length) recycle(d, left, { quiet: true });
  if (!none()) return;
  updateCards(d, d.board.map((c, i) => (c.cursedUntil !== undefined ? i : -1)).filter(i => i >= 0), c => {
    const { cursedUntil: _u, locked: _l, ...rest } = c;
    return rest;
  });
  if (!none()) return;
  const plain = d._rng.shuffle(freeSlots(d)).slice(0, 3);
  if (plain.length) recycle(d, plain, { quiet: true });
};

/** Keep the tricks' markers true after any change (a weapon picked up mid-fight, a marked card destroyed). */
export const syncGear = (d: Draft) => {
  if (d.status !== 'playing') return;
  const m = mods(d);
  // Freeze Collector's Album pages once per wave so Shading Surge never shifts the goalpost mid-album
  if (!d.gear.albumPages) d.gear.albumPages = albumTraits(d.surge ? d.level.rules.attributes : d.attributes);
  if (on(m.bountyDamage)) {
    const invalidBounty =
      !d.gear.bounty ||
      !d.attributes.includes(d.gear.bounty.attribute) ||
      (!!d.surge && d.gear.bounty.attribute === 'shading');
    if (invalidBounty) rollBounty(d);
  }
  const marked = d.board.filter(c => c.magnet).length;
  if (on(m.magnetDamage) && marked < Math.min(magnetMarks(d), d.board.length)) {
    placeMagnet(d);
  } else if (!on(m.magnetDamage) && marked > 0 && d.weapons.every(w => w.id !== 'magnet')) {
    // Only clear if Magnet isn't held and no addMagnet effect placed marks (keep rule-placed marks alive)
  }
  // Twins point at each other, and a twin whose partner left is an ordinary card again
  if (d.board.some(c => c.twinOf)) {
    const byId = new Map(d.board.map(c => [c.id, c]));
    const partner = new Map<string, string>();
    // (two cards dealt at once can pick the same card to copy: the first keeps it, the other is an ordinary card)
    for (const c of d.board) {
      if (!c.twinOf || !byId.has(c.twinOf) || partner.has(c.id) || partner.has(c.twinOf)) continue;
      partner.set(c.id, c.twinOf);
      partner.set(c.twinOf, c.id);
    }
    const stale = d.board.map((c, i) => (c.twinOf !== partner.get(c.id) ? i : -1)).filter(i => i >= 0);
    updateCards(d, stale, c => {
      const { twinOf: _old, ...rest } = c;
      const p = partner.get(c.id);
      return p ? { ...rest, twinOf: p } : rest;
    });
  }
  // One wild card at a time
  const wilds = d.board.map((c, i) => (c.isWild ? i : -1)).filter(i => i >= 0);
  const wildMax = 1 + Math.round(m.wildMax ?? 0);
  if (wilds.length > wildMax) updateCards(d, wilds.slice(wildMax), c => ({ ...c, isWild: false }));

  // Chain Gang: exactly two cards chained to each other
  const byId = new Map(d.board.map(c => [c.id, c]));
  const chained = d.board.map((c, i) => (c.shackle ? i : -1)).filter(i => i >= 0);
  const paired = chained.length === 2 && chained.every(i => byId.get(d.board[i].shackle!)?.shackle === d.board[i].id);
  if (!on(m.chainDamage) || !paired) {
    updateCards(d, chained, c => {
      const { shackle: _s, ...rest } = c;
      return rest;
    });
    if (on(m.chainDamage)) {
      // Chain two cards of a Set that is on the board, so the pair can usually be matched together
      const free = new Set(freeSlots(d));
      const sets = allSets(d.board, d.attributes)
        .map(set => set.map(c => d.board.findIndex(x => x.id === c.id)).filter(i => free.has(i)))
        .filter(slots => slots.length >= 2);
      const [a, b] = sets.length ? d._rng.shuffle(d._rng.pick(sets)) : d._rng.shuffle([...free]);
      if (a !== undefined && b !== undefined) {
        const [ida, idb] = [d.board[a].id, d.board[b].id];
        updateCards(d, [a], c => ({ ...c, shackle: idb }));
        updateCards(d, [b], c => ({ ...c, shackle: ida }));
      }
    }
  }

  // Tar Pit: one sticky row a wave; a card that lands in it is sticky, one that leaves it isn't
  if (on(m.tarDamage) && d.gear.tarRow === null) d.gear.tarRow = Math.floor(d._rng.next() * Math.ceil(d.board.length / GRID_COLS));
  if (!on(m.tarDamage)) d.gear.tarRow = null;
  const sticky = tarRows(d);
  const inTar = (i: number) => sticky.includes(Math.floor(i / GRID_COLS));
  updateCards(d, d.board.map((c, i) => (inTar(i) !== !!c.tar ? i : -1)).filter(i => i >= 0), (c): Card => {
    if (!c.tar) return { ...c, tar: 1 };
    const { tar: _t, ...rest } = c;
    return rest;
  });

  // One Ice Block (frozen, or thawed and waiting to be matched), one Greedy Chest, one Hot Potato
  keepOne(d, on(m.frozenDamage), c => (c.frozen ?? 0) > 0 || !!c.thawed,
    c => ({ ...c, frozen: Math.max(2, TRICK_RULES.iceSets - Math.round(m.iceSetsLess ?? 0)), locked: true }),
    c => { const { frozen: _f, locked: _l, ...rest } = c; return (c.frozen ?? 0) > 0 ? rest : c; });
  keepOne(d, on(m.chestStart), c => c.chest !== undefined,
    c => {
      const bonus = d.gear.pendingChestBonus ?? 0;
      d.gear.pendingChestBonus = 0;
      return { ...c, chest: chestFloor(d) + bonus };
    },
    c => { const { chest: _c, ...rest } = c; return rest; });
  const hadPotato = d.board.some(c => c.hot);
  keepOne(d, on(m.potatoDamage), c => !!c.hot, c => ({ ...c, hot: true }), c => ({ ...c, hot: false }));
  if (on(m.potatoDamage) && !hadPotato) d.gear.potatoAtMs = d.elapsedMs + potatoMs(d);

  ensureSet(d);
};

// ─── Trick-state mutation primitives (rules/engine.ts verbs for Trick+Trick evolutions) ──

/** Add `amount` directly to Greedy Chest's stored payout (or bank it for the next chest spawned). */
export const feedChest = (d: Draft, amount: number, callout = 'Chest fed!') => {
  if (amount <= 0) return;
  const live = d.board
    .map((c, i) => (c.chest !== undefined && !d.replacing.includes(c.id) ? i : -1))
    .filter(i => i >= 0);
  if (live.length > 0) {
    updateCards(d, live, c => ({ ...c, chest: (c.chest ?? 0) + amount }));
    emit(d, 'rule', amount, callout, { slots: live });
  } else {
    d.gear.pendingChestBonus = (d.gear.pendingChestBonus ?? 0) + amount;
    emit(d, 'rule', amount, callout);
  }
};

/**
 * Fast-forward beneficial trick timers (Fog lift, Curse → ×2, Ice thaw, Rust aging,
 * Fuse → hot window) without ever penalizing lethal/negative timers (Thorns, Fuse dud, Glass shatter, Potato).
 */
export const advanceTricks = (d: Draft, ms: number) => {
  if (ms <= 0) return;
  const m = mods(d);
  const steps = Math.max(1, Math.floor(ms / 3000));

  // 1. Fog Lantern: shorten fogFlipAt and lift any fog that reaches due time
  const fogIdx = d.board.map((c, i) => (c.fogFlipAt !== undefined ? i : -1)).filter(i => i >= 0);
  const liftedFog: number[] = [];
  if (fogIdx.length) {
    updateCards(d, fogIdx, c => {
      const nextAt = c.fogFlipAt! - ms;
      if (d.elapsedMs >= nextAt) {
        const slot = d.board.indexOf(c);
        if (slot >= 0) liftedFog.push(slot);
        const { fogFlipAt: _at, fogBonus, ...rest } = c;
        return rest.isFaceDown
          ? { ...rest, isFaceDown: false, bonusPoints: (rest.bonusPoints ?? 0) + Math.round(scaleGamble(d, fogBonus ?? 0)) }
          : rest;
      }
      return { ...c, fogFlipAt: nextAt };
    });
    if (liftedFog.length) {
      emit(d, 'rule', liftedFog.length, 'The fog lifts', { slots: liftedFog });
      paid(d, 'fog');
    }
  }

  // 2. Cursed Idol: shorten cursedUntil; any curse that finishes becomes a guaranteed ×2 doubler (no penalty spread)
  const cursedIdx = d.board.map((c, i) => (c.cursedUntil !== undefined ? i : -1)).filter(i => i >= 0);
  const liftedCurse: number[] = [];
  if (cursedIdx.length) {
    updateCards(d, cursedIdx, c => {
      const nextUntil = c.cursedUntil! - ms;
      if (d.elapsedMs >= nextUntil) {
        const slot = d.board.indexOf(c);
        if (slot >= 0) liftedCurse.push(slot);
        const { cursedUntil: _u, locked: _l, ...rest } = c;
        return { ...rest, doubler: true };
      }
      return { ...c, cursedUntil: nextUntil };
    });
    if (liftedCurse.length) emit(d, 'rule', undefined, 'Curse lifted: ×2 card', { slots: liftedCurse });
  }

  // 3. Long Fuse: pull un-hot fuses into the bonus hot window without burning them out as duds
  const hotWindow = TRICK_RULES.fuseHotMs + (m.fuseHotMs ?? 0);
  const fuseIdx = d.board
    .map((c, i) => (c.fuseAt !== undefined && !c.fuseHot && touchable(d, i) ? i : -1))
    .filter(i => i >= 0);
  if (fuseIdx.length) {
    updateCards(d, fuseIdx, c => {
      const safeFloor = d.elapsedMs + Math.min(2500, hotWindow);
      const nextAt = Math.max(safeFloor, c.fuseAt! - ms);
      const isHot = nextAt - d.elapsedMs <= hotWindow;
      return { ...c, fuseAt: nextAt, ...(isHot ? { fuseHot: true } : {}) };
    });
  }

  // 4. Ice Block: chip frozen counter toward thaw
  const iceIdx = d.board.map((c, i) => ((c.frozen ?? 0) > 0 ? i : -1)).filter(i => i >= 0);
  if (iceIdx.length) {
    updateCards(d, iceIdx, c => {
      const frozen = (c.frozen ?? 0) - steps;
      if (frozen > 0) return { ...c, frozen };
      const { frozen: _f, locked: _l, ...rest } = c;
      return { ...rest, thawed: true, bonusPoints: (c.bonusPoints ?? 0) + Math.round(scaleGamble(d, m.frozenDamage ?? 0)) };
    });
  }

  // 5. Rust: age rusting cards toward golden transformation
  if (on(m.rustGold)) {
    const target = rustSets(d);
    const rustIdx = d.board
      .map((c, i) => (!c.rusted && isSelectable(c) && touchable(d, i) && (c.rust ?? 0) > 0 ? i : -1))
      .filter(i => i >= 0);
    if (rustIdx.length) {
      const gold = Math.round(scaleGamble(d, m.rustGold));
      updateCards(d, rustIdx, c => {
        const nextRust = (c.rust ?? 0) + steps;
        if (nextRust >= target) {
          d.gear.rustGoldStamped = { ...(d.gear.rustGoldStamped ?? {}), [c.id]: gold };
          const { rust: _r, ...rest } = c;
          return { ...rest, rusted: true, bonusPoints: (c.bonusPoints ?? 0) + gold, bonusMoney: (c.bonusMoney ?? 0) + TRICK_RULES.rustCoins };
        }
        return { ...c, rust: nextRust };
      });
    }
  }

  // 6. Greedy Chest: grow live chests by chestGrowth * steps
  if (on(m.chestGrowth)) {
    const chestIdx = d.board.map((c, i) => (c.chest !== undefined && touchable(d, i) ? i : -1)).filter(i => i >= 0);
    if (chestIdx.length) {
      updateCards(d, chestIdx, c => ({ ...c, chest: (c.chest ?? 0) + m.chestGrowth! * steps }));
    }
  }
};

/** Fill 1 random unfilled Collector's Album page (triggering mini-stamp or full Album completion). */
export const stampAlbum = (d: Draft) => {
  const pages = albumPagesFor(d);
  const unfilled = pages.filter(p => !d.gear.album.includes(p));
  if (unfilled.length === 0) return;
  const page = d._rng.pick(unfilled);
  d.gear.album = [...d.gear.album, page];
  const m = mods(d);
  if (pages.every(p => d.gear.album.includes(p))) {
    d.gear.album = [];
    const baseDmg = m.albumDamage ?? 16;
    const dealt = dealDamage(d, baseDmg * d._setMultiplier * foeMultiplier(d));
    emit(d, 'hit', dealt, 'Album complete!');
    paid(d, 'album');
    feat(d, 'albumDone');
  } else {
    const dealt = dealDamage(d, ALBUM_PAGE_BONUS * d._setMultiplier * foeMultiplier(d));
    emit(d, 'hit', dealt, `Album: ${page}`);
    paid(d, 'album');
  }
};

/** Place `count` extra Magnet marks on selectable board cards (preferring cards in valid Sets). */
export const addMagnet = (d: Draft, count: number) => {
  if (count <= 0) return;
  const candidates = d.board
    .map((c, i) => (touchable(d, i) && isSelectable(c) && !c.magnet ? i : -1))
    .filter(i => i >= 0);
  if (candidates.length === 0) return;
  const inSetIds = new Set(allSets(d.board, d.attributes).flat().map(c => c.id));
  const prioritized = candidates.filter(i => inSetIds.has(d.board[i].id));
  const fallback = candidates.filter(i => !inSetIds.has(d.board[i].id));
  const chosen = [...d._rng.shuffle(prioritized), ...d._rng.shuffle(fallback)].slice(0, count);
  if (chosen.length === 0) return;
  updateCards(d, chosen, c => ({ ...c, magnet: true }));
  emit(d, 'rule', chosen.length, 'Magnetized!', { slots: chosen });
};

/** Kinds of trick payout a rule can react to (`{ on: 'trick', kind }`). */
export type { TrickKind } from '../rules/types';
