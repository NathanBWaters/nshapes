/**
 * The shots: every animation the motion loop can capture, by name.
 *
 * A shot says how to get to a moment in the running game and what starts it:
 *
 *   path      route to open (dev routes can jump anywhere: see Claude.md "Dev Testing")
 *   ready     (page, h) => wait until the screen is there: `h.until('test-id')`
 *   prepare   optional: click through to the state just before the moment: `h.go('test-id')` waits, then taps
 *   trigger   the tap (or other act) that starts the animation; frame 0 is taken right after it: `h.tap('test-id')`
 *   clip      optional: a selector or box to capture instead of the whole phone screen
 *   frames    optional: a fixed number of frames (default: until the picture has been still for a while)
 *   actions   optional: [{ at: frame, do: page => … }] things to do part-way (dismiss a cut-in)
 *   track     optional: extra selectors to measure (elements moved by inline transform / opacity are found automatically)
 *   loop      optional: { frames: N } for an endless loop of N frames: frame N is compared with frame 0
 *
 * The page's clock is virtual and stands still unless the capture moves it, so
 * never wait with Playwright's own waits (`waitFor`, `waitForTimeout`): a
 * screen that needs a timer to appear would never come. Use the helpers:
 *
 *   h.until(target)   advance time 16 ms at a time until the test id / selector / async fn is there
 *   h.tap(target)     click a test id or selector
 *   h.go(target)      until + tap
 *   h.advance(ms)     move time by hand
 *   h.evaluate(fn)    run something in the page (e.g. read window.__nshapesRun)
 *
 * Add a shot here whenever you work on an animation that has none. A shot is
 * the animation's test: it is how the next agent sees what you saw.
 */

/** The effects studio (/dev/fx): one chip per fight event, on a stand-in fight screen. */
const studio = (id, chip, about, extra = {}) => ({
  id,
  about,
  path: '/dev/fx',
  ready: (page, h) => h.until('fx-event-hit'),
  clip: 'fx-stage',
  trigger: (page, h) => h.tap(chip),
  ...extra,
});

/** Tap anywhere on the cut-in to continue, once it has had time to play */
const dismissCutIn = at => ({ at, do: page => page.mouse.click(195, 300) });

/** The map with a given save: `before:1-5` makes 1-5 the next level, `maxed` opens everything, `fresh` is a new player. */
const mapPath = save => `/dev/adventure?save=${save}&intro=false`;

/** From the map into the level preview (the next level, or a named one) */
const openPreview = async (h, level) => {
  await h.until('map-play-next');
  await h.go(level ? `map-node-${level}` : 'map-play-next');
  await h.until('preview-play');
};

/** From the map into a fight, past the FIGHT! banner and the foe's taunt, to a board that is waiting for a tap */
const intoFight = async (page, h, level) => {
  await openPreview(h, level);
  await h.advance(480);
  await h.tap('preview-play');
  await h.until('run-foe-hp');
  await h.until(async () => !(await h.present('run-opening')));
  await h.advance(2800);
};

/** Slots of three cards on the board that are a Set (or are not one), read from the fight's own state */
const findCards = (page, wantSet) =>
  page.evaluate(want => {
    const run = window.__nshapesRun;
    if (!run || !run.board) return null;
    const { board, attributes } = run;
    const isSet = (a, b, c) => attributes.every(k => new Set([a[k], b[k], c[k]]).size !== 2);
    for (let i = 0; i < board.length; i++)
      for (let j = i + 1; j < board.length; j++)
        for (let k = j + 1; k < board.length; k++) {
          if (!board[i] || !board[j] || !board[k]) continue;
          if (isSet(board[i], board[j], board[k]) === want) return [i, j, k];
        }
    return null;
  }, wantSet);
const slotOf = index => `card-slot-${Math.floor(index / 3)}-${index % 3}`;

/** A fight where the first two cards of a Set (or of a mistake) are already picked: the third tap is the trigger */
const thirdCard = (id, about, wantSet, extra = {}, level = '1-5') => {
  let third = null;
  return {
    id,
    about,
    path: mapPath(`before:${level}`),
    ready: (page, h) => h.until('map-play-next'),
    prepare: async (page, h) => {
      await intoFight(page, h);
      const cards = await findCards(page, wantSet);
      if (!cards) throw new Error(`No ${wantSet ? 'Set' : 'mistake'} to play on this board`);
      await h.tap(slotOf(cards[0]));
      await h.advance(260);
      await h.tap(slotOf(cards[1]));
      await h.advance(260);
      third = slotOf(cards[2]);
    },
    trigger: (page, h) => h.tap(third),
    maxFrames: 300,
    ...extra,
  };
};

