/**
 * Painted paper-cut tabletop diorama battle stage backdrop (Lane 3).
 *
 * Renders the biome's Pillar-3 compliant (35–45% desaturated) painted paper-cut
 * diorama via a static `require(...)` asset map with `resizeMode="cover"`, paired
 * with a gentle warm storybook sunlight & ground-horizon readability veil so
 * `#383838` inked fighters, foes, grounding shadows, and floating damage numbers
 * pop effortlessly at every viewport size.
 *
 * Zero frame loops, zero runtime image allocations, 100% Web + iOS + Android + Jest safe.
 */
import React from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';
import type { BiomeId } from '../types';

export const BIOME_BACKDROP_ASSETS: Readonly<Record<BiomeId, ImageSourcePropType>> = {
  meadow: require('../../../assets/backdrops/meadow.png'),
  woods: require('../../../assets/backdrops/woods.png'),
  canyon: require('../../../assets/backdrops/canyon.png'),
  peaks: require('../../../assets/backdrops/peaks.png'),
  summit: require('../../../assets/backdrops/summit.png'),
};

export interface StageBackdropProps {
  biomeId: BiomeId;
  skyColor: string;
  groundColor: string;
  inkColor?: string;
  compact?: boolean;
}

/**
 * Per-biome subtle contrast veil opacity tuned so both light skies (Frozen Peaks,
 * Sunny Meadow) and deeper woodland/twilight palettes (Whispering Woods, Starfall Summit)
 * preserve effortless foreground silhouette separation for `#383838` ink actors.
 */
const BIOME_VEIL_TUNE: Readonly<Record<BiomeId, { midLift: number; floorShade: number }>> = {
  meadow: { midLift: 0.12, floorShade: 0.14 },
  woods: { midLift: 0.18, floorShade: 0.16 },
  canyon: { midLift: 0.14, floorShade: 0.15 },
  peaks: { midLift: 0.10, floorShade: 0.15 },
  summit: { midLift: 0.14, floorShade: 0.16 },
};

const StageBackdrop: React.FC<StageBackdropProps> = ({
  biomeId,
  skyColor,
  groundColor,
  inkColor = '#383838',
  compact = false,
}) => {
  const source = BIOME_BACKDROP_ASSETS[biomeId] ?? BIOME_BACKDROP_ASSETS.meadow;
  const tune = BIOME_VEIL_TUNE[biomeId] ?? BIOME_VEIL_TUNE.meadow;
  const gradVeilId = `stageDioramaVeil-${biomeId}`;
  const gradSunId = `stageDioramaSun-${biomeId}`;
  const midLift = compact ? tune.midLift + 0.04 : tune.midLift;
  const floorShade = compact ? tune.floorShade + 0.03 : tune.floorShade;

  return (
    <View
      testID="run-stage-backdrop"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: skyColor }]}
    >
      <Image
        testID={`stage-backdrop-image-${biomeId}`}
        source={source}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        style={st.image}
      />

      {/* Warm storybook readability veil + upper-left sunlight sheen + grounded horizon anchor */}
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <LinearGradient id={gradSunId} x1="0" y1="0" x2="0.85" y2="0.95">
            <Stop offset="0" stopColor="#FFFDF5" stopOpacity="0.16" />
            <Stop offset="0.48" stopColor="#FFFDF7" stopOpacity="0.04" />
            <Stop offset="1" stopColor="#1E293B" stopOpacity="0.08" />
          </LinearGradient>
          <LinearGradient id={gradVeilId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={skyColor} stopOpacity="0.14" />
            <Stop offset="0.46" stopColor="#FFFDF7" stopOpacity={String(midLift)} />
            <Stop offset="0.74" stopColor={groundColor} stopOpacity="0.08" />
            <Stop offset="1" stopColor={inkColor} stopOpacity={String(floorShade)} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="400" height="100" fill={`url(#${gradSunId})`} />
        <Rect x="0" y="0" width="400" height="100" fill={`url(#${gradVeilId})`} />
      </Svg>
    </View>
  );
};

const st = StyleSheet.create({
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});

export default StageBackdrop;
