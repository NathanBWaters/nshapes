/**
 * Skeleton - Delightful loading placeholder component
 * Provides shimmering skeleton screens while content loads
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface SkeletonProps {
  /** Width of the skeleton (default: '100%') */
  width?: number | string;
  /** Height of the skeleton (default: 20) */
  height?: number;
  /** Border radius (default: 8) */
  borderRadius?: number;
  /** Custom style */
  style?: ViewStyle;
  /** Animation variant */
  variant?: 'shimmer' | 'pulse' | 'wave';
}

/**
 * Base skeleton component with shimmer animation
 */
export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = RADIUS.md,
  style,
  variant = 'shimmer',
}: SkeletonProps) {
  const prefersReducedMotion = useReducedMotion();
  const shimmerPosition = useSharedValue(0);
  const pulseOpacity = useSharedValue(0.3);

  useEffect(() => {
    if (prefersReducedMotion) {
      // Simple pulse for reduced motion
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 1000 }),
          withTiming(0.3, { duration: 1000 })
        ),
        -1,
        false
      );
    } else if (variant === 'shimmer' || variant === 'wave') {
      shimmerPosition.value = withRepeat(
        withTiming(1, {
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        false
      );
    } else {
      // Pulse animation
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 800 }),
          withTiming(0.3, { duration: 800 })
        ),
        -1,
        false
      );
    }
  }, [prefersReducedMotion, variant, shimmerPosition, pulseOpacity]);

  const shimmerStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      shimmerPosition.value,
      [0, 1],
      [-200, 200]
    );

    return {
      transform: [{ translateX }],
    };
  });

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  if (prefersReducedMotion || variant === 'pulse') {
    return (
      <Animated.View
        style={[
          styles.skeleton,
          { width, height, borderRadius },
          pulseStyle,
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.skeleton,
        { width, height, borderRadius, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View style={[styles.shimmerContainer, shimmerStyle]}>
        <LinearGradient
          colors={[
            'transparent',
            'rgba(255, 255, 255, 0.3)',
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );
}

/**
 * Skeleton for text lines
 */
export function SkeletonText({
  lines = 3,
  lineHeight = 16,
  lastLineWidth = '60%',
  spacing = SPACING.sm,
  style,
}: {
  lines?: number;
  lineHeight?: number;
  lastLineWidth?: number | string;
  spacing?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={style}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={lineHeight}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          style={{ marginBottom: index < lines - 1 ? spacing : 0 }}
        />
      ))}
    </View>
  );
}

/**
 * Skeleton for circular avatars/icons
 */
export function SkeletonCircle({
  size = 48,
  style,
}: {
  size?: number;
  style?: ViewStyle;
}) {
  return (
    <Skeleton
      width={size}
      height={size}
      borderRadius={size / 2}
      style={style}
    />
  );
}

/**
 * Skeleton for cards (weapon cards, character cards, etc.)
 */
export function SkeletonCard({
  width = 140,
  height = 180,
  style,
}: {
  width?: number;
  height?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.card, { width, height }, style]}>
      {/* Image area */}
      <Skeleton
        width="100%"
        height={height * 0.5}
        borderRadius={0}
        style={{ borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg }}
      />
      {/* Content area */}
      <View style={styles.cardContent}>
        <Skeleton width="80%" height={14} style={{ marginBottom: SPACING.xs }} />
        <Skeleton width="60%" height={12} style={{ marginBottom: SPACING.sm }} />
        <Skeleton width="40%" height={20} borderRadius={RADIUS.sm} />
      </View>
    </View>
  );
}

/**
 * Skeleton for game cards on the board
 */
export function SkeletonGameCard({
  size = 80,
  style,
}: {
  size?: number;
  style?: ViewStyle;
}) {
  return (
    <Skeleton
      width={size}
      height={size * 1.4}
      borderRadius={RADIUS.lg}
      style={style}
      variant="wave"
    />
  );
}

/**
 * Skeleton for weapon/inventory items
 */
export function SkeletonWeaponItem({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.weaponItem, style]}>
      <SkeletonCircle size={40} />
      <View style={styles.weaponItemContent}>
        <Skeleton width={100} height={14} style={{ marginBottom: SPACING.xs }} />
        <Skeleton width={60} height={12} />
      </View>
      <Skeleton width={50} height={24} borderRadius={RADIUS.sm} />
    </View>
  );
}

/**
 * Loading grid of skeleton cards
 */
export function SkeletonGrid({
  count = 6,
  columns = 3,
  itemWidth = 100,
  itemHeight = 140,
  gap = SPACING.md,
  style,
}: {
  count?: number;
  columns?: number;
  itemWidth?: number;
  itemHeight?: number;
  gap?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.grid, { gap }, style]}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          key={index}
          width={itemWidth}
          height={itemHeight}
          borderRadius={RADIUS.lg}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: COLORS.paperBeige,
  },
  shimmerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '200%',
  },
  shimmerGradient: {
    flex: 1,
    width: '50%',
  },
  card: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.paperBeige,
    overflow: 'hidden',
  },
  cardContent: {
    padding: SPACING.sm,
    flex: 1,
    justifyContent: 'flex-end',
  },
  weaponItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.paperBeige,
  },
  weaponItemContent: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
});

export default Skeleton;
