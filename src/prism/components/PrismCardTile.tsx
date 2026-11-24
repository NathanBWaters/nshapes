import React, { memo, useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Ellipse, Path, Polygon } from 'react-native-svg';
import Icon from '@/components/Icon';
import { ColorblindStorage } from '@/utils/storage';
import { SPRING } from '@/utils/motion';
import { isCardWild } from '../data/cards';
import type { CardEdition, PrismCard, PrismColor, PrismShape } from '../types';
import {
  PRISM_COLORBLIND_LETTER,
  PRISM_COLORS,
  editionMeta,
  getPrismShapeColor,
} from './prismTheme';

export interface PrismCardTileProps {
  card: PrismCard;
  selected?: boolean;
  disabled?: boolean;
  debuffed?: boolean;
  hidden?: boolean;
  isChest?: boolean;
  chestBonus?: number;
  hotkeyLabel?: string; // e.g. '1'..'9','0','-','=' shown subtly on desktop web
  highlightTarget?: boolean; // when spell targeting mode is active
  compact?: boolean;
  /** Mobile board density: crisp ~72px card height so 4 rows fit above the fold on 375×667. */
  dense?: boolean;
  onPress?: () => void;
  testID?: string;
  // Optional board indicators (non-breaking additions beyond shared contract)
  isMagnetMarked?: boolean;
  isMirrorSlot?: boolean;
  isBlueprintMatch?: boolean;
  colorblindOverride?: boolean;
  /** Play a crisp deal-in entrance spring when a fresh card arrives mid-Blind. */
  animateDeal?: boolean;
}

const getColorblindSafe = (): boolean =>
  typeof ColorblindStorage?.get === 'function' ? ColorblindStorage.get() : false;

const subscribeColorblindSafe = (onStoreChange: () => void): (() => void) =>
  typeof ColorblindStorage?.subscribe === 'function'
    ? ColorblindStorage.subscribe(() => onStoreChange())
    : () => {};

const canHoverWeb = (): boolean => {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
};

// Exact 20x40 viewBox & mathematically verified smooth S-curve squiggle from src/components/Card.tsx
const SVG_WIDTH = 20;
const SVG_HEIGHT = 40;
const STROKE_WIDTH = 1.8;
const SQUIGGLE_PATH =
  'M 14.2,2.4 ' +
  'C 17.8,3.8 12.2,9.2 12,14 ' +
  'C 11.8,18.8 17.4,22.3 17.6,27.5 ' +
  'C 17.8,32.7 9.4,39 5.8,37.6 ' +
  'C 2.2,36.2 7.8,30.8 8,26 ' +
  'C 8.2,21.2 2.6,17.7 2.4,12.5 ' +
  'C 2.2,7.3 10.6,1 14.2,2.4 Z';

const PrismShapeSvg: React.FC<{
  shape: PrismShape;
  color: PrismColor;
  colorblind: boolean;
}> = memo(function PrismShapeSvg({ shape, color, colorblind }) {
  const fill = getPrismShapeColor(color, colorblind);
  const stroke = fill;

  if (shape === 'oval') {
    return (
      <Svg width="100%" height="100%" viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} preserveAspectRatio="xMidYMid meet">
        <Ellipse
          cx={SVG_WIDTH / 2}
          cy={SVG_HEIGHT / 2}
          rx={(SVG_WIDTH - STROKE_WIDTH) / 2}
          ry={(SVG_HEIGHT - STROKE_WIDTH) / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={STROKE_WIDTH}
        />
      </Svg>
    );
  }

  if (shape === 'diamond') {
    const points = `${SVG_WIDTH / 2},${STROKE_WIDTH} ${SVG_WIDTH - STROKE_WIDTH},${SVG_HEIGHT / 2} ${SVG_WIDTH / 2},${SVG_HEIGHT - STROKE_WIDTH} ${STROKE_WIDTH},${SVG_HEIGHT / 2}`;
    return (
      <Svg width="100%" height="100%" viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} preserveAspectRatio="xMidYMid meet">
        <Polygon
          points={points}
          fill={fill}
          stroke={stroke}
          strokeWidth={STROKE_WIDTH}
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} preserveAspectRatio="xMidYMid meet">
      <Path
        d={SQUIGGLE_PATH}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
});

