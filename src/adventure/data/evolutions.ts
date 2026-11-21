/**
 * Evolutions: a 30-second power trip.
 *
 * There are 4 evolutions per Armory weapon (156). The 9 SIGNATURE recipes here
 * arm from two weapon FAMILIES and are taught by star rewards; the other 147
 * (data/evolutionPairs.ts) arm from one exact pair of weapons and are
 * discovered by forging them. Once the player knows any recipe, every recipe
 * arms from its weapons.
 *
 * A signature recipe is two weapon families from different roles. It is ARMED in a fight
 * while the player holds one weapon of each family (charms, picks or buys).
 * While a recipe is armed, refills may bring the Evolution Catalyst card;
 * matching it in a Set hits the foe for 10 and starts the evolution for 30 s.
 * Its rules (below) are live only during that window, on top of what every
 * evolution gives: every Set's own hit ×1.5 and +2 per active evolution
 * (engine/sources.ts EVOLUTION_RULES). Up to 3 evolutions per fight.
 *
 * Every recipe must be worth chasing (__tests__/adventureBuilds.test.ts): it
 * opens with something or works on every Set, not only on a rare event.
 *
 * A family is the weapons that produce (or, for the bridge weapons, react to)
 * one effect. The two families of one recipe never share a weapon, so one
 * weapon can't arm a recipe alone.
 *
 * Weapons do one thing each; combining them is what evolutions are for. (The
 * old Entropy Engine weapon, ricochet plus blast in one item, is now the
 * Entropy Engine evolution.)
 */
import type { EvolutionRecipe } from '../types';
import { PAIR_RECIPES } from './evolutionPairs';

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

