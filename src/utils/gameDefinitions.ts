import { Character, Enemy, Item, Weapon, PlayerStats, GameState, Player, WeaponName, FusionWeapon, PlayerInventory } from '../types';
import { STARTING_STATS } from './gameConfig';
import { getWeaponByName as getFusionWeaponByName } from './fusionDefinitions';

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

  // Weapon effect stats
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
  timeGainTriggerCap: STARTING_STATS.timeGainTriggerCap,
  laserChance: STARTING_STATS.laserChance,
  startingTime: STARTING_STATS.startingTime,
  ricochetChance: STARTING_STATS.ricochetChance,
  ricochetChainChance: STARTING_STATS.ricochetChainChance,
  enhancedHintChance: STARTING_STATS.enhancedHintChance,
  echoChance: STARTING_STATS.echoChance,
  chainReactionChance: STARTING_STATS.chainReactionChance,

  // Connector weapon stats
  connectionChance: 0,
  startingConnections: 0,
  echoTimeBonusPerLink: 0,
  linkedFireMultiplier: 1, // Default 1x (no multiplier)
  bonusConnectionChance: 0,
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

// Weapon system - 19 base weapons/passives (common only, no rarity variants)
// Rare/Epic/Legendary variants, mastery weapons, bridge weapons, and challenge legendaries are REMOVED
// The fusion system (FusionWeapon interface) handles all progression via leveling and fusing
export const WEAPONS: Weapon[] = [
  // ============================================================================
  // BASE WEAPONS (6 total) - Can fuse at level 3
  // ============================================================================

  // 1. BLAST POWDER - Explosive adjacent cards on match
  {
    id: 'blast-powder',
    name: 'Blast Powder',
    rarity: 'common',
    level: 1,
    price: 0, // Price unused in new system (no shop)
    description: '10% chance to explode adjacent cards. Destroyed cards give +1 point and +1 coin each.',
    shortDescription: 'May explode adjacent cards on match',
    flavorText: 'After matching, each adjacent card (up/down/left/right) has a chance to explode. Exploded cards are destroyed and award +1 point and +1 coin each.',
    icon: 'lorc/bright-explosion',
    specialEffect: 'explosive',
    effects: { explosionChance: 10 }
  },

  // 2. FLINT SPARK - Fire starter
  {
    id: 'flint-spark',
    name: 'Flint Spark',
    rarity: 'common',
    level: 1,
    price: 0,
    description: '10% chance to ignite adjacent cards. Burned cards give +1 point and +1 coin each.',
    shortDescription: 'May ignite adjacent cards',
    flavorText: 'After matching, adjacent cards may catch fire. Burning cards are destroyed after 0.25 seconds, awarding points. Fire has a 10% chance to spread to neighbors when a card burns out.',
    icon: 'lorc/campfire',
    specialEffect: 'fire',
    effects: { fireSpreadChance: 10 }
  },

  // 3. PRISMATIC RAY - Laser destroys row/column
  {
    id: 'prismatic-ray',
    name: 'Prismatic Ray',
    rarity: 'common',
    level: 1,
    price: 0,
    description: '5% chance to destroy entire row or column. Destroyed cards give +2 points each.',
    shortDescription: 'May destroy a row or column',
    flavorText: 'Each laser weapon rolls independently on every match. When triggered, destroys all cards in either a row or column (randomly chosen). Multiple lasers can fire on the same match. Destroyed cards award +2 points each.',
    icon: 'lorc/laser-warning',
    specialEffect: 'laser',
    effects: { laserChance: 5 }
  },

  // 4. CHAOS SHARD - Ricochet chain destruction
  {
    id: 'chaos-shard',
    name: 'Chaos Shard',
    rarity: 'common',
    level: 1,
    price: 0,
    description: '10% chance to ricochet, 5% chain chance.',
    shortDescription: 'Random ricochet chains',
    flavorText: 'After matching, has a chance to destroy a random card anywhere on the board. Each destroyed card may chain to another random target. Chains can theoretically continue forever with lucky rolls!',
    icon: 'lorc/chained-arrow-heads',
    specialEffect: 'ricochet',
    effects: { ricochetChance: 10, ricochetChainChance: 5 }
  },

  // 5. ECHO STONE - Auto-match another set on the board
  {
    id: 'echo-stone',
    name: 'Echo Stone',
    rarity: 'common',
    level: 1,
    price: 0,
    description: '8% chance to auto-match another set on the board.',
    shortDescription: 'May auto-match another set',
    flavorText: 'After matching, has a chance to automatically find and match another valid set on the board. The echoed match triggers all on-match effects like explosions, healing, and more!',
    icon: 'lorc/echo-ripples',
    specialEffect: 'echo',
    effects: { echoChance: 8 }
  },

  // 6. LINK STONE - Connect board positions
  {
    id: 'link-stone',
    name: 'Link Stone',
    rarity: 'common',
    level: 1,
    price: 0,
    description: '15% chance on match to connect two of the matched positions for the rest of the round. Connected cards are destroyed together.',
    shortDescription: '15% link on match',
    flavorText: 'What is joined cannot be undone.',
    icon: 'lorc/chained-heart',
    specialEffect: 'connector',
    effects: { connectionChance: 15 }
  },

  // ============================================================================
  // BASE PASSIVES (13 total) - Cannot fuse, but can level up
  // ============================================================================

  // 1. ORACLE EYE - Auto-hint system
  {
    id: 'oracle-eye',
    name: 'Oracle Eye',
    rarity: 'common',
    level: 1,
    price: 0,
    description: '15% chance to reveal 1 card from a valid set 15s after match.',
    shortDescription: 'Hint when stuck',
    flavorText: 'After 15 seconds without a match, has a chance to highlight one card guaranteed to be part of a valid set. You still need to find the other two!',
    icon: 'lorc/sheikah-eye',
    specialEffect: 'autoHint',
    effects: { autoHintChance: 15 }
  },

  // 2. FIELD STONE - Starting board size
  {
    id: 'field-stone',
    name: 'Field Stone',
    rarity: 'common',
    level: 1,
    price: 0,
    description: '+1 starting board size.',
    shortDescription: 'Larger starting board',
    flavorText: 'Start each round with more cards on the board. More cards means more possible matches to find.',
    icon: 'lorc/field',
    effects: { fieldSize: 1 }
  },

  // 3. GROWTH SEED - Board grows on match
  {
    id: 'growth-seed',
    name: 'Growth Seed',
    rarity: 'common',
    level: 1,
    price: 0,
    description: '5% chance to expand board on match.',
    shortDescription: 'Board expands on match',
    flavorText: 'After matching, has a chance to add new cards to the board. A growing board gives you more options and potential matches.',
    icon: 'delapouite/card-exchange',
    specialEffect: 'boardGrowth',
    effects: { boardGrowthChance: 5 }
  },

  // 4. SECOND CHANCE - Starting graces
  {
    id: 'second-chance',
    name: 'Second Chance',
    rarity: 'common',
    level: 1,
    price: 0,
    description: '+1 starting grace.',
    shortDescription: 'Extra starting grace',
    flavorText: 'Graces are consumed when they protect you from a near-miss. Once used, they\'re gone!',
    icon: 'lorc/clover',
    effects: { graces: 1 }
  },

  // 5. FORTUNE TOKEN - Grace gain on match
  {
    id: 'fortune-token',
    name: 'Fortune Token',
    rarity: 'common',
    level: 1,
    price: 0,
    description: '5% chance to gain grace on match.',
    shortDescription: 'Gain graces on match',
    flavorText: 'After a valid match, has a chance to grant +1 grace. Graces protect you from near-miss invalid matches.',
    icon: 'lorc/cycle',
    specialEffect: 'graceGain',
    effects: { graceGainChance: 5 }
  },

  // 6. LIFE VESSEL - Max health
  {
    id: 'life-vessel',
    name: 'Life Vessel',
    rarity: 'common',
    level: 1,
    price: 0,
    description: '+1 max health and heals you by 1.',
    shortDescription: 'Increased max health + heal',
    flavorText: 'Increases your maximum health pool and restores some health. You lose 1 health when picking an invalid set without a grace to protect you.',
    icon: 'lorc/heart-inside',
    effects: { maxHealth: 1, health: 1 }
  },

  // 7. MENDING CHARM - Heal on match
  {
    id: 'mending-charm',
    name: 'Mending Charm',
    rarity: 'common',
    level: 1,
    price: 0,
    description: '5% chance to heal on match.',
    shortDescription: 'Heal on match',
    flavorText: 'After a valid match, has a chance to restore 1 health. Cannot heal above your maximum health.',
    icon: 'lorc/shining-heart',
    specialEffect: 'healing',
    effects: { healingChance: 5 }
  },

  // 8. CRYSTAL ORB - Max hints capacity
  {
    id: 'crystal-orb',
    name: 'Crystal Orb',
    rarity: 'common',
    level: 1,
    price: 0,
    description: '+1 max hints (+1 hint).',
    shortDescription: 'More hint capacity',
    flavorText: 'Hints highlight a valid set on the board when activated. Earn hints from matches to fill your capacity.',
    icon: 'lorc/floating-crystal',
    effects: { maxHints: 1 }
  },

  // 9. SEEKER LENS - Hint gain on match
  {
    id: 'seeker-lens',
    name: 'Seeker Lens',
    rarity: 'common',
    level: 1,
    price: 0,
    description: '5% chance to gain hint on match.',
    shortDescription: 'Gain hints on match',
    flavorText: 'After a valid match, has a chance to gain +1 hint. Use hints to highlight valid sets when you\'re stuck.',
    icon: 'lorc/light-bulb',
    specialEffect: 'hintGain',
    effects: { hintGainChance: 5 }
  },

  // 10. SCHOLAR'S TOME - XP gain on match
  {
    id: 'scholars-tome',
    name: 'Scholar\'s Tome',
    rarity: 'common',
    level: 1,
    price: 0,
    description: '10% chance to gain +1 XP on match.',
    shortDescription: 'Gain XP on match',
    flavorText: 'Ancient wisdom grants bonus experience. Multiple tomes stack their chances - over 100% guarantees rewards with a chance for more.',
    icon: 'lorc/open-book',
    specialEffect: 'xpGain',
    effects: { xpGainChance: 10 }
  },

  // 11. FORTUNE'S FAVOR - Coin gain on match
  {
    id: 'fortunes-favor',
    name: 'Fortune\'s Favor',
    rarity: 'common',
    level: 1,
    price: 0,
    description: '10% chance to gain +1 coin on match.',
    shortDescription: 'Gain coins on match',
    flavorText: 'Lady Luck smiles upon you, granting bonus coins. Multiple fortunes stack their chances - over 100% guarantees rewards with a chance for more.',
    icon: 'lorc/crown-coin',
    specialEffect: 'coinGain',
    effects: { coinGainChance: 10 }
  },

  // 12. CHRONO SHARD - Starting time bonus
  {
    id: 'chrono-shard',
    name: 'Chrono Shard',
    rarity: 'common',
    level: 1,
    price: 0,
    description: '+10s starting time.',
    shortDescription: 'More starting time',
    flavorText: 'Time is precious. Start each round with a bit more of it.',
    icon: 'lorc/hourglass',
    effects: { startingTime: 10 }
  },

  // 13. TIME DROP - Time gain on match
  {
    id: 'time-drop',
    name: 'Time Drop',
    rarity: 'common',
    level: 1,
    price: 0,
    description: '5% chance for time gain (+5s).',
    shortDescription: '5% chance for +5s',
    flavorText: 'Each drop of time extends your moment.',
    icon: 'lorc/stopwatch',
    specialEffect: 'timeGain',
    effects: { timeGainChance: 5, timeGainAmount: 5 }
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

// Get a random weapon from the pool
// In the new fusion system, all weapons are "common" - progression comes from leveling
export const getRandomWeapon = (playerWeapons?: Weapon[]): Weapon => {
  let availableWeapons = [...WEAPONS];

  // Filter out weapons the player already has at max count
  if (playerWeapons) {
    availableWeapons = availableWeapons.filter(w => canObtainWeapon(w, playerWeapons));
    if (availableWeapons.length === 0) {
      availableWeapons = [...WEAPONS]; // Fall back to all if none available
    }
  }

  return availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
};

// Generate random weapons for level up options
export const generateLevelUpWeapons = (count: number, playerWeapons?: Weapon[]): Weapon[] => {
  const weapons: Weapon[] = [];
  for (let i = 0; i < count; i++) {
    weapons.push(getRandomWeapon(playerWeapons));
  }
  return weapons;
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

  // Legacy: Get starting weapons for backward compatibility
  const startingWeapons = character.startingWeapons.map(weaponName => {
    const weapon = getWeaponByName(weaponName);
    if (!weapon) {
      throw new Error(`Starting weapon ${weaponName} not found`);
    }
    return weapon;
  });

  // New inventory system: Create 4-slot weapon and passive arrays
  const inventory: PlayerInventory = {
    weapons: [null, null, null, null],
    passives: [null, null, null, null],
  };

  // Place starting items in correct slots based on type
  let weaponSlot = 0;
  let passiveSlot = 0;

  character.startingWeapons.forEach(weaponName => {
    const fusionItem = getFusionWeaponByName(weaponName);
    if (!fusionItem) {
      throw new Error(`Starting weapon ${weaponName} not found in fusion system`);
    }

    // Create a copy with unique ID and level 1
    const itemCopy: FusionWeapon = {
      ...fusionItem,
      id: `${fusionItem.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level: 1,
    };

    if (fusionItem.type === 'weapon') {
      if (weaponSlot < 4) {
        inventory.weapons[weaponSlot] = itemCopy;
        weaponSlot++;
      }
    } else {
      if (passiveSlot < 4) {
        inventory.passives[passiveSlot] = itemCopy;
        passiveSlot++;
      }
    }
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
    items: [],
    inventory,
  };
};

// Helper function to calculate total player stats with all effects from weapons and items
export const calculatePlayerTotalStats = (player: Player): PlayerStats => {
  const totalStats = { ...player.stats };

  // Apply weapon effects
  player.weapons.forEach((weapon: Weapon) => {
    Object.entries(weapon.effects).forEach(([key, value]) => {
      const currentValue = totalStats[key as keyof PlayerStats];
      if (typeof value === 'number' && typeof currentValue === 'number') {
        (totalStats as unknown as Record<string, number>)[key] = currentValue + value;
      }
    });
  });

  // Apply item effects and drawbacks
  player.items.forEach((item: Item) => {
    // Apply effects
    Object.entries(item.effects).forEach(([key, value]) => {
      const currentValue = totalStats[key as keyof PlayerStats];
      if (typeof value === 'number' && typeof currentValue === 'number') {
        (totalStats as unknown as Record<string, number>)[key] = currentValue + value;
      }
    });

    // Apply drawbacks
    Object.entries(item.drawbacks).forEach(([key, value]) => {
      const currentValue = totalStats[key as keyof PlayerStats];
      if (typeof value === 'number' && typeof currentValue === 'number') {
        (totalStats as unknown as Record<string, number>)[key] = currentValue + value;
      }
    });
  });

  return totalStats;
};
