/**
 * State of the legacy round-based run (the controller in components/Game.tsx).
 * It lives here, not in src/types.ts, because only this state needs enemy
 * instances, and src/types.ts must not import src/types/enemy.ts (which imports it).
 */
import type { AttributeName, BoardConnection, Card, Player, Weapon } from '@/types';
import type { EnemyInstance, EnemyOption } from '@/types/enemy';

export type { Player };

export interface GameState {
  // Core game
  deck: Card[];
  board: Card[];
  foundCombinations: Card[][];
  score: number;
  gameStarted: boolean;
  gameEnded: boolean;
  startTime: number | null;
  endTime: number | null;

  activeAttributes: AttributeName[];

  // Round
  round: number;
  targetScore: number;
  remainingTime: number;
  roundCompleted: boolean;

  player: Player;

  // Shop and upgrades
  shopWeapons: (Weapon | null)[]; // null = sold slot
  levelUpOptions: Weapon[];
  rerollCost: number;

  // Enemy
  currentEnemies: EnemyOption[]; // Enemies with pre-determined rewards to choose from
  activeEnemyInstance: EnemyInstance | null;
  selectedEnemyReward: Weapon | null; // Pre-determined stretch goal reward for selected enemy
  selectedEnemyMoney: number | null; // Pre-determined stretch goal bonus money for selected enemy
  defeatedEnemies: string[]; // Names of enemies whose stretch goals have been completed
  awardedStretchGoalWeapons: string[]; // IDs of stretch goal weapons that have been awarded

  isEndlessMode: boolean;

  // Connections between board positions (connector weapons)
  connections: BoardConnection[];
}
