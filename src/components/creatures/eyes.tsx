import React from 'react';
import { Circle, G, Line, Path } from 'react-native-svg';
import { COLORS } from '@/utils/colors';
import { BlinkStage, GazeOffset } from './types';

/**
 * Resolves the effective 3-step blink stage from either explicit `blinkStage` (`0 | 1 | 2`)
 * or legacy boolean `isBlinking` (`true` → `2`, `false` → `0`) for 100% backward compatibility.
 */
export function resolveBlinkStage(blinkStage?: BlinkStage, isBlinking?: boolean): BlinkStage {
  if (blinkStage !== undefined) return blinkStage;
  return isBlinking ? 2 : 0;
}

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

/** Stage-1 heavy half-closed upper-eyelid sweep with crisp `#383838` upper lid stroke. */
export function HalfBlinkLidEye({
  cx,
  cy,
  r,
  stroke = COLORS.slateCharcoal,
  irisColor = COLORS.slateCharcoal,
  lidFill,
  darkMask = false,
  gazeOffset,
}: Omit<EyeShapeProps, 'stroke'> & {
  stroke?: string;
  irisColor?: string;
  lidFill?: string;
  darkMask?: boolean;
  gazeOffset?: GazeOffset;
}) {
  const { gx, gy } = eyeGazeShift(gazeOffset, r);
  const lidY = cy - r * 0.1;
  const lidControlY = cy + r * 0.22;
  return (
    <G>
      {darkMask && (
        <Path
          d={`M ${cx - r * 1.15} ${lidY} A ${r * 1.15} ${r * 1.05} 0 0 0 ${cx + r * 1.15} ${lidY} Z`}
          fill="#FFFFFF"
        />
      )}
      {/* Lower crescent of the iris peeking beneath the sweeping upper lid */}
      <Path
        d={`M ${cx - r * 0.96 + gx * 0.5} ${lidY + 0.15} A ${r * 0.96} ${r * 0.92} 0 0 0 ${cx + r * 0.96 + gx * 0.5} ${lidY + 0.15} Z`}
        fill={irisColor}
      />
      {/* Tiny lower glint keeps the eye feeling alive during mid-blink travel */}
      <Circle
        cx={cx - r * 0.28 + gx * 0.6}
        cy={cy + r * 0.36 + gy * 0.35}
        r={r * 0.22}
        fill="#FFFFFF"
        opacity={0.9}
      />
      {lidFill && (
        <Path
          d={`M ${cx - r * 1.18} ${lidY} A ${r * 1.18} ${r * 1.05} 0 0 1 ${cx + r * 1.18} ${lidY} Q ${cx} ${lidControlY} ${cx - r * 1.18} ${lidY} Z`}
          fill={lidFill}
        />
      )}
      {/* Crisp sweeping upper eyelid ink arc */}
      <Path
        d={`M ${cx - r * 1.24} ${lidY} Q ${cx} ${lidControlY} ${cx + r * 1.24} ${lidY}`}
        stroke={stroke}
        strokeWidth={2.9}
        strokeLinecap="round"
        fill="none"
      />
    </G>
  );
}

/** Stage-2 fully shut downward eyelid arc. */
export function ShutBlinkEye({
  cx,
  cy,
  r,
  stroke = COLORS.slateCharcoal,
}: Omit<EyeShapeProps, 'stroke'> & { stroke?: string }) {
  return (
    <Path
      d={`M ${cx - r * 1.15} ${cy + 0.45} Q ${cx} ${cy + r * 0.58} ${cx + r * 1.15} ${cy + 0.45}`}
      stroke={stroke}
      strokeWidth={2.8}
      strokeLinecap="round"
      fill="none"
    />
  );
}

export interface BlinkLidEyeProps extends Omit<EyeShapeProps, 'stroke'> {
  stroke?: string;
  /** 3-step upper-eyelid sweep: `0` open (renders `children`), `1` half-lid droop, `2` full shut arc */
  blinkStage?: BlinkStage;
  /** Backward-compatible boolean blink flag (treated as stage `2` when `blinkStage` is omitted) */
  isBlinking?: boolean;
  irisColor?: string;
  lidFill?: string;
  darkMask?: boolean;
  gazeOffset?: GazeOffset;
  /** Open-eye artwork rendered when resolved blink stage is `0` */
  children?: React.ReactNode;
}

/**
 * 3-step upper-eyelid sweep primitive (`0` open → `1` heavy half-lid droop → `2` full shut arc)
 * with 100% backward compatibility for boolean `isBlinking`.
 */
export function BlinkLidEye({
  cx,
  cy,
  r,
  stroke = COLORS.slateCharcoal,
  blinkStage,
  isBlinking,
  irisColor = COLORS.slateCharcoal,
  lidFill,
  darkMask = false,
  gazeOffset,
  children,
}: BlinkLidEyeProps) {
  const stage = resolveBlinkStage(blinkStage, isBlinking);
  if (stage === 2) {
    return <ShutBlinkEye cx={cx} cy={cy} r={r} stroke={stroke} />;
  }
  if (stage === 1) {
    return (
      <HalfBlinkLidEye
        cx={cx}
        cy={cy}
        r={r}
        stroke={stroke}
        irisColor={irisColor}
        lidFill={lidFill}
        darkMask={darkMask}
        gazeOffset={gazeOffset}
      />
    );
  }
  return <>{children ?? null}</>;
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
