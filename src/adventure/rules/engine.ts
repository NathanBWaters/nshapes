/**
 * The rule interpreter: resolves queued fight events against every live rule
 * (skill nodes, held weapons, active evolutions), checks conditions and runs
 * effects. Effects that fire weapon behaviour queue a `weapon` trigger of
 * their kind, so any source can chain into any other.
 *
 * Loop safety: a rule never reacts to events its own effects caused (directly
 * or through other rules), and one action resolves at most 32 rule firings.
 */
import type { Condition, Effect, Scale, Trigger, WeaponTriggerKind } from './types';
import { cleanseBoard } from '../engine/hazards';
import { isSelectable } from '../engine/sets';
import { BASE_RULES } from '../data/rules';
import {
  addCoins, addGraces, addHints, addRandomConnections, addTime, addXp, areaIndices, armorCard, canSpawnCatalyst,
  dealDamage, destroyCards, emit, empowerBoard, enqueue, foeMultiplier, growBoard, heal, igniteCards, liveRulesOf,
  placeCatalyst, redeal, simplify, touchable as touchableIdx, type Draft, type FightEvent,
} from '../engine/fight';
import { extendEvolutions } from '../engine/evolutions';
import { addComboSteps, patienceMs } from '../engine/passives';
import type { KeyedRule } from '../engine/sources';

export const MAX_FIRINGS_PER_ACTION = 32;

// ─── Conditions ─────────────────────────────────────────────────────────────

const sinceLastSet = (d: Draft) => (d._setCtx ? d._setCtx.sinceLastMs : d.elapsedMs - d.lastMatchAtMs);

const holds = (d: Draft, c: Condition): boolean => {
  switch (c.kind) {
    case 'chance': return d._rng.next() * 100 < c.pct;
    case 'heartsAtMost': return d.hearts !== null && d.hearts <= c.n;
    case 'heartsFull': return d.hearts !== null && d.maxHearts !== null && d.hearts >= d.maxHearts;
    case 'comboAtLeast': return d.combo >= c.n;
    case 'diffCount': return d._setCtx?.diffCount === c.n;
    case 'rainbowSet': return !!d._setCtx?.rainbow;
    case 'noMistakesThisFight': return d.mistakes === 0;
    case 'evolutionActive': return d.activeEvolutions.length > 0;
    case 'timeSinceLastSetAtLeast': return sinceLastSet(d) >= c.ms;
    case 'patient': return sinceLastSet(d) >= patienceMs(d);
    case 'timeSinceLastSetAtMost': return sinceLastSet(d) <= c.ms;
    case 'boardAtLeast': return d.board.length >= c.n;
    case 'foeHpBelow': return d.foeMaxHp > 0 && d.foeHp > 0 && d.foeHp / d.foeMaxHp < c.fraction;
  }
};

/** Every condition holds. Chance rolls go last so a failed check never spends a roll. */
export const conditionsHold = (d: Draft, when: Condition[] | undefined): boolean => {
  if (!when?.length) return true;
  return when.filter(c => c.kind !== 'chance').every(c => holds(d, c)) && when.filter(c => c.kind === 'chance').every(c => holds(d, c));
};

// ─── Triggers ───────────────────────────────────────────────────────────────

const triggerMatches = (d: Draft, key: string, t: Trigger, ev: FightEvent): boolean => {
  switch (t.on) {
    case 'set': return ev.on === 'set';
    case 'firstSetOfWave': return ev.on === 'set' && !!d._setCtx?.firstOfWave;
    case 'everyNthSet': return ev.on === 'set' && t.n > 0 && (d._setCtx?.matchNo ?? d.matches) % t.n === 0;
    case 'setsWithin': {
      if (ev.on !== 'set') return false;
      const st = d.ruleState[key] ?? {};
      const times = [...(st.times ?? []), d.elapsedMs].filter(x => d.elapsedMs - x <= t.withinMs);
      const full = times.length >= t.count;
      d.ruleState[key] = { ...st, times: full ? [] : times };
      return full;
    }
    case 'weapon': return ev.on === 'weapon' && ev.kind === t.kind;
    case 'idle':
    case 'foeBelow':
    case 'finale':
      return false;
    default: return ev.on === t.on;
  }
};

const fireRule = (d: Draft, kr: KeyedRule, chain: readonly string[]) => {
  if (d._firings >= MAX_FIRINGS_PER_ACTION) return;
  if (!conditionsHold(d, kr.rule.when)) return;
  d._firings += 1;
  const prev = d._chain;
  d._chain = [...chain, kr.key];
  if (kr.rule.callout) emit(d, 'rule', undefined, kr.rule.callout);
  for (const e of kr.rule.effects) applyEffect(d, e, kr.rule.callout);
  d._chain = prev;
};

