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

  // Build reward items to display
  const rewardItems: { icon: string; value: string; color: string }[] = [];

  if (reward.points && reward.points > 0) {
    rewardItems.push({
      icon: '*',
      value: `+${reward.points}`,
      color: COLORS.actionYellow,
    });
  }

  if (reward.money && reward.money > 0) {
    rewardItems.push({
      icon: '$',
      value: `+${reward.money}`,
      color: COLORS.logicTeal,
    });
  }

  if (reward.experience && reward.experience > 0) {
    rewardItems.push({
      icon: '+',
      value: `${reward.experience}XP`,
      color: COLORS.impactOrange,
    });
  }

  if (reward.healing && reward.healing > 0) {
    rewardItems.push({
      icon: '+',
      value: `${reward.healing}HP`,
      color: COLORS.impactRed,
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
    backgroundColor: COLORS.deepOnyx,
    borderRadius: RADIUS.module,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
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
