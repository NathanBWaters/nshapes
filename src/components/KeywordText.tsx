/**
 * KeywordText
 *
 * A Text component that auto-detects game keywords and renders them
 * as tappable, underlined spans. Tapping opens a tooltip explanation.
 */

import React, { useMemo } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { findKeywords, KeywordMatch } from '../utils/keywords';
import { useKeyword } from '../context/KeywordContext';
import { COLORS } from '../utils/colors';

interface KeywordTextProps {
  /** The text content to parse for keywords */
  children: string;
  /** Base text style to apply */
  style?: StyleProp<TextStyle>;
  /** Additional style for keyword spans (merged with underline) */
  keywordStyle?: StyleProp<TextStyle>;
  /** Number of lines before truncating (passed to Text) */
  numberOfLines?: number;
}

/**
 * Renders text with auto-detected keywords as tappable underlined spans.
 *
 * Usage:
 * ```tsx
 * <KeywordText style={styles.description}>
 *   10% chance to gain grace on match.
 * </KeywordText>
 * ```
 */
const KeywordText: React.FC<KeywordTextProps> = ({
  children,
  style,
  keywordStyle,
  numberOfLines,
}) => {
  const { openKeyword } = useKeyword();

  // Parse text and find keyword matches
  const segments = useMemo(() => {
    if (!children || typeof children !== 'string') {
      return [{ type: 'text' as const, content: children || '' }];
    }

    const matches = findKeywords(children);

    if (matches.length === 0) {
      return [{ type: 'text' as const, content: children }];
    }

    const result: Array<
      | { type: 'text'; content: string }
      | { type: 'keyword'; content: string; keywordId: string }
    > = [];

    let lastIndex = 0;

    for (const match of matches) {
      // Add text before this keyword
      if (match.start > lastIndex) {
        result.push({
          type: 'text',
          content: children.slice(lastIndex, match.start),
        });
      }

      // Add the keyword
      result.push({
        type: 'keyword',
        content: match.term,
        keywordId: match.keyword,
      });

      lastIndex = match.end;
    }

    // Add remaining text after last keyword
    if (lastIndex < children.length) {
      result.push({
        type: 'text',
        content: children.slice(lastIndex),
      });
    }

    return result;
  }, [children]);

  // Base underline style for keywords
  const keywordUnderlineStyle: TextStyle = {
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textDecorationColor: COLORS.slateCharcoal,
  };

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <Text key={index}>{segment.content}</Text>;
        }

        // Keyword - render as tappable
        return (
          <Text
            key={index}
            onPress={() => openKeyword(segment.keywordId)}
            style={[keywordUnderlineStyle, keywordStyle]}
          >
            {segment.content}
          </Text>
        );
      })}
    </Text>
  );
};

export default KeywordText;
