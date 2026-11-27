/**
 * The evolution cut-in: a blade crosses the screen, rising to the right, and
 * the cut opens into a slanted band that says what just started: the
 * evolution's icon and name, the two weapons that fused, what it does and
 * what every evolution gives. The fight waits until the player taps.
 *
 * Several evolutions that start at once share one cut, one row each.
 *
 * [FX-17] Uses `ChiaroscuroFlash` (gated on `ScreenFlashStorage` & `useReducedMotion()`)
 * instead of a pure-white full-screen washout, while preserving Wave 3's [OB-08] 200 ms
 * tap guard and [AU-13] mount audio call.
 *
 * Lane 3 polish:
 * - Tokenized `motion.ts` curves (`EASE.enter`, `EASE.pop`, `EASE.popSoft`, `EASE.enterSoft`,
 *   `EASE.drift`, `EASE.exitSoft`, `OVERLAP`, `STAGGER`, `STAYS`).
 * - Staggered internal `RecipeRow` reveal (medal → title/fused → body/chips) + per-row stagger.
 * - Symmetric `EASE.drift` breathing on the `TAP TO CONTINUE` prompt (`reverse: true`).
 * - Content-lead, callback-driven exit via `runOnJS` (content clears before band collapses,
 *   zero text squash, zero timer drift).
 */
import React, { useCallback, useEffect, useRef } from 'react';
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
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Icon from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import { useAppActive } from '@/hooks/useAppActive';
import type { Weapon } from '@/types';
import { COLORS } from '@/utils/colors';
import { ACCESSIBLE, EASE, MS, OVERLAP, STAGGER, STAYS } from '@/utils/motion';
import { band } from '@/audio';
import type { EvolutionRecipe } from '../types';
import { fxMs } from './clock';
import { EVOLUTION_RULES, inFamily } from '../engine/sources';
import { ChiaroscuroFlash } from '../components/RunFx';
import { DARK } from '../components/ui';

const INK = COLORS.slateCharcoal;
/** The cut rises to the right by this much */
const SLANT_DEG = -9;
/** Taps before this are ignored, so the tap that made the Set cannot close it ([OB-08]: tightened to 200ms) */
const GUARD_MS = 200;
const CLOSE_MS = 110;
const BAND_OPEN_DELAY_MS = 96;
const BAND_CLOSE_LAG_MS = 32;
/** Reveal the TAP TO CONTINUE prompt briskly once the band opens ([OB-08]: 320ms) */
const PROMPT_REVEAL_MS = 320;

const SPEED_LINES = [
  { top: '12%', width: 220, ms: 580, delay: 0 },
  { top: '34%', width: 150, ms: 710, delay: 140 },
  { top: '58%', width: 270, ms: 830, delay: 290 },
  { top: '80%', width: 180, ms: 970, delay: 440 },
] as const;