const getEditionCardSurface = (edition: CardEdition, tempWild?: boolean): {
  bg: string;
  border: string;
  stripe: readonly string[] | null;
} => {
  const eff: CardEdition = edition !== 'none' ? edition : tempWild ? 'wild' : 'none';
  switch (eff) {
    case 'foil':
      return { bg: '#EDF8FF', border: '#38BDF8', stripe: ['#0EA5E9', '#7DD3FC', '#38BDF8'] };
    case 'holo':
      return { bg: '#FFF0F7', border: '#EC4899', stripe: ['#F43F5E', '#EC4899', '#F472B6'] };
    case 'poly':
      return { bg: '#F7F1FF', border: '#A855F7', stripe: ['#F43F5E', '#F2C94C', '#38BDF8', '#A855F7'] };
    case 'glass':
      return { bg: '#E3F8FC', border: '#06B6D4', stripe: ['#67E8F9', '#CFFAFE', '#06B6D4'] };
    case 'gold':
      return { bg: '#FEF9E1', border: '#D97706', stripe: ['#F59E0B', '#FDE68A', '#D97706'] };
    case 'wild':
      return { bg: '#EDFCF9', border: '#16AA98', stripe: ['#F43F5E', '#16AA98', '#7C3AED', '#F2C94C'] };
    case 'none':
    default:
      return { bg: PRISM_COLORS.cardWhite, border: PRISM_COLORS.cardBorder, stripe: null };
  }
};

const EDITION_SHORT_BONUS: Partial<Record<CardEdition, string>> = {
  foil: 'FOIL +50C',
  holo: 'HOLO +10M',
  poly: 'POLY ×1.5',
  glass: 'GLASS ×2',
  gold: 'GOLD +$3',
  wild: 'WILD',
};

