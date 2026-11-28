/**
 * Lane 2 (`lane-enemies-bosses`) motion shots: loop seams, rage_spin settle,
 * 3-step eyelid blinks, species-class acting (winged, hydra, pincer),
 * 3/4 left storybook bosses with mass-scaled kinematics, and Wave 1
 * enemy sprite-atlas continuity transition gates.
 */
import { findCards, slotOf } from '../shot-kit.mjs';

const pressEnemyReaction = (page, reaction) =>
  page.evaluate(
    sel => document.querySelector(sel)?.click(),
    `[data-testid="studio-enemy-react-${reaction}"]`
  );

const pressEnemyMood = (page, mood) =>
  page.evaluate(
    sel => document.querySelector(sel)?.click(),
    `[data-testid="studio-mood-${mood}"]`
  );

/** Click the Studio enemy roster page button ("Group 1" .. "Group 5") by exact text. */
const selectEnemyGroup = async (page, h, groupNumber) => {
  if (groupNumber <= 1) return;
  await page.getByText(`Group ${groupNumber}`, { exact: true }).first().click();
  await h.advance(32);
};

/** Find a studio enemy card's `data-testid` on the currently visible page by enemy name. */
const findEnemyCardTestId = async (page, enemyName) => {
  const id = await page.evaluate(name => {
    const cards = Array.from(document.querySelectorAll('[data-testid^="studio-enemy-card-"]'));
    for (const card of cards) {
      if ((card.textContent || '').includes(name)) {
        return card.getAttribute('data-testid');
      }
    }
    return null;
  }, enemyName);
  if (!id) throw new Error(`Could not find studio enemy card for "${enemyName}" on current group`);
  return id;
};

/** Helper for capturing a single enemy/boss card in `/dev/fighters` Enemies studio. */
const enemyStudioShot = (
  id,
  about,
  {
    group = 1,
    enemyName,
    mood = 'menacing',
    hp = 0,
    reaction = null,
    frames = 72,
    advanceBeforeMs = 1200,
    settleMs = 320,
    loop = undefined,
    facing = 'left',
    actions = undefined,
    ambient = undefined,
    mute = undefined,
    silhouette = false,
    spriteGate = undefined,
  }
) => {
  let resolvedCardId = 'studio-enemy-card-0';
  return {
    id,
    about,
    path: '/dev/fighters',
    ready: (page, h) => h.until('studio-tab-enemies'),
    prepare: async (page, h) => {
      await h.go('studio-tab-enemies');
      await selectEnemyGroup(page, h, group);
      if (facing === 'front') {
        await h.go('studio-facing-toggle');
      }
      if (silhouette) {
        await h.go('studio-silhouette-toggle');
      }
      if (mood !== 'menacing') {
        await h.go(`studio-mood-${mood}`);
      }
      if (hp !== 0) {
        await h.go(`studio-hp-${hp}`);
      }
      resolvedCardId = enemyName
        ? await findEnemyCardTestId(page, enemyName)
        : 'studio-enemy-card-0';
      await page.evaluate(
        sel => document.querySelector(sel)?.scrollIntoView({ block: 'center', behavior: 'instant' }),
        `[data-testid="${resolvedCardId}"]`
      );
      if (advanceBeforeMs > 0) {
        await h.advance(advanceBeforeMs);
      }
    },
    settleMs,
    trigger: page => (reaction ? pressEnemyReaction(page, reaction) : Promise.resolve()),
    clip: () => resolvedCardId,
    frames,
    ...(loop ? { loop } : {}),
    ...(actions ? { actions } : {}),
    ...(ambient !== undefined ? { ambient } : {}),
    ...(mute ? { mute } : {}),
    ...(spriteGate !== undefined ? { spriteGate } : {}),
  };
};

