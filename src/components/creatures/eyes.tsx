import React from 'react';
import { Circle, G, Line, Path } from 'react-native-svg';
import { COLORS } from '@/utils/colors';
import { GazeOffset } from './types';

/**
 * Pixel shift of the iris (`gx`, `gy`) and of the corneal highlight (`hx`, `hy`) for a gaze.
 * The highlight travels slightly farther than the iris, which reads as a spherical eye.
 */
export function eyeGazeShift(gazeOffset: GazeOffset | undefined, radius: number) {
  const gx = (gazeOffset?.x ?? 0) * radius * 0.34;
  const gy = (gazeOffset?.y ?? 0) * radius * 0.28;
  return { gx, gy, hx: gx * 1.24, hy: gy * 1.24 };
}

interface EyeShapeProps {
  cx: number;
  cy: number;
  r: number;
  stroke: string;
}

/** Pain chevron: `>` for the left eye, `<` for the right. */
export function WinceChevronEye({ cx, cy, r, stroke, side }: EyeShapeProps & { side: 'left' | 'right' }) {
  const dir = side === 'left' ? -1 : 1;
  return (
    <Path
      d={`M ${cx + dir * r * 1.15} ${cy - r * 0.95} L ${cx - dir * r * 0.95} ${cy} L ${cx + dir * r * 1.15} ${cy + r * 0.95}`}
      stroke={stroke}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

/** Knocked-out `X` eye, with a white backing disc of `backingRadius` when drawn on a dark mask. */
export function KoCrossEye({ cx, cy, r, backingRadius }: Omit<EyeShapeProps, 'stroke'> & { backingRadius?: number }) {
  return (
    <G>
      {backingRadius !== undefined && <Circle cx={cx} cy={cy} r={backingRadius} fill="#FFFFFF" />}
      <Line
        x1={cx - r * 0.95}
        y1={cy - r * 0.95}
        x2={cx + r * 0.95}
        y2={cy + r * 0.95}
        stroke={COLORS.slateCharcoal}
        strokeWidth={2.8}
        strokeLinecap="round"
      />
      <Line
        x1={cx + r * 0.95}
        y1={cy - r * 0.95}
        x2={cx - r * 0.95}
        y2={cy + r * 0.95}
        stroke={COLORS.slateCharcoal}
        strokeWidth={2.8}
        strokeLinecap="round"
      />
    </G>
  );
}

/** Heavy half-closed lid over the lower half of the iris. */
export function SleepyLidEye({ cx, cy, r, stroke, irisColor }: EyeShapeProps & { irisColor: string }) {
  return (
    <G>
      <Path
        d={`M ${cx - r * 1.1} ${cy} A ${r * 1.05} ${r * 0.95} 0 0 0 ${cx + r * 1.1} ${cy} Z`}
        fill={irisColor}
      />
      <Line
        x1={cx - r * 1.25}
        y1={cy - 0.3}
        x2={cx + r * 1.25}
        y2={cy - 0.3}
        stroke={stroke}
        strokeWidth={2.8}
        strokeLinecap="round"
      />
    </G>
  );
}

/** Upward `^` crescent: a joyful smile-eye on fighters, a smug one on enemies. */
export function CrescentEye({ cx, cy, r, stroke }: EyeShapeProps) {
  return (
    <Path
      d={`M ${cx - r * 1.2} ${cy + r * 0.45} Q ${cx} ${cy - r * 1.25} ${cx + r * 1.2} ${cy + r * 0.45}`}
      stroke={stroke}
      strokeWidth={3}
      strokeLinecap="round"
      fill="none"
    />
  );
}
