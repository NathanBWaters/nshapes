import type {
  CardEdition,
  EditionDef,
  PatternHandDef,
  PatternHandId,
  PatternHandLevels,
  PrismCard,
  PrismColor,
  PrismNumber,
  PrismShape,
} from '../types';

export const PRISM_COLORS: readonly PrismColor[] = ['red', 'green', 'purple'];
export const PRISM_SHAPES: readonly PrismShape[] = ['oval', 'squiggle', 'diamond'];
export const PRISM_NUMBERS: readonly PrismNumber[] = [1, 2, 3];

export const COLOR_LABELS: Record<PrismColor, string> = {
  red: 'Orange',
  green: 'Blue',
  purple: 'Pink',
};

export const SHAPE_LABELS: Record<PrismShape, string> = {
  oval: 'Circle',
  squiggle: 'Bolt',
  diamond: 'Triangle',
};

export const NUMBER_LABELS: Record<PrismNumber, string> = {
  1: '1',
  2: '2',
  3: '3',
};

export const EDITIONS: Record<CardEdition, EditionDef> = {
  none: {
    id: 'none',
    name: 'Standard',
    shortLabel: '',
    description: 'Standard card (pips = Number × 10 Chips).',
    accentColor: '#383838',
    chipsBonus: 0,
    multBonus: 0,
    xMult: 1,
    goldBonus: 0,
    shatterChance: 0,
  },
  foil: {
    id: 'foil',
    name: 'Foil',
    shortLabel: 'FOIL',
    description: '+50 Chips when scored.',
    accentColor: '#3B82F6',
    chipsBonus: 50,
    multBonus: 0,
    xMult: 1,
    goldBonus: 0,
    shatterChance: 0,
  },
  holo: {
    id: 'holo',
    name: 'Holographic',
    shortLabel: 'HOLO',
    description: '+10 Mult when scored.',
    accentColor: '#EC4899',
    chipsBonus: 0,
    multBonus: 10,
    xMult: 1,
    goldBonus: 0,
    shatterChance: 0,
  },
  poly: {
    id: 'poly',
    name: 'Polychrome',
    shortLabel: 'POLY',
    description: '×1.5 Mult when scored.',
    accentColor: '#9333EA',
    chipsBonus: 0,
    multBonus: 0,
    xMult: 1.5,
    goldBonus: 0,
    shatterChance: 0,
  },
  glass: {
    id: 'glass',
    name: 'Glass',
    shortLabel: 'GLASS',
    description: '×2 Mult when scored. 1-in-4 chance to shatter.',
    accentColor: '#06B6D4',
    chipsBonus: 0,
    multBonus: 0,
    xMult: 2,
    goldBonus: 0,
    shatterChance: 0.25,
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    shortLabel: 'GOLD',
    description: '+$3 Gold and +15 Chips when scored.',
    accentColor: '#D97706',
    chipsBonus: 15,
    multBonus: 0,
    xMult: 1,
    goldBonus: 3,
    shatterChance: 0,
  },
  wild: {
    id: 'wild',
    name: 'Wild',
    shortLabel: 'WILD',
    description: 'Matches any Color, Shape, and Number. +20 Chips.',
    accentColor: '#16AA98',
    chipsBonus: 20,
    multBonus: 0,
    xMult: 1,
    goldBonus: 0,
    shatterChance: 0,
  },
};

export const SPECIAL_EDITIONS: readonly Exclude<CardEdition, 'none'>[] = [
  'foil',
  'holo',
  'poly',
  'glass',
  'gold',
  'wild',
];

