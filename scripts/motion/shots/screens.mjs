/** Adventure screens outside the fight: map, level preview, story, camp. */
import { mapPath } from '../shot-kit.mjs';

export default {
  'preview-open': {
    id: 'preview-open',
    about: 'The level preview opens from the map (1-5)',
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
