/**
 * Evolutions: a 30-second power trip.
 *
 * All 208 Evolution IDs are preserved (9 ★ SIGNATURE family recipes here + 199
 * pair recipes in `evolutionPairs.ts`). With the generic evolution chassis halved
 * ([GP-12]), each Signature and Pair recipe carries bold bespoke board-warping
 * rules and a concise `shortVerb` (≤ 55 chars) for <1.5s mid-fight scanning in
 * `EvolutionPickOverlay.tsx`.
 */
import type { EvolutionRecipe } from '../types';
import { PAIR_RECIPES, PAIR_SHORT_VERBS } from './evolutionPairs';

/** Weapon families (ids from WEAPONS in utils/gameDefinitions.ts and data/adventureWeapons.ts) */
export const FAMILIES = {
  explosion: ['blast-powder', 'life-link'],
  healing: ['mending-charm', 'soul-harvest'],
  fire: ['flint-spark', 'cascade-core'],
  echo: ['echo-stone', 'chain-reaction', 'temporal-rift'],
  laser: ['prismatic-ray', 'grace-conduit'],
  grace: ['second-chance', 'fortune-token', 'chaos-conduit'],
  coin: ['fortunes-favor', 'wisdom-chain'],
  time: ['chrono-shard', 'time-drop'],
  hint: ['oracle-eye', 'seeker-lens', 'crystal-orb', 'mystic-sight', 'fortunes-blessing'],
  ricochet: ['chaos-shard'],
  growth: ['growth-seed', 'field-stone'],
  life: ['life-vessel'],
  connector: ['connector', 'web-weaver', 'echo-chamber', 'revenge-linker', 'neural-network'],
} as const satisfies Record<string, readonly string[]>;

const fam = (k: keyof typeof FAMILIES): string[] => [...FAMILIES[k]];