/** Taught by star rewards; they arm from whole weapon families. */
export const SIGNATURE_RECIPES: EvolutionRecipe[] = [
  {
    id: 'phoenix-pyre',
    name: 'Phoenix Pyre',
    icon: 'lorc/fireball',
    families: [fam('explosion'), fam('healing')],
    familyText: 'Explosion + Healing',
    activeText: 'Heals 1 & blasts 3×2 (also on hurt). Every 3rd Set heals 1 & blasts 2×2. Every heal deals 5.',
    flavor: 'Burn down, rise up, burn everything else down. Getting hurt has never felt this good.',
    source: {
      rules: [
        { trigger: { on: 'evolutionStart' }, effects: [{ do: 'heal', amount: 1 }, { do: 'explode', area: { shape: 'block', cols: 3, rows: 2 } }] },
        { trigger: { on: 'hurt' }, effects: [{ do: 'explode', area: { shape: 'block', cols: 3, rows: 2 } }], callout: 'Rebirth!' },
        { trigger: { on: 'everyNthSet', n: 3 }, effects: [{ do: 'heal', amount: 1 }, { do: 'explode', area: { shape: 'block', cols: 2, rows: 2 } }], callout: 'Phoenix!' },
        { trigger: { on: 'healed' }, effects: [{ do: 'damage', amount: 5 }] },
      ],
    },
  },
  {
    id: 'wildfire-echo',
    name: 'Wildfire Echo',
    icon: 'lorc/fire-ring',
    families: [fam('fire'), fam('echo')],
    familyText: 'Fire + Echo',
    activeText: 'Ignites 1 card right away. Every echo ignites 2 cards. Every burned-out card sets another card alight.',
    flavor: 'The Set you made echoes, the echo catches, and the meadow remembers the flame.',
    source: {
      rules: [
        { trigger: { on: 'evolutionStart' }, effects: [{ do: 'ignite', count: 1 }] },
        { trigger: { on: 'weapon', kind: 'echo' }, effects: [{ do: 'ignite', count: 2 }], callout: 'Wildfire!' },
        { trigger: { on: 'cardBurned' }, effects: [{ do: 'ignite', count: 1 }] },
      ],
    },
  },
  {
    id: 'judgement-beam',
    name: 'Judgement Beam',
    icon: 'lorc/laser-blast',
    families: [fam('laser'), fam('grace')],
    familyText: 'Laser + Grace',
    activeText: 'Gives 1 grace. Every grace save fires a row laser. Every 3rd Set fires a column laser.',
    flavor: 'Forgiven, then avenged. Near misses come back as light.',
    source: {
      rules: [
        { trigger: { on: 'evolutionStart' }, effects: [{ do: 'grace', amount: 1 }] },
        { trigger: { on: 'graceUsed' }, effects: [{ do: 'laser', area: { shape: 'row' } }], callout: 'Judgement!' },
        { trigger: { on: 'everyNthSet', n: 3 }, effects: [{ do: 'laser', area: { shape: 'column' } }] },
      ],
    },
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    icon: 'delapouite/coins-pile',
    families: [fam('coin'), fam('time')],
    familyText: 'Coin + Time',
    activeText: 'Turns 2 cards gold; bonus cards pay 2 coins. Every coin gain adds +1s and deals 2. Every time gain deals 4.',
    flavor: 'Time is money. Money is time. Both of them hurt, if you throw them hard enough.',
    source: {
      rules: [
        { trigger: { on: 'evolutionStart' }, effects: [{ do: 'convert', to: 'gold', count: 2 }] },
        { trigger: { on: 'bonusCardMatched' }, effects: [{ do: 'coins', amount: 2 }] },
        { trigger: { on: 'weapon', kind: 'coin' }, effects: [{ do: 'time', seconds: 1 }, { do: 'damage', amount: 2 }] },
        { trigger: { on: 'weapon', kind: 'time' }, effects: [{ do: 'damage', amount: 4 }], callout: 'Golden!' },
      ],
    },
  },
  {
    id: 'seeker-swarm',
    name: 'Seeker Swarm',
    icon: 'lorc/chained-arrow-heads',
    families: [fam('hint'), fam('ricochet')],
    familyText: 'Hint + Ricochet',
    activeText: 'Gives 1 hint, and another every 2nd Set. Matching a hinted Set ricochets into 3 cards and deals 4.',
    flavor: 'Point at a Set, and a swarm of shards points at everything else.',
    source: {
      rules: [
        { trigger: { on: 'evolutionStart' }, effects: [{ do: 'hint', amount: 1 }] },
        { trigger: { on: 'set' }, when: [{ kind: 'hintedSet' }], effects: [{ do: 'ricochet', count: 3 }, { do: 'damage', amount: 4 }], callout: 'Swarm!' },
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
    activeText: 'Every Set grows the board by 2 (empowers at max). At 15+ cards, every Set blasts a 3×2 block.',
    flavor: 'Grow the universe until it can not hold itself. Then let it go.',
    source: {
      rules: [
        { trigger: { on: 'set' }, effects: [{ do: 'growBoard', count: 2 }] },
        {
          trigger: { on: 'set' },
          when: [{ kind: 'boardAtLeast', n: 15 }],
          effects: [{ do: 'explode', area: { shape: 'block', cols: 3, rows: 2 } }],
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
    activeText: 'Fires row & column lasers. At full hearts or on hurt, fires a row laser. Every heal doubles your next Set.',
    flavor: 'Every drop you spill is a beam. Every drop you win back is a promise.',
    source: {
      rules: [
        { trigger: { on: 'evolutionStart' }, effects: [{ do: 'laser', area: { shape: 'row' } }, { do: 'laser', area: { shape: 'column' } }] },
        { trigger: { on: 'set' }, when: [{ kind: 'heartsFull' }], effects: [{ do: 'laser', area: { shape: 'row' } }] },
        { trigger: { on: 'hurt' }, effects: [{ do: 'laser', area: { shape: 'row' } }], callout: 'Bloodline!' },
        { trigger: { on: 'healed' }, effects: [{ do: 'nextSetMultiplier', times: 2 }] },
      ],
    },
  },
  {
    id: 'overclock',
    name: 'Overclock',
    icon: 'lorc/time-trap',
    families: [fam('connector'), fam('time')],
    familyText: 'Connector + Time',
    activeText: 'Links 2 pairs, plus 1 every 3rd Set. A linked card destroyed adds +1s and deals 3.',
    flavor: 'Wire the whole board into one clock, then pull the pin.',
    source: {
      rules: [
        { trigger: { on: 'evolutionStart' }, effects: [{ do: 'link', count: 2 }] },
        { trigger: { on: 'everyNthSet', n: 3 }, effects: [{ do: 'link', count: 1 }] },
        { trigger: { on: 'linkDestroyed' }, effects: [{ do: 'time', seconds: 1 }, { do: 'damage', amount: 3 }], callout: 'Overclock!' },
      ],
    },
  },
  {
    id: 'entropy-engine',
    name: 'Entropy Engine',
    icon: 'lorc/cycle',
    families: [fam('ricochet'), fam('explosion')],
    familyText: 'Ricochet + Explosion',
    activeText: 'Ricochets 2 cards. Blasts ricochet 2 cards; ricochets have a 35% chance to blast a 2×2 block.',
    flavor: 'Shards set off charges, charges throw shards. Somewhere in the middle, the foe stops having a plan.',
    source: {
      rules: [
        { trigger: { on: 'evolutionStart' }, effects: [{ do: 'ricochet', count: 2 }] },
        { trigger: { on: 'weapon', kind: 'explosion' }, effects: [{ do: 'ricochet', count: 2 }], callout: 'Entropy!' },
        {
          trigger: { on: 'weapon', kind: 'ricochet' },
          when: [{ kind: 'chance', pct: 35 }],
          effects: [{ do: 'explode', area: { shape: 'block', cols: 2, rows: 2 } }],
        },
      ],
    },
  },
];

/** In recipe order: when several are armed, the Catalyst starts the first one not already running. */
export const EVOLUTION_RECIPES: EvolutionRecipe[] = [...SIGNATURE_RECIPES, ...PAIR_RECIPES];

export const getEvolutionRecipe = (id: string): EvolutionRecipe => {
  const r = EVOLUTION_RECIPES.find(x => x.id === id);
  if (!r) throw new Error(`Unknown evolution recipe: ${id}`);
  return r;
};
