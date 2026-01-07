import React from 'react';
import { Alert } from 'react-native';
import VictoryScreen from '@/components/VictoryScreen';
import { RoundScore } from '@/components/RoundProgressChart';
import { Player, PlayerStats } from '@/types';
import { ROUND_REQUIREMENTS, WEAPONS } from '@/utils/gameDefinitions';

/**
 * Dev Victory Page
 *
 * Standalone test page for the VictoryScreen component.
 */

// Pick some actual weapons from game definitions for the mock run
const mockWeapons = [
  WEAPONS.find(w => w.id === 'blast-powder-legendary')!,
  WEAPONS.find(w => w.id === 'oracle-eye-rare')!,
  WEAPONS.find(w => w.id === 'life-vessel-common')!,
  WEAPONS.find(w => w.id === 'life-vessel-common')!, // Duplicate
  WEAPONS.find(w => w.id === 'second-chance-rare')!,
  WEAPONS.find(w => w.id === 'prism-glass-common')!,
].filter(Boolean);

// Mock player stats after victory
const mockPlayerStats: PlayerStats = {
  level: 7,
  money: 127,
  experience: 850,
  experienceGainPercent: 100,
  luck: 0,
  maxWeapons: 99,
  commerce: 0,
  scavengingPercent: 0,
  scavengeAmount: 1,
  health: 4,
  maxHealth: 7,
  fieldSize: 12,
  freeRerolls: 1,
  drawIncrease: 0,
  drawIncreasePercent: 0,
  chanceOfFire: 0,
  explosion: 0,
  damage: 1,
  damagePercent: 0,
  holographicPercent: 0,
  maxTimeIncrease: 0,
  timeWarpPercent: 0,
  matchHints: 0,
  matchPossibilityHints: 0,
  matchIntervalHintPercent: 0,
  matchIntervalSpeed: 15,
  dodgePercent: 0,
  dodgeAttackBackPercent: 0,
  dodgeAttackBackAmount: 1,
  graces: 3,
  maxGraces: 5,
  bombTimer: 20,
  additionalPoints: 0,
  deflectPercent: 0,
  criticalChance: 0,
  timeFreezePercent: 0,
  timeFreezeAmount: 15,
  hints: 2,
  maxHints: 3,
  hintPasses: 0,
  explosionChance: 70,
  autoHintChance: 100,
  autoHintInterval: 12000,
  boardGrowthChance: 0,
  boardGrowthAmount: 1,
  fireSpreadChance: 0,
  graceGainChance: 0,
  healingChance: 0,
  hintGainChance: 0,
  xpGainChance: 0,
  coinGainChance: 0,
  timeGainChance: 0,
  timeGainAmount: 3,
  laserChance: 0,
  startingTime: 0,
  ricochetChance: 0,
  ricochetChainChance: 0,
  enhancedHintChance: 0,
  echoChance: 0,
  chainReactionChance: 0,
};

// Mock player
const mockPlayer: Player = {
  id: 'dev-player',
  username: 'DevPlayer',
  character: {
    name: 'Orange Tabby',
    description: 'Nine lives? More like eleven with all those extra hearts',
    startingWeapons: ['Life Vessel', 'Mending Charm'],
    icon: 'lorc/cat',
    baseStats: {}
  },
  stats: mockPlayerStats,
  weapons: mockWeapons,
  items: [],
};

// Mock round scores using ROUND_REQUIREMENTS for targets
// Simulates a varied run with some close calls and some dominant rounds
const mockActualScores = [5, 6, 8, 10, 10, 18, 42, 31, 38, 127];
const mockRoundScores: RoundScore[] = ROUND_REQUIREMENTS.map((req, index) => ({
  round: req.round,
  target: req.targetScore,
  actual: mockActualScores[index],
}));

export default function DevVictory() {
  const handleReturnToMenu = () => {
    Alert.alert('Return to Menu', 'Would navigate back to main menu');
  };

  const handleContinueEndless = () => {
    Alert.alert('Continue to Endless', 'Would continue to round 11+');
  };

  // Calculate total score from all rounds
  const totalScore = mockActualScores.reduce((sum, score) => sum + score, 0);

  return (
    <VictoryScreen
      player={mockPlayer}
      finalScore={totalScore}
      matchCount={42}
      playerStats={mockPlayerStats}
      roundScores={mockRoundScores}
      onReturnToMenu={handleReturnToMenu}
      onContinueEndless={handleContinueEndless}
    />
  );
}
