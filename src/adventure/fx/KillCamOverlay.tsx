/**
 * Expedition 33–inspired Clair-Obscur Slow-Mo Defeat Finisher.
 *
 * Plays once on a decisive fight-winning knockout (after the lethal Set's
 * thrown cards hit the foe — never dimming the throw or fighting a duplicate
 * K.O.! banner):
 *   0–220 ms  : Lethal Set cards fly in and smash into the foe at full speed.
 * 220–860 ms  : Time dilates — painterly monochrome/high-contrast wash drains
 *               color from the battlefield, crisp ink+gold cinema letterbox
 *               bars glide in, a golden chiaroscuro slash cuts across the foe,
 *               14 golden chroma diamond petals erupt fast then suspend into
 *               0.15× slow-mo drift, and the Victory crest settles over the
 *               open board while the live soundtrack drags down in tempo & pitch.
 * 860–1080 ms : Time snaps free — color & bars release cleanly as `band.finale(true)`
 *               swells straight into the Victory Results Card with zero dead air.
 *
 * Zero white full-screen flashes. Pure one-shot GPU `transform`/`opacity`
 * animations (`pointerEvents="none"`). Under Reduced Motion or Effects off,
 * displays a crisp static Victory banner fade with zero travel, letterbox, or wash.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';
import { band } from '@/audio';
import { COLORS } from '@/utils/colors';
import { EASE, MS, exitMs } from '@/utils/motion';
import type { Anchors } from './anchors';
import { fxMs } from './clock';
import type { SetIgnition } from '../types';

/** Let the lethal Set's cards reach the foe before time slows (matches FX_TIMING.flightMs + audio-grid slip ≈ 290 ms) */
export const SLOWMO_IMPACT_DELAY_MS = 290;
/** How long the suspended Clair-Obscur slow-mo breath holds before releasing into Results */
export const SLOWMO_HOLD_MS = 780;
/** Smooth release back to color as the victory fanfare swells and hands off */
export const SLOWMO_RELEASE_MS = 240;
/** Extra settle buffer after release finishes so zero elements hard-stop into ScreenTransition */
export const SLOWMO_SETTLE_PAD_MS = 64;
/** Total knockout cinema duration before Results mounts (zero dead air, zero hard-stops) */
export const SLOWMO_TOTAL_MS = SLOWMO_IMPACT_DELAY_MS + SLOWMO_HOLD_MS + SLOWMO_RELEASE_MS + SLOWMO_SETTLE_PAD_MS;
/** Crisp reduced-motion / effects-off victory hold before Results mounts */
export const SLOWMO_REDUCED_TOTAL_MS = 620;

interface Props {
  ignition: SetIgnition | null;
  /** True once the fight's final enemy is defeated (won) */
  victory?: boolean;
  /** True when the player won with zero mistakes */
  flawless?: boolean;
  /** Override impact wait (0 for instant / burn kills; defaults to SLOWMO_IMPACT_DELAY_MS) */
  impactDelayMs?: number;
  anchors: Anchors;
  stageSize: { w: number; h: number };
  enabled: boolean;
  reduced?: boolean;
}

const LETTERBOX_H = 52;
const KEEP = { reduceMotion: ReduceMotion.Never } as const;

/** True slow-motion velocity curve: fast explosive impulse out of the hit, then silken suspended drift */
const EASE_SLOWMO_DRIFT = Easing.bezier(0.06, 0.94, 0.14, 1);

/** Deterministic golden chiaroscuro diamond petals / ink shards radiating from the defeated foe */
const CHROMA_SHARDS = [
  { deg: -162, dist: 148, lift: -18, size: 17, color: '#FFE84D', delay: 0, spin: -115 },
  { deg: -134, dist: 108, lift: -36, size: 13, color: '#FFFDF5', delay: 14, spin: 95 },
  { deg: -102, dist: 112, lift: -42, size: 18, color: '#F5B800', delay: 8, spin: -80 },
  { deg: -68, dist: 96, lift: -32, size: 12, color: '#FB923C', delay: 22, spin: 125 },
  { deg: -36, dist: 126, lift: -16, size: 15, color: '#FFE84D', delay: 10, spin: 105 },
  { deg: -10, dist: 106, lift: -8, size: 13, color: '#16AA98', delay: 18, spin: -90 },
  { deg: 18, dist: 134, lift: 6, size: 18, color: '#F5B800', delay: 4, spin: 115 },
  { deg: 48, dist: 116, lift: 22, size: 13, color: '#FFFDF5', delay: 20, spin: -100 },
  { deg: 82, dist: 132, lift: 32, size: 16, color: '#FFE84D', delay: 12, spin: 85 },
  { deg: 116, dist: 114, lift: 26, size: 12, color: '#FB923C', delay: 24, spin: -120 },
  { deg: 146, dist: 154, lift: 14, size: 17, color: '#F5B800', delay: 6, spin: 100 },
  { deg: 172, dist: 124, lift: -4, size: 13, color: '#16AA98', delay: 16, spin: -85 },
  { deg: -148, dist: 84, lift: -12, size: 11, color: '#FFFDF5', delay: 28, spin: 70 },
  { deg: 128, dist: 168, lift: 44, size: 15, color: '#FFE84D', delay: 16, spin: -95 },
] as const;

