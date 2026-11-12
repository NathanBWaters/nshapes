/**
 * Headless bot that plays a level through the same reducer the UI uses.
 * Used to tune foe HP / timers against target star rates.
 */
import type { Card, CardReward } from '@/types';
import { MATCH_REWARDS } from '@/utils/gameConfig';
import { processWeaponEffects } from '@/utils/weaponEffects';
import type { AdventureSave, LevelDef } from '../types';
import { createRng } from './rng';
import { computeStars, createRun, runReducer } from './run';
import { allSets } from './sets';

export interface BotProfile {
  name: string;
  /** Seconds to find a Set, per active attribute */
  secondsPerAttribute: number;
  /** Chance a "found" Set is actually a mistake */
  mistakeRate: number;
  /** Prefers rainbow Sets when one exists */
  huntsRainbows: boolean;
}

export const BOTS: Record<'novice' | 'average' | 'expert', BotProfile> = {
  novice: { name: 'novice', secondsPerAttribute: 3.2, mistakeRate: 0.18, huntsRainbows: false },
  average: { name: 'average', secondsPerAttribute: 2.2, mistakeRate: 0.1, huntsRainbows: true },
  expert: { name: 'expert', secondsPerAttribute: 1.4, mistakeRate: 0.04, huntsRainbows: true },
};

const rewardFor = (c: Card): CardReward => ({
  cardId: c.id,
  points: MATCH_REWARDS.basePoints + (c.bonusPoints ?? 0),
  money: MATCH_REWARDS.baseMoney + (c.bonusMoney ?? 0),
  experience: MATCH_REWARDS.baseExperience,
});

export const simulateRun = (level: LevelDef, save: AdventureSave, bot: BotProfile, seed: number) => {
  const rng = createRng(seed ^ 0x9e3779b9);
  let s = createRun(level, save, { seed });
  let guard = 0;
  while ((s.status === 'playing' || s.status === 'pick' || s.status === 'intermission') && guard++ < 2000) {
    if (s.status === 'pick') {
      s = runReducer(s, { type: 'PICK', weaponId: s.pickOptions[0]?.id ?? null });
      continue;
    }
    if (s.status === 'intermission') {
      if (s.shopOptions.length && s.coins > 60) s = runReducer(s, { type: 'BUY', index: 0 });
      s = runReducer(s, { type: 'NEXT_WAVE' });
      continue;
    }
    // Fire a charged active ability straight away
    if (s.ability && s.ability.max > 0 && s.ability.charge >= s.ability.max) {
      s = runReducer(s, { type: 'ABILITY' });
      if (s.ability?.id === 'big_scoop' && s.ability.scooped.length) s = runReducer(s, { type: 'REPLACE', ids: s.ability.scooped });
      continue;
    }
    // Think
    const think = bot.secondsPerAttribute * s.attributes.length * (0.6 + rng.next() * 0.8);
    const ticks = Math.max(1, Math.round(think));
    for (let i = 0; i < ticks && s.status === 'playing'; i++) s = runReducer(s, { type: 'TICK', ms: 1000 });
    if (s.status !== 'playing') break;

    const selectableCards = s.board.filter(c => !c.isDud && !c.isFaceDown);
    const sets = allSets(s.board, s.attributes);
    let set: Card[] | null = sets.length ? rng.pick(sets) : null;
    if (set && bot.huntsRainbows && s.features.has('rainbow')) {
      // a rainbow-hunter spots one about half the time when it exists
      const rainbows = sets.filter(cand => s.attributes.every(a => new Set(cand.map(c => c[a as keyof Card])).size === 3));
      if (rainbows.length && rng.next() < 0.5) set = rng.pick(rainbows);
    }
    if (!set || rng.next() < bot.mistakeRate) {
      if (selectableCards.length < 3) {
        s = runReducer(s, { type: 'TICK', ms: 1000 });
        continue;
      }
      const wrong = rng.shuffle(selectableCards).slice(0, 3);
      s = runReducer(s, { type: 'INVALID', cards: wrong });
      s = runReducer(s, { type: 'REPLACE', ids: wrong.map(c => c.id) });
      continue;
    }
    const fx = s.features.has('gear') ? processWeaponEffects(s.board, set, s.stats, s.weapons, s.attributes) : undefined;
    const extra = fx ? [...fx.explosiveCards, ...fx.laserCards, ...fx.ricochetCards, ...fx.autoMatchedSets.flat()] : [];
    const all = [...set, ...extra.filter(c => !set!.some(x => x.id === c.id))];
    const rewards = all.map(rewardFor);
    s = runReducer(s, { type: 'MATCH', cards: all, rewards, effects: fx, nowMs: 0 });
    s = runReducer(s, { type: 'REPLACE', ids: all.map(c => c.id) });
  }
  return { stars: computeStars(s), coins: s.coins, state: s };
};

export const starDistribution = (level: LevelDef, save: AdventureSave, bot: BotProfile, runs = 60) => {
  const dist = [0, 0, 0, 0];
  let coins = 0;
  for (let i = 0; i < runs; i++) {
    const r = simulateRun(level, save, bot, 1000 + i * 7919);
    dist[r.stars] += 1;
    coins += r.coins;
  }
  return { dist: dist.map(n => n / runs), avgCoins: coins / runs };
};
