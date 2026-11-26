/**
 * Expedition 33–inspired Clair-Obscur Slow-Mo Defeat Finisher ([FX-08] + [FX-23]).
 *
 * Stakes-split victory cinema:
 * - `full` mode (Bosses, Elites / `level.branchOf`, First-Time Clears, New 3★):
 *   Synced directly to the lethal beat's `onLand` (`triggerNow`), playing Wave 3's
 *   `band.playKillCamRiser()` during lethal flight, engaging `band.slowMoDefeat()`
 *   + `band.playKillCamShatter(48)` on Boss/Elite/Perfect KO impact, scaling
 *   shard radii by viewport width, elevating Boss KOs with a `+200 ms` hold +
 *   crossed double golden slash + 6 extra gold/crimson shards (20 total <= 24 cap),
 *   and unlocking tap / `Enter` / `Space` skip after `250 ms` (`band.finale(true)`).
 * - `brisk` mode (routine repeat clears, `SLOWMO_BRISK_TOTAL_MS = 350 ms`):
 *   Crisp golden slash + compact banner stamp straight into Results (>1.0 s saved!).
 *
 * Zero white full-screen flashes. Pure one-shot GPU `transform`/`opacity` animations
 * with `cancelAnimation(...)` cleanup. Under Reduced Motion or Effects off, displays
 * a crisp static Victory banner fade with zero travel, letterbox, or wash.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
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
import type { RunState, SetIgnition } from '../types';
import { resolveVictoryCallout } from '../victoryCallout';

/** Let the lethal Set's cards reach the foe before time slows (matches FX_TIMING.flightMs + audio-grid slip ≈ 290 ms) */
export const SLOWMO_IMPACT_DELAY_MS = 290;
/** How long the suspended Clair-Obscur slow-mo breath holds before releasing into Results */
export const SLOWMO_HOLD_MS = 780;
/** Extra ceremonial hold granted to Boss KOs ([FX-08]: 780 -> 980 ms) */
export const SLOWMO_BOSS_EXTRA_HOLD_MS = 200;
/** Smooth release back to color as the victory fanfare swells and hands off */
export const SLOWMO_RELEASE_MS = 240;
/** Extra settle buffer after release finishes so zero elements hard-stop into ScreenTransition */
export const SLOWMO_SETTLE_PAD_MS = 64;
/** Total knockout cinema duration before Results mounts (zero dead air, zero hard-stops) */
export const SLOWMO_TOTAL_MS = SLOWMO_IMPACT_DELAY_MS + SLOWMO_HOLD_MS + SLOWMO_RELEASE_MS + SLOWMO_SETTLE_PAD_MS;
/** Crisp reduced-motion / effects-off victory hold before Results mounts */
export const SLOWMO_REDUCED_TOTAL_MS = 620;
/** Brisk routine-clear slash + banner stamp duration ([FX-08]) */
export const SLOWMO_BRISK_TOTAL_MS = 350;
/** Accidental-tap guard before tap / Enter / Space skip unlocks on full KillCam ([FX-08]) */
export const SLOWMO_SKIP_GUARD_MS = 250;
/** Subtle bottom-right "Tap to continue" whisper reveal time */
export const SLOWMO_SKIP_HINT_MS = 350;

export type KillCamMode = 'full' | 'brisk';

/**
 * [FX-08] Stakes-split KillCam policy:
 * Full slow-mo cinema plays ONLY on Bosses, Elites (`branchOf` / Summit elite),
 * First-Time Clears (`previousBestStars === 0`), or New 3★ Clears.
 * Routine repeat clears play the crisp `350 ms` brisk slash.
 */
export const resolveKillCamMode = (opts: {
  isBoss?: boolean;
  isElite?: boolean;
  previousBestStars?: number | null;
  stars?: number | null;
}): KillCamMode => {
  if (opts.isBoss || opts.isElite) return 'full';
  const prev = opts.previousBestStars ?? 0;
  if (prev === 0) return 'full';
  if (opts.stars === 3 && prev < 3) return 'full';
  return 'brisk';
};

