/** The end of a fight: knockout, results, rewards. */
import { mapPath, openPreview } from '../shot-kit.mjs';

/**
 * /dev/results mounts the real results flow (AdventureMode → LevelResults → UnlockReveal)
 * on a fight the bot has just won: `case` = perfect | two | first | fighter (app/dev/results.tsx).
 */
const resultsPath = (c, extra = '') => `/dev/results?case=${c}${extra}`;

/** Which reveal of how many is on screen ("2 of 7"), from the reveal's eyebrow */
const revealCount = page =>
  page.evaluate(() => {
    const m = /(\d+)\s+of\s+(\d+)/i.exec(document.querySelector('[data-testid="unlock-modal"]')?.innerText ?? '');
    return m ? [Number(m[1]), Number(m[2])] : [1, 1];
  });

/** Tap through every reveal up to the last one, and reveal that one: whatever the result unlocked */
const toLastReveal = async (page, h) => {
  for (let guard = 0; guard < 24; guard++) {
    await h.until(async () => (await h.present('unlock-reveal')) || (await h.present('unlock-primary')));
    await h.advance(900);
    const [at, of] = await revealCount(page);
    if (await h.present('unlock-reveal')) await h.tap('unlock-reveal');
    else if (at >= of) return;
    else await h.tap('unlock-primary');
  }
};

/** Tap through the given buttons in order (each waits for the last step to settle). */
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
    about: 'The last reveal closes and the results show what was won (first ★★★ on 2-5: seven unlocks with its bounties; the last is the secret path, "Later")',
    path: resultsPath('first'),
    ready: (page, h) => h.until('results-actions'),
    prepare: async (page, h) => {
      await toLastReveal(page, h);
      await h.advance(1200);
    },
    // The last reveal's way back to the results: "Later" on a path, the primary button on anything else
    trigger: async (page, h) => h.tap((await h.present('unlock-later')) ? 'unlock-later' : 'unlock-primary'),
    frames: 150,
  },
  'results-story': {
    id: 'results-story',
    about: 'The 3-second Brotato cumulative weapon & passive damage story crescendo on a geared 2-4 win (/dev/results?case=geared)',
    path: resultsPath('geared'),
    ready: (page, h) => h.until('battle-damage-story'),
    prepare: async (page, h) => {
      // Wait for stars, coins, and the initial auto-play crescendo to settle completely
      await h.advance(6400);
      await h.reveal('battle-damage-story');
      await h.advance(300);
    },
    trigger: async (page, h) => {
      if (await h.present('battle-damage-story-replay-btn')) {
        await h.tap('battle-damage-story-replay-btn');
      }
    },
    frames: 195,
  },
};
