/**
 * Lane 4 motion shots: MainMenu, AdventureMap, Camp, SkillTree, StoryEnding,
 * FriendRescue, and shared screen/modal/button transitions.
 */
import { mapPath } from '../shot-kit.mjs';

export default {
  'menu-open': {
    id: 'menu-open',
    about: 'MainMenu arrives on mount: title, mascot matchup card, and secondary shelf entrance',
    path: '/',
    ready: async () => {},
    trigger: async () => {},
    preroll: 1,
    settleMs: 0,
    frames: 45,
  },
  'menu-to-adventure': {
    id: 'menu-to-adventure',
    about: 'MainMenu Hero CTA pressed → directional ScreenTransition exit into Adventure (no hard cut)',
    path: '/',
    ready: (page, h) => h.until('menu-adventure'),
    prepare: (page, h) => h.advance(600),
    trigger: (page, h) => h.tap('menu-adventure'),
    frames: 45,
  },
  'menu-mascot-tap': {
    id: 'menu-mascot-tap',
    about: 'Tapping the MainMenu mascot gives a tactile non-nested pop, golden ring burst & companion swap/cheer',
    path: '/',
    ready: (page, h) => h.until('main-menu-mascot'),
    prepare: (page, h) => h.advance(600),
    clip: 'menu-hero-stage',
    ambient: 0,
    trigger: async (page, h) => {
      if (await h.present('main-menu-mascot-tap')) {
        await h.tap('main-menu-mascot-tap');
      } else {
        await h.tap('main-menu-mascot');
      }
    },
    frames: 40,
  },
  'menu-foe-breath': {
    id: 'menu-foe-breath',
    about: 'MainMenu Frontier Foe continuous lightweight GPU breathing loop (unfrozen, incommensurate with mascot)',
    path: '/',
    ready: (page, h) => h.until('menu-frontier-foe'),
    prepare: (page, h) => h.advance(700),
    trigger: async () => {},
    clip: 'menu-frontier-foe',
    preroll: 2,
    settleMs: 0,
    ambient: 0,
    frames: 90,
  },
  'map-open': {
    id: 'map-open',
    about: 'Returning from Camp back to AdventureMap on 2-3 (checks clean scroll positioning with no 120ms jump)',
    path: mapPath('before:2-3'),
    ready: (page, h) => h.until('map-dock-camp'),
    prepare: async (page, h) => {
      await h.advance(500);
      await h.go('map-dock-camp');
      await h.until('[aria-label="Back to map"]');
      await h.advance(500);
    },
    trigger: (page, h) => h.tap('[aria-label="Back to map"]'),
    frames: 45,
  },
  'map-bob-stagger': {
    id: 'map-bob-stagger',
    about: 'AdventureMap frontier node & fighter marker bob phase-staggered (never lockstep)',
    path: mapPath('before:2-3'),
    ready: (page, h) => h.until('map-node-2-3'),
    prepare: (page, h) => h.advance(600),
    trigger: async () => {},
    preroll: 2,
    settleMs: 0,
    ambient: 0,
    frames: 72,
  },
  'camp-open': {
    id: 'camp-open',
    about: 'Camp hub opens and drills into Workshop section with smooth menu ↔ section transition & card stagger',
    path: mapPath('maxed'),
    ready: (page, h) => h.until('map-dock-camp'),
    prepare: async (page, h) => {
      await h.advance(400);
      await h.go('map-dock-camp');
      await h.until('camp-tab-workshop');
      await h.advance(500);
    },
    trigger: (page, h) => h.tap('camp-tab-workshop'),
    frames: 45,
  },
  'camp-equip-pop': {
    id: 'camp-equip-pop',
    about: 'Equipping an Armory weapon pops the newly filled belt slot cleanly with golden burst ring',
    path: mapPath('before:2-5', '&weapons=clarity-lens'),
    ready: (page, h) => h.until('map-dock-camp'),
    prepare: async (page, h) => {
      await h.advance(400);
      await h.go('map-dock-camp');
      await h.go('camp-tab-armory');
      await h.until('camp-charm-slots');
      await h.advance(500);
    },
    clip: 'camp-charm-slots',
    ambient: 0,
    trigger: async page => {
      // Tap the first unequipped Armory weapon tile
      const tiles = page.locator('[data-testid^="camp-armory-"]');
      const count = await tiles.count();
      for (let i = 0; i < count; i++) {
        const tile = tiles.nth(i);
        const testId = await tile.getAttribute('data-testid');
        if (
          testId &&
          !testId.startsWith('camp-armory-filters') &&
          !testId.startsWith('camp-armory-search') &&
          !testId.startsWith('camp-armory-shelf') &&
          !testId.startsWith('camp-armory-guide') &&
          !testId.startsWith('camp-armory-sorted') &&
          !testId.startsWith('camp-armory-empty') &&
          testId !== 'camp-armory-clarity-lens'
        ) {
          await tile.click();
          return;
        }
      }
    },
    frames: 36,
  },
  'camp-slots-full': {
    id: 'camp-slots-full',
    about: 'Tapping a 4th weapon when belt slots are full triggers horizontal geometric refusal shake',
    path: mapPath('before:2-5', '&weapons=clarity-lens,blast-powder,echo-stone'),
    ready: (page, h) => h.until('map-dock-camp'),
    prepare: async (page, h) => {
      await h.advance(400);
      await h.go('map-dock-camp');
      await h.go('camp-tab-armory');
      await h.until('camp-charm-slots');
      await h.advance(500);
    },
    clip: 'camp-belt-zone',
    ambient: 0,
    trigger: async page => {
      const equipped = new Set([
        'camp-armory-clarity-lens',
        'camp-armory-blast-powder',
        'camp-armory-echo-stone',
      ]);
      const tiles = page.locator('[data-testid^="camp-armory-"]');
      const count = await tiles.count();
      for (let i = 0; i < count; i++) {
        const tile = tiles.nth(i);
        const testId = await tile.getAttribute('data-testid');
        if (
          testId &&
          !equipped.has(testId) &&
          !testId.startsWith('camp-armory-filters') &&
          !testId.startsWith('camp-armory-search') &&
          !testId.startsWith('camp-armory-shelf') &&
          !testId.startsWith('camp-armory-guide') &&
          !testId.startsWith('camp-armory-sorted') &&
          !testId.startsWith('camp-armory-empty')
        ) {
          await tile.click();
          return;
        }
      }
    },
    frames: 36,
  },
  'skill-tree-open': {
    id: 'skill-tree-open',
    about: 'Opening Orange Tabby SkillTree from Camp Fighters tab',
    path: mapPath('maxed'),
    ready: (page, h) => h.until('map-dock-camp'),
    prepare: async (page, h) => {
      await h.advance(400);
      await h.go('map-dock-camp');
      await h.go('camp-tab-fighters');
      await h.until('[data-testid="camp-open-tree-Orange Tabby"]');
      await h.advance(500);
    },
    trigger: (page, h) => h.tap('[data-testid="camp-open-tree-Orange Tabby"]'),
    frames: 40,
  },
  'skill-node-buy': {
    id: 'skill-node-buy',
    about: 'Buying a SkillTree node closes the detail sheet, bursts the node, and draws on the golden connector link',
    path: mapPath('maxed'),
    ready: (page, h) => h.until('map-dock-camp'),
    prepare: async (page, h) => {
      await h.advance(400);
      await h.go('map-dock-camp');
      await h.go('camp-tab-fighters');
      await h.go('[data-testid="camp-open-tree-Orange Tabby"]');
      await h.until('skill-node-tabby-0-2');
      await h.reveal('skill-node-tabby-0-2');
      await h.advance(400);
      await h.tap('skill-node-tabby-0-2');
      await h.until('skill-buy');
      await h.advance(450);
    },
    trigger: (page, h) => h.tap('skill-buy'),
    frames: 50,
  },
  'story-ending-alive': {
    id: 'story-ending-alive',
    about: 'Campaign Ending Beat 2 Reunion: painted meadow plate + staggered living crew breathing alive',
    path: '/dev/results?level=5-5&stars=3&save=geared',
    ready: (page, h) => h.until('results-watch-ending'),
    prepare: async (page, h) => {
      await h.advance(1600);
      if (await h.present('unlock-claim-all')) {
        await h.tap('unlock-claim-all');
        await h.advance(400);
      }
      await page.locator('[data-testid="results-watch-ending"]').first().evaluate(el => {
        el.scrollIntoView({ block: 'center', inline: 'nearest' });
      });
      await h.advance(120);
      await h.tap('results-watch-ending');
      await h.until('ending-next');
      await h.advance(700);
    },
    trigger: (page, h) => h.tap('ending-next'),
    frames: 68,
  },
  'btn-tactile-press': {
    id: 'btn-tactile-press',
    about: 'Holding and releasing a tactile tabletop Btn (6f push-down + snappy spring rebound)',
    path: mapPath('maxed'),
    ready: (page, h) => h.until('map-dock-camp'),
    prepare: async (page, h) => {
      await h.advance(400);
      await h.go('map-dock-camp');
      await h.until('camp-toggle-analytics');
      await h.reveal('camp-toggle-analytics');
      await h.advance(400);
    },
    clip: 'camp-toggle-analytics',
    ambient: 0,
    trigger: async page => {
      const box = await page.locator('[data-testid="camp-toggle-analytics"]').first().boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
    },
    actions: [{ at: 6, do: page => page.mouse.up() }],
    frames: 26,
  },
  'settings-sheet-toggle': {
    id: 'settings-sheet-toggle',
    about: 'Opening SettingsSheet from MainMenu and closing it (verifies smooth enter AND exit choreography)',
    path: '/',
    ready: (page, h) => h.until('menu-options'),
    prepare: (page, h) => h.advance(600),
    trigger: (page, h) => h.tap('menu-options'),
    actions: [{ at: 20, do: (page, h) => h.tap('options-close') }],
    frames: 46,
  },
};
