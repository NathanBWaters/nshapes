/**
 * [UI-04] & [UI-05] Hand-crafted 2-tone Storybook SVG Biome Scenery.
 *
 * Replaces raw monochrome `lorc/` icon stamping on `AdventureMap.tsx` with
 * cohesive, desaturated (~35-45% quieter than foreground road nodes per Sakurai
 * Ep. #030 & #129), overhead-lit vector diorama props and smooth vertical
 * sky-to-horizon atmospheric gradients for all 5 campaign biomes:
 *   1. Sunny Meadow     — wildflower tufts, wooden signposts, clipped garden hedges, sunlit paper-cut sun
 *   2. Whispering Woods — layered forest pines, mossy logs, warm lantern posts, drifting mist clouds
 *   3. Ember Canyon     — mesa silhouettes, sandstone arches, glowing ember cracks, warm canyon sun
 *   4. Frozen Peaks     — snow-capped alpine ridges, frost pines, faceted ice shards, winter clouds
 *   5. Starfall Summit  — floating star-stones, stone observatory arches, golden nebula wisps & comet
 *
 * Completely static SVG layers (zero frame loops, zero runtime battery cost).
 */
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
  Svg,
} from 'react-native-svg';
import type { BiomeDef, BiomeId } from '../types';

export interface BiomeSceneryProps {
  biome: BiomeDef;
  width: number;
  height: number;
}

/** Margin prop anchor slots [xFraction, yFraction, scale, propVariantIndex]. */
const PROP_SLOTS: readonly [number, number, number, number][] = [
  [0.06, 0.21, 1.05, 0],
  [0.88, 0.28, 0.96, 1],
  [0.09, 0.41, 0.92, 2],
  [0.91, 0.50, 1.08, 0],
  [0.05, 0.62, 0.96, 1],
  [0.86, 0.70, 0.90, 2],
  [0.10, 0.81, 1.04, 0],
  [0.89, 0.89, 0.95, 1],
];

const STROKE_OPACITY = 0.58;

