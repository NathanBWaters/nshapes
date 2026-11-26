/**
 * [TP-11] Dev-only live parameter override store for in-fight tuning with zero
 * Metro reloads (Sakurai Ep. #046 Systems That Make Tuning Easy, #193 Debug Mode,
 * #215 Transparency Toggle).
 *
 * Production builds (`__DEV__ === false`) always read stock constants and ignore
 * override mutations safely.
 */
import { PARRY_RULES } from '../data/parry';
import { SURGE_RULES } from '../data/rules';
import { fxClock } from '../fx/clock';

export type DevSlowMoRate = 0.25 | 0.5 | 1;

export interface DevLayerVisibility {
  hideFx: boolean;
  dimBoard: boolean;
  showAnchors: boolean;
}

export interface DevOverrides {
  parry: Partial<Record<keyof typeof PARRY_RULES, number>>;
  surge: Partial<Record<keyof typeof SURGE_RULES, number>>;
  weapons: Record<string, Record<string, number>>;
  slowMoRate: DevSlowMoRate;
  layers: DevLayerVisibility;
}

type Listener = (state: DevOverrides) => void;

const DEFAULT_LAYERS: DevLayerVisibility = {
  hideFx: false,
  dimBoard: false,
  showAnchors: false,
};

const createEmptyOverrides = (): DevOverrides => ({
  parry: {},
  surge: {},
  weapons: {},
  slowMoRate: 1,
  layers: { ...DEFAULT_LAYERS },
});

let state: DevOverrides = createEmptyOverrides();
const listeners = new Set<Listener>();

const isDevAllowed = (): boolean =>
  typeof __DEV__ === 'undefined' ? true : Boolean(__DEV__);

const emit = () => {
  const snap = getDevOverrides();
  listeners.forEach(fn => {
    try {
      fn(snap);
    } catch {
      // ignore subscriber errors
    }
  });
};

export const getDevOverrides = (): DevOverrides => ({
  parry: { ...state.parry },
  surge: { ...state.surge },
  weapons: Object.fromEntries(
    Object.entries(state.weapons).map(([k, v]) => [k, { ...v }])
  ),
  slowMoRate: state.slowMoRate,
  layers: { ...state.layers },
});

export const subscribeDevOverrides = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getEffectiveParryRules = (): Record<keyof typeof PARRY_RULES, number> => {
  if (!isDevAllowed()) return { ...PARRY_RULES };
  return { ...PARRY_RULES, ...state.parry };
};

export const getEffectiveSurgeRules = (): Record<keyof typeof SURGE_RULES, number> => {
  if (!isDevAllowed()) return { ...SURGE_RULES };
  return { ...SURGE_RULES, ...state.surge };
};

export const getEffectiveWeaponStats = <T extends Record<string, number>>(
  weaponId: string,
  baseStats: T
): T => {
  if (!isDevAllowed()) return baseStats;
  const over = state.weapons[weaponId];
  if (!over) return baseStats;
  return { ...baseStats, ...over };
};

export const setDevSlowMo = (rate: DevSlowMoRate): void => {
  if (!isDevAllowed()) return;
  const clamped: DevSlowMoRate = rate === 0.25 || rate === 0.5 ? rate : 1;
  state = { ...state, slowMoRate: clamped };
  fxClock.slow = Math.round(1 / clamped);
  emit();
};

export const setDevLayers = (partial: Partial<DevLayerVisibility>): void => {
  if (!isDevAllowed()) return;
  state = {
    ...state,
    layers: { ...state.layers, ...partial },
  };
  emit();
};

export const setDevOverrides = (
  partial: Partial<Pick<DevOverrides, 'parry' | 'surge' | 'weapons'>>
): void => {
  if (!isDevAllowed()) return;
  state = {
    ...state,
    ...(partial.parry ? { parry: { ...state.parry, ...partial.parry } } : {}),
    ...(partial.surge ? { surge: { ...state.surge, ...partial.surge } } : {}),
    ...(partial.weapons
      ? {
          weapons: {
            ...state.weapons,
            ...Object.fromEntries(
              Object.entries(partial.weapons).map(([id, vals]) => [
                id,
                { ...(state.weapons[id] ?? {}), ...vals },
              ])
            ),
          },
        }
      : {}),
  };
  emit();
};

