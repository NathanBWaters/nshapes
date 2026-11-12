import React from 'react';
import { Svg, Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { STROKE } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { WeaponRelic } from '../types';

export const ELEMENTAL_COMBAT_WEAPON_RELICS: Record<string, WeaponRelic> = {
  'Blast Powder': {
    tapStyle: 'explosive',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Soft explosive warm back-glow */}
      <Circle cx={44} cy={58} r={30} fill="#FF9538" opacity={0.16} />
      <Path
        d="M 55 31 C 60 19, 71 17, 76 23"
        fill="none"
        stroke={STROKE}
        strokeWidth={5.2}
        strokeLinecap="round"
      />
      <Path
        d="M 55 31 C 60 19, 71 17, 76 23"
        fill="none"
        stroke="#F59E0B"
        strokeWidth={2.4}
        strokeDasharray="3 2.5"
        strokeLinecap="round"
      />
      {/* Flared iron bomb neck */}
      <Path
        d="M 46 28 L 59 33 L 55 41 L 42 36 Z"
        fill={trim.metal}
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      {/* Round cast-iron bomb sphere */}
      <Circle cx={44} cy={59} r={25} fill="#3F3F46" stroke={STROKE} strokeWidth={3.3} />
      {/* Cel-shaded iron shadow crescent */}
      <Path
        d="M 60 40 C 68 50, 66 67, 54 76 C 44 83, 30 81, 23 73 C 33 78, 48 76, 56 67 C 63 59, 64 48, 60 40 Z"
        fill="#27272A"
      />
      {/* Rarity-trimmed equatorial band + rivets */}
      <Path
        d="M 20 52 Q 44 63 68 53 L 67 60 Q 44 70 20 59 Z"
        fill={trim.metal}
        stroke={STROKE}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      <Circle cx={31} cy={59} r={2} fill={trim.metalHighlight} />
      <Circle cx={44} cy={62} r={2.3} fill={trim.gem} stroke={STROKE} strokeWidth={1.4} />
      <Circle cx={57} cy={60} r={2} fill={trim.metalHighlight} />
      {/* Specular highlight on upper-left bomb shell */}
      <Path
        d="M 27 48 C 29 42, 35 38, 41 38"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={3.4}
        strokeLinecap="round"
      />
      <Circle cx={25} cy={54} r={1.8} fill="#FFFFFF" />
      {/* 8-point orange/yellow fuse spark star */}
      <Polygon
        points="77,9 80,18 89,15 83,23 91,27 81,28 84,37 77,30 70,37 73,28 63,27 71,23 65,15 74,18"
        fill="#FF9538"
        stroke={STROKE}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <Polygon
        points="77,14 79,21 86,23 79,25 77,32 75,25 68,23 75,21"
        fill={COLORS.actionYellow}
      />
      <Circle cx={77} cy={23} r={2.6} fill="#FFFFFF" />
    </Svg>
    ),
  },

  'Flint Spark': {
    tapStyle: 'explosive',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Outer crimson campfire flame */}
      <Path
        d="M 50 11 C 66 25, 78 42, 74 62 C 71 77, 61 86, 50 86 C 39 86, 29 77, 26 62 C 22 44, 34 29, 41 22 C 42 29, 45 31, 50 11 Z"
        fill="#EF4444"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      <Path
        d="M 51 24 C 62 35, 68 48, 65 63 C 63 73, 57 80, 50 80 C 43 80, 37 73, 35 63 C 33 51, 41 40, 51 24 Z"
        fill="#FF9538"
      />
      {/* Inner yellow flame core */}
      <Path
        d="M 50 39 C 57 47, 60 56, 58 66 C 56 73, 53 77, 50 77 C 47 77, 44 73, 42 66 C 40 56, 44 47, 50 39 Z"
        fill={COLORS.actionYellow}
      />
      {/* Crossed C-shaped striker steel (bottom-left to upper-right) */}
      <Path
        d="M 20 75 L 66 37 C 74 31, 82 37, 77 46 C 74 51, 68 51, 66 47"
        fill="none"
        stroke={STROKE}
        strokeWidth={8.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M 20 75 L 66 37 C 74 31, 82 37, 77 46 C 74 51, 68 51, 66 47"
        fill="none"
        stroke={trim.metal}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Chipped dark flint wedge (bottom-right to upper-left) */}
      <Polygon
        points="80,77 67,83 25,44 31,33 45,38"
        fill="#334155"
        stroke={STROKE}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      <Polygon points="31,35 43,39 58,54 48,57" fill="#64748B" />
      <Line x1={33} y1={37} x2={42} y2={40} stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
      <Polygon
        points="50,45 53,52 60,55 53,58 50,65 47,58 40,55 47,52"
        fill="#FFFFFF"
        stroke={STROKE}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <Circle cx={24} cy={27} r={2.8} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={1.8} />
      <Circle cx={77} cy={22} r={2.5} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={1.8} />
    </Svg>
    ),
  },

  'Cascade Core': {
    tapStyle: 'explosive',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={38} fill={COLORS.actionYellow} opacity={0.2} />
      {/* Swirling outer solar flame-ring with directional tongues */}
      <Path
        d="M 50 10 L 58 18 C 72 19, 82 28, 84 42 L 92 50 L 82 58 C 81 72, 72 82, 58 84 L 50 92 L 42 82 C 28 81, 18 72, 16 58 L 8 50 L 18 42 C 19 28, 28 18, 42 16 Z"
        fill="#EA580C"
        stroke={STROKE}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      {/* Secondary swirling orange ring */}
      <Circle cx={50} cy={50} r={28} fill="#FF9538" stroke={STROKE} strokeWidth={2.8} />
      {/* Dark reactor chasm to frame levitating core */}
      <Circle cx={50} cy={50} r={19} fill="#27272A" stroke={STROKE} strokeWidth={2.8} />
      {/* 4 Rarity reactor clamps */}
      <Rect x={46} y={14} width={8} height={11} rx={2} fill={trim.metal} stroke={STROKE} strokeWidth={2.5} />
      <Rect x={46} y={75} width={8} height={11} rx={2} fill={trim.metal} stroke={STROKE} strokeWidth={2.5} />
      <Rect x={14} y={46} width={11} height={8} rx={2} fill={trim.metal} stroke={STROKE} strokeWidth={2.5} />
      <Rect x={75} y={46} width={11} height={8} rx={2} fill={trim.metal} stroke={STROKE} strokeWidth={2.5} />
      {/* Levitating white-hot solar core */}
      <Circle cx={50} cy={50} r={12.5} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.8} />
      <Circle cx={50} cy={50} r={7} fill="#FFFFFF" />
      {/* Energy arcs bridging clamps to core */}
      <G stroke={COLORS.actionYellow} strokeWidth={2.2} strokeLinecap="round">
        <Line x1={50} y1={27} x2={50} y2={35} />
        <Line x1={50} y1={65} x2={50} y2={73} />
        <Line x1={27} y1={50} x2={35} y2={50} />
        <Line x1={65} y1={50} x2={73} y2={50} />
      </G>
    </Svg>
    ),
  },

  'Sympathetic Flames': {
    tapStyle: 'explosive',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Left crimson flame crest */}
      <Path
        d="M 28 31 L 34 18 L 41 28 L 47 20 L 49 33 Z"
        fill="#EF4444"
        stroke={STROKE}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      {/* Right golden flame crest */}
      <Path
        d="M 52 27 L 58 14 L 65 24 L 72 16 L 73 30 Z"
        fill={COLORS.actionYellow}
        stroke={STROKE}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      {/* Left crimson flame ring */}
      <Circle cx={38} cy={55} r={22} fill="none" stroke={STROKE} strokeWidth={11} />
      <Circle cx={38} cy={55} r={22} fill="none" stroke="#EF4444" strokeWidth={5.5} />
      {/* Right golden flame ring */}
      <Circle cx={62} cy={49} r={22} fill="none" stroke={STROKE} strokeWidth={11} />
      <Circle cx={62} cy={49} r={22} fill="none" stroke={COLORS.actionYellow} strokeWidth={5.5} />
      {/* Over-pass segment of left crimson ring at top intersection for true interlock */}
      <Path
        d="M 48 35 A 22 22 0 0 1 60 53"
        fill="none"
        stroke={STROKE}
        strokeWidth={11}
      />
      <Path
        d="M 48 35 A 22 22 0 0 1 60 53"
        fill="none"
        stroke="#FF9538"
        strokeWidth={5.5}
        strokeLinecap="round"
      />
      {/* Rarity anchor gems on outer sides */}
      <Circle cx={16} cy={55} r={4.2} fill={trim.metal} stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={84} cy={49} r={4.2} fill={trim.metal} stroke={STROKE} strokeWidth={2.4} />
      {/* Glowing sympathetic spark arc bridging centers */}
      <Path
        d="M 35 56 L 45 48 L 53 56 L 65 47"
        fill="none"
        stroke={STROKE}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M 35 56 L 45 48 L 53 56 L 65 47"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
    ),
  },

  'Prismatic Ray': {
    tapStyle: 'laser',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Incoming white ray on left */}
      <Line x1={9} y1={58} x2={38} y2={50} stroke={STROKE} strokeWidth={8} strokeLinecap="round" />
      <Line x1={9} y1={58} x2={38} y2={50} stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />
      {/* Outgoing split spectrum beams: Red, Yellow, Teal */}
      <G strokeLinecap="round">
        <Line x1={58} y1={43} x2={91} y2={26} stroke={STROKE} strokeWidth={7.5} />
        <Line x1={58} y1={43} x2={91} y2={26} stroke={COLORS.impactRed} strokeWidth={3.8} />

        <Line x1={61} y1={50} x2={92} y2={50} stroke={STROKE} strokeWidth={7.5} />
        <Line x1={61} y1={50} x2={92} y2={50} stroke={COLORS.actionYellow} strokeWidth={3.8} />

        <Line x1={63} y1={57} x2={91} y2={74} stroke={STROKE} strokeWidth={7.5} />
        <Line x1={63} y1={57} x2={91} y2={74} stroke={COLORS.logicTeal} strokeWidth={3.8} />
      </G>
      <Path
        d="M 22 74 L 74 74 L 70 82 L 26 82 Z"
        fill={trim.metal}
        stroke={STROKE}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {/* Cut triangular crystal prism */}
      <Polygon
        points="48,20 24,74 72,74"
        fill="#BAE6FD"
        stroke={STROKE}
        strokeWidth={3.4}
        strokeLinejoin="round"
      />
      {/* Prism internal cel-shaded facets */}
      <Polygon points="48,23 48,72 70,72" fill="#38BDF8" opacity={0.55} />
      <Polygon points="48,23 35,72 48,72" fill="#E0F2FE" />
      <Line x1={48} y1={22} x2={48} y2={73} stroke={STROKE} strokeWidth={2.2} />
      <Polygon
        points="48,11 50.5,17.5 57,20 50.5,22.5 48,29 45.5,22.5 39,20 45.5,17.5"
        fill="#FFFFFF"
        stroke={STROKE}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
    ),
  },

  'Prismatic Perfection': {
    tapStyle: 'laser',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Diagonal minor rainbow points */}
      <Polygon points="50,50 22,22 41,34" fill="#FF9538" stroke={STROKE} strokeWidth={2.8} strokeLinejoin="round" />
      <Polygon points="50,50 78,22 66,41" fill="#10B981" stroke={STROKE} strokeWidth={2.8} strokeLinejoin="round" />
      <Polygon points="50,50 78,78 59,66" fill="#3B82F6" stroke={STROKE} strokeWidth={2.8} strokeLinejoin="round" />
      <Polygon points="50,50 22,78 34,59" fill="#EC4899" stroke={STROKE} strokeWidth={2.8} strokeLinejoin="round" />
      {/* Cardinal major rainbow points */}
      <Polygon points="50,8 61,39 50,50 39,39" fill={COLORS.impactRed} stroke={STROKE} strokeWidth={3.2} strokeLinejoin="round" />
      <Polygon points="92,50 61,61 50,50 61,39" fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={3.2} strokeLinejoin="round" />
      <Polygon points="50,92 39,61 50,50 61,61" fill="#06B6D4" stroke={STROKE} strokeWidth={3.2} strokeLinejoin="round" />
      <Polygon points="8,50 39,39 50,50 39,61" fill="#A855F7" stroke={STROKE} strokeWidth={3.2} strokeLinejoin="round" />
      <Polygon points="50,12 58,38 50,47" fill="#FFFFFF" opacity={0.35} />
      <Polygon points="88,50 62,42 53,50" fill="#FFFFFF" opacity={0.4} />
      {/* Rarity center bezel & white diamond core */}
      <Circle cx={50} cy={50} r={13} fill={trim.metal} stroke={STROKE} strokeWidth={3} />
      <Polygon
        points="50,39 61,50 50,61 39,50"
        fill="#FFFFFF"
        stroke={STROKE}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
    </Svg>
    ),
  },

  'Chaos Shard': {
    tapStyle: 'explosive',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Ellipse
        cx={50}
        cy={52}
        rx={38}
        ry={18}
        transform="rotate(-24 50 52)"
        fill="none"
        stroke={trim.glow}
        strokeWidth={2.6}
        strokeDasharray="5 4"
      />
      {/* Jagged violet-and-amber chaos crystal shard */}
      <Polygon
        points="54,12 70,38 61,86 33,76 30,34"
        fill="#7E22CE"
        stroke={STROKE}
        strokeWidth={3.3}
        strokeLinejoin="round"
      />
      {/* Left bright violet facet */}
      <Polygon points="54,15 49,50 32,35" fill="#C084FC" />
      {/* Volatile amber lightning core vein */}
      <Polygon
        points="53,24 61,45 48,54 55,75 41,52 50,44"
        fill={COLORS.actionYellow}
        stroke="#FF9538"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Three sharp ricochet arrowheads orbiting shard */}
      <Polygon
        points="12,56 26,48 23,57 28,63"
        fill={COLORS.impactOrange}
        stroke={STROKE}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      <Polygon
        points="89,36 74,34 79,41 76,49"
        fill={COLORS.actionYellow}
        stroke={STROKE}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      <Polygon
        points="56,92 47,80 55,83 63,79"
        fill={trim.metalHighlight}
        stroke={STROKE}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      <Line x1={37} y1={37} x2={48} y2={22} stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
    ),
  },

  'Entropy Engine': {
    tapStyle: 'explosive',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Outer brass/rarity gyro ring 1 */}
      <Ellipse
        cx={50}
        cy={50}
        rx={39}
        ry={16}
        transform="rotate(32 50 50)"
        fill="none"
        stroke={STROKE}
        strokeWidth={8.5}
      />
      <Ellipse
        cx={50}
        cy={50}
        rx={39}
        ry={16}
        transform="rotate(32 50 50)"
        fill="none"
        stroke={trim.metal}
        strokeWidth={4}
      />
      {/* Cracked obsidian dark-matter sphere */}
      <Circle cx={50} cy={50} r={21} fill="#18181B" stroke={STROKE} strokeWidth={3.4} />
      <Circle cx={45} cy={44} r={14} fill="#27272A" />
      {/* Volatile orange fissures inside sphere */}
      <Path
        d="M 36 44 L 47 49 L 44 61 M 47 49 L 60 41 L 65 52"
        fill="none"
        stroke="#FF9538"
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={48} cy={49} r={3.5} fill={COLORS.actionYellow} />
      {/* Crossed gyro ring 2 */}
      <Ellipse
        cx={50}
        cy={50}
        rx={39}
        ry={15}
        transform="rotate(-34 50 50)"
        fill="none"
        stroke={STROKE}
        strokeWidth={8.5}
      />
      <Ellipse
        cx={50}
        cy={50}
        rx={39}
        ry={15}
        transform="rotate(-34 50 50)"
        fill="none"
        stroke="#D97706"
        strokeWidth={4}
      />
      <Path
        d="M 50 28 L 46 16 L 54 15 L 50 7"
        fill="none"
        stroke={COLORS.actionYellow}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M 50 72 L 54 84 L 46 85 L 50 93"
        fill="none"
        stroke="#FF9538"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={18} cy={71} r={3.6} fill={trim.gem} stroke={STROKE} strokeWidth={2.2} />
      <Circle cx={82} cy={29} r={3.6} fill={trim.gem} stroke={STROKE} strokeWidth={2.2} />
    </Svg>
    ),
  },

  'Chaos Conduit': {
    tapStyle: 'explosive',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {/* Central staff core rod */}
      <Rect
        x={46}
        y={22}
        width={8}
        height={66}
        rx={3}
        fill="#334155"
        stroke={STROKE}
        strokeWidth={3}
      />
      <Path
        d="M 30 72 C 30 58, 70 58, 70 44 C 70 30, 34 30, 36 18"
        fill="none"
        stroke={STROKE}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <Path
        d="M 30 72 C 30 58, 70 58, 70 44 C 70 30, 34 30, 36 18"
        fill="none"
        stroke="#22D3EE"
        strokeWidth={4.2}
        strokeLinecap="round"
      />
      <Path
        d="M 70 72 C 70 58, 30 58, 30 44 C 30 30, 66 30, 64 18"
        fill="none"
        stroke={STROKE}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <Path
        d="M 70 72 C 70 58, 30 58, 30 44 C 30 30, 66 30, 64 18"
        fill="none"
        stroke={COLORS.actionYellow}
        strokeWidth={4.2}
        strokeLinecap="round"
      />
      {/* Staff socket collar at bottom */}
      <Path
        d="M 34 76 L 66 76 L 61 88 L 39 88 Z"
        fill={trim.metal}
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <Circle cx={50} cy={82} r={3} fill={trim.gem} stroke={STROKE} strokeWidth={1.8} />
      {/* Crown spark orb & crackling lightning */}
      <Circle cx={50} cy={17} r={8} fill="#FFFFFF" stroke={STROKE} strokeWidth={3} />
      <Circle cx={50} cy={17} r={4.2} fill="#22D3EE" />
      <Path
        d="M 24 34 L 14 29 L 20 22 M 76 34 L 86 29 L 80 22"
        fill="none"
        stroke={COLORS.actionYellow}
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
    ),
  },

  'Chain Reaction': {
    tapStyle: 'explosive',
    art: (trim) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <G stroke={STROKE} strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <Path d="M 38 40 L 23 28 L 28 21 L 15 13" />
        <Path d="M 62 40 L 77 27 L 72 20 L 86 13" />
        <Path d="M 63 55 L 80 63 L 75 71 L 87 80" />
      </G>
      <G stroke={COLORS.actionYellow} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <Path d="M 38 40 L 23 28 L 28 21 L 15 13" />
        <Path d="M 62 40 L 77 27 L 72 20 L 86 13" />
        <Path d="M 63 55 L 80 63 L 75 71 L 87 80" />
      </G>
      {/* Node spark spheres at chain tips */}
      <Circle cx={15} cy={13} r={4.5} fill="#67E8F9" stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={86} cy={13} r={4.5} fill="#67E8F9" stroke={STROKE} strokeWidth={2.4} />
      <Circle cx={87} cy={80} r={4.5} fill="#67E8F9" stroke={STROKE} strokeWidth={2.4} />
      {/* Golden/rarity Tesla base rings */}
      <Rect x={34} y={72} width={32} height={7} rx={3.5} fill={trim.metal} stroke={STROKE} strokeWidth={2.8} />
      <Rect x={30} y={79} width={40} height={9} rx={4} fill="#D97706" stroke={STROKE} strokeWidth={3} />
      {/* High-voltage turquoise Tesla orb */}
      <Circle cx={50} cy={51} r={22} fill="#0891B2" stroke={STROKE} strokeWidth={3.4} />
      <Circle cx={48} cy={49} r={16} fill="#22D3EE" />
      {/* Inner plasma core & internal arcs */}
      <Circle cx={50} cy={51} r={7.5} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.2} />
      <Circle cx={50} cy={51} r={3.5} fill="#FFFFFF" />
      <Path
        d="M 35 42 C 38 36, 44 33, 50 33"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </Svg>
    ),
  },
};
