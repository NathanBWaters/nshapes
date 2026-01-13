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
import BarnOwl from '../../assets/icons/caro-asercion/barn-owl.svg';
import Hedgehog from '../../assets/icons/caro-asercion/hedgehog.svg';
import Sloth from '../../assets/icons/caro-asercion/sloth.svg';

// Enemies
import JumpingDog from '../../assets/icons/delapouite/jumping-dog.svg';
import Jellyfish from '../../assets/icons/lorc/jellyfish.svg';
import Snake from '../../assets/icons/lorc/snake.svg';
import Mammoth from '../../assets/icons/delapouite/mammoth.svg';
import Rabbit from '../../assets/icons/delapouite/rabbit.svg';
import Vulture from '../../assets/icons/lorc/vulture.svg';
import Crab from '../../assets/icons/lorc/crab.svg';
import EvilBat from '../../assets/icons/lorc/evil-bat.svg';
import Bee from '../../assets/icons/lorc/bee.svg';
import Frog from '../../assets/icons/lorc/frog.svg';
import Mouse from '../../assets/icons/lorc/mouse.svg';
import Ermine from '../../assets/icons/delapouite/ermine.svg';
import Squirrel from '../../assets/icons/delapouite/squirrel.svg';
import WolfHead from '../../assets/icons/lorc/wolf-head.svg';
import Raven from '../../assets/icons/lorc/raven.svg';
import Swan from '../../assets/icons/lorc/swan.svg';
import Scorpion from '../../assets/icons/lorc/scorpion.svg';
import Mole from '../../assets/icons/caro-asercion/mole.svg';
import RaccoonHead from '../../assets/icons/delapouite/raccoon-head.svg';
import Uncertainty from '../../assets/icons/lorc/uncertainty.svg';
import AngularSpider from '../../assets/icons/lorc/angular-spider.svg';
import MaskedSpider from '../../assets/icons/lorc/masked-spider.svg';
import SpiderFace from '../../assets/icons/carl-olsen/spider-face.svg';
import Turtle from '../../assets/icons/lorc/turtle.svg';
import TurtleShell from '../../assets/icons/lorc/turtle-shell.svg';
import ChameleonGlyph from '../../assets/icons/darkzaitzev/chameleon-glyph.svg';

// Tier 2 Enemies
import Boar from '../../assets/icons/caro-asercion/boar.svg';
import HyenaHead from '../../assets/icons/caro-asercion/hyena-head.svg';
import SharkJaws from '../../assets/icons/lorc/shark-jaws.svg';
import HawkEmblem from '../../assets/icons/lorc/hawk-emblem.svg';
import Cobra from '../../assets/icons/skoll/cobra.svg';
import Direwolf from '../../assets/icons/lorc/direwolf.svg';
import EagleHead from '../../assets/icons/delapouite/eagle-head.svg';
import BoarTusks from '../../assets/icons/lorc/boar-tusks.svg';
import BeastEye from '../../assets/icons/lorc/beast-eye.svg';
import BearFace from '../../assets/icons/sparker/bear-face.svg';
import Beaver from '../../assets/icons/delapouite/beaver.svg';
import WolverineClaws from '../../assets/icons/lorc/wolverine-claws.svg';

// Tier 3 Enemies
import Octopus from '../../assets/icons/lorc/octopus.svg';
import BestialFangs from '../../assets/icons/lorc/bestial-fangs.svg';
import Cyclops from '../../assets/icons/lorc/cyclops.svg';
import GoblinHead from '../../assets/icons/caro-asercion/goblin.svg';
import GolemHead from '../../assets/icons/delapouite/golem-head.svg';
import Imp from '../../assets/icons/lorc/imp.svg';
import Ant from '../../assets/icons/delapouite/ant.svg';
import GiantSquid from '../../assets/icons/delapouite/giant-squid.svg';
import Porcupine from '../../assets/icons/caro-asercion/porcupine.svg';
import Tapir from '../../assets/icons/delapouite/tapir.svg';

// Tier 4 Bosses
import DragonHead from '../../assets/icons/lorc/dragon-head.svg';
import Hydra from '../../assets/icons/lorc/hydra.svg';
import KrakenTentacle from '../../assets/icons/delapouite/kraken-tentacle.svg';
import GrimReaper from '../../assets/icons/lorc/grim-reaper.svg';
import DaemonSkull from '../../assets/icons/lorc/daemon-skull.svg';

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

