import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import Icon from './Icon';

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
  // Animated values for floating shapes
  const float1 = useRef(new Animated.Value(0)).current;
  const float2 = useRef(new Animated.Value(0)).current;
  const float3 = useRef(new Animated.Value(0)).current;
  const rotate1 = useRef(new Animated.Value(0)).current;
  const rotate2 = useRef(new Animated.Value(0)).current;

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

    // Create rotation animations
    const createRotateAnimation = (animValue: Animated.Value, duration: number) => {
      return Animated.loop(
        Animated.timing(animValue, {
          toValue: 1,
          duration: duration,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
    };

    // Start animations
    createFloatAnimation(float1, 4000, 0).start();
    createFloatAnimation(float2, 5000, 500).start();
    createFloatAnimation(float3, 4500, 1000).start();
    createRotateAnimation(rotate1, 20000).start();
    createRotateAnimation(rotate2, 15000).start();
  }, []);

  // Interpolate values
  const float1Y = float1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -30],
  });

  const float2Y = float2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 25],
  });

  const float3Y = float3.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  const rotate1Deg = rotate1.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const rotate2Deg = rotate2.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  return (
    <View style={styles.container}>
      {/* Animated Background Shapes */}
      <View style={styles.backgroundShapes}>
        <Animated.View
          style={[
            styles.floatingShape,
            styles.shape1,
            {
              transform: [
                { translateY: float1Y },
                { rotate: rotate1Deg },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.floatingShape,
            styles.shape2,
            {
              transform: [
                { translateY: float2Y },
                { rotate: rotate2Deg },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.floatingShape,
            styles.shape3,
            {
              transform: [{ translateY: float3Y }],
            },
          ]}
        />
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
  floatingShape: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    opacity: 0.15,
  },
  shape1: {
    width: 120,
    height: 120,
    top: '15%',
    left: '10%',
    borderRadius: 8,
    backgroundColor: COLORS.actionYellow,
  },
  shape2: {
    width: 80,
    height: 80,
    top: '60%',
    right: '15%',
    borderRadius: 40,
    backgroundColor: COLORS.logicTeal,
  },
  shape3: {
    width: 100,
    height: 100,
    bottom: '20%',
    left: '20%',
    borderRadius: 12,
    backgroundColor: COLORS.impactOrange,
    transform: [{ rotate: '45deg' }],
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
