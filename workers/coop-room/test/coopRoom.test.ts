import { env } from 'cloudflare:workers';
import {
  SELF,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
} from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import {
  COOP_MAX_SINGLE_HIT_DAMAGE,
  COOP_REVIVE_HEARTS,
  isStrictRoomCode,
  type CoopClientMessage,
  type CoopServerMessage,
} from '../../../src/coop/protocol';
import type { CoopRoom } from '../src/coopRoom';

interface TestWsClient {
  ws: WebSocket;
  messages: CoopServerMessage[];
  send(msg: CoopClientMessage): void;
  sendRaw(raw: string): void;
  nextMessage<T extends CoopServerMessage['type']>(
    type: T,
    timeoutMs?: number,
  ): Promise<Extract<CoopServerMessage, { type: T }>>;
  waitFor(
    predicate: (msg: CoopServerMessage) => boolean,
    timeoutMs?: number,
  ): Promise<CoopServerMessage>;
  close(): void;
}

async function createRoomViaHttp(): Promise<{ code: string; wsPath: string }> {
  const res = await SELF.fetch('https://coop.test/room', { method: 'POST' });
  expect(res.status).toBe(201);
  expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  return (await res.json()) as { code: string; wsPath: string };
}

async function connectClient(
  code: string,
  playerId: string,
  name: string,
  extraParams?: Record<string, string>,
): Promise<TestWsClient> {
  const query = new URLSearchParams({ playerId, name, ...extraParams });
  const res = await SELF.fetch(`https://coop.test/room/${code}/ws?${query.toString()}`, {
    headers: { Upgrade: 'websocket' },
  });
  expect(res.status).toBe(101);
  const ws = res.webSocket;
  expect(ws).toBeTruthy();
  if (!ws) throw new Error('Missing webSocket on 101 response');

  const messages: CoopServerMessage[] = [];
  const waiters: Array<{
    predicate: (msg: CoopServerMessage) => boolean;
    resolve: (msg: CoopServerMessage) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  ws.addEventListener('message', (ev: MessageEvent) => {
    const raw = typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data as ArrayBuffer);
    if (raw === 'pong') return;
    const parsed = JSON.parse(raw) as CoopServerMessage;
    messages.push(parsed);

    for (let i = waiters.length - 1; i >= 0; i--) {
      const waiter = waiters[i];
      if (waiter.predicate(parsed)) {
        clearTimeout(waiter.timer);
        waiters.splice(i, 1);
        waiter.resolve(parsed);
      }
    }
  });

  ws.accept();

  const waitFor = (
    predicate: (msg: CoopServerMessage) => boolean,
    timeoutMs = 2000,
  ): Promise<CoopServerMessage> => {
    const existing = messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = waiters.findIndex(w => w.resolve === resolve);
        if (idx >= 0) waiters.splice(idx, 1);
        reject(new Error(`Timed out waiting for message. Seen: ${messages.map(m => m.type).join(', ')}`));
      }, timeoutMs);
      waiters.push({ predicate, resolve, reject, timer });
    });
  };

  let cursor = 0;
  const nextMessage = <T extends CoopServerMessage['type']>(
    type: T,
    timeoutMs = 2000,
  ): Promise<Extract<CoopServerMessage, { type: T }>> => {
    for (let i = cursor; i < messages.length; i++) {
      if (messages[i].type === type) {
        cursor = i + 1;
        return Promise.resolve(messages[i] as Extract<CoopServerMessage, { type: T }>);
      }
    }
    return new Promise((resolve, reject) => {
      const predicate = (msg: CoopServerMessage) => msg.type === type;
      const timer = setTimeout(() => {
        const idx = waiters.findIndex(w => w.predicate === predicate);
        if (idx >= 0) waiters.splice(idx, 1);
        reject(
          new Error(
            `Timed out waiting for ${type}. Seen from cursor ${cursor}: ${messages
              .slice(cursor)
              .map(m => m.type)
              .join(', ')}`,
          ),
        );
      }, timeoutMs);
      waiters.push({
        predicate,
        resolve: msg => {
          cursor = messages.length;
          resolve(msg as Extract<CoopServerMessage, { type: T }>);
        },
        reject,
        timer,
      });
    });
  };

  return {
    ws,
    messages,
    send: msg => ws.send(JSON.stringify(msg)),
    sendRaw: raw => ws.send(raw),
    nextMessage,
    waitFor,
    close: () => {
      try {
        ws.close(1000, 'test_done');
      } catch {
        /* ignore */
      }
    },
  };
}

