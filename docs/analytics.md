# NShapes Game Analytics (PostHog)

> **Design goal:** Maximum product, balance, and player-enjoyment signal with **strictly minimal event volume**.

NShapes targets PostHog project `738615` (`https://us.i.posthog.com`) through a lightweight, offline-resilient MMKV client (`src/analytics/posthog.ts`) and pure analytical engine (`src/analytics/dashboardEngine.ts`).

---

## 1. Event Contract: Strictly One Wide Event Per Game

Normal gameplay emits only **two** event names:

| Event | When Sent | Purpose |
|---|---|---|
| `app_opened` | App / dev launch or new rolling 30-min session | Session anchor, retention cohorts (D0/D1/D3/D7/D14/D30), `journey_stage` |
| `fight_ended` | **Exactly once per finished round/fight** across Adventure, Free Play, and Classic | Wide event containing outcome, combat pacing, gear, shop choices, enjoyment rating (`👍`/`👎`), tags, replay status, and deterministic `recording` + `save` |
| `fight_rated` *(rare fallback)* | Only when rating/editing an older already-flushed fight in Camp → Battle History | Joins onto the original fight via shared `fight_id` |

### Why Staged Single-Event Delivery?

When a fight finishes in Adventure Mode, the player lands on `LevelResults` where they can tap `👍`/`👎`, select a feedback tag, or open the combat replay (`results-replay`) before clicking Next/Retry/Map/Camp. Instead of emitting `fight_ended` + `fun_rated` + `replay_opened`:

1. `AdventureMode` calls **`stageAdventureFight(...)`** when the fight finishes. The event stays in a local staging slot (`analytics_staged_event`) without duplicating in the send queue.
2. Any tap on `👍`/`👎` (`RoundFunPrompt`), feedback tag chips (`POSITIVE_FUN_TAGS` / `NEGATIVE_FUN_TAGS`), or `results-replay` calls **`rateFight(...)` / `markReplayOpened(...)`**, which **mutates the staged `fight_ended` payload in place** via `updateFightFeedbackInAnalytics(...)`.
3. Leaving results (`commitAdventureFight(...)`), starting a new fight, backgrounding/suspending the app, or calling `flush()` commits that single finalized `fight_ended` event into the persistent queue once.

Free Play and Classic rounds commit one `fight_ended` event with `mode: 'free_play' | 'classic'` when the player exits Free Play or advances/finishes a Classic round (including their inline `👍`/`👎` rating).

---

## 2. User Identity & Cross-Session Journey Tracking

### Zero-PII Anonymous Identity + Shareable Player Code
* **`installId`**: Generated lazily on first analytics access (`crypto.randomUUID()`, persisted in MMKV `analytics_install_id`), never touching `Math.random()` in Jest tests.
* **`distinctId`**: Defaults to `installId` so all sessions on a device stitch automatically into a single user journey without collecting PII (no names, emails, or device IDs).
* **`playerCode`**: Deterministic human-readable support/research code (`NSH-XXXXXXXX` derived from FNV-1a hash of `installId`), shown in Classic **Options → Player ID** with one-tap copy so testers/players can report bugs or link feedback without exposing raw UUIDs.

### Sessions, Person Properties & `journey_stage`
* **Rolling 30-minute sessions (`$session_id` + `session_fight_index`)**: Stored in MMKV and extended on every user action (`SESSION_TIMEOUT_MS = 30 * 60 * 1000`). Automatically rolls a new `$session_id` after 30 minutes of inactivity.
* **PostHog Person Profiles (`$set` & `$set_once`)**:
  * `$set_once`: `first_seen_at`, `first_seen_date`, `first_app_version`, `install_platform`, `initial_mode`.
  * `$set`: `player_code`, `journey_stage`, `app_version`, `last_seen_at`, `total_fights`, `total_wins`, `total_losses`, `total_abandons`, `win_rate`, `fun_rate`, `fun_ratings_count`, `adventure_fights`, `free_play_fights`, `classic_fights`, `highest_world_unlocked`, `highest_level_order`, `highest_level_id`, `levels_cleared_count`, `stars_total`, `unlocks_count`, `favorite_fighter`, `favorite_weapon`, `session_count`, `total_play_min`.
