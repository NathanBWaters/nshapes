/**
 * Starfall Summit — Persistent 2P Co-Op Top Banner.
 *
 * Compact bar rendered right beneath SpireHeader during a Duo climb showing:
 *  - Room code pill
 *  - Ally FighterAvatar + Hearts + Ready / Presence status pill
 *  - Reconnecting alert strip if either socket drops
 *  - Optional recent co-op gift/callout notice
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import { COLORS } from '@/utils/colors';
import { MONO_FONT } from '@/utils/fonts';
import { Heart, INK, TONE } from '@/adventure/components/ui';
import type { SpireCoopConnectionState, SpireCoopPlayerView } from '../types';
import { SpireStatPop } from './SpireMotion';

export interface SpireCoopBannerProps {
  roomCode: string;
  connectionState: SpireCoopConnectionState;
  ally: SpireCoopPlayerView | null;
  allyPhaseReady?: boolean;
  notice?: string | null;
}

const SpireCoopBanner: React.FC<SpireCoopBannerProps> = ({
  roomCode,
  connectionState,
  ally,
  allyPhaseReady = false,
  notice,
}) => {
  const localDisconnected =
    connectionState === 'reconnecting' ||
    connectionState === 'connecting' ||
    connectionState === 'error';
  const allyDisconnected = Boolean(ally && !ally.connected);
  const showReconnectBar = localDisconnected || allyDisconnected;

  const statusPill = !ally
    ? { label: 'WAITING', bg: '#E5E0D8', fg: TONE.spent, border: '#B8B0A4' }
    : !ally.connected
      ? { label: 'OFFLINE', bg: '#FFEDD5', fg: '#C2410C', border: '#EA580C' }
      : ally.caged
        ? { label: 'CAGED', bg: '#FEF3C7', fg: '#92400E', border: '#D97706' }
        : allyPhaseReady
          ? { label: 'READY ✓', bg: '#CCFBF1', fg: '#0F766E', border: '#0F766E' }
          : { label: 'ONLINE', bg: '#E0F2FE', fg: '#0369A1', border: '#0284C7' };

  return (
    <View style={st.wrap} testID="coop-banner">
      <View style={st.bar}>
        <View style={st.roomPill} testID="coop-banner-room-code">
          <Icon name="lorc/two-shadows" size={12} color={COLORS.actionYellow} noShadow />
          <Text style={st.roomCodeText}>{roomCode}</Text>
        </View>

        {ally ? (
          <View style={st.allyRow}>
            <FighterAvatar
              character={ally.fighter}
              size={22}
              health={ally.hearts}
              maxHealth={ally.maxHearts}
              animate={false}
            />
            <Text style={st.allyName} numberOfLines={1}>
              {ally.name}
            </Text>
            <SpireStatPop value={ally.hearts} style={st.heartsWrap}>
              <Heart size={11} />
              <Text style={st.heartsText}>
                {ally.hearts}/{ally.maxHearts}
              </Text>
            </SpireStatPop>
          </View>
        ) : (
          <Text style={st.waitingText} numberOfLines={1}>
            Waiting for partner…
          </Text>
        )}

        <View
          testID="coop-banner-ally-status"
          style={[
            st.statusPill,
            { backgroundColor: statusPill.bg, borderColor: statusPill.border },
          ]}
        >
          <Text style={[st.statusText, { color: statusPill.fg }]}>{statusPill.label}</Text>
        </View>
      </View>

      {showReconnectBar && (
        <View style={st.reconnectBar} testID="coop-reconnecting-banner">
          <Icon name="lorc/laser-warning" size={12} color="#9A3412" noShadow />
          <Text style={st.reconnectText} numberOfLines={1}>
            {localDisconnected
              ? 'Reconnecting to Duo Room…'
              : `${ally?.name ?? 'Partner'} disconnected — waiting to reconnect…`}
          </Text>
        </View>
      )}

      {notice ? (
        <View style={st.noticeBar} testID="coop-banner-notice">
          <Icon name="delapouite/present" size={12} color="#0F766E" noShadow />
          <Text style={st.noticeText} numberOfLines={1}>
            {notice}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const st = StyleSheet.create({
  wrap: {
    backgroundColor: '#231A13',
    borderBottomWidth: 2,
    borderBottomColor: INK,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  roomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#3A2D21',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.actionYellow,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  roomCodeText: {
    fontFamily: MONO_FONT,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: COLORS.actionYellow,
  },
  allyRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  allyName: {
    flexShrink: 1,
    fontSize: 11.5,
    fontWeight: '900',
    color: TONE.onDusk,
  },
  heartsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  heartsText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.canvasWhite,
    fontVariant: ['tabular-nums'],
  },
  waitingText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: TONE.spent,
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  reconnectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFEDD5',
    borderTopWidth: 1,
    borderTopColor: '#EA580C',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  reconnectText: {
    flexShrink: 1,
    fontSize: 10.5,
    fontWeight: '900',
    color: '#9A3412',
  },
  noticeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#CCFBF1',
    borderTopWidth: 1,
    borderTopColor: '#0F766E',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  noticeText: {
    flexShrink: 1,
    fontSize: 10.5,
    fontWeight: '900',
    color: '#115E59',
  },
});

export default SpireCoopBanner;
