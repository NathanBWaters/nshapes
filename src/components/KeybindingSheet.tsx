/**
 * [UI-23] Visual Desktop Keyboard & Keybinding Configuration Sheet (Sakurai Ep. #195).
 *
 * Features:
 * - Interactive 3x4 visual card-board diagram + action keycaps bar (tap any cell/row to rebind)
 * - Select action -> press any key to bind (duplicate bindings explicitly allowed!)
 * - Replace vs. Add Secondary Key mode so one action can hold multiple keys (e.g. `1` + `Q`)
 * - 1-tap Confirm <-> Cancel swap (zero lockout!)
 * - Built-in layout presets (`Standard`, `1-9 Numeric`, `QWE Spatial`) + 1-click Reset Defaults
 * - >=44x44px tactile touch targets & global z-priority stack capture (`KEY_PRIORITY.CAPTURE`)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import { MONO_FONT } from '@/utils/fonts';
import { playSound } from '@/utils/sounds';
import { triggerHaptic } from '@/utils/haptics';
import {
  CARD_SLOT_ACTIONS,
  formatActionKeys,
  formatKeyLabel,
  getDuplicateKeyMap,
  KEY_ACTION_META,
  KeybindingsStorage,
  useKeybindings,
  type KeyAction,
  type KeybindingPresetId,
} from '@/utils/keybindings';
import Animated from 'react-native-reanimated';
import { KEY_PRIORITY, useKeyboardNav } from '@/hooks/useKeyboardNav';
import Icon from './Icon';
import { useModalMotion } from './ScreenTransition';

export interface KeybindingSheetProps {
  visible: boolean;
  onClose: () => void;
  profileId?: string;
}

const PRIMARY_ACTIONS: readonly KeyAction[] = [
  'confirm',
  'cancel',
  'hint',
  'retry',
  'sacrifice',
  'clear',
] as const;

const DIAGRAM_SLOTS = CARD_SLOT_ACTIONS.slice(0, 12);

const PRESET_OPTIONS: readonly { id: KeybindingPresetId; label: string; hint: string }[] = [
  { id: 'standard', label: 'Combined', hint: '1-9 & QWE' },
  { id: 'numeric', label: 'Numeric', hint: '1-9 / 0 / - / =' },
  { id: 'spatial', label: 'Spatial', hint: 'QWE / ASD / ZXC' },
] as const;

const KeybindingSheet: React.FC<KeybindingSheetProps> = ({
  visible,
  onClose,
  profileId = 'default',
}) => {
  const bindings = useKeybindings(profileId);
  const [listeningAction, setListeningAction] = useState<KeyAction | null>(null);
  const [bindMode, setBindMode] = useState<'replace' | 'add'>('replace');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setListeningAction(null);
      setBindMode('replace');
      setStatusMessage(null);
    }
  }, [visible]);

  const duplicateMap = useMemo(() => getDuplicateKeyMap(bindings), [bindings]);

  const handleClose = useCallback(() => {
    setListeningAction(null);
    onClose();
  }, [onClose]);

  const commitKeyForAction = useCallback(
    (action: KeyAction, key: string) => {
      const updated = KeybindingsStorage.bindAction(action, key, {
        mode: bindMode,
        profileId,
      });
      const meta = KEY_ACTION_META[action];
      const dupes = getDuplicateKeyMap(updated);
      const shared = dupes[key];
      if (shared && shared.length > 1) {
        setStatusMessage(
          `Bound ${formatKeyLabel(key)} to ${meta.shortLabel} (shared with ${shared.length - 1} other action${shared.length - 1 === 1 ? '' : 's'}).`
        );
      } else {
        setStatusMessage(`Bound ${formatKeyLabel(key)} to ${meta.shortLabel}.`);
      }
      setListeningAction(null);
      playSound('click');
    },
    [bindMode, profileId]
  );

  // Capture ANY key when listening for a new binding (topmost priority, preempts Cancel/Escape)
  useKeyboardNav({
    enabled: visible && listeningAction !== null,
    priority: KEY_PRIORITY.CAPTURE,
    profileId,
    onRawKey: key => {
      if (!listeningAction) return false;
      commitKeyForAction(listeningAction, key);
      return true;
    },
  });

  // Escape closes KeybindingSheet when not actively recording a key
  useKeyboardNav({
    enabled: visible && listeningAction === null,
    priority: KEY_PRIORITY.OVERLAY,
    profileId,
    onCancel: handleClose,
  });

  const handleSwapConfirmCancel = () => {
    triggerHaptic('light');
    playSound('click');
    const next = KeybindingsStorage.swapConfirmCancel(profileId);
    setListeningAction(null);
    setStatusMessage(
      `Swapped Confirm (${formatActionKeys(next.confirm)}) and Back (${formatActionKeys(next.cancel)}).`
    );
  };

  const handleApplyPreset = (preset: KeybindingPresetId) => {
    triggerHaptic('light');
    playSound('click');
    KeybindingsStorage.applyPreset(preset, profileId);
    setListeningAction(null);
    const found = PRESET_OPTIONS.find(p => p.id === preset);
    setStatusMessage(`Applied ${found?.label ?? preset} keyboard layout.`);
  };

  const handleResetDefaults = () => {
    triggerHaptic('light');
    playSound('click');
    KeybindingsStorage.reset(profileId);
    setListeningAction(null);
    setStatusMessage('Restored default keyboard controls.');
  };

  const startListening = (action: KeyAction) => {
    triggerHaptic('light');
    playSound('click');
    setStatusMessage(null);
    setListeningAction(prev => (prev === action ? null : action));
  };

  const hasSharedKeysForAction = (action: KeyAction): boolean =>
    (bindings[action] ?? []).some(k => (duplicateMap[k]?.length ?? 0) > 1);

  const { rendered, closing, backdropStyle, panelStyle, contentStyle } = useModalMotion(visible, {
    travelY: 32,
    sheet: true,
  });

  if (!rendered) return null;

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay} testID="keybinding-sheet" pointerEvents={closing ? 'none' : 'auto'}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlayBackdrop, backdropStyle]} />
        <Animated.View style={[styles.container, panelStyle]}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Icon name="lorc/gear-hammer" size={20} color={COLORS.canvasWhite} noShadow />
              <Text style={styles.headerText}>KEYBOARD CONTROLS</Text>
            </View>
            <TouchableOpacity
              testID="keybinding-close"
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close Keyboard Controls"
              style={styles.closeButton}
            >
              <Icon name="lorc/cross-mark" size={16} color={COLORS.canvasWhite} noShadow />
            </TouchableOpacity>
          </View>

          <Animated.View style={[{ flexShrink: 1 }, contentStyle]}>
          {listeningAction && (
            <View style={styles.listeningBanner} testID="keybinding-listening-banner">
              <View style={styles.listeningCol}>
                <Text style={styles.listeningTitle}>
                  Press any key for {KEY_ACTION_META[listeningAction].label}
                </Text>
                <Text style={styles.listeningSub}>
                  {bindMode === 'add'
                    ? 'Adding a secondary key (existing keys stay bound).'
                    : 'Replaces current key. Duplicate bindings across actions are allowed.'}
                </Text>
              </View>
              <TouchableOpacity
                testID="keybinding-cancel-listen"
                onPress={() => setListeningAction(null)}
                accessibilityRole="button"
                style={styles.cancelListenBtn}
              >
                <Text style={styles.cancelListenText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {statusMessage && !listeningAction && (
            <View style={styles.statusBanner} testID="keybinding-status">
              <Text style={styles.statusText}>{statusMessage}</Text>
            </View>
          )}

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.content}
            bounces={false}
          >
            {/* Visual Interactive 3x4 Board & Action Keyboard Diagram */}
            <View style={styles.sectionBox} testID="keybinding-visual-diagram">
              <View style={styles.sectionHeadRow}>
                <Text style={styles.sectionTitle}>BOARD KEYMAP DIAGRAM</Text>
                <Text style={styles.sectionHint}>Tap any card slot to rebind</Text>
              </View>
              <View style={styles.diagramGrid}>
                {DIAGRAM_SLOTS.map((slotAction, idx) => {
                  const active = listeningAction === slotAction;
                  const shared = hasSharedKeysForAction(slotAction);
                  const keys = bindings[slotAction] ?? [];
                  return (
                    <Pressable
                      key={slotAction}
                      testID={`keybinding-diagram-${slotAction}`}
                      onPress={() => startListening(slotAction)}
                      accessibilityRole="button"
                      accessibilityLabel={`Rebind Card ${idx + 1}: currently ${formatActionKeys(keys)}`}
                      style={({ pressed }) => [
                        styles.diagramCell,
                        active && styles.diagramCellListening,
                        shared && !active && styles.diagramCellShared,
                        pressed && styles.pressed,
                        Platform.OS === 'web' && { cursor: 'pointer' as any },
                      ]}
                    >
                      <Text style={styles.diagramSlotNum}>#{idx + 1}</Text>
                      <Text style={styles.diagramKeyText} numberOfLines={1}>
                        {active ? 'PRESS...' : formatActionKeys(keys)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Quick Controls: Bind Mode + Confirm/Cancel Swap + Presets */}
            <View style={styles.quickTools}>
              <View style={styles.modeRow}>
                <TouchableOpacity
                  testID="keybinding-mode-replace"
                  onPress={() => setBindMode('replace')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: bindMode === 'replace' }}
                  style={[styles.modePill, bindMode === 'replace' && styles.modePillActive]}
                >
                  <Text style={[styles.modePillText, bindMode === 'replace' && styles.modePillTextActive]}>
                    Replace Key
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="keybinding-mode-add"
                  onPress={() => setBindMode('add')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: bindMode === 'add' }}
                  style={[styles.modePill, bindMode === 'add' && styles.modePillActive]}
                >
                  <Text style={[styles.modePillText, bindMode === 'add' && styles.modePillTextActive]}>
                    Add Extra Key
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                testID="keybinding-swap-confirm-cancel"
                onPress={handleSwapConfirmCancel}
                accessibilityRole="button"
                style={styles.swapBtn}
              >
                <Icon name="lorc/cycle" size={16} color={COLORS.deepOnyx} noShadow />
                <Text style={styles.swapBtnText}>
                  Swap Confirm ({formatActionKeys(bindings.confirm)}) / Back ({formatActionKeys(bindings.cancel)})
                </Text>
              </TouchableOpacity>

              <View style={styles.presetRow}>
                {PRESET_OPTIONS.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    testID={`keybinding-preset-${p.id}`}
                    onPress={() => handleApplyPreset(p.id)}
                    accessibilityRole="button"
                    style={styles.presetBtn}
                  >
                    <Text style={styles.presetTitle}>{p.label}</Text>
                    <Text style={styles.presetHint}>{p.hint}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Core Menu & Battle Actions */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>MENU & BATTLE ACTIONS</Text>
              {PRIMARY_ACTIONS.map(action => {
                const meta = KEY_ACTION_META[action];
                const active = listeningAction === action;
                const shared = hasSharedKeysForAction(action);
                const keys = bindings[action] ?? [];
                return (
                  <View key={action} style={styles.actionRow}>
                    <View style={styles.actionInfo}>
                      <View style={styles.actionNameRow}>
                        <Text style={styles.actionLabel}>{meta.label}</Text>
                        {shared && (
                          <View style={styles.sharedBadge} testID={`keybinding-shared-${action}`}>
                            <Text style={styles.sharedBadgeText}>SHARED</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.actionDesc}>{meta.description}</Text>
                    </View>
                    <TouchableOpacity
                      testID={`keybinding-action-${action}`}
                      onPress={() => startListening(action)}
                      accessibilityRole="button"
                      accessibilityLabel={`Bind ${meta.label}, currently ${formatActionKeys(keys)}`}
                      style={[styles.keycapBtn, active && styles.keycapBtnListening]}
                    >
                      <Text style={[styles.keycapText, active && styles.keycapTextListening]}>
                        {active ? 'PRESS KEY' : formatActionKeys(keys)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity
              testID="keybinding-reset-defaults"
              onPress={handleResetDefaults}
              accessibilityRole="button"
              style={styles.resetBtn}
            >
              <Icon name="lorc/recycle" size={16} color={COLORS.redSurface} noShadow />
              <Text style={styles.resetBtnText}>Reset Default Keybindings</Text>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity
            testID="keybinding-done"
            style={styles.doneButton}
            onPress={handleClose}
            accessibilityRole="button"
          >
            <Text style={styles.doneButtonText}>DONE</Text>
          </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  overlayBackdrop: {
    backgroundColor: 'rgba(18, 18, 18, 0.74)',
  },
  container: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2.5,
    borderBottomWidth: 6,
    borderColor: COLORS.slateCharcoal,
    width: '100%',
    maxWidth: 460,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: COLORS.tealSurface,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  headerTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    flexShrink: 1,
    color: COLORS.canvasWhite,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listeningBanner: {
    backgroundColor: COLORS.actionYellow,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.slateCharcoal,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  listeningCol: {
    flex: 1,
    minWidth: 0,
  },
  listeningTitle: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.deepOnyx,
  },
  listeningSub: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
    marginTop: 2,
  },
  cancelListenBtn: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 12,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.canvasWhite,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelListenText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.deepOnyx,
  },
  statusBanner: {
    backgroundColor: '#E6F4F1',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.tealSurface,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.tealSurface,
  },
  scrollArea: {
    flexShrink: 1,
  },
  content: {
    padding: 14,
    gap: 12,
  },
  sectionBox: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.module,
    borderWidth: 1.5,
    borderColor: '#D6CFC4',
    padding: 10,
    gap: 8,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    color: COLORS.slateCharcoal,
  },
  sectionHint: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
    opacity: 0.72,
  },
  diagramGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  diagramCell: {
    width: '31.5%',
    minHeight: 48,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 8,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: COLORS.slateCharcoal,
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  diagramCellListening: {
    backgroundColor: COLORS.actionYellow,
    borderColor: COLORS.deepOnyx,
  },
  diagramCellShared: {
    borderColor: COLORS.orangeSurface,
  },
  diagramSlotNum: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    opacity: 0.7,
  },
  diagramKeyText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: MONO_FONT,
    color: COLORS.deepOnyx,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  quickTools: {
    gap: 8,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modePill: {
    flex: 1,
    minHeight: 44,
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.paperBeige,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  modePillActive: {
    backgroundColor: COLORS.tealSurface,
    borderColor: COLORS.tealSurface,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
  },
  modePillTextActive: {
    color: COLORS.canvasWhite,
  },
  swapBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF8CC',
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: COLORS.slateCharcoal,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  swapBtnText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.deepOnyx,
    textAlign: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
  },
  presetBtn: {
    flex: 1,
    minHeight: 44,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.deepOnyx,
  },
  presetHint: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
    opacity: 0.78,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#DFD8CC',
  },
  actionInfo: {
    flex: 1,
    minWidth: 0,
  },
  actionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionLabel: {
    flexShrink: 1,
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.deepOnyx,
  },
  actionDesc: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.slateCharcoal,
    marginTop: 2,
  },
  sharedBadge: {
    backgroundColor: COLORS.orangeSurface,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  sharedBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.canvasWhite,
    letterSpacing: 0.6,
  },
  keycapBtn: {
    minWidth: 96,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: COLORS.canvasWhite,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: COLORS.slateCharcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keycapBtnListening: {
    backgroundColor: COLORS.actionYellow,
    borderColor: COLORS.deepOnyx,
  },
  keycapText: {
    fontSize: 11.5,
    fontWeight: '800',
    fontFamily: MONO_FONT,
    color: COLORS.deepOnyx,
  },
  keycapTextListening: {
    color: COLORS.deepOnyx,
  },
  resetBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.redSurface,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  resetBtnText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.redSurface,
  },
  doneButton: {
    backgroundColor: COLORS.actionYellow,
    margin: 14,
    marginTop: 0,
    minHeight: 48,
    borderRadius: RADIUS.button,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: COLORS.slateCharcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    color: COLORS.deepOnyx,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});

export default KeybindingSheet;
