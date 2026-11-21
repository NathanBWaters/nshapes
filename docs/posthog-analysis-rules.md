# PostHog Gameplay Analysis & Balance-Era Invalidation Rules

> **Core Principle:** Never average telemetry across invalidated balance patches, mixed game modes, dev builds, or unadjusted difficulty tiers. Every rule below is **machine-enforced** in `src/analytics/balanceEras.ts`, `src/analytics/posthogRules.ts`, `src/analytics/posthogDashboards.ts`, `/dev/analytics`, and `npm run balance:power`.

---

## 1. Version-Era Invalidation Rules (`src/analytics/balanceEras.json`)

Every `fight_ended` event carries `app_version` (from `package.json`, present since `v0.1.119`) and `balance_era` (stamped in `common()` since `E8`).

### Mandatory Rules
1. **Numeric Semver Comparison Only:** Always compare versions via `major * 1_000_000 + minor * 1_000 + patch` (`semverToNumeric` in TS, `buildHogqlVersionClause` in HogQL). **Never** compare `app_version` lexicographically (`"0.1.99" > "0.1.100"` in string order).
2. **Reject Missing / Malformed Versions:** Events lacking a parseable `X.Y.Z` `app_version` are excluded from balance calculations.
3. **Hierarchical Validity Floor (`getMinValidVersion`):** Each item's valid-from boundary is the maximum of:
   - Latest **global** combat mechanics reset (`invalidated.global: true`)
   - Latest **mode** reset matching the analyzed mode (`invalidated.modes`)
   - Latest **category** reset (`weapons`, `evolutions`, `fighters`, `arcana`, `levels`)
   - Latest **item-specific** tweak (`invalidated[category]` containing that item ID)
4. **Granular Preservation:** When a future patch tweaks only 1 weapon or 2 evolution recipes, **only those items** advance their `minValidVersion` — untouched items retain valid live telemetry from earlier versions within the same global era.

### Recorded Balance Eras (`v0.1.119` → `v0.1.166+`)

| Era | Valid Versions | Commit | Scope | What Changed / Invalidated |
|---|---|---|---|---|
| **E0** | `0.1.119–0.1.121` | `16bad9c` | Global + Schema | Initial `fight_ended` (lacked `mode`, `weapons_offered`, `evolutions_forged`, `fun_rating`); `0.1.121` tuned `wild-card`, `decoy`, `Sly Fox`, `1-3`/`1-7` HP. |
| **E1** | `0.1.122–0.1.124` | `6a101ab` | Global (Schema) | Full wide-event schema with fun ratings, offer/pick/buy choices, and rolling sessions. |
| **E2** | `0.1.125–0.1.136` | `ccfd086` | Adventure Mode | 3-star funnel & World 1–2 onboarding rebalance (`helped_sets` added at `0.1.132`). |
| **E3** | `0.1.137–0.1.148` | `b983a28` | **Global Mechanics** | Set-Parrying, Multiplier Ignition, Kill-Cam, Starfall Spire launch. |
| **E4** | `0.1.149–0.1.153` | `a4fd34d` | **Global Mechanics** | Rainbow 2× moved into `rainbow-charm`, `flint-spark` moved to W2, Spire overhaul (`0.1.151`) & Spire PostHog (`0.1.153`). |
| **E5** | `0.1.154–0.1.155` | `7d499a3` | **Global Hard Reset** | Unified add-then-multiply math, 17 engine bugfixes, Role Set 2/4/6 bonuses, 1/5 weapons overhaul, Wave 2 evolutions overhaul, fighter trees/passives & Round 1–2 full rebalance. |
| **E6** | `0.1.156–0.1.158` | `74e4408` | **Starfall Summit** | Summit no-dup rules (`0.1.156`), `too_easy`/`bug_in_game` tags (`0.1.157`), 6-weapon cap & Summit rebalance (`0.1.158`). Adventure unaffected. |
| **E7** | `0.1.159–0.1.163` | `b65299a` | **Evolutions** | Catalyst changed from deterministic list-order first-armed recipe to player-chosen 1-of-3 random armed recipes. |
| **E8** | `0.1.164–0.1.165` | `58f6dd7` | **Global Hard Reset** | Dropped 2/4/6 Role Set bonuses (`0.1.163`) and rebalanced Adventure HP, Summit encounters, `tempo_surge`, `stockpile`, and `prism-burst` (`0.1.164`). |
| **E9 (Current)** | **`0.1.166+`** | `d3a12e6` | **Global Mechanics** | Folded synchronous Set-triggered damage rules (Rally Horn, Catalyst Prism, War Drum, Clarity Lens, etc.) into BASE before multipliers. |

