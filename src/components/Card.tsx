import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Ellipse, Path, Polygon, Defs, Pattern, Rect } from 'react-native-svg';
import { Card as CardType, Background } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import { BACKGROUND_COLORS } from '@/utils/gameConfig';

// SVG viewBox dimensions (1:2 width:height ratio)
const SVG_WIDTH = 20;
const SVG_HEIGHT = 40;
const STROKE_WIDTH = 2;

interface CardProps {
  card: CardType;
  onClick: (card: CardType) => void;
  disabled?: boolean;
}

const Card: React.FC<CardProps> = ({ card, onClick, disabled = false }) => {
  const { shape, color, number, shading, selected, isHint } = card;

  // Handle card modifiers
  const hasModifiers = card.health !== undefined && card.health > 1 ||
                      card.lootBox ||
                      card.bonusMoney ||
                      card.bonusPoints ||
                      card.fireStarter ||
                      card.bomb ||
                      card.healing ||
                      card.spikes ||
                      card.isDud ||
                      card.isFragile ||
                      card.boobyTrap ||
                      card.clover ||
                      card.cardClear ||
                      card.broom ||
                      card.selfHealing ||
                      card.timedReward;

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

    if (selected) {
      cardStyles.push(styles.selected);
    }

    if (isHint) {
      cardStyles.push(styles.hint);
    }

    if (disabled || card.isDud) {
      cardStyles.push(styles.disabled);
    }

    return cardStyles;
  };

  // Get modifier badges
  const getModifierBadge = () => {
    if (!hasModifiers) return null;

    const badges = [];

    if (card.health && card.health > 1) {
      badges.push(
        <View key="health" style={[styles.badge, styles.badgeTopRight, { backgroundColor: COLORS.impactRed }]}>
          <Text style={styles.badgeText}>{card.health}</Text>
        </View>
      );
    }

    if (card.lootBox) {
      badges.push(
        <View key="loot" style={[styles.badge, styles.badgeTopLeft, { backgroundColor: COLORS.impactOrange }]}>
          <Text style={styles.badgeEmoji}>?</Text>
        </View>
      );
    }

    if (card.bonusMoney) {
      badges.push(
        <View key="money" style={[styles.badge, styles.badgeBottomLeft, { backgroundColor: COLORS.logicTeal }]}>
          <Text style={styles.badgeText}>+{card.bonusMoney}$</Text>
        </View>
      );
    }

    if (card.bonusPoints) {
      badges.push(
        <View key="points" style={[styles.badge, styles.badgeBottomRight, { backgroundColor: COLORS.actionYellow }]}>
          <Text style={[styles.badgeText, { color: COLORS.deepOnyx }]}>+{card.bonusPoints}</Text>
        </View>
      );
    }

    return badges;
  };

  return (
    <TouchableOpacity
      nativeID={`card-${shape}-${color}-${number}-${shading}`}
      style={getCardStyle()}
      onPress={() => !disabled && !card.isDud && onClick(card)}
      disabled={disabled || card.isDud}
      activeOpacity={0.7}
    >
      {getModifierBadge()}
      <View nativeID="card-shapes" style={styles.shapesContainer}>
        {shapes}
      </View>
    </TouchableOpacity>
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
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.canvasWhite,
    flex: 1,
  },
  selected: {
    borderColor: COLORS.actionYellow,
    borderWidth: 3,
    shadowColor: COLORS.actionYellow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  hint: {
    backgroundColor: '#FFFDE7',
    borderColor: COLORS.actionYellow,
    borderStyle: 'dashed',
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
