/**
 * The weapons you are holding, as a row in the fight HUD. When one fires it
 * jumps and plays its own animation, so the cascade shows who did what.
 * Tap one to read what it does (the fight pauses).
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WeaponAvatar } from '@/components/weapons';
import type { Weapon } from '@/types';
import { COLORS } from '@/utils/colors';
import { growthStacks, type GrowthState } from '../data/weaponGrowth';
import { Anchor, useBump } from './anchors';

const GAP = 4;
const MAX_ICON = 26;
const MIN_ICON = 16;

const BeltItem: React.FC<{ weapon: Weapon; size: number; stacks: number; onPress: () => void }> = ({ weapon, size, stacks, onPress }) => {
  const [fired, setFired] = useState(0);
  useBump(`weapon:${weapon.id}`, () => setFired(n => n + 1));
  return (
    <Anchor name={`weapon:${weapon.id}`}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[st.item, { width: size + 6, height: size + 6 }]}
        accessibilityRole="button"
        accessibilityLabel={stacks > 0 ? `${weapon.name}, grown ${Math.round(stacks)} times: what it does` : `${weapon.name}: what it does`}
        testID={`belt-${weapon.id}`}
      >
        <WeaponAvatar weapon={weapon} size={size} triggerKey={fired} />
        {/* How far it has grown this fight */}
        {stacks > 0 && (
          <View style={st.stacks} testID={`belt-stacks-${weapon.id}`} pointerEvents="none">
            <Text style={st.stacksText}>+{Math.round(stacks)}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Anchor>
  );
};

export const GearBelt: React.FC<{ weapons: readonly Weapon[]; growth?: GrowthState; width: number; onInspect: (w: Weapon) => void }> = ({ weapons, growth, width, onInspect }) => {
  if (weapons.length === 0) return null;
  const room = (width - 20 - GAP * (weapons.length - 1)) / weapons.length - 6;
  const size = Math.max(MIN_ICON, Math.min(MAX_ICON, Math.floor(room)));
  return (
    <View style={st.belt} testID="gear-belt">
      {weapons.map(w => <BeltItem key={w.id} weapon={w} size={size} stacks={growth ? growthStacks(growth, w.id) : 0} onPress={() => onInspect(w)} />)}
    </View>
  );
};

const st = StyleSheet.create({
  belt: { flexDirection: 'row', alignItems: 'center', gap: GAP, flexWrap: 'wrap' },
  stacks: { position: 'absolute', top: -6, right: -6, minWidth: 16, paddingHorizontal: 2, borderRadius: 8, backgroundColor: COLORS.actionYellow, borderWidth: 1.5, borderColor: COLORS.slateCharcoal, alignItems: 'center' },
  stacksText: { fontSize: 9, fontWeight: '900', color: COLORS.slateCharcoal },
  item: { alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1.5, borderColor: COLORS.slateCharcoal, backgroundColor: COLORS.paperBeige },
});
