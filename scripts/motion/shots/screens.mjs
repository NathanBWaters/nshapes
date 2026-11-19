/** Adventure screens outside the fight: map, level preview, story, camp. */
import { mapPath, openPreview } from '../shot-kit.mjs';

/** Camp's back arrow (Camp.tsx has no test id for it) */
const BACK_TO_MAP = '[aria-label="Back to map"]';

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
  // One screen change, everywhere in Adventure (docs/motion/reviews/screen-change.md)
  'screen-map-camp': {
    id: 'screen-map-camp',
    about: 'Screen change, deeper: map → Camp (dock button)',
    path: mapPath('maxed'),
    ready: (page, h) => h.until('map-dock-camp'),
    prepare: (page, h) => h.advance(400),
    trigger: (page, h) => h.tap('map-dock-camp'),
    frames: 40,
  },
  'screen-camp-map': {
    id: 'screen-camp-map',
    about: 'Screen change, back: Camp → map (Camp’s back arrow)',
    path: mapPath('maxed'),
    ready: (page, h) => h.until('map-dock-camp'),
    prepare: async (page, h) => {
      await h.go('map-dock-camp');
      await h.until(BACK_TO_MAP);
      await h.advance(800);
    },
    trigger: (page, h) => h.tap(BACK_TO_MAP),
    frames: 40,
  },
  'screen-double': {
    id: 'screen-double',
    about: 'Interrupted: Camp, then Camp’s back arrow on f13, while Camp is still arriving: it must end on the map, whole',
    path: mapPath('maxed'),
    ready: (page, h) => h.until('map-dock-camp'),
    prepare: (page, h) => h.advance(400),
    trigger: (page, h) => h.tap('map-dock-camp'),
    actions: [{ at: 13, do: (page, h) => h.tap(BACK_TO_MAP) }],
    frames: 45,
  },
  'screen-map-fight': {
    id: 'screen-map-fight',
    about: 'Screen change into a fight: the preview’s Fight! (1-5), and how the fight’s own FIGHT! banner meets it',
    path: mapPath('before:1-5'),
    ready: (page, h) => h.until('map-play-next'),
    prepare: async (page, h) => {
      await openPreview(h);
      await h.advance(480);
    },
    trigger: (page, h) => h.tap('preview-play'),
    frames: 90,
  },
  'screen-menu-map': {
    id: 'screen-menu-map',
    about: 'Main menu → Adventure map (a returning player)',
    path: '/',
    ready: (page, h) => h.until('menu-adventure'),
    prepare: (page, h) => h.advance(600),
    trigger: (page, h) => h.tap('menu-adventure'),
    frames: 45,
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
    about: 'A new player opens Adventure: wild critters swoop in, cage your friends, and scatter Golden Keys',
    path: '/dev/adventure?save=fresh',
    ready: async () => {},
    trigger: async () => {},
    preroll: 1,
    settleMs: 0,
    frames: 110,
  },
  'map-key-open': {
    id: 'map-key-open',
    about: 'Tapping a gleaming Golden Rescue Key on the Adventure Map road between 1-5 and 1-6 opens the Friend Rescue picker',
    path: '/dev/adventure?save=before:1-6&keys=ready&intro=false',
    ready: (page, h) => h.until('map-key-key-1'),
    prepare: async (page, h) => {
      await h.reveal('map-key-key-1');
      await h.advance(500);
    },
    trigger: (page, h) => h.tap('map-key-key-1'),
    frames: 45,
  },
  'friend-rescue': {
    id: 'friend-rescue',
    about: 'Freeing a chosen caged friend (Corgi): Golden Key glides into the padlock, cranks 90°, forged bars burst apart, friend leaps free',
    path: '/dev/adventure?save=before:1-6&keys=ready&rescue=key-1&intro=false',
    ready: (page, h) => h.until('rescue-confirm-btn'),
    prepare: async (page, h) => {
      await h.advance(450);
      await h.tap('rescue-option-Corgi');
      await h.advance(200);
    },
    trigger: (page, h) => h.tap('rescue-confirm-btn'),
    frames: 100,
  },
};
