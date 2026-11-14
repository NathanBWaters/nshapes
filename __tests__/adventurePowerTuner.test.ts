/**
 * The Power tuner (data/weaponPower.ts).
 *
 * Always: the table patcher only rewrites the tuned block.
 * POWER_TUNE=1: for every Armory weapon, searches the Power it adds per watch
 * so that weapon alone reaches about ×10 damage per minute (vs no gear) in the
 * last half minute of a 3-minute endgame fight, and rewrites the PER table.
 *   ONLY=chaos-shard,rust   just these weapons
 *   RUNS=8                  seeds per measurement
 */
import * as fs from 'fs';
import * as path from 'path';
import { PER, PER_TRIAL } from '@/adventure/data/weaponPower';
import { NO_POWER } from '@/adventure/data/weaponPower';
import { pace, scaleBench } from '@/adventure/balance/lab';
import { BALANCE_TARGETS } from '@/adventure/balance/targets';

const FILE = path.join(__dirname, '..', 'src', 'adventure', 'data', 'weaponPower.ts');

export const writePerTable = (source: string, table: Record<string, number>): string => {
  const begin = source.indexOf('// POWER-TUNER:BEGIN');
  const end = source.indexOf('// POWER-TUNER:END');
  if (begin < 0 || end < begin) throw new Error('weaponPower.ts has no POWER-TUNER block');
  const rows = Object.keys(table).sort().map(id => `  '${id}': ${table[id]},`).join('\n');
  return `${source.slice(0, begin)}// POWER-TUNER:BEGIN\nexport const PER: Readonly<Record<string, number>> = {\n${rows}\n};\n${source.slice(end)}`;
};

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
    for (const id of save.armory) {
      if (NO_POWER.has(id) || (only && !only.includes(id))) continue;
      let per = table[id] ?? 0.5;
      let best = { per, err: Infinity, ratio: 0 };
      for (let step = 0; step < 7; step++) {
        PER_TRIAL.set(id, per);
        const ratio = pace({ ...save, charms: [id] }, runs).end / Math.max(1, none);
        const err = Math.abs(Math.log(ratio / target));
        if (err < best.err) best = { per, err, ratio };
        if (err < 0.06) break;
        per = Math.min(40, Math.max(0.01, per * Math.pow(target / Math.max(0.1, ratio), 1.3)));
      }
      PER_TRIAL.delete(id);
      table[id] = Math.round(best.per * 1000) / 1000;
      lines.push(`${id.padEnd(20)} per ${table[id]}  ×${best.ratio.toFixed(2)}`);
    }
    fs.writeFileSync(FILE, writePerTable(fs.readFileSync(FILE, 'utf8'), table));
    console.log(lines.join('\n'));
  }, 3600000);
});
