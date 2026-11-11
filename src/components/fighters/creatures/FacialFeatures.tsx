import React from 'react';
import { Circle, Ellipse, G, Line, Path, Polygon } from 'react-native-svg';
import { COLORS } from '@/utils/colors';
import { FighterExpression } from '@/utils/fighterAnimations';

interface CreatureEyesProps {
  expression: FighterExpression;
  leftX?: number;
  rightX?: number;
  y?: number;
  radius?: number;
  /** Optional override for eye stroke/iris color on dark masks (e.g. Badger/Penguin) */
  irisColor?: string;
  /** Whether the eye sits on a dark background and needs a white sclera backing */
  darkMask?: boolean;
}

/**
 * Draws a crisp 4-point or 5-point star centered at (cx, cy).
 */
function StarEye({ cx, cy, r, fill = COLORS.actionYellow }: { cx: number; cy: number; r: number; fill?: string }) {
  const outer = r * 1.45;
  const inner = r * 0.58;
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const dist = i % 2 === 0 ? outer : inner;
    pts.push(`${(cx + Math.cos(angle) * dist).toFixed(1)},${(cy + Math.sin(angle) * dist).toFixed(1)}`);
  }
  return (
    <Polygon
      points={pts.join(' ')}
      fill={fill}
      stroke={COLORS.slateCharcoal}
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  );
}

/**
 * Renders expressive NShapes-styled cartoon eyes across all 15 FighterExpressions.
 * Coordinates live in the 0..100 creature viewBox so eyes stay razor-sharp at any pixel size.
 */
export const CreatureEyes: React.FC<CreatureEyesProps> = ({
  expression,
  leftX = 39,
  rightX = 61,
  y = 44,
  radius = 4.6,
  irisColor = COLORS.slateCharcoal,
  darkMask = false,
}) => {
  const strokeColor = darkMask ? '#FFFFFF' : COLORS.slateCharcoal;

  const renderSingleEye = (cx: number, isRight: boolean) => {
    const dir = isRight ? 1 : -1;

    switch (expression) {
      case 'blink':
        return (
          <Path
            d={`M ${cx - radius * 1.15} ${y + 0.5} Q ${cx} ${y + radius * 0.55} ${cx + radius * 1.15} ${y + 0.5}`}
            stroke={strokeColor}
            strokeWidth={2.8}
            strokeLinecap="round"
            fill="none"
          />
        );

      case 'happy':
      case 'blush':
        // Joyful upward '^ ^' crescents!
        return (
          <Path
            d={`M ${cx - radius * 1.2} ${y + radius * 0.45} Q ${cx} ${y - radius * 1.25} ${cx + radius * 1.2} ${y + radius * 0.45}`}
            stroke={strokeColor}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
        );

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
        return <StarEye cx={cx} cy={y} r={radius} />;

      case 'wince':
        // Sharp '> <' pain chevrons!
        if (!isRight) {
          return (
            <Path
              d={`M ${cx - radius * 1.15} ${y - radius * 0.95} L ${cx + radius * 0.95} ${y} L ${cx - radius * 1.15} ${y + radius * 0.95}`}
              stroke={strokeColor}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          );
        }
        return (
          <Path
            d={`M ${cx + radius * 1.15} ${y - radius * 0.95} L ${cx - radius * 0.95} ${y} L ${cx + radius * 1.15} ${y + radius * 0.95}`}
            stroke={strokeColor}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        );

      case 'ko':
        // Classic cartoon 'X X' / dizzy KO eyes!
        return (
          <G>
            {darkMask && <Circle cx={cx} cy={y} r={radius * 1.25} fill="#FFFFFF" />}
            <Line
              x1={cx - radius * 0.95}
              y1={y - radius * 0.95}
              x2={cx + radius * 0.95}
              y2={y + radius * 0.95}
              stroke={COLORS.slateCharcoal}
              strokeWidth={2.8}
              strokeLinecap="round"
            />
            <Line
              x1={cx + radius * 0.95}
              y1={y - radius * 0.95}
              x2={cx - radius * 0.95}
              y2={y + radius * 0.95}
              stroke={COLORS.slateCharcoal}
              strokeWidth={2.8}
              strokeLinecap="round"
            />
          </G>
        );

      case 'panic':
        // Wide white 'O O' eyes with tiny constricted pupils!
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
            <Circle cx={cx} cy={y} r={radius * 0.42} fill={COLORS.slateCharcoal} />
          </G>
        );

      case 'sleepy':
        // Heavy half-closed lids!
        return (
          <G>
            <Path
              d={`M ${cx - radius * 1.1} ${y} A ${radius * 1.05} ${radius * 0.95} 0 0 0 ${cx + radius * 1.1} ${y} Z`}
              fill={irisColor}
            />
            <Line
              x1={cx - radius * 1.25}
              y1={y - 0.3}
              x2={cx + radius * 1.25}
              y2={y - 0.3}
              stroke={strokeColor}
              strokeWidth={2.8}
              strokeLinecap="round"
            />
          </G>
        );

      case 'sad':
        // Teary droopy eyes + slanted worried brow + glinting tear!
        return (
          <G>
            {darkMask && <Circle cx={cx} cy={y + 0.8} r={radius * 1.2} fill="#FFFFFF" />}
            <Circle cx={cx} cy={y + 0.8} r={radius} fill={irisColor} />
            <Circle cx={cx - radius * 0.3} cy={y - radius * 0.2} r={radius * 0.38} fill="#FFFFFF" />
            {/* Worried outer-slanted brow */}
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
            <Circle cx={cx} cy={y} r={radius} fill={irisColor} />
            <Circle cx={cx - radius * 0.32} cy={y - radius * 0.32} r={radius * 0.36} fill="#FFFFFF" />
            {/* Fierce angled brow */}
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
            <Circle cx={cx} cy={y} r={radius} fill={irisColor} />
            <Circle cx={cx - radius * 0.32} cy={y - radius * 0.32} r={radius * 0.36} fill="#FFFFFF" />
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
            <Circle cx={cx} cy={y} r={bigR} fill={irisColor} />
            {/* Double catchlight sparkle! */}
            <Circle cx={cx - bigR * 0.32} cy={y - bigR * 0.34} r={bigR * 0.42} fill="#FFFFFF" />
            <Circle cx={cx + bigR * 0.34} cy={y + bigR * 0.3} r={bigR * 0.2} fill="#FFFFFF" />
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
            <Circle cx={cx} cy={y} r={radius} fill={irisColor} />
            <Circle cx={cx - radius * 0.32} cy={y - radius * 0.34} r={radius * 0.38} fill="#FFFFFF" />
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
