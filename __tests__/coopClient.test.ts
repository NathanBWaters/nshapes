import { __setAppActiveForTests } from '@/utils/appLifecycle';
import { getPerfSnapshot, resetPerfViolations } from '@/utils/perfWatchdog';
import {
  COOP_CODE_ALPHABET,
  COOP_MAX_SINGLE_HIT_DAMAGE,
  CoopClient,
  buildCoopWsUrl,
  checkCoopServerHealth,
  createCoopRoom,
  createEmptySynergyCounters,
  generateRoomCode,
  isStrictRoomCode,
  normalizeRoomCode,
  parseClientMessage,
  parseServerMessage,
  resolveCoopServerConfig,
  type CoopRoomSnapshot,
  type CoopServerMessage,
  type CoopWebSocketLike,
} from '@/coop';

class MockWebSocket implements CoopWebSocketLike {
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = 0; // CONNECTING
  sent: string[] = [];
  closedWith: { code?: number; reason?: string } | null = null;

  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: { code?: number; reason?: string; wasClean?: boolean }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3;
    this.closedWith = { code, reason };
  }

  simulateOpen(): void {
    this.readyState = 1;
    this.onopen?.({});
  }

  simulateMessage(payload: CoopServerMessage | string): void {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.onmessage?.({ data });
  }

  simulateClose(code = 1006, reason = 'network_drop'): void {
    this.readyState = 3;
    this.onclose?.({ code, reason, wasClean: code === 1000 });
  }
}

function makeSnapshot(overrides: Partial<CoopRoomSnapshot> = {}): CoopRoomSnapshot {
  return {
    code: 'K7NP',
    phase: 'lobby',
    createdAt: 1000,
    updatedAt: 1000,
    seed: 4242,
    ascension: 0,
    themePacks: ['pyro_blasts', 'webs_echoes'],
    act: 1,
    floor: 1,
    currentNodeId: null,
    players: [
      {
        playerId: 'host-1',
        role: 'host',
        name: 'Tabby',
        fighter: 'Orange Tabby',
        ready: false,
        connected: true,
        lastSeenAt: 1000,
        hearts: 5,
        maxHearts: 5,
        combo: 0,
        caged: false,
        rescueProgress: 0,
        rescueNeeded: 3,
        votedNodeId: null,
        phaseReady: false,
      },
    ],
    mapVotes: { 'host-1': null },
    phaseReady: { 'host-1': false },
    fight: null,
    seq: 1,
    ...overrides,
  };
}

