/**
 * Analytics client (src/analytics/posthog.ts) and the per-fight event.
 */
jest.mock('@/utils/storage', () => {
  const mem = new Map<string, string>();
  return {
    storage: {
      getString: (k: string) => mem.get(k),
      set: (k: string, v: string) => void mem.set(k, v),
      remove: (k: string) => void mem.delete(k),
    },
  };
});

// eslint-disable-next-line import/first
import { storage } from '@/utils/storage';
import { __enableAnalyticsForTests, capture, flush, installId, setAnalyticsEnabled } from '@/analytics/posthog';
import { fightEventProps } from '@/analytics/fightEvent';
import { battleRecord } from '@/adventure/history';
import { getLevel } from '@/adventure/data/levels';
import { createMaxedSave, createSaveBefore } from '@/adventure/progress';
import { FightRecorder, replayFight } from '@/adventure/engine/replay';
import { baseCardReward, createRun, runReducer } from '@/adventure/engine/run';

const queue = () => JSON.parse(storage.getString('analytics_queue') ?? '[]');
const fetchMock = jest.fn();

beforeAll(() => {
  __enableAnalyticsForTests();
  (global as unknown as { fetch: typeof fetchMock }).fetch = fetchMock;
});
beforeEach(() => {
  storage.remove('analytics_queue');
  storage.remove('analytics_opt_out');
  fetchMock.mockReset();
});

describe('analytics client', () => {
  it('sends a batch to PostHog and empties the queue', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    capture('test_event', { a: 1 });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://us.i.posthog.com/batch/');
    const body = JSON.parse(init.body);
    expect(body.api_key).toMatch(/^phc_/);
    expect(body.batch[0]).toMatchObject({ event: 'test_event', distinct_id: installId(), properties: { a: 1, env: 'dev' } });
    expect(body.batch[0].properties.app_version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(queue()).toEqual([]);
  });

  it('keeps events while offline and sends them later', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    capture('one');
    await flush();
    capture('two');
    await flush();
    expect(queue().map((e: { event: string }) => e.event)).toEqual(['one', 'two']);
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
    await flush();
    expect(queue()).toEqual([]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).batch).toHaveLength(2);
  });

  it('keeps the install id stable', () => {
    expect(installId()).toBe(installId());
    expect(installId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('drops the bulky parts of an event too big to send', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    capture('fight_ended', { level_id: '1-1', recording: 'x'.repeat(1_000_000) });
    await flush();
    const [e] = queue();
    expect(e.properties).toMatchObject({ level_id: '1-1', truncated: true });
    expect(e.properties.recording).toBeUndefined();
  });

  it('sends nothing once the player opts out', async () => {
    setAnalyticsEnabled(false);
    capture('nope');
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    setAnalyticsEnabled(true);
  });
});

describe('fight_ended event', () => {
  it('summarizes the fight and carries a recording that replays it', () => {
    const level = getLevel('2-6');
    const save = createMaxedSave();
    const rec = new FightRecorder(3);
    let s = createRun(level, save, { seed: 3 });
    // A short fight left partway (whole bot fights replaying is covered in adventureReplay.test.ts)
    for (let i = 0; i < 50; i++) {
      const a = { type: 'TICK' as const, ms: 100 };
      rec.record(a, s);
      s = runReducer(s, a);
    }
    const tape = { recording: rec.toJSON(), save };
    const props = fightEventProps(level, s, battleRecord(level, s, { at: 0, left: true }), tape);
    expect(props).toMatchObject({ level_id: '2-6', world: 2, outcome: 'left', seed: 3, recording_format: 1 });
    expect(replayFight(level, props.save, JSON.parse(JSON.stringify(props.recording))).elapsedMs).toBe(s.elapsedMs);
    expect(JSON.stringify(props).length).toBeLessThan(900_000);
  });

  it('counts the Sets made on a pointed-out card (a guided step, stuck help, a hint)', () => {
    const level = getLevel('1-2');
    const save = createSaveBefore('1-2');
    const rec = new FightRecorder(4);
    let s = createRun(level, save, { seed: 4 });
    // (1-2 plays on the nine cards of two traits: any three of one colour are a Set)
    const play = (hinted: boolean) => {
      const cards = s.board.filter(c => c.color === 'red').slice(0, 3);
      const match = { type: 'MATCH' as const, cards, rewards: cards.map(baseCardReward), hinted };
      rec.record(match, s);
      s = runReducer(s, match);
      const replace = { type: 'REPLACE' as const, ids: cards.map(c => c.id) };
      rec.record(replace, s);
      s = runReducer(s, replace);
    };
    play(false);
    play(true);
    play(true);
    const tape = { recording: rec.toJSON(), save };
    const props = fightEventProps(level, s, battleRecord(level, s, { at: 0, left: true }), tape);
    expect(props.sets).toBe(3);
    expect(props.helped_sets).toBe(2);
  });
});
