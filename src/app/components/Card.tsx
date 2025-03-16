"use client";

import React from 'react';
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
      <div key={i} className="shape-container">
        {getShapeComponent()}
      </div>
    );
  }
  
  // Get card status classes
  const getCardClasses = () => {
    let classes = "card relative flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all";
    
    // Base card styling
    classes += " bg-white";
    
    // Selection state
    if (selected) {
      classes += " border-blue-500 shadow-md transform scale-105";
    } else {
      classes += " border-gray-300 hover:border-blue-300";
    }
    
    // Hint state
    if (isHint) {
      classes += " bg-yellow-50";
    }
    
    // Disabled state
    if (disabled) {
      classes += " opacity-60 cursor-not-allowed";
    } else {
      classes += " cursor-pointer";
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
        <div key="health" className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
          {card.health}
        </div>
      );
    }
    
    // Loot box badge
    if (card.lootBox) {
      badges.push(
        <div key="loot" className="absolute top-1 left-1 bg-amber-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
          <span role="img" aria-label="Treasure">💎</span>
        </div>
      );
    }
    
    // Bonus money
    if (card.bonusMoney) {
      badges.push(
        <div key="money" className="absolute bottom-1 left-1 bg-green-500 text-white rounded-full px-1 text-xs">
          +{card.bonusMoney}💰
        </div>
      );
    }
    
    // Bonus points
    if (card.bonusPoints) {
      badges.push(
        <div key="points" className="absolute bottom-1 right-1 bg-blue-500 text-white rounded-full px-1 text-xs">
          +{card.bonusPoints}⭐
        </div>
      );
    }
    
    // Fire starter
    if (card.fireStarter) {
      badges.push(
        <div key="fire" className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
          <span role="img" aria-label="Fire">🔥</span>
        </div>
      );
    }
    
    // Bomb
    if (card.bomb) {
      badges.push(
        <div key="bomb" className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white rounded-full px-1 text-xs">
          <span role="img" aria-label="Bomb">💣</span>
          {card.bombTimer && <span>{card.bombTimer}s</span>}
        </div>
      );
    }
    
    // Healing
    if (card.healing) {
      badges.push(
        <div key="healing" className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center">
          <span role="img" aria-label="Healing">❤️</span>
        </div>
      );
    }
    
    // Spikes
    if (card.spikes) {
      badges.push(
        <div key="spikes" className="absolute top-0 right-0 left-0 h-2 flex justify-around">
          <span className="text-red-600">▲</span>
          <span className="text-red-600">▲</span>
          <span className="text-red-600">▲</span>
        </div>
      );
    }
    
    return badges;
  };
  
  return (
    <div 
      className={getCardClasses()}
      onClick={() => !disabled && !card.isDud && onClick(card)}
    >
      {getModifierBadge()}
      <div className="shapes-container flex flex-col items-center justify-center gap-2">
        {shapes}
      </div>
    </div>
  );
};

// Shape components
interface ShapeProps {
  color: string;
  shading: string;
}

const Oval: React.FC<ShapeProps> = ({ color, shading }) => {
  const getColor = () => {
    switch (color) {
      case 'red': return 'text-red-500 border-red-500';
      case 'green': return 'text-green-500 border-green-500';
      case 'purple': return 'text-purple-500 border-purple-500';
      default: return 'text-gray-500 border-gray-500';
    }
  };
  
  const getShading = () => {
    switch (shading) {
      case 'solid': return 'bg-current';
      case 'striped': return 'bg-stripes';
      case 'open': return 'bg-transparent';
      default: return 'bg-transparent';
    }
  };
  
  return (
    <div 
      className={`oval w-8 h-4 rounded-full border-2 ${getColor()} ${getShading()}`}
    ></div>
  );
};

const Diamond: React.FC<ShapeProps> = ({ color, shading }) => {
  const getColor = () => {
    switch (color) {
      case 'red': return 'text-red-500 border-red-500';
      case 'green': return 'text-green-500 border-green-500';
      case 'purple': return 'text-purple-500 border-purple-500';
      default: return 'text-gray-500 border-gray-500';
    }
  };
  
  const getShading = () => {
    switch (shading) {
      case 'solid': return 'bg-current';
      case 'striped': return 'bg-stripes';
      case 'open': return 'bg-transparent';
      default: return 'bg-transparent';
    }
  };
  
  return (
    <div 
      className={`diamond w-8 h-8 border-2 ${getColor()} ${getShading()}`}
      style={{ transform: 'rotate(45deg)' }}
    ></div>
  );
};

const Squiggle: React.FC<ShapeProps> = ({ color, shading }) => {
  const getColor = () => {
    switch (color) {
      case 'red': return 'text-red-500 border-red-500';
      case 'green': return 'text-green-500 border-green-500';
      case 'purple': return 'text-purple-500 border-purple-500';
      default: return 'text-gray-500 border-gray-500';
    }
  };
  
  const getShading = () => {
    switch (shading) {
      case 'solid': return 'bg-current';
      case 'striped': return 'bg-stripes';
      case 'open': return 'bg-transparent';
      default: return 'bg-transparent';
    }
  };
  
  // Simplified squiggle as a wavy rectangle
  return (
    <div 
      className={`squiggle w-8 h-4 border-2 ${getColor()} ${getShading()}`}
      style={{ borderRadius: '40% 60% 60% 40% / 60% 30% 70% 40%' }}
    ></div>
  );
};

export default Card; 