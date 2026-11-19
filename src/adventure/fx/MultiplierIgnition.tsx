/**
 * Live "Multiplier Ignition" — Balatro-style real-time math equation strip.
 *
 * Reads the exact `FightLogSetMath` recorded by the engine (`RunState.lastSetIgnition`)
 * and animates each multiplier slamming in left-to-right on the musical beat,
 * escalating from warm glow → orange-gold flames → electric Starfall plasma fire.
 *
 * Strictly `pointerEvents="none"` floating overlay (never shifts the board, never
 * blocks taps, never overflows 320px/375px viewports).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { band } from '@/audio';
import { useAppActive } from '@/hooks/useAppActive';
import { COLORS } from '@/utils/colors';
import type { SetIgnition } from '../types';
import { INK } from '../components/ui';

export type HeatTier = 0 | 1 | 2 | 3;

export interface IgnitionStep {
  key: string;
  label: string;
  value: string;
  color: string;
  bg: string;
  kind: 'base' | 'mult' | 'extra';
}

export interface IgnitionPlan {
  steps: IgnitionStep[];
  total: number;
  heatTier: HeatTier;
  /** True when the equation has interesting multipliers or big damage worth igniting */
  show: boolean;
}

const fmt = (n: number): string => {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toLocaleString() : rounded.toFixed(1);
};

export const heatTierFor = (total: number): HeatTier =>
  total >= 200 ? 3 : total >= 60 ? 2 : total >= 20 ? 1 : 0;

/**
 * Pure builder: turns an engine `SetIgnition` snapshot into ordered equation steps.
 * Every number matches `applyMatch` exactly.
 */
export const buildIgnitionPlan = (ignition: SetIgnition): IgnitionPlan => {
  const m = ignition.math;
  const collateral = Object.values(m.collateral).reduce((s, n) => s + (n ?? 0), 0);
  const preSurgeBase = m.cards + collateral;
  const surge = m.surgeMultiplier && m.surgeMultiplier > 1 ? m.surgeMultiplier : 1;
  const baseWithFlat = Math.max(0, Math.round((preSurgeBase + m.flatBonus) * 10) / 10);
  const steps: IgnitionStep[] = [
    {
      key: 'base',
      label: m.flatBonus > 0 ? 'BASE' : 'SET',
      value: fmt(surge > 1 ? preSurgeBase : baseWithFlat),
      color: INK,
      bg: COLORS.canvasWhite,
      kind: 'base',
    },
  ];

  if (surge > 1) {
    steps.push({
      key: 'surge',
      label: 'SURGE',
      value: `×${fmt(surge)}`,
      color: '#FFFFFF',
      bg: '#DB2777',
      kind: 'mult',
    });
    if (m.flatBonus > 0) {
      steps.push({
        key: 'flat',
        label: 'GEAR',
        value: `+${fmt(m.flatBonus)}`,
        color: INK,
        bg: '#FEF3C7',
        kind: 'extra',
      });
    }
  }

  for (let i = 0; i < (m.multItems?.length ?? 0); i++) {
    const item = m.multItems![i];
    if (Math.abs(item.amount - 1) < 0.01) continue;
    const lower = item.label.toLowerCase();
    let short = item.label.toUpperCase();
    let bg = '#F97316';
    let color = '#FFFFFF';
    if (lower.includes('rainbow')) {
      short = 'RAINBOW';
      bg = '#9333EA';
    } else if (lower.includes('perfect parry')) {
      short = 'PERFECT PARRY';
      bg = COLORS.actionYellow;
      color = INK;
    } else if (lower.includes('parry')) {
      short = 'PARRY';
      bg = '#0F766E';
    } else if (lower.includes('stagger')) {
      short = 'STAGGER';
      bg = '#0D9488';
    } else if (lower.includes('evolution')) {
      short = 'EVOLVED';
      bg = '#7C3AED';
    } else if (lower.includes('hot streak')) {
      short = 'STREAK';
      bg = '#EA580C';
    } else if (lower.length > 12) {
      short = item.label.slice(0, 10).toUpperCase();
    }
    steps.push({
      key: `m-${i}`,
      label: short,
      value: `×${fmt(item.amount)}`,
      color,
      bg,
      kind: 'mult',
    });
  }

  if (m.extra > 0) {
    steps.push({
      key: 'extra',
      label: 'BONUS',
      value: `+${fmt(m.extra)}`,
      color: '#FFFFFF',
      bg: '#0D9488',
      kind: 'extra',
    });
  }

  if (m.powerMultiplier && m.powerMultiplier > 1.04) {
    steps.push({
      key: 'power',
      label: 'POWER',
      value: `×${fmt(m.powerMultiplier)}`,
      color: '#FFFFFF',
      bg: '#DC2626',
      kind: 'mult',
    });
  }

  const total = Math.round(m.hit);
  const heatTier = heatTierFor(total);
  const show = steps.length >= 2 || total >= 10;
  return { steps: steps.slice(0, 6), total, heatTier, show };
};

interface Props {
  ignition: SetIgnition | null;
  enabled: boolean;
}

const STEP_MS = 85;
const LINGER_MS = 1450;

