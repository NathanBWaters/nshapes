import { Character, Enemy, Item, Weapon, PlayerStats, GameState, Player, WeaponRarity, WeaponName } from '../types';
import { STARTING_STATS, WEAPON_SYSTEM } from './gameConfig';

// Default player stats - uses values from gameConfig for easy tweaking
export const DEFAULT_PLAYER_STATS: PlayerStats = {
  level: 0,
  money: STARTING_STATS.money,
  experience: 0,
  experienceGainPercent: 100,
  luck: 0,
  maxWeapons: 99, // Effectively unlimited for new weapon system
  commerce: 0,
  scavengingPercent: 0,
  scavengeAmount: 1,
  health: STARTING_STATS.health,
  maxHealth: STARTING_STATS.maxHealth,
  fieldSize: STARTING_STATS.fieldSize,
  freeRerolls: STARTING_STATS.freeRerolls,
  drawIncrease: 0,
  drawIncreasePercent: 0,
  chanceOfFire: 0,
  explosion: 0,
  damage: 1,
  damagePercent: 0,
  holographicPercent: 0,
  maxTimeIncrease: 0,
  timeWarpPercent: 0,
  matchHints: 0,
  matchPossibilityHints: 0,
  matchIntervalHintPercent: 0,
  matchIntervalSpeed: 15,
  dodgePercent: 0,
  dodgeAttackBackPercent: 0,
  dodgeAttackBackAmount: 1,
  graces: STARTING_STATS.graces,
  maxGraces: STARTING_STATS.maxGraces,
  bombTimer: 20,
  additionalPoints: 0,
  deflectPercent: 0,
  criticalChance: 0,
  timeFreezePercent: 0,
  timeFreezeAmount: 15,
  hints: STARTING_STATS.hints,
  maxHints: STARTING_STATS.maxHints,
  // Co-op specific
  hintPasses: 0,

  // New weapon effect stats
  explosionChance: STARTING_STATS.explosionChance,
  autoHintChance: STARTING_STATS.autoHintChance,
  autoHintInterval: STARTING_STATS.autoHintInterval,
  boardGrowthChance: STARTING_STATS.boardGrowthChance,
  boardGrowthAmount: STARTING_STATS.boardGrowthAmount,
  fireSpreadChance: STARTING_STATS.fireSpreadChance,
  graceGainChance: STARTING_STATS.graceGainChance,
  healingChance: STARTING_STATS.healingChance,
  hintGainChance: STARTING_STATS.hintGainChance,
  holoChance: STARTING_STATS.holoChance,
  timeGainChance: STARTING_STATS.timeGainChance,
  timeGainAmount: STARTING_STATS.timeGainAmount,
  laserChance: STARTING_STATS.laserChance,
  startingTime: STARTING_STATS.startingTime,
  ricochetChance: STARTING_STATS.ricochetChance,
  ricochetChainChance: STARTING_STATS.ricochetChainChance,
  enhancedHintChance: STARTING_STATS.enhancedHintChance,
};

// Characters
export const CHARACTERS: Character[] = [
  {
    name: 'Orange Tabby',
    description: 'Nine lives? More like eleven with all those extra hearts',
    startingWeapons: ['Life Vessel', 'Mending Charm'],
    icon: 'lorc/cat',
    baseStats: {}
  },
  {
    name: 'Sly Fox',
    description: 'Where there\'s smoke, there\'s this fox causing chaos',
    startingWeapons: ['Flint Spark', 'Blast Powder'],
    icon: 'caro-asercion/fox',
    baseStats: {}
  },
  {
    name: 'Corgi',
    description: 'Needs more space to zoom around. Much more space.',
    startingWeapons: ['Field Stone', 'Growth Seed'],
    icon: 'delapouite/sitting-dog',
    baseStats: {}
  },
  {
    name: 'Emperor Penguin',
    description: 'Wise ruler with oracle-like vision from the frozen throne',
    startingWeapons: ['Crystal Orb', 'Seeker Lens'],
    icon: 'delapouite/penguin',
    baseStats: {}
  },
  {
    name: 'Pelican',
    description: 'Spots every pattern from a mile away',
    startingWeapons: ['Oracle Eye', 'Oracle Eye'],
    icon: 'delapouite/eating-pelican',
    baseStats: {}
  },
  {
    name: 'Badger',
    description: 'Too stubborn to quit - always has another chance',
    startingWeapons: ['Second Chance', 'Fortune Token'],
    icon: 'caro-asercion/badger',
    baseStats: {}
  },
  // {
  //   name: 'Cow',
  //   description: 'Healing-focused character',
  //   startingWeapon: 'Bamboo',
  //   startingItems: [],
  //   baseStats: {
  //     maxHealth: 1, // +1 max HP
  //     health: 1, // +1 starting healing
  //     damage: -0.15, // -15% damage
  //   }
  // },
  // {
  //   name: 'Tortoise',
  //   description: 'Time-focused with slower time passage',
  //   startingWeapon: 'Carrot',
  //   startingItems: [],
  //   baseStats: {
  //     timeWarpPercent: 10, // Time moves 1.1× slower
  //     // All time-based bonuses are 25% more potent
  //     additionalPoints: -30, // -30% points at the end of each round
  //   }
  // },
  // {
  //   name: 'Chimp',
  //   description: 'Can hold more weapons',
  //   startingWeapon: 'Bamboo',
  //   startingItems: [],
  //   baseStats: {
  //     maxWeapons: 1, // +1 weapon slot (4 total)
  //     // Shop prices are +20%
  //   }
  // },
  // {
  //   name: 'Eagle',
  //   description: 'Can remove duds from the field',
  //   startingWeapon: 'Talon',
  //   startingItems: [],
  //   baseStats: {
  //     // 25% chance on each successful match to permanently remove 1 Dud card
  //     maxHealth: -1, // -1 starting max HP
  //   }
  // },
  // {
  //   name: 'Lemur',
  //   description: 'Gets cheaper rerolls',
  //   startingWeapon: 'Dirt',
  //   startingItems: [],
  //   baseStats: {
  //     // Reroll cost is halved
  //     luck: -10, // -10 starting Luck
  //   }
  // },
  // {
  //   name: 'Hedgehog',
  //   description: 'Can automatically destroy spikes',
  //   startingWeapon: 'Flint',
  //   startingItems: [],
  //   baseStats: {
  //     // Luck-scaled chance to destroy Spikes cards
  //     maxHealth: -1, // Starts with only 2 max HP
  //   }
  // },
  // {
  //   name: 'Armadillo',
  //   description: 'Deflects damage back to cards',
  //   startingWeapon: 'Bamboo',
  //   startingItems: [],
  //   baseStats: {
  //     deflectPercent: 20, // +20% Deflect chance
  //     maxHealth: -2, // -2 initial max HP
  //   }
  // },
  // {
  //   name: 'Raccoon',
  //   description: 'Gets more crates but starts with duds',
  //   startingWeapon: 'Dirt',
  //   startingItems: [],
  //   baseStats: {
  //     // +5% chance that a match will drop a small crate
  //     // deck starts with 10 duds
  //   }
  // },
  // {
  //   name: 'Polar Bear',
  //   description: 'Can freeze a row of cards to add time',
  //   startingWeapon: 'Carrot',
  //   startingItems: [],
  //   baseStats: {
  //     // Once per round, "freeze" a row of cards for +10s to the timer
  //     freeRerolls: -1, // -1 free reroll permanently
  //   }
  // },
  // {
  //   name: 'Chameleon',
  //   description: 'Better chance of transforming field cards',
  //   startingWeapon: 'Beak',
  //   startingItems: [],
  //   baseStats: {
  //     // Cards that can transform field cards have an additional 30% chance of activating
  //     graces: -2,
  //     matchHints: -2,
  //   }
  // },
];

