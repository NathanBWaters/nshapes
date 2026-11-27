/**
 * [GP-20] 2.2-second looping mini-board visual preview (and crisp static
 * reduced-motion schematic) embedded inside canonical `WeaponExplainer.tsx`.
 *
 * Uses NShapes' v0.1.173 visual identity (Circle / Triangle / Bolt ×
 * Orange / Blue / Pink from `cardVisuals.ts`) and drives all motion strictly
 * on GPU-composited `transform` and `opacity`, gated on `useAppActive()` and
 * `useReducedMotion()` with full `cancelAnimation` cleanup.
 */
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Svg, Circle, Line, Path, Polygon, Rect } from 'react-native-svg';
import Icon, { type IconName } from '@/components/Icon';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { Color, Shape } from '@/types';
import {
  CARD_LIGHT_COLORS,
  CARD_SHAPE_GEOMETRY,
  CARD_STROKE_WIDTH,
  CARD_SVG_HEIGHT,
  CARD_SVG_WIDTH,
} from '@/utils/cardVisuals';
import { COLORS } from '@/utils/colors';
import { EASE } from '@/utils/motion';
import { INK } from './ui';

export type WeaponDemoArchetype =
  | 'blast'
  | 'laser'
  | 'fire'
  | 'ricochet'
  | 'link'
  | 'echo'
  | 'rainbow'
  | 'magnet'
  | 'tightrope'
  | 'chest'
  | 'ice'
  | 'hazard'
  | 'rhythm'
  | 'board'
  | 'sustain'
  | 'insight';

export interface WeaponDemoSpec {
  archetype: WeaponDemoArchetype;
  accent: string;
  badge: string;
  caption: string;
  schematicNote: string;
  icon: IconName;
  /** Primary matched slots on the 3×3 mini-board (0..8) */
  matchSlots: readonly number[];
  /** Secondary affected / target slots on the 3×3 mini-board (0..8) */
  effectSlots: readonly number[];
}

interface MiniCardDef {
  shape: Shape;
  color: Color;
  count: 1 | 2 | 3;
}

/** Deterministic 3×3 mini-board layout using Circle / Triangle / Bolt × Orange / Blue / Pink. */
const MINI_BOARD: readonly MiniCardDef[] = [
  { shape: 'oval', color: 'red', count: 1 },      // 0: Orange Circle
  { shape: 'diamond', color: 'green', count: 2 }, // 1: Blue Triangle
  { shape: 'squiggle', color: 'purple', count: 3 }, // 2: Pink Bolt
  { shape: 'diamond', color: 'red', count: 2 },   // 3: Orange Triangle
  { shape: 'oval', color: 'green', count: 1 },    // 4: Blue Circle (center)
  { shape: 'squiggle', color: 'red', count: 3 },  // 5: Orange Bolt
  { shape: 'squiggle', color: 'green', count: 1 }, // 6: Blue Bolt
  { shape: 'oval', color: 'purple', count: 2 },   // 7: Pink Circle
  { shape: 'diamond', color: 'purple', count: 3 }, // 8: Pink Triangle
];

