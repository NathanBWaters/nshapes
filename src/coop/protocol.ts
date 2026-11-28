/**
 * Starfall Summit 2P Co-Op — Shared Wire Protocol & Runtime Validators.
 *
 * Single source of truth imported by BOTH:
 *   - Expo / React Native / Web client (`src/coop/client.ts`, `src/spire/**`)
 *   - Cloudflare Workers + SQLite Durable Object (`workers/coop-room/src/**`)
 *
 * Keep this file 100% pure TypeScript with ZERO React Native, Expo, Node, or
 * Cloudflare runtime imports so both targets share identical types & validation.
 */

// ---------------------------------------------------------------------------
// Constants & Room Codes
// ---------------------------------------------------------------------------

/** Unambiguous 32-character uppercase alphabet (excludes I, O, 0, 1). */
export const COOP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const COOP_CODE_LENGTH = 4;

/** Maximum players in a Starfall Summit Co-Op room. */
export const COOP_MAX_PLAYERS = 2;

/** Number of ally Sets required to break a caged partner out of the Golden Cage. */
export const COOP_CAGE_RESCUE_SETS = 3;

/** Hearts restored when a caged player is revived by ally Sets or ally Parry. */
export const COOP_REVIVE_HEARTS = 2;

/** Sanity clamp for any single reported Set damage hit. */
export const COOP_MAX_SINGLE_HIT_DAMAGE = 2500;

/** Reconnect grace period (ms) before a disconnected slot can be reclaimed. */
export const COOP_RECONNECT_GRACE_MS = 60_000;

/** Inactivity timeout (ms) before the Durable Object alarm cleans up room state. */
export const COOP_ROOM_IDLE_TTL_MS = 30 * 60 * 1000;

/** Default heart/parry timing constants used when not specified by the caller. */
export const COOP_DEFAULT_MAX_HEARTS = 5;
export const COOP_DEFAULT_PARRY_STAGGER_MS = 4500;
export const COOP_PERFECT_PARRY_STAGGER_MS = 6500;

// ---------------------------------------------------------------------------
// Domain Unions (structurally identical to NShapes core types)
// ---------------------------------------------------------------------------

export const COOP_FIGHTER_NAMES = [
  'Orange Tabby',
  'Sly Fox',
  'Corgi',
  'Emperor Penguin',
  'Pelican',
  'Badger',
] as const;

export type CoopFighterName = (typeof COOP_FIGHTER_NAMES)[number];

export const COOP_THEME_PACK_IDS = [
  'pyro_blasts',
  'webs_echoes',
  'board_gambles',
  'tempo_clarity',
  'tricks_bounty',
  'grace_bastion',
] as const;

export type CoopThemePackId = (typeof COOP_THEME_PACK_IDS)[number];

export const COOP_SYNERGY_ATTR_IDS = [
  'field_size',
  'destruction',
  'marks',
  'coins',
  'burn',
  'links',
  'holo',
  'graces',
  'hints',
  'vitality',
  'streaks',
  'hazards',
  'parries',
  'prism',
  'echoes',
] as const;

export type CoopSynergyAttrId = (typeof COOP_SYNERGY_ATTR_IDS)[number];

export type CoopSynergyCounters = Record<CoopSynergyAttrId, number>;

export const COOP_PHASES = [
  'lobby',
  'map',
  'preview',
  'fight',
  'reward',
  'shop',
  'campfire',
  'event',
  'treasure',
  'act_clear',
  'victory',
  'defeat',
] as const;

export type CoopPhase = (typeof COOP_PHASES)[number];

export const COOP_NODE_KINDS = [
  'skirmish',
  'elite',
  'shop',
  'campfire',
  'event',
  'treasure',
  'boss',
] as const;

export type CoopNodeKind = (typeof COOP_NODE_KINDS)[number];

export type CoopRole = 'host' | 'guest';

export const COOP_PARRY_PHASES = ['calm', 'windup', 'staggered'] as const;
export type CoopParryPhase = (typeof COOP_PARRY_PHASES)[number];

export const COOP_GIFT_KINDS = ['wild_card', 'heal', 'cleanse', 'shop_gift'] as const;
export type CoopGiftKind = (typeof COOP_GIFT_KINDS)[number];

export const COOP_EMOTE_KINDS = ['cheer', 'nice', 'parry', 'help', 'gift', 'ready'] as const;
export type CoopEmoteKind = (typeof COOP_EMOTE_KINDS)[number];

