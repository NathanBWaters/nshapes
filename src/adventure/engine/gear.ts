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
 */
import type { AttributeName, Card } from '@/types';
import { ATTRIBUTE_VALUES } from '@/utils/gameUtils';
import type { GearState } from '../types';
import { TRICK_RULES } from '../data/rules';
import { dealDamage, emit, foeMultiplier, mods, recycle, touchable, updateCards, type Draft } from './fight';
import { differingAttributes, isSelectable } from './sets';

/** Traits the Collector's Album has a page for (background is a board dressing, not a page) */
const ALBUM_TRAITS: readonly AttributeName[] = ['shape', 'color', 'number', 'shading'];
export const albumTraits = (attributes: readonly AttributeName[]): AttributeName[] => attributes.filter(a => ALBUM_TRAITS.includes(a));

export const BOUNTY_CARDS = TRICK_RULES.bountyCards;

export const initGear = (): GearState => ({
  bounty: null,
  lastSetSlots: [],
  snowball: 0,
  album: [],
  glassBroken: false,
  glassSinceMs: 0,
});

const on = (n: number | undefined): n is number => (n ?? 0) > 0;
const valueOf = (c: Card, a: AttributeName) => (a === 'background' ? c.background ?? 'white' : c[a]);

const rollBounty = (d: Draft) => {
  const prev = d.gear.bounty;
  const options = d.attributes.flatMap(attribute =>
    (ATTRIBUTE_VALUES[attribute] as readonly (string | number)[]).map(value => ({ attribute, value }))
  ).filter(o => !prev || o.attribute !== prev.attribute || o.value !== prev.value);
  d.gear.bounty = { ...d._rng.pick(options), left: BOUNTY_CARDS };
};

/** Move the Magnet's mark to a random card that isn't on its way out. */
const placeMagnet = (d: Draft) => {
  const candidates = d.board.map((c, i) => (touchable(d, i) && isSelectable(c) ? i : -1)).filter(i => i >= 0);
  const marked = d.board.map((c, i) => (c.magnet ? i : -1)).filter(i => i >= 0);
  updateCards(d, marked, c => ({ ...c, magnet: false }));
  if (candidates.length) updateCards(d, [d._rng.pick(candidates)], c => ({ ...c, magnet: true }));
};

const shatterGlass = (d: Draft, why: string) => {
  d.gear.glassBroken = true;
  emit(d, 'rule', undefined, `Glass Sword shattered (${why})`);
};

/**
 * The Collector's Album page a Set fills, if any: everything the same but one
 * trait. With 4 or more traits such Sets get rare, so one other trait may
 * differ too (the Set fills the first of its pages that is still empty).
 */
