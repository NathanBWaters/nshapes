/**
 * Camp → History: DPM timeline chart and every battle fought, newest first.
 * Tap a battle (or a bar on the chart) to expand its damage split, gear,
 * and open the full FightReplay breakdown.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import Icon from '@/components/Icon';
import RoundFunPrompt from '@/components/RoundFunPrompt';
import { WeaponAvatar } from '@/components/weapons';
import type { FunRating, FunTag } from '@/analytics/fightEvent';
import { COLORS } from '@/utils/colors';
import { sfx } from '@/audio';
import { FIGHTERS } from '../data/fighters';
import {
  buildReplayWeapons,
  formatDuration,
  formatWhen,
  summarize,
  type BattleOutcome,
  type BattleRecord,
  type FightReplayData,
} from '../history';
import FightReplay, { DamageSplitBar, REPLAY_SERIES, barPath, niceMax, splitLogDamage } from './FightReplay';
import PowerExplainer from './PowerExplainer';
import WeaponExplainer from './WeaponExplainer';
import { Btn, INK, PopIn, StarRow, TONE } from './ui';
import { STAGGER, staggerDelay } from '@/utils/motion';

/** Battles shown at first, and added by each "show older" */
const PAGE = 30;
/** Most recent battles shown in the DPM timeline chart */
const CHART_CAP = 24;

const OUTCOME: Record<Exclude<BattleOutcome, 'won' | 'survived'>, { label: string; bg: string; fg: string }> = {
  lost: { label: 'DEFEATED', bg: '#FFE1DE', fg: COLORS.impactRed },
  practice: { label: 'PRACTICE', bg: '#F6E3A8', fg: '#6B4E12' },
  left: { label: 'LEFT EARLY', bg: '#EAE5DD', fg: TONE.spent },
};

const BAR_COLOR: Record<BattleOutcome, string> = {
  won: REPLAY_SERIES.clock.color,
  survived: REPLAY_SERIES.clock.color,
  lost: '#d03b3b',
  practice: REPLAY_SERIES.triggered.color,
  left: '#9ca3af',
};

const MUTED = 'rgba(56,56,56,0.62)';
const GRID = '#E6E0D7';
const CHART_AXIS_W = 34;
const CHART_TOP = 12;
const CHART_H = 104;
const CHART_BOTTOM = 20;

const fighterIcon = (name: string) => FIGHTERS.find(f => f.name === name)?.icon ?? 'lorc/crossed-swords';
const keyOf = (b: BattleRecord, chronologicalIndex: number) => `${b.at}-${chronologicalIndex}`;

interface Props {
  history: readonly BattleRecord[];
  /** "Now", for the dates (injectable so they can be tested) */
  now?: number;
  onRateBattle?: (battle: BattleRecord, rating: FunRating | null, tags: FunTag[]) => void;
}

