import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import { useTutorial, TutorialStep } from '@/context/TutorialContext';
import TutorialQuiz from './TutorialQuiz';
import TutorialPractice from './TutorialPractice';
import TutorialUITour from './TutorialUITour';
import Card from './Card';
import { Card as CardType } from '@/types';

interface TutorialScreenProps {
  onComplete: () => void;
  onExit: () => void;
}

// Sample cards for introduction
const SAMPLE_CARDS: CardType[] = [
  { id: '1', shape: 'diamond', color: 'red', number: 1, shading: 'solid', background: 'white', selected: false },
  { id: '2', shape: 'squiggle', color: 'green', number: 2, shading: 'striped', background: 'white', selected: false },
  { id: '3', shape: 'oval', color: 'purple', number: 3, shading: 'open', background: 'white', selected: false },
];

const TutorialScreen: React.FC<TutorialScreenProps> = ({ onComplete, onExit }) => {
  const { state, nextStep, setStep, endTutorial } = useTutorial();

  const handleSkip = () => {
    endTutorial(false);
    onExit();
  };

  const handleComplete = () => {
    endTutorial(true);
    onComplete();
  };

  const renderIntro = () => (
    <View style={styles.contentContainer}>
      <View style={styles.headerSection}>
        <Text style={styles.title}>Welcome to NShapes!</Text>
        <Text style={styles.subtitle}>Learn how to find valid SETs</Text>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>The Basics</Text>
          <Text style={styles.paragraph}>
            In NShapes, your goal is to find groups of 3 cards that form a valid SET.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Card Attributes</Text>
          <Text style={styles.paragraph}>
            Each card has multiple attributes:
          </Text>
          <View style={styles.attributeList}>
            <View style={styles.attributeItem}>
              <Text style={styles.attributeLabel}>Shape</Text>
              <Text style={styles.attributeValue}>Diamond, Squiggle, or Oval</Text>
            </View>
            <View style={styles.attributeItem}>
              <Text style={styles.attributeLabel}>Color</Text>
              <Text style={styles.attributeValue}>Red, Green, or Purple</Text>
            </View>
            <View style={styles.attributeItem}>
              <Text style={styles.attributeLabel}>Number</Text>
              <Text style={styles.attributeValue}>1, 2, or 3</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Example Cards</Text>
          <View style={styles.cardRow}>
            {SAMPLE_CARDS.map(card => (
              <View key={card.id} style={styles.cardWrapper}>
                <Card card={card} onClick={() => {}} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>The Golden Rule</Text>
          <View style={styles.ruleBox}>
            <Text style={styles.ruleText}>
              For each attribute, all 3 cards must be either{'\n'}
              <Text style={styles.ruleBold}>ALL THE SAME</Text> or <Text style={styles.ruleBold}>ALL DIFFERENT</Text>
            </Text>
          </View>
          <Text style={styles.paragraph}>
            If even one attribute has 2 cards the same and 1 different, it's NOT a valid SET!
          </Text>
        </View>
      </ScrollView>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip Tutorial</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextButton} onPress={nextStep}>
          <Text style={styles.nextButtonText}>Let's Practice!</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderQuiz = (quizNumber: number) => (
    <TutorialQuiz
      quizNumber={quizNumber}
      onCorrect={() => {
        nextStep();
      }}
      onIncorrect={() => {
        // Still advance after explanation
        nextStep();
      }}
      onSkip={handleSkip}
    />
  );

  const renderComplexity = () => (
    <View style={styles.contentContainer}>
      <View style={styles.headerSection}>
        <Text style={styles.title}>Increasing Complexity</Text>
        <Text style={styles.subtitle}>The game gets harder as you progress</Text>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.section}>
          <Text style={styles.paragraph}>
            In Adventure Mode, the game starts simple but adds more attributes as you advance:
          </Text>
        </View>

        <View style={styles.progressionContainer}>
          <View style={styles.progressionItem}>
            <View style={[styles.progressionBadge, { backgroundColor: COLORS.logicTeal }]}>
              <Text style={styles.progressionBadgeText}>Rounds 1-3</Text>
            </View>
            <Text style={styles.progressionTitle}>3 Attributes</Text>
            <Text style={styles.progressionDesc}>Shape, Color, Number</Text>
          </View>

          <View style={styles.progressionArrow}>
            <Text style={styles.progressionArrowText}>+</Text>
          </View>

          <View style={styles.progressionItem}>
            <View style={[styles.progressionBadge, { backgroundColor: COLORS.impactOrange }]}>
              <Text style={styles.progressionBadgeText}>Rounds 4-9</Text>
            </View>
            <Text style={styles.progressionTitle}>4 Attributes</Text>
            <Text style={styles.progressionDesc}>+ Shading</Text>
            <Text style={styles.progressionHint}>(Solid, Striped, Open)</Text>
          </View>

          <View style={styles.progressionArrow}>
            <Text style={styles.progressionArrowText}>+</Text>
          </View>

          <View style={styles.progressionItem}>
            <View style={[styles.progressionBadge, { backgroundColor: COLORS.impactRed }]}>
              <Text style={styles.progressionBadgeText}>Round 10</Text>
            </View>
            <Text style={styles.progressionTitle}>5 Attributes</Text>
            <Text style={styles.progressionDesc}>+ Background</Text>
            <Text style={styles.progressionHint}>(Card color varies)</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>Pro Tip</Text>
            <Text style={styles.tipText}>
              Start with Free Play on Easy (2 attributes) to practice the core mechanic before tackling Adventure Mode!
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextButton} onPress={nextStep}>
          <Text style={styles.nextButtonText}>Try It Out!</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPractice = () => (
    <TutorialPractice
      onComplete={() => nextStep()}
      onSkip={handleSkip}
    />
  );

  const renderUITour = () => (
    <TutorialUITour
      onComplete={() => nextStep()}
      onSkip={handleSkip}
    />
  );

  const renderComplete = () => (
    <View style={styles.contentContainer}>
      <View style={styles.completeSection}>
        <Text style={styles.completeEmoji}>🎉</Text>
        <Text style={styles.completeTitle}>You're Ready!</Text>
        <Text style={styles.completeSubtitle}>
          You've learned the basics of NShapes
        </Text>

        <View style={styles.completeSummary}>
          <Text style={styles.summaryItem}>✓ Find 3-card SETs</Text>
          <Text style={styles.summaryItem}>✓ All same OR all different per attribute</Text>
          <Text style={styles.summaryItem}>✓ Complexity increases each round</Text>
          <Text style={styles.summaryItem}>✓ Use hints when stuck</Text>
          <Text style={styles.summaryItem}>✓ Check the Weapon Guide in the menu</Text>
        </View>

        <TouchableOpacity style={styles.completeButton} onPress={handleComplete}>
          <Text style={styles.completeButtonText}>Start Playing!</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderContent = () => {
    switch (state.currentStep) {
      case 'intro':
        return renderIntro();
      case 'quiz_1':
        return renderQuiz(1);
      case 'quiz_2':
        return renderQuiz(2);
      case 'quiz_3':
        return renderQuiz(3);
      case 'complexity':
        return renderComplexity();
      case 'practice':
        return renderPractice();
      case 'ui_tour':
        return renderUITour();
      case 'complete':
        return renderComplete();
      default:
        return renderIntro();
    }
  };

  // Calculate progress
  const steps: TutorialStep[] = ['intro', 'quiz_1', 'quiz_2', 'quiz_3', 'complexity', 'practice', 'ui_tour', 'complete'];
  const currentIndex = steps.indexOf(state.currentStep);
  const progress = ((currentIndex + 1) / steps.length) * 100;

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.slateCharcoal + '30',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.logicTeal,
  },
  contentContainer: {
    flex: 1,
  },
  headerSection: {
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.deepOnyx,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.slateCharcoal,
    textAlign: 'center',
    marginTop: 4,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  paragraph: {
    fontSize: 14,
    color: COLORS.slateCharcoal,
    lineHeight: 22,
  },
  attributeList: {
    marginTop: 12,
    gap: 8,
  },
  attributeItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.button,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  attributeLabel: {
    flex: 1,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    fontSize: 13,
  },
  attributeValue: {
    flex: 2,
    color: COLORS.slateCharcoal,
    fontSize: 13,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  cardWrapper: {
    width: 80,
    height: 110,
  },
  ruleBox: {
    backgroundColor: COLORS.logicTeal,
    borderRadius: RADIUS.module,
    padding: 16,
    marginTop: 8,
  },
  ruleText: {
    color: COLORS.canvasWhite,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  ruleBold: {
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
  },
  skipButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 14,
  },
  nextButton: {
    flex: 2,
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
  },
  nextButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Complexity styles
  progressionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    gap: 8,
  },
  progressionItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  progressionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    marginBottom: 8,
  },
  progressionBadgeText: {
    color: COLORS.canvasWhite,
    fontSize: 10,
    fontWeight: '700',
  },
  progressionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
  },
  progressionDesc: {
    fontSize: 11,
    color: COLORS.slateCharcoal,
    marginTop: 4,
  },
  progressionHint: {
    fontSize: 9,
    color: COLORS.slateCharcoal,
    opacity: 0.7,
    marginTop: 2,
  },
  progressionArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.slateCharcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressionArrowText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 16,
  },
  tipBox: {
    backgroundColor: COLORS.logicTeal + '20',
    borderRadius: RADIUS.module,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.logicTeal,
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.logicTeal,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  tipText: {
    fontSize: 13,
    color: COLORS.slateCharcoal,
    lineHeight: 20,
  },
  // UI Tour styles
  uiSection: {
    gap: 12,
  },
  uiItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    gap: 12,
  },
  uiIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uiIconText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 16,
  },
  uiContent: {
    flex: 1,
  },
  uiTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
  },
  uiDesc: {
    fontSize: 12,
    color: COLORS.slateCharcoal,
    opacity: 0.8,
    marginTop: 2,
  },
  // Complete styles
  completeSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  completeEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  completeTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
  },
  completeSubtitle: {
    fontSize: 16,
    color: COLORS.slateCharcoal,
    opacity: 0.8,
    marginTop: 8,
  },
  completeSummary: {
    marginTop: 32,
    alignItems: 'flex-start',
    gap: 12,
  },
  summaryItem: {
    fontSize: 16,
    color: COLORS.slateCharcoal,
  },
  completeButton: {
    marginTop: 40,
    backgroundColor: COLORS.logicTeal,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  completeButtonText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 18,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default TutorialScreen;
