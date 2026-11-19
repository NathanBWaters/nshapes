/** Real fights, whole screen: the board, the HUD and the creatures together. */
import { findCards, intoFight, mapPath, openPreview, slotOf, thirdCard } from '../shot-kit.mjs';

const findRainbowOrSet = page =>
  page.evaluate(() => {
    const run = window.__nshapesRun;
    if (!run || !run.board) return null;
    const { board, attributes } = run;
    const isSet = (a, b, c) => attributes.every(k => new Set([a[k], b[k], c[k]]).size !== 2);
    const isRainbow = (a, b, c) => attributes.every(k => new Set([a[k], b[k], c[k]]).size === 3);
    let fallback = null;
    for (let i = 0; i < board.length; i++)
      for (let j = i + 1; j < board.length; j++)
        for (let k = j + 1; k < board.length; k++) {
          if (!board[i] || !board[j] || !board[k]) continue;
          if (!isSet(board[i], board[j], board[k])) continue;
          if (isRainbow(board[i], board[j], board[k])) return [i, j, k];
          if (!fallback) fallback = [i, j, k];
        }
    return fallback;
  });

const gearedSet = () => {
  let third = null;
  return {
    id: 'fight-ignition',
    about: 'A geared Set landing on 2-4 (maxed loadout): live score equation tally, GearBelt trigger badges, and hit payoff',
    path: mapPath('maxed'),
    ready: (page, h) => h.until('map-node-2-4'),
    prepare: async (page, h) => {
      await intoFight(page, h, '2-4');
      const cards = (await findRainbowOrSet(page)) ?? (await findCards(page, true));
      if (!cards) throw new Error('No Set to play on 2-4');
      await h.tap(slotOf(cards[0]));
      await h.advance(260);
      await h.tap(slotOf(cards[1]));
      await h.advance(260);
      third = slotOf(cards[2]);
    },
    trigger: (page, h) => h.tap(third),
    maxFrames: 240,
  };
};

export default {
  'fight-set': thirdCard('fight-set', 'A real Set in a real fight (1-5): the third tap, the throw, the hit, the bar, the new cards', true),
  'fight-ignition': gearedSet(),
  'fight-miss': thirdCard('fight-miss', 'A wrong third card in a real fight (1-5): what a mistake looks like', false),
  'fight-open': {
    id: 'fight-open',
    about: "A fight opens (1-5): from the preview's Fight button to a board that can be played",
    path: mapPath('before:1-5'),
    ready: (page, h) => h.until('map-play-next'),
    prepare: async (page, h) => {
      await openPreview(h);
      await h.advance(480);
    },
    trigger: (page, h) => h.tap('preview-play'),
    maxFrames: 360,
    quietFrames: 40,
  },
};
