import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { COLORS, RADIUS } from '@/utils/colors';
import type {
  BalanceRow,
  BalanceStatus,
  FunnelRow,
  RetentionPoint,
  SegmentFunMetric,
} from '../dashboardEngine';

export const STATUS_COLORS: Record<BalanceStatus, { bg: string; fg: string; label: string }> = {
  overpowered: { bg: '#FFE6CE', fg: '#9A4400', label: 'OP' },
  undertuned: { bg: '#FFE1DE', fg: '#A32018', label: 'UNDER' },
  frustrating: { bg: '#FAD4D0', fg: '#8B1A12', label: 'FRUST' },
  crowd_pleaser: { bg: '#DCF5F2', fg: '#0B6B5F', label: 'PLEASER' },
  balanced: { bg: '#EEEAE3', fg: COLORS.slateCharcoal, label: 'OK' },
  low_sample: { bg: '#F2F0EC', fg: '#7A756D', label: 'LOW N' },
};

const pct = (value: number | null, digits = 0): string => {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
};

export function RetentionChart({
  data,
  width,
}: {
  data: RetentionPoint[];
  width: number;
}) {
  const chartW = Math.max(260, width);
  const chartH = 156;
  const padL = 32;
  const padR = 12;
  const padT = 18;
  const padB = 34;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const stepW = data.length > 0 ? plotW / data.length : plotW;
  const barW = Math.min(36, Math.max(16, stepW * 0.56));

  return (
    <View style={styles.chartCard} testID="analytics-retention-chart">
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Cohort Retention Curve (D0 → D30)</Text>
        <Text style={styles.chartSubtitle}>Eligible players returning on day N+</Text>
      </View>
      <Svg width={chartW} height={chartH}>
        {[0, 0.25, 0.5, 0.75, 1].map(tick => {
          const y = padT + plotH * (1 - tick);
          return (
            <React.Fragment key={tick}>
              <Line
                x1={padL}
                y1={y}
                x2={chartW - padR}
                y2={y}
                stroke="#E5DFD5"
                strokeWidth={1}
              />
              <SvgText
                x={padL - 5}
                y={y + 3}
                fontSize={9}
                fill="#767067"
                textAnchor="end"
              >
                {`${Math.round(tick * 100)}%`}
              </SvgText>
            </React.Fragment>
          );
        })}
        {data.map((pt, idx) => {
          const h = Math.max(2, pt.rate * plotH);
          const x = padL + idx * stepW + (stepW - barW) / 2;
          const y = padT + plotH - h;
          const fill =
            pt.eligiblePlayers === 0
              ? '#D7D1C7'
              : pt.day === 0
                ? COLORS.slateCharcoal
                : pt.rate >= 0.35
                  ? COLORS.logicTeal
                  : COLORS.impactOrange;
          return (
            <React.Fragment key={pt.label}>
              <Rect x={x} y={y} width={barW} height={h} rx={4} fill={fill} />
              <SvgText
                x={x + barW / 2}
                y={Math.max(11, y - 4)}
                fontSize={9}
                fontWeight="700"
                fill={COLORS.slateCharcoal}
                textAnchor="middle"
              >
                {pt.eligiblePlayers > 0 ? pct(pt.rate) : '—'}
              </SvgText>
              <SvgText
                x={x + barW / 2}
                y={chartH - 15}
                fontSize={10}
                fontWeight="700"
                fill={COLORS.slateCharcoal}
                textAnchor="middle"
              >
                {pt.label}
              </SvgText>
              <SvgText
                x={x + barW / 2}
                y={chartH - 4}
                fontSize={8}
                fill="#767067"
                textAnchor="middle"
              >
                {`${pt.retainedPlayers}/${pt.eligiblePlayers}`}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

export function CampaignFunnelChart({
  rows,
  width,
}: {
  rows: FunnelRow[];
  width: number;
}) {
  const visible = rows.slice(0, 18);
  const chartW = Math.max(260, width);
  const chartH = 166;
  const padL = 32;
  const padR = 10;
  const padT = 18;
  const padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const stepW = visible.length > 0 ? plotW / visible.length : plotW;
  const barW = Math.max(8, Math.min(24, stepW * 0.65));

  return (
    <View style={styles.chartCard} testID="analytics-funnel-chart">
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Level Reach & Churn Walls</Text>
        <Text style={styles.chartSubtitle}>Orange / Red = high churn wall score</Text>
      </View>
      <Svg width={chartW} height={chartH}>
        {[0, 0.5, 1].map(tick => {
          const y = padT + plotH * (1 - tick);
          return (
            <React.Fragment key={tick}>
              <Line
                x1={padL}
                y1={y}
                x2={chartW - padR}
                y2={y}
                stroke="#E5DFD5"
                strokeWidth={1}
              />
              <SvgText x={padL - 5} y={y + 3} fontSize={9} fill="#767067" textAnchor="end">
                {`${Math.round(tick * 100)}%`}
              </SvgText>
            </React.Fragment>
          );
        })}
        {visible.map((row, idx) => {
          const ratio = Math.max(0, Math.min(1, row.funnelPct));
          const h = Math.max(3, ratio * plotH);
          const x = padL + idx * stepW + (stepW - barW) / 2;
          const y = padT + plotH - h;
          const fill =
            row.churnWallScore >= 40
              ? COLORS.impactRed
              : row.churnWallScore >= 25
                ? COLORS.impactOrange
                : COLORS.logicTeal;
          return (
            <React.Fragment key={row.levelId}>
              <Rect x={x} y={y} width={barW} height={h} rx={3} fill={fill} />
              {(idx % 2 === 0 || visible.length <= 10) && (
                <SvgText
                  x={x + barW / 2}
                  y={chartH - 8}
                  fontSize={8}
                  fontWeight="700"
                  fill={COLORS.slateCharcoal}
                  textAnchor="middle"
                >
                  {row.levelId}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

export function BalanceQuadrantChart({
  rows,
  overallFunRate,
  width,
}: {
  rows: BalanceRow[];
  overallFunRate: number | null;
  width: number;
}) {
  const plottable = rows.filter(
    r => r.adjustedWinDelta !== null && r.funRate !== null && r.decidedCount >= 3
  );
  const chartW = Math.max(260, width);
  const chartH = 210;
  const padL = 38;
  const padR = 18;
  const padT = 20;
  const padB = 34;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const funMid = overallFunRate ?? 0.65;
  const midX = padL + plotW * 0.5;
  const midY = padT + plotH * (1 - funMid);

  return (
    <View style={styles.chartCard} testID="analytics-balance-chart">
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Power Δ vs. Enjoyment Quadrant</Text>
        <Text style={styles.chartSubtitle}>
          X: Level-adjusted Win Δ (-25% to +25%) • Y: Fun Rate (0–100%)
        </Text>
      </View>
      {plottable.length === 0 ? (
        <Text style={styles.emptyText}>
          Need at least 3 decided & rated fights per item to plot quadrant outliers.
        </Text>
      ) : (
        <Svg width={chartW} height={chartH}>
          <Rect
            x={padL}
            y={padT}
            width={plotW}
            height={plotH}
            fill="#FAF7F2"
            stroke="#E5DFD5"
            strokeWidth={1}
          />
          <Line
            x1={midX}
            y1={padT}
            x2={midX}
            y2={padT + plotH}
            stroke="#9E978B"
            strokeWidth={1}
            strokeDasharray="4,4"
          />
          <Line
            x1={padL}
            y1={midY}
            x2={padL + plotW}
            y2={midY}
            stroke="#9E978B"
            strokeWidth={1}
            strokeDasharray="4,4"
          />
          <SvgText x={padL + 6} y={padT + 12} fontSize={9} fill="#0B6B5F" fontWeight="700">
            Fun Underdog
          </SvgText>
          <SvgText
            x={padL + plotW - 6}
            y={padT + 12}
            fontSize={9}
            fill="#9A4400"
            fontWeight="700"
            textAnchor="end"
          >
            OP Watch
          </SvgText>
          <SvgText
            x={padL + 6}
            y={padT + plotH - 6}
            fontSize={9}
            fill="#A32018"
            fontWeight="700"
          >
            Weak & Unfun
          </SvgText>
          <SvgText
            x={padL + plotW - 6}
            y={padT + plotH - 6}
            fontSize={9}
            fill="#8B1A12"
            fontWeight="700"
            textAnchor="end"
          >
            Stale / Frustrating
          </SvgText>
          <SvgText x={padL} y={chartH - 10} fontSize={9} fill="#767067">
            -25% Win Δ
          </SvgText>
          <SvgText x={midX} y={chartH - 10} fontSize={9} fill="#767067" textAnchor="middle">
            0% Balanced
          </SvgText>
          <SvgText x={padL + plotW} y={chartH - 10} fontSize={9} fill="#767067" textAnchor="end">
            +25% Win Δ
          </SvgText>
          {plottable.map((row, idx) => {
            const clampedDelta = Math.max(-0.25, Math.min(0.25, row.adjustedWinDelta ?? 0));
            const xNorm = (clampedDelta + 0.25) / 0.5;
            const yNorm = Math.max(0, Math.min(1, row.funRate ?? 0.5));
            const cx = padL + xNorm * plotW;
            const cy = padT + plotH * (1 - yNorm);
            const r = Math.max(5, Math.min(11, Math.sqrt(row.usedCount) * 1.15));
            const statusStyle = STATUS_COLORS[row.status];
            const showLabel = row.status !== 'balanced' || idx < 3;
            return (
              <React.Fragment key={row.id}>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={statusStyle.fg}
                  fillOpacity={0.82}
                  stroke={COLORS.canvasWhite}
                  strokeWidth={1.5}
                />
                {showLabel && (
                  <SvgText
                    x={cx}
                    y={Math.max(padT + 10, cy - r - 3)}
                    fontSize={8}
                    fontWeight="700"
                    fill={COLORS.slateCharcoal}
                    textAnchor="middle"
                  >
                    {row.name.slice(0, 13)}
                  </SvgText>
                )}
              </React.Fragment>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

export function SegmentFunChart({
  segments,
  width,
}: {
  segments: SegmentFunMetric[];
  width: number;
}) {
  const chartW = Math.max(260, width);
  const labelW = Math.min(148, chartW * 0.44);
  const rowH = 26;
  const chartH = Math.max(80, segments.length * rowH + 12);
  const barMaxW = Math.max(80, chartW - labelW - 56);

  return (
    <View style={styles.chartCard} testID="analytics-enjoyment-chart">
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Fun Rate by Experience Segment</Text>
        <Text style={styles.chartSubtitle}>% of 👍 ratings inside each gameplay condition</Text>
      </View>
      <Svg width={chartW} height={chartH}>
        {segments.map((seg, idx) => {
          const y = 8 + idx * rowH;
          const rate = seg.funRate ?? 0;
          const w = seg.sample > 0 ? Math.max(4, rate * barMaxW) : 0;
          const fill =
            seg.sample === 0
              ? '#D7D1C7'
              : rate >= 0.7
                ? COLORS.logicTeal
                : rate >= 0.5
                  ? COLORS.impactOrange
                  : COLORS.impactRed;
          return (
            <React.Fragment key={seg.label}>
              <SvgText
                x={labelW - 6}
                y={y + 13}
                fontSize={10}
                fontWeight="600"
                fill={COLORS.slateCharcoal}
                textAnchor="end"
              >
                {seg.label}
              </SvgText>
              <Rect
                x={labelW}
                y={y + 3}
                width={barMaxW}
                height={14}
                rx={4}
                fill={COLORS.paperBeige}
              />
              {w > 0 && <Rect x={labelW} y={y + 3} width={w} height={14} rx={4} fill={fill} />}
              <SvgText
                x={labelW + barMaxW + 6}
                y={y + 13}
                fontSize={10}
                fontWeight="700"
                fill={COLORS.slateCharcoal}
              >
                {seg.sample > 0 ? `${pct(seg.funRate)} (${seg.sample})` : '—'}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    padding: 12,
    gap: 8,
  },
  chartHeader: {
    gap: 2,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
  },
  chartSubtitle: {
    fontSize: 11,
    color: '#6E685F',
  },
  emptyText: {
    fontSize: 12,
    color: '#6E685F',
    paddingVertical: 16,
    textAlign: 'center',
  },
});
