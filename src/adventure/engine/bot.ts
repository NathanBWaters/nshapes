/**
 * Headless bot that plays a level through the same reducer the UI uses.
 * Used to tune foe HP / timers against target star rates. It plays the save
 * it is given, or with a BuildPlan gears up first like a player at the
 * preview (botBuilds.ts: skill nodes for the stars earned, charms, recipes).
 */
import type { AttributeName, Card, Weapon } from '@/types';
import { isValidCombination } from '@/utils/gameUtils';
import { getBoardSizeForAttributes } from '@/utils/gameConfig';
import { resolveMatch } from '@/utils/matchResolution';
import type { AdventureSave, ChallengeDef, LevelDef, RunState } from '../types';
import { createRng, type Rng } from './rng';
import { computeStars, createRun, runReducer, shopPrice } from './run';
import { allSets, countDifferentAttributes, isRainbow, isSelectable } from './sets';
import { albumPageOf } from './gear';
import type { Modifiers } from '../rules/types';
import { challengeCount } from './challenges';
import { snareTarget } from './fight';
import { armedRecipesFor } from './sources';
import { gearUp, type BuildPlan } from './botBuilds';

export interface BotProfile {
  name: string;
  /** Seconds to find a Set, per active attribute */
  secondsPerAttribute: number;
  /** Chance a "found" Set is actually a mistake */
  mistakeRate: number;
  /** Prefers rainbow Sets when one exists */
  huntsRainbows: boolean;
  /** Chance to press the hint bulb when a search is running slow */
  hintEagerness: number;
  /** Share of mistakes that are near misses (one trait off): what graces forgive */
  nearMissRate: number;
  /** Chance to guess boldly on a slow search while a grace would cover a near miss */
  boldness: number;
}

export const BOTS: Record<'novice' | 'average' | 'expert', BotProfile> = {
  novice: { name: 'novice', secondsPerAttribute: 3.2, mistakeRate: 0.18, huntsRainbows: false, hintEagerness: 0.75, nearMissRate: 0.6, boldness: 0.4 },
  average: { name: 'average', secondsPerAttribute: 2.2, mistakeRate: 0.1, huntsRainbows: true, hintEagerness: 0.5, nearMissRate: 0.7, boldness: 0.3 },
  expert: { name: 'expert', secondsPerAttribute: 1.4, mistakeRate: 0.04, huntsRainbows: true, hintEagerness: 0.3, nearMissRate: 0.8, boldness: 0.2 },
};

/** Cards a snare points at (matching one defuses it) and snared cards (matching one hurts). */
const trapCards = (s: RunState) => {
  const defusers = new Set<string>();
  const snared = new Set<string>();
  s.board.forEach((c, i) => {
    if (!c.snare) return;
    snared.add(c.id);
    const t = snareTarget(i, c.snare, s.board.length);
    if (t !== null) defusers.add(s.board[t].id);
  });
  // Level time bombs and a foe's bomb / countdown cards all blow up if left alone
  const bombs = new Set([...s.timeBombIds, ...s.board.filter(c => c.hasBomb || c.hasCountdown).map(c => c.id)]);
  return { defusers, snared, bombs };
};

type Goal = ChallengeDef['kind'] | 'triple' | 'faceDown' | 'safe';

/** What a foe's own defeat condition asks the player to go for (read off its text, as a player would). */
const ENEMY_GOALS: [RegExp, Goal][] = [
  [/all-different/i, 'rainbows'],
  [/triple/i, 'triple'],
  [/bomb|countdown/i, 'defuseTraps'],
  [/face-down|revealed/i, 'faceDown'],
  [/damage/i, 'safe'],
];

/** The live ★★★ goals, while they still need work (a real player reads the challenge and chases it). */
const chasing = (s: RunState): Goal[] => {
  const c = s.level.challenge;
  if (c.kind === 'enemy') {
    if (s.foe.checkDefeatCondition(s.roundStats)) return [];
    const text = s.foe.defeatConditionText ?? '';
    return ENEMY_GOALS.filter(([re]) => re.test(text)).map(([, goal]) => goal);
  }
  if (c.kind === 'fullHearts') return s.roundStats.damageReceived === 0 ? ['fullHearts'] : [];
  if (!('n' in c) || c.n === undefined) return [];
  const count = challengeCount(s, c);
  return count !== null && count < c.n ? [c.kind] : [];
};