---

## 2. Automated Balance-Change Guardrail Workflow

`src/analytics/balanceFingerprints.ts` computes a **hybrid fingerprint**:
- **Engine & Global Rule Files (33 hashes):** SHA-256 of combat-math engine files (`adventure/engine/*`, `adventure/rules/engine.ts`, `spire/data/*`, `spire/engine/*`, `utils/{weaponEffects,matchResolution,gameConfig,enemyEffects,enemyFactory}.ts`) plus global constants (`DEFAULT_PLAYER_STATS`, `POWER_KNEE/TAIL/SHARE`, `TREE_BUDGET`, etc.).
- **Per-Item Canonical Mechanical Hashes:** Structural hashes of every weapon (64), evolution (208), fighter + passive tuning + skill tree (6), Arcana (8), and campaign level (59), **stripping cosmetic text** (`name`, `description`, `flavor`, `icon`, `callout`, `taunt`, `pos`).

Cosmetic edits (UI, motion, audio, `weaponGuide.ts`, story text, flavor copy) **never** trigger false alarms.

### When You Change Balance
1. Edit the weapon, evolution, fighter, Arcana, level, or combat engine file.
2. Record the new Balance Era in one command:
   ```bash
   # Auto-detects global / mode / category / exact item IDs and bumps package.json patch version:
   npm run balance:era:record -- --summary "Buff chrono-shard Lv1-5 cooldown" --bump

   # Or specify the upcoming release version explicitly (without editing package.json yet):
   npm run balance:era:record -- --summary "Nerf prism-burst opening blast" --version 0.1.165
   ```
3. Refresh exported PostHog dashboard queries if needed:
   ```bash
   npm run analytics:export
   # Optional: push updated HogQL tiles to PostHog project 738615
   POSTHOG_PERSONAL_API_KEY=phx_... npm run analytics:posthog:sync
   ```
4. Verify with `npm run validate:balance-eras` (runs automatically in `verify:guardrails`, `.githooks/pre-push`, and GitHub Actions CI).

---

## 3. Environment & Hygiene Filtering Rules

Applied identically in `filterFightEvents()` (`src/analytics/posthogRules.ts`) and `buildHogqlBalanceHygieneWhere()` (`src/analytics/posthogDashboards.ts`):

| Rule | Default Filter | Why |
|---|---|---|
| **Environment & WebDriver Guard** | `env = 'prod'` (override with `--include-dev`); runtime suppresses capture when `navigator.webdriver === true` | Prevents local `__DEV__` / QA / Playwright E2E bot runs from polluting live balance. |
| **E2E Bot Filter (`soloTester`)** | When `soloTester: true` + `includeDev: true`, drop `env = 'dev' && median_find_ms <= 1400 && max_drought_ms <= 2000 && mistakes = 0` (`droppedByE2eBot`) | Stops legacy pre-guard Playwright E2E runs from distorting human calibration or balance metrics. |
| **Mode Isolation** | Analyze `adventure` and `spire` separately (never mix with `free_play` / `classic`) | Adventure, Starfall Summit, Free Play, and Classic have completely different economies, timers, and win conditions. |
| **Practice Exclusion** | `practice != true` and `outcome != 'practice'` | Excludes endless Training Dummy (`1-4D`) sandbox sessions. |
| **Bug Exclusion** | `'bug_in_game'` not in `fun_tags` | Drops player-flagged bugged fights from balance statistics. |
| **Deduplication & Rating Fold** | Deduplicate by `fight_id`; fold retrospective `fight_rated` onto matching `fight_id` | Prevents offline retry double-counting and preserves late Camp History ratings. |
| **Engagement Floor** | `sets >= 3` and `duration_ms >= 10_000` | Filters instant retreats/restarts that carry zero weapon/fighter signal. (`outcome = 'left'` excluded from win% denominator, tracked separately as abandon rate.) |
| **Tutorial & Coaching Filter** | Exclude Adventure `level_id = '1-1'` and runs where `helped_sets / sets > 0.50` | `1-1` cannot be lost; heavy auto-hint/companion clears inflate early starter gear. |
| **Legacy ID Resolution** | Map via `resolveLegacyWeapon(id)` (drop `null` removed IDs) | Normalizes historical rare/common weapon suffixes to current Armory IDs. |
| **Audit Transparency** | Always report `PostHogAuditLedger` (`totalRaw`, `kept`, and exact drop counts per rule) | Ensures zero silent filtering. |

