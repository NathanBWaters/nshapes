import type {
  CharmDef,
  OwnedCharm,
  PrismRun,
  SynergyPairDef,
} from '../types';
import { COLOR_LABELS, SHAPE_LABELS, hasCardEdition } from './cards';

/**
 * 32 Curated Charms (Jokers):
 *  - 16 reimagined from NShapes' best Adventure weapons (`artworkWeaponId` matches WeaponArtwork.tsx)
 *  - 16 brand-new SET-Balatro archetypes
 *
 * Every `icon` is verified against `ICON_REGISTRY` in `src/components/Icon.tsx`.
 */
export const CHARMS: readonly CharmDef[] = [
  // ── 16 REIMAGINED CLASSIC NSHAPES CHARMS ──────────────────────────────────
  {
    id: 'rainbow-charm',
    name: 'Rainbow Charm',
    role: 'xmult',
    rarity: 'uncommon',
    cost: 7,
    icon: 'lorc/rainbow-star',
    artworkWeaponId: 'Rainbow Charm',
    description: '×2 Mult on True Rainbow or Prismatic Crown Sets.',
    flavorText: 'Three of nothing alike — every trait singing its own note.',
    accentColor: '#9333EA',
  },
  {
    id: 'magnet',
    name: 'Magnet',
    role: 'mult',
    rarity: 'common',
    cost: 5,
    icon: 'lorc/magnet',
    artworkWeaponId: 'Magnet',
    description: 'Marks 1 card on board; Sets including the Marked card gain +14 Mult.',
    flavorText: 'It always points at one card. Build your Set through it.',
    accentColor: '#DC2626',
  },
  {
    id: 'bounty-poster',
    name: 'Bounty Poster',
    role: 'chips',
    rarity: 'common',
    cost: 5,
    icon: 'delapouite/wanted-reward',
    artworkWeaponId: 'Bounty Poster',
    description: 'Names a Wanted trait; each Wanted card scored grants +35 Chips (rotates every 3).',
    flavorText: 'WANTED: dead or matched.',
    accentColor: '#B45309',
  },
  {
    id: 'odd-one-out',
    name: 'Odd One Out',
    role: 'mult',
    rarity: 'common',
    cost: 5,
    icon: 'delapouite/puzzle',
    artworkWeaponId: 'Odd One Out',
    description: '+18 Mult on Color Run, Shape Run, or Number Run Sets.',
    flavorText: 'Nearly identical. Almost.',
    accentColor: '#0284C7',
  },
  {
    id: 'snowball',
    name: 'Snowball',
    role: 'mult',
    rarity: 'uncommon',
    cost: 6,
    icon: 'lorc/snowman',
    artworkWeaponId: 'Snowball',
    description: 'Gains +2 Mult permanently per Set played; loses 4 Mult (min 0) when you Discard.',
    flavorText: 'Small at the crest. Unstoppable at the bottom.',
    accentColor: '#38BDF8',
  },
  {
    id: 'collectors-album',
    name: "Collector's Album",
    role: 'xmult',
    rarity: 'uncommon',
    cost: 7,
    icon: 'delapouite/post-stamp',
    artworkWeaponId: "Collector's Album",
    description: 'Grants ×(1 + 0.25 × unique Pattern Hands played this run) Mult.',
    flavorText: 'Seven empty pages. Fill every stamp.',
    accentColor: '#7C3AED',
  },
  {
    id: 'understudy',
    name: 'Understudy',
    role: 'utility',
    rarity: 'rare',
    cost: 9,
    icon: 'lorc/two-shadows',
    artworkWeaponId: 'Understudy',
    description: 'Copies the scoring ability of the Charm immediately to its LEFT.',
    flavorText: 'Knows every line by heart — just give them the cue.',
    accentColor: '#4F46E5',
  },
  {
    id: 'amplifier-coil',
    name: 'Amplifier Coil',
    role: 'utility',
    rarity: 'rare',
    cost: 9,
    icon: 'lorc/tesla-coil',
    artworkWeaponId: 'Amplifier Coil',
    description: 'Retriggers the Charm immediately to its RIGHT an extra time.',
    flavorText: 'Whatever goes in comes out twice as loud.',
    accentColor: '#EAB308',
  },
  {
    id: 'glass-sword',
    name: 'Glass Sword',
    role: 'xmult',
    rarity: 'rare',
    cost: 8,
    icon: 'lorc/shard-sword',
    artworkWeaponId: 'Glass Sword',
    description: '×2.5 Mult on every Set — shatters for the Blind if you play a Simple Triad (True Rainbow reforges).',
    flavorText: 'The sharpest edge in the shop, if your hands stay bold.',
    accentColor: '#06B6D4',
  },
  {
    id: 'greedy-chest',
    name: 'Greedy Chest',
    role: 'econ',
    rarity: 'uncommon',
    cost: 6,
    icon: 'delapouite/mimic-chest',
    artworkWeaponId: 'Greedy Chest',
    description: '+2 Chips for every $1 Gold you hold, and earns +$3 at the end of each Blind.',
    flavorText: 'Heavier every time you walk past the shop.',
    accentColor: '#D97706',
  },
  {
    id: 'mirror-shard',
    name: 'Mirror Shard',
    role: 'chips',
    rarity: 'common',
    cost: 5,
    icon: 'lorc/mirror-mirror',
    artworkWeaponId: 'Mirror Shard',
    description: '+65 Chips when your Set reuses at least 1 slot from your previous Set this Blind.',
    flavorText: 'Look where you just struck — something new stands there.',
    accentColor: '#0EA5E9',
  },
  {
    id: 'tightrope',
    name: 'Tightrope',
    role: 'xmult',
    rarity: 'uncommon',
    cost: 7,
    icon: 'delapouite/tightrope',
    artworkWeaponId: 'Tightrope',
    description: '×2.25 Mult on Adjacency Chain and Prismatic Crown Sets.',
    flavorText: 'Keep every card touching and never look down.',
    accentColor: '#EA580C',
  },
  {
    id: 'rally-horn',
    name: 'Rally Horn',
    role: 'mult',
    rarity: 'common',
    cost: 5,
    icon: 'lorc/hunting-horn',
    artworkWeaponId: 'Rally Horn',
    description: '+16 Mult on the first Hand and the final Hand of every Blind.',
    flavorText: 'Sound the charge — and sound the encore.',
    accentColor: '#B91C1C',
  },
  {
    id: 'fortunes-favor',
    name: "Fortune's Favor",
    role: 'econ',
    rarity: 'common',
    cost: 5,
    icon: 'lorc/crown-coin',
    artworkWeaponId: "Fortune's Favor",
    description: 'Earn +$2 Gold per Set (+$4 on True Rainbow or Prismatic Crown).',
    flavorText: 'Lady Luck tips generously for bold patterns.',
    accentColor: '#CA8A04',
  },
  {
    id: 'field-stone',
    name: 'Field Stone',
    role: 'utility',
    rarity: 'uncommon',
    cost: 6,
    icon: 'lorc/field',
    artworkWeaponId: 'Field Stone',
    description: '+3 Board Cards (max 15) and +25 Chips on every Set.',
    flavorText: 'More room on the table means wilder patterns.',
    accentColor: '#15803D',
  },
  {
    id: 'wild-card',
    name: 'Wild Weaver',
    role: 'utility',
    rarity: 'rare',
    cost: 8,
    icon: 'delapouite/card-joker',
    artworkWeaponId: 'Wild Card',
    description: 'First card dealt each Blind becomes temporary Wild, and every Wild card scored grants +12 Mult.',
    flavorText: 'It is whatever your combo needs it to be.',
    accentColor: '#16AA98',
  },

  // ── 16 BRAND-NEW SET-BALATRO ARCHETYPE CHARMS ─────────────────────────────
  {
    id: 'ruby-prism',
    name: 'Ruby Prism',
    role: 'mult',
    rarity: 'common',
    cost: 4,
    icon: 'delapouite/fire-gem',
    description: '+5 Mult for every Red card in your scored Set.',
    flavorText: 'Crimson light doubles back on itself.',
    accentColor: '#EF4444',
  },
  {
    id: 'emerald-lens',
    name: 'Emerald Lens',
    role: 'chips',
    rarity: 'common',
    cost: 4,
    icon: 'lorc/gems',
    description: '+35 Chips for every Green card in your scored Set.',
    flavorText: 'Verdant geometry, cut to razor precision.',
    accentColor: '#10B981',
  },
  {
    id: 'amethyst-crown',
    name: 'Amethyst Crown',
    role: 'xmult',
    rarity: 'uncommon',
    cost: 7,
    icon: 'lorc/crown',
    description: '×1.35 Mult for every Purple card in your scored Set.',
    flavorText: 'Three purples wear the crown together.',
    accentColor: '#9333EA',
  },
  {
    id: 'trinity-bell',
    name: 'Trinity Bell',
    role: 'chips',
    rarity: 'common',
    cost: 5,
    icon: 'delapouite/metronome',
    description: '+40 Chips for every 3-shape card in your scored Set.',
    flavorText: 'One chime for each symbol on the card.',
    accentColor: '#3B82F6',
  },
  {
    id: 'minimalist-monk',
    name: 'Minimalist Monk',
    role: 'mult',
    rarity: 'common',
    cost: 5,
    icon: 'lorc/meditation',
    description: '+6 Mult for every 1-shape card in your scored Set.',
    flavorText: 'Less ink. More impact.',
    accentColor: '#64748B',
  },
  {
    id: 'sculptors-chisel',
    name: "Sculptor's Chisel",
    role: 'chips',
    rarity: 'common',
    cost: 5,
    icon: 'lorc/anvil',
    description: '+25 Chips base, plus +25 Chips for every card below 27 in your deck.',
    flavorText: 'Chip away the excess until only combos remain.',
    accentColor: '#475569',
  },
  {
    id: 'alchemists-flask',
    name: "Alchemist's Flask",
    role: 'xmult',
    rarity: 'uncommon',
    cost: 7,
    icon: 'lorc/fizzing-flask',
    description: 'Starts at ×1.2 Mult; gains +0.2× Mult permanently every time you cast a Spell.',
    flavorText: 'Every drop bends the deck a little further.',
    accentColor: '#0D9488',
  },
  {
    id: 'glass-cannon',
    name: 'Shatter Lens',
    role: 'xmult',
    rarity: 'rare',
    cost: 8,
    icon: 'lorc/shattered-glass',
    description: 'Starts at ×1.25 Mult; gains +0.5× Mult permanently per Glass card shattered (+35C per Glass scored).',
    flavorText: 'Broken glass cuts deepest.',
    accentColor: '#0891B2',
  },
  {
    id: 'star-astronomer',
    name: 'Star Astronomer',
    role: 'chips',
    rarity: 'uncommon',
    cost: 6,
    icon: 'delapouite/galaxy',
    description: '+15 Chips and +1 Mult for every Star Chart level-up applied this run.',
    flavorText: 'Chart the constellations; collect the harvest.',
    accentColor: '#2563EB',
  },
  {
    id: 'golden-abacus',
    name: 'Golden Abacus',
    role: 'econ',
    rarity: 'uncommon',
    cost: 6,
    icon: 'delapouite/two-coins',
    description: 'Raises Blind Interest cap from $5 to $10, and earns +$1 every time you Discard.',
    flavorText: 'Compound interest is the strongest magic of all.',
    accentColor: '#EAB308',
  },
  {
    id: 'discard-furnace',
    name: 'Discard Furnace',
    role: 'mult',
    rarity: 'common',
    cost: 5,
    icon: 'lorc/fireball',
    description: '+12 Mult for every Discard you have used during the current Blind.',
    flavorText: 'Burn bad cards to stoke the blaze.',
    accentColor: '#F97316',
  },
  {
    id: 'last-stand',
    name: 'Final Act',
    role: 'xmult',
    rarity: 'uncommon',
    cost: 7,
    icon: 'delapouite/theater-curtains',
    description: '×2.5 Mult on the final Hand (1 Hand left) of any Blind.',
    flavorText: 'Save the showstopper for the curtain call.',
    accentColor: '#BE123C',
  },
  {
    id: 'edition-forge',
    name: 'Foil Press',
    role: 'mult',
    rarity: 'uncommon',
    cost: 6,
    icon: 'delapouite/stamper',
    description: '+25 Chips and +8 Mult for every Edition card in your scored Set.',
    flavorText: 'Freshly stamped shine makes every combo pop.',
    accentColor: '#EC4899',
  },
  {
    id: 'geometric-savant',
    name: 'Geometric Savant',
    role: 'xmult',
    rarity: 'rare',
    cost: 8,
    icon: 'delapouite/prism',
    description: '×2 Mult on Color Run, Shape Run, or Number Run; ×3 Mult on Prismatic Crown.',
    flavorText: 'Purity of line, rewarded exponentially.',
    accentColor: '#16AA98',
  },
  {
    id: 'pendulum',
    name: 'Pendulum',
    role: 'mult',
    rarity: 'common',
    cost: 5,
    icon: 'lorc/hourglass',
    description: 'Alternates each Hand: +80 Chips on odd Hands (1st, 3rd…), +20 Mult on even Hands (2nd, 4th…).',
    flavorText: 'Tick for Chips. Tock for Mult.',
    accentColor: '#6366F1',
  },
  {
    id: 'prism-sovereign',
    name: 'Prism Sovereign',
    role: 'xmult',
    rarity: 'rare',
    cost: 10,
    icon: 'lorc/star-swirl',
    description: 'Grants ×(1 + 0.25 × Edition cards in your full deck) Mult on every Set.',
    flavorText: 'Every gilded, glass, and foil card bends the knee.',
    accentColor: '#A855F7',
  },
];

