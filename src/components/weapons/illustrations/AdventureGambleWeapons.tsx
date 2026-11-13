import React from 'react';
import { Svg, Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { STROKE } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { WeaponRelic } from '../types';

export const ADVENTURE_GAMBLE_WEAPON_RELICS: Record<string, WeaponRelic> = {
  'Thorn Bush': {
    tapStyle: 'vitality',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={36} fill="#16A34A" opacity={0.16} />
      {/* Thorn spikes radiating out of the bramble */}
      <G fill="#FDE68A" stroke={STROKE} strokeWidth={2.4} strokeLinejoin="round">
        <Polygon points="44,18 50,6 54,19" />
        <Polygon points="69,22 82,15 76,29" />
        <Polygon points="81,45 94,47 82,55" />
        <Polygon points="20,26 15,13 30,20" />
        <Polygon points="16,47 4,46 15,56" />
        <Polygon points="22,68 12,76 27,74" />
        <Polygon points="76,68 88,76 72,75" />
      </G>
      {/* Round bumpy bramble body */}
      <Path
        d="M 22 66 C 12 60, 12 44, 20 38 C 18 26, 30 18, 40 22 C 46 14, 60 14, 64 22 C 76 20, 84 30, 80 40 C 88 46, 88 62, 78 68 C 70 78, 32 78, 22 66 Z"
        fill="#22C55E"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      {/* Cel shadow along the lower right */}
      <Path
        d="M 80 46 C 85 54, 83 63, 76 67 C 66 75, 38 75, 27 68 C 40 70, 64 68, 72 60 C 77 56, 80 51, 80 46 Z"
        fill="#15803D"
      />
      {/* Inner thorn prickles */}
      <G stroke="#14532D" strokeWidth={2.4} strokeLinecap="round">
        <Line x1={34} y1={40} x2={38} y2={44} />
        <Line x1={44} y1={30} x2={46} y2={35} />
        <Line x1={46} y1={58} x2={50} y2={55} />
        <Line x1={30} y1={58} x2={34} y2={56} />
        <Line x1={70} y1={58} x2={66} y2={55} />
      </G>
      {/* Woody stem into a rarity-trim planter */}
      <Rect x={46} y={72} width={8} height={8} fill="#92400E" stroke={STROKE} strokeWidth={2.4} />
      <Path
        d="M 32 78 L 68 78 L 64 92 L 36 92 Z"
        fill={trim.metal}
        stroke={STROKE}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Line x1={38} y1={82} x2={50} y2={82} stroke={trim.metalHighlight} strokeWidth={2.4} strokeLinecap="round" />
      {/* Plump red berry */}
      <Circle cx={62} cy={44} r={8.5} fill={COLORS.impactRed} stroke={STROKE} strokeWidth={2.8} />
      <Path d="M 62 36 L 65 31" stroke={STROKE} strokeWidth={2.4} strokeLinecap="round" />
      <Circle cx={59} cy={41} r={2.2} fill="#FFFFFF" />
      <Path d="M 26 46 C 27 38, 32 32, 38 30" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
    ),
  },

  Rust: {
    tapStyle: 'chrono',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={36} fill="#F59E0B" opacity={0.18} />
      {/* Diagonal key shaft: rusty upper half, gold lower half */}
      <Line x1={38} y1={38} x2={84} y2={84} stroke={STROKE} strokeWidth={15} strokeLinecap="round" />
      <Line x1={40} y1={40} x2={61} y2={61} stroke="#C2410C" strokeWidth={9} strokeLinecap="round" />
      <Line x1={61} y1={61} x2={83} y2={83} stroke={COLORS.actionYellow} strokeWidth={9} strokeLinecap="round" />
      {/* Gold key bit teeth */}
      <Path
        d="M 68 76 L 60 84 L 66 90 L 70 86 L 73 89 L 77 85"
        fill={COLORS.actionYellow}
        stroke={STROKE}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      <Path
        d="M 73 67 L 80 60 L 85 65"
        fill="none"
        stroke={STROKE}
        strokeWidth={2.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Rusty ring bow */}
      <Circle cx={30} cy={30} r={19} fill="#EA580C" stroke={STROKE} strokeWidth={3.3} />
      <Path
        d="M 44 22 C 50 34, 44 47, 30 49 C 22 50, 15 45, 12 38 C 20 45, 34 44, 40 36 C 43 32, 44 27, 44 22 Z"
        fill="#9A3412"
      />
      <Circle cx={30} cy={30} r={8} fill="#FFF7ED" stroke={STROKE} strokeWidth={2.8} />
      <Circle cx={30} cy={30} r={3.4} fill={trim.gem} stroke={STROKE} strokeWidth={1.6} />
      {/* Rust pits */}
      <G fill="#7C2D12">
        <Circle cx={20} cy={22} r={2.2} />
        <Circle cx={38} cy={17} r={1.6} />
        <Circle cx={18} cy={38} r={1.8} />
        <Circle cx={48} cy={47} r={1.6} />
      </G>
      {/* Rarity-trim collar where rust meets gold */}
      <Path
        d="M 54 62 L 62 54 L 68 60 L 60 68 Z"
        fill={trim.metal}
        stroke={STROKE}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      {/* Golden gleam */}
      <Line x1={66} y1={69} x2={74} y2={77} stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
      <Polygon points="84,62 86,67 91,69 86,71 84,76 82,71 77,69 82,67" fill="#FFFFFF" stroke={STROKE} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M 17 27 C 18 21, 22 17, 27 15" fill="none" stroke="#FDBA74" strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
    ),
  },

  'Tar Pit': {
    tapStyle: 'connector',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={56} r={36} fill="#7E22CE" opacity={0.14} />
      {/* Rarity-trim warning stake sinking at the edge */}
      <Line x1={18} y1={70} x2={14} y2={40} stroke={STROKE} strokeWidth={6.4} strokeLinecap="round" />
      <Line x1={18} y1={70} x2={14} y2={40} stroke="#92400E" strokeWidth={3} strokeLinecap="round" />
      <Circle cx={14} cy={38} r={5} fill={trim.metal} stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={13} cy={37} r={1.5} fill={trim.metalHighlight} />
      {/* Sinking card, tilted, half swallowed */}
      <G transform="rotate(-18 46 46)">
        <Rect x={32} y={18} width={28} height={40} rx={5} fill="#FFFFFF" stroke={STROKE} strokeWidth={3} />
        <Circle cx={46} cy={34} r={6} fill={COLORS.impactRed} stroke={STROKE} strokeWidth={2.2} />
        <Line x1={36} y1={23} x2={36} y2={30} stroke="#CBD5E1" strokeWidth={2.4} strokeLinecap="round" />
      </G>
      {/* Bubbling black tar puddle swallowing the card */}
      <Path
        d="M 8 70 C 8 62, 20 58, 32 58 C 36 54, 44 54, 48 57 C 54 53, 62 54, 66 58 C 80 58, 92 62, 92 70 C 92 78, 80 82, 66 82 C 64 88, 58 90, 56 84 C 46 85, 36 84, 28 82 C 24 88, 16 86, 18 80 C 11 78, 8 74, 8 70 Z"
        fill="#27272A"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      {/* Tar drip oozing over the card */}
      <Path d="M 38 57 C 38 50, 44 48, 46 52 C 47 55, 45 58, 44 57 Z" fill="#27272A" stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
      {/* Bubbles */}
      <Circle cx={72} cy={45} r={7} fill="#3F3F46" stroke={STROKE} strokeWidth={2.8} />
      <Circle cx={70} cy={43} r={2} fill="#FFFFFF" />
      <Circle cx={82} cy={34} r={4} fill="#3F3F46" stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={28} cy={50} r={3.6} fill="#3F3F46" stroke={STROKE} strokeWidth={2.2} />
      <Ellipse cx={72} cy={68} rx={8} ry={3} fill="none" stroke="#71717A" strokeWidth={2} />
      <Ellipse cx={50} cy={74} rx={6} ry={2.2} fill="none" stroke="#52525B" strokeWidth={2} />
      {/* Glossy tar shine */}
      <Path d="M 18 68 C 22 64, 30 63, 36 63" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
    ),
  },

  Decoy: {
    tapStyle: 'arcane',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={52} r={36} fill={COLORS.actionYellow} opacity={0.2} />
      {/* Ripple under the float */}
      <Path d="M 12 84 C 30 90, 70 90, 88 84" fill="none" stroke="#3B82F6" strokeWidth={3} strokeLinecap="round" />
      {/* Wooden duck body */}
      <Path
        d="M 18 60 C 18 50, 30 46, 44 48 C 54 49, 66 48, 76 40 C 84 36, 90 44, 86 54 C 84 68, 72 80, 50 80 C 30 80, 18 72, 18 60 Z"
        fill="#FBBF24"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      <Path
        d="M 86 54 C 82 68, 70 78, 50 78 C 34 78, 22 72, 20 64 C 30 72, 48 74, 62 70 C 74 66, 82 60, 86 54 Z"
        fill="#D97706"
      />
      {/* Carved wing */}
      <Path
        d="M 44 56 C 54 52, 70 52, 76 58 C 70 66, 54 68, 44 64 Z"
        fill="#F59E0B"
        stroke={STROKE}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <Path d="M 52 60 L 66 60" stroke="#B45309" strokeWidth={2} strokeLinecap="round" />
      {/* Head */}
      <Circle cx={32} cy={36} r={14} fill="#FBBF24" stroke={STROKE} strokeWidth={3.2} />
      {/* Bill */}
      <Path
        d="M 20 38 C 14 36, 8 38, 7 42 C 10 45, 18 45, 22 43 Z"
        fill={COLORS.impactOrange}
        stroke={STROKE}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      {/* Painted eye */}
      <Circle cx={31} cy={33} r={3.4} fill={STROKE} />
      <Circle cx={30} cy={32} r={1.2} fill="#FFFFFF" />
      {/* Rarity-trim neck band and keel weight */}
      <Path
        d="M 24 47 C 30 51, 38 51, 44 47 L 43 52 C 37 55, 30 55, 25 52 Z"
        fill={trim.metal}
        stroke={STROKE}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      <Circle cx={34} cy={51} r={2} fill={trim.gem} stroke={STROKE} strokeWidth={1.2} />
      <Path d="M 24 28 C 26 24, 30 22, 34 22" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
      <Path d="M 24 60 C 26 55, 32 53, 38 53" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
    ),
  },

  'Long Fuse': {
    tapStyle: 'explosive',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={40} cy={60} r={32} fill={COLORS.impactRed} opacity={0.16} />
      {/* Long curling fuse (outlined-line trick) */}
      <Path
        d="M 50 30 C 54 20, 66 18, 70 26 C 74 34, 64 40, 62 32 C 60 24, 72 12, 84 16"
        fill="none"
        stroke={STROKE}
        strokeWidth={5.2}
        strokeLinecap="round"
      />
      <Path
        d="M 50 30 C 54 20, 66 18, 70 26 C 74 34, 64 40, 62 32 C 60 24, 72 12, 84 16"
        fill="none"
        stroke="#FFF7ED"
        strokeWidth={2.4}
        strokeDasharray="3 2.5"
        strokeLinecap="round"
      />
      {/* Tilted red dynamite stick */}
      <G transform="rotate(28 40 60)">
        <Rect x={28} y={30} width={24} height={60} rx={6} fill="#EF4444" stroke={STROKE} strokeWidth={3.3} />
        <Rect x={43} y={33} width={7} height={54} rx={3} fill="#B91C1C" />
        {/* Rarity-trim end caps */}
        <Rect x={26} y={28} width={28} height={9} rx={3} fill={trim.metal} stroke={STROKE} strokeWidth={2.8} />
        <Rect x={26} y={83} width={28} height={9} rx={3} fill={trim.metal} stroke={STROKE} strokeWidth={2.8} />
        <Line x1={30} y1={32} x2={38} y2={32} stroke={trim.metalHighlight} strokeWidth={2} strokeLinecap="round" />
        {/* Paper wrap band */}
        <Rect x={28} y={52} width={24} height={12} fill="#FFF7ED" stroke={STROKE} strokeWidth={2.6} />
        <Line x1={33} y1={42} x2={33} y2={48} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
        <Line x1={33} y1={68} x2={33} y2={78} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
      </G>
      {/* Spark at the fuse tip */}
      <Polygon
        points="84,6 87,12 93,10 89,16 95,19 88,20 90,26 84,22 78,26 80,20 73,19 79,16 75,10 81,12"
        fill="#FF9538"
        stroke={STROKE}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      <Circle cx={84} cy={16} r={3.6} fill={COLORS.actionYellow} />
      <Circle cx={84} cy={16} r={1.6} fill="#FFFFFF" />
    </Svg>
    ),
  },

  'Ice Block': {
    tapStyle: 'chrono',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={36} fill="#22D3EE" opacity={0.18} />
      {/* Rarity-trim ice tongs gripping the top */}
      <Path d="M 34 22 C 34 10, 66 10, 66 22" fill="none" stroke={STROKE} strokeWidth={6} strokeLinecap="round" />
      <Path d="M 34 22 C 34 10, 66 10, 66 22" fill="none" stroke={trim.metal} strokeWidth={2.8} strokeLinecap="round" />
      <Circle cx={50} cy={13} r={3.4} fill={trim.gem} stroke={STROKE} strokeWidth={2} />
      {/* Ice cube: top face, front, side */}
      <Polygon points="20,32 54,22 82,30 48,40" fill="#E0F2FE" stroke={STROKE} strokeWidth={3} strokeLinejoin="round" />
      <Polygon points="20,32 48,40 48,82 20,72" fill="#7DD3FC" stroke={STROKE} strokeWidth={3.2} strokeLinejoin="round" />
      <Polygon points="48,40 82,30 82,70 48,82" fill="#38BDF8" stroke={STROKE} strokeWidth={3.2} strokeLinejoin="round" />
      {/* Frozen card inside the front face */}
      <Polygon points="26,44 42,49 42,72 26,67" fill="#FFFFFF" opacity={0.85} stroke={STROKE} strokeWidth={2.4} strokeLinejoin="round" />
      <Circle cx={34} cy={58} r={3.6} fill="#7E22CE" stroke={STROKE} strokeWidth={1.6} />
      {/* Frozen card in side face */}
      <Polygon points="56,46 74,40 74,64 56,70" fill="#FFFFFF" opacity={0.6} stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
      {/* Frost glints */}
      <Line x1={24} y1={38} x2={24} y2={50} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
      <Line x1={56} y1={28} x2={68} y2={26} stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
      <Polygon points="76,44 78,48 82,49 78,51 76,55 74,51 70,49 74,48" fill="#FFFFFF" />
      {/* Melt drips */}
      <Path d="M 34 77 C 34 82, 30 84, 30 88 C 30 92, 38 92, 38 88 C 38 84, 34 82, 34 77 Z" fill="#7DD3FC" stroke={STROKE} strokeWidth={2.4} strokeLinejoin="round" />
      <Path d="M 66 76 C 66 80, 63 82, 63 85 C 63 88, 69 88, 69 85 C 69 82, 66 80, 66 76 Z" fill="#7DD3FC" stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
      <Ellipse cx={50} cy={92} rx={14} ry={3} fill="#7DD3FC" opacity={0.6} />
    </Svg>
    ),
  },

  'Greedy Chest': {
    tapStyle: 'coin',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={54} r={36} fill={COLORS.actionYellow} opacity={0.2} />
      {/* Gaping open lid */}
      <Path
        d="M 14 44 L 20 18 C 34 10, 66 10, 80 18 L 86 44 Z"
        fill="#B45309"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      <Path d="M 24 40 L 28 22 C 40 17, 60 17, 72 22 L 76 40 Z" fill="#7F1D1D" />
      {/* Upper teeth */}
      <Path d="M 24 40 L 28 48 L 33 40 L 38 48 L 43 40 L 48 48 L 53 40 L 58 48 L 63 40 L 68 48 L 73 40 Z" fill="#FFF7ED" stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
      {/* Chest box */}
      <Path
        d="M 12 54 L 88 54 L 84 88 L 16 88 Z"
        fill="#D97706"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      <Path d="M 84 58 L 81 86 L 62 86 L 66 58 Z" fill="#B45309" />
      {/* Mouth interior + lower teeth */}
      <Path d="M 20 54 C 30 64, 70 64, 80 54 Z" fill="#7F1D1D" stroke={STROKE} strokeWidth={2.4} strokeLinejoin="round" />
      <Path d="M 26 56 L 30 50 L 34 58 L 40 51 L 44 59 L 50 52 L 56 59 L 60 51 L 66 58 L 70 50 L 74 56" fill="#FFF7ED" stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
      {/* Lolling tongue */}
      <Path d="M 44 60 C 44 72, 58 74, 58 64 C 56 66, 50 66, 44 60 Z" fill="#F472B6" stroke={STROKE} strokeWidth={2.4} strokeLinejoin="round" />
      {/* Rarity-trim straps + lock */}
      <Rect x={22} y={60} width={7} height={28} fill={trim.metal} stroke={STROKE} strokeWidth={2.4} />
      <Rect x={71} y={60} width={7} height={28} fill={trim.metal} stroke={STROKE} strokeWidth={2.4} />
      <Rect x={43} y={74} width={14} height={11} rx={2.5} fill={trim.metal} stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={50} cy={79.5} r={2.4} fill={trim.gem} stroke={STROKE} strokeWidth={1.2} />
      {/* Spilling coins */}
      <Circle cx={8} cy={80} r={5.5} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={92} cy={78} r={5.5} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={86} cy={91} r={4.5} fill="#F59E0B" stroke={STROKE} strokeWidth={2.2} />
      <Circle cx={7} cy={79} r={1.5} fill="#FFFFFF" />
      <Circle cx={91} cy={77} r={1.5} fill="#FFFFFF" />
      <Path d="M 26 20 C 36 15, 50 14, 60 15" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
    ),
  },

  Tightrope: {
    tapStyle: 'connector',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={52} r={36} fill="#3B82F6" opacity={0.16} />
      {/* Posts */}
      <Rect x={9} y={62} width={8} height={30} rx={2} fill="#92400E" stroke={STROKE} strokeWidth={2.8} />
      <Rect x={83} y={62} width={8} height={30} rx={2} fill="#92400E" stroke={STROKE} strokeWidth={2.8} />
      <Path d="M 13 92 L 13 64" stroke="#78350F" strokeWidth={2} />
      <Circle cx={13} cy={62} r={5.4} fill={trim.metal} stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={87} cy={62} r={5.4} fill={trim.metal} stroke={STROKE} strokeWidth={2.4} />
      {/* Taut rope */}
      <Line x1={13} y1={66} x2={87} y2={66} stroke={STROKE} strokeWidth={5.6} strokeLinecap="round" />
      <Line x1={13} y1={66} x2={87} y2={66} stroke="#FDE68A" strokeWidth={2.6} strokeDasharray="3 2" strokeLinecap="round" />
      {/* Unicycle seat post */}
      <Line x1={50} y1={52} x2={50} y2={24} stroke={STROKE} strokeWidth={6.4} strokeLinecap="round" />
      <Line x1={50} y1={52} x2={50} y2={24} stroke={trim.metal} strokeWidth={3} strokeLinecap="round" />
      {/* Balancing pole (outlined), slightly tipped, with weights */}
      <Line x1={16} y1={40} x2={84} y2={32} stroke={STROKE} strokeWidth={5.6} strokeLinecap="round" />
      <Line x1={16} y1={40} x2={84} y2={32} stroke={COLORS.impactRed} strokeWidth={2.6} strokeLinecap="round" />
      <Circle cx={14} cy={40} r={6.5} fill={COLORS.impactRed} stroke={STROKE} strokeWidth={2.6} />
      <Circle cx={86} cy={32} r={6.5} fill={COLORS.impactRed} stroke={STROKE} strokeWidth={2.6} />
      <Circle cx={12} cy={38} r={1.8} fill="#FFFFFF" />
      <Circle cx={84} cy={30} r={1.8} fill="#FFFFFF" />
      {/* Wheel balancing on the rope */}
      <Circle cx={50} cy={52} r={12} fill="#FFFFFF" stroke={STROKE} strokeWidth={3.2} />
      <Circle cx={50} cy={52} r={7} fill="none" stroke="#CBD5E1" strokeWidth={2} />
      <Circle cx={50} cy={52} r={3.2} fill={trim.gem} stroke={STROKE} strokeWidth={1.6} />
      <Path d="M 41 49 C 42 46, 44 44, 47 43" fill="none" stroke="#3B82F6" strokeWidth={2.4} strokeLinecap="round" />
      {/* Saddle */}
      <Path d="M 39 22 C 42 15, 58 15, 61 22 C 58 26, 42 26, 39 22 Z" fill="#1E293B" stroke={STROKE} strokeWidth={2.8} strokeLinejoin="round" />
      <Path d="M 44 19 C 46 18, 49 17, 52 17" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
    ),
  },

  'Hot Potato': {
    tapStyle: 'explosive',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={58} r={36} fill={COLORS.impactOrange} opacity={0.18} />
      {/* Licking flames underneath */}
      <Path
        d="M 18 86 C 14 76, 20 70, 22 64 C 26 70, 28 72, 30 70 C 32 64, 36 60, 38 56 C 42 64, 44 66, 50 66 C 56 66, 58 62, 62 56 C 64 62, 68 66, 70 70 C 72 72, 76 68, 78 64 C 82 70, 86 78, 82 86 Z"
        fill="#EF4444"
        stroke={STROKE}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Path d="M 26 84 C 24 78, 28 74, 30 76 C 34 72, 38 68, 40 70 C 46 74, 54 74, 60 70 C 62 68, 66 72, 70 76 C 72 74, 76 78, 74 84 Z" fill={COLORS.actionYellow} />
      {/* Potato body */}
      <Path
        d="M 16 54 C 14 40, 30 30, 50 32 C 72 32, 88 42, 84 58 C 82 72, 66 78, 48 78 C 28 78, 18 68, 16 54 Z"
        fill="#C2884D"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      {/* Rarity-trim foil wrap on the lower half */}
      <Path
        d="M 17 58 L 24 54 L 30 60 L 38 55 L 46 61 L 54 55 L 62 61 L 70 55 L 77 60 L 84 56 C 82 72, 66 78, 48 78 C 30 78, 19 70, 17 58 Z"
        fill={trim.metal}
        stroke={STROKE}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      <Path d="M 28 68 L 40 72" stroke={trim.metalHighlight} strokeWidth={2.6} strokeLinecap="round" />
      {/* Split top with butter pat */}
      <Path d="M 30 42 C 40 38, 60 38, 70 42" fill="none" stroke="#7C2D12" strokeWidth={3} strokeLinecap="round" />
      <Rect x={44} y={34} width={12} height={9} rx={2} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.4} transform="rotate(-8 50 38)" />
      {/* Skin speckles */}
      <G fill="#8B5A2B">
        <Circle cx={26} cy={48} r={1.6} />
        <Circle cx={74} cy={47} r={1.8} />
        <Circle cx={62} cy={50} r={1.3} />
      </G>
      <Path d="M 22 50 C 23 44, 27 40, 32 38" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
      {/* Steam squiggles */}
      <G fill="none" stroke={STROKE} strokeWidth={4.6} strokeLinecap="round">
        <Path d="M 34 28 C 30 22, 38 18, 34 10" />
        <Path d="M 50 26 C 46 20, 54 16, 50 7" />
        <Path d="M 66 28 C 62 22, 70 18, 66 10" />
      </G>
      <G fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round">
        <Path d="M 34 28 C 30 22, 38 18, 34 10" />
        <Path d="M 50 26 C 46 20, 54 16, 50 7" />
        <Path d="M 66 28 C 62 22, 70 18, 66 10" />
      </G>
    </Svg>
    ),
  },
};