const SpeedLine: React.FC<{ span: number; top: `${number}%`; width: number; ms: number; delay: number }> = ({ span, top, width, ms, delay }) => {
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

/** The first held weapon of each of the recipe's two families: the pair that fused. */
const fusedWeapons = (recipe: EvolutionRecipe, held: readonly Weapon[]): Weapon[] =>
  recipe.families.map(family => held.find(w => inFamily(w.id, family))).filter((w): w is Weapon => !!w);

const RecipeRow: React.FC<{
  recipe: EvolutionRecipe;
  weapons: readonly Weapon[];
  seconds: number;
  index: number;
  appActive: boolean;
  reducedMotion: boolean;
  contentOut: SharedValue<number>;
  hint?: string;
}> = ({ recipe, weapons, seconds, index, appActive, reducedMotion, contentOut, hint }) => {
  const fused = fusedWeapons(recipe, weapons);
  const medalP = useSharedValue(reducedMotion ? 1 : 0);
  const medalGlow = useSharedValue(1);
  const headP = useSharedValue(reducedMotion ? 1 : 0);
  const bodyP = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      medalP.value = 1;
      headP.value = 1;
      bodyP.value = 1;
      return;
    }
    const baseDelay = BAND_OPEN_DELAY_MS + OVERLAP.uiContentMs + index * STAGGER.item;
    medalP.value = withDelay(fxMs(baseDelay), withTiming(1, { duration: fxMs(MS.quick), easing: EASE.popSoft }));
    headP.value = withDelay(fxMs(baseDelay + STAGGER.card), withTiming(1, { duration: fxMs(MS.move - 40), easing: EASE.enterSoft }));
    bodyP.value = withDelay(fxMs(baseDelay + STAGGER.card * 2), withTiming(1, { duration: fxMs(MS.move - 40), easing: EASE.enterSoft }));
    return () => {
      cancelAnimation(medalP);
      cancelAnimation(headP);
      cancelAnimation(bodyP);
    };
  }, [index, reducedMotion, medalP, headP, bodyP]);

  // Subtle Disney #12 moving hold on the golden medal while awaiting player tap (zero static dead-stretch)
  useEffect(() => {
    if (!appActive || reducedMotion) {
      cancelAnimation(medalGlow);
      medalGlow.value = 1;
      return;
    }
    const settleDelay = BAND_OPEN_DELAY_MS + OVERLAP.uiContentMs + index * STAGGER.item + MS.quick;
    medalGlow.value = withDelay(
      fxMs(settleDelay),
      withRepeat(withTiming(1.045, { duration: 720, easing: EASE.drift }), -1, true)
    );
    return () => cancelAnimation(medalGlow);
  }, [appActive, reducedMotion, index, medalGlow]);

  const medalStyle = useAnimatedStyle(() => {
    const outMul = 1 - contentOut.value;
    return {
      opacity: Math.min(1, medalP.value * 1.4) * outMul,
      transform: [{ scale: (reducedMotion ? 1 : 0.72 + 0.28 * medalP.value) * medalGlow.value }],
    };
  });

  const headStyle = useAnimatedStyle(() => {
    const outMul = 1 - contentOut.value;
    return {
      opacity: headP.value * outMul,
      transform: [{ translateX: reducedMotion ? 0 : (1 - headP.value) * -28 }],
    };
  });

  const bodyStyle = useAnimatedStyle(() => {
    const outMul = 1 - contentOut.value;
    return {
      opacity: bodyP.value * outMul,
      transform: [{ translateY: reducedMotion ? 0 : (1 - bodyP.value) * 8 }],
    };
  });

  return (
    <View style={[st.row, index > 0 && st.rowNext]} testID="evolution-banner">
      <View style={st.head}>
        <Animated.View style={[st.medal, medalStyle]}>
          <Icon name={recipe.icon} size={38} color={INK} />
        </Animated.View>
        <Animated.View style={[{ flex: 1 }, headStyle]}>
          <Text style={st.eyebrow}>EVOLUTION</Text>
          <Text style={st.name} numberOfLines={2} adjustsFontSizeToFit>{recipe.name}</Text>
          <View style={st.fused}>
            {fused.length === 2 ? (
              <>
                <WeaponAvatar weapon={fused[0]} size={20} interactive={false} />
                <Text style={st.fusedText} numberOfLines={1}>{fused[0].name}</Text>
                <Text style={st.plus}>+</Text>
                <WeaponAvatar weapon={fused[1]} size={20} interactive={false} />
                <Text style={st.fusedText} numberOfLines={1}>{fused[1].name}</Text>
              </>
            ) : (
              <Text style={st.fusedText} numberOfLines={1}>{recipe.familyText}</Text>
            )}
          </View>
        </Animated.View>
      </View>
      <Animated.View style={[st.bodyGroup, bodyStyle]}>
        <Text style={st.what}>{recipe.activeText}</Text>
        <View style={st.chips}>
          <View style={st.chip}><Text style={st.chipText}>Sets ×{EVOLUTION_RULES.setMultiplier}</Text></View>
          <View style={st.chip}><Text style={st.chipText}>+{EVOLUTION_RULES.setDamage} every Set</Text></View>
          <View style={[st.chip, st.chipTime]}><Text style={st.chipText}>{seconds} seconds</Text></View>
        </View>
        {hint && <Text style={st.hint}>{hint}</Text>}
      </Animated.View>
    </View>
  );
};

interface Props {
  recipes: EvolutionRecipe[];
  /** Held weapons, to show the pair that fused */
  weapons: readonly Weapon[];
  /** How long the evolution lasts */
  seconds: number;
  size: { w: number; h: number };
  onDone: () => void;
  /** Close by itself after this long (the dev auto-player) */
  autoDismissMs?: number;
  /** One more line under the first row (the first evolution ever explains the ring) */
  hint?: string;
}

