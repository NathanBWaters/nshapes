import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '@/utils/colors';

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

  // Animation for pulse effect when critical
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isCritical = currentTime <= 5 && currentTime > 0 && !isInfinite;

  useEffect(() => {
    if (isCritical) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isCritical]);

  // Color based on time remaining
  const getProgressColor = () => {
    if (isInfinite) return COLORS.slateCharcoal;
    if (currentTime <= 5) return COLORS.impactRed;
    if (currentTime <= 10) return COLORS.impactOrange;
    return COLORS.logicTeal;
  };

  const progressColor = getProgressColor();

  // SVG circle calculations
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // strokeDashoffset: 0 = full circle, circumference = empty circle
  // We want full when progress=1, empty when progress=0
  const strokeDashoffset = circumference * (1 - progress);

  // Format the time display
  const formatDisplayTime = () => {
    if (isInfinite) return '∞';
    const mins = Math.floor(currentTime / 60);
    const secs = Math.floor(currentTime % 60);
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return String(secs);
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          transform: [{ scale: pulseAnim }],
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
        {/* Progress circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
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
              fontSize: isInfinite ? 20 : currentTime >= 60 ? 10 : 14,
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
