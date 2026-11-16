import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import { useSoundSetting } from '@/hooks/useSoundSetting';
import { analyticsOptedOut, playerCode, setAnalyticsEnabled } from '@/analytics/posthog';
import { resetAdventureSave } from '@/adventure/save';
import { resetAllClassicStorage } from '@/utils/storage';
import { resetTutorialStorage } from '@/context/TutorialContext';
import Icon from './Icon';

interface OptionsMenuProps {
  visible: boolean;
  onClose: () => void;
  onResetGame?: () => void;
}

const OptionsMenu: React.FC<OptionsMenuProps> = ({ visible, onClose, onResetGame }) => {
  // Re-read each time the modal opens: the in-game menu may have changed it
  const [soundEnabled, handleToggleSound] = useSoundSetting(visible);
  const [analyticsOn, setAnalyticsOn] = useState(() => !analyticsOptedOut());
  const [copiedCode, setCopiedCode] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (visible) {
      setAnalyticsOn(!analyticsOptedOut());
      setCopiedCode(false);
      setConfirmingReset(false);
      setResetDone(false);
    }
  }, [visible]);

  const handleConfirmReset = () => {
    resetAdventureSave();
    resetAllClassicStorage();
    void resetTutorialStorage();
    setConfirmingReset(false);
    setResetDone(true);
    onResetGame?.();
  };

  const handleToggleAnalytics = () => {
    const next = !analyticsOn;
    setAnalyticsEnabled(next);
    setAnalyticsOn(next);
  };

  const code = playerCode();

  const handleCopyCode = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const Clipboard = await import('expo-clipboard');
        if (Clipboard?.setStringAsync) await Clipboard.setStringAsync(code);
      }
      setCopiedCode(true);
    } catch {
      /* clipboard may be blocked in unsecure context */
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerText}>OPTIONS</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>X</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Icon name="delapouite/sound-on" size={24} color={COLORS.slateCharcoal} />
                <Text style={styles.settingText}>Sound Effects</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  soundEnabled ? styles.toggleButtonOn : styles.toggleButtonOff,
                ]}
                onPress={handleToggleSound}
              >
                <Text style={[
                  styles.toggleButtonText,
                  soundEnabled ? styles.toggleTextOn : styles.toggleTextOff,
                ]}>
                  {soundEnabled ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Icon name="delapouite/chart" size={24} color={COLORS.slateCharcoal} />
                <Text style={styles.settingText}>Gameplay Analytics</Text>
              </View>
              <TouchableOpacity
                testID="options-analytics-toggle"
                accessibilityRole="button"
                accessibilityState={{ checked: analyticsOn }}
                style={[
                  styles.toggleButton,
                  analyticsOn ? styles.toggleButtonOn : styles.toggleButtonOff,
                ]}
                onPress={handleToggleAnalytics}
              >
                <Text style={[
                  styles.toggleButtonText,
                  analyticsOn ? styles.toggleTextOn : styles.toggleTextOff,
                ]}>
                  {analyticsOn ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingText}>Player ID</Text>
                <Text style={styles.playerCodeText} testID="options-player-code">{code}</Text>
              </View>
              <TouchableOpacity
                testID="options-copy-player-code"
                accessibilityRole="button"
                style={[styles.toggleButton, styles.toggleButtonOff]}
                onPress={handleCopyCode}
              >
                <Text style={styles.toggleTextOff}>{copiedCode ? 'COPIED' : 'COPY'}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.settingRow, { borderBottomWidth: 0, flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
              <View style={styles.resetHeaderRow}>
                <View style={[styles.settingLabel, { flex: 1 }]}>
                  <Icon name="lorc/recycle" size={24} color={COLORS.impactRed} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingText}>Reset Game</Text>
                    <Text style={styles.resetSubtext}>Erase all stars, unlocks & saved progress</Text>
                  </View>
                </View>
                {!confirmingReset && (
                  <TouchableOpacity
                    testID="options-reset-game"
                    accessibilityRole="button"
                    accessibilityLabel="Reset Game"
                    style={[styles.toggleButton, resetDone ? styles.resetDoneBadge : styles.resetOutlineButton]}
                    onPress={() => {
                      setResetDone(false);
                      setConfirmingReset(true);
                    }}
                  >
                    <Text style={[styles.toggleButtonText, resetDone ? styles.toggleTextOn : styles.resetOutlineText]}>
                      {resetDone ? 'RESET ✓' : 'RESET'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {confirmingReset && (
                <View style={styles.confirmBox} testID="options-reset-confirm-box">
                  <Text style={styles.confirmWarningText}>
                    Start over from scratch? This permanently erases all Adventure stars, coins, weapons, fighters, battle history, and saved runs.
                  </Text>
                  <View style={styles.confirmButtonsRow}>
                    <TouchableOpacity
                      testID="options-reset-cancel"
                      accessibilityRole="button"
                      style={[styles.confirmActionBtn, styles.toggleButtonOff]}
                      onPress={() => setConfirmingReset(false)}
                    >
                      <Text style={[styles.toggleButtonText, styles.toggleTextOff]}>CANCEL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID="options-reset-confirm"
                      accessibilityRole="button"
                      style={[styles.confirmActionBtn, styles.dangerSolidButton]}
                      onPress={handleConfirmReset}
                    >
                      <Text style={[styles.toggleButtonText, styles.toggleTextOn]}>START OVER</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {resetDone && !confirmingReset && (
                <Text style={styles.resetDoneText} testID="options-reset-done">
                  All progress cleared — ready for a fresh start!
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>DONE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    width: '85%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: COLORS.logicTeal,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    color: COLORS.canvasWhite,
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: COLORS.canvasWhite,
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    padding: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.paperBeige,
  },
  settingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.deepOnyx,
  },
  playerCodeText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: COLORS.slateCharcoal,
    marginTop: 2,
  },
  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: RADIUS.button,
    minWidth: 70,
    alignItems: 'center',
  },
  toggleButtonOn: {
    backgroundColor: COLORS.logicTeal,
  },
  toggleButtonOff: {
    backgroundColor: COLORS.paperBeige,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  toggleTextOn: {
    color: COLORS.canvasWhite,
  },
  toggleTextOff: {
    color: COLORS.slateCharcoal,
  },
  resetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  resetSubtext: {
    fontSize: 12,
    color: COLORS.slateCharcoal,
    marginTop: 2,
  },
  resetOutlineButton: {
    backgroundColor: '#FFF1F0',
    borderWidth: 1.5,
    borderColor: COLORS.impactRed,
  },
  resetOutlineText: {
    color: COLORS.impactRed,
  },
  resetDoneBadge: {
    backgroundColor: COLORS.logicTeal,
  },
  confirmBox: {
    backgroundColor: '#FFF5F5',
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.impactRed,
    padding: 12,
    gap: 10,
  },
  confirmWarningText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.deepOnyx,
  },
  confirmButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.button,
    alignItems: 'center',
  },
  dangerSolidButton: {
    backgroundColor: COLORS.impactRed,
  },
  resetDoneText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.logicTeal,
  },
  doneButton: {
    backgroundColor: COLORS.actionYellow,
    margin: 20,
    marginTop: 0,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    alignItems: 'center',
  },
  doneButtonText: {
    color: COLORS.deepOnyx,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default OptionsMenu;