const checkFoeBelow = (d: Draft) => {
  if (d.foeHp <= 0 || d.foeMaxHp <= 0) return;
  for (const kr of liveRulesOf(d)) {
    const t = kr.rule.trigger;
    if (t.on !== 'foeBelow' || d.ruleState[kr.key]?.fired) continue;
    if (d.foeHp / d.foeMaxHp >= t.fraction) continue;
    d.ruleState[kr.key] = { ...d.ruleState[kr.key], fired: true };
    fireRule(d, kr, []);
  }
};

/** Resolve every queued fight event (and whatever those cause) against the live rules. */
export const drain = (d: Draft) => {
  const outerCtx = d._setCtx;
  do {
    while (d._queue.length) {
      const item = d._queue.shift()!;
      d._setCtx = item.setCtx;
      for (const kr of liveRulesOf(d)) {
        if (item.chain.includes(kr.key)) continue;
        if (triggerMatches(d, kr.key, kr.rule.trigger, item.ev)) fireRule(d, kr, item.chain);
      }
    }
    d._setCtx = outerCtx;
    checkFoeBelow(d);
  } while (d._queue.length);
};

/** An evolution ran out: its own `finale` rules fire (call before its rules leave the fight). */
export const fireFinale = (d: Draft, recipeId: string) => {
  for (const kr of liveRulesOf(d)) {
    if (kr.rule.trigger.on === 'finale' && kr.key.startsWith(`evo:${recipeId}#`)) fireRule(d, kr, []);
  }
};

/** Idle rules fire once per stretch without a Set. */
export const checkIdle = (d: Draft) => {
  const since = d.elapsedMs - d.lastMatchAtMs;
  for (const kr of liveRulesOf(d)) {
    const t = kr.rule.trigger;
    if (t.on !== 'idle' || d.ruleState[kr.key]?.fired || since < t.ms) continue;
    d.ruleState[kr.key] = { ...d.ruleState[kr.key], fired: true };
    fireRule(d, kr, []);
  }
};

const resetFired = (d: Draft, on: Trigger['on']) => {
  for (const kr of liveRulesOf(d)) {
    if (kr.rule.trigger.on === on && d.ruleState[kr.key]?.fired) d.ruleState[kr.key] = { ...d.ruleState[kr.key], fired: false };
  }
};

export const resetIdleRules = (d: Draft) => resetFired(d, 'idle');
export const resetFoeBelowRules = (d: Draft) => resetFired(d, 'foeBelow');

// ─── Effects ────────────────────────────────────────────────────────────────

/** What a scaling effect counts right now. */
export const scaleCount = (d: Draft, per: Scale): number => {
  switch (per) {
    case 'boardCard': return d.board.length;
    case 'missingHeart': return d.hearts !== null && d.maxHearts !== null ? Math.max(0, d.maxHearts - d.hearts) : 0;
    case 'heart': return d.hearts ?? 0;
    case 'hint': return d.stats.hints;
    case 'grace': return d.stats.graces;
    case 'link': return d.connections.length;
    case 'combo': return d.combo;
    case 'bonusCard': return d.board.filter(c => (c.bonusPoints ?? 0) > 0 || (c.bonusMoney ?? 0) > 0).length;
    case 'burning': return d.board.filter(c => c.onFire).length;
    case 'evolution': return d.activeEvolutions.length;
  }
};

/** Turn random plain cards into power or gold cards. */
const convertCards = (d: Draft, to: 'power' | 'gold', count: number) => {
  const plain = d.board
    .map((c, i) => (touchableIdx(d, i) && isSelectable(c) && !c.snare && !c.bonusPoints && !c.bonusMoney ? i : -1))
    .filter(i => i >= 0);
  const chosen = d._rng.shuffle(plain).slice(0, count);
  if (!chosen.length) return;
  const set = new Set(chosen);
  d.board = d.board.map((c, i) =>
    !set.has(i) ? c : to === 'power' ? { ...c, bonusPoints: BASE_RULES.powerCardBonus } : { ...c, bonusMoney: BASE_RULES.coinCardValue }
  );
  emit(d, 'fetch', chosen.length, to);
};

const WEAPON_KIND: Partial<Record<Effect['do'], WeaponTriggerKind>> = {
  explode: 'explosion',
  laser: 'laser',
  ricochet: 'ricochet',
  ignite: 'fire',
  heal: 'heal',
  coins: 'coin',
  time: 'time',
  hint: 'hint',
  grace: 'grace',
  xp: 'xp',
  growBoard: 'growth',
};

/** What a bare weapon trigger does when a rule fires one (`{ do: 'trigger' }`). */
const triggerEffect = (d: Draft, kind: WeaponTriggerKind): Effect | 'autoSet' => {
  switch (kind) {
    case 'explosion': return { do: 'explode', area: { shape: 'block', cols: 2, rows: 1 } };
    case 'laser': return { do: 'laser', area: { shape: 'row' } };
    case 'fire': return { do: 'ignite', count: 1 };
    case 'ricochet': return { do: 'ricochet', count: 2 };
    case 'echo': return 'autoSet';
    case 'heal': return { do: 'heal', amount: 1 };
    case 'coin': return { do: 'coins', amount: 1 };
    case 'time': return { do: 'time', seconds: d.stats.timeGainAmount || 3 };
    case 'hint': return { do: 'hint', amount: 1 };
    case 'grace': return { do: 'grace', amount: 1 };
    case 'xp': return { do: 'xp', amount: 1 };
    case 'growth': return { do: 'growBoard', count: 1 };
  }
};

