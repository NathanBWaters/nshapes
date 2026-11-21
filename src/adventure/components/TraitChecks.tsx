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
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import type { AttributeName } from '@/types';
import { COLORS } from '@/utils/colors';
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

/** Colour and shape first: they are what the eye sees first (the same order the checks come in). */
const inReadingOrder = (attributes: readonly AttributeName[]): AttributeName[] => [
  ...(attributes.includes('color') ? (['color'] as const) : []),
  ...(attributes.includes('shape') ? (['shape'] as const) : []),
  ...attributes.filter(a => a !== 'color' && a !== 'shape'),
];

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
  // New checks pop, so the eye goes to them
  const pop = useSharedValue(1);
  useEffect(() => {
    if (!said) return;
    pop.value = withSequence(withTiming(1.04, { duration: 90, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 140, easing: Easing.inOut(Easing.quad) }));
  }, [said, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

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
    <Animated.View
      testID="run-trait-checks"
      style={[st.strip, st.cells, popStyle]}
      accessibilityLabel={`Trait checks. ${live.map(c => `${c.label}${c.status === 'pass' ? ', passes' : c.status === 'fail' ? ', breaks the Set' : ''}`).join('. ')}`}
    >
      <View style={st.cellRow} testID="coach-trait-pills">
        {live.map(check => (
          <View key={check.attr} testID={`coach-trait-${check.attr}`} style={[st.cell, CELL[check.status]]}>
            {title(check.attr)}
            <Text style={[st.value, VALUE[check.status]]} numberOfLines={1}>
              {MARK[check.status]} {narrow ? check.brief : check.detail}
            </Text>
          </View>
        ))}
      </View>
    </Animated.View>
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
