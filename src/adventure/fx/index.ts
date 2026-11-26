/** Fight effects: see docs/fx-design.md. */
export { Anchor, AnchorsProvider, useAnchors, useBump, type Anchors } from './anchors';
export { EVENT_FX, FX_COLOR } from './catalog';
export { fxClock } from './clock';
export { EvolutionCutIn } from './EvolutionCutIn';
export { FxStage } from './FxStage';
export { GearBelt } from './GearBelt';
export { default as KillCamOverlay, SLOWMO_HOLD_MS, SLOWMO_IMPACT_DELAY_MS, SLOWMO_REDUCED_TOTAL_MS, SLOWMO_RELEASE_MS, SLOWMO_SETTLE_PAD_MS, SLOWMO_TOTAL_MS } from './KillCamOverlay';
export { default as MultiplierIgnition, buildIgnitionPlan, heatTierFor } from './MultiplierIgnition';
export { FX_TIMING, HIT_TIERS, hitTier, recipeIdOfEvent, scriptFor, scriptHoldMs, strideFor } from './script';
export type { AnchorName, Beat, FxRow, HitTier, Script, Segment } from './types';
export { useFightFx, type FightFx } from './useFightFx';
