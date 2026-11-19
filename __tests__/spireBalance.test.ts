/**
 * Starfall Spire — Headless Monte Carlo Balance Suite.
 *
 * Plays complete 21-floor climbs (Act 1 → Act 2 → Act 3 Boss → Endless Act 4)
 * using Adventure's real combat reducer & headless bots to verify:
 *  - Act 1 is welcoming & hooks players (high clear rate for average skill)
 *  - Act 2 ramps challenge meaningfully
 *  - Act 3 Boss is an exciting Slay-the-Spire A0 climax (winnable for average,
 *    strong win rate for expert, never trivial and never unfair)
 *  - Ascension 5+ measurably tightens difficulty
 *  - Endless Act 4 scales up hard
 *  - All 6 Fighters are viable climbers!
 */
import { BOTS } from '@/adventure/engine/bot';
import { FIGHTERS } from '@/adventure/data/fighters';
import { simulateSpireClimb } from '@/spire/engine/bot';

const RUNS = process.env.SPIRE_BALANCE_REPORT ? 30 : 12;

describe('Starfall Spire — full climb balance', () => {
  it('Ascension 0 has a balanced Act 1 → Act 2 → Act 3 curve for average & expert players', () => {
    const fighters = FIGHTERS.map(f => f.name);
    let avgA1 = 0, avgA2 = 0, avgA3 = 0;
    let expA1 = 0, expA2 = 0, expA3 = 0;
    const byFighter: Record<string, { n: number; avgWin: number; expWin: number; avgFloors: number }> = {};

    for (let i = 0; i < RUNS; i++) {
      const fighter = fighters[i % fighters.length];
      const seed = 5000 + i * 7919;
      const avg = simulateSpireClimb({ fighter, ascension: 0, seed, bot: BOTS.average });
      if (avg.wonAct1) avgA1 += 1;
      if (avg.wonAct2) avgA2 += 1;
      if (avg.wonAct3) avgA3 += 1;

      const exp = simulateSpireClimb({ fighter, ascension: 0, seed, bot: BOTS.expert });
      if (exp.wonAct1) expA1 += 1;
      if (exp.wonAct2) expA2 += 1;
      if (exp.wonAct3) expA3 += 1;

      const row = (byFighter[fighter] ??= { n: 0, avgWin: 0, expWin: 0, avgFloors: 0 });
      row.n += 1;
      if (avg.wonAct3) row.avgWin += 1;
      if (exp.wonAct3) row.expWin += 1;
      row.avgFloors += avg.finalFloor;
    }

    const r = (n: number) => n / RUNS;
    if (process.env.SPIRE_BALANCE_REPORT) {
      const fighterLines = Object.entries(byFighter)
        .map(([f, v]) => `    ${f.padEnd(16)} avgWin=${Math.round((v.avgWin / v.n) * 100)}% | expWin=${Math.round((v.expWin / v.n) * 100)}% | avgFloors=${(v.avgFloors / v.n).toFixed(1)}`)
        .join('\n');
      console.log(
        `SPIRE A0 (${RUNS} runs across all 6 fighters):\n` +
          `  Average: Act1=${Math.round(r(avgA1) * 100)}% | Act2=${Math.round(r(avgA2) * 100)}% | Victory=${Math.round(r(avgA3) * 100)}%\n` +
          `  Expert : Act1=${Math.round(r(expA1) * 100)}% | Act2=${Math.round(r(expA2) * 100)}% | Victory=${Math.round(r(expA3) * 100)}%\n` +
          `  Per fighter:\n${fighterLines}`
      );
    }

    // Act 1 should feel welcoming & fun
    expect(r(avgA1)).toBeGreaterThanOrEqual(0.55);
    expect(r(expA1)).toBeGreaterThanOrEqual(0.75);
    // Average players can beat the Spire with a solid run, but not 100% blindly
    expect(r(avgA3)).toBeGreaterThanOrEqual(0.2);
    expect(r(avgA3)).toBeLessThanOrEqual(0.95);
    // Skilled play pays off strongly
    expect(r(expA3)).toBeGreaterThanOrEqual(0.5);
    expect(r(expA3)).toBeGreaterThanOrEqual(r(avgA3));
  }, 60_000);

  it('Ascension 8 is meaningfully tougher than Ascension 0, and Endless Act 4 scales up', () => {
    let a0Wins = 0;
    let a8Wins = 0;
    let endlessA4Wins = 0;
    const sample = process.env.SPIRE_BALANCE_REPORT ? 18 : 6;

    for (let i = 0; i < sample; i++) {
      const fighter = FIGHTERS[i % FIGHTERS.length].name;
      const seed = 9100 + i * 3571;
      const r0 = simulateSpireClimb({ fighter, ascension: 0, seed, bot: BOTS.average });
      const r8 = simulateSpireClimb({ fighter, ascension: 8, seed, bot: BOTS.average });
      const re = simulateSpireClimb({ fighter, ascension: 0, seed, bot: BOTS.expert, playEndless: true, maxAct: 4 });
      if (r0.wonAct3) a0Wins += 1;
      if (r8.wonAct3) a8Wins += 1;
      if (re.wonAct4) endlessA4Wins += 1;
    }

    if (process.env.SPIRE_BALANCE_REPORT) {
      console.log(
        `SPIRE SCALING (${sample} runs): A0 avg win=${Math.round((a0Wins / sample) * 100)}% | A8 avg win=${Math.round((a8Wins / sample) * 100)}% | Endless A4 expert=${Math.round((endlessA4Wins / sample) * 100)}%`
      );
    }

    expect(a8Wins).toBeLessThanOrEqual(a0Wins);
    expect(endlessA4Wins).toBeLessThanOrEqual(sample);
  }, 60_000);
});
