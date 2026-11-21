/**
 * Lightweight PostHog HogQL balance-event fetcher for Node CLI tools.
 *
 * Projects ONLY the analytical columns needed for balance & enjoyment scoring —
 * deliberately excluding multi-hundred-KB `recording` and `save` replay blobs so
 * queries stay fast, cheap, and paginate cleanly past PostHog's 1,000-row cap.
 */
import { POSTHOG_PROJECT_ID } from '../../src/analytics/config';
import { getMinValidVersion, type FightModeFilter } from '../../src/analytics/balanceEras';
import { buildHogqlVersionClause } from '../../src/analytics/posthogRules';

export interface FetchBalanceEventsOptions {
  apiKey: string;
  minVersion?: string;
  includeDev?: boolean;
  mode?: FightModeFilter | 'all';
  maxRows?: number;
  apiHost?: string;
  projectId?: number;
  pageSize?: number;
}

const DEFAULT_API_HOST = 'https://us.posthog.com';
const DEFAULT_MAX_ROWS = 10_000;
const DEFAULT_PAGE_SIZE = 1000;

const BALANCE_SELECT_COLUMNS = `
  uuid,
  event,
  distinct_id,
  timestamp,
  toString(properties.fight_id) AS fight_id,
  toString(properties.app_version) AS app_version,
  toString(properties.balance_era) AS balance_era,
  toString(properties.env) AS env,
  toString(properties.platform) AS platform,
  toString(properties.player_code) AS player_code,
  toString(properties.$session_id) AS session_id,
  toString(properties.journey_stage) AS journey_stage,
  coalesce(toString(properties.mode), 'adventure') AS mode,
  toString(properties.level_id) AS level_id,
  toString(properties.level_name) AS level_name,
  toInt32OrZero(toString(properties.level_order)) AS level_order,
  toInt32OrZero(toString(properties.world)) AS world,
  lower(coalesce(toString(properties.boss), 'false')) IN ('true', '1') AS boss,
  lower(coalesce(toString(properties.practice), 'false')) IN ('true', '1') AS practice,
  toInt32OrNull(toString(properties.spire_act)) AS spire_act,
  toInt32OrNull(toString(properties.spire_floor)) AS spire_floor,
  toInt32OrNull(toString(properties.spire_ascension)) AS spire_ascension,
  toString(properties.spire_node_kind) AS spire_node_kind,
  toString(properties.fighter) AS fighter,
  toString(properties.foe) AS foe,
  toString(properties.outcome) AS outcome,
  toInt32OrZero(toString(properties.stars)) AS stars,
  toFloat64OrZero(toString(properties.duration_ms)) AS duration_ms,
  toFloat64OrZero(toString(properties.damage)) AS damage,
  toFloat64OrZero(toString(properties.dpm)) AS dpm,
  toInt32OrZero(toString(properties.sets)) AS sets,
  toInt32OrZero(toString(properties.mistakes)) AS mistakes,
  toInt32OrZero(toString(properties.helped_sets)) AS helped_sets,
  toInt32OrZero(toString(properties.hints_used)) AS hints_used,
  toInt32OrZero(toString(properties.graces_used)) AS graces_used,
  toFloat64OrZero(toString(properties.triggered_damage_share)) AS triggered_damage_share,
  toFloat64OrZero(toString(properties.biggest_hit_share)) AS biggest_hit_share,
  toFloat64OrNull(toString(properties.median_find_ms)) AS median_find_ms,
  toFloat64OrZero(toString(properties.max_drought_ms)) AS max_drought_ms,
  lower(coalesce(toString(properties.close_call), 'false')) IN ('true', '1') AS close_call,
  lower(coalesce(toString(properties.died_with_hints), 'false')) IN ('true', '1') AS died_with_hints,
  toInt32OrZero(toString(properties.evolutions)) AS evolutions,
  coalesce(toString(properties.weapons), '[]') AS weapons,
  coalesce(toString(properties.weapons_offered), '[]') AS weapons_offered,
  coalesce(toString(properties.weapons_picked), '[]') AS weapons_picked,
  coalesce(toString(properties.weapons_bought), '[]') AS weapons_bought,
  coalesce(toString(properties.evolutions_forged), '[]') AS evolutions_forged,
  coalesce(toString(properties.arcana), '[]') AS arcana,
  toString(properties.fun_rating) AS fun_rating,
  coalesce(toString(properties.fun_tags), '[]') AS fun_tags
`.trim();

