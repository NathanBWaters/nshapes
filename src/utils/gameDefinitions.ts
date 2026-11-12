import { Character, Weapon, PlayerStats, Player, WeaponRarity, BridgeTriggerType, BridgeEffectType } from '../types';
import { STARTING_STATS, getRarityChancesForRound, DEFAULT_EFFECT_CAPS } from './gameConfig';

export { DEFAULT_EFFECT_CAPS };

// Default player stats - uses values from gameConfig for easy tweaking
export const DEFAULT_PLAYER_STATS: PlayerStats = {
  level: 0,
  money: STARTING_STATS.money,
  experience: 0,
  experienceGainPercent: 100,
  luck: 0,
  scavengingPercent: 0,
  health: STARTING_STATS.health,
  maxHealth: STARTING_STATS.maxHealth,
  fieldSize: STARTING_STATS.fieldSize,
  freeRerolls: STARTING_STATS.freeRerolls,
  drawIncrease: 0,
  explosion: 0,
  damage: 1,
  damagePercent: 0,
  maxTimeIncrease: 0,
  timeWarpPercent: 0,
  matchHints: 0,
  matchPossibilityHints: 0,
  matchIntervalHintPercent: 0,
  dodgeAttackBackPercent: 0,
  dodgeAttackBackAmount: 1,
  graces: STARTING_STATS.graces,
  maxGraces: STARTING_STATS.maxGraces,
  bombTimer: 20,
  additionalPoints: 0,
  timeFreezePercent: 0,
  hints: STARTING_STATS.hints,
  maxHints: STARTING_STATS.maxHints,

  // New weapon effect stats
  explosionChance: STARTING_STATS.explosionChance,
  explosionDamage: STARTING_STATS.explosionDamage,
  laserDamage: STARTING_STATS.laserDamage,
  ricochetDamage: STARTING_STATS.ricochetDamage,
  burnDamage: STARTING_STATS.burnDamage,
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

  // Effect caps - the defaults from game/effectCaps.ts
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
];

