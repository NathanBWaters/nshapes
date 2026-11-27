import React, { createContext, useContext, useId } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { G, Svg } from 'react-native-svg';
import {
  OverheadShadeDefs,
  applyOverheadLightingTree,
  toSilhouetteTree,
} from '@/components/illustration/primitives';
import { CreaturePartStyles } from './types';

export type CreatureFacing = 'front' | 'left' | 'right';
export type CreatureScaleTier = 'standard' | 'elite' | 'boss';

interface RigVisualContextValue {
  silhouette: boolean;
  facing: CreatureFacing;
  overheadLighting: boolean;
  scaleTier: CreatureScaleTier;
}

const DEFAULT_RIG_VISUAL: RigVisualContextValue = {
  silhouette: false,
  facing: 'front',
  overheadLighting: false,
  scaleTier: 'standard',
};

const RigVisualContext = createContext<RigVisualContextValue>(DEFAULT_RIG_VISUAL);

/**
 * Provides cross-rig visual directives (solid-black Silhouette Audit `[UI-07]`,
 * directional 3/4 facing `[UI-07]`, 2-tone overhead lighting `[UI-05]`, and
 * boss scale tier `[UI-06]`) to every nested `RigLayer` inside a creature.
 */
export const RigVisualProvider: React.FC<
  Partial<RigVisualContextValue> & { children: React.ReactNode }
> = ({
  silhouette = false,
  facing = 'front',
  overheadLighting = false,
  scaleTier = 'standard',
  children,
}) => (
  <RigVisualContext.Provider value={{ silhouette, facing, overheadLighting, scaleTier }}>
    {children}
  </RigVisualContext.Provider>
);

export const useRigVisual = (): RigVisualContextValue => useContext(RigVisualContext);

interface RigLayerStackProps {
  children: React.ReactNode;
  silhouette?: boolean;
  facing?: CreatureFacing;
  overheadLighting?: boolean;
  scaleTier?: CreatureScaleTier;
}

/** Full-size, touch-transparent container that rig layers stack inside. */
export const RigLayerStack: React.FC<RigLayerStackProps> = ({
  children,
  silhouette,
  facing,
  overheadLighting,
  scaleTier,
}) => {
  const inherited = useRigVisual();
  const content = (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {children}
    </View>
  );

  if (
    silhouette !== undefined ||
    facing !== undefined ||
    overheadLighting !== undefined ||
    scaleTier !== undefined
  ) {
    return (
      <RigVisualProvider
        silhouette={silhouette ?? inherited.silhouette}
        facing={facing ?? inherited.facing}
        overheadLighting={overheadLighting ?? inherited.overheadLighting}
        scaleTier={scaleTier ?? inherited.scaleTier}
      >
        {content}
      </RigVisualProvider>
    );
  }
  return content;
};

type RigPartRole = 'tail' | 'body' | 'leftEar' | 'rightEar' | 'head' | 'paws';

const LEFT_FACING_TRANSFORMS: Record<RigPartRole, string> = {
  tail: 'translate(3.2, -0.4)',
  body: 'translate(-1.0, 0)',
  leftEar: 'translate(-2.2, -0.6)',
  rightEar: 'translate(1.8, 0.5)',
  head: 'translate(-2.8, 0)',
  paws: 'translate(-1.8, 0)',
};

interface RigLayerProps {
  /**
   * Animated style of the part this layer belongs to. Pass the prop (even while its
   * value is undefined) for a part that moves; leave it out for a layer that never does.
   */
  style?: StyleProp<ViewStyle>;
  /** Optional anatomical slot for automatic 3/4 facing & lighting nuance */
  part?: RigPartRole;
  /** Disable automatic overhead shade overlay for layers with bespoke gradients */
  skipAutoLighting?: boolean;
  /** Disable automatic left-facing viewBox translation for true 3/4 left-drawn rigs */
  skipFacingOffset?: boolean;
  children: React.ReactNode;
}

