/**
 * Badge - Multi-purpose badge component
 * For rarity indicators, counts, prices, and status labels
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { COLORS, RADIUS, SPACING, FONT_WEIGHTS, getRarityColor, getRarityBackground } from '../../theme';

type BadgeVariant = 'default' | 'rarity' | 'price' | 'count' | 'status' | 'free';
type BadgeSize = 'sm' | 'md' | 'lg';
type StatusType = 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  /** Badge content (text or number) */
  children: React.ReactNode;
  /** Badge style variant */
  variant?: BadgeVariant;
  /** Badge size */
  size?: BadgeSize;
  /** Rarity type (for rarity variant) */
  rarity?: 'common' | 'rare' | 'legendary';
  /** Status type (for status variant) */
  status?: StatusType;
  /** Icon to show before content */
  icon?: React.ReactNode;
  /** Custom container style */
  style?: ViewStyle;
  /** Custom text style */
  textStyle?: TextStyle;
}

const SIZE_STYLES: Record<BadgeSize, { paddingH: number; paddingV: number; fontSize: number; minHeight: number }> = {
  sm: { paddingH: SPACING.xs, paddingV: 2, fontSize: 10, minHeight: 18 },
  md: { paddingH: SPACING.sm, paddingV: SPACING.xs, fontSize: 12, minHeight: 24 },
  lg: { paddingH: SPACING.md, paddingV: SPACING.sm, fontSize: 14, minHeight: 32 },
};

const STATUS_COLORS: Record<StatusType, { bg: string; text: string }> = {
  success: { bg: '#DCFCE7', text: COLORS.logicTeal },
  warning: { bg: '#FEF3C7', text: '#D97706' },
  error: { bg: '#FEE2E2', text: COLORS.impactRed },
  info: { bg: COLORS.paperBeige, text: COLORS.slateCharcoal },
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  rarity,
  status,
  icon,
  style,
  textStyle,
}: BadgeProps) {
  const sizeStyle = SIZE_STYLES[size];

  // Determine colors based on variant
  let backgroundColor = COLORS.paperBeige;
  let textColor = COLORS.slateCharcoal;
  let borderColor: string | undefined;

  switch (variant) {
    case 'rarity':
      if (rarity) {
        backgroundColor = getRarityBackground(rarity);
        textColor = getRarityColor(rarity);
        borderColor = getRarityColor(rarity);
      }
      break;

    case 'price':
      backgroundColor = COLORS.actionYellow;
      textColor = COLORS.slateCharcoal;
      break;

    case 'count':
      backgroundColor = COLORS.slateCharcoal;
      textColor = COLORS.canvasWhite;
      break;

    case 'status':
      if (status) {
        backgroundColor = STATUS_COLORS[status].bg;
        textColor = STATUS_COLORS[status].text;
      }
      break;

    case 'free':
      backgroundColor = COLORS.logicTeal;
      textColor = COLORS.canvasWhite;
      break;

    case 'default':
    default:
      break;
  }

  const containerStyles: ViewStyle[] = [
    styles.base,
    {
      backgroundColor,
      paddingHorizontal: sizeStyle.paddingH,
      paddingVertical: sizeStyle.paddingV,
      minHeight: sizeStyle.minHeight,
    },
    borderColor ? { borderWidth: 1, borderColor } : undefined,
    style,
  ].filter(Boolean) as ViewStyle[];

  const labelStyles: TextStyle[] = [
    styles.text,
    {
      color: textColor,
      fontSize: sizeStyle.fontSize,
    },
    textStyle,
  ];

  return (
    <View style={containerStyles}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text style={labelStyles}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

/**
 * Specialized rarity badge
 */
export function RarityBadge({
  rarity,
  showLabel = true,
  size = 'sm',
  style,
}: {
  rarity: 'common' | 'rare' | 'legendary';
  showLabel?: boolean;
  size?: BadgeSize;
  style?: ViewStyle;
}) {
  const label = rarity.charAt(0).toUpperCase() + rarity.slice(1);

  return (
    <Badge variant="rarity" rarity={rarity} size={size} style={style}>
      {showLabel ? label : ''}
    </Badge>
  );
}

/**
 * Specialized price badge
 */
export function PriceBadge({
  price,
  size = 'md',
  style,
}: {
  price: number;
  size?: BadgeSize;
  style?: ViewStyle;
}) {
  return (
    <Badge variant="price" size={size} style={style}>
      ${price}
    </Badge>
  );
}

/**
 * Specialized count badge (for inventory quantities)
 */
export function CountBadge({
  count,
  size = 'sm',
  style,
}: {
  count: number;
  size?: BadgeSize;
  style?: ViewStyle;
}) {
  if (count <= 1) return null;

  return (
    <Badge variant="count" size={size} style={[styles.countBadge, style]}>
      x{count}
    </Badge>
  );
}

/**
 * FREE badge for level up rewards
 */
export function FreeBadge({ size = 'sm', style }: { size?: BadgeSize; style?: ViewStyle }) {
  return (
    <Badge variant="free" size={size} style={style}>
      FREE
    </Badge>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
    gap: SPACING.xxs,
  },
  text: {
    fontWeight: FONT_WEIGHTS.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconContainer: {
    marginRight: SPACING.xxs,
  },
  countBadge: {
    minWidth: 24,
    borderRadius: RADIUS.full,
  },
});

export default Badge;
