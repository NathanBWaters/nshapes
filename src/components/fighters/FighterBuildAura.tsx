/**
 * [GP-23] Lightweight worn-build visual aura & Evolution flair SVG overlay for
 * `FighterAvatar` (Customization Pillar 5: "Make it look cool").
 *
 * Exported standalone so combat (`AdventureRun.tsx`), Camp, and `FighterAvatar`
 * can mount it cleanly without extra SVG gradients or heavy particle systems.
 * Honors `useReducedMotion()`, `useAppActive()`, and `quiet`, animating strictly
 * GPU-composited `transform` and `opacity` with `cancelAnimation` cleanup.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Svg, Circle, Polygon } from 'react-native-svg';
import { weaponRole, type WeaponRole } from '@/adventure/data/weaponRoles';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import { EASE, IDLE_LOOP } from '@/utils/motion';

export interface BuildAuraTheme {
  dominantRole: WeaponRole;
  evolved: boolean;
  arcanaCount: number;
}

export const ROLE_AURA_STYLE: Record<
  WeaponRole,
  { primary: string; accent: string; label: string }
> = {
  damage: { primary: '#EA580C', accent: '#FDBA74', label: 'Ember Glow' },
  tricks: { primary: '#4F46E5', accent: '#A5B4FC', label: 'Trickster Ring' },
  gambles: { primary: '#BE123C', accent: '#FDE047', label: 'High-Roller Gold' },
  board: { primary: '#15803D', accent: '#86EFAC', label: 'Verdant Aura' },
  survival: { primary: '#0F766E', accent: '#5EEAD4', label: 'Aegis Halo' },
  insight: { primary: '#D97706', accent: '#FEF08A', label: 'Gilded Crest' },
  tempo: { primary: '#0284C7', accent: '#7DD3FC', label: 'Chrono Orbit' },
  chains: { primary: '#7C3AED', accent: '#D8B4FE', label: 'Volt Lattice' },
};

/**
 * Derive a `BuildAuraTheme` from equipped weapon IDs, active evolutions, and
 * equipped Arcana. Returns `null` when the fighter has no build items active.
 */
export const deriveBuildTheme = (
  weaponIds: readonly string[],
  activeEvolutionCount = 0,
  arcanaCount = 0
): BuildAuraTheme | null => {
  if (weaponIds.length === 0 && activeEvolutionCount <= 0 && arcanaCount <= 0) {
    return null;
  }
  const counts: Partial<Record<WeaponRole, number>> = {};
  let dominantRole: WeaponRole = 'damage';
  let bestCount = -1;
  for (const id of weaponIds) {
    const role = weaponRole(id);
    const next = (counts[role] ?? 0) + 1;
    counts[role] = next;
    if (next > bestCount) {
      bestCount = next;
      dominantRole = role;
    }
  }
  return {
    dominantRole,
    evolved: activeEvolutionCount > 0,
    arcanaCount: Math.max(0, Math.round(arcanaCount)),
  };
};

export interface FighterBuildAuraProps {
  theme: BuildAuraTheme | null | undefined;
  /** Diameter matching the hosted FighterAvatar size (px) */
  size: number;
  /** Suppresses continuous ambient motion while keeping the crisp static aura ring */
  quiet?: boolean;
  testID?: string;
}

const EVO_GOLD = '#F59E0B';
const EVO_BRIGHT = '#FDE047';
const ARCANA_VIOLET = '#8B5CF6';
const INK = COLORS.slateCharcoal;
/** Tokenized seam-free breath half-period derived from `IDLE_LOOP.primePeriodsMs[0]` (2900ms) */
const AURA_BREATH_HALF_MS = Math.round(IDLE_LOOP.primePeriodsMs[0] / 2);
/** Slow orbital revolution (3x breath period for harmonic phase lock) */
const AURA_ORBIT_MS = IDLE_LOOP.primePeriodsMs[0] * 3;

