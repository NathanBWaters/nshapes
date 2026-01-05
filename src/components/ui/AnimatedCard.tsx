import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { SHADOWS, GLOWS, EASING } from '@/utils/designSystem';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface AnimatedCardProps {
  selected?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  disabled?: boolean;
}

export function AnimatedCard({
  selected = false,
  onPress,
  children,
  style,
  disabled = false,
}: AnimatedCardProps) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  React.useEffect(() => {
    if (selected) {
      scale.value = withSpring(1.05, {
        damping: EASING.spring.friction,
        stiffness: EASING.spring.tension,
      });
      translateY.value = withSpring(-4, {
        damping: EASING.spring.friction,
        stiffness: EASING.spring.tension,
      });
    } else {
      scale.value = withSpring(1, {
        damping: EASING.spring.friction,
        stiffness: EASING.spring.tension,
      });
      translateY.value = withSpring(0, {
        damping: EASING.spring.friction,
        stiffness: EASING.spring.tension,
      });
    }
  }, [selected, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <AnimatedTouchable
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.9}
      style={[
        styles.card,
        selected ? styles.selectedCard : styles.defaultCard,
        animatedStyle,
        style,
      ]}
    >
      {children}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF', // Canvas White
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#383838', // Slate Charcoal
  },
  defaultCard: {
    ...SHADOWS.md,
  },
  selectedCard: {
    borderColor: '#FFDE00', // Action Yellow
    borderWidth: 2,
    ...SHADOWS.lg,
    ...GLOWS.selection,
  },
});