/** Hand-crafted 2-tone overhead-lit vector prop rendered inside a 48×48 local coordinate frame. */
function renderBiomeProp(biomeId: BiomeId, variant: number, ink: string): React.ReactNode {
  switch (biomeId) {
    case 'meadow': {
      if (variant === 0) {
        // Soft storybook hedge + wildflower tuft with warm top highlight
        return (
          <G>
            <Ellipse cx={24} cy={41} rx={17} ry={4} fill={ink} opacity={0.14} />
            <Path
              d="M 8 39 C 6 29, 13 23, 19 25 C 21 17, 32 16, 35 24 C 42 24, 44 33, 40 39 Z"
              fill="#8DB97D"
              stroke={ink}
              strokeOpacity={STROKE_OPACITY}
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
            <Path
              d="M 12 31 C 14 25, 22 20, 31 22"
              stroke="#DDF0CC"
              strokeWidth={2.4}
              strokeLinecap="round"
              fill="none"
              opacity={0.75}
            />
            <Circle cx={16} cy={31} r={2.6} fill="#F7DC6F" stroke={ink} strokeOpacity={0.45} strokeWidth={1.1} />
            <Circle cx={28} cy={27} r={2.4} fill="#FFFDF7" stroke={ink} strokeOpacity={0.45} strokeWidth={1.1} />
            <Circle cx={34} cy={33} r={2.2} fill="#F5B7B1" stroke={ink} strokeOpacity={0.45} strokeWidth={1.1} />
          </G>
        );
      }
      if (variant === 1) {
        // Storybook wooden trail signpost
        return (
          <G>
            <Ellipse cx={24} cy={42} rx={11} ry={3.2} fill={ink} opacity={0.15} />
            <Rect
              x={21}
              y={14}
              width={6}
              height={28}
              rx={2}
              fill="#B08968"
              stroke={ink}
              strokeOpacity={STROKE_OPACITY}
              strokeWidth={1.7}
            />
            <Polygon
              points="10,17 34,17 40,22 34,27 10,27"
              fill="#D4B48C"
              stroke={ink}
              strokeOpacity={STROKE_OPACITY}
              strokeWidth={1.7}
              strokeLinejoin="round"
            />
            <Line x1={13} y1={20} x2={32} y2={20} stroke="#FFFDF5" strokeWidth={1.6} opacity={0.65} />
            <Path d="M 15 41 Q 18 35 21 41 M 27 41 Q 30 36 33 41" stroke="#75A369" strokeWidth={2} strokeLinecap="round" fill="none" />
          </G>
        );
      }
      // Tall meadow clover & golden daisy cluster
      return (
        <G>
          <Ellipse cx={24} cy={41} rx={12} ry={3.2} fill={ink} opacity={0.13} />
          <Path d="M 18 40 Q 17 28 14 21 M 24 40 Q 25 26 27 17 M 31 40 Q 33 30 36 25" stroke="#6B9A5E" strokeWidth={2.2} strokeLinecap="round" fill="none" />
          <Circle cx={27} cy={16} r={5.2} fill="#FFFDF7" stroke={ink} strokeOpacity={0.5} strokeWidth={1.4} />
          <Circle cx={27} cy={16} r={2.3} fill="#EAB308" />
          <Circle cx={14} cy={21} r={3.8} fill="#F9E79F" stroke={ink} strokeOpacity={0.45} strokeWidth={1.3} />
          <Circle cx={36} cy={25} r={3.2} fill="#FFFDF7" stroke={ink} strokeOpacity={0.45} strokeWidth={1.2} />
        </G>
      );
    }

    case 'woods': {
      if (variant === 0) {
        // Layered 2-tone storybook conifer pine
        return (
          <G>
            <Ellipse cx={24} cy={42} rx={13} ry={3.5} fill={ink} opacity={0.16} />
            <Rect x={20.5} y={33} width={7} height={9} rx={1.5} fill="#8D6E53" stroke={ink} strokeOpacity={STROKE_OPACITY} strokeWidth={1.6} />
            <Polygon points="24,18 9,36 39,36" fill="#5D8C6B" stroke={ink} strokeOpacity={STROKE_OPACITY} strokeWidth={1.7} strokeLinejoin="round" />
            <Polygon points="24,10 12,27 36,27" fill="#6F9F7C" stroke={ink} strokeOpacity={STROKE_OPACITY} strokeWidth={1.7} strokeLinejoin="round" />
            <Polygon points="24,5 15,19 33,19" fill="#82B38D" stroke={ink} strokeOpacity={STROKE_OPACITY} strokeWidth={1.7} strokeLinejoin="round" />
            <Path d="M 23 8 L 17 17 M 23 15 L 15 25" stroke="#CBE6CE" strokeWidth={1.8} strokeLinecap="round" opacity={0.7} />
          </G>
        );
      }
      if (variant === 1) {
        // Warm woodland lantern post
        return (
          <G>
            <Ellipse cx={24} cy={42} rx={10} ry={3} fill={ink} opacity={0.16} />
            <Path d="M 19 42 L 19 14 L 31 14" stroke="#6E5A47" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <Circle cx={31} cy={22} r={8} fill="#FDE68A" opacity={0.34} />
            <Rect x={27.5} y={17.5} width={7} height={9} rx={2} fill="#FBBF24" stroke={ink} strokeOpacity={STROKE_OPACITY} strokeWidth={1.6} />
            <Path d="M 26 17.5 L 31 14 L 36 17.5 Z" fill="#475569" stroke={ink} strokeOpacity={STROKE_OPACITY} strokeWidth={1.4} />
          </G>
        );
      }
      // Mossy fallen woodland log & mushrooms
      return (
        <G>
          <Ellipse cx={24} cy={40} rx={17} ry={4} fill={ink} opacity={0.15} />
          <Rect x={8} y={30} width={31} height={10} rx={5} fill="#8C6D52" stroke={ink} strokeOpacity={STROKE_OPACITY} strokeWidth={1.7} />
          <Ellipse cx={37} cy={35} rx={3.5} ry={5} fill="#C6A989" stroke={ink} strokeOpacity={STROKE_OPACITY} strokeWidth={1.5} />
          <Path d="M 12 31 Q 20 26 28 31" fill="#77A87C" opacity={0.9} />
          <Path d="M 16 28 C 16 23, 24 23, 24 28 Z" fill="#D97757" stroke={ink} strokeOpacity={0.5} strokeWidth={1.3} />
          <Rect x={19} y={28} width={2.4} height={3} fill="#FFFDF5" />
        </G>
      );
    }

    case 'canyon': {
      if (variant === 0) {
        // Layered sandstone mesa silhouette with sunlit top ledge
        return (
          <G>
            <Ellipse cx={24} cy={41} rx={18} ry={4} fill={ink} opacity={0.15} />
            <Polygon
              points="7,40 13,18 33,18 41,40"
              fill="#D48B5B"
              stroke={ink}
              strokeOpacity={STROKE_OPACITY}
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
            <Polygon points="13,18 33,18 35,23 11,23" fill="#EDBA8E" opacity={0.85} />
            <Path d="M 12 31 L 37 31" stroke="#B66C3E" strokeWidth={2} opacity={0.65} />
          </G>
        );
      }
      if (variant === 1) {
        // Carved sandstone arch with warm overhead highlight
        return (
          <G>
            <Ellipse cx={24} cy={41} rx={17} ry={3.8} fill={ink} opacity={0.15} />
            <Path
              d="M 8 40 L 10 21 C 12 12, 36 12, 38 21 L 40 40 L 31 40 L 30 27 C 29 22, 19 22, 18 27 L 17 40 Z"
              fill="#CA7D4D"
              stroke={ink}
              strokeOpacity={STROKE_OPACITY}
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
            <Path d="M 14 17 Q 24 13 33 17" stroke="#F8D8B5" strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.75} />
          </G>
        );
      }
      // Canyon rock cairn + subtle glowing ember crack
      return (
        <G>
          <Ellipse cx={24} cy={40} rx={15} ry={4} fill={ink} opacity={0.16} />
          <Path d="M 11 39 L 17 24 L 28 21 L 38 39 Z" fill="#B87047" stroke={ink} strokeOpacity={STROKE_OPACITY} strokeWidth={1.7} strokeLinejoin="round" />
          <Path d="M 22 38 L 25 32 L 23 28" stroke="#FBBF24" strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.85} />
          <Circle cx={25} cy={24} r={2} fill="#FDBA74" opacity={0.8} />
        </G>
      );
    }

    case 'peaks': {
      if (variant === 0) {
        // Snow-capped twin alpine peak
        return (
          <G>
            <Ellipse cx={24} cy={41} rx={18} ry={3.8} fill={ink} opacity={0.14} />
            <Polygon points="6,40 20,12 34,40" fill="#89AECB" stroke={ink} strokeOpacity={STROKE_OPACITY} strokeWidth={1.7} strokeLinejoin="round" />
            <Polygon points="21,40 32,19 43,40" fill="#789EBD" stroke={ink} strokeOpacity={STROKE_OPACITY} strokeWidth={1.7} strokeLinejoin="round" />
            <Polygon points="20,12 15,22 20,20 25,22" fill="#FFFDF7" opacity={0.92} />
            <Polygon points="32,19 28.5,26 32,24.5 35.5,26" fill="#FFFDF7" opacity={0.88} />
          </G>
        );
      }
      if (variant === 1) {
        // Frosted evergreen pine
        return (
          <G>
            <Ellipse cx={24} cy={42} rx={12} ry={3.2} fill={ink} opacity={0.14} />
            <Rect x={21} y={34} width={6} height={8} rx={1.5} fill="#7B8FA1" stroke={ink} strokeOpacity={STROKE_OPACITY} strokeWidth={1.5} />
            <Polygon points="24,17 10,35 38,35" fill="#6F94AF" stroke={ink} strokeOpacity={STROKE_OPACITY} strokeWidth={1.6} strokeLinejoin="round" />
            <Polygon points="24,7 14,24 34,24" fill="#88ACC6" stroke={ink} strokeOpacity={STROKE_OPACITY} strokeWidth={1.6} strokeLinejoin="round" />
            <Path d="M 19 15 L 24 8 L 29 15 Q 24 13 19 15 Z" fill="#FFFDF7" opacity={0.9} />
          </G>
        );
      }
      // Faceted alpine ice crystal shards
      return (
        <G>
          <Ellipse cx={24} cy={41} rx={13} ry={3.2} fill={ink} opacity={0.14} />
          <Polygon points="20,40 16,22 24,10 31,22 28,40" fill="#9BC6E8" stroke={ink} strokeOpacity={STROKE_OPACITY} strokeWidth={1.6} strokeLinejoin="round" />
          <Polygon points="24,10 18,22 24,38" fill="#E6F4FE" opacity={0.68} />
          <Polygon points="30,40 31,26 37,20 40,28 36,40" fill="#7FB0D8" stroke={ink} strokeOpacity={STROKE_OPACITY} strokeWidth={1.5} strokeLinejoin="round" />
        </G>
      );
    }

    case 'summit':
    default: {
      if (variant === 0) {
        // Floating star-stone monolith with golden rune
        return (
          <G>
            <Ellipse cx={24} cy={42} rx={11} ry={3} fill={ink} opacity={0.16} />
            <Polygon
              points="24,8 34,19 31,34 24,38 17,34 14,19"
              fill="#8C7DBB"
              stroke={ink}
              strokeOpacity={STROKE_OPACITY}
              strokeWidth={1.7}
              strokeLinejoin="round"
            />
            <Polygon points="24,8 14,19 24,24" fill="#BDB2E2" opacity={0.65} />
            <Polygon points="24,16 26.5,21 24,26 21.5,21" fill="#FDE047" opacity={0.92} />
          </G>
        );
      }
      if (variant === 1) {
        // Storybook stone observatory arch
        return (
          <G>
            <Ellipse cx={24} cy={41} rx={16} ry={3.5} fill={ink} opacity={0.16} />
            <Path
              d="M 10 40 L 10 23 A 14 14 0 0 1 38 23 L 38 40 L 31 40 L 31 24 A 7 7 0 0 0 17 24 L 17 40 Z"
              fill="#978AC4"
              stroke={ink}
              strokeOpacity={STROKE_OPACITY}
              strokeWidth={1.7}
              strokeLinejoin="round"
            />
            <Circle cx={24} cy={22} r={3.2} fill="#FDE047" opacity={0.85} />
            <Path d="M 14 16 Q 24 11 33 15" stroke="#EDE9FE" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.7} />
          </G>
        );
      }
      // Nebula crystal & four-point star wisp
      return (
        <G>
          <Circle cx={24} cy={24} r={13} fill="#DDD6FE" opacity={0.4} />
          <Path
            d="M 24 11 Q 24 24 36 24 Q 24 24 24 37 Q 24 24 12 24 Q 24 24 24 11 Z"
            fill="#FDE047"
            stroke={ink}
            strokeOpacity={0.5}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          <Circle cx={35} cy={14} r={2.2} fill="#FFFDF7" opacity={0.85} />
        </G>
      );
    }
  }
}

