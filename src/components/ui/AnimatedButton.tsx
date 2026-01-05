import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { DURATION, EASING } from '@/utils/designSystem';
import { triggerHaptic } from '@/utils/haptics';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface AnimatedButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function AnimatedButton({
  onPress,
  children,
  variant = 'primary',
  disabled = false,
  style,
  textStyle,
}: AnimatedButtonProps) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const shadowRadius = useSharedValue(variant === 'primary' ? 4 : 2);
  const isHovered = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
    shadowRadius: shadowRadius.value,
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.95, { duration: DURATION.fast });
    shadowRadius.value = withTiming(2, { duration: DURATION.fast });
    triggerHaptic('light');
  };

  const handlePressOut = () => {
    // On release, animate back to hover state if still hovered, otherwise to rest
    const targetScale = isHovered.value ? 1.02 : 1;
    const targetTranslateY = isHovered.value ? -2 : 0;

    scale.value = withSequence(
      withSpring(1.02, {
        damping: EASING.bounce.friction,
        stiffness: EASING.bounce.tension,
      }),
      withSpring(targetScale, {
        damping: EASING.spring.friction,
        stiffness: EASING.spring.tension,
      })
    );
    translateY.value = withSpring(targetTranslateY, {
      damping: EASING.spring.friction,
      stiffness: EASING.spring.tension,
    });
    shadowRadius.value = withSpring(variant === 'primary' ? 6 : 4, {
      damping: EASING.spring.friction,
      stiffness: EASING.spring.tension,
    });
  };

  // Web-only hover handlers
  const handleHoverIn = useCallback(() => {
    if (Platform.OS !== 'web') return;
    isHovered.value = 1;
    scale.value = withTiming(1.02, { duration: DURATION.normal });
    translateY.value = withTiming(-2, { duration: DURATION.normal });
    shadowRadius.value = withTiming(variant === 'primary' ? 6 : 4, { duration: DURATION.normal });
  }, [isHovered, scale, translateY, shadowRadius, variant]);

  const handleHoverOut = useCallback(() => {
    if (Platform.OS !== 'web') return;
    isHovered.value = 0;
    scale.value = withTiming(1, { duration: DURATION.fast });
    translateY.value = withTiming(0, { duration: DURATION.fast });
    shadowRadius.value = withTiming(variant === 'primary' ? 4 : 2, { duration: DURATION.fast });
  }, [isHovered, scale, translateY, shadowRadius, variant]);

  const isPrimary = variant === 'primary';

  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      // @ts-ignore - onHoverIn/Out are web-only props
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      disabled={disabled}
      activeOpacity={1}
      style={[
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        disabled && styles.disabled,
        animatedStyle,
        style,
        Platform.OS === 'web' && { cursor: 'pointer' as any },
      ]}
    >
      {typeof children === 'string' ? (
        <Text
          style={[
            styles.text,
            isPrimary ? styles.primaryText : styles.secondaryText,
            disabled && styles.disabledText,
            textStyle,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
  },
  primary: {
    backgroundColor: '#FFDE00', // Action Yellow
    borderWidth: 1,
    borderColor: '#383838', // Slate Charcoal
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#383838', // Slate Charcoal
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  primaryText: {
    color: '#383838', // Slate Charcoal
  },
  secondaryText: {
    color: '#383838', // Slate Charcoal
  },
  disabledText: {
    color: '#888888',
  },
});
