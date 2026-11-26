/**
 * HUD pieces of a fight: the chiaroscuro flash for MEGA hits ([FX-17]), the
 * evolution countdown rings, and the non-blocking evolution banner ([FX-14]).
 * The numbers and everything that moves are the effects stage's (src/adventure/fx).
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Svg, Circle } from 'react-native-svg';
import Icon, { IconName } from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import { band } from '@/audio';
import { ScreenFlashStorage, useScreenFlashEnabled } from '@/utils/fxSettingsStorage';
import { EASE, MS, STAYS, exitMs } from '@/utils/motion';
import { fxMs } from '../fx/clock';
import { DARK, INK, TONE } from './ui';

export { HIT_TIERS, hitTier } from '../fx/script';
export type { HitTier } from '../fx/types';

/** Sakurai Ep. #221 2-frame chiaroscuro contrast flash timings (112 ms total, [FX-17]). */
export const CHIAROSCURO_FLASH_MS = {
  darkMs: 16,
  brightMs: 16,
  decayMs: 80,
  totalMs: 112,
} as const;

/** Dial intensity down slightly on compact close-view screens (<420 px) per Ep. #221. */
export const chiaroscuroDistanceScale = (stageW?: number): number =>
  stageW != null && Number.isFinite(stageW) && stageW > 0 && stageW < 420 ? 0.78 : 1.0;

export interface ChiaroscuroFlashProps {
  /** Changing to a value > 0 fires the 112 ms dark-then-bright contrast flash. */
  trigger: number;
  /** Optional delay before the flash starts (ms, scaled by `fxMs`). */
  delayMs?: number;
  /** Whether fight effects are enabled (default true). */
  enabled?: boolean;
  /** Stage width in px for close-screen intensity scaling. */
  stageW?: number;
  /** Accent rim color for frame 2 (defaults to golden-cream `#FFE84D`). */
  accentColor?: string;
  testID?: string;
}

/**
 * 2-frame chiaroscuro perimeter flash ([FX-17]):
 *   Frame 1 (`0–16 ms`):  deep `#161412` dark contrast vignette frame (`opacity: 0.52 × scale`)
 *   Frame 2 (`16–32 ms`): crisp `#FFE84D` + `#FFFDF5` rim highlight (`opacity: 0.36 × scale`, transparent center)
 *   Decay (`32–112 ms`):  clean `80 ms` `EASE.exitSoft` fade back to 0.
 *
 * Strictly gated on `ScreenFlashStorage.get() && enabled && !useReducedMotion()`,
 * leaving center cards fully legible with zero pure-white washout.
 */
export const ChiaroscuroFlash: React.FC<ChiaroscuroFlashProps> = ({
  trigger,
  delayMs = 0,
  enabled = true,
  stageW,
  accentColor = '#FFE84D',
  testID = 'chiaroscuro-flash',
}) => {
  const reducedMotion = useReducedMotion();
  const flashPref = useScreenFlashEnabled();
  const darkOp = useSharedValue(0);
  const brightOp = useSharedValue(0);

  const allowed = flashPref && ScreenFlashStorage.get() && enabled && !reducedMotion;

  useEffect(() => {
    if (!allowed) {
      cancelAnimation(darkOp);
      cancelAnimation(brightOp);
      darkOp.value = 0;
      brightOp.value = 0;
      return;
    }
    if (trigger <= 0) return;

    const scale = chiaroscuroDistanceScale(stageW);
    const startDelay = fxMs(delayMs);
    const darkMs = fxMs(CHIAROSCURO_FLASH_MS.darkMs);
    const brightMs = fxMs(CHIAROSCURO_FLASH_MS.brightMs);
    const decayMs = fxMs(CHIAROSCURO_FLASH_MS.decayMs);

    cancelAnimation(darkOp);
    cancelAnimation(brightOp);
    darkOp.value = 0;
    brightOp.value = 0;

    darkOp.value = withDelay(
      startDelay,
      withSequence(
        withTiming(0.52 * scale, { duration: darkMs, easing: EASE.enter }),
        withTiming(0, { duration: brightMs, easing: EASE.exitSoft })
      )
    );

    brightOp.value = withDelay(
      startDelay + darkMs,
      withSequence(
        withTiming(0.36 * scale, { duration: brightMs, easing: EASE.enter }),
        withTiming(0, { duration: decayMs, easing: EASE.exitSoft })
      )
    );

    return () => {
      cancelAnimation(darkOp);
      cancelAnimation(brightOp);
    };
  }, [trigger, delayMs, allowed, stageW, darkOp, brightOp]);

  const darkStyle = useAnimatedStyle(() => ({ opacity: darkOp.value }));
  const brightStyle = useAnimatedStyle(() => ({ opacity: brightOp.value }));

  if (!allowed) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, st.flashRoot]} testID={testID}>
      <Animated.View pointerEvents="none" testID={`${testID}-dark`} style={[StyleSheet.absoluteFill, st.flashDarkFrame, darkStyle]} />
      <Animated.View
        pointerEvents="none"
        testID={`${testID}-bright`}
        style={[StyleSheet.absoluteFill, st.flashBrightFrame, { borderColor: accentColor }, brightStyle]}
      >
        <View pointerEvents="none" style={st.flashInnerRim} />
      </Animated.View>
    </View>
  );
};

/**
 * MEGA-hit contrast flash: backward-compatible wrapper backed by the 112 ms
 * `ScreenFlashStorage`-gated `ChiaroscuroFlash` ([FX-17]).
 */
