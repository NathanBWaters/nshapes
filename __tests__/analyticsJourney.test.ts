const mockMap = new Map<string, string>();
jest.mock('@/utils/storage', () => ({
  storage: {
    getString: (k: string) => mockMap.get(k),
    set: (k: string, v: string) => mockMap.set(k, v),
    remove: (k: string) => mockMap.delete(k),
  },
}));

const fetchMock = jest.fn(async () => ({ ok: true, status: 200 }));
(global as { fetch?: unknown }).fetch = fetchMock;

import { getArmoryWeapon } from '@/adventure/data/armory';
import { getLevel } from '@/adventure/data/levels';
import { FightRecorder, type FightTape } from '@/adventure/engine/replay';
import { battleRecord } from '@/adventure/history';
import { applyLevelResult, createNewSave } from '@/adventure/progress';
import {
  FIGHT_EVENT,
  FIGHT_RATED_EVENT,
  commitAdventureFight,
  markReplayOpened,
  rateFight,
  stageAdventureFight,
} from '@/analytics/fightEvent';
import {
  SESSION_TIMEOUT_MS,
  __enableAnalyticsForTests,
  __resetAnalyticsForTests,
  capture,
  computeJourneyStage,
  distinctId,
  flush,
  getAnalyticsInspectorState,
  identifyPlayer,
  installId,
  playerCode,
  readPlayerProfile,
  resetPlayerIdentity,
  touchSession,
} from '@/analytics/posthog';
import { playSet, startFight, tick, withWeapons } from './testUtils/adventureFight';

const makeWonRun = () => {
  const level = getLevel('1-1');
  let run = withWeapons(startFight({ level, features: ['hearts'] }), getArmoryWeapon('clarity-lens')!);
  run = tick(run, 10_000, 1000);
  while (run.status === 'playing') run = playSet(run);
  return { level, run };
};

const makeTape = (
  choices = { offered: ['clarity-lens', 'war-drum'], picked: ['clarity-lens'], bought: [], rerolls: 1 }
): FightTape => ({
  recording: new FightRecorder(4242).toJSON(),
  choices,
  save: createNewSave(),
});

const sentBatches = (): { event: string; distinct_id: string; properties: Record<string, unknown> }[] => {
  const out: { event: string; distinct_id: string; properties: Record<string, unknown> }[] = [];
  for (const call of fetchMock.mock.calls as unknown[][]) {
    const init = call[1] as { body?: string } | undefined;
    if (!init?.body) continue;
    const parsed = JSON.parse(init.body) as { batch?: typeof out };
    if (Array.isArray(parsed.batch)) {
      out.push(...parsed.batch);
    }
  }
  return out;
};

