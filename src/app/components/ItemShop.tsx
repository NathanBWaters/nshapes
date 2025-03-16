"use client";

import React from 'react';
import { Item } from '../types';

interface ItemShopProps {
  items: Item[];
  playerMoney: number;
  onPurchase: (itemIndex: number) => void;
  onReroll: () => void;
  rerollCost: number;
  freeRerolls: number;
  onContinue: () => void;
}

const ItemShop: React.FC<ItemShopProps> = ({
  items,
  playerMoney,
  onPurchase,
  onReroll,
  rerollCost,
  freeRerolls,
  onContinue
}) => {
  // Helper function to get color based on item rarity
  const getRarityColor = (rarity: string): string => {
    switch (rarity) {
      case 'Common': return 'text-gray-600';
      case 'Uncommon': return 'text-green-600';
      case 'Rare': return 'text-blue-600';
      case 'Epic': return 'text-purple-600';
      case 'Legendary': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };
  
  // Helper function to get border class based on item rarity
  const getItemBorderClass = (rarity: string): string => {
    switch (rarity) {
      case 'Common': return 'border-gray-300';
      case 'Uncommon': return 'border-green-300';
      case 'Rare': return 'border-blue-300';
      case 'Epic': return 'border-purple-300';
      case 'Legendary': return 'border-orange-300';
      default: return 'border-gray-300';
    }
  };
  
  return (
    <div className="item-shop p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Item Shop</h2>
        <div className="money-display text-lg">
          <span className="font-medium">Money:</span> {playerMoney} 💰
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, index) => {
          // Format item effects for display
          const effects = Object.entries(item.effects).map(([key, value]) => {
            const formattedKey = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
            let displayValue: string = '';
            if (typeof value === 'number') {
              displayValue = value > 0 ? `+${value}` : `${value}`;
              if (key.toLowerCase().includes('percent')) {
                displayValue += '%';
              }
            } else {
              displayValue = String(value);
            }
            
            return `${formattedKey}: ${displayValue}`;
          });
          
          // Format item drawbacks for display
          const drawbacks = Object.entries(item.drawbacks || {}).map(([key, value]) => {
            const formattedKey = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
            let displayValue: string = '';
            if (typeof value === 'number') {
              displayValue = value > 0 ? `+${value}` : `${value}`;
              if (key.toLowerCase().includes('percent')) {
                displayValue += '%';
              }
            } else {
              displayValue = String(value);
            }
            
            return `${formattedKey}: ${displayValue}`;
          });
          
          const canAfford = playerMoney >= item.price;
          
          return (
            <div 
              key={`${item.name}-${index}`}
              className={`item-card p-4 border-2 ${getItemBorderClass(item.rarity)} rounded-lg ${canAfford ? 'hover:shadow-md' : 'opacity-60'}`}
            >
              <div className="flex justify-between items-start">
                <h3 className={`font-bold ${getRarityColor(item.rarity)}`}>{item.name}</h3>
                <div className="price-tag bg-yellow-100 px-2 py-1 rounded text-sm font-medium">
                  {item.price} 💰
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mt-2">{item.description}</p>
              
              {effects.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-sm font-semibold text-green-700">Effects:</h4>
                  <ul className="text-xs mt-1 space-y-1">
                    {effects.map((effect, i) => (
                      <li key={i} className="text-green-600">{effect}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {drawbacks.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-sm font-semibold text-red-700">Drawbacks:</h4>
                  <ul className="text-xs mt-1 space-y-1">
                    {drawbacks.map((drawback, i) => (
                      <li key={i} className="text-red-600">{drawback}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="mt-4">
                <button
                  className={`w-full py-2 rounded-lg ${
                    canAfford 
                      ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  onClick={() => canAfford && onPurchase(index)}
                  disabled={!canAfford}
                >
                  Purchase
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
      {items.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No items available in the shop.
        </div>
      )}
      
      <div className="mt-6 flex justify-between">
        <button
          className={`px-4 py-2 rounded-lg ${
            (playerMoney >= rerollCost || freeRerolls > 0) 
              ? 'bg-purple-500 hover:bg-purple-600 text-white' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          onClick={onReroll}
          disabled={playerMoney < rerollCost && freeRerolls <= 0}
        >
          {freeRerolls > 0 
            ? `Reroll (${freeRerolls} free)` 
            : `Reroll (${rerollCost} 💰)`}
        </button>
        
        <button
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
          onClick={onContinue}
        >
          Continue to Next Round
        </button>
      </div>
    </div>
  );
};

export default ItemShop; 