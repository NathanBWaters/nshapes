/**
 * Shared Brotato-style Cumulative Damage Breakdown & 3-Second Animated Battle Story.
 *
 * Used by BOTH Adventure Mode (`LevelResults`) and Starfall Summit (`SpireRewardScreen`
 * for per-battle breakdown + `SpireEndScreen` for full-climb cumulative breakdown).
 *
 * Features:
 *   - Over-time cumulative stacked area + glowing multi-line SVG graph of your top
 *     weapons, passives, skills, evolutions, and Sets.
 *   - 3-second animated crescendo sweep (`STORY_SWEEP_MS = 2700 ms`): GPU-only curtain
 *     reveal + golden playhead + peak spark bursts + each weapon's real musical voice
 *     (`band.storyBeat`) climbing into `storyClimax` + MVP crown pop.
 *   - Brotato-style ranked cumulative damage leaderboard with GPU-animated proportion
 *     bars, `%` share, hit count, and interactive row tap to isolate that item's curve
 *     and inspect it via the single shared `WeaponExplainer`.
 *
 * Zero infinite loops, zero layout-property (`width`/`height`) animations, full
 * Reduced Motion support.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import Icon from '@/components/Icon';
import { WeaponAvatar } from '@/components/weapons';
import { band, sfx } from '@/audio';
import { COLORS } from '@/utils/colors';
import { EASE, MS, SCALE, SPRING } from '@/utils/motion';
import { getArmoryWeapon } from '../data/armory';
import type { WeaponBuild, WeaponBuilds } from '../data/weaponStats';
import type {
  CrescendoBeat,
  DamageSourceKind,
  DamageSourceSummary,
  DamageStory,
} from '../engine/damageStory';
import DamageSourceExplainer from './DamageSourceExplainer';
import { INK, TONE } from './ui';
import WeaponExplainer from './WeaponExplainer';

/** Length of the 3-second animated battle overview crescendo (ms) */
export const STORY_SWEEP_MS = 2700;

/**
 * Crisp crescendo S-curve for the 3-second timeline sweep: gentle opening,
 * exhilarating swell through mid-fight combos, and firm arrival on K.O. at `STORY_SWEEP_MS`.
 */
const SWEEP_BEZ = [0.24, 0.06, 0.68, 1] as const;
const SWEEP_EASING = Easing.bezier(SWEEP_BEZ[0], SWEEP_BEZ[1], SWEEP_BEZ[2], SWEEP_BEZ[3]);
const cubic1d = (a: number, b: number, t: number): number =>
  3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;

/** Exact normalized time u ∈ [0, 1] when `SWEEP_EASING(u)` reaches visual progress `p`. */
const timeForSweepProgress = (p: number): number => {
  const clamped = Math.max(0, Math.min(1, p));
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) * 0.5;
    if (cubic1d(SWEEP_BEZ[1], SWEEP_BEZ[3], mid) < clamped) lo = mid;
    else hi = mid;
  }
  return cubic1d(SWEEP_BEZ[0], SWEEP_BEZ[2], (lo + hi) * 0.5);
};

/** Exact visual progress p ∈ [0, 1] of `SWEEP_EASING` at normalized time `u`. */
const sweepProgressAtTime = (u: number): number => {
  const clamped = Math.max(0, Math.min(1, u));
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) * 0.5;
    if (cubic1d(SWEEP_BEZ[0], SWEEP_BEZ[2], mid) < clamped) lo = mid;
    else hi = mid;
  }
  return cubic1d(SWEEP_BEZ[1], SWEEP_BEZ[3], (lo + hi) * 0.5);
};

const CHART_H = 142;
const PAD_L = 34;
const PAD_R = 10;
const PAD_T = 28;
const PAD_B = 20;
const PLOT_H = CHART_H - PAD_T - PAD_B;

const KIND_TAG: Record<DamageSourceKind, string> = {
  weapon: 'WEAPON',
  passive: 'PASSIVE',
  skill: 'SKILL',
  evolution: 'EVO',
  set: 'SETS',
  power: 'POWER',
  bonus: 'BONUS',
};

const niceAxisMax = (v: number): number => {
  if (v <= 5) return 5;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
};

