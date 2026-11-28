/**
 * Starfall Summit 2P Co-Op — unit & component tests:
 *  - URL deep-linking & invite URL builder (`?mode=summit&coop=FOX7&coopServer=...`)
 *  - 1.75× Duo Boss/Foe HP scaling & 100% 1P solo invariance
 *  - Map vote consensus, Ready barrier, Shop Gifting, and Campfire Duo helpers
 *  - UI rendering & interactions for SpireCoopLobby, SpireCoopBanner, SpireSetup,
 *    SpireMap, SpireShop, SpireCampfire, and SpireRewardScreen
 *  - `useCoopSummit` hook lifecycle: room create/join, map voting -> fight launch,
 *    authoritative boss damage/parry/synergy/cage/gifts sync, shop/campfire gifts,
 *    reward ready barrier, and mid-fight snapshot reconnect hydration.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  buildSummitCoopShareUrl,
  DEFAULT_SHARE_BASE_URL,
  normalizeCoopRoomCode,
  parseShareUrlParams,
} from '@/adventure/dailySeed';
import {
  COOP_DUO_HP_MULTIPLIER,
  scaleFoeHpForParty,
  spireEncounterLoadout,
  spireEncounterToLevel,
} from '@/spire/engine/bridge';
import {
  applyCoopCampfireDuoForge,
  applyCoopCampfireHealAlly,
  applyCoopReceivedDuoForgeSpark,
  applyCoopReceivedHeal,
  applyCoopReceivedWeaponGift,
  applyCoopShopGiftHeal,
  applyCoopShopGiftWeapon,
  COOP_DUO_FORGE_FALLBACK_COINS,
  COOP_SHOP_GIFT_HEAL_AMOUNT,
  COOP_WEAPON_GIFT_FALLBACK_COINS,
  evaluateMapVoteConsensus,
  evaluateReadyBarrier,
} from '@/spire/engine/coopHelpers';
import { createSpireRun, MAX_SUMMIT_WEAPONS, selectSpireNode } from '@/spire/engine/runState';
import { reachableNodeIds } from '@/spire/engine/mapGen';
import { createInitialSpireMeta } from '@/spire/save';
import type { SpireRewardBundle, SpireRun } from '@/spire/types';
import SpireCoopLobby from '@/spire/components/SpireCoopLobby';
import SpireCoopBanner from '@/spire/components/SpireCoopBanner';
import SpireSetup from '@/spire/components/SpireSetup';
import SpireMap from '@/spire/components/SpireMap';
import SpireShop from '@/spire/components/SpireShop';
import SpireCampfire from '@/spire/components/SpireCampfire';
import SpireRewardScreen from '@/spire/components/SpireRewardScreen';
import {
  reconstructCoopRunFromSnapshot,
  useCoopSummit,
  type UseCoopSummitResult,
} from '@/spire/hooks/useCoopSummit';
import type {
  CoopClientLike,
  CoopConnectionStatus,
  CoopPlayerInfo,
  CoopRoomSnapshot,
  CoopServerMessage,
} from '@/spire/hooks/coopContracts';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-svg', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const makeSvgMock = (name: string) => {
    const Comp = (props: any) => ReactActual.createElement(View, props, props?.children);
    Comp.displayName = name;
    return Comp;
  };
  const SvgRoot = makeSvgMock('Svg');
  return new Proxy(
    { __esModule: true, default: SvgRoot, Svg: SvgRoot } as Record<string, any>,
    {
      get(target, prop: string) {
        if (!(prop in target)) target[prop] = makeSvgMock(String(prop));
        return target[prop];
      },
    }
  );
});

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { Text } = require('react-native');
  const MockIcon = ({ name }: { name: string }) => ReactActual.createElement(Text, null, name);
  return { __esModule: true, default: MockIcon, Icon: MockIcon };
});

jest.mock('@/audio', () => {
  const band = new Proxy({}, { get: (_t, key) => (key === 'inFight' ? false : () => undefined) });
  return {
    sfx: () => undefined,
    music: band,
    band,
    setMusicEnabled: () => undefined,
    setSfxOverride: () => undefined,
  };
});

jest.mock('@/components/fighters', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    FighterAvatar: ({ testID, character }: { testID?: string; character: string }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `fighter-avatar-${character}` }),
  };
});

jest.mock('@/components/enemies', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    EnemyAvatar: ({ testID, enemy }: { testID?: string; enemy?: { name?: string } }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `enemy-avatar-${enemy?.name ?? 'foe'}` }),
  };
});

jest.mock('@/components/weapons', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    WeaponAvatar: ({ testID, weapon }: { testID?: string; weapon?: { name?: string } }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `weapon-avatar-${weapon?.name ?? 'weapon'}` }),
  };
});

const SAFE_METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const el = React.createElement;

const wrap = (ui: React.ReactElement) =>
  el(SafeAreaProvider, { initialMetrics: SAFE_METRICS }, ui);

const findNodeByKind = (run: SpireRun, kind: 'shop' | 'campfire' | 'boss' | 'skirmish') => {
  const found = run.map.nodes.find(n => n.kind === kind);
  if (!found) throw new Error(`Expected node of kind ${kind}`);
  return found;
};

interface MockCoopHarness {
  client: CoopClientLike;
  emitSnapshot: (snap: CoopRoomSnapshot) => void;
  emitMessage: (msg: CoopServerMessage) => void;
  emitStatus: (status: CoopConnectionStatus) => void;
}

const createMockCoopClient = (playerId = 'p1'): MockCoopHarness => {
  let snapshot: CoopRoomSnapshot | null = null;
  let status: CoopConnectionStatus = 'idle';
  let roomCode: string | null = null;
  const snapCbs = new Set<(s: CoopRoomSnapshot) => void>();
  const msgCbs = new Set<(m: CoopServerMessage) => void>();
  const statusCbs = new Set<(s: CoopConnectionStatus) => void>();
  const errCbs = new Set<(e: Error | { message: string }) => void>();

  const client: CoopClientLike = {
    createAndJoin: jest.fn(async () => {
      roomCode = 'FOX7';
      status = 'connected';
      statusCbs.forEach(cb => cb(status));
      return { code: 'FOX7', wsPath: '/room/FOX7/ws', serverUrl: 'http://127.0.0.1:8787' };
    }),
    connect: jest.fn((code: string) => {
      roomCode = code;
      status = 'connected';
      statusCbs.forEach(cb => cb(status));
    }),
    disconnect: jest.fn(() => {
      status = 'disconnected';
      statusCbs.forEach(cb => cb(status));
    }),
    dispose: jest.fn(),
    getStatus: () => status,
    getSnapshot: () => snapshot,
    getPlayerId: () => playerId,
    getRoomCode: () => roomCode,
    getSessionToken: () => 'tok-1',
    getLocalPlayer: () => snapshot?.players.find(p => p.playerId === playerId) ?? null,
    getAllyPlayer: () => snapshot?.players.find(p => p.playerId !== playerId) ?? null,
    onSnapshot: cb => {
      snapCbs.add(cb);
      return () => snapCbs.delete(cb);
    },
    onMessage: cb => {
      msgCbs.add(cb);
      return () => msgCbs.delete(cb);
    },
    onStatusChange: cb => {
      statusCbs.add(cb);
      return () => statusCbs.delete(cb);
    },
    onError: cb => {
      errCbs.add(cb);
      return () => errCbs.delete(cb);
    },
    updateLobby: jest.fn(() => true),
    startClimb: jest.fn(() => true),
    voteNode: jest.fn(() => true),
    setPhaseReady: jest.fn(() => true),
    cancelPreview: jest.fn(() => true),
    startFight: jest.fn(() => true),
    dealDamage: jest.fn(() => true),
    reportParry: jest.fn(() => true),
    reportBoardCounterStatus: jest.fn(() => true),
    sendSynergyDelta: jest.fn(() => true),
    updateHearts: jest.fn(() => true),
    reportFightTimeout: jest.fn(() => true),
    sendGift: jest.fn(() => true),
    sendEmote: jest.fn(() => true),
    setPhase: jest.fn(() => true),
    requestSnapshot: jest.fn(() => true),
  };

  return {
    client,
    emitSnapshot: s => {
      snapshot = s;
      roomCode = s.code;
      snapCbs.forEach(cb => cb(s));
    },
    emitMessage: m => {
      msgCbs.forEach(cb => cb(m));
    },
    emitStatus: st => {
      status = st;
      statusCbs.forEach(cb => cb(st));
    },
  };
};

const makePlayer = (overrides: Partial<CoopPlayerInfo> & Pick<CoopPlayerInfo, 'playerId' | 'role' | 'fighter'>): CoopPlayerInfo => ({
  name: overrides.fighter,
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
  ...overrides,
});

describe('Starfall Summit 2P Co-Op', () => {
  describe('URL Deep-Linking & Share URL Builder', () => {
    it('parses ?mode=summit&coop=FOX7 and normalizes lowercase codes to uppercase', () => {
      expect(normalizeCoopRoomCode('fox7')).toBe('FOX7');
      expect(normalizeCoopRoomCode('  k9m2  ')).toBe('K9M2');
      expect(normalizeCoopRoomCode('ABC')).toBeUndefined();
      expect(normalizeCoopRoomCode('ABCDE')).toBeUndefined();
      expect(normalizeCoopRoomCode('AB-7')).toBeUndefined();

      const parsed = parseShareUrlParams('?mode=summit&coop=fox7');
      expect(parsed).toEqual({ mode: 'summit', coop: 'FOX7' });
    });

    it('parses optional coopServer override and builds round-trip invite URLs', () => {
      const url = buildSummitCoopShareUrl({
        code: 'fox7',
        baseUrl: 'http://127.0.0.1:8081/',
        coopServer: 'http://127.0.0.1:8787',
      });
      expect(url).toBe(
        'http://127.0.0.1:8081/?mode=summit&coop=FOX7&coopServer=http%3A%2F%2F127.0.0.1%3A8787'
      );

      const roundTripped = parseShareUrlParams(url);
      expect(roundTripped).toEqual({
        mode: 'summit',
        coop: 'FOX7',
        coopServer: 'http://127.0.0.1:8787',
      });

      const defaultUrl = buildSummitCoopShareUrl({ code: 'R4P9' });
      expect(defaultUrl).toBe(`${DEFAULT_SHARE_BASE_URL}/?mode=summit&coop=R4P9`);
    });
  });

  describe('1.75× Co-Op Foe HP Scaling & 1P Invariance', () => {
    it('leaves 1P solo encounters 100% identical and scales 2P co-op encounters by 1.75×', () => {
      const run = createSpireRun('Orange Tabby', 0, 4242);
      const bossNode = findNodeByKind(run, 'boss');
      const encounter = bossNode.encounter!;
      const originalHp = encounter.foes.map(f => f.hp);

      const soloDefault = spireEncounterToLevel(run, encounter);
      const soloExplicit = spireEncounterToLevel(run, encounter, { coopPartySize: 1 });
      expect(soloDefault.foes).toBe(encounter.foes);
      expect(soloExplicit.foes).toBe(encounter.foes);
      expect(soloDefault.foes.map(f => f.hp)).toEqual(originalHp);

      const duo = spireEncounterToLevel(run, encounter, { coopPartySize: 2 });
      expect(duo.foes).not.toBe(encounter.foes);
      expect(duo.foes.map(f => f.hp)).toEqual(
        originalHp.map(hp => Math.round(hp * COOP_DUO_HP_MULTIPLIER))
      );
      expect(encounter.foes.map(f => f.hp)).toEqual(originalHp);

      const duoRun: SpireRun = { ...run, coopPartySize: 2 };
      const duoFromRun = spireEncounterToLevel(duoRun, encounter);
      expect(duoFromRun.foes.map(f => f.hp)).toEqual(duo.foes.map(f => f.hp));

      const soloLoadout = spireEncounterLoadout(run, encounter);
      const duoLoadout = spireEncounterLoadout(run, encounter, { coopPartySize: 2 });
      expect(soloLoadout.timer).toBe(duoLoadout.timer);
      expect(scaleFoeHpForParty(100, 1)).toBe(100);
      expect(scaleFoeHpForParty(100, 2)).toBe(175);
    });
  });

  describe('Map Vote Consensus & Ready Barrier Helpers', () => {
    it('resolves none, waiting, mismatch, and agreed consensus states accurately', () => {
      const players = ['host', 'guest'];
      const reachable = ['n-0-0', 'n-0-1', 'n-0-2'];

      expect(evaluateMapVoteConsensus({}, players, reachable)).toEqual({
        status: 'none',
        agreedNodeId: null,
        votedCount: 0,
        totalPlayers: 2,
      });

      expect(evaluateMapVoteConsensus({ host: 'n-6-0' }, players, reachable).status).toBe('none');

      expect(evaluateMapVoteConsensus({ host: 'n-0-1' }, players, reachable)).toEqual({
        status: 'waiting',
        agreedNodeId: null,
        votedCount: 1,
        totalPlayers: 2,
      });

      expect(
        evaluateMapVoteConsensus({ host: 'n-0-0', guest: 'n-0-2' }, players, reachable)
      ).toEqual({
        status: 'mismatch',
        agreedNodeId: null,
        votedCount: 2,
        totalPlayers: 2,
      });

      expect(
        evaluateMapVoteConsensus({ host: 'n-0-2', guest: 'n-0-2' }, players, reachable)
      ).toEqual({
        status: 'agreed',
        agreedNodeId: 'n-0-2',
        votedCount: 2,
        totalPlayers: 2,
      });
    });

    it('tracks per-player ready barriers cleanly', () => {
      const players = ['host', 'guest'];
      expect(evaluateReadyBarrier({}, players)).toEqual({
        allReady: false,
        readyCount: 0,
        totalCount: 2,
      });
      expect(evaluateReadyBarrier({ host: true, guest: false }, players)).toEqual({
        allReady: false,
        readyCount: 1,
        totalCount: 2,
      });
      expect(evaluateReadyBarrier({ host: true, guest: true }, players)).toEqual({
        allReady: true,
        readyCount: 2,
        totalCount: 2,
      });
    });
  });

  describe('Shop Gifting & Campfire Duo Helpers', () => {
    it('gifts heal and offered weapons from SpireShop and applies received gifts safely', () => {
      const base = createSpireRun('Orange Tabby', 0, 7777);
      const shopNode = findNodeByKind(base, 'shop');
      const shopRun: SpireRun = selectSpireNode(
        {
          ...base,
          coins: 300,
          currentNodeId: null,
          map: { ...base.map, nodes: base.map.nodes.map(n => (n.id === shopNode.id ? { ...n, row: 0 } : n)) },
        },
        shopNode.id
      );
      expect(shopRun.phase).toBe('shop');
      expect(shopRun.shop).toBeTruthy();

      const healRes = applyCoopShopGiftHeal(shopRun);
      expect(healRes).not.toBeNull();
      expect(healRes!.healAmount).toBe(COOP_SHOP_GIFT_HEAL_AMOUNT);
      expect(healRes!.run.coins).toBe(shopRun.coins - shopRun.shop!.healCost);

      const weaponRes = applyCoopShopGiftWeapon(healRes!.run, 0);
      expect(weaponRes).not.toBeNull();
      expect(weaponRes!.run.shop!.weapons[0].sold).toBe(true);
      expect(weaponRes!.weaponId).toBe(shopRun.shop!.weapons[0].weaponId);

      const hurtAlly: SpireRun = { ...base, hearts: 2, maxHearts: 5 };
      const healed = applyCoopReceivedHeal(hurtAlly, 2);
      expect(healed.gained).toBe(2);
      expect(healed.run.hearts).toBe(4);

      const added = applyCoopReceivedWeaponGift(base, 'spark-arc', 2);
      expect(added.applied).toBe('added');
      expect(added.run.weapons).toContain('spark-arc');

      const upgraded = applyCoopReceivedWeaponGift(added.run, 'spark-arc', 2);
      expect(upgraded.applied).toBe('upgraded');
      expect(upgraded.run.weaponLevels['spark-arc']).toBe(3);

      const fullBeltRun: SpireRun = {
        ...base,
        weapons: ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, MAX_SUMMIT_WEAPONS),
        weaponLevels: { a: 2, b: 2, c: 2, d: 2, e: 2, f: 2 },
      };
      const fallback = applyCoopReceivedWeaponGift(fullBeltRun, 'spark-arc', 2);
      expect(fallback.applied).toBe('coins');
      expect(fallback.bonusCoins).toBe(COOP_WEAPON_GIFT_FALLBACK_COINS);
      expect(fallback.run.coins).toBe(fullBeltRun.coins + COOP_WEAPON_GIFT_FALLBACK_COINS);
    });

    it('resolves Campfire Heal Ally, Duo Forge, and incoming Duo Forge Sparks', () => {
      const base = createSpireRun('Sly Fox', 0, 8888);
      const campNode = findNodeByKind(base, 'campfire');
      const campRun = selectSpireNode(
        {
          ...base,
          hearts: 3,
          maxHearts: 5,
          currentNodeId: null,
          map: { ...base.map, nodes: base.map.nodes.map(n => (n.id === campNode.id ? { ...n, row: 0 } : n)) },
        },
        campNode.id
      );
      expect(campRun.phase).toBe('campfire');

      const healedAlly = applyCoopCampfireHealAlly(campRun, 'Penguin');
      expect(healedAlly).not.toBeNull();
      expect(healedAlly!.run.campfire!.resolved).toBe(true);
      expect(healedAlly!.run.hearts).toBe(4);
      expect(healedAlly!.allyHealAmount).toBeGreaterThanOrEqual(2);

      const firstWep = campRun.weapons[0];
      const duoForged = applyCoopCampfireDuoForge(campRun, firstWep, 'Penguin');
      expect(duoForged).not.toBeNull();
      expect(duoForged!.run.weaponLevels[firstWep]).toBe((campRun.weaponLevels[firstWep] ?? 1) + 1);
      expect(duoForged!.run.campfire!.resolved).toBe(true);

      const sparked = applyCoopReceivedDuoForgeSpark(base);
      expect(sparked.upgradedWeaponId).toBe(base.weapons[0]);
      expect(sparked.run.weaponLevels[base.weapons[0]]).toBe((base.weaponLevels[base.weapons[0]] ?? 1) + 1);

      const maxedRun: SpireRun = {
        ...base,
        weaponLevels: Object.fromEntries(base.weapons.map(id => [id, 5])),
      };
      const maxedSpark = applyCoopReceivedDuoForgeSpark(maxedRun);
      expect(maxedSpark.upgradedWeaponId).toBeUndefined();
      expect(maxedSpark.bonusCoins).toBe(COOP_DUO_FORGE_FALLBACK_COINS);
      expect(maxedSpark.run.coins).toBe(maxedRun.coins + COOP_DUO_FORGE_FALLBACK_COINS);
    });
  });

  describe('useCoopSummit Session Controller & Snapshot Hydration', () => {
    it('drives lobby -> map vote -> live combat sync -> incoming shop gift -> reconnect hydration', async () => {
      const harness = createMockCoopClient('p1');
      let latestHook: UseCoopSummitResult | null = null;
      let currentRun: SpireRun | null = null;
      let inSetup = true;

      const Probe: React.FC<{ run: SpireRun | null; setup: boolean }> = ({ run, setup }) => {
        latestHook = useCoopSummit({
          selectedFighter: 'Orange Tabby',
          ascension: 0,
          seed: 5555,
          run,
          inSetup: setup,
          onSetCoopRun: (next, opts) => {
            currentRun = next;
            if (opts?.enterRun) inSetup = false;
            if (opts?.exitToSetup) inSetup = true;
          },
          clientFactory: () => harness.client,
        });
        return null;
      };

      const screen = render(el(Probe, { run: currentRun, setup: inSetup }));

      await act(async () => {
        await latestHook!.createRoom();
      });
      expect(latestHook!.roomCode).toBe('FOX7');

      const host = makePlayer({ playerId: 'p1', role: 'host', fighter: 'Orange Tabby', ready: true });
      const guest = makePlayer({ playerId: 'p2', role: 'guest', fighter: 'Sly Fox', ready: true });
      const lobbySnap: CoopRoomSnapshot = {
        code: 'FOX7',
        phase: 'lobby',
        createdAt: 1000,
        updatedAt: 1000,
        seed: 5555,
        ascension: 0,
        themePacks: [],
        act: 1,
        floor: 0,
        currentNodeId: null,
        players: [host, guest],
        mapVotes: {},
        phaseReady: {},
        fight: null,
        seq: 1,
      };
      act(() => {
        harness.emitSnapshot(lobbySnap);
      });
      screen.rerender(el(Probe, { run: currentRun, setup: inSetup }));
      expect(latestHook!.canStartClimb).toBe(true);

      // Start climb -> server emits map snapshot -> local SpireRun created with coopPartySize=2
      act(() => {
        latestHook!.startDuoClimb();
        harness.emitSnapshot({ ...lobbySnap, phase: 'map', seq: 2 });
      });
      expect(harness.client.startClimb).toHaveBeenCalled();
      expect(currentRun).not.toBeNull();
      expect(currentRun!.coopPartySize).toBe(2);
      expect(currentRun!.phase).toBe('map');
      expect(inSetup).toBe(false);
      screen.rerender(el(Probe, { run: currentRun, setup: inSetup }));

      // Map vote on Floor 1 skirmish node -> NODE_SELECTED launches fight & sends START_FIGHT (1.75x HP!)
      const entryNodeId = reachableNodeIds(currentRun!.map, null)[0];
      act(() => {
        latestHook!.voteMapNode(entryNodeId);
      });
      expect(harness.client.voteNode).toHaveBeenCalledWith(
        entryNodeId,
        expect.objectContaining({ nextPhase: 'fight' })
      );
      act(() => {
        harness.emitMessage({ type: 'NODE_SELECTED', nodeId: entryNodeId, nextPhase: 'fight', seq: 3 });
      });
      expect(currentRun!.phase).toBe('fight');
      expect(harness.client.startFight).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: entryNodeId,
          bossMaxHp: scaleFoeHpForParty(currentRun!.activeEncounter!.foes[0].hp, 2),
        })
      );
      screen.rerender(el(Probe, { run: currentRun, setup: inSetup }));

      // Live combat callbacks & inbound ally hit/parry/gift events
      expect(latestHook!.combatSession).toBeTruthy();
      act(() => {
        latestHook!.combatSession!.callbacks.onDealDamage({ amount: 45, combo: 2, isRainbow: true });
        latestHook!.combatSession!.callbacks.onParryLanded({ perfect: true, staggerMs: 4000 });
        latestHook!.combatSession!.callbacks.onSynergyDelta({ burn: 2 });
        latestHook!.combatSession!.callbacks.onBoardCounterStatus(true);
      });
      expect(harness.client.dealDamage).toHaveBeenCalledWith({ amount: 45, combo: 2, isRainbow: true });
      expect(harness.client.reportParry).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'perfect', staggerMs: 4000 })
      );
      expect(harness.client.sendSynergyDelta).toHaveBeenCalledWith({ burn: 2 });
      expect(harness.client.reportBoardCounterStatus).toHaveBeenCalledWith(true);

      act(() => {
        harness.emitMessage({
          type: 'BOSS_DAMAGED',
          fromPlayerId: 'p2',
          amount: 60,
          bossHp: 115,
          bossMaxHp: 175,
          lethal: false,
          seq: 4,
        });
        harness.emitMessage({
          type: 'PARRY_SYNC',
          fromPlayerId: 'p2',
          kind: 'perfect',
          parryPhase: 'staggered',
          parryMsLeft: 4000,
          parryDurationMs: 4000,
          fairnessStalled: false,
          parryStallsUsed: 0,
          boardHasCounter: { p1: true, p2: true },
          totalParries: 1,
          seq: 5,
        });
      });
      screen.rerender(el(Probe, { run: currentRun, setup: inSetup }));
      expect(latestHook!.combatSession!.state.inboundEvents.map(e => e.kind)).toEqual([
        'ally_hit',
        'cross_parry',
      ]);

      // Mid-fight snapshot reconstruction hydrates exact node, fight phase, and 2P scaling
      const midFightSnap: CoopRoomSnapshot = {
        ...lobbySnap,
        phase: 'fight',
        floor: 1,
        currentNodeId: entryNodeId,
        fight: {
          fightId: 'f1',
          nodeId: entryNodeId,
          foeName: currentRun!.activeEncounter!.name,
          bossHp: 90,
          bossMaxHp: 175,
          waveIndex: 0,
          totalWaves: 1,
          startedAt: Date.now(),
          timerSec: 60,
          parryPhase: 'calm',
          parryMsLeft: 0,
          parryDurationMs: 0,
          parryStallsUsed: 0,
          boardHasCounter: {},
          fairnessStalled: false,
          synergy: {},
          damageByPlayer: {},
          setsByPlayer: {},
          totalParries: 0,
          outcome: 'active',
        },
        seq: 6,
      };
      const rebuilt = reconstructCoopRunFromSnapshot(midFightSnap, guest);
      expect(rebuilt.fighter).toBe('Sly Fox');
      expect(rebuilt.phase).toBe('fight');
      expect(rebuilt.currentNodeId).toBe(entryNodeId);
      expect(rebuilt.coopPartySize).toBe(2);
    });
  });

  describe('Co-Op UI Components', () => {
    it('renders SpireCoopLobby entry/auto-join and ready/start host controls with E2E testIDs', () => {
      const onJoinRoom = jest.fn();
      const onCreateRoom = jest.fn();
      const screen = render(
        wrap(
          el(SpireCoopLobby, {
            roomCode: null,
            connectionState: 'idle',
            isHost: false,
            localPlayer: null,
            allyPlayer: null,
            selectedFighter: 'Orange Tabby',
            ascension: 0,
            maxSelectableAsc: 1,
            initialCoopCode: 'fox7',
            canStartClimb: false,
            onSelectFighter: () => {},
            onCreateRoom,
            onJoinRoom,
            onLeaveRoom: () => {},
            onToggleReady: () => {},
            onStartClimb: () => {},
          })
        )
      );
      expect(onJoinRoom).toHaveBeenCalledWith('FOX7');
      expect(screen.getByTestId('coop-create-btn')).toBeTruthy();
      expect(screen.getByTestId('coop-join-input')).toBeTruthy();
      expect(screen.getByTestId('coop-join-btn')).toBeTruthy();

      fireEvent.press(screen.getByTestId('coop-create-btn'));
      expect(onCreateRoom).toHaveBeenCalledTimes(1);
    });

    it('renders SpireCoopLobby connected room with code, invite URL, Ready and Start Duo Climb', () => {
      const onStart = jest.fn();
      const onReady = jest.fn();
      const roomScreen = render(
        wrap(
          el(SpireCoopLobby, {
            roomCode: 'FOX7',
            connectionState: 'connected',
            isHost: true,
            localPlayer: {
              playerId: 'p1',
              role: 'host',
              name: 'Orange Tabby',
              fighter: 'Orange Tabby',
              ready: true,
              connected: true,
              hearts: 5,
              maxHearts: 5,
            },
            allyPlayer: {
              playerId: 'p2',
              role: 'guest',
              name: 'Sly Fox',
              fighter: 'Sly Fox',
              ready: true,
              connected: true,
              hearts: 5,
              maxHearts: 5,
            },
            selectedFighter: 'Orange Tabby',
            ascension: 0,
            maxSelectableAsc: 1,
            canStartClimb: true,
            coopServer: 'http://127.0.0.1:8787',
            onSelectFighter: () => {},
            onCreateRoom: () => {},
            onJoinRoom: () => {},
            onLeaveRoom: () => {},
            onToggleReady: onReady,
            onStartClimb: onStart,
          })
        )
      );
      expect(roomScreen.getByTestId('coop-room-code').props.children).toBe('FOX7');
      expect(roomScreen.getByTestId('coop-ally-status')).toBeTruthy();
      expect(roomScreen.getByTestId('coop-invite-url').props.children).toContain('coop=FOX7');
      fireEvent.press(roomScreen.getByTestId('coop-ready-btn'));
      expect(onReady).toHaveBeenCalledTimes(1);
      fireEvent.press(roomScreen.getByTestId('coop-start-btn'));
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('renders SpireCoopBanner with room code, ally status, and reconnecting banner', () => {
      const screen = render(
        wrap(
          el(SpireCoopBanner, {
            roomCode: 'FOX7',
            connectionState: 'connected',
            ally: {
              playerId: 'p2',
              role: 'guest',
              name: 'Sly Fox',
              fighter: 'Sly Fox',
              ready: true,
              connected: false,
              hearts: 4,
              maxHearts: 5,
            },
            notice: 'Fox gifted you +2 ♥!',
          })
        )
      );
      expect(screen.getByTestId('coop-banner-room-code')).toBeTruthy();
      expect(screen.getByTestId('coop-reconnecting-banner')).toBeTruthy();
      expect(screen.getByTestId('coop-banner-notice')).toBeTruthy();
    });

    it('auto-selects 2P Co-Op Duo in SpireSetup when initialCoopCode is passed', () => {
      const screen = render(
        wrap(
          el(SpireSetup, {
            activeRun: null,
            meta: createInitialSpireMeta(),
            initialCoopCode: 'FOX7',
            onStartNew: () => {},
            onResume: () => {},
            onAbandonActive: () => {},
            onExit: () => {},
          })
        )
      );
      expect(screen.getByTestId('spire-mode-solo')).toBeTruthy();
      expect(screen.getByTestId('spire-mode-coop')).toBeTruthy();
      expect(screen.getByTestId('coop-lobby')).toBeTruthy();
    });

    it('renders dual-critter vote badges and mismatch prompt on SpireMap', () => {
      const run = createSpireRun('Orange Tabby', 0, 1234);
      const reachable = reachableNodeIds(run.map, run.currentNodeId);
      expect(reachable.length).toBeGreaterThanOrEqual(2);
      const screen = render(
        wrap(
          el(SpireMap, {
            run,
            onSelectNode: () => {},
            coopVotes: {
              localPlayerId: 'p1',
              localFighter: 'Orange Tabby',
              localVoteNodeId: reachable[0],
              allyFighter: 'Emperor Penguin',
              allyName: 'Emperor Penguin',
              allyVoteNodeId: reachable[1],
              allyConnected: true,
              votesDiffer: true,
            },
          })
        )
      );
      expect(screen.getByTestId(`spire-node-${reachable[0]}`)).toBeTruthy();
      expect(screen.getByTestId(`spire-node-vote-local-${reachable[0]}`)).toBeTruthy();
      expect(screen.getByTestId(`spire-node-vote-ally-${reachable[1]}`)).toBeTruthy();
      expect(screen.getByText('Waiting for ally to agree…')).toBeTruthy();
    });

    it('supports Gift to Ally mode & Gift Heal in SpireShop', () => {
      const base = createSpireRun('Orange Tabby', 0, 2222);
      const shopNode = findNodeByKind(base, 'shop');
      const run = selectSpireNode(
        {
          ...base,
          coins: 400,
          currentNodeId: null,
          map: { ...base.map, nodes: base.map.nodes.map(n => (n.id === shopNode.id ? { ...n, row: 0 } : n)) },
        },
        shopNode.id
      );
      const onGiftHeal = jest.fn();
      const onGiftWeapon = jest.fn();
      const screen = render(
        wrap(
          el(SpireShop, {
            run,
            shop: run.shop!,
            onBuyWeapon: () => {},
            onBuyArcana: () => {},
            onBuyUpgrade: () => {},
            onBuyHeal: () => {},
            onForgeWeapon: () => {},
            onReroll: () => {},
            onLeave: () => {},
            coopShop: {
              allyName: 'Sly Fox',
              allyFighter: 'Sly Fox',
              allyHearts: 3,
              allyMaxHearts: 5,
              allyConnected: true,
              giftHealCost: 45,
              giftHealAmount: 2,
              giftedHeal: false,
              localReady: false,
              allyReady: false,
              onGiftHealToAlly: onGiftHeal,
              onGiftWeaponToAlly: onGiftWeapon,
            },
          })
        )
      );
      fireEvent.press(screen.getByTestId('spire-shop-gift-heal'));
      expect(onGiftHeal).toHaveBeenCalledTimes(1);

      fireEvent.press(screen.getByTestId('spire-shop-gift-toggle'));
      fireEvent.press(screen.getByTestId('spire-shop-gift-weapon-0'));
      expect(onGiftWeapon).toHaveBeenCalledWith(0);
    });

    it('renders both critters and Heal Ally / Duo Forge actions in SpireCampfire', () => {
      const base = createSpireRun('Orange Tabby', 0, 3333);
      const campNode = findNodeByKind(base, 'campfire');
      const run = selectSpireNode(
        {
          ...base,
          currentNodeId: null,
          map: { ...base.map, nodes: base.map.nodes.map(n => (n.id === campNode.id ? { ...n, row: 0 } : n)) },
        },
        campNode.id
      );
      const onHealAlly = jest.fn();
      const onDuoForge = jest.fn();
      const screen = render(
        wrap(
          el(SpireCampfire, {
            run,
            campfire: run.campfire!,
            onRest: () => {},
            onForge: () => {},
            onMeditate: () => {},
            onLeave: () => {},
            coopCampfire: {
              allyName: 'Sly Fox',
              allyFighter: 'Sly Fox',
              allyHearts: 2,
              allyMaxHearts: 5,
              allyConnected: true,
              allyHealAmount: 2,
              localReady: false,
              allyReady: false,
              onHealAlly,
              onDuoForge,
            },
          })
        )
      );
      expect(screen.getByTestId('spire-campfire-ally-avatar')).toBeTruthy();
      fireEvent.press(screen.getByTestId('spire-campfire-heal-ally'));
      expect(onHealAlly).toHaveBeenCalledTimes(1);

      fireEvent.press(screen.getByTestId('spire-campfire-duo-forge-open'));
      fireEvent.press(screen.getByTestId(`spire-campfire-duo-forge-${run.weapons[0]}`));
      expect(onDuoForge).toHaveBeenCalledWith(run.weapons[0]);
    });

    it('turns SpireRewardScreen Continue into a Ready barrier in Co-Op', () => {
      const run = createSpireRun('Orange Tabby', 0, 4444);
      const reward: SpireRewardBundle = {
        nodeKind: 'skirmish',
        foeName: 'Meadow Slime',
        coinsEarned: 40,
        parryBonusCoins: 0,
        dpm: 120,
        biggestHit: 42,
        parries: 1,
        perfectParries: 0,
        weaponOptions: [],
        weaponClaimed: true,
        weaponRerolled: false,
        arcanaOptions: [],
        arcanaClaimed: true,
        skillOptions: [],
        skillClaimed: true,
        isActBoss: false,
      };
      const onContinue = jest.fn();
      const screen = render(
        wrap(
          el(SpireRewardScreen, {
            run,
            reward,
            lastFight: null,
            onClaimWeapon: () => {},
            onRerollWeapons: () => {},
            onSkipWeapon: () => {},
            onClaimArcana: () => {},
            onSkipArcana: () => {},
            onClaimSkill: () => {},
            onSkipSkill: () => {},
            onContinue,
            coopReady: {
              allyName: 'Fox',
              localReady: false,
              allyReady: false,
              allyConnected: true,
            },
          })
        )
      );
      expect(screen.getByText('Ready')).toBeTruthy();
      fireEvent.press(screen.getByTestId('spire-reward-continue'));
      expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it('shows Waiting state on SpireRewardScreen Ready barrier until ally is ready', () => {
      const run = createSpireRun('Orange Tabby', 0, 4444);
      const reward: SpireRewardBundle = {
        nodeKind: 'skirmish',
        foeName: 'Meadow Slime',
        coinsEarned: 40,
        parryBonusCoins: 0,
        dpm: 120,
        biggestHit: 42,
        parries: 1,
        perfectParries: 0,
        weaponOptions: [],
        weaponClaimed: true,
        weaponRerolled: false,
        arcanaOptions: [],
        arcanaClaimed: true,
        skillOptions: [],
        skillClaimed: true,
        isActBoss: false,
      };
      const waitingScreen = render(
        wrap(
          el(SpireRewardScreen, {
            run,
            reward,
            lastFight: null,
            onClaimWeapon: () => {},
            onRerollWeapons: () => {},
            onSkipWeapon: () => {},
            onClaimArcana: () => {},
            onSkipArcana: () => {},
            onClaimSkill: () => {},
            onSkipSkill: () => {},
            onContinue: () => {},
            coopReady: {
              allyName: 'Fox',
              localReady: true,
              allyReady: false,
              allyConnected: true,
            },
          })
        )
      );
      expect(waitingScreen.getByTestId('spire-reward-coop-status')).toBeTruthy();
      expect(waitingScreen.getAllByText('Waiting for Fox…').length).toBeGreaterThanOrEqual(1);
    });
  });
});
