/**
 * What is said during a fight: a speech bubble on the battle stage. Your
 * fighter's is beside them, with its tail pointing at them: one short line.
 * The foe's (its taunt, as the fight opens) sits on its side and points at it.
 *
 * It is words only (the trait checks have a strip of their own above the
 * board: TraitChecks.tsx) and it lives inside the stage, whose height is
 * fixed, so the board never moves when the words change.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { COLORS } from '@/utils/colors';
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
  testID?: string;
}

const StageBubble: React.FC<Props> = ({ text, kind = 'lesson', onPress, tail = 'left', compact = false, testID }) => {
  const [bg, edge] = TONE[kind];
  const foeSide = tail === 'right' || tail === 'down-right';
  // A new line pops in, so the eye goes to it
  const pop = useSharedValue(1);
  useEffect(() => {
    pop.value = withSequence(withTiming(0.9, { duration: 0 }), withTiming(1.04, { duration: 110, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 90 }));
  }, [text, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const body = (
    <>
      {!compact && <View style={[st.tail, TAIL_STYLE[tail], { backgroundColor: bg, borderColor: edge }]} />}
      <Text style={[st.text, compact && st.textCompact]}>{text}</Text>
    </>
  );

  return (
    <Animated.View style={[st.wrap, popStyle]}>
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
