import React from 'react';
import { Circle, Ellipse, G, Line, Path } from 'react-native-svg';
import {
  CrescentEye,
  KoCrossEye,
  SleepyLidEye,
  WinceChevronEye,
  eyeGazeShift,
} from '@/components/creatures/eyes';
import { GazeOffset } from '@/components/creatures/types';
import { COLORS } from '@/utils/colors';
import { EnemyExpression } from '@/utils/enemyAnimations';

interface EnemyEyesProps {
  expression: EnemyExpression;
  leftX?: number;
  rightX?: number;
  y?: number;
  radius?: number;
  gazeOffset?: GazeOffset;
  /** Gleaming iris color (e.g. amber, crimson, emerald, violet) */
  irisColor?: string;
  /** Whether eyes sit over a dark mask/body and need crisp white/pale sclera */
  darkMask?: boolean;
  /** Eye anatomy variant: standard pair, single central cyclops eye, or 8-eye spider cluster */
  variant?: 'pair' | 'cyclops' | 'spider';
  /** Reptilian/feline vertical slit pupil */
  slitPupil?: boolean;
}

/**
 * Expressive NShapes-styled cartoon enemy eyes in 0..100 SVG space.
 * Supports corneal highlight parallax, menacing brows, evil grins, pain winces, KO X's,
 * single-eye Cyclops/Shadow rigs, and multi-eye Spider rigs.
 */
