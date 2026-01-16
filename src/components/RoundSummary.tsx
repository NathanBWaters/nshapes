import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView, Platform } from 'react-native';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { PlayerStats, Weapon, AdventureDifficulty } from '@/types';
import type { EnemyInstance } from '@/types/enemy';
import { COLORS, RADIUS } from '@/utils/colors';
import { DURATION } from '@/utils/designSystem';
import Icon, { IconName } from './Icon';
import GameMenu from './GameMenu';
import { ScreenTransition } from './ScreenTransition';
import RoundProgressChart, { RoundScore } from './RoundProgressChart';
import ChallengeCard from './ui/ChallengeCard';

// Extra bottom padding for mobile web browsers to account for browser UI (URL bar, navigation)
const MOBILE_WEB_BOTTOM_PADDING = Platform.OS === 'web' ? 60 : 0;

interface RoundSummaryProps {
  round: number;
  matchCount: number;
  score: number;
  targetScore: number;
  moneyEarned: number;
  experienceEarned: number;
  bonusWeapons: number;
  hintsEarned: number;
  healingDone: number;
  didLevelUp: boolean;
  onContinue: () => void;
  playerStats: PlayerStats;
  playerWeapons?: Weapon[];
  onExitGame?: () => void;
  roundScores: RoundScore[];
  enemy?: EnemyInstance;
  difficulty?: AdventureDifficulty;
  enemyDefeated?: boolean;
}

interface AwardTile {
  key: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: IconName;
  color: string;
}

// Hook for animating a number from 0 to target
const useAnimatedNumber = (target: number, duration: number = 500, delay: number = 0) => {
  const [displayValue, setDisplayValue] = useState(0);
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.timing(animatedValue, {
        toValue: target,
        duration,
        useNativeDriver: false,
      }).start();

      const listener = animatedValue.addListener(({ value }) => {
        setDisplayValue(Math.round(value));
      });

      return () => {
        animatedValue.removeListener(listener);
      };
    }, delay);

    return () => clearTimeout(timeout);
  }, [target, duration, delay]);

  return displayValue;
};

