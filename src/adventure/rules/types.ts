/**
 * The rule vocabulary shared by fighter passives, skill-tree nodes, per-weapon
 * timed evolutions, Synergy Graph cross-edges, adventure weapons and Arcana.
 * Content is written as data in these shapes; the engine (rules/engine.ts) is
 * the only thing that interprets them.
 *
 * A Rule is "when TRIGGER happens (and every CONDITION holds), do EFFECTS".
 * A Modifier is a standing change to how the fight works while it is active.
 */

/** 15 first-class Synergy Graph scaling attributes (locked across combat, content, UI, and bounties). */
export type SynergyAttrId =
  | 'field_size'
  | 'destruction'
  | 'marks'
  | 'coins'
  | 'burn'
  | 'links'
  | 'holo'
  | 'graces'
  | 'hints'
  | 'vitality'
  | 'streaks'
  | 'hazards'
  | 'parries'
  | 'prism'
  | 'echoes';

/** Weapon effects the board can produce. Rules can listen for them or cause them. */
export type WeaponTriggerKind =
  | 'explosion' | 'laser' | 'fire' | 'ricochet' | 'echo'
  | 'heal' | 'coin' | 'time' | 'hint' | 'grace' | 'xp' | 'growth';

/** Payouts of the trick weapons (engine/gear.ts) that rules can react to. */
export type TrickKind =
  | 'magnet' | 'bounty' | 'mirror' | 'odd' | 'album' | 'twin' | 'fog' | 'curse' | 'chain' | 'thorn' | 'rust'
  | 'tar' | 'decoy' | 'fuse' | 'ice' | 'chest' | 'tightrope' | 'potato' | 'wild';

export type Trigger =
  /** A Set was scored (after damage is dealt) */
  | { on: 'set' }
  /** The first Set of each wave */
  | { on: 'firstSetOfWave' }
  /** Every Nth Set this fight (counted from the start of the fight) */
  | { on: 'everyNthSet'; n: number }
  /** N Sets inside a sliding window of `withinMs` (fires once, then the window restarts) */
  | { on: 'setsWithin'; count: number; withinMs: number }
  | { on: 'rainbow' }
  | { on: 'mistake' }
  /** The player regained hearts */
  | { on: 'healed' }
  /** The player lost hearts */
  | { on: 'hurt' }
  /** A weapon effect fired (from a weapon, a rule, or an evolution) */
  | { on: 'weapon'; kind: WeaponTriggerKind }
  /** A trick weapon paid out (the marked card matched, the chest opened…) */
  | { on: 'trick'; kind: TrickKind }
  /** No Set for this long (fires once per idle stretch) */
  | { on: 'idle'; ms: number }
  | { on: 'fightStart' }
  | { on: 'waveStart' }
  /** Any weapon evolution ignited */
  | { on: 'evolutionStart' }
  /** Any weapon evolution expired */
  | { on: 'evolutionEnd' }
  /** Specific (or any) weapon evolution ignited */
  | { on: 'weaponEvolutionStart'; weaponId?: string }
  /** Specific (or any) weapon evolution expired */
  | { on: 'weaponEvolutionEnd'; weaponId?: string }
  | { on: 'trapDefused' }
  /** A Set included a power, gold, or holo card */
  | { on: 'bonusCardMatched' }
  /** A Set included at least one Holo card */
  | { on: 'holoMatched' }
  /** A Set included at least one marked card (generic mark or magnet/bounty/chain/etc.) */
  | { on: 'markedMatched' }
  /** A Parry (or specifically a Perfect Parry when `perfect: true`) landed */
  | { on: 'parry'; perfect?: boolean }
  /** A multi-hit card was broken */
  | { on: 'cardBroken' }
  /** Foe HP fell below this fraction of its max (fires once per foe) */
  | { on: 'foeBelow'; fraction: number }
  /** The player spent a hint (button or auto-hint) */
  | { on: 'hintUsed' }
  /** A grace turned a near-miss into a Set or saved a heart */
  | { on: 'graceUsed' }
  /** A burning card burned out */
  | { on: 'cardBurned' }
  /** A card was destroyed because it was linked to a destroyed card */
  | { on: 'linkDestroyed' }
  /** This evolution's timed window ran out (only an evolution's own rules hear it) */
  | { on: 'finale' }
  /** Badger landed a valid Set while holding 1+ Grudges (detonating stored Grudges) */
  | { on: 'grudgeRelease' };

