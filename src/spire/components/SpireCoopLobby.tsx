/**
 * Starfall Summit — 2P Co-Op Duo Lobby Card.
 *
 * Tactile tabletop storybook room creation & join flow:
 *  - Create Duo Room (4-char room code pill + 1-tap Copy Invite Link via expo-clipboard)
 *  - Join Room (4-char input + Join button; auto-joins if `initialCoopCode` came from URL)
 *  - Both players' live animated FighterAvatars, fighter picker, Ready toggle,
 *    connection status badge, and Host "Start Duo Climb" button once both are ready.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { COLORS } from '@/utils/colors';
import { MONO_FONT } from '@/utils/fonts';
import type { CharacterName } from '@/types';
import { FIGHTERS } from '@/adventure/data/fighters';
import {
  buildSummitCoopShareUrl,
  DEFAULT_SHARE_BASE_URL,
  normalizeCoopRoomCode,
} from '@/adventure/dailySeed';
import { sfx } from '@/audio';
import { Btn, Eyebrow, INK, TONE } from '@/adventure/components/ui';
import type { SpireCoopConnectionState, SpireCoopPlayerView } from '../types';
import {
  SpireLightweightBreath,
  SpireStatPop,
  SpireTactilePressable,
} from './SpireMotion';

export interface SpireCoopLobbyProps {
  roomCode: string | null;
  connectionState: SpireCoopConnectionState;
  errorMessage?: string | null;
  isHost: boolean;
  localPlayer: SpireCoopPlayerView | null;
  allyPlayer: SpireCoopPlayerView | null;
  selectedFighter: CharacterName;
  ascension: number;
  maxSelectableAsc: number;
  initialCoopCode?: string;
  coopServer?: string;
  canStartClimb: boolean;
  onSelectFighter: (fighter: CharacterName) => void;
  onChangeAscension?: (next: number) => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
  onToggleReady: () => void;
  onStartClimb: () => void;
}

const copyInviteText = async (text: string): Promise<boolean> => {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const Clipboard = await import('expo-clipboard');
    if (Clipboard?.setStringAsync) {
      await Clipboard.setStringAsync(text);
      return true;
    }
  } catch {
    // Clipboard unavailable
  }
  return false;
};

const resolveInviteBaseUrl = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const cleanPath = (window.location.pathname || '').replace(/\/+$/, '');
    return `${window.location.origin}${cleanPath}`;
  }
  return DEFAULT_SHARE_BASE_URL;
};

const CONNECTION_BADGE: Record<
  SpireCoopConnectionState,
  { label: string; bg: string; fg: string; border: string }
> = {
  idle: { label: 'OFFLINE', bg: COLORS.paperBeige, fg: TONE.spent, border: '#B8B0A4' },
  creating: { label: 'CREATING…', bg: '#FEF3C7', fg: '#92400E', border: '#D97706' },
  connecting: { label: 'CONNECTING…', bg: '#FEF3C7', fg: '#92400E', border: '#D97706' },
  connected: { label: 'CONNECTED', bg: '#CCFBF1', fg: '#0F766E', border: '#0F766E' },
  reconnecting: { label: 'RECONNECTING…', bg: '#FFEDD5', fg: '#C2410C', border: '#EA580C' },
  error: { label: 'OFFLINE', bg: '#FEE2E2', fg: '#991B1B', border: '#DC2626' },
};

const SpireCoopLobby: React.FC<SpireCoopLobbyProps> = ({
  roomCode,
  connectionState,
  errorMessage,
  isHost,
  localPlayer,
  allyPlayer,
  selectedFighter,
  ascension,
  maxSelectableAsc,
  initialCoopCode,
  coopServer,
  canStartClimb,
  onSelectFighter,
  onChangeAscension,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onToggleReady,
  onStartClimb,
}) => {
  const [joinInput, setJoinInput] = useState<string>(() => normalizeCoopRoomCode(initialCoopCode) ?? '');
  const [copiedInvite, setCopiedInvite] = useState(false);
  const didAutoJoinRef = useRef<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const normalized = normalizeCoopRoomCode(initialCoopCode);
    if (normalized) {
      setJoinInput(normalized);
      if (!roomCode && connectionState === 'idle' && didAutoJoinRef.current !== normalized) {
        didAutoJoinRef.current = normalized;
        onJoinRoom(normalized);
      }
    }
  }, [initialCoopCode, roomCode, connectionState, onJoinRoom]);

  useEffect(() => {
    setCopiedInvite(false);
  }, [roomCode]);

  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    []
  );

  const inviteUrl = useMemo(() => {
    if (!roomCode) return '';
    return buildSummitCoopShareUrl({
      code: roomCode,
      baseUrl: resolveInviteBaseUrl(),
      coopServer,
    });
  }, [roomCode, coopServer]);

  const handleCopyInvite = async () => {
    if (!inviteUrl) return;
    await copyInviteText(inviteUrl);
    sfx('click');
    setCopiedInvite(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedInvite(false), 3000);
  };

  const normalizedInput = normalizeCoopRoomCode(joinInput);
  const busyConnecting = connectionState === 'creating' || connectionState === 'connecting';
  const connStyle = CONNECTION_BADGE[connectionState];

  const localReady = Boolean(localPlayer?.ready);
  const allyStatusText = !allyPlayer
    ? 'Waiting for partner to join…'
    : !allyPlayer.connected
      ? `${allyPlayer.name} · Reconnecting…`
      : allyPlayer.ready
        ? `${allyPlayer.name} · Ready ✓`
        : `${allyPlayer.name} · Choosing fighter…`;

  const displayLocalFighter = localPlayer?.fighter ?? selectedFighter;

  return (
    <View style={st.stack} testID="coop-lobby">
      {/* Lobby Hero & Connection Header */}
      <View style={st.card}>
        <View style={st.headerRow}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Eyebrow text="2P CO-OP DUO" color={COLORS.actionYellow} />
            <Text style={st.title}>Starfall Duo Climb</Text>
            <Text style={st.sub}>
              Twin boards, shared Boss HP (1.75×), Cross-Parries, shared Synergy &amp; Golden Cage revives!
            </Text>
          </View>
          <View
            testID="coop-connection-status"
            style={[
              st.connBadge,
              { backgroundColor: connStyle.bg, borderColor: connStyle.border },
            ]}
          >
            <Icon
              name={connectionState === 'connected' ? 'lorc/linked-rings' : 'lorc/hourglass'}
              size={11}
              color={connStyle.fg}
              noShadow
            />
            <Text style={[st.connText, { color: connStyle.fg }]}>{connStyle.label}</Text>
          </View>
        </View>

        {errorMessage ? (
          <View style={st.errorBox} testID="coop-error-banner">
            <Icon name="lorc/laser-warning" size={14} color="#991B1B" noShadow />
            <Text style={st.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {!roomCode ? (
          /* Entry state: Create or Join a Duo Room */
          <View style={st.entryWrap}>
            <Btn
              testID="coop-create-btn"
              label={connectionState === 'creating' ? 'Creating Room…' : 'Create Duo Room'}
              icon="lorc/two-shadows"
              disabled={busyConnecting}
              onPress={() => {
                sfx('confirm');
                onCreateRoom();
              }}
            />

            <View style={st.dividerRow}>
              <View style={st.dividerLine} />
              <Text style={st.dividerText}>OR JOIN A PARTNER</Text>
              <View style={st.dividerLine} />
            </View>

            <View style={st.joinRow}>
              <TextInput
                testID="coop-join-input"
                value={joinInput}
                onChangeText={val =>
                  setJoinInput(val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))
                }
                placeholder="FOX7"
                placeholderTextColor={TONE.spent}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={4}
                style={st.codeInput}
                accessibilityLabel="4-character room code"
              />
              <Btn
                testID="coop-join-btn"
                label={connectionState === 'connecting' ? 'Joining…' : 'Join Room'}
                variant="secondary"
                disabled={!normalizedInput || busyConnecting}
                onPress={() => {
                  if (!normalizedInput) return;
                  sfx('confirm');
                  onJoinRoom(normalizedInput);
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : (
          /* Active Room State: Room Code Pill + Invite Link + Dual Fighter Stage */
          <View style={st.roomWrap}>
            <View style={st.codeBanner}>
              <View style={{ gap: 2 }}>
                <Text style={st.codeEyebrow}>ROOM CODE</Text>
                <SpireStatPop value={roomCode}>
                  <Text testID="coop-room-code" style={st.codeBig}>
                    {roomCode}
                  </Text>
                </SpireStatPop>
              </View>
              <View style={st.codeActions}>
                <SpireTactilePressable
                  testID="coop-copy-invite-btn"
                  small
                  onPress={handleCopyInvite}
                  style={st.copyBtn}
                >
                  <Icon name="lorc/scroll-unfurled" size={14} color={INK} noShadow />
                  <Text style={st.copyBtnText}>
                    {copiedInvite ? 'Copied ✓' : 'Copy Invite Link'}
                  </Text>
                </SpireTactilePressable>
                <SpireTactilePressable
                  testID="coop-leave-btn"
                  small
                  onPress={() => {
                    sfx('click');
                    onLeaveRoom();
                  }}
                  style={st.leaveBtn}
                >
                  <Text style={st.leaveBtnText}>Leave</Text>
                </SpireTactilePressable>
              </View>
            </View>

            <Text testID="coop-invite-url" style={st.invitePreview} numberOfLines={1} selectable>
              {inviteUrl}
            </Text>

            {/* Both Players Stage */}
            <View style={st.duoStage}>
              {/* Local Player Slot */}
              <View style={[st.playerSlot, localReady && st.playerSlotReady]}>
                <View style={st.roleRow}>
                  <Text style={st.roleTag}>{isHost ? 'HOST · YOU' : 'GUEST · YOU'}</Text>
                  {localReady && (
                    <View style={st.readyMiniBadge}>
                      <Text style={st.readyMiniText}>READY</Text>
                    </View>
                  )}
                </View>
                <FighterAvatar
                  character={displayLocalFighter}
                  size={54}
                  mood={localReady ? 'victory' : 'anticipation'}
                  framed
                />
                <Text style={st.slotName} numberOfLines={1}>
                  {displayLocalFighter}
                </Text>
                <Text style={st.slotStatus}>
                  {localReady ? 'Ready to climb ✓' : 'Tap Ready when set'}
                </Text>
              </View>

              {/* Partner Slot */}
              <View
                style={[
                  st.playerSlot,
                  allyPlayer?.ready && allyPlayer.connected && st.playerSlotReady,
                  !allyPlayer && st.playerSlotEmpty,
                ]}
              >
                <View style={st.roleRow}>
                  <Text style={st.roleTag}>
                    {allyPlayer ? (allyPlayer.role === 'host' ? 'HOST · ALLY' : 'GUEST · ALLY') : 'PARTNER SLOT'}
                  </Text>
                  {allyPlayer?.ready && allyPlayer.connected && (
                    <View style={st.readyMiniBadge}>
                      <Text style={st.readyMiniText}>READY</Text>
                    </View>
                  )}
                </View>
                {allyPlayer ? (
                  <>
                    <FighterAvatar
                      character={allyPlayer.fighter}
                      size={54}
                      mood={allyPlayer.ready ? 'victory' : 'anticipation'}
                      framed
                    />
                    <Text style={st.slotName} numberOfLines={1}>
                      {allyPlayer.fighter}
                    </Text>
                  </>
                ) : (
                  <View style={st.emptyAvatar}>
                    <Icon name="lorc/two-shadows" size={28} color={TONE.spent} noShadow />
                  </View>
                )}
                <Text testID="coop-ally-status" style={st.slotStatus} numberOfLines={2}>
                  {allyStatusText}
                </Text>
              </View>
            </View>

            {/* Host Ascension Selector (optional compact row) */}
            {isHost && onChangeAscension && maxSelectableAsc > 0 && (
              <View style={st.ascMiniRow}>
                <Text style={st.ascMiniLabel}>ASCENSION</Text>
                <View style={st.ascMiniControls}>
                  <SpireTactilePressable
                    testID="coop-asc-down"
                    small
                    disabled={ascension <= 0}
                    onPress={() => {
                      sfx('click');
                      onChangeAscension(Math.max(0, ascension - 1));
                    }}
                    style={[st.ascStepBtn, ascension <= 0 && { opacity: 0.35 }]}
                  >
                    <Text style={st.ascStepText}>−</Text>
                  </SpireTactilePressable>
                  <Text style={st.ascMiniVal}>A{ascension}</Text>
                  <SpireTactilePressable
                    testID="coop-asc-up"
                    small
                    disabled={ascension >= maxSelectableAsc}
                    onPress={() => {
                      sfx('click');
                      onChangeAscension(Math.min(maxSelectableAsc, ascension + 1));
                    }}
                    style={[st.ascStepBtn, ascension >= maxSelectableAsc && { opacity: 0.35 }]}
                  >
                    <Text style={st.ascStepText}>+</Text>
                  </SpireTactilePressable>
                </View>
              </View>
            )}

            {/* Ready & Launch Controls */}
            <View style={st.actionRow}>
              <Btn
                testID="coop-ready-btn"
                variant={localReady ? 'dark' : 'secondary'}
                label={localReady ? 'Ready ✓' : 'Ready Up'}
                icon="lorc/checked-shield"
                disabled={connectionState !== 'connected'}
                onPress={() => {
                  sfx('click');
                  onToggleReady();
                }}
                style={{ flex: 1 }}
              />
              {isHost && (
                <Btn
                  testID="coop-start-btn"
                  label="Start Duo Climb"
                  icon="lorc/mountaintop"
                  disabled={!canStartClimb}
                  onPress={() => {
                    sfx('confirm');
                    onStartClimb();
                  }}
                  style={{ flex: 1 }}
                />
              )}
            </View>

            {!isHost && (
              <Text style={st.guestHint}>
                {canStartClimb
                  ? 'Both climbers ready! Waiting for Host to launch…'
                  : 'Pick your climber and tap Ready Up when set.'}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Fighter Picker for Duo Climb */}
      <View style={st.pickerCard}>
        <Text style={st.pickerTitle}>YOUR DUO CLIMBER</Text>
        <View style={st.fighterGrid}>
          {FIGHTERS.map(f => {
            const sel = f.name === displayLocalFighter;
            return (
              <View key={f.name} style={st.fighterSlot}>
                <SpireTactilePressable
                  testID={`coop-fighter-${f.name}`}
                  small
                  onPress={() => {
                    sfx('click');
                    onSelectFighter(f.name);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  style={[st.fighterBtn, sel && st.fighterBtnSel]}
                >
                  <SpireLightweightBreath keySeed={`coop-${f.name}`} size={36} active={!sel}>
                    <FighterAvatar
                      character={f.name}
                      size={36}
                      mood={sel ? 'anticipation' : 'idle'}
                      animate={sel}
                    />
                  </SpireLightweightBreath>
                  <Text style={[st.fighterName, sel && st.fighterNameSel]} numberOfLines={1}>
                    {f.name}
                  </Text>
                </SpireTactilePressable>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const st = StyleSheet.create({
  stack: { gap: 12 },
  card: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 14,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: INK,
    padding: 14,
    gap: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 19, fontWeight: '900', color: INK, marginTop: 2 },
  sub: { fontSize: 11.5, fontWeight: '600', color: TONE.spent, lineHeight: 16 },
  connBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  connText: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  errorText: { flex: 1, fontSize: 11.5, fontWeight: '800', color: '#991B1B' },
  entryWrap: { gap: 10 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dividerLine: { flex: 1, height: 1.5, backgroundColor: '#E5E0D8' },
  dividerText: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: TONE.spent },
  joinRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeInput: {
    width: 110,
    height: 46,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: INK,
    backgroundColor: COLORS.paperBeige,
    fontFamily: MONO_FONT,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
    color: INK,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  roomWrap: { gap: 10 },
  codeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  codeEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, color: '#92400E' },
  codeBig: {
    fontFamily: MONO_FONT,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 4,
    color: INK,
  },
  codeActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.actionYellow,
    borderRadius: 8,
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: INK,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  copyBtnText: { fontSize: 11.5, fontWeight: '900', color: INK },
  leaveBtn: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  leaveBtnText: { fontSize: 11, fontWeight: '800', color: INK },
  invitePreview: {
    fontSize: 10,
    fontFamily: MONO_FONT,
    color: TONE.spent,
    backgroundColor: COLORS.paperBeige,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  duoStage: { flexDirection: 'row', gap: 10 },
  playerSlot: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.paperBeige,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D6CFC4',
    padding: 10,
  },
  playerSlotReady: {
    backgroundColor: '#F0FDFA',
    borderColor: '#0F766E',
    borderWidth: 2.5,
  },
  playerSlotEmpty: { borderStyle: 'dashed' },
  roleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  roleTag: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7, color: TONE.spent },
  readyMiniBadge: {
    backgroundColor: '#0F766E',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  readyMiniText: { fontSize: 8, fontWeight: '900', color: COLORS.canvasWhite, letterSpacing: 0.4 },
  emptyAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#B8B0A4',
    backgroundColor: COLORS.canvasWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotName: { fontSize: 13, fontWeight: '900', color: INK, textAlign: 'center' },
  slotStatus: { fontSize: 10.5, fontWeight: '700', color: TONE.spent, textAlign: 'center' },
  ascMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.paperBeige,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D6CFC4',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ascMiniLabel: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1, color: INK },
  ascMiniControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ascStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: INK,
    backgroundColor: COLORS.actionYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ascStepText: { fontSize: 16, fontWeight: '900', color: INK, lineHeight: 18 },
  ascMiniVal: {
    fontFamily: MONO_FONT,
    fontSize: 13,
    fontWeight: '900',
    color: INK,
    minWidth: 28,
    textAlign: 'center',
  },
  actionRow: { flexDirection: 'row', gap: 8 },
  guestHint: {
    fontSize: 11.5,
    fontWeight: '700',
    color: TONE.spent,
    textAlign: 'center',
  },
  pickerCard: {
    backgroundColor: '#3A2D21',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6B5A49',
    padding: 10,
    gap: 8,
  },
  pickerTitle: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.4, color: COLORS.actionYellow },
  fighterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fighterSlot: { width: '31%', flexGrow: 1, minWidth: 88 },
  fighterBtn: {
    width: '100%',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#2B2118',
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#6B5A49',
    paddingVertical: 6,
    paddingHorizontal: 3,
  },
  fighterBtnSel: {
    backgroundColor: COLORS.canvasWhite,
    borderColor: COLORS.actionYellow,
    borderWidth: 2.5,
  },
  fighterName: { fontSize: 10, fontWeight: '900', color: TONE.onDusk, textAlign: 'center' },
  fighterNameSel: { color: INK },
});

export default SpireCoopLobby;