const ARCHETYPE_DEFAULTS: Record<WeaponDemoArchetype, WeaponDemoSpec> = {
  blast: {
    archetype: 'blast',
    accent: '#EA580C',
    badge: 'BLAST',
    caption: 'Matched Trio detonates neighboring cards around the blast.',
    schematicNote: 'Center Trio → adjacent cards shatter for bonus damage',
    icon: 'lorc/bright-explosion',
    matchSlots: [3, 4, 5],
    effectSlots: [1, 7],
  },
  laser: {
    archetype: 'laser',
    accent: '#0284C7',
    badge: 'LASER',
    caption: 'Sweeps an entire row or column cleanly off the board.',
    schematicNote: 'Beam sweeps across row → vaporizes all 3 slots',
    icon: 'lorc/laser-blast',
    matchSlots: [0, 4, 8],
    effectSlots: [3, 4, 5],
  },
  fire: {
    archetype: 'fire',
    accent: '#DC2626',
    badge: 'IGNITE',
    caption: 'Sets cards ablaze so they burn out and spread to neighbors.',
    schematicNote: 'Flame ignites slot → burns & jumps to adjacent card',
    icon: 'lorc/campfire',
    matchSlots: [0, 1, 2],
    effectSlots: [4, 5],
  },
  ricochet: {
    archetype: 'ricochet',
    accent: '#9333EA',
    badge: 'BOUNCE',
    caption: 'Chain bolts ricochet randomly across extra cards on the board.',
    schematicNote: 'Zap chain bounces across 3 extra board slots',
    icon: 'lorc/lightning-branches',
    matchSlots: [0, 3, 6],
    effectSlots: [1, 5, 7],
  },
  link: {
    archetype: 'link',
    accent: '#0F766E',
    badge: 'LINKED',
    caption: 'Wires paired slots together—clearing one snaps its partner too.',
    schematicNote: 'Linked ring pairs break together on any clear',
    icon: 'lorc/linked-rings',
    matchSlots: [0, 4, 8],
    effectSlots: [2, 6],
  },
  echo: {
    archetype: 'echo',
    accent: '#2563EB',
    badge: 'ECHO',
    caption: 'Automatically echoes a free follow-up Trio right after your match.',
    schematicNote: 'First Trio triggers an automatic golden Echo Trio',
    icon: 'lorc/echo-ripples',
    matchSlots: [0, 1, 2],
    effectSlots: [6, 7, 8],
  },
  rainbow: {
    archetype: 'rainbow',
    accent: '#D97706',
    badge: 'RAINBOW',
    caption: 'All-different Trio (Orange Circle, Blue Triangle, Pink Bolt) spikes big.',
    schematicNote: 'Orange Circle + Blue Triangle + Pink Bolt = all-different payout',
    icon: 'lorc/rainbow-star',
    matchSlots: [0, 1, 2],
    effectSlots: [0, 1, 2],
  },
  magnet: {
    archetype: 'magnet',
    accent: '#DC2626',
    badge: 'TARGET',
    caption: 'Hunt the marked card in your Trio for a guaranteed payout.',
    schematicNote: 'Include the marked target slot in your Trio to cash in',
    icon: 'lorc/magnet',
    matchSlots: [1, 4, 7],
    effectSlots: [4],
  },
  tightrope: {
    archetype: 'tightrope',
    accent: '#B45309',
    badge: 'ADJACENT',
    caption: 'Keep each Trio touching your previous spots to stay on the rope.',
    schematicNote: 'Highlighted halo rings spots touching your last Trio',
    icon: 'delapouite/tightrope',
    matchSlots: [3, 4, 5],
    effectSlots: [1, 7],
  },
  chest: {
    archetype: 'chest',
    accent: '#B45309',
    badge: '+3→+6→+9',
    caption: 'Leave the chest card alone to fatten it, then match to burst it open.',
    schematicNote: 'Pass it by to stack +3 → +6 → +9, then match to cash out',
    icon: 'delapouite/mimic-chest',
    matchSlots: [2, 4, 6],
    effectSlots: [4],
  },
  ice: {
    archetype: 'ice',
    accent: '#0284C7',
    badge: 'THAW',
    caption: 'Counts down while locked, then unlocks into a massive reward card.',
    schematicNote: 'Locked slot counts down 3 → 2 → 1, then unlocks huge bonus',
    icon: 'lorc/ice-cube',
    matchSlots: [0, 4, 8],
    effectSlots: [4],
  },
  hazard: {
    archetype: 'hazard',
    accent: '#BE123C',
    badge: 'GAMBLE',
    caption: 'Adds a live board risk—clear it on time for a big payoff.',
    schematicNote: 'Timed risk marker on card → clear in window for high bonus',
    icon: 'delapouite/time-dynamite',
    matchSlots: [1, 4, 7],
    effectSlots: [4],
  },
  rhythm: {
    archetype: 'rhythm',
    accent: '#1D4ED8',
    badge: '1·2·3 SLAM',
    caption: 'Keep up your Trio cadence to unleash an empowered rhythm slam.',
    schematicNote: 'Fast consecutive Trios charge the beat meter into a slam',
    icon: 'delapouite/drum',
    matchSlots: [0, 1, 2],
    effectSlots: [3, 4, 5],
  },
  board: {
    archetype: 'board',
    accent: '#15803D',
    badge: 'BOARD+',
    caption: 'Reshapes, expands, or simplifies the board so Trios jump out.',
    schematicNote: 'Adds wild / empowered / simplified slots for easier Trios',
    icon: 'lorc/field',
    matchSlots: [0, 4, 8],
    effectSlots: [2, 5, 8],
  },
  sustain: {
    archetype: 'sustain',
    accent: '#0F766E',
    badge: 'SHIELD ♥',
    caption: 'Protects hearts and Graces, turning steady survival into retaliation.',
    schematicNote: 'Restores ♥ / Graces and shields mistakes while striking back',
    icon: 'lorc/shining-heart',
    matchSlots: [3, 4, 5],
    effectSlots: [4],
  },
  insight: {
    archetype: 'insight',
    accent: '#7C3AED',
    badge: 'INSIGHT',
    caption: 'Boosts hints, coins, XP, clock tempo, or partner triggers.',
    schematicNote: 'Feeds hints, coins, XP, clock, or copies your left weapon',
    icon: 'lorc/third-eye',
    matchSlots: [0, 4, 8],
    effectSlots: [1, 4, 7],
  },
};