describe('analytics user journey, sessions & 1-event-per-game staging', () => {
  beforeEach(() => {
    mockMap.clear();
    fetchMock.mockClear();
    __resetAnalyticsForTests();
    __enableAnalyticsForTests();
  });

  it('derives deterministic support playerCode and resets profile cleanly on identity reset', () => {
    const id1 = installId();
    const code1 = playerCode();
    expect(distinctId()).toBe(id1);
    expect(code1).toMatch(/^NSH-[A-Z0-9]{8}$/);
    expect(playerCode()).toBe(code1);

    mockMap.set('analytics_distinct_id', 'linked-user-1');
    expect(distinctId()).toBe('linked-user-1');

    resetPlayerIdentity();
    expect(distinctId()).toBe(installId());
    expect(readPlayerProfile().totalFights).toBe(0);
  });

  it('tracks rolling 30-min sessions, fight index increments, and inactivity rollovers', () => {
    const t0 = 1_700_000_000_000;
    const s1 = touchSession(t0);
    expect(s1.sessionNumber).toBe(1);
    expect(s1.fightIndex).toBe(0);

    const s1Fight1 = touchSession(t0 + 60_000, { incrementFight: true });
    expect(s1Fight1.sessionNumber).toBe(1);
    expect(s1Fight1.fightIndex).toBe(1);

    const s1Fight2 = touchSession(t0 + 25 * 60_000, { incrementFight: true });
    expect(s1Fight2.sessionNumber).toBe(1);
    expect(s1Fight2.fightIndex).toBe(2);

    const s2 = touchSession(t0 + 25 * 60_000 + SESSION_TIMEOUT_MS + 1000, { incrementFight: true });
    expect(s2.sessionNumber).toBe(2);
    expect(s2.fightIndex).toBe(1);
  });

  it('computes player journey_stage accurately across progression milestones', () => {
    const base = readPlayerProfile();
    expect(computeJourneyStage({ ...base, totalFights: 0, highestLevelOrder: 0 })).toBe('new_player');
    expect(computeJourneyStage({ ...base, totalFights: 2, adventureFights: 1, levelsClearedCount: 0 })).toBe('onboarding');
    expect(computeJourneyStage({ ...base, totalFights: 2, adventureFights: 2, levelsClearedCount: 1 })).toBe('early_adventure');
    expect(computeJourneyStage({ ...base, adventureFights: 5, levelsClearedCount: 4, highestLevelOrder: 8 })).toBe('mid_adventure');
    expect(computeJourneyStage({ ...base, adventureFights: 10, levelsClearedCount: 8, highestLevelOrder: 16 })).toBe('late_adventure');
    expect(computeJourneyStage({ ...base, adventureFights: 20, levelsClearedCount: 12, highestWorldUnlocked: 4 })).toBe('veteran');
    expect(computeJourneyStage({ ...base, freePlayFights: 2, adventureFights: 0 })).toBe('free_play_explorer');
  });

  it('merges rating, feedback tags, and replay inspection into ONE wide fight_ended event', async () => {
    const { level, run } = makeWonRun();
    const record = battleRecord(level, run, { at: 1_700_000_100_000 });
    const tape = makeTape();
    const afterSave = applyLevelResult(createNewSave(), level, 3, 10, run).save;

    const fightId = stageAdventureFight(level, run, record, tape, { afterSave });
    expect(getAnalyticsInspectorState().stagedFightId).toBe(fightId);
    expect(sentBatches()).toHaveLength(0);

    const r1 = rateFight(fightId, { funRating: 'up', funTags: ['close_call', 'great_build'] }, { source: 'results' });
    expect(r1.updatedStaged).toBe(true);
    expect(markReplayOpened(fightId)).toBe(true);

    const r2 = rateFight(fightId, { funRating: 'down', funTags: ['unfair_rng'] }, { source: 'results' });
    expect(r2.updatedStaged).toBe(true);
    expect(sentBatches()).toHaveLength(0);

    expect(commitAdventureFight('next_level')).toBe(true);
    await flush();

    const events = sentBatches();
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.event).toBe(FIGHT_EVENT);
    expect(ev.properties.fight_id).toBe(fightId);
    expect(ev.properties.fun_rating).toBe('down');
    expect(ev.properties.fun_score).toBe(0);
    expect(ev.properties.fun_tags).toEqual(['unfair_rng']);
    expect(ev.properties.replay_opened).toBe(true);
    expect(ev.properties.commit_reason).toBe('next_level');
    expect(ev.properties.weapons_offered).toEqual(['clarity-lens', 'war-drum']);
    expect(ev.properties.weapons_picked).toEqual(['clarity-lens']);
    expect(ev.properties.shop_rerolls).toBe(1);
    expect(ev.properties.session_fight_index).toBe(1);
    expect(ev.properties.journey_stage).toBe('early_adventure');

    expect(ev.properties.$set_once).toBeDefined();
    expect((ev.properties.$set as Record<string, unknown>).total_fights).toBe(1);
    expect((ev.properties.$set as Record<string, unknown>).fun_rate).toBe(0);
    expect((ev.properties.$set as Record<string, unknown>).fun_ratings_count).toBe(1);
  });

  it('falls back to fight_rated when editing an already-committed fight from Camp History', async () => {
    const { level, run } = makeWonRun();
    const record = battleRecord(level, run, { at: 1_700_000_200_000 });
    const fightId = stageAdventureFight(level, run, record, makeTape());
    commitAdventureFight('map');
    await flush();
    expect(sentBatches()).toHaveLength(1);

    const late = rateFight(fightId, { funRating: 'up', funTags: ['fair_challenge'] }, { source: 'history' });
    expect(late.updatedStaged).toBe(false);
    await flush();

    const events = sentBatches();
    expect(events).toHaveLength(2);
    expect(events[1].event).toBe(FIGHT_RATED_EVENT);
    expect(events[1].properties.fight_id).toBe(fightId);
    expect(events[1].properties.fun_rating).toBe('up');
    expect(events[1].properties.source).toBe('history');
  });

  it('links anonymous installId to an external userId via $identify without duplicating future events', async () => {
    const anon = installId();
    identifyPlayer('account-42', { supporter: true });
    capture('app_opened', { source: 'test' });
    await flush();

    expect(distinctId()).toBe('account-42');
    const batches = sentBatches();
    const idEvent = batches.find(e => e.event === '$identify');
    expect(idEvent).toBeDefined();
    expect(idEvent?.distinct_id).toBe('account-42');
    expect(idEvent?.properties.$anon_distinct_id).toBe(anon);
  });

  it('records shop/pick offers, picks, buys, and rerolls inside FightRecorder.choicesJSON()', () => {
    const recorder = new FightRecorder(777);
    const lens = getArmoryWeapon('clarity-lens')!;
    const drum = getArmoryWeapon('war-drum')!;

    recorder.record(
      { type: 'PICK', weaponId: 'clarity-lens' },
      { elapsedMs: 1000, board: [], deck: [], pickOptions: [lens, drum] }
    );
    recorder.record(
      { type: 'REROLL' },
      { elapsedMs: 2000, board: [], deck: [], shopOptions: [lens] }
    );
    recorder.record(
      { type: 'BUY', index: 0 },
      { elapsedMs: 2500, board: [], deck: [], shopOptions: [drum] }
    );

    expect(recorder.choicesJSON()).toEqual({
      offered: ['clarity-lens', 'war-drum', 'clarity-lens', 'war-drum'],
      picked: ['clarity-lens'],
      bought: ['war-drum'],
      rerolls: 1,
    });
  });
});