// Weapon system - one entry per weapon. A weapon grows stronger through levels
// (`perLevel`: flat gains per level, found as Adventure rewards) and Workshop
// tuning (multipliers on those numbers), not through separate copies.
export const WEAPONS: Weapon[] = [
  // 1. BLAST POWDER - Explosive adjacent cards on match
  {
    id: 'blast-powder',
    name: 'Blast Powder',
    rarity: 'common',
    level: 1,
    price: 8,
    description: '10% chance to explode adjacent cards. Destroyed cards give +1 point and +1 coin each.',
    shortDescription: 'May explode adjacent cards on match',
    flavorText: 'After matching, each adjacent card (up/down/left/right) has a chance to explode. Exploded cards are destroyed and award +1 point and +1 coin each.',
    icon: 'lorc/bright-explosion',
    specialEffect: 'explosive',
    effects: { explosionChance: 10, explosionDamage: 0.25 },
    perLevel: { explosionChance: 6, explosionDamage: 0.25 }
  },

  // 2. ORACLE EYE - Auto-hint system
  {
    id: 'oracle-eye',
    name: 'Oracle Eye',
    rarity: 'common',
    level: 1,
    price: 6,
    description: '15% chance to reveal 1 card from a valid set after a pause.',
    shortDescription: 'Hint when stuck',
    flavorText: 'After 15 seconds without a match, has a chance to highlight one card guaranteed to be part of a valid set. You still need to find the other two!',
    icon: 'lorc/sheikah-eye',
    specialEffect: 'autoHint',
    effects: { autoHintChance: 15 },
    perLevel: { autoHintChance: 5 }
  },
  // 2.5. MYSTIC SIGHT - Enhanced autohint reveals (legendary only)
  {
    id: 'mystic-sight',
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
    perLevel: { enhancedHintChance: 10 },
    maxCount: 1  // Unique - only one can be owned
  },

  // 3. FIELD STONE - Starting board size
  {
    id: 'field-stone',
    name: 'Field Stone',
    rarity: 'common',
    level: 1,
    price: 7,
    description: '+2 starting board size.',
    shortDescription: 'Larger starting board',
    flavorText: 'Start each round with more cards on the board. More cards means more possible matches to find.',
    icon: 'lorc/field',
    effects: { fieldSize: 2 },
    perLevel: { fieldSize: 1 }
  },

  // 4. GROWTH SEED - Board grows on match
  {
    id: 'growth-seed',
    name: 'Growth Seed',
    rarity: 'common',
    level: 1,
    price: 6,
    description: '6% chance to expand board on match.',
    shortDescription: 'Board expands on match',
    flavorText: 'After matching, has a chance to add new cards to the board. A growing board gives you more options and potential matches.',
    icon: 'delapouite/card-exchange',
    specialEffect: 'boardGrowth',
    effects: { boardGrowthChance: 6 },
    perLevel: { boardGrowthChance: 4 }
  },

  // 5. FLINT SPARK - Fire starter
  {
    id: 'flint-spark',
    name: 'Flint Spark',
    rarity: 'common',
    level: 1,
    price: 8,
    description: '10% chance to ignite adjacent cards. Burned cards give +1 point and +1 coin each.',
    shortDescription: 'May ignite adjacent cards',
    flavorText: 'After matching, adjacent cards may catch fire. Burning cards are destroyed after 0.25 seconds, awarding points. Fire has a 10% chance to spread to neighbors when a card burns out.',
    icon: 'lorc/campfire',
    specialEffect: 'fire',
    effects: { fireSpreadChance: 10, burnDamage: 0.25 },
    perLevel: { fireSpreadChance: 6, burnDamage: 0.25 }
  },

  // 6. SECOND CHANCE - Starting graces
  {
    id: 'second-chance',
    name: 'Second Chance',
    rarity: 'common',
    level: 1,
    price: 5,
    description: '+1 starting grace.',
    shortDescription: 'Extra starting grace',
    flavorText: 'Graces are consumed when they protect you from a near-miss. Once used, they\'re gone!',
    icon: 'lorc/clover',
    effects: { graces: 1 },
    perLevel: { graces: 1 }
  },

  // 7. FORTUNE TOKEN - Grace gain on match
  {
    id: 'fortune-token',
    name: 'Fortune Token',
    rarity: 'common',
    level: 1,
    price: 6,
    description: '6% chance to gain grace on match.',
    shortDescription: 'Gain graces on match',
    flavorText: 'After a valid match, has a chance to grant +1 grace. Graces protect you from near-miss invalid matches.',
    icon: 'lorc/cycle',
    specialEffect: 'graceGain',
    effects: { graceGainChance: 6 },
    perLevel: { graceGainChance: 4 }
  },

  // 8. LIFE VESSEL - Max health
  {
    id: 'life-vessel',
    name: 'Life Vessel',
    rarity: 'common',
    level: 1,
    price: 6,
    description: '+1 max health and heals you by 1.',
    shortDescription: 'Increased max health + heal',
    flavorText: 'Increases your maximum health pool and restores some health. You lose 1 health when picking an invalid set without a grace to protect you.',
    icon: 'lorc/heart-inside',
    effects: { maxHealth: 1, health: 1 },
    perLevel: { maxHealth: 0.5, health: 0.5 }
  },

  // 9. MENDING CHARM - Heal on match
  {
    id: 'mending-charm',
    name: 'Mending Charm',
    rarity: 'common',
    level: 1,
    price: 5,
    description: '6% chance to heal on match.',
    shortDescription: 'Heal on match',
    flavorText: 'After a valid match, has a chance to restore 1 health. Cannot heal above your maximum health.',
    icon: 'lorc/shining-heart',
    specialEffect: 'healing',
    effects: { healingChance: 6 },
    perLevel: { healingChance: 4 }
  },

  // 10. CRYSTAL ORB - Max hints capacity
  {
    id: 'crystal-orb',
    name: 'Crystal Orb',
    rarity: 'common',
    level: 1,
    price: 5,
    description: '+1 max hints (+1 hint).',
    shortDescription: 'More hint capacity',
    flavorText: 'Hints highlight a valid set on the board when activated. Earn hints from matches to fill your capacity.',
    icon: 'lorc/floating-crystal',
    effects: { maxHints: 1 },
    perLevel: { maxHints: 1 }
  },

  // 11. SEEKER LENS - Hint gain on match
  {
    id: 'seeker-lens',
    name: 'Seeker Lens',
    rarity: 'common',
    level: 1,
    price: 6,
    description: '6% chance to gain hint on match.',
    shortDescription: 'Gain hints on match',
    flavorText: 'After a valid match, has a chance to gain +1 hint. Use hints to highlight valid sets when you\'re stuck.',
    icon: 'lorc/light-bulb',
    specialEffect: 'hintGain',
    effects: { hintGainChance: 6 },
    perLevel: { hintGainChance: 4 }
  },

  // 12. SCHOLAR'S TOME - XP gain on match
  {
    id: 'scholars-tome',
    name: 'Scholar\'s Tome',
    rarity: 'common',
    level: 1,
    price: 8,
    description: '20% chance to gain +1 XP on match.',
    shortDescription: 'Gain XP on match',
    flavorText: 'Ancient wisdom grants bonus experience. Multiple tomes stack their chances - over 100% guarantees rewards with a chance for more.',
    icon: 'lorc/open-book',
    specialEffect: 'xpGain',
    effects: { xpGainChance: 20 },
    perLevel: { xpGainChance: 8 }
  },

  // 13. FORTUNE'S FAVOR - Coin gain on match
  {
    id: 'fortunes-favor',
    name: 'Fortune\'s Favor',
    rarity: 'common',
    level: 1,
    price: 8,
    description: '20% chance to gain +1 coin on match.',
    shortDescription: 'Gain coins on match',
    flavorText: 'Lady Luck smiles upon you, granting bonus coins. Multiple fortunes stack their chances - over 100% guarantees rewards with a chance for more.',
    icon: 'lorc/crown-coin',
    specialEffect: 'coinGain',
    effects: { coinGainChance: 20 },
    perLevel: { coinGainChance: 6 }
  },

  // 14. CHRONO SHARD - Starting time bonus
  {
    id: 'chrono-shard',
    name: 'Chrono Shard',
    rarity: 'common',
    level: 1,
    price: 7,
    description: '+15s starting time. Raises time cap.',
    shortDescription: 'More starting time',
    flavorText: 'Also raises the cap for time gained during matches, making Time Drop weapons more effective.',
    icon: 'lorc/hourglass',
    effects: { startingTime: 15 },
    perLevel: { startingTime: 10 }
  },

  // 15. TIME DROP - Time gain on match (each rolls independently like lasers)
  {
    id: 'time-drop',
    name: 'Time Drop',
    rarity: 'common',
    level: 1,
    price: 6,
    description: '5% chance for time gain (+10s). Max 5 triggers per round.',
    shortDescription: '5% chance for +10s',
    flavorText: 'Time can only increase up to your starting max. Time gains are limited to 5 per round; challenge legendaries can raise that for a round.',
    icon: 'lorc/stopwatch',
    specialEffect: 'timeGain',
    effects: { timeGainChance: 5, timeGainAmount: 10 },
    perLevel: { timeGainChance: 3, timeGainAmount: 2 }
  },

  // 16. PRISMATIC RAY - Laser destroys row/column
  {
    id: 'prismatic-ray',
    name: 'Prismatic Ray',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '4% chance to destroy entire row or column. Destroyed cards give +2 points each.',
    shortDescription: 'May destroy a row or column',
    flavorText: 'Each laser weapon rolls independently on every match. When triggered, destroys all cards in either a row or column (randomly chosen). Multiple lasers can fire on the same match. Destroyed cards award +2 points each.',
    icon: 'lorc/laser-warning',
    specialEffect: 'laser',
    effects: { laserChance: 4, laserDamage: 0.5 },
    perLevel: { laserChance: 2.5, laserDamage: 0.5 }
  },

  // 17. CHAOS SHARD - Ricochet chain destruction
  {
    id: 'chaos-shard',
    name: 'Chaos Shard',
    rarity: 'common',
    level: 1,
    price: 8,
    description: '10% chance to ricochet, 5% chain chance.',
    shortDescription: 'Random ricochet chains',
    flavorText: 'After matching, has a chance to destroy a random card anywhere on the board. Each destroyed card may chain to another random target. Chains can theoretically continue forever with lucky rolls!',
    icon: 'lorc/chained-arrow-heads',
    specialEffect: 'ricochet',
    effects: { ricochetChance: 10, ricochetChainChance: 5, ricochetDamage: 0.25 },
    perLevel: { ricochetChance: 6, ricochetChainChance: 3, ricochetDamage: 0.25 }
  },

  // 18. ECHO STONE - Auto-match another set on the board
  {
    id: 'echo-stone',
    name: 'Echo Stone',
    rarity: 'common',
    level: 1,
    price: 8,
    description: '5% chance to auto-match another set on the board.',
    shortDescription: 'May auto-match another set',
    flavorText: 'After matching, has a chance to automatically find and match another valid set on the board. The echoed match triggers all on-match effects like explosions, healing, and more!',
    icon: 'lorc/echo-ripples',
    specialEffect: 'echo',
    effects: { echoChance: 5 },
    perLevel: { echoChance: 3 }
  },

  // 19. CHAIN REACTION - Double auto-match (legendary only)
  {
    id: 'chain-reaction',
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
    perLevel: { chainReactionChance: 10 },
    maxCount: 1  // Unique - only one can be owned
  },

  // Chaos Conduit: On explosion → grace
  {
    id: 'chaos-conduit',
    name: 'Chaos Conduit',
    rarity: 'legendary',
    level: 1,
    price: 40,
    description: 'On explosion: 20% chance to gain +1 grace.',
    shortDescription: 'Explosions give grace',
    flavorText: 'Channel the destruction into divine protection.',
    icon: 'lorc/lightning-helix',
    specialEffect: 'bridge',
    effects: {},
    perLevel: { bridgeChance: 6 },
    bridgeEffect: { trigger: 'onExplosion', chance: 20, effect: 'gainGrace', amount: 1 },
    maxCount: 3,
  },

  // Temporal Rift: On time gain → echo
  {
    id: 'temporal-rift',
    name: 'Temporal Rift',
    rarity: 'legendary',
    level: 1,
    price: 45,
    description: 'On time gain: 25% chance to trigger echo.',
    shortDescription: 'Time gain triggers echo',
    flavorText: 'Bend time, and the echoes of the past return.',
    icon: 'lorc/time-trap',
    specialEffect: 'bridge',
    effects: {},
    perLevel: { bridgeChance: 6 },
    bridgeEffect: { trigger: 'onTimeGain', chance: 25, effect: 'triggerEcho' },
    maxCount: 2,
  },

  // Soul Harvest: On destruction → heal
  {
    id: 'soul-harvest',
    name: 'Soul Harvest',
    rarity: 'legendary',
    level: 1,
    price: 35,
    description: 'On card destruction: 10% chance to heal 1 HP.',
    shortDescription: 'Destruction heals you',
    flavorText: 'Every falling card feeds your life force.',
    icon: 'lorc/death-note',
    specialEffect: 'bridge',
    effects: {},
    perLevel: { bridgeChance: 3 },
    bridgeEffect: { trigger: 'onDestruction', chance: 10, effect: 'heal', amount: 1 },
    maxCount: 3,
  },

  // Cascade Core: On echo → fire
  {
    id: 'cascade-core',
    name: 'Cascade Core',
    rarity: 'legendary',
    level: 1,
    price: 40,
    description: 'On echo: 20% chance to set a random card on fire.',
    shortDescription: 'Echoes ignite cards',
    flavorText: 'The ripples of resonance carry flames.',
    icon: 'lorc/fire-ring',
    specialEffect: 'bridge',
    effects: {},
    perLevel: { bridgeChance: 6 },
    bridgeEffect: { trigger: 'onEcho', chance: 20, effect: 'fireCard', amount: 1 },
    maxCount: 2,
  },

  // Fortune's Blessing: On coin gain → hint
  {
    id: 'fortunes-blessing',
    name: "Fortune's Blessing",
    rarity: 'legendary',
    level: 1,
    price: 35,
    description: 'On coin gain: 20% chance to gain +1 hint.',
    shortDescription: 'Coins reveal hints',
    flavorText: 'Wealth brings wisdom to those who seek it.',
    icon: 'lorc/crown-coin',
    specialEffect: 'bridge',
    effects: {},
    perLevel: { bridgeChance: 6 },
    bridgeEffect: { trigger: 'onCoinGain', chance: 20, effect: 'gainHint', amount: 1 },
    maxCount: 3,
  },

  // Wisdom Chain: On XP gain → coin
  {
    id: 'wisdom-chain',
    name: 'Wisdom Chain',
    rarity: 'legendary',
    level: 1,
    price: 30,
    description: 'On XP gain: 20% chance to gain +1 coin.',
    shortDescription: 'XP yields coins',
    flavorText: 'Knowledge has always been worth its weight in gold.',
    icon: 'lorc/bookmarklet',
    specialEffect: 'bridge',
    effects: {},
    perLevel: { bridgeChance: 6 },
    bridgeEffect: { trigger: 'onXPGain', chance: 20, effect: 'gainCoin', amount: 1 },
    maxCount: 3,
  },

  // Grace Conduit: On grace use → laser
  {
    id: 'grace-conduit',
    name: 'Grace Conduit',
    rarity: 'legendary',
    level: 1,
    price: 45,
    description: 'On grace use: 30% chance to fire a laser.',
    shortDescription: 'Grace fires laser',
    flavorText: 'Divine mercy becomes divine wrath.',
    icon: 'lorc/angel-outfit',
    specialEffect: 'bridge',
    effects: {},
    perLevel: { bridgeChance: 8 },
    bridgeEffect: { trigger: 'onGraceUse', chance: 30, effect: 'triggerLaser' },
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
    perLevel: { bridgeChance: 8 },
    bridgeEffect: { trigger: 'onHealthLoss', chance: 30, effect: 'explosion' },
    maxCount: 2,
  },

  // CONNECTOR WEAPONS - Link board positions together
  // When a card at a connected position is destroyed, the linked card is too
  {
    id: 'connector',
    name: 'Link Stone',
    rarity: 'common',
    level: 1,
    price: 8,
    description: '15% chance on match to connect two of the matched positions for the rest of the round. Connected cards are destroyed together.',
    shortDescription: '15% link on match',
    flavorText: 'What is joined cannot be undone.',
    icon: 'lorc/chained-heart',
    specialEffect: 'connector',
    effects: { connectionChance: 15 },
    perLevel: { connectionChance: 5 }
  },

  // REVENGE LINKER - Create connections when taking damage
  {
    id: 'revenge-linker',
    name: 'Revenge Linker',
    rarity: 'legendary',
    level: 1,
    price: 40,
    description: 'When you lose health: 3 separate 20% rolls. Each success connects two random positions in a triangle pattern.',
    shortDescription: 'Damage creates links',
    flavorText: 'Pain weaves a web of vengeance.',
    icon: 'lorc/broken-heart-zone',
    specialEffect: 'revengeLinker',
    effects: {},
    maxCount: 1,
  },

  // WEB WEAVER - Start rounds with connections
  {
    id: 'web-weaver',
    name: 'Web Spinner',
    rarity: 'common',
    level: 1,
    price: 8,
    description: 'Start each round with 1 random connection already placed.',
    shortDescription: 'Start with 1 link',
    flavorText: 'The web is always ready.',
    icon: 'lorc/cobweb',
    specialEffect: 'webWeaver',
    effects: { startingConnections: 1 },
    perLevel: { startingConnections: 1 }
  },

  // ECHO CHAMBER - Time bonus on connected destruction
  {
    id: 'echo-chamber',
    name: 'Echo Chamber',
    rarity: 'common',
    level: 1,
    price: 8,
    description: 'Gain +1 second each time a card is destroyed via a connection.',
    shortDescription: '+1s on linked destroy',
    flavorText: 'Time echoes through the links.',
    icon: 'lorc/linked-rings',
    specialEffect: 'echoChamber',
    effects: { echoTimeBonusPerLink: 1 },
    perLevel: { echoTimeBonusPerLink: 0.5 }
  },

  // SYMPATHETIC FLAMES - Fire spreads faster on connected positions
  {
    id: 'sympathetic-flames',
    name: 'Sympathetic Flames',
    rarity: 'rare',
    level: 1,
    price: 15,
    description: 'Cards at connected positions have 2x fire spread chance.',
    shortDescription: '2x fire on linked',
    flavorText: 'Where one burns, all burn.',
    icon: 'lorc/fire-ring',
    specialEffect: 'sympatheticFlames',
    effects: { linkedFireMultiplier: 2 },
  },

  // NEURAL NETWORK - Bonus connections on link creation
  {
    id: 'neural-network',
    name: 'Neural Network',
    rarity: 'legendary',
    level: 1,
    price: 40,
    description: 'When you create a connection, 30% chance to create a second random connection.',
    shortDescription: '30% bonus link',
    flavorText: 'The network grows itself.',
    icon: 'lorc/brainstorm',
    specialEffect: 'neuralNetwork',
    effects: { bonusConnectionChance: 30 },
    perLevel: { bonusConnectionChance: 10 },
    maxCount: 1,
  },
];

