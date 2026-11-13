# The balance system

How Adventure Mode is measured and tuned. The feel we are aiming at is in
[balance-philosophy.md](./balance-philosophy.md); this page is the machinery.

Everything is simulated: headless bots play real fights through the real
reducer on fixed seeds, so every number is exact and repeatable.

## The four tools

| Tool | Command | What it answers | Where it lives |
|---|---|---|---|
| **The lab** (always on) | `npx jest __tests__/adventureBalanceLab.test.ts` | Is any weapon overpowered, underpowered, a passenger, or not worth a slot? | `src/adventure/balance/lab.ts`, `targets.ts`, `report.ts` |
| **The report** | `npm run balance:report` | The same, plus every recipe, written to [balance-report.md](./balance-report.md) with a list of what moved since last time | `docs/balance-report.md`, `docs/balance-snapshot.json` |
| **Level balance** | `npm run balance:levels` | Does each level hit its win rates for the bare and the invested player? | `__tests__/adventureBalance.test.ts` |
| **The HP tuner** | `npm run balance:tune` (`ONLY=5-2,3-4` for some) | What foe HP puts each level closest to its targets? Rewrites `data/levels.ts`. | `src/adventure/balance/tuner.ts` |

`__tests__/adventureBuilds.test.ts` adds the build-level checks: no fighter,
recipe pairing or random endgame build runs away from the field, and every
evolution adds damage over its two weapons.

**The workflow after changing a weapon, recipe, skill node or rule:**

1. `npx jest __tests__/adventureBalanceLab.test.ts` (about two minutes). Fix what it flags.
2. `npm run balance:report` and read the Movers table: did anything move that you did not mean to move?
3. `npm run balance:levels`. If levels drifted, `npm run balance:tune`, then run it again.
4. Commit the report and the snapshot with the change, so the next person's Movers table starts from yours.

## What the lab measures

Every measurement is a **counterfactual**: the same bot plays the same seeds
with the thing and without it, and the number is the ratio of total damage.
Level-up picks and shops are skipped, so only what was brought in counts, and
offers are rolled on their own random stream so they never change the fight.

**Three stages** (a foe that can't fall and never hits back):

| Stage | Board | Gear |
|---|---|---|
| Early | 3 traits, 2 minutes, 3 hearts | level 1, untuned (the day you find it) |
| Mid | 4 traits, 2½ minutes, 4 hearts | level 3 |
| Late | 5 traits, 3 minutes, 5 hearts | level 5, fully tuned |

**Three skill tiers:** the novice, average and expert bots (`engine/bot.ts`),
which differ in speed, mistakes and how boldly they guess.

**Per weapon:**

| Measure | What it is | Why |
|---|---|---|
| Alone | The weapon as the only charm vs no charm, at each stage, and late game for each tier | The cleanest read of what it does |
| In a build | Five random charms with it vs the same four without it, over several builds | What the slot is really worth next to other weapons |
| Passenger | Share of fights that play out exactly the same with and without it | A weapon can be strong on average and still do nothing most fights |
| Swing | Spread of its effect from fight to fight | High swing is exciting in a gamble and a problem in a staple |
| Leans | What it adds for an expert ÷ what it adds for a novice | Shows comfort picks and skill picks; not a failure either way |

**Per recipe:** its pair with evolutions on vs the same pair with them off
(the lift), and how often it starts per fight.

**Across the Armory:** the viable pool (share of weapons that earn their slot
in a real build), the top picks (weapons that add at least 65% of what the
strongest adds), and the mean level-1 weapon.

`lab.ts` also has `synergy(a, b)`: what two weapons add together ÷ what they
add apart. Use it when a pair looks suspicious.

## What counts as a problem

All bands are in `src/adventure/balance/targets.ts`. Change a design goal
there, not in a test.

| Verdict | Rule |
|---|---|
| **Overpowered** | Alone, late game, above its shelf's ceiling for **any** tier; or above ×1.8 alone at level 1; or above ×2.0 in a real build |
| **Underpowered** | Alone, late game, below its shelf's floor for **every** tier |
| **Passenger** | Changes nothing in more than 60% of fights at every stage |
| **Not worth a slot** | Adds less than 2% in a real build |
| **Weak / runaway recipe** | Lift below ×1.04 or above ×2.6 |
| **Rare recipe** | Starts fewer than 0.15 times a fight |

Plus three Armory-wide goals: viable pool ≥ 80%, at least 4 top picks, mean
level-1 weapon ≥ ×1.08 early.

Two weapons only work beside something else (Understudy, Encore Mask). They
are judged in a build, never alone (`PARTNER_WEAPONS`).

## Where the ideas come from

| Idea | Borrowed from | How it is used here |
|---|---|---|
| Measure the difference a thing makes, not raw win rate | 17lands' "improvement when drawn" for Magic drafts: games where a card showed up vs games where it sat in the deck ([definitions](https://mtgazone.com/17lands-in-defense-of-the-data/)) | Every lab number is with ÷ without on the same seeds |
| Restricted play | Jaffe et al., AIIDE 2012: balance as the win rate of an agent barred from something ([paper](https://ojs.aaai.org/index.php/AIIDE/article/view/12513)) | "In a build" plays the same build with one weapon removed |
| Several audiences, asymmetric rule | Riot's champion balance framework: overpowered if above the band for any skill bracket, underpowered only if below for all ([framework](https://www.leagueoflegends.com/en-us/news/dev/dev-champion-balance-framework/)) | Three bot tiers; the overpowered and underpowered rules above |
| A diversity KPI next to power | Riot's "viable pool" share per audience ([update](https://www.leagueoflegends.com/en-us/news/dev/dev-balance-framework-update/)) | Viable pool and top picks |
| Use and strength together | Slay the Spire's metrics server tracked pick rate beside win presence ([write-up](https://www.gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder)); Clash Royale separates "overpowered" from "sleepers" ([interview](https://www.gamedeveloper.com/design/-i-clash-royale-i-s-card-balancing-guru-leans-less-on-metrics-more-on-design-intuition)) | The passenger share: how often a weapon does anything at all |
| Tune by search toward stated targets | Simulation-based autobalancing toward a designer's target graph ([paper](https://arxiv.org/abs/2006.04419)) | The HP tuner searches foe HP toward each level's bare/invested targets |
| Fun first | Mark Rosewater: make the fun part the correct way to win | The trick weapons pay for doing the interesting thing; the lab only checks they pay enough and not too much |

We have no real players' data yet, so there is no pick rate. When there is,
the place for it is a column beside Passenger.

## Limits worth knowing

- **The foe in the lab never hits back.** Weapons that wake up on a lost heart (Life Link, Revenge Linker) and survival weapons read low there. Level balance, where foes do hit, is their real test.
- **Bots are not players.** They hunt marks, pages and chained pairs a set share of the time (`engine/bot.ts` `chooseSet`). A weapon that needs cleverness the bot lacks will read low; say so in the weapon's comment rather than buffing it blind.
- **Samples are small in the always-on run** (8 seeds, 4 builds). A number right at a band's edge can flip; the full report (14 seeds, 6 builds) is the one to trust.
- **Damage is the yardstick.** Coins, XP and hints only count through the damage they lead to in that fight.
