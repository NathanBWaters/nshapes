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
import BarnOwl from '../../assets/icons/caro-asercion/barn-owl.svg';
import Hedgehog from '../../assets/icons/caro-asercion/hedgehog.svg';
import Sloth from '../../assets/icons/caro-asercion/sloth.svg';

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

import Bamboo from '../../assets/icons/delapouite/bamboo.svg';
import StonePile from '../../assets/icons/delapouite/stone-pile.svg';
import ClawSlashes from '../../assets/icons/lorc/claw-slashes.svg';

import Field from '../../assets/icons/lorc/field.svg';
import MirrorMirror from '../../assets/icons/lorc/mirror-mirror.svg';
import LightBulb from '../../assets/icons/lorc/light-bulb.svg';
import Clover from '../../assets/icons/lorc/clover.svg';
import Snowflake1 from '../../assets/icons/lorc/snowflake-1.svg';
import Token from '../../assets/icons/delapouite/token.svg';

import ArcheryTarget from '../../assets/icons/lorc/archery-target.svg';
import TargetDummy from '../../assets/icons/lorc/target-dummy.svg';
import OpenBook from '../../assets/icons/lorc/open-book.svg';
import CrownCoin from '../../assets/icons/lorc/crown-coin.svg';
import ReturnArrow from '../../assets/icons/lorc/return-arrow.svg';

import Feather from '../../assets/icons/lorc/feather.svg';
import DiamondHard from '../../assets/icons/lorc/diamond-hard.svg';
import Brain from '../../assets/icons/lorc/brain.svg';

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
import Recycle from '../../assets/icons/lorc/recycle.svg';
import TimeBomb from '../../assets/icons/lorc/time-bomb.svg';
import Bullseye from '../../assets/icons/skoll/bullseye.svg';

import SheikahEye from '../../assets/icons/lorc/sheikah-eye.svg';
import FloatingCrystal from '../../assets/icons/lorc/floating-crystal.svg';
import CrystalShine from '../../assets/icons/lorc/crystal-shine.svg';
import LaserWarning from '../../assets/icons/lorc/laser-warning.svg';
import ShiningHeart from '../../assets/icons/lorc/shining-heart.svg';
import ChainedArrowHeads from '../../assets/icons/lorc/chained-arrow-heads.svg';
import EchoRipples from '../../assets/icons/lorc/echo-ripples.svg';
import LightningBranches from '../../assets/icons/lorc/lightning-branches.svg';

import LightningHelix from '../../assets/icons/lorc/lightning-helix.svg';
import TimeTrap from '../../assets/icons/lorc/time-trap.svg';
import DeathNote from '../../assets/icons/lorc/death-note.svg';
import FireRing from '../../assets/icons/lorc/fire-ring.svg';
import Bookmarklet from '../../assets/icons/lorc/bookmarklet.svg';
import AngelOutfit from '../../assets/icons/lorc/angel-outfit.svg';
import CrystalWand from '../../assets/icons/lorc/crystal-wand.svg';
import BrokenHeart from '../../assets/icons/lorc/broken-heart.svg';

import Fireball from '../../assets/icons/lorc/fireball.svg';
import HeartBottle from '../../assets/icons/lorc/heart-bottle.svg';
import CoinsPile from '../../assets/icons/delapouite/coins-pile.svg';
import LaserBlast from '../../assets/icons/lorc/laser-blast.svg';
import StoneBlock from '../../assets/icons/lorc/stone-block.svg';
import BigWave from '../../assets/icons/lorc/big-wave.svg';
import CrystalBall from '../../assets/icons/lorc/crystal-ball.svg';
import Flowers from '../../assets/icons/lorc/flowers.svg';
import CrackedBallDunk from '../../assets/icons/lorc/cracked-ball-dunk.svg';

import Padlock from '../../assets/icons/lorc/padlock.svg';
import GearHammer from '../../assets/icons/lorc/gear-hammer.svg';
import SoundOn from '../../assets/icons/delapouite/sound-on.svg';
import ThirdEye from '../../assets/icons/lorc/third-eye.svg';
import DiscordSymbol from '../../assets/icons/discord-symbol.svg';

import SwordClash from '../../assets/icons/lorc/sword-clash.svg';
import CheckedShield from '../../assets/icons/lorc/checked-shield.svg';
import CrossMark from '../../assets/icons/lorc/cross-mark.svg';
import Trophy from '../../assets/icons/lorc/trophy.svg';

import RainbowStar from '../../assets/icons/lorc/rainbow-star.svg';
import RadarSweep from '../../assets/icons/lorc/radar-sweep.svg';
import SkullCrack from '../../assets/icons/lorc/skull-crack.svg';

