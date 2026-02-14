/**
 * Fusion System Definitions
 *
 * This file contains all weapon, passive, and fusion definitions for the new system.
 * - 6 base weapons (can fuse)
 * - 13 base passives (cannot fuse)
 * - 15 Tier 1 fusions (weapon + weapon)
 * - 15 Tier 2 fusions (fusion + fusion)
 * - 30 total fusion recipes
 */

import { FusionWeapon, FusionRecipe, WeaponType, WeaponLevel, FusionTier } from '../types';

// =============================================================================
// BASE WEAPONS (6 total) - Can fuse at level 3
// =============================================================================

export const BASE_WEAPONS: FusionWeapon[] = [
  {
    id: 'blast-powder',
    name: 'Blast Powder',
    type: 'weapon',
    level: 1,
    fusionTier: 0,
    description: 'Chance to explode adjacent cards on match.',
    shortDescription: 'Explode adjacent cards',
    flavorText: 'After matching, each adjacent card has a chance to explode.',
    icon: 'lorc/bright-explosion',
    specialEffect: 'explosive',
    limitation: 'Only explodes cards matching your set\'s color',
    levelEffects: {
      1: { explosionChance: 10 },
      2: { explosionChance: 20 },
      3: { explosionChance: 30 },
    },
  },
  {
    id: 'flint-spark',
    name: 'Flint Spark',
    type: 'weapon',
    level: 1,
    fusionTier: 0,
    description: 'Chance to ignite adjacent cards.',
    shortDescription: 'Ignite adjacent cards',
    flavorText: 'After matching, adjacent cards may catch fire.',
    icon: 'lorc/campfire',
    specialEffect: 'fire',
    limitation: 'Fire only spreads to same-color cards',
    levelEffects: {
      1: { fireSpreadChance: 10 },
      2: { fireSpreadChance: 20 },
      3: { fireSpreadChance: 30 },
    },
  },
  {
    id: 'prismatic-ray',
    name: 'Prismatic Ray',
    type: 'weapon',
    level: 1,
    fusionTier: 0,
    description: 'Chance to destroy entire row or column.',
    shortDescription: 'Destroy row or column',
    flavorText: 'Each laser fires independently on every match.',
    icon: 'lorc/laser-warning',
    specialEffect: 'laser',
    limitation: 'Only fires in one direction (row OR column)',
    levelEffects: {
      1: { laserChance: 5 },
      2: { laserChance: 10 },
      3: { laserChance: 15 },
    },
  },
  {
    id: 'chaos-shard',
    name: 'Chaos Shard',
    type: 'weapon',
    level: 1,
    fusionTier: 0,
    description: 'Ricochet chain destruction.',
    shortDescription: 'Random ricochet chains',
    flavorText: 'After matching, destroys random cards that may chain to others.',
    icon: 'lorc/chained-arrow-heads',
    specialEffect: 'ricochet',
    limitation: 'Max 3 ricochets per trigger',
    levelEffects: {
      1: { ricochetChance: 10, ricochetChainChance: 5 },
      2: { ricochetChance: 20, ricochetChainChance: 10 },
      3: { ricochetChance: 30, ricochetChainChance: 15 },
    },
  },
  {
    id: 'echo-stone',
    name: 'Echo Stone',
    type: 'weapon',
    level: 1,
    fusionTier: 0,
    description: 'Chance to auto-match another set on the board.',
    shortDescription: 'Auto-match another set',
    flavorText: 'After matching, may automatically find and match another valid set.',
    icon: 'lorc/echo-ripples',
    specialEffect: 'echo',
    limitation: 'Echo doesn\'t trigger weapon effects',
    levelEffects: {
      1: { echoChance: 8 },
      2: { echoChance: 15 },
      3: { echoChance: 22 },
    },
  },
  {
    id: 'link-stone',
    name: 'Link Stone',
    type: 'weapon',
    level: 1,
    fusionTier: 0,
    description: 'Connect board positions together.',
    shortDescription: 'Connect positions',
    flavorText: 'Connected cards are destroyed together.',
    icon: 'lorc/chained-heart',
    specialEffect: 'connector',
    limitation: 'Max 3 connections active at once',
    levelEffects: {
      1: { connectionChance: 15 },
      2: { connectionChance: 25 },
      3: { connectionChance: 35 },
    },
  },
];

// =============================================================================
// BASE PASSIVES (13 total) - Cannot fuse
// =============================================================================

