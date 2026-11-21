---
name: balance-analysis
description: >-
  Use when analyzing or comparing NShapes weapon, evolution, fighter, or Arcana
  power (1.00× weakest-anchored multipliers), blending live PostHog gameplay
  balance telemetry, diagnosing Sim-vs-Live divergence alerts, recording a
  Balance Era or fixing `validate:balance-eras` guardrail failures after
  mechanical combat changes, or updating PostHog balance dashboards and
  `/dev/analytics`.
---

# Balance analysis

## Core rules

```
NEVER GUESS RANKINGS FROM CODE. NEVER MIX INVALIDATED ERAS, DEV BUILDS, OR MODES.
```

1. **Compute, don't eyeball.** Run `npm run balance:power` (reads `docs/balance-snapshot.json` and `docs/balance-analytics.json` offline in <1s).
2. **Enforce Balance Eras & hygiene.** Every PostHog query or blend must go through `src/analytics/balanceEras.ts` and `src/analytics/posthogRules.ts` (numeric semver era floor, `env = 'prod'`, isolated mode, clean hygiene, and `PostHogAuditLedger` reported).
3. **Record mechanical changes immediately.** Any edit to combat rules, weapons, evolutions, fighters, Arcana, campaign levels, or Starfall Summit scaling must update `src/analytics/balanceEras.json` via `npm run balance:era:record` and pass `npm run validate:balance-eras`.

---

## 1. Answering "What are the strongest / weakest weapons, evolutions, fighters, or Arcana?"

Run `npm run balance:power` — every item in a category is anchored to the weakest item (`1.00×`):

```bash
npm run balance:power -- --format compact --top 10 --bottom 5          # Fast overview (weapons, evolutions, fighters)
npm run balance:power -- --category all --format compact --top 8       # Include Arcana
npm run balance:power -- --category weapons --lens inBuild --top 15    # Sub-lens query
npm run balance:power -- --category weapons --role gambles             # Filter weapons by role
npm run balance:power -- --category evolutions --lens buildAround --top 20
npm run balance:power -- --category fighters --format md
npm run balance:power -- --item standing-ovation                       # Single-item breakdown (ID or name)
npm run balance:power -- --compare blast-powder,chrono-shard           # Head-to-head + sub-lens ratios
npm run balance:power -- --write                                       # Regenerate docs/power-rankings.{md,json}
```

### Categories, lenses & flags

| Category | Lenses (`--lens`) | Notes |
|---|---|---|
| `weapons` | `composite` (default, `W8`), `inBuild`, `solo`, `pressure`, `shapley` | `--role`: `damage`, `tricks`, `gambles`, `board`, `survival`, `insight`, `tempo`, `chains` |
| `evolutions` | `composite` (default, `E7` pure upgrade), `buildAround` (`E8`), `ruleLift`, `pairOutput` | `E7` removes carrier-weapon confounding; `E8` adds 25% armed-pair output |
| `fighters` | `composite` (default, `F7`), `fullBuild`, `pressure160`, `dummy160`, `withWeapons90` | Always call out fighter sim caveats (see Methodology) |
| `arcana` | `composite` (default), `effectiveAvg`, `effectiveExpert`, `shapley` | Included via `--category arcana` or `--category all` |

Other flags: `--mode <adventure|spire>` (default `adventure`), `--top <N>`, `--bottom <N>`, `--format <md|compact|json>` (default `md`), `--write` (writes `docs/power-rankings.md` for weapons/evolutions/fighters — add `--category all` to include Arcana — plus full `docs/power-rankings.json`).

If output flags `STALE_DATA` because `docs/balance-analytics.json` lags the current Balance Era after a mechanical patch, refresh simulation artifacts (`npm run balance:report` and/or `npm run balance:atlas`) before reporting sim rankings.

---

## 2. Analyzing & blending live PostHog telemetry

Check whether `POSTHOG_PERSONAL_API_KEY` (`phx_...`, never the public `phc_` write key) is set in the environment:

```bash
# Live blend directly from PostHog (scope: query:read; falls back cleanly to sim-only if unset)
POSTHOG_PERSONAL_API_KEY=phx_... npm run balance:power -- --live

# Pull lightweight paginated balance events (excludes heavy recording/save blobs; default -> docs/posthog-live-sample.json)
POSTHOG_PERSONAL_API_KEY=phx_... npm run analytics:posthog:pull-balance -- --mode adventure --max-rows 10000

# Blend from a local export (JSON array, { results|events|rows }, HogQL { columns, results } matrix, or NDJSON)
npm run balance:power -- --posthog docs/posthog-live-sample.json

# Preview Empirical Bayes blending & filter audit ledger offline on a deterministic 40-player cohort
npm run balance:power -- --simulated-posthog --format compact --top 8 --bottom 5
```

