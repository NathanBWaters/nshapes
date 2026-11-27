import React from 'react';
import { Platform, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
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
    /** Core contact shadow animated style */
    style: PartStyle;
    /** Optional softer outer penumbra animated style (falls back to `style` when omitted) */
    penumbraStyle?: PartStyle;
    /** Optional live vertical offset (`<0` lift, `>0` stomp) for direct Omnimattes shadow coupling */
    bodyTy?: SharedValue<number>;
    /** Optional live vertical squash (`<1` squashed, `>1` stretched) for direct contact-shadow coupling */
    squashY?: SharedValue<number>;
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
 * dual-layer Omnimattes grounding shadow (core contact + directional outer penumbra
 * coupled to vertical lift & squash, scaled by `scaleTier` `[UI-06]`), subtle boss
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
  const shadowBodyTy = shadow?.bodyTy;
  const shadowSquashY = shadow?.squashY;
  const hasDirectCoupling = shadowBodyTy !== undefined || shadowSquashY !== undefined;

  // Direct UI-thread Omnimattes coupling when callers pass raw `bodyTy` / `squashY` channels
  const coreLiftStyle = useAnimatedStyle(() => {
    const ty = shadowBodyTy ? shadowBodyTy.value : 0;
    const sqY = shadowSquashY ? shadowSquashY.value : 1;
    const liftNorm = Math.min(1, Math.max(0, -ty) / Math.max(8, size * 0.28));
    const stompNorm = Math.min(1, Math.max(0, ty) / Math.max(6, size * 0.14));
    const squashBoost = Math.max(0, 1 - sqY);
    return {
      opacity: Math.max(0.12, Math.min(1, (1 + squashBoost * 0.25 + stompNorm * 0.16) * (1 - liftNorm * 0.58))),
      transform: [
        { scaleX: (1 + squashBoost * 0.32 + stompNorm * 0.14) * (1 - liftNorm * 0.28) },
        { scaleY: Math.max(0.6, (1 + squashBoost * 0.12 + stompNorm * 0.08) * (1 - liftNorm * 0.32)) },
      ],
    };
  });

  const penumbraLiftStyle = useAnimatedStyle(() => {
    const ty = shadowBodyTy ? shadowBodyTy.value : 0;
    const sqY = shadowSquashY ? shadowSquashY.value : 1;
    const liftNorm = Math.min(1, Math.max(0, -ty) / Math.max(8, size * 0.28));
    const stompNorm = Math.min(1, Math.max(0, ty) / Math.max(6, size * 0.14));
    const squashBoost = Math.max(0, 1 - sqY);
    return {
      opacity: Math.max(0.08, Math.min(1, (1 + squashBoost * 0.2 + stompNorm * 0.12) * (1 - liftNorm * 0.42))),
      transform: [
        // Upper-left sunlight pushes airborne penumbra gently right & softer
        { translateX: liftNorm * size * 0.045 },
        { scaleX: 1 + squashBoost * 0.26 + stompNorm * 0.16 + liftNorm * 0.06 },
        { scaleY: Math.max(0.7, 1 + squashBoost * 0.1 - liftNorm * 0.18) },
      ],
    };
  });

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

  const webContain = Platform.OS === 'web' ? ({ contain: 'layout style' } as ViewStyle) : undefined;
  const webWillChange = Platform.OS === 'web' ? ({ willChange: 'transform' } as ViewStyle) : undefined;

  const stage = (
    <View
      style={[styles.stageBase, webContain, frameStyle]}
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
            testID={`${shadow.testID}-penumbra`}
            style={[
              styles.groundShadow,
              webWillChange,
              {
                width: outerShadowWidth,
                height: outerShadowHeight,
                borderRadius: outerShadowHeight,
                bottom: Math.max(1, Math.round(size * 0.048)),
                marginLeft: Math.round(size * 0.03),
                backgroundColor: tierCfg.haloAlpha,
              },
              shadow.penumbraStyle ?? shadow.style,
              hasDirectCoupling && penumbraLiftStyle,
            ]}
          />
          {/* Crisp core contact shadow anchoring paws/feet to the ground plane */}
          <Animated.View
            pointerEvents="none"
            testID={shadow.testID}
            style={[
              styles.groundShadow,
              webWillChange,
              {
                width: shadowWidth,
                height: shadowHeight,
                borderRadius: shadowHeight,
                bottom: Math.max(2, Math.round(size * 0.062)),
                marginLeft: Math.round(size * 0.018),
                backgroundColor: tierCfg.coreAlpha,
              },
              shadow.style,
              hasDirectCoupling && coreLiftStyle,
            ]}
          />
        </>
      )}

      <Animated.View style={[StyleSheet.absoluteFill, webWillChange, rigRootStyle]}>{rig}</Animated.View>

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
