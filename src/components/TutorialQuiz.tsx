import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import Card from './Card';
import { Card as CardType, AttributeName } from '@/types';
import { isValidCombination } from '@/utils/gameUtils';

interface TutorialQuizProps {
  quizNumber: number;
  onCorrect: () => void;
  onIncorrect: () => void;
  onSkip: () => void;
}

// Quiz scenarios - mix of valid and invalid sets
// Using only 3 attributes: shape, color, number
const QUIZ_SCENARIOS: Array<{
  cards: CardType[];
  isValid: boolean;
  explanation: string;
  hint: string;
}> = [
  // Quiz 1: Valid SET - all different everything
  {
    cards: [
      { id: '1', shape: 'diamond', color: 'red', number: 1, shading: 'solid', background: 'white', selected: false },
      { id: '2', shape: 'squiggle', color: 'green', number: 2, shading: 'solid', background: 'white', selected: false },
      { id: '3', shape: 'oval', color: 'purple', number: 3, shading: 'solid', background: 'white', selected: false },
    ],
    isValid: true,
    explanation: "This is a valid SET! Shape: all different (diamond, squiggle, oval). Color: all different (red, green, purple). Number: all different (1, 2, 3).",
    hint: "Check each attribute - are they ALL the same or ALL different?",
  },
  // Quiz 2: Invalid SET - color has 2 same, 1 different
  {
    cards: [
      { id: '1', shape: 'diamond', color: 'red', number: 1, shading: 'solid', background: 'white', selected: false },
      { id: '2', shape: 'squiggle', color: 'red', number: 2, shading: 'solid', background: 'white', selected: false },
      { id: '3', shape: 'oval', color: 'green', number: 3, shading: 'solid', background: 'white', selected: false },
    ],
    isValid: false,
    explanation: "NOT a valid SET! Color breaks the rule: 2 red and 1 green. Remember, each attribute must be ALL the same or ALL different - not 2 and 1!",
    hint: "Look at the colors carefully...",
  },
  // Quiz 3: Valid SET - all same color, all different shape and number
  {
    cards: [
      { id: '1', shape: 'diamond', color: 'purple', number: 1, shading: 'solid', background: 'white', selected: false },
      { id: '2', shape: 'squiggle', color: 'purple', number: 2, shading: 'solid', background: 'white', selected: false },
      { id: '3', shape: 'oval', color: 'purple', number: 3, shading: 'solid', background: 'white', selected: false },
    ],
    isValid: true,
    explanation: "This is a valid SET! Shape: all different. Color: all same (purple). Number: all different. Each attribute follows the rule!",
    hint: "Same is also valid - as long as ALL THREE match!",
  },
];

const TutorialQuiz: React.FC<TutorialQuizProps> = ({
  quizNumber,
  onCorrect,
  onIncorrect,
  onSkip,
}) => {
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState(false);

  // Reset state when quiz number changes
  useEffect(() => {
    setAnswered(false);
    setSelectedAnswer(null);
    setShowHint(false);
  }, [quizNumber]);

  const scenario = QUIZ_SCENARIOS[quizNumber - 1];
  const isCorrect = selectedAnswer === scenario.isValid;

  const handleAnswer = (answer: boolean) => {
    setSelectedAnswer(answer);
    setAnswered(true);
  };

  const handleContinue = () => {
    if (isCorrect) {
      onCorrect();
    } else {
      onIncorrect();
    }
  };

  // Active attributes for validation (3 attributes for tutorial)
  const activeAttributes: AttributeName[] = ['shape', 'color', 'number'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quiz {quizNumber} of 3</Text>
        <Text style={styles.headerSubtitle}>Is this a valid SET?</Text>
      </View>

      {/* Cards Display */}
      <View style={styles.cardsContainer}>
        <View style={styles.cardsRow}>
          {scenario.cards.map(card => (
            <View key={card.id} style={styles.cardWrapper}>
              <Card card={card} onClick={() => {}} />
            </View>
          ))}
        </View>

        {/* Hint button */}
        {!answered && !showHint && (
          <TouchableOpacity style={styles.hintButton} onPress={() => setShowHint(true)}>
            <Text style={styles.hintButtonText}>Need a hint?</Text>
          </TouchableOpacity>
        )}

        {/* Hint text */}
        {showHint && !answered && (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>{scenario.hint}</Text>
          </View>
        )}
      </View>

      {/* Answer Section */}
      {!answered ? (
        <View style={styles.answerSection}>
          <Text style={styles.questionText}>Do these 3 cards form a valid SET?</Text>
          <View style={styles.answerButtons}>
            <TouchableOpacity
              style={[styles.answerButton, styles.yesButton]}
              onPress={() => handleAnswer(true)}
            >
              <Text style={styles.answerButtonText}>Yes, it's a SET!</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.answerButton, styles.noButton]}
              onPress={() => handleAnswer(false)}
            >
              <Text style={styles.answerButtonText}>No, not a SET</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.resultSection}>
          {/* Result indicator */}
          <View style={[styles.resultBanner, isCorrect ? styles.resultCorrect : styles.resultIncorrect]}>
            <Text style={styles.resultEmoji}>{isCorrect ? '✓' : '✗'}</Text>
            <Text style={styles.resultText}>
              {isCorrect ? "That's right!" : "Not quite!"}
            </Text>
          </View>

          {/* Explanation */}
          <View style={styles.explanationBox}>
            <Text style={styles.explanationText}>{scenario.explanation}</Text>
          </View>

          {/* Continue button */}
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Skip button */}
      {!answered && (
        <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipButtonText}>Skip Tutorial</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  header: {
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.deepOnyx,
    textAlign: 'center',
    marginTop: 4,
  },
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  cardWrapper: {
    width: 90,
    height: 130,
  },
  hintButton: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  hintButtonText: {
    color: COLORS.logicTeal,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  hintBox: {
    marginTop: 16,
    backgroundColor: COLORS.logicTeal + '20',
    borderRadius: RADIUS.button,
    padding: 12,
    maxWidth: 300,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.logicTeal,
  },
  hintText: {
    color: COLORS.slateCharcoal,
    fontSize: 13,
    textAlign: 'center',
  },
  answerSection: {
    padding: 16,
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
    textAlign: 'center',
    marginBottom: 16,
  },
  answerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  answerButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: RADIUS.button,
    borderWidth: 2,
    alignItems: 'center',
  },
  yesButton: {
    backgroundColor: COLORS.logicTeal + '20',
    borderColor: COLORS.logicTeal,
  },
  noButton: {
    backgroundColor: COLORS.impactRed + '20',
    borderColor: COLORS.impactRed,
  },
  answerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
  },
  resultSection: {
    padding: 16,
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.button,
    gap: 8,
    marginBottom: 16,
  },
  resultCorrect: {
    backgroundColor: COLORS.logicTeal,
  },
  resultIncorrect: {
    backgroundColor: COLORS.impactOrange,
  },
  resultEmoji: {
    fontSize: 20,
    color: COLORS.canvasWhite,
    fontWeight: '700',
  },
  resultText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.canvasWhite,
  },
  explanationBox: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.module,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  explanationText: {
    fontSize: 14,
    color: COLORS.slateCharcoal,
    lineHeight: 22,
  },
  continueButton: {
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
  },
  continueButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  skipButton: {
    padding: 16,
    alignItems: 'center',
  },
  skipButtonText: {
    color: COLORS.slateCharcoal,
    fontSize: 14,
    opacity: 0.6,
  },
});

export default TutorialQuiz;
