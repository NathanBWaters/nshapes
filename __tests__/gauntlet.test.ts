import {
  computeClearScore,
  DEFAULT_CALIBRATED_HUMAN_BOT,
  GAUNTLET_TIER_IDS,
  renderGauntletMarkdown,
  runGauntlet,
} from '@/adventure/balance/gauntlet';
import { getLevel } from '@/adventure/data/levels';
import type { RunState } from '@/adventure/types';

describe('gauntlet (6-Tier Multi-Difficulty Enemy Gauntlet)', () => {
  it('computes the smooth Encounter Clear Score formula accurately for wins, close losses, and overkill caps', () => {
    const timedLevel = getLevel('2-5');
    const levelTimer = timedLevel.rules.timer!;
    const mockWin = {
      status: 'won',
      endReason: 'defeated',
      totalDamage: 5000, // > 1.5x of 2000 -> capped at 1.5
      foeHp: 0,
      foeMaxHp: 2000,
      timeLeft: levelTimer * 0.5, // 0.50 share
      movesLeft: null,
      hearts: 3,
      maxHearts: 3, // 1.00 share
    } as unknown as RunState;

    const winMetrics = computeClearScore(mockWin, timedLevel);
    // 0.50 * 1.5 + 0.30 * 1 + 0.20 * ((0.5 + 1.0) / 2) = 0.75 + 0.30 + 0.15 = 1.20
    expect(winMetrics.damageRatio).toBeCloseTo(1.5, 4);
    expect(winMetrics.winRate).toBe(1);
    expect(winMetrics.survivalRate).toBe(1);
    expect(winMetrics.clearScore).toBeCloseTo(1.2, 4);

    const mockCloseLoss = {
      status: 'lost',
      endReason: 'hearts',
      totalDamage: 1800,
      foeHp: 200,
      foeMaxHp: 2000,
      timeLeft: levelTimer * 0.2, // 0.20 share
      movesLeft: null,
      hearts: 0,
      maxHearts: 3,
    } as unknown as RunState;

    const lossMetrics = computeClearScore(mockCloseLoss, timedLevel);
    // 0.50 * 0.90 + 0.30 * 0 + 0.20 * ((0.20 + 0) / 2) = 0.45 + 0.02 = 0.47
    expect(lossMetrics.winRate).toBe(0);
    expect(lossMetrics.survivalRate).toBe(0);
    expect(lossMetrics.clearScore).toBeCloseTo(0.47, 4);
  });

  it('runs a fast deterministic subset across all 6 canonical tiers (including partner weapons & per-weapon evolutions)', () => {
    const report = runGauntlet({
      humanBot: DEFAULT_CALIBRATED_HUMAN_BOT,
      weaponIds: ['blast-powder', 'mending-charm', 'understudy', 'encore-mask'],
      fighterNames: ['Orange Tabby', 'Sly Fox'],
      evolutionIds: ['blast-powder:cluster-charge', 'encore-mask:second-act'],
      weaponSeedsOverride: { T1: 1, T2: 1, T3: 1, T4: 1, T5: 1, T6: 1 },
      fighterSeedsOverride: { T1: 1, T2: 1, T3: 1, T4: 1, T5: 1, T6: 1 },
      evoSeedsOverride: { T3: 1, T4: 1, T5: 1 },
    });

    // All 6 canonical tiers present with real non-dummy enemies
    expect(report.tiers.map(t => t.id)).toEqual([...GAUNTLET_TIER_IDS]);
    expect(report.tiers[0].encounters[0].enemy).toBe('Iron Shell');
    expect(report.tiers[1].encounters.map(e => e.enemy)).toEqual(['Greedy Squirrel', 'Junk Rat']);
    expect(report.tiers[2].encounters[0].enemy).toBe('Charging Boar');
    expect(report.tiers[3].encounters.map(e => e.enemy)).toEqual(['Ticking Viper', 'Feral Fangs']);
    expect(report.tiers[4].mode).toBe('spire');
    expect(report.tiers[4].encounters.some(e => (e.ascension ?? 0) >= 15)).toBe(true);
    expect(report.tiers[5].encounters[0].enemy).toBe('The Hydra');

    // Weapons: 1.00x-anchored, partner weapons evaluated safely inside multi-weapon belts
    expect(report.weapons).toHaveLength(4);
    expect(Math.min(...report.weapons.map(w => w.humanMult))).toBeCloseTo(1.0, 4);
    expect(Math.min(...report.weapons.map(w => w.avgMult))).toBeCloseTo(1.0, 4);
    const understudy = report.weapons.find(w => w.id === 'understudy')!;
    expect(understudy.partner).toBe(true);
    expect(understudy.avgBotLift).toBeGreaterThan(0.5);
    expect(Object.keys(understudy.byTier)).toEqual([...GAUNTLET_TIER_IDS]);

    // Fighters: 1.00x-anchored with scaled skill trees through 160★ endgame
    expect(report.fighters).toHaveLength(2);
    expect(Math.min(...report.fighters.map(f => f.humanMult))).toBeCloseTo(1.0, 4);
    expect(report.tiers[5].fighterStars).toBe(160);

    // Evolutions: per-weapon timed evolutions evaluated cleanly (including partner-safe Encore Mask anchor)
    expect(report.evolutions).toHaveLength(2);
    const cluster = report.evolutions.find(e => e.id === 'blast-powder:cluster-charge')!;
    const secondAct = report.evolutions.find(e => e.id === 'encore-mask:second-act')!;
    expect(cluster.weaponId).toBe('blast-powder');
    expect(cluster.variantIndex).toBe(0);
    expect(secondAct.weaponId).toBe('encore-mask');
    expect(secondAct.variantIndex).toBe(0);
    expect(Math.min(...report.evolutions.map(e => e.humanMult))).toBeCloseTo(1.0, 4);
    expect(Math.min(...report.evolutions.map(e => e.avgMult))).toBeCloseTo(1.0, 4);
    expect(secondAct.humanBotLift).toBeGreaterThan(0.5);
    expect(cluster.avgTriggersPerFight).toBeGreaterThanOrEqual(0);

    // Markdown renders cleanly
    const md = renderGauntletMarkdown(report, { top: 4, bottom: 2 });
    expect(md).toContain('# NShapes 6-Tier Multi-Difficulty Enemy Gauntlet Report');
    expect(md).toContain('Charging Boar');
    expect(md).toContain('The Hydra');
  });
});