* **Derived `journey_stage`**:
  * `new_player` (`0` fights) → `onboarding` (`1+` fights, no Adventure clear yet) → `early_adventure` (`1+` Adventure clear) → `mid_adventure` (level `>= 7` or world `2+`) → `late_adventure` (level `>= 15` or world `3+`) → `veteran` (`12+` levels cleared or world `4+`), plus `free_play_explorer` (`2+` Free Play fights with `0` Adventure fights).
* **Cross-device linking (`identifyPlayer(externalId, traits?)`)**: Ready-to-use `$identify` hook for future accounts/cloud saves that merges the pre-login anonymous `installId` into `externalId` via PostHog `$anon_distinct_id`.
* **Privacy / Opt-out**: Exposed both in **Adventure Camp → Settings → Gameplay Analytics** (`camp-toggle-analytics`) and **Classic Options → Gameplay Analytics** (`options-analytics-toggle`). Opting out stops captures immediately and clears pending staged/queued events.

---

## 3. Enjoyment Telemetry (`👍` / `👎` + 1-Tap Reason Tags)

* UI component: `src/components/RoundFunPrompt.tsx` (accessible 48px touch targets).
* Appears on:
  * Adventure **Level Results** (`results-fun-up`, `results-fun-down`)
  * Adventure **Camp → Battle History** expanded fight details (`history-fun-up`, `history-fun-down`) + summary badge (`history-fun-badge`)
  * **Free Play Header** (`freeplay-fun-up`, `freeplay-fun-down`)
  * **Classic RoundSummary / VictoryScreen / GameOverScreen**
* Contextual 1-tap feedback tags:
  * **After `👍`:** `great_build` ("Great build"), `close_call` ("Close call"), `satisfying_combos` ("Juicy combos"), `fair_challenge` ("Fair challenge")
  * **After `👎`:** `too_hard` ("Too punishing"), `too_easy` ("Too easy"), `unfair_rng` ("Bad board RNG"), `too_slow` ("Too slow"), `confusing` ("Confusing"), `bug_in_game` ("Bug in game")

---

## 4. Wide `fight_ended` Schema Highlights

Alongside existing summary fields (`level_id`, `fighter`, `foe`, `outcome`, `stars`, `damage`, `dpm`, `sets`, `mistakes`, `weapons`, `evolutions`, `arcana`, `recording`, `save`, `env`, `app_version`), `fight_ended` includes:

