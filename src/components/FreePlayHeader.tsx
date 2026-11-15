import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Character, PlayerStats } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import { FighterAmbientMood, FighterReactionEvent } from '@/utils/fighterAnimations';
import { FighterAvatar } from './fighters';
import Icon from './Icon';
import type { FunRating } from '@/analytics/fightEvent';

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
  funRating?: FunRating | null;
  onRateFun?: (rating: FunRating | null) => void;
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
  funRating = null,
  onRateFun,
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

        {matchCount > 0 && onRateFun && (
          <View style={styles.funGroup}>
            <TouchableOpacity
              testID="freeplay-fun-up"
              accessibilityRole="button"
              accessibilityLabel="Rate Free Play round as fun"
              accessibilityState={{ selected: funRating === 'up' }}
              onPress={() => onRateFun(funRating === 'up' ? null : 'up')}
              style={[styles.funBtn, funRating === 'up' && styles.funBtnUp]}
            >
              <Icon
                name="delapouite/thumb-up"
                size={14}
                color={funRating === 'up' ? COLORS.canvasWhite : COLORS.slateCharcoal}
                noShadow
              />
            </TouchableOpacity>
            <TouchableOpacity
              testID="freeplay-fun-down"
              accessibilityRole="button"
              accessibilityLabel="Rate Free Play round as not fun"
              accessibilityState={{ selected: funRating === 'down' }}
              onPress={() => onRateFun(funRating === 'down' ? null : 'down')}
              style={[styles.funBtn, funRating === 'down' && styles.funBtnDown]}
            >
              <Icon
                name="delapouite/thumb-down"
                size={14}
                color={funRating === 'down' ? COLORS.canvasWhite : COLORS.slateCharcoal}
                noShadow
              />
            </TouchableOpacity>
          </View>
        )}
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
  funGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  funBtn: {
    width: 30,
    height: 28,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.paperBeige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  funBtnUp: {
    backgroundColor: COLORS.logicTeal,
  },
  funBtnDown: {
    backgroundColor: COLORS.impactOrange,
  },
});

export default FreePlayHeader;
