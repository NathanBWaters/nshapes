import type { AttributeName, Card } from '@/types';
import { ECONOMY } from '@/utils/gameConfig';
import { getRunRoundRequirement } from './rounds';
import type { GameState, Player } from './types';

interface InitialGameStateOptions {
  player: Player;
  activeAttributes: AttributeName[];
  board?: Card[];
  deck?: Card[];
  /** Run round to start at (default 1). */
  round?: number;
  /** Start the clock immediately instead of waiting for an enemy to be picked. */
  started?: boolean;
  /** Seconds added on top of the round's base time. */
  timeBonus?: number;
  /** Anything else that differs from a fresh run (shop stock, enemy options, carried-over progress). */
  overrides?: Partial<
    Pick<
      GameState,
      'shopWeapons' | 'rerollCost' | 'currentEnemies' | 'defeatedEnemies' | 'awardedStretchGoalWeapons'
    >
  >;
}

/** The state of a run at the start of a round, before anything has been matched. */
export const createInitialGameState = ({
  player,
  activeAttributes,
  board = [],
  deck = [],
  round = 1,
  started = false,
  timeBonus = 0,
  overrides,
}: InitialGameStateOptions): GameState => {
  const requirement = getRunRoundRequirement(round);
  return {
    deck,
    board,
    foundCombinations: [],
    score: 0,
    gameStarted: started,
    gameEnded: false,
    startTime: started ? Date.now() : null,
    endTime: null,
    activeAttributes,
    round,
    targetScore: requirement.targetScore,
    remainingTime: requirement.time + timeBonus,
    roundCompleted: false,
    player,
    shopWeapons: [],
    levelUpOptions: [],
    rerollCost: ECONOMY.baseRerollCost,
    currentEnemies: [],
    activeEnemyInstance: null,
    selectedEnemyReward: null,
    selectedEnemyMoney: null,
    defeatedEnemies: [],
    awardedStretchGoalWeapons: [],
    isEndlessMode: false,
    connections: [],
    ...overrides,
  };
};
