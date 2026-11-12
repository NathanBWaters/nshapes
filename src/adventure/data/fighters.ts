/**
 * Fighters (characters). A fighter brings no gear: its identity is two
 * passives that change HOW you play (data/passives.ts), grown through a
 * web-shaped skill tree bought with stars (data/skillTrees.ts). Charms are the
 * whole weapon loadout.
 */
import type { CharacterName } from '@/types';
import type { FighterDef } from '../types';

export const FIGHTERS: FighterDef[] = [
  {
    name: 'Orange Tabby',
    icon: 'lorc/cat',
    signature: 'fighter_healing',
    blurb: 'Risky brawler: every missing heart hits harder, and one knockout is never the end.',
    passives: ['nine_lives', 'scrappy'],
  },
  {
    name: 'Sly Fox',
    icon: 'caro-asercion/fox',
    signature: 'fighter_fire',
    blurb: 'Speed demon: chain Sets inside 5 seconds, then cash a max Combo in for double damage.',
    passives: ['combo', 'hot_streak'],
  },
  {
    name: 'Badger',
    icon: 'caro-asercion/badger',
    signature: 'fighter_grace',
    blurb: 'Gambler: guess boldly. Every mistake is ammo, and the first one each wave is free.',
    passives: ['grudge', 'thick_hide'],
  },
  {
    name: 'Emperor Penguin',
    icon: 'delapouite/penguin',
    signature: 'fighter_foresight',
    blurb: 'Sniper: wait for the perfect Set, then freeze the world with a Rainbow Strike.',
    passives: ['patience', 'deep_freeze'],
  },
  {
    name: 'Corgi',
    icon: 'delapouite/sitting-dog',
    signature: 'fighter_growth',
    blurb: 'Board shaper: fetches power and gold cards, then zooms the whole board clean.',
    passives: ['zoomies', 'fetch'],
  },
  {
    name: 'Pelican',
    icon: 'delapouite/eating-pelican',
    signature: 'fighter_oracle',
    blurb: 'Laid-back: free Sets, free glows. The board does half the work for you.',
    passives: ['big_scoop', 'keen_eye'],
  },
];

export const STARTING_FIGHTERS: CharacterName[] = ['Orange Tabby'];

export const getFighter = (name: string): FighterDef => {
  const f = FIGHTERS.find(x => x.name === name);
  if (!f) throw new Error(`Unknown fighter ${name}`);
  return f;
};
