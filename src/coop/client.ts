/**
 * Starfall Summit 2P Co-Op — Cross-Platform WebSocket Client.
 *
 * Pure TypeScript over standard WebSocket + fetch (works identically on Expo
 * Web, React Native Hermes iOS/Android, and Jest Node tests with zero native
 * dependencies).
 *
 * Strictly obeys NShapes performance & battery guardrails:
 *   - Uses `getIsAppActive` / `subscribeAppActive` from `@/utils/appLifecycle`
 *     (never attaches raw `AppState` or `visibilitychange` listeners).
 *   - Registers its ping heartbeat interval with `registerInterval` from
 *     `@/utils/perfWatchdog`, automatically pausing and unregistering the
 *     interval whenever the app goes inactive or the socket disconnects.
 */
import { getIsAppActive, subscribeAppActive } from '@/utils/appLifecycle';
import { registerInterval } from '@/utils/perfWatchdog';
import {
  buildCoopHttpUrl,
  buildCoopWsUrl,
  resolveCoopServerConfig,
  type CoopServerConfig,
} from './config';
import {
  normalizeRoomCode,
  parseCreateRoomResponse,
  parseServerMessage,
  type CoopClientMessage,
  type CoopCreateRoomResponse,
  type CoopEmoteKind,
  type CoopFighterName,
  type CoopGiftKind,
  type CoopNodeKind,
  type CoopPhase,
  type CoopPlayerInfo,
  type CoopRoomSnapshot,
  type CoopServerMessage,
  type CoopShopGiftPayload,
  type CoopSynergyCounters,
} from './protocol';

export type CoopConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface CoopWebSocketLike {
  readonly readyState: number;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code?: number; reason?: string; wasClean?: boolean }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type CoopWebSocketCtor = new (url: string) => CoopWebSocketLike;

export interface CoopClientOptions {
  serverUrl?: string;
  playerId?: string;
  name?: string;
  fighter?: CoopFighterName;
  heartbeatMs?: number;
  maxReconnectAttempts?: number;
  baseReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  WebSocketImpl?: CoopWebSocketCtor;
  fetchImpl?: typeof fetch;
}

export interface CoopCreateRoomResult extends CoopCreateRoomResponse {
  serverUrl: string;
}

const WS_OPEN = 1;
const DEFAULT_HEARTBEAT_MS = 20_000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 8;
const DEFAULT_BASE_RECONNECT_DELAY_MS = 600;
const DEFAULT_MAX_RECONNECT_DELAY_MS = 10_000;

function generatePlayerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `p_${crypto.randomUUID().slice(0, 12)}`;
  }
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36).slice(-4);
  return `p_${ts}${rand}`;
}

function defaultWebSocketCtor(): CoopWebSocketCtor {
  if (typeof WebSocket === 'undefined') {
    throw new Error('Global WebSocket is unavailable in this runtime.');
  }
  return WebSocket as unknown as CoopWebSocketCtor;
}

function defaultFetch(): typeof fetch {
  if (typeof fetch === 'undefined') {
    throw new Error('Global fetch is unavailable in this runtime.');
  }
  return fetch;
}

/**
 * Create a new Starfall Summit 2P Co-Op room via `POST /room`.
 */
