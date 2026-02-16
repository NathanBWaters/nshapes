import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { usePWASafeAreaInsets } from '@/utils/usePWASafeAreaInsets';
import { PlayerStats, Weapon, LevelUpOption, FusionWeapon, PlayerInventory, WeaponLevel } from '@/types';
import { COLORS, RADIUS, getRarityColor } from '@/utils/colors';
import {
  getDynamicDescription,
  getStatComparison,
  getCapIncreaseInfo,
  getRarityLabel,
} from '@/utils/weaponDisplay';
import Icon from './Icon';
import GameMenu from './GameMenu';
import InventoryDisplay, { InventorySlotInfo } from './InventoryDisplay';
import { ScreenTransition } from './ScreenTransition';
import KeywordText from './KeywordText';
import { playSound } from '@/utils/sounds';
import { getPlayerWeaponCount } from '@/utils/gameDefinitions';

// Level up option component
interface LevelUpItemProps {
  option: LevelUpOption;
  index: number;
  isFocused: boolean;
  rarityColor: string;
  onPress: (index: number) => void;
  onHoverIn: (index: number) => void;
  onHoverOut: () => void;
}

function LevelUpItem({
  option,
  index,
  isFocused,
  rarityColor,
  onPress,
  onHoverIn,
  onHoverOut,
}: LevelUpItemProps) {
  const { type, item } = option;
  const isUpgrade = type === 'upgrade';
  const newLevel = isUpgrade ? Math.min(3, item.level + 1) : 1;

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
      {/* NEW or UPGRADE badge */}
      <View style={[
        styles.typeBadge,
        isUpgrade ? styles.upgradeBadge : styles.newBadge
      ]}>
        <Text style={styles.typeBadgeText}>
          {isUpgrade ? `LV${newLevel}` : 'NEW'}
        </Text>
      </View>
      {item.icon && (
        <View style={styles.optionIcon}>
          <Icon
            name={item.icon}
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
        {item.name}
      </Text>
      <Text style={[
        styles.rarityTag,
        { color: isFocused ? COLORS.canvasWhite : COLORS.slateCharcoal }
      ]}>
        {item.type === 'weapon' ? 'WEAPON' : 'PASSIVE'}
      </Text>
    </Pressable>
  );
}

interface LevelUpProps {
  options: LevelUpOption[];
  onSelect: (option: LevelUpOption) => void;
  onReroll: () => void;
  rerollCost: number;
  playerMoney: number;
  freeRerolls: number;
  playerStats: PlayerStats;
  playerWeapons?: Weapon[];
  playerInventory?: PlayerInventory;
  onExitGame?: () => void;
  targetLevel: number;         // The level this reward is for
  hasMoreLevelUps: boolean;    // True if more level-ups pending after this
}

const LevelUp: React.FC<LevelUpProps> = ({
  options,
  onSelect,
  onReroll,
  rerollCost,
  playerMoney,
  freeRerolls,
  playerStats,
  playerWeapons = [],
  playerInventory,
  onExitGame,
  targetLevel,
  hasMoreLevelUps,
}) => {
  const insets = usePWASafeAreaInsets();
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  // State for viewing an existing inventory item
  const [viewingInventoryItem, setViewingInventoryItem] = useState<InventorySlotInfo | null>(null);

  // Reset focusedIndex when options change to ensure it's valid
  useEffect(() => {
    if (focusedIndex >= options.length && options.length > 0) {
      setFocusedIndex(0);
    }
    if (focusedIndex < options.length && options[focusedIndex] === undefined && options.length > 0) {
      const firstValid = options.findIndex(opt => opt !== undefined);
      if (firstValid >= 0) {
        setFocusedIndex(firstValid);
      }
    }
  }, [options, focusedIndex]);

  // Handle inventory item selection - show its details
  const handleInventoryItemSelect = (slotInfo: InventorySlotInfo) => {
    playSound('click');
    setViewingInventoryItem(slotInfo);
  };

  // Show hovered option if hovering, otherwise show focused, unless viewing inventory item
  const displayedIndex = hoveredIndex !== null ? hoveredIndex : focusedIndex;
  const focusedOption = viewingInventoryItem ? null : options[displayedIndex];
  const focusedItem = viewingInventoryItem?.item || focusedOption?.item;

  return (
    <ScreenTransition>
      <View style={styles.container}>
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

      {/* Inventory Display - 4 weapons on top, 4 passives on bottom */}
      {playerInventory && (
        <View style={styles.inventorySection}>
          <InventoryDisplay
            inventory={playerInventory}
            onItemSelect={handleInventoryItemSelect}
            selectedSlot={viewingInventoryItem
              ? { type: viewingInventoryItem.slotType, index: viewingInventoryItem.slotIndex }
              : null}
            showLabels={true}
            compact={false}
          />
        </View>
      )}

      {/* Top Half - Detail Focus */}
      <View style={styles.detailSection}>
        {/* Viewing existing inventory item */}
        {viewingInventoryItem ? (
          <View style={styles.detailCard}>
            <ScrollView
              style={styles.detailCardScroll}
              contentContainerStyle={styles.detailCardContent}
              showsVerticalScrollIndicator={true}
              bounces={false}
            >
              {/* Item Icon with EQUIPPED indicator */}
              <View style={[
                styles.previewArea,
                { borderColor: COLORS.slateCharcoal }
              ]}>
                {viewingInventoryItem.item.icon ? (
                  <Icon name={viewingInventoryItem.item.icon} size={32} color={COLORS.slateCharcoal} />
                ) : (
                  <Text style={styles.previewLabel}>{viewingInventoryItem.item.type.toUpperCase()}</Text>
                )}
                <View style={[
                  styles.rarityBadge,
                  { backgroundColor: COLORS.slateCharcoal }
                ]}>
                  <Text style={styles.rarityBadgeText}>
                    EQUIPPED • LEVEL {viewingInventoryItem.item.level}
                  </Text>
                </View>
              </View>

              {/* Item Info */}
              <Text style={[styles.detailName, { color: COLORS.slateCharcoal }]}>
                {viewingInventoryItem.item.name}
              </Text>
              <KeywordText style={styles.detailDescription}>{viewingInventoryItem.item.description}</KeywordText>
              {viewingInventoryItem.item.flavorText && (
                <KeywordText style={styles.detailFlavor}>{viewingInventoryItem.item.flavorText}</KeywordText>
              )}

              {/* Current Level Effects */}
              {viewingInventoryItem.item.levelEffects && (() => {
                const currentLevel = viewingInventoryItem.item.level as WeaponLevel;
                const effects = viewingInventoryItem.item.levelEffects[currentLevel];
                if (!effects || Object.keys(effects).length === 0) return null;

                return (
                  <View style={[styles.effectsBox, styles.effectsBoxPositive]}>
                    <Text style={styles.effectsLabelPositive}>
                      Current Effects (Level {currentLevel})
                    </Text>
                    {Object.entries(effects).map(([key, value], i) => (
                      <View key={i} style={styles.statComparisonRow}>
                        <Text style={styles.effectKey}>{key}</Text>
                        <Text style={styles.statIncrease}>
                          {typeof value === 'number' && value > 0 ? '+' : ''}{value}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Item Type Badge */}
              <View style={styles.itemTypeBadge}>
                <Text style={styles.itemTypeBadgeText}>
                  {viewingInventoryItem.item.type === 'weapon' ? '⚔️ WEAPON' : '🛡️ PASSIVE'}
                </Text>
              </View>

              {/* Button to go back to level-up options */}
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  playSound('click');
                  setViewingInventoryItem(null);
                }}
              >
                <Text style={styles.backButtonText}>← Back to Options</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        ) : focusedOption && focusedItem ? (
          <View style={styles.detailCard}>
            <ScrollView
              style={styles.detailCardScroll}
              contentContainerStyle={styles.detailCardContent}
              showsVerticalScrollIndicator={true}
              bounces={false}
            >
              {/* Item Icon with NEW/UPGRADE indicator */}
              <View style={[
                styles.previewArea,
                { borderColor: focusedOption.type === 'upgrade' ? COLORS.impactOrange : COLORS.logicTeal }
              ]}>
                {focusedItem.icon ? (
                  <Icon name={focusedItem.icon} size={32} color={COLORS.slateCharcoal} />
                ) : (
                  <Text style={styles.previewLabel}>{focusedItem.type.toUpperCase()}</Text>
                )}
                <View style={[
                  styles.rarityBadge,
                  { backgroundColor: focusedOption.type === 'upgrade' ? COLORS.impactOrange : COLORS.logicTeal }
                ]}>
                  <Text style={styles.rarityBadgeText}>
                    {focusedOption.type === 'upgrade'
                      ? `UPGRADE TO LV${Math.min(3, focusedItem.level + 1)}`
                      : 'NEW ITEM'}
                  </Text>
                </View>
              </View>

              {/* Item Info */}
              <Text style={[
                styles.detailName,
                { color: focusedOption.type === 'upgrade' ? COLORS.impactOrange : COLORS.logicTeal }
              ]}>
                {focusedItem.name}
              </Text>
              <KeywordText style={styles.detailDescription}>{focusedItem.description}</KeywordText>
              {focusedItem.flavorText && (
                <KeywordText style={styles.detailFlavor}>{focusedItem.flavorText}</KeywordText>
              )}

              {/* Level Effects Display */}
              {focusedItem.levelEffects && (() => {
                const targetLevel = focusedOption.type === 'upgrade'
                  ? Math.min(3, focusedItem.level + 1) as WeaponLevel
                  : 1;
                const effects = focusedItem.levelEffects[targetLevel];
                if (!effects || Object.keys(effects).length === 0) return null;

                return (
                  <View style={[styles.effectsBox, styles.effectsBoxPositive]}>
                    <Text style={styles.effectsLabelPositive}>
                      Level {targetLevel} Effects
                    </Text>
                    {Object.entries(effects).map(([key, value], i) => (
                      <View key={i} style={styles.statComparisonRow}>
                        <Text style={styles.effectKey}>{key}</Text>
                        <Text style={styles.statIncrease}>
                          {typeof value === 'number' && value > 0 ? '+' : ''}{value}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Item Type Badge */}
              <View style={styles.itemTypeBadge}>
                <Text style={styles.itemTypeBadgeText}>
                  {focusedItem.type === 'weapon' ? '⚔️ WEAPON' : '🛡️ PASSIVE'}
                </Text>
              </View>
            </ScrollView>
          </View>
        ) : (
          <View style={styles.emptyDetail}>
            <Text style={styles.emptyText}>Select an item below</Text>
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
          {options.map((option, index) => {
            const isFocused = focusedIndex === index;
            const rarityColor = option.type === 'upgrade' ? COLORS.impactOrange : COLORS.logicTeal;

            return (
              <LevelUpItem
                key={`${option.item.id}-${index}`}
                option={option}
                index={index}
                isFocused={isFocused}
                rarityColor={rarityColor}
                onPress={(index) => {
                  playSound('click');
                  setHoveredIndex(null);
                  setFocusedIndex(index);
                }}
                onHoverIn={setHoveredIndex}
                onHoverOut={() => setHoveredIndex(null)}
              />
            );
          })}
        </ScrollView>
      </View>

      {/* Action Button */}
      <View style={[styles.actionSection, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity
          onPress={() => {
            if (focusedOption) {
              playSound('confirm');
              onSelect(focusedOption);
            }
          }}
          disabled={!focusedOption}
          style={[styles.actionButton, !focusedOption && styles.actionButtonDisabled]}
        >
          <Text style={styles.actionButtonText}>
            {hasMoreLevelUps ? 'Next Level Up' : (focusedOption?.type === 'upgrade' ? 'Upgrade Item' : 'Get Item')}
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
    maxWidth: '100%',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    overflow: 'hidden',
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
    flexShrink: 1,
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
  // Type badges for NEW/UPGRADE indicators
  typeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
  },
  newBadge: {
    backgroundColor: COLORS.logicTeal,
  },
  upgradeBadge: {
    backgroundColor: COLORS.impactOrange,
  },
  typeBadgeText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  // Item type badge in detail view
  itemTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.paperBeige,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  itemTypeBadgeText: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  // Inventory section
  inventorySection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  // Back button for inventory item view
  backButton: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: COLORS.logicTeal,
    fontWeight: '600',
    fontSize: 12,
  },
});

export default LevelUp;
