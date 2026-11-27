/**
 * [UI-23] Unified Web Keyboard Navigation Hook with Global Modal Z-Priority Stack.
 *
 * Guarantees:
 * - Single shared `window` `keydown` listener (mounted only while at least one consumer is active).
 * - Strict top-of-stack capture: the highest-priority active modal/overlay receives the event
 *   and prevents keystrokes from leaking down to underlying screens (e.g. `SettingsSheet` over
 *   `MainMenu`, or `KeybindingSheet` over `SettingsSheet`).
 * - Automatically ignores text input elements (`INPUT`, `TEXTAREA`, `SELECT`, `contentEditable`)
 *   and modified chords (`Ctrl`/`Meta`/`Alt`) unless explicitly opted in.
 * - Honors live customizable keybindings from `KeybindingsStorage` (including Confirm/Cancel swap
 *   and duplicate bindings).
 * - 100% no-op on iOS/Android native builds (`Platform.OS !== 'web'`).
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
  cardIndexForKey,
  isModifierOnlyKey,
  KeybindingsStorage,
  markKeyboardActive,
  matchesAction,
  normalizeKey,
} from '@/utils/keybindings';

/** Standard z-priority bands so modals always preempt underlying screens cleanly. */
export const KEY_PRIORITY = {
  /** Base full-screen views (MainMenu, AdventureMap, Camp, Results) */
  SCREEN: 10,
  /** Slide-up sheets over a screen (LevelPreview) */
  SHEET: 20,
  /** Primary dialogs & SettingsSheet / OptionsMenu */
  MODAL: 30,
  /** High-priority overlays (UnlockReveal, FriendRescueModal, DefeatOverlay, StoryEndingModal, KeybindingSheet) */
  OVERLAY: 40,
  /** Key-capture recorder inside KeybindingSheet (preempts everything) */
  CAPTURE: 100,
} as const;

export type NavDirection = 'up' | 'down' | 'left' | 'right';

export interface KeyboardNavOptions {
  /** Whether this layer is currently active in the priority stack (default true). */
  enabled?: boolean;
  /** Higher priority intercepts keys before lower-priority layers (default KEY_PRIORITY.SCREEN). */
  priority?: number;
  /** Keybinding profile id (default `'default'`). */
  profileId?: string;
  /** Allow firing while an input/textarea is focused (default false). */
  allowInTextInput?: boolean;
  /**
   * Low-level raw key interceptor (used by `KeybindingSheet` when capturing a new binding).
   * Return `true` to mark the event handled (calls `preventDefault` and stops further matching).
   */
  onRawKey?: (normalizedKey: string, event: KeyboardEvent) => boolean | void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onHint?: () => void;
  onRetry?: () => void;
  onSacrifice?: () => void;
  onClear?: () => void;
  onCardSlot?: (index: number) => void;
  onNavigate?: (dir: NavDirection) => void;
}

interface StackEntry {
  id: number;
  priority: number;
  order: number;
  optionsRef: { current: KeyboardNavOptions };
}

let nextEntryId = 1;
let nextRegistrationOrder = 1;
const stack: StackEntry[] = [];
let windowListenerAttached = false;

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  if (el.isContentEditable) return true;
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

const getTopEntry = (): StackEntry | null => {
  let top: StackEntry | null = null;
  for (let i = 0; i < stack.length; i++) {
    const entry = stack[i];
    if (entry.optionsRef.current.enabled === false) continue;
    if (
      !top ||
      entry.priority > top.priority ||
      (entry.priority === top.priority && entry.order > top.order)
    ) {
      top = entry;
    }
  }
  return top;
};

