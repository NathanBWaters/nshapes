/**
 * Card - Pressable card component for selection grids
 * Supports hover elevation, selection states, and rarity styling
 */

import React, { useCallback } from 'react';
import {
  StyleSheet,
  ViewStyle,
  Platform,
  Pressable,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { COLORS, RADIUS, SPACING, SHADOWS, BORDERS, OPACITY, getRarityColor, getRarityBackground } from '../../theme';
import { useScalePress } from '../../hooks/useScalePress';
import { useHoverElevation } from '../../hooks/useHoverElevation';
import { haptics } from '../../utils/haptics';

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
  /** Test ID */
  testID?: string;
}

export function Card({
  children,
  onPress,
  selected = false,
  hovered = false,
  disabled = false,
  rarity,
  useRarityBackground = false,
  style,
  hapticFeedback = true,
  onHoverIn: externalHoverIn,
  onHoverOut: externalHoverOut,
  testID,
}: CardProps) {
  const isInteractive = !!onPress && !disabled;

  const { onPressIn, onPressOut, animatedStyle: pressStyle } = useScalePress({
    disabled: !isInteractive,
    scale: 0.98,
  });

  const { onHoverIn, onHoverOut, animatedStyle: hoverStyle, webStyle } = useHoverElevation({
    disabled: !isInteractive,
    scale: 1.02,
  });

  const handlePress = useCallback(() => {
    if (!isInteractive) return;

    if (hapticFeedback && Platform.OS !== 'web') {
      haptics.selection();
    }

    onPress?.();
  }, [isInteractive, hapticFeedback, onPress]);

  const handleHoverIn = useCallback(() => {
    onHoverIn();
    externalHoverIn?.();
  }, [onHoverIn, externalHoverIn]);

  const handleHoverOut = useCallback(() => {
    onHoverOut();
    externalHoverOut?.();
  }, [onHoverOut, externalHoverOut]);

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
    selected && styles.selected,
    (hovered || selected) && styles.elevated,
    disabled && styles.disabled,
    webStyle,
    style,
  ];

  if (!isInteractive) {
    return (
      <Animated.View style={cardStyles} testID={testID}>
        {children}
      </Animated.View>
    );
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      disabled={disabled}
      style={[cardStyles, pressStyle, hoverStyle]}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  selected: {
    ...SHADOWS.md,
  },
  elevated: {
    ...SHADOWS.md,
  },
  disabled: {
    opacity: OPACITY.disabled,
  },
});

export default Card;