export const CHARM_BY_ID: Record<string, CharmDef> = Object.fromEntries(
  CHARMS.map(c => [c.id, c])
);

// =============================================================================
// 6 TELEGRAPHED SYNERGY PAIRS
// =============================================================================

export const SYNERGY_PAIRS: readonly SynergyPairDef[] = [
  {
    id: 'spectrum_resonance',
    name: 'Spectrum Resonance',
    charmA: 'rainbow-charm',
    charmB: 'wild-card',
    icon: 'delapouite/sparkles',
    description: '×1.5 Mult on True Rainbow / Prismatic Crown, plus +40 Chips per Wild card scored.',
    accentColor: '#9333EA',
  },
  {
    id: 'alchemical_temper',
    name: 'Alchemical Temper',
    charmA: 'glass-cannon',
    charmB: 'alchemists-flask',
    icon: 'lorc/crystal-shine',
    description: '+50 Chips and ×1.5 Mult whenever any Edition card is scored.',
    accentColor: '#06B6D4',
  },
  {
    id: 'gilded_vault',
    name: 'Gilded Vault',
    charmA: 'greedy-chest',
    charmB: 'fortunes-favor',
    icon: 'willdabeast/gold-bar',
    description: '+$2 Gold per Set and +1 Mult for every $5 Gold you currently hold.',
    accentColor: '#D97706',
  },
  {
    id: 'standing_ovation',
    name: 'Standing Ovation',
    charmA: 'rally-horn',
    charmB: 'last-stand',
    icon: 'delapouite/hand-ok',
    description: '×1.75 Mult on the first Hand and the final Hand of every Blind.',
    accentColor: '#BE123C',
  },
  {
    id: 'spatial_web',
    name: 'Spatial Web',
    charmA: 'tightrope',
    charmB: 'mirror-shard',
    icon: 'lorc/linked-rings',
    description: '+75 Chips and +15 Mult whenever your Set is adjacent OR reuses a previous Set slot.',
    accentColor: '#EA580C',
  },
  {
    id: 'masterwork_deck',
    name: 'Masterwork Deck',
    charmA: 'sculptors-chisel',
    charmB: 'edition-forge',
    icon: 'lorc/gear-hammer',
    description: '×1.6 Mult whenever your Set has an Edition card OR your deck has fewer than 27 cards.',
    accentColor: '#EC4899',
  },
];

