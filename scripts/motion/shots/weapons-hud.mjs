/**
 * Lane 3 (stage, weapons, HUD & fight-FX) motion shots:
 *  - Biome battle stage dioramas (`stage-backdrop-meadow`, `stage-backdrop-summit`, plus woods/canyon/peaks)
 *  - Bespoke Weapon Flourishes (`weapon-burst-explosive`, `weapon-burst-chrono`, `weapon-burst-arcane`, + all 8 categories)
 *  - Fight HUD & Parry (`parry-state-shift`, `belt-evo-countdown`, `belt-evo-anticipation`, `trait-checks-reveal`, `card-hint-hop`)
 */
import { findCards, slotOf } from '../shot-kit.mjs';

const padRect = async (page, selector, pad = 16) => {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) return null;
  return {
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  };
};

/** Helper: jump straight into a live fight on a specific biome level, wait past opening, and land one Set. */
const biomeStageShot = (id, levelId, save, about) => {
  let third = null;
  return {
    id,
    about,
    path: `/dev/adventure?save=${save}&level=${levelId}&seed=42&intro=false`,
    ready: (page, h) => h.until('run-stage'),
    prepare: async (page, h) => {
      await h.until('run-foe-hp');
      await h.until(async () => !(await h.present('run-opening')));
      await h.advance(420);
      const cards = await findCards(page, true);
      if (cards) {
        await h.tap(slotOf(cards[0]));
        await h.advance(180);
        await h.tap(slotOf(cards[1]));
        await h.advance(180);
        third = slotOf(cards[2]);
      }
    },
    trigger: (page, h) => (third ? h.tap(third) : undefined),
    clip: page => padRect(page, '[data-testid="run-stage"]', 4),
    frames: 56,
    mute: ['ALL-AT-ONCE'],
  };
};

/** Helper: open /dev/fighters Weapons tab, reveal a specific weapon relic, and trigger its single tap flourish. */
const weaponBurstShot = (id, weaponName, about) => {
  const sel = `[aria-label^="${weaponName} ("]`;
  return {
    id,
    about,
    path: '/dev/fighters',
    ready: (page, h) => h.until('studio-tab-weapons'),
    prepare: async (page, h) => {
      await h.go('studio-tab-weapons');
      await h.until(sel);
      await h.reveal(sel);
      await h.advance(360);
    },
    trigger: page =>
      page.evaluate(selector => {
        const el = document.querySelector(selector);
        const btn = el?.closest('[data-testid="weapon-avatar-pressable"]') ?? el;
        btn?.click();
      }, sel),
    clip: page => padRect(page, sel, 26),
    frames: 48,
    ambient: 0,
  };
};

/** Enter 1-4D Training Lab via Adventure Map -> LevelPreview -> Test Loadout (keeps weapons/save params). */
const openTrainingLab = async h => {
  await h.go('map-play-next');
  await h.go('preview-test-loadout');
  await h.until('training-lab-parry');
};

/** ParryIntentBar live phase transitions: windup -> golden Perfect Parry window -> Staggered x2. */
const parryStateShift = () => {
  let third = null;
  return {
    id: 'parry-state-shift',
    about: 'ParryIntentBar live windup -> golden Perfect Parry window -> Staggered x2 transition (Training Lab)',
    path: '/dev/adventure?save=maxed&intro=false',
    ready: (page, h) => h.until('map-play-next'),
    prepare: async (page, h) => {
      await openTrainingLab(h);
      await h.go('training-lab-parry');
      await h.until('run-parry-bar');
      // Advance right up to ~200ms before the 3500ms golden Perfect Parry window
      for (let i = 0; i < 64; i++) {
        const msLeft = await page.evaluate(() => window.__nshapesRun?.parry?.msLeft ?? 99999);
        if (msLeft <= 3720) break;
        await h.advance(250);
      }
      const cards = await findCards(page, true);
      if (!cards) throw new Error('No Set available in parry-state-shift');
      await h.tap(slotOf(cards[0]));
      await h.advance(160);
      await h.tap(slotOf(cards[1]));
      await h.advance(160);
      third = slotOf(cards[2]);
    },
    // Frame 0 starts just before the golden window; on frame 30 (~480ms), tap the 3rd card to Perfect Parry -> Staggered!
    trigger: () => {},
    actions: [{ at: 30, do: (page, h) => (third ? h.tap(third) : undefined) }],
    clip: page => padRect(page, '[data-testid="run-parry-bar"]', 10),
    frames: 72,
    settleMs: 0,
    preroll: 2,
    ambient: 0,
    mute: ['ALL-AT-ONCE'],
  };
};

