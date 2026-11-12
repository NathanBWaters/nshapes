/**
 * Every enemy in the game. Adding an enemy file means adding its creator here;
 * name and tier are read from the instance it creates.
 */
import type { EnemyInstance } from '@/types/enemy';
import { createBurrowingMole } from './tier1/burrowingMole';
import { createCirclingVulture } from './tier1/circlingVulture';
import { createFoggyFrog } from './tier1/foggyFrog';
import { createGreedySquirrel } from './tier1/greedySquirrel';
import { createIronShell } from './tier1/ironShell';
import { createJunkRat } from './tier1/junkRat';
import { createLazySloth } from './tier1/lazySloth';
import { createMaskedBandit } from './tier1/maskedBandit';
import { createNightOwl } from './tier1/nightOwl';
import { createPunishingErmine } from './tier1/punishingErmine';
import { createShadowBat } from './tier1/shadowBat';
import { createShiftingChameleon } from './tier1/shiftingChameleon';
import { createSneakyMouse } from './tier1/sneakyMouse';
import { createSpinyHedgehog } from './tier1/spinyHedgehog';
import { createStalkingWolf } from './tier1/stalkingWolf';
import { createStingingScorpion } from './tier1/stingingScorpion';
import { createSwiftBee } from './tier1/swiftBee';
import { createThievingRaven } from './tier1/thievingRaven';
import { createTickingViper } from './tier1/tickingViper';
import { createTrapWeaver } from './tier1/trapWeaver';
import { createWetCrab } from './tier1/wetCrab';
import { createWildGoose } from './tier1/wildGoose';
import { createArmoredTusks } from './tier2/armoredTusks';
import { createCacklingHyena } from './tier2/cacklingHyena';
import { createChargingBoar } from './tier2/chargingBoar';
import { createCreepingShadow } from './tier2/creepingShadow';
import { createDivingHawk } from './tier2/divingHawk';
import { createFierceWolverine } from './tier2/fierceWolverine';
import { createGoblinSaboteur } from './tier2/goblinSaboteur';
import { createHoardingBeaver } from './tier2/hoardingBeaver';
import { createHuntingEagle } from './tier2/huntingEagle';
import { createLurkingShark } from './tier2/lurkingShark';
import { createPolarGuardian } from './tier2/polarGuardian';
import { createProwlingDirewolf } from './tier2/prowlingDirewolf';
import { createVenomousCobra } from './tier2/venomousCobra';
import { createAbyssalOctopus } from './tier3/abyssalOctopus';
import { createFeralFangs } from './tier3/feralFangs';
import { createMercilessPorcupine } from './tier3/mercilessPorcupine';
import { createNightmareSquid } from './tier3/nightmareSquid';
import { createOneEyedTerror } from './tier3/oneEyedTerror';
import { createRagingBear } from './tier3/ragingBear';
import { createRavenousTapir } from './tier3/ravenousTapir';
import { createSavageClaws } from './tier3/savageClaws';
import { createStoneSentinel } from './tier3/stoneSentinel';
import { createSwarmingAnts } from './tier3/swarmingAnts';
import { createWickedImp } from './tier3/wickedImp';
import { createAncientDragon } from './tier4/ancientDragon';
import { createKrakensGrasp } from './tier4/krakensGrasp';
import { createTheHydra } from './tier4/theHydra';
import { createTheReaper } from './tier4/theReaper';
import { createWorldEater } from './tier4/worldEater';

export const ENEMY_CREATORS: readonly (() => EnemyInstance)[] = [
  // Tier 1
  createBurrowingMole,
  createCirclingVulture,
  createFoggyFrog,
  createGreedySquirrel,
  createIronShell,
  createJunkRat,
  createLazySloth,
  createMaskedBandit,
  createNightOwl,
  createPunishingErmine,
  createShadowBat,
  createShiftingChameleon,
  createSneakyMouse,
  createSpinyHedgehog,
  createStalkingWolf,
  createStingingScorpion,
  createSwiftBee,
  createThievingRaven,
  createTickingViper,
  createTrapWeaver,
  createWetCrab,
  createWildGoose,
  // Tier 2
  createArmoredTusks,
  createCacklingHyena,
  createChargingBoar,
  createCreepingShadow,
  createDivingHawk,
  createFierceWolverine,
  createGoblinSaboteur,
  createHoardingBeaver,
  createHuntingEagle,
  createLurkingShark,
  createPolarGuardian,
  createProwlingDirewolf,
  createVenomousCobra,
  // Tier 3
  createAbyssalOctopus,
  createFeralFangs,
  createMercilessPorcupine,
  createNightmareSquid,
  createOneEyedTerror,
  createRagingBear,
  createRavenousTapir,
  createSavageClaws,
  createStoneSentinel,
  createSwarmingAnts,
  createWickedImp,
  // Tier 4
  createAncientDragon,
  createKrakensGrasp,
  createTheHydra,
  createTheReaper,
  createWorldEater,
];
