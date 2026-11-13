/**
 * The HP tuner (src/adventure/balance/tuner.ts).
 *
 * Always: the text patcher only touches the level it is asked to.
 * BALANCE_TUNE=1 (npm run balance:tune): searches every level's foe HP for the
 * scale closest to its bare/invested targets and rewrites data/levels.ts.
 */
import * as fs from 'fs';
import * as path from 'path';
import { LEVELS } from '@/adventure/data/levels';
import { winTargets } from '@/adventure/engine/botBuilds';
import { scaleLevelHp, tuneLevel } from '@/adventure/balance/tuner';

const FILE = path.join(__dirname, '..', 'src', 'adventure', 'data', 'levels.ts');

describe('HP tuner', () => {
  it('scales the HP of one level and leaves the others alone', () => {
    const src = "  { id: '1-1', foes: [{ hp: 10 }] },\n  { id: '1-2', foes: [{ hp: 20 }, { hp: 30 }] },\n  { id: '1-3', foes: [{ hp: 40 }] },\n";
    expect(scaleLevelHp(src, '1-2', 1.5)).toBe("  { id: '1-1', foes: [{ hp: 10 }] },\n  { id: '1-2', foes: [{ hp: 30 }, { hp: 45 }] },\n  { id: '1-3', foes: [{ hp: 40 }] },\n");
    expect(() => scaleLevelHp(src, '9-9', 2)).toThrow();
  });

  (process.env.BALANCE_TUNE ? it : it.skip)('retunes foe HP toward each level\'s targets and rewrites levels.ts', () => {
    const only = process.env.ONLY?.split(',');
    let source = fs.readFileSync(FILE, 'utf8');
    const lines: string[] = [];
    for (const level of LEVELS) {
      if (level.starRule?.kind === 'accuracy' || (only && !only.includes(level.id))) continue;
      const { best } = tuneLevel(level, Number(process.env.RUNS ?? 60));
      const t = winTargets(level);
      const pct = (x: number) => `${Math.round(x * 100)}%`;
      lines.push(`${level.id.padEnd(6)} ×${best.scale.toFixed(2)}  bare ${pct(best.bare)} (${pct(t.bare)})  invested ${pct(best.invested)} (${pct(t.invested)})`);
      if (best.scale !== 1) source = scaleLevelHp(source, level.id, best.scale);
    }
    fs.writeFileSync(FILE, source);
    console.log(lines.join('\n'));
  });
});
