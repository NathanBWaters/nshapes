/**
 * Thumbs up / thumbs down round enjoyment widget + 1-tap contextual reason tags.
 * Merges directly into the staged `fight_ended` event while the player reviews results,
 * or updates historical battle records from Camp -> History.
 */
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Icon, { type IconName } from '@/components/Icon';
import { PopIn } from '@/adventure/components/ui';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { sfx } from '@/audio';
import { COLORS } from '@/utils/colors';
import { BTN_PRESS, EASE, SPRING, STAGGER, STAYS, staggerDelay } from '@/utils/motion';
import { triggerHaptic } from '@/utils/haptics';
import {
  NEGATIVE_FUN_TAGS,
  POSITIVE_FUN_TAGS,
  type FunRating,
  type FunTag,
} from '@/analytics/fightEvent';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const INK = COLORS.slateCharcoal;
const POSITIVE_IDS = new Set<FunTag>(POSITIVE_FUN_TAGS.map(t => t.id));
const NEGATIVE_IDS = new Set<FunTag>(NEGATIVE_FUN_TAGS.map(t => t.id));

interface Props {
  rating: FunRating | null;
  tags?: readonly FunTag[];
  onChange: (rating: FunRating | null, tags: FunTag[]) => void;
  compact?: boolean;
  title?: string;
  testIDPrefix?: string;
}

const FunThumbButton: React.FC<{
  testID: string;
  accessibilityLabel: string;
  selected: boolean;
  compact: boolean;
  activeStyle: object;
  icon: IconName;
  label: string;
  onPress: () => void;
}> = ({ testID, accessibilityLabel, selected, compact, activeStyle, icon, label, onPress }) => {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  useEffect(() => () => cancelAnimation(pressed), [pressed]);
  const animStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: 1 - pressed.value * (1 - BTN_PRESS.reducedOpacity) }
      : {
          transform: [
            { translateY: pressed.value * BTN_PRESS.smallTranslateY },
            { scale: 1 - pressed.value * (1 - BTN_PRESS.scale) },
          ],
        }
  );
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: BTN_PRESS.pressInMs, easing: EASE.ui, ...(reduced ? STAYS : {}) });
      }}
      onPressOut={() => {
        pressed.value = reduced
          ? withTiming(0, { duration: BTN_PRESS.pressInMs, easing: EASE.ui, ...STAYS })
          : withSpring(0, SPRING.snappy);
      }}
      style={[
        st.thumbBtn,
        compact && st.thumbBtnCompact,
        selected && activeStyle,
        animStyle,
      ]}
    >
      <Icon
        name={icon}
        size={compact ? 18 : 20}
        color={selected ? COLORS.canvasWhite : INK}
        noShadow
      />
      <Text style={[st.thumbLabel, selected && st.thumbLabelActive]}>{label}</Text>
    </AnimatedPressable>
  );
};

const RoundFunPrompt: React.FC<Props> = ({
  rating,
  tags = [],
  onChange,
  compact = false,
  title = 'Was that round fun?',
  testIDPrefix = 'fun',
}) => {
  const handleVote = (next: FunRating) => {
    sfx('click');
    void triggerHaptic('light');
    if (rating === next) {
      onChange(null, []);
      return;
    }
    const allowed = next === 'up' ? POSITIVE_IDS : NEGATIVE_IDS;
    onChange(next, tags.filter(t => allowed.has(t)));
  };

  const handleTag = (tagId: FunTag) => {
    sfx('click');
    void triggerHaptic('light');
    const activeRating: FunRating = rating ?? (POSITIVE_IDS.has(tagId) ? 'up' : 'down');
    const exists = tags.includes(tagId);
    const nextTags = exists ? tags.filter(t => t !== tagId) : [...tags, tagId];
    onChange(activeRating, nextTags);
  };

  const availableTags = rating === 'up' ? POSITIVE_FUN_TAGS : rating === 'down' ? NEGATIVE_FUN_TAGS : [];

  return (
    <View style={[st.box, compact && st.boxCompact]} testID={`${testIDPrefix}-prompt`}>
      <View style={st.headerRow}>
        <Text style={[st.question, compact && st.questionCompact]}>{title}</Text>
        {rating !== null && (
          <PopIn key={rating} style={st.savedBadge}>
            <Text style={st.savedText} testID={`${testIDPrefix}-saved`}>Saved</Text>
          </PopIn>
        )}
      </View>

      <View style={st.thumbsRow}>
        <FunThumbButton
          testID={`${testIDPrefix}-up`}
          accessibilityLabel="Thumbs up: this round was fun"
          selected={rating === 'up'}
          compact={compact}
          activeStyle={st.thumbUpActive}
          icon="delapouite/thumb-up"
          label="Fun"
          onPress={() => handleVote('up')}
        />

        <FunThumbButton
          testID={`${testIDPrefix}-down`}
          accessibilityLabel="Thumbs down: this round was not fun"
          selected={rating === 'down'}
          compact={compact}
          activeStyle={st.thumbDownActive}
          icon="delapouite/thumb-down"
          label="Not fun"
          onPress={() => handleVote('down')}
        />
      </View>

      {availableTags.length > 0 && (
        <View style={st.tagsWrap} testID={`${testIDPrefix}-tags`}>
          {availableTags.map((tag, idx) => {
            const selected = tags.includes(tag.id);
            return (
              <PopIn key={`${rating}-${tag.id}`} delay={staggerDelay(idx, availableTags.length, STAGGER.card)}>
                <TouchableOpacity
                  testID={`${testIDPrefix}-tag-${tag.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  activeOpacity={0.8}
                  onPress={() => handleTag(tag.id)}
                  style={[
                    st.tagChip,
                    compact && st.tagChipCompact,
                    selected && (rating === 'up' ? st.tagChipUp : st.tagChipDown),
                  ]}
                >
                  <Text style={[st.tagText, selected && st.tagTextActive]}>{tag.label}</Text>
                </TouchableOpacity>
              </PopIn>
            );
          })}
        </View>
      )}
    </View>
  );
};

const st = StyleSheet.create({
  box: {
    alignSelf: 'stretch',
    maxWidth: '100%',
    minWidth: 0,
    backgroundColor: COLORS.paperBeige,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: INK,
    padding: 12,
    gap: 10,
  },
  boxCompact: {
    padding: 10,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  question: {
    fontSize: 13,
    fontWeight: '900',
    color: INK,
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  questionCompact: {
    fontSize: 12,
  },
  savedBadge: {
    backgroundColor: COLORS.actionYellow,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  savedText: {
    fontSize: 10,
    fontWeight: '900',
    color: INK,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  thumbsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  thumbBtn: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 10,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  thumbBtnCompact: {
    minHeight: 44,
    paddingVertical: 6,
  },
  thumbUpActive: {
    backgroundColor: COLORS.logicTeal,
  },
  thumbDownActive: {
    backgroundColor: COLORS.impactOrange,
  },
  thumbLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: INK,
  },
  thumbLabelActive: {
    color: COLORS.canvasWhite,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    maxWidth: '100%',
    minWidth: 0,
  },
  tagChip: {
    minHeight: 34,
    maxWidth: '100%',
    justifyContent: 'center',
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagChipCompact: {
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tagChipUp: {
    backgroundColor: '#D6F5EF',
    borderColor: COLORS.logicTeal,
  },
  tagChipDown: {
    backgroundColor: '#FFE8D2',
    borderColor: COLORS.impactOrange,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '800',
    color: INK,
    flexShrink: 1,
  },
  tagTextActive: {
    color: COLORS.deepOnyx,
  },
});

export default RoundFunPrompt;
