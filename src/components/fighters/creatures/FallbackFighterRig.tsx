import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Icon, { IconName } from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import { CHARACTERS } from '@/utils/gameDefinitions';
import { CreatureRigProps } from './types';

interface FallbackFighterRigProps extends CreatureRigProps {
  characterName?: string | null;
  iconOverride?: IconName;
}

/**
 * Clean fallback rig for any future or custom character name not yet given a bespoke rig.
 * Renders its registered SVG icon inside the animated head/body transform container
 * so all physics, progressive damage bandages, and celebration FX still work seamlessly.
 */
export const FallbackFighterRig: React.FC<FallbackFighterRigProps> = ({
  size,
  characterName,
  iconOverride,
  headStyle,
}) => {
  const matched = CHARACTERS.find((c) => c.name === characterName);
  const iconName: IconName = iconOverride ?? matched?.icon ?? 'lorc/cat';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.center, headStyle]}>
        <Icon name={iconName} size={Math.round(size * 0.78)} color={COLORS.slateCharcoal} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