/** Taught by star rewards; they arm from whole weapon families (★ SIGNATURE tier). */
export const SIGNATURE_RECIPES: EvolutionRecipe[] = [
  {
    id: 'phoenix-pyre',
    name: 'Phoenix Pyre',
    icon: 'lorc/fireball',
    families: [fam('explosion'), fam('healing')],
    familyText: 'Explosion + Healing',
    activeText: 'Heals 1 & blasts 3×2 (also on hurt). Every 2nd Set heals 1 & blasts 3×2. Every heal deals 6.',
    flavor: 'Burn down, rise up, burn everything else down. Getting hurt has never felt this good.',
    source: {
      rules: [
        { trigger: { on: 'evolutionStart' }, effects: [{ do: 'heal', amount: 1 }, { do: 'explode', area: { shape: 'block', cols: 3, rows: 2 } }] },
        { trigger: { on: 'hurt' }, effects: [{ do: 'explode', area: { shape: 'block', cols: 3, rows: 2 } }], callout: 'Rebirth!' },
        { trigger: { on: 'everyNthSet', n: 2 }, effects: [{ do: 'heal', amount: 1 }, { do: 'explode', area: { shape: 'block', cols: 3, rows: 2 } }], callout: 'Phoenix!' },
        { trigger: { on: 'healed' }, effects: [{ do: 'damage', amount: 6 }] },
      ],
    },
  },
  {
    id: 'wildfire-echo',
    name: 'Wildfire Echo',
    icon: 'lorc/fire-ring',
    families: [fam('fire'), fam('echo')],
    familyText: 'Fire + Echo',
    activeText: 'Ignites 3 cards at once. Every echo ignites 2 cards. Burned cards deal 2 (50% to ignite another).',
    flavor: 'The Set you made echoes, the echo catches, and the meadow remembers the flame.',
    source: {
      rules: [
        { trigger: { on: 'evolutionStart' }, effects: [{ do: 'ignite', count: 3 }] },
        { trigger: { on: 'weapon', kind: 'echo' }, effects: [{ do: 'ignite', count: 2 }], callout: 'Wildfire!' },
        { trigger: { on: 'cardBurned' }, effects: [{ do: 'damage', amount: 2 }] },
        { trigger: { on: 'cardBurned' }, when: [{ kind: 'chance', pct: 50 }], effects: [{ do: 'ignite', count: 1 }] },
      ],
    },
  },
  {
    id: 'judgement-beam',
    name: 'Judgement Beam',
    icon: 'lorc/laser-blast',
    families: [fam('laser'), fam('grace')],
    familyText: 'Laser + Grace',
    activeText: 'Gives 1 grace & fires a row laser. Grace saves fire row + column lasers. Every 2nd Set fires a column laser.',
    flavor: 'Forgiven, then avenged. Near misses come back as light.',
    source: {
      rules: [
        { trigger: { on: 'evolutionStart' }, effects: [{ do: 'grace', amount: 1 }, { do: 'laser', area: { shape: 'row' } }] },
        { trigger: { on: 'graceUsed' }, effects: [{ do: 'laser', area: { shape: 'row' } }, { do: 'laser', area: { shape: 'column' } }], callout: 'Judgement!' },
        { trigger: { on: 'everyNthSet', n: 2 }, effects: [{ do: 'laser', area: { shape: 'column' } }] },
      ],
    },
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    icon: 'delapouite/coins-pile',
    families: [fam('coin'), fam('time')],
    familyText: 'Coin + Time',
    activeText: 'Gilds 3 cards; bonus cards pay 3 coins & deal 4. Every coin gain adds +1s & deals 3. Time gains deal 6.',
    flavor: 'Time is money. Money is time. Both of them hurt, if you throw them hard enough.',
    source: {
      rules: [
        { trigger: { on: 'evolutionStart' }, effects: [{ do: 'convert', to: 'gold', count: 3 }] },
        { trigger: { on: 'bonusCardMatched' }, effects: [{ do: 'coins', amount: 3 }, { do: 'damage', amount: 4 }] },
        { trigger: { on: 'weapon', kind: 'coin' }, effects: [{ do: 'time', seconds: 1 }, { do: 'damage', amount: 3 }] },
        { trigger: { on: 'weapon', kind: 'time' }, effects: [{ do: 'damage', amount: 6 }], callout: 'Golden!' },
      ],
    },
  },
  {
    id: 'seeker-swarm',
    name: 'Seeker Swarm',
    icon: 'lorc/chained-arrow-heads',
    families: [fam('hint'), fam('ricochet')],
    familyText: 'Hint + Ricochet',
    activeText: 'Gives 2 hints (+1 every 2nd Set). Hinted Sets ricochet 4 cards, deal 6 & prime ×1.5 next Set.',
    flavor: 'Point at a Set, and a swarm of shards points at everything else.',
    source: {
      rules: [
        { trigger: { on: 'evolutionStart' }, effects: [{ do: 'hint', amount: 2 }] },
        { trigger: { on: 'set' }, when: [{ kind: 'hintedSet' }], effects: [{ do: 'ricochet', count: 4 }, { do: 'damage', amount: 6 }, { do: 'nextSetMultiplier', times: 1.5 }], callout: 'Swarm!' },
        { trigger: { on: 'everyNthSet', n: 2 }, effects: [{ do: 'hint', amount: 1 }] },
      ],
    },
  },
  {
    id: 'big-bang',
    name: 'Big Bang',
    icon: 'lorc/bright-explosion',
    families: [fam('growth'), fam('explosion')],
    familyText: 'Growth + Explosion',
    activeText: 'Every Set grows board by 2 (empowers at max). At 15+ cards, every Set blasts a 3×2 block & empowers +1.',
    flavor: 'Grow the universe until it can not hold itself. Then let it go.',
    source: {
      rules: [
        { trigger: { on: 'set' }, effects: [{ do: 'growBoard', count: 2 }] },
        {
          trigger: { on: 'set' },
          when: [{ kind: 'boardAtLeast', n: 15 }],
          effects: [{ do: 'explode', area: { shape: 'block', cols: 3, rows: 2 } }, { do: 'empowerBoard', amount: 1 }],
          callout: 'BIG BANG!',
        },
      ],
    },
  },
  {
    id: 'bloodline',
    name: 'Bloodline',
    icon: 'lorc/broken-heart-zone',
    families: [fam('life'), fam('laser')],
    familyText: 'Life + Laser',
    activeText: 'Heals 1 & fires row + column lasers. Full hearts or hurt fires a row laser. Heals double next Set & empower +1.',
    flavor: 'Every drop you spill is a beam. Every drop you win back is a promise.',
    source: {
      rules: [
        { trigger: { on: 'evolutionStart' }, effects: [{ do: 'heal', amount: 1 }, { do: 'laser', area: { shape: 'row' } }, { do: 'laser', area: { shape: 'column' } }] },
        { trigger: { on: 'set' }, when: [{ kind: 'heartsFull' }], effects: [{ do: 'laser', area: { shape: 'row' } }] },
        { trigger: { on: 'hurt' }, effects: [{ do: 'laser', area: { shape: 'row' } }], callout: 'Bloodline!' },
        { trigger: { on: 'healed' }, effects: [{ do: 'nextSetMultiplier', times: 2 }, { do: 'empowerBoard', amount: 1 }] },
      ],
    },
  },
  {
    id: 'overclock',
    name: 'Overclock',
    icon: 'lorc/time-trap',
    families: [fam('connector'), fam('time')],
    familyText: 'Connector + Time',
    activeText: 'Links 3 pairs (+1 every 2nd Set). Destroyed links deal 2 (35% +1s); every 3rd Set freezes clock 1.5s.',
    flavor: 'Wire the whole board into one clock, then pull the pin.',
    source: {
      rules: [
        { trigger: { on: 'evolutionStart' }, effects: [{ do: 'link', count: 3 }] },
        { trigger: { on: 'everyNthSet', n: 2 }, effects: [{ do: 'link', count: 1 }] },
        { trigger: { on: 'everyNthSet', n: 3 }, effects: [{ do: 'freeze', ms: 1500 }], callout: 'Overclock!' },
        { trigger: { on: 'linkDestroyed' }, effects: [{ do: 'damage', amount: 2 }] },
        { trigger: { on: 'linkDestroyed' }, when: [{ kind: 'chance', pct: 35 }], effects: [{ do: 'time', seconds: 1 }] },
      ],
    },
  },
  {
    id: 'entropy-engine',
    name: 'Entropy Engine',
    icon: 'lorc/cycle',
    families: [fam('ricochet'), fam('explosion')],
    familyText: 'Ricochet + Explosion',
    activeText: 'Ricochets 3 cards. Blasts ricochet 2 cards; ricochets have a 45% chance to blast a 2×2 block.',
    flavor: 'Shards set off charges, charges throw shards. Somewhere in the middle, the foe stops having a plan.',
    source: {
      rules: [
        { trigger: { on: 'evolutionStart' }, effects: [{ do: 'ricochet', count: 3 }] },
        { trigger: { on: 'weapon', kind: 'explosion' }, effects: [{ do: 'ricochet', count: 2 }], callout: 'Entropy!' },
        {
          trigger: { on: 'weapon', kind: 'ricochet' },
          when: [{ kind: 'chance', pct: 45 }],
          effects: [{ do: 'explode', area: { shape: 'block', cols: 2, rows: 2 } }],
        },
      ],
    },
  },
];