/**
 * Jumps straight into a clean weapon-free battle at `level` (e.g. `1-3` Clover Frog),
 * pre-selects two cards of a deterministic Set, and captures the 3rd-card Set launch
 * through enemy `pain` impact snap + hitstop + smooth recovery -> living idle.
 */
const fightEnemyHitRecoilShot = (id, level, about, extra = {}) => {
  let third = null;
  return {
    id,
    about,
    path: `/dev/adventure?save=maxed&level=${level}&weapons=&arcana=&fighter=Orange%20Tabby&seed=4242&intro=false`,
    ready: (page, h) => h.until('run-foe-hp'),
    prepare: async (page, h) => {
      await h.until(async () => !(await h.present('run-opening')));
      await h.advance(2800);
      const cards = await findCards(page, true);
      if (!cards) throw new Error(`No Set available for ${id} (${level}) hit-recoil shot`);
      await h.tap(slotOf(cards[0]));
      await h.advance(220);
      await h.tap(slotOf(cards[1]));
      await h.advance(220);
      third = slotOf(cards[2]);
    },
    trigger: (page, h) => h.tap(third),
    clip: async page => {
      const box = await page.locator('[data-testid="adventure-run-enemy"]').first().boundingBox();
      if (!box) return null;
      return {
        x: Math.max(0, box.x - 40),
        y: Math.max(0, box.y - 24),
        width: box.width + 64,
        height: box.height + 44,
      };
    },
    frames: 84,
    ambient: 0,
    mute: ['ALL-AT-ONCE'],
    // f1..f5 covers the 1-3 all-different coaching banner briefly flashing over the top of the foe viewport on Set tap;
    // f17..f26 covers thrown Set card arrival + 0ms Sakurai pain snap (payout @ f21.8) + hitstop micro-vibration,
    // while keeping pre-hit idle (f6..f16) and full recoil recovery + living idle (f27..f83) strictly gated.
    spriteGate: {
      viewportKey: 'enemy-sprite-viewport',
      snapFrames: [1, 2, 3, 4, 5, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
      stabilizeStageShake: true,
    },
    ...extra,
  };
};

export default {
  'foe-cornered-seam': enemyStudioShot(
    'foe-cornered-seam',
    'Cornered foe tremor + sweat-drop continuous loop (verifies integer-harmonic zero wrap seam)',
    {
      group: 1,
      enemyName: 'Junk Rat',
      mood: 'cornered',
      hp: 3,
      reaction: null,
      frames: 84,
      loop: { frames: 66 },
      advanceBeforeMs: 960,
    }
  ),

  'foe-rage-spin': enemyStudioShot(
    'foe-rage-spin',
    '5x poke rage_spin reaction (verifies smooth spring settle instead of 0ms -360 -> 0 snap)',
    {
      group: 1,
      enemyName: 'Junk Rat',
      mood: 'menacing',
      hp: 0,
      reaction: 'rage_spin',
      frames: 78,
    }
  ),

  'foe-winged-flap': enemyStudioShot(
    'foe-winged-flap',
    'Winged foe (Swift Bee) continuous brisk rhythmic wingbeats & aerial poise',
    {
      group: 3,
      enemyName: 'Swift Bee',
      mood: 'menacing',
      hp: 0,
      reaction: 'attack',
      frames: 72,
    }
  ),

  'foe-pincer-snap': enemyStudioShot(
    'foe-pincer-snap',
    'Pincer foe (Wet Crab) snapping pincer strike choreography',
    {
      group: 4,
      enemyName: 'Wet Crab',
      mood: 'menacing',
      hp: 0,
      reaction: 'attack',
      frames: 72,
    }
  ),

  'foe-blink-3step': enemyStudioShot(
    'foe-blink-3step',
    'Idle foe 3-step eyelid blink window (open -> half-lid droop -> shut -> half-lid -> open)',
    {
      group: 1,
      enemyName: 'Junk Rat',
      mood: 'idle',
      hp: 0,
      reaction: null,
      // First blink fires ~4077..4100ms after mount; advance 3520ms + 320ms settle + 128ms preroll = ~3968ms at f0
      advanceBeforeMs: 3520,
      settleMs: 320,
      frames: 36,
    }
  ),

  'boss-dragon-34': enemyStudioShot(
    'boss-dragon-34',
    'Tier-4 Boss Ancient Dragon in 3/4 left storybook craft performing heavy boss attack telegraph & slam',
    {
      group: 5,
      enemyName: 'Ancient Dragon',
      mood: 'menacing',
      hp: 0,
      reaction: 'attack',
      frames: 84,
    }
  ),

  'boss-hydra-snap': enemyStudioShot(
    'boss-hydra-snap',
    'Tier-4 Boss The Hydra in 3/4 left storybook craft with out-of-phase multi-head strike snap',
    {
      group: 5,
      enemyName: 'The Hydra',
      mood: 'menacing',
      hp: 0,
      reaction: 'attack',
      frames: 84,
    }
  ),

  'boss-kraken-stomp': enemyStudioShot(
    'boss-kraken-stomp',
    "Tier-4 Boss Kraken's Grasp heavy stomp entrance & mass-scaled boss inertia",
    {
      group: 5,
      enemyName: "Kraken's Grasp",
      mood: 'menacing',
      hp: 0,
      reaction: 'entrance',
      frames: 84,
    }
  ),

  'boss-reaper-34': enemyStudioShot(
    'boss-reaper-34',
    'Tier-4 Boss The Reaper 3/4 left scythe slash attack & spectral float',
    {
      group: 5,
      enemyName: 'The Reaper',
      mood: 'menacing',
      hp: 0,
      reaction: 'attack',
      frames: 84,
    }
  ),

  'boss-worldeater-34': enemyStudioShot(
    'boss-worldeater-34',
    'Tier-4 Boss World Eater 3/4 left cosmic void-beast pain inertia recoil',
    {
      group: 5,
      enemyName: 'World Eater',
      mood: 'menacing',
      hp: 0,
      reaction: 'pain',
      frames: 78,
    }
  ),

  'boss-chapter-ironshell': enemyStudioShot(
    'boss-chapter-ironshell',
    'Chapter Boss Iron Shell 3/4 left fortress tortoise attack & heavy stomp',
    {
      group: 4,
      enemyName: 'Iron Shell',
      mood: 'menacing',
      hp: 0,
      reaction: 'attack',
      frames: 78,
    }
  ),

  'boss-chapter-hyena': enemyStudioShot(
    'boss-chapter-hyena',
    'Chapter Boss Hyena Boss 3/4 left prowling bandana leader taunt & lunge',
    {
      group: 2,
      enemyName: 'Hyena Boss',
      mood: 'menacing',
      hp: 0,
      reaction: 'attack',
      frames: 78,
    }
  ),

  'boss-chapter-mammoth': enemyStudioShot(
    'boss-chapter-mammoth',
    'Chapter Boss Dusty Mammoth 3/4 left sweeping ivory tusks stomp',
    {
      group: 2,
      enemyName: 'Dusty Mammoth',
      mood: 'menacing',
      hp: 0,
      reaction: 'entrance',
      frames: 78,
    }
  ),

  'boss-chapter-sentinel': enemyStudioShot(
    'boss-chapter-sentinel',
    'Chapter Boss Stone Sentinel 3/4 left glowing rune golem heavy punch',
    {
      group: 5,
      enemyName: 'Stone Sentinel',
      mood: 'menacing',
      hp: 0,
      reaction: 'attack',
      frames: 78,
    }
  ),

  // ══════════════════ Wave 1 Enemy Sprite-Atlas Continuity Gates ══════════════════

  'enemy-sprite-idle-loop': enemyStudioShot(
    'enemy-sprite-idle-loop',
    'Ancient Dragon Wave 1 32-frame 16fps seamless video-loop idle (2000ms cycle + wrap) in /dev/fighters Enemies tab',
    {
      group: 5,
      enemyName: 'Ancient Dragon',
      mood: 'idle',
      hp: 0,
      reaction: null,
      frames: 68,
      advanceBeforeMs: 400,
      ambient: 0,
      mute: ['DEAD-STRETCH'],
      spriteGate: { viewportKey: 'enemy-sprite-viewport', snapFrames: [] },
    }
  ),

  'enemy-tx-boss-attack': enemyStudioShot(
    'enemy-tx-boss-attack',
    'Iron Shell full boss attack in /dev/fighters: windup coil (f0..f11) -> 192ms strikeStartMs Sakurai snap -> recovery -> living idle',
    {
      group: 4,
      enemyName: 'Iron Shell',
      mood: 'menacing',
      hp: 0,
      reaction: 'attack',
      frames: 84,
      advanceBeforeMs: 600,
      ambient: 0,
      mute: ['DEAD-STRETCH'],
      // Boss strikeStartMs = PHASE.bossWindMs (48ms) + PHASE.bossCoilHoldMs (144ms) = 192ms (+1f commit -> f13),
      // covering attack[36..37] strike snap + 1st/2nd enemy-fx-attack slash arcs (f14..f17) while strictly gating windup (f1..f10) & recovery (f18..f83).
      spriteGate: {
        viewportKey: 'enemy-sprite-viewport',
        snapFrames: [11, 12, 13, 14, 15, 16, 17],
      },
    }
  ),

  'enemy-tx-hit-recoil': fightEnemyHitRecoilShot(
    'enemy-tx-hit-recoil',
    '1-3',
    'Clover Frog real 1-3 battle Set hit: thrown cards impact -> 0ms pain snap + hitstop -> smooth recovery -> living idle'
  ),

  'enemy-tx-sleepy-wake': enemyStudioShot(
    'enemy-tx-sleepy-wake',
    'Dozy Bunny sleepy curl & wake in /dev/fighters: living idle -> sleepy Phase A+B curl (f8) -> wake back to living idle (f36) with zero teleport',
    {
      group: 1,
      enemyName: 'Dozy Bunny',
      // Pristine Dozy Bunny auto-maps 'idle' -> 'sleepy' via naturallySleepy, whereas 'menacing' runs
      // pure MODE_IDLE (0..31) with zero overlays so f8->sleepy and f36->menacing exercise full curl & wake!
      mood: 'menacing',
      hp: 0,
      reaction: null,
      frames: 64,
      advanceBeforeMs: 600,
      ambient: 0,
      actions: [
        { at: 8, do: page => pressEnemyMood(page, 'sleepy') },
        { at: 36, do: page => pressEnemyMood(page, 'menacing') },
      ],
      mute: ['DEAD-STRETCH'],
      spriteGate: { viewportKey: 'enemy-sprite-viewport', snapFrames: [] },
    }
  ),

  'enemy-tx-taunt-mood': enemyStudioShot(
    'enemy-tx-taunt-mood',
    'Hyena Boss ambient mood tempo continuity (idle -> menacing f8 -> enraged f16 -> idle f26) + taunt (f34) in /dev/fighters',
    {
      group: 2,
      enemyName: 'Hyena Boss',
      mood: 'idle',
      hp: 0,
      reaction: null,
      frames: 72,
      advanceBeforeMs: 600,
      ambient: 0,
      actions: [
        { at: 8, do: page => pressEnemyMood(page, 'menacing') },
        { at: 16, do: page => pressEnemyMood(page, 'enraged') },
        { at: 26, do: page => pressEnemyMood(page, 'idle') },
        { at: 34, do: page => pressEnemyReaction(page, 'taunt') },
      ],
      mute: ['DEAD-STRETCH'],
      spriteGate: { viewportKey: 'enemy-sprite-viewport', snapFrames: [] },
    }
  ),
};
