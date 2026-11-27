/** Hero Fighters lane: 3-step organic blinks, all 6 species acting signatures, sleepy zZz loop, streak pill, and build aura. */
import { findCards, slotOf } from '../shot-kit.mjs';

const cardOf = card => `studio-fighter-card-${card}`;
const pressFighter = (page, reaction) =>
  page.evaluate(sel => document.querySelector(sel).click(), `[data-testid="studio-fighter-react-${reaction}"]`);

const studioFighterShot = (
  id,
  about,
  { card = 0, reaction = 'ecstatic', mood = 'idle', hp = 0, streak, frames = 72, actions } = {}
) => ({
  id,
  about,
  path: '/dev/fighters',
  ready: (page, h) => h.until('studio-tab-fighters'),
  prepare: async (page, h) => {
    await h.go(`studio-mood-${mood}`);
    await h.go(`studio-hp-${hp}`);
    if (streak !== undefined) await h.go(`studio-streak-${streak}`);
    await page.evaluate(
      sel => document.querySelector(sel).scrollIntoView({ block: 'center', behavior: 'instant' }),
      `[data-testid="${cardOf(card)}"]`
    );
    await h.advance(1200);
  },
  trigger: page => pressFighter(page, reaction),
  clip: cardOf(card),
  frames,
  ...(actions ? { actions } : {}),
});

/**
 * Jumps straight into a clean weapon-free 1-3 fight with `fighterName` selected,
 * pre-selects two cards of a deterministic Set, and captures the 3rd-card Set launch (`throw`).
 * Clips to a generous padded box around `adventure-run-fighter` so forward lunges & smears stay visible.
 */
const fightThrowShot = (id, fighterName, about) => {
  let third = null;
  const encoded = encodeURIComponent(fighterName);
  return {
    id,
    about,
    path: `/dev/adventure?save=maxed&level=1-3&weapons=&arcana=&fighter=${encoded}&seed=4242&intro=false`,
    ready: (page, h) => h.until('run-foe-hp'),
    prepare: async (page, h) => {
      await h.until(async () => !(await h.present('run-opening')));
      await h.advance(2800);
      const cards = await findCards(page, true);
      if (!cards) throw new Error(`No Set available for ${fighterName} throw shot`);
      await h.tap(slotOf(cards[0]));
      await h.advance(220);
      await h.tap(slotOf(cards[1]));
      await h.advance(220);
      third = slotOf(cards[2]);
    },
    trigger: (page, h) => h.tap(third),
    clip: async page => {
      const box = await page.locator('[data-testid="adventure-run-fighter"]').first().boundingBox();
      if (!box) return null;
      return {
        x: Math.max(0, box.x - 24),
        y: Math.max(0, box.y - 24),
        width: box.width + 64,
        height: box.height + 44,
      };
    },
    frames: 48,
    ambient: 0,
    mute: ['ALL-AT-ONCE'],
  };
};

