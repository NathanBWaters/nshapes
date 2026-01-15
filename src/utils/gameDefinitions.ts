import { Character, Enemy, Item, Weapon, PlayerStats, GameState, Player, WeaponRarity, WeaponName, EffectCaps, BridgeTriggerType, BridgeEffectType } from '../types';
import { STARTING_STATS, WEAPON_SYSTEM, getRarityChancesForRound, EFFECT_CAPS } from './gameConfig';

// Default effect caps - initialized from EFFECT_CAPS configuration
export const DEFAULT_EFFECT_CAPS: EffectCaps = {
  echo: EFFECT_CAPS.echo.defaultCap,
  laser: EFFECT_CAPS.laser.defaultCap,
  graceGain: EFFECT_CAPS.graceGain.defaultCap,
  explosion: EFFECT_CAPS.explosion.defaultCap,
  hint: EFFECT_CAPS.hint.defaultCap,
  timeGain: EFFECT_CAPS.timeGain.defaultCap,
  healing: EFFECT_CAPS.healing.defaultCap,
  fire: EFFECT_CAPS.fire.defaultCap,
  ricochet: EFFECT_CAPS.ricochet.defaultCap,
  boardGrowth: EFFECT_CAPS.boardGrowth.defaultCap,
  coinGain: EFFECT_CAPS.coinGain.defaultCap,
  xpGain: EFFECT_CAPS.xpGain.defaultCap,
};

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
  xpGainChance: STARTING_STATS.xpGainChance,
  coinGainChance: STARTING_STATS.coinGainChance,
  timeGainChance: STARTING_STATS.timeGainChance,
  timeGainAmount: STARTING_STATS.timeGainAmount,
  laserChance: STARTING_STATS.laserChance,
  startingTime: STARTING_STATS.startingTime,
  ricochetChance: STARTING_STATS.ricochetChance,
  ricochetChainChance: STARTING_STATS.ricochetChainChance,
  enhancedHintChance: STARTING_STATS.enhancedHintChance,
  echoChance: STARTING_STATS.echoChance,
  chainReactionChance: STARTING_STATS.chainReactionChance,

  // Effect caps - initialized with defaults, can be increased by Cap Increaser weapons
  effectCaps: { ...DEFAULT_EFFECT_CAPS },
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
    name: 'Emperor Penguin',
    description: 'Wise ruler with oracle-like vision from the frozen throne',
    startingWeapons: ['Crystal Orb', 'Seeker Lens'],
    icon: 'delapouite/penguin',
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
    description: '10% chance to explode adjacent cards. Destroyed cards give +1 point and +1 coin each.',
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
    description: '30% chance to explode adjacent cards. Destroyed cards give +1 point and +1 coin each.',
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
    description: '35% chance to explode adjacent cards. Destroyed cards give +1 point and +1 coin each.',
    shortDescription: 'May explode adjacent cards on match',
    flavorText: 'After matching, each adjacent card (up/down/left/right) has a chance to explode. Exploded cards are destroyed and award +1 point and +1 coin each.',
    icon: 'lorc/bright-explosion',
    specialEffect: 'explosive',
    effects: { explosionChance: 35 }
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
    description: '10% chance to ignite adjacent cards. Burned cards give +1 point and +1 coin each.',
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
    description: '30% chance to ignite adjacent cards. Burned cards give +1 point and +1 coin each.',
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
    description: '70% chance to ignite adjacent cards. Burned cards give +1 point and +1 coin each.',
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
    description: '+1 max hint capacity (and +1 hint).',
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
    description: '+2 max hint capacity (and +1 hint).',
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
    description: '+3 max hint capacity (and +1 hint).',
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
  // 12. SCHOLAR'S TOME - XP gain on match
  // ============================================================================
  {
    id: 'scholars-tome-common',
    name: 'Scholar\'s Tome',
    rarity: 'common',
    level: 1,
    price: 8,
    description: '20% chance to gain +1 XP on match.',
    shortDescription: 'Gain XP on match',
    flavorText: 'Ancient wisdom grants bonus experience. Multiple tomes stack their chances - over 100% guarantees rewards with a chance for more.',
    icon: 'lorc/open-book',
    specialEffect: 'xpGain',
    effects: { xpGainChance: 20 }
  },
  {
    id: 'scholars-tome-rare',
    name: 'Scholar\'s Tome',
    rarity: 'rare',
    level: 1,
    price: 16,
    description: '40% chance to gain +1 XP on match.',
    shortDescription: 'Gain XP on match',
    flavorText: 'Ancient wisdom grants bonus experience. Multiple tomes stack their chances - over 100% guarantees rewards with a chance for more.',
    icon: 'lorc/open-book',
    specialEffect: 'xpGain',
    effects: { xpGainChance: 40 }
  },
  {
    id: 'scholars-tome-legendary',
    name: 'Scholar\'s Tome',
    rarity: 'legendary',
    level: 1,
    price: 24,
    description: '80% chance to gain +1 XP on match.',
    shortDescription: 'Gain XP on match',
    flavorText: 'Ancient wisdom grants bonus experience. Multiple tomes stack their chances - over 100% guarantees rewards with a chance for more.',
    icon: 'lorc/open-book',
    specialEffect: 'xpGain',
    effects: { xpGainChance: 80 }
  },

  // ============================================================================
  // 13. FORTUNE'S FAVOR - Coin gain on match
  // ============================================================================
  {
    id: 'fortunes-favor-common',
    name: 'Fortune\'s Favor',
    rarity: 'common',
    level: 1,
    price: 8,
    description: '20% chance to gain +1 coin on match.',
    shortDescription: 'Gain coins on match',
    flavorText: 'Lady Luck smiles upon you, granting bonus coins. Multiple fortunes stack their chances - over 100% guarantees rewards with a chance for more.',
    icon: 'lorc/crown-coin',
    specialEffect: 'coinGain',
    effects: { coinGainChance: 20 }
  },
  {
    id: 'fortunes-favor-rare',
    name: 'Fortune\'s Favor',
    rarity: 'rare',
    level: 1,
    price: 16,
    description: '40% chance to gain +1 coin on match.',
    shortDescription: 'Gain coins on match',
    flavorText: 'Lady Luck smiles upon you, granting bonus coins. Multiple fortunes stack their chances - over 100% guarantees rewards with a chance for more.',
    icon: 'lorc/crown-coin',
    specialEffect: 'coinGain',
    effects: { coinGainChance: 40 }
  },
  {
    id: 'fortunes-favor-legendary',
    name: 'Fortune\'s Favor',
    rarity: 'legendary',
    level: 1,
    price: 24,
    description: '80% chance to gain +1 coin on match.',
    shortDescription: 'Gain coins on match',
    flavorText: 'Lady Luck smiles upon you, granting bonus coins. Multiple fortunes stack their chances - over 100% guarantees rewards with a chance for more.',
    icon: 'lorc/crown-coin',
    specialEffect: 'coinGain',
    effects: { coinGainChance: 80 }
  },

  // ============================================================================
  // 14. CHRONO SHARD - Starting time bonus
  // ============================================================================
  {
    id: 'chrono-shard-common',
    name: 'Chrono Shard',
    rarity: 'common',
    level: 1,
    price: 7,
    description: '+15s starting time. Raises time cap.',
    shortDescription: 'More starting time',
    flavorText: 'Also raises the cap for time gained during matches, making Time Drop weapons more effective.',
    icon: 'lorc/hourglass',
    effects: { startingTime: 15 }
  },
  {
    id: 'chrono-shard-rare',
    name: 'Chrono Shard',
    rarity: 'rare',
    level: 1,
    price: 14,
    description: '+45s starting time. Raises time cap.',
    shortDescription: 'More starting time',
    flavorText: 'Also raises the cap for time gained during matches, making Time Drop weapons more effective.',
    icon: 'lorc/hourglass',
    effects: { startingTime: 45 }
  },
  {
    id: 'chrono-shard-legendary',
    name: 'Chrono Shard',
    rarity: 'legendary',
    level: 1,
    price: 21,
    description: '+105s starting time. Raises time cap.',
    shortDescription: 'More starting time',
    flavorText: 'Also raises the cap for time gained during matches, making Time Drop weapons more effective.',
    icon: 'lorc/hourglass',
    effects: { startingTime: 105 }
  },

  // ============================================================================
  // 15. TIME DROP - Time gain on match (each rolls independently like lasers)
  // ============================================================================
  {
    id: 'time-drop-common',
    name: 'Time Drop',
    rarity: 'common',
    level: 1,
    price: 6,
    description: '5% chance to gain +10s on match (capped at starting time).',
    shortDescription: '5% chance for +10s',
    flavorText: 'Time can only increase up to your starting max. Chrono Shards raise this cap!',
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
    description: '15% chance to gain +10s on match (capped at starting time).',
    shortDescription: '15% chance for +10s',
    flavorText: 'Time can only increase up to your starting max. Chrono Shards raise this cap!',
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
    description: '35% chance to gain +15s on match (capped at starting time).',
    shortDescription: '35% chance for +15s',
    flavorText: 'Time can only increase up to your starting max. Chrono Shards raise this cap!',
    icon: 'lorc/stopwatch',
    specialEffect: 'timeGain',
    effects: { timeGainChance: 35, timeGainAmount: 15 }
  },

  // ============================================================================
  // 16. PRISMATIC RAY - Laser destroys row/column
  // ============================================================================
  {
    id: 'prismatic-ray-common',
    name: 'Prismatic Ray',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '3% chance to destroy entire row or column. Destroyed cards give +2 points each.',
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
    description: '9% chance to destroy entire row or column. Destroyed cards give +2 points each.',
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
    description: '21% chance to destroy entire row or column. Destroyed cards give +2 points each.',
    shortDescription: 'May destroy a row or column',
    flavorText: 'Each laser weapon rolls independently on every match. When triggered, destroys all cards in either a row or column (randomly chosen). Multiple lasers can fire on the same match. Destroyed cards award +2 points each.',
    icon: 'lorc/laser-warning',
    specialEffect: 'laser',
    effects: { laserChance: 21 }
  },

  // ============================================================================
  // 17. CHAOS SHARD - Ricochet chain destruction
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

  // ============================================================================
  // 18. ECHO STONE - Auto-match another set on the board
  // ============================================================================
  {
    id: 'echo-stone-common',
    name: 'Echo Stone',
    rarity: 'common',
    level: 1,
    price: 8,
    description: '5% chance to auto-match another set on the board.',
    shortDescription: 'May auto-match another set',
    flavorText: 'After matching, has a chance to automatically find and match another valid set on the board. The echoed match triggers all on-match effects like explosions, healing, and more!',
    icon: 'lorc/echo-ripples',
    specialEffect: 'echo',
    effects: { echoChance: 5 }
  },
  {
    id: 'echo-stone-rare',
    name: 'Echo Stone',
    rarity: 'rare',
    level: 1,
    price: 16,
    description: '15% chance to auto-match another set on the board.',
    shortDescription: 'May auto-match another set',
    flavorText: 'After matching, has a chance to automatically find and match another valid set on the board. The echoed match triggers all on-match effects like explosions, healing, and more!',
    icon: 'lorc/echo-ripples',
    specialEffect: 'echo',
    effects: { echoChance: 15 }
  },
  {
    id: 'echo-stone-legendary',
    name: 'Echo Stone',
    rarity: 'legendary',
    level: 1,
    price: 24,
    description: '35% chance to auto-match another set on the board.',
    shortDescription: 'May auto-match another set',
    flavorText: 'After matching, has a chance to automatically find and match another valid set on the board. The echoed match triggers all on-match effects like explosions, healing, and more!',
    icon: 'lorc/echo-ripples',
    specialEffect: 'echo',
    effects: { echoChance: 35 }
  },

  // ============================================================================
  // 19. CHAIN REACTION - Double auto-match (legendary only)
  // ============================================================================
  {
    id: 'chain-reaction-legendary',
    name: 'Chain Reaction',
    rarity: 'legendary',
    level: 1,
    price: 25,
    description: '30% chance for echo to trigger twice (2 additional matches).',
    shortDescription: 'Echo may match twice',
    flavorText: 'When Echo Stone triggers, has a chance to find and match TWO additional sets instead of one. Creates massive chain reactions with other on-match effects!',
    icon: 'lorc/lightning-branches',
    specialEffect: 'chainReaction',
    effects: { chainReactionChance: 30 },
    maxCount: 1  // Unique - only one can be owned
  },

  // ============================================================================
  // CAP INCREASER WEAPONS - Increase the cap for each effect type
  // All are Rare rarity, increase cap for their respective effect
  // ============================================================================
  {
    id: 'echo-mastery',
    name: 'Echo Mastery',
    rarity: 'rare',
    level: 1,
    price: 15,
    description: 'Increases Echo cap by +5%. Max echo chance can now reach 30%.',
    shortDescription: 'Raises Echo effect cap',
    flavorText: 'Master the art of resonance to unlock greater echo potential.',
    icon: 'lorc/open-book',
    specialEffect: 'capIncrease',
    effects: {},
    capIncrease: { type: 'echo', amount: 5 },
  },
  {
    id: 'laser-mastery',
    name: 'Laser Mastery',
    rarity: 'rare',
    level: 1,
    price: 18,
    description: 'Increases Laser cap by +5%. Max laser chance can now reach 35%.',
    shortDescription: 'Raises Laser effect cap',
    flavorText: 'Learn to focus light with greater precision.',
    icon: 'lorc/open-book',
    specialEffect: 'capIncrease',
    effects: {},
    capIncrease: { type: 'laser', amount: 5 },
  },
  {
    id: 'grace-mastery',
    name: 'Grace Mastery',
    rarity: 'rare',
    level: 1,
    price: 12,
    description: 'Increases Grace Gain cap by +5%. Max grace gain chance can now reach 35%.',
    shortDescription: 'Raises Grace Gain effect cap',
    flavorText: 'Fortune favors those who study its ways.',
    icon: 'lorc/open-book',
    specialEffect: 'capIncrease',
    effects: {},
    capIncrease: { type: 'graceGain', amount: 5 },
  },
  {
    id: 'explosion-mastery',
    name: 'Explosion Mastery',
    rarity: 'rare',
    level: 1,
    price: 15,
    description: 'Increases Explosion cap by +10%. Max explosion chance can now reach 50%.',
    shortDescription: 'Raises Explosion effect cap',
    flavorText: 'Control the chaos of destruction itself.',
    icon: 'lorc/open-book',
    specialEffect: 'capIncrease',
    effects: {},
    capIncrease: { type: 'explosion', amount: 10 },
  },
  {
    id: 'hint-mastery',
    name: 'Hint Mastery',
    rarity: 'rare',
    level: 1,
    price: 12,
    description: 'Increases Hint cap by +10%. Max hint chance can now reach 50%.',
    shortDescription: 'Raises Hint effect cap',
    flavorText: 'Open your mind to greater insights.',
    icon: 'lorc/open-book',
    specialEffect: 'capIncrease',
    effects: {},
    capIncrease: { type: 'hint', amount: 10 },
  },
  {
    id: 'time-mastery',
    name: 'Time Mastery',
    rarity: 'rare',
    level: 1,
    price: 15,
    description: 'Increases Time Gain cap by +10%. Max time gain chance can now reach 50%.',
    shortDescription: 'Raises Time Gain effect cap',
    flavorText: 'Bend the flow of time to your will.',
    icon: 'lorc/open-book',
    specialEffect: 'capIncrease',
    effects: {},
    capIncrease: { type: 'timeGain', amount: 10 },
  },
  {
    id: 'healing-mastery',
    name: 'Healing Mastery',
    rarity: 'rare',
    level: 1,
    price: 12,
    description: 'Increases Healing cap by +10%. Max healing chance can now reach 60%.',
    shortDescription: 'Raises Healing effect cap',
    flavorText: 'Unlock the deeper secrets of restoration.',
    icon: 'lorc/open-book',
    specialEffect: 'capIncrease',
    effects: {},
    capIncrease: { type: 'healing', amount: 10 },
  },
  {
    id: 'fire-mastery',
    name: 'Fire Mastery',
    rarity: 'rare',
    level: 1,
    price: 15,
    description: 'Increases Fire cap by +10%. Max fire spread chance can now reach 60%.',
    shortDescription: 'Raises Fire effect cap',
    flavorText: 'Command the flames with greater intensity.',
    icon: 'lorc/open-book',
    specialEffect: 'capIncrease',
    effects: {},
    capIncrease: { type: 'fire', amount: 10 },
  },
  {
    id: 'ricochet-mastery',
    name: 'Ricochet Mastery',
    rarity: 'rare',
    level: 1,
    price: 15,
    description: 'Increases Ricochet cap by +10%. Max ricochet chance can now reach 70%.',
    shortDescription: 'Raises Ricochet effect cap',
    flavorText: 'Learn to predict the unpredictable bounces.',
    icon: 'lorc/open-book',
    specialEffect: 'capIncrease',
    effects: {},
    capIncrease: { type: 'ricochet', amount: 10 },
  },
  {
    id: 'growth-mastery',
    name: 'Growth Mastery',
    rarity: 'rare',
    level: 1,
    price: 12,
    description: 'Increases Board Growth cap by +10%. Max board growth chance can now reach 70%.',
    shortDescription: 'Raises Board Growth effect cap',
    flavorText: 'Nurture the seeds of expansion.',
    icon: 'lorc/open-book',
    specialEffect: 'capIncrease',
    effects: {},
    capIncrease: { type: 'boardGrowth', amount: 10 },
  },
  {
    id: 'coin-mastery',
    name: 'Coin Mastery',
    rarity: 'rare',
    level: 1,
    price: 18,
    description: 'Increases Coin Gain cap by +15%. Max coin gain chance can now reach 85%.',
    shortDescription: 'Raises Coin Gain effect cap',
    flavorText: 'Discover the secrets of endless wealth.',
    icon: 'lorc/open-book',
    specialEffect: 'capIncrease',
    effects: {},
    capIncrease: { type: 'coinGain', amount: 15 },
  },

  // ============================================================================
  // EPIC WEAPON VARIANTS - Unique epic versions with bundled effects
  // Pattern: 25% effect OR cap bundle OR multi-pack OR cross-system lite
  // ============================================================================

  // Cap Bundle pattern: 25% effect + cap increase
  {
    id: 'inferno-charge',
    name: 'Inferno Charge',
    rarity: 'epic',
    level: 1,
    price: 28,
    description: '25% explosion chance + raises explosion cap by 10%.',
    shortDescription: 'High explosions with cap boost',
    flavorText: 'A volatile charge that pushes the limits of destruction.',
    icon: 'lorc/bright-explosion',
    specialEffect: 'explosive',
    effects: { explosionChance: 25 },
    capIncrease: { type: 'explosion', amount: 10 },
  },
  {
    id: 'ember-heart',
    name: 'Ember Heart',
    rarity: 'epic',
    level: 1,
    price: 28,
    description: '25% fire spread chance + raises fire cap by 10%.',
    shortDescription: 'Strong fire with cap boost',
    flavorText: 'A core of eternal flame that burns ever brighter.',
    icon: 'lorc/fireball',
    specialEffect: 'fire',
    effects: { fireSpreadChance: 25 },
    capIncrease: { type: 'fire', amount: 10 },
  },
  {
    id: 'lucky-charm',
    name: 'Lucky Charm',
    rarity: 'epic',
    level: 1,
    price: 24,
    description: '25% grace gain chance + raises grace cap by 5%.',
    shortDescription: 'High grace gain with cap boost',
    flavorText: 'Fortune smiles upon those who carry this charm.',
    icon: 'lorc/clover',
    specialEffect: 'graceGain',
    effects: { graceGainChance: 25 },
    capIncrease: { type: 'graceGain', amount: 5 },
  },
  {
    id: 'restoration-aura',
    name: 'Restoration Aura',
    rarity: 'epic',
    level: 1,
    price: 26,
    description: '25% healing chance + raises healing cap by 10%.',
    shortDescription: 'Strong healing with cap boost',
    flavorText: 'An aura of pure healing energy radiates outward.',
    icon: 'lorc/heart-bottle',
    specialEffect: 'healing',
    effects: { healingChance: 25 },
    capIncrease: { type: 'healing', amount: 10 },
  },
  {
    id: 'golden-touch',
    name: 'Golden Touch',
    rarity: 'epic',
    level: 1,
    price: 30,
    description: '25% coin gain chance + raises coin cap by 15%.',
    shortDescription: 'High coins with cap boost',
    flavorText: 'Everything this power touches turns to gold.',
    icon: 'delapouite/coins-pile',
    specialEffect: 'coinGain',
    effects: { coinGainChance: 25 },
    capIncrease: { type: 'coinGain', amount: 15 },
  },
  {
    id: 'spectrum-annihilator',
    name: 'Spectrum Annihilator',
    rarity: 'epic',
    level: 1,
    price: 32,
    description: '25% laser chance + raises laser cap by 5%.',
    shortDescription: 'Powerful laser with cap boost',
    flavorText: 'A prism of destruction that channels all wavelengths.',
    icon: 'lorc/laser-blast',
    specialEffect: 'laser',
    effects: { laserChance: 25 },
    capIncrease: { type: 'laser', amount: 5 },
  },
  {
    id: 'resonance-crystal',
    name: 'Resonance Crystal',
    rarity: 'epic',
    level: 1,
    price: 30,
    description: '25% echo chance + raises echo cap by 5%.',
    shortDescription: 'Strong echo with cap boost',
    flavorText: 'A crystal that amplifies the resonance of matching.',
    icon: 'lorc/echo-ripples',
    specialEffect: 'echo',
    effects: { echoChance: 25 },
    capIncrease: { type: 'echo', amount: 5 },
  },

  // Multi-pack pattern: Combines multiple related effects
  {
    id: 'terra-foundation',
    name: 'Terra Foundation',
    rarity: 'epic',
    level: 1,
    price: 28,
    description: '+5 field size + 10% board growth chance.',
    shortDescription: 'Bigger board with growth',
    flavorText: 'The earth itself expands to accommodate more cards.',
    icon: 'lorc/stone-block',
    specialEffect: 'boardGrowth',
    effects: { fieldSize: 5, boardGrowthChance: 10 },
  },
  {
    id: 'fortunes-shield',
    name: "Fortune's Shield",
    rarity: 'epic',
    level: 1,
    price: 26,
    description: '+5 graces + 10% grace gain chance.',
    shortDescription: 'More graces with gain chance',
    flavorText: 'A shield blessed by fortune itself.',
    icon: 'lorc/clover',
    specialEffect: 'graceGain',
    effects: { graces: 5, graceGainChance: 10 },
  },
  {
    id: 'clairvoyant-sphere',
    name: 'Clairvoyant Sphere',
    rarity: 'epic',
    level: 1,
    price: 24,
    description: '+4 max hints + 10% hint gain chance.',
    shortDescription: 'More hints with gain chance',
    flavorText: 'See beyond the veil to find more sets.',
    icon: 'lorc/crystal-ball',
    specialEffect: 'hintGain',
    effects: { maxHints: 4, hintGainChance: 10 },
  },
  {
    id: 'arcane-codex',
    name: 'Arcane Codex',
    rarity: 'epic',
    level: 1,
    price: 26,
    description: '25% XP gain chance + 10% coin gain chance.',
    shortDescription: 'XP and coin gains',
    flavorText: 'Ancient wisdom that rewards knowledge with wealth.',
    icon: 'lorc/open-book',
    specialEffect: 'xpGain',
    effects: { xpGainChance: 25, coinGainChance: 10 },
  },
  {
    id: 'temporal-core',
    name: 'Temporal Core',
    rarity: 'epic',
    level: 1,
    price: 30,
    description: '+60s starting time + 10% time gain chance.',
    shortDescription: 'More time with gain chance',
    flavorText: 'A core of frozen time that slowly releases its power.',
    icon: 'lorc/hourglass',
    specialEffect: 'timeGain',
    effects: { startingTime: 60, timeGainChance: 10 },
  },
  {
    id: 'vital-core',
    name: 'Vital Core',
    rarity: 'epic',
    level: 1,
    price: 28,
    description: '+5 max HP + 10% healing chance.',
    shortDescription: 'More health with healing',
    flavorText: 'A living core that sustains and heals.',
    icon: 'lorc/heart-bottle',
    specialEffect: 'healing',
    effects: { maxHealth: 5, healingChance: 10 },
  },

  // Cross-system Lite pattern: Main effect + secondary from different system
  // Note: These are simplified versions - full cross-system triggers are in Section 5
  {
    id: 'prophets-vision',
    name: "Prophet's Vision",
    rarity: 'epic',
    level: 1,
    price: 28,
    description: '25% auto-hint chance + 10% grace gain on match.',
    shortDescription: 'Auto-hints with grace gains',
    flavorText: 'See the future and be blessed for your foresight.',
    icon: 'lorc/third-eye',
    specialEffect: 'autoHint',
    effects: { autoHintChance: 25, graceGainChance: 10 },
  },
  {
    id: 'life-bloom',
    name: 'Life Bloom',
    rarity: 'epic',
    level: 1,
    price: 26,
    description: '25% board growth chance + 10% healing chance.',
    shortDescription: 'Growth with healing',
    flavorText: 'Where growth flourishes, life follows.',
    icon: 'lorc/flowers',
    specialEffect: 'boardGrowth',
    effects: { boardGrowthChance: 25, healingChance: 10 },
  },
  {
    id: 'enlightened-eye',
    name: 'Enlightened Eye',
    rarity: 'epic',
    level: 1,
    price: 24,
    description: '25% hint gain chance + 5% XP gain chance.',
    shortDescription: 'Hints with XP',
    flavorText: 'Knowledge begets wisdom, and wisdom begets experience.',
    icon: 'lorc/third-eye',
    specialEffect: 'hintGain',
    effects: { hintGainChance: 25, xpGainChance: 5 },
  },
  {
    id: 'hourglass-of-ages',
    name: 'Hourglass of Ages',
    rarity: 'epic',
    level: 1,
    price: 28,
    description: '25% time gain chance + 5% echo chance.',
    shortDescription: 'Time with echo',
    flavorText: 'Time flows, and in its wake, patterns repeat.',
    icon: 'lorc/hourglass',
    specialEffect: 'timeGain',
    effects: { timeGainChance: 25, echoChance: 5 },
  },
  {
    id: 'entropy-engine',
    name: 'Entropy Engine',
    rarity: 'epic',
    level: 1,
    price: 32,
    description: '25% ricochet chance + 10% explosion chance.',
    shortDescription: 'Ricochet with explosions',
    flavorText: 'Chaos begets chaos, destruction begets destruction.',
    icon: 'lorc/cracked-ball-dunk',
    specialEffect: 'ricochet',
    effects: { ricochetChance: 25, explosionChance: 10 },
  },

  // ═══════════════════════════════════════════════════════════════
  // LEGENDARY BRIDGE WEAPONS - Cross-system triggers (10 weapons)
  // ═══════════════════════════════════════════════════════════════

  // Phoenix Feather: On heal → holographic
  {
    id: 'phoenix-feather',
    name: 'Phoenix Feather',
    rarity: 'legendary',
    level: 1,
    price: 35,
    description: 'On heal: 15% chance to make a random card holographic.',
    shortDescription: 'Heal makes holographic',
    flavorText: 'From the ashes of pain, golden glory rises.',
    icon: 'lorc/feather',
    specialEffect: 'bridge',
    effects: {},
    bridgeEffect: { trigger: 'onHeal', chance: 15, effect: 'makeHolographic', amount: 1 },
    maxCount: 2,
  },

  // Chaos Conduit: On explosion → grace
  {
    id: 'chaos-conduit',
    name: 'Chaos Conduit',
    rarity: 'legendary',
    level: 1,
    price: 40,
    description: 'On explosion: 10% chance to gain +1 grace.',
    shortDescription: 'Explosions give grace',
    flavorText: 'Channel the destruction into divine protection.',
    icon: 'lorc/lightning-helix',
    specialEffect: 'bridge',
    effects: {},
    bridgeEffect: { trigger: 'onExplosion', chance: 10, effect: 'gainGrace', amount: 1 },
    maxCount: 3,
  },

  // Temporal Rift: On time gain → echo
  {
    id: 'temporal-rift',
    name: 'Temporal Rift',
    rarity: 'legendary',
    level: 1,
    price: 45,
    description: 'On time gain: 20% chance to trigger echo.',
    shortDescription: 'Time gain triggers echo',
    flavorText: 'Bend time, and the echoes of the past return.',
    icon: 'lorc/time-trap',
    specialEffect: 'bridge',
    effects: {},
    bridgeEffect: { trigger: 'onTimeGain', chance: 20, effect: 'triggerEcho' },
    maxCount: 2,
  },

  // Soul Harvest: On destruction → heal
  {
    id: 'soul-harvest',
    name: 'Soul Harvest',
    rarity: 'legendary',
    level: 1,
    price: 35,
    description: 'On card destruction: 5% chance to heal 1 HP.',
    shortDescription: 'Destruction heals you',
    flavorText: 'Every falling card feeds your life force.',
    icon: 'lorc/death-note',
    specialEffect: 'bridge',
    effects: {},
    bridgeEffect: { trigger: 'onDestruction', chance: 5, effect: 'heal', amount: 1 },
    maxCount: 3,
  },

  // Cascade Core: On echo → fire
  {
    id: 'cascade-core',
    name: 'Cascade Core',
    rarity: 'legendary',
    level: 1,
    price: 40,
    description: 'On echo: 15% chance to set a random card on fire.',
    shortDescription: 'Echoes ignite cards',
    flavorText: 'The ripples of resonance carry flames.',
    icon: 'lorc/fire-ring',
    specialEffect: 'bridge',
    effects: {},
    bridgeEffect: { trigger: 'onEcho', chance: 15, effect: 'fireCard', amount: 1 },
    maxCount: 2,
  },

  // Fortune's Blessing: On coin gain → hint
  {
    id: 'fortunes-blessing',
    name: "Fortune's Blessing",
    rarity: 'legendary',
    level: 1,
    price: 35,
    description: 'On coin gain: 10% chance to gain +1 hint.',
    shortDescription: 'Coins reveal hints',
    flavorText: 'Wealth brings wisdom to those who seek it.',
    icon: 'lorc/crown-coin',
    specialEffect: 'bridge',
    effects: {},
    bridgeEffect: { trigger: 'onCoinGain', chance: 10, effect: 'gainHint', amount: 1 },
    maxCount: 3,
  },

  // Wisdom Chain: On XP gain → coin
  {
    id: 'wisdom-chain',
    name: 'Wisdom Chain',
    rarity: 'legendary',
    level: 1,
    price: 30,
    description: 'On XP gain: 15% chance to gain +1 coin.',
    shortDescription: 'XP yields coins',
    flavorText: 'Knowledge has always been worth its weight in gold.',
    icon: 'lorc/bookmarklet',
    specialEffect: 'bridge',
    effects: {},
    bridgeEffect: { trigger: 'onXPGain', chance: 15, effect: 'gainCoin', amount: 1 },
    maxCount: 3,
  },

  // Grace Conduit: On grace use → laser
  {
    id: 'grace-conduit',
    name: 'Grace Conduit',
    rarity: 'legendary',
    level: 1,
    price: 45,
    description: 'On grace use: 25% chance to fire a laser.',
    shortDescription: 'Grace fires laser',
    flavorText: 'Divine mercy becomes divine wrath.',
    icon: 'lorc/angel-outfit',
    specialEffect: 'bridge',
    effects: {},
    bridgeEffect: { trigger: 'onGraceUse', chance: 25, effect: 'triggerLaser' },
    maxCount: 2,
  },

  // Hint Catalyst: On hint use → holographic
  {
    id: 'hint-catalyst',
    name: 'Hint Catalyst',
    rarity: 'legendary',
    level: 1,
    price: 40,
    description: 'On hint use: 20% chance to make 3 random cards holographic.',
    shortDescription: 'Hints make holographic',
    flavorText: 'Seek and you shall find... treasure.',
    icon: 'lorc/crystal-wand',
    specialEffect: 'bridge',
    effects: {},
    bridgeEffect: { trigger: 'onHintUse', chance: 20, effect: 'makeHolographic', amount: 3 },
    maxCount: 2,
  },

  // Life Link: On health loss → explosion
  {
    id: 'life-link',
    name: 'Life Link',
    rarity: 'legendary',
    level: 1,
    price: 50,
    description: 'On health loss: 30% chance to trigger explosion.',
    shortDescription: 'Damage causes explosion',
    flavorText: 'Pain shared is pain doubled for your enemies.',
    icon: 'lorc/broken-heart',
    specialEffect: 'bridge',
    effects: {},
    bridgeEffect: { trigger: 'onHealthLoss', chance: 30, effect: 'explosion' },
    maxCount: 2,
  },
];

