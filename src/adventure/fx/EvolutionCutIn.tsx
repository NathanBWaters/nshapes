/**
 * Single-Weapon Evolution Awakening Cut-In:
 *
 * Plays the first time a player awakens a given per-weapon timed evolution
 * (repeat awakenings use the non-blocking `EvolutionBanner` in `RunFx.tsx`).
 *
 * 3-beat choreography:
 *   Beat 1 (`0–110ms`): ChiaroscuroFlash + diagonal slash + slanted comic band
 *     + owning `WeaponAvatar` slam (`SCALE.slam` 1.5 -> 1.0, `EASE.impact`).
 *   Beat 2 (`110–360ms`): 56px golden Evolution Medallion (`SPRING.lively`),
 *     `"EVOLUTION AWAKENED!"` eyebrow, bold evolution name, trigger condition
 *     chip, `<Xs> ACTIVE` chip, universal chassis chips (`+8 BASE`, `+0.2×`),
 *     and 1-sentence effect card.
 *   Beat 3: Always skippable on tap after `220ms` guard; steps cleanly through
 *     a queue when multiple weapons awaken on the same Set.
 *
 * Strictly GPU-composited (`opacity`/`transform` only in all animated styles)
 * with `useAppActive()` gating and `cancelAnimation` cleanup.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Icon from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import { useAppActive } from '@/hooks/useAppActive';
import type { Weapon } from '@/types';
import { useColorblind } from '@/utils/cardColors';
import { COLORS } from '@/utils/colors';
import { ACCESSIBLE, EASE, MS, OVERLAP, SCALE, SPRING, STAGGER, STAYS } from '@/utils/motion';
import { band } from '@/audio';
import { evolutionConditionShort } from '../data/evolutions';
import { EVOLUTION_CHASSIS } from '../engine/sources';
import type { WeaponEvolutionDef } from '../types';
import { ChiaroscuroFlash } from '../components/RunFx';
import { DARK } from '../components/ui';
import { fxMs } from './clock';

const INK = COLORS.slateCharcoal;
/** The cut rises to the right by this much */
const SLANT_DEG = -9;
/** Always skippable on tap after 220ms so the Set-completing tap cannot dismiss it accidentally */
export const EVOLUTION_CUTIN_GUARD_MS = 220;
const CLOSE_MS = 110;
const SWAP_OUT_MS = 96;
const BAND_OPEN_DELAY_MS = 96;
const BAND_CLOSE_LAG_MS = 32;
const PROMPT_REVEAL_MS = 320;

const SPEED_LINES = [
  { top: '12%', width: 220, ms: 580, delay: 0 },
  { top: '34%', width: 150, ms: 710, delay: 140 },
  { top: '58%', width: 270, ms: 830, delay: 290 },
  { top: '80%', width: 180, ms: 970, delay: 440 },
] as const;

const SpeedLine: React.FC<{ span: number; top: `${number}%`; width: number; ms: number; delay: number }> = ({
  span,
  top,
  width,
  ms,
  delay,
}) => {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const x = useSharedValue(0);
  useEffect(() => {
    if (!appActive || reducedMotion) {
      cancelAnimation(x);
      return;
    }
    x.value = 0;
    x.value = withDelay(fxMs(delay), withRepeat(withTiming(1, { duration: fxMs(ms), easing: EASE.linear }), -1));
    return () => cancelAnimation(x);
  }, [appActive, reducedMotion, x, ms, delay]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: span - (span + width) * x.value }] }));
  if (reducedMotion) return null;
  return <Animated.View style={[st.speed, { top, width }, style]} />;
};

export interface EvolutionCutInEntry {
  /** Per-weapon evolution definition */
  evolution: WeaponEvolutionDef;
  /** Optional owning weapon (auto-resolved from `weapons` prop if omitted) */
  weapon?: Weapon;
  /** Displayed active duration in seconds (defaults to `Math.round(evolution.durationMs / 1000)`) */
  durationSec?: number;
}

