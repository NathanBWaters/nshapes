import React from 'react';
import { View } from 'react-native';
import { SvgProps } from 'react-native-svg';

// Static imports for the icons we use in the game
// Add new icons here as needed

// Characters
import Cat from '../../assets/icons/lorc/cat.svg';
import Fox from '../../assets/icons/caro-asercion/fox.svg';
import SittingDog from '../../assets/icons/delapouite/sitting-dog.svg';
import Penguin from '../../assets/icons/delapouite/penguin.svg';
import EatingPelican from '../../assets/icons/delapouite/eating-pelican.svg';
import Badger from '../../assets/icons/caro-asercion/badger.svg';

// Enemies
import JumpingDog from '../../assets/icons/delapouite/jumping-dog.svg';
import Jellyfish from '../../assets/icons/lorc/jellyfish.svg';
import Snake from '../../assets/icons/lorc/snake.svg';
import Mammoth from '../../assets/icons/delapouite/mammoth.svg';
import Rabbit from '../../assets/icons/delapouite/rabbit.svg';

// Weapons
import FlintSpark from '../../assets/icons/delapouite/flint-spark.svg';
import Bamboo from '../../assets/icons/delapouite/bamboo.svg';
import Carrot from '../../assets/icons/delapouite/carrot.svg';
import BirdClaw from '../../assets/icons/lorc/bird-claw.svg';
import StonePile from '../../assets/icons/delapouite/stone-pile.svg';
import ClawSlashes from '../../assets/icons/lorc/claw-slashes.svg';
import Rake from '../../assets/icons/delapouite/rake.svg';

// Items
import Field from '../../assets/icons/lorc/field.svg';
import MirrorMirror from '../../assets/icons/lorc/mirror-mirror.svg';
import LightBulb from '../../assets/icons/lorc/light-bulb.svg';
import Clover from '../../assets/icons/lorc/clover.svg';
import Sunglasses from '../../assets/icons/delapouite/sunglasses.svg';
import Token from '../../assets/icons/delapouite/token.svg';

// Stat Icons
import HeartInside from '../../assets/icons/lorc/heart-inside.svg';
import Cash from '../../assets/icons/lorc/cash.svg';
import FlatStar from '../../assets/icons/lorc/flat-star.svg';
import CrossedSwords from '../../assets/icons/lorc/crossed-swords.svg';
import Gems from '../../assets/icons/lorc/gems.svg';
import Cycle from '../../assets/icons/lorc/cycle.svg';
import CardExchange from '../../assets/icons/delapouite/card-exchange.svg';
import Campfire from '../../assets/icons/lorc/campfire.svg';
import BrightExplosion from '../../assets/icons/lorc/bright-explosion.svg';
import Fist from '../../assets/icons/lorc/fist.svg';
import Hourglass from '../../assets/icons/lorc/hourglass.svg';
import Stopwatch from '../../assets/icons/lorc/stopwatch.svg';
import ShieldBounces from '../../assets/icons/lorc/shield-bounces.svg';
import Recycle from '../../assets/icons/lorc/recycle.svg';
import TimeBomb from '../../assets/icons/lorc/time-bomb.svg';
import ArrowsShield from '../../assets/icons/lorc/arrows-shield.svg';
import Bullseye from '../../assets/icons/skoll/bullseye.svg';
import SandsOfTime from '../../assets/icons/lorc/sands-of-time.svg';

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

  // Stats
  'lorc/heart-inside': HeartInside,
  'lorc/cash': Cash,
  'lorc/flat-star': FlatStar,
  'lorc/crossed-swords': CrossedSwords,
  'lorc/gems': Gems,
  'lorc/cycle': Cycle,
  'delapouite/card-exchange': CardExchange,
  'lorc/campfire': Campfire,
  'lorc/bright-explosion': BrightExplosion,
  'lorc/fist': Fist,
  'lorc/hourglass': Hourglass,
  'lorc/stopwatch': Stopwatch,
  'lorc/shield-bounces': ShieldBounces,
  'lorc/recycle': Recycle,
  'lorc/time-bomb': TimeBomb,
  'lorc/arrows-shield': ArrowsShield,
  'skoll/bullseye': Bullseye,
  'lorc/sands-of-time': SandsOfTime,
};

// Mapping from stat keys to icon paths
export const STAT_ICONS: Record<string, string> = {
  // Health
  health: 'lorc/heart-inside',
  maxHealth: 'lorc/heart-inside',

  // Money & Commerce
  money: 'lorc/cash',
  commerce: 'lorc/cash',

  // Experience & Points
  experience: 'lorc/flat-star',
  experienceGainPercent: 'lorc/flat-star',
  additionalPoints: 'lorc/flat-star',

  // Luck
  luck: 'lorc/clover',

  // Weapons
  maxWeapons: 'lorc/crossed-swords',

  // Scavenging
  scavengingPercent: 'lorc/gems',
  scavengeAmount: 'lorc/gems',

  // Field
  fieldSize: 'lorc/field',

  // Rerolls & Mulligans
  freeRerolls: 'lorc/cycle',
  mulligans: 'lorc/recycle',

  // Card Draw
  drawIncrease: 'delapouite/card-exchange',
  drawIncreasePercent: 'delapouite/card-exchange',

  // Fire & Explosion
  chanceOfFire: 'lorc/campfire',
  explosion: 'lorc/bright-explosion',

  // Damage
  damage: 'lorc/fist',
  damagePercent: 'lorc/fist',

  // Holographic
  holographicPercent: 'lorc/mirror-mirror',

  // Time
  maxTimeIncrease: 'lorc/hourglass',
  timeWarpPercent: 'lorc/hourglass',
  matchIntervalSpeed: 'lorc/stopwatch',
  timeFreezePercent: 'lorc/sands-of-time',
  timeFreezeAmount: 'lorc/sands-of-time',
  bombTimer: 'lorc/time-bomb',

  // Hints
  matchHints: 'lorc/light-bulb',
  matchPossibilityHints: 'lorc/light-bulb',
  matchIntervalHintPercent: 'lorc/light-bulb',
  hints: 'lorc/light-bulb',
  hintPasses: 'lorc/light-bulb',

  // Dodge & Deflect
  dodgePercent: 'lorc/shield-bounces',
  dodgeAttackBackPercent: 'lorc/shield-bounces',
  dodgeAttackBackAmount: 'lorc/shield-bounces',
  deflectPercent: 'lorc/arrows-shield',

  // Critical
  criticalChance: 'skoll/bullseye',
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