export const BASE_PASSIVES: FusionWeapon[] = [
  {
    id: 'oracle-eye',
    name: 'Oracle Eye',
    type: 'passive',
    level: 1,
    fusionTier: 0,
    description: 'Auto-hint when stuck.',
    shortDescription: 'Hint when stuck',
    flavorText: 'After idle time, may highlight one card from a valid set.',
    icon: 'lorc/sheikah-eye',
    specialEffect: 'autoHint',
    levelEffects: {
      1: { autoHintChance: 15 },
      2: { autoHintChance: 25 },
      3: { autoHintChance: 35 },
    },
  },
  {
    id: 'field-stone',
    name: 'Field Stone',
    type: 'passive',
    level: 1,
    fusionTier: 0,
    description: 'Larger starting board.',
    shortDescription: 'Larger board',
    flavorText: 'Start each round with more cards on the board.',
    icon: 'lorc/field',
    levelEffects: {
      1: { fieldSize: 1 },
      2: { fieldSize: 2 },
      3: { fieldSize: 3 },
    },
  },
  {
    id: 'growth-seed',
    name: 'Growth Seed',
    type: 'passive',
    level: 1,
    fusionTier: 0,
    description: 'Board expands on match.',
    shortDescription: 'Board grows',
    flavorText: 'After matching, may add new cards to the board.',
    icon: 'delapouite/card-exchange',
    specialEffect: 'boardGrowth',
    levelEffects: {
      1: { boardGrowthChance: 5 },
      2: { boardGrowthChance: 10 },
      3: { boardGrowthChance: 15 },
    },
  },
  {
    id: 'second-chance',
    name: 'Second Chance',
    type: 'passive',
    level: 1,
    fusionTier: 0,
    description: 'Extra starting graces.',
    shortDescription: 'Starting graces',
    flavorText: 'Graces protect you from near-miss invalid matches.',
    icon: 'lorc/clover',
    levelEffects: {
      1: { graces: 1 },
      2: { graces: 2 },
      3: { graces: 3 },
    },
  },
  {
    id: 'fortune-token',
    name: 'Fortune Token',
    type: 'passive',
    level: 1,
    fusionTier: 0,
    description: 'Gain graces on match.',
    shortDescription: 'Gain graces',
    flavorText: 'After a valid match, may grant +1 grace.',
    icon: 'lorc/cycle',
    specialEffect: 'graceGain',
    levelEffects: {
      1: { graceGainChance: 5 },
      2: { graceGainChance: 10 },
      3: { graceGainChance: 15 },
    },
  },
  {
    id: 'life-vessel',
    name: 'Life Vessel',
    type: 'passive',
    level: 1,
    fusionTier: 0,
    description: 'Increased max health + heal.',
    shortDescription: 'More health',
    flavorText: 'Increases your maximum health pool and restores some health.',
    icon: 'lorc/heart-inside',
    levelEffects: {
      1: { maxHealth: 1, health: 1 },
      2: { maxHealth: 2, health: 2 },
      3: { maxHealth: 3, health: 3 },
    },
  },
  {
    id: 'mending-charm',
    name: 'Mending Charm',
    type: 'passive',
    level: 1,
    fusionTier: 0,
    description: 'Heal on match.',
    shortDescription: 'Heal on match',
    flavorText: 'After a valid match, may restore 1 health.',
    icon: 'lorc/shining-heart',
    specialEffect: 'healing',
    levelEffects: {
      1: { healingChance: 5 },
      2: { healingChance: 10 },
      3: { healingChance: 15 },
    },
  },
  {
    id: 'crystal-orb',
    name: 'Crystal Orb',
    type: 'passive',
    level: 1,
    fusionTier: 0,
    description: 'More hint capacity.',
    shortDescription: 'More hints',
    flavorText: 'Hints highlight a valid set on the board when activated.',
    icon: 'lorc/floating-crystal',
    levelEffects: {
      1: { maxHints: 1 },
      2: { maxHints: 2 },
      3: { maxHints: 3 },
    },
  },
  {
    id: 'seeker-lens',
    name: 'Seeker Lens',
    type: 'passive',
    level: 1,
    fusionTier: 0,
    description: 'Gain hints on match.',
    shortDescription: 'Gain hints',
    flavorText: 'After a valid match, may gain +1 hint.',
    icon: 'lorc/light-bulb',
    specialEffect: 'hintGain',
    levelEffects: {
      1: { hintGainChance: 5 },
      2: { hintGainChance: 10 },
      3: { hintGainChance: 15 },
    },
  },
  {
    id: 'scholars-tome',
    name: 'Scholar\'s Tome',
    type: 'passive',
    level: 1,
    fusionTier: 0,
    description: 'Gain XP on match.',
    shortDescription: 'Gain XP',
    flavorText: 'Ancient wisdom grants bonus experience.',
    icon: 'lorc/open-book',
    specialEffect: 'xpGain',
    levelEffects: {
      1: { xpGainChance: 10 },
      2: { xpGainChance: 20 },
      3: { xpGainChance: 30 },
    },
  },
  {
    id: 'fortunes-favor',
    name: 'Fortune\'s Favor',
    type: 'passive',
    level: 1,
    fusionTier: 0,
    description: 'Gain coins on match.',
    shortDescription: 'Gain coins',
    flavorText: 'Lady Luck smiles upon you, granting bonus coins.',
    icon: 'lorc/crown-coin',
    specialEffect: 'coinGain',
    levelEffects: {
      1: { coinGainChance: 10 },
      2: { coinGainChance: 20 },
      3: { coinGainChance: 30 },
    },
  },
  {
    id: 'chrono-shard',
    name: 'Chrono Shard',
    type: 'passive',
    level: 1,
    fusionTier: 0,
    description: 'More starting time.',
    shortDescription: 'Starting time',
    flavorText: 'Also raises the cap for time gained during matches.',
    icon: 'lorc/hourglass',
    levelEffects: {
      1: { startingTime: 10 },
      2: { startingTime: 20 },
      3: { startingTime: 30 },
    },
  },
  {
    id: 'time-drop',
    name: 'Time Drop',
    type: 'passive',
    level: 1,
    fusionTier: 0,
    description: 'Gain time on match.',
    shortDescription: 'Gain time',
    flavorText: 'Time can only increase up to your starting max.',
    icon: 'lorc/stopwatch',
    specialEffect: 'timeGain',
    levelEffects: {
      1: { timeGainChance: 5, timeGainAmount: 5 },
      2: { timeGainChance: 10, timeGainAmount: 5 },
      3: { timeGainChance: 15, timeGainAmount: 5 },
    },
  },
];

// =============================================================================
// TIER 1 FUSIONS (15 total) - Two base weapons combined
// =============================================================================

