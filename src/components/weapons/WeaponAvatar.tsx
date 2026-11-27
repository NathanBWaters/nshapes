import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Circle, G, Line, Path, Polygon, Svg } from 'react-native-svg';
import { Sparkle4 } from '@/components/illustration/primitives';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Weapon, WeaponRarity } from '@/types';
import { COLORS } from '@/utils/colors';
import {
  ACCESSIBLE,
  EASE,
  SPRING,
  SQUASH_TIER,
  STAYS,
  WEAPON_FX,
  exitMs,
  volumeScale,
} from '@/utils/motion';
import { getRarityTrimPalette, RarityTrimPalette, WeaponTapStyle } from './types';
import { getWeaponTapStyle, WeaponArtwork } from './WeaponArtwork';

const INK = '#161412';

/** Canonical list of all 8 bespoke weapon flourish archetypes. */
export const WEAPON_FLOURISH_CATEGORIES: readonly WeaponTapStyle[] = [
  'explosive',
  'chrono',
  'vitality',
  'laser',
  'tome',
  'coin',
  'connector',
  'arcane',
] as const;

interface WeaponAvatarProps {
  /** Weapon object or weapon name */
  weapon?: Weapon | string | null;
  /** Optional rarity when passing weapon as a string name */
  rarity?: WeaponRarity;
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

/** Primary (inner/core) ink-outlined SVG micro-motif tailored to each of the 8 weapon categories. */
const WeaponBurstPrimarySvg: React.FC<{ tapStyle: WeaponTapStyle; trim: RarityTrimPalette }> = ({
  tapStyle,
  trim,
}) => {
  switch (tapStyle) {
    case 'explosive':
      // Jagged asymmetric comic blast sparks outlined in dark storybook ink
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <Polygon
              points="50,3 56,22 76,10 66,29 94,30 73,44 91,64 68,58 70,88 53,68 36,92 38,65 11,72 28,52 7,34 32,34 22,12 43,23"
              fill="none"
              stroke={INK}
              strokeWidth={4.5}
              strokeLinejoin="round"
            />
            <Polygon
              points="50,3 56,22 76,10 66,29 94,30 73,44 91,64 68,58 70,88 53,68 36,92 38,65 11,72 28,52 7,34 32,34 22,12 43,23"
              fill="none"
              stroke="#FF7A1A"
              strokeWidth={2.4}
              strokeLinejoin="round"
            />
            <Polygon points="84,18 90,22 83,27 79,21" fill="#FFE84D" stroke={INK} strokeWidth={1.6} />
            <Polygon points="15,24 21,20 22,27 15,29" fill="#FF9538" stroke={INK} strokeWidth={1.6} />
          </G>
        </Svg>
      );

    case 'chrono':
      // Crisp 12-tick inked stopwatch dial bezel with cardinal markers
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <Circle cx={50} cy={50} r={43} fill="none" stroke={INK} strokeWidth={4} />
            <Circle cx={50} cy={50} r={43} fill="none" stroke="#38BDF8" strokeWidth={2} />
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => {
              const rad = (deg * Math.PI) / 180;
              const major = deg % 90 === 0;
              const r1 = major ? 34 : 38;
              const r2 = 44;
              const x1 = 50 + Math.cos(rad) * r1;
              const y1 = 50 + Math.sin(rad) * r1;
              const x2 = 50 + Math.cos(rad) * r2;
              const y2 = 50 + Math.sin(rad) * r2;
              return (
                <React.Fragment key={deg}>
                  <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={major ? 4.2 : 2.6} strokeLinecap="round" />
                  <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={major ? COLORS.actionYellow : '#E0F2FE'} strokeWidth={major ? 2.2 : 1.3} strokeLinecap="round" />
                </React.Fragment>
              );
            })}
          </G>
        </Svg>
      );

    case 'vitality':
      // Rising organic botanical heal leaves + crisp emerald ring arc
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            {/* Left rising leaf */}
            <Path
              d="M 18 44 Q 10 24 28 18 Q 34 36 18 44 Z"
              fill="#4ADE80"
              stroke={INK}
              strokeWidth={2.2}
              strokeLinejoin="round"
            />
            <Path d="M 19 42 L 26 24" stroke="#0F766E" strokeWidth={1.6} strokeLinecap="round" />
            {/* Right rising leaf */}
            <Path
              d="M 82 38 Q 92 18 72 12 Q 66 30 82 38 Z"
              fill="#16AA98"
              stroke={INK}
              strokeWidth={2.2}
              strokeLinejoin="round"
            />
            <Path d="M 81 36 L 74 18" stroke="#CCFBF1" strokeWidth={1.6} strokeLinecap="round" />
            {/* Top emerald cross-sparkle */}
            <Path d="M 50 4 L 50 16 M 44 10 L 56 10" stroke={INK} strokeWidth={4.4} strokeLinecap="round" />
            <Path d="M 50 4 L 50 16 M 44 10 L 56 10" stroke="#4ADE80" strokeWidth={2.2} strokeLinecap="round" />
          </G>
        </Svg>
      );

    case 'laser':
      // Razor diagonal prism glint slash with white core and dark ink edge
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <Path
              d="M 8 88 L 92 12"
              stroke={INK}
              strokeWidth={8.5}
              strokeLinecap="round"
            />
            <Path
              d="M 8 88 L 92 12"
              stroke="#19C2E6"
              strokeWidth={5}
              strokeLinecap="round"
            />
            <Path
              d="M 14 82 L 86 18"
              stroke="#FFFDF5"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <Sparkle4 cx={84} cy={16} r={10} fill="#FFFDF5" strokeWidth={1.8} />
          </G>
        </Svg>
      );

    case 'tome':
      // Concentric inked rune halo with cardinal golden sigil ticks
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <Circle cx={50} cy={50} r={43} fill="none" stroke={INK} strokeWidth={3.8} />
            <Circle cx={50} cy={50} r={43} fill="none" stroke="#A855F7" strokeWidth={2} />
            <Circle cx={50} cy={50} r={37} fill="none" stroke="#F5B800" strokeWidth={1.4} strokeDasharray="4 6" />
            <Polygon points="50,3 54,11 50,15 46,11" fill={COLORS.actionYellow} stroke={INK} strokeWidth={1.6} />
            <Polygon points="97,50 89,54 85,50 89,46" fill={COLORS.actionYellow} stroke={INK} strokeWidth={1.6} />
            <Polygon points="50,97 46,89 50,85 54,89" fill={COLORS.actionYellow} stroke={INK} strokeWidth={1.6} />
            <Polygon points="3,50 11,46 15,50 11,54" fill={COLORS.actionYellow} stroke={INK} strokeWidth={1.6} />
          </G>
        </Svg>
      );

    case 'coin':
      // Radiant sovereign coin sun-glint + upper-right metallic shine flash
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <Path
              d="M 18 22 A 40 40 0 0 1 82 22"
              fill="none"
              stroke={INK}
              strokeWidth={5.2}
              strokeLinecap="round"
            />
            <Path
              d="M 18 22 A 40 40 0 0 1 82 22"
              fill="none"
              stroke={COLORS.actionYellow}
              strokeWidth={2.8}
              strokeLinecap="round"
            />
            <Sparkle4 cx={82} cy={18} r={11} fill={COLORS.actionYellow} strokeWidth={1.8} />
            <Sparkle4 cx={20} cy={78} r={7} fill="#FFFDF5" strokeWidth={1.6} />
          </G>
        </Svg>
      );

    case 'connector':
      // Twin interlocking inked energy arc tethers snapping outward
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <Path
              d="M 14 58 C 12 20, 44 8, 72 16"
              fill="none"
              stroke={INK}
              strokeWidth={5.4}
              strokeLinecap="round"
            />
            <Path
              d="M 14 58 C 12 20, 44 8, 72 16"
              fill="none"
              stroke="#7B68EE"
              strokeWidth={2.8}
              strokeLinecap="round"
            />
            <Path
              d="M 86 42 C 88 80, 56 92, 28 84"
              fill="none"
              stroke={INK}
              strokeWidth={5.4}
              strokeLinecap="round"
            />
            <Path
              d="M 86 42 C 88 80, 56 92, 28 84"
              fill="none"
              stroke={COLORS.logicTeal}
              strokeWidth={2.8}
              strokeLinecap="round"
            />
            <Circle cx={74} cy={17} r={5.2} fill={COLORS.actionYellow} stroke={INK} strokeWidth={2} />
            <Circle cx={26} cy={83} r={5.2} fill={COLORS.actionYellow} stroke={INK} strokeWidth={2} />
          </G>
        </Svg>
      );

    case 'arcane':
    default:
      // Layered 8-point mystic astral star halo with crisp ink border
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <Polygon
              points="50,4 58,34 86,14 66,42 96,50 66,58 86,86 58,66 50,96 42,66 14,86 34,58 4,50 34,42 14,14 42,34"
              fill="none"
              stroke={INK}
              strokeWidth={4}
              strokeLinejoin="round"
            />
            <Polygon
              points="50,4 58,34 86,14 66,42 96,50 66,58 86,86 58,66 50,96 42,66 14,86 34,58 4,50 34,42 14,14 42,34"
              fill="none"
              stroke={trim.gem}
              strokeWidth={2.1}
              strokeLinejoin="round"
            />
            <Sparkle4 cx={50} cy={8} r={7.5} fill={COLORS.actionYellow} strokeWidth={1.6} />
          </G>
        </Svg>
      );
  }
};

