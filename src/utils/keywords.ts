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
    brief: 'Cards on fire are destroyed after 7.5 seconds.',
    detailed: 'Burning cards have a flame effect and are automatically destroyed after 7.5 seconds, awarding +1 point and +1 coin. When a card burns out, fire has a 10% chance to spread to adjacent cards.',
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
    terms: ['on match', 'when you match', 'after matching'],
    brief: 'Effect triggers each time you successfully match.',
    detailed: 'Many weapon effects have a percentage chance to trigger on each successful match. Effects like explosion, healing, coin drops, and time gains all roll their chances after you complete a match.',
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