export const PATTERN_HANDS: readonly PatternHandDef[] = [
  {
    id: 'simple_triad',
    name: 'Simple Triad',
    rank: 1,
    ruleSummary: 'Valid Set with 1 trait the same and 2 traits different.',
    baseChips: 15,
    baseMult: 2,
    levelChips: 8,
    levelMult: 1,
    accentColor: '#64748B',
  },
  {
    id: 'color_run',
    name: 'Color Run',
    rank: 2,
    ruleSummary: 'Same Shape & Number, all 3 Colors different.',
    baseChips: 25,
    baseMult: 3,
    levelChips: 12,
    levelMult: 1,
    accentColor: '#EF4444',
  },
  {
    id: 'shape_run',
    name: 'Shape Run',
    rank: 3,
    ruleSummary: 'Same Color & Number, all 3 Shapes different.',
    baseChips: 25,
    baseMult: 3,
    levelChips: 12,
    levelMult: 1,
    accentColor: '#16AA98',
  },
  {
    id: 'number_run',
    name: 'Number Run',
    rank: 4,
    ruleSummary: 'Same Color & Shape, Numbers 1-2-3.',
    baseChips: 30,
    baseMult: 3,
    levelChips: 12,
    levelMult: 1,
    accentColor: '#3B82F6',
  },
  {
    id: 'true_rainbow',
    name: 'True Rainbow',
    rank: 5,
    ruleSummary: 'All 3 traits (Color, Shape, Number) all different.',
    baseChips: 40,
    baseMult: 4,
    levelChips: 15,
    levelMult: 2,
    accentColor: '#9333EA',
  },
  {
    id: 'adjacency_chain',
    name: 'Adjacency Chain',
    rank: 6,
    ruleSummary: 'Valid Set of 3 orthogonally connected cards on the board.',
    baseChips: 45,
    baseMult: 4,
    levelChips: 18,
    levelMult: 2,
    accentColor: '#F59E0B',
  },
  {
    id: 'prismatic_crown',
    name: 'Prismatic Crown',
    rank: 7,
    ruleSummary: 'Adjacent True Rainbow (or 3 identical Cloned cards).',
    baseChips: 70,
    baseMult: 6,
    levelChips: 25,
    levelMult: 3,
    accentColor: '#EC4899',
  },
];

export const PATTERN_HAND_BY_ID: Record<PatternHandId, PatternHandDef> = Object.fromEntries(
  PATTERN_HANDS.map(h => [h.id, h])
) as Record<PatternHandId, PatternHandDef>;

export const createInitialHandLevels = (): PatternHandLevels => ({
  simple_triad: 1,
  color_run: 1,
  shape_run: 1,
  number_run: 1,
  true_rainbow: 1,
  adjacency_chain: 1,
  prismatic_crown: 1,
});

export const getPatternHandStats = (
  handId: PatternHandId,
  level: number
): { chips: number; mult: number; def: PatternHandDef } => {
  const def = PATTERN_HAND_BY_ID[handId];
  const lv = Math.max(1, Math.floor(level));
  return {
    def,
    chips: def.baseChips + (lv - 1) * def.levelChips,
    mult: def.baseMult + (lv - 1) * def.levelMult,
  };
};

/** Generate the full canonical 27-card 3-trait SET deck. */
export const createStandardDeck = (): PrismCard[] => {
  const cards: PrismCard[] = [];
  let idx = 1;
  for (const color of PRISM_COLORS) {
    for (const shape of PRISM_SHAPES) {
      for (const number of PRISM_NUMBERS) {
        cards.push({
          id: `card-${idx}`,
          color,
          shape,
          number,
          edition: 'none',
        });
        idx += 1;
      }
    }
  }
  return cards;
};

/** Whether a card is currently Wild (permanent Wild edition or blind-only tempWild). */
export const isCardWild = (card: PrismCard): boolean => card.edition === 'wild' || Boolean(card.tempWild);

/** Whether a card carries any non-standard Edition. */
export const hasCardEdition = (card: PrismCard): boolean => card.edition !== 'none' || Boolean(card.tempWild);

/** Base pip Chips contributed by a scored card (`number × 10`). */
export const getCardBaseChips = (card: PrismCard): number => card.number * 10;

/** Compact readable label for a card (e.g., "2 Red Diamonds"). */
export const formatCardLabel = (card: PrismCard): string => {
  if (isCardWild(card)) {
    return card.tempWild && card.edition === 'none'
      ? `Wild* (${card.number} ${COLOR_LABELS[card.color]} ${SHAPE_LABELS[card.shape]})`
      : 'Wild Card';
  }
  const plural = card.number === 1 ? '' : 's';
  return `${card.number} ${COLOR_LABELS[card.color]} ${SHAPE_LABELS[card.shape]}${plural}`;
};

export const cycleColor = (c: PrismColor): PrismColor =>
  PRISM_COLORS[(PRISM_COLORS.indexOf(c) + 1) % PRISM_COLORS.length];

export const cycleShape = (s: PrismShape): PrismShape =>
  PRISM_SHAPES[(PRISM_SHAPES.indexOf(s) + 1) % PRISM_SHAPES.length];

export const cycleNumber = (n: PrismNumber): PrismNumber =>
  PRISM_NUMBERS[(PRISM_NUMBERS.indexOf(n) + 1) % PRISM_NUMBERS.length];
