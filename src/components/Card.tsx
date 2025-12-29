import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card as CardType } from '@/types';

// Shape sizing - adjust this to change all shape heights
const SHAPE_SIZE = '50%';

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
        return <Oval color={color} shading={shading} />;
      case 'squiggle':
        return <Squiggle color={color} shading={shading} />;
      case 'diamond':
        return <Diamond color={color} shading={shading} />;
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

const Oval: React.FC<ShapeProps> = ({ color, shading }) => {
  const borderColor = getBorderColor(color);
  return (
    <View
      nativeID="shape-oval"
      style={[
        styles.shapeBase,
        styles.oval,
        { height: SHAPE_SIZE, borderColor, backgroundColor: getBgColor(color, shading) }
      ]}
    >
      {shading === 'striped' && <Stripes color={borderColor} />}
    </View>
  );
};

const Diamond: React.FC<ShapeProps> = ({ color, shading }) => {
  const borderColor = getBorderColor(color);
  return (
    <View
      nativeID="shape-diamond"
      style={[
        styles.shapeBase,
        styles.diamond,
        { height: SHAPE_SIZE, borderColor, backgroundColor: getBgColor(color, shading) }
      ]}
    >
      {shading === 'striped' && <Stripes color={borderColor} />}
    </View>
  );
};

const Squiggle: React.FC<ShapeProps> = ({ color, shading }) => {
  const borderColor = getBorderColor(color);
  return (
    <View
      nativeID="shape-squiggle"
      style={[
        styles.shapeBase,
        styles.squiggle,
        { height: SHAPE_SIZE, borderColor, backgroundColor: getBgColor(color, shading) }
      ]}
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
    flex: 1,
    height: '100%',
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
  shapeBase: {
    borderWidth: 3,
    overflow: 'hidden',
  },
  oval: {
    aspectRatio: 0.6,
    borderRadius: 999,
  },
  diamond: {
    aspectRatio: 1,
    transform: [{ rotate: '45deg' }],
  },
  squiggle: {
    aspectRatio: 0.6,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 999,
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
