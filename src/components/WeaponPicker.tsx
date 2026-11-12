/**
 * Building blocks shared by the screens where the player picks a weapon:
 * WeaponShop, LevelUp and the in-round LevelUpModal.
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Pressable, StyleSheet, Platform, StyleProp, ViewStyle } from 'react-native';
import { PlayerStats, Weapon } from '@/types';
import { COLORS, RADIUS, getRarityColor } from '@/utils/colors';
import { getPlayerWeaponCount } from '@/utils/gameDefinitions';
import {
  getDynamicDescription,
  getStatComparison,
  getCapIncreaseInfo,
  getRarityLabel,
} from '@/utils/weaponDisplay';
import KeywordText from './KeywordText';
import { WeaponAvatar } from './weapons';

// =============================================================================
// Grid tile
// =============================================================================

interface WeaponOptionTileProps {
  weapon: Weapon;
  index: number;
  isFocused: boolean;
  onPress: (index: number) => void;
  onHoverIn: (index: number) => void;
  onHoverOut: () => void;
  playerWeapons: Weapon[];
  triggerKey?: number;
  /** Shop only: show the price and dim the tile when the player cannot afford it. */
  purchase?: { canAfford: boolean };
}

export function WeaponOptionTile({
  weapon,
  index,
  isFocused,
  onPress,
  onHoverIn,
  onHoverOut,
  playerWeapons,
  triggerKey,
  purchase,
}: WeaponOptionTileProps) {
  const rarityColor = getRarityColor(weapon.rarity);
  // Only weapons with a max count show how many the player already owns.
  const ownershipCount = weapon.maxCount !== undefined
    ? getPlayerWeaponCount(weapon.name, playerWeapons)
    : 0;

  return (
    <Pressable
      onPress={() => onPress(index)}
      onHoverIn={() => onHoverIn(index)}
      onHoverOut={onHoverOut}
      style={[
        weaponPickerStyles.optionButton,
        { borderColor: rarityColor },
        isFocused && weaponPickerStyles.optionButtonSelected,
        ...(purchase ? [!purchase.canAfford && weaponPickerStyles.optionButtonUnaffordable] : []),
        Platform.OS === 'web' && { cursor: 'pointer' as any },
      ]}
    >
      {ownershipCount > 0 && (
        <View style={weaponPickerStyles.ownershipBadge}>
          <Text style={weaponPickerStyles.ownershipBadgeText}>{ownershipCount}/{weapon.maxCount}</Text>
        </View>
      )}
      <View style={weaponPickerStyles.optionIcon}>
        <WeaponAvatar weapon={weapon} size={30} triggerKey={triggerKey} />
      </View>
      {purchase && (
        <View style={weaponPickerStyles.optionHeader}>
          <Text style={[weaponPickerStyles.optionPrice, !purchase.canAfford && weaponPickerStyles.optionPriceUnaffordable]}>
            ${weapon.price}
          </Text>
        </View>
      )}
      <Text
        style={[
          weaponPickerStyles.optionText,
          isFocused && weaponPickerStyles.optionTextSelected,
        ]}
        numberOfLines={1}
      >
        {weapon.name}
      </Text>
      <Text style={[
        weaponPickerStyles.rarityTag,
        { color: isFocused && weapon.rarity === 'legendary' ? COLORS.canvasWhite : rarityColor }
      ]}>
        {getRarityLabel(weapon.rarity)}
      </Text>
    </Pressable>
  );
}

// =============================================================================
// Stat preview (before -> after, plus the cap increase of Mastery weapons)
// =============================================================================

/**
 * The three screens draw the same preview with slightly different spacing,
 * wording and "decrease" colour. Those differences are kept here, side by side.
 */
type StatPreviewVariant = 'shop' | 'levelUp' | 'modal';

