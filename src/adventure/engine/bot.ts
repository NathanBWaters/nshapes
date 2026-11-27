/**
 * Headless bot that plays a level through the same reducer the UI uses.
 * Used to tune foe HP / timers against target star rates. It plays the save
 * it is given, or with a BuildPlan gears up first like a player at the
 * preview (botBuilds.ts: skill nodes for the stars earned, charms, evolutions).
 */
import { setWouldGrow, cornerSlots } from './growth';
import type { AttributeName, Card, Weapon } from '@/types';
import { isValidCombination } from '@/utils/gameUtils';
import { getAdjacentIndices } from '@/utils/weaponEffects';
import { getBoardSizeForAttributes } from '@/utils/gameConfig';
import type { AdventureSave, ChallengeDef, LevelDef, RunState } from '../types';
import { createRng, type Rng } from './rng';
import { computeStars, createRun, runReducer, shopPrice, type RunOverrides } from './run';
import { setMatchesCounter } from './parry';
import { allSets, countDifferentAttributes, differingAttributes, isRainbow, isSelectable } from './sets';
import { albumPageOf } from './gear';
import type { Modifiers } from '../rules/types';
import { growthModifiers } from '../data/weaponGrowth';
import { weaponRole, type WeaponRole } from '../data/weaponRoles';
import { beltSynergyOverlap } from '../data/synergy';
import { getWeaponEvolution } from '../data/evolutions';
import { challengeCount } from './challenges';
import { GRID_COLS, snareTarget, synergyCtxOf } from './fight';
import { modifiersOf } from './sources';
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
  findTimeSigma?: number;
  maxPaceMultiplier?: number;
  baseReactionSec?: number;
  cognitiveLoadByWeapon?: Readonly<Record<string, number>>;
  cognitiveLoadByRole?: Readonly<Partial<Record<WeaponRole, number>>>;
  perfectParryWaitChance?: number;
}