export type CoopErrorCode =
  | 'INVALID_MESSAGE'
  | 'ROOM_FULL'
  | 'NOT_HOST'
  | 'NOT_READY'
  | 'INVALID_PHASE'
  | 'ROOM_NOT_FOUND'
  | 'GRACE_EXPIRED'
  | 'INTERNAL_ERROR';

// ---------------------------------------------------------------------------
// Authoritative Room & Fight Snapshots
// ---------------------------------------------------------------------------

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
  fighter: CoopFighterName;
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
  /** Per-player board counter availability during windup (`playerId -> hasCounter`). */
  boardHasCounter: Record<string, boolean>;
  /** True ONLY when in windup and NEITHER connected, uncaged player has a counter. */
  fairnessStalled: boolean;
  /** Shared party-wide Synergy Graph counters. */
  synergy: CoopSynergyCounters;
  /** Cumulative boss damage dealt per playerId during this fight. */
  damageByPlayer: Record<string, number>;
  /** Total Sets landed per playerId during this fight. */
  setsByPlayer: Record<string, number>;
  /** Combined party parries landed during this fight. */
  totalParries: number;
  outcome: 'active' | 'victory' | 'defeat';
  defeatReason?: 'both_caged' | 'timeout' | 'retreat';
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

// ---------------------------------------------------------------------------
// HTTP Room Creation Response
// ---------------------------------------------------------------------------

export interface CoopCreateRoomResponse {
  code: string;
  wsPath: string;
}

// ---------------------------------------------------------------------------
// Client -> Server Wire Messages
// ---------------------------------------------------------------------------

export type CoopClientMessage =
  | {
      type: 'JOIN';
      playerId: string;
      name: string;
      fighter?: CoopFighterName;
      sessionToken?: string;
    }
  | {
      type: 'UPDATE_LOBBY';
      fighter?: CoopFighterName;
      name?: string;
      ascension?: number;
      seed?: number;
      themePacks?: CoopThemePackId[];
      ready?: boolean;
    }
  | {
      type: 'START_CLIMB';
      seed?: number;
      ascension?: number;
      themePacks?: CoopThemePackId[];
    }
  | {
      type: 'VOTE_NODE';
      nodeId: string | null;
      nodeKind?: CoopNodeKind;
      nextPhase?: Exclude<CoopPhase, 'lobby' | 'map'>;
      confirm?: boolean;
    }
  | {
      type: 'PHASE_READY';
      ready: boolean;
      nextPhase?: CoopPhase;
      act?: number;
      floor?: number;
    }
  | {
      type: 'CANCEL_PREVIEW';
    }
  | {
      type: 'START_FIGHT';
      fightId?: string;
      nodeId: string;
      foeName: string;
      bossMaxHp: number;
      totalWaves?: number;
      timerSec?: number;
      parryCooldownMs?: number;
      parryWindupMs?: number;
      parryStaggerMs?: number;
    }
  | {
      type: 'DEAL_DAMAGE';
      amount: number;
      setIndex?: number;
      combo?: number;
      isRainbow?: boolean;
      isPerfect?: boolean;
      label?: string;
      waveIndex?: number;
    }
  | {
      type: 'PARRY_REPORT';
      kind: 'parry' | 'perfect' | 'windup_start' | 'windup_expired';
      parryPhase?: CoopParryPhase;
      msLeft?: number;
      durationMs?: number;
      staggerMs?: number;
    }
  | {
      type: 'BOARD_COUNTER_STATUS';
      hasCounter: boolean;
    }
  | {
      type: 'SYNERGY_DELTA';
      deltas: Partial<CoopSynergyCounters>;
    }
  | {
      type: 'PLAYER_HEART_UPDATE';
      hearts: number;
      maxHearts?: number;
      combo?: number;
    }
  | {
      type: 'FIGHT_TIMEOUT';
    }
  | {
      type: 'SEND_GIFT';
      kind: CoopGiftKind;
      targetPlayerId?: string;
      shopGift?: CoopShopGiftPayload;
      label?: string;
    }
  | {
      type: 'EMOTE';
      emote: CoopEmoteKind;
      text?: string;
    }
  | {
      type: 'SET_PHASE';
      phase: CoopPhase;
      act?: number;
      floor?: number;
      currentNodeId?: string | null;
    }
  | {
      type: 'REQUEST_SNAPSHOT';
    };

