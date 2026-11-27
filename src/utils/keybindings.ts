/**
 * [UI-23] Customizable Desktop Keyboard Keybindings (MMKV-persisted per profile).
 *
 * Supports:
 * - Full 18-card board grid defaults (`1-9 / 0 / - / =` + `QWE / ASD / ZXC` spatial keys)
 * - Global menu & battle actions (`Enter / Space` confirm, `Escape` pause/back,
 *   `H` hint, `R` instant retry, `S` sacrifice, `Backspace` clear, arrow navigation)
 * - Duplicate bindings across multiple actions (Sakurai Ep. #195: never lock players out)
 * - Atomic Confirm ↔ Cancel swap without lockout
 * - Quick presets (`standard`, `numeric`, `spatial`) and 1-click Reset Defaults
 * - Per-profile MMKV persistence using the shared `storage` instance without editing `storage.ts`
 */
import { useEffect, useState } from 'react';
import { storage } from '@/utils/storage';

export const KEYBINDINGS_STORAGE_PREFIX = 'nshapes_keybindings_v1';

export type CardSlotAction =
  | 'card_0'
  | 'card_1'
  | 'card_2'
  | 'card_3'
  | 'card_4'
  | 'card_5'
  | 'card_6'
  | 'card_7'
  | 'card_8'
  | 'card_9'
  | 'card_10'
  | 'card_11'
  | 'card_12'
  | 'card_13'
  | 'card_14'
  | 'card_15'
  | 'card_16'
  | 'card_17';

export type UtilityAction =
  | 'confirm'
  | 'cancel'
  | 'hint'
  | 'retry'
  | 'sacrifice'
  | 'clear'
  | 'nav_up'
  | 'nav_down'
  | 'nav_left'
  | 'nav_right';

export type KeyAction = CardSlotAction | UtilityAction;

export type KeybindingsMap = Record<KeyAction, string[]>;

export type KeybindingPresetId = 'standard' | 'numeric' | 'spatial';

export const CARD_SLOT_ACTIONS: readonly CardSlotAction[] = [
  'card_0',
  'card_1',
  'card_2',
  'card_3',
  'card_4',
  'card_5',
  'card_6',
  'card_7',
  'card_8',
  'card_9',
  'card_10',
  'card_11',
  'card_12',
  'card_13',
  'card_14',
  'card_15',
  'card_16',
  'card_17',
] as const;

export const UTILITY_ACTIONS: readonly UtilityAction[] = [
  'confirm',
  'cancel',
  'hint',
  'retry',
  'sacrifice',
  'clear',
  'nav_up',
  'nav_down',
  'nav_left',
  'nav_right',
] as const;

export const ALL_KEY_ACTIONS: readonly KeyAction[] = [
  ...UTILITY_ACTIONS,
  ...CARD_SLOT_ACTIONS,
] as const;

export interface KeyActionMeta {
  action: KeyAction;
  label: string;
  shortLabel: string;
  description: string;
  group: 'menu' | 'battle' | 'board';
}

