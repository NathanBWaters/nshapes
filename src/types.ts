export type Shape = 'oval' | 'squiggle' | 'diamond';
export type Color = 'red' | 'green' | 'purple';
export type Number = 1 | 2 | 3;
export type Shading = 'solid' | 'striped' | 'open';
export type Background = 'white' | 'beige' | 'charcoal';
export type AttributeName = 'shape' | 'color' | 'number' | 'shading' | 'background';

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
  isHolographic?: boolean;  // 2x points when matched
  onFire?: boolean;         // Card is burning
  fireStartTime?: number;   // Timestamp when fire started (for 15s burn timer)
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
  'Blast Powder' | 'Oracle Eye' | 'Field Stone' | 'Growth Seed' |
  'Flint Spark' | 'Second Chance' | 'Fortune Token' | 'Life Vessel' |
  'Mending Charm' | 'Crystal Orb' | 'Seeker Lens' | 'Prism Glass' |
  'Chrono Shard' | 'Time Drop' | 'Prismatic Ray' | 'Chaos Shard';

export type WeaponRarity = 'common' | 'rare' | 'legendary';

export type ItemName = 
  'Great Field' | 'Mirror Trinket' | 'Hint Booster' | 'Lucky Token' | 
  'Colorblind Goggles' | 'Crimson Lens' | 'Crystal Ball' | 'Chrono Stop' | 
  'Subtle Nudge' | 'Weapon Holster' | 'Culling Scroll' | 'Agile Treads' | 
  'Fate\'s Bargain' | 'Fractured Gains' | 'Self-Destructing Timer' | 
  'Card Cycler' | 'Team Reroll' | 'Molotov Catalyst' | 'Tempo Tuner' | 
  'Sharp Edge' | 'Fortune Map' | 'Ghost Grace';

export type ItemRarity = 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4';

export interface Weapon {
  id: string; // Unique identifier for stacking
  name: WeaponName;
  rarity: WeaponRarity;
  level: number; // 1-4
  description: string; // Technical description with percentages
  shortDescription: string; // 3-8 word summary shown in lists
  flavorText?: string; // Longer fun description for weapon guide
  price: number;
  effects: Partial<PlayerStats>;
  specialEffect?: 'explosive' | 'autoHint' | 'boardGrowth' | 'fire' | 'graceGain' | 'healing' | 'hintGain' | 'holographic' | 'timeGain' | 'laser' | 'ricochet';
  icon?: string; // Icon path like "delapouite/bamboo"
}

export interface Item {
  name: ItemName;
  description: string;
  rarity: ItemRarity;
  price: number;
  limit: number | null; // null means no limit
  effects: Partial<PlayerStats>;
  drawbacks: Partial<PlayerStats>;
  icon?: string; // Icon path like "lorc/clover"
}

export interface Enemy {
  name: EnemyName;
  description: string;
  effect: string;
  reward: string;
  icon?: string; // Icon path like "lorc/jellyfish"
  applyEffect: (gameState: GameState) => GameState;
  applyReward: (gameState: GameState) => GameState;
}

export interface Character {
  name: CharacterName;
  description: string;
  startingWeapons: WeaponName[];
  baseStats: Partial<PlayerStats>;
  icon?: string; // Icon path like "lorc/cat"
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
  holoChance: number;           // % for new cards to be holographic
  timeGainChance: number;       // % to gain time on match
  timeGainAmount: number;       // seconds gained when timeGain triggers
  laserChance: number;          // % for laser to fire on match
  startingTime: number;         // additional starting time in seconds
  ricochetChance: number;       // % for initial ricochet on match
  ricochetChainChance: number;  // % for each ricochet to chain again
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
  currentEnemies: Enemy[];
  selectedEnemy: Enemy | null;
  
  // Loot and rewards
  lootCrates: number;
  
  // Co-op
  isCoOp: boolean;
  players: Player[];
} 