/** [FX-08] Viewport-scaled travel/shake multiplier (`0.75..1.5`, baseline 375 px phone width). */
export const viewportShakeScale = (stageW: number): number =>
  Math.max(0.75, Math.min(1.5, (stageW > 0 ? stageW : 375) / 375));

interface Props {
  ignition: SetIgnition | null;
  /** True once the fight ends in a victory */
  victory?: boolean;
  /** Earned stars (1–3) in Adventure Mode, or null in starless modes like Starfall Summit */
  stars?: number | null;
  /** How the fight ended ('defeated' knockout vs 'survived' timer/moves out) */
  endReason?: RunState['endReason'];
  /** Total health lost during this fight (0 = untouched) */
  damageReceived?: number;
  /** Invalid selections made during this fight */
  mistakes?: number;
  /** Whether this fight tracks player hearts */
  hasHearts?: boolean;
  /** Hearts remaining at fight end */
  heartsLeft?: number | null;
  /** True when the defeated foe is a boss */
  isBoss?: boolean;
  /** True when the defeated foe is a Summit elite or campaign branch elite */
  isElite?: boolean;
  /** Legacy shorthand: true when no health/mistakes were lost (used only if damageReceived is omitted) */
  flawless?: boolean;
  /** Override impact wait (0 for instant / burn kills; defaults to SLOWMO_IMPACT_DELAY_MS) */
  impactDelayMs?: number;
  /** [FX-08] 'full' ceremonial cinema vs 'brisk' 350 ms routine slash (default 'full') */
  cinemaMode?: KillCamMode;
  /** [FX-23] When provided, starts on exact lethal `Beat.onLand` instead of wall-clock guess */
  triggerNow?: boolean;
  /** [FX-08] Invoked when the player taps or presses Enter/Space after 250 ms to skip straight to Results */
  onSkip?: () => void;
  /** Optional callback fired on the exact impact frame (lets AdventureRun sync zoom & shake) */
  onImpact?: () => void;
  anchors: Anchors;
  stageSize: { w: number; h: number };
  enabled: boolean;
  reduced?: boolean;
}

const LETTERBOX_H = 52;
const KEEP = { reduceMotion: ReduceMotion.Never } as const;

/** True slow-motion velocity curve: fast explosive impulse out of the hit, then silken suspended drift */
const EASE_SLOWMO_DRIFT = Easing.bezier(0.06, 0.94, 0.14, 1);

/** Deterministic golden chiaroscuro diamond petals / ink shards radiating from the defeated foe (14 base) */
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

/** 6 deterministic outer gold-and-crimson Boss KO shards (total 20 shards <= 24 particle cap [FX-08]) */
const BOSS_EXTRA_SHARDS = [
  { deg: -174, dist: 182, lift: -24, size: 19, color: '#DC2626', delay: 12, spin: -140 },
  { deg: -118, dist: 166, lift: -48, size: 18, color: '#FFE84D', delay: 20, spin: 130 },
  { deg: -52, dist: 174, lift: -28, size: 19, color: '#DC2626', delay: 16, spin: -125 },
  { deg: 6, dist: 184, lift: 12, size: 17, color: '#F5B800', delay: 24, spin: 135 },
  { deg: 64, dist: 172, lift: 38, size: 19, color: '#DC2626', delay: 18, spin: -130 },
  { deg: 158, dist: 188, lift: 22, size: 18, color: '#FFE84D', delay: 28, spin: 145 },
] as const;

