import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { Card as CardType } from '../types';

interface CardProps {
  card: CardType;
  onClick: (card: CardType) => void;
  disabled?: boolean;
}

const Card: React.FC<CardProps> = ({ card, onClick, disabled = false }) => {
  const { shape, color, number, shading, selected, isHint } = card;

  // Handle card modifiers
  const hasModifiers = (card.health !== undefined && card.health > 1) ||
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
  const getShapeComponent = (index: number) => {
    switch (shape) {
      case 'oval':
        return <Oval key={index} color={color} shading={shading} />;
      case 'squiggle':
        return <Squiggle key={index} color={color} shading={shading} />;
      case 'diamond':
        return <Diamond key={index} color={color} shading={shading} />;
      default:
        return null;
    }
  };

  // Render the appropriate number of shapes
  const shapes = [];
  for (let i = 0; i < number; i++) {
    shapes.push(getShapeComponent(i));
  }

  // Get card styles
  const getCardClasses = () => {
    let classes = "relative flex flex-col items-center justify-center p-2 rounded-lg border-2";
    classes += " bg-white";

    if (selected) {
      classes += " border-blue-500";
    } else {
      classes += " border-gray-300";
    }

    if (isHint) {
      classes += " bg-yellow-50";
    }

    if (disabled) {
      classes += " opacity-60";
    }

    if (card.isDud) {
      classes += " bg-gray-200 opacity-50";
    }

    return classes;
  };

  // Get modifier badges
  const getModifierBadges = () => {
    if (!hasModifiers) return null;

    const badges = [];

    if (card.health && card.health > 1) {
      badges.push(
        <View key="health" className="absolute top-1 right-1 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
          <Text className="text-white text-xs font-bold">{card.health}</Text>
        </View>
      );
    }

    if (card.lootBox) {
      badges.push(
        <View key="loot" className="absolute top-1 left-1 bg-amber-500 rounded-full w-5 h-5 items-center justify-center">
          <Text className="text-xs">💎</Text>
        </View>
      );
    }

    if (card.bonusMoney) {
      badges.push(
        <View key="money" className="absolute bottom-1 left-1 bg-green-500 rounded-full px-1">
          <Text className="text-white text-xs">+{card.bonusMoney}💰</Text>
        </View>
      );
    }

    if (card.bonusPoints) {
      badges.push(
        <View key="points" className="absolute bottom-1 right-1 bg-blue-500 rounded-full px-1">
          <Text className="text-white text-xs">+{card.bonusPoints}⭐</Text>
        </View>
      );
    }

    if (card.fireStarter) {
      badges.push(
        <View key="fire" className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 bg-orange-500 rounded-full w-5 h-5 items-center justify-center">
          <Text className="text-xs">🔥</Text>
        </View>
      );
    }

    if (card.bomb) {
      badges.push(
        <View key="bomb" className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full px-1">
          <Text className="text-white text-xs">💣{card.bombTimer && card.bombTimer}s</Text>
        </View>
      );
    }

    if (card.healing) {
      badges.push(
        <View key="healing" className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-green-600 rounded-full w-5 h-5 items-center justify-center">
          <Text className="text-xs">❤️</Text>
        </View>
      );
    }

    if (card.spikes) {
      badges.push(
        <View key="spikes" className="absolute top-0 right-0 left-0 h-2 flex-row justify-around">
          <Text className="text-red-600 text-xs">▲</Text>
          <Text className="text-red-600 text-xs">▲</Text>
          <Text className="text-red-600 text-xs">▲</Text>
        </View>
      );
    }

    return badges;
  };

  return (
    <Pressable
      className={getCardClasses()}
      onPress={() => !disabled && !card.isDud && onClick(card)}
      style={selected ? { transform: [{ scale: 1.05 }] } : undefined}
    >
      {getModifierBadges()}
      <View className="items-center justify-center gap-2">
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

const getColorStyle = (color: string) => {
  switch (color) {
    case 'red': return { borderColor: '#ef4444', backgroundColor: '#ef4444' };
    case 'green': return { borderColor: '#22c55e', backgroundColor: '#22c55e' };
    case 'purple': return { borderColor: '#a855f7', backgroundColor: '#a855f7' };
    default: return { borderColor: '#6b7280', backgroundColor: '#6b7280' };
  }
};

const Stripes: React.FC<{ color: string; width: number; height: number }> = ({ color, width, height }) => {
  const stripeHeight = 2;
  const gap = 3;
  const stripes = [];
  for (let y = 0; y < height; y += stripeHeight + gap) {
    stripes.push(
      <View
        key={y}
        style={{
          position: 'absolute',
          top: y,
          left: 0,
          right: 0,
          height: stripeHeight,
          backgroundColor: color,
        }}
      />
    );
  }
  return <>{stripes}</>;
};

const Oval: React.FC<ShapeProps> = ({ color, shading }) => {
  const colorStyle = getColorStyle(color);

  return (
    <View
      className="w-8 h-4 rounded-full border-2"
      style={{
        borderColor: colorStyle.borderColor,
        backgroundColor: shading === 'solid' ? colorStyle.backgroundColor : 'transparent',
        overflow: 'hidden',
      }}
    >
      {shading === 'striped' && <Stripes color={colorStyle.backgroundColor} width={32} height={16} />}
    </View>
  );
};

const Diamond: React.FC<ShapeProps> = ({ color, shading }) => {
  const colorStyle = getColorStyle(color);

  return (
    <View
      className="w-6 h-6 border-2"
      style={{
        borderColor: colorStyle.borderColor,
        backgroundColor: shading === 'solid' ? colorStyle.backgroundColor : 'transparent',
        transform: [{ rotate: '45deg' }],
        overflow: 'hidden',
      }}
    >
      {shading === 'striped' && <Stripes color={colorStyle.backgroundColor} width={24} height={24} />}
    </View>
  );
};

const Squiggle: React.FC<ShapeProps> = ({ color, shading }) => {
  const colorStyle = getColorStyle(color);

  return (
    <View
      className="w-8 h-4 border-2"
      style={{
        borderColor: colorStyle.borderColor,
        backgroundColor: shading === 'solid' ? colorStyle.backgroundColor : 'transparent',
        borderRadius: 8,
        borderTopLeftRadius: 16,
        borderBottomRightRadius: 16,
        overflow: 'hidden',
      }}
    >
      {shading === 'striped' && <Stripes color={colorStyle.backgroundColor} width={32} height={16} />}
    </View>
  );
};

export default Card;
