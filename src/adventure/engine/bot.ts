/**
 * Headless bot that plays a level through the same reducer the UI uses.
 * Used to tune foe HP / timers against target star rates. It plays the save
 * it is given, or with a BuildPlan gears up first like a player at the
 * preview (botBuilds.ts: skill nodes for the stars earned, charms, recipes).
 */
import { setWouldGrow } from './growth';
import type { AttributeName, Card, Weapon } from '@/types';
import { isValidCombination } from '@/utils/gameUtils';
import { getAdjacentIndices } from '@/utils/weaponEffects';
import { getBoardSizeForAttributes } from '@/utils/gameConfig';
import { resolveMatch } from '@/utils/matchResolution';
import type { AdventureSave, ChallengeDef, LevelDef, RunState } from '../types';
import { createRng, type Rng } from './rng';
import { computeStars, createRun, runReducer, shopPrice, type RunOverrides } from './run';
import { setMatchesCounter } from './parry';
import { allSets, countDifferentAttributes, isRainbow, isSelectable } from './sets';
import { albumPageOf } from './gear';
import type { Modifiers } from '../rules/types';
import { growthModifiers } from '../data/weaponGrowth';
import { weaponRole, type WeaponRole } from '../data/weaponRoles';
import { challengeCount } from './challenges';
import { snareTarget } from './fight';
import { armedRecipesFor, getRecipe, modifiersOf } from './sources';
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
  /**
   * Optional lognormal search-time volatility `sigma`. When `> 0`, replaces the
   * uniform `[0.6, 1.4]` pace draw with deterministic Box-Muller lognormal
   * `clamp(exp(z * sigma), 0.30, maxPaceMultiplier ?? 5.0)` to capture human droughts.
   * When omitted or `<= 0`, behavior is bit-for-bit identical to the uniform bot.
   */
  findTimeSigma?: number;
  /** Upper multiplier cap on lognormal pace draws (default `5.0`). */
  maxPaceMultiplier?: number;
  /**
   * Optional fixed motor/tap floor in seconds. When set, base median think time is
   * `baseReactionSec + secondsPerAttribute * traits` instead of `secondsPerAttribute * traits`.
   */
  baseReactionSec?: number;
  /** Per-weapon multiplicative think-time cognitive load factor (per-item clamped `[0.75, 1.35]`). */
  cognitiveLoadByWeapon?: Readonly<Record<string, number>>;
  /** Fallback per-role multiplicative think-time cognitive load factor (per-item clamped `[0.75, 1.35]`). */
  cognitiveLoadByRole?: Readonly<Partial<Record<WeaponRole, number>>>;
  /**
   * Optional override for the chance to pause briefly during a Set-Parry wind-up to catch
   * the golden Perfect Parry window (overrides the hardcoded `0.4` expert-only chance).
   */
  perfectParryWaitChance?: number;
}

