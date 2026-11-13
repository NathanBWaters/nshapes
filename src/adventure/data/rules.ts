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

/** Fixed numbers of the trick weapons (engine/gear.ts); the rest are levelled stats on the weapons. */
export const TRICK_RULES = {
  /** Fog Lantern: how long a fogged card stays face-down */
  fogMs: 8000,
  /** Bounty Poster: wanted cards to match before the poster changes */
  bountyCards: 3,
  /** Cursed Idol: how long a curse holds a card, and what a card that survives it multiplies a Set by */
  curseMs: 10000,
  curseMultiplier: 2,
  /** Thorn Bush: how long before a thorn card costs a heart */
  thornMs: 15000,
  /** Thorn Bush: extra time per trait beyond 3 (a Set takes longer to find with more traits) */
  thornMsPerExtraTrait: 5000,
  /** Thorn Bush: thorn cards on the board at once */
  thornCards: 1,
  /** Rust: Sets a card sits through before it turns golden, and the coins a golden card pays */
  rustSets: 7,
  rustCoins: 5,
  /** Long Fuse: fuse length, the window at the end that pays, and how many burnt-out duds may sit on the board */
  fuseMs: 20000,
  fuseHotMs: 5000,
  fuseDuds: 3,
  /** Ice Block: Sets it takes to thaw */
  iceSets: 7,
  /** Tightrope: what a Set away from your last one is multiplied by */
  offRopeMultiplier: 0.5,
  /** Hot Potato: how often it jumps, and the extra hearts a mistake costs while you hold it */
  potatoMs: 10000,
  potatoHearts: 1,
} as const;