/**
 * Which Set a player who can see the board picks: a careful player goes for
 * the Catalyst, defuses traps and avoids snared cards more often than not,
 * and leans hard into whatever the ★★★ challenge asks for.
 */
const chooseSet = (s: RunState, sets: Card[][], bot: BotProfile, rng: Rng): Card[] => {
  const care = bot.huntsRainbows ? 0.6 : 0.3;
  const focus = bot.huntsRainbows ? 0.85 : 0.6;
  const { defusers, snared, bombs } = trapCards(s);
  const has = (set: Card[], ids: Set<string>) => set.some(c => ids.has(c.id));
  const prefer = (pred: (set: Card[]) => boolean, chance = care) => {
    const hits = sets.filter(pred);
    return hits.length && rng.next() < chance ? rng.pick(hits) : null;
  };
  const rainbow = (set: Card[]) => isRainbow(set, s.attributes);
  const goalPick = (goal: Goal): Card[] | null => {
    switch (goal) {
      case 'evolutions': return prefer(set => set.some(c => c.hasEvolutionItem), focus);
      case 'defuseTraps': return prefer(set => has(set, bombs) || has(set, defusers), focus);
      case 'fullHearts':
      case 'safe':
        // Untouched: clear the traps before they bite, and never touch a snared card
        return prefer(set => has(set, bombs) || has(set, defusers), focus) ?? prefer(set => !has(set, snared), focus);
      case 'triple': return prefer(set => set.some(c => (c.health ?? 1) > 1), focus);
      case 'faceDown': return prefer(set => set.some(c => c.wasOriginallyFaceDown), focus);
      case 'bonusCards': return prefer(set => set.some(c => (c.bonusPoints ?? 0) > 0 || (c.bonusMoney ?? 0) > 0), focus);
      case 'rainbows':
      case 'bigHit': return s.features.has('rainbow') ? prefer(rainbow, focus) : null;
      case 'purityChain': {
        if (!s.features.has('purity') || rng.next() >= focus) return null;
        // Climb on purpose: the least diverse Set that still beats the last step
        const floor = s.purityChain > 0 ? s.lastDiffCount : 0;
        const climbing = sets.filter(set => countDifferentAttributes(set, s.attributes) > floor);
        if (!climbing.length) return null;
        const low = Math.min(...climbing.map(set => countDifferentAttributes(set, s.attributes)));
        return rng.pick(climbing.filter(set => countDifferentAttributes(set, s.attributes) === low));
      }
      default: return null;
    }
  };
  const held = (key: 'mirrorDamage' | 'albumDamage') => s.weapons.some(w => !!(w as { modifiers?: Modifiers }).modifiers?.[key]);
  const mirrorHeld = held('mirrorDamage');
  const albumHeld = held('albumDamage');
  const lastSlots = new Set(mirrorHeld ? s.gear.lastSetSlots.map(i => s.board[i]?.id) : []);
  let picked: Card[] | null = null;
  for (const goal of chasing(s)) picked ??= goalPick(goal);
  return (
    picked ??
    prefer(set => set.some(c => c.hasEvolutionItem)) ??
    prefer(set => has(set, bombs) || has(set, defusers)) ??
    // Trick weapons give a player something to hunt: the marked card, a spot from the last Set
    prefer(set => set.some(c => c.magnet)) ??
    (mirrorHeld ? prefer(set => set.some(c => lastSlots.has(c.id))) : null) ??
    (albumHeld ? prefer(set => albumPageOf(set, s.attributes, s.gear.album) !== null) : null) ??
    (bot.huntsRainbows && s.features.has('rainbow') && rng.next() < 0.5 ? prefer(rainbow) : null) ??
    prefer(set => !has(set, snared)) ??
    rng.pick(sets)
  );
};

/** Three selectable cards exactly one trait off a Set (what a grace forgives), or null. */
const nearMiss = (cards: Card[], attrs: AttributeName[], rng: Rng): Card[] | null => {
  const pool = rng.shuffle(cards);
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++)
      for (let k = j + 1; k < pool.length; k++) {
        const v = isValidCombination([pool[i], pool[j], pool[k]], attrs);
        if (!v.isValid && v.invalidAttributes.length === 1) return [pool[i], pool[j], pool[k]];
      }
  return null;
};

