/**
 * Authoritative PostHog Dashboard & HogQL Insight specifications for NShapes.
 *
 * Targets PostHog project `738615` (`https://us.posthog.com/project/738615`)
 * built strictly on the two minimal events: `app_opened` and `fight_ended`
 * (+ optional retrospective `fight_rated`).
 *
 * All campaign funnel & balance HogQL queries automatically import their active
 * numeric-semver `minVersion` floor and hygiene rules from `balanceEras.ts` +
 * `posthogRules.ts` so stale pre-rebalance telemetry and dev/practice/bug-tagged
 * runs are excluded consistently across PostHog UI, `/dev/analytics`, and CLI.
 *
 * Exported to `docs/posthog-dashboards.json` via `npm run analytics:export` and
 * synced directly into PostHog via `npm run analytics:posthog:sync`.
 */
import {
  CURRENT_BALANCE_ERA,
  CURRENT_BALANCE_ERA_ID,
  getMinValidVersion,
} from './balanceEras';
import { POSTHOG_PROJECT_ID } from './config';
import {
  buildHogqlBalanceHygieneWhere,
  buildHogqlVersionClause,
} from './posthogRules';

export interface PostHogTileSpec {
  id: string;
  name: string;
  description: string;
  category: 'overview' | 'funnel' | 'balance' | 'enjoyment';
  hogql: string;
  query: {
    kind: 'DataTableNode';
    full: boolean;
    source: {
      kind: 'HogQLQuery';
      query: string;
    };
  };
}

export interface PostHogDashboardSpec {
  id: string;
  name: string;
  description: string;
  tags: string[];
  tiles: PostHogTileSpec[];
}

const ADVENTURE_MIN_VERSION = getMinValidVersion('all', undefined, 'adventure');
const SPIRE_MIN_VERSION = getMinValidVersion('all', undefined, 'spire');
const WEAPONS_MIN_VERSION = getMinValidVersion('weapons', undefined, 'adventure');
const EVOLUTIONS_MIN_VERSION = getMinValidVersion('evolutions', undefined, 'adventure');
const FIGHTERS_MIN_VERSION = getMinValidVersion('fighters', undefined, 'adventure');
const ARCANA_MIN_VERSION = getMinValidVersion('arcana', undefined, 'adventure');

const PROD_ONLY = `coalesce(toString(properties.env), '') = 'prod'`;
const NOT_PRACTICE = `lower(coalesce(toString(properties.practice), 'false')) NOT IN ('true', '1')`;
const NOT_BUG_TAGGED = `NOT has(JSONExtractArrayRaw(coalesce(toString(properties.fun_tags), '[]')), '"bug_in_game"')`;
const SAFE_LOG_DPM = `log(greatest(toFloat64OrZero(toString(properties.dpm)), 1))`;
const ADV_FUNNEL_WHERE = [
  `event = 'fight_ended'`,
  PROD_ONLY,
  `coalesce(toString(properties.mode), 'adventure') = 'adventure'`,
  NOT_PRACTICE,
  `coalesce(toString(properties.outcome), '') != 'practice'`,
  NOT_BUG_TAGGED,
  buildHogqlVersionClause(ADVENTURE_MIN_VERSION),
].join('\n  AND ');

const ADV_WEAPON_BALANCE_WHERE = buildHogqlBalanceHygieneWhere({
  mode: 'adventure',
  minVersion: WEAPONS_MIN_VERSION,
  decidedOnly: true,
});

const ADV_WEAPON_OFFER_WHERE = buildHogqlBalanceHygieneWhere({
  mode: 'adventure',
  minVersion: WEAPONS_MIN_VERSION,
  decidedOnly: false,
});

const ADV_FIGHTER_BALANCE_WHERE = buildHogqlBalanceHygieneWhere({
  mode: 'adventure',
  minVersion: FIGHTERS_MIN_VERSION,
  decidedOnly: true,
});

const ADV_EVO_BALANCE_WHERE = buildHogqlBalanceHygieneWhere({
  mode: 'adventure',
  minVersion: EVOLUTIONS_MIN_VERSION,
  decidedOnly: true,
});

