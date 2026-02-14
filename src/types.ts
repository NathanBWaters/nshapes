import type { IconName } from './components/Icon';
import type { EnemyInstance, EnemyOption } from './types/enemy';

export type Shape = 'oval' | 'squiggle' | 'diamond';
export type Color = 'red' | 'green' | 'purple';
export type Number = 1 | 2 | 3;
export type Shading = 'solid' | 'striped' | 'open';
export type Background = 'white' | 'beige' | 'charcoal';
export type AttributeName = 'shape' | 'color' | 'number' | 'shading' | 'background';

// Adventure mode difficulty setting (legacy - to be removed)
export type AdventureDifficulty = 'easy' | 'medium' | 'hard';

// New level-based progression system
export type LevelNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// Level completion tracking per character
export interface LevelCompletion {
  levelNumber: LevelNumber;
  characterName: string;
  completedAt: number; // Timestamp
}

// Level definition with bosses and attributes
export interface LevelDefinition {
  number: LevelNumber;
  name: string;
  description: string;
  attributes: AttributeName[];
  miniBoss: EnemyName | null; // Round 3 boss (null for tutorial level 1)
  boss: EnemyName | null;     // Round 5 boss (null for tutorial level 1)
}

// =============================================================================
// CONNECTOR WEAPON SYSTEM
// =============================================================================

/**
 * Connection between two board positions.
 * Connections persist on POSITIONS, not cards.
 * When a card at a connected position is destroyed, the card at the linked position is also destroyed.
 */
export interface BoardConnection {
  id: string;
  positionA: number; // Board index
  positionB: number; // Board index
  createdAt: number; // Timestamp
}

/**
 * Connection state for the current round.
 * Connections are cleared at the end of each round.
 */
export interface ConnectionState {
  connections: BoardConnection[];
}

// Ordered list of attributes for progressive unlock
export const ATTRIBUTE_ORDER: AttributeName[] = ['shape', 'color', 'number', 'shading', 'background'];

export interface Card {
  id: string;
  shape: Shape;
  color: Color;
  number: Number;
  shading: Shading;
  background?: Background;
  selected: boolean;
  isHint?: boolean;

  // Field card modifiers
  health?: number; // Default: 1
  lootBox?: boolean;
  bonusMoney?: number;
  bonusPoints?: number;
  fireStarter?: boolean;
  bomb?: boolean;
  bombTimer?: number;
  healing?: boolean;
  spikes?: boolean;
  isFragile?: boolean;
  boobyTrap?: boolean;
  clover?: boolean;
  cardClear?: boolean;
  broom?: boolean;
  selfHealing?: boolean;
  timedReward?: boolean;
  timedRewardAmount?: number;

  // New weapon effect states
  onFire?: boolean;         // Card is burning
  fireStartTime?: number;   // Timestamp when fire started (for 15s burn timer)

  // Enemy system card states
  isDud?: boolean;          // Card cannot be selected or matched (white/blank visual)
  isFaceDown?: boolean;     // Card shows back side, cannot be selected until flipped
  wasOriginallyFaceDown?: boolean; // Tracks if card was face-down when round started (for test tracking)
  hasCountdown?: boolean;   // Card has countdown timer that damages player when expired
  countdownTimer?: number;  // Seconds remaining on countdown
  hasBomb?: boolean;        // Card has bomb that explodes if not matched in time
}

// Rewards revealed when a card is matched
export interface CardReward {
  cardId: string;
  points?: number;
  money?: number;
  experience?: number;
  healing?: number;
  hint?: number;
  lootBox?: boolean;
  item?: string; // Future: item name/id
  timeBonus?: number; // Seconds to add to timer
  graceBonus?: number; // Graces to add
  boardGrowth?: number; // Cards to add to board
  // Weapon effect types for visual distinction
  effectType?: 'explosion' | 'laser' | 'fire' | 'grace' | 'ricochet' | 'connected';
}

export type CharacterName =
  'Orange Tabby' | 'Sly Fox' | 'Corgi' | 'Emperor Penguin' |
  'Pelican' | 'Badger' | 'Cow' | 'Tortoise' |
  'Chimp' | 'Eagle' | 'Lemur' | 'Hedgehog' |
  'Armadillo' | 'Raccoon' | 'Polar Bear' | 'Chameleon';

export type EnemyName =
  'Chihuahua' | 'Jellyfish' | 'Snake' | 'Mammoth' |
  'Rabbit' | 'Squid' | 'Porcupine' | 'Hyena' | 'Tiger';

// =============================================================================
// NEW WEAPON/PASSIVE FUSION SYSTEM TYPES
// =============================================================================

/** Weapon type: 'weapon' can fuse, 'passive' cannot */
export type WeaponType = 'weapon' | 'passive';

