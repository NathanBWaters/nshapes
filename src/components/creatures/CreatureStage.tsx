import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import type { CreatureScaleTier } from './RigLayers';
import type { PartStyle } from './useCreatureMotion';

interface CreatureStageProps {
  size: number;
  /** Portrait-badge frame colours; omit for a bare, unframed creature */
  frame?: { borderColor: string; backgroundColor: string };
  testID: string;
  accessibilityLabel: string;
  /** Wrap the stage in a Pressable that calls `onPress` */
  interactive: boolean;
  onPress: () => void;
  /** Ground contact shadow; omit to draw none */
  shadow?: {
    testID: string;
    minWidth: number;
    minHeight: number;
    style: PartStyle;
  };
  /** [UI-06] Relative mass tier controlling grounding shadow footprint & boss atmospheric rim */
  scaleTier?: CreatureScaleTier;
  /** Whole-rig transform (breath, posture, squash & stretch) */
  rigRootStyle: PartStyle;
  /** The creature rig and anything that should move with its body */
  rig: React.ReactNode;
  /** Effects and badges drawn over the stage without moving with the body */
  children?: React.ReactNode;
}

const SHADOW_SCALE: Record<
  CreatureScaleTier,
  { widthRatio: number; heightRatio: number; minHeightBoost: number; coreAlpha: string; haloAlpha: string }
> = {
  standard: {
    widthRatio: 0.58,
    heightRatio: 0.11,
    minHeightBoost: 0,
    coreAlpha: 'rgba(18, 22, 30, 0.30)',
    haloAlpha: 'rgba(18, 22, 30, 0.14)',
  },
  elite: {
    widthRatio: 0.66,
    heightRatio: 0.128,
    minHeightBoost: 1,
    coreAlpha: 'rgba(18, 22, 30, 0.34)',
    haloAlpha: 'rgba(18, 22, 30, 0.16)',
  },
  boss: {
    widthRatio: 0.74,
    heightRatio: 0.145,
    minHeightBoost: 4,
    coreAlpha: 'rgba(18, 22, 30, 0.40)',
    haloAlpha: 'rgba(18, 22, 30, 0.20)',
  },
};

/**
 * The stage every animated creature stands on: optional portrait frame,
 * directional grounding shadow (scaled by `scaleTier` `[UI-06]`), subtle boss
 * atmospheric horizon halo, the moving rig root, overlays, and tap handling.
 */
export const CreatureStage: React.FC<CreatureStageProps> = ({
  size,
  frame,
  testID,
  accessibilityLabel,
  interactive,
  onPress,
  shadow,
  scaleTier = 'standard',
  rigRootStyle,
  rig,
  children,
}) => {
  const frameStyle: ViewStyle = frame
    ? {
        width: size,
        height: size,
        borderRadius: Math.max(10, Math.round(size * 0.24)),
        borderWidth: 2,
        borderColor: frame.borderColor,
        backgroundColor: frame.backgroundColor,
      }
    : {
        width: size,
        height: size,
      };

  const tierCfg = SHADOW_SCALE[scaleTier];
  const shadowWidth = shadow
    ? Math.max(shadow.minWidth, Math.round(size * tierCfg.widthRatio))
    : 0;
  const shadowHeight = shadow
    ? Math.max(shadow.minHeight + tierCfg.minHeightBoost, Math.round(size * tierCfg.heightRatio))
    : 0;
  const outerShadowWidth = Math.round(shadowWidth * 1.18);
  const outerShadowHeight = Math.round(shadowHeight * 1.32);

  const stage = (
    <View
      style={[styles.stageBase, frameStyle]}
      testID={testID}
      accessibilityRole={interactive ? 'button' : 'image'}
      accessibilityLabel={accessibilityLabel}
    >
      {/* [UI-06] Cool atmospheric separation halo behind massive bosses (Sakurai Ep. #063 & #172) */}
      {scaleTier === 'boss' && !frame && (
        <View
          pointerEvents="none"
          testID="boss-atmospheric-halo"
          style={[
            styles.bossHalo,
            {
              width: Math.round(size * 0.96),
              height: Math.round(size * 0.92),
              borderRadius: Math.round(size * 0.48),
            },
          ]}
        />
      )}

      {shadow && (
        <>
          {/* Soft directional outer penumbra shifted slightly right away from upper-left light */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.groundShadow,
              {
                width: outerShadowWidth,
                height: outerShadowHeight,
                borderRadius: outerShadowHeight,
                bottom: Math.max(1, Math.round(size * 0.048)),
                marginLeft: Math.round(size * 0.03),
                backgroundColor: tierCfg.haloAlpha,
              },
              shadow.style,
            ]}
          />
          {/* Crisp core contact shadow anchoring paws/feet to the ground plane */}
          <Animated.View
            pointerEvents="none"
            testID={shadow.testID}
            style={[
              styles.groundShadow,
              {
                width: shadowWidth,
                height: shadowHeight,
                borderRadius: shadowHeight,
                bottom: Math.max(2, Math.round(size * 0.062)),
                marginLeft: Math.round(size * 0.018),
                backgroundColor: tierCfg.coreAlpha,
              },
              shadow.style,
            ]}
          />
        </>
      )}

      <Animated.View style={[StyleSheet.absoluteFill, rigRootStyle]}>{rig}</Animated.View>

      {children}
    </View>
  );

  if (interactive) {
    return (
      <Pressable onPress={onPress} hitSlop={4} testID={`${testID}-pressable`}>
        {stage}
      </Pressable>
    );
  }

  return stage;
};

const styles = StyleSheet.create({
  stageBase: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  groundShadow: {
    position: 'absolute',
  },
  bossHalo: {
    position: 'absolute',
    backgroundColor: 'rgba(148, 163, 184, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(226, 232, 240, 0.35)',
  },
});
