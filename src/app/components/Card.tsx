import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card as CardType } from '../types';

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
      <View key={i} className="items-center justify-center">
        {getShapeComponent()}
      </View>
    );
  }

  // Get card status classes
  const getCardClasses = () => {
    let classes = "relative flex-col items-center justify-center p-2 rounded-lg border-2";

    // Base card styling
    classes += " bg-white";

    // Selection state
    if (selected) {
      classes += " border-blue-500 shadow-md";
    } else {
      classes += " border-gray-300";
    }

    // Hint state
    if (isHint) {
      classes += " bg-yellow-50";
    }

    // Disabled state
    if (disabled) {
      classes += " opacity-60";
    }

    // Dud card
    if (card.isDud) {
      classes += " bg-gray-200 opacity-50";
    }

    return classes;
  };

  // Get modifier icon and badge
  const getModifierBadge = () => {
    if (!hasModifiers) return null;

    const badges = [];

    // Health badge
    if (card.health && card.health > 1) {
      badges.push(
        <View key="health" className="absolute top-1 right-1 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
          <Text className="text-white text-xs font-bold">{card.health}</Text>
        </View>
      );
    }

    // Loot box badge
    if (card.lootBox) {
      badges.push(
        <View key="loot" className="absolute top-1 left-1 bg-amber-500 rounded-full w-5 h-5 items-center justify-center">
          <Text className="text-xs">💎</Text>
        </View>
      );
    }

    // Bonus money
    if (card.bonusMoney) {
      badges.push(
        <View key="money" className="absolute bottom-1 left-1 bg-green-500 rounded-full px-1">
          <Text className="text-white text-xs">+{card.bonusMoney}💰</Text>
        </View>
      );
    }

    // Bonus points
    if (card.bonusPoints) {
      badges.push(
        <View key="points" className="absolute bottom-1 right-1 bg-blue-500 rounded-full px-1">
          <Text className="text-white text-xs">+{card.bonusPoints}⭐</Text>
        </View>
      );
    }

    // Fire starter
    if (card.fireStarter) {
      badges.push(
        <View key="fire" className="absolute left-0 top-1/2 bg-orange-500 rounded-full w-5 h-5 items-center justify-center">
          <Text className="text-xs">🔥</Text>
        </View>
      );
    }

    // Bomb
    if (card.bomb) {
      badges.push(
        <View key="bomb" className="absolute top-0 left-1/2 bg-red-600 rounded-full px-1">
          <Text className="text-white text-xs">💣{card.bombTimer && card.bombTimer}s</Text>
        </View>
      );
    }

    // Healing
    if (card.healing) {
      badges.push(
        <View key="healing" className="absolute bottom-0 left-1/2 bg-green-600 rounded-full w-5 h-5 items-center justify-center">
          <Text className="text-xs">❤️</Text>
        </View>
      );
    }

    // Spikes
    if (card.spikes) {
      badges.push(
        <View key="spikes" className="absolute top-0 right-0 left-0 h-2 flex-row justify-around">
          <Text className="text-red-600">▲</Text>
          <Text className="text-red-600">▲</Text>
          <Text className="text-red-600">▲</Text>
        </View>
      );
    }

    return badges;
  };

  return (
    <Pressable
      className={getCardClasses()}
      onPress={() => !disabled && !card.isDud && onClick(card)}
      disabled={disabled || card.isDud}
    >
      {getModifierBadge()}
      <View className="flex-col items-center justify-center gap-2">
        {shapes}
      </View>
    </Pressable>
  );
};

// Shape components
interface ShapeProps {
  color: string;
  shading: string;
}

const Oval: React.FC<ShapeProps> = ({ color, shading }) => {
  const getColorClass = () => {
    switch (color) {
      case 'red': return 'border-red-500';
      case 'green': return 'border-green-500';
      case 'purple': return 'border-purple-500';
      default: return 'border-gray-500';
    }
  };

  const getBgColor = () => {
    if (shading !== 'solid') return 'transparent';
    switch (color) {
      case 'red': return '#ef4444';
      case 'green': return '#22c55e';
      case 'purple': return '#a855f7';
      default: return '#6b7280';
    }
  };

  return (
    <View
      className={`w-8 h-4 rounded-full border-2 ${getColorClass()}`}
      style={{ backgroundColor: getBgColor() }}
    />
  );
};

const Diamond: React.FC<ShapeProps> = ({ color, shading }) => {
  const getColorClass = () => {
    switch (color) {
      case 'red': return 'border-red-500';
      case 'green': return 'border-green-500';
      case 'purple': return 'border-purple-500';
      default: return 'border-gray-500';
    }
  };

  const getBgColor = () => {
    if (shading !== 'solid') return 'transparent';
    switch (color) {
      case 'red': return '#ef4444';
      case 'green': return '#22c55e';
      case 'purple': return '#a855f7';
      default: return '#6b7280';
    }
  };

  return (
    <View
      className={`w-8 h-8 border-2 ${getColorClass()}`}
      style={{ transform: [{ rotate: '45deg' }], backgroundColor: getBgColor() }}
    />
  );
};

const Squiggle: React.FC<ShapeProps> = ({ color, shading }) => {
  const getColorClass = () => {
    switch (color) {
      case 'red': return 'border-red-500';
      case 'green': return 'border-green-500';
      case 'purple': return 'border-purple-500';
      default: return 'border-gray-500';
    }
  };

  const getBgColor = () => {
    if (shading !== 'solid') return 'transparent';
    switch (color) {
      case 'red': return '#ef4444';
      case 'green': return '#22c55e';
      case 'purple': return '#a855f7';
      default: return '#6b7280';
    }
  };

  return (
    <View
      className={`w-8 h-4 border-2 ${getColorClass()}`}
      style={{
        borderTopLeftRadius: 16,
        borderTopRightRadius: 8,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 16,
        backgroundColor: getBgColor()
      }}
    />
  );
};

export default Card;
