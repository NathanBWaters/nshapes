import React from 'react';
import { Path, Polygon } from 'react-native-svg';
import { COLORS } from '@/utils/colors';

/** Outline ink shared by every hand-drawn creature, weapon and effect. */
export const STROKE = COLORS.slateCharcoal;

interface Sparkle4Props {
  cx: number;
  cy: number;
  r: number;
  fill?: string;
  strokeWidth?: number;
}

/** Four-point concave sparkle. */
export function Sparkle4({ cx, cy, r, fill = COLORS.actionYellow, strokeWidth = 1.4 }: Sparkle4Props) {
  return (
    <Path
      d={`M ${cx} ${cy - r} Q ${cx} ${cy} ${cx + r} ${cy} Q ${cx} ${cy} ${cx} ${cy + r} Q ${cx} ${cy} ${cx - r} ${cy} Q ${cx} ${cy} ${cx} ${cy - r} Z`}
      fill={fill}
      stroke={STROKE}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  );
}

interface StarBurstProps {
  cx: number;
  cy: number;
  /** Tip radius */
  outer: number;
  /** Notch radius */
  inner: number;
  /** Number of tips (5 = classic star, 8 = impact burst) */
  tips?: number;
  fill?: string;
  strokeWidth?: number;
}

/** Outlined star with `tips` points, first tip pointing up. */
export function StarBurst({
  cx,
  cy,
  outer,
  inner,
  tips = 5,
  fill = COLORS.actionYellow,
  strokeWidth = 1.6,
}: StarBurstProps) {
  const pts: string[] = [];
  for (let i = 0; i < tips * 2; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / tips;
    const dist = i % 2 === 0 ? outer : inner;
    pts.push(`${(cx + Math.cos(angle) * dist).toFixed(1)},${(cy + Math.sin(angle) * dist).toFixed(1)}`);
  }
  return (
    <Polygon
      points={pts.join(' ')}
      fill={fill}
      stroke={STROKE}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  );
}
