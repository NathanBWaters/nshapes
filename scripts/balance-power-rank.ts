/**
 * NShapes 1.00x+ Power Rankings CLI (`npm run balance:power`).
 *
 * Reads the latest simulation artifacts (`docs/balance-snapshot.json` and
 * `docs/balance-analytics.json`), optionally ingests PostHog telemetry
 * (`--live`, `--posthog <file>`, or `--simulated-posthog`), enforces Balance Era
 * version-validity & hygiene rules (`src/analytics/balanceEras.ts` +
 * `src/analytics/posthogRules.ts`), and outputs weakest-anchored `1.00x+`
 * rankings for Weapons, Evolutions, Fighters, and Arcana.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { FullBalanceAtlasData } from '../src/adventure/balance/analytics';
import type { GauntletReport } from '../src/adventure/balance/gauntlet';
import {
  CATEGORY_LENSES,
  compareItems,
  computePowerRankings,
  findItemInReport,
  renderPowerRankCompact,
  renderPowerRankMarkdown,
  type EvolutionEntryMeta,
  type FighterEntryMeta,
  type PowerCategory,
  type PowerRankEntry,
  type WeaponEntryMeta,
} from '../src/adventure/balance/powerRank';
import type { Snapshot } from '../src/adventure/balance/report';
import { hasWeaponRole, WEAPON_ROLES, type WeaponRole } from '../src/adventure/data/weaponRoles';
import {
  BALANCE_ERA_MANIFEST,
  CURRENT_BALANCE_ERA,
  getEraById,
  getMinValidVersion,
  type FightModeFilter,
} from '../src/analytics/balanceEras';
import { analyzePostHogForBalance, type PostHogBalanceSignals } from '../src/analytics/posthogRules';
import { loadLocalEnv } from './lib/loadEnv';
import { fetchBalanceEventsFromPostHog } from './lib/posthogFetch';

const ROOT_DIR = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');
const SNAPSHOT_PATH = path.join(DOCS_DIR, 'balance-snapshot.json');
const ANALYTICS_PATH = path.join(DOCS_DIR, 'balance-analytics.json');
const DEFAULT_GAUNTLET_PATH = path.join(DOCS_DIR, 'balance-gauntlet.json');
const OUT_MD_PATH = path.join(DOCS_DIR, 'power-rankings.md');
const OUT_JSON_PATH = path.join(DOCS_DIR, 'power-rankings.json');

interface CliArgs {
  help: boolean;
  categories: PowerCategory[];
  includeArcana: boolean;
  lens?: string;
  mode: FightModeFilter;
  top?: number;
  bottom?: number;
  role?: WeaponRole;
  item?: string;
  compare?: [string, string];
  posthogPath?: string;
  gauntletPath?: string;
  noGauntlet: boolean;
  live: boolean;
  soloTester: boolean;
  simulatedPosthog: boolean;
  includeDev: boolean;
  era: string;
  format: 'md' | 'json' | 'compact';
  write: boolean;
}

const HELP_TEXT = `
NShapes Power Rankings CLI (1.00x Weakest-Anchored Multipliers)

Usage:
  npm run balance:power -- [options]
  npx tsx scripts/balance-power-rank.ts [options]

Options:
  --category <list>      weapons | evolutions | fighters | arcana | all (comma-separated allowed; default: weapons,evolutions,fighters)
  --lens <name>          Sub-lens for the selected category:
                           weapons:    composite (default), inBuild, solo, pressure, shapley, gauntlet, gauntletHuman, gauntletSpire
                           evolutions: composite (default), buildAround, ruleLift, weaponOutput, gauntlet, gauntletHuman, gauntletSpire
                           fighters:   composite (default), fullBuild, pressure160, dummy160, withWeapons90, gauntlet, gauntletHuman, gauntletSpire
                           arcana:     composite (default), effectiveAvg, effectiveExpert, shapley
  --mode <mode>          adventure (default) | spire
  --top <N>              Show only the top N items per category
  --bottom <N>           Show the bottom N items per category (combinable with --top)
  --role <role>          Filter weapons by role (${WEAPON_ROLES.map(r => r.id).join(', ')})
  --item <id|name>       Detailed breakdown for one weapon, evolution, fighter, or Arcana
  --compare <a,b>        Head-to-head multiplier comparison between two items in the same category
  --posthog <path>       Blend live telemetry from a PostHog JSON / NDJSON / HogQL export file
  --live                 Fetch era-valid PostHog events via POSTHOG_PERSONAL_API_KEY (auto-loads .env.local; falls back cleanly to sim-only if unset)
  --solo-tester          Low-sample solo-tester blending (priorK=12, minBlendFights=3, low-N lift clamp, player-count-free credibility & alerts)
  --simulated-posthog    Blend a deterministic simulated PostHog cohort to preview Empirical Bayes blending
  --include-dev          Include env='dev' PostHog events (default: prod only; E2E bot rows filtered in --solo-tester)
  --era <id|all>         Balance era scope: current (default: ${CURRENT_BALANCE_ERA.id} >= v${CURRENT_BALANCE_ERA.minVersion}), an era id (e.g. E7), or all
  --gauntlet <path>      Custom gauntlet JSON path (default: auto-loads docs/balance-gauntlet.json if present)
  --no-gauntlet          Skip loading docs/balance-gauntlet.json
  --format <fmt>         md (default) | json | compact
  --write                Write docs/power-rankings.md and docs/power-rankings.json
  -h, --help             Show this help message

Examples:
  npm run balance:power -- --format compact --top 10 --bottom 5
  npm run balance:power -- --lens gauntletHuman --format compact --top 10 --bottom 5
  npm run balance:power -- --category weapons --lens gauntletSpire --top 15
  npm run balance:power -- --live --era all --solo-tester --top 10 --bottom 5
  npm run balance:power -- --compare blast-powder,chrono-shard
  npm run balance:power -- --item blast-powder:cluster-charge
`.trim();

const parsePositiveInt = (val: string | undefined, flag: string): number => {
  const n = Number(val);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${flag} requires a positive integer (got "${val ?? ''}")`);
  }
  return n;
};

const parseCategories = (raw: string): { categories: PowerCategory[]; includeArcana: boolean } => {
  const tokens = raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.includes('all')) {
    return { categories: ['weapons', 'evolutions', 'fighters', 'arcana'], includeArcana: true };
  }
  const valid = new Set<PowerCategory>(['weapons', 'evolutions', 'fighters', 'arcana']);
  const out: PowerCategory[] = [];
  for (const t of tokens) {
    const mapped =
      t === 'weapon'
        ? 'weapons'
        : t === 'evolution' || t === 'evo' || t === 'evos' || t === 'recipes'
          ? 'evolutions'
          : t === 'fighter'
            ? 'fighters'
            : t;
    if (!valid.has(mapped as PowerCategory)) {
      throw new Error(`Unknown --category "${t}". Expected weapons, evolutions, fighters, arcana, or all.`);
    }
    if (!out.includes(mapped as PowerCategory)) out.push(mapped as PowerCategory);
  }
  if (!out.length) throw new Error('--category requires at least one category.');
  return { categories: out, includeArcana: out.includes('arcana') };
};

const parseArgs = (argv: readonly string[]): CliArgs => {
  const args: CliArgs = {
    help: false,
    categories: ['weapons', 'evolutions', 'fighters'],
    includeArcana: false,
    mode: 'adventure',
    noGauntlet: false,
    live: false,
    soloTester: false,
    simulatedPosthog: false,
    includeDev: false,
    era: 'current',
    format: 'md',
    write: false,
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
      case '--category': {
        const parsed = parseCategories(next());
        args.categories = parsed.categories;
        args.includeArcana = parsed.includeArcana;
        break;
      }
      case '--lens':
        args.lens = next();
        break;
      case '--mode': {
        const m = next().toLowerCase();
        if (m !== 'adventure' && m !== 'spire' && m !== 'free_play' && m !== 'classic') {
          throw new Error(`Invalid --mode "${m}". Expected adventure or spire.`);
        }
        args.mode = m;
        break;
      }
      case '--top':
        args.top = parsePositiveInt(next(), '--top');
        break;
      case '--bottom':
        args.bottom = parsePositiveInt(next(), '--bottom');
        break;
      case '--role': {
        const r = next().toLowerCase();
        const roleIds = new Set(WEAPON_ROLES.map(x => x.id));
        if (!roleIds.has(r as WeaponRole) && !hasWeaponRole(r)) {
          throw new Error(`Unknown --role "${r}". Valid roles: ${WEAPON_ROLES.map(x => x.id).join(', ')}`);
        }
        args.role = r as WeaponRole;
        break;
      }
      case '--item':
        args.item = next();
        break;
      case '--compare': {
        const pair = next()
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
        if (pair.length !== 2) throw new Error('--compare requires two comma-separated item IDs/names, e.g. --compare blast-powder,chrono-shard');
        args.compare = [pair[0], pair[1]];
        break;
      }
      case '--posthog':
        args.posthogPath = next();
        break;
      case '--gauntlet':
        args.gauntletPath = next();
        break;
      case '--no-gauntlet':
        args.noGauntlet = true;
        break;
      case '--live':
        args.live = true;
        break;
      case '--solo-tester':
        args.soloTester = true;
        break;
      case '--simulated-posthog':
        args.simulatedPosthog = true;
        break;
      case '--include-dev':
        args.includeDev = true;
        break;
      case '--era':
        args.era = next();
        break;
      case '--format': {
        const f = next().toLowerCase();
        if (f !== 'md' && f !== 'json' && f !== 'compact') {
          throw new Error(`Invalid --format "${f}". Expected md, json, or compact.`);
        }
        args.format = f;
        break;
      }
      case '--write':
        args.write = true;
        break;
      default:
        throw new Error(`Unknown argument "${tok}". Run with --help for usage.`);
    }
  }
  return args;
};

/**
 * Parses PostHog JSON arrays, `{ results: [...] }` envelopes, HogQL `{ columns, results: [[...]] }`
 * matrix payloads, or NDJSON (one JSON object per line).
 */