describe('Co-Op protocol validators & room codes', () => {
  it('generates 4-char unambiguous uppercase codes without I, O, 0, or 1', () => {
    for (let i = 0; i < 64; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(4);
      expect(isStrictRoomCode(code)).toBe(true);
      expect(code).not.toMatch(/[IO01]/);
      for (const ch of code) {
        expect(COOP_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it('normalizes valid 4-char codes and rejects malformed ones', () => {
    expect(normalizeRoomCode(' fox7 ')).toBe('FOX7');
    expect(normalizeRoomCode('k7-np')).toBe('K7NP');
    expect(normalizeRoomCode('AB')).toBeNull();
    expect(normalizeRoomCode('ABCDE')).toBeNull();
    expect(normalizeRoomCode(null)).toBeNull();
  });

  it('validates and clamps client messages safely', () => {
    const dmg = parseClientMessage({ type: 'DEAL_DAMAGE', amount: 999999, combo: 4, isRainbow: true });
    expect(dmg).toEqual({
      type: 'DEAL_DAMAGE',
      amount: COOP_MAX_SINGLE_HIT_DAMAGE,
      combo: 4,
      isRainbow: true,
    });

    expect(parseClientMessage({ type: 'DEAL_DAMAGE', amount: -5 })).toBeNull();
    expect(parseClientMessage({ type: 'UNKNOWN_OP' })).toBeNull();
    expect(parseClientMessage('not-json')).toBeNull();

    const syn = parseClientMessage({
      type: 'SYNERGY_DELTA',
      deltas: { burn: 3, links: 2, invalid_key: 99, holo: -4 },
    });
    expect(syn).toEqual({
      type: 'SYNERGY_DELTA',
      deltas: { burn: 3, links: 2 },
    });

    const gift = parseClientMessage({
      type: 'SEND_GIFT',
      kind: 'shop_gift',
      shopGift: { giftType: 'weapon', weaponId: 'blast-powder', weaponLevel: 2 },
    });
    expect(gift).toEqual({
      type: 'SEND_GIFT',
      kind: 'shop_gift',
      shopGift: { giftType: 'weapon', weaponId: 'blast-powder', weaponLevel: 2 },
    });
  });

  it('validates server messages', () => {
    const snap = makeSnapshot();
    const parsed = parseServerMessage(
      JSON.stringify({ type: 'SNAPSHOT', snapshot: snap, yourPlayerId: 'host-1', sessionToken: 'tok-1' }),
    );
    expect(parsed?.type).toBe('SNAPSHOT');
    expect(parseServerMessage({ type: 'SNAPSHOT' })).toBeNull();
    expect(parseServerMessage({ type: 'BOGUS' })).toBeNull();
  });
});

describe('Co-Op server URL config resolution', () => {
  it('prioritizes explicit > query > env > local dev fallback', () => {
    const explicit = resolveCoopServerConfig({
      explicitServerUrl: 'wss://coop.example.com/v1/',
      querySearch: '?coopServer=http://127.0.0.1:9999',
      envUrl: 'https://env.example.com',
    });
    expect(explicit).toEqual({
      httpBaseUrl: 'https://coop.example.com/v1',
      wsBaseUrl: 'wss://coop.example.com/v1',
      source: 'explicit',
    });

    const fromQuery = resolveCoopServerConfig({
      querySearch: '?mode=summit&coop=FOX7&coopServer=http://127.0.0.1:8787',
      envUrl: 'https://env.example.com',
    });
    expect(fromQuery).toEqual({
      httpBaseUrl: 'http://127.0.0.1:8787',
      wsBaseUrl: 'ws://127.0.0.1:8787',
      source: 'query',
    });

    const fromEnv = resolveCoopServerConfig({
      querySearch: '',
      envUrl: 'wss://nshapes-coop.workers.dev',
    });
    expect(fromEnv).toEqual({
      httpBaseUrl: 'https://nshapes-coop.workers.dev',
      wsBaseUrl: 'wss://nshapes-coop.workers.dev',
      source: 'env',
    });
  });

  it('builds encoded WebSocket room URLs', () => {
    const cfg = resolveCoopServerConfig({ explicitServerUrl: 'http://127.0.0.1:8787' });
    const wsUrl = buildCoopWsUrl(cfg, {
      code: 'fox7',
      playerId: 'p_host',
      name: 'Sly Fox',
      fighter: 'Sly Fox',
      sessionToken: 'tok-abc',
    });
    expect(wsUrl).toContain('ws://127.0.0.1:8787/room/FOX7/ws?');
    expect(wsUrl).toContain('playerId=p_host');
    expect(wsUrl).toContain('name=Sly+Fox');
    expect(wsUrl).toContain('fighter=Sly+Fox');
    expect(wsUrl).toContain('sessionToken=tok-abc');
  });
});

describe('CoopClient HTTP helpers, reconnect/snapshot flow, and lifecycle guardrails', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    MockWebSocket.instances = [];
    __setAppActiveForTests(true);
    resetPerfViolations();
  });

  afterEach(() => {
    __setAppActiveForTests(true);
    jest.useRealTimers();
  });

  it('creates rooms via POST /room and checks /health', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/room')) {
        return {
          ok: true,
          status: 201,
          json: async () => ({ code: 'K7NP', wsPath: '/room/K7NP/ws' }),
        } as Response;
      }
      if (url.endsWith('/health')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    const room = await createCoopRoom({ serverUrl: 'http://127.0.0.1:8787', fetchImpl: fetchMock as unknown as typeof fetch });
    expect(room).toEqual({
      code: 'K7NP',
      wsPath: '/room/K7NP/ws',
      serverUrl: 'http://127.0.0.1:8787',
    });

    const healthy = await checkCoopServerHealth({
      serverUrl: 'http://127.0.0.1:8787',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(healthy).toBe(true);
  });

  it('hydrates snapshots, patches live combat events, and reconnects with session token', () => {
    const client = new CoopClient({
      serverUrl: 'http://127.0.0.1:8787',
      playerId: 'host-1',
      name: 'Tabby',
      fighter: 'Orange Tabby',
      heartbeatMs: 5000,
      baseReconnectDelayMs: 500,
      WebSocketImpl: MockWebSocket,
    });

    const snapshots: CoopRoomSnapshot[] = [];
    const statuses: string[] = [];
    client.onSnapshot(s => snapshots.push(s));
    client.onStatusChange(st => statuses.push(st));

    client.connect('K7NP');
    expect(MockWebSocket.instances).toHaveLength(1);
    const ws1 = MockWebSocket.instances[0];
    expect(ws1.url).toContain('ws://127.0.0.1:8787/room/K7NP/ws?');

    ws1.simulateOpen();
    expect(client.getStatus()).toBe('connected');
    expect(JSON.parse(ws1.sent[0])).toMatchObject({ type: 'JOIN', playerId: 'host-1' });

    // Receive authoritative SNAPSHOT with active fight
    const fightSnap = makeSnapshot({
      phase: 'fight',
      seq: 5,
      fight: {
        fightId: 'f1',
        nodeId: 'n0',
        foeName: 'Starlight Sentinel',
        bossHp: 350,
        bossMaxHp: 350,
        waveIndex: 0,
        totalWaves: 1,
        startedAt: 1000,
        timerSec: 120,
        parryPhase: 'calm',
        parryMsLeft: 8000,
        parryDurationMs: 8000,
        parryStallsUsed: 0,
        boardHasCounter: {},
        fairnessStalled: false,
        synergy: createEmptySynergyCounters(),
        damageByPlayer: {},
        setsByPlayer: {},
        totalParries: 0,
        outcome: 'active',
      },
    });
    ws1.simulateMessage({
      type: 'SNAPSHOT',
      snapshot: fightSnap,
      yourPlayerId: 'host-1',
      sessionToken: 'session-secret-1',
    });

    expect(client.getSessionToken()).toBe('session-secret-1');
    expect(client.getSnapshot()?.fight?.bossHp).toBe(350);

    // Send damage & receive incremental BOSS_DAMAGED
    expect(client.dealDamage({ amount: 42, combo: 2 })).toBe(true);
    ws1.simulateMessage({
      type: 'BOSS_DAMAGED',
      fromPlayerId: 'host-1',
      amount: 42,
      bossHp: 308,
      bossMaxHp: 350,
      combo: 2,
      lethal: false,
      seq: 6,
    });
    expect(client.getSnapshot()?.fight?.bossHp).toBe(308);
    expect(client.getLocalPlayer()?.combo).toBe(2);

    // Simulate unexpected drop -> exponential backoff reconnect carrying sessionToken
    ws1.simulateClose(1006, 'drop');
    expect(client.getStatus()).toBe('reconnecting');

    jest.advanceTimersByTime(500);
    expect(MockWebSocket.instances).toHaveLength(2);
    const ws2 = MockWebSocket.instances[1];
    expect(ws2.url).toContain('sessionToken=session-secret-1');

    ws2.simulateOpen();
    expect(client.getStatus()).toBe('connected');
    expect(snapshots.length).toBeGreaterThanOrEqual(2);
    expect(statuses).toContain('reconnecting');

    client.dispose();
  });

  it('pauses heartbeat interval on background and resumes cleanly on foreground with zero perf violations', () => {
    const client = new CoopClient({
      serverUrl: 'http://127.0.0.1:8787',
      playerId: 'host-1',
      name: 'Tabby',
      heartbeatMs: 5000,
      baseReconnectDelayMs: 500,
      WebSocketImpl: MockWebSocket,
    });

    client.connect('K7NP');
    const ws1 = MockWebSocket.instances[0];
    ws1.simulateOpen();

    // Heartbeat interval is registered while active & connected
    expect(getPerfSnapshot().activeIntervals).toBe(1);
    expect(getPerfSnapshot().intervalsByLabel['CoopClient.heartbeat']).toBe(1);

    jest.advanceTimersByTime(5000);
    expect(ws1.sent).toContain('ping');

    // Move app to background -> heartbeat immediately stops & unregisters!
    __setAppActiveForTests(false);
    expect(getPerfSnapshot().activeIntervals).toBe(0);
    expect(getPerfSnapshot().violations).toHaveLength(0);

    // If socket drops while backgrounded, no reconnect fires until foreground returns
    ws1.simulateClose(1006, 'bg_drop');
    jest.advanceTimersByTime(30_000);
    expect(MockWebSocket.instances).toHaveLength(1);

    // Return to foreground -> immediately reconnects & restarts heartbeat on open
    __setAppActiveForTests(true);
    expect(MockWebSocket.instances).toHaveLength(2);
    const ws2 = MockWebSocket.instances[1];
    ws2.simulateOpen();
    expect(getPerfSnapshot().activeIntervals).toBe(1);

    // Clean dispose removes all intervals
    client.dispose();
    expect(getPerfSnapshot().activeIntervals).toBe(0);
    expect(getPerfSnapshot().violations).toHaveLength(0);
  });
});