/** Secondary trailing SVG micro-motif (lagged by `WEAPON_FX.particleStaggerMs` for overlapping follow-through). */
const WeaponBurstSecondarySvg: React.FC<{ tapStyle: WeaponTapStyle; trim: RarityTrimPalette }> = ({
  tapStyle,
  trim,
}) => {
  switch (tapStyle) {
    case 'explosive':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <Circle cx={16} cy={18} r={6} fill="#3B3632" stroke={INK} strokeWidth={2} />
            <Circle cx={85} cy={78} r={5.5} fill="#44403C" stroke={INK} strokeWidth={2} />
            <Polygon points="84,48 92,45 89,53" fill="#FFE84D" stroke={INK} strokeWidth={1.5} />
            <Polygon points="14,76 20,70 22,78" fill="#FF7A1A" stroke={INK} strokeWidth={1.5} />
          </G>
        </Svg>
      );

    case 'chrono':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <Path
              d="M 50 9 A 41 41 0 0 1 88 35"
              fill="none"
              stroke={INK}
              strokeWidth={4.5}
              strokeLinecap="round"
            />
            <Path
              d="M 50 9 A 41 41 0 0 1 88 35"
              fill="none"
              stroke={COLORS.actionYellow}
              strokeWidth={2.2}
              strokeLinecap="round"
            />
            <Polygon points="90,36 81,34 87,27" fill={COLORS.actionYellow} stroke={INK} strokeWidth={1.6} />
          </G>
        </Svg>
      );

    case 'vitality':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <Sparkle4 cx={24} cy={14} r={6.5} fill="#CCFBF1" strokeWidth={1.5} />
            <Sparkle4 cx={78} cy={18} r={7.5} fill="#4ADE80" strokeWidth={1.5} />
            <Circle cx={50} cy={88} r={4} fill="#4ADE80" stroke={INK} strokeWidth={1.6} />
          </G>
        </Svg>
      );

    case 'laser':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <Line x1={12} y1={24} x2={34} y2={42} stroke={INK} strokeWidth={4.2} strokeLinecap="round" />
            <Line x1={12} y1={24} x2={34} y2={42} stroke="#7CE4FF" strokeWidth={2.1} strokeLinecap="round" />
            <Line x1={66} y1={58} x2={88} y2={76} stroke={INK} strokeWidth={4.2} strokeLinecap="round" />
            <Line x1={66} y1={58} x2={88} y2={76} stroke="#7CE4FF" strokeWidth={2.1} strokeLinecap="round" />
          </G>
        </Svg>
      );

    case 'tome':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <Path d="M 14 26 L 22 18 L 28 24" fill="none" stroke={INK} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M 14 26 L 22 18 L 28 24" fill="none" stroke="#FFFDF5" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M 72 24 L 78 18 L 86 26" fill="none" stroke={INK} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M 72 24 L 78 18 L 86 26" fill="none" stroke="#FFFDF5" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            <Sparkle4 cx={50} cy={14} r={7} fill={trim.glow} strokeWidth={1.5} />
          </G>
        </Svg>
      );

    case 'coin':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <Path
              d="M 82 78 A 40 40 0 0 1 18 78"
              fill="none"
              stroke={INK}
              strokeWidth={4.4}
              strokeLinecap="round"
            />
            <Path
              d="M 82 78 A 40 40 0 0 1 18 78"
              fill="none"
              stroke="#F59E0B"
              strokeWidth={2.2}
              strokeLinecap="round"
            />
            <Polygon points="14,34 19,29 24,34 19,39" fill={COLORS.actionYellow} stroke={INK} strokeWidth={1.5} />
            <Polygon points="80,62 85,57 90,62 85,67" fill="#FFFDF5" stroke={INK} strokeWidth={1.5} />
          </G>
        </Svg>
      );

    case 'connector':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <Line x1={18} y1={24} x2={26} y2={30} stroke={INK} strokeWidth={3.8} strokeLinecap="round" />
            <Line x1={18} y1={24} x2={26} y2={30} stroke="#5EEAD4" strokeWidth={1.9} strokeLinecap="round" />
            <Line x1={74} y1={70} x2={82} y2={76} stroke={INK} strokeWidth={3.8} strokeLinecap="round" />
            <Line x1={74} y1={70} x2={82} y2={76} stroke="#C084FC" strokeWidth={1.9} strokeLinecap="round" />
          </G>
        </Svg>
      );

    case 'arcane':
    default:
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <Polygon points="20,16 25,21 20,26 15,21" fill="#C084FC" stroke={INK} strokeWidth={1.6} />
            <Polygon points="80,16 85,21 80,26 75,21" fill={COLORS.actionYellow} stroke={INK} strokeWidth={1.6} />
            <Polygon points="80,74 85,79 80,84 75,79" fill="#C084FC" stroke={INK} strokeWidth={1.6} />
            <Polygon points="20,74 25,79 20,84 15,79" fill={COLORS.actionYellow} stroke={INK} strokeWidth={1.6} />
          </G>
        </Svg>
      );
  }
};