const ARRAY_COLUMNS = new Set([
  'weapons',
  'weapons_offered',
  'weapons_picked',
  'weapons_bought',
  'evolutions_forged',
  'arcana',
  'fun_tags',
]);

const parseRowToEvent = (columns: string[], row: unknown[]): Record<string, unknown> => {
  const flat: Record<string, unknown> = {};
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    let val = row[i];
    if (ARRAY_COLUMNS.has(col) && typeof val === 'string') {
      try {
        val = JSON.parse(val);
      } catch {
        val = [];
      }
    }
    if (col === 'fun_rating' && (val === '' || val === 'null')) {
      val = null;
    }
    flat[col] = val;
  }

  const { uuid, event, distinct_id, timestamp, session_id, ...rest } = flat;
  return {
    uuid,
    event,
    distinct_id,
    timestamp,
    properties: {
      ...rest,
      $session_id: session_id || undefined,
    },
  };
};

async function runHogql(
  apiHost: string,
  projectId: number,
  apiKey: string,
  query: string
): Promise<{ columns: string[]; results: unknown[][] }> {
  const url = `${apiHost.replace(/\/$/, '')}/api/projects/${projectId}/query/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        query,
      },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PostHog HogQL query failed (${res.status}): ${text.slice(0, 400)}`);
  }
  const parsed = JSON.parse(text) as { columns?: string[]; results?: unknown[][] };
  return {
    columns: parsed.columns ?? [],
    results: parsed.results ?? [],
  };
}

/**
 * Fetches lightweight `fight_ended` + retrospective `fight_rated` events from PostHog
 * using server-side numeric semver and environment filtering, paginating up to `maxRows`.
 */
export async function fetchBalanceEventsFromPostHog(
  opts: FetchBalanceEventsOptions
): Promise<Record<string, unknown>[]> {
  const apiKey = opts.apiKey.trim();
  if (!apiKey) {
    throw new Error('fetchBalanceEventsFromPostHog requires a non-empty PostHog Personal API Key.');
  }

  const apiHost = opts.apiHost || process.env.POSTHOG_API_HOST || DEFAULT_API_HOST;
  const projectId = opts.projectId ?? POSTHOG_PROJECT_ID;
  const maxRows = Math.max(1, opts.maxRows ?? DEFAULT_MAX_ROWS);
  const pageSize = Math.max(1, Math.min(opts.pageSize ?? DEFAULT_PAGE_SIZE, maxRows));
  const mode = opts.mode ?? 'all';
  const minVersion =
    opts.minVersion ?? getMinValidVersion('all', undefined, mode === 'all' ? undefined : mode);

  const whereParts: string[] = [
    `event IN ('fight_ended', 'fight_rated')`,
    buildHogqlVersionClause(minVersion),
  ];
  if (!opts.includeDev) {
    whereParts.push(`coalesce(toString(properties.env), '') = 'prod'`);
  }
  if (mode !== 'all') {
    whereParts.push(`(event = 'fight_rated' OR coalesce(toString(properties.mode), 'adventure') = '${mode}')`);
  }

  const baseWhere = whereParts.join('\n  AND ');
  const collected: Record<string, unknown>[] = [];
  let offset = 0;

  while (collected.length < maxRows) {
    const limit = Math.min(pageSize, maxRows - collected.length);
    const sql = `
SELECT
  ${BALANCE_SELECT_COLUMNS}
FROM events
WHERE ${baseWhere}
ORDER BY timestamp DESC, uuid DESC
LIMIT ${limit}
OFFSET ${offset}`;

    const { columns, results } = await runHogql(apiHost, projectId, apiKey, sql);
    if (results.length === 0) break;

    for (const row of results) {
      collected.push(parseRowToEvent(columns, row));
    }
    if (results.length < limit) break;
    offset += results.length;
  }

  return collected;
}