// Enemies
export const ENEMIES: Enemy[] = [
  {
    name: 'Chihuahua',
    description: 'If you draw a card with only 1 shape or 1 color, the field-draw stops immediately',
    effect: 'Stops field draw on single shape/color cards',
    reward: 'Permanently +1 Field Size if defeated',
    icon: 'delapouite/jumping-dog',
    applyEffect: (gameState: GameState): GameState => {
      // Implementation would restrict the draw logic when a card with number 1 is drawn
      return gameState;
    },
    applyReward: (gameState: GameState): GameState => {
      return {
        ...gameState,
        player: {
          ...gameState.player,
          stats: {
            ...gameState.player.stats,
            fieldSize: gameState.player.stats.fieldSize + 1
          }
        }
      };
    }
  },
  {
    name: 'Jellyfish',
    description: '50% chance of +1 extra damage taken whenever you\'re hurt',
    effect: 'Increases damage received',
    reward: '+1 max HP permanently if defeated',
    icon: 'lorc/jellyfish',
    applyEffect: (gameState: GameState): GameState => {
      // Implementation would add a 50% chance to increase damage taken
      return gameState;
    },
    applyReward: (gameState: GameState): GameState => {
      return {
        ...gameState,
        player: {
          ...gameState.player,
          stats: {
            ...gameState.player.stats,
            maxHealth: gameState.player.stats.maxHealth + 1,
            health: gameState.player.stats.health + 1
          }
        }
      };
    }
  },
  {
    name: 'Snake',
    description: 'Lose your bottom row of the field',
    effect: 'Reduces available field space',
    reward: '+1 Field Size permanently if defeated',
    icon: 'lorc/snake',
    applyEffect: (gameState: GameState): GameState => {
      // Implementation would reduce the active field size
      return {
        ...gameState,
        player: {
          ...gameState.player,
          stats: {
            ...gameState.player.stats,
            fieldSize: gameState.player.stats.fieldSize - (Math.sqrt(gameState.player.stats.fieldSize) || 3)
          }
        }
      };
    },
    applyReward: (gameState: GameState): GameState => {
      return {
        ...gameState,
        player: {
          ...gameState.player,
          stats: {
            ...gameState.player.stats,
            fieldSize: gameState.player.stats.fieldSize + 1
          }
        }
      };
    }
  },
  // Add the remaining enemies following the pattern above
  {
    name: 'Mammoth',
    description: '10% of drawn cards have +1 HP',
    effect: 'Increases card health',
    reward: '10% chance to heal +1 each time you match for the rest of the game',
    icon: 'delapouite/mammoth',
    applyEffect: (gameState: GameState): GameState => {
      // Implementation would add health to 10% of cards
      return gameState;
    },
    applyReward: (gameState: GameState): GameState => {
      // Implementation would add a 10% healing chance on matches
      return gameState;
    }
  },
  {
    name: 'Rabbit',
    description: 'Time moves 1.2× faster',
    effect: 'Speeds up time',
    reward: 'Time now moves 1.1× slower after victory',
    icon: 'delapouite/rabbit',
    applyEffect: (gameState: GameState): GameState => {
      return {
        ...gameState,
        player: {
          ...gameState.player,
          stats: {
            ...gameState.player.stats,
            timeWarpPercent: gameState.player.stats.timeWarpPercent - 20
          }
        }
      };
    },
    applyReward: (gameState: GameState): GameState => {
      return {
        ...gameState,
        player: {
          ...gameState.player,
          stats: {
            ...gameState.player.stats,
            timeWarpPercent: gameState.player.stats.timeWarpPercent + 10
          }
        }
      };
    }
  },
  // Complete the implementation for remaining enemies
];