// Menu Icons
import ArcheryTarget from '../../assets/icons/lorc/archery-target.svg';
import OpenBook from '../../assets/icons/lorc/open-book.svg';
import CrownCoin from '../../assets/icons/lorc/crown-coin.svg';

// Difficulty Icons
import Feather from '../../assets/icons/lorc/feather.svg';
import DiamondHard from '../../assets/icons/lorc/diamond-hard.svg';
import Brain from '../../assets/icons/lorc/brain.svg';

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

// New weapon icons
import SheikahEye from '../../assets/icons/lorc/sheikah-eye.svg';
import FloatingCrystal from '../../assets/icons/lorc/floating-crystal.svg';
import CrystalShine from '../../assets/icons/lorc/crystal-shine.svg';
import LaserWarning from '../../assets/icons/lorc/laser-warning.svg';
import ShiningHeart from '../../assets/icons/lorc/shining-heart.svg';
import ChainedArrowHeads from '../../assets/icons/lorc/chained-arrow-heads.svg';
import EchoRipples from '../../assets/icons/lorc/echo-ripples.svg';
import LightningBranches from '../../assets/icons/lorc/lightning-branches.svg';

// UI Icons
import Padlock from '../../assets/icons/lorc/padlock.svg';
import GearHammer from '../../assets/icons/lorc/gear-hammer.svg';
import SoundOn from '../../assets/icons/delapouite/sound-on.svg';
import ThirdEye from '../../assets/icons/lorc/third-eye.svg';

// Icon registry: maps path (e.g., "delapouite/token") to the imported component
// NOTE: When adding new icons, also add the import above and the path here.
// TypeScript will catch any usage of icon paths not in this registry.
const ICON_REGISTRY = {
  // Characters
  'lorc/cat': Cat,
  'caro-asercion/fox': Fox,
  'delapouite/sitting-dog': SittingDog,
  'delapouite/penguin': Penguin,
  'delapouite/eating-pelican': EatingPelican,
  'caro-asercion/badger': Badger,
  'caro-asercion/barn-owl': BarnOwl,
  'caro-asercion/hedgehog': Hedgehog,
  'caro-asercion/sloth': Sloth,

  // Enemies
  'delapouite/jumping-dog': JumpingDog,
  'lorc/jellyfish': Jellyfish,
  'lorc/snake': Snake,
  'delapouite/mammoth': Mammoth,
  'delapouite/rabbit': Rabbit,
  'lorc/vulture': Vulture,
  'lorc/crab': Crab,
  'lorc/evil-bat': EvilBat,
  'lorc/bee': Bee,
  'lorc/frog': Frog,
  'lorc/mouse': Mouse,
  'delapouite/ermine': Ermine,
  'delapouite/squirrel': Squirrel,
  'lorc/wolf-head': WolfHead,
  'lorc/raven': Raven,
  'lorc/swan': Swan,
  'lorc/scorpion': Scorpion,
  'caro-asercion/mole': Mole,
  'delapouite/raccoon-head': RaccoonHead,
  'lorc/uncertainty': Uncertainty,
  'lorc/angular-spider': AngularSpider,
  'lorc/masked-spider': MaskedSpider,
  'carl-olsen/spider-face': SpiderFace,
  'lorc/turtle': Turtle,
  'lorc/turtle-shell': TurtleShell,
  'darkzaitzev/chameleon-glyph': ChameleonGlyph,

  // Tier 2 Enemies
  'caro-asercion/boar': Boar,
  'caro-asercion/hyena-head': HyenaHead,
  'lorc/shark-jaws': SharkJaws,
  'lorc/hawk-emblem': HawkEmblem,
  'skoll/cobra': Cobra,
  'lorc/direwolf': Direwolf,
  'delapouite/eagle-head': EagleHead,
  'lorc/boar-tusks': BoarTusks,
  'lorc/beast-eye': BeastEye,
  'sparker/bear-face': BearFace,
  'delapouite/beaver': Beaver,
  'lorc/wolverine-claws': WolverineClaws,

  // Tier 3 Enemies
  'lorc/octopus': Octopus,
  'lorc/bestial-fangs': BestialFangs,
  'lorc/cyclops': Cyclops,
  'caro-asercion/goblin': GoblinHead,
  'delapouite/golem-head': GolemHead,
  'lorc/imp': Imp,
  'delapouite/ant': Ant,
  'delapouite/giant-squid': GiantSquid,
  'caro-asercion/porcupine': Porcupine,
  'delapouite/tapir': Tapir,

  // Tier 4 Bosses
  'lorc/dragon-head': DragonHead,
  'lorc/hydra': Hydra,
  'delapouite/kraken-tentacle': KrakenTentacle,
  'lorc/grim-reaper': GrimReaper,
  'lorc/daemon-skull': DaemonSkull,

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

  // Menu
  'lorc/archery-target': ArcheryTarget,
  'lorc/open-book': OpenBook,
  'lorc/crown-coin': CrownCoin,

  // Difficulty
  'lorc/feather': Feather,
  'lorc/diamond-hard': DiamondHard,
  'lorc/brain': Brain,

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

  // New weapon icons
  'lorc/sheikah-eye': SheikahEye,
  'lorc/floating-crystal': FloatingCrystal,
  'lorc/crystal-shine': CrystalShine,
  'lorc/laser-warning': LaserWarning,
  'lorc/shining-heart': ShiningHeart,
  'lorc/chained-arrow-heads': ChainedArrowHeads,
  'lorc/echo-ripples': EchoRipples,
  'lorc/lightning-branches': LightningBranches,

  // UI Icons
  'lorc/padlock': Padlock,
  'lorc/gear-hammer': GearHammer,
  'delapouite/sound-on': SoundOn,
  'lorc/third-eye': ThirdEye,
} as const satisfies Record<string, React.FC<SvgProps>>;

