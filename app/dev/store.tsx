import React, { useState, useCallback } from 'react';
import { generateShopWeapons, DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';
import { ECONOMY } from '@/utils/gameConfig';
import { Weapon, PlayerStats } from '@/types';
import WeaponShop from '@/components/WeaponShop';

/**
 * Dev Store Page
 *
 * Standalone weapon shop for testing store UI and purchases.
 * Starts with $50,000 so you can freely buy and test weapons.
 */
export default function DevStore() {
  const [money, setMoney] = useState(50000);
  const [shopWeapons, setShopWeapons] = useState<(Weapon | null)[]>(() => generateShopWeapons(4));
  const [playerWeapons, setPlayerWeapons] = useState<Weapon[]>([]);
  const [rerollCost, setRerollCost] = useState<number>(ECONOMY.baseRerollCost);
  const [freeRerolls, setFreeRerolls] = useState(0);

  // Calculate player stats including weapon effects
  const playerStats: PlayerStats = {
    ...DEFAULT_PLAYER_STATS,
    money,
    // Apply weapon effects to stats
    ...playerWeapons.reduce((acc, weapon) => {
      Object.entries(weapon.effects).forEach(([key, value]) => {
        if (typeof value === 'number') {
          acc[key] = (acc[key] || 0) + value;
        }
      });
      return acc;
    }, {} as Record<string, number>),
  };

  const handlePurchase = useCallback((weaponIndex: number) => {
    const weapon = shopWeapons[weaponIndex];
    if (!weapon || money < weapon.price) return;

    setMoney(prev => prev - weapon.price);
    setPlayerWeapons(prev => [...prev, weapon]);
    setShopWeapons(prev => prev.map((w, i) => i === weaponIndex ? null : w));
  }, [shopWeapons, money]);

  const handleReroll = useCallback(() => {
    if (freeRerolls > 0) {
      setFreeRerolls(prev => prev - 1);
    } else if (money >= rerollCost) {
      setMoney(prev => prev - rerollCost);
      setRerollCost(prev => prev + ECONOMY.rerollCostIncrement);
    } else {
      return;
    }
    setShopWeapons(generateShopWeapons(4));
  }, [freeRerolls, money, rerollCost]);

  const handleContinue = useCallback(() => {
    // Just refresh the shop for testing
    setShopWeapons(generateShopWeapons(4));
    setRerollCost(ECONOMY.baseRerollCost);
  }, []);

  return (
    <WeaponShop
      weapons={shopWeapons}
      playerMoney={money}
      onPurchase={handlePurchase}
      onReroll={handleReroll}
      rerollCost={rerollCost}
      freeRerolls={freeRerolls}
      onContinue={handleContinue}
      playerStats={playerStats}
      playerWeapons={playerWeapons}
    />
  );
}
