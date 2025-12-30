import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';

const Tutorial: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text style={styles.toggleButtonText}>
          {isOpen ? 'HIDE RULES' : 'SHOW RULES'}
        </Text>
      </TouchableOpacity>

      {isOpen && (
        <ScrollView style={styles.contentContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>HOW TO PLAY NSHAPES</Text>
          </View>

          <View style={styles.content}>
            {/* Card Attributes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Card Attributes</Text>
              <Text style={styles.paragraph}>Each card has four attributes:</Text>
              <View style={styles.list}>
                <Text style={styles.listItem}>• Shape: Oval, Squiggle, or Diamond</Text>
                <Text style={styles.listItem}>• Color: Red, Green, or Purple</Text>
                <Text style={styles.listItem}>• Number: One, Two, or Three shapes</Text>
                <Text style={styles.listItem}>• Shading: Solid, Striped, or Open</Text>
              </View>
            </View>

            {/* Valid Combination */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What Makes a Valid Combination?</Text>
              <Text style={styles.paragraph}>
                A valid combination consists of three cards where each attribute is either all the same OR all different.
              </Text>
              <Text style={styles.paragraph}>
                For example, if two cards have the same shape and the third has a different shape, that's not a valid combination. All three shapes must be the same, or all three must be different.
              </Text>
            </View>

            {/* Examples */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Examples of Valid Combinations</Text>
              <View style={styles.list}>
                <Text style={styles.listItem}>• 3 red cards with different shapes, numbers, and shadings</Text>
                <Text style={styles.listItem}>• 3 cards with the same shape, same number, same shading, but different colors</Text>
                <Text style={styles.listItem}>• 3 cards where every attribute (shape, color, number, and shading) is different</Text>
              </View>
            </View>

            {/* Game Play */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Game Play</Text>
              <View style={styles.list}>
                <Text style={styles.listItem}>1. Click on three cards you believe form a valid combination</Text>
                <Text style={styles.listItem}>2. If correct, the cards will be removed and replaced</Text>
                <Text style={styles.listItem}>3. If no valid combinations exist in the visible cards, use "Add Cards" to add more</Text>
                <Text style={styles.listItem}>4. If you're stuck, use a "Hint" to highlight a valid combination</Text>
              </View>
            </View>

            {/* Scoring */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Scoring</Text>
              <Text style={styles.paragraph}>
                +1 point for each valid combination found. The game ends when no more valid combinations can be found or the deck is exhausted.
              </Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsOpen(false)}
            >
              <Text style={styles.closeButtonText}>GOT IT!</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  toggleButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    borderRadius: RADIUS.button,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  toggleButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  contentContainer: {
    marginTop: 16,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    maxHeight: 500,
  },
  header: {
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  headerTitle: {
    color: COLORS.deepOnyx,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'uppercase',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
    paddingBottom: 4,
  },
  paragraph: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  list: {
    marginLeft: 8,
  },
  listItem: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 22,
  },
  closeButton: {
    backgroundColor: COLORS.actionYellow,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    borderRadius: RADIUS.button,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  closeButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1,
  },
});

export default Tutorial;