async function setupActiveFight(bossMaxHp = 350): Promise<{
  code: string;
  host: TestWsClient;
  guest: TestWsClient;
}> {
  const { code } = await createRoomViaHttp();
  const host = await connectClient(code, 'p_host', 'Tabby', { fighter: 'Orange Tabby' });
  await host.nextMessage('SNAPSHOT');

  const guest = await connectClient(code, 'p_guest', 'Fox', { fighter: 'Sly Fox' });
  await guest.nextMessage('SNAPSHOT');

  host.send({ type: 'UPDATE_LOBBY', ready: true, seed: 1337, ascension: 2, themePacks: ['pyro_blasts', 'webs_echoes'] });
  guest.send({ type: 'UPDATE_LOBBY', ready: true });
  await guest.waitFor(m => m.type === 'SNAPSHOT' && m.snapshot.players.every(p => p.ready));

  host.send({ type: 'START_CLIMB' });
  await host.waitFor(m => m.type === 'PHASE_ADVANCED' && m.toPhase === 'map');
  await guest.waitFor(m => m.type === 'PHASE_ADVANCED' && m.toPhase === 'map');

  // Both vote for floor 1 skirmish node -> advances directly to preview
  host.send({ type: 'VOTE_NODE', nodeId: 'r0-c1', nodeKind: 'skirmish' });
  guest.send({ type: 'VOTE_NODE', nodeId: 'r0-c1', nodeKind: 'skirmish' });
  await host.waitFor(m => m.type === 'NODE_SELECTED' && m.nodeId === 'r0-c1');
  await guest.waitFor(m => m.type === 'NODE_SELECTED' && m.nodeId === 'r0-c1');

  // Both ready in preview -> advances to fight
  host.send({ type: 'PHASE_READY', ready: true });
  guest.send({ type: 'PHASE_READY', ready: true });
  await host.waitFor(m => m.type === 'PHASE_ADVANCED' && m.toPhase === 'fight');
  await guest.waitFor(m => m.type === 'PHASE_ADVANCED' && m.toPhase === 'fight');

  // Start authoritative fight
  host.send({
    type: 'START_FIGHT',
    fightId: 'fight-1',
    nodeId: 'r0-c1',
    foeName: 'Starlight Sentinel',
    bossMaxHp,
    timerSec: 120,
  });
  await host.waitFor(m => m.type === 'FIGHT_STARTED' && m.fight.bossHp === bossMaxHp);
  await guest.waitFor(m => m.type === 'FIGHT_STARTED' && m.fight.bossHp === bossMaxHp);

  return { code, host, guest };
}