export const KEY_ACTION_META: Readonly<Record<KeyAction, KeyActionMeta>> = {
  confirm: {
    action: 'confirm',
    label: 'Confirm / Play',
    shortLabel: 'Confirm',
    description: 'Mash-to-play, open frontier fight, confirm modals & claim unlocks',
    group: 'menu',
  },
  cancel: {
    action: 'cancel',
    label: 'Pause / Back',
    shortLabel: 'Back',
    description: 'Pause live battles or close the topmost modal/sheet',
    group: 'menu',
  },
  hint: {
    action: 'hint',
    label: 'Hint',
    shortLabel: 'Hint',
    description: 'Highlight a card from a valid Set when hints are available',
    group: 'battle',
  },
  retry: {
    action: 'retry',
    label: 'Instant Retry',
    shortLabel: 'Retry',
    description: 'Restart immediately from Defeat Overlay or Results',
    group: 'battle',
  },
  sacrifice: {
    action: 'sacrifice',
    label: 'Sacrifice / Redraw',
    shortLabel: 'Sacrifice',
    description: 'Spend 1 heart to sweep clogged cards and deal fresh ones',
    group: 'battle',
  },
  clear: {
    action: 'clear',
    label: 'Clear Selection',
    shortLabel: 'Clear',
    description: 'Deselect all currently picked cards on the board',
    group: 'battle',
  },
  nav_up: {
    action: 'nav_up',
    label: 'Move Up',
    shortLabel: 'Up',
    description: 'Navigate upward in menus and pickers',
    group: 'menu',
  },
  nav_down: {
    action: 'nav_down',
    label: 'Move Down',
    shortLabel: 'Down',
    description: 'Navigate downward in menus and pickers',
    group: 'menu',
  },
  nav_left: {
    action: 'nav_left',
    label: 'Move Left',
    shortLabel: 'Left',
    description: 'Navigate left in menus and pickers',
    group: 'menu',
  },
  nav_right: {
    action: 'nav_right',
    label: 'Move Right',
    shortLabel: 'Right',
    description: 'Navigate right in menus and pickers',
    group: 'menu',
  },
  card_0: { action: 'card_0', label: 'Card 1 (Row 1, Col 1)', shortLabel: 'Card 1', description: 'Toggle card slot 1', group: 'board' },
  card_1: { action: 'card_1', label: 'Card 2 (Row 1, Col 2)', shortLabel: 'Card 2', description: 'Toggle card slot 2', group: 'board' },
  card_2: { action: 'card_2', label: 'Card 3 (Row 1, Col 3)', shortLabel: 'Card 3', description: 'Toggle card slot 3', group: 'board' },
  card_3: { action: 'card_3', label: 'Card 4 (Row 2, Col 1)', shortLabel: 'Card 4', description: 'Toggle card slot 4', group: 'board' },
  card_4: { action: 'card_4', label: 'Card 5 (Row 2, Col 2)', shortLabel: 'Card 5', description: 'Toggle card slot 5', group: 'board' },
  card_5: { action: 'card_5', label: 'Card 6 (Row 2, Col 3)', shortLabel: 'Card 6', description: 'Toggle card slot 6', group: 'board' },
  card_6: { action: 'card_6', label: 'Card 7 (Row 3, Col 1)', shortLabel: 'Card 7', description: 'Toggle card slot 7', group: 'board' },
  card_7: { action: 'card_7', label: 'Card 8 (Row 3, Col 2)', shortLabel: 'Card 8', description: 'Toggle card slot 8', group: 'board' },
  card_8: { action: 'card_8', label: 'Card 9 (Row 3, Col 3)', shortLabel: 'Card 9', description: 'Toggle card slot 9', group: 'board' },
  card_9: { action: 'card_9', label: 'Card 10 (Row 4, Col 1)', shortLabel: 'Card 10', description: 'Toggle card slot 10', group: 'board' },
  card_10: { action: 'card_10', label: 'Card 11 (Row 4, Col 2)', shortLabel: 'Card 11', description: 'Toggle card slot 11', group: 'board' },
  card_11: { action: 'card_11', label: 'Card 12 (Row 4, Col 3)', shortLabel: 'Card 12', description: 'Toggle card slot 12', group: 'board' },
  card_12: { action: 'card_12', label: 'Card 13 (Row 5, Col 1)', shortLabel: 'Card 13', description: 'Toggle card slot 13', group: 'board' },
  card_13: { action: 'card_13', label: 'Card 14 (Row 5, Col 2)', shortLabel: 'Card 14', description: 'Toggle card slot 14', group: 'board' },
  card_14: { action: 'card_14', label: 'Card 15 (Row 5, Col 3)', shortLabel: 'Card 15', description: 'Toggle card slot 15', group: 'board' },
  card_15: { action: 'card_15', label: 'Card 16 (Row 6, Col 1)', shortLabel: 'Card 16', description: 'Toggle card slot 16', group: 'board' },
  card_16: { action: 'card_16', label: 'Card 17 (Row 6, Col 2)', shortLabel: 'Card 17', description: 'Toggle card slot 17', group: 'board' },
  card_17: { action: 'card_17', label: 'Card 18 (Row 6, Col 3)', shortLabel: 'Card 18', description: 'Toggle card slot 18', group: 'board' },
};

/** Default combined layout: 1-9/0/-/= & QWE/ASD/ZXC card grid + menu/battle hotkeys. */
export const DEFAULT_KEYBINDINGS: Readonly<KeybindingsMap> = {
  confirm: ['Enter', ' '],
  cancel: ['Escape'],
  hint: ['h'],
  retry: ['r'],
  sacrifice: ['s'],
  clear: ['Backspace'],
  nav_up: ['ArrowUp'],
  nav_down: ['ArrowDown'],
  nav_left: ['ArrowLeft'],
  nav_right: ['ArrowRight'],
  card_0: ['1', 'q'],
  card_1: ['2', 'w'],
  card_2: ['3', 'e'],
  card_3: ['4', 'a'],
  card_4: ['5', 's'],
  card_5: ['6', 'd'],
  card_6: ['7', 'z'],
  card_7: ['8', 'x'],
  card_8: ['9', 'c'],
  card_9: ['0'],
  card_10: ['-'],
  card_11: ['='],
  card_12: ['t'],
  card_13: ['y'],
  card_14: ['u'],
  card_15: ['f'],
  card_16: ['g'],
  card_17: ['v'],
};

