import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { CopilotStep, walkthroughable } from 'react-native-copilot';
import { PlayerStats, Weapon } from '@/types';
import CircularTimer from './CircularTimer';
import GameMenu, { DevModeCallbacks } from './GameMenu';
import { COLORS, RADIUS } from '@/utils/colors';
import { SPACING } from '@/utils/designSystem';

const WalkthroughableView = walkthroughable(View);

// Static heart icon
interface HeartIconProps {
  style?: any;
}

function HeartIcon({ style }: HeartIconProps) {
  return <Text style={style}>♥</Text>;
}

// Static hint button - yellow when hints available, gray when empty
interface HintButtonProps {
  hintsAvailable: number;
  maxHints: number;
  hasActiveHint: boolean;
  onPress: () => void;
  disabled: boolean;
  mobileStyles?: any;
}

function HintButton({
  hintsAvailable,
  maxHints,
  hasActiveHint,
  onPress,
  disabled,
  mobileStyles = {},
}: HintButtonProps) {
  return (
    <TouchableOpacity
      style={[
        hintButtonStyles.hintButtonInner,
        mobileStyles.mobileHintButton,
        hintsAvailable > 0 ? hintButtonStyles.hintButtonEnabled : hintButtonStyles.hintButtonDisabled,
        hasActiveHint && hintButtonStyles.hintButtonActive,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[hintButtonStyles.hintIcon, mobileStyles.hintIcon]}>?</Text>
      <Text style={[
        hintButtonStyles.hintCount,
        mobileStyles.hintCount,
        hintsAvailable > 0 ? hintButtonStyles.hintCountEnabled : hintButtonStyles.hintCountDisabled
      ]}>
        {hasActiveHint ? 'x' : `${hintsAvailable}/${maxHints}`}
      </Text>
    </TouchableOpacity>
  );
}

// Styles for HintButton
const hintButtonStyles = StyleSheet.create({
  hintButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  hintButtonEnabled: {
    backgroundColor: COLORS.actionYellow,
  },
  hintButtonDisabled: {
    backgroundColor: COLORS.paperBeige,
  },
  hintButtonActive: {
    backgroundColor: COLORS.impactOrange,
  },
  hintIcon: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
  },
  hintCount: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  hintCountEnabled: {
    color: COLORS.slateCharcoal,
  },
  hintCountDisabled: {
    color: COLORS.slateCharcoal,
    opacity: 0.5,
  },
});

// Copilot step definitions for tutorial mode
const COPILOT_STEPS = {
  round: { order: 1, text: "This shows your current round. In Adventure Mode, you'll play through 10 rounds with increasing difficulty." },
  health: { order: 2, text: "Your health! Invalid SET matches cost 1 heart. If you run out, it's game over. Protect your health!" },
  money: { order: 3, text: "Gold coins! Earn money by matching cards. Spend it in the shop between rounds to buy powerful weapons." },
  level: { order: 4, text: "Your level and XP bar. Earn experience with each match. Level up to choose a free weapon reward!" },
  graces: { order: 5, text: "Graces save you from near-misses! When only 1 attribute is wrong, a grace is used instead of losing health." },
  hints: { order: 6, text: "Stuck? Tap this to use a hint! It will highlight a valid SET on the board. Earn hints from matches - your capacity shows as X/max." },
  timer: { order: 7, text: "The countdown timer! Reach the score target before time runs out to complete the round." },
  score: { order: 9, text: "Your score progress! Fill this bar to reach the target and complete the round. Each valid SET adds to your score." },
  menu: { order: 10, text: "Tap MENU to view your stats, check the weapon guide, or exit the game." },
};

interface GameInfoProps {
  round: number;
  score: number;
  targetScore: number;
  time: number;
  totalTime: number;
  playerStats: PlayerStats;
  playerWeapons?: Weapon[];
  onHintPress?: () => void;
  onClearHint?: () => void;
  hasActiveHint?: boolean;
  onExitGame?: () => void;
  devMode?: boolean;
  devCallbacks?: DevModeCallbacks;
  // Tutorial mode - when true, wraps elements with CopilotStep
  copilotMode?: boolean;
  // Controlled menu open state for tutorial
  controlledMenuOpen?: boolean;
  // Callback when menu open state changes (for pausing game)
  onMenuOpenChange?: (isOpen: boolean) => void;
}