export interface EvolutionCutInProps {
  /** Queue of 1+ single-weapon evolutions that just awakened */
  evolutions: readonly EvolutionCutInEntry[];
  /** Held weapons fallback lookup when entries omit `weapon` */
  weapons?: readonly Weapon[];
  /** Fallback duration (seconds) if an entry omits `durationSec` */
  seconds?: number;
  size: { w: number; h: number };
  onDone: () => void;
  /** Auto-advance / close after this long (dev auto-player) */
  autoDismissMs?: number;
  /** Optional extra onboarding line under the effect card */
  hint?: string;
}

const AwakeningCard: React.FC<{
  entry: EvolutionCutInEntry;
  weapon?: Weapon;
  durationSec: number;
  queuePos: number;
  queueTotal: number;
  appActive: boolean;
  reducedMotion: boolean;
  colorblind: boolean;
  contentOut: SharedValue<number>;
  hint?: string;
}> = ({
  entry,
  weapon,
  durationSec,
  queuePos,
  queueTotal,
  appActive,
  reducedMotion,
  colorblind,
  contentOut,
  hint,
}) => {
  const { evolution } = entry;
  const swapIn = queuePos > 0 && !reducedMotion;
  const cardOp = useSharedValue(swapIn ? 0 : 1);
  const cardY = useSharedValue(swapIn ? 14 : 0);
  const cardScale = useSharedValue(swapIn ? 0.96 : 1);
  const weaponScale = useSharedValue(reducedMotion ? 1 : SCALE.slam);
  const weaponOp = useSharedValue(reducedMotion ? 1 : 0);
  const medalScale = useSharedValue(reducedMotion ? 1 : 0.45);
  const medalOp = useSharedValue(reducedMotion ? 1 : 0);
  const medalGlow = useSharedValue(1);
  const headP = useSharedValue(reducedMotion ? 1 : 0);
  const bodyP = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      cardOp.value = 1;
      cardY.value = 0;
      cardScale.value = 1;
      weaponScale.value = 1;
      weaponOp.value = 1;
      medalScale.value = 1;
      medalOp.value = 1;
      headP.value = 1;
      bodyP.value = 1;
      return;
    }
    if (queuePos > 0) {
      cardOp.value = 0;
      cardY.value = 14;
      cardScale.value = 0.96;
      cardOp.value = withDelay(fxMs(24), withTiming(1, { duration: fxMs(MS.quick), easing: EASE.enter }));
      cardY.value = withDelay(fxMs(24), withTiming(0, { duration: fxMs(MS.quick), easing: EASE.enter }));
      cardScale.value = withDelay(fxMs(24), withTiming(1, { duration: fxMs(MS.quick), easing: EASE.enter }));
    } else {
      cardOp.value = 1;
      cardY.value = 0;
      cardScale.value = 1;
    }
    const baseDelay = queuePos === 0 ? BAND_OPEN_DELAY_MS + OVERLAP.uiContentMs : 28;
    // Beat 1: WeaponAvatar slam (SCALE.slam 1.5 -> 1.0, EASE.impact)
    weaponOp.value = 0;
    weaponScale.value = SCALE.slam;
    weaponOp.value = withDelay(fxMs(baseDelay), withTiming(1, { duration: fxMs(MS.feedback), easing: EASE.enter }));
    weaponScale.value = withDelay(fxMs(baseDelay), withTiming(1, { duration: fxMs(MS.quick), easing: EASE.impact }));

    // Beat 2: 56px Evolution Medallion lively pop + staggered title & effect card
    const medalDelay = baseDelay + 70;
    medalOp.value = 0;
    medalScale.value = 0.45;
    medalOp.value = withDelay(fxMs(medalDelay), withTiming(1, { duration: fxMs(MS.feedback), easing: EASE.ui }));
    medalScale.value = withDelay(fxMs(medalDelay), withSpring(1, SPRING.lively));

    headP.value = 0;
    bodyP.value = 0;
    headP.value = withDelay(
      fxMs(medalDelay + STAGGER.card),
      withTiming(1, { duration: fxMs(MS.move - 40), easing: EASE.enterSoft })
    );
    bodyP.value = withDelay(
      fxMs(medalDelay + STAGGER.card * 2),
      withTiming(1, { duration: fxMs(MS.move - 40), easing: EASE.enterSoft })
    );

    return () => {
      cancelAnimation(cardOp);
      cancelAnimation(cardY);
      cancelAnimation(cardScale);
      cancelAnimation(weaponScale);
      cancelAnimation(weaponOp);
      cancelAnimation(medalScale);
      cancelAnimation(medalOp);
      cancelAnimation(headP);
      cancelAnimation(bodyP);
    };
  }, [evolution.id, queuePos, reducedMotion, cardOp, cardY, cardScale, weaponScale, weaponOp, medalScale, medalOp, headP, bodyP]);

  // Subtle moving hold on the golden medallion while waiting for tap
  useEffect(() => {
    if (!appActive || reducedMotion) {
      cancelAnimation(medalGlow);
      medalGlow.value = 1;
      return;
    }
    const settleDelay = (queuePos === 0 ? BAND_OPEN_DELAY_MS + OVERLAP.uiContentMs : 24) + MS.quick + 120;
    medalGlow.value = 1;
    medalGlow.value = withDelay(
      fxMs(settleDelay),
      withRepeat(withTiming(1.05, { duration: MS.hero, easing: EASE.drift }), -1, true)
    );
    return () => cancelAnimation(medalGlow);
  }, [appActive, reducedMotion, evolution.id, queuePos, medalGlow]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOp.value,
    transform: [{ translateY: cardY.value }, { scale: cardScale.value }],
  }));

  const weaponStyle = useAnimatedStyle(() => ({
    opacity: weaponOp.value * (1 - contentOut.value),
    transform: [{ scale: weaponScale.value }],
  }));

  const medalStyle = useAnimatedStyle(() => ({
    opacity: medalOp.value * (1 - contentOut.value),
    transform: [{ scale: medalScale.value * medalGlow.value }],
  }));

  const headStyle = useAnimatedStyle(() => ({
    opacity: headP.value * (1 - contentOut.value),
    transform: [{ translateX: reducedMotion ? 0 : (1 - headP.value) * -26 }],
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyP.value * (1 - contentOut.value),
    transform: [{ translateY: reducedMotion ? 0 : (1 - bodyP.value) * 8 }],
  }));

  const condShort = evolutionConditionShort(evolution, colorblind);

  return (
    <Animated.View style={[st.row, cardStyle]} testID="evolution-banner">
      <View style={st.head}>
        <View style={st.emblemCluster}>
          {weapon && (
            <Animated.View style={[st.weaponSlamBadge, weaponStyle]} testID="evolution-cutin-weapon">
              <WeaponAvatar weapon={weapon} size={46} interactive={false} />
            </Animated.View>
          )}
          <Animated.View
            style={[st.medal, weapon && st.medalOverlap, medalStyle]}
            testID="evolution-cutin-medallion"
          >
            <Icon name={evolution.icon} size={32} color={INK} />
          </Animated.View>
        </View>
        <Animated.View style={[{ flex: 1 }, headStyle]}>
          <View style={st.eyebrowRow}>
            <Icon name="lorc/crystal-shine" size={12} color={COLORS.actionYellow} noShadow />
            <Text style={st.eyebrow} numberOfLines={1}>EVOLUTION AWAKENED!</Text>
            {queueTotal > 1 && (
              <View style={st.queuePill} testID="evolution-cutin-queue">
                <Text style={st.queuePillText}>{queuePos + 1}/{queueTotal}</Text>
              </View>
            )}
          </View>
          <Text style={st.name} numberOfLines={2} adjustsFontSizeToFit>{evolution.name}</Text>
          {weapon && (
            <Text style={st.weaponLabel} numberOfLines={1}>{weapon.name}</Text>
          )}
        </Animated.View>
      </View>

      <Animated.View style={[st.bodyGroup, bodyStyle]}>
        <View style={st.chips}>
          <View style={[st.chip, st.chipTrigger]}>
            <Icon name="lorc/archery-target" size={11} color="#0F766E" noShadow />
            <Text style={[st.chipText, st.chipTriggerText]} numberOfLines={1}>{condShort}</Text>
          </View>
          <View style={[st.chip, st.chipActive]}>
            <Icon name="lorc/stopwatch" size={11} color={INK} noShadow />
            <Text style={st.chipText} numberOfLines={1}>{durationSec}s ACTIVE</Text>
          </View>
          <View style={[st.chip, st.chipChassis]}>
            <Text style={st.chipText} numberOfLines={1}>+{EVOLUTION_CHASSIS.setFlatDamage} BASE</Text>
          </View>
          <View style={[st.chip, st.chipChassis]}>
            <Text style={st.chipText} numberOfLines={1}>+{EVOLUTION_CHASSIS.setAdditiveMult}× MULT</Text>
          </View>
        </View>
        <Text style={st.what}>{evolution.tagline}</Text>
        {hint && <Text style={st.hint}>{hint}</Text>}
      </Animated.View>
    </Animated.View>
  );
};