const NUMERIC_PRESET: Readonly<KeybindingsMap> = {
  ...DEFAULT_KEYBINDINGS,
  card_0: ['1'],
  card_1: ['2'],
  card_2: ['3'],
  card_3: ['4'],
  card_4: ['5'],
  card_5: ['6'],
  card_6: ['7'],
  card_7: ['8'],
  card_8: ['9'],
  card_9: ['0'],
  card_10: ['-'],
  card_11: ['='],
  card_12: ['['],
  card_13: [']'],
  card_14: ['\\'],
  card_15: [';'],
  card_16: ["'"],
  card_17: ['/'],
};

const SPATIAL_PRESET: Readonly<KeybindingsMap> = {
  ...DEFAULT_KEYBINDINGS,
  card_0: ['q'],
  card_1: ['w'],
  card_2: ['e'],
  card_3: ['a'],
  card_4: ['s'],
  card_5: ['d'],
  card_6: ['z'],
  card_7: ['x'],
  card_8: ['c'],
  card_9: ['r'],
  card_10: ['t'],
  card_11: ['y'],
  card_12: ['f'],
  card_13: ['g'],
  card_14: ['h'],
  card_15: ['v'],
  card_16: ['b'],
  card_17: ['n'],
};

export const KEYBINDING_PRESETS: Readonly<Record<KeybindingPresetId, Readonly<KeybindingsMap>>> = {
  standard: DEFAULT_KEYBINDINGS,
  numeric: NUMERIC_PRESET,
  spatial: SPATIAL_PRESET,
};

const SPECIAL_KEY_CANONICAL: Record<string, string> = {
  enter: 'Enter',
  return: 'Enter',
  escape: 'Escape',
  esc: 'Escape',
  space: ' ',
  spacebar: ' ',
  ' ': ' ',
  backspace: 'Backspace',
  tab: 'Tab',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
};

const IGNORED_MODIFIER_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'Dead',
  'Unidentified',
]);

/** Returns true if a key string is a bare modifier key that should not be bound as a primary key. */
export const isModifierOnlyKey = (raw: string): boolean => IGNORED_MODIFIER_KEYS.has(raw);

/** Normalize a DOM KeyboardEvent.key string into a stable canonical token. */
export const normalizeKey = (raw: string): string => {
  if (raw === ' ') return ' ';
  const trimmed = raw.trim();
  if (!trimmed) return raw === '' ? '' : ' ';
  const special = SPECIAL_KEY_CANONICAL[trimmed.toLowerCase()];
  if (special !== undefined) return special;
  if (trimmed.length === 1) return trimmed.toLowerCase();
  return trimmed;
};

/** Human-readable short keycap label for UI badges & keyboard diagram. */
export const formatKeyLabel = (raw: string): string => {
  const k = normalizeKey(raw);
  switch (k) {
    case ' ':
      return 'SPACE';
    case 'Enter':
      return 'ENTER';
    case 'Escape':
      return 'ESC';
    case 'Backspace':
      return 'BKSP';
    case 'Tab':
      return 'TAB';
    case 'ArrowUp':
      return 'UP';
    case 'ArrowDown':
      return 'DOWN';
    case 'ArrowLeft':
      return 'LEFT';
    case 'ArrowRight':
      return 'RIGHT';
    default:
      return k.length === 1 ? k.toUpperCase() : k.toUpperCase();
  }
};

/** Format an action's bound keys as a crisp keycap summary (e.g. "1 / Q" or "ENTER / SPACE"). */
export const formatActionKeys = (keys: readonly string[]): string => {
  if (!keys || keys.length === 0) return 'UNBOUND';
  return keys.map(formatKeyLabel).join(' / ');
};

export const cloneKeybindings = (source: Readonly<KeybindingsMap>): KeybindingsMap => {
  const out = {} as KeybindingsMap;
  for (const action of ALL_KEY_ACTIONS) {
    out[action] = [...(source[action] ?? DEFAULT_KEYBINDINGS[action])];
  }
  return out;
};

