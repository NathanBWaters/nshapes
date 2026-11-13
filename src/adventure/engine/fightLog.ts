/**
 * The fight log: everything that happened in one fight, as data, for the
 * results-screen replay (components/FightReplay.tsx).
 *
 * `emit` (fight.ts) copies every event into the draft's `_lines` along with
 * the rule that was running when it fired. At the end of each reducer action
 * `recordLog` turns those lines plus the action and the state change into one
 * entry: a Set, a mistake, a burn, a pick… Clock-driven entries (foe attacks,
 * fuses, evolutions ending) and burns merge per second so the log stays short.
 */
import type { Card } from '@/types';
import type { FightLogCard, FightLogEntry, FightLogKind, FightLogLine, RunState } from '../types';
import type { RunAction } from './run';
import { xpForLevel, type Draft } from './fight';
import { getRecipe, getSkillNode } from './sources';

/** Clock entries and burns closer together than this become one entry. */
const MERGE_MS = 1000;

const cardTags = (c: Card): string[] => {
  const tags: string[] = [];
  const bonus = (c.bonusPoints ?? 0) + (c.charge ?? 0);
  if (bonus > 0) tags.push(`+${bonus} dmg`);
  if ((c.bonusMoney ?? 0) > 0) tags.push(`+${c.bonusMoney}¢`);
  if (c.hasEvolutionItem) tags.push('Catalyst');
  if (c.onFire) tags.push('On fire');
  if ((c.health ?? 1) > 1) tags.push(`Armored ${c.health}`);
  if (c.isFaceDown || c.wasOriginallyFaceDown) tags.push('Face-down');
  if (c.hasBomb || c.hasCountdown) tags.push('Fused');
  if (c.isDud) tags.push('Dud');
  return tags;
};

export const logCard = (c: Card): FightLogCard => ({
  shape: c.shape,
  color: c.color,
  number: c.number,
  shading: c.shading,
  ...(c.background ? { background: c.background } : {}),
  tags: cardTags(c),
});

/** Rule key (`node:<id>#i`, `w<slot>:<id>#i`, `evo:<id>#i`) → the name players know it by. */
const sourceName = (d: RunState, key: string): string => {
  const base = key.split('#')[0];
  if (base.startsWith('node:')) return getSkillNode(base.slice(5))?.name ?? base;
  if (base.startsWith('evo:')) return getRecipe(base.slice(4))?.name ?? base;
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

const takeLines = (d: Draft): FightLogLine[] => {
  const lines = d._lines.map(l => (l.source ? { ...l, source: sourceName(d, l.source) } : l));
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
    d.log = [...d.log, entry];
    return;
  }

  // Clock, burns and refills: only worth an entry if something happened
  if (!lines.length && !delta.damage && !delta.coins && !delta.heartsDelta) return;
  const last = d.log[d.log.length - 1];
  const foldKind: FightLogKind = action.type === 'BURN' ? 'burn' : 'time';
  // Refills belong to whatever left the board; ticks and burns merge with their own kind nearby
  const fold = last && (action.type === 'REPLACE' || (last.kind === foldKind && d.elapsedMs - last.t < MERGE_MS));
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
  d.log = [...d.log, { t: d.elapsedMs, wave: d.wave, kind: foldKind, ...delta, ...after, setDamage: 0, lines }];
};