/** Explicit mapping for all 64 Armory weapons so none fall through unmapped. */
export const WEAPON_DEMO_ARCHETYPE: Record<string, WeaponDemoArchetype> = {
  // Damage (9)
  'blast-powder': 'blast',
  'rainbow-charm': 'rainbow',
  'flint-spark': 'fire',
  'prismatic-ray': 'laser',
  'chaos-shard': 'ricochet',
  'war-drum': 'rhythm',
  'rally-horn': 'rhythm',
  pinata: 'rhythm',
  'amplifier-coil': 'insight',
  // Tricks (10)
  magnet: 'magnet',
  'bounty-poster': 'magnet',
  'mirror-shard': 'magnet',
  'odd-one-out': 'rainbow',
  'collectors-album': 'magnet',
  snowball: 'rhythm',
  'glass-sword': 'rhythm',
  'devils-bargain': 'sustain',
  tightrope: 'tightrope',
  understudy: 'insight',
  // Board gambles (12)
  'cursed-idol': 'ice',
  'chain-gang': 'hazard',
  'thorn-bush': 'hazard',
  rust: 'chest',
  'tar-pit': 'hazard',
  decoy: 'hazard',
  'long-fuse': 'hazard',
  'ice-block': 'ice',
  'greedy-chest': 'chest',
  'hot-potato': 'hazard',
  'twin-seed': 'hazard',
  'fog-lantern': 'ice',
  // Board (4)
  'field-stone': 'board',
  'growth-seed': 'board',
  'clarity-lens': 'board',
  'wild-card': 'board',
  // Hearts & graces (9)
  'mending-charm': 'sustain',
  'life-vessel': 'sustain',
  'life-link': 'blast',
  'soul-harvest': 'sustain',
  'revenge-linker': 'link',
  'second-chance': 'sustain',
  'fortune-token': 'sustain',
  'grace-conduit': 'laser',
  'chaos-conduit': 'blast',
  // Hints, coins & XP (8)
  'seeker-lens': 'insight',
  'crystal-orb': 'insight',
  'oracle-eye': 'insight',
  'mystic-sight': 'insight',
  'fortunes-favor': 'insight',
  'fortunes-blessing': 'insight',
  'scholars-tome': 'insight',
  'wisdom-chain': 'insight',
  // Time & evolutions (5)
  'chrono-shard': 'insight',
  'time-drop': 'insight',
  'temporal-rift': 'echo',
  'catalyst-prism': 'rainbow',
  'encore-mask': 'insight',
  // Echoes & links (7)
  'echo-stone': 'echo',
  'chain-reaction': 'echo',
  'cascade-core': 'fire',
  connector: 'link',
  'web-weaver': 'link',
  'neural-network': 'link',
  'echo-chamber': 'link',
};

const WEAPON_CUSTOM_BADGE: Partial<Record<string, string>> = {
  'greedy-chest': '+3 → +6 → +9',
  'ice-block': '7 SETS → THAW',
  'fog-lantern': '8s → POWER',
  'cursed-idol': '10s → ×2',
  'long-fuse': 'LAST 5s!',
  'odd-one-out': '1 DIFF!',
  'rally-horn': 'EVERY 4th!',
  'war-drum': '3 FAST!',
  understudy: '← COPIES LEFT',
  'amplifier-coil': '×2 NEXT PROC',
  'encore-mask': 'EVO FINALE',
  'wild-card': 'WILD JOKER',
};

export const getWeaponDemoSpec = (weaponId: string): WeaponDemoSpec => {
  const archetype = WEAPON_DEMO_ARCHETYPE[weaponId] ?? 'blast';
  const base = ARCHETYPE_DEFAULTS[archetype];
  const customBadge = WEAPON_CUSTOM_BADGE[weaponId];
  return customBadge ? { ...base, badge: customBadge } : base;
};

