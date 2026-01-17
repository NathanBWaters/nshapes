import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerStats, Weapon, WeaponRarity, EffectCaps } from '@/types';
import { COLORS, RADIUS, getRarityColor } from '@/utils/colors';
import { getCapInfoForStat, isStatCapped, shouldShowCapInfo, STAT_TO_CAP_TYPE, EFFECT_CAPS } from '@/utils/gameConfig';
import Icon from './Icon';
import GameMenu from './GameMenu';
import InventoryBar from './InventoryBar';
import { ConfettiBurst } from './effects/ConfettiBurst';
import { ScreenTransition } from './ScreenTransition';
import { playSound } from '@/utils/sounds';
import { getWeaponsByRarity, getPlayerWeaponCount } from '@/utils/gameDefinitions';
import { generateChallengeBonus, getChallengeBonusMoney } from '@/utils/rewardUtils';

// Re-export for backwards compatibility
export { generateChallengeBonus, getChallengeBonusMoney };

// Extra challenge bonus color (golden)
const CHALLENGE_BONUS_COLOR = '#FFD700';

// Weapon option component
interface WeaponOptionProps {
  weapon: Weapon;
  index: number;
  isFocused: boolean;
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

interface LevelUpProps {
  options: Weapon[];
  onSelect: (weapon: Weapon) => void;  // Changed to pass the weapon directly
  onReroll: () => void;
  rerollCost: number;
  playerMoney: number;
  freeRerolls: number;
  playerStats: PlayerStats;
  playerWeapons?: Weapon[];
  onExitGame?: () => void;
  targetLevel: number;         // The level this reward is for
  hasMoreLevelUps: boolean;    // True if more level-ups pending after this
  enemyDefeated?: boolean;     // True if player defeated the enemy's stretch goal
  defeatedEnemyTier?: 1 | 2 | 3 | 4;  // Tier of the defeated enemy (for bonus rarity)
  challengeBonusWeapon?: Weapon | null;  // Pre-determined stretch goal reward (from enemy selection)
  onChallengeBonusMoney?: (amount: number) => void;  // Callback to grant bonus money
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

const LevelUp: React.FC<LevelUpProps> = ({
  options,
  onSelect,
  onReroll,
  rerollCost,
  playerMoney,
  freeRerolls,
  playerStats,
  playerWeapons = [],
  onExitGame,
  targetLevel,
  hasMoreLevelUps,
  enemyDefeated = false,
  defeatedEnemyTier = 1,
  challengeBonusWeapon: preGeneratedReward = null,
  onChallengeBonusMoney,
}) => {
  const insets = useSafeAreaInsets();
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Determine valid focus range - regular options plus challenge bonus if available
  const hasChallengeBonus = enemyDefeated && preGeneratedReward !== null;
  const maxValidIndex = hasChallengeBonus ? options.length : options.length - 1;

  // Reset focusedIndex when options change to ensure it's valid
  // This handles cases where:
  // 1. Options are regenerated (multi-level-up scenarios)
  // 2. Options array changes size
  // 3. Player rerolls and gets new options
  // Note: Challenge bonus is at index options.length, so we allow that when available
  useEffect(() => {
    // If current focusedIndex is out of bounds, reset to 0
    // Allow options.length as valid when challenge bonus exists
    if (focusedIndex > maxValidIndex && options.length > 0) {
      setFocusedIndex(0);
    }
    // If current focused option is undefined/null AND not the challenge bonus, find first valid one
    if (focusedIndex < options.length && options[focusedIndex] === undefined && options.length > 0) {
      const firstValid = options.findIndex(opt => opt !== undefined);
      if (firstValid >= 0) {
        setFocusedIndex(firstValid);
      }
    }
  }, [options, focusedIndex, maxValidIndex]);

  // Trigger confetti on mount
  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Show hovered option if hovering, otherwise show focused
  const displayedIndex = hoveredIndex !== null ? hoveredIndex : focusedIndex;

  // Use pre-generated reward if available, otherwise generate one (for backwards compatibility)
  const challengeBonusWeapon = useMemo(() => {
    if (!enemyDefeated) return null;
    // Use the pre-determined reward from enemy selection when available
    if (preGeneratedReward) return preGeneratedReward;
    // Fallback to generating a new reward (legacy behavior)
    return generateChallengeBonus(defeatedEnemyTier);
  }, [enemyDefeated, preGeneratedReward, defeatedEnemyTier]);

  // Check if the slayer bonus is selected (it's always the last option if available)
  const challengeBonusIndex = enemyDefeated ? options.length : -1;
  const isChallengeBonusFocused = displayedIndex === challengeBonusIndex;

  // Get the focused weapon (either from options or the slayer bonus)
  const focusedWeapon = isChallengeBonusFocused ? challengeBonusWeapon : options[displayedIndex];

  // Format key from camelCase to Title Case
  const formatKey = (key: string) => {
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
          key: formatKey(key),
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
        key: formatKey(key),
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
        {/* Celebration confetti */}
        <ConfettiBurst trigger={showConfetti} count={30} />

      {/* Eyebrow Banner */}
      <View style={styles.eyebrow}>
        <View style={styles.eyebrowLeft}>
          <Text style={styles.eyebrowText}>Level Up!</Text>
          <Text style={styles.levelNumber}>Level {targetLevel}</Text>
          <View style={styles.freeBadge}>
            <Text style={styles.freeBadgeText}>FREE</Text>
          </View>
        </View>
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
          <View style={[styles.detailCard, isChallengeBonusFocused && styles.challengeBonusCard]}>
            {/* Challenge Bonus Banner */}
            {isChallengeBonusFocused && (
              <View style={styles.challengeBonusBanner}>
                <Text style={styles.challengeBonusBannerText}>STRETCH GOAL BONUS</Text>
              </View>
            )}

            {/* Weapon Icon */}
            <View style={[
              styles.previewArea,
              { borderColor: isChallengeBonusFocused ? CHALLENGE_BONUS_COLOR : getRarityColor(focusedWeapon.rarity) }
            ]}>
              {focusedWeapon.icon ? (
                <Icon name={focusedWeapon.icon} size={32} color={COLORS.slateCharcoal} />
              ) : (
                <Text style={styles.previewLabel}>{getRarityLabel(focusedWeapon.rarity)}</Text>
              )}
              <View style={[
                styles.rarityBadge,
                { backgroundColor: isChallengeBonusFocused ? CHALLENGE_BONUS_COLOR : getRarityColor(focusedWeapon.rarity) }
              ]}>
                <Text style={styles.rarityBadgeText}>{getRarityLabel(focusedWeapon.rarity)}</Text>
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
            <Text style={[
              styles.detailName,
              { color: isChallengeBonusFocused ? CHALLENGE_BONUS_COLOR : getRarityColor(focusedWeapon.rarity) }
            ]}>
              {focusedWeapon.name}
            </Text>
            <Text style={styles.detailDescription}>{focusedWeapon.description}</Text>
            {focusedWeapon.flavorText && (
              <Text style={styles.detailFlavor}>{focusedWeapon.flavorText}</Text>
            )}

            {/* Effects with before/after comparison and cap info */}
            <View style={styles.effectsRow}>
              {Object.keys(focusedWeapon.effects).length > 0 && (
                <View style={[styles.effectsBox, styles.effectsBoxPositive]}>
                  <Text style={styles.effectsLabelPositive}>Stats Change</Text>
                  {getStatComparison(focusedWeapon).map((stat, i) => (
                    <View key={i} style={styles.statComparisonRow}>
                      <Text style={styles.effectKey}>{stat.key}</Text>
                      <View style={styles.statValues}>
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
            </View>
          </View>
        ) : (
          <View style={styles.emptyDetail}>
            <Text style={styles.emptyText}>Select a weapon below</Text>
          </View>
        )}
      </View>

      {/* Bottom Half - Options Grid */}
      <View style={styles.optionsSection}>
        <View style={styles.optionsHeaderRow}>
          <Text style={styles.optionsHeader}>Choose Your <Text style={styles.freeText}>FREE</Text> Reward</Text>
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
          {options.map((weapon, index) => {
            const isFocused = focusedIndex === index;
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
                rarityColor={rarityColor}
                onPress={(index) => {
                  playSound('click');
                  setHoveredIndex(null); // Clear hover state to ensure display updates
                  setFocusedIndex(index);
                }}
                onHoverIn={setHoveredIndex}
                onHoverOut={() => setHoveredIndex(null)}
                ownershipCount={ownershipCount}
                maxCount={weapon.maxCount}
              />
            );
          })}

          {/* Slayer Bonus Option - shown only if enemy was defeated */}
          {challengeBonusWeapon && (
            <Pressable
              onPress={() => {
                playSound('click');
                setHoveredIndex(null); // Clear hover state to ensure display updates
                setFocusedIndex(challengeBonusIndex);
              }}
              onHoverIn={() => setHoveredIndex(challengeBonusIndex)}
              onHoverOut={() => setHoveredIndex(null)}
              style={[
                styles.optionButton,
                styles.challengeBonusOption,
                { borderColor: CHALLENGE_BONUS_COLOR },
                focusedIndex === challengeBonusIndex && styles.challengeBonusOptionSelected,
                Platform.OS === 'web' && { cursor: 'pointer' as any },
              ]}
            >
              <View style={styles.challengeBonusTag}>
                <Text style={styles.challengeBonusTagText}>BONUS</Text>
              </View>
              {challengeBonusWeapon.icon && (
                <View style={styles.optionIcon}>
                  <Icon
                    name={challengeBonusWeapon.icon}
                    size={24}
                    color={focusedIndex === challengeBonusIndex ? COLORS.canvasWhite : CHALLENGE_BONUS_COLOR}
                  />
                </View>
              )}
              <Text
                style={[
                  styles.optionText,
                  { color: CHALLENGE_BONUS_COLOR },
                  focusedIndex === challengeBonusIndex && styles.optionTextSelected,
                ]}
                numberOfLines={1}
              >
                {challengeBonusWeapon.name}
              </Text>
              <Text style={[styles.rarityTag, { color: CHALLENGE_BONUS_COLOR }]}>
                {getRarityLabel(challengeBonusWeapon.rarity)}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {/* Action Button */}
      <View style={[styles.actionSection, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity
          onPress={() => {
            if (focusedWeapon) {
              playSound('confirm');
              // Grant bonus money if selecting challenge bonus
              if (isChallengeBonusFocused && onChallengeBonusMoney) {
                const bonusMoney = getChallengeBonusMoney(defeatedEnemyTier);
                onChallengeBonusMoney(bonusMoney);
              }
              onSelect(focusedWeapon);
            }
          }}
          disabled={!focusedWeapon}
          style={[styles.actionButton, !focusedWeapon && styles.actionButtonDisabled]}
        >
          <Text style={styles.actionButtonText}>
            {hasMoreLevelUps ? 'Next Level Up' : 'Select Weapon'}
          </Text>
        </TouchableOpacity>
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
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  eyebrowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyebrowText: {
    color: COLORS.deepOnyx,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  levelNumber: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 14,
  },
  freeBadge: {
    backgroundColor: COLORS.logicTeal,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.button,
  },
  freeBadgeText: {
    color: COLORS.canvasWhite,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 1,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  statValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statBefore: {
    color: COLORS.slateCharcoal,
    fontWeight: '500',
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
    fontWeight: '700',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  statIncrease: {
    color: COLORS.logicTeal,
  },
  statDecrease: {
    color: COLORS.impactOrange,
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
  freeText: {
    color: COLORS.logicTeal,
    fontWeight: '800',
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
  // Action Section
  actionSection: {
    padding: 16,
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
  },
  actionButton: {
    backgroundColor: COLORS.actionYellow,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  actionButtonDisabled: {
    backgroundColor: COLORS.paperBeige,
    opacity: 0.6,
  },
  // Slayer Bonus styles
  challengeBonusCard: {
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  challengeBonusBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFD700',
    paddingVertical: 4,
    alignItems: 'center',
    borderTopLeftRadius: RADIUS.module - 1,
    borderTopRightRadius: RADIUS.module - 1,
    zIndex: 1,
  },
  challengeBonusBannerText: {
    color: COLORS.slateCharcoal,
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  challengeBonusOption: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderStyle: 'solid',
    position: 'relative',
  },
  challengeBonusOptionSelected: {
    backgroundColor: '#FFD700',
  },
  challengeBonusTag: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FFD700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  challengeBonusTagText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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

export default LevelUp;
