/**
 * Peggle-style Lethal Kill-Cam overlay.
 *
 * Fires when a finishing blow shatters a Boss, Elite, or final-wave foe
 * (when effects are enabled):
 *   0–300ms: Dramatic dark spotlight vignette + bold comic impact callout + rising timpani
 * 300–850ms: White shatter flash + 12 physical Star Shards erupting outward from the foe!
 *
 * Strictly one-shot GPU animations (`transform`/`opacity`), `pointerEvents="none"`,
 * zero input locking.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { band } from '@/audio';
import { COLORS } from '@/utils/colors';
import type { Anchors } from './anchors';
import type { SetIgnition } from '../types';
import { INK } from '../components/ui';

interface Props {
  ignition: SetIgnition | null;
  anchors: Anchors;
  stageSize: { w: number; h: number };
  enabled: boolean;
}

const SHARD_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const SHARD_COLORS = [COLORS.actionYellow, '#FDE047', '#FB923C', '#38BDF8', '#C084FC', '#FDE047'];

const StarShard: React.FC<{ originX: number; originY: number; deg: number; dist: number; color: string; delay: number }> = ({
  originX,
  originY,
  deg,
  dist,
  color,
  delay,
}) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [delay, p]);

  const rad = (deg * Math.PI) / 180;
  const dx = Math.cos(rad) * dist;
  const dy = Math.sin(rad) * dist - 28; // slight upward lift like stars flying to the HUD

  const anim = useAnimatedStyle(() => {
    const t = p.value;
    const opacity = t <= 0 ? 0 : t < 0.72 ? 1 : Math.max(0, 1 - (t - 0.72) / 0.28);
    return {
      opacity,
      transform: [
        { translateX: originX + dx * t - 9 },
        { translateY: originY + dy * t - 9 },
        { scale: 0.4 + Math.sin(t * Math.PI) * 0.9 },
        { rotate: `${t * 220}deg` },
      ],
    };
  });

  return (
    <Animated.Text pointerEvents="none" style={[st.shard, { color }, anim]}>
      ★
    </Animated.Text>
  );
};

const KillCamOverlay: React.FC<Props> = ({ ignition, anchors, stageSize, enabled }) => {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [headline, setHeadline] = useState('FINISHING BLOW!');
  const [origin, setOrigin] = useState({ x: 180, y: 120 });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const dim = useSharedValue(0);
  const bannerScale = useSharedValue(0.6);
  const flash = useSharedValue(0);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    if (!enabled || !ignition || !ignition.lethal) return;

    const foeRect = anchors.rect('foe');
    const ox = foeRect ? foeRect.x + foeRect.w / 2 : stageSize.w * 0.72;
    const oy = foeRect ? foeRect.y + foeRect.h / 2 : Math.min(130, stageSize.h * 0.2);
    setOrigin({ x: ox, y: oy });

    const text =
      ignition.parryKind === 'perfect'
        ? 'PERFECT PARRY K.O.!'
        : ignition.isBossOrElite
          ? 'BOSS SHATTERED!'
          : 'FINISHING BLOW!';
    setHeadline(text);
    setActiveId(ignition.id);

    band.cue('killCamRiser');
    dim.value = withSequence(
      withTiming(0.45, { duration: 140 }),
      withDelay(240, withTiming(0, { duration: 380 }))
    );
    bannerScale.value = withSequence(
      withTiming(1.12, { duration: 150, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 150 }),
      withDelay(300, withTiming(0.92, { duration: 180 }))
    );
    flash.value = withDelay(
      290,
      withSequence(
        withTiming(0.75, { duration: 55 }),
        withTiming(0, { duration: 240, easing: Easing.out(Easing.quad) })
      )
    );

    timers.current.push(
      setTimeout(() => {
        band.cue('killCamShatter');
      }, 290)
    );
    timers.current.push(
      setTimeout(() => {
        setActiveId(cur => (cur === ignition.id ? null : cur));
      }, 880)
    );

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [ignition, enabled, anchors, stageSize.w, stageSize.h, dim, bannerScale, flash]);

  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const bannerStyle = useAnimatedStyle(() => ({
    opacity: dim.value > 0.02 ? 1 : 0,
    transform: [{ scale: bannerScale.value }, { rotate: '-3deg' }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  if (!enabled || !ignition || activeId !== ignition.id) return null;

  return (
    <View testID="kill-cam-overlay" pointerEvents="none" style={st.root}>
      <Animated.View style={[st.vignette, dimStyle]} />
      <Animated.View style={[st.flash, flashStyle]} />
      <View style={st.bannerCenter}>
        <Animated.View style={[st.banner, bannerStyle]}>
          <Text style={st.bannerText}>{headline}</Text>
        </Animated.View>
      </View>
      {SHARD_ANGLES.map((deg, idx) => (
        <StarShard
          key={`${activeId}-${deg}`}
          originX={origin.x}
          originY={origin.y}
          deg={deg}
          dist={72 + (idx % 3) * 30}
          color={SHARD_COLORS[idx % SHARD_COLORS.length]}
          delay={290 + (idx % 4) * 20}
        />
      ))}
    </View>
  );
};

const st = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 255,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0B0A0A',
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFDF5',
  },
  bannerCenter: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '34%',
    alignItems: 'center',
  },
  banner: {
    backgroundColor: COLORS.actionYellow,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: INK,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 7,
  },
  bannerText: {
    fontSize: 20,
    fontWeight: '900',
    color: INK,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  shard: {
    position: 'absolute',
    left: 0,
    top: 0,
    fontSize: 18,
    fontWeight: '900',
    textShadowColor: INK,
    textShadowRadius: 2,
  },
});

export default KillCamOverlay;