export const TIER1_FUSIONS: FusionWeapon[] = [
  // Blast Powder + Flint Spark = Infernal Charge
  {
    id: 'infernal-charge',
    name: 'Infernal Charge',
    type: 'weapon',
    level: 1,
    fusionTier: 1,
    fusionParents: ['blast-powder', 'flint-spark'],
    description: 'Explosions ignite. Fire explodes.',
    shortDescription: 'Explosions + Fire',
    flavorText: 'The perfect fusion of destruction and chaos.',
    icon: 'lorc/bright-explosion',
    specialEffect: 'explosive',
    levelEffects: {
      1: { explosionChance: 15, fireSpreadChance: 15, explosionsIgnite: true, fireAnyColor: true },
      2: { explosionChance: 22, fireSpreadChance: 22, explosionsIgnite: true, fireAnyColor: true },
      3: { explosionChance: 30, fireSpreadChance: 30, explosionsIgnite: true, fireAnyColor: true },
    },
  },
  // Blast Powder + Prismatic Ray = Detonation Beam
  {
    id: 'detonation-beam',
    name: 'Detonation Beam',
    type: 'weapon',
    level: 1,
    fusionTier: 1,
    fusionParents: ['blast-powder', 'prismatic-ray'],
    description: 'Lasers trigger explosions along their path.',
    shortDescription: 'Laser + Explosion',
    flavorText: 'A prism of destruction that channels all wavelengths.',
    icon: 'lorc/laser-blast',
    specialEffect: 'laser',
    levelEffects: {
      1: { laserChance: 8, explosionChance: 25, explosionAnyColor: true },
      2: { laserChance: 12, explosionChance: 35, explosionAnyColor: true },
      3: { laserChance: 16, explosionChance: 45, explosionAnyColor: true },
    },
  },
  // Blast Powder + Chaos Shard = Shrapnel Storm
  {
    id: 'shrapnel-storm',
    name: 'Shrapnel Storm',
    type: 'weapon',
    level: 1,
    fusionTier: 1,
    fusionParents: ['blast-powder', 'chaos-shard'],
    description: 'Ricochets cause explosions. Explosions ricochet.',
    shortDescription: 'Ricochet + Explosion',
    flavorText: 'Chaos begets chaos, destruction begets destruction.',
    icon: 'lorc/cracked-ball-dunk',
    specialEffect: 'ricochet',
    levelEffects: {
      1: { ricochetChance: 15, ricochetChainChance: 10, explosionChance: 15, maxRicochets: 6 },
      2: { ricochetChance: 22, ricochetChainChance: 15, explosionChance: 22, maxRicochets: 6 },
      3: { ricochetChance: 30, ricochetChainChance: 20, explosionChance: 30, maxRicochets: 6 },
    },
  },
  // Blast Powder + Echo Stone = Resonant Blast
  {
    id: 'resonant-blast',
    name: 'Resonant Blast',
    type: 'weapon',
    level: 1,
    fusionTier: 1,
    fusionParents: ['blast-powder', 'echo-stone'],
    description: 'Echo matches trigger explosions. Explosions can trigger echo.',
    shortDescription: 'Echo + Explosion',
    flavorText: 'The echoed match triggers all on-match effects.',
    icon: 'lorc/echo-ripples',
    specialEffect: 'echo',
    levelEffects: {
      1: { echoChance: 12, explosionChance: 15, echoTriggersWeapons: true },
      2: { echoChance: 18, explosionChance: 22, echoTriggersWeapons: true },
      3: { echoChance: 25, explosionChance: 30, echoTriggersWeapons: true },
    },
  },
  // Blast Powder + Link Stone = Chain Detonator
  {
    id: 'chain-detonator',
    name: 'Chain Detonator',
    type: 'weapon',
    level: 1,
    fusionTier: 1,
    fusionParents: ['blast-powder', 'link-stone'],
    description: 'Connected cards explode together. Explosions create connections.',
    shortDescription: 'Connection + Explosion',
    flavorText: 'What is joined cannot be undone.',
    icon: 'lorc/chained-heart',
    specialEffect: 'connector',
    levelEffects: {
      1: { connectionChance: 20, explosionChance: 15, maxConnections: 5 },
      2: { connectionChance: 28, explosionChance: 22, maxConnections: 5 },
      3: { connectionChance: 36, explosionChance: 30, maxConnections: 5 },
    },
  },
  // Flint Spark + Prismatic Ray = Solar Flare
  {
    id: 'solar-flare',
    name: 'Solar Flare',
    type: 'weapon',
    level: 1,
    fusionTier: 1,
    fusionParents: ['flint-spark', 'prismatic-ray'],
    description: 'Lasers leave fire trails. Burning cards boost laser chance.',
    shortDescription: 'Laser + Fire',
    flavorText: 'A prism of eternal flame.',
    icon: 'lorc/laser-warning',
    specialEffect: 'laser',
    levelEffects: {
      1: { laserChance: 8, fireSpreadChance: 15, laserIgnites: true, laserBothDirections: true },
      2: { laserChance: 12, fireSpreadChance: 22, laserIgnites: true, laserBothDirections: true },
      3: { laserChance: 16, fireSpreadChance: 30, laserIgnites: true, laserBothDirections: true },
    },
  },
  // Flint Spark + Chaos Shard = Wildfire Shard
  {
    id: 'wildfire-shard',
    name: 'Wildfire Shard',
    type: 'weapon',
    level: 1,
    fusionTier: 1,
    fusionParents: ['flint-spark', 'chaos-shard'],
    description: 'Ricochets spread fire. Fire increases ricochet chain chance.',
    shortDescription: 'Ricochet + Fire',
    flavorText: 'Fire that bounces and spreads unpredictably.',
    icon: 'lorc/fire-ring',
    specialEffect: 'fire',
    levelEffects: {
      1: { ricochetChance: 15, fireSpreadChance: 15, fireAnyColor: true },
      2: { ricochetChance: 22, fireSpreadChance: 22, fireAnyColor: true },
      3: { ricochetChance: 30, fireSpreadChance: 30, fireAnyColor: true },
    },
  },
  // Flint Spark + Echo Stone = Blazing Echo
  {
    id: 'blazing-echo',
    name: 'Blazing Echo',
    type: 'weapon',
    level: 1,
    fusionTier: 1,
    fusionParents: ['flint-spark', 'echo-stone'],
    description: 'Echo matches spread fire. Fire boosts echo chance.',
    shortDescription: 'Echo + Fire',
    flavorText: 'Time flows, and in its wake, flames repeat.',
    icon: 'lorc/echo-ripples',
    specialEffect: 'echo',
    levelEffects: {
      1: { echoChance: 12, fireSpreadChance: 15, echoTriggersWeapons: true },
      2: { echoChance: 18, fireSpreadChance: 22, echoTriggersWeapons: true },
      3: { echoChance: 25, fireSpreadChance: 30, echoTriggersWeapons: true },
    },
  },
  // Flint Spark + Link Stone = Burning Bonds
  {
    id: 'burning-bonds',
    name: 'Burning Bonds',
    type: 'weapon',
    level: 1,
    fusionTier: 1,
    fusionParents: ['flint-spark', 'link-stone'],
    description: 'Fire spreads instantly through connections.',
    shortDescription: 'Connection + Fire',
    flavorText: 'Where one burns, all burn.',
    icon: 'lorc/fire-ring',
    specialEffect: 'connector',
    levelEffects: {
      1: { connectionChance: 20, fireSpreadChance: 15, maxConnections: 5 },
      2: { connectionChance: 28, fireSpreadChance: 22, maxConnections: 5 },
      3: { connectionChance: 36, fireSpreadChance: 30, maxConnections: 5 },
    },
  },
  // Prismatic Ray + Chaos Shard = Prism Shatter
  {
    id: 'prism-shatter',
    name: 'Prism Shatter',
    type: 'weapon',
    level: 1,
    fusionTier: 1,
    fusionParents: ['prismatic-ray', 'chaos-shard'],
    description: 'Lasers ricochet at the end. Ricochets can trigger lasers.',
    shortDescription: 'Laser + Ricochet',
    flavorText: 'Light shatters and bounces unpredictably.',
    icon: 'lorc/laser-warning',
    specialEffect: 'laser',
    levelEffects: {
      1: { laserChance: 8, ricochetChance: 20, maxRicochets: 6 },
      2: { laserChance: 12, ricochetChance: 30, maxRicochets: 6 },
      3: { laserChance: 16, ricochetChance: 40, maxRicochets: 6 },
    },
  },
  // Prismatic Ray + Echo Stone = Mirror Beam
  {
    id: 'mirror-beam',
    name: 'Mirror Beam',
    type: 'weapon',
    level: 1,
    fusionTier: 1,
    fusionParents: ['prismatic-ray', 'echo-stone'],
    description: 'Echo can trigger lasers. Laser kills count toward echo.',
    shortDescription: 'Laser + Echo',
    flavorText: 'Reflections of destruction.',
    icon: 'lorc/laser-warning',
    specialEffect: 'laser',
    levelEffects: {
      1: { echoChance: 12, laserChance: 8, echoTriggersWeapons: true },
      2: { echoChance: 18, laserChance: 12, echoTriggersWeapons: true },
      3: { echoChance: 25, laserChance: 16, echoTriggersWeapons: true },
    },
  },
  // Prismatic Ray + Link Stone = Linked Annihilation
  {
    id: 'linked-annihilation',
    name: 'Linked Annihilation',
    type: 'weapon',
    level: 1,
    fusionTier: 1,
    fusionParents: ['prismatic-ray', 'link-stone'],
    description: 'Laser hitting connected card also fires at partner\'s position.',
    shortDescription: 'Laser + Connection',
    flavorText: 'Destruction mirrors across linked positions.',
    icon: 'lorc/laser-warning',
    specialEffect: 'laser',
    levelEffects: {
      1: { connectionChance: 20, laserChance: 8, laserBothDirections: true },
      2: { connectionChance: 28, laserChance: 12, laserBothDirections: true },
      3: { connectionChance: 36, laserChance: 16, laserBothDirections: true },
    },
  },
  // Chaos Shard + Echo Stone = Cascade Chaos
  {
    id: 'cascade-chaos',
    name: 'Cascade Chaos',
    type: 'weapon',
    level: 1,
    fusionTier: 1,
    fusionParents: ['chaos-shard', 'echo-stone'],
    description: 'Ricochets can trigger echo. Echo can trigger ricochets.',
    shortDescription: 'Ricochet + Echo',
    flavorText: 'Chaos echoes through the board.',
    icon: 'lorc/chained-arrow-heads',
    specialEffect: 'ricochet',
    levelEffects: {
      1: { echoChance: 12, ricochetChance: 15, echoTriggersWeapons: true },
      2: { echoChance: 18, ricochetChance: 22, echoTriggersWeapons: true },
      3: { echoChance: 25, ricochetChance: 30, echoTriggersWeapons: true },
    },
  },
  // Chaos Shard + Link Stone = Chaotic Web
  {
    id: 'chaotic-web',
    name: 'Chaotic Web',
    type: 'weapon',
    level: 1,
    fusionTier: 1,
    fusionParents: ['chaos-shard', 'link-stone'],
    description: 'Ricochets prefer connected cards. Ricochet kills create new connections.',
    shortDescription: 'Ricochet + Connection',
    flavorText: 'A web of chaos and destruction.',
    icon: 'lorc/cobweb',
    specialEffect: 'ricochet',
    levelEffects: {
      1: { connectionChance: 20, ricochetChance: 15, maxRicochets: 6, maxConnections: 5 },
      2: { connectionChance: 28, ricochetChance: 22, maxRicochets: 6, maxConnections: 5 },
      3: { connectionChance: 36, ricochetChance: 30, maxRicochets: 6, maxConnections: 5 },
    },
  },
  // Echo Stone + Link Stone = Resonant Link
  {
    id: 'resonant-link',
    name: 'Resonant Link',
    type: 'weapon',
    level: 1,
    fusionTier: 1,
    fusionParents: ['echo-stone', 'link-stone'],
    description: 'Echoed matches auto-connect positions. Connected destructions boost echo.',
    shortDescription: 'Echo + Connection',
    flavorText: 'The echoes of connection resonate.',
    icon: 'lorc/linked-rings',
    specialEffect: 'echo',
    levelEffects: {
      1: { echoChance: 12, connectionChance: 20, echoTriggersWeapons: true, maxConnections: 5 },
      2: { echoChance: 18, connectionChance: 28, echoTriggersWeapons: true, maxConnections: 5 },
      3: { echoChance: 25, connectionChance: 36, echoTriggersWeapons: true, maxConnections: 5 },
    },
  },
];

