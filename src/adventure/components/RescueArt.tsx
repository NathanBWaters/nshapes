/**
 * Shared custom SVG artwork for the Angry Birds 2–style Golden Rescue Keys
 * and iron friend cages (used across AdventureMap, StoryIntro, FriendRescueModal, and Camp).
 */
import React from 'react';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { COLORS } from '@/utils/colors';

const INK = COLORS.slateCharcoal;

/**
 * Chunky retro-modern beveled Golden Rescue Key with NShapes ink outlines.
 * Renders in rich burnished gold when active, or cool silver-pewter when `dimmed`.
 */
export const GoldenKeyArt: React.FC<{
  size?: number;
  dimmed?: boolean;
}> = ({ size = 34, dimmed = false }) => {
  const fillMain = dimmed ? '#D4CFC7' : '#FFDE00';
  const fillMid = dimmed ? '#B9B2A7' : '#F5B800';
  const fillDeep = dimmed ? '#968E83' : '#C98A00';
  const highlight = dimmed ? '#EFECE6' : '#FFF9CC';
  const stroke = dimmed ? '#6E6860' : INK;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" pointerEvents="none">
      {/* Slight diagonal heroic angle inside the 64×64 box */}
      <G transform="rotate(-38 32 32)">
        {/* Shadow / bevel back-layer */}
        <Rect x={26} y={29} width={29} height={9} rx={4} fill={fillDeep} stroke={stroke} strokeWidth={3.2} />
        {/* Key teeth (ward) */}
        <Path
          d="M 41 36 L 41 47 L 46 47 L 46 42 L 49 42 L 49 49 L 55 49 L 55 36 Z"
          fill={fillMid}
          stroke={stroke}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        {/* Main shaft */}
        <Rect x={24} y={27} width={32} height={9} rx={4.5} fill={fillMain} stroke={stroke} strokeWidth={3.2} />
        {/* Shaft specular gleam */}
        <Line x1={29} y1={30} x2={51} y2={30} stroke={highlight} strokeWidth={2} strokeLinecap="round" />

        {/* Collar ring where bow meets shaft */}
        <Rect x={25} y={24} width={6} height={15} rx={2.5} fill={fillMid} stroke={stroke} strokeWidth={3} />

        {/* Ornate circular bow */}
        <Circle cx={16} cy={31.5} r={13} fill={fillMain} stroke={stroke} strokeWidth={3.4} />
        {/* Inner shadow ring */}
        <Circle cx={16} cy={31.5} r={8.5} fill="none" stroke={fillMid} strokeWidth={2.5} />
        {/* Bow specular crescent */}
        <Path
          d="M 8 25 A 10 10 0 0 1 20 21.5"
          fill="none"
          stroke={highlight}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        {/* Cutout keyhole inside bow */}
        <Circle cx={16} cy={31.5} r={5.2} fill={dimmed ? '#E9E4DC' : '#FFF6C2'} stroke={stroke} strokeWidth={2.6} />
      </G>
    </Svg>
  );
};

/**
 * Forged iron cage overlay for trapped friends.
 * `side="full"` renders the complete cage; `"left"` and `"right"` render split
 * halves so the cage can burst cleanly apart on unlock.
 */
