/**
 * Cute companion speech bubble — makes every tip, rule check, map nudge, and
 * post-fight recap feel like your adorable fighter buddy is cheering you on.
 *
 * Also exports `LivingBreath`, a zero-frame-loop GPU-only volume-preserving
 * breathing wrapper (`scaleX = 1 / scaleY` anchored at the creature's feet,
 * incommensurate prime periods via `IDLE_LOOP.primePeriodsMs` + `seedFromKey`,
 * gated on `useAppActive()` & `!useReducedMotion()`, cleaned up with
 * `cancelAnimation`) so living Fighter portraits breathe organically on
 * menus, modals, pickers, and celebrations without breaking battery budgets.
 */
import React, { useEffect, useRef } from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { FighterAvatar } from '@/components/fighters';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import {
  EASE,
  IDLE_LOOP,
  MS,
  OVERLAP,
  SPRING,
  STAGGER,
  STAYS,
  reducedMs,
  seedFromKey,
  staggerDelay,
} from '@/utils/motion';
import type { CharacterName } from '@/types';
import type { TraitCheckPill } from '../coach';
import { INK } from './ui';

type CompanionMood = React.ComponentProps<typeof FighterAvatar>['mood'];

/**
 * Zero-frame-loop GPU-only breathing wrapper for living character portraits.
 * Uses volume-preserving `scaleX = 1 / scaleY` anchored at the bottom contact
 * line (`size * 0.35`), incommensurate prime periods, and deterministic hashed
 * phase delays so sibling characters never breathe in lockstep.
 */
export const LivingBreath: React.FC<{
  children: React.ReactNode;
  /** Seed key for deterministic period & phase selection (e.g., fighter name + surface) */
  seedKey: string;
  /** Portrait pixel size used to compute foot-contact anchor (`size * 0.35`) */
  size: number;
  /** Pause when off-screen / modal paused / disabled (default `true`) */
  active?: boolean;
  /** Breath scale amplitude (default `0.032`, safely within `IDLE_LOOP.creatureBreathMax`) */
  amplitude?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ children, seedKey, size, active = true, amplitude = 0.032, style }) => {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const breath = useSharedValue(0);
  const running = active && appActive && !reducedMotion;

  useEffect(() => {
    if (!running) {
      cancelAnimation(breath);
      breath.value = 0;
      return;
    }
    const seed = seedFromKey(seedKey);
    // Organic living-portrait breath period (~2.2–3.5s) derived from IDLE_LOOP.primePeriodsMs[0]
    // so sibling creatures breathe at incommensurate tempos without sluggish 11s pauses.
    const periodMs = Math.round(IDLE_LOOP.primePeriodsMs[0] * (0.76 + (seed % 5) * 0.11));
    const halfMs = Math.max(MS.hero, Math.round(periodMs / 2));
    // Start immediately at a deterministic hashed phase inside [-0.35, 0.85] so every portrait
    // is visibly alive from frame 0 and siblings never breathe in lockstep.
    const startPhase = -0.35 + (((seed >>> 8) % 120) / 100);
    const goingUp = ((seed >>> 16) & 1) === 0;
    const low = -0.5;
    const high = 1;
    const firstTarget = goingUp ? high : low;
    const firstFraction = Math.abs(firstTarget - startPhase) / (high - low);
    const firstLegMs = Math.max(MS.feedback, Math.round(firstFraction * halfMs));

    breath.value = startPhase;
    breath.value = withSequence(
      withTiming(firstTarget, { duration: firstLegMs, easing: EASE.drift }),
      withRepeat(
        withSequence(
          withTiming(goingUp ? low : high, { duration: halfMs, easing: EASE.drift }),
          withTiming(firstTarget, { duration: halfMs, easing: EASE.drift })
        ),
        -1
      )
    );
    return () => cancelAnimation(breath);
  }, [running, seedKey, breath]);

  const footAnchorY = size * 0.35;
  const clampedAmp = Math.min(IDLE_LOOP.creatureBreathMax, Math.max(0.01, amplitude));
  const chestLiftPx = Math.min(2.2, size * 0.032);

  const animStyle = useAnimatedStyle(() => {
    const b = breath.value;
    const scaleY = 1 + b * clampedAmp;
    // Slightly buoyant ribcage volume preservation (matches Disney SQUASH_TIER between ui & lively)
    const scaleX = Math.pow(1 / scaleY, 0.85);
    return {
      transform: [
        { translateY: footAnchorY - b * chestLiftPx },
        { scaleX },
        { scaleY },
        { translateY: -footAnchorY },
      ],
    };
  });

  const webContain = Platform.OS === 'web' ? ({ contain: 'layout style' } as ViewStyle) : undefined;
  const webWillChange = Platform.OS === 'web' ? ({ willChange: 'transform' } as ViewStyle) : undefined;

  return (
    <View style={[webContain, style]}>
      <Animated.View style={[webWillChange, animStyle]}>{children}</Animated.View>
    </View>
  );
};