/** Run a weapon effect's behaviour once, without queuing its trigger. */
export const runWeaponEffect = (d: Draft, e: Effect) => {
  switch (e.do) {
    case 'explode': destroyCards(d, areaIndices(d, e.area), 'explosion'); break;
    case 'laser': destroyCards(d, areaIndices(d, e.area), 'laser'); break;
    case 'ricochet': destroyCards(d, areaIndices(d, { shape: 'random', count: e.count }), 'ricochet'); break;
    case 'ignite': igniteCards(d, e.count); break;
    case 'heal': heal(d, e.amount); break;
    case 'coins': addCoins(d, e.amount); break;
    case 'time': addTime(d, e.seconds); break;
    case 'hint': addHints(d, e.amount); break;
    case 'grace': addGraces(d, e.amount); break;
    case 'xp': addXp(d, e.amount); break;
    case 'growBoard': growBoard(d, e.count); break;
    case 'trigger': {
      const inner = triggerEffect(d, e.kind);
      if (inner === 'autoSet') d._hooks.autoSet(d);
      else runWeaponEffect(d, inner);
      break;
    }
    default: break;
  }
};

/** Spend one queued double, if any. */
export const takeDouble = (d: Draft): boolean => {
  if (d.doubleNext <= 0) return false;
  d.doubleNext -= 1;
  emit(d, 'doubled', d.doubleNext, '×2');
  return true;
};

/**
 * A weapon effect happened outside the rules (GameBoard rolled it on a Set).
 * Queue its trigger; if a double is waiting, `replay` runs once more.
 */
export const weaponFired = (d: Draft, kind: WeaponTriggerKind, replay?: Effect) => {
  enqueue(d, 'weapon', kind);
  if (replay && takeDouble(d)) {
    runWeaponEffect(d, replay);
    enqueue(d, 'weapon', kind);
  }
};

export const applyEffect = (d: Draft, e: Effect, label?: string) => {
  const kind = e.do === 'trigger' ? e.kind : WEAPON_KIND[e.do];
  if (kind) {
    const times = takeDouble(d) ? 2 : 1;
    for (let i = 0; i < times; i++) {
      // A full board can't grow, so "whenever the board grows" doesn't fire
      const before = d.board.length;
      runWeaponEffect(d, e);
      if (kind === 'growth' && d.board.length === before) continue;
      enqueue(d, 'weapon', kind);
    }
    return;
  }
  switch (e.do) {
    case 'damage': {
      const times = e.per ? scaleCount(d, e.per) : 1;
      const dealt = dealDamage(d, e.amount * times * foeMultiplier(d));
      if (dealt > 0) emit(d, 'hit', dealt, label ?? 'Bonus');
      break;
    }
    case 'cashIn': {
      const held = e.resource === 'hints' ? d.stats.hints : d.stats.graces;
      if (held <= 0) break;
      d.stats = { ...d.stats, [e.resource]: 0 };
      const dealt = dealDamage(d, held * e.damageEach * foeMultiplier(d));
      emit(d, 'hit', dealt, label ?? 'Cash in');
      break;
    }
    case 'convert': convertCards(d, e.to, e.count); break;
    case 'shield':
      d.freeMistakesLeft += e.count;
      emit(d, 'free_mistake', d.freeMistakesLeft);
      break;
    case 'cleanse': cleanseBoard(d); break;
    case 'empowerBoard': empowerBoard(d, e.amount); break;
    case 'armorCard': armorCard(d, e.extraHealth, e.bounty); break;
    case 'simplify': simplify(d, e.ms); break;
    case 'doubleNext':
      d.doubleNext += 1;
      emit(d, 'double_ready', d.doubleNext);
      break;
    case 'freeze':
      d.frozenMs = Math.max(d.frozenMs, e.ms);
      emit(d, 'freeze', e.ms);
      break;
    case 'redeal': redeal(d); break;
    case 'autoSet': d._hooks.autoSet(d); break;
    case 'comboStep': addComboSteps(d, e.amount); break;
    case 'spawnCatalyst': if (canSpawnCatalyst(d)) placeCatalyst(d, []); break;
    case 'extendEvolutions': extendEvolutions(d, e.ms); break;
    case 'nextSetMultiplier':
      // Stacks add up (×2 + ×2 = ×3), capped (data/rules.ts)
      d.nextSetMultiplier = Math.min(BASE_RULES.maxNextSetMultiplier, d.nextSetMultiplier + (e.times - 1));
      emit(d, 'charged', d.nextSetMultiplier);
      break;
    case 'link': if (addRandomConnections(d, e.count) > 0) emit(d, 'link', e.count); break;
    default: break;
  }
};