const sampleStandardNormal = (rng: Rng): number => {
  const u1 = Math.max(1e-12, rng.next());
  const u2 = rng.next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

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

const trapCards = (s: RunState) => {
  const defusers = new Set<string>();
  const snared = new Set<string>();
  s.board.forEach((c, i) => {
    if (!c.snare) return;
    snared.add(c.id);
    const t = snareTarget(i, c.snare, s.board.length);
    if (t !== null) defusers.add(s.board[t].id);
  });
  const bombs = new Set([...s.timeBombIds, ...s.board.filter(c => c.hasBomb || c.hasCountdown).map(c => c.id)]);
  return { defusers, snared, bombs };
};

type Goal = ChallengeDef['kind'] | 'triple' | 'faceDown' | 'safe';

const ENEMY_GOALS: [RegExp, Goal][] = [
  [/all-different/i, 'rainbows'],
  [/triple/i, 'triple'],
  [/bomb|countdown/i, 'defuseTraps'],
  [/face-down|revealed/i, 'faceDown'],
  [/damage/i, 'safe'],
];

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

/** Standing modifiers currently live on `s` (weapons, skill nodes, active evolutions, Synergy hooks & growth). */
const currentModifiers = (s: RunState): Modifiers =>
  modifiersOf({
    skillNodes: s.skillNodes,
    weapons: s.weapons,
    weaponEvolutions: s.weaponEvolutions,
    weaponBuilds: s.weaponBuilds,
    synergy: s.synergy,
    synergyCtx: synergyCtxOf(s),
    growth: growthModifiers(s.growth ?? {}),
    blankEvolutionRules: s.blankEvolutionRules,
  });

/** Count how many currently charging weapon evolutions a candidate Set actively advances. */
const countChargingEvosAdvanced = (
  s: RunState,
  set: readonly Card[],
  slots: readonly number[],
  linkedSlots: ReadonlySet<number>,
  diffCount: number,
  isRb: boolean
): number => {
  if (s.weaponEvolutions.length === 0) return 0;
  let hits = 0;
  const concrete = set.filter(c => !c.isWild);
  const sameColor = concrete.length <= 1 || concrete.every(c => c.color === concrete[0].color);
  const setColor = sameColor && concrete.length > 0 ? concrete[0].color : null;
  const sameShape = concrete.length <= 1 || concrete.every(c => c.shape === concrete[0].shape);
  const setShape = sameShape && concrete.length > 0 ? concrete[0].shape : null;
  const numVals = concrete.map(c => c.number);
  const sameNum = concrete.length <= 1 || numVals.every(v => v === numVals[0]);
  const diffNum = new Set(numVals).size === concrete.length;

  for (const t of s.weaponEvolutions) {
    if (t.phase !== 'charging') continue;
    const def = getWeaponEvolution(t.evoId);
    if (!def) continue;
    const cond = def.condition;
    let ok = false;
    switch (cond.kind) {
      case 'color_set':
        ok = sameColor && (cond.color === 'any_same' || setColor === cond.color);
        break;
      case 'shape_set':
        ok = sameShape && (cond.shape === 'any_same' || setShape === cond.shape);
        break;
      case 'number_set':
        ok = cond.mode === 'same' ? sameNum && (cond.value === undefined || concrete[0]?.number === cond.value) : diffNum;
        break;
      case 'exact_diff_traits': {
        if (diffCount !== cond.diffCount) break;
        if (cond.onlyDiffAttr) {
          const diffs = differingAttributes(set as Card[], s.attributes);
          ok = diffs.length === 1 && diffs[0] === cond.onlyDiffAttr;
        } else if (cond.onlySameAttr) {
          const diffs = differingAttributes(set as Card[], s.attributes);
          const sames = s.attributes.filter(a => !diffs.includes(a));
          ok = sames.length === 1 && sames[0] === cond.onlySameAttr;
        } else {
          ok = true;
        }
        break;
      }
      case 'rainbow_set':
        ok = isRb;
        break;
      case 'trait_cycle': {
        const seen = t.seenCycleValues ?? [];
        const v = cond.attr === 'color' ? (sameColor ? setColor : null) : cond.attr === 'shape' ? (sameShape ? setShape : null) : sameNum ? (concrete[0]?.number ?? null) : null;
        ok = v !== null && !seen.includes(v);
        break;
      }
      case 'board_geometry': {
        if (cond.geometry === 'corners') {
          const corners = cornerSlots(s.board.length);
          ok = slots.filter(sl => corners.includes(sl)).length >= 2;
        } else if (cond.geometry === 'same_row') {
          ok = slots.length === 3 && new Set(slots.map(sl => Math.floor(sl / GRID_COLS))).size === 1;
        } else if (cond.geometry === 'same_col') {
          ok = slots.length === 3 && new Set(slots.map(sl => sl % GRID_COLS)).size === 1;
        } else if (cond.geometry === 'reuse_last_slot') {
          ok = s.gear.lastSetSlots.length > 0 && slots.some(sl => s.gear.lastSetSlots.includes(sl));
        } else if (cond.geometry === 'touch_last_set') {
          ok =
            s.gear.lastSetSlots.length > 0 &&
            slots.some(
              sl =>
                s.gear.lastSetSlots.includes(sl) ||
                getAdjacentIndices(sl, s.board.length).some(a => s.gear.lastSetSlots.includes(a))
            );
        }
        break;
      }
      case 'special_cards_matched': {
        const matches = set.filter((c, idx) => {
          const sl = slots[idx] ?? -1;
          switch (cond.cardTag) {
            case 'power': return (c.bonusPoints ?? 0) > 0;
            case 'gold': return (c.bonusMoney ?? 0) > 0;
            case 'holo': return !!c.holo;
            case 'burning': return !!c.onFire;
            case 'linked': return sl >= 0 && linkedSlots.has(sl);
            case 'wild': return !!c.isWild;
            case 'armored': return (c.health ?? 1) > 1 || (c.bounty ?? 0) > 0;
            case 'marked': return !!c.marked || !!c.magnet || !!c.doubler || !!c.hot || c.chest !== undefined;
            case 'any_special':
              return !!c.holo || !!c.marked || !!c.magnet || (c.bonusPoints ?? 0) > 0 || (c.bonusMoney ?? 0) > 0;
          }
        }).length;
        ok = cond.inSingleSet ? matches >= cond.target : matches > 0;
        break;
      }
      default:
        break;
    }
    if (ok) hits += t.almostReady ? 2 : 1;
  }
  return hits;
};

/**
 * Which Set a player who can see the board picks:
 *  1. Urgent survival (`focus`): Counter-Parry during wind-up, imminent thorns,
 *     active ★★★ challenge goals, bombs & snare defusers.
 *  2. Payoff opportunity scorer (`care`): evaluates Holo cards, Marked cards,
 *     charging weapon evolution objectives, Trick, Gamble, Piñata, Link, Surge,
 *     Rainbow & Growth payoffs.
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

  const slotById = new Map<string, number>();
  s.board.forEach((c, i) => slotById.set(c.id, i));
  const linkedSlots = new Set<number>();
  for (const conn of s.connections) {
    linkedSlots.add(conn.positionA);
    linkedSlots.add(conn.positionB);
  }

  const goalPick = (goal: Goal): Card[] | null => {
    switch (goal) {
      case 'evolutions':
        return prefer(set => {
          const slots = set.map(c => slotById.get(c.id) ?? -1);
          const d = countDifferentAttributes(set, s.attributes);
          return countChargingEvosAdvanced(s, set, slots, linkedSlots, d, rainbow(set)) > 0;
        }, focus);
      case 'defuseTraps': return prefer(set => has(set, bombs) || has(set, defusers), focus);
      case 'fullHearts':
      case 'safe':
        return prefer(set => has(set, bombs) || has(set, defusers), focus) ?? prefer(set => !has(set, snared), focus);
      case 'triple': return prefer(set => set.some(c => (c.health ?? 1) > 1), focus);
      case 'faceDown': return prefer(set => set.some(c => c.wasOriginallyFaceDown), focus);
      case 'bonusCards': return prefer(set => set.some(c => (c.bonusPoints ?? 0) > 0 || (c.bonusMoney ?? 0) > 0 || !!c.holo), focus);
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
  if (s.parry && s.parry.phase === 'windup' && s.parry.spec.counter.kind !== 'any') {
    picked = prefer(set => setMatchesCounter(set, s.attributes, s.parry!.spec.counter), focus);
  }
  picked ??= prefer(set => set.some(c => c.thornAt !== undefined && c.thornAt - s.elapsedMs <= 8000), focus);
  for (const goal of chasing(s)) picked ??= goalPick(goal);
  picked ??= prefer(set => has(set, bombs) || has(set, defusers), focus);
  if (picked) return picked;

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

  const albumHeld = (m.albumDamage ?? 0) > 0;
  const bountyHeld = (m.bountyDamage ?? 0) > 0 && s.gear.bounty !== null;
  const tarHeld = (m.tarDamage ?? 0) > 0;
  const oddHeld = (m.oddOneOutDamage ?? 0) > 0;
  const chestThreshold = (m.chestStart ?? 12) + 3 * (m.chestGrowth ?? 4);
  const surgeMult = s.surge?.active ? 1.5 : 1;
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
    const slots = set.map(c => slotById.get(c.id) ?? -1);
    const isRb = rainbow(set);
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
      const slot = slots[i];
      if (c.holo) score += 12 * surgeMult;
      if (c.marked) score += 8;
      if (c.doubler) score += 16 * surgeMult;
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
    const evoHits = countChargingEvosAdvanced(s, set, slots, linkedSlots, getDiff(), isRb);
    if (evoHits > 0) score += evoHits * 9;
    if (monochrome) {
      const d = getDiff();
      if (d === 1) score += 10;
      else if (d === nAttrs) score -= 6;
    } else if (bot.huntsRainbows && hasRainbowPayoff && isRb) {
      score += 11 * surgeMult;
    }

    if (score > bestScore + 1) {
      bestScore = score;
      bestSets = [set];
    } else if (score >= bestScore - 1) {
      bestSets.push(set);
    }
  }

  const pickChance = ropeHeld ? Math.max(care, 0.8) : care;
  if (bestScore > 0 && bestSets.length > 0 && rng.next() < pickChance) {
    return rng.pick(bestSets);
  }
  return prefer(set => !has(set, snared)) ?? rng.pick(sets);
};

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

export interface SimOptions {
  /** Pass on every level-up pick and shop offer, so the fight measures only what was brought in */
  skipPicks?: boolean;
  /** Optional CreateRun overrides (used by Starfall Summit & lab counterfactuals) */
  overrides?: RunOverrides;
  /** Override accumulated features (used by Starfall Summit balance simulations) */
  features?: RunState['features'];
  /** Opt-in lab telemetry: count firings & zero-op firings per rule key */
  trackRuleFirings?: boolean;
}

