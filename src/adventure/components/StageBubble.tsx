/**
 * What is said during a fight: a speech bubble on the battle stage. Your
 * fighter's is beside them, with its tail pointing at them: one short line.
 * The foe's (its taunt, as the fight opens) sits on its side and points at it.
 *
 * It is words only (the trait checks have a strip of their own above the
 * board: TraitChecks.tsx) and it lives inside the stage, whose height is
 * fixed, so the board never moves when the words change.
 *
 * Tokenized with `motion.ts` (`EASE.popSoft` / `EASE.ui` / `STAYS`) for crisp
 * entrance and smooth crossfade on taunt → coach swaps, with full `useReducedMotion`
 * and `cancelAnimation` hygiene.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import { ACCESSIBLE, EASE, MS, STAYS } from '@/utils/motion';
import type { GuidanceKind } from '../coach';
import { INK } from './ui';

/** How each kind of line looks: [background, edge] */
const TONE: Record<GuidanceKind | 'event' | 'foe', [string, string]> = {
  lesson: ['#FFFBEB', INK],
  opening: ['#FFFBEB', INK],
  pair: ['#FFFBEB', INK],
  cheer: ['#ECFDF5', COLORS.logicTeal],
  rescue: ['#EEF6FF', '#2563EB'],
  mistake: ['#FFF1F0', COLORS.impactOrange],
  event: ['#FFFBEB', INK],
  foe: ['#FFF1F0', '#9F1239'],
};

interface Props {
  text: string;
  kind?: GuidanceKind | 'event' | 'foe';
  /** Tap to put the line away (not offered while it is teaching) */
  onPress?: () => void;
  /**
   * Who is talking, and where they stand: your fighter beside the bubble
   * ('left', compact stage) or under it ('down', tall stage); the foe on the
   * other side ('right', 'down-right').
   */
  tail?: 'left' | 'down' | 'right' | 'down-right';
  /** Compact inline style for short battle stages so tips fit cleanly without spilling out */
  compact?: boolean;
  /** Optional entrance delay (ms) so opening taunts cleanly trail creature/banner staging */
  enterDelayMs?: number;
  testID?: string;
}

const StageBubble: React.FC<Props> = ({
  text,
  kind = 'lesson',
  onPress,
  tail = 'left',
  compact = false,
  enterDelayMs = 0,
  testID,
}) => {
  const reducedMotion = useReducedMotion();
  const [bg, edge] = TONE[kind];
  const foeSide = tail === 'right' || tail === 'down-right';

  const opacity = useSharedValue(0);
  const scale = useSharedValue(reducedMotion ? 1 : 0.92);
  const shiftX = useSharedValue(0);
  const shiftY = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(opacity);
    cancelAnimation(scale);
    cancelAnimation(shiftX);
    cancelAnimation(shiftY);

    const delay = enterDelayMs > 0 ? enterDelayMs : 0;

    if (reducedMotion) {
      scale.value = 1;
      shiftX.value = 0;
      shiftY.value = 0;
      opacity.value = 0.25;
      opacity.value = withDelay(
        delay,
        withTiming(1, { duration: ACCESSIBLE.fadeMs, easing: EASE.ui, ...STAYS }),
        STAYS.reduceMotion
      );
      return () => cancelAnimation(opacity);
    }

    opacity.value = 0;
    scale.value = 0.92;
    shiftX.value = tail === 'right' ? 6 : tail === 'left' ? -6 : 0;
    shiftY.value = tail === 'down' || tail === 'down-right' ? 5 : 2;

    opacity.value = withDelay(delay, withTiming(1, { duration: MS.feedback, easing: EASE.ui }));
    scale.value = withDelay(delay, withTiming(1, { duration: MS.quick, easing: EASE.popSoft }));
    shiftX.value = withDelay(delay, withTiming(0, { duration: MS.quick, easing: EASE.enter }));
    shiftY.value = withDelay(delay, withTiming(0, { duration: MS.quick, easing: EASE.enter }));

    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      cancelAnimation(shiftX);
      cancelAnimation(shiftY);
    };
  }, [text, kind, tail, enterDelayMs, reducedMotion, opacity, scale, shiftX, shiftY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: shiftX.value },
      { translateY: shiftY.value },
      { scale: scale.value },
    ],
  }));

  const body = (
    <>
      {!compact && <View style={[st.tail, TAIL_STYLE[tail], { backgroundColor: bg, borderColor: edge }]} />}
      <Text style={[st.text, compact && st.textCompact]}>{text}</Text>
    </>
  );

  return (
    <Animated.View style={[st.wrap, animStyle]}>
      {onPress ? (
        <TouchableOpacity
          testID={testID}
          onPress={onPress}
          activeOpacity={0.85}
          style={[st.bubble, compact && st.bubbleCompact, foeSide && st.bubbleRight, { backgroundColor: bg, borderColor: edge }]}
          accessibilityRole="button"
          accessibilityLabel={`${text} Tap to dismiss`}
        >
          {body}
        </TouchableOpacity>
      ) : (
        <View
          testID={testID}
          style={[st.bubble, compact && st.bubbleCompact, foeSide && st.bubbleRight, { backgroundColor: bg, borderColor: edge }]}
          accessibilityLabel={text}
        >
          {body}
        </View>
      )}
    </Animated.View>
  );
};

const st = StyleSheet.create({
  wrap: { alignSelf: 'stretch', flexShrink: 1, minWidth: 0, maxWidth: '100%' },
  bubble: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
    borderWidth: 2,
    borderBottomWidth: 3,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    gap: 4,
  },
  bubbleCompact: {
    alignSelf: 'center',
    borderWidth: 1.5,
    borderBottomWidth: 2,
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  bubbleRight: { alignSelf: 'flex-end' },
  tail: { position: 'absolute', width: 10, height: 10, transform: [{ rotate: '45deg' }] },
  tailLeft: { left: -6, top: 12, borderLeftWidth: 2, borderBottomWidth: 2 },
  tailDown: { left: 22, bottom: -7, borderRightWidth: 2, borderBottomWidth: 3 },
  tailRight: { right: -6, top: 12, borderRightWidth: 2, borderTopWidth: 2 },
  tailDownRight: { right: 26, bottom: -7, borderRightWidth: 2, borderBottomWidth: 3 },
  text: { flexShrink: 1, fontSize: 12.5, lineHeight: 16, fontWeight: '800', color: INK },
  textCompact: { fontSize: 10, lineHeight: 12.5, fontWeight: '800', textAlign: 'center' },
});

const TAIL_STYLE = {
  left: st.tailLeft,
  down: st.tailDown,
  right: st.tailRight,
  'down-right': st.tailDownRight,
} as const;

export default StageBubble;
