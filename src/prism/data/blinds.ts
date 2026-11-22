import type {
  BossBlindDef,
  BossBlindId,
  DailyMutatorDef,
  DailyMutatorId,
  PrismMeta,
  SkipTagDef,
  SkipTagId,
  StarterDeckDef,
  StarterDeckId,
  VoucherDef,
  VoucherId,
} from '../types';

// =============================================================================
// ANTE SCORE CURVE (ANTES 1-8 + ENDLESS 9+)
// =============================================================================

/**
 * Small Blind base target for Antes 1-8.
 * Big Blind = 1.5× Small; standard Boss Blind = 2.0× Small (The Monolith = 3.0×).
 * Calibrated so Ante 1 is welcoming, bare starter builds hit a real wall around Ante 3-4,
 * and smart Charm/Synergy/Star Chart builds clear Ante 8 and blast into Endless 9-12.
 */
export const ANTE_SMALL_TARGETS: readonly number[] = [
  350, // Ante 1: Small 350 / Big 525 / Boss 700
  1100, // Ante 2: Small 1,100 / Big 1,650 / Boss 2,200
  3200, // Ante 3: Small 3,200 / Big 4,800 / Boss 6,400
  9000, // Ante 4: Small 9,000 / Big 13,500 / Boss 18,000
  25000, // Ante 5: Small 25,000 / Big 37,500 / Boss 50,000
  65000, // Ante 6: Small 65,000 / Big 97,500 / Boss 130,000
  160000, // Ante 7: Small 160,000 / Big 240,000 / Boss 320,000
  350000, // Ante 8: Small 350,000 / Big 525,000 / Boss 700,000
];

export const VICTORY_ANTE = 8;

/** Compute Small Blind target score for any Ante (1-8 curated, 9+ Balatro-style super-exponential Endless). */
export const getSmallBlindTarget = (ante: number): number => {
  const clamped = Math.max(1, Math.floor(ante));
  if (clamped <= ANTE_SMALL_TARGETS.length) {
    return ANTE_SMALL_TARGETS[clamped - 1];
  }
  const depth = clamped - ANTE_SMALL_TARGETS.length; // 1 for Ante 9, 2 for Ante 10...
  const raw =
    ANTE_SMALL_TARGETS[ANTE_SMALL_TARGETS.length - 1] *
    Math.pow(3.2, depth) *
    Math.pow(1.45, (depth * (depth - 1)) / 2);
  // Round cleanly to 3 significant figures for readable huge numbers
  const mag = Math.pow(10, Math.max(2, Math.floor(Math.log10(raw)) - 2));
  return Math.round(raw / mag) * mag;
};

export const getBlindTarget = (
  ante: number,
  kind: 'small' | 'big' | 'boss',
  bossId?: BossBlindId,
  extraMultiplier: number = 1
): number => {
  const small = getSmallBlindTarget(ante);
  let mult = 1;
  if (kind === 'big') mult = 1.5;
  else if (kind === 'boss') {
    mult = bossId ? BOSS_BLIND_BY_ID[bossId].targetMultiplier : 2.0;
  }
  const scaled = small * mult * extraMultiplier;
  if (scaled >= 10000) return Math.round(scaled / 100) * 100;
  if (scaled >= 1000) return Math.round(scaled / 25) * 25;
  return Math.round(scaled / 5) * 5;
};

export const BLIND_REWARD_GOLD: Record<'small' | 'big' | 'boss', number> = {
  small: 3,
  big: 4,
  boss: 5,
};

// =============================================================================
// 10 DISTINCT RULE-TWISTING BOSS BLINDS
// =============================================================================

