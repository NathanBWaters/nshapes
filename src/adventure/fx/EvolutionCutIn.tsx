/**
 * The evolution cut-in: a blade crosses the screen, rising to the right, and
 * the cut opens into a slanted band that says what just started: the
 * evolution's icon and name, the two weapons that fused, what it does and
 * what every evolution gives. The fight waits until the player taps.
 *
 * Several evolutions that start at once share one cut, one row each.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Icon from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import type { Weapon } from '@/types';
import { COLORS } from '@/utils/colors';
import type { EvolutionRecipe } from '../types';
import { fxMs } from './clock';
import { EVOLUTION_RULES, inFamily } from '../engine/sources';
import { DARK } from '../components/ui';

const INK = COLORS.slateCharcoal;
/** The cut rises to the right by this much */
const SLANT_DEG = -9;
/** Taps before this are ignored, so the tap that made the Set cannot close it */
const GUARD_MS = 450;
const CLOSE_MS = 170;

const SPEED_LINES = [
  { top: '12%', width: 220, ms: 760, delay: 0 },
  { top: '34%', width: 120, ms: 620, delay: 180 },
  { top: '58%', width: 280, ms: 900, delay: 90 },
  { top: '80%', width: 160, ms: 700, delay: 260 },
] as const;

const SpeedLine: React.FC<{ span: number; top: `${number}%`; width: number; ms: number; delay: number }> = ({ span, top, width, ms, delay }) => {
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withDelay(delay, withRepeat(withTiming(1, { duration: ms, easing: Easing.linear }), -1));
  }, [x, ms, delay]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: span - (span + width) * x.value }] }));
  return <Animated.View style={[st.speed, { top, width }, style]} />;
};

/** The first held weapon of each of the recipe's two families: the pair that fused. */
const fusedWeapons = (recipe: EvolutionRecipe, held: readonly Weapon[]): Weapon[] =>
  recipe.families.map(family => held.find(w => inFamily(w.id, family))).filter((w): w is Weapon => !!w);

const RecipeRow: React.FC<{ recipe: EvolutionRecipe; weapons: readonly Weapon[]; seconds: number; first: boolean; hint?: string }> = ({ recipe, weapons, seconds, first, hint }) => {
  const fused = fusedWeapons(recipe, weapons);
  return (
    <View style={[st.row, !first && st.rowNext]} testID="evolution-banner">
      <View style={st.head}>
        <View style={st.medal}><Icon name={recipe.icon} size={38} color={INK} /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.eyebrow}>EVOLUTION</Text>
          <Text style={st.name} numberOfLines={2} adjustsFontSizeToFit>{recipe.name}</Text>
          <View style={st.fused}>
            {fused.length === 2 ? (
              <>
                <WeaponAvatar weapon={fused[0]} size={20} />
                <Text style={st.fusedText} numberOfLines={1}>{fused[0].name}</Text>
                <Text style={st.plus}>+</Text>
                <WeaponAvatar weapon={fused[1]} size={20} />
                <Text style={st.fusedText} numberOfLines={1}>{fused[1].name}</Text>
              </>
            ) : (
              <Text style={st.fusedText} numberOfLines={1}>{recipe.familyText}</Text>
            )}
          </View>
        </View>
      </View>
      <Text style={st.what}>{recipe.activeText}</Text>
      <View style={st.chips}>
        <View style={st.chip}><Text style={st.chipText}>Sets ×{EVOLUTION_RULES.setMultiplier}</Text></View>
        <View style={st.chip}><Text style={st.chipText}>+{EVOLUTION_RULES.setDamage} every Set</Text></View>
        <View style={[st.chip, st.chipTime]}><Text style={st.chipText}>{seconds} seconds</Text></View>
      </View>
      {hint && <Text style={st.hint}>{hint}</Text>}
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
  const slash = useSharedValue(0);
  const open = useSharedValue(0);
  const flash = useSharedValue(0);
  const content = useSharedValue(0);
  const prompt = useSharedValue(0);
  const out = useSharedValue(0);
  const born = useRef(Date.now());
  const closing = useRef(false);
  // (kept in a ref so `close` stays the same function when the parent re-renders)
  const done = useRef(onDone);
  done.current = onDone;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    slash.value = withTiming(1, { duration: fxMs(120), easing: Easing.out(Easing.quad) });
    flash.value = withDelay(fxMs(90), withSequence(withTiming(0.75, { duration: fxMs(40) }), withTiming(0, { duration: fxMs(320), easing: Easing.out(Easing.quad) })));
    open.value = withDelay(fxMs(110), withTiming(1, { duration: fxMs(260), easing: Easing.out(Easing.back(1.5)) }));
    content.value = withDelay(fxMs(230), withTiming(1, { duration: fxMs(280), easing: Easing.out(Easing.cubic) }));
    prompt.value = withDelay(fxMs(750), withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0.35, { duration: 500 })), -1, true));
  }, [slash, flash, open, content, prompt]);

  const close = useCallback(() => {
    if (closing.current || Date.now() - born.current < fxMs(GUARD_MS)) return;
    closing.current = true;
    out.value = withTiming(1, { duration: CLOSE_MS, easing: Easing.in(Easing.quad) });
    timer.current = setTimeout(() => done.current(), CLOSE_MS);
  }, [out]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!autoDismissMs) return;
    const t = setTimeout(close, autoDismissMs);
    return () => clearTimeout(t);
  }, [autoDismissMs, close]);

  // The slanted layer is a square bigger than the screen, so its corners stay covered when it turns
  const span = Math.ceil(Math.hypot(size.w, size.h) * 1.1);
  const contentWidth = Math.min(size.w - 28, 480);

  const dimStyle = useAnimatedStyle(() => ({ opacity: 0.66 * Math.min(1, slash.value * 2) * (1 - out.value) }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const slashStyle = useAnimatedStyle(() => ({ opacity: 1 - open.value, transform: [{ scaleX: slash.value }] }));
  const bandStyle = useAnimatedStyle(() => ({ opacity: open.value > 0 ? 1 : 0, transform: [{ scaleY: Math.max(0.001, open.value * (1 - out.value)) }] }));
  const headStyle = useAnimatedStyle(() => ({ opacity: content.value, transform: [{ translateX: (1 - content.value) * -90 }] }));
  const promptStyle = useAnimatedStyle(() => ({ opacity: prompt.value * (1 - out.value) }));

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
          <Animated.View style={[{ width: contentWidth }, headStyle]}>
            {recipes.map((r, i) => <RecipeRow key={r.id} recipe={r} weapons={weapons} seconds={seconds} first={i === 0} hint={i === 0 ? hint : undefined} />)}
          </Animated.View>
        </Animated.View>
        <Animated.View style={[st.slash, slashStyle]} />
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, st.flash, flashStyle]} pointerEvents="none" />
      <Animated.View style={[st.prompt, promptStyle]} pointerEvents="none">
        <Text style={st.promptText}>TAP TO CONTINUE</Text>
      </Animated.View>
    </Pressable>
  );
};

const st = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 500, overflow: 'hidden' },
  dim: { backgroundColor: COLORS.deepOnyx },
  flash: { backgroundColor: COLORS.canvasWhite },
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
  chipText: { color: INK, fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },
  hint: { color: DARK.muted, fontSize: 13, lineHeight: 18 },
  prompt: { position: 'absolute', left: 0, right: 0, bottom: 28, alignItems: 'center' },
  promptText: { color: COLORS.actionYellow, backgroundColor: DARK.panel, fontWeight: '900', letterSpacing: 3, fontSize: 13, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, overflow: 'hidden' },
});