/** Deterministic Box-Muller standard normal N(0, 1) using the seeded RNG. */
const sampleStandardNormal = (rng: Rng): number => {
  const u1 = Math.max(1e-12, rng.next());
  const u2 = rng.next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

/** Compound multiplicative cognitive-load think-time factor across the equipped belt (clamped `[0.70, 1.50]`). */
const beltCognitiveLoadFactor = (weapons: readonly Weapon[], bot: BotProfile): number => {
  const byWeapon = bot.cognitiveLoadByWeapon;
  const byRole = bot.cognitiveLoadByRole;
  if (!byWeapon && !byRole) return 1;
  let factor = 1;
  for (const w of weapons) {
    const raw = byWeapon?.[w.id] ?? byRole?.[weaponRole(w.id)];
    if (raw !== undefined && Number.isFinite(raw) && raw > 0) {
      factor *= Math.min(1.35, Math.max(0.75, raw));
    }
  }
  return Math.min(1.5, Math.max(0.7, factor));
};

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

const cardAttrValue = (c: Card, a: AttributeName) => (a === 'background' ? c.background ?? 'white' : c[a]);

/** Standing modifiers currently live on `s` (weapons, skill nodes, active evolutions & growth). */
const currentModifiers = (s: RunState): Modifiers =>
  modifiersOf({
    skillNodes: s.skillNodes,
    weapons: s.weapons,
    activeEvolutions: s.activeEvolutions,
    growth: growthModifiers(s.growth ?? {}),
    blankEvolutionRules: s.blankEvolutionRules,
  });

/**
 * Which Set a player who can see the board picks:
 *  1. Urgent survival (`focus`): Counter-Parry during wind-up, imminent thorns,
 *     active ★★★ challenge goals, Catalysts, bombs & snare defusers.
 *  2. Payoff opportunity scorer (`care`): evaluates all Trick, Gamble, Piñata,
 *     Fog, Rust, Link, Surge, Rainbow & Growth payoffs while avoiding snared cards,
 *     solo shackles, cold fuses, immature chests, and half-rusted cards.
 */
const chooseSet = (s: RunState, sets: Card[][], bot: BotProfile, rng: Rng, m: Modifiers): Card[] => {
  const care = bot.huntsRainbows ? 0.6 : 0.3;
  const focus = bot.name === 'expert' ? 0.96 : bot.huntsRainbows ? 0.85 : 0.6;
  const { defusers, snared, bombs } = trapCards(s);
  const has = (set: Card[], ids: Set<string>) => set.some(c => ids.has(c.id));
  const prefer = (pred: (set: Card[]) => boolean, chance = care) => {
    const hits = sets.filter(pred);
    return hits.length && rng.next() < chance ? rng.pick(hits) : null;
  };
  const rainbow = (set: Card[]) => isRainbow(set, s.attributes);
  const monochrome = s.arcana.includes('monochrome_pact');
  const hasRainbowPayoff =
    !monochrome &&
    ((m.rainbowMultiplierBonus ?? 0) > 0 ||
      s.weapons.some(w => w.id === 'catalyst-prism') ||
      s.arcana.includes('prismatic_fever') ||
      s.fighter === 'Emperor Penguin');
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
      case 'colorSets':
        return s.level.challenge.kind === 'colorSets'
          ? prefer(set => set.every(c => c.color === (s.level.challenge as { color: Card['color'] }).color), focus)
          : null;
      case 'sameColorSets': return prefer(set => set.every(c => c.color === set[0].color), focus);
      case 'allDiffSets':
      case 'rainbows': return prefer(rainbow, focus);
      case 'bigHit': return hasRainbowPayoff ? prefer(rainbow, focus) : null;
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

  let picked: Card[] | null = null;
  // 1. Counter-Parry when a foe is winding up a specific counter
  if (s.parry && s.parry.phase === 'windup' && s.parry.spec.counter.kind !== 'any') {
    picked = prefer(set => setMatchesCounter(set, s.attributes, s.parry!.spec.counter), focus);
  }
  // 2. Urgent thorns about to bite (<= 8s)
  picked ??= prefer(set => set.some(c => c.thornAt !== undefined && c.thornAt - s.elapsedMs <= 8000), focus);
  // 3. Active ★★★ challenge goals
  for (const goal of chasing(s)) picked ??= goalPick(goal);
  // 4. Evolution Catalyst & lethal bombs/snare defusers
  picked ??= prefer(set => set.some(c => c.hasEvolutionItem), Math.max(care, 0.75));
  picked ??= prefer(set => has(set, bombs) || has(set, defusers), focus);
  if (picked) return picked;

  // 5. Tiered payoff opportunity scorer across all candidate Sets
  const slotById = new Map<string, number>();
  s.board.forEach((c, i) => slotById.set(c.id, i));

  const mirrorHeld = (m.mirrorDamage ?? 0) > 0;
  const mirrorSlots = new Set<number>();
  if (mirrorHeld) {
    for (const i of s.gear.lastSetSlots) mirrorSlots.add(i);
    const depth = Math.round(m.mirrorDepth ?? 0);
    for (let k = 0; k < Math.min(depth, s.gear.mirrorMemory.length); k++) {
      for (const i of s.gear.mirrorMemory[k]) mirrorSlots.add(i);
    }
  }

  const ropeHeld = (m.tightropeDamage ?? 0) > 0 && s.gear.lastSetSlots.length > 0;
  const ropeSlots = new Set<number>();
  if (ropeHeld) {
    for (const i of s.gear.lastSetSlots) {
      ropeSlots.add(i);
      for (const adj of getAdjacentIndices(i, s.board.length)) ropeSlots.add(adj);
    }
  }

  const linkedSlots = new Set<number>();
  for (const conn of s.connections) {
    linkedSlots.add(conn.positionA);
    linkedSlots.add(conn.positionB);
  }

  const albumHeld = (m.albumDamage ?? 0) > 0;
  const bountyHeld = (m.bountyDamage ?? 0) > 0 && s.gear.bounty !== null;
  const tarHeld = (m.tarDamage ?? 0) > 0;
  const oddHeld = (m.oddOneOutDamage ?? 0) > 0;
  const chestThreshold = (m.chestStart ?? 8) + 3 * (m.chestGrowth ?? 2);
  const surgeMult = s.surge?.active ? 1.5 : 1;
  // Decoy is unmarked on purpose: human visual spotting scales modestly by skill tier (no X-ray cheating)
  const decoySight =
    bot.name === 'expert'
      ? 0.3
      : bot.name === 'average'
        ? 0.15
        : bot.name === 'novice'
          ? 0.05
          : bot.huntsRainbows
            ? 0.2
            : 0.05;
  const nAttrs = s.attributes.length;

  let bestScore = -Infinity;
  let bestSets: Card[][] = [];

  for (const set of sets) {
    let score = 0;
    let diffCache: number | null = null;
    const getDiff = () => (diffCache ??= countDifferentAttributes(set, s.attributes));
    let wantedCount = 0;
    let bonusPtsCards = 0;
    let linkedCount = 0;
    let touchesRope = false;
    let touchesMirror = false;
    let hasTar = false;
    let hasShacklePair = false;
    let hasSoloShackle = false;
    let hasDecoyPair = false;

    for (let i = 0; i < set.length; i++) {
      const c = set[i];
      const slot = slotById.get(c.id) ?? -1;
      if (c.doubler) score += 20 * surgeMult;
      if ((c.bounty ?? 0) > 0) {
        score += c.health === 1 ? 16 * surgeMult : 8;
      }
      if (c.rusted) score += 15 * surgeMult;
      else if ((c.rust ?? 0) > 0) score -= 5;
      if (c.thawed) score += 15 * surgeMult;
      if (c.fuseHot) score += 14;
      else if (c.fuseAt !== undefined) score -= 7;
      if (c.thornAt !== undefined) score += 13;
      if (c.chest !== undefined) {
        score += c.chest >= chestThreshold ? 15 * surgeMult : -9;
      }
      if (c.hot) score += 11;
      if (c.magnet) score += 10;
      if (c.twinOf) score += 9;
      if (c.shackle) {
        if (set.some(o => o.id === c.shackle)) hasShacklePair = true;
        else hasSoloShackle = true;
      }
      if (c.decoyOf && set.some(o => o.id === c.decoyOf)) hasDecoyPair = true;
      if (bountyHeld && !c.isWild && cardAttrValue(c, s.gear.bounty!.attribute) === s.gear.bounty!.value) {
        wantedCount += 1;
      }
      if (tarHeld && c.tar !== undefined) hasTar = true;
      if ((c.bonusPoints ?? 0) >= 4) bonusPtsCards += 1;
      if (slot >= 0) {
        if (linkedSlots.has(slot)) linkedCount += 1;
        if (ropeHeld && ropeSlots.has(slot)) touchesRope = true;
        if (mirrorHeld && mirrorSlots.has(slot)) touchesMirror = true;
      }
      if (snared.has(c.id)) score -= 22;
    }

    if (hasShacklePair) score += 14;
    if (hasSoloShackle) score -= 8;
    if (hasDecoyPair && rng.next() < decoySight) score += 10;
    if (wantedCount > 0) score += wantedCount * 5;
    if (hasTar) score += 7;
    if (bonusPtsCards > 0) score += Math.min(15, bonusPtsCards * 5);
    if (linkedCount > 0) score += linkedCount * 4;
    if (ropeHeld) score += touchesRope ? 10 : -12;
    if (mirrorHeld && touchesMirror) score += 7;
    if (albumHeld && albumPageOf(set, s.attributes, s.gear.album, s.gear.albumPages) !== null) score += 8;
    if (oddHeld) {
      const d = getDiff();
      if (d === 1 || (nAttrs >= 4 && d === nAttrs - 1)) score += 8;
    }
    if (setWouldGrow(s, set, s.attributes)) score += 6;
    if (monochrome) {
      const d = getDiff();
      if (d === 1) score += 10;
      else if (d === nAttrs) score -= 6;
    } else if (bot.huntsRainbows && hasRainbowPayoff && rainbow(set)) {
      score += 11 * surgeMult;
    }

    if (score > bestScore + 1) {
      bestScore = score;
      bestSets = [set];
    } else if (score >= bestScore - 1) {
      bestSets.push(set);
    }
  }

  // Tightrope relies strongly on staying on the rope; other payoffs use standard `care`
  const pickChance = ropeHeld ? Math.max(care, 0.8) : care;
  if (bestScore > 0 && bestSets.length > 0 && rng.next() < pickChance) {
    return rng.pick(bestSets);
  }
  return prefer(set => !has(set, snared)) ?? rng.pick(sets);
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
  /** Optional CreateRun overrides (used by Starfall Spire & lab counterfactuals) */
  overrides?: RunOverrides;
  /** Override accumulated features (used by Starfall Spire balance simulations) */
  features?: RunState['features'];
  /** Opt-in lab telemetry: count firings & zero-op firings per rule key */
  trackRuleFirings?: boolean;
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
 * mistake. Either way the cards are replaced, and any ignited cards burn out
 * immediately afterward (matching GameBoard's 250ms post-Set burn cascade).
 */
const submit = (s: RunState, picked: Card[], hinted = false): RunState => {
  const v = isValidCombination(picked, s.attributes);
  const graceUsed = !v.isValid && v.invalidAttributes.length === 1 && s.stats.graces > 0;
  let next: RunState;
  if (v.isValid || graceUsed) {
    // Note: `s.stats` already has `applyEnemyStatModifiers` applied via `refreshSources(d)` in fight.ts
    const { cards, rewards, weaponEffects } = resolveMatch({
      board: s.board,
      selected: picked,
      playerStats: s.stats,
      weapons: s.weapons,
      activeAttributes: s.attributes,
      connections: s.connections,
      graceUsed,
    });
    next = runReducer(s, { type: 'MATCH', cards, rewards, effects: weaponEffects, hinted });
    next = runReducer(next, { type: 'REPLACE', ids: cards.map(c => c.id) });
  } else {
    next = runReducer(s, { type: 'INVALID', cards: picked });
    next = runReducer(next, { type: 'REPLACE', ids: picked.map(c => c.id) });
  }
  // Burning cards burn out in 0.25s in real gameplay (useBurnTimer.ts), not a full think cycle later
  let burnGuard = 0;
  while (next.status === 'playing' && burnGuard++ < 24) {
    const burning = next.board.find(x => x.onFire);
    if (!burning) break;
    next = runReducer(next, { type: 'BURN', card: burning });
  }
  return next;
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

/** Pick the strongest offered evolution for the current fight state (healing when low HP, burst/DPS when healthy). */
const chooseEvolution = (s: RunState, options: readonly string[]): string => {
  if (options.length <= 1) return options[0];
  const needHeal = s.hearts !== null && s.maxHearts !== null && s.hearts <= Math.ceil(s.maxHearts * 0.65);
  const urgentHeal = s.hearts !== null && s.hearts <= 2;
  const needTime = s.timeLeft !== null && s.timeLeft <= 22;

  let bestId = options[0];
  let bestScore = -Infinity;

  for (const id of options) {
    const recipe = getRecipe(id);
    if (!recipe) continue;
    let score = s.forgedRecipes.includes(id) ? 0 : 1.5;
    const m = recipe.source.modifiers;
    if (m) {
      score += (m.setDamage ?? 0) * 3;
      score += (m.rainbowMultiplierBonus ?? 0) * 12;
      if (m.conditionalDamage) {
        for (const cd of m.conditionalDamage) score += cd.amount * 2;
      }
      if (m.evolutionDurationMs) score += m.evolutionDurationMs * 0.0004;
    }
    for (const rule of recipe.source.rules ?? []) {
      const tw =
        rule.trigger.on === 'set'
          ? 1.8
          : rule.trigger.on === 'evolutionStart'
            ? 1.6
            : rule.trigger.on === 'everyNthSet'
              ? 1.5 / Math.max(1, rule.trigger.n)
              : rule.trigger.on === 'rainbow'
                ? 1.2
                : rule.trigger.on === 'hurt' || rule.trigger.on === 'mistake'
                  ? 0.25
                  : rule.trigger.on === 'finale'
                    ? 0.6
                    : 0.9;
      for (const eff of rule.effects) {
        let ev = 2;
        switch (eff.do) {
          case 'heal':
            ev = needHeal ? eff.amount * (urgentHeal ? 18 : 10) : eff.amount * 2;
            break;
          case 'damage':
            ev = eff.amount * (eff.per ? 2.5 : 1);
            break;
          case 'explode':
            ev = 6;
            break;
          case 'laser':
            ev = 8;
            break;
          case 'ricochet':
            ev = eff.count * 2.5;
            break;
          case 'ignite':
            ev = eff.count * 3;
            break;
          case 'autoSet':
            ev = 10;
            break;
          case 'nextSetMultiplier':
            ev = eff.times * 5;
            break;
          case 'doubleNext':
            ev = 5;
            break;
          case 'empowerBoard':
            ev = eff.amount * 6;
            break;
          case 'armorCard':
            ev = eff.bounty * 0.6;
            break;
          case 'freeze':
            ev = (eff.ms / 1000) * (needTime ? 3.5 : 1.2);
            break;
          case 'time':
            ev = eff.seconds * (needTime ? 3.5 : 0.8);
            break;
          case 'growBoard':
            ev = eff.count * 2;
            break;
          case 'shield':
            ev = eff.count * (needHeal ? 5 : 1.5);
            break;
          case 'simplify':
            ev = (eff.ms / 1000) * 0.7;
            break;
          case 'spawnCatalyst':
          case 'spawnCatalystForce':
            ev = 4;
            break;
          case 'trigger':
            ev = 3;
            break;
          case 'coins':
            ev = eff.amount * 0.8;
            break;
          default:
            ev = 2;
            break;
        }
        score += tw * ev;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestId;
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
  let s = createRun(level, save, {
    seed,
    ...(opts.features ? { features: opts.features } : {}),
    ...(opts.overrides ? { overrides: opts.overrides } : {}),
    ...(opts.trackRuleFirings ? { trackRuleFirings: true } : {}),
  });
  let guard = 0;
  let cachedModsKey: { weapons: RunState['weapons']; evos: RunState['activeEvolutions']; growth: RunState['growth']; nodes: RunState['skillNodes']; mods: Modifiers } | null = null;
  const getMods = (st: RunState): Modifiers => {
    if (
      cachedModsKey &&
      cachedModsKey.weapons === st.weapons &&
      cachedModsKey.evos === st.activeEvolutions &&
      cachedModsKey.growth === st.growth &&
      cachedModsKey.nodes === st.skillNodes
    ) {
      return cachedModsKey.mods;
    }
    const m = currentModifiers(st);
    cachedModsKey = { weapons: st.weapons, evos: st.activeEvolutions, growth: st.growth, nodes: st.skillNodes, mods: m };
    return m;
  };
  while ((s.status === 'playing' || s.status === 'pick' || s.status === 'pick_evolution' || s.status === 'intermission') && guard++ < 2000) {
    if (s.status === 'pick_evolution') {
      const options = s.evolutionPickOptions ?? [];
      if (options.length === 0) break;
      const recipeId = chooseEvolution(s, options);
      s = runReducer(s, { type: 'PICK_EVOLUTION', recipeId });
      let burnGuard = 0;
      while (s.status === 'playing' && burnGuard++ < 24) {
        const burning = s.board.find(x => x.onFire);
        if (!burning) break;
        s = runReducer(s, { type: 'BURN', card: burning });
      }
      continue;
    }
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
    const sigma = bot.findTimeSigma && bot.findTimeSigma > 0 ? bot.findTimeSigma : 0;
    const pace =
      sigma > 0
        ? Math.min(bot.maxPaceMultiplier ?? 5.0, Math.max(0.3, Math.exp(sampleStandardNormal(rng) * sigma)))
        : 0.6 + rng.next() * 0.8;
    // A simplified board unifies 1 trait (or 2 on double Clarity Lens)
    const traits = Math.max(1, s.attributes.length - (s.simplified ? (s.simplified.also ? 2 : 1) : 0));
    // A wild card makes a Set with any two cards, cutting scan time substantially
    const wild = s.board.some(c => c.isWild && isSelectable(c)) ? 0.65 : 1;
    const baseThink =
      bot.baseReactionSec !== undefined && Number.isFinite(bot.baseReactionSec)
        ? Math.max(0, bot.baseReactionSec) + bot.secondsPerAttribute * traits
        : bot.secondsPerAttribute * traits;
    let think = baseThink * pace * glow * crowd * wild;
    if (bot.cognitiveLoadByWeapon || bot.cognitiveLoadByRole) {
      think *= beltCognitiveLoadFactor(s.weapons, bot);
    }
    // A slow search (or a "use hints" goal) is when a real player presses the bulb
    const slow = pace > 1;
    const goals = chasing(s);
    const uiMods = s.foe.getUIModifiers();
    const runMods = getMods(s);
    const canHint = s.features.has('hints') && s.stats.hints > 0 && !uiMods.disableManualHint;
    const conserveHints = s.level.challenge.kind === 'hintsLeft' && s.stats.hints <= s.level.challenge.n;
    const hintEagerness = (runMods.hintHeldDamage ?? 0) > 0 && !goals.includes('useHints') ? bot.hintEagerness * 0.5 : bot.hintEagerness;
    let hinted = canHint && (goals.includes('useHints') || (!conserveHints && slow && rng.next() < hintEagerness));
    if (hinted) {
      s = runReducer(s, { type: 'USE_HINT' });
      think *= 0.5;
    }
    // Faithful auto-hint simulation (matches useAutoHint.ts: 15s wait minus autoHintInterval, 2s poll, 4s fade)
    let pointed = false;
    if (!hinted && !uiMods.disableAutoHint && s.stats.autoHintChance > 0) {
      const waitSec = Math.max(5, (15000 - (s.stats.autoHintInterval || 0)) / 1000);
      if (think >= waitSec) {
        const checks = 1 + Math.floor((think - waitSec) / 2);
        for (let k = 0; k < checks; k++) {
          if (rng.next() * 100 < s.stats.autoHintChance) {
            const triggerAt = waitSec + k * 2;
            const twoCards = (s.stats.enhancedHintChance || 0) > 0 && rng.next() * 100 < s.stats.enhancedHintChance;
            const postHintSec = Math.max(1, (think - triggerAt) * (twoCards ? 0.3 : 0.55));
            think = triggerAt + postHintSec;
            // Auto-hint stays lit for ~4s; only counts as hinted if matched before fade
            pointed = postHintSec <= 4;
            break;
          }
        }
      }
    }
    // With a grace in hand a near miss is free, so a slow search ends in a bold guess
    const graces = s.features.has('graces') ? s.stats.graces : 0;
    const bold = !hinted && graces > 0 && (goals.includes('graceSaves') ? pace > 0.8 : slow && rng.next() < bot.boldness);
    if (bold) think *= 0.5;
    // A foe that punishes standing still (its card says "30s inactivity"): with the
    // deadline close, press the bulb (if allowed), and failing that, rush (and slip more often)
    let rushed = false;
    const limit = inactivityLimit(s);
    if (limit !== null) {
      const left = limit - (s.elapsedMs - s.lastMatchAtMs) / 1000 - 2;
      if (think > left && !hinted && canHint) {
        s = runReducer(s, { type: 'USE_HINT' });
        think *= 0.5;
        hinted = true;
      }
      if (think > left) {
        think = Math.max(1, left);
        rushed = true;
      }
    }
    // Set-Parry deadline awareness: rush or hint to parry before an unparried strike hits;
    // experts occasionally pause 1-2s to catch the golden Perfect Parry window!
    const focus = bot.name === 'expert' ? 0.96 : bot.huntsRainbows ? 0.85 : 0.6;
    const parryWaitChance =
      bot.perfectParryWaitChance !== undefined
        ? bot.perfectParryWaitChance
        : bot.name === 'expert'
          ? 0.4
          : 0;
    if (s.parry && s.parry.phase === 'windup') {
      const parryLeft = s.parry.msLeft / 1000 - 1;
      if (think > parryLeft && rng.next() < focus) {
        if (!hinted && !conserveHints && canHint) {
          s = runReducer(s, { type: 'USE_HINT' });
          think *= 0.5;
          hinted = true;
        }
        if (think > parryLeft) {
          think = Math.max(1, parryLeft);
          rushed = true;
        }
      } else if (
        parryWaitChance > 0 &&
        s.parry.msLeft > 3500 &&
        s.parry.msLeft <= 5500 &&
        think < (s.parry.msLeft - 3000) / 1000 &&
        s.combo === 0 &&
        !((runMods.glassDamage ?? 0) > 0 && !s.gear.glassBroken) &&
        rng.next() < parryWaitChance
      ) {
        think = Math.max(think, (s.parry.msLeft - 2500) / 1000);
      }
    }
    const ticks = Math.max(1, Math.round(think));
    for (let i = 0; i < ticks && s.status === 'playing'; i++) s = runReducer(s, { type: 'TICK', ms: 1000 });
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
    s = submit(s, chooseSet(s, sets, bot, rng, getMods(s)), hinted || pointed);
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
