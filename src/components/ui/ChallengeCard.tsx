import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AdventureDifficulty } from '@/types';
import type { EnemyInstance } from '@/types/enemy';
import { COLORS, RADIUS } from '@/utils/colors';
import Icon, { IconName } from '../Icon';

interface ChallengeCardProps {
  // For round complete - show enemy challenge
  enemy?: EnemyInstance;
  // For victory - show difficulty challenge
  difficulty?: AdventureDifficulty;
  // Optional: show completion badge
  showAchievement?: boolean;
}

// Tier colors for enemies
const TIER_COLORS: Record<1 | 2 | 3 | 4, string> = {
  1: COLORS.logicTeal,
  2: COLORS.actionYellow,
  3: COLORS.impactOrange,
  4: COLORS.impactRed,
};

const TIER_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: 'Common',
  2: 'Uncommon',
  3: 'Rare',
  4: 'Boss',
};

// Difficulty display info
const getDifficultyInfo = (diff: AdventureDifficulty) => {
  switch (diff) {
    case 'easy':
      return { label: 'Easy', desc: '3 attributes for all rounds', icon: 'lorc/feather' as const, color: COLORS.logicTeal };
    case 'medium':
      return { label: 'Medium', desc: 'Progressive difficulty (3→4→5 attributes)', icon: 'lorc/archery-target' as const, color: COLORS.actionYellow };
    case 'hard':
      return { label: 'Hard', desc: '4-5 attributes throughout', icon: 'lorc/diamond-hard' as const, color: COLORS.impactOrange };
  }
};

const ChallengeCard: React.FC<ChallengeCardProps> = ({ enemy, difficulty, showAchievement = false }) => {
  // Determine what to display
  const isEnemyChallenge = !!enemy;
  const isDifficultyChallenge = !!difficulty;

  if (!isEnemyChallenge && !isDifficultyChallenge) {
    return null;
  }

  // Enemy challenge rendering
  if (isEnemyChallenge && enemy) {
    const tierColor = TIER_COLORS[enemy.tier];
    const tierLabel = TIER_LABELS[enemy.tier];

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Icon name="lorc/sword-clash" size={20} color={COLORS.slateCharcoal} />
          <Text style={styles.headerTitle}>Enemy Challenge</Text>
        </View>

        <View style={[styles.card, { borderColor: tierColor }]}>
          {/* Enemy Header */}
          <View style={styles.enemyHeader}>
            <View style={styles.enemyIconContainer}>
              <Icon name={enemy.icon} size={32} color={tierColor} />
            </View>
            <View style={styles.enemyInfo}>
              <Text style={styles.enemyName}>{enemy.name}</Text>
              <Text style={[styles.enemyTier, { color: tierColor }]}>
                Tier {enemy.tier} · {tierLabel}
              </Text>
            </View>
          </View>

          {/* Enemy Effect */}
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Enemy Effects</Text>
            <Text style={styles.infoText}>{enemy.description}</Text>
          </View>

          {/* Defeat Condition */}
          <View style={styles.infoSection}>
            <Text style={[styles.infoLabel, { color: COLORS.logicTeal }]}>Defeat Condition</Text>
            <Text style={styles.infoText}>{enemy.defeatConditionText}</Text>
          </View>

          {showAchievement && (
            <View style={styles.achievementBadge}>
              <Icon name="lorc/checked-shield" size={14} color={COLORS.logicTeal} />
              <Text style={styles.achievementText}>Enemy Defeated</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // Difficulty challenge rendering
  if (isDifficultyChallenge && difficulty) {
    const difficultyInfo = getDifficultyInfo(difficulty);

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Icon name="lorc/trophy" size={20} color={COLORS.actionYellow} />
          <Text style={styles.headerTitle}>Challenge Completed</Text>
        </View>

        <View style={[styles.card, { borderColor: difficultyInfo.color }]}>
          <View style={styles.difficultyRow}>
            <Icon name={difficultyInfo.icon} size={24} color={difficultyInfo.color} />
            <View style={styles.difficultyInfo}>
              <Text style={styles.difficultyLabel}>Difficulty</Text>
              <Text style={[styles.difficultyName, { color: difficultyInfo.color }]}>
                {difficultyInfo.label}
              </Text>
            </View>
          </View>
          <Text style={styles.difficultyDesc}>{difficultyInfo.desc}</Text>

          {showAchievement && (
            <View style={styles.achievementBadge}>
              <Icon name="lorc/checked-shield" size={14} color={COLORS.logicTeal} />
              <Text style={styles.achievementText}>Achievement Unlocked</Text>
            </View>
          )}
        </View>

        {showAchievement && (
          <Text style={styles.rewardText}>
            🎉 Reward: Character unlock progress increased!
          </Text>
        )}
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.button,
    borderWidth: 2,
    padding: 16,
    gap: 12,
  },
  // Enemy styles
  enemyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  enemyIconContainer: {
    width: 56,
    height: 56,
    backgroundColor: COLORS.paperBeige,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.slateCharcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  enemyInfo: {
    flex: 1,
  },
  enemyName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.deepOnyx,
    textTransform: 'uppercase',
  },
  enemyTier: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  infoSection: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.impactOrange,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.slateCharcoal,
    lineHeight: 18,
  },
  // Difficulty styles
  difficultyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  difficultyInfo: {
    flex: 1,
  },
  difficultyLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  difficultyName: {
    fontSize: 20,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  difficultyDesc: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.slateCharcoal,
    opacity: 0.8,
  },
  // Shared styles
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.logicTeal,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
    marginTop: 4,
  },
  achievementText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.logicTeal,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rewardText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.deepOnyx,
    textAlign: 'center',
    marginTop: 12,
  },
});

export default ChallengeCard;
