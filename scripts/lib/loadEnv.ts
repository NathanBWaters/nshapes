/**
 * Zero-dependency local `.env.local` / `.env` loader for Node CLI scripts.
 *
 * Precedence (highest to lowest):
 *   1. Existing shell environment variables (`process.env[k] !== undefined`)
 *   2. `<rootDir>/.env.local`
 *   3. `<rootDir>/.env`
 *
 * Never prints, logs, or returns secret values.
 */
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_ROOT = path.resolve(__dirname, '../..');
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const parseEnvValue = (rawValue: string): string => {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) return '';

  const quote = trimmed[0];
  if (quote === '"' || quote === "'") {
    let out = '';
    for (let i = 1; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (quote === '"' && ch === '\\' && i + 1 < trimmed.length) {
        const next = trimmed[++i];
        if (next === 'n') out += '\n';
        else if (next === 'r') out += '\r';
        else if (next === 't') out += '\t';
        else out += next;
        continue;
      }
      if (ch === quote) break;
      out += ch;
    }
    return out;
  }

  // Unquoted value: strip inline `#` comment when preceded by whitespace
  const commentMatch = /\s+#/.exec(trimmed);
  const withoutComment = commentMatch ? trimmed.slice(0, commentMatch.index) : trimmed;
  return withoutComment.trim();
};

const loadEnvFile = (filePath: string): void => {
  if (!fs.existsSync(filePath)) return;
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice(7).trim();

    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;

    const key = line.slice(0, eqIdx).trim();
    if (!KEY_RE.test(key)) continue;
    if (process.env[key] !== undefined) continue;

    process.env[key] = parseEnvValue(line.slice(eqIdx + 1));
  }
};

/**
 * Loads `.env.local` then `.env` from `rootDir` (default: repo root), setting
 * `process.env[k]` only when `process.env[k]` is currently `undefined`.
 */
export function loadLocalEnv(rootDir: string = DEFAULT_ROOT): void {
  loadEnvFile(path.join(rootDir, '.env.local'));
  loadEnvFile(path.join(rootDir, '.env'));
}
