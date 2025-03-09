"use client";

import React, { useState } from 'react';

const Tutorial: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4">
      <button
        className="text-blue-500 hover:text-blue-600 underline"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? 'Hide Rules' : 'Show Rules'}
      </button>
      
      {isOpen && (
        <div className="mt-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4">How to Play NShapes</h2>
          
          <h3 className="text-xl font-semibold mb-2">Card Attributes</h3>
          <p className="mb-4">Each card has four attributes:</p>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>Shape:</strong> Oval, Squiggle, or Diamond</li>
            <li><strong>Color:</strong> Red, Green, or Purple</li>
            <li><strong>Number:</strong> One, Two, or Three shapes</li>
            <li><strong>Shading:</strong> Solid, Striped, or Open</li>
          </ul>
          
          <h3 className="text-xl font-semibold mb-2">What Makes a Valid Combination?</h3>
          <p className="mb-2">
            A <strong>valid combination</strong> consists of three cards where each attribute is either all the same OR all different.
          </p>
          <p className="mb-4">
            For example, if two cards have the same shape and the third has a different shape, that&apos;s not a valid combination.
            All three shapes must be the same, or all three must be different.
          </p>
          
          <h3 className="text-xl font-semibold mb-2">Examples of Valid Combinations</h3>
          <ul className="list-disc pl-6 mb-4">
            <li>3 red cards with different shapes, numbers, and shadings</li>
            <li>3 cards with the same shape, same number, same shading, but different colors</li>
            <li>3 cards where every attribute (shape, color, number, and shading) is different</li>
          </ul>
          
          <h3 className="text-xl font-semibold mb-2">Game Play</h3>
          <ol className="list-decimal pl-6 mb-4">
            <li>Click on three cards you believe form a valid combination</li>
            <li>If correct, the cards will be removed and replaced</li>
            <li>If no valid combinations exist in the visible cards, use &quot;Add Cards&quot; to add more</li>
            <li>If you&apos;re stuck, use a &quot;Hint&quot; to highlight a valid combination</li>
          </ol>
          
          <h3 className="text-xl font-semibold mb-2">Scoring</h3>
          <p className="mb-4">
            +1 point for each valid combination found. The game ends when no more valid combinations can be found or the deck is exhausted.
          </p>
          
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            Got it!
          </button>
        </div>
      )}
    </div>
  );
};

export default Tutorial; 