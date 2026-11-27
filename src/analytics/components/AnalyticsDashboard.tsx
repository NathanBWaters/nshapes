import React, { useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon, { type IconName } from '@/components/Icon';
import { COLORS, RADIUS } from '@/utils/colors';
import { sfx } from '@/audio';
import { loadBattleHistory } from '@/adventure/save';
import {
  CURRENT_BALANCE_ERA,
  CURRENT_BALANCE_ERA_ID,
} from '../balanceEras';
import {
  analyzeFights,
  generateSimulatedCohort,
  mergeLocalAnalyticsSources,
  parseAnalyticsImportJson,
  type AnalyticsDashboardReport,
  type FightMode,
  type NormalizedFightRow,
} from '../dashboardEngine';
import { POSTHOG_HOST, POSTHOG_PROJECT_ID } from '../config';
import { POSTHOG_DASHBOARDS } from '../posthogDashboards';
import {
  clearAnalyticsInspectorHistory,
  flush,
  getAnalyticsInspectorState,
  setAnalyticsEnabled,
  type AnalyticsInspectorState,
} from '../posthog';
import {
  BalanceQuadrantChart,
  CampaignFunnelChart,
  RetentionChart,
  SegmentFunChart,
  STATUS_COLORS,
} from './DashboardCharts';

export type DashboardSource = 'local' | 'simulated' | 'import';
export type DashboardTab = 'overview' | 'funnel' | 'balance' | 'enjoyment' | 'posthog';

const TABS: { id: DashboardTab; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Overview', icon: 'delapouite/chart' },
  { id: 'funnel', label: 'Funnel', icon: 'lorc/field' },
  { id: 'balance', label: 'Balance', icon: 'lorc/crossed-swords' },
  { id: 'enjoyment', label: 'Enjoyment', icon: 'delapouite/thumb-up' },
  { id: 'posthog', label: 'PostHog', icon: 'delapouite/pie-chart' },
];

export type BalanceTabKey = 'weapons' | 'fighters' | 'evolutions' | 'arcana';

const BALANCE_CATEGORIES: { id: BalanceTabKey; label: string }[] = [
  { id: 'weapons', label: 'Weapons' },
  { id: 'fighters', label: 'Fighters' },
  { id: 'evolutions', label: 'Evolutions' },
  { id: 'arcana', label: 'Arcana' },
];

const EVO_SLOT_LABELS = ['Evo A', 'Evo B', 'Evo C'] as const;

const fmtPct = (v: number | null, digits = 0): string =>
  v === null || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(digits)}%`;

const fmtDelta = (v: number | null): string => {
  if (v === null || !Number.isFinite(v)) return '—';
  const pctVal = v * 100;
  return `${pctVal >= 0 ? '+' : ''}${pctVal.toFixed(1)}%`;
};

const fmtDur = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      navigator.clipboard?.writeText
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
};

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.kpiHint}>{hint}</Text>
    </View>
  );
}

function OverviewTab({
  report,
  chartWidth,
}: {
  report: AnalyticsDashboardReport;
  chartWidth: number;
}) {
  const ciText = report.funConfidenceInterval
    ? `95% CI ${fmtPct(report.funConfidenceInterval[0])}–${fmtPct(report.funConfidenceInterval[1])}`
    : 'Rate rounds to build CI';

  return (
    <View style={styles.sectionStack} testID="analytics-panel-overview">
      <View style={styles.kpiGrid}>
        <KpiCard
          label="TOTAL FIGHTS"
          value={`${report.totalFights}`}
          hint={`${report.adventureFights} Adv · ${report.spireFights} Summit · ${report.freePlayFights} Free · ${report.classicFights} Classic`}
        />
        <KpiCard
          label="PLAYERS / SESSIONS"
          value={`${report.uniquePlayers} / ${report.sessionsCount}`}
          hint={`${report.avgFightsPerSession.toFixed(1)} fights / session`}
        />
        <KpiCard
          label="DECIDED WIN RATE"
          value={fmtPct(report.overallWinRate, 1)}
          hint={`${fmtPct(report.abandonRate, 1)} abandon rate`}
          accent={COLORS.slateCharcoal}
        />
        <KpiCard
          label="FUN SCORE (👍)"
          value={fmtPct(report.overallFunRate, 1)}
          hint={`${report.funUpCount}👍 / ${report.funDownCount}👎 · ${ciText}`}
          accent={COLORS.logicTeal}
        />
      </View>

      <RetentionChart data={report.retention} width={chartWidth} />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Player Journey Funnel Stages</Text>
        <Text style={styles.cardSub}>
          Server-derived `$set` stage across anonymous `installId` cohorts
        </Text>
        <View style={styles.stageRowWrap}>
          {report.journeyBreakdown.map(st => (
            <View key={st.stage} style={styles.stageChip}>
              <Text style={styles.stageName}>{st.stage.toUpperCase()}</Text>
              <Text style={styles.stageCount}>{st.players} players</Text>
              <Text style={styles.stageMeta}>
                {st.fights} fights · {fmtPct(st.funRate)} fun
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Player Journey Inspector</Text>
        <Text style={styles.cardSub}>
          Top {Math.min(12, report.players.length)} players by recency (shareable playerCode)
        </Text>
        {report.players.length === 0 ? (
          <Text style={styles.emptyNotice}>No fights recorded yet.</Text>
        ) : (
          report.players.slice(0, 12).map(p => (
            <View key={p.distinctId} style={styles.listRow}>
              <View style={styles.listMain}>
                <Text style={styles.rowStrong}>{p.playerCode}</Text>
                <Text style={styles.rowMeta}>
                  {p.stage} · Peak {p.highestLevelId} · {p.daysActive}d active
                </Text>
              </View>
              <View style={styles.listRight}>
                <Text style={styles.rowStrong}>{p.totalFights} fights</Text>
                <Text style={styles.rowMeta}>
                  Win {fmtPct(p.winRate)} · Fun {fmtPct(p.funRate)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function FunnelTab({
  report,
  chartWidth,
}: {
  report: AnalyticsDashboardReport;
  chartWidth: number;
}) {
  const churnWalls = useMemo(
    () =>
      report.funnel
        .filter(r => r.attempts > 0)
        .slice()
        .sort((a, b) => b.churnWallScore - a.churnWallScore)
        .slice(0, 3),
    [report.funnel]
  );

  return (
    <View style={styles.sectionStack} testID="analytics-panel-funnel">
      <CampaignFunnelChart rows={report.funnel} width={chartWidth} />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top Churn Wall Alerts</Text>
        <Text style={styles.cardSub}>
          Composite score of drop-off %, abandon %, loss rate, low fun, and died-with-hints %
        </Text>
        {churnWalls.length === 0 ? (
          <Text style={styles.emptyNotice}>No Adventure campaign attempts in this dataset.</Text>
        ) : (
          churnWalls.map(w => (
            <View key={w.levelId} style={styles.wallAlert}>
              <View style={styles.wallHead}>
                <Text style={styles.rowStrong}>
                  {w.levelId} · {w.levelName}
                </Text>
                <View
                  style={[
                    styles.pill,
                    {
                      backgroundColor:
                        w.churnWallScore >= 40 ? '#FFE1DE' : '#FFE6CE',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: w.churnWallScore >= 40 ? '#A32018' : '#9A4400' },
                    ]}
                  >
                    WALL {Math.round(w.churnWallScore)}
                  </Text>
                </View>
              </View>
              <Text style={styles.rowMeta}>
                Win {fmtPct(w.winRate)} · Drop {fmtPct(w.nextLevelDropPct)} · Died w/ Hints{' '}
                {fmtPct(w.diedWithHintsPct)} · Fun {fmtPct(w.funRate)}
                {w.topNegativeTag ? ` · Top issue: ${w.topNegativeTag}` : ''}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Campaign Progression Table</Text>
        {report.funnel.map(row => (
          <View key={row.levelId} style={styles.listRow}>
            <View style={styles.listMain}>
              <Text style={styles.rowStrong}>
                {row.levelId} · {row.levelName}
              </Text>
              <Text style={styles.rowMeta}>
                Reached {row.playersReached} ({fmtPct(row.funnelPct)}) · {row.attempts} runs ·{' '}
                {row.attemptsPerClear !== null ? `${row.attemptsPerClear.toFixed(1)} tries/clear` : '0 clears'}
              </Text>
            </View>
            <View style={styles.listRight}>
              <Text style={styles.rowStrong}>
                Win {fmtPct(row.winRate)} · Fun {fmtPct(row.funRate)}
              </Text>
              <Text style={styles.rowMeta}>
                Abandon {fmtPct(row.abandonRate)} · {Math.round(row.avgDpm)} DPM
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function BalanceTab({
  report,
  chartWidth,
}: {
  report: AnalyticsDashboardReport;
  chartWidth: number;
}) {
  const [category, setCategory] = useState<BalanceTabKey>('weapons');
  const [evoView, setEvoView] = useState<'grouped' | 'flat'>('grouped');
  const rows = report.balance[category];
  const evoGroups = report.balance.evolutionsByWeapon;
  const showGroupedEvos = category === 'evolutions' && evoView === 'grouped' && evoGroups.length > 0;

  return (
    <View style={styles.sectionStack} testID="analytics-panel-balance">
      <View style={styles.subPillRow}>
        {BALANCE_CATEGORIES.map(c => {
          const active = category === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              testID={`analytics-balance-${c.id}`}
              style={[styles.subPill, active && styles.subPillActive]}
              onPress={() => {
                sfx('click');
                setCategory(c.id);
              }}
            >
              <Text style={[styles.subPillText, active && styles.subPillTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        {category === 'evolutions' && evoGroups.length > 0 && (
          <TouchableOpacity
            testID="analytics-evo-view-toggle"
            style={styles.subPill}
            onPress={() => {
              sfx('click');
              setEvoView(prev => (prev === 'grouped' ? 'flat' : 'grouped'));
            }}
          >
            <Text style={styles.subPillText}>
              {evoView === 'grouped' ? 'View: By Weapon (A/B/C)' : 'View: Flat List'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <BalanceQuadrantChart
        rows={rows}
        overallFunRate={report.overallFunRate}
        width={chartWidth}
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Simpson&apos;s-Paradox-Adjusted {BALANCE_CATEGORIES.find(c => c.id === category)?.label} Balance
        </Text>
        <Text style={styles.cardSub}>
          {showGroupedEvos
            ? 'Per-weapon 3-evolution breakdown (Evo A / Evo B / Evo C side-by-side)'
            : 'Adjusted Δ compares win rate vs expected win rate at each level/tier where it ran'}
        </Text>
        {rows.length === 0 ? (
          <Text style={styles.emptyNotice}>No items recorded in this category yet.</Text>
        ) : showGroupedEvos ? (
          evoGroups.map(grp => (
            <View key={grp.weaponId} style={styles.evoGroupCard} testID={`analytics-evo-group-${grp.weaponId}`}>
              <View style={styles.wallHead}>
                <Text style={styles.rowStrong}>{grp.weaponName}</Text>
                <Text style={styles.rowMeta}>{grp.totalUsed} triggers</Text>
              </View>
              <View style={styles.evoSlotGrid}>
                {grp.slots.map((slotRow, idx) => {
                  const slotLabel = EVO_SLOT_LABELS[idx];
                  if (!slotRow) {
                    return (
                      <View key={`${grp.weaponId}-${idx}`} style={[styles.evoSlotCell, styles.evoSlotEmpty]}>
                        <Text style={styles.evoSlotTag}>{slotLabel}</Text>
                        <Text style={styles.rowMeta}>No data</Text>
                      </View>
                    );
                  }
                  const st = STATUS_COLORS[slotRow.status];
                  return (
                    <View key={slotRow.id} style={styles.evoSlotCell}>
                      <View style={styles.inlineTitle}>
                        <Text style={styles.evoSlotTag}>{slotLabel}</Text>
                        <View style={[styles.pill, { backgroundColor: st.bg }]}>
                          <Text style={[styles.pillText, { color: st.fg }]}>{st.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.evoSlotName}>{slotRow.name}</Text>
                      <Text
                        style={[
                          styles.evoSlotDelta,
                          {
                            color:
                              (slotRow.adjustedWinDelta ?? 0) >= 0.08
                                ? '#9A4400'
                                : (slotRow.adjustedWinDelta ?? 0) <= -0.08
                                  ? '#A32018'
                                  : COLORS.slateCharcoal,
                          },
                        ]}
                      >
                        Δ {fmtDelta(slotRow.adjustedWinDelta)} · {Math.round(slotRow.avgDpm)} DPM
                      </Text>
                      <Text style={styles.rowMeta}>
                        {slotRow.usedCount} runs · Win {fmtPct(slotRow.rawWinRate)} · Fun {fmtPct(slotRow.funRate)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        ) : (
          rows.map(row => {
            const st = STATUS_COLORS[row.status];
            return (
              <View key={row.id} style={styles.listRow}>
                <View style={styles.listMain}>
                  <View style={styles.inlineTitle}>
                    <Text style={styles.rowStrong}>{row.name}</Text>
                    {row.weaponName && row.slotIndex !== undefined && (
                      <View style={[styles.pill, { backgroundColor: COLORS.paperBeige }]}>
                        <Text style={[styles.pillText, { color: COLORS.slateCharcoal }]}>
                          {row.weaponName} · {EVO_SLOT_LABELS[row.slotIndex]}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.pill, { backgroundColor: st.bg }]}>
                      <Text style={[styles.pillText, { color: st.fg }]}>{st.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.rowMeta}>
                    {row.usedCount} runs · Raw Win {fmtPct(row.rawWinRate)}
                    {row.offeredCount > 0
                      ? ` · Pick ${fmtPct(row.pickRate)} (${row.pickedOrBoughtCount}/${row.offeredCount})`
                      : ''}
                  </Text>
                </View>
                <View style={styles.listRight}>
                  <Text
                    style={[
                      styles.rowStrong,
                      {
                        color:
                          (row.adjustedWinDelta ?? 0) >= 0.08
                            ? '#9A4400'
                            : (row.adjustedWinDelta ?? 0) <= -0.08
                              ? '#A32018'
                              : COLORS.slateCharcoal,
                      },
                    ]}
                  >
                    Δ {fmtDelta(row.adjustedWinDelta)}
                  </Text>
                  <Text style={styles.rowMeta}>
                    Fun {fmtPct(row.funRate)} · {Math.round(row.avgDpm)} DPM
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

function EnjoymentTab({
  report,
  chartWidth,
}: {
  report: AnalyticsDashboardReport;
  chartWidth: number;
}) {
  const { enjoyment } = report;
  const winGap =
    enjoyment.winFunRate !== null && enjoyment.lossFunRate !== null
      ? enjoyment.winFunRate - enjoyment.lossFunRate
      : null;

  return (
    <View style={styles.sectionStack} testID="analytics-panel-enjoyment">
      <View style={styles.kpiGrid}>
        <KpiCard
          label="WIN VS LOSS FUN"
          value={`${fmtPct(enjoyment.winFunRate)} / ${fmtPct(enjoyment.lossFunRate)}`}
          hint={winGap !== null ? `${fmtDelta(winGap)} win/loss swing` : 'Need wins & losses'}
          accent={COLORS.logicTeal}
        />
        <KpiCard
          label="CLOSE CALL VS NORMAL"
          value={`${fmtPct(enjoyment.closeCallFunRate)} / ${fmtPct(enjoyment.normalFunRate)}`}
          hint="Tight finishes vs ordinary rounds"
        />
        <KpiCard
          label="FAST BOARD VS DROUGHT"
          value={`${fmtPct(enjoyment.fastBoardFunRate)} / ${fmtPct(enjoyment.droughtFunRate)}`}
          hint="<6s median find vs >=12s drought"
          accent={COLORS.impactOrange}
        />
        <KpiCard
          label="DIED WITH HINTS"
          value={fmtPct(enjoyment.diedWithHintsRate, 1)}
          hint="Losses while hints remained unused"
          accent={COLORS.impactRed}
        />
      </View>

      <SegmentFunChart segments={enjoyment.segments} width={chartWidth} />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Player Feedback Reasons (Tags)</Text>
        <Text style={styles.cardSub}>1-tap chips tapped after 👍 or 👎</Text>
        {enjoyment.tags.length === 0 ? (
          <Text style={styles.emptyNotice}>No feedback tags collected yet.</Text>
        ) : (
          enjoyment.tags.map(tag => (
            <View key={tag.tag} style={styles.tagStatRow}>
              <View style={styles.tagHeader}>
                <Text style={styles.rowStrong}>
                  {tag.polarity === 'up' ? '👍' : '👎'} {tag.label}
                </Text>
                <Text style={styles.rowMeta}>
                  {tag.count} ({tag.sharePct.toFixed(1)}%)
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.min(100, Math.max(4, tag.sharePct))}%`,
                      backgroundColor:
                        tag.polarity === 'up' ? COLORS.logicTeal : COLORS.impactRed,
                    },
                  ]}
                />
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mode Breakdown</Text>
        {enjoyment.modeBreakdown.map(m => (
          <View key={m.mode} style={styles.listRow}>
            <Text style={styles.rowStrong}>{m.mode}</Text>
            <Text style={styles.rowMeta}>
              {m.fights} fights · {fmtPct(m.funRate)} fun · {fmtDur(m.avgDurationMs)} avg
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PostHogTab() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopySql = async (id: string, sql: string) => {
    sfx('click');
    const ok = await copyToClipboard(sql);
    if (ok) setCopiedId(id);
  };

  return (
    <View style={styles.sectionStack} testID="analytics-panel-posthog">
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Minimal-Event PostHog Contract</Text>
        <Text style={styles.rowMeta}>
          Project {POSTHOG_PROJECT_ID} · {POSTHOG_HOST}
        </Text>
        <Text style={styles.bodyCopy}>
          Normal gameplay sends only `app_opened` (on session/launch) and ONE wide `fight_ended`
          event per finished game. Thumbs up/down ratings and replay opens merge directly into the
          staged `fight_ended` event before flush; retrospective Camp edits fall back to
          `fight_rated`.
        </Text>
        <View style={styles.codeBlock}>
          <Text style={styles.codeText}>
            POSTHOG_PERSONAL_API_KEY=... npm run analytics:posthog:sync
          </Text>
        </View>
      </View>

      {POSTHOG_DASHBOARDS.map(dash => (
        <View key={dash.id} style={styles.card}>
          <Text style={styles.cardTitle}>{dash.name}</Text>
          <Text style={styles.cardSub}>{dash.description}</Text>
          {dash.tiles.map(tile => (
            <View key={tile.id} style={styles.tileBox}>
              <View style={styles.wallHead}>
                <Text style={styles.rowStrong}>{tile.name}</Text>
                <TouchableOpacity
                  testID={`analytics-copy-sql-${tile.id}`}
                  style={styles.smallBtn}
                  onPress={() => {
                    void handleCopySql(tile.id, tile.hogql);
                  }}
                >
                  <Text style={styles.smallBtnText}>
                    {copiedId === tile.id ? 'Copied' : 'Copy HogQL'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.rowMeta}>{tile.description}</Text>
              <View style={styles.codeBlock}>
                <Text style={styles.codeText} numberOfLines={4}>
                  {tile.hogql}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export default function AnalyticsDashboard({
  initialSource = 'local',
  onBack,
}: {
  initialSource?: DashboardSource;
  onBack?: () => void;
}) {
  const { width } = useWindowDimensions();
  const [source, setSource] = useState<DashboardSource>(initialSource);
  const [tab, setTab] = useState<DashboardTab>('overview');
  const [eraScope, setEraScope] = useState<'all' | 'current'>('all');
  const [modeFilter, setModeFilter] = useState<FightMode | 'all'>('all');
  const [hygiene, setHygiene] = useState<'off' | 'prod_clean'>('off');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importedRows, setImportedRows] = useState<NormalizedFightRow[]>([]);
  const [inspector, setInspector] = useState<AnalyticsInspectorState>(() =>
    getAnalyticsInspectorState()
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const refreshInspector = () => {
    setInspector(getAnalyticsInspectorState());
  };

  const rows = useMemo(() => {
    if (source === 'simulated') {
      return generateSimulatedCohort(20261115, 60);
    }
    if (source === 'import') {
      return importedRows;
    }
    return mergeLocalAnalyticsSources(inspector.localEvents, loadBattleHistory(), {
      distinctId: inspector.distinctId,
      playerCode: inspector.playerCode,
    });
  }, [source, importedRows, inspector.localEvents, inspector.distinctId, inspector.playerCode]);

  const report = useMemo(
    () => analyzeFights(rows, { eraScope, modeFilter, hygiene }),
    [rows, eraScope, modeFilter, hygiene]
  );
  const chartWidth = Math.max(260, Math.min(760, width - 56));
  const audit = report.filterAudit;
  const droppedTotal = audit.inputCount - audit.keptCount;
  const auditDropSummary = useMemo(() => {
    const parts: string[] = [];
    if (audit.droppedByVersion > 0) parts.push(`${audit.droppedByVersion} stale ver`);
    if (audit.droppedByEnv > 0) parts.push(`${audit.droppedByEnv} dev/non-prod`);
    if (audit.droppedByMode > 0) parts.push(`${audit.droppedByMode} other mode`);
    if (audit.droppedByPractice > 0) parts.push(`${audit.droppedByPractice} practice`);
    if (audit.droppedByBug > 0) parts.push(`${audit.droppedByBug} bug-tagged`);
    if (audit.droppedByShort > 0) parts.push(`${audit.droppedByShort} short`);
    if (audit.droppedByCoached > 0) parts.push(`${audit.droppedByCoached} tutorial/coached`);
    return parts.join(' · ');
  }, [audit]);

  const handleApplyImport = () => {
    sfx('click');
    const parsed = parseAnalyticsImportJson(importText);
    if (parsed.error) {
      setImportError(parsed.error);
      return;
    }
    setImportError(null);
    setImportedRows(parsed.rows);
    setSource('import');
    setStatusMsg(`Loaded ${parsed.rows.length} fight rows`);
  };

  const handleToggleTracking = () => {
    sfx('click');
    const next = inspector.optedOut;
    setAnalyticsEnabled(next);
    refreshInspector();
    setStatusMsg(next ? 'Analytics enabled' : 'Analytics paused');
  };

  const handleFlush = async () => {
    sfx('click');
    await flush();
    refreshInspector();
    setStatusMsg('Flushed queue');
  };

  const handleClearLocal = () => {
    sfx('click');
    clearAnalyticsInspectorHistory();
    refreshInspector();
    setStatusMsg('Cleared inspector buffer');
  };

  return (
    <SafeAreaView style={styles.screen} testID="analytics-dashboard-root">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <View style={styles.topHeader}>
            <View style={styles.topLeft}>
              {onBack && (
                <TouchableOpacity
                  testID="analytics-back"
                  style={styles.backBtn}
                  onPress={() => {
                    sfx('click');
                    onBack();
                  }}
                >
                  <Icon name="ui/back-arrow" size={16} color={COLORS.slateCharcoal} noShadow />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
              )}
              <View style={styles.titleBlock}>
                <View style={styles.titleRow}>
                  <Icon name="delapouite/chart" size={22} color={COLORS.slateCharcoal} />
                  <Text style={styles.pageTitle}>NShapes Game Analytics</Text>
                </View>
                <Text style={styles.pageSub}>
                  PostHog #{POSTHOG_PROJECT_ID} · Era {CURRENT_BALANCE_ERA_ID} (v
                  {CURRENT_BALANCE_ERA.minVersion}+) · Stage: {inspector.journeyStage} ·{' '}
                  {inspector.playerCode}
                </Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                testID="analytics-toggle-tracking"
                style={[
                  styles.badgeBtn,
                  inspector.optedOut ? styles.badgeOff : styles.badgeOn,
                ]}
                onPress={handleToggleTracking}
              >
                <Text style={styles.badgeBtnText}>
                  {inspector.optedOut ? 'Tracking: Off' : 'Tracking: On'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="analytics-flush-btn"
                style={styles.smallBtn}
                onPress={() => {
                  void handleFlush();
                }}
              >
                <Text style={styles.smallBtnText}>
                  Flush ({inspector.queuedCount}
                  {inspector.stagedFightId ? '+1' : ''})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {statusMsg && (
            <View style={styles.statusBanner}>
              <Text style={styles.statusText}>{statusMsg}</Text>
              {source === 'local' && inspector.localEvents.length > 0 && (
                <TouchableOpacity onPress={handleClearLocal}>
                  <Text style={styles.clearLink}>Clear local buffer</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.sourceRow}>
            {(
              [
                { id: 'local', label: 'Local Device' },
                { id: 'simulated', label: '60-Player Cohort' },
                { id: 'import', label: 'Import PostHog JSON' },
              ] as { id: DashboardSource; label: string }[]
            ).map(item => {
              const active = source === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  testID={`analytics-source-${item.id}`}
                  style={[styles.sourceBtn, active && styles.sourceBtnActive]}
                  onPress={() => {
                    sfx('click');
                    setSource(item.id);
                    if (item.id === 'local') refreshInspector();
                  }}
                >
                  <Text style={[styles.sourceBtnText, active && styles.sourceBtnTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.filterBar}>
            <TouchableOpacity
              testID="analytics-era-all"
              style={[styles.subPill, eraScope === 'all' && styles.subPillActive]}
              onPress={() => {
                sfx('click');
                setEraScope('all');
              }}
            >
              <Text style={[styles.subPillText, eraScope === 'all' && styles.subPillTextActive]}>
                All Eras
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="analytics-era-current"
              style={[styles.subPill, eraScope === 'current' && styles.subPillActive]}
              onPress={() => {
                sfx('click');
                setEraScope('current');
              }}
            >
              <Text
                style={[styles.subPillText, eraScope === 'current' && styles.subPillTextActive]}
              >
                {CURRENT_BALANCE_ERA_ID} (v{CURRENT_BALANCE_ERA.minVersion}+)
              </Text>
            </TouchableOpacity>
            {(
              [
                { id: 'all', label: 'All Modes' },
                { id: 'adventure', label: 'Adventure' },
                { id: 'spire', label: 'Summit' },
                { id: 'classic', label: 'Classic' },
              ] as { id: FightMode | 'all'; label: string }[]
            ).map(m => {
              const active = modeFilter === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  testID={`analytics-mode-${m.id}`}
                  style={[styles.subPill, active && styles.subPillActive]}
                  onPress={() => {
                    sfx('click');
                    setModeFilter(m.id);
                  }}
                >
                  <Text style={[styles.subPillText, active && styles.subPillTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              testID="analytics-hygiene-toggle"
              style={[styles.subPill, hygiene === 'prod_clean' && styles.subPillActive]}
              onPress={() => {
                sfx('click');
                setHygiene(prev => (prev === 'off' ? 'prod_clean' : 'off'));
              }}
            >
              <Text
                style={[styles.subPillText, hygiene === 'prod_clean' && styles.subPillTextActive]}
              >
                {hygiene === 'prod_clean' ? 'Prod Clean: ON' : 'Prod Clean: OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          {droppedTotal > 0 && (
            <View style={styles.auditBanner} testID="analytics-audit-summary">
              <Text style={styles.auditText}>
                Filtered {audit.keptCount}/{audit.inputCount} fights
                {audit.activeMinVersion ? ` (v${audit.activeMinVersion}+)` : ''}
                {auditDropSummary ? ` · Excluded: ${auditDropSummary}` : ''}
              </Text>
            </View>
          )}

          {source === 'import' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Paste PostHog JSON / HogQL Export</Text>
              <Text style={styles.cardSub}>
                Accepts JSON arrays, NDJSON lines, or PostHog `{`{ results: [...] }`}` exports
              </Text>
              <TextInput
                testID="analytics-import-input"
                style={styles.importInput}
                value={importText}
                onChangeText={setImportText}
                multiline
                placeholder='[{"event":"fight_ended","distinct_id":"...","properties":{...}}]'
                placeholderTextColor="#9A9389"
              />
              {importError && <Text style={styles.errorText}>{importError}</Text>}
              <View style={styles.importActions}>
                <TouchableOpacity
                  testID="analytics-import-apply"
                  style={styles.primaryBtn}
                  onPress={handleApplyImport}
                >
                  <Text style={styles.primaryBtnText}>Parse & Analyze JSON</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBar}
          >
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  testID={`analytics-tab-${t.id}`}
                  style={[styles.tabBtn, active && styles.tabBtnActive]}
                  onPress={() => {
                    sfx('click');
                    setTab(t.id);
                  }}
                >
                  <Icon
                    name={t.icon}
                    size={15}
                    color={active ? COLORS.slateCharcoal : '#6E685F'}
                  />
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {tab === 'overview' && <OverviewTab report={report} chartWidth={chartWidth} />}
          {tab === 'funnel' && <FunnelTab report={report} chartWidth={chartWidth} />}
          {tab === 'balance' && <BalanceTab report={report} chartWidth={chartWidth} />}
          {tab === 'enjoyment' && <EnjoymentTab report={report} chartWidth={chartWidth} />}
          {tab === 'posthog' && <PostHogTab />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 820,
    gap: 12,
  },
  topHeader: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    padding: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.button,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.paperBeige,
  },
  backText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
  },
  titleBlock: {
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.slateCharcoal,
  },
  pageSub: {
    fontSize: 11,
    color: '#6E685F',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  badgeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
  },
  badgeOn: {
    backgroundColor: '#DCF5F2',
  },
  badgeOff: {
    backgroundColor: '#FFE1DE',
  },
  badgeBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.actionYellow,
  },
  smallBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
  },
  statusBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.button,
    backgroundColor: '#E8F7F5',
    borderWidth: 1,
    borderColor: COLORS.logicTeal,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0B6B5F',
  },
  clearLink: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textDecorationLine: 'underline',
  },
  sourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  auditBanner: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.button,
    backgroundColor: '#FFF5E0',
    borderWidth: 1,
    borderColor: '#D69A32',
  },
  auditText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7A4E00',
  },
  sourceBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.button,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.canvasWhite,
  },
  sourceBtnActive: {
    backgroundColor: COLORS.actionYellow,
  },
  sourceBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5B554D',
  },
  sourceBtnTextActive: {
    color: COLORS.slateCharcoal,
    fontWeight: '900',
  },
  tabBar: {
    gap: 8,
    paddingVertical: 2,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.canvasWhite,
  },
  tabBtnActive: {
    backgroundColor: COLORS.actionYellow,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6E685F',
  },
  tabLabelActive: {
    color: COLORS.slateCharcoal,
    fontWeight: '900',
  },
  sectionStack: {
    gap: 12,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    flexGrow: 1,
    flexBasis: 165,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    padding: 12,
    gap: 4,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#6E685F',
  },
  kpiValue: {
    fontSize: 21,
    fontWeight: '900',
    color: COLORS.slateCharcoal,
  },
  kpiHint: {
    fontSize: 11,
    color: '#6E685F',
  },
  card: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    padding: 12,
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
  },
  cardSub: {
    fontSize: 11,
    color: '#6E685F',
  },
  stageRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stageChip: {
    flexGrow: 1,
    flexBasis: 125,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    padding: 8,
    gap: 2,
  },
  stageName: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.slateCharcoal,
  },
  stageCount: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
  },
  stageMeta: {
    fontSize: 10,
    color: '#6E685F',
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: '#ECE7DF',
  },
  listMain: {
    flex: 1,
    gap: 2,
  },
  listRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  inlineTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  rowStrong: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
  },
  rowMeta: {
    fontSize: 11,
    color: '#6E685F',
  },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '900',
  },
  wallAlert: {
    padding: 9,
    borderRadius: RADIUS.button,
    backgroundColor: '#FFF7F4',
    borderWidth: 1,
    borderColor: '#F3B4AA',
    gap: 4,
  },
  wallHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  subPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    backgroundColor: COLORS.canvasWhite,
  },
  subPillActive: {
    backgroundColor: COLORS.slateCharcoal,
  },
  subPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
  },
  subPillTextActive: {
    color: COLORS.canvasWhite,
  },
  tagStatRow: {
    gap: 4,
    paddingVertical: 4,
  },
  tagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.paperBeige,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  tileBox: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ECE7DF',
    gap: 5,
  },
  bodyCopy: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.slateCharcoal,
  },
  codeBlock: {
    backgroundColor: COLORS.deepOnyx,
    borderRadius: RADIUS.button,
    padding: 9,
  },
  codeText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    color: COLORS.actionYellow,
  },
  importInput: {
    minHeight: 88,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    borderRadius: RADIUS.button,
    padding: 10,
    fontSize: 12,
    color: COLORS.slateCharcoal,
    backgroundColor: '#FAF7F2',
    textAlignVertical: 'top',
  },
  importActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  primaryBtn: {
    backgroundColor: COLORS.actionYellow,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    borderRadius: RADIUS.button,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  primaryBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.slateCharcoal,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.impactRed,
  },
  emptyNotice: {
    fontSize: 12,
    color: '#6E685F',
    paddingVertical: 8,
  },
  evoGroupCard: {
    borderTopWidth: 1,
    borderTopColor: '#ECE7DF',
    paddingTop: 9,
    gap: 6,
  },
  evoSlotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  evoSlotCell: {
    flexGrow: 1,
    flexBasis: 200,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    padding: 8,
    gap: 3,
  },
  evoSlotEmpty: {
    opacity: 0.55,
  },
  evoSlotTag: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.slateCharcoal,
    letterSpacing: 0.4,
  },
  evoSlotName: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
  },
  evoSlotDelta: {
    fontSize: 12,
    fontWeight: '800',
  },
});
