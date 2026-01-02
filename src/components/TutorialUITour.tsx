import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  CopilotProvider,
  useCopilot,
} from 'react-native-copilot';
import { COLORS, RADIUS } from '@/utils/colors';
import GameInfo from './GameInfo';
import GameBoard from './GameBoard';
import { Card as CardType, PlayerStats, AttributeName, CardReward } from '@/types';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';
import { generateGameBoard } from '@/utils/gameUtils';

interface TutorialUITourProps {
  onComplete: () => void;
  onSkip: () => void;
}

// Tutorial stats for display
const TOUR_PLAYER_STATS: PlayerStats = {
  ...DEFAULT_PLAYER_STATS,
  health: 3,
  maxHealth: 3,
  level: 1,
  hints: 2,
  graces: 1,
  money: 25,
  experience: 15,
};

const TUTORIAL_ATTRIBUTES: AttributeName[] = ['shape', 'color', 'number'];

// Inner component that uses useCopilot hook
const TourContent: React.FC<TutorialUITourProps> = ({ onComplete, onSkip }) => {
  const { start, copilotEvents, goToNext } = useCopilot();
  const [board, setBoard] = React.useState<CardType[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const hasStartedRef = useRef(false);

  // Generate a static board for display
  useEffect(() => {
    const initialBoard = generateGameBoard(12, 1, 1, TUTORIAL_ATTRIBUTES);
    setBoard(initialBoard);
  }, []);

  // Start the tour automatically (only once)
  useEffect(() => {
    if (hasStartedRef.current) return;

    const timer = setTimeout(() => {
      hasStartedRef.current = true;
      start();
    }, 500);
    return () => clearTimeout(timer);
  }, [start]);

  // Listen for step changes to control menu
  useEffect(() => {
    const handleStepChange = (step: { name: string; order: number } | undefined) => {
      if (!step) return;
      // When we reach the menu button step, open the menu after a delay
      if (step.name === 'menu') {
        setTimeout(() => {
          setIsMenuOpen(true);
          // Advance to first menu item step after modal opens
          setTimeout(() => {
            goToNext();
          }, 400);
        }, 800);
      }
    };
    copilotEvents.on('stepChange', handleStepChange);
    return () => {
      copilotEvents.off('stepChange', handleStepChange);
    };
  }, [copilotEvents, goToNext]);

  // Listen for tour completion
  useEffect(() => {
    const handleStop = () => {
      onComplete();
    };
    copilotEvents.on('stop', handleStop);
    return () => {
      copilotEvents.off('stop', handleStop);
    };
  }, [copilotEvents, onComplete]);

  // Dummy handlers for GameBoard (no interaction during tour)
  const handleMatch = (cards: CardType[], rewards: CardReward[]) => {};
  const handleInvalidMatch = (cards: CardType[]) => {};

  return (
    <View style={styles.container}>
      {/* Tutorial Header Banner */}
      <View style={styles.tutorialBanner}>
        <Text style={styles.tutorialTitle}>Game Interface Tour</Text>
        <Text style={styles.tutorialSubtitle}>Tap to learn each element</Text>
      </View>

      {/* Game Header - using actual GameInfo with copilotMode */}
      <GameInfo
        round={1}
        score={2}
        targetScore={5}
        time={45}
        totalTime={60}
        playerStats={TOUR_PLAYER_STATS}
        playerWeapons={[]}
        copilotMode={true}
        controlledMenuOpen={isMenuOpen}
      />

      {/* Game Board (non-interactive during tour) */}
      <View style={styles.boardContainer}>
        <GameBoard
          cards={board}
          onMatch={handleMatch}
          onInvalidSelection={handleInvalidMatch}
          playerStats={TOUR_PLAYER_STATS}
          isPlayerTurn={false}
          activeAttributes={TUTORIAL_ATTRIBUTES}
        />
      </View>

      {/* Skip button */}
      <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
        <Text style={styles.skipButtonText}>Skip Tutorial</Text>
      </TouchableOpacity>
    </View>
  );
};

// Wrapper component with CopilotProvider
const TutorialUITour: React.FC<TutorialUITourProps> = (props) => {
  return (
    <CopilotProvider
      stepNumberComponent={() => null}
      tooltipStyle={styles.tooltip}
      arrowColor={COLORS.canvasWhite}
      backdropColor="rgba(18, 18, 18, 0.85)"
      animationDuration={250}
      overlay="view"
      stopOnOutsideClick={false}
    >
      <TourContent {...props} />
    </CopilotProvider>
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
  tooltip: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
  },
});

export default TutorialUITour;
