/**
 * Starfall Summit — 2P Co-Op Session Controller Hook (`useCoopSummit`).
 *
 * Connects the cross-platform `CoopClient` (`src/coop/client.ts`) to every
 * Summit screen:
 *  - Lobby (create/join, auto-join from `?mode=summit&coop=CODE`, fighter/ready/start)
 *  - Map voting (`VOTE_NODE` → `NODE_SELECTED`)
 *  - Authoritative combat sync (`CoopCombatSession` for `AdventureRun`)
 *  - Phase Ready barriers (`PHASE_READY` → `PHASE_ADVANCED`) across Reward, Shop,
 *    Campfire, Event, Treasure, and Preview
 *  - Cross-player Shop & Campfire gifts (`shop_gift`: heal, weapon, forge spark)
 *  - Mid-climb reload & reconnect recovery (persists room session per tab via
 *    `sessionStorage` and immediately hydrates from DO `SNAPSHOT`).
 *
 * Strictly obeys NShapes performance/battery guardrails: zero raw `AppState`,
 * `visibilitychange`, `setInterval`, or `useFrameCallback`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CharacterName } from '@/types';
import { normalizeCoopRoomCode } from '@/adventure/dailySeed';
import { randomSeed } from '@/adventure/engine/rng';
import type { SummitThemePackId } from '../data/themePacks';
import { spireEncounterToLevel } from '../engine/bridge';
import {
  applyCoopCampfireDuoForge,
  applyCoopCampfireHealAlly,
  applyCoopReceivedDuoForgeSpark,
  applyCoopReceivedHeal,
  applyCoopReceivedWeaponGift,
  applyCoopShopGiftHeal,
  applyCoopShopGiftWeapon,
  COOP_SHOP_GIFT_HEAL_AMOUNT,
  evaluateMapVoteConsensus,
} from '../engine/coopHelpers';
import { reachableNodeIds } from '../engine/mapGen';
import {
  createSpireRun,
  finishSpireRewards,
  leaveCampfire,
  leaveEvent,
  leaveShop,
  leaveTreasure,
  selectSpireNode,
  startSpireEncounter,
} from '../engine/runState';
import type {
  SpireCoopCampfireConfig,
  SpireCoopConnectionState,
  SpireCoopMapVotes,
  SpireCoopPlayerView,
  SpireCoopReadyBarrier,
  SpireCoopShopConfig,
  SpireRun,
} from '../types';
import type {
  CoopClientLike,
  CoopClientOptions,
  CoopCombatGiftKind,
  CoopCombatSession,
  CoopConnectionStatus,
  CoopEmoteKind,
  CoopInboundEvent,
  CoopPhase,
  CoopPlayerInfo,
  CoopRoomSnapshot,
  CoopServerMessage,
} from './coopContracts';

const MAX_INBOUND_EVENTS = 30;
const GIFT_CHARGE_MAX = 3;
const NOTICE_DURATION_MS = 4000;
const SESSION_KEY_PREFIX = 'nshapes_spire_coop_v1_';

interface StoredCoopSession {
  roomCode: string;
  playerId: string;
  sessionToken?: string | null;
  fighter: CharacterName;
  run?: SpireRun | null;
}

const getSessionStorage = (): Storage | null => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {
    // sessionStorage unavailable (e.g. private mode or React Native)
  }
  return null;
};

const loadStoredSession = (code: string): StoredCoopSession | null => {
  const ss = getSessionStorage();
  if (!ss) return null;
  try {
    const raw = ss.getItem(`${SESSION_KEY_PREFIX}${code}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCoopSession>;
    if (!parsed || typeof parsed.playerId !== 'string' || typeof parsed.fighter !== 'string') {
      return null;
    }
    return {
      roomCode: code,
      playerId: parsed.playerId,
      sessionToken: parsed.sessionToken ?? null,
      fighter: parsed.fighter as CharacterName,
      run: parsed.run ?? null,
    };
  } catch {
    return null;
  }
};

const saveStoredSession = (session: StoredCoopSession): void => {
  const ss = getSessionStorage();
  if (!ss) return;
  try {
    ss.setItem(`${SESSION_KEY_PREFIX}${session.roomCode}`, JSON.stringify(session));
  } catch {
    // quota / unavailable
  }
};

const clearStoredSession = (code?: string | null): void => {
  const ss = getSessionStorage();
  if (!ss || !code) return;
  try {
    ss.removeItem(`${SESSION_KEY_PREFIX}${code}`);
  } catch {
    // ignore
  }
};

const loadDefaultCoopClient = (opts: CoopClientOptions): CoopClientLike => {
  const mod = require('@/coop/client') as {
    CoopClient: new (options?: CoopClientOptions) => CoopClientLike;
  };
  return new mod.CoopClient(opts);
};

const mapConnectionStatus = (
  status: CoopConnectionStatus,
  creating: boolean
): SpireCoopConnectionState => {
  if (creating) return 'creating';
  switch (status) {
    case 'connecting':
      return 'connecting';
    case 'connected':
      return 'connected';
    case 'reconnecting':
      return 'reconnecting';
    case 'error':
      return 'error';
    default:
      return 'idle';
  }
};

const toPlayerView = (p: CoopPlayerInfo | null | undefined): SpireCoopPlayerView | null => {
  if (!p) return null;
  return {
    playerId: p.playerId,
    role: p.role,
    name: p.name,
    fighter: p.fighter,
    ready: p.ready,
    connected: p.connected,
    hearts: p.hearts,
    maxHearts: p.maxHearts,
    caged: p.caged,
  };
};

const toEmoteKind = (raw: string): CoopEmoteKind => {
  const lower = raw.toLowerCase();
  if (lower.includes('parry')) return 'parry';
  if (lower.includes('help') || lower.includes('cage') || lower.includes('rescue')) return 'help';
  if (lower.includes('gift')) return 'gift';
  if (lower.includes('ready')) return 'ready';
  if (lower.includes('nice')) return 'nice';
  return 'cheer';
};

/**
 * Deterministically reconstruct a co-op SpireRun from an authoritative DO room
 * `SNAPSHOT` (used both when launching a new climb and when reconnecting after
 * a mid-climb page reload!).
 */
