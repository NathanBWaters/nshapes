/**
 * Cute companion speech bubble — makes every tip, rule check, map nudge, and
 * post-fight recap feel like your adorable fighter buddy is cheering you on.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { FighterAvatar } from '@/components/fighters';
import { COLORS } from '@/utils/colors';
import type { CharacterName } from '@/types';
import type { TraitCheckPill } from '../coach';
import { INK } from './ui';

type CompanionMood = React.ComponentProps<typeof FighterAvatar>['mood'];

interface Props {
  character: CharacterName;
  text: string;
  title?: string;
  badge?: string;
  mood?: CompanionMood;
  tone?: 'warm' | 'warn' | 'cheer' | 'dark';
  pills?: TraitCheckPill[];
  avatarSize?: number;
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
  animate = false,
  onPress,
  testID,
  style,
}) => {
  const isDark = tone === 'dark';
  const isWarn = tone === 'warn';
  const isCheer = tone === 'cheer';

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
      <View style={st.avatarWrap}>
        <FighterAvatar character={character} size={avatarSize} mood={mood} animate={animate} framed />
      </View>
      <View style={[st.bubble, { backgroundColor: bubbleBg, borderColor: bubbleBorder }]}>
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
        {title ? (
          <Text style={[st.title, isDark && { color: COLORS.canvasWhite }]}>{title}</Text>
        ) : null}
        <Text style={[st.text, isDark && { color: '#F5F1EB' }]}>{text}</Text>
        {pills && pills.length > 0 && (
          <View style={st.pillsRow} testID="coach-trait-pills">
            {pills.map(pill => {
              const pass = pill.status === 'pass';
              const fail = pill.status === 'fail';
              const glyph = pass ? '✓' : fail ? '✗' : '→';
              return (
                <View
                  key={pill.attr}
                  testID={`coach-trait-${pill.attr}`}
                  style={[
                    st.pill,
                    pass ? st.pillPass : fail ? st.pillFail : st.pillHint,
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
                </View>
              );
            })}
          </View>
        )}
      </View>
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
    alignItems: 'center',
    gap: 8,
  },
  avatarWrap: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  bubble: {
    flex: 1,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  speaker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#9A5B00',
  },
  badgePill: {
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
    fontSize: 14,
    fontWeight: '900',
    color: INK,
  },
  text: {
    fontSize: 12.5,
    fontWeight: '800',
    color: INK,
    lineHeight: 17.5,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 3,
  },
  pill: {
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
