/**
 * The fight log: everything that happened in one fight, as data, for the
 * results-screen replay (components/FightReplay.tsx).
 */
import type { Card } from '@/types';
import type { FightLogCard, FightLogEntry, FightLogKind, FightLogLine, RunState } from '../types';
import { BASE_RULES, TRICK_RULES } from '../data/rules';
import type { RunAction } from './run';
import { xpForLevel, type Draft } from './fight';
import { getSkillNode, getWeaponEvolution } from './sources';

/** Clock entries and burns closer together than this become one entry. */
const MERGE_MS = 1000;

/** A practice fight has no end, so its log keeps the opening and the most recent entries. */
const PRACTICE_LOG_LIMIT = 400;

const append = (d: Draft, entry: FightLogEntry) => {
  const log = [...d.log, entry];
  d.log = d.level.rules.sandbox && log.length > PRACTICE_LOG_LIMIT ? [log[0], ...log.slice(2)] : log;
};

const cardTags = (c: Card): string[] => {
  const tags: string[] = [];
  if (c.holo) tags.push(`Holo +${BASE_RULES.holoCardBonus ?? 4} ×${1 + (BASE_RULES.holoCardMult ?? 0.2)}`);
  if ((c.bonusPoints ?? 0) > 0) tags.push(`Power +${c.bonusPoints}`);
  if ((c.charge ?? 0) > 0) tags.push(`Charged +${c.charge}`);
  if ((c.bonusMoney ?? 0) > 0) tags.push(`+${c.bonusMoney}¢`);
  if (c.marked) tags.push('Marked');
  if (c.magnet) tags.push('Magnet');
  if (c.chest !== undefined && c.chest > 0) tags.push(`Chest +${c.chest}`);
  if (c.doubler) tags.push(`Cursed ×${TRICK_RULES.curseMultiplier}`);
  if (c.hot) tags.push('Hot Potato');
  if (c.isWild) tags.push('Wild');
  if (c.onFire) tags.push('On fire');
  if ((c.health ?? 1) > 1) tags.push(`Armored ${c.health}`);
  if (c.isFaceDown || c.wasOriginallyFaceDown) tags.push('Face-down');
  if (c.hasBomb || c.hasCountdown) tags.push('Fused');
  if (c.isDud) tags.push('Dud');
  return tags;
};

export const logCard = (c: Card): FightLogCard => {
  const holoBonus = c.holo ? (BASE_RULES.holoCardBonus ?? 4) : 0;
  const bonusPoints = holoBonus + (c.bonusPoints ?? 0) + (c.charge ?? 0);
  const points = (BASE_RULES.cardBasePoints ?? 2) + bonusPoints;
  return {
    shape: c.shape,
    color: c.color,
    number: c.number,
    shading: c.shading,
    ...(c.background ? { background: c.background } : {}),
    points,
    ...(bonusPoints > 0 ? { bonusPoints } : {}),
    tags: cardTags(c),
  };
};

/** Rule key (`node:<id>#i`, `w<slot>:<id>#i`, `evo:<evoId>#i`, `weapon:<id>`) → display name. */
const sourceName = (d: RunState, key: string): string => {
  const base = key.split('#')[0];
  if (base.startsWith('node:')) return getSkillNode(base.slice(5))?.name ?? base;
  if (base.startsWith('evo:')) return getWeaponEvolution(base.slice(4))?.name ?? base;
  if (base.startsWith('weapon:')) {
    const wid = base.slice(7);
    return d.weapons.find(w => w.id === wid)?.name ?? wid;
  }
  const slot = /^w(\d+):(.*)$/.exec(base);
  if (slot) return d.weapons[Number(slot[1])]?.name ?? slot[2];
  return base;
};

/** XP earned so far this fight (level-ups spend `xp`, so count the levels too). */
const totalXp = (s: RunState): number => {
  let sum = s.xp;
  for (let l = 0; l < s.xpLevel; l++) sum += xpForLevel(l);
  return sum;
};

/** Rule key → "weapon:<id>" | "node:<id>" | "evo:<evoId>", for looking the source up after the fight. */
const sourceRef = (d: RunState, key: string): string => {
  const base = key.split('#')[0];
  const slot = /^w(\d+):(.*)$/.exec(base);
  return slot ? `weapon:${d.weapons[Number(slot[1])]?.id ?? slot[2]}` : base;
};

const takeLines = (d: Draft): FightLogLine[] => {
  const lines = d._lines.map(l => (l.source ? { ...l, source: sourceName(d, l.source), sourceRef: sourceRef(d, l.source) } : l));
  d._lines = [];
  return lines;
};

const KIND: Partial<Record<RunAction['type'], FightLogKind>> = {
  MATCH: 'set',
  INVALID: 'mistake',
  USE_HINT: 'hint',
  PICK: 'pick',
  BUY: 'buy',
  NEXT_WAVE: 'wave',
};

/** The fight's opening (start-of-fight rules, the first foe's setup) as entry 0. */
export const recordFightStart = (d: Draft) => {
  d.log = [{
    t: 0, wave: 0, kind: 'wave', damage: d.totalDamage, setDamage: 0, coins: d.coins, xp: totalXp(d),
    hearts: d.hearts, heartsDelta: 0, foeHp: d.foeHp, foeMaxHp: d.foeMaxHp, lines: takeLines(d),
  }];
};

/** Turn one reducer action into a log entry (or fold it into the last one). */
export const recordLog = (d: Draft, prev: RunState, action: RunAction) => {
  const lines = takeLines(d);
  const delta = {
    damage: d.totalDamage - prev.totalDamage,
    coins: d.coins - prev.coins,
    xp: totalXp(d) - totalXp(prev),
    heartsDelta: (d.hearts ?? 0) - (prev.hearts ?? 0),
  };
  const after = { hearts: d.hearts, foeHp: d.foeHp, foeMaxHp: d.foeMaxHp };
  const setMath = d._logSet;
  d._logSet = null;

  const kind = KIND[action.type];
  if (kind) {
    if (action.type === 'PICK' && !action.weaponId) return;
    const label =
      action.type === 'PICK' ? prev.pickOptions.find(w => w.id === action.weaponId)?.name
      : action.type === 'BUY' ? prev.shopOptions[action.index]?.name
      : undefined;
    const cards = action.type === 'MATCH' || action.type === 'INVALID' ? action.cards.slice(0, 3).map(logCard) : undefined;
    const entry: FightLogEntry = {
      t: d.elapsedMs, wave: d.wave, kind, ...delta, ...after, lines,
      setDamage: setMath?.hit ?? 0,
      ...(cards ? { cards } : {}),
      ...(setMath ? { set: setMath } : {}),
      ...(label ? { label } : {}),
    };
    append(d, entry);
    return;
  }

  if (!lines.length && !delta.damage && !delta.coins && !delta.heartsDelta) return;
  const last = d.log[d.log.length - 1];
  const foldKind: FightLogKind = action.type === 'BURN' ? 'burn' : 'time';
  const fold =
    last &&
    (action.type === 'REPLACE' ||
      (last.kind === foldKind && d.elapsedMs - last.t < MERGE_MS));
  if (fold) {
    d.log = [...d.log.slice(0, -1), {
      ...last, ...after,
      damage: last.damage + delta.damage,
      coins: last.coins + delta.coins,
      xp: last.xp + delta.xp,
      heartsDelta: last.heartsDelta + delta.heartsDelta,
      lines: [...last.lines, ...lines],
    }];
    return;
  }
  append(d, { t: d.elapsedMs, wave: d.wave, kind: foldKind, ...delta, ...after, setDamage: 0, lines });
};
