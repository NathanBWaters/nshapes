/**
 * Weapons whose effect is a rule of the run rather than a stat bonus.
 *
 * The controller asks these questions instead of comparing weapon ids/names
 * itself; each rule is keyed off the weapon definition in WEAPONS.
 */
import type { PlayerStats, Weapon } from '@/types';

const ownsId = (weapons: Weapon[], id: string): boolean => weapons.some(w => w.id === id);

// --- Snowball: never start a round without a grace ---------------------------

/** Graces the player is topped up to at round start (0 = no guarantee). */
export const guaranteedRoundStartGraces = (weapons: Weapon[]): number =>
  weapons.some(w => w.name === 'Snowball') ? 1 : 0;

// --- Time-gain trigger cap ---------------------------------------------------
// Time Drop style weapons may only trigger a limited number of times per round.
// Three "challenge legendaries" raise that limit for the current round when
// their condition is met, and Time Trigger Mastery raises it permanently.

const TIME_TRIGGER_MASTERY_ID = 'time-trigger-mastery';
const TIME_TRIGGER_MASTERY_CAP_BONUS = 2;
const DEFAULT_TIME_GAIN_TRIGGER_CAP = 5;

/** How many time gains may trigger this round. `roundBonus` is what the challenge legendaries added so far. */
export const getTimeGainTriggerCap = (totalStats: PlayerStats, weapons: Weapon[], roundBonus: number): number => {
  const baseCap = totalStats.timeGainTriggerCap || DEFAULT_TIME_GAIN_TRIGGER_CAP;
  const masteryCount = weapons.filter(w => w.id === TIME_TRIGGER_MASTERY_ID).length;
  return baseCap + masteryCount * TIME_TRIGGER_MASTERY_CAP_BONUS + roundBonus;
};

export interface TimeTriggerChallenge {
  /** Extra time-gain triggers granted for the rest of the round. */
  capBonus: number;
  message: string;
}

/** Prismatic Perfection: an all-different match, once per round. */
export const prismaticPerfectionChallenge = (
  weapons: Weapon[],
  match: { isAllDifferent: boolean; alreadyTriggered: boolean }
): TimeTriggerChallenge | null =>
  ownsId(weapons, 'prismatic-perfection') && !match.alreadyTriggered && match.isAllDifferent
    ? { capBonus: 5, message: 'Prismatic Perfection! +5 time triggers' }
    : null;

/** Tabula Rasa is only worth checking (it needs a board scan) while it can still trigger. */
export const canTriggerTabulaRasa = (weapons: Weapon[], alreadyTriggered: boolean): boolean =>
  ownsId(weapons, 'tabula-rasa') && !alreadyTriggered;

/** Tabula Rasa: the match leaves the board empty, once per round. */
export const tabulaRasaChallenge = (cardsLeftOnBoard: number): TimeTriggerChallenge | null =>
  cardsLeftOnBoard === 0 ? { capBonus: 5, message: 'Tabula Rasa! +5 time triggers' } : null;

/** Desperate Measures: every 3 invalid matches in a row (the caller resets the streak when it triggers). */
export const desperateMeasuresChallenge = (
  weapons: Weapon[],
  consecutiveInvalidMatches: number
): TimeTriggerChallenge | null =>
  ownsId(weapons, 'desperate-measures') && consecutiveInvalidMatches >= 3
    ? { capBonus: 10, message: 'Desperate Measures! +10 time triggers' }
    : null;

// --- Revenge Linker: taking damage creates connections -----------------------

export const linksOnDamage = (weapons: Weapon[]): boolean =>
  weapons.some(w => w.specialEffect === 'revengeLinker');