Modifiers: `--era <current|E<n>|all>` (default `current`), `--include-dev` (default `env = 'prod'` only), `--mode <adventure|spire>`. For `pull-balance`: `--min-version <X.Y.Z>`, `--all-eras`, `--include-dev`, `--out <path>`. (Use `npm run analytics:posthog:pull` only when raw `recording`/`save` replay payloads are needed, capped at 1,000 rows.)

- **When `POSTHOG_PERSONAL_API_KEY` is absent:** `--live` emits a stderr notice and falls back to simulation-only rankings. Tell the user plainly that results are simulation-only and how to supply `POSTHOG_PERSONAL_API_KEY` or `--posthog <file>`.
- **Always report the `PostHogAuditLedger`:** `kept / totalRaw`, drops by version/env/mode/practice/bug/short/coached, `deduped`, and `ratedFolds`.

### Credibility tiers & divergence alerts

| Credibility tier | Threshold (`classifyCredibility`) | EB live weight (`k = 30`) |
|---|---|---|
| `sim_only` | `effectiveN = 0` | `w_live = 0` (100% sim prior) |
| `exploratory` | `effectiveN < 15` or `uniquePlayers < 5` | `w_live < 0.33` (diagnostic only) |
| `emerging` | `15 <= effectiveN < 50` and `uniquePlayers >= 5` | `0.33 <= w_live < 0.62` (blended + 95% CI) |
| `credible` | `effectiveN >= 50` and `uniquePlayers >= 10` | `w_live >= 0.62` (live-dominant + Ridge) |

| Alert | Trigger (`DIVERGENCE_THRESHOLDS`) | Meaning |
|---|---|---|
| `BOT_BLIND_SLEEPER` | `effectiveN >= 15`, live exceeds sim by `>= +0.22` log (~`+25%`) vs peers | Players outperform headless bots (e.g. hurt-reactive or human-combo items) |
| `BOT_FAVORED_TRAP` | `effectiveN >= 15`, live trails sim by `<= -0.22` log (~`-20%`) vs peers | Bots thrive, players struggle (e.g. cognitive-load board gambles hurting find-time) |
| `FUN_POWER_GAP` | `funCount >= 10` and (`>= p75` power & `funRate <= 50%`) or (`<= p25` power & `funRate >= 85%`) | Frustrating meta pick vs beloved crowd pleaser |
| `STALE_DATA` | All PostHog fights excluded by era floor (`kept = 0`), or atlas version lags current era | Collect current-era telemetry or re-run `npm run balance:atlas` |

---

## 3. Recording a Balance Era (or fixing `validate:balance-eras`)

`src/analytics/balanceFingerprints.ts` enforces a **hybrid fingerprint**:
- **Triggers:** SHA-256 changes to watched combat-math / Starfall Summit engine files or `virtual:globalConstants`, OR canonical mechanical changes to weapons, evolutions, fighters (passives + tuning + skill trees), Arcana, or campaign levels.
- **Never triggers:** Pure cosmetic/copy/UI/audio/motion edits (`weaponGuide.ts`, `weaponRoles.ts`, `story.ts`, `biomes.ts`, `components/`, `audio/`, and stripped cosmetic keys such as `name`, `description`, `flavor`, `icon`, `callout`, `taunt`, `pos`).

### Workflow after mechanical changes (or guardrail failure)

```bash
# 1. Inspect current era, active version floors, and working-tree drift
npm run balance:era:status
npm run validate:balance-eras

# 2. Record new Balance Era (auto-infers global / mode / category [>=50% changed] / item scope)
npm run balance:era:record -- --summary "Short description of mechanical change" --bump
# Or set target release version explicitly (bump package.json to match before validate:balance-eras):
npm run balance:era:record -- --summary "Short description" --version <next-X.Y.Z>

# 3. Inspect era timeline or exact per-item PostHog validity floor
npx tsx scripts/balance-eras.ts history
npx tsx scripts/balance-eras.ts valid-since --category evolutions --item stockpile --mode adventure

# 4. Regenerate downstream artifacts (refresh balance:report / balance:atlas first if sim numbers moved)
npm run balance:power -- --write      # refresh docs/power-rankings.{md,json}
npm run analytics:export              # refresh docs/posthog-dashboards.json with new version floors
npm run verify:guardrails && npm run test:fast
```

