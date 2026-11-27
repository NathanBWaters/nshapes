import React from 'react';
import { CreatureJointPivots, DEFAULT_CREATURE_PIVOTS } from '@/components/creatures/types';
import {
  FighterPersonalityProfile,
  fallbackFighterPersonality,
} from '@/utils/fighterAnimations';
import { BadgerRig } from './creatures/BadgerRig';
import { CorgiRig } from './creatures/CorgiRig';
import { EmperorPenguinRig } from './creatures/EmperorPenguinRig';
import { OrangeTabbyRig } from './creatures/OrangeTabbyRig';
import { PelicanRig } from './creatures/PelicanRig';
import { SlyFoxRig } from './creatures/SlyFoxRig';
import { CreatureRigProps } from './creatures/types';

/** Everything that makes one fighter look and move the way it does. */
interface FighterCreature {
  Rig: React.FC<CreatureRigProps>;
  /** Anatomical joint pivots (0..100 SVG space) the part rotations are anchored to */
  pivots: CreatureJointPivots;
  personality: FighterPersonalityProfile;
}

const FIGHTER_CREATURES: Record<string, FighterCreature> = {
  'Orange Tabby': {
    Rig: OrangeTabbyRig,
    pivots: {
      head: { x: 56, y: 45 },
      leftEar: { x: 42, y: 28 },
      rightEar: { x: 69, y: 29 },
      tail: { x: 26, y: 74 },
      paws: { x: 58, y: 76 },
    },
    personality: {
      name: 'Orange Tabby',
      auraColor: '#FF9538',
      breathCycleMs: 2600,
      breathIntensity: 0.032,
      earSwayDeg: 7,
      tailCycleMs: 1800,
      tailWagDeg: 14,
      idleTiltDeg: 1.5,
      signatureMotif: 'hearts',
    },
  },
  'Sly Fox': {
    Rig: SlyFoxRig,
    pivots: {
      head: { x: 58, y: 46 },
      leftEar: { x: 43, y: 29 },
      rightEar: { x: 70, y: 29 },
      tail: { x: 32, y: 74 },
      paws: { x: 58, y: 80 },
    },
    personality: {
      name: 'Sly Fox',
      auraColor: '#FF6B00',
      breathCycleMs: 2300,
      breathIntensity: 0.028,
      earSwayDeg: 9,
      tailCycleMs: 1500,
      tailWagDeg: 16,
      idleTiltDeg: 2.2,
      signatureMotif: 'embers',
    },
  },
  'Emperor Penguin': {
    Rig: EmperorPenguinRig,
    pivots: {
      head: { x: 52, y: 36 },
      leftEar: { x: 30, y: 54 }, // Trailing left flipper shoulder
      rightEar: { x: 65, y: 52 }, // Casting right flipper shoulder
      tail: { x: 38, y: 36 }, // Offset mystic oracle halo center
      paws: { x: 50, y: 88 },
    },
    personality: {
      name: 'Emperor Penguin',
      auraColor: '#16AA98',
      breathCycleMs: 3000,
      breathIntensity: 0.026,
      earSwayDeg: 10, // Flippers!
      tailCycleMs: 2200,
      tailWagDeg: 8,
      idleTiltDeg: 3.2, // Regal waddle sway!
      signatureMotif: 'frost',
    },
  },
  'Corgi': {
    Rig: CorgiRig,
    pivots: {
      head: { x: 58, y: 44 },
      leftEar: { x: 40, y: 29 },
      rightEar: { x: 72, y: 29 },
      tail: { x: 18, y: 66 }, // Corgi nub-tail rump on far left
      paws: { x: 50, y: 82 },
    },
    personality: {
      name: 'Corgi',
      auraColor: '#FFDE00',
      breathCycleMs: 1650, // Peppy happy pant!
      breathIntensity: 0.04,
      earSwayDeg: 11, // Big radar ears!
      tailCycleMs: 520, // Hyper-speed corgi nub wag!
      tailWagDeg: 22,
      idleTiltDeg: 2.5,
      signatureMotif: 'stars',
    },
  },
  'Pelican': {
    Rig: PelicanRig,
    pivots: {
      head: { x: 42, y: 34 },
      leftEar: { x: 24, y: 54 }, // Far coastal wing shoulder
      rightEar: { x: 33, y: 56 }, // Near coastal wing shoulder
      tail: { x: 54, y: 50 }, // Oversized gular throat pouch hinge
      paws: { x: 42, y: 88 },
    },
    personality: {
      name: 'Pelican',
      auraColor: '#16AA98',
      breathCycleMs: 2800,
      breathIntensity: 0.03,
      earSwayDeg: 9, // Wings!
      tailCycleMs: 2000, // Gular throat pouch bob!
      tailWagDeg: 10,
      idleTiltDeg: 1.8,
      signatureMotif: 'splash',
    },
  },
  'Badger': {
    Rig: BadgerRig,
    pivots: {
      head: { x: 55, y: 44 },
      leftEar: { x: 34, y: 26 },
      rightEar: { x: 75, y: 26 },
      tail: { x: 20, y: 74 },
      paws: { x: 54, y: 68 },
    },
    personality: {
      name: 'Badger',
      auraColor: '#16AA98',
      breathCycleMs: 2100, // Grounded boxer bob!
      breathIntensity: 0.036,
      earSwayDeg: 5,
      tailCycleMs: 1700,
      tailWagDeg: 8,
      idleTiltDeg: 2.0,
      signatureMotif: 'shockwave',
    },
  },
};

/** Registry entry for a fighter with a bespoke rig, or undefined for any other character. */
export function getFighterCreature(characterName?: string | null): FighterCreature | undefined {
  if (!characterName) return undefined;
  return Object.prototype.hasOwnProperty.call(FIGHTER_CREATURES, characterName)
    ? FIGHTER_CREATURES[characterName]
    : undefined;
}

export function getFighterPersonality(characterName?: string | null): FighterPersonalityProfile {
  return getFighterCreature(characterName)?.personality ?? fallbackFighterPersonality(characterName);
}

export function getFighterPivots(characterName?: string | null): CreatureJointPivots {
  return getFighterCreature(characterName)?.pivots ?? DEFAULT_CREATURE_PIVOTS;
}
