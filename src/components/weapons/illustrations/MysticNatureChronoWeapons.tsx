import React from 'react';
import { Svg, Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { STROKE } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { WeaponRelic } from '../types';

export const MYSTIC_NATURE_CHRONO_WEAPON_RELICS: Record<string, WeaponRelic> = {
  'Oracle Eye': {
    tapStyle: 'arcane',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Three ornate brow rays above */}
      <Polygon points="50,11 45,27 55,27" fill={trim.metal} stroke={STROKE} strokeWidth={2.8} strokeLinejoin="round" />
      <Polygon points="25,19 30,34 38,29" fill={trim.metal} stroke={STROKE} strokeWidth={2.8} strokeLinejoin="round" />
      <Polygon points="75,19 70,34 62,29" fill={trim.metal} stroke={STROKE} strokeWidth={2.8} strokeLinejoin="round" />
      <Path
        d="M 50 67 C 43 75, 42 86, 50 90 C 58 86, 57 75, 50 67 Z"
        fill={COLORS.logicTeal}
        stroke={STROKE}
        strokeWidth={2.9}
        strokeLinejoin="round"
      />
      <Path
        d="M 11 49 C 24 29, 76 29, 89 49 C 76 69, 24 69, 11 49 Z"
        fill="#F59E0B"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      <Path
        d="M 19 49 C 30 34, 70 34, 81 49 C 70 64, 30 64, 19 49 Z"
        fill="#FFF7ED"
        stroke={STROKE}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      {/* Teal & gold iris */}
      <Circle cx={50} cy={49} r={12.5} fill={COLORS.logicTeal} stroke={STROKE} strokeWidth={2.8} />
      <Circle cx={50} cy={49} r={7.5} fill={COLORS.actionYellow} />
      <Ellipse cx={50} cy={49} rx={3} ry={7.5} fill={STROKE} />
      <Circle cx={45} cy={44} r={2.6} fill="#FFFFFF" />
    </Svg>
    ),
  },

  'Mystic Sight': {
    tapStyle: 'arcane',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <G stroke={COLORS.actionYellow} strokeWidth={3.2} strokeLinecap="round">
        <Line x1={50} y1={9} x2={50} y2={18} />
        <Line x1={24} y1={17} x2={30} y2={24} />
        <Line x1={76} y1={17} x2={70} y2={24} />
      </G>
      <Path
        d="M 12 64 L 18 35 L 34 48 L 50 22 L 66 48 L 82 35 L 88 64 Q 50 78 12 64 Z"
        fill="#F59E0B"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      <Path
        d="M 16 62 Q 50 73 84 62 L 82 55 Q 50 66 18 55 Z"
        fill={COLORS.actionYellow}
        stroke={STROKE}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      {/* Awakened violet-cyan third eye set in center */}
      <Path
        d="M 31 51 C 39 39, 61 39, 69 51 C 61 63, 39 63, 31 51 Z"
        fill="#FFFFFF"
        stroke={STROKE}
        strokeWidth={2.9}
        strokeLinejoin="round"
      />
      <Circle cx={50} cy={51} r={9.5} fill="#9333EA" stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={50} cy={51} r={5} fill="#22D3EE" />
      <Circle cx={50} cy={51} r={2.2} fill={STROKE} />
      <Circle cx={46.5} cy={47.5} r={2} fill="#FFFFFF" />
      <Circle cx={24} cy={53} r={3} fill={trim.gem} stroke={STROKE} strokeWidth={1.8} />
      <Circle cx={76} cy={53} r={3} fill={trim.gem} stroke={STROKE} strokeWidth={1.8} />
    </Svg>
    ),
  },

  "Prophet's Vision": {
    tapStyle: 'arcane',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Path
        d="M 34 48 L 9 30 C 8 42, 14 48, 22 50 C 12 52, 13 61, 24 61 C 19 67, 25 72, 36 64 Z"
        fill="#F8FAFC"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <Path
        d="M 66 48 L 91 30 C 92 42, 86 48, 78 50 C 88 52, 87 61, 76 61 C 81 67, 75 72, 64 64 Z"
        fill="#F8FAFC"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <Path d="M 16 40 L 30 49 M 84 40 L 70 49" stroke="#CBD5E1" strokeWidth={2.4} strokeLinecap="round" />
      <Circle cx={50} cy={52} r={22} fill="#F59E0B" stroke={STROKE} strokeWidth={3.2} />
      <Path
        d="M 30 52 C 38 38, 62 38, 70 52 C 62 66, 38 66, 30 52 Z"
        fill="#FAF5FF"
        stroke={STROKE}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      <Circle cx={50} cy={52} r={10} fill="#7E22CE" stroke={STROKE} strokeWidth={2.5} />
      <Polygon points="50,44 53,50 59,52 53,54 50,60 47,54 41,52 47,50" fill={COLORS.actionYellow} />
      <Circle cx={46} cy={48} r={2.2} fill="#FFFFFF" />
      <Polygon points="50,21 55,29 50,34 45,29" fill={trim.gem} stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
    </Svg>
    ),
  },

  'Enlightened Eye': {
    tapStyle: 'arcane',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Sacred geometric halo ring */}
      <Circle cx={50} cy={50} r={37} fill="none" stroke={STROKE} strokeWidth={6.5} />
      <Circle cx={50} cy={50} r={37} fill="none" stroke={COLORS.actionYellow} strokeWidth={3} />
      <Polygon
        points="50,11 89,50 50,89 11,50"
        fill="#312E81"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      <Polygon
        points="50,19 81,50 50,81 19,50"
        fill="none"
        stroke={trim.metalHighlight}
        strokeWidth={2}
      />
      <Path
        d="M 24 50 C 34 34, 66 34, 76 50 C 66 66, 34 66, 24 50 Z"
        fill="#E0F2FE"
        stroke={STROKE}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Circle cx={50} cy={50} r={11.5} fill="#06B6D4" stroke={STROKE} strokeWidth={2.6} />
      <Circle cx={50} cy={50} r={5.5} fill="#FFFFFF" />
      <Circle cx={45} cy={45} r={2.3} fill="#FFFFFF" />
      <Circle cx={50} cy={11} r={3.5} fill={trim.gem} stroke={STROKE} strokeWidth={2} />
      <Circle cx={50} cy={89} r={3.5} fill={trim.gem} stroke={STROKE} strokeWidth={2} />
    </Svg>
    ),
  },

  'Crystal Orb': {
    tapStyle: 'arcane',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* 3-pronged metal pedestal */}
      <Path
        d="M 26 85 L 34 67 L 66 67 L 74 85 Z"
        fill={trim.metal}
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <Path
        d="M 28 69 L 23 56 L 34 64 M 72 69 L 77 56 L 66 64 M 50 74 L 50 61"
        fill="none"
        stroke={STROKE}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Faceted levitating cyan crystal sphere */}
      <Circle cx={50} cy={42} r={25} fill="#22D3EE" stroke={STROKE} strokeWidth={3.4} />
      <Polygon points="50,19 67,33 61,56 39,56 33,33" fill="#67E8F9" />
      <Polygon points="50,24 62,36 50,51 38,36" fill="#CFFAFE" />
      <Path
        d="M 50 17 L 50 67 M 26 38 L 74 38"
        stroke="#0891B2"
        strokeWidth={1.8}
        opacity={0.55}
      />
      <Circle cx={39} cy={31} r={4.5} fill="#FFFFFF" />
      <Circle cx={33} cy={39} r={2} fill="#FFFFFF" />
    </Svg>
    ),
  },

  'Clairvoyant Sphere': {
    tapStyle: 'arcane',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Path
        d="M 25 86 C 28 74, 36 70, 50 70 C 64 70, 72 74, 75 86 Z"
        fill="#D97706"
        stroke={STROKE}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      <Path
        d="M 28 74 C 21 65, 22 55, 28 50 L 33 59 Z M 72 74 C 79 65, 78 55, 72 50 L 67 59 Z"
        fill={COLORS.actionYellow}
        stroke={STROKE}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      {/* Deep-cosmos purple crystal ball */}
      <Circle cx={50} cy={45} r={27} fill="#4C1D95" stroke={STROKE} strokeWidth={3.4} />
      <Path
        d="M 33 52 C 35 37, 52 31, 62 40 C 69 47, 62 60, 48 58 C 40 57, 39 48, 46 45"
        fill="none"
        stroke="#C084FC"
        strokeWidth={4.5}
        strokeLinecap="round"
      />
      {/* Twinkling cosmos stars inside */}
      <Polygon points="56,31 58,36 63,38 58,40 56,45 54,40 49,38 54,36" fill={COLORS.actionYellow} />
      <Circle cx={38} cy={40} r={2.2} fill="#FFFFFF" />
      <Circle cx={61} cy={53} r={2} fill="#FFFFFF" />
      <Path
        d="M 31 35 C 34 27, 41 23, 49 23"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={3.2}
        strokeLinecap="round"
      />
    </Svg>
    ),
  },

  "Fortune's Eye": {
    tapStyle: 'arcane',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Path
        d="M 30 85 L 37 70 L 63 70 L 70 85 Z"
        fill="#F59E0B"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      {/* Outer golden bezel ring */}
      <Circle cx={50} cy={46} r={29} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={3.3} />
      <Circle cx={50} cy={46} r={23} fill="#059669" stroke={STROKE} strokeWidth={3} />
      <Circle cx={50} cy={46} r={16} fill="#10B981" />
      {/* 4-point golden star pupil */}
      <Polygon
        points="50,27 55,41 69,46 55,51 50,65 45,51 31,46 45,41"
        fill={COLORS.actionYellow}
        stroke={STROKE}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <Circle cx={50} cy={46} r={3.5} fill="#FFFFFF" />
      <Circle cx={36} cy={33} r={3.2} fill="#FFFFFF" />
    </Svg>
    ),
  },

  'Seeker Lens': {
    tapStyle: 'arcane',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Warm golden discovery rays */}
      <G stroke={COLORS.actionYellow} strokeWidth={3.2} strokeLinecap="round">
        <Line x1={43} y1={8} x2={43} y2={15} />
        <Line x1={16} y1={20} x2={22} y2={25} />
        <Line x1={70} y1={20} x2={64} y2={25} />
        <Line x1={10} y1={44} x2={17} y2={44} />
      </G>
      {/* Diagonal brass & wood handle */}
      <Path
        d="M 58 58 L 86 86"
        stroke={STROKE}
        strokeWidth={13}
        strokeLinecap="round"
      />
      <Path
        d="M 58 58 L 86 86"
        stroke="#B45309"
        strokeWidth={7}
        strokeLinecap="round"
      />
      <Path d="M 60 60 L 66 66" stroke={trim.metal} strokeWidth={8} strokeLinecap="round" />
      <Circle cx={43} cy={43} r={25} fill="#F59E0B" stroke={STROKE} strokeWidth={3.4} />
      <Circle cx={43} cy={43} r={19} fill="#FEF9C3" stroke={STROKE} strokeWidth={2.8} />
      {/* Glowing filament spark inside lens */}
      <Path
        d="M 38 52 L 38 43 C 35 37, 51 37, 48 43 L 48 52"
        fill="none"
        stroke="#EA580C"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M 30 34 C 33 29, 38 27, 44 28"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={3.4}
        strokeLinecap="round"
      />
    </Svg>
    ),
  },

  'Field Stone': {
    tapStyle: 'vitality',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Chiseled standing rune tablet */}
      <Polygon
        points="27,86 23,28 36,15 65,16 77,30 73,86"
        fill="#64748B"
        stroke={STROKE}
        strokeWidth={3.4}
        strokeLinejoin="round"
      />
      {/* Beveled lighter stone face */}
      <Polygon points="31,82 28,31 38,21 62,22 69,32 66,82" fill="#94A3B8" />
      {/* Glowing 3x3 card-grid glyph */}
      <G fill={COLORS.logicTeal} stroke={STROKE} strokeWidth={1.8}>
        <Rect x={35} y={33} width={8} height={10} rx={1.5} />
        <Rect x={46} y={33} width={8} height={10} rx={1.5} />
        <Rect x={57} y={33} width={8} height={10} rx={1.5} />
        <Rect x={35} y={46} width={8} height={10} rx={1.5} />
        <Rect x={46} y={46} width={8} height={10} rx={1.5} fill={COLORS.actionYellow} />
        <Rect x={57} y={46} width={8} height={10} rx={1.5} />
        <Rect x={35} y={59} width={8} height={10} rx={1.5} />
        <Rect x={46} y={59} width={8} height={10} rx={1.5} />
        <Rect x={57} y={59} width={8} height={10} rx={1.5} />
      </G>
      {/* Lush emerald moss tufts at base & shoulder */}
      <Path
        d="M 19 87 C 21 77, 30 76, 35 82 C 40 76, 51 78, 53 87 Z"
        fill="#10B981"
        stroke={STROKE}
        strokeWidth={2.9}
        strokeLinejoin="round"
      />
      <Path
        d="M 60 20 C 66 13, 75 16, 76 25 C 69 25, 64 23, 60 20 Z"
        fill="#10B981"
        stroke={STROKE}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
    </Svg>
    ),
  },

  'Terra Foundation': {
    tapStyle: 'vitality',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Glowing emerald crystal spires */}
      <Polygon
        points="33,46 27,20 40,14 46,44"
        fill="#10B981"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <Polygon
        points="50,44 50,10 62,18 60,46"
        fill="#34D399"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <Polygon
        points="63,48 74,24 81,34 72,52"
        fill="#059669"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      {/* Epic floating isometric granite cornerstone */}
      <Polygon
        points="50,36 86,52 50,68 14,52"
        fill="#94A3B8"
        stroke={STROKE}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      <Polygon
        points="14,52 50,68 50,88 18,72"
        fill="#64748B"
        stroke={STROKE}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      <Polygon
        points="86,52 50,68 50,88 82,72"
        fill="#475569"
        stroke={STROKE}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      {/* Glowing emerald rune veins on stone */}
      <Path
        d="M 32 66 L 32 75 M 68 66 L 68 75"
        stroke="#34D399"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Circle cx={50} cy={52} r={4.5} fill={trim.gem} stroke={STROKE} strokeWidth={2.2} />
    </Svg>
    ),
  },

  'Growth Seed': {
    tapStyle: 'vitality',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Sprout stem & two vibrant emerald leaves */}
      <Path d="M 50 48 L 50 25" stroke={STROKE} strokeWidth={5} strokeLinecap="round" />
      <Path
        d="M 50 32 C 33 32, 23 22, 26 13 C 38 12, 49 20, 50 32 Z"
        fill="#10B981"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <Path
        d="M 50 28 C 67 28, 77 18, 74 10 C 62 9, 51 17, 50 28 Z"
        fill="#34D399"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      {/* Plump golden-acorn seed body */}
      <Path
        d="M 28 54 C 26 72, 37 85, 50 89 C 63 85, 74 72, 72 54 Z"
        fill="#F59E0B"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      <Path
        d="M 50 87 C 61 82, 69 71, 69 55 L 59 55 C 59 69, 55 79, 50 87 Z"
        fill="#D97706"
      />
      <Path
        d="M 23 55 C 23 42, 36 38, 50 38 C 64 38, 77 42, 77 55 Z"
        fill="#78350F"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      {/* Glowing life crack on acorn */}
      <Path
        d="M 48 56 L 44 65 L 52 71 L 49 80"
        fill="none"
        stroke="#FEF08A"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={37} cy={64} r={2.8} fill="#FFFFFF" />
    </Svg>
    ),
  },

  'Life Bloom': {
    tapStyle: 'vitality',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Emerald base sepal leaves */}
      <Path
        d="M 50 74 C 32 82, 16 77, 13 66 C 25 62, 39 65, 50 74 Z"
        fill="#10B981"
        stroke={STROKE}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Path
        d="M 50 74 C 68 82, 84 77, 87 66 C 75 62, 61 65, 50 74 Z"
        fill="#10B981"
        stroke={STROKE}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {/* Outer rose lotus petals */}
      <Path
        d="M 50 72 C 26 68, 15 48, 24 31 C 36 35, 45 49, 50 72 Z"
        fill="#EC4899"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <Path
        d="M 50 72 C 74 68, 85 48, 76 31 C 64 35, 55 49, 50 72 Z"
        fill="#EC4899"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      {/* Center radiant lotus petal */}
      <Path
        d="M 50 73 C 33 58, 33 34, 50 18 C 67 34, 67 58, 50 73 Z"
        fill="#FB7185"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      <Path d="M 50 24 C 57 36, 57 52, 50 65" fill="none" stroke="#FFE4E6" strokeWidth={2.5} strokeLinecap="round" />
      {/* Golden stamen & floating pollen motes */}
      <Circle cx={50} cy={56} r={6} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={31} cy={19} r={3.2} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2} />
      <Circle cx={69} cy={19} r={3.2} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2} />
      <Circle cx={50} cy={10} r={2.8} fill="#FEF08A" stroke={STROKE} strokeWidth={1.8} />
    </Svg>
    ),
  },

  'Second Chance': {
    tapStyle: 'vitality',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Path
        d="M 50 54 C 51 70, 59 81, 69 87"
        fill="none"
        stroke={STROKE}
        strokeWidth={6.5}
        strokeLinecap="round"
      />
      <Path
        d="M 50 54 C 51 70, 59 81, 69 87"
        fill="none"
        stroke="#10B981"
        strokeWidth={3}
        strokeLinecap="round"
      />
      {/* 4 lush heart-shaped emerald clover leaves */}
      <Path
        d="M 50 47 C 39 32, 32 15, 43 13 C 48 12, 50 17, 50 19 C 50 17, 52 12, 57 13 C 68 15, 61 32, 50 47 Z"
        fill="#10B981"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <Path
        d="M 50 47 C 39 62, 32 79, 43 81 C 48 82, 50 77, 50 75 C 50 77, 52 82, 57 81 C 68 79, 61 62, 50 47 Z"
        fill="#059669"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <Path
        d="M 50 47 C 35 36, 18 29, 16 40 C 15 45, 20 47, 22 47 C 20 47, 15 49, 16 54 C 18 65, 35 58, 50 47 Z"
        fill="#10B981"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <Path
        d="M 50 47 C 65 36, 82 29, 84 40 C 85 45, 80 47, 78 47 C 80 47, 85 49, 84 54 C 82 65, 65 58, 50 47 Z"
        fill="#34D399"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      {/* Center rarity pin & dewdrop glint */}
      <Circle cx={50} cy={47} r={5} fill={trim.gem} stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={69} cy={41} r={3.2} fill="#E0F2FE" stroke={STROKE} strokeWidth={1.6} />
    </Svg>
    ),
  },

  "Fortune's Shield": {
    tapStyle: 'vitality',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Outer brass buckler rim */}
      <Circle cx={50} cy={50} r={38} fill="#F59E0B" stroke={STROKE} strokeWidth={3.4} />
      <Circle cx={50} cy={17} r={2.2} fill={STROKE} />
      <Circle cx={50} cy={83} r={2.2} fill={STROKE} />
      <Circle cx={17} cy={50} r={2.2} fill={STROKE} />
      <Circle cx={83} cy={50} r={2.2} fill={STROKE} />
      {/* Deep emerald buckler field */}
      <Circle cx={50} cy={50} r={29} fill="#059669" stroke={STROKE} strokeWidth={3} />
      <Path d="M 30 30 A 28 28 0 0 1 70 30" fill="none" stroke="#34D399" strokeWidth={3} strokeLinecap="round" />
      {/* Embossed golden clover crest */}
      <G fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.6}>
        <Circle cx={50} cy={38} r={8} />
        <Circle cx={50} cy={62} r={8} />
        <Circle cx={38} cy={50} r={8} />
        <Circle cx={62} cy={50} r={8} />
      </G>
      <Circle cx={50} cy={50} r={5} fill={trim.gem} stroke={STROKE} strokeWidth={2.2} />
    </Svg>
    ),
  },

  'Fortune Token': {
    tapStyle: 'vitality',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Outer gold coin bezel */}
      <Circle cx={50} cy={50} r={38} fill="#F59E0B" stroke={STROKE} strokeWidth={3.4} />
      <Circle cx={50} cy={50} r={30} fill="#10B981" stroke={STROKE} strokeWidth={3} />
      {/* Golden yin-yang swirl half */}
      <Path
        d="M 50 20 A 30 30 0 0 1 50 80 A 15 15 0 0 1 50 50 A 15 15 0 0 0 50 20 Z"
        fill={COLORS.actionYellow}
        stroke={STROKE}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      <Circle cx={50} cy={35} r={5} fill="#10B981" stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={50} cy={65} r={5} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.4} />
      <Path d="M 24 34 C 28 25, 36 20, 44 19" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
    ),
  },

  'Snowball': {
    tapStyle: 'vitality',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Polygon
        points="50,9 56,22 50,28 44,22"
        fill="#67E8F9"
        stroke={STROKE}
        strokeWidth={2.7}
        strokeLinejoin="round"
      />
      <Polygon
        points="27,18 38,26 35,33 26,28"
        fill="#38BDF8"
        stroke={STROKE}
        strokeWidth={2.7}
        strokeLinejoin="round"
      />
      <Polygon
        points="73,18 74,28 65,33 62,26"
        fill="#38BDF8"
        stroke={STROKE}
        strokeWidth={2.7}
        strokeLinejoin="round"
      />
      <Circle cx={50} cy={56} r={30} fill="#E0F2FE" stroke={STROKE} strokeWidth={3.4} />
      {/* Cool icy shadow crescent */}
      <Path
        d="M 72 37 C 81 49, 77 69, 63 79 C 49 88, 32 85, 24 74 C 37 81, 55 78, 65 66 C 72 57, 75 46, 72 37 Z"
        fill="#7DD3FC"
      />
      {/* Crisp 6-point snowflake emblem */}
      <G stroke="#0284C7" strokeWidth={2.8} strokeLinecap="round">
        <Line x1={50} y1={42} x2={50} y2={66} />
        <Line x1={39} y1={48} x2={61} y2={60} />
        <Line x1={61} y1={48} x2={39} y2={60} />
      </G>
      <Circle cx={36} cy={40} r={3.5} fill="#FFFFFF" />
    </Svg>
    ),
  },

  'Life Vessel': {
    tapStyle: 'vitality',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Polygon
        points="43,12 57,12 55,24 45,24"
        fill="#D97706"
        stroke={STROKE}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {/* Glass flask neck & collar */}
      <Rect
        x={40}
        y={22}
        width={20}
        height={10}
        rx={3}
        fill="#E0F2FE"
        stroke={STROKE}
        strokeWidth={3}
      />
      <Rect x={38} y={30} width={24} height={5} rx={2} fill={trim.metal} stroke={STROKE} strokeWidth={2.5} />
      <Path
        d="M 50 88 C 28 76, 18 59, 22 44 C 25 34, 37 33, 45 39 L 50 43 L 55 39 C 63 33, 75 34, 78 44 C 82 59, 72 76, 50 88 Z"
        fill="#E0F2FE"
        stroke={STROKE}
        strokeWidth={3.4}
        strokeLinejoin="round"
      />
      {/* Glowing ruby potion liquid */}
      <Path
        d="M 50 83 C 32 73, 25 59, 27 49 Q 50 54 73 49 C 75 59, 68 73, 50 83 Z"
        fill="#E11D48"
        stroke={STROKE}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      {/* Specular bubbles & glass shine */}
      <Circle cx={44} cy={65} r={3.2} fill="#FDA4AF" />
      <Circle cx={55} cy={59} r={2} fill="#FFFFFF" />
      <Path d="M 29 45 C 31 40, 36 39, 40 41" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
    </Svg>
    ),
  },

  'Mending Charm': {
    tapStyle: 'vitality',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Cute white-and-gold mini wings */}
      <Path
        d="M 28 45 L 9 34 C 9 44, 14 51, 23 53 C 15 56, 18 64, 29 61 Z"
        fill="#FFFFFF"
        stroke={STROKE}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Path
        d="M 72 45 L 91 34 C 91 44, 86 51, 77 53 C 85 56, 82 64, 71 61 Z"
        fill="#FFFFFF"
        stroke={STROKE}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Circle cx={50} cy={23} r={6} fill="none" stroke={STROKE} strokeWidth={5.5} />
      <Circle cx={50} cy={23} r={6} fill="none" stroke={COLORS.actionYellow} strokeWidth={2.5} />
      {/* Warm rose-red shining heart amulet */}
      <Path
        d="M 50 84 C 31 72, 22 57, 24 43 C 26 32, 36 28, 45 34 L 50 39 L 55 34 C 64 28, 74 32, 76 43 C 78 57, 69 72, 50 84 Z"
        fill="#F43F5E"
        stroke={STROKE}
        strokeWidth={3.4}
        strokeLinejoin="round"
      />
      {/* White healing sparkle cross */}
      <Polygon
        points="50,45 53,53 61,56 53,59 50,67 47,59 39,56 47,53"
        fill="#FFFFFF"
        stroke={STROKE}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M 32 42 C 34 37, 38 36, 42 37" fill="none" stroke="#FFE4E6" strokeWidth={2.8} strokeLinecap="round" />
    </Svg>
    ),
  },

  'Vital Core': {
    tapStyle: 'vitality',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Crystalline ruby heart core */}
      <Polygon
        points="50,89 21,58 24,32 40,22 50,31 60,22 76,32 79,58"
        fill="#E11D48"
        stroke={STROKE}
        strokeWidth={3.4}
        strokeLinejoin="round"
      />
      <Polygon points="50,31 40,24 27,34 38,52 50,48" fill="#FB7185" />
      <Polygon points="50,48 62,52 50,85" fill="#9F1239" />
      {/* Golden filigree ribs encasing the ruby */}
      <Path
        d="M 22 44 Q 50 56 78 44 M 25 60 Q 50 72 75 60 M 50 29 L 50 88"
        fill="none"
        stroke={STROKE}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <Path
        d="M 22 44 Q 50 56 78 44 M 25 60 Q 50 72 75 60 M 50 29 L 50 88"
        fill="none"
        stroke={COLORS.actionYellow}
        strokeWidth={3.4}
        strokeLinecap="round"
      />
      <Circle cx={50} cy={52} r={5.5} fill="#FFFFFF" stroke={STROKE} strokeWidth={2.4} />
    </Svg>
    ),
  },

  'Chrono Shard': {
    tapStyle: 'chrono',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Line x1={27} y1={18} x2={27} y2={82} stroke={STROKE} strokeWidth={7} />
      <Line x1={27} y1={18} x2={27} y2={82} stroke="#F59E0B" strokeWidth={3} />
      <Line x1={73} y1={18} x2={73} y2={82} stroke={STROKE} strokeWidth={7} />
      <Line x1={73} y1={18} x2={73} y2={82} stroke="#F59E0B" strokeWidth={3} />
      <Path
        d="M 31 18 L 69 18 C 69 36, 55 46, 53 50 C 55 54, 69 64, 69 82 L 31 82 C 31 64, 45 54, 47 50 C 45 46, 31 36, 31 18 Z"
        fill="#E0F2FE"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      {/* Glowing golden sand & trickle */}
      <Path d="M 38 33 L 62 33 C 59 41, 53 46, 50 48 C 47 46, 41 41, 38 33 Z" fill={COLORS.actionYellow} />
      <Line x1={50} y1={48} x2={50} y2={70} stroke={COLORS.actionYellow} strokeWidth={3} />
      <Path d="M 34 80 Q 50 64 66 80 Z" fill="#F59E0B" />
      {/* Wood & brass end caps */}
      <Rect x={20} y={11} width={60} height={8} rx={3} fill="#92400E" stroke={STROKE} strokeWidth={3.1} />
      <Rect x={20} y={81} width={60} height={8} rx={3} fill="#92400E" stroke={STROKE} strokeWidth={3.1} />
    </Svg>
    ),
  },

  'Temporal Core': {
    tapStyle: 'chrono',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Tilted golden astrolabe rings */}
      <Ellipse
        cx={50}
        cy={50}
        rx={41}
        ry={15}
        transform="rotate(-28 50 50)"
        fill="none"
        stroke={STROKE}
        strokeWidth={7.5}
      />
      <Ellipse
        cx={50}
        cy={50}
        rx={41}
        ry={15}
        transform="rotate(-28 50 50)"
        fill="none"
        stroke={COLORS.actionYellow}
        strokeWidth={3.5}
      />
      <Ellipse
        cx={50}
        cy={50}
        rx={41}
        ry={15}
        transform="rotate(28 50 50)"
        fill="none"
        stroke={STROKE}
        strokeWidth={7.5}
      />
      <Ellipse
        cx={50}
        cy={50}
        rx={41}
        ry={15}
        transform="rotate(28 50 50)"
        fill="none"
        stroke={trim.metal}
        strokeWidth={3.5}
      />
      <Polygon
        points="34,20 66,20 53,50 66,80 34,80 47,50"
        fill="#312E81"
        stroke={STROKE}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      <Polygon points="40,28 60,28 50,47" fill="#38BDF8" />
      <Polygon points="50,55 61,76 39,76" fill={COLORS.actionYellow} />
      <Rect x={30} y={15} width={40} height={6} rx={2.5} fill="#F59E0B" stroke={STROKE} strokeWidth={2.8} />
      <Rect x={30} y={79} width={40} height={6} rx={2.5} fill="#F59E0B" stroke={STROKE} strokeWidth={2.8} />
    </Svg>
    ),
  },

  'Hourglass of Ages': {
    tapStyle: 'chrono',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Feathered eternity side wings */}
      <Path
        d="M 32 45 L 8 28 C 8 41, 14 48, 22 50 C 12 54, 15 65, 31 61 Z"
        fill="#F8FAFC"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <Path
        d="M 68 45 L 92 28 C 92 41, 86 48, 78 50 C 88 54, 85 65, 69 61 Z"
        fill="#F8FAFC"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <Path
        d="M 33 19 L 67 19 C 67 36, 54 46, 52 50 C 54 54, 67 64, 67 81 L 33 81 C 33 64, 46 54, 48 50 C 46 46, 33 36, 33 19 Z"
        fill="#FFFBEB"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      <Path d="M 39 32 L 61 32 L 50 47 Z" fill={COLORS.logicTeal} />
      <Line x1={50} y1={47} x2={50} y2={71} stroke={COLORS.logicTeal} strokeWidth={2.8} />
      <Path d="M 36 79 Q 50 64 64 79 Z" fill={COLORS.logicTeal} />
      <Rect x={28} y={12} width={44} height={8} rx={3} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={3} />
      <Rect x={28} y={80} width={44} height={8} rx={3} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={3} />
    </Svg>
    ),
  },

  'Time Drop': {
    tapStyle: 'chrono',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Top loop & tactile crown button */}
      <Circle cx={50} cy={13} r={6.5} fill="none" stroke={STROKE} strokeWidth={5} />
      <Rect x={44} y={17} width={12} height={8} rx={2.5} fill="#F59E0B" stroke={STROKE} strokeWidth={2.9} />
      <Rect x={70} y={24} width={8} height={6} rx={2} transform="rotate(38 74 27)" fill={trim.metal} stroke={STROKE} strokeWidth={2.6} />
      {/* Brass pocket-stopwatch case */}
      <Circle cx={50} cy={56} r={32} fill="#F59E0B" stroke={STROKE} strokeWidth={3.4} />
      <Circle cx={50} cy={56} r={25} fill="#CCFBF1" stroke={STROKE} strokeWidth={2.9} />
      <Path d="M 50 56 L 50 34 A 22 22 0 0 1 69 45 Z" fill={COLORS.logicTeal} opacity={0.45} />
      {/* Crisp clock ticks & hands */}
      <G stroke={STROKE} strokeWidth={3} strokeLinecap="round">
        <Line x1={50} y1={34} x2={50} y2={38} />
        <Line x1={50} y1={74} x2={50} y2={78} />
        <Line x1={28} y1={56} x2={32} y2={56} />
        <Line x1={68} y1={56} x2={72} y2={56} />
        <Line x1={50} y1={56} x2={50} y2={40} />
        <Line x1={50} y1={56} x2={63} y2={50} stroke="#E11D48" />
      </G>
      <Circle cx={50} cy={56} r={3.5} fill={STROKE} />
    </Svg>
    ),
  },

  'Temporal Rift': {
    tapStyle: 'chrono',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Jagged spacetime portal tear */}
      <Polygon
        points="50,8 65,24 88,22 76,45 92,62 70,72 64,92 46,77 20,86 28,60 10,44 33,34"
        fill="#581C87"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      {/* Swirling cyan-violet inner vortex */}
      <Circle cx={50} cy={51} r={22} fill="#9333EA" stroke="#22D3EE" strokeWidth={3.2} />
      <Path
        d="M 36 51 C 36 39, 54 35, 60 46 C 65 55, 53 65, 43 60 C 37 56, 42 47, 50 49"
        fill="none"
        stroke="#67E8F9"
        strokeWidth={4}
        strokeLinecap="round"
      />
      {/* Floating broken clock-hand shards */}
      <Polygon
        points="50,51 44,25 53,31"
        fill={COLORS.actionYellow}
        stroke={STROKE}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      <Polygon
        points="50,51 74,44 66,55"
        fill={COLORS.actionYellow}
        stroke={STROKE}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      <Circle cx={50} cy={51} r={4} fill="#FFFFFF" stroke={STROKE} strokeWidth={2.2} />
    </Svg>
    ),
  },

  'Echo Stone': {
    tapStyle: 'arcane',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Concentric teal/gold sonic wave rings */}
      <Path
        d="M 22 28 A 36 36 0 0 0 22 72 M 78 28 A 36 36 0 0 1 78 72"
        fill="none"
        stroke={COLORS.logicTeal}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <Path
        d="M 13 20 A 46 46 0 0 0 13 80 M 87 20 A 46 46 0 0 1 87 80"
        fill="none"
        stroke={COLORS.actionYellow}
        strokeWidth={3}
        strokeLinecap="round"
      />
      {/* Smooth turquoise river-rune stone */}
      <Ellipse cx={50} cy={50} rx={21} ry={27} fill="#0F766E" stroke={STROKE} strokeWidth={3.4} />
      <Ellipse cx={48} cy={48} rx={15} ry={21} fill={COLORS.logicTeal} />
      {/* Glowing spiral echo rune */}
      <Path
        d="M 50 36 C 58 36, 61 46, 55 53 C 49 60, 39 56, 41 47 C 42 42, 49 42, 50 48"
        fill="none"
        stroke="#FEF08A"
        strokeWidth={3.2}
        strokeLinecap="round"
      />
    </Svg>
    ),
  },

  'Tabula Rasa': {
    tapStyle: 'chrono',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={38} fill="#F59E0B" stroke={STROKE} strokeWidth={3.4} />
      {/* Deep emerald radar disc */}
      <Circle cx={50} cy={50} r={30} fill="#064E3B" stroke={STROKE} strokeWidth={3} />
      {/* Sweeping luminous radar sector */}
      <Path d="M 50 50 L 50 21 A 29 29 0 0 1 77 39 Z" fill="#34D399" opacity={0.75} />
      {/* Concentric astrolabe ring & crosshairs */}
      <Circle cx={50} cy={50} r={17} fill="none" stroke="#10B981" strokeWidth={2.2} />
      <Line x1={21} y1={50} x2={79} y2={50} stroke="#10B981" strokeWidth={2} />
      <Line x1={50} y1={21} x2={50} y2={79} stroke="#10B981" strokeWidth={2} />
      {/* Sweep hand & glowing target blip */}
      <Line x1={50} y1={50} x2={75} y2={38} stroke="#FEF08A" strokeWidth={3} strokeLinecap="round" />
      <Circle cx={64} cy={35} r={3.2} fill="#FFFFFF" />
      <Circle cx={50} cy={15} r={2.6} fill="#FEF08A" stroke={STROKE} strokeWidth={1.6} />
      <Circle cx={50} cy={85} r={2.6} fill="#FEF08A" stroke={STROKE} strokeWidth={1.6} />
      <Circle cx={15} cy={50} r={2.6} fill="#FEF08A" stroke={STROKE} strokeWidth={1.6} />
      <Circle cx={85} cy={50} r={2.6} fill="#FEF08A" stroke={STROKE} strokeWidth={1.6} />
      <Circle cx={50} cy={50} r={4.2} fill={trim.gem} stroke={STROKE} strokeWidth={2.2} />
    </Svg>
    ),
  },
};