const statPreviewVariant = (variant: StatPreviewVariant) => {
  switch (variant) {
    case 'shop':
      return {
        label: 'Stat Changes',
        box: [shopPreview.effectsBox, preview.effectsBoxPositive] as StyleProp<ViewStyle>,
        capBox: [shopPreview.effectsBox, preview.effectsBoxPositive, { marginTop: 8 }] as StyleProp<ViewStyle>,
        row: shopPreview.effectRow,
        values: shopPreview.statComparisonRow,
        statBefore: shopPreview.statBefore,
        statAfter: shopPreview.statAfter,
        statDecrease: shopPreview.statDecrease,
      };
    case 'levelUp':
      return {
        label: 'Stats Change',
        box: [levelUpPreview.effectsBox, preview.effectsBoxPositive] as StyleProp<ViewStyle>,
        capBox: [levelUpPreview.effectsBox, preview.effectsBoxPositive, { marginTop: 8 }] as StyleProp<ViewStyle>,
        row: levelUpPreview.statComparisonRow,
        values: levelUpPreview.statValues,
        statBefore: levelUpPreview.statBefore,
        statAfter: levelUpPreview.statAfter,
        statDecrease: levelUpPreview.statDecrease,
      };
    case 'modal':
      return {
        label: 'Stat Changes',
        box: modalPreview.effectsBox as StyleProp<ViewStyle>,
        capBox: [modalPreview.effectsBox, { marginTop: 8 }] as StyleProp<ViewStyle>,
        row: shopPreview.effectRow,
        values: shopPreview.statComparisonRow,
        statBefore: shopPreview.statBefore,
        statAfter: shopPreview.statAfter,
        statDecrease: shopPreview.statDecrease,
      };
  }
};

interface WeaponStatPreviewProps {
  weapon: Weapon;
  playerStats: PlayerStats;
  variant: StatPreviewVariant;
}

