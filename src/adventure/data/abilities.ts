/**
 * Fighter signature abilities — each fighter brings ONE new rule to the board
 * that no weapon provides. Passives change how the fight scores; actives charge
 * up from Sets and are fired with a button.
 *
 * Engine behaviour lives in engine/run.ts (search for `ability.id`); this table
 * holds tuning and text so it can be rebalanced without touching the reducer.
 */
import type { CharacterName } from '@/types';
import type { IconName } from '@/components/Icon';

export type AbilityId = 'nine_lives' | 'combo' | 'grudge' | 'deep_freeze' | 'zoomies' | 'big_scoop';

export interface AbilityDef {
  id: AbilityId;
  fighter: CharacterName;
  kind: 'passive' | 'active';
  name: string;
  icon: IconName;
  short: string;
  /** Active abilities: Sets needed to charge */
  chargeSets?: number;
}

export const ABILITY_TUNING = {
  comboWindowMs: 5000,
  comboMax: 4,
  grudgeMax: 3,
  grudgeDamage: 3,
  freezeMs: 6000,
} as const;

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  nine_lives: {
    id: 'nine_lives', fighter: 'Orange Tabby', kind: 'passive', name: 'Nine Lives', icon: 'lorc/cat',
    short: 'Once per fight, a hit that would knock you out leaves you on 1 heart.',
  },
  combo: {
    id: 'combo', fighter: 'Sly Fox', kind: 'passive', name: 'Combo', icon: 'lorc/lightning-branches',
    short: 'Sets within 5s of each other build a combo: +1 damage per step (max +4). A mistake breaks it.',
  },
  grudge: {
    id: 'grudge', fighter: 'Badger', kind: 'passive', name: 'Grudge', icon: 'lorc/fist',
    short: 'Every mistake stores a grudge (max 3). Your next Set unleashes +3 damage per grudge.',
  },
  deep_freeze: {
    id: 'deep_freeze', fighter: 'Emperor Penguin', kind: 'active', name: 'Deep Freeze', icon: 'lorc/snowflake-1', chargeSets: 4,
    short: 'Charge with 4 Sets, then freeze the clock and the foe for 6 seconds.',
  },
  zoomies: {
    id: 'zoomies', fighter: 'Corgi', kind: 'active', name: 'Zoomies', icon: 'delapouite/jumping-dog', chargeSets: 3,
    short: 'Charge with 3 Sets, then zoom around and re-deal the whole board, clearing duds and hidden cards.',
  },
  big_scoop: {
    id: 'big_scoop', fighter: 'Pelican', kind: 'active', name: 'Big Scoop', icon: 'delapouite/eating-pelican', chargeSets: 4,
    short: 'Charge with 4 Sets, then scoop up a Set for you automatically.',
  },
};

export const abilityFor = (fighter: string): AbilityDef | null =>
  Object.values(ABILITIES).find(a => a.fighter === fighter) ?? null;