export const simulateRun = (level: LevelDef, save: AdventureSave, bot: BotProfile, seed: number, plan?: BuildPlan, opts: SimOptions = {}) =>
  playRun(level, plan ? gearUp(save, plan, seed) : save, bot, seed, plan?.chaseRecipes !== false, opts);

const inactivityLimit = (s: RunState): number | null => {
  const m = /(\d+)s inactivity/.exec(s.foe.description ?? '');
  return m ? Number(m[1]) : null;
};

const submit = (s: RunState, picked: Card[], hinted = false): RunState => {
  const v = isValidCombination(picked, s.attributes);
  const graceUsed = !v.isValid && v.invalidAttributes.length === 1 && s.stats.graces > 0;
  let next: RunState;
  if (v.isValid) {
    next = runReducer(s, { type: 'MATCH', cards: picked, graceUsed: false, hinted, resolveWeapons: true });
    const ids = next.replacing.length > 0 ? next.replacing : picked.map(c => c.id);
    next = runReducer(next, { type: 'REPLACE', ids });
  } else if (graceUsed) {
    next = runReducer(s, { type: 'GRACE_SAVE', cards: picked });
    const ids = next.replacing.length > 0 ? next.replacing : picked.map(c => c.id);
    next = runReducer(next, { type: 'REPLACE', ids });
  } else {
    next = runReducer(s, { type: 'INVALID', cards: picked });
    next = runReducer(next, { type: 'REPLACE', ids: picked.map(c => c.id) });
  }
  let burnGuard = 0;
  while (next.status === 'playing' && burnGuard++ < 24) {
    const burning = next.board.find(x => x.onFire);
    if (!burning) break;
    next = runReducer(next, { type: 'BURN', card: burning });
  }
  return next;
};