// ---------------------------------------------------------------------------
// Server -> Client Wire Messages
// ---------------------------------------------------------------------------

export type CoopServerMessage =
  | {
      type: 'SNAPSHOT';
      snapshot: CoopRoomSnapshot;
      yourPlayerId: string;
      sessionToken: string;
    }
  | {
      type: 'PLAYER_PRESENCE';
      player: CoopPlayerInfo;
      event: 'joined' | 'reconnected' | 'disconnected' | 'updated';
      players: CoopPlayerInfo[];
      seq: number;
    }
  | {
      type: 'VOTE_UPDATED';
      mapVotes: Record<string, string | null>;
      seq: number;
    }
  | {
      type: 'NODE_SELECTED';
      nodeId: string;
      nextPhase: CoopPhase;
      seq: number;
    }
  | {
      type: 'PHASE_READY_UPDATED';
      phase: CoopPhase;
      phaseReady: Record<string, boolean>;
      seq: number;
    }
  | {
      type: 'PHASE_ADVANCED';
      fromPhase: CoopPhase;
      toPhase: CoopPhase;
      act: number;
      floor: number;
      seq: number;
    }
  | {
      type: 'FIGHT_STARTED';
      fight: CoopFightSnapshot;
      seq: number;
    }
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
      deltas: Partial<CoopSynergyCounters>;
      synergy: CoopSynergyCounters;
      seq: number;
    }
  | {
      type: 'PLAYER_CAGED';
      playerId: string;
      rescueProgress: number;
      rescueNeeded: number;
      seq: number;
    }
  | {
      type: 'PLAYER_RESCUE_PROGRESS';
      playerId: string;
      rescuerPlayerId: string;
      rescueProgress: number;
      rescueNeeded: number;
      seq: number;
    }
  | {
      type: 'PLAYER_REVIVED';
      playerId: string;
      rescuerPlayerId?: string;
      hearts: number;
      reason: 'ally_sets' | 'ally_parry' | 'fight_won';
      seq: number;
    }
  | {
      type: 'GIFT_RECEIVED';
      fromPlayerId: string;
      toPlayerId: string;
      kind: CoopGiftKind;
      shopGift?: CoopShopGiftPayload;
      label?: string;
      seq: number;
    }
  | {
      type: 'EMOTE_RECEIVED';
      fromPlayerId: string;
      emote: CoopEmoteKind;
      text?: string;
      sentAt: number;
      seq: number;
    }
  | {
      type: 'FIGHT_ENDED';
      outcome: 'victory' | 'defeat';
      reason?: 'boss_ko' | 'both_caged' | 'timeout' | 'retreat';
      fight: CoopFightSnapshot;
      nextPhase: CoopPhase;
      seq: number;
    }
  | {
      type: 'ERROR';
      code: CoopErrorCode;
      message: string;
    };

// ---------------------------------------------------------------------------
// Pure Helpers & Runtime Validators
// ---------------------------------------------------------------------------

const FIGHTER_SET: ReadonlySet<string> = new Set(COOP_FIGHTER_NAMES);
const THEME_PACK_SET: ReadonlySet<string> = new Set(COOP_THEME_PACK_IDS);
const SYNERGY_SET: ReadonlySet<string> = new Set(COOP_SYNERGY_ATTR_IDS);
const PHASE_SET: ReadonlySet<string> = new Set(COOP_PHASES);
const NODE_KIND_SET: ReadonlySet<string> = new Set(COOP_NODE_KINDS);
const PARRY_PHASE_SET: ReadonlySet<string> = new Set(COOP_PARRY_PHASES);
const GIFT_KIND_SET: ReadonlySet<string> = new Set(COOP_GIFT_KINDS);
const EMOTE_KIND_SET: ReadonlySet<string> = new Set(COOP_EMOTE_KINDS);

export function createEmptySynergyCounters(): CoopSynergyCounters {
  return {
    field_size: 0,
    destruction: 0,
    marks: 0,
    coins: 0,
    burn: 0,
    links: 0,
    holo: 0,
    graces: 0,
    hints: 0,
    vitality: 0,
    streaks: 0,
    hazards: 0,
    parries: 0,
    prism: 0,
    echoes: 0,
  };
}

