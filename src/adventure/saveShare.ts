/**
 * Portable Checksummed Save Backup Codes for Adventure Mode & Starfall Summit.
 *
 * Format: `NSHAPES1:<CHECKSUM>:<BASE64URL>`
 * Pure-JS UTF-8 + base64url + 32-bit FNV-1a checksum codec so exports & restores
 * work identically across React Native (Hermes), Web, and Node/Jest without
 * relying on browser-only `btoa` or Node-only `Buffer`.
 */
import type { AdventureSave } from './types';
import {
  backupAdventureSaveBeforeOverwrite,
  hydrateAdventureSave,
  loadAdventureSave,
  writeAdventureSave,
} from './save';
import type { SpireMeta, SpireRun } from '@/spire/types';
import {
  backupSpireStorageBeforeOverwrite,
  hydrateSpireMeta,
  hydrateSpireRun,
  loadSpireMeta,
  loadSpireRun,
  writeSpireMeta,
  writeSpireRun,
} from '@/spire/save';

export const SAVE_BACKUP_PREFIX = 'NSHAPES1';

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

/** Pure-JS UTF-8 to unpadded base64url encoder. */
export const encodeBase64Url = (input: string): string => {
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

/** Pure-JS base64url to UTF-8 decoder (returns `null` on invalid characters or length). */
export const decodeBase64Url = (encoded: string): string | null => {
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

/** Deterministic 6-character base36 FNV-1a checksum over the base64url payload. */
export const computeBackupChecksum = (payload: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
};

export interface FullSaveBackupPayload {
  v: 1;
  adventure: AdventureSave;
  spireMeta: SpireMeta;
  spireRun: SpireRun | null;
}

export type DecodeFullSaveResult =
  | { ok: true; adventure: AdventureSave; spireMeta: SpireMeta; spireRun: SpireRun | null }
  | { ok: false; error: string };

/** Encode Adventure Mode progress + Starfall Summit meta (+ optional active climb) into a checksummed code. */
export const encodeFullSaveBackup = (
  adventure: AdventureSave,
  spireMeta: SpireMeta,
  spireRun: SpireRun | null = null
): string => {
  const payload: FullSaveBackupPayload = {
    v: 1,
    adventure,
    spireMeta,
    spireRun,
  };
  const b64 = encodeBase64Url(JSON.stringify(payload));
  const checksum = computeBackupChecksum(b64);
  return `${SAVE_BACKUP_PREFIX}:${checksum}:${b64}`;
};

/** Decode, verify checksum, and hydrate an `NSHAPES1:` Save Backup Code without writing storage. */
export const decodeFullSaveBackup = (rawCode: string): DecodeFullSaveResult => {
  if (!rawCode || typeof rawCode !== 'string') {
    return { ok: false, error: 'Backup code is empty.' };
  }
  const trimmed = rawCode.trim().replace(/\s+/g, '');
  const parts = trimmed.split(':');
  if (parts.length !== 3 || parts[0] !== SAVE_BACKUP_PREFIX) {
    return { ok: false, error: 'Unrecognized backup code format (expected NSHAPES1:...).' };
  }
  const [, checksum, b64] = parts;
  if (!b64) {
    return { ok: false, error: 'Backup code payload is empty.' };
  }
  const expected = computeBackupChecksum(b64);
  if (checksum.toUpperCase() !== expected) {
    return { ok: false, error: 'Backup code checksum mismatch — check for missing or altered characters.' };
  }
  const json = decodeBase64Url(b64);
  if (!json) {
    return { ok: false, error: 'Backup code contains invalid base64 characters.' };
  }
  try {
    const parsed = JSON.parse(json) as Partial<FullSaveBackupPayload>;
    if (!parsed || typeof parsed !== 'object' || parsed.v !== 1) {
      return { ok: false, error: 'Unsupported backup code version.' };
    }
    const adventure = hydrateAdventureSave(parsed.adventure);
    if (!adventure) {
      return { ok: false, error: 'Backup code contains an invalid Adventure save.' };
    }
    const spireMeta = hydrateSpireMeta(parsed.spireMeta);
    if (!spireMeta) {
      return { ok: false, error: 'Backup code contains invalid Starfall Summit career data.' };
    }
    const spireRun = parsed.spireRun ? hydrateSpireRun(parsed.spireRun) : null;
    return { ok: true, adventure, spireMeta, spireRun };
  } catch {
    return { ok: false, error: 'Backup code JSON could not be parsed.' };
  }
};

/** Export current live Adventure Mode + Starfall Summit saves into a portable checksummed Backup Code. */
export const exportFullSaveBackup = (): string =>
  encodeFullSaveBackup(loadAdventureSave(), loadSpireMeta(), loadSpireRun());

/**
 * Validate and restore a portable Backup Code into MMKV storage.
 * Never mutates storage if validation or checksum fails; backs up the existing
 * saves before overwriting so restores are reversible.
 */
export const importFullSaveBackup = (rawCode: string): DecodeFullSaveResult => {
  const decoded = decodeFullSaveBackup(rawCode);
  if (!decoded.ok) return decoded;
  backupAdventureSaveBeforeOverwrite();
  backupSpireStorageBeforeOverwrite();
  writeAdventureSave(decoded.adventure);
  writeSpireMeta(decoded.spireMeta);
  writeSpireRun(decoded.spireRun);
  return decoded;
};
