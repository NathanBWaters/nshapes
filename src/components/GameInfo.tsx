import React, { ReactNode, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform, Animated } from 'react-native';
import { CopilotStep, walkthroughable } from 'react-native-copilot';
import { PlayerStats, Weapon } from '@/types';
import CircularTimer from './CircularTimer';
import GameMenu, { DevModeCallbacks } from './GameMenu';
import { COLORS, RADIUS } from '@/utils/colors';
import { SPACING } from '@/utils/designSystem';

const WalkthroughableView = walkthroughable(View);

// Animated heart icon with heartbeat effect
interface HeartBeatProps {
  health: number;
  maxHealth: number;
  style?: any;
}

function HeartBeat({ health, maxHealth, style }: HeartBeatProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Calculate heartbeat speed based on health ratio
    const healthRatio = health / maxHealth;
    let duration: number;
    let scale: number;

    if (healthRatio <= 0.25) {
      // Critical: rapid heartbeat
      duration = 300;
      scale = 1.15;
    } else if (healthRatio <= 0.5) {
      // Low: medium heartbeat
      duration = 500;
      scale = 1.1;
    } else {
      // Normal: gentle heartbeat
      duration = 1000;
      scale = 1.05;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: scale,
          duration: duration * 0.3,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: duration * 0.7,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();
    return () => pulse.stop();
  }, [health, maxHealth, scaleAnim]);

  return (
    <Animated.Text
      style={[
        style,
        {
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      ♥
    </Animated.Text>
  );
}

// Animated hint button with floating effect when hints are available
interface AnimatedHintButtonProps {
  hintsAvailable: number;
  maxHints: number;
  hasActiveHint: boolean;
  onPress: () => void;
  disabled: boolean;
  mobileStyles?: any;
}

function AnimatedHintButton({
  hintsAvailable,
  maxHints,
  hasActiveHint,
  onPress,
  disabled,
  mobileStyles = {},
}: AnimatedHintButtonProps) {
  const floatY = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hintsAvailable > 0 && !hasActiveHint) {
      // Float animation when hints available
      const float = Animated.loop(
        Animated.sequence([
          Animated.timing(floatY, {
            toValue: -3,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(floatY, {
            toValue: 3,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );

      // Glow pulse
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: 0.6,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.2,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );

      float.start();
      glow.start();

      return () => {
        float.stop();
        glow.stop();
      };
    } else {
      floatY.setValue(0);
      glowOpacity.setValue(0);
    }
  }, [hintsAvailable, hasActiveHint, floatY, glowOpacity]);

  return (
    <Animated.View
      style={{
        transform: [{ translateY: floatY }],
      }}
    >
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
        <Animated.View
          style={[
            hintButtonStyles.glowOverlay,
            { opacity: glowOpacity },
          ]}
        />
        <Text style={[hintButtonStyles.hintIcon, mobileStyles.hintIcon]}>?</Text>
        <Text style={[
          hintButtonStyles.hintCount,
          mobileStyles.hintCount,
          hintsAvailable > 0 ? hintButtonStyles.hintCountEnabled : hintButtonStyles.hintCountDisabled
        ]}>
          {hasActiveHint ? 'x' : `${hintsAvailable}/${maxHints}`}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Styles for AnimatedHintButton (reusing from main styles where possible)
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
    position: 'relative',
    overflow: 'hidden',
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
    zIndex: 1,
  },
  hintCount: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
    zIndex: 1,
  },
  hintCountEnabled: {
    color: COLORS.slateCharcoal,
  },
  hintCountDisabled: {
    color: COLORS.slateCharcoal,
    opacity: 0.5,
  },
  glowOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.button,
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

// Animated score text that pulses when score is high
interface AnimatedScoreTextProps {
  score: number;
  targetScore: number;
  style?: any;
}

function AnimatedScoreText({ score, targetScore, style }: AnimatedScoreTextProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Only pulse when score is above 50% of target
    const scoreRatio = score / targetScore;
    if (scoreRatio > 0.5) {
      // Intensity based on score ratio
      const intensity = Math.min((scoreRatio - 0.5) * 0.06, 0.03); // Max 3% scale
      const duration = 1500 - (scoreRatio * 500); // Faster as score increases (1000-1500ms)

      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1 + intensity,
            duration: duration * 0.4,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: duration * 0.6,
            useNativeDriver: true,
          }),
        ])
      );

      pulse.start();
      return () => pulse.stop();
    } else {
      scaleAnim.setValue(1);
    }
  }, [score, targetScore, scaleAnim]);

  return (
    <Animated.Text
      style={[
        style,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      {score}/{targetScore}
    </Animated.Text>
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
                <HeartBeat
                health={playerStats.health}
                maxHealth={playerStats.maxHealth}
                style={[styles.heartIcon, mobileStyles.heartIcon]}
              />
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
                <AnimatedScoreText score={score} targetScore={targetScore} style={[styles.scoreText, mobileStyles.scoreText]} />
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
              <AnimatedHintButton
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
                  <HeartBeat
                    health={playerStats.health}
                    maxHealth={playerStats.maxHealth}
                    style={styles.heartIcon}
                  />
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
                <View style={styles.hintContainer}>
                  <AnimatedHintButton
                    hintsAvailable={hintsAvailable}
                    maxHints={maxHints}
                    hasActiveHint={hasActiveHint}
                    onPress={hasActiveHint ? (onClearHint ?? (() => {})) : (onHintPress ?? (() => {}))}
                    disabled={copilotMode || (hintsAvailable <= 0 && !hasActiveHint)}
                  />
                  {/* Keyboard shortcut hint - web only */}
                  {Platform.OS === 'web' && hintsAvailable > 0 && !hasActiveHint && (
                    <Text style={styles.keyboardHint}>H</Text>
                  )}
                </View>,
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
              <AnimatedScoreText score={score} targetScore={targetScore} style={styles.scoreText} />
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
  hintContainer: {
    flexDirection: 'column',
    alignItems: 'center',
  },
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
  keyboardHint: {
    fontSize: 9,
    color: COLORS.slateCharcoal,
    opacity: 0.5,
    marginTop: 2,
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