/** Brief GPU slide-up/scale-down fade-out ghost so queued card handoffs never abruptly pop out. */
const ExitingAwakeningCard: React.FC<{
  entry: EvolutionCutInEntry;
  weapon?: Weapon;
  durationSec: number;
  colorblind: boolean;
}> = ({ entry, weapon, durationSec, colorblind }) => {
  const { evolution } = entry;
  const op = useSharedValue(1);
  const y = useSharedValue(0);
  const s = useSharedValue(1);

  useEffect(() => {
    const dur = fxMs(SWAP_OUT_MS);
    op.value = withTiming(0, { duration: dur, easing: EASE.exitSoft });
    y.value = withTiming(-16, { duration: dur, easing: EASE.exitSoft });
    s.value = withTiming(0.94, { duration: dur, easing: EASE.exitSoft });
    return () => {
      cancelAnimation(op);
      cancelAnimation(y);
      cancelAnimation(s);
    };
  }, [op, y, s]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: y.value }, { scale: s.value }],
  }));

  const condShort = evolutionConditionShort(evolution, colorblind);

  return (
    <Animated.View
      pointerEvents="none"
      testID="evolution-cutin-exiting"
      style={[st.row, st.exitingRow, animStyle]}
    >
      <View style={st.head}>
        <View style={st.emblemCluster}>
          {weapon && (
            <View style={st.weaponSlamBadge}>
              <WeaponAvatar weapon={weapon} size={46} interactive={false} />
            </View>
          )}
          <View style={[st.medal, weapon && st.medalOverlap]}>
            <Icon name={evolution.icon} size={32} color={INK} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <View style={st.eyebrowRow}>
            <Icon name="lorc/crystal-shine" size={12} color={COLORS.actionYellow} noShadow />
            <Text style={st.eyebrow} numberOfLines={1}>EVOLUTION AWAKENED!</Text>
          </View>
          <Text style={st.name} numberOfLines={2} adjustsFontSizeToFit>{evolution.name}</Text>
          {weapon && <Text style={st.weaponLabel} numberOfLines={1}>{weapon.name}</Text>}
        </View>
      </View>
      <View style={st.bodyGroup}>
        <View style={st.chips}>
          <View style={[st.chip, st.chipTrigger]}>
            <Icon name="lorc/archery-target" size={11} color="#0F766E" noShadow />
            <Text style={[st.chipText, st.chipTriggerText]} numberOfLines={1}>{condShort}</Text>
          </View>
          <View style={[st.chip, st.chipActive]}>
            <Icon name="lorc/stopwatch" size={11} color={INK} noShadow />
            <Text style={st.chipText} numberOfLines={1}>{durationSec}s ACTIVE</Text>
          </View>
        </View>
        <Text style={st.what}>{evolution.tagline}</Text>
      </View>
    </Animated.View>
  );
};