const parsePostHogFile = (filePath: string): Record<string, unknown>[] => {
  const raw = fs.readFileSync(path.resolve(filePath), 'utf8').trim();
  if (!raw) return [];

  const convertHogqlMatrix = (columns: string[], matrix: unknown[][]): Record<string, unknown>[] =>
    matrix.map(row => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) {
        let v = row[i];
        if (typeof v === 'string' && (v.startsWith('[') || v.startsWith('{'))) {
          try {
            v = JSON.parse(v);
          } catch {
            // keep string
          }
        }
        obj[columns[i]] = v;
      }
      return obj;
    });

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
    }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.columns) && Array.isArray(obj.results)) {
        const first = obj.results[0];
        if (Array.isArray(first)) {
          return convertHogqlMatrix(obj.columns as string[], obj.results as unknown[][]);
        }
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

const formatSingleItemDetail = (entry: PowerRankEntry): string => {
  const lines: string[] = [];
  lines.push(`# ${entry.name} (\`${entry.id}\`) — ${entry.category.toUpperCase()} #${entry.rank}`);
  lines.push('');
  lines.push(`- **Primary Power Multiplier:** **${entry.powerMult.toFixed(2)}×** (weakest in category = 1.00×)`);
  if (entry.addedMult !== null) {
    lines.push(`- **Added-Power Multiplier:** **${entry.addedMult.toFixed(2)}×** (marginal log-lift over bare baseline)`);
  }
  lines.push(`- **Simulation Multiplier:** ${entry.simMult.toFixed(2)}× (raw composite index \`${entry.rawSimIndex.toFixed(3)}\`)`);
  if (entry.fights > 0) {
    const ci = entry.ciLow !== null && entry.ciHigh !== null ? ` (95% CI: ${entry.ciLow.toFixed(2)}–${entry.ciHigh.toFixed(2)}×)` : '';
    lines.push(
      `- **PostHog Live Telemetry:** live=${entry.liveMult?.toFixed(2) ?? '—'}×${ci} | weight=${Math.round(entry.liveWeight * 100)}% | fights=${entry.fights} (n_eff=${entry.effectiveN}, players=${entry.uniquePlayers}, tier=\`${entry.credibility}\`, validSince=\`v${entry.validSince ?? 'n/a'}\`)`
    );
  } else {
    lines.push(`- **PostHog Live Telemetry:** sim-only (validSince \`v${entry.validSince ?? 'n/a'}\`)`);
  }
  lines.push(
    `- **Sub-Lenses (1.00× anchored):** ${Object.entries(entry.subLenses)
      .map(([k, v]) => `${k}=${v.toFixed(2)}×`)
      .join(' | ')}`
  );

  if (entry.meta.kind === 'weapons') {
    const m = entry.meta as WeaponEntryMeta;
    lines.push(
      `- **Weapon Profile:** role=\`${m.role}\`${m.partner ? ' (partner-only)' : ''} | inBuild=×${m.inBuildLift.toFixed(2)} | early=×${m.soloEarly.toFixed(2)} | campaign=×${m.soloCampaign.toFixed(2)} | late(nov/avg/exp)=×${m.soloLateNovice.toFixed(2)}/×${m.soloLateAvg.toFixed(2)}/×${m.soloLateExpert.toFixed(2)} | pressure=×${m.pressureAvg.toFixed(2)} | shapley=×${m.shapleyMult.toFixed(2)} | baseShare=${Math.round(m.baseDamageShare * 100)}%`
    );
  } else if (entry.meta.kind === 'evolutions') {
    const m = entry.meta as EvolutionEntryMeta;
    const slotLabel = (['A', 'B', 'C'] as const)[m.variantIndex] ?? 'A';
    lines.push(
      `- **Evolution Profile:** weapon=\`${m.weaponId}\` (Slot ${slotLabel}, #${m.withinWeaponRank}/3) | cond=\`${m.conditionType}\` | cleanTotal=×${m.cleanTotalLift.toFixed(2)} (raw ×${m.rawTotalLift.toFixed(2)}) | ruleLift=×${m.ruleLift.toFixed(2)} | weaponOutput=×${m.weaponOutputLift.toFixed(2)} | buildAround=${m.buildAroundMult.toFixed(2)}× | triggers=${m.triggersPerFight.toFixed(1)}/fight`
    );
  } else if (entry.meta.kind === 'fighters') {
    const m = entry.meta as FighterEntryMeta;
    lines.push(
      `- **Fighter Profile:** passives=\`${m.passives.join(', ')}\` | dummy(0/60/160★)=×${m.dummy0Stars.toFixed(2)}/×${m.dummy60Stars.toFixed(2)}/×${m.dummy160Stars.toFixed(2)} | pressure(0/60/160★)=×${m.pressure0Stars.toFixed(2)}/×${m.pressure60Stars.toFixed(2)}/×${m.pressure160Stars.toFixed(2)} (surv ${Math.round(m.pressureSurvival160 * 100)}%) | 90★+wep=×${m.withWeapons90Mean.toFixed(2)} | shapley=×${m.shapleyMult.toFixed(3)}`
    );
  }
  if (entry.alerts.length) {
    lines.push('- **Alerts:**');
    for (const a of entry.alerts) lines.push(`  - \`${a.kind}\`: ${a.detail}`);
  }
  return lines.join('\n') + '\n';
};

/**
 * Deterministic Node-safe simulated PostHog cohort generator for `--simulated-posthog`
 * (avoids importing React-Native modules in Node CLI while exercising all `posthogRules.ts`
 * gates: version-era filtering, hygiene exclusion, `fight_rated` folding, Simpson's
 * stratification, evolution survivorship, Ridge co-occurrence debiasing, and EB shrinkage).
 */
const buildSimulatedPostHogCohort = (
  analytics: FullBalanceAtlasData,
  mode: FightModeFilter
): Record<string, unknown>[] => {
  let state = 20261121 >>> 0;
  const rng = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

  const weapons = analytics.weaponsSuite.weapons.map(w => w.id);
  const pairSuiteAny = analytics.pairSuite as unknown as {
    evolutions?: readonly { id: string; weaponId?: string }[];
    recipes?: readonly { id: string }[];
  };
  const evoPool: readonly { id: string; weaponId?: string }[] =
    pairSuiteAny.evolutions && pairSuiteAny.evolutions.length > 0
      ? pairSuiteAny.evolutions
      : (pairSuiteAny.recipes ?? []).slice(0, 24).map(r => ({ id: r.id }));
  const evosByWeapon = new Map<string, string[]>();
  for (const ev of evoPool) {
    if (!ev.weaponId) continue;
    const list = evosByWeapon.get(ev.weaponId) ?? [];
    list.push(ev.id);
    evosByWeapon.set(ev.weaponId, list);
  }
  const fighters = analytics.fighterSuite.curves.map(f => f.fighter);
  const arcana = analytics.arcanaSuite.solo.map(a => a.id);
  const levels = analytics.campaignSuite.levels.filter(l => l.id !== '1-1').slice(0, 24);

  const curVer = BALANCE_ERA_MANIFEST.currentAppVersion;
  const events: Record<string, unknown>[] = [];
  let seq = 0;

  // 1. Add 25 stale pre-era events + 10 dev/bug/short events to demonstrate audit-ledger enforcement
  for (let i = 0; i < 25; i++) {
    events.push({
      event: 'fight_ended',
      distinct_id: `stale-player-${i % 8}`,
      timestamp: new Date(Date.UTC(2026, 10, 18, 12, i)).toISOString(),
      properties: {
        fight_id: `stale-${i}`,
        app_version: '0.1.158',
        env: 'prod',
        mode,
        level_id: levels[i % levels.length].id,
        world: levels[i % levels.length].world,
        fighter: fighters[i % fighters.length],
        outcome: 'won',
        sets: 14,
        duration_ms: 95_000,
        dpm: 420,
        weapons: [weapons[i % weapons.length], weapons[(i + 7) % weapons.length]],
      },
    });
  }
  for (let i = 0; i < 10; i++) {
    events.push({
      event: 'fight_ended',
      distinct_id: `hygiene-player-${i}`,
      timestamp: new Date(Date.UTC(2026, 10, 21, 12, i)).toISOString(),
      properties: {
        fight_id: `hyg-${i}`,
        app_version: curVer,
        env: i < 4 ? 'dev' : 'prod',
        mode,
        practice: i === 4 || i === 5,
        level_id: levels[i % levels.length].id,
        world: levels[i % levels.length].world,
        fighter: fighters[i % fighters.length],
        outcome: 'won',
        sets: i >= 8 ? 1 : 12,
        duration_ms: i >= 8 ? 4000 : 80_000,
        dpm: 300,
        weapons: [weapons[0], weapons[1]],
        fun_tags: i === 6 || i === 7 ? ['bug_in_game'] : [],
      },
    });
  }

  // 2. Generate 360 valid current-era fights across 40 players
  for (let i = 0; i < 360; i++) {
    const pid = `sim-player-${String((i % 40) + 1).padStart(3, '0')}`;
    const lvl = levels[Math.floor(rng() * levels.length)];
    const fighter = pick(fighters);
    const chosen = new Set<string>();
    while (chosen.size < 4) chosen.add(pick(weapons));
    const held = [...chosen];
    const equippedEvos: string[] = [];
    for (const w of held) {
      const candidates = evosByWeapon.get(w);
      if (candidates && candidates.length > 0 && rng() < 0.7) {
        equippedEvos.push(pick(candidates));
      }
    }
    const forged: string[] = [];
    if (equippedEvos.length > 0) {
      for (const evoId of equippedEvos) {
        if (rng() < 0.55) forged.push(evoId);
      }
    } else if (evoPool.length > 0 && rng() < 0.45) {
      forged.push(pick(evoPool).id);
    }
    const eqArc = rng() < 0.5 ? [pick(arcana)] : [];

    // Slight realistic live signal: mild win/DPM boosts for a few items so blending is visible
    let logit = (lvl.investedWinRate - 0.5) * 2.2;
    let logDpm = Math.log(280 + lvl.world * 120);
    if (held.includes('revenge-linker')) {
      logit += 0.65;
      logDpm += 0.25;
    }
    if (held.includes('chain-gang')) {
      logit -= 0.55;
      logDpm -= 0.22;
    }
    if (fighter === 'Pelican') logit += 0.35;
    const winProb = 1 / (1 + Math.exp(-logit));
    const won = rng() < winProb;
    const dpm = Math.round(Math.exp(logDpm + (rng() - 0.5) * 0.35));
    const fightId = `sim-cur-${++seq}`;
    const funRating = rng() < 0.65 ? (rng() < (won ? 0.84 : 0.42) ? 'up' : 'down') : null;

    events.push({
      event: 'fight_ended',
      distinct_id: pid,
      timestamp: new Date(Date.UTC(2026, 10, 21, 17, 0, i)).toISOString(),
      properties: {
        fight_id: fightId,
        app_version: curVer,
        env: 'prod',
        mode,
        level_id: lvl.id,
        level_order: levels.indexOf(lvl) + 1,
        world: lvl.world,
        boss: lvl.kind === 'boss',
        practice: false,
        fighter,
        outcome: won ? 'won' : 'lost',
        sets: 10 + Math.floor(rng() * 18),
        duration_ms: 45_000 + Math.floor(rng() * 115_000),
        damage: Math.round((dpm * 90) / 60),
        dpm,
        mistakes: Math.floor(rng() * 3),
        helped_sets: 0,
        evolutions: forged.length,
        evolutions_forged: forged,
        equipped_evolutions: equippedEvos,
        weapon_evos_triggered: forged.length,
        peak_base_damage: Math.round(18 + lvl.world * 12 + rng() * 35),
        synergy_score_total: Math.round(held.length * 1.5 + rng() * 6),
        weapons: held,
        weapons_offered: [held[0], pick(weapons), pick(weapons)],
        weapons_picked: [held[0]],
        weapons_bought: [],
        arcana: eqArc,
        fun_rating: i % 12 === 0 ? null : funRating,
        fun_tags: funRating === 'up' ? ['satisfying_combos'] : funRating === 'down' ? ['too_slow'] : [],
      },
    });
    if (i % 12 === 0 && funRating) {
      events.push({
        event: 'fight_rated',
        distinct_id: pid,
        timestamp: new Date(Date.UTC(2026, 10, 21, 17, 30, i)).toISOString(),
        properties: {
          fight_id: fightId,
          app_version: curVer,
          env: 'prod',
          fun_rating: funRating,
          fun_tags: funRating === 'up' ? ['satisfying_combos'] : ['too_slow'],
        },
      });
    }
  }
  return events;
};

async function loadPostHogSignals(
  args: CliArgs,
  analytics: FullBalanceAtlasData
): Promise<PostHogBalanceSignals | null> {
  let rawEvents: Record<string, unknown>[] | null = null;

  if (args.posthogPath) {
    rawEvents = parsePostHogFile(args.posthogPath);
  } else if (args.simulatedPosthog) {
    rawEvents = buildSimulatedPostHogCohort(analytics, args.mode);
  } else if (args.live) {
    const apiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
    if (!apiKey) {
      console.error(
        [
          '[balance:power] POSTHOG_PERSONAL_API_KEY is not set — falling back cleanly to simulation-only rankings.',
          'To blend live PostHog data, create a Personal API Key (scope: query:read) and run:',
          '  POSTHOG_PERSONAL_API_KEY=phx_... npm run balance:power -- --live',
        ].join('\n')
      );
      return null;
    }
    const minVersion =
      args.era === 'all'
        ? '0.1.119'
        : args.era === 'current'
          ? getMinValidVersion('all', undefined, args.mode)
          : (getEraById(args.era)?.minVersion ?? CURRENT_BALANCE_ERA.minVersion);

    rawEvents = await fetchBalanceEventsFromPostHog({
      apiKey,
      minVersion,
      includeDev: args.includeDev,
      mode: args.mode,
    });
  }

  if (!rawEvents) return null;

  const signals = analyzePostHogForBalance(rawEvents, {
    mode: args.mode,
    includeDev: args.includeDev,
    eraId: args.era,
    soloTester: args.soloTester,
  });

  if (signals.audit.kept === 0 && args.era === 'current') {
    console.error(
      `[balance:power] 0 fights kept under current era ${CURRENT_BALANCE_ERA.id} (>= v${CURRENT_BALANCE_ERA.minVersion}). ` +
        `Tip: re-run with \`--era E7 --solo-tester\` (most recent human session) or \`--era all --solo-tester\` for all-era directional blending.`
    );
  }

  return signals;
}

const loadOptionalGauntlet = (args: CliArgs): GauntletReport | null => {
  if (args.noGauntlet) return null;
  const target = args.gauntletPath ? path.resolve(args.gauntletPath) : DEFAULT_GAUNTLET_PATH;
  if (!fs.existsSync(target)) {
    if (args.gauntletPath) {
      throw new Error(`Gauntlet file not found: ${target}`);
    }
    return null;
  }
  return JSON.parse(fs.readFileSync(target, 'utf8')) as GauntletReport;
};

async function main() {
  loadLocalEnv(ROOT_DIR);

  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }

  const snapshot: Snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const analytics: FullBalanceAtlasData = JSON.parse(fs.readFileSync(ANALYTICS_PATH, 'utf8'));
  const gauntlet = loadOptionalGauntlet(args);
  const posthog = await loadPostHogSignals(args, analytics);

  const lenses: Partial<Record<PowerCategory, string>> = {};
  if (args.lens) {
    const low = args.lens.toLowerCase();
    const isGauntletAlias =
      low === 'gauntlet' ||
      low === 'gauntlethuman' ||
      low === 'gauntlet-human' ||
      low === 'gauntletspire' ||
      low === 'gauntlet-spire' ||
      low === 'human';
    for (const c of args.categories) {
      if (CATEGORY_LENSES[c].includes(args.lens) || (isGauntletAlias && c !== 'arcana') || args.categories.length === 1) {
        lenses[c] = args.lens;
      }
    }
  }

  const report = computePowerRankings({
    snapshot,
    analytics,
    posthog,
    gauntlet,
    lenses,
    mode: args.mode,
    soloTester: args.soloTester,
  });

  if (args.write) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
    const fullMd = renderPowerRankMarkdown(report, {
      categories: args.includeArcana ? ['weapons', 'evolutions', 'fighters', 'arcana'] : ['weapons', 'evolutions', 'fighters'],
      includeAllEvolutions: true,
      includeMethodology: true,
    });
    fs.writeFileSync(OUT_MD_PATH, fullMd, 'utf8');
    fs.writeFileSync(OUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(
      `Wrote ${path.relative(ROOT_DIR, OUT_MD_PATH)} & ${path.relative(ROOT_DIR, OUT_JSON_PATH)} ` +
        `(era=${report.currentEraId}, live=${report.hasLiveData ? 'blended' : 'sim-only'})`
    );
    return;
  }

  if (args.item) {
    const found = findItemInReport(report, args.item);
    if (!found) {
      console.error(`Item "${args.item}" not found in weapons, evolutions, fighters, or arcana.`);
      process.exit(1);
    }
    console.log(args.format === 'json' ? JSON.stringify(found, null, 2) : formatSingleItemDetail(found));
    return;
  }

  if (args.compare) {
    const cmp = compareItems(report, args.compare[0], args.compare[1]);
    if (!cmp) {
      console.error(`Could not compare "${args.compare[0]}" vs "${args.compare[1]}" (must exist in the same category).`);
      process.exit(1);
    }
    if (args.format === 'json') {
      console.log(JSON.stringify(cmp, null, 2));
      return;
    }
    console.log(
      [
        `# Compare (${cmp.category.toUpperCase()}): ${cmp.a.name} vs ${cmp.b.name}`,
        '',
        `- **${cmp.a.name}** (#${cmp.a.rank}): **${cmp.a.powerMult.toFixed(2)}×**${cmp.a.addedMult ? ` (added ${cmp.a.addedMult.toFixed(2)}×)` : ''}`,
        `- **${cmp.b.name}** (#${cmp.b.rank}): **${cmp.b.powerMult.toFixed(2)}×**${cmp.b.addedMult ? ` (added ${cmp.b.addedMult.toFixed(2)}×)` : ''}`,
        `- **Head-to-head ratio:** ${cmp.a.name} is **${cmp.ratioAOverB.toFixed(2)}×** of ${cmp.b.name} (rank delta: ${cmp.rankDelta >= 0 ? `+${cmp.rankDelta}` : cmp.rankDelta})`,
        `- **Sub-lens ratios (${cmp.a.id} ÷ ${cmp.b.id}):** ${Object.entries(cmp.subLensRatios)
          .map(([k, v]) => `${k}=${v.toFixed(2)}×`)
          .join(' | ')}`,
      ].join('\n')
    );
    return;
  }

  if (args.format === 'json') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (args.format === 'compact') {
    console.log(
      renderPowerRankCompact(report, {
        categories: args.categories,
        top: args.top,
        bottom: args.bottom,
        role: args.role,
      })
    );
    return;
  }
  console.log(
    renderPowerRankMarkdown(report, {
      categories: args.categories,
      top: args.top,
      bottom: args.bottom,
      role: args.role,
      includeAllEvolutions: !args.top && !args.bottom,
      includeMethodology: !args.top && !args.bottom,
    })
  );
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
