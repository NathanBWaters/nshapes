/**
 * Camp → History: every battle fought, newest first, each with its score
 * (damage per minute of fight clock). Tap a battle for the rest of its numbers.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import { sfx } from '@/audio';
import { getArmoryWeapon } from '../data/armory';
import { FIGHTERS } from '../data/fighters';
import { formatDuration, formatWhen, summarize, type BattleOutcome, type BattleRecord } from '../history';
import { Btn, INK, StarRow, TONE } from './ui';

/** Battles shown at first, and added by each "show older" */
const PAGE = 30;

const OUTCOME: Record<Exclude<BattleOutcome, 'won' | 'survived'>, { label: string; bg: string; fg: string }> = {
  lost: { label: 'DEFEATED', bg: '#FFE1DE', fg: COLORS.impactRed },
  practice: { label: 'PRACTICE', bg: '#F6E3A8', fg: '#6B4E12' },
  left: { label: 'LEFT EARLY', bg: '#EAE5DD', fg: TONE.spent },
};

const fighterIcon = (name: string) => FIGHTERS.find(f => f.name === name)?.icon ?? 'lorc/crossed-swords';

interface Props {
  history: readonly BattleRecord[];
  /** "Now", for the dates (injectable so they can be tested) */
  now?: number;
}

const BattleHistory: React.FC<Props> = ({ history, now }) => {
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const clock = useMemo(() => now ?? Date.now(), [now]);
  const totals = useMemo(() => summarize(history), [history]);
  // Newest first
  const battles = useMemo(() => [...history].reverse(), [history]);

  if (battles.length === 0) {
    return (
      <View style={st.empty} testID="history-empty">
        <Icon name="delapouite/scroll-quill" size={34} color={INK} />
        <Text style={st.emptyTitle}>No battles yet</Text>
        <Text style={st.emptyText}>Every fight you finish is written down here, with its damage per minute.</Text>
      </View>
    );
  }

  return (
    <>
      <View style={st.totals} testID="history-totals">
        <Total label="Battles" value={totals.battles} />
        <Total label="Knockouts" value={totals.wins} />
        <Total label="Best dmg / min" value={totals.bestDpm} hot />
        <Total label="Biggest hit" value={totals.biggestHit} />
      </View>

      {battles.slice(0, shown).map((b, i) => {
        // (two battles cannot end in the same millisecond, but a key should not depend on that)
        const key = `${b.at}-${battles.length - i}`;
        const expanded = open === key;
        const badge = b.outcome === 'won' || b.outcome === 'survived' ? null : OUTCOME[b.outcome];
        const weapons = b.weapons.map(id => getArmoryWeapon(id)?.name ?? id);
        return (
          <TouchableOpacity
            key={key}
            testID="history-battle"
            onPress={() => { sfx('click'); setOpen(expanded ? null : key); }}
            activeOpacity={0.9}
            accessibilityState={{ expanded }}
            accessibilityLabel={`${b.levelName}, ${b.dpm} damage per minute`}
            style={st.card}
          >
            <View style={st.row}>
              <View style={st.portrait}><Icon name={fighterIcon(b.fighter)} size={26} color={INK} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={st.level} numberOfLines={1}>
                  {b.outcome === 'practice' ? '' : `${b.levelId} · `}{b.levelName}
                </Text>
                <Text style={st.sub} numberOfLines={1}>vs {b.foe} · {formatWhen(b.at, clock)}</Text>
                {badge ? (
                  <View style={[st.badge, { backgroundColor: badge.bg }]}><Text style={[st.badgeText, { color: badge.fg }]}>{badge.label}</Text></View>
                ) : (
                  <StarRow stars={b.stars} size={14} />
                )}
              </View>
              <View style={st.score}>
                <Text style={st.dpm}>{b.dpm.toLocaleString()}</Text>
                <Text style={st.dpmLabel}>damage / min</Text>
              </View>
            </View>

            {expanded && (
              <View style={st.details} testID="history-details">
                <View style={st.facts}>
                  <Fact label="Damage" value={b.damage.toLocaleString()} />
                  <Fact label="Biggest hit" value={`${b.biggestHit}`} />
                  <Fact label="Sets" value={`${b.sets}`} />
                  <Fact label="Mistakes" value={`${b.mistakes}`} />
                  <Fact label="Fight clock" value={formatDuration(b.durationMs)} />
                  {b.coins > 0 && <Fact label="Coins" value={`+${b.coins}`} />}
                  {b.evolutions > 0 && <Fact label="Evolutions" value={`${b.evolutions}`} />}
                </View>
                <Text style={st.sub}>
                  {b.fighter}{weapons.length > 0 ? ` with ${weapons.join(', ')}` : ', no weapons'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      {battles.length > shown && (
        <Btn
          testID="history-more"
          small
          variant="secondary"
          label={`Show older battles (${battles.length - shown} more)`}
          onPress={() => setShown(n => n + PAGE)}
        />
      )}
    </>
  );
};

const Total: React.FC<{ label: string; value: number; hot?: boolean }> = ({ label, value, hot }) => (
  <View style={[st.total, hot && { backgroundColor: COLORS.actionYellow }]}>
    <Text style={st.totalValue}>{value.toLocaleString()}</Text>
    <Text style={st.totalLabel}>{label}</Text>
  </View>
);

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={st.fact}>
    <Text style={st.factValue}>{value}</Text>
    <Text style={st.factLabel}>{label}</Text>
  </View>
);

const st = StyleSheet.create({
  empty: { alignItems: 'center', gap: 6, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 20, marginTop: 8 },
  emptyTitle: { fontWeight: '900', fontSize: 16, color: INK },
  emptyText: { fontSize: 12, color: INK, opacity: 0.8, textAlign: 'center' },
  totals: { flexDirection: 'row', gap: 6 },
  total: { flex: 1, alignItems: 'center', backgroundColor: COLORS.canvasWhite, borderRadius: 8, borderWidth: 2, borderColor: INK, paddingVertical: 8, paddingHorizontal: 2 },
  totalValue: { fontWeight: '900', fontSize: 18, color: INK, fontVariant: ['tabular-nums'] },
  totalLabel: { fontSize: 10, fontWeight: '700', color: INK, opacity: 0.7, textAlign: 'center' },
  card: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 10, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  portrait: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  level: { fontWeight: '900', fontSize: 14, color: INK },
  sub: { fontSize: 11, color: INK, opacity: 0.75 },
  badge: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  score: { alignItems: 'flex-end' },
  dpm: { fontWeight: '900', fontSize: 22, color: INK, fontVariant: ['tabular-nums'] },
  dpmLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, color: INK, opacity: 0.65, textTransform: 'uppercase' },
  details: { gap: 6, borderTopWidth: 1, borderTopColor: '#E2DBCF', paddingTop: 8 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fact: { backgroundColor: COLORS.paperBeige, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center', minWidth: 62 },
  factValue: { fontWeight: '900', fontSize: 14, color: INK, fontVariant: ['tabular-nums'] },
  factLabel: { fontSize: 9, fontWeight: '700', color: INK, opacity: 0.7 },
});

export default BattleHistory;
