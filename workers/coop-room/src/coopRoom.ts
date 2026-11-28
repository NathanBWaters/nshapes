import { DurableObject } from 'cloudflare:workers';
import {
  COOP_CAGE_RESCUE_SETS,
  COOP_DEFAULT_MAX_HEARTS,
  COOP_DEFAULT_PARRY_STAGGER_MS,
  COOP_MAX_PLAYERS,
  COOP_MAX_SINGLE_HIT_DAMAGE,
  COOP_PERFECT_PARRY_STAGGER_MS,
  COOP_RECONNECT_GRACE_MS,
  COOP_REVIVE_HEARTS,
  COOP_ROOM_IDLE_TTL_MS,
  createEmptySynergyCounters,
  defaultNextPhaseAfterBarrier,
  isCoopFighterName,
  mapNodeKindToPhase,
  normalizeRoomCode,
  parseClientMessage,
  type CoopClientMessage,
  type CoopErrorCode,
  type CoopFighterName,
  type CoopFightSnapshot,
  type CoopPhase,
  type CoopPlayerInfo,
  type CoopRole,
  type CoopRoomSnapshot,
  type CoopServerMessage,
  type CoopThemePackId,
} from '../../../src/coop/protocol';

export interface Env {
  COOP_ROOM: DurableObjectNamespace<CoopRoom>;
}

interface SocketAttachment {
  playerId: string;
  sessionToken: string;
  code: string;
}

interface RoomStateRow {
  [key: string]: SqlStorageValue;
  id: number;
  code: string;
  phase: string;
  seed: number;
  ascension: number;
  theme_packs: string;
  act: number;
  floor: number;
  current_node_id: string | null;
  created_at: number;
  updated_at: number;
  seq: number;
  fight_json: string | null;
}

interface PlayerRow {
  [key: string]: SqlStorageValue;
  player_id: string;
  role: string;
  name: string;
  fighter: string;
  session_token: string;
  ready: number;
  connected: number;
  last_seen_at: number;
  hearts: number;
  max_hearts: number;
  combo: number;
  caged: number;
  rescue_progress: number;
  rescue_needed: number;
  voted_node_id: string | null;
  phase_ready: number;
  joined_order: number;
}

const BARRIER_PHASES: ReadonlySet<CoopPhase> = new Set([
  'preview',
  'reward',
  'shop',
  'campfire',
  'event',
  'treasure',
  'act_clear',
]);

function generateToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tok_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function generateSeed(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return (bytes[0] & 0x7fffffff) || 1;
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class CoopRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Edge-level ping/pong auto-response so idle heartbeats never wake the DO.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));

    ctx.blockConcurrencyWhile(async () => {
      this.initSchema();
    });
  }

  private initSchema(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS room_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        code TEXT NOT NULL,
        phase TEXT NOT NULL,
        seed INTEGER NOT NULL,
        ascension INTEGER NOT NULL,
        theme_packs TEXT NOT NULL,
        act INTEGER NOT NULL,
        floor INTEGER NOT NULL,
        current_node_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        seq INTEGER NOT NULL,
        fight_json TEXT
      );
      CREATE TABLE IF NOT EXISTS players (
        player_id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        name TEXT NOT NULL,
        fighter TEXT NOT NULL,
        session_token TEXT NOT NULL,
        ready INTEGER NOT NULL,
        connected INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        hearts INTEGER NOT NULL,
        max_hearts INTEGER NOT NULL,
        combo INTEGER NOT NULL,
        caged INTEGER NOT NULL,
        rescue_progress INTEGER NOT NULL,
        rescue_needed INTEGER NOT NULL,
        voted_node_id TEXT,
        phase_ready INTEGER NOT NULL,
        joined_order INTEGER NOT NULL
      );
    `);
  }

  // -------------------------------------------------------------------------
  // RPC Methods (called by Worker HTTP router & tests)
  // -------------------------------------------------------------------------

  /**
   * Initialize a brand-new room with the requested 4-char code.
   * Returns `{ initialized: false }` if the room is already occupied so the
   * caller can retry with a fresh code.
   */
  async initRoom(rawCode: string): Promise<{ initialized: boolean; code: string }> {
    const code = normalizeRoomCode(rawCode);
    if (!code) {
      throw new Error(`Invalid room code: ${rawCode}`);
    }

    const existing = this.getRoomRow();
    const players = this.getPlayerRows();
    if (existing && players.length > 0) {
      return { initialized: false, code: existing.code };
    }

    const now = Date.now();
    if (!existing) {
      this.ctx.storage.sql.exec(
        `INSERT INTO room_state (
          id, code, phase, seed, ascension, theme_packs, act, floor,
          current_node_id, created_at, updated_at, seq, fight_json
        ) VALUES (1, ?, 'lobby', ?, 0, '[]', 1, 1, NULL, ?, ?, 1, NULL)`,
        code,
        generateSeed(),
        now,
        now,
      );
    } else {
      this.ctx.storage.sql.exec(
        `UPDATE room_state SET code = ?, updated_at = ? WHERE id = 1`,
        code,
        now,
      );
    }

    await this.scheduleIdleCleanup(now);
    return { initialized: true, code };
  }

  /** Return the current authoritative room snapshot (or null if uninitialized / cleaned up). */
  async getRoomSnapshot(): Promise<CoopRoomSnapshot | null> {
    const row = this.getRoomRow();
    if (!row) return null;
    return this.buildSnapshot(row, this.getPlayerRows());
  }

  // -------------------------------------------------------------------------
  // HTTP -> WebSocket Upgrade Handler
  // -------------------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return Response.json(
        { error: 'Expected WebSocket upgrade request.' },
        { status: 426 },
      );
    }

    const url = new URL(request.url);
    const match = /^\/room\/([^/]+)\/ws\/?$/i.exec(url.pathname);
    const code = normalizeRoomCode(match ? decodeURIComponent(match[1]) : url.searchParams.get('code'));
    if (!code) {
      return Response.json({ error: 'Invalid room code.' }, { status: 400 });
    }

    const now = Date.now();
    const roomRow = this.ensureRoomRow(code, now);

    const rawPlayerId = url.searchParams.get('playerId')?.trim() || `p_${generateToken().slice(0, 8)}`;
    const playerId = rawPlayerId.slice(0, 64);
    const rawName = url.searchParams.get('name')?.trim() || 'Climber';
    const name = rawName.slice(0, 32);
    const rawFighter = url.searchParams.get('fighter');
    const requestedFighter: CoopFighterName = isCoopFighterName(rawFighter)
      ? rawFighter
      : 'Orange Tabby';
    const providedToken = url.searchParams.get('sessionToken')?.trim() || null;

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    const players = this.getPlayerRows();
    const existingPlayer = players.find(p => p.player_id === playerId);

    // Evict disconnected slots that have expired past the 60s grace window if a new player joins
    let activePlayers = players;
    if (!existingPlayer && players.length >= COOP_MAX_PLAYERS) {
      const expired = players.find(
        p => p.connected === 0 && now - p.last_seen_at > COOP_RECONNECT_GRACE_MS,
      );
      if (expired) {
        this.ctx.storage.sql.exec(`DELETE FROM players WHERE player_id = ?`, expired.player_id);
        activePlayers = this.getPlayerRows();
      }
    }

    if (!existingPlayer && activePlayers.length >= COOP_MAX_PLAYERS) {
      this.ctx.acceptWebSocket(server, ['rejected']);
      this.sendToSocket(server, {
        type: 'ERROR',
        code: 'ROOM_FULL',
        message: 'This Starfall Summit Duo room is already full.',
      });
      try {
        server.close(4001, 'ROOM_FULL');
      } catch {
        /* ignore close errors */
      }
      return new Response(null, { status: 101, webSocket: client });
    }

    // Close any previous open WebSocket for the same playerId (e.g. fast reload reconnect)
    for (const stale of this.ctx.getWebSockets(playerId)) {
      try {
        stale.close(4000, 'replaced_by_reconnect');
      } catch {
        /* ignore */
      }
    }

    let sessionToken: string;
    let presenceEvent: 'joined' | 'reconnected';

    if (existingPlayer) {
      sessionToken = existingPlayer.session_token;
      // Refresh name if explicitly provided; keep existing fighter on reconnect unless changed later
      const nextName = url.searchParams.has('name') && name ? name : existingPlayer.name;
      const nextFighter =
        url.searchParams.has('fighter') && isCoopFighterName(rawFighter)
          ? rawFighter
          : (existingPlayer.fighter as CoopFighterName);

      this.ctx.storage.sql.exec(
        `UPDATE players
         SET name = ?, fighter = ?, connected = 1, last_seen_at = ?
         WHERE player_id = ?`,
        nextName,
        nextFighter,
        now,
        playerId,
      );
      presenceEvent = 'reconnected';
    } else {
      const hasHost = activePlayers.some(p => p.role === 'host');
      const role: CoopRole = hasHost ? 'guest' : 'host';
      const joinedOrder = activePlayers.reduce((max, p) => Math.max(max, p.joined_order), 0) + 1;
      sessionToken = providedToken || generateToken();

      // Default second player to a distinct fighter if none explicitly requested
      let initialFighter: CoopFighterName = requestedFighter;
      if (!url.searchParams.has('fighter') && role === 'guest') {
        const hostFighter = activePlayers[0]?.fighter;
        initialFighter = hostFighter === 'Sly Fox' ? 'Emperor Penguin' : 'Sly Fox';
      }

      this.ctx.storage.sql.exec(
        `INSERT INTO players (
          player_id, role, name, fighter, session_token, ready, connected, last_seen_at,
          hearts, max_hearts, combo, caged, rescue_progress, rescue_needed,
          voted_node_id, phase_ready, joined_order
        ) VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, ?, 0, 0, 0, ?, NULL, 0, ?)`,
        playerId,
        role,
        name,
        initialFighter,
        sessionToken,
        now,
        COOP_DEFAULT_MAX_HEARTS,
        COOP_DEFAULT_MAX_HEARTS,
        COOP_CAGE_RESCUE_SETS,
        joinedOrder,
      );
      presenceEvent = 'joined';
    }

    this.ctx.acceptWebSocket(server, [playerId]);
    const attachment: SocketAttachment = {
      playerId,
      sessionToken,
      code: roomRow.code,
    };
    server.serializeAttachment(attachment);

    const seq = this.bumpRoomSeq(now);
    const snapshot = this.loadSnapshotOrThrow();
    const playerInfo = snapshot.players.find(p => p.playerId === playerId)!;

    await this.scheduleIdleCleanup(now);

    this.sendToSocket(server, {
      type: 'SNAPSHOT',
      snapshot,
      yourPlayerId: playerId,
      sessionToken,
    });

    this.broadcast({
      type: 'PLAYER_PRESENCE',
      player: playerInfo,
      event: presenceEvent,
      players: snapshot.players,
      seq,
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  // -------------------------------------------------------------------------
  // WebSocket Hibernation Handlers
  // -------------------------------------------------------------------------

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const rawText =
      typeof message === 'string' ? message : new TextDecoder().decode(message);

    if (rawText === 'ping') {
      try {
        ws.send('pong');
      } catch {
        /* ignore */
      }
      return;
    }

    const identity = this.getSocketIdentity(ws);
    if (!identity) {
      this.sendError(ws, 'INVALID_MESSAGE', 'Unrecognized WebSocket session.');
      return;
    }

    const parsed = parseClientMessage(rawText);
    if (!parsed) {
      this.sendError(ws, 'INVALID_MESSAGE', 'Malformed or unsupported message payload.');
      return;
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      `UPDATE players SET last_seen_at = ?, connected = 1 WHERE player_id = ?`,
      now,
      identity.playerId,
    );
    await this.scheduleIdleCleanup(now);

    try {
      this.handleMessage(ws, identity, parsed, now);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected co-op room error.';
      this.sendError(ws, 'INTERNAL_ERROR', msg);
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.handleSocketGone(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleSocketGone(ws);
  }

  private async handleSocketGone(ws: WebSocket): Promise<void> {
    const identity = this.getSocketIdentity(ws);
    if (!identity) return;

    // Only mark disconnected if no newer active socket exists for this playerId
    const remaining = this.ctx
      .getWebSockets(identity.playerId)
      .filter(candidate => candidate !== ws);
    if (remaining.length > 0) return;

    const now = Date.now();
    const existing = this.getPlayerRow(identity.playerId);
    if (!existing) return;

    this.ctx.storage.sql.exec(
      `UPDATE players SET connected = 0, last_seen_at = ? WHERE player_id = ?`,
      now,
      identity.playerId,
    );

    const room = this.getRoomRow();
    if (!room) return;

    const seq = this.bumpRoomSeq(now);
    const snapshot = this.loadSnapshotOrThrow();
    const updatedPlayer = snapshot.players.find(p => p.playerId === identity.playerId);

    if (updatedPlayer) {
      this.broadcast(
        {
          type: 'PLAYER_PRESENCE',
          player: updatedPlayer,
          event: 'disconnected',
          players: snapshot.players,
          seq,
        },
        ws,
      );
    }

    await this.scheduleIdleCleanup(now);
  }

  // -------------------------------------------------------------------------
  // Alarm — 30-Minute Inactivity Cleanup
  // -------------------------------------------------------------------------

  async alarm(): Promise<void> {
    const activeSockets = this.ctx
      .getWebSockets()
      .filter(ws => !this.ctx.getTags(ws).includes('rejected'));

    if (activeSockets.length > 0) {
      // Room still has active sockets; defer cleanup by another idle window.
      await this.scheduleIdleCleanup(Date.now());
      return;
    }

    // No connected clients and inactivity alarm fired: clean up room storage.
    this.ctx.storage.sql.exec(`DELETE FROM players;`);
    this.ctx.storage.sql.exec(`DELETE FROM room_state;`);
    await this.ctx.storage.deleteAlarm();
  }

  // -------------------------------------------------------------------------
  // Message Dispatch
  // -------------------------------------------------------------------------

  private handleMessage(
    ws: WebSocket,
    identity: SocketAttachment,
    msg: CoopClientMessage,
    now: number,
  ): void {
    const room = this.getRoomRow();
    const sender = this.getPlayerRow(identity.playerId);
    if (!room || !sender) {
      this.sendError(ws, 'ROOM_NOT_FOUND', 'Room state has expired.');
      return;
    }

    switch (msg.type) {
      case 'JOIN':
        this.onJoin(ws, sender, msg, now);
        return;
      case 'UPDATE_LOBBY':
        this.onUpdateLobby(ws, room, sender, msg, now);
        return;
      case 'START_CLIMB':
        this.onStartClimb(ws, room, sender, msg, now);
        return;
      case 'VOTE_NODE':
        this.onVoteNode(ws, room, sender, msg, now);
        return;
      case 'PHASE_READY':
        this.onPhaseReady(ws, room, sender, msg, now);
        return;
      case 'CANCEL_PREVIEW':
        this.onCancelPreview(ws, room, now);
        return;
      case 'START_FIGHT':
        this.onStartFight(ws, room, msg, now);
        return;
      case 'DEAL_DAMAGE':
        this.onDealDamage(ws, room, sender, msg, now);
        return;
      case 'PARRY_REPORT':
        this.onParryReport(ws, room, sender, msg, now);
        return;
      case 'BOARD_COUNTER_STATUS':
        this.onBoardCounterStatus(ws, room, sender, msg, now);
        return;
      case 'SYNERGY_DELTA':
        this.onSynergyDelta(ws, room, sender, msg, now);
        return;
      case 'PLAYER_HEART_UPDATE':
        this.onPlayerHeartUpdate(room, sender, msg, now);
        return;
      case 'FIGHT_TIMEOUT':
        this.onFightTimeout(room, now);
        return;
      case 'SEND_GIFT':
        this.onSendGift(sender, msg, now);
        return;
      case 'EMOTE':
        this.onEmote(sender, msg, now);
        return;
      case 'SET_PHASE':
        this.onSetPhase(room, msg, now);
        return;
      case 'REQUEST_SNAPSHOT':
        this.sendSnapshotTo(ws, sender);
        return;
    }
  }

  private onJoin(
    ws: WebSocket,
    sender: PlayerRow,
    msg: Extract<CoopClientMessage, { type: 'JOIN' }>,
    now: number,
  ): void {
    const nextName = msg.name || sender.name;
    const nextFighter = msg.fighter ?? (sender.fighter as CoopFighterName);
    this.ctx.storage.sql.exec(
      `UPDATE players SET name = ?, fighter = ?, connected = 1, last_seen_at = ? WHERE player_id = ?`,
      nextName,
      nextFighter,
      now,
      sender.player_id,
    );
    const seq = this.bumpRoomSeq(now);
    const snapshot = this.loadSnapshotOrThrow();
    const updated = snapshot.players.find(p => p.playerId === sender.player_id)!;

    this.sendToSocket(ws, {
      type: 'SNAPSHOT',
      snapshot,
      yourPlayerId: sender.player_id,
      sessionToken: sender.session_token,
    });
    this.broadcast({
      type: 'PLAYER_PRESENCE',
      player: updated,
      event: 'updated',
      players: snapshot.players,
      seq,
    });
  }

  private onUpdateLobby(
    ws: WebSocket,
    room: RoomStateRow,
    sender: PlayerRow,
    msg: Extract<CoopClientMessage, { type: 'UPDATE_LOBBY' }>,
    now: number,
  ): void {
    if (room.phase !== 'lobby') {
      this.sendError(ws, 'INVALID_PHASE', 'Lobby settings can only be edited in the lobby.');
      return;
    }

    const nextFighter = msg.fighter ?? (sender.fighter as CoopFighterName);
    const nextName = msg.name ?? sender.name;
    const nextReady = typeof msg.ready === 'boolean' ? (msg.ready ? 1 : 0) : sender.ready;

    this.ctx.storage.sql.exec(
      `UPDATE players SET fighter = ?, name = ?, ready = ?, last_seen_at = ? WHERE player_id = ?`,
      nextFighter,
      nextName,
      nextReady,
      now,
      sender.player_id,
    );

    if (sender.role === 'host') {
      const nextAscension = typeof msg.ascension === 'number' ? msg.ascension : room.ascension;
      const nextSeed = typeof msg.seed === 'number' ? msg.seed : room.seed;
      const nextThemePacks = Array.isArray(msg.themePacks)
        ? JSON.stringify(msg.themePacks)
        : room.theme_packs;

      this.ctx.storage.sql.exec(
        `UPDATE room_state SET ascension = ?, seed = ?, theme_packs = ?, updated_at = ? WHERE id = 1`,
        nextAscension,
        nextSeed,
        nextThemePacks,
        now,
      );
    }

    const seq = this.bumpRoomSeq(now);
    const snapshot = this.loadSnapshotOrThrow();
    const updatedPlayer = snapshot.players.find(p => p.playerId === sender.player_id)!;

    this.broadcast({
      type: 'PLAYER_PRESENCE',
      player: updatedPlayer,
      event: 'updated',
      players: snapshot.players,
      seq,
    });
    this.broadcastSnapshots(snapshot);
  }

  private onStartClimb(
    ws: WebSocket,
    room: RoomStateRow,
    sender: PlayerRow,
    msg: Extract<CoopClientMessage, { type: 'START_CLIMB' }>,
    now: number,
  ): void {
    if (room.phase !== 'lobby') {
      this.sendError(ws, 'INVALID_PHASE', 'Climb has already started.');
      return;
    }
    if (sender.role !== 'host') {
      this.sendError(ws, 'NOT_HOST', 'Only the host can start the duo climb.');
      return;
    }

    const players = this.getPlayerRows();
    if (players.length === 0 || players.some(p => p.ready !== 1)) {
      this.sendError(ws, 'NOT_READY', 'All climbers must ready up before starting the climb.');
      return;
    }

    const nextSeed = typeof msg.seed === 'number' ? msg.seed : room.seed;
    const nextAscension = typeof msg.ascension === 'number' ? msg.ascension : room.ascension;
    const nextThemePacks = Array.isArray(msg.themePacks)
      ? JSON.stringify(msg.themePacks)
      : room.theme_packs;

    this.ctx.storage.sql.exec(
      `UPDATE room_state
       SET phase = 'map', seed = ?, ascension = ?, theme_packs = ?,
           act = 1, floor = 1, current_node_id = NULL, fight_json = NULL, updated_at = ?
       WHERE id = 1`,
      nextSeed,
      nextAscension,
      nextThemePacks,
      now,
    );
    this.ctx.storage.sql.exec(
      `UPDATE players
       SET voted_node_id = NULL, phase_ready = 0, caged = 0, rescue_progress = 0,
           combo = 0, hearts = max_hearts`,
    );

    const seq = this.bumpRoomSeq(now);
    const snapshot = this.loadSnapshotOrThrow();

    this.broadcast({
      type: 'PHASE_ADVANCED',
      fromPhase: 'lobby',
      toPhase: 'map',
      act: snapshot.act,
      floor: snapshot.floor,
      seq,
    });
    this.broadcastSnapshots(snapshot);
  }

  private onVoteNode(
    ws: WebSocket,
    room: RoomStateRow,
    sender: PlayerRow,
    msg: Extract<CoopClientMessage, { type: 'VOTE_NODE' }>,
    now: number,
  ): void {
    if (room.phase !== 'map') {
      this.sendError(ws, 'INVALID_PHASE', 'Map voting is only allowed on the map phase.');
      return;
    }

    this.ctx.storage.sql.exec(
      `UPDATE players SET voted_node_id = ?, last_seen_at = ? WHERE player_id = ?`,
      msg.nodeId,
      now,
      sender.player_id,
    );

    const players = this.getPlayerRows();
    const unanimous =
      msg.nodeId !== null &&
      players.length > 0 &&
      players.every(p => p.voted_node_id === msg.nodeId);
    const hostConfirmed = Boolean(msg.confirm && sender.role === 'host' && msg.nodeId !== null);

    if (unanimous || hostConfirmed) {
      const selectedNodeId = msg.nodeId!;
      const nextPhase: CoopPhase = msg.nextPhase ?? mapNodeKindToPhase(msg.nodeKind);

      this.ctx.storage.sql.exec(
        `UPDATE room_state SET current_node_id = ?, phase = ?, updated_at = ? WHERE id = 1`,
        selectedNodeId,
        nextPhase,
        now,
      );
      this.ctx.storage.sql.exec(`UPDATE players SET voted_node_id = NULL, phase_ready = 0`);

      const seq = this.bumpRoomSeq(now);
      const snapshot = this.loadSnapshotOrThrow();

      this.broadcast({
        type: 'NODE_SELECTED',
        nodeId: selectedNodeId,
        nextPhase,
        seq,
      });
      this.broadcastSnapshots(snapshot);
      return;
    }

    const seq = this.bumpRoomSeq(now);
    const mapVotes = this.buildMapVotes(players);
    this.broadcast({
      type: 'VOTE_UPDATED',
      mapVotes,
      seq,
    });
  }

  private onPhaseReady(
    ws: WebSocket,
    room: RoomStateRow,
    sender: PlayerRow,
    msg: Extract<CoopClientMessage, { type: 'PHASE_READY' }>,
    now: number,
  ): void {
    const currentPhase = room.phase as CoopPhase;
    if (!BARRIER_PHASES.has(currentPhase)) {
      this.sendError(ws, 'INVALID_PHASE', `Phase '${currentPhase}' does not use a ready barrier.`);
      return;
    }

    this.ctx.storage.sql.exec(
      `UPDATE players SET phase_ready = ?, last_seen_at = ? WHERE player_id = ?`,
      msg.ready ? 1 : 0,
      now,
      sender.player_id,
    );

    const players = this.getPlayerRows();
    const allReady = players.length > 0 && players.every(p => p.phase_ready === 1);

    if (allReady) {
      const toPhase: CoopPhase = msg.nextPhase ?? defaultNextPhaseAfterBarrier(currentPhase);
      const nextAct = typeof msg.act === 'number' ? msg.act : room.act;
      const nextFloor = typeof msg.floor === 'number' ? msg.floor : room.floor;

      this.ctx.storage.sql.exec(
        `UPDATE room_state SET phase = ?, act = ?, floor = ?, updated_at = ? WHERE id = 1`,
        toPhase,
        nextAct,
        nextFloor,
        now,
      );
      this.ctx.storage.sql.exec(`UPDATE players SET phase_ready = 0, voted_node_id = NULL`);

      const seq = this.bumpRoomSeq(now);
      const snapshot = this.loadSnapshotOrThrow();

      this.broadcast({
        type: 'PHASE_ADVANCED',
        fromPhase: currentPhase,
        toPhase,
        act: snapshot.act,
        floor: snapshot.floor,
        seq,
      });
      this.broadcastSnapshots(snapshot);
      return;
    }

    const seq = this.bumpRoomSeq(now);
    this.broadcast({
      type: 'PHASE_READY_UPDATED',
      phase: currentPhase,
      phaseReady: this.buildPhaseReady(players),
      seq,
    });
  }

  private onCancelPreview(ws: WebSocket, room: RoomStateRow, now: number): void {
    if (room.phase !== 'preview') {
      this.sendError(ws, 'INVALID_PHASE', 'Cannot cancel preview outside preview phase.');
      return;
    }

    this.ctx.storage.sql.exec(
      `UPDATE room_state SET phase = 'map', current_node_id = NULL, updated_at = ? WHERE id = 1`,
      now,
    );
    this.ctx.storage.sql.exec(`UPDATE players SET phase_ready = 0, voted_node_id = NULL`);

    const seq = this.bumpRoomSeq(now);
    const snapshot = this.loadSnapshotOrThrow();
    this.broadcast({
      type: 'PHASE_ADVANCED',
      fromPhase: 'preview',
      toPhase: 'map',
      act: snapshot.act,
      floor: snapshot.floor,
      seq,
    });
    this.broadcastSnapshots(snapshot);
  }

  private onStartFight(
    ws: WebSocket,
    room: RoomStateRow,
    msg: Extract<CoopClientMessage, { type: 'START_FIGHT' }>,
    now: number,
  ): void {
    const existingFight = safeJsonParse<CoopFightSnapshot | null>(room.fight_json, null);

    // Idempotent guard: if both clients emit START_FIGHT for the same active fight,
    // keep the already-running authoritative fight intact (never reset Boss HP!).
    if (
      room.phase === 'fight' &&
      existingFight &&
      existingFight.outcome === 'active' &&
      existingFight.nodeId === msg.nodeId &&
      (!msg.fightId || existingFight.fightId === msg.fightId)
    ) {
      const identity = this.getSocketIdentity(ws);
      const player = identity ? this.getPlayerRow(identity.playerId) : null;
      if (player) this.sendSnapshotTo(ws, player);
      return;
    }

    const cooldownMs = msg.parryCooldownMs ?? 8000;
    const fight: CoopFightSnapshot = {
      fightId: msg.fightId ?? `fight_${msg.nodeId}_${now}`,
      nodeId: msg.nodeId,
      foeName: msg.foeName,
      bossHp: msg.bossMaxHp,
      bossMaxHp: msg.bossMaxHp,
      waveIndex: 0,
      totalWaves: msg.totalWaves ?? 1,
      startedAt: now,
      timerSec: msg.timerSec ?? 120,
      parryPhase: 'calm',
      parryMsLeft: cooldownMs,
      parryDurationMs: cooldownMs,
      parryStallsUsed: 0,
      boardHasCounter: {},
      fairnessStalled: false,
      synergy: createEmptySynergyCounters(),
      damageByPlayer: {},
      setsByPlayer: {},
      totalParries: 0,
      outcome: 'active',
    };

    this.ctx.storage.sql.exec(
      `UPDATE room_state
       SET phase = 'fight', current_node_id = ?, fight_json = ?, updated_at = ?
       WHERE id = 1`,
      msg.nodeId,
      JSON.stringify(fight),
      now,
    );
    this.ctx.storage.sql.exec(
      `UPDATE players
       SET phase_ready = 0, voted_node_id = NULL, caged = 0, rescue_progress = 0,
           combo = 0, hearts = CASE WHEN hearts <= 0 THEN 1 ELSE hearts END`,
    );

    const seq = this.bumpRoomSeq(now);
    const snapshot = this.loadSnapshotOrThrow();

    this.broadcast({
      type: 'FIGHT_STARTED',
      fight,
      seq,
    });
    this.broadcastSnapshots(snapshot);
  }

  private onDealDamage(
    ws: WebSocket,
    room: RoomStateRow,
    sender: PlayerRow,
    msg: Extract<CoopClientMessage, { type: 'DEAL_DAMAGE' }>,
    now: number,
  ): void {
    const fight = safeJsonParse<CoopFightSnapshot | null>(room.fight_json, null);
    if (room.phase !== 'fight' || !fight || fight.outcome !== 'active') {
      this.sendError(ws, 'INVALID_PHASE', 'No active fight to apply damage to.');
      return;
    }
    if (sender.caged === 1) {
      return;
    }

    const amount = Math.min(COOP_MAX_SINGLE_HIT_DAMAGE, Math.max(0, Math.round(msg.amount)));
    fight.bossHp = Math.max(0, fight.bossHp - amount);
    fight.damageByPlayer[sender.player_id] = (fight.damageByPlayer[sender.player_id] ?? 0) + amount;
    fight.setsByPlayer[sender.player_id] = (fight.setsByPlayer[sender.player_id] ?? 0) + 1;

    if (typeof msg.combo === 'number') {
      this.ctx.storage.sql.exec(
        `UPDATE players SET combo = ?, last_seen_at = ? WHERE player_id = ?`,
        msg.combo,
        now,
        sender.player_id,
      );
    }

    // Golden Cage rescue progress: each valid Set (amount > 0) from uncaged ally advances rescue by 1
    const rescueEvents: CoopServerMessage[] = [];
    if (amount > 0) {
      const players = this.getPlayerRows();
      for (const ally of players) {
        if (ally.player_id === sender.player_id || ally.caged !== 1) continue;
        const nextProgress = ally.rescue_progress + 1;
        if (nextProgress >= ally.rescue_needed) {
          const revivedHearts = Math.min(COOP_REVIVE_HEARTS, ally.max_hearts);
          this.ctx.storage.sql.exec(
            `UPDATE players SET caged = 0, rescue_progress = 0, hearts = ? WHERE player_id = ?`,
            revivedHearts,
            ally.player_id,
          );
          rescueEvents.push({
            type: 'PLAYER_REVIVED',
            playerId: ally.player_id,
            rescuerPlayerId: sender.player_id,
            hearts: revivedHearts,
            reason: 'ally_sets',
            seq: 0,
          });
        } else {
          this.ctx.storage.sql.exec(
            `UPDATE players SET rescue_progress = ? WHERE player_id = ?`,
            nextProgress,
            ally.player_id,
          );
          rescueEvents.push({
            type: 'PLAYER_RESCUE_PROGRESS',
            playerId: ally.player_id,
            rescuerPlayerId: sender.player_id,
            rescueProgress: nextProgress,
            rescueNeeded: ally.rescue_needed,
            seq: 0,
          });
        }
      }
    }

    const lethal = fight.bossHp === 0;
    if (lethal) {
      fight.outcome = 'victory';
      // Revive any caged climber on fight victory so they can draft rewards & continue
      for (const p of this.getPlayerRows()) {
        if (p.caged === 1) {
          const revivedHearts = Math.max(1, Math.min(COOP_REVIVE_HEARTS, p.max_hearts));
          this.ctx.storage.sql.exec(
            `UPDATE players SET caged = 0, rescue_progress = 0, hearts = ? WHERE player_id = ?`,
            revivedHearts,
            p.player_id,
          );
          rescueEvents.push({
            type: 'PLAYER_REVIVED',
            playerId: p.player_id,
            hearts: revivedHearts,
            reason: 'fight_won',
            seq: 0,
          });
        }
      }
      this.ctx.storage.sql.exec(
        `UPDATE room_state SET phase = 'reward', fight_json = ?, updated_at = ? WHERE id = 1`,
        JSON.stringify(fight),
        now,
      );
      this.ctx.storage.sql.exec(`UPDATE players SET phase_ready = 0`);
    } else {
      this.saveFight(fight, now);
    }

    const seq = this.bumpRoomSeq(now);
    this.broadcast({
      type: 'BOSS_DAMAGED',
      fromPlayerId: sender.player_id,
      amount,
      bossHp: fight.bossHp,
      bossMaxHp: fight.bossMaxHp,
      combo: msg.combo,
      isRainbow: msg.isRainbow,
      isPerfect: msg.isPerfect,
      label: msg.label,
      lethal,
      seq,
    });

    for (const ev of rescueEvents) {
      this.broadcast({ ...ev, seq } as CoopServerMessage);
    }

    if (lethal) {
      const snapshot = this.loadSnapshotOrThrow();
      this.broadcast({
        type: 'FIGHT_ENDED',
        outcome: 'victory',
        reason: 'boss_ko',
        fight,
        nextPhase: 'reward',
        seq,
      });
      this.broadcastSnapshots(snapshot);
    }
  }

  private onParryReport(
    ws: WebSocket,
    room: RoomStateRow,
    sender: PlayerRow,
    msg: Extract<CoopClientMessage, { type: 'PARRY_REPORT' }>,
    now: number,
  ): void {
    const fight = safeJsonParse<CoopFightSnapshot | null>(room.fight_json, null);
    if (room.phase !== 'fight' || !fight || fight.outcome !== 'active') {
      this.sendError(ws, 'INVALID_PHASE', 'No active fight for parry update.');
      return;
    }

    if (msg.kind === 'windup_start') {
      const durationMs = msg.durationMs ?? msg.msLeft ?? 5000;
      fight.parryPhase = 'windup';
      fight.parryDurationMs = durationMs;
      fight.parryMsLeft = msg.msLeft ?? durationMs;
      fight.boardHasCounter = {};
      fight.fairnessStalled = false;
      this.saveFight(fight, now);
      const seq = this.bumpRoomSeq(now);
      this.broadcast({
        type: 'PARRY_SYNC',
        fromPlayerId: sender.player_id,
        kind: 'windup_start',
        parryPhase: fight.parryPhase,
        parryMsLeft: fight.parryMsLeft,
        parryDurationMs: fight.parryDurationMs,
        fairnessStalled: fight.fairnessStalled,
        parryStallsUsed: fight.parryStallsUsed,
        boardHasCounter: fight.boardHasCounter,
        totalParries: fight.totalParries,
        seq,
      });
      return;
    }

    if (msg.kind === 'windup_expired') {
      const durationMs = msg.durationMs ?? msg.msLeft ?? 8000;
      fight.parryPhase = 'calm';
      fight.parryDurationMs = durationMs;
      fight.parryMsLeft = msg.msLeft ?? durationMs;
      fight.boardHasCounter = {};
      fight.fairnessStalled = false;
      this.saveFight(fight, now);
      const seq = this.bumpRoomSeq(now);
      this.broadcast({
        type: 'PARRY_SYNC',
        fromPlayerId: sender.player_id,
        kind: 'windup_expired',
        parryPhase: fight.parryPhase,
        parryMsLeft: fight.parryMsLeft,
        parryDurationMs: fight.parryDurationMs,
        fairnessStalled: fight.fairnessStalled,
        parryStallsUsed: fight.parryStallsUsed,
        boardHasCounter: fight.boardHasCounter,
        totalParries: fight.totalParries,
        seq,
      });
      return;
    }

    // Cross-Parry ('parry' | 'perfect')
    if (sender.caged === 1) return;

    const staggerMs =
      msg.staggerMs ??
      (msg.kind === 'perfect' ? COOP_PERFECT_PARRY_STAGGER_MS : COOP_DEFAULT_PARRY_STAGGER_MS);

    fight.parryPhase = 'staggered';
    fight.parryDurationMs = staggerMs;
    fight.parryMsLeft = staggerMs;
    fight.boardHasCounter = {};
    fight.fairnessStalled = false;
    fight.totalParries += 1;
    fight.synergy.parries += 1;
    this.saveFight(fight, now);

    // 1 ally parry immediately breaks a caged partner out of the Golden Cage!
    const revived: Array<{ playerId: string; hearts: number }> = [];
    for (const ally of this.getPlayerRows()) {
      if (ally.player_id === sender.player_id || ally.caged !== 1) continue;
      const revivedHearts = Math.min(COOP_REVIVE_HEARTS, ally.max_hearts);
      this.ctx.storage.sql.exec(
        `UPDATE players SET caged = 0, rescue_progress = 0, hearts = ? WHERE player_id = ?`,
        revivedHearts,
        ally.player_id,
      );
      revived.push({ playerId: ally.player_id, hearts: revivedHearts });
    }

    const seq = this.bumpRoomSeq(now);
    this.broadcast({
      type: 'PARRY_SYNC',
      fromPlayerId: sender.player_id,
      kind: msg.kind,
      parryPhase: fight.parryPhase,
      parryMsLeft: fight.parryMsLeft,
      parryDurationMs: fight.parryDurationMs,
      fairnessStalled: fight.fairnessStalled,
      parryStallsUsed: fight.parryStallsUsed,
      boardHasCounter: fight.boardHasCounter,
      totalParries: fight.totalParries,
      seq,
    });
    this.broadcast({
      type: 'SYNERGY_SYNC',
      fromPlayerId: sender.player_id,
      deltas: { parries: 1 },
      synergy: fight.synergy,
      seq,
    });

    for (const r of revived) {
      this.broadcast({
        type: 'PLAYER_REVIVED',
        playerId: r.playerId,
        rescuerPlayerId: sender.player_id,
        hearts: r.hearts,
        reason: 'ally_parry',
        seq,
      });
    }
  }

  private onBoardCounterStatus(
    ws: WebSocket,
    room: RoomStateRow,
    sender: PlayerRow,
    msg: Extract<CoopClientMessage, { type: 'BOARD_COUNTER_STATUS' }>,
    now: number,
  ): void {
    const fight = safeJsonParse<CoopFightSnapshot | null>(room.fight_json, null);
    if (room.phase !== 'fight' || !fight || fight.outcome !== 'active') {
      this.sendError(ws, 'INVALID_PHASE', 'No active fight for board counter status.');
      return;
    }

    fight.boardHasCounter[sender.player_id] = msg.hasCounter;
    const prevStalled = fight.fairnessStalled;
    const nextStalled = this.computeFairnessStalled(fight, this.getPlayerRows());
    fight.fairnessStalled = nextStalled;
    if (!prevStalled && nextStalled) {
      fight.parryStallsUsed += 1;
    }

    this.saveFight(fight, now);
    const seq = this.bumpRoomSeq(now);

    this.broadcast({
      type: 'PARRY_SYNC',
      fromPlayerId: sender.player_id,
      kind: 'counter_status',
      parryPhase: fight.parryPhase,
      parryMsLeft: fight.parryMsLeft,
      parryDurationMs: fight.parryDurationMs,
      fairnessStalled: fight.fairnessStalled,
      parryStallsUsed: fight.parryStallsUsed,
      boardHasCounter: fight.boardHasCounter,
      totalParries: fight.totalParries,
      seq,
    });
  }

  private onSynergyDelta(
    ws: WebSocket,
    room: RoomStateRow,
    sender: PlayerRow,
    msg: Extract<CoopClientMessage, { type: 'SYNERGY_DELTA' }>,
    now: number,
  ): void {
    const fight = safeJsonParse<CoopFightSnapshot | null>(room.fight_json, null);
    if (room.phase !== 'fight' || !fight || fight.outcome !== 'active') {
      this.sendError(ws, 'INVALID_PHASE', 'No active fight for synergy sync.');
      return;
    }

    for (const [key, delta] of Object.entries(msg.deltas)) {
      if (typeof delta === 'number' && delta > 0) {
        const attr = key as keyof typeof fight.synergy;
        fight.synergy[attr] = (fight.synergy[attr] ?? 0) + delta;
      }
    }

    this.saveFight(fight, now);
    const seq = this.bumpRoomSeq(now);

    this.broadcast({
      type: 'SYNERGY_SYNC',
      fromPlayerId: sender.player_id,
      deltas: msg.deltas,
      synergy: fight.synergy,
      seq,
    });
  }

  private onPlayerHeartUpdate(
    room: RoomStateRow,
    sender: PlayerRow,
    msg: Extract<CoopClientMessage, { type: 'PLAYER_HEART_UPDATE' }>,
    now: number,
  ): void {
    const maxHearts = typeof msg.maxHearts === 'number' ? msg.maxHearts : sender.max_hearts;
    const clampedHearts = Math.max(0, Math.min(maxHearts, msg.hearts));
    const nextCombo = typeof msg.combo === 'number' ? msg.combo : sender.combo;

    const fight = safeJsonParse<CoopFightSnapshot | null>(room.fight_json, null);
    const inActiveFight = room.phase === 'fight' && fight !== null && fight.outcome === 'active';

    let newlyCaged = false;
    let cagedFlag = sender.caged;
    let rescueProgress = sender.rescue_progress;

    if (inActiveFight && clampedHearts === 0 && sender.caged === 0) {
      newlyCaged = true;
      cagedFlag = 1;
      rescueProgress = 0;
    }

    this.ctx.storage.sql.exec(
      `UPDATE players
       SET hearts = ?, max_hearts = ?, combo = ?, caged = ?, rescue_progress = ?, last_seen_at = ?
       WHERE player_id = ?`,
      clampedHearts,
      maxHearts,
      nextCombo,
      cagedFlag,
      rescueProgress,
      now,
      sender.player_id,
    );

    const playersAfter = this.getPlayerRows();
    const bothCagedDefeat =
      inActiveFight &&
      fight !== null &&
      playersAfter.length > 0 &&
      playersAfter.every(p => p.caged === 1);

    if (bothCagedDefeat && fight) {
      fight.outcome = 'defeat';
      fight.defeatReason = 'both_caged';
      this.ctx.storage.sql.exec(
        `UPDATE room_state SET phase = 'defeat', fight_json = ?, updated_at = ? WHERE id = 1`,
        JSON.stringify(fight),
        now,
      );
    } else if (newlyCaged && fight && fight.parryPhase === 'windup') {
      fight.fairnessStalled = this.computeFairnessStalled(fight, playersAfter);
      this.saveFight(fight, now);
    }

    const seq = this.bumpRoomSeq(now);
    const snapshot = this.loadSnapshotOrThrow();
    const updatedPlayer = snapshot.players.find(p => p.playerId === sender.player_id)!;

    if (newlyCaged) {
      this.broadcast({
        type: 'PLAYER_CAGED',
        playerId: sender.player_id,
        rescueProgress: 0,
        rescueNeeded: sender.rescue_needed,
        seq,
      });
    }

    this.broadcast({
      type: 'PLAYER_PRESENCE',
      player: updatedPlayer,
      event: 'updated',
      players: snapshot.players,
      seq,
    });

    if (bothCagedDefeat && fight) {
      this.broadcast({
        type: 'FIGHT_ENDED',
        outcome: 'defeat',
        reason: 'both_caged',
        fight,
        nextPhase: 'defeat',
        seq,
      });
      this.broadcastSnapshots(snapshot);
    }
  }

  private onFightTimeout(room: RoomStateRow, now: number): void {
    const fight = safeJsonParse<CoopFightSnapshot | null>(room.fight_json, null);
    if (room.phase !== 'fight' || !fight || fight.outcome !== 'active') return;

    fight.outcome = 'defeat';
    fight.defeatReason = 'timeout';
    this.ctx.storage.sql.exec(
      `UPDATE room_state SET phase = 'defeat', fight_json = ?, updated_at = ? WHERE id = 1`,
      JSON.stringify(fight),
      now,
    );

    const seq = this.bumpRoomSeq(now);
    const snapshot = this.loadSnapshotOrThrow();
    this.broadcast({
      type: 'FIGHT_ENDED',
      outcome: 'defeat',
      reason: 'timeout',
      fight,
      nextPhase: 'defeat',
      seq,
    });
    this.broadcastSnapshots(snapshot);
  }

  private onSendGift(
    sender: PlayerRow,
    msg: Extract<CoopClientMessage, { type: 'SEND_GIFT' }>,
    now: number,
  ): void {
    const players = this.getPlayerRows();
    const target = msg.targetPlayerId
      ? players.find(p => p.player_id === msg.targetPlayerId)
      : players.find(p => p.player_id !== sender.player_id);

    if (!target) return;

    // Apply authoritative heart heal for heal gifts / shop heal gifts when target is uncaged
    let healedTarget = false;
    const isHealGift =
      msg.kind === 'heal' ||
      (msg.kind === 'shop_gift' && msg.shopGift?.giftType === 'heal');

    if (isHealGift && target.caged === 0) {
      const healAmount = msg.shopGift?.healAmount ?? 1;
      const nextHearts = Math.min(target.max_hearts, target.hearts + healAmount);
      if (nextHearts !== target.hearts) {
        this.ctx.storage.sql.exec(
          `UPDATE players SET hearts = ?, last_seen_at = ? WHERE player_id = ?`,
          nextHearts,
          now,
          target.player_id,
        );
        healedTarget = true;
      }
    }

    const seq = this.bumpRoomSeq(now);
    this.broadcast({
      type: 'GIFT_RECEIVED',
      fromPlayerId: sender.player_id,
      toPlayerId: target.player_id,
      kind: msg.kind,
      shopGift: msg.shopGift,
      label: msg.label,
      seq,
    });

    if (healedTarget) {
      const snapshot = this.loadSnapshotOrThrow();
      const updatedTarget = snapshot.players.find(p => p.playerId === target.player_id)!;
      this.broadcast({
        type: 'PLAYER_PRESENCE',
        player: updatedTarget,
        event: 'updated',
        players: snapshot.players,
        seq,
      });
    }
  }

  private onEmote(
    sender: PlayerRow,
    msg: Extract<CoopClientMessage, { type: 'EMOTE' }>,
    now: number,
  ): void {
    const seq = this.bumpRoomSeq(now);
    this.broadcast({
      type: 'EMOTE_RECEIVED',
      fromPlayerId: sender.player_id,
      emote: msg.emote,
      text: msg.text,
      sentAt: now,
      seq,
    });
  }

  private onSetPhase(
    room: RoomStateRow,
    msg: Extract<CoopClientMessage, { type: 'SET_PHASE' }>,
    now: number,
  ): void {
    const fromPhase = room.phase as CoopPhase;
    const nextAct = typeof msg.act === 'number' ? msg.act : room.act;
    const nextFloor = typeof msg.floor === 'number' ? msg.floor : room.floor;
    const nextNodeId =
      msg.currentNodeId !== undefined ? msg.currentNodeId : room.current_node_id;
    const resetFight = msg.phase === 'lobby' ? null : room.fight_json;

    this.ctx.storage.sql.exec(
      `UPDATE room_state
       SET phase = ?, act = ?, floor = ?, current_node_id = ?, fight_json = ?, updated_at = ?
       WHERE id = 1`,
      msg.phase,
      nextAct,
      nextFloor,
      nextNodeId,
      resetFight,
      now,
    );

    if (msg.phase === 'lobby') {
      this.ctx.storage.sql.exec(
        `UPDATE players SET ready = 0, phase_ready = 0, voted_node_id = NULL, caged = 0, rescue_progress = 0`,
      );
    } else {
      this.ctx.storage.sql.exec(`UPDATE players SET phase_ready = 0, voted_node_id = NULL`);
    }

    const seq = this.bumpRoomSeq(now);
    const snapshot = this.loadSnapshotOrThrow();
    this.broadcast({
      type: 'PHASE_ADVANCED',
      fromPhase,
      toPhase: msg.phase,
      act: snapshot.act,
      floor: snapshot.floor,
      seq,
    });
    this.broadcastSnapshots(snapshot);
  }

  // -------------------------------------------------------------------------
  // SQLite & Broadcast Helpers
  // -------------------------------------------------------------------------

  private ensureRoomRow(code: string, now: number): RoomStateRow {
    const existing = this.getRoomRow();
    if (existing) return existing;

    this.ctx.storage.sql.exec(
      `INSERT INTO room_state (
        id, code, phase, seed, ascension, theme_packs, act, floor,
        current_node_id, created_at, updated_at, seq, fight_json
      ) VALUES (1, ?, 'lobby', ?, 0, '[]', 1, 1, NULL, ?, ?, 1, NULL)`,
      code,
      generateSeed(),
      now,
      now,
    );
    return this.getRoomRow()!;
  }

  private getRoomRow(): RoomStateRow | null {
    const rows = this.ctx.storage.sql
      .exec<RoomStateRow>(`SELECT * FROM room_state WHERE id = 1`)
      .toArray();
    return rows[0] ?? null;
  }

  private getPlayerRows(): PlayerRow[] {
    return this.ctx.storage.sql
      .exec<PlayerRow>(`SELECT * FROM players ORDER BY joined_order ASC`)
      .toArray();
  }

  private getPlayerRow(playerId: string): PlayerRow | null {
    const rows = this.ctx.storage.sql
      .exec<PlayerRow>(`SELECT * FROM players WHERE player_id = ?`, playerId)
      .toArray();
    return rows[0] ?? null;
  }

  private saveFight(fight: CoopFightSnapshot, now: number): void {
    this.ctx.storage.sql.exec(
      `UPDATE room_state SET fight_json = ?, updated_at = ? WHERE id = 1`,
      JSON.stringify(fight),
      now,
    );
  }

  private bumpRoomSeq(now: number): number {
    const rows = this.ctx.storage.sql
      .exec<{ seq: number }>(
        `UPDATE room_state SET seq = seq + 1, updated_at = ? WHERE id = 1 RETURNING seq`,
        now,
      )
      .toArray();
    return rows[0]?.seq ?? 1;
  }

  private computeFairnessStalled(fight: CoopFightSnapshot, players: PlayerRow[]): boolean {
    if (fight.parryPhase !== 'windup') return false;
    const activeUncaged = players.filter(p => p.connected === 1 && p.caged === 0);
    if (activeUncaged.length === 0) return false;
    return activeUncaged.every(p => fight.boardHasCounter[p.player_id] === false);
  }

  private buildMapVotes(players: PlayerRow[]): Record<string, string | null> {
    const votes: Record<string, string | null> = {};
    for (const p of players) {
      votes[p.player_id] = p.voted_node_id;
    }
    return votes;
  }

  private buildPhaseReady(players: PlayerRow[]): Record<string, boolean> {
    const ready: Record<string, boolean> = {};
    for (const p of players) {
      ready[p.player_id] = p.phase_ready === 1;
    }
    return ready;
  }

  private rowToPlayerInfo(row: PlayerRow): CoopPlayerInfo {
    return {
      playerId: row.player_id,
      role: row.role as CoopRole,
      name: row.name,
      fighter: row.fighter as CoopFighterName,
      ready: row.ready === 1,
      connected: row.connected === 1,
      lastSeenAt: row.last_seen_at,
      hearts: row.hearts,
      maxHearts: row.max_hearts,
      combo: row.combo,
      caged: row.caged === 1,
      rescueProgress: row.rescue_progress,
      rescueNeeded: row.rescue_needed,
      votedNodeId: row.voted_node_id,
      phaseReady: row.phase_ready === 1,
    };
  }

  private buildSnapshot(room: RoomStateRow, players: PlayerRow[]): CoopRoomSnapshot {
    return {
      code: room.code,
      phase: room.phase as CoopPhase,
      createdAt: room.created_at,
      updatedAt: room.updated_at,
      seed: room.seed,
      ascension: room.ascension,
      themePacks: safeJsonParse<CoopThemePackId[]>(room.theme_packs, []),
      act: room.act,
      floor: room.floor,
      currentNodeId: room.current_node_id,
      players: players.map(p => this.rowToPlayerInfo(p)),
      mapVotes: this.buildMapVotes(players),
      phaseReady: this.buildPhaseReady(players),
      fight: safeJsonParse<CoopFightSnapshot | null>(room.fight_json, null),
      seq: room.seq,
    };
  }

  private loadSnapshotOrThrow(): CoopRoomSnapshot {
    const room = this.getRoomRow();
    if (!room) {
      throw new Error('CoopRoom state missing.');
    }
    return this.buildSnapshot(room, this.getPlayerRows());
  }

  private getSocketIdentity(ws: WebSocket): SocketAttachment | null {
    const attached = ws.deserializeAttachment() as SocketAttachment | null | undefined;
    if (attached && typeof attached.playerId === 'string') {
      return attached;
    }
    const tags = this.ctx.getTags(ws);
    if (tags.length > 0 && tags[0] !== 'rejected') {
      const player = this.getPlayerRow(tags[0]);
      const room = this.getRoomRow();
      if (player && room) {
        return {
          playerId: player.player_id,
          sessionToken: player.session_token,
          code: room.code,
        };
      }
    }
    return null;
  }

  private sendToSocket(ws: WebSocket, msg: CoopServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* socket already closing */
    }
  }

  private sendError(ws: WebSocket, code: CoopErrorCode, message: string): void {
    this.sendToSocket(ws, { type: 'ERROR', code, message });
  }

  private sendSnapshotTo(ws: WebSocket, player: PlayerRow): void {
    const snapshot = this.loadSnapshotOrThrow();
    this.sendToSocket(ws, {
      type: 'SNAPSHOT',
      snapshot,
      yourPlayerId: player.player_id,
      sessionToken: player.session_token,
    });
  }

  private broadcastSnapshots(snapshot: CoopRoomSnapshot): void {
    const playersById = new Map(this.getPlayerRows().map(p => [p.player_id, p]));
    for (const ws of this.ctx.getWebSockets()) {
      const identity = this.getSocketIdentity(ws);
      if (!identity) continue;
      const player = playersById.get(identity.playerId);
      if (!player) continue;
      this.sendToSocket(ws, {
        type: 'SNAPSHOT',
        snapshot,
        yourPlayerId: player.player_id,
        sessionToken: player.session_token,
      });
    }
  }

  private broadcast(msg: CoopServerMessage, exclude?: WebSocket): void {
    const serialized = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === exclude) continue;
      if (this.ctx.getTags(ws).includes('rejected')) continue;
      try {
        ws.send(serialized);
      } catch {
        /* ignore closed sockets */
      }
    }
  }

  private async scheduleIdleCleanup(now: number): Promise<void> {
    await this.ctx.storage.setAlarm(now + COOP_ROOM_IDLE_TTL_MS);
  }
}
