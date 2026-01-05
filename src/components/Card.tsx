import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import Svg, { Ellipse, Path, Polygon, Defs, Pattern, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { Card as CardType, Background } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import { BACKGROUND_COLORS } from '@/utils/gameConfig';
import { useBurnTimer } from '@/hooks/useBurnTimer';
import { EASING, DURATION, SHADOWS } from '@/utils/designSystem';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

// Debug: Track render counts per card (only in development)
const renderCounts = new Map<string, number>();
const DEBUG_RENDERS = __DEV__ && Platform.OS === 'web';

// SVG viewBox dimensions (1:2 width:height ratio)
const SVG_WIDTH = 20;
const SVG_HEIGHT = 40;
const STROKE_WIDTH = 2;

interface CardProps {
  card: CardType;
  onClick: (card: CardType) => void;
  disabled?: boolean;
  onBurnComplete?: (card: CardType) => void;
  isPaused?: boolean;
  isNew?: boolean; // Whether this card was just added to the board
  entryDelay?: number; // Stagger delay for entry animation in ms
  isIdle?: boolean; // Whether the game board is idle (for ambient breathing)
  breathingOffset?: number; // Stagger offset in ms for breathing animation
  isSuggestion?: boolean; // Whether this card is a subtle suggestion (after 10s idle)
}

const Card: React.FC<CardProps> = ({
  card,
  onClick,
  disabled = false,
  onBurnComplete,
  isPaused = false,
  isNew = false,
  entryDelay = 0,
  isIdle = false,
  breathingOffset = 0,
  isSuggestion = false,
}) => {
  const { shape, color, number, shading, selected, isHint } = card;

  // Animation values
  const scale = useSharedValue(isNew ? 0.8 : 1);
  const translateY = useSharedValue(isNew ? -50 : 0);
  const opacity = useSharedValue(isNew ? 0 : 1);
  const shadowRadius = useSharedValue(0);
  const holoShimmerPosition = useSharedValue(0);
  const fireFlicker = useSharedValue(0.7);
  const hoverGlow = useSharedValue(0); // Web-only hover glow
  const hintGlow = useSharedValue(0); // Hint blink animation

  // Entry animation for new cards
  useEffect(() => {
    if (isNew) {
      const timeout = setTimeout(() => {
        opacity.value = withTiming(1, { duration: DURATION.fast });
        scale.value = withSpring(1, {
          damping: EASING.bounce.friction,
          stiffness: EASING.bounce.tension,
        });
        translateY.value = withSpring(0, {
          damping: EASING.bounce.friction,
          stiffness: EASING.bounce.tension,
        });
      }, entryDelay);
      return () => clearTimeout(timeout);
    }
  }, [isNew, entryDelay, opacity, scale, translateY]);

  // Debug: Track renders
  if (DEBUG_RENDERS) {
    const count = (renderCounts.get(card.id) || 0) + 1;
    renderCounts.set(card.id, count);
    if (count > 1) {
      console.log(`[Card ${card.id}] render #${count}, selected=${selected}`);
    }
  }

  const handleBurnComplete = useCallback(() => {
    onBurnComplete?.(card);
  }, [onBurnComplete, card]);

  const fireProgress = useBurnTimer({
    isOnFire: card.onFire ?? false,
    fireStartTime: card.fireStartTime,
    isPaused,
    onComplete: handleBurnComplete,
  });


  // Hint blink animation - blinks twice when hint is shown
  useEffect(() => {
    if (isHint) {
      // Blink twice: on -> off -> on -> off -> stay on
      hintGlow.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(0.3, { duration: 150 }),
        withTiming(1, { duration: 150 }),
        withTiming(0.3, { duration: 150 }),
        withTiming(1, { duration: 150 })
      );
    } else {
      hintGlow.value = 0;
    }
  }, [isHint, hintGlow]);

  // Holographic shimmer animation
  useEffect(() => {
    if (card.isHolographic) {
      holoShimmerPosition.value = withRepeat(
        withTiming(1, { duration: 4000, easing: Easing.linear }),
        -1, // infinite
        false
      );
    } else {
      holoShimmerPosition.value = 0;
    }
  }, [card.isHolographic, holoShimmerPosition]);

  // Fire flicker animation
  useEffect(() => {
    if (card.onFire) {
      fireFlicker.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 100 + Math.random() * 50 }),
          withTiming(0.7, { duration: 100 + Math.random() * 50 })
        ),
        -1,
        true
      );
    } else {
      fireFlicker.value = 0.7;
    }
  }, [card.onFire, fireFlicker]);

  // Web-only hover handlers
  const handleHoverIn = useCallback(() => {
    if (Platform.OS !== 'web' || selected || disabled) return;
    hoverGlow.value = withTiming(1, { duration: DURATION.fast });
  }, [selected, disabled, hoverGlow]);

  const handleHoverOut = useCallback(() => {
    if (Platform.OS !== 'web') return;
    hoverGlow.value = withTiming(0, { duration: DURATION.fast });
  }, [hoverGlow]);

  // Animated style for the card
  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
    shadowRadius: shadowRadius.value + hoverGlow.value * 4,
    shadowOpacity: 0.1,
    opacity: opacity.value,
  }));

  // Holographic border animation
  const holoStyle = useAnimatedStyle(() => {
    if (!card.isHolographic) return {};

    const borderColor = interpolateColor(
      holoShimmerPosition.value,
      [0, 0.17, 0.33, 0.5, 0.67, 0.83, 1],
      ['#A855F7', '#3B82F6', '#06B6D4', '#10B981', '#FACC15', '#EF4444', '#A855F7']
    );

    return {
      borderColor,
    };
  });

  // Fire flicker style
  const fireStyle = useAnimatedStyle(() => {
    if (!card.onFire) return {};

    return {
      shadowOpacity: fireFlicker.value,
    };
  });

  // Hint glow style - pulses the shadow/glow effect
  const hintStyle = useAnimatedStyle(() => {
    if (!isHint) return {};

    return {
      shadowOpacity: hintGlow.value * 0.8,
      shadowRadius: 8 + hintGlow.value * 4,
    };
  });

  // NOTE: Multi-hit cards (health > 1) are not currently used in gameplay.
  // Keeping this code for potential future use.
  const hasModifiers = card.health !== undefined && card.health > 1;

  // Get shape component based on shape type
  const getShapeComponent = () => {
    switch (shape) {
      case 'oval':
        return <Oval color={color} shading={shading} background={card.background} />;
      case 'squiggle':
        return <Squiggle color={color} shading={shading} background={card.background} />;
      case 'diamond':
        return <Diamond color={color} shading={shading} background={card.background} />;
      default:
        return null;
    }
  };

  // Render the appropriate number of shapes
  const shapes = [];
  for (let i = 0; i < number; i++) {
    shapes.push(
      <View key={i} style={styles.shapeContainer}>
        {getShapeComponent()}
      </View>
    );
  }

  // Get card styles
  const getCardStyle = () => {
    const cardStyles: any[] = [
      styles.card,
      { backgroundColor: getCardBackgroundColor(card.background) }
    ];

    if (card.isHolographic) {
      cardStyles.push(styles.holographic);
    }

    if (card.onFire) {
      cardStyles.push(styles.onFire);
    }

    if (selected) {
      cardStyles.push(styles.selected);
    }

    if (isHint) {
      cardStyles.push(styles.hint);
    }

    if (disabled) {
      cardStyles.push(styles.disabled);
    }

    return cardStyles;
  };

  // NOTE: Health badge for multi-hit cards - not currently used in gameplay.
  // Keeping for potential future use.
  const getModifierBadge = () => {
    if (!hasModifiers) return null;

    if (card.health && card.health > 1) {
      return (
        <View style={[styles.badge, styles.badgeTopRight, { backgroundColor: COLORS.impactRed }]}>
          <Text style={styles.badgeText}>{card.health}</Text>
        </View>
      );
    }

    return null;
  };

  // Web cursor style - applied separately to avoid TypeScript issues with reanimated
  const webCursorStyle = Platform.OS === 'web'
    ? { cursor: disabled ? 'default' : 'pointer' } as any
    : undefined;

  return (
    <AnimatedTouchableOpacity
      testID={`card-${shape}-${color}-${number}-${shading}`}
      style={[
        getCardStyle(),
        animatedCardStyle,
        card.isHolographic && holoStyle,
        card.onFire && fireStyle,
        isHint && hintStyle,
        webCursorStyle,
      ]}
      onPress={() => !disabled && onClick(card)}
      disabled={disabled}
      activeOpacity={0.9}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      // @ts-ignore - onHoverIn/Out are web-only props
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
    >
      {getModifierBadge()}

      <View nativeID="card-shapes" style={styles.shapesContainer}>
        {shapes}
      </View>

      {/* Fire overlay - progressive darkening at edges */}
      {card.onFire && (
        <Animated.View
          style={[
            styles.fireOverlay,
            {
              borderColor: `rgba(239, 68, 68, ${0.5 + fireProgress * 0.5})`,
              backgroundColor: `rgba(0, 0, 0, ${fireProgress * 0.4})`,
            }
          ]}
          pointerEvents="none"
        />
      )}
    </AnimatedTouchableOpacity>
  );
};

