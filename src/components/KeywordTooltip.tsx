/**
 * KeywordTooltip
 *
 * A bottom sheet that displays keyword explanations.
 * Shows brief definition at top, detailed explanation below.
 */

import React, { useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useKeyword } from '../context/KeywordContext';
import { COLORS, RADIUS } from '../utils/colors';
import { useModalMotion } from './ScreenTransition';

/**
 * KeywordTooltip displays a bottom sheet with keyword information.
 * Place this component once at the root of your app (inside KeywordProvider).
 * Uses `useWindowDimensions()` (fixes stale module-load `SCREEN_HEIGHT`) and
 * `useModalMotion` for smooth Disney-12 enter/exit choreography.
 */
const KeywordTooltip: React.FC = () => {
  const { isOpen, activeKeyword, activeDefinition, closeKeyword } = useKeyword();
  const { height: windowHeight } = useWindowDimensions();

  const lastKeywordRef = useRef(activeKeyword);
  const lastDefinitionRef = useRef(activeDefinition);
  if (activeDefinition) {
    lastKeywordRef.current = activeKeyword;
    lastDefinitionRef.current = activeDefinition;
  }

  const showing = isOpen && Boolean(activeDefinition);
  const { rendered, closing, backdropStyle, panelStyle, contentStyle } = useModalMotion(showing, {
    travelY: 96,
    sheet: true,
  });

  const shownKeyword = activeDefinition ? activeKeyword : lastKeywordRef.current;
  const shownDefinition = activeDefinition ?? lastDefinitionRef.current;

  if (!rendered || !shownDefinition) {
    return null;
  }

  // Format keyword ID to display name (camelCase -> Title Case)
  const displayName = shownKeyword
    ? shownKeyword
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim()
    : '';

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      onRequestClose={closeKeyword}
      statusBarTranslucent
    >
      {/* Backdrop - tap to dismiss */}
      <TouchableWithoutFeedback onPress={closeKeyword}>
        <View style={styles.overlay} pointerEvents={closing ? 'none' : 'auto'}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlayBackdrop, backdropStyle]} />
          {/* Bottom sheet container - prevent tap through */}
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.bottomSheet,
                { maxHeight: Math.round(windowHeight * 0.6) },
                panelStyle,
              ]}
            >
              <View style={styles.handleBar} />

              <Animated.View style={contentStyle}>
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

                <View style={styles.content}>
                  {/* Brief - one liner at top */}
                  <Text style={styles.brief}>{shownDefinition.brief}</Text>

                  <View style={styles.divider} />

                  <Text style={styles.detailed}>{shownDefinition.detailed}</Text>
                </View>
              </Animated.View>
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
    justifyContent: 'flex-end',
  },
  overlayBackdrop: {
    backgroundColor: 'rgba(18, 18, 18, 0.6)',
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
