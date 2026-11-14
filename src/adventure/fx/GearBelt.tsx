/**
 * The weapons you are holding, as a row in the fight HUD. When one fires it
 * jumps and plays its own animation, so the cascade shows who did what.
 * Tap one to read what it does (the fight pauses).
 */
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { WeaponAvatar } from '@/components/weapons';
import type { Weapon } from '@/types';
import { COLORS } from '@/utils/colors';
import { Anchor, useBump } from './anchors';

const GAP = 4;
const MAX_ICON = 26;
const MIN_ICON = 16;

const BeltItem: React.FC<{ weapon: Weapon; size: number; onPress: () => void }> = ({ weapon, size, onPress }) => {
  const [fired, setFired] = useState(0);
  useBump(`weapon:${weapon.id}`, () => setFired(n => n + 1));
  return (
    <Anchor name={`weapon:${weapon.id}`}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[st.item, { width: size + 6, height: size + 6 }]}
        accessibilityRole="button"
        accessibilityLabel={`${weapon.name}: what it does`}
        testID={`belt-${weapon.id}`}
      >
        <WeaponAvatar weapon={weapon} size={size} triggerKey={fired} />
      </TouchableOpacity>
    </Anchor>
  );
};

export const GearBelt: React.FC<{ weapons: readonly Weapon[]; width: number; onInspect: (w: Weapon) => void }> = ({ weapons, width, onInspect }) => {
  if (weapons.length === 0) return null;
  const room = (width - 20 - GAP * (weapons.length - 1)) / weapons.length - 6;
  const size = Math.max(MIN_ICON, Math.min(MAX_ICON, Math.floor(room)));
  return (
    <View style={st.belt} testID="gear-belt">
      {weapons.map(w => <BeltItem key={w.id} weapon={w} size={size} onPress={() => onInspect(w)} />)}
    </View>
  );
};

const st = StyleSheet.create({
  belt: { flexDirection: 'row', alignItems: 'center', gap: GAP, flexWrap: 'wrap' },
  item: { alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1.5, borderColor: COLORS.slateCharcoal, backgroundColor: COLORS.paperBeige },
});