export const EvolutionCutIn: React.FC<EvolutionCutInProps> = ({
  evolutions,
  weapons = [],
  seconds,
  size,
  onDone,
  autoDismissMs,
  hint,
}) => {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const colorblind = useColorblind();

  const [activeIdx, setActiveIdx] = useState(0);
  const [exitingSwap, setExitingSwap] = useState<{
    key: number;
    entry: EvolutionCutInEntry;
    weapon?: Weapon;
    durationSec: number;
  } | null>(null);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clampedIdx = Math.min(activeIdx, Math.max(0, evolutions.length - 1));
  const current = evolutions[clampedIdx];
  const currentWeapon = current
    ? (current.weapon ?? weapons.find(w => w.id === current.evolution.weaponId))
    : undefined;
  const currentDurationSec = current
    ? (current.durationSec ?? seconds ?? Math.max(1, Math.round(current.evolution.durationMs / 1000)))
    : (seconds ?? 18);

  const slash = useSharedValue(reducedMotion ? 1 : 0);
  const open = useSharedValue(reducedMotion ? 1 : 0);
  const reducedIn = useSharedValue(reducedMotion ? 0 : 1);
  const contentOut = useSharedValue(0);
  const prompt = useSharedValue(0);
  const out = useSharedValue(0);
  const born = useRef(Date.now());
  const closing = useRef(false);
  const finishedRef = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishClose = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (fallbackTimer.current) {
      clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
    done.current();
  }, []);

  useEffect(() => {
    if (evolutions.length === 0) {
      finishClose();
      return;
    }
    if (reducedMotion) {
      slash.value = 1;
      open.value = 1;
      reducedIn.value = withTiming(1, { duration: fxMs(ACCESSIBLE.fadeMs), easing: EASE.ui, ...STAYS });
      return () => cancelAnimation(reducedIn);
    }
    reducedIn.value = 1;
    slash.value = withTiming(1, { duration: fxMs(110), easing: EASE.enter });
    open.value = withDelay(fxMs(BAND_OPEN_DELAY_MS), withTiming(1, { duration: fxMs(220), easing: EASE.pop }));
    return () => {
      cancelAnimation(slash);
      cancelAnimation(open);
      cancelAnimation(reducedIn);
      cancelAnimation(contentOut);
      cancelAnimation(out);
    };
  }, [evolutions.length, reducedMotion, slash, open, reducedIn, contentOut, out, finishClose]);

  // [AU-13] Sync weapon-anchored evolution motif to mount / queue advance
  const currentEvoId = current?.evolution.id;
  useEffect(() => {
    if (!currentEvoId) return;
    const b = band as typeof band & {
      playCutInEvolve?: (id: string, opts?: { immediate?: boolean; leadMs?: number }) => void;
    };
    if (typeof b?.playCutInEvolve === 'function') {
      b.playCutInEvolve(currentEvoId, { immediate: true, leadMs: reducedMotion ? 0 : 90 });
    } else if (typeof band?.evolve === 'function' && !band.inFight) {
      band.evolve(currentEvoId);
    }
  }, [currentEvoId, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(prompt);
      prompt.value = withTiming(1, { duration: fxMs(ACCESSIBLE.fadeMs), easing: EASE.ui, ...STAYS });
      return () => cancelAnimation(prompt);
    }
    if (!appActive) {
      cancelAnimation(prompt);
      prompt.value = 0.75;
      return;
    }
    prompt.value = 0;
    prompt.value = withDelay(
      fxMs(PROMPT_REVEAL_MS),
      withSequence(
        withTiming(1, { duration: fxMs(MS.quick), easing: EASE.ui }),
        withRepeat(withTiming(0.42, { duration: 640, easing: EASE.drift }), -1, true)
      )
    );
    return () => cancelAnimation(prompt);
  }, [appActive, reducedMotion, prompt]);

  const handleTap = useCallback(() => {
    if (closing.current || Date.now() - born.current < fxMs(EVOLUTION_CUTIN_GUARD_MS)) return;

    // Queue step: cross-transition out the outgoing card smoothly while incoming card enters
    if (clampedIdx < evolutions.length - 1) {
      born.current = Date.now();
      if (!reducedMotion && current) {
        if (swapTimer.current) clearTimeout(swapTimer.current);
        setExitingSwap({
          key: clampedIdx,
          entry: current,
          weapon: currentWeapon,
          durationSec: currentDurationSec,
        });
        swapTimer.current = setTimeout(() => {
          swapTimer.current = null;
          setExitingSwap(null);
        }, fxMs(SWAP_OUT_MS) + 20);
      }
      setActiveIdx(i => Math.min(evolutions.length - 1, i + 1));
      return;
    }

    closing.current = true;
    if (open.value < 1) open.value = 1;
    const closeDuration = fxMs(CLOSE_MS);

    if (reducedMotion) {
      contentOut.value = withTiming(1, { duration: closeDuration, easing: EASE.exitSoft, ...STAYS });
      out.value = withTiming(
        1,
        { duration: closeDuration, easing: EASE.exitSoft, ...STAYS },
        finished => {
          'worklet';
          if (finished) runOnJS(finishClose)();
        }
      );
    } else {
      const contentLeadMs = fxMs(OVERLAP.exitContentLeadMs + 16);
      const bandDelayMs = fxMs(BAND_CLOSE_LAG_MS);
      const bandCloseMs = Math.max(16, closeDuration - bandDelayMs);
      contentOut.value = withTiming(1, { duration: contentLeadMs, easing: EASE.exitSoft, ...STAYS });
      out.value = withDelay(
        bandDelayMs,
        withTiming(
          1,
          { duration: bandCloseMs, easing: EASE.exitSoft, ...STAYS },
          finished => {
            'worklet';
            if (finished) runOnJS(finishClose)();
          }
        ),
        STAYS.reduceMotion
      );
    }

    fallbackTimer.current = setTimeout(finishClose, closeDuration + 4);
  }, [clampedIdx, evolutions.length, current, currentWeapon, currentDurationSec, open, contentOut, out, reducedMotion, finishClose]);

  useEffect(() => () => {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    if (swapTimer.current) clearTimeout(swapTimer.current);
  }, []);

  useEffect(() => {
    if (!autoDismissMs) return;
    const t = setTimeout(handleTap, autoDismissMs);
    return () => clearTimeout(t);
  }, [autoDismissMs, clampedIdx, handleTap]);

  const span = Math.ceil(Math.hypot(size.w, size.h) * 1.1);
  const contentWidth = Math.min(size.w - 28, 480);

  const dimStyle = useAnimatedStyle(() => ({
    opacity: 0.66 * Math.min(1, slash.value * 2) * reducedIn.value * (1 - out.value),
  }));
  const slashStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 0 : 1 - open.value,
    transform: [{ scaleX: slash.value }],
  }));
  const bandStyle = useAnimatedStyle(() => ({
    opacity: (open.value > 0 ? 1 : 0) * reducedIn.value * (reducedMotion ? 1 - out.value : 1),
    transform: [{ scaleY: reducedMotion ? 1 : Math.max(0.001, open.value * (1 - out.value)) }],
  }));
  const promptStyle = useAnimatedStyle(() => ({
    opacity: prompt.value * (1 - contentOut.value),
  }));

  if (!current) return null;

  const hasMore = clampedIdx < evolutions.length - 1;

  return (
    <Pressable
      style={st.root}
      onPress={handleTap}
      accessibilityRole="button"
      accessibilityLabel={`Evolution awakened: ${current.evolution.name}. ${hasMore ? 'Tap for next evolution.' : 'Tap to continue.'}`}
      testID="evolution-cutin"
    >
      <Animated.View style={[StyleSheet.absoluteFill, st.dim, dimStyle]} />
      <View
        style={[st.slanted, { width: span, height: span, left: (size.w - span) / 2, top: (size.h - span) / 2 }]}
        pointerEvents="none"
      >
        <Animated.View style={[st.band, bandStyle]}>
          {SPEED_LINES.map((l, i) => (
            <SpeedLine key={i} span={span} {...l} />
          ))}
          <View style={{ width: contentWidth, position: 'relative' }}>
            {exitingSwap && (
              <ExitingAwakeningCard
                key={`exit-${exitingSwap.key}`}
                entry={exitingSwap.entry}
                weapon={exitingSwap.weapon}
                durationSec={exitingSwap.durationSec}
                colorblind={colorblind}
              />
            )}
            <AwakeningCard
              key={current.evolution.id}
              entry={current}
              weapon={currentWeapon}
              durationSec={currentDurationSec}
              queuePos={clampedIdx}
              queueTotal={evolutions.length}
              appActive={appActive}
              reducedMotion={reducedMotion}
              colorblind={colorblind}
              contentOut={contentOut}
              hint={clampedIdx === 0 ? hint : undefined}
            />
          </View>
        </Animated.View>
        <Animated.View style={[st.slash, slashStyle]} />
      </View>
      {/* [FX-17]: 112 ms chiaroscuro perimeter flash synced to 90 ms slash-riser peak */}
      <ChiaroscuroFlash trigger={clampedIdx + 1} delayMs={90} stageW={size.w} testID="evolution-cutin-flash" />
      <Animated.View style={[st.prompt, promptStyle]} pointerEvents="none">
        <Text style={st.promptText}>
          {hasMore ? `TAP FOR NEXT (${clampedIdx + 2}/${evolutions.length})` : 'TAP TO CONTINUE'}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

const st = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 500, overflow: 'hidden' },
  dim: { backgroundColor: COLORS.deepOnyx },
  slanted: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: `${SLANT_DEG}deg` }],
  },
  slash: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: COLORS.actionYellow,
    transformOrigin: 'left center',
  },
  band: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: DARK.panel,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderColor: COLORS.actionYellow,
    paddingVertical: 18,
    overflow: 'hidden',
  },
  speed: { position: 'absolute', left: 0, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.14)' },
  row: { gap: 12 },
  exitingRow: { position: 'absolute', left: 0, right: 0, top: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emblemCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weaponSlamBadge: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: COLORS.paperBeige,
    borderWidth: 2.5,
    borderColor: COLORS.canvasWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medal: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.actionYellow,
    borderWidth: 3,
    borderColor: COLORS.canvasWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalOverlap: {
    marginLeft: -14,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  eyebrow: {
    flexShrink: 1,
    color: COLORS.actionYellow,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 2.6,
  },
  queuePill: {
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  queuePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  name: {
    color: COLORS.canvasWhite,
    fontWeight: '900',
    fontSize: 26,
    lineHeight: 29,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  weaponLabel: {
    color: DARK.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  bodyGroup: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
  },
  chipTrigger: {
    backgroundColor: '#CCFBF1',
  },
  chipTriggerText: {
    color: '#0F766E',
  },
  chipActive: {
    backgroundColor: COLORS.actionYellow,
  },
  chipChassis: {
    backgroundColor: COLORS.canvasWhite,
  },
  chipText: {
    flexShrink: 1,
    color: INK,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  what: { color: DARK.text, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  hint: { color: DARK.muted, fontSize: 13, lineHeight: 18 },
  prompt: { position: 'absolute', left: 0, right: 0, bottom: 28, alignItems: 'center' },
  promptText: {
    color: COLORS.actionYellow,
    backgroundColor: DARK.panel,
    fontWeight: '900',
    letterSpacing: 3,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