// Count how many of a specific weapon (by name) the player owns
export const getPlayerWeaponCount = (weaponName: WeaponName | string, playerWeapons: Weapon[]): number => {
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
// Round parameter enables rarity scaling (1-10, defaults to 5 for mid-game rates)
export const getRandomShopWeapon = (playerWeapons?: Weapon[], round: number = 5): Weapon => {
  const roll = Math.random();
  let rarity: WeaponRarity;

  // Get rarity chances based on round (scales with progression)
  const rarityChances = getRarityChancesForRound(round);

  if (roll < rarityChances.legendary) {
    rarity = 'legendary';
  } else if (roll < rarityChances.legendary + rarityChances.epic) {
    rarity = 'epic';
  } else if (roll < rarityChances.legendary + rarityChances.epic + rarityChances.rare) {
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

  // If still empty (no weapons of this rarity exist), fall back to common
  if (weaponsOfRarity.length === 0) {
    weaponsOfRarity = WEAPONS.filter(w => w.rarity === 'common');
  }

  // Final fallback: if somehow still empty (shouldn't happen), use first weapon in WEAPONS
  if (weaponsOfRarity.length === 0) {
    console.warn('getRandomShopWeapon: No weapons found for any rarity, using fallback');
    return WEAPONS[0];
  }

  return weaponsOfRarity[Math.floor(Math.random() * weaponsOfRarity.length)];
};

// Helper function to generate shop weapons
// Optionally filters out weapons the player can't obtain
// Round parameter enables rarity scaling (1-10)
export const generateShopWeapons = (count: number, playerWeapons?: Weapon[], round: number = 5): Weapon[] => {
  const weapons: Weapon[] = [];
  for (let i = 0; i < count; i++) {
    weapons.push(getRandomShopWeapon(playerWeapons, round));
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

// Endless mode round requirements (slightly exponential scaling)
// Round 11: 120, Round 12: 144, Round 13: 173, Round 14: 208, Round 15: 250...
export const getEndlessRoundRequirement = (round: number): { round: number; targetScore: number; time: number } => {
  const baseScore = 100; // Round 10 target
  const baseIncrement = 20;
  const scaleFactor = 1.2; // 20% increase per round

  let target = baseScore;
  for (let r = 11; r <= round; r++) {
    target += Math.floor(baseIncrement * Math.pow(scaleFactor, r - 11));
  }

  return {
    round,
    targetScore: target,
    time: 60, // Keep 60s timer for all endless rounds
  };
};

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

  // Deep clone effectCaps so we can modify it
  if (totalStats.effectCaps) {
    totalStats.effectCaps = { ...totalStats.effectCaps };
  }

  // Keys that should not be modified by weapon/item effects (non-numeric)
  const nonNumericKeys = new Set(['effectCaps']);

  // Apply weapon effects
  player.weapons.forEach((weapon: Weapon) => {
    // Apply stat effects
    Object.entries(weapon.effects).forEach(([key, value]) => {
      if (nonNumericKeys.has(key)) return;
      const currentValue = totalStats[key as keyof PlayerStats];
      if (typeof value === 'number' && typeof currentValue === 'number') {
        // Use type assertion to allow dynamic property assignment
        (totalStats as unknown as Record<string, number>)[key] = currentValue + value;
      }
    });

    // Apply cap increase effects
    if (weapon.capIncrease && totalStats.effectCaps) {
      const { type, amount } = weapon.capIncrease;
      const caps = totalStats.effectCaps as unknown as Record<string, number>;
      if (caps[type] !== undefined) {
        caps[type] += amount;
      }
    }
  });

  // Apply item effects and drawbacks
  player.items.forEach((item: Item) => {
    // Apply effects
    Object.entries(item.effects).forEach(([key, value]) => {
      if (nonNumericKeys.has(key)) return;
      const currentValue = totalStats[key as keyof PlayerStats];
      if (typeof value === 'number' && typeof currentValue === 'number') {
        (totalStats as unknown as Record<string, number>)[key] = currentValue + value;
      }
    });

    // Apply drawbacks
    Object.entries(item.drawbacks).forEach(([key, value]) => {
      if (nonNumericKeys.has(key)) return;
      const currentValue = totalStats[key as keyof PlayerStats];
      if (typeof value === 'number' && typeof currentValue === 'number') {
        (totalStats as unknown as Record<string, number>)[key] = currentValue + value;
      }
    });
  });

  return totalStats;
}; 

// ═══════════════════════════════════════════════════════════════
// BRIDGE EFFECT SYSTEM - Cross-system triggers for legendary weapons
// ═══════════════════════════════════════════════════════════════

// Result of resolving bridge effects for a trigger event
export interface BridgeEffectResult {
  effect: BridgeEffectType;
  amount?: number;
  weaponName: string;
}

/**
 * Get all bridge weapons from a player's arsenal that match a trigger type
 */
export const getBridgeWeaponsForTrigger = (
  trigger: BridgeTriggerType,
  playerWeapons: Weapon[]
): Weapon[] => {
  return playerWeapons.filter(
    w => w.specialEffect === 'bridge' && w.bridgeEffect?.trigger === trigger
  );
};

/**
 * Roll bridge effects for a trigger event
 * Returns array of effects that triggered successfully
 * 
 * @param trigger - The type of event that occurred
 * @param playerWeapons - Player's current weapons
 * @param isCascade - If true, we're already in a bridge resolution (prevents infinite loops)
 * @returns Array of bridge effects that should be applied
 */
export const rollBridgeEffects = (
  trigger: BridgeTriggerType,
  playerWeapons: Weapon[],
  isCascade: boolean = false
): BridgeEffectResult[] => {
  // Prevent cascade - bridge effects don't trigger other bridge effects
  if (isCascade) {
    return [];
  }

  const bridgeWeapons = getBridgeWeaponsForTrigger(trigger, playerWeapons);
  const results: BridgeEffectResult[] = [];

  bridgeWeapons.forEach(weapon => {
    if (!weapon.bridgeEffect) return;

    const roll = Math.random() * 100;
    if (roll < weapon.bridgeEffect.chance) {
      results.push({
        effect: weapon.bridgeEffect.effect,
        amount: weapon.bridgeEffect.amount,
        weaponName: weapon.name,
      });
    }
  });

  return results;
};

/**
 * Check if any bridge weapons exist for a trigger type
 */
export const hasBridgeWeaponsForTrigger = (
  trigger: BridgeTriggerType,
  playerWeapons: Weapon[]
): boolean => {
  return getBridgeWeaponsForTrigger(trigger, playerWeapons).length > 0;
};
