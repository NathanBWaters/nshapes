import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { usePWASafeAreaInsets } from '@/hooks/usePWASafeAreaInsets';
import { Character, Weapon, PlayerStats } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import GameMenu from './GameMenu';
import InventoryBar from './InventoryBar';
import { RerollButton, WeaponDetailCard, WeaponOptionTile, weaponPickerStyles } from './WeaponPicker';
import { ScreenTransition } from './ScreenTransition';
import { playSound } from '@/utils/sounds';
import { FighterAvatar } from './fighters';
import { FighterReactionEvent } from '@/utils/fighterAnimations';

interface WeaponShopProps {
  weapons: (Weapon | null)[];  // null represents a sold/empty slot
  playerMoney: number;
  onPurchase: (weaponIndex: number) => void;
  onReroll: () => void;
  rerollCost: number;
  freeRerolls: number;
  onContinue: () => void;
  playerStats: PlayerStats;
  playerWeapons?: Weapon[];
  character?: Character;
  onExitGame?: () => void;
}

const WeaponShop: React.FC<WeaponShopProps> = ({
  weapons,
  playerMoney,
  onPurchase,
  onReroll,
  rerollCost,
  freeRerolls,
  onContinue,
  playerStats,
  playerWeapons = [],
  character,
  onExitGame
}) => {
  const insets = usePWASafeAreaInsets();
  const [focusedIndex, setFocusedIndex] = useState<number>(() => {
    // Initialize to first non-null weapon
    const firstAvailable = weapons.findIndex(weapon => weapon !== null);
    return firstAvailable >= 0 ? firstAvailable : 0;
  });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Reset focusedIndex when weapons array changes to ensure it points to a valid weapon
  // This handles cases where:
  // 1. All weapons were purchased and the user returns to shop
  // 2. The weapons array is regenerated with new weapons
  // 3. The current focused weapon becomes null after purchase
  useEffect(() => {
    // If current focused weapon is null or undefined, find first available
    if (weapons[focusedIndex] === null || weapons[focusedIndex] === undefined) {
      const firstAvailable = weapons.findIndex(weapon => weapon !== null);
      if (firstAvailable >= 0) {
        setFocusedIndex(firstAvailable);
      }
      // If all weapons are null, focusedIndex stays as-is (shop will show empty state)
    }
  }, [weapons, focusedIndex]);

  // Double-tap detection for instant purchase
  const [lastTapTime, setLastTapTime] = useState<number>(0);
  const [lastTappedIndex, setLastTappedIndex] = useState<number | null>(null);
  const DOUBLE_TAP_THRESHOLD = 300; // ms

  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [tapTriggers, setTapTriggers] = useState<Record<number, number>>({});

  const handlePurchase = (index: number) => {
    setPurchaseSuccess(true);
    setTimeout(() => setPurchaseSuccess(false), 800);
    playSound('confirm');
    purchaseCounterRef.current += 1;
    setShopReaction({ type: 'powerup', id: purchaseCounterRef.current });
    onPurchase(index);
  };

  const handleWeaponPress = (index: number) => {
    const now = Date.now();
    const weapon = weapons[index];
    const canAfford = weapon && playerMoney >= weapon.price;

    setTapTriggers(prev => ({ ...prev, [index]: (prev[index] ?? 0) + 1 }));

    // Clear hover state to ensure display updates (fixes stuck hover on touch devices)
    setHoveredIndex(null);

    // Check for double-tap on same weapon
    if (
      lastTappedIndex === index &&
      now - lastTapTime < DOUBLE_TAP_THRESHOLD &&
      canAfford
    ) {
      // Double-tap: instant purchase
      handlePurchase(index);
      setLastTapTime(0);
      setLastTappedIndex(null);
    } else {
      // Single tap: focus the weapon
      playSound('click');
      setFocusedIndex(index);
      setLastTapTime(now);
      setLastTappedIndex(index);
    }
  };

  // Show hovered weapon if hovering, otherwise show focused
  const displayedIndex = hoveredIndex !== null ? hoveredIndex : focusedIndex;

  const focusedWeapon = weapons[displayedIndex];  // Can be null if slot is sold
  const canAffordFocused = focusedWeapon ? playerMoney >= focusedWeapon.price : false;

  const [shopReaction, setShopReaction] = useState<FighterReactionEvent | null>(null);
  const purchaseCounterRef = React.useRef(0);

  // Count available (non-null) weapons
  const availableWeapons = weapons.filter(weapon => weapon !== null);

  return (
    <ScreenTransition>
      <View style={styles.container}>
        <View style={styles.eyebrow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {character && (
            <FighterAvatar
              character={character}
              size={34}
              health={playerStats.health}
              maxHealth={playerStats.maxHealth}
              mood="curious"
              reaction={shopReaction}
              interactive
            />
          )}
          <Text style={styles.eyebrowText}>Weapon Shop</Text>
        </View>
        <View style={styles.eyebrowRight}>
          <View style={styles.moneyBadge}>
            <Text style={styles.moneyText}>${playerMoney}</Text>
          </View>
          <GameMenu playerStats={playerStats} playerWeapons={playerWeapons} character={character} onExitGame={onExitGame} />
        </View>
      </View>

      <InventoryBar weapons={playerWeapons} />

      {/* Top Half - Detail Focus */}
      <View style={styles.detailSection}>
        {focusedWeapon ? (
          <WeaponDetailCard weapon={focusedWeapon} playerStats={playerStats} playerWeapons={playerWeapons} variant="shop" />
        ) : (
          <View style={styles.emptyDetail}>
            <Text style={styles.emptyText}>
              {availableWeapons.length === 0 ? 'All weapons sold' : 'Select a weapon below'}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Half - Options Grid */}
      <View style={styles.optionsSection}>
        <View style={styles.optionsHeaderRow}>
          <Text style={styles.optionsHeader}>Available Weapons</Text>
          <RerollButton onReroll={onReroll} rerollCost={rerollCost} playerMoney={playerMoney} freeRerolls={freeRerolls} />
        </View>
        <ScrollView
          style={styles.optionsScroll}
          contentContainerStyle={styles.optionsGrid}
          showsVerticalScrollIndicator={false}
        >
          {weapons.length > 0 ? (
            weapons.map((weapon, index) => {
              if (weapon === null) {
                return (
                  <View
                    key={`sold-${index}`}
                    style={[styles.optionButton, styles.optionButtonSold]}
                  >
                    <Text style={styles.soldText}>SOLD</Text>
                  </View>
                );
              }

              return (
                <WeaponOptionTile
                  key={`${weapon.id}-${index}`}
                  weapon={weapon}
                  index={index}
                  isFocused={focusedIndex === index}
                  purchase={{ canAfford: playerMoney >= weapon.price }}
                  onPress={handleWeaponPress}
                  onHoverIn={setHoveredIndex}
                  onHoverOut={() => setHoveredIndex(null)}
                  playerWeapons={playerWeapons}
                  triggerKey={tapTriggers[index]}
                />
              );
            })
          ) : (
            <View style={styles.emptyShop}>
              <Text style={styles.emptyShopText}>Shop is empty</Text>
            </View>
          )}
        </ScrollView>
      </View>

      <View style={[styles.actionSection, { paddingBottom: 16 + insets.bottom }]}>
        <View style={styles.actionRow}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity
              onPress={() => canAffordFocused && focusedWeapon && handlePurchase(focusedIndex)}
              disabled={!canAffordFocused || !focusedWeapon || availableWeapons.length === 0}
              style={[
                styles.purchaseButton,
                (!canAffordFocused || !focusedWeapon || availableWeapons.length === 0) && styles.purchaseButtonDisabled,
                purchaseSuccess && styles.purchaseButtonSuccess,
              ]}
            >
              <Text style={styles.purchaseButtonText}>
                {purchaseSuccess
                  ? '✓ Purchased!'
                  : availableWeapons.length === 0
                    ? 'No Weapons'
                    : !focusedWeapon
                      ? 'Select Weapon'
                      : canAffordFocused
                        ? 'Purchase'
                        : 'Cannot Afford'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => {
              playSound('confirmExit');
              onContinue();
            }}
            style={styles.continueButton}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
      </View>
    </ScreenTransition>
  );
};

const styles = {
  ...weaponPickerStyles,
  ...StyleSheet.create({
    optionButtonSold: {
      backgroundColor: COLORS.paperBeige,
      borderColor: COLORS.slateCharcoal,
      borderStyle: 'dashed',
      opacity: 0.4,
    },
    soldText: {
      color: COLORS.slateCharcoal,
      fontWeight: '600',
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    emptyShop: {
      flex: 1,
      padding: 32,
      alignItems: 'center',
    },
    emptyShopText: {
      color: COLORS.slateCharcoal,
      fontWeight: '400',
      fontSize: 14,
      opacity: 0.6,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 12,
    },
    purchaseButton: {
      flex: 1,
      backgroundColor: COLORS.actionYellow,
      borderRadius: RADIUS.button,
      borderWidth: 1,
      borderColor: COLORS.slateCharcoal,
      paddingVertical: 16,
      alignItems: 'center',
    },
    purchaseButtonDisabled: {
      backgroundColor: COLORS.paperBeige,
      opacity: 0.6,
    },
    purchaseButtonSuccess: {
      backgroundColor: COLORS.logicTeal,
    },
    purchaseButtonText: {
      color: COLORS.slateCharcoal,
      fontWeight: '700',
      fontSize: 14,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    continueButton: {
      flex: 1,
      backgroundColor: 'transparent',
      borderRadius: RADIUS.button,
      borderWidth: 2,
      borderColor: COLORS.slateCharcoal,
      paddingVertical: 16,
      alignItems: 'center',
    },
    continueButtonText: {
      color: COLORS.slateCharcoal,
      fontWeight: '700',
      fontSize: 14,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
  }),
};

export default WeaponShop;
