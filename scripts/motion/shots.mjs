/**
 * The shots: every animation the motion loop can capture, by name.
 *
 * A shot says how to get to a moment in the running game and what starts it:
 *
 *   path      route to open (dev routes can jump anywhere: see Claude.md "Dev Testing")
 *   ready     (page, h) => wait until the screen is there: `h.until('test-id')`
 *   prepare   optional: click through to the state just before the moment: `h.go('test-id')` waits, then taps
 *   trigger   the tap (or other act) that starts the animation; frame 0 is taken right after it: `h.tap('test-id')`
 *   clip      optional: a selector or box to capture instead of the whole phone screen
 *   frames    optional: a fixed number of frames (default: until the picture has been still for a while)
 *   actions   optional: [{ at: frame, do: page => … }] things to do part-way (dismiss a cut-in)
 *   track     optional: extra selectors to measure (elements moved by inline transform / opacity are found automatically)
 *   loop      optional: { frames: N } for an endless loop of N frames: frame N is compared with frame 0
 *   ambient   optional: how many pixels may change per frame and still count as "nothing happening"
 *             (default: measured on the frames before the trigger; set 0 when the shot starts mid-action)
 *
 * The page's clock is virtual and stands still unless the capture moves it, so
 * never wait with Playwright's own waits (`waitFor`, `waitForTimeout`): a
 * screen that needs a timer to appear would never come. Use the helpers:
 *
 *   h.until(target)   advance time 16 ms at a time until the test id / selector / async fn is there
 *   h.tap(target)     click a test id or selector
 *   h.go(target)      until + tap
 *   h.advance(ms)     move time by hand
 *   h.evaluate(fn)    run something in the page (e.g. read window.__nshapesRun)
 *
 * Shots live in scripts/motion/shots/, one file per part of the game, so two
 * people adding shots at once do not collide. Building blocks for getting to
 * the usual places (a fight, the preview, the studio) are in shot-kit.mjs.
 *
 * Add a shot whenever you work on an animation that has none. A shot is the
 * animation's test: it is how the next agent sees what you saw.
 */

import { studio } from './shot-kit.mjs';
import board from './shots/board.mjs';
import creatures from './shots/creatures.mjs';
import fight from './shots/fight.mjs';
import fx from './shots/fx.mjs';
import results from './shots/results.mjs';
import screens from './shots/screens.mjs';

const AREAS = { fx, fight, board, creatures, results, screens };
const SHOTS = {};
for (const [area, shots] of Object.entries(AREAS)) {
  for (const [name, shot] of Object.entries(shots)) {
    if (SHOTS[name]) throw new Error(`Two shots are called "${name}" (the second is in shots/${area}.mjs)`);
    if (shot.id !== name) throw new Error(`Shot "${name}" in shots/${area}.mjs has id "${shot.id}"`);
    SHOTS[name] = { ...shot, area };
  }
}

export function resolveShot(name) {
  if (SHOTS[name]) return SHOTS[name];
  if (name.startsWith('fx:')) {
    const event = name.slice(3);
    return studio(name, `fx-event-${event}`, `Fight event "${event}" alone (effects studio)`);
  }
  throw new Error(`Unknown shot "${name}". Run: npm run motion:shots`);
}

export function describeShots() {
  const lines = ['Shots (scripts/motion/shots/<area>.mjs):'];
  for (const area of Object.keys(AREAS)) {
    const list = Object.values(SHOTS).filter(s => s.area === area);
    lines.push('', `${area}${list.length ? '' : '  (none yet)'}`);
    for (const s of list) lines.push(`  ${s.id.padEnd(20)} ${s.about}`);
    if (area === 'fx') lines.push(`  ${'fx:<event>'.padEnd(20)} Any one fight event, e.g. fx:hit, fx:blast, fx:heal (every key of EVENT_FX in src/adventure/fx/catalog.ts)`);
  }
  return lines.join('\n');
}
