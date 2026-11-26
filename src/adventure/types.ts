/**
 * Adventure Mode — core types.
 *
 * Everything about the campaign is DATA (levels, mechanics, fighters, upgrades,
 * rewards). The engine reads these tables; screens render them. To redesign the
 * campaign, edit the tables in `src/adventure/data/` — not the engine.
 */

import type { WeaponBuilds, WeaponStatDef } from './data/weaponStats';
import type { AttributeName, BoardConnection, CharacterName, Card, CardReward, Weapon, PlayerStats } from '@/types';
import type { EnemyInstance, RoundStats } from '@/types/enemy';
import type { IconName } from '@/components/Icon';
import type { RuleSource } from './rules/types';
import type { GrowthState } from './data/weaponGrowth';

// ---------------------------------------------------------------------------
// Mechanics (the "tutorial is the game" backbone)
// ---------------------------------------------------------------------------

/**
 * Feature mechanics stay ON once introduced (they accumulate along the map).
 * Threat mechanics come from a level's foe and only apply to that level.
 * Rule mechanics change the puzzle itself (more attributes, timers, waves...).
 */
export type MechanicKind = 'feature' | 'threat' | 'rule' | 'fighter';

export type FeatureFlag =
  | 'hearts'      // wrong sets cost a heart
  | 'gear'        // fighter gear, ability and charm are active (everywhere except bare levels)
  | 'power'       // power cards: +2 damage when matched
  | 'rainbow'     // all-different sets hit twice as hard
  | 'purity'      // escalating attribute-diversity combos (1-diff -> 2-diff -> Rainbow)
  | 'coins'       // coins drop & bank to your purse
  | 'hints'       // hint button
  | 'graces'      // near-miss forgiveness
  | 'xp'          // in-level level-ups: pick a weapon
  | 'evolutions'  // hidden evolution catalysts on cards + weapon fusions
  | 'shop';       // shop between waves

export interface MechanicDef {
  id: string;
  kind: MechanicKind;
  title: string;
  /** One line shown on the map / preview badge */
  tagline: string;
  /** 1-3 short paragraphs shown on the intro card */
  body: string[];
  icon: IconName;
  /** Visual demo shown on the intro card */
  demo?: MechanicDemo;
  /** Turning this feature on when the mechanic is introduced */
  enables?: FeatureFlag;
  /** One short line the companion says as the first fight with this mechanic opens (under about 60 characters) */
  coach?: string;
  /**
   * The mechanic is used at Camp (skill trees): the level's lesson card offers
   * to go there, so the new thing can be used before the fight that asks for it.
   */
  camp?: { tab: 'fighters' | 'armory' | 'arcana' | 'workshop' | 'bounties'; label: string };
  /** In-run tip shown the first time it happens (keyed by run event). The player must accept it. */
  coachMark?: { on: RunEventType; text: string };
  /** Tips shown one by one when the first fight with this mechanic starts. Each must be accepted. */
  fightTips?: FightTip[];
  /** Extra teaching pages shown before the summary page */
  lessons?: LessonPage[];
  /** "Is this a Set?" questions the player answers before the fight */
  quiz?: QuizQuestion[];
}

export interface FightTip {
  title: string;
  text: string;
  /** Which part of the screen the tip is about */
  anchor?: 'top' | 'bottom';
}

export interface LessonPage {
  title: string;
  body: string[];
  demo?: MechanicDemo;
}

/** Validity is computed from the cards, never hand-authored. */
export interface QuizQuestion {
  attributes: AttributeName[];
  cards: DemoCard[];
  /** Shown after answering */
  explain: string;
}

export type MechanicDemo =
  | { type: 'set'; attributes: AttributeName[]; valid: boolean; cards: DemoCard[]; caption: string }
  | { type: 'icons'; items: Array<{ icon: IconName; label: string; color?: string }> };

