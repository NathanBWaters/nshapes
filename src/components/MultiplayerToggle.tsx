import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSocket } from '@/context/SocketContext';
import { COLORS, RADIUS } from '@/utils/colors';

const MultiplayerToggle: React.FC = () => {
  const { isMultiplayer, toggleMultiplayer } = useSocket();

  return (
    <View style={styles.container}>
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            !isMultiplayer && styles.toggleButtonActive,
          ]}
          onPress={() => toggleMultiplayer(false)}
        >
          <Text
            style={[
              styles.toggleText,
              !isMultiplayer && styles.toggleTextActive,
            ]}
          >
            SINGLE PLAYER
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            isMultiplayer && styles.toggleButtonActive,
          ]}
          onPress={() => toggleMultiplayer(true)}
        >
          <Text
            style={[
              styles.toggleText,
              isMultiplayer && styles.toggleTextActive,
            ]}
          >
            MULTIPLAYER
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    overflow: 'hidden',
  },
  toggleButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.actionYellow,
  },
  toggleText: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  toggleTextActive: {
    fontWeight: '700',
    color: COLORS.deepOnyx,
  },
});

export default MultiplayerToggle;
