/**
 * Fight replay: the "what just happened" timeline & move-by-move receipt.
 *
 * - Plain-English summary + per-weapon Evolution triggers + clickable series totals.
 * - Move-column damage chart directly above the Move Inspector so players
 *   immediately see every move's damage, move label, and timestamp.
 * - Tapping any card, outcome chip, math row, or triggered effect opens an
 *   inline plain-English explanation.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import Svg, { Rect, Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '@/components/Card';
import Icon, { type IconName } from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import { sfx } from '@/audio';
import type { Card as CardType } from '@/types';
import type { AdventureSave, FightLogCard, FightLogEntry, PassiveId, RunState } from '../types';
import { Btn, INK, TONE } from './ui';
import { ARCANA } from '../data/arcana';
import { getArmoryWeapon } from '../data/armory';
import { getWeaponEvolution } from '../data/evolutions';
import { LEVELS, PRACTICE_LEVELS } from '../data/levels';
import { getPassive, PASSIVES } from '../data/passives';
import { weaponGuide } from '../data/weaponGuide';
import { replayMoveSnapshot, synthesizeHighlightSnapshot, type FightRecording } from '../engine/replay';
import { getSkillNode } from '../engine/sources';
import { buildReplayWeapons, fightReplayOf, type FightReplayData } from '../history';
import HighlightStageModal from './HighlightStageModal';
import {
  describeLines,
  entrySummary,
  entryTitle,
  explainLogCard,
  fightSummary,
  fmtClock,
  gearStats,
  gearStatText,
  loggedCardPoints,
  setMathRows,
} from './fightReplayText';
import DamageSourceExplainer from './DamageSourceExplainer';
import WeaponExplainer from './WeaponExplainer';
import { beltSynergyAttrSet } from '../ui/synergyMeta';

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

const PLOT_TOP = 18;
const PLOT_H = 132;
const AXIS_H = 30;
const GAP_H = 12;
const HP_H = 50;
const HEARTS_H = 36;
const TRACK_PAD_Y = 5;
const Y_AXIS_W = 36;
const PANEL_INSET = 27;
const PAD_X = 6;
const MIN_SLOT_W = 48;

const SERIES_HELP: Record<Series, string> = {
  set: 'Damage dealt directly when you matched 3 cards—card points, Synergy hooks, and flat bonuses × Set multipliers.',
  triggered: 'Bonus blasts, lasers, ricochets, and bursts triggered immediately after a Set.',
  clock: 'Ongoing burn ticks, timed hazards, or clock events between moves.',
};

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

const shortMoveLabel = (e: FightLogEntry, setNo: number): string => {
  switch (e.kind) {
    case 'wave': return e.wave === 0 ? 'Start' : `W${e.wave + 1}`;
    case 'set': return `S${setNo}`;
    case 'mistake': return 'Miss';
    case 'pick': return 'Pick';
    case 'buy': return 'Shop';
    case 'hint': return 'Hint';
    case 'burn': return 'Burn';
    case 'time': return 'Clock';
  }
};

const MARK: Partial<Record<FightLogEntry['kind'], { glyph?: string; vector?: 'burn' | 'time'; color: string }>> = {
  mistake: { glyph: '✕', color: CRITICAL },
  pick: { glyph: '★', color: INK },
  buy: { glyph: '¢', color: INK },
  hint: { glyph: '?', color: MUTED },
  burn: { vector: 'burn', color: CRITICAL },
  time: { vector: 'time', color: MUTED },
};

const toCard = (c: FightLogCard, i: number): CardType => ({
  id: `replay-${i}`, shape: c.shape, color: c.color, number: c.number, shading: c.shading, background: c.background, selected: false,
});

interface Props {
  run?: RunState;
  replay?: FightReplayData;
  /** Optional deterministic action tape & save for exact board reconstruction in Highlight Replay ([TP-13]) */
  recording?: FightRecording;
  save?: AdventureSave;
  visible: boolean;
  onClose: () => void;
}

/** What a log source is, in the words the rest of the game uses for it. */
const explainRef = (
  ref: string,
  weapons: ReturnType<typeof buildReplayWeapons>,
  weaponBuilds: FightReplayData['weaponBuilds']
): { name: string; text: string; kind: string; icon?: IconName } => {
  const colon = ref.indexOf(':');
  if (colon < 0) return { name: '', text: '', kind: '' };
  const type = ref.slice(0, colon);
  const id = ref.slice(colon + 1);
  if (type === 'weapon') {
    const w = weapons.find(x => x.id === id) ?? getArmoryWeapon(id, weaponBuilds);
    return { name: w?.name ?? id, text: w?.description ?? '', kind: 'weapon', icon: w?.icon };
  }
  if (type === 'evo') {
    const evo = getWeaponEvolution(id);
    if (evo) {
      const parent = weapons.find(x => x.id === evo.weaponId) ?? getArmoryWeapon(evo.weaponId, weaponBuilds);
      const sec = Math.round(evo.durationMs / 1000);
      return {
        name: parent ? `${parent.name} → ${evo.name}` : evo.name,
        text: `${evo.tagline} (${sec}s active · Trigger: ${evo.conditionText})`,
        kind: 'evolution',
        icon: evo.icon,
      };
    }
    return { name: id, text: 'Weapon Evolution active during this fight.', kind: 'evolution', icon: 'lorc/crystal-shine' };
  }
  if (type === 'node') {
    const n = getSkillNode(id);
    return { name: n?.name ?? id, text: n?.text ?? '', kind: 'fighter skill', icon: n?.icon };
  }
  if (type === 'arcana') {
    const a = ARCANA.find(x => x.id === id);
    return { name: a ? `${a.numeral} · ${a.name}` : id, text: a ? `${a.upside} Tradeoff: ${a.tradeoff}` : '', kind: 'arcana', icon: a?.icon };
  }
  if (type === 'passive') {
    const p = PASSIVES[id as PassiveId];
    return { name: p?.name ?? id, text: p?.text ?? '', kind: 'passive', icon: p?.icon };
  }
  return { name: '', text: '', kind: '' };
};

