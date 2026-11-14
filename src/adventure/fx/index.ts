/** Fight effects: see docs/fx-design.md. */
export { Anchor, AnchorsProvider, useAnchors, useBump, type Anchors } from './anchors';
export { EVENT_FX, FX_COLOR } from './catalog';
export { fxClock } from './clock';
export { EvolutionCutIn } from './EvolutionCutIn';
export { FxStage } from './FxStage';
export { GearBelt } from './GearBelt';
export { FX_TIMING, HIT_TIERS, hitTier, scriptFor, scriptHoldMs, strideFor } from './script';
export type { AnchorName, Beat, FxRow, HitTier, Script, Segment } from './types';
export { useFightFx, type FightFx } from './useFightFx';