// Weapon system - 15 types × 3 rarities = 45 weapons
export const WEAPONS: Weapon[] = [
  // ============================================================================
  // 1. BLAST POWDER - Explosive adjacent cards on match
  // ============================================================================
  {
    id: 'blast-powder-common',
    name: 'Blast Powder',
    rarity: 'common',
    level: 1,
    price: 8,
    description: '10% chance to explode adjacent cards on match.',
    shortDescription: 'May explode adjacent cards on match',
    flavorText: 'After matching, each adjacent card (up/down/left/right) has a chance to explode. Exploded cards are destroyed and award +1 point and +1 coin each.',
    icon: 'lorc/bright-explosion',
    specialEffect: 'explosive',
    effects: { explosionChance: 10 }
  },
  {
    id: 'blast-powder-rare',
    name: 'Blast Powder',
    rarity: 'rare',
    level: 1,
    price: 16,
    description: '30% chance to explode adjacent cards on match.',
    shortDescription: 'May explode adjacent cards on match',
    flavorText: 'After matching, each adjacent card (up/down/left/right) has a chance to explode. Exploded cards are destroyed and award +1 point and +1 coin each.',
    icon: 'lorc/bright-explosion',
    specialEffect: 'explosive',
    effects: { explosionChance: 30 }
  },
  {
    id: 'blast-powder-legendary',
    name: 'Blast Powder',
    rarity: 'legendary',
    level: 1,
    price: 24,
    description: '70% chance to explode adjacent cards on match.',
    shortDescription: 'May explode adjacent cards on match',
    flavorText: 'After matching, each adjacent card (up/down/left/right) has a chance to explode. Exploded cards are destroyed and award +1 point and +1 coin each.',
    icon: 'lorc/bright-explosion',
    specialEffect: 'explosive',
    effects: { explosionChance: 70 }
  },

  // ============================================================================
  // 2. ORACLE EYE - Auto-hint system
  // ============================================================================
  {
    id: 'oracle-eye-common',
    name: 'Oracle Eye',
    rarity: 'common',
    level: 1,
    price: 6,
    description: '15% chance to reveal 1 card from a valid set 15s after match.',
    shortDescription: 'Hint when stuck',
    flavorText: 'After 15 seconds without a match, has a chance to highlight one card guaranteed to be part of a valid set. You still need to find the other two!',
    icon: 'lorc/sheikah-eye',
    specialEffect: 'autoHint',
    effects: { autoHintChance: 15 }
  },
  {
    id: 'oracle-eye-rare',
    name: 'Oracle Eye',
    rarity: 'rare',
    level: 1,
    price: 12,
    description: '45% chance to reveal 1 card from a valid set 10s after match.',
    shortDescription: 'Hint when stuck',
    flavorText: 'After 10 seconds without a match, has a chance to highlight one card guaranteed to be part of a valid set. You still need to find the other two!',
    icon: 'lorc/sheikah-eye',
    specialEffect: 'autoHint',
    effects: { autoHintChance: 45, autoHintInterval: 5000 }
  },
  {
    id: 'oracle-eye-legendary',
    name: 'Oracle Eye',
    rarity: 'legendary',
    level: 1,
    price: 18,
    description: 'Reveals 1 card from a valid set 5s after match.',
    shortDescription: 'Hint when stuck',
    flavorText: 'After 5 seconds without a match, automatically highlights one card guaranteed to be part of a valid set. You still need to find the other two!',
    icon: 'lorc/sheikah-eye',
    specialEffect: 'autoHint',
    effects: { autoHintChance: 100, autoHintInterval: 10000 }
  },

  // ============================================================================
  // 2.5. MYSTIC SIGHT - Enhanced autohint reveals (legendary only)
  // ============================================================================
  {
    id: 'mystic-sight-legendary',
    name: 'Mystic Sight',
    rarity: 'legendary',
    level: 1,
    price: 25,
    description: '33% chance for autohint to reveal 2 cards from a valid set instead of 1.',
    shortDescription: 'Autohint may show extra card',
    flavorText: 'Occasionally grants deeper insight during auto-hints, revealing a second card guaranteed to be part of the valid set. Makes finding matches easier!',
    icon: 'lorc/third-eye',
    specialEffect: 'enhancedHint',
    effects: { enhancedHintChance: 33 },
    maxCount: 1  // Unique - only one can be owned
  },

  // ============================================================================
  // 3. FIELD STONE - Starting board size
  // ============================================================================
  {
    id: 'field-stone-common',
    name: 'Field Stone',
    rarity: 'common',
    level: 1,
    price: 7,
    description: '+1 starting board size.',
    shortDescription: 'Larger starting board',
    flavorText: 'Start each round with more cards on the board. More cards means more possible matches to find.',
    icon: 'lorc/field',
    effects: { fieldSize: 1 }
  },
  {
    id: 'field-stone-rare',
    name: 'Field Stone',
    rarity: 'rare',
    level: 1,
    price: 14,
    description: '+3 starting board size.',
    shortDescription: 'Larger starting board',
    flavorText: 'Start each round with more cards on the board. More cards means more possible matches to find.',
    icon: 'lorc/field',
    effects: { fieldSize: 3 }
  },
  {
    id: 'field-stone-legendary',
    name: 'Field Stone',
    rarity: 'legendary',
    level: 1,
    price: 21,
    description: '+7 starting board size.',
    shortDescription: 'Larger starting board',
    flavorText: 'Start each round with more cards on the board. More cards means more possible matches to find.',
    icon: 'lorc/field',
    effects: { fieldSize: 7 }
  },

  // ============================================================================
  // 4. GROWTH SEED - Board grows on match
  // ============================================================================
  {
    id: 'growth-seed-common',
    name: 'Growth Seed',
    rarity: 'common',
    level: 1,
    price: 6,
    description: '5% chance to expand board on match.',
    shortDescription: 'Board expands on match',
    flavorText: 'After matching, has a chance to add new cards to the board. A growing board gives you more options and potential matches.',
    icon: 'delapouite/card-exchange',
    specialEffect: 'boardGrowth',
    effects: { boardGrowthChance: 5 }
  },
  {
    id: 'growth-seed-rare',
    name: 'Growth Seed',
    rarity: 'rare',
    level: 1,
    price: 12,
    description: '15% chance to expand board on match.',
    shortDescription: 'Board expands on match',
    flavorText: 'After matching, has a chance to add new cards to the board. A growing board gives you more options and potential matches.',
    icon: 'delapouite/card-exchange',
    specialEffect: 'boardGrowth',
    effects: { boardGrowthChance: 15 }
  },
  {
    id: 'growth-seed-legendary',
    name: 'Growth Seed',
    rarity: 'legendary',
    level: 1,
    price: 18,
    description: '35% chance to expand board by 2 on match.',
    shortDescription: 'Board expands on match',
    flavorText: 'After matching, has a chance to add new cards to the board. A growing board gives you more options and potential matches.',
    icon: 'delapouite/card-exchange',
    specialEffect: 'boardGrowth',
    effects: { boardGrowthChance: 35, boardGrowthAmount: 2 }
  },

  // ============================================================================
  // 5. FLINT SPARK - Fire starter
  // ============================================================================
  {
    id: 'flint-spark-common',
    name: 'Flint Spark',
    rarity: 'common',
    level: 1,
    price: 8,
    description: '10% chance to start fire on adjacent cards.',
    shortDescription: 'May ignite adjacent cards',
    flavorText: 'After matching, adjacent cards may catch fire. Burning cards are destroyed after 7.5 seconds, awarding points. Fire has a 10% chance to spread to neighbors when a card burns out.',
    icon: 'lorc/campfire',
    specialEffect: 'fire',
    effects: { fireSpreadChance: 10 }
  },
  {
    id: 'flint-spark-rare',
    name: 'Flint Spark',
    rarity: 'rare',
    level: 1,
    price: 16,
    description: '30% chance to start fire on adjacent cards.',
    shortDescription: 'May ignite adjacent cards',
    flavorText: 'After matching, adjacent cards may catch fire. Burning cards are destroyed after 7.5 seconds, awarding points. Fire has a 10% chance to spread to neighbors when a card burns out.',
    icon: 'lorc/campfire',
    specialEffect: 'fire',
    effects: { fireSpreadChance: 30 }
  },
  {
    id: 'flint-spark-legendary',
    name: 'Flint Spark',
    rarity: 'legendary',
    level: 1,
    price: 24,
    description: '70% chance to start fire on adjacent cards.',
    shortDescription: 'May ignite adjacent cards',
    flavorText: 'After matching, adjacent cards may catch fire. Burning cards are destroyed after 7.5 seconds, awarding points. Fire has a 10% chance to spread to neighbors when a card burns out.',
    icon: 'lorc/campfire',
    specialEffect: 'fire',
    effects: { fireSpreadChance: 70 }
  },

  // ============================================================================
  // 6. SECOND CHANCE - Starting graces
  // ============================================================================
  {
    id: 'second-chance-common',
    name: 'Second Chance',
    rarity: 'common',
    level: 1,
    price: 5,
    description: '+1 starting grace.',
    shortDescription: 'Extra starting graces',
    flavorText: 'Graces save you when you pick a near-miss (only 1 attribute wrong). Instead of losing health, the grace is consumed and the cards are removed.',
    icon: 'lorc/clover',
    effects: { graces: 1 }
  },
  {
    id: 'second-chance-rare',
    name: 'Second Chance',
    rarity: 'rare',
    level: 1,
    price: 10,
    description: '+3 starting graces.',
    shortDescription: 'Extra starting graces',
    flavorText: 'Graces save you when you pick a near-miss (only 1 attribute wrong). Instead of losing health, the grace is consumed and the cards are removed.',
    icon: 'lorc/clover',
    effects: { graces: 3 }
  },
  {
    id: 'second-chance-legendary',
    name: 'Second Chance',
    rarity: 'legendary',
    level: 1,
    price: 15,
    description: '+7 starting graces.',
    shortDescription: 'Extra starting graces',
    flavorText: 'Graces save you when you pick a near-miss (only 1 attribute wrong). Instead of losing health, the grace is consumed and the cards are removed.',
    icon: 'lorc/clover',
    effects: { graces: 7 }
  },

  // ============================================================================
  // 7. FORTUNE TOKEN - Grace gain on match
  // ============================================================================
  {
    id: 'fortune-token-common',
    name: 'Fortune Token',
    rarity: 'common',
    level: 1,
    price: 6,
    description: '5% chance to gain grace on match.',
    shortDescription: 'Gain graces on match',
    flavorText: 'After a valid match, has a chance to grant +1 grace. Graces protect you from near-miss invalid matches.',
    icon: 'lorc/cycle',
    specialEffect: 'graceGain',
    effects: { graceGainChance: 5 }
  },
  {
    id: 'fortune-token-rare',
    name: 'Fortune Token',
    rarity: 'rare',
    level: 1,
    price: 12,
    description: '15% chance to gain grace on match.',
    shortDescription: 'Gain graces on match',
    flavorText: 'After a valid match, has a chance to grant +1 grace. Graces protect you from near-miss invalid matches.',
    icon: 'lorc/cycle',
    specialEffect: 'graceGain',
    effects: { graceGainChance: 15 }
  },
  {
    id: 'fortune-token-legendary',
    name: 'Fortune Token',
    rarity: 'legendary',
    level: 1,
    price: 18,
    description: '35% chance to gain grace on match.',
    shortDescription: 'Gain graces on match',
    flavorText: 'After a valid match, has a chance to grant +1 grace. Graces protect you from near-miss invalid matches.',
    icon: 'lorc/cycle',
    specialEffect: 'graceGain',
    effects: { graceGainChance: 35 }
  },

  // ============================================================================
  // 8. LIFE VESSEL - Max health
  // ============================================================================
  {
    id: 'life-vessel-common',
    name: 'Life Vessel',
    rarity: 'common',
    level: 1,
    price: 6,
    description: '+1 max health.',
    shortDescription: 'Increased max health',
    flavorText: 'Increases your maximum health pool. You lose 1 health when picking an invalid set without a grace to protect you.',
    icon: 'lorc/heart-inside',
    effects: { maxHealth: 1 }
  },
  {
    id: 'life-vessel-rare',
    name: 'Life Vessel',
    rarity: 'rare',
    level: 1,
    price: 12,
    description: '+3 max health.',
    shortDescription: 'Increased max health',
    flavorText: 'Increases your maximum health pool. You lose 1 health when picking an invalid set without a grace to protect you.',
    icon: 'lorc/heart-inside',
    effects: { maxHealth: 3 }
  },
  {
    id: 'life-vessel-legendary',
    name: 'Life Vessel',
    rarity: 'legendary',
    level: 1,
    price: 18,
    description: '+7 max health.',
    shortDescription: 'Increased max health',
    flavorText: 'Increases your maximum health pool. You lose 1 health when picking an invalid set without a grace to protect you.',
    icon: 'lorc/heart-inside',
    effects: { maxHealth: 7 }
  },

  // ============================================================================
  // 9. MENDING CHARM - Heal on match
  // ============================================================================
  {
    id: 'mending-charm-common',
    name: 'Mending Charm',
    rarity: 'common',
    level: 1,
    price: 5,
    description: '5% chance to heal on match.',
    shortDescription: 'Heal on match',
    flavorText: 'After a valid match, has a chance to restore 1 health. Cannot heal above your maximum health.',
    icon: 'lorc/shining-heart',
    specialEffect: 'healing',
    effects: { healingChance: 5 }
  },
  {
    id: 'mending-charm-rare',
    name: 'Mending Charm',
    rarity: 'rare',
    level: 1,
    price: 10,
    description: '15% chance to heal on match.',
    shortDescription: 'Heal on match',
    flavorText: 'After a valid match, has a chance to restore 1 health. Cannot heal above your maximum health.',
    icon: 'lorc/shining-heart',
    specialEffect: 'healing',
    effects: { healingChance: 15 }
  },
  {
    id: 'mending-charm-legendary',
    name: 'Mending Charm',
    rarity: 'legendary',
    level: 1,
    price: 15,
    description: '35% chance to heal on match.',
    shortDescription: 'Heal on match',
    flavorText: 'After a valid match, has a chance to restore 1 health. Cannot heal above your maximum health.',
    icon: 'lorc/shining-heart',
    specialEffect: 'healing',
    effects: { healingChance: 35 }
  },

  // ============================================================================
  // 10. CRYSTAL ORB - Max hints capacity
  // ============================================================================
  {
    id: 'crystal-orb-common',
    name: 'Crystal Orb',
    rarity: 'common',
    level: 1,
    price: 5,
    description: '+1 max hint capacity.',
    shortDescription: 'Increased hint capacity',
    flavorText: 'Hints highlight a valid set on the board when activated. Earn hints from matches to fill your capacity.',
    icon: 'lorc/floating-crystal',
    effects: { maxHints: 1 }
  },
  {
    id: 'crystal-orb-rare',
    name: 'Crystal Orb',
    rarity: 'rare',
    level: 1,
    price: 10,
    description: '+2 max hint capacity.',
    shortDescription: 'Increased hint capacity',
    flavorText: 'Hints highlight a valid set on the board when activated. Earn hints from matches to fill your capacity.',
    icon: 'lorc/floating-crystal',
    effects: { maxHints: 2 }
  },
  {
    id: 'crystal-orb-legendary',
    name: 'Crystal Orb',
    rarity: 'legendary',
    level: 1,
    price: 15,
    description: '+3 max hint capacity.',
    shortDescription: 'Increased hint capacity',
    flavorText: 'Hints highlight a valid set on the board when activated. Earn hints from matches to fill your capacity.',
    icon: 'lorc/floating-crystal',
    effects: { maxHints: 3 }
  },

  // ============================================================================
  // 11. SEEKER LENS - Hint gain on match
  // ============================================================================
  {
    id: 'seeker-lens-common',
    name: 'Seeker Lens',
    rarity: 'common',
    level: 1,
    price: 6,
    description: '5% chance to gain hint on match.',
    shortDescription: 'Gain hints on match',
    flavorText: 'After a valid match, has a chance to gain +1 hint. Use hints to highlight valid sets when you\'re stuck.',
    icon: 'lorc/light-bulb',
    specialEffect: 'hintGain',
    effects: { hintGainChance: 5 }
  },
  {
    id: 'seeker-lens-rare',
    name: 'Seeker Lens',
    rarity: 'rare',
    level: 1,
    price: 12,
    description: '15% chance to gain hint on match.',
    shortDescription: 'Gain hints on match',
    flavorText: 'After a valid match, has a chance to gain +1 hint. Use hints to highlight valid sets when you\'re stuck.',
    icon: 'lorc/light-bulb',
    specialEffect: 'hintGain',
    effects: { hintGainChance: 15 }
  },
  {
    id: 'seeker-lens-legendary',
    name: 'Seeker Lens',
    rarity: 'legendary',
    level: 1,
    price: 18,
    description: '35% chance to gain hint on match.',
    shortDescription: 'Gain hints on match',
    flavorText: 'After a valid match, has a chance to gain +1 hint. Use hints to highlight valid sets when you\'re stuck.',
    icon: 'lorc/light-bulb',
    specialEffect: 'hintGain',
    effects: { hintGainChance: 35 }
  },

  // ============================================================================
  // 12. PRISM GLASS - Holographic cards (2x points)
  // ============================================================================
  {
    id: 'prism-glass-common',
    name: 'Prism Glass',
    rarity: 'common',
    level: 1,
    price: 8,
    description: '10% chance for holographic cards (2x points).',
    shortDescription: 'Holographic cards appear',
    flavorText: 'When new cards are drawn, they have a chance to become holographic (purple shimmer). Matching holographic cards awards 2x points.',
    icon: 'lorc/crystal-shine',
    specialEffect: 'holographic',
    effects: { holoChance: 10 }
  },
  {
    id: 'prism-glass-rare',
    name: 'Prism Glass',
    rarity: 'rare',
    level: 1,
    price: 16,
    description: '30% chance for holographic cards (2x points).',
    shortDescription: 'Holographic cards appear',
    flavorText: 'When new cards are drawn, they have a chance to become holographic (purple shimmer). Matching holographic cards awards 2x points.',
    icon: 'lorc/crystal-shine',
    specialEffect: 'holographic',
    effects: { holoChance: 30 }
  },
  {
    id: 'prism-glass-legendary',
    name: 'Prism Glass',
    rarity: 'legendary',
    level: 1,
    price: 24,
    description: '70% chance for holographic cards (2x points).',
    shortDescription: 'Holographic cards appear',
    flavorText: 'When new cards are drawn, they have a chance to become holographic (purple shimmer). Matching holographic cards awards 2x points.',
    icon: 'lorc/crystal-shine',
    specialEffect: 'holographic',
    effects: { holoChance: 70 }
  },

  // ============================================================================
  // 13. CHRONO SHARD - Starting time bonus
  // ============================================================================
  {
    id: 'chrono-shard-common',
    name: 'Chrono Shard',
    rarity: 'common',
    level: 1,
    price: 7,
    description: '+15s starting time.',
    shortDescription: 'More starting time',
    flavorText: 'Adds bonus seconds to your starting time each round. More time means less pressure to find matches quickly.',
    icon: 'lorc/hourglass',
    effects: { startingTime: 15 }
  },
  {
    id: 'chrono-shard-rare',
    name: 'Chrono Shard',
    rarity: 'rare',
    level: 1,
    price: 14,
    description: '+45s starting time.',
    shortDescription: 'More starting time',
    flavorText: 'Adds bonus seconds to your starting time each round. More time means less pressure to find matches quickly.',
    icon: 'lorc/hourglass',
    effects: { startingTime: 45 }
  },
  {
    id: 'chrono-shard-legendary',
    name: 'Chrono Shard',
    rarity: 'legendary',
    level: 1,
    price: 21,
    description: '+105s starting time.',
    shortDescription: 'More starting time',
    flavorText: 'Adds bonus seconds to your starting time each round. More time means less pressure to find matches quickly.',
    icon: 'lorc/hourglass',
    effects: { startingTime: 105 }
  },

  // ============================================================================
  // 14. TIME DROP - Time gain on match (each rolls independently like lasers)
  // ============================================================================
  {
    id: 'time-drop-common',
    name: 'Time Drop',
    rarity: 'common',
    level: 1,
    price: 6,
    description: '5% chance to gain +10s on match.',
    shortDescription: '5% chance for +10s',
    flavorText: 'If you have multiple Time Drops, each one rolls separately on every match with its own chance to activate. Two common Time Drops means two separate 5% chances!',
    icon: 'lorc/stopwatch',
    specialEffect: 'timeGain',
    effects: { timeGainChance: 5, timeGainAmount: 10 }
  },
  {
    id: 'time-drop-rare',
    name: 'Time Drop',
    rarity: 'rare',
    level: 1,
    price: 12,
    description: '15% chance to gain +10s on match.',
    shortDescription: '15% chance for +10s',
    flavorText: 'If you have multiple Time Drops, each one rolls separately on every match with its own chance to activate. Two rare Time Drops means two separate 15% chances!',
    icon: 'lorc/stopwatch',
    specialEffect: 'timeGain',
    effects: { timeGainChance: 15, timeGainAmount: 10 }
  },
  {
    id: 'time-drop-legendary',
    name: 'Time Drop',
    rarity: 'legendary',
    level: 1,
    price: 18,
    description: '35% chance to gain +15s on match.',
    shortDescription: '35% chance for +15s',
    flavorText: 'If you have multiple Time Drops, each one rolls separately on every match with its own chance to activate. Two legendary Time Drops means two separate 35% chances!',
    icon: 'lorc/stopwatch',
    specialEffect: 'timeGain',
    effects: { timeGainChance: 35, timeGainAmount: 15 }
  },

  // ============================================================================
  // 15. PRISMATIC RAY - Laser destroys row/column
  // ============================================================================
  {
    id: 'prismatic-ray-common',
    name: 'Prismatic Ray',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '3% chance to destroy entire row or column.',
    shortDescription: 'May destroy a row or column',
    flavorText: 'Each laser weapon rolls independently on every match. When triggered, destroys all cards in either a row or column (randomly chosen). Multiple lasers can fire on the same match. Destroyed cards award +2 points each.',
    icon: 'lorc/laser-warning',
    specialEffect: 'laser',
    effects: { laserChance: 3 }
  },
  {
    id: 'prismatic-ray-rare',
    name: 'Prismatic Ray',
    rarity: 'rare',
    level: 1,
    price: 20,
    description: '9% chance to destroy entire row or column.',
    shortDescription: 'May destroy a row or column',
    flavorText: 'Each laser weapon rolls independently on every match. When triggered, destroys all cards in either a row or column (randomly chosen). Multiple lasers can fire on the same match. Destroyed cards award +2 points each.',
    icon: 'lorc/laser-warning',
    specialEffect: 'laser',
    effects: { laserChance: 9 }
  },
  {
    id: 'prismatic-ray-legendary',
    name: 'Prismatic Ray',
    rarity: 'legendary',
    level: 1,
    price: 30,
    description: '21% chance to destroy entire row or column.',
    shortDescription: 'May destroy a row or column',
    flavorText: 'Each laser weapon rolls independently on every match. When triggered, destroys all cards in either a row or column (randomly chosen). Multiple lasers can fire on the same match. Destroyed cards award +2 points each.',
    icon: 'lorc/laser-warning',
    specialEffect: 'laser',
    effects: { laserChance: 21 }
  },

  // ============================================================================
  // 16. CHAOS SHARD - Ricochet chain destruction
  // ============================================================================
  {
    id: 'chaos-shard-common',
    name: 'Chaos Shard',
    rarity: 'common',
    level: 1,
    price: 8,
    description: '10% chance to ricochet, 5% chain chance.',
    shortDescription: 'Random ricochet chains',
    flavorText: 'After matching, has a chance to destroy a random card anywhere on the board. Each destroyed card may chain to another random target. Chains can theoretically continue forever with lucky rolls!',
    icon: 'lorc/chained-arrow-heads',
    specialEffect: 'ricochet',
    effects: { ricochetChance: 10, ricochetChainChance: 5 }
  },
  {
    id: 'chaos-shard-rare',
    name: 'Chaos Shard',
    rarity: 'rare',
    level: 1,
    price: 16,
    description: '30% chance to ricochet, 15% chain chance.',
    shortDescription: 'Random ricochet chains',
    flavorText: 'After matching, has a chance to destroy a random card anywhere on the board. Each destroyed card may chain to another random target. Chains can theoretically continue forever with lucky rolls!',
    icon: 'lorc/chained-arrow-heads',
    specialEffect: 'ricochet',
    effects: { ricochetChance: 30, ricochetChainChance: 15 }
  },
  {
    id: 'chaos-shard-legendary',
    name: 'Chaos Shard',
    rarity: 'legendary',
    level: 1,
    price: 24,
    description: '70% chance to ricochet, 35% chain chance.',
    shortDescription: 'Random ricochet chains',
    flavorText: 'After matching, has a chance to destroy a random card anywhere on the board. Each destroyed card may chain to another random target. Chains can theoretically continue forever with lucky rolls!',
    icon: 'lorc/chained-arrow-heads',
    specialEffect: 'ricochet',
    effects: { ricochetChance: 70, ricochetChainChance: 35 }
  },
];