export const BOSS_BLINDS: readonly BossBlindDef[] = [
  {
    id: 'crimson_tax',
    name: 'Crimson Fog',
    icon: 'lorc/fire-ring',
    shortRule: 'Red cards debuffed',
    description: 'Red cards are debuffed (their pips and Editions do not score, though they still form Sets).',
    targetMultiplier: 2.0,
    accentColor: '#DC2626',
    debuffedColor: 'red',
  },
  {
    id: 'emerald_blight',
    name: 'Emerald Blight',
    icon: 'lorc/thorny-vine',
    shortRule: 'Green cards debuffed',
    description: 'Green cards are debuffed (their pips and Editions do not score, though they still form Sets).',
    targetMultiplier: 2.0,
    accentColor: '#15803D',
    debuffedColor: 'green',
  },
  {
    id: 'amethyst_veil',
    name: 'Amethyst Veil',
    icon: 'lorc/cursed-star',
    shortRule: 'Purple cards debuffed',
    description: 'Purple cards are debuffed (their pips and Editions do not score, though they still form Sets).',
    targetMultiplier: 2.0,
    accentColor: '#7E22CE',
    debuffedColor: 'purple',
  },
  {
    id: 'the_wall',
    name: 'The Monolith',
    icon: 'delapouite/stone-wall',
    shortRule: '1.5× Boss target',
    description: 'An imposing stone wall: 50% higher target score than normal Boss Blinds, with no debuffs.',
    targetMultiplier: 3.0,
    accentColor: '#475569',
  },
  {
    id: 'the_pinch',
    name: 'The Pinch',
    icon: 'lorc/wolf-trap',
    shortRule: '0 Discards',
    description: 'Start this Blind with 0 Discards. Play the board as dealt or bend it with Spells.',
    targetMultiplier: 2.0,
    accentColor: '#B45309',
  },
  {
    id: 'the_narrow',
    name: 'Narrow Table',
    icon: 'lorc/cobweb',
    shortRule: '-3 Board Cards',
    description: 'Board size shrinks by 3 cards (minimum 9) for this Blind.',
    targetMultiplier: 2.0,
    accentColor: '#334155',
  },
  {
    id: 'the_mirror_tax',
    name: 'No Repeats',
    icon: 'lorc/mirror-mirror',
    shortRule: 'Repeat Hands halved',
    description: 'Playing the same Pattern Hand twice in a row halves its Mult.',
    targetMultiplier: 2.0,
    accentColor: '#0284C7',
  },
  {
    id: 'the_tithe',
    name: 'The Tithe',
    icon: 'lorc/cash',
    shortRule: '-$2 per Set',
    description: 'Every Set played costs $2 Gold (or -2 Mult if you cannot pay).',
    targetMultiplier: 2.0,
    accentColor: '#CA8A04',
  },
  {
    id: 'the_eclipse',
    name: 'The Eclipse',
    icon: 'lorc/moon',
    shortRule: 'Leftmost Charm disabled',
    description: 'Your leftmost Charm is eclipsed for this Blind — reorder your Charm bar to protect key pieces!',
    targetMultiplier: 2.0,
    accentColor: '#4F46E5',
  },
  {
    id: 'the_prism_test',
    name: 'Prismatic Crucible',
    icon: 'lorc/dragon-head',
    shortRule: 'Simple Triads halved',
    description: 'Simple Triads score half points. Hunt Runs, Rainbows, and Adjacency Chains!',
    targetMultiplier: 2.2,
    accentColor: '#BE123C',
  },
];

export const BOSS_BLIND_BY_ID: Record<BossBlindId, BossBlindDef> = Object.fromEntries(
  BOSS_BLINDS.map(b => [b.id, b])
) as Record<BossBlindId, BossBlindDef>;

// =============================================================================
// 8 SKIP-BLIND REWARD TAGS
// =============================================================================

export const SKIP_TAGS: readonly SkipTagDef[] = [
  {
    id: 'investment_tag',
    name: 'Investment Tag',
    icon: 'delapouite/coins-pile',
    description: 'Earn +$15 Gold after defeating this Ante’s Boss Blind.',
    accentColor: '#D97706',
  },
  {
    id: 'foil_cache',
    name: 'Foil Cache',
    icon: 'delapouite/sparkles',
    description: 'Immediately stamp 2 random standard cards in your deck as Foil (+50 Chips).',
    accentColor: '#3B82F6',
  },
  {
    id: 'polychrome_spark',
    name: 'Polychrome Spark',
    icon: 'lorc/crystal-shine',
    description: 'Immediately stamp 1 random card in your deck as Polychrome (×1.5 Mult).',
    accentColor: '#9333EA',
  },
  {
    id: 'charm_pack',
    name: 'Rare Charm Tag',
    icon: 'lorc/locked-chest',
    description: 'Next Shop guarantees a Rare Charm at $0 (Free!).',
    accentColor: '#E11D48',
  },
  {
    id: 'star_shower',
    name: 'Star Shower',
    icon: 'delapouite/falling-star',
    description: 'Immediately upgrade 2 random Pattern Hands by +1 Level.',
    accentColor: '#2563EB',
  },
  {
    id: 'spell_cache',
    name: 'Spell Cache',
    icon: 'lorc/crystal-wand',
    description: 'Immediately gain 2 random Spells (overflow converts to +$4 Gold each).',
    accentColor: '#0D9488',
  },
  {
    id: 'coupon_tag',
    name: 'Coupon Tag',
    icon: 'delapouite/ticket',
    description: 'Charms, Star Charts, and Spells in the next Shop are 50% off.',
    accentColor: '#F59E0B',
  },
  {
    id: 'juggler_tag',
    name: 'Extra Hand Tag',
    icon: 'lorc/poker-hand',
    description: 'Start the next Blind with +2 bonus Hands.',
    accentColor: '#16AA98',
  },
];