const BattleHistory: React.FC<Props> = ({ history, now, onRateBattle }) => {
  const { width } = useWindowDimensions();
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const [openPowerKey, setOpenPowerKey] = useState<string | null>(null);
  const [replay, setReplay] = useState<FightReplayData | null>(null);
  const clock = useMemo(() => now ?? Date.now(), [now]);
  const totals = useMemo(() => summarize(history), [history]);
  // Newest first for the list
  const battles = useMemo(() => [...history].reverse(), [history]);

  // Up to the newest CHART_CAP fights, oldest → newest (left → right)
  const chartItems = useMemo(() => {
    const start = Math.max(0, history.length - CHART_CAP);
    return history.slice(start).map((b, i) => ({
      battle: b,
      key: keyOf(b, start + i + 1),
      descIndex: history.length - 1 - (start + i),
    }));
  }, [history]);

  if (battles.length === 0) {
    return (
      <View style={st.empty} testID="history-empty">
        <Icon name="delapouite/scroll-quill" size={34} color={INK} />
        <Text style={st.emptyTitle}>No battles yet</Text>
        <Text style={st.emptyText}>Every fight you finish is written down here, with its damage per minute.</Text>
      </View>
    );
  }

  const contentW = Math.max(220, Math.min(width, 560) - 56);
  const plotW = Math.max(140, contentW - CHART_AXIS_W);
  const svgH = CHART_TOP + CHART_H + CHART_BOTTOM;
  const maxDpm = Math.max(1, ...chartItems.map(c => c.battle.dpm));
  const bestScored = chartItems.reduce((m, c) => (c.battle.outcome === 'left' ? m : Math.max(m, c.battle.dpm)), 0);
  const yMax = niceMax(maxDpm);
  const yOf = (v: number) => CHART_TOP + CHART_H - (v / yMax) * CHART_H;
  const slotW = plotW / chartItems.length;
  const barW = Math.max(4, Math.min(24, slotW * 0.62));

  const selectFromChart = (item: (typeof chartItems)[number]) => {
    sfx('click');
    if (item.descIndex >= shown) setShown(Math.ceil((item.descIndex + 1) / PAGE) * PAGE);
    setOpen(prev => (prev === item.key ? null : item.key));
  };

  return (
    <>
      <View style={st.totals} testID="history-totals">
        <Total label="Battles" value={totals.battles} />
        <Total label="Knockouts" value={totals.wins} />
        <Total label="Best dmg / min" value={totals.bestDpm} hot />
        <Total label="Biggest hit" value={totals.biggestHit} />
      </View>

      <View style={st.chartCard}>
        <View style={st.chartHead}>
          <Text style={st.chartTitle}>Damage / min timeline</Text>
          <Text style={st.chartSub}>
            {chartItems.length === 1 ? 'Latest fight' : `Last ${chartItems.length} fights · tap a bar`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Svg width={CHART_AXIS_W} height={svgH}>
            {[0, yMax / 2, yMax].map(v => (
              <SvgText key={v} x={CHART_AXIS_W - 6} y={yOf(v) + 4} fontSize={10} fill={MUTED} textAnchor="end">
                {Number.isInteger(v) ? v : Math.round(v)}
              </SvgText>
            ))}
          </Svg>
          <Svg width={plotW} height={svgH} testID="history-chart">
            {[0, yMax / 2, yMax].map(v => (
              <Line key={v} x1={0} x2={plotW} y1={yOf(v)} y2={yOf(v)} stroke={v === 0 ? INK : GRID} strokeWidth={1} />
            ))}
            {bestScored > 0 && chartItems.length > 1 && (
              <Line
                x1={0}
                x2={plotW}
                y1={yOf(bestScored)}
                y2={yOf(bestScored)}
                stroke={MUTED}
                strokeDasharray="3,3"
                strokeWidth={1}
              />
            )}
            {chartItems.map((item, ci) => {
              const bx = ci * slotW + (slotW - barW) / 2;
              const yTop = yOf(item.battle.dpm);
              const bh = Math.max(2, CHART_TOP + CHART_H - yTop);
              const selected = open === item.key;
              return (
                <React.Fragment key={item.key}>
                  <Path
                    d={barPath(bx, CHART_TOP + CHART_H - bh, barW, bh, true)}
                    fill={BAR_COLOR[item.battle.outcome]}
                    opacity={open && !selected ? 0.55 : 0.95}
                    stroke={selected ? INK : 'none'}
                    strokeWidth={selected ? 1.5 : 0}
                  />
                  <Rect
                    testID={`history-chart-bar-${ci}`}
                    x={ci * slotW}
                    y={0}
                    width={slotW}
                    height={svgH}
                    fill="transparent"
                    onPress={() => selectFromChart(item)}
                  />
                </React.Fragment>
              );
            })}
            <SvgText x={2} y={CHART_TOP + CHART_H + 14} fontSize={9} fill={MUTED} textAnchor="start">
              {chartItems.length > 1 ? 'Older' : chartItems[0].battle.levelId}
            </SvgText>
            {chartItems.length > 1 && (
              <SvgText x={plotW - 2} y={CHART_TOP + CHART_H + 14} fontSize={9} fill={MUTED} textAnchor="end">
                Latest
              </SvgText>
            )}
          </Svg>
        </View>
        <View style={st.legend}>
          <LegendDot color={BAR_COLOR.won} label="Win" />
          <LegendDot color={BAR_COLOR.lost} label="Defeat" />
          <LegendDot color={BAR_COLOR.practice} label="Practice" />
          <LegendDot color={BAR_COLOR.left} label="Left" />
        </View>
      </View>

      {battles.slice(0, shown).map((b, i) => {
        // (two battles cannot end in the same millisecond, but a key should not depend on that)
        const key = keyOf(b, battles.length - i);
        const expanded = open === key;
        const badge = b.outcome === 'won' || b.outcome === 'survived' ? null : OUTCOME[b.outcome];
        const heldWeapons = buildReplayWeapons(b.weapons, b.replay?.weaponBuilds, b.replay?.growth);
        const weapons = heldWeapons.map(w => w.name);
        const hasReplay = !!b.replay && b.replay.log.length > 1;
        const damageSplit = b.replay ? splitLogDamage(b.replay.log) : null;
        return (
          <PopIn
            key={key}
            delay={i < 8 ? staggerDelay(i, Math.min(battles.length, 8), STAGGER.card) : 0}
            style={[st.card, expanded && st.cardOpen]}
          >
            <TouchableOpacity
              testID="history-battle"
              onPress={() => { sfx('click'); setOpen(expanded ? null : key); }}
              activeOpacity={0.9}
              accessibilityState={{ expanded }}
              accessibilityLabel={`${b.levelName}, ${b.dpm} damage per minute`}
            >
              <View style={st.row}>
                <View style={st.portrait}><Icon name={fighterIcon(b.fighter)} size={26} color={INK} /></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={st.titleRow}>
                    <Text style={st.level} numberOfLines={1}>
                      {b.outcome === 'practice' ? '' : `${b.levelId} · `}{b.levelName}
                    </Text>
                    {hasReplay && (
                      <View style={st.replayBadge}>
                        <Icon name="lorc/magnifying-glass" size={11} color={INK} />
                      </View>
                    )}
                  </View>
                  <Text style={st.sub} numberOfLines={1}>vs {b.foe} · {formatWhen(b.at, clock)}</Text>
                  <View style={st.metaRow}>
                    {badge ? (
                      <View style={[st.badge, { backgroundColor: badge.bg }]}><Text style={[st.badgeText, { color: badge.fg }]}>{badge.label}</Text></View>
                    ) : (
                      <StarRow stars={b.stars} size={14} />
                    )}
                    {b.funRating && (
                      <View
                        testID="history-fun-badge"
                        style={[st.funBadge, b.funRating === 'up' ? st.funBadgeUp : st.funBadgeDown]}
                      >
                        <Icon
                          name={b.funRating === 'up' ? 'delapouite/thumb-up' : 'delapouite/thumb-down'}
                          size={11}
                          color={COLORS.canvasWhite}
                          noShadow
                        />
                      </View>
                    )}
                    {heldWeapons.length > 0 && (
                      <View style={st.weaponIcons}>
                        {heldWeapons.slice(0, 5).map(w => (
                          <WeaponAvatar key={w.id} weapon={w} size={18} />
                        ))}
                        {heldWeapons.length > 5 && <Text style={st.moreWeapons}>+{heldWeapons.length - 5}</Text>}
                      </View>
                    )}
                  </View>
                </View>
                <View style={st.score}>
                  <Text style={st.dpm}>{b.dpm.toLocaleString()}</Text>
                  <Text style={st.dpmLabel}>damage / min</Text>
                </View>
              </View>
            </TouchableOpacity>

            {expanded && (
              <PopIn style={st.details}>
                <View testID="history-details" style={{ gap: 8 }}>
                <View style={st.facts}>
                  <Fact label="Damage" value={b.damage.toLocaleString()} />
                  <Fact label="Biggest hit" value={`${b.biggestHit}`} />
                  <Fact label="Sets" value={`${b.sets}`} />
                  <Fact label="Mistakes" value={`${b.mistakes}`} />
                  <Fact label="Fight clock" value={formatDuration(b.durationMs)} />
                  {b.coins > 0 && <Fact label="Coins" value={`+${b.coins}`} />}
                  {b.evolutions > 0 && <Fact label="Evolutions" value={`${b.evolutions}`} />}
                  {(b.power ?? 1) > 1 && (
                    <Fact
                      testID="history-power"
                      label={openPowerKey === key ? 'Power (hide)' : 'Power · tap ?'}
                      value={`×${b.power}`}
                      active={openPowerKey === key}
                      onPress={() => { sfx('click'); setOpenPowerKey(prev => (prev === key ? null : key)); }}
                    />
                  )}
                </View>

                {openPowerKey === key && (b.power ?? 1) > 1 && (
                  <PowerExplainer
                    points={b.replay?.power}
                    multiplier={b.power}
                    weapons={heldWeapons}
                    evolutionsTriggered={b.evolutions}
                    subtitle={`Peak multiplier reached: ×${b.power}`}
                    compact
                  />
                )}

                {damageSplit && b.replay && b.replay.totalDamage > 0 && (
                  <DamageSplitBar
                    totals={damageSplit}
                    totalDamage={b.replay.totalDamage}
                    showLegend
                    testID="history-damage-split"
                  />
                )}

                <Text style={st.sub}>
                  {b.fighter}{weapons.length > 0 ? ` with ${weapons.join(', ')}` : ', no weapons'}
                </Text>

                {onRateBattle && (
                  <RoundFunPrompt
                    compact
                    title="Was this round fun?"
                    rating={b.funRating ?? null}
                    tags={b.funTags ?? []}
                    onChange={(rating, tags) => onRateBattle(b, rating, tags)}
                    testIDPrefix="history-fun"
                  />
                )}

                {hasReplay ? (
                  <Btn
                    testID="history-replay"
                    label="What happened? See the fight"
                    icon="lorc/magnifying-glass"
                    small
                    onPress={() => { sfx('click'); setReplay(b.replay!); }}
                  />
                ) : (
                  heldWeapons.length > 0 && (
                    <View style={st.legacyGear} testID="history-legacy-gear">
                      {heldWeapons.map(w => (
                        <WeaponExplainer key={w.id} weapon={w} />
                      ))}
                    </View>
                  )
                )}
                </View>
              </PopIn>
            )}
          </PopIn>
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

      <FightReplay replay={replay ?? undefined} visible={replay !== null} onClose={() => setReplay(null)} />
    </>
  );
};

const LegendDot: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <View style={st.legendItem}>
    <View style={[st.legendSwatch, { backgroundColor: color }]} />
    <Text style={st.legendText}>{label}</Text>
  </View>
);

const Total: React.FC<{ label: string; value: number; hot?: boolean }> = ({ label, value, hot }) => (
  <View style={[st.total, hot && { backgroundColor: COLORS.actionYellow }]}>
    <Text style={st.totalValue}>{value.toLocaleString()}</Text>
    <Text style={st.totalLabel}>{label}</Text>
  </View>
);

const Fact: React.FC<{ label: string; value: string; testID?: string; active?: boolean; onPress?: () => void }> = ({ label, value, testID, active, onPress }) => {
  if (onPress) {
    return (
      <TouchableOpacity
        testID={testID}
        style={[st.fact, st.factButton, active && { backgroundColor: COLORS.actionYellow }]}
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityRole="button"
      >
        <Text style={st.factValue}>{value}</Text>
        <Text style={st.factLabel}>{label}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={st.fact} testID={testID}>
      <Text style={st.factValue}>{value}</Text>
      <Text style={st.factLabel}>{label}</Text>
    </View>
  );
};

const st = StyleSheet.create({
  empty: { alignItems: 'center', gap: 6, backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 20, marginTop: 8 },
  emptyTitle: { fontWeight: '900', fontSize: 16, color: INK },
  emptyText: { fontSize: 12, color: INK, opacity: 0.8, textAlign: 'center' },
  totals: { flexDirection: 'row', gap: 6 },
  total: { flex: 1, alignItems: 'center', backgroundColor: COLORS.canvasWhite, borderRadius: 8, borderWidth: 2, borderColor: INK, paddingVertical: 8, paddingHorizontal: 2 },
  totalValue: { fontWeight: '900', fontSize: 18, color: INK, fontVariant: ['tabular-nums'] },
  totalLabel: { fontSize: 10, fontWeight: '700', color: INK, opacity: 0.7, textAlign: 'center' },
  card: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2.5, borderBottomWidth: 5, borderColor: INK, padding: 10, gap: 8 },
  cardOpen: { backgroundColor: '#FFFDF7' },
  chartCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2, borderColor: INK, padding: 12, gap: 6 },
  chartHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  chartTitle: { fontWeight: '900', fontSize: 13, color: INK },
  chartSub: { fontSize: 11, color: MUTED },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: 10, fontWeight: '700', color: MUTED },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  replayBadge: { backgroundColor: TONE.coinPale, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 1 },
  weaponIcons: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  moreWeapons: { fontSize: 10, fontWeight: '800', color: MUTED, marginLeft: 2 },
  portrait: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: INK, backgroundColor: COLORS.paperBeige, alignItems: 'center', justifyContent: 'center' },
  level: { flexShrink: 1, fontWeight: '900', fontSize: 14, color: INK },
  sub: { fontSize: 11, color: INK, opacity: 0.75 },
  badge: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  funBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  funBadgeUp: { backgroundColor: COLORS.logicTeal },
  funBadgeDown: { backgroundColor: COLORS.impactOrange },
  score: { alignItems: 'flex-end' },
  dpm: { fontWeight: '900', fontSize: 22, color: INK, fontVariant: ['tabular-nums'] },
  dpmLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, color: INK, opacity: 0.65, textTransform: 'uppercase' },
  details: { gap: 8, borderTopWidth: 1, borderTopColor: '#E2DBCF', paddingTop: 8 },
  legacyGear: { gap: 6, marginTop: 2 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fact: { backgroundColor: COLORS.paperBeige, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center', minWidth: 62 },
  factButton: { borderWidth: 1.5, borderColor: INK },
  factValue: { fontWeight: '900', fontSize: 14, color: INK, fontVariant: ['tabular-nums'] },
  factLabel: { fontSize: 9, fontWeight: '700', color: INK, opacity: 0.7 },
});

export default BattleHistory;
