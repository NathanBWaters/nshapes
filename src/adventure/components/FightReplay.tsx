/**
 * Fight replay: the results screen's "what just happened" view, drawn from
 * the fight log (engine/fightLog.ts).
 *
 * - A timeline of damage per move (Set hit / triggered by the Set / burns and
 *   the clock), with mistakes, level-ups, buys and waves marked, and the foe's
 *   HP underneath on the same clock.
 * - Tap a bar (or a row in the move list) to inspect it: the cards, how the
 *   Set's hit was worked out, and everything it set off, by name and source.
 * - Top damage sources for the whole fight, and the raw log as JSON.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Modal, View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import Svg, { Rect, Path, Line, Text as SvgText } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '@/components/Card';
import Icon from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import type { Card as CardType } from '@/types';
import type { FightLogCard, FightLogEntry, RunState } from '../types';
import { Btn, INK, TONE } from './ui';
import { describeLines, entrySummary, entryTitle, fmtClock, setMathRows } from './fightReplayText';

/** Categorical slots 1–3 of the validated chart palette, plus the reserved "critical" status color. */
const SERIES = {
  set: { color: '#2a78d6', label: 'Set hit' },
  triggered: { color: '#eb6834', label: 'Triggered' },
  clock: { color: '#1baf7a', label: 'Burns & clock' },
} as const;
type Series = keyof typeof SERIES;
const CRITICAL = '#d03b3b';
const GRID = '#E6E0D7';
const MUTED = 'rgba(56,56,56,0.62)';

const PLOT_TOP = 12;
const PLOT_H = 150;
const MARK_H = 18;
const AXIS_H = 16;
const GAP_H = 14;
const HP_H = 56;
const HEARTS_H = 36;
const HP_TOP = PLOT_TOP + PLOT_H + MARK_H + AXIS_H + GAP_H;
const HEARTS_TOP = HP_TOP + HP_H + GAP_H;
const Y_AXIS_W = 36;
const PAD_X = 10;
const BAR_W = 6;
const MIN_PX_PER_SEC = 7;
const TICK_STEPS_S = [5, 10, 15, 30, 60, 120, 300];

const niceMax = (v: number) => {
  if (v <= 5) return 5;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
};

