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
import type { ActiveWeaponCounter } from '../engine/fight';
import type { BeltBadge, SetIgnition } from '../types';
import { Anchor, useBump } from './anchors';

const GAP = 3.5;
const MAX_ICON = 24;
const MIN_ICON = 16;
const BADGE_HOLD_MS = 1350;

const BADGE_BG: Record<BeltBadge['kind'], string> = {
  flat: '#0E7490',
  mult: '#DC2626',
  fx: '#D97706',
};

const SPECIAL_EFFECT_COUNTER: Partial<Record<NonNullable<Weapon['specialEffect']>, ActiveWeaponCounter['type']>> = {
  fire: 'fire',
  explosive: 'explosion',
  laser: 'laser',
  hintGain: 'hint',
  graceGain: 'grace',
  timeGain: 'time',
  healing: 'healing',
};

/** Returns the active enemy counter dampening this weapon, if any. */
export const counterForWeapon = (
  weapon: Weapon,
  counters?: readonly ActiveWeaponCounter[]
): ActiveWeaponCounter | undefined => {
  if (!counters || counters.length === 0) return undefined;
  const byStat = counters.find(c => {
    const val = weapon.effects?.[c.stat];
    return typeof val === 'number' && val > 0;
  });
  if (byStat) return byStat;
  const specialType = weapon.specialEffect ? SPECIAL_EFFECT_COUNTER[weapon.specialEffect] : undefined;
  if (!specialType) return undefined;
  return counters.find(c => c.type === specialType);
};

const BeltItem: React.FC<{
  weapon: Weapon;
  size: number;
  stacks: number;
  counter?: ActiveWeaponCounter;
  badge?: BeltBadge;
  ignitionId?: number;
  reduced?: boolean;
  guardPress?: boolean;
  noBottomBleed?: boolean;
  onPress: () => void;
}> = ({
  weapon,
  size,
  stacks,
  counter,
  badge,
  ignitionId,
  reduced = false,
  guardPress = false,
  noBottomBleed = false,
  onPress,
}) => {
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

  const a11yParts = [weapon.name];
  if (stacks > 0) a11yParts.push(`grown ${Math.round(stacks)} times`);
  if (counter) a11yParts.push(`countered by foe −${counter.reduction}% (${counter.label})`);

  // [UI-17] Guarantee >=44x44px touch target via hitSlop; [UI-15] keep bottom: 0 on portrait so it never bleeds into row-0 cards.
  const boxSize = size + 4;
  const dx = Math.max(0, Math.ceil((44 - boxSize) / 2));
  const needY = Math.max(0, 44 - boxSize);
  const slotHitSlop = noBottomBleed
    ? { top: needY, bottom: 0, left: dx, right: dx }
    : { top: Math.ceil(needY / 2), bottom: Math.ceil(needY / 2), left: dx, right: dx };

  return (
    <Anchor name={`weapon:${weapon.id}`}>
      <TouchableOpacity
        onPress={guardPress ? NOOP_BELT_PRESS : onPress}
        onLongPress={guardPress ? onPress : undefined}
        delayLongPress={250}
        hitSlop={slotHitSlop}
        activeOpacity={guardPress ? 1 : 0.7}
        style={[st.item, counter && st.itemCountered, { width: boxSize, height: boxSize }]}
        accessibilityRole="button"
        accessibilityLabel={`${a11yParts.join(', ')}: ${guardPress ? 'hold to inspect' : 'what it does'}`}
        testID={`belt-${weapon.id}`}
      >
        <WeaponAvatar weapon={weapon} size={size} triggerKey={fired} />
        {/* Enemy counter debuff indicator when the active foe weakens this weapon's category */}
        {counter && (
          <View style={st.counterBadge} testID={`belt-counter-${weapon.id}`} pointerEvents="none">
            <Text style={st.counterBadgeText} numberOfLines={1}>−{counter.reduction}%</Text>
          </View>
        )}
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
  counters?: readonly ActiveWeaponCounter[];
  reduced?: boolean;
  width: number;
  /** Optional horizontal pixels reserved on the same row for docked Arcana / Evo pills */
  reservedRightPx?: number;
  /** [UI-15] Require long-press during active Parry wind-up or card selection on mobile portrait */
  guardPress?: boolean;
  /** [UI-15]/[UI-17] Keep hitSlop.bottom = 0 on portrait so touch target never encroaches row-0 cards */
  noBottomBleed?: boolean;
  onInspect: (w: Weapon) => void;
}> = ({
  weapons,
  growth,
  ignition,
  counters,
  reduced,
  width,
  reservedRightPx = 0,
  guardPress = false,
  noBottomBleed = false,
  onInspect,
}) => {
  if (weapons.length === 0) return null;
  const avail = Math.max(120, (width > 0 ? width : 360) - 20 - reservedRightPx);
  const room = (avail - GAP * (weapons.length - 1)) / weapons.length - 6;
  const size = Math.max(MIN_ICON, Math.min(MAX_ICON, Math.floor(room)));
  return (
    <View style={st.belt} testID="gear-belt">
      {weapons.map(w => (
        <BeltItem
          key={w.id}
          weapon={w}
          size={size}
          stacks={growth ? growthStacks(growth, w.id) : 0}
          counter={counterForWeapon(w, counters)}
          badge={ignition?.beltBadges?.[w.id]}
          ignitionId={ignition?.id}
          reduced={reduced}
          guardPress={guardPress}
          noBottomBleed={noBottomBleed}
          onPress={() => onInspect(w)}
        />
      ))}
    </View>
  );
};

const NOOP_BELT_PRESS = () => {};

const st = StyleSheet.create({
  belt: { flexDirection: 'row', alignItems: 'center', gap: GAP, flexWrap: 'wrap', overflow: 'visible', paddingTop: 4, paddingBottom: 4 },
  stacks: { position: 'absolute', top: -6, right: -5, minWidth: 18, paddingHorizontal: 3, borderRadius: 7, backgroundColor: COLORS.actionYellow, borderWidth: 1.5, borderColor: COLORS.slateCharcoal, alignItems: 'center', zIndex: 5 },
  stacksText: { fontSize: 11, fontWeight: '900', color: COLORS.slateCharcoal, lineHeight: 13 },
  item: { alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1.5, borderColor: COLORS.slateCharcoal, backgroundColor: COLORS.paperBeige, overflow: 'visible' },
  itemCountered: { borderColor: '#DC2626', backgroundColor: '#FEE2E2' },
  counterBadge: {
    position: 'absolute',
    top: -6,
    left: -5,
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    borderRadius: 6,
    backgroundColor: '#B91C1C',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
    zIndex: 7,
  },
  counterBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    lineHeight: 13,
  },
  triggerBadge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    paddingHorizontal: 4,
    paddingVertical: 0.5,
    zIndex: 14,
  },
  triggerBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.1,
    lineHeight: 13,
  },
});