export interface DemoCard {
  shape: Card['shape'];
  color: Card['color'];
  number: Card['number'];
  shading: Card['shading'];
  background?: Card['background'];
  modifiers?: Partial<Pick<Card, 'isDud' | 'isFaceDown' | 'health' | 'hasCountdown' | 'countdownTimer' | 'hasBomb' | 'bombTimer' | 'onFire' | 'bonusMoney' | 'bonusPoints' | 'hasEvolutionItem' | 'evolutionReady'>>;
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export type BiomeId = 'meadow' | 'woods' | 'canyon' | 'peaks' | 'summit';

export interface BiomeDef {
  id: BiomeId;
  name: string;
  subtitle: string;
  /** Total stars needed to enter this biome (Angry Birds style gate) */
  starGate: number;
  colors: { sky: string; ground: string; path: string; accent: string; ink: string };
  /** Music variation key for the chip sequencer */
  music: string;
  decor: IconName[];
  /** Something in the sky over the region's banner on the map (a sun, a cloud, a falling star) */
  skyIcon?: { icon: IconName; color: string };
}

/** What kind of Set counters a foe's telegraphed attack. */
export type ParryRequirement =
  /** Default timing-based parry: any valid Set during wind-up parries; final window = Perfect Parry */
  | { kind: 'any' }
  /** All three cards share this color (e.g. All Red) */
  | { kind: 'color'; color: Card['color'] }
  /** All three cards share this shape (e.g. All Ovals) */
  | { kind: 'shape'; shape: Card['shape'] }
  /** Every active trait is all-different across the three cards (Rainbow) */
  | { kind: 'all_different' }
  /** Exactly `count` active traits are identical across all three cards (e.g. 2 traits the same) */
  | { kind: 'exact_same'; count: 2 }
  /** Exactly `count` active traits are all-different across the three cards (e.g. 2 traits different) */
  | { kind: 'exact_diff'; count: 2 }
  /** All three cards have the same number (e.g. three 1s, 2s, or 3s) */
  | { kind: 'same_number' }
  /** All three cards have different numbers (1, 2, 3) */
  | { kind: 'diff_number' };

/** What happens if a foe's telegraphed attack finishes unparried. */
export type ParryPenalty = 'heart' | 'glancing' | 'time';

/** Specification for a foe's telegraphed attack & Set-Parry counter. */
export interface ParrySpec {
  attackName: string;
  icon: IconName;
  counter: ParryRequirement;
  /** Calm time (ms) between attacks */
  cooldownMs: number;
  /** Telegraph wind-up duration (ms) during which the player can Parry */
  windupMs: number;
  /** Final golden window (ms) of the wind-up that scores a PERFECT PARRY + Stagger */
  perfectWindowMs: number;
  /** Consequence if the wind-up completes unparried */
  penalty: ParryPenalty;
  /** Optional archetype override for Stagger duration (e.g. Heavy Slam 9000ms) */
  staggerMs?: number;
  /** Optional override for unparried penalty magnitude (hearts for 'heart', seconds for 'time') */
  penaltyAmount?: number;
  /** Optional boss escalation: tighten cooldown by this many ms below 50% HP */
  bossEnrageDeltaMs?: number;
}

/** Optional relief (Friendly Tailwind) or wager (Starfall Cauldron) modifiers passed into a run. */
export interface RunReliefOptions {
  /** Friendly Tailwind active after 2 consecutive losses */
  tailwindActive?: boolean;
  /** Starfall Cauldron upward wager tier (0 = standard, 1 = Bold, 2 = Starfall) */
  cauldronWager?: 0 | 1 | 2;
  /** Extra starting & max hearts (e.g. +2 for Friendly Tailwind) */
  extraHearts?: number;
  /** Starting timer / move-budget scale (e.g. 1.2 for +20%) */
  timerScale?: number;
  /** Parry wind-up duration multiplier (e.g. 1.25 slower for Tailwind, 0.9/0.8 faster for Wager) */
  parryWindupScale?: number;
  /** Foe HP multiplier (e.g. 1.25 / 1.5 for Starfall Cauldron wager) */
  foeHpScale?: number;
  /** Run coin payout multiplier (e.g. 1.5 / 2.0 for Starfall Cauldron wager) */
  coinMultiplier?: number;
  /** Optional star cap (e.g. 1 for Friendly Tailwind) */
  starCap?: number;
}

/** Live Set-Parry state for the current wave's foe. */
export interface ParryState {
  spec: ParrySpec;
  phase: 'calm' | 'windup' | 'staggered';
  /** Time left in the current phase (ms) */
  msLeft: number;
  /** Total duration of the current phase (ms) */
  durationMs: number;
  /** True once the golden Perfect Parry warning has emitted for this wind-up */
  warned: boolean;
  /** Fairness stalls granted this wind-up when no counter-Set existed on the board */
  stallsUsed: number;
  /** Total parries landed this wave */
  parries: number;
  /** Total Perfect Parries landed this wave */
  perfectParries: number;
}

/** A follow-up damage source triggered by the Set during the same turn (e.g. Rally Horn +11, Free Set +18). */
export interface SetFollowUpItem {
  label: string;
  amount: number;
  sourceRef?: string;
}

/** Per-weapon Balatro-style trigger value badge shown on the GearBelt when a weapon contributes. */
export interface BeltBadge {
  text: string;
  kind: 'flat' | 'mult' | 'fx';
}

/** Snapshot of the latest scored Set for the Live Balatro Scoreboard, GearBelt badges & Kill-Cam FX. */
export interface SetIgnition {
  id: number;
  math: FightLogSetMath;
  /** Follow-up weapon/rule damage lines triggered during this same Set turn */
  followUps?: SetFollowUpItem[];
  /** Per-weapon value badges keyed by weapon id (e.g. "+3", "×2", "+11", "🔥4") */
  beltBadges?: Record<string, BeltBadge>;
  /** Total damage dealt across the entire Set turn (Set hit + follow-ups) */
  turnDamage?: number;
  parryKind?: 'parry' | 'perfect';
  staggered?: boolean;
  lethal: boolean;
  isBossOrElite: boolean;
  foeName: string;
}

/** Foe on the map: either a registered enemy (with real effects) or a cosmetic sparring foe. */
export interface FoeDef {
  /** Name of a registered enemy in enemyFactory (gives real mechanics) */
  enemy?: string;
  /** Optional Hydra boss head phase (1, 2, or 3) used by 5-5 while preserving canonical enemy: 'The Hydra' */
  hydraPhase?: 1 | 2 | 3;
  /** Cosmetic foe (no special effects) */
  name?: string;
  icon?: IconName;
  hp: number;
  taunt?: string;
  /** Optional explicit telegraphed attack & Set-Parry counter (auto-resolved if omitted) */
  parry?: ParrySpec | null;
}

export type ChallengeDef =
  | { kind: 'noMistakes' }
  | { kind: 'fullHearts' }
  | { kind: 'movesLeft'; n: number }
  | { kind: 'timeLeft'; n: number }
  | { kind: 'rainbows'; n: number }
  | { kind: 'streak'; n: number }
  | { kind: 'noGrace' }
  | { kind: 'hintsLeft'; n: number }
  | { kind: 'enemy' }   // use the registered enemy's own defeat condition
  // "Use the new thing" challenges for the level that introduces it
  | { kind: 'useHints'; n: number }
  | { kind: 'graceSaves'; n: number }
  | { kind: 'evolutions'; n: number }
  | { kind: 'defuseTraps'; n: number }
  | { kind: 'comboReach'; n: number }
  | { kind: 'bonusCards'; n: number }
  | { kind: 'explosions'; n: number }
  | { kind: 'purityChain'; n: number }
  | { kind: 'levelUps'; n: number }
  | { kind: 'shopBuys'; n: number }
  /** A single Set dealing at least n damage */
  | { kind: 'bigHit'; n: number }
  /** Sets made during Shading Surges */
  | { kind: 'surgeSets'; n: number }
  /** Sets where all three cards are a specific color (e.g. all-red Sets) */
  | { kind: 'colorSets'; color: Card['color']; n: number }
  /** Sets where all three cards share the same color */
  | { kind: 'sameColorSets'; n: number }
  /** Sets where every active trait is all-different across the three cards */
  | { kind: 'allDiffSets'; n: number };

/** Board traps placed by the level itself (any foe). `every` = refilled cards per new trap. */
export interface LevelHazards {
  /** Match it before the fuse runs out, or lose a heart */
  timeBombs?: { every: number; seconds: number };
  /** Matching it hurts; matching the card its arrow points at defuses it */
  snares?: { every: number };
}

export type ArcanaId =
  | 'monochrome_pact'
  | 'prismatic_fever'
  | 'controlled_burn'
  | 'glass_prism'
  | 'overkill_harvest'
  | 'scholars_gambit'
  | 'catalyst_resonance'
  | 'tempo_surge';

/**
 * How an Arcana bends the rules of a fight. Every field is optional; a missing
 * field means the standard rule applies. The engine reads only these numbers,
 * and the card text in data/arcana.ts is written from the same numbers.
 */
export interface ArcanaRules {
  foeHpScale?: number;
  /** Replaces the starting Grace count */
  startingGraces?: number;
  maxHeartsDelta?: number;
  /** Max Hearts are fixed at this value for the whole fight */
  maxHeartsLock?: number;
  /** On move-limited fights without a clock */
  untimedMoves?: { delta: number; min: number };
  /** Scales how often Power and Gold cards are dealt */
  specialCardChanceScale?: number;
  nonRainbowDamageDelta?: number;
  /** Bonus damage for a Set with exactly one all-different trait */
  singleTraitBonusDamage?: number;
  /** Monochrome Pact: Power points added on 1-diff Sets */
  singleTraitPowerBonus?: number;
  /** Monochrome Pact: damage scale applied to 3+ diff Sets */
  highDiffDamageScale?: number;
  rainbowMultiplier?: number;
  damageScale?: number;
  setTimeBonus?: number;
  /** Tempo Surge: extra Combo steps granted on every valid Set */
  setComboBonus?: number;
  rainbowTimeBonus?: number;
  timerSpeedScale?: number;
  /** A wrong Set ignites cards instead of costing a heart, at most once per cooldown */
  mistakeBurn?: { cooldownMs: number; cards: number };
  /** Controlled Burn: multiplier applied to burn damage from mistake burns */
  mistakeBurnDamageScale?: number;
  /** Controlled Burn: Power points added when mistake burn triggers */
  mistakeBurnPowerBonus?: number;
  /** Controlled Burn: hearts lost on mistakes while burn is on cooldown */
  cooldownMistakeHearts?: number;
  /** Glass Prism: disables all healing while active */
  noHeal?: boolean;
  /** Glass Prism: Power card bonus damage override (+4 = double base +2) */
  powerCardBonusOverride?: number;
  /** Overkill Harvest: normal Sets drop 0 base coins (only Overkill, Gold cards & Parries pay) */
  zeroBaseSetCoins?: boolean;
  overkillCoinsPerDamage?: number;
  /** Overkill Harvest: fraction of overkill damage carried into the next wave */
  overkillCarryPct?: number;
  waveClearHeal?: number;
  xpScale?: number;
  pickOptions?: number;
  /** Scholar's Gambit: delta to equipped charm slots (-1 = enter with 1 fewer charm) */
  charmSlotDelta?: number;
  /** Scholar's Gambit: Power points granted on each mid-fight level-up */
  levelUpPowerBonus?: number;
  catalystChanceScale?: number;
  catalystRespawns?: number;
  evolutionBurstBonus?: { damage: number; time: number };
  /** Catalyst Resonance: damage multiplier on Sets made while no Evolution is active */
  nonEvolvedDamageScale?: number;
}

export interface ArcanaDef {
  id: ArcanaId;
  rules: ArcanaRules;
  numeral: string;
  name: string;
  icon: IconName;
  tagline: string;
  upside: string;
  tradeoff: string;
}

/** A campaign system that starts locked. Each one is described once in data/features.ts. */
export type UnlockableFeature = 'coins' | 'workshop' | 'bounties';

/** Where "open it now" leads after a feature's unlock reveal */
export type FeatureDestination = { screen: 'camp'; tab: 'workshop' | 'bounties' };

export interface CampaignFeatureDef {
  id: UnlockableFeature;
  /** The AdventureSave boolean this feature sets (persisted, so the names are fixed) */
  saveFlag: 'coinsUnlocked' | 'workshopUnlocked' | 'bountiesUnlocked';
  /** Mechanic that explains it (icon, "How it works" text, Field Guide entry) */
  mechanic: string;
  name: string;
  /** Shown in place of the name while a reward is still secret */
  secret: string;
  headline: string;
  tease: string;
  badge: string;
  accent?: string;
  /**
   * Unlocked by the first star on this level instead of by a star reward. Its
   * reveal plays after that result's star rewards and it is not listed among them.
   */
  clearLevel?: string;
  /** Offered as the last step of the unlock reveal */
  open?: { label: string; destination: FeatureDestination };
}

/**
 * Every star pays coins (shown up front). Some stars ALSO unlock a weapon,
 * fighter, Arcana, Weapon Combo recipe, or campaign system — hidden as a
 * silhouette until earned, then revealed with fanfare.
 */
export interface RewardDef {
  coins: number;
  /** Weapon ids added to the Armory (charm slot, shop and level-up pool) */
  weapons?: string[];
  character?: CharacterName;
  arcana?: ArcanaId;
  /** Weapon Evolution recipe id unlocked for the Recipe Guide & Hidden Catalysts */
  evolution?: string;
  /** Campaign system unlocked by this star */
  unlockFeature?: UnlockableFeature;
}

/** How stars are earned. Default 'combat': survive / knock out / knock out + challenge. */
export type StarRule =
  | { kind: 'combat' }
  /** Finish the level; stars depend on mistakes (the very first level). */
  | { kind: 'accuracy'; threeStarMax: number; twoStarMax: number };

export interface LevelRules {
  attributes: AttributeName[];
  boardSize?: number;
  /** Move-limited level: the level ends after this many matches */
  moves?: number;
  /** Timed level (seconds). 1★ = survive the clock. */
  timer?: number;
  hearts: number;
  startingHints?: number;
  startingGraces?: number;
  /** Bare level: no passives, charms, Arcana or evolutions (the very first level) */
  noGear?: boolean;
  hazards?: LevelHazards;
  /** Percentage points added to the Catalyst chance on every refill (e.g. the level that teaches evolutions) */
  evolutionLikelihood?: number;
  /** Extra Evolutions allowed per fight beyond the base cap (used by Spire boons) */
  extraEvolutionCap?: number;
  /**
   * Shading Surge (Worlds 3-5): the board plays on `attributes` with every card
   * solid, then for a short window shading turns on and every Set hits much
   * harder (engine/surge.ts, numbers in data/rules.ts SURGE_RULES).
   */
  shadingSurge?: boolean;
  /**
   * Practice fight: the foe cannot be knocked out, hearts refill when they run
   * out, every mechanic the player has learned is on, and nothing is banked
   * (no stars, coins or bounty progress). It ends when the player leaves.
   */
  sandbox?: boolean;
}

export interface LevelDef {
  id: string;            // e.g. "1-3"
  biome: BiomeId;
  name: string;
  /** The ONE new thing this level teaches */
  introduces: string;    // mechanic id
  rules: LevelRules;
  /** One or more foes. More than one = waves. */
  foes: FoeDef[];
  challenge: ChallengeDef;
  starRule?: StarRule;
  /** Coin multiplier — harder levels pay more */
  coinMultiplier: number;
  /** 1-5 skulls shown on the preview */
  difficulty: 1 | 2 | 3 | 4 | 5;
  rewards: { star1: RewardDef; star2: RewardDef; star3: RewardDef };
  isBoss?: boolean;
  /** Elite encounter flag (used by Spire Elites without creating a fake Adventure `branchOf` id) */
  isElite?: boolean;
  /**
   * Secret side path: hangs off this level on the map, stays hidden until
   * `opensAt` stars are earned there, and never blocks the main path.
   */
  branchOf?: string;
  /** Stars on `branchOf` that reveal this path (default ★★, BRANCH_STAR_REQUIREMENT) */
  opensAt?: 1 | 2 | 3;
  /** Fighters that are especially good here (shown on preview) */
  recommended?: CharacterName[];
}

// ---------------------------------------------------------------------------
// Fighters (characters) and permanent upgrades
// ---------------------------------------------------------------------------

export interface FighterDef {
  name: CharacterName;
  icon: IconName;
  /** Mechanic this fighter introduces when unlocked */
  signature: string; // mechanic id
  /** One line on the playstyle */
  blurb: string;
  /** The fighter's two passives, in branch order (branch 0 grows from the first) */
  passives: [PassiveId, PassiveId];
}

export type PassiveId =
  | 'nine_lives' | 'scrappy'
  | 'combo' | 'hot_streak'
  | 'grudge' | 'thick_hide'
  | 'patience' | 'deep_freeze'
  | 'zoomies' | 'fetch'
  | 'big_scoop' | 'keen_eye';

export interface PassiveDef {
  id: PassiveId;
  name: string;
  icon: IconName;
  /** Player-facing text, written from `tuning` */
  text: string;
  /** Numbers the engine reads; skill nodes adjust them through Modifiers.passiveTuning */
  tuning: Record<string, number>;
}

/** A cell on a fighter's skill-tree map: col 0-6, row 0 at the top. */
export interface TreePos {
  col: number;
  row: number;
}

/**
 * One node of a fighter's skill tree. Trees are webs (Clair Obscur style): a
 * node can be bought once any node it links to is owned, or straight away if
 * it hangs off one of the fighter's passives (`roots`).
 */
export interface SkillNode extends RuleSource {
  id: string;
  fighter: CharacterName;
  name: string;
  text: string;
  /** Stars */
  cost: number;
  icon: IconName;
  pos: TreePos;
  /** Ids of the nodes this one links to (always symmetric) */
  links: string[];
  /** Passives this node hangs off directly */
  roots: PassiveId[];
  /** Sealed until the player has earned this many stars in total */
  requires?: { starsEarned: number };
  /** Mutually exclusive capstone partner node id (only one of the pair may be active at once) */
  exclusiveWith?: string;
}

/**
 * A weapon that only exists in Adventure and may carry rules. Its numbers are
 * `stats` (levelled and tuned like any weapon's, data/weaponStats.ts) and
 * `build` turns them into its rules and wording.
 */
export type AdventureWeapon = Weapon & RuleSource & {
  stats?: Record<string, WeaponStatDef>;
  build?: (v: Record<string, number>) => RuleSource & { description: string; shortDescription: string };
};

/** Two weapon families fused into a 30-second power state. */
export interface EvolutionRecipe {
  id: string;
  name: string;
  icon: IconName;
  /** Weapon id prefixes; armed when the fighter holds one of each list */
  families: [string[], string[]];
  /** e.g. "Explosion + Healing" */
  familyText: string;
  /** What happens while it is active, for the Recipe Guide and the banner */
  activeText: string;
  flavor: string;
  /** Live only while the evolution is active */
  source: RuleSource;
}

export interface UpgradeDef {
  id: string;
  name: string;
  icon: IconName;
  description: (tier: number) => string;
  costs: number[];       // cost for tier 1..N
  apply: (stats: PlayerStats, tier: number, ctx: { timed: boolean }) => PlayerStats;
  /** The mechanic this improves. Shown and sold once the player has met that mechanic. */
  mechanic: string;
  /** Bonus damage per match etc. that is not a PlayerStats field */
  bonusDamage?: (tier: number) => number;
  coinBonusPercent?: (tier: number) => number;
}

// ---------------------------------------------------------------------------
// Cross-run Bounties & Save data
// ---------------------------------------------------------------------------

export interface BountyStats {
  totalSets: number;
  rainbowSets: number;
  purityChains: number;        // 2+ step escalations triggered
  threeStepPurities: number;   // 3+ step escalations triggered
  flawlessTimedWins: number;   // timed stage knocked out (≥2★) with 0 mistakes
  maxOverkill: number;         // biggest overkill blow past 0 HP
  evolutionsForged: number;    // total evolutions triggered across runs
  destructiveFights: number;   // fights where fire/explosion/laser triggered
  trapsDefused: number;        // lifetime traps defused
  biggestHit: number;          // best single-action damage ever
  fighterWins: Partial<Record<CharacterName, number>>;
}

export type BountyCategory = 'mastery' | 'chaos' | 'roster' | 'explorer';

export interface BountyDef {
  id: string;
  category: BountyCategory;
  name: string;
  description: string;
  icon: IconName;
  target: number;
  progress: (save: AdventureSave) => number;
  reward: RewardDef;
}

export interface AdventureSave {
  version: 1;
  coins: number;
  lifetimeCoins: number;
  stars: Record<string, number>;     // levelId -> best stars (0-3)
  plays: Record<string, number>;     // levelId -> attempts
  /** @deprecated v1 field; refunded and cleared on load */
  fighterLevels: Record<string, number>;
  /** Owned skill-tree node ids per fighter */
  skillNodes: Record<string, string[]>;
  unlockedFighters: CharacterName[];
  armory: string[];                  // unlocked weapon ids
  upgrades: Record<string, number>;  // mechanic upgrade id -> tier
  /** @deprecated Workshop weapon levels from before levels became world-only; refunded and cleared on load */
  weaponUpgrades: Record<string, number>;
  /** Workshop tuning per Armory weapon: number key -> tier 1..4 (data/weaponStats.ts) */
  weaponTuning: Record<string, Record<string, number>>;
  /** Levels (minus 1) carried over from the stronger rare/epic copies an older save owned: a floor on found levels */
  legacyWeaponTiers: Record<string, number>;
  /** Campaign systems unlocked so far, one flag per entry of data/features.ts */
  coinsUnlocked: boolean;
  workshopUnlocked: boolean;
  /** Lessons already played and in-fight tips already accepted; keys are built by LESSON_KEYS / COACH_KEYS in progress.ts */
  seenMechanics: string[];
  seenCoachMarks: string[];
  selectedFighter: CharacterName;
  /** @deprecated v1 single charm; migrated into `charms` on load */
  charm: string | null;
  /** Equipped Armory weapons (3 slots, up to 6 with Charm Belt) */
  charms: string[];
  /** Unlocked Arcana tarot modifiers & currently active wildcard (null = standard rules) */
  unlockedArcana: ArcanaId[];
  /** @deprecated v1 single Arcana; migrated into `equippedArcana` on load */
  activeArcana: ArcanaId | null;
  /** Equipped Arcana (1 slot, up to 3 with Tarot Deck) */
  equippedArcana: ArcanaId[];
  bountiesUnlocked: boolean;
  /** Completed bounty ids & lifetime counters */
  completedBounties: string[];
  bountyStats: BountyStats;
  /** Weapon Combo (Evolution) recipe ids unlocked via level/bounty rewards */
  unlockedEvolutions: string[];
  /** Evolution recipe ids forged at least once (unlocks full details in Recipe Guide) */
  discoveredEvolutions: string[];
  musicOn: boolean;
  /** Play the fight's effects (the clock waits while they play). Off: numbers only. */
  effectsOn: boolean;
  /** Secret side paths whose arrival has played on the map (ids) */
  revealedPaths: string[];
  /** Golden Rescue Keys already redeemed along the map: mapKeyId -> rescued friend name */
  claimedMapKeys: Record<string, CharacterName>;
  /** Consecutive losses per level id (resets on any >=1★ clear; drives Friendly Tailwind relief) */
  consecutiveLosses?: Record<string, number>;
  /** Quietly banked coins from pre-1-8 losses that burst open when coins unlock on 1-8 */
  hiddenPurse?: number;
  /** Selected Starfall Cauldron upward wager tier (0 = standard, 1 = Bold, 2 = Starfall) */
  cauldronWager?: 0 | 1 | 2;
  /** Whether Friendly Tailwind relief is currently toggled on */
  tailwindActive?: boolean;
  /** Lowest foe HP fraction (0..1) reached on each level — powers pre-1-8 "Closest Yet!" progress bar ([OB-13]) */
  bestFoeHpPct?: Record<string, number>;
  /** True once the 5-5 Starfall Summit ending ceremony & crew reunion has played ([OB-20]) */
  endingSeen?: boolean;
}

// ---------------------------------------------------------------------------
// Run (one attempt at a level)
// ---------------------------------------------------------------------------

export type RunStatus = 'playing' | 'pick' | 'pick_evolution' | 'intermission' | 'won' | 'lost';

/**
 * Things that happen in a fight, for floaters, sounds and coach marks.
 * `amount` is the number to show (damage, hearts, coins...), `text` a short label.
 */
export type RunEventType =
  /** Damage to the foe. A Set's own hit has no text; other sources name themselves in `text`. */
  | 'hit' | 'rainbow' | 'heal' | 'hurt' | 'grace' | 'coins' | 'levelup'
  | 'foe_defeated' | 'wave' | 'regen' | 'dud' | 'face_down' | 'countdown'
  | 'bomb' | 'triple' | 'shuffle' | 'attr_shift' | 'card_removed' | 'time_stolen'
  | 'inactivity' | 'fire' | 'hint' | 'mistake' | 'time_up' | 'moves_out'
  /** Seconds added to the clock */
  | 'time_gain'
  // fighter passives
  | 'nine_lives' | 'combo' | 'hot_streak' | 'hot_streak_hit' | 'grudge' | 'grudge_release'
  | 'thick_hide' | 'patience' | 'freeze' | 'redeal' | 'scoop' | 'keen_eye' | 'fetch'
  /** A mistake was forgiven by a free-mistake modifier */
  | 'free_mistake'
  // rule effects
  /** A rule with a callout fired (`text` = the callout) */
  | 'rule'
  /** Cards destroyed by an area effect; amount = damage dealt, text = cards destroyed */
  | 'blast' | 'laser' | 'ricochet'
  /** The next weapon trigger was doubled (text '×2', amount = how many doubles are still queued) */
  | 'doubled'
  /** A doubled trigger is armed and waiting */
  | 'double_ready'
  /** The next Set is multiplied (amount = multiplier) */
  | 'charged'
  | 'empowered' | 'simplified' | 'simplify_end' | 'pinata' | 'pinata_break' | 'link'
  // purity, evolutions, hazards & arcana
  | 'purity' | 'purity_max' | 'catalyst_spawn'
  | 'evolution_start' | 'evolution_end'
  | 'trap_placed' | 'trap_defused' | 'trap_sprung'
  | 'arcana_burn' | 'overkill'
  /** An echo matched another Set for you; its damage is part of the Set's own hit (text = cards) */
  | 'echo'
  /** Cards went down with their linked partners; their damage is part of the Set's own hit (text = cards) */
  | 'link_burst'
  /** The board grew (amount = cards added) */
  | 'grow'
  /** Shading Surge: warning (amount = seconds until it starts), start, end, and a Set scored during it (amount = damage) */
  | 'surge_warn' | 'surge_start' | 'surge_end' | 'surge_hit'
  /** Practice only: out of hearts, so they refill (amount = hearts back) */
  | 'breather'
  /** A weapon grew stronger for the rest of the fight (text = what it gained, amount = its stacks) */
  | 'power_up'
  /** Set-Parry: foe entering golden Perfect Parry window, Counter Parry, Perfect Parry (Stagger ×2), or unparried strike */
  | 'parry_warn' | 'parry' | 'perfect_parry' | 'foe_strike';

export interface RunEvent {
  id: number;
  type: RunEventType;
  amount?: number;
  text?: string;
  /** Rule key of the skill node, weapon or evolution that caused it ("w2:war-drum#0"), when a rule did */
  source?: string;
  /** Board slots it touched, so the fight's effects can play where it happened (src/adventure/fx) */
  slots?: number[];
  /** The cards that were in `slots` when it removed them (null = that card stayed), for the same effects */
  cards?: (Card | null)[];
  /**
   * It happened on the fight clock (a foe's timer, a fuse, an evolution running out), not because of
   * something the player just did. Its effects play while the clock runs: only the player's own moves hold it.
   */
  clock?: true;
}

/** Where on the board an event happened (see RunEvent.slots / RunEvent.cards). */
export interface EventPlace {
  slots?: number[];
  cards?: (Card | null)[];
}

// ─── Fight log (results-screen replay) ────────────────────────────────────

/** What one log entry records: a move the player made, or something the clock or a foe did. */
export type FightLogKind =
  /** A Set the player made */
  | 'set'
  /** A wrong pick (3 cards that weren't a Set) */
  | 'mistake'
  /** A burning card burned up (nearby burns merge into one entry) */
  | 'burn'
  /** Something happened on the clock: foe attacks, evolutions ending, fuses… (merged per second) */
  | 'time'
  | 'hint'
  | 'pick'
  | 'buy'
  | 'wave';

export interface FightLogCard {
  shape: Card['shape'];
  color: Card['color'];
  number: Card['number'];
  shading: Card['shading'];
  background?: Card['background'];
  /** Total damage points this card contributed (1 base + bonus) */
  points?: number;
  /** Extra bonus damage carried on this card (Power cards, Charge, etc.) */
  bonusPoints?: number;
  /** Short notes on what was special about the card: "+2 dmg", "Catalyst", "On fire"… */
  tags: string[];
}

/** One itemized contributor (flat bonus, multiplier, or extra) in a Set's damage math. */
export interface FightLogMathItem {
  label: string;
  amount: number;
  note?: string;
  sourceRef?: string;
}

/** One thing that happened during an entry (a RunEvent plus the rule source that caused it). */
export interface FightLogLine {
  type: RunEventType;
  amount?: number;
  text?: string;
  /** Skill node, weapon or evolution whose rule caused it (by name) */
  source?: string;
  /** The same source as something to look up: "weapon:<id>", "node:<id>" or "evo:<id>" */
  sourceRef?: string;
}

/** How a Set's own hit was worked out. */
export interface FightLogSetMath {
  /** Points on the three matched cards (base 1 each + bonus + charge) */
  cards: number;
  /** Number of matched cards (normally 3) */
  cardCount?: number;
  /** Base damage across matched cards (1 per card = 3) */
  baseCards?: number;
  /** Extra damage stored on the matched cards (Power cards, Charge, etc.) */
  cardBonus?: number;
  /** Plain-English note describing why the cards carried extra damage */
  cardBonusNote?: string;
  /** Shading Surge multiplier applied to matched cards when active (e.g. ×5) */
  surgeMultiplier?: number;
  /** Points on cards the Set's weapon procs destroyed (explosion, laser, ricochet…) by kind */
  collateral: Partial<Record<NonNullable<CardReward['effectType']>, number>>;
  /** Flat per-Set bonuses (gear, skill nodes, passives, conditional damage, active evolutions) */
  flatBonus: number;
  /** Itemized breakdown of every non-zero contributor to `flatBonus` */
  flatItems?: FightLogMathItem[];
  /** Everything the flat total was multiplied by (rainbow, Hot Streak / next-Set ×N, foe, arcana) */
  multiplier: number;
  /** Itemized breakdown of multipliers composing `multiplier` */
  multItems?: FightLogMathItem[];
  rainbow: boolean;
  /** Purity chain and trap bonus damage, added after the multiplier */
  extra: number;
  /** Itemized breakdown of post-multiplier extras */
  extraItems?: FightLogMathItem[];
  /** Global Power multiplier applied at damage dealing (when > ×1) */
  powerMultiplier?: number;
  /** Accumulated Power points right after this Set */
  powerPoints?: number;
  /** Damage the Set itself dealt */
  hit: number;
  /** How many traits were all different */
  diffTraits: number;
  graceUsed: boolean;
  /** Time since the previous Set */
  sinceLastMs: number;
  /** Combo count after this Set */
  combo: number;
}

export interface FightLogEntry {
  /** Fight clock (elapsedMs) when it happened */
  t: number;
  /** 0-based wave */
  wave: number;
  kind: FightLogKind;
  /** The three picked cards (sets and mistakes) */
  cards?: FightLogCard[];
  set?: FightLogSetMath;
  /** Weapon name for picks and buys */
  label?: string;
  /** All damage dealt to the foe during the entry */
  damage: number;
  /** Damage from the Set's own hit; the rest of `damage` was triggered by something */
  setDamage: number;
  coins: number;
  xp: number;
  /** Hearts after the entry (null = infinite) */
  hearts: number | null;
  heartsDelta: number;
  foeHp: number;
  foeMaxHp: number;
  lines: FightLogLine[];
}

/** Live state of the fighter's two passives (fields of passives the fighter lacks stay at rest). */
export interface PassiveState {
  /** Nine Lives: knockouts it can still absorb this fight */
  nineLivesLeft: number;
  /** Hot Streak: the next Set is multiplied */
  hotStreak: boolean;
  /** Grudge: stored grudges */
  grudge: number;
  /** Thick Hide: free mistakes left this wave */
  thickHideLeft: number;
  /** Zoomies: Sets until the next re-deal */
  zoomiesIn: number;
  /** Big Scoop: Sets until the next free Set */
  scoopIn: number;
  /** Keen Eye: the card glowing right now (part of a Set) */
  keenEyeCardId: string | null;
}

export interface ActiveEvolution {
  id: string;
  remainingMs: number;
  durationMs: number;
}

/** Per-rule bookkeeping (sliding windows, once-only triggers). Keyed by rule key. */
export interface RuleRuntime {
  /** setsWithin: times of recent Sets */
  times?: number[];
  /** idle / foeBelow: already fired (idle resets on a Set, foeBelow on a new wave) */
  fired?: boolean;
}

/** Shading Surge clock: calm (shading off, every card solid) and surge (shading on, Sets ×5) alternate. */
export interface SurgeState {
  active: boolean;
  /** Time left in the current phase (fight-clock ms) */
  msLeft: number;
  /** Surges started so far */
  count: number;
  /** Sets made during surges */
  sets: number;
}

export interface SimplifyState {
  attribute: AttributeName;
  value: string | number;
  remainingMs: number;
  /** A second trait made the same as well (a double Clarity) */
  also?: { attribute: AttributeName; value: string | number };
}

/** What the trick weapons remember during a fight (engine/gear.ts). */
export interface GearState {
  /** Bounty Poster: the wanted value and how many more wanted cards until it changes */
  bounty: { attribute: AttributeName; value: string | number; left: number } | null;
  /** Mirror Shard: board slots of the player's previous Set */
  lastSetSlots: number[];
  /** Snowball: stacks this wave */
  snowball: number;
  /** Collector's Album: traits whose page is filled */
  album: AttributeName[];
  /** Collector's Album: pages frozen at wave start (immune to Shading Surge adding/removing 'shading') */
  albumPages?: AttributeName[];
  /** Glass Sword: shattered for this wave, and when its clock last restarted */
  glassBroken: boolean;
  glassSinceMs: number;
  /** Glass Sword: consecutive clean Sets landed while shattered (3 reforges it) */
  glassReforgeStreak?: number;
  /** Tar Pit: the sticky row this wave */
  tarRow: number | null;
  /** Hot Potato: fight time (ms) of its next jump */
  potatoAtMs: number;
  /** Mirror Shard: slots of earlier Sets it still remembers (once it has grown), newest first */
  mirrorMemory: number[][];
  /** Glass Sword: shatters survived so far (its growth grants spares) */
  glassSparesUsed: number;
  /** Rust: rustGold already stamped onto each gilded card (cardId -> stamped bonusPoints), so later rustGold buffs still pay the delta */
  rustGoldStamped?: Record<string, number>;
  /** Greedy Chest: bonus queued by feedChest when no chest card was live on the board */
  pendingChestBonus?: number;
}

export interface RunState {
  level: LevelDef;
  fighter: CharacterName;
  features: Set<FeatureFlag>;
  rng: number;
  /** Seeded stream foe effects roll on (`d._foeRng`); missing on runs from before it */
  foeRng?: number;
  /** Seeded stream board weapon procs roll on (`d._weaponRng`); decoupled from deck deals */
  weaponRng?: number;
  attributes: AttributeName[];
  deck: Card[];
  board: Card[];
  connections: BoardConnection[];
  stats: PlayerStats;           // baked totals (base + gear + upgrades), chances scaled by modifiers
  /** Weapon chance stats before `weaponChanceScale` modifiers */
  baseChances: Record<string, number>;
  weapons: Weapon[];            // charms + picks + buys (for laser rolls, rules & inventory)
  hearts: number | null;        // null = infinite (very first level)
  maxHearts: number | null;
  wave: number;
  foe: EnemyInstance;
  foeName: string;
  foeIcon: IconName;
  foeHp: number;
  foeMaxHp: number;
  totalDamage: number;
  /** Most damage dealt by one action (a Set and everything it set off) */
  biggestHit: number;
  matches: number;
  mistakes: number;
  movesLeft: number | null;
  timeLeft: number | null;
  /** Rule and weapon time gains can't push the clock past this */
  timeCap: number | null;
  /** Seconds the clock can still gain this fight (a fight can at most double its clock); null when untimed */
  timeBank: number | null;
  /** State of the trick weapons (engine/gear.ts) */
  gear: GearState;
  /** How far each held weapon has grown this fight (data/weaponGrowth.ts) */
  growth: GrowthState;
  /** Power points this fight (data/weaponPower.ts): every held weapon's Scaling feeds them, and they multiply all damage */
  power: number;
  /** Multiplier on Power accumulation (default 1; 0 disables global Power scaling in item-driven modes like Starfall Spire) */
  powerScaling?: number;
  /** When true, concurrent active Evolutions stack their ×1.5 Set multiplier multiplicatively (used by Starfall Spire) */
  stackEvolutionMultipliers?: boolean;
  /** Lab-only override: omit each active Evolution's bespoke rules/modifiers while keeping the universal chassis */
  blankEvolutionRules?: boolean;
  /** Opt-in lab telemetry: total firings per rule key (undefined in normal gameplay for zero overhead) */
  ruleFirings?: Record<string, number>;
  /** Opt-in lab telemetry: firings where every effect resolved to a no-op / 0-damage result */
  ruleZeroOps?: Record<string, number>;
  /** What weapon growth remembers between Sets */
  growthMemo: { lastSetColor: string | null; lastHintAtMs: number; plantSet: boolean };
  elapsedMs: number;
  lastMatchAtMs: number;
  /** Cards scored or missed that the UI will REPLACE shortly; nothing else touches them meanwhile */
  replacing: string[];
  /** Piñata cards whose break bounty was already folded into the Set's flat damage before multipliers (skip re-dealing on REPLACE) */
  paidPinataIds?: string[];
  /** Non-foe Set multiplier stamped onto cards ignited during a Set (cardId -> mult) */
  burnMults?: Record<string, number>;
  /** True once USE_HINT fired since the last valid Set (closes Safe Bet / off-board hint-spam exploit) */
  hintUsedThisSet?: boolean;
  /** Combo steps granted by rules/evolutions (E.combo), giving +1 Set dmg per step for non-Sly-Fox fighters */
  bonusCombo?: number;
  /** Evolution recipe id pre-loaded onto the active Catalyst card on the board (null when none or when 2+ idle recipes offer a choice) */
  catalystRecipeId?: string | null;
  /** Up to 3 randomly chosen idle armed evolution recipe ids awaiting player selection */
  evolutionPickOptions?: string[];
  /** Preserved Catalyst slot & Set multiplier for the pending evolution choice */
  evolutionPickContext?: { slot?: number; setMultiplier: number };
  coins: number;
  xp: number;
  xpLevel: number;
  pickOptions: Weapon[];
  pendingPicks: number;
  status: RunStatus;
  endReason: 'defeated' | 'survived' | 'hearts' | null;
  challengeMet: boolean;
  roundStats: RoundStats;
  events: RunEvent[];
  eventSeq: number;
  /** Everything that happened this fight, for the results-screen replay (engine/fightLog.ts) */
  log: FightLogEntry[];
  bonusDamagePerMatch: number;
  coinBonusPercent: number;
  shopOptions: Weapon[];
  rerolls: number;
  /** Weapon ids that can appear in level-up picks and shops */
  armory: string[];
  /** Level and tuning of each Armory weapon during this run */
  weaponBuilds: WeaponBuilds;

