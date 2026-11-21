import {
  calibrateBotFromPostHog,
  extractRecordingFindTimes,
  invNormalCdf,
  renderCalibrationMarkdown,
} from '@/adventure/balance/botCalibrator';
import { getLevel } from '@/adventure/data/levels';
import { BOTS, simulateRun, type BotProfile } from '@/adventure/engine/bot';
import { createMaxedSave } from '@/adventure/progress';

const makeRecording = (intervalsMs: readonly number[], hintedIdx: number[] = []) => {
  let t = 0;
  const actions: ({ type: 'TICK'; ms: number; n: number } | { at: number; a: Record<string, unknown> })[] = [];
  intervalsMs.forEach((dt, idx) => {
    t += dt;
    actions.push({ type: 'TICK', ms: 250, n: Math.max(1, Math.round(dt / 250)) });
    actions.push({
      at: t,
      a: {
        type: 'MATCH',
        hinted: hintedIdx.includes(idx),
      },
    });
  });
  return { format: 1, seed: 42, actions };
};

const makeFight = (overrides: Record<string, unknown> = {}) => ({
  event: 'fight_ended',
  distinct_id: 'SECRET-PLAYER-ID-NEVER-OUTPUT',
  timestamp: '2026-11-21T12:00:00Z',
  properties: {
    fight_id: `f-${Math.random().toString(36).slice(2)}`,
    player_code: 'NSH-DEADBEEF',
    env: 'prod',
    mode: 'adventure',
    level_id: '2-5',
    practice: false,
    outcome: 'won',
    sets: 10,
    mistakes: 1,
    helped_sets: 0,
    hints_used: 1,
    graces_used: 1,
    parries: 4,
    perfect_parries: 0,
    duration_ms: 48_000,
    median_find_ms: 3500,
    max_drought_ms: 12_000,
    weapons: ['blast-powder', 'mending-charm'],
    fun_tags: [],
    ...overrides,
  },
});

