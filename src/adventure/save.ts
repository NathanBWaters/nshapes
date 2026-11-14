/** Storage wrapper for the adventure save (MMKV). Keep I/O out of progress.ts. */
import { storage } from '@/utils/storage';
import type { AdventureSave } from './types';
import { createNewSave, pathsSeenBeforeSecrets, reconcileUnlocks } from './progress';
import { resolveLegacyWeapon } from './data/armory';

const KEY = 'adventure_v2_save';
/** A stored save that could not be loaded is copied here before anything overwrites it. */
const BACKUP_KEY = 'adventure_v2_save_unreadable';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Lay a stored value over its default. Objects merge key by key, so fields
 * added after a save was written get their defaults and keys this version does
 * not know are kept. A stored value of the wrong kind (not a list where a list
 * is expected, not an object where an object is) falls back to the default.
 */
const withDefaults = (defaults: unknown, stored: unknown): unknown => {
  if (stored === undefined) return defaults;
  if (Array.isArray(defaults)) return Array.isArray(stored) ? stored : defaults;
  if (isRecord(defaults)) {
    if (!isRecord(stored)) return defaults;
    const out: Record<string, unknown> = { ...defaults, ...stored };
    for (const k of Object.keys(defaults)) out[k] = withDefaults(defaults[k], stored[k]);
    return out;
  }
  return stored;
};

/** Some id in this list or record's keys names a weapon that was merged or removed. */
const hasLegacyWeapon = (ids: unknown): boolean => {
  const list = Array.isArray(ids) ? ids : isRecord(ids) ? Object.keys(ids) : [];
  return list.some(id => typeof id === 'string' && resolveLegacyWeapon(id)?.id !== id);
};

/**
 * A stored save in an older shape: it has fighter levels, a single charm or
 * Arcana, or weapon ids from before each weapon family became one weapon.
 */
const needsMigration = (stored: Record<string, unknown>): boolean =>
  (isRecord(stored.fighterLevels) && Object.keys(stored.fighterLevels).length > 0) ||
  (stored.charm !== undefined && stored.charm !== null) ||
  (stored.activeArcana !== undefined && stored.activeArcana !== null) ||
  hasLegacyWeapon(stored.armory) ||
  hasLegacyWeapon(stored.charms) ||
  (isRecord(stored.weaponUpgrades) && Object.keys(stored.weaponUpgrades).length > 0);

const keepUnreadable = (raw: string, why: unknown): void => {
  console.warn('Adventure save could not be loaded; starting a new one.', why);
  try {
    if (storage.getString(BACKUP_KEY) === undefined) storage.set(BACKUP_KEY, raw);
  } catch (e) {
    console.warn('Could not back up the unreadable adventure save.', e);
  }
};

export const loadAdventureSave = (): AdventureSave => {
  let raw: string | undefined;
  try {
    raw = storage.getString(KEY);
  } catch (e) {
    console.warn('Adventure save storage is unavailable; progress will not persist.', e);
    return createNewSave();
  }
  if (!raw) return createNewSave();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) throw new Error(`unsupported save version ${isRecord(parsed) ? String(parsed.version) : typeof parsed}`);
    // reconcileUnlocks also migrates older shapes (fighter levels refunded, single charm/Arcana into slots, merged weapon ids)
    let save = reconcileUnlocks(withDefaults(createNewSave(), parsed) as AdventureSave);
    if (!Array.isArray(parsed.revealedPaths)) save = { ...save, revealedPaths: pathsSeenBeforeSecrets(save) };
    // Store a migrated save right away so a refund can never be paid from the old shape twice
    if (needsMigration(parsed)) writeAdventureSave(save);
    return save;
  } catch (e) {
    keepUnreadable(raw, e);
    return createNewSave();
  }
};

export const writeAdventureSave = (save: AdventureSave): void => {
  try {
    storage.set(KEY, JSON.stringify(save));
  } catch {
    // storage unavailable (private mode etc.) — progress lives in memory only
  }
};