// Count how many of a specific weapon (by name) the player owns
export const getPlayerWeaponCount = (weaponName: WeaponName, playerWeapons: Weapon[]): number => {
  return playerWeapons.filter(w => w.name === weaponName).length;
};

// Check if a player can obtain more of a specific weapon (respects maxCount)
export const canObtainWeapon = (weapon: Weapon, playerWeapons: Weapon[]): boolean => {
  if (weapon.maxCount === undefined) return true; // No limit
  const currentCount = getPlayerWeaponCount(weapon.name, playerWeapons);
  return currentCount < weapon.maxCount;
};

// Helper function to get a random weapon based on rarity distribution
// Optionally filters out weapons the player can't obtain (at maxCount)
export const getRandomShopWeapon = (playerWeapons?: Weapon[]): Weapon => {
  const roll = Math.random();
  let rarity: WeaponRarity;

  if (roll < WEAPON_SYSTEM.rarityChances.legendary) {
    rarity = 'legendary';
  } else if (roll < WEAPON_SYSTEM.rarityChances.legendary + WEAPON_SYSTEM.rarityChances.rare) {
    rarity = 'rare';
  } else {
    rarity = 'common';
  }

  let weaponsOfRarity = WEAPONS.filter(w => w.rarity === rarity);

  // Filter out weapons the player already has at max count
  if (playerWeapons) {
    weaponsOfRarity = weaponsOfRarity.filter(w => canObtainWeapon(w, playerWeapons));

    // If all weapons of this rarity are at max, fall back to unfiltered
    if (weaponsOfRarity.length === 0) {
      weaponsOfRarity = WEAPONS.filter(w => w.rarity === rarity);
    }
  }

  return weaponsOfRarity[Math.floor(Math.random() * weaponsOfRarity.length)];
};

