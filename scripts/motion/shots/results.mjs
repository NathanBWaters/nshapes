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
    frames: 420,
  },
};