export const reconstructCoopRunFromSnapshot = (
  snapshot: CoopRoomSnapshot,
  localPlayer: CoopPlayerInfo
): SpireRun => {
  let next: SpireRun = {
    ...createSpireRun(localPlayer.fighter, snapshot.ascension, snapshot.seed, {
      themePacks: snapshot.themePacks?.length === 2 ? snapshot.themePacks : undefined,
    }),
    coopPartySize: 2,
    coopRoomCode: snapshot.code,
  };

  if (snapshot.currentNodeId) {
    // Advance deterministically into the active node if it exists on the current Act map
    const targetNode = next.map.nodes.find(n => n.id === snapshot.currentNodeId);
    if (targetNode) {
      // Allow direct jump on mid-climb reconnect even if previous rows weren't replayed locally
      const reachable = reachableNodeIds(next.map, next.currentNodeId);
      if (reachable.includes(targetNode.id)) {
        next = selectSpireNode(next, targetNode.id);
      } else {
        const directBase: SpireRun = {
          ...next,
          currentNodeId: null,
          map: {
            ...next.map,
            nodes: next.map.nodes.map(n =>
              n.id === targetNode.id ? { ...n, row: 0 } : n
            ),
          },
        };
        next = {
          ...selectSpireNode(directBase, targetNode.id),
          map: next.map,
          floor: Math.max(1, snapshot.floor),
        };
      }
      if (snapshot.phase === 'fight' && next.phase === 'preview') {
        next = startSpireEncounter(next);
      }
    }
  }

  return {
    ...next,
    hearts: Math.max(0, Math.min(localPlayer.maxHearts || next.maxHearts, localPlayer.hearts || next.hearts)),
    maxHearts: Math.max(3, localPlayer.maxHearts || next.maxHearts),
    floor: Math.max(next.floor, snapshot.floor),
    coopPartySize: 2,
    coopRoomCode: snapshot.code,
  };
};

export interface UseCoopSummitOptions {
  initialCoopCode?: string;
  initialCoopServer?: string;
  selectedFighter: CharacterName;
  ascension: number;
  seed: number;
  themePacks?: readonly SummitThemePackId[];
  /** Current active SpireRun in SpireMode (null when in setup) */
  run: SpireRun | null;
  /** True while SpireMode is on SpireSetup */
  inSetup: boolean;
  /** Apply a new/updated co-op SpireRun into SpireMode state (without overwriting solo save!) */
  onSetCoopRun: (next: SpireRun | null, opts?: { enterRun?: boolean; exitToSetup?: boolean }) => void;
  /** Optional dependency injection for unit tests */
  clientFactory?: (opts: CoopClientOptions) => CoopClientLike;
}

export interface UseCoopSummitResult {
  /** True once a Duo Climb has left the lobby and is actively running */
  isCoopClimbActive: boolean;
  /** Active 4-char room code (in lobby or active climb) */
  roomCode: string | null;
  connectionState: SpireCoopConnectionState;
  errorMessage: string | null;
  isHost: boolean;
  localPlayer: SpireCoopPlayerView | null;
  allyPlayer: SpireCoopPlayerView | null;
  canStartClimb: boolean;
  snapshot: CoopRoomSnapshot | null;
  /** Transient banner notice (e.g. ally shop/campfire gift received) */
  notice: string | null;
  /** True when ally has clicked Ready for the current non-combat phase barrier */
  allyPhaseReady: boolean;

  // Lobby actions
  createRoom: () => Promise<void>;
  joinRoom: (code: string) => void;
  leaveRoom: () => void;
  updateFighter: (fighter: CharacterName) => void;
  updateAscension: (ascension: number) => void;
  toggleLobbyReady: () => void;
  startDuoClimb: () => void;

  // Climb actions
  voteMapNode: (nodeId: string) => void;
  markPhaseReady: (nextPhase?: CoopPhase, opts?: { act?: number; floor?: number }) => void;
  syncHearts: (hearts: number, maxHearts: number) => void;
  startActiveEncounterFight: (runForFight: SpireRun) => void;

  // Ready-to-pass UI props for Summit screens
  mapVotes: SpireCoopMapVotes | undefined;
  shopConfig: SpireCoopShopConfig | undefined;
  campfireConfig: SpireCoopCampfireConfig | undefined;
  rewardReadyBarrier: SpireCoopReadyBarrier | undefined;
  combatSession: CoopCombatSession | undefined;
}

