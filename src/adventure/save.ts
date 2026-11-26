/** Storage wrapper for the adventure save (MMKV). Keep I/O out of progress.ts. */
import { storage } from '@/utils/storage';
import type { AdventureSave } from './types';
import { createNewSave, pathsSeenBeforeSecrets, reconcileUnlocks } from './progress';
import type { CauldronWagerTier } from './data/relief';
import { resolveLegacyWeapon } from './data/armory';
import { HISTORY_LIMIT, sanitizeBattleRecord, trimReplays, withBattle, withBattleFeedback, type BattleRecord } from './history';
import type { FunRating, FunTag } from '@/analytics/fightEvent';

const KEY = 'adventure_v2_save';
/** Kept apart from the save: it grows with every fight, and the save is rewritten on every change */
const HISTORY_KEY = 'adventure_v2_history';
/** A stored save that could not be loaded (or came from a newer schema version) is copied here before anything overwrites it. */
const BACKUP_KEY = 'adventure_v2_save_unreadable';
/** Snapshot of the previous save taken right before a Save Backup Code restore overwrites `KEY`. */
const IMPORT_BACKUP_KEY = 'adventure_v2_save_pre_import';

export const ADVENTURE_SAVE_KEY = KEY;
export const ADVENTURE_BACKUP_KEY = BACKUP_KEY;
export const ADVENTURE_IMPORT_BACKUP_KEY = IMPORT_BACKUP_KEY;

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

const preserveRawBackup = (raw: string, why: unknown): void => {
  console.warn('Adventure save requires fallback; preserving raw backup.', why);
  try {
    if (storage.getString(BACKUP_KEY) === undefined) storage.set(BACKUP_KEY, raw);
  } catch (e) {
    console.warn('Could not back up the adventure save.', e);
  }
};

const keepUnreadable = (raw: string, why: unknown): void => {
  console.warn('Adventure save could not be loaded; starting a new one.', why);
  try {
    if (storage.getString(BACKUP_KEY) === undefined) storage.set(BACKUP_KEY, raw);
  } catch (e) {
    console.warn('Could not back up the unreadable adventure save.', e);
  }
};

const sanitizeConsecutiveLosses = (raw: unknown): Record<string, number> => {
  if (!isRecord(raw)) return {};
  const out: Record<string, number> = {};
  for (const [levelId, val] of Object.entries(raw)) {
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      out[levelId] = Math.floor(val);
    }
  }
  return out;
};

const sanitizeCauldronWager = (raw: unknown): CauldronWagerTier =>
  raw === 1 || raw === 2 ? raw : 0;

/**
 * Hydrate and reconcile a parsed AdventureSave object (supports version 1 and
 * best-effort forward-compatible hydration for future `version > 1` shapes).
 * Returns `null` if the input is not a supported save record.
 */