/** Weapon level: 1, 2, or 3 */
export type WeaponLevel = 1 | 2 | 3;

/** Fusion tier: 0 = base, 1 = Tier 1 fusion, 2 = Tier 2 fusion */
export type FusionTier = 0 | 1 | 2;

/** Base weapon names (6 weapons that can fuse) */
export type BaseWeaponName =
  'Blast Powder' | 'Flint Spark' | 'Prismatic Ray' |
  'Chaos Shard' | 'Echo Stone' | 'Link Stone';

/** Base passive names (13 passives that cannot fuse) */
export type BasePassiveName =
  'Oracle Eye' | 'Field Stone' | 'Growth Seed' | 'Second Chance' |
  'Fortune Token' | 'Life Vessel' | 'Mending Charm' | 'Crystal Orb' |
  'Seeker Lens' | 'Scholar\'s Tome' | 'Fortune\'s Favor' | 'Chrono Shard' | 'Time Drop';

/** Tier 1 fusion names (15 fusions from base weapon pairs) */
export type Tier1FusionName =
  'Infernal Charge' | 'Detonation Beam' | 'Shrapnel Storm' |
  'Resonant Blast' | 'Chain Detonator' | 'Solar Flare' |
  'Wildfire Shard' | 'Blazing Echo' | 'Burning Bonds' |
  'Prism Shatter' | 'Mirror Beam' | 'Linked Annihilation' |
  'Cascade Chaos' | 'Chaotic Web' | 'Resonant Link';

/** Tier 2 fusion names (15 legendary fusions from Tier 1 pairs) */
export type Tier2FusionName =
  'Supernova' | 'Eternal Flame' | 'Extinction Ray' |
  'Reality Fracture' | 'Infinite Echo' | 'Doom Network' |
  'Prismatic Inferno' | 'Soul Pyre' | 'Plague Fire' |
  'Quantum Entanglement' | 'Paradox Engine' | 'Grid Eraser' |
  'Scorched Earth' | 'Phoenix Storm' | 'Armageddon';

/** Legacy weapon names (for backward compatibility during migration) */
export type LegacyWeaponName =
  'Mystic Sight' | 'Chain Reaction' | 'Time Trigger Mastery' |
  'Prismatic Perfection' | 'Tabula Rasa' | 'Desperate Measures' |
  'Link Chain' | 'Soul Link' | 'Revenge Linker' |
  'Web Spinner' | 'Web Master' | 'Echo Chamber' | 'Resonance Core' |
  'Sympathetic Flames' | 'Neural Network';

/** All weapon/passive names */
export type WeaponName = BaseWeaponName | BasePassiveName | Tier1FusionName | Tier2FusionName | LegacyWeaponName;

export type ItemName =
  'Great Field' | 'Mirror Trinket' | 'Hint Booster' | 'Lucky Token' |
  'Crimson Lens' | 'Crystal Ball' | 'Chrono Stop' |
  'Subtle Nudge' | 'Weapon Holster' | 'Culling Scroll' | 'Agile Treads' |
  'Fate\'s Bargain' | 'Fractured Gains' | 'Self-Destructing Timer' |
  'Card Cycler' | 'Team Reroll' | 'Molotov Catalyst' | 'Tempo Tuner' |
  'Sharp Edge' | 'Fortune Map' | 'Ghost Grace';

export type ItemRarity = 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4';

// =============================================================================
// LEGACY TYPES (for backward compatibility during migration)
// These will be removed once migration to new Weapon system is complete
// =============================================================================

/** @deprecated Use new Weapon interface with levelEffects instead */
export type WeaponRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** @deprecated Cap system removed in new weapon system */
export type CapIncreaseType = 'echo' | 'laser' | 'graceGain' | 'explosion' | 'hint' | 'timeGain' | 'healing' | 'fire' | 'ricochet' | 'boardGrowth' | 'coinGain' | 'xpGain';

/** @deprecated Cap system removed in new weapon system */
export interface CapIncreaseEffect {
  type: CapIncreaseType;
  amount: number;
}

/** @deprecated Bridge system removed in new weapon system */
export type BridgeTriggerType =
  | 'onHeal'
  | 'onExplosion'
  | 'onTimeGain'
  | 'onDestruction'
  | 'onEcho'
  | 'onCoinGain'
  | 'onXPGain'
  | 'onGraceUse'
  | 'onHintUse'
  | 'onHealthLoss';

/** @deprecated Bridge system removed in new weapon system */
export type BridgeEffectType =
  | 'gainGrace'
  | 'triggerEcho'
  | 'heal'
  | 'fireCard'
  | 'gainHint'
  | 'gainCoin'
  | 'triggerLaser'
  | 'explosion';