// Shape components
interface ShapeProps {
  color: string;
  shading: string;
  background?: Background;
}

const getBorderColor = (color: string) => {
  switch (color) {
    case 'red': return COLORS.impactRed;
    case 'green': return COLORS.logicTeal;
    case 'purple': return '#7C3AED';
    default: return COLORS.slateCharcoal;
  }
};

// Get lightened colors for charcoal background (better contrast)
const getLightColor = (color: string) => {
  switch (color) {
    case 'red': return '#FF9999';
    case 'green': return '#66CCBB';
    case 'purple': return '#B39DDB';
    default: return COLORS.canvasWhite;
  }
};

// Get the appropriate shape color based on background
const getShapeColor = (color: string, background?: Background) => {
  if (background === 'charcoal') {
    return getLightColor(color);
  }
  return getBorderColor(color);
};

// Get the card background color
const getCardBackgroundColor = (background?: Background) => {
  if (!background || background === 'white') {
    return COLORS.canvasWhite;
  }
  return BACKGROUND_COLORS[background];
};

// Stripe pattern for "striped" shading
const StripesPattern: React.FC<{ id: string; color: string }> = ({ id, color }) => (
  <Defs>
    <Pattern id={id} patternUnits="userSpaceOnUse" width="4" height="4">
      <Rect x="0" y="0" width="4" height="2" fill={color} />
    </Pattern>
  </Defs>
);