const fmtDmg = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);

const SPARK_DIRS = [
  { dx: 0, dy: -16 },
  { dx: 15, dy: -7 },
  { dx: -15, dy: -7 },
  { dx: 11, dy: 12 },
  { dx: -11, dy: 12 },
] as const;

/** One-shot GPU spark burst popping at a crescendo peak `(x, y)` on the cumulative curve */
const PeakBurst: React.FC<{ x: number; y: number; color: string; delayMs: number }> = ({ x, y, color, delayMs }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withDelay(delayMs, withTiming(1, { duration: MS.move + 120, easing: EASE.enter }));
  }, [delayMs, p]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: p.value <= 0 || p.value >= 1 ? 0 : (1 - p.value) * 0.95,
    transform: [{ scale: 0.3 + p.value * 1.65 }],
  }));

  return (
    <View pointerEvents="none" style={[st.burstAnchor, { left: x, top: y }]}>
      <Animated.View style={[st.burstRing, { borderColor: color }, ringStyle]} />
      {SPARK_DIRS.map((d, i) => (
        <PeakDot key={i} dx={d.dx} dy={d.dy} color={color} progress={p} />
      ))}
    </View>
  );
};

const PeakDot: React.FC<{ dx: number; dy: number; color: string; progress: SharedValue<number> }> = ({
  dx,
  dy,
  color,
  progress,
}) => {
  const anim = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: t <= 0 || t >= 1 ? 0 : (1 - t) * 0.95,
      transform: [{ translateX: dx * t }, { translateY: dy * t }, { scale: 0.5 + (1 - t) * 0.7 }],
    };
  });
  return <Animated.View style={[st.burstDot, { backgroundColor: color }, anim]} />;
};

/** GPU-only left-to-right filling Brotato bar (slides inside a static `%`-width clip container) */
const BrotatoBar: React.FC<{
  /** Normalized fill ratio relative to the #1 MVP (0..1) so every row is easy to compare */
  ratio: number;
  color: string;
  barProgress: SharedValue<number>;
  reduced: boolean;
}> = ({ ratio, color, barProgress, reduced }) => {
  const [fillW, setFillW] = useState(140);
  const pct = Math.max(6, Math.min(100, Math.round(ratio * 100)));

  const fillStyle = useAnimatedStyle(() => {
    const t = reduced ? 1 : barProgress.value;
    return {
      transform: [{ translateX: -(1 - t) * fillW }],
    };
  });

  return (
    <View style={st.barTrack}>
      <View
        style={[st.barClip, { width: `${pct}%` }]}
        onLayout={e => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) setFillW(w);
        }}
      >
        <Animated.View style={[st.barFill, { backgroundColor: color }, fillStyle]} />
      </View>
    </View>
  );
};

interface Props {
  story: DamageStory;
  /** Optional heading override (e.g. "BATTLE BREAKDOWN" vs "CLIMB DAMAGE REPORT") */
  title?: string;
  /** Weapon build metadata (levels/tuning) so tapping a weapon opens exact `WeaponExplainer` numbers */
  weaponBuilds?: WeaponBuilds;
  /** Delay before auto-playing the 3-second crescendo (e.g. wait for Adventure stars to land) */
  startDelayMs?: number;
  /** Whether the screen is currently visible / not covered by an unlock modal */
  active?: boolean;
  /** Reduced motion or effects off: renders complete chart & bars immediately at rest */
  reduced?: boolean;
  /** Suppress audio cues when silent (e.g. unit tests) */
  muted?: boolean;
  /** Hide Adventure-only global Power accumulation notes in WeaponExplainer (used by Spire) */
  hidePowerNote?: boolean;
  /** Optional compact top toggle slot (e.g. "Full Climb" vs "Final Fight" on SpireEndScreen) */
  headerRight?: React.ReactNode;
  testID?: string;
}