const sanitizeKeyList = (raw: unknown, fallback: readonly string[]): string[] => {
  if (!Array.isArray(raw)) return [...fallback];
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const norm = normalizeKey(item);
    if (!norm || isModifierOnlyKey(norm) || seen.has(norm)) continue;
    seen.add(norm);
    clean.push(norm);
  }
  return clean;
};

const hydrateKeybindings = (raw: unknown): KeybindingsMap => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return cloneKeybindings(DEFAULT_KEYBINDINGS);
  }
  const rec = raw as Record<string, unknown>;
  const out = {} as KeybindingsMap;
  for (const action of ALL_KEY_ACTIONS) {
    out[action] = sanitizeKeyList(rec[action], DEFAULT_KEYBINDINGS[action]);
  }
  return out;
};

const storageKeyForProfile = (profileId = 'default'): string =>
  profileId === 'default'
    ? KEYBINDINGS_STORAGE_PREFIX
    : `${KEYBINDINGS_STORAGE_PREFIX}:${profileId}`;

type KeybindingsListener = (map: KeybindingsMap) => void;
const listenersByProfile = new Map<string, Set<KeybindingsListener>>();
const memoryFallbackByProfile = new Map<string, KeybindingsMap>();

const hasMmkv = (): boolean =>
  Boolean(storage && typeof storage.getString === 'function' && typeof storage.set === 'function');

const notifyProfileListeners = (profileId: string, map: KeybindingsMap) => {
  const set = listenersByProfile.get(profileId);
  if (!set) return;
  set.forEach(fn => {
    try {
      fn(cloneKeybindings(map));
    } catch {
      // ignore subscriber errors
    }
  });
};

/** Returns every action bound to the pressed key (supports intentional duplicate bindings). */
export const matchActions = (rawKey: string, map: Readonly<KeybindingsMap>): KeyAction[] => {
  const key = normalizeKey(rawKey);
  if (!key) return [];
  const matches: KeyAction[] = [];
  for (const action of ALL_KEY_ACTIONS) {
    const keys = map[action];
    if (keys && keys.includes(key)) {
      matches.push(action);
    }
  }
  return matches;
};

/** Check whether a raw key press triggers a specific semantic action. */
export const matchesAction = (
  rawKey: string,
  action: KeyAction,
  map: Readonly<KeybindingsMap> = KeybindingsStorage.get()
): boolean => {
  const key = normalizeKey(rawKey);
  if (!key) return false;
  return Boolean(map[action]?.includes(key));
};

/** Resolve which card index (0..17) a raw key press maps to, or null if none. */
export const cardIndexForKey = (
  rawKey: string,
  map: Readonly<KeybindingsMap> = KeybindingsStorage.get()
): number | null => {
  const key = normalizeKey(rawKey);
  if (!key) return null;
  for (let i = 0; i < CARD_SLOT_ACTIONS.length; i++) {
    if (map[CARD_SLOT_ACTIONS[i]]?.includes(key)) {
      return i;
    }
  }
  return null;
};

/** Compute keys currently shared by 2 or more actions (allowed by design, highlighted in UI). */
export const getDuplicateKeyMap = (
  map: Readonly<KeybindingsMap>
): Record<string, KeyAction[]> => {
  const byKey = new Map<string, KeyAction[]>();
  for (const action of ALL_KEY_ACTIONS) {
    for (const k of map[action] ?? []) {
      const list = byKey.get(k);
      if (list) list.push(action);
      else byKey.set(k, [action]);
    }
  }
  const dupes: Record<string, KeyAction[]> = {};
  byKey.forEach((actions, key) => {
    if (actions.length > 1) dupes[key] = actions;
  });
  return dupes;
};