/**
 * A weapon a player would grab: one with the highest Synergy Graph overlap
 * with the current belt first, otherwise any.
 */
const preferred = (s: RunState, options: Weapon[], rng: Rng, chase = true): number => {
  if (!options.length) return -1;
  if (!chase) return Math.floor(rng.next() * options.length);
  const heldIds = s.weapons.map(w => w.id);
  let bestOverlap = 0;
  let bestIndices: number[] = [];
  options.forEach((w, i) => {
    const overlap = beltSynergyOverlap(w.id, heldIds).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestIndices = [i];
    } else if (overlap === bestOverlap && overlap > 0) {
      bestIndices.push(i);
    }
  });
  return bestIndices.length > 0 ? rng.pick(bestIndices) : Math.floor(rng.next() * options.length);
};

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
  let cachedModsKey: {
    weapons: RunState['weapons'];
    evos: RunState['weaponEvolutions'];
    synergy: RunState['synergy'];
    growth: RunState['growth'];
    nodes: RunState['skillNodes'];
    mods: Modifiers;
  } | null = null;
  const getMods = (st: RunState): Modifiers => {
    if (
      cachedModsKey &&
      cachedModsKey.weapons === st.weapons &&
      cachedModsKey.evos === st.weaponEvolutions &&
      cachedModsKey.synergy === st.synergy &&
      cachedModsKey.growth === st.growth &&
      cachedModsKey.nodes === st.skillNodes
    ) {
      return cachedModsKey.mods;
    }
    const m = currentModifiers(st);
    cachedModsKey = { weapons: st.weapons, evos: st.weaponEvolutions, synergy: st.synergy, growth: st.growth, nodes: st.skillNodes, mods: m };
    return m;
  };
  while ((s.status === 'playing' || s.status === 'pick' || s.status === 'intermission') && guard++ < 2000) {
    if (s.status === 'pick') {
      const pick = opts.skipPicks ? null : s.pickOptions[preferred(s, s.pickOptions, rng, chase)]?.id ?? null;
      s = runReducer(s, { type: 'PICK', weaponId: pick });
      continue;
    }
    if (s.status === 'intermission') {
      if (!opts.skipPicks) s = shop(s, rng, chase);
      s = runReducer(s, { type: 'NEXT_WAVE' });
      continue;
    }
    const glow = s.passive.keenEyeCardId ? 0.5 : 1;
    const fullBoard = s.level.rules.boardSize ?? getBoardSizeForAttributes(s.attributes.length);
    const crowd = Math.sqrt(Math.min(1, Math.max(0.25, s.board.filter(isSelectable).length / fullBoard)));
    const sigma = bot.findTimeSigma && bot.findTimeSigma > 0 ? bot.findTimeSigma : 0;
    const pace =
      sigma > 0
        ? Math.min(bot.maxPaceMultiplier ?? 5.0, Math.max(0.3, Math.exp(sampleStandardNormal(rng) * sigma)))
        : 0.6 + rng.next() * 0.8;
    const traits = Math.max(1, s.attributes.length - (s.simplified ? (s.simplified.also ? 2 : 1) : 0));
    const wild = s.board.some(c => c.isWild && isSelectable(c)) ? 0.65 : 1;
    const baseThink =
      bot.baseReactionSec !== undefined && Number.isFinite(bot.baseReactionSec)
        ? Math.max(0, bot.baseReactionSec) + bot.secondsPerAttribute * traits
        : bot.secondsPerAttribute * traits;
    let think = baseThink * pace * glow * crowd * wild;
    if (bot.cognitiveLoadByWeapon || bot.cognitiveLoadByRole) {
      think *= beltCognitiveLoadFactor(s.weapons, bot);
    }
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
            pointed = postHintSec <= 4;
            break;
          }
        }
      }
    }
    const graces = s.features.has('graces') ? s.stats.graces : 0;
    const bold = !hinted && graces > 0 && goals.includes('graceSaves') && pace > 0.8;
    if (bold) think *= 0.5;
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
    if (s.status !== 'playing') continue;

    const selectableCards = s.board.filter(isSelectable);
    if (selectableCards.length < 3) {
      s = runReducer(s, { type: 'TICK', ms: 1000 });
      continue;
    }
    const sets = allSets(s.board, s.attributes);
    const slip = rng.next() < bot.mistakeRate * (hinted ? 0.5 : 1) * (rushed ? 2 : 1);
    if (bold || !sets.length || slip) {
      const near = bold || rng.next() < bot.nearMissRate ? nearMiss(selectableCards, s.attributes, rng) : null;
      s = submit(s, near ?? rng.shuffle(selectableCards).slice(0, 3));
      continue;
    }
    s = submit(s, chooseSet(s, sets, bot, rng, getMods(s)), hinted || pointed);
  }
  return { stars: computeStars(s), coins: s.coins, state: s };
};

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
