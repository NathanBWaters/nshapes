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
 */
import type { WeaponRole } from '../data/weaponRoles';

export type Tier = 'novice' | 'average' | 'expert';
export const TIERS: Tier[] = ['novice', 'average', 'expert'];

/** [floor, ceiling] for "damage with it ÷ damage without it" */
export type Band = readonly [number, number];

export const BALANCE_TARGETS = {
  /**
   * A weapon alone, at its best (level 5, fully tuned), late game.
   * Damage weapons are meant to be the top of the field; everything else
   * should be clearly felt without matching them.
   */
  soloLate: {
    damage: [1.6, 4.6],
    tricks: [1.15, 3.6],
    gambles: [1.15, 3.8],
    board: [1.15, 3.2],
    survival: [1.15, 3.0],
    insight: [1.15, 3.0],
    tempo: [1.15, 3.0],
    chains: [1.15, 3.0],
  } satisfies Record<WeaponRole, Band>,
  /** A weapon alone the day you find it (level 1, untuned), early game: felt, never dominant */
  soloEarly: [1.0, 1.8] as Band,
  /** The average level-1 weapon should add at least this much early */
  soloEarlyMean: 1.08,
  /**
   * Held in a real five-charm build vs the same build without it (restricted
   * play). The honest measure: what the slot is worth next to other weapons.
   */
  inBuild: [1.02, 2.0] as Band,
  /** An evolution vs its two weapons with evolutions switched off */
  recipeLift: [1.04, 2.6] as Band,
  /** The middle recipe: evolutions as a whole are a power trip */
  recipeLiftMedian: 1.2,
  /** A held recipe starts at least this often per fight */
  recipeStartsPerFight: 0.15,
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
  topPickWithin: 0.35,
  topPicksAtLeast: 4,
  /** A number that moved more than this since the last snapshot is listed as a mover */
  moverShare: 0.15,
} as const;

/** Weapons that only work beside something else: judged in a build, never alone. */
export const PARTNER_WEAPONS: readonly string[] = ['understudy', 'encore-mask'];
