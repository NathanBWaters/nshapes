import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { PlayerStats, Weapon } from '@/types';
import { COLORS, RADIUS, SPACING, SHADOWS } from '../theme';
import { haptics } from '../utils/haptics';
import Icon from './Icon';
import GameMenu from './GameMenu';
import { Button } from './ui';

interface RoundSummaryProps {
  round: number;
  matchCount: number;
  score: number;
  targetScore: number;
  moneyEarned: number;
  experienceEarned: number;
  lootBoxes: number;
  hintsEarned: number;
  healingDone: number;
  didLevelUp: boolean;
  onContinue: () => void;
  playerStats: PlayerStats;
  playerWeapons?: Weapon[];
  onExitGame?: () => void;
}

interface AwardTile {
  key: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: string;
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
  lootBoxes,
  hintsEarned,
  healingDone,
  didLevelUp,
  onContinue,
  playerStats,
  playerWeapons = [],
  onExitGame,
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

  // Button animation
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  // Animated number values
  const animatedMatchCount = useAnimatedNumber(matchCount, 500, 200);

  // Define award tiles (using icons from the existing registry)
  const awards: AwardTile[] = [
    { key: 'score', label: 'SCORE', value: score, icon: 'skoll/bullseye', color: COLORS.logicTeal },
    { key: 'money', label: 'GOLD', value: moneyEarned, prefix: '+', icon: 'lorc/cash', color: COLORS.actionYellow },
    { key: 'xp', label: 'XP', value: experienceEarned, prefix: '+', icon: 'lorc/flat-star', color: COLORS.logicTeal },
    { key: 'loot', label: 'LOOT', value: lootBoxes, prefix: 'x', icon: 'lorc/gems', color: COLORS.impactOrange },
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

    // 3. Show button after all tiles
    setTimeout(() => {
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 600 + 6 * staggerDelay + 500);
  }, []);

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
    <View style={styles.container}>
      {/* Eyebrow Banner */}
      <View style={styles.eyebrow}>
        <Text style={styles.eyebrowText}>ROUND {round} COMPLETE</Text>
        <GameMenu playerStats={playerStats} playerWeapons={playerWeapons} onExitGame={onExitGame} />
      </View>

      <View style={styles.content}>
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

        {/* Continue Button */}
        <Animated.View style={[styles.buttonContainer, { opacity: buttonOpacity }]}>
          <Button
            variant="primary"
            size="lg"
            onPress={() => {
              haptics.medium();
              onContinue();
            }}
          >
            {didLevelUp ? 'GO TO UPGRADE' : 'GO TO SHOP'}
          </Button>
        </Animated.View>
      </View>
    </View>
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
      <View style={[styles.awardIconContainer, { backgroundColor: award.color + '20' }]}>
        <Icon name={award.icon} size={24} color={award.color} />
      </View>
      <Text style={styles.awardLabel}>{award.label}</Text>
      <Text style={styles.awardValue}>
        {award.prefix || ''}{animatedValue}{award.suffix || ''}
      </Text>
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
    paddingHorizontal: SPACING.md,
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
    padding: SPACING.md,
    justifyContent: 'space-between',
  },
  matchCounterContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  matchCounterLabel: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 2,
    marginBottom: SPACING.sm,
  },
  matchCounterValue: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 64,
    fontFamily: 'monospace',
  },
  awardsGrid: {
    flex: 1,
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  awardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  awardTile: {
    width: 100,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    padding: SPACING.sm,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  awardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  awardLabel: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: SPACING.xxs,
  },
  awardValue: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 20,
    fontFamily: 'monospace',
  },
  buttonContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
});

export default RoundSummary;
