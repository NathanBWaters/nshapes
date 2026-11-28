/**
 * Starfall Summit 2P Co-Op — Golden Cage Board Overlay.
 *
 * Displayed over the player's card board whenever they drop to 0 hearts in
 * 2P Co-Op mode. Locks board interactions while keeping the battle stage,
 * Boss HP, Parry Intent Bar, and Partner HUD visible above. Shows live rescue
 * progress ("Waiting for ally: X/3 Sets or 1 Parry to break you free!") and a
 * tap-to-cheer button that sends an encouraging emote pulse to your partner.
 *
 * Guardrails:
 * - Only registered `IconName` keys from `src/components/Icon.tsx` (`delapouite/bird-cage`, `delapouite/party-popper`, `lorc/sword-clash`, `lorc/shining-heart`).
 * - Infinite gentle cage float strictly gated on `useAppActive() && !reducedMotion && effects`
 *   with GPU-only `transform`/`opacity` and `cancelAnimation(...)` cleanup.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Icon from '@/components/Icon';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import { EASE, MS, SPRING } from '@/utils/motion';
import { INK } from './ui';

export interface CoopCageOverlayProps {
  visible: boolean;
  allyName: string;
  rescueProgress: number;
  rescueNeeded: number;
  effects?: boolean;
  onCheer?: (emote: string) => void;
}

const CHEER_EMOTES = ['Go! Go! Go!', 'You got this!', 'Break me out!', 'Nice Set!'] as const;
const CAGE_BAR_SLOTS = [0, 1, 2, 3, 4, 5] as const;

const CoopCageOverlay: React.FC<CoopCageOverlayProps> = ({
  visible,
  allyName,
  rescueProgress,
  rescueNeeded,
  effects = true,
  onCheer,
}) => {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const [cheerCount, setCheerCount] = useState(0);
  const [cheerFlash, setCheerFlash] = useState<string | null>(null);
  const cheerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const safeNeeded = Math.max(1, rescueNeeded);
  const safeProgress = Math.max(0, Math.min(safeNeeded, rescueProgress));
  const fillPct = safeProgress / safeNeeded;

  const cageFloatY = useSharedValue(0);
  const barScaleX = useSharedValue(fillPct);
  const cheerPop = useSharedValue(1);

  const shouldFloat = visible && appActive && effects && !reducedMotion;

  useEffect(() => {
    cancelAnimation(cageFloatY);
    if (!shouldFloat) {
      cageFloatY.value = 0;
      return;
    }
    cageFloatY.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 900, easing: EASE.drift }),
        withTiming(0, { duration: 900, easing: EASE.drift })
      ),
      -1,
      true
    );
    return () => cancelAnimation(cageFloatY);
  }, [shouldFloat, cageFloatY]);

  useEffect(() => {
    cancelAnimation(barScaleX);
    if (!effects || reducedMotion) {
      barScaleX.value = fillPct;
      return;
    }
    barScaleX.value = withTiming(fillPct, { duration: MS.move, easing: EASE.enter });
    return () => cancelAnimation(barScaleX);
  }, [fillPct, effects, reducedMotion, barScaleX]);

  useEffect(() => () => {
    cancelAnimation(cageFloatY);
    cancelAnimation(barScaleX);
    cancelAnimation(cheerPop);
    if (cheerTimerRef.current) clearTimeout(cheerTimerRef.current);
  }, [cageFloatY, barScaleX, cheerPop]);

  const handleCheer = useCallback(() => {
    const nextIdx = cheerCount % CHEER_EMOTES.length;
    const msg = CHEER_EMOTES[nextIdx];
    setCheerCount(c => c + 1);
    setCheerFlash(msg);
    onCheer?.('cheer');
    if (effects && !reducedMotion) {
      cancelAnimation(cheerPop);
      cheerPop.value = withSequence(
        withTiming(1.08, { duration: 80, easing: EASE.enter }),
        withSpring(1, SPRING.snappy)
      );
    }
    if (cheerTimerRef.current) clearTimeout(cheerTimerRef.current);
    cheerTimerRef.current = setTimeout(() => {
      cheerTimerRef.current = null;
      setCheerFlash(null);
    }, 1200);
  }, [cheerCount, onCheer, effects, reducedMotion, cheerPop]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cageFloatY.value }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    opacity: barScaleX.value <= 0.001 ? 0 : 1,
    transform: [{ scaleX: Math.max(0.0001, barScaleX.value) }],
  }));

  const cheerBtnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cheerPop.value }],
  }));

  if (!visible) return null;

  return (
    <View
      testID="coop-cage-overlay"
      style={st.backdrop}
      accessibilityViewIsModal
      accessibilityLabel={`Trapped in the Golden Cage. Waiting for ${allyName}: ${safeProgress} of ${safeNeeded} Sets or 1 Parry to break you free.`}
    >
      {/* Storybook golden cage bars framing the locked board */}
      <View pointerEvents="none" style={st.barsLayer}>
        {CAGE_BAR_SLOTS.map(slot => (
          <View key={slot} style={st.cageBar} />
        ))}
      </View>

      <View style={st.card}>
        <View style={st.goldTopRim} />

        <Animated.View style={[st.emblem, floatStyle]}>
          <Icon name="delapouite/bird-cage" size={34} color="#78350F" />
        </Animated.View>

        <Text style={st.eyebrow}>GOLDEN CAGE · 0 HEARTS</Text>
        <Text style={st.title}>Hold tight!</Text>
        <Text testID="coop-cage-status-text" style={st.subtitle}>
          Waiting for {allyName}: {safeProgress}/{safeNeeded} Sets or 1 Parry to break you free!
        </Text>

        {/* Live rescue progress bar + pip markers */}
        <View style={st.progressBlock}>
          <View testID="coop-cage-progress" style={st.progressTrack}>
            <Animated.View style={[st.progressFill, fillStyle]} />
          </View>
          <View style={st.pipsRow}>
            {Array.from({ length: safeNeeded }).map((_, i) => {
              const filled = i < safeProgress;
              return (
                <View key={i} style={[st.pip, filled && st.pipFilled]}>
                  <Icon
                    name={filled ? 'lorc/checked-shield' : 'lorc/sword-clash'}
                    size={12}
                    color={filled ? '#0F766E' : '#92400E'}
                    noShadow
                  />
                </View>
              );
            })}
          </View>
        </View>

        <Animated.View style={cheerBtnAnimStyle}>
          <TouchableOpacity
            testID="coop-cage-cheer-btn"
            style={st.cheerBtn}
            onPress={handleCheer}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={`Send cheer emote to ${allyName}`}
          >
            <Icon name="delapouite/party-popper" size={18} color={INK} noShadow />
            <Text style={st.cheerBtnText}>
              {cheerFlash ? `Sent "${cheerFlash}"` : `Cheer for ${allyName}!`}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={st.footerHint}>
          <Icon name="lorc/shining-heart" size={12} color="#F59E0B" noShadow />
          <Text style={st.footerHintText}>Revives you with 2 ♥ & cleanses board hazards</Text>
        </View>
      </View>
    </View>
  );
};

