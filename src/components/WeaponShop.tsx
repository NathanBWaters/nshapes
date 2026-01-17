import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Weapon, PlayerStats, WeaponRarity, EffectCaps } from '@/types';
import { COLORS, RADIUS, getRarityColor } from '@/utils/colors';
import { getCapInfoForStat, isStatCapped, shouldShowCapInfo, STAT_TO_CAP_TYPE, EFFECT_CAPS } from '@/utils/gameConfig';
import { getPlayerWeaponCount } from '@/utils/gameDefinitions';
import Icon from './Icon';
import GameMenu from './GameMenu';
import InventoryBar from './InventoryBar';
import { ScreenTransition } from './ScreenTransition';
import { playSound } from '@/utils/sounds';

// Weapon option component
interface WeaponOptionProps {
  weapon: Weapon;
  index: number;
  isFocused: boolean;
  canAfford: boolean;
  rarityColor: string;
  onPress: (index: number) => void;
  onHoverIn: (index: number) => void;
  onHoverOut: () => void;
  ownershipCount?: number;  // How many of this weapon the player already owns
  maxCount?: number;        // Max count for this weapon (if limited)
}

function WeaponOption({
  weapon,
  index,
  isFocused,
  canAfford,
  rarityColor,
  onPress,
  onHoverIn,
  onHoverOut,
  ownershipCount,
  maxCount,
}: WeaponOptionProps) {
  const showOwnership = maxCount !== undefined && ownershipCount !== undefined && ownershipCount > 0;

  return (
    <Pressable
      onPress={() => onPress(index)}
      onHoverIn={() => onHoverIn(index)}
      onHoverOut={onHoverOut}
      style={[
        styles.optionButton,
        { borderColor: rarityColor },
        isFocused && styles.optionButtonSelected,
        !canAfford && styles.optionButtonUnaffordable,
        Platform.OS === 'web' && { cursor: 'pointer' as any },
      ]}
    >
      {/* Ownership badge for weapons with maxCount */}
      {showOwnership && (
        <View style={styles.ownershipBadge}>
          <Text style={styles.ownershipBadgeText}>{ownershipCount}/{maxCount}</Text>
        </View>
      )}
      {weapon.icon && (
        <View style={styles.optionIcon}>
          <Icon
            name={weapon.icon}
            size={24}
            color={isFocused ? COLORS.canvasWhite : COLORS.logicTeal}
          />
        </View>
      )}
      <View style={styles.optionHeader}>
        <Text style={[styles.optionPrice, !canAfford && styles.optionPriceUnaffordable]}>
          ${weapon.price}
        </Text>
      </View>
      <Text
        style={[
          styles.optionText,
          isFocused && styles.optionTextSelected,
        ]}
        numberOfLines={1}
      >
        {weapon.name}
      </Text>
      <Text style={[styles.rarityTag, { color: rarityColor }]}>
        {getRarityLabel(weapon.rarity)}
      </Text>
    </Pressable>
  );
}

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
  onExitGame?: () => void;
}