---

## 4. Confounding Controls

1. **Leave-One-Out Simpson's-Paradox Stratification:**
   - Adventure fights are stratified by `(level_id, balance_era)` (fallback `(world, boss)` when stratum `N < 5`).
   - Starfall Summit fights are stratified by `(spire_act, spire_node_kind, ascension_bucket, balance_era)`.
   - Every fight's outcome and `ln(dpm)` are compared against the **leave-one-out** baseline of its stratum so late-game unlocks are never penalized by harder worlds and small strata avoid self-attenuation bias.
2. **Player Concentration Control:**
   - Each player's fights with an item receive weight `1 / sqrt(player_item_fights)`, and no single player can exceed `25%` of an item's total weight (when `uniquePlayers >= 4`).
   - Credibility uses **Kish effective sample size** `effectiveN = (Σ w)² / (Σ w²)` alongside `uniquePlayers`, preventing one power-tester grinding 100 runs from dominating an item's ranking.
3. **Evolution Survivorship Control:**
   - An evolution can only be forged if the player survived long enough to match a Catalyst.
   - Forged evolutions are therefore benchmarked **strictly within the Catalyst cohort (`evolutions > 0`)**, never against all fights (which include early losses before any Catalyst could spawn).
4. **Co-Occurrence De-Biasing (L2 Ridge Regression):**
   - Players hold 3–6 weapons simultaneously plus a Fighter and Arcana. Naive averages let passenger weapons freeload on S-tier carries.
   - When valid decided fights `N >= 80` (and `>= 40` in the evolution cohort), `analyzePostHogForBalance` fits a weighted L2-regularized Ridge regression (Cholesky SPD solver, `λ = 8`) on held weapons + fighter + Arcana + build-size (`weapon_count`) and player-speed (`ln(median_find_ms)`) covariates, preferring de-biased `ridgeWinDelta` / `ridgeLogDpmDelta` for items with `>= 10` fights.

---

## 5. Credibility Gates, Empirical Bayes Blending & Divergence Alerts

| Credibility Tier | Threshold | Blending Behavior (`k = 30`) |
|---|---|---|
| `sim_only` | `effectiveN = 0` | 100% Simulation prior (`w_live = 0`). |
| `exploratory` | `effectiveN < 15` or `uniquePlayers < 5` | Diagnostic only; heavily shrunk toward Sim (`w_live < 0.33`). |
| `emerging` | `15 <= effectiveN < 50` and `uniquePlayers >= 5` | Blended Sim + Live (`0.33 <= w_live < 0.62`) with 95% CI. |
| `credible` | `effectiveN >= 50` and `uniquePlayers >= 10` | Live-dominant (`w_live >= 0.62`) + Ridge co-occurrence debiasing. |

Composite live signal `liveLogLift` combines level-adjusted/Ridge win delta (`60%`, scaled `×1.6` to natural-log power units) and level-adjusted/Ridge `ln(dpm)` delta (`40%`), clamped to `[-0.8, +0.8]`. Downstream power rankings (`npm run balance:power`) blend in log-space:
$$P_{\text{blend}} = P_{\text{sim}} \cdot \exp(w_{\text{live}} \cdot \text{liveLogLift}), \quad w_{\text{live}} = \frac{\text{effectiveN}}{\text{effectiveN} + 30}$$

