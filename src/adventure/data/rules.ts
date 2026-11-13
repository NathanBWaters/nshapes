/** Standard fight rules that Arcana, card text and the engine all refer to. */
export const BASE_RULES = {
  rainbowMultiplier: 2,
  coinCardChance: 0.1,
  coinCardValue: 3,
  powerCardChance: 0.12,
  powerCardBonus: 2,
  pickOptions: 3,
  /**
   * "Your next Set deals ×N" effects add up rather than multiply (×2 and ×2
   * make ×3), and the next Set's multiplier (with Hot Streak) tops out here.
   * Multiplying let a few cheap triggers before one Set snowball to ×8, ×16...
   */
  maxNextSetMultiplier: 4,
  /**
   * Time gains (weapons, rules, evolutions) can add at most this share of the
   * fight's starting clock in total. Without it, link-and-time loops ran
   * 3-minute fights for 12 minutes.
   */
  maxTimeGainShare: 1,
} as const;
