import { Character, Enemy, Item, Weapon, PlayerStats, GameState, Player } from '../types';
import { STARTING_STATS } from './gameConfig';

// Default player stats - uses values from gameConfig for easy tweaking
export const DEFAULT_PLAYER_STATS: PlayerStats = {
  level: 0,
  money: STARTING_STATS.money,
  experience: 0,
  experienceGainPercent: 100,
  luck: 0,
  maxWeapons: 3,
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
  mulligans: 0,
  bombTimer: 20,
  additionalPoints: 0,
  deflectPercent: 0,
  criticalChance: 0,
  timeFreezePercent: 0,
  timeFreezeAmount: 15,
  hints: STARTING_STATS.hints,
  // Co-op specific
  hintPasses: 0,
};

// Characters
export const CHARACTERS: Character[] = [
  {
    name: 'Orange Tabby',
    description: 'Uses multiple lives to get more Mulligans',
    startingWeapon: 'Bamboo',
    startingItems: [],
    icon: 'lorc/cat',
    baseStats: {
      mulligans: 2,
      luck: -5,
      // Special ability: 20% chance to not consume a Mulligan when used (9 lives theme)
    }
  },
  {
    name: 'Sly Fox',
    description: 'Specializes in bomb and trap synergy',
    startingWeapon: 'Flint',
    startingItems: [],
    icon: 'caro-asercion/fox',
    baseStats: {
      // +15% chance bombs appear and +10% chance bombs have better rewards
      fieldSize: -2,
    }
  },
  {
    name: 'Corgi',
    description: 'Gets extra match hints and free rerolls',
    startingWeapon: 'Carrot',
    startingItems: [],
    icon: 'delapouite/sitting-dog',
    baseStats: {
      matchHints: 2,
      freeRerolls: 1,
      timeWarpPercent: -10, // Time runs slightly faster
    }
  },
  {
    name: 'Emperor Penguin',
    description: 'Money-focused with increased commerce',
    startingWeapon: 'Dirt',
    startingItems: [],
    icon: 'delapouite/penguin',
    baseStats: {
      commerce: 5,
      experienceGainPercent: -10,
    }
  },
  {
    name: 'Pelican',
    description: 'Can make cards become fragile',
    startingWeapon: 'Beak',
    startingItems: [],
    icon: 'delapouite/eating-pelican',
    baseStats: {
      // 5% chance any matched card becomes Fragile
      // 50% chance of discarding 1 coin each wave
    }
  },
  {
    name: 'Badger',
    description: 'Has a larger field view',
    startingWeapon: 'Hoe',
    startingItems: [],
    icon: 'caro-asercion/badger',
    baseStats: {
      fieldSize: 2,
      luck: -10,
    }
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
  //     mulligans: -2,
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

// Weapons
export const WEAPONS: Weapon[] = [
  {
    name: 'Flint',
    level: 1,
    description: '20% chance to start a fire on a card. This fire could spread. Dodge is decreased by 20%.',
    icon: 'delapouite/flint-spark',
    effects: {
      chanceOfFire: 20,
      dodgePercent: -20
    }
  },
  {
    name: 'Bamboo',
    level: 1,
    description: '20% to deal one extra damage to a field card.',
    icon: 'delapouite/bamboo',
    effects: {
      damagePercent: 20
    }
  },
  {
    name: 'Carrot',
    level: 1,
    description: 'Slows time by 1.1x.',
    icon: 'delapouite/carrot',
    effects: {
      timeWarpPercent: 10
    }
  },
  {
    name: 'Beak',
    level: 1,
    description: '10% chance to inflict fragile on a field card that you\'ve matched with.',
    icon: 'lorc/bird-claw',
    effects: {
      // Special effect for inflicting fragile would be implemented in game logic
    }
  },
  {
    name: 'Dirt',
    level: 1,
    description: 'Increases field size by 1.',
    icon: 'delapouite/stone-pile',
    effects: {
      fieldSize: 1
    }
  },
  {
    name: 'Talon',
    level: 1,
    description: '25% chance to remove bramble upon match. Get +1 coin on removal.',
    icon: 'lorc/claw-slashes',
    effects: {
      // Special effect for removing bramble would be implemented in game logic
    }
  },
  {
    name: 'Hoe',
    level: 1,
    description: '10% chance to increase field size by 1 for the round on a match.',
    icon: 'delapouite/rake',
    effects: {
      // Special effect for temporary field size increase would be implemented in game logic
    }
  },
];

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

  const startingWeapon = getWeaponByName(character.startingWeapon);
  if (!startingWeapon) {
    throw new Error(`Starting weapon ${character.startingWeapon} not found`);
  }

  const startingItems = character.startingItems.map(itemName => {
    const item = getItemByName(itemName);
    if (!item) {
      throw new Error(`Starting item ${itemName} not found`);
    }
    return item;
  });

  return {
    id,
    username,
    character,
    stats: {
      ...DEFAULT_PLAYER_STATS,
      ...character.baseStats
    },
    weapons: [startingWeapon],
    items: startingItems
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