const getRarityLabel = (rarity: WeaponRarity): string => {
  switch (rarity) {
    case 'common': return 'Common';
    case 'rare': return 'Rare';
    case 'epic': return 'Epic';
    case 'legendary': return 'Legendary';
    default: return rarity;
  }
};

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
  onExitGame
}) => {
  const insets = useSafeAreaInsets();
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

  // Purchase state
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  const handlePurchase = (index: number) => {
    setPurchaseSuccess(true);
    setTimeout(() => setPurchaseSuccess(false), 800);
    playSound('confirm');
    onPurchase(index);
  };

  const handleWeaponPress = (index: number) => {
    const now = Date.now();
    const weapon = weapons[index];
    const canAfford = weapon && playerMoney >= weapon.price;

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

  // Count available (non-null) weapons
  const availableWeapons = weapons.filter(weapon => weapon !== null);

  // Format stat name for display
  const formatStatName = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  // Format stat value with appropriate suffix
  const formatStatValue = (key: string, value: number): string => {
    let displayValue = `${value}`;
    if (key.toLowerCase().includes('percent') || key.toLowerCase().includes('chance')) displayValue += '%';
    if (key.toLowerCase().includes('interval')) displayValue += 'ms';
    if (key.toLowerCase().includes('time') && !key.toLowerCase().includes('interval')) displayValue += 's';
    return displayValue;
  };

  // Effects that roll independently per weapon (don't show misleading before→after)
  const INDEPENDENT_ROLL_EFFECTS = [
    'laserChance',
    'timeGainChance',
    'timeGainAmount',
  ];

  // Get cap-increase info for display (for Mastery weapons)
  const getCapIncreaseInfo = (weapon: Weapon): {
    statName: string;
    currentValue: number;
    currentCap: number;
    newCap: number;
  } | null => {
    if (!weapon.capIncrease) return null;

    const capType = weapon.capIncrease.type;
    const statKey = STAT_TO_CAP_TYPE[`${capType}Chance` as keyof typeof STAT_TO_CAP_TYPE]
      ? `${capType}Chance`
      : Object.entries(STAT_TO_CAP_TYPE).find(([_, type]) => type === capType)?.[0];

    if (!statKey) return null;

    const effectCaps = playerStats.effectCaps as Record<string, number> | undefined;
    const currentCap = effectCaps?.[capType] ?? EFFECT_CAPS[capType as keyof typeof EFFECT_CAPS]?.defaultCap ?? 0;
    const newCap = currentCap + weapon.capIncrease.amount;
    const currentValue = (playerStats as Record<string, any>)[statKey] ?? 0;

    // Format the stat name
    const statName = formatStatName(statKey);

    return { statName, currentValue, currentCap, newCap };
  };

  // Calculate before/after stat comparison for a weapon
  // Shows independent roll effects with "(per weapon)" notation
  // Shows cap info when stat would exceed its cap
  const getStatComparison = (weapon: Weapon): {
    key: string;
    before: string;
    after: string;
    isIncrease: boolean;
    isCapped: boolean;
    cap: number | null;
    isPerWeapon: boolean;
  }[] => {
    const effectCaps = playerStats.effectCaps as EffectCaps | undefined;

    return Object.entries(weapon.effects).map(([key, effectValue]) => {
      if (typeof effectValue !== 'number') return null;

      const isPerWeapon = INDEPENDENT_ROLL_EFFECTS.includes(key);

      if (isPerWeapon) {
        // For per-weapon effects, just show the weapon's value (no cumulative before→after)
        return {
          key: formatStatName(key),
          before: '',  // Not shown for per-weapon effects
          after: formatStatValue(key, effectValue),
          isIncrease: effectValue > 0,
          isCapped: false,
          cap: null,
          isPerWeapon: true,
        };
      }

      const currentValue = (playerStats as Record<string, any>)[key] ?? 0;
      const newValue = currentValue + effectValue;

      // Check if this stat has a cap
      const capInfo = getCapInfoForStat(key, effectCaps as Record<string, number> | undefined);
      const isCapped = capInfo ? isStatCapped(newValue, capInfo.cap) : false;

      // Only show cap info when player is close to the cap (within 20% or 2 points)
      const showCapInfo = capInfo ? shouldShowCapInfo(currentValue, capInfo.cap) : false;

      return {
        key: formatStatName(key),
        before: formatStatValue(key, currentValue),
        after: formatStatValue(key, newValue),
        isIncrease: effectValue > 0,
        isCapped,
        cap: showCapInfo ? capInfo?.cap ?? null : null,
        isPerWeapon: false,
      };
    }).filter((item): item is {
      key: string;
      before: string;
      after: string;
      isIncrease: boolean;
      isCapped: boolean;
      cap: number | null;
      isPerWeapon: boolean;
    } => item !== null);
  };

  return (
    <ScreenTransition>
      <View style={styles.container}>
        {/* Eyebrow Banner */}
        <View style={styles.eyebrow}>
        <Text style={styles.eyebrowText}>Weapon Shop</Text>
        <View style={styles.eyebrowRight}>
          <View style={styles.moneyBadge}>
            <Text style={styles.moneyText}>${playerMoney}</Text>
          </View>
          <GameMenu playerStats={playerStats} playerWeapons={playerWeapons} onExitGame={onExitGame} />
        </View>
      </View>

      {/* Inventory Bar */}
      <InventoryBar weapons={playerWeapons} />

      {/* Top Half - Detail Focus */}
      <View style={styles.detailSection}>
        {focusedWeapon ? (
          <View style={styles.detailCard}>
            {/* Weapon Icon */}
            <View style={[styles.previewArea, { borderColor: getRarityColor(focusedWeapon.rarity) }]}>
              {focusedWeapon.icon ? (
                <Icon name={focusedWeapon.icon} size={32} color={COLORS.slateCharcoal} />
              ) : (
                <Text style={styles.previewLabel}>{getRarityLabel(focusedWeapon.rarity)}</Text>
              )}
              <View style={[styles.rarityBadge, { backgroundColor: getRarityColor(focusedWeapon.rarity) }]}>
                <Text style={styles.rarityBadgeText}>{getRarityLabel(focusedWeapon.rarity)}</Text>
              </View>
              <View style={styles.priceBadge}>
                <Text style={styles.priceBadgeText}>${focusedWeapon.price}</Text>
              </View>
              {/* Ownership indicator for weapons with maxCount */}
              {focusedWeapon.maxCount !== undefined && (
                <View style={styles.ownershipIndicator}>
                  <Text style={styles.ownershipIndicatorText}>
                    {getPlayerWeaponCount(focusedWeapon.name, playerWeapons)}/{focusedWeapon.maxCount} owned
                  </Text>
                </View>
              )}
            </View>

            {/* Weapon Info */}
            <Text style={[styles.detailName, { color: getRarityColor(focusedWeapon.rarity) }]}>
              {focusedWeapon.name}
            </Text>
            <Text style={styles.detailDescription}>{focusedWeapon.description}</Text>
            {focusedWeapon.flavorText && (
              <Text style={styles.detailFlavor}>{focusedWeapon.flavorText}</Text>
            )}

            {/* Stats Preview - Before → After with cap info */}
            <View style={styles.effectsRow}>
              {Object.keys(focusedWeapon.effects).length > 0 && (
                <View style={[styles.effectsBox, styles.effectsBoxPositive]}>
                  <Text style={styles.effectsLabelPositive}>Stat Changes</Text>
                  {getStatComparison(focusedWeapon).map((stat, i) => (
                    <View key={i} style={styles.effectRow}>
                      <Text style={styles.effectKey}>{stat.key}</Text>
                      <View style={styles.statComparisonRow}>
                        {stat.isPerWeapon ? (
                          // Per-weapon effects: just show the value with "(per weapon)"
                          <>
                            <Text style={[
                              styles.statAfter,
                              stat.isIncrease ? styles.statIncrease : styles.statDecrease,
                            ]}>
                              {stat.after}
                            </Text>
                            <Text style={styles.capIndicator}>(per weapon)</Text>
                          </>
                        ) : (
                          // Normal effects: show before → after
                          <>
                            <Text style={styles.statBefore}>{stat.before}</Text>
                            <Text style={styles.statArrow}>→</Text>
                            <Text style={[
                              styles.statAfter,
                              stat.isIncrease ? styles.statIncrease : styles.statDecrease,
                              stat.isCapped && styles.statCapped,
                            ]}>
                              {stat.after}
                            </Text>
                          </>
                        )}
                        {stat.cap !== null && (
                          <Text style={[styles.capIndicator, stat.isCapped && styles.capIndicatorCapped]}>
                            (max {stat.cap}%)
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Cap Increase Info (for Mastery weapons) */}
              {focusedWeapon.capIncrease && (() => {
                const capInfo = getCapIncreaseInfo(focusedWeapon);
                if (!capInfo) return null;
                return (
                  <View style={[styles.effectsBox, styles.effectsBoxPositive, { marginTop: 8 }]}>
                    <Text style={styles.effectsLabelPositive}>Cap Increase</Text>
                    <View style={styles.effectRow}>
                      <Text style={styles.effectKey}>Current {capInfo.statName}</Text>
                      <Text style={styles.statBefore}>{capInfo.currentValue}%</Text>
                    </View>
                    <View style={styles.effectRow}>
                      <Text style={styles.effectKey}>Current Cap</Text>
                      <Text style={styles.statBefore}>{capInfo.currentCap}%</Text>
                    </View>
                    <View style={styles.effectRow}>
                      <Text style={styles.effectKey}>New Cap</Text>
                      <Text style={styles.statIncrease}>{capInfo.newCap}%</Text>
                    </View>
                  </View>
                );
              })()}
            </View>
          </View>
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
          <TouchableOpacity
            onPress={onReroll}
            disabled={playerMoney < rerollCost && freeRerolls <= 0}
            style={[
              styles.rerollButton,
              (playerMoney < rerollCost && freeRerolls <= 0) && styles.rerollButtonDisabled,
            ]}
          >
            <Text style={styles.rerollButtonText}>
              {freeRerolls > 0 ? `Reroll (${freeRerolls})` : `Reroll $${rerollCost}`}
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          style={styles.optionsScroll}
          contentContainerStyle={styles.optionsGrid}
          showsVerticalScrollIndicator={false}
        >
          {weapons.length > 0 ? (
            weapons.map((weapon, index) => {
              // Handle sold/empty slot
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

              const isFocused = focusedIndex === index;
              const canAfford = playerMoney >= weapon.price;
              const rarityColor = getRarityColor(weapon.rarity);
              const ownershipCount = weapon.maxCount !== undefined
                ? getPlayerWeaponCount(weapon.name, playerWeapons)
                : undefined;

              return (
                <WeaponOption
                  key={`${weapon.id}-${index}`}
                  weapon={weapon}
                  index={index}
                  isFocused={isFocused}
                  canAfford={canAfford}
                  rarityColor={rarityColor}
                  onPress={handleWeaponPress}
                  onHoverIn={setHoveredIndex}
                  onHoverOut={() => setHoveredIndex(null)}
                  ownershipCount={ownershipCount}
                  maxCount={weapon.maxCount}
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

      {/* Action Buttons */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  eyebrow: {
    height: 40,
    backgroundColor: COLORS.actionYellow,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
    paddingHorizontal: 16,
  },
  eyebrowText: {
    color: COLORS.deepOnyx,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  eyebrowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moneyBadge: {
    backgroundColor: COLORS.deepOnyx,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
  },
  moneyText: {
    color: COLORS.actionYellow,
    fontWeight: '700',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  // Top Half - Detail Section
  detailSection: {
    flex: 1,
    padding: 16,
  },
  detailCard: {
    flex: 1,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    padding: 16,
  },
  previewArea: {
    backgroundColor: COLORS.paperBeige,
    height: 50,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  previewLabel: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.button,
  },
  rarityBadgeText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceBadge: {
    backgroundColor: COLORS.actionYellow,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  priceBadgeText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  detailName: {
    fontWeight: '700',
    fontSize: 20,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailDescription: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  detailFlavor: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  effectsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  effectsBox: {
    flex: 1,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
  },
  effectsBoxPositive: {
    backgroundColor: COLORS.paperBeige,
    borderColor: COLORS.logicTeal,
  },
  effectsLabelPositive: {
    color: COLORS.logicTeal,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  effectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  effectKey: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 11,
    flex: 1,
  },
  effectValuePositive: {
    color: COLORS.logicTeal,
    fontWeight: '700',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  statComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statBefore: {
    color: COLORS.slateCharcoal,
    fontSize: 11,
    fontFamily: 'monospace',
    opacity: 0.7,
  },
  statArrow: {
    color: COLORS.slateCharcoal,
    fontSize: 10,
    opacity: 0.5,
  },
  statAfter: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  statIncrease: {
    color: COLORS.logicTeal,
  },
  statDecrease: {
    color: COLORS.impactRed,
  },
  statCapped: {
    color: '#EAB308', // Yellow/amber to indicate capped
  },
  capIndicator: {
    fontSize: 10,
    color: COLORS.slateCharcoal,
    opacity: 0.6,
    marginLeft: 4,
    fontWeight: '500',
  },
  capIndicatorCapped: {
    color: '#EAB308', // Yellow/amber when at cap
    opacity: 1,
  },
  emptyDetail: {
    flex: 1,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.slateCharcoal,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 14,
    opacity: 0.6,
  },
  // Bottom Half - Options Section
  optionsSection: {
    flex: 1,
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
  },
  optionsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  optionsHeader: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rerollButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    borderRadius: RADIUS.button,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  rerollButtonDisabled: {
    opacity: 0.4,
  },
  rerollButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  optionsScroll: {
    flex: 1,
  },
  optionsGrid: {
    flexGrow: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
    alignContent: 'stretch',
  },
  optionButton: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    borderWidth: 2,
    width: '48%',
    flexGrow: 1,
    flexBasis: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 2,
    position: 'relative',
  },
  optionIcon: {
    marginBottom: 2,
  },
  optionButtonSelected: {
    backgroundColor: COLORS.actionYellow,
  },
  optionButtonUnaffordable: {
    opacity: 0.5,
  },
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
  optionHeader: {
    marginBottom: 2,
  },
  optionPrice: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  optionPriceUnaffordable: {
    color: COLORS.impactRed,
  },
  optionText: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  optionTextSelected: {
    fontWeight: '700',
  },
  rarityTag: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
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
  // Action Section
  actionSection: {
    padding: 16,
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
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
  // Ownership badge for weapon options with maxCount
  ownershipBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.logicTeal,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
  },
  ownershipBadgeText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 9,
  },
  // Ownership indicator in detail view
  ownershipIndicator: {
    backgroundColor: COLORS.logicTeal,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.button,
  },
  ownershipIndicatorText: {
    color: COLORS.canvasWhite,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default WeaponShop;
