import type { IconName } from '@/components/Icon';
import type { Color, Number as CardNumber, Shape } from '@/types';

// =============================================================================
// CORE CARD, TRAIT & EDITION TYPES
// =============================================================================

export type PrismColor = Color; // 'red' | 'green' | 'purple'
export type PrismShape = Shape; // 'oval' | 'squiggle' | 'diamond'
export type PrismNumber = CardNumber; // 1 | 2 | 3
export type PrismTrait = 'color' | 'shape' | 'number';

export type CardEdition = 'none' | 'foil' | 'holo' | 'poly' | 'glass' | 'gold' | 'wild';

export interface PrismCard {
  /** Unique card instance ID within a run (survives draw/discard cycles). */
  id: string;
  color: PrismColor;
  shape: PrismShape;
  number: PrismNumber;
  edition: CardEdition;
  /** Temporary blind-only Wild override (e.g., from Wild Weaver or deadlock safety). */
  tempWild?: boolean;
}

export interface EditionDef {
  id: CardEdition;
  name: string;
  shortLabel: string;
  description: string;
  accentColor: string;
  chipsBonus: number;
  multBonus: number;
  xMult: number;
  goldBonus: number;
  shatterChance: number;
}

// =============================================================================
// PATTERN HANDS
// =============================================================================

export type PatternHandId =
  | 'simple_triad'
  | 'color_run'
  | 'shape_run'
  | 'number_run'
  | 'true_rainbow'
  | 'adjacency_chain'
  | 'prismatic_crown';

export interface PatternHandDef {
  id: PatternHandId;
  name: string;
  rank: number; // 1 (lowest) to 7 (highest)
  ruleSummary: string;
  baseChips: number;
  baseMult: number;
  levelChips: number;
  levelMult: number;
  accentColor: string;
}

export type PatternHandLevels = Record<PatternHandId, number>;

// =============================================================================
// SET VALIDATION & DIAGNOSTICS
// =============================================================================

export type TraitCheckStatus = 'all_same' | 'all_diff' | 'mismatch';

export interface TraitCheck {
  trait: PrismTrait;
  status: TraitCheckStatus;
  values: string[];
  message: string;
}

export interface BlueprintNeed {
  color: PrismColor | 'any';
  shape: PrismShape | 'any';
  number: PrismNumber | 'any';
  /** Board indices currently on the board that complete this 2-card pair. */
  matchingBoardIndices: number[];
  summary: string;
}

export interface PatternClassification {
  handId: PatternHandId;
  isAdjacent: boolean;
  isRainbow: boolean;
  isPureRun: boolean;
  isCloneTriple: boolean;
  sameTraits: PrismTrait[];
  diffTraits: PrismTrait[];
  /** Effective resolved values for Wild cards when checking traits/colors. */
  resolvedColors: PrismColor[];
  resolvedShapes: PrismShape[];
  resolvedNumbers: PrismNumber[];
}

export interface SetEvaluation {
  isValid: boolean;
  traitChecks: TraitCheck[];
  mismatchReason: string | null;
  classification: PatternClassification | null;
}

// =============================================================================
// CHARMS (JOKERS) & SYNERGY PAIRS
// =============================================================================

export type CharmRole = 'chips' | 'mult' | 'xmult' | 'econ' | 'utility';
export type CharmRarity = 'common' | 'uncommon' | 'rare';

export interface CharmDef {
  id: string;
  name: string;
  role: CharmRole;
  rarity: CharmRarity;
  cost: number;
  icon: IconName;
  /** Optional key matching WeaponArtwork.tsx for reimagined NShapes weapons. */
  artworkWeaponId?: string;
  description: string;
  flavorText: string;
  accentColor: string;
}

/** Per-instance mutable-via-immutable-copy runtime state stored on an owned Charm. */
export interface CharmRuntimeState {
  /** Accumulator used by Snowball (+Mult), Alchemist's Flask (+xMult), Shatter Lens (+xMult). */
  counter: number;
  /** Shattered state for Glass Sword during a Blind. */
  shattered?: boolean;
  /** Bounty Poster current target trait & value. */
  bountyTrait?: PrismTrait;
  bountyValue?: string;
  bountyProgress?: number;
  /** Magnet currently marked board card ID. */
  magnetCardId?: string;
  /** Collector's Album unique PatternHandIds stamped this run. */
  stampedHands?: PatternHandId[];
}

export interface OwnedCharm {
  /** Unique owned instance ID. */
  instanceId: string;
  charmId: string;
  state: CharmRuntimeState;
}

export interface SynergyPairDef {
  id: string;
  name: string;
  charmA: string;
  charmB: string;
  icon: IconName;
  description: string;
  accentColor: string;
}

// =============================================================================
// SPELLS
// =============================================================================

export type SpellId =
  | 'repaint'
  | 'reshape'
  | 'renumber'
  | 'clone'
  | 'prune'
  | 'wild-stamp'
  | 'glass-stamp'
  | 'gild';