const PrismCardTile: React.FC<PrismCardTileProps> = memo(function PrismCardTile({
  card,
  selected = false,
  disabled = false,
  debuffed = false,
  hidden = false,
  isChest = false,
  chestBonus,
  hotkeyLabel,
  highlightTarget = false,
  compact = false,
  dense = false,
  onPress,
  testID,
  isMagnetMarked = false,
  isMirrorSlot = false,
  isBlueprintMatch = false,
  colorblindOverride,
  animateDeal = false,
}) {
  const storedColorblind = useSyncExternalStore(
    subscribeColorblindSafe,
    getColorblindSafe,
    getColorblindSafe
  );
  const colorblind = colorblindOverride ?? storedColorblind;

  const [hovered, setHovered] = useState(false);

  // Tactile GPU-only lift + deal-in spring animations (finite springs, zero infinite loops)
  const dealScale = useSharedValue(animateDeal ? 0.84 : 1);
  const dealY = useSharedValue(animateDeal ? -10 : 0);
  const dealOpacity = useSharedValue(animateDeal ? 0.45 : 1);
  const liftY = useSharedValue(selected ? (compact ? -4 : dense ? -4 : -7) : 0);
  const scale = useSharedValue(selected ? 1.03 : 1);

  useEffect(() => {
    if (!animateDeal) return;
    dealScale.value = withSpring(1, SPRING.snappy);
    dealY.value = withSpring(0, SPRING.snappy);
    dealOpacity.value = withSpring(1, SPRING.snappy);
    // Run only on fresh card mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const targetY = selected ? (compact ? -4 : dense ? -4 : -7) : hovered ? -2 : 0;
    const targetScale = selected ? 1.03 : hovered ? 1.015 : 1;
    liftY.value = withSpring(targetY, SPRING.snappy);
    scale.value = withSpring(targetScale, SPRING.snappy);
  }, [selected, hovered, compact, dense, liftY, scale]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: dealOpacity.value,
    transform: [
      { translateY: liftY.value + dealY.value },
      { scale: scale.value * dealScale.value },
    ],
  }));

  const wild = isCardWild(card);
  const effectiveEdition: CardEdition = card.edition !== 'none' ? card.edition : card.tempWild ? 'wild' : 'none';
  const surface = getEditionCardSurface(card.edition, card.tempWild);
  const edMeta = editionMeta(effectiveEdition);
  const shapeColor = getPrismShapeColor(card.color, colorblind);

  const webCursor =
    Platform.OS === 'web'
      ? ({ cursor: disabled || !onPress ? 'auto' : 'pointer' } as const)
      : undefined;

  const borderColor = selected
    ? PRISM_COLORS.gold
    : highlightTarget
      ? PRISM_COLORS.utilityTeal
      : isBlueprintMatch
        ? PRISM_COLORS.gold
        : debuffed
          ? PRISM_COLORS.danger
          : surface.border;

  const a11yLabel = hidden
    ? 'Hidden card'
    : `${wild ? 'Wild' : `${card.number} ${card.color} ${card.shape}`}${effectiveEdition !== 'none' ? `, ${edMeta.label}` : ''}${debuffed ? ', debuffed' : ''}${selected ? ', selected' : ''}`;

  const shapeWidth = compact ? 14 : dense ? 19 : 22;
  const shapeHeight = compact ? 28 : dense ? 38 : 44;

  return (
    <Animated.View style={[styles.outerWrap, animStyle]}>
      <TouchableOpacity
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={{ selected, disabled: disabled || !onPress }}
        activeOpacity={0.92}
        disabled={disabled || !onPress}
        onPress={onPress}
        // @ts-ignore - web hover callbacks
        onHoverIn={() => {
          if (canHoverWeb() && !disabled && onPress) setHovered(true);
        }}
        onHoverOut={() => setHovered(false)}
        style={[
          styles.card,
          compact ? styles.cardCompact : dense ? styles.cardDense : styles.cardNormal,
          {
            backgroundColor: hidden ? PRISM_COLORS.feltElevated : surface.bg,
            borderColor,
            borderWidth: selected || highlightTarget ? 3 : 2,
          },
          selected && styles.cardSelectedShadow,
          highlightTarget && styles.cardTargetShadow,
          effectiveEdition === 'glass' && !hidden && styles.glassSurface,
          disabled && !compact && styles.cardDisabled,
          webCursor,
        ]}
      >
        {hidden ? (
          <View style={styles.hiddenBack}>
            <View style={styles.hiddenInnerFrame}>
              <Icon name="delapouite/prism" size={compact ? 22 : 30} color={PRISM_COLORS.gold} noShadow />
              <Text style={[styles.hiddenQuestion, compact && styles.hiddenQuestionCompact]}>?</Text>
            </View>
          </View>
        ) : (
          <>
            {/* Prismatic / Edition top shimmer ribbon */}
            {surface.stripe && (
              <View style={styles.editionStripeRow} pointerEvents="none">
                {surface.stripe.map((segColor, idx) => (
                  <View key={idx} style={[styles.editionStripeSeg, { backgroundColor: segColor }]} />
                ))}
              </View>
            )}

            {/* Glass diagonal glint */}
            {effectiveEdition === 'glass' && (
              <View style={styles.glassSheen} pointerEvents="none" />
            )}

            {/* Foil subtle sheen bar */}
            {effectiveEdition === 'foil' && (
              <View style={styles.foilSheen} pointerEvents="none" />
            )}

            {/* Gold double hairline frame */}
            {effectiveEdition === 'gold' && (
              <View style={styles.goldInnerRim} pointerEvents="none" />
            )}

            {/* Top-left: Desktop hotkey cap OR selection check */}
            {hotkeyLabel && !compact && (
              <View style={[styles.hotkeyBadge, selected && styles.hotkeyBadgeSelected]} pointerEvents="none">
                <Text style={[styles.hotkeyText, selected && styles.hotkeyTextSelected]}>{hotkeyLabel}</Text>
              </View>
            )}

            {/* Top-right: Colorblind R/B/P letter OR Blueprint hint spark OR Target tag */}
            <View style={styles.topRightRow} pointerEvents="none">
              {isBlueprintMatch && !selected && !compact && (
                <View style={styles.blueprintPip}>
                  <Icon name="lorc/light-bulb" size={11} color="#121212" noShadow />
                </View>
              )}
              {highlightTarget && !compact && (
                <View style={styles.targetPip}>
                  <Text style={styles.targetPipText}>CAST</Text>
                </View>
              )}
              {colorblind && !wild && (
                <View
                  testID={testID ? `${testID}-cb` : undefined}
                  style={[styles.cbBadge, { borderColor: shapeColor }]}
                >
                  <Text style={[styles.cbText, { color: shapeColor }]}>
                    {PRISM_COLORBLIND_LETTER[card.color]}
                  </Text>
                </View>
              )}
            </View>

            {/* Center: 1/2/3 Shapes or Wild Emblem */}
            <View style={[styles.shapesRow, debuffed && styles.shapesDebuffed]} pointerEvents="none">
              {wild ? (
                <View style={styles.wildWrap}>
                  <Icon
                    name="delapouite/card-joker"
                    size={compact ? 22 : 32}
                    color="#0F766E"
                    noShadow
                  />
                  <Text style={[styles.wildTitle, compact && styles.wildTitleCompact]}>
                    {card.tempWild && card.edition === 'none' ? 'WILD*' : 'WILD'}
                  </Text>
                </View>
              ) : (
                Array.from({ length: card.number }).map((_, idx) => (
                  <View
                    key={idx}
                    style={[styles.shapeSlot, { width: shapeWidth, height: shapeHeight }]}
                  >
                    <PrismShapeSvg shape={card.shape} color={card.color} colorblind={colorblind} />
                  </View>
                ))
              )}
            </View>

            {/* Bottom badge tray: Edition pill, Magnet/Mirror pips, Chest bonus */}
            <View style={styles.bottomRow} pointerEvents="none">
              <View style={styles.bottomLeftGroup}>
                {isMagnetMarked && !compact && (
                  <View style={styles.magnetPip}>
                    <Icon name="lorc/magnet" size={11} color="#FFFFFF" noShadow />
                  </View>
                )}
                {isMirrorSlot && !compact && (
                  <View style={styles.mirrorPip}>
                    <Icon name="lorc/mirror-mirror" size={11} color="#0369A1" noShadow />
                  </View>
                )}
                {effectiveEdition !== 'none' && (
                  <View
                    style={[
                      styles.editionPill,
                      {
                        backgroundColor: edMeta.color,
                      },
                    ]}
                  >
                    {effectiveEdition === 'glass' && (
                      <Icon name="lorc/shattered-glass" size={compact ? 8 : 10} color="#082F49" noShadow />
                    )}
                    {effectiveEdition === 'wild' && (
                      <Icon name="lorc/rainbow-star" size={compact ? 8 : 10} color="#042F2E" noShadow />
                    )}
                    <Text
                      style={[
                        styles.editionPillText,
                        compact && styles.editionPillTextCompact,
                        (effectiveEdition === 'gold' || effectiveEdition === 'foil' || effectiveEdition === 'glass' || effectiveEdition === 'wild') &&
                          styles.editionPillTextDark,
                      ]}
                      numberOfLines={1}
                    >
                      {compact
                        ? edMeta.short
                        : EDITION_SHORT_BONUS[effectiveEdition] ?? edMeta.short}
                    </Text>
                  </View>
                )}
              </View>

              {isChest && (
                <View style={styles.chestPill}>
                  <Icon name="delapouite/mimic-chest" size={compact ? 9 : 11} color="#451A03" noShadow />
                  <Text style={[styles.chestText, compact && styles.chestTextCompact]}>
                    {chestBonus !== undefined ? `+$${chestBonus}` : 'VAULT'}
                  </Text>
                </View>
              )}
            </View>

            {/* Boss Debuffed overlay badge */}
            {debuffed && (
              <View style={styles.debuffedOverlay} pointerEvents="none">
                <View style={styles.debuffedBadge}>
                  <Icon name="lorc/cross-mark" size={11} color="#FFFFFF" noShadow />
                  <Text style={styles.debuffedText}>DEBUFFED</Text>
                </View>
              </View>
            )}
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  outerWrap: {
    width: '100%',
  },
  card: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 4,
  },
  cardNormal: {
    minHeight: 82,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  cardDense: {
    minHeight: 72,
    paddingHorizontal: 4,
    paddingVertical: 5,
    borderRadius: 10,
    borderBottomWidth: 3,
  },
  cardCompact: {
    minHeight: 56,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 8,
    borderBottomWidth: 3,
  },
  cardSelectedShadow: {
    shadowColor: PRISM_COLORS.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  cardTargetShadow: {
    shadowColor: PRISM_COLORS.utilityTeal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  cardDisabled: {
    opacity: 0.72,
  },
  glassSurface: {
    opacity: 0.94,
  },
  editionStripeRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    flexDirection: 'row',
  },
  editionStripeSeg: {
    flex: 1,
  },
  glassSheen: {
    position: 'absolute',
    top: -12,
    right: -14,
    width: 46,
    height: 110,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    transform: [{ rotate: '24deg' }],
  },
  foilSheen: {
    position: 'absolute',
    top: -10,
    left: '30%',
    width: 22,
    height: 120,
    backgroundColor: 'rgba(125, 211, 252, 0.25)',
    transform: [{ rotate: '18deg' }],
  },
  goldInnerRim: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.35)',
  },
  hotkeyBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    minWidth: 18,
    height: 18,
    borderRadius: 4,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(11, 31, 25, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotkeyBadgeSelected: {
    backgroundColor: PRISM_COLORS.gold,
  },
  hotkeyText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#334155',
  },
  hotkeyTextSelected: {
    color: '#121212',
  },
  topRightRow: {
    position: 'absolute',
    top: 5,
    right: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  blueprintPip: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: PRISM_COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetPip: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: '#0F766E',
  },
  targetPipText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  cbBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cbText: {
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
  },
  shapesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  shapesDebuffed: {
    opacity: 0.35,
  },
  shapeSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wildWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  wildTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0F766E',
    letterSpacing: 1,
  },
  wildTitleCompact: {
    fontSize: 9,
  },
  bottomRow: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  bottomLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
  },
  magnetPip: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mirrorPip: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    flexShrink: 1,
  },
  editionPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  editionPillTextCompact: {
    fontSize: 8,
  },
  editionPillTextDark: {
    color: '#0B1F19',
  },
  chestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: PRISM_COLORS.gold,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  chestText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#451A03',
  },
  chestTextCompact: {
    fontSize: 8,
  },
  debuffedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127, 29, 29, 0.14)',
  },
  debuffedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(185, 28, 28, 0.92)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  debuffedText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  hiddenBack: {
    width: '100%',
    height: '100%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  hiddenInnerFrame: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.goldDark,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  hiddenQuestion: {
    fontSize: 13,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
  },
  hiddenQuestionCompact: {
    fontSize: 11,
  },
});

export default PrismCardTile;