export type Condition =
  | { kind: 'chance'; pct: number }
  | { kind: 'heartsAtMost'; n: number }
  | { kind: 'heartsFull' }
  | { kind: 'comboAtLeast'; n: number }
  /** Badger released at least `n` stored Grudges on this Set */
  | { kind: 'grudgeAtLeast'; n: number }
  /** First mistake since the last valid Set (caps repeatable mistake-reward farming) */
  | { kind: 'firstMistakeSinceSet' }
  /** Clock & foe are currently frozen (Deep Freeze / Freeze) */
  | { kind: 'frozen' }
  /** The Set being scored has exactly this many all-different attributes */
  | { kind: 'diffCount'; n: number }
  /** The Set being scored has at most this many all-different attributes */
  | { kind: 'diffCountAtMost'; n: number }
  /** The Set being scored has at least this many all-different attributes */
  | { kind: 'diffCountAtLeast'; n: number }
  | { kind: 'rainbowSet' }
  /** The Set being scored used a pointed-out card (hint, auto-hint or Keen Eye) */
  | { kind: 'hintedSet' }
  | { kind: 'noMistakesThisFight' }
  | { kind: 'evolutionActive' }
  | { kind: 'activeEvosAtLeast'; n: number }
  | { kind: 'weaponEvolved'; weaponId?: string }
  | { kind: 'synergyAtLeast'; attr: SynergyAttrId; n: number }
  | { kind: 'holoInSet'; min?: number }
  | { kind: 'timeSinceLastSetAtLeast'; ms: number }
  /** A Patience Set: Emperor Penguin's per-trait window (engine/passives.ts patienceMs) has passed since the last Set */
  | { kind: 'patient' }
  | { kind: 'timeSinceLastSetAtMost'; ms: number }
  | { kind: 'boardAtLeast'; n: number }
  /** The foe is below this fraction of its max HP */
  | { kind: 'foeHpBelow'; fraction: number };

/** What a scaling effect counts (damage `per` one of these). Supports all 15 Synergy attributes plus direct live counters. */
export type Scale =
  | SynergyAttrId
  | 'activeEvos'
  | 'boardCard' | 'missingHeart' | 'hint' | 'grace' | 'link' | 'combo'
  | 'bonusCard' | 'burning' | 'evolution' | 'heart' | 'grudgeReleased';

/** Board shapes for area effects. Positions follow the 3-column grid. */
export type Area =
  | { shape: 'block'; cols: number; rows: number }
  | { shape: 'row' }
  | { shape: 'column' }
  | { shape: 'random'; count: number };

export type Effect =
  /** Hit the foe; with `per`, the amount is multiplied by that count (e.g. 1 per Synergy stack) */
  | { do: 'damage'; amount: number; per?: Scale }
  /** Spend every hint or grace you hold: `damageEach` per one spent */
  | { do: 'cashIn'; resource: 'hints' | 'graces'; damageEach: number }
  /** Turn random plain cards into Power (+5 dmg), Gold (+3¢), or Holo (+4 dmg & ×1.2) cards */
  | { do: 'convert'; to: 'power' | 'gold' | 'holo'; count: number }
  /** Place generic Synergy marks on `count` selectable board cards (feeds `marks`) */
  | { do: 'markCard'; count: number }
  /** Advance equipped weapons' timed evolution progress by `amount` ticks */
  | { do: 'chargeEvolution'; target: 'all' | 'other' | 'self'; amount: number }
  /** Permanently add `amount` flat base damage to every Set for the rest of the fight */
  | { do: 'addFightBaseDamage'; amount: number }
  /** The next `count` mistakes cost no heart */
  | { do: 'shield'; count: number }
  /** Defuse every trap and turn every face-down card up */
  | { do: 'cleanse' }
  /** Destroy cards (they pay their normal collateral reward) */
  | { do: 'explode'; area: Area }
  | { do: 'laser'; area: Area }
  | { do: 'ignite'; count: number }
  | { do: 'heal'; amount: number }
  | { do: 'coins'; amount: number }
  | { do: 'time'; seconds: number }
  | { do: 'hint'; amount: number }
  | { do: 'grace'; amount: number }
  | { do: 'xp'; amount: number; per?: Scale }
  /** Add cards to the board (capped at the max board size) */
  | { do: 'growBoard'; count: number }
  /** Every card now on the board gains this much power (+damage when matched) */
  | { do: 'empowerBoard'; amount: number }
  /** A random card gains extra hits; breaking it deals `bounty` bonus damage */
  | { do: 'armorCard'; extraHealth: number; bounty: number }
  /** One active attribute becomes the same on every card for a while (the board gets easier) */
  | { do: 'simplify'; ms: number }
  /** The next weapon trigger happens twice */
  | { do: 'doubleNext' }
  /** Stop the clock and the foe's timers */
  | { do: 'freeze'; ms: number }
  /** Re-deal every card that isn't armored; the foe's draw effects don't apply */
  | { do: 'redeal' }
  /** Match a Set for the player */
  | { do: 'autoSet' }
  /** Add Combo steps (Sly Fox style; grants +1 base Set dmg per step for all fighters) */
  | { do: 'comboStep'; amount: number }
  /** Extend active weapon evolutions by `ms` (`target: 'self'` extends only the owning weapon's evolution) */
  | { do: 'extendEvolutions'; ms: number; target?: 'all' | 'self' }
  /** Next Set deals this many times damage (stacks additively, capped at BASE_RULES.maxNextSetMultiplier) */
  | { do: 'nextSetMultiplier'; times: number }
  /** Fire a weapon trigger of this kind as if a weapon had rolled it (heals 1, coins 1, etc.) */
  | { do: 'trigger'; kind: WeaponTriggerKind }
  /** Destroy random cards, collateral damage each (emits a ricochet trigger) */
  | { do: 'ricochet'; count: number }
  /** Link random pairs of board positions (a destroyed linked card takes its partner with it) */
  | { do: 'link'; count: number }
  /** Raise max hearts; the new hearts arrive empty */
  | { do: 'emptyHeart'; amount: number }
  // ── Trick-state mutation verbs ──
  /** Repair a shattered Glass Sword and reset its timer */
  | { do: 'repairGlass' }
  /** Add `amount` directly to Greedy Chest's stored payout (or queue for the next chest) */
  | { do: 'feedChest'; amount: number }
  /** Fast-forward beneficial trick timers (Ice thaw, Rust aging, Fog lift, Curse→reward, Fuse→hot) without penalizing lethal timers */
  | { do: 'advanceTricks'; ms: number }
  /** Fill 1 random unfilled Collector's Album page (triggering page bonus or Album completion) */
  | { do: 'stampAlbum' }
  /** Place `count` extra Magnet marks on selectable board cards */
  | { do: 'addMagnet'; count: number };