const isFiniteNumberRecord = (v: unknown): v is Record<string, number> =>
  typeof v === 'object' &&
  v !== null &&
  !Array.isArray(v) &&
  Object.values(v).every(x => typeof x === 'number' && Number.isFinite(x));

/** Parse and apply a live JSON override payload (`{ parry?, surge?, weapons? }`). */
export const applyDevOverridesJson = (
  raw: string
): { ok: true } | { ok: false; error: string } => {
  if (!isDevAllowed()) return { ok: false, error: 'Dev overrides are disabled in production.' };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: 'Root JSON must be an object with optional parry, surge, weapons.' };
    }
    const nextParry: DevOverrides['parry'] = {};
    const nextSurge: DevOverrides['surge'] = {};
    const nextWeapons: DevOverrides['weapons'] = {};

    if (parsed.parry !== undefined) {
      if (!isFiniteNumberRecord(parsed.parry)) {
        return { ok: false, error: '`parry` must map PARRY_RULES keys to finite numbers.' };
      }
      for (const [k, v] of Object.entries(parsed.parry)) {
        if (k in PARRY_RULES) {
          nextParry[k as keyof typeof PARRY_RULES] = v;
        }
      }
    }

    if (parsed.surge !== undefined) {
      if (!isFiniteNumberRecord(parsed.surge)) {
        return { ok: false, error: '`surge` must map SURGE_RULES keys to finite numbers.' };
      }
      for (const [k, v] of Object.entries(parsed.surge)) {
        if (k in SURGE_RULES) {
          nextSurge[k as keyof typeof SURGE_RULES] = v;
        }
      }
    }

    if (parsed.weapons !== undefined) {
      if (typeof parsed.weapons !== 'object' || parsed.weapons === null || Array.isArray(parsed.weapons)) {
        return { ok: false, error: '`weapons` must map weapon ids to numeric stat objects.' };
      }
      for (const [wid, stats] of Object.entries(parsed.weapons as Record<string, unknown>)) {
        if (!isFiniteNumberRecord(stats)) {
          return { ok: false, error: `Weapon override "${wid}" must map stat keys to finite numbers.` };
        }
        nextWeapons[wid] = { ...stats };
      }
    }

    state = {
      ...state,
      parry: nextParry,
      surge: nextSurge,
      weapons: nextWeapons,
    };
    emit();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid JSON syntax.' };
  }
};

export const resetDevOverrides = (): void => {
  state = createEmptyOverrides();
  fxClock.slow = 1;
  emit();
};

export const countActiveDevOverrides = (snap: DevOverrides = state): number =>
  Object.keys(snap.parry).length +
  Object.keys(snap.surge).length +
  Object.values(snap.weapons).reduce((sum, w) => sum + Object.keys(w).length, 0) +
  (snap.slowMoRate !== 1 ? 1 : 0) +
  (snap.layers.hideFx ? 1 : 0) +
  (snap.layers.dimBoard ? 1 : 0) +
  (snap.layers.showAnchors ? 1 : 0);

/** Produce a clean source-ready diff snippet to copy winning values back into code. */
export const buildDevOverridesDiff = (snap: DevOverrides = state): string => {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(snap.parry)) {
    const base = PARRY_RULES[k as keyof typeof PARRY_RULES];
    if (base !== v) {
      lines.push(`PARRY_RULES.${k}: ${base} -> ${v}`);
    }
  }
  for (const [k, v] of Object.entries(snap.surge)) {
    const base = SURGE_RULES[k as keyof typeof SURGE_RULES];
    if (base !== v) {
      lines.push(`SURGE_RULES.${k}: ${base} -> ${v}`);
    }
  }
  for (const [wid, stats] of Object.entries(snap.weapons)) {
    for (const [sk, sv] of Object.entries(stats)) {
      lines.push(`WEAPON[${wid}].${sk} = ${sv}`);
    }
  }
  if (lines.length === 0) {
    return '// No active parameter overrides.';
  }
  return lines.join('\n');
};
