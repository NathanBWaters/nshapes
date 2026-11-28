/**
 * Bridge between Starfall Summit and Adventure Mode's shared combat engine.
 *
 * Converts a `SpireRun` + `SpireEncounter` into a standard `LevelDef`, a
 * virtual `AdventureSave`, `RunOverrides`, and `FeatureFlag` set so EVERY
 * Summit fight — and every pre-fight stat calculation — runs through the exact
 * same `startingLoadout`, `runReducer`, `AdventureRun`, `UPGRADES`, 192
 * Per-Weapon Timed Evolutions, Synergy Graph, Set-Parrying, Multiplier Ignition,
 * Kill-Cam, and Audio Band!
 */
import type { AttributeName, Weapon } from '@/types';
import type { AdventureSave, FeatureFlag, LevelDef, SynergyAttrId } from '@/adventure/types';
import type { WeaponBuilds } from '@/adventure/data/weaponStats';
import { COACH_KEYS, createNewSave } from '@/adventure/progress';
import { defaultEvolutionForWeapon, getWeaponEvolution, WEAPON_EVOLUTIONS } from '@/adventure/data/evolutions';
import { beltSynergyOverlap } from '@/adventure/data/synergy';
import { MECHANICS } from '@/adventure/data/mechanics';
import { ARCANA } from '@/adventure/data/arcana';
import { ALL_ARMORY_WEAPON_IDS, charmWeapons, getArmoryWeapon } from '@/adventure/data/armory';
import { startingLoadout, type Loadout } from '@/adventure/loadout';
import type { RunOverrides } from '@/adventure/engine/run';
import type { SpireCoopPartySize, SpireEncounter, SpireRun } from '../types';

const A3: AttributeName[] = ['shape', 'color', 'number'];

/** Authoritative 2P Co-Op Duo foe HP multiplier (1P stays 1.00× identical). */
export const COOP_DUO_HP_MULTIPLIER = 1.75;

export interface SpireEncounterToLevelOptions {
  coopPartySize?: SpireCoopPartySize;
}

/** Scale a foe's HP for party size (1P is 100% identical; 2P scales by 1.75×). */
export const scaleFoeHpForParty = (
  hp: number,
  coopPartySize: SpireCoopPartySize = 1
): number => (coopPartySize === 2 ? Math.max(1, Math.round(hp * COOP_DUO_HP_MULTIPLIER)) : hp);

/** All core combat features enabled inside Starfall Summit fights (no mid-fight wave shop/xp popups — progression lives on the Summit map!). */
export const SPIRE_FIGHT_FEATURES: ReadonlySet<FeatureFlag> = new Set<FeatureFlag>([
  'hearts',
  'gear',
  'power',
  'rainbow',
  'purity',
  'coins',
  'hints',
  'graces',
  'evolutions',
]);

/** All 192 Per-Weapon Timed Evolution IDs — unlocked freely inside Starfall Summit runs for build experimentation. */
export const ALL_EVOLUTION_IDS: readonly string[] = WEAPON_EVOLUTIONS.map(e => e.id);

/** Build a `WeaponBuilds` lookup from the Summit run's weapon levels. */
export const buildSpireWeaponBuilds = (run: Pick<SpireRun, 'weaponLevels'>): WeaponBuilds => {
  const out: Record<string, { level: number; tuning: Record<string, number> }> = {};
  for (const [id, level] of Object.entries(run.weaponLevels)) {
    out[id] = { level: Math.max(1, Math.min(5, level)), tuning: {} };
  }
  return out;
};

/** Instantiate the player's current held weapons at their Summit levels (respecting Understudy slot order). */
export const spireHeldWeapons = (run: Pick<SpireRun, 'weapons' | 'weaponLevels'>): Weapon[] =>
  charmWeapons(run.weapons, buildSpireWeaponBuilds(run));

/** Resolve equipped evolution IDs for every weapon currently held on the Summit belt (defaults to Evo A). */
export const spireEquippedEvolutions = (
  run: Pick<SpireRun, 'weapons' | 'equippedEvolutions'>
): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const wid of run.weapons) {
    const chosen = run.equippedEvolutions?.[wid];
    const valid = chosen ? getWeaponEvolution(chosen) : undefined;
    if (valid && valid.weaponId === wid) {
      out[wid] = valid.id;
    } else {
      const def = defaultEvolutionForWeapon(wid);
      if (def) out[wid] = def.id;
    }
  }
  return out;
};