const StaggeredTraitPill: React.FC<{
  pill: TraitCheckPill;
  index: number;
  total: number;
  reduced: boolean;
}> = ({ pill, index, total, reduced }) => {
  const pass = pill.status === 'pass';
  const fail = pill.status === 'fail';
  const glyph = pass ? '✓' : fail ? '✗' : '→';
  const delay = staggerDelay(index, total, STAGGER.card);
  const o = useSharedValue(reduced ? 1 : 0);
  const s = useSharedValue(reduced ? 1 : 0.9);

  useEffect(() => {
    if (reduced) {
      o.value = 1;
      s.value = 1;
      return;
    }
    o.value = withDelay(delay, withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...STAYS }), STAYS.reduceMotion);
    s.value = withDelay(delay, withTiming(1, { duration: MS.quick, easing: EASE.popSoft }));
    return () => {
      cancelAnimation(o);
      cancelAnimation(s);
    };
  }, [delay, reduced, o, s]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ scale: s.value }],
  }));

  return (
    <Animated.View
      testID={`coach-trait-${pill.attr}`}
      style={[
        st.pill,
        pass ? st.pillPass : fail ? st.pillFail : st.pillHint,
        pillStyle,
      ]}
    >
      <Text
        style={[
          st.pillText,
          pass ? st.pillTextPass : fail ? st.pillTextFail : st.pillTextHint,
        ]}
      >
        {glyph} {pill.label}
      </Text>
    </Animated.View>
  );
};