const getFill = (color: string, shading: string, patternId: string, background?: Background) => {
  if (shading === 'solid') return getShapeColor(color, background);
  if (shading === 'striped') return `url(#${patternId})`;
  return 'transparent';
};

const Oval: React.FC<ShapeProps> = ({ color, shading, background }) => {
  const strokeColor = getShapeColor(color, background);
  const patternId = `stripes-oval-${color}-${background || 'white'}`;
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {shading === 'striped' && <StripesPattern id={patternId} color={strokeColor} />}
      <Ellipse
        cx={SVG_WIDTH / 2}
        cy={SVG_HEIGHT / 2}
        rx={(SVG_WIDTH - STROKE_WIDTH) / 2}
        ry={(SVG_HEIGHT - STROKE_WIDTH) / 2}
        stroke={strokeColor}
        strokeWidth={STROKE_WIDTH}
        fill={getFill(color, shading, patternId, background)}
      />
    </Svg>
  );
};

const Diamond: React.FC<ShapeProps> = ({ color, shading, background }) => {
  const strokeColor = getShapeColor(color, background);
  const patternId = `stripes-diamond-${color}-${background || 'white'}`;
  // Diamond points: top, right, bottom, left
  const points = `${SVG_WIDTH / 2},${STROKE_WIDTH} ${SVG_WIDTH - STROKE_WIDTH},${SVG_HEIGHT / 2} ${SVG_WIDTH / 2},${SVG_HEIGHT - STROKE_WIDTH} ${STROKE_WIDTH},${SVG_HEIGHT / 2}`;
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {shading === 'striped' && <StripesPattern id={patternId} color={strokeColor} />}
      <Polygon
        points={points}
        stroke={strokeColor}
        strokeWidth={STROKE_WIDTH}
        fill={getFill(color, shading, patternId, background)}
      />
    </Svg>
  );
};