// Helper function to generate shop weapons
// Optionally filters out weapons the player can't obtain
export const generateShopWeapons = (count: number, playerWeapons?: Weapon[]): Weapon[] => {
  const weapons: Weapon[] = [];
  for (let i = 0; i < count; i++) {
    weapons.push(getRandomShopWeapon(playerWeapons));
  }
  return weapons;
};

// Get weapons by rarity
export const getWeaponsByRarity = (rarity: WeaponRarity): Weapon[] => {
  return WEAPONS.filter(w => w.rarity === rarity);
};

// Items
export const ITEMS: Item[] = [
  {
    name: 'Great Field',
    description: 'Provides a larger field and commerce boost',
    rarity: 'Tier 2',
    price: 12,
    limit: null, // unlimited
    icon: 'lorc/field',
    effects: {
      fieldSize: 3,
      commerce: 1
    },
    drawbacks: {
      additionalPoints: -2
    }
  },
  {
    name: 'Mirror Trinket',
    description: 'Mirrors another item at 50% potency',
    rarity: 'Tier 3',
    price: 15,
    limit: 1,
    icon: 'lorc/mirror-mirror',
    effects: {
      luck: 5
      // Special mirroring effect would be implemented in game logic
    },
    drawbacks: {
      experienceGainPercent: -5
    }
  },
  {
    name: 'Hint Booster',
    description: 'Provides extra match possibility hints',
    rarity: 'Tier 1',
    price: 6,
    limit: null,
    icon: 'lorc/light-bulb',
    effects: {
      matchPossibilityHints: 1,
      dodgeAttackBackPercent: 5
    },
    drawbacks: {
      timeWarpPercent: -5
    }
  },
  {
    name: 'Lucky Token',
    description: 'Grants a free reroll each wave',
    rarity: 'Tier 1',
    price: 5,
    limit: null,
    icon: 'delapouite/token',
    effects: {
      freeRerolls: 1,
      scavengingPercent: 2
    },
    drawbacks: {
      damage: -1
    }
  },
  {
    name: 'Colorblind Goggles',
    description: 'Increases holographic chance and damage',
    rarity: 'Tier 1',
    price: 3,
    limit: 1,
    icon: 'delapouite/sunglasses',
    effects: {
      holographicPercent: 15,
      damage: 1
    },
    drawbacks: {
      // Special effect for reducing money and points by 50% would be implemented in game logic
    }
  },
  // Implement the remaining items following the pattern above
];

