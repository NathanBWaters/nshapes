/**
 * Mechanic registry — every level introduces exactly one of these (fighter
 * mechanics are introduced by fighter-trial side branches).
 * The intro card, map badge, field guide, and in-run coach marks are all
 * generated from this table.
 */
import type { MechanicDef } from '../types';

export const MECHANICS: Record<string, MechanicDef> = {
  // ── Rules ──────────────────────────────────────────────────────────────
  set_rule: {
    id: 'set_rule',
    kind: 'rule',
    title: 'The Set',
    tagline: 'Pick 3 cards. Each trait: all same or all different.',
    body: [
      'Tap three cards to make a Set.',
      'For every trait, the three cards must be ALL THE SAME or ALL DIFFERENT. For now the traits are shape and color.',
      'Every Set hits the foe. Make 5 Sets to win!',
    ],
    fightTips: [
      { title: 'Your foe', text: 'This is Dozy Bunny. The red bar is its health. Every Set you make knocks 3 off.', anchor: 'top' },
      { title: 'Your move', text: 'Tap three cards that make a Set. Check shape first, then color. You can tap a card again to put it back.', anchor: 'bottom' },
      { title: 'No pressure', text: 'You cannot lose this fight. A wrong guess just swaps those three cards for new ones. Fewer mistakes earn more stars.', anchor: 'top' },
    ],
    icon: 'lorc/crossed-swords',
    demo: {
      type: 'set',
      attributes: ['shape', 'color'],
      valid: true,
      caption: 'Shapes all different, colors all the same → Set!',
      cards: [
        { shape: 'diamond', color: 'red', number: 1, shading: 'solid' },
        { shape: 'oval', color: 'red', number: 1, shading: 'solid' },
        { shape: 'squiggle', color: 'red', number: 1, shading: 'solid' },
      ],
    },
    lessons: [
      {
        title: 'Every card has traits',
        body: ['Each card has a SHAPE (diamond, oval or squiggle) and a COLOR (red, green or purple).', 'You win fights by spotting three cards that go together.'],
        demo: {
          type: 'set', attributes: ['shape', 'color'], valid: true, caption: 'Three shapes, three colors',
          cards: [
          { shape: 'diamond', color: 'red', number: 1, shading: 'solid' },
          { shape: 'oval', color: 'green', number: 1, shading: 'solid' },
          { shape: 'squiggle', color: 'purple', number: 1, shading: 'solid' },
        ],
        },
      },
      {
        title: 'All the same is good',
        body: ['Check one trait at a time. Start with color.', 'Red, red, red. All three match, so color passes.'],
        demo: {
          type: 'set', attributes: ['shape', 'color'], valid: true, caption: 'Color: all the same ✓',
          cards: [
          { shape: 'diamond', color: 'red', number: 1, shading: 'solid' },
          { shape: 'oval', color: 'red', number: 1, shading: 'solid' },
          { shape: 'squiggle', color: 'red', number: 1, shading: 'solid' },
        ],
        },
      },
      {
        title: 'All different is good too',
        body: ['Now look at shape on the same three cards.', 'Diamond, oval, squiggle. No two match, so shape passes as well.', 'Both traits pass. That makes it a Set!'],
        demo: {
          type: 'set', attributes: ['shape', 'color'], valid: true, caption: 'Shape: all different ✓  Color: all the same ✓',
          cards: [
          { shape: 'diamond', color: 'red', number: 1, shading: 'solid' },
          { shape: 'oval', color: 'red', number: 1, shading: 'solid' },
          { shape: 'squiggle', color: 'red', number: 1, shading: 'solid' },
        ],
        },
      },
      {
        title: 'Two alike and one odd is NOT a Set',
        body: ['Here two cards are red and one is green.', 'Color is neither all the same nor all different, so this is not a Set. One bad trait spoils it.'],
        demo: {
          type: 'set', attributes: ['shape', 'color'], valid: false, caption: 'Color: red, red, green ✗',
          cards: [
          { shape: 'diamond', color: 'red', number: 1, shading: 'solid' },
          { shape: 'oval', color: 'red', number: 1, shading: 'solid' },
          { shape: 'squiggle', color: 'green', number: 1, shading: 'solid' },
        ],
        },
      },
    ],
    quiz: [
      {
        attributes: ['shape', 'color'],
        cards: [
          { shape: 'oval', color: 'green', number: 1, shading: 'solid' },
          { shape: 'oval', color: 'red', number: 1, shading: 'solid' },
          { shape: 'oval', color: 'purple', number: 1, shading: 'solid' },
        ],
        explain: 'Shape is all the same (ovals) and color is all different. Both traits pass.',
      },
      {
        attributes: ['shape', 'color'],
        cards: [
          { shape: 'diamond', color: 'purple', number: 1, shading: 'solid' },
          { shape: 'diamond', color: 'green', number: 1, shading: 'solid' },
          { shape: 'squiggle', color: 'purple', number: 1, shading: 'solid' },
        ],
        explain: 'Two diamonds and one squiggle: shape fails. Two purple and one green: color fails too.',
      },
      {
        attributes: ['shape', 'color'],
        cards: [
          { shape: 'squiggle', color: 'red', number: 1, shading: 'solid' },
          { shape: 'diamond', color: 'green', number: 1, shading: 'solid' },
          { shape: 'oval', color: 'purple', number: 1, shading: 'solid' },
        ],
        explain: 'Every shape is different and every color is different. Both traits pass.',
      },
    ],
  },
  hearts: {
    id: 'hearts',
    kind: 'feature',
    enables: 'hearts',
    title: 'Hearts',
    tagline: 'Wrong Sets cost a heart. Hearts are a resource too.',
    body: [
      'A wrong Set now costs you a heart. Run out and you lose the level.',
      'The three cards are still swapped out, so when you are stuck, a mistake shuffles in fresh cards. It just costs you.',
      'Orange Tabby fights better hurt: Scrappy adds +1 damage to every Set for each heart you are missing.',
    ],
    fightTips: [
      { title: 'Your hearts', text: 'These are your hearts. A wrong Set costs one. Lose them all and the fight is over.', anchor: 'top' },
      { title: 'One big hit', text: 'Third star: land ONE Set that deals 6. Tabby hits +1 harder per missing heart, so a heart or two down is a weapon.', anchor: 'top' },
    ],
    icon: 'lorc/shining-heart',
    demo: {
      type: 'set',
      attributes: ['shape', 'color'],
      valid: false,
      caption: 'Two reds and a green: colors are neither all same nor all different. −1 ♥',
      cards: [
        { shape: 'diamond', color: 'red', number: 1, shading: 'solid' },
        { shape: 'oval', color: 'red', number: 1, shading: 'solid' },
        { shape: 'squiggle', color: 'green', number: 1, shading: 'solid' },
      ],
    },
    coachMark: { on: 'hurt', text: 'Ouch! That wasn\'t a Set. Check each trait one at a time.' },
  },
  attr_number: {
    id: 'attr_number',
    kind: 'rule',
    title: 'New Trait: Number',
    tagline: 'Cards now show 1, 2 or 3 symbols.',
    body: [
      'Count the symbols! Number joins shape and color.',
      'All three traits must pass the rule: all same or all different.',
    ],
    icon: 'lorc/cycle',
    demo: {
      type: 'set',
      attributes: ['shape', 'color', 'number'],
      valid: true,
      caption: 'Shapes same, colors different, numbers 1-2-3 → Set!',
      cards: [
        { shape: 'oval', color: 'red', number: 1, shading: 'solid' },
        { shape: 'oval', color: 'green', number: 2, shading: 'solid' },
        { shape: 'oval', color: 'purple', number: 3, shading: 'solid' },
      ],
    },
    quiz: [
      {
        attributes: ['shape', 'color', 'number'],
        cards: [
          { shape: 'diamond', color: 'red', number: 2, shading: 'solid' },
          { shape: 'diamond', color: 'purple', number: 2, shading: 'solid' },
          { shape: 'diamond', color: 'green', number: 3, shading: 'solid' },
        ],
        explain: 'Shape and color pass, but the numbers are 2, 2 and 3. Two alike and one odd breaks the Set.',
      },
      {
        attributes: ['shape', 'color', 'number'],
        cards: [
          { shape: 'squiggle', color: 'purple', number: 1, shading: 'solid' },
          { shape: 'squiggle', color: 'purple', number: 2, shading: 'solid' },
          { shape: 'squiggle', color: 'purple', number: 3, shading: 'solid' },
        ],
        explain: 'Same shape, same color, and the numbers 1, 2, 3 are all different. All three traits pass.',
      },
    ],
  },
  skill_tree: {
    id: 'skill_tree',
    kind: 'feature',
    title: 'Skill Trees',
    tagline: 'Spend stars to grow your fighter.',
    body: [
      'Every fighter has two passives and a skill tree: two branches of 10 nodes, one growing from each passive.',
      'Stars are the currency. Buy nodes in order at Camp; deeper nodes cost more and change how you play. Refunds are free.',
      'Spending stars never locks a world: star gates count every star you have earned.',
    ],
    lessons: [
      {
        title: 'Build a big hit',
        body: ['Old Quillback has thick skin. The third star wants a single Set that deals 8 or more.', 'Try Tabby\'s Scrappy branch or Sly Fox\'s Combo branch, then come back swinging.'],
        demo: { type: 'icons', items: [{ icon: 'lorc/cat', label: 'Scrappy' }, { icon: 'caro-asercion/fox', label: 'Combo' }, { icon: 'lorc/fist', label: '9+ in one Set' }] },
      },
    ],
    fightTips: [
      { title: 'Hit hard once', text: 'Land a single Set that deals 8 or more. Scrappy, Combo and your skill nodes all stack.', anchor: 'top' },
    ],
    icon: 'lorc/tree-branch',
    demo: { type: 'icons', items: [{ icon: 'lorc/flat-star', label: 'Earn stars' }, { icon: 'lorc/tree-branch', label: 'Buy nodes' }, { icon: 'lorc/fist', label: 'Hit harder' }] },
  },
  power_cards: {
    id: 'power_cards',
    kind: 'feature',
    enables: 'power',
    title: 'Power Cards',
    tagline: 'Cards marked +2 hit harder.',
    body: [
      'Some cards now carry a +2 badge. Use one in a Set and that Set deals 2 extra damage.',
      'Greedy Squirrel only refills 2 cards per Set, so the board shrinks. Grab power cards while they last.',
      'Corgi loves these: its Fetch brings a fresh bonus card every time you match one.',
    ],
    fightTips: [
      { title: 'Power cards', text: 'Look for cards with a +2 badge in the corner. A Set that uses one hits for 2 more.', anchor: 'bottom' },
      { title: 'Bonus hunter', text: 'Match 5 power or gold cards for the third star.', anchor: 'top' },
    ],
    icon: 'lorc/fist',
    demo: {
      type: 'set',
      attributes: ['shape', 'color', 'number'],
      valid: true,
      caption: 'A Set with a power card: 3 + 2 = 5 damage',
      cards: [
        { shape: 'squiggle', color: 'purple', number: 1, shading: 'solid', modifiers: { bonusPoints: 2 } },
        { shape: 'squiggle', color: 'purple', number: 2, shading: 'solid' },
        { shape: 'squiggle', color: 'purple', number: 3, shading: 'solid' },
      ],
    },
  },
  charm: {
    id: 'charm',
    kind: 'feature',
    title: 'Charms',
    tagline: 'Equip up to 3 Armory weapons in every fight.',
    body: [
      'Weapons you unlock go into your Armory. Equip up to 3 as charms: they are your whole loadout.',
      'Pick charms on the screen before each fight. Mix different jobs: two weapon families together can arm an evolution.',
    ],
    icon: 'lorc/gems',
    demo: { type: 'icons', items: [{ icon: 'lorc/gems', label: 'Unlock' }, { icon: 'lorc/gear-hammer', label: 'Equip 3' }, { icon: 'lorc/crossed-swords', label: 'Fight' }] },
  },
  rainbow: {
    id: 'rainbow',
    kind: 'feature',
    enables: 'rainbow',
    title: 'Rainbow Strike',
    tagline: 'All-different Sets hit twice as hard.',
    body: [
      'A Set where EVERY trait is different is a Rainbow Strike, and it does double damage.',
      'This foe has more health than plain Sets can deal. Hunt for rainbows to knock it out!',
    ],
    fightTips: [
      { title: 'Hunt for rainbows', text: 'A Set where every trait is different hits twice as hard. Plain Sets alone will not finish this foe in time.', anchor: 'bottom' },
    ],
    icon: 'lorc/rainbow-star',
    demo: {
      type: 'set',
      attributes: ['shape', 'color', 'number'],
      valid: true,
      caption: 'Everything different → Rainbow Strike ×2',
      cards: [
        { shape: 'diamond', color: 'red', number: 1, shading: 'solid' },
        { shape: 'oval', color: 'green', number: 2, shading: 'solid' },
        { shape: 'squiggle', color: 'purple', number: 3, shading: 'solid' },
      ],
    },
    coachMark: { on: 'rainbow', text: 'RAINBOW STRIKE! Double damage!' },
  },
  time_bombs: {
    id: 'time_bombs',
    kind: 'rule',
    title: 'Time Bombs',
    tagline: 'Match the fused card before it blows.',
    body: [
      'Some new cards arrive with a lit fuse and a seconds counter. The fuse burns in real time, even without a clock.',
      'Use the bomb card in a Set before it hits 0 and it is defused. Let it blow and you lose a heart.',
    ],
    fightTips: [
      { title: 'Build around the bomb', text: 'Find a Set that INCLUDES the bomb card. Defuse 5 bombs for the third star.', anchor: 'bottom' },
    ],
    icon: 'lorc/time-bomb',
    demo: {
      type: 'set',
      attributes: ['shape', 'color', 'number'],
      valid: true,
      caption: 'Use the fused card in a Set to defuse it',
      cards: [
        { shape: 'diamond', color: 'green', number: 2, shading: 'solid', modifiers: { hasCountdown: true, countdownTimer: 9 } },
        { shape: 'oval', color: 'green', number: 2, shading: 'solid' },
        { shape: 'squiggle', color: 'green', number: 2, shading: 'solid' },
      ],
    },
  },
  coins: {
    id: 'coins',
    kind: 'feature',
    enables: 'coins',
    title: 'Coin Drops',
    tagline: 'Matched cards now drop coins.',
    body: [
      'From now on every matched card drops coins on top of your star rewards. Golden cards drop extra!',
      'Dropped coins are yours even when you lose. Spend them at Camp on permanent Workshop upgrades.',
      'Tougher foes pay more. Replaying levels is a good way to save up.',
    ],
    fightTips: [
      { title: 'Coin drops', text: 'Cards with a gold +3 badge drop extra coins when you match them. Your coin total is up here.', anchor: 'top' },
    ],
    icon: 'lorc/crown-coin',
    demo: {
      type: 'set',
      attributes: ['shape', 'color', 'number'],
      valid: true,
      caption: 'Golden cards pay +3 coins',
      cards: [
        { shape: 'diamond', color: 'green', number: 2, shading: 'solid', modifiers: { bonusMoney: 3 } },
        { shape: 'diamond', color: 'green', number: 1, shading: 'solid' },
        { shape: 'diamond', color: 'green', number: 3, shading: 'solid' },
      ],
    },
  },
  timer: {
    id: 'timer',
    kind: 'rule',
    title: 'The Clock',
    tagline: 'Survive until the clock runs out.',
    body: [
      'This level has a clock and no move limit.',
      'Survive until time runs out for ★. Knock out the foe before then for ★★.',
    ],
    fightTips: [
      { title: 'The clock', text: 'No move limit this time. Survive until the clock runs out for one star, or knock the foe out first for two.', anchor: 'top' },
    ],
    icon: 'lorc/stopwatch',
    demo: { type: 'icons', items: [{ icon: 'lorc/stopwatch', label: 'Survive = ★' }, { icon: 'lorc/crossed-swords', label: 'KO = ★★' }, { icon: 'lorc/flat-star', label: 'Challenge = ★★★' }] },
  },
  snares: {
    id: 'snares',
    kind: 'rule',
    title: 'Snares',
    tagline: 'Leave the snared card. Match the one it points at.',
    body: [
      'A snared card shows an arrow in its corner, pointing at a neighbour.',
      'Matching the snared card itself still scores, but costs a heart. Match the card its arrow points at instead to defuse the snare for +4 damage.',
    ],
    fightTips: [
      { title: 'Follow the arrow', text: 'An arrow in a card\'s corner? Leave that card alone and use the card it points at. Defuse 6 snares for the third star.', anchor: 'bottom' },
    ],
    icon: 'lorc/wolf-trap',
    demo: { type: 'icons', items: [{ icon: 'lorc/wolf-trap', label: 'Snared: −1 ♥' }, { icon: 'delapouite/plain-arrow', label: 'Points at…' }, { icon: 'lorc/flat-star', label: 'Defuse: +4' }] },
  },
  triple_card: {
    id: 'triple_card',
    kind: 'threat',
    title: 'Armored Card',
    tagline: 'One card takes 3 matches to break.',
    body: [
      'Iron Shell hides behind an armored card. It stays on the board until you\'ve used it in three Sets.',
      'Lasers and blasts chip off a plate too. Break the armor for the third star.',
    ],
    icon: 'lorc/turtle-shell',
    demo: {
      type: 'set',
      attributes: ['shape', 'color', 'number'],
      valid: true,
      caption: 'The armored card loses one plate per match',
      cards: [
        { shape: 'oval', color: 'purple', number: 3, shading: 'solid', modifiers: { health: 3 } },
        { shape: 'diamond', color: 'purple', number: 2, shading: 'solid' },
        { shape: 'squiggle', color: 'purple', number: 1, shading: 'solid' },
      ],
    },
    coachMark: { on: 'triple', text: 'Armored card! Use it in 3 Sets to break it.' },
  },
  hints: {
    id: 'hints',
    kind: 'feature',
    enables: 'hints',
    title: 'Hints',
    tagline: 'Stuck? Tap the bulb to reveal a Set.',
    body: [
      'You now carry hints. Tap the light bulb to reveal a Set on the board.',
      'Masked Bandit switches off auto-hints, so this time the bulb is all yours. Use it: the third star wants 3 hints spent.',
      'Seeker Lens and Crystal Orb keep you stocked.',
    ],
    fightTips: [
      { title: 'Hints', text: 'Tap the yellow bulb to light up a Set. Spend 3 hints in this fight for the third star, so press it!', anchor: 'top' },
    ],
    icon: 'lorc/light-bulb',
    demo: { type: 'icons', items: [{ icon: 'lorc/light-bulb', label: 'Reveal a Set' }, { icon: 'lorc/floating-crystal', label: 'Hold more' }] },
    coachMark: { on: 'hint', text: 'Those glowing cards make a Set. Tap them!' },
  },
  duds: {
    id: 'duds',
    kind: 'threat',
    title: 'Duds',
    tagline: 'Junk cards that can\'t be matched.',
    body: ['Junk Rat leaves duds on the board. Dud cards can\'t be used in Sets.', 'Blasts, fire and lasers clear them. Set off 4 explosions for the third star.'],
    fightTips: [{ title: 'Blow up the junk', text: 'Equip Blast Powder: every explosion clears junk and counts toward the third star (4).', anchor: 'bottom' }],
    icon: 'lorc/cross-mark',
    demo: {
      type: 'set', attributes: ['shape', 'color', 'number'], valid: false, caption: 'Dud cards can\'t be selected',
      cards: [
        { shape: 'oval', color: 'red', number: 1, shading: 'solid', modifiers: { isDud: true } },
        { shape: 'diamond', color: 'green', number: 2, shading: 'solid' },
        { shape: 'squiggle', color: 'purple', number: 3, shading: 'solid' },
      ],
    },
    coachMark: { on: 'dud', text: 'A dud appeared. It can\'t be matched, so ignore it.' },
  },
  face_down: {
    id: 'face_down',
    kind: 'threat',
    title: 'Face-Down Cards',
    tagline: 'Hidden cards flip when you make Sets.',
    body: ['Night Owl turns cards face-down. You can\'t pick them until they flip.', 'Each Set you make has a good chance to flip them back up.'],
    icon: 'caro-asercion/barn-owl',
    demo: {
      type: 'set', attributes: ['shape', 'color', 'number'], valid: false, caption: 'Make Sets to flip hidden cards',
      cards: [
        { shape: 'oval', color: 'red', number: 1, shading: 'solid', modifiers: { isFaceDown: true } },
        { shape: 'oval', color: 'red', number: 2, shading: 'solid' },
        { shape: 'oval', color: 'red', number: 3, shading: 'solid' },
      ],
    },
    coachMark: { on: 'face_down', text: 'Hidden cards! Make Sets to flip them back over.' },
  },
  graces: {
    id: 'graces',
    kind: 'feature',
    enables: 'graces',
    title: 'Graces',
    tagline: 'Off by one trait? A grace saves you.',
    body: [
      'If only ONE trait is wrong, that\'s a near miss. A grace counts it as a Set instead of costing a heart.',
      'Two or more wrong traits still hurt.',
      'While you hold graces, a bold guess is cheap. The third star wants 2 grace saves.',
    ],
    fightTips: [
      { title: 'Graces', text: 'The clover shows your graces. If only one trait is wrong, a grace turns the mistake into a Set. Save 2 for the third star.', anchor: 'top' },
    ],
    icon: 'lorc/clover',
    demo: {
      type: 'set', attributes: ['shape', 'color', 'number'], valid: false, caption: 'Only number is wrong → a grace saves you',
      cards: [
        { shape: 'oval', color: 'red', number: 1, shading: 'solid' },
        { shape: 'diamond', color: 'red', number: 1, shading: 'solid' },
        { shape: 'squiggle', color: 'red', number: 2, shading: 'solid' },
      ],
    },
    coachMark: { on: 'grace', text: 'Grace used! A near miss counted as a Set.' },
  },
  xp: {
    id: 'xp',
    kind: 'feature',
    enables: 'xp',
    title: 'Level Up',
    tagline: 'Fill the XP bar, then pick new gear mid-fight.',
    body: [
      'Matches fill your XP bar. When it fills, the action pauses and you pick 1 of 3 weapons from your Armory.',
      'Weapons you pick last for this level only. Winning more stars unlocks more weapons for the Armory.',
    ],
    fightTips: [
      { title: 'Level up', text: 'The blue bar fills as you match. When it is full, the fight pauses and you pick a weapon. Level up twice for the third star.', anchor: 'top' },
    ],
    icon: 'lorc/open-book',
    demo: { type: 'icons', items: [{ icon: 'lorc/flat-star', label: 'Fill XP' }, { icon: 'lorc/gems', label: 'Pick 1 of 3' }] },
    coachMark: { on: 'levelup', text: 'Level up! Pick a weapon for this fight.' },
  },
  arcana_slots: {
    id: 'arcana_slots',
    kind: 'feature',
    title: 'Arcana Slots',
    tagline: 'Stack two Arcana for a wilder fight.',
    body: [
      'You start with one Arcana slot. The Tarot Deck in the Workshop adds a second, then a third.',
      'Stacked Arcana combine: bonuses add up, multipliers multiply, and the harshest limit wins.',
      'Wicked Imp doubles every hit, both ways. Stack Arcana and land one Set of 15+ for the third star.',
    ],
    fightTips: [
      { title: 'One huge Set', text: 'Deal 15+ damage with a single Set for the third star. Rainbows under Prismatic Fever hit ×3.', anchor: 'top' },
    ],
    icon: 'lorc/crystal-wand',
    demo: { type: 'icons', items: [{ icon: 'lorc/crystal-wand', label: 'Slot 1' }, { icon: 'lorc/crystal-wand', label: 'Slot 2: Tarot' }, { icon: 'lorc/crossed-swords', label: 'Rules stack' }] },
  },
  countdown: {
    id: 'countdown',
    kind: 'threat',
    title: 'Countdown Card',
    tagline: 'Match it before it hits zero.',
    body: ['Ticking Viper plants a countdown card. Use it in a Set before the timer hits zero, or lose a heart.'],
    icon: 'lorc/stopwatch',
    demo: {
      type: 'set', attributes: ['shape', 'color', 'number'], valid: true, caption: 'Use it before the countdown ends',
      cards: [
        { shape: 'squiggle', color: 'green', number: 2, shading: 'solid', modifiers: { hasCountdown: true, countdownTimer: 9 } },
        { shape: 'squiggle', color: 'red', number: 2, shading: 'solid' },
        { shape: 'squiggle', color: 'purple', number: 2, shading: 'solid' },
      ],
    },
    coachMark: { on: 'countdown', text: 'Countdown card! Match it before it reaches zero.' },
  },
  shuffle: {
    id: 'shuffle',
    kind: 'threat',
    title: 'Shuffle',
    tagline: 'The board rearranges itself.',
    body: ['Wild Goose flaps around and shuffles where the cards sit every 30 seconds.', 'The cards themselves stay the same. Only their spots change.'],
    icon: 'lorc/swan',
    demo: { type: 'icons', items: [{ icon: 'lorc/cycle', label: 'Every 30s' }] },
    coachMark: { on: 'shuffle', text: 'Shuffled! Same cards, new spots.' },
  },
  bombs: {
    id: 'bombs',
    kind: 'threat',
    title: 'Bombs',
    tagline: 'Defuse a bomb by matching it.',
    body: ['Trap Weaver wires a bomb card. Match it before the fuse runs out, or it explodes and takes a heart.'],
    icon: 'lorc/time-bomb',
    demo: {
      type: 'set', attributes: ['shape', 'color', 'number'], valid: true, caption: 'Match the bomb to defuse it',
      cards: [
        { shape: 'diamond', color: 'purple', number: 1, shading: 'solid', modifiers: { hasBomb: true, bombTimer: 10 } },
        { shape: 'diamond', color: 'purple', number: 2, shading: 'solid' },
        { shape: 'diamond', color: 'purple', number: 3, shading: 'solid' },
      ],
    },
    coachMark: { on: 'bomb', text: 'Bomb! Use it in a Set to defuse it.' },
  },
  attr_shading: {
    id: 'attr_shading',
    kind: 'rule',
    title: 'New Trait: Shading',
    tagline: 'Solid, striped or empty.',
    body: ['Shading joins the rule: solid, striped, or open.', 'The board grows to 15 cards to keep Sets likely.'],
    icon: 'lorc/stone-block',
    demo: {
      type: 'set', attributes: ['shape', 'color', 'number', 'shading'], valid: true, caption: 'Shading: solid, striped, open → all different',
      cards: [
        { shape: 'oval', color: 'green', number: 2, shading: 'solid' },
        { shape: 'oval', color: 'green', number: 2, shading: 'striped' },
        { shape: 'oval', color: 'green', number: 2, shading: 'open' },
      ],
    },
    quiz: [
      {
        attributes: ['shape', 'color', 'number', 'shading'],
        cards: [
          { shape: 'diamond', color: 'red', number: 1, shading: 'solid' },
          { shape: 'oval', color: 'green', number: 2, shading: 'solid' },
          { shape: 'squiggle', color: 'purple', number: 3, shading: 'striped' },
        ],
        explain: 'Shape, color and number are all different, but shading is solid, solid, striped. That breaks it.',
      },
      {
        attributes: ['shape', 'color', 'number', 'shading'],
        cards: [
          { shape: 'diamond', color: 'red', number: 2, shading: 'striped' },
          { shape: 'diamond', color: 'green', number: 2, shading: 'striped' },
          { shape: 'diamond', color: 'purple', number: 2, shading: 'striped' },
        ],
        explain: 'Shape, number and shading are all the same, and color is all different. Every trait passes.',
      },
    ],
  },
  charm_slots: {
    id: 'charm_slots',
    kind: 'feature',
    title: 'Charm Slots',
    tagline: 'Three charms, three different jobs.',
    body: [
      'You carry 3 charm slots. The Charm Belt in the Workshop adds one per tier, up to 6.',
      'Goblin Saboteur halves three kinds of weapon at random, so never bring three of a kind. Give every slot a different job.',
      'Trigger 3 different weapon effects for the third star.',
    ],
    fightTips: [
      { title: 'Spread out', text: 'Blasts, fire, lasers, heals, coins, time: set off 3 different kinds to beat the Saboteur\'s challenge.', anchor: 'top' },
    ],
    icon: 'lorc/gems',
    demo: { type: 'icons', items: [{ icon: 'lorc/bright-explosion', label: 'Slot 1' }, { icon: 'lorc/shining-heart', label: 'Slot 2' }, { icon: 'lorc/laser-warning', label: 'Slot 3' }, { icon: 'lorc/gear-hammer', label: 'Belt: up to 6' }] },
  },
  waves: {
    id: 'waves',
    kind: 'rule',
    title: 'Waves',
    tagline: 'Several foes, one after another.',
    body: ['The ants come in waves. Beat one and the next marches in.', 'Open every wave with your biggest Set: Rally Horn adds damage to it. One Set of 10+ earns the third star.'],
    fightTips: [
      { title: 'Waves', text: 'This fight has three foes in a row. The clock keeps running between them.', anchor: 'top' },
    ],
    icon: 'delapouite/ant',
    demo: { type: 'icons', items: [{ icon: 'delapouite/ant', label: 'Wave 1' }, { icon: 'delapouite/ant', label: 'Wave 2' }, { icon: 'delapouite/ant', label: 'Wave 3' }] },
    coachMark: { on: 'wave', text: 'Next wave incoming!' },
  },
  shop: {
    id: 'shop',
    kind: 'feature',
    enables: 'shop',
    title: 'Shop',
    tagline: 'Spend coins between waves.',
    body: [
      'Between waves, a shop opens. Spend coins on weapons for the rest of this level.',
      'Or skip it and bank every coin for Camp. Grow stronger now or save for later. It\'s your call.',
      'This time, shop: buy 2 weapons for the third star.',
    ],
    icon: 'lorc/cash',
    demo: { type: 'icons', items: [{ icon: 'lorc/cash', label: 'Buy now' }, { icon: 'delapouite/coins-pile', label: 'or bank it' }] },
  },
  card_removal: {
    id: 'card_removal',
    kind: 'threat',
    title: 'Burrowing',
    tagline: 'Cards vanish from the board.',
    body: ['Burrowing Mole steals a card every 20 seconds and doesn\'t replace it. Fewer cards means fewer Sets, so work fast.'],
    icon: 'caro-asercion/mole',
    demo: { type: 'icons', items: [{ icon: 'caro-asercion/mole', label: '−1 card / 20s' }] },
    coachMark: { on: 'card_removed', text: 'A card was stolen! The board shrinks.' },
  },
  attr_shift: {
    id: 'attr_shift',
    kind: 'threat',
    title: 'Shifting Cards',
    tagline: 'Cards change a trait over time.',
    body: ['Shifting Chameleon changes one trait on random cards every 20 seconds.', 'The Set you spotted a moment ago might be gone. Grab Sets fast.'],
    icon: 'darkzaitzev/chameleon-glyph',
    demo: { type: 'icons', items: [{ icon: 'darkzaitzev/chameleon-glyph', label: 'Traits shift' }] },
    coachMark: { on: 'attr_shift', text: 'Cards shifted! Look again.' },
  },
  time_steal: {
    id: 'time_steal',
    kind: 'threat',
    title: 'Time Thief',
    tagline: 'Each match costs 5 seconds.',
    body: ['Thieving Raven takes 5 seconds off the clock every time you match. Make every Set count. Rainbows hit harder.'],
    icon: 'lorc/raven',
    demo: { type: 'icons', items: [{ icon: 'lorc/raven', label: '−5s / match' }] },
    coachMark: { on: 'time_stolen', text: 'The raven stole 5 seconds!' },
  },
  regen: {
    id: 'regen',
    kind: 'threat',
    title: 'Regeneration',
    tagline: 'The foe heals over time.',
    body: ['Circling Vulture heals 1 health every 10 seconds. Keep up the pressure!', 'Out-damage the healing with blasts: set off 6 explosions for the third star.'],
    icon: 'lorc/vulture',
    demo: { type: 'icons', items: [{ icon: 'lorc/heart-bottle', label: '+1 HP / 10s' }] },
    coachMark: { on: 'regen', text: 'The foe is healing. Keep the pressure on!' },
  },
  inactivity: {
    id: 'inactivity',
    kind: 'threat',
    title: 'Restless Foe',
    tagline: 'Dawdle and you get hit.',
    body: ['Charging Boar charges if you go 35 seconds without a match. Watch the bar under its portrait.'],
    icon: 'caro-asercion/boar',
    demo: { type: 'icons', items: [{ icon: 'lorc/stopwatch', label: '35s idle → −1 ♥' }] },
    coachMark: { on: 'inactivity', text: 'The boar charged! Keep matching to hold it off.' },
  },
  attr_background: {
    id: 'attr_background',
    kind: 'rule',
    title: 'New Trait: Background',
    tagline: 'The card itself has a color now.',
    body: ['The final trait: card background (white, beige, or charcoal).', 'All five traits must pass. The board grows to 18 cards.'],
    icon: 'lorc/crystal-shine',
    demo: {
      type: 'set', attributes: ['shape', 'color', 'number', 'shading', 'background'], valid: true, caption: 'Backgrounds: white, beige, charcoal',
      cards: [
        { shape: 'diamond', color: 'red', number: 1, shading: 'open', background: 'white' },
        { shape: 'diamond', color: 'red', number: 1, shading: 'open', background: 'beige' },
        { shape: 'diamond', color: 'red', number: 1, shading: 'open', background: 'charcoal' },
      ],
    },
    quiz: [
      {
        attributes: ['shape', 'color', 'number', 'shading', 'background'],
        cards: [
          { shape: 'oval', color: 'red', number: 3, shading: 'solid', background: 'white' },
          { shape: 'oval', color: 'purple', number: 3, shading: 'solid', background: 'white' },
          { shape: 'oval', color: 'green', number: 3, shading: 'solid', background: 'charcoal' },
        ],
        explain: 'Backgrounds are white, white and charcoal. Two alike and one odd breaks the Set.',
      },
    ],
  },
  fast_timer: {
    id: 'fast_timer',
    kind: 'threat',
    title: 'Hasty Clock',
    tagline: 'Time runs 20% faster.',
    body: ['Swift Bee makes the clock run 20% faster, but every Set hits 20% harder.'],
    icon: 'lorc/bee',
    demo: { type: 'icons', items: [{ icon: 'lorc/stopwatch', label: '×1.2 speed' }] },
  },
  double_damage: {
    id: 'double_damage',
    kind: 'threat',
    title: 'Glass Cannon',
    tagline: 'Mistakes hurt double. Sets hit double.',
    body: ['Stinging Scorpion raises the stakes. Mistakes cost 2 hearts, but every Set does double damage.'],
    icon: 'lorc/scorpion',
    demo: { type: 'icons', items: [{ icon: 'lorc/broken-heart', label: '×2 hurt' }, { icon: 'lorc/crossed-swords', label: '×2 hit' }] },
  },
  invalid_punish: {
    id: 'invalid_punish',
    kind: 'threat',
    title: 'Punishment',
    tagline: 'Mistakes also destroy 2 more cards.',
    body: ['Punishing Ermine takes 2 extra cards off the board after every mistake. They don\'t come back.'],
    icon: 'delapouite/ermine',
    demo: { type: 'icons', items: [{ icon: 'lorc/cross-mark', label: 'Mistake → −2 cards' }] },
  },
  final_boss: {
    id: 'final_boss',
    kind: 'threat',
    title: 'The Hydra',
    tagline: 'Three heads. Everything you\'ve learned, all at once.',
    body: ['Three heads, one after another: bombs, countdowns, hidden cards, time theft, and instant death if you stop matching. Both traps are back too.', 'Bring your best build. The third star wants a single hit of 20 or more.'],
    icon: 'lorc/hydra',
    demo: { type: 'icons', items: [{ icon: 'lorc/time-bomb', label: 'Bombs' }, { icon: 'caro-asercion/barn-owl', label: 'Hidden' }, { icon: 'lorc/stopwatch', label: 'Countdown' }] },
  },
  polar: {
    id: 'polar', kind: 'threat', title: 'Polar Guardian',
    tagline: 'Hits hurt double. Lasers fizzle.',
    body: ['Polar Guardian doubles damage both ways and weakens lasers by 40%.', 'Third star: win without losing a heart, and trigger at least one weapon effect.'],
    icon: 'sparker/bear-face',
    demo: { type: 'icons', items: [{ icon: 'lorc/broken-heart', label: '×2 hurt' }, { icon: 'lorc/laser-warning', label: 'Lasers −40%' }] },
  },
  one_eyed: {
    id: 'one_eyed', kind: 'threat', title: 'The Glare',
    tagline: 'No hints, shifting traits, ticking bombs.',
    body: ['One-Eyed Terror switches off hints and shifts traits on random cards every 12 seconds.', 'Pelican\'s Keen Eye still glows, and Rainbows still freeze. Land 3 Rainbows for the third star.'],
    icon: 'lorc/cyclops',
    demo: { type: 'icons', items: [{ icon: 'lorc/light-bulb', label: 'No hints' }, { icon: 'darkzaitzev/chameleon-glyph', label: 'Shifts' }] },
  },
  feral: {
    id: 'feral', kind: 'threat', title: 'Feral Fangs',
    tagline: 'Duds, armor and a shrinking board.',
    body: ['Feral Fangs drops duds, armors one card, and steals a card every 12 seconds. Snares cover the rest.', 'Break the armored card before 5 cards are gone for the third star.'],
    icon: 'lorc/bestial-fangs',
    demo: { type: 'icons', items: [{ icon: 'lorc/cross-mark', label: 'Duds' }, { icon: 'lorc/turtle-shell', label: 'Armor' }, { icon: 'caro-asercion/mole', label: '−1 card / 12s' }] },
  },
  kraken: {
    id: 'kraken', kind: 'threat', title: 'Drowned Gear',
    tagline: 'Every weapon works half as well.',
    body: ['Kraken\'s Grasp shuffles the board, steals cards, drops duds, and halves every weapon you carry.', 'Your passives, skill nodes and evolutions are untouched. Trigger 3 evolutions for the third star.'],
    icon: 'delapouite/kraken-tentacle',
    demo: { type: 'icons', items: [{ icon: 'lorc/gear-hammer', label: 'Weapons −50%' }, { icon: 'lorc/cycle', label: 'Shuffles' }, { icon: 'lorc/crystal-shine', label: 'Evolve ×3' }] },
  },
  world_eater: {
    id: 'world_eater', kind: 'threat', title: 'World Eater',
    tagline: 'The board is being eaten.',
    body: ['World Eater swallows 2 extra cards per Set and more every 10 seconds. The clock runs 50% faster, and 25 seconds without a Set ends the fight.', 'Grow the board, re-deal it, and keep defusing: 5 traps for the third star.'],
    icon: 'lorc/daemon-skull',
    demo: { type: 'icons', items: [{ icon: 'lorc/cross-mark', label: '−2 cards / Set' }, { icon: 'lorc/stopwatch', label: 'Fast clock' }, { icon: 'lorc/wolf-trap', label: 'Defuse ×5' }] },
  },
  porcupine: {
    id: 'porcupine', kind: 'threat', title: 'Needles',
    tagline: 'One wrong Set costs three cards.',
    body: ['Merciless Porcupine removes 3 cards on every mistake and doubles damage both ways. 35 seconds without a Set is a knockout.', 'Play clean and keep moving. No mistakes for the third star.'],
    icon: 'caro-asercion/porcupine',
    demo: { type: 'icons', items: [{ icon: 'lorc/cross-mark', label: 'Mistake: −3 cards' }, { icon: 'lorc/broken-heart', label: '×2 hurt' }, { icon: 'lorc/stopwatch', label: '35s idle = KO' }] },
  },

  // ── Elite branches (optional, tougher foes) ────────────────────────────
  elite: {
    id: 'elite', kind: 'threat', title: 'Elite Foe: Hoarder',
    tagline: 'Every Set you make costs you a card.',
    body: ['Elite foes sit on side paths. They are optional, much tougher, and guard better loot.', 'Hoarding Beaver takes one extra card each time you match, and another every 18 seconds. The board keeps shrinking.'],
    icon: 'delapouite/beaver',
    demo: { type: 'icons', items: [{ icon: 'lorc/daemon-skull', label: 'Elite' }, { icon: 'lorc/cross-mark', label: '−1 card / Set' }] },
  },
  sabotage: {
    id: 'sabotage', kind: 'threat', title: 'Sabotage',
    tagline: 'Your weapons work half as well.',
    body: ['Goblin Saboteur tampers with three kinds of weapon at random. Each works half as often in this fight.', 'Lean on plain Sets and your fighter\'s passives.'],
    icon: 'caro-asercion/goblin',
    demo: { type: 'icons', items: [{ icon: 'lorc/gear-hammer', label: '3 weapons −50%' }] },
  },
  double_armor: {
    id: 'double_armor', kind: 'threat', title: 'Double Armor',
    tagline: 'Two armored cards, and blasts barely work.',
    body: ['Stone Sentinel brings two armored cards. Each needs three Sets to break.', 'Explosions and lasers are much weaker here, so you have to break the armor by hand.'],
    icon: 'delapouite/golem-head',
    demo: { type: 'icons', items: [{ icon: 'lorc/turtle-shell', label: '2 armored' }, { icon: 'lorc/bright-explosion', label: 'Blasts −55%' }] },
  },
  instant_death: {
    id: 'instant_death', kind: 'threat', title: 'No Hesitation',
    tagline: 'Stop matching for 30 seconds and you are out.',
    body: ['Raging Bear ends the fight on the spot if you go 30 seconds without a Set.', 'Mistakes cost 2 hearts, your Sets hit twice as hard, and the bear heals over time.'],
    icon: 'sparker/bear-face',
    demo: { type: 'icons', items: [{ icon: 'lorc/stopwatch', label: '30s idle = KO' }, { icon: 'lorc/broken-heart', label: '×2 hurt' }] },
  },
  bomb_swarm: {
    id: 'bomb_swarm', kind: 'threat', title: 'Bomb Swarm',
    tagline: 'Bombs keep coming.',
    body: ['Elite foes sit on side paths. They are optional, much tougher, and guard better loot. Some lead to even harder elites.', 'Swarming Ants wire a bomb into about one in four new cards, and plant an 8-second countdown card. Defuse five bombs for the third star.'],
    icon: 'delapouite/ant',
    demo: { type: 'icons', items: [{ icon: 'lorc/time-bomb', label: 'Many bombs' }, { icon: 'lorc/stopwatch', label: '8s countdown' }] },
  },
  deep_dark: {
    id: 'deep_dark', kind: 'threat', title: 'The Deep',
    tagline: 'Hidden cards, shuffling, and a foe that heals.',
    body: ['Nightmare Squid hides a third of the cards, shuffles the board every 15 seconds, and heals as time passes.', 'Three things you have learned, all at once.'],
    icon: 'delapouite/giant-squid',
    demo: { type: 'icons', items: [{ icon: 'caro-asercion/barn-owl', label: 'Hidden' }, { icon: 'lorc/cycle', label: 'Shuffle' }, { icon: 'lorc/heart-bottle', label: 'Heals' }] },
  },
  dragon: {
    id: 'dragon', kind: 'threat', title: 'Ancient Dragon',
    tagline: 'Armor, shifting traits and a racing clock.',
    body: ['Two armored cards. Traits shift every 8 seconds. The clock runs 40% faster. Mistakes cost 2 hearts.', 'Come back with a deeper skill tree.'],
    icon: 'lorc/dragon-head',
    demo: { type: 'icons', items: [{ icon: 'lorc/turtle-shell', label: 'Armor' }, { icon: 'darkzaitzev/chameleon-glyph', label: 'Shifts' }, { icon: 'lorc/stopwatch', label: 'Fast clock' }] },
  },
  no_mercy: {
    id: 'no_mercy', kind: 'threat', title: 'No Mercy',
    tagline: 'No hints, weak graces, double damage.',
    body: ['The Reaper switches off hints, weakens grace and time weapons, and heals quickly.', 'Mistakes cost 2 hearts. Play clean or not at all.'],
    icon: 'lorc/grim-reaper',
    demo: { type: 'icons', items: [{ icon: 'lorc/light-bulb', label: 'No hints' }, { icon: 'lorc/broken-heart', label: '×2 hurt' }] },
  },
  cobra: {
    id: 'cobra', kind: 'threat', title: 'Viper Pit',
    tagline: 'Shifting traits, fused cards and snares.',
    body: ['Venomous Cobra shifts traits every 15 seconds and wires bomb timers onto random cards.', 'Snares cover the board too. Defuse 4 traps for the third star.'],
    icon: 'skoll/cobra',
    demo: { type: 'icons', items: [{ icon: 'darkzaitzev/chameleon-glyph', label: 'Shifts' }, { icon: 'lorc/time-bomb', label: 'Bombs' }, { icon: 'lorc/wolf-trap', label: 'Snares' }] },
  },
  savage: {
    id: 'savage', kind: 'threat', title: 'Savage Claws',
    tagline: 'A sprinting clock that bites every Set.',
    body: ['Savage Claws runs the clock 50% faster, takes 4 seconds per match, and plants bombs.', 'Few, huge Sets win here. Combo, Hot Streak and evolutions are your friends.'],
    icon: 'lorc/claw-slashes',
    demo: { type: 'icons', items: [{ icon: 'lorc/stopwatch', label: '×1.5 clock' }, { icon: 'lorc/hourglass', label: '−4s / Set' }, { icon: 'lorc/time-bomb', label: 'Bombs' }] },
  },
  abyss: {
    id: 'abyss', kind: 'threat', title: 'Ink Grotto',
    tagline: 'Hidden cards, shuffles and a short fuse.',
    body: ['Abyssal Octopus hides 30% of new cards, shuffles every 20 seconds, and plants a 10-second countdown card.', 'Match 5 face-down cards once they flip for the third star.'],
    icon: 'lorc/octopus',
    demo: { type: 'icons', items: [{ icon: 'caro-asercion/barn-owl', label: 'Hidden' }, { icon: 'lorc/cycle', label: 'Shuffle' }, { icon: 'lorc/stopwatch', label: '10s countdown' }] },
  },

  // ── Fighters (shown when a fighter is unlocked) ────────────────────────
  // Each fighter brings two passives (data/passives.ts) and a skill tree
  // (data/skillTrees.ts). Fighter trials (side branches) introduce them.
  fighter_healing: {
    id: 'fighter_healing', kind: 'fighter', title: 'Orange Tabby: Nine Lives & Scrappy',
    tagline: 'Low health is a weapon.',
    body: [
      'Nine Lives: once per fight, a knockout leaves you on 1 heart instead.',
      'Scrappy: every Set deals +1 damage for each heart you are missing.',
      'Skill tree: one branch heals into blasts and lasers, the other turns a 1-heart Tabby into a wrecking ball.',
    ],
    icon: 'lorc/cat',
    demo: { type: 'icons', items: [{ icon: 'lorc/broken-heart', label: '2 hearts down…' }, { icon: 'lorc/fist', label: '…+2 per Set' }, { icon: 'lorc/cat', label: 'Nine Lives' }] },
    coachMark: { on: 'nine_lives', text: 'Nine Lives! Tabby landed on its feet with 1 heart, and Scrappy makes every Set hit harder now.' },
  },
  fighter_fire: {
    id: 'fighter_fire', kind: 'fighter', title: 'Sly Fox: Combo & Hot Streak',
    tagline: 'Never stop moving.',
    body: [
      'Combo: a Set within 5 seconds of your last one adds a step, +1 damage each, up to +4. A mistake breaks it.',
      'Hot Streak: at max Combo, your next Set deals ×2.',
      'Skill tree: stretch the window and turn Combo into lasers and blasts, or keep Hot Streak burning for ×4 hits.',
    ],
    fightTips: [
      { title: 'Reach Combo 3', text: 'Make Sets less than 5 seconds apart. The wolf hates it. Hit Combo 3 for the third star.', anchor: 'top' },
    ],
    icon: 'caro-asercion/fox',
    demo: { type: 'icons', items: [{ icon: 'lorc/stopwatch', label: '< 5s apart' }, { icon: 'lorc/lightning-branches', label: 'Combo +1…+4' }, { icon: 'lorc/fireball', label: 'Hot Streak ×2' }] },
    coachMark: { on: 'combo', text: 'Combo! Keep matching within 5 seconds. At max Combo your next Set hits ×2.' },
  },
  fighter_grace: {
    id: 'fighter_grace', kind: 'fighter', title: 'Badger: Grudge & Thick Hide',
    tagline: 'Guessing is allowed. Even good.',
    body: [
      'Grudge: every mistake stores a grudge, up to 3. Your next Set releases +3 damage per grudge.',
      'Thick Hide: your first mistake each wave costs no heart.',
      'Skill tree: turn mistakes into lasers and free Sets, or make them almost free.',
    ],
    fightTips: [
      { title: 'Miss on purpose', text: 'Store grudges with wrong guesses, then release them in one Set of 12+ for the third star.', anchor: 'top' },
    ],
    icon: 'caro-asercion/badger',
    demo: { type: 'icons', items: [{ icon: 'lorc/cross-mark', label: 'Mistake' }, { icon: 'lorc/fist', label: '+3 per grudge' }, { icon: 'lorc/turtle-shell', label: '1st one free' }] },
    coachMark: { on: 'grudge', text: 'Grudge stored! Your next Set hits harder.' },
  },
  fighter_foresight: {
    id: 'fighter_foresight', kind: 'fighter', title: 'Emperor Penguin: Patience & Deep Freeze',
    tagline: 'Slow, deliberate, deadly.',
    body: [
      'Patience: a Set made 6 seconds or more after your last one deals +3.',
      'Deep Freeze: every Rainbow Strike freezes the clock and the foe for 4 seconds.',
      'Skill tree: make every patient Set a laser or a free Set, or turn Rainbows into Catalysts and 3×3 shatters.',
    ],
    fightTips: [
      { title: 'Hunt Rainbows', text: 'The hawk speeds up the clock, and every Rainbow Strike freezes it. Land 5 Rainbows for the third star.', anchor: 'top' },
    ],
    icon: 'delapouite/penguin',
    demo: { type: 'icons', items: [{ icon: 'lorc/hourglass', label: '6s+ wait: +3' }, { icon: 'lorc/rainbow-star', label: 'Rainbow' }, { icon: 'lorc/snowflake-1', label: 'Freeze 4s' }] },
    coachMark: { on: 'freeze', text: 'Deep Freeze! The clock and the foe stand still. Take your time.' },
  },
  fighter_growth: {
    id: 'fighter_growth', kind: 'fighter', title: 'Corgi: Zoomies & Fetch',
    tagline: 'Shape the board.',
    body: [
      'Zoomies: every 5th Set re-deals the board clean. Duds and hidden cards are gone.',
      'Fetch: matching a power or gold card brings a new one onto the board.',
      'Skill tree: grow huge boards that explode, or fetch bonus cards that power up everything.',
    ],
    fightTips: [
      { title: 'Keep fetching', text: 'Every power or gold card you match brings another. Match 8 for the third star.', anchor: 'bottom' },
    ],
    icon: 'delapouite/sitting-dog',
    demo: { type: 'icons', items: [{ icon: 'delapouite/jumping-dog', label: '5th Set: re-deal' }, { icon: 'lorc/fist', label: 'Match a +2…' }, { icon: 'delapouite/sitting-dog', label: '…fetch another' }] },
    coachMark: { on: 'redeal', text: 'Zoomies! A fresh, clean board.' },
  },
  fighter_oracle: {
    id: 'fighter_oracle', kind: 'fighter', title: 'Pelican: Big Scoop & Keen Eye',
    tagline: 'Let the board do the work.',
    body: [
      'Big Scoop: every 6th Set, Pelican scoops a free Set for you, damage and all.',
      'Keen Eye: after 8 seconds without a Set, one card of a Set glows. Free: no hint spent.',
      'Skill tree: scoop more and more free Sets, or turn every hint into damage.',
    ],
    fightTips: [
      { title: 'Free XP', text: 'Scooped Sets fill your XP bar too. Level up 3 times for the third star.', anchor: 'top' },
    ],
    icon: 'delapouite/eating-pelican',
    demo: { type: 'icons', items: [{ icon: 'lorc/checked-shield', label: '6th Set' }, { icon: 'delapouite/eating-pelican', label: 'Free Set' }, { icon: 'lorc/light-bulb', label: '8s: a card glows' }] },
    coachMark: { on: 'scoop', text: 'Big Scoop! Pelican grabbed a Set for you.' },
  },

  // ── Advanced Systems (Workshop, Purity, Evolutions, Arcana, Bounties) ──
  workshop: {
    id: 'workshop',
    kind: 'feature',
    title: 'The Workshop',
    tagline: 'Spend coins on permanent upgrades at Camp.',
    body: [
      'The Workshop at Camp is open! Spend coins on upgrades for mechanics you have met, and on your Armory weapons.',
      'Watch for the Charm Belt (more charm slots), the Tarot Deck (more Arcana slots) and the Evolution Lab (more Catalysts).',
      'Experiment freely: every Workshop upgrade can be refunded for 100% of its coins, anytime.',
    ],
    icon: 'lorc/gear-hammer',
    demo: {
      type: 'icons',
      items: [
        { icon: 'lorc/gear-hammer', label: 'Upgrade' },
        { icon: 'lorc/gems', label: 'More slots' },
        { icon: 'lorc/recycle', label: '100% Refund' },
      ],
    },
  },
  purity_chain: {
    id: 'purity_chain',
    kind: 'feature',
    enables: 'purity',
    title: 'Escalating Purity',
    tagline: 'Chain Sets with rising trait variety for escalating damage & gold.',
    body: [
      'Start with a simple Set (1 trait different), then follow with 2 traits different, then a full Rainbow Strike!',
      'Every step up the diversity ladder deals bonus damage and drops extra coins. Repeating or dropping diversity starts a fresh climb; mistakes break the chain.',
    ],
    fightTips: [
      { title: 'Climb the ladder', text: 'Match a simple 1-diff Set first, then a 2-diff Set, then a 3-diff Rainbow Strike for bonus damage and coins!', anchor: 'top' },
    ],
    icon: 'lorc/lightning-branches',
    demo: {
      type: 'icons',
      items: [
        { icon: 'lorc/stone-block', label: '1-Diff' },
        { icon: 'lorc/lightning-branches', label: '2-Diff (+dmg)' },
        { icon: 'lorc/rainbow-star', label: 'Rainbow (Max!)' },
      ],
    },
    coachMark: { on: 'purity', text: 'Escalating Purity! Each Set with more all-different traits hits harder and drops bonus coins.' },
  },
  evolutions: {
    id: 'evolutions',
    kind: 'feature',
    enables: 'evolutions',
    title: 'Evolutions',
    tagline: 'Two weapon families + a Catalyst card = 20 seconds of chaos.',
    body: [
      'A recipe fuses two weapon families. Equip a charm from each and the recipe is ARMED.',
      'While a recipe is armed, a glowing Catalyst card can turn up on the board. Match it in any Set and the evolution runs for 20 seconds: new rules, plus +1 damage on every Set.',
      'Up to 3 evolutions per fight. Your first recipe, Phoenix Pyre, fuses Blast Powder and Mending Charm.',
    ],
    lessons: [
      {
        title: 'Arm the recipe',
        body: ['Before the fight, equip Blast Powder and Mending Charm as charms.', 'Holding both families arms Phoenix Pyre. The fight preview shows it lit up.'],
        demo: {
          type: 'icons',
          items: [
            { icon: 'lorc/bright-explosion', label: 'Blast Powder' },
            { icon: 'lorc/shining-heart', label: 'Mending Charm' },
            { icon: 'lorc/fireball', label: 'Phoenix Pyre' },
          ],
        },
      },
      {
        title: 'Match the Catalyst',
        body: ['Armed recipes make a Catalyst card appear on refills, one at a time.', 'Match it in ANY valid Set. There is nothing to wait for and nothing to lose: the sooner, the better.'],
        demo: {
          type: 'set',
          attributes: ['shape', 'color', 'number'],
          valid: true,
          caption: 'A Set with the Catalyst starts the evolution',
          cards: [
            { shape: 'oval', color: 'red', number: 1, shading: 'solid', modifiers: { hasEvolutionItem: true, evolutionReady: true } },
            { shape: 'oval', color: 'green', number: 2, shading: 'solid' },
            { shape: 'oval', color: 'purple', number: 3, shading: 'solid' },
          ],
        },
      },
      {
        title: '20 seconds of fire',
        body: ['Phoenix Pyre: every heal OR lost heart blasts a 3×2 block, and Sets heal 1 on a 25% roll.', 'So while it runs, getting hit is good. A ring counts down the seconds you have left.'],
      },
    ],
    fightTips: [
      { title: 'Watch for the Catalyst', text: 'With Blast Powder and Mending Charm equipped, a glowing Catalyst card turns up. Match it in any Set to evolve!', anchor: 'bottom' },
      { title: 'Evolve three times', text: 'Trigger 3 evolutions in this fight for the third star.', anchor: 'top' },
    ],
    icon: 'lorc/crystal-shine',
    demo: {
      type: 'icons',
      items: [
        { icon: 'lorc/gems', label: 'Equip 2 families' },
        { icon: 'lorc/crystal-shine', label: 'Match the Catalyst' },
        { icon: 'lorc/fireball', label: '20s of power' },
      ],
    },
    coachMark: { on: 'catalyst_spawn', text: 'A Catalyst! Match it in any Set to evolve for 20 seconds.' },
  },
  arcana_cards: {
    id: 'arcana_cards',
    kind: 'feature',
    title: 'Arcana Wildcards',
    tagline: 'Kiss-curse tarot cards that twist the rules of a fight.',
    body: [
      'Arcana cards bend the rules of a fight — turning simple Sets into boulders, igniting cards on mistakes, or tripling Rainbow Strikes.',
      'Every upside comes with a tradeoff. You start with one Arcana slot; the Tarot Deck in the Workshop adds more. Swap them anytime at Camp or before a fight.',
    ],
    icon: 'lorc/crystal-wand',
    demo: {
      type: 'icons',
      items: [
        { icon: 'lorc/crystal-wand', label: 'Pick 1 Arcana' },
        { icon: 'lorc/crossed-swords', label: 'Twist Rules' },
      ],
    },
  },
  bounty_board: {
    id: 'bounty_board',
    kind: 'feature',
    title: 'Bounty Board',
    tagline: 'Cross-run feats that pay out even when you lose.',
    body: [
      'Every Set, Rainbow Strike, Purity combo, and Evolution counts toward lifetime Bounties across all runs.',
      'Claim coins, rare Armory weapons, and new Arcana wildcards from the Bounty Board on the map.',
    ],
    icon: 'lorc/trophy',
    demo: {
      type: 'icons',
      items: [
        { icon: 'lorc/archery-target', label: 'Play Runs' },
        { icon: 'lorc/trophy', label: 'Finish Feats' },
        { icon: 'lorc/crown-coin', label: 'Win Loot' },
      ],
    },
  },
};

/**
 * @deprecated Old key for the evolutions lesson; the same entry as `evolutions`.
 * Not enumerable, so lists built from MECHANICS show it once.
 */
Object.defineProperty(MECHANICS, 'weapon_evolutions', { value: MECHANICS.evolutions, enumerable: false });

export const getMechanic = (id: string): MechanicDef => {
  const m = MECHANICS[id];
  if (!m) throw new Error(`Unknown mechanic: ${id}`);
  return m;
};
