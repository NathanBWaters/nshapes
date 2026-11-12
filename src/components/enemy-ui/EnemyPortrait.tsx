/**
 * EnemyPortrait Component
 * Shows the active enemy as a compact avatar badge with a tier dot.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import { EnemyAmbientMood, EnemyReactionEvent } from '@/utils/enemyAnimations';
import type { EnemyInstance } from '@/types/enemy';
import { EnemyAvatar } from '../enemies';

interface EnemyPortraitProps {
  /** The active enemy instance */
  enemy: EnemyInstance;
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
  hp,
  maxHp,
  mood = 'menacing',
  reaction = null,
}) => {
  const tierColor = TIER_COLORS[enemy.tier] || COLORS.slateCharcoal;

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
};

const styles = StyleSheet.create({
  containerCompact: {
    position: 'relative',
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
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