export interface SpellDef {
  id: SpellId;
  name: string;
  cost: number;
  icon: IconName;
  description: string;
  shortLabel: string;
  accentColor: string;
  /** Whether the spell can accept an explicit target trait value (or cycle if omitted). */
  supportsValueChoice?: boolean;
}

export interface OwnedSpell {
  instanceId: string;
  spellId: SpellId;
}

// =============================================================================
// BLINDS, BOSSES, SKIP TAGS, VOUCHERS, DECKS, DAILY MUTATORS
// =============================================================================

export type BlindKind = 'small' | 'big' | 'boss';

export type BossBlindId =
  | 'crimson_tax'
  | 'emerald_blight'
  | 'amethyst_veil'
  | 'the_wall'
  | 'the_pinch'
  | 'the_narrow'
  | 'the_mirror_tax'
  | 'the_tithe'
  | 'the_eclipse'
  | 'the_prism_test';

export interface BossBlindDef {
  id: BossBlindId;
  name: string;
  icon: IconName;
  description: string;
  shortRule: string;
  targetMultiplier: number; // Usually 2.0 relative to Small Blind base, 3.0 for The Monolith
  accentColor: string;
  debuffedColor?: PrismColor;
}

export type SkipTagId =
  | 'investment_tag'
  | 'foil_cache'
  | 'polychrome_spark'
  | 'charm_pack'
  | 'star_shower'
  | 'spell_cache'
  | 'coupon_tag'
  | 'juggler_tag';

export interface SkipTagDef {
  id: SkipTagId;
  name: string;
  icon: IconName;
  description: string;
  accentColor: string;
}

export type VoucherId =
  | 'extra_hand'
  | 'extra_discard'
  | 'extra_charm_slot'
  | 'spell_satchel'
  | 'clearance_sale'
  | 'telescope';

export interface VoucherDef {
  id: VoucherId;
  name: string;
  cost: number;
  icon: IconName;
  description: string;
  accentColor: string;
}

export type StarterDeckId =
  | 'classic_prism'
  | 'gilded_ledger'
  | 'alchemist_grimoire'
  | 'vast_table'
  | 'glass_mirage';

export interface StarterDeckDef {
  id: StarterDeckId;
  name: string;
  icon: IconName;
  description: string;
  unlockRequirement: string;
  accentColor: string;
  startingGold: number;
  baseHands: number;
  baseDiscards: number;
  baseBoardSize: number;
  baseCharmSlots: number;
  baseSpellSlots: number;
  unusedHandGoldBonus: number;
}

export type DailyMutatorId =
  | 'golden_rush'
  | 'rainbow_fever'
  | 'glass_house'
  | 'tight_quarters'
  | 'spellstorm'
  | 'six_charms'
  | 'wildcard_wednesday';

export interface DailyMutatorDef {
  id: DailyMutatorId;
  name: string;
  icon: IconName;
  description: string;
  accentColor: string;
}

export interface BlindOffer {
  kind: BlindKind;
  name: string;
  targetScore: number;
  rewardGold: number;
  bossId?: BossBlindId;
  skipTagId?: SkipTagId;
  status: 'upcoming' | 'active' | 'cleared' | 'skipped' | 'failed';
}

// =============================================================================
// SCORING PIPELINE & LIVE PREVIEW
// =============================================================================

export type ScoreStepKind = 'hand' | 'card' | 'edition' | 'charm' | 'synergy' | 'boss' | 'debuff';

export interface ScoreStep {
  kind: ScoreStepKind;
  label: string;
  cardId?: string;
  charmId?: string;
  charmSlot?: number;
  synergyId?: string;
  bossId?: BossBlindId;
  chipsDelta: number;
  multDelta: number;
  xMult?: number;
  goldDelta?: number;
  chipsAfter: number;
  multAfter: number;
  debuffed?: boolean;
  note?: string;
}

export interface ScoreResult {
  isValid: boolean;
  patternHand: PatternHandId;
  patternHandName: string;
  patternHandLevel: number;
  classification: PatternClassification;
  steps: ScoreStep[];
  finalChips: number;
  finalMult: number;
  finalScore: number;
  goldDelta: number;
  triggeredCharmIds: string[];
  activeSynergyIds: string[];
  shatteredCardIds: string[];
  shatterRiskCardIds: string[];
  updatedCharms: OwnedCharm[];
  nextRngState: number;
}

export interface SelectionPreview {
  selectedCount: number;
  isValidSet: boolean;
  blueprintNeed: BlueprintNeed | null;
  traitChecks: TraitCheck[];
  mismatchReason: string | null;
  patternHand: PatternHandId | null;
  patternHandName: string | null;
  patternHandLevel: number;
  triggeredCharmIds: string[];
  activeSynergyIds: string[];
  steps: ScoreStep[];
  estimatedChips: number;
  estimatedMult: number;
  estimatedTotal: number;
  estimatedGold: number;
  shatterRiskCardIds: string[];
  wouldClearBlind: boolean;
}