// =============================================================================
// TIER 2 FUSIONS (15 total) - Two Tier 1 fusions combined
// =============================================================================

export const TIER2_FUSIONS: FusionWeapon[] = [
  // Infernal Charge + Detonation Beam = Supernova
  {
    id: 'supernova',
    name: 'Supernova',
    type: 'weapon',
    level: 1,
    fusionTier: 2,
    fusionParents: ['infernal-charge', 'detonation-beam'],
    description: 'Laser path explodes AND ignites. Explosions chain to next row/column.',
    shortDescription: 'Ultimate Fire+Explosion+Laser',
    icon: 'lorc/rainbow-star',
    levelEffects: {
      1: { laserChance: 12, explosionChance: 25, fireSpreadChance: 25, laserIgnites: true, explosionsIgnite: true, laserBothDirections: true },
      2: { laserChance: 18, explosionChance: 30, fireSpreadChance: 30, laserIgnites: true, explosionsIgnite: true, laserBothDirections: true },
      3: { laserChance: 25, explosionChance: 35, fireSpreadChance: 35, laserIgnites: true, explosionsIgnite: true, laserBothDirections: true },
    },
  },
  // Infernal Charge + Wildfire Shard = Eternal Flame
  {
    id: 'eternal-flame',
    name: 'Eternal Flame',
    type: 'weapon',
    level: 1,
    fusionTier: 2,
    fusionParents: ['infernal-charge', 'wildfire-shard'],
    description: 'Fire never stops spreading. Explosions on every burn. Burning cards ricochet on death.',
    shortDescription: 'Eternal Fire+Explosion+Ricochet',
    icon: 'lorc/fire-ring',
    levelEffects: {
      1: { fireSpreadChance: 35, explosionChance: 20, ricochetChance: 20, fireAnyColor: true, explosionsIgnite: true },
      2: { fireSpreadChance: 45, explosionChance: 30, ricochetChance: 25, fireAnyColor: true, explosionsIgnite: true },
      3: { fireSpreadChance: 55, explosionChance: 40, ricochetChance: 30, fireAnyColor: true, explosionsIgnite: true },
    },
  },
  // Detonation Beam + Solar Flare = Extinction Ray
  {
    id: 'extinction-ray',
    name: 'Extinction Ray',
    type: 'weapon',
    level: 1,
    fusionTier: 2,
    fusionParents: ['detonation-beam', 'solar-flare'],
    description: 'Fires CROSS pattern (both row and column). Everything hit explodes and ignites.',
    shortDescription: 'Cross Laser+Explosion+Fire',
    icon: 'lorc/laser-blast',
    levelEffects: {
      1: { laserChance: 15, explosionChance: 25, fireSpreadChance: 25, laserBothDirections: true, laserIgnites: true },
      2: { laserChance: 22, explosionChance: 30, fireSpreadChance: 30, laserBothDirections: true, laserIgnites: true },
      3: { laserChance: 30, explosionChance: 35, fireSpreadChance: 35, laserBothDirections: true, laserIgnites: true },
    },
  },
  // Shrapnel Storm + Prism Shatter = Reality Fracture
  {
    id: 'reality-fracture',
    name: 'Reality Fracture',
    type: 'weapon',
    level: 1,
    fusionTier: 2,
    fusionParents: ['shrapnel-storm', 'prism-shatter'],
    description: 'Laser endpoint triggers ricochets. Each ricochet explodes. Unlimited ricochets.',
    shortDescription: 'Explosive Laser+Ricochet',
    icon: 'lorc/cracked-ball-dunk',
    levelEffects: {
      1: { laserChance: 12, ricochetChance: 30, explosionChance: 25 },
      2: { laserChance: 18, ricochetChance: 40, explosionChance: 30 },
      3: { laserChance: 25, ricochetChance: 50, explosionChance: 35 },
    },
  },
  // Resonant Blast + Cascade Chaos = Infinite Echo
  {
    id: 'infinite-echo',
    name: 'Infinite Echo',
    type: 'weapon',
    level: 1,
    fusionTier: 2,
    fusionParents: ['resonant-blast', 'cascade-chaos'],
    description: 'Echo can trigger another echo (recursive). All matches explode and ricochet.',
    shortDescription: 'Recursive Echo+Explosion+Ricochet',
    icon: 'lorc/echo-ripples',
    levelEffects: {
      1: { echoChance: 30, explosionChance: 20, ricochetChance: 20, echoTriggersWeapons: true },
      2: { echoChance: 40, explosionChance: 25, ricochetChance: 25, echoTriggersWeapons: true },
      3: { echoChance: 50, explosionChance: 30, ricochetChance: 30, echoTriggersWeapons: true },
    },
  },
  // Chain Detonator + Chaotic Web = Doom Network
  {
    id: 'doom-network',
    name: 'Doom Network',
    type: 'weapon',
    level: 1,
    fusionTier: 2,
    fusionParents: ['chain-detonator', 'chaotic-web'],
    description: 'Start with connections. Any destruction ripples through ALL connections.',
    shortDescription: 'Network Explosion+Ricochet+Connection',
    icon: 'lorc/brainstorm',
    levelEffects: {
      1: { connectionChance: 35, explosionChance: 25, ricochetChance: 20, startingConnections: 3 },
      2: { connectionChance: 45, explosionChance: 30, ricochetChance: 25, startingConnections: 4 },
      3: { connectionChance: 55, explosionChance: 35, ricochetChance: 30, startingConnections: 5 },
    },
  },
  // Solar Flare + Mirror Beam = Prismatic Inferno
  {
    id: 'prismatic-inferno',
    name: 'Prismatic Inferno',
    type: 'weapon',
    level: 1,
    fusionTier: 2,
    fusionParents: ['solar-flare', 'mirror-beam'],
    description: 'Cross-pattern laser. Fire trails trigger echo checks. Echo matches fire lasers.',
    shortDescription: 'Laser+Fire+Echo',
    icon: 'lorc/fireball',
    levelEffects: {
      1: { laserChance: 15, fireSpreadChance: 25, echoChance: 20, laserBothDirections: true, laserIgnites: true, echoTriggersWeapons: true },
      2: { laserChance: 22, fireSpreadChance: 30, echoChance: 25, laserBothDirections: true, laserIgnites: true, echoTriggersWeapons: true },
      3: { laserChance: 30, fireSpreadChance: 35, echoChance: 30, laserBothDirections: true, laserIgnites: true, echoTriggersWeapons: true },
    },
  },
  // Blazing Echo + Burning Bonds = Soul Pyre
  {
    id: 'soul-pyre',
    name: 'Soul Pyre',
    type: 'weapon',
    level: 1,
    fusionTier: 2,
    fusionParents: ['blazing-echo', 'burning-bonds'],
    description: 'All matches auto-connect. Connected cards share fire instantly. Echo scales with connections.',
    shortDescription: 'Fire+Echo+Connection',
    icon: 'lorc/fire-ring',
    levelEffects: {
      1: { connectionChance: 35, fireSpreadChance: 30, echoChance: 20, echoTriggersWeapons: true, fireAnyColor: true },
      2: { connectionChance: 45, fireSpreadChance: 35, echoChance: 25, echoTriggersWeapons: true, fireAnyColor: true },
      3: { connectionChance: 55, fireSpreadChance: 40, echoChance: 30, echoTriggersWeapons: true, fireAnyColor: true },
    },
  },
  // Wildfire Shard + Chaotic Web = Plague Fire
  {
    id: 'plague-fire',
    name: 'Plague Fire',
    type: 'weapon',
    level: 1,
    fusionTier: 2,
    fusionParents: ['wildfire-shard', 'chaotic-web'],
    description: 'Fire jumps to random cards (not just adjacent). Burning cards auto-connected. Unlimited spread.',
    shortDescription: 'Spreading Fire+Ricochet+Connection',
    icon: 'lorc/campfire',
    levelEffects: {
      1: { fireSpreadChance: 35, ricochetChance: 25, connectionChance: 25, fireAnyColor: true },
      2: { fireSpreadChance: 45, ricochetChance: 30, connectionChance: 30, fireAnyColor: true },
      3: { fireSpreadChance: 55, ricochetChance: 35, connectionChance: 35, fireAnyColor: true },
    },
  },
  // Linked Annihilation + Resonant Link = Quantum Entanglement
  {
    id: 'quantum-entanglement',
    name: 'Quantum Entanglement',
    type: 'weapon',
    level: 1,
    fusionTier: 2,
    fusionParents: ['linked-annihilation', 'resonant-link'],
    description: 'Every match creates connection. Connections are mirrored (triangles). Lasers duplicate to all connected.',
    shortDescription: 'Laser+Echo+Connection',
    icon: 'lorc/linked-rings',
    levelEffects: {
      1: { connectionChance: 40, laserChance: 12, echoChance: 20, laserBothDirections: true, echoTriggersWeapons: true },
      2: { connectionChance: 50, laserChance: 18, echoChance: 25, laserBothDirections: true, echoTriggersWeapons: true },
      3: { connectionChance: 60, laserChance: 25, echoChance: 30, laserBothDirections: true, echoTriggersWeapons: true },
    },
  },
  // Mirror Beam + Cascade Chaos = Paradox Engine
  {
    id: 'paradox-engine',
    name: 'Paradox Engine',
    type: 'weapon',
    level: 1,
    fusionTier: 2,
    fusionParents: ['mirror-beam', 'cascade-chaos'],
    description: 'Echo matches fire mini-lasers. Laser kills ricochet. Ricochets can trigger echo.',
    shortDescription: 'Laser+Echo+Ricochet',
    icon: 'lorc/time-trap',
    levelEffects: {
      1: { echoChance: 25, laserChance: 15, ricochetChance: 20, echoTriggersWeapons: true },
      2: { echoChance: 35, laserChance: 20, ricochetChance: 25, echoTriggersWeapons: true },
      3: { echoChance: 45, laserChance: 25, ricochetChance: 30, echoTriggersWeapons: true },
    },
  },
  // Prism Shatter + Linked Annihilation = Grid Eraser
  {
    id: 'grid-eraser',
    name: 'Grid Eraser',
    type: 'weapon',
    level: 1,
    fusionTier: 2,
    fusionParents: ['prism-shatter', 'linked-annihilation'],
    description: 'Cross-pattern laser. Connections double laser hits. Ricochet between all connected after laser.',
    shortDescription: 'Laser+Ricochet+Connection',
    icon: 'lorc/laser-blast',
    levelEffects: {
      1: { laserChance: 15, ricochetChance: 25, connectionChance: 30, laserBothDirections: true, maxRicochets: 6 },
      2: { laserChance: 22, ricochetChance: 30, connectionChance: 35, laserBothDirections: true, maxRicochets: 6 },
      3: { laserChance: 30, ricochetChance: 35, connectionChance: 40, laserBothDirections: true, maxRicochets: 6 },
    },
  },
  // Burning Bonds + Chain Detonator = Scorched Earth
  {
    id: 'scorched-earth',
    name: 'Scorched Earth',
    type: 'weapon',
    level: 1,
    fusionTier: 2,
    fusionParents: ['burning-bonds', 'chain-detonator'],
    description: 'Fire spreads through connections instantly. Connected destruction explodes BOTH positions.',
    shortDescription: 'Fire+Connection+Explosion',
    icon: 'lorc/campfire',
    levelEffects: {
      1: { fireSpreadChance: 30, connectionChance: 30, explosionChance: 25, startingConnections: 2, fireAnyColor: true },
      2: { fireSpreadChance: 35, connectionChance: 35, explosionChance: 30, startingConnections: 3, fireAnyColor: true },
      3: { fireSpreadChance: 40, connectionChance: 40, explosionChance: 35, startingConnections: 4, fireAnyColor: true },
    },
  },
  // Resonant Blast + Blazing Echo = Phoenix Storm
  {
    id: 'phoenix-storm',
    name: 'Phoenix Storm',
    type: 'weapon',
    level: 1,
    fusionTier: 2,
    fusionParents: ['resonant-blast', 'blazing-echo'],
    description: 'Destroyed cards may respawn as fire. Echoes always ignite. Explosions trigger echo check.',
    shortDescription: 'Explosion+Echo+Fire',
    icon: 'lorc/fire-ring',
    levelEffects: {
      1: { echoChance: 25, explosionChance: 25, fireSpreadChance: 25, echoTriggersWeapons: true, explosionsIgnite: true },
      2: { echoChance: 35, explosionChance: 30, fireSpreadChance: 30, echoTriggersWeapons: true, explosionsIgnite: true },
      3: { echoChance: 45, explosionChance: 35, fireSpreadChance: 35, echoTriggersWeapons: true, explosionsIgnite: true },
    },
  },
  // Shrapnel Storm + Chain Detonator = Armageddon
  {
    id: 'armageddon',
    name: 'Armageddon',
    type: 'weapon',
    level: 1,
    fusionTier: 2,
    fusionParents: ['shrapnel-storm', 'chain-detonator'],
    description: 'Explosions ricochet. Ricochets explode. Connections multiply both. Unlimited ricochets.',
    shortDescription: 'Explosion+Ricochet+Connection',
    icon: 'lorc/fireball',
    levelEffects: {
      1: { explosionChance: 30, ricochetChance: 25, connectionChance: 25, startingConnections: 2 },
      2: { explosionChance: 35, ricochetChance: 30, connectionChance: 30, startingConnections: 3 },
      3: { explosionChance: 40, ricochetChance: 35, connectionChance: 35, startingConnections: 4 },
    },
  },
];