* **Identity & Flow:** `fight_id`, `mode` (`'adventure' | 'free_play' | 'classic'`), `level_order`, `$session_id`, `session_fight_index`, `player_code`, `journey_stage`
* **Build Agency & Offer-vs-Pick:** `weapons_offered`, `weapons_picked`, `weapons_bought`, `shop_rerolls` (captured in `FightRecorder.choicesJSON()`)
* **Pacing & Friction:** `biggest_hit_share`, `triggered_damage`, `triggered_damage_share`, `median_find_ms`, `max_drought_ms`, `foe_hp_left`, `foe_hp_pct_left`, `close_call`, `hints_used`, `graces_used`, `died_with_hints`, `helped_sets` (Sets made on a pointed-out card: a guided step, the companion's stuck help, a hint or an auto-hint)
* **Enjoyment & Engagement:** `fun_rating` (`'up' | 'down' | null`), `fun_score` (`1 | 0 | null`), `fun_tags` (`string[]`), `replay_opened` (`boolean`)

### Replaying Exported Fights

```bash
FIGHTS=fights.json npm run fights:replay
```

See `src/adventure/engine/replay.ts` for exact deterministic replay rules (keep combat randomness on `d._rng` / `withFoeDice`).

---

## 5. Balance Eras, Analysis Rules & PostHog Dashboards

> **Canonical PostHog Analysis & Version-Invalidation Spec:** See [docs/posthog-analysis-rules.md](./posthog-analysis-rules.md).

### Version-Era Tracking (`src/analytics/balanceEras.json` + `src/analytics/posthogRules.ts`)
Because balance updates invalidate older telemetry, every event stamps `app_version` and `balance_era` (`CURRENT_BALANCE_ERA_ID`), and `src/analytics/balanceEras.json` tracks all historical Balance Eras (`E0`–`E8`, current floor **`v0.1.164+`**) with hybrid engine-file + per-item canonical mechanical fingerprints.

* `npm run balance:era:status` — inspect current era, active version floors, and working-tree drift.
* `npm run balance:era:record -- --summary "<change>" [--bump | --version X.Y.Z]` — record a new Balance Era (auto-detects global, mode, category, or exact changed item IDs).
* `npm run validate:balance-eras` — fast guardrail (in `verify:guardrails`, `.githooks/pre-push`, and CI) ensuring mechanical balance changes never ship without updating the era manifest.
* `npm run balance:power` — reusable power-ranking CLI combining simulation balance data with version-filtered, Simpson-adjusted, Ridge-debiased PostHog telemetry (`--live`, `--posthog <file>`, or `--simulated-posthog`).

### Pure Analytical Engine (`src/analytics/dashboardEngine.ts`)
Computes:
1. **Cohort Retention:** D0, D1, D3, D7, D14, D30 retention and Wilson 95% confidence intervals (`wilsonCI`) on player enjoyment.
2. **Campaign Funnel & Churn Walls:** Player reach %, clear %, attempts per clear, abandon rate, `died_with_hints` %, and composite `churnWallScore`.
3. **Mode-Isolated Simpson's-Paradox-Adjusted Balance:** Avoids late-game selection bias and cross-mode leakage by comparing each weapon, fighter, evolution, and Arcana's win rate against the **expected win rate at the exact mode & level/act stratum where it was played** (`adjustedWinDelta`), paired with offer-vs-pick rate, player fun rate, legacy weapon ID normalization, and Balance Era + `Prod Clean` hygiene audit counters.
4. **Enjoyment Drivers:** Win-vs-loss fun gap, close-call vs stomp fun rate, fast-board (`<6s` median) vs drought (`>=12s`) fun rate, and feedback tag distributions.

### Interactive Dev Studio (`/dev/analytics`)
Open `/dev/analytics` (or `/dev/analytics?source=simulated`) in Expo Web / dev builds to inspect live local telemetry, a deterministic 60-player cohort (`generateSimulatedCohort`), or pasted PostHog JSON / NDJSON / HogQL `{ columns, results }` exports across **Overview**, **Funnel**, **Balance**, **Enjoyment**, and **PostHog** tabs, with interactive **Balance Era (`E8 v0.1.164+`)**, **Mode**, and **Prod Clean** hygiene filters.

### Syncing Official Dashboards to PostHog (`project/738615`)

4 dashboards (18 HogQL insights) are defined in `src/analytics/posthogDashboards.ts`, with numeric-semver Balance Era floors, `env = 'prod'` hygiene, Simpson-adjusted fighter/evolution/Arcana queries, and within-Catalyst-cohort evolution baselines auto-injected from `balanceEras.ts` + `posthogRules.ts`:
1. `NShapes · 1. Executive Pulse & Retention`
2. `NShapes · 2. Campaign Funnel & Churn Walls`
3. `NShapes · 3. Weapon, Fighter & Evolution Balance`
4. `NShapes · 4. Player Enjoyment & Sentiment (👍 / 👎)`

Commands:

```bash
# Regenerate docs/posthog-dashboards.json (with active Balance Era version floors)
npm run analytics:export

# Upsert all 4 dashboards & 18 HogQL tiles in PostHog project 738615
POSTHOG_PERSONAL_API_KEY=phx_... npm run analytics:posthog:sync

# Pull lightweight paginated balance events (excludes heavy replay/save blobs)
POSTHOG_PERSONAL_API_KEY=phx_... npm run analytics:posthog:pull-balance

# Pull raw fight_ended events (including full replay payloads, up to 1,000 rows)
POSTHOG_PERSONAL_API_KEY=phx_... npm run analytics:posthog:pull
```
