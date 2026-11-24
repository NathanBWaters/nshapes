import type { SpellDef, SpellId } from '../types';

export const SPELLS: readonly SpellDef[] = [
  {
    id: 'repaint',
    name: 'Repaint',
    cost: 3,
    icon: 'lorc/flowers',
    shortLabel: 'Shift Color',
    description: 'Permanently change 1 selected card’s Color (cycles Orange → Blue → Pink, or pick a Color).',
    accentColor: '#E05A04',
    supportsValueChoice: true,
  },
  {
    id: 'reshape',
    name: 'Reshape',
    cost: 3,
    icon: 'delapouite/prism',
    shortLabel: 'Shift Shape',
    description: 'Permanently change 1 selected card’s Shape (cycles Circle → Bolt → Triangle, or pick a Shape).',
    accentColor: '#007870',
    supportsValueChoice: true,
  },
  {
    id: 'renumber',
    name: 'Renumber',
    cost: 3,
    icon: 'delapouite/rolling-dices',
    shortLabel: 'Shift Number',
    description: 'Permanently change 1 selected card’s Number (cycles 1 → 2 → 3, or pick a Number).',
    accentColor: '#3B82F6',
    supportsValueChoice: true,
  },
  {
    id: 'clone',
    name: 'Clone',
    cost: 5,
    icon: 'delapouite/gemini',
    shortLabel: 'Duplicate Card',
    description: 'Permanently duplicate 1 selected card (including its Edition) into your deck & draw pile.',
    accentColor: '#8B5CF6',
  },
  {
    id: 'prune',
    name: 'Prune',
    cost: 4,
    icon: 'lorc/scythe',
    shortLabel: 'Remove Card',
    description: 'Permanently remove 1 selected card from your deck and deal a fresh card in its spot.',
    accentColor: '#475569',
  },
  {
    id: 'wild-stamp',
    name: 'Wild Stamp',
    cost: 6,
    icon: 'delapouite/card-joker',
    shortLabel: 'Make Wild',
    description: 'Permanently stamp 1 selected card as Wild (matches any Color, Shape, and Number; +20 Chips).',
    accentColor: '#16AA98',
  },
  {
    id: 'glass-stamp',
    name: 'Glass Stamp',
    cost: 5,
    icon: 'lorc/glass-heart',
    shortLabel: 'Make Glass',
    description: 'Permanently stamp 1 selected card as Glass (×2 Mult when scored; 1-in-4 chance to shatter).',
    accentColor: '#06B6D4',
  },
  {
    id: 'gild',
    name: 'Gild',
    cost: 4,
    icon: 'lorc/gold-scarab',
    shortLabel: 'Make Gold',
    description: 'Permanently stamp 1 selected card as Gold (+$3 Gold and +15 Chips every time it scores).',
    accentColor: '#D97706',
  },
];

export const SPELL_BY_ID: Record<SpellId, SpellDef> = Object.fromEntries(
  SPELLS.map(s => [s.id, s])
) as Record<SpellId, SpellDef>;
