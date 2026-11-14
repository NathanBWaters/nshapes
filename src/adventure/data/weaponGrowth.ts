/**
 * Weapon growth: how a weapon gets stronger DURING a fight.
 *
 * Every weapon (but the few that already snowball) has something to look for.
 * Each time it happens the weapon gains a stack, and a stack raises one of
 * the weapon's own numbers, a standing modifier, or does something at once.
 * Stacks last until the fight ends. This is where a build snowballs: the
 * first minute is the weapon as written, the last minute is what you made it.
 *
 * Design rules (keep these true when editing):
 *  - Growth ADDS to a weapon. It never changes what the weapon does.
 *  - Weapons that already deal damage grow in small or sideways ways (a bit of
 *    chance, hearts, easier boards). Support weapons are the ones that take
 *    off: their growth is where the damage comes from.
 *  - The best growth is something to hunt for that a careless player would
 *    miss, or something that builds by itself from playing well.
 *  - Growth belongs to the weapon alone. Evolutions are their own thing and do
 *    not change how a weapon grows.
 *
 * ONE table, read by the engine (engine/growth.ts), the weapon explainer and
 * the HUD. Text is written from the numbers, so it cannot drift.
 */
import type { Effect, Modifiers, TrickKind, WeaponTriggerKind } from '../rules/types';

/** A Set counts as made "on a hint" when a hint was shown this recently */
export const HINTED_SET_MS = 12000;

/** What a Set has to be, beyond being a Set */
export type SetTest =
  /** Made while at full hearts */
  | 'fullHearts'
  /** All one color, and so was the Set before it, in the same color */
  | 'sameColorAgain'
  /** Uses at least two of the board's four corner cards */
  | 'corners'
  /** Has a 1, a 2 and a 3 */
  | 'oneTwoThree'
  /** Made on a hint (a card of it was pointed out) */
  | 'hinted'
  | 'rainbow';

export type GrowthWatch =
  | { on: 'set'; test?: SetTest }
  /** A wrong Set (with `allRed`: all three cards red) */
  | { on: 'mistake'; allRed?: boolean }
  | { on: 'weapon'; kind: WeaponTriggerKind }
  | { on: 'trick'; kind: TrickKind }
  /** One of this weapon's own rules fired (the Rally, the Clarity, the War Drum…) */
  | { on: 'own' }
  /** A doubled weapon trigger landed */
  | { on: 'doubled' }
  /** A Catalyst was matched */
  | { on: 'catalyst' }
  | { on: 'healed' | 'hurt' | 'hintUsed' | 'graceUsed' | 'cardBurned' | 'linkDestroyed' | 'cardBroken' | 'evolutionEnd' };

/** Modifier numbers a stack can add to */
export type GrowthMods = { [K in keyof Modifiers as Modifiers[K] extends number | undefined ? K : never]?: number };

export interface GrowthDef {
  watch: GrowthWatch;
  /** This many of them make one stack (default 1) */
  every?: number;
  /** With `every`: the count starts over when a Set fails the test */
  unbroken?: boolean;
  /** % chance that one of them counts (default 100) */
  chance?: number;
  /** Most stacks (default: no limit) */
  max?: number;
  /** What ONE stack adds: to the weapon's own numbers (data/weaponStats.ts keys) and to standing modifiers */
  stat?: Record<string, number>;
  mods?: GrowthMods;
  /** Done once each time a stack is gained */
  now?: Effect;
  /** What to look for, as "Every …" (the count and chance are written in front of it) */
  look: string;
  /** What a stack gives, in a few words */
  gives: string;
}

const trick = (kind: TrickKind, look: string, gives: string, stat: Record<string, number>, max?: number): GrowthDef[] => [
  { watch: { on: 'trick', kind }, stat, look, gives, ...(max ? { max } : {}) },
];

