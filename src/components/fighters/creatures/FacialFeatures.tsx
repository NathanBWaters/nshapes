import React from 'react';
import { Circle, Ellipse, G, Line, Path } from 'react-native-svg';
import {
  CrescentEye,
  HalfBlinkLidEye,
  KoCrossEye,
  ShutBlinkEye,
  SleepyLidEye,
  WinceChevronEye,
  eyeGazeShift,
} from '@/components/creatures/eyes';
import { useRigVisual } from '@/components/creatures/RigLayers';
import { BlinkStage, GazeOffset } from '@/components/creatures/types';
import { StarBurst } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { FighterExpression } from '@/utils/fighterAnimations';

interface CreatureEyesProps {
  expression: FighterExpression;
  leftX?: number;
  rightX?: number;
  y?: number;
  radius?: number;
  /** 3-step upper-eyelid sweep (`0` open, `1` half-lid droop, `2` full shut arc) */
  blinkStage?: BlinkStage;
  /** Optional micro-saccade / gaze look offset (`-1..1`) with corneal highlight parallax */
  gazeOffset?: GazeOffset;
  /** Optional override for eye stroke/iris color on dark masks (e.g. Badger/Penguin) */
  irisColor?: string;
  /** Optional upper-eyelid fill tint matching the creature's face fur/plumage during stage-1 half-lid droop */
  lidFill?: string;
  /** Whether the eye sits on a dark background and needs a white sclera backing */
  darkMask?: boolean;
}

/**
 * Renders expressive NShapes-styled cartoon eyes across all 15 FighterExpressions
 * with organic 3-step upper-eyelid blinks (`0` open → `1` heavy half-lid droop → `2` shut arc).
 * Coordinates live in the 0..100 creature viewBox so eyes stay razor-sharp at any pixel size.
 */
