import React, { memo, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import Icon from '@/components/Icon';
import { WeaponArtwork } from '@/components/weapons/WeaponArtwork';
import type { WeaponRarity } from '@/types';
import { SPRING } from '@/utils/motion';
import {
  CHARM_BY_ID,
  getActiveSynergies,
  getCharmSellValue,
  getCharmStatusLabel,
  getSynergiesForCharm,
} from '../data/charms';
import type { CharmDef, CharmRarity, OwnedCharm, PrismRun } from '../types';
import {
  PRISM_COLORS,
  playPrismSfx,
  roleBadgeLabel,
  roleColor,
} from './prismTheme';

export interface PrismJokerBeltProps {
  run: PrismRun;
  triggeredCharmIds?: readonly string[];
  disabledCharmIndex?: number | null;
  canReorder?: boolean;
  canSell?: boolean;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onSell?: (index: number) => void;
  compact?: boolean;
}

const mapRarityToArtwork = (rarity: CharmRarity): WeaponRarity => {
  if (rarity === 'rare') return 'epic';
  if (rarity === 'uncommon') return 'rare';
  return 'common';
};

const RARITY_COLOR: Record<CharmRarity, string> = {
  common: '#94A3B8',
  uncommon: '#38BDF8',
  rare: '#C084FC',
};

const CharmSlotCard: React.FC<{
  owned: OwnedCharm;
  def: CharmDef;
  index: number;
  statusLabel: string;
  triggered: boolean;
  disabled: boolean;
  selected: boolean;
  compact: boolean;
  onPress: () => void;
}> = memo(function CharmSlotCard({
  owned,
  def,
  index,
  statusLabel,
  triggered,
  disabled,
  selected,
  compact,
  onPress,
}) {
  const popScale = useSharedValue(1);

  useEffect(() => {
    if (triggered && !disabled) {
      popScale.value = withSequence(
        withSpring(1.07, SPRING.lively),
        withSpring(1, SPRING.snappy)
      );
    } else {
      popScale.value = withSpring(1, SPRING.snappy);
    }
  }, [triggered, disabled, popScale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: popScale.value }],
  }));

  const rColor = roleColor(def.role);
  const shattered = owned.charmId === 'glass-sword' && Boolean(owned.state.shattered);
  const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : undefined;

  if (compact) {
    return (
      <Animated.View style={animStyle}>
        <TouchableOpacity
          testID={`prism-charm-slot-${index}`}
          accessibilityRole="button"
          accessibilityLabel={`${def.name}, ${roleBadgeLabel(def.role)}${disabled ? ', disabled' : ''}${triggered ? ', active' : ''}`}
          activeOpacity={0.85}
          onPress={onPress}
          style={[
            styles.slotCardCompactRow,
            triggered && !disabled && styles.slotCardTriggered,
            selected && styles.slotCardSelected,
            disabled && styles.slotCardDisabled,
            webCursor,
          ]}
        >
          <View style={styles.artBoxCompact}>
            {def.artworkWeaponId ? (
              <WeaponArtwork name={def.artworkWeaponId} rarity={mapRarityToArtwork(def.rarity)} />
            ) : (
              <View style={[styles.iconEmblem, { borderColor: def.accentColor }]}>
                <Icon name={def.icon} size={18} color={def.accentColor} noShadow />
              </View>
            )}
          </View>

          <View style={styles.compactChipMeta}>
            <Text style={styles.charmNameCompact} numberOfLines={1} ellipsizeMode="tail">
              {def.name}
            </Text>
            <View style={styles.compactChipSubRow}>
              <View style={[styles.rolePill, { backgroundColor: rColor }]}>
                <Text style={styles.rolePillText}>{roleBadgeLabel(def.role)}</Text>
              </View>
              {disabled ? (
                <Text style={styles.compactEclipsedText} numberOfLines={1}>
                  Eclipsed
                </Text>
              ) : (
                <Text
                  style={[styles.compactStatusText, triggered && styles.statusTextTriggered]}
                  numberOfLines={1}
                >
                  {statusLabel || `#${index + 1}`}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        testID={`prism-charm-slot-${index}`}
        accessibilityRole="button"
        accessibilityLabel={`${def.name}, ${roleBadgeLabel(def.role)}${disabled ? ', disabled' : ''}${triggered ? ', active' : ''}`}
        activeOpacity={0.85}
        onPress={onPress}
        style={[
          styles.slotCard,
          styles.slotCardNormal,
          triggered && !disabled && styles.slotCardTriggered,
          selected && styles.slotCardSelected,
          disabled && styles.slotCardDisabled,
          webCursor,
        ]}
      >
        {/* Slot order & Role pill */}
        <View style={styles.slotTopRow}>
          <Text style={styles.slotIndexText}>#{index + 1}</Text>
          <View style={[styles.rolePill, { backgroundColor: rColor }]}>
            <Text style={styles.rolePillText}>{roleBadgeLabel(def.role)}</Text>
          </View>
        </View>

        {/* Artwork or registered Icon */}
        <View style={styles.artBox}>
          {def.artworkWeaponId ? (
            <WeaponArtwork name={def.artworkWeaponId} rarity={mapRarityToArtwork(def.rarity)} />
          ) : (
            <View style={[styles.iconEmblem, { borderColor: def.accentColor }]}>
              <Icon
                name={def.icon}
                size={28}
                color={def.accentColor}
                noShadow
              />
            </View>
          )}
        </View>

        {/* Name (2 lines so long Charm titles like Alchemist's Flask never clip) */}
        <Text
          style={styles.charmName}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {def.name}
        </Text>

        {/* Live dynamic status */}
        {statusLabel.length > 0 && (
          <Text
            style={[
              styles.statusText,
              triggered && !disabled && styles.statusTextTriggered,
              disabled && styles.statusTextDisabled,
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {statusLabel}
          </Text>
        )}

        {/* Disabled (Boss Eclipse) badge */}
        {disabled && (
          <View style={styles.disabledBanner} pointerEvents="none">
            <Icon name="lorc/moon" size={11} color="#E0E7FF" noShadow />
            <Text style={styles.disabledBannerText}>ECLIPSED</Text>
          </View>
        )}

        {/* Shattered Glass Sword overlay */}
        {!disabled && shattered && (
          <View style={styles.shatteredPip} pointerEvents="none">
            <Icon name="lorc/shattered-glass" size={11} color="#FCA5A5" noShadow />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

const PrismJokerBelt: React.FC<PrismJokerBeltProps> = ({
  run,
  triggeredCharmIds = [],
  disabledCharmIndex = null,
  canReorder = true,
  canSell = true,
  onReorder,
  onSell,
  compact = false,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeSynergyInspect, setActiveSynergyInspect] = useState<string | null>(null);

  const safeSelectedIndex =
    selectedIndex !== null && selectedIndex >= 0 && selectedIndex < run.charms.length
      ? selectedIndex
      : null;

  const activeSynergies = getActiveSynergies(run);
  const triggeredSet = new Set(triggeredCharmIds);
  const emptyCount = Math.max(0, run.maxCharms - run.charms.length);

  const inspectedOwned = safeSelectedIndex !== null ? run.charms[safeSelectedIndex] : null;
  const inspectedDef = inspectedOwned ? CHARM_BY_ID[inspectedOwned.charmId] : null;
  const inspectedSynergies = inspectedDef ? getSynergiesForCharm(inspectedDef.id) : [];
  const inspectedStatus = inspectedOwned ? getCharmStatusLabel(inspectedOwned, run) : '';
  const inspectedDisabled = safeSelectedIndex !== null && disabledCharmIndex === safeSelectedIndex;

  const handleToggleSlot = (idx: number) => {
    playPrismSfx('click');
    setActiveSynergyInspect(null);
    setSelectedIndex(prev => (prev === idx ? null : idx));
  };

  const handleMoveLeft = () => {
    if (safeSelectedIndex === null || safeSelectedIndex <= 0 || !onReorder) return;
    playPrismSfx('click');
    const nextIdx = safeSelectedIndex - 1;
    onReorder(safeSelectedIndex, nextIdx);
    setSelectedIndex(nextIdx);
  };

  const handleMoveRight = () => {
    if (safeSelectedIndex === null || safeSelectedIndex >= run.charms.length - 1 || !onReorder) return;
    playPrismSfx('click');
    const nextIdx = safeSelectedIndex + 1;
    onReorder(safeSelectedIndex, nextIdx);
    setSelectedIndex(nextIdx);
  };

  const handleSell = () => {
    if (safeSelectedIndex === null || !onSell) return;
    playPrismSfx('sell');
    onSell(safeSelectedIndex);
    setSelectedIndex(null);
  };

  const inspectedSynergyDetail = activeSynergyInspect
    ? activeSynergies.find(s => s.id === activeSynergyInspect) ?? null
    : null;

  // Collapsed single-row ~30px bar when compact & no Charms owned yet (preserves mobile board height)
  if (compact && run.charms.length === 0) {
    return (
      <View style={styles.compactEmptyContainer}>
        <View style={styles.headerLeft}>
          <Icon name="lorc/belt-buckles" size={13} color={PRISM_COLORS.gold} noShadow />
          <Text style={styles.headerTitle}>CHARMS</Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>0/{run.maxCharms}</Text>
          </View>
        </View>
        <Text style={styles.compactEmptyHint}>Buy Charms in Shop</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Header row (shown full on desktop; on compact mobile shown inline with scroll strip unless Synergies exist) */}
      {(!compact || activeSynergies.length > 0) && (
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Icon name="lorc/belt-buckles" size={14} color={PRISM_COLORS.gold} noShadow />
            <Text style={styles.headerTitle}>CHARMS</Text>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>
                {run.charms.length}/{run.maxCharms}
              </Text>
            </View>
            {run.charms.length >= 2 && !compact && (
              <Text style={styles.orderHint}>Scores L → R</Text>
            )}
          </View>

          {activeSynergies.length > 0 && (
            <View style={styles.synergyRow}>
              {activeSynergies.map(syn => {
                const isOpen = activeSynergyInspect === syn.id;
                return (
                  <TouchableOpacity
                    key={syn.id}
                    testID={`prism-synergy-${syn.id}`}
                    activeOpacity={0.85}
                    onPress={() => {
                      playPrismSfx('click');
                      setSelectedIndex(null);
                      setActiveSynergyInspect(prev => (prev === syn.id ? null : syn.id));
                    }}
                    style={[
                      styles.synergyPill,
                      { borderColor: syn.accentColor },
                      isOpen && styles.synergyPillActive,
                    ]}
                  >
                    <Icon name={syn.icon} size={12} color={PRISM_COLORS.gold} noShadow />
                    <Text style={styles.synergyPillText} numberOfLines={1}>
                      {syn.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Active Synergy quick detail banner */}
      {inspectedSynergyDetail && (
        <View style={styles.synergyDetailBox}>
          <View style={styles.synergyDetailHeader}>
            <Icon name={inspectedSynergyDetail.icon} size={15} color={PRISM_COLORS.gold} noShadow />
            <Text style={styles.synergyDetailTitle} numberOfLines={1}>
              Synergy Active: {inspectedSynergyDetail.name}
            </Text>
            <TouchableOpacity
              onPress={() => setActiveSynergyInspect(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.synergyDetailDesc}>{inspectedSynergyDetail.description}</Text>
        </View>
      )}

      {/* Horizontal Charm Belt */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.beltScroll, compact && styles.beltScrollCompact]}
      >
        {compact && activeSynergies.length === 0 && (
          <View style={styles.compactInlineBadge}>
            <Icon name="lorc/belt-buckles" size={12} color={PRISM_COLORS.gold} noShadow />
            <Text style={styles.compactInlineCount}>
              {run.charms.length}/{run.maxCharms}
            </Text>
          </View>
        )}

        {run.charms.map((owned, idx) => {
          const def = CHARM_BY_ID[owned.charmId];
          if (!def) return null;
          const isDisabled = disabledCharmIndex === idx;
          const isTriggered = triggeredSet.has(owned.charmId);
          return (
            <CharmSlotCard
              key={owned.instanceId}
              owned={owned}
              def={def}
              index={idx}
              statusLabel={getCharmStatusLabel(owned, run)}
              triggered={isTriggered}
              disabled={isDisabled}
              selected={safeSelectedIndex === idx}
              compact={compact}
              onPress={() => handleToggleSlot(idx)}
            />
          );
        })}

        {!compact &&
          Array.from({ length: emptyCount }).map((_, idx) => (
            <View
              key={`empty-${idx}`}
              style={[styles.emptySlot, styles.slotCardNormal]}
            >
              <Icon name="delapouite/prism" size={20} color="rgba(159, 184, 174, 0.28)" noShadow />
              <Text style={styles.emptySlotText}>Empty</Text>
            </View>
          ))}
      </ScrollView>

      {/* Inline Charm Inspector Panel */}
      {inspectedOwned && inspectedDef && safeSelectedIndex !== null && (
        <View testID="prism-charm-inspector" style={styles.inspector}>
          <View style={styles.inspectorHeader}>
            <View style={styles.inspectorArt}>
              {inspectedDef.artworkWeaponId ? (
                <WeaponArtwork
                  name={inspectedDef.artworkWeaponId}
                  rarity={mapRarityToArtwork(inspectedDef.rarity)}
                />
              ) : (
                <Icon name={inspectedDef.icon} size={30} color={inspectedDef.accentColor} noShadow />
              )}
            </View>

            <View style={styles.inspectorMeta}>
              <View style={styles.inspectorTitleRow}>
                <Text style={styles.inspectorName} numberOfLines={1}>
                  {inspectedDef.name}
                </Text>
                <View style={[styles.rolePill, { backgroundColor: roleColor(inspectedDef.role) }]}>
                  <Text style={styles.rolePillText}>{roleBadgeLabel(inspectedDef.role)}</Text>
                </View>
                <View style={[styles.rarityPill, { borderColor: RARITY_COLOR[inspectedDef.rarity] }]}>
                  <Text style={[styles.rarityText, { color: RARITY_COLOR[inspectedDef.rarity] }]}>
                    {inspectedDef.rarity.toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.inspectorDesc}>{inspectedDef.description}</Text>

              {inspectedStatus.length > 0 && (
                <View style={styles.inspectorStatusRow}>
                  <Text style={[styles.inspectorStatus, inspectedDisabled && styles.statusTextDisabled]}>
                    Live: {inspectedStatus}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              accessibilityLabel="Close charm inspector"
              onPress={() => setSelectedIndex(null)}
              style={styles.inspectorCloseBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Synergy partner hint */}
          {inspectedSynergies.length > 0 && (
            <View style={styles.synergyHintList}>
              {inspectedSynergies.map(syn => {
                const partnerId = syn.charmA === inspectedDef.id ? syn.charmB : syn.charmA;
                const partnerDef = CHARM_BY_ID[partnerId];
                const isPairActive = activeSynergies.some(a => a.id === syn.id);
                return (
                  <View
                    key={syn.id}
                    style={[styles.synergyHintRow, isPairActive && styles.synergyHintRowActive]}
                  >
                    <Icon name={syn.icon} size={13} color={isPairActive ? PRISM_COLORS.gold : PRISM_COLORS.textMuted} noShadow />
                    <Text style={styles.synergyHintText}>
                      <Text style={styles.synergyHintBold}>
                        {isPairActive ? `✓ ${syn.name}` : `Synergy (${syn.name})`}
                      </Text>
                      {` + ${partnerDef?.name ?? partnerId}: ${syn.description}`}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Reorder & Sell Controls */}
          {((canReorder && onReorder) || (canSell && onSell)) && (
            <View style={styles.inspectorActions}>
              {canReorder && onReorder && (
                <>
                  <TouchableOpacity
                    testID="prism-charm-move-left"
                    accessibilityRole="button"
                    accessibilityLabel="Move charm left"
                    disabled={safeSelectedIndex <= 0}
                    onPress={handleMoveLeft}
                    style={[
                      styles.actionBtn,
                      styles.reorderBtn,
                      safeSelectedIndex <= 0 && styles.actionBtnDisabled,
                    ]}
                  >
                    <Text style={styles.actionBtnText}>← Left</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    testID="prism-charm-move-right"
                    accessibilityRole="button"
                    accessibilityLabel="Move charm right"
                    disabled={safeSelectedIndex >= run.charms.length - 1}
                    onPress={handleMoveRight}
                    style={[
                      styles.actionBtn,
                      styles.reorderBtn,
                      safeSelectedIndex >= run.charms.length - 1 && styles.actionBtnDisabled,
                    ]}
                  >
                    <Text style={styles.actionBtnText}>Right →</Text>
                  </TouchableOpacity>
                </>
              )}

              {canSell && onSell && (
                <TouchableOpacity
                  testID="prism-charm-sell"
                  accessibilityRole="button"
                  accessibilityLabel={`Sell ${inspectedDef.name} for $${getCharmSellValue(inspectedDef.id)}`}
                  onPress={handleSell}
                  style={[styles.actionBtn, styles.sellBtn]}
                >
                  <Icon name="lorc/cash" size={14} color="#FFFFFF" noShadow />
                  <Text style={styles.sellBtnText}>
                    Sell (+${getCharmSellValue(inspectedDef.id)})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  containerCompact: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 5,
  },
  compactEmptyContainer: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    paddingHorizontal: 9,
    paddingVertical: 5,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  compactEmptyHint: {
    fontSize: 11,
    fontWeight: '600',
    color: PRISM_COLORS.textMuted,
  },
  beltScrollCompact: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 0,
  },
  compactInlineBadge: {
    height: 44,
    paddingHorizontal: 7,
    borderRadius: 8,
    backgroundColor: PRISM_COLORS.feltDeep,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  compactInlineCount: {
    fontSize: 11,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
  },
  slotCardCompactRow: {
    height: 44,
    minWidth: 126,
    maxWidth: 164,
    borderRadius: 9,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    paddingHorizontal: 6,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactChipMeta: {
    flex: 1,
    gap: 2,
  },
  compactChipSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
    flexShrink: 1,
  },
  compactEclipsedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A5B4FC',
    flexShrink: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: PRISM_COLORS.gold,
    letterSpacing: 1.2,
  },
  countPill: {
    backgroundColor: PRISM_COLORS.feltElevated,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  orderHint: {
    fontSize: 11,
    fontWeight: '600',
    color: PRISM_COLORS.textMuted,
  },
  synergyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  synergyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(242, 201, 76, 0.14)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: 180,
  },
  synergyPillActive: {
    backgroundColor: 'rgba(242, 201, 76, 0.26)',
  },
  synergyPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRISM_COLORS.brassLight,
    flexShrink: 1,
  },
  synergyDetailBox: {
    backgroundColor: PRISM_COLORS.feltDeep,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PRISM_COLORS.goldDark,
    padding: 8,
    gap: 4,
  },
  synergyDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  synergyDetailTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: PRISM_COLORS.gold,
  },
  synergyDetailDesc: {
    fontSize: 12,
    color: PRISM_COLORS.textPrimary,
    lineHeight: 16,
  },
  beltScroll: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    paddingVertical: 2,
  },
  slotCard: {
    borderRadius: 10,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  slotCardNormal: {
    width: 122,
    minHeight: 102,
  },
  slotCardCompact: {
    width: 82,
    minHeight: 70,
    padding: 5,
  },
  slotCardTriggered: {
    borderColor: PRISM_COLORS.gold,
    borderWidth: 2,
    backgroundColor: '#25473A',
    shadowColor: PRISM_COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  slotCardSelected: {
    borderColor: PRISM_COLORS.brassLight,
    borderWidth: 2,
    backgroundColor: '#214A3D',
  },
  slotCardDisabled: {
    opacity: 0.48,
    borderColor: '#6366F1',
  },
  slotTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
  },
  slotIndexText: {
    fontSize: 10,
    fontWeight: '800',
    color: PRISM_COLORS.textMuted,
  },
  rolePill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  rolePillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#071611',
  },
  artBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  artBoxCompact: {
    width: 28,
    height: 28,
  },
  iconEmblem: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: 'rgba(7, 22, 17, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  charmName: {
    fontSize: 11,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
    textAlign: 'center',
    width: '100%',
    lineHeight: 13,
    minHeight: 26,
  },
  charmNameCompact: {
    fontSize: 11,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: PRISM_COLORS.textMuted,
    textAlign: 'center',
    width: '100%',
  },
  statusTextTriggered: {
    color: PRISM_COLORS.gold,
  },
  statusTextDisabled: {
    color: '#A5B4FC',
  },
  disabledBanner: {
    position: 'absolute',
    bottom: 22,
    left: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: 'rgba(49, 46, 129, 0.92)',
    borderRadius: 5,
    paddingVertical: 2,
  },
  disabledBannerText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#E0E7FF',
    letterSpacing: 0.4,
  },
  shatteredPip: {
    position: 'absolute',
    top: 22,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(127, 29, 29, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlot: {
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(44, 89, 75, 0.7)',
    backgroundColor: 'rgba(7, 22, 17, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptySlotText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(159, 184, 174, 0.45)',
  },
  inspector: {
    backgroundColor: PRISM_COLORS.feltDeep,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.goldDark,
    padding: 10,
    gap: 8,
  },
  inspectorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  inspectorArt: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  inspectorMeta: {
    flex: 1,
    gap: 4,
  },
  inspectorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  inspectorName: {
    fontSize: 14,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
    flexShrink: 1,
  },
  rarityPill: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  rarityText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  inspectorDesc: {
    fontSize: 12,
    color: PRISM_COLORS.textPrimary,
    lineHeight: 17,
  },
  inspectorStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inspectorStatus: {
    fontSize: 12,
    fontWeight: '800',
    color: PRISM_COLORS.gold,
  },
  inspectorCloseBtn: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: {
    fontSize: 15,
    fontWeight: '900',
    color: PRISM_COLORS.textMuted,
  },
  synergyHintList: {
    gap: 4,
  },
  synergyHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(26, 58, 48, 0.5)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  synergyHintRowActive: {
    backgroundColor: 'rgba(242, 201, 76, 0.14)',
    borderWidth: 1,
    borderColor: PRISM_COLORS.goldDark,
  },
  synergyHintText: {
    flex: 1,
    fontSize: 11,
    color: PRISM_COLORS.textMuted,
    lineHeight: 16,
  },
  synergyHintBold: {
    fontWeight: '800',
    color: PRISM_COLORS.brassLight,
  },
  inspectorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  reorderBtn: {
    flex: 1,
    minWidth: 88,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
  },
  sellBtn: {
    flex: 1,
    minWidth: 108,
    backgroundColor: '#991B1B',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  actionBtnDisabled: {
    opacity: 0.35,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  sellBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});

export default PrismJokerBelt;