/** GearBelt live 60fps evolved countdown drain on Training Lab (maxed save -> non-blocking banner, golden bar drains immediately). */
const beltEvoCountdown = () => ({
  id: 'belt-evo-countdown',
  about: 'GearBelt golden evolved weapon slot 60fps Reanimated drain bar across 768ms (Training Lab)',
  path: '/dev/adventure?save=maxed&weapons=blast-powder,flint-spark,mending-charm&intro=false',
  ready: (page, h) => h.until('map-play-next'),
  prepare: async (page, h) => {
    await openTrainingLab(h);
    await h.go('training-lab-trigger-evo');
    await h.advance(350);
    if (await h.present('evolution-cutin')) {
      await h.advance(350);
      await page.mouse.click(195, 300);
      await h.advance(300);
    }
    await h.until('belt-evo-active-blast-powder');
    // Wait briefly so the fight clock is actively ticking and the 60fps drain bar is visibly sweeping
    await h.advance(2400);
  },
  trigger: () => {},
  clip: page => padRect(page, '[data-testid="gear-belt"]', 8),
  frames: 48,
  settleMs: 0,
  preroll: 1,
  ambient: 0,
  mute: ['DEAD-STRETCH'],
});

/** GearBelt Almost-Ready anticipation: 1-shot SCALE.pop pip jump + battery-safe opacity-only amber rim pulse. */
const beltEvoAnticipation = () => ({
  id: 'belt-evo-anticipation',
  about: 'GearBelt Almost-Ready anticipation pip pop (SCALE.pop) + opacity-only amber rim pulse (Training Lab)',
  path: '/dev/adventure?save=maxed&weapons=blast-powder,flint-spark,mending-charm&intro=false',
  ready: (page, h) => h.until('map-play-next'),
  prepare: async (page, h) => {
    await openTrainingLab(h);
    await h.until('training-lab-step-evo');
    // Step Blast Powder (Cluster Charge, target 3) to 1/3 so the trigger tap lands directly on 2/3 (almostReady!)
    await h.go('training-lab-step-evo');
    await h.advance(350);
  },
  trigger: (page, h) => h.tap('training-lab-step-evo'),
  clip: page => padRect(page, '[data-testid="gear-belt"]', 8),
  frames: 60,
  ambient: 0,
  mute: ['DEAD-STRETCH'],
});

/** TraitChecks live reveal on 1-1: rule strip -> 2-card hint cells -> 3-card pass cells. */
const traitChecksReveal = () => {
  let second = null;
  let third = null;
  return {
    id: 'trait-checks-reveal',
    about: 'TraitChecks staggered cell reveal on 1-1: rule -> hint cells -> pass cells',
    path: '/dev/adventure?save=fresh&level=1-1&seed=42&intro=false',
    ready: (page, h) => h.until('run-trait-checks'),
    prepare: async (page, h) => {
      await h.until(async () => !(await h.present('run-opening')));
      await h.advance(360);
      const cards = await findCards(page, true);
      if (!cards) throw new Error('No Set available on 1-1 for trait-checks-reveal');
      await h.tap(slotOf(cards[0]));
      await h.advance(200);
      second = slotOf(cards[1]);
      third = slotOf(cards[2]);
    },
    trigger: (page, h) => h.tap(second),
    actions: [{ at: 26, do: (page, h) => h.tap(third) }],
    clip: page => padRect(page, '[data-testid="run-trait-checks"]', 8),
    frames: 60,
    ambient: 0,
  };
};

