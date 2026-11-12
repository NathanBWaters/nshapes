/**
 * Per-round statistics used for enemy defeat conditions and the round summary.
 * Pure: shared by the React hook (hooks/useRoundStats) and headless engines.
 */
import type { Color, Shape } from '@/types';
import type { RoundStats, WeaponImpact } from '@/types/enemy';

export function createInitialRoundStats(
  targetScore: number = 0,
  hintsRemaining: number = 0,
  gracesRemaining: number = 0
): RoundStats {
  return {
    // Match tracking
    totalMatches: 0,
    currentStreak: 0,
    maxStreak: 0,
    invalidMatches: 0,

    // Timing
    matchTimes: [],
    timeRemaining: 60,

    // Card tracking
    cardsRemaining: 12,
    tripleCardsCleared: 0,
    faceDownCardsMatched: 0,
    bombsDefused: 0,
    countdownCardsMatched: 0,

    // Attribute tracking
    shapesMatched: new Set<Shape>(),
    colorsMatched: new Set<Color>(),
    colorMatchCounts: new Map<Color, number>(),
    allDifferentMatches: 0,
    allSameColorMatches: 0,
    squiggleMatches: 0,

    // Resource tracking
    gracesUsed: 0,
    hintsUsed: 0,
    hintsRemaining,
    gracesRemaining,
    damageReceived: 0,
    weaponEffectsTriggered: new Set<string>(),

    // Score
    currentScore: 0,
    targetScore,

    // Time gain trigger tracking
    timeGainTriggersThisRound: 0,
    timeGainTriggerCapBonus: 0,
    consecutiveInvalidMatches: 0,

    // Challenge legendary trigger flags
    prismaticPerfectionTriggered: false,
    tabulaRasaTriggered: false,

    // Weapon impact tracking
    weaponImpacts: new Map(),
  };
}

export type WeaponImpactDelta = Partial<Omit<WeaponImpact, 'weaponId' | 'weaponName' | 'weaponIcon'>>;

const IMPACT_FIELDS = [
  'pointsEarned',
  'cardsDestroyed',
  'moneyEarned',
  'heartsEarned',
  'xpEarned',
  'timeGained',
  'gracesEarned',
  'hintsEarned',
] as const satisfies readonly (keyof WeaponImpactDelta)[];

/** Add a weapon's contribution to the round's impact table (mutates `stats`). */
export function addWeaponImpact(
  stats: RoundStats,
  weaponId: string,
  weaponName: string,
  weaponIcon: string,
  delta: WeaponImpactDelta
): void {
  if (!stats.weaponImpacts) {
    stats.weaponImpacts = new Map();
  }
  let entry = stats.weaponImpacts.get(weaponId);
  if (!entry) {
    entry = {
      weaponId,
      weaponName,
      weaponIcon,
      pointsEarned: 0,
      cardsDestroyed: 0,
      moneyEarned: 0,
      heartsEarned: 0,
      xpEarned: 0,
      timeGained: 0,
      gracesEarned: 0,
      hintsEarned: 0,
    };
    stats.weaponImpacts.set(weaponId, entry);
  }
  for (const field of IMPACT_FIELDS) {
    entry[field] += delta[field] || 0;
  }
}

// XP is deliberately not part of the ranking.
const impactValue = (i: WeaponImpact): number =>
  i.pointsEarned +
  i.cardsDestroyed * 2 +
  i.moneyEarned +
  i.heartsEarned * 10 +
  i.timeGained +
  i.gracesEarned * 5 +
  i.hintsEarned * 3;

/** Weapon impacts for the round, most valuable first. */
export function getSortedWeaponImpacts(stats: RoundStats): WeaponImpact[] {
  if (!stats.weaponImpacts) {
    return [];
  }
  return Array.from(stats.weaponImpacts.values()).sort((a, b) => impactValue(b) - impactValue(a));
}