const FlameTongue: React.FC<{ color: string; offset: number; delay: number; active: boolean }> = ({
  color,
  offset,
  delay,
  active,
}) => {
  const bob = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(bob);
      bob.value = 0;
      return;
    }
    const t = setTimeout(() => {
      bob.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 190, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 210, easing: Easing.in(Easing.quad) })
        ),
        -1
      );
    }, delay);
    return () => {
      clearTimeout(t);
      cancelAnimation(bob);
    };
  }, [active, delay, bob]);

  const anim = useAnimatedStyle(() => ({
    opacity: 0.72 + bob.value * 0.28,
    transform: [
      { translateY: -bob.value * 5 },
      { scaleY: 0.85 + bob.value * 0.45 },
      { rotate: `${offset > 0 ? 8 : -8}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[st.flame, { backgroundColor: color, left: `${50 + offset}%` as unknown as number }, anim]}
    />
  );
};

const MultiplierIgnition: React.FC<Props> = ({ ignition, enabled }) => {
  const appActive = useAppActive();
  const [visibleId, setVisibleId] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [slammed, setSlammed] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const plan = useMemo(() => (ignition ? buildIgnitionPlan(ignition) : null), [ignition]);

  const totalScale = useSharedValue(0.8);
  const panelOpacity = useSharedValue(0);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (!enabled || !ignition || !plan || !plan.show) {
      setVisibleId(null);
      return;
    }

    setVisibleId(ignition.id);
    setRevealed(1);
    setSlammed(false);
    panelOpacity.value = withTiming(1, { duration: 90 });
    totalScale.value = 0.75;

    const count = plan.steps.length;
    for (let i = 1; i < count; i++) {
      const idx = i;
      timers.current.push(
        setTimeout(() => {
          setRevealed(idx + 1);
          band.cue('multStep', { slot: idx, amount: plan.heatTier });
        }, idx * STEP_MS)
      );
    }

    const slamAt = count * STEP_MS + 40;
    timers.current.push(
      setTimeout(() => {
        setSlammed(true);
        totalScale.value = withSequence(
          withTiming(1.24, { duration: 100, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 130, easing: Easing.inOut(Easing.quad) })
        );
        band.cue('multSlam', { amount: plan.heatTier });
      }, slamAt)
    );

    timers.current.push(
      setTimeout(() => {
        panelOpacity.value = withTiming(0, { duration: 220 });
      }, slamAt + LINGER_MS - 220)
    );

    timers.current.push(
      setTimeout(() => {
        setVisibleId(cur => (cur === ignition.id ? null : cur));
      }, slamAt + LINGER_MS)
    );

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [ignition, enabled, plan, panelOpacity, totalScale]);

  const panelAnim = useAnimatedStyle(() => ({ opacity: panelOpacity.value }));
  const totalAnim = useAnimatedStyle(() => ({ transform: [{ scale: totalScale.value }] }));

  if (!enabled || !ignition || !plan || !plan.show || visibleId !== ignition.id) return null;

  const isBlazing = slammed && plan.heatTier >= 2;
  const isNuclear = slammed && plan.heatTier >= 3;
  const flamesActive = isBlazing && appActive;

  return (
    <Animated.View
      testID="multiplier-ignition"
      pointerEvents="none"
      style={[st.anchor, panelAnim]}
    >
      <View
        style={[
          st.strip,
          plan.heatTier === 1 && st.stripHot,
          plan.heatTier === 2 && st.stripBlazing,
          plan.heatTier === 3 && st.stripNuclear,
        ]}
      >
        <View style={st.chips}>
          {plan.steps.slice(0, revealed).map(step => (
            <View key={step.key} style={[st.chip, { backgroundColor: step.bg }]}>
              <Text style={[st.chipLabel, { color: step.color }]} numberOfLines={1}>
                {step.label}
              </Text>
              <Text style={[st.chipVal, { color: step.color }]} numberOfLines={1}>
                {step.value}
              </Text>
            </View>
          ))}
        </View>

        {slammed && (
          <Animated.View style={[st.totalWrap, totalAnim]}>
            {isBlazing && (
              <>
                <FlameTongue color={isNuclear ? '#38BDF8' : '#FB923C'} offset={-26} delay={0} active={flamesActive} />
                <FlameTongue color={isNuclear ? '#A855F7' : '#FACC15'} offset={0} delay={70} active={flamesActive} />
                <FlameTongue color={isNuclear ? '#22D3EE' : '#F97316'} offset={24} delay={130} active={flamesActive} />
              </>
            )}
            <View
              style={[
                st.totalBadge,
                plan.heatTier === 1 && st.totalHot,
                plan.heatTier === 2 && st.totalBlazing,
                plan.heatTier === 3 && st.totalNuclear,
              ]}
            >
              <Text
                testID="multiplier-ignition-total"
                style={[st.totalText, plan.heatTier >= 2 && { color: '#FFFFFF' }]}
              >
                {fmt(plan.total)}
              </Text>
            </View>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
};

const st = StyleSheet.create({
  anchor: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 245,
    alignItems: 'center',
  },
  strip: {
    maxWidth: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(28, 27, 25, 0.92)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: INK,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  stripHot: {
    borderColor: '#F59E0B',
  },
  stripBlazing: {
    borderColor: '#F97316',
    backgroundColor: 'rgba(42, 20, 12, 0.95)',
  },
  stripNuclear: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(18, 22, 48, 0.96)',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flexShrink: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: INK,
  },
  chipLabel: {
    flexShrink: 1,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
    opacity: 0.9,
  },
  chipVal: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  totalWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  flame: {
    position: 'absolute',
    top: -8,
    width: 11,
    height: 14,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    marginLeft: -5.5,
  },
  totalBadge: {
    backgroundColor: COLORS.actionYellow,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: INK,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  totalHot: {
    backgroundColor: '#F59E0B',
  },
  totalBlazing: {
    backgroundColor: '#EA580C',
    borderColor: '#FDE047',
  },
  totalNuclear: {
    backgroundColor: '#7C3AED',
    borderColor: '#38BDF8',
  },
  totalText: {
    fontSize: 15,
    fontWeight: '900',
    color: INK,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.4,
  },
});

export default MultiplierIgnition;