/**
 * Illustrated NShapes weapon emblem that sits 100% static at rest (zero idle loops)
 * and performs a tokenized, category-tailored Disney-12 flourish animation + bespoke
 * 2-layer ink-outlined SVG micro-motif burst when tapped or triggered on the GearBelt.
 */
export const WeaponAvatar: React.FC<WeaponAvatarProps> = ({
  weapon,
  rarity: rarityOverride,
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
  const rotY = useSharedValue(0);
  const burstPrimary = useSharedValue(0);
  const burstSecondary = useSharedValue(0);
  const reducedGlint = useSharedValue(0);

  useEffect(() => () => {
    cancelAnimation(tx);
    cancelAnimation(ty);
    cancelAnimation(scaleX);
    cancelAnimation(scaleY);
    cancelAnimation(rot);
    cancelAnimation(rotY);
    cancelAnimation(burstPrimary);
    cancelAnimation(burstSecondary);
    cancelAnimation(reducedGlint);
  }, [tx, ty, scaleX, scaleY, rot, rotY, burstPrimary, burstSecondary, reducedGlint]);

  const playTapAnimation = useCallback(() => {
    cancelAnimation(tx);
    cancelAnimation(ty);
    cancelAnimation(scaleX);
    cancelAnimation(scaleY);
    cancelAnimation(rot);
    cancelAnimation(rotY);
    cancelAnimation(burstPrimary);
    cancelAnimation(burstSecondary);
    cancelAnimation(reducedGlint);

    if (reducedMotion) {
      // Reduced motion: zero travel/spin/squash, preserve crisp tap confirmation fade
      reducedGlint.value = 0;
      reducedGlint.value = withSequence(
        STAYS.reduceMotion,
        withTiming(1, { duration: ACCESSIBLE.fadeMs, easing: EASE.ui, ...STAYS }),
        withDelay(
          WEAPON_FX.holdMs,
          withTiming(0, { duration: exitMs(ACCESSIBLE.fadeMs), easing: EASE.exitSoft, ...STAYS }),
          STAYS.reduceMotion
        )
      );
      return;
    }

    const hop = Math.max(3, size * 0.16);
    const sway = Math.max(2, size * 0.1);
    const wind = WEAPON_FX.windMs;
    const strike = WEAPON_FX.strikeMs;
    const hold = WEAPON_FX.holdMs;
    const rec = WEAPON_FX.recoilDeg;

    // 2-layer staggered burst synced to the weapon's strike peak (Disney #5 Overlap)
    burstPrimary.value = 0;
    burstPrimary.value = withTiming(1, {
      duration: WEAPON_FX.burstMs,
      easing: EASE.enter,
    });
    burstSecondary.value = 0;
    burstSecondary.value = withDelay(
      WEAPON_FX.particleStaggerMs,
      withTiming(1, {
        duration: WEAPON_FX.burstMs - WEAPON_FX.particleStaggerMs,
        easing: EASE.enterSoft,
      })
    );

    switch (tapStyle) {
      case 'explosive': {
        // Fuse crouch (volume-preserved playful squash) -> explosive blast stretch + recoil kick -> playful spring
        const sq = volumeScale(SQUASH_TIER.playful.squashY);
        const st2 = volumeScale(SQUASH_TIER.playful.stretchY);
        scaleY.value = withSequence(
          withTiming(sq.scaleY, { duration: wind, easing: EASE.ui }),
          withTiming(st2.scaleY, { duration: strike, easing: EASE.enter }),
          withSpring(1, SPRING.playful)
        );
        scaleX.value = withSequence(
          withTiming(sq.scaleX, { duration: wind, easing: EASE.ui }),
          withTiming(st2.scaleX, { duration: strike, easing: EASE.enter }),
          withSpring(1, SPRING.playful)
        );
        ty.value = withSequence(
          withTiming(size * 0.08, { duration: wind, easing: EASE.ui }),
          withTiming(-hop * 1.12, { duration: strike, easing: EASE.enter }),
          withSpring(0, SPRING.playful)
        );
        rot.value = withSequence(
          withTiming(-rec * 0.85, { duration: wind, easing: EASE.ui }),
          withTiming(rec * 0.78, { duration: hold, easing: EASE.pop }),
          withTiming(-rec * 0.35, { duration: hold, easing: EASE.ui }),
          withSpring(0, SPRING.lively)
        );
        break;
      }

      case 'chrono': {
        // Mechanical escapement wind-back -> crisp tick-tick-snap -> snappy mechanical stop
        const sq = volumeScale(SQUASH_TIER.lively.squashY);
        const st2 = volumeScale(WEAPON_FX.flourishScale);
        rot.value = withSequence(
          withTiming(-rec * 1.15, { duration: wind, easing: EASE.anticipate }),
          withTiming(rec * 1.25, { duration: hold, easing: EASE.pop }),
          withTiming(-rec * 0.7, { duration: hold, easing: EASE.ui }),
          withTiming(rec * 0.35, { duration: wind, easing: EASE.ui }),
          withSpring(0, SPRING.snappy)
        );
        scaleY.value = withSequence(
          withTiming(sq.scaleY, { duration: wind, easing: EASE.ui }),
          withTiming(st2.scaleY, { duration: strike, easing: EASE.enter }),
          withSpring(1, SPRING.snappy)
        );
        scaleX.value = withSequence(
          withTiming(sq.scaleX, { duration: wind, easing: EASE.ui }),
          withTiming(st2.scaleX, { duration: strike, easing: EASE.enter }),
          withSpring(1, SPRING.snappy)
        );
        ty.value = withSequence(
          withTiming(-hop * 0.76, { duration: strike, easing: EASE.enter }),
          withSpring(0, SPRING.snappy)
        );
        break;
      }

      case 'vitality': {
        // Warm organic double-beat lub-dub pulse + buoyant botanical lift
        const beat1 = WEAPON_FX.flourishScale * 1.03;
        const beat2 = WEAPON_FX.flourishScale * 0.99;
        scaleX.value = withSequence(
          withTiming(beat1, { duration: hold, easing: EASE.popSoft }),
          withTiming(SQUASH_TIER.ui.squashY, { duration: wind, easing: EASE.drift }),
          withTiming(beat2, { duration: hold, easing: EASE.popSoft }),
          withSpring(1, SPRING.lively)
        );
        scaleY.value = withSequence(
          withTiming(beat1, { duration: hold, easing: EASE.popSoft }),
          withTiming(SQUASH_TIER.ui.squashY, { duration: wind, easing: EASE.drift }),
          withTiming(beat2, { duration: hold, easing: EASE.popSoft }),
          withSpring(1, SPRING.lively)
        );
        ty.value = withSequence(
          withTiming(-hop * 0.85, { duration: strike + wind, easing: EASE.enterSoft }),
          withSpring(0, SPRING.lively)
        );
        break;
      }

      case 'laser': {
        // Prism lock-in charge pullback -> razor-fast beam slash lunge -> crisp stop
        const sq = volumeScale(SQUASH_TIER.lively.squashY);
        const st2 = volumeScale(WEAPON_FX.flourishScale);
        tx.value = withSequence(
          withTiming(-sway, { duration: wind, easing: EASE.ui }),
          withTiming(sway * 1.35, { duration: strike, easing: EASE.enter }),
          withSpring(0, SPRING.snappy)
        );
        ty.value = withSequence(
          withTiming(size * 0.04, { duration: wind, easing: EASE.ui }),
          withTiming(-hop * 0.75, { duration: strike, easing: EASE.enter }),
          withSpring(0, SPRING.snappy)
        );
        rot.value = withSequence(
          withTiming(-rec * 0.8, { duration: wind, easing: EASE.ui }),
          withTiming(rec, { duration: strike, easing: EASE.enter }),
          withSpring(0, SPRING.snappy)
        );
        scaleY.value = withSequence(
          withTiming(sq.scaleY, { duration: wind, easing: EASE.ui }),
          withTiming(st2.scaleY, { duration: strike, easing: EASE.enter }),
          withSpring(1, SPRING.snappy)
        );
        scaleX.value = withSequence(
          withTiming(sq.scaleX, { duration: wind, easing: EASE.ui }),
          withTiming(st2.scaleX, { duration: strike, easing: EASE.enter }),
          withSpring(1, SPRING.snappy)
        );
        break;
      }

      case 'tome': {
        // Grimoire spine-gather -> wide page-flutter levitation -> gentle settle
        scaleX.value = withSequence(
          withTiming(SQUASH_TIER.lively.squashY, { duration: wind, easing: EASE.state }),
          withTiming(SQUASH_TIER.lively.stretchY * 1.03, { duration: strike, easing: EASE.pop }),
          withSpring(1, SPRING.lively)
        );
        scaleY.value = withSequence(
          withTiming(1.07, { duration: wind, easing: EASE.state }),
          withTiming(1.06, { duration: strike, easing: EASE.ui }),
          withSpring(1, SPRING.lively)
        );
        ty.value = withSequence(
          withTiming(-hop * 0.95, { duration: strike + wind * 0.5, easing: EASE.enterSoft }),
          withSpring(0, SPRING.settle)
        );
        rot.value = withSequence(
          withTiming(-rec * 0.45, { duration: hold, easing: EASE.drift }),
          withTiming(rec * 0.45, { duration: hold, easing: EASE.drift }),
          withSpring(0, SPRING.settle)
        );
        break;
      }

      case 'coin': {
        // Thumb-flick crouch -> sovereign hop + true 3D perspective rotateY spin -> playful clink
        const sq = volumeScale(SQUASH_TIER.lively.squashY);
        const st2 = volumeScale(WEAPON_FX.flourishScale);
        ty.value = withSequence(
          withTiming(size * 0.06, { duration: wind, easing: EASE.ui }),
          withTiming(-hop * 1.22, { duration: strike + hold * 0.5, easing: EASE.enter }),
          withSpring(0, SPRING.playful)
        );
        rotY.value = 0;
        rotY.value = withDelay(
          wind,
          withTiming(360, { duration: strike + hold * 1.5, easing: EASE.enterSoft })
        );
        scaleY.value = withSequence(
          withTiming(sq.scaleY, { duration: wind, easing: EASE.ui }),
          withTiming(st2.scaleY, { duration: strike, easing: EASE.enter }),
          withSpring(1, SPRING.playful)
        );
        scaleX.value = withSequence(
          withTiming(sq.scaleX, { duration: wind, easing: EASE.ui }),
          withTiming(st2.scaleX, { duration: strike, easing: EASE.enter }),
          withSpring(1, SPRING.playful)
        );
        break;
      }

      case 'connector': {
        // Magnetic pull-in -> elastic twin-ring snap -> rebound settle
        scaleX.value = withSequence(
          withTiming(SQUASH_TIER.lively.squashY, { duration: wind, easing: EASE.state }),
          withTiming(SQUASH_TIER.playful.stretchY * 0.98, { duration: strike, easing: EASE.pop }),
          withTiming(SQUASH_TIER.ui.squashY, { duration: hold, easing: EASE.ui }),
          withSpring(1, SPRING.lively)
        );
        scaleY.value = withSequence(
          withTiming(SQUASH_TIER.lively.squashY, { duration: wind, easing: EASE.state }),
          withTiming(SQUASH_TIER.lively.squashY, { duration: strike, easing: EASE.ui }),
          withTiming(WEAPON_FX.flourishScale, { duration: hold, easing: EASE.popSoft }),
          withSpring(1, SPRING.lively)
        );
        rot.value = withSequence(
          withTiming(rec * 0.85, { duration: hold, easing: EASE.enter }),
          withTiming(-rec * 0.55, { duration: hold, easing: EASE.ui }),
          withSpring(0, SPRING.lively)
        );
        break;
      }

      case 'arcane':
      default: {
        // Reverent bow -> mystic levitation hover & astral gleam -> soft settle
        const sq = volumeScale(SQUASH_TIER.lively.squashY);
        const st2 = volumeScale(WEAPON_FX.flourishScale);
        scaleY.value = withSequence(
          withTiming(sq.scaleY, { duration: wind, easing: EASE.state }),
          withTiming(st2.scaleY, { duration: strike, easing: EASE.enterSoft }),
          withSpring(1, SPRING.settle)
        );
        scaleX.value = withSequence(
          withTiming(sq.scaleX, { duration: wind, easing: EASE.state }),
          withTiming(st2.scaleX, { duration: strike, easing: EASE.enterSoft }),
          withSpring(1, SPRING.settle)
        );
        ty.value = withSequence(
          withTiming(size * 0.05, { duration: wind, easing: EASE.state }),
          withTiming(-hop * 1.08, { duration: strike + wind * 0.5, easing: EASE.enterSoft }),
          withSpring(0, SPRING.settle)
        );
        rot.value = withSequence(
          withTiming(rec * 0.65, { duration: strike, easing: EASE.drift }),
          withTiming(-rec * 0.42, { duration: strike, easing: EASE.drift }),
          withSpring(0, SPRING.settle)
        );
        break;
      }
    }
  }, [
    reducedMotion,
    size,
    tapStyle,
    tx,
    ty,
    scaleX,
    scaleY,
    rot,
    rotY,
    burstPrimary,
    burstSecondary,
    reducedGlint,
  ]);

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
      { perspective: 420 },
      { translateX: tx.value },
      { translateY: ty.value },
      { rotateY: `${rotY.value}deg` },
      { rotate: `${rot.value}deg` },
      { scaleX: scaleX.value },
      { scaleY: scaleY.value },
    ],
  }));

  const primaryBurstStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      return {
        opacity: reducedGlint.value * 0.9,
        transform: [{ scale: 1.08 }],
      };
    }
    const p = burstPrimary.value;
    if (p <= 0.001 || p >= 0.999) {
      return { opacity: 0, transform: [{ scale: 0.65 }] };
    }
    const spinDeg =
      tapStyle === 'chrono'
        ? interpolate(p, [0, 1], [-18, 24])
        : tapStyle === 'arcane' || tapStyle === 'tome'
          ? interpolate(p, [0, 1], [-12, 18])
          : tapStyle === 'connector'
            ? interpolate(p, [0, 1], [-16, 12])
            : 0;
    const riseY = tapStyle === 'vitality' ? interpolate(p, [0, 1], [4, -10]) : 0;
    return {
      opacity: interpolate(p, [0, 0.16, 0.72, 1], [0, 1, 0.88, 0]),
      transform: [
        { translateY: riseY },
        { rotate: `${spinDeg}deg` },
        { scale: interpolate(p, [0, 0.34, 1], [0.68, 1.26, 1.38]) },
      ],
    };
  });

  const secondaryBurstStyle = useAnimatedStyle(() => {
    const p = burstSecondary.value;
    if (reducedMotion || p <= 0.001 || p >= 0.999) {
      return { opacity: 0, transform: [{ scale: 0.7 }] };
    }
    const spinDeg =
      tapStyle === 'arcane'
        ? interpolate(p, [0, 1], [16, -24])
        : tapStyle === 'chrono'
          ? interpolate(p, [0, 1], [0, 42])
          : tapStyle === 'coin'
            ? interpolate(p, [0, 1], [-10, 14])
            : 0;
    const riseY = tapStyle === 'vitality' || tapStyle === 'tome' ? interpolate(p, [0, 1], [2, -12]) : 0;
    return {
      opacity: interpolate(p, [0, 0.22, 0.68, 1], [0, 0.95, 0.75, 0]),
      transform: [
        { translateY: riseY },
        { rotate: `${spinDeg}deg` },
        { scale: interpolate(p, [0, 0.4, 1], [0.74, 1.24, 1.4]) },
      ],
    };
  });

  // Render primary auras/bursts BEHIND the weapon artwork so the inked weapon silhouette stays
  // 100% unobstructed at peak (only laser's specular crystal glint flashes across the front).
  const primaryInFront = tapStyle === 'laser';
  const primaryBurstNode = (
    <Animated.View
      pointerEvents="none"
      testID="weapon-tap-burst"
      style={[StyleSheet.absoluteFill, primaryBurstStyle]}
    >
      <View style={StyleSheet.absoluteFill} testID={`weapon-burst-${tapStyle}`}>
        <WeaponBurstPrimarySvg tapStyle={tapStyle} trim={trim} />
      </View>
    </Animated.View>
  );

  const stage = (
    <View
      style={[styles.stage, { width: size, height: size }, style]}
      testID={testID ?? 'weapon-avatar'}
      accessibilityRole={interactive ? 'button' : 'image'}
      accessibilityLabel={`${weaponName} (${resolvedRarity})`}
    >
      {!primaryInFront && primaryBurstNode}

      <Animated.View style={[StyleSheet.absoluteFill, artworkAnimatedStyle]}>
        <WeaponArtwork name={weaponName} rarity={resolvedRarity} />
      </Animated.View>

      {primaryInFront && primaryBurstNode}

      {/* Secondary overlapping follow-through micro-motif (lagged by WEAPON_FX.particleStaggerMs) */}
      <Animated.View
        pointerEvents="none"
        testID={`weapon-burst-secondary-${tapStyle}`}
        style={[StyleSheet.absoluteFill, secondaryBurstStyle]}
      >
        <WeaponBurstSecondarySvg tapStyle={tapStyle} trim={trim} />
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