export const SYNERGY_PAIR_BY_ID: Record<string, SynergyPairDef> = Object.fromEntries(
  SYNERGY_PAIRS.map(s => [s.id, s])
);

/** Active Synergy Pairs given currently owned Charms (respecting Eclipse Boss debuff on slot 0). */
export const getActiveSynergies = (run: PrismRun): SynergyPairDef[] => {
  const eclipsed = run.phase === 'playing' && run.activeBossId === 'the_eclipse';
  const activeIds = new Set(
    run.charms
      .filter((_, idx) => !(eclipsed && idx === 0))
      .map(c => c.charmId)
  );
  return SYNERGY_PAIRS.filter(pair => activeIds.has(pair.charmA) && activeIds.has(pair.charmB));
};

/** Synergy partners for a given Charm ID (for shop tooltips / telegraphing). */
export const getSynergiesForCharm = (charmId: string): SynergyPairDef[] =>
  SYNERGY_PAIRS.filter(pair => pair.charmA === charmId || pair.charmB === charmId);

/** Compute a Charm's sell value (half purchase cost, min $1). */
export const getCharmSellValue = (charmId: string): number => {
  const def = CHARM_BY_ID[charmId];
  return def ? Math.max(1, Math.floor(def.cost / 2)) : 1;
};

/** Count total Star Chart level-ups applied across all Pattern Hands. */
export const getTotalHandLevelUps = (run: PrismRun): number =>
  Object.values(run.handLevels).reduce((sum, lv) => sum + Math.max(0, lv - 1), 0);

