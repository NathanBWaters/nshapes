import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  CopilotProvider,
  CopilotStep,
  walkthroughable,
  useCopilot,
} from 'react-native-copilot';
import { COLORS, RADIUS } from '@/utils/colors';
import CircularTimer from './CircularTimer';
import GameBoard from './GameBoard';
import { Card as CardType, PlayerStats, AttributeName, CardReward } from '@/types';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';
import { generateGameBoard, shuffleArray, createDeck, sameCardAttributes } from '@/utils/gameUtils';

const WalkthroughableView = walkthroughable(View);

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
  mulligans: 1,
  money: 25,
  experience: 15,
};

const TUTORIAL_ATTRIBUTES: AttributeName[] = ['shape', 'color', 'number'];

// Calculate XP thresholds for level progression
const getXPForLevel = (level: number): number => {
  return level * level * 10;
};

// Inner component that uses useCopilot hook
const TourContent: React.FC<TutorialUITourProps> = ({ onComplete, onSkip }) => {
  const { start, copilotEvents } = useCopilot();
  const [board, setBoard] = React.useState<CardType[]>([]);

  // Generate a static board for display
  useEffect(() => {
    const initialBoard = generateGameBoard(12, 1, 1, TUTORIAL_ATTRIBUTES);
    setBoard(initialBoard);
  }, []);

  // Start the tour automatically
  useEffect(() => {
    const timer = setTimeout(() => {
      start();
    }, 500);
    return () => clearTimeout(timer);
  }, [start]);

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

  // Calculate XP progress
  const currentLevelXP = getXPForLevel(TOUR_PLAYER_STATS.level);
  const nextLevelXP = getXPForLevel(TOUR_PLAYER_STATS.level + 1);
  const xpInCurrentLevel = TOUR_PLAYER_STATS.experience - currentLevelXP;
  const xpNeededForNextLevel = nextLevelXP - currentLevelXP;
  const xpProgress = Math.min((xpInCurrentLevel / xpNeededForNextLevel) * 100, 100);

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

      {/* Game Header with Copilot Steps */}
      <View style={styles.headerContainer}>
        <View style={styles.statsRow}>
          {/* Round Badge */}
          <CopilotStep
            text="This shows your current round. In Adventure Mode, you'll play through 10 rounds with increasing difficulty."
            order={1}
            name="round"
          >
            <WalkthroughableView style={styles.statBadge}>
              <Text style={styles.statLabel}>R1</Text>
            </WalkthroughableView>
          </CopilotStep>

          {/* Health */}
          <CopilotStep
            text="Your health! Invalid SET matches cost 1 heart. If you run out, it's game over. Protect your health!"
            order={2}
            name="health"
          >
            <WalkthroughableView style={styles.statItem}>
              <Text style={styles.heartIcon}>♥</Text>
              <Text style={styles.statValue}>
                {TOUR_PLAYER_STATS.health}/{TOUR_PLAYER_STATS.maxHealth}
              </Text>
            </WalkthroughableView>
          </CopilotStep>

          {/* Money */}
          <CopilotStep
            text="Gold coins! Earn money by matching cards. Spend it in the shop between rounds to buy powerful weapons."
            order={3}
            name="money"
          >
            <WalkthroughableView style={styles.statItem}>
              <Text style={styles.coinIcon}>$</Text>
              <Text style={styles.statValue}>{TOUR_PLAYER_STATS.money}</Text>
            </WalkthroughableView>
          </CopilotStep>

          {/* Level + XP */}
          <CopilotStep
            text="Your level and XP bar. Earn experience with each match. Level up to choose a free weapon reward!"
            order={4}
            name="level"
          >
            <WalkthroughableView style={styles.levelContainer}>
              <Text style={styles.levelText}>Lv{TOUR_PLAYER_STATS.level}</Text>
              <View style={styles.xpBarContainer}>
                <View style={[styles.xpBarFill, { width: `${xpProgress}%` }]} />
              </View>
            </WalkthroughableView>
          </CopilotStep>

          {/* Mulligans */}
          <CopilotStep
            text="Mulligans auto-save you! When you make an invalid match, a mulligan is used instead of losing health."
            order={5}
            name="mulligans"
          >
            <WalkthroughableView style={styles.mulliganBadge}>
              <Text style={styles.mulliganIcon}>↺</Text>
              <Text style={styles.mulliganCount}>{TOUR_PLAYER_STATS.mulligans}</Text>
            </WalkthroughableView>
          </CopilotStep>

          {/* Hints */}
          <CopilotStep
            text="Stuck? Tap this to use a hint! It will highlight a valid SET on the board. Use them wisely!"
            order={6}
            name="hints"
          >
            <WalkthroughableView style={styles.hintButton}>
              <Text style={styles.hintIcon}>?</Text>
              <Text style={styles.hintCount}>{TOUR_PLAYER_STATS.hints}</Text>
            </WalkthroughableView>
          </CopilotStep>

          {/* Selected Count */}
          <CopilotStep
            text="Shows how many cards you've selected. Select 3 cards to check if they form a valid SET."
            order={7}
            name="selected"
          >
            <WalkthroughableView style={styles.selectedBadge}>
              <Text style={styles.selectedText}>0/3</Text>
            </WalkthroughableView>
          </CopilotStep>

          {/* Timer */}
          <CopilotStep
            text="The countdown timer! Reach the score target before time runs out to complete the round."
            order={8}
            name="timer"
          >
            <WalkthroughableView>
              <CircularTimer
                currentTime={45}
                totalTime={60}
                size={40}
                strokeWidth={3}
              />
            </WalkthroughableView>
          </CopilotStep>
        </View>

        {/* Score Bar */}
        <CopilotStep
          text="Your score progress! Fill this bar to reach the target and complete the round. Each valid SET adds to your score."
          order={9}
          name="score"
        >
          <WalkthroughableView style={styles.scoreRow}>
            <View style={styles.scoreBarContainer}>
              <View style={[styles.scoreBarFill, { width: '40%' }]} />
            </View>
            <Text style={styles.scoreText}>2/5</Text>
          </WalkthroughableView>
        </CopilotStep>
      </View>

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
  headerContainer: {
    backgroundColor: COLORS.canvasWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statBadge: {
    backgroundColor: COLORS.slateCharcoal,
    borderRadius: RADIUS.button,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statLabel: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  heartIcon: {
    color: COLORS.impactRed,
    fontSize: 14,
  },
  coinIcon: {
    color: COLORS.actionYellow,
    fontSize: 14,
    fontWeight: '700',
  },
  statValue: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 12,
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  levelText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 11,
  },
  xpBarContainer: {
    width: 40,
    height: 6,
    backgroundColor: COLORS.slateCharcoal + '30',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: COLORS.logicTeal,
  },
  mulliganBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.impactOrange + '30',
    borderRadius: RADIUS.button,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 2,
  },
  mulliganIcon: {
    color: COLORS.impactOrange,
    fontSize: 12,
    fontWeight: '700',
  },
  mulliganCount: {
    color: COLORS.impactOrange,
    fontWeight: '700',
    fontSize: 11,
  },
  hintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.logicTeal,
    borderRadius: RADIUS.button,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  hintIcon: {
    color: COLORS.canvasWhite,
    fontSize: 12,
    fontWeight: '700',
  },
  hintCount: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 11,
  },
  selectedBadge: {
    backgroundColor: COLORS.slateCharcoal + '20',
    borderRadius: RADIUS.button,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  selectedText: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 11,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  scoreBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.slateCharcoal + '20',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    backgroundColor: COLORS.logicTeal,
  },
  scoreText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 12,
    minWidth: 35,
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
