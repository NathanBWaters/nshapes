/**
 * Product analytics: a tiny PostHog client over its public capture API.
 *
 * No SDK and no native code, so it works the same on iOS, Android and web and
 * ships over the air. Events go into a queue kept in MMKV and are sent in a
 * batch; anything that fails to send (offline, app closed) stays queued and
 * goes out on the next flush (app start, back to the foreground, next event).
 *
 * The project key is a public, write-only ingestion key (PostHog ships it in
 * every client); it cannot read data.
 */
import { Platform } from 'react-native';
import { storage } from '@/utils/storage';
import { subscribeAppActive, getIsAppActive } from '@/utils/appLifecycle';
import { version as APP_VERSION } from '../../package.json';

const HOST = 'https://us.i.posthog.com';
const PROJECT_KEY = 'phc_mZNKMZuCMvvbDi6jacqGWYiGSKFQ8WHEZStwAneL3JKL';

const KEYS = { install: 'analytics_install_id', queue: 'analytics_queue', optOut: 'analytics_opt_out' } as const;
/** The queue never holds more than this (web storage is ~5 MB); the oldest events go first. */
const MAX_QUEUE_BYTES = 1_500_000;
/** PostHog drops a single event over 1 MB */
const MAX_EVENT_BYTES = 900_000;

interface QueuedEvent {
  uuid: string;
  event: string;
  distinct_id: string;
  timestamp: string;
  properties: Record<string, unknown>;
}

let isTest = typeof process !== 'undefined' && !!process.env?.JEST_WORKER_ID;
/** Tests turn sending on to exercise the client against a mocked fetch. */
export const __enableAnalyticsForTests = () => {
  isTest = false;
};

/** RFC 4122 v4 shape; Math.random is fine for an anonymous id */
const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

/** Anonymous id for this install (no account, nothing personal). */
export const installId = (): string => {
  let id = storage.getString(KEYS.install);
  if (!id) {
    id = uuid();
    storage.set(KEYS.install, id);
  }
  return id;
};

export const analyticsEnabled = (): boolean => !isTest && storage.getString(KEYS.optOut) !== '1';
export const setAnalyticsEnabled = (on: boolean) => {
  if (on) storage.remove(KEYS.optOut);
  else {
    storage.set(KEYS.optOut, '1');
    storage.remove(KEYS.queue);
  }
};

const readQueue = (): QueuedEvent[] => {
  try {
    const raw = storage.getString(KEYS.queue);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (events: QueuedEvent[]) => {
  let kept = events;
  while (kept.length > 1 && JSON.stringify(kept).length > MAX_QUEUE_BYTES) kept = kept.slice(1);
  if (kept.length === 0) storage.remove(KEYS.queue);
  else storage.set(KEYS.queue, JSON.stringify(kept));
};

/** Properties every event carries */
const common = () => ({
  $lib: 'nshapes',
  $app_version: APP_VERSION,
  app_version: APP_VERSION,
  $os: Platform.OS,
  platform: Platform.OS,
  env: __DEV__ ? 'dev' : 'prod',
});

let flushing: Promise<void> | null = null;

/** Send everything queued. Safe to call any time; one flush runs at once. */
export const flush = (): Promise<void> => {
  if (!analyticsEnabled()) return Promise.resolve();
  if (flushing) return flushing;
  const batch = readQueue();
  if (batch.length === 0) return Promise.resolve();
  flushing = fetch(`${HOST}/batch/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: PROJECT_KEY, batch }),
    // Lets the request finish if a web tab closes right after a fight
    ...(Platform.OS === 'web' ? { keepalive: JSON.stringify(batch).length < 60_000 } : {}),
  })
    .then(res => {
      if (!res.ok && res.status < 500) {
        if (__DEV__) console.warn('[analytics] batch rejected', res.status);
      } else if (!res.ok) return;
      // Sent (or permanently rejected): drop exactly what was sent, keep anything queued meanwhile
      const sent = new Set(batch.map(e => e.uuid));
      writeQueue(readQueue().filter(e => !sent.has(e.uuid)));
    })
    .catch(() => {
      // Offline: it stays queued for the next flush
    })
    .finally(() => {
      flushing = null;
    });
  return flushing;
};

/** Queue an event and try to send it now. */
export const capture = (event: string, properties: Record<string, unknown> = {}) => {
  if (!analyticsEnabled()) return;
  try {
    const e: QueuedEvent = {
      uuid: uuid(),
      event,
      distinct_id: installId(),
      timestamp: new Date().toISOString(),
      properties: { ...common(), ...properties },
    };
    if (JSON.stringify(e).length > MAX_EVENT_BYTES) {
      // Too big for one event: keep the summary, drop the bulky parts
      const { recording: _r, save: _s, ...summary } = e.properties;
      e.properties = { ...summary, truncated: true };
    }
    writeQueue([...readQueue(), e]);
    void flush();
  } catch (err) {
    if (__DEV__) console.warn('[analytics] capture failed', err);
  }
};

let started = false;
/** Call once at app start: sends anything left over and flushes whenever the app comes back. */
export const startAnalytics = () => {
  if (started || !analyticsEnabled()) return;
  started = true;
  capture('app_opened');
  subscribeAppActive(() => {
    if (getIsAppActive()) void flush();
  });
};