export interface Rule {
  trigger: Trigger;
  when?: Condition[];
  effects: Effect[];
  /** Shown as a floater when it fires (keep it 1-3 words) */
  callout?: string;
}

/**
 * Standing changes while the source is active. Values add up across sources,
 * except `*Scale` values, which multiply.
 */
export interface Modifiers {
  /** Flat damage on every Set */
  setDamage?: number;
  /** Extra flat damage on Sets meeting a condition */
  conditionalDamage?: { when: Condition[]; amount: number }[];
  /** Extra multiplier on Sets meeting a condition (e.g. Corgi Stampede ×1.25 at 18+ board) */
  conditionalMultiplier?: { when: Condition[]; multiplier: number }[];
  rainbowMultiplierBonus?: number;
  /** Scales a weapon effect's chance to fire */
  weaponChanceScale?: Partial<Record<WeaponTriggerKind, number>>;
  /** Extra % chance that a dealt card arrives as a Holo card (+4 base & ×1.2 mult) */
  holoChance?: number;
  /** Extra duration (ms) added to weapon evolutions when they ignite */
  evolutionDurationMs?: number;
  /** Extra progress ticks added whenever any equipped weapon advances its evolution condition */
  evolutionChargeBonus?: number;
  /** Extra additive multiplier per active weapon evolution (on top of EVOLUTION_CHASSIS.setAdditiveMult) */
  evoAdditiveMultBonus?: number;
  maxHearts?: number;
  startingHints?: number;
  startingGraces?: number;
  startingSeconds?: number;
  coinPercent?: number;
  pickOptions?: number;
  /** Mistakes cost no heart while this many remain (per fight) */
  freeMistakes?: number;
  /** Traps: matching the trapped card itself does no harm */
  trapImmunity?: boolean;
  /** Tightrope: remove off-rope penalty while active */
  noOffRopePenalty?: boolean;
  /** Glass Sword: cannot shatter while active */
  unbreakableGlass?: boolean;
  /** Extra flat damage added to every burning card that burns out */
  burnBonusDamage?: number;
  /** Multiplier applied to burn damage */
  burnDamageScale?: number;
  /** Tuning for the fighter's own passives, keyed by tuning name (see data/passives.ts) */
  passiveTuning?: Record<string, number>;

