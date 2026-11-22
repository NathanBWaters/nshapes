/**
 * Wordle-style spoiler-free Share Card formatter, URL seed builder/parser,
 * and portable pure-JS base64url Save Backup Code encoder/decoder with checksum.
 */
import type { AnteRecord, PrismMeta, PrismRun, StarterDeckId } from '../types';
import { DAILY_MUTATOR_BY_ID, STARTER_DECK_BY_ID, VICTORY_ANTE } from '../data/blinds';
import { getTodayDateString, hashStringToSeed, normalizeDailyDate, normalizeSeed } from './rng';

const DEFAULT_SHARE_BASE_URL = 'https://nathanbwaters.github.io/nshapes';
const BACKUP_PREFIX = 'PRISM1';

const formatNumberCompact = (n: number): string => {
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('en-US');
};

const renderBlindPip = (
  status: 'cleared' | 'skipped' | 'failed' | 'pending',
  isAnte8Boss: boolean,
  isEndlessBoss: boolean
): string => {
  if (status === 'cleared') {
    if (isAnte8Boss) return '👑';
    if (isEndlessBoss) return '✨';
    return '🟩';
  }
  if (status === 'skipped') return '🟨';
  if (status === 'failed') return '🟥';
  return '⬜';
};

const formatAnteChunk = (rec: AnteRecord): string => {
  const s = renderBlindPip(rec.small, false, false);
  const b = renderBlindPip(rec.big, false, false);
  const boss = renderBlindPip(rec.boss, rec.ante === VICTORY_ANTE, rec.ante > VICTORY_ANTE);
  return `A${rec.ante} ${s}${b}${boss}`;
};

/** Build a shareable URL containing `?mode=prism&seed=...` (and optional daily/deck params). */
export const buildPrismShareUrl = (
  seed: string,
  options: { baseUrl?: string; dailyDate?: string | null; deckId?: StarterDeckId } = {}
): string => {
  const base = (options.baseUrl ?? DEFAULT_SHARE_BASE_URL).replace(/\/+$/, '');
  const params: string[] = ['mode=prism'];
  const cleanSeed = normalizeSeed(seed);
  if (cleanSeed) params.push(`seed=${encodeURIComponent(cleanSeed)}`);
  if (options.dailyDate && /^\d{4}-\d{2}-\d{2}$/.test(options.dailyDate)) {
    params.push(`daily=${encodeURIComponent(options.dailyDate)}`);
  }
  if (options.deckId && options.deckId !== 'classic_prism') {
    params.push(`deck=${encodeURIComponent(options.deckId)}`);
  }
  return `${base}/?${params.join('&')}`;
};

export interface ParsedPrismUrlParams {
  isPrism: boolean;
  seed?: string;
  dailyDate?: string;
  deckId?: StarterDeckId;
}

/** Parse `?mode=prism&seed=...&daily=...&deck=...` from a full URL or query string. */
export const parsePrismUrlParams = (urlOrSearch: string): ParsedPrismUrlParams | null => {
  if (!urlOrSearch || typeof urlOrSearch !== 'string') return null;
  const qIndex = urlOrSearch.indexOf('?');
  const rawQuery = qIndex >= 0 ? urlOrSearch.slice(qIndex + 1) : urlOrSearch;
  const hashIndex = rawQuery.indexOf('#');
  const query = hashIndex >= 0 ? rawQuery.slice(0, hashIndex) : rawQuery;
  if (!query) return null;

  const map = new Map<string, string>();
  for (const part of query.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const k = eq >= 0 ? decodeURIComponent(part.slice(0, eq)) : decodeURIComponent(part);
    const v = eq >= 0 ? decodeURIComponent(part.slice(eq + 1)) : '';
    map.set(k.toLowerCase(), v);
  }

  if (map.get('mode')?.toLowerCase() !== 'prism') return null;

  const rawSeed = map.get('seed');
  const seed = rawSeed ? normalizeSeed(rawSeed) || undefined : undefined;
  const rawDaily = map.get('daily');
  const dailyDate = rawDaily
    ? /^\d{4}-\d{2}-\d{2}$/.test(rawDaily)
      ? normalizeDailyDate(rawDaily)
      : rawDaily === '1' || rawDaily.toLowerCase() === 'true'
        ? getTodayDateString()
        : undefined
    : undefined;
  const rawDeck = map.get('deck') as StarterDeckId | undefined;
  const deckId = rawDeck && rawDeck in STARTER_DECK_BY_ID ? rawDeck : undefined;

  return {
    isPrism: true,
    seed,
    dailyDate,
    deckId,
  };
};

/** Format a crisp Wordle-style spoiler-free Share Card for a finished or in-progress Prism Deck run. */
export const formatShareCard = (run: PrismRun, baseUrl: string = DEFAULT_SHARE_BASE_URL): string => {
  const deckName = STARTER_DECK_BY_ID[run.deckId]?.name ?? 'Prism Standard';
  const mutatorName = run.dailyMutatorId ? DAILY_MUTATOR_BY_ID[run.dailyMutatorId]?.name : null;

  const headerTag = run.isDaily && run.dailyDate
    ? `Daily ${run.dailyDate}${mutatorName ? ` (${mutatorName})` : ''}`
    : `Seed ${run.seed}`;

  const wonAnte8 =
    run.phase === 'victory' ||
    run.ante > VICTORY_ANTE ||
    run.anteHistory.some(a => a.ante === VICTORY_ANTE && a.boss === 'cleared');

  const outcomeLine = run.isEndless
    ? `Endless Ante ${run.ante} ✨`
    : wonAnte8
      ? `Ante ${VICTORY_ANTE} Cleared 👑`
      : `Reached Ante ${run.ante}`;

  const chunks = run.anteHistory.map(formatAnteChunk);
  const rows: string[] = [];
  for (let i = 0; i < chunks.length; i += 4) {
    rows.push(chunks.slice(i, i + 4).join('  '));
  }

  const shareUrl = buildPrismShareUrl(run.seed, {
    baseUrl,
    dailyDate: run.isDaily ? run.dailyDate : undefined,
    deckId: run.deckId,
  });

  return [
    `Prism Deck ✦ ${headerTag}`,
    `${outcomeLine} | Best Set: ${formatNumberCompact(run.stats.bestSingleSet)} | ${deckName}`,
    ...rows,
    `${run.charms.length} Charms • ${run.stats.setsPlayed} Sets • ${shareUrl}`,
  ].join('\n');
};