/**
 * Weapons that no longer exist under these ids, for reading old saves. Each
 * family of rare/epic/legendary copies is now one weapon that grows through
 * levels: an old copy maps to that weapon and to the level it stands for
 * (`tier` = level - 1, a floor on the weapon's level). Weapons that bundled
 * two effects (the epics) map to their main effect. The Mastery weapons and
 * the cap-raising legendaries were removed outright and map to null.
 */
export const LEGACY_WEAPON_IDS: Readonly<Record<string, { id: string; tier: number } | null>> = {
  'blast-powder-common': { id: 'blast-powder', tier: 0 },
  'blast-powder-rare': { id: 'blast-powder', tier: 2 },
  'inferno-charge': { id: 'blast-powder', tier: 2 },
  'flint-spark-common': { id: 'flint-spark', tier: 0 },
  'flint-spark-rare': { id: 'flint-spark', tier: 2 },
  'ember-heart': { id: 'flint-spark', tier: 2 },
  'fortune-token-common': { id: 'fortune-token', tier: 0 },
  'fortune-token-rare': { id: 'fortune-token', tier: 2 },
  'lucky-charm': { id: 'fortune-token', tier: 3 },
  'mending-charm-common': { id: 'mending-charm', tier: 0 },
  'mending-charm-rare': { id: 'mending-charm', tier: 2 },
  'restoration-aura': { id: 'mending-charm', tier: 3 },
  'prismatic-ray-common': { id: 'prismatic-ray', tier: 0 },
  'prismatic-ray-rare': { id: 'prismatic-ray', tier: 2 },
  'spectrum-annihilator': { id: 'prismatic-ray', tier: 3 },
  'echo-stone-common': { id: 'echo-stone', tier: 0 },
  'echo-stone-rare': { id: 'echo-stone', tier: 2 },
  'resonance-crystal': { id: 'echo-stone', tier: 3 },
  'field-stone-common': { id: 'field-stone', tier: 0 },
  'field-stone-rare': { id: 'field-stone', tier: 2 },
  'growth-seed-common': { id: 'growth-seed', tier: 0 },
  'growth-seed-rare': { id: 'growth-seed', tier: 2 },
  'second-chance-common': { id: 'second-chance', tier: 0 },
  'second-chance-rare': { id: 'second-chance', tier: 2 },
  'life-vessel-common': { id: 'life-vessel', tier: 0 },
  'life-vessel-rare': { id: 'life-vessel', tier: 2 },
  'crystal-orb-common': { id: 'crystal-orb', tier: 0 },
  'crystal-orb-rare': { id: 'crystal-orb', tier: 1 },
  'seeker-lens-common': { id: 'seeker-lens', tier: 0 },
  'seeker-lens-rare': { id: 'seeker-lens', tier: 2 },
  'scholars-tome-common': { id: 'scholars-tome', tier: 0 },
  'scholars-tome-rare': { id: 'scholars-tome', tier: 2 },
  'fortunes-favor-common': { id: 'fortunes-favor', tier: 0 },
  'fortunes-favor-rare': { id: 'fortunes-favor', tier: 2 },
  'golden-touch': { id: 'fortunes-favor', tier: 1 },
  'chrono-shard-common': { id: 'chrono-shard', tier: 0 },
  'chrono-shard-rare': { id: 'chrono-shard', tier: 2 },
  'time-drop-common': { id: 'time-drop', tier: 0 },
  'time-drop-rare': { id: 'time-drop', tier: 2 },
  'chaos-shard-common': { id: 'chaos-shard', tier: 0 },
  'chaos-shard-rare': { id: 'chaos-shard', tier: 2 },
  'connector-common': { id: 'connector', tier: 0 },
  'connector-rare': { id: 'connector', tier: 1 },
  'connector-legendary': { id: 'connector', tier: 2 },
  'web-weaver-common': { id: 'web-weaver', tier: 0 },
  'web-weaver-rare': { id: 'web-weaver', tier: 1 },
  'echo-chamber-common': { id: 'echo-chamber', tier: 0 },
  'echo-chamber-rare': { id: 'echo-chamber', tier: 1 },
  'echo-mastery': null,
  'laser-mastery': null,
  'grace-mastery': null,
  'explosion-mastery': null,
  'hint-mastery': null,
  'time-mastery': null,
  'healing-mastery': null,
  'fire-mastery': null,
  'ricochet-mastery': null,
  'growth-mastery': null,
  'coin-mastery': null,
  'time-trigger-mastery': null,
  'oracle-eye-common': { id: 'oracle-eye', tier: 0 },
  'oracle-eye-rare': { id: 'oracle-eye', tier: 2 },
  'mystic-sight-legendary': { id: 'mystic-sight', tier: 0 },
  'chain-reaction-legendary': { id: 'chain-reaction', tier: 0 },
  'terra-foundation': { id: 'field-stone', tier: 2 },
  'fortunes-shield': { id: 'second-chance', tier: 3 },
  'clairvoyant-sphere': { id: 'crystal-orb', tier: 3 },
  'arcane-codex': { id: 'scholars-tome', tier: 1 },
  'temporal-core': { id: 'chrono-shard', tier: 3 },
  'vital-core': { id: 'life-vessel', tier: 3 },
  'prophets-vision': { id: 'oracle-eye', tier: 1 },
  'life-bloom': { id: 'growth-seed', tier: 3 },
  'enlightened-eye': { id: 'seeker-lens', tier: 3 },
  'hourglass-of-ages': { id: 'time-drop', tier: 3 },
  'entropy-engine': { id: 'chaos-shard', tier: 2 },
  'fortunes-eye': null,
  'prismatic-perfection': null,
  'tabula-rasa': null,
  'desperate-measures': null,
  snowball: null,
};