export const EvolutionCutIn: React.FC<Props> = ({ recipes, weapons, seconds, size, onDone, autoDismissMs, hint }) => {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const slash = useSharedValue(reducedMotion ? 1 : 0);
  const open = useSharedValue(reducedMotion ? 1 : 0);
  const reducedIn = useSharedValue(reducedMotion ? 0 : 1);
  const contentOut = useSharedValue(0);
  const prompt = useSharedValue(0);
  const out = useSharedValue(0);
  const born = useRef(Date.now());
  const closing = useRef(false);
  const finishedRef = useRef(false);
  // (kept in a ref so `close` stays the same function when the parent re-renders)
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
  }, [reducedMotion, slash, open, reducedIn, contentOut, out]);

  // [AU-13] Fire evolution fanfare synced to cut-in mount (90ms riser hits exact slash-flash frame!)
  const firstRecipeId = recipes[0]?.id;
  useEffect(() => {
    if (!firstRecipeId) return;
    const b = band as typeof band & {
      playCutInEvolve?: (id: string, opts?: { immediate?: boolean; leadMs?: number }) => void;
    };
    if (typeof b?.playCutInEvolve === 'function') {
      b.playCutInEvolve(firstRecipeId, { immediate: true, leadMs: 90 });
    } else if (typeof band?.evolve === 'function' && !band.inFight) {
      band.evolve(firstRecipeId);
    }
  }, [firstRecipeId]);

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

  const close = useCallback(() => {
    if (closing.current || Date.now() - born.current < fxMs(GUARD_MS)) return;
    closing.current = true;
    // Snap band open if tapped mid-entrance before briskly clearing content then collapsing band
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
      // Content leads exit so text clears cleanly before the band collapses (zero vertical text squash)
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

    // Idempotent safety fallback for Jest fake-timer environments where mocked Reanimated skips completion callbacks
    fallbackTimer.current = setTimeout(finishClose, closeDuration + 4);
  }, [open, contentOut, out, reducedMotion, finishClose]);

  useEffect(() => () => {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
  }, []);

  useEffect(() => {
    if (!autoDismissMs) return;
    const t = setTimeout(close, autoDismissMs);
    return () => clearTimeout(t);
  }, [autoDismissMs, close]);

  // The slanted layer is a square bigger than the screen, so its corners stay covered when it turns
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

  return (
    <Pressable
      style={st.root}
      onPress={close}
      accessibilityRole="button"
      accessibilityLabel={`Evolution: ${recipes.map(r => r.name).join(' and ')}. Tap to continue.`}
      testID="evolution-cutin"
    >
      <Animated.View style={[StyleSheet.absoluteFill, st.dim, dimStyle]} />
      <View style={[st.slanted, { width: span, height: span, left: (size.w - span) / 2, top: (size.h - span) / 2 }]} pointerEvents="none">
        <Animated.View style={[st.band, bandStyle]}>
          {SPEED_LINES.map((l, i) => <SpeedLine key={i} span={span} {...l} />)}
          <View style={{ width: contentWidth }}>
            {recipes.map((r, i) => (
              <RecipeRow
                key={r.id}
                recipe={r}
                weapons={weapons}
                seconds={seconds}
                index={i}
                appActive={appActive}
                reducedMotion={reducedMotion}
                contentOut={contentOut}
                hint={i === 0 ? hint : undefined}
              />
            ))}
          </View>
        </Animated.View>
        <Animated.View style={[st.slash, slashStyle]} />
      </View>
      {/* [FX-17]: 112 ms chiaroscuro perimeter flash synced to 90 ms slash-riser peak (gated on ScreenFlashStorage & Reduced Motion) */}
      <ChiaroscuroFlash trigger={1} delayMs={90} stageW={size.w} testID="evolution-cutin-flash" />
      <Animated.View style={[st.prompt, promptStyle]} pointerEvents="none">
        <Text style={st.promptText}>TAP TO CONTINUE</Text>
      </Animated.View>
    </Pressable>
  );
};

const st = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 500, overflow: 'hidden' },
  dim: { backgroundColor: COLORS.deepOnyx },
  slanted: { position: 'absolute', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${SLANT_DEG}deg` }] },
  slash: { position: 'absolute', left: 0, right: 0, height: 6, backgroundColor: COLORS.canvasWhite, borderTopWidth: 2, borderBottomWidth: 2, borderColor: COLORS.actionYellow, transformOrigin: 'left center' },
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
  row: { gap: 10 },
  rowNext: { marginTop: 14, paddingTop: 14, borderTopWidth: 2, borderTopColor: DARK.goldEdge(0.35) },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bodyGroup: { gap: 10 },
  medal: { width: 68, height: 68, borderRadius: 34, backgroundColor: COLORS.actionYellow, borderWidth: 3, borderColor: COLORS.canvasWhite, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: COLORS.actionYellow, fontWeight: '900', fontSize: 12, letterSpacing: 4 },
  name: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 27, lineHeight: 30, textTransform: 'uppercase', letterSpacing: 0.5 },
  fused: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  fusedText: { color: DARK.muted, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  plus: { color: COLORS.actionYellow, fontSize: 14, fontWeight: '900' },
  what: { color: DARK.text, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: COLORS.actionYellow, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  chipTime: { backgroundColor: COLORS.canvasWhite },
  chipText: { color: INK, fontSize: 12, fontWeight: '900', letterSpacing: 0.3, fontVariant: ['tabular-nums'] },
  hint: { color: DARK.muted, fontSize: 13, lineHeight: 18 },
  prompt: { position: 'absolute', left: 0, right: 0, bottom: 28, alignItems: 'center' },
  promptText: { color: COLORS.actionYellow, backgroundColor: DARK.panel, fontWeight: '900', letterSpacing: 3, fontSize: 13, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, overflow: 'hidden' },
});
