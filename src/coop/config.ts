/**
 * Starfall Summit 2P Co-Op — Server URL Resolution.
 *
 * Resolves HTTP + WebSocket endpoints for the Cloudflare Workers Co-Op room
 * backend across Web, Expo Dev, Playwright E2E (`?coopServer=...`), and
 * React Native Hermes builds (`EXPO_PUBLIC_COOP_WS_URL`).
 */
import { normalizeRoomCode, type CoopFighterName } from './protocol';

export const DEFAULT_LOCAL_COOP_SERVER = 'http://127.0.0.1:8787';

export type CoopServerConfigSource =
  | 'explicit'
  | 'query'
  | 'env'
  | 'local-dev'
  | 'unconfigured';

export interface CoopServerConfig {
  /** Base HTTP(S) origin with no trailing slash (used for `POST /room` & `GET /health`). */
  httpBaseUrl: string;
  /** Base WS(S) origin with no trailing slash (used for `GET /room/:code/ws`). */
  wsBaseUrl: string;
  source: CoopServerConfigSource;
}

export interface CoopWsUrlParams {
  code: string;
  playerId: string;
  name: string;
  fighter?: CoopFighterName;
  sessionToken?: string;
}

/** Normalize any `http(s)://` or `ws(s)://` URL into matching HTTP + WS base origins. */
export function normalizeCoopServerBase(rawUrl: string): { httpBaseUrl: string; wsBaseUrl: string } | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(candidate);
    candidate = `${isLocal ? 'http' : 'https'}://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    const protocol = parsed.protocol.toLowerCase();
    const isSecure = protocol === 'https:' || protocol === 'wss:';
    const isInsecure = protocol === 'http:' || protocol === 'ws:';
    if (!isSecure && !isInsecure) return null;

    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    const httpProtocol = isSecure ? 'https:' : 'http:';
    const wsProtocol = isSecure ? 'wss:' : 'ws:';

    return {
      httpBaseUrl: `${httpProtocol}//${parsed.host}${cleanPath}`,
      wsBaseUrl: `${wsProtocol}//${parsed.host}${cleanPath}`,
    };
  } catch {
    return null;
  }
}

/** Read `?coopServer=...` from the current browser URL when running on Web. */
export function readCoopServerFromQuery(search?: string): string | null {
  const rawSearch =
    typeof search === 'string'
      ? search
      : typeof window !== 'undefined' && typeof window.location?.search === 'string'
        ? window.location.search
        : '';
  if (!rawSearch) return null;

  try {
    const params = new URLSearchParams(rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch);
    const value = params.get('coopServer')?.trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

function isLocalhostBrowser(): boolean {
  if (typeof window === 'undefined' || typeof window.location?.hostname !== 'string') {
    return false;
  }
  const host = window.location.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function isDevRuntime(): boolean {
  return typeof __DEV__ !== 'undefined' && Boolean(__DEV__);
}

/**
 * Resolve the Co-Op room server URLs in strict priority order:
 *   1. Explicit override argument (`explicitServerUrl`)
 *   2. URL query parameter (`?coopServer=...`)
 *   3. Build-time env (`process.env.EXPO_PUBLIC_COOP_WS_URL`)
 *   4. Local dev fallback (`http://127.0.0.1:8787`) on localhost or `__DEV__`
 */
export function resolveCoopServerConfig(options?: {
  explicitServerUrl?: string;
  querySearch?: string;
  envUrl?: string;
}): CoopServerConfig {
  const explicit = options?.explicitServerUrl?.trim();
  if (explicit) {
    const normalized = normalizeCoopServerBase(explicit);
    if (normalized) return { ...normalized, source: 'explicit' };
  }

  const fromQuery = readCoopServerFromQuery(options?.querySearch);
  if (fromQuery) {
    const normalized = normalizeCoopServerBase(fromQuery);
    if (normalized) return { ...normalized, source: 'query' };
  }

  const envUrl =
    typeof options?.envUrl === 'string'
      ? options.envUrl.trim()
      : typeof process !== 'undefined' && typeof process.env?.EXPO_PUBLIC_COOP_WS_URL === 'string'
        ? process.env.EXPO_PUBLIC_COOP_WS_URL.trim()
        : '';
  if (envUrl) {
    const normalized = normalizeCoopServerBase(envUrl);
    if (normalized) return { ...normalized, source: 'env' };
  }

  if (isLocalhostBrowser() || isDevRuntime()) {
    const normalized = normalizeCoopServerBase(DEFAULT_LOCAL_COOP_SERVER)!;
    return { ...normalized, source: 'local-dev' };
  }

  const fallback = normalizeCoopServerBase(DEFAULT_LOCAL_COOP_SERVER)!;
  return { ...fallback, source: 'unconfigured' };
}

/** Build an HTTP endpoint URL against the resolved server config. */
export function buildCoopHttpUrl(config: CoopServerConfig, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${config.httpBaseUrl}${normalizedPath}`;
}

/** Build the WebSocket connection URL for `GET /room/:code/ws?playerId=...&name=...`. */
export function buildCoopWsUrl(config: CoopServerConfig, params: CoopWsUrlParams): string {
  const code = normalizeRoomCode(params.code);
  if (!code) {
    throw new Error(`Invalid co-op room code: ${params.code}`);
  }
  const query = new URLSearchParams();
  query.set('playerId', params.playerId);
  query.set('name', params.name);
  if (params.fighter) query.set('fighter', params.fighter);
  if (params.sessionToken) query.set('sessionToken', params.sessionToken);
  return `${config.wsBaseUrl}/room/${encodeURIComponent(code)}/ws?${query.toString()}`;
}