const RoundSummary: React.FC<RoundSummaryProps> = ({
  round,
  matchCount,
  score,
  targetScore,
  moneyEarned,
  experienceEarned,
  bonusWeapons,
  hintsEarned,
  healingDone,
  didLevelUp,
  onContinue,
  playerStats,
  playerWeapons = [],
  onExitGame,
  roundScores,
  enemy,
  difficulty,
  enemyDefeated = false,
}) => {
  // Animation values for each award tile
  const tileAnimations = useRef(
    Array(6).fill(null).map(() => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.8),
      glow: new Animated.Value(0),
    }))
  ).current;

  // Match counter animation
  const matchCounterScale = useRef(new Animated.Value(0.5)).current;
  const matchCounterOpacity = useRef(new Animated.Value(0)).current;

  // Button animation - track when to show button container
  const [showButtonContainer, setShowButtonContainer] = useState(false);
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  // Animated number values
  const animatedMatchCount = useAnimatedNumber(matchCount, 500, 200);

  // Define award tiles (using icons from the existing registry)
  const awards: AwardTile[] = [
    { key: 'score', label: 'SCORE', value: score, icon: 'skoll/bullseye', color: COLORS.logicTeal },
    { key: 'money', label: 'GOLD', value: moneyEarned, prefix: '+', icon: 'lorc/cash', color: COLORS.actionYellow },
    { key: 'xp', label: 'XP', value: experienceEarned, prefix: '+', icon: 'lorc/flat-star', color: COLORS.logicTeal },
    { key: 'bonus', label: 'BONUS', value: bonusWeapons, prefix: 'x', icon: 'lorc/gems', color: COLORS.impactOrange },
    { key: 'hints', label: 'HINTS', value: hintsEarned, prefix: '+', icon: 'lorc/light-bulb', color: COLORS.actionYellow },
    { key: 'healing', label: 'HEALED', value: healingDone, prefix: '+', suffix: ' HP', icon: 'lorc/heart-inside', color: COLORS.impactRed },
  ];

  // Start animation sequence on mount
  useEffect(() => {
    // 1. Animate match counter first
    Animated.parallel([
      Animated.spring(matchCounterScale, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(matchCounterOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Stagger animate each award tile
    const staggerDelay = 200;
    tileAnimations.forEach((anim, index) => {
      const delay = 600 + index * staggerDelay; // Start after match counter

      setTimeout(() => {
        // Fade in and scale up
        Animated.parallel([
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(anim.scale, {
            toValue: 1,
            friction: 6,
            tension: 120,
            useNativeDriver: true,
          }),
        ]).start();

        // Glow effect after appearing
        setTimeout(() => {
          Animated.sequence([
            Animated.timing(anim.glow, {
              toValue: 1,
              duration: 200,
              useNativeDriver: false,
            }),
            Animated.timing(anim.glow, {
              toValue: 0,
              duration: 300,
              useNativeDriver: false,
            }),
          ]).start();
        }, 300);
      }, delay);
    });

    // 3. Show button after all tiles - first render container, then fade in
    setTimeout(() => {
      setShowButtonContainer(true);
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 600 + 6 * staggerDelay + 500);
  }, [buttonOpacity]);

  // Render individual award tile with animation
  const renderAwardTile = (award: AwardTile, index: number) => {
    const anim = tileAnimations[index];
    const delay = 600 + index * 200 + 300; // Match the stagger timing

    // Use a component that tracks its own animated number
    return (
      <AnimatedAwardTile
        key={award.key}
        award={award}
        anim={anim}
        delay={delay}
      />
    );
  };

  return (
    <ScreenTransition>
      <View style={styles.container}>
        {/* Eyebrow Banner */}
        <View style={styles.eyebrow}>
        <Text style={styles.eyebrowText}>ROUND {round} COMPLETE</Text>
        <GameMenu playerStats={playerStats} playerWeapons={playerWeapons} onExitGame={onExitGame} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Match Counter */}
        <Animated.View
          style={[
            styles.matchCounterContainer,
            {
              opacity: matchCounterOpacity,
              transform: [{ scale: matchCounterScale }],
            },
          ]}
        >
          <Text style={styles.matchCounterLabel}>MATCHES</Text>
          <Text style={styles.matchCounterValue}>{animatedMatchCount}</Text>
        </Animated.View>

        {/* Awards Grid */}
        <View style={styles.awardsGrid}>
          <View style={styles.awardsRow}>
            {awards.slice(0, 3).map((award, index) => renderAwardTile(award, index))}
          </View>
          <View style={styles.awardsRow}>
            {awards.slice(3, 6).map((award, index) => renderAwardTile(award, index + 3))}
          </View>
        </View>

        {/* Challenge Card - Enemy or Difficulty */}
        {(enemy || difficulty) && (
          <View style={styles.challengeSection}>
            <ChallengeCard
              enemy={enemy}
              difficulty={difficulty}
              enemyDefeated={enemyDefeated}
            />
          </View>
        )}

        {/* Round Progress Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>ROUND PROGRESS</Text>
          <RoundProgressChart
            roundScores={roundScores}
            currentRound={round}
            height={140}
          />
        </View>
      </ScrollView>

      {/* Continue Button - Fixed at bottom, only rendered when ready to show */}
      {showButtonContainer && (
        <Animated.View style={[styles.buttonContainer, { opacity: buttonOpacity }]}>
          <TouchableOpacity style={styles.continueButton} onPress={onContinue}>
            <Text style={styles.continueButtonText}>
              {didLevelUp ? 'GO TO UPGRADE' : 'GO TO SHOP'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
      </View>
    </ScreenTransition>
  );
};

// Separate component for animated award tile to manage its own number animation
interface AnimatedAwardTileProps {
  award: AwardTile;
  anim: {
    opacity: Animated.Value;
    scale: Animated.Value;
    glow: Animated.Value;
  };
  delay: number;
}

const AnimatedAwardTile: React.FC<AnimatedAwardTileProps> = ({ award, anim, delay }) => {
  const animatedValue = useAnimatedNumber(award.value, 500, delay);

  // Pulse animation for non-zero values using reanimated
  const pulseScale = useSharedValue(1);
  const hasValue = award.value > 0;

  useEffect(() => {
    if (hasValue) {
      // Start pulse after the tile appears
      pulseScale.value = withDelay(
        delay + 500,
        withRepeat(
          withSequence(
            withTiming(1.05, { duration: DURATION.slow }),
            withTiming(1, { duration: DURATION.slow })
          ),
          3, // Pulse 3 times then stop
          false
        )
      );
    }
  }, [hasValue, delay, pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Interpolate glow to border color
  const borderColor = anim.glow.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.slateCharcoal, award.color],
  });

  const shadowOpacity = anim.glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <Animated.View
      style={[
        styles.awardTile,
        {
          opacity: anim.opacity,
          transform: [{ scale: anim.scale }],
          borderColor: borderColor,
          shadowColor: award.color,
          shadowOpacity: shadowOpacity,
        },
      ]}
    >
      <ReAnimated.View style={[styles.awardContent, hasValue && pulseStyle]}>
        <View style={[styles.awardIconContainer, { backgroundColor: award.color + '20' }]}>
          <Icon name={award.icon} size={24} color={award.color} />
        </View>
        <Text style={styles.awardLabel}>{award.label}</Text>
        <Text style={[styles.awardValue, hasValue && { color: award.color }]}>
          {award.prefix || ''}{animatedValue}{award.suffix || ''}
        </Text>
      </ReAnimated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  eyebrow: {
    height: 48,
    backgroundColor: COLORS.logicTeal,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.slateCharcoal,
  },
  eyebrowText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 3,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100 + MOBILE_WEB_BOTTOM_PADDING, // Account for fixed button container at bottom
  },
  matchCounterContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  matchCounterLabel: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 2,
    marginBottom: 8,
  },
  matchCounterValue: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 64,
    fontFamily: 'monospace',
  },
  awardsGrid: {
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  challengeSection: {
    marginBottom: 12,
    paddingHorizontal: 4, // Slight horizontal padding for visual breathing room
  },
  chartSection: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    marginBottom: 16, // Increased margin for visual separation
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
  },
  awardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  awardTile: {
    width: 100,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    padding: 12,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    elevation: 4,
  },
  awardContent: {
    alignItems: 'center',
  },
  awardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  awardLabel: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 4,
  },
  awardValue: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 20,
    fontFamily: 'monospace',
  },
  buttonContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingBottom: 16 + MOBILE_WEB_BOTTOM_PADDING,
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.paperBeige,
  },
  continueButton: {
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    shadowColor: COLORS.deepOnyx,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 4,
  },
  continueButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 1,
  },
});

export default RoundSummary;