export const WEAPON_GROWTH: Record<string, GrowthDef[]> = {
  // ── Hearts ────────────────────────────────────────────────────────────────
  'mending-charm': [
    { watch: { on: 'set', test: 'fullHearts' }, every: 3, stat: { overheal: 3 }, look: 'Sets made at full hearts', gives: 'overheal hits +3 harder' },
  ],
  'life-vessel': [
    { watch: { on: 'set', test: 'rainbow' }, every: 2, unbroken: true, max: 4, now: { do: 'emptyHeart', amount: 1 }, look: 'Rainbows back to back', gives: '+1 max heart (it arrives empty)' },
  ],
  'soul-harvest': [{ watch: { on: 'healed' }, max: 10, stat: { bridgeChance: 2 }, look: 'time you heal', gives: '+2% heal chance per destroyed card' }],
  'life-link': [{ watch: { on: 'hurt' }, max: 6, stat: { explosionChance: 3 }, look: 'heart you lose', gives: '+3% blast chance' }],

  // ── Damage: these already hit hard, so they grow sideways ─────────────────
  // Blast Powder: nothing. It is already the strongest thing in the Armory.
  'flint-spark': [{ watch: { on: 'cardBurned' }, every: 3, max: 8, stat: { fireSpreadChance: 1 }, look: 'cards burned up', gives: '+1% fire chance' }],
  'prismatic-ray': [
    { watch: { on: 'weapon', kind: 'laser' }, max: 12, mods: { laserSetChance: 3 }, look: 'laser', gives: '+3% chance the cards that replace a laser hold a Set among themselves' },
  ],
  'chaos-shard': [
    { watch: { on: 'mistake', allRed: true }, max: 4, stat: { ricochetChance: 5 }, look: 'mistake made of three red cards', gives: '+5% ricochet chance' },
    { watch: { on: 'set', test: 'oneTwoThree' }, max: 30, mods: { ricochetHealChance: 1 }, look: 'Set with a 1, a 2 and a 3 in it', gives: '+1% chance a ricochet heals a heart' },
  ],
  'echo-stone': [
    { watch: { on: 'set', test: 'sameColorAgain' }, max: 10, stat: { echoChance: 3, strike: 1 }, look: 'one-color Set right after a Set of that same color', gives: '+3% echo chance and echoes hit +1 harder' },
  ],
  'chain-reaction': [{ watch: { on: 'weapon', kind: 'echo' }, max: 8, stat: { chainReactionChance: 5 }, look: 'echo', gives: '+5% double-echo chance' }],
  'cascade-core': [{ watch: { on: 'weapon', kind: 'echo' }, max: 8, stat: { bridgeChance: 4 }, look: 'echo', gives: '+4% chance an echo starts a fire' }],
  'temporal-rift': [{ watch: { on: 'weapon', kind: 'time' }, max: 10, stat: { bridgeChance: 3 }, look: 'time gain', gives: '+3% chance a time gain echoes' }],

  // ── Links ─────────────────────────────────────────────────────────────────
  connector: [
    { watch: { on: 'linkDestroyed' }, max: 10, stat: { connectionChance: 2 }, mods: { keepLinks: 1 }, look: 'card destroyed through a link', gives: '+2% link chance, and your links stay on the board between waves' },
  ],
  'web-weaver': [{ watch: { on: 'linkDestroyed' }, chance: 10, max: 4, now: { do: 'link', count: 1 }, look: 'card destroyed through a link', gives: 'a new link is woven' }],
  'neural-network': [{ watch: { on: 'linkDestroyed' }, max: 8, stat: { bonusConnectionChance: 5 }, look: 'card destroyed through a link', gives: '+5% bonus link chance' }],
  'echo-chamber': [{ watch: { on: 'linkDestroyed' }, max: 5, stat: { echoTimeBonusPerLink: 0.1 }, look: 'card destroyed through a link', gives: '+0.1s per linked card' }],
  'revenge-linker': [{ watch: { on: 'hurt' }, max: 8, stat: { strike: 2 }, look: 'heart you lose', gives: 'Revenge hits +2 harder' }],

  // ── Board ─────────────────────────────────────────────────────────────────
  // Field Stone and Growth Seed: nothing. They are the board's own snowball.
  'war-drum': [{ watch: { on: 'own' }, chance: 25, max: 3, stat: { power: 1 }, look: 'time the Drum sounds', gives: 'the Drum gives every card +1 more' }],
  'clarity-lens': [
    { watch: { on: 'own' }, max: 10, mods: { doubleClarityChance: 5 }, look: 'Clarity', gives: '+5% chance a Clarity simplifies two traits at once' },
  ],
  'rally-horn': [{ watch: { on: 'own' }, stat: { damage: 1 }, look: 'Rally', gives: 'Rally hits +1 harder' }],
  pinata: [{ watch: { on: 'cardBroken' }, stat: { bounty: 3 }, look: 'piñata you break', gives: 'later piñatas hold +3' }],
  'amplifier-coil': [
    { watch: { on: 'doubled' }, max: 8, stat: { chance: 2, shock: 1 }, look: 'trigger it doubles', gives: '+2% amplify chance and the shock hits +1 harder' },
  ],
  'catalyst-prism': [
    { watch: { on: 'catalyst' }, max: 6, mods: { evolutionDurationMs: 4000 }, look: 'Catalyst you match', gives: 'evolutions last 4s longer, starting with this one' },
  ],
  'encore-mask': [{ watch: { on: 'evolutionEnd' }, stat: { damage: 5 }, look: 'evolution that ends', gives: 'the Encore hits +5 harder' }],

  // ── Graces ────────────────────────────────────────────────────────────────
  'second-chance': [{ watch: { on: 'set' }, max: 30, mods: { luckPct: 2 }, look: 'Set you make', gives: '+2% luck: every weapon chance you hold goes up' }],
  'fortune-token': [
    { watch: { on: 'weapon', kind: 'grace' }, every: 3, max: 6, now: { do: 'growBoard', count: 1 }, look: 'graces gained (the ones you start with count)', gives: '+1 card on the board, for good' },
  ],
  'chaos-conduit': [{ watch: { on: 'weapon', kind: 'grace' }, max: 8, stat: { explosionChance: 2 }, look: 'grace you gain', gives: '+2% blast chance' }],
  'grace-conduit': [{ watch: { on: 'graceUsed' }, max: 8, stat: { bridgeChance: 5 }, look: 'grace that saves you', gives: '+5% chance a grace fires a laser' }],

  // ── Hints ─────────────────────────────────────────────────────────────────
  'seeker-lens': [{ watch: { on: 'set', test: 'hinted' }, max: 20, stat: { hintGainChance: 1 }, look: 'Set made on a hint', gives: '+1% hint chance' }],
  'crystal-orb': [{ watch: { on: 'hintUsed' }, max: 12, stat: { strike: 0.5 }, look: 'hint you use', gives: 'hints hit +0.5 harder' }],
  'oracle-eye': [
    { watch: { on: 'set' }, max: 40, stat: { autoHintChance: 1 }, look: 'Set you make', gives: '+1% chance to point out a card' },
    { watch: { on: 'set' }, chance: 15, max: 12, mods: { hintedSetDamage: 1 }, look: 'Set you make', gives: 'Sets made on a pointed-out card hit +1 harder' },
  ],
  'mystic-sight': [{ watch: { on: 'own' }, every: 2, max: 10, stat: { third: 1 }, look: 'Third Eyes', gives: 'the Third Eye hits +1 harder' }],
  'fortunes-blessing': [{ watch: { on: 'weapon', kind: 'coin' }, every: 2, max: 10, stat: { strike: 1 }, look: 'bonus coins', gives: 'bonus coins hit +1 harder' }],

  // ── Coins & XP ────────────────────────────────────────────────────────────
  'fortunes-favor': [{ watch: { on: 'weapon', kind: 'coin' }, every: 2, max: 10, stat: { strike: 1 }, look: 'bonus coins', gives: 'bonus coins hit +1 harder' }],
  'scholars-tome': [{ watch: { on: 'weapon', kind: 'xp' }, every: 2, max: 10, stat: { strike: 1 }, look: 'bonus XP gains', gives: 'bonus XP hits +1 harder' }],
  'wisdom-chain': [{ watch: { on: 'weapon', kind: 'xp' }, every: 2, max: 10, stat: { strike: 1 }, look: 'bonus XP gains', gives: 'bonus XP hits +1 harder' }],

  // ── Time ──────────────────────────────────────────────────────────────────
  'chrono-shard': [
    { watch: { on: 'set', test: 'corners' }, max: 5, mods: { clockSlowPct: 5 }, look: 'Set that uses two of the board\'s four corner cards', gives: 'the clock runs 5% slower' },
  ],
  'time-drop': [{ watch: { on: 'set', test: 'rainbow' }, chance: 50, max: 4, stat: { timeGainAmount: 0.5 }, look: 'Rainbow', gives: 'time gains add 0.5s more' }],

  // ── Tricks: the thing you hunt pays more each time you catch it ───────────
  magnet: [{ watch: { on: 'trick', kind: 'magnet' }, chance: 25, max: 3, mods: { magnetMarks: 1 }, look: 'Set through a marked card', gives: 'one more card is marked' }],
  'bounty-poster': trick('bounty', 'Set with a wanted card', 'wanted cards +0.15 each', { damage: 0.15 }, 12),
  'mirror-shard': trick('mirror', 'Mirror', 'Mirror +0.25', { damage: 0.25 }, 10),
  'odd-one-out': trick('odd', 'Odd One Out', 'Odd One Out +0.5', { damage: 0.5 }, 10),
  'devils-bargain': [{ watch: { on: 'hurt' }, max: 6, stat: { damage: 0.5 }, look: 'heart you lose', gives: '+0.5 per missing heart' }],
  snowball: [{ watch: { on: 'set' }, every: 5, max: 5, stat: { max: 1 }, look: 'Sets you make', gives: 'the Snowball can hold 1 more stack' }],
  'collectors-album': trick('album', 'Album you fill', 'Album +3', { damage: 3 }),
  'wild-card': trick('wild', 'wild card you match', '+2% wild chance', { chance: 2 }, 5),
  'twin-seed': trick('twin', 'twin you match', 'twins hit +0.5 harder', { damage: 0.5 }, 8),
  'glass-sword': [{ watch: { on: 'set' }, every: 4, max: 6, stat: { window: 0.5 }, look: 'Sets you make', gives: 'the Sword lasts 0.5s longer between Sets' }],
  'fog-lantern': trick('fog', 'fogged card you match', 'fog lifts at +0.5 more', { bonus: 0.5 }, 8),
  'cursed-idol': trick('curse', 'curse you outlast', '+1% curse chance', { chance: 1 }, 5),
  'chain-gang': trick('chain', 'chain you match together', 'Chain +0.5', { damage: 0.5 }, 6),
  'thorn-bush': trick('thorn', 'thorn card matched in time', 'Thorns +2', { damage: 2 }),
  rust: trick('rust', 'golden card you match', 'golden cards +0.5', { gold: 0.5 }, 8),
  'tar-pit': trick('tar', 'Set in the sticky row', 'Tar Pit +0.25', { damage: 0.25 }, 4),
  decoy: trick('decoy', 'decoy you catch', 'Decoy +3', { damage: 3 }),
  'long-fuse': trick('fuse', 'short fuse you match', 'short fuses +2', { damage: 2 }),
  'ice-block': trick('ice', 'thawed card you match', 'thawed cards +5', { damage: 5 }),
  'greedy-chest': trick('chest', 'chest you open', 'chests grow 0.5 faster', { growth: 0.5 }, 6),
  tightrope: trick('tightrope', 'Set touching your last one', 'Tightrope +0.25', { damage: 0.25 }, 4),
  'hot-potato': trick('potato', 'Hot Potato you match', 'Hot Potato +0.25', { damage: 0.25 }, 6),
};

