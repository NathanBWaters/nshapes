/**
 * Canonical Balance Era manifest & semver validity helpers.
 *
 * Pure and React-Native-safe (zero Node `fs` / `crypto` imports) so the
 * mobile/web runtime (`posthog.ts`), `/dev/analytics` (`dashboardEngine.ts`),
 * PostHog HogQL dashboards (`posthogDashboards.ts`), power-ranking engine
 * (`powerRank.ts`), and CLI scripts all share ONE single source of truth.
 */
import manifestJson from './balanceEras.json';

export type BalanceCategory = 'weapons' | 'evolutions' | 'fighters' | 'arcana' | 'levels';

export type FightModeFilter = 'adventure' | 'spire' | 'free_play' | 'classic';

export type BalanceEraScope = 'global' | 'mode' | 'category' | 'item';

export interface BalanceEraInvalidation {
  global?: boolean;
  modes?: FightModeFilter[];
  categories?: BalanceCategory[];
  weapons?: string[];
  evolutions?: string[];
  fighters?: string[];
  arcana?: string[];
  levels?: string[];
}

export interface BalanceEra {
  id: string;
  minVersion: string;
  date: string;
  commit: string;
  summary: string;
  scope: BalanceEraScope;
  invalidated: BalanceEraInvalidation;
}

export interface BalanceFingerprintsSnapshot {
  engineFiles: Record<string, string>;
  items: {
    weapons: Record<string, string>;
    evolutions: Record<string, string>;
    fighters: Record<string, string>;
    arcana: Record<string, string>;
    levels: Record<string, string>;
  };
}

export interface BalanceEraManifest {
  schemaVersion: number;
  currentEraId: string;
  currentAppVersion: string;
  eras: BalanceEra[];
  fingerprints: BalanceFingerprintsSnapshot;
}

export const BALANCE_ERA_MANIFEST: BalanceEraManifest = manifestJson as BalanceEraManifest;

export const BALANCE_ERAS: readonly BalanceEra[] = BALANCE_ERA_MANIFEST.eras;

export const CURRENT_BALANCE_ERA_ID: string = BALANCE_ERA_MANIFEST.currentEraId;

export const CURRENT_BALANCE_ERA: BalanceEra =
  BALANCE_ERAS.find(e => e.id === CURRENT_BALANCE_ERA_ID) ?? BALANCE_ERAS[BALANCE_ERAS.length - 1];

const SEMVER_RE = /^\s*v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?\s*$/;

/**
 * Converts a semver string (`"0.1.164"` or `"v0.1.164"`) into a strictly ordered
 * integer `major * 1_000_000 + minor * 1_000 + patch`.
 *
 * Avoids lexicographic string-comparison bugs such as `"0.1.99" > "0.1.100"`.
 * Returns `null` when the string is absent or not valid `X.Y.Z` semver.
 */
export const semverToNumeric = (v: string | null | undefined): number | null => {
  if (typeof v !== 'string') return null;
  const match = SEMVER_RE.exec(v);
  if (!match) return null;
  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  const patch = Number.parseInt(match[3], 10);
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) return null;
  return major * 1_000_000 + minor * 1_000 + patch;
};

/** Compares two semver strings numerically: `-1` if `a < b`, `0` if equal, `1` if `a > b`. */
export const compareSemver = (a: string, b: string): number => {
  const na = semverToNumeric(a);
  const nb = semverToNumeric(b);
  if (na === null && nb === null) return 0;
  if (na === null) return -1;
  if (nb === null) return 1;
  if (na < nb) return -1;
  if (na > nb) return 1;
  return 0;
};

/** Returns `true` iff `v` is valid semver and `>= min`. */
export const isVersionAtLeast = (v: string | null | undefined, min: string): boolean => {
  const nv = semverToNumeric(v);
  const nMin = semverToNumeric(min);
  if (nv === null || nMin === null) return false;
  return nv >= nMin;
};

const eraInvalidatesTarget = (
  era: BalanceEra,
  category: BalanceCategory | 'all',
  itemId?: string,
  mode?: FightModeFilter
): boolean => {
  const inv = era.invalidated;
  if (inv.global) return true;
  if (mode && inv.modes?.includes(mode)) return true;

  // When an era is strictly scoped to other modes (e.g. Spire-only E6) and the caller
  // asks for a different mode (e.g. Adventure), do not cross-invalidate unless category/item
  // invalidations are explicitly global (no `modes` restriction).
  if (mode && inv.modes && inv.modes.length > 0 && !inv.modes.includes(mode)) {
    return false;
  }

  if (category === 'all') {
    return false;
  }

  if (inv.categories?.includes(category)) return true;

  if (itemId !== undefined) {
    const list = inv[category];
    if (list && (list.includes('*') || list.includes(itemId))) return true;
  }
  return false;
};

/**
 * Returns the earliest valid `app_version` for PostHog telemetry covering the given
 * `(category, itemId?, mode?)` tuple, combining global, mode, category, and per-item
 * invalidation boundaries from `BALANCE_ERAS`.
 */
export const getMinValidVersion = (
  category: BalanceCategory | 'all' = 'all',
  itemId?: string,
  mode?: FightModeFilter,
  eras: readonly BalanceEra[] = BALANCE_ERAS
): string => {
  if (eras.length === 0) return '0.0.0';
  let floor = eras[0].minVersion;
  for (const era of eras) {
    if (eraInvalidatesTarget(era, category, itemId, mode) && compareSemver(era.minVersion, floor) > 0) {
      floor = era.minVersion;
    }
  }
  return floor;
};

/**
 * Resolves which Balance Era an event's `app_version` belongs to (the latest era whose
 * `minVersion <= v`), or `null` if `v` is invalid or predates telemetry launch (`E0`).
 */
export const getEraForVersion = (
  v: string | null | undefined,
  eras: readonly BalanceEra[] = BALANCE_ERAS
): BalanceEra | null => {
  const nv = semverToNumeric(v);
  if (nv === null) return null;
  let matched: BalanceEra | null = null;
  for (const era of eras) {
    const nEra = semverToNumeric(era.minVersion);
    if (nEra !== null && nv >= nEra) {
      matched = era;
    }
  }
  return matched;
};

/** Looks up a Balance Era by id (e.g. `"E8"`). */
export const getEraById = (
  id: string,
  eras: readonly BalanceEra[] = BALANCE_ERAS
): BalanceEra | undefined => eras.find(e => e.id === id);

/** Formats an incremented patch version (`"0.1.164"` -> `"0.1.165"`). */
export const nextPatchVersion = (v: string): string => {
  const match = SEMVER_RE.exec(v);
  if (!match) throw new Error(`Invalid semver "${v}"`);
  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  const patch = Number.parseInt(match[3], 10);
  return `${major}.${minor}.${patch + 1}`;
};
