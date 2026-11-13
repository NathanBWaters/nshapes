/**
 * The fight log (engine/fightLog.ts) and the replay's text (fightReplayText.ts):
 * every point of damage is accounted for, Sets and mistakes each get an entry,
 * and triggered effects name the weapon, skill node or evolution behind them.
 */
import { runReducer } from '@/adventure/engine/run';
import { BOTS, simulateRun } from '@/adventure/engine/bot';
import { barePlan, investedPlan } from '@/adventure/engine/botBuilds';
import { LEVELS } from '@/adventure/data/levels';
import { createNewSave } from '@/adventure/progress';
import { describeLines, entrySummary, entryTitle, setMathRows } from '@/adventure/components/fightReplayText';
import type { RunState } from '@/adventure/types';
import { findSet, miss, playSet, relic, startFight, tick, withWeapons } from './testUtils/adventureFight';

const sum = (s: RunState) => s.log.reduce((a, e) => a + e.damage, 0);
const freeSets = (s: RunState) => s.log.flatMap(e => e.lines).filter(l => l.text === 'Free Set').length;

describe('fight log', () => {
  it('opens with the fight start and records each Set with its cards and math', () => {
    let s = startFight();
    expect(s.log).toHaveLength(1);
    expect(s.log[0]).toMatchObject({ kind: 'wave', wave: 0, t: 0 });
    s = tick(s, 2000);
    s = playSet(s);
    const e = s.log[s.log.length - 1];
    expect(e.kind).toBe('set');
    expect(e.t).toBe(2000);
    expect(e.cards).toHaveLength(3);
    expect(e.set?.hit).toBe(e.setDamage);
    expect(e.set?.sinceLastMs).toBe(2000);
    expect(e.damage).toBe(s.totalDamage);
    expect(e.foeHp).toBe(s.foeHp);
    expect(setMathRows(e.set!).at(-1)).toEqual({ label: 'Set hit', value: `${e.set!.hit}`, total: true });
  });

  it('records mistakes with the hearts they cost', () => {
    const s = miss(startFight());
    const e = s.log[s.log.length - 1];
    expect(e.kind).toBe('mistake');
    expect(e.heartsDelta).toBe(-1);
    expect(entrySummary(e)).toBe('lost 1 heart');
  });

  it('names the weapon behind triggered damage', () => {
    let s = withWeapons(startFight(), relic([{ trigger: { on: 'set' }, effects: [{ do: 'damage', amount: 5 }], callout: 'Zap!' }]));
    s = playSet(s);
    const e = s.log[s.log.length - 1];
    expect(e.damage - e.setDamage).toBe(5);
    const lines = describeLines(e.lines);
    // The callout and its damage fold into one line
    expect(lines.filter(l => l.label === 'Zap!')).toEqual([{ label: 'Zap!', source: 'Test Relic', count: 1, damage: 5 }]);
    expect(entryTitle(e, 1)).toBe('Set #1');
  });

  it('folds the clock into one entry per second, and only when something happened', () => {
    const s = tick(startFight(), 20_000, 100);
    expect(s.log).toHaveLength(1);
  });

  it('accounts for every point of damage in real bot fights', () => {
    for (const id of ['1-4', '2-3', '3-5', '4-2', '5-3']) {
      const level = LEVELS.find(l => l.id === id)!;
      for (const plan of [barePlan(level), investedPlan(level)]) {
        const { state } = simulateRun(level, createNewSave(), BOTS.average, 11, plan);
        expect(sum(state)).toBe(state.totalDamage);
        expect(state.log.filter(e => e.kind === 'set').length + freeSets(state)).toBe(state.matches);
        expect(state.log.filter(e => e.kind === 'mistake').length).toBe(state.mistakes);
        expect(state.log.every((e, i) => i === 0 || e.t >= state.log[i - 1].t)).toBe(true);
        for (const e of state.log) {
          if (e.kind === 'set') expect(e.setDamage).toBeLessThanOrEqual(e.damage);
          // The replay can label every line it records
          for (const l of describeLines(e.lines)) expect(l.label).toBeTruthy();
        }
      }
    }
  });

  it('a hint or a pick is its own entry', () => {
    let s = startFight();
    s = runReducer(s, { type: 'USE_HINT' });
    expect(s.log[s.log.length - 1].kind).toBe('hint');
    expect(findSet(s)).toBeDefined();
  });
});
