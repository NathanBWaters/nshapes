/**
 * Adventure Mode — core types.
 *
 * Everything about the campaign is DATA (levels, mechanics, fighters, upgrades,
 * rewards). The engine reads these tables; screens render them. To redesign the
 * campaign, edit the tables in `src/adventure/data/` — not the engine.
 */

import type { AttributeName, CharacterName, Card, Weapon, PlayerStats } from '@/types';
import type { EnemyInstance, RoundStats } from '@/types/enemy';
import type { IconName } from '@/components/Icon';

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
  | 'gear'        // fighter's weapons are active
  | 'rainbow'     // all-different sets hit twice as hard
  | 'coins'       // coins drop & bank to your purse
  | 'hints'       // hint button
  | 'graces'      // near-miss forgiveness
  | 'xp'          // in-level level-ups: pick a weapon
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
  /** In-run coach mark shown the first time it happens (keyed by run event) */
  coachMark?: { on: RunEventType; text: string };
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
  modifiers?: Partial<Pick<Card, 'isDud' | 'isFaceDown' | 'health' | 'hasCountdown' | 'countdownTimer' | 'hasBomb' | 'bombTimer' | 'onFire' | 'bonusMoney'>>;
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export type BiomeId = 'meadow' | 'woods' | 'canyon' | 'peaks';

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
  | { kind: 'enemy' };   // use the registered enemy's own defeat condition

export interface RewardDef {
  coins?: number;
  /** Weapon ids added to the Armory (shop / level-up pool) */
  weapons?: string[];
  character?: CharacterName;
}

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
}

export interface LevelDef {
  id: string;            // e.g. "1-3"
  index: number;         // global order, 0-based
  biome: BiomeId;
  name: string;
  /** The ONE new thing this level teaches */
  introduces: string;    // mechanic id
  rules: LevelRules;
  /** One or more foes. More than one = waves. */
  foes: FoeDef[];
  challenge: ChallengeDef;
  /** Coin multiplier — harder levels pay more */
  coinMultiplier: number;
  /** 1-5 skulls shown on the preview */
  difficulty: 1 | 2 | 3 | 4 | 5;
  rewards: { star1: RewardDef; star2: RewardDef; star3: RewardDef };
  isBoss?: boolean;
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
  blurb: string;
  /** Weapon ids by character level (index 0 = level 1). */
  loadouts: string[][];
  /** Extra base stats at each level (cumulative is computed). */
  perks: Array<Partial<PlayerStats> | null>;
  perkText: Array<string | null>;
}

export interface UpgradeDef {
  id: string;
  name: string;
  icon: IconName;
  description: (tier: number) => string;
  costs: number[];       // cost for tier 1..N
  apply: (stats: PlayerStats, tier: number, ctx: { timed: boolean }) => PlayerStats;
  /** Bonus damage per match etc. that is not a PlayerStats field */
  bonusDamage?: (tier: number) => number;
  coinBonusPercent?: (tier: number) => number;
}

// ---------------------------------------------------------------------------
// Save data
// ---------------------------------------------------------------------------

export interface AdventureSave {
  version: 1;
  coins: number;
  lifetimeCoins: number;
  stars: Record<string, number>;     // levelId -> best stars (0-3)
  plays: Record<string, number>;     // levelId -> attempts
  fighterLevels: Record<string, number>;
  unlockedFighters: CharacterName[];
  armory: string[];                  // unlocked weapon ids
  upgrades: Record<string, number>;  // upgrade id -> tier
  seenMechanics: string[];
  seenCoachMarks: string[];
  selectedFighter: CharacterName;
  lastLevelId: string | null;
  musicOn: boolean;
}

// ---------------------------------------------------------------------------
// Run (one attempt at a level)
// ---------------------------------------------------------------------------

export type RunStatus = 'playing' | 'pick' | 'intermission' | 'won' | 'lost';

export type RunEventType =
  | 'hit' | 'rainbow' | 'heal' | 'hurt' | 'grace' | 'coins' | 'levelup'
  | 'foe_defeated' | 'wave' | 'regen' | 'dud' | 'face_down' | 'countdown'
  | 'bomb' | 'triple' | 'shuffle' | 'attr_shift' | 'card_removed' | 'time_stolen'
  | 'inactivity' | 'fire' | 'hint' | 'mistake' | 'time_up' | 'moves_out'
  // fighter abilities
  | 'nine_lives' | 'combo' | 'grudge' | 'grudge_release' | 'ability_ready' | 'freeze' | 'redeal' | 'scoop';

export interface AbilityState {
  id: import('./data/abilities').AbilityId;
  /** active abilities: Sets banked toward the next use */
  charge: number;
  max: number;
  /** Nine Lives used this fight */
  spent: boolean;
  combo: number;
  grudge: number;
  frozenMs: number;
  /** ids of cards Big Scoop just matched (UI schedules their replacement) */
  scooped: string[];
}

export interface RunEvent {
  id: number;
  type: RunEventType;
  amount?: number;
  text?: string;
}

export interface RunState {
  level: LevelDef;
  fighter: CharacterName;
  features: Set<FeatureFlag>;
  rng: number;
  attributes: AttributeName[];
  deck: Card[];
  board: Card[];
  stats: PlayerStats;           // baked totals (base + gear + upgrades)
  weapons: Weapon[];            // for laser rolls & inventory display
  hearts: number | null;        // null = infinite (very first level)
  maxHearts: number | null;
  wave: number;
  foe: EnemyInstance;
  foeName: string;
  foeIcon: IconName;
  foeHp: number;
  foeMaxHp: number;
  totalDamage: number;
  matches: number;
  mistakes: number;
  movesLeft: number | null;
  timeLeft: number | null;
  elapsedMs: number;
  lastMatchAtMs: number;
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
  /** Fighter signature ability (null before gear is taught at 1-4) */
  ability: AbilityState | null;
}

export interface LevelResult {
  levelId: string;
  stars: number;
  coins: number;
  won: boolean;
  defeated: boolean;
}
