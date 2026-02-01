import React, { useEffect, useState } from 'react';
import { ViewStyle, View, StyleSheet, Dimensions, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { DURATION } from '@/utils/designSystem';
import { COLORS, RADIUS } from '@/utils/colors';

interface ScreenTransitionProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Wrapper component that fades children in on mount.
 * Provides smooth page transition effect.
 */
export function ScreenTransition({ children, style }: ScreenTransitionProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: DURATION.normal,
      easing: Easing.out(Easing.exp),
    });
    translateY.value = withTiming(0, {
      duration: DURATION.normal,
      easing: Easing.out(Easing.exp),
    });
  }, [opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[{ flex: 1 }, animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}

interface DoorTransitionProps {
  /** Whether the transition is active */
  active: boolean;
  /** Callback when doors fully close */
  onClose?: () => void;
  /** Callback when doors fully open */
  onOpen?: () => void;
  /** Text to show when doors are closed */
  label?: string;
  /** Duration for close/open in ms (default 400) */
  duration?: number;
  /** How long to hold doors closed in ms (default 800) */
  holdDuration?: number;
}

/**
 * Door transition overlay - doors slide in from sides, meet in middle with label,
 * then slide out. Used for dramatic scene changes like going to shop.
 */
export function DoorTransition({
  active,
  onClose,
  onOpen,
  label = 'WEAPON SHOP',
  duration = 400,
  holdDuration = 800,
}: DoorTransitionProps) {
  const { width: screenWidth } = Dimensions.get('window');

  // Animation progress: 0 = doors open (off screen), 1 = doors closed (meeting in middle)
  const progress = useSharedValue(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (active) {
      setIsVisible(true);
      // Close doors
      progress.value = withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      }, (finished) => {
        if (finished && onClose) {
          runOnJS(onClose)();
        }
      });
    } else if (isVisible) {
      // Open doors after hold duration
      progress.value = withDelay(holdDuration, withTiming(0, {
        duration,
        easing: Easing.in(Easing.cubic),
      }, (finished) => {
        if (finished) {
          runOnJS(setIsVisible)(false);
          if (onOpen) {
            runOnJS(onOpen)();
          }
        }
      }));
    }
  }, [active, duration, holdDuration, progress, onClose, onOpen, isVisible]);

  const leftDoorStyle = useAnimatedStyle(() => {
    // Left door: starts at -50% width (off screen), ends at 0 (covering left half)
    const translateX = interpolate(progress.value, [0, 1], [-screenWidth / 2, 0]);
    return {
      transform: [{ translateX }],
    };
  });

  const rightDoorStyle = useAnimatedStyle(() => {
    // Right door: starts at +50% width (off screen right), ends at 0 (covering right half)
    const translateX = interpolate(progress.value, [0, 1], [screenWidth / 2, 0]);
    return {
      transform: [{ translateX }],
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    // Label fades in when doors are nearly closed
    const opacity = interpolate(progress.value, [0.7, 1], [0, 1]);
    return { opacity };
  });

  if (!isVisible && !active) {
    return null;
  }

  return (
    <View style={styles.doorContainer} pointerEvents="none">
      {/* Left door */}
      <Animated.View style={[styles.door, styles.leftDoor, leftDoorStyle]}>
        {/* Left half of text */}
        <View style={styles.leftTextContainer}>
          <Animated.Text style={[styles.doorLabel, labelStyle]}>
            {label}
          </Animated.Text>
        </View>
      </Animated.View>

      {/* Right door */}
      <Animated.View style={[styles.door, styles.rightDoor, rightDoorStyle]}>
        {/* Right half of text */}
        <View style={styles.rightTextContainer}>
          <Animated.Text style={[styles.doorLabel, labelStyle]}>
            {label}
          </Animated.Text>
        </View>
      </Animated.View>

      {/* Center seam accent */}
      <Animated.View style={[styles.centerSeam, useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0.9, 1], [0, 1]),
      }))]} />
    </View>
  );
}

const styles = StyleSheet.create({
  doorContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 9999,
    overflow: 'hidden',
  },
  door: {
    width: '50%',
    height: '100%',
    backgroundColor: COLORS.actionYellow,
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0,
  },
  leftDoor: {
    position: 'absolute',
    left: 0,
    alignItems: 'flex-end',
    borderRightWidth: 2,
    borderRightColor: COLORS.slateCharcoal,
  },
  rightDoor: {
    position: 'absolute',
    right: 0,
    alignItems: 'flex-start',
    borderLeftWidth: 2,
    borderLeftColor: COLORS.slateCharcoal,
  },
  leftTextContainer: {
    width: '200%', // Double width so full text fits
    alignItems: 'center',
    overflow: 'hidden',
  },
  rightTextContainer: {
    width: '200%', // Double width so full text fits
    alignItems: 'center',
    marginLeft: '-100%', // Shift left to show right half
    overflow: 'hidden',
  },
  doorLabel: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  centerSeam: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 4,
    marginLeft: -2,
    backgroundColor: COLORS.slateCharcoal,
  },
});
