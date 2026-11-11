import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Svg, Circle, G, Line, Path } from 'react-native-svg';
import { IconName } from '@/components/Icon';
import { Weapon, WeaponRarity } from '@/types';
import { useReducedMotion } from '@/utils/animation';
import { COLORS } from '@/utils/colors';
import { getRarityTrimPalette, WeaponTapStyle } from './types';
import { getWeaponTapStyle, WeaponArtwork } from './WeaponArtwork';

export interface WeaponAvatarProps {
  /** Weapon object or weapon name */
  weapon?: Weapon | string | null;
  /** Optional rarity when passing weapon as a string name */
  rarity?: WeaponRarity;
  /** Optional fallback icon name */
  icon?: IconName;
  /** Pixel width & height (default 32) */
  size?: number;
  /**
   * When true, wraps the weapon in a Pressable so tapping it directly plays
   * its single signature animation. Keep false inside parent buttons and pass
   * `triggerKey` instead so parent press/double-tap handlers are preserved.
   */
  interactive?: boolean;
  /** Incrementing counter to trigger the single tap animation from a parent button */
  triggerKey?: number;
  /** Optional callback when tapped in `interactive` mode */
  onPress?: () => void;
  /** Optional container style */
  style?: StyleProp<ViewStyle>;
  /** Optional testID */
  testID?: string;
}

const STROKE = COLORS.slateCharcoal;

