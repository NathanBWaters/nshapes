/**
 * The rule, kept in sight while it is new: a strip right above the board with
 * a cell for each trait in play.
 *
 * With nothing to check it says the rule: the traits, and "each one: all the
 * same, or all different". When three cards are in question (a Set the
 * companion has lit, the Set just made, a wrong pick) each cell says how its
 * trait did, and with two cards held, what the third card needs. A Set is never
 * "three red cards": it is every cell passing.
 *
 * It is always the same height, whatever it says, so the board never moves.
 * (coach.ts decides what is checked and when: `showsTraitChecks`, `pills`.)
 *
 * Lane 3 polish:
 * - Each trait cell reveals independently with `STAGGER.card` (40 ms) cascade,
 *   crisp `EASE.popSoft` scale & `EASE.enter` lift (never scaling the whole bar as one slab).
 * - Failing trait cells perform a subtle deterministic 2-leg `geometricShakeKeyframes` shake.
 * - Full `useReducedMotion()` (`STAYS` opacity confirmation) & `cancelAnimation` cleanup.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { AttributeName } from '@/types';
import { COLORS } from '@/utils/colors';
import {
  ACCESSIBLE,
  EASE,
  MS,
  SHAKE,
  STAGGER,
  STAYS,
  geometricShakeKeyframes,
} from '@/utils/motion';
import type { TraitCheckPill } from '../coach';
import { INK } from './ui';

/** The strip's height, borders included (the fight screen budgets for it) */
export const TRAIT_CHECKS_HEIGHT = 34;

const TITLE: Record<AttributeName, string> = {
  color: 'COLOR',
  shape: 'SHAPE',
  number: 'NUMBER',
  shading: 'SHADING',
  background: 'BACK',
};

const MARK = { pass: '✓', fail: '✗', hint: '→', info: '•' } as const;

const FAIL_SHAKE_PX = geometricShakeKeyframes(4, 2, SHAKE.decay, -1);

/** Colour and shape first: they are what the eye sees first (the same order the checks come in). */
const inReadingOrder = (attributes: readonly AttributeName[]): AttributeName[] => [
  ...(attributes.includes('color') ? (['color'] as const) : []),
  ...(attributes.includes('shape') ? (['shape'] as const) : []),
  ...attributes.filter(a => a !== 'color' && a !== 'shape'),
];

interface CellProps {
  check: TraitCheckPill;
  index: number;
  added?: AttributeName | null;
  narrow: boolean;
  revealKey: string;
}

const TraitCell: React.FC<CellProps> = ({ check, index, added, narrow, revealKey }) => {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 1 : 0.35);
  const scale = useSharedValue(reducedMotion ? 1 : 0.9);
  const ty = useSharedValue(reducedMotion ? 0 : 4);
  const tx = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(opacity);
    cancelAnimation(scale);
    cancelAnimation(ty);
    cancelAnimation(tx);

    const delay = index * STAGGER.item;

    if (reducedMotion) {
      scale.value = 1;
      ty.value = 0;
      tx.value = 0;
      opacity.value = 0.45;
      opacity.value = withTiming(1, { duration: ACCESSIBLE.fadeMs, easing: EASE.ui, ...STAYS });
      return () => cancelAnimation(opacity);
    }

    opacity.value = 0.22;
    scale.value = 0.86;
    ty.value = 6;
    tx.value = 0;

    opacity.value = withDelay(delay, withTiming(1, { duration: MS.feedback, easing: EASE.ui }));
    scale.value = withDelay(delay, withTiming(1, { duration: MS.quick, easing: EASE.popSoft }));
    ty.value = withDelay(delay, withTiming(0, { duration: MS.quick, easing: EASE.enter }));

    if (check.status === 'fail') {
      tx.value = withDelay(
        delay + 48,
        withSequence(
          ...FAIL_SHAKE_PX.map((px, i) =>
            withTiming(px, {
              duration: i === 0 ? SHAKE.firstLegMs : i === FAIL_SHAKE_PX.length - 1 ? SHAKE.settleMs : SHAKE.legMs,
              easing: i === FAIL_SHAKE_PX.length - 1 ? EASE.ui : EASE.enter,
            })
          )
        )
      );
    }

    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      cancelAnimation(ty);
      cancelAnimation(tx);
    };
  }, [revealKey, check.status, index, reducedMotion, opacity, scale, ty, tx]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      testID={`coach-trait-${check.attr}`}
      style={[st.cell, CELL[check.status], animStyle]}
    >
      <Text style={[st.title, added === check.attr && st.titleNew]} numberOfLines={1}>
        {TITLE[check.attr]}{added === check.attr ? ' · NEW' : ''}
      </Text>
      <Text style={[st.value, VALUE[check.status]]} numberOfLines={1}>
        {MARK[check.status]} {narrow ? check.brief : check.detail}
      </Text>
    </Animated.View>
  );
};

