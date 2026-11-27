/**
 * Interruptible animated modal host (Native + Jest implementation).
 *
 * Keeps `<Modal>` mounted while an exit transition plays, while immediately
 * dropping `pointerEvents`, `onRequestClose`, and accessibility exposure as
 * soon as `interactive` becomes `false`. On web, `MotionModal.web.tsx` replaces
 * React Native Web's blocking `ModalAnimation` / `ModalContent` wrapper with a
 * direct `createPortal` layer that guarantees zero swallowed taps during exit.
 */
import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';

export interface MotionModalProps {
  /** True while the modal should remain mounted (including its exit choreography). */
  visible: boolean;
  /** True while open and interactive; flips to `false` synchronously when exiting. */
  interactive: boolean;
  onRequestClose?: () => void;
  transparent?: boolean;
  statusBarTranslucent?: boolean;
  testID?: string;
  children: React.ReactNode;
}

export const MotionModal: React.FC<MotionModalProps> = ({
  visible,
  interactive,
  onRequestClose,
  transparent = true,
  statusBarTranslucent,
  testID,
  children,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={transparent}
      animationType="none"
      statusBarTranslucent={statusBarTranslucent}
      onRequestClose={interactive ? onRequestClose : undefined}
      testID={testID}
    >
      <View
        style={st.fill}
        pointerEvents={interactive ? 'auto' : 'none'}
        accessibilityElementsHidden={!interactive}
        importantForAccessibility={interactive ? 'auto' : 'no-hide-descendants'}
      >
        {children}
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
