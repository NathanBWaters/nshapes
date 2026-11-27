/** Hero Fighters lane: 3-step organic blinks, all 6 species acting signatures, sleepy zZz loop, streak pill, build aura, and state-transition continuity gates. */
import { findCards, slotOf } from '../shot-kit.mjs';

const cardOf = card => `studio-fighter-card-${card}`;
const pressFighter = (page, reaction) =>
  page.evaluate(sel => document.querySelector(sel)?.click(), `[data-testid="studio-fighter-react-${reaction}"]`);
const pressMood = (page, mood) =>
  page.evaluate(sel => document.querySelector(sel)?.click(), `[data-testid="studio-mood-${mood}"]`);

const studioFighterShot = (
  id,
  about,
  { card = 0, reaction = 'ecstatic', mood = 'idle', hp = 0, streak, frames = 72, actions, spriteGate, mute } = {}
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
  ...(spriteGate !== undefined ? { spriteGate } : {}),
  ...(mute ? { mute } : {}),
});

/**
 * Jumps straight into a clean weapon-free 1-3 fight with `fighterName` selected,
 * pre-selects two cards of a deterministic Set, and captures the 3rd-card Set launch (`throw`).
 * Clips to a generous padded box around `adventure-run-fighter` so forward lunges & smears stay visible.
 */
const fightThrowShot = (id, fighterName, about, extra = {}) => {
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
    spriteGate: { snapFrames: [2, 3, 4, 5, 6, 7, 8, 9], stabilizeStageShake: true },
    ...extra,
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
    'Badger Set launch: heavy rear uppercut cock-back -> haymaker cross jab (pawTx/pawRotate + heavy recoil)',
    {
      // Badger uses a 48ms (3f) heavy windup (HIT.snapMs * 3), landing its intentional strike snap on f10
      spriteGate: { snapFrames: [2, 3, 4, 5, 6, 7, 8, 9, 10], stabilizeStageShake: true },
    }
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
    about: 'Orange Tabby Option B 32-frame 16fps seamless video-loop idle (2000ms cycle + wrap) on /dev/fighters',
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
    frames: 68,
    ambient: 0,
    mute: ['DEAD-STRETCH'],
    spriteGate: { snapFrames: [] },
  },

  'fighter-tx-mood-tempo': {
    id: 'fighter-tx-mood-tempo',
    about: 'Orange Tabby mood tempo continuity on /dev/fighters: idle -> curious (f12) -> anticipation (f28) -> idle (f48) with zero phase-reset pops',
    path: '/dev/fighters',
    ready: (page, h) => h.until('studio-tab-fighters'),
    prepare: async (page, h) => {
      await h.go('studio-mood-idle');
      await h.go('studio-hp-0');
      await h.go('studio-streak-0');
      await page.evaluate(
        sel => document.querySelector(sel).scrollIntoView({ block: 'center', behavior: 'instant' }),
        `[data-testid="${cardOf(0)}"]`
      );
      await h.advance(600);
    },
    trigger: async () => {},
    actions: [
      { at: 12, do: page => pressMood(page, 'curious') },
      { at: 28, do: page => pressMood(page, 'anticipation') },
      { at: 48, do: page => pressMood(page, 'idle') },
    ],
    clip: cardOf(0),
    frames: 72,
    ambient: 0,
    mute: ['DEAD-STRETCH'],
    spriteGate: { snapFrames: [] },
  },

  'fighter-tx-throw-full-cycle': fightThrowShot(
    'fighter-tx-throw-full-cycle',
    'Orange Tabby',
    'Orange Tabby full throw cycle on 1-3: Set 3rd-card tap -> windup -> 1f Sakurai strike snap -> animated recovery -> 20+ frames of smooth idle (no exit pop)',
    {
      frames: 84,
      spriteGate: { snapFrames: [2, 3, 4, 5, 6, 7, 8, 9], stabilizeStageShake: true },
    }
  ),

  'fighter-tx-combat-interrupt': studioFighterShot(
    'fighter-tx-combat-interrupt',
    'Orange Tabby mid-action combat interrupt on /dev/fighters: ecstatic cheer -> pain recoil (f10) -> chained 2nd pain (f22) -> smooth settle back to idle',
    {
      card: 0,
      reaction: 'ecstatic',
      mood: 'idle',
      hp: 0,
      streak: 0,
      frames: 64,
      actions: [
        { at: 10, do: page => pressFighter(page, 'pain') },
        { at: 22, do: page => pressFighter(page, 'pain') },
      ],
      mute: ['DEAD-STRETCH'],
      spriteGate: { snapFrames: [1, 2, 10, 11, 12, 22, 23, 24] },
    }
  ),

  'fighter-tx-sleepy-wake': {
    id: 'fighter-tx-sleepy-wake',
    about: 'Orange Tabby sleepy bridge & wake on /dev/fighters: idle -> sleepy drowsy bridge & living snooze (f8) -> wake back to idle (f36)',
    path: '/dev/fighters',
    ready: (page, h) => h.until('studio-tab-fighters'),
    prepare: async (page, h) => {
      await h.go('studio-mood-idle');
      await h.go('studio-hp-0');
      await h.go('studio-streak-0');
      await page.evaluate(
        sel => document.querySelector(sel).scrollIntoView({ block: 'center', behavior: 'instant' }),
        `[data-testid="${cardOf(0)}"]`
      );
      await h.advance(600);
    },
    trigger: async () => {},
    actions: [
      { at: 8, do: page => pressMood(page, 'sleepy') },
      { at: 36, do: page => pressMood(page, 'idle') },
    ],
    clip: cardOf(0),
    frames: 60,
    ambient: 0,
    mute: ['DEAD-STRETCH'],
    spriteGate: { snapFrames: [] },
  },

  'fighter-tx-mainmenu-press': {
    id: 'fighter-tx-mainmenu-press',
    about: 'MainMenu mascot transitions: idle -> PLAY pointerdown anticipation coil (f10) -> pointerup release to idle (f30) -> mascot swap tap (f44)',
    path: '/',
    ready: (page, h) => h.until('menu-hero-stage'),
    prepare: async (page, h) => {
      await h.until('menu-adventure');
      // Wait past mount entrance animation so the mascot is in steady idle before f0
      await h.advance(1400);
    },
    trigger: async () => {},
    actions: [
      {
        at: 10,
        do: async page => {
          const box = await page.locator('[data-testid="menu-adventure"]').first().boundingBox();
          if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
          }
        },
      },
      {
        at: 30,
        do: async page => {
          // Move pointer off PLAY before releasing so onPressOut releases anticipation without navigating away
          await page.mouse.move(4, 4);
          await page.mouse.up();
        },
      },
      {
        at: 44,
        do: async (page, h) => {
          if (await h.present('main-menu-mascot-tap')) {
            await h.tap('main-menu-mascot-tap');
          } else {
            await h.tap('main-menu-mascot');
          }
        },
      },
    ],
    clip: 'menu-hero-stage',
    frames: 72,
    ambient: 0,
    mute: ['DEAD-STRETCH'],
    // Track the moving mascot viewport inside the white heroCard interior (inset 4px) so
    // PLAY BTN_PRESS card scale/translation & yellow/black outer border never bleed into sprite continuity
    spriteGate: { snapFrames: [44, 45, 46, 47], trackViewport: true, roiInset: 4 },
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
