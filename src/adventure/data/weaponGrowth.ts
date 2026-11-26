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
  /** Something a trick weapon pulled off (engine/gear.ts): a finished poster, a full Snowball, a big chest… */
  | { on: 'feat'; name: 'posterDone' | 'doubleMirror' | 'fullSnowball' | 'albumDone' | 'lastHeart' }
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
  /**
   * A stack makes something MORE LIKELY: each stack adds `pct`% chance that,
   * whenever `on` happens, `effect` happens too.
   */
  proc?: { on: GrowthWatch; pct: number; effect: Effect };
  /** What to look for, as "Every …" (the count and chance are written in front of it) */
  look: string;
  /** What a stack gives, in a few words */
  gives: string;
}

const trickOn = (kind: TrickKind): GrowthWatch => ({ on: 'trick', kind });
const weaponOn = (kind: WeaponTriggerKind): GrowthWatch => ({ on: 'weapon', kind });

export const WEAPON_GROWTH: Record<string, GrowthDef[]> = {
  // ── Hearts ────────────────────────────────────────────────────────────────
  'mending-charm': [
    { watch: { on: 'set', test: 'fullHearts' }, every: 4, max: 5, stat: { healingChance: 1 }, now: { do: 'shield', count: 1 }, look: 'Sets made at full hearts', gives: '+1% heal chance and 1 Over-Shield' },
  ],
  'life-vessel': [
    { watch: { on: 'set', test: 'fullHearts' }, every: 4, max: 3, now: { do: 'emptyHeart', amount: 1 }, look: 'Sets made at full hearts', gives: '+1 max heart (it arrives empty)' },
  ],
  // Souls stretch the vessel: healing makes room for more healing
  'soul-harvest': [{ watch: { on: 'healed' }, every: 3, max: 3, now: { do: 'emptyHeart', amount: 1 }, look: 'times you heal', gives: '+1 max heart (it arrives empty)' }],
  // Hearts feed blasts, and now blasts feed hearts
  'life-link': [
    { watch: weaponOn('explosion'), max: 6, proc: { on: weaponOn('explosion'), pct: 5, effect: { do: 'heal', amount: 1 } }, look: 'blast', gives: '+5% chance that a blast heals a heart' },
  ],

  // ── Damage: these already hit hard, so they grow sideways ─────────────────
  'blast-powder': [
    { watch: weaponOn('explosion'), every: 3, max: 4, stat: { explosionDamage: 0.25 }, look: 'explosions', gives: 'blasted cards deal +0.25 more damage' },
  ],
  'rainbow-charm': [
    { watch: { on: 'set', test: 'rainbow' }, every: 2, max: 1, stat: { mult: 0.25 }, look: 'Rainbow Sets', gives: '+0.25× Rainbow multiplier' },
  ],
  'flint-spark': [
    {
      watch: { on: 'cardBurned' },
      every: 4,
      max: 4,
      stat: { burnDamage: 0.2 },
      proc: { on: weaponOn('fire'), pct: 5, effect: { do: 'ignite', count: 1 } },
      look: 'cards burned up',
      gives: 'burns deal +0.2 more and +5% chance a new fire catches an extra card',
    },
  ],
  'prismatic-ray': [
    { watch: weaponOn('laser'), max: 12, mods: { laserSetChance: 3 }, look: 'laser', gives: '+3% chance the cards that replace a laser hold a Set among themselves' },
  ],
  'chaos-shard': [
    {
      watch: weaponOn('ricochet'),
      every: 3,
      max: 6,
      stat: { ricochetChance: 3, ricochetDamage: 0.25 },
      mods: { ricochetHealChance: 3 },
      look: 'ricochets',
      gives: '+3% ricochet chance, +0.25 ricochet damage, and +3% chance a ricochet heals a heart',
    },
  ],
  'echo-stone': [
    { watch: weaponOn('echo'), every: 2, max: 5, stat: { echoChance: 2, strike: 1 }, look: 'echoes', gives: '+2% echo chance and echoes hit +1 harder' },
  ],
  // The reaction jumps the gap
  'chain-reaction': [
    { watch: weaponOn('echo'), max: 6, proc: { on: weaponOn('echo'), pct: 8, effect: { do: 'ricochet', count: 2 } }, look: 'echo', gives: '+8% chance that an echo also ricochets into 2 cards' },
  ],
  // Its echoes start fires; now its fires bring echoes, and the loop closes
  'cascade-core': [{ watch: { on: 'cardBurned' }, every: 3, max: 8, stat: { echoChance: 1 }, look: 'cards burned up', gives: '+1% echo chance' }],
  'temporal-rift': [
    { watch: weaponOn('time'), max: 5, proc: { on: weaponOn('time'), pct: 10, effect: { do: 'freeze', ms: 1500 } }, look: 'time gain', gives: '+10% chance that a time gain also freezes the clock for 1.5s' },
  ],

  // ── Links ─────────────────────────────────────────────────────────────────
  connector: [
    { watch: { on: 'linkDestroyed' }, max: 10, stat: { connectionChance: 2 }, mods: { keepLinks: 1 }, look: 'card destroyed through a link', gives: '+2% link chance, and your links stay on the board between waves' },
  ],
  'web-weaver': [{ watch: { on: 'linkDestroyed' }, chance: 10, max: 4, now: { do: 'link', count: 1 }, look: 'card destroyed through a link', gives: 'a new link is woven' }],
  // It learns from every connection that fires
  'neural-network': [
    { watch: { on: 'linkDestroyed' }, max: 8, proc: { on: { on: 'linkDestroyed' }, pct: 6, effect: { do: 'xp', amount: 1 } }, look: 'card destroyed through a link', gives: '+6% chance that a linked card gives 1 XP as it goes' },
  ],
  'echo-chamber': [
    { watch: { on: 'linkDestroyed' }, every: 4, max: 6, proc: { on: { on: 'linkDestroyed' }, pct: 3, effect: { do: 'trigger', kind: 'echo' } }, look: 'cards destroyed through a link', gives: '+3% chance that a linked card echoes as it goes (a Set is matched for you)' },
  ],
  'revenge-linker': [
    { watch: { on: 'linkDestroyed' }, every: 4, max: 4, stat: { strike: 0.5, chance: 2 }, look: 'cards destroyed through a link', gives: 'Tripwire and Revenge hit +0.5 harder and link 2% more often' },
    { watch: { on: 'hurt' }, max: 2, stat: { strike: 1.5, chance: 4 }, look: 'heart you lose', gives: 'Revenge strikes +1.5 harder and links 4% more often' },
  ],

  // ── Board ─────────────────────────────────────────────────────────────────
  // Field Stone and Growth Seed: nothing. They are the board's own snowball.
  'war-drum': [{ watch: { on: 'own' }, every: 4, max: 2, stat: { power: 1 }, look: 'times the Drum sounds', gives: 'the Drum gives every card +1 more' }],
  'clarity-lens': [
    { watch: { on: 'own' }, max: 10, mods: { doubleClarityChance: 5 }, look: 'Clarity', gives: '+5% chance a Clarity simplifies two traits at once' },
  ],
  'rally-horn': [{ watch: { on: 'own' }, stat: { damage: 1 }, look: 'Rally', gives: 'Rally hits +1 harder' }],
  pinata: [{ watch: { on: 'cardBroken' }, max: 8, stat: { bounty: 2 }, look: 'piñata you break', gives: 'later piñatas hold +2' }],
  'amplifier-coil': [
    { watch: { on: 'doubled' }, max: 6, stat: { chance: 2, shock: 1 }, look: 'trigger it doubles', gives: '+2% amplify chance and the shock hits +1 harder' },
  ],
  'catalyst-prism': [
    { watch: { on: 'catalyst' }, max: 3, mods: { evolutionDurationMs: 6000 }, look: 'Catalyst you match', gives: 'evolutions last 6s longer, starting with this one' },
  ],
  // The crowd wants more (caps cleanly within Adventure's 3-evolution limit)
  'encore-mask': [
    { watch: { on: 'evolutionEnd' }, max: 2, proc: { on: { on: 'evolutionEnd' }, pct: 40, effect: { do: 'spawnCatalyst' } }, look: 'evolution that ends', gives: '+40% chance that an ending evolution leaves a new Catalyst on the board' },
  ],

  // ── Graces ────────────────────────────────────────────────────────────────
  'second-chance': [{ watch: { on: 'set' }, max: 30, mods: { luckPct: 2 }, look: 'Set you make', gives: '+2% luck: every weapon chance you hold goes up' }],
  'fortune-token': [
    { watch: weaponOn('grace'), every: 3, max: 6, now: { do: 'growBoard', count: 1 }, look: 'graces gained (the ones you start with count)', gives: '+1 card on the board, for good' },
  ],
  // Graces fuel more explosions
  'chaos-conduit': [
    { watch: weaponOn('grace'), max: 5, stat: { explosionChance: 2 }, look: 'grace you gain', gives: '+2% blast chance' },
  ],
  // Spent graces start coming back
  'grace-conduit': [
    { watch: { on: 'graceUsed' }, max: 4, proc: { on: { on: 'graceUsed' }, pct: 15, effect: { do: 'grace', amount: 1 } }, look: 'grace that saves you', gives: '+15% chance that a spent grace comes straight back' },
  ],

  // ── Hints ─────────────────────────────────────────────────────────────────
  'seeker-lens': [{ watch: { on: 'set', test: 'hinted' }, max: 20, stat: { hintGainChance: 1 }, look: 'Set made on a hint', gives: '+1% hint chance' }],
  // Using hints makes room for more of them (and a hoard is what Seeker Lens pays for)
  'crystal-orb': [{ watch: { on: 'hintUsed' }, every: 3, max: 3, stat: { maxHints: 1 }, now: { do: 'hint', amount: 1 }, look: 'hints you use', gives: '+1 hint slot, and a hint to put in it' }],
  'oracle-eye': [
    { watch: { on: 'set', test: 'hinted' }, max: 6, stat: { refund: 0.25 }, look: 'Set made on a pointed-out card', gives: 'hinted Sets refund +0.25s more on the clock' },
  ],
  'mystic-sight': [{ watch: { on: 'set', test: 'hinted' }, max: 6, stat: { snipe: 1.5 }, look: 'hinted Set', gives: 'Third Eye snipes hit +1.5 harder' }],
  // Hints gild the board and build coin momentum
  'fortunes-blessing': [
    {
      watch: weaponOn('hint'),
      max: 6,
      stat: { coinGainChance: 2 },
      proc: { on: weaponOn('hint'), pct: 10, effect: { do: 'convert', to: 'gold', count: 1 } },
      look: 'hint you gain',
      gives: '+2% bonus coin chance and +10% chance a gained hint gilds a card',
    },
  ],

  // ── Coins & XP ────────────────────────────────────────────────────────────
  // The golden touch: money turns the board into power
  'fortunes-favor': [
    { watch: weaponOn('coin'), every: 3, max: 8, proc: { on: { on: 'set' }, pct: 3, effect: { do: 'convert', to: 'power', count: 1 } }, look: 'bonus coins', gives: '+3% chance that a Set turns a card into a power card' },
  ],
  // Study pays: XP brings more XP, so level-ups come faster as the fight goes on
  'scholars-tome': [{ watch: weaponOn('xp'), every: 3, max: 6, stat: { xpGainChance: 1 }, now: { do: 'xp', amount: 2 }, look: 'bonus XP gains', gives: '+2 XP at once and +1% XP chance' }],
  // Coins teach and dividends compound
  'wisdom-chain': [{ watch: weaponOn('coin'), max: 6, stat: { xpGainChance: 2 }, mods: { coinPercent: 3 }, look: 'bonus coin', gives: '+2% bonus XP chance and +3% more coins' }],

  // ── Time ──────────────────────────────────────────────────────────────────
  'chrono-shard': [
    { watch: { on: 'set' }, every: 3, max: 5, mods: { clockSlowPct: 5 }, look: 'Sets you make', gives: 'the clock runs 5% slower' },
  ],
  'time-drop': [{ watch: { on: 'set', test: 'rainbow' }, max: 4, stat: { timeGainAmount: 0.5 }, look: 'Rainbow', gives: 'time gains add 0.5s more' }],

  // ── Tricks: each one changes its own game ─────────────────────────────────
  magnet: [{ watch: trickOn('magnet'), chance: 25, max: 3, mods: { magnetMarks: 1 }, look: 'Set through a marked card', gives: 'one more card is marked' }],
  // Bigger posters, bigger rewards
  'bounty-poster': [{ watch: { on: 'feat', name: 'posterDone' }, max: 3, stat: { damage: 0.5 }, mods: { bountyCards: 1 }, look: 'poster you finish', gives: 'the next poster wants 1 more card and pays +0.5 more for each' }],
  // A hall of mirrors: it remembers further back
  'mirror-shard': [{ watch: { on: 'feat', name: 'doubleMirror' }, max: 2, stat: { damage: 1 }, mods: { mirrorDepth: 1 }, look: 'Set that reuses two spots of your last Set', gives: 'the Mirror remembers one Set further back and pays +1' }],
  // The odd one sets up the next trick
  'odd-one-out': [
    { watch: trickOn('odd'), max: 10, proc: { on: { on: 'set' }, pct: 4, effect: { do: 'doubleNext' } }, look: 'Odd One Out', gives: '+4% chance that a Set makes your next weapon trigger fire twice' },
  ],
  // He looks after his investment
  'devils-bargain': [{ watch: { on: 'feat', name: 'lastHeart' }, max: 4, stat: { damage: 0.75 }, now: { do: 'shield', count: 1 }, look: 'time you fall to your last heart', gives: '+0.75 per missing heart, and your next mistake costs nothing' }],
  // Roll it all the way up and it gets bigger
  snowball: [{ watch: { on: 'feat', name: 'fullSnowball' }, max: 2, stat: { max: 1 }, look: 'time the Snowball reaches its limit', gives: 'its limit rises by 1' }],
  // A sticker shower
  'collectors-album': [{ watch: { on: 'feat', name: 'albumDone' }, stat: { damage: 3 }, now: { do: 'empowerBoard', amount: 1 }, look: 'Album you complete', gives: 'every card on the board gains +1 and the next Album pays +3' }],
  'wild-card': [{ watch: trickOn('wild'), every: 5, max: 1, mods: { wildMax: 1 }, look: 'wild cards you match', gives: 'a second wild card can be on the board at once' }],
  // The seed sprouts
  'twin-seed': [
    { watch: trickOn('twin'), max: 8, proc: { on: trickOn('twin'), pct: 5, effect: { do: 'growBoard', count: 1 } }, look: 'twin you match', gives: '+5% chance that a matched twin leaves a new card on the board' },
  ],
  // Reforged
  'glass-sword': [{ watch: { on: 'set' }, every: 6, max: 2, mods: { glassSpares: 1 }, look: 'Sets you make', gives: 'the Sword can survive one more shatter' }],
  // The lantern shows the way
  'fog-lantern': [
    { watch: trickOn('fog'), max: 6, proc: { on: trickOn('fog'), pct: 8, effect: { do: 'hint', amount: 1 } }, look: 'fog that lifts', gives: '+8% chance that a lifting fog hands you a hint' },
  ],
  'cursed-idol': [{ watch: trickOn('curse'), max: 2, mods: { curseMultiplierBonus: 0.25 }, look: '×2 card you match', gives: 'later ones multiply by 0.25 more (up to ×2.5)' }],
  // Broken chains stay on the floor
  'chain-gang': [
    { watch: trickOn('chain'), max: 4, proc: { on: trickOn('chain'), pct: 10, effect: { do: 'link', count: 1 } }, look: 'chain you match together', gives: '+10% chance that a matched chain leaves a link on the board' },
  ],
  // Roses among the thorns
  'thorn-bush': [
    { watch: trickOn('thorn'), max: 6, proc: { on: trickOn('thorn'), pct: 10, effect: { do: 'heal', amount: 1 } }, look: 'thorn card matched in time', gives: '+10% chance that a thorn you match heals a heart' },
  ],
  rust: [{ watch: trickOn('rust'), max: 2, mods: { rustSetsLess: 1 }, look: 'golden card you match', gives: 'cards turn golden 1 Set sooner' }],
  // The pit spreads
  'tar-pit': [{ watch: trickOn('tar'), every: 6, max: 2, mods: { tarRows: 1 }, look: 'Sets in the tar', gives: 'the pit spreads to one more row' }],
  // See through one trick and you are forgiven the next
  decoy: [{ watch: trickOn('decoy'), max: 5, stat: { chance: 3, damage: 3 }, now: { do: 'grace', amount: 1 }, look: 'decoy you catch', gives: 'gain a grace, and decoys turn up 3% more often and pay +3' }],
  'long-fuse': [{ watch: trickOn('fuse'), max: 4, mods: { fuseHotMs: 1000 }, look: 'short fuse you match', gives: 'the short-fuse window is 1s longer' }],
  // The cold spreads to the clock
  'ice-block': [{ watch: trickOn('ice'), max: 2, mods: { iceSetsLess: 1 }, now: { do: 'freeze', ms: 2000 }, look: 'thawed card you match', gives: 'the clock freezes for 2s and the next block thaws 1 Set sooner' }],
  // Greed pays
  'greedy-chest': [{ watch: trickOn('chest'), max: 3, stat: { start: 1 }, look: 'chest you open', gives: 'its floor rises by 1, so new chests hold more and a mistake never drops it lower' }],
  // Tighter footing on the rope
  tightrope: [{ watch: trickOn('tightrope'), every: 4, max: 4, stat: { damage: 1 }, mods: { offRopeBonus: 0.05 }, look: 'Sets on the rope', gives: 'Rope Sets pay +1 more and stepping off costs 5% less' }],
  // Hotter and jumpier
  'hot-potato': [{ watch: trickOn('potato'), max: 4, stat: { damage: 0.5 }, mods: { potatoFasterMs: 1500 }, look: 'Hot Potato you match', gives: 'the next is worth +0.5 and jumps 1.5s sooner' }],
};

/** Weapons that are left without growth on purpose, and why (the explainer says so). */
export const NO_GROWTH: Record<string, string> = {
  'field-stone': 'A bigger board from the first second: its own numbers stay as they are.',
  'growth-seed': 'Its own effect is the growth: every card it adds makes the whole board hit harder.',
  understudy: 'Copies your left charm at the higher of both levels, and shares its standing board modifiers.',
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

/** "Every 3 Sets made at full hearts: overheal hits +3 harder (no limit)." */
export const growthText = (def: GrowthDef): string => {
  const count = def.every && def.every > 1 ? `Every ${def.every} ${def.look}` : `Every ${def.look}`;
  const chance = def.chance && def.chance < 100 ? ` has a ${def.chance}% chance to count` : '';
  const limit = def.max ? `up to ${def.max} times` : 'no limit';
  return chance ? `${count}${chance}: ${def.gives} (${limit}).` : `${count}: ${def.gives} (${limit}).`;
};