/** Generate a 4-char unambiguous uppercase room code (never includes I, O, 0, or 1). */
export function generateRoomCode(randomBytes?: Uint8Array): string {
  const bytes = randomBytes && randomBytes.length >= COOP_CODE_LENGTH
    ? randomBytes
    : createRandomBytes(COOP_CODE_LENGTH);
  let out = '';
  for (let i = 0; i < COOP_CODE_LENGTH; i++) {
    out += COOP_CODE_ALPHABET[bytes[i] % COOP_CODE_ALPHABET.length];
  }
  return out;
}

function createRandomBytes(len: number): Uint8Array {
  const arr = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(arr);
    return arr;
  }
  for (let i = 0; i < len; i++) {
    arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
}

/** True when `code` matches the strict generated alphabet (4 chars, no I/O/0/1). */
export function isStrictRoomCode(raw: string): boolean {
  return /^[A-HJ-NP-Z2-9]{4}$/.test(raw);
}

/**
 * Normalize a user-provided or URL room code to 4 uppercase alphanumeric characters.
 * Accepts test/user codes like `FOX7` as well as strict unambiguous codes.
 */
export function normalizeRoomCode(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length !== COOP_CODE_LENGTH) return null;
  return cleaned;
}

export function isCoopFighterName(v: unknown): v is CoopFighterName {
  return typeof v === 'string' && FIGHTER_SET.has(v);
}

export function isCoopThemePackId(v: unknown): v is CoopThemePackId {
  return typeof v === 'string' && THEME_PACK_SET.has(v);
}

export function isCoopSynergyAttrId(v: unknown): v is CoopSynergyAttrId {
  return typeof v === 'string' && SYNERGY_SET.has(v);
}

export function isCoopPhase(v: unknown): v is CoopPhase {
  return typeof v === 'string' && PHASE_SET.has(v);
}

export function isCoopNodeKind(v: unknown): v is CoopNodeKind {
  return typeof v === 'string' && NODE_KIND_SET.has(v);
}

export function isCoopParryPhase(v: unknown): v is CoopParryPhase {
  return typeof v === 'string' && PARRY_PHASE_SET.has(v);
}

export function isCoopGiftKind(v: unknown): v is CoopGiftKind {
  return typeof v === 'string' && GIFT_KIND_SET.has(v);
}

export function isCoopEmoteKind(v: unknown): v is CoopEmoteKind {
  return typeof v === 'string' && EMOTE_KIND_SET.has(v);
}

export function mapNodeKindToPhase(kind?: CoopNodeKind): Exclude<CoopPhase, 'lobby' | 'map'> {
  switch (kind) {
    case 'shop':
      return 'shop';
    case 'campfire':
      return 'campfire';
    case 'event':
      return 'event';
    case 'treasure':
      return 'treasure';
    case 'skirmish':
    case 'elite':
    case 'boss':
    default:
      return 'preview';
  }
}

