/**
 * Fast Set search: for every pair, the third card of a Set is fully
 * determined, so we look it up instead of trying every triple (O(n²)).
 */
import type { AttributeName, Card } from '@/types';
import { ATTRIBUTE_VALUES } from '@/utils/gameUtils';

const valueOf = (c: Card, a: AttributeName) => (a === 'background' ? c.background ?? 'white' : c[a]);

const keyOf = (c: Card, attrs: AttributeName[]) => attrs.map(a => valueOf(c, a)).join('|');

const thirdKey = (x: Card, y: Card, attrs: AttributeName[]) =>
  attrs
    .map(a => {
      const vx = valueOf(x, a);
      const vy = valueOf(y, a);
      if (vx === vy) return vx;
      return (ATTRIBUTE_VALUES[a] as readonly (string | number)[]).find(v => v !== vx && v !== vy);
    })
    .join('|');

/** A card the player can pick: duds and face-down cards can't be part of a Set. */
export const isSelectable = (c: Card) => !c.isDud && !c.isFaceDown;

/** Index triples [i, j, k] (i < j < k) of every Set among `cards`, found pair by pair. */
function* setTriples(cards: Card[], attrs: AttributeName[]): Generator<[number, number, number]> {
  const index = new Map<string, number[]>();
  cards.forEach((c, i) => {
    const k = keyOf(c, attrs);
    const list = index.get(k);
    if (list) list.push(i);
    else index.set(k, [i]);
  });
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const ks = index.get(thirdKey(cards[i], cards[j], attrs));
      if (!ks) continue;
      for (const k of ks) if (k > j) yield [i, j, k];
    }
  }
}

/** Every distinct Set among the selectable cards. */
export const allSets = (board: Card[], attrs: AttributeName[]): Card[][] => {
  const cards = board.filter(isSelectable);
  return Array.from(setTriples(cards, attrs), ([i, j, k]) => [cards[i], cards[j], cards[k]]);
};

export const hasAnySet = (board: Card[], attrs: AttributeName[]): boolean =>
  !setTriples(board.filter(isSelectable), attrs).next().done;

/** How many of the active attributes are all-different across three cards. */
export const countDifferentAttributes = (cards: Card[], attrs: AttributeName[]): number => {
  if (cards.length !== 3) return 0;
  return attrs.filter(a => new Set(cards.map(c => c[a as keyof Card])).size === 3).length;
};

/** A Rainbow: three cards that differ in every active attribute. */
export const isRainbow = (cards: Card[], attrs: AttributeName[]): boolean =>
  cards.length === 3 && countDifferentAttributes(cards, attrs) === attrs.length;