/** Synergy Graph attributes shared between `candidateWeaponId` and the run's current belt. */
export const spireWeaponSynergyOverlap = (
  run: Pick<SpireRun, 'weapons'>,
  candidateWeaponId: string
): SynergyAttrId[] => beltSynergyOverlap(candidateWeaponId, run.weapons);

export interface SpireClashWarning {
  partnerId: string;
  partnerName: string;
  reason: string;
}

/**
 * Empirically verified severe Gamble/Board anti-synergies flagged before
 * buying or drafting in Starfall Summit (`docs/balance-analytics.json` clashes).
 */
export const SPIRE_CLASH_PAIRS: readonly { a: string; b: string; reason: string }[] = [
  {
    a: 'chain-gang',
    b: 'long-fuse',
    reason: 'Chained pairs compete with Long Fuse timing windows for the same board slots.',
  },
  {
    a: 'greedy-chest',
    b: 'cursed-idol',
    reason: 'Cursed locks block cards you need to preserve or cash out Greedy Chest.',
  },
  {
    a: 'ice-block',
    b: 'neural-network',
    reason: 'Frozen cards block linked bursts from clearing cleanly until thawed.',
  },
  {
    a: 'twin-seed',
    b: 'chain-reaction',
    reason: 'Duplicate twin cards crowd the board and dilute chain-reaction blasts.',
  },
  {
    a: 'twin-seed',
    b: 'ice-block',
    reason: 'Frozen cards and duplicate twins crowd the board, starving Set lines under pressure.',
  },
  {
    a: 'twin-seed',
    b: 'hot-potato',
    reason: 'Duplicate twins clutter the board when Hot Potato demands fast clears.',
  },
  {
    a: 'twin-seed',
    b: 'long-fuse',
    reason: 'Duplicate twins compete with Long Fuse timing windows for board space.',
  },
  {
    a: 'fog-lantern',
    b: 'rust',
    reason: 'Face-down Fog cards sit hidden while Rust decays sitting cards and obscures hazards.',
  },
  {
    a: 'thorn-bush',
    b: 'ice-block',
    reason: 'Frozen slots reduce match flexibility while Thorn Bush penalizes uncleared thorns.',
  },
  {
    a: 'rust',
    b: 'ice-block',
    reason: 'Frozen cards sit untouched while Rust decays them to 0 before thawing.',
  },
  {
    a: 'twin-seed',
    b: 'thorn-bush',
    reason: 'Duplicate twin cards crowd board slots while Thorn Bush demands fast thorn clears.',
  },
  {
    a: 'ice-block',
    b: 'greedy-chest',
    reason: 'Frozen slots and maturing Greedy Chests both tie up playable board space at once.',
  },
];

/** Returns any severe Gamble/Board clash warnings if `candidateWeaponId` is added to `heldWeaponIds`. */
export const clashesWithBelt = (
  heldWeaponIds: readonly string[],
  candidateWeaponId: string
): SpireClashWarning[] => {
  const held = new Set(heldWeaponIds);
  const warnings: SpireClashWarning[] = [];
  for (const pair of SPIRE_CLASH_PAIRS) {
    let partnerId: string | null = null;
    if (candidateWeaponId === pair.a && held.has(pair.b)) partnerId = pair.b;
    else if (candidateWeaponId === pair.b && held.has(pair.a)) partnerId = pair.a;
    if (partnerId) {
      warnings.push({
        partnerId,
        partnerName: getArmoryWeapon(partnerId)?.name ?? partnerId,
        reason: pair.reason,
      });
    }
  }
  return warnings;
};

