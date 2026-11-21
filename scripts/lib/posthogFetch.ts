/**
 * Lightweight PostHog HogQL balance & calibration event fetcher for Node CLI tools.
 *
 * Uses keyset pagination on `(timestamp, uuid)` (never `OFFSET`, which PostHog
 * rejects on personal API keys) and HogQL-safe cast functions (`toIntOrZero` /
 * `toIntOrNull`, never `toInt32OrZero` / `toInt32OrNull`).
 *
 * - `fetchBalanceEventsFromPostHog`: projects ONLY analytical & behavioral columns
 *   (excluding multi-hundred-KB `recording`/`save` blobs) for fast pagination.
 * - `fetchHumanCalibrationEventsFromPostHog`: pulls `prod` fight rows + compact
 *   `recording` blobs for exact per-Set find-time & drought calibration.
 */
import { POSTHOG_PROJECT_ID } from '../../src/analytics/config';
import { getMinValidVersion, type FightModeFilter } from '../../src/analytics/balanceEras';
import { buildHogqlVersionClause } from '../../src/analytics/posthogRules';
import { loadLocalEnv } from './loadEnv';

export { loadLocalEnv } from './loadEnv';

export interface FetchBalanceEventsOptions {
  apiKey?: string;
  minVersion?: string;
  includeDev?: boolean;
  mode?: FightModeFilter | 'all';
  maxRows?: number;
  apiHost?: string;
  projectId?: number;
  pageSize?: number;
  /** Include raw `recording` payload alongside balance columns (default `false`). */
  includeRecording?: boolean;
}

export interface FetchCalibrationEventsOptions {
  apiKey?: string;
  includeDev?: boolean;
  mode?: FightModeFilter | 'all';
  minVersion?: string;
  maxRows?: number;
  apiHost?: string;
  projectId?: number;
  pageSize?: number;
}

const DEFAULT_API_HOST = 'https://us.posthog.com';
const DEFAULT_MAX_ROWS = 10_000;
const DEFAULT_PAGE_SIZE = 500;

const BALANCE_SELECT_COLUMNS = `
  toString(uuid) AS uuid,
  event,
  distinct_id,
  toString(timestamp) AS timestamp,
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
  toIntOrZero(toString(properties.level_order)) AS level_order,
  toIntOrZero(toString(properties.world)) AS world,
  lower(coalesce(toString(properties.boss), 'false')) IN ('true', '1') AS boss,
  lower(coalesce(toString(properties.practice), 'false')) IN ('true', '1') AS practice,
  toString(properties.difficulty) AS difficulty,
  toIntOrNull(toString(properties.spire_act)) AS spire_act,
  toIntOrNull(toString(properties.spire_floor)) AS spire_floor,
  toIntOrNull(toString(properties.spire_ascension)) AS spire_ascension,
  toString(properties.spire_node_kind) AS spire_node_kind,
  toIntOrNull(toString(properties.parries)) AS parries,
  toIntOrNull(toString(properties.perfect_parries)) AS perfect_parries,
  toString(properties.fighter) AS fighter,
  toString(properties.foe) AS foe,
  toString(properties.outcome) AS outcome,
  toString(properties.end_reason) AS end_reason,
  toIntOrZero(toString(properties.stars)) AS stars,
  toFloat64OrZero(toString(properties.duration_ms)) AS duration_ms,
  toFloat64OrZero(toString(properties.damage)) AS damage,
  toFloat64OrZero(toString(properties.dpm)) AS dpm,
  toIntOrZero(toString(properties.sets)) AS sets,
  toIntOrZero(toString(properties.mistakes)) AS mistakes,
  toIntOrZero(toString(properties.helped_sets)) AS helped_sets,
  toIntOrZero(toString(properties.hints_used)) AS hints_used,
  toIntOrZero(toString(properties.graces_used)) AS graces_used,
  toIntOrNull(toString(properties.hearts_left)) AS hearts_left,
  toIntOrNull(toString(properties.max_hearts)) AS max_hearts,
  toFloat64OrNull(toString(properties.foe_hp_left)) AS foe_hp_left,
  toFloat64OrNull(toString(properties.foe_max_hp)) AS foe_max_hp,
  toFloat64OrNull(toString(properties.foe_hp_pct_left)) AS foe_hp_pct_left,
  toFloat64OrZero(toString(properties.triggered_damage_share)) AS triggered_damage_share,
  toFloat64OrZero(toString(properties.biggest_hit_share)) AS biggest_hit_share,
  toFloat64OrNull(toString(properties.median_find_ms)) AS median_find_ms,
  toFloat64OrZero(toString(properties.max_drought_ms)) AS max_drought_ms,
  lower(coalesce(toString(properties.close_call), 'false')) IN ('true', '1') AS close_call,
  lower(coalesce(toString(properties.died_with_hints), 'false')) IN ('true', '1') AS died_with_hints,
  toIntOrZero(toString(properties.evolutions)) AS evolutions,
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

const NULLABLE_STRING_COLUMNS = new Set(['fun_rating', 'end_reason', 'difficulty', 'spire_node_kind']);

const escapeSqlLiteral = (s: string): string => s.replace(/\\/g, '\\\\').replace(/'/g, "''");

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
    } else if (col === 'recording') {
      if (typeof val === 'string' && val.trim().startsWith('{')) {
        try {
          val = JSON.parse(val);
        } catch {
          val = null;
        }
      } else if (val === '' || val === 'null') {
        val = null;
      }
    } else if (NULLABLE_STRING_COLUMNS.has(col) && (val === '' || val === 'null')) {
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

async function fetchPaginatedHogqlEvents(params: {
  apiKey: string;
  apiHost: string;
  projectId: number;
  selectColumns: string;
  whereParts: string[];
  maxRows: number;
  pageSize: number;
}): Promise<Record<string, unknown>[]> {
  const { apiKey, apiHost, projectId, selectColumns, whereParts, maxRows, pageSize } = params;
  const collected: Record<string, unknown>[] = [];
  let cursorTs: string | null = null;
  let cursorUuid: string | null = null;

  while (collected.length < maxRows) {
    const limit = Math.min(pageSize, maxRows - collected.length);
    const pageWhere = [...whereParts];
    if (cursorTs && cursorUuid) {
      const safeTs = escapeSqlLiteral(cursorTs);
      const safeUuid = escapeSqlLiteral(cursorUuid);
      pageWhere.push(
        `(timestamp < parseDateTime64BestEffort('${safeTs}', 6) OR (timestamp = parseDateTime64BestEffort('${safeTs}', 6) AND toString(uuid) < '${safeUuid}'))`
      );
    }

    const sql = `
