/**
 * Adventure Mode — core types.
 *
 * Everything about the campaign is DATA (levels, mechanics, fighters, upgrades,
 * rewards). The engine reads these tables; screens render them. To redesign the
 * campaign, edit the tables in `src/adventure/data/` — not the engine.
 */

import type { WeaponBuilds, WeaponStatDef } from './data/weaponStats';
import type { AttributeName, BoardConnection, CharacterName, Card, Weapon, PlayerStats } from '@/types';
import type { EnemyInstance, RoundStats } from '@/types/enemy';
import type { IconName } from '@/components/Icon';
import type { RuleSource } from './rules/types';

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
}

/** Foe on the map: either a registered enemy (with real effects) or a cosmetic sparring foe. */
export interface FoeDef {
  /** Name of a registered enemy in enemyFactory (gives real mechanics) */
  enemy?: string;
  /** Cosmetic foe (no special effects) */
  name?: string;
  icon?: IconName;
  hp: number;
  taunt?: string;
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
  | { kind: 'bigHit'; n: number };

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
  rainbowMultiplier?: number;
  damageScale?: number;
  setTimeBonus?: number;
  rainbowTimeBonus?: number;
  timerSpeedScale?: number;
  /** A wrong Set ignites cards instead of costing a heart, at most once per cooldown */
  mistakeBurn?: { cooldownMs: number; cards: number };
  overkillCoinsPerDamage?: number;
  waveClearHeal?: number;
  xpScale?: number;
  pickOptions?: number;
  catalystChanceScale?: number;
  catalystRespawns?: number;
  evolutionBurstBonus?: { damage: number; time: number };
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
export type FeatureDestination = { screen: 'camp'; tab: 'workshop' } | { screen: 'bounties' };

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
  /**
   * Elite side branch: hangs off this main-path level on the map, needs ★★
   * there to unlock, and never blocks the main path.
   */
  branchOf?: string;
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

/** Two weapon families fused into a 20-second power state. */
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
}

// ---------------------------------------------------------------------------
// Run (one attempt at a level)
// ---------------------------------------------------------------------------

export type RunStatus = 'playing' | 'pick' | 'intermission' | 'won' | 'lost';

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
  | 'arcana_burn' | 'overkill';

export interface RunEvent {
  id: number;
  type: RunEventType;
  amount?: number;
  text?: string;
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

export interface SimplifyState {
  attribute: AttributeName;
  value: string | number;
  remainingMs: number;
}

export interface RunState {
  level: LevelDef;
  fighter: CharacterName;
  features: Set<FeatureFlag>;
  rng: number;
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
  elapsedMs: number;
  lastMatchAtMs: number;
  /** Cards scored or missed that the UI will REPLACE shortly; nothing else touches them meanwhile */
  replacing: string[];
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
  /** Sets chained inside the combo window (every fighter; Sly Fox turns it into damage) */
  combo: number;
  maxCombo: number;
  setsThisWave: number;
  freeMistakesLeft: number;

  // Arcana
  arcana: ArcanaId[];
  arcanaBurnCooldownMs: number;
  overkillDamage: number;

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
  trapsDefused: number;
  trapsSprung: number;
  explosionsTriggered: number;
  bonusCardsMatched: number;
  levelUpsTaken: number;
  shopBuys: number;
}
