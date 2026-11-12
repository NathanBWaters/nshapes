import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { COLORS } from '@/utils/colors';

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
  /** Whole-rig transform (breath, posture, squash & stretch) */
  rigRootStyle: PartStyle;
  /** The creature rig and anything that should move with its body */
  rig: React.ReactNode;
  /** Effects and badges drawn over the stage without moving with the body */
  children?: React.ReactNode;
}

/**
 * The stage every animated creature stands on: optional portrait frame, ground
 * shadow, the moving rig root, overlays, and tap handling.
 */
export const CreatureStage: React.FC<CreatureStageProps> = ({
  size,
  frame,
  testID,
  accessibilityLabel,
  interactive,
  onPress,
  shadow,
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

  const shadowHeight = shadow ? Math.max(shadow.minHeight, Math.round(size * 0.11)) : 0;

  const stage = (
    <View
      style={[styles.stageBase, frameStyle]}
      testID={testID}
      accessibilityRole={interactive ? 'button' : 'image'}
      accessibilityLabel={accessibilityLabel}
    >
      {shadow && (
        <Animated.View
          pointerEvents="none"
          testID={shadow.testID}
          style={[
            styles.groundShadow,
            {
              width: Math.max(shadow.minWidth, Math.round(size * 0.54)),
              height: shadowHeight,
              borderRadius: shadowHeight,
              bottom: Math.max(2, Math.round(size * 0.065)),
            },
            shadow.style,
          ]}
        />
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

type PartStyle = ReturnType<typeof useAnimatedStyle>;

const styles = StyleSheet.create({
  stageBase: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  groundShadow: {
    position: 'absolute',
    backgroundColor: COLORS.slateCharcoal,
  },
});