// =============================================================================
// PURE-JS UTF-8 + BASE64URL SAVE BACKUP CODES (React Native + Web + Node safe)
// =============================================================================

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_LOOKUP: Record<string, number> = Object.fromEntries(
  B64_CHARS.split('').map((ch, idx) => [ch, idx])
);

const utf8Encode = (str: string): number[] => {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let cp = str.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        cp = ((cp - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
        i += 1;
      }
    }
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f)
      );
    }
  }
  return bytes;
};

const utf8Decode = (bytes: readonly number[]): string => {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
    } else if ((b0 & 0xe0) === 0xc0) {
      const b1 = bytes[i++] ?? 0;
      out += String.fromCharCode(((b0 & 0x1f) << 6) | (b1 & 0x3f));
    } else if ((b0 & 0xf0) === 0xe0) {
      const b1 = bytes[i++] ?? 0;
      const b2 = bytes[i++] ?? 0;
      out += String.fromCharCode(((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f));
    } else {
      const b1 = bytes[i++] ?? 0;
      const b2 = bytes[i++] ?? 0;
      const b3 = bytes[i++] ?? 0;
      const cp = (((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f)) - 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }
  return out;
};

const toBase64Url = (input: string): string => {
  const bytes = utf8Encode(input);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const has1 = i + 1 < bytes.length;
    const has2 = i + 2 < bytes.length;
    const b1 = has1 ? bytes[i + 1] : 0;
    const b2 = has2 ? bytes[i + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += B64_CHARS[(triple >> 18) & 0x3f];
    out += B64_CHARS[(triple >> 12) & 0x3f];
    if (has1) out += B64_CHARS[(triple >> 6) & 0x3f];
    if (has2) out += B64_CHARS[triple & 0x3f];
  }
  return out;
};

const fromBase64Url = (encoded: string): string | null => {
  const clean = encoded.replace(/=+$/, '');
  if (clean.length % 4 === 1) return null;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_LOOKUP[clean[i]];
    const c1 = B64_LOOKUP[clean[i + 1]];
    if (c0 === undefined || c1 === undefined) return null;
    const has2 = i + 2 < clean.length;
    const has3 = i + 3 < clean.length;
    const c2 = has2 ? B64_LOOKUP[clean[i + 2]] : 0;
    const c3 = has3 ? B64_LOOKUP[clean[i + 3]] : 0;
    if (c2 === undefined || c3 === undefined) return null;
    const triple = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    bytes.push((triple >> 16) & 0xff);
    if (has2) bytes.push((triple >> 8) & 0xff);
    if (has3) bytes.push(triple & 0xff);
  }
  return utf8Decode(bytes);
};

export interface PrismBackupPayload {
  v: 1;
  meta: PrismMeta;
  run: PrismRun | null;
}

/** Encode Prism Deck career meta (+ optional active run) into a checksummed portable Backup Code. */
export const encodeSaveBackup = (meta: PrismMeta, run: PrismRun | null = null): string => {
  const payload: PrismBackupPayload = { v: 1, meta, run };
  const json = JSON.stringify(payload);
  const b64 = toBase64Url(json);
  const checksum = (hashStringToSeed(b64) & 0xffffffff).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
  return `${BACKUP_PREFIX}:${checksum}:${b64}`;
};

export type DecodeBackupResult =
  | { ok: true; meta: PrismMeta; run: PrismRun | null }
  | { ok: false; error: string };

/** Decode and verify a portable Prism Deck Save Backup Code. */
export const decodeSaveBackup = (rawCode: string): DecodeBackupResult => {
  if (!rawCode || typeof rawCode !== 'string') {
    return { ok: false, error: 'Backup code is empty.' };
  }
  const trimmed = rawCode.trim().replace(/\s+/g, '');
  const parts = trimmed.split(':');
  if (parts.length !== 3 || parts[0] !== BACKUP_PREFIX) {
    return { ok: false, error: 'Unrecognized backup code format.' };
  }
  const [, checksum, b64] = parts;
  const expected = (hashStringToSeed(b64) & 0xffffffff).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
  if (checksum.toUpperCase() !== expected) {
    return { ok: false, error: 'Backup code checksum mismatch — check for missing characters.' };
  }
  const json = fromBase64Url(b64);
  if (!json) {
    return { ok: false, error: 'Backup code contains invalid base64 characters.' };
  }
  try {
    const parsed = JSON.parse(json) as Partial<PrismBackupPayload>;
    if (parsed?.v !== 1 || !parsed.meta || parsed.meta.version !== 1) {
      return { ok: false, error: 'Unsupported backup save version.' };
    }
    const run = parsed.run && parsed.run.version === 1 ? parsed.run : null;
    return { ok: true, meta: parsed.meta, run };
  } catch {
    return { ok: false, error: 'Backup code JSON could not be parsed.' };
  }
};
