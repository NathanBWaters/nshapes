/**
 * Every balance band in one place. The lab (lab.ts) measures; this file says
 * what "good" is; the report (report.ts) and the guardrail test compare the
 * two. Change a design goal here, not in a test.
 *
 * Where the ideas come from (docs/balance-system.md has the sources):
 *  - Counterfactuals, not raw win rates: 17lands' "improvement when drawn"
 *    and restricted play (Jaffe et al.). Every number here is "with it" over
 *    "the same fight without it", on the same seeds.
 *  - Several audiences: Riot's framework. A thing is overpowered if it breaks
 *    the ceiling for ANY skill tier, and underpowered only if it misses the
 *    floor for ALL of them.
 *  - Use and strength together: Slay the Spire and Clash Royale flag by the
 *    quadrant (strong and always firing, strong but rarely firing, ...), so we
 *    track how often a thing does anything at all, not only how much.
 *  - A diversity KPI next to the power bands: Riot's "viable pool" share.
 *  - Base-vs-Mult discipline (spec-combat-synergy.md §2.1E): elevated base
 *    damage + compressed multipliers target >= 60% base share (<= 40% mult lift).
 */
import type { WeaponRole } from '../data/weaponRoles';

export type Tier = 'novice' | 'average' | 'expert';
export const TIERS: Tier[] = ['novice', 'average', 'expert'];

/** [floor, ceiling] for "damage with it ÷ damage without it" */
export type Band = readonly [number, number];

export const BALANCE_TARGETS = {
  /**
   * Base-vs-Mult damage share target for no-Power combat (elevated bases +
   * compressed multipliers): >= 60% of Set damage should come from pre-mult base
   * (<= 40% from multiplier lift).
   */
  baseDamageShare: [0.6, 1.0] as Band,
  /**
   * A weapon alone, at its best (level 5, fully tuned), late game.
   * Under the elevated-base + 15-node Synergy Graph system (zero global POWER ×N),
   * every Lv 5 weapon carries elevated flats plus 1–3 base Synergy scaling hooks
   * against bare 6-dmg Sets; clock-extending Tempo/Chains weapons also add extra Sets
   * on the 180s timed dummy.
   */
  soloLate: {
    damage: [1.3, 8.0],
    tricks: [1.1, 7.5],
    gambles: [1.1, 9.0],
    // Pure utility/support roles (board, survival, insight, tempo) don't need solo dummy DPS ([GP-11]):
    // gate them instead on in-build synergy (`inBuild`) and Human Gauntlet survival/clear lift.
    board: [0.95, 7.0],
    survival: [0.95, 7.0],
    insight: [0.95, 7.5],
    tempo: [0.95, 11.5],
    chains: [1.1, 12.0],
  } satisfies Record<WeaponRole, Band>,
  /** A weapon alone the day you find it (level 1, untuned), early game: felt, never dominant */
  soloEarly: [1.0, 5.5] as Band,
  /** The average level-1 weapon should add at least this much early */
  soloEarlyMean: 1.08,
  /**
   * Held in a real five-weapon build vs the same build without it (restricted
   * play). The honest measure: what the slot is worth next to other weapons.
   */
  // Utility weapons prove their keep via inBuild & Human Gauntlet clear lift ([GP-11])
  inBuild: [1.06, 4.6] as Band,
  /** A per-weapon timed evolution vs the same weapon with evolutions switched off */
  evoLift: [1.04, 2.2] as Band,
  /** A per-weapon evolution's bespoke rules vs a blank evolution chassis (+18 burst / +8 base / +0.20× additive) */
  evoRuleLift: [1.05, 1.85] as Band,
  /** Median per-weapon evolution lift across all 192 evolutions */
  evoLiftMedian: 1.15,
  /** A weapon's equipped evolution triggers at least this often per fight */
  evoTriggersPerFight: 0.35,
  /**
   * "Did it do anything?" The share of fights that play out exactly as they
   * would without the weapon. Above this at every stage, the weapon is a
   * passenger however strong its best case is.
   */
  deadFightShare: 0.6,
  /**
   * What a weapon adds for an expert ÷ what it adds for a novice. Leaning one
   * way is fine: comfort picks and skill picks are both good design, and the
   * rule above (too strong for anyone, too weak for everyone) already guards
   * the ends. The report says which way each weapon leans.
   */
  audienceEven: [0.6, 1.9] as Band,
  /** Share of weapons that earn their slot in a real build (inBuild floor): the viable pool */
  viablePool: 0.8,
  /** Weapons that add at least this share of what the best one adds count as "top picks"; we want several */
  topPickWithin: 0.45,
  topPicksAtLeast: 4,
  /** A number that moved more than this since the last snapshot is listed as a mover */
  moverShare: 0.15,
} as const;

/** Weapons that only work beside something else: judged in a build, never alone. */
export const PARTNER_WEAPONS: readonly string[] = ['understudy', 'encore-mask'];
