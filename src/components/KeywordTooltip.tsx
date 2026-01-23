/**
 * KeywordTooltip
 *
 * A bottom sheet that displays keyword explanations.
 * Shows brief definition at top, detailed explanation below.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useKeyword } from '../context/KeywordContext';
import { COLORS, RADIUS } from '../utils/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * KeywordTooltip displays a bottom sheet with keyword information.
 * Place this component once at the root of your app (inside KeywordProvider).
 */
const KeywordTooltip: React.FC = () => {
  const { isOpen, activeKeyword, activeDefinition, closeKeyword } = useKeyword();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Animate slide up/down
  useEffect(() => {
    if (isOpen) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isOpen, slideAnim]);

  if (!activeDefinition) {
    return null;
  }

  // Format keyword ID to display name (camelCase -> Title Case)
  const displayName = activeKeyword
    ? activeKeyword
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim()
    : '';

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={closeKeyword}
      statusBarTranslucent
    >
      {/* Backdrop - tap to dismiss */}
      <TouchableWithoutFeedback onPress={closeKeyword}>
        <View style={styles.overlay}>
          {/* Bottom sheet container - prevent tap through */}
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.bottomSheet,
                { transform: [{ translateY: slideAnim }] },
              ]}
            >
              {/* Handle bar */}
              <View style={styles.handleBar} />

              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>{displayName}</Text>
                <TouchableOpacity
                  onPress={closeKeyword}
                  style={styles.closeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.closeButtonText}>Done</Text>
                </TouchableOpacity>
              </View>

              {/* Content */}
              <View style={styles.content}>
                {/* Brief - one liner at top */}
                <Text style={styles.brief}>{activeDefinition.brief}</Text>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Detailed explanation */}
                <Text style={styles.detailed}>{activeDefinition.detailed}</Text>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.6)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: COLORS.canvasWhite,
    borderTopLeftRadius: RADIUS.container,
    borderTopRightRadius: RADIUS.container,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: COLORS.slateCharcoal,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24, // Safe area for home indicator
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.slateCharcoal,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
    opacity: 0.3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.paperBeige,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textTransform: 'capitalize',
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.logicTeal,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  brief: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.paperBeige,
    marginVertical: 16,
  },
  detailed: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.slateCharcoal,
    lineHeight: 21,
    opacity: 0.85,
  },
});

export default KeywordTooltip;