export const SKIP_TAG_BY_ID: Record<SkipTagId, SkipTagDef> = Object.fromEntries(
  SKIP_TAGS.map(t => [t.id, t])
) as Record<SkipTagId, SkipTagDef>;

// =============================================================================
// 6 ANTE VOUCHERS
// =============================================================================

export const VOUCHERS: readonly VoucherDef[] = [
  {
    id: 'extra_hand',
    name: 'Grabber',
    cost: 10,
    icon: 'lorc/fist',
    description: 'Permanently gain +1 Hand every Blind.',
    accentColor: '#2563EB',
  },
  {
    id: 'extra_discard',
    name: 'Wasteful',
    cost: 10,
    icon: 'lorc/recycle',
    description: 'Permanently gain +1 Discard every Blind.',
    accentColor: '#DC2626',
  },
  {
    id: 'extra_charm_slot',
    name: 'Charm Belt',
    cost: 10,
    icon: 'lorc/belt-buckles',
    description: 'Permanently gain +1 Charm slot.',
    accentColor: '#9333EA',
  },
  {
    id: 'spell_satchel',
    name: 'Spell Satchel',
    cost: 10,
    icon: 'lorc/swap-bag',
    description: 'Permanently gain +1 Spell slot and +1 Spell offered in every Shop.',
    accentColor: '#0D9488',
  },
  {
    id: 'clearance_sale',
    name: 'Clearance Sale',
    cost: 10,
    icon: 'lorc/cash',
    description: 'All Shop items and Rerolls cost 25% less (minimum $1).',
    accentColor: '#D97706',
  },
  {
    id: 'telescope',
    name: 'Telescope',
    cost: 10,
    icon: 'lorc/spectacle-lenses',
    description: 'Shop Star Charts always include your most-played Hand and grant +2 Levels.',
    accentColor: '#4F46E5',
  },
];

export const VOUCHER_BY_ID: Record<VoucherId, VoucherDef> = Object.fromEntries(
  VOUCHERS.map(v => [v.id, v])
) as Record<VoucherId, VoucherDef>;

// =============================================================================
// 5 STARTER DECKS WITH UNLOCK MILESTONES
// =============================================================================

export const STARTER_DECKS: readonly StarterDeckDef[] = [
  {
    id: 'classic_prism',
    name: 'Prism Standard',
    icon: 'delapouite/prism',
    description: 'Balanced 27-card deck: 4 Hands, 3 Discards, 12-card board, 5 Charm slots, $6 Gold.',
    unlockRequirement: 'Unlocked by default',
    accentColor: '#16AA98',
    startingGold: 6,
    baseHands: 4,
    baseDiscards: 3,
    baseBoardSize: 12,
    baseCharmSlots: 5,
    baseSpellSlots: 2,
    unusedHandGoldBonus: 1,
  },
  {
    id: 'gilded_ledger',
    name: 'Gilded Deck',
    icon: 'lorc/crown-coin',
    description: 'Start with $14 Gold, 2 Gold cards in deck, and +$2 per unused Hand at Blind clear.',
    unlockRequirement: 'Reach Ante 4 in any run',
    accentColor: '#D97706',
    startingGold: 14,
    baseHands: 4,
    baseDiscards: 3,
    baseBoardSize: 12,
    baseCharmSlots: 5,
    baseSpellSlots: 2,
    unusedHandGoldBonus: 2,
  },
  {
    id: 'alchemist_grimoire',
    name: 'Spellcraft Deck',
    icon: 'lorc/open-book',
    description: 'Start with Alchemist’s Flask, 2 Spells (Repaint + Glass Stamp), and 3 Spell slots.',
    unlockRequirement: 'Cast 10 Spells across runs (or reach Ante 5)',
    accentColor: '#0D9488',
    startingGold: 6,
    baseHands: 4,
    baseDiscards: 3,
    baseBoardSize: 12,
    baseCharmSlots: 5,
    baseSpellSlots: 3,
    unusedHandGoldBonus: 1,
  },
  {
    id: 'vast_table',
    name: 'Horizon Deck',
    icon: 'lorc/field',
    description: 'Huge 15-card board and 4 Discards per Blind for crafting Rainbows & Crowns ($4 starting Gold).',
    unlockRequirement: 'Win a run (Clear Ante 8)',
    accentColor: '#2563EB',
    startingGold: 4,
    baseHands: 4,
    baseDiscards: 4,
    baseBoardSize: 15,
    baseCharmSlots: 5,
    baseSpellSlots: 2,
    unusedHandGoldBonus: 1,
  },
  {
    id: 'glass_mirage',
    name: 'Glass Mirage',
    icon: 'lorc/shattered-glass',
    description: 'Start with 4 Glass cards, 1 Wild card, and 6 Charm slots — high-wire 3 Hands per Blind.',
    unlockRequirement: 'Score 25,000+ in a single Set (or finish 3 Daily Runs)',
    accentColor: '#06B6D4',
    startingGold: 6,
    baseHands: 3,
    baseDiscards: 3,
    baseBoardSize: 12,
    baseCharmSlots: 6,
    baseSpellSlots: 2,
    unusedHandGoldBonus: 1,
  },
];