import ChainedHeart from '../../assets/icons/lorc/chained-heart.svg';
import BrokenHeartZone from '../../assets/icons/lorc/broken-heart-zone.svg';
import Cobweb from '../../assets/icons/lorc/cobweb.svg';
import LinkedRings from '../../assets/icons/lorc/linked-rings.svg';
import Brainstorm from '../../assets/icons/lorc/brainstorm.svg';
import TreeBranch from '../../assets/icons/lorc/tree-branch.svg';
import PlainArrow from '../../assets/icons/delapouite/plain-arrow.svg';
import Pinata from '../../assets/icons/delapouite/pinata.svg';
import WolfTrap from '../../assets/icons/lorc/wolf-trap.svg';
import Drum from '../../assets/icons/delapouite/drum.svg';
import HuntingHorn from '../../assets/icons/lorc/hunting-horn.svg';
import TeslaCoil from '../../assets/icons/lorc/tesla-coil.svg';
import Prism from '../../assets/icons/delapouite/prism.svg';
import MagnifyingGlass from '../../assets/icons/lorc/magnifying-glass.svg';
import BeltBuckles from '../../assets/icons/lorc/belt-buckles.svg';
import TarotWheelOfFortune from '../../assets/icons/caro-asercion/tarot-10-wheel-of-fortune.svg';
import FizzingFlask from '../../assets/icons/lorc/fizzing-flask.svg';
import Mountaintop from '../../assets/icons/lorc/mountaintop.svg';
import FallingStar from '../../assets/icons/delapouite/falling-star.svg';
import CometSpark from '../../assets/icons/lorc/comet-spark.svg';
// Evolution icons (data/evolutionPairs.ts)
import EvoScythe from '../../assets/icons/lorc/scythe.svg';
import EvoFireGem from '../../assets/icons/delapouite/fire-gem.svg';
import EvoAngryEyes from '../../assets/icons/delapouite/angry-eyes.svg';
import EvoBackwardTime from '../../assets/icons/delapouite/backward-time.svg';
import EvoBarrel from '../../assets/icons/delapouite/barrel.svg';
import EvoBeamSatellite from '../../assets/icons/delapouite/beam-satellite.svg';
import EvoBirdCage from '../../assets/icons/delapouite/bird-cage.svg';
import EvoBookPile from '../../assets/icons/delapouite/book-pile.svg';
import EvoBoomerang from '../../assets/icons/delapouite/boomerang.svg';
import EvoBroom from '../../assets/icons/delapouite/broom.svg';
import EvoBurningForest from '../../assets/icons/delapouite/burning-forest.svg';
import EvoChurch from '../../assets/icons/delapouite/church.svg';
import EvoDynamite from '../../assets/icons/delapouite/dynamite.svg';
import EvoEyeTarget from '../../assets/icons/delapouite/eye-target.svg';
import EvoFlagObjective from '../../assets/icons/delapouite/flag-objective.svg';
import EvoFlowerEmblem from '../../assets/icons/delapouite/flower-emblem.svg';
import EvoGalaxy from '../../assets/icons/delapouite/galaxy.svg';
import EvoGraduateCap from '../../assets/icons/delapouite/graduate-cap.svg';
import EvoHarp from '../../assets/icons/delapouite/harp.svg';
import EvoIdea from '../../assets/icons/delapouite/idea.svg';
import EvoLighthouse from '../../assets/icons/delapouite/lighthouse.svg';
import EvoLockedBox from '../../assets/icons/delapouite/locked-box.svg';
import EvoMetronome from '../../assets/icons/delapouite/metronome.svg';
import EvoMoonBats from '../../assets/icons/delapouite/moon-bats.svg';
import EvoMoonOrbit from '../../assets/icons/delapouite/moon-orbit.svg';
import EvoMountainCave from '../../assets/icons/delapouite/mountain-cave.svg';
import EvoRollingDices from '../../assets/icons/delapouite/rolling-dices.svg';
import EvoRopeCoil from '../../assets/icons/delapouite/rope-coil.svg';
import EvoScrollQuill from '../../assets/icons/delapouite/scroll-quill.svg';
import EvoSparkles from '../../assets/icons/delapouite/sparkles.svg';
import EvoStack from '../../assets/icons/delapouite/stack.svg';
import EvoStarFormation from '../../assets/icons/delapouite/star-formation.svg';
import EvoStoneWall from '../../assets/icons/delapouite/stone-wall.svg';
import EvoSunflower from '../../assets/icons/delapouite/sunflower.svg';
import EvoTempleGate from '../../assets/icons/delapouite/temple-gate.svg';
import EvoTimeSynchronization from '../../assets/icons/delapouite/time-synchronization.svg';
import EvoTorch from '../../assets/icons/delapouite/torch.svg';
import EvoTrumpetFlag from '../../assets/icons/delapouite/trumpet-flag.svg';
import EvoTwoCoins from '../../assets/icons/delapouite/two-coins.svg';
import EvoWell from '../../assets/icons/delapouite/well.svg';
import EvoYinYang from '../../assets/icons/delapouite/yin-yang.svg';
import EvoAnvil from '../../assets/icons/lorc/anvil.svg';
import EvoBeamWake from '../../assets/icons/lorc/beam-wake.svg';
import EvoBleedingHeart from '../../assets/icons/lorc/bleeding-heart.svg';
import EvoBodySwapping from '../../assets/icons/lorc/body-swapping.svg';
import EvoBombingRun from '../../assets/icons/lorc/bombing-run.svg';
import EvoBookCover from '../../assets/icons/lorc/book-cover.svg';
import EvoBouncingSword from '../../assets/icons/lorc/bouncing-sword.svg';
import EvoBrokenShield from '../../assets/icons/lorc/broken-shield.svg';
import EvoBurningBook from '../../assets/icons/lorc/burning-book.svg';
import EvoBurningEye from '../../assets/icons/lorc/burning-eye.svg';
import EvoBurningPassion from '../../assets/icons/lorc/burning-passion.svg';
import EvoCandleFlame from '../../assets/icons/lorc/candle-flame.svg';
import EvoCircuitry from '../../assets/icons/lorc/circuitry.svg';
import EvoClockwork from '../../assets/icons/lorc/clockwork.svg';
import EvoCompass from '../../assets/icons/lorc/compass.svg';
import EvoCrown from '../../assets/icons/lorc/crown.svg';
import EvoCrystalBars from '../../assets/icons/lorc/crystal-bars.svg';
import EvoCrystalGrowth from '../../assets/icons/lorc/crystal-growth.svg';
import EvoDominoMask from '../../assets/icons/lorc/domino-mask.svg';
import EvoDramaMasks from '../../assets/icons/lorc/drama-masks.svg';
import EvoEmptyHourglass from '../../assets/icons/lorc/empty-hourglass.svg';
import EvoEvilBook from '../../assets/icons/lorc/evil-book.svg';
import EvoEyeShield from '../../assets/icons/lorc/eye-shield.svg';
import EvoEyeball from '../../assets/icons/lorc/eyeball.svg';
import EvoFireShield from '../../assets/icons/lorc/fire-shield.svg';
import EvoFlameSpin from '../../assets/icons/lorc/flame-spin.svg';
import EvoFlameTunnel from '../../assets/icons/lorc/flame-tunnel.svg';
import EvoFlowerPot from '../../assets/icons/lorc/flower-pot.svg';
import EvoFlowerTwirl from '../../assets/icons/lorc/flower-twirl.svg';
import EvoFrozenOrb from '../../assets/icons/lorc/frozen-orb.svg';
import EvoGemChain from '../../assets/icons/lorc/gem-chain.svg';
import EvoGemPendant from '../../assets/icons/lorc/gem-pendant.svg';
import EvoGhost from '../../assets/icons/lorc/ghost.svg';
import EvoGlassHeart from '../../assets/icons/lorc/glass-heart.svg';
import EvoGoldScarab from '../../assets/icons/lorc/gold-scarab.svg';
import EvoGuillotine from '../../assets/icons/lorc/guillotine.svg';
import EvoHeartOrgan from '../../assets/icons/lorc/heart-organ.svg';
import EvoLaserPrecision from '../../assets/icons/lorc/laser-precision.svg';
import EvoLightningArc from '../../assets/icons/lorc/lightning-arc.svg';
import EvoLockedChest from '../../assets/icons/lorc/locked-chest.svg';
import EvoMagicPortal from '../../assets/icons/lorc/magic-portal.svg';
import EvoMeditation from '../../assets/icons/lorc/meditation.svg';
import EvoMolecule from '../../assets/icons/lorc/molecule.svg';
import EvoMoon from '../../assets/icons/lorc/moon.svg';
import EvoOak from '../../assets/icons/lorc/oak.svg';
import EvoPokerHand from '../../assets/icons/lorc/poker-hand.svg';
import EvoPowerLightning from '../../assets/icons/lorc/power-lightning.svg';
import EvoProcessor from '../../assets/icons/lorc/processor.svg';
import EvoPsychicWaves from '../../assets/icons/lorc/psychic-waves.svg';
import EvoResonance from '../../assets/icons/lorc/resonance.svg';
import EvoSandsOfTime from '../../assets/icons/lorc/sands-of-time.svg';
import EvoSatellite from '../../assets/icons/lorc/satellite.svg';
import EvoScrollUnfurled from '../../assets/icons/lorc/scroll-unfurled.svg';
import EvoSewingNeedle from '../../assets/icons/lorc/sewing-needle.svg';
import EvoShatteredGlass from '../../assets/icons/lorc/shattered-glass.svg';
import EvoShieldReflect from '../../assets/icons/lorc/shield-reflect.svg';
import EvoShouting from '../../assets/icons/lorc/shouting.svg';
import EvoSmokingOrb from '../../assets/icons/lorc/smoking-orb.svg';
import EvoSonicBoom from '../../assets/icons/lorc/sonic-boom.svg';
import EvoSonicShout from '../../assets/icons/lorc/sonic-shout.svg';
import EvoSparkSpirit from '../../assets/icons/lorc/spark-spirit.svg';
import EvoSparkyBomb from '../../assets/icons/lorc/sparky-bomb.svg';
import EvoSpectacleLenses from '../../assets/icons/lorc/spectacle-lenses.svg';
import EvoSpiderWeb from '../../assets/icons/lorc/spider-web.svg';
import EvoSpikedHalo from '../../assets/icons/lorc/spiked-halo.svg';
import EvoSpiralArrow from '../../assets/icons/lorc/spiral-arrow.svg';
import EvoSprout from '../../assets/icons/lorc/sprout.svg';
import EvoStarSwirl from '../../assets/icons/lorc/star-swirl.svg';
import EvoStoneSphere from '../../assets/icons/lorc/stone-sphere.svg';
import EvoStoneTablet from '../../assets/icons/lorc/stone-tablet.svg';
import EvoSun from '../../assets/icons/lorc/sun.svg';
import EvoSunrise from '../../assets/icons/lorc/sunrise.svg';
import EvoSwapBag from '../../assets/icons/lorc/swap-bag.svg';
import EvoThunderStruck from '../../assets/icons/lorc/thunder-struck.svg';
import EvoTreasureMap from '../../assets/icons/lorc/treasure-map.svg';
import EvoVineFlower from '../../assets/icons/lorc/vine-flower.svg';
import EvoVineLeaf from '../../assets/icons/lorc/vine-leaf.svg';
import EvoVortex from '../../assets/icons/lorc/vortex.svg';
import EvoCloverSpiked from '../../assets/icons/sbed/clover-spiked.svg';
import EvoElectric from '../../assets/icons/sbed/electric.svg';
import EvoWaterDrop from '../../assets/icons/sbed/water-drop.svg';
import EvoBurningSkull from '../../assets/icons/skoll/burning-skull.svg';
import EvoHearts from '../../assets/icons/skoll/hearts.svg';
import EvoLaserBurst from '../../assets/icons/skoll/laser-burst.svg';
import EvoPentacle from '../../assets/icons/skoll/pentacle.svg';
import EvoSoundWaves from '../../assets/icons/skoll/sound-waves.svg';
import EvoInfinity from '../../assets/icons/various-artists/infinity.svg';
import EvoGoldBar from '../../assets/icons/willdabeast/gold-bar.svg';
// Trick weapons (data/adventureWeapons.ts) and their card markers
import TrickMagnet from '../../assets/icons/lorc/magnet.svg';
import TrickWanted from '../../assets/icons/delapouite/wanted-reward.svg';
import TrickPuzzle from '../../assets/icons/delapouite/puzzle.svg';
import TrickDevilMask from '../../assets/icons/delapouite/devil-mask.svg';
import TrickSnowman from '../../assets/icons/lorc/snowman.svg';
import TrickPostStamp from '../../assets/icons/delapouite/post-stamp.svg';
import TrickJoker from '../../assets/icons/delapouite/card-joker.svg';
import TrickGemini from '../../assets/icons/delapouite/gemini.svg';
import TrickShardSword from '../../assets/icons/lorc/shard-sword.svg';
import TrickLanternFlame from '../../assets/icons/lorc/lantern-flame.svg';
import TrickTwoShadows from '../../assets/icons/lorc/two-shadows.svg';
import TrickCurtains from '../../assets/icons/delapouite/theater-curtains.svg';
import TrickFog from '../../assets/icons/delapouite/fog.svg';
// Evolution recipes of the trick weapons (data/evolutionPairs.ts)
import Evo2LodestoneBomb from '../../assets/icons/lorc/magnet-blast.svg';
import Evo2DeadOrAlive from '../../assets/icons/delapouite/cowboy-holster.svg';
import Evo2HallOfMirrors from '../../assets/icons/lorc/portal.svg';
import Evo2SpotTheDifference from '../../assets/icons/lorc/spectacles.svg';
import Evo2FaustianHeart from '../../assets/icons/zeromancer/heart-minus.svg';
import Evo2Avalanche from '../../assets/icons/lorc/snowing.svg';
import Evo2Scrapbook from '../../assets/icons/delapouite/notebook.svg';
import Evo2JokersRainbow from '../../assets/icons/delapouite/jester-hat.svg';
import Evo2BurningTwins from '../../assets/icons/lorc/twin-shell.svg';
import Evo2TemperedGlass from '../../assets/icons/lorc/anvil-impact.svg';
import Evo2LighthouseFog from '../../assets/icons/delapouite/fog-light.svg';
import Evo2DressRehearsal from '../../assets/icons/delapouite/theater.svg';
import Evo2SecondAct from '../../assets/icons/delapouite/ticket.svg';
import Evo2EvilEye from '../../assets/icons/skoll/evil-eyes.svg';
import Evo2ShackleLine from '../../assets/icons/lorc/manacles.svg';
import Evo2RoseGarden from '../../assets/icons/lorc/rose.svg';
import Evo2Patina from '../../assets/icons/delapouite/amphora.svg';
import Evo2Mangrove from '../../assets/icons/delapouite/swamp.svg';
import Evo2PrivateEye from '../../assets/icons/lorc/fedora.svg';
import Evo2Countdown from '../../assets/icons/delapouite/alarm-clock.svg';
import Evo2GlacierClock from '../../assets/icons/delapouite/iceberg.svg';
import Evo2TreasureHunt from '../../assets/icons/skoll/open-treasure-chest.svg';
import Evo2HighWire from '../../assets/icons/darkzaitzev/acrobatic.svg';
import Evo2HotShrapnel from '../../assets/icons/delapouite/fried-eggs.svg';
import Evo2CompassWalk from '../../assets/icons/delapouite/direction-signs.svg';
import Evo2GoldDetector from '../../assets/icons/delapouite/metal-detector.svg';
import Evo2WitchHunt from '../../assets/icons/delapouite/pitchfork.svg';
import Evo2MostWanted from '../../assets/icons/delapouite/prisoner.svg';
import Evo2Reflection from '../../assets/icons/lorc/water-splash.svg';
import Evo2LookingGlass from '../../assets/icons/delapouite/door.svg';
import Evo2StickerSwap from '../../assets/icons/delapouite/stamper.svg';
import Evo2SnowAngel from '../../assets/icons/lorc/angel-wings.svg';
import Evo2BloodRoses from '../../assets/icons/lorc/crown-of-thorns.svg';
import Evo2PlayingWithFire from '../../assets/icons/delapouite/matchbox.svg';
import Evo2DeepWinter from '../../assets/icons/lorc/pine-tree.svg';
import Evo2TradingCards from '../../assets/icons/quoting/card-pickup.svg';
import Evo2BodyDouble from '../../assets/icons/lorc/backup.svg';
import Evo2Doppelganger from '../../assets/icons/lorc/double-face-mask.svg';
import Evo2KnifeEdge from '../../assets/icons/lorc/bowie-knife.svg';
import Evo2SmokeBomb from '../../assets/icons/darkzaitzev/smoke-bomb.svg';
import Evo2Whiteout from '../../assets/icons/lorc/fluffy-cloud.svg';
import Evo2StandingOvation from '../../assets/icons/delapouite/hand-ok.svg';
import Evo2CurtainOfGold from '../../assets/icons/delapouite/gold-stack.svg';
import Evo2AncientRelic from '../../assets/icons/lorc/tribal-mask.svg';
import Evo2Quicksand from '../../assets/icons/lorc/quicksand.svg';
import Evo2BallAndChain from '../../assets/icons/delapouite/flail.svg';
import Evo2BramblePatch from '../../assets/icons/lorc/thorny-tentacle.svg';
import Evo2OldPowder from '../../assets/icons/lorc/powder.svg';
import TrickCursedStar from '../../assets/icons/lorc/cursed-star.svg';
import TrickTotemHead from '../../assets/icons/lorc/totem-head.svg';
import TrickCrossedChains from '../../assets/icons/lorc/crossed-chains.svg';
import TrickThornyVine from '../../assets/icons/lorc/thorny-vine.svg';
import TrickRustySword from '../../assets/icons/delapouite/rusty-sword.svg';
import TrickStickyBoot from '../../assets/icons/delapouite/sticky-boot.svg';
import TrickPlasticDuck from '../../assets/icons/delapouite/plastic-duck.svg';
import TrickTimeDynamite from '../../assets/icons/delapouite/time-dynamite.svg';
import TrickFrozenBlock from '../../assets/icons/lorc/frozen-block.svg';
import TrickIceCube from '../../assets/icons/lorc/ice-cube.svg';
import TrickMimicChest from '../../assets/icons/delapouite/mimic-chest.svg';
import TrickTightrope from '../../assets/icons/delapouite/tightrope.svg';
import TrickPotato from '../../assets/icons/delapouite/potato.svg';

