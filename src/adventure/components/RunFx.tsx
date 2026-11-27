/**
 * HUD pieces of a fight: the chiaroscuro flash for MEGA hits ([FX-17]), the
 * evolution countdown rings, and the non-blocking evolution banner ([FX-14]).
 * The numbers and everything that moves are the effects stage's (src/adventure/fx).
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Svg, Circle } from 'react-native-svg';
import Icon, { IconName } from '@/components/Icon';
import { useAppActive } from '@/hooks/useAppActive';
import { COLORS } from '@/utils/colors';
import { band } from '@/audio';
import { ScreenFlashStorage, useScreenFlashEnabled } from '@/utils/fxSettingsStorage';
import { ACCESSIBLE, EASE, MS, STAYS, exitMs } from '@/utils/motion';
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

/** Matches AdventureRun's 250 ms simulation tick for silky 60fps GPU ring sweep */
const EVO_TICK_MS = 250;

/**
 * One active evolution: its icon inside a 60fps GPU-composited countdown ring
 * that sweeps smoothly via twin clipped semicircle masks (`transform: [{ rotate }]`)
 * instead of 4 Hz React SVG `strokeDasharray` stepping.
 */
export const EvolutionRing: React.FC<{
  icon: IconName;
  name: string;
  remainingMs: number;
  durationMs: number;
  compact?: boolean;
  /** Whether the fight clock is actively ticking (pauses smooth interpolation when halted) */
  active?: boolean;
  /** Adventure's Effects switch: off snaps to discrete ticks and disables urgency rim pulse */
  effects?: boolean;
}> = ({
  icon,
  name,
  remainingMs,
  durationMs,
  compact = false,
  active = true,
  effects = true,
}) => {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const size = compact ? 26 : 34;
  const half = size / 2;
  const strokeW = compact ? 3 : 4;
  const r = compact ? 10.5 : 14;
  const c = 2 * Math.PI * r;
  const halfC = c / 2;
  const frac = durationMs > 0 ? Math.max(0, Math.min(1, remainingMs / durationMs)) : 0;
  const secs = Math.ceil(remainingMs / 1000);
  const urgent = secs <= 5 && remainingMs > 0;
  const ringColor = urgent ? COLORS.impactRed : TONE.evoReady;

  // Smooth 60fps GPU drain interpolation over EVO_TICK_MS
  const fracSv = useSharedValue(frac);
  const prevDurationRef = useRef(durationMs);
  const glideActive = active && appActive && effects && !reducedMotion && durationMs > 0 && remainingMs > 0;

  useEffect(() => {
    const reset = prevDurationRef.current !== durationMs;
    prevDurationRef.current = durationMs;

    if (!glideActive) {
      cancelAnimation(fracSv);
      fracSv.value = frac;
      return;
    }

    if (reset || Math.abs(fracSv.value - frac) > 0.14) {
      cancelAnimation(fracSv);
      fracSv.value = frac;
    }

    const delta = EVO_TICK_MS / durationMs;
    const nextFrac = Math.max(0, frac - delta);
    fracSv.value = withTiming(nextFrac, { duration: EVO_TICK_MS, easing: EASE.linear });

    return () => cancelAnimation(fracSv);
  }, [frac, durationMs, glideActive, fracSv]);

  // Crisp mount entrance (EASE.popSoft scale + EASE.ui opacity; STAYS fade under reducedMotion)
  const enterOp = useSharedValue(0);
  const enterScale = useSharedValue(reducedMotion || !effects ? 1 : 0.84);
  useEffect(() => {
    if (reducedMotion || !effects) {
      enterScale.value = 1;
      enterOp.value = withTiming(1, { duration: ACCESSIBLE.fadeMs, easing: EASE.ui, ...STAYS });
    } else {
      enterOp.value = withTiming(1, { duration: MS.feedback, easing: EASE.ui });
      enterScale.value = withTiming(1, { duration: MS.quick, easing: EASE.popSoft });
    }
    return () => {
      cancelAnimation(enterOp);
      cancelAnimation(enterScale);
    };
    // mount entrance once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Low-time urgency rim glow (GPU opacity only — never scales countdown digits)
  const urgentPulse = useSharedValue(0);
  const shouldUrgentPulse = urgent && active && appActive && effects && !reducedMotion;
  useEffect(() => {
    if (!shouldUrgentPulse) {
      cancelAnimation(urgentPulse);
      urgentPulse.value = urgent ? 0.5 : 0;
      return;
    }
    urgentPulse.value = 0.2;
    urgentPulse.value = withRepeat(
      withTiming(0.95, { duration: MS.move, easing: EASE.drift }),
      -1,
      true
    );
    return () => cancelAnimation(urgentPulse);
  }, [shouldUrgentPulse, urgent, urgentPulse]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enterOp.value,
    transform: [{ scale: enterScale.value }],
  }));

  // Right semicircle covers 12→6 o'clock (0..180°); drains during frac ∈ [0.5, 0]
  const rightMaskStyle = useAnimatedStyle(() => {
    const f = fracSv.value;
    const rightShare = Math.max(0, Math.min(1, f * 2));
    const deg = -(1 - rightShare) * 180;
    return {
      opacity: f <= 0.002 ? 0 : 1,
      transform: [{ rotate: `${deg}deg` }],
    };
  });

  // Left semicircle covers 6→12 o'clock (180..360°); drains during frac ∈ [1, 0.5]
  const leftMaskStyle = useAnimatedStyle(() => {
    const f = fracSv.value;
    const leftShare = Math.max(0, Math.min(1, (f - 0.5) * 2));
    const deg = -(1 - leftShare) * 180;
    return {
      opacity: f <= 0.502 ? 0 : 1,
      transform: [{ rotate: `${deg}deg` }],
    };
  });

  // Rotating rounded tip dot tracks exact leading edge at 60fps
  const tipStyle = useAnimatedStyle(() => ({
    opacity: fracSv.value <= 0.005 ? 0 : 1,
    transform: [{ rotate: `${fracSv.value * 360}deg` }],
  }));

  const urgentRimStyle = useAnimatedStyle(() => ({
    opacity: urgentPulse.value,
  }));

  const dial = (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} testID="evolution-ring-dial">
      {/* Static base track */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={half} cy={half} r={r} stroke="#E9D5FF" strokeWidth={strokeW} fill={COLORS.canvasWhite} />
      </Svg>
      {/* Right-half GPU rotating semicircle */}
      <View
        pointerEvents="none"
        style={[st.ringHalfClip, { left: half, width: half, height: size }]}
      >
        <Animated.View
          style={[{ position: 'absolute', left: -half, top: 0, width: size, height: size }, rightMaskStyle]}
        >
          <Svg width={size} height={size}>
            <Circle
              cx={half}
              cy={half}
              r={r}
              stroke={ringColor}
              strokeWidth={strokeW}
              fill="none"
              strokeDasharray={`${halfC} ${c}`}
              strokeLinecap="butt"
              transform={`rotate(-90 ${half} ${half})`}
            />
          </Svg>
        </Animated.View>
      </View>
      {/* Left-half GPU rotating semicircle */}
      <View
        pointerEvents="none"
        style={[st.ringHalfClip, { left: 0, width: half, height: size }]}
      >
        <Animated.View
          style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, leftMaskStyle]}
        >
          <Svg width={size} height={size}>
            <Circle
              cx={half}
              cy={half}
              r={r}
              stroke={ringColor}
              strokeWidth={strokeW}
              fill="none"
              strokeDasharray={`${halfC} ${c}`}
              strokeLinecap="butt"
              transform={`rotate(90 ${half} ${half})`}
            />
          </Svg>
        </Animated.View>
      </View>
      {/* Crisp 12-o'clock start cap + 60fps rotating leading tip cap */}
      {frac > 0.005 && (
        <View
          pointerEvents="none"
          style={[
            st.ringCapDot,
            {
              width: strokeW,
              height: strokeW,
              borderRadius: strokeW / 2,
              backgroundColor: ringColor,
              left: half - strokeW / 2,
              top: half - r - strokeW / 2,
            },
          ]}
        />
      )}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, tipStyle]}>
        <View
          style={[
            st.ringCapDot,
            {
              width: strokeW,
              height: strokeW,
              borderRadius: strokeW / 2,
              backgroundColor: ringColor,
              left: half - strokeW / 2,
              top: half - r - strokeW / 2,
            },
          ]}
        />
      </Animated.View>
      <Icon name={icon} size={compact ? 12 : 14} color={INK} />
    </View>
  );

  if (compact) {
    return (
      <Animated.View
        style={[st.ringPill, urgent && st.ringPillUrgent, enterStyle]}
        accessibilityLabel={`${name} evolution, ${secs} seconds left`}
        testID="evolution-ring"
      >
        {urgent && (
          <Animated.View pointerEvents="none" style={[st.ringPillUrgentRim, urgentRimStyle]} />
        )}
        {dial}
        <Text style={[st.ringPillSecs, urgent && st.ringSecsUrgent]}>{secs}s</Text>
      </Animated.View>
    );
  }
  return (
    <Animated.View
      style={[st.ring, enterStyle]}
      accessibilityLabel={`${name} evolution, ${secs} seconds left`}
      testID="evolution-ring"
    >
      {dial}
      <Text style={[st.ringSecs, urgent && st.ringSecsUrgent]}>{secs}</Text>
    </Animated.View>
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
  ringHalfClip: { position: 'absolute', top: 0, overflow: 'hidden' },
  ringCapDot: { position: 'absolute' },
  ringSecs: { position: 'absolute', bottom: -6, fontSize: 9, fontWeight: '900', color: INK, backgroundColor: COLORS.canvasWhite, borderRadius: 4, paddingHorizontal: 2, overflow: 'hidden', fontVariant: ['tabular-nums'] },
  ringSecsUrgent: { color: '#B91C1C' },
  ringPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FEF3C7', borderRadius: 999, borderWidth: 1.5, borderColor: TONE.evoReady, paddingLeft: 1, paddingRight: 5, paddingVertical: 0.5, overflow: 'hidden' },
  ringPillUrgent: { backgroundColor: '#FEE2E2', borderColor: COLORS.impactRed },
  ringPillUrgentRim: { ...StyleSheet.absoluteFillObject, borderRadius: 999, borderWidth: 1.5, borderColor: '#FFFFFF' },
  ringPillSecs: { fontSize: 9.5, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
});
