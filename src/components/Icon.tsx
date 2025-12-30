import React from 'react';
import { View } from 'react-native';
import { SvgProps } from 'react-native-svg';

// Static imports for the icons we use in the game
// Add new icons here as needed
import Cat from '../../assets/icons/lorc/cat.svg';
import Fox from '../../assets/icons/caro-asercion/fox.svg';
import SittingDog from '../../assets/icons/delapouite/sitting-dog.svg';
import Penguin from '../../assets/icons/delapouite/penguin.svg';
import EatingPelican from '../../assets/icons/delapouite/eating-pelican.svg';
import Badger from '../../assets/icons/caro-asercion/badger.svg';

import JumpingDog from '../../assets/icons/delapouite/jumping-dog.svg';
import Jellyfish from '../../assets/icons/lorc/jellyfish.svg';
import Snake from '../../assets/icons/lorc/snake.svg';
import Mammoth from '../../assets/icons/delapouite/mammoth.svg';
import Rabbit from '../../assets/icons/delapouite/rabbit.svg';

import FlintSpark from '../../assets/icons/delapouite/flint-spark.svg';
import Bamboo from '../../assets/icons/delapouite/bamboo.svg';
import Carrot from '../../assets/icons/delapouite/carrot.svg';
import BirdClaw from '../../assets/icons/lorc/bird-claw.svg';
import StonePile from '../../assets/icons/delapouite/stone-pile.svg';
import ClawSlashes from '../../assets/icons/lorc/claw-slashes.svg';
import Rake from '../../assets/icons/delapouite/rake.svg';

import Field from '../../assets/icons/lorc/field.svg';
import MirrorMirror from '../../assets/icons/lorc/mirror-mirror.svg';
import LightBulb from '../../assets/icons/lorc/light-bulb.svg';
import Clover from '../../assets/icons/lorc/clover.svg';
import Sunglasses from '../../assets/icons/delapouite/sunglasses.svg';
import Token from '../../assets/icons/delapouite/token.svg';

// Icon registry: maps path (e.g., "delapouite/token") to the imported component
const ICON_REGISTRY: Record<string, React.FC<SvgProps>> = {
  // Characters
  'lorc/cat': Cat,
  'caro-asercion/fox': Fox,
  'delapouite/sitting-dog': SittingDog,
  'delapouite/penguin': Penguin,
  'delapouite/eating-pelican': EatingPelican,
  'caro-asercion/badger': Badger,

  // Enemies
  'delapouite/jumping-dog': JumpingDog,
  'lorc/jellyfish': Jellyfish,
  'lorc/snake': Snake,
  'delapouite/mammoth': Mammoth,
  'delapouite/rabbit': Rabbit,

  // Weapons
  'delapouite/flint-spark': FlintSpark,
  'delapouite/bamboo': Bamboo,
  'delapouite/carrot': Carrot,
  'lorc/bird-claw': BirdClaw,
  'delapouite/stone-pile': StonePile,
  'lorc/claw-slashes': ClawSlashes,
  'delapouite/rake': Rake,

  // Items
  'lorc/field': Field,
  'lorc/mirror-mirror': MirrorMirror,
  'lorc/light-bulb': LightBulb,
  'lorc/clover': Clover,
  'delapouite/sunglasses': Sunglasses,
  'delapouite/token': Token,
};

interface IconProps {
  /** Icon path like "delapouite/token" or "lorc/cat" */
  name: string;
  /** Icon size in pixels (default: 24) */
  size?: number;
  /** Icon fill color (default: white) */
  color?: string;
  /** Additional styles for the container */
  style?: object;
}

const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = '#FFFFFF',
  style,
}) => {
  const SvgComponent = ICON_REGISTRY[name];

  if (!SvgComponent) {
    console.warn(`Icon not found in registry: ${name}`);
    return (
      <View style={[{ width: size, height: size }, style]} />
    );
  }

  return (
    <View style={[{ width: size, height: size }, style]}>
      <SvgComponent
        width={size}
        height={size}
        fill={color}
      />
    </View>
  );
};

export default Icon;

// Export the registry for reference
export { ICON_REGISTRY };
