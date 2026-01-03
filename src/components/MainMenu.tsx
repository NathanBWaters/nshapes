import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import Icon from './Icon';
import Card from './Card';
import { Card as CardType } from '@/types';
import { createDeck, shuffleArray } from '@/utils/gameUtils';

interface MainMenuProps {
  onSelectAdventure: () => void;
  onSelectFreeplay: () => void;
  onSelectTutorial: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({
  onSelectAdventure,
  onSelectFreeplay,
  onSelectTutorial,
}) => {
  // Generate 4 random cards for background decoration
  const backgroundCards = useMemo(() => {
    const deck = createDeck(['shape', 'color', 'number', 'shading']);
    const shuffled = shuffleArray(deck);
    return shuffled.slice(0, 4).map(card => ({
      ...card,
      selected: false,
      isHint: false,
      onFire: false,
      isHolographic: false,
    }));
  }, []);

  // Animated values for floating cards
  const float1 = useRef(new Animated.Value(0)).current;
  const float2 = useRef(new Animated.Value(0)).current;
  const float3 = useRef(new Animated.Value(0)).current;
  const float4 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Create floating animations
    const createFloatAnimation = (animValue: Animated.Value, duration: number, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: 1,
            duration: duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
    };

    // Start animations with staggered timing
    createFloatAnimation(float1, 4000, 0).start();
    createFloatAnimation(float2, 5000, 500).start();
    createFloatAnimation(float3, 4500, 1000).start();
    createFloatAnimation(float4, 4200, 750).start();
  }, []);

  // Interpolate values for floating motion
  const float1Y = float1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -25],
  });

  const float2Y = float2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  const float3Y = float3.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -18],
  });

  const float4Y = float4.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 22],
  });

  return (
    <View style={styles.container}>
      {/* Animated Background Cards */}
      <View style={styles.backgroundShapes} pointerEvents="none">
        <Animated.View
          style={[
            styles.floatingCard,
            styles.card1,
            { transform: [{ translateY: float1Y }] },
          ]}
        >
          <Card
            card={backgroundCards[0]}
            onClick={() => {}}
            disabled={true}
            isPaused={true}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.floatingCard,
            styles.card2,
            { transform: [{ translateY: float2Y }] },
          ]}
        >
          <Card
            card={backgroundCards[1]}
            onClick={() => {}}
            disabled={true}
            isPaused={true}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.floatingCard,
            styles.card3,
            { transform: [{ translateY: float3Y }] },
          ]}
        >
          <Card
            card={backgroundCards[2]}
            onClick={() => {}}
            disabled={true}
            isPaused={true}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.floatingCard,
            styles.card4,
            { transform: [{ translateY: float4Y }] },
          ]}
        >
          <Card
            card={backgroundCards[3]}
            onClick={() => {}}
            disabled={true}
            isPaused={true}
          />
        </Animated.View>
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
          <Pressable
            onPress={onSelectAdventure}
            style={({ pressed }) => [
              styles.menuButton,
              styles.adventureButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.buttonIconContainer}>
              <Icon name="sword" size={32} color={COLORS.slateCharcoal} />
            </View>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.menuButtonText}>Adventure</Text>
              <Text style={styles.menuButtonSubtext}>10 rounds, enemies & loot</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={onSelectFreeplay}
            style={({ pressed }) => [
              styles.menuButton,
              styles.freeplayButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.buttonIconContainer}>
              <Icon name="target" size={32} color={COLORS.slateCharcoal} />
            </View>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.menuButtonText}>Free Play</Text>
              <Text style={styles.menuButtonSubtext}>No timer, practice mode</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={onSelectTutorial}
            style={({ pressed }) => [
              styles.menuButton,
              styles.tutorialButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.buttonIconContainer}>
              <Icon name="help-circle" size={32} color={COLORS.canvasWhite} />
            </View>
            <View style={styles.buttonTextContainer}>
              <Text style={[styles.menuButtonText, styles.tutorialButtonText]}>Tutorial</Text>
              <Text style={[styles.menuButtonSubtext, styles.tutorialButtonSubtext]}>
                Learn how to play
              </Text>
            </View>
          </Pressable>
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
    opacity: 0.18,
    width: 70,
  },
  card1: {
    top: '12%',
    left: '8%',
    transform: [{ rotate: '-8deg' }],
  },
  card2: {
    top: '18%',
    right: '10%',
    transform: [{ rotate: '12deg' }],
  },
  card3: {
    bottom: '25%',
    left: '15%',
    transform: [{ rotate: '5deg' }],
  },
  card4: {
    bottom: '18%',
    right: '12%',
    transform: [{ rotate: '-10deg' }],
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 40,
    paddingHorizontal: 24,
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
    marginBottom: 8,
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
    gap: 16,
    paddingHorizontal: 20,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    padding: 20,
    gap: 16,
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
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 8,
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
    marginBottom: 4,
  },
  tutorialButtonText: {
    color: COLORS.canvasWhite,
  },
  menuButtonSubtext: {
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.slateCharcoal,
    opacity: 0.7,
  },
  tutorialButtonSubtext: {
    color: COLORS.canvasWhite,
    opacity: 0.9,
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