export function defaultNextPhaseAfterBarrier(phase: CoopPhase): CoopPhase {
  switch (phase) {
    case 'preview':
      return 'fight';
    case 'reward':
    case 'shop':
    case 'campfire':
    case 'event':
    case 'treasure':
    case 'act_clear':
      return 'map';
    default:
      return phase;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function sanitizeString(v: unknown, maxLen: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function parseSynergyDeltas(raw: unknown): Partial<CoopSynergyCounters> | null {
  if (!isRecord(raw)) return null;
  const out: Partial<CoopSynergyCounters> = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (!isCoopSynergyAttrId(k) || !isFiniteNumber(v)) continue;
    const clamped = Math.max(0, Math.min(500, Math.round(v)));
    if (clamped > 0) {
      out[k] = clamped;
      count += 1;
    }
  }
  return count > 0 ? out : null;
}

function parseShopGiftPayload(raw: unknown): CoopShopGiftPayload | undefined {
  if (!isRecord(raw)) return undefined;
  const giftType = raw.giftType;
  if (giftType !== 'heal' && giftType !== 'weapon' && giftType !== 'forge') {
    return undefined;
  }
  const out: CoopShopGiftPayload = { giftType };
  const weaponId = sanitizeString(raw.weaponId, 64);
  if (weaponId) out.weaponId = weaponId;
  if (isFiniteNumber(raw.weaponLevel)) {
    out.weaponLevel = Math.max(1, Math.min(20, Math.round(raw.weaponLevel)));
  }
  if (isFiniteNumber(raw.healAmount)) {
    out.healAmount = Math.max(1, Math.min(10, Math.round(raw.healAmount)));
  }
  const label = sanitizeString(raw.label, 80);
  if (label) out.label = label;
  return out;
}

/**
 * Validate and normalize an incoming Client -> Server message.
 * Returns a strongly-typed `CoopClientMessage` or `null` if invalid.
 */
export function parseClientMessage(raw: unknown): CoopClientMessage | null {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isRecord(obj) || typeof obj.type !== 'string') return null;

  switch (obj.type) {
    case 'JOIN': {
      const playerId = sanitizeString(obj.playerId, 64);
      const name = sanitizeString(obj.name, 32);
      if (!playerId || !name) return null;
      const msg: Extract<CoopClientMessage, { type: 'JOIN' }> = {
        type: 'JOIN',
        playerId,
        name,
      };
      if (isCoopFighterName(obj.fighter)) msg.fighter = obj.fighter;
      const sessionToken = sanitizeString(obj.sessionToken, 128);
      if (sessionToken) msg.sessionToken = sessionToken;
      return msg;
    }

    case 'UPDATE_LOBBY': {
      const msg: Extract<CoopClientMessage, { type: 'UPDATE_LOBBY' }> = { type: 'UPDATE_LOBBY' };
      if (isCoopFighterName(obj.fighter)) msg.fighter = obj.fighter;
      const name = sanitizeString(obj.name, 32);
      if (name) msg.name = name;
      if (isFiniteNumber(obj.ascension)) {
        msg.ascension = Math.max(0, Math.min(20, Math.round(obj.ascension)));
      }
      if (isFiniteNumber(obj.seed) && obj.seed > 0) {
        msg.seed = Math.floor(obj.seed) & 0x7fffffff || 1;
      }
      if (Array.isArray(obj.themePacks)) {
        const validPacks = obj.themePacks.filter(isCoopThemePackId).slice(0, 3);
        msg.themePacks = validPacks;
      }
      if (typeof obj.ready === 'boolean') msg.ready = obj.ready;
      return msg;
    }

    case 'START_CLIMB': {
      const msg: Extract<CoopClientMessage, { type: 'START_CLIMB' }> = { type: 'START_CLIMB' };
      if (isFiniteNumber(obj.seed) && obj.seed > 0) {
        msg.seed = Math.floor(obj.seed) & 0x7fffffff || 1;
      }
      if (isFiniteNumber(obj.ascension)) {
        msg.ascension = Math.max(0, Math.min(20, Math.round(obj.ascension)));
      }
      if (Array.isArray(obj.themePacks)) {
        msg.themePacks = obj.themePacks.filter(isCoopThemePackId).slice(0, 3);
      }
      return msg;
    }

    case 'VOTE_NODE': {
      let nodeId: string | null = null;
      if (obj.nodeId !== null && obj.nodeId !== undefined) {
        const parsed = sanitizeString(obj.nodeId, 64);
        if (!parsed) return null;
        nodeId = parsed;
      }
      const msg: Extract<CoopClientMessage, { type: 'VOTE_NODE' }> = {
        type: 'VOTE_NODE',
        nodeId,
      };
      if (isCoopNodeKind(obj.nodeKind)) msg.nodeKind = obj.nodeKind;
      if (isCoopPhase(obj.nextPhase) && obj.nextPhase !== 'lobby' && obj.nextPhase !== 'map') {
        msg.nextPhase = obj.nextPhase;
      }
      if (typeof obj.confirm === 'boolean') msg.confirm = obj.confirm;
      return msg;
    }

    case 'PHASE_READY': {
      if (typeof obj.ready !== 'boolean') return null;
      const msg: Extract<CoopClientMessage, { type: 'PHASE_READY' }> = {
        type: 'PHASE_READY',
        ready: obj.ready,
      };
      if (isCoopPhase(obj.nextPhase)) msg.nextPhase = obj.nextPhase;
      if (isFiniteNumber(obj.act)) msg.act = Math.max(1, Math.min(99, Math.round(obj.act)));
      if (isFiniteNumber(obj.floor)) msg.floor = Math.max(1, Math.min(999, Math.round(obj.floor)));
      return msg;
    }

    case 'CANCEL_PREVIEW':
      return { type: 'CANCEL_PREVIEW' };

    case 'START_FIGHT': {
      const nodeId = sanitizeString(obj.nodeId, 64);
      const foeName = sanitizeString(obj.foeName, 80);
      if (!nodeId || !foeName || !isFiniteNumber(obj.bossMaxHp) || obj.bossMaxHp <= 0) {
        return null;
      }
      const msg: Extract<CoopClientMessage, { type: 'START_FIGHT' }> = {
        type: 'START_FIGHT',
        nodeId,
        foeName,
        bossMaxHp: Math.max(1, Math.min(1_000_000, Math.round(obj.bossMaxHp))),
      };
      const fightId = sanitizeString(obj.fightId, 80);
      if (fightId) msg.fightId = fightId;
      if (isFiniteNumber(obj.totalWaves)) {
        msg.totalWaves = Math.max(1, Math.min(20, Math.round(obj.totalWaves)));
      }
      if (isFiniteNumber(obj.timerSec)) {
        msg.timerSec = Math.max(10, Math.min(900, Math.round(obj.timerSec)));
      }
      if (isFiniteNumber(obj.parryCooldownMs)) {
        msg.parryCooldownMs = Math.max(500, Math.min(60_000, Math.round(obj.parryCooldownMs)));
      }
      if (isFiniteNumber(obj.parryWindupMs)) {
        msg.parryWindupMs = Math.max(500, Math.min(60_000, Math.round(obj.parryWindupMs)));
      }
      if (isFiniteNumber(obj.parryStaggerMs)) {
        msg.parryStaggerMs = Math.max(500, Math.min(30_000, Math.round(obj.parryStaggerMs)));
      }
      return msg;
    }

    case 'DEAL_DAMAGE': {
      if (!isFiniteNumber(obj.amount) || obj.amount < 0) return null;
      const msg: Extract<CoopClientMessage, { type: 'DEAL_DAMAGE' }> = {
        type: 'DEAL_DAMAGE',
        amount: Math.min(COOP_MAX_SINGLE_HIT_DAMAGE, Math.max(0, Math.round(obj.amount))),
      };
      if (isFiniteNumber(obj.setIndex)) msg.setIndex = Math.max(0, Math.round(obj.setIndex));
      if (isFiniteNumber(obj.combo)) msg.combo = Math.max(0, Math.min(999, Math.round(obj.combo)));
      if (typeof obj.isRainbow === 'boolean') msg.isRainbow = obj.isRainbow;
      if (typeof obj.isPerfect === 'boolean') msg.isPerfect = obj.isPerfect;
      const label = sanitizeString(obj.label, 80);
      if (label) msg.label = label;
      if (isFiniteNumber(obj.waveIndex)) msg.waveIndex = Math.max(0, Math.round(obj.waveIndex));
      return msg;
    }

    case 'PARRY_REPORT': {
      const kind = obj.kind;
      if (
        kind !== 'parry' &&
        kind !== 'perfect' &&
        kind !== 'windup_start' &&
        kind !== 'windup_expired'
      ) {
        return null;
      }
      const msg: Extract<CoopClientMessage, { type: 'PARRY_REPORT' }> = {
        type: 'PARRY_REPORT',
        kind,
      };
      if (isCoopParryPhase(obj.parryPhase)) msg.parryPhase = obj.parryPhase;
      if (isFiniteNumber(obj.msLeft)) msg.msLeft = Math.max(0, Math.min(60_000, Math.round(obj.msLeft)));
      if (isFiniteNumber(obj.durationMs)) {
        msg.durationMs = Math.max(0, Math.min(60_000, Math.round(obj.durationMs)));
      }
      if (isFiniteNumber(obj.staggerMs)) {
        msg.staggerMs = Math.max(500, Math.min(30_000, Math.round(obj.staggerMs)));
      }
      return msg;
    }

    case 'BOARD_COUNTER_STATUS': {
      if (typeof obj.hasCounter !== 'boolean') return null;
      return { type: 'BOARD_COUNTER_STATUS', hasCounter: obj.hasCounter };
    }

    case 'SYNERGY_DELTA': {
      const deltas = parseSynergyDeltas(obj.deltas);
      if (!deltas) return null;
      return { type: 'SYNERGY_DELTA', deltas };
    }

    case 'PLAYER_HEART_UPDATE': {
      if (!isFiniteNumber(obj.hearts)) return null;
      const msg: Extract<CoopClientMessage, { type: 'PLAYER_HEART_UPDATE' }> = {
        type: 'PLAYER_HEART_UPDATE',
        hearts: Math.max(0, Math.min(50, Math.round(obj.hearts))),
      };
      if (isFiniteNumber(obj.maxHearts)) {
        msg.maxHearts = Math.max(1, Math.min(50, Math.round(obj.maxHearts)));
      }
      if (isFiniteNumber(obj.combo)) {
        msg.combo = Math.max(0, Math.min(999, Math.round(obj.combo)));
      }
      return msg;
    }

    case 'FIGHT_TIMEOUT':
      return { type: 'FIGHT_TIMEOUT' };

    case 'SEND_GIFT': {
      if (!isCoopGiftKind(obj.kind)) return null;
      const msg: Extract<CoopClientMessage, { type: 'SEND_GIFT' }> = {
        type: 'SEND_GIFT',
        kind: obj.kind,
      };
      const targetPlayerId = sanitizeString(obj.targetPlayerId, 64);
      if (targetPlayerId) msg.targetPlayerId = targetPlayerId;
      const shopGift = parseShopGiftPayload(obj.shopGift);
      if (shopGift) msg.shopGift = shopGift;
      const label = sanitizeString(obj.label, 80);
      if (label) msg.label = label;
      return msg;
    }

    case 'EMOTE': {
      if (!isCoopEmoteKind(obj.emote)) return null;
      const msg: Extract<CoopClientMessage, { type: 'EMOTE' }> = {
        type: 'EMOTE',
        emote: obj.emote,
      };
      const text = sanitizeString(obj.text, 64);
      if (text) msg.text = text;
      return msg;
    }

    case 'SET_PHASE': {
      if (!isCoopPhase(obj.phase)) return null;
      const msg: Extract<CoopClientMessage, { type: 'SET_PHASE' }> = {
        type: 'SET_PHASE',
        phase: obj.phase,
      };
      if (isFiniteNumber(obj.act)) msg.act = Math.max(1, Math.min(99, Math.round(obj.act)));
      if (isFiniteNumber(obj.floor)) msg.floor = Math.max(1, Math.min(999, Math.round(obj.floor)));
      if (obj.currentNodeId === null) {
        msg.currentNodeId = null;
      } else {
        const nodeId = sanitizeString(obj.currentNodeId, 64);
        if (nodeId) msg.currentNodeId = nodeId;
      }
      return msg;
    }

    case 'REQUEST_SNAPSHOT':
      return { type: 'REQUEST_SNAPSHOT' };

    default:
      return null;
  }
}

const SERVER_MSG_TYPES: ReadonlySet<string> = new Set([
  'SNAPSHOT',
  'PLAYER_PRESENCE',
  'VOTE_UPDATED',
  'NODE_SELECTED',
  'PHASE_READY_UPDATED',
  'PHASE_ADVANCED',
  'FIGHT_STARTED',
  'BOSS_DAMAGED',
  'PARRY_SYNC',
  'SYNERGY_SYNC',
  'PLAYER_CAGED',
  'PLAYER_RESCUE_PROGRESS',
  'PLAYER_REVIVED',
  'GIFT_RECEIVED',
  'EMOTE_RECEIVED',
  'FIGHT_ENDED',
  'ERROR',
]);

/**
 * Validate a Server -> Client JSON payload received over WebSocket.
 */
export function parseServerMessage(raw: unknown): CoopServerMessage | null {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isRecord(obj) || typeof obj.type !== 'string' || !SERVER_MSG_TYPES.has(obj.type)) {
    return null;
  }
  if (obj.type === 'SNAPSHOT') {
    if (!isRecord(obj.snapshot) || typeof obj.yourPlayerId !== 'string') return null;
  }
  if (obj.type === 'ERROR') {
    if (typeof obj.code !== 'string' || typeof obj.message !== 'string') return null;
  }
  return obj as unknown as CoopServerMessage;
}

/** Validate a `POST /room` JSON response. */
export function parseCreateRoomResponse(raw: unknown): CoopCreateRoomResponse | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.code !== 'string' || typeof raw.wsPath !== 'string') return null;
  const normalized = normalizeRoomCode(raw.code);
  if (!normalized || !raw.wsPath.startsWith('/')) return null;
  return { code: normalized, wsPath: raw.wsPath };
}