function Sparkle4({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  return (
    <Path
      d={`M ${cx} ${cy - r} Q ${cx} ${cy} ${cx + r} ${cy} Q ${cx} ${cy} ${cx} ${cy + r} Q ${cx} ${cy} ${cx - r} ${cy} Q ${cx} ${cy} ${cx} ${cy - r} Z`}
      fill={fill}
      stroke={STROKE}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  );
}

/**
 * Illustrated NShapes weapon emblem that sits 100% static at rest (zero idle loops)
 * and performs a single crisp, category-tailored flourish animation when tapped.
 */
export const WeaponAvatar: React.FC<WeaponAvatarProps> = ({
  weapon,
  rarity: rarityOverride,
  icon: iconOverride,
  size = 32,
  interactive = false,
  triggerKey,
  onPress,
  style,
  testID,
}) => {
  const reducedMotion = useReducedMotion();

  const weaponName =
    typeof weapon === 'string'
      ? weapon
      : weapon?.name ?? 'Field Stone';
  const resolvedRarity: WeaponRarity =
    rarityOverride ?? (typeof weapon === 'object' && weapon ? weapon.rarity : 'common');
  const resolvedIcon: IconName | undefined =
    iconOverride ?? (typeof weapon === 'object' && weapon ? weapon.icon : undefined);

  const tapStyle: WeaponTapStyle = useMemo(
    () => getWeaponTapStyle(weaponName),
    [weaponName]
  );
  const trim = useMemo(() => getRarityTrimPalette(resolvedRarity), [resolvedRarity]);

  // Shared values sit completely still at rest (zero background frame callbacks!)
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const rot = useSharedValue(0);
  const burst = useSharedValue(0);

  const playTapAnimation = useCallback(() => {
    if (reducedMotion) return;

    const hop = Math.max(3, size * 0.16);
    const sway = Math.max(2, size * 0.09);

    burst.value = 0;
    burst.value = withTiming(1, {
      duration: 540,
      easing: Easing.out(Easing.cubic),
    });

    switch (tapStyle) {
      case 'explosive':
        // Fuse crouch -> explosive pop + recoil shake -> spring settle
        scaleY.value = withSequence(
          withTiming(0.82, { duration: 65, easing: Easing.out(Easing.quad) }),
          withTiming(1.2, { duration: 115, easing: Easing.out(Easing.cubic) }),
          withSpring(1, { damping: 7.5, stiffness: 220 })
        );
        scaleX.value = withSequence(
          withTiming(1.2, { duration: 65, easing: Easing.out(Easing.quad) }),
          withTiming(0.86, { duration: 115, easing: Easing.out(Easing.cubic) }),
          withSpring(1, { damping: 7.5, stiffness: 220 })
        );
        ty.value = withSequence(
          withTiming(size * 0.07, { duration: 65 }),
          withTiming(-hop * 1.05, { duration: 130, easing: Easing.out(Easing.cubic) }),
          withSpring(0, { damping: 8, stiffness: 210 })
        );
        rot.value = withSequence(
          withTiming(-10, { duration: 75 }),
          withTiming(9, { duration: 95 }),
          withTiming(-5, { duration: 80 }),
          withSpring(0, { damping: 8, stiffness: 200 })
        );
        break;

      case 'chrono':
        // Mechanical wind-back -> crisp stopwatch tick-tick-snap -> settle
        rot.value = withSequence(
          withTiming(-15, { duration: 75, easing: Easing.out(Easing.quad) }),
          withTiming(16, { duration: 85, easing: Easing.out(Easing.back(1.6)) }),
          withTiming(-10, { duration: 80 }),
          withTiming(6, { duration: 70 }),
          withSpring(0, { damping: 9, stiffness: 220 })
        );
        scaleY.value = withSequence(
          withTiming(0.9, { duration: 70 }),
          withTiming(1.12, { duration: 110 }),
          withSpring(1, { damping: 9, stiffness: 210 })
        );
        scaleX.value = withSequence(
          withTiming(1.1, { duration: 70 }),
          withTiming(0.92, { duration: 110 }),
          withSpring(1, { damping: 9, stiffness: 210 })
        );
        ty.value = withSequence(
          withTiming(-hop * 0.72, { duration: 120, easing: Easing.out(Easing.quad) }),
          withSpring(0, { damping: 9, stiffness: 210 })
        );
        break;

      case 'vitality':
        // Double-beat lub-dub heart plump bounce!
        scaleX.value = withSequence(
          withTiming(1.18, { duration: 95, easing: Easing.out(Easing.quad) }),
          withTiming(0.95, { duration: 80 }),
          withTiming(1.14, { duration: 100, easing: Easing.out(Easing.quad) }),
          withSpring(1, { damping: 8.5, stiffness: 200 })
        );
        scaleY.value = withSequence(
          withTiming(1.18, { duration: 95, easing: Easing.out(Easing.quad) }),
          withTiming(0.95, { duration: 80 }),
          withTiming(1.14, { duration: 100, easing: Easing.out(Easing.quad) }),
          withSpring(1, { damping: 8.5, stiffness: 200 })
        );
        ty.value = withSequence(
          withTiming(-hop * 0.75, { duration: 135, easing: Easing.out(Easing.cubic) }),
          withSpring(0, { damping: 9, stiffness: 190 })
        );
        break;

      case 'laser':
        // Charge recoil -> razor-fast beam slash tilt -> settle
        tx.value = withSequence(
          withTiming(-sway, { duration: 65 }),
          withTiming(sway * 1.25, { duration: 105, easing: Easing.out(Easing.cubic) }),
          withSpring(0, { damping: 9, stiffness: 220 })
        );
        ty.value = withSequence(
          withTiming(size * 0.04, { duration: 65 }),
          withTiming(-hop * 0.7, { duration: 105, easing: Easing.out(Easing.cubic) }),
          withSpring(0, { damping: 9, stiffness: 220 })
        );
        rot.value = withSequence(
          withTiming(-11, { duration: 65 }),
          withTiming(13, { duration: 105, easing: Easing.out(Easing.cubic) }),
          withSpring(0, { damping: 9, stiffness: 210 })
        );
        scaleY.value = withSequence(
          withTiming(0.88, { duration: 65 }),
          withTiming(1.14, { duration: 105 }),
          withSpring(1, { damping: 9, stiffness: 210 })
        );
        break;

      case 'tome':
        // Grimoire spine-close -> wide page-flutter levitation -> settle
        scaleX.value = withSequence(
          withTiming(0.84, { duration: 75, easing: Easing.inOut(Easing.quad) }),
          withTiming(1.18, { duration: 135, easing: Easing.out(Easing.back(1.5)) }),
          withSpring(1, { damping: 8.5, stiffness: 200 })
        );
        scaleY.value = withSequence(
          withTiming(1.08, { duration: 75 }),
          withTiming(1.08, { duration: 135 }),
          withSpring(1, { damping: 8.5, stiffness: 200 })
        );
        ty.value = withSequence(
          withTiming(-hop * 0.9, { duration: 155, easing: Easing.out(Easing.cubic) }),
          withSpring(0, { damping: 9, stiffness: 185 })
        );
        rot.value = withSequence(
          withTiming(-6, { duration: 95 }),
          withTiming(6, { duration: 110 }),
          withSpring(0, { damping: 9, stiffness: 190 })
        );
        break;

      case 'coin':
        // Thumb-flick crouch -> 3D sovereign coin-flip hop -> crisp clink settle
        ty.value = withSequence(
          withTiming(size * 0.06, { duration: 55 }),
          withTiming(-hop * 1.2, { duration: 150, easing: Easing.out(Easing.cubic) }),
          withSpring(0, { damping: 8.5, stiffness: 230 })
        );
        scaleX.value = withSequence(
          withTiming(1.08, { duration: 55 }),
          withTiming(0.2, { duration: 95, easing: Easing.inOut(Easing.quad) }),
          withTiming(1.1, { duration: 105, easing: Easing.out(Easing.quad) }),
          withSpring(1, { damping: 8.5, stiffness: 220 })
        );
        scaleY.value = withSequence(
          withTiming(0.86, { duration: 55 }),
          withTiming(1.12, { duration: 110 }),
          withSpring(1, { damping: 8.5, stiffness: 220 })
        );
        break;

      case 'connector':
        // Magnetic pull-in -> elastic twin-ring snap -> settle
        scaleX.value = withSequence(
          withTiming(0.84, { duration: 70 }),
          withTiming(1.19, { duration: 110, easing: Easing.out(Easing.cubic) }),
          withTiming(0.93, { duration: 85 }),
          withSpring(1, { damping: 8, stiffness: 210 })
        );
        scaleY.value = withSequence(
          withTiming(0.84, { duration: 70 }),
          withTiming(0.89, { duration: 110 }),
          withTiming(1.12, { duration: 85 }),
          withSpring(1, { damping: 8, stiffness: 210 })
        );
        rot.value = withSequence(
          withTiming(12, { duration: 105 }),
          withTiming(-8, { duration: 95 }),
          withSpring(0, { damping: 8.5, stiffness: 200 })
        );
        break;

      case 'arcane':
      default:
        // Gentle bow -> mystic levitation hover & gleam -> float settle
        scaleY.value = withSequence(
          withTiming(0.88, { duration: 70 }),
          withTiming(1.13, { duration: 145, easing: Easing.out(Easing.cubic) }),
          withSpring(1, { damping: 9, stiffness: 190 })
        );
        scaleX.value = withSequence(
          withTiming(1.12, { duration: 70 }),
          withTiming(0.94, { duration: 145, easing: Easing.out(Easing.cubic) }),
          withSpring(1, { damping: 9, stiffness: 190 })
        );
        ty.value = withSequence(
          withTiming(size * 0.05, { duration: 70 }),
          withTiming(-hop * 1.05, { duration: 165, easing: Easing.out(Easing.cubic) }),
          withSpring(0, { damping: 9, stiffness: 180 })
        );
        rot.value = withSequence(
          withTiming(8.5, { duration: 120, easing: Easing.out(Easing.sin) }),
          withTiming(-5.5, { duration: 130, easing: Easing.inOut(Easing.sin) }),
          withSpring(0, { damping: 9, stiffness: 185 })
        );
        break;
    }
  }, [reducedMotion, size, tapStyle, tx, ty, scaleX, scaleY, rot, burst]);

  // Trigger single animation when external `triggerKey` changes (after initial mount)
  const prevTriggerKeyRef = useRef<number | undefined>(triggerKey);
  useEffect(() => {
    if (triggerKey !== undefined && triggerKey !== prevTriggerKeyRef.current) {
      prevTriggerKeyRef.current = triggerKey;
      if (triggerKey > 0) {
        playTapAnimation();
      }
    }
  }, [triggerKey, playTapAnimation]);

  const handlePress = useCallback(() => {
    playTapAnimation();
    onPress?.();
  }, [playTapAnimation, onPress]);

  const artworkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rot.value}deg` },
      { scaleX: scaleX.value },
      { scaleY: scaleY.value },
    ],
  }));

  const burstAnimatedStyle = useAnimatedStyle(() => {
    const p = burst.value;
    if (p <= 0.001 || p >= 0.999) {
      return { opacity: 0, transform: [{ scale: 0.6 }] };
    }
    return {
      opacity: interpolate(p, [0, 0.2, 0.72, 1], [0, 1, 0.85, 0]),
      transform: [{ scale: interpolate(p, [0, 0.35, 1], [0.65, 1.12, 1.24]) }],
    };
  });

  const stage = (
    <View
      style={[styles.stage, { width: size, height: size }, style]}
      testID={testID ?? 'weapon-avatar'}
      accessibilityRole={interactive ? 'button' : 'image'}
      accessibilityLabel={`${weaponName} (${resolvedRarity})`}
    >
      <Animated.View style={[StyleSheet.absoluteFill, artworkAnimatedStyle]}>
        <WeaponArtwork name={weaponName} rarity={resolvedRarity} icon={resolvedIcon} />
      </Animated.View>

      {/* Transient tap sparkle ring — invisible (opacity 0) until tapped */}
      <Animated.View
        pointerEvents="none"
        testID="weapon-tap-burst"
        style={[StyleSheet.absoluteFill, burstAnimatedStyle]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <Circle
              cx={50}
              cy={50}
              r={43}
              fill="none"
              stroke={trim.gem}
              strokeWidth={2.4}
              strokeDasharray="6 6"
            />
            <Sparkle4 cx={82} cy={18} r={8.5} fill={COLORS.actionYellow} />
            <Sparkle4 cx={18} cy={22} r={6.5} fill={trim.glow} />
            <Line x1={50} y1={4} x2={50} y2={12} stroke={COLORS.actionYellow} strokeWidth={2.4} strokeLinecap="round" />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );

  if (interactive) {
    return (
      <Pressable
        onPress={handlePress}
        hitSlop={4}
        testID={testID ? `${testID}-pressable` : 'weapon-avatar-pressable'}
      >
        {stage}
      </Pressable>
    );
  }

  return stage;
};

const styles = StyleSheet.create({
  stage: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
});

export default WeaponAvatar;
