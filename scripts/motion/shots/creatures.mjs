/** Fighters, foes and weapon avatars: idle loops, reactions, moods (/dev/fighters is their studio). */
import { thirdCard } from '../shot-kit.mjs';

const kind = tab => (tab === 'fighters' ? 'fighter' : 'enemy');
const cardOf = (tab, card) => `studio-${kind(tab)}-card-${card}`;
/** Press a reaction button without scrolling to it (a click from code: RN-web presses on click) */
const press = (page, tab, reaction) =>
  page.evaluate(sel => document.querySelector(sel).click(), `[data-testid="studio-${kind(tab)}-react-${reaction}"]`);

/**
 * A reaction in the creature studio, clipped to one creature's card.
 * Every creature on the tab reacts at once; the clip keeps the numbers about one.
 * Idle life never stops, so these shots have a fixed length.
 */
const studioReaction = (id, about, { tab, reaction, card = 0, mood = 'idle', hp = 0, frames = 72, actions, effectsOff = false, streak } = {}) => ({
  id,
  about,
  path: '/dev/fighters',
  ready: (page, h) => h.until('studio-tab-fighters'),
  prepare: async (page, h) => {
    if (tab !== 'fighters') await h.go(`studio-tab-${tab}`);
    await h.go(`studio-mood-${mood}`);
    await h.go(`studio-hp-${hp}`);
    if (effectsOff) await h.go('studio-effects-off');
    if (streak !== undefined) await h.go(`studio-streak-${streak}`);
    // The reaction buttons sit below the creatures: bring the creature into view and press the
    // button from code, so the page does not scroll between the trigger and the frames
    await page.evaluate(sel => document.querySelector(sel).scrollIntoView({ block: 'center' }), `[data-testid="${cardOf(tab, card)}"]`);
    // Let the mood and health settle into their pose before the reaction
    await h.advance(1200);
  },
  trigger: page => press(page, tab, reaction),
  clip: cardOf(tab, card),
  frames,
  ...(actions ? { actions } : {}),
});

/** Tap a reaction button again on frame `at` (a chain of hits) */
const again = (at, tab, reaction) => ({ at, do: page => press(page, tab, reaction) });

export default {
  'foe-hit': studioReaction('foe-hit', 'A foe takes one Set hit (creature studio, first foe card)', { tab: 'enemies', reaction: 'pain' }),
  'foe-crit': studioReaction('foe-crit', 'A foe takes a critical hit: rainbow, surge, piñata (creature studio)', { tab: 'enemies', reaction: 'crit_pain', frames: 84 }),
  'foe-chain': studioReaction('foe-chain', 'Three hits 12 frames apart, like the beats of a short cascade (187 ms steps) (creature studio)', {
    tab: 'enemies',
    reaction: 'pain',
    frames: 96,
    actions: [again(12, 'enemies', 'pain'), again(24, 'enemies', 'pain')],
  }),
  'foe-hit-quiet': studioReaction('foe-hit-quiet', 'One Set hit with the Effects switch off: the face and stars, no movement (creature studio)', { tab: 'enemies', reaction: 'pain', effectsOff: true }),
  // A plain Set in a real fight with no weapon that heals (fight-set on 1-5 can roll a heal, which plays the heal reaction instead)
  'fight-cheer': thirdCard('fight-cheer', 'A plain Set in a real fight (1-3): the fighter cheers it while the foe takes it', true, {}, '1-3'),
  'fighter-joy': studioReaction('fighter-joy', 'The fighter cheers a single Set (creature studio, first fighter card)', { tab: 'fighters', reaction: 'joy', streak: 1 }),
  'fighter-streak': studioReaction('fighter-streak', 'The fighter cheers a Set on a streak of 5 (creature studio)', { tab: 'fighters', reaction: 'joy', streak: 5 }),
  'fighter-ecstatic': studioReaction('fighter-ecstatic', 'The fighter cheers something that has already landed (a rainbow, a combo, a knockout): the hop at once', { tab: 'fighters', reaction: 'ecstatic', streak: 1 }),
  'fighter-joy-quiet': studioReaction('fighter-joy-quiet', 'A Set cheer with the Effects switch off: face and marks, no movement (creature studio)', { tab: 'fighters', reaction: 'joy', streak: 1, effectsOff: true }),
};
