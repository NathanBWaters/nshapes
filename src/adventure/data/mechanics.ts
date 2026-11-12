/**
 * Mechanic registry — every level introduces exactly one of these.
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
    tagline: 'Wrong Sets cost a heart.',
    body: [
      'A wrong Set now costs you a heart. Run out and you lose the level.',
      'The three cards are still swapped out, so when you are stuck, a mistake shuffles in fresh cards. It just costs you.',
    ],
    fightTips: [
      { title: 'Your hearts', text: 'These are your hearts. A wrong Set costs one. Lose them all and the fight is over.', anchor: 'top' },
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
  power_cards: {
    id: 'power_cards',
    kind: 'feature',
    enables: 'power',
    title: 'Power Cards',
    tagline: 'Cards marked +2 hit harder.',
    body: [
      'Some cards now carry a +2 badge. Use one in a Set and that Set deals 2 extra damage.',
      'Building your Sets around power cards is how you beat tougher foes with moves to spare.',
    ],
    fightTips: [
      { title: 'Power cards', text: 'Look for cards with a +2 badge in the corner. A Set that uses one hits for 2 more.', anchor: 'bottom' },
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
    title: 'Charm Slot',
    tagline: 'Equip one unlocked weapon in every fight.',
    body: [
      'Weapons you unlock go into your Armory. You can equip ONE as a charm, on top of the gear your fighter already carries.',
      'Change your charm on the screen before each fight. Different foes call for different charms.',
    ],
    icon: 'lorc/gems',
    demo: { type: 'icons', items: [{ icon: 'lorc/gems', label: 'Unlock' }, { icon: 'lorc/gear-hammer', label: 'Equip 1' }, { icon: 'lorc/crossed-swords', label: 'Fight' }] },
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
  coins: {
    id: 'coins',
    kind: 'feature',
    enables: 'coins',
    title: 'Coin Drops',
    tagline: 'Matched cards now drop coins.',
    body: [
      'From now on every matched card drops coins on top of your star rewards. Golden cards drop extra!',
      'Dropped coins are yours even when you lose. Spend them at Camp to level up fighters and buy permanent upgrades.',
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
  triple_card: {
    id: 'triple_card',
    kind: 'threat',
    title: 'Armored Card',
    tagline: 'One card takes 3 matches to break.',
    body: [
      'Iron Shell hides behind an armored card. It stays on the board until you\'ve used it in three Sets.',
      'Break the armor for the third star.',
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
      'Hints are limited, so save them for when you\'re truly stuck. Some gear refills them.',
    ],
    fightTips: [
      { title: 'Hints', text: 'Stuck? Tap the yellow bulb to light up a Set. The number shows how many hints you have left.', anchor: 'top' },
    ],
    icon: 'lorc/light-bulb',
    demo: { type: 'icons', items: [{ icon: 'lorc/light-bulb', label: 'Reveal a Set' }, { icon: 'lorc/floating-crystal', label: 'Hold more' }] },
  },
  duds: {
    id: 'duds',
    kind: 'threat',
    title: 'Duds',
    tagline: 'Junk cards that can\'t be matched.',
    body: ['Junk Rat leaves duds on the board. Dud cards can\'t be used in Sets.', 'Work around them. They get cleared when blasts, fire or lasers hit them.'],
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
    ],
    fightTips: [
      { title: 'Graces', text: 'The clover shows your graces. If only one trait is wrong, a grace turns the mistake into a Set.', anchor: 'top' },
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
      { title: 'Level up', text: 'The blue bar fills as you match. When it is full, the fight pauses and you pick a weapon.', anchor: 'top' },
    ],
    icon: 'lorc/open-book',
    demo: { type: 'icons', items: [{ icon: 'lorc/flat-star', label: 'Fill XP' }, { icon: 'lorc/gems', label: 'Pick 1 of 3' }] },
    coachMark: { on: 'levelup', text: 'Level up! Pick a weapon for this fight.' },
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
  waves: {
    id: 'waves',
    kind: 'rule',
    title: 'Waves',
    tagline: 'Several foes, one after another.',
    body: ['The ants come in waves. Beat one and the next marches in.', 'Knock out every wave for ★★.'],
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
    body: ['Circling Vulture heals 1 health every 10 seconds. Keep up the pressure!'],
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
    tagline: 'Everything you\'ve learned, all at once.',
    body: ['Bombs, countdowns, hidden cards, time theft, and instant death if you stop matching.', 'Everything you\'ve learned leads here.'],
    icon: 'lorc/hydra',
    demo: { type: 'icons', items: [{ icon: 'lorc/time-bomb', label: 'Bombs' }, { icon: 'caro-asercion/barn-owl', label: 'Hidden' }, { icon: 'lorc/stopwatch', label: 'Countdown' }] },
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
    body: ['Goblin Saboteur tampers with three kinds of weapon at random. Each works half as often in this fight.', 'Lean on plain Sets and your fighter ability.'],
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
    body: ['Swarming Ants wire a bomb into about one in four new cards, and plant an 8-second countdown card.', 'Defuse five bombs for the third star.'],
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
    body: ['Two armored cards. Traits shift every 8 seconds. The clock runs 40% faster. Mistakes cost 2 hearts.', 'Come back with a levelled fighter.'],
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

  // ── Fighters (shown when a fighter is unlocked) ────────────────────────
  // Each fighter brings a NEW rule (src/adventure/data/abilities.ts) plus
  // themed starting gear.
  fighter_healing: {
    id: 'fighter_healing', kind: 'fighter', title: 'Orange Tabby: Nine Lives',
    tagline: 'Once per fight, a knockout leaves you on 1 heart.',
    body: [
      'Ability, passive: the first time you would run out of hearts, Tabby lands on its feet with 1 heart left.',
      'Gear: Mending Charm heals on match, and Life Vessel adds a heart.',
    ],
    icon: 'lorc/cat',
    demo: { type: 'icons', items: [{ icon: 'lorc/broken-heart', label: '0 hearts…' }, { icon: 'lorc/cat', label: '…Nine Lives!' }, { icon: 'lorc/shining-heart', label: 'Back on 1' }] },
    coachMark: { on: 'nine_lives', text: 'Nine Lives! Tabby landed on its feet with 1 heart.' },
  },
  fighter_fire: {
    id: 'fighter_fire', kind: 'fighter', title: 'Sly Fox: Combo',
    tagline: 'Fast Sets chain into a combo for bonus damage.',
    body: [
      'Ability, passive: a Set within 5 seconds of your last one adds +1 combo, which is +1 damage per step, up to +4. A mistake or a pause breaks it.',
      'Gear: Flint Spark sets cards on fire, and Blast Powder explodes neighbours.',
    ],
    icon: 'caro-asercion/fox',
    demo: { type: 'icons', items: [{ icon: 'lorc/stopwatch', label: '< 5s apart' }, { icon: 'lorc/lightning-branches', label: 'Combo +1…+4' }] },
    coachMark: { on: 'combo', text: 'Combo! Keep matching within 5 seconds for more damage.' },
  },
  fighter_grace: {
    id: 'fighter_grace', kind: 'fighter', title: 'Badger: Grudge',
    tagline: 'Mistakes make Badger angry, and angry hits hard.',
    body: [
      'Ability, passive: every mistake stores a grudge, up to 3. Your next Set deals +3 damage per grudge.',
      'Gear: Second Chance gives starting graces, and Fortune Token earns more.',
      'A sacrifice play, swapping in 3 new cards for a heart, now pays you back.',
    ],
    icon: 'caro-asercion/badger',
    demo: { type: 'icons', items: [{ icon: 'lorc/cross-mark', label: 'Mistake' }, { icon: 'lorc/fist', label: '+3 next hit' }] },
    coachMark: { on: 'grudge', text: 'Grudge stored! Your next Set hits harder.' },
  },
  fighter_foresight: {
    id: 'fighter_foresight', kind: 'fighter', title: 'Emperor Penguin: Deep Freeze',
    tagline: 'Charge it, then freeze time.',
    body: [
      'Ability, active: every Set charges the button. At 4 charges, tap it to freeze the clock and the foe for 6 seconds. Bombs, countdowns and regeneration all stop.',
      'Gear: Crystal Orb holds more hints, and Seeker Lens earns them.',
    ],
    icon: 'delapouite/penguin',
    demo: { type: 'icons', items: [{ icon: 'lorc/checked-shield', label: '4 Sets' }, { icon: 'lorc/snowflake-1', label: 'Freeze 6s' }] },
  },
  fighter_growth: {
    id: 'fighter_growth', kind: 'fighter', title: 'Corgi: Zoomies',
    tagline: 'Charge it, then re-deal the whole board.',
    body: [
      'Ability, active: after 3 Sets, tap to zoom around and re-deal every card. Duds and hidden cards are cleared, and the new board always has a Set.',
      'Gear: Field Stone gives a bigger board, and Growth Seed grows it.',
    ],
    icon: 'delapouite/sitting-dog',
    demo: { type: 'icons', items: [{ icon: 'lorc/checked-shield', label: '3 Sets' }, { icon: 'delapouite/jumping-dog', label: 'Fresh board' }] },
  },
  fighter_oracle: {
    id: 'fighter_oracle', kind: 'fighter', title: 'Pelican: Big Scoop',
    tagline: 'Charge it, then scoop up a Set automatically.',
    body: [
      'Ability, active: after 4 Sets, tap to have Pelican find and match a Set for you, damage and all.',
      'Gear: two Oracle Eyes flash part of a Set when you stall. A lifesaver with five traits.',
    ],
    icon: 'delapouite/eating-pelican',
    demo: { type: 'icons', items: [{ icon: 'lorc/checked-shield', label: '4 Sets' }, { icon: 'delapouite/eating-pelican', label: 'Free Set' }] },
  },

  // ── Advanced Systems (Workshop, Purity, Evolutions, Arcana, Bounties) ──
  workshop: {
    id: 'workshop',
    kind: 'feature',
    title: 'The Workshop',
    tagline: 'Spend coins to upgrade unlocked mechanics and Armory weapons.',
    body: [
      'The Workshop at Camp is now open! You can enhance any mechanic or Armory weapon you have actually unlocked.',
      'Experiment freely — every Workshop and Fighter upgrade can be refunded for 100% of your coins anytime.',
    ],
    icon: 'lorc/gear-hammer',
    demo: {
      type: 'icons',
      items: [
        { icon: 'lorc/gear-hammer', label: 'Upgrade Stats' },
        { icon: 'lorc/gems', label: 'Boost Weapons' },
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
  weapon_evolutions: {
    id: 'weapon_evolutions',
    kind: 'feature',
    title: 'Weapon Combos',
    tagline: 'Prime a weapon combo, then match on the hidden Catalyst card.',
    body: [
      'At most ONE card on the board hides a shimmering Evolution Catalyst behind its shapes.',
      'Hold off on matching that card until your weapon recipe says EVO READY! Matching a Catalyst card too early shatters it for the wave.',
      'Check the Recipe Guide in the Field Guide to track every unlocked combo.',
    ],
    lessons: [
      {
        title: 'Do NOT match a dormant Catalyst early!',
        body: [
          'Only ONE Evolution Catalyst can appear on screen at a time, marked by a faint crystal behind a card.',
          'While its badge is purple, your combo is NOT primed yet. If you match a Set containing that card too early, the Catalyst shatters and is lost!',
        ],
        demo: {
          type: 'set',
          attributes: ['shape', 'color', 'number'],
          valid: false,
          caption: 'Dormant purple Catalyst: matching too early loses it!',
          cards: [
            { shape: 'diamond', color: 'red', number: 1, shading: 'solid', modifiers: { hasEvolutionItem: true, evolutionReady: false } },
            { shape: 'diamond', color: 'red', number: 2, shading: 'solid' },
            { shape: 'diamond', color: 'red', number: 3, shading: 'solid' },
          ],
        },
      },
      {
        title: 'Wait for gold EVO, then strike!',
        body: [
          'Bring the combo\'s required weapons and complete its in-fight condition on other cards first.',
          'Once primed, the Catalyst card glows gold with EVO — match a valid Set containing it to forge your Legendary weapon!',
        ],
        demo: {
          type: 'set',
          attributes: ['shape', 'color', 'number'],
          valid: true,
          caption: 'Gold EVO Catalyst: match a Set with it to evolve!',
          cards: [
            { shape: 'oval', color: 'red', number: 1, shading: 'solid', modifiers: { hasEvolutionItem: true, evolutionReady: true } },
            { shape: 'oval', color: 'green', number: 2, shading: 'solid' },
            { shape: 'oval', color: 'purple', number: 3, shading: 'solid' },
          ],
        },
      },
    ],
    icon: 'lorc/crystal-shine',
    demo: {
      type: 'icons',
      items: [
        { icon: 'lorc/gems', label: 'Pair Gear' },
        { icon: 'lorc/crystal-shine', label: 'Prime Catalyst' },
        { icon: 'lorc/fireball', label: 'Evolve!' },
      ],
    },
    coachMark: { on: 'catalyst_spawn', text: 'Hidden Catalyst spotted! Wait until your recipe says EVO READY before matching that card, or it is lost!' },
  },
  arcana_cards: {
    id: 'arcana_cards',
    kind: 'feature',
    title: 'Arcana Wildcards',
    tagline: 'Equip one kiss-curse tarot rule twist before a fight.',
    body: [
      'Arcana cards bend the rules of a fight — turning simple Sets into boulders, igniting cards on mistakes, or tripling Rainbow Strikes.',
      'Every upside comes with a tradeoff, and you can toggle your Arcana on or off anytime at Camp or before a fight.',
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

export const getMechanic = (id: string): MechanicDef => {
  const m = MECHANICS[id];
  if (!m) throw new Error(`Unknown mechanic: ${id}`);
  return m;
};
