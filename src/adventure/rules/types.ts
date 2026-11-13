/**
 * The rule vocabulary shared by fighter passives, skill-tree nodes, evolutions,
 * adventure weapons and Arcana. Content is written as data in these shapes; the
 * engine (rules/engine.ts) is the only thing that interprets them.
 *
 * A Rule is "when TRIGGER happens (and every CONDITION holds), do EFFECTS".
 * A Modifier is a standing change to how the fight works while it is active.
 */

/** Weapon effects the board can produce. Rules can listen for them or cause them. */
export type WeaponTriggerKind =
  | 'explosion' | 'laser' | 'fire' | 'ricochet' | 'echo'
  | 'heal' | 'coin' | 'time' | 'hint' | 'grace' | 'xp' | 'growth';

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
  /** No Set for this long (fires once per idle stretch) */
  | { on: 'idle'; ms: number }
  | { on: 'fightStart' }
  | { on: 'waveStart' }
  | { on: 'evolutionStart' }
  | { on: 'evolutionEnd' }
  | { on: 'trapDefused' }
  /** A Set included a power or gold card */
  | { on: 'bonusCardMatched' }
  /** A multi-hit card was broken */
  | { on: 'cardBroken' }
  /** Foe HP fell below this fraction of its max (fires once per foe) */
  | { on: 'foeBelow'; fraction: number }
  /** The player spent a hint (button or auto-hint) */
  | { on: 'hintUsed' }
  /** A grace turned a near-miss into a Set */
  | { on: 'graceUsed' }
  /** A burning card burned out */
  | { on: 'cardBurned' }
  /** A card was destroyed because it was linked to a destroyed card */
  | { on: 'linkDestroyed' }
  /** This evolution's 30 seconds ran out (only an evolution's own rules hear it) */
  | { on: 'finale' };

export type Condition =
  | { kind: 'chance'; pct: number }
  | { kind: 'heartsAtMost'; n: number }
  | { kind: 'heartsFull' }
  | { kind: 'comboAtLeast'; n: number }
  /** The Set being scored has exactly this many all-different attributes */
  | { kind: 'diffCount'; n: number }
  | { kind: 'rainbowSet' }
  | { kind: 'noMistakesThisFight' }
  | { kind: 'evolutionActive' }
  | { kind: 'timeSinceLastSetAtLeast'; ms: number }
  /** A Patience Set: Emperor Penguin's per-trait window (engine/passives.ts patienceMs) has passed since the last Set */
  | { kind: 'patient' }
  | { kind: 'timeSinceLastSetAtMost'; ms: number }
  | { kind: 'boardAtLeast'; n: number }
  /** The foe is below this fraction of its max HP */
  | { kind: 'foeHpBelow'; fraction: number };

/** What a scaling effect counts (damage `per` one of these). */
export type Scale =
  | 'boardCard' | 'missingHeart' | 'hint' | 'grace' | 'link' | 'combo'
  | 'bonusCard' | 'burning' | 'evolution' | 'heart';

/** Board shapes for area effects. Positions follow the 3-column grid. */
export type Area =
  | { shape: 'block'; cols: number; rows: number }
  | { shape: 'row' }
  | { shape: 'column' }
  | { shape: 'random'; count: number };

export type Effect =
  /** Hit the foe; with `per`, the amount is multiplied by that count (e.g. 1 per card on the board) */
  | { do: 'damage'; amount: number; per?: Scale }
  /** Spend every hint or grace you hold: `damageEach` per one spent */
  | { do: 'cashIn'; resource: 'hints' | 'graces'; damageEach: number }
  /** Turn random plain cards into power cards (+2 damage) or gold cards (+3 coins) */
  | { do: 'convert'; to: 'power' | 'gold'; count: number }
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
  | { do: 'xp'; amount: number }
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
  /** Add Combo steps (Sly Fox style; only meaningful with a combo passive) */
  | { do: 'comboStep'; amount: number }
  /** Put an Evolution Catalyst on the board now (if a recipe is armed) */
  | { do: 'spawnCatalyst' }
  /** Extend every active evolution */
  | { do: 'extendEvolutions'; ms: number }
  /** Next Set deals this many times damage */
  | { do: 'nextSetMultiplier'; times: number }
  /** Fire a weapon trigger of this kind as if a weapon had rolled it (heals 1, coins 1, etc.) */
  | { do: 'trigger'; kind: WeaponTriggerKind }
  /** Destroy random cards, 1 damage each (emits a ricochet trigger) */
  | { do: 'ricochet'; count: number }
  /** Link random pairs of board positions (a destroyed linked card takes its partner with it) */
  | { do: 'link'; count: number };

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
  rainbowMultiplierBonus?: number;
  /** Scales a weapon effect's chance to fire */
  weaponChanceScale?: Partial<Record<WeaponTriggerKind, number>>;
  /** Percentage points added to the Catalyst spawn chance on each refill */
  evolutionLikelihood?: number;
  /** Extra Catalyst spawn chance on refills caused by a Rainbow Strike */
  rainbowEvolutionLikelihood?: number;
  evolutionDurationMs?: number;
  extraEvolutionsPerFight?: number;
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
  /** Tuning for the fighter's own passives, keyed by tuning name (see data/passives.ts) */
  passiveTuning?: Record<string, number>;

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
  /** Encore Mask: damage when an evolution ends (its opening rules also fire again) */
  encoreDamage?: number;
}

/** Anything that can bring rules into a fight. */
export interface RuleSource {
  rules?: Rule[];
  modifiers?: Modifiers;
}