interface Props {
  character: CharacterName;
  text: string;
  title?: string;
  badge?: string;
  mood?: CompanionMood;
  tone?: 'warm' | 'warn' | 'cheer' | 'dark';
  pills?: TraitCheckPill[];
  avatarSize?: number;
  /** Default `true`: lightweight GPU-only breathing (`0` frame loops, reduced-motion & app-active gated) */
  animate?: boolean;
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const CompanionBubble: React.FC<Props> = ({
  character,
  text,
  title,
  badge,
  mood = 'curious',
  tone = 'warm',
  pills,
  avatarSize = 38,
  animate = true,
  onPress,
  testID,
  style,
}) => {
  const reducedMotion = useReducedMotion();
  const isDark = tone === 'dark';
  const isWarn = tone === 'warn';
  const isCheer = tone === 'cheer';

  // Enter softly from speaker tail origin (`EASE.popSoft`), reduced-motion safe fade
  const bubbleO = useSharedValue(reducedMotion ? 0 : 0);
  const bubbleS = useSharedValue(reducedMotion ? 1 : 0.93);
  const bubbleX = useSharedValue(reducedMotion ? 0 : -6);

  // Subtle 1-beat avatar micro-nod (+OVERLAP.primaryMs) & smooth text crossfade on message swaps
  const nodY = useSharedValue(0);
  const textO = useSharedValue(1);
  const textY = useSharedValue(0);
  const prevMessageKey = useRef(`${character}|${title ?? ''}|${text}`);

  useEffect(() => {
    if (reducedMotion) {
      bubbleS.value = 1;
      bubbleX.value = 0;
      bubbleO.value = withTiming(1, { duration: reducedMs(MS.quick), easing: EASE.ui, ...STAYS });
    } else {
      bubbleO.value = withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...STAYS });
      bubbleS.value = withTiming(1, { duration: MS.quick, easing: EASE.popSoft });
      bubbleX.value = withTiming(0, { duration: MS.quick, easing: EASE.enter });
    }
    return () => {
      cancelAnimation(bubbleO);
      cancelAnimation(bubbleS);
      cancelAnimation(bubbleX);
    };
  }, [reducedMotion, bubbleO, bubbleS, bubbleX]);

  useEffect(() => {
    const key = `${character}|${title ?? ''}|${text}`;
    if (key === prevMessageKey.current) return;
    prevMessageKey.current = key;

    if (reducedMotion) {
      textY.value = 0;
      textO.value = 0;
      textO.value = withTiming(1, { duration: reducedMs(MS.feedback), easing: EASE.ui, ...STAYS });
      return;
    }

    textO.value = 0;
    textY.value = 4;
    textO.value = withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...STAYS });
    textY.value = withTiming(0, { duration: MS.quick, easing: EASE.enter });

    // Avatar gives a cheerful 1-beat nod trailing the bubble swap by OVERLAP.primaryMs
    nodY.value = withDelay(
      OVERLAP.primaryMs,
      withSequence(
        withTiming(-3, { duration: OVERLAP.secondaryMs, easing: EASE.enter }),
        withSpring(0, SPRING.snappy)
      )
    );

    return () => {
      cancelAnimation(textO);
      cancelAnimation(textY);
      cancelAnimation(nodY);
    };
  }, [character, title, text, reducedMotion, textO, textY, nodY]);

  const bubbleAnimStyle = useAnimatedStyle(() => ({
    opacity: bubbleO.value,
    transform: [{ translateX: bubbleX.value }, { scale: bubbleS.value }],
  }));

  const nodAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: nodY.value }],
  }));

  const textAnimStyle = useAnimatedStyle(() => ({
    opacity: textO.value,
    transform: [{ translateY: textY.value }],
  }));

  const bubbleBg = isDark
    ? 'rgba(255, 251, 235, 0.12)'
    : isWarn
      ? '#FFF1F0'
      : isCheer
        ? '#ECFDF5'
        : '#FFFBEB';

  const bubbleBorder = isDark
    ? 'rgba(253, 224, 71, 0.55)'
    : isWarn
      ? COLORS.impactOrange
      : isCheer
        ? COLORS.logicTeal
        : INK;

  const content = (
    <>
      <Animated.View style={[st.avatarWrap, nodAnimStyle]}>
        <FighterAvatar character={character} size={avatarSize} mood={mood} animate={animate} lightweight framed />
      </Animated.View>
      <Animated.View style={[st.bubble, { backgroundColor: bubbleBg, borderColor: bubbleBorder }, bubbleAnimStyle]}>
        <View style={[st.tail, { backgroundColor: bubbleBg, borderColor: bubbleBorder }]} />
        <View style={st.speakerRow}>
          <Text style={[st.speaker, isDark && { color: COLORS.actionYellow }]} numberOfLines={1}>
            {character}
          </Text>
          {badge ? (
            <View style={[st.badgePill, isDark && { backgroundColor: 'rgba(253,224,71,0.2)', borderColor: COLORS.actionYellow }]}>
              <Text style={[st.badgeText, isDark && { color: COLORS.actionYellow }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Animated.View style={textAnimStyle}>
          {title ? (
            <Text style={[st.title, isDark && { color: COLORS.canvasWhite }]}>{title}</Text>
          ) : null}
          <Text style={[st.text, isDark && { color: '#F5F1EB' }]}>{text}</Text>
        </Animated.View>
        {pills && pills.length > 0 && (
          <View style={st.pillsRow} testID="coach-trait-pills">
            {pills.map((pill, idx) => (
              <StaggeredTraitPill
                key={pill.attr}
                pill={pill}
                index={idx}
                total={pills.length}
                reduced={reducedMotion}
              />
            ))}
          </View>
        )}
      </Animated.View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.85} style={[st.row, style]}>
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View testID={testID} style={[st.row, style]}>
      {content}
    </View>
  );
};

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    flexShrink: 1,
    minWidth: 0,
    gap: 8,
  },
  avatarWrap: {
    alignSelf: 'flex-start',
    marginTop: 2,
    flexShrink: 0,
  },
  bubble: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
    borderWidth: 2,
    borderBottomWidth: 3,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 3,
    position: 'relative',
  },
  tail: {
    position: 'absolute',
    left: -6,
    top: 12,
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
  speakerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0,
    gap: 6,
  },
  speaker: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#9A5B00',
  },
  badgePill: {
    flexShrink: 1,
    maxWidth: '100%',
    backgroundColor: COLORS.actionYellow,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: INK,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: INK,
    textTransform: 'uppercase',
  },
  title: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '900',
    color: INK,
  },
  text: {
    flexShrink: 1,
    fontSize: 12.5,
    fontWeight: '800',
    color: INK,
    lineHeight: 17.5,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    minWidth: 0,
    gap: 5,
    marginTop: 3,
  },
  pill: {
    flexShrink: 1,
    maxWidth: '100%',
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pillPass: {
    backgroundColor: '#D4F4EE',
    borderColor: COLORS.logicTeal,
  },
  pillFail: {
    backgroundColor: '#FFE1DE',
    borderColor: COLORS.impactRed,
  },
  pillHint: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  pillText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
  },
  pillTextPass: {
    color: '#0F766E',
  },
  pillTextFail: {
    color: '#B91C1C',
  },
  pillTextHint: {
    color: '#92400E',
  },
});

export default CompanionBubble;
