export type Shape = 'oval' | 'squiggle' | 'diamond';
export type Color = 'red' | 'green' | 'purple';
export type Number = 1 | 2 | 3;
export type Shading = 'solid' | 'striped' | 'open';

export interface Card {
  id: string;
  shape: Shape;
  color: Color;
  number: Number;
  shading: Shading;
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
  isDud?: boolean;
  isFragile?: boolean;
  boobyTrap?: boolean;
  clover?: boolean;
  cardClear?: boolean;
  broom?: boolean;
  selfHealing?: boolean;
  timedReward?: boolean;
  timedRewardAmount?: number;
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
  // Extensible: add more reward types here
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
  'Flint' | 'Bamboo' | 'Carrot' | 'Beak' | 'Dirt' | 'Talon' | 'Hoe';

export type ItemName = 
  'Great Field' | 'Mirror Trinket' | 'Hint Booster' | 'Lucky Token' | 
  'Colorblind Goggles' | 'Crimson Lens' | 'Crystal Ball' | 'Chrono Stop' | 
  'Subtle Nudge' | 'Weapon Holster' | 'Culling Scroll' | 'Agile Treads' | 
  'Fate\'s Bargain' | 'Fractured Gains' | 'Self-Destructing Timer' | 
  'Card Cycler' | 'Team Reroll' | 'Molotov Catalyst' | 'Tempo Tuner' | 
  'Sharp Edge' | 'Fortune Map' | 'Ghost Mulligan';

export type ItemRarity = 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4';

export interface Weapon {
  name: WeaponName;
  level: number; // 1-4
  description: string;
  effects: Partial<PlayerStats>;
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
  startingWeapon: WeaponName;
  startingItems: ItemName[];
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
  mulligans: number;
  bombTimer: number;
  additionalPoints: number;
  deflectPercent: number;
  criticalChance: number;
  timeFreezePercent: number;
  timeFreezeAmount: number;
  hints: number; // Number of hints available for finding valid sets
  // Co-op specific
  hintPasses: number;
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
  
  // Roguelike properties
  round: number;
  targetScore: number;
  remainingTime: number;
  roundCompleted: boolean;
  
  // Player
  player: Player;
  
  // Shop and upgrades
  shopItems: Item[];
  levelUpOptions: (Partial<PlayerStats> | Weapon)[];
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