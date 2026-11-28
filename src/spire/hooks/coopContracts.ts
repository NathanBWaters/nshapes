/**
 * Structural TypeScript contracts matching `src/coop/protocol.ts`,
 * `src/coop/client.ts`, and `src/adventure/types.ts` (`CoopCombatSession`).
 *
 * Kept strictly aligned 1:1 with the authoritative backend & combat modules so
 * `useCoopSummit` and `SpireMode` compile cleanly both standalone and after
 * full multi-branch integration, and remain 100% mockable in Jest unit tests.
 */
import type { CharacterName } from '@/types';
import type { RunState, SynergyCounters } from '@/adventure/types';
import type { CoopThemePackId } from '@/coop/protocol';

// ─── Combat-Coop Contract (`src/adventure/types.ts`) ────────────────────────

export type CoopCombatGiftKind = 'wild_card' | 'heal' | 'cleanse';

export type CoopInboundEvent =
  | { id: string; kind: 'ally_hit'; amount: number; allyName?: string; isRainbow?: boolean; isBig?: boolean }
  | { id: string; kind: 'cross_parry'; perfect: boolean; staggerMs?: number; allyName?: string }
  | { id: string; kind: 'gift_received'; gift: CoopCombatGiftKind; fromName?: string }
  | { id: string; kind: 'ally_rescued'; rescuedName?: string; isLocal?: boolean }
  | { id: string; kind: 'ally_emote'; emote: string; fromName?: string };

export interface CoopCombatState {
  allyFighter: CharacterName;
  allyName: string;
  allyHearts: number;
  allyMaxHearts: number;
  allyCaged: boolean;
  allyRescueProgress?: number;
  allyRescueNeeded?: number;
  allyConnected: boolean;
  allyCombo: number;
  giftCharge?: number;
  giftChargeMax?: number;
  localCaged: boolean;
  rescueProgress: number;
  rescueNeeded: number;
  sharedBossHp: number;
  sharedBossMaxHp: number;
  sharedParryPhase?: 'calm' | 'windup' | 'staggered';
  sharedParryMsLeft?: number;
  sharedParryDurationMs?: number;
  sharedTimeLeft?: number;
  sharedSynergy?: Partial<SynergyCounters>;
  sharedOutcome?: 'playing' | 'won' | 'lost';
  sharedDefeatReason?: 'both_caged' | 'time_up' | 'retreat';
  inboundEvents: readonly CoopInboundEvent[];
}

export interface CoopCombatCallbacks {
  onDealDamage: (payload: { amount: number; combo: number; isRainbow?: boolean; isSet?: boolean }) => void;
  onParryLanded: (payload: { perfect: boolean; staggerMs: number }) => void;
  onSynergyDelta: (deltas: Partial<SynergyCounters>) => void;
  onHeartStateChange: (payload: { hearts: number; maxHearts: number; caged: boolean }) => void;
  onBoardCounterStatus: (hasCounter: boolean) => void;
  onSendGift: (gift: CoopCombatGiftKind) => void;
  onSendEmote?: (emote: string) => void;
  onCoopFightOutcome?: (outcome: 'won' | 'lost', run: RunState) => void;
}

export interface CoopCombatSession {
  state: CoopCombatState;
  callbacks: CoopCombatCallbacks;
}

// ─── Backend-DO Protocol & Client Contract (`src/coop/`) ────────────────────

export type CoopPhase =
  | 'lobby'
  | 'map'
  | 'preview'
  | 'fight'
  | 'reward'
  | 'shop'
  | 'campfire'
  | 'event'
  | 'treasure'
  | 'act_clear'
  | 'victory'
  | 'defeat';

export type CoopNodeKind =
  | 'skirmish'
  | 'elite'
  | 'shop'
  | 'campfire'
  | 'event'
  | 'treasure'
  | 'boss';

export type CoopRole = 'host' | 'guest';
export type CoopParryPhase = 'calm' | 'windup' | 'staggered';
export type CoopGiftKind = 'wild_card' | 'heal' | 'cleanse' | 'shop_gift';
export type CoopEmoteKind = 'cheer' | 'nice' | 'parry' | 'help' | 'gift' | 'ready';
export type CoopConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface CoopShopGiftPayload {
  giftType: 'heal' | 'weapon' | 'forge';
  weaponId?: string;
  weaponLevel?: number;
  healAmount?: number;
  label?: string;
}

