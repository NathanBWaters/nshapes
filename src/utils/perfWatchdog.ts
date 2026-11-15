import { getIsAppActive, subscribeAppActive } from '@/utils/appLifecycle';

export const MAX_CONCURRENT_FRAME_LOOPS = 12;

export type PerfViolationKind =
  | 'excessive-frame-loops'
  | 'background-frame-loop'
  | 'background-interval'
  | 'background-audio'
  | 'render-storm';

export interface PerfViolation {
  kind: PerfViolationKind;
  detail: string;
  atMs: number;
}

export interface PerfAudioStatus {
  state: string;
  voiceCount: number;
}

export interface PerfSnapshot {
  appActive: boolean;
  activeFrameLoops: number;
  frameLoopsByLabel: Record<string, number>;
  activeIntervals: number;
  intervalsByLabel: Record<string, number>;
  audio: PerfAudioStatus;
  violations: PerfViolation[];
}

const MAX_VIOLATIONS = 100;

let activeFrameLoops = 0;
const frameLoopsByLabel: Record<string, number> = {};
let excessiveWarned = false;

let activeIntervals = 0;
const intervalsByLabel: Record<string, number> = {};

let audioInspector: (() => PerfAudioStatus) | null = null;
const violations: PerfViolation[] = [];

const renderWindows = new Map<string, { windowStartMs: number; count: number; warned: boolean }>();
let renderStormOverride: boolean | null = null;

let installedUnsub: (() => void) | null = null;
let bgAuditTimer: ReturnType<typeof setTimeout> | null = null;

const isTestEnv = (): boolean =>
  typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

const isDevRuntime = (): boolean =>
  typeof __DEV__ !== 'undefined' && Boolean(__DEV__) && !isTestEnv();

const pushViolation = (kind: PerfViolationKind, detail: string): void => {
  const entry: PerfViolation = { kind, detail, atMs: Date.now() };
  violations.push(entry);
  if (violations.length > MAX_VIOLATIONS) {
    violations.shift();
  }
  if (isDevRuntime()) {
    console.warn(`[NShapes Perf] ${kind}: ${detail}`);
  }
};

/** Register an active UI-thread frame loop and return its cleanup callback. */
export function registerFrameLoop(label: string): () => void {
  activeFrameLoops += 1;
  frameLoopsByLabel[label] = (frameLoopsByLabel[label] ?? 0) + 1;

  if (!getIsAppActive()) {
    pushViolation('background-frame-loop', label);
  }
  if (activeFrameLoops > MAX_CONCURRENT_FRAME_LOOPS && !excessiveWarned) {
    excessiveWarned = true;
    pushViolation(
      'excessive-frame-loops',
      `${activeFrameLoops} active (max ${MAX_CONCURRENT_FRAME_LOOPS}) triggered by ${label}`
    );
  }

  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    activeFrameLoops = Math.max(0, activeFrameLoops - 1);
    const remaining = (frameLoopsByLabel[label] ?? 0) - 1;
    if (remaining <= 0) {
      delete frameLoopsByLabel[label];
    } else {
      frameLoopsByLabel[label] = remaining;
    }
    if (activeFrameLoops <= MAX_CONCURRENT_FRAME_LOOPS) {
      excessiveWarned = false;
    }
  };
}

/** Register an active JS interval timer and return its cleanup callback. */
export function registerInterval(label: string): () => void {
  activeIntervals += 1;
  intervalsByLabel[label] = (intervalsByLabel[label] ?? 0) + 1;

  if (!getIsAppActive()) {
    pushViolation('background-interval', label);
  }

  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    activeIntervals = Math.max(0, activeIntervals - 1);
    const remaining = (intervalsByLabel[label] ?? 0) - 1;
    if (remaining <= 0) {
      delete intervalsByLabel[label];
    } else {
      intervalsByLabel[label] = remaining;
    }
  };
}

/** Provide a read-only inspector for live audio state without coupling to src/audio imports. */
export function registerAudioInspector(fn: () => PerfAudioStatus): void {
  audioInspector = fn;
}

/** Enable or disable rolling render-storm tracking (defaults to enabled in non-test __DEV__). */
export function setRenderStormDetection(enabled: boolean): void {
  renderStormOverride = enabled;
}

/** Track component commits over a 1s window to flag runaway re-render storms in dev. */
export function recordComponentRender(name: string, maxCommitsPerSec = 60): void {
  const active = renderStormOverride ?? isDevRuntime();
  if (!active || !getIsAppActive()) return;

  const now = Date.now();
  const prev = renderWindows.get(name);
  if (!prev || now - prev.windowStartMs >= 1000) {
    renderWindows.set(name, { windowStartMs: now, count: 1, warned: false });
    return;
  }

  prev.count += 1;
  if (prev.count > maxCommitsPerSec && !prev.warned) {
    prev.warned = true;
    pushViolation('render-storm', `${name} rendered ${prev.count} times in <=1000ms`);
  }
}

/** Snapshot current frame loops, timers, audio state, and recorded violations. */
export function getPerfSnapshot(): PerfSnapshot {
  const audio: PerfAudioStatus = audioInspector
    ? audioInspector()
    : { state: 'uninitialized', voiceCount: 0 };
  return {
    appActive: getIsAppActive(),
    activeFrameLoops,
    frameLoopsByLabel: { ...frameLoopsByLabel },
    activeIntervals,
    intervalsByLabel: { ...intervalsByLabel },
    audio,
    violations: [...violations],
  };
}

/** Clear recorded violations and rolling render-storm windows. */
export function resetPerfViolations(): void {
  violations.length = 0;
  renderWindows.clear();
  excessiveWarned = activeFrameLoops > MAX_CONCURRENT_FRAME_LOOPS;
}

/**
 * Subscribe to app foreground/background transitions to flag background leaks,
 * and expose `window.__NSHAPES_PERF__` on Web for Playwright and DevTools telemetry.
 */
export function installPerfWatchdog(): () => void {
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__NSHAPES_PERF__ = {
      getSnapshot: getPerfSnapshot,
      resetViolations: resetPerfViolations,
    };
  }

  if (installedUnsub) {
    return installedUnsub;
  }

  const clearAuditTimer = () => {
    if (bgAuditTimer !== null) {
      clearTimeout(bgAuditTimer);
      bgAuditTimer = null;
    }
  };

  const unsubApp = subscribeAppActive((active) => {
    clearAuditTimer();
    if (active) return;

    bgAuditTimer = setTimeout(() => {
      bgAuditTimer = null;
      if (getIsAppActive()) return;

      if (activeFrameLoops > 0) {
        const labels = Object.keys(frameLoopsByLabel).join(', ') || 'unknown';
        pushViolation('background-frame-loop', `${activeFrameLoops} active (${labels})`);
      }
      if (activeIntervals > 0) {
        const labels = Object.keys(intervalsByLabel).join(', ') || 'unknown';
        pushViolation('background-interval', `${activeIntervals} active (${labels})`);
      }
      if (audioInspector) {
        const audio = audioInspector();
        if (audio.state === 'running') {
          pushViolation('background-audio', `AudioContext still running (${audio.voiceCount} voices)`);
        }
      }
    }, 150);

    const timerWithUnref = bgAuditTimer as unknown as { unref?: () => void } | null;
    if (timerWithUnref && typeof timerWithUnref.unref === 'function') {
      timerWithUnref.unref();
    }
  });

  installedUnsub = () => {
    clearAuditTimer();
    unsubApp();
    installedUnsub = null;
  };

  return installedUnsub;
}
