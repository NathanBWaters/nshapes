/**
 * Modal - Animated modal overlay component
 * Supports backdrop press to close, various animations
 */

import React, { useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ViewStyle,
  Platform,
  BackHandler,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { COLORS, SPACING, RADIUS, SHADOWS, Z_INDEX } from '../../theme';
import { DURATIONS } from '../../theme/animations';

type ModalAnimation = 'fade' | 'slideUp' | 'scale' | 'none';

interface ModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when modal should close */
  onClose: () => void;
  /** Modal content */
  children: React.ReactNode;
  /** Animation type */
  animation?: ModalAnimation;
  /** Close on backdrop press */
  closeOnBackdrop?: boolean;
  /** Show backdrop overlay */
  showBackdrop?: boolean;
  /** Backdrop opacity */
  backdropOpacity?: number;
  /** Max width of modal content */
  maxWidth?: number;
  /** Custom container style */
  style?: ViewStyle;
  /** Custom content style */
  contentStyle?: ViewStyle;
  /** Handle Android back button */
  handleBackButton?: boolean;
}

export function Modal({
  visible,
  onClose,
  children,
  animation = 'scale',
  closeOnBackdrop = true,
  showBackdrop = true,
  backdropOpacity = 0.5,
  maxWidth = 500,
  style,
  contentStyle,
  handleBackButton = true,
}: ModalProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progress.value = withTiming(1, {
        duration: DURATIONS.modal,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      progress.value = withTiming(0, {
        duration: DURATIONS.fast,
        easing: Easing.in(Easing.cubic),
      });
    }
  }, [visible, progress]);

  // Handle Android back button
  useEffect(() => {
    if (!handleBackButton || Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (visible) {
        onClose();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [visible, onClose, handleBackButton]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, backdropOpacity]),
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => {
    let translateY = 0;
    let scale = 1;

    switch (animation) {
      case 'slideUp':
        translateY = interpolate(progress.value, [0, 1], [100, 0]);
        break;
      case 'scale':
        scale = interpolate(progress.value, [0, 1], [0.9, 1]);
        break;
      case 'fade':
      case 'none':
      default:
        break;
    }

    return {
      opacity: animation === 'none' ? 1 : progress.value,
      transform: [
        { translateY },
        { scale },
      ],
    };
  });

  const handleBackdropPress = useCallback(() => {
    if (closeOnBackdrop) {
      onClose();
    }
  }, [closeOnBackdrop, onClose]);

  if (!visible && progress.value === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]} pointerEvents={visible ? 'auto' : 'none'}>
      {showBackdrop && (
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={styles.backdropPressable} onPress={handleBackdropPress} />
        </Animated.View>
      )}

      <Animated.View
        style={[
          styles.content,
          { maxWidth },
          contentAnimatedStyle,
          contentStyle,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * Modal header component
 */
export function ModalHeader({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.header, style]}>{children}</View>;
}

/**
 * Modal body component
 */
export function ModalBody({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.body, style]}>{children}</View>;
}

/**
 * Modal footer component
 */
export function ModalFooter({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.footer, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: Z_INDEX.modal,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.deepOnyx,
    zIndex: Z_INDEX.modalBackdrop,
  },
  backdropPressable: {
    flex: 1,
  },
  content: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.lg,
    width: '90%',
    maxHeight: '85%',
    zIndex: Z_INDEX.modal,
    ...SHADOWS.xl,
  },
  header: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.paperBeige,
  },
  body: {
    padding: SPACING.md,
  },
  footer: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.paperBeige,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
});

export default Modal;
