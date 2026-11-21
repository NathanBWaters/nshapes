/**
 * The HP tuner (src/adventure/balance/tuner.ts).
 *
 * Always: the text patcher only touches the level it is asked to.
 * BALANCE_TUNE=1 (npm run balance:tune): searches every level's foe HP for the
 * scale closest to its bare/invested targets, flags lethality walls, validates
 * the monotonic campaign HP curve, and rewrites data/levels.ts.
 * WIDE=1 first sweeps ×0.125 to ×16, for after a big change to damage.
 */
import * as fs from 'fs';
import * as path from 'path';
import { LEVELS } from '@/adventure/data/levels';
import { winTargets } from '@/adventure/engine/botBuilds';
import { effectiveLevelHp, scaleLevelHp, tuneLevel } from '@/adventure/balance/tuner';

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
    const scales: Record<string, { scale: number; runtimeHp: number; effHp: number; lethalityWall: boolean; line: string }> = {};
    const lines: string[] = [];
    for (const level of LEVELS) {
      if (level.starRule?.kind === 'accuracy' || (only && !only.includes(level.id))) continue;
      const { best } = tuneLevel(level, Number(process.env.RUNS ?? 60), !!process.env.WIDE);
      const t = winTargets(level);
      const pct = (x: number) => `${Math.round(x * 100)}%`;
      const runtimeHp = Math.round(level.foes.reduce((s, f) => s + f.hp, 0) * best.scale);
      const effHp = Math.round(effectiveLevelHp(level) * best.scale);
      const wall = best.lethalityWall ? ' [LETHALITY_WALL]' : '';
      const waves = best.waveClearRates.length ? ` waves=${best.waveClearRates.map(pct).join('/')}` : '';
      const line =
        `${level.id.padEnd(6)} ×${best.scale.toFixed(2)} hp=${String(runtimeHp).padStart(7)} (eff=${String(effHp).padStart(7)}) ` +
        `bare ★1+${pct(best.bareClear)} ★★+${pct(best.bare)}(${pct(t.bare)}) | ` +
        `inv ★1+${pct(best.investedClear)} ★★+${pct(best.invested)}(${pct(t.invested)}) ★★★${pct(best.investedStar3)} ` +
        `heartLoss=${pct(best.investedHeartLoss)}${waves}${wall}`;
      lines.push(line);
      scales[level.id] = { scale: best.scale, runtimeHp, effHp, lethalityWall: best.lethalityWall, line };
      if (best.scale !== 1) source = scaleLevelHp(source, level.id, best.scale);
    }
    if (process.env.SCALE_OUT) fs.writeFileSync(process.env.SCALE_OUT, JSON.stringify(scales, null, 2));
    else fs.writeFileSync(FILE, source);
    console.log(lines.join('\n'));
  }, 1_800_000);
});
