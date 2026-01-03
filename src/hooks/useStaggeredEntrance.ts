/**
 * useStaggeredEntrance - Staggered animation for list items
 * Creates cascading entrance animations for grids and lists
 */

import { useEffect, useCallback } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { DURATIONS, SPRINGS, EASINGS } from '../theme/animations';

interface UseStaggeredEntranceOptions {
  /** Index of this item in the list */
  index: number;
  /** Delay between each item in ms (default: 50) */
  staggerDelay?: number;
  /** Base delay before animation starts (default: 0) */
  baseDelay?: number;
  /** Animation duration in ms (default: 300) */
  duration?: number;
  /** Use spring physics */
  useSpring?: boolean;
  /** Animation type */
  type?: 'fade' | 'fadeSlide' | 'fadeScale' | 'scale';
  /** Direction for slide animations */
  direction?: 'up' | 'down' | 'left' | 'right';
  /** Distance to slide in pixels */
  slideDistance?: number;
  /** Start scale for scale animations */
  startScale?: number;
  /** Callback when animation completes */
  onComplete?: () => void;
}

export function useStaggeredEntrance(options: UseStaggeredEntranceOptions) {
  const {
    index,
    staggerDelay = DURATIONS.staggerBase,
    baseDelay = 0,
    duration = DURATIONS.moderate,
    useSpring: shouldUseSpring = true,
    type = 'fadeScale',
    direction = 'up',
    slideDistance = 20,
    startScale = 0.8,
    onComplete,
  } = options;

  const progress = useSharedValue(0);
  const totalDelay = baseDelay + index * staggerDelay;

  useEffect(() => {
    const animate = shouldUseSpring
      ? withSpring(1, SPRINGS.popIn)
      : withTiming(1, { duration, easing: EASINGS.cubicOut });

    progress.value = withDelay(totalDelay, animate);

    // Call onComplete after animation
    if (onComplete) {
      const completeTimeout = setTimeout(() => {
        runOnJS(onComplete)();
      }, totalDelay + duration);
      return () => clearTimeout(completeTimeout);
    }
  }, [totalDelay, duration, shouldUseSpring, onComplete, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 1], [0, 1]);

    let translateX = 0;
    let translateY = 0;
    let scale = 1;

    switch (type) {
      case 'fade':
        // Just opacity
        break;

      case 'fadeSlide':
        switch (direction) {
          case 'up':
            translateY = interpolate(progress.value, [0, 1], [slideDistance, 0]);
            break;
          case 'down':
            translateY = interpolate(progress.value, [0, 1], [-slideDistance, 0]);
            break;
          case 'left':
            translateX = interpolate(progress.value, [0, 1], [slideDistance, 0]);
            break;
          case 'right':
            translateX = interpolate(progress.value, [0, 1], [-slideDistance, 0]);
            break;
        }
        break;

      case 'fadeScale':
        scale = interpolate(progress.value, [0, 1], [startScale, 1]);
        break;

      case 'scale':
        scale = interpolate(progress.value, [0, 1], [startScale, 1]);
        break;
    }

    return {
      opacity: type === 'scale' ? 1 : opacity,
      transform: [
        { translateX },
        { translateY },
        { scale },
      ],
    };
  });

  const reset = useCallback(() => {
    progress.value = 0;
  }, [progress]);

  const replay = useCallback(() => {
    progress.value = 0;
    const animate = shouldUseSpring
      ? withSpring(1, SPRINGS.popIn)
      : withTiming(1, { duration, easing: EASINGS.cubicOut });
    progress.value = withDelay(totalDelay, animate);
  }, [progress, shouldUseSpring, duration, totalDelay]);

  return {
    animatedStyle,
    progress,
    reset,
    replay,
  };
}

export default useStaggeredEntrance;