// =============================================================================
// ALL WEAPONS/PASSIVES COMBINED
// =============================================================================

export const ALL_WEAPONS: FusionWeapon[] = [...BASE_WEAPONS, ...TIER1_FUSIONS, ...TIER2_FUSIONS];
export const ALL_PASSIVES: FusionWeapon[] = [...BASE_PASSIVES];
export const ALL_ITEMS: FusionWeapon[] = [...ALL_WEAPONS, ...ALL_PASSIVES];

// =============================================================================
// FUSION RECIPES (30 total)
// =============================================================================

export const FUSION_RECIPES: FusionRecipe[] = [
  // Tier 1 recipes (15)
  { inputs: ['blast-powder', 'flint-spark'], output: 'infernal-charge', tier: 1 },
  { inputs: ['blast-powder', 'prismatic-ray'], output: 'detonation-beam', tier: 1 },
  { inputs: ['blast-powder', 'chaos-shard'], output: 'shrapnel-storm', tier: 1 },
  { inputs: ['blast-powder', 'echo-stone'], output: 'resonant-blast', tier: 1 },
  { inputs: ['blast-powder', 'link-stone'], output: 'chain-detonator', tier: 1 },
  { inputs: ['flint-spark', 'prismatic-ray'], output: 'solar-flare', tier: 1 },
  { inputs: ['flint-spark', 'chaos-shard'], output: 'wildfire-shard', tier: 1 },
  { inputs: ['flint-spark', 'echo-stone'], output: 'blazing-echo', tier: 1 },
  { inputs: ['flint-spark', 'link-stone'], output: 'burning-bonds', tier: 1 },
  { inputs: ['prismatic-ray', 'chaos-shard'], output: 'prism-shatter', tier: 1 },
  { inputs: ['prismatic-ray', 'echo-stone'], output: 'mirror-beam', tier: 1 },
  { inputs: ['prismatic-ray', 'link-stone'], output: 'linked-annihilation', tier: 1 },
  { inputs: ['chaos-shard', 'echo-stone'], output: 'cascade-chaos', tier: 1 },
  { inputs: ['chaos-shard', 'link-stone'], output: 'chaotic-web', tier: 1 },
  { inputs: ['echo-stone', 'link-stone'], output: 'resonant-link', tier: 1 },

  // Tier 2 recipes (15)
  { inputs: ['infernal-charge', 'detonation-beam'], output: 'supernova', tier: 2 },
  { inputs: ['infernal-charge', 'wildfire-shard'], output: 'eternal-flame', tier: 2 },
  { inputs: ['detonation-beam', 'solar-flare'], output: 'extinction-ray', tier: 2 },
  { inputs: ['shrapnel-storm', 'prism-shatter'], output: 'reality-fracture', tier: 2 },
  { inputs: ['resonant-blast', 'cascade-chaos'], output: 'infinite-echo', tier: 2 },
  { inputs: ['chain-detonator', 'chaotic-web'], output: 'doom-network', tier: 2 },
  { inputs: ['solar-flare', 'mirror-beam'], output: 'prismatic-inferno', tier: 2 },
  { inputs: ['blazing-echo', 'burning-bonds'], output: 'soul-pyre', tier: 2 },
  { inputs: ['wildfire-shard', 'chaotic-web'], output: 'plague-fire', tier: 2 },
  { inputs: ['linked-annihilation', 'resonant-link'], output: 'quantum-entanglement', tier: 2 },
  { inputs: ['mirror-beam', 'cascade-chaos'], output: 'paradox-engine', tier: 2 },
  { inputs: ['prism-shatter', 'linked-annihilation'], output: 'grid-eraser', tier: 2 },
  { inputs: ['burning-bonds', 'chain-detonator'], output: 'scorched-earth', tier: 2 },
  { inputs: ['resonant-blast', 'blazing-echo'], output: 'phoenix-storm', tier: 2 },
  { inputs: ['shrapnel-storm', 'chain-detonator'], output: 'armageddon', tier: 2 },
];

