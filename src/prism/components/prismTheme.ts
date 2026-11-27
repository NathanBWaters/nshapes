/**
 * [UI-04] Prism Deck shared evening tabletop ink-teal & Storybook brass theme,
 * number formatters, Charm/Edition visual metadata, Colorblind shape palette,
 * and SFX gateway. Harmonized with NShapes' Tactile Tabletop Storybook ink
 * (`#383838`), ivory cardstock (`#FFFDF7`), and warm Action Yellow brass.
 */
import { COLOR_BADGE_LETTER, getCardShapeColor } from '@/utils/cardVisuals';
import { COLORS } from '@/utils/colors';
import { playSound, type SoundCategory } from '@/utils/sounds';
import { selectionHaptic, triggerHaptic, type HapticType } from '@/utils/haptics';
import { SoundStorage, MusicStorage } from '@/utils/storage';
import type { CardEdition, CharmRole, PrismColor } from '../types';

export const PRISM_COLORS = {
  // Core contract palette — harmonized evening Storybook ink-teal tabletop
  feltBg: '#102B26',
  feltSurface: '#163A36',
  feltElevated: '#1E4942',
  feltBorder: '#385E56',
  gold: COLORS.actionYellow,
  goldDark: '#C89B1E',
  chipsBlue: '#38BDF8',
  multRed: '#F43F5E',
  xMultPurple: '#C084FC',
  econGreen: '#34D399',
  textPrimary: '#FFFDF7',
  textMuted: '#B2C8C0',
  danger: '#DC2626',
  cardWhite: COLORS.ivoryCard,
  cardBorder: COLORS.slateCharcoal,

  // Extended tabletop-ink accents
  feltDeep: '#0B1F1C',
  brassLight: '#FEF08A',
  brassBg: 'rgba(255, 222, 0, 0.14)',
  chipsBg: '#0C344D',
  multBg: '#4C1124',
  xMultBg: '#361554',
  econBg: '#0E3A2B',
  bossBg: '#360F1C',
  bossBorder: '#E11D48',
  utilityTeal: '#2DD4BF',
} as const;

export const PRISM_COLORBLIND_LETTER: Record<PrismColor, string> = COLOR_BADGE_LETTER;

/** Universal CVD-safe shape colors — matches src/components/Card.tsx (Orange / Sky Blue / Berry Pink). */
export const getPrismShapeColor = (color: PrismColor, _colorblind = false): string =>
  getCardShapeColor(color);

/**
 * Format Balatro-scale numbers cleanly:
 * - < 1,000,000: '1,250'
 * - 1M..999M: '1.25M'
 * - 1B..999B: '1.11B'
 * - >= 1e12: '1.25e12'
 */
export const formatScore = (n: number): string => {
  if (!Number.isFinite(n)) return '0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  if (abs >= 1e12) {
    return `${sign}${abs.toExponential(2).replace('+', '')}`;
  }
  if (abs >= 1e9) {
    const val = (abs / 1e9).toFixed(2).replace(/\.?0+$/, '');
    return `${sign}${val}B`;
  }
  if (abs >= 1e6) {
    const val = (abs / 1e6).toFixed(2).replace(/\.?0+$/, '');
    return `${sign}${val}M`;
  }
  return `${sign}${Math.round(abs).toLocaleString('en-US')}`;
};