/** Weapons that are left without growth on purpose, and why (the explainer says so). */
export const NO_GROWTH: Record<string, string> = {
  'blast-powder': 'Already the hardest hitter in the Armory. It does not grow in a fight.',
  'field-stone': 'A bigger board from the first second. It does not grow in a fight.',
  'growth-seed': 'Its own effect is the growth: every card it adds makes the whole board hit harder.',
  understudy: 'It grows with the weapon it copies.',
};

// ─── Stacks ─────────────────────────────────────────────────────────────────

/** One growth track of one held weapon. */
export interface GrowthTrack {
  stacks: number;
  /** Events counted toward the next stack (for `every`) */
  progress: number;
}
/** Keyed `${weaponId}#${index into WEAPON_GROWTH[weaponId]}` */
export type GrowthState = Readonly<Record<string, GrowthTrack>>;

export const growthKey = (weaponId: string, index: number) => `${weaponId}#${index}`;

/** What this weapon's stacks add to its own numbers right now. */
export const growthStatBonus = (growth: GrowthState, weaponId: string): Record<string, number> => {
  const out: Record<string, number> = {};
  (WEAPON_GROWTH[weaponId] ?? []).forEach((def, i) => {
    const stacks = growth[growthKey(weaponId, i)]?.stacks ?? 0;
    if (!stacks || !def.stat) return;
    for (const [k, add] of Object.entries(def.stat)) out[k] = (out[k] ?? 0) + add * stacks;
  });
  return out;
};

