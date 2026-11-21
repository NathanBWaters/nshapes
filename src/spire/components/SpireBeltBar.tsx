/**
 * Starfall Summit — Reusable Belt Strip with Reordering, Inspection & Optional Selling.
 *
 * Strictly reuses `WeaponExplainer.tsx` (single weapon explainer guardrail!)
 * and `WeaponChip`. Lets players position `Understudy` immediately to the right
 * of any held weapon, inspect any charm, or sell spare gear in the Merchant Shop.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '@/utils/colors';
import WeaponExplainer from '@/adventure/components/WeaponExplainer';
import { WeaponChip } from '@/adventure/components/SharedCards';
import { INK, TONE } from '@/adventure/components/ui';
import { band, sfx } from '@/audio';
import { buildSpireWeaponBuilds, spireHeldWeapons } from '../engine/bridge';
import { MAX_SUMMIT_WEAPONS, spireWeaponSellValue } from '../engine/runState';
import type { SpireRun } from '../types';

interface Props {
  run: SpireRun;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onSell?: (weaponId: string) => void;
  title?: string;
  compact?: boolean;
  testIDPrefix?: string;
}

const SpireBeltBar: React.FC<Props> = ({
  run,
  onReorder,
  onSell,
  title = 'MY BELT',
  compact = false,
  testIDPrefix = 'spire-belt',
}) => {
  const [inspectId, setInspectId] = useState<string | null>(null);
  const held = spireHeldWeapons(run);
  const builds = buildSpireWeaponBuilds(run);

  if (held.length === 0) return null;

  const understudyIdx = run.weapons.indexOf('understudy');
  const understudyTarget = understudyIdx > 0 ? held[understudyIdx - 1] : null;
  const inspected = held.find(w => w.id === inspectId) ?? null;
  const canSellAny = Boolean(onSell) && held.length > 1;
  const isFull = held.length >= MAX_SUMMIT_WEAPONS;

  return (
    <View style={[st.card, compact && st.cardCompact]} testID={testIDPrefix}>
      <View style={st.headRow}>
        <View style={st.titleRow}>
          <Text style={st.secTitle}>
            {`${title} (${held.length}/${MAX_SUMMIT_WEAPONS})`}
          </Text>
          {isFull && (
            <View style={st.fullPill} testID={`${testIDPrefix}-full-badge`}>
              <Text style={st.fullPillText}>FULL</Text>
            </View>
          )}
        </View>
        {onReorder && held.length > 1 && (
          <Text style={st.orderHint}>Order matters for Understudy</Text>
        )}
      </View>

      {understudyIdx >= 0 && (
        <View style={st.understudyBanner} testID={`${testIDPrefix}-understudy-note`}>
          <Text style={st.understudyText}>
            {understudyTarget
              ? `Understudy is copying ${understudyTarget.name} (to its left).`
              : 'Understudy is first in belt — move it right ▶ to copy a weapon!'}
          </Text>
        </View>
      )}

      <View style={st.list}>
        {held.map((w, i) => {
          const lv = run.weaponLevels[w.id] ?? 1;
          const sellPrice = spireWeaponSellValue(w.id, lv);
          const isInspected = inspected?.id === w.id;
          return (
            <View key={`${w.id}-${i}`} style={[st.row, isInspected && st.rowFocused]}>
              <Text style={st.slotNum}>{i + 1}</Text>
              <View style={st.chipWrap}>
                <WeaponChip
                  testID={`${testIDPrefix}-weapon-${w.id}`}
                  weapon={w}
                  level={lv}
                  active={isInspected}
                  onPress={() => {
                    sfx('click');
                    setInspectId(prev => (prev === w.id ? null : w.id));
                  }}
                />
              </View>

              {onReorder && held.length > 1 && (
                <View style={st.moveGroup}>
                  <TouchableOpacity
                    testID={`${testIDPrefix}-left-${i}`}
                    disabled={i === 0}
                    onPress={() => {
                      sfx('click');
                      onReorder(i, i - 1);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${w.name} left`}
                    style={[st.moveBtn, i === 0 && st.btnDisabled]}
                  >
                    <Text style={st.moveText}>◀</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`${testIDPrefix}-right-${i}`}
                    disabled={i === held.length - 1}
                    onPress={() => {
                      sfx('click');
                      onReorder(i, i + 1);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${w.name} right`}
                    style={[st.moveBtn, i === held.length - 1 && st.btnDisabled]}
                  >
                    <Text style={st.moveText}>▶</Text>
                  </TouchableOpacity>
                </View>
              )}

              {onSell && (
                <TouchableOpacity
                  testID={`${testIDPrefix}-sell-${w.id}`}
                  disabled={!canSellAny}
                  onPress={() => {
                    band.cue('register');
                    if (inspectId === w.id) setInspectId(null);
                    onSell(w.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Sell ${w.name} for ${sellPrice} coins`}
                  style={[st.sellBtn, !canSellAny && st.btnDisabled]}
                >
                  <Text style={st.sellText}>+{sellPrice}¢</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {inspected && (
        <WeaponExplainer
          weapon={inspected}
          build={builds[inspected.id]}
          defaultOpen
          hidePowerNote
        />
      )}
    </View>
  );
};

const st = StyleSheet.create({
  card: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 12,
    borderWidth: 2.5,
    borderBottomWidth: 5,
    borderColor: INK,
    padding: 12,
    gap: 8,
  },
  cardCompact: {
    padding: 10,
    gap: 6,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
  },
  secTitle: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: TONE.spent,
  },
  fullPill: {
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D97706',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  fullPillText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: '#92400E',
  },
  orderHint: {
    fontSize: 10,
    fontWeight: '700',
    color: TONE.spent,
  },
  understudyBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D97706',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  understudyText: {
    fontSize: 11,
    fontWeight: '800',
    color: INK,
  },
  list: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.paperBeige,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#D6CFC4',
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  rowFocused: {
    borderColor: INK,
    backgroundColor: TONE.selected,
  },
  slotNum: {
    width: 16,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '900',
    color: TONE.spent,
    fontVariant: ['tabular-nums'],
  },
  chipWrap: {
    flex: 1,
    minWidth: 0,
  },
  moveGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  moveBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: INK,
    backgroundColor: COLORS.canvasWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveText: {
    fontSize: 10,
    fontWeight: '900',
    color: INK,
  },
  sellBtn: {
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#B91C1C',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  sellText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#991B1B',
    fontVariant: ['tabular-nums'],
  },
  btnDisabled: {
    opacity: 0.35,
  },
});

export default SpireBeltBar;
