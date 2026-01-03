import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, Platform } from 'react-native';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { COLORS, RADIUS, SPACING, SHADOWS } from '../theme';
import { DURATIONS } from '../theme/animations';
import { haptics } from '../utils/haptics';
import Icon from './Icon';
import Card from './Card';
import { Card as CardType } from '@/types';
import { createDeck, shuffleArray } from '@/utils/gameUtils';

const AnimatedPressable = ReAnimated.createAnimatedComponent(Pressable);

const NUM_BACKGROUND_CARDS = 8;

interface MainMenuProps {
  onSelectAdventure: () => void;
  onSelectFreeplay: () => void;
  onSelectTutorial: () => void;
}

// Generate random card configurations for depth/variety
interface CardConfig {
  card: CardType;
  size: number;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  initialRotation: number;
  floatAmount: number;
  floatDuration: number;
  floatDelay: number;
  rotationDuration: number;
  rotationDirection: 1 | -1;
  opacity: number;
}

// Menu button with animations and haptics
function MenuButton({
  onPress,
  variant,
  icon,
  title,
  subtitle,
}: {
  onPress: () => void;
  variant: 'adventure' | 'freeplay' | 'tutorial';
  icon: string;
  title: string;
  subtitle: string;
}) {
  const pressed = useSharedValue(0);
  const hovered = useSharedValue(0);

  const handlePressIn = useCallback(() => {
    pressed.value = withTiming(1, { duration: DURATIONS.press });
  }, [pressed]);

  const handlePressOut = useCallback(() => {
    pressed.value = withTiming(0, { duration: DURATIONS.press });
  }, [pressed]);

  const handleHoverIn = useCallback(() => {
    if (Platform.OS === 'web') {
      hovered.value = withTiming(1, { duration: DURATIONS.hover });
    }
  }, [hovered]);

  const handleHoverOut = useCallback(() => {
    if (Platform.OS === 'web') {
      hovered.value = withTiming(0, { duration: DURATIONS.hover });
    }
  }, [hovered]);

  const handlePress = useCallback(() => {
    haptics.light();
    onPress();
  }, [onPress]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressed.value, [0, 1], [1, 0.98]);
    const opacity = interpolate(pressed.value, [0, 1], [1, 0.9]);
    const translateY = interpolate(hovered.value, [0, 1], [0, -2]);
    const shadowOpacity = interpolate(hovered.value, [0, 1], [0.1, 0.2]);

    return {
      transform: [
        { scale },
        { translateY },
      ],
      opacity,
      shadowOpacity,
    };
  });

  const variantStyles = {
    adventure: {
      button: styles.adventureButton,
      iconBg: COLORS.paperBeige,
      iconColor: COLORS.slateCharcoal,
      textColor: COLORS.slateCharcoal,
    },
    freeplay: {
      button: styles.freeplayButton,
      iconBg: COLORS.paperBeige,
      iconColor: COLORS.slateCharcoal,
      textColor: COLORS.slateCharcoal,
    },
    tutorial: {
      button: styles.tutorialButton,
      iconBg: 'rgba(255,255,255,0.2)',
      iconColor: COLORS.canvasWhite,
      textColor: COLORS.canvasWhite,
    },
  };

  const v = variantStyles[variant];

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      accessibilityLabel={title}
      testID={`menu-${variant}`}
      style={[
        styles.menuButton,
        v.button,
        animatedStyle,
        Platform.OS === 'web' && { cursor: 'pointer' as const },
      ]}
    >
      <View style={[styles.buttonIconContainer, { backgroundColor: v.iconBg }]}>
        <Icon name={icon} size={32} color={v.iconColor} />
      </View>
      <View style={styles.buttonTextContainer}>
        <Text style={[styles.menuButtonText, { color: v.textColor }]}>{title}</Text>
        <Text style={[styles.menuButtonSubtext, { color: v.textColor, opacity: variant === 'tutorial' ? 0.9 : 0.7 }]}>
          {subtitle}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const MainMenu: React.FC<MainMenuProps> = ({
  onSelectAdventure,
  onSelectFreeplay,
  onSelectTutorial,
}) => {
  // Generate random card configurations
  const cardConfigs = useMemo((): CardConfig[] => {
    const deck = createDeck(['shape', 'color', 'number', 'shading']);
    const shuffled = shuffleArray(deck);

    // Predefined positions to spread cards across screen
    const positions = [
      { top: '5%', left: '5%' },
      { top: '8%', right: '8%' },
      { top: '35%', left: '2%' },
      { top: '30%', right: '5%' },
      { bottom: '35%', left: '8%' },
      { bottom: '30%', right: '3%' },
      { bottom: '12%', left: '15%' },
      { bottom: '8%', right: '12%' },
    ];

    return shuffled.slice(0, NUM_BACKGROUND_CARDS).map((card, i) => ({
      card: {
        ...card,
        selected: false,
        isHint: false,
        onFire: false,
        isHolographic: false,
      },
      size: 80 + Math.random() * 50, // 80-130px for depth
      ...positions[i],
      initialRotation: (Math.random() - 0.5) * 30, // -15 to 15 degrees
      floatAmount: 15 + Math.random() * 20, // 15-35px float
      floatDuration: 3500 + Math.random() * 2000, // 3.5-5.5s
      floatDelay: Math.random() * 1500, // 0-1.5s delay
      rotationDuration: 8000 + Math.random() * 8000, // 8-16s per rotation
      rotationDirection: Math.random() > 0.5 ? 1 : -1,
      opacity: 0.12 + Math.random() * 0.08, // 0.12-0.20 opacity
    }));
  }, []);

  // Create animated values for each card
  const floatAnims = useRef(
    cardConfigs.map(() => new Animated.Value(0))
  ).current;

  const rotateAnims = useRef(
    cardConfigs.map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    // Start float and rotation animations for each card
    cardConfigs.forEach((config, i) => {
      // Float animation
      Animated.loop(
        Animated.sequence([
          Animated.delay(config.floatDelay),
          Animated.timing(floatAnims[i], {
            toValue: 1,
            duration: config.floatDuration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnims[i], {
            toValue: 0,
            duration: config.floatDuration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Rotation animation
      Animated.loop(
        Animated.timing(rotateAnims[i], {
          toValue: 1,
          duration: config.rotationDuration,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    });
  }, [cardConfigs, floatAnims, rotateAnims]);

  return (
    <View style={styles.container}>
      {/* Animated Background Cards */}
      <View style={styles.backgroundShapes} pointerEvents="none">
        {cardConfigs.map((config, i) => {
          const floatY = floatAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [0, -config.floatAmount],
          });

          const rotation = rotateAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [
              `${config.initialRotation}deg`,
              `${config.initialRotation + (360 * config.rotationDirection)}deg`,
            ],
          });

          return (
            <Animated.View
              key={config.card.id}
              style={[
                styles.floatingCard,
                {
                  width: config.size,
                  opacity: config.opacity,
                  top: config.top,
                  bottom: config.bottom,
                  left: config.left,
                  right: config.right,
                  transform: [
                    { translateY: floatY },
                    { rotate: rotation },
                  ],
                },
              ]}
            >
              <Card
                card={config.card}
                onClick={() => {}}
                disabled={true}
                isPaused={true}
              />
            </Animated.View>
          );
        })}
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>NSHAPES</Text>
          <Text style={styles.subtitle}>Roguelike Match-Three Puzzle</Text>
        </View>

        {/* Menu Buttons */}
        <View style={styles.menuSection}>
          <MenuButton
            onPress={onSelectAdventure}
            variant="adventure"
            icon="lorc/crossed-swords"
            title="Adventure"
            subtitle="10 rounds, enemies & loot"
          />

          <MenuButton
            onPress={onSelectFreeplay}
            variant="freeplay"
            icon="lorc/archery-target"
            title="Free Play"
            subtitle="No timer, practice mode"
          />

          <MenuButton
            onPress={onSelectTutorial}
            variant="tutorial"
            icon="lorc/open-book"
            title="Tutorial"
            subtitle="Learn how to play"
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>v1.0.0</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  backgroundShapes: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  floatingCard: {
    position: 'absolute',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 40,
    paddingHorizontal: SPACING.lg,
    zIndex: 1,
  },
  titleSection: {
    alignItems: 'center',
    paddingTop: 40,
  },
  title: {
    fontSize: 56,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.slateCharcoal,
    opacity: 0.7,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  menuSection: {
    gap: SPACING.md,
    paddingHorizontal: 20,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    padding: 20,
    gap: SPACING.md,
    ...SHADOWS.sm,
  },
  adventureButton: {
    backgroundColor: COLORS.actionYellow,
  },
  freeplayButton: {
    backgroundColor: COLORS.canvasWhite,
  },
  tutorialButton: {
    backgroundColor: COLORS.tutorialBlue,
    borderColor: COLORS.slateCharcoal,
  },
  buttonIconContainer: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.paperBeige,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  buttonTextContainer: {
    flex: 1,
  },
  menuButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.xxs,
  },
  menuButtonSubtext: {
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.slateCharcoal,
    opacity: 0.7,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
  },
  footerText: {
    fontSize: 10,
    fontWeight: '400',
    color: COLORS.slateCharcoal,
    opacity: 0.5,
    letterSpacing: 1,
  },
});

export default MainMenu;