const ChromaShard: React.FC<{
  originX: number;
  originY: number;
  deg: number;
  dist: number;
  lift: number;
  size: number;
  color: string;
  delay: number;
  spin: number;
}> = ({ originX, originY, deg, dist, lift, size, color, delay, spin }) => {
  const p = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    const start = fxMs(delay);
    // Finish drifting & fading well BEFORE ScreenTransition takes over so zero shards hard-stop
    const dur = fxMs(SLOWMO_HOLD_MS + SLOWMO_RELEASE_MS - 120 - delay);
    p.value = withDelay(start, withTiming(1, { duration: Math.max(240, dur), easing: EASE_SLOWMO_DRIFT }));
    fade.value = withDelay(
      start,
      withSequence(
        withTiming(1, { duration: fxMs(64), easing: EASE.ui }),
        withDelay(
          fxMs(Math.max(120, SLOWMO_HOLD_MS - 180 - delay)),
          withTiming(0, { duration: fxMs(SLOWMO_RELEASE_MS), easing: EASE.exitSoft })
        )
      )
    );
  }, [delay, p, fade]);

  const rad = (deg * Math.PI) / 180;
  const dx = Math.cos(rad) * dist;
  const dy = Math.sin(rad) * dist + lift;
  const half = size / 2;

  const anim = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: fade.value,
      transform: [
        { translateX: originX + dx * t - half },
        { translateY: originY + dy * t - half },
        { scale: 0.45 + Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5) * 0.65 },
        { rotate: `${deg + spin * t}deg` },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[st.shardWrap, { width: size, height: size }, anim]}>
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Polygon points="10,1 16,10 10,19 4,10" fill={color} stroke="#161412" strokeWidth="2" />
      </Svg>
    </Animated.View>
  );
};

/** Web-only GPU-composited monochrome chiaroscuro backdrop filter */
const WEB_NOIR_STYLE: ViewStyle | undefined =
  Platform.OS === 'web'
    ? ({
        backdropFilter: 'grayscale(0.92) contrast(1.22) brightness(0.84)',
        WebkitBackdropFilter: 'grayscale(0.92) contrast(1.22) brightness(0.84)',
      } as unknown as ViewStyle)
    : undefined;

