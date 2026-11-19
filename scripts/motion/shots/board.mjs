/** The board alone (clipped to it, so idle creatures do not drown small card moves). */
import { intoFight, mapPath, slotOf, thirdCard } from '../shot-kit.mjs';

export default {
  'board-set': thirdCard('board-set', 'The same Set as fight-set, board only: the cards leaving and the new ones arriving', true, { clip: 'game-board' }),
  'board-miss': thirdCard('board-miss', 'The same mistake as fight-miss, board only', false, { clip: 'game-board' }),
  'fight-pick': {
    id: 'fight-pick',
    about: 'Picking one card and putting it back (1-5): the answer to a tap',
    path: mapPath('before:1-5'),
    ready: (page, h) => h.until('map-play-next'),
    prepare: (page, h) => intoFight(page, h),
    trigger: (page, h) => h.tap(slotOf(4)),
    actions: [{ at: 30, do: (page, h) => h.tap(slotOf(4)) }],
    clip: 'game-board',
    frames: 60,
  },
};
