/**
 * Button - World-class button component with animations and haptics
 * Consistent styling, press feedback, hover states, and loading support
 */

import React, { useCallback } from 'react';
import {
  StyleSheet,
  Text,
  ActivityIndicator,
  Platform,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { COLORS, RADIUS, SPACING, SHADOWS, FONT_WEIGHTS, OPACITY } from '../../theme';
import { useScalePress } from '../../hooks/useScalePress';
import { useHoverElevation } from '../../hooks/useHoverElevation';
import { haptics } from '../../utils/haptics';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  /** Button text or content */
  children: React.ReactNode;
  /** Button style variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Press handler */
  onPress: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state - shows spinner */
  loading?: boolean;
  /** Icon to show before text */
  icon?: React.ReactNode;
  /** Icon to show after text */
  iconAfter?: React.ReactNode;
  /** Full width button */
  fullWidth?: boolean;
  /** Custom container style */
  style?: ViewStyle;
  /** Custom text style */
  textStyle?: TextStyle;
  /** Enable haptic feedback (default: true on mobile) */
  hapticFeedback?: boolean;
  /** Test ID for testing */
  testID?: string;
}

const VARIANT_STYLES: Record<ButtonVariant, { bg: string; text: string; border: string }> = {
  primary: {
    bg: COLORS.actionYellow,
    text: COLORS.slateCharcoal,
    border: COLORS.slateCharcoal,
  },
  secondary: {
    bg: 'transparent',
    text: COLORS.slateCharcoal,
    border: COLORS.slateCharcoal,
  },
  danger: {
    bg: COLORS.impactRed,
    text: COLORS.canvasWhite,
    border: COLORS.impactRed,
  },
  ghost: {
    bg: 'transparent',
    text: COLORS.slateCharcoal,
    border: 'transparent',
  },
  success: {
    bg: COLORS.logicTeal,
    text: COLORS.canvasWhite,
    border: COLORS.logicTeal,
  },
};

const SIZE_STYLES: Record<ButtonSize, { paddingH: number; paddingV: number; fontSize: number; minHeight: number }> = {
  sm: { paddingH: SPACING.sm, paddingV: SPACING.xs, fontSize: 12, minHeight: 32 },
  md: { paddingH: SPACING.md, paddingV: SPACING.sm, fontSize: 14, minHeight: 44 },
  lg: { paddingH: SPACING.lg, paddingV: SPACING.md, fontSize: 16, minHeight: 52 },
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  onPress,
  disabled = false,
  loading = false,
  icon,
  iconAfter,
  fullWidth = false,
  style,
  textStyle,
  hapticFeedback = true,
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];

  const { onPressIn, onPressOut, animatedStyle: pressStyle } = useScalePress({
    disabled: isDisabled,
  });

  const { onHoverIn, onHoverOut, animatedStyle: hoverStyle, webStyle } = useHoverElevation({
    disabled: isDisabled,
  });

  const handlePress = useCallback(() => {
    if (isDisabled) return;

    if (hapticFeedback && Platform.OS !== 'web') {
      haptics.light();
    }

    onPress();
  }, [isDisabled, hapticFeedback, onPress]);

  const buttonStyles: ViewStyle[] = [
    styles.base,
    {
      backgroundColor: variantStyle.bg,
      borderColor: variantStyle.border,
      paddingHorizontal: sizeStyle.paddingH,
      paddingVertical: sizeStyle.paddingV,
      minHeight: sizeStyle.minHeight,
    },
    variant === 'secondary' && styles.secondaryBorder,
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    webStyle,
    style,
  ];

  const textStyles: TextStyle[] = [
    styles.text,
    {
      color: variantStyle.text,
      fontSize: sizeStyle.fontSize,
    },
    isDisabled && styles.disabledText,
    textStyle,
  ];

  // Extract text for accessibility
  const accessibilityText = typeof children === 'string' ? children : undefined;

  return (
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={buttonStyles}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityText}
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyle.text}
          style={styles.loader}
        />
      ) : (
        <>
          {icon && <>{icon}</>}
          {typeof children === 'string' ? (
            <Text style={textStyles}>{children}</Text>
          ) : (
            children
          )}
          {iconAfter && <>{iconAfter}</>}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    gap: SPACING.xs,
    ...SHADOWS.sm,
  },
  secondaryBorder: {
    borderWidth: 2,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: OPACITY.disabled,
  },
  text: {
    fontWeight: FONT_WEIGHTS.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  disabledText: {
    opacity: OPACITY.muted,
  },
  loader: {
    marginHorizontal: SPACING.xs,
  },
});

export default Button;
