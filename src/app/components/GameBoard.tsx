"use client";

import React from 'react';
import { Card as CardType } from '../types';
import Card from './Card';

interface GameBoardProps {
  cards: CardType[];
  onCardClick: (card: CardType) => void;
  disabled: boolean;
}

const GameBoard: React.FC<GameBoardProps> = ({ cards, onCardClick, disabled }) => {
  return (
    <div className="grid grid-cols-3 md:grid-cols-4 gap-4 p-4 justify-items-center">
      {cards.map((card) => (
        <Card 
          key={card.id} 
          card={card} 
          onClick={onCardClick} 
          disabled={disabled} 
        />
      ))}
    </div>
  );
};

export default GameBoard; 