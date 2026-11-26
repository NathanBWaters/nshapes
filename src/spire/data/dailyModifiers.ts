/**
 * Starfall Summit — Daily Climb Mutator Modifiers (`[TP-19]`).
 *
 * Bridges the canonical rotating Daily Mutator catalog in
 * `src/adventure/dailySeed.ts` to concrete, pure Summit run modifiers.
 */
import {
  getDailySummitConfig,
  getSummitDailyMutator,
  SUMMIT_DAILY_MUTATORS,
  type DailySummitConfig,
  type SummitDailyMutator,
  type SummitDailyMutatorId,
} from '@/adventure/dailySeed';
import type { SummitThemePackId } from './themePacks';

export {
  getDailySummitConfig,
  getSummitDailyMutator,
  SUMMIT_DAILY_MUTATORS,
  type DailySummitConfig,
  type SummitDailyMutator,
  type SummitDailyMutatorId,
};

export interface DailyMutatorModifiers {
  extraElites: number;
  eliteCoinScale: number;
  shopPriceScale: number;
  parrySpeedScale: number;
  parryBonusCoins: number;
  extraEvolutionLikelihood: number;
  extraEvolutionCap: number;
  startingCoinsDelta: number;
  startingGracesDelta: number;
  startingHintsDelta: number;
  maxHeartsDelta: number;
  heavyHitterBonus: number;
  forcedThemePack?: SummitThemePackId;
}

const DEFAULT_MODS: DailyMutatorModifiers = {
  extraElites: 0,
  eliteCoinScale: 1,
  shopPriceScale: 1,
  parrySpeedScale: 1,
  parryBonusCoins: 0,
  extraEvolutionLikelihood: 0,
  extraEvolutionCap: 0,
  startingCoinsDelta: 0,
  startingGracesDelta: 0,
  startingHintsDelta: 0,
  maxHeartsDelta: 0,
  heavyHitterBonus: 0,
};

export const dailyMutatorModifiers = (id?: SummitDailyMutatorId | null): DailyMutatorModifiers => {
  switch (id) {
    case 'catalyst_surge':
      return {
        ...DEFAULT_MODS,
        extraEvolutionLikelihood: 12,
        extraEvolutionCap: 1,
      };
    case 'double_elites':
      return {
        ...DEFAULT_MODS,
        extraElites: 1,
        eliteCoinScale: 1.35,
      };
    case 'gamble_mastery':
      return {
        ...DEFAULT_MODS,
        startingCoinsDelta: 45,
        startingGracesDelta: 1,
        forcedThemePack: 'board_gambles',
      };
    case 'hyper_parries':
      return {
        ...DEFAULT_MODS,
        parrySpeedScale: 0.88,
        parryBonusCoins: 8,
      };
    case 'golden_bazaar':
      return {
        ...DEFAULT_MODS,
        startingCoinsDelta: 60,
        shopPriceScale: 0.85,
      };
    case 'glass_sprint':
      return {
        ...DEFAULT_MODS,
        maxHeartsDelta: -1,
        heavyHitterBonus: 2,
        startingHintsDelta: 1,
      };
    default:
      return DEFAULT_MODS;
  }
};