// =============================================================================
// SHOP & PAYOUT
// =============================================================================

export interface ShopCharmOffer {
  charmId: string;
  price: number;
  sold: boolean;
  freeFromTag?: boolean;
}

export interface ShopStarChartOffer {
  handId: PatternHandId;
  levelsGranted: number;
  price: number;
  sold: boolean;
}

export interface ShopSpellOffer {
  spellId: SpellId;
  price: number;
  sold: boolean;
}

export interface ShopVoucherOffer {
  voucherId: VoucherId;
  price: number;
  sold: boolean;
}

export interface ShopState {
  charms: ShopCharmOffer[];
  starCharts: ShopStarChartOffer[];
  spells: ShopSpellOffer[];
  voucher: ShopVoucherOffer | null;
  rerollCost: number;
  rerollCount: number;
  discountedFromTag: boolean;
}

export interface BlindPayoutBreakdown {
  blindReward: number;
  unusedHandsGold: number;
  interestGold: number;
  charmBonusGold: number;
  investmentTagGold: number;
  totalGold: number;
}

export interface AnteRecord {
  ante: number;
  small: 'cleared' | 'skipped' | 'failed' | 'pending';
  big: 'cleared' | 'skipped' | 'failed' | 'pending';
  boss: 'cleared' | 'failed' | 'pending';
  bossId: BossBlindId;
}

// =============================================================================
// COMPLETE RUN & META PERSISTENCE STATE
// =============================================================================

export type PrismPhase = 'blind_select' | 'playing' | 'shop' | 'victory' | 'defeat';

export interface PendingTagEffects {
  investmentCount: number;
  freeRareCharmNextShop: boolean;
  couponHalfOffNextShop: boolean;
  bonusHandsNextBlind: number;
}

export interface PrismRunStats {
  setsPlayed: number;
  discardsUsed: number;
  spellsUsed: number;
  shatteredCards: number;
  bestSingleSet: number;
  totalScore: number;
  totalGoldEarned: number;
  blindsCleared: number;
  blindsSkipped: number;
  handPlayCounts: Record<PatternHandId, number>;
}

export interface PrismRun {
  version: 1;
  runId: string;
  seed: string;
  rngState: number;
  nextInstanceSeq: number;

  deckId: StarterDeckId;
  isDaily: boolean;
  dailyDate: string | null;
  dailyMutatorId: DailyMutatorId | null;

  phase: PrismPhase;
  isEndless: boolean;
  abandoned: boolean;

  ante: number; // 1..8, 9+ in Endless
  blindIndex: number; // 0 = small, 1 = big, 2 = boss
  anteBlinds: [BlindOffer, BlindOffer, BlindOffer];
  anteHistory: AnteRecord[];
  seenBossIds: BossBlindId[];

  // Economy & Limits
  gold: number;
  baseHands: number;
  baseDiscards: number;
  baseBoardSize: number;
  boardCols: number;
  maxCharms: number;
  maxSpells: number;
  unusedHandGoldBonus: number;

  // Owned Progression
  deck: PrismCard[];
  charms: OwnedCharm[];
  spells: OwnedSpell[];
  vouchers: VoucherId[];
  handLevels: PatternHandLevels;
  starChartsUsed: number;
  pendingTags: PendingTagEffects;

  // Active Blind State
  blindScore: number;
  blindTarget: number;
  handsLeft: number;
  discardsLeft: number;
  handsPlayedThisBlind: number;
  discardsUsedThisBlind: number;
  board: PrismCard[];
  drawPile: PrismCard[];
  discardPile: PrismCard[];
  selectedIndices: number[];
  lastSetIndices: number[];
  lastPlayedHandThisBlind: PatternHandId | null;
  activeBossId: BossBlindId | null;

  // Shop & Feedback
  shop: ShopState | null;
  anteVoucherId: VoucherId | null;
  lastScoreBreakdown: ScoreResult | null;
  lastBlindPayout: BlindPayoutBreakdown | null;
  lastToast: string | null;

  stats: PrismRunStats;
  startedAt: number;
}

export interface PrismMeta {
  version: 1;
  totalRuns: number;
  victories: number;
  bestAnte: number;
  bestEndlessAnte: number;
  bestSingleSet: number;
  bestRunScore: number;
  totalSetsPlayed: number;
  totalSpellsUsed: number;
  unlockedDecks: StarterDeckId[];
  deckWins: Record<string, number>;
  dailyStreak: number;
  bestDailyStreak: number;
  lastDailyCompletedDate: string | null;
  completedDailyDates: string[];
  dailyBestScores: Record<string, number>;
}

export interface CreateRunOptions {
  seed?: string;
  deckId?: StarterDeckId;
  isDaily?: boolean;
  dailyDate?: string;
  startedAt?: number;
}
