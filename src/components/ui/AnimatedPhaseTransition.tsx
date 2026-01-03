/**
 * AnimatedPhaseTransition - Smooth transitions between game phases
 * Wraps game phases with entering/exiting animations
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, ViewStyle, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  interpolate,
  runOnJS,
  Easing,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  SlideInUp,
  SlideOutDown,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import {
  DURATIONS,
  EASINGS,
  TRANSITION_TYPES,
  TransitionType,
  PHASE_TRANSITIONS,
} from '../../theme/animations';

interface AnimatedPhaseTransitionProps {
  /** Unique key for this phase (triggers animation on change) */
  phaseKey: string;
  /** Previous phase key (for determining transition type) */
  previousPhase?: string;
  /** Children to render */
  children: React.ReactNode;
  /** Custom transition type (overrides automatic detection) */
  transition?: TransitionType;
  /** Animation duration in ms */
  duration?: number;
  /** Custom style for the container */
  style?: ViewStyle;
  /** Callback when enter animation completes */
  onEnterComplete?: () => void;
  /** Callback when exit animation completes */
  onExitComplete?: () => void;
}

/**
 * Get the appropriate transition type based on phase change
 */
function getTransitionType(from: string | undefined, to: string): TransitionType {
  if (!from) return TRANSITION_TYPES.fade;

  const key = `${from}->${to}`;
  return PHASE_TRANSITIONS[key] ?? PHASE_TRANSITIONS['default'];
}

/**
 * Create entering animation based on transition type
 */
function getEnteringAnimation(type: TransitionType, duration: number) {
  switch (type) {
    case TRANSITION_TYPES.slideRight:
      return SlideInRight.duration(duration).easing(Easing.out(Easing.cubic));
    case TRANSITION_TYPES.slideLeft:
      return SlideInRight.duration(duration).easing(Easing.out(Easing.cubic));
    case TRANSITION_TYPES.slideUp:
      return SlideInUp.duration(duration).easing(Easing.out(Easing.cubic));
    case TRANSITION_TYPES.slideDown:
      return SlideInUp.duration(duration).easing(Easing.out(Easing.cubic));
    case TRANSITION_TYPES.scale:
      return ZoomIn.duration(duration).easing(Easing.out(Easing.cubic));
    case TRANSITION_TYPES.none:
      return undefined;
    case TRANSITION_TYPES.fade:
    default:
      return FadeIn.duration(duration).easing(Easing.out(Easing.ease));
  }
}

/**
 * Create exiting animation based on transition type
 */
function getExitingAnimation(type: TransitionType, duration: number) {
  switch (type) {
    case TRANSITION_TYPES.slideRight:
      return SlideOutLeft.duration(duration).easing(Easing.in(Easing.cubic));
    case TRANSITION_TYPES.slideLeft:
      return SlideOutLeft.duration(duration).easing(Easing.in(Easing.cubic));
    case TRANSITION_TYPES.slideUp:
      return SlideOutDown.duration(duration).easing(Easing.in(Easing.cubic));
    case TRANSITION_TYPES.slideDown:
      return SlideOutDown.duration(duration).easing(Easing.in(Easing.cubic));
    case TRANSITION_TYPES.scale:
      return ZoomOut.duration(duration).easing(Easing.in(Easing.cubic));
    case TRANSITION_TYPES.none:
      return undefined;
    case TRANSITION_TYPES.fade:
    default:
      return FadeOut.duration(duration).easing(Easing.in(Easing.ease));
  }
}

export function AnimatedPhaseTransition({
  phaseKey,
  previousPhase,
  children,
  transition,
  duration = DURATIONS.page,
  style,
  onEnterComplete,
  onExitComplete,
}: AnimatedPhaseTransitionProps) {
  // Track if this is the initial mount or a phase change
  // Start with undefined so initial mount triggers animation
  const lastPhaseRef = useRef<string | undefined>(undefined);
  const isPhaseChange = lastPhaseRef.current !== phaseKey;

  // Update ref after checking
  useEffect(() => {
    lastPhaseRef.current = phaseKey;
  }, [phaseKey]);

  // Only calculate animations when phase actually changes
  const transitionType = transition ?? getTransitionType(previousPhase, phaseKey);

  // Only apply entering animation on actual phase changes, not re-renders
  const enteringAnimation = isPhaseChange
    ? getEnteringAnimation(transitionType, duration)?.withCallback((finished) => {
        'worklet';
        if (finished && onEnterComplete) {
          runOnJS(onEnterComplete)();
        }
      })
    : undefined;

  const exitingAnimation = getExitingAnimation(transitionType, duration * 0.75)?.withCallback((finished) => {
    'worklet';
    if (finished && onExitComplete) {
      runOnJS(onExitComplete)();
    }
  });

  // Use regular View when no animation is needed (prevents mobile web flicker)
  // Only use Animated.View when actually animating a phase change
  if (!isPhaseChange) {
    return (
      <View style={[styles.container, style]}>
        {children}
      </View>
    );
  }

  return (
    <Animated.View
      key={phaseKey}
      entering={enteringAnimation}
      exiting={exitingAnimation}
      style={[styles.container, style]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Simpler fade-only transition for modals and overlays
 */
export function FadeTransition({
  visible,
  children,
  duration = DURATIONS.fade,
  style,
}: {
  visible: boolean;
  children: React.ReactNode;
  duration?: number;
  style?: ViewStyle;
}) {
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(duration)}
      exiting={FadeOut.duration(duration * 0.75)}
      style={[styles.container, style]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Slide-up transition for bottom sheets and panels
 */
export function SlideUpTransition({
  visible,
  children,
  duration = DURATIONS.modal,
  style,
}: {
  visible: boolean;
  children: React.ReactNode;
  duration?: number;
  style?: ViewStyle;
}) {
  if (!visible) return null;

  return (
    <Animated.View
      entering={SlideInUp.duration(duration).easing(Easing.out(Easing.cubic))}
      exiting={SlideOutDown.duration(duration * 0.75).easing(Easing.in(Easing.cubic))}
      style={[styles.container, style]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Scale/zoom transition for modals and popups
 */
export function ScaleTransition({
  visible,
  children,
  duration = DURATIONS.modal,
  style,
}: {
  visible: boolean;
  children: React.ReactNode;
  duration?: number;
  style?: ViewStyle;
}) {
  if (!visible) return null;

  return (
    <Animated.View
      entering={ZoomIn.duration(duration).easing(Easing.out(Easing.cubic))}
      exiting={ZoomOut.duration(duration * 0.75).easing(Easing.in(Easing.cubic))}
      style={[styles.container, style]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default AnimatedPhaseTransition;
