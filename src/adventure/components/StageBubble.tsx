/**
 * What is said during a fight: a speech bubble on the battle stage. Your
 * fighter's is beside them, with its tail pointing at them: one short line,
 * and the trait checks under it when there is something to check. The foe's
 * (its taunt, as the fight opens) sits on its side and points at it.
 *
 * It lives inside the stage, so it never pushes the board around when the
 * words change.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { COLORS } from '@/utils/colors';
import type { GuidanceKind, TraitCheckPill } from '../coach';
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
  pills?: TraitCheckPill[];
  /** Tap to put the line away (not offered while it is teaching) */
  onPress?: () => void;
  /**
   * Who is talking, and where they stand: your fighter beside the bubble
   * ('left', compact stage) or under it ('down', tall stage); the foe on the
   * other side ('right', 'down-right').
   */
  tail?: 'left' | 'down' | 'right' | 'down-right';
  testID?: string;
}

const StageBubble: React.FC<Props> = ({ text, kind = 'lesson', pills, onPress, tail = 'left', testID }) => {
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
      <View style={[st.tail, TAIL_STYLE[tail], { backgroundColor: bg, borderColor: edge }]} />
      <Text style={st.text}>{text}</Text>
      {pills && pills.length > 0 && (
        <View style={st.pills} testID="coach-trait-pills">
          {pills.map(pill => {
            const pass = pill.status === 'pass';
            const fail = pill.status === 'fail';
            return (
              <View key={pill.attr} testID={`coach-trait-${pill.attr}`} style={[st.pill, pass ? st.pillPass : fail ? st.pillFail : st.pillHint]}>
                <Text style={[st.pillText, pass ? st.pillTextPass : fail ? st.pillTextFail : st.pillTextHint]}>
                  {pass ? '✓' : fail ? '✗' : '→'} {pill.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </>
  );

  return (
    <Animated.View style={[st.wrap, popStyle]}>
      {onPress ? (
        <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.85} style={[st.bubble, foeSide && st.bubbleRight, { backgroundColor: bg, borderColor: edge }]} accessibilityRole="button" accessibilityLabel={`${text} Tap to dismiss`}>
          {body}
        </TouchableOpacity>
      ) : (
        <View testID={testID} style={[st.bubble, foeSide && st.bubbleRight, { backgroundColor: bg, borderColor: edge }]} accessibilityLabel={text}>
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
    paddingVertical: 6,
    gap: 4,
  },
  bubbleRight: { alignSelf: 'flex-end' },
  tail: { position: 'absolute', width: 10, height: 10, transform: [{ rotate: '45deg' }] },
  tailLeft: { left: -6, top: 12, borderLeftWidth: 2, borderBottomWidth: 2 },
  tailDown: { left: 22, bottom: -7, borderRightWidth: 2, borderBottomWidth: 3 },
  tailRight: { right: -6, top: 12, borderRightWidth: 2, borderTopWidth: 2 },
  tailDownRight: { right: 26, bottom: -7, borderRightWidth: 2, borderBottomWidth: 3 },
  text: { flexShrink: 1, fontSize: 13, lineHeight: 17, fontWeight: '800', color: INK },
  pills: { flexDirection: 'row', flexWrap: 'wrap', minWidth: 0, gap: 4 },
  pill: { flexShrink: 1, maxWidth: '100%', borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 6, paddingVertical: 1 },
  pillPass: { backgroundColor: '#D4F4EE', borderColor: COLORS.logicTeal },
  pillFail: { backgroundColor: '#FFE1DE', borderColor: COLORS.impactRed },
  pillHint: { backgroundColor: '#FEF3C7', borderColor: '#D97706' },
  pillText: { flexShrink: 1, fontSize: 10.5, fontWeight: '900' },
  pillTextPass: { color: '#0F766E' },
  pillTextFail: { color: '#B91C1C' },
  pillTextHint: { color: '#92400E' },
});

const TAIL_STYLE = {
  left: st.tailLeft,
  down: st.tailDown,
  right: st.tailRight,
  'down-right': st.tailDownRight,
} as const;

export default StageBubble;
