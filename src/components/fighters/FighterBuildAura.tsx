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
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Svg, Circle, Polygon } from 'react-native-svg';
import { weaponRole, type WeaponRole } from '@/adventure/data/weaponRoles';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';

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
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
    spin.value = withRepeat(
      withTiming(360, { duration: 11000, easing: Easing.linear }),
      -1
    );
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(spin);
    };
  }, [shouldAnimate, pulse, spin]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.72 + pulse.value * 0.24,
    transform: [{ scale: 1 + pulse.value * 0.045 }],
  }));

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  if (!theme) return null;

  const palette = ROLE_AURA_STYLE[theme.dominantRole] ?? ROLE_AURA_STYLE.damage;
  const ringSize = Math.round(size * 1.24);
  const offset = -Math.round((ringSize - size) / 2);
  const cx = ringSize / 2;
  const rOuter = ringSize * 0.45;
  const rInner = ringSize * 0.39;
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
            strokeWidth={theme.evolved ? 2.5 : 2}
            strokeDasharray={theme.evolved ? '8 4' : '5 5'}
            opacity={0.9}
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
                r={rOuter + 2.5}
                fill="none"
                stroke={EVO_BRIGHT}
                strokeWidth={1.25}
                opacity={0.85}
              />
            </>
          )}
          {arcanaNodes > 0 && (
            <Circle
              cx={cx}
              cy={cx}
              r={rInner - 2.5}
              fill="none"
              stroke={ARCANA_VIOLET}
              strokeWidth={1.5}
              strokeDasharray="3 4"
              opacity={0.85}
            />
          )}
        </Svg>
      </Animated.View>

      {/* Orbiting glints for Arcana & Evolution flair */}
      {(arcanaNodes > 0 || theme.evolved) && (
        <Animated.View style={[StyleSheet.absoluteFill, shouldAnimate ? orbitStyle : undefined]}>
          <Svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
            {theme.evolved &&
              [0, 90, 180, 270].map(deg => {
                const rad = (deg * Math.PI) / 180;
                const gx = cx + Math.cos(rad) * (rOuter + 1);
                const gy = cx + Math.sin(rad) * (rOuter + 1);
                return (
                  <Polygon
                    key={`evo-${deg}`}
                    points={`${gx},${gy - 3.5} ${gx + 2.5},${gy} ${gx},${gy + 3.5} ${gx - 2.5},${gy}`}
                    fill={EVO_BRIGHT}
                    stroke={EVO_GOLD}
                    strokeWidth={0.8}
                  />
                );
              })}
            {Array.from({ length: arcanaNodes }).map((_, i) => {
              const deg = 45 + i * 120;
              const rad = (deg * Math.PI) / 180;
              const ax = cx + Math.cos(rad) * rInner;
              const ay = cx + Math.sin(rad) * rInner;
              return (
                <Circle
                  key={`arc-${i}`}
                  cx={ax}
                  cy={ay}
                  r={2.8}
                  fill={ARCANA_VIOLET}
                  stroke={palette.accent}
                  strokeWidth={1}
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
    opacity: 0.85,
  },
});

export default FighterBuildAura;
