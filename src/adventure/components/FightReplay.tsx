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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import Svg, { Rect, Path, Line, Text as SvgText } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '@/components/Card';
import Icon, { type IconName } from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import type { Card as CardType } from '@/types';
import type { FightLogCard, FightLogEntry, RunState } from '../types';
import { Btn, INK, TONE } from './ui';
import { ARCANA } from '../data/arcana';
import { getArmoryWeapon } from '../data/armory';
import { weaponGuide } from '../data/weaponGuide';
import { getRecipe, getSkillNode } from '../engine/sources';
import { buildReplayWeapons, fightReplayOf, type FightReplayData } from '../history';
import { describeLines, entrySummary, entryTitle, fightSummary, fmtClock, gearStats, gearStatText, setMathRows } from './fightReplayText';
import WeaponExplainer from './WeaponExplainer';

/** Categorical slots 1–3 of the validated chart palette, plus the reserved "critical" status color. */
export const REPLAY_SERIES = {
  set: { color: '#2a78d6', label: 'Set hit' },
  triggered: { color: '#eb6834', label: 'Triggered' },
  clock: { color: '#1baf7a', label: 'Burns & clock' },
} as const;
const SERIES = REPLAY_SERIES;
export type ReplaySeries = keyof typeof REPLAY_SERIES;
type Series = ReplaySeries;
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
const Y_AXIS_W = 36;
const PANEL_INSET = 27;
const PAD_X = 10;
const BAR_W = 6;
const MIN_PX_PER_SEC = 7;
const TICK_STEPS_S = [5, 10, 15, 30, 60, 120, 300];

export const niceMax = (v: number) => {
  if (v <= 5) return 5;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
};

