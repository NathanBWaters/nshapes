import { MONO_FONT } from '@/utils/fonts';
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { CardReward } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import { EASE, MS, SPRING, STAYS, reducedMs } from '@/utils/motion';
import Icon, { type IconName } from './Icon';

interface RewardRevealProps {
  reward: CardReward;
}

const RewardReveal: React.FC<RewardRevealProps> = ({ reward }) => {
  const reduced = useReducedMotion();
  const scaleAnim = useSharedValue(reduced ? 1 : 0.6);
  const opacityAnim = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      scaleAnim.value = 1;
      opacityAnim.value = withTiming(1, { duration: reducedMs(MS.quick), easing: EASE.ui, ...STAYS });
    } else {
      scaleAnim.value = withSpring(1, SPRING.playful);
      opacityAnim.value = withTiming(1, { duration: MS.quick, easing: EASE.ui, ...STAYS });
    }
    return () => {
      cancelAnimation(scaleAnim);
      cancelAnimation(opacityAnim);
    };
  }, [reduced, scaleAnim, opacityAnim]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacityAnim.value,
    transform: [{ scale: scaleAnim.value }],
  }));

  // Special styling for weapon effects
  const isExplosion = reward.effectType === 'explosion';
  const isLaser = reward.effectType === 'laser';
  const isFire = reward.effectType === 'fire';
  const isGrace = reward.effectType === 'grace';
  const isRicochet = reward.effectType === 'ricochet';
  const isConnected = reward.effectType === 'connected';
  const isSpecialEffect = isExplosion || isLaser || isFire || isGrace || isRicochet || isConnected;

  // Get background color based on effect type
  const getBackgroundColor = () => {
    if (isExplosion) return '#FF6B35'; // Orange-red for explosion
    if (isLaser) return '#00D4FF'; // Cyan for laser
    if (isFire) return '#FF4444'; // Red for fire
    if (isGrace) return '#9B59B6'; // Purple for grace
    if (isRicochet) return '#FFD700'; // Gold for ricochet
    if (isConnected) return '#7B68EE'; // Medium slate blue for connected
    return COLORS.canvasWhite;
  };

  // Build reward items to display
  const rewardItems: { icon?: string; iconName?: IconName; value: string; color: string }[] = [];

  // For weapon effects, show effect name prominently using registered vector icons ([UI-03])
  if (isExplosion) {
    rewardItems.push({
      iconName: 'lorc/bright-explosion',
      value: 'BOOM!',
      color: '#FFFFFF',
    });
  } else if (isLaser) {
    rewardItems.push({
      iconName: 'lorc/laser-blast',
      value: 'ZAP!',
      color: '#FFFFFF',
    });
  } else if (isFire) {
    rewardItems.push({
      iconName: 'lorc/fireball',
      value: 'BURN!',
      color: '#FFFFFF',
    });
  } else if (isGrace) {
    rewardItems.push({
      iconName: 'lorc/clover',
      value: 'GRACE!',
      color: '#FFFFFF',
    });
  } else if (isRicochet) {
    rewardItems.push({
      iconName: 'sbed/electric',
      value: 'RICOCHET!',
      color: '#FFFFFF',
    });
  } else if (isConnected) {
    rewardItems.push({
      iconName: 'lorc/linked-rings',
      value: 'LINKED!',
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
          backgroundColor: getBackgroundColor(),
          borderColor: isSpecialEffect ? getBackgroundColor() : COLORS.slateCharcoal,
        },
        animStyle,
      ]}
    >
      <View style={styles.rewardsContainer}>
        {rewardItems.map((item, index) => (
          <View key={index} style={styles.rewardItem}>
            {item.iconName ? (
              <Icon name={item.iconName} size={16} color={item.color} noShadow />
            ) : item.icon ? (
              <Text style={[styles.rewardIcon, { color: item.color }]}>
                {item.icon}
              </Text>
            ) : null}
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
    fontFamily: MONO_FONT,
  },
  rewardValue: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: MONO_FONT,
    fontVariant: ['tabular-nums'],
  },
});

export default RewardReveal;
