/**
 * Canonical Weapon Parameter Registry schema (Sakurai Ep. #046 & #068).
 *
 * Centralizes all tunable weapon cadence constants and binds plain-English
 * `[Parameter]` labels 1:1 to every Armory weapon's Lv 1–5 data fields so
 * spreadsheets, in-fight live tuning, explainers, and tests read one truth.
 */
import type { IconName } from '@/components/Icon';
import type { WeaponVoice } from '@/audio/voices';
import type { GrowthDef } from '../weaponGrowth';
import type { WeaponGuide } from '../weaponGuide';
import type { WeaponRole } from '../weaponRoles';

export type StatUnit = '%' | 's' | 'count' | 'dmg' | '×';

/** Explicit 5-element tuple of weapon values at Levels 1, 2, 3, 4, and 5. */
export type LevelBreakpoints = readonly [number, number, number, number, number];

/**
 * Previously file-local magic cadence constants consolidated into one table
 * (Sakurai Ep. #046: "Programming is the skeleton, parameters are the muscles").
 */
export const WEAPON_CADENCE = {
  /** Clarity Lens: fires every Nth Set at Lv 1–3 */
  CLARITY_EVERY: 5,
  /** Clarity Lens: fires every Nth Set at Lv 4–5 */
  CLARITY_EVERY_HIGH: 4,
  /** War Drum: number of Sets required inside its sliding window */
  DRUM_SETS: 3,
  /** Rally Horn: sounds again on every Nth Set */
  RALLY_EVERY: 4,
  /** Revenge Linker: wires a Tripwire on every Nth Set */
  REVENGE_EVERY: 4,
  /** Encore Mask: milliseconds added to every active evolution */
  ENCORE_EXTRA_MS: 5000,
  /** Oracle Eye: auto-hint idle wait in seconds (BASE_WAIT_TIME 8s − autoHintInterval 4s = 4s) */
  ORACLE_WAIT_S: 4,
  /** Oracle Eye: autoHintInterval reduction (ms) */
  ORACLE_INTERVAL_MS: 4000,
  /** Seeker Lens: base Level-1 Set damage per unspent hint held */
  SEEKER_DAMAGE_PER_HINT: 1.5,
  /** Mystic Sight: every Nth hinted Set multiplier cadence */
  MYSTIC_EVERY: 3,
  /** Life Link: every Nth Set at full hearts unleashes a Life Pulse */
  LIFE_LINK_PULSE_EVERY: 4,
  /** Scholar's Tome: steady extra XP cadence */
  SCHOLAR_XP_EVERY: 3,
  /** Wisdom Chain: every Nth Set grants bonus XP */
  WISDOM_XP_EVERY: 5,
  /** Wisdom Chain: standing % coin bonus */
  WISDOM_COIN_PCT: 15,
  /** Field Stone: board size threshold for overflow Power-card spawning */
  FIELD_OVERFLOW_BOARD: 18,
  /** Field Stone: overflow Power-card conversion cadence */
  FIELD_OVERFLOW_EVERY: 5,
} as const;

/** Plain-English `[Parameter]` binding per Sakurai Ep. #068. */
export const bracketParam = (label: string): string => `[${label}]`;

export interface ParameterSpec {
  /** Internal field key on `effects`, `stats`, or `extra` */
  key: string;
  /** Plain-English human label (e.g. "Blast chance") */
  label: string;
  /** Bracketed parameter token (e.g. "[Blast chance]") per Ep. #068 */
  bracketLabel: string;
  unit: StatUnit;
  base: number;
  perLevel: number;
  /** Explicit Lv 1–5 breakpoints when integer/stepped progression is authored */
  byLevel?: LevelBreakpoints;
  /** True when the stat is an integer whole-unit count (never randomly rounded) */
  whole: boolean;
  /** False when the Workshop cannot tune this parameter */
  tunable: boolean;
  /** Resolved untuned values for Levels 1–5 */
  levels: LevelBreakpoints;
}

export interface WeaponCatalogEntry {
  id: string;
  name: string;
  /** Whether the base weapon originates from shared Free Play definitions or Adventure-only rules */
  source: 'shared' | 'adventure';
  role: WeaponRole;
  icon: IconName;
  voice: WeaponVoice;
  stats: Readonly<Record<string, ParameterSpec>>;
  /** Resolved untuned stat maps at Levels 1..5 */
  levels: readonly [
    Readonly<Record<string, number>>,
    Readonly<Record<string, number>>,
    Readonly<Record<string, number>>,
    Readonly<Record<string, number>>,
    Readonly<Record<string, number>>,
  ];
  /** Relevant cadence constants from `WEAPON_CADENCE`, if any */
  cadence?: Readonly<Record<string, number>>;
  growth: readonly GrowthDef[];
  noGrowthReason?: string;
  guide: WeaponGuide;
  hasRules: boolean;
  hasModifiers: boolean;
}

/** Flat spreadsheet/JSON row format for Ep. #046 parameter table export & live diffing. */
export interface WeaponParameterRow {
  id: string;
  name: string;
  source: 'shared' | 'adventure';
  role: WeaponRole;
  kind: WeaponGuide['kind'];
  paramKey: string;
  bracketLabel: string;
  unit: StatUnit;
  whole: boolean;
  tunable: boolean;
  lv1: number;
  lv2: number;
  lv3: number;
  lv4: number;
  lv5: number;
}
