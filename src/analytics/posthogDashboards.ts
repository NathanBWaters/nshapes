/**
 * Authoritative PostHog Dashboard & HogQL Insight specifications for NShapes.
 *
 * Targets PostHog project `738615` (`https://us.posthog.com/project/738615`)
 * built strictly on the two minimal events: `app_opened` and `fight_ended`
 * (+ optional retrospective `fight_rated`).
 *
 * Exported to `docs/posthog-dashboards.json` via `npm run analytics:export` and
 * synced directly into PostHog via `npm run analytics:posthog:sync`.
 */
import { POSTHOG_PROJECT_ID } from './config';

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
      'Daily active players, single-event fight volume, win/fun/abandon rates, session depth, D1/D7 retention cohorts, and player journey stages.',
    tags: ['nshapes', 'game-analytics', 'executive'],
    tiles: [
      hogqlTile(
        'exec-daily-pulse',
        'Daily Active Players, Fights & Fun Rate (30d)',
        'overview',
        'Top-line DAU, fight_ended count, decided win rate, abandon rate, and thumbs-up enjoyment rate.',
        `
SELECT
  toDate(timestamp) AS day,
  uniqExact(distinct_id) AS dau,
  count() AS fights,
  round(countIf(properties.outcome IN ('won', 'survived')) / nullIf(countIf(properties.outcome IN ('won', 'survived', 'lost')), 0) * 100, 1) AS win_pct,
  round(countIf(properties.outcome = 'left') / count() * 100, 1) AS abandon_pct,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
WHERE event = 'fight_ended' AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY day
ORDER BY day DESC`
      ),
      hogqlTile(
        'exec-cohort-retention',
        'Install Cohort D1 / D3 / D7 / D14 Retention',
        'overview',
        'Classic day-offset retention grouped by each player’s first_seen_date person property.',
        `
SELECT
  toDate(person.properties.first_seen_date) AS cohort_date,
  uniqExact(distinct_id) AS cohort_size,
  round(uniqExactIf(distinct_id, toInt32OrZero(toString(properties.days_since_install)) = 1) / nullIf(uniqExact(distinct_id), 0) * 100, 1) AS d1_pct,
  round(uniqExactIf(distinct_id, toInt32OrZero(toString(properties.days_since_install)) = 3) / nullIf(uniqExact(distinct_id), 0) * 100, 1) AS d3_pct,
  round(uniqExactIf(distinct_id, toInt32OrZero(toString(properties.days_since_install)) = 7) / nullIf(uniqExact(distinct_id), 0) * 100, 1) AS d7_pct,
  round(uniqExactIf(distinct_id, toInt32OrZero(toString(properties.days_since_install)) = 14) / nullIf(uniqExact(distinct_id), 0) * 100, 1) AS d14_pct
FROM events
WHERE event IN ('app_opened', 'fight_ended')
  AND person.properties.first_seen_date IS NOT NULL
  AND timestamp >= now() - INTERVAL 45 DAY
GROUP BY cohort_date
ORDER BY cohort_date DESC`
      ),
      hogqlTile(
        'exec-journey-stages',
        'Player Lifecycle Journey Breakdown',
        'overview',
        'Current distribution of players across NShapes progression stages (onboarding -> veteran / free_play_explorer).',
        `
SELECT
  coalesce(toString(person.properties.journey_stage), 'unknown') AS journey_stage,
  uniqExact(distinct_id) AS players,
  count() AS fights,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
WHERE event = 'fight_ended' AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY journey_stage
ORDER BY players DESC`
      ),
      hogqlTile(
        'exec-mode-mix',
        'Mode Split (Adventure vs Free Play vs Classic)',
        'overview',
        'Volume, session duration, and fun sentiment by game mode.',
        `
SELECT
  coalesce(toString(properties.mode), 'adventure') AS mode,
  uniqExact(distinct_id) AS players,
  count() AS fights,
  round(avg(toFloat64OrZero(toString(properties.duration_ms))) / 1000, 1) AS avg_sec,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
WHERE event = 'fight_ended' AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY mode
ORDER BY fights DESC`
      ),
      hogqlTile(
        'exec-session-depth',
        'Fights Per Session & Rage-Quit Rate',
        'overview',
        'Tracks session engagement depth and first-session vs returning-session stamina.',
        `
SELECT
  coalesce(toString(properties.platform), 'unknown') AS platform,
  uniqExact(toString(properties.$session_id)) AS sessions,
  round(count() / nullIf(uniqExact(toString(properties.$session_id)), 0), 2) AS avg_fights_per_session,
  round(countIf(properties.outcome = 'left') / count() * 100, 1) AS abandon_pct,
  round(median(toFloat64OrZero(toString(properties.median_find_ms))) / 1000, 2) AS median_find_sec
FROM events
WHERE event = 'fight_ended' AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY platform
ORDER BY sessions DESC`
      ),
    ],
  },
  {
    id: 'nshapes-campaign-funnel',
    name: 'NShapes · 2. Campaign Funnel & Churn Walls',
    description:
      'Level-by-level progression funnel, attempts per clear, difficulty spikes, unused-hint deaths, and composite churn-wall severity.',
    tags: ['nshapes', 'game-analytics', 'funnel', 'levels'],
    tiles: [
      hogqlTile(
        'funnel-level-progression',
        'Adventure Campaign Progression Funnel',
        'funnel',
        'Players reached vs cleared, win rate, attempts per clear, and enjoyment per campaign level.',
        `
SELECT
  toInt32OrZero(toString(properties.level_order)) AS level_order,
  toString(properties.level_id) AS level_id,
  any(toString(properties.level_name)) AS level_name,
  uniqExact(distinct_id) AS players_reached,
  uniqExactIf(distinct_id, properties.outcome IN ('won', 'survived')) AS players_cleared,
  count() AS attempts,
  round(countIf(properties.outcome IN ('won', 'survived')) / nullIf(countIf(properties.outcome IN ('won', 'survived', 'lost')), 0) * 100, 1) AS win_pct,
  round(countIf(properties.outcome = 'left') / count() * 100, 1) AS abandon_pct,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
WHERE event = 'fight_ended'
  AND coalesce(toString(properties.mode), 'adventure') = 'adventure'
  AND toBool(properties.practice) = false
GROUP BY level_order, level_id
ORDER BY level_order ASC, level_id ASC`
      ),
      hogqlTile(
        'funnel-churn-walls',
        'Top Churn Walls & Unused-Hint Deaths',
        'funnel',
        'Levels ranked by failure + abandon + unused hints rate to spot frustrating or unclear encounters.',
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
WHERE event = 'fight_ended'
  AND coalesce(toString(properties.mode), 'adventure') = 'adventure'
GROUP BY level_id
HAVING attempts >= 5
ORDER BY abandons DESC, losses DESC`
      ),
      hogqlTile(
        'funnel-attempt-curve',
        'Win Rate by Attempt Number (Learning Curve)',
        'funnel',
        'Distinguishes fair learnable challenges (win% rises by attempt 2-3) from flat RNG walls.',
        `
SELECT
  least(toInt32OrZero(toString(properties.attempt)), 5) AS attempt_bucket,
  count() AS fights,
  round(countIf(properties.outcome IN ('won', 'survived')) / nullIf(countIf(properties.outcome IN ('won', 'survived', 'lost')), 0) * 100, 1) AS win_pct,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
WHERE event = 'fight_ended'
  AND coalesce(toString(properties.mode), 'adventure') = 'adventure'
GROUP BY attempt_bucket
ORDER BY attempt_bucket ASC`
      ),
      hogqlTile(
        'funnel-pacing-and-drought',
        'Find-Time Pacing & Board Drought by World',
        'funnel',
        'Measures cognitive load (time between Sets) across Adventure worlds.',
        `
SELECT
  toInt32OrZero(toString(properties.world)) AS world,
  count() AS fights,
  round(median(toFloat64OrZero(toString(properties.median_find_ms))) / 1000, 2) AS median_find_sec,
  round(quantileExact(0.9)(toFloat64OrZero(toString(properties.max_drought_ms))) / 1000, 1) AS p90_drought_sec,
  round(avg(toFloat64OrZero(toString(properties.mistakes))), 2) AS avg_mistakes
FROM events
WHERE event = 'fight_ended' AND properties.world IS NOT NULL
GROUP BY world
ORDER BY world ASC`
      ),
    ],
  },
  {
    id: 'nshapes-meta-balance',
    name: 'NShapes · 3. Weapon, Fighter & Evolution Balance',
    description:
      'Simpson’s-Paradox-adjusted win delta, offer-vs-pick rates, DPM, triggered damage share, Fighter parity, Evolution frequency, and Arcana meta.',
    tags: ['nshapes', 'game-analytics', 'balance', 'meta'],
    tiles: [
      hogqlTile(
        'balance-weapon-simpson',
        'Weapon Balance · Level-Adjusted Win Delta & Fun',
        'balance',
        'Controls for each level’s baseline win rate so late-game weapons aren’t penalized by harder worlds.',
        `
WITH level_baselines AS (
  SELECT
    toString(properties.level_id) AS lvl,
    countIf(properties.outcome IN ('won', 'survived')) / nullIf(countIf(properties.outcome IN ('won', 'survived', 'lost')), 0) AS lvl_win_rate
  FROM events
  WHERE event = 'fight_ended'
  GROUP BY lvl
)
SELECT
  trim(BOTH '"' FROM weapon_id) AS weapon_id,
  count() AS fights_held,
  round(countIf(properties.outcome IN ('won', 'survived')) / nullIf(countIf(properties.outcome IN ('won', 'survived', 'lost')), 0) * 100, 1) AS raw_win_pct,
  round(avg(if(properties.outcome IN ('won', 'survived'), 1.0, 0.0) - lb.lvl_win_rate) * 100, 1) AS adj_win_delta_pct,
  round(avg(toFloat64OrZero(toString(properties.dpm))), 0) AS avg_dpm,
  round(avg(toFloat64OrZero(toString(properties.triggered_damage_share))) * 100, 1) AS triggered_dmg_pct,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
ARRAY JOIN JSONExtractArrayRaw(coalesce(toString(properties.weapons), '[]')) AS weapon_id
LEFT JOIN level_baselines lb ON toString(properties.level_id) = lb.lvl
WHERE event = 'fight_ended' AND properties.outcome IN ('won', 'survived', 'lost')
GROUP BY weapon_id
HAVING fights_held >= 5
ORDER BY adj_win_delta_pct DESC`
      ),
      hogqlTile(
        'balance-offer-pick-rate',
        'Weapon Offer-vs-Pick & Shop Buy Rate',
        'balance',
        'Measures true player desire: how often offered weapons are picked on level-up or bought in shops.',
        `
WITH offers AS (
  SELECT trim(BOTH '"' FROM w) AS weapon_id, count() AS offered
  FROM events
  ARRAY JOIN JSONExtractArrayRaw(coalesce(toString(properties.weapons_offered), '[]')) AS w
  WHERE event = 'fight_ended'
  GROUP BY weapon_id
),
chosen AS (
  SELECT trim(BOTH '"' FROM w) AS weapon_id, count() AS chosen_cnt
  FROM events
  ARRAY JOIN arrayConcat(
    JSONExtractArrayRaw(coalesce(toString(properties.weapons_picked), '[]')),
    JSONExtractArrayRaw(coalesce(toString(properties.weapons_bought), '[]'))
  ) AS w
  WHERE event = 'fight_ended'
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
        'Fighter Parity (Pick Share, Win Delta & Fun)',
        'balance',
        'Compares win rate, DPM, mistakes, and enjoyment across playable fighters.',
        `
SELECT
  toString(properties.fighter) AS fighter,
  count() AS fights,
  round(countIf(properties.outcome IN ('won', 'survived')) / nullIf(countIf(properties.outcome IN ('won', 'survived', 'lost')), 0) * 100, 1) AS win_pct,
  round(avg(toFloat64OrZero(toString(properties.dpm))), 0) AS avg_dpm,
  round(avg(toFloat64OrZero(toString(properties.mistakes))), 2) AS avg_mistakes,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
WHERE event = 'fight_ended' AND properties.fighter IS NOT NULL
GROUP BY fighter
ORDER BY fights DESC`
      ),
      hogqlTile(
        'balance-evolutions',
        'Weapon Evolutions Forged & Impact',
        'balance',
        'How often each evolution recipe fires, its DPM, and how much fun players rate fights with it.',
        `
SELECT
  trim(BOTH '"' FROM evo_id) AS evolution_id,
  count() AS times_forged,
  round(countIf(properties.outcome IN ('won', 'survived')) / nullIf(countIf(properties.outcome IN ('won', 'survived', 'lost')), 0) * 100, 1) AS win_pct,
  round(avg(toFloat64OrZero(toString(properties.dpm))), 0) AS avg_dpm,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
ARRAY JOIN JSONExtractArrayRaw(coalesce(toString(properties.evolutions_forged), '[]')) AS evo_id
WHERE event = 'fight_ended'
GROUP BY evolution_id
ORDER BY times_forged DESC`
      ),
      hogqlTile(
        'balance-arcana',
        'Arcana Adoption, Trade-Off Win Rate & Fun',
        'balance',
        'Evaluates whether tarot modifiers feel rewarding or too punishing.',
        `
SELECT
  trim(BOTH '"' FROM arcana_id) AS arcana_id,
  count() AS fights_active,
  round(countIf(properties.outcome IN ('won', 'survived')) / nullIf(countIf(properties.outcome IN ('won', 'survived', 'lost')), 0) * 100, 1) AS win_pct,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
ARRAY JOIN JSONExtractArrayRaw(coalesce(toString(properties.arcana), '[]')) AS arcana_id
WHERE event = 'fight_ended'
GROUP BY arcana_id
ORDER BY fights_active DESC`
      ),
    ],
  },
  {
    id: 'nshapes-player-enjoyment',
    name: 'NShapes · 4. Player Enjoyment & Sentiment (👍 / 👎)',
    description:
      'What actually makes NShapes fun vs frustrating: outcome vs enjoyment gap, close-call thrill, board droughts, and 1-tap feedback reason tags.',
    tags: ['nshapes', 'game-analytics', 'enjoyment', 'sentiment'],
    tiles: [
      hogqlTile(
        'fun-sentiment-drivers',
        'Fun Drivers: Close Calls vs Droughts vs Outcomes',
        'enjoyment',
        'Healthy games keep close calls thrilling (>80% fun) while board droughts (>18s) hurt sentiment.',
        `
SELECT
  multiIf(
    properties.outcome = 'left', 'Abandoned (Left)',
    properties.outcome = 'lost', 'Defeat',
    toBool(properties.close_call), 'Close Call Victory (<=1 heart)',
    toFloat64OrZero(toString(properties.max_drought_ms)) > 18000, 'Slow Victory (>18s drought)',
    'Clean Victory'
  ) AS experience_bucket,
  countIf(properties.fun_rating IN ('up', 'down')) AS rated_fights,
  countIf(properties.fun_rating = 'up') AS thumbs_up,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
WHERE event = 'fight_ended' AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY experience_bucket
ORDER BY fun_pct DESC`
      ),
      hogqlTile(
        'fun-reason-tags',
        'Player Feedback Reason Tags Leaderboard',
        'enjoyment',
        'Breakdown of 1-tap feedback chips selected alongside 👍 and 👎 votes.',
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
GROUP BY fun_tag
ORDER BY count DESC`
      ),
      hogqlTile(
        'fun-by-foe',
        'Enemy Design Scorecard (Fun Rate vs Win Rate)',
        'enjoyment',
        'Highlights enemies that players find unfairly annoying even if win rates look acceptable.',
        `
SELECT
  toString(properties.foe) AS foe,
  count() AS fights,
  round(countIf(properties.outcome IN ('won', 'survived')) / nullIf(countIf(properties.outcome IN ('won', 'survived', 'lost')), 0) * 100, 1) AS win_pct,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct,
  round(avg(toFloat64OrZero(toString(properties.mistakes))), 2) AS avg_mistakes
FROM events
WHERE event = 'fight_ended' AND properties.foe IS NOT NULL
GROUP BY foe
HAVING fights >= 5
ORDER BY fun_pct ASC`
      ),
      hogqlTile(
        'fun-replay-behavior',
        'Replay Curiosity & Post-Loss Learning',
        'enjoyment',
        'Tracks how often players inspect FightReplay after losses vs wins.',
        `
SELECT
  toString(properties.outcome) AS outcome,
  count() AS fights,
  countIf(properties.replay_opened = true) AS replay_opened,
  round(countIf(properties.replay_opened = true) / count() * 100, 1) AS replay_open_pct,
  round(countIf(properties.fun_rating = 'up') / nullIf(countIf(properties.fun_rating IN ('up', 'down')), 0) * 100, 1) AS fun_pct
FROM events
WHERE event = 'fight_ended'
GROUP BY outcome
ORDER BY fights DESC`
      ),
    ],
  },
];

export const buildPostHogExportBundle = () => ({
  projectId: POSTHOG_PROJECT_ID,
  generatedAt: new Date().toISOString(),
  eventSchema: {
    coreEvents: ['app_opened', 'fight_ended'],
    rareRetrospectiveEvent: 'fight_rated',
    oneEventPerGameRule: true,
  },
  dashboards: POSTHOG_DASHBOARDS,
});
