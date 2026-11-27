import { MONO_FONT } from '@/utils/fonts';
/**
 * InactivityBar Component
 * Shows a progress bar that fills up as the player remains inactive.
 * Color changes near max, shows death icon for instant death penalty.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, RADIUS } from '@/utils/colors';
import { EASE, MS, STAYS } from '@/utils/motion';
import { useAppActive } from '@/hooks/useAppActive';
import Icon from '../Icon';

interface InactivityBarProps {
  /** Current time since last match in milliseconds */
  current: number;
  /** Maximum time before penalty in milliseconds */
  max: number;
  /** Type of penalty when bar fills */
  penalty: 'damage' | 'death';
}

const InactivityBar: React.FC<InactivityBarProps> = ({ current, max, penalty }) => {
  const appActive = useAppActive();
  const reducedMotion = Boolean(useReducedMotion());

  // Calculate normalized ratio (0..1) and percentage (0..100)
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const fillPercent = ratio * 100;

  // Determine color based on fill level
  const isWarning = fillPercent >= 70;
  const isDanger = fillPercent >= 90;

  const trackWidthSV = useSharedValue(0);
  const fillRatio = useSharedValue(ratio);
  const iconScale = useSharedValue(1);

  useEffect(() => {
    fillRatio.value = withTiming(ratio, {
      duration: MS.feedback,
      easing: EASE.linear,
      ...STAYS,
    });
  }, [ratio, fillRatio]);

  useEffect(() => {
    if (isDanger && appActive && !reducedMotion) {
      iconScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: MS.move, easing: EASE.drift }),
          withTiming(1, { duration: MS.panel, easing: EASE.drift })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(iconScale);
      iconScale.value = withTiming(1, { duration: MS.feedback, easing: EASE.ui });
    }
    return () => {
      cancelAnimation(iconScale);
    };
  }, [isDanger, appActive, reducedMotion, iconScale]);

  useEffect(() => {
    return () => {
      cancelAnimation(fillRatio);
      cancelAnimation(iconScale);
    };
  }, [fillRatio, iconScale]);

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    trackWidthSV.value = event.nativeEvent.layout.width;
  };

  const fillAnimStyle = useAnimatedStyle(() => {
    const w = trackWidthSV.value;
    const r = Math.max(0, Math.min(1, fillRatio.value));
    return {
      transform: w > 0 ? [{ translateX: -w * (1 - r) * 0.5 }, { scaleX: r }] : [{ scaleX: r }],
    };
  });

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const getBarColor = () => {
    if (isDanger) return COLORS.impactRed;
    if (isWarning) return COLORS.impactOrange;
    return COLORS.logicTeal;
  };

  const remainingSeconds = Math.max(0, Math.ceil((max - current) / 1000));

  return (
    <View style={[styles.container, isDanger && styles.containerDanger]}>
      {/* Icon indicating penalty type (danger pulse animates icon only, never text) */}
      <Animated.View style={[styles.iconContainer, iconAnimStyle]}>
        <Icon
          name={penalty === 'death' ? 'lorc/fist' : 'lorc/heart-inside'}
          size={16}
          color={isDanger ? COLORS.impactRed : COLORS.slateCharcoal}
        />
      </Animated.View>

      <View style={styles.barContainer} onLayout={handleTrackLayout}>
        <Animated.View
          style={[
            styles.barFill,
            { backgroundColor: getBarColor() },
            fillAnimStyle,
          ]}
        />
      </View>

      <Text style={[styles.timerText, isDanger && styles.timerTextDanger]}>
        {remainingSeconds}s
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderBottomWidth: 2,
    borderColor: COLORS.slateCharcoal,
  },
  containerDanger: {
    borderColor: COLORS.impactRed,
  },
  iconContainer: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.paperBeige,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  barFill: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: MONO_FONT,
    fontVariant: ['tabular-nums'],
    color: COLORS.slateCharcoal,
    minWidth: 26,
    textAlign: 'right',
  },
  timerTextDanger: {
    color: COLORS.impactRed,
  },
});

export default InactivityBar;
