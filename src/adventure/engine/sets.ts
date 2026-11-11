/**
 * Fast Set search: for every pair, the third card of a Set is fully
 * determined, so we look it up instead of trying every triple (O(n²)).
 */
import type { AttributeName, Card } from '@/types';

const VALUES: Record<AttributeName, readonly (string | number)[]> = {
  shape: ['oval', 'squiggle', 'diamond'],
  color: ['red', 'green', 'purple'],
  number: [1, 2, 3],
  shading: ['solid', 'striped', 'open'],
  background: ['white', 'beige', 'charcoal'],
};

const valueOf = (c: Card, a: AttributeName) => (a === 'background' ? c.background ?? 'white' : c[a]);

const keyOf = (c: Card, attrs: AttributeName[]) => attrs.map(a => valueOf(c, a)).join('|');

const thirdKey = (x: Card, y: Card, attrs: AttributeName[]) =>
  attrs
    .map(a => {
      const vx = valueOf(x, a);
      const vy = valueOf(y, a);
      if (vx === vy) return vx;
      return VALUES[a].find(v => v !== vx && v !== vy);
    })
    .join('|');

const isSelectable = (c: Card) => !c.isDud && !c.isFaceDown;

/** Every distinct Set among the selectable cards. */
export const allSets = (board: Card[], attrs: AttributeName[]): Card[][] => {
  const cards = board.filter(isSelectable);
  const index = new Map<string, number[]>();
  cards.forEach((c, i) => {
    const k = keyOf(c, attrs);
    const list = index.get(k);
    if (list) list.push(i);
    else index.set(k, [i]);
  });
  const out: Card[][] = [];
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const ks = index.get(thirdKey(cards[i], cards[j], attrs));
      if (!ks) continue;
      for (const k of ks) if (k > j) out.push([cards[i], cards[j], cards[k]]);
    }
  }
  return out;
};

export const hasAnySet = (board: Card[], attrs: AttributeName[]): boolean => {
  const cards = board.filter(isSelectable);
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
      if (ks && ks.some(k => k !== i && k !== j)) return true;
    }
  }
  return false;
};
