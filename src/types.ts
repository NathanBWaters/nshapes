import type { IconName } from './components/Icon';
import type { EnemyInstance } from './types/enemy';

export type Shape = 'oval' | 'squiggle' | 'diamond';
export type Color = 'red' | 'green' | 'purple';
export type Number = 1 | 2 | 3;
export type Shading = 'solid' | 'striped' | 'open';
export type Background = 'white' | 'beige' | 'charcoal';
export type AttributeName = 'shape' | 'color' | 'number' | 'shading' | 'background';

// Adventure mode difficulty setting
export type AdventureDifficulty = 'easy' | 'medium' | 'hard';

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
  effectType?: 'explosion' | 'laser' | 'fire' | 'grace' | 'ricochet';
}

export type CharacterName =
  'Orange Tabby' | 'Sly Fox' | 'Corgi' | 'Emperor Penguin' |
  'Pelican' | 'Badger' | 'Cow' | 'Tortoise' |
  'Chimp' | 'Eagle' | 'Lemur' | 'Hedgehog' |
  'Armadillo' | 'Raccoon' | 'Polar Bear' | 'Chameleon';

export type EnemyName =
  'Chihuahua' | 'Jellyfish' | 'Snake' | 'Mammoth' |
  'Rabbit' | 'Squid' | 'Porcupine' | 'Hyena' | 'Tiger';

export type WeaponName =
  'Blast Powder' | 'Oracle Eye' | 'Mystic Sight' | 'Field Stone' | 'Growth Seed' |
  'Flint Spark' | 'Second Chance' | 'Fortune Token' | 'Life Vessel' |
  'Mending Charm' | 'Crystal Orb' | 'Seeker Lens' | 'Scholar\'s Tome' | 'Fortune\'s Favor' |
  'Chrono Shard' | 'Time Drop' | 'Prismatic Ray' | 'Chaos Shard' |
  'Echo Stone' | 'Chain Reaction';

export type WeaponRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type ItemName =
  'Great Field' | 'Mirror Trinket' | 'Hint Booster' | 'Lucky Token' |
  'Colorblind Goggles' | 'Crimson Lens' | 'Crystal Ball' | 'Chrono Stop' |
  'Subtle Nudge' | 'Weapon Holster' | 'Culling Scroll' | 'Agile Treads' |
  'Fate\'s Bargain' | 'Fractured Gains' | 'Self-Destructing Timer' |
  'Card Cycler' | 'Team Reroll' | 'Molotov Catalyst' | 'Tempo Tuner' |
  'Sharp Edge' | 'Fortune Map' | 'Ghost Grace';

export type ItemRarity = 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4';

// Cap increase effect types - must match EffectCapType in gameConfig.ts
export type CapIncreaseType = 'echo' | 'laser' | 'graceGain' | 'explosion' | 'hint' | 'timeGain' | 'healing' | 'fire' | 'ricochet' | 'boardGrowth' | 'coinGain' | 'xpGain';

export interface CapIncreaseEffect {
  type: CapIncreaseType;
  amount: number;
}

// Bridge effect trigger types - when X happens, there's a chance to trigger Y
export type BridgeTriggerType =
  | 'onHeal'           // When player heals
  | 'onExplosion'      // When explosion destroys cards
  | 'onTimeGain'       // When time is gained
  | 'onDestruction'    // When any card is destroyed (fire, laser, explosion)
  | 'onEcho'           // When echo triggers
  | 'onCoinGain'       // When coins are gained
  | 'onXPGain'         // When XP is gained
  | 'onGraceUse'       // When grace prevents health loss
  | 'onHintUse'        // When hint is used
  | 'onHealthLoss';    // When player loses health

// Bridge effect result types - what happens when triggered
export type BridgeEffectType =
  | 'makeHolographic'  // Make random card(s) holographic
  | 'gainGrace'        // Gain grace
  | 'triggerEcho'      // Trigger echo match
  | 'heal'             // Heal HP
  | 'fireCard'         // Set random card on fire
  | 'gainHint'         // Gain hint
  | 'gainCoin'         // Gain coins
  | 'triggerLaser'     // Fire a laser
  | 'explosion';       // Trigger explosion

export interface BridgeEffect {
  trigger: BridgeTriggerType;
  chance: number;        // Percentage (0-100)
  effect: BridgeEffectType;
  amount?: number;       // Amount for effects that need it (heal, coins, etc.)
}

export interface Weapon {
  id: string; // Unique identifier for stacking
  name: WeaponName | string; // Allow string for new weapon names
  rarity: WeaponRarity;
  level: number; // 1-4
  description: string; // Technical description with percentages
  shortDescription: string; // 3-8 word summary shown in lists
  flavorText?: string; // Longer fun description for weapon guide
  price: number;
  effects: Partial<PlayerStats>;
  specialEffect?: 'explosive' | 'autoHint' | 'enhancedHint' | 'boardGrowth' | 'fire' | 'graceGain' | 'healing' | 'hintGain' | 'xpGain' | 'coinGain' | 'timeGain' | 'laser' | 'ricochet' | 'echo' | 'chainReaction' | 'capIncrease' | 'bridge';
  capIncrease?: CapIncreaseEffect; // When acquired, increases the cap for an effect type
  bridgeEffect?: BridgeEffect; // Cross-system trigger: when X happens, Y% chance to cause Z
  icon?: IconName; // Icon path like "delapouite/bamboo" - must be in ICON_REGISTRY
  maxCount?: number; // Maximum number of this weapon that can be owned (e.g., 1 for unique legendaries)
}