// Icon registry: maps path (e.g., "delapouite/token") to the imported component
// NOTE: When adding new icons, also add the import above and the path here.
// TypeScript will catch any usage of icon paths not in this registry.
const ICON_REGISTRY = {
  'lorc/cat': Cat,
  'caro-asercion/fox': Fox,
  'delapouite/sitting-dog': SittingDog,
  'delapouite/penguin': Penguin,
  'delapouite/eating-pelican': EatingPelican,
  'caro-asercion/badger': Badger,
  'caro-asercion/barn-owl': BarnOwl,
  'caro-asercion/hedgehog': Hedgehog,
  'caro-asercion/sloth': Sloth,

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

  'delapouite/bamboo': Bamboo,
  'delapouite/stone-pile': StonePile,
  'lorc/claw-slashes': ClawSlashes,

  'lorc/field': Field,
  'lorc/mirror-mirror': MirrorMirror,
  'lorc/light-bulb': LightBulb,
  'lorc/clover': Clover,
  'lorc/snowflake-1': Snowflake1,
  'delapouite/token': Token,

  'lorc/archery-target': ArcheryTarget,
  'lorc/target-dummy': TargetDummy,
  'lorc/open-book': OpenBook,
  'lorc/crown-coin': CrownCoin,
  'lorc/return-arrow': ReturnArrow,

  'lorc/feather': Feather,
  'lorc/diamond-hard': DiamondHard,
  'lorc/brain': Brain,

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
  'lorc/recycle': Recycle,
  'lorc/time-bomb': TimeBomb,
  'skoll/bullseye': Bullseye,

  'lorc/sheikah-eye': SheikahEye,
  'lorc/floating-crystal': FloatingCrystal,
  'lorc/crystal-shine': CrystalShine,
  'lorc/laser-warning': LaserWarning,
  'lorc/shining-heart': ShiningHeart,
  'lorc/chained-arrow-heads': ChainedArrowHeads,
  'lorc/echo-ripples': EchoRipples,
  'lorc/lightning-branches': LightningBranches,

  'lorc/lightning-helix': LightningHelix,
  'lorc/time-trap': TimeTrap,
  'lorc/death-note': DeathNote,
  'lorc/fire-ring': FireRing,
  'lorc/bookmarklet': Bookmarklet,
  'lorc/angel-outfit': AngelOutfit,
  'lorc/crystal-wand': CrystalWand,
  'lorc/broken-heart': BrokenHeart,

  'lorc/fireball': Fireball,
  'lorc/heart-bottle': HeartBottle,
  'delapouite/coins-pile': CoinsPile,
  'lorc/laser-blast': LaserBlast,
  'lorc/stone-block': StoneBlock,
  'lorc/big-wave': BigWave,
  'lorc/crystal-ball': CrystalBall,
  'lorc/flowers': Flowers,
  'lorc/cracked-ball-dunk': CrackedBallDunk,

  'lorc/padlock': Padlock,
  'lorc/gear-hammer': GearHammer,
  'delapouite/sound-on': SoundOn,
  'lorc/third-eye': ThirdEye,
  'discord-symbol': DiscordSymbol,

  'lorc/sword-clash': SwordClash,
  'lorc/checked-shield': CheckedShield,
  'lorc/cross-mark': CrossMark,
  'lorc/trophy': Trophy,

  'lorc/rainbow-star': RainbowStar,
  'lorc/radar-sweep': RadarSweep,
  'lorc/skull-crack': SkullCrack,

  'lorc/chained-heart': ChainedHeart,
  'lorc/broken-heart-zone': BrokenHeartZone,
  'lorc/cobweb': Cobweb,
  'lorc/linked-rings': LinkedRings,
  'lorc/brainstorm': Brainstorm,
  'lorc/tree-branch': TreeBranch,
  'delapouite/plain-arrow': PlainArrow,
  'delapouite/pinata': Pinata,
  'lorc/wolf-trap': WolfTrap,
  'delapouite/drum': Drum,
  'lorc/hunting-horn': HuntingHorn,
  'lorc/tesla-coil': TeslaCoil,
  'delapouite/prism': Prism,
  'lorc/magnifying-glass': MagnifyingGlass,
  'lorc/belt-buckles': BeltBuckles,
  'caro-asercion/tarot-10-wheel-of-fortune': TarotWheelOfFortune,
  'lorc/fizzing-flask': FizzingFlask,
  'lorc/mountaintop': Mountaintop,
  'delapouite/falling-star': FallingStar,
  'lorc/comet-spark': CometSpark,
  // Evolutions
  'lorc/scythe': EvoScythe,
  'delapouite/fire-gem': EvoFireGem,
  'delapouite/angry-eyes': EvoAngryEyes,
  'delapouite/backward-time': EvoBackwardTime,
  'delapouite/barrel': EvoBarrel,
  'delapouite/beam-satellite': EvoBeamSatellite,
  'delapouite/bird-cage': EvoBirdCage,
  'delapouite/book-pile': EvoBookPile,
  'delapouite/boomerang': EvoBoomerang,
  'delapouite/broom': EvoBroom,
  'delapouite/burning-forest': EvoBurningForest,
  'delapouite/church': EvoChurch,
  'delapouite/dynamite': EvoDynamite,
  'delapouite/eye-target': EvoEyeTarget,
  'delapouite/flag-objective': EvoFlagObjective,
  'delapouite/flower-emblem': EvoFlowerEmblem,
  'delapouite/galaxy': EvoGalaxy,
  'delapouite/graduate-cap': EvoGraduateCap,
  'delapouite/harp': EvoHarp,
  'delapouite/idea': EvoIdea,
  'delapouite/lighthouse': EvoLighthouse,
  'delapouite/locked-box': EvoLockedBox,
  'delapouite/metronome': EvoMetronome,
  'delapouite/moon-bats': EvoMoonBats,
  'delapouite/moon-orbit': EvoMoonOrbit,
  'delapouite/mountain-cave': EvoMountainCave,
  'delapouite/rolling-dices': EvoRollingDices,
  'delapouite/rope-coil': EvoRopeCoil,
  'delapouite/scroll-quill': EvoScrollQuill,
  'delapouite/sparkles': EvoSparkles,
  'delapouite/stack': EvoStack,
  'delapouite/star-formation': EvoStarFormation,
  'delapouite/stone-wall': EvoStoneWall,
  'delapouite/sunflower': EvoSunflower,
  'delapouite/temple-gate': EvoTempleGate,
  'delapouite/time-synchronization': EvoTimeSynchronization,
  'delapouite/torch': EvoTorch,
  'delapouite/trumpet-flag': EvoTrumpetFlag,
  'delapouite/two-coins': EvoTwoCoins,
  'delapouite/well': EvoWell,
  'delapouite/yin-yang': EvoYinYang,
  'lorc/anvil': EvoAnvil,
  'lorc/beam-wake': EvoBeamWake,
  'lorc/bleeding-heart': EvoBleedingHeart,
  'lorc/body-swapping': EvoBodySwapping,
  'lorc/bombing-run': EvoBombingRun,
  'lorc/book-cover': EvoBookCover,
  'lorc/bouncing-sword': EvoBouncingSword,
  'lorc/broken-shield': EvoBrokenShield,
  'lorc/burning-book': EvoBurningBook,
  'lorc/burning-eye': EvoBurningEye,
  'lorc/burning-passion': EvoBurningPassion,
  'lorc/candle-flame': EvoCandleFlame,
  'lorc/circuitry': EvoCircuitry,
  'lorc/clockwork': EvoClockwork,
  'lorc/compass': EvoCompass,
  'lorc/crown': EvoCrown,
  'lorc/crystal-bars': EvoCrystalBars,
  'lorc/crystal-growth': EvoCrystalGrowth,
  'lorc/domino-mask': EvoDominoMask,
  'lorc/drama-masks': EvoDramaMasks,
  'lorc/empty-hourglass': EvoEmptyHourglass,
  'lorc/evil-book': EvoEvilBook,
  'lorc/eye-shield': EvoEyeShield,
  'lorc/eyeball': EvoEyeball,
  'lorc/fire-shield': EvoFireShield,
  'lorc/flame-spin': EvoFlameSpin,
  'lorc/flame-tunnel': EvoFlameTunnel,
  'lorc/flower-pot': EvoFlowerPot,
  'lorc/flower-twirl': EvoFlowerTwirl,
  'lorc/frozen-orb': EvoFrozenOrb,
  'lorc/gem-chain': EvoGemChain,
  'lorc/gem-pendant': EvoGemPendant,
  'lorc/ghost': EvoGhost,
  'lorc/glass-heart': EvoGlassHeart,
  'lorc/gold-scarab': EvoGoldScarab,
  'lorc/guillotine': EvoGuillotine,
  'lorc/heart-organ': EvoHeartOrgan,
  'lorc/laser-precision': EvoLaserPrecision,
  'lorc/lightning-arc': EvoLightningArc,
  'lorc/locked-chest': EvoLockedChest,
  'lorc/magic-portal': EvoMagicPortal,
  'lorc/meditation': EvoMeditation,
  'lorc/molecule': EvoMolecule,
  'lorc/moon': EvoMoon,
  'lorc/oak': EvoOak,
  'lorc/poker-hand': EvoPokerHand,
  'lorc/power-lightning': EvoPowerLightning,
  'lorc/processor': EvoProcessor,
  'lorc/psychic-waves': EvoPsychicWaves,
  'lorc/resonance': EvoResonance,
  'lorc/sands-of-time': EvoSandsOfTime,
  'lorc/satellite': EvoSatellite,
  'lorc/scroll-unfurled': EvoScrollUnfurled,
  'lorc/sewing-needle': EvoSewingNeedle,
  'lorc/shattered-glass': EvoShatteredGlass,
  'lorc/shield-reflect': EvoShieldReflect,
  'lorc/shouting': EvoShouting,
  'lorc/smoking-orb': EvoSmokingOrb,
  'lorc/sonic-boom': EvoSonicBoom,
  'lorc/sonic-shout': EvoSonicShout,
  'lorc/spark-spirit': EvoSparkSpirit,
  'lorc/sparky-bomb': EvoSparkyBomb,
  'lorc/spectacle-lenses': EvoSpectacleLenses,
  'lorc/spider-web': EvoSpiderWeb,
  'lorc/spiked-halo': EvoSpikedHalo,
  'lorc/spiral-arrow': EvoSpiralArrow,
  'lorc/sprout': EvoSprout,
  'lorc/star-swirl': EvoStarSwirl,
  'lorc/stone-sphere': EvoStoneSphere,
  'lorc/stone-tablet': EvoStoneTablet,
  'lorc/sun': EvoSun,
  'lorc/sunrise': EvoSunrise,
  'lorc/swap-bag': EvoSwapBag,
  'lorc/thunder-struck': EvoThunderStruck,
  'lorc/treasure-map': EvoTreasureMap,
  'lorc/vine-flower': EvoVineFlower,
  'lorc/vine-leaf': EvoVineLeaf,
  'lorc/vortex': EvoVortex,
  'sbed/clover-spiked': EvoCloverSpiked,
  'sbed/electric': EvoElectric,
  'sbed/water-drop': EvoWaterDrop,
  'skoll/burning-skull': EvoBurningSkull,
  'skoll/hearts': EvoHearts,
  'skoll/laser-burst': EvoLaserBurst,
  'skoll/pentacle': EvoPentacle,
  'skoll/sound-waves': EvoSoundWaves,
  'various-artists/infinity': EvoInfinity,
  'willdabeast/gold-bar': EvoGoldBar,
  'lorc/magnet': TrickMagnet,
  'delapouite/wanted-reward': TrickWanted,
  'delapouite/puzzle': TrickPuzzle,
  'delapouite/devil-mask': TrickDevilMask,
  'lorc/snowman': TrickSnowman,
  'delapouite/post-stamp': TrickPostStamp,
  'delapouite/card-joker': TrickJoker,
  'delapouite/gemini': TrickGemini,
  'lorc/shard-sword': TrickShardSword,
  'lorc/lantern-flame': TrickLanternFlame,
  'lorc/two-shadows': TrickTwoShadows,
  'delapouite/theater-curtains': TrickCurtains,
  'delapouite/fog': TrickFog,
  'lorc/magnet-blast': Evo2LodestoneBomb,
  'delapouite/cowboy-holster': Evo2DeadOrAlive,
  'lorc/portal': Evo2HallOfMirrors,
  'lorc/spectacles': Evo2SpotTheDifference,
  'zeromancer/heart-minus': Evo2FaustianHeart,
  'lorc/snowing': Evo2Avalanche,
  'delapouite/notebook': Evo2Scrapbook,
  'delapouite/jester-hat': Evo2JokersRainbow,
  'lorc/twin-shell': Evo2BurningTwins,
  'lorc/anvil-impact': Evo2TemperedGlass,
  'delapouite/fog-light': Evo2LighthouseFog,
  'delapouite/theater': Evo2DressRehearsal,
  'delapouite/ticket': Evo2SecondAct,
  'skoll/evil-eyes': Evo2EvilEye,
  'lorc/manacles': Evo2ShackleLine,
  'lorc/rose': Evo2RoseGarden,
  'delapouite/amphora': Evo2Patina,
  'delapouite/swamp': Evo2Mangrove,
  'lorc/fedora': Evo2PrivateEye,
  'delapouite/alarm-clock': Evo2Countdown,
  'delapouite/iceberg': Evo2GlacierClock,
  'skoll/open-treasure-chest': Evo2TreasureHunt,
  'darkzaitzev/acrobatic': Evo2HighWire,
  'delapouite/fried-eggs': Evo2HotShrapnel,
  'delapouite/direction-signs': Evo2CompassWalk,
  'delapouite/metal-detector': Evo2GoldDetector,
  'delapouite/pitchfork': Evo2WitchHunt,
  'delapouite/prisoner': Evo2MostWanted,
  'lorc/water-splash': Evo2Reflection,
  'delapouite/door': Evo2LookingGlass,
  'delapouite/stamper': Evo2StickerSwap,
  'lorc/angel-wings': Evo2SnowAngel,
  'lorc/crown-of-thorns': Evo2BloodRoses,
  'delapouite/matchbox': Evo2PlayingWithFire,
  'lorc/pine-tree': Evo2DeepWinter,
  'quoting/card-pickup': Evo2TradingCards,
  'lorc/backup': Evo2BodyDouble,
  'lorc/double-face-mask': Evo2Doppelganger,
  'lorc/bowie-knife': Evo2KnifeEdge,
  'darkzaitzev/smoke-bomb': Evo2SmokeBomb,
  'lorc/fluffy-cloud': Evo2Whiteout,
  'delapouite/hand-ok': Evo2StandingOvation,
  'delapouite/gold-stack': Evo2CurtainOfGold,
  'lorc/tribal-mask': Evo2AncientRelic,
  'lorc/quicksand': Evo2Quicksand,
  'delapouite/flail': Evo2BallAndChain,
  'lorc/thorny-tentacle': Evo2BramblePatch,
  'lorc/powder': Evo2OldPowder,
  'lorc/cursed-star': TrickCursedStar,
  'lorc/totem-head': TrickTotemHead,
  'lorc/crossed-chains': TrickCrossedChains,
  'lorc/thorny-vine': TrickThornyVine,
  'delapouite/rusty-sword': TrickRustySword,
  'delapouite/sticky-boot': TrickStickyBoot,
  'delapouite/plastic-duck': TrickPlasticDuck,
  'delapouite/time-dynamite': TrickTimeDynamite,
  'lorc/frozen-block': TrickFrozenBlock,
  'lorc/ice-cube': TrickIceCube,
  'delapouite/mimic-chest': TrickMimicChest,
  'delapouite/tightrope': TrickTightrope,
  'delapouite/potato': TrickPotato,
} as const satisfies Record<string, React.FC<SvgProps>>;

// TypeScript union type of all valid icon names - use this for type-safe icon references
export type IconName = keyof typeof ICON_REGISTRY;

interface IconProps {
  /** Icon path like "delapouite/token" or "lorc/cat" */
  name: IconName;
  /** Icon size in pixels (default: 24) */
  size?: number;
  /** Icon fill color (default: slateCharcoal #383838) */
  color?: string;
  /** Additional styles for the container */
  style?: object;
  /** Hide the drop shadow (default: false) */
  noShadow?: boolean;
}

const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = '#383838', // Default to slateCharcoal for light backgrounds
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
