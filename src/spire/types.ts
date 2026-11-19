/**
 * Starfall Spire — core data types.
 *
 * Designed as a clean, self-contained roguelike climb module (`src/spire/`) that
 * reuses Adventure Mode's combat engine (`runReducer`, `AdventureRun`), weapons
 * (`getArmoryWeapon`, `WeaponExplainer`), 204 Evolutions, Fighter Skill Trees,
 * Arcana, Set-Parrying, Live Multiplier Ignition, Kill-Cam, and adaptive audio.
 */
import type { CharacterName, Weapon } from '@/types';
import type { IconName } from '@/components/Icon';
import type {
  ArcanaId,
  BiomeId,
  FoeDef,
  LevelHazards,
  ParrySpec,
  RunState,
} from '@/adventure/types';
import type { WeaponBuilds } from '@/adventure/data/weaponStats';

export type SpireNodeKind = 'skirmish' | 'elite' | 'shop' | 'campfire' | 'event' | 'treasure' | 'boss';

export interface SpireEncounter {
  id: string;
  name: string;
  kind: 'skirmish' | 'elite' | 'boss';
  biome: BiomeId;
  foes: FoeDef[];
  timer: number;
  boardSize: number;
  shadingSurge: boolean;
  hazards?: LevelHazards;
  coinReward: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Primary parry spec shown up front on the encounter briefing */
  parry: ParrySpec;
}

export interface SpireNode {
  id: string;
  /** 0-based row within the Act (0 = entrance, 6 = Act Boss) */
  row: number;
  /** 0..3 lane across the map */
  col: number;
  kind: SpireNodeKind;
  /** Node ids reachable on the next row */
  next: string[];
  visited: boolean;
  /** Pre-generated encounter (for skirmish / elite / boss nodes) */
  encounter?: SpireEncounter;
  /** Pre-assigned event id (for event nodes) */
  eventId?: string;
}

export interface SpireActMap {
  act: number;
  title: string;
  subtitle: string;
  biome: BiomeId;
  rows: number;
  cols: number;
  nodes: SpireNode[];
  bossName: string;
  bossIcon: IconName;
}

export type SpireShopUpgradeKind = 'heavy_hitter' | 'tough_hide' | 'hourglass' | 'sharp_eyes' | 'second_wind' | 'evolution_lab';

export interface SpireShopWeaponOffer {
  weaponId: string;
  level: number;
  price: number;
  onSale?: boolean;
  sold?: boolean;
}

export interface SpireShopArcanaOffer {
  arcanaId: ArcanaId;
  price: number;
  sold?: boolean;
}

export interface SpireShopUpgradeOffer {
  kind: SpireShopUpgradeKind;
  name: string;
  description: string;
  icon: IconName;
  price: number;
  sold?: boolean;
}

export interface SpireShopState {
  weapons: SpireShopWeaponOffer[];
  arcana: SpireShopArcanaOffer[];
  upgrades: SpireShopUpgradeOffer[];
  healCost: number;
  healAmount: number;
  healed: boolean;
  forgeCost: number;
  forged: boolean;
  rerollCost: number;
  rerolls: number;
}

export interface SpireRewardBundle {
  nodeKind: 'skirmish' | 'elite' | 'boss';
  foeName: string;
  coinsEarned: number;
  parryBonusCoins: number;
  dpm: number;
  biggestHit: number;
  parries: number;
  perfectParries: number;
  /** 3 weapon choices (pick 1, reroll once, or skip for bonus coins) */
  weaponOptions: { weaponId: string; level: number }[];
  weaponClaimed: boolean;
  weaponRerolled: boolean;
  /** Elite / Boss bonus Arcana draft */
  arcanaOptions: ArcanaId[];
  arcanaClaimed: boolean;
  /** Elite / Boss bonus Fighter Skill Tree node draft */
  skillOptions: string[];
  skillClaimed: boolean;
  /** Boss victory flag (opens Act transition or Endless choice) */
  isActBoss: boolean;
}

export interface SpireCampfireState {
  healAmount: number;
  skillOptions: string[];
  resolved: boolean;
  outcomeText?: string;
}

export interface SpireTreasureState {
  coins: number;
  weaponOffer: { weaponId: string; level: number };
  arcanaOffer: ArcanaId | null;
  claimed: boolean;
  outcomeText?: string;
}

export interface SpireEventState {
  eventId: string;
  resolved: boolean;
  outcomeTitle?: string;
  outcomeText?: string;
  /** Some bold events trigger a surprise Elite fight! */
  ambushEncounter?: SpireEncounter;
  /** Some events open a mini skill/weapon pick inline */
  pendingWeaponOptions?: { weaponId: string; level: number }[];
  pendingSkillOptions?: string[];
  pendingForge?: boolean;
}

export type SpirePhase =
  | 'map'
  | 'preview'
  | 'fight'
  | 'reward'
  | 'shop'
  | 'campfire'
  | 'event'
  | 'treasure'
  | 'act_clear'
  | 'victory'
  | 'defeat';

export interface SpireRunStats {
  floorsCleared: number;
  skirmishesWon: number;
  elitesWon: number;
  bossesWon: number;
  totalDamage: number;
  biggestHit: number;
  peakDpm: number;
  totalSets: number;
  parries: number;
  perfectParries: number;
  evolutionsForged: number;
  forgedRecipeIds: string[];
  coinsSpent: number;
  eventsResolved: number;
}

export interface SpireRun {
  version: 1;
  id: string;
  seed: number;
  rngState: number;
  fighter: CharacterName;
  ascension: number;
  act: number;
  endless: boolean;
  /** Global 1-based floor counter across acts */
  floor: number;
  phase: SpirePhase;

  // Persistent survival & economy
  hearts: number;
  maxHearts: number;
  coins: number;
  startingHints: number;
  startingGraces: number;
  bonusClockSeconds: number;
  bonusDamagePerMatch: number;
  evolutionLabTier: number;
  extraEvolutionCap: number;
  extraEvolutionLikelihood: number;

  // Persistent build (uncapped snowballing!)
  weapons: string[];
  weaponLevels: Record<string, number>;
  arcana: ArcanaId[];
  skillNodes: string[];

  // Map & current node
  map: SpireActMap;
  currentNodeId: string | null;
  activeEncounter: SpireEncounter | null;
  seenEvents: string[];

  // Active sub-screen states
  reward: SpireRewardBundle | null;
  shop: SpireShopState | null;
  campfire: SpireCampfireState | null;
  event: SpireEventState | null;
  treasure: SpireTreasureState | null;

  // Summary / replay context
  stats: SpireRunStats;
  /** Name of the foe that ended the run (on defeat) */
  defeatedBy?: string;
}

export interface SpireMeta {
  version: 1;
  totalRuns: number;
  victories: number;
  highestAscensionUnlocked: number;
  highestAscensionCleared: number;
  bestFloor: number;
  bestEndlessFloor: number;
  bestBiggestHit: number;
  bestDpm: number;
  fighterWins: Partial<Record<CharacterName, number>>;
}

export interface SpireLastFightSnapshot {
  run: RunState;
  weapons: Weapon[];
  builds: WeaponBuilds;
}
