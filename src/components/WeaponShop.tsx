import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Pressable } from 'react-native';
import { Weapon, PlayerStats, WeaponRarity } from '@/types';
import { COLORS, RADIUS, SPACING, SHADOWS, getRarityColor } from '../theme';
import { DURATIONS } from '../theme/animations';
import { haptics } from '../utils/haptics';
import Icon from './Icon';
import GameMenu from './GameMenu';
import InventoryBar from './InventoryBar';
import { Button, RarityBadge, PriceBadge } from './ui';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
    case 'legendary': return 'Legendary';
    default: return rarity;
  }
};

// Weapon option card with animations
function WeaponCard({
  weapon,
  index,
  isFocused,
  canAfford,
  onPress,
  onHoverIn,
  onHoverOut,
}: {
  weapon: Weapon;
  index: number;
  isFocused: boolean;
  canAfford: boolean;
  onPress: () => void;
  onHoverIn: () => void;
  onHoverOut: () => void;
}) {
  const pressed = useSharedValue(0);
  const hovered = useSharedValue(0);

  const handlePressIn = useCallback(() => {
    pressed.value = withTiming(1, { duration: DURATIONS.press });
  }, [pressed]);

  const handlePressOut = useCallback(() => {
    pressed.value = withTiming(0, { duration: DURATIONS.press });
  }, [pressed]);

  const handleHoverIn = useCallback(() => {
    if (Platform.OS === 'web') {
      hovered.value = withTiming(1, { duration: DURATIONS.hover });
    }
    onHoverIn();
  }, [hovered, onHoverIn]);

  const handleHoverOut = useCallback(() => {
    if (Platform.OS === 'web') {
      hovered.value = withTiming(0, { duration: DURATIONS.hover });
    }
    onHoverOut();
  }, [hovered, onHoverOut]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressed.value, [0, 1], [1, 0.96]);
    const translateY = interpolate(hovered.value, [0, 1], [0, -2]);

    return {
      transform: [
        { scale },
        { translateY },
      ],
    };
  });

  const rarityColor = getRarityColor(weapon.rarity);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      style={[
        styles.optionButton,
        { borderColor: rarityColor },
        isFocused && styles.optionButtonSelected,
        !canAfford && styles.optionButtonUnaffordable,
        animatedStyle,
        Platform.OS === 'web' && { cursor: 'pointer' as const },
      ]}
    >
      {weapon.icon && (
        <Icon
          name={weapon.icon}
          size={24}
          color={COLORS.canvasWhite}
          style={styles.optionIcon}
        />
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
    </AnimatedPressable>
  );
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
  onExitGame
}) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(() => {
    // Initialize to first non-null weapon
    const firstAvailable = weapons.findIndex(weapon => weapon !== null);
    return firstAvailable >= 0 ? firstAvailable : 0;
  });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Double-tap detection for instant purchase
  const [lastTapTime, setLastTapTime] = useState<number>(0);
  const [lastTappedIndex, setLastTappedIndex] = useState<number | null>(null);
  const DOUBLE_TAP_THRESHOLD = 300; // ms

  const handleWeaponPress = useCallback((index: number) => {
    const now = Date.now();
    const weapon = weapons[index];
    const canAfford = weapon && playerMoney >= weapon.price;

    // Check for double-tap on same weapon
    if (
      lastTappedIndex === index &&
      now - lastTapTime < DOUBLE_TAP_THRESHOLD &&
      canAfford
    ) {
      // Double-tap: instant purchase
      haptics.medium();
      onPurchase(index);
      setLastTapTime(0);
      setLastTappedIndex(null);
    } else {
      // Single tap: focus the weapon
      haptics.selection();
      setFocusedIndex(index);
      setLastTapTime(now);
      setLastTappedIndex(index);
    }
  }, [weapons, playerMoney, lastTappedIndex, lastTapTime, onPurchase]);

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

  // Calculate before/after stat comparison for a weapon
  // Skips independent roll effects since they don't stack additively
  const getStatComparison = (weapon: Weapon): { key: string; before: string; after: string; isIncrease: boolean }[] => {
    return Object.entries(weapon.effects).map(([key, effectValue]) => {
      if (typeof effectValue !== 'number') return null;

      // Skip independent roll effects - they're explained in the description
      if (INDEPENDENT_ROLL_EFFECTS.includes(key)) return null;

      const currentValue = (playerStats as Record<string, any>)[key] ?? 0;
      const newValue = currentValue + effectValue;

      return {
        key: formatStatName(key),
        before: formatStatValue(key, currentValue),
        after: formatStatValue(key, newValue),
        isIncrease: effectValue > 0,
      };
    }).filter((item): item is { key: string; before: string; after: string; isIncrease: boolean } => item !== null);
  };

  const handlePurchase = useCallback(() => {
    if (canAffordFocused && focusedWeapon) {
      haptics.success();
      onPurchase(focusedIndex);
    }
  }, [canAffordFocused, focusedWeapon, focusedIndex, onPurchase]);

  const handleReroll = useCallback(() => {
    haptics.light();
    onReroll();
  }, [onReroll]);

  const handleContinue = useCallback(() => {
    haptics.light();
    onContinue();
  }, [onContinue]);

  return (
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
              <RarityBadge rarity={focusedWeapon.rarity} size="sm" />
              <PriceBadge price={focusedWeapon.price} size="sm" />
            </View>

            {/* Weapon Info */}
            <Text style={[styles.detailName, { color: getRarityColor(focusedWeapon.rarity) }]}>
              {focusedWeapon.name}
            </Text>
            <Text style={styles.detailDescription}>{focusedWeapon.description}</Text>
            {focusedWeapon.flavorText && (
              <Text style={styles.detailFlavor}>{focusedWeapon.flavorText}</Text>
            )}
            {focusedWeapon.maxCount !== undefined && (
              <Text style={styles.detailMaxCount}>Max: {focusedWeapon.maxCount}</Text>
            )}

            {/* Stats Preview - Before → After */}
            <View style={styles.effectsRow}>
              {Object.keys(focusedWeapon.effects).length > 0 && (
                <View style={[styles.effectsBox, styles.effectsBoxPositive]}>
                  <Text style={styles.effectsLabelPositive}>Stat Changes</Text>
                  {getStatComparison(focusedWeapon).map((stat, i) => (
                    <View key={i} style={styles.effectRow}>
                      <Text style={styles.effectKey}>{stat.key}</Text>
                      <View style={styles.statComparisonRow}>
                        <Text style={styles.statBefore}>{stat.before}</Text>
                        <Text style={styles.statArrow}>→</Text>
                        <Text style={[
                          styles.statAfter,
                          stat.isIncrease ? styles.statIncrease : styles.statDecrease
                        ]}>
                          {stat.after}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
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
          <Button
            variant="secondary"
            size="sm"
            onPress={handleReroll}
            disabled={playerMoney < rerollCost && freeRerolls <= 0}
          >
            {freeRerolls > 0 ? `Reroll (${freeRerolls})` : `Reroll $${rerollCost}`}
          </Button>
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

              return (
                <WeaponCard
                  key={`${weapon.id}-${index}`}
                  weapon={weapon}
                  index={index}
                  isFocused={isFocused}
                  canAfford={canAfford}
                  onPress={() => handleWeaponPress(index)}
                  onHoverIn={() => setHoveredIndex(index)}
                  onHoverOut={() => setHoveredIndex(null)}
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
      <View style={styles.actionSection}>
        <View style={styles.actionRow}>
          <View style={styles.actionButtonWrapper}>
            <Button
              variant="primary"
              size="lg"
              onPress={handlePurchase}
              disabled={!canAffordFocused || !focusedWeapon || availableWeapons.length === 0}
              fullWidth
            >
              {availableWeapons.length === 0
                ? 'No Weapons'
                : !focusedWeapon
                  ? 'Select Weapon'
                  : canAffordFocused
                    ? 'Purchase'
                    : 'Cannot Afford'}
            </Button>
          </View>
          <View style={styles.actionButtonWrapper}>
            <Button
              variant="secondary"
              size="lg"
              onPress={handleContinue}
              fullWidth
            >
              Continue
            </Button>
          </View>
        </View>
      </View>
    </View>
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
    paddingHorizontal: SPACING.md,
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
    gap: SPACING.sm,
  },
  moneyBadge: {
    backgroundColor: COLORS.deepOnyx,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.sm,
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
    padding: SPACING.md,
  },
  detailCard: {
    flex: 1,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  previewArea: {
    backgroundColor: COLORS.paperBeige,
    height: 50,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
    borderWidth: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  previewLabel: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailName: {
    fontWeight: '700',
    fontSize: 20,
    textTransform: 'uppercase',
    marginBottom: SPACING.xxs,
  },
  detailDescription: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.xxs,
  },
  detailFlavor: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: SPACING.md,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  detailMaxCount: {
    color: COLORS.legendaryGold,
    fontWeight: '600',
    fontSize: 11,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  effectsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  effectsBox: {
    flex: 1,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
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
    marginBottom: SPACING.xs,
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
  statComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
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
  emptyDetail: {
    flex: 1,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.slateCharcoal,
    padding: SPACING.xl,
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
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  optionsHeader: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  optionsScroll: {
    flex: 1,
  },
  optionsGrid: {
    flexGrow: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
    alignContent: 'stretch',
  },
  optionButton: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    width: '48%',
    flexGrow: 1,
    flexBasis: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    gap: 2,
    ...SHADOWS.sm,
  },
  optionIcon: {
    marginBottom: 2,
  },
  optionButtonSelected: {
    backgroundColor: COLORS.actionYellow,
    ...SHADOWS.md,
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
    padding: SPACING.xl,
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
    padding: SPACING.md,
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  actionButtonWrapper: {
    flex: 1,
  },
});

export default WeaponShop;
