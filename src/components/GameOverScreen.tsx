import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Character } from '@/types';
import type { EnemyInstance } from '@/types/enemy';
import { COLORS, RADIUS } from '@/utils/colors';
import RoundProgressChart, { RoundScore } from './RoundProgressChart';
import { EnemyAvatar } from './enemies';
import { FighterAvatar } from './fighters';

interface GameOverScreenProps {
  character: Character;
  health: number;
  maxHealth: number;
  /** Why the run ended; without one the screen says whether the target was reached. */
  reason: string | null;
  enemy: EnemyInstance | null;
  round: number;
  score: number;
  targetScore: number;
  roundScores: RoundScore[];
  onPlayAgain: () => void;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({
  character,
  health,
  maxHealth,
  reason,
  enemy,
  round,
  score,
  targetScore,
  roundScores,
  onPlayAgain,
}) => (
    <View style={styles.container}>
      {/* Eyebrow Banner */}
      <View style={styles.eyebrow}>
        <Text style={styles.eyebrowText}>GAME OVER</Text>
      </View>

      <View style={styles.content}>
        {/* Defeated / Knocked-Out Fighter Stage */}
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <FighterAvatar
            character={character}
            size={74}
            health={health}
            maxHealth={maxHealth}
            mood="defeat"
            framed
            interactive
            testID="gameover-fighter-avatar"
          />
        </View>

        {/* Game over reason */}
        {reason && (
          <View style={styles.reasonContainer}>
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        )}

        {/* Enemy that defeated the player */}
        {enemy && (
          <View style={styles.enemyContainer}>
            <EnemyAvatar
              enemy={enemy}
              size={42}
              mood="victory"
              reaction={{ type: 'taunt', id: 1 }}
              interactive
              testID="gameover-enemy-avatar"
            />
            <View style={styles.enemyInfo}>
              <Text style={styles.enemyLabel}>DEFEATED BY</Text>
              <Text style={styles.enemyName}>{enemy.name}</Text>
            </View>
          </View>
        )}

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>ROUND REACHED</Text>
            <Text style={styles.statValue}>{round}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>FINAL SCORE</Text>
            <Text style={styles.statValue}>{score}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>TARGET SCORE</Text>
            <Text style={styles.statValue}>{targetScore}</Text>
          </View>

          {!reason && score >= targetScore ? (
            <View style={[styles.resultBadge, styles.successBadge]}>
              <Text style={[styles.resultText, styles.successText]}>
                TARGET ACHIEVED!
              </Text>
            </View>
          ) : !reason ? (
            <View style={[styles.resultBadge, styles.failBadge]}>
              <Text style={[styles.resultText, styles.failText]}>
                TARGET NOT REACHED
              </Text>
            </View>
          ) : null}
        </View>

        {/* Round Progress Chart */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>ROUND PROGRESS</Text>
          <RoundProgressChart
            roundScores={roundScores}
            currentRound={round}
            height={140}
          />
        </View>

        {/* Play Again Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.playAgainButton}
            onPress={onPlayAgain}
          >
            <Text style={styles.playAgainText}>PLAY AGAIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  eyebrow: {
    height: 48,
    backgroundColor: '#CC4444', // Muted red - less harsh, more encouraging
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.slateCharcoal,
  },
  eyebrowText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 3,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  reasonContainer: {
    backgroundColor: '#FEF2F2', // Soft pink-white instead of deep onyx
    borderRadius: RADIUS.module,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#CC4444', // Muted red
  },
  reasonText: {
    color: '#383838', // Slate charcoal instead of bright red
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  enemyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2', // Light red/pink
    borderRadius: RADIUS.module,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.impactRed,
    gap: 12,
  },
  enemyInfo: {
    flex: 1,
  },
  enemyLabel: {
    color: COLORS.impactRed,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  enemyName: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 16,
  },
  statsContainer: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    padding: 16,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.paperBeige,
  },
  statLabel: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  statValue: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 18,
    fontFamily: 'monospace',
  },
  resultBadge: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  successBadge: {
    backgroundColor: COLORS.logicTeal,
  },
  failBadge: {
    backgroundColor: '#CC4444', // Muted red - encouraging, not punishing
  },
  resultText: {
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1,
  },
  successText: {
    color: COLORS.canvasWhite,
  },
  failText: {
    color: COLORS.canvasWhite,
  },
  chartContainer: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
  },
  buttonContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  playAgainButton: {
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    shadowColor: COLORS.deepOnyx,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 4,
  },
  playAgainText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 1,
  },
});

export default GameOverScreen;
