import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '@/components/Icon';
import {
  COLOR_LABELS,
  PRISM_COLORS as CARD_COLOR_LIST,
  PRISM_NUMBERS,
  PRISM_SHAPES,
  SHAPE_LABELS,
  formatCardLabel,
} from '../data/cards';
import { SPELL_BY_ID } from '../data/spells';
import type { PrismCard, PrismColor, PrismNumber, PrismRun, PrismShape } from '../types';
import {
  PRISM_COLORBLIND_LETTER,
  PRISM_COLORS,
  getPrismShapeColor,
  playPrismSfx,
} from './prismTheme';

export interface PrismSpellPocketProps {
  run: PrismRun;
  activeSpellIndex: number | null;
  pendingTargetCard: PrismCard | null;
  colorblind?: boolean;
  compact?: boolean;
  onSelectSpell: (spellIndex: number) => void;
  onChooseValue: (value: PrismColor | PrismShape | PrismNumber) => void;
  onCancel: () => void;
}

const PrismSpellPocket: React.FC<PrismSpellPocketProps> = ({
  run,
  activeSpellIndex,
  pendingTargetCard,
  colorblind = false,
  compact = false,
  onSelectSpell,
  onChooseValue,
  onCancel,
}) => {
  const activeOwned =
    activeSpellIndex !== null && activeSpellIndex >= 0 && activeSpellIndex < run.spells.length
      ? run.spells[activeSpellIndex]
      : null;
  const activeDef = activeOwned ? SPELL_BY_ID[activeOwned.spellId] : null;
  const emptySlots = Math.max(0, run.maxSpells - run.spells.length);
  const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : undefined;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Targeting Banner (when a spell is armed) */}
      {activeDef && (
        <View testID="prism-spell-targeting-bar" style={styles.targetBanner}>
          <View style={styles.targetHeaderRow}>
            <Icon name={activeDef.icon} size={16} color={PRISM_COLORS.gold} noShadow />
            <Text style={styles.targetTitle} numberOfLines={2}>
              {pendingTargetCard
                ? `${activeDef.name} on ${formatCardLabel(pendingTargetCard)} — pick new value:`
                : `Casting ${activeDef.name}: Tap a highlighted card on the board`}
            </Text>
            <TouchableOpacity
              testID="prism-spell-cancel"
              accessibilityRole="button"
              accessibilityLabel="Cancel spell targeting"
              onPress={() => {
                playPrismSfx('click');
                onCancel();
              }}
              style={[styles.cancelBtn, webCursor]}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* 3-option value picker for Repaint / Reshape / Renumber */}
          {pendingTargetCard && activeDef.supportsValueChoice && (
            <View testID="prism-spell-value-picker" style={styles.valuePickerRow}>
              {activeDef.id === 'repaint' &&
                CARD_COLOR_LIST.map(c => {
                  const swatch = getPrismShapeColor(c, colorblind);
                  const isCurrent = pendingTargetCard.color === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      testID={`prism-spell-val-${c}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Repaint to ${COLOR_LABELS[c]}${isCurrent ? ' (current)' : ''}`}
                      accessibilityState={{ disabled: isCurrent }}
                      disabled={isCurrent}
                      onPress={() => onChooseValue(c)}
                      style={[
                        styles.valueChoiceBtn,
                        { borderColor: swatch },
                        isCurrent && styles.valueChoiceCurrent,
                        !isCurrent && webCursor,
                      ]}
                    >
                      <View style={[styles.colorDot, { backgroundColor: swatch }]} />
                      <Text style={styles.valueChoiceText}>
                        {colorblind ? `${COLOR_LABELS[c]} (${PRISM_COLORBLIND_LETTER[c]})` : COLOR_LABELS[c]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

              {activeDef.id === 'reshape' &&
                PRISM_SHAPES.map(s => {
                  const isCurrent = pendingTargetCard.shape === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      testID={`prism-spell-val-${s}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Reshape to ${SHAPE_LABELS[s]}${isCurrent ? ' (current)' : ''}`}
                      accessibilityState={{ disabled: isCurrent }}
                      disabled={isCurrent}
                      onPress={() => onChooseValue(s)}
                      style={[
                        styles.valueChoiceBtn,
                        isCurrent && styles.valueChoiceCurrent,
                        !isCurrent && webCursor,
                      ]}
                    >
                      <Text style={styles.valueChoiceText}>{SHAPE_LABELS[s]}</Text>
                    </TouchableOpacity>
                  );
                })}

              {activeDef.id === 'renumber' &&
                PRISM_NUMBERS.map(n => {
                  const isCurrent = pendingTargetCard.number === n;
                  return (
                    <TouchableOpacity
                      key={n}
                      testID={`prism-spell-val-${n}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Renumber to ${n}${isCurrent ? ' (current)' : ''}`}
                      accessibilityState={{ disabled: isCurrent }}
                      disabled={isCurrent}
                      onPress={() => onChooseValue(n)}
                      style={[
                        styles.valueChoiceBtn,
                        isCurrent && styles.valueChoiceCurrent,
                        !isCurrent && webCursor,
                      ]}
                    >
                      <Text style={styles.valueChoiceText}>
                        {n} {n === 1 ? 'Shape' : 'Shapes'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </View>
          )}
        </View>
      )}

      {/* Compact Empty Bar on mobile so empty Spell slots never steal board height */}
      {compact && run.spells.length === 0 && !activeDef ? (
        <View style={styles.compactEmptyBar}>
          <View style={styles.pocketLabelWrap}>
            <Icon name="lorc/crystal-wand" size={13} color={PRISM_COLORS.utilityTeal} noShadow />
            <Text style={styles.pocketLabel}>
              SPELLS 0/{run.maxSpells}
            </Text>
          </View>
          <Text style={styles.compactEmptyHint}>Buy Spells in Shop</Text>
        </View>
      ) : (
        /* Spell Slots Row */
        <View style={styles.pocketRow}>
          <View style={styles.pocketLabelWrap}>
            <Icon name="lorc/crystal-wand" size={14} color={PRISM_COLORS.utilityTeal} noShadow />
            <Text style={styles.pocketLabel}>
              SPELLS {run.spells.length}/{run.maxSpells}
            </Text>
          </View>

          <View style={styles.slotsRow}>
            {run.spells.map((owned, idx) => {
              const def = SPELL_BY_ID[owned.spellId];
              if (!def) return null;
              const isActive = activeSpellIndex === idx;
              return (
                <TouchableOpacity
                  key={owned.instanceId}
                  testID={`prism-spell-${idx}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${def.name}: ${def.shortLabel}`}
                  accessibilityState={{ selected: isActive }}
                  activeOpacity={0.85}
                  onPress={() => {
                    playPrismSfx('click');
                    if (isActive) {
                      onCancel();
                    } else {
                      onSelectSpell(idx);
                    }
                  }}
                  style={[
                    styles.spellBtn,
                    compact && styles.spellBtnCompact,
                    { borderColor: isActive ? PRISM_COLORS.gold : def.accentColor },
                    isActive && styles.spellBtnActive,
                    webCursor,
                  ]}
                >
                  <Icon
                    name={def.icon}
                    size={compact ? 14 : 16}
                    color={isActive ? PRISM_COLORS.gold : def.accentColor}
                    noShadow
                  />
                  <View style={styles.spellCopy}>
                    <Text style={styles.spellName} numberOfLines={1}>
                      {def.name}
                    </Text>
                    {!compact && (
                      <Text style={styles.spellSub} numberOfLines={1}>
                        {def.shortLabel}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {!compact &&
              Array.from({ length: emptySlots }).map((_, idx) => (
                <View key={`empty-spell-${idx}`} style={styles.emptySpellSlot}>
                  <Text style={styles.emptySpellText}>Empty Spell</Text>
                </View>
              ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: PRISM_COLORS.feltSurface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
  },
  containerCompact: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 5,
  },
  compactEmptyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 22,
  },
  compactEmptyHint: {
    fontSize: 11,
    fontWeight: '600',
    color: PRISM_COLORS.textMuted,
  },
  targetBanner: {
    backgroundColor: '#0E332B',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.utilityTeal,
    padding: 8,
    gap: 8,
  },
  targetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  targetTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
    lineHeight: 16,
  },
  cancelBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1,
    borderColor: PRISM_COLORS.feltBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: PRISM_COLORS.textPrimary,
  },
  valuePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valueChoiceBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: PRISM_COLORS.feltDeep,
    borderWidth: 1.5,
    borderColor: PRISM_COLORS.feltBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  valueChoiceCurrent: {
    opacity: 0.38,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  valueChoiceText: {
    fontSize: 12,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
  },
  pocketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  pocketLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pocketLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: PRISM_COLORS.utilityTeal,
    letterSpacing: 0.8,
  },
  slotsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 180,
  },
  spellBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    backgroundColor: PRISM_COLORS.feltElevated,
    borderWidth: 1.5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  spellBtnCompact: {
    minHeight: 36,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  spellBtnActive: {
    backgroundColor: '#1E4A3E',
    borderWidth: 2,
  },
  spellCopy: {
    flex: 1,
  },
  spellName: {
    fontSize: 12,
    fontWeight: '900',
    color: PRISM_COLORS.textPrimary,
  },
  spellSub: {
    fontSize: 11,
    fontWeight: '600',
    color: PRISM_COLORS.textMuted,
  },
  emptySpellSlot: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(44, 89, 75, 0.7)',
    backgroundColor: 'rgba(7, 22, 17, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  emptySpellText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(159, 184, 174, 0.45)',
  },
});

export default PrismSpellPocket;
