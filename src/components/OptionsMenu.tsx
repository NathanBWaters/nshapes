import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import { SettingsStorage } from '@/utils/storage';
import { setAudioEnabled, isAudioEnabled } from '@/utils/sounds';
import Icon from './Icon';

interface OptionsMenuProps {
  visible: boolean;
  onClose: () => void;
}

const OptionsMenu: React.FC<OptionsMenuProps> = ({ visible, onClose }) => {
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Load setting on mount
  useEffect(() => {
    setSoundEnabled(SettingsStorage.getSoundEnabled());
  }, [visible]);

  const handleToggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    setAudioEnabled(newValue);
    SettingsStorage.setSoundEnabled(newValue);
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
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerText}>OPTIONS</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>X</Text>
            </TouchableOpacity>
          </View>

          {/* Settings */}
          <View style={styles.content}>
            {/* Sound Toggle Row */}
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
          </View>

          {/* Close Button */}
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