const KillCamOverlay: React.FC<Props> = ({
  ignition,
  victory = false,
  flawless = false,
  impactDelayMs = SLOWMO_IMPACT_DELAY_MS,
  anchors,
  stageSize,
  enabled,
  reduced = false,
}) => {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [headline, setHeadline] = useState('VICTORY!');
  const [eyebrow, setEyebrow] = useState('FOE VANQUISHED');
  const [origin, setOrigin] = useState({ x: 260, y: 120 });
  const firedKey = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const noirOp = useSharedValue(0);
  const barIn = useSharedValue(0);
  const slashScale = useSharedValue(0);
  const slashOp = useSharedValue(0);
  const bannerOp = useSharedValue(0);
  const bannerScale = useSharedValue(1);
  const ruleScale = useSharedValue(0);

  const isQuiet = !enabled || reduced;
  // Trigger strictly on a decisive fight victory (never on mid-wave trash kills)
  const triggerKey = victory ? `win:${ignition?.id ?? 0}` : null;

  useEffect(() => {
    if (!triggerKey || firedKey.current === triggerKey) return;
    firedKey.current = triggerKey;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const waitMs = ignition?.lethal ? fxMs(impactDelayMs) : 0;

    const text =
      ignition?.parryKind === 'perfect'
        ? 'PERFECT PARRY K.O.!'
        : ignition?.isBossOrElite
          ? 'BOSS VANQUISHED'
          : flawless
            ? 'FLAWLESS VICTORY'
            : 'VICTORY!';
    const dmg = ignition ? Math.round(ignition.turnDamage ?? ignition.math.hit) : 0;
    const sub = dmg > 0 ? `FINAL BLOW · ${dmg} DMG` : 'FOE VANQUISHED';

    const start = () => {
      const foeRect = anchors.rect('foe');
      const ox = foeRect ? foeRect.x + foeRect.w / 2 : stageSize.w * 0.72;
      const oy = foeRect ? foeRect.y + foeRect.h / 2 : Math.min(130, stageSize.h * 0.22);
      setOrigin({ x: ox, y: oy });
      setHeadline(text);
      setEyebrow(sub);
      setActiveKey(triggerKey);

      if (isQuiet) {
        // Reduced motion / effects off: crisp opacity-only victory stamp, zero travel or wash
        noirOp.value = 0;
        barIn.value = 0;
        slashOp.value = 0;
        ruleScale.value = 1;
        bannerScale.value = 1;
        bannerOp.value = withSequence(
          withTiming(1, { duration: fxMs(MS.feedback), easing: EASE.ui, ...KEEP }),
          withDelay(
            fxMs(SLOWMO_REDUCED_TOTAL_MS - MS.feedback * 2),
            withTiming(0, { duration: fxMs(MS.feedback), easing: EASE.exitSoft, ...KEEP })
          )
        );
        timers.current.push(
          setTimeout(() => {
            setActiveKey(cur => (cur === triggerKey ? null : cur));
          }, fxMs(SLOWMO_REDUCED_TOTAL_MS))
        );
        return;
      }

      // Engage Expedition 33 audio time-dilation on the EXACT impact frame
      band.slowMoDefeat({
        boss: ignition?.isBossOrElite,
        perfectParry: ignition?.parryKind === 'perfect',
      });

      const holdMs = fxMs(SLOWMO_HOLD_MS);
      const relMs = fxMs(SLOWMO_RELEASE_MS);

      // 1. Painterly monochrome chiaroscuro wash
      noirOp.value = withSequence(
        withTiming(1, { duration: fxMs(MS.feedback), easing: EASE.enter }),
        withDelay(holdMs - fxMs(MS.feedback), withTiming(0, { duration: relMs, easing: EASE.exitSoft }))
      );

      // 2. Ink + gold cinematic letterbox bars glide smoothly in and retract on release
      barIn.value = withSequence(
        withTiming(1, { duration: fxMs(MS.move), easing: EASE.enterSoft }),
        withDelay(holdMs - fxMs(MS.move), withTiming(0, { duration: fxMs(exitMs(MS.move)), easing: EASE.exitSoft }))
      );

      // 3. Golden chiaroscuro ink slash across the defeated foe (NO white full-screen flash!)
      slashScale.value = 0.08;
      slashScale.value = withTiming(1, { duration: fxMs(MS.feedback), easing: EASE.enter });
      slashOp.value = withSequence(
        withTiming(1, { duration: fxMs(48), easing: EASE.ui }),
        withDelay(fxMs(220), withTiming(0, { duration: fxMs(260), easing: EASE.exitSoft }))
      );

      // 4. Ceremonial Victory Seal (scales DOWN from 1.14 → 1.0, never up; holds still to read)
      ruleScale.value = 0;
      ruleScale.value = withDelay(
        fxMs(48),
        withSequence(
          withTiming(1, { duration: fxMs(MS.move), easing: EASE.enterSoft }),
          withDelay(holdMs - fxMs(MS.move + 48), withTiming(0, { duration: fxMs(exitMs(MS.quick)), easing: EASE.exitSoft }))
        )
      );
      bannerScale.value = 1.14;
      bannerScale.value = withDelay(fxMs(48), withTiming(1, { duration: fxMs(MS.move), easing: EASE.enterSoft }));
      bannerOp.value = withDelay(
        fxMs(48),
        withSequence(
          withTiming(1, { duration: fxMs(MS.feedback), easing: EASE.ui }),
          withDelay(holdMs - fxMs(MS.feedback + 48), withTiming(0, { duration: fxMs(exitMs(MS.quick)), easing: EASE.exitSoft }))
        )
      );

      timers.current.push(
        setTimeout(() => {
          setActiveKey(cur => (cur === triggerKey ? null : cur));
        }, holdMs + relMs)
      );
    };

    if (waitMs > 0) {
      timers.current.push(setTimeout(start, waitMs));
    } else {
      start();
    }

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [triggerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const noirStyle = useAnimatedStyle(() => ({ opacity: noirOp.value }));
  const topBarStyle = useAnimatedStyle(() => ({
    opacity: barIn.value > 0.01 ? 1 : 0,
    transform: [{ translateY: -(1 - barIn.value) * (LETTERBOX_H + 4) }],
  }));
  const botBarStyle = useAnimatedStyle(() => ({
    opacity: barIn.value > 0.01 ? 1 : 0,
    transform: [{ translateY: (1 - barIn.value) * (LETTERBOX_H + 4) }],
  }));
  const slashStyle = useAnimatedStyle(() => ({
    opacity: slashOp.value,
    transform: [{ rotate: '-18deg' }, { scaleX: slashScale.value }],
  }));
  const bannerStyle = useAnimatedStyle(() => ({
    opacity: bannerOp.value,
    transform: [{ scale: bannerScale.value }],
  }));
  const ruleStyle = useAnimatedStyle(() => ({
    opacity: bannerOp.value,
    transform: [{ scaleX: ruleScale.value }],
  }));

  if (!activeKey || activeKey !== triggerKey) return null;

  return (
    <View testID="kill-cam-overlay" pointerEvents="none" style={st.root}>
      {/* Clair-Obscur monochrome painterly slow-mo grade */}
      {!isQuiet && <Animated.View style={[st.noirWash, WEB_NOIR_STYLE, noirStyle]} />}

      {/* Cinematic ink + brushed-gold letterbox framing */}
      {!isQuiet && (
        <>
          <Animated.View style={[st.letterboxTop, topBarStyle]} />
          <Animated.View style={[st.letterboxBottom, botBarStyle]} />
        </>
      )}

      {/* Chiaroscuro luminous golden slash across the defeated foe */}
      {!isQuiet && (
        <Animated.View
          style={[
            st.slashWrap,
            { left: origin.x - 110, top: origin.y - 4 },
            slashStyle,
          ]}
        >
          <View style={st.slashOuter}>
            <View style={st.slashCore} />
          </View>
        </Animated.View>
      )}

      {/* Slow-motion suspended golden chroma diamond petals */}
      {!isQuiet &&
        CHROMA_SHARDS.map((shard, idx) => (
          <ChromaShard
            key={`${activeKey}-${idx}`}
            originX={origin.x}
            originY={origin.y}
            deg={shard.deg}
            dist={shard.dist}
            lift={shard.lift}
            size={shard.size}
            color={shard.color}
            delay={shard.delay}
            spin={shard.spin}
          />
        ))}

      {/* Single undisputed ceremonial Victory banner in open mid-board space */}
      <View style={st.bannerCenter}>
        <Animated.View style={[st.goldRule, ruleStyle]} />
        <Animated.View style={[st.banner, bannerStyle]}>
          <Text style={st.eyebrowText}>{eyebrow}</Text>
          <Text style={st.bannerText} numberOfLines={1} adjustsFontSizeToFit>
            {headline}
          </Text>
        </Animated.View>
        <Animated.View style={[st.goldRule, ruleStyle]} />
      </View>
    </View>
  );
};

const st = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 255,
    overflow: 'hidden',
  },
  noirWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Platform.OS === 'web' ? 'rgba(15, 13, 12, 0.24)' : 'rgba(14, 12, 11, 0.44)',
  },
  letterboxTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: LETTERBOX_H,
    backgroundColor: '#0D0C0B',
    borderBottomWidth: 2,
    borderBottomColor: '#F5B800',
  },
  letterboxBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: LETTERBOX_H,
    backgroundColor: '#0D0C0B',
    borderTopWidth: 2,
    borderTopColor: '#F5B800',
  },
  slashWrap: {
    position: 'absolute',
    width: 220,
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slashOuter: {
    width: 220,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#F5B800',
    borderWidth: 1.5,
    borderColor: '#161412',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slashCore: {
    width: 190,
    height: 2.5,
    borderRadius: 999,
    backgroundColor: '#FFFDF5',
  },
  bannerCenter: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '43%',
    alignItems: 'center',
    gap: 5,
  },
  goldRule: {
    width: '74%',
    height: 2,
    backgroundColor: '#F5B800',
    borderRadius: 2,
  },
  banner: {
    backgroundColor: 'rgba(16, 14, 13, 0.92)',
    borderWidth: 2,
    borderColor: '#F5B800',
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
    maxWidth: 340,
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFE84D',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  bannerText: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.canvasWhite,
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  shardWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});

export default KillCamOverlay;