**Fixing `validate:balance-eras` failures:**
- Intended mechanical edit -> run `npm run balance:era:record` (override auto-inferred scope with `--scope <global|mode|category|item>` only if needed).
- `latestEra.minVersion exceeds package.json version` -> bump `package.json` version to `>= minVersion` (or record with `--bump`).
- Never pass `--init-fingerprints` to bypass a real balance change — it overwrites hashes without adding an era and leaves stale telemetry uninvalidated.
- Watched engine files are full-file SHA-256 hashed (CRLF-normalized), so avoid unrelated comment/formatting edits in watched engine files unless recording an era.

---

## 4. Updating PostHog HogQL dashboards & `/dev/analytics`

Official PostHog dashboards (project `738615`, `src/analytics/posthogDashboards.ts`) auto-inject active Balance Era version floors and hygiene predicates from `balanceEras.ts` + `posthogRules.ts`:

```bash
npm run analytics:export                                           # Regenerate docs/posthog-dashboards.json
POSTHOG_PERSONAL_API_KEY=phx_... npm run analytics:posthog:sync    # Upsert dashboards & HogQL tiles (scopes: dashboard:write, insight:write, query:read)
npx jest __tests__/posthogRules.test.ts                            # Verify HogQL grammar & analysis rules
```

For interactive local inspection, open `/dev/analytics` (`?source=local`, `?source=simulated`, or `?source=import`) in Expo Web to inspect **Overview**, **Funnel**, **Balance**, **Enjoyment**, and **PostHog** tabs with Balance Era, Mode, and Prod Clean filters.

### Mandatory ClickHouse / HogQL grammar guardrails

Enforced by `__tests__/posthogRules.test.ts` on every dashboard tile:
1. **`LEFT JOIN` before `ARRAY JOIN`:** Place CTE joins (`LEFT JOIN level_baselines ...`) *before* `ARRAY JOIN JSONExtractArrayRaw(...)` on `FROM events`.
2. **No cyclic `ARRAY JOIN` aliases:** Never write `trim(BOTH '"' FROM w) AS w`; alias the raw element distinctly (e.g. `AS raw_weapon_id`, then `trim(BOTH '"' FROM raw_weapon_id) AS weapon_id`).
3. **Never use `toBool()`:** Test boolean JSON properties via `lower(coalesce(toString(properties.<field>), 'false')) IN ('true', '1')` (or `NOT IN ('true', '1')`).
4. **Guard `log()` inside `avgIf()`:** Always write `log(greatest(toFloat64OrZero(toString(properties.dpm)), 1))`; ClickHouse evaluates `avgIf`'s value arg on all rows before masking, so unguarded `log(0)` yields `-inf`/`NaN`.
5. **Numeric semver only:** Always use `buildHogqlVersionClause(minVersion)` (mirroring TS `semverToNumeric`: `major * 1_000_000 + minor * 1_000 + patch`) — never lexicographic string compare (`'0.1.99' > '0.1.100'`).

---

## Methodology reference

### `1.00×` Power vs Added multipliers (`src/adventure/balance/powerRank.ts`)