export default {
  'fighter-blink-3step': {
    id: 'fighter-blink-3step',
    about: 'Orange Tabby deterministic 3-step organic upper-eyelid blink (0 open -> 1 half-lid -> 2 shut -> 1 half-lid -> 0 open)',
    path: '/dev/fighters',
    ready: (page, h) => h.until('studio-tab-fighters'),
    prepare: async (page, h) => {
      await page.evaluate(
        sel => document.querySelector(sel).scrollIntoView({ block: 'center', behavior: 'instant' }),
        `[data-testid="${cardOf(0)}"]`
      );
      // First deterministic blink for Orange Tabby (size 96, breath 2600ms) fires around ~3780ms after mount.
      // settleMs (160) + preroll (4 * 16 = 48) puts f0 right at ~3680ms so the 8-frame blink lands mid-strip.
      await h.advance(3472);
    },
    trigger: async () => {},
    settleMs: 160,
    preroll: 4,
    clip: cardOf(0),
    frames: 24,
    ambient: 0,
    mute: ['DEAD-STRETCH', 'NO-CHANGE'],
  },

  'fighter-tabby-pounce': fightThrowShot(
    'fighter-tabby-pounce',
    'Orange Tabby',
    'Orange Tabby Set launch: deep pounce-crouch coil -> high-paw diagonal swipe + 1-2f strike smear'
  ),

  'fighter-fox-dart': fightThrowShot(
    'fighter-fox-dart',
    'Sly Fox',
    'Sly Fox Set launch: tight low horizontal rogue dart (lungeTx x1.25, sharp forward tilt, flame-tail whip)'
  ),

  'fighter-penguin-cast': fightThrowShot(
    'fighter-penguin-cast',
    'Emperor Penguin',
    'Emperor Penguin Set launch: tall regal draw-up (scaleY 1.06) -> sweeping casting-flipper arc & halo flare'
  ),

  'fighter-badger-jab': fightThrowShot(
    'fighter-badger-jab',
    'Badger',
    'Badger Set launch: heavy rear uppercut cock-back -> haymaker cross jab (pawTx/pawRotate + heavy recoil)'
  ),

  'fighter-corgi-zoomie': studioFighterShot(
    'fighter-corgi-zoomie',
    'Corgi ecstatic cheer: butt-wiggle anticipation crouch -> zoomie sploot bounce + frantic nub-tail blur',
    { card: 3, reaction: 'ecstatic', streak: 3, frames: 72 }
  ),

  'fighter-pelican-cheer': studioFighterShot(
    'fighter-pelican-cheer',
    'Pelican ecstatic cheer: coastal wing-flap takeoff + loose gular pouch heave & staggered splash burst',
    { card: 4, reaction: 'ecstatic', streak: 3, frames: 72 }
  ),

  'fighter-sleepy-zzz': {
    id: 'fighter-sleepy-zzz',
    about: 'Orange Tabby sleepy zZz ambient loop: rising S-curve letters with smooth fade-in/out (no closed oval)',
    path: '/dev/fighters',
    ready: (page, h) => h.until('studio-tab-fighters'),
    prepare: async (page, h) => {
      await h.go('studio-mood-sleepy');
      await page.evaluate(
        sel => document.querySelector(sel).scrollIntoView({ block: 'center', behavior: 'instant' }),
        `[data-testid="${cardOf(0)}"]`
      );
      await h.advance(1400);
    },
    trigger: async () => {},
    clip: cardOf(0),
    frames: 120,
    loop: { frames: 120 },
    ambient: 0,
    mute: ['DEAD-STRETCH'],
  },

  'fighter-streak-pill': {
    id: 'fighter-streak-pill',
    about: 'Framed FighterAvatar 3x streak pill & frame highlight smooth enter (f0) and exit (f24)',
    path: '/dev/fighters',
    ready: (page, h) => h.until('studio-tab-fighters'),
    prepare: async (page, h) => {
      await h.go('studio-streak-0');
      await page.evaluate(
        sel => document.querySelector(sel).scrollIntoView({ block: 'center', behavior: 'instant' }),
        `[data-testid="${cardOf(0)}"]`
      );
      await h.advance(800);
    },
    trigger: page =>
      page.evaluate(() => document.querySelector('[data-testid="studio-streak-3"]')?.click()),
    actions: [
      {
        at: 24,
        do: page =>
          page.evaluate(() => document.querySelector('[data-testid="studio-streak-0"]')?.click()),
      },
    ],
    clip: cardOf(0),
    frames: 48,
    ambient: 0,
  },

  'fighter-sprite-idle-loop': {
    id: 'fighter-sprite-idle-loop',
    about: 'Orange Tabby Nano Banana 6-frame seamless sprite idle loop (780ms cycle) on /dev/fighters',
    path: '/dev/fighters',
    ready: (page, h) => h.until('studio-tab-fighters'),
    prepare: async (page, h) => {
      await page.evaluate(
        sel => document.querySelector(sel).scrollIntoView({ block: 'center', behavior: 'instant' }),
        `[data-testid="${cardOf(0)}"]`
      );
      await h.advance(400);
    },
    trigger: async () => {},
    clip: cardOf(0),
    frames: 54,
    ambient: 0,
    mute: ['DEAD-STRETCH'],
  },

  'fighter-aura-loop': {
    id: 'fighter-aura-loop',
    about: 'FighterBuildAura in Camp with equipped charms & 2 Arcana: organic breathing halo & orbiting glints',
    path: '/dev/adventure?save=maxed&arcana=monochrome_pact,prismatic_fever&intro=false',
    ready: (page, h) => h.until('map-dock-camp'),
    prepare: async (page, h) => {
      await h.go('map-dock-camp');
      await h.go('camp-tab-fighters');
      await h.until('camp-fighter-build-aura');
      await h.reveal('camp-fighter-Orange Tabby');
      await h.advance(800);
    },
    trigger: async () => {},
    clip: async page => {
      const box = await page.locator('[data-testid="camp-fighter-build-aura"]').first().boundingBox();
      if (!box) return null;
      return {
        x: Math.max(0, box.x - 10),
        y: Math.max(0, box.y - 10),
        width: box.width + 20,
        height: box.height + 20,
      };
    },
    frames: 120,
    ambient: 0,
    mute: ['DEAD-STRETCH'],
  },
};
