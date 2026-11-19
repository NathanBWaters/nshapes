/** The end of a fight: knockout, results, rewards. */
import { mapPath, openPreview } from '../shot-kit.mjs';

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
};
