import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { CopilotStep, walkthroughable } from 'react-native-copilot';
import { Character, PlayerStats, Weapon } from '@/types';
import CircularTimer from './CircularTimer';
import GameMenu, { CopilotControl, DevModeCallbacks } from './GameMenu';
import { FighterAvatar } from './fighters';
import { FighterAmbientMood, FighterReactionEvent } from '@/utils/fighterAnimations';
import { COLORS, RADIUS } from '@/utils/colors';
import { getAdjustedXPForLevel } from '@/utils/gameConfig';

const WalkthroughableView = walkthroughable(View);

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

const hintButtonStyles = StyleSheet.create({
  hintButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: RADIUS.button,
    gap: 1,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    flexShrink: 0,
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
  character?: Character;
  fighterMood?: FighterAmbientMood;
  fighterReaction?: FighterReactionEvent | null;
  fighterStreak?: number;
  onHintPress?: () => void;
  onClearHint?: () => void;
  hasActiveHint?: boolean;
  onExitGame?: () => void;
  onEndRoundEarly?: () => void;  // Callback when player ends round early (only available when target met)
  canEndRoundEarly?: boolean;    // True when score target has been met
  /** Dev tools in the menu (only given in dev mode) */
  devCallbacks?: DevModeCallbacks;
  /** Tutorial tour: wraps elements in CopilotSteps and lets the tour open/close the menu */
  copilot?: CopilotControl;
  // Callback when menu open state changes (for pausing game)
  onMenuOpenChange?: (isOpen: boolean) => void;
}

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
  character,
  fighterMood = 'idle',
  fighterReaction = null,
  fighterStreak = 0,
  onHintPress,
  onClearHint,
  hasActiveHint = false,
  onExitGame,
  onEndRoundEarly,
  canEndRoundEarly = false,
  devCallbacks,
  copilot,
  onMenuOpenChange,
}) => {
  const copilotMode = copilot !== undefined;
  const { width: screenWidth } = useWindowDimensions();
  const isCompactHud = Boolean(character) && screenWidth < 430;
  const scoreProgress = Math.min((score / targetScore) * 100, 100);

  // Calculate XP progress to next level
  const currentLevelXP = getAdjustedXPForLevel(playerStats.level);
  const nextLevelXP = getAdjustedXPForLevel(playerStats.level + 1);
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

  return (
    // IMPORTANT: Top bar must always be 1 row on all screen sizes (including mobile)
    <View
      style={[
        styles.container,
        character && styles.containerWithFighter,
        isCompactHud && styles.containerCompact,
      ]}
    >
      {character && (
        <FighterAvatar
          character={character}
          size={isCompactHud ? 38 : 46}
          health={playerStats.health}
          maxHealth={playerStats.maxHealth}
          mood={fighterMood}
          reaction={fighterReaction}
          streak={fighterStreak}
          framed
          interactive
          testID="hud-fighter-avatar"
        />
      )}

      <View style={styles.hudContentColumn}>
        {/* Single row layout for all screen sizes */}
        <View style={styles.statsRow}>
          <View style={[styles.leftSection, isCompactHud && styles.leftSectionCompact]}>
            {withCopilot('round',
              <Text style={[styles.statLabel, isCompactHud && styles.statLabelCompact]}>R{round}</Text>,
              [styles.statBadge, isCompactHud && styles.statBadgeCompact]
            )}

            {withCopilot('health',
              <>
                <HeartIcon style={styles.heartIcon} />
                <Text style={[styles.statValue, isCompactHud && styles.statValueCompact, playerStats.health <= 1 && styles.criticalValue]}>
                  {playerStats.health}/{playerStats.maxHealth}
                </Text>
              </>,
              [styles.statItem, isCompactHud && styles.statItemCompact]
            )}

            {withCopilot('money',
              <>
                <Text style={styles.coinIcon}>$</Text>
                <Text style={[styles.statValue, isCompactHud && styles.statValueCompact]}>{playerStats.money}</Text>
              </>,
              [styles.statItem, isCompactHud && styles.statItemCompact]
            )}

            {/* Level + XP Progress */}
            {withCopilot('level',
              <>
                <Text style={[styles.levelText, isCompactHud && styles.statValueCompact]}>Lv{playerStats.level}</Text>
                <View style={[styles.xpBarContainer, isCompactHud && styles.xpBarCompact]}>
                  <View style={[styles.xpBarFill, { width: `${xpProgress}%` }]} />
                </View>
              </>,
              [styles.levelContainer, isCompactHud && styles.statItemCompact]
            )}

            {((playerStats.graces ?? 0) > 0 || copilotMode) &&
              withCopilot('graces',
                <>
                  <Text style={styles.graceIcon}>🍀</Text>
                  <Text style={[styles.graceCount, isCompactHud && styles.statValueCompact]}>{playerStats.graces ?? 0}</Text>
                </>,
                [styles.graceBadge, isCompactHud && styles.statItemCompact]
              )
            }

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

            {withCopilot('timer',
              <CircularTimer
                currentTime={time}
                totalTime={totalTime}
                size={isCompactHud ? 30 : 34}
                strokeWidth={3}
              />,
              undefined
            )}

            <GameMenu
              playerStats={playerStats}
              playerWeapons={playerWeapons}
              character={character}
              onExitGame={onExitGame}
              onEndRoundEarly={onEndRoundEarly}
              canEndRoundEarly={canEndRoundEarly}
              devCallbacks={devCallbacks}
              copilot={copilot}
              onMenuOpenChange={onMenuOpenChange}
            />
          </View>
        </View>

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
      </View>
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
  containerWithFighter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  containerCompact: {
    paddingHorizontal: 6,
    gap: 6,
  },
  hudContentColumn: {
    flex: 1,
  },
  leftSectionCompact: {
    gap: 3,
  },
  statBadgeCompact: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  statLabelCompact: {
    fontSize: 11,
  },
  statItemCompact: {
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  statValueCompact: {
    fontSize: 11,
  },
  xpBarCompact: {
    width: 12,
  },
  // Single-row layout (used for all screen sizes)
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    flexWrap: 'nowrap',
  },
  statBadge: {
    backgroundColor: COLORS.deepOnyx,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    flexShrink: 0,
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
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: RADIUS.button,
    gap: 1,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    flexShrink: 0,
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
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: RADIUS.button,
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    flexShrink: 0,
  },
  levelText: {
    color: COLORS.logicTeal,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  xpBarContainer: {
    width: 20,
    height: 5,
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
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: RADIUS.button,
    gap: 1,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    flexShrink: 0,
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
  scoreRowWithCompactFighter: {
    flex: 1,
    marginTop: 0,
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
