/**
 * Thumbs up / thumbs down round enjoyment widget + 1-tap contextual reason tags.
 * Merges directly into the staged `fight_ended` event while the player reviews results,
 * or updates historical battle records from Camp -> History.
 */
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Icon from '@/components/Icon';
import { sfx } from '@/audio';
import { COLORS } from '@/utils/colors';
import {
  NEGATIVE_FUN_TAGS,
  POSITIVE_FUN_TAGS,
  type FunRating,
  type FunTag,
} from '@/analytics/fightEvent';

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

const triggerHaptic = () => {
  if (Platform.OS === 'web') return;
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* haptics optional outside native devices */
  }
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
    triggerHaptic();
    if (rating === next) {
      onChange(null, []);
      return;
    }
    const allowed = next === 'up' ? POSITIVE_IDS : NEGATIVE_IDS;
    onChange(next, tags.filter(t => allowed.has(t)));
  };

  const handleTag = (tagId: FunTag) => {
    sfx('click');
    triggerHaptic();
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
          <View style={st.savedBadge} testID={`${testIDPrefix}-saved`}>
            <Text style={st.savedText}>Saved</Text>
          </View>
        )}
      </View>

      <View style={st.thumbsRow}>
        <TouchableOpacity
          testID={`${testIDPrefix}-up`}
          accessibilityRole="button"
          accessibilityLabel="Thumbs up: this round was fun"
          accessibilityState={{ selected: rating === 'up' }}
          activeOpacity={0.8}
          onPress={() => handleVote('up')}
          style={[
            st.thumbBtn,
            compact && st.thumbBtnCompact,
            rating === 'up' && st.thumbUpActive,
          ]}
        >
          <Icon
            name="delapouite/thumb-up"
            size={compact ? 18 : 20}
            color={rating === 'up' ? COLORS.canvasWhite : INK}
            noShadow
          />
          <Text style={[st.thumbLabel, rating === 'up' && st.thumbLabelActive]}>Fun</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID={`${testIDPrefix}-down`}
          accessibilityRole="button"
          accessibilityLabel="Thumbs down: this round was not fun"
          accessibilityState={{ selected: rating === 'down' }}
          activeOpacity={0.8}
          onPress={() => handleVote('down')}
          style={[
            st.thumbBtn,
            compact && st.thumbBtnCompact,
            rating === 'down' && st.thumbDownActive,
          ]}
        >
          <Icon
            name="delapouite/thumb-down"
            size={compact ? 18 : 20}
            color={rating === 'down' ? COLORS.canvasWhite : INK}
            noShadow
          />
          <Text style={[st.thumbLabel, rating === 'down' && st.thumbLabelActive]}>Not fun</Text>
        </TouchableOpacity>
      </View>

      {availableTags.length > 0 && (
        <View style={st.tagsWrap} testID={`${testIDPrefix}-tags`}>
          {availableTags.map(tag => {
            const selected = tags.includes(tag.id);
            return (
              <TouchableOpacity
                key={tag.id}
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
