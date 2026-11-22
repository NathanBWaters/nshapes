import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import Card from './Card';
import GameBoard from './GameBoard';
import GameInfo from './GameInfo';
import { Card as CardType, AttributeName, CardReward, PlayerStats } from '@/types';
import { createDeck, findAllCombinations, generateGameBoard, shuffleArray, sameCardAttributes } from '@/utils/gameUtils';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';

interface TutorialPracticeProps {
  onComplete: () => void;
  onSkip: () => void;
}

interface TraitCheck {
  attr: AttributeName;
  label: string;
  valid: boolean;
  detail: string;
}

// Tutorial uses 3 attributes
const TUTORIAL_ATTRIBUTES: AttributeName[] = ['shape', 'color', 'number'];

const ATTR_LABELS: Record<AttributeName, string> = {
  shape: 'Shape',
  color: 'Color',
  number: 'Number',
  shading: 'Shading',
  background: 'Background',
};

const evaluateTraits = (cards: CardType[]): TraitCheck[] =>
  TUTORIAL_ATTRIBUTES.map(attr => {
    const values = cards.map(c => String(c[attr]));
    const allSame = values.every(v => v === values[0]);
    const allDiff = new Set(values).size === values.length;
    if (allSame) {
      return { attr, label: ATTR_LABELS[attr], valid: true, detail: `all ${values[0]}` };
    }
    if (allDiff) {
      return { attr, label: ATTR_LABELS[attr], valid: true, detail: 'all different' };
    }
    const counts = new Map<string, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    const breakdown = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([v, n]) => `${n} ${v}`)
      .join(' & ');
    return { attr, label: ATTR_LABELS[attr], valid: false, detail: breakdown };
  });

// Static player stats for tutorial display (uses defaults with some tweaks)
// Note: graces = 0 so invalid matches are properly caught and explained
const TUTORIAL_PLAYER_STATS: PlayerStats = {
  ...DEFAULT_PLAYER_STATS,
  health: 3,
  maxHealth: 3,
  level: 1,
  hints: 2,
  graces: 0,
};

