import React from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import Icon, { IconName } from '@/components/Icon';
import { RigLayerStack } from '@/components/creatures/RigLayers';
import { COLORS } from '@/utils/colors';
import { CreatureRigProps } from './types';

interface FallbackFighterRigProps extends CreatureRigProps {
  /** The character's registered icon */
  icon?: IconName;
}

/**
 * Clean fallback rig for any future or custom character name not yet given a bespoke rig.
 * Renders its registered SVG icon inside the animated head/body transform container
 * so all physics, progressive damage bandages, and celebration FX still work seamlessly.
 */
export const FallbackFighterRig: React.FC<FallbackFighterRigProps> = ({
  size,
  icon = 'lorc/cat',
  headStyle,
}) => (
  <RigLayerStack>
    <Animated.View style={[styles.center, headStyle]}>
      <Icon name={icon} size={Math.round(size * 0.78)} color={COLORS.slateCharcoal} />
    </Animated.View>
  </RigLayerStack>
);

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
