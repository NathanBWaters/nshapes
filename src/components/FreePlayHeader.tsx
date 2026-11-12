import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Character, PlayerStats } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import { FighterAmbientMood, FighterReactionEvent } from '@/utils/fighterAnimations';
import { FighterAvatar } from './fighters';

interface FreePlayHeaderProps {
  character: Character;
  playerStats: PlayerStats;
  fighterMood: FighterAmbientMood;
  fighterReaction: FighterReactionEvent | null;
  fighterStreak: number;
  hasActiveHint: boolean;
  onHintPress: () => void;
  onClearHint: () => void;
  matchCount: number;
  onExit: () => void;
}

/** The minimal Free Play HUD: no round, timer or score target. */
const FreePlayHeader: React.FC<FreePlayHeaderProps> = ({
  character,
  playerStats,
  fighterMood,
  fighterReaction,
  fighterStreak,
  hasActiveHint,
  onHintPress,
  onClearHint,
  matchCount,
  onExit,
}) => (
                <View style={styles.header}>
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={styles.exitButton}
          onPress={onExit}
        >
          <Text style={styles.exitButtonText}>Exit</Text>
        </TouchableOpacity>

        {/* Free Play fighter portrait */}
        <FighterAvatar
          character={character}
          size={34}
          health={playerStats.health}
          maxHealth={playerStats.maxHealth}
          mood={fighterMood}
          reaction={fighterReaction}
          streak={fighterStreak}
          framed
          interactive
          testID="freeplay-fighter-avatar"
        />

        <View style={styles.modeBadge}>
          <Text style={styles.modeBadgeText}>Free Play</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.heartIcon}>♥</Text>
          <Text style={styles.statValue}>
            {playerStats.health}/{playerStats.maxHealth}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.levelText}>Lv{playerStats.level}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.hintButton,
            playerStats.hints > 0 ? styles.hintButtonEnabled : styles.hintButtonDisabled,
            hasActiveHint && styles.hintButtonActive,
          ]}
          onPress={hasActiveHint ? onClearHint : onHintPress}
          disabled={playerStats.hints <= 0 && !hasActiveHint}
        >
          <Text style={styles.hintIcon}>?</Text>
          <Text style={styles.hintCount}>
            {hasActiveHint ? 'x' : playerStats.hints}
          </Text>
        </TouchableOpacity>

        <View style={styles.statItem}>
          <Text style={styles.matchLabel}>Matches</Text>
          <Text style={styles.statValue}>{matchCount}</Text>
        </View>
      </View>
    </View>
);

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.canvasWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  exitButton: {
    backgroundColor: COLORS.slateCharcoal,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.deepOnyx,
  },
  exitButtonText: {
    color: COLORS.canvasWhite,
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  modeBadge: {
    backgroundColor: COLORS.logicTeal,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  modeBadgeText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.paperBeige,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: RADIUS.button,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  heartIcon: {
    color: COLORS.impactRed,
    fontSize: 12,
  },
  statValue: {
    color: COLORS.slateCharcoal,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  levelText: {
    color: COLORS.logicTeal,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  matchLabel: {
    color: COLORS.slateCharcoal,
    fontSize: 10,
    fontWeight: '600',
    marginRight: 2,
  },
  hintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
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
    color: COLORS.slateCharcoal,
  },
});

export default FreePlayHeader;