/** Atmospheric celestial emblem perched in the upper right of each biome band. */
function renderSkyEmblem(biomeId: BiomeId, ink: string): React.ReactNode {
  switch (biomeId) {
    case 'meadow':
    case 'canyon': {
      const sunFill = biomeId === 'canyon' ? '#FDBA74' : '#FDE047';
      const haloFill = biomeId === 'canyon' ? '#FED7AA' : '#FEF9C3';
      return (
        <G>
          <Circle cx={36} cy={30} r={22} fill={haloFill} opacity={0.55} />
          <Circle cx={36} cy={30} r={14} fill={sunFill} stroke={ink} strokeOpacity={0.35} strokeWidth={1.6} />
          <Path d="M 29 24 A 9 9 0 0 1 39 20" stroke="#FFFDF7" strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.85} />
        </G>
      );
    }
    case 'summit':
      return (
        <G>
          <Path d="M 10 38 Q 25 32 39 22" stroke="#FDE68A" strokeWidth={3.5} strokeLinecap="round" fill="none" opacity={0.65} />
          <Path d="M 16 42 Q 28 36 39 26" stroke="#FFFDF7" strokeWidth={1.8} strokeLinecap="round" fill="none" opacity={0.75} />
          <Path
            d="M 42 12 Q 42 22 52 22 Q 42 22 42 32 Q 42 22 32 22 Q 42 22 42 12 Z"
            fill="#FDE047"
            stroke={ink}
            strokeOpacity={0.42}
            strokeWidth={1.4}
          />
        </G>
      );
    case 'woods':
    case 'peaks':
    default:
      return (
        <G opacity={0.85}>
          <Path
            d="M 14 36 C 8 36, 8 27, 15 26 C 17 19, 28 18, 32 24 C 39 23, 44 29, 41 36 Z"
            fill="#FFFDF7"
            stroke={ink}
            strokeOpacity={0.28}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <Path d="M 18 26 Q 25 22 31 26" stroke="#E2E8F0" strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.7} />
        </G>
      );
  }
}

