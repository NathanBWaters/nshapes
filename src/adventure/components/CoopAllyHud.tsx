/**
 * Starfall Summit 2P Co-Op — Twin-Critter Ally Stage Companion & Status HUD.
 *
 * Stands beside the local hero on the battle stage with a secondary animated
 * `FighterAvatar`, live hearts, combo badge, connection indicator, quick-gift
 * action when charged, and a pulsing "RESCUE! X/3" banner when the partner is
 * trapped in the Golden Cage.
 *
 * Guardrails:
 * - Only registered `IconName` keys from `src/components/Icon.tsx`.
 * - Infinite Reanimated pulse gated strictly on `useAppActive() && !reducedMotion && effects`
 *   with `cancelAnimation(...)` cleanup, animating GPU-only `transform`/`opacity`.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Icon from '@/components/Icon';
import { FighterAvatar } from '@/components/fighters';
import type { FighterAvatarReactionEvent } from '@/components/fighters/FighterAvatar';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { CharacterName } from '@/types';
import { COLORS } from '@/utils/colors';
import { EASE, MS } from '@/utils/motion';
import type { CoopCombatGiftKind } from '../types';
import { Heart, INK } from './ui';

export interface CoopAllyHudProps {
  allyFighter: CharacterName;
  allyName: string;
  allyHearts: number;
  allyMaxHearts: number;
  allyCaged: boolean;
  allyRescueProgress?: number;
  allyRescueNeeded?: number;
  allyConnected: boolean;
  allyCombo: number;
  /** Live reaction pulse triggered on ally hit / cross-parry / rescue / emote */
  allyReaction?: FighterAvatarReactionEvent | null;
  /** Size (px) of the local hero's avatar so the ally scales proportionally beside them */
  heroSize: number;
  /** Compact mobile portrait stage */
  compact?: boolean;
  /** Adventure Effects switch */
  effects?: boolean;
  /** True when the fight is won or lost */
  ended?: boolean;
  /** Quick-gift charge progress (0..giftChargeMax) */
  giftCharge?: number;
  giftChargeMax?: number;
  /** Emit quick-gift action (`wild_card` | `heal` | `cleanse`) */
  onSendGift?: (gift: CoopCombatGiftKind) => void;
  /** Disable gift buttons when local player is caged, paused, or fight ended */
  giftsDisabled?: boolean;
}

