/** Standard fight rules that Arcana, card text and the engine all refer to. */
export const BASE_RULES = {
  rainbowMultiplier: 1,
  coinCardChance: 0.1,
  coinCardValue: 3,
  powerCardChance: 0.12,
  powerCardBonus: 2,
  pickOptions: 3,
  /**
   * "Your next Set deals ×N" effects add up rather than multiply (×2 and ×2
   * make ×3), and the combined single-Set multiplier (with Hot Streak) tops out
   * at ×16 so player-engineered burst setups pay out in full without overflow.
   */
  maxNextSetMultiplier: 16,
  /**
   * Time gains (weapons, rules, evolutions) can add at most this share of the
   * fight's starting clock in total. Without it, link-and-time loops ran
   * 3-minute fights for 12 minutes.
   */
  maxTimeGainShare: 1,
} as const;

/**
 * Shading Surge (Worlds 3-5). Four traits all the time was too much to hold in
 * your head, so the board plays on three traits with every card solid, and
 * shading only switches on for a short, high-stakes window: for 15 seconds,
 * shading joins the rule and every Set gets ×5 in the multiplier chain.
 *
 * Damage equation (every Set, Surge or not):
 *   TOTAL = (card points + sum of all flat bonuses) × (product of all multipliers)
 * During a Shading Surge, ×5 multiplies the entire additive base cleanly
 * alongside Rainbow, Parry, Stagger, Evolutions, Next-Set boosts, and Power.
 */
export const SURGE_RULES = {
  /** Shading off (every card solid) */
  calmMs: 45000,
  /** Shading on */
  surgeMs: 15000,
  /** Set multiplier applied during the surge (joins all other multipliers in BASE × MULT) */
  multiplier: 5,
  /** Heads-up before a surge starts */
  warnMs: 5000,
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
  /** Hot Potato: however much it has grown, it never jumps faster than this */
  potatoMinMs: 4000,
  potatoHearts: 1,
} as const;

/**
 * The deck (engine/dealer.ts). A level's deck is one of every card its traits
 * can make, and a card that leaves the board goes back into it.
 *
 * Where it goes back matters. Queued in the order they left, the three cards of
 * a Set came back together a few Sets later: from the 6th Set of a fight on,
 * nine times in ten the three new cards were a ready-made Set. So a card goes
 * back at a random place in the lower part of the deck instead.
 *
 * Two traits make only nine cards, which is a whole board: every card was always
 * on the board, and the three just matched were the only ones left to deal. A
 * level whose deck fits on its board plays with `copies` of each card (two of a
 * kind can never be in one Set), and is dealt for variety: of the kinds that
 * just left, at most `maxReturning` comes straight back, never to the slot it
 * left, and only when the board would otherwise lose a kind of Set (same
 * color, same shape, all different).
 */
export const DECK_RULES = {
  /** A returning card lands below this share of the deck (0.5 = somewhere in the lower half) */
  returnDepth: 0.5,
  /** Cards of each kind in a deck that would otherwise fit on the board */
  copies: 2,
  /** Kinds that just left the board that may be dealt straight back */
  maxReturning: 1,
  /** What a kind of Set on the board is worth to the dealer, in Sets… */
  kindOfSetWorth: 100,
  /** …and what dealing a kind straight back costs (less than a kind of Set, more than any number of Sets) */
  returningCost: 60,
  /** Penalty per duplicate card-kind on the board so 2-trait boards stay visually varied */
  duplicatePairCost: 12,
  /** How far down the deck the dealer looks */
  dealWindow: 12,
} as const;

/**
 * Stuck help. A new player can stare at a board for a minute without finding a
 * Set, and that minute is when they leave. So in the first two worlds the
 * companion points a Set out when the board has been quiet for a while: one
 * card, then a second, then (in the first world) the whole Set.
 *
 * Seconds without a Set before each card lights up. It costs nothing and is not
 * a hint (the bulb, auto-hints and Keen Eye are separate and arrive later). It
 * fades out by World 3, where the player has hints and a build of their own.
 */
export const ASSIST_RULES = {
  /** The very first level: quick, because nothing is at stake and the player is still learning what a Set is */
  firstLevel: [5, 9, 13],
  /** World 1 on two traits (nine cards) */
  twoTraits: [8, 14, 20],
  /** World 1 on three traits */
  threeTraits: [12, 20, 28],
  /** World 2: a nudge, never the whole Set */
  secondWorld: [20, 34],
} as const;