export const STARTER_DECK_BY_ID: Record<StarterDeckId, StarterDeckDef> = Object.fromEntries(
  STARTER_DECKS.map(d => [d.id, d])
) as Record<StarterDeckId, StarterDeckDef>;

/** Evaluate which Starter Decks are unlocked given career meta progress. */
export const computeUnlockedDecks = (meta: PrismMeta): StarterDeckId[] => {
  const unlocked = new Set<StarterDeckId>(['classic_prism', ...meta.unlockedDecks]);
  if (meta.bestAnte >= 4) unlocked.add('gilded_ledger');
  if (meta.totalSpellsUsed >= 10 || meta.bestAnte >= 5) unlocked.add('alchemist_grimoire');
  if (meta.victories >= 1 || meta.bestAnte >= 8) unlocked.add('vast_table');
  if (meta.bestSingleSet >= 25000 || meta.completedDailyDates.length >= 3) unlocked.add('glass_mirage');
  return STARTER_DECKS.map(d => d.id).filter(id => unlocked.has(id));
};

export const isDeckUnlocked = (deckId: StarterDeckId, meta: PrismMeta): boolean =>
  computeUnlockedDecks(meta).includes(deckId);

// =============================================================================
// 7 ROTATING DAILY MUTATORS
// =============================================================================

export const DAILY_MUTATORS: readonly DailyMutatorDef[] = [
  {
    id: 'golden_rush',
    name: 'Golden Rush',
    icon: 'lorc/crown-coin',
    description: 'Start with +$10 Gold and $2 Shop Rerolls; Boss Blind targets +15%.',
    accentColor: '#D97706',
  },
  {
    id: 'rainbow_fever',
    name: 'Rainbow Fever',
    icon: 'lorc/rainbow-star',
    description: 'True Rainbow & Prismatic Crown start at Level 3!',
    accentColor: '#9333EA',
  },
  {
    id: 'glass_house',
    name: 'Glass House',
    icon: 'lorc/glass-heart',
    description: '5 random starter cards begin stamped with Glass (×2 Mult, 1-in-4 shatter).',
    accentColor: '#06B6D4',
  },
  {
    id: 'tight_quarters',
    name: 'Tight Quarters',
    icon: 'lorc/cobweb',
    description: 'Compact 9-card board (-3), but +1 Hand and +1 Discard every Blind.',
    accentColor: '#475569',
  },
  {
    id: 'spellstorm',
    name: 'Spellstorm',
    icon: 'lorc/crystal-wand',
    description: 'Start with 2 random Spells and earn 1 free Spell after every Boss Blind.',
    accentColor: '#0D9488',
  },
  {
    id: 'six_charms',
    name: 'Charm Parade',
    icon: 'lorc/belt-buckles',
    description: 'Start with +1 Charm slot (6 total) and 1 random Common Charm.',
    accentColor: '#EC4899',
  },
  {
    id: 'wildcard_wednesday',
    name: 'Wild Twist',
    icon: 'delapouite/card-joker',
    description: '2 random starter cards begin as Wild; Boss Blind targets +10%.',
    accentColor: '#16AA98',
  },
];

export const DAILY_MUTATOR_BY_ID: Record<DailyMutatorId, DailyMutatorDef> = Object.fromEntries(
  DAILY_MUTATORS.map(m => [m.id, m])
) as Record<DailyMutatorId, DailyMutatorDef>;