  // Fighter passives, skill nodes & rules
  /** Empty on bare levels */
  passives: PassiveId[];
  passive: PassiveState;
  /** Owned skill-node ids that are live this fight */
  skillNodes: string[];
  ruleState: Record<string, RuleRuntime>;
  /** Weapon triggers still to be doubled */
  doubleNext: number;
  /** The next Set's damage is multiplied by this (1 = normal) */
  nextSetMultiplier: number;
  /** Clock, foe, fuses and evolutions stand still */
  frozenMs: number;
  simplified: SimplifyState | null;
  /** Shading Surge state (null on levels without it) */
  surge: SurgeState | null;
  /** Sets chained inside the combo window (every fighter; Sly Fox turns it into damage) */
  combo: number;
  maxCombo: number;
  setsThisWave: number;
  freeMistakesLeft: number;

  // Arcana
  arcana: ArcanaId[];
  arcanaBurnCooldownMs: number;
  overkillDamage: number;
  /** Pending Overkill Harvest carry damage to deal immediately to the next wave foe */
  pendingOverkillCarry?: number;
  /** Damped entropy pity-bag accumulator for low-proc (<= 35%) weapon channels ([GP-19]) */
  procAccum?: Readonly<Partial<Record<string, number>>>;

  // Escalating Purity
  purityChain: number;
  lastDiffCount: number;
  maxPurityChain: number;
  purityChainsTriggered: number;
  threeStepPuritiesTriggered: number;