/** A bar with 4px-rounded data end, square on the baseline. */
export const barPath = (x: number, y: number, w: number, h: number, rounded: boolean) => {
  if (h <= 0) return '';
  const r = rounded ? Math.min(4, h, w / 2) : 0;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

/** How an entry's damage splits across the three series. */
const split = (e: FightLogEntry): Record<Series, number> =>
  e.kind === 'set'
    ? { set: e.setDamage, triggered: Math.max(0, e.damage - e.setDamage), clock: 0 }
    : { set: 0, triggered: 0, clock: e.damage };

/** Total Set / Triggered / Burns & clock damage across a whole log. */
export const splitLogDamage = (log: readonly FightLogEntry[]): Record<ReplaySeries, number> => {
  const t: Record<ReplaySeries, number> = { set: 0, triggered: 0, clock: 0 };
  for (const e of log) {
    const s = split(e);
    t.set += s.set;
    t.triggered += s.triggered;
    t.clock += s.clock;
  }
  return t;
};

/** Proportional stacked bar showing how damage split across Set hits, Triggered, and Burns & clock. */
export const DamageSplitBar: React.FC<{
  totals: Record<ReplaySeries, number>;
  totalDamage?: number;
  height?: number;
  showLegend?: boolean;
  testID?: string;
}> = ({ totals, totalDamage, height = 10, showLegend = false, testID }) => {
  const sum = totals.set + totals.triggered + totals.clock;
  const denom = totalDamage && totalDamage > 0 ? totalDamage : sum;
  if (sum <= 0 || denom <= 0) return null;
  const keys: ReplaySeries[] = ['set', 'triggered', 'clock'];
  return (
    <View style={{ gap: 4 }} testID={testID}>
      <View style={[st.splitTrack, { height }]}>
        {keys.map(k => {
          const v = totals[k];
          if (v <= 0) return null;
          return <View key={k} style={{ width: `${(v / sum) * 100}%`, height: '100%', backgroundColor: SERIES[k].color }} />;
        })}
      </View>
      {showLegend && (
        <View style={st.splitLegend}>
          {keys.map(k => {
            const v = totals[k];
            if (v <= 0) return null;
            const pct = Math.round((v / denom) * 100);
            return (
              <View key={k} style={st.splitItem}>
                <View style={[st.splitDot, { backgroundColor: SERIES[k].color }]} />
                <Text style={st.splitText}>{SERIES[k].label} {pct}%</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

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
  run?: RunState;
  replay?: FightReplayData;
  visible: boolean;
  onClose: () => void;
}

const fmtMult = (n: number) => (Number.isInteger(n) ? `${n}` : `${Math.round(n * 10) / 10}`);

/** What a log source is, in the words the rest of the game uses for it. */
const explainRef = (
  ref: string,
  weapons: ReturnType<typeof buildReplayWeapons>,
  weaponBuilds: FightReplayData['weaponBuilds']
): { name: string; text: string; kind: string; icon?: IconName } => {
  const [type, id] = [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)];
  if (type === 'weapon') {
    const w = weapons.find(x => x.id === id) ?? getArmoryWeapon(id, weaponBuilds);
    return { name: w?.name ?? id, text: w?.description ?? '', kind: 'weapon', icon: w?.icon };
  }
  if (type === 'evo') {
    const r = getRecipe(id);
    return { name: r?.name ?? id, text: r ? `${r.activeText} Live for 30 seconds once a Catalyst is matched (${r.familyText}).` : '', kind: 'evolution', icon: r?.icon };
  }
  if (type === 'node') {
    const n = getSkillNode(id);
    return { name: n?.name ?? id, text: n?.text ?? '', kind: 'fighter skill', icon: n?.icon };
  }
  if (type === 'arcana') {
    const a = ARCANA.find(x => x.id === id);
    return { name: a ? `${a.numeral} · ${a.name}` : id, text: a ? `${a.upside} Tradeoff: ${a.tradeoff}` : '', kind: 'arcana', icon: a?.icon };
  }
  return { name: '', text: '', kind: '' };
};

const FightReplay: React.FC<Props> = ({ run, replay, visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const data = useMemo(() => replay ?? (run ? fightReplayOf(run) : null), [replay, run]);
  const log = useMemo(() => data?.log ?? [], [data]);
  const heldWeapons = useMemo(
    () => (run ? run.weapons : data ? buildReplayWeapons(data.weapons, data.weaponBuilds, data.growth) : []),
    [run, data]
  );
  const scrollRef = useRef<ScrollView>(null);
  const inspectorY = useRef(0);
  const [copied, setCopied] = useState(false);

  const biggest = useMemo(() => log.reduce((best, e, i) => (e.damage > (log[best]?.damage ?? -1) ? i : best), log.length - 1), [log]);
  const [selected, setSelected] = useState(biggest);
  const [openLine, setOpenLine] = useState<number | null>(null);
  useEffect(() => {
    setSelected(biggest);
    setOpenLine(null);
    setCopied(false);
  }, [data, biggest]);

  const sel = Math.min(Math.max(0, selected), Math.max(0, log.length - 1));
  const entry = log[sel];

  const setNos = useMemo(() => {
    let n = 0;
    return log.map(e => (e.kind === 'set' ? ++n : n));
  }, [log]);

  const heldIds = useMemo(() => [...new Set(heldWeapons.map(w => w.id))], [heldWeapons]);
  const totals = useMemo(() => splitLogDamage(log), [log]);

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
      for (const l of describeLines(e.lines, heldIds)) {
        if (l.damage) add(l.source ?? l.label, e.kind === 'set' ? 'triggered' : 'clock', l.damage);
      }
    }
    return [...by.values()].sort((a, b) => b.damage - a.damage).slice(0, 8);
  }, [log, heldIds, totals.set]);

  // ─── Chart geometry ──────────────────────────────────────────────────────
  const contentW = Math.min(width, 760) - 32;
  const availPlotW = Math.max(120, contentW - PANEL_INSET - Y_AXIS_W);
  const durationS = Math.max(10, (log[log.length - 1]?.t ?? 0) / 1000 + 2);
  const fitPps = (availPlotW - 2 * PAD_X) / durationS;
  const pps = Math.max(fitPps, MIN_PX_PER_SEC);
  const x = (t: number) => PAD_X + (t / 1000) * pps;
  const xs = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < log.length; i++) {
      const raw = PAD_X + (log[i].t / 1000) * pps;
      out.push(i === 0 ? raw : Math.max(raw, out[i - 1] + 4));
    }
    return out;
  }, [log, pps]);
  const plotW = Math.max(availPlotW, 2 * PAD_X + durationS * pps, (xs[xs.length - 1] ?? 0) + PAD_X);

  const isPractice = !!data?.sandbox;
  const hasHp = !isPractice;
  const hasHearts = data !== null && data.maxHearts !== null && log.some(e => e.hearts !== null);
  const hpTop = PLOT_TOP + PLOT_H + MARK_H + AXIS_H + GAP_H;
  const heartsTop = hpTop + (hasHp ? HP_H + GAP_H : 0);
  const totalH = (hasHearts ? heartsTop + HEARTS_H : hasHp ? hpTop + HP_H : PLOT_TOP + PLOT_H + MARK_H + AXIS_H) + 6;

  const yMax = niceMax(Math.max(1, ...log.map(e => e.damage)));
  const yOf = (v: number) => PLOT_TOP + PLOT_H - (v / yMax) * PLOT_H;
  const heartsMax = Math.max(1, ...log.map(e => e.hearts ?? 0), data?.maxHearts ?? 0);
  const heartsY = (h: number) => heartsTop + (1 - Math.max(0, h) / heartsMax) * HEARTS_H;
  const tickStep = TICK_STEPS_S.find(s => s * pps >= 48) ?? 600;
  const ticks = Array.from({ length: Math.floor(durationS / tickStep) + 1 }, (_, i) => i * tickStep);
  const hpY = (ratio: number) => hpTop + (1 - Math.max(0, Math.min(1, ratio))) * HP_H;
  const hpPath = useMemo(() => {
    if (!hasHp) return '';
    let p = `M${x(0)},${hpY(1)}`;
    for (const e of log) p += `H${x(e.t)}V${hpY(e.foeMaxHp > 0 ? e.foeHp / e.foeMaxHp : 0)}`;
    return `${p}H${x(durationS * 1000)}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, pps, durationS, hasHp]);
  const heartsPath = useMemo(() => {
    if (!hasHearts) return '';
    let p = `M${x(0)},${heartsY(log[0]?.hearts ?? 0)}`;
    for (const e of log) p += `H${x(e.t)}V${heartsY(e.hearts ?? 0)}`;
    return `${p}H${x(durationS * 1000)}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, pps, durationS, hasHearts, heartsMax, heartsTop]);

  // Shading Surge and Evolution active bands across the plot clock
  const windows = useMemo(() => {
    const bands: { kind: 'surge' | 'evo'; from: number; to: number }[] = [];
    const endMs = Math.max((log[log.length - 1]?.t ?? 0) + 1000, durationS * 1000);
    let surgeFrom: number | null = null;
    let evoFrom: number | null = null;
    let evoDepth = 0;
    for (const e of log) {
      for (const l of e.lines) {
        if (l.type === 'surge_start' && surgeFrom === null) surgeFrom = e.t;
        if (l.type === 'surge_end' && surgeFrom !== null) {
          bands.push({ kind: 'surge', from: surgeFrom, to: e.t });
          surgeFrom = null;
        }
        if (l.type === 'evolution_start') {
          if (evoDepth === 0) evoFrom = e.t;
          evoDepth++;
        }
        if (l.type === 'evolution_end' && evoDepth > 0) {
          evoDepth--;
          if (evoDepth === 0 && evoFrom !== null) {
            bands.push({ kind: 'evo', from: evoFrom, to: e.t });
            evoFrom = null;
          }
        }
      }
    }
    if (surgeFrom !== null) bands.push({ kind: 'surge', from: surgeFrom, to: endMs });
    if (evoDepth > 0 && evoFrom !== null) bands.push({ kind: 'evo', from: evoFrom, to: endMs });
    return bands;
  }, [log, durationS]);

  const select = (i: number, scroll = false) => {
    setOpenLine(null);
    setSelected(i);
    if (scroll) scrollRef.current?.scrollTo({ y: Math.max(0, inspectorY.current - 8), animated: true });
  };

  // Your gear: every weapon held (once each), what it is and what it did, busiest first
  const stats = useMemo(() => gearStats(log, heldIds), [log, heldIds]);
  const gear = useMemo(
    () => heldIds
      .map(id => ({ id, weapon: heldWeapons.find(w => w.id === id)!, stat: stats[`weapon:${id}`] }))
      .sort((a, b) => (b.stat?.damage ?? 0) - (a.stat?.damage ?? 0) || (b.stat?.fired ?? 0) - (a.stat?.fired ?? 0)),
    [heldIds, heldWeapons, stats]
  );
  /** Evolutions, skill nodes, and equipped Arcana */
  const others = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    const refs: string[] = [];
    for (const ref of Object.keys(stats)) {
      if (!ref.startsWith('weapon:')) {
        seen.add(ref);
        refs.push(ref);
      }
    }
    for (const id of data.arcana ?? []) {
      const ref = `arcana:${id}`;
      if (!seen.has(ref)) {
        seen.add(ref);
        refs.push(ref);
      }
    }
    return refs
      .map(ref => ({ ref, stat: stats[ref], ...explainRef(ref, heldWeapons, data.weaponBuilds) }))
      .filter(o => o.name);
  }, [stats, data, heldWeapons]);
  const summary = useMemo(() => {
    if (!data) return '';
    const best = [...gear.map(g => ({ name: g.weapon.name, damage: g.stat?.damage ?? 0 })), ...others.map(o => ({ name: o.name, damage: o.stat?.damage ?? 0 }))]
      .sort((a, b) => b.damage - a.damage)[0];
    return fightSummary({ totalDamage: data.totalDamage, ms: data.elapsedMs, sets: data.matches, mistakes: data.mistakes, setDamage: totals.set, best });
  }, [gear, others, data, totals.set]);

  const copyJson = async () => {
    if (!data) return;
    const payload = {
      level: data.levelId, fighter: data.fighter, status: data.status, endReason: data.endReason,
      weapons: heldWeapons.map(w => w.name), skillNodes: data.skillNodes, arcana: data.arcana ?? [],
      totalDamage: data.totalDamage, log,
    };
    try {
      await Clipboard.setStringAsync(JSON.stringify(payload, null, 1));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable: nothing to do
    }
  };

  if (!data || !entry) return null;
  const selX = xs[sel] ?? x(entry.t);
  const lines = describeLines(entry.lines, heldIds);
  const s = split(entry);
  const belowParts: string[] = [];
  if (hasHp) belowParts.push("the foe's HP");
  if (hasHearts) belowParts.push('your hearts (red)');
  const windowNotes: string[] = [];
  if (windows.some(w => w.kind === 'surge')) windowNotes.push('Pink shading: Shading Surge (×5 cards)');
  if (windows.some(w => w.kind === 'evo')) windowNotes.push('Gold shading: active Evolution');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} testID="fight-replay">
      <View style={[st.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
        <View style={st.header}>
          <View style={{ flex: 1 }}>
            <Text style={st.eyebrow}>FIGHT REPLAY · {data.levelId}</Text>
            <Text style={st.title} numberOfLines={1}>What happened vs {data.foeName}</Text>
          </View>
          <TouchableOpacity testID="fight-replay-close" accessibilityRole="button" accessibilityLabel="Close replay" onPress={onClose} style={st.close}>
            <Icon name="lorc/cross-mark" size={18} color={INK} />
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={st.scroll}>
          <View style={[st.body, { width: contentW }]}>
            {/* In plain words first */}
            <View style={st.panel} testID="replay-summary">
              <Text style={st.panelTitle}>In short</Text>
              <Text style={st.summary}>{summary}</Text>
            </View>

            {/* Your gear: what each thing is, and what it did */}
            {(gear.length > 0 || others.length > 0) && (
              <View style={{ gap: 8 }} testID="replay-gear">
                <Text style={st.gearTitle}>YOUR GEAR THIS FIGHT <Text style={st.gearHint}>· tap one for how it works</Text></Text>
                {gear.map(g => (
                  <WeaponExplainer
                    key={g.id}
                    weapon={g.weapon}
                    build={data.weaponBuilds[g.id]}
                    growth={data.growth}
                    result={{
                      text: gearStatText(g.stat, data.totalDamage, weaponGuide(g.id).kind === 'always' ? 'always' : 'other'),
                      share: data.totalDamage > 0 ? (g.stat?.damage ?? 0) / data.totalDamage : 0,
                    }}
                  />
                ))}
                {others.map(o => (
                  <View key={o.ref} style={st.otherCard} testID={`replay-gear-${o.ref}`}>
                    <View style={st.otherHead}>
                      {o.icon && <Icon name={o.icon} size={22} color={INK} />}
                      <Text style={st.otherName} numberOfLines={1}>{o.name}</Text>
                      <Text style={st.otherKind}>{o.kind}</Text>
                    </View>
                    <Text style={st.otherText}>{o.text}</Text>
                    <Text style={st.otherStat}>
                      {o.kind === 'arcana' && (!o.stat || o.stat.fired === 0)
                        ? 'Active all fight.'
                        : gearStatText(o.stat, data.totalDamage, 'other')}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Totals double as the legend: each series' swatch, name and share */}
            <View style={st.tiles}>
              {(Object.keys(SERIES) as Series[]).map(k => (
                <View key={k} style={st.tile} testID={`replay-total-${k}`}>
                  <View style={st.tileHead}>
                    <View style={[st.swatch, { backgroundColor: SERIES[k].color }]} />
                    <Text style={st.tileLabel} numberOfLines={1}>{SERIES[k].label}</Text>
                  </View>
                  <Text style={st.tileValue}>{totals[k]}</Text>
                  <Text style={st.tileSub}>{data.totalDamage > 0 ? Math.round((totals[k] / data.totalDamage) * 100) : 0}% of damage</Text>
                </View>
              ))}
            </View>

            <View style={st.panel}>
              <Text style={st.panelTitle}>Damage per move</Text>
              <Text style={st.panelSub}>
                Each bar is one move: its Set hit, plus what the Set triggered (weapons, skills, evolutions) on top. Tap anywhere on the timeline to inspect that moment. ✕ mistake · ♥ heart lost · ★ level-up pick · ¢ shop buy · ? hint.
                {belowParts.length > 0 ? ` Below: ${belowParts.join(' and ')}.` : ''}
                {windowNotes.length > 0 ? ` ${windowNotes.join(' · ')}.` : ''}
              </Text>
              <View style={{ flexDirection: 'row' }}>
                <Svg width={Y_AXIS_W} height={totalH}>
                  {[0, yMax / 2, yMax].map(v => (
                    <SvgText key={v} x={Y_AXIS_W - 6} y={yOf(v) + 4} fontSize={10} fill={MUTED} textAnchor="end">{Number.isInteger(v) ? v : v.toFixed(1)}</SvgText>
                  ))}
                  {hasHp && (
                    <>
                      <SvgText x={Y_AXIS_W - 6} y={hpTop + 8} fontSize={10} fill={MUTED} textAnchor="end">Foe</SvgText>
                      <SvgText x={Y_AXIS_W - 6} y={hpTop + 20} fontSize={10} fill={MUTED} textAnchor="end">HP</SvgText>
                      <SvgText x={Y_AXIS_W - 6} y={hpTop + HP_H} fontSize={10} fill={MUTED} textAnchor="end">0</SvgText>
                    </>
                  )}
                  {hasHearts && <SvgText x={Y_AXIS_W - 6} y={heartsTop + 8} fontSize={10} fill={MUTED} textAnchor="end">{`${heartsMax}♥`}</SvgText>}
                  {hasHearts && <SvgText x={Y_AXIS_W - 6} y={heartsTop + HEARTS_H} fontSize={10} fill={MUTED} textAnchor="end">0</SvgText>}
                </Svg>
                <ScrollView horizontal showsHorizontalScrollIndicator={plotW > availPlotW} style={{ flex: 1 }}>
                  <Svg width={plotW} height={totalH} testID="replay-chart">
                    {/* Active surge / evolution windows */}
                    {windows.map((w, i) => {
                      const wx = x(w.from);
                      const ww = Math.max(2, x(w.to) - wx);
                      return (
                        <Rect
                          key={`win-${i}`}
                          x={wx}
                          y={PLOT_TOP}
                          width={ww}
                          height={PLOT_H}
                          fill={w.kind === 'surge' ? TONE.surgePale : TONE.coinPale}
                          opacity={0.7}
                        />
                      );
                    })}
                    {/* Recessive grid */}
                    {[0, yMax / 2, yMax].map(v => (
                      <Line key={v} x1={0} x2={plotW} y1={yOf(v)} y2={yOf(v)} stroke={v === 0 ? INK : GRID} strokeWidth={1} />
                    ))}
                    {hasHp && <Line x1={0} x2={plotW} y1={hpTop + HP_H} y2={hpTop + HP_H} stroke={GRID} />}
                    {hasHearts && <Line x1={0} x2={plotW} y1={heartsTop + HEARTS_H} y2={heartsTop + HEARTS_H} stroke={GRID} />}
                    {ticks.map(t => (
                      <SvgText key={t} x={x(t * 1000)} y={PLOT_TOP + PLOT_H + MARK_H + AXIS_H - 3} fontSize={10} fill={MUTED} textAnchor="middle">{fmtClock(t * 1000)}</SvgText>
                    ))}
                    {/* Waves */}
                    {log.map((e, i) => e.kind === 'wave' && e.wave > 0 ? (
                      <React.Fragment key={`w${i}`}>
                        <Line x1={xs[i]} x2={xs[i]} y1={0} y2={totalH} stroke={MUTED} strokeDasharray="3,3" />
                        <SvgText x={xs[i] + 3} y={10} fontSize={10} fontWeight="700" fill={MUTED}>{`Wave ${e.wave + 1}`}</SvgText>
                      </React.Fragment>
                    ) : null)}
                    {/* Selection guide */}
                    <Line x1={selX} x2={selX} y1={0} y2={totalH} stroke={INK} strokeWidth={1} opacity={0.5} />
                    {/* Bars: Set hit at the base, what it triggered stacked on top, 2px surface gap between */}
                    {log.map((e, i) => {
                      if (e.damage <= 0) return null;
                      const parts = split(e);
                      const bx = xs[i] - BAR_W / 2;
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
                        <SvgText key={`m${i}`} x={xs[i]} y={PLOT_TOP + PLOT_H + 13} fontSize={11} fontWeight="900" fill={m.color} textAnchor="middle" opacity={i === sel ? 1 : 0.8}>{m.glyph}</SvgText>
                      ) : null;
                    })}
                    {/* Foe HP, same clock */}
                    {hasHp && <Path d={hpPath} stroke={INK} strokeWidth={2} fill="none" />}
                    {hasHearts && <Path d={heartsPath} stroke={CRITICAL} strokeWidth={2} fill="none" />}
                    {/* Hit targets: every entry gets a non-zero strip centered on its monotonic plot coordinate */}
                    {log.map((_e, i) => {
                      const left = i === 0 ? 0 : (xs[i - 1] + xs[i]) / 2;
                      const right = i === log.length - 1 ? plotW : (xs[i] + xs[i + 1]) / 2;
                      return <Rect key={`h${i}`} testID={`replay-bar-${i}`} x={left} y={0} width={Math.max(2, right - left)} height={totalH} fill="transparent" onPress={() => select(i)} />;
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
                {(entry.set?.powerMultiplier ?? 1) > 1 && <Chip label="Power" value={`×${fmtMult(entry.set!.powerMultiplier!)}`} />}
                {entry.coins !== 0 && <Chip label="Coins" value={`${entry.coins > 0 ? '+' : ''}${entry.coins}`} />}
                {entry.xp > 0 && <Chip label="XP" value={`+${Math.round(entry.xp * 10) / 10}`} />}
                {entry.heartsDelta !== 0 && <Chip label="Hearts" value={`${entry.heartsDelta > 0 ? '+' : ''}${entry.heartsDelta}`} bad={entry.heartsDelta < 0} />}
                {!isPractice && <Chip label="Foe HP after" value={`${entry.foeHp}/${entry.foeMaxHp}`} />}
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
                  lines.map((l, i) => {
                    const about = l.sourceRef ? explainRef(l.sourceRef, heldWeapons, data.weaponBuilds) : null;
                    const from = l.source ?? about?.name;
                    const isOpen = openLine === i && !!about?.text;
                    return (
                      <TouchableOpacity
                        key={i}
                        testID={`replay-line-${i}`}
                        disabled={!about?.text}
                        onPress={() => setOpenLine(isOpen ? null : i)}
                        activeOpacity={0.8}
                        accessibilityRole={about?.text ? 'button' : undefined}
                        accessibilityState={about?.text ? { expanded: isOpen } : undefined}
                        style={st.lineBlock}
                      >
                        <View style={st.row}>
                          <View style={{ flex: 1 }}>
                            <Text style={st.rowLabel}>{l.label}{l.count > 1 ? ` ×${l.count}` : ''}</Text>
                            {from && <Text style={st.source}>from {from}{about?.text ? (isOpen ? '  ▲' : '  ▼ what is that?') : ''}</Text>}
                          </View>
                          {l.damage !== undefined && <Text style={st.rowValue}>{l.damage} dmg</Text>}
                        </View>
                        {isOpen && about && (
                          <View style={st.about} testID={`replay-line-about-${i}`}>
                            {about.icon && <Icon name={about.icon} size={18} color={INK} />}
                            <Text style={st.aboutText}><Text style={st.bold}>{about.name} ({about.kind}): </Text>{about.text}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
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
              {log.map((e, i) => {
                const moveSummary = entrySummary(e, heldIds);
                return (
                  <TouchableOpacity key={i} testID={`replay-row-${i}`} onPress={() => select(i, true)} style={[st.listRow, i === sel && { backgroundColor: TONE.selected }]}>
                    <Text style={st.listTime}>{fmtClock(e.t)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.listTitle, e.kind === 'mistake' && { color: CRITICAL }]} numberOfLines={1}>{entryTitle(e, setNos[i])}</Text>
                      {!!moveSummary && <Text style={st.source} numberOfLines={1}>{moveSummary}</Text>}
                    </View>
                    <Text style={st.listDmg}>{e.damage > 0 ? e.damage : '–'}</Text>
                  </TouchableOpacity>
                );
              })}
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
  summary: { fontSize: 15, lineHeight: 22, color: INK },
  gearTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 2, color: INK },
  gearHint: { fontSize: 11, fontWeight: '600', letterSpacing: 0, opacity: 0.7 },
  otherCard: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 2, borderColor: INK, padding: 12, gap: 6 },
  otherHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  otherName: { flex: 1, fontSize: 15, fontWeight: '900', color: INK },
  otherKind: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, color: INK, opacity: 0.6, textTransform: 'uppercase' },
  otherText: { fontSize: 14, lineHeight: 20, color: INK },
  otherStat: { fontSize: 13, fontWeight: '700', color: INK, opacity: 0.8 },
  lineBlock: { gap: 4 },
  about: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.paperBeige, borderRadius: 8, padding: 8, marginBottom: 4 },
  aboutText: { flex: 1, fontSize: 13, lineHeight: 19, color: INK },
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
  splitTrack: { flexDirection: 'row', borderRadius: 5, overflow: 'hidden', backgroundColor: '#EAE5DD' },
  splitLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  splitItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  splitDot: { width: 8, height: 8, borderRadius: 2 },
  splitText: { fontSize: 11, fontWeight: '700', color: MUTED },
});

export default FightReplay;
