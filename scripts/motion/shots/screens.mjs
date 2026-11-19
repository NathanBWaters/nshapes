/** Adventure screens outside the fight: map, level preview, story, camp. */
import { mapPath, openPreview } from '../shot-kit.mjs';

/** The dimmed strip above the preview sheet: a tap there closes it */
const tapBackdrop = page => page.mouse.click(195, 18);

export default {
  'preview-open': {
    id: 'preview-open',
    about: 'The level preview opens from the map (1-5)',
    path: mapPath('before:1-5'),
    ready: (page, h) => h.until('map-play-next'),
    trigger: (page, h) => h.tap('map-play-next'),
    maxFrames: 120,
  },
  'preview-open-node': {
    id: 'preview-open-node',
    about: 'The level preview opens from a tapped map node (1-5): the node answers the tap',
    path: mapPath('before:1-5'),
    ready: (page, h) => h.until('map-node-1-5'),
    prepare: (page, h) => h.advance(400),
    trigger: (page, h) => h.tap('map-node-1-5'),
    maxFrames: 120,
  },
  'map-node-press': {
    id: 'map-node-press',
    about: 'A finger held on a map node for 6 frames (1-5), as on a phone: the node sinks, then the sheet comes on release',
    path: mapPath('before:1-5'),
    ready: (page, h) => h.until('map-node-1-5'),
    prepare: (page, h) => h.advance(400),
    trigger: async page => {
      const box = await page.locator('[data-testid="map-node-1-5"]').first().boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
    },
    actions: [{ at: 6, do: page => page.mouse.up() }],
    frames: 30,
  },
  'preview-close': {
    id: 'preview-close',
    about: 'The level preview is put away with its ✕ (1-5)',
    path: mapPath('before:1-5'),
    ready: (page, h) => h.until('map-play-next'),
    prepare: async (page, h) => {
      await openPreview(h);
      await h.advance(800);
    },
    trigger: (page, h) => h.tap('preview-close'),
    maxFrames: 90,
  },
  'preview-reopen': {
    id: 'preview-reopen',
    about: 'Interrupted: the preview is put away (backdrop) and Play is tapped again on f9, mid-exit: it must end fully open',
    path: mapPath('before:1-5'),
    ready: (page, h) => h.until('map-play-next'),
    prepare: async (page, h) => {
      await openPreview(h);
      await h.advance(800);
    },
    trigger: page => tapBackdrop(page),
    actions: [{ at: 9, do: (page, h) => h.tap('map-play-next') }],
    maxFrames: 90,
  },
  'preview-flick': {
    id: 'preview-flick',
    about: 'Interrupted the other way: Play, then the backdrop on f6 while the sheet is still rising: it must end fully closed',
    path: mapPath('before:1-5'),
    ready: (page, h) => h.until('map-play-next'),
    trigger: (page, h) => h.tap('map-play-next'),
    actions: [{ at: 6, do: page => tapBackdrop(page) }],
    maxFrames: 90,
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