export function WeaponStatPreview({ weapon, playerStats, variant }: WeaponStatPreviewProps) {
  const v = statPreviewVariant(variant);
  const capInfo = weapon.capIncrease ? getCapIncreaseInfo(weapon, playerStats) : null;

  return (
    <>
      {Object.keys(weapon.effects).length > 0 && (
        <View style={v.box}>
          <Text style={preview.effectsLabelPositive}>{v.label}</Text>
          {getStatComparison(weapon, playerStats).map((stat, i) => (
            <View key={i} style={v.row}>
              <Text style={preview.effectKey}>{stat.key}</Text>
              <View style={v.values}>
                {stat.isPerWeapon ? (
                  // Effects that roll per weapon have no meaningful cumulative before -> after
                  <>
                    <Text style={[
                      v.statAfter,
                      stat.isIncrease ? preview.statIncrease : v.statDecrease,
                    ]}>
                      {stat.after}
                    </Text>
                    <Text style={preview.capIndicator}>(per weapon)</Text>
                  </>
                ) : (
                  <>
                    <Text style={v.statBefore}>{stat.before}</Text>
                    <Text style={preview.statArrow}>→</Text>
                    <Text style={[
                      v.statAfter,
                      stat.isIncrease ? preview.statIncrease : v.statDecrease,
                      stat.isCapped && preview.statCapped,
                    ]}>
                      {stat.after}
                    </Text>
                  </>
                )}
                {stat.cap !== null && (
                  <Text style={[preview.capIndicator, stat.isCapped && preview.capIndicatorCapped]}>
                    (max {stat.cap}%)
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {capInfo && (
        <View style={v.capBox}>
          <Text style={preview.effectsLabelPositive}>Cap Increase</Text>
          <View style={v.row}>
            <Text style={preview.effectKey}>Current {capInfo.statName}</Text>
            <Text style={v.statBefore}>{capInfo.currentValue}%</Text>
          </View>
          <View style={v.row}>
            <Text style={preview.effectKey}>Current Cap</Text>
            <Text style={v.statBefore}>{capInfo.currentCap}%</Text>
          </View>
          <View style={v.row}>
            <Text style={preview.effectKey}>New Cap</Text>
            <Text style={preview.statIncrease}>{capInfo.newCap}%</Text>
          </View>
        </View>
      )}
    </>
  );
}

// =============================================================================
// Detail card (WeaponShop and LevelUp)
// =============================================================================

interface WeaponDetailCardProps {
  weapon: Weapon;
  playerStats: PlayerStats;
  playerWeapons: Weapon[];
  variant: 'shop' | 'levelUp';
}

export function WeaponDetailCard({ weapon, playerStats, playerWeapons, variant }: WeaponDetailCardProps) {
  const rarityColor = getRarityColor(weapon.rarity);

  return (
    <View style={weaponPickerStyles.detailCard}>
      <ScrollView
        style={weaponPickerStyles.detailCardScroll}
        contentContainerStyle={weaponPickerStyles.detailCardContent}
        showsVerticalScrollIndicator={true}
        bounces={false}
      >
        <View style={[weaponPickerStyles.previewArea, { borderColor: rarityColor }]}>
          <WeaponAvatar weapon={weapon} size={46} interactive />
          <View style={[weaponPickerStyles.rarityBadge, { backgroundColor: rarityColor }]}>
            <Text style={weaponPickerStyles.rarityBadgeText}>{getRarityLabel(weapon.rarity)}</Text>
          </View>
          {variant === 'shop' && (
            <View style={weaponPickerStyles.priceBadge}>
              <Text style={weaponPickerStyles.priceBadgeText}>${weapon.price}</Text>
            </View>
          )}
          {weapon.maxCount !== undefined && (
            <View style={weaponPickerStyles.ownershipIndicator}>
              <Text style={weaponPickerStyles.ownershipIndicatorText}>
                {getPlayerWeaponCount(weapon.name, playerWeapons)}/{weapon.maxCount} owned
              </Text>
            </View>
          )}
        </View>

        <Text style={[weaponPickerStyles.detailName, { color: rarityColor }]}>
          {weapon.name}
        </Text>
        <KeywordText style={weaponPickerStyles.detailDescription}>{getDynamicDescription(weapon, playerStats)}</KeywordText>
        {weapon.flavorText && (
          <KeywordText style={weaponPickerStyles.detailFlavor}>{weapon.flavorText}</KeywordText>
        )}

        <View style={variant === 'shop' ? shopPreview.effectsContainer : levelUpPreview.effectsRow}>
          <WeaponStatPreview weapon={weapon} playerStats={playerStats} variant={variant} />
        </View>
      </ScrollView>
    </View>
  );
}

// =============================================================================
// Reroll button (WeaponShop and LevelUp)
// =============================================================================

interface RerollButtonProps {
  onReroll: () => void;
  rerollCost: number;
  playerMoney: number;
  freeRerolls: number;
}

export function RerollButton({ onReroll, rerollCost, playerMoney, freeRerolls }: RerollButtonProps) {
  const cannotReroll = playerMoney < rerollCost && freeRerolls <= 0;
  return (
    <TouchableOpacity
      onPress={onReroll}
      disabled={cannotReroll}
      style={[
        weaponPickerStyles.rerollButton,
        cannotReroll && weaponPickerStyles.rerollButtonDisabled,
      ]}
    >
      <Text style={weaponPickerStyles.rerollButtonText}>
        {freeRerolls > 0 ? `Reroll (${freeRerolls})` : `Reroll $${rerollCost}`}
      </Text>
    </TouchableOpacity>
  );
}

// =============================================================================
// Styles
// =============================================================================

/** Layout shared by the full-screen pickers (WeaponShop, LevelUp). */
export const weaponPickerStyles = StyleSheet.create({
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
  // Top half - detail
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
    overflow: 'hidden',
  },
  detailCardScroll: {
    flex: 1,
  },
  detailCardContent: {
    padding: 16,
    flexGrow: 1,
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
  // Bottom half - options
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
  // Action bar
  actionSection: {
    padding: 16,
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
  },
});

/** Stat preview styles that are the same on every screen. */
const preview = StyleSheet.create({
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
  effectKey: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 11,
    flex: 1,
    flexShrink: 1,
  },
  statArrow: {
    color: COLORS.slateCharcoal,
    fontSize: 10,
    opacity: 0.5,
  },
  statIncrease: {
    color: COLORS.logicTeal,
  },
  statCapped: {
    color: '#EAB308', // Amber: the stat is at its cap
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
});

const shopPreview = StyleSheet.create({
  effectsContainer: {
    flexDirection: 'column',
    gap: 8,
  },
  effectsBox: {
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
  },
  effectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  statComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  statBefore: {
    color: COLORS.slateCharcoal,
    fontSize: 11,
    fontFamily: 'monospace',
    opacity: 0.7,
    flexShrink: 0,
  },
  statAfter: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  statDecrease: {
    color: COLORS.impactRed,
  },
});

const levelUpPreview = StyleSheet.create({
  effectsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  effectsBox: {
    flex: 1,
    maxWidth: '100%',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    overflow: 'hidden',
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
  statAfter: {
    fontWeight: '700',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  statDecrease: {
    color: COLORS.impactOrange,
  },
});

const modalPreview = StyleSheet.create({
  effectsBox: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.logicTeal,
  },
});