// TypeScript union type of all valid icon names - use this for type-safe icon references
export type IconName = keyof typeof ICON_REGISTRY;

// Mapping from stat keys to icon paths
export const STAT_ICONS: Record<string, IconName> = {
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

  // Economy
  xpGainChance: 'lorc/open-book',
  coinGainChance: 'lorc/crown-coin',

  // Scavenging
  scavengingPercent: 'lorc/gems',
  scavengeAmount: 'lorc/gems',

  // Field
  fieldSize: 'lorc/field',

  // Rerolls & Graces
  freeRerolls: 'lorc/cycle',
  graces: 'lorc/clover',

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

  // New weapon effect stats
  explosionChance: 'lorc/bright-explosion',
  autoHintChance: 'lorc/sheikah-eye',
  autoHintInterval: 'lorc/sheikah-eye',
  boardGrowthChance: 'delapouite/card-exchange',
  boardGrowthAmount: 'delapouite/card-exchange',
  fireSpreadChance: 'lorc/campfire',
  graceGainChance: 'lorc/clover',
  healingChance: 'lorc/shining-heart',
  hintGainChance: 'lorc/light-bulb',
  timeGainChance: 'lorc/stopwatch',
  timeGainAmount: 'lorc/stopwatch',
  laserChance: 'lorc/laser-warning',
  startingTime: 'lorc/hourglass',
  ricochetChance: 'lorc/chained-arrow-heads',
  ricochetChainChance: 'lorc/chained-arrow-heads',
};

interface IconProps {
  /** Icon path like "delapouite/token" or "lorc/cat" */
  name: IconName;
  /** Icon size in pixels (default: 24) */
  size?: number;
  /** Icon fill color (default: Logic Teal #16AA98) */
  color?: string;
  /** Additional styles for the container */
  style?: object;
  /** Hide the drop shadow (default: false) */
  noShadow?: boolean;
}

const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = '#FFFFFF',
  style,
  noShadow = false,
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
      {/* Shadow layer - slightly offset dark version */}
      {!noShadow && (
        <View style={{ position: 'absolute', top: 1, left: 1, opacity: 0.5 }}>
          <SvgComponent
            width={size}
            height={size}
            fill="#000000"
            color="#000000"
          />
        </View>
      )}
      {/* Main icon */}
      <SvgComponent
        width={size}
        height={size}
        fill={color}
        color={color}
      />
    </View>
  );
};

export default Icon;

// Export the registry for reference
export { ICON_REGISTRY };
