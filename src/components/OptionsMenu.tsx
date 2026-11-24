import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform, ScrollView, Linking } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import { MONO_FONT } from '@/utils/fonts';
import { PRIVACY_POLICY_URL, SUPPORT_URL, STORE_VERSION } from '@/utils/storeUrls';
import { useSoundSetting } from '@/hooks/useSoundSetting';
import { setMusicEnabled } from '@/audio';
import { analyticsOptedOut, playerCode, setAnalyticsEnabled } from '@/analytics/posthog';
import { resetAdventureSave } from '@/adventure/save';
import { resetSpireStorage } from '@/spire/save';
import { resetPrismStorage } from '@/prism/save';
import { ColorblindStorage, MusicStorage, resetAllClassicStorage } from '@/utils/storage';
import { resetTutorialStorage } from '@/context/TutorialContext';
import { version as BUILD_VERSION } from '../../package.json';
import Icon from './Icon';

interface OptionsMenuProps {
  visible: boolean;
  onClose: () => void;
  onResetGame?: () => void;
}

const OptionsMenu: React.FC<OptionsMenuProps> = ({ visible, onClose, onResetGame }) => {
  // Re-read each time the modal opens: another screen may have changed settings meanwhile
  const [soundEnabled, toggleSoundSetting] = useSoundSetting(visible);
  const [musicEnabled, setMusicEnabledState] = useState(() => MusicStorage.get());
  const [colorblindOn, setColorblindOn] = useState(() => ColorblindStorage.get());
  const [analyticsOn, setAnalyticsOn] = useState(() => !analyticsOptedOut());
  const [copiedCode, setCopiedCode] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (visible) {
      setMusicEnabledState(MusicStorage.get());
      setColorblindOn(ColorblindStorage.get());
      setAnalyticsOn(!analyticsOptedOut());
      setCopiedCode(false);
      setConfirmingReset(false);
      setResetDone(false);
    }
  }, [visible]);

  const handleToggleSfx = () => {
    // Keep Music independent if it had not been explicitly set before toggling SFX
    if (!MusicStorage.hasValue()) {
      MusicStorage.set(musicEnabled);
    }
    toggleSoundSetting();
  };

  const handleToggleMusic = () => {
    const next = !musicEnabled;
    setMusicEnabledState(next);
    MusicStorage.set(next);
    if (typeof setMusicEnabled === 'function') {
      setMusicEnabled(next);
    }
  };

  const handleToggleColorblind = () => {
    const next = !colorblindOn;
    setColorblindOn(next);
    ColorblindStorage.set(next);
  };

  const handleConfirmReset = () => {
    resetAdventureSave();
    resetSpireStorage();
    resetPrismStorage();
    resetAllClassicStorage();
    void resetTutorialStorage();
    setConfirmingReset(false);
    setResetDone(true);
    onResetGame?.();
  };

  const openExternalUrl = (url: string) => {
    void Linking.openURL(url).catch(() => {
      /* ignore if browser handler unavailable */
    });
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

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.content} bounces={false}>
            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Icon name="delapouite/harp" size={22} color={COLORS.slateCharcoal} />
                <Text style={styles.settingText}>Music</Text>
              </View>
              <TouchableOpacity
                testID="options-music-toggle"
                accessibilityRole="button"
                accessibilityState={{ checked: musicEnabled }}
                style={[
                  styles.toggleButton,
                  musicEnabled ? styles.toggleButtonOn : styles.toggleButtonOff,
                ]}
                onPress={handleToggleMusic}
              >
                <Text style={[
                  styles.toggleButtonText,
                  musicEnabled ? styles.toggleTextOn : styles.toggleTextOff,
                ]}>
                  {musicEnabled ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Icon name="delapouite/sound-on" size={22} color={COLORS.slateCharcoal} />
                <Text style={styles.settingText}>Sound Effects</Text>
              </View>
              <TouchableOpacity
                testID="options-sfx-toggle"
                accessibilityRole="button"
                accessibilityState={{ checked: soundEnabled }}
                style={[
                  styles.toggleButton,
                  soundEnabled ? styles.toggleButtonOn : styles.toggleButtonOff,
                ]}
                onPress={handleToggleSfx}
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
                <Icon name="lorc/spectacles" size={22} color={COLORS.slateCharcoal} />
                <View style={styles.labelCol}>
                  <Text style={styles.settingText}>Colorblind Mode</Text>
                  <Text style={styles.settingSubtext}>High-contrast palette & R/B/P labels</Text>
                </View>
              </View>
              <TouchableOpacity
                testID="options-colorblind-toggle"
                accessibilityRole="button"
                accessibilityState={{ checked: colorblindOn }}
                style={[
                  styles.toggleButton,
                  colorblindOn ? styles.toggleButtonOn : styles.toggleButtonOff,
                ]}
                onPress={handleToggleColorblind}
              >
                <Text style={[
                  styles.toggleButtonText,
                  colorblindOn ? styles.toggleTextOn : styles.toggleTextOff,
                ]}>
                  {colorblindOn ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Icon name="delapouite/chart" size={22} color={COLORS.slateCharcoal} />
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
              <View style={styles.labelCol}>
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

            <View style={styles.legalLinksRow}>
              <TouchableOpacity
                testID="options-privacy-link"
                accessibilityRole="link"
                style={styles.legalLinkButton}
                onPress={() => openExternalUrl(PRIVACY_POLICY_URL)}
              >
                <Text style={styles.legalLinkText}>Privacy Policy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="options-support-link"
                accessibilityRole="link"
                style={styles.legalLinkButton}
                onPress={() => openExternalUrl(SUPPORT_URL)}
              >
                <Text style={styles.legalLinkText}>Support &amp; FAQ</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.settingRow, { borderBottomWidth: 0, flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
              <View style={styles.resetHeaderRow}>
                <View style={[styles.settingLabel, { flex: 1 }]}>
                  <Icon name="lorc/recycle" size={22} color={COLORS.impactRed} />
                  <View style={styles.labelCol}>
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

            <Text style={styles.versionCaption} testID="options-version">
              NShapes v{STORE_VERSION} (build {BUILD_VERSION})
            </Text>
          </ScrollView>

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
    width: '90%',
    maxWidth: 400,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  scrollArea: {
    flexShrink: 1,
  },
  header: {
    backgroundColor: COLORS.logicTeal,
    paddingVertical: 14,
    paddingHorizontal: 18,
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
    width: 32,
    height: 32,
    borderRadius: 16,
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
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.paperBeige,
  },
  settingLabel: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  labelCol: {
    flex: 1,
    minWidth: 0,
  },
  settingText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.deepOnyx,
  },
  settingSubtext: {
    flexShrink: 1,
    fontSize: 11,
    color: COLORS.slateCharcoal,
    marginTop: 1,
  },
  playerCodeText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: MONO_FONT,
    color: COLORS.slateCharcoal,
    marginTop: 2,
  },
  legalLinksRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.paperBeige,
  },
  legalLinkButton: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    paddingVertical: 9,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  legalLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.logicTeal,
  },
  versionCaption: {
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.slateCharcoal,
    opacity: 0.6,
    paddingTop: 4,
    paddingBottom: 8,
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
