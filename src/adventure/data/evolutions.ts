/**
 * Evolutions: a 20-second power trip.
 *
 * A recipe is two weapon families from different roles. It is ARMED in a fight
 * while the player holds one weapon of each family (charms, picks or buys).
 * While a recipe is armed, refills may bring the Evolution Catalyst card;
 * matching it in a Set starts the evolution for 20 s. Its rules (below) are
 * live only during that window, on top of a flat +1 damage per Set
 * (engine/sources.ts EVOLUTION_RULES). Up to 3 evolutions per fight.
 *
 * Families are weapon id prefixes: `oracle-eye` matches `oracle-eye-rare`.
 * The two families of one recipe never share a weapon, so one weapon can't arm
 * a recipe alone.
 */
import type { EvolutionRecipe } from '../types';

/** Weapon families (ids from WEAPONS in utils/gameDefinitions.ts and data/adventureWeapons.ts) */
export const FAMILIES = {
  explosion: ['blast-powder'],
  healing: ['mending-charm', 'vital-core', 'soul-harvest'],
  fire: ['flint-spark', 'sympathetic-flames', 'cascade-core'],
  echo: ['echo-stone', 'chain-reaction'],
  laser: ['prismatic-ray'],
  grace: ['second-chance', 'fortune-token', 'fortunes-shield', 'grace-conduit', 'snowball'],
  coin: ['fortunes-favor', 'fortunes-blessing'],
  time: ['chrono-shard', 'time-drop', 'temporal-core', 'hourglass-of-ages', 'temporal-rift'],
  hint: ['oracle-eye', 'seeker-lens', 'crystal-orb', 'clairvoyant-sphere', 'enlightened-eye', 'prophets-vision', 'mystic-sight'],
  ricochet: ['chaos-shard', 'entropy-engine'],
  growth: ['growth-seed', 'field-stone', 'life-bloom', 'terra-foundation'],
  life: ['life-vessel', 'vital-core', 'life-link'],
  connector: ['connector', 'web-weaver', 'echo-chamber', 'revenge-linker', 'neural-network'],
} as const satisfies Record<string, readonly string[]>;

const fam = (k: keyof typeof FAMILIES): string[] => [...FAMILIES[k]];

/** In recipe order: when several are armed, the Catalyst starts the first one not already running. */
export const EVOLUTION_RECIPES: EvolutionRecipe[] = [
  {
    id: 'phoenix-pyre',
    name: 'Phoenix Pyre',
    icon: 'lorc/fireball',
    families: [fam('explosion'), fam('healing')],
    familyText: 'Explosion + Healing',
    activeText: 'Every heal or lost heart blasts a 3×2 block. Every Set has a 25% chance to heal 1.',
    flavor: 'Burn down, rise up, burn everything else down. Getting hurt has never felt this good.',
    source: {
      rules: [
        { trigger: { on: 'healed' }, effects: [{ do: 'explode', area: { shape: 'block', cols: 3, rows: 2 } }], callout: 'Phoenix!' },
        { trigger: { on: 'hurt' }, effects: [{ do: 'explode', area: { shape: 'block', cols: 3, rows: 2 } }], callout: 'Rebirth!' },
        { trigger: { on: 'set' }, when: [{ kind: 'chance', pct: 25 }], effects: [{ do: 'heal', amount: 1 }] },
      ],
    },
  },
  {
    id: 'wildfire-echo',
    name: 'Wildfire Echo',
    icon: 'lorc/fire-ring',
    families: [fam('fire'), fam('echo')],
    familyText: 'Fire + Echo',
    activeText: 'Every echo ignites 2 cards. Every card that burns out sets another card alight.',
    flavor: 'The Set you made echoes, the echo catches, and the meadow remembers the flame.',
    source: {
      rules: [
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
    activeText: 'Every grace save fires a row laser. Every 3rd Set fires a column laser.',
    flavor: 'Forgiven, then avenged. Near misses come back as light.',
    source: {
      rules: [
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
    activeText: 'Every coin you gain adds +1s. Every time gain hits the foe for 3.',
    flavor: 'Time is money. Money is time. Both of them hurt, if you throw them hard enough.',
    source: {
      rules: [
        { trigger: { on: 'weapon', kind: 'coin' }, effects: [{ do: 'time', seconds: 1 }] },
        { trigger: { on: 'weapon', kind: 'time' }, effects: [{ do: 'damage', amount: 3 }], callout: 'Golden!' },
      ],
    },
  },
  {
    id: 'seeker-swarm',
    name: 'Seeker Swarm',
    icon: 'lorc/chained-arrow-heads',
    families: [fam('hint'), fam('ricochet')],
    familyText: 'Hint + Ricochet',
    activeText: 'Every hint ricochets into 2 cards. Every 2nd Set gives you a hint.',
    flavor: 'Point at a Set, and a swarm of shards points at everything else.',
    source: {
      rules: [
        { trigger: { on: 'hintUsed' }, effects: [{ do: 'ricochet', count: 2 }], callout: 'Swarm!' },
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
    activeText: 'Every Set grows the board by 2. At 18+ cards, a Set detonates a 3×3 block.',
    flavor: 'Grow the universe until it can not hold itself. Then let it go.',
    source: {
      rules: [
        { trigger: { on: 'set' }, effects: [{ do: 'growBoard', count: 2 }] },
        {
          trigger: { on: 'set' },
          when: [{ kind: 'boardAtLeast', n: 18 }],
          effects: [{ do: 'explode', area: { shape: 'block', cols: 3, rows: 3 } }],
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
    activeText: 'Every lost heart fires a row laser. Every heal makes your next Set deal ×2.',
    flavor: 'Every drop you spill is a beam. Every drop you win back is a promise.',
    source: {
      rules: [
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
    activeText: 'Every Set links 2 new pairs of cards. A linked card destroyed adds +2s and deals 2.',
    flavor: 'Wire the whole board into one clock, then pull the pin.',
    source: {
      rules: [
        { trigger: { on: 'set' }, effects: [{ do: 'link', count: 2 }] },
        { trigger: { on: 'linkDestroyed' }, effects: [{ do: 'time', seconds: 2 }, { do: 'damage', amount: 2 }], callout: 'Overclock!' },
      ],
    },
  },
];

export const getEvolutionRecipe = (id: string): EvolutionRecipe => {
  const r = EVOLUTION_RECIPES.find(x => x.id === id);
  if (!r) throw new Error(`Unknown evolution recipe: ${id}`);
  return r;
};