interface Props {
  attributes: readonly AttributeName[];
  /** The checks of the cards in question, one per trait; none = the rule is shown */
  checks?: readonly TraitCheckPill[] | null;
  /** The trait this level adds: its name is tagged NEW */
  added?: AttributeName | null;
}

const TraitChecks: React.FC<Props> = ({ attributes, checks, added }) => {
  const traits = inReadingOrder(attributes);
  const live = checks && checks.length > 0 ? checks : null;
  // Three cells in a row are narrow: they get the short wording
  const narrow = traits.length >= 3;
  const said = live ? live.map(c => `${c.attr}:${c.status}:${c.detail}`).join('|') : '';

  const title = (attr: AttributeName) => (
    <Text style={[st.title, added === attr && st.titleNew]} numberOfLines={1}>
      {TITLE[attr]}{added === attr ? ' · NEW' : ''}
    </Text>
  );

  if (!live) {
    const names = traits.map(a => TITLE[a].toLowerCase()).join(', ');
    return (
      <View testID="run-trait-checks" style={[st.strip, st.rule]} accessibilityLabel={`The rule. ${names}: each one all the same, or all different`}>
        <View style={st.names}>
          {traits.map((attr, i) => (
            <React.Fragment key={attr}>
              {i > 0 && <Text style={st.title}>·</Text>}
              {title(attr)}
            </React.Fragment>
          ))}
        </View>
        <Text testID="coach-trait-rule" style={st.ruleText} numberOfLines={1}>Each one: all the same, or all different</Text>
      </View>
    );
  }

  return (
    <View
      testID="run-trait-checks"
      style={[st.strip, st.cells]}
      accessibilityLabel={`Trait checks. ${live.map(c => `${c.label}${c.status === 'pass' ? ', passes' : c.status === 'fail' ? ', breaks the Set' : ''}`).join('. ')}`}
    >
      <View style={st.cellRow} testID="coach-trait-pills">
        {live.map((check, index) => (
          <TraitCell
            key={check.attr}
            check={check}
            index={index}
            added={added}
            narrow={narrow}
            revealKey={said}
          />
        ))}
      </View>
    </View>
  );
};

const st = StyleSheet.create({
  strip: { height: TRAIT_CHECKS_HEIGHT, borderRadius: 8, overflow: 'hidden' },
  rule: { borderWidth: 1.5, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  names: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ruleText: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: '800', color: INK },
  cells: {},
  cellRow: { flex: 1, flexDirection: 'row', gap: 4 },
  cell: { flex: 1, minWidth: 0, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  title: { flexShrink: 1, fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1, color: INK, opacity: 0.6 },
  titleNew: { opacity: 1, color: COLORS.impactOrange },
  value: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: '900' },
  cellPass: { backgroundColor: '#D4F4EE', borderColor: COLORS.logicTeal },
  cellFail: { backgroundColor: '#FFE1DE', borderColor: COLORS.impactRed },
  cellHint: { backgroundColor: '#FEF3C7', borderColor: '#D97706' },
  cellInfo: { backgroundColor: '#FFFBEB', borderColor: INK },
  valuePass: { color: '#0F766E' },
  valueFail: { color: '#B91C1C' },
  valueHint: { color: '#92400E' },
  valueInfo: { color: INK },
});

const CELL = { pass: st.cellPass, fail: st.cellFail, hint: st.cellHint, info: st.cellInfo } as const;
const VALUE = { pass: st.valuePass, fail: st.valueFail, hint: st.valueHint, info: st.valueInfo } as const;

export default TraitChecks;