export async function createCoopRoom(options?: {
  serverUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<CoopCreateRoomResult> {
  const config = resolveCoopServerConfig({ explicitServerUrl: options?.serverUrl });
  const fetchFn = options?.fetchImpl ?? defaultFetch();
  const res = await fetchFn(buildCoopHttpUrl(config, '/room'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to create co-op room (HTTP ${res.status})`);
  }

  const json: unknown = await res.json();
  const parsed = parseCreateRoomResponse(json);
  if (!parsed) {
    throw new Error('Invalid create-room response from co-op server.');
  }

  return {
    ...parsed,
    serverUrl: config.httpBaseUrl,
  };
}

/**
 * Probe `GET /health` on the co-op worker.
 */
export async function checkCoopServerHealth(options?: {
  serverUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  try {
    const config = resolveCoopServerConfig({ explicitServerUrl: options?.serverUrl });
    const fetchFn = options?.fetchImpl ?? defaultFetch();
    const res = await fetchFn(buildCoopHttpUrl(config, '/health'), { method: 'GET' });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: unknown };
    return data?.ok === true;
  } catch {
    return false;
  }
}

export class CoopClient {
  private readonly config: CoopServerConfig;
  private readonly wsCtor: CoopWebSocketCtor;
  private readonly fetchFn: typeof fetch;
  private readonly heartbeatMs: number;
  private readonly maxReconnectAttempts: number;
  private readonly baseReconnectDelayMs: number;
  private readonly maxReconnectDelayMs: number;

  private playerId: string;
  private playerName: string;
  private fighter?: CoopFighterName;
  private roomCode: string | null = null;
  private sessionToken: string | null = null;

  private ws: CoopWebSocketLike | null = null;
  private status: CoopConnectionStatus = 'idle';
  private snapshot: CoopRoomSnapshot | null = null;

  private intentionalClose = false;
  private disposed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingReconnectOnResume = false;

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private unregisterHeartbeat: (() => void) | null = null;
  private unsubLifecycle: (() => void) | null = null;

  private readonly snapshotListeners = new Set<(snapshot: CoopRoomSnapshot) => void>();
  private readonly messageListeners = new Set<(msg: CoopServerMessage) => void>();
  private readonly statusListeners = new Set<(status: CoopConnectionStatus, detail?: string) => void>();
  private readonly errorListeners = new Set<(err: { code: string; message: string }) => void>();

  constructor(options: CoopClientOptions = {}) {
    this.config = resolveCoopServerConfig({ explicitServerUrl: options.serverUrl });
    this.wsCtor = options.WebSocketImpl ?? defaultWebSocketCtor();
    this.fetchFn = options.fetchImpl ?? defaultFetch();
    this.heartbeatMs = Math.max(1000, options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS);
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;
    this.baseReconnectDelayMs = options.baseReconnectDelayMs ?? DEFAULT_BASE_RECONNECT_DELAY_MS;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? DEFAULT_MAX_RECONNECT_DELAY_MS;

    this.playerId = options.playerId?.trim() || generatePlayerId();
    this.playerName = options.name?.trim() || 'Climber';
    this.fighter = options.fighter;

    this.unsubLifecycle = subscribeAppActive(active => this.handleAppActiveChange(active));
  }

  // -------------------------------------------------------------------------
  // State Inspection
  // -------------------------------------------------------------------------

  getServerConfig(): CoopServerConfig {
    return this.config;
  }

  getStatus(): CoopConnectionStatus {
    return this.status;
  }

  getSnapshot(): CoopRoomSnapshot | null {
    return this.snapshot;
  }

  getPlayerId(): string {
    return this.playerId;
  }

  getRoomCode(): string | null {
    return this.roomCode;
  }

  getSessionToken(): string | null {
    return this.sessionToken;
  }

  getLocalPlayer(): CoopPlayerInfo | null {
    return this.snapshot?.players.find(p => p.playerId === this.playerId) ?? null;
  }

  getAllyPlayer(): CoopPlayerInfo | null {
    return this.snapshot?.players.find(p => p.playerId !== this.playerId) ?? null;
  }

  // -------------------------------------------------------------------------
  // Subscriptions
  // -------------------------------------------------------------------------

  onSnapshot(listener: (snapshot: CoopRoomSnapshot) => void): () => void {
    this.snapshotListeners.add(listener);
    if (this.snapshot) {
      try {
        listener(this.snapshot);
      } catch {
        /* isolate listener failures */
      }
    }
    return () => {
      this.snapshotListeners.delete(listener);
    };
  }

  onMessage(listener: (msg: CoopServerMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  onStatusChange(listener: (status: CoopConnectionStatus, detail?: string) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  onError(listener: (err: { code: string; message: string }) => void): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  // -------------------------------------------------------------------------
  // Connection & Lifecycle
  // -------------------------------------------------------------------------

  /** Allocate a fresh 4-char room via `POST /room` and immediately connect as Host. */
  async createAndJoin(opts?: {
    name?: string;
    fighter?: CoopFighterName;
  }): Promise<CoopCreateRoomResult> {
    if (this.disposed) {
      throw new Error('CoopClient has been disposed.');
    }
    const created = await createCoopRoom({
      serverUrl: this.config.httpBaseUrl,
      fetchImpl: this.fetchFn,
    });
    this.connect(created.code, opts);
    return created;
  }

  /** Connect (or reconnect) to an existing 4-char co-op room over WebSocket. */
  connect(
    code: string,
    opts?: {
      playerId?: string;
      name?: string;
      fighter?: CoopFighterName;
      sessionToken?: string;
    },
  ): void {
    if (this.disposed) return;

    const normalized = normalizeRoomCode(code);
    if (!normalized) {
      this.setStatus('error', 'Invalid 4-character room code');
      this.emitError('ROOM_NOT_FOUND', 'Room code must be 4 letters or numbers.');
      return;
    }

    if (opts?.playerId) this.playerId = opts.playerId.trim() || this.playerId;
    if (opts?.name) this.playerName = opts.name.trim() || this.playerName;
    if (opts?.fighter) this.fighter = opts.fighter;
    if (opts?.sessionToken) this.sessionToken = opts.sessionToken;

    if (this.roomCode !== normalized) {
      this.sessionToken = opts?.sessionToken ?? null;
      this.snapshot = null;
    }

    this.roomCode = normalized;
    this.intentionalClose = false;
    this.pendingReconnectOnResume = false;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    this.openSocket(false);
  }

  /** Cleanly close the active WebSocket connection without disposing subscriptions. */
  disconnect(): void {
    this.intentionalClose = true;
    this.pendingReconnectOnResume = false;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.teardownSocket(1000, 'client_disconnect');
    this.setStatus('disconnected');
  }

  /** Permanently close the client, cancel timers, and unsubscribe lifecycle hooks. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disconnect();
    this.unsubLifecycle?.();
    this.unsubLifecycle = null;
    this.snapshotListeners.clear();
    this.messageListeners.clear();
    this.statusListeners.clear();
    this.errorListeners.clear();
  }

  // -------------------------------------------------------------------------
  // Typed Send Helpers
  // -------------------------------------------------------------------------

  send(msg: CoopClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== WS_OPEN) {
      return false;
    }
    try {
      this.ws.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  updateLobby(patch: Omit<Extract<CoopClientMessage, { type: 'UPDATE_LOBBY' }>, 'type'>): boolean {
    if (patch.fighter) this.fighter = patch.fighter;
    if (patch.name) this.playerName = patch.name;
    return this.send({ type: 'UPDATE_LOBBY', ...patch });
  }

  startClimb(opts?: Omit<Extract<CoopClientMessage, { type: 'START_CLIMB' }>, 'type'>): boolean {
    return this.send({ type: 'START_CLIMB', ...opts });
  }

  voteNode(
    nodeId: string | null,
    opts?: {
      nodeKind?: CoopNodeKind;
      nextPhase?: Exclude<CoopPhase, 'lobby' | 'map'>;
      confirm?: boolean;
    },
  ): boolean {
    return this.send({ type: 'VOTE_NODE', nodeId, ...opts });
  }

  setPhaseReady(
    ready: boolean,
    opts?: { nextPhase?: CoopPhase; act?: number; floor?: number },
  ): boolean {
    return this.send({ type: 'PHASE_READY', ready, ...opts });
  }

  cancelPreview(): boolean {
    return this.send({ type: 'CANCEL_PREVIEW' });
  }

  startFight(payload: Omit<Extract<CoopClientMessage, { type: 'START_FIGHT' }>, 'type'>): boolean {
    return this.send({ type: 'START_FIGHT', ...payload });
  }

  dealDamage(payload: Omit<Extract<CoopClientMessage, { type: 'DEAL_DAMAGE' }>, 'type'>): boolean {
    return this.send({ type: 'DEAL_DAMAGE', ...payload });
  }

  reportParry(payload: Omit<Extract<CoopClientMessage, { type: 'PARRY_REPORT' }>, 'type'>): boolean {
    return this.send({ type: 'PARRY_REPORT', ...payload });
  }

  reportBoardCounterStatus(hasCounter: boolean): boolean {
    return this.send({ type: 'BOARD_COUNTER_STATUS', hasCounter });
  }

  sendSynergyDelta(deltas: Partial<CoopSynergyCounters>): boolean {
    return this.send({ type: 'SYNERGY_DELTA', deltas });
  }

  updateHearts(hearts: number, opts?: { maxHearts?: number; combo?: number }): boolean {
    return this.send({ type: 'PLAYER_HEART_UPDATE', hearts, ...opts });
  }

  reportFightTimeout(): boolean {
    return this.send({ type: 'FIGHT_TIMEOUT' });
  }

  sendGift(
    kind: CoopGiftKind,
    opts?: { targetPlayerId?: string; shopGift?: CoopShopGiftPayload; label?: string },
  ): boolean {
    return this.send({ type: 'SEND_GIFT', kind, ...opts });
  }

  sendEmote(emote: CoopEmoteKind, text?: string): boolean {
    return this.send({ type: 'EMOTE', emote, text });
  }

  setPhase(
    phase: CoopPhase,
    opts?: { act?: number; floor?: number; currentNodeId?: string | null },
  ): boolean {
    return this.send({ type: 'SET_PHASE', phase, ...opts });
  }

  requestSnapshot(): boolean {
    return this.send({ type: 'REQUEST_SNAPSHOT' });
  }

  // -------------------------------------------------------------------------
  // Internal WebSocket & Lifecycle Plumbing
  // -------------------------------------------------------------------------

  private openSocket(isReconnect: boolean): void {
    if (this.disposed || !this.roomCode) return;

    this.teardownSocket(1000, 'reconnecting');
    this.setStatus(isReconnect ? 'reconnecting' : 'connecting');

    const url = buildCoopWsUrl(this.config, {
      code: this.roomCode,
      playerId: this.playerId,
      name: this.playerName,
      fighter: this.fighter,
      sessionToken: this.sessionToken ?? undefined,
    });

    let socket: CoopWebSocketLike;
    try {
      socket = new this.wsCtor(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open WebSocket';
      this.setStatus('error', message);
      this.emitError('INTERNAL_ERROR', message);
      this.scheduleReconnect();
      return;
    }

    this.ws = socket;

    socket.onopen = () => {
      if (this.ws !== socket || this.disposed) return;
      this.reconnectAttempts = 0;
      this.setStatus('connected');
      if (getIsAppActive()) {
        this.startHeartbeat();
      }
      // Send explicit JOIN so server refreshes fighter/name & returns authoritative SNAPSHOT
      this.send({
        type: 'JOIN',
        playerId: this.playerId,
        name: this.playerName,
        fighter: this.fighter,
        sessionToken: this.sessionToken ?? undefined,
      });
    };

    socket.onmessage = ev => {
      if (this.ws !== socket || this.disposed) return;
      if (ev.data === 'pong') return;
      const msg = parseServerMessage(ev.data);
      if (!msg) return;
      this.handleServerMessage(msg);
    };

    socket.onerror = () => {
      if (this.ws !== socket || this.disposed) return;
      // Close handler manages reconnects cleanly.
    };

    socket.onclose = ev => {
      if (this.ws !== socket) return;
      this.ws = null;
      this.stopHeartbeat();

      if (this.disposed || this.intentionalClose) {
        this.setStatus('disconnected');
        return;
      }

      // Close codes 4000-4099 are permanent application rejections (e.g. room full).
      if (typeof ev?.code === 'number' && ev.code >= 4000 && ev.code < 4100) {
        this.setStatus('error', ev.reason || 'Room rejected connection');
        return;
      }

      if (!getIsAppActive()) {
        this.pendingReconnectOnResume = true;
        this.setStatus('reconnecting', 'Paused while app is in background');
        return;
      }

      this.scheduleReconnect();
    };
  }

  private handleServerMessage(msg: CoopServerMessage): void {
    if (msg.type === 'SNAPSHOT') {
      this.playerId = msg.yourPlayerId;
      this.sessionToken = msg.sessionToken;
      this.applySnapshot(msg.snapshot);
    } else if (msg.type === 'ERROR') {
      this.emitError(msg.code, msg.message);
    } else if (this.snapshot) {
      // Incrementally patch cached snapshot so getters remain current between full SNAPSHOTs
      this.patchSnapshotFromEvent(msg);
    }

    this.messageListeners.forEach(fn => {
      try {
        fn(msg);
      } catch {
        /* isolate listener failures */
      }
    });
  }

  private applySnapshot(next: CoopRoomSnapshot): void {
    this.snapshot = next;
    this.snapshotListeners.forEach(fn => {
      try {
        fn(next);
      } catch {
        /* isolate listener failures */
      }
    });
  }

  private patchSnapshotFromEvent(msg: CoopServerMessage): void {
    if (!this.snapshot) return;
    const cur = this.snapshot;

    switch (msg.type) {
      case 'PLAYER_PRESENCE':
        this.applySnapshot({
          ...cur,
          players: msg.players,
          seq: Math.max(cur.seq, msg.seq),
        });
        break;
      case 'VOTE_UPDATED':
        this.applySnapshot({
          ...cur,
          mapVotes: msg.mapVotes,
          players: cur.players.map(p => ({
            ...p,
            votedNodeId: msg.mapVotes[p.playerId] ?? null,
          })),
          seq: Math.max(cur.seq, msg.seq),
        });
        break;
      case 'NODE_SELECTED':
        this.applySnapshot({
          ...cur,
          currentNodeId: msg.nodeId,
          phase: msg.nextPhase,
          mapVotes: {},
          phaseReady: {},
          players: cur.players.map(p => ({ ...p, votedNodeId: null, phaseReady: false })),
          seq: Math.max(cur.seq, msg.seq),
        });
        break;
      case 'PHASE_READY_UPDATED':
        this.applySnapshot({
          ...cur,
          phaseReady: msg.phaseReady,
          players: cur.players.map(p => ({
            ...p,
            phaseReady: Boolean(msg.phaseReady[p.playerId]),
          })),
          seq: Math.max(cur.seq, msg.seq),
        });
        break;
      case 'PHASE_ADVANCED':
        this.applySnapshot({
          ...cur,
          phase: msg.toPhase,
          act: msg.act,
          floor: msg.floor,
          phaseReady: {},
          players: cur.players.map(p => ({ ...p, phaseReady: false })),
          seq: Math.max(cur.seq, msg.seq),
        });
        break;
      case 'FIGHT_STARTED':
        this.applySnapshot({
          ...cur,
          phase: 'fight',
          fight: msg.fight,
          seq: Math.max(cur.seq, msg.seq),
        });
        break;
      case 'BOSS_DAMAGED':
        if (cur.fight) {
          this.applySnapshot({
            ...cur,
            fight: {
              ...cur.fight,
              bossHp: msg.bossHp,
              bossMaxHp: msg.bossMaxHp,
              damageByPlayer: {
                ...cur.fight.damageByPlayer,
                [msg.fromPlayerId]: (cur.fight.damageByPlayer[msg.fromPlayerId] ?? 0) + msg.amount,
              },
              setsByPlayer: {
                ...cur.fight.setsByPlayer,
                [msg.fromPlayerId]: (cur.fight.setsByPlayer[msg.fromPlayerId] ?? 0) + 1,
              },
            },
            players: cur.players.map(p =>
              p.playerId === msg.fromPlayerId && typeof msg.combo === 'number'
                ? { ...p, combo: msg.combo }
                : p,
            ),
            seq: Math.max(cur.seq, msg.seq),
          });
        }
        break;
      case 'PARRY_SYNC':
        if (cur.fight) {
          this.applySnapshot({
            ...cur,
            fight: {
              ...cur.fight,
              parryPhase: msg.parryPhase,
              parryMsLeft: msg.parryMsLeft,
              parryDurationMs: msg.parryDurationMs,
              fairnessStalled: msg.fairnessStalled,
              parryStallsUsed: msg.parryStallsUsed,
              boardHasCounter: msg.boardHasCounter,
              totalParries: msg.totalParries,
            },
            seq: Math.max(cur.seq, msg.seq),
          });
        }
        break;
      case 'SYNERGY_SYNC':
        if (cur.fight) {
          this.applySnapshot({
            ...cur,
            fight: {
              ...cur.fight,
              synergy: msg.synergy,
            },
            seq: Math.max(cur.seq, msg.seq),
          });
        }
        break;
      case 'PLAYER_CAGED':
        this.applySnapshot({
          ...cur,
          players: cur.players.map(p =>
            p.playerId === msg.playerId
              ? {
                  ...p,
                  hearts: 0,
                  caged: true,
                  rescueProgress: msg.rescueProgress,
                  rescueNeeded: msg.rescueNeeded,
                }
              : p,
          ),
          seq: Math.max(cur.seq, msg.seq),
        });
        break;
      case 'PLAYER_RESCUE_PROGRESS':
        this.applySnapshot({
          ...cur,
          players: cur.players.map(p =>
            p.playerId === msg.playerId
              ? {
                  ...p,
                  rescueProgress: msg.rescueProgress,
                  rescueNeeded: msg.rescueNeeded,
                }
              : p,
          ),
          seq: Math.max(cur.seq, msg.seq),
        });
        break;
      case 'PLAYER_REVIVED':
        this.applySnapshot({
          ...cur,
          players: cur.players.map(p =>
            p.playerId === msg.playerId
              ? {
                  ...p,
                  caged: false,
                  hearts: msg.hearts,
                  rescueProgress: 0,
                }
              : p,
          ),
          seq: Math.max(cur.seq, msg.seq),
        });
        break;
      case 'FIGHT_ENDED':
        this.applySnapshot({
          ...cur,
          phase: msg.nextPhase,
          fight: msg.fight,
          phaseReady: {},
          players: cur.players.map(p => ({ ...p, phaseReady: false })),
          seq: Math.max(cur.seq, msg.seq),
        });
        break;
      default:
        break;
    }
  }

  private handleAppActiveChange(active: boolean): void {
    if (this.disposed) return;

    if (!active) {
      // Immediately pause heartbeat interval & pending reconnect timers in background
      // so the battery watchdog records zero background intervals.
      this.stopHeartbeat();
      if (this.reconnectTimer !== null) {
        this.clearReconnectTimer();
        this.pendingReconnectOnResume = true;
      }
      return;
    }

    // Returned to foreground
    if (this.ws && this.ws.readyState === WS_OPEN) {
      this.startHeartbeat();
      this.requestSnapshot();
      return;
    }

    if (!this.intentionalClose && this.roomCode && this.pendingReconnectOnResume) {
      this.pendingReconnectOnResume = false;
      this.reconnectAttempts = 0;
      this.openSocket(true);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    if (this.disposed || !getIsAppActive() || !this.ws || this.ws.readyState !== WS_OPEN) {
      return;
    }

    this.unregisterHeartbeat = registerInterval('CoopClient.heartbeat');
    this.heartbeatTimer = setInterval(() => {
      if (!getIsAppActive()) {
        this.stopHeartbeat();
        return;
      }
      if (!this.ws || this.ws.readyState !== WS_OPEN) {
        this.stopHeartbeat();
        return;
      }
      try {
        // Plain "ping" matches Cloudflare DO WebSocketRequestResponsePair("ping", "pong")
        this.ws.send('ping');
      } catch {
        this.stopHeartbeat();
      }
    }, this.heartbeatMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.unregisterHeartbeat) {
      this.unregisterHeartbeat();
      this.unregisterHeartbeat = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.intentionalClose || !this.roomCode) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus('error', 'Connection lost — unable to reconnect');
      this.emitError('INTERNAL_ERROR', 'Unable to reconnect to co-op room.');
      return;
    }

    this.reconnectAttempts += 1;
    const delay = Math.min(
      this.maxReconnectDelayMs,
      Math.round(this.baseReconnectDelayMs * Math.pow(1.8, this.reconnectAttempts - 1)),
    );

    this.setStatus('reconnecting', `Reconnecting (attempt ${this.reconnectAttempts})...`);
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.disposed || this.intentionalClose) return;
      if (!getIsAppActive()) {
        this.pendingReconnectOnResume = true;
        return;
      }
      this.openSocket(true);
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private teardownSocket(code: number, reason: string): void {
    const socket = this.ws;
    this.ws = null;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    try {
      socket.close(code, reason);
    } catch {
      /* ignore close failures on already-closed sockets */
    }
  }

  private setStatus(next: CoopConnectionStatus, detail?: string): void {
    if (this.status === next && detail === undefined) return;
    this.status = next;
    this.statusListeners.forEach(fn => {
      try {
        fn(next, detail);
      } catch {
        /* isolate listener failures */
      }
    });
  }

  private emitError(code: string, message: string): void {
    this.errorListeners.forEach(fn => {
      try {
        fn({ code, message });
      } catch {
        /* isolate listener failures */
      }
    });
  }
}