// =============================================================================
// FUSION HELPER FUNCTIONS
// =============================================================================

/**
 * Get the fusion result for two weapons
 * @returns The resulting fusion weapon or null if no valid recipe exists
 */
export function getFusionResult(weaponA: FusionWeapon, weaponB: FusionWeapon): FusionWeapon | null {
  // Find matching recipe (order doesn't matter)
  const recipe = FUSION_RECIPES.find(r =>
    (r.inputs.includes(weaponA.id) && r.inputs.includes(weaponB.id)) &&
    weaponA.id !== weaponB.id // Can't fuse with itself
  );

  if (!recipe) {
    return null;
  }

  // Find the output weapon
  const outputWeapon = ALL_ITEMS.find(w => w.id === recipe.output);
  if (!outputWeapon) {
    return null;
  }

  // Return a copy at level 1
  return {
    ...outputWeapon,
    level: 1 as WeaponLevel,
  };
}

/**
 * Check if two weapons can be fused
 */
export function canFuse(weaponA: FusionWeapon, weaponB: FusionWeapon): boolean {
  // Both must be weapons (not passives)
  if (weaponA.type !== 'weapon' || weaponB.type !== 'weapon') {
    return false;
  }

  // Both must be level 3
  if (weaponA.level !== 3 || weaponB.level !== 3) {
    return false;
  }

  // Must have a valid recipe
  const recipe = FUSION_RECIPES.find(r =>
    (r.inputs.includes(weaponA.id) && r.inputs.includes(weaponB.id)) &&
    weaponA.id !== weaponB.id
  );

  return recipe !== undefined;
}

