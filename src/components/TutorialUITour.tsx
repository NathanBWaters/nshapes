import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
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
const WalkthroughableTouchable = walkthroughable(TouchableOpacity);

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
  const { start, copilotEvents, goToNext } = useCopilot();
  const [board, setBoard] = React.useState<CardType[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const hasStartedRef = useRef(false);
  const currentStepRef = useRef<string | null>(null);

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

  // Listen for step changes to open menu at the right time
  useEffect(() => {
    const handleStepChange = (step: { name: string; order: number } | undefined) => {
      if (!step) return;
      currentStepRef.current = step.name;
      // When we reach the menu button step, open the menu after a short delay
      if (step.name === 'menu_button') {
        setTimeout(() => {
          setIsMenuOpen(true);
          // After menu opens, advance to first menu item step
          setTimeout(() => {
            goToNext();
          }, 300);
        }, 500);
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

        {/* Menu Button */}
        <CopilotStep
          text="Tap MENU to view your stats, check the weapon guide, or exit the game. Let's open it!"
          order={10}
          name="menu_button"
        >
          <WalkthroughableView style={styles.menuButtonContainer}>
            <View style={styles.menuButton}>
              <Text style={styles.menuButtonText}>MENU</Text>
            </View>
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

      {/* Tutorial Menu Modal */}
      <Modal
        visible={isMenuOpen}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Menu Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Menu</Text>
              <View style={styles.closeButton}>
                <Text style={styles.closeButtonText}>X</Text>
              </View>
            </View>

            {/* Menu Options with Copilot Steps */}
            <View style={styles.menuOptionsContainer}>
              <CopilotStep
                text="Character Stats shows your current health, money, level, and all your equipped weapons. Check here to see how powerful you've become!"
                order={11}
                name="menu_stats"
              >
                <WalkthroughableView style={styles.menuOption}>
                  <Text style={styles.menuOptionIcon}>📊</Text>
                  <View style={styles.menuOptionTextContainer}>
                    <Text style={styles.menuOptionTitle}>Character Stats</Text>
                    <Text style={styles.menuOptionDescription}>View your current stats and abilities</Text>
                  </View>
                  <Text style={styles.menuOptionArrow}>›</Text>
                </WalkthroughableView>
              </CopilotStep>

              <CopilotStep
                text="The Weapon Guide shows all 15 weapon types and what they do. Browse this before buying weapons in the shop so you know what each one does!"
                order={12}
                name="menu_weapons"
              >
                <WalkthroughableView style={styles.menuOption}>
                  <Text style={styles.menuOptionIcon}>⚔️</Text>
                  <View style={styles.menuOptionTextContainer}>
                    <Text style={styles.menuOptionTitle}>Weapon Guide</Text>
                    <Text style={styles.menuOptionDescription}>Browse all weapons and their effects</Text>
                  </View>
                  <Text style={styles.menuOptionArrow}>›</Text>
                </WalkthroughableView>
              </CopilotStep>

              <CopilotStep
                text="Exit Game lets you return to the main menu. Your progress will be lost, so only use this when you want to start over!"
                order={13}
                name="menu_exit"
              >
                <WalkthroughableView style={[styles.menuOption, styles.exitMenuOption]}>
                  <Text style={styles.menuOptionIcon}>🚪</Text>
                  <View style={styles.menuOptionTextContainer}>
                    <Text style={[styles.menuOptionTitle, styles.exitMenuOptionTitle]}>Exit Game</Text>
                    <Text style={styles.menuOptionDescription}>Return to the main menu</Text>
                  </View>
                  <Text style={styles.menuOptionArrow}>›</Text>
                </WalkthroughableView>
              </CopilotStep>
            </View>

            {/* Close Button */}
            <TouchableOpacity style={styles.closeModalButton}>
              <Text style={styles.closeModalButtonText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  // Menu button styles
  menuButtonContainer: {
    marginLeft: 'auto',
  },
  menuButton: {
    backgroundColor: COLORS.deepOnyx,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS.button,
  },
  menuButtonText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    backgroundColor: COLORS.actionYellow,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  modalTitle: {
    color: COLORS.deepOnyx,
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.deepOnyx,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 14,
  },
  menuOptionsContainer: {
    padding: 16,
    gap: 12,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.paperBeige,
    padding: 16,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    gap: 12,
  },
  menuOptionIcon: {
    fontSize: 24,
  },
  menuOptionTextContainer: {
    flex: 1,
  },
  menuOptionTitle: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 15,
  },
  menuOptionDescription: {
    color: COLORS.slateCharcoal,
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  menuOptionArrow: {
    color: COLORS.slateCharcoal,
    fontSize: 24,
    fontWeight: '300',
  },
  exitMenuOption: {
    backgroundColor: COLORS.impactRed + '15',
    borderColor: COLORS.impactRed,
  },
  exitMenuOptionTitle: {
    color: COLORS.impactRed,
  },
  closeModalButton: {
    backgroundColor: COLORS.actionYellow,
    margin: 16,
    marginTop: 0,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1,
  },
});

export default TutorialUITour;
