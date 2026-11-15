/**
 * PostHog Dashboard & Data CLI:
 * - `export`: writes `docs/posthog-dashboards.json`
 * - `sync`: creates or updates all 4 NShapes dashboards + HogQL insights via PostHog REST API
 * - `pull`: fetches recent `fight_ended` events from PostHog HogQL API to `docs/posthog-live-sample.json`
 *
 * Sync & pull require `POSTHOG_PERSONAL_API_KEY` (personal API key, never the public write key).
 */
import * as fs from 'fs';
import * as path from 'path';
import { POSTHOG_DASHBOARDS, buildPostHogExportBundle } from '../src/analytics/posthogDashboards';
import { POSTHOG_PROJECT_ID } from '../src/analytics/config';

const API_BASE = process.env.POSTHOG_API_HOST || 'https://us.posthog.com';
const DOCS_DIR = path.resolve(__dirname, '../docs');
const EXPORT_PATH = path.join(DOCS_DIR, 'posthog-dashboards.json');
const PULL_PATH = path.join(DOCS_DIR, 'posthog-live-sample.json');

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
  console.log(`Exported ${bundle.dashboards.length} PostHog dashboards (${tileCount} HogQL insights) -> ${EXPORT_PATH}`);
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

const cmd = process.argv[2] ?? 'export';
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
} else {
  console.error(`Unknown subcommand "${cmd}". Use: export | sync | pull`);
  process.exit(1);
}
