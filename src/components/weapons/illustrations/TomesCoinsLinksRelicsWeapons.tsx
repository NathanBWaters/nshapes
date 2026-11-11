import React from 'react';
import { Svg, Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { COLORS } from '@/utils/colors';
import { RarityTrimPalette, WeaponIllustrationProps, getRarityTrimPalette } from '../types';

const STROKE = COLORS.slateCharcoal;

export const TOMES_COINS_LINKS_RELICS_WEAPON_NAMES = [
  "Scholar's Tome",
  'Arcane Codex',
  'Wisdom Chain',
  'Echo Mastery',
  'Laser Mastery',
  'Grace Mastery',
  'Explosion Mastery',
  'Hint Mastery',
  'Time Mastery',
  'Healing Mastery',
  'Fire Mastery',
  'Ricochet Mastery',
  'Growth Mastery',
  'Coin Mastery',
  'Time Trigger Mastery',
  "Fortune's Favor",
  'Golden Touch',
  "Fortune's Blessing",
  'Link Stone',
  'Link Chain',
  'Soul Link',
  'Revenge Linker',
  'Web Spinner',
  'Web Master',
  'Echo Chamber',
  'Resonance Core',
  'Neural Network',
  'Desperate Measures',
  'Soul Harvest',
  'Grace Conduit',
  'Life Link',
] as const;

interface MasteryGrimoireFrameProps {
  bindingColor: string;
  accentColor: string;
  trim: RarityTrimPalette;
  children: React.ReactNode;
}

const MasteryGrimoireFrame: React.FC<MasteryGrimoireFrameProps> = ({
  bindingColor,
  accentColor,
  trim,
  children,
}) => (
  <Svg width="100%" height="100%" viewBox="0 0 100 100">
    {/* Elemental aura behind rising crest */}
    <Circle cx={50} cy={36} r={24} fill={accentColor} opacity={0.18} />
    {/* Hardcover leather binding */}
    <Path
      d="M 10 56 L 46 62 L 54 62 L 90 56 L 86 84 L 54 88 L 46 88 L 14 84 Z"
      fill={bindingColor}
      stroke={STROKE}
      strokeWidth={3.3}
      strokeLinejoin="round"
    />
    {/* Rarity corner clasps */}
    <Polygon points="10,56 20,57.5 19,65 11,64" fill={trim.metal} stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />
    <Polygon points="90,56 80,57.5 81,65 89,64" fill={trim.metal} stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />
    {/* Open fanned cream pages */}
    <Path
      d="M 15 52 C 27 48, 41 51, 50 58 C 59 51, 73 48, 85 52 L 82 78 C 71 74, 59 76, 50 83 C 41 76, 29 74, 18 78 Z"
      fill="#FFF7ED"
      stroke={STROKE}
      strokeWidth={3}
      strokeLinejoin="round"
    />
    {/* Center spine crease & subtle page lines */}
    <Line x1={50} y1={58} x2={50} y2={83} stroke={STROKE} strokeWidth={2.6} />
    <Path
      d="M 24 62 Q 35 60 44 65 M 23 69 Q 35 67 44 72 M 76 62 Q 65 60 56 65 M 77 69 Q 65 67 56 72"
      fill="none"
      stroke="#CBD5E1"
      strokeWidth={2.1}
      strokeLinecap="round"
    />
    {/* Notched ribbon bookmark */}
    <Polygon
      points="46,83 54,83 55,95 50,91 45,95"
      fill={accentColor}
      stroke={STROKE}
      strokeWidth={2.3}
      strokeLinejoin="round"
    />
    {/* Distinct elemental crest rising out of the open pages */}
    {children}
  </Svg>
);

export const TomesCoinsLinksRelicsWeaponIllustration: React.FC<WeaponIllustrationProps> = ({
  name,
  rarity = 'common',
}) => {
  const trim = getRarityTrimPalette(rarity);

  switch (name) {
    case "Scholar's Tome":
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {/* Sapphire-bound leather covers */}
          <Path
            d="M 11 32 L 46 39 L 54 39 L 89 32 L 86 78 L 54 84 L 46 84 L 14 78 Z"
            fill="#1D4ED8"
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          {/* Cream open pages */}
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
          {/* Red ribbon bookmark */}
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
      );

    case 'Arcane Codex':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {/* Epic purple-and-gold spellbook */}
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
      );

    case 'Wisdom Chain':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {/* Floating gold coin-runes */}
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
          {/* Crossed golden chains */}
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
      );

    case 'Echo Mastery':
      return (
        <MasteryGrimoireFrame bindingColor="#0F766E" accentColor={COLORS.logicTeal} trim={trim}>
          <Circle cx={50} cy={34} r={19} fill="none" stroke={STROKE} strokeWidth={5.5} />
          <Circle cx={50} cy={34} r={19} fill="none" stroke={COLORS.actionYellow} strokeWidth={2.6} />
          <Circle cx={50} cy={34} r={12} fill="none" stroke={STROKE} strokeWidth={5.5} />
          <Circle cx={50} cy={34} r={12} fill="none" stroke={COLORS.logicTeal} strokeWidth={2.8} />
          <Circle cx={50} cy={34} r={5.5} fill="#5EEAD4" stroke={STROKE} strokeWidth={2.5} />
        </MasteryGrimoireFrame>
      );

    case 'Laser Mastery':
      return (
        <MasteryGrimoireFrame bindingColor="#6D28D9" accentColor="#22D3EE" trim={trim}>
          <Line x1={24} y1={40} x2={44} y2={33} stroke={STROKE} strokeWidth={6} strokeLinecap="round" />
          <Line x1={24} y1={40} x2={44} y2={33} stroke="#FFFFFF" strokeWidth={2.8} strokeLinecap="round" />
          <Line x1={56} y1={30} x2={78} y2={19} stroke={STROKE} strokeWidth={6} strokeLinecap="round" />
          <Line x1={56} y1={30} x2={78} y2={19} stroke={COLORS.impactRed} strokeWidth={2.8} strokeLinecap="round" />
          <Line x1={57} y1={35} x2={80} y2={35} stroke={STROKE} strokeWidth={6} strokeLinecap="round" />
          <Line x1={57} y1={35} x2={80} y2={35} stroke="#22D3EE" strokeWidth={2.8} strokeLinecap="round" />
          <Polygon
            points="50,15 36,46 64,46"
            fill="#67E8F9"
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        </MasteryGrimoireFrame>
      );

    case 'Grace Mastery':
      return (
        <MasteryGrimoireFrame bindingColor="#047857" accentColor="#10B981" trim={trim}>
          <G fill="#10B981" stroke={STROKE} strokeWidth={2.8}>
            <Circle cx={50} cy={22} r={8.5} />
            <Circle cx={50} cy={42} r={8.5} />
            <Circle cx={40} cy={32} r={8.5} />
            <Circle cx={60} cy={32} r={8.5} />
          </G>
          <Circle cx={50} cy={32} r={4.2} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.2} />
        </MasteryGrimoireFrame>
      );

    case 'Explosion Mastery':
      return (
        <MasteryGrimoireFrame bindingColor="#C2410C" accentColor="#FF9538" trim={trim}>
          <Polygon
            points="50,9 55,22 69,16 61,29 74,34 61,39 68,50 55,44 50,55 45,44 32,50 39,39 26,34 39,29 31,16 45,22"
            fill="#FF9538"
            stroke={STROKE}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
          <Circle cx={50} cy={33} r={8} fill={COLORS.actionYellow} />
          <Circle cx={50} cy={33} r={3.8} fill="#FFFFFF" />
        </MasteryGrimoireFrame>
      );

    case 'Hint Mastery':
      return (
        <MasteryGrimoireFrame bindingColor="#D97706" accentColor={COLORS.actionYellow} trim={trim}>
          <G stroke={COLORS.actionYellow} strokeWidth={2.8} strokeLinecap="round">
            <Line x1={50} y1={8} x2={50} y2={13} />
            <Line x1={29} y1={17} x2={34} y2={21} />
            <Line x1={71} y1={17} x2={66} y2={21} />
          </G>
          <Path
            d="M 37 29 C 37 19, 63 19, 63 29 C 63 36, 56 39, 55 45 L 45 45 C 44 39, 37 36, 37 29 Z"
            fill={COLORS.actionYellow}
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Rect x={44} y={45} width={12} height={6} rx={2} fill="#94A3B8" stroke={STROKE} strokeWidth={2.4} />
          <Circle cx={46} cy={27} r={3} fill="#FFFFFF" />
        </MasteryGrimoireFrame>
      );

    case 'Time Mastery':
      return (
        <MasteryGrimoireFrame bindingColor="#0D9488" accentColor="#F59E0B" trim={trim}>
          <Polygon
            points="37,15 63,15 52,32 63,49 37,49 48,32"
            fill="#E0F2FE"
            stroke={STROKE}
            strokeWidth={2.9}
            strokeLinejoin="round"
          />
          <Polygon points="42,21 58,21 50,31" fill={COLORS.actionYellow} />
          <Polygon points="50,35 59,47 41,47" fill="#F59E0B" />
          <Rect x={34} y={11} width={32} height={5} rx={2} fill="#B45309" stroke={STROKE} strokeWidth={2.5} />
          <Rect x={34} y={48} width={32} height={5} rx={2} fill="#B45309" stroke={STROKE} strokeWidth={2.5} />
        </MasteryGrimoireFrame>
      );

    case 'Healing Mastery':
      return (
        <MasteryGrimoireFrame bindingColor="#BE123C" accentColor="#FB7185" trim={trim}>
          <Path
            d="M 50 51 C 36 41, 29 31, 31 22 C 33 14, 42 13, 47 18 L 50 22 L 53 18 C 58 13, 67 14, 69 22 C 71 31, 64 41, 50 51 Z"
            fill="#E11D48"
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path
            d="M 47 25 L 53 25 L 53 30 L 58 30 L 58 36 L 53 36 L 53 41 L 47 41 L 47 36 L 42 36 L 42 30 L 47 30 Z"
            fill="#FFFFFF"
            stroke={STROKE}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </MasteryGrimoireFrame>
      );

    case 'Fire Mastery':
      return (
        <MasteryGrimoireFrame bindingColor="#B91C1C" accentColor="#FF9538" trim={trim}>
          <Path
            d="M 50 9 C 60 19, 67 28, 65 39 C 63 48, 57 52, 50 52 C 43 52, 37 48, 35 39 C 33 29, 39 21, 44 17 C 45 22, 47 23, 50 9 Z"
            fill="#EF4444"
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path
            d="M 50 22 C 56 29, 58 36, 56 43 C 54 48, 46 48, 44 43 C 42 36, 45 29, 50 22 Z"
            fill={COLORS.actionYellow}
          />
        </MasteryGrimoireFrame>
      );

    case 'Ricochet Mastery':
      return (
        <MasteryGrimoireFrame bindingColor="#7C3AED" accentColor="#FF9538" trim={trim}>
          <Path
            d="M 27 42 L 45 18 L 63 40 L 75 23"
            fill="none"
            stroke={STROKE}
            strokeWidth={6.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M 27 42 L 45 18 L 63 40 L 75 23"
            fill="none"
            stroke={COLORS.actionYellow}
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Polygon
            points="79,16 66,21 73,24 76,31"
            fill="#FF9538"
            stroke={STROKE}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <Circle cx={45} cy={18} r={4} fill="#FFFFFF" stroke={STROKE} strokeWidth={2.2} />
        </MasteryGrimoireFrame>
      );

    case 'Growth Mastery':
      return (
        <MasteryGrimoireFrame bindingColor="#15803D" accentColor="#34D399" trim={trim}>
          <Line x1={50} y1={52} x2={50} y2={24} stroke={STROKE} strokeWidth={5} strokeLinecap="round" />
          <Path
            d="M 50 35 C 34 35, 25 24, 28 14 C 39 13, 49 22, 50 35 Z"
            fill="#10B981"
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path
            d="M 50 30 C 66 30, 75 19, 72 10 C 61 9, 51 18, 50 30 Z"
            fill="#34D399"
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        </MasteryGrimoireFrame>
      );

    case 'Coin Mastery':
      return (
        <MasteryGrimoireFrame bindingColor="#B45309" accentColor={COLORS.actionYellow} trim={trim}>
          <Circle cx={50} cy={32} r={18} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={3.1} />
          <Circle cx={50} cy={32} r={13} fill="#F59E0B" />
          <Polygon
            points="41,37 41,27 46,31 50,24 54,31 59,27 59,37"
            fill="#FEF08A"
            stroke={STROKE}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
        </MasteryGrimoireFrame>
      );

    case 'Time Trigger Mastery':
      return (
        <MasteryGrimoireFrame bindingColor="#0E7490" accentColor="#22D3EE" trim={trim}>
          {/* Mini side wings */}
          <Path
            d="M 33 32 L 18 23 L 22 35 L 33 38 Z M 67 32 L 82 23 L 78 35 L 67 38 Z"
            fill="#FFFFFF"
            stroke={STROKE}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          {/* Lightning stopwatch */}
          <Rect x={45} y={10} width={10} height={6} rx={2} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.4} />
          <Circle cx={50} cy={32} r={17} fill="#22D3EE" stroke={STROKE} strokeWidth={3} />
          <Polygon
            points="52,19 43,33 50,33 47,45 58,30 51,30"
            fill={COLORS.actionYellow}
            stroke={STROKE}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </MasteryGrimoireFrame>
      );

    case "Fortune's Favor":
      return (
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
      );

    case 'Golden Touch':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {/* Golden goblet rising from treasure pile */}
          <Path
            d="M 36 22 L 64 22 C 64 38, 55 44, 53 47 L 53 58 L 62 62 L 38 62 L 47 58 L 47 47 C 45 44, 36 38, 36 22 Z"
            fill={COLORS.actionYellow}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <Circle cx={50} cy={32} r={4.5} fill="#E11D48" stroke={STROKE} strokeWidth={2.2} />
          {/* Overflowing mound of stacked gold coins */}
          <Ellipse cx={30} cy={74} rx={16} ry={10} fill="#F59E0B" stroke={STROKE} strokeWidth={3} />
          <Ellipse cx={70} cy={74} rx={16} ry={10} fill="#F59E0B" stroke={STROKE} strokeWidth={3} />
          <Ellipse cx={50} cy={68} rx={18} ry={11} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={3} />
          <Ellipse cx={44} cy={80} rx={17} ry={9.5} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={3} />
          <Ellipse cx={62} cy={82} rx={15} ry={8.5} fill="#FEF08A" stroke={STROKE} strokeWidth={2.8} />
          {/* Faceted ruby gem & sparkles */}
          <Polygon
            points="26,52 35,45 42,54 33,62"
            fill="#E11D48"
            stroke={STROKE}
            strokeWidth={2.7}
            strokeLinejoin="round"
          />
          <Polygon
            points="77,26 80,33 87,36 80,39 77,46 74,39 67,36 74,33"
            fill="#FFFFFF"
            stroke={STROKE}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </Svg>
      );

    case "Fortune's Blessing":
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {/* Radiant halo above */}
          <Ellipse cx={50} cy={17} rx={22} ry={6.5} fill="none" stroke={STROKE} strokeWidth={6.5} />
          <Ellipse cx={50} cy={17} rx={22} ry={6.5} fill="none" stroke={COLORS.actionYellow} strokeWidth={3} />
          {/* Seraph white wings */}
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
          {/* Sovereign golden coin */}
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
      );

    case 'Link Stone':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {/* Carved rose-stone heart */}
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
      );

    case 'Link Chain':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {/* Twin silver-teal interlocking chain links */}
          <Rect
            x={14}
            y={36}
            width={44}
            height={28}
            rx={14}
            transform="rotate(-20 36 50)"
            fill="none"
            stroke={STROKE}
            strokeWidth={11}
          />
          <Rect
            x={14}
            y={36}
            width={44}
            height={28}
            rx={14}
            transform="rotate(-20 36 50)"
            fill="none"
            stroke={COLORS.logicTeal}
            strokeWidth={5}
          />
          <Rect
            x={42}
            y={36}
            width={44}
            height={28}
            rx={14}
            transform="rotate(20 64 50)"
            fill="none"
            stroke={STROKE}
            strokeWidth={11}
          />
          <Rect
            x={42}
            y={36}
            width={44}
            height={28}
            rx={14}
            transform="rotate(20 64 50)"
            fill="none"
            stroke="#CBD5E1"
            strokeWidth={5}
          />
          {/* Glowing central heart clasp */}
          <Path
            d="M 50 67 C 40 60, 35 52, 37 45 C 38 39, 45 38, 50 43 C 55 38, 62 39, 63 45 C 65 52, 60 60, 50 67 Z"
            fill="#F43F5E"
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'Soul Link':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {/* Radiant soul energy arc */}
          <Path
            d="M 32 34 Q 50 14 68 34 M 32 68 Q 50 88 68 68"
            fill="none"
            stroke={COLORS.actionYellow}
            strokeWidth={3.4}
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
          {/* Left golden soul heart */}
          <Path
            d="M 33 70 C 19 60, 13 49, 15 39 C 17 31, 25 29, 31 34 L 33 37 L 35 34 C 41 29, 49 31, 51 39 C 53 49, 47 60, 33 70 Z"
            fill={COLORS.actionYellow}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          {/* Right amethyst soul heart */}
          <Path
            d="M 67 70 C 53 60, 47 49, 49 39 C 51 31, 59 29, 65 34 L 67 37 L 69 34 C 75 29, 83 31, 85 39 C 87 49, 81 60, 67 70 Z"
            fill="#A855F7"
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          {/* Binding central diamond */}
          <Polygon
            points="50,39 58,50 50,61 42,50"
            fill="#FFFFFF"
            stroke={STROKE}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'Revenge Linker':
      return (
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
      );

    case 'Web Spinner':
      return (
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
          {/* Glistening dewdrops */}
          <Circle cx={50} cy={50} r={6} fill="#38BDF8" stroke={STROKE} strokeWidth={2.5} />
          <Circle cx={74} cy={26} r={4} fill="#FFFFFF" stroke={STROKE} strokeWidth={2} />
          <Circle cx={26} cy={74} r={3.8} fill="#BAE6FD" stroke={STROKE} strokeWidth={2} />
        </Svg>
      );

    case 'Web Master':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {/* Gilded gold web spokes */}
          <G stroke="#D97706" strokeWidth={3.4} strokeLinecap="round">
            <Line x1={50} y1={10} x2={50} y2={90} />
            <Line x1={10} y1={50} x2={90} y2={50} />
            <Line x1={21} y1={21} x2={79} y2={79} />
            <Line x1={79} y1={21} x2={21} y2={79} />
          </G>
          <Polygon
            points="50,15 75,25 85,50 75,75 50,85 25,75 15,50 25,25"
            fill="#581C87"
            fillOpacity={0.28}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Polygon
            points="50,29 65,35 71,50 65,65 50,71 35,65 29,50 35,35"
            fill="none"
            stroke={COLORS.actionYellow}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
          {/* Central royal gem spider-crest */}
          <Circle cx={50} cy={53} r={10} fill="#9333EA" stroke={STROKE} strokeWidth={3} />
          <Circle cx={50} cy={41} r={6} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.6} />
          <Circle cx={50} cy={53} r={4} fill="#FFFFFF" />
        </Svg>
      );

    case 'Echo Chamber':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {/* Left brass metallic sonic ring */}
          <Circle cx={39} cy={50} r={24} fill="none" stroke={STROKE} strokeWidth={11} />
          <Circle cx={39} cy={50} r={24} fill="none" stroke="#F59E0B" strokeWidth={5.2} />
          {/* Right teal metallic sonic ring */}
          <Circle cx={61} cy={50} r={24} fill="none" stroke={STROKE} strokeWidth={11} />
          <Circle cx={61} cy={50} r={24} fill="none" stroke={COLORS.logicTeal} strokeWidth={5.2} />
          {/* Interlock over-pass */}
          <Path d="M 50 29 A 24 24 0 0 1 63 50" fill="none" stroke={STROKE} strokeWidth={11} />
          <Path d="M 50 29 A 24 24 0 0 1 63 50" fill="none" stroke="#F59E0B" strokeWidth={5.2} />
          <Circle cx={50} cy={50} r={5} fill="#FFFFFF" stroke={STROKE} strokeWidth={2.4} />
        </Svg>
      );

    case 'Resonance Core':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {/* Triple glowing harmonic rings */}
          <Ellipse
            cx={50}
            cy={50}
            rx={40}
            ry={16}
            fill="none"
            stroke={STROKE}
            strokeWidth={7}
          />
          <Ellipse cx={50} cy={50} rx={40} ry={16} fill="none" stroke={COLORS.logicTeal} strokeWidth={3.2} />
          <Ellipse
            cx={50}
            cy={50}
            rx={40}
            ry={16}
            transform="rotate(60 50 50)"
            fill="none"
            stroke={STROKE}
            strokeWidth={7}
          />
          <Ellipse
            cx={50}
            cy={50}
            rx={40}
            ry={16}
            transform="rotate(60 50 50)"
            fill="none"
            stroke={COLORS.actionYellow}
            strokeWidth={3.2}
          />
          <Ellipse
            cx={50}
            cy={50}
            rx={40}
            ry={16}
            transform="rotate(-60 50 50)"
            fill="none"
            stroke={STROKE}
            strokeWidth={7}
          />
          <Ellipse
            cx={50}
            cy={50}
            rx={40}
            ry={16}
            transform="rotate(-60 50 50)"
            fill="none"
            stroke="#22D3EE"
            strokeWidth={3.2}
          />
          {/* Turquoise core */}
          <Circle cx={50} cy={50} r={13} fill="#06B6D4" stroke={STROKE} strokeWidth={3.2} />
          <Circle cx={50} cy={50} r={6} fill="#FFFFFF" />
        </Svg>
      );

    case 'Neural Network':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {/* Synaptic connecting lines */}
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
          {/* Central nexus node */}
          <Circle cx={50} cy={50} r={12} fill="#A855F7" stroke={STROKE} strokeWidth={3.2} />
          <Circle cx={50} cy={50} r={5.5} fill="#FFFFFF" />
        </Svg>
      );

    case 'Desperate Measures':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {/* Ivory skull silhouette */}
          <Path
            d="M 24 46 C 24 23, 36 14, 50 14 C 64 14, 76 23, 76 46 C 76 57, 70 63, 64 66 L 64 79 L 36 79 L 36 66 C 30 63, 24 57, 24 46 Z"
            fill="#FFF7ED"
            stroke={STROKE}
            strokeWidth={3.4}
            strokeLinejoin="round"
          />
          {/* Skull teeth lines */}
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
      );

    case 'Soul Harvest':
      return (
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
          {/* Rarity corner brackets */}
          <Polygon points="81,14 69,14 81,26" fill={trim.metal} stroke={STROKE} strokeWidth={2.2} />
          <Polygon points="81,86 69,86 81,74" fill={trim.metal} stroke={STROKE} strokeWidth={2.2} />
          {/* Silver crescent moon */}
          <Path
            d="M 57 27 A 18 18 0 1 0 57 73 A 14 14 0 1 1 57 27 Z"
            fill="#E2E8F0"
            stroke={STROKE}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          {/* Glowing ruby soul-orb */}
          <Circle cx={57} cy={50} r={10} fill="#E11D48" stroke={STROKE} strokeWidth={2.8} />
          <Circle cx={55} cy={47} r={3.5} fill="#FDA4AF" />
        </Svg>
      );

    case 'Grace Conduit':
      return (
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
          {/* Golden wing-guard ring */}
          <Circle cx={50} cy={52} r={12} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={3.1} />
          <Circle cx={50} cy={52} r={5.5} fill="#FFFFFF" stroke={STROKE} strokeWidth={2.2} />
        </Svg>
      );

    case 'Life Link':
    default:
      return (
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
          {/* Kintsugi crimson heart */}
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
      );
  }
};