export const KILL_CAM_SHARD_COUNTS = {
  standard: CHROMA_SHARDS.length,
  boss: CHROMA_SHARDS.length + BOSS_EXTRA_SHARDS.length,
} as const;

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
  holdMs: number;
}> = ({ originX, originY, deg, dist, lift, size, color, delay, spin, holdMs }) => {
  const p = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    const start = fxMs(delay);
    // Finish drifting & fading well BEFORE ScreenTransition takes over so zero shards hard-stop
    const dur = fxMs(holdMs + SLOWMO_RELEASE_MS - 120 - delay);
    p.value = withDelay(start, withTiming(1, { duration: Math.max(240, dur), easing: EASE_SLOWMO_DRIFT }));
    fade.value = withDelay(
      start,
      withSequence(
        withTiming(1, { duration: fxMs(64), easing: EASE.ui }),
        withDelay(
          fxMs(Math.max(120, holdMs - 180 - delay)),
          withTiming(0, { duration: fxMs(SLOWMO_RELEASE_MS), easing: EASE.exitSoft })
        )
      )
    );
    return () => {
      cancelAnimation(p);
      cancelAnimation(fade);
    };
  }, [delay, holdMs, p, fade]);

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
  stars = null,
  endReason = 'defeated',
  damageReceived,
  mistakes,
  hasHearts = false,
  heartsLeft = null,
  isBoss = false,
  isElite = false,
  flawless = false,
  impactDelayMs = SLOWMO_IMPACT_DELAY_MS,
  cinemaMode = 'full',
  triggerNow,
  onSkip,
  onImpact,
  anchors,
  stageSize,
  enabled,
  reduced = false,
}) => {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [headline, setHeadline] = useState('NICE JOB!');
  const [eyebrow, setEyebrow] = useState('STAGE CLEAR');
  const [showSlash, setShowSlash] = useState(true);
  const [origin, setOrigin] = useState({ x: 260, y: 120 });
  const [canSkip, setCanSkip] = useState(false);
  const [showSkipHint, setShowSkipHint] = useState(false);

  const firedKey = useRef<string | null>(null);
  const riserKey = useRef<string | null>(null);
  const skippedRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onSkipRef = useRef(onSkip);
  onSkipRef.current = onSkip;
  const onImpactRef = useRef(onImpact);
  onImpactRef.current = onImpact;

  const noirOp = useSharedValue(0);
  const barIn = useSharedValue(0);
  const slashScale = useSharedValue(0);
  const slashOp = useSharedValue(0);
  const slash2Scale = useSharedValue(0);
  const slash2Op = useSharedValue(0);
  const bannerOp = useSharedValue(0);
  const bannerScale = useSharedValue(1);
  const ruleScale = useSharedValue(0);

  const isQuiet = !enabled || reduced;
  const effectiveBoss = isBoss || Boolean(ignition?.isBossOrElite && !isElite);
  const isFullCinema = !isQuiet && cinemaMode === 'full';
  const isBriskCinema = !isQuiet && cinemaMode === 'brisk';
  const holdDurationMs = SLOWMO_HOLD_MS + (effectiveBoss ? SLOWMO_BOSS_EXTRA_HOLD_MS : 0);
  const distScale = viewportShakeScale(stageSize.w);

  // Trigger strictly on a decisive fight victory (never on mid-wave trash kills)
  const triggerKey = victory ? `win:${ignition?.id ?? 0}` : null;

  const clearAllTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const cancelAllAnims = useCallback(() => {
    cancelAnimation(noirOp);
    cancelAnimation(barIn);
    cancelAnimation(slashScale);
    cancelAnimation(slashOp);
    cancelAnimation(slash2Scale);
    cancelAnimation(slash2Op);
    cancelAnimation(bannerOp);
    cancelAnimation(bannerScale);
    cancelAnimation(ruleScale);
  }, [noirOp, barIn, slashScale, slashOp, slash2Scale, slash2Op, bannerOp, bannerScale, ruleScale]);

  const handleSkip = useCallback(() => {
    if (!canSkip || skippedRef.current || !activeKey) return;
    skippedRef.current = true;
    clearAllTimers();
    cancelAllAnims();
    setCanSkip(false);
    setShowSkipHint(false);
    setActiveKey(null);
    if (typeof band?.finale === 'function') {
      band.finale(true);
    }
    onSkipRef.current?.();
  }, [canSkip, activeKey, clearAllTimers, cancelAllAnims]);

  // Web keyboard skip (`Enter` / `Space`) once skip guard clears
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !activeKey || !canSkip) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeKey, canSkip, handleSkip]);

  // Reset per-fight refs when victory clears (e.g. instant retry / new fight)
  useEffect(() => {
    if (!victory) {
      firedKey.current = null;
      riserKey.current = null;
      skippedRef.current = false;
      setCanSkip(false);
      setShowSkipHint(false);
      setActiveKey(null);
    }
  }, [victory]);

  // [AU-06]: Fire Wave 3's Kill-Cam anticipation riser as soon as lethal cards launch in full cinema
  useEffect(() => {
    if (!triggerKey || !isFullCinema || !ignition?.lethal) return;
    if (triggerNow === true) return;
    if (riserKey.current === triggerKey) return;
    riserKey.current = triggerKey;
    if (typeof band?.playKillCamRiser === 'function') {
      band.playKillCamRiser(0);
    }
  }, [triggerKey, isFullCinema, ignition?.lethal, triggerNow]);

  useEffect(() => {
    if (!triggerKey || firedKey.current === triggerKey) return;

    const waitingForLand = triggerNow === false && !isQuiet && Boolean(ignition?.lethal);
    clearAllTimers();

    const dmg = ignition ? Math.round(ignition.turnDamage ?? ignition.math.hit) : 0;
    const resolvedDamageReceived = damageReceived ?? (flawless ? 0 : 1);
    const resolvedMistakes = mistakes ?? (flawless ? 0 : 1);
    const callout = resolveVictoryCallout({
      stars,
      endReason,
      damageReceived: resolvedDamageReceived,
      mistakes: resolvedMistakes,
      hasHearts,
      heartsLeft,
      isBoss: effectiveBoss,
      isElite,
      isPerfectParryKo: ignition?.parryKind === 'perfect' && endReason === 'defeated',
      finalBlowDmg: dmg,
    });
    const text = callout.headline;
    const sub = callout.eyebrow;
    const knockedOut = endReason !== 'survived';

    const start = () => {
      if (firedKey.current === triggerKey) return;
      firedKey.current = triggerKey;
      skippedRef.current = false;

      const foeRect = anchors.rect('foe');
      const ox = foeRect ? foeRect.x + foeRect.w / 2 : stageSize.w * 0.72;
      const oy = foeRect ? foeRect.y + foeRect.h / 2 : Math.min(130, stageSize.h * 0.22);
      setOrigin({ x: ox, y: oy });
      setHeadline(text);
      setEyebrow(sub);
      setShowSlash(knockedOut);
      setCanSkip(false);
      setShowSkipHint(false);
      setActiveKey(triggerKey);
      onImpactRef.current?.();

      if (isQuiet) {
        // Reduced motion / effects off: crisp opacity-only victory stamp, zero travel or wash
        noirOp.value = 0;
        barIn.value = 0;
        slashOp.value = 0;
        slash2Op.value = 0;
        ruleScale.value = 1;
        bannerScale.value = 1;
        bannerOp.value = withSequence(
          withTiming(1, { duration: fxMs(MS.feedback), easing: EASE.ui, ...KEEP }),
          withDelay(
            fxMs(SLOWMO_REDUCED_TOTAL_MS - MS.feedback * 2),
            withTiming(0, { duration: fxMs(MS.feedback), easing: EASE.exitSoft, ...KEEP }),
            KEEP.reduceMotion
          )
        );
        timers.current.push(
          setTimeout(() => {
            setActiveKey(cur => (cur === triggerKey ? null : cur));
          }, fxMs(SLOWMO_REDUCED_TOTAL_MS))
        );
        return;
      }

      if (cinemaMode === 'brisk') {
        // [FX-08] Routine clear: brisk 350 ms golden slash + compact banner stamp (saves >1.0 s)
        noirOp.value = 0;
        barIn.value = 0;
        slash2Op.value = 0;
        slashScale.value = 0.08;
        slashScale.value = withTiming(1, { duration: fxMs(96), easing: EASE.enter });
        slashOp.value = withSequence(
          withTiming(1, { duration: fxMs(36), easing: EASE.ui }),
          withDelay(fxMs(140), withTiming(0, { duration: fxMs(140), easing: EASE.exitSoft }))
        );
        ruleScale.value = 0.2;
        ruleScale.value = withTiming(1, { duration: fxMs(MS.feedback), easing: EASE.enterSoft });
        bannerScale.value = 1.08;
        bannerScale.value = withTiming(1, { duration: fxMs(MS.feedback), easing: EASE.enterSoft });
        bannerOp.value = withSequence(
          withTiming(1, { duration: fxMs(64), easing: EASE.ui }),
          withDelay(fxMs(SLOWMO_BRISK_TOTAL_MS - 160), withTiming(0, { duration: fxMs(96), easing: EASE.exitSoft }))
        );
        timers.current.push(
          setTimeout(() => {
            setActiveKey(cur => (cur === triggerKey ? null : cur));
          }, fxMs(SLOWMO_BRISK_TOTAL_MS))
        );
        return;
      }

      // Full cinema: engage Expedition 33 audio time-dilation on the EXACT impact frame
      band.slowMoDefeat({
        boss: effectiveBoss || isElite,
        perfectParry: ignition?.parryKind === 'perfect',
      });
      // [AU-06]: Layer Wave 3's golden slash shatter (+48 ms) on Boss, Elite, or Perfect Parry KOs
      if ((effectiveBoss || isElite || ignition?.parryKind === 'perfect') && typeof band?.playKillCamShatter === 'function') {
        band.playKillCamShatter(48);
      }

      const holdMs = fxMs(holdDurationMs);
      const relMs = fxMs(SLOWMO_RELEASE_MS);

      // Unlock tap & keyboard skip cleanly after accidental-tap guard (250 ms)
      timers.current.push(setTimeout(() => setCanSkip(true), fxMs(SLOWMO_SKIP_GUARD_MS)));
      timers.current.push(setTimeout(() => setShowSkipHint(true), fxMs(SLOWMO_SKIP_HINT_MS)));

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

      // 3b. [FX-08] Boss KO elevation: crossed secondary golden slash (+16 deg at +72 ms)
      if (effectiveBoss && knockedOut) {
        slash2Scale.value = 0.08;
        slash2Scale.value = withDelay(fxMs(72), withTiming(1, { duration: fxMs(MS.feedback), easing: EASE.enter }));
        slash2Op.value = withDelay(
          fxMs(72),
          withSequence(
            withTiming(1, { duration: fxMs(48), easing: EASE.ui }),
            withDelay(fxMs(240), withTiming(0, { duration: fxMs(260), easing: EASE.exitSoft }))
          )
        );
      } else {
        slash2Op.value = 0;
      }

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
          setCanSkip(false);
          setShowSkipHint(false);
          setActiveKey(cur => (cur === triggerKey ? null : cur));
        }, holdMs + relMs)
      );
    };

    if (waitingForLand) {
      // [FX-23] Safety fallback if a lethal blow has no flying beat
      timers.current.push(setTimeout(start, fxMs(impactDelayMs + 150)));
    } else if (triggerNow === undefined && ignition?.lethal && fxMs(impactDelayMs) > 0) {
      timers.current.push(setTimeout(start, fxMs(impactDelayMs)));
    } else {
      start();
    }

    return () => {
      clearAllTimers();
    };
  }, [triggerKey, triggerNow]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    clearAllTimers();
    cancelAllAnims();
  }, [clearAllTimers, cancelAllAnims]);

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
  const slash2Style = useAnimatedStyle(() => ({
    opacity: slash2Op.value,
    transform: [{ rotate: '16deg' }, { scaleX: slash2Scale.value }],
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

  const shards = effectiveBoss ? [...CHROMA_SHARDS, ...BOSS_EXTRA_SHARDS] : CHROMA_SHARDS;
  const slashLen = Math.round(220 * distScale);
  const slashCoreLen = Math.round(190 * distScale);

  return (
    <Pressable
      testID="kill-cam-overlay"
      pointerEvents={canSkip ? 'auto' : 'none'}
      onPress={handleSkip}
      accessibilityRole={canSkip ? 'button' : undefined}
      accessibilityLabel={canSkip ? 'Tap to continue to victory results' : undefined}
      style={st.root}
    >
      {/* Clair-Obscur monochrome painterly slow-mo grade (full cinema only) */}
      {isFullCinema && <Animated.View style={[st.noirWash, WEB_NOIR_STYLE, noirStyle]} />}

      {/* Cinematic ink + brushed-gold letterbox framing (full cinema only) */}
      {isFullCinema && (
        <>
          <Animated.View style={[st.letterboxTop, topBarStyle]} />
          <Animated.View style={[st.letterboxBottom, botBarStyle]} />
        </>
      )}

      {/* Chiaroscuro luminous golden slash across the defeated foe (knockouts only) */}
      {!isQuiet && showSlash && (
        <Animated.View
          testID="kill-cam-slash-1"
          pointerEvents="none"
          style={[
            st.slashWrap,
            { width: slashLen, left: origin.x - slashLen / 2, top: origin.y - 4 },
            slashStyle,
          ]}
        >
          <View style={[st.slashOuter, { width: slashLen }]}>
            <View style={[st.slashCore, { width: slashCoreLen }]} />
          </View>
        </Animated.View>
      )}

      {/* [FX-08] Boss KO elevation: secondary crossed golden chiaroscuro slash */}
      {isFullCinema && showSlash && effectiveBoss && (
        <Animated.View
          testID="kill-cam-boss-slash-2"
          pointerEvents="none"
          style={[
            st.slashWrap,
            { width: slashLen, left: origin.x - slashLen / 2, top: origin.y - 4 },
            slash2Style,
          ]}
        >
          <View style={[st.slashOuter, st.slashOuterBoss, { width: slashLen }]}>
            <View style={[st.slashCore, { width: slashCoreLen }]} />
          </View>
        </Animated.View>
      )}

      {/* Slow-motion suspended golden chroma diamond petals (full cinema only; Boss gets 20 total) */}
      {isFullCinema &&
        shards.map((shard, idx) => (
          <ChromaShard
            key={`${activeKey}-${idx}`}
            originX={origin.x}
            originY={origin.y}
            deg={shard.deg}
            dist={Math.round(shard.dist * distScale)}
            lift={Math.round(shard.lift * distScale)}
            size={shard.size}
            color={shard.color}
            delay={shard.delay}
            spin={shard.spin}
            holdMs={holdDurationMs}
          />
        ))}

      {/* Single undisputed ceremonial Victory banner in open mid-board space */}
      <View pointerEvents="none" style={st.bannerCenter}>
        <Animated.View style={[st.goldRule, ruleStyle]} />
        <Animated.View style={[st.banner, isBriskCinema && st.bannerBrisk, bannerStyle]}>
          <Text testID="kill-cam-eyebrow" style={st.eyebrowText} numberOfLines={1}>
            {eyebrow}
          </Text>
          <Text
            testID="kill-cam-headline"
            style={[st.bannerText, (headline.length > 15 || isBriskCinema) && st.bannerTextCompact]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {headline}
          </Text>
        </Animated.View>
        <Animated.View style={[st.goldRule, ruleStyle]} />
      </View>

      {/* Subtle tap-to-skip whisper after 350 ms on full KillCam */}
      {isFullCinema && canSkip && showSkipHint && (
        <View testID="kill-cam-skip-hint" pointerEvents="none" style={st.skipHint}>
          <Text style={st.skipHintText}>Tap to continue</Text>
        </View>
      )}
    </Pressable>
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
  slashOuterBoss: {
    backgroundColor: '#FFE84D',
    borderColor: '#991B1B',
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
  bannerBrisk: {
    paddingHorizontal: 16,
    paddingVertical: 7,
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
  bannerTextCompact: {
    fontSize: 21,
    letterSpacing: 1.4,
  },
  shardWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  skipHint: {
    position: 'absolute',
    right: 14,
    bottom: LETTERBOX_H + 10,
    backgroundColor: 'rgba(16, 14, 13, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(245, 184, 0, 0.65)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  skipHintText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#F5F0E8',
    letterSpacing: 0.4,
  },
});

export default KillCamOverlay;
