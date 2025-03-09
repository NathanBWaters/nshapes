"use client";

import React from 'react';
import { Card as CardType } from '../types';

interface CardProps {
  card: CardType;
  onClick: (card: CardType) => void;
  disabled: boolean;
}

const Card: React.FC<CardProps> = ({ card, onClick, disabled }) => {
  const { shape, color, number, shading, selected, isHint } = card;

  // Get the appropriate colors for stroke and fill
  const getColors = () => {
    const colorValues = {
      red: {
        stroke: '#ef4444',
        fill: '#ef4444'
      },
      green: {
        stroke: '#22c55e',
        fill: '#22c55e'
      },
      purple: {
        stroke: '#9333ea',
        fill: '#9333ea'
      }
    };
    
    return colorValues[color];
  };

  // Create a striped pattern definition for each color
  const getPattern = (index: number) => {
    const { stroke } = getColors();
    const patternId = `stripe-${color}-${index}`;
    
    return (
      <defs>
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width="6"
          height="6"
          patternTransform="rotate(90)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="6"
            stroke={stroke}
            strokeWidth="2"
          />
        </pattern>
      </defs>
    );
  };

  // Render the appropriate shape based on the card properties
  const renderShape = (index: number) => {
    const { stroke, fill } = getColors();
    const strokeWidth = 2;
    const patternId = `stripe-${color}-${index}`;
    
    // Adjust vertical spacing based on number of shapes
    const yOffset = number === 1 ? 0 : number === 2 ? 12 : 16;
    
    const shapePositions = number === 1 
      ? [0] 
      : number === 2 
        ? [-yOffset, yOffset] 
        : [-yOffset * 1.25, 0, yOffset * 1.25];

    // Determine fill value based on shading
    let fillValue;
    switch(shading) {
      case 'solid':
        fillValue = fill;
        break;
      case 'striped':
        fillValue = `url(#${patternId})`;
        break;
      case 'open':
      default:
        fillValue = 'none';
        break;
    }

    switch (shape) {
      case 'oval':
        return (
          <svg
            key={index}
            className="w-16 h-10 absolute transform transition-transform"
            style={{ transform: `translateY(${shapePositions[index]}px)` }}
            viewBox="0 0 60 30"
          >
            {shading === 'striped' && getPattern(index)}
            <ellipse 
              cx="30" 
              cy="15" 
              rx="25" 
              ry="12" 
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill={fillValue}
            />
          </svg>
        );
      case 'diamond':
        return (
          <svg
            key={index}
            className="w-16 h-10 absolute transform transition-transform"
            style={{ transform: `translateY(${shapePositions[index]}px)` }}
            viewBox="0 0 60 30"
          >
            {shading === 'striped' && getPattern(index)}
            <polygon 
              points="30,2 55,15 30,28 5,15" 
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill={fillValue}
            />
          </svg>
        );
      case 'squiggle':
        return (
          <svg
            key={index}
            className="w-16 h-10 absolute transform transition-transform"
            style={{ transform: `translateY(${shapePositions[index]}px)` }}
            viewBox="0 0 60 30"
          >
            {shading === 'striped' && getPattern(index)}
            <path 
              d="M5,20 C15,5 25,15 30,5 C35,15 45,5 55,20 C45,30 35,20 30,25 C25,15 15,25 5,20 Z" 
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill={fillValue}
            />
          </svg>
        );
      default:
        return null;
    }
  };

  // Define highlight styles for selected and hinted cards
  const getHighlightStyles = () => {
    if (selected && isHint) {
      // Both selected and hint - combined highlight
      return `
        border-4 border-purple-500 
        shadow-[0_0_15px_rgba(168,85,247,0.8)] 
        bg-purple-50
      `;
    } else if (selected) {
      // User selected
      return `
        border-4 border-blue-600 
        shadow-[0_0_12px_rgba(37,99,235,0.8)] 
        bg-blue-50
      `;
    } else if (isHint) {
      // Hint highlight
      return `
        border-4 border-yellow-500 
        shadow-[0_0_12px_rgba(234,179,8,0.7)]
        bg-yellow-50
      `;
    }
    return 'border border-gray-200';
  };

  return (
    <div
      className={`
        flex flex-col items-center justify-center 
        w-32 h-48 md:w-36 md:h-56 p-4 
        bg-white rounded-lg 
        cursor-pointer 
        transition-all duration-200
        transform hover:scale-105
        ${getHighlightStyles()}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onClick={() => !disabled && onClick(card)}
      aria-label={`${color} ${shape} ${number} ${shading}${selected ? ' selected' : ''}${isHint ? ' hint' : ''}`}
    >
      <div className="flex items-center justify-center h-full w-full relative">
        {Array.from({ length: number }, (_, i) => renderShape(i))}
      </div>
    </div>
  );
};

export default Card; 