/**
 * The Power tuner (data/weaponPower.ts).
 *
 * Always: the table patcher only rewrites the tuned block.
 * POWER_TUNE=1: for every Armory weapon, searches the Power it adds per watch
 * via damped log-bisection so that weapon alone reaches about ×10 damage per
 * minute (vs no gear) in the last half minute of a 3-minute endgame fight,
 * rewrites the PER table, and prints single / pair / full-build verification!
 *   ONLY=chaos-shard,rust   just these weapons
 *   RUNS=8                  seeds per measurement
 */
import * as fs from 'fs';
import * as path from 'path';
import type { CharacterName } from '@/types';
import type { AdventureSave, ArcanaId } from '@/adventure/types';
import { NO_POWER, PER, PER_TRIAL } from '@/adventure/data/weaponPower';
import { TREE_BUDGET } from '@/adventure/data/skillTrees';
import { armableRecipes, buyTree, solidCharms } from '@/adventure/engine/botBuilds';
import { createRng } from '@/adventure/engine/rng';
import { createMaxedSave } from '@/adventure/progress';
import { median, normalizeRecipePair, pace, scaleBench } from '@/adventure/balance/lab';
import { BALANCE_TARGETS, PARTNER_WEAPONS } from '@/adventure/balance/targets';

const FILE = path.join(__dirname, '..', 'src', 'adventure', 'data', 'weaponPower.ts');

export const writePerTable = (source: string, table: Record<string, number>): string => {
  const begin = source.indexOf('// POWER-TUNER:BEGIN');
  const end = source.indexOf('// POWER-TUNER:END');
  if (begin < 0 || end < begin) throw new Error('weaponPower.ts has no POWER-TUNER block');
  const rows = Object.keys(table).sort().map(id => `  '${id}': ${table[id]},`).join('\n');
  return `${source.slice(0, begin)}// POWER-TUNER:BEGIN\nexport const PER: Readonly<Record<string, number>> = {\n${rows}\n};\n${source.slice(end)}`;
};

const roundPer = (v: number) => (v < 0.05 ? Math.round(v * 10000) / 10000 : Math.round(v * 1000) / 1000);

describe('Power tuner', () => {
  it('rewrites only the tuned block', () => {
    const src = "a\n// POWER-TUNER:BEGIN\nexport const PER = {};\n// POWER-TUNER:END\nb\n";
    expect(writePerTable(src, { rust: 1.5, 'blast-powder': 0.25 })).toBe(
      "a\n// POWER-TUNER:BEGIN\nexport const PER: Readonly<Record<string, number>> = {\n  'blast-powder': 0.25,\n  'rust': 1.5,\n};\n// POWER-TUNER:END\nb\n"
    );
  });

  (process.env.POWER_TUNE ? it : it.skip)('tunes every weapon toward its single-weapon target and rewrites the table', () => {
    const runs = Number(process.env.RUNS ?? 8);
    const target = BALANCE_TARGETS.power.single;
    const { save } = scaleBench();
    const none = pace(save, runs).end;
    const only = process.env.ONLY?.split(',');
    const table: Record<string, number> = { ...PER };
    const lines: string[] = [`no gear: ${none.toFixed(1)} dmg/min at the end`];
    const singleRatios: number[] = [];

    try {
      for (const id of save.armory) {
        if (NO_POWER.has(id) || (only && !only.includes(id))) continue;
        let per = table[id] ?? 0.5;
        let lo: number | null = null;
        let hi: number | null = null;
        let best = { per, err: Infinity, ratio: 0 };
        for (let step = 0; step < 8; step++) {
          PER_TRIAL.set(id, per);
          const ratio = pace({ ...save, charms: [id] }, runs).end / Math.max(1, none);
          const err = Math.abs(Math.log(Math.max(0.05, ratio) / target));
          if (err < best.err) best = { per, err, ratio };
          if (err < 0.05) break;
          if (ratio < target) lo = lo === null ? per : Math.max(lo, per);
          else hi = hi === null ? per : Math.min(hi, per);
          // Once bracketed, bisect cleanly in log space; otherwise take a damped 0.85 step
          if (lo !== null && hi !== null && hi > lo * 1.005) {
            per = Math.sqrt(lo * hi);
          } else {
            per = Math.min(40, Math.max(0.001, per * Math.pow(target / Math.max(0.1, ratio), 0.85)));
          }
        }
        PER_TRIAL.delete(id);
        table[id] = roundPer(best.per);
        if (!PARTNER_WEAPONS.includes(id)) singleRatios.push(best.ratio);
        lines.push(`${id.padEnd(20)} per ${table[id]}  ×${best.ratio.toFixed(2)}`);
      }
      fs.writeFileSync(FILE, writePerTable(fs.readFileSync(FILE, 'utf8'), table));

      // Quick 4-run calibration check across single / sampled pairs / full builds so POWER_KNEE/POWER_SHARE drift is immediately visible
      if (!only) {
        for (const [k, v] of Object.entries(table)) PER_TRIAL.set(k, v);
        const checkRuns = 4;
        const none4 = pace(save, checkRuns).end;
        const rng = createRng(42);
        const samplePairs = rng.shuffle([...armableRecipes(save)]).slice(0, 20);
        const pairRatios = samplePairs.map(
          r => pace({ ...save, charms: normalizeRecipePair(r.options[0][0], r.options[1][0]) }, checkRuns).end / Math.max(1, none4)
        );
        const maxed = createMaxedSave();
        const coherentArcana: ArcanaId[] = ['prismatic_fever', 'catalyst_resonance', 'tempo_surge'];
        const fullRatios = (save.unlockedFighters as CharacterName[]).map(fighter => {
          const frng = createRng(7 + fighter.length);
          const s: AdventureSave = {
            ...save,
            upgrades: maxed.upgrades,
            selectedFighter: fighter,
            skillNodes: { [fighter]: buyTree(fighter, TREE_BUDGET, 'spread', frng) },
            equippedArcana: coherentArcana,
          };
          return pace({ ...s, charms: solidCharms(s, frng) }, checkRuns).end / Math.max(1, none4);
        });
        lines.push(
          `--- Calibration Check ---`,
          `singleMedian: ×${median(singleRatios).toFixed(2)} (target ×${BALANCE_TARGETS.power.single}, band ${BALANCE_TARGETS.power.singleBand.join('–')})`,
          `pairMedian  : ×${median(pairRatios).toFixed(2)} max ×${Math.max(...pairRatios).toFixed(2)} (target ×${BALANCE_TARGETS.power.pair}, band ${BALANCE_TARGETS.power.pairBand.join('–')})`,
          `fullMedian  : ×${median(fullRatios).toFixed(2)} (target ×${BALANCE_TARGETS.power.full}, band ${BALANCE_TARGETS.power.fullBand.join('–')})`
        );
      }
    } finally {
      PER_TRIAL.clear();
    }
    console.log(lines.join('\n'));
  }, 3600000);
});
