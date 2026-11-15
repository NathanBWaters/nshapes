import { AppState, type AppStateStatus, Platform } from 'react-native';

type Listener = (active: boolean) => void;

const readInitialActive = (): boolean => {
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined' && typeof document.visibilityState === 'string') {
      return document.visibilityState !== 'hidden';
    }
    return true;
  }
  const current = AppState?.currentState;
  if (current === 'background' || current === 'inactive') {
    return false;
  }
  return true;
};

let isAppActive = readInitialActive();
const listeners = new Set<Listener>();
let initialized = false;

const setActive = (next: boolean) => {
  if (isAppActive === next) return;
  isAppActive = next;
  listeners.forEach(fn => {
    try {
      fn(next);
    } catch {
      /* listener errors shouldn't break lifecycle broadcast */
    }
  });
};

const installListeners = () => {
  if (initialized) return;
  initialized = true;

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      setActive(document.visibilityState !== 'hidden');
    });
    document.addEventListener('freeze', () => setActive(false));
    document.addEventListener('resume', () => {
      setActive(document.visibilityState !== 'hidden');
    });
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', () => setActive(false));
    window.addEventListener('pageshow', () => {
      const visible = typeof document !== 'undefined' ? document.visibilityState !== 'hidden' : true;
      setActive(visible);
    });
  }

  if (Platform.OS !== 'web' && AppState && typeof AppState.addEventListener === 'function') {
    try {
      AppState.addEventListener('change', (nextState: AppStateStatus) => {
        setActive(nextState === 'active');
      });
    } catch {
      /* AppState native module unavailable (e.g. Jest node environment) */
    }
  }
};

installListeners();

/** Returns true when the app or browser tab is actively in the foreground. */
export const getIsAppActive = (): boolean => isAppActive;

/** Subscribe to foreground/background transitions; returns an unsubscribe callback. */
export const subscribeAppActive = (listener: Listener): (() => void) => {
  installListeners();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Test helper to drive foreground/background transitions deterministically. */
export const __setAppActiveForTests = (active: boolean): void => {
  setActive(active);
};
