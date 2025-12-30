import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSocket } from '@/context/SocketContext';
import { COLORS, RADIUS } from '@/utils/colors';

const ScoreBoard: React.FC = () => {
  const { players, playerId } = useSocket();

  if (players.length <= 1) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>PLAYER SCORES</Text>
      </View>
      <View style={styles.playerList}>
        {players.map((player) => (
          <View
            key={player.id}
            style={[
              styles.playerRow,
              player.id === playerId && styles.currentPlayer,
            ]}
          >
            <View style={styles.playerInfo}>
              <View
                style={[
                  styles.playerIndicator,
                  player.id === playerId ? styles.indicatorActive : styles.indicatorInactive,
                ]}
              />
              <Text style={styles.playerName}>{player.name}</Text>
            </View>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreText}>{player.score}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 500,
  },
  header: {
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  headerText: {
    color: COLORS.deepOnyx,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1,
  },
  playerList: {
    padding: 12,
    gap: 8,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.paperBeige,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  currentPlayer: {
    backgroundColor: COLORS.actionYellow,
    borderColor: COLORS.slateCharcoal,
    borderWidth: 2,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  indicatorActive: {
    backgroundColor: COLORS.logicTeal,
  },
  indicatorInactive: {
    backgroundColor: COLORS.slateCharcoal,
  },
  playerName: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 14,
  },
  scoreBadge: {
    backgroundColor: COLORS.deepOnyx,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.button,
  },
  scoreText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 14,
    fontFamily: 'monospace',
  },
});

export default ScoreBoard;