/** Renders 1–3 crisp v0.1.173 shapes (Circle / Triangle / Bolt × Orange / Blue / Pink). */
const MiniCardGlyph: React.FC<{ def: MiniCardDef }> = ({ def }) => {
  const fill = CARD_LIGHT_COLORS[def.color];
  const shapeSize = def.count === 3 ? 8 : def.count === 2 ? 9 : 11;
  return (
    <View style={st.glyphRow}>
      {Array.from({ length: def.count }).map((_, i) => (
        <Svg
          key={i}
          width={shapeSize}
          height={Math.round(shapeSize * 1.25)}
          viewBox={`0 0 ${CARD_SVG_WIDTH} ${CARD_SVG_HEIGHT}`}
        >
          {def.shape === 'oval' && (
            <Circle
              cx={CARD_SHAPE_GEOMETRY.circle.cx}
              cy={CARD_SHAPE_GEOMETRY.circle.cy}
              r={CARD_SHAPE_GEOMETRY.circle.r}
              fill={fill}
              stroke={fill}
              strokeWidth={CARD_STROKE_WIDTH}
            />
          )}
          {def.shape === 'diamond' && (
            <Polygon
              points={CARD_SHAPE_GEOMETRY.trianglePoints}
              fill={fill}
              stroke={fill}
              strokeWidth={CARD_STROKE_WIDTH}
              strokeLinejoin="round"
            />
          )}
          {def.shape === 'squiggle' && (
            <Polygon
              points={CARD_SHAPE_GEOMETRY.boltPoints}
              fill={fill}
              stroke={fill}
              strokeWidth={CARD_STROKE_WIDTH}
              strokeLinejoin="round"
            />
          )}
        </Svg>
      ))}
    </View>
  );
};

interface Props {
  weaponId: string;
  compact?: boolean;
  testID?: string;
}

const LOOP_MS = 2200;

