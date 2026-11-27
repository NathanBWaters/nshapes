/**
 * NShapes 6-Tier Multi-Difficulty Enemy Gauntlet CLI (`npm run balance:gauntlet`).
 *
 * Runs all 64 Armory weapons, 6 Fighters, and 192 Per-Weapon Evolutions across 6 real
 * escalating enemy tiers (Adv 1-10, Adv 2-5/2-6, Spire A2 Boss Boar A0,
 * Adv 4-6/4-10, Spire A3 Boss A0 & A18, Adv 5-5 Hydra) under BOTH
 * `BOTS.average` and Nathan's PostHog-calibrated `calibrated_human` bot
 * (`docs/calibrated-bot.json`), writing `docs/balance-gauntlet.json` (`--write`).
 */
import * as fs from 'fs';
import * as path from 'path';
import type { CalibrationResult } from '../src/adventure/balance/botCalibrator';
import {
  DEFAULT_CALIBRATED_HUMAN_BOT,
  renderGauntletMarkdown,
  runGauntlet,
} from '../src/adventure/balance/gauntlet';
import type { BotProfile } from '../src/adventure/engine/bot';

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_BOT_PATH = path.join(ROOT_DIR, 'docs', 'calibrated-bot.json');
const DEFAULT_OUT_PATH = path.join(ROOT_DIR, 'docs', 'balance-gauntlet.json');

interface CliArgs {
  help: boolean;
  botPath: string;
  outPath: string;
  write: boolean;
  format: 'md' | 'json';
  seedScale: number;
  top: number;
  bottom: number;
}

const HELP_TEXT = `
NShapes 6-Tier Multi-Difficulty Enemy Gauntlet CLI

Usage:
  npm run balance:gauntlet -- [options]
  npx tsx scripts/balance-gauntlet.ts [options]

Options:
  --bot <path>          Path to calibrated bot JSON (default: docs/calibrated-bot.json)
  --seed-scale <num>    Multiplier on per-tier seed counts (default: 1.0)
  --format <md|json>    Output format to stdout (default: md)
  --top <N>             Top N weapons/evolutions shown in Markdown summary (default: 12)
  --bottom <N>          Bottom N weapons/evolutions shown in Markdown summary (default: 5)
  --write               Write docs/balance-gauntlet.json
  --out <path>          Custom output path for --write (default: docs/balance-gauntlet.json)
  -h, --help            Show this help message

Examples:
  npm run balance:gauntlet -- --write
  npm run balance:gauntlet -- --seed-scale 0.5 --format md
`.trim();

const parseArgs = (argv: readonly string[]): CliArgs => {
  const args: CliArgs = {
    help: false,
    botPath: DEFAULT_BOT_PATH,
    outPath: DEFAULT_OUT_PATH,
    write: false,
    format: 'md',
    seedScale: 1,
    top: 12,
    bottom: 5,
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
      case '--bot':
        args.botPath = path.resolve(next());
        break;
      case '--out':
        args.outPath = path.resolve(next());
        break;
      case '--write':
        args.write = true;
        break;
      case '--format': {
        const f = next().toLowerCase();
        if (f !== 'md' && f !== 'json') throw new Error(`Invalid --format "${f}". Expected md or json.`);
        args.format = f;
        break;
      }
      case '--seed-scale': {
        const n = Number(next());
        if (!Number.isFinite(n) || n <= 0) throw new Error('--seed-scale requires a positive number.');
        args.seedScale = n;
        break;
      }
      case '--top': {
        const n = Number(next());
        if (!Number.isInteger(n) || n <= 0) throw new Error('--top requires a positive integer.');
        args.top = n;
        break;
      }
      case '--bottom': {
        const n = Number(next());
        if (!Number.isInteger(n) || n <= 0) throw new Error('--bottom requires a positive integer.');
        args.bottom = n;
        break;
      }
      default:
        throw new Error(`Unknown argument "${tok}". Run with --help for usage.`);
    }
  }
  return args;
};

const loadHumanBot = (botPath: string): BotProfile => {
  if (!fs.existsSync(botPath)) {
    console.error(
      `[balance:gauntlet] ${path.relative(ROOT_DIR, botPath)} not found — using built-in default calibrated_human profile. Run \`npm run balance:calibrate-bot -- --live --write\` to calibrate from PostHog.`
    );
    return DEFAULT_CALIBRATED_HUMAN_BOT;
  }
  const parsed = JSON.parse(fs.readFileSync(botPath, 'utf8')) as Partial<CalibrationResult> & Partial<BotProfile>;
  if (parsed.profile && typeof parsed.profile.secondsPerAttribute === 'number') {
    return parsed.profile;
  }
  if (typeof parsed.secondsPerAttribute === 'number') {
    return parsed as BotProfile;
  }
  console.error(`[balance:gauntlet] Unrecognized calibrated bot schema in ${botPath}; using default profile.`);
  return DEFAULT_CALIBRATED_HUMAN_BOT;
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }

  const humanBot = loadHumanBot(args.botPath);
  const report = runGauntlet({
    humanBot,
    seedScale: args.seedScale,
    onProgress: msg => console.error(msg),
  });

  if (args.write) {
    fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
    fs.writeFileSync(args.outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.error(
      `Wrote ${path.relative(ROOT_DIR, args.outPath)} (${report.weapons.length} weapons, ${report.evolutions.length} evolutions, ${report.fighters.length} fighters in ${(report.durationMs / 1000).toFixed(1)}s).`
    );
  }

  if (args.format === 'json') {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderGauntletMarkdown(report, { top: args.top, bottom: args.bottom }));
  }
}

main();
