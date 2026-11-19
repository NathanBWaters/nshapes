/** Real fights, whole screen: the board, the HUD and the creatures together. */
import { mapPath, openPreview, thirdCard } from '../shot-kit.mjs';

export default {
  'fight-set': thirdCard('fight-set', 'A real Set in a real fight (1-5): the third tap, the throw, the hit, the bar, the new cards', true),
  'fight-miss': thirdCard('fight-miss', 'A wrong third card in a real fight (1-5): what a mistake looks like', false),
  'fight-open': {
    id: 'fight-open',
    about: "A fight opens (1-5): from the preview's Fight button to a board that can be played",
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
};
