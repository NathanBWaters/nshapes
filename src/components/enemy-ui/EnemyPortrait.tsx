/**
 * EnemyPortrait Component
 * Shows the active enemy with icon and name.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import { EnemyAmbientMood, EnemyReactionEvent } from '@/utils/enemyAnimations';
import type { EnemyInstance } from '@/types/enemy';
import { EnemyAvatar } from '../enemies';

interface EnemyPortraitProps {
  /** The active enemy instance */
  enemy: EnemyInstance;
  /** Optional compact mode for smaller display */
  compact?: boolean;
  /** Optional current HP for progressive battle wear */
  hp?: number;
  /** Optional max HP */
  maxHp?: number;
  /** Optional continuous ambient mood */
  mood?: EnemyAmbientMood;
  /** Optional discrete combat reaction */
  reaction?: EnemyReactionEvent | null;
}

// Tier badge colors
const TIER_COLORS: Record<number, string> = {
  1: COLORS.logicTeal,
  2: COLORS.impactOrange,
  3: COLORS.impactRed,
  4: '#7C3AED', // Purple for boss tier
};

const EnemyPortrait: React.FC<EnemyPortraitProps> = ({
  enemy,
  compact = false,
  hp,
  maxHp,
  mood = 'menacing',
  reaction = null,
}) => {
  const tierColor = TIER_COLORS[enemy.tier] || COLORS.slateCharcoal;

  if (compact) {
    return (
      <View style={styles.containerCompact}>
        <EnemyAvatar
          enemy={enemy}
          size={28}
          hp={hp}
          maxHp={maxHp}
          mood={mood}
          reaction={reaction}
          interactive
        />
        <View style={[styles.tierDot, { backgroundColor: tierColor }]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { borderColor: tierColor }]}>
        <EnemyAvatar
          enemy={enemy}
          size={36}
          hp={hp}
          maxHp={maxHp}
          mood={mood}
          reaction={reaction}
          interactive
        />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{enemy.name}</Text>
        <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
          <Text style={styles.tierText}>T{enemy.tier}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
  },
  containerCompact: {
    position: 'relative',
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.paperBeige,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  info: {
    flexDirection: 'column',
    gap: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    maxWidth: 100,
  },
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.button,
    alignSelf: 'flex-start',
  },
  tierText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.canvasWhite,
  },
  tierDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.canvasWhite,
  },
});

export default EnemyPortrait;