export const useCoopSummit = ({
  initialCoopCode,
  initialCoopServer,
  selectedFighter,
  ascension,
  seed,
  themePacks,
  run,
  inSetup,
  onSetCoopRun,
  clientFactory = loadDefaultCoopClient,
}: UseCoopSummitOptions): UseCoopSummitResult => {
  const clientRef = useRef<CoopClientLike | null>(null);
  const runRef = useRef<SpireRun | null>(run);
  runRef.current = run;
  const inSetupRef = useRef<boolean>(inSetup);
  inSetupRef.current = inSetup;
  const onSetCoopRunRef = useRef(onSetCoopRun);
  onSetCoopRunRef.current = onSetCoopRun;
  const fighterRef = useRef<CharacterName>(selectedFighter);
  fighterRef.current = selectedFighter;

  const [snapshot, setSnapshot] = useState<CoopRoomSnapshot | null>(null);
  const [clientStatus, setClientStatus] = useState<CoopConnectionStatus>('idle');
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [giftedShopHealFloor, setGiftedShopHealFloor] = useState<number | null>(null);
  const [giftCharge, setGiftCharge] = useState<number>(0);
  const [inboundEvents, setInboundEvents] = useState<CoopInboundEvent[]>([]);

  const eventSeqRef = useRef(0);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStartedFightNodeRef = useRef<string | null>(null);
  const lastSyncedHeartsRef = useRef<{ hearts: number; maxHearts: number } | null>(null);
  const prevPhaseRef = useRef<CoopPhase | null>(null);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), NOTICE_DURATION_MS);
  }, []);

  const pushInboundEvent = useCallback((ev: CoopInboundEvent) => {
    setInboundEvents(prev => {
      const next = [...prev, ev];
      return next.length > MAX_INBOUND_EVENTS ? next.slice(next.length - MAX_INBOUND_EVENTS) : next;
    });
  }, []);

  const sendStartFightForRun = useCallback((targetRun: SpireRun) => {
    const client = clientRef.current;
    const enc = targetRun.activeEncounter;
    const nodeId = targetRun.currentNodeId;
    if (!client || !enc || !nodeId) return;
    const fightKey = `${targetRun.act}-${targetRun.floor}-${nodeId}`;
    if (lastStartedFightNodeRef.current === fightKey) return;
    lastStartedFightNodeRef.current = fightKey;
    const scaledLevel = spireEncounterToLevel(targetRun, enc, { coopPartySize: 2 });
    const firstFoe = scaledLevel.foes[0];
    const bossMaxHp = firstFoe?.hp ?? 100;
    client.startFight({
      fightId: `${targetRun.coopRoomCode ?? 'coop'}-${fightKey}`,
      nodeId,
      foeName: enc.name,
      bossMaxHp,
      totalWaves: scaledLevel.foes.length,
      timerSec: scaledLevel.rules.timer ?? enc.timer,
      parryCooldownMs: enc.parry.cooldownMs,
      parryWindupMs: enc.parry.windupMs,
      parryStaggerMs: enc.parry.staggerMs,
    });
  }, []);

  const handleServerMessage = useCallback(
    (msg: CoopServerMessage) => {
      const client = clientRef.current;
      const localPid = client?.getPlayerId() ?? '';
      const snap = client?.getSnapshot();
      const ally = snap?.players.find(p => p.playerId !== localPid) ?? null;
      const allyName = ally?.name ?? 'Partner';

      switch (msg.type) {
        case 'PLAYER_PRESENCE': {
          setSnapshot(prev =>
            prev
              ? {
                  ...prev,
                  players: prev.players.map(p =>
                    p.playerId === msg.playerId ? { ...p, connected: msg.connected } : p
                  ),
                }
              : prev
          );
          break;
        }

        case 'VOTE_UPDATED': {
          setSnapshot(prev => {
            if (!prev) return prev;
            const mapVotes = msg.mapVotes
              ? { ...msg.mapVotes }
              : msg.playerId !== undefined
                ? { ...prev.mapVotes, [msg.playerId]: msg.nodeId ?? null }
                : prev.mapVotes;
            return { ...prev, mapVotes };
          });
          break;
        }

        case 'PHASE_READY_UPDATED': {
          setSnapshot(prev => {
            if (!prev) return prev;
            const phaseReady = msg.phaseReady
              ? { ...msg.phaseReady }
              : msg.playerId !== undefined
                ? { ...prev.phaseReady, [msg.playerId]: Boolean(msg.ready) }
                : prev.phaseReady;
            return { ...prev, phaseReady };
          });
          break;
        }

        case 'NODE_SELECTED': {
          setSnapshot(prev =>
            prev
              ? {
                  ...prev,
                  phase: msg.nextPhase,
                  currentNodeId: msg.nodeId,
                  mapVotes: {},
                  phaseReady: {},
                }
              : prev
          );
          const cur = runRef.current;
          if (!cur || cur.phase !== 'map') return;
          let next = selectSpireNode(cur, msg.nodeId);
          if (msg.nextPhase === 'fight' && next.phase === 'preview') {
            next = startSpireEncounter(next);
          }
          setGiftCharge(0);
          setInboundEvents([]);
          onSetCoopRunRef.current(next);
          if (next.phase === 'fight') {
            sendStartFightForRun(next);
          }
          break;
        }

        case 'PHASE_ADVANCED': {
          setSnapshot(prev =>
            prev
              ? {
                  ...prev,
                  phase: msg.toPhase,
                  act: msg.act,
                  floor: msg.floor,
                  phaseReady: {},
                  mapVotes: {},
                }
              : prev
          );
          const cur = runRef.current;
          if (!cur) return;
          if (msg.fromPhase === 'preview' && msg.toPhase === 'fight' && cur.phase === 'preview') {
            const next = startSpireEncounter(cur);
            setGiftCharge(0);
            setInboundEvents([]);
            onSetCoopRunRef.current(next);
            sendStartFightForRun(next);
            return;
          }
          if (msg.fromPhase === 'reward' && cur.phase === 'reward') {
            const next = finishSpireRewards(cur);
            onSetCoopRunRef.current(next);
            return;
          }
          if (msg.fromPhase === 'shop' && cur.phase === 'shop') {
            onSetCoopRunRef.current(leaveShop(cur));
            return;
          }
          if (msg.fromPhase === 'campfire' && cur.phase === 'campfire') {
            onSetCoopRunRef.current(leaveCampfire(cur));
            return;
          }
          if (msg.fromPhase === 'event' && cur.phase === 'event') {
            const next = leaveEvent(cur);
            onSetCoopRunRef.current(next.phase === 'preview' && msg.toPhase === 'map' ? { ...next, activeEncounter: null, phase: 'map' } : next);
            return;
          }
          if (msg.fromPhase === 'treasure' && cur.phase === 'treasure') {
            onSetCoopRunRef.current(leaveTreasure(cur));
            return;
          }
          break;
        }

        case 'FIGHT_STARTED': {
          setSnapshot(prev => (prev ? { ...prev, phase: 'fight', fight: msg.fight } : prev));
          break;
        }

        case 'BOSS_DAMAGED': {
          setSnapshot(prev =>
            prev?.fight
              ? {
                  ...prev,
                  fight: {
                    ...prev.fight,
                    bossHp: msg.bossHp,
                    bossMaxHp: msg.bossMaxHp,
                  },
                }
              : prev
          );
          if (msg.fromPlayerId && msg.fromPlayerId !== localPid && msg.amount > 0) {
            pushInboundEvent({
              id: `hit-${msg.seq}-${++eventSeqRef.current}`,
              kind: 'ally_hit',
              amount: msg.amount,
              allyName,
              isRainbow: msg.isRainbow,
              isBig: msg.amount >= 50 || Boolean(msg.isPerfect),
            });
          }
          break;
        }

        case 'PARRY_SYNC': {
          setSnapshot(prev =>
            prev?.fight
              ? {
                  ...prev,
                  fight: {
                    ...prev.fight,
                    parryPhase: msg.parryPhase,
                    parryMsLeft: msg.parryMsLeft,
                    parryDurationMs: msg.parryDurationMs,
                    fairnessStalled: msg.fairnessStalled,
                    parryStallsUsed: msg.parryStallsUsed,
                    boardHasCounter: msg.boardHasCounter,
                    totalParries: msg.totalParries,
                  },
                }
              : prev
          );
          if (
            msg.fromPlayerId &&
            msg.fromPlayerId !== localPid &&
            (msg.kind === 'parry' || msg.kind === 'perfect')
          ) {
            pushInboundEvent({
              id: `parry-${msg.seq}-${++eventSeqRef.current}`,
              kind: 'cross_parry',
              perfect: msg.kind === 'perfect',
              staggerMs: msg.parryMsLeft,
              allyName,
            });
          }
          break;
        }

        case 'SYNERGY_SYNC': {
          setSnapshot(prev =>
            prev?.fight
              ? {
                  ...prev,
                  fight: {
                    ...prev.fight,
                    synergy: msg.synergy,
                  },
                }
              : prev
          );
          break;
        }

        case 'PLAYER_CAGED': {
          setSnapshot(prev =>
            prev
              ? {
                  ...prev,
                  players: prev.players.map(p =>
                    p.playerId === msg.playerId
                      ? {
                          ...p,
                          hearts: 0,
                          caged: true,
                          rescueProgress: msg.rescueProgress,
                          rescueNeeded: msg.rescueNeeded,
                        }
                      : p
                  ),
                }
              : prev
          );
          break;
        }

        case 'PLAYER_RESCUE_PROGRESS': {
          setSnapshot(prev =>
            prev
              ? {
                  ...prev,
                  players: prev.players.map(p =>
                    p.playerId === msg.playerId
                      ? {
                          ...p,
                          rescueProgress: msg.rescueProgress,
                          rescueNeeded: msg.rescueNeeded,
                        }
                      : p
                  ),
                }
              : prev
          );
          break;
        }

        case 'PLAYER_REVIVED': {
          setSnapshot(prev =>
            prev
              ? {
                  ...prev,
                  players: prev.players.map(p =>
                    p.playerId === msg.playerId
                      ? {
                          ...p,
                          caged: false,
                          hearts: msg.hearts,
                          rescueProgress: 0,
                        }
                      : p
                  ),
                }
              : prev
          );
          const isLocal = msg.playerId === localPid;
          const rescuedName = isLocal ? (client?.getLocalPlayer()?.name ?? 'You') : allyName;
          pushInboundEvent({
            id: `revive-${msg.seq}-${++eventSeqRef.current}`,
            kind: 'ally_rescued',
            rescuedName,
            isLocal,
          });
          break;
        }

        case 'FIGHT_ENDED': {
          setSnapshot(prev =>
            prev
              ? {
                  ...prev,
                  phase: msg.nextPhase,
                  fight: msg.fight,
                }
              : prev
          );
          break;
        }

        case 'EMOTE_RECEIVED': {
          if (msg.fromPlayerId !== localPid) {
            pushInboundEvent({
              id: `emote-${msg.seq}-${++eventSeqRef.current}`,
              kind: 'ally_emote',
              emote: msg.text || msg.emote,
              fromName: allyName,
            });
          }
          break;
        }

        case 'GIFT_RECEIVED': {
          if (msg.toPlayerId !== localPid) return;
          if (msg.kind === 'shop_gift' && msg.shopGift) {
            const cur = runRef.current;
            if (!cur) return;
            const sg = msg.shopGift;
            if (sg.giftType === 'heal') {
              const res = applyCoopReceivedHeal(cur, sg.healAmount ?? COOP_SHOP_GIFT_HEAL_AMOUNT);
              onSetCoopRunRef.current(res.run);
              client?.updateHearts(res.run.hearts, { maxHearts: res.run.maxHearts });
              showNotice(
                res.gained > 0
                  ? `${allyName} gifted you +${res.gained} ♥!`
                  : `${allyName} sent you a healing tonic!`
              );
            } else if (sg.giftType === 'weapon' && sg.weaponId) {
              const res = applyCoopReceivedWeaponGift(cur, sg.weaponId, sg.weaponLevel ?? 1);
              onSetCoopRunRef.current(res.run);
              showNotice(
                res.applied === 'coins'
                  ? `${allyName} gifted ${sg.label ?? sg.weaponId} (+${res.bonusCoins}¢ — belt full)!`
                  : `${allyName} gifted you ${sg.label ?? sg.weaponId}!`
              );
            } else if (sg.giftType === 'forge') {
              const res = applyCoopReceivedDuoForgeSpark(cur);
              onSetCoopRunRef.current(res.run);
              showNotice(
                res.upgradedWeaponId
                  ? `${allyName}'s Duo Forge upgraded your belt (+1 Lv)!`
                  : `${allyName}'s Duo Forge granted +${res.bonusCoins}¢!`
              );
            }
          } else if (msg.kind === 'wild_card' || msg.kind === 'heal' || msg.kind === 'cleanse') {
            pushInboundEvent({
              id: `gift-${msg.seq}-${++eventSeqRef.current}`,
              kind: 'gift_received',
              gift: msg.kind,
              fromName: allyName,
            });
          }
          break;
        }

        case 'ERROR': {
          setErrorMessage(msg.message);
          break;
        }
      }
    },
    [pushInboundEvent, sendStartFightForRun, showNotice]
  );

  const handleSnapshot = useCallback((nextSnap: CoopRoomSnapshot) => {
    setSnapshot(nextSnap);
    setRoomCode(nextSnap.code);
    setErrorMessage(null);

    const client = clientRef.current;
    const localPid = client?.getPlayerId();
    const local = nextSnap.players.find(p => p.playerId === localPid) ?? null;

    if (local) {
      saveStoredSession({
        roomCode: nextSnap.code,
        playerId: local.playerId,
        sessionToken: client?.getSessionToken() ?? null,
        fighter: local.fighter,
        run: runRef.current,
      });
    }

    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = nextSnap.phase;

    // Launch or hydrate active climb when room moves out of lobby (or reconnects mid-climb!)
    if (nextSnap.phase !== 'lobby' && local) {
      const cur = runRef.current;
      const needsLaunch = !cur || cur.coopRoomCode !== nextSnap.code || inSetupRef.current;
      if (needsLaunch) {
        const stored = loadStoredSession(nextSnap.code);
        let hydrated: SpireRun;
        if (stored?.run && stored.run.coopRoomCode === nextSnap.code && stored.run.seed === nextSnap.seed) {
          hydrated = stored.run;
          // Ensure phase aligns with authoritative room snapshot on reconnect
          if (nextSnap.phase === 'fight' && hydrated.phase === 'preview') {
            hydrated = startSpireEncounter(hydrated);
          } else if (
            nextSnap.currentNodeId &&
            hydrated.currentNodeId !== nextSnap.currentNodeId &&
            hydrated.phase === 'map'
          ) {
            hydrated = selectSpireNode(hydrated, nextSnap.currentNodeId);
            if (nextSnap.phase === 'fight' && hydrated.phase === 'preview') {
              hydrated = startSpireEncounter(hydrated);
            }
          }
          hydrated = {
            ...hydrated,
            hearts: Math.max(0, Math.min(hydrated.maxHearts, local.hearts)),
          };
        } else {
          hydrated = reconstructCoopRunFromSnapshot(nextSnap, local);
        }
        onSetCoopRunRef.current(hydrated, { enterRun: true });
        if (nextSnap.phase === 'fight' && !nextSnap.fight && hydrated.phase === 'fight') {
          sendStartFightForRun(hydrated);
        }
      } else if (prevPhase === 'lobby' && nextSnap.phase === 'map') {
        const fresh = reconstructCoopRunFromSnapshot(nextSnap, local);
        onSetCoopRunRef.current(fresh, { enterRun: true });
      }
    }
  }, [sendStartFightForRun]);

  const ensureClient = useCallback(
    (savedPlayerId?: string): CoopClientLike => {
      if (clientRef.current) {
        if (!savedPlayerId || clientRef.current.getPlayerId() === savedPlayerId) {
          return clientRef.current;
        }
        clientRef.current.dispose();
        clientRef.current = null;
      }
      const client = clientFactory({
        serverUrl: initialCoopServer,
        playerId: savedPlayerId,
        name: fighterRef.current,
        fighter: fighterRef.current,
      });
      client.onSnapshot(handleSnapshot);
      client.onMessage(handleServerMessage);
      client.onStatusChange(status => {
        setClientStatus(status);
        if (status === 'connected') setCreating(false);
      });
      client.onError(err => {
        setCreating(false);
        setErrorMessage(err?.message || 'Connection error');
      });
      clientRef.current = client;
      return client;
    },
    [clientFactory, handleServerMessage, handleSnapshot, initialCoopServer]
  );

  // Persist local co-op SpireRun updates into sessionStorage for seamless mid-fight reload recovery
  useEffect(() => {
    if (!run || !run.coopRoomCode) return;
    const client = clientRef.current;
    if (!client) return;
    saveStoredSession({
      roomCode: run.coopRoomCode,
      playerId: client.getPlayerId(),
      sessionToken: client.getSessionToken(),
      fighter: run.fighter,
      run,
    });
  }, [run]);

  // Clean up socket & timers on unmount
  useEffect(
    () => () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      clientRef.current?.dispose();
      clientRef.current = null;
    },
    []
  );

  // ─── Lobby Actions ────────────────────────────────────────────────────────

  const createRoom = useCallback(async () => {
    setErrorMessage(null);
    setCreating(true);
    try {
      const client = ensureClient();
      const res = await client.createAndJoin({
        name: fighterRef.current,
        fighter: fighterRef.current,
      });
      setRoomCode(res.code);
      setCreating(false);
    } catch (err) {
      setCreating(false);
      setErrorMessage(err instanceof Error ? err.message : 'Could not create Duo Room.');
    }
  }, [ensureClient]);

  const joinRoom = useCallback(
    (rawCode: string) => {
      const normalized = normalizeCoopRoomCode(rawCode);
      if (!normalized) {
        setErrorMessage('Enter a valid 4-character room code.');
        return;
      }
      setErrorMessage(null);
      const saved = loadStoredSession(normalized);
      const client = ensureClient(saved?.playerId);
      setRoomCode(normalized);
      const useFighter = saved?.fighter ?? fighterRef.current;
      client.connect(normalized, {
        playerId: saved?.playerId,
        sessionToken: saved?.sessionToken ?? undefined,
        fighter: useFighter,
        name: useFighter,
      });
    },
    [ensureClient]
  );

  const leaveRoom = useCallback(() => {
    const code = roomCode ?? snapshot?.code;
    clearStoredSession(code);
    clientRef.current?.disconnect();
    clientRef.current?.dispose();
    clientRef.current = null;
    setSnapshot(null);
    setRoomCode(null);
    setClientStatus('idle');
    setCreating(false);
    setErrorMessage(null);
    setInboundEvents([]);
    setGiftCharge(0);
    lastStartedFightNodeRef.current = null;
    prevPhaseRef.current = null;
    if (runRef.current?.coopPartySize === 2) {
      onSetCoopRunRef.current(null, { exitToSetup: true });
    }
  }, [roomCode, snapshot?.code]);

  const updateFighter = useCallback((fighter: CharacterName) => {
    fighterRef.current = fighter;
    clientRef.current?.updateLobby({ fighter, name: fighter });
  }, []);

  const updateAscension = useCallback((nextAsc: number) => {
    clientRef.current?.updateLobby({ ascension: nextAsc });
  }, []);

  const toggleLobbyReady = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;
    const local = client.getLocalPlayer();
    client.updateLobby({ ready: !(local?.ready ?? false) });
  }, []);

  const startDuoClimb = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;
    const launchSeed = seed > 0 ? seed : randomSeed();
    client.startClimb({
      seed: launchSeed,
      ascension,
      ...(themePacks?.length === 2 ? { themePacks: [...themePacks] } : {}),
    });
  }, [ascension, seed, themePacks]);

  // ─── Climb Actions ────────────────────────────────────────────────────────

  const voteMapNode = useCallback((nodeId: string) => {
    const client = clientRef.current;
    const cur = runRef.current;
    if (!client || !cur || cur.phase !== 'map') return;
    const node = cur.map.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const isCombat = node.kind === 'skirmish' || node.kind === 'elite' || node.kind === 'boss';
    client.voteNode(nodeId, {
      nodeKind: node.kind,
      ...(isCombat ? { nextPhase: 'fight' as const } : {}),
    });
  }, []);

  const markPhaseReady = useCallback(
    (nextPhase?: CoopPhase, opts?: { act?: number; floor?: number }) => {
      clientRef.current?.setPhaseReady(true, {
        ...(nextPhase ? { nextPhase } : {}),
        ...(opts?.act !== undefined ? { act: opts.act } : {}),
        ...(opts?.floor !== undefined ? { floor: opts.floor } : {}),
      });
    },
    []
  );

  const syncHearts = useCallback((hearts: number, maxHearts: number) => {
    const client = clientRef.current;
    if (!client || !runRef.current?.coopRoomCode) return;
    const last = lastSyncedHeartsRef.current;
    if (last && last.hearts === hearts && last.maxHearts === maxHearts) return;
    lastSyncedHeartsRef.current = { hearts, maxHearts };
    client.updateHearts(hearts, { maxHearts });
  }, []);

  // ─── Derived Player Views & Active Flag ───────────────────────────────────

  const localPid = clientRef.current?.getPlayerId() ?? '';
  const localRaw = useMemo(
    () => snapshot?.players.find(p => p.playerId === localPid) ?? null,
    [snapshot, localPid]
  );
  const allyRaw = useMemo(
    () => snapshot?.players.find(p => p.playerId !== localPid) ?? null,
    [snapshot, localPid]
  );

  const localPlayer = useMemo(() => toPlayerView(localRaw), [localRaw]);
  const allyPlayer = useMemo(() => toPlayerView(allyRaw), [allyRaw]);
  const isHost = localRaw?.role === 'host';
  const isCoopClimbActive = Boolean(run?.coopPartySize === 2 && (roomCode || snapshot?.code));
  const connectionState = mapConnectionStatus(clientStatus, creating);

  const canStartClimb = Boolean(
    isHost &&
      connectionState === 'connected' &&
      localRaw?.ready &&
      allyRaw?.ready &&
      allyRaw?.connected
  );

  const localPhaseReady = Boolean(localPid && snapshot?.phaseReady?.[localPid]);
  const allyPhaseReady = Boolean(allyRaw && snapshot?.phaseReady?.[allyRaw.playerId]);

  // ─── Screen-Specific Co-Op Configs ────────────────────────────────────────

  const mapVotes = useMemo<SpireCoopMapVotes | undefined>(() => {
    if (!isCoopClimbActive || !run || !snapshot) return undefined;
    const reachable = reachableNodeIds(run.map, run.currentNodeId);
    const playerIds = snapshot.players.map(p => p.playerId);
    const consensus = evaluateMapVoteConsensus(snapshot.mapVotes, playerIds, reachable);
    return {
      localPlayerId: localPid,
      localFighter: run.fighter,
      localVoteNodeId: snapshot.mapVotes[localPid] ?? null,
      allyFighter: allyRaw?.fighter ?? null,
      allyName: allyRaw?.name ?? 'Partner',
      allyVoteNodeId: allyRaw ? (snapshot.mapVotes[allyRaw.playerId] ?? null) : null,
      allyConnected: Boolean(allyRaw?.connected),
      votesDiffer: consensus.status === 'mismatch',
    };
  }, [isCoopClimbActive, run, snapshot, localPid, allyRaw]);

  const shopConfig = useMemo<SpireCoopShopConfig | undefined>(() => {
    if (!isCoopClimbActive || !run || run.phase !== 'shop' || !run.shop || !allyRaw) return undefined;
    const shopFloor = run.floor;
    return {
      allyName: allyRaw.name,
      allyFighter: allyRaw.fighter,
      allyHearts: allyRaw.hearts,
      allyMaxHearts: allyRaw.maxHearts,
      allyConnected: allyRaw.connected,
      giftHealCost: run.shop.healCost,
      giftHealAmount: COOP_SHOP_GIFT_HEAL_AMOUNT,
      giftedHeal: giftedShopHealFloor === shopFloor,
      localReady: localPhaseReady,
      allyReady: allyPhaseReady,
      onGiftHealToAlly: () => {
        const cur = runRef.current;
        if (!cur) return;
        const res = applyCoopShopGiftHeal(cur);
        if (!res) return;
        setGiftedShopHealFloor(cur.floor);
        onSetCoopRunRef.current(res.run);
        clientRef.current?.sendGift('shop_gift', {
          shopGift: {
            giftType: 'heal',
            healAmount: res.healAmount,
            label: `Trail Tonic (+${res.healAmount} ♥)`,
          },
        });
        showNotice(`Gifted +${res.healAmount} ♥ to ${allyRaw.name}!`);
      },
      onGiftWeaponToAlly: (offerIndex: number) => {
        const cur = runRef.current;
        if (!cur) return;
        const res = applyCoopShopGiftWeapon(cur, offerIndex);
        if (!res) return;
        onSetCoopRunRef.current(res.run);
        clientRef.current?.sendGift('shop_gift', {
          shopGift: {
            giftType: 'weapon',
            weaponId: res.weaponId,
            weaponLevel: res.level,
            label: res.weaponId,
          },
        });
        showNotice(`Gifted a weapon to ${allyRaw.name}!`);
      },
    };
  }, [isCoopClimbActive, run, allyRaw, giftedShopHealFloor, localPhaseReady, allyPhaseReady, showNotice]);

  const campfireConfig = useMemo<SpireCoopCampfireConfig | undefined>(() => {
    if (!isCoopClimbActive || !run || run.phase !== 'campfire' || !run.campfire || !allyRaw) {
      return undefined;
    }
    const allyHealAmount = Math.max(2, run.campfire.healAmount);
    return {
      allyName: allyRaw.name,
      allyFighter: allyRaw.fighter,
      allyHearts: allyRaw.hearts,
      allyMaxHearts: allyRaw.maxHearts,
      allyConnected: allyRaw.connected,
      allyHealAmount,
      localReady: localPhaseReady,
      allyReady: allyPhaseReady,
      onHealAlly: () => {
        const cur = runRef.current;
        if (!cur) return;
        const res = applyCoopCampfireHealAlly(cur, allyRaw.name, allyHealAmount);
        if (!res) return;
        onSetCoopRunRef.current(res.run);
        clientRef.current?.sendGift('shop_gift', {
          shopGift: {
            giftType: 'heal',
            healAmount: res.allyHealAmount,
            label: `Campfire Warmth (+${res.allyHealAmount} ♥)`,
          },
        });
        showNotice(`Sent +${res.allyHealAmount} ♥ warmth to ${allyRaw.name}!`);
      },
      onDuoForge: (weaponId: string) => {
        const cur = runRef.current;
        if (!cur) return;
        const res = applyCoopCampfireDuoForge(cur, weaponId, allyRaw.name);
        if (!res) return;
        onSetCoopRunRef.current(res.run);
        clientRef.current?.sendGift('shop_gift', {
          shopGift: {
            giftType: 'forge',
            label: 'Duo Forge Spark',
          },
        });
        showNotice(`Sent a Duo Forge spark to ${allyRaw.name}!`);
      },
    };
  }, [isCoopClimbActive, run, allyRaw, localPhaseReady, allyPhaseReady, showNotice]);

  const rewardReadyBarrier = useMemo<SpireCoopReadyBarrier | undefined>(() => {
    if (!isCoopClimbActive || !run || run.phase !== 'reward') return undefined;
    return {
      allyName: allyRaw?.name ?? 'Partner',
      allyFighter: allyRaw?.fighter,
      localReady: localPhaseReady,
      allyReady: allyPhaseReady,
      allyConnected: Boolean(allyRaw?.connected),
    };
  }, [isCoopClimbActive, run, allyRaw, localPhaseReady, allyPhaseReady]);

  // ─── Live Combat Session (`CoopCombatSession` for AdventureRun) ───────────

  const combatSession = useMemo<CoopCombatSession | undefined>(() => {
    if (!isCoopClimbActive || !run || run.phase !== 'fight' || !run.activeEncounter) {
      return undefined;
    }
    const fight = snapshot?.fight;
    const scaledLevel = spireEncounterToLevel(run, run.activeEncounter, { coopPartySize: 2 });
    const fallbackMaxHp = scaledLevel.foes[0]?.hp ?? 100;
    const sharedBossMaxHp = fight?.bossMaxHp ?? fallbackMaxHp;
    const sharedBossHp = fight ? fight.bossHp : sharedBossMaxHp;
    const sharedOutcome: 'playing' | 'won' | 'lost' =
      fight?.outcome === 'victory'
        ? 'won'
        : fight?.outcome === 'defeat'
          ? 'lost'
          : 'playing';
    const sharedDefeatReason =
      fight?.defeatReason === 'both_caged'
        ? 'both_caged'
        : fight?.defeatReason === 'timeout'
          ? 'time_up'
          : fight?.defeatReason === 'retreat'
            ? 'retreat'
            : undefined;
    const sharedTimeLeft =
      fight && fight.startedAt > 0
        ? Math.max(0, Math.ceil(fight.timerSec - (Date.now() - fight.startedAt) / 1000))
        : undefined;

    return {
      state: {
        allyFighter: allyRaw?.fighter ?? 'Sly Fox',
        allyName: allyRaw?.name ?? 'Partner',
        allyHearts: allyRaw?.hearts ?? 5,
        allyMaxHearts: allyRaw?.maxHearts ?? 5,
        allyCaged: Boolean(allyRaw?.caged),
        allyRescueProgress: allyRaw?.rescueProgress ?? 0,
        allyRescueNeeded: allyRaw?.rescueNeeded ?? 3,
        allyConnected: Boolean(allyRaw?.connected),
        allyCombo: allyRaw?.combo ?? 0,
        giftCharge,
        giftChargeMax: GIFT_CHARGE_MAX,
        localCaged: Boolean(localRaw?.caged),
        rescueProgress: localRaw?.rescueProgress ?? 0,
        rescueNeeded: localRaw?.rescueNeeded ?? 3,
        sharedBossHp,
        sharedBossMaxHp,
        sharedParryPhase: fight?.parryPhase,
        sharedParryMsLeft: fight?.parryMsLeft,
        sharedParryDurationMs: fight?.parryDurationMs,
        sharedTimeLeft,
        sharedSynergy: fight?.synergy,
        sharedOutcome,
        sharedDefeatReason,
        inboundEvents,
      },
      callbacks: {
        onDealDamage: ({ amount, combo, isRainbow, isSet }) => {
          clientRef.current?.dealDamage({ amount, combo, isRainbow });
          if (isSet !== false && amount > 0) {
            setGiftCharge(prev => Math.min(GIFT_CHARGE_MAX, prev + 1));
          }
        },
        onParryLanded: ({ perfect, staggerMs }) => {
          clientRef.current?.reportParry({
            kind: perfect ? 'perfect' : 'parry',
            parryPhase: 'staggered',
            staggerMs,
          });
        },
        onSynergyDelta: deltas => {
          clientRef.current?.sendSynergyDelta(deltas);
        },
        onHeartStateChange: ({ hearts, maxHearts }) => {
          clientRef.current?.updateHearts(hearts, { maxHearts });
        },
        onBoardCounterStatus: hasCounter => {
          clientRef.current?.reportBoardCounterStatus(hasCounter);
        },
        onSendGift: (gift: CoopCombatGiftKind) => {
          setGiftCharge(0);
          clientRef.current?.sendGift(gift);
        },
        onSendEmote: emote => {
          clientRef.current?.sendEmote(toEmoteKind(emote), emote);
        },
        onCoopFightOutcome: (outcome, fightRun) => {
          if (
            outcome === 'lost' &&
            (fightRun.endReason === 'survived' || (fightRun.timeLeft !== null && fightRun.timeLeft <= 0))
          ) {
            clientRef.current?.reportFightTimeout();
          }
        },
      },
    };
  }, [isCoopClimbActive, run, snapshot?.fight, allyRaw, localRaw, giftCharge, inboundEvents]);

  return {
    isCoopClimbActive,
    roomCode: roomCode ?? snapshot?.code ?? null,
    connectionState,
    errorMessage,
    isHost,
    localPlayer,
    allyPlayer,
    canStartClimb,
    snapshot,
    notice,
    allyPhaseReady,
    createRoom,
    joinRoom,
    leaveRoom,
    updateFighter,
    updateAscension,
    toggleLobbyReady,
    startDuoClimb,
    voteMapNode,
    markPhaseReady,
    syncHearts,
    startActiveEncounterFight: sendStartFightForRun,
    mapVotes,
    shopConfig,
    campfireConfig,
    rewardReadyBarrier,
    combatSession,
  };
};
