/**
 * Shared pre-battle Set-Parry briefing card.
 *
 * Reused in Adventure Mode (`LevelPreview.tsx`), in-fight `HudInspector.tsx`,
 * and Starfall Spire (`SpireEncounterPreview.tsx`) so players ALWAYS know the
 * foe's telegraphed strike and Counter-Set requirement up front before fighting.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import type { ParrySpec } from '../types';
import { parryCounterMeta, parryPenaltyText } from '../data/parry';
import { INK, TONE } from './ui';

interface Props {
  spec: ParrySpec;
  compact?: boolean;
  testID?: string;
}

const ParryPreviewCard: React.FC<Props> = ({ spec, compact = false, testID = 'preview-parry-card' }) => {
  const meta = parryCounterMeta(spec.counter);
  const isSpecific = spec.counter.kind !== 'any';
  const perfectSec = (spec.perfectWindowMs / 1000).toFixed(1).replace(/\.0$/, '');
  const windupSec = Math.round(spec.windupMs / 1000);

  return (
    <View testID={testID} style={[st.box, isSpecific && st.boxSpecific, compact && st.boxCompact]}>
      <View style={st.topRow}>
        <View style={[st.iconBadge, { backgroundColor: meta.color }]}>
          <Icon name={spec.icon} size={16} color={COLORS.canvasWhite} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={st.eyebrowRow}>
            <Text style={st.eyebrow}>{isSpecific ? 'COUNTER PARRY' : 'TIMING PARRY'}</Text>
            <Text style={st.penalty}>{parryPenaltyText(spec.penalty)}</Text>
          </View>
          <Text style={st.title} numberOfLines={1}>
            {spec.attackName} · {windupSec}s wind-up
          </Text>
        </View>
      </View>

      <View style={st.counterRow}>
        <View style={[st.counterPill, { borderColor: meta.color, backgroundColor: COLORS.canvasWhite }]}>
          <Icon name={meta.icon} size={13} color={meta.color} />
          <Text style={[st.counterPillText, { color: meta.color }]}>COUNTER: {meta.shortLabel}</Text>
        </View>
        <View style={st.perfectPill}>
          <Icon name="lorc/shield-reflect" size={12} color="#92400E" />
          <Text style={st.perfectText}>Last {perfectSec}s = PERFECT (×2 Stagger)</Text>
        </View>
      </View>

      {!compact && <Text style={st.desc}>{meta.explain}</Text>}
    </View>
  );
};

const st = StyleSheet.create({
  box: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D97706',
    padding: 10,
    gap: 6,
  },
  boxSpecific: {
    backgroundColor: '#FEF2F2',
    borderColor: '#B91C1C',
  },
  boxCompact: {
    padding: 8,
    gap: 5,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: '#92400E',
    textTransform: 'uppercase',
  },
  penalty: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B91C1C',
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    color: INK,
  },
  counterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  counterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 2,
  },
  counterPillText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  perfectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: TONE.coinPale,
    borderWidth: 1.5,
    borderColor: '#D97706',
  },
  perfectText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
  desc: {
    fontSize: 12,
    lineHeight: 16,
    color: INK,
    opacity: 0.85,
  },
});

export default ParryPreviewCard;
