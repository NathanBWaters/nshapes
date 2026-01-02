import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { CardReward } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';

interface RewardRevealProps {
  reward: CardReward;
}

const RewardReveal: React.FC<RewardRevealProps> = ({ reward }) => {
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pop in animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 120,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Special styling for weapon effects
  const isExplosion = reward.effectType === 'explosion';
  const isLaser = reward.effectType === 'laser';
  const isFire = reward.effectType === 'fire';
  const isGrace = reward.effectType === 'grace';
  const isRicochet = reward.effectType === 'ricochet';
  const isSpecialEffect = isExplosion || isLaser || isFire || isGrace || isRicochet;

  // Get background color based on effect type
  const getBackgroundColor = () => {
    if (isExplosion) return '#FF6B35'; // Orange-red for explosion
    if (isLaser) return '#00D4FF'; // Cyan for laser
    if (isFire) return '#FF4444'; // Red for fire
    if (isGrace) return '#9B59B6'; // Purple for grace
    if (isRicochet) return '#FFD700'; // Gold for ricochet
    return COLORS.canvasWhite;
  };

  // Build reward items to display
  const rewardItems: { icon: string; value: string; color: string }[] = [];

  // For weapon effects, show effect name prominently
  if (isExplosion) {
    rewardItems.push({
      icon: '💥',
      value: 'BOOM!',
      color: '#FFFFFF',
    });
  } else if (isLaser) {
    rewardItems.push({
      icon: '⚡',
      value: 'ZAP!',
      color: '#FFFFFF',
    });
  } else if (isFire) {
    rewardItems.push({
      icon: '🔥',
      value: 'BURN!',
      color: '#FFFFFF',
    });
  } else if (isGrace) {
    rewardItems.push({
      icon: '🍀',
      value: 'GRACE!',
      color: '#FFFFFF',
    });
  } else if (isRicochet) {
    rewardItems.push({
      icon: '⚡',
      value: 'RICOCHET!',
      color: '#FFFFFF',
    });
  }

  if (reward.points && reward.points > 0) {
    rewardItems.push({
      icon: '*',
      value: `+${reward.points}`,
      color: isSpecialEffect ? '#FFFFFF' : COLORS.actionYellow,
    });
  }

  if (reward.money && reward.money > 0) {
    rewardItems.push({
      icon: '$',
      value: `+${reward.money}`,
      color: isSpecialEffect ? '#FFFFFF' : COLORS.logicTeal,
    });
  }

  if (reward.experience && reward.experience > 0) {
    rewardItems.push({
      icon: '+',
      value: `${reward.experience}XP`,
      color: isSpecialEffect ? '#FFFFFF' : COLORS.impactOrange,
    });
  }

  if (reward.healing && reward.healing > 0) {
    rewardItems.push({
      icon: '+',
      value: `${reward.healing}HP`,
      color: COLORS.impactRed,
    });
  }

  if (reward.hint && reward.hint > 0) {
    rewardItems.push({
      icon: '?',
      value: `+${reward.hint} HINT`,
      color: COLORS.actionYellow,
    });
  }

  if (reward.lootBox) {
    rewardItems.push({
      icon: '?',
      value: 'LOOT',
      color: COLORS.impactOrange,
    });
  }

  if (reward.item) {
    rewardItems.push({
      icon: '!',
      value: reward.item,
      color: COLORS.logicTeal,
    });
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
          backgroundColor: getBackgroundColor(),
          borderColor: isSpecialEffect ? getBackgroundColor() : COLORS.slateCharcoal,
        },
      ]}
    >
      <View style={styles.rewardsContainer}>
        {rewardItems.map((item, index) => (
          <View key={index} style={styles.rewardItem}>
            <Text style={[styles.rewardIcon, { color: item.color }]}>
              {item.icon}
            </Text>
            {item.value ? (
              <Text style={[styles.rewardValue, { color: item.color }]}>
                {item.value}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  rewardsContainer: {
    alignItems: 'center',
    gap: 2,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rewardIcon: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  rewardValue: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
});

export default RewardReveal;