/**
 * GameBoard rolls weapon effects with Math.random, so the bot swaps in a seeded
 * source while it plays; that keeps balance numbers reproducible run to run.
 */
export interface SimOptions {
  /** Pass on every level-up pick and shop offer, so the fight measures only what was brought in */
  skipPicks?: boolean;
}

export const simulateRun = (level: LevelDef, save: AdventureSave, bot: BotProfile, seed: number, plan?: BuildPlan, opts: SimOptions = {}) => {
  const realRandom = Math.random;
  const boardRng = createRng(seed ^ 0x5bd1e995);
  Math.random = boardRng.next;
  try {
    return playRun(level, plan ? gearUp(save, plan, seed) : save, bot, seed, plan?.chaseRecipes !== false, opts);
  } finally {
    Math.random = realRandom;
  }
};

/** Seconds of standing still the foe punishes, read off its ability text ("30s inactivity → …"), or null. */
const inactivityLimit = (s: RunState): number | null => {
  const m = /(\d+)s inactivity/.exec(s.foe.description ?? '');
  return m ? Number(m[1]) : null;
};

/**
 * Submit three picked cards the way GameBoard does: a Set (or a near miss a
 * grace covers) scores through the same match resolution, anything else is a
 * mistake. Either way the cards are replaced.
 */
const submit = (s: RunState, picked: Card[]): RunState => {
  const v = isValidCombination(picked, s.attributes);
  const graceUsed = !v.isValid && v.invalidAttributes.length === 1 && s.stats.graces > 0;
  if (v.isValid || graceUsed) {
    const { cards, rewards, weaponEffects } = resolveMatch({
      board: s.board,
      selected: picked,
      playerStats: s.stats,
      weapons: s.weapons,
      activeAttributes: s.attributes,
      connections: s.connections,
      graceUsed,
    });
    const next = runReducer(s, { type: 'MATCH', cards, rewards, effects: weaponEffects });
    return runReducer(next, { type: 'REPLACE', ids: cards.map(c => c.id) });
  }
  const next = runReducer(s, { type: 'INVALID', cards: picked });
  return runReducer(next, { type: 'REPLACE', ids: picked.map(c => c.id) });
};

/**
 * A weapon a player would grab: one that arms a new evolution recipe first,
 * otherwise any (a spread of picks across runs, not always the first card).
 */
const preferred = (s: RunState, options: Weapon[], rng: Rng, chase = true): number => {
  if (!options.length) return -1;
  if (!chase) return Math.floor(rng.next() * options.length);
  const armed = s.armedRecipes.length;
  const arming = options.map((w, i) => [w, i] as const).filter(([w]) => armedRecipesFor([...s.weapons, w], s.unlockedEvolutions).length > armed);
  return arming.length ? rng.pick(arming)[1] : Math.floor(rng.next() * options.length);
};

/** Between waves: buy what the purse covers (a recipe piece first; keep buying while the ★★★ asks for it). */
const shop = (s: RunState, rng: Rng, chase: boolean): RunState => {
  for (let guard = 0; guard < 3 && s.shopOptions.length; guard++) {
    const affordable = s.shopOptions.filter(w => shopPrice(w) <= s.coins);
    if (!affordable.length) break;
    const pick = affordable[preferred(s, affordable, rng, chase)];
    s = runReducer(s, { type: 'BUY', index: s.shopOptions.indexOf(pick) });
    if (!chasing(s).includes('shopBuys')) break;
  }
  return s;
};

