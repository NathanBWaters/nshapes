# Analytics

Every Adventure fight is recorded and sent to PostHog as **one event**, with
enough in it to replay the fight move by move. The goal is to answer
questions about real players ("where do people quit?", "is Greedy Chest
overtuned for real hands?", "did v0.1.120 make 2-6 easier?") from real data.

## What is sent

| Event | When | Notes |
|---|---|---|
| `app_opened` | App start | Install count, versions, platforms |
| `fight_ended` | A fight ends: won, survived, lost, practice Done, or left partway (retreat/restart after at least one move) | One per fight, about 10–30 KB |

Every event carries `app_version` (package.json), `platform` (ios/android/web)
and `env` (`dev` from a dev build, `prod` otherwise; filter `env = 'prod'` for
player data). `distinct_id` is an anonymous install id (a random UUID in MMKV):
no account, name or email.

### `fight_ended` properties

Summary, for queries: `level_id`, `level_name`, `world`, `side_path`, `boss`,
`practice`, `foe`, `fighter`, `outcome` (won / survived / lost / practice /
left), `end_reason`, `stars`, `attempt` (nth start of this level),
`best_stars_before`, `total_stars_before`, `damage`, `dpm`, `biggest_hit`,
`sets`, `mistakes`, `duration_ms` (fight clock), `hearts_left`, `max_hearts`,
`coins`, `evolutions`, `power`, `waves_reached`, `xp_level`, `weapons`,
`charms`, `arcana`, `skill_nodes`, `seed`.

Replay: `recording` (`{ format, seed, actions }`) and `save` (the whole save the
fight started from). `replayFight(level, save, recording)`
(`src/adventure/engine/replay.ts`) rebuilds the fight exactly: every Set,
trigger and number, plus the full fight log.

## How a fight replays

A run is a pure function of `(level, save, seed, actions)`:

- Card draws use the seeded RNG in state. Foe effects (`src/utils/enemies`)
  roll on `Math.random`, which the engine swaps for a seeded stream kept in
  state (`foeRng`, `withFoeDice` in `engine/run.ts`) for each reducer call.
- The screen's own randomness (weapon effect rolls in `GameBoard`) is already
  inside the MATCH action it sends, so it is recorded.
- `AdventureRun` reduces synchronously in its `dispatch` and records each
  action with the exact state it was applied to (`FightRecorder`).
- Card ids come from process-wide counters, so recordings name cards by board
  slot / deck position (`{ $c: 'b3' }`, `'@d12'`); identical TICKs are
  run-length encoded; `CLEAR_EVENTS` is dropped.

`__tests__/adventureReplay.test.ts` plays every level with a bot, records it,
and checks the replay ends identically. If you add randomness to the engine,
route it through `d._rng` (or it lands on the foe dice), or this test fails.

## Client

`src/analytics/posthog.ts` is a small client over PostHog's public `/batch/`
endpoint. It needs no SDK and no native code, so it works the same on iOS,
Android and web and ships over the air.

- Events queue in MMKV (capped at 1.5 MB) and flush on capture, at app start,
  and when the app returns to the foreground. When offline, they stay queued.
- Events over 900 KB drop `recording`/`save` and are marked `truncated`
  (PostHog's limit is 1 MB).
- `setAnalyticsEnabled(false)` opts out and clears the queue. There is no
  toggle in the UI yet.
- Disabled under Jest.

The project key (`phc_…`) is PostHog's public write-only ingestion key and is
meant to ship in clients.

## Analyzing

PostHog project: https://us.posthog.com/project/738615 (US cloud). Query with
SQL (HogQL), in the PostHog SQL editor or its query API:

```sql
-- Win rate and median fight length per level, players only
select properties.level_id as level,
       count() as fights,
       countIf(properties.outcome = 'won') / count() as win_rate,
       quantile(0.5)(toFloat(properties.duration_ms)) / 1000 as median_s
from events
where event = 'fight_ended' and properties.env = 'prod'
group by level order by level
```

To replay real fights, export `fight_ended` properties to JSON and run:

```bash
FIGHTS=fights.json npm run fights:replay
```

This checks each fight replays to the numbers the player saw, and writes the
full fight logs to `fights.replayed.json`. For events from an older
`app_version`, check out that version's commit first.