describe('botCalibrator (PostHog -> calibrated_human BotProfile)', () => {
  it('computes accurate inverse normal CDF values for order-statistic sigma fallback', () => {
    expect(invNormalCdf(0.5)).toBeCloseTo(0, 5);
    expect(invNormalCdf(0.8413447)).toBeCloseTo(1.0, 4);
    expect(invNormalCdf(0.95)).toBeCloseTo(1.64485, 4);
    expect(invNormalCdf(0.975)).toBeCloseTo(1.95996, 4);
    expect(invNormalCdf(0.05)).toBeCloseTo(-1.64485, 4);
  });

  it('extracts unhinted vs hinted inter-Set find times cleanly from recording.actions', () => {
    const rec = makeRecording([2000, 4500, 3000, 9000], [2]);
    const extracted = extractRecordingFindTimes(rec);
    expect(extracted).not.toBeNull();
    expect(extracted!.matchCount).toBe(4);
    expect(extracted!.unhintedInterSetMs).toEqual([2000, 4500, 9000]);
    expect(extracted!.hintedInterSetMs).toEqual([3000]);
  });

  it('fits linear reaction floor + per-trait slope, exact lognormal sigma, AFK trimming, E2E-bot filtering, and EB cognitive load with ZERO PII', () => {
    const events: Record<string, unknown>[] = [];

    // 6 clean 2-trait fights (~2.6s median) + 1 >30s AFK gap that must be trimmed
    for (let i = 0; i < 6; i++) {
      events.push(
        makeFight({
          fight_id: `2t-${i}`,
          level_id: '1-3', // canonical 2-trait level
          sets: 7,
          mistakes: 0,
          graces_used: 0,
          parries: 0,
          perfect_parries: 0,
          median_find_ms: 2600,
          max_drought_ms: 8500,
          weapons: ['flint-spark'],
          recording: makeRecording([1800, 2200, 2600, 2600, 4200, 8200, ...(i === 0 ? [45_000] : [])]),
        })
      );
    }

    // 10 clean 3-trait timed fights (~3.6s median; mix rainbow-charm & echo-stone inside BOTH spire and adventure strata)
    for (let i = 0; i < 10; i++) {
      const slow = i % 2 === 0;
      const mult = slow ? 1.25 : 0.8;
      const intervals = [1800, 2500, 3600, 3600, 5200, 9800, 14_000].map(ms => Math.round(ms * mult));
      events.push(
        makeFight({
          fight_id: `3t-${i}`,
          mode: i < 5 ? 'spire' : 'adventure',
          level_id: i < 5 ? 'spire-2-14-enc-a2-r6-c1' : '2-5',
          sets: 7,
          mistakes: i % 3 === 0 ? 1 : 0,
          graces_used: i < 5 ? 1 : 0,
          hints_used: i < 5 ? 1 : 0,
          parries: 3,
          perfect_parries: i === 0 ? 1 : 0,
          median_find_ms: Math.round(3600 * mult),
          max_drought_ms: Math.round(14_000 * mult),
          weapons: slow ? ['rainbow-charm'] : ['echo-stone'],
          recording: makeRecording(intervals),
        })
      );
    }

    // Noise events that MUST be dropped: tutorial 1-1, dev E2E bot, short fight, bug-tagged fight
    events.push(
      makeFight({ fight_id: 'tut-1', level_id: '1-1' }),
      makeFight({ fight_id: 'dev-e2e', env: 'dev', median_find_ms: 1100, max_drought_ms: 1400, mistakes: 0 }),
      makeFight({ fight_id: 'short-1', sets: 1, duration_ms: 4000 }),
      makeFight({ fight_id: 'bug-1', fun_tags: ['bug_in_game'] })
    );

    const res = calibrateBotFromPostHog(events, { source: 'unit-test' });
    expect(res.audit.kept).toBe(16);
    expect(res.audit.keptTimed).toBe(10);
    expect(res.audit.droppedByTutorial).toBe(1);
    expect(res.audit.droppedByEnv).toBe(1);
    expect(res.audit.droppedByShort).toBe(1);
    expect(res.audit.droppedByBug).toBe(1);
    expect(res.audit.afkGapsTrimmed).toBe(1);

    expect(res.empirical.sigmaMethod).toBe('recording');
    expect(res.empirical.regressionMethod).toBe('linear');
    expect(res.profile.baseReactionSec).toBeGreaterThanOrEqual(0.4);
    expect(res.profile.secondsPerAttribute).toBeGreaterThanOrEqual(0.65);
    expect(res.profile.findTimeSigma).toBeGreaterThan(0.4);
    expect(res.profile.findTimeSigma).toBeLessThan(1.2);
    expect(res.profile.perfectParryWaitChance).toBeCloseTo(1 / 30, 2);

    // Stratified EB cognitive load: rainbow-charm slowed down (>1), echo-stone sped up (<1), shrunk toward 1.00
    const rc = res.cognitiveLoad.byWeapon.find(w => w.weaponId === 'rainbow-charm')!;
    const es = res.cognitiveLoad.byWeapon.find(w => w.weaponId === 'echo-stone')!;
    expect(rc.rawMult).toBeGreaterThan(1.05);
    expect(rc.shrunkMult).toBeGreaterThan(1.0);
    expect(rc.shrunkMult).toBeLessThan(rc.rawMult);
    expect(es.rawMult).toBeLessThan(0.95);
    expect(es.shrunkMult).toBeLessThan(1.0);
    expect(es.shrunkMult).toBeGreaterThan(es.rawMult);

    // When includeDev: true, Playwright E2E bot signature is still dropped into droppedByE2eBot
    const withDev = calibrateBotFromPostHog(events, { includeDev: true });
    expect(withDev.audit.droppedByE2eBot).toBe(1);
    expect(withDev.audit.kept).toBe(16);

    // Security: zero raw distinct_id or player_code anywhere in JSON or Markdown
    const serialized = JSON.stringify(res);
    const md = renderCalibrationMarkdown(res);
    expect(serialized).not.toContain('SECRET-PLAYER-ID');
    expect(serialized).not.toContain('NSH-DEADBEEF');
    expect(md).toContain('calibrated_human');
    expect(md).not.toContain('NSH-DEADBEEF');
  });

  it('falls back to 0.80s floor-anchor and order-statistic sigma when only 1 trait bucket and no recordings exist', () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      makeFight({
        fight_id: `norec-${i}`,
        level_id: '2-5',
        sets: 12,
        median_find_ms: 3500,
        max_drought_ms: 12_500,
        mistakes: 1,
        graces_used: 0,
      })
    );

    const res = calibrateBotFromPostHog(events);
    expect(res.empirical.sigmaMethod).toBe('order-statistic');
    expect(res.empirical.regressionMethod).toBe('floor-anchor');
    expect(res.profile.baseReactionSec).toBeCloseTo(0.8, 3);
    expect(res.profile.secondsPerAttribute).toBeCloseTo((3.5 - 0.8) / 3, 2);
    // ln(12500/3500) / invNormalCdf(1 - 0.5/12) ≈ 1.273 / 1.732 ≈ 0.735
    expect(res.profile.findTimeSigma!).toBeGreaterThan(0.6);
    expect(res.profile.findTimeSigma!).toBeLessThan(0.9);
  });

  it('keeps BOTS.average bit-for-bit deterministic and activates lognormal + cognitive load + parry override when set', () => {
    const level = getLevel('2-5');
    const save = { ...createMaxedSave(), charms: ['blast-powder', 'mending-charm'], skillNodes: {}, equippedArcana: [] };

    // BOTS.average with explicit undefined optional fields produces identical state
    const r1 = simulateRun(level, save, BOTS.average, 12345, undefined, { skipPicks: true });
    const r2 = simulateRun(level, save, { ...BOTS.average, findTimeSigma: 0 }, 12345, undefined, { skipPicks: true });
    expect(r1.state.totalDamage).toBe(r2.state.totalDamage);
    expect(r1.state.matches).toBe(r2.state.matches);
    expect(r1.state.elapsedMs).toBe(r2.state.elapsedMs);

    // Lognormal + cognitive load bot runs deterministically and slows down when cognitiveLoad > 1
    const fastHuman: BotProfile = {
      ...BOTS.expert,
      name: 'calibrated_human',
      baseReactionSec: 0.8,
      secondsPerAttribute: 0.9,
      findTimeSigma: 0.75,
      perfectParryWaitChance: 0.06,
      cognitiveLoadByWeapon: { 'blast-powder': 0.8 },
    };
    const slowHuman: BotProfile = {
      ...fastHuman,
      cognitiveLoadByWeapon: { 'blast-powder': 1.3 },
    };
    const hFast1 = simulateRun(level, save, fastHuman, 12345, undefined, { skipPicks: true });
    const hFast2 = simulateRun(level, save, fastHuman, 12345, undefined, { skipPicks: true });
    expect(hFast1.state.totalDamage).toBe(hFast2.state.totalDamage);
    expect(hFast1.state.matches).toBe(hFast2.state.matches);

    const hSlow = simulateRun(level, save, slowHuman, 12345, undefined, { skipPicks: true });
    // Higher cognitive load produces fewer matches or longer elapsed fight
    expect(hFast1.state.matches >= hSlow.state.matches || hFast1.state.elapsedMs <= hSlow.state.elapsedMs).toBe(true);
  });
});
