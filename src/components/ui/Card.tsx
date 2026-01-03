/**
 * Card - Delightful pressable card component with bouncy animations
 * Cards should feel eager to be interacted with and respond joyfully to touch
 */

import React, { useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
  Platform,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { COLORS, RADIUS, SPACING, SHADOWS, BORDERS, OPACITY, getRarityColor, getRarityBackground } from '../../theme';
import { SPRINGS } from '../../theme/animations';
import { triggerHaptic } from '../../hooks/useTouchFeedback';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CardProps {
  /** Card content */
  children: React.ReactNode;
  /** Press handler */
  onPress?: () => void;
  /** Selected state */
  selected?: boolean;
  /** Hovered state (controlled externally) */
  hovered?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Rarity for colored border/background */
  rarity?: 'common' | 'rare' | 'legendary';
  /** Use rarity background color */
  useRarityBackground?: boolean;
  /** Custom container style */
  style?: ViewStyle;
  /** Enable haptic feedback on selection */
  hapticFeedback?: boolean;
  /** External hover handlers */
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  /** Animation style for press */
  pressAnimation?: 'squish' | 'bounce' | 'eager' | 'none';
  /** Test ID */
  testID?: string;
}

export function Card({
  children,
  onPress,
  selected = false,
  hovered: externalHovered = false,
  disabled = false,
  rarity,
  useRarityBackground = false,
  style,
  hapticFeedback = true,
  onHoverIn: externalHoverIn,
  onHoverOut: externalHoverOut,
  pressAnimation = 'squish',
  testID,
}: CardProps) {
  const isInteractive = !!onPress && !disabled;

  // Animation values
  const pressed = useSharedValue(0);
  const hovered = useSharedValue(0);
  const selectedAnim = useSharedValue(selected ? 1 : 0);
  const glowPulse = useSharedValue(0);

  // Animate selection state changes
  useEffect(() => {
    if (selected) {
      // Joyful bounce when selected
      selectedAnim.value = withSequence(
        withSpring(1.08, SPRINGS.joyful),
        withSpring(1, SPRINGS.gentle)
      );
      // Start glow pulse
      glowPulse.value = withSpring(1, SPRINGS.gentle);
      // Haptic feedback
      if (hapticFeedback && Platform.OS !== 'web') {
        triggerHaptic('success');
      }
    } else {
      selectedAnim.value = withSpring(0, SPRINGS.gentle);
      glowPulse.value = withSpring(0, SPRINGS.gentle);
    }
  }, [selected, hapticFeedback, selectedAnim, glowPulse]);

  // Sync external hover state
  useEffect(() => {
    hovered.value = withSpring(externalHovered ? 1 : 0, SPRINGS.eager);
  }, [externalHovered, hovered]);

  const handlePressIn = useCallback(() => {
    if (!isInteractive || pressAnimation === 'none') return;
    if (hapticFeedback && Platform.OS !== 'web') {
      triggerHaptic('light');
    }
    pressed.value = withSpring(1, SPRINGS.eager);
  }, [isInteractive, pressAnimation, hapticFeedback, pressed]);

  const handlePressOut = useCallback(() => {
    if (!isInteractive || pressAnimation === 'none') return;
    // Bouncy release
    pressed.value = withSequence(
      withSpring(-0.3, { ...SPRINGS.wobbly, stiffness: SPRINGS.wobbly.stiffness * 0.8 }),
      withSpring(0, SPRINGS.gentle)
    );
  }, [isInteractive, pressAnimation, pressed]);

  const handleHoverIn = useCallback(() => {
    if (!isInteractive) return;
    hovered.value = withSpring(1, SPRINGS.eager);
    externalHoverIn?.();
  }, [isInteractive, hovered, externalHoverIn]);

  const handleHoverOut = useCallback(() => {
    hovered.value = withSpring(0, SPRINGS.gentle);
    externalHoverOut?.();
  }, [hovered, externalHoverOut]);

  const handlePress = useCallback(() => {
    if (!isInteractive) return;
    if (hapticFeedback && Platform.OS !== 'web') {
      triggerHaptic('selection');
    }
    onPress?.();
  }, [isInteractive, hapticFeedback, onPress]);

  // Get press scale based on animation style
  const getPressScale = (style: string) => {
    switch (style) {
      case 'bounce': return 0.88;
      case 'eager': return 0.94;
      case 'squish': return 0.92;
      default: return 1;
    }
  };

  // Main animated style combining press and hover
  const animatedStyle = useAnimatedStyle(() => {
    // Press: squish down with slight overshoot on release
    const pressScale = interpolate(
      pressed.value,
      [-0.5, 0, 1],
      [1.05, 1, getPressScale(pressAnimation)],
      Extrapolation.CLAMP
    );

    // Hover: lift up and scale
    const hoverTranslateY = interpolate(
      hovered.value,
      [0, 1],
      [0, -6],
      Extrapolation.CLAMP
    );
    const hoverScale = interpolate(
      hovered.value,
      [0, 1],
      [1, 1.03],
      Extrapolation.CLAMP
    );

    // Subtle rotation on hover for playfulness
    const hoverRotate = interpolate(
      hovered.value,
      [0, 1],
      [0, 0.5],
      Extrapolation.CLAMP
    );

    // Selection scale
    const selectScale = interpolate(
      selectedAnim.value,
      [0, 1],
      [1, 1],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateY: hoverTranslateY },
        { scale: pressScale * hoverScale * selectScale },
        { rotate: `${hoverRotate}deg` },
      ],
    };
  });

  // Shadow animation for depth
  const shadowStyle = useAnimatedStyle(() => {
    const shadowOpacity = interpolate(
      hovered.value + (selected ? 0.5 : 0),
      [0, 1, 1.5],
      [0.08, 0.16, 0.2],
      Extrapolation.CLAMP
    );
    const shadowRadius = interpolate(
      hovered.value + (selected ? 0.5 : 0),
      [0, 1, 1.5],
      [2, 8, 12],
      Extrapolation.CLAMP
    );
    const elevation = interpolate(
      hovered.value + (selected ? 0.5 : 0),
      [0, 1, 1.5],
      [2, 6, 8],
      Extrapolation.CLAMP
    );

    return {
      shadowOpacity,
      shadowRadius,
      ...(Platform.OS === 'android' && { elevation }),
    };
  });

  // Glow effect for selected state
  const glowStyle = useAnimatedStyle(() => {
    if (!selected) return {};

    return {
      shadowColor: COLORS.actionYellow,
      shadowOpacity: interpolate(glowPulse.value, [0, 1], [0, 0.4]),
      shadowRadius: interpolate(glowPulse.value, [0, 1], [0, 12]),
      shadowOffset: { width: 0, height: 0 },
    };
  });

  // Determine border color
  const borderColor = selected
    ? COLORS.actionYellow
    : rarity
      ? getRarityColor(rarity)
      : COLORS.slateCharcoal;

  // Determine background color
  const backgroundColor = selected
    ? COLORS.actionYellow
    : useRarityBackground && rarity
      ? getRarityBackground(rarity)
      : COLORS.canvasWhite;

  const cardStyles: ViewStyle[] = [
    styles.base,
    {
      backgroundColor,
      borderColor,
      borderWidth: selected ? BORDERS.standard : BORDERS.thin,
    },
    disabled && styles.disabled,
    Platform.OS === 'web' && isInteractive && styles.webCursor,
    style,
  ];

  if (!isInteractive) {
    return (
      <Animated.View
        style={[cardStyles, selected && glowStyle]}
        testID={testID}
      >
        {children}
      </Animated.View>
    );
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      disabled={disabled}
      style={[cardStyles, animatedStyle, shadowStyle, glowStyle]}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * CardHeader - Header section of a card
 */
export function CardHeader({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.header, style]}>
      {children}
    </View>
  );
}

/**
 * CardContent - Main content section of a card
 */
export function CardContent({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.content, style]}>
      {children}
    </View>
  );
}

/**
 * CardFooter - Footer section of a card
 */
export function CardFooter({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.footer, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  disabled: {
    opacity: OPACITY.disabled,
  },
  header: {
    marginBottom: SPACING.sm,
  },
  content: {
    flex: 1,
  },
  footer: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  webCursor: {
    // @ts-ignore - web only
    cursor: 'pointer',
  },
});

export default Card;