const WeaponDemoClip: React.FC<Props> = ({ weaponId, compact = false, testID }) => {
  const reducedMotion = useReducedMotion();
  const appActive = useAppActive();
  const spec = useMemo(() => getWeaponDemoSpec(weaponId), [weaponId]);
  const isActive = !reducedMotion && appActive;

  const phase = useSharedValue(0);

  useEffect(() => {
    if (!isActive) {
      cancelAnimation(phase);
      phase.value = 0;
      return;
    }
    phase.value = 0;
    phase.value = withRepeat(
      withTiming(1, { duration: LOOP_MS, easing: EASE.linear }),
      -1
    );
    return () => {
      cancelAnimation(phase);
    };
  }, [isActive, phase]);

  // GPU-only transform + opacity choreography across the 2.2s cycle:
  // 0.00..0.38: Trio highlights; 0.38..0.78: Weapon effect pops/sweeps; 0.78..1.00: Settle
  const matchPulseStyle = useAnimatedStyle(() => {
    const p = phase.value;
    const peak = p < 0.45 ? Math.sin((p / 0.45) * Math.PI) : 0;
    return {
      opacity: 0.78 + peak * 0.22,
      transform: [{ scale: 1 + peak * 0.08 }],
    };
  });

  const effectPopStyle = useAnimatedStyle(() => {
    const p = phase.value;
    const local = p >= 0.36 && p <= 0.86 ? (p - 0.36) / 0.5 : 0;
    const wave = Math.sin(local * Math.PI);
    return {
      opacity: 0.25 + wave * 0.75,
      transform: [{ scale: 0.86 + wave * 0.28 }],
    };
  });

  const sweepStyle = useAnimatedStyle(() => {
    const p = phase.value;
    const local = p >= 0.34 && p <= 0.8 ? (p - 0.34) / 0.46 : 0;
    const active = p >= 0.34 && p <= 0.8 ? 1 : 0;
    return {
      opacity: active * Math.sin(local * Math.PI),
      transform: [{ translateX: (local - 0.5) * 44 }, { scaleX: 0.5 + local * 0.6 }],
    };
  });

  const cellW = compact ? 32 : 38;
  const cellH = compact ? 24 : 28;
  const gridW = cellW * 3 + 12;
  const gridH = cellH * 3 + 12;
  const showSchematic = reducedMotion;

  return (
    <View
      style={st.wrap}
      testID={testID ?? `weapon-demo-clip-${weaponId}`}
      accessibilityLabel={`Visual preview: ${spec.caption}`}
    >
      <View style={st.headerRow}>
        <View style={[st.badgePill, { backgroundColor: spec.accent }]}>
          <Icon name={spec.icon} size={12} color={COLORS.canvasWhite} noShadow />
          <Text style={st.badgeText}>{spec.badge}</Text>
        </View>
        <Text style={st.modeTag} numberOfLines={1}>
          {showSchematic ? 'SCHEMATIC' : '2s PREVIEW'}
        </Text>
      </View>

      <View style={st.stageRow}>
        <View
          style={[st.boardBox, { width: gridW, height: gridH }]}
          testID={showSchematic ? `weapon-demo-schematic-${weaponId}` : `weapon-demo-loop-${weaponId}`}
        >
          {[0, 1, 2].map(r => (
            <View key={r} style={st.boardRow}>
              {[0, 1, 2].map(c => {
                const idx = r * 3 + c;
                const isMatch = spec.matchSlots.includes(idx);
                const isEffect = spec.effectSlots.includes(idx);
                const cardStyle = [
                  st.miniCard,
                  { width: cellW, height: cellH },
                  isMatch && { borderColor: INK, backgroundColor: '#FFFBEB' },
                  isEffect && !isMatch && { borderColor: spec.accent, backgroundColor: '#FFF7ED' },
                ];

                if (showSchematic) {
                  return (
                    <View key={idx} style={cardStyle}>
                      <MiniCardGlyph def={MINI_BOARD[idx]} />
                      {isEffect && (
                        <View style={[st.effectDot, { backgroundColor: spec.accent }]} />
                      )}
                    </View>
                  );
                }

                return (
                  <Animated.View
                    key={idx}
                    style={[
                      cardStyle,
                      isMatch ? matchPulseStyle : isEffect ? effectPopStyle : undefined,
                    ]}
                  >
                    <MiniCardGlyph def={MINI_BOARD[idx]} />
                    {isEffect && (
                      <View style={[st.effectDot, { backgroundColor: spec.accent }]} />
                    )}
                  </Animated.View>
                );
              })}
            </View>
          ))}

          {/* Static annotated SVG overlay (always crisp for Reduced Motion; animated sweep/ring otherwise) */}
          {showSchematic ? (
            <Svg
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
              width={gridW}
              height={gridH}
              viewBox={`0 0 ${gridW} ${gridH}`}
            >
              {spec.archetype === 'laser' && (
                <Rect x={2} y={gridH / 2 - 3} width={gridW - 4} height={6} rx={3} fill={spec.accent} opacity={0.55} />
              )}
              {(spec.archetype === 'blast' || spec.archetype === 'tightrope') && (
                <Circle
                  cx={gridW / 2}
                  cy={gridH / 2}
                  r={Math.min(gridW, gridH) * 0.42}
                  fill="none"
                  stroke={spec.accent}
                  strokeWidth={2.5}
                  strokeDasharray="5 3"
                />
              )}
              {(spec.archetype === 'link' || spec.archetype === 'ricochet') && (
                <Line
                  x1={gridW * 0.22}
                  y1={gridH * 0.78}
                  x2={gridW * 0.78}
                  y2={gridH * 0.22}
                  stroke={spec.accent}
                  strokeWidth={2.5}
                  strokeDasharray="4 3"
                />
              )}
              {spec.archetype !== 'laser' && spec.archetype !== 'blast' && spec.archetype !== 'tightrope' && spec.archetype !== 'link' && spec.archetype !== 'ricochet' && (
                <Path
                  d={`M ${gridW * 0.16} ${gridH * 0.5} L ${gridW * 0.84} ${gridH * 0.5}`}
                  stroke={spec.accent}
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  opacity={0.7}
                />
              )}
            </Svg>
          ) : spec.archetype === 'laser' ? (
            <Animated.View
              pointerEvents="none"
              style={[st.laserOverlay, { backgroundColor: spec.accent }, sweepStyle]}
            />
          ) : (
            <Animated.View
              pointerEvents="none"
              style={[st.haloOverlay, { borderColor: spec.accent }, effectPopStyle]}
            />
          )}
        </View>

        <View style={st.copyCol}>
          <Text style={st.caption}>{spec.caption}</Text>
          <Text style={st.schematicNote}>{spec.schematicNote}</Text>
        </View>
      </View>
    </View>
  );
};

const st = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: INK,
    padding: 8,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: COLORS.canvasWhite,
  },
  modeTag: {
    flexShrink: 1,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    color: INK,
    opacity: 0.6,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  boardBox: {
    padding: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: INK,
    backgroundColor: '#E8E1D6',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  boardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  miniCard: {
    borderRadius: 4,
    borderWidth: 1.25,
    borderColor: '#C5BCB0',
    backgroundColor: COLORS.canvasWhite,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glyphRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1.5,
  },
  effectDot: {
    position: 'absolute',
    top: 1.5,
    right: 1.5,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  laserOverlay: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: '46%',
    height: 5,
    borderRadius: 3,
  },
  haloOverlay: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    left: 8,
    right: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  copyCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  caption: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '800',
    color: INK,
  },
  schematicNote: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    color: INK,
    opacity: 0.72,
  },
});

export default WeaponDemoClip;
