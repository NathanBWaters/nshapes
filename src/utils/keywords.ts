/**
 * Keyword Registry for Tooltip System
 *
 * Defines all game mechanics that can be tapped for explanations.
 * Keywords are auto-detected in descriptions and rendered as tappable text.
 */

export interface KeywordDefinition {
  /** Terms to match (case-insensitive, whole-word only) */
  terms: string[];
  /** One-sentence definition shown at top of tooltip */
  brief: string;
  /** Full explanation shown below the brief */
  detailed: string;
}

export const KEYWORDS: Record<string, KeywordDefinition> = {
  // =============================================================================
  // CORE MECHANICS
  // =============================================================================

  set: {
    terms: ['set', 'valid set', 'sets'],
    brief: 'Three cards where each attribute is all same or all different.',
    detailed: 'A SET is 3 cards where, for each active attribute (shape, color, number, etc.), the values are either ALL THE SAME or ALL DIFFERENT across the three cards. If even one attribute has 2 matching and 1 different, it\'s not a valid SET.',
  },

  match: {
    terms: ['match', 'matching', 'matched'],
    brief: 'Successfully selecting 3 cards that form a valid SET.',
    detailed: 'When you tap 3 cards that form a valid SET, they are removed from the board and you earn points, coins, and XP. Many weapon effects trigger "on match" - meaning they have a chance to activate each time you successfully match.',
  },

  health: {
    terms: ['health', 'hearts', 'HP', 'hit points'],
    brief: 'Your life total. Reach 0 and the run ends.',
    detailed: 'You lose 1 health when you select 3 cards that don\'t form a valid SET (and have no grace to save you). Some weapons can heal you or increase your max health. Health cannot exceed your maximum.',
  },

  grace: {
    terms: ['grace', 'graces'],
    brief: 'Allows you to complete a match even if 1 attribute is wrong.',
    detailed: 'When you select 3 cards and only 1 attribute breaks the SET rule, a grace is consumed and the match succeeds anyway. If 2+ attributes are wrong, no grace can help - you lose health and the cards are removed.',
  },

  hint: {
    terms: ['hint', 'hints'],
    brief: 'Reveals a valid SET on the board when activated.',
    detailed: 'Tap the hint button to highlight 3 cards that form a valid SET. You earn hints from weapon effects during matches. Your hint capacity is limited by max hints.',
  },

  autohint: {
    terms: ['autohint', 'auto-hint', 'auto hint'],
    brief: 'Automatically reveals 1 card from a valid SET after idle time.',
    detailed: 'When you haven\'t matched for a while (default 15 seconds), autohint may activate and highlight one card that\'s part of a valid SET. You still need to find the other two cards yourself!',
  },

  attribute: {
    terms: ['attribute', 'attributes'],
    brief: 'A property of cards: shape, color, number, shading, or background.',
    detailed: 'Cards have up to 5 attributes, each with 3 possible values. Shape (diamond/squiggle/oval), color (red/green/purple), number (1/2/3), shading (solid/striped/open), and background color. More attributes = harder puzzles.',
  },

  // =============================================================================
  // CARD EFFECTS
  // =============================================================================

  fire: {
    terms: ['fire', 'burning', 'burns', 'ignite', 'ignites', 'on fire'],
    brief: 'Cards on fire are destroyed after 0.25 seconds.',
    detailed: 'Burning cards have a flame effect and are automatically destroyed after 0.25 seconds, awarding +1 point and +1 coin. When a card burns out, fire has a 10% chance to spread to adjacent cards.',
  },

  holographic: {
    terms: ['holographic', 'holo'],
    brief: 'Holographic cards give 2x points when matched.',
    detailed: 'Cards with a shimmering holographic effect award double points when included in a successful match. Look for the rainbow shimmer effect on cards.',
  },

  explosion: {
    terms: ['explosion', 'explode', 'explodes', 'explosive'],
    brief: 'Destroys cards adjacent to your match.',
    detailed: 'After matching, each adjacent card (up/down/left/right of matched cards) has a chance to be destroyed. Destroyed cards award +1 point and +1 coin each. Multiple explosion sources stack their chances.',
  },

  laser: {
    terms: ['laser', 'lasers'],
    brief: 'Destroys an entire row or column.',
    detailed: 'When triggered, destroys all cards in either a row or column (randomly chosen). Each laser weapon rolls independently on every match - multiple lasers can all fire at once! Destroyed cards award +2 points each.',
  },

  echo: {
    terms: ['echo', 'echoes', 'echoed'],
    brief: 'Automatically matches another valid SET on the board.',
    detailed: 'After your match, echo finds and matches another valid SET automatically. The echoed match triggers all on-match effects like explosions, healing, coin drops, and more - creating powerful chain reactions!',
  },

  ricochet: {
    terms: ['ricochet', 'ricochets'],
    brief: 'Destroys a random card, which may chain to more.',
    detailed: 'After matching, ricochet destroys a random card anywhere on the board. Each destroyed card has a chance to chain to another random target. With luck, chains can continue multiple times!',
  },

  chainReaction: {
    terms: ['chain reaction'],
    brief: 'Makes echo trigger twice instead of once.',
    detailed: 'When you have Chain Reaction and echo triggers, it finds and matches TWO additional SETs instead of one. Combined with on-match effects, this creates massive cascading combos.',
  },

  // =============================================================================
  // RESOURCES & STATS
  // =============================================================================

  coin: {
    terms: ['coin', 'coins', 'money'],
    brief: 'Currency used to buy weapons in the shop.',
    detailed: 'Earn coins from matches (1 per card) and destroyed cards. Spend coins in the weapon shop between rounds. Some weapons increase your coin drop rate.',
  },

  xp: {
    terms: ['XP', 'experience'],
    brief: 'Earn enough to level up and get a free weapon.',
    detailed: 'Gain XP from matches (1 per card by default). When you level up, you get to choose a free weapon. XP required increases each level. Some weapons boost your XP gain rate.',
  },

  time: {
    terms: ['time', 'timer', 'seconds'],
    brief: 'Countdown to complete each round.',
    detailed: 'Each round has a 60-second timer. Reach the score target before time runs out! Some weapons add starting time or grant bonus time on match. Time gained is capped at your starting time.',
  },

  board: {
    terms: ['board', 'field'],
    brief: 'The grid of cards you match from.',
    detailed: 'Cards are arranged in a grid (3 columns). Board size varies based on attribute count and your field size stat. Larger boards mean more cards and more possible SETs to find.',
  },

  fieldSize: {
    terms: ['field size', 'board size', 'starting board'],
    brief: 'How many cards you start each round with.',
    detailed: 'Your base field size determines initial card count. The actual board uses the maximum of: minimum required for attribute count, or your field size stat. Field Stone weapons increase this.',
  },

  boardGrowth: {
    terms: ['board growth', 'expand board', 'board expands'],
    brief: 'Adds new cards to the board during a round.',
    detailed: 'When board growth triggers, new cards are added to the board. More cards means more possible SETs to find. Growth Seed weapons grant this effect.',
  },

  adjacent: {
    terms: ['adjacent', 'adjacent cards'],
    brief: 'Cards directly up, down, left, or right of a card.',
    detailed: 'Adjacent means the 4 cards in cardinal directions (not diagonals). Explosion and fire spread effects target adjacent cards. Corner cards have only 2 adjacent cards; edge cards have 3.',
  },

  // =============================================================================
  // WEAPON SYSTEM
  // =============================================================================

  cap: {
    terms: ['cap', 'capped', 'effect cap'],
    brief: 'Maximum percentage an effect can reach.',
    detailed: 'Effect caps prevent any single stat from becoming too dominant. For example, explosion chance caps at 40% by default. Mastery weapons can raise these caps, letting you push effects higher.',
  },

  luck: {
    terms: ['luck'],
    brief: 'Increases chance of finding Epic and Legendary weapons.',
    detailed: 'Each point of luck multiplies Epic and Legendary appearance rates by 1.1x. Stack luck to find rarer weapons in shops! Fortune\'s Eye grants +1 luck.',
  },

  maxHealth: {
    terms: ['max health', 'maximum health'],
    brief: 'The most health you can have.',
    detailed: 'Your health cannot exceed max health, even with healing. Life Vessel weapons increase max health and heal you. Starting max health is 3.',
  },

  maxHints: {
    terms: ['max hints', 'hint capacity', 'maximum hints'],
    brief: 'The most hints you can store.',
    detailed: 'When you gain a hint but are at max capacity, it\'s lost. Crystal Orb weapons increase your max hints. Starting max hints is 3.',
  },

  maxGraces: {
    terms: ['max graces', 'maximum graces'],
    brief: 'The most graces you can store.',
    detailed: 'When you gain a grace but are at max capacity, it\'s lost. Starting max graces is 5.',
  },

  // =============================================================================
  // RARITY
  // =============================================================================

  common: {
    terms: ['common'],
    brief: 'Most frequent weapon rarity with modest effects.',
    detailed: 'Common weapons appear most often in shops and level-up rewards. They provide smaller bonuses but are cheap and stack well. Good for building consistent effects.',
  },

  rare: {
    terms: ['rare'],
    brief: 'Uncommon weapons with stronger effects.',
    detailed: 'Rare weapons have roughly 3x the effect of common versions. They cost more but provide better value. Includes Mastery weapons that raise effect caps.',
  },

  epic: {
    terms: ['epic'],
    brief: 'Powerful weapons with bundled or hybrid effects.',
    detailed: 'Epic weapons combine multiple effects or include cap increases. They\'re expensive but provide unique combinations not possible with common/rare stacking.',
  },

  legendary: {
    terms: ['legendary'],
    brief: 'Rarest weapons with unique cross-system effects.',
    detailed: 'Legendary weapons create "bridge" effects that connect different systems - like gaining grace from explosions or firing lasers when using a grace. Very rare but game-changing.',
  },

  // =============================================================================
  // TRIGGERS
  // =============================================================================

  onMatch: {
    terms: ['on match', 'when you match', 'after matching', 'per match'],
    brief: 'Effect triggers each time you successfully match.',
    detailed: 'Many weapon effects have a percentage chance to trigger on each successful match. Effects like explosion, healing, coin drops, and time gains all roll their chances after you complete a match.',
  },

  // =============================================================================
  // ENEMY CARD STATES
  // =============================================================================

  unmatchable: {
    terms: ['unmatchable', 'dud', 'duds'],
    brief: 'A card that cannot be part of any valid SET.',
    detailed: 'Unmatchable (dud) cards take up board space but can never form a valid SET with other cards. They reduce your options and make finding matches harder. Some enemies spawn these to increase difficulty.',
  },

  faceDown: {
    terms: ['face-down', 'face down', 'flipped', 'hidden'],
    brief: 'A card whose attributes are hidden until revealed.',
    detailed: 'Face-down cards show only their back. Tap a face-down card to reveal its attributes. You cannot include unrevealed cards in a match - you must reveal them first to see what SET they could form.',
  },

  countdownCard: {
    terms: ['countdown', 'countdown card', 'ticking', 'ticking card'],
    brief: 'A card with a timer that must be matched before it expires.',
    detailed: 'Countdown cards display a timer. If the timer reaches zero before you match the card, you lose 1 health. Prioritize matching these cards to avoid damage! The countdown is visible on the card.',
  },

  bomb: {
    terms: ['bomb', 'bomb card', 'bombs'],
    brief: 'A card that explodes and damages you if not matched in time.',
    detailed: 'Bomb cards have a visible fuse timer. Match the bomb before it explodes to "defuse" it safely. If the timer runs out, you lose 1 health and the bomb is removed from the board.',
  },

  tripleHealth: {
    terms: ['triple-health', 'triple health', 'triple-health card', '3 matches to clear'],
    brief: 'A card that must be matched 3 times to remove from the board.',
    detailed: 'Triple-health cards are extra durable. Each time you include one in a valid match, it loses one "health" but stays on the board. After being matched 3 times total, it\'s finally removed. The card shows its remaining health.',
  },

  // =============================================================================
  // ENEMY PLAYER ACTIONS
  // =============================================================================

  invalidMatch: {
    terms: ['invalid match', 'invalid', 'wrong match'],
    brief: 'Selecting 3 cards that do NOT form a valid SET.',
    detailed: 'When you select 3 cards that aren\'t a valid SET, you lose 1 health (unless a grace saves you). The 3 cards are removed from the board and replaced. Some enemies punish invalid matches more severely with extra card removal or increased damage.',
  },

  streak: {
    terms: ['streak', 'match streak', 'consecutive'],
    brief: 'Making multiple valid matches in a row without mistakes.',
    detailed: 'A streak counts consecutive successful matches. It resets to zero if you make an invalid match. Some enemy defeat conditions require achieving a specific streak length (e.g., "Get a 5-match streak").',
  },

  defuse: {
    terms: ['defuse', 'defused', 'defusing'],
    brief: 'Successfully matching a bomb card before it explodes.',
    detailed: 'To defuse a bomb, include it in a valid SET match before its timer expires. This removes the bomb safely without taking damage. Some enemies require you to defuse multiple bombs to achieve their stretch goal.',
  },

  reveal: {
    terms: ['reveal', 'revealed', 'revealing'],
    brief: 'Tapping a face-down card to show its attributes.',
    detailed: 'Face-down cards must be revealed before you can use them in a match. Tap the card to flip it over and see its shape, color, and other attributes. Some enemies require you to include revealed cards in your matches.',
  },

  // =============================================================================
  // ENEMY BOARD EFFECTS
  // =============================================================================

  cardRemoval: {
    terms: ['card removal', 'removes card', 'cards removed', 'removed'],
    brief: 'Cards disappearing from the board without being matched.',
    detailed: 'Some enemies periodically remove random cards from your board, shrinking your options. Others remove extra cards when you make matches or invalid selections. If too many cards are removed, finding valid SETs becomes impossible.',
  },

  shuffle: {
    terms: ['shuffle', 'shuffles', 'shuffled', 'positions shuffled'],
    brief: 'Card positions on the board are randomly rearranged.',
    detailed: 'When the board shuffles, all cards swap to new random positions. The cards themselves don\'t change - just their locations. This can disrupt patterns you were tracking and force you to re-scan the board.',
  },

  attributeShift: {
    terms: ['attribute shift', 'attributes change', 'attributes shift', 'shift'],
    brief: 'Card attributes randomly change to different values.',
    detailed: 'Unlike shuffling, attribute shifts actually modify the cards themselves. A red card might become green, or a diamond might become an oval. This can break SETs you were planning and create new unexpected combinations.',
  },

  // =============================================================================
  // ENEMY TIME/RESOURCE EFFECTS
  // =============================================================================

  timeSteal: {
    terms: ['time stolen', 'stolen', 'lose time', 'loses time', '-s per match'],
    brief: 'Seconds removed from your timer when you make matches.',
    detailed: 'Some enemies steal time from you with each successful match. For example, "-5s per match" means every match costs 5 seconds from your remaining time. You must balance scoring points against the time cost.',
  },

  timerFaster: {
    terms: ['timer faster', 'faster', 'accelerated', 'runs faster', '% faster'],
    brief: 'The countdown timer moves more quickly than normal.',
    detailed: 'When the timer runs faster (e.g., "20% faster"), each real second costs more than 1 second on the clock. A 60-second round with 20% acceleration effectively gives you only 50 seconds of real time.',
  },

  inactivity: {
    terms: ['inactivity', 'inactive', 'inactivity penalty', 'instant death'],
    brief: 'Penalty for going too long without making a match.',
    detailed: 'Some enemies punish you if you don\'t match within a time window. Mild versions cost 1 health after extended delays. Severe versions cause instant death if you\'re inactive too long. Keep matching to avoid these penalties!',
  },

  scoreDecay: {
    terms: ['score decay', 'score drains', 'drains', 'points drain'],
    brief: 'Your score automatically decreases over time.',
    detailed: 'With score decay, your points constantly tick down (e.g., "1 point every 5 seconds"). You must earn points faster than they drain to reach the target score. Faster matching helps outpace the decay.',
  },

  damage: {
    terms: ['damage', '2x damage', 'double damage'],
    brief: 'Health lost when making mistakes.',
    detailed: 'Normally you lose 1 health per invalid match. Some enemies deal double damage (2 health lost per mistake). Combined with limited health, this makes every selection critical - one wrong move is twice as costly.',
  },

  // =============================================================================
  // ENEMY MATCH TYPES
  // =============================================================================

  allDifferent: {
    terms: ['all-different', 'all different'],
    brief: 'A match where each attribute has 3 different values.',
    detailed: 'An all-different match means for EVERY active attribute (shape, color, number, etc.), all 3 cards have DIFFERENT values. Example: red-diamond-1, green-oval-2, purple-squiggle-3. These are harder to spot but some enemies require them.',
  },

  allSame: {
    terms: ['all-same', 'all same', 'same color', 'same shape'],
    brief: 'A match where an attribute has the same value on all 3 cards.',
    detailed: 'An all-same match for an attribute means all 3 cards share that value. Example: 3 red cards (all-same color). Most matches have a mix of all-same and all-different attributes across the active attribute set.',
  },

  // =============================================================================
  // ENEMY WEAPON COUNTERS
  // =============================================================================

  weaponCounter: {
    terms: ['reduced', 'reduction', 'countered', '-35%', '-40%', '-50%', '-55%', '-60%'],
    brief: 'Enemy reduces the effectiveness of certain weapon types.',
    detailed: 'Some enemies counter specific weapon categories. For example, "Fire -35%" means all fire-related weapons work at only 65% effectiveness. Check enemy effects before choosing weapons - your build might be countered!',
  },

  weaponEffect: {
    terms: ['weapon effect', 'trigger', 'triggered'],
    brief: 'Any special ability from your equipped weapons activating.',
    detailed: 'Weapon effects include explosions, fire spread, lasers, healing, echo, ricochet, and more. Some enemy stretch goals require triggering specific numbers or types of weapon effects to achieve bonus rewards.',
  },

  destructionEffect: {
    terms: ['destruction', 'destruction effect'],
    brief: 'Any effect that removes cards from the board.',
    detailed: 'Destruction effects include explosions, lasers, fire burnout, and ricochet. These clear cards beyond your normal match, earning bonus points and coins. Some enemies require triggering destruction effects for their stretch goal.',
  },

  // =============================================================================
  // ENEMY DEFEAT CONDITIONS
  // =============================================================================

  stretchGoal: {
    terms: ['stretch goal', 'defeat condition', 'bonus objective'],
    brief: 'Optional challenge for bonus rewards when fighting an enemy.',
    detailed: 'Each enemy has a stretch goal - an extra challenge beyond just surviving. Complete it to earn a bonus weapon reward and extra coins. Stretch goals vary: some require streaks, others require no damage, special matches, or defusing bombs.',
  },

  targetScore: {
    terms: ['target', 'target score', 'score target', 'minimum'],
    brief: 'The number of points needed to complete the round.',
    detailed: 'Each round has a target score you must reach before time runs out. Match cards to earn points. Some enemies modify scoring with decay, bonuses, or higher targets. Reach the target to advance!',
  },

  cardsRemaining: {
    terms: ['cards remaining', 'remaining'],
    brief: 'How many cards are left on the board.',
    detailed: 'Some stretch goals require finishing with a minimum number of cards still on the board. Enemies that remove cards make this harder. Avoid triggering extra removal and match efficiently to preserve your board.',
  },
};

