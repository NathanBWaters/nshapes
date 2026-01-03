/**
 * useFadeTransition - Mount/unmount fade animation hook
 * Provides smooth fade in/out for conditional rendering
 */

import { useEffect, useState, useCallback } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { DURATIONS, EASINGS } from '../theme/animations';

interface UseFadeTransitionOptions {
  /** Whether the element should be visible */
  visible: boolean;
  /** Fade in duration in ms */
  fadeInDuration?: number;
  /** Fade out duration in ms */
  fadeOutDuration?: number;
  /** Include scale animation */
  withScale?: boolean;
  /** Start scale when fading in */
  startScale?: number;
  /** Include slide animation */
  withSlide?: boolean;
  /** Slide direction */
  slideDirection?: 'up' | 'down' | 'left' | 'right';
  /** Slide distance in pixels */
  slideDistance?: number;
  /** Callback when fade out completes (element can be unmounted) */
  onExitComplete?: () => void;
  /** Delay before fade in starts */
  enterDelay?: number;
}

export function useFadeTransition(options: UseFadeTransitionOptions) {
  const {
    visible,
    fadeInDuration = DURATIONS.fade,
    fadeOutDuration = DURATIONS.fast,
    withScale = false,
    startScale = 0.95,
    withSlide = false,
    slideDirection = 'up',
    slideDistance = 10,
    onExitComplete,
    enterDelay = 0,
  } = options;

  const [shouldRender, setShouldRender] = useState(visible);
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      // Entering: start rendering immediately, then animate
      setShouldRender(true);

      const animate = () => {
        opacity.value = withTiming(1, {
          duration: fadeInDuration,
          easing: EASINGS.easeOut,
        });
      };

      if (enterDelay > 0) {
        const timeout = setTimeout(animate, enterDelay);
        return () => clearTimeout(timeout);
      } else {
        animate();
      }
    } else {
      // Exiting: animate first, then stop rendering
      opacity.value = withTiming(
        0,
        {
          duration: fadeOutDuration,
          easing: EASINGS.easeIn,
        },
        (finished) => {
          if (finished) {
            runOnJS(setShouldRender)(false);
            if (onExitComplete) {
              runOnJS(onExitComplete)();
            }
          }
        }
      );
    }
  }, [visible, fadeInDuration, fadeOutDuration, enterDelay, onExitComplete, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    let translateX = 0;
    let translateY = 0;
    let scale = 1;

    if (withScale) {
      scale = interpolate(opacity.value, [0, 1], [startScale, 1]);
    }

    if (withSlide) {
      const offset = interpolate(opacity.value, [0, 1], [slideDistance, 0]);
      switch (slideDirection) {
        case 'up':
          translateY = offset;
          break;
        case 'down':
          translateY = -offset;
          break;
        case 'left':
          translateX = offset;
          break;
        case 'right':
          translateX = -offset;
          break;
      }
    }

    return {
      opacity: opacity.value,
      transform: [
        { translateX },
        { translateY },
        { scale },
      ],
    };
  });

  const fadeIn = useCallback(() => {
    opacity.value = withTiming(1, {
      duration: fadeInDuration,
      easing: EASINGS.easeOut,
    });
  }, [opacity, fadeInDuration]);

  const fadeOut = useCallback(() => {
    opacity.value = withTiming(0, {
      duration: fadeOutDuration,
      easing: EASINGS.easeIn,
    });
  }, [opacity, fadeOutDuration]);

  return {
    /** Whether the component should be rendered */
    shouldRender,
    /** Animated style to apply to the component */
    animatedStyle,
    /** Raw opacity value */
    opacity,
    /** Manually trigger fade in */
    fadeIn,
    /** Manually trigger fade out */
    fadeOut,
  };
}

export default useFadeTransition;
