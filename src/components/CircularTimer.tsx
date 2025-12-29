import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

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

  // Calculate progress (0 to 1) - how much time has ELAPSED (fills up clockwise as time passes)
  const elapsed = totalTime - currentTime;
  const progress = isInfinite ? 0 : Math.min(Math.max(elapsed / totalTime, 0), 1);

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
    if (isInfinite) return '#9ca3af'; // Gray for infinite
    if (currentTime <= 5) return '#ef4444'; // Red - critical
    if (currentTime <= 10) return '#f97316'; // Orange - warning
    return '#3b82f6'; // Blue - normal
  };

  const progressColor = getProgressColor();
  const bgColor = '#e5e7eb';
  const innerSize = size - strokeWidth * 2;

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

  // Calculate rotation for the two halves
  // First half rotates 0-180 degrees (covers progress 0-0.5)
  // Second half rotates 0-180 degrees (covers progress 0.5-1.0)
  const firstHalfRotation = Math.min(progress * 2, 1) * 180;
  const secondHalfRotation = Math.max((progress - 0.5) * 2, 0) * 180;
  const showSecondHalf = progress > 0.5;

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
      {/* Background ring */}
      <View
        style={[
          styles.backgroundRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: bgColor,
          },
        ]}
      />

      {/* Right half container (first 180 degrees, progress 0-50%) */}
      <View
        style={[
          styles.halfMask,
          {
            width: size / 2,
            height: size,
            left: size / 2,
          },
        ]}
      >
        <View
          style={[
            styles.halfCircle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: progressColor,
              borderLeftColor: 'transparent',
              borderBottomColor: 'transparent',
              left: -size / 2,
              transform: [{ rotate: `${firstHalfRotation - 45}deg` }],
            },
          ]}
        />
      </View>

      {/* Left half container (second 180 degrees, progress 50-100%) */}
      <View
        style={[
          styles.halfMask,
          {
            width: size / 2,
            height: size,
            left: 0,
          },
        ]}
      >
        <View
          style={[
            styles.halfCircle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: showSecondHalf ? progressColor : 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: 'transparent',
              left: 0,
              transform: [{ rotate: `${secondHalfRotation - 45}deg` }],
            },
          ]}
        />
      </View>

      {/* Inner circle with time text */}
      <View
        style={[
          styles.innerCircle,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
          },
        ]}
      >
        <Text
          style={[
            styles.timeText,
            {
              color: isInfinite ? '#6b7280' : isCritical ? progressColor : '#1f2937',
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
  backgroundRing: {
    position: 'absolute',
  },
  halfMask: {
    position: 'absolute',
    overflow: 'hidden',
  },
  halfCircle: {
    position: 'absolute',
  },
  innerCircle: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timeText: {
    textAlign: 'center',
  },
});

export default CircularTimer;
