import React, { useEffect } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { DURATION } from '@/utils/designSystem';

interface LaserBeamProps {
  direction: 'horizontal' | 'vertical';
  position: number; // Row or column index
  onComplete?: () => void;
}

export function LaserBeam({ direction, position, onComplete }: LaserBeamProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    // Animate beam appearing and then fading
    opacity.value = withSequence(
      withTiming(1, { duration: 50 }),
      withTiming(1, { duration: DURATION.normal }),
      withTiming(0, { duration: DURATION.fast })
    );

    scale.value = withSequence(
      withTiming(1, { duration: 100, easing: Easing.out(Easing.exp) }),
      withTiming(1, { duration: DURATION.normal }),
      withTiming(0.5, { duration: DURATION.fast })
    );

    glowOpacity.value = withSequence(
      withTiming(0.8, { duration: 100 }),
      withTiming(0.4, { duration: DURATION.normal }),
      withTiming(0, { duration: DURATION.fast })
    );

    // Call onComplete after animation
    const timeout = setTimeout(() => {
      onComplete?.();
    }, DURATION.slow);

    return () => clearTimeout(timeout);
  }, [opacity, scale, glowOpacity, onComplete]);

  const beamStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: direction === 'horizontal'
      ? [{ scaleY: scale.value }]
      : [{ scaleX: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const { width, height } = Dimensions.get('window');

  const positionStyle = direction === 'horizontal'
    ? { top: position, left: 0, right: 0, height: 4 }
    : { left: position, top: 0, bottom: 0, width: 4 };

  const glowPositionStyle = direction === 'horizontal'
    ? { top: position - 8, left: 0, right: 0, height: 20 }
    : { left: position - 8, top: 0, bottom: 0, width: 20 };

  return (
    <>
      {/* Glow layer */}
      <Animated.View
        style={[
          styles.glow,
          glowPositionStyle,
          glowStyle,
        ]}
        pointerEvents="none"
      />
      {/* Core beam */}
      <Animated.View
        style={[
          styles.beam,
          positionStyle,
          beamStyle,
        ]}
        pointerEvents="none"
      />
    </>
  );
}

const styles = StyleSheet.create({
  beam: {
    position: 'absolute',
    backgroundColor: '#FFDE00', // Action Yellow core
    zIndex: 200,
  },
  glow: {
    position: 'absolute',
    backgroundColor: '#FF9538', // Impact Orange glow
    zIndex: 199,
  },
});
