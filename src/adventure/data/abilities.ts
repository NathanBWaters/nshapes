/**
 * Fighter signature abilities — each fighter brings ONE new rule to the board
 * that no weapon provides. Passives change how the fight scores; actives charge
 * up from Sets and are fired with a button.
 *
 * Engine behaviour lives in ABILITY_RULES in engine/run.ts; this table holds the
 * tuning, and the text is written from the same numbers.
 */
import type { CharacterName } from '@/types';
import type { IconName } from '@/components/Icon';
import type { AbilityId } from '../types';

export type { AbilityId };

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

const CHARGE_SETS = { deep_freeze: 4, zoomies: 3, big_scoop: 4 } as const;

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  nine_lives: {
    id: 'nine_lives', fighter: 'Orange Tabby', kind: 'passive', name: 'Nine Lives', icon: 'lorc/cat',
    short: 'Once per fight, a hit that would knock you out leaves you on 1 heart.',
  },
  combo: {
    id: 'combo', fighter: 'Sly Fox', kind: 'passive', name: 'Combo', icon: 'lorc/lightning-branches',
    short: `Sets within ${ABILITY_TUNING.comboWindowMs / 1000}s of each other build a combo: +1 damage per step (max +${ABILITY_TUNING.comboMax}). A mistake breaks it.`,
  },
  grudge: {
    id: 'grudge', fighter: 'Badger', kind: 'passive', name: 'Grudge', icon: 'lorc/fist',
    short: `Every mistake stores a grudge (max ${ABILITY_TUNING.grudgeMax}). Your next Set unleashes +${ABILITY_TUNING.grudgeDamage} damage per grudge.`,
  },
  deep_freeze: {
    id: 'deep_freeze', fighter: 'Emperor Penguin', kind: 'active', name: 'Deep Freeze', icon: 'lorc/snowflake-1', chargeSets: CHARGE_SETS.deep_freeze,
    short: `Charge with ${CHARGE_SETS.deep_freeze} Sets, then freeze the clock and the foe for ${ABILITY_TUNING.freezeMs / 1000} seconds.`,
  },
  zoomies: {
    id: 'zoomies', fighter: 'Corgi', kind: 'active', name: 'Zoomies', icon: 'delapouite/jumping-dog', chargeSets: CHARGE_SETS.zoomies,
    short: `Charge with ${CHARGE_SETS.zoomies} Sets, then zoom around and re-deal the whole board, clearing duds and hidden cards.`,
  },
  big_scoop: {
    id: 'big_scoop', fighter: 'Pelican', kind: 'active', name: 'Big Scoop', icon: 'delapouite/eating-pelican', chargeSets: CHARGE_SETS.big_scoop,
    short: `Charge with ${CHARGE_SETS.big_scoop} Sets, then scoop up a Set for you automatically.`,
  },
};

export const abilityFor = (fighter: string): AbilityDef | null =>
  Object.values(ABILITIES).find(a => a.fighter === fighter) ?? null;
