import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS, RADIUS } from '@/utils/colors';
import { EASE, MS, STAYS, exitMs, reducedMs } from '@/utils/motion';

interface NotificationProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
  duration?: number;
}

const Notification: React.FC<NotificationProps> = ({
  message,
  type,
  onClose,
  duration = 500,
}) => {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(reduced ? 0 : 10);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const enterDur = reduced ? reducedMs(MS.quick) : MS.quick;
    const outDur = reduced ? reducedMs(exitMs(MS.quick)) : exitMs(MS.quick);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onCloseRef.current();
    };

    opacity.value = 0;
    translateY.value = reduced ? 0 : 10;
    opacity.value = withTiming(1, { duration: enterDur, easing: EASE.ui, ...STAYS });
    if (!reduced) {
      translateY.value = withTiming(0, { duration: enterDur, easing: EASE.enter });
    }

    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    const timer = setTimeout(() => {
      if (!reduced) {
        translateY.value = withTiming(6, { duration: outDur, easing: EASE.exitSoft });
      }
      opacity.value = withTiming(0, { duration: outDur, easing: EASE.exitSoft, ...STAYS }, finished => {
        if (finished) runOnJS(finish)();
      });
      fallbackTimer = setTimeout(finish, outDur + 48);
    }, duration);

    return () => {
      clearTimeout(timer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      cancelAnimation(opacity);
      cancelAnimation(translateY);
    };
  }, [message, duration, reduced, opacity, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return styles.success;
      case 'error':
        return styles.error;
      case 'warning':
        return styles.warning;
      case 'info':
      default:
        return styles.info;
    }
  };

  return (
    <Animated.View style={[styles.container, getTypeStyles(), animStyle]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.button,
    zIndex: 100,
    maxWidth: 220,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    shadowColor: COLORS.deepOnyx,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 4,
  },
  text: {
    color: COLORS.canvasWhite,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  success: {
    backgroundColor: COLORS.logicTeal,
  },
  error: {
    backgroundColor: COLORS.impactRed,
  },
  warning: {
    backgroundColor: COLORS.impactOrange,
  },
  info: {
    backgroundColor: COLORS.slateCharcoal,
  },
});

export default Notification;
