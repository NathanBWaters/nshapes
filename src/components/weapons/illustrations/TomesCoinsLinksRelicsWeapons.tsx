import React from 'react';
import { Svg, Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { STROKE } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { WeaponRelic } from '../types';

export const TOMES_COINS_LINKS_RELICS_WEAPON_RELICS: Record<string, WeaponRelic> = {
  "Scholar's Tome": {
    tapStyle: 'tome',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Path
        d="M 11 32 L 46 39 L 54 39 L 89 32 L 86 78 L 54 84 L 46 84 L 14 78 Z"
        fill="#1D4ED8"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      <Path
        d="M 16 26 C 28 22, 41 25, 50 33 C 59 25, 72 22, 84 26 L 81 71 C 70 67, 59 70, 50 77 C 41 70, 30 67, 19 71 Z"
        fill="#FFF7ED"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <Line x1={50} y1={33} x2={50} y2={77} stroke={STROKE} strokeWidth={2.6} />
      {/* Scholar rune lines on left page */}
      <G stroke="#64748B" strokeWidth={2.4} strokeLinecap="round">
        <Line x1={25} y1={38} x2={42} y2={41} />
        <Line x1={25} y1={47} x2={42} y2={50} />
        <Line x1={25} y1={56} x2={38} y2={58} />
      </G>
      <Polygon
        points="46,76 54,76 55,92 50,87 45,92"
        fill="#E11D48"
        stroke={STROKE}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {/* Golden feather quill poised over right page */}
      <Path
        d="M 56 56 C 60 36, 73 19, 88 14 C 86 31, 76 46, 61 52 Z"
        fill={COLORS.actionYellow}
        stroke={STROKE}
        strokeWidth={2.9}
        strokeLinejoin="round"
      />
      <Line x1={53} y1={60} x2={82} y2={21} stroke={STROKE} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
    ),
  },

  'Arcane Codex': {
    tapStyle: 'tome',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Path
        d="M 10 52 L 46 58 L 54 58 L 90 52 L 86 83 L 54 88 L 46 88 L 14 83 Z"
        fill="#7E22CE"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      <Polygon points="10,52 21,54 20,63 11,61" fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.2} />
      <Polygon points="90,52 79,54 80,63 89,61" fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.2} />
      <Path
        d="M 16 47 C 28 43, 41 46, 50 53 C 59 46, 72 43, 84 47 L 81 76 C 70 72, 59 74, 50 81 C 41 74, 30 72, 19 76 Z"
        fill="#FAF5FF"
        stroke={STROKE}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Line x1={50} y1={53} x2={50} y2={81} stroke={STROKE} strokeWidth={2.6} />
      {/* Levitating arcane star sigil above open pages */}
      <Circle cx={50} cy={29} r={18} fill="none" stroke={STROKE} strokeWidth={5.5} />
      <Circle cx={50} cy={29} r={18} fill="none" stroke="#C084FC" strokeWidth={2.6} />
      <Polygon
        points="50,11 55,24 68,29 55,34 50,47 45,34 32,29 45,24"
        fill={COLORS.actionYellow}
        stroke={STROKE}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <Circle cx={50} cy={29} r={4} fill="#FFFFFF" />
    </Svg>
    ),
  },

  'Wisdom Chain': {
    tapStyle: 'connector',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={24} cy={21} r={7.5} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.6} />
      <Circle cx={50} cy={15} r={8.5} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.6} />
      <Circle cx={76} cy={21} r={7.5} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.6} />
      {/* Closed royal tome bound in golden chains */}
      <Rect
        x={20}
        y={34}
        width={60}
        height={50}
        rx={6}
        fill="#1E3A8A"
        stroke={STROKE}
        strokeWidth={3.4}
      />
      <Rect x={20} y={34} width={11} height={50} rx={4} fill="#172554" stroke={STROKE} strokeWidth={3} />
      <G stroke={STROKE} strokeWidth={7.5} strokeLinecap="round">
        <Line x1={22} y1={42} x2={78} y2={76} />
        <Line x1={78} y1={42} x2={22} y2={76} />
      </G>
      <G stroke={COLORS.actionYellow} strokeWidth={3.6} strokeLinecap="round" strokeDasharray="6 4">
        <Line x1={22} y1={42} x2={78} y2={76} />
        <Line x1={78} y1={42} x2={22} y2={76} />
      </G>
      {/* Central lock medallion & glowing bookmarklet */}
      <Circle cx={50} cy={59} r={10} fill="#F59E0B" stroke={STROKE} strokeWidth={3} />
      <Circle cx={50} cy={59} r={4.5} fill={trim.gem} stroke={STROKE} strokeWidth={2} />
      <Polygon points="62,84 70,84 71,95 66,91 61,95" fill={COLORS.logicTeal} stroke={STROKE} strokeWidth={2.4} />
    </Svg>
    ),
  },

  "Fortune's Favor": {
    tapStyle: 'coin',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Gleaming beveled golden sovereign coin */}
      <Circle cx={50} cy={52} r={35} fill="#F59E0B" stroke={STROKE} strokeWidth={3.4} />
      <Circle cx={50} cy={52} r={27} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.8} />
      {/* Stamped 3-point royal crown */}
      <Polygon
        points="33,63 31,42 43,50 50,36 57,50 69,42 67,63"
        fill="#F59E0B"
        stroke={STROKE}
        strokeWidth={2.9}
        strokeLinejoin="round"
      />
      <Circle cx={50} cy={56} r={3} fill={trim.gem} stroke={STROKE} strokeWidth={1.8} />
      {/* 4-point star sparkle */}
      <Polygon
        points="78,12 81,20 89,23 81,26 78,34 75,26 67,23 75,20"
        fill="#FFFFFF"
        stroke={STROKE}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <Path d="M 23 38 C 27 29, 34 23, 43 21" fill="none" stroke="#FFFFFF" strokeWidth={3.2} strokeLinecap="round" />
    </Svg>
    ),
  },

  "Fortune's Blessing": {
    tapStyle: 'coin',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Ellipse cx={50} cy={17} rx={22} ry={6.5} fill="none" stroke={STROKE} strokeWidth={6.5} />
      <Ellipse cx={50} cy={17} rx={22} ry={6.5} fill="none" stroke={COLORS.actionYellow} strokeWidth={3} />
      <Path
        d="M 30 50 L 7 32 C 7 46, 13 55, 22 57 C 13 61, 17 72, 31 67 Z"
        fill="#FFFFFF"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <Path
        d="M 70 50 L 93 32 C 93 46, 87 55, 78 57 C 87 61, 83 72, 69 67 Z"
        fill="#FFFFFF"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <Circle cx={50} cy={57} r={25} fill="#F59E0B" stroke={STROKE} strokeWidth={3.3} />
      <Circle cx={50} cy={57} r={19} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.6} />
      <Polygon
        points="50,42 54,53 65,57 54,61 50,72 46,61 35,57 46,53"
        fill="#FFFFFF"
        stroke={STROKE}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
    </Svg>
    ),
  },

  'Link Stone': {
    tapStyle: 'connector',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Path
        d="M 50 86 C 28 72, 18 55, 20 40 C 22 27, 34 22, 44 29 L 50 35 L 56 29 C 66 22, 78 27, 80 40 C 82 55, 72 72, 50 86 Z"
        fill="#FB7185"
        stroke={STROKE}
        strokeWidth={3.4}
        strokeLinejoin="round"
      />
      <Path d="M 50 83 C 67 70, 76 55, 77 42 L 50 54 Z" fill="#E11D48" />
      {/* Wrapped iron chain diagonal bands */}
      <G stroke={STROKE} strokeWidth={9} strokeLinecap="round">
        <Line x1={21} y1={43} x2={76} y2={63} />
        <Line x1={79} y1={43} x2={24} y2={63} />
      </G>
      <G stroke="#94A3B8" strokeWidth={4} strokeLinecap="round" strokeDasharray="7 5">
        <Line x1={21} y1={43} x2={76} y2={63} />
        <Line x1={79} y1={43} x2={24} y2={63} />
      </G>
      <Circle cx={50} cy={53} r={6} fill={trim.metalHighlight} stroke={STROKE} strokeWidth={2.6} />
    </Svg>
    ),
  },

  'Revenge Linker': {
    tapStyle: 'connector',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Jagged split left crimson heart half */}
      <Path
        d="M 46 84 C 26 71, 16 55, 18 40 C 20 28, 31 23, 41 30 L 47 36 L 42 48 L 48 59 L 42 71 Z"
        fill="#E11D48"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      {/* Jagged split right crimson heart half */}
      <Path
        d="M 54 84 C 74 71, 84 55, 82 40 C 80 28, 69 23, 59 30 L 53 36 L 49 47 L 56 58 L 50 70 Z"
        fill="#9F1239"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      {/* Crackling violet lightning chains stitching halves */}
      <G stroke={STROKE} strokeWidth={6.5} strokeLinecap="round">
        <Line x1={33} y1={45} x2={67} y2={42} />
        <Line x1={35} y1={60} x2={65} y2={63} />
      </G>
      <G stroke="#C084FC" strokeWidth={3.2} strokeLinecap="round">
        <Line x1={33} y1={45} x2={67} y2={42} />
        <Line x1={35} y1={60} x2={65} y2={63} />
      </G>
      <Polygon
        points="50,18 45,35 53,35 47,53"
        fill="none"
        stroke={COLORS.actionYellow}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
    ),
  },

  'Web Spinner': {
    tapStyle: 'connector',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* 8 symmetric radial silk spokes */}
      <G stroke={STROKE} strokeWidth={3.2} strokeLinecap="round">
        <Line x1={50} y1={12} x2={50} y2={88} />
        <Line x1={12} y1={50} x2={88} y2={50} />
        <Line x1={23} y1={23} x2={77} y2={77} />
        <Line x1={77} y1={23} x2={23} y2={77} />
      </G>
      {/* Outer & inner geometric octagonal web rings */}
      <Polygon
        points="50,16 74,26 84,50 74,74 50,84 26,74 16,50 26,26"
        fill="#E0F2FE"
        fillOpacity={0.35}
        stroke={STROKE}
        strokeWidth={2.9}
        strokeLinejoin="round"
      />
      <Polygon
        points="50,31 63,37 69,50 63,63 50,69 37,63 31,50 37,37"
        fill="none"
        stroke="#0284C7"
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <Circle cx={50} cy={50} r={6} fill="#38BDF8" stroke={STROKE} strokeWidth={2.5} />
      <Circle cx={74} cy={26} r={4} fill="#FFFFFF" stroke={STROKE} strokeWidth={2} />
      <Circle cx={26} cy={74} r={3.8} fill="#BAE6FD" stroke={STROKE} strokeWidth={2} />
    </Svg>
    ),
  },

  'Echo Chamber': {
    tapStyle: 'connector',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Left brass metallic sonic ring */}
      <Circle cx={39} cy={50} r={24} fill="none" stroke={STROKE} strokeWidth={11} />
      <Circle cx={39} cy={50} r={24} fill="none" stroke="#F59E0B" strokeWidth={5.2} />
      {/* Right teal metallic sonic ring */}
      <Circle cx={61} cy={50} r={24} fill="none" stroke={STROKE} strokeWidth={11} />
      <Circle cx={61} cy={50} r={24} fill="none" stroke={COLORS.logicTeal} strokeWidth={5.2} />
      <Path d="M 50 29 A 24 24 0 0 1 63 50" fill="none" stroke={STROKE} strokeWidth={11} />
      <Path d="M 50 29 A 24 24 0 0 1 63 50" fill="none" stroke="#F59E0B" strokeWidth={5.2} />
      <Circle cx={50} cy={50} r={5} fill="#FFFFFF" stroke={STROKE} strokeWidth={2.4} />
    </Svg>
    ),
  },

  'Neural Network': {
    tapStyle: 'connector',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <G stroke={STROKE} strokeWidth={6} strokeLinecap="round">
        <Line x1={50} y1={50} x2={24} y2={28} />
        <Line x1={50} y1={50} x2={76} y2={28} />
        <Line x1={50} y1={50} x2={20} y2={64} />
        <Line x1={50} y1={50} x2={80} y2={64} />
        <Line x1={50} y1={50} x2={50} y2={16} />
        <Line x1={50} y1={50} x2={50} y2={84} />
        <Line x1={24} y1={28} x2={50} y2={16} />
        <Line x1={76} y1={28} x2={50} y2={16} />
        <Line x1={20} y1={64} x2={50} y2={84} />
        <Line x1={80} y1={64} x2={50} y2={84} />
      </G>
      <G stroke="#22D3EE" strokeWidth={2.8} strokeLinecap="round">
        <Line x1={50} y1={50} x2={24} y2={28} />
        <Line x1={50} y1={50} x2={76} y2={28} />
        <Line x1={50} y1={50} x2={20} y2={64} />
        <Line x1={50} y1={50} x2={80} y2={64} />
        <Line x1={50} y1={50} x2={50} y2={16} />
        <Line x1={50} y1={50} x2={50} y2={84} />
        <Line x1={24} y1={28} x2={50} y2={16} />
        <Line x1={76} y1={28} x2={50} y2={16} />
        <Line x1={20} y1={64} x2={50} y2={84} />
        <Line x1={80} y1={64} x2={50} y2={84} />
      </G>
      {/* Glowing cyan & magenta synaptic nodes */}
      <Circle cx={50} cy={16} r={7} fill="#EC4899" stroke={STROKE} strokeWidth={2.8} />
      <Circle cx={24} cy={28} r={7} fill="#22D3EE" stroke={STROKE} strokeWidth={2.8} />
      <Circle cx={76} cy={28} r={7} fill="#22D3EE" stroke={STROKE} strokeWidth={2.8} />
      <Circle cx={20} cy={64} r={7} fill="#EC4899" stroke={STROKE} strokeWidth={2.8} />
      <Circle cx={80} cy={64} r={7} fill="#EC4899" stroke={STROKE} strokeWidth={2.8} />
      <Circle cx={50} cy={84} r={7} fill="#22D3EE" stroke={STROKE} strokeWidth={2.8} />
      <Circle cx={50} cy={50} r={12} fill="#A855F7" stroke={STROKE} strokeWidth={3.2} />
      <Circle cx={50} cy={50} r={5.5} fill="#FFFFFF" />
    </Svg>
    ),
  },

  'Desperate Measures': {
    tapStyle: 'explosive',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Path
        d="M 24 46 C 24 23, 36 14, 50 14 C 64 14, 76 23, 76 46 C 76 57, 70 63, 64 66 L 64 79 L 36 79 L 36 66 C 30 63, 24 57, 24 46 Z"
        fill="#FFF7ED"
        stroke={STROKE}
        strokeWidth={3.4}
        strokeLinejoin="round"
      />
      <Line x1={45} y1={70} x2={45} y2={79} stroke={STROKE} strokeWidth={2.6} />
      <Line x1={55} y1={70} x2={55} y2={79} stroke={STROKE} strokeWidth={2.6} />
      {/* Eye sockets (one glowing crimson!) & nasal cavity */}
      <Circle cx={39} cy={47} r={7.5} fill={STROKE} />
      <Circle cx={61} cy={47} r={7.5} fill={STROKE} />
      <Circle cx={61} cy={47} r={4} fill="#EF4444" />
      <Polygon points="50,53 46,62 54,62" fill={STROKE} strokeLinejoin="round" />
      {/* Glowing crimson lightning-crack across cranium */}
      <Path
        d="M 55 15 L 49 28 L 57 32 L 51 42"
        fill="none"
        stroke="#EF4444"
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Golden time-sand leaking from socket & pooling */}
      <Path d="M 39 54 L 39 85" stroke={COLORS.actionYellow} strokeWidth={3.4} strokeLinecap="round" />
      <Path d="M 27 89 Q 39 79 51 89 Z" fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.4} />
    </Svg>
    ),
  },

  'Soul Harvest': {
    tapStyle: 'laser',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Dark obsidian necromancer grimoire */}
      <Rect
        x={19}
        y={14}
        width={62}
        height={72}
        rx={6}
        fill="#18181B"
        stroke={STROKE}
        strokeWidth={3.4}
      />
      <Rect x={19} y={14} width={11} height={72} rx={4} fill="#27272A" stroke={STROKE} strokeWidth={3} />
      <Polygon points="81,14 69,14 81,26" fill={trim.metal} stroke={STROKE} strokeWidth={2.2} />
      <Polygon points="81,86 69,86 81,74" fill={trim.metal} stroke={STROKE} strokeWidth={2.2} />
      <Path
        d="M 57 27 A 18 18 0 1 0 57 73 A 14 14 0 1 1 57 27 Z"
        fill="#E2E8F0"
        stroke={STROKE}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <Circle cx={57} cy={50} r={10} fill="#E11D48" stroke={STROKE} strokeWidth={2.8} />
      <Circle cx={55} cy={47} r={3.5} fill="#FDA4AF" />
    </Svg>
    ),
  },

  'Grace Conduit': {
    tapStyle: 'vitality',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Seraphic white-and-gold angel wing crest */}
      <Path
        d="M 42 50 L 9 25 C 8 42, 15 53, 27 56 C 16 61, 21 74, 40 67 Z"
        fill="#FFFFFF"
        stroke={STROKE}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      <Path
        d="M 58 50 L 91 25 C 92 42, 85 53, 73 56 C 84 61, 79 74, 60 67 Z"
        fill="#FFFFFF"
        stroke={STROKE}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      {/* Bright cyan laser lance channeled vertically */}
      <Polygon
        points="50,6 57,24 54,92 46,92 43,24"
        fill="#22D3EE"
        stroke={STROKE}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Line x1={50} y1={14} x2={50} y2={88} stroke="#FFFFFF" strokeWidth={2.8} strokeLinecap="round" />
      <Circle cx={50} cy={52} r={12} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={3.1} />
      <Circle cx={50} cy={52} r={5.5} fill="#FFFFFF" stroke={STROKE} strokeWidth={2.2} />
    </Svg>
    ),
  },

  'Life Link': {
    tapStyle: 'vitality',
    art: () => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Lit explosive fuse emerging from mended heart */}
      <Path
        d="M 50 34 C 53 20, 65 15, 74 20"
        fill="none"
        stroke={STROKE}
        strokeWidth={5.5}
        strokeLinecap="round"
      />
      <Path
        d="M 50 34 C 53 20, 65 15, 74 20"
        fill="none"
        stroke="#F59E0B"
        strokeWidth={2.6}
        strokeDasharray="3 2.5"
        strokeLinecap="round"
      />
      <Polygon
        points="76,9 79,16 86,19 79,22 76,29 73,22 66,19 73,16"
        fill={COLORS.actionYellow}
        stroke={STROKE}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <Path
        d="M 50 88 C 28 74, 18 57, 20 42 C 22 29, 34 25, 44 32 L 50 38 L 56 32 C 66 25, 78 29, 80 42 C 82 57, 72 74, 50 88 Z"
        fill="#E11D48"
        stroke={STROKE}
        strokeWidth={3.4}
        strokeLinejoin="round"
      />
      {/* Glowing golden kintsugi seams */}
      <Path
        d="M 26 48 L 43 54 L 50 38 M 43 54 L 54 65 L 75 52 M 54 65 L 50 86"
        fill="none"
        stroke={STROKE}
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M 26 48 L 43 54 L 50 38 M 43 54 L 54 65 L 75 52 M 54 65 L 50 86"
        fill="none"
        stroke={COLORS.actionYellow}
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={43} cy={54} r={3.5} fill="#FFFFFF" />
    </Svg>
    ),
  },
};