export const FighterBuildAura: React.FC<FighterBuildAuraProps> = ({
  theme,
  size,
  quiet = false,
  testID = 'fighter-build-aura',
}) => {
  const reducedMotion = useReducedMotion();
  const appActive = useAppActive();
  const shouldAnimate = Boolean(theme) && !reducedMotion && !quiet && appActive;

  const pulse = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (!shouldAnimate) {
      cancelAnimation(pulse);
      cancelAnimation(spin);
      pulse.value = 0;
      spin.value = 0;
      return;
    }
    // Symmetric `EASE.drift` ping-pong guarantees C0+C1 zero-slope continuity at both ends
    pulse.value = withRepeat(
      withTiming(1, { duration: AURA_BREATH_HALF_MS, easing: EASE.drift }),
      -1,
      true
    );
    spin.value = withRepeat(
      withTiming(360, { duration: AURA_ORBIT_MS, easing: EASE.linear }),
      -1,
      false
    );
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(spin);
    };
  }, [shouldAnimate, pulse, spin]);

  // Organic storybook ring breath: gentle scale expansion + subtle counter-sway + warm luminance breath
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.78 + pulse.value * 0.2,
    transform: [
      { scale: 0.97 + pulse.value * 0.06 },
      { rotate: `${(pulse.value - 0.5) * -7}deg` },
    ],
  }));

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  if (!theme) return null;

  const palette = ROLE_AURA_STYLE[theme.dominantRole] ?? ROLE_AURA_STYLE.damage;
  // Generous ring span clears both bare combat fighters AND rounded-square framed Camp portraits
  const ringSize = Math.round(size * 1.38);
  const offset = -Math.round((ringSize - size) / 2);
  const cx = ringSize / 2;
  const rOuter = ringSize * 0.455;
  const rOrbit = ringSize * 0.435;
  const rInner = ringSize * 0.4;
  const arcanaNodes = Math.min(3, theme.arcanaCount);

  return (
    <View
      pointerEvents="none"
      testID={testID}
      accessibilityLabel={`${palette.label}${theme.evolved ? ', Evolved halo' : ''}${arcanaNodes > 0 ? `, ${arcanaNodes} Arcana` : ''}`}
      style={[
        st.box,
        {
          width: ringSize,
          height: ringSize,
          left: offset,
          top: offset,
        },
      ]}
    >
      {/* Role aura ring + subtle golden double-halo when Evolved */}
      <Animated.View style={[StyleSheet.absoluteFill, shouldAnimate ? pulseStyle : st.staticOpacity]}>
        <Svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
          <Circle
            cx={cx}
            cy={cx}
            r={rOuter}
            fill="none"
            stroke={palette.primary}
            strokeWidth={theme.evolved ? 2.6 : 2.2}
            strokeDasharray={theme.evolved ? '8 4' : '6 4'}
            opacity={0.92}
          />
          {theme.evolved && (
            <>
              <Circle
                cx={cx}
                cy={cx}
                r={rInner}
                fill="none"
                stroke={EVO_GOLD}
                strokeWidth={2}
                opacity={0.95}
              />
              <Circle
                cx={cx}
                cy={cx}
                r={rOuter + 2.2}
                fill="none"
                stroke={EVO_BRIGHT}
                strokeWidth={1.35}
                opacity={0.88}
              />
            </>
          )}
          {arcanaNodes > 0 && (
            <Circle
              cx={cx}
              cy={cx}
              r={rOrbit - 2.2}
              fill="none"
              stroke={ARCANA_VIOLET}
              strokeWidth={1.6}
              strokeDasharray="3 4"
              opacity={0.86}
            />
          )}
        </Svg>
      </Animated.View>

      {/* Storybook ink-outlined orbiting glints for Arcana & Evolution flair */}
      {(arcanaNodes > 0 || theme.evolved) && (
        <Animated.View style={[StyleSheet.absoluteFill, shouldAnimate ? orbitStyle : undefined]}>
          <Svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
            {theme.evolved &&
              [0, 90, 180, 270].map(deg => {
                const rad = (deg * Math.PI) / 180;
                const gx = cx + Math.cos(rad) * (rOuter + 0.5);
                const gy = cx + Math.sin(rad) * (rOuter + 0.5);
                return (
                  <Polygon
                    key={`evo-${deg}`}
                    points={`${gx},${gy - 4} ${gx + 2.8},${gy} ${gx},${gy + 4} ${gx - 2.8},${gy}`}
                    fill={EVO_BRIGHT}
                    stroke={INK}
                    strokeWidth={1.1}
                    strokeLinejoin="round"
                  />
                );
              })}
            {Array.from({ length: arcanaNodes }).map((_, i) => {
              const deg = 45 + i * 120;
              const rad = (deg * Math.PI) / 180;
              const ax = cx + Math.cos(rad) * rOrbit;
              const ay = cx + Math.sin(rad) * rOrbit;
              return (
                <Circle
                  key={`arc-${i}`}
                  cx={ax}
                  cy={ay}
                  r={3.4}
                  fill={ARCANA_VIOLET}
                  stroke={INK}
                  strokeWidth={1.25}
                />
              );
            })}
          </Svg>
        </Animated.View>
      )}
    </View>
  );
};

const st = StyleSheet.create({
  box: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staticOpacity: {
    opacity: 0.88,
  },
});

export default FighterBuildAura;