/** CardMotion hint-hop with anticipation crouch on 2-4 (3 starting hints). */
const cardHintHop = () => ({
  id: 'card-hint-hop',
  about: 'CardMotion hint-hop anticipation crouch + EASE.enter/impact bounce on 2-4',
  path: '/dev/adventure?save=before:2-4&level=2-4&seed=42&intro=false',
  ready: (page, h) => h.until('run-hint'),
  prepare: async (page, h) => {
    await h.until(async () => !(await h.present('run-opening')));
    await h.advance(420);
  },
  trigger: (page, h) => h.tap('run-hint'),
  clip: 'game-board',
  frames: 56,
  ambient: 0,
});

export default {
  'stage-backdrop-meadow': biomeStageShot(
    'stage-backdrop-meadow',
    '1-5',
    'before:1-5',
    'Sunny Meadow battle stage diorama behind fighter, foe & landing Set damage (1-5)'
  ),
  'stage-backdrop-woods': biomeStageShot(
    'stage-backdrop-woods',
    '2-4',
    'maxed',
    'Whispering Woods battle stage diorama behind fighter, foe & landing Set damage (2-4)'
  ),
  'stage-backdrop-canyon': biomeStageShot(
    'stage-backdrop-canyon',
    '3-1',
    'maxed',
    'Ember Canyon battle stage diorama behind fighter, foe & landing Set damage (3-1)'
  ),
  'stage-backdrop-peaks': biomeStageShot(
    'stage-backdrop-peaks',
    '4-1',
    'maxed',
    'Frozen Peaks battle stage diorama behind fighter, foe & landing Set damage (4-1)'
  ),
  'stage-backdrop-summit': biomeStageShot(
    'stage-backdrop-summit',
    '5-1',
    'maxed',
    'Starfall Summit battle stage diorama behind Kraken boss, fighter & damage (5-1)'
  ),
  'weapon-burst-explosive': weaponBurstShot(
    'weapon-burst-explosive',
    'Blast Powder',
    'Explosive weapon flourish & bespoke spark burst (Blast Powder)'
  ),
  'weapon-burst-chrono': weaponBurstShot(
    'weapon-burst-chrono',
    'Chrono Shard',
    'Chrono weapon flourish & bespoke clock-tick burst (Chrono Shard)'
  ),
  'weapon-burst-vitality': weaponBurstShot(
    'weapon-burst-vitality',
    'Life Vessel',
    'Vitality weapon flourish & bespoke heal-leaf burst (Life Vessel)'
  ),
  'weapon-burst-laser': weaponBurstShot(
    'weapon-burst-laser',
    'Prismatic Ray',
    'Laser weapon flourish & bespoke glint sweep burst (Prismatic Ray)'
  ),
  'weapon-burst-tome': weaponBurstShot(
    'weapon-burst-tome',
    "Scholar's Tome",
    'Tome weapon flourish & bespoke rune-halo burst (Scholar\'s Tome)'
  ),
  'weapon-burst-coin': weaponBurstShot(
    'weapon-burst-coin',
    "Fortune's Favor",
    'Coin weapon flourish & bespoke sovereign-shine burst (Fortune\'s Favor)'
  ),
  'weapon-burst-connector': weaponBurstShot(
    'weapon-burst-connector',
    'Link Stone',
    'Connector weapon flourish & bespoke tether-arc burst (Link Stone)'
  ),
  'weapon-burst-arcane': weaponBurstShot(
    'weapon-burst-arcane',
    'Oracle Eye',
    'Arcane weapon flourish & bespoke arcane-star burst (Oracle Eye)'
  ),
  'parry-state-shift': parryStateShift(),
  'belt-evo-countdown': beltEvoCountdown(),
  'belt-evo-anticipation': beltEvoAnticipation(),
  'trait-checks-reveal': traitChecksReveal(),
  'card-hint-hop': cardHintHop(),
};
