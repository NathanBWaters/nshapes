import { LEVELS } from '@/adventure/data/levels';
import { MECHANICS } from '@/adventure/data/mechanics';
import type { MechanicDef } from '@/adventure/types';

const textOf = (m: MechanicDef): string[] => [
  ...m.body,
  ...(m.fightTips ?? []).map(t => t.text),
  ...(m.lessons ?? []).flatMap(l => l.body),
];

describe('tutorial text matches the level it teaches in', () => {
  // A level's numbers get retuned; any sentence that states its ★★★ goal must keep up.
  const cases = LEVELS.flatMap(level => {
    const m = MECHANICS[level.introduces];
    const n = 'n' in level.challenge ? level.challenge.n : undefined;
    if (!m || n === undefined) return [];
    const goalLines = textOf(m).filter(t => /third star/i.test(t));
    return goalLines.length ? [{ id: level.id, n, goalLines }] : [];
  });

  const WORDS: Record<number, string> = { 1: 'once', 2: 'twice', 3: 'three', 4: 'four', 5: 'five' };

  it.each(cases)('$id states its ★★★ number ($n)', ({ n, goalLines }) => {
    const pattern = WORDS[n] ? `\\b(${n}|${WORDS[n]})\\b` : `\\b${n}\\b`;
    for (const line of goalLines) expect(line).toMatch(new RegExp(pattern, 'i'));
  });
});
