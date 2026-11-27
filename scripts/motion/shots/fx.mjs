/** Fight effects on the stand-in fight screen of the effects studio (/dev/fx). Any single event: `fx:<event>`. */
import { studio, tapScreenAt } from '../shot-kit.mjs';

export default {
  'fx-cascade': studio('fx-cascade', 'fx-cascade', 'A Set and everything it sets off, as one cascade (effects studio)'),
  'fx-hit-effects-off': studio('fx-hit-effects-off', 'fx-event-hit', "A Set's hit with the in-game Effects switch off: only its number shows (effects studio)", {
    prepare: (page, h) => h.tap('fx-reduced'),
  }),
  'fx-evolution': studio('fx-evolution', 'fx-evolution', 'Single-weapon Evolution Awakening cut-in, dismissed with a tap after 1.6 s (effects studio)', {
    actions: [tapScreenAt(100)],
    maxFrames: 220,
  }),
  'fx-evolution-2': studio('fx-evolution-2', 'fx-evolution-2', 'Two simultaneous single-weapon Evolution Awakenings queued back-to-back (effects studio)', {
    actions: [tapScreenAt(100), tapScreenAt(200)],
    maxFrames: 320,
  }),
  'fx-evolution-banner': studio('fx-evolution-banner', 'fx-evolution-banner', 'Repeat multi-weapon non-blocking EvolutionBanner coalescing (effects studio)', {
    maxFrames: 160,
  }),
  'fx-evo-almost': studio('fx-evo-almost', 'fx-showcase-evo-almost', 'Almost-Ready evolution anticipation pulse on GearBelt (effects studio)', {
    maxFrames: 72,
  }),
};
