import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { PlayerStats, Weapon } from '@/types';
import CircularTimer from './CircularTimer';
import GameMenu, { DevModeCallbacks } from './GameMenu';
import { COLORS, RADIUS } from '@/utils/colors';

interface GameInfoProps {
  round: number;
  score: number;
  targetScore: number;
  time: number;
  totalTime: number;
  playerStats: PlayerStats;
  playerWeapons?: Weapon[];
  selectedCount: number;
  onHintPress?: () => void;
  onClearHint?: () => void;
  hasActiveHint?: boolean;
  onExitGame?: () => void;
  devMode?: boolean;
  devCallbacks?: DevModeCallbacks;
}

// Calculate XP thresholds for level progression
const getXPForLevel = (level: number): number => {
  return level * level * 10; // Level 1 = 10, Level 2 = 40, Level 3 = 90, etc.
};

const GameInfo: React.FC<GameInfoProps> = ({
  round,
  score,
  targetScore,
  time,
  totalTime,
  playerStats,
  playerWeapons = [],
  selectedCount,
  onHintPress,
  onClearHint,
  hasActiveHint = false,
  onExitGame,
  devMode = false,
  devCallbacks,
}) => {
  // Calculate score progress percentage
  const scoreProgress = Math.min((score / targetScore) * 100, 100);

  // Calculate XP progress to next level
  const currentLevelXP = getXPForLevel(playerStats.level);
  const nextLevelXP = getXPForLevel(playerStats.level + 1);
  const xpInCurrentLevel = playerStats.experience - currentLevelXP;
  const xpNeededForNextLevel = nextLevelXP - currentLevelXP;
  const xpProgress = Math.min((xpInCurrentLevel / xpNeededForNextLevel) * 100, 100);

  const hintsAvailable = playerStats.hints ?? 0;

  return (
    <View style={styles.container}>
        {/* Top row: All stats */}
        <View style={styles.statsRow}>
          {/* Left section - gameplay stats */}
          <View style={styles.leftSection}>
            {/* Round */}
            <View style={styles.statBadge}>
              <Text style={styles.statLabel}>R{round}</Text>
            </View>

            {/* Health */}
            <View style={styles.statItem}>
              <Text style={styles.heartIcon}>♥</Text>
              <Text style={[styles.statValue, playerStats.health <= 1 && styles.criticalValue]}>
                {playerStats.health}/{playerStats.maxHealth}
              </Text>
            </View>

            {/* Money */}
            <View style={styles.statItem}>
              <Text style={styles.coinIcon}>$</Text>
              <Text style={styles.statValue}>{playerStats.money}</Text>
            </View>

            {/* Level + XP Progress */}
            <View style={styles.levelContainer}>
              <Text style={styles.levelText}>Lv{playerStats.level}</Text>
              <View style={styles.xpBarContainer}>
                <View style={[styles.xpBarFill, { width: `${xpProgress}%` }]} />
              </View>
            </View>

            {/* Mulligans */}
            {(playerStats.mulligans ?? 0) > 0 && (
              <View style={styles.mulliganBadge}>
                <Text style={styles.mulliganIcon}>↺</Text>
                <Text style={styles.mulliganCount}>{playerStats.mulligans}</Text>
              </View>
            )}

            {/* Hints */}
            <TouchableOpacity
              style={[
                styles.hintButton,
                hintsAvailable > 0 ? styles.hintButtonEnabled : styles.hintButtonDisabled,
                hasActiveHint && styles.hintButtonActive,
              ]}
              onPress={hasActiveHint ? onClearHint : onHintPress}
              disabled={hintsAvailable <= 0 && !hasActiveHint}
            >
              <Text style={styles.hintIcon}>?</Text>
              <Text style={[
                styles.hintCount,
                hintsAvailable > 0 ? styles.hintCountEnabled : styles.hintCountDisabled
              ]}>
                {hasActiveHint ? 'x' : hintsAvailable}
              </Text>
            </TouchableOpacity>

            {/* Selected count */}
            <View style={[styles.selectedBadge, selectedCount === 3 && styles.selectedBadgeFull]}>
              <Text style={styles.selectedText}>{selectedCount}/3</Text>
            </View>

            {/* Timer */}
            <CircularTimer
              currentTime={time}
              totalTime={totalTime}
              size={40}
              strokeWidth={3}
            />

            {/* Menu Button */}
            <GameMenu
              playerStats={playerStats}
              playerWeapons={playerWeapons}
              onExitGame={onExitGame}
              devMode={devMode}
              devCallbacks={devCallbacks}
            />
          </View>

        </View>

        {/* Bottom row: Score progress bar */}
        <View style={styles.scoreRow}>
          <View style={styles.scoreBarContainer}>
            <View
              style={[
                styles.scoreBarFill,
                { width: `${scoreProgress}%` },
                scoreProgress >= 100 && styles.scoreBarComplete,
              ]}
            />
          </View>
          <Text style={styles.scoreText}>{score}/{targetScore}</Text>
        </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 4,
    backgroundColor: COLORS.canvasWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
    paddingHorizontal: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statBadge: {
    backgroundColor: COLORS.deepOnyx,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  statLabel: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.paperBeige,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  heartIcon: {
    color: COLORS.impactRed,
    fontSize: 12,
  },
  coinIcon: {
    color: COLORS.actionYellow,
    fontSize: 12,
    fontWeight: '700',
  },
  statValue: {
    color: COLORS.slateCharcoal,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  criticalValue: {
    color: COLORS.impactRed,
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.paperBeige,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  levelText: {
    color: COLORS.logicTeal,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  xpBarContainer: {
    width: 32,
    height: 6,
    backgroundColor: COLORS.paperBeige,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: COLORS.logicTeal,
    borderRadius: 3,
  },
  mulliganBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.logicTeal,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  mulliganIcon: {
    color: COLORS.canvasWhite,
    fontSize: 12,
    fontWeight: '700',
  },
  mulliganCount: {
    color: COLORS.canvasWhite,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  hintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  hintButtonEnabled: {
    backgroundColor: COLORS.actionYellow,
  },
  hintButtonDisabled: {
    backgroundColor: COLORS.paperBeige,
  },
  hintButtonActive: {
    backgroundColor: COLORS.impactOrange,
  },
  hintIcon: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
  },
  hintCount: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  hintCountEnabled: {
    color: COLORS.slateCharcoal,
  },
  hintCountDisabled: {
    color: COLORS.slateCharcoal,
    opacity: 0.5,
  },
  selectedBadge: {
    backgroundColor: COLORS.slateCharcoal,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.deepOnyx,
  },
  selectedBadgeFull: {
    backgroundColor: COLORS.logicTeal,
  },
  selectedText: {
    color: COLORS.canvasWhite,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  scoreBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  scoreBarFill: {
    height: '100%',
    backgroundColor: COLORS.logicTeal,
    borderRadius: RADIUS.button,
  },
  scoreBarComplete: {
    backgroundColor: COLORS.actionYellow,
  },
  scoreText: {
    color: COLORS.slateCharcoal,
    fontSize: 11,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
    fontFamily: 'monospace',
  },
});

export default GameInfo;