/** Count permanent/special Edition cards in the player's master deck. */
export const getDeckEditionCount = (run: PrismRun): number =>
  run.deck.filter(c => hasCardEdition(c)).length;

/** Crisp dynamic status badge for any owned Charm (shown live on the Charm bar!). */
export const getCharmStatusLabel = (charm: OwnedCharm, run: PrismRun): string => {
  const slotIdx = run.charms.findIndex(c => c.instanceId === charm.instanceId);
  if (run.phase === 'playing' && run.activeBossId === 'the_eclipse' && slotIdx === 0) {
    return 'Eclipsed!';
  }

  switch (charm.charmId) {
    case 'rainbow-charm':
      return 'Rainbow → ×2';
    case 'magnet': {
      if (!charm.state.magnetCardId) return 'Awaiting Blind';
      const markedSelected = run.selectedIndices.some(
        idx => run.board[idx]?.id === charm.state.magnetCardId
      );
      return markedSelected ? 'Armed! (+14M)' : 'Mark on board';
    }
    case 'bounty-poster': {
      const val = charm.state.bountyValue;
      const trait = charm.state.bountyTrait;
      const prog = charm.state.bountyProgress ?? 0;
      if (!val || !trait) return 'WANTED ready';
      const pretty =
        trait === 'color'
          ? COLOR_LABELS[val as keyof typeof COLOR_LABELS] ?? val
          : trait === 'shape'
            ? SHAPE_LABELS[val as keyof typeof SHAPE_LABELS] ?? val
            : `${val}s`;
      return `${pretty} (${prog}/3)`;
    }
    case 'odd-one-out':
      return 'Run → +18M';
    case 'snowball':
      return `Currently +${charm.state.counter} Mult`;
    case 'collectors-album': {
      const count = charm.state.stampedHands?.length ?? 0;
      const mult = Math.round((1 + count * 0.25) * 100) / 100;
      return `${count}/7 (×${mult})`;
    }
    case 'understudy': {
      if (slotIdx <= 0) return 'Needs left Charm';
      if (run.phase === 'playing' && run.activeBossId === 'the_eclipse' && slotIdx === 1) {
        return 'Left Charm Eclipsed';
      }
      const left = run.charms[slotIdx - 1];
      if (!left || left.charmId === 'understudy' || left.charmId === 'amplifier-coil') {
        return 'Cannot copy';
      }
      return `Copies ${CHARM_BY_ID[left.charmId]?.name ?? left.charmId}`;
    }
    case 'amplifier-coil': {
      if (slotIdx < 0 || slotIdx >= run.charms.length - 1) return 'Needs right Charm';
      const right = run.charms[slotIdx + 1];
      if (!right || right.charmId === 'understudy' || right.charmId === 'amplifier-coil') {
        return 'Cannot amplify';
      }
      return `2× ${CHARM_BY_ID[right.charmId]?.name ?? right.charmId}`;
    }
    case 'glass-sword':
      return charm.state.shattered ? 'Shattered' : 'Armed! (×2.5)';
    case 'greedy-chest':
      return `Currently +${run.gold * 2} Chips`;
    case 'mirror-shard':
      return run.lastSetIndices.length > 0 ? 'Reuse slot → +65C' : 'After 1st Set';
    case 'tightrope':
      return 'Adjacent → ×2.25';
    case 'rally-horn': {
      if (run.phase !== 'playing') return '1st & Last Hand';
      const armed = run.handsPlayedThisBlind === 0 || run.handsLeft === 1;
      return armed ? 'Armed! (+16M)' : 'Wait for Last Hand';
    }
    case 'fortunes-favor':
      return '+$2 / Set';
    case 'field-stone':
      return '+3 Cards, +25C';
    case 'wild-card':
      return 'Wild → +12M';
    case 'ruby-prism':
      return '+5M / Red';
    case 'emerald-lens':
      return '+35C / Green';
    case 'amethyst-crown':
      return '×1.35 / Purple';
    case 'trinity-bell':
      return '+40C / 3-card';
    case 'minimalist-monk':
      return '+6M / 1-card';
    case 'sculptors-chisel': {
      const below = Math.max(0, 27 - run.deck.length);
      return `Currently +${25 + below * 25} Chips`;
    }
    case 'alchemists-flask': {
      const x = Math.round((1.2 + run.stats.spellsUsed * 0.2) * 100) / 100;
      return `Currently ×${x}`;
    }
    case 'glass-cannon': {
      const x = Math.round((1.25 + run.stats.shatteredCards * 0.5) * 100) / 100;
      return `Currently ×${x}`;
    }
    case 'star-astronomer': {
      const ups = getTotalHandLevelUps(run);
      return `+${ups * 15}C +${ups}M`;
    }
    case 'golden-abacus':
      return 'Interest cap $10';
    case 'discard-furnace':
      return `Currently +${run.discardsUsedThisBlind * 12} Mult`;
    case 'last-stand':
      return run.phase === 'playing' && run.handsLeft === 1 ? 'Armed! (×2.5)' : 'Last Hand → ×2.5';
    case 'edition-forge':
      return '+25C +8M / Ed.';
    case 'geometric-savant':
      return 'Run ×2 / Crown ×3';
    case 'pendulum': {
      const nextIsOdd = run.handsPlayedThisBlind % 2 === 0;
      return nextIsOdd ? 'Next: +80 Chips' : 'Next: +20 Mult';
    }
    case 'prism-sovereign': {
      const count = getDeckEditionCount(run);
      const x = Math.round((1 + count * 0.25) * 100) / 100;
      return `${count} Ed. (×${x})`;
    }
    default:
      return '';
  }
};