const BattleDamageStory: React.FC<Props> = ({
  story,
  title,
  weaponBuilds,
  startDelayMs = 260,
  active = true,
  reduced = false,
  muted = false,
  hidePowerNote = false,
  headerRight,
  testID = 'battle-damage-story',
}) => {
  const [chartWidth, setChartWidth] = useState(324);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [playRun, setPlayRun] = useState(0);
  const [liveCallout, setLiveCallout] = useState<string | null>(null);
  const [liveTotal, setLiveTotal] = useState<number>(reduced ? story.totalDamage : story.totalDamage);
  const [playing, setPlaying] = useState(false);

  const sweep = useSharedValue(reduced ? 1 : 0);
  const playheadOp = useSharedValue(0);
  const mvpScale = useSharedValue(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const autoPlayed = useRef(false);

  const plotW = Math.max(120, chartWidth - PAD_L - PAD_R);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Compute SVG stacked area + crisp multi-line paths deterministically from `story`
  const chartData = useMemo(() => {
    const pts = story.points;
    const n = pts.length;
    const maxY = niceAxisMax(Math.max(1, story.totalDamage));
    const xOf = (idx: number) => PAD_L + (n <= 1 ? plotW : (idx / (n - 1)) * plotW);
    const yOf = (val: number) => PAD_T + PLOT_H - Math.min(1, Math.max(0, val / maxY)) * PLOT_H;

    // Stacked bands: build bottom-up so the #1 MVP source forms the dramatic top ridge!
    // Include any sources beyond the top 5 as a subtle slate base band so the stack meets 100% of the total ridge.
    const topIds = new Set(story.chartSources.map(s => s.id));
    const tailSources = story.sources.filter(s => !topIds.has(s.id));
    const stackLayers: { id: string; color: string; cumulative: number[] }[] = [];
    if (tailSources.length > 0) {
      const tailCum = new Array<number>(n).fill(0);
      for (const s of tailSources) {
        for (let i = 0; i < n; i++) tailCum[i] += s.cumulative[i] ?? 0;
      }
      stackLayers.push({ id: '__other__', color: '#64748B', cumulative: tailCum });
    }
    for (const src of [...story.chartSources].reverse()) {
      stackLayers.push({ id: src.id, color: src.color, cumulative: src.cumulative });
    }

    const runningBase = new Array<number>(n).fill(0);
    const areas: { id: string; color: string; areaPath: string; topPath: string; endX: number; endY: number }[] = [];

    for (const src of stackLayers) {
      const tops: { x: number; y: number }[] = [];
      const bots: { x: number; y: number }[] = [];
      for (let i = 0; i < n; i++) {
        const b = runningBase[i];
        const t = b + (src.cumulative[i] ?? 0);
        runningBase[i] = t;
        const x = xOf(i);
        tops.push({ x, y: yOf(t) });
        bots.push({ x, y: yOf(b) });
      }
      const topCmd = tops.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
      const botCmd = bots
        .slice()
        .reverse()
        .map(pt => `L${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
        .join(' ');
      const lastTop = tops[tops.length - 1] ?? { x: PAD_L, y: PAD_T + PLOT_H };
      areas.push({
        id: src.id,
        color: src.color,
        areaPath: `${topCmd} ${botCmd} Z`,
        topPath: topCmd,
        endX: lastTop.x,
        endY: lastTop.y,
      });
    }

    // Individual non-stacked curve for when a player taps a single weapon/passive to isolate it!
    const singlePaths = new Map<string, string>();
    for (const src of story.sources) {
      const cmd = pts
        .map((_, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(src.cumulative[i] ?? 0).toFixed(1)}`)
        .join(' ');
      singlePaths.set(src.id, cmd);
    }

    // Total cumulative ridge path
    const totalPath = pts
      .map((pt, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(pt.totalCumulative).toFixed(1)}`)
      .join(' ');

    // Peak burst positions along the total cumulative ridge, timed to the EXACT frame the playhead crosses `b.x`
    const beatsWithPos = story.crescendoBeats.map(b => {
      const pt = pts[b.pointIndex] ?? pts[pts.length - 1];
      return {
        ...b,
        atMs: Math.round(timeForSweepProgress(b.progress) * STORY_SWEEP_MS),
        x: xOf(b.pointIndex),
        y: yOf(pt?.totalCumulative ?? story.totalDamage),
      };
    });

    // X-axis labels (Start, Middle, End)
    const midIdx = Math.floor((n - 1) / 2);
    const xTicks =
      n >= 3
        ? [
            { x: xOf(0), label: pts[0].label },
            { x: xOf(midIdx), label: pts[midIdx].label },
            { x: xOf(n - 1), label: pts[n - 1].label },
          ]
        : [
            { x: xOf(0), label: pts[0]?.label ?? '0:00' },
            { x: xOf(n - 1), label: pts[n - 1]?.label ?? '' },
          ];

    return { maxY, areas, singlePaths, totalPath, beatsWithPos, xTicks, yOf };
  }, [story, plotW]);

  /** Start (or replay) the 3-second crescendo animation + weapon voice symphony */
  const runCrescendo = useCallback(
    (delay: number, allowAudio: boolean) => {
      clearTimers();
      if (reduced || story.totalDamage <= 0) {
        sweep.value = 1;
        playheadOp.value = 0;
        mvpScale.value = 1;
        setLiveTotal(story.totalDamage);
        setLiveCallout(null);
        setPlaying(false);
        return;
      }

      const startFn = () => {
        setPlayRun(r => r + 1);
        setPlaying(true);
        setLiveTotal(0);
        setLiveCallout(null);
        sweep.value = 0;
        playheadOp.value = 1;
        mvpScale.value = 0.85;

        sweep.value = withTiming(1, { duration: STORY_SWEEP_MS, easing: SWEEP_EASING });
        playheadOp.value = withDelay(STORY_SWEEP_MS - 120, withTiming(0, { duration: 160, easing: EASE.exitSoft }));

        // Smooth 22-step live cumulative damage readout tracking the exact curve under the playhead
        const pts = story.points;
        const maxIdx = Math.max(1, pts.length - 1);
        const LIVE_STEPS = 22;
        for (let s = 1; s < LIVE_STEPS; s++) {
          const u = s / LIVE_STEPS;
          const visualP = sweepProgressAtTime(u);
          const fIdx = visualP * maxIdx;
          const lo = Math.floor(fIdx);
          const hi = Math.min(maxIdx, lo + 1);
          const frac = fIdx - lo;
          const v0 = pts[lo]?.totalCumulative ?? 0;
          const v1 = pts[hi]?.totalCumulative ?? v0;
          const interp = Math.round(v0 + (v1 - v0) * frac);
          timers.current.push(
            setTimeout(() => {
              setLiveTotal(interp);
            }, Math.round(u * STORY_SWEEP_MS))
          );
        }

        // Schedule weapon-voice crescendo beats & live callout milestones on the EXACT frame the playhead hits each dot
        const beats = story.crescendoBeats;
        const totalSteps = beats.length;
        beats.forEach((beat, idx) => {
          const atMs = Math.round(timeForSweepProgress(beat.progress) * STORY_SWEEP_MS);
          timers.current.push(
            setTimeout(() => {
              setLiveCallout(beat.label);
              if (allowAudio && !muted) {
                band.storyBeat({ weaponId: beat.weaponId, step: idx, totalSteps });
              }
            }, atMs)
          );
        });

        // Climax resolution: crown MVP + resolve chord
        timers.current.push(
          setTimeout(() => {
            setLiveTotal(story.totalDamage);
            setLiveCallout(null);
            setPlaying(false);
            mvpScale.value = withSequence(
              withTiming(SCALE.pop, { duration: MS.feedback, easing: EASE.pop }),
              withSpring(1, SPRING.lively)
            );
            if (allowAudio && !muted) {
              band.cue('storyClimax');
            }
          }, STORY_SWEEP_MS)
        );
      };

      if (delay > 0) {
        // Keep the full graph visible until the crescendo begins (no empty hole while stars land!)
        sweep.value = 1;
        setLiveTotal(story.totalDamage);
        timers.current.push(setTimeout(startFn, delay));
      } else {
        startFn();
      }
    },
    [clearTimers, reduced, story, sweep, playheadOp, mvpScale, muted]
  );

  // Auto-play once when active (and re-sync cleanly when switching story mode, e.g. Climb vs Final Fight)
  useEffect(() => {
    autoPlayed.current = false;
    setSelectedId(null);
    setShowAll(false);
  }, [story]);

  useEffect(() => {
    if (!active || autoPlayed.current) return;
    autoPlayed.current = true;
    runCrescendo(startDelayMs, true);
  }, [active, startDelayMs, runCrescendo]);

  const curtainStyle = useAnimatedStyle(() => ({
    opacity: sweep.value >= 0.999 ? 0 : 1,
    transform: [{ translateX: sweep.value * plotW }],
  }));

  const playheadStyle = useAnimatedStyle(() => ({
    opacity: playheadOp.value,
    transform: [{ translateX: sweep.value * plotW }],
  }));

  const mvpStyle = useAnimatedStyle(() => ({
    transform: [{ scale: mvpScale.value }],
  }));

  if (story.totalDamage <= 0 || story.sources.length === 0) return null;

  const visibleSources = showAll ? story.sources : story.sources.slice(0, 4);
  const topSourceDmg = Math.max(1, story.sources[0]?.totalDamage ?? 1);
  const hiddenCount = Math.max(0, story.sources.length - visibleSources.length);
  const selectedSource: DamageSourceSummary | null = selectedId
    ? story.sources.find(s => s.id === selectedId) ?? null
    : null;
  const selectedWeapon = selectedSource?.weaponId ? getArmoryWeapon(selectedSource.weaponId, weaponBuilds) : undefined;
  const selectedBuild: WeaponBuild | undefined =
    selectedSource?.weaponId && weaponBuilds ? weaponBuilds[selectedSource.weaponId] : undefined;

  return (
    <View style={st.panel} testID={testID}>
      {/* Header Row: Title + Replay 3s Button + Optional Mode Switch */}
      <View style={st.headerRow}>
        <View style={st.titleGroup}>
          <Icon name="delapouite/chart" size={16} color={COLORS.actionYellow} />
          <Text style={st.titleText} numberOfLines={1}>
            {title ?? (story.xAxisMode === 'floors' ? 'CLIMB DAMAGE REPORT' : 'DAMAGE BREAKDOWN')}
          </Text>
        </View>
        <View style={st.headerControls}>
          {headerRight}
          {!reduced && (
            <TouchableOpacity
              testID={`${testID}-replay-btn`}
              onPress={() => {
                sfx('click');
                runCrescendo(0, true);
              }}
              activeOpacity={0.8}
              style={st.replayBtn}
              accessibilityRole="button"
              accessibilityLabel="Replay 3-second damage story"
            >
              <Icon name="lorc/cycle" size={11} color={INK} />
              <Text style={st.replayBtnText}>{playing ? 'Playing' : '3s Story'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Plain-English 1-Line Battle Headline */}
      <Text style={st.headline} numberOfLines={2} testID={`${testID}-headline`}>
        {story.headline}
      </Text>

      {/* Dark-Onyx Over-Time Cumulative Graph Stage */}
      <View
        style={st.chartBox}
        testID={`${testID}-chart`}
        onLayout={e => {
          const w = e.nativeEvent.layout.width;
          if (w > 120) setChartWidth(w);
        }}
      >
        {/* Top live overlay: callout pill + live cumulative total */}
        <View style={st.chartTopBar} pointerEvents="none">
          <View style={st.calloutSlot}>
            {liveCallout ? (
              <View style={st.calloutPill}>
                <Text style={st.calloutText} numberOfLines={1}>
                  {liveCallout}
                </Text>
              </View>
            ) : selectedSource ? (
              <View style={[st.calloutPill, { borderColor: selectedSource.color }]}>
                <Text style={[st.calloutText, { color: selectedSource.color }]} numberOfLines={1}>
                  {selectedSource.name} · {Math.round(selectedSource.totalDamage)} dmg
                </Text>
              </View>
            ) : (
              <Text style={st.chartAxisHint} numberOfLines={1}>
                {story.xAxisMode === 'floors' ? 'Cumulative dmg by floor' : 'Cumulative dmg over time'}
              </Text>
            )}
          </View>
          <Text style={st.liveTotal} testID={`${testID}-total`}>
            {Math.round(liveTotal).toLocaleString()} DMG
          </Text>
        </View>

        <Svg width={chartWidth} height={CHART_H}>
          <Defs>
            {chartData.areas.map(a => (
              <LinearGradient key={a.id} id={`grad-${a.id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={a.color} stopOpacity="0.45" />
                <Stop offset="1" stopColor={a.color} stopOpacity="0.06" />
              </LinearGradient>
            ))}
          </Defs>

          {/* Subtle horizontal gridlines + Y-axis labels */}
          {[0, 0.5, 1].map((frac, idx) => {
            const val = chartData.maxY * frac;
            const y = chartData.yOf(val);
            return (
              <React.Fragment key={idx}>
                <Line
                  x1={PAD_L}
                  y1={y}
                  x2={PAD_L + plotW}
                  y2={y}
                  stroke="rgba(255,253,245,0.12)"
                  strokeWidth={1}
                  strokeDasharray={frac === 0 ? undefined : '3,3'}
                />
                <SvgText
                  x={PAD_L - 5}
                  y={y + 3.5}
                  fill="rgba(233,220,203,0.68)"
                  fontSize="9"
                  fontWeight="700"
                  textAnchor="end"
                >
                  {fmtDmg(val)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Stacked cumulative area bands + crisp color ridge strokes */}
          {chartData.areas.map(a => {
            const dimmed = selectedId !== null && selectedId !== a.id;
            return (
              <React.Fragment key={a.id}>
                <Path d={a.areaPath} fill={`url(#grad-${a.id})`} opacity={dimmed ? 0.14 : 1} />
                <Path
                  d={a.topPath}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={selectedId === a.id ? 2.8 : 1.8}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={dimmed ? 0.22 : 0.95}
                />
              </React.Fragment>
            );
          })}

          {/* Isolated individual source curve if user tapped a source beyond top 5 or wants exact curve */}
          {selectedId && chartData.singlePaths.has(selectedId) && (
            <Path
              d={chartData.singlePaths.get(selectedId)!}
              fill="none"
              stroke={selectedSource?.color ?? COLORS.actionYellow}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Crisp bright total cumulative outline on top */}
          {!selectedId && (
            <Path
              d={chartData.totalPath}
              fill="none"
              stroke="#FFFDF5"
              strokeWidth={1.6}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.75}
            />
          )}

          {/* Milestone peak markers on the total ridge */}
          {!selectedId &&
            chartData.beatsWithPos.map((b, idx) => (
              <Circle
                key={idx}
                cx={b.x}
                cy={b.y}
                r={idx === chartData.beatsWithPos.length - 1 ? 4 : 3}
                fill={b.color}
                stroke="#181513"
                strokeWidth={1.5}
              />
            ))}

          {/* X-axis tick labels */}
          {chartData.xTicks.map((tk, i) => (
            <SvgText
              key={i}
              x={tk.x}
              y={CHART_H - 5}
              fill="rgba(233,220,203,0.72)"
              fontSize="9"
              fontWeight="800"
              textAnchor={i === 0 ? 'start' : i === chartData.xTicks.length - 1 ? 'end' : 'middle'}
            >
              {tk.label}
            </SvgText>
          ))}
        </Svg>

        {/* GPU-composited curtain reveal + golden playhead during the 3-second crescendo */}
        {!reduced && (
          <View
            pointerEvents="none"
            style={[st.revealClip, { left: PAD_L, top: PAD_T - 5, width: plotW + 8, height: PLOT_H + 10 }]}
          >
            <Animated.View style={[st.curtain, curtainStyle]} />
            <Animated.View style={[st.playheadWrap, playheadStyle]}>
              <View style={st.playheadGlow} />
              <View style={st.playheadLine} />
            </Animated.View>
          </View>
        )}

        {/* Color-matched peak spark bursts keyed to each crescendo replay */}
        {!reduced &&
          playRun > 0 &&
          chartData.beatsWithPos.map((b: CrescendoBeat & { atMs: number; x: number; y: number }, idx) => (
            <PeakBurst
              key={`${playRun}-${idx}`}
              x={b.x}
              y={b.y}
              color={b.color}
              delayMs={b.atMs}
            />
          ))}
      </View>

      {/* Brotato-Style Ranked Cumulative Weapon & Passive Leaderboard */}
      <View style={st.list} testID={`${testID}-rows`}>
        {visibleSources.map((src, idx) => {
          const isMvp = idx === 0 && story.sources.length > 1;
          const isSelected = selectedId === src.id;
          const pct = Math.max(1, Math.round(src.share * 100));
          const weaponObj = src.weaponId ? getArmoryWeapon(src.weaponId, weaponBuilds) : undefined;
          return (
            <TouchableOpacity
              key={src.id}
              testID={`${testID}-row-${idx}`}
              activeOpacity={0.8}
              onPress={() => {
                sfx('click');
                setSelectedId(cur => (cur === src.id ? null : src.id));
              }}
              style={[st.row, isSelected && st.rowSelected]}
              accessibilityRole="button"
              accessibilityLabel={`${src.name}: ${Math.round(src.totalDamage)} damage, ${pct}% of total`}
            >
              {/* Left: Weapon Avatar or Color-Coded Icon Medallion */}
              <View style={[st.iconBadge, { borderColor: src.color }]}>
                {weaponObj ? (
                  <WeaponAvatar weapon={weaponObj} size={24} />
                ) : (
                  <Icon name={src.icon} size={16} color={src.color} />
                )}
              </View>

              {/* Center: Name + Kind + MVP + GPU Brotato Bar */}
              <View style={st.rowCenter}>
                <View style={st.rowLabelLine}>
                  <View style={[st.dot, { backgroundColor: src.color }]} />
                  <Text style={st.rowName} numberOfLines={1}>
                    {src.name}
                  </Text>
                  {isMvp ? (
                    <Animated.View style={[st.mvpBadge, mvpStyle]}>
                      <Icon name="lorc/crown" size={10} color={INK} />
                      <Text style={st.mvpText}>MVP</Text>
                    </Animated.View>
                  ) : (
                    <View style={st.kindPill}>
                      <Text style={st.kindText}>{KIND_TAG[src.kind]}</Text>
                    </View>
                  )}
                </View>
                <BrotatoBar
                  ratio={src.totalDamage / topSourceDmg}
                  color={src.color}
                  barProgress={sweep}
                  reduced={reduced}
                />
              </View>

              {/* Right: Cumulative Damage + Share & Hits */}
              <View style={st.rowMetrics}>
                <Text style={st.rowDmg}>{Math.round(src.totalDamage).toLocaleString()}</Text>
                <Text style={st.rowSub}>
                  {pct}% · {src.hits}×
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {hiddenCount > 0 && (
          <TouchableOpacity
            testID={`${testID}-show-all`}
            onPress={() => {
              sfx('click');
              setShowAll(true);
            }}
            style={st.moreBtn}
            activeOpacity={0.75}
            accessibilityRole="button"
          >
            <Text style={st.moreBtnText}>Show all {story.sources.length} damage sources (+{hiddenCount})</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Interactive Inline Inspector (reuses canonical WeaponExplainer for weapons, DamageSourceExplainer for all non-weapon sources!) */}
      {selectedSource && (
        <View style={st.inspector} testID={`${testID}-inspector`}>
          {selectedWeapon ? (
            <WeaponExplainer
              key={selectedWeapon.id}
              weapon={selectedWeapon}
              build={selectedBuild}
              hidePowerNote={hidePowerNote}
              badge={selectedSource === story.sources[0] ? 'MVP' : `${Math.round(selectedSource.share * 100)}% DMG`}
              result={{
                text: `${Math.round(selectedSource.totalDamage).toLocaleString()} cumulative dmg (${Math.round(selectedSource.share * 100)}%) · ${selectedSource.hits} ${selectedSource.hits === 1 ? 'hit' : 'hits'} · biggest spike +${Math.round(selectedSource.biggestHit)}.`,
                share: selectedSource.share,
              }}
            />
          ) : (
            <DamageSourceExplainer
              key={selectedSource.id}
              sourceId={selectedSource.id}
              name={selectedSource.name}
              kind={selectedSource.kind}
              icon={selectedSource.icon}
              accentColor={selectedSource.color}
              scopeLabel={story.xAxisMode === 'floors' ? 'THIS CLIMB' : 'THIS FIGHT'}
              badge={
                selectedSource === story.sources[0]
                  ? 'MVP'
                  : `${Math.max(1, Math.round(selectedSource.share * 100))}% DMG`
              }
              result={{
                text: `${Math.round(selectedSource.totalDamage).toLocaleString()} cumulative dmg (${Math.max(1, Math.round(selectedSource.share * 100))}%) · ${selectedSource.hits} ${selectedSource.hits === 1 ? 'hit' : 'hits'} · biggest spike +${Math.round(selectedSource.biggestHit)}.`,
                share: selectedSource.share,
              }}
            />
          )}
        </View>
      )}
    </View>
  );
};

const st = StyleSheet.create({
  panel: {
    alignSelf: 'stretch',
    backgroundColor: '#FAF7F0',
    borderRadius: 12,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: INK,
    padding: 10,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    minWidth: 0,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  titleText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: INK,
    flexShrink: 1,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 82,
    gap: 4,
    backgroundColor: COLORS.actionYellow,
    borderWidth: 1.5,
    borderBottomWidth: 2.5,
    borderColor: INK,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  replayBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: INK,
    letterSpacing: 0.4,
  },
  headline: {
    fontSize: 12,
    fontWeight: '800',
    color: INK,
    opacity: 0.86,
    lineHeight: 16,
  },
  chartBox: {
    position: 'relative',
    backgroundColor: '#181513',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: INK,
    overflow: 'hidden',
  },
  chartTopBar: {
    position: 'absolute',
    top: 4,
    left: 8,
    right: 8,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  calloutSlot: {
    flex: 1,
    minWidth: 0,
  },
  chartAxisHint: {
    fontSize: 9.5,
    fontWeight: '800',
    color: 'rgba(233,220,203,0.68)',
    letterSpacing: 0.4,
  },
  calloutPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(24,21,19,0.9)',
    borderWidth: 1,
    borderColor: '#F5B800',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    maxWidth: '100%',
  },
  calloutText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#FFE84D',
    letterSpacing: 0.5,
  },
  liveTotal: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.actionYellow,
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  revealClip: {
    position: 'absolute',
    overflow: 'hidden',
    zIndex: 2,
  },
  curtain: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#181513',
  },
  playheadWrap: {
    position: 'absolute',
    left: -14,
    top: 0,
    bottom: 0,
    width: 16,
    flexDirection: 'row',
  },
  playheadGlow: {
    width: 14,
    height: '100%',
    backgroundColor: 'rgba(255, 224, 71, 0.24)',
  },
  playheadLine: {
    width: 2,
    height: '100%',
    backgroundColor: COLORS.actionYellow,
  },
  burstAnchor: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  burstRing: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  burstDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  list: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D6CFC4',
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 0,
  },
  rowSelected: {
    borderColor: INK,
    backgroundColor: TONE.selected,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: '#1C1917',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowCenter: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rowLabelLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    flexShrink: 0,
  },
  rowName: {
    fontSize: 12,
    fontWeight: '900',
    color: INK,
    flex: 1,
    flexShrink: 1,
  },
  mvpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.actionYellow,
    borderWidth: 1.5,
    borderColor: INK,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    flexShrink: 0,
  },
  mvpText: {
    fontSize: 9,
    fontWeight: '900',
    color: INK,
    letterSpacing: 0.6,
  },
  kindPill: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    flexShrink: 0,
  },
  kindText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: TONE.spent,
    letterSpacing: 0.5,
  },
  barTrack: {
    height: 7,
    backgroundColor: '#EAE4DA',
    borderRadius: 999,
    overflow: 'hidden',
  },
  barClip: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
  },
  rowMetrics: {
    alignItems: 'flex-end',
    minWidth: 50,
    flexShrink: 0,
  },
  rowDmg: {
    fontSize: 14,
    fontWeight: '900',
    color: INK,
    fontVariant: ['tabular-nums'],
  },
  rowSub: {
    fontSize: 9.5,
    fontWeight: '800',
    color: TONE.spent,
    fontVariant: ['tabular-nums'],
  },
  moreBtn: {
    alignItems: 'center',
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: COLORS.paperBeige,
    borderWidth: 1,
    borderColor: '#D6CFC4',
  },
  moreBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: INK,
  },
  inspector: {
    marginTop: 2,
  },
});

export default BattleDamageStory;
