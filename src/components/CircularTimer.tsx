import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import ReAnimated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated';
import { COLORS } from '@/utils/colors';

const AnimatedCircle = ReAnimated.createAnimatedComponent(Circle);

interface CircularTimerProps {
  currentTime: number; // Current remaining time in seconds
  totalTime: number; // Total time for the round in seconds
  size?: number; // Size of the timer circle
  strokeWidth?: number; // Width of the progress stroke
}

const CircularTimer: React.FC<CircularTimerProps> = ({
  currentTime,
  totalTime,
  size = 44,
  strokeWidth = 4,
}) => {
  // Handle infinite time (totalTime <= 0 or very large)
  const isInfinite = totalTime <= 0 || totalTime > 9999;

  // Calculate progress (0 to 1) - how much time REMAINS (starts full, empties as time runs out)
  const progress = isInfinite ? 1 : Math.min(Math.max(currentTime / totalTime, 0), 1);

  // SVG circle calculations
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Smooth animation for the progress circle
  const animatedProgress = useSharedValue(progress);

  useEffect(() => {
    // Animate smoothly to the new progress value over 1 second (matching typical update interval)
    animatedProgress.value = withTiming(progress, {
      duration: 1000,
      easing: Easing.linear,
    });
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  // Determine urgency level for pulse intensity
  const getUrgencyLevel = () => {
    if (isInfinite || currentTime <= 0) return 'none';
    if (currentTime <= 5) return 'critical'; // Rapid pulse, red
    if (currentTime <= 15) return 'warning'; // Medium pulse, orange
    if (currentTime <= 30) return 'alert'; // Gentle pulse
    return 'none';
  };

  const urgencyLevel = getUrgencyLevel();

  // Animation for pulse effect based on urgency
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Configure pulse based on urgency level
    if (urgencyLevel === 'none') {
      pulseAnim.setValue(1);
      shakeAnim.setValue(0);
      return;
    }

    // Pulse configuration by urgency
    const pulseConfig = {
      alert: { scale: 1.03, duration: 1000 }, // Gentle, slow
      warning: { scale: 1.05, duration: 500 }, // Medium
      critical: { scale: 1.08, duration: 250 }, // Rapid
    }[urgencyLevel] || { scale: 1, duration: 1000 };

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: pulseConfig.scale,
          duration: pulseConfig.duration,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: pulseConfig.duration,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // Add shake for critical (last 3 seconds)
    if (currentTime <= 3 && currentTime > 0 && !isInfinite) {
      const shake = Animated.loop(
        Animated.sequence([
          Animated.timing(shakeAnim, {
            toValue: 2,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: -2,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: 0,
            duration: 50,
            useNativeDriver: true,
          }),
        ])
      );
      shake.start();
      return () => {
        pulse.stop();
        shake.stop();
      };
    }

    return () => pulse.stop();
  }, [urgencyLevel, currentTime, isInfinite]);

  // Color based on time remaining
  const getProgressColor = () => {
    if (isInfinite) return COLORS.slateCharcoal;
    if (currentTime <= 5) return COLORS.impactRed;
    if (currentTime <= 10) return COLORS.impactOrange;
    return COLORS.logicTeal;
  };

  const progressColor = getProgressColor();

  // Format the time display - ALWAYS show seconds, never minutes
  const formatDisplayTime = () => {
    if (isInfinite) return '∞';
    return String(Math.floor(currentTime));
  };

  const isCritical = urgencyLevel === 'critical';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          transform: [
            { scale: pulseAnim },
            { translateX: shakeAnim },
          ],
        },
      ]}
    >
      <Svg width={size} height={size}>
        {/* Background circle (track) */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={COLORS.paperBeige}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle - animated smoothly */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>

      {/* Inner circle with time text */}
      <View
        style={[
          styles.innerCircle,
          {
            width: size - strokeWidth * 2 - 4,
            height: size - strokeWidth * 2 - 4,
            borderRadius: (size - strokeWidth * 2 - 4) / 2,
          },
        ]}
      >
        <Text
          style={[
            styles.timeText,
            {
              color: isInfinite ? COLORS.slateCharcoal : isCritical ? progressColor : COLORS.deepOnyx,
              fontSize: isInfinite ? 20 : currentTime >= 100 ? 10 : currentTime >= 60 ? 12 : 14,
              fontWeight: isCritical ? '800' : '700',
            },
          ]}
        >
          {formatDisplayTime()}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    position: 'absolute',
    backgroundColor: COLORS.canvasWhite,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  timeText: {
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});

export default CircularTimer;
