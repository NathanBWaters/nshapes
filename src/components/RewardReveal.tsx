import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { CardReward } from '@/types';

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

  // Build reward items to display
  const rewardItems: { icon: string; value: string; color: string }[] = [];

  if (reward.points && reward.points > 0) {
    rewardItems.push({
      icon: '★',
      value: `+${reward.points}`,
      color: '#fbbf24', // Yellow/gold
    });
  }

  if (reward.money && reward.money > 0) {
    rewardItems.push({
      icon: '$',
      value: `+${reward.money}`,
      color: '#22c55e', // Green
    });
  }

  if (reward.experience && reward.experience > 0) {
    rewardItems.push({
      icon: '✦',
      value: `+${reward.experience}`,
      color: '#a855f7', // Purple
    });
  }

  if (reward.healing && reward.healing > 0) {
    rewardItems.push({
      icon: '♥',
      value: `+${reward.healing}`,
      color: '#ef4444', // Red
    });
  }

  if (reward.lootBox) {
    rewardItems.push({
      icon: '📦',
      value: '',
      color: '#f97316', // Orange
    });
  }

  if (reward.item) {
    rewardItems.push({
      icon: '🎁',
      value: reward.item,
      color: '#ec4899', // Pink
    });
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
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
    backgroundColor: '#1f2937',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#374151',
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
  },
  rewardValue: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default RewardReveal;