// Round requirements
export const ROUND_REQUIREMENTS = [
  { round: 1, targetScore: 3, time: 30 },
  { round: 2, targetScore: 4, time: 45 },
  { round: 3, targetScore: 6, time: 45 },
  { round: 4, targetScore: 8, time: 45 },
  { round: 5, targetScore: 10, time: 60 },
  { round: 6, targetScore: 14, time: 60 },
  { round: 7, targetScore: 20, time: 60 },
  { round: 8, targetScore: 27, time: 60 },
  { round: 9, targetScore: 35, time: 60 },
  { round: 10, targetScore: 100, time: 60 },
];

// Helper functions for character, weapon, and item selection
export const getCharacterByName = (name: string): Character | undefined => {
  return CHARACTERS.find(character => character.name === name);
};

export const getWeaponByName = (name: string): Weapon | undefined => {
  return WEAPONS.find(weapon => weapon.name === name);
};

export const getItemByName = (name: string): Item | undefined => {
  return ITEMS.find(item => item.name === name);
};

export const getEnemyByName = (name: string): Enemy | undefined => {
  return ENEMIES.find(enemy => enemy.name === name);
};

// Helper function to initialize a player with a character
export const initializePlayer = (id: string, username: string, characterName: string): Player => {
  const character = getCharacterByName(characterName);
  if (!character) {
    throw new Error(`Character ${characterName} not found`);
  }

  const startingWeapons = character.startingWeapons.map(weaponName => {
    const weapon = getWeaponByName(weaponName);
    if (!weapon) {
      throw new Error(`Starting weapon ${weaponName} not found`);
    }
    return weapon;
  });

  return {
    id,
    username,
    character,
    stats: {
      ...DEFAULT_PLAYER_STATS,
      ...character.baseStats
    },
    weapons: startingWeapons,
    items: []
  };
};