const playRun = (level: LevelDef, save: AdventureSave, bot: BotProfile, seed: number, chase: boolean, opts: SimOptions = {}) => {
  const rng = createRng(seed ^ 0x9e3779b9);
  let s = createRun(level, save, { seed });
  let guard = 0;
  while ((s.status === 'playing' || s.status === 'pick' || s.status === 'intermission') && guard++ < 2000) {
    if (s.status === 'pick') {
      // Level up: take a free weapon
      const pick = opts.skipPicks ? null : s.pickOptions[preferred(s, s.pickOptions, rng, chase)]?.id ?? null;
      s = runReducer(s, { type: 'PICK', weaponId: pick });
      continue;
    }
    if (s.status === 'intermission') {
      if (!opts.skipPicks) s = shop(s, rng, chase);
      s = runReducer(s, { type: 'NEXT_WAVE' });
      continue;
    }
    // Keen Eye lights a card of a Set: the bot finds one twice as fast
    const glow = s.passive.keenEyeCardId ? 0.5 : 1;
    // Fewer cards to scan is a faster search: a board eaten down to half size takes ~70% as long
    const fullBoard = s.level.rules.boardSize ?? getBoardSizeForAttributes(s.attributes.length);
    const crowd = Math.sqrt(Math.min(1, Math.max(0.25, s.board.filter(isSelectable).length / fullBoard)));
    const pace = 0.6 + rng.next() * 0.8;
    // A simplified board has one trait the same on every card: one less thing to compare
    const traits = Math.max(1, s.attributes.length - (s.simplified ? 1 : 0));
    // A wild card makes a Set with any two cards: nothing to search for
    const wild = s.board.some(c => c.isWild && isSelectable(c)) ? 0.4 : 1;
    let think = bot.secondsPerAttribute * traits * pace * glow * crowd * wild;
    // A slow search (or a "use hints" goal) is when a real player presses the bulb
    const slow = pace > 1;
    const goals = chasing(s);
    const canHint = s.features.has('hints') && s.stats.hints > 0;
    let hinted = canHint && (goals.includes('useHints') || (slow && rng.next() < bot.hintEagerness));
    if (hinted) {
      s = runReducer(s, { type: 'USE_HINT' });
      think *= 0.5;
    }
    // With a grace in hand a near miss is free, so a slow search ends in a bold guess
    const graces = s.features.has('graces') ? s.stats.graces : 0;
    const bold = !hinted && graces > 0 && (goals.includes('graceSaves') ? pace > 0.8 : slow && rng.next() < bot.boldness);
    if (bold) think *= 0.5;
    // A foe that punishes standing still (its card says "30s inactivity"): with the
    // deadline close, press the bulb, and failing that, rush (and slip more often)
    let rushed = false;
    const limit = inactivityLimit(s);
    if (limit !== null) {
      const left = limit - (s.elapsedMs - s.lastMatchAtMs) / 1000 - 2;
      if (think > left && !hinted && s.features.has('hints') && s.stats.hints > 0) {
        s = runReducer(s, { type: 'USE_HINT' });
        think *= 0.5;
        hinted = true;
      }
      if (think > left) {
        think = Math.max(1, left);
        rushed = true;
      }
    }
    const ticks = Math.max(1, Math.round(think));
    for (let i = 0; i < ticks && s.status === 'playing'; i++) s = runReducer(s, { type: 'TICK', ms: 1000 });
    if (s.status !== 'playing') continue; // won, lost, or the foe fell between Sets (wave over)

    // Burning cards burn out (GameBoard does this a quarter second after they catch)
    for (const c of s.board.filter(x => x.onFire)) {
      if (s.status !== 'playing') break;
      s = runReducer(s, { type: 'BURN', card: c });
    }
    if (s.status !== 'playing') continue; // won, lost, or the foe fell between Sets (wave over)

    const selectableCards = s.board.filter(isSelectable);
    if (selectableCards.length < 3) {
      s = runReducer(s, { type: 'TICK', ms: 1000 });
      continue;
    }
    const sets = allSets(s.board, s.attributes);
    // A hinted card makes a slip half as likely
    const slip = rng.next() < bot.mistakeRate * (hinted ? 0.5 : 1) * (rushed ? 2 : 1);
    if (bold || !sets.length || slip) {
      // Mistakes are mostly near misses (one trait off), which a grace forgives
      const near = bold || rng.next() < bot.nearMissRate ? nearMiss(selectableCards, s.attributes, rng) : null;
      s = submit(s, near ?? rng.shuffle(selectableCards).slice(0, 3));
      continue;
    }
    s = submit(s, chooseSet(s, sets, bot, rng));
  }
  return { stars: computeStars(s), coins: s.coins, state: s };
};

/** Star spread over `runs` seeded runs; with a plan, each run gears up its own build (gearUp). */
export const starDistribution = (level: LevelDef, save: AdventureSave, bot: BotProfile, runs = 60, plan?: BuildPlan) => {
  const dist = [0, 0, 0, 0];
  let coins = 0;
  for (let i = 0; i < runs; i++) {
    const r = simulateRun(level, save, bot, 1000 + i * 7919, plan);
    dist[r.stars] += 1;
    coins += r.coins;
  }
  return { dist: dist.map(n => n / runs), avgCoins: coins / runs };
};