/** A bar with 4px-rounded data end, square on the baseline. */
const barPath = (x: number, y: number, w: number, h: number, rounded: boolean) => {
  if (h <= 0) return '';
  const r = rounded ? Math.min(4, h, w / 2) : 0;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

/** How an entry's damage splits across the three series. */
const split = (e: FightLogEntry): Record<Series, number> =>
  e.kind === 'set'
    ? { set: e.setDamage, triggered: Math.max(0, e.damage - e.setDamage), clock: 0 }
    : { set: 0, triggered: 0, clock: e.damage };

const MARK: Partial<Record<FightLogEntry['kind'], { glyph: string; color: string }>> = {
  mistake: { glyph: '✕', color: CRITICAL },
  pick: { glyph: '★', color: INK },
  buy: { glyph: '¢', color: INK },
  hint: { glyph: '?', color: MUTED },
};

const toCard = (c: FightLogCard, i: number): CardType => ({
  id: `replay-${i}`, shape: c.shape, color: c.color, number: c.number, shading: c.shading, background: c.background, selected: false,
});

interface Props {
  run: RunState;
  visible: boolean;
  onClose: () => void;
}

const FightReplay: React.FC<Props> = ({ run, visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const log = run.log;
  const scrollRef = useRef<ScrollView>(null);
  const inspectorY = useRef(0);
  const [copied, setCopied] = useState(false);

  const biggest = useMemo(() => log.reduce((best, e, i) => (e.damage > (log[best]?.damage ?? -1) ? i : best), log.length - 1), [log]);
  const [selected, setSelected] = useState(biggest);
  const sel = Math.min(Math.max(0, selected), log.length - 1);
  const entry = log[sel];

  const setNos = useMemo(() => {
    let n = 0;
    return log.map(e => (e.kind === 'set' ? ++n : n));
  }, [log]);

  const totals = useMemo(() => {
    const t: Record<Series, number> = { set: 0, triggered: 0, clock: 0 };
    for (const e of log) {
      const s = split(e);
      t.set += s.set;
      t.triggered += s.triggered;
      t.clock += s.clock;
    }
    return t;
  }, [log]);

  // Who did the damage, over the whole fight
  const sources = useMemo(() => {
    const by = new Map<string, { name: string; series: Series; damage: number }>();
    const add = (name: string, series: Series, damage: number) => {
      if (damage <= 0) return;
      const key = `${series}|${name}`;
      const cur = by.get(key) ?? { name, series, damage: 0 };
      cur.damage += damage;
      by.set(key, cur);
    };
    add('Set hits', 'set', totals.set);
    for (const e of log) {
      for (const l of describeLines(e.lines)) {
        if (l.damage) add(l.source ?? l.label, e.kind === 'set' ? 'triggered' : 'clock', l.damage);
      }
    }
    return [...by.values()].sort((a, b) => b.damage - a.damage).slice(0, 8);
  }, [log, totals.set]);

  // ─── Chart geometry ──────────────────────────────────────────────────────
  const contentW = Math.min(width, 760) - 32;
  const durationS = Math.max(10, (log[log.length - 1]?.t ?? 0) / 1000 + 2);
  const fitPps = (contentW - Y_AXIS_W - 2 * PAD_X) / durationS;
  const pps = Math.max(fitPps, MIN_PX_PER_SEC);
  const plotW = Math.max(contentW - Y_AXIS_W, 2 * PAD_X + durationS * pps);
  const x = (t: number) => PAD_X + (t / 1000) * pps;
  const yMax = niceMax(Math.max(1, ...log.map(e => e.damage)));
  const yOf = (v: number) => PLOT_TOP + PLOT_H - (v / yMax) * PLOT_H;
  const hasHearts = run.maxHearts !== null && log.some(e => e.hearts !== null);
  const totalH = (hasHearts ? HEARTS_TOP + HEARTS_H : HP_TOP + HP_H) + 6;
  const heartsMax = Math.max(1, ...log.map(e => e.hearts ?? 0), run.maxHearts ?? 0);
  const heartsY = (h: number) => HEARTS_TOP + (1 - Math.max(0, h) / heartsMax) * HEARTS_H;
  const tickStep = TICK_STEPS_S.find(s => s * pps >= 48) ?? 600;
  const ticks = Array.from({ length: Math.floor(durationS / tickStep) + 1 }, (_, i) => i * tickStep);
  const hpY = (ratio: number) => HP_TOP + (1 - Math.max(0, Math.min(1, ratio))) * HP_H;
  const hpPath = useMemo(() => {
    let p = `M${x(0)},${hpY(1)}`;
    for (const e of log) p += `H${x(e.t)}V${hpY(e.foeMaxHp > 0 ? e.foeHp / e.foeMaxHp : 0)}`;
    return `${p}H${x(durationS * 1000)}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, pps, durationS]);
  const heartsPath = useMemo(() => {
    if (!hasHearts) return '';
    let p = `M${x(0)},${heartsY(log[0]?.hearts ?? 0)}`;
    for (const e of log) p += `H${x(e.t)}V${heartsY(e.hearts ?? 0)}`;
    return `${p}H${x(durationS * 1000)}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, pps, durationS, hasHearts, heartsMax]);

  const select = (i: number, scroll = false) => {
    setSelected(i);
    if (scroll) scrollRef.current?.scrollTo({ y: Math.max(0, inspectorY.current - 8), animated: true });
  };

  const copyJson = async () => {
    const payload = {
      level: run.level.id, fighter: run.fighter, status: run.status, endReason: run.endReason,
      weapons: run.weapons.map(w => w.name), skillNodes: run.skillNodes, totalDamage: run.totalDamage, log,
    };
    try {
      await Clipboard.setStringAsync(JSON.stringify(payload, null, 1));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable: nothing to do
    }
  };

  if (!entry) return null;
  const selX = x(entry.t);
  const lines = describeLines(entry.lines);
  const s = split(entry);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} testID="fight-replay">
      <View style={[st.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
        <View style={st.header}>
          <View style={{ flex: 1 }}>
            <Text style={st.eyebrow}>FIGHT REPLAY · {run.level.id}</Text>
            <Text style={st.title} numberOfLines={1}>What happened vs {run.foeName}</Text>
          </View>
          <TouchableOpacity testID="fight-replay-close" accessibilityRole="button" accessibilityLabel="Close replay" onPress={onClose} style={st.close}>
            <Icon name="lorc/cross-mark" size={18} color={INK} />
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={st.scroll}>
          <View style={[st.body, { width: contentW }]}>
            {/* Totals double as the legend: each series' swatch, name and share */}
            <View style={st.tiles}>
              {(Object.keys(SERIES) as Series[]).map(k => (
                <View key={k} style={st.tile} testID={`replay-total-${k}`}>
                  <View style={st.tileHead}>
                    <View style={[st.swatch, { backgroundColor: SERIES[k].color }]} />
                    <Text style={st.tileLabel} numberOfLines={1}>{SERIES[k].label}</Text>
                  </View>
                  <Text style={st.tileValue}>{totals[k]}</Text>
                  <Text style={st.tileSub}>{run.totalDamage > 0 ? Math.round((totals[k] / run.totalDamage) * 100) : 0}% of damage</Text>
                </View>
              ))}
            </View>

            <View style={st.panel}>
              <Text style={st.panelTitle}>Damage per move</Text>
              <Text style={st.panelSub}>Each bar is one move: its Set hit, plus what the Set triggered (weapons, skills, evolutions) on top. Tap anywhere on the timeline to inspect that moment. ✕ mistake · ♥ heart lost · ★ level-up pick · ¢ shop buy · ? hint. Below: the foe's HP{hasHearts ? ' and your hearts (red)' : ''}.</Text>
              <View style={{ flexDirection: 'row' }}>
                <Svg width={Y_AXIS_W} height={totalH}>
                  {[0, yMax / 2, yMax].map(v => (
                    <SvgText key={v} x={Y_AXIS_W - 6} y={yOf(v) + 4} fontSize={10} fill={MUTED} textAnchor="end">{Number.isInteger(v) ? v : v.toFixed(1)}</SvgText>
                  ))}
                  <SvgText x={Y_AXIS_W - 6} y={HP_TOP + 8} fontSize={10} fill={MUTED} textAnchor="end">Foe</SvgText>
                  <SvgText x={Y_AXIS_W - 6} y={HP_TOP + 20} fontSize={10} fill={MUTED} textAnchor="end">HP</SvgText>
                  <SvgText x={Y_AXIS_W - 6} y={HP_TOP + HP_H} fontSize={10} fill={MUTED} textAnchor="end">0</SvgText>
                  {hasHearts && <SvgText x={Y_AXIS_W - 6} y={HEARTS_TOP + 8} fontSize={10} fill={MUTED} textAnchor="end">{`${heartsMax}♥`}</SvgText>}
                  {hasHearts && <SvgText x={Y_AXIS_W - 6} y={HEARTS_TOP + HEARTS_H} fontSize={10} fill={MUTED} textAnchor="end">0</SvgText>}
                </Svg>
                <ScrollView horizontal showsHorizontalScrollIndicator={plotW > contentW - Y_AXIS_W} style={{ flex: 1 }}>
                  <Svg width={plotW} height={totalH} testID="replay-chart">
                    {/* Recessive grid */}
                    {[0, yMax / 2, yMax].map(v => (
                      <Line key={v} x1={0} x2={plotW} y1={yOf(v)} y2={yOf(v)} stroke={v === 0 ? INK : GRID} strokeWidth={v === 0 ? 1 : 1} />
                    ))}
                    <Line x1={0} x2={plotW} y1={HP_TOP + HP_H} y2={HP_TOP + HP_H} stroke={GRID} />
                    {hasHearts && <Line x1={0} x2={plotW} y1={HEARTS_TOP + HEARTS_H} y2={HEARTS_TOP + HEARTS_H} stroke={GRID} />}
                    {ticks.map(t => (
                      <SvgText key={t} x={x(t * 1000)} y={PLOT_TOP + PLOT_H + MARK_H + AXIS_H - 3} fontSize={10} fill={MUTED} textAnchor="middle">{fmtClock(t * 1000)}</SvgText>
                    ))}
                    {/* Waves */}
                    {log.map((e, i) => e.kind === 'wave' && e.wave > 0 ? (
                      <React.Fragment key={`w${i}`}>
                        <Line x1={x(e.t)} x2={x(e.t)} y1={0} y2={totalH} stroke={MUTED} strokeDasharray="3,3" />
                        <SvgText x={x(e.t) + 3} y={10} fontSize={10} fontWeight="700" fill={MUTED}>{`Wave ${e.wave + 1}`}</SvgText>
                      </React.Fragment>
                    ) : null)}
                    {/* Selection guide */}
                    <Line x1={selX} x2={selX} y1={0} y2={totalH} stroke={INK} strokeWidth={1} opacity={0.5} />
                    {/* Bars: Set hit at the base, what it triggered stacked on top, 2px surface gap between */}
                    {log.map((e, i) => {
                      if (e.damage <= 0) return null;
                      const parts = split(e);
                      const bx = x(e.t) - BAR_W / 2;
                      const dim = i === sel ? 1 : 0.6;
                      const order: Series[] = ['set', 'triggered', 'clock'];
                      const shown = order.filter(k => parts[k] > 0);
                      let base = 0;
                      return shown.map((k, j) => {
                        const y0 = yOf(base);
                        const y1 = yOf(base + parts[k]);
                        base += parts[k];
                        const gap = j > 0 ? 2 : 0;
                        return (
                          <Path key={`${i}${k}`} d={barPath(bx, y1, BAR_W, Math.max(1, y0 - y1 - gap), j === shown.length - 1)} fill={SERIES[k].color} opacity={dim} />
                        );
                      });
                    })}
                    {/* Event marks under the baseline */}
                    {log.map((e, i) => {
                      // A heart lost to anything but a mistake (bombs, foe attacks) gets its own mark
                      const m = MARK[e.kind] ?? (e.heartsDelta < 0 ? { glyph: '♥', color: CRITICAL } : undefined);
                      return m ? (
                        <SvgText key={`m${i}`} x={x(e.t)} y={PLOT_TOP + PLOT_H + 13} fontSize={11} fontWeight="900" fill={m.color} textAnchor="middle" opacity={i === sel ? 1 : 0.8}>{m.glyph}</SvgText>
                      ) : null;
                    })}
                    {/* Foe HP, same clock */}
                    <Path d={hpPath} stroke={INK} strokeWidth={2} fill="none" />
                    {hasHearts && <Path d={heartsPath} stroke={CRITICAL} strokeWidth={2} fill="none" />}
                    {/* Hit targets: each entry owns the strip halfway to its neighbours */}
                    {log.map((e, i) => {
                      const left = i === 0 ? 0 : (x(log[i - 1].t) + x(e.t)) / 2;
                      const right = i === log.length - 1 ? plotW : (x(e.t) + x(log[i + 1].t)) / 2;
                      if (right - left < 0.5) return null;
                      return <Rect key={`h${i}`} testID={`replay-bar-${i}`} x={left} y={0} width={right - left} height={totalH} fill="transparent" onPress={() => select(i)} />;
                    })}
                  </Svg>
                </ScrollView>
              </View>
            </View>

            {/* Inspector */}
            <View style={st.panel} onLayout={ev => { inspectorY.current = ev.nativeEvent.layout.y; }} testID="replay-inspector">
              <View style={st.inspectHead}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous move" disabled={sel <= 0} onPress={() => select(sel - 1)} style={[st.step, sel <= 0 && { opacity: 0.3 }]}>
                  <Text style={st.stepText}>◀</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={st.inspectTitle} testID="replay-entry-title">{entryTitle(entry, setNos[sel])}</Text>
                  <Text style={st.panelSub}>
                    {fmtClock(entry.t)} · wave {entry.wave + 1}
                    {entry.set ? ` · ${(entry.set.sinceLastMs / 1000).toFixed(1)}s after the last Set` : ''}
                  </Text>
                </View>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next move" disabled={sel >= log.length - 1} onPress={() => select(sel + 1)} style={[st.step, sel >= log.length - 1 && { opacity: 0.3 }]}>
                  <Text style={st.stepText}>▶</Text>
                </TouchableOpacity>
              </View>

              {entry.cards && (
                <View style={st.cards}>
                  {entry.cards.map((c, i) => (
                    <View key={i} style={{ alignItems: 'center', gap: 2 }}>
                      <View style={st.cardSlot}><Card card={toCard(c, i)} onClick={() => {}} disabled isPaused /></View>
                      {c.tags.map(tag => <Text key={tag} style={st.cardTag}>{tag}</Text>)}
                    </View>
                  ))}
                </View>
              )}

              <View style={st.chips}>
                <Chip label="Damage" value={`${entry.damage}`} />
                {entry.kind === 'set' && <Chip label="Set / triggered" value={`${s.set} / ${s.triggered}`} />}
                {entry.coins !== 0 && <Chip label="Coins" value={`${entry.coins > 0 ? '+' : ''}${entry.coins}`} />}
                {entry.xp > 0 && <Chip label="XP" value={`+${Math.round(entry.xp * 10) / 10}`} />}
                {entry.heartsDelta !== 0 && <Chip label="Hearts" value={`${entry.heartsDelta > 0 ? '+' : ''}${entry.heartsDelta}`} bad={entry.heartsDelta < 0} />}
                <Chip label="Foe HP after" value={`${entry.foeHp}/${entry.foeMaxHp}`} />
              </View>

              {entry.set && (
                <View style={st.section}>
                  <Text style={st.sectionTitle}>HOW THE SET HIT</Text>
                  {setMathRows(entry.set).map((r, i) => (
                    <View key={i} style={[st.row, r.total && st.totalRow]}>
                      <Text style={[st.rowLabel, r.total && st.bold]}>{r.label}</Text>
                      <Text style={[st.rowValue, r.total && st.bold]}>{r.value}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={st.section}>
                <Text style={st.sectionTitle}>{entry.kind === 'set' ? 'WHAT IT SET OFF' : 'WHAT HAPPENED'}</Text>
                {lines.length === 0 ? (
                  <Text style={st.empty}>Nothing else happened.</Text>
                ) : (
                  lines.map((l, i) => (
                    <View key={i} style={st.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={st.rowLabel}>{l.label}{l.count > 1 ? ` ×${l.count}` : ''}</Text>
                        {l.source && <Text style={st.source}>from {l.source}</Text>}
                      </View>
                      {l.damage !== undefined && <Text style={st.rowValue}>{l.damage} dmg</Text>}
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* Top sources */}
            <View style={st.panel}>
              <Text style={st.panelTitle}>Where the damage came from</Text>
              {sources.map(src => (
                <View key={`${src.series}${src.name}`} style={st.srcRow}>
                  <Text style={st.srcName} numberOfLines={1}>{src.name}</Text>
                  <View style={st.srcTrack}>
                    <View style={[st.srcBar, { width: `${Math.max(2, (src.damage / (sources[0]?.damage || 1)) * 100)}%`, backgroundColor: SERIES[src.series].color }]} />
                  </View>
                  <Text style={st.srcValue}>{src.damage}</Text>
                </View>
              ))}
            </View>

            {/* Move list (the table view of the chart) */}
            <View style={st.panel}>
              <Text style={st.panelTitle}>Every move</Text>
              {log.map((e, i) => (
                <TouchableOpacity key={i} testID={`replay-row-${i}`} onPress={() => select(i, true)} style={[st.listRow, i === sel && { backgroundColor: TONE.selected }]}>
                  <Text style={st.listTime}>{fmtClock(e.t)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.listTitle, e.kind === 'mistake' && { color: CRITICAL }]} numberOfLines={1}>{entryTitle(e, setNos[i])}</Text>
                    {!!entrySummary(e) && <Text style={st.source} numberOfLines={1}>{entrySummary(e)}</Text>}
                  </View>
                  <Text style={st.listDmg}>{e.damage > 0 ? e.damage : '–'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn label={copied ? 'Copied!' : 'Copy log as JSON'} variant="secondary" icon="lorc/scroll-unfurled" small onPress={copyJson} style={{ flex: 1 }} />
              <Btn label="Close" small onPress={onClose} style={{ flex: 1 }} />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const Chip: React.FC<{ label: string; value: string; bad?: boolean }> = ({ label, value, bad }) => (
  <View style={st.chip}>
    <Text style={st.chipLabel}>{label}</Text>
    <Text style={[st.chipValue, bad && { color: CRITICAL }]}>{value}</Text>
  </View>
);

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: undefined });

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.paperBeige },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: MUTED },
  title: { fontSize: 20, fontWeight: '900', color: INK },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvasWhite, borderWidth: 1.5, borderColor: INK },
  scroll: { alignItems: 'center', paddingBottom: 24 },
  body: { gap: 12 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, backgroundColor: COLORS.canvasWhite, borderRadius: 10, borderWidth: 1.5, borderColor: INK, padding: 8, gap: 2 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  tileLabel: { flex: 1, fontSize: 10, fontWeight: '800', color: INK },
  tileValue: { fontSize: 20, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  tileSub: { fontSize: 10, color: MUTED },
  panel: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 1.5, borderColor: INK, padding: 12, gap: 8 },
  panelTitle: { fontSize: 15, fontWeight: '900', color: INK },
  panelSub: { fontSize: 11, color: MUTED },
  inspectHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inspectTitle: { fontSize: 17, fontWeight: '900', color: INK, textAlign: 'center' },
  step: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  stepText: { fontSize: 16, color: INK },
  cards: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  cardSlot: { width: 56, height: 75 },
  cardTag: { fontSize: 10, fontWeight: '800', color: INK },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: COLORS.paperBeige, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  chipLabel: { fontSize: 9, fontWeight: '800', color: MUTED, letterSpacing: 0.5 },
  chipValue: { fontSize: 14, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  section: { gap: 4 },
  sectionTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: MUTED },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  totalRow: { borderTopWidth: 1, borderTopColor: GRID, paddingTop: 5 },
  rowLabel: { flex: 1, fontSize: 13, color: INK },
  rowValue: { fontSize: 13, color: INK, fontVariant: ['tabular-nums'], fontFamily: mono },
  bold: { fontWeight: '900' },
  source: { fontSize: 11, color: MUTED },
  empty: { fontSize: 12, color: MUTED, fontStyle: 'italic' },
  srcRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  srcName: { width: 120, fontSize: 12, fontWeight: '700', color: INK },
  srcTrack: { flex: 1, height: 10, justifyContent: 'center' },
  srcBar: { height: 10, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  srcValue: { width: 40, textAlign: 'right', fontSize: 12, color: INK, fontVariant: ['tabular-nums'] },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 6 },
  listTime: { width: 38, fontSize: 12, color: MUTED, fontVariant: ['tabular-nums'] },
  listTitle: { fontSize: 13, fontWeight: '800', color: INK },
  listDmg: { width: 36, textAlign: 'right', fontSize: 13, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
});

export default FightReplay;
