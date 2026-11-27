/**
 * Lane 2 (`lane-enemies-bosses`) motion shots: loop seams, rage_spin settle,
 * 3-step eyelid blinks, species-class acting (winged, hydra, pincer), and
 * 3/4 left storybook bosses with mass-scaled kinematics.
 */

const pressEnemyReaction = (page, reaction) =>
  page.evaluate(
    sel => document.querySelector(sel)?.click(),
    `[data-testid="studio-enemy-react-${reaction}"]`
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
    mute = undefined,
    silhouette = false,
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
        sel => document.querySelector(sel)?.scrollIntoView({ block: 'center' }),
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
    ...(mute ? { mute } : {}),
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
};