### Solo-Tester Low-Sample Mode (`--solo-tester` / `soloTester: true`)

During pre-launch iteration when a single playtester generates most `prod` telemetry across 1–3 browser profiles, pass `--solo-tester` to `npm run balance:power` (or `soloTester: true` to `analyzePostHogForBalance`):
- **Environment stays `prod`-only by default** (never silently includes `env = 'dev'`; when combined with `--include-dev`, automatically drops Playwright E2E bot signatures into `droppedByE2eBot`).
- **Uniform fight weights (`w = 1`, `effectiveN = fights`):** Treats multiple browser sessions of the same solo tester equally instead of penalizing the busier browser via `1 / sqrt(n_p)`.
- **Player-count-free credibility tiers:** `exploratory` (`1–2` fights, diagnostic only), `emerging` (`3–9` fights), `credible` (`>= 10` fights).
- **Tighter low-N lift guard:** Clamps `liveLogLift` to `±0.50` for items with `< 10` fights (full `±0.80` at `>= 10`), paired with `priorK = 12` and a 3-fight minimum before shifting rankings in `balance:power`.

### Live PostHog HogQL Guardrails (Enforced by `__tests__/posthogRules.test.ts`)

1. **No `toInt32OrZero` / `toInt32OrNull`:** HogQL rejects 32-bit integer cast aliases — always use `toIntOrZero(...)` / `toIntOrNull(...)` (or `toInt64OrZero` / `toFloat64OrZero` / `toFloat64OrNull`).
2. **Keyset pagination only (never `OFFSET`):** PostHog rejects `OFFSET` on HogQL queries authenticated with a Personal API Key (`phx_...`). Paginate via `(timestamp, uuid)` keyset cursors (`parseDateTime64BestEffort`).
3. **No `toBool()`, `LEFT JOIN` before `ARRAY JOIN`, no cyclic `ARRAY JOIN` aliases, guard `log(greatest(..., 1))` inside `avgIf()`.**

### Sim-vs-Live Diagnostic Alerts
- **`BOT_BLIND_SLEEPER` (`live >> sim`):** Real players outperform headless bots (e.g., hurt-reactive items like `life-link`/`revenge-linker`, or clever human combo setups).
- **`BOT_FAVORED_TRAP` (`sim >> live`):** Headless bots dominate with it, but real players struggle (e.g., high cognitive-load board gambles that hurt human scanning speed / `median_find_ms`).
- **`FUN_POWER_GAP`:** Strong win/DPM with poor `fun_rate` ("frustrating meta pick"), or modest power with high `fun_rate` + high `pick_rate` ("beloved crowd pleaser").

---

## 6. Quick Command Reference

All PostHog CLI scripts auto-load `POSTHOG_PERSONAL_API_KEY` (`phx_...`, never `phc_` or `phs_`) from `.env.local` / `.env` via `scripts/lib/loadEnv.ts` (without overriding shell environment variables).

```bash
# Check Balance Era status & active PostHog version floors
npm run balance:era:status
npm run validate:balance-eras
npx tsx scripts/balance-eras.ts history
npx tsx scripts/balance-eras.ts valid-since --category evolutions --item stockpile --mode adventure

# Pull lightweight paginated PostHog balance events (auto-reads .env.local; supports --era current|all|<id>)
npm run analytics:posthog:pull-balance -- --era all --out /tmp/posthog-runs.json

# Ask & answer "what are the strongest weapons, evolutions, and fighters?" (1.00x+ multipliers)
npm run balance:power                                    # Sim-only (instant, offline)
npm run balance:power -- --live                          # Auto-reads .env.local, current era prod
npm run balance:power -- --live --era all --solo-tester  # Solo playtester directional blend
npm run balance:power -- --posthog docs/posthog-live-sample.json
npm run balance:power -- --simulated-posthog             # Preview Sim+Live blending on 40-player cohort
```
