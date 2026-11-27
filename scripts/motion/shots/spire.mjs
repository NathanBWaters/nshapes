/** Starfall Summit (Spire) screens, map climb, drafts, campfire acting, shop, modals, and run payoff. */

const MMKV_RUN_KEY = 'nshapes-storage\\spire_v1_run';

/**
 * Seeds a realistic saved SpireRun into MMKV web localStorage by opening `/dev/spire?start=true`,
 * saving via the header back button, mutating the persisted run JSON in place, and reloading
 * `/dev/spire` so `SpireMode` hydrates it cleanly without touching dev routes.
 */
async function seedSavedSpireRun(page, h, mutateFn, startQuery = 'start=true&seed=4242') {
  const base = h.base.replace(/\/$/, '');
  await page.goto(`${base}/dev/spire?${startQuery}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await h.until('spire-back-menu');
  await h.tap('spire-back-menu');
  await h.until('spire-resume-run');
  await page.evaluate(
    ({ key, mutatorSrc }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) throw new Error('Expected saved SpireRun in localStorage under ' + key);
      const run = JSON.parse(raw);
      const mutator = new Function('run', mutatorSrc);
      const next = mutator(run) || run;
      window.localStorage.setItem(key, JSON.stringify(next));
    },
    { key: MMKV_RUN_KEY, mutatorSrc: mutateFn }
  );
  await page.goto(`${base}/dev/spire`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await h.until('spire-resume-run');
}

export default {
  'spire-setup-select': {
    id: 'spire-setup-select',
    about: 'SpireSetup: selecting Badger then Corgi shows tactile card hop, living avatars, and smooth starter-kit crossfade',
    path: '/dev/spire',
    ready: (page, h) => h.until('spire-fighter-Badger'),
    prepare: async (page, h) => {
      await h.advance(450);
    },
    trigger: (page, h) => h.tap('spire-fighter-Badger'),
    actions: [{ at: 26, do: (page, h) => h.tap('spire-fighter-Corgi') }],
    frames: 60,
  },

  'spire-setup-asc': {
    id: 'spire-setup-asc',
    about: 'SpireSetup: stepping Ascension up to A1 gives snappy stepper compression and value pop',
    path: '/dev/spire',
    ready: (page, h) => h.until('spire-asc-up'),
    prepare: async (page, h) => {
      await h.reveal('spire-asc-up');
      await h.advance(450);
    },
    trigger: (page, h) => h.tap('spire-asc-up'),
    frames: 36,
  },

  'spire-map-bob': {
    id: 'spire-map-bob',
    about: 'SpireMap ambient loop: reachable nodes bob out of phase while living boss/encounter avatars breathe (0 frame loops)',
    path: '/dev/spire?start=true&seed=4242',
    ready: (page, h) => h.until('spire-map'),
    prepare: async (page, h) => {
      await h.advance(450);
    },
    trigger: async () => {},
    ambient: 0,
    frames: 75,
  },

  'spire-map-climb': {
    id: 'spire-map-climb',
    about: 'SpireMap → EncounterPreview: tapping a reachable entrance node answers with a press and vertical ascent transition',
    path: '/dev/spire?start=true&seed=4242',
    ready: (page, h) => h.until('spire-node-a1-r0-c0'),
    prepare: async (page, h) => {
      await h.reveal('spire-node-a1-r0-c0');
      await h.advance(450);
    },
    trigger: (page, h) => h.tap('spire-node-a1-r0-c0'),
    frames: 56,
  },

  'spire-reward-draft': {
    id: 'spire-reward-draft',
    about: 'SpireRewardScreen: staged Floor Cleared hero banner → coin count-up → staggered draft cards → weapon claim pulse & collapse',
    path: '/dev/spire',
    ready: (page, h) => h.until('spire-setup'),
    prepare: async (page, h) => {
      await seedSavedSpireRun(
        page,
        h,
        `
          run.phase = 'reward';
          run.floor = 3;
          run.coins = 140;
          run.reward = {
            nodeKind: 'elite',
            foeName: 'Wild Boar',
            coinsEarned: 85,
            parryBonusCoins: 20,
            dpm: 1480,
            biggestHit: 240,
            parries: 3,
            perfectParries: 1,
            weaponOptions: [
              { weaponId: 'snowball', level: 2 },
              { weaponId: 'war-drum', level: 2 },
              { weaponId: 'prismatic-ray', level: 2 },
            ],
            weaponClaimed: false,
            weaponRerolled: false,
            arcanaOptions: ['tempo_surge', 'glass_prism'],
            arcanaClaimed: false,
            skillOptions: ['tabby-0-1', 'tabby-0-2'],
            skillClaimed: false,
            isActBoss: false,
          };
          return run;
        `
      );
      await h.advance(450);
    },
    trigger: (page, h) => h.tap('spire-resume-run'),
    actions: [{ at: 60, do: (page, h) => h.tap('spire-draft-pick-0') }],
    frames: 105,
  },

  'spire-campfire-rest': {
    id: 'spire-campfire-rest',
    about: 'SpireCampfire: resting triggers champion heal/relief acting, header heart bump, and smooth options → outcome crossfade',
    path: '/dev/spire?room=campfire&seed=4242',
    ready: (page, h) => h.until('spire-campfire-rest'),
    prepare: async (page, h) => {
      await h.advance(500);
    },
    trigger: (page, h) => h.tap('spire-campfire-rest'),
    frames: 72,
  },

  'spire-shop-buy': {
    id: 'spire-shop-buy',
    about: 'SpireShop: buying a weapon pops the row & updates header coins/belt, then buying an upgrade pops again',
    path: '/dev/spire?room=shop&seed=4242',
    ready: (page, h) => h.until('spire-shop-weapon-0'),
    prepare: async (page, h) => {
      await h.advance(500);
    },
    trigger: (page, h) => h.tap('spire-shop-weapon-0'),
    actions: [{ at: 28, do: (page, h) => h.tap('spire-shop-upgrade-0') }],
    frames: 68,
  },

  'spire-treasure-reveal': {
    id: 'spire-treasure-reveal',
    about: 'SpireTreasure: chest anticipation dip → pop-open → staggered relic reveal, then claiming coins',
    path: '/dev/spire?room=treasure&seed=4242',
    ready: async () => {},
    trigger: async () => {},
    settleMs: 0,
    preroll: 1,
    actions: [{ at: 48, do: (page, h) => h.tap('spire-treasure-coins') }],
    frames: 84,
  },

  'spire-build-modal': {
    id: 'spire-build-modal',
    about: 'SpireBuildModal: tactile sheet enter with staggered content lag, then real exit choreography on Close',
    path: '/dev/spire?start=true&seed=4242',
    ready: (page, h) => h.until('spire-open-build'),
    prepare: async (page, h) => {
      await h.advance(450);
    },
    trigger: (page, h) => h.tap('spire-open-build'),
    actions: [{ at: 32, do: (page, h) => h.tap('[aria-label="Close"]') }],
    frames: 64,
  },

  'spire-end-victory': {
    id: 'spire-end-victory',
    about: 'SpireEndScreen: Act 3 Boss climax transition into SUMMIT CONQUERED! hero arc, cheering fighter, rating count-up & staggered stats',
    path: '/dev/spire',
    ready: (page, h) => h.until('spire-setup'),
    prepare: async (page, h) => {
      await seedSavedSpireRun(
        page,
        h,
        `
          run.phase = 'reward';
          run.act = 3;
          run.floor = 21;
          run.endless = false;
          run.hearts = 5;
          run.maxHearts = 6;
          run.coins = 245;
          run.weapons = ['blast-powder', 'mending-charm', 'snowball', 'war-drum'];
          run.weaponLevels = { 'blast-powder': 4, 'mending-charm': 3, snowball: 3, 'war-drum': 2 };
          run.equippedEvolutions = {
            'blast-powder': 'blast-powder:cluster-charge',
            'mending-charm': 'mending-charm:heart-bloom',
          };
          run.skillNodes = ['tabby-0-1', 'tabby-0-2'];
          run.arcana = ['tempo_surge'];
          run.stats = {
            floorsCleared: 21,
            skirmishesWon: 10,
            elitesWon: 4,
            bossesWon: 3,
            totalDamage: 18420,
            biggestHit: 640,
            peakDpm: 2450,
            totalSets: 142,
            parries: 14,
            perfectParries: 6,
            evolutionsForged: 4,
            forgedEvolutionIds: ['blast-powder:cluster-charge'],
            coinsSpent: 480,
            eventsResolved: 3,
          };
          run.reward = {
            nodeKind: 'boss',
            foeName: 'Ancient Dragon',
            coinsEarned: 150,
            parryBonusCoins: 30,
            dpm: 2450,
            biggestHit: 640,
            parries: 5,
            perfectParries: 2,
            weaponOptions: [],
            weaponClaimed: true,
            weaponRerolled: false,
            arcanaOptions: [],
            arcanaClaimed: true,
            skillOptions: [],
            skillClaimed: true,
            isActBoss: true,
          };
          return run;
        `,
        'start=true&act=3&seed=4242'
      );
      await h.tap('spire-resume-run');
      await h.until('spire-reward-continue');
      await h.advance(500);
    },
    trigger: (page, h) => h.tap('spire-reward-continue'),
    frames: 60,
  },
};
