import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import { AttributeName, Card as CardType } from '@/types';
import Card from './Card';

interface AttributeUnlockScreenProps {
  newAttribute: AttributeName;
  onContinue: () => void;
  onPractice?: () => void;
  isFinalRound?: boolean;
}

// Example cards for demonstrating attributes
const createExampleCard = (
  shape: 'diamond' | 'squiggle' | 'oval',
  color: 'red' | 'green' | 'purple',
  number: 1 | 2 | 3,
  shading: 'solid' | 'striped' | 'open',
  background: 'white' | 'beige' | 'charcoal',
  id: string
): CardType => ({
  id,
  shape,
  color,
  number,
  shading,
  background,
  selected: false,
});

// Shading examples - same shape/color/number, different shading
const SHADING_EXAMPLES: CardType[] = [
  createExampleCard('diamond', 'red', 2, 'solid', 'white', 'shade-1'),
  createExampleCard('diamond', 'red', 2, 'striped', 'white', 'shade-2'),
  createExampleCard('diamond', 'red', 2, 'open', 'white', 'shade-3'),
];

// Background examples - same shape/color/number/shading, different background
const BACKGROUND_EXAMPLES: CardType[] = [
  createExampleCard('oval', 'purple', 1, 'solid', 'white', 'bg-1'),
  createExampleCard('oval', 'purple', 1, 'solid', 'beige', 'bg-2'),
  createExampleCard('oval', 'purple', 1, 'solid', 'charcoal', 'bg-3'),
];

const ATTRIBUTE_INFO: Record<AttributeName, {
  title: string;
  description: string;
  values: string[];
  examples: CardType[];
}> = {
  shape: {
    title: 'Shape',
    description: 'Each card has one of three shapes. For a valid SET, all three cards must have the same shape OR all different shapes.',
    values: ['Diamond', 'Squiggle', 'Oval'],
    examples: [],
  },
  color: {
    title: 'Color',
    description: 'Each card has one of three colors. For a valid SET, all three cards must have the same color OR all different colors.',
    values: ['Red', 'Green', 'Purple'],
    examples: [],
  },
  number: {
    title: 'Number',
    description: 'Each card shows 1, 2, or 3 shapes. For a valid SET, all three cards must have the same count OR all different counts.',
    values: ['One', 'Two', 'Three'],
    examples: [],
  },
  shading: {
    title: 'Shading',
    description: 'Each shape can be solid, striped, or open (outline only). For a valid SET, all three cards must have the same shading OR all different shadings.',
    values: ['Solid', 'Striped', 'Open'],
    examples: SHADING_EXAMPLES,
  },
  background: {
    title: 'Background',
    description: 'Each card has a background color: white, beige, or charcoal. For a valid SET, all three cards must have the same background OR all different backgrounds.',
    values: ['White', 'Beige', 'Charcoal'],
    examples: BACKGROUND_EXAMPLES,
  },
};