// Calculate XP thresholds for level progression
const getXPForLevel = (level: number): number => {
  return level * level * 10; // Level 1 = 10, Level 2 = 40, Level 3 = 90, etc.
};

// Static score text
interface ScoreTextProps {
  score: number;
  targetScore: number;
  style?: any;
}

function ScoreText({ score, targetScore, style }: ScoreTextProps) {
  return (
    <Text style={style}>
      {score}/{targetScore}
    </Text>
  );
}

const GameInfo: React.FC<GameInfoProps> = ({
  round,
  score,
  targetScore,
  time,
  totalTime,
  playerStats,
  playerWeapons = [],
  onHintPress,
  onClearHint,
  hasActiveHint = false,
  onExitGame,
  devMode = false,
  devCallbacks,
  copilotMode = false,
  controlledMenuOpen,
  onMenuOpenChange,
}) => {
  // Detect mobile layout (narrow screens)
  const { width } = useWindowDimensions();
  const isMobile = width < 500 || Platform.OS !== 'web';

  // Calculate score progress percentage
  const scoreProgress = Math.min((score / targetScore) * 100, 100);

  // Calculate XP progress to next level
  const currentLevelXP = getXPForLevel(playerStats.level);
  const nextLevelXP = getXPForLevel(playerStats.level + 1);
  const xpInCurrentLevel = playerStats.experience - currentLevelXP;
  const xpNeededForNextLevel = nextLevelXP - currentLevelXP;
  const xpProgress = Math.min((xpInCurrentLevel / xpNeededForNextLevel) * 100, 100);

  const hintsAvailable = playerStats.hints ?? 0;
  const maxHints = playerStats.maxHints ?? 3;

  // Helper to wrap elements with CopilotStep when in tutorial mode
  const withCopilot = (
    name: keyof typeof COPILOT_STEPS,
    children: ReactNode,
    style?: any
  ) => {
    if (!copilotMode) {
      return <View style={style}>{children}</View>;
    }
    const step = COPILOT_STEPS[name];
    return (
      <CopilotStep text={step.text} order={step.order} name={name}>
        <WalkthroughableView style={style}>{children}</WalkthroughableView>
      </CopilotStep>
    );
  };

  // Mobile layout uses larger fonts and 2-row organization
  const mobileStyles = isMobile ? {
    statLabel: { fontSize: 14 },
    statValue: { fontSize: 14 },
    heartIcon: { fontSize: 14 },
    coinIcon: { fontSize: 14 },
    levelText: { fontSize: 14 },
    hintIcon: { fontSize: 14 },
    hintCount: { fontSize: 14 },
    graceIcon: { fontSize: 14 },
    graceCount: { fontSize: 14 },
    scoreText: { fontSize: 13 },
  } : {};

  return (
    <View style={styles.container}>
      {isMobile ? (
        // Mobile: 2-row layout
        <>
          {/* Row 1: Health, Timer, Score progress */}
          <View style={styles.mobileRow}>
            {/* Health */}
            {withCopilot('health',
              <>
                <HeartIcon style={[styles.heartIcon, mobileStyles.heartIcon]} />
                <Text style={[styles.statValue, mobileStyles.statValue, playerStats.health <= 1 && styles.criticalValue]}>
                  {playerStats.health}/{playerStats.maxHealth}
                </Text>
              </>,
              styles.statItem
            )}

            {/* Timer - centered */}
            {withCopilot('timer',
              <CircularTimer
                currentTime={time}
                totalTime={totalTime}
                size={44}
                strokeWidth={3}
              />,
              undefined
            )}

            {/* Score progress */}
            {withCopilot('score',
              <>
                <View style={styles.mobileScoreBar}>
                  <View
                    style={[
                      styles.scoreBarFill,
                      { width: `${scoreProgress}%` },
                      scoreProgress >= 100 && styles.scoreBarComplete,
                    ]}
                  />
                </View>
                <ScoreText score={score} targetScore={targetScore} style={[styles.scoreText, mobileStyles.scoreText]} />
              </>,
              styles.mobileScoreContainer
            )}

            {/* Menu Button */}
            <GameMenu
              playerStats={playerStats}
              playerWeapons={playerWeapons}
              onExitGame={onExitGame}
              devMode={devMode}
              devCallbacks={devCallbacks}
              copilotMode={copilotMode}
              controlledOpen={controlledMenuOpen}
              onMenuOpenChange={onMenuOpenChange}
            />
          </View>

          {/* Row 2: Round, Money, Level, Graces, Hints */}
          <View style={styles.mobileRow}>
            {/* Round */}
            {withCopilot('round',
              <Text style={[styles.statLabel, mobileStyles.statLabel]}>R{round}</Text>,
              styles.statBadge
            )}

            {/* Money */}
            {withCopilot('money',
              <>
                <Text style={[styles.coinIcon, mobileStyles.coinIcon]}>$</Text>
                <Text style={[styles.statValue, mobileStyles.statValue]}>{playerStats.money}</Text>
              </>,
              styles.statItem
            )}

            {/* Level + XP Progress */}
            {withCopilot('level',
              <>
                <Text style={[styles.levelText, mobileStyles.levelText]}>Lv{playerStats.level}</Text>
                <View style={styles.xpBarContainer}>
                  <View style={[styles.xpBarFill, { width: `${xpProgress}%` }]} />
                </View>
              </>,
              styles.levelContainer
            )}

            {/* Graces */}
            {((playerStats.graces ?? 0) > 0 || copilotMode) &&
              withCopilot('graces',
                <>
                  <Text style={[styles.graceIcon, mobileStyles.graceIcon]}>🍀</Text>
                  <Text style={[styles.graceCount, mobileStyles.graceCount]}>{playerStats.graces ?? 0}</Text>
                </>,
                styles.graceBadge
              )
            }

            {/* Hints */}
            {withCopilot('hints',
              <HintButton
                hintsAvailable={hintsAvailable}
                maxHints={maxHints}
                hasActiveHint={hasActiveHint}
                onPress={hasActiveHint ? (onClearHint ?? (() => {})) : (onHintPress ?? (() => {}))}
                disabled={copilotMode || (hintsAvailable <= 0 && !hasActiveHint)}
                mobileStyles={{ mobileHintButton: styles.mobileHintButton, hintIcon: mobileStyles.hintIcon, hintCount: mobileStyles.hintCount }}
              />,
              undefined
            )}
          </View>
        </>
      ) : (
        // Desktop: Single row layout
        <>
          <View style={styles.statsRow}>
            <View style={styles.leftSection}>
              {/* Round */}
              {withCopilot('round',
                <Text style={styles.statLabel}>R{round}</Text>,
                styles.statBadge
              )}

              {/* Health */}
              {withCopilot('health',
                <>
                  <HeartIcon style={styles.heartIcon} />
                  <Text style={[styles.statValue, playerStats.health <= 1 && styles.criticalValue]}>
                    {playerStats.health}/{playerStats.maxHealth}
                  </Text>
                </>,
                styles.statItem
              )}

              {/* Money */}
              {withCopilot('money',
                <>
                  <Text style={styles.coinIcon}>$</Text>
                  <Text style={styles.statValue}>{playerStats.money}</Text>
                </>,
                styles.statItem
              )}

              {/* Level + XP Progress */}
              {withCopilot('level',
                <>
                  <Text style={styles.levelText}>Lv{playerStats.level}</Text>
                  <View style={styles.xpBarContainer}>
                    <View style={[styles.xpBarFill, { width: `${xpProgress}%` }]} />
                  </View>
                </>,
                styles.levelContainer
              )}

              {/* Graces */}
              {((playerStats.graces ?? 0) > 0 || copilotMode) &&
                withCopilot('graces',
                  <>
                    <Text style={styles.graceIcon}>🍀</Text>
                    <Text style={styles.graceCount}>{playerStats.graces ?? 0}</Text>
                  </>,
                  styles.graceBadge
                )
              }

              {/* Hints */}
              {withCopilot('hints',
                <HintButton
                  hintsAvailable={hintsAvailable}
                  maxHints={maxHints}
                  hasActiveHint={hasActiveHint}
                  onPress={hasActiveHint ? (onClearHint ?? (() => {})) : (onHintPress ?? (() => {}))}
                  disabled={copilotMode || (hintsAvailable <= 0 && !hasActiveHint)}
                />,
                undefined
              )}

              {/* Timer */}
              {withCopilot('timer',
                <CircularTimer
                  currentTime={time}
                  totalTime={totalTime}
                  size={40}
                  strokeWidth={3}
                />,
                undefined
              )}

              {/* Menu Button */}
              <GameMenu
                playerStats={playerStats}
                playerWeapons={playerWeapons}
                onExitGame={onExitGame}
                devMode={devMode}
                devCallbacks={devCallbacks}
                copilotMode={copilotMode}
                controlledOpen={controlledMenuOpen}
                onMenuOpenChange={onMenuOpenChange}
              />
            </View>
          </View>

          {/* Bottom row: Score progress bar */}
          {withCopilot('score',
            <>
              <View style={styles.scoreBarContainer}>
                <View
                  style={[
                    styles.scoreBarFill,
                    { width: `${scoreProgress}%` },
                    scoreProgress >= 100 && styles.scoreBarComplete,
                  ]}
                />
              </View>
              <ScoreText score={score} targetScore={targetScore} style={styles.scoreText} />
            </>,
            styles.scoreRow
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    backgroundColor: COLORS.canvasWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
    paddingHorizontal: 8,
  },
  // Mobile 2-row layout
  mobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: SPACING.sm,
  },
  mobileScoreContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  mobileScoreBar: {
    flex: 1,
    height: 10,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  mobileHintButton: {
    minWidth: 48,
    minHeight: 36,
    justifyContent: 'center',
  },
  // Desktop single-row layout
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statBadge: {
    backgroundColor: COLORS.deepOnyx,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  statLabel: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.paperBeige,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  heartIcon: {
    color: COLORS.impactRed,
    fontSize: 12,
  },
  coinIcon: {
    color: COLORS.actionYellow,
    fontSize: 12,
    fontWeight: '700',
  },
  statValue: {
    color: COLORS.slateCharcoal,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  criticalValue: {
    color: COLORS.impactRed,
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.paperBeige,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  levelText: {
    color: COLORS.logicTeal,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  xpBarContainer: {
    width: 32,
    height: 6,
    backgroundColor: COLORS.paperBeige,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: COLORS.logicTeal,
    borderRadius: 3,
  },
  graceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.logicTeal,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  graceIcon: {
    color: COLORS.canvasWhite,
    fontSize: 12,
    fontWeight: '700',
  },
  graceCount: {
    color: COLORS.canvasWhite,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  hintButtonEnabled: {
    backgroundColor: COLORS.actionYellow,
  },
  hintButtonDisabled: {
    backgroundColor: COLORS.paperBeige,
  },
  hintButtonActive: {
    backgroundColor: COLORS.impactOrange,
  },
  hintIcon: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
  },
  hintCount: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  hintCountEnabled: {
    color: COLORS.slateCharcoal,
  },
  hintCountDisabled: {
    color: COLORS.slateCharcoal,
    opacity: 0.5,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  scoreBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  scoreBarFill: {
    height: '100%',
    backgroundColor: COLORS.logicTeal,
    borderRadius: RADIUS.button,
  },
  scoreBarComplete: {
    backgroundColor: COLORS.actionYellow,
  },
  scoreText: {
    color: COLORS.slateCharcoal,
    fontSize: 11,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
    fontFamily: 'monospace',
  },
});

export default GameInfo;
