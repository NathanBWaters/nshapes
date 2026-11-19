/**
 * Building blocks for shots (scripts/motion/shots/*.mjs): how to get to the
 * usual places in the game. The shot format and the helpers (`h`) are
 * described at the top of scripts/motion/shots.mjs.
 */

/** The effects studio (/dev/fx): one chip per fight event, on a stand-in fight screen. */
export const studio = (id, chip, about, extra = {}) => ({
  id,
  about,
  path: '/dev/fx',
  ready: (page, h) => h.until('fx-event-hit'),
  clip: 'fx-stage',
  trigger: (page, h) => h.tap(chip),
  ...extra,
});

/** Tap the middle of the screen on frame `at` (to continue past a cut-in, once it has had time to play) */
export const tapScreenAt = at => ({ at, do: page => page.mouse.click(195, 300) });

/** The map with a given save: `before:1-5` makes 1-5 the next level, `maxed` opens everything, `fresh` is a new player. */
export const mapPath = (save, extra = '') => `/dev/adventure?save=${save}&intro=false${extra}`;

/** From the map into the level preview (the next level, or a named one) */
export const openPreview = async (h, level) => {
  await h.until('map-play-next');
  await h.go(level ? `map-node-${level}` : 'map-play-next');
  await h.until('preview-play');
};

/** From the map into a fight, past the FIGHT! banner and the foe's taunt, to a board that is waiting for a tap */
export const intoFight = async (page, h, level) => {
  await openPreview(h, level);
  await h.advance(480);
  await h.tap('preview-play');
  await h.until('run-foe-hp');
  await h.until(async () => !(await h.present('run-opening')));
  await h.advance(2800);
};

/** Slots of three cards on the board that are a Set (or are not one), read from the fight's own state */
export const findCards = (page, wantSet) =>
  page.evaluate(want => {
    const run = window.__nshapesRun;
    if (!run || !run.board) return null;
    const { board, attributes } = run;
    const isSet = (a, b, c) => attributes.every(k => new Set([a[k], b[k], c[k]]).size !== 2);
    for (let i = 0; i < board.length; i++)
      for (let j = i + 1; j < board.length; j++)
        for (let k = j + 1; k < board.length; k++) {
          if (!board[i] || !board[j] || !board[k]) continue;
          if (isSet(board[i], board[j], board[k]) === want) return [i, j, k];
        }
    return null;
  }, wantSet);

/** The test id of a board slot (three columns) */
export const slotOf = index => `card-slot-${Math.floor(index / 3)}-${index % 3}`;

/** A fight where the first two cards of a Set (or of a mistake) are already picked: the third tap is the trigger */
export const thirdCard = (id, about, wantSet, extra = {}, level = '1-5') => {
  let third = null;
  return {
    id,
    about,
    path: mapPath(`before:${level}`),
    ready: (page, h) => h.until('map-play-next'),
    prepare: async (page, h) => {
      await intoFight(page, h);
      const cards = await findCards(page, wantSet);
      if (!cards) throw new Error(`No ${wantSet ? 'Set' : 'mistake'} to play on this board`);
      await h.tap(slotOf(cards[0]));
      await h.advance(260);
      await h.tap(slotOf(cards[1]));
      await h.advance(260);
      third = slotOf(cards[2]);
    },
    trigger: (page, h) => h.tap(third),
    maxFrames: 300,
    ...extra,
  };
};