export interface Item {
  name: ItemName;
  description: string;
  rarity: ItemRarity;
  price: number;
  limit: number | null; // null means no limit
  effects: Partial<PlayerStats>;
  drawbacks: Partial<PlayerStats>;
  icon?: IconName; // Icon path like "lorc/clover" - must be in ICON_REGISTRY
}

export interface Enemy {
  name: EnemyName;
  description: string;
  effect: string;
  reward: string;
  icon?: IconName; // Icon path like "lorc/jellyfish" - must be in ICON_REGISTRY
  applyEffect: (gameState: GameState) => GameState;
  applyReward: (gameState: GameState) => GameState;
}

export interface Character {
  name: CharacterName;
  description: string;
  startingWeapons: WeaponName[];
  baseStats: Partial<PlayerStats>;
  icon?: IconName; // Icon path like "lorc/cat" - must be in ICON_REGISTRY
}

export interface PlayerStats {
  level: number;
  money: number;
  experience: number; // Total accumulated experience points
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
  holographicPercent: number;
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
  maxGraces: number; // Maximum graces player can hold
  bombTimer: number;
  additionalPoints: number;
  deflectPercent: number;
  criticalChance: number;
  timeFreezePercent: number;
  timeFreezeAmount: number;
  hints: number; // Number of hints available for finding valid sets
  maxHints: number; // Maximum hints player can hold
  // Co-op specific
  hintPasses: number;

  // New weapon effect stats
  explosionChance: number;      // % to explode adjacent cards on match
  autoHintChance: number;       // % for auto-hint to trigger each interval
  autoHintInterval: number;     // ms between auto-hint checks (default 10000)
  boardGrowthChance: number;    // % for board to grow on match
  boardGrowthAmount: number;    // how many cards to add when board grows
  fireSpreadChance: number;     // % for fire to start on adjacent cards
  graceGainChance: number;      // % to gain grace on match
  healingChance: number;        // % to heal on match
  hintGainChance: number;       // % to gain hint on match
  xpGainChance: number;         // % to gain +1 XP on match
  coinGainChance: number;       // % to gain +1 coin on match
  timeGainChance: number;       // % to gain time on match
  timeGainAmount: number;       // seconds gained when timeGain triggers
  laserChance: number;          // % for laser to fire on match
  startingTime: number;         // additional starting time in seconds
  ricochetChance: number;       // % for initial ricochet on match
  ricochetChainChance: number;  // % for each ricochet to chain again
  enhancedHintChance: number;   // % chance for autohint to show 2 cards instead of 1
  echoChance: number;           // % chance to auto-match another set on player match
  chainReactionChance: number;  // % chance for echo to trigger twice (2 additional matches)

  // Effect cap system - tracks player's current caps for each effect type
  // Caps can be increased by acquiring Cap Increaser weapons
  effectCaps?: EffectCaps;
}

// Interface for tracking effect cap increases per effect type
export interface EffectCaps {
  echo: number;           // Current cap for echo chance
  laser: number;          // Current cap for laser chance
  graceGain: number;      // Current cap for grace gain chance
  explosion: number;      // Current cap for explosion chance
  hint: number;           // Current cap for hint gain chance
  timeGain: number;       // Current cap for time gain chance
  healing: number;        // Current cap for healing chance
  fire: number;           // Current cap for fire spread chance
  ricochet: number;       // Current cap for ricochet chance
  boardGrowth: number;    // Current cap for board growth chance
  coinGain: number;       // Current cap for coin gain chance
  xpGain: number;         // Current cap for XP gain chance
}

export interface Player {
  id: string;
  username: string;
  character: Character;
  stats: PlayerStats;
  weapons: Weapon[];
  items: Item[];
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

  // Shop and upgrades
  shopItems: (Item | null)[];  // null represents a sold/empty slot
  shopWeapons: (Weapon | null)[];  // Weapon shop items
  levelUpOptions: Weapon[];  // Now weapons only
  rerollCost: number;

  // Enemy
  currentEnemies: EnemyInstance[];  // Enemies to choose from (from registry)
  selectedEnemy: EnemyInstance | null;  // The enemy selected for this round
  activeEnemyInstance: EnemyInstance | null;  // Active enemy for current round (same as selectedEnemy)

  // Loot and rewards
  lootCrates: number;

  // Co-op
  isCoOp: boolean;
  players: Player[];

  // Endless mode
  isEndlessMode: boolean;
}