const st = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 90,
    backgroundColor: 'rgba(28, 22, 14, 0.78)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    overflow: 'hidden',
  },
  barsLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 8,
  },
  cageBar: {
    width: 6,
    height: '100%',
    backgroundColor: 'rgba(245, 184, 0, 0.24)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(254, 240, 138, 0.32)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFDF7',
    borderRadius: 16,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: '#B45309',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  goldTopRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: COLORS.actionYellow,
  },
  emblem: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FEF3C7',
    borderWidth: 2.5,
    borderColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: '#B45309',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: INK,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#44403C',
    textAlign: 'center',
    lineHeight: 19,
  },
  progressBlock: {
    width: '100%',
    gap: 8,
    marginTop: 2,
    marginBottom: 4,
  },
  progressTrack: {
    width: '100%',
    height: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: INK,
    backgroundColor: '#FEF3C7',
    overflow: 'hidden',
  },
  progressFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F59E0B',
    transformOrigin: 'left center',
  },
  pipsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  pip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#D97706',
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipFilled: {
    borderColor: '#0F766E',
    backgroundColor: '#CCFBF1',
  },
  cheerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: COLORS.actionYellow,
    borderRadius: 10,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 44,
  },
  cheerBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: INK,
  },
  footerHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  footerHintText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78716C',
    textAlign: 'center',
  },
});

export default CoopCageOverlay;
