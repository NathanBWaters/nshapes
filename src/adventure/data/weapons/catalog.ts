/**
 * Canonical 64-Weapon Parameter Registry ([TP-10], Sakurai Ep. #046 & #068).
 *
 * Unifies every Armory weapon's identity, role, icon, voice, Lv 1–5 parameter
 * specs (with plain-English `[Parameter]` bracket labels), cadence constants,
 * growth tracks, guide metadata, and rule/modifier presence into ONE typed
 * registry while keeping `armory.ts`, `weaponStats.ts`, `weaponGuide.ts`, and
 * `weaponRoles.ts` as thin derived views so zero callers break.
 */
import { weaponVoice } from '@/audio/voices';
import type { AdventureWeapon } from '../../types';
import { ALL_ARMORY_WEAPON_IDS, armoryBaseWeapon, findAdventureWeapon } from '../armory';
import { NO_GROWTH, WEAPON_GROWTH } from '../weaponGrowth';
import { weaponGuide } from '../weaponGuide';
import { weaponRole } from '../weaponRoles';
import { WHOLE_STATS, weaponStatDefs, weaponValues } from '../weaponStats';
import {
  WEAPON_CADENCE,
  bracketParam,
  type LevelBreakpoints,
  type ParameterSpec,
  type WeaponCatalogEntry,
  type WeaponParameterRow,
} from './schema';

export { WEAPON_CADENCE, bracketParam } from './schema';
export type { LevelBreakpoints, ParameterSpec, StatUnit, WeaponCatalogEntry, WeaponParameterRow } from './schema';

const WHOLE_STAT_SET = new Set<string>(WHOLE_STATS);

/** Explicit per-weapon cadence map linking weapons to their `WEAPON_CADENCE` keys. */
const WEAPON_CADENCE_MAP: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  'clarity-lens': {
    everyNthSet: WEAPON_CADENCE.CLARITY_EVERY,
    everyNthSetHigh: WEAPON_CADENCE.CLARITY_EVERY_HIGH,
  },
  'war-drum': { setsRequired: WEAPON_CADENCE.DRUM_SETS },
  'rally-horn': { everyNthSet: WEAPON_CADENCE.RALLY_EVERY },
  'revenge-linker': { everyNthSet: WEAPON_CADENCE.REVENGE_EVERY },
  'encore-mask': { extraDurationMs: WEAPON_CADENCE.ENCORE_EXTRA_MS },
  'oracle-eye': {
    idleWaitSeconds: WEAPON_CADENCE.ORACLE_WAIT_S,
    autoHintIntervalMs: WEAPON_CADENCE.ORACLE_INTERVAL_MS,
  },
  'seeker-lens': { baseDamagePerHint: WEAPON_CADENCE.SEEKER_DAMAGE_PER_HINT },
  'mystic-sight': { everyNthHintedSet: WEAPON_CADENCE.MYSTIC_EVERY },
  'life-link': { pulseEveryNthSet: WEAPON_CADENCE.LIFE_LINK_PULSE_EVERY },
  'scholars-tome': { studyXpEveryNthSet: WEAPON_CADENCE.SCHOLAR_XP_EVERY },
  'wisdom-chain': {
    xpEveryNthSet: WEAPON_CADENCE.WISDOM_XP_EVERY,
    standingCoinPct: WEAPON_CADENCE.WISDOM_COIN_PCT,
  },
  'field-stone': {
    overflowBoardThreshold: WEAPON_CADENCE.FIELD_OVERFLOW_BOARD,
    overflowEveryNthSet: WEAPON_CADENCE.FIELD_OVERFLOW_EVERY,
  },
};

const buildCatalogEntry = (id: string): WeaponCatalogEntry => {
  const base = armoryBaseWeapon(id);
  if (!base) {
    throw new Error(`Missing base weapon in Armory for catalog id: "${id}"`);
  }
  if (!base.icon) {
    throw new Error(`Missing icon in Armory for catalog id: "${id}"`);
  }
  const icon = base.icon;
  const adv = findAdventureWeapon(id);
  const defs = weaponStatDefs(base);
  const levelMaps = ([1, 2, 3, 4, 5] as const).map(level => weaponValues(base, { level, tuning: {} })) as [
    Readonly<Record<string, number>>,
    Readonly<Record<string, number>>,
    Readonly<Record<string, number>>,
    Readonly<Record<string, number>>,
    Readonly<Record<string, number>>,
  ];

  const stats: Record<string, ParameterSpec> = {};
  for (const [key, def] of Object.entries(defs)) {
    const levels = levelMaps.map(m => m[key]) as unknown as LevelBreakpoints;
    stats[key] = {
      key,
      label: def.label,
      bracketLabel: bracketParam(def.label),
      unit: def.unit,
      base: def.base,
      perLevel: def.perLevel,
      ...(def.byLevel ? { byLevel: def.byLevel } : {}),
      whole: def.whole === true || WHOLE_STAT_SET.has(key),
      tunable: def.tunable !== false,
      levels,
    };
  }

  const builtLv1 = base as AdventureWeapon;
  return {
    id,
    name: base.name,
    source: adv ? 'adventure' : 'shared',
    role: weaponRole(id),
    icon,
    voice: weaponVoice(id),
    stats,
    levels: levelMaps,
    ...(WEAPON_CADENCE_MAP[id] ? { cadence: WEAPON_CADENCE_MAP[id] } : {}),
    growth: WEAPON_GROWTH[id] ?? [],
    ...(NO_GROWTH[id] ? { noGrowthReason: NO_GROWTH[id] } : {}),
    guide: weaponGuide(id),
    hasRules: (builtLv1.rules?.length ?? 0) > 0,
    hasModifiers: Object.keys(builtLv1.modifiers ?? {}).length > 0,
  };
};

/** Ordered list of all 64 Armory weapons in the canonical registry. */
export const WEAPON_CATALOG_LIST: readonly WeaponCatalogEntry[] = ALL_ARMORY_WEAPON_IDS.map(buildCatalogEntry);

/** Direct O(1) lookup across all 64 Armory weapons. */
export const WEAPON_CATALOG: Readonly<Record<string, WeaponCatalogEntry>> = Object.fromEntries(
  WEAPON_CATALOG_LIST.map(entry => [entry.id, entry])
);

export const getWeaponCatalogEntry = (id: string): WeaponCatalogEntry | undefined => WEAPON_CATALOG[id];

/**
 * Exports all 64 weapons' Lv 1–5 parameters as a flat spreadsheet/JSON table
 * (Sakurai Ep. #046: fast formula-based balance review & live-tuning diffs).
 */
export const exportWeaponParameterTable = (): WeaponParameterRow[] =>
  WEAPON_CATALOG_LIST.flatMap(entry =>
    Object.values(entry.stats).map(spec => ({
      id: entry.id,
      name: entry.name,
      source: entry.source,
      role: entry.role,
      kind: entry.guide.kind,
      paramKey: spec.key,
      bracketLabel: spec.bracketLabel,
      unit: spec.unit,
      whole: spec.whole,
      tunable: spec.tunable,
      lv1: spec.levels[0],
      lv2: spec.levels[1],
      lv3: spec.levels[2],
      lv4: spec.levels[3],
      lv5: spec.levels[4],
    }))
  );