export const CreatureEyes: React.FC<CreatureEyesProps> = ({
  expression,
  leftX = 39,
  rightX = 61,
  y = 44,
  radius = 4.6,
  blinkStage = 0,
  gazeOffset,
  irisColor = COLORS.slateCharcoal,
  lidFill,
  darkMask = false,
}) => {
  const { silhouette } = useRigVisual();
  if (silhouette) return null;

  const strokeColor = darkMask ? '#FFFFFF' : COLORS.slateCharcoal;
  const { gx, gy, hx, hy } = eyeGazeShift(gazeOffset, radius);

  const isBlinkable =
    expression === 'normal' ||
    expression === 'determined' ||
    expression === 'eager' ||
    expression === 'aha' ||
    expression === 'bruised_grit' ||
    expression === 'blink';

  const resolvedStage: BlinkStage =
    expression === 'blink' ? 2 : isBlinkable ? blinkStage : 0;

  const renderSingleEye = (cx: number, isRight: boolean) => {
    const dir = isRight ? 1 : -1;

    // Right eye stays in gritty wince during `bruised_grit`; left eye still blinks organically
    const applyBlink = !(expression === 'bruised_grit' && isRight);
    if (applyBlink && resolvedStage === 2) {
      return <ShutBlinkEye cx={cx} cy={y} r={radius} stroke={strokeColor} />;
    }
    if (applyBlink && resolvedStage === 1) {
      return (
        <HalfBlinkLidEye
          cx={cx}
          cy={y}
          r={radius}
          stroke={strokeColor}
          irisColor={irisColor}
          lidFill={lidFill}
          darkMask={darkMask}
          gazeOffset={gazeOffset}
        />
      );
    }

    switch (expression) {
      case 'blink':
        return <ShutBlinkEye cx={cx} cy={y} r={radius} stroke={strokeColor} />;

      case 'happy':
      case 'blush':
        // Joyful upward '^ ^' crescents!
        return <CrescentEye cx={cx} cy={y} r={radius} stroke={strokeColor} />;

      case 'relieved':
        // Left eye happy arc '^', right eye tilted 'phew' wink '~'
        if (!isRight) {
          return (
            <Path
              d={`M ${cx - radius * 1.15} ${y + radius * 0.4} Q ${cx} ${y - radius * 1.05} ${cx + radius * 1.15} ${y + radius * 0.4}`}
              stroke={strokeColor}
              strokeWidth={2.8}
              strokeLinecap="round"
              fill="none"
            />
          );
        }
        return (
          <Path
            d={`M ${cx - radius * 1.2} ${y + 0.5} Q ${cx - radius * 0.4} ${y - radius * 0.7} ${cx + radius * 0.2} ${y + 0.4} Q ${cx + radius * 0.75} ${y + radius * 0.9} ${cx + radius * 1.2} ${y - 0.2}`}
            stroke={strokeColor}
            strokeWidth={2.7}
            strokeLinecap="round"
            fill="none"
          />
        );

      case 'starry':
        return <StarBurst cx={cx} cy={y} outer={radius * 1.45} inner={radius * 0.58} />;

      case 'wince':
        // Sharp '> <' pain chevrons!
        return (
          <WinceChevronEye cx={cx} cy={y} r={radius} stroke={strokeColor} side={isRight ? 'right' : 'left'} />
        );

      case 'ko':
        // Classic cartoon 'X X' / dizzy KO eyes!
        return (
          <KoCrossEye cx={cx} cy={y} r={radius} backingRadius={darkMask ? radius * 1.25 : undefined} />
        );

      case 'panic':
        // Wide white 'O O' eyes with tiny constricted pupils that dart nervously!
        return (
          <G>
            <Circle
              cx={cx}
              cy={y}
              r={radius * 1.28}
              fill="#FFFFFF"
              stroke={COLORS.slateCharcoal}
              strokeWidth={2.4}
            />
            <Circle cx={cx + gx * 1.15} cy={y + gy * 1.15} r={radius * 0.42} fill={COLORS.slateCharcoal} />
          </G>
        );

      case 'sleepy':
        return <SleepyLidEye cx={cx} cy={y} r={radius} stroke={strokeColor} irisColor={irisColor} />;

      case 'sad':
        // Teary droopy eyes + slanted worried brow + glinting tear!
        return (
          <G>
            {darkMask && <Circle cx={cx} cy={y + 0.8} r={radius * 1.2} fill="#FFFFFF" />}
            <Circle cx={cx} cy={y + 0.8} r={radius} fill={irisColor} />
            <Circle cx={cx - radius * 0.3} cy={y - radius * 0.2} r={radius * 0.38} fill="#FFFFFF" />
            <Line
              x1={cx - dir * radius * 1.1}
              y1={y - radius * 1.45}
              x2={cx + dir * radius * 1.2}
              y2={y - radius * 0.75}
              stroke={strokeColor}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            {/* Shimmering teardrop at outer corner */}
            <Circle
              cx={cx + dir * radius * 0.95}
              cy={y + radius * 0.95}
              r={radius * 0.45}
              fill="#38BDF8"
            />
          </G>
        );

      case 'bruised_grit':
        // Right eye squinted in gritty battle wince with shiner; left eye fierce & focused!
        if (isRight) {
          return (
            <G>
              {/* Subtle purple shiner bruise ring */}
              <Ellipse
                cx={cx + 0.6}
                cy={y + 0.6}
                rx={radius * 1.45}
                ry={radius * 1.2}
                fill="#7C3AED"
                opacity={0.32}
              />
              <Path
                d={`M ${cx + radius * 1.1} ${y - radius * 0.75} L ${cx - radius * 0.85} ${y + 0.2} L ${cx + radius * 1.1} ${y + radius * 0.85}`}
                stroke={strokeColor}
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </G>
          );
        }
        return (
          <G>
            {darkMask && <Circle cx={cx} cy={y} r={radius * 1.2} fill="#FFFFFF" />}
            <Circle cx={cx + gx} cy={y + gy} r={radius} fill={irisColor} />
            <Circle cx={cx - radius * 0.32 + hx} cy={y - radius * 0.32 + hy} r={radius * 0.36} fill="#FFFFFF" />
            <Line
              x1={cx - radius * 1.2}
              y1={y - radius * 1.35}
              x2={cx + radius * 1.15}
              y2={y - radius * 0.65}
              stroke={strokeColor}
              strokeWidth={2.8}
              strokeLinecap="round"
            />
          </G>
        );

      case 'determined':
        return (
          <G>
            {darkMask && <Circle cx={cx} cy={y} r={radius * 1.2} fill="#FFFFFF" />}
            <Circle cx={cx + gx} cy={y + gy} r={radius} fill={irisColor} />
            <Circle cx={cx - radius * 0.32 + hx} cy={y - radius * 0.32 + hy} r={radius * 0.36} fill="#FFFFFF" />
            <Line
              x1={cx - dir * radius * 1.15}
              y1={y - radius * 0.7}
              x2={cx + dir * radius * 1.2}
              y2={y - radius * 1.35}
              stroke={strokeColor}
              strokeWidth={2.6}
              strokeLinecap="round"
            />
          </G>
        );

      case 'eager':
      case 'aha': {
        const bigR = radius * 1.16;
        return (
          <G>
            {darkMask && <Circle cx={cx} cy={y} r={bigR * 1.18} fill="#FFFFFF" />}
            <Circle cx={cx + gx} cy={y + gy} r={bigR} fill={irisColor} />
            <Circle cx={cx - bigR * 0.32 + hx} cy={y - bigR * 0.34 + hy} r={bigR * 0.42} fill="#FFFFFF" />
            <Circle cx={cx + bigR * 0.34 + hx * 0.75} cy={y + bigR * 0.3 + hy * 0.75} r={bigR * 0.2} fill="#FFFFFF" />
            {expression === 'aha' && (
              <Line
                x1={cx - radius * 0.9}
                y1={y - radius * 1.55}
                x2={cx + radius * 0.9}
                y2={y - radius * 1.55}
                stroke={strokeColor}
                strokeWidth={2.3}
                strokeLinecap="round"
              />
            )}
          </G>
        );
      }

      case 'normal':
      default:
        return (
          <G>
            {darkMask && <Circle cx={cx} cy={y} r={radius * 1.2} fill="#FFFFFF" />}
            <Circle cx={cx + gx} cy={y + gy} r={radius} fill={irisColor} />
            <Circle cx={cx - radius * 0.32 + hx} cy={y - radius * 0.34 + hy} r={radius * 0.38} fill="#FFFFFF" />
          </G>
        );
    }
  };

  const showBlush =
    expression === 'blush' ||
    expression === 'happy' ||
    expression === 'starry' ||
    expression === 'relieved';

  return (
    <G>
      {renderSingleEye(leftX, false)}
      {renderSingleEye(rightX, true)}
      {showBlush && (
        <G opacity={expression === 'blush' ? 0.72 : 0.45}>
          <Ellipse cx={leftX - radius * 1.25} cy={y + radius * 1.35} rx={radius * 1.05} ry={radius * 0.58} fill="#FF7169" />
          <Ellipse cx={rightX + radius * 1.25} cy={y + radius * 1.35} rx={radius * 1.05} ry={radius * 0.58} fill="#FF7169" />
        </G>
      )}
    </G>
  );
};