/**
 * Get all eligible fusion pairs from player's weapons
 */
export function getEligibleFusions(playerWeapons: FusionWeapon[]): Array<{ weaponA: FusionWeapon; weaponB: FusionWeapon; result: FusionWeapon }> {
  const eligibleFusions: Array<{ weaponA: FusionWeapon; weaponB: FusionWeapon; result: FusionWeapon }> = [];

  // Only consider level 3 weapons
  const level3Weapons = playerWeapons.filter(w => w.type === 'weapon' && w.level === 3);

  // Check all pairs
  for (let i = 0; i < level3Weapons.length; i++) {
    for (let j = i + 1; j < level3Weapons.length; j++) {
      const weaponA = level3Weapons[i];
      const weaponB = level3Weapons[j];
      const result = getFusionResult(weaponA, weaponB);

      if (result) {
        eligibleFusions.push({ weaponA, weaponB, result });
      }
    }
  }

  return eligibleFusions;
}

/**
 * Get a weapon/passive by ID
 */
export function getItemById(id: string): FusionWeapon | undefined {
  return ALL_ITEMS.find(w => w.id === id);
}

/**
 * Get a weapon by name
 */
export function getWeaponByName(name: string): FusionWeapon | undefined {
  return ALL_ITEMS.find(w => w.name === name);
}
