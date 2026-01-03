/**
 * BottomSheet - Delightful mobile bottom sheet component
 * Slides up from the bottom with bouncy spring physics and drag-to-dismiss
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  Platform,
  Pressable,
  ViewStyle,
  BackHandler,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  useAnimatedGestureHandler,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { COLORS, RADIUS, SPACING, SHADOWS, Z_INDEX } from '../../theme';
import { SPRINGS, DURATIONS } from '../../theme/animations';
import { triggerHaptic } from '../../hooks/useTouchFeedback';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BottomSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Called when sheet should close */
  onClose: () => void;
  /** Sheet content */
  children: React.ReactNode;
  /** Height of the sheet (default: 'auto' up to 90% of screen) */
  height?: number | 'auto';
  /** Snap points for sheet positions (percentages of screen height) */
  snapPoints?: number[];
  /** Initial snap point index */
  initialSnapIndex?: number;
  /** Whether to show backdrop */
  showBackdrop?: boolean;
  /** Whether backdrop dismisses sheet */
  backdropDismiss?: boolean;
  /** Whether drag-to-dismiss is enabled */
  dragToClose?: boolean;
  /** Custom style for the sheet container */
  style?: ViewStyle;
  /** Show drag handle indicator */
  showHandle?: boolean;
  /** Enable haptics */
  haptics?: boolean;
}

export function BottomSheet({
  visible,
  onClose,
  children,
  height = 'auto',
  snapPoints = [0.5, 0.9],
  initialSnapIndex = 0,
  showBackdrop = true,
  backdropDismiss = true,
  dragToClose = true,
  style,
  showHandle = true,
  haptics = Platform.OS !== 'web',
}: BottomSheetProps) {
  // Animation values
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const context = useSharedValue({ y: 0 });
  const currentSnapIndex = useRef(initialSnapIndex);

  // Calculate sheet height based on snap points
  const getSheetHeight = (snapIndex: number) => {
    return SCREEN_HEIGHT * snapPoints[snapIndex];
  };

  const getTranslateY = (snapIndex: number) => {
    return SCREEN_HEIGHT - getSheetHeight(snapIndex);
  };

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      // Open animation
      translateY.value = withSpring(
        getTranslateY(currentSnapIndex.current),
        SPRINGS.wobbly
      );
      backdropOpacity.value = withTiming(1, { duration: DURATIONS.modal });
    } else {
      // Close animation
      translateY.value = withSpring(SCREEN_HEIGHT, SPRINGS.gentle);
      backdropOpacity.value = withTiming(0, { duration: DURATIONS.fast });
    }
  }, [visible, translateY, backdropOpacity]);

  // Handle Android back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (visible) {
          onClose();
          return true;
        }
        return false;
      }
    );

    return () => backHandler.remove();
  }, [visible, onClose]);

  const closeSheet = useCallback(() => {
    if (haptics) triggerHaptic('light');
    onClose();
  }, [haptics, onClose]);

  // Snap to nearest snap point
  const snapToPoint = useCallback((velocityY: number, currentY: number) => {
    'worklet';

    // Calculate which snap point we're closest to
    let closestSnapIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < snapPoints.length; i++) {
      const snapY = getTranslateY(i);
      const distance = Math.abs(currentY - snapY);
      if (distance < minDistance) {
        minDistance = distance;
        closestSnapIndex = i;
      }
    }

    // If dragging down fast or past close threshold, close the sheet
    const closeThreshold = SCREEN_HEIGHT * 0.7;
    if ((velocityY > 500 || currentY > closeThreshold) && dragToClose) {
      translateY.value = withSpring(SCREEN_HEIGHT, SPRINGS.gentle);
      backdropOpacity.value = withTiming(0, { duration: DURATIONS.fast });
      runOnJS(closeSheet)();
    } else {
      // Snap to nearest point
      translateY.value = withSpring(getTranslateY(closestSnapIndex), SPRINGS.wobbly);
      currentSnapIndex.current = closestSnapIndex;
    }
  }, [snapPoints, dragToClose, translateY, backdropOpacity, closeSheet]);

  // Drag gesture
  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      // Only allow dragging down or within bounds
      const newY = context.value.y + event.translationY;
      const minY = getTranslateY(snapPoints.length - 1); // Highest snap point

      // Allow some resistance when dragging above max
      if (newY < minY) {
        translateY.value = minY - (minY - newY) * 0.3; // Rubber band effect
      } else {
        translateY.value = newY;
      }

      // Update backdrop based on position
      const closeThreshold = SCREEN_HEIGHT * 0.7;
      const progress = interpolate(
        newY,
        [getTranslateY(0), closeThreshold],
        [1, 0.3],
        Extrapolation.CLAMP
      );
      backdropOpacity.value = progress;
    })
    .onEnd((event) => {
      snapToPoint(event.velocityY, translateY.value);
    });

  // Animated styles
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
    pointerEvents: backdropOpacity.value > 0 ? 'auto' : 'none',
  }));

  // Handle indicator animation
  const handleAnimatedStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateY.value,
      [getTranslateY(snapPoints.length - 1), SCREEN_HEIGHT],
      [0, 180],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ rotate: `${rotation}deg` }],
    };
  });

  if (!visible && translateY.value >= SCREEN_HEIGHT) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Backdrop */}
      {showBackdrop && (
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={backdropDismiss ? closeSheet : undefined}
          />
        </Animated.View>
      )}

      {/* Sheet */}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            styles.sheet,
            { height: height === 'auto' ? SCREEN_HEIGHT * 0.9 : height },
            sheetAnimatedStyle,
            style,
          ]}
        >
          {/* Handle */}
          {showHandle && (
            <View style={styles.handleContainer}>
              <Animated.View style={[styles.handle, handleAnimatedStyle]} />
            </View>
          )}

          {/* Content */}
          <View style={styles.content}>
            {children}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/**
 * Simple modal bottom sheet for quick content display
 */
export function SimpleBottomSheet({
  visible,
  onClose,
  title,
  children,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height="auto"
      snapPoints={[0.4]}
    >
      {title && (
        <View style={styles.simpleHeader}>
          <Animated.Text style={styles.simpleTitle}>{title}</Animated.Text>
        </View>
      )}
      <View style={styles.simpleContent}>{children}</View>
      {actions && <View style={styles.simpleActions}>{actions}</View>}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: Z_INDEX.modal,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: Z_INDEX.modalBackdrop,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.canvasWhite,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    ...SHADOWS.xl,
    zIndex: Z_INDEX.modal,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.paperBeige,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  simpleHeader: {
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.paperBeige,
    marginBottom: SPACING.md,
  },
  simpleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textAlign: 'center',
  },
  simpleContent: {
    flex: 1,
  },
  simpleActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.paperBeige,
    marginTop: SPACING.md,
  },
});

export default BottomSheet;
