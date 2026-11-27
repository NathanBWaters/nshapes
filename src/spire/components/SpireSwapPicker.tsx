/**
 * Starfall Summit — Inline 6/6 Belt Swap Picker.
 *
 * Shown inline inside Rewards, Merchant Shop, Treasure Vault, and Mystery Events
 * when the player's 6-weapon belt is full and they choose to claim/buy a NEW
 * weapon. Strictly reuses `WeaponChip` (single weapon explainer guardrail!) and
 * preserves belt slot index for Understudy positioning.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '@/utils/colors';
import { STAGGER } from '@/utils/motion';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { WeaponChip } from '@/adventure/components/SharedCards';
import { INK, TONE } from '@/adventure/components/ui';
import { spireHeldWeapons } from '../engine/bridge';
import { MAX_SUMMIT_WEAPONS } from '../engine/runState';
import type { SpireRun } from '../types';
import { SpireInlineDrawer, SpireStaggerItem, SpireTactilePressable } from './SpireMotion';

interface Props {
  visible?: boolean;
  run: SpireRun;
  incomingWeaponId: string;
  incomingLevel: number;
  price?: number;
  onConfirmSwap: (dropWeaponId: string) => void;
  onCancel: () => void;
  testIDPrefix: string;
}

const SpireSwapPicker: React.FC<Props> = ({
  visible = true,
  run,
  incomingWeaponId,
  incomingLevel,
  price,
  onConfirmSwap,
  onCancel,
  testIDPrefix,
}) => {
  const held = spireHeldWeapons(run);
  const incomingName = getArmoryWeapon(incomingWeaponId)?.name ?? incomingWeaponId;

  return (
    <SpireInlineDrawer visible={visible} style={st.panel} testID={`${testIDPrefix}-panel`}>
      <View style={st.panelInner}>
        <View style={st.headRow}>
          <Text style={st.title}>
            {`Belt Full (${run.weapons.length}/${MAX_SUMMIT_WEAPONS}) — Swap out which weapon?`}
          </Text>
          <SpireTactilePressable
            testID={`${testIDPrefix}-cancel`}
            small
            onPress={onCancel}
            style={st.cancelBtn}
            accessibilityRole="button"
            accessibilityLabel="Cancel weapon swap"
          >
            <Text style={st.cancelText}>Cancel</Text>
          </SpireTactilePressable>
        </View>

        <Text style={st.sub}>
          Equipping {incomingName} (Lv {incomingLevel})
          {price !== undefined ? ` for ${price}¢` : ''} · Keeps slot order
        </Text>

        <View style={st.list}>
          {held.map((w, i) => {
            const lv = run.weaponLevels[w.id] ?? 1;
            return (
              <SpireStaggerItem key={`${w.id}-${i}`} index={i} count={held.length} gapMs={STAGGER.card} distance={8}>
                <View style={st.row}>
                  <Text style={st.slotNum}>{i + 1}</Text>
                  <View style={st.chipWrap}>
                    <WeaponChip weapon={w} level={lv} />
                  </View>
                  <SpireTactilePressable
                    testID={`${testIDPrefix}-drop-${w.id}`}
                    small
                    onPress={() => onConfirmSwap(w.id)}
                    style={st.swapBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Swap out ${w.name} for ${incomingName}`}
                  >
                    <Text style={st.swapBtnText}>Swap</Text>
                  </SpireTactilePressable>
                </View>
              </SpireStaggerItem>
            );
          })}
        </View>
      </View>
    </SpireInlineDrawer>
  );
};

const st = StyleSheet.create({
  panel: {
    width: '100%',
    maxWidth: '100%',
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D97706',
    padding: 10,
  },
  panelInner: {
    gap: 8,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '900',
    color: INK,
    lineHeight: 16,
  },
  sub: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    color: TONE.spent,
    lineHeight: 15,
  },
  cancelBtn: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelText: {
    fontSize: 11,
    fontWeight: '900',
    color: INK,
  },
  list: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E5D5A3',
    paddingHorizontal: 6,
    paddingVertical: 5,
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
  swapBtn: {
    backgroundColor: COLORS.actionYellow,
    borderRadius: 7,
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: INK,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  swapBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: INK,
  },
});

export default SpireSwapPicker;