export const formatMult = (m: number): string => {
  if (!Number.isFinite(m)) return '0';
  if (Math.abs(m) >= 1e6) return formatScore(m);
  const rounded = Math.round(m * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toLocaleString('en-US') : String(rounded);
};

export const roleColor = (role: CharmRole): string => {
  switch (role) {
    case 'chips':
      return PRISM_COLORS.chipsBlue;
    case 'mult':
      return PRISM_COLORS.multRed;
    case 'xmult':
      return PRISM_COLORS.xMultPurple;
    case 'econ':
      return PRISM_COLORS.econGreen;
    case 'utility':
    default:
      return PRISM_COLORS.gold;
  }
};

export const roleBadgeLabel = (role: CharmRole): string => {
  switch (role) {
    case 'chips':
      return '+Chips';
    case 'mult':
      return '+Mult';
    case 'xmult':
      return '×Mult';
    case 'econ':
      return '$';
    case 'utility':
    default:
      return 'Utility';
  }
};

export interface EditionVisualMeta {
  label: string;
  short: string;
  color: string;
  bg: string;
  desc: string;
}

export const editionMeta = (ed: CardEdition): EditionVisualMeta => {
  switch (ed) {
    case 'foil':
      return {
        label: 'Foil',
        short: 'FOIL',
        color: '#38BDF8',
        bg: 'rgba(56, 189, 248, 0.2)',
        desc: '+50 Chips when scored.',
      };
    case 'holo':
      return {
        label: 'Holographic',
        short: 'HOLO',
        color: '#F472B6',
        bg: 'rgba(244, 114, 182, 0.2)',
        desc: '+10 Mult when scored.',
      };
    case 'poly':
      return {
        label: 'Polychrome',
        short: 'POLY',
        color: '#C084FC',
        bg: 'rgba(192, 132, 252, 0.22)',
        desc: '×1.5 Mult when scored.',
      };
    case 'glass':
      return {
        label: 'Glass',
        short: 'GLASS',
        color: '#22D3EE',
        bg: 'rgba(34, 211, 238, 0.2)',
        desc: '×2 Mult when scored. 1-in-4 chance to shatter.',
      };
    case 'gold':
      return {
        label: 'Gold',
        short: 'GOLD',
        color: '#F2C94C',
        bg: 'rgba(242, 201, 76, 0.22)',
        desc: '+$3 Gold and +15 Chips when scored.',
      };
    case 'wild':
      return {
        label: 'Wild',
        short: 'WILD',
        color: '#2DD4BF',
        bg: 'rgba(45, 212, 191, 0.22)',
        desc: 'Matches any Color, Shape, and Number (+20 Chips).',
      };
    case 'none':
    default:
      return {
        label: 'Standard',
        short: '',
        color: PRISM_COLORS.textMuted,
        bg: 'rgba(159, 184, 174, 0.14)',
        desc: 'Standard card (Number × 10 Chips).',
      };
  }
};

export type PrismSfxKind =
  | 'select'
  | 'deselect'
  | 'play'
  | 'score_step'
  | 'big_hit'
  | 'discard'
  | 'spell'
  | 'buy'
  | 'sell'
  | 'reroll'
  | 'win'
  | 'lose'
  | 'invalid'
  | 'click';

const SFX_MAP: Record<PrismSfxKind, { sound: SoundCategory; haptic: HapticType | 'selection' }> = {
  select: { sound: 'click', haptic: 'selection' },
  deselect: { sound: 'click', haptic: 'selection' },
  play: { sound: 'matchValid', haptic: 'medium' },
  score_step: { sound: 'gainHint', haptic: 'light' },
  big_hit: { sound: 'explosion', haptic: 'heavy' },
  discard: { sound: 'cardSlide', haptic: 'light' },
  spell: { sound: 'laser', haptic: 'medium' },
  buy: { sound: 'confirm', haptic: 'success' },
  sell: { sound: 'gainMoney', haptic: 'light' },
  reroll: { sound: 'cardSlide', haptic: 'light' },
  win: { sound: 'gainHeart', haptic: 'success' },
  lose: { sound: 'gameOver', haptic: 'error' },
  invalid: { sound: 'matchInvalid', haptic: 'warning' },
  click: { sound: 'click', haptic: 'selection' },
};

const isSfxAllowed = (): boolean => {
  try {
    const sfxOn = typeof SoundStorage?.get === 'function' ? SoundStorage.get() : true;
    // Also read MusicStorage safely if audio state needs awareness without throwing in tests
    if (typeof MusicStorage?.get === 'function') {
      void MusicStorage.get();
    }
    return sfxOn;
  } catch {
    return false;
  }
};

/**
 * Play Prism Deck SFX & tactile haptics strictly through NShapes' existing
 * `@/utils/sounds` and `@/utils/haptics` gateways (never creates AudioContext).
 */
export const playPrismSfx = (kind: PrismSfxKind): void => {
  const entry = SFX_MAP[kind];
  if (!entry) return;

  if (isSfxAllowed()) {
    void playSound(entry.sound);
  }

  if (entry.haptic === 'selection') {
    void selectionHaptic();
  } else {
    void triggerHaptic(entry.haptic);
  }
};