/**
 * Painted storybook biome backdrop for one region of the Adventure Map.
 */
export const BiomeScenery: React.FC<BiomeSceneryProps> = memo(function BiomeScenery({
  biome,
  width,
  height,
}) {
  const safeW = Math.max(120, Math.round(width));
  const safeH = Math.max(120, Math.round(height));
  const skyTop = biome.colors.skyTop ?? biome.colors.sky;
  const skyHorizon = biome.colors.skyHorizon ?? biome.colors.sky;
  const hillFar = biome.colors.hillFar ?? biome.colors.ground;
  const hillNear = biome.colors.hillNear ?? biome.colors.ground;
  const skyGradId = `biome-sky-${biome.id}`;
  const hillGradId = `biome-hill-${biome.id}`;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      testID={`biome-scenery-${biome.id}`}
    >
      <Svg width={safeW} height={safeH} viewBox={`0 0 ${safeW} ${safeH}`}>
        <Defs>
          <LinearGradient id={skyGradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={skyTop} stopOpacity={1} />
            <Stop offset="0.62" stopColor={biome.colors.sky} stopOpacity={1} />
            <Stop offset="1" stopColor={skyHorizon} stopOpacity={1} />
          </LinearGradient>
          <LinearGradient id={hillGradId} x1="0.15" y1="0" x2="0.85" y2="1">
            <Stop offset="0" stopColor="#FFFDF5" stopOpacity={0.26} />
            <Stop offset="0.55" stopColor={hillNear} stopOpacity={0.55} />
            <Stop offset="1" stopColor="#1E293B" stopOpacity={0.14} />
          </LinearGradient>
        </Defs>

        {/* Smooth vertical atmospheric sky wash ([UI-05]) */}
        <Rect x={0} y={0} width={safeW} height={safeH} fill={`url(#${skyGradId})`} />

        {/* Soft layered atmospheric storybook hill ridges */}
        <Path
          d={`M 0 ${safeH * 0.28} Q ${safeW * 0.25} ${safeH * 0.22}, ${safeW * 0.56} ${safeH * 0.27} T ${safeW} ${safeH * 0.25} L ${safeW} ${safeH * 0.42} L 0 ${safeH * 0.42} Z`}
          fill={hillFar}
          opacity={0.42}
        />
        <Ellipse
          cx={safeW * 0.14}
          cy={safeH * 0.46}
          rx={safeW * 0.46}
          ry={Math.max(48, safeW * 0.18)}
          fill={hillNear}
          opacity={0.36}
        />
        <Ellipse
          cx={safeW * 0.86}
          cy={safeH * 0.66}
          rx={safeW * 0.48}
          ry={Math.max(52, safeW * 0.19)}
          fill={`url(#${hillGradId})`}
          opacity={0.46}
        />
        <Ellipse
          cx={safeW * 0.18}
          cy={safeH * 0.88}
          rx={safeW * 0.5}
          ry={Math.max(52, safeW * 0.2)}
          fill={hillFar}
          opacity={0.38}
        />

        {/* Celestial emblem tucked cleanly in upper right */}
        <G transform={`translate(${safeW - 72}, 12)`}>
          {renderSkyEmblem(biome.id, biome.colors.ink)}
        </G>

        {/* Desaturated 2-tone storybook props hugging the left/right margins */}
        {PROP_SLOTS.map(([xf, yf, scale, variant], i) => {
          const px = Math.round(xf * safeW - 24 * scale);
          const py = Math.round(yf * safeH - 24 * scale);
          return (
            <G
              key={i}
              opacity={0.72}
              transform={`translate(${px}, ${py}) scale(${scale})`}
            >
              {renderBiomeProp(biome.id, variant, biome.colors.ink)}
            </G>
          );
        })}
      </Svg>
    </View>
  );
});

export default BiomeScenery;