/** Concise ≤55-char combat verbs for the 9 ★ SIGNATURE recipes (`EvolutionPickOverlay.tsx`). */
export const SIGNATURE_SHORT_VERBS: Readonly<Record<string, string>> = {
  'phoenix-pyre': 'Heal + 3×2 blast every 2nd Set & on hurt; heals +6',
  'wildfire-echo': 'Ignite 3; echoes ignite 2; burns chain & deal +2',
  'judgement-beam': 'Grace saves fire cross lasers; every 2nd Set beams',
  'golden-hour': 'Gild 3; coins add +1s & +3 dmg; time gains +6 dmg',
  'seeker-swarm': 'Hinted Sets ricochet 4, +6 dmg & prime ×1.5 next',
  'big-bang': 'Grow +2/Set; at 15+ cards every Set blasts 3×2',
  bloodline: 'Cross lasers on start; heals double next Set',
  overclock: 'Link 3 pairs; every 3rd Set freezes clock 1.5s',
  'entropy-engine': 'Blasts ricochet 2; ricochets 45% blast 2×2',
};

/** Set of all 9 ★ SIGNATURE family evolution IDs. */
export const SIGNATURE_RECIPE_IDS: ReadonlySet<string> = new Set(SIGNATURE_RECIPES.map(r => r.id));

/** True when `id` is one of the 9 ★ SIGNATURE family recipes. */
export const isSignatureRecipe = (id: string): boolean => SIGNATURE_RECIPE_IDS.has(id);

/** In recipe order: when several are armed, the Catalyst starts the first one not already running. */
export const EVOLUTION_RECIPES: EvolutionRecipe[] = [...SIGNATURE_RECIPES, ...PAIR_RECIPES];

/** Concise ≤55-char combat verbs across all 208 recipes for <1.5s scanning in `EvolutionPickOverlay`. */
export const EVOLUTION_SHORT_VERBS: Readonly<Record<string, string>> = {
  ...SIGNATURE_SHORT_VERBS,
  ...PAIR_SHORT_VERBS,
};

/** Scannable ≤55-char verb for mid-fight picking (falls back safely to `activeText`). */
export const evolutionShortVerb = (recipe: EvolutionRecipe): string =>
  EVOLUTION_SHORT_VERBS[recipe.id] ?? recipe.activeText;

export const getEvolutionRecipe = (id: string): EvolutionRecipe => {
  const r = EVOLUTION_RECIPES.find(x => x.id === id);
  if (!r) throw new Error(`Unknown evolution recipe: ${id}`);
  return r;
};
