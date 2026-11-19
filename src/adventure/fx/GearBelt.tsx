/**
 * The weapons you are holding, as a row in the fight HUD. When one fires it
 * jumps, plays its own animation, and pops a crisp Balatro-style trigger value
 * badge (`+3`, `×2`, `+11`, `🔥4`) right on its slot so players and Twitch
 * viewers immediately see WHICH weapon contributed WHAT to the score.
 * Tap one to read what it does (the fight pauses).
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { WeaponAvatar } from '@/components/weapons';
import type { Weapon } from '@/types';
import { COLORS } from '@/utils/colors';
import { EASE, exitMs, MS, SCALE } from '@/utils/motion';
import { growthStacks, type GrowthState } from '../data/weaponGrowth';
import type { BeltBadge, SetIgnition } from '../types';
import { Anchor, useBump } from './anchors';

const GAP = 4;
const MAX_ICON = 26;
const MIN_ICON = 16;
const BADGE_HOLD_MS = 1350;

const BADGE_BG: Record<BeltBadge['kind'], string> = {
  flat: '#0E7490',
  mult: '#DC2626',
  fx: '#D97706',
};

const BeltItem: React.FC<{
  weapon: Weapon;
  size: number;
  stacks: number;
  badge?: BeltBadge;
  ignitionId?: number;
  reduced?: boolean;
  onPress: () => void;
}> = ({ weapon, size, stacks, badge, ignitionId, reduced = false, onPress }) => {
  const [fired, setFired] = useState(0);
  const [shownBadge, setShownBadge] = useState<BeltBadge | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const badgeOp = useSharedValue(0);
  const badgeScale = useSharedValue(1);
  const badgeY = useSharedValue(0);

  useBump(`weapon:${weapon.id}`, () => setFired(n => n + 1));

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (!badge || !ignitionId) return;

    setShownBadge(badge);
    if (!reduced) {
      setFired(n => n + 1);
      badgeOp.value = withTiming(1, { duration: MS.feedback, easing: EASE.enter });
      badgeY.value = 5;
      badgeY.value = withTiming(0, { duration: MS.quick, easing: EASE.enter });
      badgeScale.value = 0.72;
      badgeScale.value = withSequence(
        withTiming(SCALE.pop, { duration: Math.round(MS.quick * 0.55), easing: EASE.pop }),
        withTiming(1, { duration: Math.round(MS.quick * 0.55), easing: EASE.ui })
      );
    } else {
      badgeOp.value = 1;
      badgeY.value = 0;
      badgeScale.value = 1;
    }

    const fadeOut = exitMs(MS.quick);
    timerRef.current = setTimeout(() => {
      badgeOp.value = withTiming(0, { duration: fadeOut, easing: EASE.exitSoft });
      timerRef.current = setTimeout(() => setShownBadge(null), fadeOut + 20);
    }, BADGE_HOLD_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      cancelAnimation(badgeOp);
      cancelAnimation(badgeScale);
      cancelAnimation(badgeY);
    };
  }, [badge, ignitionId, reduced, badgeOp, badgeScale, badgeY]);

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOp.value,
    transform: [{ translateY: badgeY.value }, { scale: badgeScale.value }],
  }));

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
        {/* Balatro-style live value popup showing exact damage/mult/effect contributed */}
        {shownBadge && (
          <Animated.View
            pointerEvents="none"
            testID={`belt-badge-${weapon.id}`}
            style={[st.triggerBadge, { backgroundColor: BADGE_BG[shownBadge.kind] }, badgeStyle]}
          >
            <Text style={st.triggerBadgeText} numberOfLines={1}>{shownBadge.text}</Text>
          </Animated.View>
        )}
      </TouchableOpacity>
    </Anchor>
  );
};

export const GearBelt: React.FC<{
  weapons: readonly Weapon[];
  growth?: GrowthState;
  ignition?: SetIgnition | null;
  reduced?: boolean;
  width: number;
  onInspect: (w: Weapon) => void;
}> = ({ weapons, growth, ignition, reduced, width, onInspect }) => {
  if (weapons.length === 0) return null;
  const room = (width - 20 - GAP * (weapons.length - 1)) / weapons.length - 6;
  const size = Math.max(MIN_ICON, Math.min(MAX_ICON, Math.floor(room)));
  return (
    <View style={st.belt} testID="gear-belt">
      {weapons.map(w => (
        <BeltItem
          key={w.id}
          weapon={w}
          size={size}
          stacks={growth ? growthStacks(growth, w.id) : 0}
          badge={ignition?.beltBadges?.[w.id]}
          ignitionId={ignition?.id}
          reduced={reduced}
          onPress={() => onInspect(w)}
        />
      ))}
    </View>
  );
};

const st = StyleSheet.create({
  belt: { flexDirection: 'row', alignItems: 'center', gap: GAP, flexWrap: 'wrap', overflow: 'visible', paddingBottom: 3 },
  stacks: { position: 'absolute', top: -6, right: -6, minWidth: 16, paddingHorizontal: 2, borderRadius: 8, backgroundColor: COLORS.actionYellow, borderWidth: 1.5, borderColor: COLORS.slateCharcoal, alignItems: 'center', zIndex: 5 },
  stacksText: { fontSize: 9, fontWeight: '900', color: COLORS.slateCharcoal },
  item: { alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1.5, borderColor: COLORS.slateCharcoal, backgroundColor: COLORS.paperBeige, overflow: 'visible' },
  triggerBadge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    paddingHorizontal: 3.5,
    paddingVertical: 0,
    zIndex: 14,
  },
  triggerBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.1,
    lineHeight: 10,
  },
});
