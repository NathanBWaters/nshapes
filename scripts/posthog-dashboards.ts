/**
 * PostHog Dashboard & Data CLI:
 * - `export`: writes `docs/posthog-dashboards.json` (with active Balance Era version floors)
 * - `sync`: creates or updates all 4 NShapes dashboards + 18 HogQL insights via PostHog REST API
 * - `pull`: fetches recent raw `fight_ended` events to `docs/posthog-live-sample.json`
 * - `pull-balance`: lightweight paginated HogQL fetch projecting ONLY balance/analytics columns
 *   (excluding heavy `recording`/`save` blobs) with server-side numeric semver & env filtering.
 *
 * Sync & pull require `POSTHOG_PERSONAL_API_KEY` (personal API key, never the public write key).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  CURRENT_BALANCE_ERA_ID,
  getMinValidVersion,
  type FightModeFilter,
} from '../src/analytics/balanceEras';
import { POSTHOG_PROJECT_ID } from '../src/analytics/config';
import { POSTHOG_DASHBOARDS, buildPostHogExportBundle } from '../src/analytics/posthogDashboards';
import { fetchBalanceEventsFromPostHog } from './lib/posthogFetch';

const API_BASE = process.env.POSTHOG_API_HOST || 'https://us.posthog.com';
const DOCS_DIR = path.resolve(__dirname, '../docs');
const EXPORT_PATH = path.join(DOCS_DIR, 'posthog-dashboards.json');
const PULL_PATH = path.join(DOCS_DIR, 'posthog-live-sample.json');

const parseFlags = (argv: string[]): Record<string, string | boolean> => {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const eqIdx = key.indexOf('=');
    if (eqIdx >= 0) {
      flags[key.slice(0, eqIdx)] = key.slice(eqIdx + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return flags;
};

const requirePersonalKey = (): string => {
  const key = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  if (!key) {
    console.error(
      [
        'Missing POSTHOG_PERSONAL_API_KEY environment variable.',
        'Create a Personal API Key in PostHog -> Settings -> Personal API Keys (scopes: dashboard:write, insight:write, query:read),',
        'then re-run: POSTHOG_PERSONAL_API_KEY=phx_... npm run analytics:posthog:sync',
      ].join('\n')
    );
    process.exit(1);
  }
  return key;
};

async function apiJson<T>(method: string, pathname: string, key: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${pathname} failed (${res.status}): ${text.slice(0, 400)}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

const runExport = () => {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  const bundle = buildPostHogExportBundle();
  fs.writeFileSync(EXPORT_PATH, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  const tileCount = bundle.dashboards.reduce((s, d) => s + d.tiles.length, 0);
  console.log(
    `Exported ${bundle.dashboards.length} PostHog dashboards (${tileCount} HogQL insights, era ${CURRENT_BALANCE_ERA_ID} v${bundle.balanceEra.adventureMinVersion}+) -> ${EXPORT_PATH}`
  );
};

const runSync = async () => {
  const key = requirePersonalKey();
  const base = `/api/projects/${POSTHOG_PROJECT_ID}`;
  const existingDashboards = await apiJson<{ results: { id: number; name: string }[] }>(
    'GET',
    `${base}/dashboards/?limit=100`,
    key
  );
  const existingInsights = await apiJson<{ results: { id: number; name: string; dashboards?: number[] }[] }>(
    'GET',
    `${base}/insights/?limit=200`,
    key
  );

  for (const dash of POSTHOG_DASHBOARDS) {
    const foundDash = existingDashboards.results.find(d => d.name === dash.name);
    const savedDash = foundDash
      ? await apiJson<{ id: number }>('PATCH', `${base}/dashboards/${foundDash.id}/`, key, {
          name: dash.name,
          description: dash.description,
          tags: dash.tags,
        })
      : await apiJson<{ id: number }>('POST', `${base}/dashboards/`, key, {
          name: dash.name,
          description: dash.description,
          tags: dash.tags,
        });

    console.log(`${foundDash ? 'Updated' : 'Created'} dashboard #${savedDash.id}: ${dash.name}`);

    for (const tile of dash.tiles) {
      const matchInsight = existingInsights.results.find(i => i.name === tile.name);
      if (matchInsight) {
        const nextDashboards = Array.from(new Set([...(matchInsight.dashboards ?? []), savedDash.id]));
        await apiJson('PATCH', `${base}/insights/${matchInsight.id}/`, key, {
          name: tile.name,
          description: tile.description,
          dashboards: nextDashboards,
          query: tile.query,
        });
        console.log(`  ↻ Updated insight #${matchInsight.id}: ${tile.name}`);
      } else {
        const created = await apiJson<{ id: number }>('POST', `${base}/insights/`, key, {
          name: tile.name,
          description: tile.description,
          dashboards: [savedDash.id],
          query: tile.query,
        });
        console.log(`  + Created insight #${created.id}: ${tile.name}`);
      }
    }
  }
  console.log(`Synced all dashboards to ${API_BASE}/project/${POSTHOG_PROJECT_ID}`);
};

const runPull = async () => {
  const key = requirePersonalKey();
  const res = await apiJson<{ columns?: string[]; results?: unknown[][] }>(
    'POST',
    `/api/projects/${POSTHOG_PROJECT_ID}/query/`,
    key,
    {
      query: {
        kind: 'HogQLQuery',
        query: `
SELECT
  uuid,
  event,
  distinct_id,
  timestamp,
  properties
FROM events
WHERE event = 'fight_ended'
ORDER BY timestamp DESC
LIMIT 1000`,
      },
    }
  );
  const cols = res.columns ?? ['uuid', 'event', 'distinct_id', 'timestamp', 'properties'];
  const events = (res.results ?? []).map(row => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      const val = row[i];
      if (col === 'properties' && typeof val === 'string') {
        try {
          obj[col] = JSON.parse(val);
        } catch {
          obj[col] = {};
        }
      } else {
        obj[col] = val;
      }
    });
    return obj;
  });

  fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.writeFileSync(
    PULL_PATH,
    `${JSON.stringify({ projectId: POSTHOG_PROJECT_ID, pulledAt: new Date().toISOString(), events }, null, 2)}\n`,
    'utf8'
  );
  console.log(`Pulled ${events.length} fight_ended events -> ${PULL_PATH}`);
};

const runPullBalance = async (flags: Record<string, string | boolean>) => {
  const key = requirePersonalKey();
  const rawMode = typeof flags.mode === 'string' ? flags.mode : 'all';
  const mode = (rawMode === 'adventure' || rawMode === 'spire' || rawMode === 'free_play' || rawMode === 'classic'
    ? rawMode
    : 'all') as FightModeFilter | 'all';
  const minVersion =
    typeof flags['min-version'] === 'string'
      ? flags['min-version']
      : flags['all-eras']
        ? '0.1.119'
        : getMinValidVersion('all', undefined, mode === 'all' ? undefined : mode);
  const includeDev = Boolean(flags['include-dev']);
  const maxRows =
    typeof flags['max-rows'] === 'string' && Number.isFinite(Number(flags['max-rows']))
      ? Math.max(1, Number(flags['max-rows']))
      : 10_000;
  const outPath = typeof flags.out === 'string' ? path.resolve(flags.out) : PULL_PATH;

  const events = await fetchBalanceEventsFromPostHog({
    apiKey: key,
    apiHost: API_BASE,
    projectId: POSTHOG_PROJECT_ID,
    minVersion,
    includeDev,
    mode,
    maxRows,
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        projectId: POSTHOG_PROJECT_ID,
        pulledAt: new Date().toISOString(),
        eraId: CURRENT_BALANCE_ERA_ID,
        minVersion,
        mode,
        includeDev,
        eventCount: events.length,
        events,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  console.log(
    `Pulled ${events.length} lightweight balance events (v${minVersion}+, mode=${mode}, includeDev=${includeDev}) -> ${outPath}`
  );
};

const [cmd = 'export', ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);
if (cmd === 'export') {
  runExport();
} else if (cmd === 'sync') {
  runSync().catch(err => {
    console.error(err);
    process.exit(1);
  });
} else if (cmd === 'pull') {
  runPull().catch(err => {
    console.error(err);
    process.exit(1);
  });
} else if (cmd === 'pull-balance') {
  runPullBalance(flags).catch(err => {
    console.error(err);
    process.exit(1);
  });
} else {
  console.error(`Unknown subcommand "${cmd}". Use: export | sync | pull | pull-balance`);
  process.exit(1);
}