SELECT
  ${selectColumns}
FROM events
WHERE ${pageWhere.join('\n  AND ')}
ORDER BY timestamp DESC, uuid DESC
LIMIT ${limit}`;

    const { columns, results } = await runHogql(apiHost, projectId, apiKey, sql);
    if (results.length === 0) break;

    const tsIdx = columns.indexOf('timestamp');
    const uuidIdx = columns.indexOf('uuid');
    for (const row of results) {
      collected.push(parseRowToEvent(columns, row));
    }

    const lastRow = results[results.length - 1];
    const nextTs = tsIdx >= 0 && lastRow[tsIdx] != null ? String(lastRow[tsIdx]) : null;
    const nextUuid = uuidIdx >= 0 && lastRow[uuidIdx] != null ? String(lastRow[uuidIdx]) : null;
    if (results.length < limit || !nextTs || !nextUuid) break;
    if (nextTs === cursorTs && nextUuid === cursorUuid) break;
    cursorTs = nextTs;
    cursorUuid = nextUuid;
  }

  return collected;
}

const resolveApiKey = (explicitKey?: string): string => {
  loadLocalEnv();
  const key = explicitKey?.trim() || process.env.POSTHOG_PERSONAL_API_KEY?.trim() || '';
  if (!key) {
    throw new Error(
      'Missing POSTHOG_PERSONAL_API_KEY. Save a Personal API Key (phx_..., scope: query:read) in .env.local or pass via environment.'
    );
  }
  return key;
};

/**
 * Fetches lightweight `fight_ended` + retrospective `fight_rated` events from PostHog
 * using server-side numeric semver, environment filtering, and keyset pagination on
 * `(timestamp, uuid)`.
 */
export async function fetchBalanceEventsFromPostHog(
  opts: FetchBalanceEventsOptions = {}
): Promise<Record<string, unknown>[]> {
  const apiKey = resolveApiKey(opts.apiKey);
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
    whereParts.push(
      `(event = 'fight_rated' OR coalesce(toString(properties.mode), 'adventure') = '${mode}')`
    );
  }

  const selectColumns = opts.includeRecording
    ? `${BALANCE_SELECT_COLUMNS},\n  toString(properties.recording) AS recording`
    : BALANCE_SELECT_COLUMNS;

  return fetchPaginatedHogqlEvents({
    apiKey,
    apiHost,
    projectId,
    selectColumns,
    whereParts,
    maxRows,
    pageSize,
  });
}

/**
 * Fetches real human `fight_ended` rows (default: `env = 'prod'`, all balance eras)
 * together with `properties.recording` for exact per-Set find-time & drought calibration.
 */
export async function fetchHumanCalibrationEventsFromPostHog(
  opts: FetchCalibrationEventsOptions = {}
): Promise<Record<string, unknown>[]> {
  const apiKey = resolveApiKey(opts.apiKey);
  const apiHost = opts.apiHost || process.env.POSTHOG_API_HOST || DEFAULT_API_HOST;
  const projectId = opts.projectId ?? POSTHOG_PROJECT_ID;
  const maxRows = Math.max(1, opts.maxRows ?? 500);
  const pageSize = Math.max(1, Math.min(opts.pageSize ?? 200, maxRows));
  const mode = opts.mode ?? 'all';

  const whereParts: string[] = [`event = 'fight_ended'`];
  if (!opts.includeDev) {
    whereParts.push(`coalesce(toString(properties.env), '') = 'prod'`);
  }
  if (opts.minVersion) {
    whereParts.push(buildHogqlVersionClause(opts.minVersion));
  }
  if (mode !== 'all') {
    whereParts.push(`coalesce(toString(properties.mode), 'adventure') = '${mode}'`);
  }

  const selectColumns = `${BALANCE_SELECT_COLUMNS},\n  toString(properties.recording) AS recording`;

  return fetchPaginatedHogqlEvents({
    apiKey,
    apiHost,
    projectId,
    selectColumns,
    whereParts,
    maxRows,
    pageSize,
  });
}