const Squiggle: React.FC<ShapeProps> = ({ color, shading, background }) => {
  const strokeColor = getShapeColor(color, background);
  const patternId = `stripes-squiggle-${color}-${background || 'white'}`;
  // S-curve squiggle path (scaled for 20x40 viewBox)
  const d = `
    M 3,5
    C 0,10 0,17 6,20
    C 12,23 12,30 9,35
    Q 7,38 10,39
    C 13,38 13,36 11,35
    C 8,31 8,25 14,20
    C 20,15 20,10 17,5
    Q 15,2 12,2
    Q 6,2 3,5
    Z
  `;
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {shading === 'striped' && <StripesPattern id={patternId} color={strokeColor} />}
      <Path
        d={d}
        stroke={strokeColor}
        strokeWidth={STROKE_WIDTH}
        fill={getFill(color, shading, patternId, background)}
      />
    </Svg>
  );
};

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    borderRadius: RADIUS.module,
    // Use consistent borderWidth to prevent Safari flex layout recalculation on selection
    borderWidth: 3,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.canvasWhite,
    flex: 1,
    // Minimum touch target size for accessibility (48x48)
    minWidth: 48,
    minHeight: 48,
    // Base shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selected: {
    borderColor: COLORS.actionYellow,
    // borderWidth removed - now using consistent 3px border
    shadowColor: COLORS.actionYellow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    elevation: 8,
  },
  hint: {
    backgroundColor: '#FFFDE7',
    borderColor: COLORS.actionYellow,
    borderStyle: 'dashed',
    shadowColor: COLORS.actionYellow,
    shadowOffset: { width: 0, height: 0 },
  },
  holographic: {
    borderColor: '#A855F7', // Purple/rainbow shimmer
    // borderWidth now consistent at 3px in base card style
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
    backgroundColor: '#FEFCE8', // Slight golden tint
  },
  onFire: {
    borderColor: '#EF4444', // Red fire border
    // borderWidth now consistent at 3px in base card style
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
    backgroundColor: '#FEF2F2', // Slight red tint
  },
  fireOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RADIUS.module,
    borderWidth: 6,
  },
  disabled: {
    opacity: 0.6,
  },
  shapeContainer: {
    height: '80%',
    width: '28%', // Sized to fit 3 shapes with spacing
    alignItems: 'center',
    justifyContent: 'center',
  },
  shapesContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
  },
  badge: {
    position: 'absolute',
    borderRadius: RADIUS.button,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  badgeTopRight: {
    top: 2,
    right: 2,
  },
  badgeTopLeft: {
    top: 2,
    left: 2,
  },
  badgeBottomRight: {
    bottom: 2,
    right: 2,
  },
  badgeBottomLeft: {
    bottom: 2,
    left: 2,
  },
  badgeText: {
    color: COLORS.canvasWhite,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  badgeEmoji: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.canvasWhite,
  },
});

export default Card;
