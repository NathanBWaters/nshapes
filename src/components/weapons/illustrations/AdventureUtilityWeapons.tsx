import React from 'react';
import { Svg, Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { STROKE } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { WeaponRelic } from '../types';

export const ADVENTURE_UTILITY_WEAPON_RELICS: Record<string, WeaponRelic> = {
  'Clarity Lens': {
    tapStyle: 'arcane',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={46} cy={46} r={36} fill="#22D3EE" opacity={0.18} />
      {/* Wooden handle (outlined-line trick) */}
      <Line x1={62} y1={62} x2={84} y2={84} stroke={STROKE} strokeWidth={14} strokeLinecap="round" />
      <Line x1={62} y1={62} x2={84} y2={84} stroke="#92400E" strokeWidth={8.4} strokeLinecap="round" />
      <Line x1={70} y1={67} x2={82} y2={79} stroke="#B45309" strokeWidth={3} strokeLinecap="round" />
      {/* Rarity collar where the handle meets the rim */}
      <Rect
        x={56}
        y={57}
        width={13}
        height={9}
        rx={2.5}
        fill={trim.metal}
        stroke={STROKE}
        strokeWidth={2.6}
        transform="rotate(45 62.5 61.5)"
      />
      {/* Thick rim */}
      <Circle cx={42} cy={42} r={28} fill={trim.metal} stroke={STROKE} strokeWidth={3.3} />
      <Circle cx={42} cy={42} r={21} fill="#CFFAFE" stroke={STROKE} strokeWidth={2.8} />
      {/* Cel-shaded lens shadow */}
      <Path d="M 56 33 C 61 45, 56 58, 42 62 C 52 55, 57 45, 56 33 Z" fill="#67E8F9" />
      {/* Rim specular */}
      <Path d="M 21 32 C 24 24, 31 18, 39 16" fill="none" stroke={trim.metalHighlight} strokeWidth={2.6} strokeLinecap="round" />
      {/* Glass glints */}
      <Path d="M 30 40 C 31 34, 35 30, 41 29" fill="none" stroke="#FFFFFF" strokeWidth={3.4} strokeLinecap="round" />
      <Circle cx={30} cy={47} r={2} fill="#FFFFFF" />
      {/* Clarity sparkle */}
      <Polygon
        points="80,12 82.5,19 89,21 82.5,23 80,30 77.5,23 71,21 77.5,19"
        fill={COLORS.actionYellow}
        stroke={STROKE}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
    </Svg>
    ),
  },

  'War Drum': {
    tapStyle: 'vitality',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={56} r={36} fill="#E11D48" opacity={0.15} />
      {/* Drum shell */}
      <Path
        d="M 19 44 L 19 76 A 31 10 0 0 0 81 76 L 81 44 Z"
        fill="#E11D48"
        stroke={STROKE}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      {/* Shell cel shadow */}
      <Path d="M 66 52 Q 75 50 79.5 46 L 79.5 76 Q 75 82 66 84.5 Z" fill="#9F1239" />
      {/* Rope lacing */}
      <Path
        d="M 22 54 L 31 78 L 40 56 L 50 80 L 60 56 L 69 78 L 78 54"
        fill="none"
        stroke={STROKE}
        strokeWidth={5.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Path
        d="M 22 54 L 31 78 L 40 56 L 50 80 L 60 56 L 69 78 L 78 54"
        fill="none"
        stroke="#FFF7ED"
        strokeWidth={2.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Bottom hoop */}
      <Path
        d="M 18 74 A 32 10 0 0 0 82 74 L 82 80 A 32 10 0 0 1 18 80 Z"
        fill={trim.metal}
        stroke={STROKE}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      {/* Top hoop and drumhead */}
      <Ellipse cx={50} cy={44} rx={32} ry={11} fill={trim.metal} stroke={STROKE} strokeWidth={3.2} />
      <Ellipse cx={50} cy={43} rx={26} ry={7.5} fill="#FFF7ED" stroke={STROKE} strokeWidth={2.4} />
      <Path d="M 34 42 Q 42 38 52 38" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
      <Circle cx={22} cy={66} r={1.8} fill="#FFFFFF" />
      <Path d="M 23 60 L 23 64" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
      {/* Crossed drumsticks */}
      <Line x1={18} y1={13} x2={62} y2={39} stroke={STROKE} strokeWidth={8} strokeLinecap="round" />
      <Line x1={18} y1={13} x2={62} y2={39} stroke="#F59E0B" strokeWidth={4} strokeLinecap="round" />
      <Line x1={82} y1={13} x2={38} y2={39} stroke={STROKE} strokeWidth={8} strokeLinecap="round" />
      <Line x1={82} y1={13} x2={38} y2={39} stroke="#F59E0B" strokeWidth={4} strokeLinecap="round" />
      <Circle cx={62} cy={39} r={4.6} fill="#FFF7ED" stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={38} cy={39} r={4.6} fill="#FFF7ED" stroke={STROKE} strokeWidth={2.4} />
      {/* Impact ticks */}
      <G stroke={COLORS.actionYellow} strokeWidth={3} strokeLinecap="round">
        <Line x1={9} y1={36} x2={14} y2={39} />
        <Line x1={91} y1={36} x2={86} y2={39} />
      </G>
    </Svg>
    ),
  },

  'Amplifier Coil': {
    tapStyle: 'laser',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={46} r={36} fill="#22D3EE" opacity={0.18} />
      {/* Base plinth */}
      <Rect x={24} y={76} width={52} height={12} rx={3.5} fill="#475569" stroke={STROKE} strokeWidth={3.1} />
      <Rect x={27} y={83} width={46} height={3} fill="#334155" />
      <Circle cx={31} cy={80.5} r={2} fill={trim.metal} stroke={STROKE} strokeWidth={1.2} />
      <Circle cx={69} cy={80.5} r={2} fill={trim.metal} stroke={STROKE} strokeWidth={1.2} />
      {/* Copper coil column */}
      <Rect x={37} y={36} width={26} height={42} rx={4} fill="#F59E0B" stroke={STROKE} strokeWidth={3.1} />
      <Rect x={55} y={38} width={6.5} height={38} fill="#D97706" />
      <G stroke="#92400E" strokeWidth={2.4} strokeLinecap="round">
        <Line x1={39} y1={45} x2={61} y2={42} />
        <Line x1={39} y1={52} x2={61} y2={49} />
        <Line x1={39} y1={59} x2={61} y2={56} />
        <Line x1={39} y1={66} x2={61} y2={63} />
        <Line x1={39} y1={73} x2={61} y2={70} />
      </G>
      <Line x1={42} y1={42} x2={42} y2={72} stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
      {/* Top toroid */}
      <Ellipse cx={50} cy={33} rx={24} ry={9} fill={trim.metal} stroke={STROKE} strokeWidth={3.2} />
      <Ellipse cx={50} cy={31.5} rx={11} ry={3.6} fill="#334155" stroke={STROKE} strokeWidth={2} />
      <Path d="M 31 30 Q 36 26 42 25.5" fill="none" stroke={trim.metalHighlight} strokeWidth={2.6} strokeLinecap="round" />
      {/* Side sparks */}
      <Path d="M 24 30 L 16 26 L 19 22 L 10 18" fill="none" stroke={STROKE} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M 24 30 L 16 26 L 19 22 L 10 18" fill="none" stroke="#22D3EE" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M 76 30 L 84 26 L 81 22 L 90 18" fill="none" stroke={STROKE} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M 76 30 L 84 26 L 81 22 L 90 18" fill="none" stroke="#22D3EE" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      {/* Main lightning bolt */}
      <Polygon
        points="54,4 40,19 49,19 44,30 60,14 51,14"
        fill={COLORS.actionYellow}
        stroke={STROKE}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
    </Svg>
    ),
  },

  'Piñata': {
    tapStyle: 'explosive',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={54} r={36} fill="#FF7169" opacity={0.16} />
      {/* Hanging string and ring */}
      <Line x1={58} y1={12} x2={58} y2={44} stroke={STROKE} strokeWidth={4.6} strokeLinecap="round" />
      <Line x1={58} y1={12} x2={58} y2={44} stroke="#FFF7ED" strokeWidth={2} strokeLinecap="round" />
      <Circle cx={58} cy={9} r={4.5} fill="none" stroke={STROKE} strokeWidth={5} />
      <Circle cx={58} cy={9} r={4.5} fill="none" stroke={trim.metal} strokeWidth={2.4} />
      {/* Legs */}
      <Rect x={34} y={62} width={8} height={22} rx={2.5} fill={COLORS.logicTeal} stroke={STROKE} strokeWidth={2.6} />
      <Rect x={45} y={62} width={8} height={20} rx={2.5} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.6} />
      <Rect x={62} y={62} width={8} height={20} rx={2.5} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.6} />
      <Rect x={73} y={62} width={8} height={22} rx={2.5} fill={COLORS.logicTeal} stroke={STROKE} strokeWidth={2.6} />
      {/* Fringe tail */}
      <G strokeLinecap="round">
        <Line x1={83} y1={50} x2={91} y2={64} stroke={STROKE} strokeWidth={6} />
        <Line x1={83} y1={50} x2={91} y2={64} stroke="#C084FC" strokeWidth={2.8} />
        <Line x1={83} y1={50} x2={85} y2={66} stroke={STROKE} strokeWidth={6} />
        <Line x1={83} y1={50} x2={85} y2={66} stroke={COLORS.actionYellow} strokeWidth={2.8} />
      </G>
      {/* Striped body: teal base, yellow band, red top */}
      <Rect x={30} y={44} width={54} height={26} rx={9} fill={COLORS.logicTeal} />
      <Rect x={30} y={53} width={54} height={8.5} fill={COLORS.actionYellow} />
      <Path d="M 30 53 Q 30 44 39 44 L 75 44 Q 84 44 84 53 Z" fill="#FF7169" />
      <Path d="M 30 53 L 33 55.5 L 36 53 L 39 55.5 L 42 53 L 45 55.5 L 48 53 L 51 55.5 L 54 53 L 57 55.5 L 60 53 L 63 55.5 L 66 53 L 69 55.5 L 72 53 L 75 55.5 L 78 53 L 81 55.5 L 84 53" fill="none" stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M 30 61.5 L 33 64 L 36 61.5 L 39 64 L 42 61.5 L 45 64 L 48 61.5 L 51 64 L 54 61.5 L 57 64 L 60 61.5 L 63 64 L 66 61.5 L 69 64 L 72 61.5 L 75 64 L 78 61.5 L 81 64 L 84 61.5" fill="none" stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
      <Rect x={30} y={44} width={54} height={26} rx={9} fill="none" stroke={STROKE} strokeWidth={3.1} />
      <Path d="M 40 48.5 L 58 48.5" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
      {/* Ears */}
      <Polygon points="21,22 18,6 28,19" fill="#FF7169" stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round" />
      <Polygon points="27,21 30,5 35,22" fill="#FF7169" stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round" />
      {/* Neck and head */}
      <Path
        d="M 32 58 L 24 37 L 13 38 Q 7 38 7 32 Q 7 27 12 25 L 25 19 Q 34 17 36 25 L 44 48 Z"
        fill="#FF7169"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      {/* Neck fringe band */}
      <Path d="M 27 44 L 40 38 L 42.5 45 L 29.5 51 Z" fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={1.8} strokeLinejoin="round" />
      {/* Mane */}
      <Path d="M 33 22 L 38 24 L 36 28 L 41 30 L 39 34 L 44 36" fill="none" stroke={STROKE} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M 33 22 L 38 24 L 36 28 L 41 30 L 39 34 L 44 36" fill="none" stroke="#C084FC" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      {/* Eye and snout */}
      <Circle cx={21} cy={27} r={2.6} fill={STROKE} />
      <Circle cx={20.2} cy={26.2} r={0.9} fill="#FFFFFF" />
      <Circle cx={11} cy={32} r={1.3} fill={STROKE} />
      <Path d="M 14 23.5 L 18 21.8" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
    ),
  },

  'Catalyst Prism': {
    tapStyle: 'laser',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={37} fill="#C084FC" opacity={0.18} />
      {/* Incoming white beam */}
      <Line x1={6} y1={60} x2={36} y2={48} stroke={STROKE} strokeWidth={7} strokeLinecap="round" />
      <Line x1={6} y1={60} x2={36} y2={48} stroke="#FFFFFF" strokeWidth={3.4} strokeLinecap="round" />
      {/* Rainbow fan leaving the prism */}
      <Polygon points="64,45 94,36 94,76 64,53" fill="#EF4444" stroke={STROKE} strokeWidth={2.8} strokeLinejoin="round" />
      <Polygon points="64,47 94,46 94,56 64,49" fill={COLORS.actionYellow} />
      <Polygon points="64,49 94,56 94,66 64,51" fill={COLORS.logicTeal} />
      <Polygon points="64,51 94,66 94,74.5 64,53" fill="#7E22CE" />
      <Polygon points="64,45 94,36 94,76 64,53" fill="none" stroke={STROKE} strokeWidth={2.8} strokeLinejoin="round" />
      {/* Rarity plinth */}
      <Rect x={16} y={72} width={68} height={10} rx={3.5} fill={trim.metal} stroke={STROKE} strokeWidth={3} />
      <Line x1={22} y1={75.5} x2={44} y2={75.5} stroke={trim.metalHighlight} strokeWidth={2.2} strokeLinecap="round" />
      {/* Triangular glass prism */}
      <Polygon
        points="50,14 80,72 20,72"
        fill="#CFFAFE"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      <Polygon points="50,20 75.5,69.5 58,69.5" fill="#67E8F9" />
      <Line x1={50} y1={14} x2={50} y2={71} stroke={STROKE} strokeWidth={2} />
      <Path d="M 44 30 L 30 58" stroke="#FFFFFF" strokeWidth={3.2} strokeLinecap="round" />
      <Circle cx={28} cy={64} r={1.9} fill="#FFFFFF" />
      <Circle cx={50} cy={78} r={2.3} fill={trim.gem} stroke={STROKE} strokeWidth={1.4} />
    </Svg>
    ),
  },

  'Rally Horn': {
    tapStyle: 'explosive',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={52} cy={52} r={36} fill="#FF9538" opacity={0.17} />
      {/* Leather strap */}
      <Path d="M 35 50 Q 44 14 56 44" fill="none" stroke={STROKE} strokeWidth={6.6} strokeLinecap="round" />
      <Path d="M 35 50 Q 44 14 56 44" fill="none" stroke="#B45309" strokeWidth={3} strokeLinecap="round" />
      {/* Ivory horn body */}
      <Path
        d="M 12 40 Q 44 66 74 26 L 90 52 Q 46 84 10 50 Z"
        fill="#FFF7ED"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      {/* Cel shadow along underside */}
      <Path d="M 88.5 52.5 Q 46 82.5 11.5 49.5 L 14 47 Q 46 75 85 49 Z" fill="#FED7AA" />
      {/* Metal bands */}
      <Polygon points="30.5,48 38,50.5 40,67 32.5,65.5" fill={trim.metal} stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round" />
      <Polygon points="52.5,42.5 59.5,42 68.5,64.5 61,66.5" fill={trim.metal} stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round" />
      {/* Flared bell opening */}
      <Ellipse
        cx={82}
        cy={39}
        rx={7}
        ry={16}
        fill={trim.metal}
        stroke={STROKE}
        strokeWidth={3}
        transform="rotate(-32 82 39)"
      />
      <Ellipse cx={83} cy={38.5} rx={3.6} ry={11} fill="#78350F" transform="rotate(-32 83 38.5)" />
      {/* Mouthpiece */}
      <Circle cx={11} cy={45} r={5} fill={trim.metal} stroke={STROKE} strokeWidth={2.6} />
      {/* Highlight */}
      <Path d="M 21 49.5 Q 25 52.5 29 54" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
      <Path d="M 42 55 Q 47 54.5 51 53" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
      {/* Rallying blast lines */}
      <G stroke={COLORS.actionYellow} strokeWidth={3.2} strokeLinecap="round">
        <Line x1={84} y1={22} x2={88} y2={14} />
        <Line x1={92} y1={30} x2={97} y2={26} />
        <Line x1={74} y1={20} x2={74} y2={12} />
      </G>
    </Svg>
    ),
  },

  'Magnet': {
    tapStyle: 'connector',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={48} r={37} fill="#EF4444" opacity={0.15} />
      {/* Red horseshoe */}
      <Path
        d="M 20 58 L 20 36 A 30 30 0 0 1 80 36 L 80 58 L 64 58 L 64 36 A 14 14 0 0 0 36 36 L 36 58 Z"
        fill="#EF4444"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      {/* Cel shadow on right arm */}
      <Path d="M 70 14 A 28 28 0 0 1 78.5 36 L 78.5 56 L 72 56 L 72 34 Q 72 22 70 14 Z" fill="#B91C1C" />
      <Path d="M 26 34 A 24 24 0 0 1 40 13" fill="none" stroke="#FFFFFF" strokeWidth={3.2} strokeLinecap="round" />
      {/* Metal tips */}
      <Rect x={18} y={54} width={20} height={11} rx={2.5} fill={trim.metal} stroke={STROKE} strokeWidth={3} />
      <Rect x={62} y={54} width={20} height={11} rx={2.5} fill={trim.metal} stroke={STROKE} strokeWidth={3} />
      <Line x1={22} y1={57.5} x2={28} y2={57.5} stroke={trim.metalHighlight} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={66} y1={57.5} x2={72} y2={57.5} stroke={trim.metalHighlight} strokeWidth={2.2} strokeLinecap="round" />
      {/* Attraction arcs */}
      <G fill="none" strokeLinecap="round">
        <Path d="M 30 72 Q 50 64 70 72" stroke={STROKE} strokeWidth={5} />
        <Path d="M 30 72 Q 50 64 70 72" stroke={COLORS.actionYellow} strokeWidth={2.2} />
      </G>
      {/* Attracted card */}
      <G transform="rotate(-10 50 84)">
        <Rect x={42} y={74} width={16} height={21} rx={3} fill="#FFFFFF" stroke={STROKE} strokeWidth={2.6} />
        <Ellipse cx={50} cy={84.5} rx={3.2} ry={5.5} fill={COLORS.logicTeal} stroke={STROKE} strokeWidth={1.6} />
      </G>
    </Svg>
    ),
  },

  'Bounty Poster': {
    tapStyle: 'coin',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={37} fill={COLORS.actionYellow} opacity={0.18} />
      {/* Parchment with torn bottom edge */}
      <Path
        d="M 20 16 L 80 14 L 82 82 L 74 86 L 66 81 L 57 87 L 48 82 L 39 87 L 30 82 L 18 86 Z"
        fill="#FEF3C7"
        stroke={STROKE}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      {/* Cel shadow strip */}
      <Path d="M 72 16.5 L 78.5 16.5 L 80.5 80.5 L 74 84 L 72 82 Z" fill="#FCD34D" />
      {/* Curled corner */}
      <Polygon points="20,16 30,15.7 21,26" fill="#FDE68A" stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />
      {/* Header bars (no text) */}
      <Rect x={28} y={23} width={44} height={7} rx={2} fill="#E11D48" stroke={STROKE} strokeWidth={2.2} />
      {/* Target around a card silhouette */}
      <Circle cx={50} cy={51} r={15} fill="#FFF7ED" stroke="#E11D48" strokeWidth={3} />
      <G stroke="#E11D48" strokeWidth={2.6} strokeLinecap="round">
        <Line x1={50} y1={32} x2={50} y2={38} />
        <Line x1={50} y1={64} x2={50} y2={70} />
        <Line x1={31} y1={51} x2={37} y2={51} />
        <Line x1={63} y1={51} x2={69} y2={51} />
      </G>
      <Rect x={44} y={43} width={12} height={16} rx={2.5} fill="#FFFFFF" stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={50} cy={51} r={2.6} fill={COLORS.logicTeal} />
      {/* Reward coins */}
      <Circle cx={41} cy={76} r={5} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.2} />
      <Circle cx={59} cy={76} r={5} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.2} />
      <Polygon
        points="50,67 52.4,72.5 58,73 53.8,76.8 55,82.5 50,79.5 45,82.5 46.2,76.8 42,73 47.6,72.5"
        fill="#F59E0B"
        stroke={STROKE}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {/* Pins */}
      <Circle cx={26} cy={20} r={3.3} fill={trim.metal} stroke={STROKE} strokeWidth={2} />
      <Circle cx={74} cy={19.5} r={3.3} fill={trim.metal} stroke={STROKE} strokeWidth={2} />
      <Circle cx={25} cy={19} r={1} fill="#FFFFFF" />
      <Circle cx={73} cy={18.5} r={1} fill="#FFFFFF" />
    </Svg>
    ),
  },

  'Mirror Shard': {
    tapStyle: 'arcane',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={44} r={36} fill="#C084FC" opacity={0.18} />
      {/* Handle */}
      <Rect x={44} y={66} width={12} height={22} rx={5} fill="#7E22CE" stroke={STROKE} strokeWidth={3} />
      <Line x1={47.5} y1={72} x2={47.5} y2={83} stroke="#C084FC" strokeWidth={2.4} strokeLinecap="round" />
      <Circle cx={50} cy={90} r={4.4} fill={trim.metal} stroke={STROKE} strokeWidth={2.6} />
      <Rect x={40} y={63} width={20} height={7} rx={2.5} fill={trim.metal} stroke={STROKE} strokeWidth={2.6} />
      {/* Ornate frame */}
      <Circle cx={50} cy={12} r={4} fill={trim.metal} stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={23} cy={40} r={3.6} fill={trim.metal} stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={77} cy={40} r={3.6} fill={trim.metal} stroke={STROKE} strokeWidth={2.4} />
      <Ellipse cx={50} cy={40} rx={25} ry={27} fill="#7E22CE" stroke={STROKE} strokeWidth={3.3} />
      <Path d="M 67 22 A 22 24 0 0 1 70 58" fill="none" stroke="#581C87" strokeWidth={4} strokeLinecap="round" />
      {/* Glass */}
      <Ellipse cx={50} cy={40} rx={18} ry={20} fill="#BAE6FD" stroke={STROKE} strokeWidth={2.6} />
      <Path d="M 61 25 C 68 34, 67 50, 56 58 C 61 48, 63 36, 61 25 Z" fill="#7DD3FC" />
      {/* Shattered shard */}
      <Polygon points="57,31 66,36 60,43" fill="#38BDF8" stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
      {/* Cracks */}
      <G fill="none" stroke={STROKE} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M 57 31 L 54 23" />
        <Path d="M 60 43 L 55 50 L 57 57" />
        <Path d="M 57 31 L 48 36 L 40 34" />
        <Path d="M 60 43 L 51 46 L 44 53" />
      </G>
      {/* Glints */}
      <Path d="M 37 30 C 39 25, 43 22, 47 21" fill="none" stroke="#FFFFFF" strokeWidth={3.2} strokeLinecap="round" />
      <Circle cx={36} cy={37} r={1.9} fill="#FFFFFF" />
      <Circle cx={50} cy={12} r={1.6} fill={trim.gem} />
    </Svg>
    ),
  },

  'Odd One Out': {
    tapStyle: 'tome',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={37} fill={COLORS.logicTeal} opacity={0.16} />
      {/* Left card */}
      <G transform="rotate(-10 26 64)">
        <Rect x={14} y={46} width={24} height={34} rx={4} fill="#FFFFFF" stroke={STROKE} strokeWidth={3} />
        <Rect x={16} y={74} width={20} height={4} rx={1.5} fill="#E2E8F0" />
        <Ellipse cx={26} cy={62} rx={5.5} ry={9.5} fill={COLORS.logicTeal} stroke={STROKE} strokeWidth={2.2} />
      </G>
      {/* Right card */}
      <G transform="rotate(10 74 64)">
        <Rect x={62} y={46} width={24} height={34} rx={4} fill="#FFFFFF" stroke={STROKE} strokeWidth={3} />
        <Rect x={64} y={74} width={20} height={4} rx={1.5} fill="#E2E8F0" />
        <Ellipse cx={74} cy={62} rx={5.5} ry={9.5} fill={COLORS.logicTeal} stroke={STROKE} strokeWidth={2.2} />
      </G>
      {/* Spotlight burst behind the odd card */}
      <Polygon
        points="50,6 55,16 66,12 63,23 74,27 64,33 50,30 36,33 26,27 37,23 34,12 45,16"
        fill={COLORS.actionYellow}
        stroke={STROKE}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      {/* Raised odd card: same shape, different color */}
      <G transform="rotate(6 50 40)">
        <Rect x={37} y={22} width={26} height={37} rx={4} fill="#FFFFFF" stroke={STROKE} strokeWidth={3.2} />
        <Rect x={39} y={53} width={22} height={4} rx={1.5} fill="#E2E8F0" />
        <Ellipse cx={50} cy={39.5} rx={6} ry={10.5} fill={COLORS.impactOrange} stroke={STROKE} strokeWidth={2.4} />
        <Circle cx={48} cy={35} r={1.5} fill="#FFFFFF" />
        <Rect x={40} y={25} width={5} height={5} rx={1.2} fill={trim.metal} stroke={STROKE} strokeWidth={1.4} />
      </G>
      {/* Pop-up motion ticks */}
      <G stroke={STROKE} strokeWidth={2.6} strokeLinecap="round">
        <Line x1={44} y1={66} x2={44} y2={72} />
        <Line x1={56} y1={66} x2={56} y2={72} />
      </G>
    </Svg>
    ),
  },
};
