/**
 * The deck: what is in it, and which of its cards are dealt next.
 *
 * Pure functions (no random numbers, no state): the fight (`engine/fight.ts`)
 * shuffles, draws and puts cards back. The numbers are in `DECK_RULES`
 * (data/rules.ts), which also says why each rule is there.
 */
import type { AttributeName, Card } from '@/types';
import { createDeck } from '@/utils/gameUtils';
import { getBoardSizeForAttributes } from '@/utils/gameConfig';
import { DECK_RULES } from '../data/rules';
import type { LevelDef } from '../types';
import { allSets } from './sets';

const valueOf = (c: Card, a: AttributeName) => (a === 'background' ? c.background ?? 'white' : c[a]);

/** Two cards of one kind look the same: they agree on every trait in play. */
export const kindOf = (c: Card, attrs: readonly AttributeName[]): string => attrs.map(a => valueOf(c, a)).join('|');

/**
 * How many of each card a level's deck holds: one, unless every card the
 * level's traits can make would fit on its board at once (two traits make nine
 * cards, and the board is nine).
 */
export const deckCopies = (level: LevelDef): number => {
  const traits = level.rules.attributes.length;
  const board = level.rules.boardSize ?? getBoardSizeForAttributes(traits);
  return 3 ** traits <= board ? DECK_RULES.copies : 1;
};

/** A level's deck, in order (the fight shuffles it). */
export const buildDeck = (level: LevelDef): Card[] => {
  const cards = createDeck(level.rules.attributes);
  const deck = [...cards];
  for (let n = 2; n <= deckCopies(level); n++) deck.push(...cards.map(c => ({ ...c, id: `${c.id}-copy${n}` })));
  return deck;
};

/** Which traits differ across a Set: "same color, three shapes" is one kind of Set, "nothing in common" another. */
const kindOfSet = (set: readonly Card[], attrs: readonly AttributeName[]): string =>
  attrs.map(a => (valueOf(set[0], a) === valueOf(set[1], a) ? 's' : 'd')).join('');

/** Every kind of Set a level's traits allow (two traits: same color, same shape, all different). */
export const kindsOfSet = (attrs: readonly AttributeName[]): number => 2 ** attrs.length - 1;

/**
 * What a board offers: how many different Sets (two copies of a card make the
 * same Set, counted once) and how many kinds of Set.
 */
export const boardVariety = (board: Card[], attrs: AttributeName[]): { sets: number; kinds: number } => {
  const sets = new Set<string>();
  const kinds = new Set<string>();
  for (const set of allSets(board, attrs)) {
    sets.add(set.map(c => kindOf(c, attrs)).sort().join(' '));
    kinds.add(kindOfSet(set, attrs));
  }
  return { sets: sets.size, kinds: kinds.size };
};

/**
 * A deck with copies is dealt for variety. The cards at `slots` are leaving the
 * board: this picks the deck cards that take their places, as deck positions in
 * slot order (or null: deal from the top).
 *
 * The board that results keeps as many kinds of Set as the deck allows, then
 * brings back as few of the kinds that just left as it can (never more than
 * `maxReturning`, and never into the slot the kind left), then has the most
 * Sets. Ties go to the cards nearest the top, so the shuffle still decides.
 */
export const variedDeal = (board: readonly Card[], slots: readonly number[], deck: readonly Card[], attrs: AttributeName[]): number[] | null => {
  const n = slots.length;
  const reach = Math.min(deck.length, DECK_RULES.dealWindow);
  if (n === 0 || reach < n) return null;
  const leaving = new Set(slots);
  const staying = board.filter((_, i) => !leaving.has(i));
  const leftKinds = slots.map(i => kindOf(board[i], attrs));
  const left = new Set(leftKinds);
  const deckKinds = deck.slice(0, reach).map(c => kindOf(c, attrs));
  // One slot: a kind that came back would land where it left
  const maxReturning = n > 1 ? DECK_RULES.maxReturning : 0;

  const best: { score: number; picks: number[] | null } = { score: -Infinity, picks: null };
  const picked: number[] = [];
  const walk = (from: number, returning: number) => {
    if (picked.length === n) {
      const candidateBoard = [...staying, ...picked.map(p => deck[p])];
      const { sets, kinds } = boardVariety(candidateBoard, attrs);
      const dupes = candidateBoard.length - new Set(candidateBoard.map(c => kindOf(c, attrs))).size;
      const score =
        kinds * DECK_RULES.kindOfSetWorth -
        returning * DECK_RULES.returningCost -
        dupes * DECK_RULES.duplicatePairCost +
        sets;
      if (score > best.score) {
        best.score = score;
        best.picks = [...picked];
      }
      return;
    }
    for (let p = from; p <= reach - (n - picked.length); p++) {
      const back = left.has(deckKinds[p]) ? 1 : 0;
      if (returning + back > maxReturning) continue;
      picked.push(p);
      walk(p + 1, returning + back);
      picked.pop();
    }
  };
  walk(0, 0);
  const chosen = best.picks;
  if (!chosen) return null;
  // Seat them so no kind lands in the slot it just left (turn the order until none does)
  for (let turn = 0; turn < n; turn++) {
    const seated = chosen.map((_, i) => chosen[(i + turn) % n]);
    if (seated.every((p, i) => deckKinds[p] !== leftKinds[i])) return seated;
  }
  return chosen;
};