const SHOTS = {
  'fx-cascade': studio('fx-cascade', 'fx-cascade', 'A Set and everything it sets off, as one cascade (effects studio)'),
  'fx-evolution': studio('fx-evolution', 'fx-evolution', 'The evolution cut-in, dismissed with a tap after 1.6 s (effects studio)', { actions: [dismissCutIn(100)], maxFrames: 220 }),
  'fx-evolution-2': studio('fx-evolution-2', 'fx-evolution-2', 'Two evolutions at once: two cut-ins in a row (effects studio)', { actions: [dismissCutIn(100), dismissCutIn(200)], maxFrames: 320 }),

  'fight-set': thirdCard('fight-set', 'A real Set in a real fight (1-5): the third tap, the throw, the hit, the bar, the new cards', true),
  'fight-miss': thirdCard('fight-miss', 'A wrong third card in a real fight (1-5): what a mistake looks like', false),
  'board-set': thirdCard('board-set', 'The same Set as fight-set, board only: the cards leaving and the new ones arriving, without the idle creatures', true, { clip: 'game-board' }),
  'board-miss': thirdCard('board-miss', 'The same mistake as fight-miss, board only', false, { clip: 'game-board' }),
  'fight-pick': {
    id: 'fight-pick',
    about: 'Picking one card and putting it back (1-5): the answer to a tap',
    path: mapPath('before:1-5'),
    ready: (page, h) => h.until('map-play-next'),
    prepare: (page, h) => intoFight(page, h),
    trigger: (page, h) => h.tap(slotOf(4)),
    actions: [{ at: 30, do: (page, h) => h.tap(slotOf(4)) }],
    clip: 'game-board',
    frames: 60,
  },
  'fight-open': {
    id: 'fight-open',
    about: 'A fight opens (1-5): from the preview\'s Fight button to a board that can be played',
    path: mapPath('before:1-5'),
    ready: (page, h) => h.until('map-play-next'),
    prepare: async (page, h) => {
      await openPreview(h);
      await h.advance(480);
    },
    trigger: (page, h) => h.tap('preview-play'),
    maxFrames: 360,
    quietFrames: 40,
  },
  'fight-win': {
    id: 'fight-win',
    about: 'The last hit to the results screen (1-1, played by the autoplayer): knockout, stars, coins',
    path: '/dev/adventure?save=maxed&intro=false&autoplay=true',
    ready: (page, h) => h.until('map-play-next'),
    prepare: async (page, h) => {
      await openPreview(h, '1-1');
      await h.tap('preview-play');
      await h.until('run-foe-hp');
      // Let the autoplayer fight until the foe is down; the capture starts on that frame
      await h.until(() => page.evaluate(() => !!window.__nshapesRun && window.__nshapesRun.status !== 'playing'), { chunk: 48, timeout: 240000 });
    },
    trigger: async () => {},
    frames: 420,
  },
  'preview-open': {
    id: 'preview-open',
    about: 'The level preview opens from the map (1-5), then closes with the device back gesture left to the reviewer',
    path: mapPath('before:1-5'),
    ready: (page, h) => h.until('map-play-next'),
    trigger: (page, h) => h.tap('map-play-next'),
    maxFrames: 120,
  },
  'map-enter': {
    id: 'map-enter',
    about: 'The Adventure map arrives (a returning player on 1-5)',
    path: mapPath('before:1-5'),
    ready: async () => {},
    trigger: async () => {},
    preroll: 1,
    settleMs: 0,
    frames: 120,
  },
  'story-open': {
    id: 'story-open',
    about: 'A new player opens Adventure: the first beat of the story',
    path: '/dev/adventure?save=fresh',
    ready: async () => {},
    trigger: async () => {},
    preroll: 1,
    settleMs: 0,
    frames: 200,
  },
};

export function resolveShot(name) {
  if (SHOTS[name]) return SHOTS[name];
  if (name.startsWith('fx:')) {
    const event = name.slice(3);
    return studio(name, `fx-event-${event}`, `Fight event "${event}" alone (effects studio)`);
  }
  throw new Error(`Unknown shot "${name}". Run: node scripts/motion/capture.mjs --list`);
}

export function describeShots() {
  const lines = ['Shots:', ''];
  for (const s of Object.values(SHOTS)) lines.push(`  ${s.id.padEnd(22)} ${s.about}`);
  lines.push(`  ${'fx:<event>'.padEnd(22)} Any one fight event in the effects studio, e.g. fx:hit, fx:blast, fx:heal (every key of EVENT_FX in src/adventure/fx/catalog.ts)`);
  return lines.join('\n');
}