const AttributeUnlockScreen: React.FC<AttributeUnlockScreenProps> = ({
  newAttribute,
  onContinue,
  onPractice,
  isFinalRound = false,
}) => {
  const info = ATTRIBUTE_INFO[newAttribute];

  if (isFinalRound) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.finalBanner}>
            <Text style={styles.finalTitle}>FINAL ROUND</Text>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            <Text style={styles.finalSubtitle}>The Ultimate Challenge</Text>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                All 5 attributes are now active. Every match must satisfy:
              </Text>
              <View style={styles.attributeList}>
                <Text style={styles.attributeItem}>Shape</Text>
                <Text style={styles.attributeItem}>Color</Text>
                <Text style={styles.attributeItem}>Number</Text>
                <Text style={styles.attributeItem}>Shading</Text>
                <Text style={styles.attributeItem}>Background</Text>
              </View>
              <Text style={styles.infoTextSmall}>
                Each attribute must be all the same OR all different across your 3 cards.
              </Text>
            </View>

            <Text style={styles.encouragement}>
              You've made it this far. Trust your pattern recognition!
            </Text>
          </ScrollView>

          <TouchableOpacity style={styles.continueButton} onPress={onContinue}>
            <Text style={styles.continueButtonText}>I'M READY</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.banner}>
          <Text style={styles.bannerText}>NEW ATTRIBUTE</Text>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <Text style={styles.attributeTitle}>{info.title}</Text>

          <Text style={styles.description}>{info.description}</Text>

          <View style={styles.valuesContainer}>
            <Text style={styles.valuesLabel}>The three values:</Text>
            <View style={styles.valuesList}>
              {info.values.map((value, index) => (
                <View key={value} style={styles.valueBadge}>
                  <Text style={styles.valueText}>{value}</Text>
                </View>
              ))}
            </View>
          </View>

          {info.examples.length > 0 && (
            <View style={styles.examplesContainer}>
              <Text style={styles.examplesLabel}>Examples:</Text>
              <View style={styles.examplesRow}>
                {info.examples.map((card) => (
                  <View key={card.id} style={styles.exampleCardWrapper}>
                    <Card card={card} onClick={() => {}} disabled />
                  </View>
                ))}
              </View>
              <View style={styles.labelsRow}>
                {info.values.map((value) => (
                  <Text key={value} style={styles.exampleLabel}>{value}</Text>
                ))}
              </View>
            </View>
          )}

          <View style={styles.rewardNote}>
            <Text style={styles.rewardNoteText}>
              With more complexity comes greater rewards!
            </Text>
          </View>
        </ScrollView>

        <View style={styles.buttonRow}>
          {onPractice && (
            <TouchableOpacity style={styles.practiceButton} onPress={onPractice}>
              <Text style={styles.practiceButtonText}>PRACTICE FIRST</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.continueButton, onPractice && styles.continueButtonSmall]}
            onPress={onContinue}
          >
            <Text style={styles.continueButtonText}>CONTINUE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    width: '100%',
    maxWidth: 380,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  banner: {
    backgroundColor: COLORS.logicTeal,
    paddingVertical: 12,
    alignItems: 'center',
  },
  bannerText: {
    color: COLORS.canvasWhite,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  finalBanner: {
    backgroundColor: COLORS.impactOrange,
    paddingVertical: 16,
    alignItems: 'center',
  },
  finalTitle: {
    color: COLORS.canvasWhite,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 3,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  attributeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.deepOnyx,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: COLORS.slateCharcoal,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  valuesContainer: {
    marginBottom: 20,
  },
  valuesLabel: {
    fontSize: 12,
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 8,
  },
  valuesList: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  valueBadge: {
    backgroundColor: COLORS.paperBeige,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  valueText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.deepOnyx,
  },
  examplesContainer: {
    marginBottom: 20,
  },
  examplesLabel: {
    fontSize: 12,
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 12,
  },
  examplesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  exampleCardWrapper: {
    width: 70,
    height: 100,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  exampleLabel: {
    width: 70,
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.slateCharcoal,
    fontWeight: '600',
  },
  rewardNote: {
    backgroundColor: COLORS.actionYellow + '30',
    padding: 12,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.actionYellow,
  },
  rewardNoteText: {
    fontSize: 13,
    color: COLORS.deepOnyx,
    textAlign: 'center',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
  },
  practiceButton: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
  },
  practiceButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
  },
  continueButton: {
    flex: 1,
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
  },
  continueButtonSmall: {
    flex: 1,
  },
  continueButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
  },
  finalSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.deepOnyx,
    textAlign: 'center',
    marginBottom: 16,
  },
  infoBox: {
    backgroundColor: COLORS.paperBeige,
    padding: 16,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.slateCharcoal,
    textAlign: 'center',
    marginBottom: 12,
  },
  infoTextSmall: {
    fontSize: 12,
    color: COLORS.slateCharcoal,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  attributeList: {
    alignItems: 'center',
    gap: 4,
  },
  attributeItem: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.deepOnyx,
  },
  encouragement: {
    fontSize: 14,
    color: COLORS.logicTeal,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default AttributeUnlockScreen;