export const CageBarsSvg: React.FC<{
  width: number;
  height: number;
  side?: 'full' | 'left' | 'right';
}> = ({ width, height, side = 'full' }) => {
  const barFill = '#4B5563';
  const barLight = '#9CA3AF';
  const barStroke = '#111827';

  // Bar x positions in normalized 120×120 viewBox
  const allBars = [18, 39, 60, 81, 102];
  const bars =
    side === 'left' ? [18, 39]
      : side === 'right' ? [81, 102]
        : allBars;

  return (
    <Svg width={width} height={height} viewBox="0 0 120 120" pointerEvents="none">
      {/* Top arched crown */}
      {side === 'full' && (
        <>
          <Path
            d="M 10 26 Q 60 2 110 26 L 110 34 Q 60 12 10 34 Z"
            fill={barFill}
            stroke={barStroke}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Circle cx={60} cy={10} r={6} fill="none" stroke={barFill} strokeWidth={4} />
          <Circle cx={60} cy={10} r={6} fill="none" stroke={barStroke} strokeWidth={1.6} />
        </>
      )}
      {side === 'left' && (
        <Path
          d="M 10 26 Q 35 12 58 14 L 58 23 Q 35 20 10 34 Z"
          fill={barFill}
          stroke={barStroke}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      )}
      {side === 'right' && (
        <Path
          d="M 62 14 Q 85 12 110 26 L 110 34 Q 85 20 62 23 Z"
          fill={barFill}
          stroke={barStroke}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      )}

      {/* Vertical forged iron bars */}
      {bars.map(bx => (
        <G key={bx}>
          <Rect x={bx - 3.5} y={20} width={7} height={86} rx={2} fill={barFill} stroke={barStroke} strokeWidth={2.4} />
          <Line x1={bx - 1} y1={24} x2={bx - 1} y2={102} stroke={barLight} strokeWidth={1.4} strokeLinecap="round" opacity={0.75} />
        </G>
      ))}

      {/* Center seam bar split when breaking open */}
      {side === 'left' && (
        <Rect x={54} y={18} width={5} height={88} rx={1.5} fill={barFill} stroke={barStroke} strokeWidth={2.2} />
      )}
      {side === 'right' && (
        <Rect x={61} y={18} width={5} height={88} rx={1.5} fill={barFill} stroke={barStroke} strokeWidth={2.2} />
      )}

      {/* Horizontal cross-brace & floor rail */}
      {side === 'full' && (
        <>
          <Rect x={8} y={102} width={104} height={11} rx={4} fill={barFill} stroke={barStroke} strokeWidth={3} />
          <Line x1={14} y1={105.5} x2={106} y2={105.5} stroke={barLight} strokeWidth={1.6} opacity={0.6} />
        </>
      )}
      {side === 'left' && (
        <Rect x={8} y={102} width={50} height={11} rx={3} fill={barFill} stroke={barStroke} strokeWidth={3} />
      )}
      {side === 'right' && (
        <Rect x={62} y={102} width={50} height={11} rx={3} fill={barFill} stroke={barStroke} strokeWidth={3} />
      )}
    </Svg>
  );
};

/** Chunky brass cage padlock with keyhole, rendered separately so it can pop free on unlock. */
export const CagePadlockSvg: React.FC<{ size?: number; open?: boolean }> = ({ size = 34, open = false }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48" pointerEvents="none">
    {/* Shackle */}
    <Path
      d={open ? 'M 15 22 L 15 11 A 9 9 0 0 1 33 11 L 33 16' : 'M 15 22 L 15 14 A 9 9 0 0 1 33 14 L 33 22'}
      fill="none"
      stroke="#9CA3AF"
      strokeWidth={5}
      strokeLinecap="round"
    />
    <Path
      d={open ? 'M 15 22 L 15 11 A 9 9 0 0 1 33 11 L 33 16' : 'M 15 22 L 15 14 A 9 9 0 0 1 33 14 L 33 22'}
      fill="none"
      stroke={INK}
      strokeWidth={2}
      strokeLinecap="round"
    />
    {/* Brass body */}
    <Rect x={9} y={20} width={30} height={23} rx={5} fill="#F5B800" stroke={INK} strokeWidth={3} />
    <Rect x={12} y={23} width={24} height={5} rx={2} fill="#FFF6C2" opacity={0.75} />
    {/* Keyhole */}
    <Circle cx={24} cy={30} r={3.5} fill={INK} />
    <Path d="M 22 31 L 26 31 L 27 38 L 21 38 Z" fill={INK} />
  </Svg>
);