/** @deprecated Bridge system removed in new weapon system */
export interface BridgeEffect {
  trigger: BridgeTriggerType;
  chance: number;
  effect: BridgeEffectType;
  amount?: number;
}

/** @deprecated Use EffectCaps type in gameConfig.ts during migration */
export interface EffectCaps {
  echo: number;
  laser: number;
  graceGain: number;
  explosion: number;
  hint: number;
  timeGain: number;
  healing: number;
  fire: number;
  ricochet: number;
  boardGrowth: number;
  coinGain: number;
  xpGain: number;
  [key: string]: number; // Index signature for Record<string, number> compatibility
}

// =============================================================================
// NEW WEAPON/PASSIVE FUSION SYSTEM TYPES
// =============================================================================

/** Effects that a weapon/passive can have at a given level */
export interface WeaponEffects {
  // Damage/destruction effects
  explosionChance?: number;
  fireSpreadChance?: number;
  laserChance?: number;
  ricochetChance?: number;
  ricochetChainChance?: number;
  echoChance?: number;
  connectionChance?: number;

  // Passive/utility effects
  autoHintChance?: number;
  autoHintInterval?: number;
  boardGrowthChance?: number;
  boardGrowthAmount?: number;
  graceGainChance?: number;
  healingChance?: number;
  hintGainChance?: number;
  xpGainChance?: number;
  coinGainChance?: number;
  timeGainChance?: number;
  timeGainAmount?: number;

  // Static bonuses
  fieldSize?: number;
  graces?: number;
  maxHealth?: number;
  health?: number;
  maxHints?: number;
  hints?: number;
  startingTime?: number;
  startingConnections?: number;

  // Fusion bonus effects (when limitation is lifted)
  explosionsIgnite?: boolean;        // Infernal Charge: explosions set cards on fire
  laserIgnites?: boolean;            // Solar Flare: laser path catches fire
  laserBothDirections?: boolean;     // Solar Flare: laser fires row AND column
  echoTriggersWeapons?: boolean;     // Resonant Blast: echo triggers weapon effects
  maxRicochets?: number;             // Override for ricochet limit
  maxConnections?: number;           // Override for connection limit
  fireAnyColor?: boolean;            // Infernal Charge: fire spreads to any color
  explosionAnyColor?: boolean;       // Detonation Beam: explosions hit any card
}

/** Level-based effects structure */
export interface LevelEffects {
  1: WeaponEffects;
  2: WeaponEffects;
  3: WeaponEffects;
}

/**
 * Legacy Weapon interface - used by existing code during migration.
 * Once migration is complete, this will be replaced by FusionWeapon.
 */
export interface Weapon {
  id: string;
  name: WeaponName | string;
  rarity: WeaponRarity;
  level: number;
  description: string;
  shortDescription: string;
  flavorText?: string;
  price: number;
  effects: Partial<PlayerStats>;
  specialEffect?: 'explosive' | 'autoHint' | 'enhancedHint' | 'boardGrowth' | 'fire' |
                  'graceGain' | 'healing' | 'hintGain' | 'xpGain' | 'coinGain' |
                  'timeGain' | 'laser' | 'ricochet' | 'echo' | 'chainReaction' |
                  'capIncrease' | 'bridge' | 'challengeLegendary' | 'connector' |
                  'revengeLinker' | 'webWeaver' | 'echoChamber' | 'sympatheticFlames' | 'neuralNetwork';
  capIncrease?: CapIncreaseEffect;
  bridgeEffect?: BridgeEffect;
  icon?: IconName;
  maxCount?: number;

  // NEW FIELDS (added for fusion system, optional during migration)
  type?: WeaponType;
  fusionTier?: FusionTier;
  fusionParents?: [string, string];
  levelEffects?: LevelEffects;
  limitation?: string;
}

/**
 * New Weapon interface for the fusion system.
 * Will replace Weapon interface once migration is complete.
 */
export interface FusionWeapon {
  id: string;
  name: WeaponName | string;
  type: WeaponType;
  level: WeaponLevel;
  fusionTier: FusionTier;
  fusionParents?: [string, string];

  description: string;
  shortDescription: string;
  flavorText?: string;

  levelEffects: LevelEffects;
  limitation?: string;

  specialEffect?: 'explosive' | 'fire' | 'laser' | 'ricochet' | 'echo' | 'connector' |
                  'autoHint' | 'boardGrowth' | 'graceGain' | 'healing' | 'hintGain' |
                  'xpGain' | 'coinGain' | 'timeGain';

  icon?: IconName;
  maxCount?: number;
}

/**
 * Fusion recipe: defines which weapons combine to create a new weapon
 */
export interface FusionRecipe {
  inputs: [string, string]; // IDs of input weapons (order doesn't matter)
  output: string;           // ID of resulting fusion weapon
  tier: 1 | 2;              // Tier 1 = base+base, Tier 2 = fusion+fusion
}