/** What an old weapon's rarity was, so a refund of its Workshop tiers uses the price it was bought at. */
export const LEGACY_WEAPON_RARITY: Readonly<Record<string, WeaponRarity>> = {
  'inferno-charge': 'epic', 'ember-heart': 'epic', 'lucky-charm': 'epic', 'restoration-aura': 'epic',
  'spectrum-annihilator': 'epic', 'resonance-crystal': 'epic', 'golden-touch': 'epic',
  'connector-legendary': 'legendary',
  'terra-foundation': 'epic', 'fortunes-shield': 'epic', 'clairvoyant-sphere': 'epic', 'arcane-codex': 'epic',
  'temporal-core': 'epic', 'vital-core': 'epic', 'prophets-vision': 'epic', 'life-bloom': 'epic',
  'enlightened-eye': 'epic', 'hourglass-of-ages': 'epic', 'entropy-engine': 'epic',
  'mystic-sight-legendary': 'legendary', 'chain-reaction-legendary': 'legendary', 'fortunes-eye': 'rare',
  'prismatic-perfection': 'legendary', 'tabula-rasa': 'legendary', 'desperate-measures': 'legendary', snowball: 'legendary',
  ...Object.fromEntries(
    Object.entries(LEGACY_WEAPON_IDS)
      .filter(([id, to]) => (to === null && !id.endsWith('-mastery') ? false : to === null || id.endsWith('-rare')))
      .map(([id]) => [id, 'rare' as const])
  ),
};