  // ── Reached through weapon growth (data/weaponGrowth.ts) ──
  /** The fight clock runs this % slower (capped at CLOCK_SLOW_CAP) */
  clockSlowPct?: number;
  /** Every weapon chance, and every rule's chance roll, is this % more likely */
  luckPct?: number;
  /** Set damage per hint held */
  hintHeldDamage?: number;
  /** Damage for a Set made on a hint (a pointed-out card) */
  hintedSetDamage?: number;
  /** % chance a simplify unifies a second trait as well */
  doubleClarityChance?: number;
  /** % chance the cards that replace a laser's cards hold a Set among themselves */
  laserSetChance?: number;
  /** % chance a ricochet heals a heart */
  ricochetHealChance?: number;
  /** Magnet: extra marked cards on the board */
  magnetMarks?: number;
  /** Above zero: links stay on the board when a new wave starts */
  keepLinks?: number;
  /** Bounty Poster: extra wanted cards on each poster */
  bountyCards?: number;
  /** Mirror Shard: how many Sets further back the mirror remembers */
  mirrorDepth?: number;
  /** Hot Potato: it jumps this many ms sooner */
  potatoFasterMs?: number;
  /** Ice Block: it thaws this many Sets sooner */
  iceSetsLess?: number;
  /** Cursed Idol: added to what a lifted-curse card multiplies by */
  curseMultiplierBonus?: number;
  /** Cursed Idol: flat base damage added when matching a lifted-curse card */
  curseFlatDamage?: number;
  /** Rust: cards turn golden this many Sets sooner */
  rustSetsLess?: number;
  /** Tar Pit: extra sticky rows */
  tarRows?: number;
  /** Long Fuse: the short-fuse window is this many ms longer */
  fuseHotMs?: number;
  /** Tightrope: added to what a Set off the rope is multiplied by */
  offRopeBonus?: number;
  /** Glass Sword: shatters it can survive this fight */
  glassSpares?: number;
  /** Wild Card: extra wild cards allowed on the board at once */
  wildMax?: number;

  // ── Trick weapons (engine/gear.ts): a trick is on while its number is above zero ──
  /** Magnet: damage for a Set that includes the marked card */
  magnetDamage?: number;
  /** Bounty Poster: damage per matched card with the wanted value */
  bountyDamage?: number;
  /** Mirror Shard: damage for a Set that reuses a slot of the previous Set */
  mirrorDamage?: number;
  /** Odd One Out: damage for a Set with exactly one trait different (or, at 4+ traits, exactly one the same) */
  oddOneOutDamage?: number;
  /** Devil's Bargain: Set damage per missing heart (the heart it took counts) */
  missingHeartDamage?: number;
  /** Snowball: Set damage per stack, and how many stacks a wave can hold */
  snowballStep?: number;
  snowballMax?: number;
  /** Collector's Album: damage for the Set that fills the last page */
  albumDamage?: number;
  /** Glass Sword: Set damage while intact, and how long it survives without a Set */
  glassDamage?: number;
  glassWindowMs?: number;
  /** Wild Card: % chance a dealt card is wild (one on the board at a time) */
  wildChance?: number;
  /** Twin Seed: % chance a dealt card copies a card on the board, and the damage when a twin is destroyed */
  twinChance?: number;
  twinDamage?: number;
  /** Fog Lantern: % chance a dealt card starts face-down, and the damage it gains when it flips */
  fogChance?: number;
  fogBonus?: number;
  /** Fog Lantern: if > 0, lifted fog cards also arrive Holo */
  fogHolo?: number;
  /** Encore Mask: damage when an evolution ends (its opening rules also fire again) */
  encoreDamage?: number;
  /** Encore Mask: head-start charge ticks granted when an evolution finishes cooldown */
  encoreHeadStart?: number;
  /** Cursed Idol: % chance a dealt card is cursed (unmatchable for a while; then lifted bonus or curse spreads) */
  curseChance?: number;
  /** Chain Gang: damage for matching both chained cards in one Set */
  chainDamage?: number;
  /** Thorn Bush: % chance a dealt card has thorns, and the damage for matching one in time */
  thornChance?: number;
  thornDamage?: number;
  /** Rust: cards lose 1 damage per Set they sit through; a card that turns golden is worth this much */
  rustGold?: number;
  /** Tar Pit: damage for a Set that touches the sticky row */
  tarDamage?: number;
  /** Decoy: % chance a dealt card nearly copies a board card, and the damage for matching the two together */
  decoyChance?: number;
  decoyDamage?: number;
  /** Long Fuse: % chance a dealt card carries a fuse, and the damage for matching it in its last seconds */
  fuseChance?: number;
  fuseDamage?: number;
  /** Ice Block: what the thawed card is worth */
  frozenDamage?: number;
  /** Greedy Chest: the floor a new chest starts at (before opened chests raise it) and how much it grows per Set that leaves it alone */
  chestStart?: number;
  chestGrowth?: number;
  /** Tightrope: damage for a Set that touches your last one (others suffer off-rope multiplier) */
  tightropeDamage?: number;
  /** Hot Potato: damage for matching the hot card (mistakes cost an extra heart while it is out) */
  potatoDamage?: number;
}

/** Anything that can bring rules into a fight. */
export interface RuleSource {
  rules?: Rule[];
  modifiers?: Modifiers;
}