export interface CoopPlayerInfo {
  playerId: string;
  role: CoopRole;
  name: string;
  fighter: CharacterName;
  ready: boolean;
  connected: boolean;
  lastSeenAt: number;
  hearts: number;
  maxHearts: number;
  combo: number;
  caged: boolean;
  rescueProgress: number;
  rescueNeeded: number;
  votedNodeId: string | null;
  phaseReady: boolean;
}

export interface CoopFightSnapshot {
  fightId: string;
  nodeId: string;
  foeName: string;
  bossHp: number;
  bossMaxHp: number;
  waveIndex: number;
  totalWaves: number;
  startedAt: number;
  timerSec: number;
  parryPhase: CoopParryPhase;
  parryMsLeft: number;
  parryDurationMs: number;
  parryStallsUsed: number;
  boardHasCounter: Record<string, boolean>;
  fairnessStalled: boolean;
  synergy: Partial<SynergyCounters>;
  damageByPlayer: Record<string, number>;
  setsByPlayer: Record<string, number>;
  totalParries: number;
  outcome: 'active' | 'victory' | 'defeat';
  defeatReason?: 'boss_ko' | 'both_caged' | 'timeout' | 'retreat';
}

export interface CoopRoomSnapshot {
  code: string;
  phase: CoopPhase;
  createdAt: number;
  updatedAt: number;
  seed: number;
  ascension: number;
  themePacks: CoopThemePackId[];
  act: number;
  floor: number;
  currentNodeId: string | null;
  players: CoopPlayerInfo[];
  mapVotes: Record<string, string | null>;
  phaseReady: Record<string, boolean>;
  fight: CoopFightSnapshot | null;
  seq: number;
}

export type CoopServerMessage =
  | { type: 'SNAPSHOT'; snapshot: CoopRoomSnapshot; seq?: number }
  | {
      type: 'PLAYER_PRESENCE';
      player?: CoopPlayerInfo;
      event?: 'joined' | 'reconnected' | 'disconnected' | 'updated';
      players?: CoopPlayerInfo[];
      playerId?: string;
      connected?: boolean;
      seq?: number;
    }
  | { type: 'VOTE_UPDATED'; playerId?: string; nodeId?: string | null; mapVotes?: Record<string, string | null>; seq?: number }
  | { type: 'NODE_SELECTED'; nodeId: string; nextPhase: CoopPhase; seq: number }
  | { type: 'PHASE_READY_UPDATED'; playerId?: string; ready?: boolean; phaseReady?: Record<string, boolean>; seq?: number }
  | { type: 'PHASE_ADVANCED'; fromPhase: CoopPhase; toPhase: CoopPhase; act: number; floor: number; seq: number }
  | { type: 'FIGHT_STARTED'; fight: CoopFightSnapshot; seq: number }
  | {
      type: 'BOSS_DAMAGED';
      fromPlayerId: string;
      amount: number;
      bossHp: number;
      bossMaxHp: number;
      combo?: number;
      isRainbow?: boolean;
      isPerfect?: boolean;
      label?: string;
      lethal: boolean;
      seq: number;
    }
  | {
      type: 'PARRY_SYNC';
      fromPlayerId?: string;
      kind?: 'parry' | 'perfect' | 'windup_start' | 'windup_expired' | 'counter_status';
      parryPhase: CoopParryPhase;
      parryMsLeft: number;
      parryDurationMs: number;
      fairnessStalled: boolean;
      parryStallsUsed: number;
      boardHasCounter: Record<string, boolean>;
      totalParries: number;
      seq: number;
    }
  | {
      type: 'SYNERGY_SYNC';
      fromPlayerId: string;
      deltas: Partial<SynergyCounters>;
      synergy: Partial<SynergyCounters>;
      seq: number;
    }
  | { type: 'PLAYER_CAGED'; playerId: string; rescueProgress: number; rescueNeeded: number; seq: number }
  | { type: 'PLAYER_RESCUE_PROGRESS'; playerId: string; rescuerPlayerId: string; rescueProgress: number; rescueNeeded: number; seq: number }
  | { type: 'PLAYER_REVIVED'; playerId: string; rescuerPlayerId?: string; hearts: number; reason: 'ally_sets' | 'ally_parry' | 'fight_won'; seq: number }
  | { type: 'GIFT_RECEIVED'; fromPlayerId: string; toPlayerId: string; kind: CoopGiftKind; shopGift?: CoopShopGiftPayload; label?: string; seq: number }
  | { type: 'EMOTE_RECEIVED'; fromPlayerId: string; emote: CoopEmoteKind; text?: string; sentAt: number; seq: number }
  | { type: 'FIGHT_ENDED'; outcome: 'victory' | 'defeat'; reason?: 'boss_ko' | 'both_caged' | 'timeout' | 'retreat'; fight: CoopFightSnapshot; nextPhase: CoopPhase; seq: number }
  | { type: 'ERROR'; code?: string; message: string; seq?: number };