export const EnemyEyes: React.FC<EnemyEyesProps> = ({
  expression,
  leftX = 38.5,
  rightX = 61.5,
  y = 43,
  radius = 4.6,
  gazeOffset,
  irisColor = '#D97706',
  darkMask = false,
  variant = 'pair',
  slitPupil = false,
}) => {
  const strokeColor = darkMask ? '#FFFFFF' : COLORS.slateCharcoal;
  const { gx, gy, hx, hy } = eyeGazeShift(gazeOffset, radius);

  const renderEyeAt = (cx: number, cy: number, r: number, side: 'left' | 'right' | 'center') => {
    const dir = side === 'right' ? 1 : side === 'left' ? -1 : 0;

    switch (expression) {
      case 'blink':
        return (
          <Path
            d={`M ${cx - r * 1.15} ${cy + 0.4} Q ${cx} ${cy + r * 0.5} ${cx + r * 1.15} ${cy + 0.4}`}
            stroke={strokeColor}
            strokeWidth={2.7}
            strokeLinecap="round"
            fill="none"
          />
        );

      case 'wince':
        if (side !== 'center') {
          return <WinceChevronEye cx={cx} cy={cy} r={r} stroke={strokeColor} side={side} />;
        }
        return (
          <G>
            <Path
              d={`M ${cx - r * 1.2} ${cy - r * 0.7} L ${cx} ${cy + r * 0.2} L ${cx + r * 1.2} ${cy - r * 0.7}`}
              stroke={strokeColor}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d={`M ${cx - r * 1.1} ${cy + r * 0.75} L ${cx} ${cy + 0.1} L ${cx + r * 1.1} ${cy + r * 0.75}`}
              stroke={strokeColor}
              strokeWidth={2.8}
              strokeLinecap="round"
              fill="none"
            />
          </G>
        );

      case 'ko':
        return <KoCrossEye cx={cx} cy={cy} r={r} backingRadius={darkMask ? r * 1.22 : undefined} />;

      case 'wicked_glee':
        // Sinister smug crescent eyes with sharp inner slant!
        return (
          <G>
            <CrescentEye cx={cx} cy={cy} r={r} stroke={strokeColor} />
            {dir !== 0 && (
              <Line
                x1={cx - dir * r * 1.1}
                y1={cy - r * 0.65}
                x2={cx + dir * r * 1.15}
                y2={cy - r * 1.4}
                stroke={strokeColor}
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            )}
          </G>
        );

      case 'sleepy':
        return <SleepyLidEye cx={cx} cy={cy} r={r} stroke={strokeColor} irisColor={irisColor} />;

      case 'startled':
        return (
          <G>
            <Circle cx={cx} cy={cy} r={r * 1.26} fill="#FFFFFF" stroke={COLORS.slateCharcoal} strokeWidth={2.3} />
            <Circle cx={cx + gx * 1.1} cy={cy + gy * 1.1} r={r * 0.48} fill={COLORS.slateCharcoal} />
            <Circle cx={cx - r * 0.28 + hx} cy={cy - r * 0.28 + hy} r={r * 0.24} fill="#FFFFFF" />
          </G>
        );

      case 'bruised_grit':
        if (side === 'right') {
          return (
            <G>
              <Ellipse cx={cx + 0.5} cy={cy + 0.5} rx={r * 1.4} ry={r * 1.15} fill="#7C3AED" opacity={0.34} />
              <Path
                d={`M ${cx + r * 1.1} ${cy - r * 0.72} L ${cx - r * 0.85} ${cy + 0.2} L ${cx + r * 1.1} ${cy + r * 0.82}`}
                stroke={strokeColor}
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </G>
          );
        }
        // Fall through to fierce glare on left/center eye
        return (
          <G>
            <Circle cx={cx} cy={cy} r={r * 1.15} fill="#FFFFFF" stroke={COLORS.slateCharcoal} strokeWidth={2.1} />
            <Circle cx={cx + gx} cy={cy + gy} r={r * 0.76} fill={irisColor} />
            <Circle cx={cx + gx} cy={cy + gy} r={r * 0.36} fill={COLORS.deepOnyx} />
            <Circle cx={cx - r * 0.28 + hx} cy={cy - r * 0.3 + hy} r={r * 0.3} fill="#FFFFFF" />
            <Line
              x1={cx - (dir || -1) * r * 1.15}
              y1={cy - r * 0.65}
              x2={cx + (dir || -1) * r * 1.2}
              y2={cy - r * 1.38}
              stroke={strokeColor}
              strokeWidth={2.8}
              strokeLinecap="round"
            />
          </G>
        );

      case 'enraged': {
        const glowColor = '#EF4444';
        return (
          <G>
            <Circle cx={cx} cy={cy} r={r * 1.24} fill="#FEF2F2" stroke={COLORS.slateCharcoal} strokeWidth={2.3} />
            <Circle cx={cx + gx} cy={cy + gy} r={r * 0.86} fill={glowColor} />
            {slitPupil ? (
              <Ellipse cx={cx + gx} cy={cy + gy} rx={r * 0.22} ry={r * 0.72} fill={COLORS.deepOnyx} />
            ) : (
              <Circle cx={cx + gx} cy={cy + gy} r={r * 0.38} fill={COLORS.deepOnyx} />
            )}
            <Circle cx={cx - r * 0.3 + hx} cy={cy - r * 0.32 + hy} r={r * 0.34} fill="#FFFBEB" />
            {dir !== 0 ? (
              <Line
                x1={cx - dir * r * 1.2}
                y1={cy - r * 0.55}
                x2={cx + dir * r * 1.28}
                y2={cy - r * 1.5}
                stroke={strokeColor}
                strokeWidth={3}
                strokeLinecap="round"
              />
            ) : (
              <Path
                d={`M ${cx - r * 1.35} ${cy - r * 1.35} L ${cx} ${cy - r * 0.75} L ${cx + r * 1.35} ${cy - r * 1.35}`}
                stroke={strokeColor}
                strokeWidth={2.9}
                strokeLinecap="round"
                fill="none"
              />
            )}
          </G>
        );
      }

      case 'menacing':
      default:
        return (
          <G>
            <Circle cx={cx} cy={cy} r={r * 1.15} fill="#FFFFFF" stroke={COLORS.slateCharcoal} strokeWidth={2.1} />
            <Circle cx={cx + gx} cy={cy + gy} r={r * 0.78} fill={irisColor} />
            {slitPupil ? (
              <Ellipse cx={cx + gx} cy={cy + gy} rx={r * 0.22} ry={r * 0.68} fill={COLORS.deepOnyx} />
            ) : (
              <Circle cx={cx + gx} cy={cy + gy} r={r * 0.42} fill={COLORS.deepOnyx} />
            )}
            <Circle cx={cx - r * 0.28 + hx} cy={cy - r * 0.3 + hy} r={r * 0.32} fill="#FFFFFF" />
            {dir !== 0 && (
              <Line
                x1={cx - dir * r * 1.12}
                y1={cy - r * 0.72}
                x2={cx + dir * r * 1.18}
                y2={cy - r * 1.35}
                stroke={strokeColor}
                strokeWidth={2.6}
                strokeLinecap="round"
              />
            )}
          </G>
        );
    }
  };

  if (variant === 'cyclops') {
    const centerX = (leftX + rightX) / 2;
    return <G>{renderEyeAt(centerX, y, radius * 1.65, 'center')}</G>;
  }

  if (variant === 'spider') {
    return (
      <G>
        {renderEyeAt(leftX, y, radius * 0.92, 'left')}
        {renderEyeAt(rightX, y, radius * 0.92, 'right')}
        {/* Secondary arachnid side eyes */}
        <Circle cx={leftX - radius * 1.65} cy={y - radius * 0.55} r={radius * 0.48} fill={irisColor} stroke={COLORS.slateCharcoal} strokeWidth={1.5} />
        <Circle cx={rightX + radius * 1.65} cy={y - radius * 0.55} r={radius * 0.48} fill={irisColor} stroke={COLORS.slateCharcoal} strokeWidth={1.5} />
        <Circle cx={leftX - radius * 1.45} cy={y + radius * 0.75} r={radius * 0.36} fill={irisColor} stroke={COLORS.slateCharcoal} strokeWidth={1.3} />
        <Circle cx={rightX + radius * 1.45} cy={y + radius * 0.75} r={radius * 0.36} fill={irisColor} stroke={COLORS.slateCharcoal} strokeWidth={1.3} />
      </G>
    );
  }

  return (
    <G>
      {renderEyeAt(leftX, y, radius, 'left')}
      {renderEyeAt(rightX, y, radius, 'right')}
    </G>
  );
};