type ChipKind = 'damage' | 'set' | 'triggered' | 'coins' | 'xp' | 'hearts' | 'foeHp';

const FightReplay: React.FC<Props> = ({ run, replay, recording, save, visible, onClose }) => {
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
  const [openCard, setOpenCard] = useState<number | null>(null);
  const [openMath, setOpenMath] = useState<number | null>(null);
  const [openChip, setOpenChip] = useState<ChipKind | null>(null);
  const [openSeries, setOpenSeries] = useState<Series | null>(null);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);

  const highlightSnapshot = useMemo(() => {
    if (highlightIndex === null || !data) return null;
    if (recording && save) {
      const level = [...LEVELS, ...PRACTICE_LEVELS].find(l => l.id === data.levelId);
      if (level) {
        const exact = replayMoveSnapshot(level, save, recording, highlightIndex);
        if (exact) return exact;
      }
    }
    return synthesizeHighlightSnapshot(data, highlightIndex, heldWeapons, run?.foeIcon);
  }, [highlightIndex, data, recording, save, heldWeapons, run?.foeIcon]);

  useEffect(() => {
    setSelected(biggest);
    setOpenLine(null);
    setOpenCard(null);
    setOpenMath(null);
    setOpenChip(null);
    setOpenSeries(null);
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

  // ─── Move-column Chart geometry ───────────────────────────────────────────
  const contentW = Math.min(width, 760) - 32;
  const availPlotW = Math.max(160, contentW - PANEL_INSET - Y_AXIS_W);
  const slotW = log.length > 0 ? Math.max(MIN_SLOT_W, availPlotW / log.length) : MIN_SLOT_W;
  const barW = Math.min(34, Math.max(16, slotW * 0.56));
  const plotW = Math.max(availPlotW, 2 * PAD_X + log.length * slotW);
  const xs = useMemo(() => log.map((_e, i) => PAD_X + (i + 0.5) * slotW), [log, slotW]);

  const isPractice = !!data?.sandbox;
  const hasHp = !isPractice && log.some(e => e.foeMaxHp > 0);
  // Hide flat hearts track when hearts never changed during the fight (keeps chart clean on no-damage runs & Dummy)
  const hasHearts = data !== null && data.maxHearts !== null && data.maxHearts > 0 && log.some(e => e.heartsDelta !== 0);

  const baselineY = PLOT_TOP + PLOT_H;
  const hpTop = baselineY + AXIS_H + GAP_H;
  const heartsTop = hpTop + (hasHp ? HP_H + GAP_H : 0);
  const totalH = (hasHearts ? heartsTop + HEARTS_H : hasHp ? hpTop + HP_H : baselineY + AXIS_H) + 6;

  const yMax = niceMax(Math.max(1, ...log.map(e => e.damage)));
  const yOf = (v: number) => baselineY - (v / yMax) * PLOT_H;
  const hpInnerH = HP_H - TRACK_PAD_Y * 2;
  const hpY = (ratio: number) => hpTop + TRACK_PAD_Y + (1 - Math.max(0, Math.min(1, ratio))) * hpInnerH;
  const heartsMax = Math.max(1, ...log.map(e => e.hearts ?? 0), data?.maxHearts ?? 0);
  const heartsInnerH = HEARTS_H - TRACK_PAD_Y * 2;
  const heartsY = (h: number) => heartsTop + TRACK_PAD_Y + (1 - Math.max(0, h) / heartsMax) * heartsInnerH;

  const hpPath = useMemo(() => {
    if (!hasHp || log.length === 0) return '';
    let p = `M${xs[0]},${hpY(log[0].foeMaxHp > 0 ? log[0].foeHp / log[0].foeMaxHp : 1)}`;
    for (let i = 1; i < log.length; i++) {
      const ratio = log[i].foeMaxHp > 0 ? log[i].foeHp / log[i].foeMaxHp : 0;
      p += `H${xs[i]}V${hpY(ratio)}`;
    }
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, xs, hasHp, hpTop]);

  const heartsPath = useMemo(() => {
    if (!hasHearts || log.length === 0) return '';
    let p = `M${xs[0]},${heartsY(log[0]?.hearts ?? 0)}`;
    for (let i = 1; i < log.length; i++) {
      p += `H${xs[i]}V${heartsY(log[i]?.hearts ?? 0)}`;
    }
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, xs, hasHearts, heartsMax, heartsTop]);

  // Shading Surge and Evolution active columns
  const columnBand = useMemo(() => {
    let inSurge = false;
    let evoDepth = 0;
    return log.map(e => {
      for (const l of e.lines) {
        if (l.type === 'surge_start') inSurge = true;
        if (l.type === 'surge_end') inSurge = false;
        if (l.type === 'evolution_start') evoDepth++;
        if (l.type === 'evolution_end' && evoDepth > 0) evoDepth--;
      }
      return { surge: inSurge || (e.set?.surgeMultiplier ?? 1) > 1, evo: evoDepth > 0 };
    });
  }, [log]);

  const select = (i: number, scroll = false) => {
    sfx('click');
    setOpenLine(null);
    setOpenCard(null);
    setOpenMath(null);
    setOpenChip(null);
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
    const passiveIds = new Set<string>(data.passives ?? []);
    const refs: string[] = [];
    for (const ref of Object.keys(stats)) {
      if (ref.startsWith('weapon:')) continue;
      if (ref.startsWith('passive:') && passiveIds.has(ref.slice(8))) continue;
      seen.add(ref);
      refs.push(ref);
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
  const passivesList = useMemo(
    () => (data?.passives ?? []).map(id => getPassive(id)),
    [data?.passives]
  );

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
      equippedEvolutions: data.equippedEvolutions ?? {},
      evosTriggered: data.evosTriggered ?? 0,
      peakBaseDamage: data.peakBaseDamage ?? 0,
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

  /** Timeline markers for every per-weapon Evolution ignited across the fight. */
  const evolutionTimeline = useMemo(() => {
    const out: { moveIndex: number; label: string; durationSec?: number }[] = [];
    log.forEach((e, idx) => {
      for (const l of e.lines) {
        if (l.type !== 'evolution_start') continue;
        const evoId = l.sourceRef?.startsWith('evo:') ? l.sourceRef.slice(4) : undefined;
        const evoDef = evoId ? getWeaponEvolution(evoId) : undefined;
        const parentW = evoDef ? (heldWeapons.find(w => w.id === evoDef.weaponId) ?? getArmoryWeapon(evoDef.weaponId)) : undefined;
        const evoName = evoDef?.name ?? l.text ?? 'Evolution';
        const label = parentW ? `${parentW.name} → ${evoName}` : evoName;
        out.push({
          moveIndex: idx,
          label,
          durationSec: evoDef ? Math.round(evoDef.durationMs / 1000) : undefined,
        });
      }
    });
    return out;
  }, [log, heldWeapons]);

  if (!data || !entry) return null;
  const lines = describeLines(
    entry.lines,
    heldIds,
    entry.kind === 'set' ? { excludeSetMathRules: true } : undefined
  );
  const s = split(entry);
  const mathRows = entry.set ? setMathRows(entry.set, { lines: entry.lines, cards: entry.cards, held: heldIds }) : [];
  const moveEvoStarts = evolutionTimeline.filter(item => item.moveIndex === sel);

  const chipHelp = (chip: ChipKind): React.ReactNode => {
    switch (chip) {
      case 'damage':
        return <Text style={st.explainText}>Total damage dealt to {data.foeName} during this move (Set hit + any triggered blasts/effects).</Text>;
      case 'set':
        return <Text style={st.explainText}>Damage from this Set itself before extra triggered blasts—itemized step by step below in HOW THE SET HIT.</Text>;
      case 'triggered':
        return <Text style={st.explainText}>Extra damage from weapons, skills, or evolutions that fired right after you matched this Set.</Text>;
      case 'coins':
        return <Text style={st.explainText}>Coins banked on this move from matching cards, Gold cards (+¢), or weapon effects.</Text>;
      case 'xp':
        return <Text style={st.explainText}>Experience earned on this move toward your next in-fight level-up weapon pick.</Text>;
      case 'hearts':
        return <Text style={st.explainText}>{entry.heartsDelta > 0 ? `Healed ${entry.heartsDelta} heart${entry.heartsDelta === 1 ? '' : 's'} on this move.` : `Lost ${Math.abs(entry.heartsDelta)} heart${entry.heartsDelta === -1 ? '' : 's'} on this move.`}</Text>;
      case 'foeHp':
        return <Text style={st.explainText}>Remaining foe HP right after this move ({entry.foeHp} out of {entry.foeMaxHp}).</Text>;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} testID="fight-replay">
      <View style={[st.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
        <View style={st.header}>
          <View style={{ flex: 1 }}>
            <Text style={st.eyebrow}>FIGHT REPLAY · {data.sandbox ? 'PRACTICE' : data.levelId}</Text>
            <Text style={st.title} numberOfLines={1}>What happened vs {data.foeName}</Text>
          </View>
          <TouchableOpacity testID="fight-replay-close" accessibilityRole="button" accessibilityLabel="Close replay" onPress={onClose} style={st.close}>
            <Icon name="lorc/cross-mark" size={18} color={INK} />
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={st.scroll}>
          <View style={[st.body, { width: contentW }]}>
            {/* 1. In plain words + clickable Power banner */}
            <View style={st.panel} testID="replay-summary">
              <Text style={st.panelTitle}>In short</Text>
              <Text style={st.summary}>{summary}</Text>
              <DamageSplitBar totals={totals} totalDamage={data.totalDamage} />

              <View style={st.tiles}>
                {(Object.keys(SERIES) as Series[]).map(k => {
                  const active = openSeries === k;
                  return (
                    <TouchableOpacity
                      key={k}
                      testID={`replay-total-${k}`}
                      activeOpacity={0.78}
                      accessibilityRole="button"
                      onPress={() => { sfx('click'); setOpenSeries(active ? null : k); }}
                      style={[st.tile, active && { backgroundColor: TONE.selected }]}
                    >
                      <View style={st.tileHead}>
                        <View style={[st.swatch, { backgroundColor: SERIES[k].color }]} />
                        <Text style={st.tileLabel} numberOfLines={1}>{SERIES[k].label}</Text>
                      </View>
                      <Text style={st.tileValue}>{totals[k]}</Text>
                      <Text style={st.tileSub}>{data.totalDamage > 0 ? Math.round((totals[k] / data.totalDamage) * 100) : 0}% · tap ?</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {openSeries && (
                <View style={st.explainBox}>
                  <Text style={st.explainText}><Text style={st.bold}>{SERIES[openSeries].label}: </Text>{SERIES_HELP[openSeries]}</Text>
                </View>
              )}

              {log[biggest] && log[biggest].damage > 0 && (
                <TouchableOpacity
                  testID="replay-watch-biggest"
                  onPress={() => {
                    sfx('confirm');
                    setHighlightIndex(biggest);
                  }}
                  style={st.highlightPill}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Watch biggest hit highlight (${log[biggest].damage} damage) in 0.5x slow motion`}
                >
                  <Icon name="lorc/bright-explosion" size={16} color={INK} />
                  <Text style={st.highlightPillText} numberOfLines={1}>
                    Watch Highlight (0.5×) · Biggest Hit {log[biggest].damage} dmg
                  </Text>
                </TouchableOpacity>
              )}

              {evolutionTimeline.length > 0 && (
                <View style={st.evoTimelineWrap} testID="replay-evos-triggered">
                  <Text style={st.evoTimelineHead}>EVOLUTIONS TRIGGERED</Text>
                  <View style={st.evoChipRow}>
                    {evolutionTimeline.map((item, idx) => (
                      <TouchableOpacity
                        key={`${item.moveIndex}-${idx}`}
                        testID={`replay-evo-chip-${idx}`}
                        onPress={() => select(item.moveIndex, true)}
                        activeOpacity={0.8}
                        style={st.evoChip}
                        accessibilityRole="button"
                      >
                        <Icon name="lorc/crystal-shine" size={12} color="#7C3AED" />
                        <Text style={st.evoChipText} numberOfLines={1}>
                          {item.label}{item.durationSec ? ` (${item.durationSec}s)` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* 2. Damage per move timeline directly above Move Inspector */}
            <View style={st.panel}>
              <View style={st.chartHead}>
                <Text style={st.panelTitle}>Damage per move</Text>
                <Text style={st.chartHint}>Tap any bar to inspect</Text>
              </View>
              <View style={st.chartLegend}>
                {(Object.keys(SERIES) as Series[]).map(k => (
                  <View key={k} style={st.splitItem}>
                    <View style={[st.splitDot, { backgroundColor: SERIES[k].color }]} />
                    <Text style={st.splitText}>{SERIES[k].label}</Text>
                  </View>
                ))}
                {hasHp && (
                  <View style={st.splitItem}>
                    <View style={[st.lineDot, { backgroundColor: INK }]} />
                    <Text style={st.splitText}>Foe HP</Text>
                  </View>
                )}
                {hasHearts && (
                  <View style={st.splitItem}>
                    <View style={[st.lineDot, { backgroundColor: CRITICAL }]} />
                    <Text style={st.splitText}>Hearts</Text>
                  </View>
                )}
              </View>

              <View style={{ flexDirection: 'row' }}>
                <Svg width={Y_AXIS_W} height={totalH}>
                  {[0, yMax / 2, yMax].map(v => (
                    <SvgText key={v} x={Y_AXIS_W - 6} y={yOf(v) + 4} fontSize={10} fill={MUTED} textAnchor="end">{Number.isInteger(v) ? v : v.toFixed(1)}</SvgText>
                  ))}
                  {hasHp && (
                    <>
                      <SvgText x={Y_AXIS_W - 6} y={hpTop + 12} fontSize={9} fontWeight="700" fill={MUTED} textAnchor="end">Foe HP</SvgText>
                      <SvgText x={Y_AXIS_W - 6} y={hpTop + HP_H - 3} fontSize={9} fill={MUTED} textAnchor="end">0</SvgText>
                    </>
                  )}
                  {hasHearts && (
                    <>
                      <SvgText x={Y_AXIS_W - 6} y={heartsTop + 12} fontSize={9} fontWeight="700" fill={CRITICAL} textAnchor="end">{`${heartsMax}♥`}</SvgText>
                      <SvgText x={Y_AXIS_W - 6} y={heartsTop + HEARTS_H - 3} fontSize={9} fill={MUTED} textAnchor="end">0</SvgText>
                    </>
                  )}
                </Svg>

                <ScrollView horizontal showsHorizontalScrollIndicator={plotW > availPlotW} style={{ flex: 1 }}>
                  <Svg width={plotW} height={totalH} testID="replay-chart">
                    {/* Active Surge / Evolution column tints */}
                    {columnBand.map((b, i) => {
                      if (!b.surge && !b.evo) return null;
                      return (
                        <Rect
                          key={`band-${i}`}
                          x={xs[i] - slotW / 2 + 2}
                          y={PLOT_TOP}
                          width={Math.max(4, slotW - 4)}
                          height={PLOT_H}
                          fill={b.surge ? TONE.surgePale : TONE.coinPale}
                          opacity={0.75}
                        />
                      );
                    })}

                    {/* Selected move highlight */}
                    <Rect
                      x={xs[sel] - slotW / 2 + 2}
                      y={2}
                      width={Math.max(8, slotW - 4)}
                      height={baselineY + AXIS_H - 2}
                      rx={6}
                      fill={TONE.selected}
                      stroke={INK}
                      strokeWidth={1.5}
                    />

                    {/* Grid lines */}
                    {[0, yMax / 2, yMax].map(v => (
                      <Line key={v} x1={0} x2={plotW} y1={yOf(v)} y2={yOf(v)} stroke={v === 0 ? INK : GRID} strokeWidth={v === 0 ? 1.5 : 1} />
                    ))}
                    {hasHp && <Line x1={0} x2={plotW} y1={hpTop + HP_H} y2={hpTop + HP_H} stroke={GRID} />}
                    {hasHearts && <Line x1={0} x2={plotW} y1={heartsTop + HEARTS_H} y2={heartsTop + HEARTS_H} stroke={GRID} />}

                    {/* Stacked move bars + total damage value above each non-zero bar */}
                    {log.map((e, i) => {
                      const cx = xs[i];
                      const dim = i === sel ? 1 : 0.72;
                      if (e.damage <= 0) {
                        const m = MARK[e.kind] ?? (e.heartsDelta < 0 ? { glyph: '♥', color: CRITICAL } : { glyph: '·', color: MUTED });
                        if (m.vector === 'burn') {
                          const my = baselineY - 13;
                          return (
                            <Path
                              key={`mk-${i}`}
                              d={`M ${cx} ${my - 5} C ${cx + 4} ${my - 1}, ${cx + 4} ${my + 4}, ${cx} ${my + 5} C ${cx - 4} ${my + 4}, ${cx - 4} ${my - 1}, ${cx} ${my - 5} Z`}
                              fill={m.color}
                              opacity={dim}
                            />
                          );
                        }
                        if (m.vector === 'time') {
                          const my = baselineY - 12;
                          return (
                            <React.Fragment key={`mk-${i}`}>
                              <Circle cx={cx} cy={my} r={4.2} stroke={m.color} strokeWidth={1.5} fill="none" opacity={dim} />
                              <Path d={`M ${cx} ${my - 2.4} L ${cx} ${my} L ${cx + 2} ${my + 1.2}`} stroke={m.color} strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={dim} />
                            </React.Fragment>
                          );
                        }
                        return (
                          <SvgText
                            key={`mk-${i}`}
                            x={cx}
                            y={baselineY - 8}
                            fontSize={12}
                            fontWeight="900"
                            fill={m.color}
                            textAnchor="middle"
                            opacity={dim}
                          >
                            {m.glyph}
                          </SvgText>
                        );
                      }
                      const parts = split(e);
                      const bx = cx - barW / 2;
                      const order: Series[] = ['set', 'triggered', 'clock'];
                      const shown = order.filter(k => parts[k] > 0);
                      let base = 0;
                      const topY = yOf(e.damage);
                      return (
                        <React.Fragment key={`col-${i}`}>
                          {shown.map((k, j) => {
                            const y0 = yOf(base);
                            const y1 = yOf(base + parts[k]);
                            base += parts[k];
                            const gap = j > 0 ? 1.5 : 0;
                            return (
                              <Path
                                key={`${i}${k}`}
                                d={barPath(bx, y1, barW, Math.max(2, y0 - y1 - gap), j === shown.length - 1)}
                                fill={SERIES[k].color}
                                opacity={dim}
                              />
                            );
                          })}
                          <SvgText
                            x={cx}
                            y={Math.max(11, topY - 4)}
                            fontSize={11}
                            fontWeight="900"
                            fill={INK}
                            textAnchor="middle"
                          >
                            {e.damage}
                          </SvgText>
                        </React.Fragment>
                      );
                    })}

                    {/* Move label + clock under each column */}
                    {log.map((e, i) => (
                      <React.Fragment key={`ax-${i}`}>
                        <SvgText
                          x={xs[i]}
                          y={baselineY + 13}
                          fontSize={10}
                          fontWeight={i === sel ? '900' : '700'}
                          fill={e.kind === 'mistake' ? CRITICAL : INK}
                          textAnchor="middle"
                        >
                          {shortMoveLabel(e, setNos[i])}
                        </SvgText>
                        <SvgText x={xs[i]} y={baselineY + 25} fontSize={9} fill={MUTED} textAnchor="middle">
                          {fmtClock(e.t)}
                        </SvgText>
                      </React.Fragment>
                    ))}

                    {/* Foe HP track */}
                    {hasHp && (
                      <>
                        <Path d={hpPath} stroke={INK} strokeWidth={2} fill="none" />
                        {log.map((e, i) => (
                          <Circle
                            key={`hp-${i}`}
                            cx={xs[i]}
                            cy={hpY(e.foeMaxHp > 0 ? e.foeHp / e.foeMaxHp : 0)}
                            r={i === sel ? 3.5 : 2}
                            fill={i === sel ? COLORS.actionYellow : INK}
                            stroke={INK}
                            strokeWidth={1}
                          />
                        ))}
                      </>
                    )}

                    {/* Hearts track (only when hearts actually changed) */}
                    {hasHearts && (
                      <>
                        <Path d={heartsPath} stroke={CRITICAL} strokeWidth={2} fill="none" />
                        {log.map((e, i) => (
                          <Circle
                            key={`ht-${i}`}
                            cx={xs[i]}
                            cy={heartsY(e.hearts ?? 0)}
                            r={i === sel ? 3.5 : 2}
                            fill={CRITICAL}
                          />
                        ))}
                      </>
                    )}

                    {/* Full-column hit targets */}
                    {log.map((_e, i) => (
                      <Rect
                        key={`h${i}`}
                        testID={`replay-bar-${i}`}
                        x={xs[i] - slotW / 2}
                        y={0}
                        width={slotW}
                        height={totalH}
                        fill="transparent"
                        onPress={() => select(i)}
                      />
                    ))}
                  </Svg>
                </ScrollView>
              </View>
            </View>

            {/* 3. Interactive Move Inspector */}
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

              {/* [TP-13] Slow-motion visual highlight shortcut on any inspected Set / damage move */}
              {(entry.kind === 'set' || entry.damage > 0) && (
                <TouchableOpacity
                  testID="replay-watch-selected"
                  onPress={() => {
                    sfx('confirm');
                    setHighlightIndex(sel);
                  }}
                  style={st.highlightPillSmall}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Watch this move highlight in 0.5x slow motion"
                >
                  <Icon name="lorc/bright-explosion" size={14} color={INK} />
                  <Text style={st.highlightPillSmallText}>Watch Highlight (0.5×)</Text>
                </TouchableOpacity>
              )}

              {/* Clickable matched cards with per-card damage & tags */}
              {entry.cards && (
                <View style={{ gap: 6 }}>
                  <View style={st.cards}>
                    {entry.cards.map((c, i) => {
                      const cardPts = loggedCardPoints(c);
                      const isCardOpen = openCard === i;
                      return (
                        <TouchableOpacity
                          key={i}
                          testID={`replay-card-${i}`}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          onPress={() => { sfx('click'); setOpenCard(isCardOpen ? null : i); }}
                          style={[st.cardPick, isCardOpen && st.cardPickActive]}
                        >
                          <View style={st.cardSlot}><Card card={toCard(c, i)} onClick={() => {}} disabled isPaused /></View>
                          {entry.kind === 'set' && (
                            <Text style={[st.cardDmg, cardPts > 1 && st.cardDmgHot]}>{cardPts} dmg</Text>
                          )}
                          {c.tags.map(tag => (
                            <View key={tag} style={st.cardTagPill}>
                              <Text style={st.cardTag}>{tag}</Text>
                            </View>
                          ))}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={st.tapHint}>
                    {openCard !== null ? 'Tap card again to hide details' : 'Tap any card to see why it scored that damage'}
                  </Text>
                  {openCard !== null && entry.cards[openCard] && (() => {
                    const info = explainLogCard(entry.cards[openCard]);
                    return (
                      <View style={st.explainBox} testID={`replay-card-detail-${openCard}`}>
                        <Text style={st.explainTitle}>{info.title} · {info.points} dmg</Text>
                        <Text style={st.explainText}>{info.summary}</Text>
                        {info.notes.map((n, ni) => (
                          <Text key={ni} style={st.explainBullet}>• {n}</Text>
                        ))}
                      </View>
                    );
                  })()}
                </View>
              )}

              {moveEvoStarts.length > 0 && (
                <View style={st.evoChipRow} testID="replay-move-evos">
                  {moveEvoStarts.map((item, idx) => (
                    <View key={idx} style={st.evoChip}>
                      <Icon name="lorc/crystal-shine" size={12} color="#7C3AED" />
                      <Text style={st.evoChipText} numberOfLines={1}>
                        Evolution Triggered: {item.label}{item.durationSec ? ` (${item.durationSec}s)` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Clickable outcome chips (replaces ambiguous "Set / triggered") */}
              <View style={st.chips}>
                <Chip
                  label="Total damage"
                  value={`${entry.damage}`}
                  active={openChip === 'damage'}
                  onPress={() => { sfx('click'); setOpenChip(openChip === 'damage' ? null : 'damage'); }}
                />
                {entry.kind === 'set' && (
                  <Chip
                    label="Set hit"
                    value={`${s.set}`}
                    active={openChip === 'set'}
                    onPress={() => { sfx('click'); setOpenChip(openChip === 'set' ? null : 'set'); }}
                  />
                )}
                {entry.kind === 'set' && s.triggered > 0 && (
                  <Chip
                    label="Extra triggers"
                    value={`+${s.triggered}`}
                    active={openChip === 'triggered'}
                    onPress={() => { sfx('click'); setOpenChip(openChip === 'triggered' ? null : 'triggered'); }}
                  />
                )}
                {entry.coins !== 0 && (
                  <Chip
                    label="Coins"
                    value={`${entry.coins > 0 ? '+' : ''}${entry.coins}¢`}
                    active={openChip === 'coins'}
                    onPress={() => { sfx('click'); setOpenChip(openChip === 'coins' ? null : 'coins'); }}
                  />
                )}
                {entry.xp > 0 && (
                  <Chip
                    label="XP"
                    value={`+${Math.round(entry.xp * 10) / 10}`}
                    active={openChip === 'xp'}
                    onPress={() => { sfx('click'); setOpenChip(openChip === 'xp' ? null : 'xp'); }}
                  />
                )}
                {entry.heartsDelta !== 0 && (
                  <Chip
                    label="Hearts"
                    value={`${entry.heartsDelta > 0 ? '+' : ''}${entry.heartsDelta}`}
                    bad={entry.heartsDelta < 0}
                    active={openChip === 'hearts'}
                    onPress={() => { sfx('click'); setOpenChip(openChip === 'hearts' ? null : 'hearts'); }}
                  />
                )}
                {!isPractice && (
                  <Chip
                    label="Foe HP left"
                    value={`${entry.foeHp}/${entry.foeMaxHp}`}
                    active={openChip === 'foeHp'}
                    onPress={() => { sfx('click'); setOpenChip(openChip === 'foeHp' ? null : 'foeHp'); }}
                  />
                )}
              </View>

              {openChip && <View style={st.chipDetail}>{chipHelp(openChip)}</View>}

              {/* Itemized clickable Set math receipt */}
              {entry.set && (
                <View style={st.section}>
                  <View style={st.sectionHead}>
                    <Text style={st.sectionTitle}>HOW THE SET HIT</Text>
                    <Text style={st.sectionHint}>tap any row for details</Text>
                  </View>
                  {mathRows.map((r, i) => {
                    const interactive = !r.total && (!!r.explain || !!r.sourceRef);
                    const isOpen = openMath === i;
                    const about = r.sourceRef ? explainRef(r.sourceRef, heldWeapons, data.weaponBuilds) : null;
                    return (
                      <View key={i}>
                        <TouchableOpacity
                          testID={r.total ? undefined : `replay-math-${i}`}
                          disabled={!interactive}
                          activeOpacity={0.75}
                          accessibilityRole={interactive ? 'button' : undefined}
                          onPress={() => { sfx('click'); setOpenMath(isOpen ? null : i); }}
                          style={[
                            st.row,
                            r.subtotal && st.subtotalRow,
                            r.total && st.totalRow,
                            isOpen && st.rowOpen,
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <View style={st.rowTitleLine}>
                              <Text style={[st.rowLabel, (r.total || r.subtotal) && st.bold]}>
                                {r.label}
                              </Text>
                              {interactive && (
                                <Text style={st.rowCaret}>{isOpen ? '▲' : '?'}</Text>
                              )}
                            </View>
                            {r.sub && <Text style={st.rowSub}>{r.sub}</Text>}
                          </View>
                          <Text style={[st.rowValue, (r.total || r.subtotal) && st.bold]}>{r.value}</Text>
                        </TouchableOpacity>
                        {isOpen && (
                          <View style={st.mathDetail} testID={`replay-math-detail-${i}`}>
                            {r.explain && <Text style={st.explainText}>{r.explain}</Text>}
                            {about && about.text ? (
                              <View style={st.about}>
                                {about.icon && <Icon name={about.icon} size={18} color={INK} />}
                                <Text style={st.aboutText}><Text style={st.bold}>{about.name} ({about.kind}): </Text>{about.text}</Text>
                              </View>
                            ) : null}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Post-Set / non-Set events without redundant rule amounts */}
              <View style={st.section}>
                <Text style={st.sectionTitle}>{entry.kind === 'set' ? 'OTHER EFFECTS ON THIS MOVE' : 'WHAT HAPPENED'}</Text>
                {lines.length === 0 ? (
                  <Text style={st.empty}>Nothing else triggered on this move.</Text>
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
                        onPress={() => { sfx('click'); setOpenLine(isOpen ? null : i); }}
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

            {/* 4. Top sources */}
            <View style={st.panel} testID="replay-sources">
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

            {/* 5. Gear, passives & Arcana (reuses WeaponExplainer.tsx for all weapons) */}
            {(gear.length > 0 || others.length > 0 || passivesList.length > 0) && (
              <View style={{ gap: 8 }} testID="replay-gear">
                <Text style={st.gearTitle}>YOUR GEAR THIS FIGHT <Text style={st.gearHint}>· tap one for how it works</Text></Text>
                {gear.map(g => (
                  <WeaponExplainer
                    key={g.id}
                    weapon={g.weapon}
                    build={data.weaponBuilds[g.id]}
                    growth={data.growth}
                    evolutionMode="preview"
                    equippedEvolutionId={data.equippedEvolutions?.[g.id] ?? null}
                    beltSynergyIds={beltSynergyAttrSet(data.weapons, g.id)}
                    result={{
                      text: gearStatText(g.stat, data.totalDamage, weaponGuide(g.id).kind === 'always' ? 'always' : 'other'),
                      share: data.totalDamage > 0 ? (g.stat?.damage ?? 0) / data.totalDamage : 0,
                    }}
                  />
                ))}
                {others.map(o => {
                  const resultText =
                    o.kind === 'arcana' && (!o.stat || o.stat.fired === 0)
                      ? 'Active all fight.'
                      : gearStatText(o.stat, data.totalDamage, 'other');
                  return (
                    <DamageSourceExplainer
                      key={o.ref}
                      testID={`replay-gear-${o.ref}`}
                      sourceId={o.ref}
                      name={o.name}
                      icon={o.icon}
                      description={o.text}
                      result={{
                        text: resultText,
                        share:
                          data.totalDamage > 0 && o.stat && o.stat.damage > 0
                            ? o.stat.damage / data.totalDamage
                            : undefined,
                      }}
                    />
                  );
                })}
                {passivesList.map(p => {
                  const pStat = stats[`passive:${p.id}`];
                  return (
                    <DamageSourceExplainer
                      key={p.id}
                      testID={`replay-gear-passive:${p.id}`}
                      sourceId={`passive:${p.id}`}
                      name={p.name}
                      icon={p.icon}
                      subtitle={`${data.fighter} Passive`}
                      description={p.text}
                      result={
                        pStat && pStat.fired > 0
                          ? {
                              text: gearStatText(pStat, data.totalDamage, 'always'),
                              share:
                                data.totalDamage > 0 && pStat.damage > 0
                                  ? pStat.damage / data.totalDamage
                                  : undefined,
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </View>
            )}

            {/* 6. Full move table */}
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
      <HighlightStageModal
        visible={highlightIndex !== null}
        snapshot={highlightSnapshot}
        onClose={() => setHighlightIndex(null)}
      />
    </Modal>
  );
};

const Chip: React.FC<{
  label: string;
  value: string;
  bad?: boolean;
  hot?: boolean;
  active?: boolean;
  testID?: string;
  onPress?: () => void;
}> = ({ label, value, bad, hot, active, testID, onPress }) => (
  <TouchableOpacity
    testID={testID}
    disabled={!onPress}
    onPress={onPress}
    activeOpacity={0.75}
    accessibilityRole={onPress ? 'button' : undefined}
    style={[
      st.chip,
      hot && { backgroundColor: TONE.coinPale, borderWidth: 1, borderColor: INK },
      active && { backgroundColor: COLORS.actionYellow, borderWidth: 1, borderColor: INK },
    ]}
  >
    <Text style={st.chipLabel}>{label}</Text>
    <Text style={[st.chipValue, bad && { color: CRITICAL }]}>{value}</Text>
  </TouchableOpacity>
);

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: undefined });

const st = StyleSheet.create({
  summary: { fontSize: 14, lineHeight: 20, color: INK },
  gearTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 2, color: INK },
  gearHint: { fontSize: 11, fontWeight: '600', letterSpacing: 0, opacity: 0.7 },
  lineBlock: { gap: 4 },
  about: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.paperBeige, borderRadius: 8, padding: 8, marginTop: 4 },
  aboutText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: INK },
  root: { flex: 1, backgroundColor: COLORS.paperBeige },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: MUTED },
  title: { fontSize: 20, fontWeight: '900', color: INK },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvasWhite, borderWidth: 1.5, borderColor: INK },
  scroll: { alignItems: 'center', paddingBottom: 24 },
  body: { gap: 12 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, backgroundColor: COLORS.paperBeige, borderRadius: 10, borderWidth: 1.5, borderColor: INK, padding: 8, gap: 2 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  tileLabel: { flex: 1, fontSize: 10, fontWeight: '800', color: INK },
  tileValue: { fontSize: 19, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  tileSub: { fontSize: 10, color: MUTED },
  evoTimelineWrap: { gap: 5 },
  evoTimelineHead: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: '#6D28D9' },
  evoChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  evoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3E8FF',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    paddingHorizontal: 9,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  evoChipText: { flexShrink: 1, fontSize: 11.5, fontWeight: '900', color: '#5B21B6' },
  highlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.actionYellow,
    borderRadius: 10,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  highlightPillText: { flexShrink: 1, fontSize: 12.5, fontWeight: '900', color: INK },
  highlightPillSmall: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.actionYellow,
    borderRadius: 999,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: INK,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  highlightPillSmallText: { fontSize: 11.5, fontWeight: '900', color: INK },
  panel: { backgroundColor: COLORS.canvasWhite, borderRadius: 12, borderWidth: 1.5, borderColor: INK, padding: 12, gap: 8 },
  panelTitle: { fontSize: 15, fontWeight: '900', color: INK },
  panelSub: { fontSize: 11, color: MUTED },
  chartHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  chartHint: { fontSize: 11, fontWeight: '700', color: MUTED },
  chartLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  lineDot: { width: 10, height: 3, borderRadius: 1.5 },
  inspectHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inspectTitle: { fontSize: 17, fontWeight: '900', color: INK, textAlign: 'center' },
  step: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paperBeige },
  stepText: { fontSize: 16, color: INK },
  cards: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  cardPick: { alignItems: 'center', gap: 3, padding: 4, borderRadius: 8, borderWidth: 1.5, borderColor: 'transparent' },
  cardPickActive: { borderColor: INK, backgroundColor: TONE.selected },
  cardSlot: { width: 56, height: 75 },
  cardDmg: { fontSize: 11, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  cardDmgHot: { color: TONE.upside },
  cardTagPill: { backgroundColor: TONE.coinPale, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: '#E0C770' },
  cardTag: { fontSize: 9.5, fontWeight: '800', color: INK },
  tapHint: { fontSize: 10.5, color: MUTED, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: COLORS.paperBeige, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  chipDetail: { backgroundColor: '#FFFDF7', borderRadius: 8, borderWidth: 1, borderColor: GRID, padding: 8 },
  chipLabel: { fontSize: 9.5, fontWeight: '800', color: MUTED, letterSpacing: 0.4 },
  chipValue: { fontSize: 14, fontWeight: '900', color: INK, fontVariant: ['tabular-nums'] },
  section: { gap: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 },
  sectionTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: MUTED },
  sectionHint: { fontSize: 10, color: MUTED },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingHorizontal: 4, borderRadius: 6 },
  rowOpen: { backgroundColor: TONE.selected },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowCaret: {
    fontSize: 9.5,
    fontWeight: '900',
    color: INK,
    opacity: 0.6,
    backgroundColor: COLORS.paperBeige,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  rowSub: { fontSize: 11, color: MUTED, marginTop: 1 },
  subtotalRow: { borderTopWidth: 1, borderTopColor: GRID, backgroundColor: '#FBF8F3', marginTop: 2, paddingTop: 5 },
  totalRow: { borderTopWidth: 1.5, borderTopColor: INK, paddingTop: 6, marginTop: 2 },
  rowLabel: { fontSize: 13, color: INK },
  rowValue: { fontSize: 13, color: INK, fontVariant: ['tabular-nums'], fontFamily: mono },
  bold: { fontWeight: '900' },
  mathDetail: { paddingHorizontal: 6, paddingBottom: 6, gap: 4 },
  explainBox: { backgroundColor: '#FFFDF7', borderRadius: 8, borderWidth: 1.5, borderColor: INK, padding: 9, gap: 4 },
  explainTitle: { fontSize: 12, fontWeight: '900', color: INK },
  explainText: { fontSize: 12, lineHeight: 17, color: INK },
  explainBullet: { fontSize: 11.5, lineHeight: 16, color: INK, opacity: 0.88 },
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
