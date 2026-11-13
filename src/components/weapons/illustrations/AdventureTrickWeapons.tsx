import React from 'react';
import { Svg, Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { STROKE } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { WeaponRelic } from '../types';

export const ADVENTURE_TRICK_WEAPON_RELICS: Record<string, WeaponRelic> = {
  "Devil's Bargain": {
    tapStyle: 'vitality',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={52} r={38} fill="#E11D48" opacity={0.16} />
      {/* Parchment contract sheet */}
      <Rect x={27} y={20} width={46} height={58} fill="#FFF7ED" stroke={STROKE} strokeWidth={3} strokeLinejoin="round" />
      <Rect x={63} y={21.5} width={8.5} height={55} fill="#FED7AA" />
      {/* Contract scribble lines (no text) */}
      <G stroke="#A8A29E" strokeWidth={2.6} strokeLinecap="round">
        <Line x1={34} y1={34} x2={62} y2={34} />
        <Line x1={34} y1={42} x2={58} y2={42} />
        <Line x1={34} y1={50} x2={50} y2={50} />
      </G>
      {/* Blood-red signature flourish */}
      <Path
        d="M 33 62 C 36 55, 40 55, 40 61 C 40 66, 45 64, 47 58"
        fill="none"
        stroke="#E11D48"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Top and bottom scroll rolls with rarity knobs */}
      <Rect x={21} y={13} width={58} height={12} rx={6} fill="#FDBA74" stroke={STROKE} strokeWidth={3} />
      <Rect x={21} y={73} width={58} height={12} rx={6} fill="#FDBA74" stroke={STROKE} strokeWidth={3} />
      <Line x1={27} y1={17} x2={50} y2={17} stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
      <Circle cx={18} cy={19} r={5} fill={trim.metal} stroke={STROKE} strokeWidth={2.6} />
      <Circle cx={82} cy={19} r={5} fill={trim.metal} stroke={STROKE} strokeWidth={2.6} />
      <Circle cx={18} cy={79} r={5} fill={trim.metal} stroke={STROKE} strokeWidth={2.6} />
      <Circle cx={82} cy={79} r={5} fill={trim.metal} stroke={STROKE} strokeWidth={2.6} />
      {/* Horned heart wax seal */}
      <Polygon points="59,58 55,46 64,54" fill="#9F1239" stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round" />
      <Polygon points="81,58 85,46 76,54" fill="#9F1239" stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round" />
      <Path
        d="M 70 88 C 54 79, 51 65, 58 60 C 63 57, 68 59, 70 63 C 72 59, 77 57, 82 60 C 89 65, 86 79, 70 88 Z"
        fill="#E11D48"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <Path d="M 82 64 C 85 72, 80 80, 70 86 C 77 79, 81 72, 82 64 Z" fill="#9F1239" />
      <Path d="M 70 70 C 64 66, 63 72, 70 78 C 77 72, 76 66, 70 70 Z" fill="#9F1239" />
      <Circle cx={60} cy={65} r={2.2} fill="#FFFFFF" />
    </Svg>
    ),
  },

  "Collector's Album": {
    tapStyle: 'tome',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={54} r={38} fill={COLORS.logicTeal} opacity={0.16} />
      {/* Teal album cover behind the spread */}
      <Path
        d="M 6 30 L 6 82 C 22 78, 38 79, 50 85 C 62 79, 78 78, 94 82 L 94 30 Z"
        fill={COLORS.logicTeal}
        stroke={STROKE}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      <Polygon points="6,72 6,82 16,80.5" fill={trim.metal} stroke={STROKE} strokeWidth={2.4} strokeLinejoin="round" />
      <Polygon points="94,72 94,82 84,80.5" fill={trim.metal} stroke={STROKE} strokeWidth={2.4} strokeLinejoin="round" />
      {/* Open pages */}
      <Path
        d="M 50 28 C 40 22, 24 22, 11 26 L 11 76 C 24 72, 40 73, 50 79 Z"
        fill="#FFF7ED"
        stroke={STROKE}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Path
        d="M 50 28 C 60 22, 76 22, 89 26 L 89 76 C 76 72, 60 73, 50 79 Z"
        fill="#FFF7ED"
        stroke={STROKE}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Path d="M 50 30 C 46 27, 43 26, 40 25.5 L 40 74 C 44 74.5, 47 76, 50 77 Z" fill="#FED7AA" />
      {/* Perforated stamps: same motif, different colors */}
      <Rect x={15} y={31} width={18} height={21} fill="#FFFFFF" stroke={STROKE} strokeWidth={2.4} strokeDasharray="2.2 1.6" />
      <Rect x={18} y={34} width={12} height={15} fill={COLORS.impactRed} />
      <Circle cx={24} cy={41.5} r={3.6} fill="#FFFFFF" />
      <Rect x={22} y={53} width={18} height={21} fill="#FFFFFF" stroke={STROKE} strokeWidth={2.4} strokeDasharray="2.2 1.6" />
      <Rect x={25} y={56} width={12} height={15} fill={COLORS.actionYellow} />
      <Circle cx={31} cy={63.5} r={3.6} fill="#FFFFFF" />
      <Rect x={58} y={31} width={18} height={21} fill="#FFFFFF" stroke={STROKE} strokeWidth={2.4} strokeDasharray="2.2 1.6" />
      <Rect x={61} y={34} width={12} height={15} fill="#3B82F6" />
      <Circle cx={67} cy={41.5} r={3.6} fill="#FFFFFF" />
      {/* Empty slot awaiting the last stamp */}
      <Rect x={66} y={53} width={18} height={21} rx={2} fill="none" stroke="#A8A29E" strokeWidth={2.4} strokeDasharray="3 2.4" />
      <Line x1={75} y1={59} x2={75} y2={68} stroke="#A8A29E" strokeWidth={2.4} strokeLinecap="round" />
      <Line x1={70.5} y1={63.5} x2={79.5} y2={63.5} stroke="#A8A29E" strokeWidth={2.4} strokeLinecap="round" />
      {/* Ribbon bookmark */}
      <Path d="M 54 27 L 54 13 L 61 13 L 61 26" fill="#E11D48" stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round" />
      <Polygon points="54,13 57.5,17 61,13" fill={STROKE} />
    </Svg>
    ),
  },

  'Wild Card': {
    tapStyle: 'coin',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={56} r={38} fill="#C084FC" opacity={0.18} />
      {/* Playing card */}
      <Rect x={26} y={32} width={48} height={60} rx={7} fill="#FFFFFF" stroke={STROKE} strokeWidth={3.2} />
      <Path d="M 66 34 L 70 34 C 71.5 34, 72 35, 72 37 L 72 86 C 72 88, 71 90, 68 90 L 66 90 Z" fill="#E2E8F0" />
      {/* Rainbow star (concentric bands) */}
      <Polygon
        points="50.0,43.0 55.3,55.7 69.0,56.8 58.6,65.8 61.8,79.2 50.0,72.0 38.2,79.2 41.4,65.8 31.0,56.8 44.7,55.7"
        fill={COLORS.impactRed}
        stroke={STROKE}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      <Polygon
        points="50.0,50.0 53.7,58.9 63.3,59.7 56.0,65.9 58.2,75.3 50.0,70.3 41.8,75.3 44.0,65.9 36.7,59.7 46.3,58.9"
        fill={COLORS.actionYellow}
      />
      <Polygon
        points="50.0,56.5 52.1,61.6 57.6,62.0 53.4,65.6 54.7,71.0 50.0,68.1 45.3,71.0 46.6,65.6 42.4,62.0 47.9,61.6"
        fill={COLORS.logicTeal}
      />
      <Circle cx={50} cy={64} r={2} fill="#FFFFFF" />
      <Polygon
        points="66.0,77.5 67.2,80.4 70.3,80.6 67.9,82.6 68.6,85.6 66.0,84.0 63.4,85.6 64.1,82.6 61.7,80.6 64.8,80.4"
        fill="#C084FC"
        stroke={STROKE}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {/* Jester hat perched on top */}
      <Path
        d="M 35 37 C 30 27, 22 21, 12 20 C 24 13, 39 19, 47 31 Z"
        fill="#7E22CE"
        stroke={STROKE}
        strokeWidth={2.9}
        strokeLinejoin="round"
      />
      <Path
        d="M 65 37 C 70 27, 78 21, 88 20 C 76 13, 61 19, 53 31 Z"
        fill={COLORS.logicTeal}
        stroke={STROKE}
        strokeWidth={2.9}
        strokeLinejoin="round"
      />
      <Path
        d="M 38 34 C 41 22, 46 15, 50 9 C 54 15, 59 22, 62 34 Z"
        fill="#E11D48"
        stroke={STROKE}
        strokeWidth={2.9}
        strokeLinejoin="round"
      />
      <Path d="M 50 12 C 53 18, 57 25, 59 33 L 54 33 C 53 26, 52 19, 50 12 Z" fill="#9F1239" />
      <Path
        d="M 31 34 Q 50 28 69 34 L 68 41 Q 50 35 32 41 Z"
        fill={trim.metal}
        stroke={STROKE}
        strokeWidth={2.7}
        strokeLinejoin="round"
      />
      <Circle cx={50} cy={36} r={2.4} fill={trim.gem} stroke={STROKE} strokeWidth={1.4} />
      <Circle cx={12} cy={20} r={4.2} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={50} cy={9} r={4.2} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={88} cy={20} r={4.2} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.4} />
    </Svg>
    ),
  },

  'Twin Seed': {
    tapStyle: 'connector',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={54} r={37} fill="#22C55E" opacity={0.16} />
      {/* Twin sprout stems (outlined-line trick) */}
      <Path d="M 36 42 C 34 36, 31 31, 27 25" fill="none" stroke={STROKE} strokeWidth={6.4} strokeLinecap="round" />
      <Path d="M 64 42 C 66 36, 69 31, 73 25" fill="none" stroke={STROKE} strokeWidth={6.4} strokeLinecap="round" />
      <Path d="M 36 42 C 34 36, 31 31, 27 25" fill="none" stroke="#22C55E" strokeWidth={2.8} strokeLinecap="round" />
      <Path d="M 64 42 C 66 36, 69 31, 73 25" fill="none" stroke="#22C55E" strokeWidth={2.8} strokeLinecap="round" />
      {/* Leaves */}
      <Path d="M 27 25 C 18 15, 7 18, 6 28 C 15 34, 25 32, 27 25 Z" fill="#4ADE80" stroke={STROKE} strokeWidth={2.8} strokeLinejoin="round" />
      <Path d="M 73 25 C 82 15, 93 18, 94 28 C 85 34, 75 32, 73 25 Z" fill="#4ADE80" stroke={STROKE} strokeWidth={2.8} strokeLinejoin="round" />
      <Path d="M 8 28 C 16 31, 23 30, 26 27 C 20 28, 14 28, 8 28 Z" fill="#16A34A" />
      <Path d="M 92 28 C 84 31, 77 30, 74 27 C 80 28, 86 28, 92 28 Z" fill="#16A34A" />
      <Path d="M 33 37 C 38 29, 46 29, 48 35 C 43 41, 37 41, 33 37 Z" fill="#4ADE80" stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round" />
      <Path d="M 67 37 C 62 29, 54 29, 52 35 C 57 41, 63 41, 67 37 Z" fill="#4ADE80" stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round" />
      {/* Inner back lip of the split pod */}
      <Path
        d="M 7 58 C 22 44, 78 44, 93 58 C 76 54, 24 54, 7 58 Z"
        fill="#16A34A"
        stroke={STROKE}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      {/* Twin seeds nestled in the pod */}
      <Circle cx={36} cy={53} r={12} fill="#B45309" stroke={STROKE} strokeWidth={3} />
      <Circle cx={64} cy={53} r={12} fill="#D97706" stroke={STROKE} strokeWidth={3} />
      <Path d="M 29 50 C 30 46, 33 44, 36 44" fill="none" stroke="#FFFFFF" strokeWidth={2.8} strokeLinecap="round" />
      <Path d="M 57 50 C 58 46, 61 44, 64 44" fill="none" stroke="#FFFFFF" strokeWidth={2.8} strokeLinecap="round" />
      {/* Front pod shell */}
      <Path
        d="M 7 58 C 24 64, 76 64, 93 58 C 87 78, 68 88, 50 88 C 32 88, 13 78, 7 58 Z"
        fill="#4ADE80"
        stroke={STROKE}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      <Path d="M 16 72 C 30 80, 70 80, 84 72 C 76 82, 62 86, 50 86 C 38 86, 24 82, 16 72 Z" fill="#16A34A" />
      <Path d="M 20 66 C 30 69, 40 70, 48 70" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
      {/* Rarity rivets at the pod tips and seam */}
      <Circle cx={8} cy={58} r={3.6} fill={trim.metal} stroke={STROKE} strokeWidth={2} />
      <Circle cx={92} cy={58} r={3.6} fill={trim.metal} stroke={STROKE} strokeWidth={2} />
      <Circle cx={50} cy={76} r={3.2} fill={trim.gem} stroke={STROKE} strokeWidth={1.8} />
    </Svg>
    ),
  },

  'Glass Sword': {
    tapStyle: 'laser',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={38} fill="#22D3EE" opacity={0.18} />
      <G transform="rotate(42 50 50)">
        {/* Translucent crystal blade */}
        <Polygon
          points="50,2 59,15 59,64 41,64 41,15"
          fill="#CFFAFE"
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Polygon points="50,5 57.5,15.5 57.5,62.5 50,62.5" fill="#67E8F9" opacity={0.85} />
        <Line x1={45} y1={18} x2={45} y2={56} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
        {/* Hairline crack */}
        <Path
          d="M 59 30 L 52 35 L 56 40 L 48 46 L 51 50"
          fill="none"
          stroke={STROKE}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Gold crossguard */}
        <Rect x={29} y={62} width={42} height={9} rx={4.5} fill="#F59E0B" stroke={STROKE} strokeWidth={3} />
        <Line x1={33} y1={65} x2={44} y2={65} stroke="#FEF08A" strokeWidth={2.4} strokeLinecap="round" />
        <Circle cx={50} cy={66.5} r={4} fill={trim.gem} stroke={STROKE} strokeWidth={2} />
        {/* Wrapped grip */}
        <Rect x={45} y={71} width={10} height={16} rx={3} fill="#7C2D12" stroke={STROKE} strokeWidth={2.8} />
        <Line x1={45.5} y1={77} x2={54.5} y2={77} stroke={trim.metal} strokeWidth={2.4} />
        <Line x1={45.5} y1={82} x2={54.5} y2={82} stroke={trim.metal} strokeWidth={2.4} />
        {/* Pommel */}
        <Circle cx={50} cy={91} r={5.5} fill="#F59E0B" stroke={STROKE} strokeWidth={2.8} />
        <Circle cx={48.5} cy={89.5} r={1.6} fill="#FFFFFF" />
      </G>
      {/* Glint */}
      <Polygon
        points="80,6 82,13 89,15 82,17 80,24 78,17 71,15 78,13"
        fill="#FFFFFF"
        stroke={STROKE}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={88} cy={34} r={2.4} fill="#22D3EE" stroke={STROKE} strokeWidth={1.4} />
    </Svg>
    ),
  },

  'Fog Lantern': {
    tapStyle: 'arcane',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={46} r={34} fill={COLORS.actionYellow} opacity={0.2} />
      {/* Hanging ring */}
      <Circle cx={50} cy={11} r={5} fill="none" stroke={STROKE} strokeWidth={6.2} />
      <Circle cx={50} cy={11} r={5} fill="none" stroke={trim.metal} strokeWidth={2.6} />
      {/* Cap */}
      <Polygon points="33,29 67,29 60,17 40,17" fill={trim.metal} stroke={STROKE} strokeWidth={3} strokeLinejoin="round" />
      <Line x1={42} y1={21} x2={52} y2={21} stroke={trim.metalHighlight} strokeWidth={2.4} strokeLinecap="round" />
      {/* Glowing glass chamber */}
      <Rect x={34} y={29} width={32} height={36} rx={4} fill="#FEF3C7" stroke={STROKE} strokeWidth={3} />
      {/* Flame */}
      <Path
        d="M 50 35 C 57 43, 59 50, 57 55 C 55 60, 45 60, 43 55 C 41 50, 44 44, 50 35 Z"
        fill="#FF9538"
        stroke={STROKE}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      <Path d="M 50 45 C 53 49, 54 52, 53 55 C 52 57.5, 48 57.5, 47 55 C 46 52, 47 49, 50 45 Z" fill={COLORS.actionYellow} />
      {/* Cage bars */}
      <Line x1={42} y1={30} x2={42} y2={64} stroke={STROKE} strokeWidth={2.4} />
      <Line x1={58} y1={30} x2={58} y2={64} stroke={STROKE} strokeWidth={2.4} />
      <Line x1={37} y1={34} x2={37} y2={46} stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
      {/* Base */}
      <Polygon points="31,65 69,65 64,74 36,74" fill={trim.metal} stroke={STROKE} strokeWidth={3} strokeLinejoin="round" />
      {/* Curling fog wisps */}
      <Path d="M 30 48 C 20 48, 12 42, 16 35 C 19 30, 26 33, 23 38" fill="none" stroke={STROKE} strokeWidth={6.4} strokeLinecap="round" />
      <Path d="M 30 48 C 20 48, 12 42, 16 35 C 19 30, 26 33, 23 38" fill="none" stroke="#E2E8F0" strokeWidth={3} strokeLinecap="round" />
      <Path d="M 70 56 C 80 56, 88 50, 84 43 C 81 38, 74 41, 77 46" fill="none" stroke={STROKE} strokeWidth={6.4} strokeLinecap="round" />
      <Path d="M 70 56 C 80 56, 88 50, 84 43 C 81 38, 74 41, 77 46" fill="none" stroke="#E2E8F0" strokeWidth={3} strokeLinecap="round" />
      {/* Fog bank swallowing the base */}
      <Path
        d="M 10 80 C 9 72, 18 68, 25 72 C 29 64, 43 64, 47 71 C 53 64, 67 65, 70 72 C 77 67, 90 70, 90 79 C 90 86, 83 89, 76 87 L 22 87 C 15 89, 10 86, 10 80 Z"
        fill="#E2E8F0"
        stroke={STROKE}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Path d="M 22 84 C 40 86, 62 86, 80 83 C 82 85, 79 86.5, 76 86 L 22 86 Z" fill="#CBD5E1" />
      <Path d="M 17 76 C 19 72, 23 71, 26 73" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
      <Path d="M 52 72 C 56 69, 62 69, 65 72" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
    ),
  },

  Understudy: {
    tapStyle: 'arcane',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Spotlight cone */}
      <Polygon points="76,8 86,8 92,90 34,90" fill={COLORS.actionYellow} opacity={0.24} />
      <Ellipse cx={58} cy={88} rx={32} ry={6} fill={COLORS.actionYellow} opacity={0.35} />
      <Rect x={73} y={3} width={16} height={9} rx={3} fill={trim.metal} stroke={STROKE} strokeWidth={2.6} />
      {/* Dashed ghost copy (the understudy) */}
      <G transform="translate(-16 -4)">
        <Path
          d="M 40 24 C 46 21, 66 21, 72 24 C 78 30, 76 40, 70 46 C 68 52, 70 58, 74 64 C 70 70, 42 70, 38 64 C 42 58, 44 52, 42 46 C 36 40, 34 30, 40 24 Z"
          fill="#C084FC"
          opacity={0.45}
        />
        <Path
          d="M 40 24 C 46 21, 66 21, 72 24 C 78 30, 76 40, 70 46 C 68 52, 70 58, 74 64 C 70 70, 42 70, 38 64 C 42 58, 44 52, 42 46 C 36 40, 34 30, 40 24 Z"
          fill="none"
          stroke="#7E22CE"
          strokeWidth={2.6}
          strokeDasharray="4 3"
          strokeLinejoin="round"
        />
      </G>
      {/* Stand pole and tripod base */}
      <Rect x={53} y={66} width={6} height={18} fill={trim.metal} stroke={STROKE} strokeWidth={2.6} />
      <Path d="M 56 82 L 42 92 M 56 82 L 70 92 M 56 82 L 56 92" stroke={STROKE} strokeWidth={6} strokeLinecap="round" />
      <Path d="M 56 82 L 42 92 M 56 82 L 70 92 M 56 82 L 56 92" stroke={trim.metal} strokeWidth={2.6} strokeLinecap="round" />
      {/* Dress-form torso */}
      <Path
        d="M 40 24 C 46 21, 66 21, 72 24 C 78 30, 76 40, 70 46 C 68 52, 70 58, 74 64 C 70 70, 42 70, 38 64 C 42 58, 44 52, 42 46 C 36 40, 34 30, 40 24 Z"
        fill="#F5D0A9"
        stroke={STROKE}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      <Path d="M 66 25 C 74 31, 73 40, 66 46 C 64 53, 66 59, 70 64 C 66 66, 62 67, 60 67 C 62 58, 61 50, 63 44 C 68 38, 69 30, 66 25 Z" fill="#D9A877" />
      {/* Tape-measure sash */}
      <Path d="M 40 30 C 52 36, 62 44, 68 60" fill="none" stroke={STROKE} strokeWidth={6.2} strokeLinecap="round" />
      <Path d="M 40 30 C 52 36, 62 44, 68 60" fill="none" stroke={COLORS.actionYellow} strokeWidth={2.8} strokeLinecap="round" />
      <Path d="M 45 30 C 46 36, 46 41, 46 44" fill="none" stroke="#FFFFFF" strokeWidth={2.8} strokeLinecap="round" />
      {/* Neck knob */}
      <Rect x={50} y={13} width={12} height={10} rx={3} fill={trim.metal} stroke={STROKE} strokeWidth={2.6} />
      <Circle cx={56} cy={12} r={3.5} fill={trim.gem} stroke={STROKE} strokeWidth={2} />
    </Svg>
    ),
  },

  'Encore Mask': {
    tapStyle: 'chrono',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={52} r={38} fill="#E11D48" opacity={0.16} />
      {/* Red stage curtains */}
      <Path d="M 6 10 L 28 10 C 24 40, 22 66, 32 92 L 6 92 Z" fill="#E11D48" stroke={STROKE} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M 94 10 L 72 10 C 76 40, 78 66, 68 92 L 94 92 Z" fill="#E11D48" stroke={STROKE} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M 15 14 C 13 40, 13 66, 17 90" fill="none" stroke="#9F1239" strokeWidth={3} strokeLinecap="round" />
      <Path d="M 85 14 C 87 40, 87 66, 83 90" fill="none" stroke="#9F1239" strokeWidth={3} strokeLinecap="round" />
      {/* Tie-backs */}
      <Rect x={6} y={58} width={18} height={6} rx={3} fill={trim.metal} stroke={STROKE} strokeWidth={2.4} />
      <Rect x={76} y={58} width={18} height={6} rx={3} fill={trim.metal} stroke={STROKE} strokeWidth={2.4} />
      {/* Valance */}
      <Path
        d="M 4 5 L 96 5 L 96 15 C 88 22, 77 22, 69 15 C 61 22, 39 22, 31 15 C 23 22, 12 22, 4 15 Z"
        fill="#BE123C"
        stroke={STROKE}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {/* Comedy mask */}
      <Path
        d="M 25 30 C 36 22, 64 22, 75 30 C 79 46, 73 64, 62 74 C 56 80, 44 80, 38 74 C 27 64, 21 46, 25 30 Z"
        fill="#FFF7ED"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      <Path d="M 72 33 C 75 47, 70 63, 60 72 C 55 77, 47 78, 42 76 C 55 74, 66 62, 69 48 C 70 42, 71 37, 72 33 Z" fill="#FED7AA" />
      {/* Happy upturned eye holes and brows */}
      <Path d="M 32 47 C 34 38, 44 38, 46 47 C 42 44, 36 44, 32 47 Z" fill={STROKE} stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M 54 47 C 56 38, 66 38, 68 47 C 64 44, 58 44, 54 47 Z" fill={STROKE} stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M 32 34 Q 39 29 46 33" fill="none" stroke={STROKE} strokeWidth={2.8} strokeLinecap="round" />
      <Path d="M 54 33 Q 61 29 68 34" fill="none" stroke={STROKE} strokeWidth={2.8} strokeLinecap="round" />
      {/* Big grin */}
      <Path
        d="M 35 55 C 40 70, 60 70, 65 55 C 57 59, 43 59, 35 55 Z"
        fill={STROKE}
        stroke={STROKE}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      <Path d="M 43 64 C 47 61, 53 61, 57 64 C 53 67, 47 67, 43 64 Z" fill={COLORS.impactRed} />
      <Circle cx={31} cy={56} r={3.4} fill={COLORS.impactRed} opacity={0.6} />
      <Circle cx={69} cy={56} r={3.4} fill={COLORS.impactRed} opacity={0.6} />
      <Circle cx={30} cy={40} r={2.2} fill="#FFFFFF" />
      {/* Gold forehead jewel */}
      <Circle cx={50} cy={30} r={3.4} fill={trim.gem} stroke={STROKE} strokeWidth={2} />
    </Svg>
    ),
  },

  'Cursed Idol': {
    tapStyle: 'arcane',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={48} cy={52} r={38} fill="#7E22CE" opacity={0.18} />
      {/* Curse wisp rising */}
      <Path d="M 60 15 C 63 5, 78 2, 83 10 C 87 17, 79 22, 76 17" fill="none" stroke={STROKE} strokeWidth={6.4} strokeLinecap="round" />
      <Path d="M 60 15 C 63 5, 78 2, 83 10 C 87 17, 79 22, 76 17" fill="none" stroke="#A855F7" strokeWidth={3} strokeLinecap="round" />
      {/* Pedestal */}
      <Rect x={18} y={80} width={60} height={11} rx={3} fill="#57534E" stroke={STROKE} strokeWidth={3} />
      {/* Carved stone head */}
      <Path
        d="M 28 16 L 68 16 C 72 16, 74 19, 74 23 L 72 81 L 24 81 L 22 23 C 22 19, 24 16, 28 16 Z"
        fill="#A8A29E"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      <Path d="M 64 18 L 68 18 C 71 18, 72 20, 72 23 L 70 79 L 62 79 Z" fill="#78716C" />
      {/* Rarity headband */}
      <Rect x={20} y={20} width={56} height={8} rx={3} fill={trim.metal} stroke={STROKE} strokeWidth={2.6} />
      <Circle cx={48} cy={24} r={3} fill={trim.gem} stroke={STROKE} strokeWidth={1.6} />
      {/* Heavy brow */}
      <Rect x={24} y={33} width={48} height={8} rx={3} fill="#78716C" stroke={STROKE} strokeWidth={2.6} />
      {/* Glowing purple eyes */}
      <Circle cx={37} cy={48} r={9} fill="#C084FC" opacity={0.4} />
      <Circle cx={59} cy={48} r={9} fill="#C084FC" opacity={0.4} />
      <Ellipse cx={37} cy={48} rx={6.5} ry={4.5} fill="#A855F7" stroke={STROKE} strokeWidth={2.4} />
      <Ellipse cx={59} cy={48} rx={6.5} ry={4.5} fill="#A855F7" stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={37} cy={48} r={2} fill="#FFFFFF" />
      <Circle cx={59} cy={48} r={2} fill="#FFFFFF" />
      {/* Nose */}
      <Polygon points="44,44 52,44 55,60 41,60" fill="#78716C" stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round" />
      {/* Grimacing mouth with teeth */}
      <Rect x={32} y={65} width={32} height={10} rx={3} fill={STROKE} />
      <G stroke="#FFF7ED" strokeWidth={2.6} strokeLinecap="round">
        <Line x1={38} y1={67} x2={38} y2={73} />
        <Line x1={44} y1={67} x2={44} y2={73} />
        <Line x1={50} y1={67} x2={50} y2={73} />
        <Line x1={56} y1={67} x2={56} y2={73} />
      </G>
      {/* Cracks and highlight */}
      <Path d="M 27 54 L 31 59 L 28 63" fill="none" stroke={STROKE} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M 27 44 L 26 74" fill="none" stroke="#E7E5E4" strokeWidth={2.6} strokeLinecap="round" />
      <Circle cx={89} cy={40} r={2.4} fill="#C084FC" stroke={STROKE} strokeWidth={1.4} />
    </Svg>
    ),
  },

  'Chain Gang': {
    tapStyle: 'connector',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={52} r={38} fill="#64748B" opacity={0.16} />
      {/* Left card */}
      <G transform="rotate(-14 27 42)">
        <Rect x={12} y={20} width={30} height={44} rx={5} fill="#FFFFFF" stroke={STROKE} strokeWidth={3} />
        <Rect x={35} y={22} width={5} height={40} fill="#E2E8F0" />
        <Circle cx={27} cy={42} r={7} fill={COLORS.logicTeal} stroke={STROKE} strokeWidth={2.4} />
      </G>
      {/* Right card */}
      <G transform="rotate(14 73 42)">
        <Rect x={58} y={20} width={30} height={44} rx={5} fill="#FFFFFF" stroke={STROKE} strokeWidth={3} />
        <Rect x={81} y={22} width={5} height={40} fill="#E2E8F0" />
        <Circle cx={73} cy={42} r={7} fill={COLORS.logicTeal} stroke={STROKE} strokeWidth={2.4} />
      </G>
      {/* Heavy chain links */}
      <G>
        <Ellipse cx={36} cy={50} rx={6} ry={4} fill="none" stroke={STROKE} strokeWidth={6} transform="rotate(30 36 50)" />
        <Ellipse cx={36} cy={50} rx={6} ry={4} fill="none" stroke="#CBD5E1" strokeWidth={2.6} transform="rotate(30 36 50)" />
        <Ellipse cx={43} cy={57} rx={3.5} ry={6} fill="none" stroke={STROKE} strokeWidth={6} transform="rotate(-45 43 57)" />
        <Ellipse cx={43} cy={57} rx={3.5} ry={6} fill="none" stroke="#CBD5E1" strokeWidth={2.6} transform="rotate(-45 43 57)" />
        <Ellipse cx={64} cy={50} rx={6} ry={4} fill="none" stroke={STROKE} strokeWidth={6} transform="rotate(-30 64 50)" />
        <Ellipse cx={64} cy={50} rx={6} ry={4} fill="none" stroke="#CBD5E1" strokeWidth={2.6} transform="rotate(-30 64 50)" />
        <Ellipse cx={57} cy={57} rx={3.5} ry={6} fill="none" stroke={STROKE} strokeWidth={6} transform="rotate(45 57 57)" />
        <Ellipse cx={57} cy={57} rx={3.5} ry={6} fill="none" stroke="#CBD5E1" strokeWidth={2.6} transform="rotate(45 57 57)" />
      </G>
      {/* Padlock shackle */}
      <Path d="M 43 70 L 43 64 C 43 56, 57 56, 57 64 L 57 70" fill="none" stroke={STROKE} strokeWidth={7} strokeLinecap="round" />
      <Path d="M 43 70 L 43 64 C 43 56, 57 56, 57 64 L 57 70" fill="none" stroke="#CBD5E1" strokeWidth={3.2} strokeLinecap="round" />
      {/* Padlock body */}
      <Rect x={37} y={68} width={26} height={22} rx={5} fill={trim.metal} stroke={STROKE} strokeWidth={3.1} />
      <Rect x={55} y={70} width={6} height={18} rx={2} fill={STROKE} opacity={0.25} />
      <Circle cx={50} cy={77} r={3} fill={STROKE} />
      <Rect x={48.6} y={77} width={2.8} height={7} rx={1} fill={STROKE} />
      <Line x1={41} y1={72} x2={41} y2={80} stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
    ),
  },
};
