/** The end of a fight: knockout, results, rewards. */
import { mapPath, openPreview } from '../shot-kit.mjs';

/**
 * /dev/results mounts the real results flow (AdventureMode → LevelResults → UnlockReveal)
 * on a fight the bot has just won: `case` = perfect | two | first | fighter (app/dev/results.tsx).
 */
const resultsPath = (c, extra = '') => `/dev/results?case=${c}${extra}`;

/** Tap through reveals until `done(h)` is true: reveal what is hidden, then the primary button. */
const tapThrough = async (h, steps) => {
  for (const id of steps) {
    await h.until(id);
    // Let the last step settle before the next tap (a reveal's details, a new silhouette arriving)
    await h.advance(700);
    await h.tap(id);
  }
};

/** From the results' first frame (the dev route's twin of `results-payout`) */
const fromMount = (id, c, about, extra = {}) => ({
  id,
  about,
  path: resultsPath(c),
  ready: (page, h) => h.until('results-actions'),
  trigger: async () => {},
  ambient: 0,
  frames: 180,
  ...extra,
});

export default {
  'fight-win': {
    id: 'fight-win',
    about: 'The last hit to the results screen (1-1, played by the autoplayer): knockout, stars, coins',
    path: mapPath('maxed', '&autoplay=true'),
    ready: (page, h) => h.until('map-play-next'),
    prepare: async (page, h) => {
      await openPreview(h, '1-1');
      await h.tap('preview-play');
      await h.until('run-foe-hp');
      // Let the autoplayer fight until the foe is down; the capture starts on that frame
      await h.until(() => page.evaluate(() => !!window.__nshapesRun && window.__nshapesRun.status !== 'playing'), { chunk: 48, timeout: 240000 });
    },
    trigger: async () => {},
    // Starts mid-action (the last hit is still playing), so "still" cannot be measured before the trigger
    ambient: 0,
    frames: 420,
  },
  'results-payout': {
    id: 'results-payout',
    about: 'The results of a won 1-1 (3 stars, coins) from the frame the screen mounts: card, stars, goal ticks, coin count',
    path: mapPath('maxed', '&autoplay=true'),
    ready: (page, h) => h.until('map-play-next'),
    prepare: async (page, h) => {
      await openPreview(h, '1-1');
      await h.tap('preview-play');
      await h.until('run-foe-hp');
      await h.until(() => page.evaluate(() => !!window.__nshapesRun && window.__nshapesRun.status !== 'playing'), { chunk: 48, timeout: 240000 });
      // Stop on the results' first frame: frame 0 is the screen arriving, not the knockout
      await h.until('results-actions');
    },
    trigger: async () => {},
    ambient: 0,
    frames: 180,
  },
  'results-quick': fromMount('results-quick', 'perfect', 'results-payout in seconds (/dev/results, 1-1 ★★★ on a maxed save): same frames from the mount'),
  'results-two': fromMount('results-two', 'two', 'The results of a ★★ win (/dev/results): two stars land, the third goal is missed'),
  'unlock-open': fromMount('unlock-open', 'fighter', 'A first ★★★ on 1-5: the stars land, then the unlock reveal opens over the results', { frames: 150 }),
  'unlock-reveal': {
    id: 'unlock-reveal',
    about: 'The tap on Reveal: the silhouette becomes the new fighter (Sly Fox, first ★★★ on 1-5)',
    path: resultsPath('fighter'),
    ready: (page, h) => h.until('results-actions'),
    prepare: async (page, h) => {
      await h.until('unlock-reveal');
      await h.advance(600);
    },
    trigger: (page, h) => h.tap('unlock-reveal'),
    frames: 100,
  },
  'unlock-advance': {
    id: 'unlock-advance',
    about: 'The next unlock in a row: Sly Fox revealed, tap the primary button, the secret path comes up (1-5)',
    path: resultsPath('fighter'),
    ready: (page, h) => h.until('results-actions'),
    prepare: async (page, h) => {
      await tapThrough(h, ['unlock-reveal']);
      await h.until('unlock-primary');
      await h.advance(1200);
    },
    trigger: (page, h) => h.tap('unlock-primary'),
    frames: 90,
  },
  'unlock-return': {
    id: 'unlock-return',
    about: 'The last reveal closes and the results show what was won (2-5: level-up, Corgi, Chain Gang, secret path; "Later")',
    path: resultsPath('first'),
    ready: (page, h) => h.until('results-actions'),
    prepare: async (page, h) => {
      // war-drum level-up (shown at once) → Corgi → Chain Gang → the secret path
      await tapThrough(h, ['unlock-primary', 'unlock-reveal', 'unlock-primary', 'unlock-reveal', 'unlock-primary', 'unlock-reveal']);
      await h.until('unlock-later');
      await h.advance(1200);
    },
    trigger: (page, h) => h.tap('unlock-later'),
    frames: 150,
  },
};
