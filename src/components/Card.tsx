import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card as CardType } from '@/types';

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
      style={getCardStyle()}
      onPress={() => !disabled && !card.isDud && onClick(card)}
      disabled={disabled || card.isDud}
      activeOpacity={0.7}
    >
      {getModifierBadge()}
      <View style={styles.shapesContainer}>
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

const Oval: React.FC<ShapeProps> = ({ color, shading }) => {
  return (
    <View
      style={[
        styles.oval,
        { borderColor: getBorderColor(color), backgroundColor: getBgColor(color, shading) }
      ]}
    />
  );
};

const Diamond: React.FC<ShapeProps> = ({ color, shading }) => {
  return (
    <View
      style={[
        styles.diamond,
        { borderColor: getBorderColor(color), backgroundColor: getBgColor(color, shading) }
      ]}
    />
  );
};

const Squiggle: React.FC<ShapeProps> = ({ color, shading }) => {
  return (
    <View
      style={[
        styles.squiggle,
        { borderColor: getBorderColor(color), backgroundColor: getBgColor(color, shading) }
      ]}
    />
  );
};

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    flex: 1,
    aspectRatio: 0.75,
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
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
    top: 4,
    right: 4,
  },
  badgeTopLeft: {
    top: 4,
    left: 4,
  },
  badgeBottomRight: {
    bottom: 4,
    right: 4,
  },
  badgeBottomLeft: {
    bottom: 4,
    left: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  badgeEmoji: {
    fontSize: 10,
  },
  oval: {
    width: 32,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  diamond: {
    width: 24,
    height: 24,
    borderWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
  squiggle: {
    width: 32,
    height: 16,
    borderWidth: 2,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 16,
  },
});

export default Card;