/**
 * Find all keywords in a text string.
 * Returns matches with their position and keyword ID.
 */
export interface KeywordMatch {
  keyword: string;      // The keyword ID from KEYWORDS
  term: string;         // The actual matched term
  start: number;        // Start index in text
  end: number;          // End index in text
}

/**
 * Find all keyword matches in a text string.
 * Matches whole words only, case-insensitive.
 * Returns matches sorted by position, non-overlapping.
 */
export const findKeywords = (text: string): KeywordMatch[] => {
  const matches: KeywordMatch[] = [];
  const lowerText = text.toLowerCase();

  for (const [keywordId, definition] of Object.entries(KEYWORDS)) {
    for (const term of definition.terms) {
      const lowerTerm = term.toLowerCase();
      let searchStart = 0;

      while (searchStart < lowerText.length) {
        const index = lowerText.indexOf(lowerTerm, searchStart);
        if (index === -1) break;

        // Check for whole word match
        const beforeChar = index > 0 ? lowerText[index - 1] : ' ';
        const afterChar = index + lowerTerm.length < lowerText.length
          ? lowerText[index + lowerTerm.length]
          : ' ';

        const isWordBoundaryBefore = !/[a-z0-9]/.test(beforeChar);
        const isWordBoundaryAfter = !/[a-z0-9]/.test(afterChar);

        if (isWordBoundaryBefore && isWordBoundaryAfter) {
          matches.push({
            keyword: keywordId,
            term: text.slice(index, index + lowerTerm.length), // Preserve original case
            start: index,
            end: index + lowerTerm.length,
          });
        }

        searchStart = index + 1;
      }
    }
  }

  // Sort by position and remove overlaps (keep first/longest)
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const nonOverlapping: KeywordMatch[] = [];
  let lastEnd = -1;

  for (const match of matches) {
    if (match.start >= lastEnd) {
      nonOverlapping.push(match);
      lastEnd = match.end;
    }
  }

  return nonOverlapping;
};

/**
 * Get a keyword definition by ID.
 */
export const getKeyword = (keywordId: string): KeywordDefinition | undefined => {
  return KEYWORDS[keywordId];
};