export const KeybindingsStorage = {
  get: (profileId = 'default'): KeybindingsMap => {
    const key = storageKeyForProfile(profileId);
    if (hasMmkv()) {
      const raw = storage.getString(key);
      if (!raw) return cloneKeybindings(DEFAULT_KEYBINDINGS);
      try {
        return hydrateKeybindings(JSON.parse(raw));
      } catch {
        return cloneKeybindings(DEFAULT_KEYBINDINGS);
      }
    }
    const mem = memoryFallbackByProfile.get(profileId);
    return mem ? cloneKeybindings(mem) : cloneKeybindings(DEFAULT_KEYBINDINGS);
  },

  set: (map: Readonly<KeybindingsMap>, profileId = 'default'): KeybindingsMap => {
    const clean = hydrateKeybindings(map);
    memoryFallbackByProfile.set(profileId, clean);
    if (hasMmkv()) {
      storage.set(storageKeyForProfile(profileId), JSON.stringify(clean));
    }
    notifyProfileListeners(profileId, clean);
    return cloneKeybindings(clean);
  },

  /**
   * Bind a key to an action.
   * - `mode: 'replace'` (default) sets the action's bindings to `[key]` (preserving other actions' bindings so duplicates are allowed).
   * - `mode: 'add'` appends `key` as an additional binding for this action without removing existing keys.
   */
  bindAction: (
    action: KeyAction,
    rawKey: string,
    opts?: { mode?: 'replace' | 'add'; profileId?: string }
  ): KeybindingsMap => {
    const profileId = opts?.profileId ?? 'default';
    const mode = opts?.mode ?? 'replace';
    const current = KeybindingsStorage.get(profileId);
    const norm = normalizeKey(rawKey);
    if (!norm || isModifierOnlyKey(norm)) return current;

    if (mode === 'add') {
      const existing = current[action] ?? [];
      if (!existing.includes(norm)) {
        current[action] = [...existing, norm];
      }
    } else {
      current[action] = [norm];
    }
    return KeybindingsStorage.set(current, profileId);
  },

  /** Remove one specific key from an action's binding list. */
  unbindKey: (action: KeyAction, rawKey: string, profileId = 'default'): KeybindingsMap => {
    const current = KeybindingsStorage.get(profileId);
    const norm = normalizeKey(rawKey);
    current[action] = (current[action] ?? []).filter(k => k !== norm);
    return KeybindingsStorage.set(current, profileId);
  },

  /** Atomically swap `confirm` and `cancel` key lists without lockout. */
  swapConfirmCancel: (profileId = 'default'): KeybindingsMap => {
    const current = KeybindingsStorage.get(profileId);
    const prevConfirm = [...current.confirm];
    const prevCancel = [...current.cancel];
    current.confirm = prevCancel;
    current.cancel = prevConfirm;
    return KeybindingsStorage.set(current, profileId);
  },

  /** Apply a built-in layout preset (`standard`, `numeric`, or `spatial`). */
  applyPreset: (preset: KeybindingPresetId, profileId = 'default'): KeybindingsMap =>
    KeybindingsStorage.set(KEYBINDING_PRESETS[preset], profileId),

  /** Restore default keybindings for this profile. */
  reset: (profileId = 'default'): KeybindingsMap => {
    const defaults = cloneKeybindings(DEFAULT_KEYBINDINGS);
    memoryFallbackByProfile.delete(profileId);
    if (hasMmkv()) {
      const s = storage as { remove?: (k: string) => unknown; delete?: (k: string) => unknown };
      const key = storageKeyForProfile(profileId);
      if (typeof s.remove === 'function') s.remove(key);
      else if (typeof s.delete === 'function') s.delete(key);
    }
    notifyProfileListeners(profileId, defaults);
    return defaults;
  },

  subscribe: (listener: KeybindingsListener, profileId = 'default'): (() => void) => {
    let set = listenersByProfile.get(profileId);
    if (!set) {
      set = new Set();
      listenersByProfile.set(profileId, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) {
        listenersByProfile.delete(profileId);
      }
    };
  },
};

/** Reactive hook reading and subscribing to the current profile's customizable keymap. */
export const useKeybindings = (profileId = 'default'): KeybindingsMap => {
  const [map, setMap] = useState<KeybindingsMap>(() => KeybindingsStorage.get(profileId));
  useEffect(() => {
    setMap(KeybindingsStorage.get(profileId));
    return KeybindingsStorage.subscribe(setMap, profileId);
  }, [profileId]);
  return map;
};

// ─── Web Keyboard Activity Tracker (shows keycaps only after keyboard use) ──

let keyboardActive = false;
const keyboardActiveListeners = new Set<(active: boolean) => void>();

export const markKeyboardActive = (active = true): void => {
  if (keyboardActive === active) return;
  keyboardActive = active;
  keyboardActiveListeners.forEach(fn => {
    try {
      fn(active);
    } catch {
      // ignore subscriber errors
    }
  });
};

export const isKeyboardActive = (): boolean => keyboardActive;

export const useKeyboardActive = (): boolean => {
  const [active, setActive] = useState<boolean>(() => keyboardActive);
  useEffect(() => {
    setActive(keyboardActive);
    keyboardActiveListeners.add(setActive);
    return () => {
      keyboardActiveListeners.delete(setActive);
    };
  }, []);
  return active;
};