const TutorialPractice: React.FC<TutorialPracticeProps> = ({ onComplete, onSkip }) => {
  const [board, setBoard] = useState<CardType[]>([]);
  const [deck, setDeck] = useState<CardType[]>([]);
  const [matchCount, setMatchCount] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackData, setFeedbackData] = useState<{
    isValid: boolean;
    explanation: string;
    traits: TraitCheck[];
    matchedCards: CardType[];
  } | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI state for GameInfo
  const [hasActiveHint, setHasActiveHint] = useState(false);

  // Generate initial board on mount & clean up completion timer on unmount
  useEffect(() => {
    initializeBoard();
    return () => {
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
  }, []);

  const initializeBoard = () => {
    // Use the same board generation as the real game
    const initialBoard = generateGameBoard(12, 1, 1, TUTORIAL_ATTRIBUTES);
    const fullDeck = shuffleArray(createDeck(TUTORIAL_ATTRIBUTES));
    const remainingDeck = fullDeck.filter(card =>
      !initialBoard.some(boardCard => sameCardAttributes(boardCard, card))
    );

    // Ensure at least one valid SET exists
    const validSets = findAllCombinations(initialBoard, TUTORIAL_ATTRIBUTES);
    if (validSets.length === 0) {
      // Rare case - regenerate
      initializeBoard();
      return;
    }

    setBoard(initialBoard);
    setDeck(remainingDeck);
  };

  // Handle valid match - same signature as real game
  const handleValidMatch = useCallback((matchedCards: CardType[], _rewards: CardReward[]) => {
    const traits = evaluateTraits(matchedCards);
    setFeedbackData({
      isValid: true,
      explanation: 'Great job! Every trait is either all the same or all different.',
      traits,
      matchedCards,
    });
    setShowFeedback(true);
  }, []);

  // Handle invalid match - same signature as real game
  const handleInvalidMatch = useCallback((cards: CardType[]) => {
    const traits = evaluateTraits(cards);
    const broken = traits.filter(t => !t.valid);
    const brokenText = broken.map(t => `${t.label} (${t.detail})`).join(' and ');

    const explanation =
      broken.length > 0
        ? `Not a valid SET. Check ${brokenText} — each trait must be all the same or all different.`
        : 'Not a valid SET. Each trait must be all the same or all different.';

    setFeedbackData({
      isValid: false,
      explanation,
      traits,
      matchedCards: cards,
    });
    setShowFeedback(true);
  }, []);

  const handleContinueFeedback = () => {
    const wasValid = Boolean(feedbackData?.isValid);
    const matchedCards = feedbackData?.matchedCards || [];

    setShowFeedback(false);
    setFeedbackData(null);

    // Invalid picks must NEVER count toward practice progress — let the player try again
    if (!wasValid) {
      return;
    }

    const newMatchCount = matchCount + 1;
    setMatchCount(newMatchCount);

    if (matchedCards.length > 0) {
      // Replace matched cards with new ones from deck
      const remainingBoard = board.filter(c => !matchedCards.some(m => m.id === c.id));
      const newCards = deck.slice(0, matchedCards.length);
      const newDeck = deck.slice(matchedCards.length);

      const newBoard = [...remainingBoard, ...newCards];

      // Ensure there's still a valid SET
      const validSets = findAllCombinations(newBoard, TUTORIAL_ATTRIBUTES);
      if (validSets.length === 0 && newDeck.length >= 3) {
        // Add more cards if no valid SET
        const extraCards = newDeck.slice(0, 3);
        setBoard([...newBoard, ...extraCards]);
        setDeck(newDeck.slice(3));
      } else {
        setBoard(newBoard);
        setDeck(newDeck);
      }
    }

    // Check if tutorial practice is complete (3 valid matches)
    if (newMatchCount >= 3) {
      completeTimerRef.current = setTimeout(() => onComplete(), 500);
    }
  };

  // Calculate score for display (just match count for tutorial)
  const tutorialScore = matchCount;
  const tutorialTarget = 3;

  return (
    <View style={styles.container}>
      <View style={styles.tutorialBanner}>
        <Text style={styles.tutorialTitle}>Practice Mode</Text>
        <Text style={styles.tutorialSubtitle}>Find {tutorialTarget - matchCount} more SET{tutorialTarget - matchCount !== 1 ? 's' : ''} to continue</Text>
        <View style={styles.progressContainer}>
          {[1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                styles.progressDot,
                matchCount >= i && styles.progressDotComplete,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Real Game Info Header - user learns to recognize it */}
      <View style={styles.gameInfoContainer}>
        <GameInfo
          round={1}
          score={tutorialScore}
          targetScore={tutorialTarget}
          time={60}
          totalTime={60}
          playerStats={TUTORIAL_PLAYER_STATS}
          hasActiveHint={hasActiveHint}
        />
      </View>

      {/* Real Game Board - 3x4 grid using actual component */}
      <View style={styles.boardContainer}>
        <GameBoard
          cards={board}
          onMatch={handleValidMatch}
          onInvalidSelection={handleInvalidMatch}
          playerStats={TUTORIAL_PLAYER_STATS}
          isPlayerTurn={!showFeedback}
          activeAttributes={TUTORIAL_ATTRIBUTES}
          onHintStateChange={setHasActiveHint}
        />
      </View>

      <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
        <Text style={styles.skipButtonText}>Skip Tutorial</Text>
      </TouchableOpacity>

      {/* Feedback Modal - overlays the real game */}
      <Modal
        visible={showFeedback}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[
              styles.resultBanner,
              feedbackData?.isValid ? styles.resultCorrect : styles.resultIncorrect,
            ]}>
              <Text style={styles.resultEmoji}>
                {feedbackData?.isValid ? '✓' : '✗'}
              </Text>
              <Text style={styles.resultText}>
                {feedbackData?.isValid ? "Valid SET!" : "Not a SET"}
              </Text>
            </View>

            <View style={styles.selectedCardsRow}>
              {feedbackData?.matchedCards.map(card => (
                <View key={card.id} style={styles.miniCardWrapper}>
                  <Card card={{ ...card, selected: false }} onClick={() => {}} />
                </View>
              ))}
            </View>

            <View style={styles.explanationBox}>
              {feedbackData?.traits && feedbackData.traits.length > 0 && (
                <View style={styles.traitList} testID="tutorial-trait-feedback">
                  {feedbackData.traits.map(t => (
                    <View
                      key={t.attr}
                      style={[
                        styles.traitPill,
                        t.valid ? styles.traitPillValid : styles.traitPillInvalid,
                      ]}
                    >
                      <Text style={[styles.traitPillText, t.valid ? styles.traitTextValid : styles.traitTextInvalid]}>
                        {t.valid ? '✓' : '✗'} {t.label}: {t.detail}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.explanationText}>{feedbackData?.explanation}</Text>
            </View>

            <TouchableOpacity
              testID="tutorial-feedback-continue"
              style={styles.continueButton}
              onPress={handleContinueFeedback}
            >
              <Text style={styles.continueButtonText}>
                {feedbackData?.isValid && matchCount >= 2
                  ? 'Finish Practice'
                  : feedbackData?.isValid
                    ? 'Continue'
                    : 'Try Again'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  tutorialBanner: {
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
    alignItems: 'center',
  },
  tutorialTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tutorialSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.deepOnyx,
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.slateCharcoal + '30',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  progressDotComplete: {
    backgroundColor: COLORS.logicTeal,
    borderColor: COLORS.logicTeal,
  },
  gameInfoContainer: {
    height: 70,
  },
  boardContainer: {
    flex: 1,
  },
  skipButton: {
    padding: 12,
    alignItems: 'center',
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
  },
  skipButtonText: {
    color: COLORS.slateCharcoal,
    fontSize: 14,
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    width: '100%',
    maxWidth: 350,
    overflow: 'hidden',
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  resultCorrect: {
    backgroundColor: COLORS.logicTeal,
  },
  resultIncorrect: {
    backgroundColor: COLORS.impactOrange,
  },
  resultEmoji: {
    fontSize: 24,
    color: COLORS.canvasWhite,
    fontWeight: '700',
  },
  resultText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.canvasWhite,
  },
  selectedCardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    backgroundColor: COLORS.paperBeige,
  },
  miniCardWrapper: {
    width: 70,
    height: 100,
  },
  explanationBox: {
    padding: 16,
    gap: 10,
  },
  traitList: {
    gap: 6,
  },
  traitPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.button,
    borderWidth: 1,
  },
  traitPillValid: {
    backgroundColor: '#E6F7F5',
    borderColor: COLORS.logicTeal,
  },
  traitPillInvalid: {
    backgroundColor: '#FFF3E8',
    borderColor: COLORS.impactOrange,
  },
  traitPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  traitTextValid: {
    color: '#0F766E',
  },
  traitTextInvalid: {
    color: '#C2410C',
  },
  explanationText: {
    fontSize: 14,
    color: COLORS.slateCharcoal,
    lineHeight: 22,
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: COLORS.actionYellow,
    marginHorizontal: 16,
    marginBottom: 16,
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
});

export default TutorialPractice;