/** Standing modifiers from every stack held. */
export const growthModifiers = (growth: GrowthState): Modifiers => {
  const out: Record<string, number> = {};
  for (const [key, track] of Object.entries(growth)) {
    if (!track.stacks) continue;
    const [id, index] = key.split('#');
    const def = WEAPON_GROWTH[id]?.[Number(index)];
    for (const [k, add] of Object.entries(def?.mods ?? {})) out[k] = (out[k] ?? 0) + (add as number) * track.stacks;
  }
  return out as Modifiers;
};

/** Stacks a weapon holds across all its tracks (the number on its belt badge). */
export const growthStacks = (growth: GrowthState, weaponId: string): number =>
  (WEAPON_GROWTH[weaponId] ?? []).reduce((sum, _def, i) => sum + (growth[growthKey(weaponId, i)]?.stacks ?? 0), 0);

// ─── Wording ────────────────────────────────────────────────────────────────

const tidy = (n: number) => String(Math.round(n * 10) / 10);

/** "Every 3 Sets made at full hearts: overheal hits +3 harder (no limit)." */
export const growthText = (def: GrowthDef): string => {
  const count = def.every && def.every > 1 ? `Every ${def.every} ${def.look}` : `Every ${def.look}`;
  const chance = def.chance && def.chance < 100 ? ` has a ${def.chance}% chance to count` : '';
  const limit = def.max ? `up to ${def.max} times` : 'no limit';
  return chance ? `${count}${chance}: ${def.gives} (${limit}).` : `${count}: ${def.gives} (${limit}).`;
};