export const MegaFlash: React.FC<{ trigger: number; enabled?: boolean; stageW?: number }> = ({
  trigger,
  enabled = true,
  stageW,
}) => <ChiaroscuroFlash trigger={trigger} enabled={enabled} stageW={stageW} testID="mega-flash" />;

/** Non-blocking EvolutionBanner timings ([FX-14]: exit strictly faster than enter). */
export const EVOLUTION_BANNER_TIMING = {
  enterMs: MS.quick,
  holdMs: 2000,
  exitMs: exitMs(MS.quick),
} as const;

/** Full-width non-blocking banner when a repeat/post-pick evolution starts or effects are off ([OB-08] + [AU-13] + [FX-14]). */
export const EvolutionBanner: React.FC<{ recipeId?: string; name: string; icon: IconName; text: string; seconds: number; seq: number }> = ({ recipeId, name, icon, text, seconds, seq }) => {
  const o = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(o);
    o.value = 0;
    // [FX-14]: Zero horizontal slide; exit (120 ms) is faster than enter (180 ms) and STAYS preserves hold under Reduced Motion
    o.value = withSequence(
      STAYS.reduceMotion,
      withTiming<number>(1, { duration: fxMs(EVOLUTION_BANNER_TIMING.enterMs), easing: EASE.ui, ...STAYS }),
      withDelay(
        fxMs(EVOLUTION_BANNER_TIMING.holdMs),
        withTiming<number>(0, { duration: fxMs(EVOLUTION_BANNER_TIMING.exitMs), easing: EASE.exitSoft, ...STAYS }),
        STAYS.reduceMotion
      )
    );
    if (recipeId) {
      const b = band as typeof band & {
        playCutInEvolve?: (id: string, opts?: { immediate?: boolean; leadMs?: number }) => void;
      };
      if (typeof b?.playCutInEvolve === 'function') {
        b.playCutInEvolve(recipeId, { immediate: true, leadMs: 0 });
      } else if (typeof band?.evolve === 'function' && !band.inFight) {
        band.evolve(recipeId);
      }
    }
    return () => cancelAnimation(o);
  }, [seq, recipeId, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View pointerEvents="none" style={[st.banner, style]} testID="evolution-banner">
      <View style={st.bannerIcon}><Icon name={icon} size={30} color={INK} /></View>
      <View style={{ flex: 1 }}>
        <Text style={st.bannerEyebrow}>EVOLUTION · {seconds} SECONDS</Text>
        <Text style={st.bannerName}>{name}!</Text>
        <Text style={st.bannerText} numberOfLines={2}>{text}</Text>
      </View>
    </Animated.View>
  );
};

/** One active evolution: its icon inside a ring that empties as the time runs out. */
export const EvolutionRing: React.FC<{ icon: IconName; name: string; remainingMs: number; durationMs: number; compact?: boolean }> = ({
  icon,
  name,
  remainingMs,
  durationMs,
  compact = false,
}) => {
  const size = compact ? 26 : 34;
  const strokeW = compact ? 3 : 4;
  const r = compact ? 10.5 : 14;
  const c = 2 * Math.PI * r;
  const frac = durationMs > 0 ? Math.max(0, Math.min(1, remainingMs / durationMs)) : 0;
  const secs = Math.ceil(remainingMs / 1000);
  if (compact) {
    return (
      <View style={st.ringPill} accessibilityLabel={`${name} evolution, ${secs} seconds left`} testID="evolution-ring">
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke="#E9D5FF" strokeWidth={strokeW} fill={COLORS.canvasWhite} />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={secs <= 5 ? COLORS.impactRed : TONE.evoReady}
              strokeWidth={strokeW}
              fill="none"
              strokeDasharray={`${c * frac} ${c}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
          <Icon name={icon} size={12} color={INK} />
        </View>
        <Text style={st.ringPillSecs}>{secs}s</Text>
      </View>
    );
  }
  return (
    <View style={st.ring} accessibilityLabel={`${name} evolution, ${secs} seconds left`} testID="evolution-ring">
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#E9D5FF" strokeWidth={strokeW} fill={COLORS.canvasWhite} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={secs <= 5 ? COLORS.impactRed : TONE.evoReady}
          strokeWidth={strokeW}
          fill="none"
          strokeDasharray={`${c * frac} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Icon name={icon} size={14} color={INK} />
      <Text style={st.ringSecs}>{secs}</Text>
    </View>
  );
};

const st = StyleSheet.create({
  flashRoot: { zIndex: 400 },
  flashDarkFrame: {
    borderWidth: 6,
    borderColor: '#161412',
    backgroundColor: 'rgba(22, 20, 18, 0.22)',
  },
  flashBrightFrame: {
    borderWidth: 4,
    borderColor: '#FFE84D',
    backgroundColor: 'transparent',
  },
  flashInnerRim: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#FFFDF5',
    backgroundColor: 'transparent',
  },
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 250,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: DARK.panel,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: COLORS.actionYellow,
  },
  bannerIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.actionYellow, alignItems: 'center', justifyContent: 'center' },
  bannerEyebrow: { color: COLORS.actionYellow, fontWeight: '900', letterSpacing: 2, fontSize: 10 },
  bannerName: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 22 },
  bannerText: { color: DARK.text, fontSize: 12 },
  ring: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  ringSecs: { position: 'absolute', bottom: -6, fontSize: 9, fontWeight: '900', color: INK, backgroundColor: COLORS.canvasWhite, borderRadius: 4, paddingHorizontal: 2, overflow: 'hidden' },
  ringPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FEF3C7', borderRadius: 999, borderWidth: 1.5, borderColor: TONE.evoReady, paddingLeft: 1, paddingRight: 5, paddingVertical: 0.5 },
  ringPillSecs: { fontSize: 9.5, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
});