export const hydrateAdventureSave = (parsed: unknown): AdventureSave | null => {
  if (!isRecord(parsed)) return null;
  const ver = parsed.version;
  if (typeof ver !== 'number' || !Number.isFinite(ver) || ver < 1) return null;
  const normalized = ver === 1 ? parsed : { ...parsed, version: 1 };
  // reconcileUnlocks also migrates older shapes (fighter levels refunded, single charm/Arcana into slots, merged weapon ids)
  let save = reconcileUnlocks(withDefaults(createNewSave(), normalized) as AdventureSave);
  if (!Array.isArray(parsed.revealedPaths)) save = { ...save, revealedPaths: pathsSeenBeforeSecrets(save) };
  // Sanitize [GP-18] persisted relief/wager fields defensively
  save = {
    ...save,
    consecutiveLosses: sanitizeConsecutiveLosses(save.consecutiveLosses),
    hiddenPurse:
      typeof save.hiddenPurse === 'number' && Number.isFinite(save.hiddenPurse) && save.hiddenPurse > 0
        ? Math.floor(save.hiddenPurse)
        : 0,
    cauldronWager: sanitizeCauldronWager(save.cauldronWager),
    tailwindActive: Boolean(save.tailwindActive),
  };
  return save;
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
    if (!isRecord(parsed)) throw new Error(`unsupported save payload ${typeof parsed}`);
    const ver = parsed.version;
    if (typeof ver === 'number' && Number.isFinite(ver) && ver > 1) {
      // Forward-compatible downgrade guard: keep the untouched newer save in BACKUP_KEY
      // and hydrate best-effort in memory WITHOUT overwriting KEY automatically.
      preserveRawBackup(raw, `newer save version ${ver}`);
      const hydrated = hydrateAdventureSave(parsed);
      if (hydrated) return hydrated;
      throw new Error(`could not hydrate future save version ${ver}`);
    }
    if (ver !== 1) throw new Error(`unsupported save version ${String(ver)}`);
    const save = hydrateAdventureSave(parsed);
    if (!save) throw new Error('could not hydrate adventure save');
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

/** Snapshot the existing raw Adventure save before a Save Backup Code import overwrites it. */
export const backupAdventureSaveBeforeOverwrite = (): void => {
  try {
    const raw = storage.getString(KEY);
    if (raw) storage.set(IMPORT_BACKUP_KEY, raw);
  } catch {
    // non-fatal
  }
};

/**
 * Transactional cross-mode helper for merging newly discovered Evolution recipe IDs
 * (e.g. forged during Starfall Summit climbs) into Adventure's Recipe Guide without
 * clobbering concurrent Adventure fields or downgrading a future `version > 1` save.
 */
export const mergeDiscoveredEvolutions = (ids: readonly string[]): AdventureSave | null => {
  const unique = [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  if (unique.length === 0) return null;
  try {
    const raw = storage.getString(KEY);
    if (raw) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Never overwrite an unreadable save from a cross-mode sync
        preserveRawBackup(raw, 'unparseable save during evolution sync');
        return null;
      }
      if (!isRecord(parsed)) return null;
      const ver = parsed.version;
      if (typeof ver === 'number' && Number.isFinite(ver) && ver > 1) {
        // Preserve untouched raw backup and merge ONLY `discoveredEvolutions` in-place
        // so future schema fields and `version` are never downgraded or lost.
        preserveRawBackup(raw, `future save version ${ver} during evolution sync`);
        const existing = Array.isArray(parsed.discoveredEvolutions)
          ? parsed.discoveredEvolutions.filter((x): x is string => typeof x === 'string')
          : [];
        const added = unique.filter(id => !existing.includes(id));
        if (added.length > 0) {
          storage.set(KEY, JSON.stringify({ ...parsed, discoveredEvolutions: [...existing, ...added] }));
        }
        return hydrateAdventureSave({ ...parsed, discoveredEvolutions: [...existing, ...added] });
      }
    }
    const adv = loadAdventureSave();
    const added = unique.filter(id => !adv.discoveredEvolutions.includes(id));
    if (added.length === 0) return adv;
    const next: AdventureSave = {
      ...adv,
      discoveredEvolutions: [...adv.discoveredEvolutions, ...added],
    };
    writeAdventureSave(next);
    return next;
  } catch {
    return null;
  }
};

/** Every battle fought, oldest first (the most recent HISTORY_LIMIT). Entries that cannot be read are dropped. */
export const loadBattleHistory = (): BattleRecord[] => {
  try {
    const raw = storage.getString(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map(sanitizeBattleRecord).filter((b): b is BattleRecord => b !== null).slice(-HISTORY_LIMIT)
      : [];
  } catch (e) {
    console.warn('Battle history could not be loaded; starting a new one.', e);
    return [];
  }
};

const writeHistoryList = (next: BattleRecord[]): BattleRecord[] => {
  try {
    storage.set(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Tight storage quota (e.g. web localStorage): shed older full logs before dropping entries
    for (const keep of [10, 0]) {
      try {
        storage.set(HISTORY_KEY, JSON.stringify(trimReplays(next, keep)));
        return next;
      } catch {
        // try keeping even fewer replays
      }
    }
  }
  return next;
};

/** Add a battle to the stored history; returns the new list. */
export const recordBattle = (history: readonly BattleRecord[], record: BattleRecord): BattleRecord[] =>
  writeHistoryList(withBattle(history, record));

const removeStoredKey = (key: string): boolean => {
  try {
    const s = storage as { remove?: (k: string) => unknown; delete?: (k: string) => unknown };
    if (typeof s.remove === 'function') {
      s.remove(key);
      return true;
    }
    if (typeof s.delete === 'function') {
      s.delete(key);
      return true;
    }
  } catch {
    // ignore storage errors
  }
  return false;
};

/** Wipe all Adventure Mode progress & battle history so the player starts completely fresh. */
export const resetAdventureSave = (): AdventureSave => {
  const fresh = createNewSave();
  if (!removeStoredKey(KEY)) writeAdventureSave(fresh);
  if (!removeStoredKey(HISTORY_KEY)) writeHistoryList([]);
  removeStoredKey(BACKUP_KEY);
  return fresh;
};

/** Persist updates to a battle's fun rating & tags inside the stored history list. */
export const saveBattleFeedback = (
  history: readonly BattleRecord[],
  match: { fightId?: string; at: number; levelId: string },
  feedback: { funRating: FunRating | null; funTags: FunTag[] }
): BattleRecord[] => writeHistoryList(withBattleFeedback(history, match, feedback));