describe('Cloudflare Worker HTTP routes & room creation', () => {
  it('serves GET /health and OPTIONS CORS preflight', async () => {
    const health = await SELF.fetch('https://coop.test/health');
    expect(health.status).toBe(200);
    expect(health.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await health.json()).toEqual({ ok: true });

    const preflight = await SELF.fetch('https://coop.test/room', { method: 'OPTIONS' });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('creates 4-char unambiguous uppercase room codes via POST /room', async () => {
    const created = await createRoomViaHttp();
    expect(created.code).toHaveLength(4);
    expect(isStrictRoomCode(created.code)).toBe(true);
    expect(created.code).not.toMatch(/[IO01]/);
    expect(created.wsPath).toBe(`/room/${created.code}/ws`);

    const stub = env.COOP_ROOM.getByName(created.code);
    const snap = await stub.getRoomSnapshot();
    expect(snap?.code).toBe(created.code);
    expect(snap?.phase).toBe('lobby');
  });
});

describe('CoopRoom lobby, join limits, map voting, and phase barriers', () => {
  it('joins Host + Guest, rejects 3rd climber, enforces ready checks, and syncs map voting', async () => {
    const { code } = await createRoomViaHttp();
    const host = await connectClient(code, 'p_host', 'Tabby', { fighter: 'Orange Tabby' });
    const hostSnap = await host.nextMessage('SNAPSHOT');
    expect(hostSnap.snapshot.players).toHaveLength(1);
    expect(hostSnap.snapshot.players[0].role).toBe('host');

    const guest = await connectClient(code, 'p_guest', 'Penguin', { fighter: 'Emperor Penguin' });
    const guestSnap = await guest.nextMessage('SNAPSHOT');
    expect(guestSnap.snapshot.players).toHaveLength(2);
    expect(guestSnap.snapshot.players[1].role).toBe('guest');

    // 3rd climber is rejected with ROOM_FULL
    const third = await connectClient(code, 'p_third', 'Badger');
    const errMsg = await third.nextMessage('ERROR');
    expect(errMsg.code).toBe('ROOM_FULL');
    third.close();

    // Non-host cannot start climb
    guest.send({ type: 'START_CLIMB' });
    const notHost = await guest.nextMessage('ERROR');
    expect(notHost.code).toBe('NOT_HOST');

    // Host cannot start until both are ready
    host.send({ type: 'START_CLIMB' });
    const notReady = await host.nextMessage('ERROR');
    expect(notReady.code).toBe('NOT_READY');

    // Ready up and launch
    host.send({ type: 'UPDATE_LOBBY', ready: true, seed: 9001, ascension: 3 });
    guest.send({ type: 'UPDATE_LOBBY', ready: true });
    await host.waitFor(m => m.type === 'SNAPSHOT' && m.snapshot.players.every(p => p.ready));

    host.send({ type: 'START_CLIMB' });
    const adv = await guest.waitFor(m => m.type === 'PHASE_ADVANCED' && m.toPhase === 'map');
    expect(adv.type).toBe('PHASE_ADVANCED');

    // Divergent votes stay on map until consensus
    host.send({ type: 'VOTE_NODE', nodeId: 'r0-c0', nodeKind: 'shop' });
    guest.send({ type: 'VOTE_NODE', nodeId: 'r0-c2', nodeKind: 'campfire' });
    const voteUpdate = await host.waitFor(
      m => m.type === 'VOTE_UPDATED' && m.mapVotes.p_host === 'r0-c0' && m.mapVotes.p_guest === 'r0-c2',
    );
    expect(voteUpdate.type).toBe('VOTE_UPDATED');

    // Unanimous vote immediately advances both to shop
    guest.send({ type: 'VOTE_NODE', nodeId: 'r0-c0', nodeKind: 'shop' });
    const selected = await host.waitFor(
      m => m.type === 'NODE_SELECTED' && m.nodeId === 'r0-c0' && m.nextPhase === 'shop',
    );
    expect(selected.type).toBe('NODE_SELECTED');

    // Phase barrier: only advances back to map once BOTH ready up
    host.send({ type: 'PHASE_READY', ready: true });
    const readyUpdate = await guest.waitFor(
      m => m.type === 'PHASE_READY_UPDATED' && m.phaseReady.p_host === true && m.phaseReady.p_guest === false,
    );
    expect(readyUpdate.type).toBe('PHASE_READY_UPDATED');

    guest.send({ type: 'PHASE_READY', ready: true });
    const backToMap = await host.waitFor(
      m => m.type === 'PHASE_ADVANCED' && m.fromPhase === 'shop' && m.toPhase === 'map',
    );
    expect(backToMap.type).toBe('PHASE_ADVANCED');

    host.close();
    guest.close();
  });
});

describe('CoopRoom authoritative combat, cross-parry, fairness stall, synergy, Golden Cage & gifts', () => {
  it('syncs authoritative Boss HP, clamps bogus single-hit damage, preserves HP on duplicate START_FIGHT, and handles KO -> reward', async () => {
    const { host, guest } = await setupActiveFight(5000);

    // Host deals normal damage
    host.send({ type: 'DEAL_DAMAGE', amount: 120, combo: 2, label: 'Rainbow Set' });
    const dmg1 = await guest.waitFor(
      m => m.type === 'BOSS_DAMAGED' && m.bossHp === 4880 && m.amount === 120,
    );
    expect(dmg1.type).toBe('BOSS_DAMAGED');

    // Duplicate START_FIGHT from Guest for the same active node must NOT reset Boss HP!
    guest.send({
      type: 'START_FIGHT',
      fightId: 'fight-1',
      nodeId: 'r0-c1',
      foeName: 'Starlight Sentinel',
      bossMaxHp: 5000,
    });
    const reSnap = await guest.waitFor(
      m => m.type === 'SNAPSHOT' && m.snapshot.fight?.bossHp === 4880,
    );
    expect(reSnap.type).toBe('SNAPSHOT');

    // Bogus huge damage packet is clamped to COOP_MAX_SINGLE_HIT_DAMAGE
    guest.send({ type: 'DEAL_DAMAGE', amount: 999999 });
    const clamped = await host.waitFor(
      m => m.type === 'BOSS_DAMAGED' && m.amount === COOP_MAX_SINGLE_HIT_DAMAGE,
    );
    expect(clamped.type).toBe('BOSS_DAMAGED');
    if (clamped.type === 'BOSS_DAMAGED') {
      expect(clamped.bossHp).toBe(4880 - COOP_MAX_SINGLE_HIT_DAMAGE);
    }

    // Finish the boss -> FIGHT_ENDED victory & phase advances to reward
    host.send({ type: 'DEAL_DAMAGE', amount: 2500 });
    const ended = await guest.waitFor(
      m => m.type === 'FIGHT_ENDED' && m.outcome === 'victory' && m.nextPhase === 'reward',
    );
    expect(ended.type).toBe('FIGHT_ENDED');

    host.close();
    guest.close();
  });

  it('handles Cross-Parry, fairness stall only when NEITHER board has a counter, and shared Synergy merge', async () => {
    const { host, guest } = await setupActiveFight(400);

    // Begin parry windup
    host.send({ type: 'PARRY_REPORT', kind: 'windup_start', durationMs: 5000 });
    await guest.waitFor(m => m.type === 'PARRY_SYNC' && m.parryPhase === 'windup');

    // Host has no counter, Guest DOES have a counter -> must NOT stall
    host.send({ type: 'BOARD_COUNTER_STATUS', hasCounter: false });
    guest.send({ type: 'BOARD_COUNTER_STATUS', hasCounter: true });
    const noStall = await host.waitFor(
      m =>
        m.type === 'PARRY_SYNC' &&
        m.boardHasCounter.p_host === false &&
        m.boardHasCounter.p_guest === true,
    );
    if (noStall.type === 'PARRY_SYNC') {
      expect(noStall.fairnessStalled).toBe(false);
    }

    // Now Guest ALSO loses counter -> NEITHER board has counter -> fairnessStalled becomes true!
    guest.send({ type: 'BOARD_COUNTER_STATUS', hasCounter: false });
    const stalled = await host.waitFor(
      m => m.type === 'PARRY_SYNC' && m.fairnessStalled === true && m.parryStallsUsed === 1,
    );
    expect(stalled.type).toBe('PARRY_SYNC');

    // Guest lands a Cross-Parry (perfect) -> staggers boss for BOTH and bumps shared parries synergy
    guest.send({ type: 'PARRY_REPORT', kind: 'perfect', staggerMs: 6500 });
    const staggerSync = await host.waitFor(
      m => m.type === 'PARRY_SYNC' && m.parryPhase === 'staggered' && m.kind === 'perfect',
    );
    expect(staggerSync.type).toBe('PARRY_SYNC');

    // Shared party-wide Synergy Graph deltas accumulate across both players
    host.send({ type: 'SYNERGY_DELTA', deltas: { burn: 4, links: 2, holo: 1 } });
    guest.send({ type: 'SYNERGY_DELTA', deltas: { burn: 3, marks: 5, echoes: 2 } });
    const merged = await host.waitFor(
      m =>
        m.type === 'SYNERGY_SYNC' &&
        m.synergy.burn === 7 &&
        m.synergy.links === 2 &&
        m.synergy.marks === 5 &&
        m.synergy.echoes === 2 &&
        m.synergy.parries === 1,
    );
    expect(merged.type).toBe('SYNERGY_SYNC');

    host.close();
    guest.close();
  });

  it('revives a Golden-Caged player after 3 ally Sets OR 1 ally Parry, and ends in defeat when BOTH are caged', async () => {
    const { host, guest } = await setupActiveFight(600);

    // Guest drops to 0 hearts -> Golden Cage (does NOT trigger defeat while Host is alive)
    guest.send({ type: 'PLAYER_HEART_UPDATE', hearts: 0 });
    const caged = await host.waitFor(
      m => m.type === 'PLAYER_CAGED' && m.playerId === 'p_guest' && m.rescueNeeded === 3,
    );
    expect(caged.type).toBe('PLAYER_CAGED');

    // Host lands 2 Sets -> rescue progress 1/3, 2/3
    host.send({ type: 'DEAL_DAMAGE', amount: 25 });
    await guest.waitFor(
      m => m.type === 'PLAYER_RESCUE_PROGRESS' && m.rescueProgress === 1 && m.rescueNeeded === 3,
    );
    host.send({ type: 'DEAL_DAMAGE', amount: 25 });
    await guest.waitFor(
      m => m.type === 'PLAYER_RESCUE_PROGRESS' && m.rescueProgress === 2 && m.rescueNeeded === 3,
    );

    // Host lands 3rd Set -> Guest revived with COOP_REVIVE_HEARTS!
    host.send({ type: 'DEAL_DAMAGE', amount: 25 });
    const revivedBySets = await guest.waitFor(
      m =>
        m.type === 'PLAYER_REVIVED' &&
        m.playerId === 'p_guest' &&
        m.reason === 'ally_sets' &&
        m.hearts === COOP_REVIVE_HEARTS,
    );
    expect(revivedBySets.type).toBe('PLAYER_REVIVED');

    // Host gets caged -> Guest lands 1 Parry -> instant revive via ally_parry!
    host.send({ type: 'PLAYER_HEART_UPDATE', hearts: 0 });
    await guest.waitFor(m => m.type === 'PLAYER_CAGED' && m.playerId === 'p_host');

    guest.send({ type: 'PARRY_REPORT', kind: 'parry' });
    const revivedByParry = await host.waitFor(
      m =>
        m.type === 'PLAYER_REVIVED' &&
        m.playerId === 'p_host' &&
        m.reason === 'ally_parry' &&
        m.hearts === COOP_REVIVE_HEARTS,
    );
    expect(revivedByParry.type).toBe('PLAYER_REVIVED');

    // Now BOTH players hit 0 hearts -> both-caged defeat!
    host.send({ type: 'PLAYER_HEART_UPDATE', hearts: 0 });
    await guest.waitFor(m => m.type === 'PLAYER_CAGED' && m.playerId === 'p_host');

    guest.send({ type: 'PLAYER_HEART_UPDATE', hearts: 0 });
    const defeat = await host.waitFor(
      m =>
        m.type === 'FIGHT_ENDED' &&
        m.outcome === 'defeat' &&
        m.reason === 'both_caged' &&
        m.nextPhase === 'defeat',
    );
    expect(defeat.type).toBe('FIGHT_ENDED');

    host.close();
    guest.close();
  });

  it('delivers Ally Gifts (wild_card, heal, cleanse, shop_gift) and Emotes', async () => {
    const { host, guest } = await setupActiveFight(300);

    // Guest takes damage to 3/5 hearts
    guest.send({ type: 'PLAYER_HEART_UPDATE', hearts: 3 });
    await host.waitFor(
      m => m.type === 'PLAYER_PRESENCE' && m.player.playerId === 'p_guest' && m.player.hearts === 3,
    );

    // Host sends wild_card gift
    host.send({ type: 'SEND_GIFT', kind: 'wild_card', label: 'Tabby sent a Wild Card!' });
    const wildGift = await guest.waitFor(
      m => m.type === 'GIFT_RECEIVED' && m.kind === 'wild_card' && m.toPlayerId === 'p_guest',
    );
    expect(wildGift.type).toBe('GIFT_RECEIVED');

    // Host sends heal gift -> updates Guest's authoritative hearts to 4
    host.send({ type: 'SEND_GIFT', kind: 'heal' });
    const healGift = await guest.waitFor(
      m => m.type === 'GIFT_RECEIVED' && m.kind === 'heal' && m.toPlayerId === 'p_guest',
    );
    expect(healGift.type).toBe('GIFT_RECEIVED');
    const healedPresence = await guest.waitFor(
      m => m.type === 'PLAYER_PRESENCE' && m.player.playerId === 'p_guest' && m.player.hearts === 4,
    );
    expect(healedPresence.type).toBe('PLAYER_PRESENCE');

    // Host sends shop weapon gift + emote
    host.send({
      type: 'SEND_GIFT',
      kind: 'shop_gift',
      shopGift: { giftType: 'weapon', weaponId: 'blast-powder', weaponLevel: 2 },
    });
    const shopGift = await guest.waitFor(
      m =>
        m.type === 'GIFT_RECEIVED' &&
        m.kind === 'shop_gift' &&
        m.shopGift?.weaponId === 'blast-powder',
    );
    expect(shopGift.type).toBe('GIFT_RECEIVED');

    guest.send({ type: 'EMOTE', emote: 'cheer', text: 'You got this!' });
    const emote = await host.waitFor(
      m => m.type === 'EMOTE_RECEIVED' && m.fromPlayerId === 'p_guest' && m.emote === 'cheer',
    );
    expect(emote.type).toBe('EMOTE_RECEIVED');

    host.close();
    guest.close();
  });
});

describe('CoopRoom reconnect SNAPSHOT resilience & SQLite alarm cleanup', () => {
  it('hydrates full authoritative SNAPSHOT on reconnect within grace window and cleans up via alarm()', async () => {
    const { code, host, guest } = await setupActiveFight(400);

    // Guest disconnects mid-fight
    guest.close();
    await host.waitFor(
      m => m.type === 'PLAYER_PRESENCE' && m.player.playerId === 'p_guest' && m.event === 'disconnected',
    );

    // Host deals damage & accumulates synergy while Guest is offline
    host.send({ type: 'DEAL_DAMAGE', amount: 90, combo: 3 });
    host.send({ type: 'SYNERGY_DELTA', deltas: { burn: 5 } });
    await host.waitFor(m => m.type === 'SYNERGY_SYNC' && m.synergy.burn === 5);

    // Guest reconnects with same playerId -> immediately receives authoritative SNAPSHOT!
    const guestRejoined = await connectClient(code, 'p_guest', 'Fox');
    const hydrated = await guestRejoined.nextMessage('SNAPSHOT');
    expect(hydrated.snapshot.phase).toBe('fight');
    expect(hydrated.snapshot.fight?.bossHp).toBe(310);
    expect(hydrated.snapshot.fight?.synergy.burn).toBe(5);
    expect(hydrated.snapshot.players.find(p => p.playerId === 'p_guest')?.connected).toBe(true);

    const presenceReconnected = await host.waitFor(
      m => m.type === 'PLAYER_PRESENCE' && m.player.playerId === 'p_guest' && m.event === 'reconnected',
    );
    expect(presenceReconnected.type).toBe('PLAYER_PRESENCE');

    // Verify SQLite directly inside the DO & verify inactivity alarm is scheduled
    const stub = env.COOP_ROOM.getByName(code);
    await runInDurableObject(stub, async (_instance: CoopRoom, state) => {
      const alarm = await state.storage.getAlarm();
      expect(alarm).not.toBeNull();
      const rows = state.storage.sql.exec<{ phase: string }>(`SELECT phase FROM room_state WHERE id = 1`).toArray();
      expect(rows[0]?.phase).toBe('fight');
    });

    // Evict DO while keeping hibernatable WebSockets open -> wake up via message and verify SQLite recovery!
    await evictDurableObject(stub, { webSockets: 'hibernate' });
    guestRejoined.send({ type: 'DEAL_DAMAGE', amount: 30, combo: 1 });
    const postHibernateDmg = await host.waitFor(
      m => m.type === 'BOSS_DAMAGED' && m.fromPlayerId === 'p_guest' && m.bossHp === 280,
    );
    expect(postHibernateDmg.type).toBe('BOSS_DAMAGED');

    // Running alarm while sockets are connected preserves room state and reschedules
    const ranWhileActive = await runDurableObjectAlarm(stub);
    expect(ranWhileActive).toBe(true);
    expect((await stub.getRoomSnapshot())?.fight?.bossHp).toBe(280);

    // Close all sockets -> wait briefly for close handlers -> run inactivity alarm -> room wiped cleanly
    host.close();
    guestRejoined.close();
    await new Promise(resolve => setTimeout(resolve, 50));

    const ranAfterIdle = await runDurableObjectAlarm(stub);
    expect(ranAfterIdle).toBe(true);
    expect(await stub.getRoomSnapshot()).toBeNull();
  });

  it('handles ping/pong heartbeat, fight timeout defeat, and host-confirmed map vote + cancel preview', async () => {
    const { code } = await createRoomViaHttp();
    const host = await connectClient(code, 'p_host', 'Tabby', { fighter: 'Orange Tabby' });
    await host.nextMessage('SNAPSHOT');

    // Ping/pong edge auto-response
    const pongReceived = new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('pong timeout')), 1500);
      host.ws.addEventListener('message', (ev: MessageEvent) => {
        if (ev.data === 'pong') {
          clearTimeout(t);
          resolve('pong');
        }
      });
    });
    host.sendRaw('ping');
    expect(await pongReceived).toBe('pong');

    const guest = await connectClient(code, 'p_guest', 'Fox', { fighter: 'Sly Fox' });
    await guest.nextMessage('SNAPSHOT');

    host.send({ type: 'UPDATE_LOBBY', ready: true });
    guest.send({ type: 'UPDATE_LOBBY', ready: true });
    await host.waitFor(m => m.type === 'SNAPSHOT' && m.snapshot.players.every(p => p.ready));

    host.send({ type: 'START_CLIMB' });
    await host.waitFor(m => m.type === 'PHASE_ADVANCED' && m.toPhase === 'map');

    // Host confirm advances even before guest clicks
    host.send({ type: 'VOTE_NODE', nodeId: 'r0-c2', nodeKind: 'elite', confirm: true });
    const selected = await guest.waitFor(
      m => m.type === 'NODE_SELECTED' && m.nodeId === 'r0-c2' && m.nextPhase === 'preview',
    );
    expect(selected.type).toBe('NODE_SELECTED');

    // Cancel preview returns both to map
    host.send({ type: 'CANCEL_PREVIEW' });
    await guest.waitFor(m => m.type === 'PHASE_ADVANCED' && m.fromPhase === 'preview' && m.toPhase === 'map');

    // Direct fight + timeout defeat
    host.send({ type: 'START_FIGHT', nodeId: 'r0-c2', foeName: 'Clock Wraith', bossMaxHp: 250 });
    await guest.waitFor(m => m.type === 'FIGHT_STARTED' && m.fight.foeName === 'Clock Wraith');

    host.send({ type: 'FIGHT_TIMEOUT' });
    const timedOut = await guest.waitFor(
      m =>
        m.type === 'FIGHT_ENDED' &&
        m.outcome === 'defeat' &&
        m.reason === 'timeout' &&
        m.nextPhase === 'defeat',
    );
    expect(timedOut.type).toBe('FIGHT_ENDED');

    host.close();
    guest.close();
  });
});