- **`Power = P_i / min(P_j)`:** Strictly positive geometric composite anchored so the weakest item in each category equals `1.00×`.
- **`Added = ln(P_i) / ln(P_min)`:** Marginal bonus power above bare baseline (reported when `P_min >= 1.05`, else `null`); identical rank order to `Power`.
- **Weapons (`W8`):** `inBuild^0.55 · soloLate3T^0.15 · pressure^0.15 · campaign^0.05 · shapley^0.10`. Partner-only weapons (`understudy`, `encore-mask`) cannot fire alone; `soloLate3T`, `pressure`, and `campaign` are neutrally imputed from their `inBuild` ratio relative to non-partner peers.
- **Evolutions (`E7` / `E8`):** `E7` (`composite`, pure upgrade) = `cleanTotal^0.55 · ruleLift^0.45`; `E8` (`buildAround`) = `cleanTotal^0.40 · ruleLift^0.35 · pairOutput^0.25`. Encore Mask pairs set `cleanTotal = ruleBlend × medianChassisLift` (median blank-shell chassis lift across non-Encore recipes, fallback `1.191×`) to remove the evolutions-off denominator artifact. Multi-pair signature recipes average `pairLift` across arming pairs.
- **Fighters (`F7`):** `fullBuildShapley^0.30 · withWeapons90^0.25 · (pressure160 · (0.65 + 0.35 · survival160))^0.25 · dummy160^0.20`. **Caveats:** `fullBuild` compresses fighters because 5 charms + 2 Arcana + Power carry most endgame output; `withWeapons90` evaluates at 90★ (below the World 4 `SEALED_AT` capstone gate), causing capstone jumps by 160★; fast combo fighters can lead unarmed Pressure damage while paying a survival penalty or dropping on slower 5-trait boards; `balance-snapshot.json` does not track fighters and `fighterSuite.curves` runs avg-bot only (6 seeds, unarmed).
- **Arcana:** `(effectiveAvg · (0.70 + 0.30 · survivalAvg))^0.45 · effectiveExpert^0.20 · shapley^0.35`.

### Mandatory PostHog statistical rules (`src/analytics/posthogRules.ts`)

1. **Numeric semver era gate:** `semverToNumeric` rejects missing/malformed versions; hierarchical `getMinValidVersion(category, itemId, mode)` takes max of global, mode, category, and per-item invalidations, preserving valid history for untouched items after granular patches.
2. **Hygiene defaults:** `env = 'prod'`, mode isolation (`adventure` vs `spire`, never mixed with `free_play`/`classic`), exclude `practice` and `'bug_in_game'` tags, require `sets >= 3` and `duration_ms >= 10_000`, exclude Adventure `'1-1'` and `helped_sets / sets > 0.50`, normalize legacy weapon IDs via `resolveLegacyWeapon`.
3. **Dedup & rating fold:** Deduplicate by `fight_id` and fold retrospective `fight_rated` ratings/tags onto the matching fight.
4. **Player concentration control:** `1 / sqrt(playerItemFights)` weights, exact iterative water-filling `25%` per-player weight cap (when `uniquePlayers >= 4`), and Kish `effectiveN = (Σw)² / Σ(w²)`.
5. **Leave-one-out Simpson's stratification:** Adventure `(level_id, era)` (fallback `(world, boss)` at `N < 5`); Spire `(spire_act, spire_node_kind, ascension_bucket, era)` (fallback `spire:act<N>`).
6. **Evolution survivorship cohort:** Benchmark forged evolutions strictly within `evolutions > 0` (Catalyst-reaching) fights.
7. **L2 Ridge co-occurrence debiasing:** Cholesky SPD solver (`λ = 8` at `N >= 80` main decided fights; `λ = 6` at `N >= 40` evo cohort) controlling for `weapon_count` and `ln(median_find_ms)`, preferred for items with `>= 10` fights; pre-patch rows of granularly patched items are isolated as `<cat>:<id>@pre` nuisance features.
8. **Empirical Bayes log-space blend:** `liveLogLift = clamp(0.60 × 1.6 × winDelta + 0.40 × clamp(logDpmDelta, -0.75, 0.75), -0.8, 0.8)`; `w_live = effectiveN / (effectiveN + 30)`; `P_blend = P_sim × exp(w_live × liveLogLift)`, then re-anchored to `1.00×`.

### Canonical files & docs

| Area | Files |
|---|---|
| Power rankings engine & CLI | `src/adventure/balance/powerRank.ts`, `scripts/balance-power-rank.ts`, `docs/power-rankings.md` |
| Balance Eras & fingerprints | `src/analytics/balanceEras.ts`, `src/analytics/balanceEras.json`, `src/analytics/balanceFingerprints.ts`, `scripts/balance-eras.ts` |
| PostHog rules, dashboards & fetcher | `src/analytics/posthogRules.ts`, `src/analytics/posthogDashboards.ts`, `scripts/posthog-dashboards.ts`, `scripts/lib/posthogFetch.ts` |
| Dev studio & analytics engine | `src/analytics/dashboardEngine.ts`, `app/dev/analytics.tsx` |
| Deep-dive specs & tests | `docs/posthog-analysis-rules.md`, `docs/balance-system.md`, `docs/analytics.md`, `__tests__/powerRank.test.ts`, `__tests__/posthogRules.test.ts`, `__tests__/balanceEraManifest.test.ts` |
