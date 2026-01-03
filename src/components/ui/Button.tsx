/**
 * Button - Delightful button component with bouncy animations and haptics
 * Every press should feel alive and satisfying
 */

import React, { useCallback } from 'react';
import {
  StyleSheet,
  Text,
  ActivityIndicator,
  Platform,
  ViewStyle,
  TextStyle,
  Pressable,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolateColor,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { COLORS, RADIUS, SPACING, SHADOWS, FONT_WEIGHTS, OPACITY } from '../../theme';
import { SPRINGS } from '../../theme/animations';
import { usePlayfulPress } from '../../hooks/usePlayfulPress';
import { useHoverElevation } from '../../hooks/useHoverElevation';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';
type PressStyle = 'squish' | 'bounce' | 'eager' | 'gentle' | 'joyful';

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
  /** Press animation style */
  pressStyle?: PressStyle;
  /** Test ID for testing */
  testID?: string;
}

const VARIANT_STYLES: Record<ButtonVariant, {
  bg: string;
  bgHover: string;
  text: string;
  border: string;
}> = {
  primary: {
    bg: COLORS.actionYellow,
    bgHover: '#FFE433', // Slightly lighter yellow
    text: COLORS.slateCharcoal,
    border: COLORS.slateCharcoal,
  },
  secondary: {
    bg: 'transparent',
    bgHover: COLORS.paperBeige,
    text: COLORS.slateCharcoal,
    border: COLORS.slateCharcoal,
  },
  danger: {
    bg: COLORS.impactRed,
    bgHover: '#FF8A84',
    text: COLORS.canvasWhite,
    border: COLORS.impactRed,
  },
  ghost: {
    bg: 'transparent',
    bgHover: COLORS.paperBeige,
    text: COLORS.slateCharcoal,
    border: 'transparent',
  },
  success: {
    bg: COLORS.logicTeal,
    bgHover: '#1BC4AF',
    text: COLORS.canvasWhite,
    border: COLORS.logicTeal,
  },
};

const SIZE_STYLES: Record<ButtonSize, {
  paddingH: number;
  paddingV: number;
  fontSize: number;
  minHeight: number;
  iconGap: number;
}> = {
  sm: { paddingH: SPACING.sm, paddingV: SPACING.xs, fontSize: 12, minHeight: 36, iconGap: 4 },
  md: { paddingH: SPACING.md, paddingV: SPACING.sm, fontSize: 14, minHeight: 48, iconGap: 6 },
  lg: { paddingH: SPACING.lg, paddingV: SPACING.md, fontSize: 16, minHeight: 56, iconGap: 8 },
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
  pressStyle = 'squish',
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];

  // Playful press animation with haptics
  const {
    onPressIn,
    onPressOut,
    animatedStyleSimple: pressAnimStyle
  } = usePlayfulPress({
    style: pressStyle,
    haptics: hapticFeedback && Platform.OS !== 'web',
    hapticType: 'light',
    disabled: isDisabled,
  });

  // Hover elevation for desktop
  const {
    onHoverIn,
    onHoverOut,
    animatedStyle: hoverAnimStyle,
  } = useHoverElevation({
    disabled: isDisabled,
    liftAmount: 3,
    scaleAmount: 1.02,
  });

  // Hover color transition
  const hovered = useSharedValue(0);

  const handleHoverIn = useCallback(() => {
    if (isDisabled) return;
    hovered.value = withSpring(1, SPRINGS.quickSnap);
    onHoverIn();
  }, [isDisabled, hovered, onHoverIn]);

  const handleHoverOut = useCallback(() => {
    hovered.value = withSpring(0, SPRINGS.gentle);
    onHoverOut();
  }, [hovered, onHoverOut]);

  const handlePress = useCallback(() => {
    if (isDisabled) return;
    onPress();
  }, [isDisabled, onPress]);

  // Background color animation on hover
  const backgroundAnimStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      hovered.value,
      [0, 1],
      [variantStyle.bg, variantStyle.bgHover]
    );

    return { backgroundColor };
  });

  // Combine all animated styles
  const combinedAnimStyle = useAnimatedStyle(() => {
    return {
      ...pressAnimStyle.value,
      ...hoverAnimStyle.value,
      ...backgroundAnimStyle.value,
    };
  });

  const buttonStyles: ViewStyle[] = [
    styles.base,
    {
      borderColor: variantStyle.border,
      paddingHorizontal: sizeStyle.paddingH,
      paddingVertical: sizeStyle.paddingV,
      minHeight: sizeStyle.minHeight,
      gap: sizeStyle.iconGap,
    },
    variant === 'secondary' && styles.secondaryBorder,
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    Platform.OS === 'web' && styles.webCursor,
    isDisabled && Platform.OS === 'web' && styles.webCursorDisabled,
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
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      disabled={isDisabled}
      style={[
        buttonStyles,
        pressAnimStyle,
        hoverAnimStyle,
        backgroundAnimStyle,
      ]}
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
    </AnimatedPressable>
  );
}

/**
 * Icon button variant - circular button for icon-only actions
 */
export function IconButton({
  icon,
  onPress,
  size = 'md',
  variant = 'ghost',
  disabled = false,
  style,
  testID,
  accessibilityLabel,
}: {
  icon: React.ReactNode;
  onPress: () => void;
  size?: ButtonSize;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel: string;
}) {
  const isDisabled = disabled;
  const variantStyle = VARIANT_STYLES[variant];

  const iconSizes = { sm: 32, md: 44, lg: 52 };
  const buttonSize = iconSizes[size];

  const { onPressIn, onPressOut, animatedStyleSimple } = usePlayfulPress({
    style: 'eager',
    haptics: Platform.OS !== 'web',
    disabled: isDisabled,
  });

  const handlePress = useCallback(() => {
    if (isDisabled) return;
    onPress();
  }, [isDisabled, onPress]);

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={isDisabled}
      style={[
        styles.iconButton,
        {
          width: buttonSize,
          height: buttonSize,
          backgroundColor: variantStyle.bg,
          borderColor: variantStyle.border,
        },
        isDisabled && styles.disabled,
        Platform.OS === 'web' && styles.webCursor,
        animatedStyleSimple,
        style,
      ]}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled }}
    >
      {icon}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
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
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  webCursor: {
    // @ts-ignore - web only
    cursor: 'pointer',
  },
  webCursorDisabled: {
    // @ts-ignore - web only
    cursor: 'not-allowed',
  },
});

export default Button;