/**
 * Player inventory with 4 weapon slots and 4 passive slots
 */
export interface PlayerInventory {
  weapons: (FusionWeapon | null)[];   // Length 4
  passives: (FusionWeapon | null)[];  // Length 4
}

export interface Item {
  name: ItemName;
  description: string;
  rarity: ItemRarity;
  price: number;
  limit: number | null; // null means no limit
  effects: Partial<PlayerStats>;
  drawbacks: Partial<PlayerStats>;
  icon?: IconName;
}

export interface Enemy {
  name: EnemyName;
  description: string;
  effect: string;
  reward: string;
  icon?: IconName;
  applyEffect: (gameState: GameState) => GameState;
  applyReward: (gameState: GameState) => GameState;
}

export interface Character {
  name: CharacterName;
  description: string;
  startingWeapons: WeaponName[];
  baseStats: Partial<PlayerStats>;
  icon?: IconName;
}

export interface PlayerStats {
  level: number;
  money: number;
  experience: number;
  experienceGainPercent: number;
  luck: number;
  maxWeapons: number;
  commerce: number;
  scavengingPercent: number;
  scavengeAmount: number;
  health: number;
  maxHealth: number;
  fieldSize: number;
  freeRerolls: number;
  drawIncrease: number;
  drawIncreasePercent: number;
  chanceOfFire: number;
  explosion: number;
  damage: number;
  damagePercent: number;
  maxTimeIncrease: number;
  timeWarpPercent: number;
  matchHints: number;
  matchPossibilityHints: number;
  matchIntervalHintPercent: number;
  matchIntervalSpeed: number;
  dodgePercent: number;
  dodgeAttackBackPercent: number;
  dodgeAttackBackAmount: number;
  graces: number;
  maxGraces: number;
  bombTimer: number;
  additionalPoints: number;
  deflectPercent: number;
  criticalChance: number;
  timeFreezePercent: number;
  timeFreezeAmount: number;
  hints: number;
  maxHints: number;
  hintPasses: number;

  // Weapon effect stats
  explosionChance: number;
  autoHintChance: number;
  autoHintInterval: number;
  boardGrowthChance: number;
  boardGrowthAmount: number;
  fireSpreadChance: number;
  graceGainChance: number;
  healingChance: number;
  hintGainChance: number;
  xpGainChance: number;
  coinGainChance: number;
  timeGainChance: number;
  timeGainAmount: number;
  timeGainTriggerCap: number;
  laserChance: number;
  startingTime: number;
  ricochetChance: number;
  ricochetChainChance: number;
  enhancedHintChance: number;
  echoChance: number;
  chainReactionChance: number;

  // Connector weapon stats
  connectionChance: number;
  startingConnections: number;
  echoTimeBonusPerLink: number;
  linkedFireMultiplier: number;
  bonusConnectionChance: number;

  // Legacy field (will be removed after migration)
  /** @deprecated Cap system removed in new weapon system */
  effectCaps?: EffectCaps;
}

export interface Player {
  id: string;
  username: string;
  character: Character;
  stats: PlayerStats;
  weapons: Weapon[];
  items: Item[];
  /** New inventory system with 4 weapon + 4 passive slots (added in fusion system) */
  inventory?: PlayerInventory;
}

export interface GameState {
  // Core game
  deck: Card[];
  board: Card[];
  selectedCards: Card[];
  foundCombinations: Card[][];
  score: number;
  gameStarted: boolean;
  gameEnded: boolean;
  startTime: number | null;
  endTime: number | null;
  hintUsed: boolean;

  // Attribute scaling
  activeAttributes: AttributeName[];

  // Roguelike properties
  round: number;
  targetScore: number;
  remainingTime: number;
  roundCompleted: boolean;

  // Player
  player: Player;

  // Shop and upgrades (shop hidden but code preserved)
  shopItems: (Item | null)[];
  shopWeapons: (Weapon | null)[];
  levelUpOptions: Weapon[];
  rerollCost: number;

  // Fusion system
  fusionGemPending?: boolean;

  // Enemy
  currentEnemies: EnemyOption[];
  selectedEnemy: EnemyInstance | null;
  activeEnemyInstance: EnemyInstance | null;
  selectedEnemyReward: Weapon | null;
  selectedEnemyMoney: number | null;
  defeatedEnemies: string[];
  awardedStretchGoalWeapons: string[];

  // Loot and rewards
  lootCrates: number;

  // Co-op
  isCoOp: boolean;
  players: Player[];

  // Endless mode
  isEndlessMode: boolean;

  // Connector weapon system
  connections: BoardConnection[];

  // Round-scoped tracking
  timeGainTriggersThisRound?: number;
}