/** Convert a Summit encounter into a standard Adventure `LevelDef`. */
export const spireEncounterToLevel = (
  run: SpireRun,
  encounter: SpireEncounter,
  options?: SpireEncounterToLevelOptions
): LevelDef => {
  const partySize: SpireCoopPartySize = options?.coopPartySize ?? run.coopPartySize ?? 1;
  const foes =
    partySize === 2
      ? encounter.foes.map(foe => ({ ...foe, hp: scaleFoeHpForParty(foe.hp, 2) }))
      : encounter.foes;
  return {
    id: `spire-${run.act}-${run.floor}-${encounter.id}`,
    biome: encounter.biome,
    name: encounter.name,
    introduces: 'timer',
    rules: {
      attributes: A3,
      boardSize: encounter.boardSize,
      timer: Math.max(45, encounter.timer),
      hearts: run.maxHearts,
      startingHints: run.startingHints,
      startingGraces: run.startingGraces,
      shadingSurge: encounter.shadingSurge,
      ...(encounter.hazards ? { hazards: encounter.hazards } : {}),
      ...(run.extraEvolutionDurationMs > 0 ? { extraEvolutionDurationMs: run.extraEvolutionDurationMs } : {}),
      ...(run.extraEvolutionChargeBonus > 0 ? { extraEvolutionChargeBonus: run.extraEvolutionChargeBonus } : {}),
    },
    foes,
    challenge: { kind: 'noMistakes' },
    coinMultiplier: 1 + run.act * 0.35,
    difficulty: encounter.difficulty,
    rewards: {
      star1: { coins: 0 },
      star2: { coins: encounter.coinReward },
      star3: { coins: encounter.coinReward },
    },
    isBoss: encounter.kind === 'boss',
    ...(encounter.kind === 'elite' ? { isElite: true } : {}),
  };
};

/** Build a virtual `AdventureSave` reflecting the Summit run's exact fighter, gear, equipped evolutions, skills, Arcana, and shared UPGRADES. */
export const spireRunToVirtualSave = (
  run: SpireRun,
  prefs: { musicOn: boolean; effectsOn: boolean } = { musicOn: true, effectsOn: true }
): AdventureSave => {
  const base = createNewSave();
  return {
    ...base,
    selectedFighter: run.fighter,
    unlockedFighters: [run.fighter],
    armory: [...ALL_ARMORY_WEAPON_IDS],
    charms: [...run.weapons],
    equippedEvolutions: spireEquippedEvolutions(run),
    unlockedWeaponEvolutions: [...ALL_EVOLUTION_IDS],
    skillNodes: { [run.fighter]: [...run.skillNodes] },
    unlockedArcana: ARCANA.map(a => a.id),
    equippedArcana: [...run.arcana],
    unlockedEvolutions: [],
    discoveredEvolutions: [...run.stats.forgedRecipeIds],
    coinsUnlocked: true,
    workshopUnlocked: true,
    bountiesUnlocked: false,
    upgrades: {
      ...(run.upgrades ?? {}),
      tough_hide: 0,
    },
    musicOn: prefs.musicOn,
    effectsOn: prefs.effectsOn,
    seenMechanics: Object.keys(MECHANICS),
    seenCoachMarks: [
      ...Object.keys(MECHANICS).map(COACH_KEYS.event),
      COACH_KEYS.evolution,
      COACH_KEYS.evoAlmost,
      COACH_KEYS.weaponSlotUnlock,
      COACH_KEYS.weaponGrowth,
    ],
  };
};

/**
 * Overrides passed to `createRun` / `AdventureRun` so Starfall Summit keeps
 * persistent HP and lets all 6 Summit weapons enter combat regardless of Adventure's
 * `charm_belt` meta-upgrade (Summit enforces `MAX_SUMMIT_WEAPONS = 6` in `runState.ts`).
 */
export const spireRunOverrides = (run: SpireRun): RunOverrides => ({
  startingHearts: run.hearts,
  uncappedCharms: true,
  uncappedArcana: true,
  weaponBuilds: buildSpireWeaponBuilds(run),
});

/** Compute the exact combat `Loadout` via Adventure's shared `startingLoadout`. */
export const spireEncounterLoadout = (
  run: SpireRun,
  encounter: SpireEncounter,
  options?: SpireEncounterToLevelOptions
): Loadout =>
  startingLoadout(
    spireEncounterToLevel(run, encounter, options),
    spireRunToVirtualSave(run),
    new Set(SPIRE_FIGHT_FEATURES),
    undefined,
    spireRunOverrides(run)
  );