const dispatchKeyDown = (event: KeyboardEvent): void => {
  if (Platform.OS !== 'web') return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  const top = getTopEntry();
  if (!top) return;

  const opts = top.optionsRef.current;
  if (!opts.allowInTextInput && isEditableTarget(event.target)) {
    return;
  }

  const rawKey = event.key;
  if (!rawKey || isModifierOnlyKey(rawKey)) return;

  const normalized = normalizeKey(rawKey);
  if (!normalized) return;

  // 1. Raw capture mode (e.g. KeybindingSheet listening for a new binding)
  if (opts.onRawKey) {
    const consumed = opts.onRawKey(normalized, event);
    if (consumed !== false) {
      event.preventDefault();
      markKeyboardActive(true);
      return;
    }
  }

  const bindings = KeybindingsStorage.get(opts.profileId ?? 'default');

  // 2. Semantic action matching (checked in clear priority order; supports duplicate bindings)
  let handled = false;

  if (opts.onCancel && matchesAction(normalized, 'cancel', bindings)) {
    opts.onCancel();
    handled = true;
  } else if (opts.onConfirm && matchesAction(normalized, 'confirm', bindings)) {
    opts.onConfirm();
    handled = true;
  } else if (opts.onRetry && matchesAction(normalized, 'retry', bindings)) {
    opts.onRetry();
    handled = true;
  } else if (opts.onHint && matchesAction(normalized, 'hint', bindings)) {
    opts.onHint();
    handled = true;
  } else if (opts.onSacrifice && matchesAction(normalized, 'sacrifice', bindings)) {
    opts.onSacrifice();
    handled = true;
  } else if (opts.onClear && matchesAction(normalized, 'clear', bindings)) {
    opts.onClear();
    handled = true;
  } else if (opts.onNavigate) {
    if (matchesAction(normalized, 'nav_up', bindings)) {
      opts.onNavigate('up');
      handled = true;
    } else if (matchesAction(normalized, 'nav_down', bindings)) {
      opts.onNavigate('down');
      handled = true;
    } else if (matchesAction(normalized, 'nav_left', bindings)) {
      opts.onNavigate('left');
      handled = true;
    } else if (matchesAction(normalized, 'nav_right', bindings)) {
      opts.onNavigate('right');
      handled = true;
    }
  }

  if (!handled && opts.onCardSlot) {
    const idx = cardIndexForKey(normalized, bindings);
    if (idx !== null) {
      opts.onCardSlot(idx);
      handled = true;
    }
  }

  if (handled) {
    event.preventDefault();
    markKeyboardActive(true);
  }
};

const syncWindowListener = (): void => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const shouldListen = stack.length > 0;
  if (shouldListen && !windowListenerAttached) {
    window.addEventListener('keydown', dispatchKeyDown);
    windowListenerAttached = true;
  } else if (!shouldListen && windowListenerAttached) {
    window.removeEventListener('keydown', dispatchKeyDown);
    windowListenerAttached = false;
  }
};

/** Inspect active keyboard nav stack depth (useful for diagnostics & unit tests). */
export const getKeyboardNavStackSize = (): number => stack.length;

/** Test helper: cleanly clear stack and detach window listener between Jest specs. */
export const __resetKeyboardNavForTests = (): void => {
  stack.length = 0;
  if (windowListenerAttached && typeof window !== 'undefined') {
    window.removeEventListener('keydown', dispatchKeyDown);
  }
  windowListenerAttached = false;
  markKeyboardActive(false);
};

/**
 * Subscribe a screen, sheet, or modal to desktop Web keyboard shortcuts.
 * Higher `priority` entries cleanly shadow lower-priority layers until unmounted or disabled.
 */
export function useKeyboardNav(options: KeyboardNavOptions): void {
  const optionsRef = useRef<KeyboardNavOptions>(options);
  optionsRef.current = options;

  const enabled = options.enabled ?? true;
  const priority = options.priority ?? KEY_PRIORITY.SCREEN;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !enabled) {
      return undefined;
    }

    const entry: StackEntry = {
      id: nextEntryId++,
      priority,
      order: nextRegistrationOrder++,
      optionsRef,
    };
    stack.push(entry);
    syncWindowListener();

    return () => {
      const idx = stack.findIndex(e => e.id === entry.id);
      if (idx >= 0) {
        stack.splice(idx, 1);
      }
      syncWindowListener();
    };
  }, [enabled, priority]);
}