// Helper function to calculate total player stats with all effects from weapons and items
export const calculatePlayerTotalStats = (player: Player): PlayerStats => {
  const totalStats = { ...player.stats };
  
  // Apply weapon effects
  player.weapons.forEach((weapon: Weapon) => {
    Object.entries(weapon.effects).forEach(([key, value]) => {
      if (typeof value === 'number' && typeof totalStats[key as keyof PlayerStats] === 'number') {
        const statKey = key as keyof PlayerStats;
        totalStats[statKey] = (totalStats[statKey] as number) + value;
      }
    });
  });
  
  // Apply item effects and drawbacks
  player.items.forEach((item: Item) => {
    // Apply effects
    Object.entries(item.effects).forEach(([key, value]) => {
      if (typeof value === 'number' && typeof totalStats[key as keyof PlayerStats] === 'number') {
        const statKey = key as keyof PlayerStats;
        totalStats[statKey] = (totalStats[statKey] as number) + value;
      }
    });
    
    // Apply drawbacks
    Object.entries(item.drawbacks).forEach(([key, value]) => {
      if (typeof value === 'number' && typeof totalStats[key as keyof PlayerStats] === 'number') {
        const statKey = key as keyof PlayerStats;
        totalStats[statKey] = (totalStats[statKey] as number) + value;
      }
    });
  });
  
  return totalStats;
}; 