export interface CoopClientOptions {
  serverUrl?: string;
  playerId?: string;
  name?: string;
  fighter?: CharacterName;
}

export interface CoopClientLike {
  createAndJoin(opts?: { name?: string; fighter?: CharacterName }): Promise<{ code: string; wsPath: string; serverUrl: string }>;
  connect(code: string, opts?: { playerId?: string; name?: string; fighter?: CharacterName; sessionToken?: string }): void;
  disconnect(): void;
  dispose(): void;
  getStatus(): CoopConnectionStatus;
  getSnapshot(): CoopRoomSnapshot | null;
  getPlayerId(): string;
  getRoomCode(): string | null;
  getSessionToken(): string | null;
  getLocalPlayer(): CoopPlayerInfo | null;
  getAllyPlayer(): CoopPlayerInfo | null;
  getServerConfig?(): { httpBaseUrl: string; wsBaseUrl: string; source: string };
  onSnapshot(cb: (snapshot: CoopRoomSnapshot) => void): () => void;
  onMessage(cb: (msg: CoopServerMessage) => void): () => void;
  onStatusChange(cb: (status: CoopConnectionStatus) => void): () => void;
  onError(cb: (err: Error | { message: string }) => void): () => void;
  updateLobby(patch: {
    fighter?: CharacterName;
    name?: string;
    ascension?: number;
    seed?: number;
    themePacks?: CoopThemePackId[];
    ready?: boolean;
  }): boolean;
  startClimb(opts?: { seed?: number; ascension?: number; themePacks?: CoopThemePackId[] }): boolean;
  voteNode(
    nodeId: string | null,
    opts?: { nodeKind?: CoopNodeKind; nextPhase?: Exclude<CoopPhase, 'lobby' | 'map'>; confirm?: boolean }
  ): boolean;
  setPhaseReady(ready: boolean, opts?: { nextPhase?: CoopPhase; act?: number; floor?: number }): boolean;
  cancelPreview(): boolean;
  startFight(payload: {
    fightId?: string;
    nodeId: string;
    foeName: string;
    bossMaxHp: number;
    totalWaves?: number;
    timerSec?: number;
    parryCooldownMs?: number;
    parryWindupMs?: number;
    parryStaggerMs?: number;
  }): boolean;
  dealDamage(payload: {
    amount: number;
    setIndex?: number;
    combo?: number;
    isRainbow?: boolean;
    isPerfect?: boolean;
    label?: string;
    waveIndex?: number;
  }): boolean;
  reportParry(payload: {
    kind: 'parry' | 'perfect' | 'windup_start' | 'windup_expired';
    parryPhase?: CoopParryPhase;
    msLeft?: number;
    durationMs?: number;
    staggerMs?: number;
  }): boolean;
  reportBoardCounterStatus(hasCounter: boolean): boolean;
  sendSynergyDelta(deltas: Partial<SynergyCounters>): boolean;
  updateHearts(hearts: number, opts?: { maxHearts?: number; combo?: number }): boolean;
  reportFightTimeout(): boolean;
  sendGift(kind: CoopGiftKind, opts?: { targetPlayerId?: string; shopGift?: CoopShopGiftPayload; label?: string }): boolean;
  sendEmote(emote: CoopEmoteKind, text?: string): boolean;
  setPhase(phase: CoopPhase, opts?: { act?: number; floor?: number; currentNodeId?: string | null }): boolean;
  requestSnapshot(): boolean;
}
