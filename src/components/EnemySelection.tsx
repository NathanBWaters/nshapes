import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { usePWASafeAreaInsets } from '@/utils/usePWASafeAreaInsets';
import { PlayerStats, Weapon, WeaponRarity, EffectCaps } from '@/types';
import type { EnemyInstance, EnemyOption } from '@/types/enemy';
import { COLORS, RADIUS, getRarityColor } from '@/utils/colors';
import { getCapInfoForStat, isStatCapped, shouldShowCapInfo, STAT_TO_CAP_TYPE, EFFECT_CAPS } from '@/utils/gameConfig';
import Icon from './Icon';
import GameMenu from './GameMenu';

// Helper to get rarity label
const getRarityLabel = (rarity: WeaponRarity): string => {
  switch (rarity) {
    case 'common': return 'Common';
    case 'rare': return 'Rare';
    case 'epic': return 'Epic';
    case 'legendary': return 'Legendary';
    default: return rarity;
  }
};

// Tier colors for visual distinction
const TIER_COLORS: Record<1 | 2 | 3 | 4, string> = {
  1: COLORS.logicTeal,
  2: COLORS.actionYellow,
  3: COLORS.impactOrange,
  4: COLORS.impactRed,
};

interface EnemySelectionProps {
  enemies: EnemyOption[];
  onSelect: (enemyOption: EnemyOption) => void;
  round: number;
  playerStats: PlayerStats;
  playerWeapons?: Weapon[];
  onExitGame?: () => void;
}

