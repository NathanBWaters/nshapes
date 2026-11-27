/**
 * [TP-09] Reproducible PR & "Combo of the Day" showcase shots.
 *
 * Designed to pair with `--clip` and `--slowmo-impact` in `scripts/motion/capture.mjs`
 * (or `npm run pr:clip -- <shot> --slowmo-impact`) to emit 60fps MP4 / WebM / GIF clips
 * straight from live deterministic gameplay — zero manual screen recording.
 *
 * Showcase roster:
 *   - `pr:cascade`  Phoenix Pyre Cascade (Orange Tabby + Blast Powder + Mending Charm + Prismatic Ray + Echo Stone)
 *   - `pr:parry`    Perfect Orange Counter-Parry (Crimson Ambush ALL ORANGE golden window shatter)
 *   - `pr:rainbow`  Rainbow Nova Sweep (Emperor Penguin all-different Rainbow Set + Deep Freeze + Blast Powder)
 *   - `pr:boss-ko`  Boss Kill-Cam Knockout (Iron Shell 1-10 Boss lethal finisher + Clair-Obscur shatter)
 */
import { findCards, slotOf } from '../shot-kit.mjs';

const waitIntoDirectFight = async (h) => {
  await h.until('run-foe-hp');
  await h.until(async () => !(await h.present('run-opening')));
  await h.advance(2800);
};

/** Opens the dev FightDebugDrawer, taps one or more control testIDs, and closes it so captures stay 100% clean. */
const triggerDebugControls = async (h, controlTestIds) => {
  await h.go('debug-drawer-toggle');
  await h.until('debug-drawer-panel');
  for (const id of controlTestIds) {
    await h.go(id);
    await h.advance(160);
  }
  await h.go('debug-drawer-toggle');
  await h.advance(240);
};

/** Finds a valid Set matching an optional predicate on the 3 cards (falls back to any valid Set). */
const findSetMatching = (page, kind) =>
  page.evaluate((matchKind) => {
    const run = window.__nshapesRun;
    if (!run || !run.board) return null;
    const { board, attributes } = run;
    const playable = (c) => c && !c.isDud && !c.isFaceDown && !c.isLocked;
    const isSet = (a, b, c) => attributes.every((k) => new Set([a[k], b[k], c[k]]).size !== 2);
    const matchesKind = (a, b, c) => {
      if (matchKind === 'orange') return a.color === 'red' && b.color === 'red' && c.color === 'red';
      if (matchKind === 'rainbow') return attributes.every((k) => new Set([a[k], b[k], c[k]]).size === 3);
      if (matchKind === 'catalyst') return Boolean(a.isCatalyst || b.isCatalyst || c.isCatalyst);
      return true;
    };
    let fallback = null;
    for (let i = 0; i < board.length; i++) {
      for (let j = i + 1; j < board.length; j++) {
        for (let k = j + 1; k < board.length; k++) {
          const a = board[i];
          const b = board[j];
          const c = board[k];
          if (!playable(a) || !playable(b) || !playable(c)) continue;
          if (!isSet(a, b, c)) continue;
          if (matchesKind(a, b, c)) return [i, j, k];
          if (!fallback) fallback = [i, j, k];
        }
      }
    }
    return fallback;
  }, kind);

const buildPrShot = ({ id, about, path, debugControls = [], matchKind = 'any', frames = 180, actions }) => {
  let third = null;
  return {
    id,
    about,
    path,
    ready: (page, h) => h.until('run-foe-hp'),
    prepare: async (page, h) => {
      await waitIntoDirectFight(h);
      if (debugControls.length > 0) {
        await triggerDebugControls(h, debugControls);
      }
      const cards = (await findSetMatching(page, matchKind)) ?? (await findCards(page, true));
      if (!cards) throw new Error(`No matching Set (${matchKind}) available for ${id}`);
      await h.tap(slotOf(cards[0]));
      await h.advance(220);
      await h.tap(slotOf(cards[1]));
      await h.advance(220);
      third = slotOf(cards[2]);
    },
    trigger: (page, h) => h.tap(third),
    frames,
    ...(actions ? { actions } : {}),
  };
};

export default {
  'pr:cascade': buildPrShot({
    id: 'pr:cascade',
    about: 'PR Showcase — Phoenix Pyre Cascade: Orange Tabby fires Catalyst + Blast Powder + Prismatic Ray + Echo Stone on 2-4',
    path: '/dev/adventure?save=maxed&level=2-4&fighter=Orange+Tabby&weapons=blast-powder,mending-charm,prismatic-ray,echo-stone&seed=4242&intro=false',
    debugControls: ['debug-spawn-catalyst'],
    matchKind: 'catalyst',
    frames: 192,
  }),
  'pr:parry': buildPrShot({
    id: 'pr:parry',
    about: 'PR Showcase — Perfect Orange Counter-Parry: Crimson Ambush golden window shattered by an All-Orange Trio on 2-4',
    path: '/dev/adventure?save=maxed&level=2-4&fighter=Sly+Fox&weapons=blast-powder,war-drum,prismatic-ray&seed=4242&intro=false',
    debugControls: ['debug-parry-perfect'],
    matchKind: 'orange',
    frames: 168,
  }),
  'pr:rainbow': buildPrShot({
    id: 'pr:rainbow',
    about: 'PR Showcase — Rainbow Nova Sweep: Emperor Penguin lands an all-different Rainbow Set with Rainbow Charm + Blast Powder on 2-9',
    path: '/dev/adventure?save=maxed&level=2-9&fighter=Emperor+Penguin&weapons=rainbow-charm,blast-powder,prismatic-ray,chaos-shard&seed=4242&intro=false',
    matchKind: 'rainbow',
    frames: 180,
  }),
  'pr:boss-ko': buildPrShot({
    id: 'pr:boss-ko',
    about: 'PR Showcase — Boss Kill-Cam Knockout: Iron Shell (1-10) shattered in Clair-Obscur slow-mo finisher',
    path: '/dev/adventure?save=maxed&level=1-10&fighter=Orange+Tabby&weapons=blast-powder,prismatic-ray,echo-stone,war-drum&seed=4242&intro=false',
    debugControls: ['debug-foe-hp-1'],
    matchKind: 'any',
    frames: 210,
  }),
};