const ADV_ARCANA_BALANCE_WHERE = buildHogqlBalanceHygieneWhere({
  mode: 'adventure',
  minVersion: ARCANA_MIN_VERSION,
  decidedOnly: true,
});

const hogqlTile = (
  id: string,
  name: string,
  category: PostHogTileSpec['category'],
  description: string,
  hogql: string
): PostHogTileSpec => {
  const cleanSql = hogql.trim();
  return {
    id,
    name,
    category,
    description,
    hogql: cleanSql,
    query: {
      kind: 'DataTableNode',
      full: true,
      source: {
        kind: 'HogQLQuery',
        query: cleanSql,
      },
    },
  };
};

export const POSTHOG_DASHBOARDS: PostHogDashboardSpec[] = [
  {
    id: 'nshapes-executive-pulse',
    name: 'NShapes · 1. Executive Pulse & Retention',
    description:
      'Daily active players (prod), single-event fight volume, win/fun/abandon rates, session depth, D1/D7 retention cohorts, and player journey stages.',
    tags: ['nshapes', 'game-analytics', 'executive'],
    tiles: [
      hogqlTile(
        'exec-daily-pulse',
        'Daily Active Players, Fights & Fun Rate (30d)',
        'overview',
        'Top-line prod DAU, fight_ended count, decided win rate, abandon rate, and thumbs-up enjoyment rate.',
        `
SELECT
  toDate(timestamp) AS day,
  uniqExact(distinct_id) AS dau,
  count() AS fights,
  round(countIf(properties.outcome IN ('won', 'survived')) / nullIf(countIf(properties.outcome IN ('won', 'survived', 'lost')), 0) * 100, 1) AS win_pct,
  round(countIf(properties.outcome = 'left') / count() * 100, 1) AS abandon_pct,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
WHERE event = 'fight_ended'
  AND ${PROD_ONLY}
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY day
ORDER BY day DESC`
      ),
      hogqlTile(
        'exec-cohort-retention',
        'Install Cohort D1 / D3 / D7 / D14 Retention',
        'overview',
        'Classic day-offset prod retention grouped by each player’s first_seen_date person property.',
        `
SELECT
  toDate(person.properties.first_seen_date) AS cohort_date,
  uniqExact(distinct_id) AS cohort_size,
  round(uniqExactIf(distinct_id, toIntOrZero(toString(properties.days_since_install)) = 1) / nullIf(uniqExact(distinct_id), 0) * 100, 1) AS d1_pct,
  round(uniqExactIf(distinct_id, toIntOrZero(toString(properties.days_since_install)) = 3) / nullIf(uniqExact(distinct_id), 0) * 100, 1) AS d3_pct,
  round(uniqExactIf(distinct_id, toIntOrZero(toString(properties.days_since_install)) = 7) / nullIf(uniqExact(distinct_id), 0) * 100, 1) AS d7_pct,
  round(uniqExactIf(distinct_id, toIntOrZero(toString(properties.days_since_install)) = 14) / nullIf(uniqExact(distinct_id), 0) * 100, 1) AS d14_pct
FROM events
WHERE event IN ('app_opened', 'fight_ended')
  AND ${PROD_ONLY}
  AND person.properties.first_seen_date IS NOT NULL
  AND timestamp >= now() - INTERVAL 45 DAY
GROUP BY cohort_date
ORDER BY cohort_date DESC`
      ),
      hogqlTile(
        'exec-journey-stages',
        'Player Lifecycle Journey Breakdown',
        'overview',
        'Current distribution of prod players across NShapes progression stages (onboarding -> veteran / free_play_explorer).',
        `
SELECT
  coalesce(toString(person.properties.journey_stage), 'unknown') AS journey_stage,
  uniqExact(distinct_id) AS players,
  count() AS fights,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
WHERE event = 'fight_ended'
  AND ${PROD_ONLY}
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY journey_stage
ORDER BY players DESC`
      ),
      hogqlTile(
        'exec-mode-mix',
        'Mode Split (Adventure vs Starfall Summit vs Free Play vs Classic)',
        'overview',
        'Prod volume, session duration, and fun sentiment by game mode.',
        `
SELECT
  coalesce(toString(properties.mode), 'adventure') AS mode,
  uniqExact(distinct_id) AS players,
  count() AS fights,
  round(avg(toFloat64OrZero(toString(properties.duration_ms))) / 1000, 1) AS avg_sec,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
WHERE event = 'fight_ended'
  AND ${PROD_ONLY}
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY mode
ORDER BY fights DESC`
      ),
      hogqlTile(
        'exec-session-depth',
        'Fights Per Session & Rage-Quit Rate',
        'overview',
        'Tracks prod session engagement depth and first-session vs returning-session stamina.',
        `
SELECT
  coalesce(toString(properties.platform), 'unknown') AS platform,
  uniqExact(toString(properties.$session_id)) AS sessions,
  round(count() / nullIf(uniqExact(toString(properties.$session_id)), 0), 2) AS avg_fights_per_session,
  round(countIf(properties.outcome = 'left') / count() * 100, 1) AS abandon_pct,
  round(median(toFloat64OrZero(toString(properties.median_find_ms))) / 1000, 2) AS median_find_sec
FROM events
WHERE event = 'fight_ended'
  AND ${PROD_ONLY}
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY platform
ORDER BY sessions DESC`
      ),
    ],
  },
  {
    id: 'nshapes-campaign-funnel',
    name: 'NShapes · 2. Campaign Funnel & Churn Walls',
    description: `Level-by-level progression funnel, attempts per clear, difficulty spikes, unused-hint deaths, and churn walls scoped to Balance Era ${CURRENT_BALANCE_ERA_ID} (v${ADVENTURE_MIN_VERSION}+).`,
    tags: ['nshapes', 'game-analytics', 'funnel', 'levels', CURRENT_BALANCE_ERA_ID],
    tiles: [
      hogqlTile(
        'funnel-level-progression',
        `Adventure Campaign Progression Funnel (v${ADVENTURE_MIN_VERSION}+)`,
        'funnel',
        `Prod players reached vs cleared, win rate, abandon rate, and enjoyment per campaign level since ${CURRENT_BALANCE_ERA_ID} (v${ADVENTURE_MIN_VERSION}+).`,
        `
SELECT
  toIntOrZero(toString(properties.level_order)) AS level_order,
  toString(properties.level_id) AS level_id,
  any(toString(properties.level_name)) AS level_name,
  uniqExact(distinct_id) AS players_reached,
  uniqExactIf(distinct_id, properties.outcome IN ('won', 'survived')) AS players_cleared,
  count() AS attempts,
  round(countIf(properties.outcome IN ('won', 'survived')) / nullIf(countIf(properties.outcome IN ('won', 'survived', 'lost')), 0) * 100, 1) AS win_pct,
  round(countIf(properties.outcome = 'left') / count() * 100, 1) AS abandon_pct,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
WHERE ${ADV_FUNNEL_WHERE}
GROUP BY level_order, level_id
ORDER BY level_order ASC, level_id ASC`
      ),
      hogqlTile(
        'funnel-churn-walls',
        `Top Churn Walls & Unused-Hint Deaths (v${ADVENTURE_MIN_VERSION}+)`,
        'funnel',
        `Levels ranked by failure + abandon + unused hints rate in ${CURRENT_BALANCE_ERA_ID} (prod, non-practice, non-bug-tagged).`,
        `
SELECT
  toString(properties.level_id) AS level_id,
  any(toString(properties.level_name)) AS level_name,
  count() AS attempts,
  countIf(properties.outcome = 'lost') AS losses,
  countIf(properties.outcome = 'left') AS abandons,
  round(countIf(properties.died_with_hints = true) / nullIf(countIf(properties.outcome = 'lost'), 0) * 100, 1) AS died_with_hints_pct,
  round(avg(toFloat64OrZero(toString(properties.foe_hp_pct_left))) * 100, 1) AS avg_foe_hp_left_pct,
  round(median(toFloat64OrZero(toString(properties.max_drought_ms))) / 1000, 1) AS median_drought_sec
FROM events
WHERE ${ADV_FUNNEL_WHERE}
GROUP BY level_id
HAVING attempts >= 5
ORDER BY abandons DESC, losses DESC`
      ),
      hogqlTile(
        'funnel-attempt-curve',
        `Win Rate by Attempt Number (v${ADVENTURE_MIN_VERSION}+)`,
        'funnel',
        'Distinguishes fair learnable challenges (win% rises by attempt 2-3) from flat RNG walls in the active balance era.',
        `
SELECT
  least(toIntOrZero(toString(properties.attempt)), 5) AS attempt_bucket,
  count() AS fights,
  round(countIf(properties.outcome IN ('won', 'survived')) / nullIf(countIf(properties.outcome IN ('won', 'survived', 'lost')), 0) * 100, 1) AS win_pct,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
WHERE ${ADV_FUNNEL_WHERE}
GROUP BY attempt_bucket
ORDER BY attempt_bucket ASC`
      ),
      hogqlTile(
        'funnel-pacing-and-drought',
        `Find-Time Pacing & Board Drought by World (v${ADVENTURE_MIN_VERSION}+)`,
        'funnel',
        'Measures cognitive load (time between Sets) across Adventure worlds in the current balance era.',
        `
SELECT
  toIntOrZero(toString(properties.world)) AS world,
  count() AS fights,
  round(median(toFloat64OrZero(toString(properties.median_find_ms))) / 1000, 2) AS median_find_sec,
  round(quantileExact(0.9)(toFloat64OrZero(toString(properties.max_drought_ms))) / 1000, 1) AS p90_drought_sec,
  round(avg(toFloat64OrZero(toString(properties.mistakes))), 2) AS avg_mistakes
FROM events
WHERE ${ADV_FUNNEL_WHERE}
  AND properties.world IS NOT NULL
GROUP BY world
ORDER BY world ASC`
      ),
    ],
  },
  {
    id: 'nshapes-meta-balance',
    name: 'NShapes · 3. Weapon, Fighter & Evolution Balance',
    description: `Simpson’s-Paradox-adjusted weapon, fighter, evolution (within-Catalyst cohort), and Arcana balance strictly gated to ${CURRENT_BALANCE_ERA_ID} (v${ADVENTURE_MIN_VERSION}+, prod, clean hygiene).`,
    tags: ['nshapes', 'game-analytics', 'balance', 'meta', CURRENT_BALANCE_ERA_ID],
    tiles: [
      hogqlTile(
        'balance-weapon-simpson',
        `Weapon Balance · Level-Adjusted Win Delta & Fun (v${WEAPONS_MIN_VERSION}+)`,
        'balance',
        `Adventure prod balance (v${WEAPONS_MIN_VERSION}+, >=3 sets, >=10s, non-practice, non-tutorial, <=50% coached) controlling for each level’s baseline win rate.`,
        `
WITH level_baselines AS (
  SELECT
    toString(properties.level_id) AS lvl,
    countIf(properties.outcome IN ('won', 'survived')) / nullIf(count(), 0) AS lvl_win_rate,
    avgIf(${SAFE_LOG_DPM}, toFloat64OrZero(toString(properties.dpm)) > 0) AS lvl_log_dpm
  FROM events
  WHERE ${ADV_WEAPON_BALANCE_WHERE}
  GROUP BY lvl
)
SELECT
  trim(BOTH '"' FROM raw_weapon_id) AS weapon_id,
  count() AS fights_held,
  uniqExact(distinct_id) AS players,
  round(countIf(properties.outcome IN ('won', 'survived')) / nullIf(count(), 0) * 100, 1) AS raw_win_pct,
  round(avg(if(properties.outcome IN ('won', 'survived'), 1.0, 0.0) - lb.lvl_win_rate) * 100, 1) AS adj_win_delta_pct,
  round(avgIf(${SAFE_LOG_DPM} - lb.lvl_log_dpm, toFloat64OrZero(toString(properties.dpm)) > 0), 3) AS adj_log_dpm_delta,
  round(avg(toFloat64OrZero(toString(properties.dpm))), 0) AS avg_dpm,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
LEFT JOIN level_baselines lb ON toString(properties.level_id) = lb.lvl
ARRAY JOIN JSONExtractArrayRaw(coalesce(toString(properties.weapons), '[]')) AS raw_weapon_id
WHERE ${ADV_WEAPON_BALANCE_WHERE}
GROUP BY weapon_id
HAVING fights_held >= 5
ORDER BY adj_win_delta_pct DESC`
      ),
      hogqlTile(
        'balance-offer-pick-rate',
        `Weapon Offer-vs-Pick & Shop Buy Rate (v${WEAPONS_MIN_VERSION}+)`,
        'balance',
        `True player desire in ${CURRENT_BALANCE_ERA_ID}: how often offered weapons are picked on level-up or bought in shops (prod, Adventure).`,
        `
WITH offers AS (
  SELECT trim(BOTH '"' FROM w) AS weapon_id, count() AS offered
  FROM events
  ARRAY JOIN JSONExtractArrayRaw(coalesce(toString(properties.weapons_offered), '[]')) AS w
  WHERE ${ADV_WEAPON_OFFER_WHERE}
  GROUP BY weapon_id
),
chosen AS (
  SELECT trim(BOTH '"' FROM w) AS weapon_id, count() AS chosen_cnt
  FROM events
  ARRAY JOIN arrayConcat(
    JSONExtractArrayRaw(coalesce(toString(properties.weapons_picked), '[]')),
    JSONExtractArrayRaw(coalesce(toString(properties.weapons_bought), '[]'))
  ) AS w
  WHERE ${ADV_WEAPON_OFFER_WHERE}
  GROUP BY weapon_id
)
SELECT
  o.weapon_id AS weapon_id,
  o.offered AS times_offered,
  coalesce(c.chosen_cnt, 0) AS times_chosen,
  round(coalesce(c.chosen_cnt, 0) / nullIf(o.offered, 0) * 100, 1) AS pick_rate_pct
FROM offers o
LEFT JOIN chosen c ON o.weapon_id = c.weapon_id
WHERE o.offered >= 5
ORDER BY pick_rate_pct DESC`
      ),
      hogqlTile(
        'balance-fighter-parity',
        `Fighter Parity · Level-Adjusted Win Delta & Fun (v${FIGHTERS_MIN_VERSION}+)`,
        'balance',
        `Simpson’s-Paradox-adjusted Fighter comparison (prod, Adventure, v${FIGHTERS_MIN_VERSION}+): win delta, DPM, mistakes, unique players, and enjoyment.`,
        `
WITH level_baselines AS (
  SELECT
    toString(properties.level_id) AS lvl,
    countIf(properties.outcome IN ('won', 'survived')) / nullIf(count(), 0) AS lvl_win_rate,
    avgIf(${SAFE_LOG_DPM}, toFloat64OrZero(toString(properties.dpm)) > 0) AS lvl_log_dpm
  FROM events
  WHERE ${ADV_FIGHTER_BALANCE_WHERE}
  GROUP BY lvl
)
SELECT
  toString(properties.fighter) AS fighter,
  count() AS fights,
  uniqExact(distinct_id) AS players,
  round(countIf(properties.outcome IN ('won', 'survived')) / nullIf(count(), 0) * 100, 1) AS raw_win_pct,
  round(avg(if(properties.outcome IN ('won', 'survived'), 1.0, 0.0) - lb.lvl_win_rate) * 100, 1) AS adj_win_delta_pct,
  round(avgIf(${SAFE_LOG_DPM} - lb.lvl_log_dpm, toFloat64OrZero(toString(properties.dpm)) > 0), 3) AS adj_log_dpm_delta,
  round(avg(toFloat64OrZero(toString(properties.dpm))), 0) AS avg_dpm,
  round(avg(toFloat64OrZero(toString(properties.mistakes))), 2) AS avg_mistakes,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
LEFT JOIN level_baselines lb ON toString(properties.level_id) = lb.lvl
WHERE ${ADV_FIGHTER_BALANCE_WHERE}
  AND properties.fighter IS NOT NULL
GROUP BY fighter
ORDER BY adj_win_delta_pct DESC`
      ),
      hogqlTile(
        'balance-evolutions',
        `Evolutions · Within-Catalyst Level-Adjusted Impact (v${EVOLUTIONS_MIN_VERSION}+)`,
        'balance',
        `Survivorship-controlled evolution impact (benchmarked ONLY against fights that forged >=1 evolution) in ${CURRENT_BALANCE_ERA_ID} (v${EVOLUTIONS_MIN_VERSION}+).`,
        `
WITH evo_level_baselines AS (
  SELECT
    toString(properties.level_id) AS lvl,
    countIf(properties.outcome IN ('won', 'survived')) / nullIf(count(), 0) AS lvl_win_rate,
    avgIf(${SAFE_LOG_DPM}, toFloat64OrZero(toString(properties.dpm)) > 0) AS lvl_log_dpm
  FROM events
  WHERE ${ADV_EVO_BALANCE_WHERE}
    AND toIntOrZero(toString(properties.evolutions)) > 0
  GROUP BY lvl
)
SELECT
  trim(BOTH '"' FROM raw_evo_id) AS evolution_id,
  count() AS times_forged,
  uniqExact(distinct_id) AS players,
  round(countIf(properties.outcome IN ('won', 'survived')) / nullIf(count(), 0) * 100, 1) AS raw_win_pct,
  round(avg(if(properties.outcome IN ('won', 'survived'), 1.0, 0.0) - lb.lvl_win_rate) * 100, 1) AS adj_win_delta_pct,
  round(avgIf(${SAFE_LOG_DPM} - lb.lvl_log_dpm, toFloat64OrZero(toString(properties.dpm)) > 0), 3) AS adj_log_dpm_delta,
  round(avg(toFloat64OrZero(toString(properties.dpm))), 0) AS avg_dpm,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
LEFT JOIN evo_level_baselines lb ON toString(properties.level_id) = lb.lvl
ARRAY JOIN JSONExtractArrayRaw(coalesce(toString(properties.evolutions_forged), '[]')) AS raw_evo_id
WHERE ${ADV_EVO_BALANCE_WHERE}
  AND toIntOrZero(toString(properties.evolutions)) > 0
GROUP BY evolution_id
ORDER BY adj_win_delta_pct DESC`
      ),
      hogqlTile(
        'balance-arcana',
        `Arcana · Level-Adjusted Trade-Off Win Delta & Fun (v${ARCANA_MIN_VERSION}+)`,
        'balance',
        `Simpson’s-Paradox-adjusted Arcana evaluation in ${CURRENT_BALANCE_ERA_ID} (v${ARCANA_MIN_VERSION}+, prod Adventure).`,
        `
WITH level_baselines AS (
  SELECT
    toString(properties.level_id) AS lvl,
    countIf(properties.outcome IN ('won', 'survived')) / nullIf(count(), 0) AS lvl_win_rate
  FROM events
  WHERE ${ADV_ARCANA_BALANCE_WHERE}
  GROUP BY lvl
)
SELECT
  trim(BOTH '"' FROM raw_arcana_id) AS arcana_id,
  count() AS fights_active,
  uniqExact(distinct_id) AS players,
  round(countIf(properties.outcome IN ('won', 'survived')) / nullIf(count(), 0) * 100, 1) AS raw_win_pct,
  round(avg(if(properties.outcome IN ('won', 'survived'), 1.0, 0.0) - lb.lvl_win_rate) * 100, 1) AS adj_win_delta_pct,
  round(avg(toFloat64OrZero(toString(properties.dpm))), 0) AS avg_dpm,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
LEFT JOIN level_baselines lb ON toString(properties.level_id) = lb.lvl
ARRAY JOIN JSONExtractArrayRaw(coalesce(toString(properties.arcana), '[]')) AS raw_arcana_id
WHERE ${ADV_ARCANA_BALANCE_WHERE}
GROUP BY arcana_id
ORDER BY adj_win_delta_pct DESC`
      ),
    ],
  },
  {
    id: 'nshapes-player-enjoyment',
    name: 'NShapes · 4. Player Enjoyment & Sentiment (👍 / 👎)',
    description:
      'What actually makes NShapes fun vs frustrating (prod): outcome vs enjoyment gap, close-call thrill, board droughts, and 1-tap feedback reason tags.',
    tags: ['nshapes', 'game-analytics', 'enjoyment', 'sentiment'],
    tiles: [
      hogqlTile(
        'fun-sentiment-drivers',
        'Fun Drivers: Close Calls vs Droughts vs Outcomes',
        'enjoyment',
        'Healthy games keep close calls thrilling (>80% fun) while board droughts (>18s) hurt sentiment (prod, non-practice).',
        `
SELECT
  multiIf(
    properties.outcome = 'left', 'Abandoned (Left)',
    properties.outcome = 'lost', 'Defeat',
    lower(coalesce(toString(properties.close_call), 'false')) IN ('true', '1'), 'Close Call Victory (<=1 heart)',
    toFloat64OrZero(toString(properties.max_drought_ms)) > 18000, 'Slow Victory (>18s drought)',
    'Clean Victory'
  ) AS experience_bucket,
  countIf(properties.fun_rating IN ('up', 'down')) AS rated_fights,
  countIf(properties.fun_rating = 'up') AS thumbs_up,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
WHERE event = 'fight_ended'
  AND ${PROD_ONLY}
  AND ${NOT_PRACTICE}
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY experience_bucket
ORDER BY fun_pct DESC`
      ),
      hogqlTile(
        'fun-reason-tags',
        'Player Feedback Reason Tags Leaderboard',
        'enjoyment',
        'Breakdown of prod 1-tap feedback chips selected alongside 👍 and 👎 votes (including too_easy & bug_in_game).',
        `
SELECT
  trim(BOTH '"' FROM tag) AS fun_tag,
  any(toString(properties.fun_rating)) AS polarity,
  count() AS count,
  round(avg(toFloat64OrZero(toString(properties.dpm))), 0) AS avg_dpm,
  round(avg(toFloat64OrZero(toString(properties.max_drought_ms))) / 1000, 1) AS avg_drought_sec
FROM events
ARRAY JOIN JSONExtractArrayRaw(coalesce(toString(properties.fun_tags), '[]')) AS tag
WHERE event IN ('fight_ended', 'fight_rated')
  AND ${PROD_ONLY}
GROUP BY fun_tag
ORDER BY count DESC`
      ),
      hogqlTile(
        'fun-by-foe',
        `Enemy Design Scorecard (v${ADVENTURE_MIN_VERSION}+)`,
        'enjoyment',
        `Highlights enemies in ${CURRENT_BALANCE_ERA_ID} that players find unfairly annoying even if win rates look acceptable.`,
        `
SELECT
  toString(properties.foe) AS foe,
  count() AS fights,
  round(countIf(properties.outcome IN ('won', 'survived')) / nullIf(countIf(properties.outcome IN ('won', 'survived', 'lost')), 0) * 100, 1) AS win_pct,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct,
  round(avg(toFloat64OrZero(toString(properties.mistakes))), 2) AS avg_mistakes
FROM events
WHERE ${ADV_FUNNEL_WHERE}
  AND properties.foe IS NOT NULL
GROUP BY foe
HAVING fights >= 5
ORDER BY fun_pct ASC`
      ),
      hogqlTile(
        'fun-replay-behavior',
        'Replay Curiosity & Post-Loss Learning',
        'enjoyment',
        'Tracks how often prod players inspect FightReplay after losses vs wins.',
        `
SELECT
  toString(properties.outcome) AS outcome,
  count() AS fights,
  countIf(properties.replay_opened = true) AS replay_opened,
  round(countIf(properties.replay_opened = true) / count() * 100, 1) AS replay_open_pct,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
WHERE event = 'fight_ended'
  AND ${PROD_ONLY}
GROUP BY outcome
ORDER BY fights DESC`
      ),
    ],
  },
];

export const buildPostHogExportBundle = () => ({
  projectId: POSTHOG_PROJECT_ID,
  generatedAt: new Date().toISOString(),
  balanceEra: {
    currentEraId: CURRENT_BALANCE_ERA_ID,
    currentEraMinVersion: CURRENT_BALANCE_ERA.minVersion,
    adventureMinVersion: ADVENTURE_MIN_VERSION,
    spireMinVersion: SPIRE_MIN_VERSION,
    weaponsMinVersion: WEAPONS_MIN_VERSION,
    evolutionsMinVersion: EVOLUTIONS_MIN_VERSION,
    fightersMinVersion: FIGHTERS_MIN_VERSION,
    arcanaMinVersion: ARCANA_MIN_VERSION,
  },
  eventSchema: {
    coreEvents: ['app_opened', 'fight_ended'],
    rareRetrospectiveEvent: 'fight_rated',
    oneEventPerGameRule: true,
  },
  dashboards: POSTHOG_DASHBOARDS,
});
