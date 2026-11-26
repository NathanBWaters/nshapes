import { LEVELS, externalPressuresOf, getLevel } from '@/adventure/data/levels';
import { SURGE_RULES } from '@/adventure/data/rules';
import { challengeProgress } from '@/adventure/engine/challenges';
import { buildDamageStory } from '@/adventure/engine/damageStory';
import { hasAnySet } from '@/adventure/engine/sets';
import type { RunState } from '@/adventure/types';
import { eventsOf, playSet, startFight, testLevel, tick } from './testUtils/adventureFight';

const surgeLevel = (hp = 999) =>
  testLevel({ foes: [{ name: 'Dummy', hp }], rules: { shadingSurge: true, timer: 300, boardSize: 15 }, challenge: { kind: 'surgeSets', n: 1 } });

const fight = (hp?: number) => startFight({ level: surgeLevel(hp), features: ['hearts'] });

const shadings = (s: RunState) => new Set(s.board.map(c => c.shading));

describe('Shading Surge', () => {
  it('starts calm: three traits, every card solid', () => {
    const s = fight();
    expect(s.attributes).toEqual(['shape', 'color', 'number']);
    expect(s.surge).toMatchObject({ active: false, msLeft: SURGE_RULES.calmMs, count: 0 });
    expect(shadings(s)).toEqual(new Set(['solid']));
  });

  it('warns, then switches shading on for 15s, then back off', () => {
    let s = fight();
    s = tick(s, SURGE_RULES.calmMs - SURGE_RULES.warnMs + 250);
    expect(eventsOf(s, 'surge_warn')).toHaveLength(1);
    expect(s.surge?.active).toBe(false);

    s = tick(s, SURGE_RULES.warnMs);
    expect(s.surge?.active).toBe(true);
    expect(s.attributes).toEqual(['shape', 'color', 'number', 'shading']);
    expect(eventsOf(s, 'surge_start')).toHaveLength(1);
    expect(shadings(s).size).toBeGreaterThan(1);
    expect(hasAnySet(s.board, s.attributes)).toBe(true);

    s = tick(s, SURGE_RULES.surgeMs);
    expect(s.surge?.active).toBe(false);
    expect(s.attributes).toEqual(['shape', 'color', 'number']);
    expect(shadings(s)).toEqual(new Set(['solid']));
    expect(eventsOf(s, 'surge_end')).toHaveLength(1);
  });

  it('keeps the shape, color and number of every card when the surge starts', () => {
    let s = fight();
    const before = s.board.map(c => [c.id, c.shape, c.color, c.number]);
    s = tick(s, SURGE_RULES.calmMs);
    expect(s.surge?.active).toBe(true);
    expect(s.board.map(c => [c.id, c.shape, c.color, c.number])).toEqual(before);
  });

  it('a Set during the surge deals ×5 (3 → 15) and counts for the challenge', () => {
    let s = fight();
    s = playSet(s);
    expect(s.foeHp).toBe(999 - 3);
    expect(challengeProgress(s).met).toBe(false);

    s = tick(s, SURGE_RULES.calmMs);
    const hp = s.foeHp;
    s = playSet(s);
    expect(hp - s.foeHp).toBe(3 * SURGE_RULES.multiplier);
    expect(eventsOf(s, 'surge_hit')).toHaveLength(1);
    expect(s.surge?.sets).toBe(1);
    expect(challengeProgress(s).met).toBe(true);
  });

  it('stacks with a charged "next Set" multiplier', () => {
    let s = fight();
    s = tick(s, SURGE_RULES.calmMs);
    s = { ...s, nextSetMultiplier: 2 };
    const hp = s.foeHp;
    s = playSet(s);
    expect(hp - s.foeHp).toBe(3 * 2 * SURGE_RULES.multiplier);
  });

  it('flat per-Set bonuses are added BEFORE the ×5 Shading Surge multiplier (add-then-multiply)', () => {
    let s = fight();
    s = tick(s, SURGE_RULES.calmMs);
    s = { ...s, bonusDamagePerMatch: 2 };
    const hp = s.foeHp;
    s = playSet(s);
    expect(hp - s.foeHp).toBe((3 + 2) * SURGE_RULES.multiplier);
    const entry = s.log[s.log.length - 1];
    expect(entry.set?.multItems).toContainEqual(
      expect.objectContaining({ label: 'Shading Surge', amount: SURGE_RULES.multiplier })
    );
    expect(entry.set?.multiplier).toBe(SURGE_RULES.multiplier);

    const story = buildDamageStory(s);
    expect(Math.round(story.totalDamage)).toBe(25);
    const sum = story.sources.reduce((acc, src) => acc + src.totalDamage, 0);
    expect(Math.abs(sum - story.totalDamage)).toBeLessThanOrEqual(story.sources.length);
  });

  it('cards dealt during the surge are shaded, cards dealt after it are solid', () => {
    let s = fight();
    s = tick(s, SURGE_RULES.calmMs);
    for (let i = 0; i < 4; i++) s = playSet(s);
    expect(shadings(s).size).toBeGreaterThan(1);
    s = tick(s, SURGE_RULES.surgeMs);
    for (let i = 0; i < 4; i++) s = playSet(s);
    expect(shadings(s)).toEqual(new Set(['solid']));
  });

  it('cycles: a second surge comes after another calm', () => {
    let s = fight();
    s = tick(s, SURGE_RULES.calmMs + SURGE_RULES.surgeMs + SURGE_RULES.calmMs);
    expect(s.surge).toMatchObject({ active: true, count: 2 });
  });

  it('pauses while frozen', () => {
    let s = fight();
    s = { ...s, frozenMs: 60000 };
    s = tick(s, SURGE_RULES.calmMs);
    expect(s.surge).toMatchObject({ active: false, msLeft: SURGE_RULES.calmMs });
  });

  it('levels without it never surge', () => {
    let s = startFight({ level: testLevel({ rules: { timer: 300 } }), features: ['hearts'] });
    expect(s.surge).toBeNull();
    s = tick(s, SURGE_RULES.calmMs + 1000);
    expect(s.attributes).toHaveLength(3);
  });
});

describe('Shading Surge in the campaign', () => {
  const world = (id: string) => Number(id.split('-')[0]);

  it('Worlds 1-2 never surge; Worlds 3-5 play on <=3 traits and respect the [GP-09] pressure cap', () => {
    const w35Surges = LEVELS.filter(l => world(l.id) >= 3 && l.rules.shadingSurge);
    expect(w35Surges.length).toBeGreaterThanOrEqual(8);
    for (const l of LEVELS) {
      expect(l.rules.attributes.length).toBeLessThanOrEqual(3);
      if (world(l.id) < 3) {
        expect(!!l.rules.shadingSurge).toBe(false);
      }
      const cap = l.id === '5-5' ? 3 : 2;
      expect(externalPressuresOf(l).length).toBeLessThanOrEqual(cap);
    }
  });

  it('3-1 introduces it and asks for a Set during the surge', () => {
    const l = getLevel('3-1');
    expect(l.introduces).toBe('attr_shading');
    expect(l.challenge).toEqual({ kind: 'surgeSets', n: 1 });
  });
});