  // Evolutions
  unlockedEvolutions: string[];
  /** Recipes whose two weapon families are held right now */
  armedRecipes: string[];
  activeEvolutions: ActiveEvolution[];
  evolutionsTriggered: number;
  evolutionCap: number;
  /** Workshop Evolution Lab tier (feeds the likelihood) */
  evolutionLabTier: number;
  /** % chance per refill that a Catalyst appears (Rainbow refills add more) */
  evolutionLikelihood: number;
  /** Recipe ids triggered this fight (for the Recipe Guide) */
  forgedRecipes: string[];
  /** The next refill comes from a Rainbow Strike */
  rainbowRefill: boolean;

  // Hazards
  /** Cards carrying a level time bomb (their fuse is `countdownTimer`, in seconds) */
  timeBombIds: string[];
  /** Refilled cards counted toward the next trap of each kind */
  hazardRefills: { timeBombs: number; snares: number };

  // Counters for challenges, results & bounties
  colorSets: Record<Card['color'], number>;
  trapsDefused: number;
  trapsSprung: number;
  explosionsTriggered: number;
  bonusCardsMatched: number;
  levelUpsTaken: number;
  shopBuys: number;

  // Set-Parrying & Live Multiplier Ignition / Kill-Cam
  /** Live telegraphed attack & Set-Parry state (null on early onboarding / sandbox) */
  parry: ParryState | null;
  /** Total parries landed across the whole fight */
  parriesLanded: number;
  /** Total Perfect Parries landed across the whole fight */
  perfectParriesLanded: number;
  /** Snapshot of the latest player Set for Live Multiplier Ignition & Kill-Cam visuals */
  lastSetIgnition: SetIgnition | null;
  /** Per-weapon Power cadence progress (e.g. unbroken Sets for Glass Sword, full-HP streak for Life Vessel) */
  powerProgress?: Record<string, number>;
  /** Remaining cooldown (ms) on the tactical Sacrifice / Redraw action in timed fights */
  sacrificeCooldownMs?: number;
  /** True once tactical Sacrifice / Redraw has been used in the current wave (gates untimed fights) */
  sacrificeUsedThisWave?: boolean;
  /** True once a mistake reward fired since the last valid Set (caps repeatable mistake-reward farming) */
  mistakeRewardUsedThisSet?: boolean;
  /** Free 1-hit Wave-1 Pounce Shield charges (Orange Tabby Nine Lives baseline buff) */
  waveShieldLeft?: number;
  /** Optional relief / wager options active for this run */
  relief?: RunReliefOptions;
  /** Convenience flags mirrored from `relief` for telemetry & results */
  tailwindActive?: boolean;
  cauldronWager?: 0 | 1 | 2;
}