export const albumPageOf = (matched: Card[], attributes: AttributeName[], filled: readonly AttributeName[]): AttributeName | null => {
  const differing = differingAttributes(matched, attributes);
  if (differing.length < 1 || differing.length > (attributes.length >= 4 ? 2 : 1)) return null;
  return differing.find(a => albumTraits(attributes).includes(a) && !filled.includes(a)) ?? null;
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

/** Flat damage the trick weapons add to this Set's own hit. Call before the Set changes any state. */
export const gearSetBonus = (d: Draft, set: GearSet): number => {
  const m = mods(d);
  const g = d.gear;
  let bonus = 0;
  const add = (amount: number, text: string) => {
    if (amount <= 0) return;
    bonus += amount;
    emit(d, 'rule', amount, text);
  };

  if (on(m.magnetDamage) && set.matched.some(c => c.magnet)) add(m.magnetDamage, 'Magnet!');
  if (on(m.bountyDamage) && g.bounty) {
    const wanted = set.matched.filter(c => !c.isWild && valueOf(c, g.bounty!.attribute) === g.bounty!.value).length;
    add(wanted * m.bountyDamage, 'Bounty!');
  }
  if (on(m.missingHeartDamage)) {
    // The heart the bargain took counts as missing
    const missing = d.hearts !== null && d.maxHearts !== null ? d.maxHearts - d.hearts : 0;
    add((missing + 1) * m.missingHeartDamage, "Devil's Bargain");
  }
  if (on(m.snowballStep) && g.snowball > 0) add(g.snowball * m.snowballStep, 'Snowball');
  if (set.auto) return bonus;

  if (on(m.mirrorDamage) && set.slots.some(i => g.lastSetSlots.includes(i))) add(m.mirrorDamage, 'Mirror!');
  if (on(m.oddOneOutDamage) && !set.graceUsed) {
    const n = d.attributes.length;
    if (set.diffCount === 1 || (n >= 4 && set.diffCount === n - 1)) add(m.oddOneOutDamage, 'Odd one out!');
  }
  if (on(m.glassDamage) && !g.glassBroken) add(m.glassDamage, 'Glass Sword');
  if (on(m.albumDamage)) {
    const page = set.graceUsed ? null : albumPageOf(set.matched, d.attributes, g.album);
    if (page) {
      g.album = [...g.album, page];
      if (albumTraits(d.attributes).every(a => g.album.includes(a))) {
        g.album = [];
        add(m.albumDamage, 'Album complete!');
      } else {
        emit(d, 'rule', undefined, `Album: ${page}`);
      }
    }
  }
  return bonus;
};

/** Twin Seed: a matched card takes its twin with it. Returns nothing; damage is dealt here. */
export const resolveTwins = (d: Draft, matched: Card[]) => {
  const ids = new Set(matched.map(c => c.id));
  const twins = [...new Set(matched.map(c => c.twinOf).filter((id): id is string => !!id && !ids.has(id)))];
  for (const id of twins) {
    const idx = d.board.findIndex(c => c.id === id);
    if (idx < 0 || !touchable(d, idx)) continue;
    emit(d, 'hit', dealDamage(d, (mods(d).twinDamage ?? 0) * foeMultiplier(d)), 'Twin');
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
    if (g.bounty.left <= 0) rollBounty(d);
  }
  if (on(m.magnetDamage)) placeMagnet(d);
  if (set.auto) return;
  g.lastSetSlots = set.slots;
  g.glassSinceMs = d.elapsedMs;
  if (on(m.snowballStep)) g.snowball = Math.min(Math.max(1, Math.round(m.snowballMax ?? 0)), g.snowball + 1);
};

export const onMistakeGear = (d: Draft) => {
  const m = mods(d);
  d.gear.snowball = Math.floor(d.gear.snowball / 2);
  if (on(m.glassDamage) && !d.gear.glassBroken) shatterGlass(d, 'mistake');
};

export const onWaveStartGear = (d: Draft) => {
  d.gear = { ...d.gear, snowball: 0, glassBroken: false, glassSinceMs: d.elapsedMs, lastSetSlots: [] };
};

/** On the fight clock: the Glass Sword's deadline and the Fog Lantern's flips. */
export const tickGear = (d: Draft) => {
  const m = mods(d);
  if (on(m.glassDamage) && !d.gear.glassBroken && d.elapsedMs - d.gear.glassSinceMs > (m.glassWindowMs ?? 0)) shatterGlass(d, 'too slow');
  const due = d.board.map((c, i) => (c.fogFlipAt !== undefined && d.elapsedMs >= c.fogFlipAt ? i : -1)).filter(i => i >= 0);
  if (due.length) {
    updateCards(d, due, c => {
      const { fogFlipAt: _at, fogBonus, ...rest } = c;
      return rest.isFaceDown ? { ...rest, isFaceDown: false, bonusPoints: (rest.bonusPoints ?? 0) + (fogBonus ?? 0) } : rest;
    });
    emit(d, 'rule', due.length, 'The fog lifts');
  }
};

/** Keep the tricks' markers true after any change (a weapon picked up mid-fight, a marked card destroyed). */
export const syncGear = (d: Draft) => {
  if (d.status !== 'playing') return;
  const m = mods(d);
  if (on(m.bountyDamage) && !d.gear.bounty) rollBounty(d);
  const marked = d.board.filter(c => c.magnet).length;
  if (on(m.magnetDamage) ? marked !== 1 : marked > 0) {
    if (on(m.magnetDamage)) placeMagnet(d);
    else updateCards(d, d.board.map((c, i) => (c.magnet ? i : -1)).filter(i => i >= 0), c => ({ ...c, magnet: false }));
  }
  // Twins point at each other, and a twin whose partner left is an ordinary card again
  if (d.board.some(c => c.twinOf)) {
    const byId = new Map(d.board.map(c => [c.id, c]));
    const partner = new Map<string, string>();
    for (const c of d.board) if (c.twinOf && byId.has(c.twinOf)) { partner.set(c.id, c.twinOf); partner.set(c.twinOf, c.id); }
    const stale = d.board.map((c, i) => (c.twinOf !== partner.get(c.id) ? i : -1)).filter(i => i >= 0);
    updateCards(d, stale, c => {
      const { twinOf: _old, ...rest } = c;
      const p = partner.get(c.id);
      return p ? { ...rest, twinOf: p } : rest;
    });
  }
  // One wild card at a time
  const wilds = d.board.map((c, i) => (c.isWild ? i : -1)).filter(i => i >= 0);
  if (wilds.length > 1) updateCards(d, wilds.slice(1), c => ({ ...c, isWild: false }));
};
