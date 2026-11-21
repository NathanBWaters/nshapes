/**
 * NShapes Human Bot Calibration CLI (`npm run balance:calibrate-bot`).
 *
 * Fetches era-independent clean `prod` human fights from PostHog (including
 * `recording.actions` for exact per-Set find-time & drought calibration) or
 * loads a local JSON/NDJSON export (`--posthog <file>`), fits a Lognormal +
 * cognitive-load `calibrated_human` `BotProfile`, prints a side-by-side
 * comparison against `BOTS.novice/average/expert`, and optionally writes
 * `docs/calibrated-bot.json` (`--write`).
 *
 * SECURITY: Never prints or commits API keys or player identifiers.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  calibrateBotFromPostHog,
  renderCalibrationMarkdown,
} from '../src/adventure/balance/botCalibrator';
import { loadLocalEnv } from './lib/loadEnv';
import { fetchHumanCalibrationEventsFromPostHog } from './lib/posthogFetch';

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_OUT_PATH = path.join(ROOT_DIR, 'docs', 'calibrated-bot.json');

interface CliArgs {
  help: boolean;
  live: boolean;
  posthogPath?: string;
  includeDev: boolean;
  maxRows: number;
  format: 'md' | 'json';
  write: boolean;
  outPath: string;
}

const HELP_TEXT = `
NShapes Human Bot Calibration CLI (PostHog -> BotProfile)

Usage:
  npm run balance:calibrate-bot -- [options]
  npx tsx scripts/balance-calibrate-bot.ts [options]

Options:
  --live                 Fetch clean prod human fights + recordings from PostHog (auto-loads .env.local)
  --posthog <path>       Calibrate from a local PostHog JSON / { events|results } / HogQL / NDJSON file
  --include-dev          Allow env='dev' rows (Playwright E2E bot signatures remain excluded)
  --max-rows <N>         Maximum PostHog rows to pull in --live mode (default: 500)
  --format <md|json>     Output format to stdout (default: md)
  --write                Write calibrated profile & aggregate stats to docs/calibrated-bot.json
  --out <path>           Custom output JSON path for --write (default: docs/calibrated-bot.json)
  -h, --help             Show this help message

Examples:
  npm run balance:calibrate-bot -- --live --write
  npm run balance:calibrate-bot -- --posthog path/to/export.json --format md
`.trim();

const parseArgs = (argv: readonly string[]): CliArgs => {
  const args: CliArgs = {
    help: false,
    live: false,
    includeDev: false,
    maxRows: 500,
    format: 'md',
    write: false,
    outPath: DEFAULT_OUT_PATH,
  };

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value after ${tok}`);
      return argv[++i];
    };
    switch (tok) {
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '--live':
        args.live = true;
        break;
      case '--posthog':
        args.posthogPath = next();
        break;
      case '--include-dev':
        args.includeDev = true;
        break;
      case '--max-rows': {
        const n = Number(next());
        if (!Number.isInteger(n) || n <= 0) throw new Error('--max-rows requires a positive integer.');
        args.maxRows = n;
        break;
      }
      case '--format': {
        const f = next().toLowerCase();
        if (f !== 'md' && f !== 'json') throw new Error(`Invalid --format "${f}". Expected md or json.`);
        args.format = f;
        break;
      }
      case '--write':
        args.write = true;
        break;
      case '--out':
        args.outPath = path.resolve(next());
        break;
      default:
        throw new Error(`Unknown argument "${tok}". Run with --help for usage.`);
    }
  }
  return args;
};

const parsePostHogFile = (filePath: string): Record<string, unknown>[] => {
  const raw = fs.readFileSync(path.resolve(filePath), 'utf8').trim();
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
    }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.columns) && Array.isArray(obj.results) && Array.isArray(obj.results[0])) {
        const cols = obj.columns as string[];
        return (obj.results as unknown[][]).map(row => {
          const rec: Record<string, unknown> = {};
          for (let i = 0; i < cols.length; i++) {
            let v = row[i];
            if (typeof v === 'string' && (v.startsWith('[') || v.startsWith('{'))) {
              try {
                v = JSON.parse(v);
              } catch {
                // keep string
              }
            }
            rec[cols[i]] = v;
          }
          return rec;
        });
      }
      const list = obj.results ?? obj.events ?? obj.rows;
      if (Array.isArray(list)) {
        return list.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
      }
      return [obj];
    }
  } catch {
    // Fallback to NDJSON
  }

  const out: Record<string, unknown>[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const item: unknown = JSON.parse(trimmed);
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      out.push(item as Record<string, unknown>);
    }
  }
  return out;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }

  loadLocalEnv(ROOT_DIR);

  let events: Record<string, unknown>[];
  let source: string;

  if (args.posthogPath) {
    events = parsePostHogFile(args.posthogPath);
    source = `posthog-file:${path.basename(args.posthogPath)}`;
  } else {
    // Default to --live when no local file is provided
    const apiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        'Missing POSTHOG_PERSONAL_API_KEY. Set it in .env.local or pass --posthog <path-to-export.json>.'
      );
    }
    events = await fetchHumanCalibrationEventsFromPostHog({
      apiKey,
      includeDev: args.includeDev,
      maxRows: args.maxRows,
    });
    source = 'posthog-live';
  }

  const result = calibrateBotFromPostHog(events, {
    includeDev: args.includeDev,
    source,
  });

  if (args.write) {
    fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
    fs.writeFileSync(args.outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.error(`Wrote ${path.relative(ROOT_DIR, args.outPath)} (${result.audit.kept} clean human fights, ${result.audit.unhintedSetsExtracted} unhinted Sets).`);
  }

  if (args.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(renderCalibrationMarkdown(result));
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