/** One full-size 0..100 SVG layer of a rig. */
export const RigLayer: React.FC<RigLayerProps> = (props) => {
  const { silhouette, facing, overheadLighting, scaleTier } = useRigVisual();
  const rawId = useId();
  const gradId = `oh-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const shouldAutoLight = overheadLighting && !silhouette && !props.skipAutoLighting;
  const processedChildren = silhouette
    ? toSilhouetteTree(props.children)
    : shouldAutoLight
      ? applyOverheadLightingTree(props.children, gradId, scaleTier === 'boss')
      : props.children;

  const partTransform =
    facing === 'left' && !props.skipFacingOffset
      ? props.part
        ? LEFT_FACING_TRANSFORMS[props.part]
        : 'translate(-2.0, 0)'
      : undefined;

  const svg = (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {shouldAutoLight && <OverheadShadeDefs id={gradId} />}
      {partTransform ? <G transform={partTransform}>{processedChildren}</G> : processedChildren}
    </Svg>
  );

  return 'style' in props ? (
    <Animated.View style={[StyleSheet.absoluteFill, props.style]}>{svg}</Animated.View>
  ) : (
    <View style={StyleSheet.absoluteFill}>{svg}</View>
  );
};

interface RigLayersProps {
  /** Object carrying the animated part styles (rig props can be passed as-is). */
  partStyles: CreaturePartStyles;
  tail: React.ReactNode;
  body: React.ReactNode;
  leftEar: React.ReactNode;
  rightEar: React.ReactNode;
  head: React.ReactNode;
  paws: React.ReactNode;
  /** Draw the left/right appendages over the body instead of behind it. */
  earsInFront?: boolean;
  /** Disable node-doubling `applyOverheadLightingTree` across all 6 layers (for bespoke 3-stop rigs). */
  skipAutoLighting?: boolean;
  /** Disable automatic `LEFT_FACING_TRANSFORMS` offset across all 6 layers (for true 3/4 left rigs). */
  skipFacingOffset?: boolean;
}

/**
 * Standard six-layer rig: tail, (ears), body, (ears), head, paws — back to front.
 * Applies `headStyle` (including `headTx` + 2.5D orbital parallax), `pawStyle` (including
 * `pawTx` + `pawRotate` around anatomical `pivots.paws`), and optional `bodyStyle` cleanly.
 */
export const RigLayers: React.FC<RigLayersProps> = ({
  partStyles,
  tail,
  body,
  leftEar,
  rightEar,
  head,
  paws,
  earsInFront = false,
  skipAutoLighting,
  skipFacingOffset,
}) => {
  const { bodyStyle, tailStyle, leftEarStyle, rightEarStyle, headStyle, pawStyle } = partStyles;
  const ears = (
    <>
      <RigLayer
        part="leftEar"
        style={leftEarStyle}
        skipAutoLighting={skipAutoLighting}
        skipFacingOffset={skipFacingOffset}
      >
        {leftEar}
      </RigLayer>
      <RigLayer
        part="rightEar"
        style={rightEarStyle}
        skipAutoLighting={skipAutoLighting}
        skipFacingOffset={skipFacingOffset}
      >
        {rightEar}
      </RigLayer>
    </>
  );

  return (
    <RigLayerStack>
      <RigLayer
        part="tail"
        style={tailStyle}
        skipAutoLighting={skipAutoLighting}
        skipFacingOffset={skipFacingOffset}
      >
        {tail}
      </RigLayer>
      {!earsInFront && ears}
      {bodyStyle !== undefined ? (
        <RigLayer
          part="body"
          style={bodyStyle}
          skipAutoLighting={skipAutoLighting}
          skipFacingOffset={skipFacingOffset}
        >
          {body}
        </RigLayer>
      ) : (
        <RigLayer
          part="body"
          skipAutoLighting={skipAutoLighting}
          skipFacingOffset={skipFacingOffset}
        >
          {body}
        </RigLayer>
      )}
      {earsInFront && ears}
      <RigLayer
        part="head"
        style={headStyle}
        skipAutoLighting={skipAutoLighting}
        skipFacingOffset={skipFacingOffset}
      >
        {head}
      </RigLayer>
      <RigLayer
        part="paws"
        style={pawStyle}
        skipAutoLighting={skipAutoLighting}
        skipFacingOffset={skipFacingOffset}
      >
        {paws}
      </RigLayer>
    </RigLayerStack>
  );
};
