/**
 * Fight recordings (engine/replay.ts): a fight recorded action by action
 * plays back to the exact same end, and the recording is small enough to
 * send as one analytics event.
 */
import type { RunAction } from '@/adventure/engine/run';
import type { RunState } from '@/adventure/types';
import { FightRecorder, replayFight } from '@/adventure/engine/replay';

let mockRecorder: FightRecorder | null = null;

jest.mock('@/adventure/engine/run', () => {
  const actual = jest.requireActual('@/adventure/engine/run');
  return {
    ...actual,
    runReducer: (s: unknown, a: unknown) => {
      mockRecorder?.record(a as RunAction, s as RunState);
      return actual.runReducer(s, a);
    },
  };
});

// Imported after the mock so the bot dispatches through the recording reducer
// eslint-disable-next-line import/first
import { BOTS, simulateRun } from '@/adventure/engine/bot';
// eslint-disable-next-line import/first
import { getLevel, LEVELS, PRACTICE_LEVELS } from '@/adventure/data/levels';
// eslint-disable-next-line import/first
import { createMaxedSave, createNewSave } from '@/adventure/progress';

const summary = (s: RunState) => ({
  status: s.status,
  endReason: s.endReason,
  totalDamage: s.totalDamage,
  matches: s.matches,
  mistakes: s.mistakes,
  elapsedMs: s.elapsedMs,
  coins: s.coins,
  hearts: s.hearts,
  logLength: s.log.length,
});

describe('fight recordings', () => {
  const cases: [string, string, () => ReturnType<typeof createNewSave>][] = [
    ['first level, new save', '1-1', createNewSave],
    ['mid campaign, maxed save', '2-6', createMaxedSave],
    ['late campaign, maxed save', '4-5', createMaxedSave],
  ];

  it.each(cases)('replays to the same end: %s', (_name, levelId, makeSave) => {
    const level = getLevel(levelId);
    const save = { ...makeSave(), selectedFighter: makeSave().selectedFighter };
    for (const seed of [11, 4242]) {
      for (const tier of ['average', 'novice'] as const) {
        const bot = BOTS[tier] ?? BOTS.average;
        mockRecorder = new FightRecorder(seed);
        const { state } = simulateRun(level, save, bot, seed);
        const rec = JSON.parse(JSON.stringify(mockRecorder.toJSON()));
        mockRecorder = null;
        const again = replayFight(level, save, rec);
        expect(summary(again)).toEqual(summary(state));
        // One event is capped at 1 MB; keep recordings far below it
        expect(JSON.stringify(rec).length).toBeLessThan(200_000);
      }
    }
  });

  it('every level replays exactly, and its recording stays small', () => {
    const save = createMaxedSave();
    let biggest = 0;
    for (const level of [...LEVELS, ...PRACTICE_LEVELS.filter(l => !l.rules.sandbox)]) {
      mockRecorder = new FightRecorder(7);
      const { state } = simulateRun(level, save, BOTS.novice, 7);
      const rec = JSON.parse(JSON.stringify(mockRecorder.toJSON()));
      mockRecorder = null;
      expect({ level: level.id, ...summary(replayFight(level, save, rec)) }).toEqual({ level: level.id, ...summary(state) });
      biggest = Math.max(biggest, JSON.stringify(rec).length);
    }
    expect(biggest).toBeLessThan(200_000);
  }, 60_000);
});
