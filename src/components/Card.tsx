import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Card as CardType } from '@/types';

interface CardProps {
  card: CardType;
  onClick: (card: CardType) => void;
  disabled?: boolean;
}

const Card: React.FC<CardProps> = ({ card, onClick, disabled = false }) => {
  const { width: screenWidth } = useWindowDimensions();
  const { shape, color, number, shading, selected, isHint } = card;

  // Calculate shape size based on screen width
  // With 3 columns at 31% width each, card is roughly screenWidth * 0.31
  // Shapes should be about 55% of the card width
  const cardWidth = screenWidth * 0.31;
  const shapeWidth = Math.max(40, Math.min(cardWidth * 0.55, 80));
  const shapeHeight = shapeWidth * 0.4; // Ovals and squiggles are wider than tall
  const diamondSize = shapeWidth * 0.6; // Diamonds are square

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
        return <Oval color={color} shading={shading} width={shapeWidth} height={shapeHeight} />;
      case 'squiggle':
        return <Squiggle color={color} shading={shading} width={shapeWidth} height={shapeHeight} />;
      case 'diamond':
        return <Diamond color={color} shading={shading} width={diamondSize} height={diamondSize} />;
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
    const cardStyles: any[] = [styles.card];

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
        <View key="health" style={[styles.badge, styles.badgeTopRight, { backgroundColor: '#ef4444' }]}>
          <Text style={styles.badgeText}>{card.health}</Text>
        </View>
      );
    }

    if (card.lootBox) {
      badges.push(
        <View key="loot" style={[styles.badge, styles.badgeTopLeft, { backgroundColor: '#f59e0b' }]}>
          <Text style={styles.badgeEmoji}>💎</Text>
        </View>
      );
    }

    if (card.bonusMoney) {
      badges.push(
        <View key="money" style={[styles.badge, styles.badgeBottomLeft, { backgroundColor: '#22c55e' }]}>
          <Text style={styles.badgeText}>+{card.bonusMoney}💰</Text>
        </View>
      );
    }

    if (card.bonusPoints) {
      badges.push(
        <View key="points" style={[styles.badge, styles.badgeBottomRight, { backgroundColor: '#3b82f6' }]}>
          <Text style={styles.badgeText}>+{card.bonusPoints}⭐</Text>
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
  width: number;
  height: number;
}

const getBorderColor = (color: string) => {
  switch (color) {
    case 'red': return '#ef4444';
    case 'green': return '#22c55e';
    case 'purple': return '#a855f7';
    default: return '#6b7280';
  }
};

const getBgColor = (color: string, shading: string) => {
  if (shading !== 'solid') return 'transparent';
  return getBorderColor(color);
};

const Stripes: React.FC<{ color: string }> = ({ color }) => {
  // Create stripes that fill the shape using percentage positioning
  const stripes = [];
  const stripeCount = 5;
  for (let i = 0; i < stripeCount; i++) {
    const topPercent = (i / stripeCount) * 100;
    stripes.push(
      <View
        key={i}
        style={{
          position: 'absolute',
          top: `${topPercent}%`,
          left: 0,
          right: 0,
          height: '12%',
          backgroundColor: color,
        }}
      />
    );
  }
  return <>{stripes}</>;
};

const Oval: React.FC<ShapeProps> = ({ color, shading, width, height }) => {
  const borderColor = getBorderColor(color);
  return (
    <View
      style={{
        width,
        height,
        borderRadius: height / 2,
        borderWidth: 3,
        borderColor,
        backgroundColor: getBgColor(color, shading),
        overflow: 'hidden',
      }}
    >
      {shading === 'striped' && <Stripes color={borderColor} />}
    </View>
  );
};

const Diamond: React.FC<ShapeProps> = ({ color, shading, width, height }) => {
  const borderColor = getBorderColor(color);
  const size = Math.min(width, height);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderWidth: 3,
        borderColor,
        backgroundColor: getBgColor(color, shading),
        overflow: 'hidden',
        transform: [{ rotate: '45deg' }],
      }}
    >
      {shading === 'striped' && <Stripes color={borderColor} />}
    </View>
  );
};

const Squiggle: React.FC<ShapeProps> = ({ color, shading, width, height }) => {
  const borderColor = getBorderColor(color);
  return (
    <View
      style={{
        width,
        height,
        borderWidth: 3,
        borderColor,
        backgroundColor: getBgColor(color, shading),
        overflow: 'hidden',
        borderTopLeftRadius: height,
        borderTopRightRadius: height / 4,
        borderBottomLeftRadius: height / 4,
        borderBottomRightRadius: height,
      }}
    >
      {shading === 'striped' && <Stripes color={borderColor} />}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    flex: 1,
  },
  selected: {
    borderColor: '#3b82f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  hint: {
    backgroundColor: '#fefce8',
  },
  disabled: {
    opacity: 0.6,
  },
  shapeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shapesContainer: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingVertical: 4,
  },
  badge: {
    position: 'absolute',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
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
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  badgeEmoji: {
    fontSize: 10,
  },
});

export default Card;