const CoopAllyHud: React.FC<CoopAllyHudProps> = ({
  allyFighter,
  allyName,
  allyHearts,
  allyMaxHearts,
  allyCaged,
  allyRescueProgress = 0,
  allyRescueNeeded = 3,
  allyConnected,
  allyCombo,
  allyReaction = null,
  heroSize,
  compact = false,
  effects = true,
  ended = false,
  giftCharge = 0,
  giftChargeMax = 4,
  onSendGift,
  giftsDisabled = false,
}) => {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();

  const allySize = Math.max(24, Math.round(heroSize * (compact ? 0.72 : 0.8)));
  const safeMaxHearts = Math.max(1, allyMaxHearts);
  const safeHearts = Math.max(0, Math.min(safeMaxHearts, allyHearts));
  const safeRescueNeeded = Math.max(1, allyRescueNeeded);
  const safeRescueProgress = Math.max(0, Math.min(safeRescueNeeded, allyRescueProgress));
  const safeGiftMax = Math.max(1, giftChargeMax);
  const safeGiftCharge = Math.max(0, Math.min(safeGiftMax, giftCharge));
  const giftReady = Boolean(onSendGift) && !giftsDisabled && !ended && allyConnected && safeGiftCharge >= safeGiftMax;
  const allyNeedsHeal = !allyCaged && safeHearts < safeMaxHearts;
  const primaryGift: CoopCombatGiftKind = allyNeedsHeal && safeHearts <= 1 ? 'heal' : 'wild_card';

  const rescuePulse = useSharedValue(1);
  const shouldPulseRescue = allyCaged && !ended && appActive && effects && !reducedMotion;

  useEffect(() => {
    cancelAnimation(rescuePulse);
    if (!shouldPulseRescue) {
      rescuePulse.value = 1;
      return;
    }
    rescuePulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: MS.move, easing: EASE.drift }),
        withTiming(0.98, { duration: MS.move, easing: EASE.drift })
      ),
      -1,
      true
    );
    return () => cancelAnimation(rescuePulse);
  }, [shouldPulseRescue, rescuePulse]);

  const rescueAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rescuePulse.value }],
  }));

  const allyMood = ended
    ? 'idle'
    : allyCaged
      ? 'defeat'
      : allyCombo >= 3
        ? 'streak'
        : safeHearts <= 1
          ? 'urgent'
          : 'idle';

  return (
    <View
      testID="coop-ally-hud"
      style={[st.wrap, compact && st.wrapCompact, !allyConnected && st.wrapOffline]}
      accessibilityLabel={`Partner ${allyName}, ${allyCaged ? `trapped in cage, rescue ${safeRescueProgress} of ${safeRescueNeeded}` : `${safeHearts} of ${safeMaxHearts} hearts`}`}
    >
      <View style={st.avatarWrap}>
        <FighterAvatar
          testID="coop-ally-avatar"
          character={allyFighter}
          size={allySize}
          health={allyCaged ? 0 : safeHearts}
          maxHealth={safeMaxHearts}
          mood={allyMood}
          reaction={allyReaction}
          animate={appActive && !ended}
          lightweight={compact}
          quiet={!effects}
        />
        {allyCaged && (
          <View testID="coop-ally-cage-icon" pointerEvents="none" style={st.cageOverlayBadge}>
            <Icon name="delapouite/bird-cage" size={Math.max(14, Math.round(allySize * 0.44))} color="#92400E" />
          </View>
        )}
        {allyCombo > 1 && !allyCaged && (
          <View testID="coop-ally-combo" pointerEvents="none" style={st.comboBadge}>
            <Text style={st.comboBadgeText}>×{allyCombo}</Text>
          </View>
        )}
      </View>

      <View style={[st.infoCol, compact && st.infoColCompact]}>
        {!(compact && (allyCaged || giftReady)) && (
          <View style={[st.chipRow, compact && st.chipRowCompact]}>
            <View
              testID="coop-ally-connection"
              style={[st.connDot, allyConnected ? st.connOnline : st.connOffline]}
            />
            {!compact && (
              <Text style={st.nameText} numberOfLines={1}>
                {allyName}
              </Text>
            )}
            <View testID="coop-ally-hearts" style={st.heartPill}>
              <Heart size={compact ? 9 : 10} filled={safeHearts > 0 && !allyCaged} />
              <Text style={st.heartText}>
                {safeHearts}/{safeMaxHearts}
              </Text>
            </View>
          </View>
        )}

        {allyCaged ? (
          <Animated.View testID="coop-ally-rescue-badge" style={[st.rescuePill, rescueAnimStyle]}>
            <Icon name="delapouite/bird-cage" size={11} color="#78350F" noShadow />
            <Text style={st.rescueText} numberOfLines={1}>
              RESCUE! {safeRescueProgress}/{safeRescueNeeded}
            </Text>
          </Animated.View>
        ) : giftReady ? (
          <View style={st.giftRow}>
            <TouchableOpacity
              testID="coop-send-gift-btn"
              style={st.giftBtn}
              onPress={() => onSendGift?.(primaryGift)}
              activeOpacity={0.78}
              hitSlop={{ top: 8, bottom: 4, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={primaryGift === 'heal' ? `Send Heal gift to ${allyName}` : `Send Wild Card gift to ${allyName}`}
            >
              <Icon
                name={primaryGift === 'heal' ? 'lorc/shining-heart' : 'delapouite/card-joker'}
                size={11}
                color={primaryGift === 'heal' ? '#BE123C' : '#4C1D95'}
                noShadow
              />
              <Text style={st.giftBtnText} numberOfLines={1}>
                {primaryGift === 'heal' ? 'Send ♥' : 'Send Wild'}
              </Text>
            </TouchableOpacity>
            {!compact && allyNeedsHeal && primaryGift !== 'heal' && (
              <TouchableOpacity
                testID="coop-send-heal-btn"
                style={[st.giftBtn, st.giftHealBtn]}
                onPress={() => onSendGift?.('heal')}
                activeOpacity={0.78}
                hitSlop={{ top: 8, bottom: 4, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel={`Send Heal gift to ${allyName}`}
              >
                <Icon name="lorc/shining-heart" size={11} color="#BE123C" noShadow />
                <Text style={st.giftBtnText}>+1♥</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : !compact && onSendGift && !ended ? (
          <View testID="coop-gift-charge" style={st.chargePill}>
            <Icon name="delapouite/present" size={10} color="#6D28D9" noShadow />
            <Text style={st.chargeText}>
              Gift {safeGiftCharge}/{safeGiftMax}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const st = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    paddingLeft: 2,
    flexShrink: 1,
    minWidth: 0,
  },
  wrapCompact: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 1,
    paddingLeft: 2,
  },
  wrapOffline: {
    opacity: 0.65,
  },
  avatarWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  cageOverlayBadge: {
    position: 'absolute',
    bottom: -1,
    right: -3,
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#D97706',
    padding: 2,
  },
  comboBadge: {
    position: 'absolute',
    top: -3,
    right: -5,
    backgroundColor: COLORS.orangeSurface,
    borderRadius: 999,
    borderWidth: 1.25,
    borderColor: INK,
    paddingHorizontal: 4,
    paddingVertical: 0.5,
  },
  comboBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.canvasWhite,
    fontVariant: ['tabular-nums'],
  },
  infoCol: {
    gap: 2,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    maxWidth: 132,
    minWidth: 0,
  },
  infoColCompact: {
    alignItems: 'center',
    maxWidth: 74,
    marginBottom: 0,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 253, 247, 0.94)',
    borderRadius: 999,
    borderWidth: 1.25,
    borderColor: INK,
    paddingHorizontal: 5,
    paddingVertical: 1,
    maxWidth: '100%',
  },
  chipRowCompact: {
    gap: 2.5,
    paddingHorizontal: 4,
    paddingVertical: 0.5,
  },
  connDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  connOnline: {
    backgroundColor: '#16A34A',
  },
  connOffline: {
    backgroundColor: '#D97706',
  },
  nameText: {
    fontSize: 10,
    fontWeight: '900',
    color: INK,
    flexShrink: 1,
  },
  heartPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    flexShrink: 0,
  },
  heartText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: INK,
    fontVariant: ['tabular-nums'],
  },
  rescuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF08A',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#B45309',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  rescueText: {
    flexShrink: 1,
    fontSize: 9.5,
    fontWeight: '900',
    color: '#78350F',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  giftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  giftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.actionYellow,
    borderRadius: 999,
    borderWidth: 1.5,
    borderBottomWidth: 2.5,
    borderColor: INK,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  giftHealBtn: {
    backgroundColor: '#FFE4E6',
    borderColor: '#9F1239',
  },
  giftBtnText: {
    flexShrink: 1,
    fontSize: 9.5,
    fontWeight: '900',
    color: INK,
  },
  chargePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 243, 255, 0.92)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C4B5FD',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  chargeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#5B21B6',
    fontVariant: ['tabular-nums'],
  },
});

export default CoopAllyHud;