const EnemySelection: React.FC<EnemySelectionProps> = ({
  enemies,
  onSelect,
  round,
  playerStats,
  playerWeapons = [],
  onExitGame
}) => {
  const insets = usePWASafeAreaInsets();
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Show hovered enemy if hovering, otherwise show focused
  const displayedIndex = hoveredIndex !== null ? hoveredIndex : focusedIndex;
  const focusedOption = enemies.length > 0 ? enemies[displayedIndex] : null;
  const focusedEnemy = focusedOption?.enemy ?? null;
  const focusedReward = focusedOption?.stretchGoalReward ?? null;
  const focusedMoney = focusedOption?.stretchGoalMoney ?? 0;

  // Get tier color for focused enemy
  const tierColor = focusedEnemy ? TIER_COLORS[focusedEnemy.tier] : COLORS.slateCharcoal;

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

  // Generate dynamic description for cap-increase weapons
  const getDynamicDescription = (weapon: Weapon): string => {
    if (!weapon.capIncrease) return weapon.description;

    const capType = weapon.capIncrease.type;
    const effectCaps = playerStats.effectCaps as Record<string, number> | undefined;
    const currentCap = effectCaps?.[capType] ?? EFFECT_CAPS[capType as keyof typeof EFFECT_CAPS]?.defaultCap ?? 0;
    const newCap = currentCap + weapon.capIncrease.amount;

    // Format cap type for display
    const capTypeName = capType.replace(/([A-Z])/g, ' $1').toLowerCase().trim();

    return `Raises your ${capTypeName} cap to ${newCap}%`;
  };

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
    const statName = formatKey(statKey);

    return { statName, currentValue, currentCap, newCap };
  };

  // Calculate before/after stat comparison for a weapon
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
        return {
          key: formatKey(key),
          before: '',
          after: formatStatValue(key, effectValue),
          isIncrease: effectValue > 0,
          isCapped: false,
          cap: null,
          isPerWeapon: true,
        };
      }

      const currentValue = (playerStats as Record<string, any>)[key] ?? 0;
      const newValue = currentValue + effectValue;

      const capInfo = getCapInfoForStat(key, effectCaps as Record<string, number> | undefined);
      const isCapped = capInfo ? isStatCapped(newValue, capInfo.cap) : false;
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
    <View style={styles.container}>
      {/* Eyebrow Banner */}
      <View style={styles.eyebrow}>
        <Text style={styles.eyebrowText}>Round {round} - Choose Enemy</Text>
        <GameMenu playerStats={playerStats} playerWeapons={playerWeapons} onExitGame={onExitGame} />
      </View>

      {/* Top Section - Detail Focus (larger, scrollable) */}
      <ScrollView style={styles.detailSection} contentContainerStyle={styles.detailScrollContent}>
        {focusedEnemy ? (
          <View style={styles.detailCard}>
            {/* Enemy Icon */}
            <View style={styles.previewArea}>
              <Icon name={focusedEnemy.icon} size={48} color={COLORS.slateCharcoal} />
            </View>

            {/* Enemy Name */}
            <Text style={styles.detailName}>{focusedEnemy.name}</Text>

            {/* Effect & Stretch Goal */}
            <View style={[styles.infoBox, styles.infoBoxEffect]}>
              <Text style={styles.infoLabelEffect}>Enemy Effects</Text>
              {focusedEnemy.description.split(', ').map((effect, index) => (
                <Text key={index} style={styles.infoText}>• {effect}</Text>
              ))}
              {/* Show stat modifiers if enemy has any (before → after format) */}
              {(() => {
                const modifiers = focusedEnemy.getStatModifiers();
                const uiModifiers = focusedEnemy.getUIModifiers();
                const statChanges: string[] = [];

                // Timer speed modifier - show effective time reduction
                if (uiModifiers.timerSpeedMultiplier && uiModifiers.timerSpeedMultiplier > 1) {
                  // Base round time is 60s + any bonus from weapons
                  const baseTime = 60 + (playerStats.startingTime || 0);
                  // Timer runs faster, so effective time is reduced
                  const effectiveTime = Math.round(baseTime / uiModifiers.timerSpeedMultiplier);
                  statChanges.push(`Timer: ${baseTime}s → ${effectiveTime}s`);
                }

                // Score decay - show rate (no before/after needed)
                if (uiModifiers.showScoreDecay?.rate) {
                  statChanges.push(`Score: -${uiModifiers.showScoreDecay.rate} pts/sec`);
                }

                // Weapon counter reductions - show before → after
                if (modifiers.fireSpreadChanceReduction) {
                  const before = playerStats.fireSpreadChance || 0;
                  const after = Math.max(0, before - modifiers.fireSpreadChanceReduction);
                  statChanges.push(`Fire Spread: ${before}% → ${after}%`);
                }
                if (modifiers.explosionChanceReduction) {
                  const before = playerStats.explosionChance || 0;
                  const after = Math.max(0, before - modifiers.explosionChanceReduction);
                  statChanges.push(`Explosion: ${before}% → ${after}%`);
                }
                if (modifiers.laserChanceReduction) {
                  const before = playerStats.laserChance || 0;
                  const after = Math.max(0, before - modifiers.laserChanceReduction);
                  statChanges.push(`Laser: ${before}% → ${after}%`);
                }
                if (modifiers.healingChanceReduction) {
                  const before = playerStats.healingChance || 0;
                  const after = Math.max(0, before - modifiers.healingChanceReduction);
                  statChanges.push(`Healing: ${before}% → ${after}%`);
                }

                if (statChanges.length > 0) {
                  return (
                    <View style={styles.statModifiersSection}>
                      <Text style={styles.statModifiersLabel}>Stat Changes:</Text>
                      {statChanges.map((change, i) => (
                        <Text key={i} style={styles.statModifierText}>• {change}</Text>
                      ))}
                    </View>
                  );
                }
                return null;
              })()}
            </View>

            <View style={[styles.infoBox, styles.infoBoxDefeat]}>
              <Text style={styles.infoLabelDefeat}>Stretch Goal</Text>
              <Text style={styles.infoText}>{focusedEnemy.defeatConditionText}</Text>
            </View>

            {/* Stretch Goal Reward - Weapon Shop style display */}
            <View style={[styles.infoBox, styles.infoBoxReward]}>
              <Text style={styles.infoLabelReward}>Stretch Goal Reward</Text>

              {focusedReward && (
                <>
                  {/* Weapon Header with Icon and Rarity */}
                  <View style={[styles.rewardPreviewArea, { borderColor: getRarityColor(focusedReward.rarity) }]}>
                    {focusedReward.icon && (
                      <Icon name={focusedReward.icon} size={28} color={COLORS.slateCharcoal} />
                    )}
                    <View style={[styles.rewardRarityBadge, { backgroundColor: getRarityColor(focusedReward.rarity) }]}>
                      <Text style={styles.rewardRarityBadgeText}>{getRarityLabel(focusedReward.rarity)}</Text>
                    </View>
                    <View style={styles.rewardMoneyBadge}>
                      <Text style={styles.rewardMoneyBadgeText}>+${focusedMoney}</Text>
                    </View>
                  </View>

                  {/* Weapon Name and Description */}
                  <Text style={[styles.rewardWeaponName, { color: getRarityColor(focusedReward.rarity) }]}>
                    {focusedReward.name}
                  </Text>
                  <Text style={styles.rewardDescription}>{getDynamicDescription(focusedReward)}</Text>
                  {focusedReward.flavorText && (
                    <Text style={styles.rewardFlavor}>{focusedReward.flavorText}</Text>
                  )}

                  {/* Stats Preview - Before → After */}
                  {Object.keys(focusedReward.effects).length > 0 && (
                    <View style={styles.rewardEffectsBox}>
                      <Text style={styles.rewardEffectsLabel}>Stat Changes</Text>
                      {getStatComparison(focusedReward).map((stat, i) => (
                        <View key={i} style={styles.statComparisonRow}>
                          <Text style={styles.effectKey}>{stat.key}</Text>
                          <View style={styles.statValues}>
                            {stat.isPerWeapon ? (
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
                  {focusedReward.capIncrease && (() => {
                    const capInfo = getCapIncreaseInfo(focusedReward);
                    if (!capInfo) return null;
                    return (
                      <View style={[styles.rewardEffectsBox, { marginTop: 8 }]}>
                        <Text style={styles.rewardEffectsLabel}>Cap Increase</Text>
                        <View style={styles.statComparisonRow}>
                          <Text style={styles.effectKey}>Current {capInfo.statName}</Text>
                          <Text style={styles.statBefore}>{capInfo.currentValue}%</Text>
                        </View>
                        <View style={styles.statComparisonRow}>
                          <Text style={styles.effectKey}>Current Cap</Text>
                          <Text style={styles.statBefore}>{capInfo.currentCap}%</Text>
                        </View>
                        <View style={styles.statComparisonRow}>
                          <Text style={styles.effectKey}>New Cap</Text>
                          <Text style={styles.statIncrease}>{capInfo.newCap}%</Text>
                        </View>
                      </View>
                    );
                  })()}
                </>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.emptyDetail}>
            <Text style={styles.emptyText}>No enemies available</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Section - Options Grid (smaller, 3/5ths of previous size) */}
      <View style={styles.optionsSection}>
        <Text style={styles.optionsHeader}>Select Your Opponent</Text>
        <View style={styles.optionsGrid} testID="enemy-options-grid">
          {enemies.map((enemyOption, index) => {
            const { enemy } = enemyOption;
            const isFocused = focusedIndex === index;
            const enemyTierColor = TIER_COLORS[enemy.tier];

            return (
              <Pressable
                key={enemy.name}
                testID={`enemy-option-${index}`}
                onPress={() => {
                  setHoveredIndex(null);
                  setFocusedIndex(index);
                }}
                onHoverIn={() => setHoveredIndex(index)}
                onHoverOut={() => setHoveredIndex(null)}
                style={[
                  styles.optionButton,
                  isFocused && styles.optionButtonSelected,
                  { borderColor: isFocused ? enemyTierColor : COLORS.slateCharcoal },
                  Platform.OS === 'web' && { cursor: 'pointer' as any },
                ]}
              >
                <View style={[styles.optionTierDot, { backgroundColor: enemyTierColor }]} />
                <Icon
                  name={enemy.icon}
                  size={28}
                  color={COLORS.slateCharcoal}
                />
                <Text
                  style={[
                    styles.optionText,
                    isFocused && styles.optionTextSelected,
                  ]}
                  numberOfLines={2}
                >
                  {enemy.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Action Button */}
      <View style={[styles.actionSection, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity
          testID="fight-enemy-button"
          onPress={() => focusedOption && onSelect(focusedOption)}
          disabled={!focusedOption}
          style={[
            styles.actionButton,
            !focusedOption && styles.actionButtonDisabled,
            focusedOption && { backgroundColor: tierColor },
          ]}
        >
          <Text style={styles.actionButtonText}>Fight {focusedEnemy?.name || 'Enemy'}</Text>
        </TouchableOpacity>
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
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  eyebrowText: {
    color: COLORS.deepOnyx,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  // Top Section - Detail Section (scrollable, takes more space)
  detailSection: {
    flex: 1,
  },
  detailScrollContent: {
    padding: 16,
    paddingBottom: 8,
  },
  detailCard: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    padding: 16,
  },
  previewArea: {
    backgroundColor: COLORS.paperBeige,
    height: 70,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.slateCharcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailName: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 22,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  infoBox: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  infoBoxEffect: {
    borderColor: COLORS.impactOrange,
  },
  infoBoxDefeat: {
    borderColor: COLORS.logicTeal,
  },
  infoBoxReward: {
    borderColor: '#D97706',
    backgroundColor: '#FEF3C7',
  },
  infoLabelEffect: {
    color: COLORS.impactOrange,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoLabelDefeat: {
    color: COLORS.logicTeal,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoLabelReward: {
    color: '#D97706',
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  infoText: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 18,
  },
  statModifiersSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.impactOrange + '40',
  },
  statModifiersLabel: {
    color: COLORS.impactRed,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statModifierText: {
    color: COLORS.impactRed,
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
  },
  // Reward weapon display (shop-style)
  rewardPreviewArea: {
    backgroundColor: COLORS.canvasWhite,
    height: 50,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  rewardRarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.button,
  },
  rewardRarityBadgeText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rewardMoneyBadge: {
    backgroundColor: COLORS.actionYellow,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  rewardMoneyBadgeText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  rewardWeaponName: {
    fontWeight: '700',
    fontSize: 18,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  rewardDescription: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  rewardFlavor: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  rewardEffectsBox: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.logicTeal,
    marginTop: 8,
  },
  rewardEffectsLabel: {
    color: COLORS.logicTeal,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
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
  effectKey: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 11,
    flex: 1,
    flexShrink: 1,
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
    color: COLORS.impactRed,
  },
  statCapped: {
    color: '#EAB308',
  },
  capIndicator: {
    fontSize: 10,
    color: COLORS.slateCharcoal,
    opacity: 0.6,
    marginLeft: 4,
    fontWeight: '500',
  },
  capIndicatorCapped: {
    color: '#EAB308',
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
  // Bottom Section - Options Section (compact, 3/5ths size)
  optionsSection: {
    height: 120, // Fixed compact height
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
  },
  optionsHeader: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  optionsGrid: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  optionButton: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 4,
    position: 'relative',
  },
  optionTierDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  optionButtonSelected: {
    backgroundColor: COLORS.actionYellow,
    borderWidth: 2,
  },
  optionText: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  optionTextSelected: {
    fontWeight: '700',
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
  actionButtonDisabled: {
    backgroundColor: COLORS.paperBeige,
    opacity: 0.6,
  },
  actionButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default EnemySelection;
