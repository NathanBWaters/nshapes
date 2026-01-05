import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { DURATION } from '@/utils/designSystem';

interface ScreenTransitionProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Wrapper component that fades children in on mount.
 * Provides smooth page transition effect.
 */
export function ScreenTransition({ children, style }: ScreenTransitionProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: DURATION.normal,
      easing: Easing.out(Easing.exp),
    });
    translateY.value = withTiming(0, {
      duration: DURATION.normal,
      easing: Easing.out(Easing.exp),
    });
  }, [opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[{ flex: 1 }, animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}
