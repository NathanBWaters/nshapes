import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Svg } from 'react-native-svg';
import { CreaturePartStyles } from './types';

/** Full-size, touch-transparent container that rig layers stack inside. */
export const RigLayerStack: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {children}
  </View>
);

interface RigLayerProps {
  /**
   * Animated style of the part this layer belongs to. Pass the prop (even while its
   * value is undefined) for a part that moves; leave it out for a layer that never does.
   */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/** One full-size 0..100 SVG layer of a rig. */
export const RigLayer: React.FC<RigLayerProps> = (props) => {
  const svg = (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {props.children}
    </Svg>
  );
  return 'style' in props ? (
    <Animated.View style={[StyleSheet.absoluteFill, props.style]}>{svg}</Animated.View>
  ) : (
    <View style={StyleSheet.absoluteFill}>{svg}</View>
  );
};

interface RigLayersProps {
  /** Object carrying the five animated part styles (rig props can be passed as-is). */
  partStyles: CreaturePartStyles;
  tail: React.ReactNode;
  body: React.ReactNode;
  leftEar: React.ReactNode;
  rightEar: React.ReactNode;
  head: React.ReactNode;
  paws: React.ReactNode;
  /** Draw the left/right appendages over the body instead of behind it. */
  earsInFront?: boolean;
}

/**
 * Standard six-layer rig: tail, (ears), body, (ears), head, paws — back to front.
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
}) => {
  const { tailStyle, leftEarStyle, rightEarStyle, headStyle, pawStyle } = partStyles;
  const ears = (
    <>
      <RigLayer style={leftEarStyle}>
        {leftEar}
      </RigLayer>
      <RigLayer style={rightEarStyle}>
        {rightEar}
      </RigLayer>
    </>
  );

  return (
    <RigLayerStack>
      <RigLayer style={tailStyle}>
        {tail}
      </RigLayer>
      {!earsInFront && ears}
      <RigLayer>{body}</RigLayer>
      {earsInFront && ears}
      <RigLayer style={headStyle}>
        {head}
      </RigLayer>
      <RigLayer style={pawStyle}>
        {paws}
      </RigLayer>
    </RigLayerStack>
  );
};
