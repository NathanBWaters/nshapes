import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { COLORS, RADIUS } from '@/utils/colors';

interface MultiplayerLobbyProps {
  roomId: string;
  isHost: boolean;
  onStartGame: () => void;
}

const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  roomId,
  isHost,
  onStartGame
}) => {
  const [copied, setCopied] = useState(false);

  const copyRoomId = async () => {
    await Clipboard.setStringAsync(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>MULTIPLAYER LOBBY</Text>
      </View>

      <View style={styles.content}>
        {/* Room ID Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ROOM ID</Text>
          <View style={styles.roomIdContainer}>
            <View style={styles.roomIdBox}>
              <Text style={styles.roomIdText}>{roomId}</Text>
            </View>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={copyRoomId}
            >
              <Text style={styles.copyButtonText}>
                {copied ? 'COPIED!' : 'COPY'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helpText}>
            Share this Room ID with your friends to let them join
          </Text>
        </View>

        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, isHost ? styles.statusHost : styles.statusPlayer]}>
            <Text style={styles.statusText}>
              {isHost ? 'YOU ARE THE HOST' : 'WAITING FOR HOST'}
            </Text>
          </View>
        </View>

        {/* Actions */}
        {isHost ? (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.startButton}
              onPress={onStartGame}
            >
              <Text style={styles.startButtonText}>START GAME</Text>
            </TouchableOpacity>
            <Text style={styles.actionHelp}>
              Click to start the game when all players have joined
            </Text>
          </View>
        ) : (
          <View style={styles.waitingContainer}>
            <View style={styles.dotsContainer}>
              <View style={styles.dot} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
            <Text style={styles.waitingText}>
              Waiting for host to start the game...
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    marginVertical: 32,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
    alignItems: 'center',
  },
  headerText: {
    color: COLORS.deepOnyx,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 8,
    textAlign: 'center',
  },
  roomIdContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  roomIdBox: {
    backgroundColor: COLORS.paperBeige,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    borderTopLeftRadius: RADIUS.button,
    borderBottomLeftRadius: RADIUS.button,
  },
  roomIdText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 18,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  copyButton: {
    backgroundColor: COLORS.actionYellow,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: COLORS.slateCharcoal,
    borderTopRightRadius: RADIUS.button,
    borderBottomRightRadius: RADIUS.button,
  },
  copyButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  helpText: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    opacity: 0.7,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statusBadge: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  statusHost: {
    backgroundColor: COLORS.logicTeal,
  },
  statusPlayer: {
    backgroundColor: COLORS.paperBeige,
  },
  statusText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
  },
  actionContainer: {
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    shadowColor: COLORS.deepOnyx,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 4,
  },
  startButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1,
  },
  actionHelp: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    opacity: 0.7,
  },
  waitingContainer: {
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.logicTeal,
  },
  waitingText: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 12,
    opacity: 0.7,
  },
});

export default MultiplayerLobby;