// Count how many of a specific weapon (by name) the player owns
export const getPlayerWeaponCount = (weaponName: string, playerWeapons: Weapon[]): number => {
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
// Luck parameter boosts Epic/Legendary chances by 1.1x per luck point
export const getRandomShopWeapon = (playerWeapons?: Weapon[], round: number = 5, luck: number = 0): Weapon => {
  const roll = Math.random();
  let rarity: WeaponRarity;

  // Get rarity chances based on round (scales with progression)
  const rarityChances = getRarityChancesForRound(round);

  // Apply luck bonus: each luck point multiplies Epic/Legendary chances by 1.1x
  const luckMultiplier = Math.pow(1.1, luck);
  const boostedLegendary = Math.min(rarityChances.legendary * luckMultiplier, 0.5); // Cap at 50%
  const boostedEpic = Math.min(rarityChances.epic * luckMultiplier, 0.5); // Cap at 50%

  if (roll < boostedLegendary) {
    rarity = 'legendary';
  } else if (roll < boostedLegendary + boostedEpic) {
    rarity = 'epic';
  } else if (roll < boostedLegendary + boostedEpic + rarityChances.rare) {
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
// Luck parameter boosts Epic/Legendary chances
export const generateShopWeapons = (count: number, playerWeapons?: Weapon[], round: number = 5, luck: number = 0): Weapon[] => {
  const weapons: Weapon[] = [];
  for (let i = 0; i < count; i++) {
    weapons.push(getRandomShopWeapon(playerWeapons, round, luck));
  }
  return weapons;
};

// Get weapons by rarity
export const getWeaponsByRarity = (rarity: WeaponRarity): Weapon[] => {
  return WEAPONS.filter(w => w.rarity === rarity);
};

// Helper functions for character and weapon selection
export const getCharacterByName = (name: string): Character | undefined => {
  return CHARACTERS.find(character => character.name === name);
};

export const getWeaponByName = (name: string): Weapon | undefined => {
  return WEAPONS.find(weapon => weapon.name === name);
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
    weapons: startingWeapons
  };
};

// Helper function to calculate total player stats with all effects from weapons
export const calculatePlayerTotalStats = (player: Player): PlayerStats => {
  const totalStats = { ...player.stats };

  // Copy effectCaps so the result never shares it with the player
  if (totalStats.effectCaps) {
    totalStats.effectCaps = { ...totalStats.effectCaps };
  }

  // Keys that should not be modified by weapon effects (non-numeric)
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
 * @returns Array of bridge effects that should be applied
 */
export const rollBridgeEffects = (
  trigger: BridgeTriggerType,
  playerWeapons: Weapon[]
): BridgeEffectResult[] => {
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
